import { Feature, Map, View } from "ol";
import { fromLonLat, toLonLat } from "ol/proj.js";
import { getDistance, getLength } from "ol/sphere";
import { saveAs } from 'file-saver';
import { Stroke, Style, Icon, Fill, Text } from "ol/style.js";
import { Vector as VectorLayer } from "ol/layer.js";
import GeoJSON from "ol/format/GeoJSON.js";
import Geolocation from "ol/Geolocation.js";
import GPX from "ol/format/GPX.js";
import LineString from "ol/geom/LineString";
import MultiPoint from 'ol/geom/MultiPoint.js';
import OSM from "ol/source/OSM.js";
import Point from "ol/geom/Point.js";
import TileLayer from "ol/layer/Tile.js";
import TileWMS from "ol/source/TileWMS.js";
import VectorSource from "ol/source/Vector.js";
import WKT from "ol/format/WKT.js";
import XYZ from "ol/source/XYZ.js";

if (navigator.getBattery) {
  navigator.getBattery().then(function (battery) {
    setExtraInfo([
      '<font class="infoFormat">Batteri: ' + Math.round(battery.level * 100) + "% (" + (battery.charging ? '<font style="color:green">laddar</font>' : '<font style="color:red">laddar inte</font>') + ')</font>',
      '<font style="font-size: 0.4em;"> Build: INSERTDATEHERE</font>',
    ]);
  });
} else {
  setExtraInfo(['<font style="font-size: 0.4em;"> Build: INSERTDATEHERE</font>']);
}

let wakeLock;
const acquireWakeLock = async () => {
  if ("wakeLock" in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
    } catch (err) {
      console.log(err);
    }
  }
};
acquireWakeLock();
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    acquireWakeLock();
  }
});

localStorage.interactionDelay = (localStorage.interactionDelay || 10000);
localStorage.mapMode = (localStorage.mapMode || 0);
const startTime = new Date();
let distanceTraveled = 0;
var accuracy = 100;
var altitude = 0;
var center = [1700000, 8500000];
var closestAccident;
var closestAccidentPosition;
let prevCoordinate;
var currentPosition = center;
var destinationCoordinates = [];
var heading = 0;
var lastInteraction = new Date() - localStorage.interactionDelay;
var lonlat = toLonLat(currentPosition);
var maxSpeed = 0;
var maxSpeedCoord;
var speed = 0;
var speedKmh = 0;
var trackLog = [];
var mapDiv = document.getElementById("map");
var centerButton = document.getElementById("centerButton");
var customFileButton = document.getElementById("customFileButton");
var infoGroup = document.getElementById("infoGroup");
var saveLogButton = document.getElementById("saveLogButton");
var trafficWarningDiv = document.getElementById("trafficWarning");
centerButton.onclick = centerFunction;
customFileButton.addEventListener("change", handleFileSelect, false);
trafficWarningDiv.addEventListener("click", focusTrafficWarning);
saveLogButton.onclick = saveLogButtonFunction;
document.getElementById("clickFileButton").onclick = function () {
  customFileButton.click();
}

// menu stuff
var menuDiv = document.getElementById("menuDiv");
if (localStorage.firstRun == undefined && window.location === window.parent.location) {
  menuDiv.style.display = "unset";
  localStorage.firstRun = false;
} else {
  menuDiv.style.display = "none";
}

var enableLntDiv = document.getElementById("enableLnt");
var extraTrafikCheckDiv = document.getElementById("extraTrafikCheck");
var onUnloadDiv = document.getElementById("onUnload");
var prefferedZoomDiv = document.getElementById("prefferedZoom");
var interactionDelayDiv = document.getElementById("interactionDelay");
var preferredFontSizeDiv = document.getElementById("preferredFontSize");
var openMenuButton = document.getElementById("openMenu");
var closeMenuButton = document.getElementById("closeMenu");

enableLntDiv.checked = localStorage.enableLnt = localStorage.enableLnt == "true";
enableLntDiv.addEventListener("change", function () {
  localStorage.enableLnt = enableLntDiv.checked;
  location.reload();
});
if (JSON.parse(localStorage.enableLnt)) {
  var option4 = document.createElement("option");
  var option5 = document.createElement("option");
  option4.text = "Lantmäteriet Topo";
  option4.value = 4;
  option5.text = "Lantmäteriet Orto";
  option5.value = 5;
  layerSelector.add(option4);
  layerSelector.add(option5);
};

extraTrafikCheckDiv.checked = localStorage.extraTrafik == "true";
extraTrafikCheckDiv.addEventListener("change", function () {
  localStorage.extraTrafik = extraTrafikCheckDiv.checked;
  getDeviations();
});

onUnloadDiv.checked = localStorage.onUnload == "true";
onUnloadDiv.addEventListener("change", function () {
  localStorage.onUnload = onUnloadDiv.checked;
});
window.onbeforeunload = function () {
  if (JSON.parse(localStorage.onUnload)) {
    return "";
  }
};

