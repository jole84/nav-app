import {Feature, Map, View} from 'ol';
import {fromLonLat, toLonLat} from 'ol/proj.js';
import TileLayer from 'ol/layer/Tile.js';
import Overlay from 'ol/Overlay.js';
import LineString from 'ol/geom/LineString';
import Geolocation from 'ol/Geolocation.js';
import VectorSource from 'ol/source/Vector.js';
import GPX from 'ol/format/GPX.js';
import {Stroke, Style, Icon, Fill, Text, Circle} from 'ol/style.js';
import {Vector as VectorLayer} from 'ol/layer.js';
import TileWMS from 'ol/source/TileWMS.js';
import WMTS from 'ol/source/WMTS.js';
import WMTSTileGrid from 'ol/tilegrid/WMTS.js';
import Point from 'ol/geom/Point.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import WKT from 'ol/format/WKT.js';
import {getDistance} from 'ol/sphere';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import MVT from 'ol/format/MVT.js';
// import {getLength} from 'ol/sphere';

let wakeLock;
const acquireWakeLock = async () => {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.log(err);
    }
  }
};
acquireWakeLock();
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    acquireWakeLock();
  }
});

var center = fromLonLat([14.18, 57.786]);
var vagKarta = false;
const documentTitle = "Live-track-vector";
document.title = documentTitle;
var defaultZoom = 14;
let distanceTraveled = 0;
var lastInteraction = new Date() - 5000;
var preferredFontSize;
const startTime = new Date();
var trackLog = [];
var maxSpeed = 0;
var mapDiv = document.getElementById("map");
var infoGroup = document.getElementById("infoGroup");
var centerButton = document.getElementById("centerButton");
var saveLogButton = document.getElementById("saveLogButton");
var switchMapButton = document.getElementById("switchMapButton");
var customFileButton = document.getElementById("customFileButton");
saveLogButton.onclick = saveLogButtonFunction;
centerButton.onclick = centerFunction;
switchMapButton.onclick = switchMap;

const view = new View({
  center: center,
  zoom: 8,
  minZoom: 6,
  maxZoom: 20,
  constrainRotation: false,
  extent: [900000, 7200000, 2900000, 11000000]
});

const gpxStyle = {
  'Point': new Style({
    image: new Icon({
      anchor: [0.5, 1],
      src: 'https://jole84.se/default-marker.png',
    }),
    text: new Text({
      font: '14px Droid Sans Mono,monospace',
      textAlign: 'left',
      offsetX: 10,
      fill: new Fill({
        color: '#b41412',
      }),
      stroke: new Stroke({
        color: 'white',
        width: 4,
      }),
    }),
  }),
  'LineString': new Style({
    stroke: new Stroke({
      color: [0, 0, 255, 0.6],
      width: 10,
    }),
  })
};
gpxStyle['MultiLineString'] = gpxStyle['LineString'];

const trackStyle = {
  'LineString': new Style({
    stroke: new Stroke({
      color: [255, 0, 0, 0.8],
      width: 6,
    }),
  }),
  'route': new Style({
    stroke: new Stroke({
      width: 10,
      color: [255, 0, 255, 0.6],
    }),
  }),
  'icon': new Style({
    image: new Circle({
      fill: new Fill({
        color: 'rgba(255,0,0,0.5)',
      }),
      radius: 10,
      stroke: new Stroke({
        color: 'rgb(255,0,0)',
        width: 2,
      }),
    }),
  }),
};
trackStyle['MultiLineString'] = trackStyle['LineString'];

function getRotation(feature, vinkel) {
  return (-(feature.get(vinkel)) * (Math.PI / 180))
}

