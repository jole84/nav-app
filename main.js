import "./style.css";
import { Feature, Map, View } from "ol";
import { fromLonLat, toLonLat } from "ol/proj.js";
import { getDistance } from "ol/sphere";
import { saveAs } from "file-saver";
import { Stroke, Style, Icon, Fill, Text } from "ol/style.js";
import { Vector as VectorLayer } from "ol/layer.js";
import Geolocation from "ol/Geolocation.js";
import { GPX, GeoJSON, KML } from "ol/format.js";
import LineString from "ol/geom/LineString";
import MultiPoint from "ol/geom/MultiPoint.js";
import OSM from "ol/source/OSM.js";
import Point from "ol/geom/Point.js";
import TileLayer from "ol/layer/Tile.js";
import TileWMS from "ol/source/TileWMS.js";
import VectorSource from "ol/source/Vector.js";
import WKT from "ol/format/WKT.js";
import XYZ from "ol/source/XYZ.js";

localStorage.interactionDelay = localStorage.interactionDelay || 10000;
localStorage.mapMode = localStorage.mapMode || 0;
const startTime = new Date();
let accuracy = 100;
let altitude = 0;
let center = JSON.parse(localStorage.navAppCenter || "[1700000, 8500000]");
let closestAccident;
let closestAccidentPosition;
let currentPosition = center;
let destinationCoordinates = [];
let distanceTraveled = 0;
let heading = 0;
let lastInteraction = new Date() - localStorage.interactionDelay;
let lonlat = toLonLat(currentPosition);
let maxSpeed = 0;
let prevLonlat;
let speed = 0;
let speedKmh = 0;
let timeOut;
let trackLog = [];
const centerButton = document.getElementById("centerButton");
const closeMenuButton = document.getElementById("closeMenu");
const customFileButton = document.getElementById("customFileButton");
const enableLntDiv = document.getElementById("enableLnt");
const infoGroup = document.getElementById("infoGroup");
const interactionDelayDiv = document.getElementById("interactionDelay");
const onUnloadDiv = document.getElementById("onUnload");
const openMenuButton = document.getElementById("openMenu");
const preferredFontSizeDiv = document.getElementById("preferredFontSize");
const prefferedZoomDiv = document.getElementById("prefferedZoom");
const routeInfo = document.getElementById("routeInfo");
const saveLogButton = document.getElementById("saveLogButton");
const trafficWarningDiv = document.getElementById("trafficWarning");

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
          ? '<div style="color:green;">laddar</div>'
          : '<div style="color:red;">laddar inte</div>',
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
trafficWarningDiv.addEventListener("click", focusTrafficWarning);
saveLogButton.onclick = saveLogButtonFunction;
document.getElementById("clickFileButton").onclick = function () {
  customFileButton.click();
};

infoGroup.addEventListener("dblclick", function () {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
});

// menu stuff
const menuDiv = document.getElementById("menuDiv");
if (
  localStorage.firstRun == undefined &&
  window.location === window.parent.location
) {
  menuDiv.style.display = "unset";
  localStorage.firstRun = false;
} else {
  menuDiv.style.display = "none";
}

enableLntDiv.checked = localStorage.enableLnt =
  localStorage.enableLnt == "true";
enableLntDiv.addEventListener("change", function () {
  localStorage.enableLnt = enableLntDiv.checked;
  location.reload();
});
if (JSON.parse(localStorage.enableLnt)) {
  const option4 = document.createElement("option");
  const option5 = document.createElement("option");
  option4.text = "Lantmäteriet Topo";
  option4.value = 4;
  option5.text = "Lantmäteriet Orto";
  option5.value = 5;
  layerSelector.add(option4);
  layerSelector.add(option5);
}

