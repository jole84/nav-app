import "./style.css";
import { Feature, Map, View } from "ol";
import { fromLonLat, toLonLat } from "ol/proj.js";
import { getDistance } from "ol/sphere";
import { Style, Icon } from "ol/style.js";
import { Vector as VectorLayer } from "ol/layer.js";
import Geolocation from "ol/Geolocation.js";
import { GeoJSON } from "ol/format.js";
import LineString from "ol/geom/LineString";
import MultiPoint from "ol/geom/MultiPoint.js";
import OSM from "ol/source/OSM.js";
import Point from "ol/geom/Point.js";
import TileLayer from "ol/layer/Tile.js";
import TileWMS from "ol/source/TileWMS.js";
import VectorSource from "ol/source/Vector.js";
import WKT from "ol/format/WKT.js";
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import MVT from 'ol/format/MVT.js';
import XYZ from "ol/source/XYZ.js";
import { styleStuff } from "./styleTileFunctions.js"
import {
  trafficWarningTextStyleFunction,
  trafficWarningIconStyleFunction,
  gpxStyleText,
  gpxStyle,
  trackStyle,
  userLocationStyle,
  routeStyle,
} from "./styleFuntions.js";
import {
  getPixelDistance,
  breakSentence,
  msToTime,
  toHHMMSS,
  getRemainingDistance,
  toRemainingString,
  getFileFormat,
  findIndexOf,
} from "./modules.js";

localStorage.mapMode = localStorage.mapMode || 0;
const center = JSON.parse(localStorage.lastPosition || "[1700000, 8500000]");
const centerButton = document.getElementById("centerButton");
const closeMenuButton = document.getElementById("closeMenu");
const customFileButton = document.getElementById("customFileButton");
const infoGroup = document.getElementById("infoGroup");
const interactionDelay = 10000;
const menuDiv = document.getElementById("menuDiv");
const openMenuButton = document.getElementById("openMenu");
const preferredFontSizeDiv = document.getElementById("preferredFontSize");
const prefferedZoomDiv = document.getElementById("prefferedZoom");
const routeInfo = document.getElementById("routeInfo");
const saveLogButton = document.getElementById("saveLogButton");
const selectFile = document.getElementById("selectFile");
const trafficWarningDiv = document.getElementById("trafficWarning");
let accuracy = 5000;
let altitude = 0;
let closestAccident;
let closestAccidentPosition;
let currentPosition = center;
let destinationCoordinates = [];
let distanceTraveled = 0;
let heading = 0;
let lastInteraction = Date.now() - interactionDelay;
let lonlat = toLonLat(currentPosition);
let maxSpeed = 0;
let prevLonlat;
let speed = 0;
let speedKmh = 0;
let startTime = Date.now();
let timeOut;
let trackLog = [];

if (!!localStorage.trackLog) {
  document.getElementById("restoreTripButton").style.display = "unset";
}

if (navigator.getBattery) {
  navigator.getBattery().then(function (battery) {
    document.getElementById("batteryLevel").innerHTML = Math.round(
      battery.level * 100,
    );
    document.getElementById("batteryCharging").innerHTML = battery.charging
      ? "+"
      : "-";

    battery.onlevelchange = () => {
      document.getElementById("batteryLevel").innerHTML = Math.round(
        battery.level * 100,
      );
    };
    battery.onchargingchange = () => {
      document.getElementById("batteryCharging").innerHTML = battery.charging
        ? "+"
        : "-";
      setExtraInfo([
        battery.charging
          ? '<div style="color:green;text-align: center;">+++ laddar batteri +++</div>'
          : '<div style="color:red;text-align: center;">⚠ laddare urkopplad ⚠</div>',
      ]);
    };
  });
}
setExtraInfo([
  '<div style="text-align:center;font-size: 0.4em;">Build: INSERTDATEHERE</div>',
]);

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

centerButton.onclick = centerFunction;
customFileButton.addEventListener("change", handleFileSelect, false);
saveLogButton.onclick = saveLog;
trafficWarningDiv.onclick = focusTrafficWarning;
document.getElementById("clearTripButton").onclick = clearTrip;
document.getElementById("restoreTripButton").onclick = restoreTrip;
document.getElementById("clickFileButton").onclick = function () {
  gpxSource.clear();
  customFileButton.click();
};
setTimeout(function () { document.getElementById("restoreTripButton").style.display = "none" }, 30000);

infoGroup.addEventListener("dblclick", function () {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
});

// localStorage.enableLnt = enableLntDiv.checked = JSON.parse(localStorage.enableLnt || "true");
// enableLntDiv.addEventListener("change", function () {
//   localStorage.enableLnt = enableLntDiv.checked;
//   location.reload();
// });
// if (JSON.parse(localStorage.enableLnt)) {
//   const option4 = document.createElement("option");
//   const option5 = document.createElement("option");
//   option4.text = "Lantmäteriet Topo";
//   option4.value = 4;
//   option5.text = "Lantmäteriet Orto";
//   option5.value = 5;
//   layerSelector.add(option4);
//   layerSelector.add(option5);
// }

closeMenuButton.onclick = function () {
  menuDiv.style.display = "none";
};

openMenuButton.onclick = function () {
  menuDiv.style.display = menuDiv.checkVisibility() ? "none" : "unset";
};

document.getElementById("clearSettings").onclick = function () {
  localStorage.clear();
  location.reload();
};

localStorage.defaultZoom = prefferedZoomDiv.value =
  localStorage.defaultZoom || 14;