var styleFunction = function (feature) {    //Function to determine style of icons
  const resolution = view.getResolution();
  // ATK
  if (feature.get('layer') == 'ATK') {
    return [new Style({
      zIndex: 30,
      text: new Text({
        offsetY: 2,
        text: (feature.get('HTHAST')).toString(),
        font: 'bold 22px Arial, Helvetica, sans-serif',
        rotation: (feature.get('vinkel')) * (Math.PI / 180) + Math.PI,
        rotateWithView: true,
        fill: new Fill({
          color: 'black',
        }),
        }),
        image: new Circle({
          radius: 16,
          fill: new Fill({
            color: '#ffd300'
          }),
          stroke: new Stroke({
            width: 4,
            color: '#e73137'
          }),
        }),
      }),
      new Style({
        zIndex: 20,
        image: new Icon(({
          rotateWithView: true,
          anchor: [-0.6, 0.5],
          rotation: (feature.get('vinkel')) * (Math.PI / 180) + Math.PI,
          scale: 0.06,
          src: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/stil_vagkarta/e24-1.svg'
        })),
      }),
    ];
  }

  // mark
  else if (feature.get('layer') == 'mark') {
    if (vagKarta) {
      return [new Style({
        fill: new Fill({
          color: markColorVagKarta[feature.get('objekttypnr')],
        }),
      })];
    }
    else {
      return [new Style({
        fill: new Fill({
          color: markColor[feature.get('objekttypnr')],
        }),
      })];
    }
  }

  // hojdlinje
  else if (feature.get('layer') == 'hojdlinje' && !vagKarta) {
      return [new Style({
        stroke: new Stroke({
          color: '#c7a88b',
          width: 1,
        }),
    })];
  }

  // roads
  else if (feature.get('layer') == 'roads'){
    const vagBredd = (feature.get('width') * 10) / resolution || 20 / resolution;
    if (feature.get('highway') == 'primary') { // asfaltsväg
      // stratväg
      if (feature.get('stratvag') != undefined && vagKarta) {
        return [new Style({
          zIndex: 11,
          stroke: new Stroke({
            color: getRoadColor('stratvag'),
            width: feature.get('maxspeed') / (resolution + 10),
          }),
        })];    
      }

      // normväg
      else {
        return [new Style({
          zIndex: 10,
          stroke: new Stroke({
            color: getRoadColor('normvag'),
            width: feature.get('maxspeed') / (resolution + 10),
          }),
          // text: new Text({
          //   text: feature.get('name'),
          //   font: '12px sans-serif',
          //   placement: 'line',
          //   fill: new Fill({
          //     color: 'black',
          //   }),
          //   stroke: new Stroke({
          //     color: 'white',
          //     width: 3,
          //   }),
          // }),
        })];   
      }
    }

    // underhåll
    if (feature.get('underh') != undefined && !vagKarta) {
      return [
        new Style({
          zIndex: 9,
          stroke: new Stroke({
          color: getRoadColor('grus'),
          width: vagBredd,
        }),
      }),
      new Style({
        zIndex: 9,
        stroke: new Stroke({
          lineCap: 'square',
          color: 'black',
          width: vagBredd,
          lineDash: [80 / resolution, 160 / resolution],
        }),
      })
    ];
    }
    // grusväg
    if (feature.get('highway') == 'unclassified') {
      return [new Style({
        zIndex: 9,
        stroke: new Stroke({
          color: getRoadColor('grus'),
          width: vagBredd,
        }),
      })]; 
    }

    // traktorväg
    if (feature.get('highway') == 'track') {
      return [new Style({
        zIndex: 8,
        stroke: new Stroke({
          color: getRoadColor('grus'),
          width: 20 / resolution,
          lineDash: [80 / resolution, 160 / resolution]
        }),
      })];
    }
  }

  // ralstrafik
  else if (feature.get('layer') == 'ralstrafik'){
    return [
      new Style({
        zIndex: 9,
        stroke: new Stroke({
        color: 'white',
        width: 3,
      }),
      }),
      new Style({
        zIndex: 9,
        stroke: new Stroke({
          lineCap: 'square',
          color: '#2f2f2f',
          width: 3,
          lineDash: [8, 16],
        }),
      })
    ];
  }

  // ledningslinje
  else if (feature.get('layer') == 'ledningslinje'){
    return [new Style({
        zIndex: 9,
        stroke: new Stroke({
          color: '#4e4e4e',
          width: 2,
        }),
      })
    ];
  }

  // militart_omrade
  else if (feature.get('layer') == 'militart_omrade'){
    if (feature.get('objekttypnr') == 5503) {
      return [new Style({
          zIndex: 9,
          stroke: new Stroke({
            color: '#00a6e6',
            width: 2,
          }),
        })
      ];
    }
    else {
      return [new Style({
        zIndex: 9,
        stroke: new Stroke({
          color: '#00a6e6',
          width: 2,
          lineCap: 'square',
          lineDash: [8, 16],
        }),
      })
    ];
    }
  }

  // start_landningsbana
  else if (feature.get('layer') == 'start_landningsbana') {
    return [new Style({
      fill: new Fill({
        color: '#4b4b4b',
      }),
    })];
  }
  else if (feature.get('layer') == 'start_landningsbana_linje') {
    return [new Style({
      zIndex: 20,
      stroke: new Stroke({
        lineCap: 'square',
        color: '#4e4e4e',
        width: 10,
      }),
    })];
  }
  // flygplatsomrade
  else if (feature.get('layer') == 'flygplatsomrade') {
    return [new Style({
      zIndex: 20,
      stroke: new Stroke({
        color: '#4e4e4e',
        width: 2,
      }),
    })];
  }
  // anlaggningsomrade
  else if (feature.get('layer') == 'anlaggningsomrade') {
    return [new Style({
      zIndex: 20,
      stroke: new Stroke({
        color: '#4e4e4e',
        width: 2,
        lineCap: 'square',
        lineDash: [8, 16],
      }),
    })
  ];
  }

  // naturvardslinje
  else if (feature.get('layer') == 'naturvardslinje') {
    return [new Style({
      zIndex: 20,
      stroke: new Stroke({
        color: 'green',
        width: 2,
        lineCap: 'square',
        lineDash: [8, 16],
      }),
    })
  ];
  }

  // rastplats
  else if (feature.get('layer') == 'rastplats') {
    return [new Style({
      image: new Icon(({
        // anchor: [-0.4, 0.4],
        scale: 0.05,
        // src: 'https://www.trafikverket.se/Static/dist/images/trafficinfo/restArea.svg'
        src: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/stil_vagkarta/h13-1.svg'
      })),
    })];
  }

  // höjdhinder
  else if (feature.get('layer') == 'hojdhinder' && vagKarta) {
    return [new Style({
      text: new Text({
        offsetY: 2,
        text: (feature.get('hojd')).toFixed(1) + "m",
        font: 'bold 12px sans-serif',
        fill: new Fill({
          color: 'black',
        }),
      }),
      image: new Icon(({
        // anchor: [-0.4, 0.4],
        scale: 0.08,
        src: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/stil_vagkarta/c17-1.svg'
      })),
    })];
  }

  // pficka
  else if (feature.get('layer') == 'pficka' && vagKarta) {
    return [new Style({
      image: new Icon(({
        // anchor: [-0.4, 0.4],
        scale: 0.1,
        src: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/stil_vagkarta/e19-1.svg'
      })),
    })];
  }

  // vagpunkt
  else if (feature.get('layer') == 'vagpunkt') {
    if (feature.get('highway') == 'turning_circle') {
      return [new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({
            color: 'white'
          }),
          stroke: new Stroke({
            width: 2,
            color: 'black'
          }),
        }),
      })];
    }
    else {
      return [new Style({
        image: new Icon(({
          rotateWithView: true,
          rotation: getRotation(feature, 'rotation'),
          scale: 1.5,
          // anchor: [-0.4, 0.4],
          src: 'https://github.com/jole84/slitlagerkarta_qgis_stilar/raw/main/kartsymboler/vagbom.svg'
        })),
      })];
    }
  }

  // byggnad
  else if (feature.get('layer') == 'byggnad') {
    return [new Style({
      zIndex: 10,
      fill: new Fill({
        color: '#2f2f2f',
      })
    })];
  }

  // byggnadspunkt
  else if (feature.get('layer') == 'byggnadspunkt') {
    const featureType = feature.get('objekttypnr');
    if (byggnadspunktSymbolKeys.includes(featureType.toString())) {
      return [new Style({
        image: new Icon(({
          rotateWithView: true,
          rotation: getRotation(feature, 'rotation'),
          scale: 1.5,
          anchor: [0.5, 0.5],
          src: byggnadspunktSymbol[featureType]
        })),
      })];
    }
  }