closeMenuButton.onclick = function () {
  menuDiv.style.display = "none";
};

openMenuButton.onclick = function () {
  if (menuDiv.style.display == "none") {
    menuDiv.style.display = "unset";
  } else {
    menuDiv.style.display = "none";
  }
};

document.getElementById("clearSettings").onclick = function () {
  localStorage.clear();
  location.reload();
};

localStorage.defaultZoom = prefferedZoomDiv.value = localStorage.defaultZoom || 14;
prefferedZoomDiv.addEventListener("change", function () {
  localStorage.defaultZoom = prefferedZoomDiv.value;
  centerFunction();
});

interactionDelayDiv.value = localStorage.interactionDelay / 1000;
interactionDelayDiv.addEventListener("change", function () {
  localStorage.interactionDelay = interactionDelayDiv.value * 1000;
});

localStorage.preferredFontSize = preferredFontSizeDiv.value = localStorage.preferredFontSize || "20";
preferredFontSizeDiv.addEventListener("change", function () {
  localStorage.preferredFontSize = preferredFontSizeDiv.value;
  infoGroup.style.fontSize = localStorage.preferredFontSize;
});

const view = new View({
  center: center,
  zoom: 6,
  maxZoom: 20,
  constrainRotation: false,
});

const gpxStyle = {
  Point: new Style({
    image: new Icon({
      anchor: [0.5, 1],
      src: "https://jole84.se/poi-marker.svg",
    }),
    text: new Text({
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
  }),
  LineString: new Style({
    stroke: new Stroke({
      color: [0, 0, 255, 0.5],
      width: 10,
    }),
  }),
};
gpxStyle["MultiLineString"] = gpxStyle["LineString"];

const trackStyle = {
  LineString: new Style({
    stroke: new Stroke({
      color: [255, 0, 0, 0.8],
      width: 5,
    }),
  }),
  route: new Style({
    stroke: new Stroke({
      width: 10,
      color: [255, 0, 255, 0.6],
    }),
  }),
  icon: new Style({
    image: new Icon({
      anchor: [0.5, 1],
      src: "https://jole84.se/end-marker.svg",
    }),
  }),
};
trackStyle["MultiLineString"] = trackStyle["LineString"];

var trafficWarningTextStyleFunction = function (feature) {
  //Function to determine style of icons
  return [
    new Style({
      text: new Text({
        text: feature.get("name"),
        font: "bold 14px Roboto,monospace",
        textAlign: "center",
        textBaseline: "top",
        offsetY: 20,
        fill: new Fill({
          color: "#b41412",
        }),
        stroke: new Stroke({
          color: "yellow",
          width: 4,
        }),
      }),
    }),
  ];
};

var trafficWarningIconStyleFunction = function (feature) {
  //Function to determine style of icons
  return [
    new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        src: apiUrl + "icons/" + feature.get("iconId") + "?type=png32x32",
      }),
    }),
  ];
};

var line = new LineString([]);
var trackLine = new Feature({
  geometry: line,
});

var osm = new TileLayer({
  source: new OSM(),
  visible: false,
});

// var osm = new MapboxVectorLayer({
//   styleUrl: "mapbox://styles/tryckluft/clqmovmf100pb01o9g1li1hxb",
//   accessToken : "pk.eyJ1IjoidHJ5Y2tsdWZ0IiwiYSI6ImNrcTU1YTIzeTFlem8yd3A4MXRsMTZreWQifQ.lI612CDqRgWujJDv6zlBqw",
// });

var slitlagerkarta = new TileLayer({
  source: new XYZ({
    url: "https://jole84.se/slitlagerkarta/{z}/{x}/{y}.jpg",
    minZoom: 6,
    maxZoom: 14,
  }),
  visible: false,
  useInterimTilesOnError: false,
});

var slitlagerkarta_nedtonad = new TileLayer({
  source: new XYZ({
    url: "https://jole84.se/slitlagerkarta_nedtonad/{z}/{x}/{y}.jpg",
    minZoom: 6,
    maxZoom: 14,
  }),
  visible: false,
  useInterimTilesOnError: false,
});

var ortofoto = new TileLayer({
  source: new TileWMS({
    url: "https://minkarta.lantmateriet.se/map/ortofoto/",
    params: {
      layers: "Ortofoto_0.5,Ortofoto_0.4,Ortofoto_0.25,Ortofoto_0.16",
      TILED: true,
    },
  }),
  visible: false,
});

var topoweb = new TileLayer({
  source: new XYZ({
    url: "https://minkarta.lantmateriet.se/map/topowebbcache/?layer=topowebb&style=default&tilematrixset=3857&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={z}&TileCol={x}&TileRow={y}",
    maxZoom: 17,
  }),
  visible: false,
});

var gpxLayer = new VectorLayer({
  source: new VectorSource(),
  style: function (feature) {
    gpxStyle["Point"].getText().setText(feature.get("name"));
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
    return trackStyle[feature.get("type")];
  },
});

var trafficWarningSource = new VectorSource();

