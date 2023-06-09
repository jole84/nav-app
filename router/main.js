import './style.css';
import {Feature, Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ.js';
import {fromLonLat, toLonLat} from 'ol/proj.js';
import VectorSource from 'ol/source/Vector.js';
import {Stroke, Style, Icon, Fill, Text, Circle} from 'ol/style.js';
import {Vector as VectorLayer} from 'ol/layer.js';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point.js';
import Overlay from 'ol/Overlay.js';
import {Modify} from 'ol/interaction.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import KeyboardPan from 'ol/interaction/KeyboardPan.js';
import {getDistance} from 'ol/sphere';
import GPX from 'ol/format/GPX.js';
import {toStringXY} from 'ol/coordinate';

var removePositionButton = document.getElementById("removePositionButton");
var addPositionButton = document.getElementById("addPositionButton");
var saveRouteButton = document.getElementById("saveRouteButton");
var switchMapButton = document.getElementById("switchMapButton");
var savePoiButton = document.getElementById("savePoiButton");
var savePoiNameButton = document.getElementById("savePoiNameButton");
var showGPXdiv = document.getElementById("showGPXdiv");
var infoDiv = document.getElementById("info");
var info2Div = document.getElementById("info2");
var info3Div = document.getElementById("info3");
var fileNameInput = document.getElementById("fileNameInput");
var gpxFormat = new GPX();
var gpxFeatures;
var trackLength;
const popupContainer = document.getElementById('popup');
// const popupContent = document.getElementById('popup-content');
const popupCloser = document.getElementById('popup-closer');

saveRouteButton.onclick = route2gpx;
switchMapButton.onclick = switchMap;
customFileButton.addEventListener('change', handleFileSelect, false);
document.getElementById("showGPX").addEventListener('change', function() {
  gpxLayer.setVisible(showGPX.checked);
});
savePoiButton.onclick = savePoiPopup;
removePositionButton.onclick = removeLastMapCenter;
addPositionButton.onclick = addPositionMapCenter;

var poiCoordinate;

const overlay = new Overlay({
  element: popupContainer,
  autoPan: {
    animation: {
      duration: 250,
    },
  },
});

popupCloser.onclick = function () {
  overlay.setPosition(undefined);
  popupCloser.blur();
  return false;
};

var poiList = [];

savePoiNameButton.onclick = function() {
  const coordinate = toLonLat(poiCoordinate);
  var fileName = fileNameInput.value;
  poiList.push([coordinate, fileName]);
  overlay.setPosition(undefined);
  popupCloser.blur();

  const poiMarker = new Feature({
    name: fileNameInput.value,
    geometry: new Point(poiCoordinate)
  });
  poiLayer.getSource().addFeature(poiMarker);
  return false;
};

var slitlagerkarta = new TileLayer({
  source: new XYZ({
    url: 'https://jole84.se/slitlagerkarta/{z}/{x}/{y}.jpg',
      minZoom: 6,
      maxZoom: 14,
  }),
  visible: true
});

var slitlagerkarta_nedtonad = new TileLayer({
  source: new XYZ({
    url: 'https://jole84.se/slitlagerkarta_nedtonad/{z}/{x}/{y}.jpg',
      minZoom: 6,
      maxZoom: 14,
  }),
  visible: false
});

var lineArray = [];
var line = new LineString([]);
var trackLine = new Feature({
  geometry: line,
})

line.on('change', function() {
  lineArray = line.getCoordinates();
})

const trackStyle = {
  'Point': new Style({
    image: new Circle({
      fill: new Fill({
        color: 'rgba(0,0,255,0.4)',
      }),
      radius: 10,
      stroke: new Stroke({
        color: 'blue',
        width: 2,
      }),
    }),
  }),
  'LineString': new Style({
    stroke: new Stroke({
      color: [255, 0, 0, 0.6],
      lineDash: [20],
      width: 6,
    }),
  }),
  'route': new Style({
    stroke: new Stroke({
      width: 10,
      color: [255, 0, 255, 0.6],
    }),
  }),
  'endPoint': new Style({
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
  'startPoint': new Style({
    image: new Circle({
      fill: new Fill({
        color: 'rgba(0,255,0,0.5)',
      }),
      radius: 10,
      stroke: new Stroke({
        color: 'rgb(0,255,0)',
        width: 2,
      }),
    }),
  }),
};
trackStyle['MultiLineString'] = trackStyle['LineString'];

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
      color: [0, 0, 255, 0.4],
      width: 10,
    }),
  })
};
gpxStyle['MultiLineString'] = gpxStyle['LineString'];