// kultur_lamning_punkt
else if (feature.get('layer') == 'kultur_lamning_punkt') {
  const featureType = feature.get('objekttypnr');
  if (kultur_lamning_punktSymbolKeys.includes(featureType.toString())) {
    return [new Style({
      image: new Icon(({
        rotateWithView: true,
        rotation: getRotation(feature, 'rotation'),
        scale: 1.5,
        anchor: [0.5, 0.5],
        src: kultur_lamning_punktSymbol[featureType]
      })),
    })];
  }
}
// anlaggningsomradespunkt
else if (feature.get('layer') == 'anlaggningsomradespunkt') {
  const featureType = feature.get('objekttypnr');
  const andamal = feature.get('andamal');
  if (anlaggningsomradespunktSymbolKeys.includes(andamal)) {
    return [new Style({
      zIndex: 20,
      image: new Icon(({
        rotateWithView: true,
        rotation: getRotation(feature, 'rotation'),
        scale: 1.5,
        anchor: [0.5, 0.5],
        src: anlaggningsomradespunktSymbol[andamal]
      })),
    })];
  }
}

  // hydrolinje
  else if (feature.get('layer') == 'hydrolinje') {
    return [new Style({
      zIndex: 8,
      stroke: new Stroke({
        color: '#bfe6ff',
        width: feature.get('storleksklass') * 20 / resolution,
      }),
    })];
  }

  // textpunkt
  else if (feature.get('layer') == 'textpunkt'){
    return [new Style({
      zIndex: 20,
      text: new Text({
        // text: feature.get('name') + " " + feature.get('textstorleksklass'),
        text: feature.get('name'),
        font: textStorlek[feature.get('textstorleksklass')] + 'px Calibri,sans-serif',
        textBaseline: textBaseLine[feature.get('textlage')],
        justify: textJustify[feature.get('textlage')],
        placement: 'line',
        fill: new Fill({
          color: 'black',
        }),
        stroke: new Stroke({
          color: 'white',
          width: 3,
        }),
      }),
    })];    
  }

};

function getRoadColor(roadType) {
  if (vagKarta) {
    const roadColor = {
      'stratvag': 'green',
      'normvag': 'black',
      'grus': '#bababa'
    }
    return roadColor[roadType];
  }
  else {
    const roadColor = {
      'stratvag': 'green',
      'normvag': 'black',
      'grus': '#ac7c45'
    }
    return roadColor[roadType];
  }
}

const markColor = {
  2631 : '#bfe6ff', // Hav
  2632 : '#bfe6ff', // Sjö
  2633 : '#bfe6ff', // Vattendragsyta
  2634 : '#bfe6ff', // Anlagt vatten
  2635 : '#ffffff', // Glaciär
  2636 : '#d99461', // Sluten bebyggelse
  2637 : '#e6b28c', // Hög bebyggelse
  2638 : '#f2cf9b', // Låg bebyggelse
  2639 : '#f0f0f0', // Industri och handelsbebyggelse
  2640 : '#ffffea', // Öppen mark
  2642 : '#fff7a6', // Åker
  2643 : '#fff7a6', // Fruktodling
  2644 : '#fffff2', // Kalfjäll
  2645 : '#d4eeb7', // Barr och blandskog
  2646 : '#e3f7c7', // Lövskog
  2647 : '#d9f5d1', // Fjällbjörkskog
  2648 : '#ffffff', // Ej karterat område
  2649 : '#f2cf9b', // Bebyggelse
  2650 : '#e3f7c7', // Skog
  2654 : '#bfe6ff', // Vattenyta
}

const markColorVagKarta = {
  2631 : '#bfe6ff', // Hav
  2632 : '#bfe6ff', // Sjö
  2633 : '#bfe6ff', // Vattendragsyta
  2634 : '#bfe6ff', // Anlagt vatten
  2635 : '#ffffff', // Glaciär
  2636 : '#d4d4d4', // Sluten bebyggelse
  2637 : '#d4d4d4', // Hög bebyggelse
  2638 : '#d4d4d4', // Låg bebyggelse
  2639 : '#f0f0f0', // Industri och handelsbebyggelse
  2640 : '#fcfcfc', // Öppen mark
  2642 : '#fcfcfc', // Åker
  2643 : '#fcfcfc', // Fruktodling
  2644 : '#fcfcfc', // Kalfjäll
  2645 : '#ededed', // Barr och blandskog
  2646 : '#ededed', // Lövskog
  2647 : '#ededed', // Fjällbjörkskog
  2648 : '#ffffff', // Ej karterat område
  2649 : '#d4d4d4', // Bebyggelse
  2650 : '#ededed', // Skog
  2654 : '#bfe6ff', // Vattenyta
}