var trafficWarningIconLayer = new VectorLayer({
  source: trafficWarningSource,
  style: trafficWarningIconStyleFunction,
});

var trafficWarningTextLayer = new VectorLayer({
  source: trafficWarningSource,
  style: trafficWarningTextStyleFunction,
  declutter: true,
  minZoom: 10,
});

// creating the map
const map = new Map({
  layers: [
    slitlagerkarta,
    slitlagerkarta_nedtonad,
    osm,
    ortofoto,
    topoweb,
    gpxLayer,
    routeLayer,
    trackLayer,
    trafficWarningIconLayer,
    trafficWarningTextLayer,
  ],
  target: "map",
  view: view,
  keyboardEventTarget: document,
});

// gpx loader
gpxLayer.getSource().addEventListener("addfeature", function () {
  if (gpxLayer.getSource().getState() === "ready") {
    var padding = 100;
    lastInteraction = new Date();
    view.fit(gpxLayer.getSource().getExtent(), {
      padding: [padding, padding, padding, padding],
      maxZoom: 15,
    });
  }
});

var gpxFormat = new GPX();
var gpxFeatures;
function handleFileSelect(evt) {
  customFileButton.blur();
  var files = evt.target.files; // FileList object
  // remove previously loaded gpx files
  gpxLayer.getSource().clear();
  var fileNames = [];
  for (var i = 0; i < files.length; i++) {
    console.log(files[i]);
    fileNames.push(files[i].name);
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
                textAlign: "left",
                placement: "line",
                repeat: 500,
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
                color: color,
                src: "https://jole84.se/white-marker.svg",
              }),
            }),
          );
        });
      }
      gpxLayer.getSource().addFeatures(gpxFeatures);
    };
  }
  setExtraInfo(fileNames);
  // reaquire wake lock again after file select
  acquireWakeLock();
}

// convert degrees to radians
function degToRad(deg) {
  return (deg * Math.PI * 2) / 360;
}

function getPixelDistance(pixel, pixel2) {
  return Math.sqrt((pixel[1] - pixel2[1]) * (pixel[1] - pixel2[1]) + (pixel[0] - pixel2[0]) * (pixel[0] - pixel2[0]));
}

// milliseconds to HH:MM:SS
function toHHMMSS(milliSecondsInt) {
  var dateObj = new Date(milliSecondsInt);
  var hours = dateObj.getUTCHours().toString().padStart(2, "0");
  var minutes = dateObj.getUTCMinutes().toString().padStart(2, "0");
  var seconds = dateObj.getSeconds().toString().padStart(2, "0");
  return hours + ":" + minutes + ":" + seconds;
}

// start geolocation
const geolocation = new Geolocation({
  projection: view.getProjection(),
  trackingOptions: {
    maximumAge: 10000,
    enableHighAccuracy: true,
    timeout: 600000,
  },
  tracking: true,
});

// run once to get things going
geolocation.once("change", function () {
  currentPosition = geolocation.getPosition();
  altitude = geolocation.getAltitude() || 0;
  lonlat = toLonLat(currentPosition);
  const currentTime = new Date();
  if (currentTime - lastInteraction > localStorage.interactionDelay) {
    centerFunction();
  }
  getDeviations();

  trackLog.push([
    lonlat,
    altitude,
    currentTime,
  ]);
  line.appendCoordinate(currentPosition);

  prevCoordinate = lonlat;
});

