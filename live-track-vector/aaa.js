import './style.css';
import MVT from 'ol/format/MVT.js';
import Map from 'ol/Map.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import TileLayer from 'ol/layer/Tile.js';
import View from 'ol/View.js';
import {Fill, Icon, Stroke, Style, Text, Circle, RegularShape} from 'ol/style.js';
import {fromLonLat, toLonLat} from 'ol/proj.js';
import XYZ from 'ol/source/XYZ.js';

var vagKarta = false;
document.getElementById("vehicle1").addEventListener('change', function(event) {
  vagKarta = document.getElementById("vehicle1").checked;
  map.render()
});

var center = fromLonLat([14.18, 57.786]);

function getRotation(feature, vinkel) {
  return feature.get(vinkel) * (Math.PI / 180)
}

var styleFunction = function (feature) {    //Function to determine style of icons
  // ATK
  if (feature.get('layer') == 'ATK') {
    return [new Style({
      zIndex: 10,
      text: new Text({
        text: (feature.get('HTHAST')).toString(),
        font: 'bold 16px sans-serif',
        rotation: getRotation(feature, 'vinkel'),
        rotateWithView: true,
        fill: new Fill({
          color: 'black',
        }),
      }),
      image: new Circle({
        radius: 14,
        fill: new Fill({
          color: '#ffd300'
        }),
        stroke: new Stroke({
          width: 4,
          color: '#e73137'
        }),
      }),
      // image: new Icon(({
      //   rotateWithView: true,
      //   anchor: [1, 1],
      //   rotation: getRotation(feature, 'vinkel'),
      //   src: 'https://www.trafikverket.se/Static/dist/images/trafficinfo/trafficEnforcementCamera.svg'
      // })),
    })];
  }

  // mark
  // else if (feature.get('layer') == 'mark') {
  //   if (feature.get('natural') == 'water') {
  //     return [new Style({
  //       fill: new Fill({
  //         color: '#bfe6ff',
  //       }),
  //     })];
  //   }
  //   else if(feature.get('landuse') == 'residential') {
  //     return [new Style({
  //       fill: new Fill({
  //         color: '#e6b28c',
  //       }),
  //     })];
  //   }
  //   else if(feature.get('landuse') == 'forest') {
  //     return [new Style({
  //       fill: new Fill({
  //         color: '#d4eeb7',
  //       })
  //     })];
  //   }
  //   else if(feature.get('landuse') == 'farmland') {
  //     return [new Style({
  //       fill: new Fill({
  //         color: '#fff7a6',
  //       })
  //     })];
  //   }
  //   else if(feature.get('landuse') == 'meadow') {
  //     return [new Style({
  //       fill: new Fill({
  //         color: '#ffffea',
  //       })
  //     })];
  //   }
  //   else if(feature.get('landuse') == 'industrial') {
  //     return [new Style({
  //       fill: new Fill({
  //         color: '#f0f0f0',
  //       })
  //     })];
  //   }
  // }

  
  // roads
  else if (feature.get('layer') == 'roads'){
    if (feature.get('highway') == 'primary') { // asfaltsväg
      // stratväg
      if (feature.get('stratvag') != undefined && vagKarta) {
        return [new Style({
          zIndex: 10,
          stroke: new Stroke({
            color: 'green',
            width: feature.get('maxspeed') / (view.getResolution() + 10),
          }),
        })];    
      }

      // normväg
      else {
        return [new Style({
          zIndex: 10,
          stroke: new Stroke({
            color: 'black',
            width: feature.get('maxspeed') / (view.getResolution() + 10),
          }),
          text: new Text({
            text: feature.get('name'),
            font: '12px sans-serif',
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
    }

    // underhåll
    if (feature.get('underh') != undefined) {
      return [
        new Style({
          zIndex: 10,
          stroke: new Stroke({
          color: '#ac7c45',
          width: feature.get('width') || 30 / view.getResolution(),
        }),
      }),
      new Style({
        zIndex: 10,
        stroke: new Stroke({
          color: 'black',
          width: feature.get('width') || 30 / view.getResolution(),
          lineDash: [8, 16],
        }),
      })
    ];
    }
    // grusväg
    if (feature.get('highway') == 'unclassified') {
      return [new Style({
        zIndex: 9,
        stroke: new Stroke({
          color: '#ac7c45',
          width: feature.get('width') || 30 / view.getResolution(),
        }),
      })]; 
    }

    // traktorväg
    if (feature.get('highway') == 'track') {
      return [new Style({
        zIndex: 9,
        stroke: new Stroke({
          color: '#ac7c45',
          width: feature.get('width') || 30 / view.getResolution(),
          lineDash: [8, 16]
        }),
      })];
    }
  }

  // vaglinje
  // else if (feature.get('layer') == 'ovrig_vag') {
  //   return [new Style({
  //     zIndex: 8,
  //     stroke: new Stroke({
  //       color: 'green',
  //       width: 5,
  //     }),
  //   })];
  // }

  // byggnad
  // else if (feature.get('layer') == 'byggnad') {
  //   return [new Style({
  //     zIndex: 10,
  //     fill: new Fill({
  //       color: 'black',
  //     })
  //   })];
  // }

  // hydrolinje
  // else if (feature.get('layer') == 'hydrolinje') {
  //   return [new Style({
  //     zIndex: 8,
  //     stroke: new Stroke({
  //       color: '#bfe6ff',
  //       width: feature.get('storleksklass') * 2,
  //     }),
  //   })];
  // }

  // else if (feature.get('layer') == 'byggnadspunkt') {
  //   return [new Style({
  //     image: new RegularShape({
  //       fill: new Fill({
  //         color: 'black',
  //       }),
  //       // radius: 5,
  //       // radius: 20 / view.getResolution(),
  //       radius: 4,
  //       points: 4,
  //       rotation: getRotation(feature, 'rotation'),
  //       rotateWithView: true,
  //     }),
  //   })];
  // }

  // textpunkt
  // else if (feature.get('layer') == 'textpunkt'){
  //   return [new Style({
  //     zIndex: 20,
  //     text: new Text({
  //       // text: feature.get('name') + " " + feature.get('textstorleksklass'),
  //       text: feature.get('name'),
  //       font: textStorlek[feature.get('textstorleksklass')] + 'px Calibri,sans-serif',
  //       textBaseline: textBaseLine[feature.get('textlage')],
  //       justify: textJustify[feature.get('textlage')],
  //       placement: 'line',
  //       fill: new Fill({
  //         color: 'black',
  //       }),
  //       stroke: new Stroke({
  //         color: 'white',
  //         width: 3,
  //       }),
  //     }),
  //   })];    
  // }

};

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

const vectorsource = new VectorTileSource({
    format: new MVT(),
    url: 'combined/{z}/{x}/{y}.pbf',
    // minZoom: 0,
    maxZoom: 12,
    useSpatialIndex: true
  });

const vectortiles = new VectorTileLayer({
  // declutter: true,
  minZoom: 11,
  // layers: ['select'],
  source: vectorsource,
  style: styleFunction
})

var slitlagerkarta = new TileLayer({
  source: new XYZ({
    url: 'https://jole84.se/hybrid/{z}/{x}/{y}.jpg',
      minZoom: 6,
      maxZoom: 14,
  }),
  visible: true
});

const view = new View({
  center: center,
  zoom: 12,
  maxZoom: 20,
})

const map = new Map({
  target: 'map',
  layers: [
    // osmLayer,
    slitlagerkarta,
    vectortiles,
  ],
  view: view,
  keyboardEventTarget: document,
});


view.on('change:resolution', function() {
  // console.log(view.getZoom().toFixed(2))
  // console.log(view.getResolution())
  document.getElementById('info').innerHTML = view.getZoom().toFixed(2);
})

document.addEventListener('keydown', function(event) {
  if (event.key == 'z') {
    view.adjustRotation(0.2);
  }
  if (event.key == 'x') {
    view.adjustRotation(-0.2);
  }
});

map.on('click', function(event) {
  const featureAtPixel = map.getFeaturesAtPixel(event.pixel);
  for (var i = 0; i < featureAtPixel.length; i++) {
    if (featureAtPixel[i].get('layer') == 'roads') {
      const maxSpeed = featureAtPixel[i].get('maxspeed');
      document.getElementById('info').innerHTML = maxSpeed + "km/h " + (featureAtPixel[i].get('name') || '');
    }
  }
})