const textStorlek = {
  1 : 10.5,
  2 : 12,
  3 : 14,
  4 : 16,
  5 : 18,
  6 : 20,
  7 : 24,
  8 : 28,
  9 : 32,
  10 : 40,
}

const textBaseLine = {
  1: 'bottom',
  2: 'bottom',
  3: 'bottom',
  4: 'mittle',
  5: 'mittle',
  6: 'mittle',
  7: 'top',
  8: 'top',
  9: 'top',
}

const textJustify = {
  7: 'left',
  4: 'left',
  1: 'left',
  8: 'center',
  5: 'center',
  2: 'center',
  9: 'right',
  6: 'right',
  3: 'right',
}

const byggnadspunktSymbol = {
  1042: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/kyrka.svg',
  1044: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/kata.svg',
  1045: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/torn.svg',
  1046: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/vindskydd2.svg',
  1047: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/vaderkvarn.svg',
  1051: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/fyr.svg',
  2019: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/mast.svg',
  2022: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/skorsten.svg',
  2025: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/vindkraft.svg',
  2034: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/hus_herrgard.svg',
  2035: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/karnkraftverk.svg',
  2038: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/hus_slott.svg',
  2045: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/hus1.svg',
  2046: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/hus2.svg',
  2047: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/hus3.svg',
}
const byggnadspunktSymbolKeys = Object.keys(byggnadspunktSymbol);

const kultur_lamning_punktSymbol = {
  2511: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/fornlamning.svg',
  2513: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/milstolpe.svg',
  2514: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/ruin.svg',
  2515: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/minnessten.svg',
  2517: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/gruvhal.svg',
  2518: 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/kulturminne.svg',
}
const kultur_lamning_punktSymbolKeys = Object.keys(kultur_lamning_punktSymbol);
const anlaggningsomradespunktSymbol = {
  'Badplats': 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/badplats.svg',
  'Campingplats': 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/camping.svg',
  'Gästhamn': 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/gasthamn.svg',
  'Skjutbana': 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/idrott_skjutbana.svg',
  'Skjutbana, mindre': 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/idrott_skjutbana_liten.svg',
  'Fotbollsplan': 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/idrott_fotbollsplan.svg',
  'Bollplan': 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/idrott_fotbollsplan.svg',
  'Travbana': 'https://raw.githubusercontent.com/jole84/slitlagerkarta_qgis_stilar/main/kartsymboler/idrott_anlaggning.svg',
}
const anlaggningsomradespunktSymbolKeys = Object.keys(anlaggningsomradespunktSymbol);


var line = new LineString([]);
var trackLine = new Feature({
  geometry: line,
})

// var slitlagerkarta = new TileLayer({
//   source: new XYZ({
//     url: 'https://jole84.se/slitlagerkarta/{z}/{x}/{y}.jpg',
//       minZoom: 6,
//       maxZoom: 14,
//   }),
//   visible: false
// });

const vectorsource = new VectorTileSource({
  format: new MVT(),
  url: 'https://jole84.se/combined/{z}/{x}/{y}.pbf',
  // url: 'combined/{z}/{x}/{y}.pbf',
  // minZoom: 0,
  maxZoom: 14,
  useSpatialIndex: true
});

const slitlagerkarta = new VectorTileLayer({
// declutter: true,
// minZoom: 11,
// layers: ['select'],
source: vectorsource,
style: styleFunction
})

 
// var slitlagerkarta_nedtonad = new TileLayer({
//   source: new XYZ({
//     url: 'https://jole84.se/slitlagerkarta_nedtonad/{z}/{x}/{y}.jpg',
//       minZoom: 6,
//       maxZoom: 14,
//   }),
//   visible: false
// });

var ortofoto = new TileLayer({
  source: new TileWMS({
    url: 'https://minkarta.lantmateriet.se/map/ortofoto/',
    params: {
      'layers': 'Ortofoto_0.5,Ortofoto_0.4,Ortofoto_0.25,Ortofoto_0.16',
      'TILED': true,
    },
  }),
  visible:false
});

var topoweb = new TileLayer({
  source: new WMTS({
    url: 'https://minkarta.lantmateriet.se/map/topowebbcache',
    layer: 'topowebb',
    format: 'image/png',
    matrixSet: "3857",
    tileGrid: new WMTSTileGrid({
      origin: [-20037508.342789, 20037508.342789],
      resolutions: [156543.03392804097, 78271.51696402048, 39135.75848201024, 19567.87924100512, 9783.93962050256, 4891.96981025128, 2445.98490512564, 1222.99245256282, 611.49622628141, 305.748113140705, 152.8740565703525, 76.43702828517625, 38.21851414258813, 19.109257071294063, 9.554628535647032, 4.777314267823516, 2.388657133911758, 1.194328566955879],
      matrixIds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    }),
  }),
  visible: false
});

var gpxLayer = new VectorLayer({
  source: new VectorSource(),
  style: function (feature) {
    gpxStyle['Point'].getText().setText(feature.get('name'));
    return gpxStyle[feature.getGeometry().getType()];
  },
});

var trackLayer = new VectorLayer({
  source: new VectorSource({
    features: [trackLine],
  }),
  style: function (feature) {
    return trackStyle[feature.getGeometry().getType()];
  },
});

var routeLayer = new VectorLayer({
  source: new VectorSource(),
  style: function (feature) {
    return trackStyle[feature.get('type')];
  },
});