prefferedZoomDiv.addEventListener("change", function () {
  localStorage.defaultZoom = prefferedZoomDiv.value;
  centerFunction();
});

localStorage.preferredFontSize = preferredFontSizeDiv.value =
  localStorage.preferredFontSize || "25px";
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

const trackLineString = new LineString([]);

const osm = new TileLayer({
  className: "saturated",
  source: new OSM({
    zDirection: 1,
  }),
  visible: false,
});

const slitlagerkarta = new TileLayer({
  source: new XYZ({
    url: "https://jole84.se/slitlagerkarta/{z}/{x}/{y}.jpg",
    minZoom: 6,
    maxZoom: 14,
    transition: 0,
  }),
  visible: false,
  useInterimTilesOnError: false,
});

const slitlagerkarta_nedtonad = new TileLayer({
  source: new XYZ({
    url: "https://jole84.se/slitlagerkarta_nedtonad/{z}/{x}/{y}.jpg",
    minZoom: 6,
    maxZoom: 14,
    transition: 0,
  }),
  visible: false,
  useInterimTilesOnError: false,
});

const newTileLayer = new VectorTileLayer({
  source: new VectorTileSource({
    format: new MVT(),
    // url: './tiles/{z}/{x}/{y}.pbf',
    url: 'https://jole84.se/tiles/{z}/{x}/{y}.pbf',
    minZoom: 6,
    maxZoom: 14,
  }),
  style: styleStuff
});

const ortofoto = new TileLayer({
  source: new TileWMS({
    url: "https://minkarta.lantmateriet.se/map/ortofoto/",
    params: {
      layers: "Ortofoto_0.5,Ortofoto_0.4,Ortofoto_0.25,Ortofoto_0.16",
      TILED: true,
    },
  }),
  visible: false,
});

const topoweb = new TileLayer({
  source: new XYZ({
    url: "https://minkarta.lantmateriet.se/map/topowebbcache/?layer=topowebb&style=default&tilematrixset=3857&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={z}&TileCol={x}&TileRow={y}",
    maxZoom: 17,
  }),
  visible: false,
});

const gpxSource = new VectorSource();

const gpxLayer = new VectorLayer({
  source: gpxSource,
  style: gpxStyle,
});

const gpxLayerLabels = new VectorLayer({
  source: gpxSource,
  style: gpxStyleText,
  declutter: true,
  minZoom: 9,
});

const userLocationLayer = new VectorLayer({
  source: new VectorSource(),
  style: userLocationStyle,
});

const trackLayer = new VectorLayer({
  source: new VectorSource({
    features: [new Feature({
      geometry: trackLineString,
    })],
  }),
  style: trackStyle,
});

const endMarker = new Point([]);
const routeLineString = new LineString([]);
const routeLayer = new VectorLayer({
  source: new VectorSource({
    features: [
      new Feature({
        geometry: routeLineString
      }),
      new Feature({
        geometry: endMarker
      }),
    ],
  }),
  style: routeStyle,
});
routeLayer.addEventListener("change", function () {
  getClosestAccident();
});

const trafficWarningSource = new VectorSource();

const trafficWarningIconLayer = new VectorLayer({
  source: trafficWarningSource,
  style: trafficWarningIconStyleFunction,
});

const trafficWarningTextLayer = new VectorLayer({
  source: trafficWarningSource,
  style: trafficWarningTextStyleFunction,
  declutter: true,
  minZoom: 10,
});

const trackPointLayer = new VectorLayer({
  source: new VectorSource(),
  style: gpxStyleText,
  declutter: true,
});

const map = new Map({
  layers: [
    slitlagerkarta,
    slitlagerkarta_nedtonad,
    newTileLayer,
    osm,
    ortofoto,
    topoweb,
    gpxLayer,
    routeLayer,
    trackLayer,
    gpxLayerLabels,
    trackPointLayer,
    userLocationLayer,
    trafficWarningIconLayer,
    trafficWarningTextLayer,
  ],
  target: "map",
  view: view,
  keyboardEventTarget: document,
});

function gpxSourceLoader(gpxFile) {
  const reader = new FileReader();
  const fileExtention = gpxFile.name.replace(".gpx.txt", ".gpx").split(".").pop().toLowerCase();
  const fileFormat = getFileFormat(fileExtention);
  reader.readAsText(gpxFile, "UTF-8");
  reader.onload = function (evt) {
    const gpxFeatures = fileFormat.readFeatures(evt.target.result, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });
    for (let i = 0; i < gpxFeatures.length; i++) {
      gpxSource.addFeature(gpxFeatures[i]);
    }
  };
}

// add selectFile options
fetch("https://jole84.se/filesList.php")
  .then((response) => response.json())
  .then((filesList) => {
    for (var i = 0; i < filesList.length; i++) {
      var opt = filesList[i];
      var el = document.createElement("option");
      el.textContent = opt.split("/").pop();
      el.value = opt;
      selectFile.appendChild(el);
    }
  }).catch(function (err) {
    console.log('error: ' + err);
  });

// load gpx file from selectFile in menuDiv
selectFile.addEventListener("change", function () {
  gpxSource.clear();
  console.log(selectFile.value)
  if (selectFile.value !== "välj gpxfil") {
    fetch(selectFile.value, { mode: "cors" })
      .then((response) => {
        return response.text();
      })
      .then((response) => {
        gpxSourceLoader(new File([response], selectFile.value, { type: "application/gpx" }));
        setExtraInfo([selectFile.value.split("/").pop()]);
      });
  } else {
    setExtraInfo([]);
  }
});