// runs when position changes
geolocation.on("change", function () {
  currentPosition = geolocation.getPosition();
  accuracy = geolocation.getAccuracy();
  heading = geolocation.getHeading() || 0;
  speed = geolocation.getSpeed() || 0;
  speedKmh = speed * 3.6;
  altitude = geolocation.getAltitude() || 0;
  lonlat = toLonLat(currentPosition);
  const currentTime = new Date();
  positionMarkerPoint.setCoordinates(currentPosition);

  // measure distance and push log if position change > 10 meters and accuracy is good
  if (getDistance(prevCoordinate, lonlat) > 10 && accuracy < 20) {
    trackLog.push([
      lonlat,
      altitude,
      currentTime,
    ]);
    line.appendCoordinate(currentPosition);

    // recalculate route if > 300 m off route
    if (destinationCoordinates.length == 2) {
      var closestRoutePoint = routeLayer.getSource().getFeatureById(0).getGeometry().getClosestPoint(currentPosition);
      if (getDistance(lonlat, toLonLat(closestRoutePoint)) > 300) {
        destinationCoordinates[0] = lonlat;
        routeMe();
      }
    }

    // calculate remaing distance on gpx
    routeInfo.innerHTML = "";
    gpxLayer.getSource().forEachFeature(function (feature) {
      if (feature.getGeometry().getType() == "MultiLineString") {
        const featureCoordinates = feature.getGeometry().getLineString().getCoordinates()
        const gpxRemainingDistance = getRemainingDistance(featureCoordinates);
        if (gpxRemainingDistance != undefined) {
          routeInfo.innerHTML += '<font class="infoFormat">-></font> ' + gpxRemainingDistance.toFixed(1) + '<font class="infoFormat">KM</font>, ' + Math.round(gpxRemainingDistance / (speedKmh / 60)) + '<font class="infoFormat">MIN</font><br>';
        }
      }
    });

    // calculate remaing distance on route
    if (routeLayer.getSource().getFeatureById(0) != null) {
      const featureCoordinates = routeLayer.getSource().getFeatureById(0).getGeometry().getCoordinates();
      const routeRemainingDistance = getRemainingDistance(featureCoordinates);
      if (routeRemainingDistance != undefined) {
        routeInfo.innerHTML += '<font class="infoFormat">-></font> ' + routeRemainingDistance.toFixed(1) + '<font class="infoFormat">KM</font>, ' + Math.round(routeRemainingDistance / (speedKmh / 60)) + '<font class="infoFormat">MIN</font><br>';
      }
    }
  }

  if (accuracy < 20) {
    distanceTraveled += getDistance(prevCoordinate, lonlat);
  }
  prevCoordinate = lonlat;

  if (speed > 1) {
    // change marker if speed
    positionMarkerHeading.getStyle().getImage().setRotation(heading);
    positionMarker.getStyle().getImage().setOpacity(0);
    positionMarkerHeading.getStyle().getImage().setOpacity(1);

    // change view if no interaction occurred last 10 seconds
    if (currentTime - lastInteraction > localStorage.interactionDelay) {
      updateView();
    }
  }

  if (speed < 1) {
    positionMarker.getStyle().getImage().setOpacity(1);
    positionMarkerHeading.getStyle().getImage().setOpacity(0);
  }

  if (speedKmh > maxSpeed && accuracy < 20) {
    maxSpeed = speedKmh;
    maxSpeedCoord = [lonlat, new Date()];
  }

  // send text to info box
  document.getElementById("coordinatesDiv").innerHTML = lonlat[1].toFixed(5) + ", " + lonlat[0].toFixed(5);
  document.getElementById("distanceTraveledDiv").innerHTML = (distanceTraveled / 1000).toFixed(2);
  document.getElementById("accuracyDiv").innerHTML = Math.round(accuracy);
  document.getElementById("speedDiv").innerHTML = Math.floor(speedKmh);
  document.getElementById("maxSpeedDiv").innerHTML = Math.floor(maxSpeed);
});

function getRemainingDistance(featureCoordinates) {
  var newLineString = new LineString([]);
  var newMultiPoint = new MultiPoint(
    featureCoordinates.reverse(),
  );

  const newLineStringclosestPoint = newMultiPoint.getClosestPoint(currentPosition);
  const distanceToclosestPoint = getDistance(toLonLat(newLineStringclosestPoint), toLonLat(currentPosition));

  if (distanceToclosestPoint > 500) {
    return;
  } else {
    for (var i = 0; i < featureCoordinates.length; i++) {
      newLineString.appendCoordinate([featureCoordinates[i]]);
      if (featureCoordinates[i].toString() === newLineStringclosestPoint.toString()) {
        break;
      }
    }
    return getLength(newLineString) / 1000;
  }
}

// alert user if geolocation fails
geolocation.on("error", function () {
  getDeviations();
  setExtraInfo([
    "&#128543 Aktivera platsjänster för <br>att se din position på kartan!",
  ]);
});

// Geolocation marker
var positionMarkerPoint = new Point({});
var positionMarker = new Feature({
  geometry: positionMarkerPoint,
});
var positionMarkerHeading = new Feature({
  geometry: positionMarkerPoint,
});

map.addLayer(
  new VectorLayer({
    source: new VectorSource({
      features: [positionMarker, positionMarkerHeading],
    }),
  }),
);

positionMarker.setStyle(
  new Style({
    image: new Icon({
      anchor: [0.5, 0.5],
      src: "https://openlayers.org/en/latest/examples/data/geolocation_marker.png",
    }),
  }),
);

positionMarkerHeading.setStyle(
  new Style({
    image: new Icon({
      opacity: 0,
      anchor: [0.5, 0.67],
      src: "https://openlayers.org/en/latest/examples/data/geolocation_marker_heading.png",
      rotateWithView: true,
    }),
  }),
);

// recenters the view by putting the given coordinates at 3/4 from the top of the screen
function getCenterWithHeading(position, rotation) {
  const resolution = view.getResolution();
  const size = map.getSize();
  const height = size[1];

  return [
    position[0] - (Math.sin(rotation) * height * resolution * 1) / 4,
    position[1] + (Math.cos(rotation) * height * resolution * 1) / 4,
  ];
}

// center map function
function centerFunction() {
  const duration = 500;
  if (speed > 1) {
    lastInteraction = new Date() - localStorage.interactionDelay;
    view.setZoom(localStorage.defaultZoom);
    updateView();
  } else {
    view.animate({
      center: currentPosition,
      duration: duration,
    });
    view.animate({
      zoom: localStorage.defaultZoom,
      duration: duration,
    });
    view.animate({
      rotation: 0,
      duration: duration,
    });
  }
  acquireWakeLock();
}