var routeLayer = new VectorLayer({
  source: new VectorSource(),
  style: function (feature) {
    return trackStyle[feature.get('type')];
  },
});

var vectorLayer = new VectorLayer({
  source: new VectorSource({
    features: [trackLine],
  }),
  style: function (feature) {
    return trackStyle[feature.getGeometry().getType()];
  },
});

var poiLayer = new VectorLayer({
  source: new VectorSource(),
  style: function(feature) {
    return new Style({
      image: new Icon({
        anchor: [0.5, 1],
        src: 'https://jole84.se/default-marker.png',
      }),
      text: new Text({
        text: feature.get('name'),
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
    })
  }
  
});

var gpxLayer = new VectorLayer({
  source: new VectorSource(),
  style: function (feature) {
    gpxStyle['Point'].getText().setText(feature.get('name'));
    return gpxStyle[feature.getGeometry().getType()];
  },
});

const view = new View({
  center: [1579748.5038203455, 7924318.181076467],
  zoom: 10,
  minZoom: 6,
  maxZoom: 20,
  enableRotation: false,
});

const map = new Map({
  target: 'map',
  layers: [
    slitlagerkarta,
    slitlagerkarta_nedtonad,
    gpxLayer,
    routeLayer,
    vectorLayer,
    poiLayer
  ],
  view: view,
  keyboardEventTarget: document,
  overlays: [overlay],
});

const keyboardPan = new KeyboardPan({pixelDelta: 64,})
map.addInteraction(keyboardPan);

const modify = new Modify({source: vectorLayer.getSource()});
map.addInteraction(modify);

modify.on('modifyend', function() {
  routeMe();
})

function savePoiPopup() { // save POI function
  poiCoordinate = map.getView().getCenter();
  fileNameInput.value = toStringXY(toLonLat(map.getView().getCenter()).reverse(), 5).replace(',', '');
  overlay.setPosition(poiCoordinate);
}

function isTouchDevice() {
  return (('ontouchstart' in window) ||
     (navigator.maxTouchPoints > 0) ||
     (navigator.msMaxTouchPoints > 0));
}

function addPositionMapCenter() {
  addPosition(map.getView().getCenter());
}

function removeLastMapCenter() {
  removePosition(map.getView().getCenter());
}

function addPosition(coordinate){
  const startMarker = new Feature({
    type: 'startPoint',
    geometry: new Point(coordinate)
  });
  routeLayer.getSource().addFeature(startMarker);
  line.appendCoordinate(coordinate);
  routeMe();
};

function removePosition(coordinate) {
  for (var i = 0; i < lineArray.length; i++) {
    if (getDistance(toLonLat(coordinate), toLonLat(lineArray[i])) < 300) {
      console.log(getDistance(toLonLat(coordinate), toLonLat(lineArray[i])))
      lineArray.splice(lineArray.indexOf(lineArray[i]), 1);
    }
  }
  if (lineArray.length <= 1) {
    clearLayer(routeLayer);
      lineArray = [];
      infoDiv.innerHTML = "";
      info2Div.innerHTML = "";
      info3Div.innerHTML = "";
  }
  line.setCoordinates(lineArray);
  routeMe();
};

map.on('singleclick', function(event){
  if (!isTouchDevice()) {
    addPosition(event.coordinate);
  }
});

map.on('contextmenu', function(event) {
  if (!isTouchDevice()) {
    removePosition(event.coordinate);
  }
  // console.log(line.getClosestPoint(event.coordinate))
  // console.log(line.forEachSegment(function(feature) {
  //   console.log(feature)
  // }))
})

function switchMap() {
  if (slitlagerkarta_nedtonad.getVisible()) {
    slitlagerkarta.setVisible(true);
    slitlagerkarta_nedtonad.setVisible(false);
  }
  else {
    slitlagerkarta.setVisible(false);
    slitlagerkarta_nedtonad.setVisible(true);
  }
}

function clearLayer(layerToClear) {
  layerToClear.getSource().getFeatures().forEach(function(feature) {
    layerToClear.getSource().removeFeature(feature);
  });
}

function routeMe() {
  if (lineArray.length >= 2) {
    var coordsString = [];
    for (var i = 0; i < lineArray.length; i++) {
      coordsString.push(toLonLat(lineArray[i]))
    }
    fetch('https://brouter.de/brouter' +
    // fetch('https://jole84.se:17777/brouter' +
    '?lonlats=' + coordsString.join('|') +
    '&profile=car-fast&alternativeidx=0&format=geojson'
    ).then(function (response) {
      response.json().then(function (result) {
        const route = new GeoJSON().readFeature((result).features[0], {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857'
        }).getGeometry();
        
        trackLength = result.features[0].properties['track-length'] / 1000; // track-length in km
        const totalTime = result.features[0].properties['total-time'] * 1000; // track-time in milliseconds
        
        // add route information to info box
        infoDiv.innerHTML = "Avstånd: " + trackLength.toFixed(2) + " km";
        info2Div.innerHTML = "Restid: " + new Date(0 + totalTime).toUTCString().toString().slice(16,25);
        info3Div.innerHTML = "Ankomsttid: " + new Date(new Date().valueOf() + totalTime).toString().slice(16,25);

        const routeFeature = new Feature({
          type: 'route',
          geometry: route,
        });

        const startMarker = new Feature({
          type: 'startPoint',
          geometry: new Point(route.getFirstCoordinate().splice(0,2)),
        });
        
        const endMarker = new Feature({
          type: 'endPoint',
          geometry: new Point(route.getLastCoordinate().splice(0,2)),
        });

        // remove previus route
        clearLayer(routeLayer);
        
        // finally add route to map
        routeLayer.getSource().addFeatures([routeFeature, startMarker, endMarker]);
        // add markers at waypoints
        for (var i = 1; i < lineArray.length - 1; i++) {
          const marker = new Feature({
            type: 'endPoint',
            geometry: new Point(lineArray[i])
          });
          routeLayer.getSource().addFeature(marker);
        }
      });
    });
  }
}

function route2gpx() {
  var poiString = [];
  for (var i = 0; i < poiList.length; i++) {
    poiString.push((poiList[i][0]) + "," + poiList[i][1]);
  }

  var coordsString = [];
  for (var i = 0; i < lineArray.length; i++) {
    coordsString.push(toLonLat(lineArray[i]));
  }

  var brouterUrl = 'https://brouter.de/brouter?lonlats=' + coordsString.join('|') + 
    '&profile=car-fast&alternativeidx=0&format=gpx&trackname=' + 
    new Date().toLocaleDateString() + '__' + trackLength.toFixed(2) + 'km';

  if (poiList.length >= 1) {
    brouterUrl += '&pois=' + poiString.join('|');
  }

  if (lineArray.length >= 2) {
    window.location = brouterUrl;
  }
}

// gpx loader
function handleFileSelect(evt) {
  showGPXdiv.style.display = "inline-block";
  var files = evt.target.files; // FileList object
  // remove previously loaded gpx files
  clearLayer(gpxLayer);
  for (var i = 0; i < files.length; i++) {
    var reader = new FileReader();
    reader.readAsText(files[i], "UTF-8");
    reader.onload = function (evt) {
      gpxFeatures = gpxFormat.readFeatures(evt.target.result,{
        dataProjection:'EPSG:4326',
        featureProjection:'EPSG:3857'
      });
      gpxLayer.getSource().addFeatures(gpxFeatures);
    }
  }
}
// document.addEventListener('keydown', function(event) {
//   if (event.key == 'Escape') { // carpe iter adventure controller minus button
//     removeLastMapCenter();
//   }
//   if (event.key == 'a') { // carpe iter adventure controller plus button
//     addPositionMapCenter();
//   }
// });