function handleFileSelect(evt) {
  customFileButton.blur();
  const files = evt.target.files; // FileList object
  const fileNames = [];

  for (let i = 0; i < files.length; i++) {
    fileNames.push(files[i].name);
    gpxSourceLoader(files[i]);
  }
  setExtraInfo(fileNames);
  // reaquire wake lock again after file select
  acquireWakeLock();
}

// PWA file browser file handler
if ("launchQueue" in window) {
  launchQueue.setConsumer(async (launchParams) => {
    const fileNames = [];
    for (const file of launchParams.files) {
      const f = await file.getFile();
      gpxSourceLoader(f);
      fileNames.push(f.name);
    }
    setExtraInfo(fileNames);
  });
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
  accuracy = geolocation.getAccuracy();
  currentPosition = geolocation.getPosition();
  altitude = Math.round(geolocation.getAltitude() || 0);
  prevLonlat = lonlat = toLonLat(currentPosition);
  const currentTime = Date.now();
  if (currentTime - lastInteraction > interactionDelay) {
    centerFunction();
  }
  trackLog.push([lonlat, altitude, currentTime]);
  trackLineString.appendCoordinate(currentPosition);
  getClosestAccident();
  updateUserPosition();
});

const accuracyFeature = new Feature();
geolocation.on('change:accuracyGeometry', function () {
  if (accuracy < 20) {
    accuracyFeature.setGeometry();
  } else {
    accuracyFeature.setGeometry(geolocation.getAccuracyGeometry());
  }
});

// runs when position changes
geolocation.on("change", function () {
  currentPosition = geolocation.getPosition();
  accuracy = geolocation.getAccuracy();
  heading = geolocation.getHeading() || 0;
  speed = geolocation.getSpeed() || 0;
  speedKmh = speed * 3.6;
  altitude = Math.round(geolocation.getAltitude() || 0);
  localStorage.lastPosition = JSON.stringify(currentPosition);
  lonlat = toLonLat(currentPosition);
  const currentTime = Date.now();
  positionMarkerPoint.setCoordinates(currentPosition);

  // measure distance and push log if position change > 5 meters and accuracy is good and more than 3 seconds
  if (
    getDistance(lonlat, trackLog[trackLog.length - 1][0]) > 5 &&
    accuracy < 25 &&
    currentTime - trackLog[trackLog.length - 1][2] > 3000
  ) {
    trackLog.push([lonlat, altitude, currentTime]);
    trackLineString.appendCoordinate(currentPosition);
    if (currentTime - startTime > 300000) { // wait 5 minutes before log backup
      localStorage.trackLog = JSON.stringify(trackLog);
    }

    // recalculate route if > 300 m off route
    if (destinationCoordinates.length == 2) {
      const closestRoutePoint = routeLineString.getClosestPoint(currentPosition);
      if (getDistance(lonlat, toLonLat(closestRoutePoint)) > 300) {
        destinationCoordinates[0] = lonlat;
        routeMe();
      }
    }
  }

  if (speed > 1) {
    // change marker if speed
    positionMarkerHeading.getStyle().getImage().setRotation(heading);
    positionMarker.getStyle().getImage().setOpacity(0);
    positionMarkerHeading.getStyle().getImage().setOpacity(1);

    // change view if no interaction occurred last 10 seconds
    if (currentTime - lastInteraction > interactionDelay) {
      updateView();
    }
    distanceTraveled += getDistance(lonlat, prevLonlat);

    // calculate remaing distance on gpx
    routeInfo.innerHTML = "";
    gpxSource.forEachFeature(function (feature) {
      const featureType = feature.getGeometry().getType();
      if (featureType == "LineString" || featureType == "MultiLineString") {
        const featureCoordinates = featureType == "MultiLineString" ? feature.getGeometry().getLineString().getCoordinates() : feature.getGeometry().getCoordinates();
        const gpxRemainingDistance = getRemainingDistance(featureCoordinates, lonlat);
        if (gpxRemainingDistance != undefined) {
          routeInfo.innerHTML += toRemainingString(
            gpxRemainingDistance,
            gpxRemainingDistance / ((speedKmh < 30 ? 75 : speedKmh) / 60 / 60),
          );
        }
      }
    });

    // calculate remaing distance on route
    if (routeLineString.getCoordinates().length > 0) {
      const featureCoordinates = routeLineString.getCoordinates();
      const routeRemainingDistance = getRemainingDistance(featureCoordinates, lonlat);
      if (routeRemainingDistance != undefined) {
        routeInfo.innerHTML += toRemainingString(
          routeRemainingDistance,
          routeRemainingDistance / ((speedKmh < 30 ? 75 : speedKmh) / 60 / 60),
        );
      }
    }
  }

  if (speed < 1) {
    positionMarker.getStyle().getImage().setOpacity(1);
    positionMarkerHeading.getStyle().getImage().setOpacity(0);
  }

  if (speedKmh > maxSpeed && accuracy < 25) {
    maxSpeed = speedKmh;
  }

  prevLonlat = lonlat;

  // send text to info box
  document.getElementById("coordinatesDiv").innerHTML = lonlat[1].toFixed(5) + ", " + lonlat[0].toFixed(5);
  document.getElementById("distanceTraveledDiv").innerHTML = (distanceTraveled / 1000).toFixed(2);
  document.getElementById("accuracyDiv").innerHTML = Math.round(accuracy);
  document.getElementById("speedDiv").innerHTML = Math.floor(speedKmh);
  document.getElementById("maxSpeedDiv").innerHTML = Math.floor(maxSpeed);
});