function updateView() {
  if (view.getZoom() <= 11 || view.getZoom() >= 17 && speed > 14) {
    view.setZoom(localStorage.defaultZoom);
  }
  view.setCenter(getCenterWithHeading(currentPosition, -heading));
  view.setRotation(-heading);
}

view.on("change:resolution", function () {
  document.getElementById("currentZoom").innerHTML = (view.getZoom()).toFixed(1);
  if (view.getRotation() != 0 && view.getZoom() < 11) {
    view.setRotation(0);
  }
});

layerSelector.addEventListener("change", function () {
  localStorage.setItem("mapMode", layerSelector.value);
  switchMap();
});

if (!!window.chrome) {
  layerSelector.addEventListener("focus", function () {
    layerSelector.blur();
  });
}

// switch map logic
function switchMap() {
  slitlagerkarta_nedtonad.setVisible(false);
  slitlagerkarta.setVisible(false);
  ortofoto.setVisible(false);
  topoweb.setVisible(false);
  osm.setVisible(false);
  mapDiv.setAttribute(
    "style",
    "-webkit-filter: initial;filter: initial;background-color: initial;",
  );

  if (localStorage.enableLnt == "true" && localStorage.getItem("mapMode") > 5) {
    localStorage.setItem("mapMode", 0);
  }
  if (localStorage.enableLnt == "false" && localStorage.getItem("mapMode") > 3) {
    localStorage.setItem("mapMode", 0);
  }
  layerSelector.value = localStorage.getItem("mapMode");

  if (localStorage.getItem("mapMode") == 0) {
    // mapMode 0: slitlagerkarta
    slitlagerkarta.setVisible(true);
    if (JSON.parse(localStorage.enableLnt)) {
      ortofoto.setVisible(true);
      slitlagerkarta.setMaxZoom(15.5);
      ortofoto.setMinZoom(15.5);
    }
  } else if (localStorage.getItem("mapMode") == 1) {
    // mapMode 1: slitlagerkarta_nedtonad
    slitlagerkarta_nedtonad.setVisible(true);
    if (JSON.parse(localStorage.enableLnt)) {
      topoweb.setVisible(true);
      ortofoto.setVisible(true);
      slitlagerkarta_nedtonad.setMaxZoom(15.5);
      topoweb.setMinZoom(15.5);
      topoweb.setMaxZoom(17.5);
      ortofoto.setMinZoom(17.5);
    }
  } else if (localStorage.getItem("mapMode") == 2) {
    // mapMode 2: slitlagerkarta_nedtonad + night mode
    slitlagerkarta_nedtonad.setVisible(true);
    mapDiv.setAttribute("style", "filter: invert(1) hue-rotate(180deg);");
    if (JSON.parse(localStorage.enableLnt)) {
      topoweb.setVisible(true);
      slitlagerkarta_nedtonad.setMaxZoom(15.5);
      topoweb.setMinZoom(15.5);
      topoweb.setMaxZoom(20);
    }
  } else if (localStorage.getItem("mapMode") == 3) {
    // mapMode 3: Openstreetmap
    osm.setVisible(true);
  } else if (JSON.parse(localStorage.enableLnt) && localStorage.getItem("mapMode") == 4) {
    // mapMode 4: topoweb
    topoweb.setVisible(true);
    topoweb.setMinZoom(0);
    topoweb.setMaxZoom(20);
  } else if (JSON.parse(localStorage.enableLnt) && localStorage.getItem("mapMode") == 5) {
    // mapMode 4: orto
    ortofoto.setVisible(true);
    ortofoto.setMinZoom(0);
  }

  infoGroup.style.fontSize = localStorage.preferredFontSize;
}