// creating the map
const map = new Map({
  layers: [
    slitlagerkarta,
    ortofoto,
    topoweb,
    gpxLayer,
    routeLayer,
    trackLayer
  ],
  target: 'map',
  view: view,
  keyboardEventTarget: document,
});

// clear layer when new feature is added
function clearLayer(layerToClear) {
  layerToClear.getSource().getFeatures().forEach(function(feature) {
    layerToClear.getSource().removeFeature(feature);
  });
}

// gpx loader
var gpxFormat = new GPX();
var gpxFeatures;
customFileButton.addEventListener('change', handleFileSelect, false);
function handleFileSelect(evt) {
  var files = evt.target.files; // FileList object
  // remove previously loaded gpx files
  clearLayer(gpxLayer);
  var fileNames = [];
  for (var i = 0; i < files.length; i++) {
    console.log(files[i]);
    fileNames.push(files[i].name);
    var reader = new FileReader();
    reader.readAsText(files[i], "UTF-8");
    reader.onload = function (evt) {
      gpxFeatures = gpxFormat.readFeatures(evt.target.result,{
        dataProjection:'EPSG:4326',
        featureProjection:'EPSG:3857'
      });
      // if (files.length > 1) { // set random color if more than one file is loaded
      //   gpxFeatures.forEach(f => {
      //     f.setStyle(new Style({
      //       stroke: new Stroke({
      //         color: [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), 0.8],
      //         width: 10
      //       }),
      //     }));
      //     f.getStyle().getText().setText(f.get('name'));
      //   });
      // };
      // console.log(gpxFeatures[0].getGeometry().getCoordinates()[0][0]);
      // console.log((getLength(gpxFeatures[0].getGeometry()) / 1000).toFixed(2));
      // var coords = gpxFeatures[0].getGeometry().getCoordinates()[0];
      // console.log(coords);
      // console.log(coords.length);
      // for (var i=0; i < coords.length - 1; i++) {
      //   const distanceM = getDistance(toLonLat(coords[i]), toLonLat(coords[i+1])).toFixed(0) + "m";
      //   const endMarker = new Feature({
      //     name: distanceM,
      //     type: 'point',
      //     geometry: new Point(coords[i])
      //   });
        // gpxLayer.getSource().addFeature(endMarker);
        // console.log(coords[i])
      // }
      // coords.forEach(function(coordinate) {
      //   coordinate.pop();
      //   coordinate.pop();
      //   console.log(coordinate);
      // })
      gpxLayer.getSource().addFeatures(gpxFeatures);
    }
  }
  document.title = fileNames[fileNames.length-1] || documentTitle;
  setExtraInfo(fileNames);
  // reaquire wake lock again after file select
  acquireWakeLock();
}

// convert degrees to radians
function degToRad(deg) {
  return (deg * Math.PI * 2) / 360;
}

// milliseconds to HH:MM:SS
function toHHMMSS(milliSecondsInt) {
  var dateObj = new Date(milliSecondsInt);
  var hours   = dateObj.getUTCHours().toString().padStart(2, '0');
  var minutes = dateObj.getUTCMinutes().toString().padStart(2, '0');
  var seconds = dateObj.getSeconds().toString().padStart(2, '0');
  return hours+':'+minutes+':'+seconds;
}

// start geolocation
const geolocation = new Geolocation({
  projection: view.getProjection(),
  trackingOptions: {
    maximumAge: 10000,
    enableHighAccuracy: true,
    timeout: 600000,
  },
});
geolocation.setTracking(true); // Start position tracking

// runs when position changes
let prevCoordinate = geolocation.getPosition();
let lastFix = new Date();
geolocation.on('change', function () {
  const position = geolocation.getPosition();
  const accuracy = geolocation.getAccuracy();
  const heading = geolocation.getHeading() || 0;
  const speed = geolocation.getSpeed() * 3.6 || 0;
  const altitude = geolocation.getAltitude() || 0;
  const lonlat = toLonLat(position);
  const currentTime = new Date();
  marker.setPosition(position); // move marker to current location
  
  const centerPixel = map.getPixelFromCoordinate(position);
  const featureAtPixel = map.getFeaturesAtPixel(centerPixel);
  for (var i = 0; i < featureAtPixel.length; i++) {
    if (featureAtPixel[i].get('layer') == 'roads') {
      const maxSpeed = (featureAtPixel[i].get('maxspeed') || '0');
      paintSign(maxSpeed);
      const streetName = (featureAtPixel[i].get('name') || '');
      document.getElementById('info3').innerHTML = streetName;
    }
  }

  if (speed > 3.6) {
    // change view if no interaction occurred last 5 seconds
    if (currentTime - lastInteraction > 5000) {
      updateView(position, heading);
    }
    // measure distance
    if (prevCoordinate !== undefined) {
      distanceTraveled += getDistance(prevCoordinate, lonlat);
    }
    prevCoordinate = lonlat;
    // tracklogger
    if (currentTime - lastFix > 5000) {
      lastFix = currentTime;
      trackLog.push([lonlat[0].toFixed(6), lonlat[1].toFixed(6), altitude.toFixed(2), currentTime]);
      line.appendCoordinate(position);
    }
  } else if (currentTime - lastFix > 5000 && lastFix > startTime) {
    lastFix = 0;
    trackLog.push([lonlat[0].toFixed(6), lonlat[1].toFixed(6), altitude.toFixed(2), currentTime]);
    line.appendCoordinate(position);
  }

  if (speed > maxSpeed) {
    maxSpeed = Math.floor(speed);
  }

  // send text to info box
  const html = [
    lonlat[1].toFixed(5) + ', ' + lonlat[0].toFixed(5),
    (distanceTraveled / 1000).toFixed(2) + ' km / ' + Math.round(accuracy) + ' m',
    '<b style="font-size:120%">' + speed.toFixed(1) + '</b> (<font style="color:#e60000;">' + maxSpeed + '</font>) km/h'
  ].join('<br />');
  document.getElementById('info').innerHTML = html;
});