// alert user if geolocation fails
geolocation.on("error", function () {
  setExtraInfo([
    "&#128543 Aktivera platsjänster för <br>att se din position på kartan!",
  ]);
});

// Geolocation marker
const positionMarkerPoint = new Point({});
const positionMarker = new Feature({
  geometry: positionMarkerPoint,
});
const positionMarkerHeading = new Feature({
  geometry: positionMarkerPoint,
});

map.addLayer(
  new VectorLayer({
    source: new VectorSource({
      features: [positionMarker, positionMarkerHeading, accuracyFeature],
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

function restoreTrip() {
  // read old route from localStorage
  const oldRoute = JSON.parse(localStorage.trackLog);
  startTime = oldRoute[0][2];
  distanceTraveled = 0;
  trackLineString.setCoordinates([]);

  // restore line geometry
  for (let i = 0; i < oldRoute.length; i++) {
    trackLineString.appendCoordinate(fromLonLat(oldRoute[i][0]));
    trackLog[i] = [oldRoute[i][0], oldRoute[i][1], oldRoute[i][2]];
    if (i == oldRoute.length - 1) {
      distanceTraveled += getDistance(lonlat, oldRoute[i][0]);
      trackLineString.appendCoordinate(currentPosition);
    } else {
      distanceTraveled += getDistance(oldRoute[i][0], oldRoute[i + 1][0]);
    }
  }

  document.getElementById("distanceTraveledDiv").innerHTML = (
    distanceTraveled / 1000
  ).toFixed(2);

  document.getElementById("restoreTripButton").style.display = "none";
  setExtraInfo(["Tripp återställd"]);
}

function clearTrip() {
  distanceTraveled = 0;
  document.getElementById("distanceTraveledDiv").innerHTML = "0.00";
  document.getElementById("restoreTripButton").style.display = "none";
  trackLineString.setCoordinates([]);
  localStorage.removeItem("trackLog");
  maxSpeed = 0;
  menuDiv.style.display = "none";
  setExtraInfo(["Tripp nollställd"]);
  trackLog = [[lonlat, altitude, Date.now()]];
  trackPointLayer.getSource().clear();
}

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
  const padding = 50;
  if (speed > 1) {
    lastInteraction = Date.now() - interactionDelay;
    if (!!accuracyFeature.getGeometry()) {
      view.fit(accuracyFeature.getGeometry().getExtent(), {
        padding: [padding, padding, padding, padding],
        maxZoom: localStorage.defaultZoom,
      });
    } else {
      view.setZoom(localStorage.defaultZoom);
    }
    updateView();
  } else {
    if (!!accuracyFeature.getGeometry()) {
      view.fit(accuracyFeature.getGeometry().getExtent(), {
        padding: [padding, padding, padding, padding],
        duration: duration,
        maxZoom: localStorage.defaultZoom,
      });
    } else {
      view.animate({
        center: currentPosition,
        duration: duration,
      });
      view.animate({
        zoom: localStorage.defaultZoom,
        duration: duration,
      });
    }
    view.animate({
      rotation: 0,
      duration: duration,
    });
  }
  acquireWakeLock();
}

function updateView() {
  if (view.getZoom() <= 11 || (view.getZoom() >= 17 && speed > 14)) {
    view.setZoom(localStorage.defaultZoom);
  }
  view.setCenter(getCenterWithHeading(currentPosition, -heading));
  view.setRotation(-heading);
}

layerSelector.addEventListener("change", function () {
  localStorage.mapMode = layerSelector.value;
  switchMap();
});

if (!!window.chrome) {
  layerSelector.addEventListener("focus", function () {
    layerSelector.blur();
  });
}

// switch map logic
function switchMap() {
  slitlagerkarta.setVisible(false);
  slitlagerkarta_nedtonad.setVisible(false);
  newTileLayer.setVisible(false);
  ortofoto.setVisible(false);
  topoweb.setVisible(false);
  osm.setVisible(false);
  document.body.classList.remove("darkmode");

  if (localStorage.mapMode > 6) {
    localStorage.mapMode = 0;
  }

  layerSelector.value = localStorage.mapMode;

  if (localStorage.mapMode == 0) {
    // mapMode 0: slitlagerkarta
    slitlagerkarta.setVisible(true);
    ortofoto.setVisible(true);
    slitlagerkarta.setMaxZoom(15.5);
    ortofoto.setMinZoom(15.5);
  } else if (localStorage.mapMode == 1) {
    // mapMode 1: slitlagerkarta_nedtonad
    slitlagerkarta_nedtonad.setVisible(true);
    topoweb.setVisible(true);
    ortofoto.setVisible(true);
    slitlagerkarta_nedtonad.setMaxZoom(15.5);
    topoweb.setMinZoom(15.5);
    topoweb.setMaxZoom(17.5);
    ortofoto.setMinZoom(17.5);
  } else if (localStorage.mapMode == 2) {
    // mapMode 2: slitlagerkarta_nedtonad + night mode
    slitlagerkarta_nedtonad.setVisible(true);
    document.body.classList.add("darkmode");
    topoweb.setVisible(true);
    slitlagerkarta_nedtonad.setMaxZoom(15.5);
    topoweb.setMinZoom(15.5);
    topoweb.setMaxZoom(20);
  } else if (localStorage.mapMode == 3) {
    // mapMode 3: Openstreetmap
    osm.setVisible(true);
  } else if (localStorage.mapMode == 4) {
    // mapMode 4: topoweb
    topoweb.setVisible(true);
    topoweb.setMinZoom(0);
    topoweb.setMaxZoom(20);
  } else if (localStorage.mapMode == 5) {
    // mapMode 4: orto
    ortofoto.setVisible(true);
    ortofoto.setMinZoom(0);
  } else if (localStorage.mapMode == 6) {
    // mapMode 6: MVT
    newTileLayer.setVisible(true);
    ortofoto.setVisible(true);
    newTileLayer.setMaxZoom(16.5);
    ortofoto.setMinZoom(16.5);
  }
  infoGroup.style.fontSize = localStorage.preferredFontSize;
}

// new saveLog function
async function saveLog() {
  let gpxFile = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<gpx version="1.1" creator="Jole84 Nav-app">
<metadata>
  <desc>GPX log created by Jole84 Nav-app</desc>
  <time>${(new Date(trackLog[0][2])).toISOString()}</time>
</metadata>
<trk>
  <name>${new Date(trackLog[0][2]).toLocaleString()}, max ${Math.floor(maxSpeed)} km/h, ${(
      distanceTraveled / 1000
    ).toFixed(2)} km, ${toHHMMSS(trackLog[trackLog.length - 1][2] - trackLog[0][2])}</name>
  <trkseg>`;

  for (let i = 0; i < trackLog.length; i++) {
    const lon = trackLog[i][0][0].toFixed(6);
    const lat = trackLog[i][0][1].toFixed(6);
    const ele = trackLog[i][1].toFixed(2);
    const isoTime = new Date(trackLog[i][2]).toISOString();
    const trkpt = `
    <trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele><time>${isoTime}</time></trkpt>`;
    gpxFile += trkpt;
  }

  gpxFile += `
  </trkseg>
</trk>
</gpx>`;

  const filename = new Date(trackLog[0][2]).toLocaleString().replace(/ /g, "_").replace(/:/g, ".") + "_" + (distanceTraveled / 1000).toFixed(2) + "km.gpx";

  let file = new Blob([gpxFile], { type: "application/gpx+xml" });

  // tries to share text file
  if (window.showSaveFilePicker) {
    saveFile(file, filename);
  } else {
    try {
      await navigator.share({
        files: [new File([gpxFile], filename + ".txt", { type: "text/plain" })],
      });
    } catch (error) {
      setExtraInfo([error]);
    }
  }
}

async function saveFile(data, fileName) {
  try {
    // create a new handle
    const newHandle = await window.showSaveFilePicker({ suggestedName: fileName });

    // create a FileSystemWritableFileStream to write to
    const writableStream = await newHandle.createWritable();

    // write our file
    await writableStream.write(data);

    // close the file and write the contents to disk.
    await writableStream.close();

    alert("GPX sparad!");
  } catch (e) {
    alert("Något gick snett :( \n" + e.message);
  }
}

function setExtraInfo(infoText) {
  window.clearTimeout(timeOut);
  const extraInfo = infoText.join("<br />");
  document.getElementById("extraInfo").innerHTML = extraInfo;
  timeOut = setTimeout(function () {
    document.getElementById("extraInfo").innerHTML = "";
  }, 15000);
}

// Open Route Service routing
function routeMeOSR() {
  fetch(`https://api.openrouteservice.org/v2/directions/driving-car/geojson?`, {
    method: "post",
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
      'Authorization': '5b3ce3597851110001cf62482ba2170071134e8a80497f7f4f2a0683'
    },
    body: JSON.stringify({
      coordinates: destinationCoordinates,
      instructions: false,
      // maneuvers: true,
      // preference: "recommended",
      // preference: "shortest",
      // preference: "fastest",
    })
  }).then(response => {
    return response.json();
  }).then(result => {
    console.log(result)
    destinationCoordinates[destinationCoordinates.length - 1] = result.features[0].geometry.coordinates[result.features[0].geometry.coordinates.length - 1];
    const format = new GeoJSON();
    const newGeometry = format.readFeature(result.features[0].geometry, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857"
    });

    const totalLength = result.features[0].properties.summary.distance / 1000; // track-length in km
    const totalTime = result.features[0].properties.summary.duration;
    routeInfo.innerHTML = toRemainingString(totalLength, totalTime);

    routeLineString.setCoordinates(newGeometry.getGeometry().getCoordinates());
    endMarker.setCoordinates(fromLonLat(destinationCoordinates[destinationCoordinates.length - 1]));
  });
}