// logic for saveLogButton
function saveLogButtonFunction() {
  if (trackLog.length > 5) {
    saveLog();
  } else {
    console.log(trackLog);
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
<wpt lat="${maxSpeedCoord[0][1]}" lon="${maxSpeedCoord[0][0]}"><name>max ${Math.floor(maxSpeed)} km/h ${maxSpeedCoord[1].toLocaleTimeString()}</name></wpt>
<trk>
<name>${startTime.toLocaleString()}, max ${maxSpeed.toFixed(1)} km/h, total ${(
      distanceTraveled / 1000
    ).toFixed(2)} km, ${toHHMMSS(new Date() - startTime)}</name>
<trkseg>`;

  for (let i = 0; i < trackLog.length; i++) {
    const lon = trackLog[i][0][0].toFixed(6);
    const lat = trackLog[i][0][1].toFixed(6);
    const ele = trackLog[i][1].toFixed(2);
    const isoTime = trackLog[i][2].toISOString();
    const trkpt = `
  <trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele><time>${isoTime}</time></trkpt>`;
    gpxFile += trkpt;
  }

  gpxFile += `
</trkseg>
</trk>
</gpx>`;

  const filename = startTime.toLocaleString().replace(/ /g, "_").replace(/:/g, ".") + ".gpx";
  setExtraInfo(["Sparar fil:", filename]);

  var file = new Blob([gpxFile], { type: "application/gpx+xml" });
  saveAs(file, filename);
}

var timeOut; // create timeout variable so it can be cleared
function setExtraInfo(infoText) {
  window.clearTimeout(timeOut);
  var extraInfo = infoText.join("<br />");
  document.getElementById("extraInfo").innerHTML = extraInfo;
  timeOut = setTimeout(function () {
    document.getElementById("extraInfo").innerHTML = "";
  }, 30000);
}

// brouter routing
function routeMe() {
  fetch(
    "https://brouter.de/brouter" +
    // "https://jole84.se:17777/brouter" +
    "?lonlats=" +
    destinationCoordinates.join("|") +
    "&profile=car-fast&alternativeidx=0&format=geojson",
  ).then(function (response) {
    if (!response.ok) {
      setExtraInfo(["Felaktig rutt"]);
      routeInfo.innerHTML = "";
      destinationCoordinates.pop(); // remove faulty coordinate
      return;
    }
    response.json().then(function (result) {
      const route = new GeoJSON()
        .readFeature(result.features[0], {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        })
        .getGeometry();

      const totalLength = result.features[0].properties["track-length"] / 1000; // track-length in km
      const totalTime = result.features[0].properties["total-time"];

      // add route information to info box
      setExtraInfo([
        `<a href="http://maps.google.com/maps?q=${destinationCoordinates[destinationCoordinates.length - 1][1]
        },${destinationCoordinates[destinationCoordinates.length - 1][0]
        }" target="_blank">Gmap</a>`,
        `<a href="http://maps.google.com/maps?layer=c&cbll=${destinationCoordinates[destinationCoordinates.length - 1][1]
        },${destinationCoordinates[destinationCoordinates.length - 1][0]
        }" target="_blank">Streetview</a>`,
      ]);
      routeInfo.innerHTML = '<font class="infoFormat">-></font> ' + totalLength.toFixed(1) + '<font class="infoFormat">KM</font>, ' + Math.round(totalTime / 60) + '<font class="infoFormat">MIN</font><br>';

      const routeFeature = new Feature({
        type: "route",
        geometry: route,
      });
      routeFeature.setId(0);

      const endMarker = new Feature({
        type: "icon",
        geometry: new Point(route.getLastCoordinate()),
      });

      // remove previus route
      routeLayer.getSource().clear();

      // finally add route to map
      routeLayer.getSource().addFeatures([routeFeature, endMarker]);
    });
  });
}

map.on("singleclick", function (evt) {
  if (evt.originalEvent.ctrlKey) {
    var coordinate = toLonLat(evt.coordinate).reverse();
    window.open(
      "http://maps.google.com/maps?q=&layer=c&cbll=" + coordinate,
      "_blank",
    );
  }
});

// right click/long press to route
map.on("contextmenu", function (event) {
  try {
    var closestWaypoint = gpxLayer
      .getSource()
      .getClosestFeatureToCoordinate(
        event.coordinate,
        function (feature) {
          return feature.getGeometry().getType() === "Point";
        },
      );

    var waypointIsClose = getPixelDistance(map.getPixelFromCoordinate(closestWaypoint.getGeometry().getCoordinates()), event.pixel) < 40;
  } catch {
    var waypointIsClose = false;
  }

  lastInteraction = new Date();
  var eventLonLat = toLonLat(event.coordinate);

  // set start position
  if (destinationCoordinates.length == 0) {
    destinationCoordinates[0] = lonlat;
  }

  var clickedOnCurrentPosition = getDistance(lonlat, eventLonLat) < 200 || getPixelDistance(event.pixel, map.getPixelFromCoordinate(currentPosition)) < 50;
  var clickedOnLastDestination = getPixelDistance(event.pixel, map.getPixelFromCoordinate(fromLonLat(destinationCoordinates[destinationCoordinates.length - 1]))) < 40;

  // measure distance from current pos
  if (clickedOnCurrentPosition) {
    setExtraInfo([Math.round(getDistance(lonlat, eventLonLat)) + '<font class="infoFormat">M</font>']);
  }
  // remove last point if click < 40 pixels from last point
  if (destinationCoordinates.length > 2 && clickedOnLastDestination) {
    destinationCoordinates.pop();
    // clear route if click < 40 pixels from last point or click on current position
  } else if (destinationCoordinates.length == 2 && clickedOnLastDestination || clickedOnCurrentPosition) {
    routeLayer.getSource().clear();
    routeInfo.innerHTML = "";
    destinationCoordinates = [];
  } else {
    // else push clicked coord to destinationCoordinates
    if (waypointIsClose) {
      destinationCoordinates.push(toLonLat(closestWaypoint.getGeometry().getCoordinates()));
    } else {
      destinationCoordinates.push(eventLonLat);
    }
  }

  // start routing
  if (destinationCoordinates.length >= 2) {
    routeMe();
  }
});

