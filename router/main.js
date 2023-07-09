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
import {Draw, Modify, Snap} from 'ol/interaction.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import KeyboardPan from 'ol/interaction/KeyboardPan.js';
import {getDistance} from 'ol/sphere';

var removeLastButton = document.getElementById("removeLastButton");
var addPositionButton = document.getElementById("addPositionButton");
var saveRouteButton = document.getElementById("saveRouteButton");
var switchMapButton = document.getElementById("switchMapButton");
var savePoiButton = document.getElementById("savePoiButton");
var savePoiNameButton = document.getElementById("savePoiNameButton");
var infoDiv = document.getElementById("info");
var info2Div = document.getElementById("info2");
var info3Div = document.getElementById("info3");
var fileNameInput = document.getElementById("fileNameInput");
const popupContainer = document.getElementById('popup');
// const popupContent = document.getElementById('popup-content');
const popupCloser = document.getElementById('popup-closer');

saveRouteButton.onclick = route2gpx;
switchMapButton.onclick = switchMap;
savePoiButton.onclick = savePoiPopup;
removeLastButton.onclick = removeLastMapCenter;
addPositionButton.onclick = addPositionMapCenter;



const overlay = new Overlay({
  element: popupContainer,
  autoPan: {
    animation: {
      duration: 250,
    },
  },
});

/**
 * Add a click handler to hide the popup.
 * @return {boolean} Don't follow the href.
 */
popupCloser.onclick = function () {
  overlay.setPosition(undefined);
  popupCloser.blur();
  return false;
};

var poiList = [];

savePoiNameButton.onclick = function() {
  const coordinate = toLonLat(map.getView().getCenter());
  var fileName = fileNameInput.value;
  poiList.push([coordinate, fileName]);
  overlay.setPosition(undefined);
  popupCloser.blur();

  const poiMarker = new Feature({
    name: fileNameInput.value,
    geometry: new Point(map.getView().getCenter())
  });
  poiLayer.getSource().addFeature(poiMarker);
  return false;
};

// save POI function
function savePoiPopup() {
  const coordinate = map.getView().getCenter();
  fileNameInput.value = new Date().toLocaleString();
  overlay.setPosition(coordinate);
}

function isTouchDevice() {
  return (('ontouchstart' in window) ||
     (navigator.maxTouchPoints > 0) ||
     (navigator.msMaxTouchPoints > 0));
}

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
    routeLayer,
    vectorLayer,
    poiLayer
  ],
  view: view,
  keyboardEventTarget: document,
  overlays: [overlay],
});

function addPositionMapCenter() {
  addPosition(map.getView().getCenter());
}

function removeLastMapCenter() {
  removeLast(map.getView().getCenter());
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

function removeLast(coordinate) {
  if (getDistance(toLonLat(coordinate), toLonLat(lineArray[0])) < 300 || lineArray.length <= 2) {
    clearLayer(routeLayer);
      lineArray = [];
      infoDiv.innerHTML = "";
      info2Div.innerHTML = "";
      info3Div.innerHTML = "";
  }
  for (var i = 0; i < lineArray.length; i++) {
    if (getDistance(toLonLat(coordinate), toLonLat(lineArray[i])) < 300) {
      console.log(getDistance(toLonLat(coordinate), toLonLat(lineArray[i])))
      lineArray.splice(lineArray.indexOf(lineArray[i]), 1);
    }
  }
  line.setCoordinates(lineArray);
  routeMe();
};

map.on('click', function(event){
  if (!isTouchDevice()) {
    addPosition(event.coordinate);
  }
});

map.on('contextmenu', function(event) {
  if (!isTouchDevice()) {
    removeLast(event.coordinate);
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

const modify = new Modify({source: vectorLayer.getSource()});
map.addInteraction(modify);

const keyboardPan = new KeyboardPan({pixelDelta: 32,})
map.addInteraction(keyboardPan);

modify.on('modifyend', function() {
  routeMe();
})

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
        
        const trackLength = result.features[0].properties['track-length'] / 1000; // track-length in km
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
        // routeLayer.getSource().addFeature(routeFeature);
        routeLayer.getSource().addFeatures([routeFeature, startMarker, endMarker]);
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
    console.log(poiList[i][0]);
    poiString.push((poiList[i][0]) + "," + poiList[i][1]);
  }

  var coordsString = [];
  for (var i = 0; i < lineArray.length; i++) {
    coordsString.push(toLonLat(lineArray[i]));
  }

  var brouterUrl = 'https://brouter.de/brouter?lonlats=' + coordsString.join('|') + 
    '&profile=car-fast&alternativeidx=0&format=gpx&trackname=Route_' + 
    new Date().toLocaleString().replace(/ /g, '_').replace(/:/g, '.');

  if (poiList.length >= 1) {
    brouterUrl += '&pois=' + poiString.join('|');
  }

  if (lineArray.length >= 2) {
    window.location = brouterUrl;
  }

  // if (lineArray.length >= 2 || poiList.length >= 1) {
  //   window.location = 
  //   'https://brouter.de/brouter?' +
  //   'lonlats=' + coordsString.join('|') +
  //   '&profile=car-fast&alternativeidx=0&format=gpx' +
  //   '&trackname=Route_' + new Date().toLocaleString().replace(/ /g, '_').replace(/:/g, '.') +
  //   '&pois=' + poiString.join('|');
  // }
}

// // add keyboard controls
// document.addEventListener('keydown', function(event) {
//   if (event.key == 'Escape') { // carpe iter adventure controller minus button
//     removeLastMapCenter();
//   }
//   if (event.key == 'a') { // carpe iter adventure controller plus button
//     addPositionMapCenter();
//   }
// });