// OSRM routing
function routeMe() {
  const params = new URLSearchParams({
    geometries: 'geojson',
    overview: 'full',
    continue_straight: false,
    generate_hints: false,
    // skip_waypoints: true,
    steps: false,
  });
  fetch(`https://router.project-osrm.org/route/v1/driving/${destinationCoordinates.join(";")}?` + params).then(response => {
    return response.json();
  }).then(result => {
    console.log(result)
    destinationCoordinates[destinationCoordinates.length - 1] = result.waypoints[destinationCoordinates.length - 1].location;
    const format = new GeoJSON();
    const newGeometry = format.readFeature(result.routes[0].geometry, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857"
    });

    const totalLength = result.routes[0].distance / 1000; // track-length in km
    const totalTime = result.routes[0].duration;
    routeInfo.innerHTML = toRemainingString(totalLength, totalTime);

    routeLineString.setCoordinates(newGeometry.getGeometry().getCoordinates());
    endMarker.setCoordinates(fromLonLat(destinationCoordinates[destinationCoordinates.length - 1]));
  }).catch((error) => {
    setExtraInfo(["OSRM error:", error]);
    routeMeOSR();
  });
}

map.on("singleclick", function (evt) {
  if (evt.originalEvent.ctrlKey) {
    const coordinate = toLonLat(evt.coordinate).reverse();
    window.open(
      "http://maps.google.com/maps?q=&layer=c&cbll=" + coordinate,
      "_blank",
    );
  }
});