// store time of last interaction
map.on("pointerdrag", function () {
  lastInteraction = new Date();
});

// checks url parameters and loads gpx file from url:
var urlParams = window.location.href.split("?").pop().split("&");
for (var i = 0; i < urlParams.length; i++) {
  console.log(decodeURIComponent(urlParams[i]));
  if (urlParams[i].includes(".gpx")) {
    if (!urlParams[i].includes("http")) {
      urlParams[i] = "https://jole84.se/rutter/" + urlParams[i];
    }
    var titleString = decodeURIComponent(urlParams[i].split("/").pop());
    setExtraInfo([titleString]);
    fetch(urlParams[i], { mode: "no-cors" })
      .then((response) => {
        console.log(response);
        return response.text();
      })
      .then((response) => {
        var gpxFeatures = new GPX().readFeatures(response, {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        });
        gpxLayer.getSource().addFeatures(gpxFeatures);
      });
  }
}
switchMap();

// add keyboard controls
document.addEventListener("keydown", function (event) {
  if (menuDiv.style.display == "none") {
    const zoomStep = 0.5;
    if (event.key != "a" && event.key != "Escape" && event.key != "§") {
      // store time of last interaction
      lastInteraction = new Date();
    }
    if (event.key == "c" || event.key == "Enter") {
      event.preventDefault();
      centerFunction();
    }
    if (event.key == "v") {
      localStorage.setItem("mapMode", Number(localStorage.getItem("mapMode")) + 1);
      switchMap();
    }
    if (event.key == "z") {
      view.adjustRotation(0.2);
    }
    if (event.key == "x") {
      view.adjustRotation(-0.2);
    }
    if (event.key == "s") {
      saveLogButtonFunction();
    }
    if (event.key == "d") {
      focusDestination();
    }
    if (event.key == "Escape" || event.key == "§") {
      // carpe iter adventure controller minus button
      view.adjustZoom(-zoomStep);
    }
    if (event.key == "a") {
      // carpe iter adventure controller plus button
      view.adjustZoom(zoomStep);
    }
    if (event.code == "Space") {
      event.preventDefault();
      focusTrafficWarning();
    }
    if (event.key == "r") {
      recalculateRoute();
    }
  } else {
    if (event.key == "Escape" || event.key == "§") {
      closeMenuButton.click();
    }
  }
});

function breakSentence(sentence) {
  sentence = sentence.replaceAll(".:", ":").replaceAll("\n", "").trim();
  var returnSentence = "";
  var x = 0;
  for (var i = 0; i < sentence.length; i++) {
    if (x > 30 && sentence[i] == " " && sentence.length - i > 15) {
      x = 0;
      returnSentence += "\n";
    } else {
      returnSentence += sentence[i];
    }
    x++;
  }
  return returnSentence;
}

var apiUrl = "https://api.trafikinfo.trafikverket.se/v2/";
$.ajaxSetup({
  url: apiUrl + "data.json",
  error: function (msg) {
    if (msg.statusText == "abort") return;
  },
});

$.support.cors = true; // Enable Cross domain requests

function getDeviations() {
  var xmlRequest = `
  <REQUEST>
    <LOGIN authenticationkey='fa68891ca1284d38a637fe8d100861f0' />
    <QUERY objecttype='Situation' schemaversion='1.2'>
      <FILTER>
        <ELEMENTMATCH>
          <EQ name='Deviation.ManagedCause' value='true' />
          <EQ name='Deviation.MessageType' value='Olycka' />
          <GTE name='Deviation.EndTime' value='$now'/>
        </ELEMENTMATCH>
      </FILTER>
      <INCLUDE>Deviation.Message</INCLUDE>
      <INCLUDE>Deviation.IconId</INCLUDE>
      <INCLUDE>Deviation.Geometry.WGS84</INCLUDE>
      <INCLUDE>Deviation.RoadNumber</INCLUDE>
      <INCLUDE>Deviation.EndTime</INCLUDE>
      <INCLUDE>Deviation.LocationDescriptor</INCLUDE>
    </QUERY>
  </REQUEST>
`;

  if (localStorage.extraTrafik == 'true') {
    xmlRequest = `
    <REQUEST>
      <LOGIN authenticationkey='fa68891ca1284d38a637fe8d100861f0' />
      <QUERY objecttype='Situation' schemaversion='1.2'>
        <FILTER>
          <ELEMENTMATCH>
            <GTE name='Deviation.EndTime' value='$now'/>
          </ELEMENTMATCH>
        </FILTER>
        <INCLUDE>Deviation.Message</INCLUDE>
        <INCLUDE>Deviation.IconId</INCLUDE>
        <INCLUDE>Deviation.Geometry.WGS84</INCLUDE>
        <INCLUDE>Deviation.RoadNumber</INCLUDE>
        <INCLUDE>Deviation.EndTime</INCLUDE>
        <INCLUDE>Deviation.LocationDescriptor</INCLUDE>
      </QUERY>
    </REQUEST>
  `;
  }
  $.ajax({
    type: "POST",
    contentType: "text/xml",
    dataType: "json",
    data: xmlRequest,
    success: function (response) {
      if (response == null) return;
      try {
        trafficWarningSource.clear();
        $.each(response.RESPONSE.RESULT[0].Situation, function (index, item) {
          var format = new WKT();
          var position = format
            .readGeometry(item.Deviation[0].Geometry.WGS84)
            .transform("EPSG:4326", "EPSG:3857");
          var feature = new Feature({
            geometry: position,
            name: breakSentence(
              (item.Deviation[0].LocationDescriptor ||
                item.Deviation[0].RoadNumber ||
                "Väg").trim() +
              ": " +
              (item.Deviation[0].Message || "-")) +
              "\n" +
              new Date(item.Deviation[0].EndTime)
                .toLocaleString().slice(0, -3),
            roadNumber: (item.Deviation[0].RoadNumber || "väg"),
            iconId: item.Deviation[0].IconId,
            locationDescriptor: item.Deviation[0].LocationDescriptor,
          });
          trafficWarningSource.addFeature(feature);
        });
        getClosestAccident();
      } catch (ex) {
        console.log(ex);
      }
    },
  });
}