// alert user if geolocation fails
geolocation.on('error', function () {
  setExtraInfo(["&#128543 Aktivera platsjänster för <br>att se din position på kartan!"]);
});

// Geolocation marker
const markerEl = document.getElementById('geolocation_marker');
markerEl.style.display = "unset";
const marker = new Overlay({
  positioning: 'center-center',
  element: markerEl,
  stopEvent: false,
});
map.addOverlay(marker);

// recenters the view by putting the given coordinates at 3/4 from the top of the screen
function getCenterWithHeading(position, rotation) {
  const resolution = view.getResolution()
  const size = map.getSize();
  const height = size[1];
  
  return [
    position[0] - (Math.sin(rotation) * height * resolution * 1) / 4,
    position[1] + (Math.cos(rotation) * height * resolution * 1) / 4,
  ];
}

// center map function
function centerFunction() {
  const position = geolocation.getPosition() || center;
  const heading = geolocation.getHeading() || 0;
  const speed = geolocation.getSpeed() || 0;
  const duration = 500;
  if (speed > 1){
    view.setZoom(defaultZoom);
    if (new Date() - lastInteraction < 5000) {
      view.setRotation(0);
      lastInteraction = new Date();
    } else {
      updateView(position, heading);
    }
  } else {
    view.animate({
      center: position,
      duration: duration
    });
    view.animate({
      zoom: defaultZoom,
      duration: duration
    });
    view.animate({
      rotation: 0,
      duration: duration
    });
  }
  acquireWakeLock();
}

function updateView(position, heading) {
  view.setCenter(getCenterWithHeading(position, -heading));
  view.setRotation(-heading);
  map.render(); 
}

// run once when first position is recieved
geolocation.once('change', function() {
  centerFunction();
});

// switch map logic
var mapMode = 0; // default map

function switchMap() {
  // slitlagerkarta_nedtonad.setVisible(false);
  slitlagerkarta.setVisible(false);
  ortofoto.setVisible(false);
  topoweb.setVisible(false);
  mapDiv.setAttribute(            "style", "-webkit-filter: initial;filter: initial;background-color: initial;");

  if (mapMode == 0) { // mapMode 0: slitlagerkarta
    vagKarta = false;
    map.render();
    slitlagerkarta.setVisible(true);
  }

  else if (mapMode == 1) { // mapMode 1: slitlagerkarta_nedtonad
    vagKarta = true;
    slitlagerkarta.setVisible(true);
    map.render();
  }
  
  else if (mapMode == 2) { // mapMode 2: slitlagerkarta_nedtonad + night mode
    vagKarta = true;
    slitlagerkarta.setVisible(true);
    mapDiv.setAttribute(            "style", "filter: invert(1) hue-rotate(180deg);");
  }
  
  else if (enableLnt && mapMode == 3) { // mapMode 3: ortofoto
    ortofoto.setVisible(true);
  } 
  
  else if (enableLnt && mapMode == 4) { // mapMode 4: topoweb
    topoweb.setVisible(true);
  }

  mapMode++;

  if (enableLnt && mapMode > 4) {
    mapMode = 0;
  } else if (!enableLnt && mapMode > 2) {
    mapMode = 0;
  }
  infoGroup.style.fontSize = preferredFontSize;
};

// logic for saveLogButton
function saveLogButtonFunction() {
  if (trackLog.length > 5) {
    saveLog();
  } else {
    setExtraInfo([
      "zoomLevel = " + view.getZoom().toFixed(2),
      "Spår för kort!"
    ]);
  }
}