// right click/long press to route
map.on("contextmenu", function (event) {
  lastInteraction = Date.now();
  const eventLonLat = toLonLat(event.coordinate);
  // set start position
  destinationCoordinates[0] = lonlat;

  const clickedOnCurrentPosition =
    getDistance(lonlat, eventLonLat) < 200 ||
    getPixelDistance(event.pixel, map.getPixelFromCoordinate(currentPosition)) < 50;

  const clickedOnEndMarker = getPixelDistance(
    event.pixel,
    map.getPixelFromCoordinate(endMarker.getCoordinates())
  ) < 40;

  const clickedOnWaypoint =
    gpxSource.getClosestFeatureToCoordinate(
      event.coordinate,
      feature => {
        return feature.getGeometry().getType() === "Point" &&
          getPixelDistance(map.getPixelFromCoordinate(feature.getGeometry().getCoordinates()), event.pixel) < 40
      },
    );

  if (clickedOnCurrentPosition || (clickedOnEndMarker && destinationCoordinates.length <= 2)) {
    setExtraInfo([
      Math.round(getDistance(lonlat, eventLonLat)) +
      '<font class="infoFormat">M</font>',
    ]);
    endMarker.setCoordinates([]);
    routeLineString.setCoordinates([]);
    routeInfo.innerHTML = "";
    destinationCoordinates = [];
  } else if (clickedOnEndMarker) {
    destinationCoordinates.pop();
  } else if (clickedOnWaypoint) {
    setExtraInfo(["Navigerar till:", clickedOnWaypoint.get("name")]);
    destinationCoordinates.push(toLonLat(clickedOnWaypoint.getGeometry().getCoordinates()).splice(0, 2));
  } else {
    setExtraInfo([
      `<div class="equalSpace"><a href="http://maps.google.com/maps?q=${eventLonLat[1]},${eventLonLat[0]}" target="_blank">Gmap</a> <a href="http://maps.google.com/maps?layer=c&cbll=${eventLonLat[1]},${eventLonLat[0]}" target="_blank">Streetview</a></div>`,
    ]);
    destinationCoordinates.push(eventLonLat);
  }

  // start routing
  if (destinationCoordinates.length >= 2) {
    routeMe();
  }
});

// store time of last interaction
map.on("pointerdrag", function () {
  resetRotation();
  lastInteraction = Date.now();
});

// checks url parameters and loads gpx file from url:
const searchParams = new URLSearchParams(window.location.search);
if (searchParams.has("destinationPoints")) {
  const destinationPoints = JSON.parse(decodeURIComponent(searchParams.get("destinationPoints")));
  if (destinationPoints.length == 1) {
    destinationCoordinates[0] = lonlat;
    destinationCoordinates.push(destinationPoints[0]);
    routeMe();
  } else if (destinationPoints.length > 1) {
    destinationCoordinates = destinationPoints;
    routeMe();
  }
}

if (searchParams.has("destinationPoints64")) {
  const destinationPoints = JSON.parse(atob(searchParams.get("destinationPoints64")));
  if (destinationPoints.length == 1) {
    destinationCoordinates[0] = lonlat;
    destinationCoordinates.push(destinationPoints[0]);
    routeMe();
  } else if (destinationPoints.length > 1) {
    destinationCoordinates = destinationPoints;
    routeMe();
  }
}

if (searchParams.has("poiPoints")) {
  const poiPoints = JSON.parse(decodeURIComponent(searchParams.get("poiPoints")));
  for (let i = 0; i < poiPoints.length; i++) {
    const name = poiPoints[i][1];
    const coordinate = fromLonLat(poiPoints[i][0]);
    const marker = new Feature({
      geometry: new Point(coordinate),
      name: name,
    });
    gpxSource.addFeature(marker);
  }
}

if (searchParams.has("poiPoints64")) {
  const poiPoints = JSON.parse(decodeURIComponent(atob(searchParams.get("poiPoints64"))));
  for (let i = 0; i < poiPoints.length; i++) {
    const name = poiPoints[i][1];
    const coordinate = fromLonLat(poiPoints[i][0]);
    const marker = new Feature({
      geometry: new Point(coordinate),
      name: name,
    });
    gpxSource.addFeature(marker);
  }
}

if (searchParams.has("trackPoints")) {
  const trackPoints = JSON.parse(decodeURIComponent(searchParams.get("trackPoints")));
  const gpxLine = new Feature({
    geometry: new LineString(trackPoints),
  });
  gpxSource.addFeature(gpxLine);
}

if (searchParams.has("gpxFile")) {
  let gpxFile = searchParams.get("gpxFile");
  if (!gpxFile.includes("http")) {
    gpxFile = "https://jole84.se/rutter/" + gpxFile;
  }
  const titleString = decodeURIComponent(gpxFile.split("/").pop());
  setExtraInfo([titleString]);
  fetch("https://jole84.se/phpReadFile.php?url=" + gpxFile, { mode: "cors" })
    .then((response) => {
      return response.text();
    })
    .then((response) => {
      gpxSourceLoader(new File([response], gpxFile, { type: "application/gpx" }));
    });
}
switchMap();

