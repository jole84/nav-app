import "./style.css";
import { Feature, Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ.js";
import { fromLonLat, toLonLat } from "ol/proj.js";
import VectorSource from "ol/source/Vector.js";
import { Stroke, Style, Icon, Fill, Text, Circle } from "ol/style.js";
import { Vector as VectorLayer } from "ol/layer.js";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point.js";
import Overlay from "ol/Overlay.js";
import { Modify } from "ol/interaction.js";
import GeoJSON from "ol/format/GeoJSON.js";
import KeyboardPan from "ol/interaction/KeyboardPan.js";
import { getDistance } from "ol/sphere";
import GPX from "ol/format/GPX.js";
import { toStringXY } from "ol/coordinate";
import TileWMS from "ol/source/TileWMS.js";

var removePositionButton = document.getElementById("removePositionButton");
var addPositionButton = document.getElementById("addPositionButton");
var saveRouteButton = document.getElementById("saveRouteButton");
var savePoiButton = document.getElementById("savePoiButton");
var switchMapButton = document.getElementById("switchMapButton");
var savePoiNameButton = document.getElementById("savePoiNameButton");
var showGPXdiv = document.getElementById("showGPXdiv");
var touchFriendlyCheck = document.getElementById("touchFriendlyCheck");
var infoDiv = document.getElementById("info");
var info2Div = document.getElementById("info2");
var info3Div = document.getElementById("info3");
var info4Div = document.getElementById("info4");
var fileNameInput = document.getElementById("fileNameInput");
var gpxFormat = new GPX();
var gpxFeatures;
var trackLength;
var poiCoordinate;
const popupContainer = document.getElementById("popup");
// const popupContent = document.getElementById('popup-content');
const popupCloser = document.getElementById("popup-closer");

switchMapButton.onclick = switchMap;
saveRouteButton.onclick = route2gpx;
customFileButton.addEventListener("change", handleFileSelect, false);
document.getElementById("showGPX").addEventListener("change", function () {
  gpxLayer.setVisible(showGPX.checked);
});
savePoiButton.onclick = savePoiPopup;
removePositionButton.onclick = removeLastMapCenter;
addPositionButton.onclick = addPositionMapCenter;

window.onunload = window.onbeforeunload = function () {
  return "";
};

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

savePoiNameButton.onclick = function () {
  const coordinate = toLonLat(poiCoordinate);
  var fileName = fileNameInput.value;
  poiList.push([coordinate, fileName]);
  overlay.setPosition(undefined);
  popupCloser.blur();
  drawPoiLayer();
  return false;
};

function drawPoiLayer() {
  for (var i = 0; i < poiList.length; i++) {
    const poiMarker = new Feature({
      routeFeature: true,
      name: poiList[i][1],
      geometry: new Point(fromLonLat(poiList[i][0])),
    });
    poiLayer.getSource().addFeature(poiMarker);
  }
}

var slitlagerkarta = new TileLayer({
  source: new XYZ({
    url: "https://jole84.se/slitlagerkarta/{z}/{x}/{y}.jpg",
    minZoom: 6,
    maxZoom: 14,
    zDirection: -1,
  }),
  maxZoom: 16,
});

var slitlagerkarta_nedtonad = new TileLayer({
  source: new XYZ({
    url: "https://jole84.se/slitlagerkarta_nedtonad/{z}/{x}/{y}.jpg",
    minZoom: 6,
    maxZoom: 14,
    zDirection: -1,
  }),
  maxZoom: 16,
  visible: false,
});

var ortofoto = new TileLayer({
  source: new TileWMS({
    url: "https://minkarta.lantmateriet.se/map/ortofoto/",
    params: {
      layers: "Ortofoto_0.5,Ortofoto_0.4,Ortofoto_0.25,Ortofoto_0.16",
      TILED: true,
    },
  }),
  minZoom: 16,
});

var lineArray = [];
var line = new LineString([]);
var trackLine = new Feature({
  routeFeature: true,
  geometry: line,
});

const trackStyle = {
  startPoint: new Style({
    image: new Icon({
      anchor: [0.5, 1],
      opacity: 0.85,
      src: "https://jole84.se/start-marker.svg",
    }),
  }),
  Point: new Style({
    image: new Icon({
      anchor: [0.5, 1],
      opacity: 0.85,
      src: "https://jole84.se/marker.svg",
    }),
  }),
  endPoint: new Style({
    image: new Icon({
      anchor: [0.5, 1],
      opacity: 0.85,
      src: "https://jole84.se/end-marker.svg",
    }),
  }),
  LineString: new Style({
    stroke: new Stroke({
      color: [255, 0, 0, 0.6],
      lineDash: [20],
      width: 6,
    }),
  }),
  route: new Style({
    stroke: new Stroke({
      width: 10,
      color: [255, 0, 255, 0.4],
    }),
  }),
};
trackStyle["MultiLineString"] = trackStyle["LineString"];

const gpxStyle = {
  Point: new Style({
    image: new Icon({
      anchor: [0.5, 1],
      opacity: 0.85,
      src: "https://jole84.se/poi-marker-blue.svg",
    }),
    text: new Text({
      font: "14px Roboto,monospace",
      textAlign: "left",
      offsetX: 10,
      fill: new Fill({
        color: "blue",
      }),
      stroke: new Stroke({
        color: "white",
        width: 4,
      }),
    }),
  }),
  LineString: new Style({
    stroke: new Stroke({
      color: [0, 0, 255, 0.4],
      width: 10,
    }),
  }),
};
gpxStyle["MultiLineString"] = gpxStyle["LineString"];

var routeLayer = new VectorLayer({
  source: new VectorSource(),
  style: function (feature) {
    return trackStyle[feature.get("type")];
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
  style: function (feature) {
    return new Style({
      image: new Icon({
        anchor: [0.5, 1],
        opacity: 0.85,
        src: "https://jole84.se/poi-marker.svg",
      }),
      text: new Text({
        text: feature.get("name"),
        font: "14px Roboto,monospace",
        textAlign: "left",
        offsetX: 10,
        fill: new Fill({
          color: "#b41412",
        }),
        stroke: new Stroke({
          color: "white",
          width: 4,
        }),
      }),
    });
  },
});

var gpxLayer = new VectorLayer({
  source: new VectorSource(),
  style: function (feature) {
    gpxStyle["Point"].getText().setText(feature.get("name"));
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
  target: "map",
  layers: [
    slitlagerkarta,
    slitlagerkarta_nedtonad,
    ortofoto,
    gpxLayer,
    routeLayer,
    vectorLayer,
    poiLayer,
  ],
  view: view,
  keyboardEventTarget: document,
  overlays: [overlay],
});

const keyboardPan = new KeyboardPan({ pixelDelta: 64 });
map.addInteraction(keyboardPan);

line.on("change", function () {
  lineArray = line.getCoordinates();

  if (lineArray.length == 1) {
    const startMarker = new Feature({
      name: 0,
      straight: false,
      type: "startPoint",
      geometry: new Point(lineArray[0]),
    });
    routeLayer.getSource().addFeature(startMarker);
  }
});

var lineArrayStraights = [];

function getStraightPoints() {
  lineArrayStraights = [];
  routeLayer.getSource().forEachFeature(function (feature) {
    if (feature.getGeometry().getType() == "Point") {
      lineArrayStraights[feature.get("name")] = feature.get("straight");
    }
  });
  var straightPoints = [];
  for (var i = 0; i < lineArrayStraights.length; i++) {
    if (lineArrayStraights[i]) {
      straightPoints.push(i);
    }
  }
  return straightPoints.join(",");
}

const modify = new Modify({ source: vectorLayer.getSource() });
const modifypoi = new Modify({ source: poiLayer.getSource() });

modify.on("modifyend", function () {
  routeMe();
});

function switchMap() {
  if (slitlagerkarta.getVisible()) {
    slitlagerkarta.setVisible(false);
    slitlagerkarta_nedtonad.setVisible(true);
  } else if (slitlagerkarta_nedtonad.getVisible()) {
    slitlagerkarta.setVisible(true);
    slitlagerkarta_nedtonad.setVisible(false);
  }
}

function savePoiPopup() {
  // save POI function
  poiCoordinate = map.getView().getCenter();
  fileNameInput.value = toStringXY(
    toLonLat(map.getView().getCenter()).reverse(),
    5,
  ).replace(",", "");
  overlay.setPosition(poiCoordinate);
}

// touch check
function isTouchDevice() {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  );
}

touchFriendlyCheck.addEventListener("change", function () {
  if (touchFriendlyCheck.checked) {
    map.removeInteraction(modify);
    map.removeInteraction(modifypoi);
  } else {
    map.addInteraction(modify);
    map.addInteraction(modifypoi);
  }
});
if (isTouchDevice()) {
  touchFriendlyCheck.checked = true;
} else {
  document.getElementById("touchFriendly").style.display = "none";
  map.addInteraction(modify);
  map.addInteraction(modifypoi);
}

function addPositionMapCenter() {
  addPosition(map.getView().getCenter());
}

function removeLastMapCenter() {
  removePosition(map.getView().getCenter());
}

function addPosition(coordinate) {
  line.appendCoordinate(coordinate);
  routeMe();
}

function removePosition(coordinate) {
  var removedOne = false;
  var removedPoi = false;

  // remove poi
  for (var i = 0; i < poiList.length; i++) {
    if (getDistance(toLonLat(coordinate), poiList[i][0]) < 300) {
      poiList.splice(poiList.indexOf(poiList[i]), 1);
      removedPoi = true;
      clearLayer(poiLayer);
      break;
    }
  }

  // redraw poi layer
  if (removedPoi) {
    drawPoiLayer();
  }

  // removes wp if less than 300 m
  for (var i = 0; i < lineArray.length; i++) {
    if (getDistance(toLonLat(coordinate), toLonLat(lineArray[i])) < 300) {
      console.log(getDistance(toLonLat(coordinate), toLonLat(lineArray[i])));
      lineArray.splice(lineArray.indexOf(lineArray[i]), 1);
      removedOne = true;
    }
  }

  // if no wp < 300 m, remove last wp
  if (!removedOne && !removedPoi) {
    lineArray.pop();
  }

  // if only 1 wp, remove route and redraw startpoint
  if (lineArray.length == 1) {
    clearLayer(routeLayer);
    infoDiv.innerHTML = "";
    info2Div.innerHTML = "";
    info3Div.innerHTML = "";
  }

  if (lineArray.length == 0) {
    clearLayer(routeLayer);
  }

  line.setCoordinates(lineArray);
  routeMe();
}

map.on("singleclick", function (event) {
  if (!touchFriendlyCheck.checked) {
    addPosition(event.coordinate);
  }
});

map.on("contextmenu", function (event) {
  map.forEachFeatureAtPixel(event.pixel, function (feature, layer) {
    if (feature.getGeometry().getType() == "Point") {
      feature.set("straight", !feature.get("straight")); // boolean switch
    }
  });

  routeMe();
  // if (!touchFriendlyCheck.checked) {
  //   // remove waypoint
  //   for (var i = 0; i < lineArray.length; i++) {
  //     if (getDistance(toLonLat(event.coordinate), toLonLat(lineArray[i])) < 300) {
  //       removePosition(event.coordinate);
  //       break;
  //     }
  //   }
  //   // remove poi
  //   for (var i = 0; i < poiList.length; i++) {
  //     if (getDistance(toLonLat(event.coordinate), poiList[i][0]) < 300) {
  //       removePosition(event.coordinate);
  //       break;
  //     }
  //   }
  // }
});

var centerCoordinate;
map.on("moveend", function () {
  centerCoordinate = toLonLat(map.getView().getCenter()).reverse();
  var streetviewlink =
    '<a href="http://maps.google.com/maps?q=&layer=c&cbll=' +
    centerCoordinate +
    '" target="_blank">Streetview</a>';
  var gmaplink =
    '<a href="http://maps.google.com/maps?q=' +
    centerCoordinate +
    '" target="_blank">Gmap</a>';
  info4Div.innerHTML = streetviewlink + "<br>" + gmaplink;
});

function clearLayer(layerToClear) {
  layerToClear
    .getSource()
    .getFeatures()
    .forEach(function (feature) {
      layerToClear.getSource().removeFeature(feature);
    });
}

function routeMe() {
  var coordsString = [];
  for (var i = 0; i < lineArray.length; i++) {
    coordsString.push(toLonLat(lineArray[i]));
  }
  var brouterUrl =
    "https://brouter.de/brouter" +
    // fetch('https://jole84.se:17777/brouter' +
    "?lonlats=" +
    coordsString.join("|") +
    "&profile=car-fast&alternativeidx=0&format=geojson" +
    "&straight=" +
    getStraightPoints();

  if (lineArray.length >= 2) {
    fetch(brouterUrl).then(function (response) {
      response.json().then(function (result) {
        const route = new GeoJSON()
          .readFeature(result.features[0], {
            dataProjection: "EPSG:4326",
            featureProjection: "EPSG:3857",
          })
          .getGeometry();

        trackLength = result.features[0].properties["track-length"] / 1000; // track-length in km
        const totalTime = result.features[0].properties["total-time"] * 1000; // track-time in milliseconds

        // add route information to info box
        infoDiv.innerHTML = "Avstånd: " + trackLength.toFixed(2) + " km";
        info2Div.innerHTML =
          "Restid: " +
          new Date(0 + totalTime).toUTCString().toString().slice(16, 25);

        const routeGeometry = new Feature({
          type: "route",
          geometry: route,
        });

        // remove previus route
        clearLayer(routeLayer);

        // finally add route to map
        routeLayer.getSource().addFeatures([routeGeometry]);
        // add markers at waypoints
        for (var i = 0; i < lineArray.length; i++) {
          const marker = new Feature({
            routeFeature: true,
            name: i,
            straight: lineArrayStraights[i] || false,
            type: getPointType(i),
            geometry: new Point(lineArray[i]),
          });
          routeLayer.getSource().addFeature(marker);
        }
      });
    });
  }
}

function getPointType(i) {
  if (i == 0) {
    return "startPoint";
  } else if (i == lineArray.length - 1) {
    return "endPoint";
  } else {
    return "Point";
  }
}

function route2gpx() {
  var poiString = [];
  for (var i = 0; i < poiList.length; i++) {
    poiString.push(poiList[i].join(","));
  }

  var coordsString = [];
  for (var i = 0; i < lineArray.length; i++) {
    coordsString.push(toLonLat(lineArray[i]));
  }

  if (lineArray.length >= 2) {
    var brouterUrl =
      "https://brouter.de/brouter?lonlats=" +
      coordsString.join("|") +
      "&profile=car-fast&alternativeidx=0&format=gpx&trackname=Rutt_" +
      new Date().toLocaleDateString() +
      "_" +
      trackLength.toFixed(2) +
      "km" +
      "&straight=" +
      getStraightPoints();

    if (poiList.length >= 1) {
      brouterUrl += "&pois=" + poiString.join("|");
    }
    window.onunload = window.onbeforeunload = "";
    window.location = brouterUrl;
    window.onunload = window.onbeforeunload = function () {
      return "";
    };
  } else if (poiList.length >= 1) {
    // simple gpx file if no route is created
    let gpxFile = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<gpx version="1.1" creator="jole84 webapp">
<metadata>
  <desc>GPX log created by jole84 webapp</desc>
</metadata>`;

    for (var i = 0; i < poiList.length; i++) {
      gpxFile += `
  <wpt lat="${poiList[i][0][1]}" lon="${poiList[i][0][0]}"><name>${poiList[i][1]}</name></wpt>`;
    }

    gpxFile += `
</gpx>`;
    console.log(gpxFile);
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
      gpxFeatures = gpxFormat.readFeatures(evt.target.result, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });

      if (files.length > 1) {
        // set random color if two or more files is loaded
        var color = [
          Math.floor(Math.random() * 255),
          Math.floor(Math.random() * 255),
          Math.floor(Math.random() * 255),
          0.8,
        ];
        gpxFeatures.forEach((f) => {
          f.setStyle(
            new Style({
              stroke: new Stroke({
                color: color,
                width: 10,
              }),
              text: new Text({
                text: f.get("name"),
                font: "bold 14px Roboto,monospace",
                placement: "line",
                repeat: 1000,
                fill: new Fill({
                  color: color,
                }),
                stroke: new Stroke({
                  color: "white",
                  width: 4,
                }),
              }),
              image: new Icon({
                anchor: [0.5, 1],
                src: "https://jole84.se/poi-marker.svg",
              }),
            }),
          );
        });
      }

      gpxLayer.getSource().addFeatures(gpxFeatures);
    };
  }
}

document.addEventListener("keydown", function (event) {
  if (event.key == "a" && !overlay.getPosition()) {
    addPositionMapCenter();
  }
  if (event.key == "s" && !overlay.getPosition()) {
    savePoiPopup();
  }
  if (
    (event.key == "Escape" || event.key == "Delete") &&
    !overlay.getPosition()
  ) {
    removeLastMapCenter();
  }
  if (event.key == "v" && !overlay.getPosition()) {
    switchMap();
  }
});

map.on("pointermove", function (evt) {
  var hit = this.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
    if (feature.get("routeFeature")) {
      return true;
    }
  });
  if (hit) {
    this.getTargetElement().style.cursor = "pointer";
  } else {
    this.getTargetElement().style.cursor = "crosshair";
  }
});

modifypoi.addEventListener("modifyend", function () {
  poiList = [];
  poiLayer
    .getSource()
    .getFeatures()
    .forEach(function (feature) {
      const fileName = feature.get("name");
      const coordinate = toLonLat(feature.getGeometry().getCoordinates());
      poiList.push([coordinate, fileName]);
    });
});