setInterval(getDeviations, 60000); // getDeviations interval

function focusTrafficWarning() {
  lastInteraction = new Date();
  if (closestAccident != undefined) {
    closestAccidentPosition = closestAccident.getGeometry().getCoordinates()
  } else {
    closestAccidentPosition = currentPosition;
  }
  var duration = 500;
  view.animate({
    center: closestAccidentPosition,
    duration: duration,
  });
  view.animate({
    zoom: 11,
    duration: duration,
  });
  view.animate({
    rotation: 0,
    duration: duration,
  });
}

function focusDestination() {
  if (destinationCoordinates.length > 1) {
    lastInteraction = new Date();
    var coordinates = fromLonLat(destinationCoordinates[destinationCoordinates.length - 1]);

    var duration = 500;
    view.animate({
      center: coordinates,
      duration: duration,
    });
    view.animate({
      rotation: 0,
      duration: duration,
    });
  }
}

function getClosestAccident() {
  if (trafficWarningSource.getFeatures().length >= 1) {

    closestAccident = trafficWarningSource.getClosestFeatureToCoordinate(
      currentPosition,
      function (feature) {
        return feature.get("iconId") === "roadAccident";
      },
    );

    // check route for accidents
    var routeHasAccident = false;
    var routeIsActive = routeLayer.getSource().getFeatureById(0) != undefined;
    if (routeIsActive) {
      var featureCoordinates = routeLayer.getSource().getFeatureById(0).getGeometry().getCoordinates();
      var newMultiPoint = new MultiPoint(
        featureCoordinates.reverse(),
      );

      const newLineStringclosestPoint = newMultiPoint.getClosestPoint(currentPosition);

      for (var i = 0; i < featureCoordinates.length; i++) {
        var closestLineStringPoint = trafficWarningSource.getClosestFeatureToCoordinate(
          featureCoordinates[i],
          function (feature) {
            return feature.get("iconId") === "roadAccident";
          },
        );
        var closestLineStringPointDistance = getDistance(
          toLonLat(closestLineStringPoint.getGeometry().getCoordinates()),
          toLonLat(featureCoordinates[i])
        );
        if (closestLineStringPointDistance < 500) {
          routeHasAccident = true;
          closestAccident = closestLineStringPoint;
        }
        if (featureCoordinates[i].toString() === newLineStringclosestPoint.toString()) {
          break;
        }
      }
    }

    var closestAccidentRoadNumber = closestAccident.get("roadNumber");
    var closestAccidentCoords = closestAccident.getGeometry().getCoordinates();
    var closestAccidentDistance = getDistance(
      toLonLat(closestAccidentCoords),
      lonlat,
    );

    if (closestAccidentDistance < 30000 && !routeIsActive || routeHasAccident) {
      trafficWarningDiv.innerHTML =
        "Olycka " + closestAccidentRoadNumber.replace(/^V/, "v") + " (" + Math.round(closestAccidentDistance / 1000) + "km)";
    } else {
      closestAccident = null;
      trafficWarningDiv.innerHTML = "";
    }
  } else {
    closestAccident = null;
    trafficWarningDiv.innerHTML = "";
  }
}

function recalculateRoute() {
  if (destinationCoordinates.length >= 2) {
    if (getDistance(destinationCoordinates[0], destinationCoordinates[destinationCoordinates.length - 1]) < 300) {
      routeInfo.innerHTML = "";
      document.getElementById("extraInfo").innerHTML = "";
      destinationCoordinates = [];
      routeLayer.getSource().clear();
    } else {
      destinationCoordinates = [lonlat, destinationCoordinates[destinationCoordinates.length - 1]];
      routeMe();
    }
  }
}