// add keyboard controls
document.addEventListener("keydown", function (event) {
  if (menuDiv.checkVisibility()) {
    if (event.key == "Escape" || event.key == "§") {
      event.preventDefault();
      closeMenuButton.click();
    }
  } else {
    for (let i = 1; i < 8; i++) {
      if (event.key == i) {
        localStorage.mapMode = i - 1;
        switchMap();
      }
    }
    const zoomStep = 0.5;
    if (event.key != "a" && event.key != "Escape" && event.key != "§" && event.key != "Enter") {
      // store time of last interaction
      lastInteraction = Date.now();
    }
    if (event.key == "Enter") {
      event.preventDefault();
      if (document.getElementById("restoreTripButton").checkVisibility()) {
        restoreTrip();
      } else {
        if (Date.now() - lastInteraction > interactionDelay) {
          lastInteraction = Date.now();
          view.animate({
            rotation: 0,
            duration: 500,
          })
        } else {
          lastInteraction = Date.now() - interactionDelay;
          centerFunction();
        }
      }
    }
    if (event.key == "c") {
      event.preventDefault();
      centerFunction();
    }
    if (event.key == "v") {
      localStorage.mapMode = Number(localStorage.mapMode) + 1;
      switchMap();
    }
    if (event.key == "z") {
      view.adjustRotation(0.2);
    }
    if (event.key == "x") {
      view.adjustRotation(-0.2);
    }
    if (event.key == "n") {
      lastInteraction = Date.now();
      view.setRotation(0);
    }
    if (event.key == "d") {
      focusDestination();
    }
    if (event.key == "Escape" || event.key == "§") {
      event.preventDefault();
      // carpe iter adventure controller minus button
      if (view.getZoom() >= 17) {
        lastInteraction = Date.now();
      }
      view.adjustZoom(-zoomStep);
    }
    if (event.key == "a") {
      // carpe iter adventure controller plus button
      if (view.getZoom() >= 17) {
        lastInteraction = Date.now();
      }
      view.adjustZoom(zoomStep);
    }
    if (event.code == "Space") {
      event.preventDefault();
      focusTrafficWarning();
    }
    if (event.key == "r") {
      recalculateRoute();
    }
    resetRotation();
  }
});

const apiUrl = "https://api.trafikinfo.trafikverket.se/v2/data.json";

function resetRotation() {
  if (view.getZoom() < 11) {
    lastInteraction = Date.now();
    if (view.getRotation() != 0) {
      view.setRotation(0);
    }
  }
}
// <GTE name="Deviation.SeverityCode" value="2" /> 
function getDeviations() {
  let xmlRequest = `
    <REQUEST>
      <LOGIN authenticationkey='fa68891ca1284d38a637fe8d100861f0' />
      <QUERY objecttype='Situation' schemaversion='1.5'>
        <FILTER>
          <OR>
            <ELEMENTMATCH>
              <EQ name='Deviation.ManagedCause' value='true' />
              <EQ name='Deviation.MessageType' value='Olycka' />
              <GTE name='Deviation.EndTime' value='$now'/>
            </ELEMENTMATCH>
            <ELEMENTMATCH>
              <EQ name='Deviation.ManagedCause' value='true'/>
              <IN name='Deviation.MessageType' value='Trafikmeddelande,Traffic information'/>
              <GTE name='Deviation.EndTime' value='$now'/>
              <LTE name='Deviation.StartTime' value='$dateadd(0.01:00)'/>
            </ELEMENTMATCH>
          </OR>
        </FILTER>
        <INCLUDE>Deviation.Message</INCLUDE>
        <INCLUDE>Deviation.IconId</INCLUDE>
        <INCLUDE>Deviation.Geometry.Point.WGS84</INCLUDE>
        <INCLUDE>Deviation.RoadNumber</INCLUDE>
        <INCLUDE>Deviation.EndTime</INCLUDE>
        <INCLUDE>Deviation.MessageCode</INCLUDE>
      </QUERY>
    </REQUEST>
  `;
  fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
    },
    body: xmlRequest,
  })
    .then((response) => response.json())
    .then((result) => {
      try {
        trafficWarningSource.clear();
        const resultRoadSituation = result.RESPONSE.RESULT[0].Situation;
        resultRoadSituation.forEach(function (item) {
          const format = new WKT();
          const position = format
            .readGeometry(item.Deviation[0].Geometry.Point.WGS84)
            .transform("EPSG:4326", "EPSG:3857");
          const feature = new Feature({
            geometry: position,
            name:
              breakSentence(
                (item.Deviation[0].RoadNumber ? item.Deviation[0].RoadNumber + ": " : "") +
                (item.Deviation[0].Message || item.Deviation[0].MessageCode || "?"),
              ) +
              "\nSluttid: " +
              new Date(item.Deviation[0].EndTime).toLocaleString("sv-SE", { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }),
            roadNumber: item.Deviation[0].RoadNumber || "väg",
            iconId: item.Deviation[0].IconId,
            messageCode: item.Deviation[0].MessageCode || "Tillbud",
          });
          trafficWarningSource.addFeature(feature);
        });
        getClosestAccident();
      } catch (ex) {
        console.log(ex);
      }
    });
}

getDeviations();
setInterval(getDeviations, 60000); // getDeviations interval