onUnloadDiv.checked = JSON.parse(localStorage.onUnload || "false");
onUnloadDiv.addEventListener("change", function () {
  localStorage.onUnload = onUnloadDiv.checked;
});
window.onbeforeunload = function () {
  localStorage.navAppCenter = JSON.stringify(currentPosition);
  if (
    onUnloadDiv.checked &&
    window.location === window.parent.location
  ) {
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

localStorage.defaultZoom = prefferedZoomDiv.value =
  localStorage.defaultZoom || 14;
prefferedZoomDiv.addEventListener("change", function () {
  localStorage.defaultZoom = prefferedZoomDiv.value;
  centerFunction();
});

interactionDelayDiv.value = localStorage.interactionDelay / 1000;
interactionDelayDiv.addEventListener("change", function () {
  localStorage.interactionDelay = interactionDelayDiv.value * 1000;
});

localStorage.preferredFontSize = preferredFontSizeDiv.value =
  localStorage.preferredFontSize || "20px";
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

function gpxStyleText(feature) {
  const featureType = feature.getGeometry().getType();
  if (featureType == "Point") {
    return new Style({
      text: new Text({
        text: feature.get("name"),
        font: "14px Roboto,monospace",
        placement: "line",
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
  }
}

function gpxStyle(feature) {
  const featureType = feature.getGeometry().getType();
  if (featureType == "Point") {
    return new Style({
      image: new Icon({
        anchor: [0.5, 1],
        src: "https://jole84.se/poi-marker.svg",
      }),
    });
  }

  if (featureType == "LineString") {
    return new Style({
      stroke: new Stroke({
        color: [0, 0, 255, 0.5],
        width: 10,
      }),
    });
  }

  if (featureType == "MultiLineString") {
    return new Style({
      stroke: new Stroke({
        color: [255, 0, 0, 0.5],
        width: 10,
      }),
    });
  }

  if (featureType == "Polygon" || featureType == "MultiPolygon") {
    return new Style({
      stroke: new Stroke({
        color: [255, 0, 0, 1],
        width: 5,
      }),
      fill: new Fill({
        color: [255, 0, 0, 0.2],
      }),
      text: new Text({
        text: feature.get("name"),
        font: "14px Roboto,monospace",
        overflow: true,
        fill: new Fill({
          color: "#b41412",
        }),
        stroke: new Stroke({
          color: "white",
          width: 4,
        }),
      }),
    });
  }
}

const trackStyle = {
  LineString: new Style({
    stroke: new Stroke({
      color: [255, 0, 0, 0.8],
      width: 4,
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

const trafficWarningTextStyleFunction = function (feature) {
  //Function to determine style of icons
  return [
    new Style({
      text: new Text({
        text: feature.get("name"),
        font: "bold 14px Roboto,monospace",
        textAlign: "center",
        textBaseline: "top",
        offsetY: 24,
        fill: new Fill({
          color: "yellow",
        }),
        stroke: new Stroke({
          // color: [238, 210, 2],
          color: "black",
          width: 4,
        }),
        // backgroundFill: new Fill({
        //   color: [252, 208, 30, 0.6],
        // }),
        // backgroundStroke: new Stroke({
        //   color: [238, 41, 61, 0.6],
        //   width: 3,
        // }),
        // padding: [2, 2, 2, 2],
      }),
    }),
  ];
};

const trafficWarningIconStyleFunction = function (feature) {
  //Function to determine style of icons
  return [
    new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        src:
          "https://api.trafikinfo.trafikverket.se/v2/icons/" +
          feature.get("iconId") +
          "?type=png32x32",
      }),
    }),
  ];
};

const line = new LineString([]);
const trackLine = new Feature({
  geometry: line,
});

const osm = new TileLayer({
  className: "saturated",
  source: new OSM(),
  visible: false,
});

// const osm = new MapboxVectorLayer({
//   styleUrl: "mapbox://styles/tryckluft/clqmovmf100pb01o9g1li1hxb",
//   accessToken : "pk.eyJ1IjoidHJ5Y2tsdWZ0IiwiYSI6ImNrcTU1YTIzeTFlem8yd3A4MXRsMTZreWQifQ.lI612CDqRgWujJDv6zlBqw",
// });

const slitlagerkarta = new TileLayer({
  source: new XYZ({
    url: "https://jole84.se/slitlagerkarta/{z}/{x}/{y}.jpg",
    minZoom: 6,
    maxZoom: 14,
  }),
  visible: false,
  useInterimTilesOnError: false,
});

const slitlagerkarta_nedtonad = new TileLayer({
  source: new XYZ({
    url: "https://jole84.se/slitlagerkarta_nedtonad/{z}/{x}/{y}.jpg",
    minZoom: 6,
    maxZoom: 14,
  }),
  visible: false,
  useInterimTilesOnError: false,
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
});

const trackLayer = new VectorLayer({
  source: new VectorSource({
    features: [trackLine],
  }),
  style: function (feature) {
    return trackStyle[feature.getGeometry().getType()];
  },
});

const routeLayer = new VectorLayer({
  source: new VectorSource(),
  style: function (feature) {
    return trackStyle[feature.get("type")];
  },
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

// creating the map
const map = new Map({
  layers: [
    slitlagerkarta,
    slitlagerkarta_nedtonad,
    osm,
    ortofoto,
    topoweb,
    gpxLayer,
    gpxLayerLabels,
    routeLayer,
    trackLayer,
    trafficWarningIconLayer,
    trafficWarningTextLayer,
  ],
  target: "map",
  view: view,
  keyboardEventTarget: document,
});

function getFileFormat(fileExtention) {
  if (fileExtention === "gpx") {
    return new GPX();
  } else if (fileExtention === "kml") {
    return new KML({ extractStyles: false });
  } else if (fileExtention === "geojson") {
    return new GeoJSON();
  }
}

// gpx loader
gpxSource.addEventListener("addfeature", function () {
  if (gpxSource.getState() === "ready") {
    const padding = 100;
    lastInteraction = new Date();
    view.setRotation(0);
    view.fit(gpxSource.getExtent(), {
      padding: [padding, padding, padding, padding],
      maxZoom: 15,
    });
  }
});

function gpxSourceLoader(gpxFile) {
  const reader = new FileReader();
  const fileExtention = gpxFile.name.split(".").pop().toLowerCase();
  const fileFormat = getFileFormat(fileExtention);
  reader.readAsText(gpxFile, "UTF-8");
  reader.onload = function (evt) {
    const gpxFeatures = fileFormat.readFeatures(evt.target.result, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });
    for (let i = 0; i < gpxFeatures.length; i++) {
      if (fileExtention == "gpx" && gpxFeatures[i].getGeometry().getType() == "LineString") {
        continue;
      } else if (gpxFeatures[i].getGeometry().getType() == "MultiLineString") {
        gpxSource.addFeature(new Feature({ geometry: gpxFeatures[i].getGeometry().getLineString() }));
      } else {
        gpxSource.addFeature(gpxFeatures[i]);
      }
    }
  };
}

// add selectFile options
var selectFile = document.getElementById("selectFile");
for (var i = 0; i < filesList.length; i++) {
  var opt = filesList[i];
  var el = document.createElement("option");
  el.textContent = opt;
  el.value = opt;
  selectFile.appendChild(el);
}

// selectFile in menu
selectFile.addEventListener("change", function () {
  gpxSource.clear();
  if (selectFile.value !== "välj gpxfil") {
    fetch("https://jole84.se/rutter/" + selectFile.value, { mode: "no-cors" })
      .then((response) => {
        return response.text();
      })
      .then((response) => {
        gpxSourceLoader(new File([response], selectFile.value, { type: "application/gpx" }));
        setExtraInfo([selectFile.value]);
      });
  } else {
    setExtraInfo([]);
  }
});

function handleFileSelect(evt) {
  gpxSource.clear();

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

// convert degrees to radians
function degToRad(deg) {
  return (deg * Math.PI * 2) / 360;
}

function getPixelDistance(pixel, pixel2) {
  return Math.sqrt(
    (pixel[1] - pixel2[1]) * (pixel[1] - pixel2[1]) +
    (pixel[0] - pixel2[0]) * (pixel[0] - pixel2[0]),
  );
}

// milliseconds to HH:MM:SS
function toHHMMSS(milliSecondsInt) {
  const dateObj = new Date(milliSecondsInt);
  const hours = dateObj.getUTCHours().toString().padStart(2, "0");
  const minutes = dateObj.getUTCMinutes().toString().padStart(2, "0");
  const seconds = dateObj.getSeconds().toString().padStart(2, "0");
  return hours + ":" + minutes + ":" + seconds;
}

// milliseconds to HH:MM
function toRemainingString(remainingDistance, secondsInt) {
  const totalMinutes = Math.floor(secondsInt / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ETA = new Date(new Date().getTime() + secondsInt * 1000);
  const ETAString =
    '<div style="text-align:right;">' +
    ETA.getHours() +
    ":" +
    ETA.getMinutes().toString().padStart(2, "0") +
    '<font class="infoFormat">ETA</font></div>';
  let returnString = `<div class="equalSpace"><div><font class="infoFormat">-></font> ${Number(remainingDistance).toFixed(1)}<font class="infoFormat">KM</font></div><div>`;
  if (hours > 0) {
    returnString += `${hours}<font class="infoFormat">H</font> `;
  }
  return (returnString +=
    `${minutes}<font class="infoFormat">MIN</font></div></div>` + ETAString);
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
  altitude = Math.round(geolocation.getAltitude() || 0);
  lonlat = toLonLat(currentPosition);
  const currentTime = new Date();
  if (currentTime - lastInteraction > localStorage.interactionDelay) {
    centerFunction();
  }
  getDeviations();

  trackLog.push([lonlat, altitude, currentTime]);
  line.appendCoordinate(currentPosition);

  prevLonlat = lonlat;
});

const accuracyFeature = new Feature();
geolocation.on('change:accuracyGeometry', function () {
  if (accuracy < 20) {
    accuracyFeature.setGeometry();
  } else {
    accuracyFeature.setGeometry(geolocation.getAccuracyGeometry());
  }
});

if (!!localStorage.trackLog) {
  document.getElementById("recallRouteButton").style.display = "unset";
}
document.getElementById("recallRouteButton").addEventListener("click", restoreRoute);
setTimeout(function () {document.getElementById("recallRouteButton").style.display = "none"}, 30000);

function restoreRoute () {
  // read old route from localStorage
  const oldRoute = JSON.parse(localStorage.trackLog);
  
  // restore line geometry
  line.setCoordinates([]);
  for (let i = 0; i < oldRoute.length; i++) {
    line.appendCoordinate(fromLonLat(oldRoute[i][0]));
    trackLog[i] = [oldRoute[i][0], oldRoute[i][1], new Date(oldRoute[i][2])];
  }
  
  // restore distanceTraveled
  distanceTraveled = 0;
  for (let i = 0; i < oldRoute.length - 1; i++) {
    distanceTraveled += getDistance(oldRoute[i][0], oldRoute[i + 1][0]);
  }
  document.getElementById("distanceTraveledDiv").innerHTML = (
    distanceTraveled / 1000
  ).toFixed(2);

  document.getElementById("recallRouteButton").style.display = "none";
  setExtraInfo(["Rutt återställd!"]);
}

document.getElementById("resetRoute").addEventListener("click", clearRoute);
function clearRoute() {
  distanceTraveled = 0;
  document.getElementById("distanceTraveledDiv").innerHTML = "0.00";
  line.setCoordinates([]);
  maxSpeed = 0;
  menuDiv.style.display = "none";
  setExtraInfo(["Rutt nollställd!"]);
  trackLog = [[lonlat, altitude, new Date()]];
  localStorage.removeItem("trackLog")
  // localStorage.trackLog = JSON.stringify(trackLog);
}

// runs when position changes
geolocation.on("change", function () {
  currentPosition = geolocation.getPosition();
  accuracy = geolocation.getAccuracy();
  heading = geolocation.getHeading() || 0;
  speed = geolocation.getSpeed() || 0;
  speedKmh = speed * 3.6;
  altitude = Math.round(geolocation.getAltitude() || 0);
  lonlat = toLonLat(currentPosition);
  const currentTime = new Date();
  positionMarkerPoint.setCoordinates(currentPosition);

  // measure distance and push log if position change > 10 meters and accuracy is good and more than 3 seconds
  if (
    getDistance(lonlat, trackLog[trackLog.length - 1][0]) > 10 &&
    accuracy < 25 &&
    currentTime - trackLog[trackLog.length - 1][2] > 3000
  ) {
    trackLog.push([lonlat, altitude, currentTime]);
    line.appendCoordinate(currentPosition);
    if (currentTime - startTime > 300000) {
      localStorage.trackLog = JSON.stringify(trackLog);
    }

    // recalculate route if > 300 m off route
    if (destinationCoordinates.length == 2) {
      const closestRoutePoint = routeLayer
        .getSource()
        .getFeatureById(0)
        .getGeometry()
        .getClosestPoint(currentPosition);
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
    if (currentTime - lastInteraction > localStorage.interactionDelay) {
      updateView();
    }
    distanceTraveled += getDistance(lonlat, prevLonlat);

    // calculate remaing distance on gpx
    routeInfo.innerHTML = "";
    gpxSource.forEachFeature(function (feature) {
      if (feature.getGeometry().getType() == "LineString") {
        const featureCoordinates = feature
          .getGeometry()
          .getCoordinates();
        const gpxRemainingDistance = getRemainingDistance(featureCoordinates);
        if (gpxRemainingDistance != undefined) {
          routeInfo.innerHTML += toRemainingString(
            gpxRemainingDistance,
            gpxRemainingDistance / (speedKmh / 60 / 60),
          );
        }
      }
    });

    // calculate remaing distance on route
    if (routeLayer.getSource().getFeatureById(0) != null) {
      const featureCoordinates = routeLayer
        .getSource()
        .getFeatureById(0)
        .getGeometry()
        .getCoordinates();
      const routeRemainingDistance = getRemainingDistance(featureCoordinates);
      if (routeRemainingDistance != undefined) {
        routeInfo.innerHTML += toRemainingString(
          routeRemainingDistance,
          routeRemainingDistance / (speedKmh / 60 / 60),
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
  document.getElementById("coordinatesDiv").innerHTML =
    lonlat[1].toFixed(5) + ", " + lonlat[0].toFixed(5);
  document.getElementById("distanceTraveledDiv").innerHTML = (
    distanceTraveled / 1000
  ).toFixed(2);
  document.getElementById("accuracyDiv").innerHTML = Math.round(accuracy);
  document.getElementById("speedDiv").innerHTML = Math.floor(speedKmh);
  document.getElementById("maxSpeedDiv").innerHTML = Math.floor(maxSpeed);
});

function getRemainingDistance(featureCoordinates) {
  const newMultiPoint = new MultiPoint(featureCoordinates.reverse());
  let remainingDistance = 0;
  const closestPoint = newMultiPoint.getClosestPoint(currentPosition);
  const distanceToClosestPoint = getDistance(toLonLat(closestPoint), lonlat);

  if (distanceToClosestPoint > 500) {
    return;
  } else {
    for (let i = 0; i < featureCoordinates.length - 1; i++) {
      if (
        featureCoordinates[i + 1].toString() !== closestPoint.toString() &&
        featureCoordinates[0].toString() !== closestPoint.toString()
      ) {
        remainingDistance += getDistance(
          toLonLat(featureCoordinates[i]),
          toLonLat(featureCoordinates[i + 1]),
        );
      } else {
        remainingDistance += getDistance(
          toLonLat(featureCoordinates[i]),
          lonlat,
        );
        break;
      }
    }
    return remainingDistance / 1000;
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
    lastInteraction = new Date() - localStorage.interactionDelay;
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

view.on("change:resolution", function () {
  document.getElementById("currentZoom").innerHTML = view.getZoom().toFixed(1);
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
  document.getElementsByTagName("body")[0].setAttribute(
    "style",
    "-webkit-filter: initial;filter: initial;background-color: initial;",
  );

  if (localStorage.enableLnt == "true" && localStorage.getItem("mapMode") > 5) {
    localStorage.setItem("mapMode", 0);
  }
  if (
    localStorage.enableLnt == "false" &&
    localStorage.getItem("mapMode") > 3
  ) {
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
    document.getElementsByTagName("body")[0].setAttribute("style", "filter: invert(1) hue-rotate(180deg);");
    if (JSON.parse(localStorage.enableLnt)) {
      topoweb.setVisible(true);
      slitlagerkarta_nedtonad.setMaxZoom(15.5);
      topoweb.setMinZoom(15.5);
      topoweb.setMaxZoom(20);
    }
  } else if (localStorage.getItem("mapMode") == 3) {
    // mapMode 3: Openstreetmap
    osm.setVisible(true);
  } else if (
    JSON.parse(localStorage.enableLnt) &&
    localStorage.getItem("mapMode") == 4
  ) {
    // mapMode 4: topoweb
    topoweb.setVisible(true);
    topoweb.setMinZoom(0);
    topoweb.setMaxZoom(20);
  } else if (
    JSON.parse(localStorage.enableLnt) &&
    localStorage.getItem("mapMode") == 5
  ) {
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
async function saveLog() {
  let gpxFile = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<gpx version="1.1" creator="Jole84 Nav-app">
<metadata>
  <desc>GPX log created by Jole84 Nav-app</desc>
  <time>${trackLog[0][2].toISOString()}</time>
</metadata>
<trk>
  <name>${trackLog[0][2].toLocaleString()}, max ${Math.floor(maxSpeed)} km/h, total ${(
      distanceTraveled / 1000
    ).toFixed(2)} km, ${toHHMMSS(new Date() - trackLog[0][2])}</name>
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

  const filename =
    trackLog[0][2].toLocaleString().replace(/ /g, "_").replace(/:/g, ".") + ".gpx";
  setExtraInfo(["Sparar fil:", filename]);

  let file = new Blob([gpxFile], { type: "application/gpx+xml" });

  // tries to share text file
  try {
    await navigator.share({
      files: [new File([gpxFile], filename + ".txt", { type: "text/plain" })],
    });
  } catch (error) {
    setExtraInfo([error]);
    saveAs(file, filename);
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
      routeInfo.innerHTML = toRemainingString(totalLength, totalTime);

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
    const coordinate = toLonLat(evt.coordinate).reverse();
    window.open(
      "http://maps.google.com/maps?q=&layer=c&cbll=" + coordinate,
      "_blank",
    );
  }
});

// right click/long press to route
map.on("contextmenu", function (event) {
  lastInteraction = new Date();
  const eventLonLat = toLonLat(event.coordinate);
  let closestWaypoint;

  // set start position
  destinationCoordinates[0] = lonlat;

  setExtraInfo([
    `<div class="equalSpace"><a href="http://maps.google.com/maps?q=${eventLonLat[1]},${eventLonLat[0]}" target="_blank">Gmap</a> <a href="http://maps.google.com/maps?layer=c&cbll=${eventLonLat[1]},${eventLonLat[0]}" target="_blank">Streetview</a></div`,
  ]);

  let clickedOnWaypoint = false;
  const clickedOnCurrentPosition =
    getDistance(lonlat, eventLonLat) < 200 ||
    getPixelDistance(event.pixel, map.getPixelFromCoordinate(currentPosition)) <
    50;
  const clickedOnLastDestination =
    getPixelDistance(
      event.pixel,
      map.getPixelFromCoordinate(
        fromLonLat(destinationCoordinates[destinationCoordinates.length - 1]),
      ),
    ) < 40;

  // check if clicked on a waypoint
  if (gpxSource.getFeatures().length > 0) {
    closestWaypoint = gpxSource.getClosestFeatureToCoordinate(
      event.coordinate,
      function (feature) {
        return feature.getGeometry().getType() === "Point";
      },
    );
    if (closestWaypoint != null) {
      clickedOnWaypoint =
        getPixelDistance(
          map.getPixelFromCoordinate(
            closestWaypoint.getGeometry().getCoordinates(),
          ),
          event.pixel,
        ) < 40;
    }
  }

  // measure distance from current pos
  if (clickedOnCurrentPosition) {
    setExtraInfo([
      Math.round(getDistance(lonlat, eventLonLat)) +
      '<font class="infoFormat">M</font>',
    ]);
  }

  // remove last point if click < 40 pixels from last point
  if (destinationCoordinates.length > 2 && clickedOnLastDestination) {
    destinationCoordinates.pop();
    // clear route if click < 40 pixels from last point or click on current position
  } else if (
    (destinationCoordinates.length == 2 && clickedOnLastDestination) ||
    clickedOnCurrentPosition
  ) {
    routeLayer.getSource().clear();
    routeInfo.innerHTML = "";
    destinationCoordinates = [];
  } else {
    // else push clicked coord to destinationCoordinates
    if (clickedOnWaypoint) {
      destinationCoordinates.push(
        toLonLat(closestWaypoint.getGeometry().getCoordinates()),
      );
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
  resetRotation();
  lastInteraction = new Date();
});

// checks url parameters and loads gpx file from url:
const urlParams = window.location.href.split("?").pop().split("&");
for (let i = 0; i < urlParams.length; i++) {
  console.log(decodeURIComponent(urlParams[i]));

  if (urlParams[i].includes("destinationPoints")) {
    // https://jole84.se/nav-app/index.html?destinationPoints=[[lon,lat]]
    const destinationPoints = JSON.parse(decodeURI(urlParams[i].split("=")[1]));
    if (destinationPoints.length == 1) {
      destinationCoordinates[0] = lonlat;
      destinationCoordinates.push(destinationPoints[0]);
      routeMe();
    } else if (destinationPoints.length > 1) {
      destinationCoordinates = destinationPoints;
      routeMe();
    }
  }

  if (urlParams[i].includes("trackPoints")) {
    const line = new LineString([]);
    const gpxLine = new Feature({
      geometry: line,
    });
    const trackPoints = JSON.parse(decodeURI(urlParams[i].split("=")[1]));
    for (let i = 0; i < trackPoints.length; i++) {
      const coordinate = fromLonLat(trackPoints[i]);
      line.appendCoordinate(coordinate);
    }
    gpxSource.addFeature(gpxLine);
  }

  if (urlParams[i].includes("poiPoints")) {
    const poiPoints = JSON.parse(decodeURI(urlParams[i].split("=")[1]));
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

  if (urlParams[i].includes(".gpx")) {
    if (!urlParams[i].includes("http")) {
      urlParams[i] = "https://jole84.se/rutter/" + urlParams[i];
    }
    const titleString = decodeURIComponent(urlParams[i].split("/").pop());
    setExtraInfo([titleString]);
    fetch(urlParams[i], { mode: "cors" })
      .then((response) => {
        return response.text();
      })
      .then((response) => {
        gpxSourceLoader(new File([response], urlParams[i], { type: "application/gpx" }));
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
    if (event.key == "Enter" && new Date() - startTime < 30000) {
      event.preventDefault();
      restoreRoute();
    }
    if (event.key == "c" || event.key == "Enter") {
      event.preventDefault();
      centerFunction();
    }
    if (event.key == "v") {
      localStorage.setItem(
        "mapMode",
        Number(localStorage.getItem("mapMode")) + 1,
      );
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
    resetRotation();
  } else {
    if (event.key == "Escape" || event.key == "§") {
      closeMenuButton.click();
    }
  }
});

function breakSentence(sentence) {
  sentence = sentence.replaceAll(".:", ":").replaceAll("\n", "").trim();
  let returnSentence = "";
  let x = 0;
  for (let i = 0; i < sentence.length; i++) {
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

const apiUrl = "https://api.trafikinfo.trafikverket.se/v2/data.json";

function resetRotation() {
  if (view.getRotation() != 0 && view.getZoom() < 11) {
    view.setRotation(0);
  }
}

function getDeviations() {
  let xmlRequest = `
    <REQUEST>
      <LOGIN authenticationkey='fa68891ca1284d38a637fe8d100861f0' />
      <QUERY objecttype='Situation' schemaversion='1.2'>
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
              <GTE name="Deviation.SeverityCode" value="2" />
            </ELEMENTMATCH>
          </OR>
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
            .readGeometry(item.Deviation[0].Geometry.WGS84)
            .transform("EPSG:4326", "EPSG:3857");
          const feature = new Feature({
            geometry: position,
            name:
              breakSentence(
                (
                  item.Deviation[0].LocationDescriptor ||
                  item.Deviation[0].RoadNumber ||
                  "Väg"
                ).trim() +
                ": " +
                (item.Deviation[0].Message || "-"),
              ) +
              "\n" +
              new Date(item.Deviation[0].EndTime).toLocaleString().slice(0, -3),
            roadNumber: item.Deviation[0].RoadNumber || "väg",
            iconId: item.Deviation[0].IconId,
            locationDescriptor: item.Deviation[0].LocationDescriptor,
          });
          trafficWarningSource.addFeature(feature);
        });
        getClosestAccident();
      } catch (ex) {
        console.log(ex);
      }
    });
}

setInterval(getDeviations, 60000); // getDeviations interval

function focusTrafficWarning() {
  lastInteraction = new Date();
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
    zoom: 10.5,
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
  if (trafficWarningSource.getFeatures().length >= 1) {
    closestAccident = trafficWarningSource.getClosestFeatureToCoordinate(
      currentPosition,
      function (feature) {
        return feature.get("iconId") === "roadAccident";
      },
    );
  }

  if (closestAccident != undefined) {
    // check route for accidents
    let routeHasAccident = false;
    const routeIsActive = routeLayer.getSource().getFeatureById(0) != undefined;
    if (routeIsActive) {
      const featureCoordinates = routeLayer
        .getSource()
        .getFeatureById(0)
        .getGeometry()
        .getCoordinates();
      const newMultiPoint = new MultiPoint(featureCoordinates.reverse());

      const newLineStringclosestPoint =
        newMultiPoint.getClosestPoint(currentPosition);

      for (let i = 0; i < featureCoordinates.length; i++) {
        const closestLineStringPoint =
          trafficWarningSource.getClosestFeatureToCoordinate(
            featureCoordinates[i],
            function (feature) {
              return feature.get("iconId") === "roadAccident";
            },
          );
        const closestLineStringPointDistance = getDistance(
          toLonLat(closestLineStringPoint.getGeometry().getCoordinates()),
          toLonLat(featureCoordinates[i]),
        );
        if (closestLineStringPointDistance < 500) {
          routeHasAccident = true;
          closestAccident = closestLineStringPoint;
        }
        if (
          featureCoordinates[i].toString() ===
          newLineStringclosestPoint.toString()
        ) {
          break;
        }
      }
    }

    const closestAccidentRoadNumber = closestAccident.get("roadNumber");
    const closestAccidentCoords = closestAccident
      .getGeometry()
      .getCoordinates();
    const closestAccidentDistance = getDistance(
      toLonLat(closestAccidentCoords),
      lonlat,
    );

    if (
      (closestAccidentDistance < 30000 && !routeIsActive) ||
      routeHasAccident
    ) {
      trafficWarningDiv.innerHTML =
        "Olycka " +
        closestAccidentRoadNumber.replace(/^V/, "v") +
        " (" +
        Math.round(closestAccidentDistance / 1000) +
        "km)";
    } else {
      closestAccident = null;
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
      routeLayer.getSource().clear();
    } else {
      destinationCoordinates = [
        lonlat,
        destinationCoordinates[destinationCoordinates.length - 1],
      ];
      routeMe();
    }
  }
}