// new saveLog function
function saveLog() {
  let gpxFile = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<gpx version="1.1" creator="jole84 webapp">
<metadata>
  <desc>GPX log created by jole84 webapp</desc>
  <time>${startTime.toISOString()}</time>
</metadata>
<trk>
<name>${startTime.toLocaleString()}, max ${maxSpeed.toFixed(1)} km/h, total ${(distanceTraveled / 1000).toFixed(2)} km, ${toHHMMSS(new Date() - startTime)}</name>
<trkseg>`;

  for (let i = 0; i < trackLog.length; i++){
    const lon = trackLog[i][0];
    const lat = trackLog[i][1];
    const ele = trackLog[i][2];
    const isoTime = trackLog[i][3].toISOString();
    const trkpt = `
  <trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele><time>${isoTime}</time></trkpt>`;
    gpxFile += trkpt;
  }

  gpxFile += `
</trkseg>
</trk>
</gpx>`;

  const filename = startTime.toLocaleString().replace(/ /g, '_').replace(/:/g, '.') + '.gpx';
  setExtraInfo(["Sparar fil:", filename]);
  download(gpxFile, filename);
}

var timeOut; // create timeout variable so it can be cleared
function setExtraInfo(infoText) {
  window.clearTimeout(timeOut);
  var extraInfo = infoText.join('<br />');
  document.getElementById('info2').innerHTML = extraInfo;
  timeOut = setTimeout(function() {
    document.getElementById('info2').innerHTML = "";
  }, 30000);
};

// Function to download data to a file
function download(data, filename) {
  var file = new Blob([data], {type: 'application/gpx+xml'});
  if (window.navigator.msSaveOrOpenBlob) {// IE10+
      window.navigator.msSaveOrOpenBlob(file, filename);
    }
  else { // Others
      var a = document.createElement("a"),
              url = URL.createObjectURL(file);
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);  
      }, 0); 
  }
}

// brouter routing
function routeMe(destinationCoordinates) {
  const endMarker = new Feature({
    type: 'icon',
    geometry: new Point(fromLonLat(destinationCoordinates[destinationCoordinates.length - 1]))
  });
  routeLayer.getSource().addFeature(endMarker);

  fetch('https://brouter.de/brouter' +
  // fetch('https://jole84.se:17777/brouter' +
  '?lonlats=' + destinationCoordinates.join('|') +
  '&profile=car-fast&alternativeidx=0&format=geojson'
  ).then(function (response) {
    response.json().then(function (result) {
      const route = new GeoJSON().readFeature((result).features[0], {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      }).getGeometry();

      const trackLength = result.features[0].properties['track-length'] / 1000; // track-length in km
      const totalTime = result.features[0].properties['total-time'] * 1000; // track-time in milliseconds

      // add route information to info box
      setExtraInfo([
        "Avstånd: " + trackLength.toFixed(2) + " km", 
        "Restid: " + toHHMMSS(totalTime),
        "Ankomsttid: " + new Date(new Date().valueOf() + totalTime).toString().slice(16,25),
        `<a href="http://maps.google.com/maps?q=${destinationCoordinates[destinationCoordinates.length - 1][1]},${destinationCoordinates[destinationCoordinates.length - 1][0]}" target="_blank">Gmap</a>`,
        `<a href="http://maps.google.com/maps?layer=c&cbll=${destinationCoordinates[destinationCoordinates.length - 1][1]},${destinationCoordinates[destinationCoordinates.length - 1][0]}" target="_blank">Streetview</a>`
      ]);

      const routeFeature = new Feature({
        type: 'route',
        geometry: route,
      });

      const endMarker = new Feature({
        type: 'icon',
        geometry: new Point(route.getLastCoordinate().splice(0,2)),
      });

      // remove previus route
      clearLayer(routeLayer);

      // finally add route to map
      routeLayer.getSource().addFeatures([routeFeature, endMarker]);
    });
  });
}

var destinationCoordinates = [];
// right click/long press to route
// map.on('contextmenu', function(event) {  
//   var currentPostition = toLonLat(geolocation.getPosition());
//   console.log(toLonLat(event.coordinate)[1]);
//   console.log(toLonLat(event.coordinate)[0]);
//   console.log(Math.round(getDistance(currentPostition, toLonLat(event.coordinate))) + " m");

//   if (destinationCoordinates.length == 0) { // set start position
//     destinationCoordinates.push(currentPostition);
//   }

//   // remove last coord if < 0.2 km if click on last coord
//   if (destinationCoordinates.length > 2 && getDistance(toLonLat(event.coordinate), destinationCoordinates[destinationCoordinates.length - 1]) < 200) {
//     destinationCoordinates.pop();
//   } 
//   // clear route if click < 0.2 km if coord is last
//   else if (destinationCoordinates.length == 2 && getDistance(toLonLat(event.coordinate), destinationCoordinates[destinationCoordinates.length - 1]) < 200) {
//     clearLayer(routeLayer);
//     setExtraInfo([""]);
//     destinationCoordinates = [];
//   } 
//   else { // else push clicked coord do route
//     destinationCoordinates.push(toLonLat(event.coordinate));
//   }

//   lastInteraction = new Date();
//   // if click less than 0.2km from current position clear route else start route
//   if (getDistance(currentPostition, toLonLat(event.coordinate)) < 200) {
//     clearLayer(routeLayer);
//     setExtraInfo([Math.round(getDistance(currentPostition, toLonLat(event.coordinate))) + " m"]);
//     destinationCoordinates = [];
//   }else if (destinationCoordinates.length >= 2){
//     routeMe(destinationCoordinates);
//   }
// });

map.on('contextmenu', function(event) {
  const featureAtPixel = map.getFeaturesAtPixel(event.pixel);
  for (var i = 0; i < featureAtPixel.length; i++) {
    if (featureAtPixel[i].get('layer') == 'roads') {
      const maxSpeed = (featureAtPixel[i].get('maxspeed') || '?');
      paintSign(maxSpeed);
      document.getElementById('info3').innerHTML = (featureAtPixel[i].get('name') || '');
      break;
    }
  }
})

// store time of last interaction
map.on('pointerdrag', function() {
  lastInteraction = new Date();
});

// checks url parameters and loads gpx file from url:
var urlParams = window.location.href.split('?').pop().split('&');
var enableLnt = urlParams.includes('Lnt');
for (var i = 0; i < urlParams.length; i++){
  console.log(decodeURIComponent(urlParams[i]));
  if (urlParams[i].includes(".gpx")) {
    if (!urlParams[i].includes("http")){
      urlParams[i] = "https://jole84.se/rutter/" + urlParams[i];
    };
    var titleString = decodeURIComponent(urlParams[i].split('/').pop());
    document.title = documentTitle + " - " + titleString;
    setExtraInfo([titleString]);
    fetch(urlParams[i])
    .then((response) => {
      console.log(response);
      return response.text();
    }).then((response) => {
      var gpxFeatures = new GPX().readFeatures(response, {
        dataProjection:'EPSG:4326',
        featureProjection: 'EPSG:3857'
      });
      gpxLayer.getSource().addFeatures(gpxFeatures);
    });
  } else if (urlParams[i].includes("switchMap")) {
    mapMode++;
  } else if (urlParams[i].includes("zoom=")) {
    defaultZoom = urlParams[i].split('=').pop();
  } else if(urlParams[i].includes("mapMode=")) {
    mapMode = urlParams[i].split('=').pop();
  } else if (urlParams[i].includes("info=")) {
    preferredFontSize = urlParams[i].split('=').pop();
  } else if (urlParams[i].includes("onunload")) {
    window.onunload = window.onbeforeunload = function() {
      return "";
    };
  }
};
switchMap();

// add keyboard controls
document.addEventListener('keydown', function(event) {
  const zoomStep = 0.5;
  if (event.key != 'a' && event.key != 'Escape') { // store time of last interaction
    lastInteraction = new Date();
  }
  if (event.key == 'c') {
    centerFunction();
  }
  if (event.key == 'v') {
    switchMap();
  }
  if (event.key == 'z') {
    view.adjustRotation(0.2);
  }
  if (event.key == 'x') {
    view.adjustRotation(-0.2);
  }
  if (event.key == 's') {
    saveLogButtonFunction();
  }
  if (event.key == 'Escape') { // carpe iter adventure controller minus button
    view.adjustZoom(-zoomStep);
  }
  if (event.key == 'a') { // carpe iter adventure controller plus button
    view.adjustZoom(zoomStep);
  }
});

var apiUrl = "https://api.trafikinfo.trafikverket.se/v2/";
var styleFunction = function (feature) {    //Function to determine style of icons
  return [new Style({
    image: new Icon(({
      anchor: [0.5, 0.5],
      src: apiUrl + "icons/" + feature.get("iconId") + "?type=png32x32" 
    })),
    text: new Text({
      text: feature.get('name'),
      font: 'bold 14px Droid Sans Mono,monospace',
      textAlign: 'left',
      textBaseline: 'top',
      offsetX: 20,
      fill: new Fill({
        color: '#b41412',
      }),
      stroke: new Stroke({
        color: 'yellow',
        width: 4,
      }),
    }),
  })];
};

function breakSentence(sentence) {
  var returnSentence = "";
  var x = 0;
  for (var i = 0; i < sentence.length; i++) {
    if (x > 20 && sentence[i] == ' ') {
      x = 0;
      returnSentence += '\n';
    }
    else {
      returnSentence += sentence[i];
    }
    x++;
  }
  return returnSentence;
} 

$.ajaxSetup({
    url: apiUrl + "data.json",
  error: function (msg) {
    if (msg.statusText == "abort") return;
  }
});

$.support.cors = true; // Enable Cross domain requests
var trafikLayer = new VectorLayer({     //Creates a layer for deviations
  source: new VectorSource(),
  declutter: true,
  style: styleFunction,
});
map.addLayer(trafikLayer);

function getDeviations() {
  clearLayer(trafikLayer);

  var xmlRequest = "<REQUEST>" +
    // Use your valid authenticationkey
    "<LOGIN authenticationkey='fa68891ca1284d38a637fe8d100861f0' />" +
      "<QUERY objecttype='Situation' schemaversion='1.2'>" +
        "<FILTER>" +
          "<OR>" +
            "<ELEMENTMATCH>" +
              // "<WITHIN name='Deviation.Geometry.WGS84' shape='center' value='" + toLonLat(geolocation.getPosition()).join(' ') + "' radius='1' />" + 
              "<EQ name='Deviation.ManagedCause' value='true' />" +
              "<EQ name='Deviation.MessageType' value='Olycka' />" +
            "</ELEMENTMATCH>" +
            "<ELEMENTMATCH>" +
              "<GTE name='Deviation.SeverityCode' value='5' />" +
            "</ELEMENTMATCH>" +
            "<ELEMENTMATCH>" +
              "<EQ name='Deviation.IconId' value='roadClosed' />" +
            "</ELEMENTMATCH>" +
          "</OR>" +
        "</FILTER>" +
          "<INCLUDE>Deviation.Message</INCLUDE>" +
          "<INCLUDE>Deviation.IconId</INCLUDE>" +
          "<INCLUDE>Deviation.Geometry.WGS84</INCLUDE>" +
          "<INCLUDE>Deviation.RoadNumber</INCLUDE>" +
          "</QUERY>" +
          "</REQUEST>";
          
  $.ajax({
    type: "POST",
    contentType: "text/xml",
    dataType: "json",
    data: xmlRequest,
    success: function (response) {
      if (response == null) return;
      try {
        $.each(response.RESPONSE.RESULT[0].Situation, function (index, item) {
          var format = new WKT();
          var feature = new Feature({
            geometry: format.readGeometry(item.Deviation[0].Geometry.WGS84).transform("EPSG:4326", "EPSG:3857"),
              name: breakSentence((item.Deviation[0].RoadNumber || 'Väg')+ ": " + (item.Deviation[0].Message)),
              iconId: item.Deviation[0].IconId
          });
          trafikLayer.getSource().addFeature(feature);
        });
      }
      catch (ex) { }
    },
    error: function (xhr, status, error) {
      var err = status;
    },
    complete: function (xhr, status) {
      var status = status;
    }
  });
}

getDeviations();

setInterval(getDeviations, 60000);


var c = document.getElementById('canvas1');
var ctx = c.getContext("2d");
function paintSign(speed) {
  var canvasHeight = c.height;
  ctx.beginPath();
  ctx.arc(c.height / 2, c.height / 2, c.height / 2, 0, 2 * Math.PI);
  ctx.strokeStyle = '#e73137';
  ctx.stroke();
  ctx.fillStyle = '#e73137';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c.height / 2, c.height / 2, c.height / 2 * 0.8, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = "#ffd300";
  ctx.fill();
  ctx.font = "bold 60px arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "black";
  ctx.fillText(speed, c.height / 2, c.height / 2 + 4);
}