function focusTrafficWarning() {
  lastInteraction = Date.now();
  if (closestAccident != undefined) {
    closestAccidentPosition = closestAccident.getGeometry().getCoordinates();
  } else {
    closestAccidentPosition = currentPosition;
  }
  const duration = 500;
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
    lastInteraction = Date.now();
    const coordinates = fromLonLat(
      destinationCoordinates[destinationCoordinates.length - 1],
    );

    const duration = 500;
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
  closestAccident = false;
  if (trafficWarningSource.getFeatures().length > 0) {
    const routeIsActive = routeLineString.getCoordinates().length > 0;
    let distanceToAccident = 0;
    if (routeIsActive) {
      const featureCoordinates = routeLineString.getCoordinates();
      const newMultiPoint = new MultiPoint(featureCoordinates);
      const newMultiPointCurrentPosition = newMultiPoint.getClosestPoint(currentPosition);
      const startIndex = findIndexOf(newMultiPointCurrentPosition, featureCoordinates);

      for (let i = startIndex; (i < featureCoordinates.length - 1) && !closestAccident; i++) {
        distanceToAccident += getDistance(
          toLonLat(featureCoordinates[i]),
          toLonLat(featureCoordinates[i + 1])
        )
        // addTestMarker(featureCoordinates[i], Math.round(distanceToAccident));

        closestAccident =
          trafficWarningSource.getClosestFeatureToCoordinate(featureCoordinates[i],
            function (feature) {
              return getDistance(
                toLonLat(feature.getGeometry().getCoordinates()),
                toLonLat(featureCoordinates[i])) < 200;
            },
          );
      }
    } else {
      closestAccident = trafficWarningSource.getClosestFeatureToCoordinate(
        currentPosition,
        function (feature) {
          return getDistance(
            toLonLat(feature.getGeometry().getCoordinates()),
            lonlat) < 30000;
        }
      );
      if (closestAccident) {
        distanceToAccident = getDistance(
          toLonLat(closestAccident.getGeometry().getCoordinates()),
          lonlat
        );
      }
    }

    if (!!closestAccident) {
      const closestAccidentRoadNumber = closestAccident.get("roadNumber");
      const messageCode = closestAccident.get("messageCode");

      trafficWarningDiv.innerHTML =
        messageCode + ", " +
        closestAccidentRoadNumber.replace(/^V/, "v") +
        " (" + Math.round(distanceToAccident / 1000) + "km)";
    } else {
      trafficWarningDiv.innerHTML = "";
    }
  } else {
    trafficWarningDiv.innerHTML = "";
  }
}

function recalculateRoute() {
  if (destinationCoordinates.length >= 2) {
    if (
      getDistance(
        lonlat,
        destinationCoordinates[destinationCoordinates.length - 1],
      ) < 1000
    ) {
      routeInfo.innerHTML = "";
      document.getElementById("extraInfo").innerHTML = "";
      destinationCoordinates = [];
      endMarker.setCoordinates([]);
      routeLineString.setCoordinates([]);
    } else {
      destinationCoordinates[0] = lonlat;
      routeMe();
    }
  }
}

document.getElementById("userName").value = localStorage.userName || "";
document.getElementById("userName").addEventListener("change", function () {
  if (document.getElementById("userName").value == "") {
    userLocationLayer.getSource().clear();
  }
  localStorage.userName = document.getElementById("userName").value.trim();
  updateUserPosition();
});

setInterval(updateUserPosition, 15000);
function updateUserPosition() {
  if (!!localStorage.userName) {
    const formData = new FormData();
    formData.append("userName", localStorage.userName);
    formData.append("timeStamp", Date.now());
    formData.append("x", Math.round(geolocation.getPosition()[0]));
    formData.append("y", Math.round(geolocation.getPosition()[1]));
    formData.append("heading", (heading).toFixed(2));
    formData.append("accuracy", Math.round(accuracy));
    formData.append("speed", Math.floor(speedKmh));
    fetch("https://jole84.se/locationHandler/sql-location-handler.php", {
      method: "POST",
      body: formData,
    }).then((response) => response.json())
      .then((userList) => {
        userLocationLayer.getSource().clear();
        for (let i = 0; i < userList.length; i++) {
          // add the other users
          const marker = new Feature({
            geometry: new Point([userList[i]["x"], userList[i]["y"]]),
            rotation: userList[i]["heading"],
            name: userList[i]["userName"]
              + (userList[i]["accuracy"] > 50 ? "\nOSÄKER POSITION! (" + userList[i]["accuracy"] + "m)" : "")
              + "\n" + msToTime(Date.now() - userList[i]["timeStamp"])
              + (userList[i]["speed"] < 100 ? userList[i]["speed"] : "??") + "km/h",
          });
          userLocationLayer.getSource().addFeature(marker);
        }
      }).catch((error) => {
        console.log(error)
      });
  }
}

function addTestMarker(coordinate, sourceLayer, name = "") {
  const marker = new Feature({
    geometry: new Point(coordinate),
    name: String(name),
  });
  sourceLayer.addFeature(marker);
}

let showTripPoints = false;
document.getElementById("tripPointButton").addEventListener("click", function () {
  showTripPoints = !showTripPoints;
  if (showTripPoints) {
    this.innerHTML = "Dölj spårpunktsdata";
    let totalDistance = 0;
    for (let i = 1; i < trackLog.length; i++) {
      const segmentDistanceM = getDistance(trackLog[i - 1][0], trackLog[i][0]);
      const segmentTimeMS = new Date(trackLog[i][2]) - new Date(trackLog[i - 1][2]);
      const speedKmh = (segmentDistanceM / segmentTimeMS) * 3600;
      totalDistance += segmentDistanceM;
      addTestMarker(
        fromLonLat(trackLog[i][0]),
        trackPointLayer.getSource(),
        String(
          new Date(trackLog[i][2]).toLocaleTimeString() + " " + Math.round(speedKmh) + "km/h\n" +
          (totalDistance / 1000).toFixed(1) + "km")
      );
    }
  } else {
    this.innerHTML = "Visa spårpunktsdata";
    trackPointLayer.getSource().clear();
  }
  menuDiv.style.display = "none";
});
