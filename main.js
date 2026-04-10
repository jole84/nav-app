import "./style.css";
import { Feature, Map, View } from "ol";
import { fromLonLat, toLonLat } from "ol/proj.js";
import { GeoJSON, GPX } from "ol/format.js";
import { getDistance, getLength } from "ol/sphere";
import { Style, Icon } from "ol/style.js";
import { styleStuff } from "https://jole84.se/styleTileFunctions.js"
import { Vector as VectorLayer } from "ol/layer.js";
import Geolocation from "ol/Geolocation.js";
import KeyboardZoom from 'ol/interaction/KeyboardZoom.js';
import LineString from "ol/geom/LineString";
import { MultiLineString } from "ol/geom.js";
import MultiPoint from "ol/geom/MultiPoint.js";
import MVT from 'ol/format/MVT.js';
import OSM from "ol/source/OSM.js";
import Point from "ol/geom/Point.js";
import Polyline from 'ol/format/Polyline.js';
import TileLayer from "ol/layer/Tile.js";
import TileWMS from "ol/source/TileWMS.js";
import VectorSource from "ol/source/Vector.js";
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import WKT from "ol/format/WKT.js";
import XYZ from "ol/source/XYZ.js";
import {
  trafficWarningTextStyleFunction,
  trafficWarningIconStyleFunction,
  gpxStyleText,
  gpxStyle,
  trackStyle,
  userLocationStyle,
  routeStyle,
  styleRoadCondition,
} from "./styleFuntions.js";
import {
  createOSRMTurnHint,
  translateArray,
  getPixelDistance,
  breakSentence,
  msToTime,
  getRemainingDistance,
  clearRouteInfo,
  fileFormats,
  findIndexOf,
} from "./modules.js";

localStorage.mapMode = localStorage.mapMode || 0;
const center = JSON.parse(localStorage.lastPosition || "[1600000, 8000000]");
const centerButton = document.getElementById("centerButton");
const closeMenuButton = document.getElementById("closeMenuButton");
const customFileButton = document.getElementById("customFileButton");
const infoGroup = document.getElementById("infoGroup");
const interactionDelay = 15000;
const menuDiv = document.getElementById("menuDiv");
const loadGpxMenu = document.getElementById("loadGpxMenu");
const openMenuButton = document.getElementById("openMenu");
const preferredFontSizeDiv = document.getElementById("preferredFontSize");
const prefferedZoomDiv = document.getElementById("prefferedZoom");
const saveLogButton = document.getElementById("saveLogButton");
const selectFile = document.getElementById("selectFile");
const pageLoadTime = Date.now();
const trafficWarningDiv = document.getElementById("trafficWarning");
const tripPointButton = document.getElementById("tripPointButton");

let accuracy = 5000;
let altitude = 0;
let closestAccident;
let closestAccidentPosition;
let currentPosition = center;
let distanceTraveled = 0;
let heading = 0;
let lastInteraction = Date.now() - interactionDelay;
let lonlat = toLonLat(currentPosition);
let maxSpeed = 0;
let prevLonlat;
let speed = 0;
let speedKmh = 0;
let timeOut;
let navigationSteps = [];

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("TrackLogDB", 1);

    request.onupgradeneeded = event => {
      const db = event.target.result;
      db.createObjectStore("log", { keyPath: "id", autoIncrement: true });
    };

    request.onsuccess = event => resolve(event.target.result);
    request.onerror = () => reject("Failed to open DB");
  });
}

const trackLog = {
  db: null,
  ready: null,

  async init() {
    this.ready = openDB().then(db => {
      this.db = db;
    });

    return this.ready;
  },

  async push(logItem) {
    await this.ready;
    const tx = this.db.transaction("log", "readwrite");
    const store = tx.objectStore("log");

    const entry = {
      coordinates: logItem[0],
      altitude: logItem[1],
      timestamp: logItem[2]
    };

    store.add(entry);
    return tx.complete;
  },

  async deleteOlderThan(timestamp) {
    await this.ready;
    const tx = this.db.transaction("log", "readwrite");
    const store = tx.objectStore("log");

    return new Promise(resolve => {
      const req = store.openCursor();

      req.onsuccess = e => {
        const cursor = e.target.result;
        if (!cursor) {
          resolve();
          return;
        }

        const entry = cursor.value;
        if (entry.timestamp < timestamp) {
          cursor.delete();
        }
        cursor.continue();
      };
    });
  },

  async getAllRaw() {
    return new Promise(resolve => {
      const tx = this.db.transaction("log", "readonly");
      const store = tx.objectStore("log");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
    });
  },

  async clear() {
    const tx = this.db.transaction("log", "readwrite");
    const store = tx.objectStore("log");
    store.clear();
    return tx.complete;
  }

  // unused functions
  //   async hasOlderThan(timestamp) {
  //   await this.ready;
  //   const tx = this.db.transaction("log", "readonly");
  //   const store = tx.objectStore("log");

  //   return new Promise(resolve => {
  //     const req = store.openCursor();

  //     req.onsuccess = e => {
  //       const cursor = e.target.result;
  //       if (!cursor) {
  //         resolve(false);
  //         return;
  //       }

  //       if (cursor.value.timestamp < timestamp) {
  //         resolve(true);
  //         return;
  //       }

  //       cursor.continue();
  //     };
  //   });
  // },
  // async pop() {
  //   await this.ready;
  //   const last = await this.getLastRaw();
  //   if (!last) return;

  //   const tx = this.db.transaction("log", "readwrite");
  //   tx.objectStore("log").delete(last.id);
  //   return tx.complete;
  // },

  // async getLength() {
  //   await this.ready;
  //   return new Promise(resolve => {
  //     const tx = this.db.transaction("log", "readonly");
  //     const store = tx.objectStore("log");
  //     const req = store.count();
  //     req.onsuccess = () => resolve(req.result);
  //   });

  // },

  // async getItem(index) {
  //   await this.ready;
  //   const all = await this.getAllRaw();
  //   const item = all[index];
  //   if (!item) return null;

  //   return {
  //     coordinates: item.coordinates,
  //     altitude: item.altitude,
  //     timeStamp: item.timestamp
  //   };
  // },

  // async getFirstItem() {
  //   await this.ready;
  //   return this.getItem(0);
  // },

  // async getLastItem() {
  //   await this.ready;
  //   const len = await this.getLength();
  //   return this.getItem(len - 1);
  // },

  // async getLastRaw() {
  //   return new Promise(resolve => {
  //     const tx = this.db.transaction("log", "readonly");
  //     const store = tx.objectStore("log");

  //     // Open cursor in reverse order
  //     const req = store.openCursor(null, "prev");
  //     req.onsuccess = () => resolve(req.result?.value || null);
  //   });
  // },

};

trackLog.init().then(() => {
  checkIfOlderExists();
});

async function checkIfOlderExists() {
  let oldRoute = await trackLog.getAllRaw();
  oldRoute = oldRoute.filter(element => element.timestamp >= pageLoadTime - (24 * 60 * 60 * 1000));
  const olderExists = oldRoute.length > 10;
  if (olderExists) {
    document.getElementById("restoreTripButton").style.display = "unset";
  }
}

setTimeout(async () => {
  if (!window.userChoseRestore) {
    await trackLog.deleteOlderThan(pageLoadTime);
    console.log("Old entries removed automatically");
  }
}, 5 * 60 * 1000);

const destinationCoordinates = {
  coordinates: [],

  push(coordinate) {
    this.coordinates.push(coordinate);
  },

  pop() {
    this.coordinates.pop();
  },

  clear() {
    this.coordinates = [];
  },

  list() {
    return this.coordinates;
  },

  getLength() {
    return this.coordinates.length;
  },

  updateFirst(coordinate) {
    this.coordinates[0] = coordinate;
  },

  updateLast(coordinate) {
    this.coordinates[this.coordinates.length - 1] = coordinate;
  },

  getLastCoordinate() {
    return fromLonLat(this.coordinates[this.coordinates.length - 1]);
  },

  getLastLonLat() {
    return this.coordinates[this.coordinates.length - 1];
  },
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
          ? '<div style="color:green;">🔋 laddar batteri 🔋</div>'
          : '<div style="color:red;">⚠ laddare urkopplad ⚠</div>',
      ]);
    };
  });
}
setExtraInfo([
  '<div style="font-size: 0.4em;">Build: INSERTDATEHERE</div>',
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
tripPointButton.addEventListener("click", showTripLayer);
saveLogButton.onclick = saveLog;
trafficWarningDiv.onclick = focusTrafficWarning;
document.getElementById("clearTripButton").onclick = clearTrip;
document.getElementById("restoreTripButton").onclick = restoreTrip;
document.getElementById("clickFileButton").onclick = () => customFileButton.click();
setTimeout(function () { document.getElementById("restoreTripButton").style.display = "none" }, 30 * 1000);

infoGroup.addEventListener("dblclick", toggleFullscreen);
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

infoGroup.addEventListener("click", function () {
  setExtraInfo([
    `${altitude}<font class="infoFormat">möh</font>`,
  ]);
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
  menuDiv.classList.add("invisible");
};

document.getElementById("closeloadGpxMenu").onclick = function () {
  loadGpxMenu.classList.add("invisible");
};

document.getElementById("clearGpxSourceButton").onclick = function () {
  gpxSource.clear();
  selectedUpload = "";
  selectFile.value = "0"
  selectUpload.value = "0";
};

document.getElementById("loadGpxMenuButton").onclick = function () {
  if (loadGpxMenu.checkVisibility()) {
    loadGpxMenu.classList.add("invisible");
  } else {
    loadGpxMenu.classList.remove("invisible");
    if (localStorage.getItem("token")) {
      showApp(localStorage.getItem("username"));
    }
    loadData();
  }
  document.getElementById("loadGpxMenuButton").blur();
};

openMenuButton.onclick = function () {
  menuDiv.style.display = menuDiv.checkVisibility() ? menuDiv.classList.add("invisible") : menuDiv.classList.remove("invisible");
  openMenuButton.blur();
};

document.getElementById("clearSettings").onclick = function () {
  if (confirm("Radera inställningar?")) {
    indexedDB.deleteDatabase("TrackLogDB");
    localStorage.clear();
    location.reload();
  }
};

localStorage.defaultZoom = prefferedZoomDiv.value =
  localStorage.defaultZoom || 14;
prefferedZoomDiv.addEventListener("change", function () {
  localStorage.defaultZoom = prefferedZoomDiv.value || 14;
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
  zoom: localStorage.defaultZoom,
  minZoom: 6,
  maxZoom: 20,
  constrainRotation: false,
});

const trackLineString = new LineString([]);

const osm = new TileLayer({
  // className: "saturated",
  // source: new OSM(),
  source: new OSM({
    url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
    maxZoom: 17,
  }),
  visible: false,
});

const jole84TileLayer = new VectorTileLayer({
  source: new VectorTileSource({
    format: new MVT(),
    url: 'https://jole84.se/tiles/{z}/{x}/{y}.pbf',
    // url: "https://jole84.se/phpReadFile.php?url=" + 'https://jole84.se/tiles/{z}/{x}/{y}.pbf',
    // transition: 0,
    minZoom: 6,
    maxZoom: 14,
  }),
  style: (feature, currentResolution) => styleStuff(feature, currentResolution, localStorage.mapMode),
  declutter: true,
  // updateWhileAnimating: true,
  // updateWhileInteracting: true,
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
  minZoom: 7,
});

const trafficWarningTextLayer = new VectorLayer({
  source: trafficWarningSource,
  style: trafficWarningTextStyleFunction,
  minZoom: 15,
});

const roadConditionLayer = new VectorLayer({
  source: new VectorSource(),
  style: styleRoadCondition,
  maxZoom: 11,
})

const trackPointLayer = new VectorLayer({
  source: new VectorSource(),
  style: gpxStyleText,
  declutter: true,
  visible: false,
});

const map = new Map({
  layers: [
    jole84TileLayer,
    osm,
    ortofoto,
    topoweb,
    roadConditionLayer,
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
  const fileExtention = gpxFile.name.toLowerCase().replace(".gpx.txt", ".gpx").replace(".kml.xml", ".kml").split(".").pop();
  const fileFormat = fileFormats[fileExtention];
  reader.readAsText(gpxFile, "UTF-8");
  reader.onload = function (evt) {
    const gpxFeatures = fileFormat.readFeatures(evt.target.result, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });

    for (const gpxFeature of gpxFeatures) {
      // loads gpx track to trackLog for testing
      if (gpxFeature.getGeometry().getType() == "MultiLineString" && localStorage.testing) {
        setExtraInfo(["testing mode active"]);
        gpxFeature.getGeometry().getLineString().getCoordinates().forEach(coordinate => {
          trackLog.push([toLonLat(coordinate).slice(0, 2), coordinate[2], coordinate[3] * 1000]);
        })
      }
      if (gpxFeature.get("routePointMarker")) {
        gpxFeature.set("name", (gpxFeature.getId() + 1));
      }
      gpxSource.addFeature(gpxFeature);
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
    setExtraInfo(["filesList error:", err]);
    console.log('error: ' + err);
  });

// load gpx file from selectFile in menuDiv
selectFile.addEventListener("change", function () {
  gpxSource.clear();
  console.log(selectFile.value)
  if (selectFile.value !== "välj gpxfil") {
    fetch("https://jole84.se/phpReadFile.php?url=" + selectFile.value, { mode: "cors" })
      .then((response) => response.text())
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

let lastTimestamp = Date.now();
// runs when position changes
geolocation.on("change", async function () {
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
    getDistance(lonlat, prevLonlat) > 5 &&
    accuracy < 25 &&
    currentTime - lastTimestamp > 3000
  ) {
    if (tripPointButton.checked) {
      addTripPoint(lonlat, prevLonlat, altitude, distanceTraveled, currentTime, lastTimestamp)
    }
    lastTimestamp = currentTime;
    prevLonlat = lonlat;
    trackLog.push([lonlat, altitude, currentTime]);
    trackLineString.appendCoordinate(currentPosition);

    // recalculate route if > 300 m off route
    if (destinationCoordinates.getLength() == 2) {
      const closestRoutePoint = routeLineString.getClosestPoint(currentPosition);
      if (getDistance(lonlat, toLonLat(closestRoutePoint)) > 300) {
        destinationCoordinates.updateFirst(lonlat);
        routeMe();
      }
    }
  }

  if (speed > 1) {
    // change marker if speed
    positionMarker.getStyle().getImage().setRotation(heading);

    // change view if no interaction occurred last 15 seconds
    if (currentTime - lastInteraction > interactionDelay) {
      updateView();
    }
    distanceTraveled = getLength(trackLineString);

    let gpxGeometry;
    gpxSource.forEachFeature(function (feature) {
      const featureType = feature.getGeometry().getType();
      if (featureType == "LineString" || featureType == "MultiLineString") {
        gpxGeometry = featureType == "MultiLineString" ? feature.getGeometry().getLineString() : feature.getGeometry();
      }
    });

    try {
      getRemainingDistance(
        gpxGeometry || routeLineString,
        speedKmh,
        navigationSteps,
        currentPosition
      );
    } catch (error) {
      setExtraInfo([error]);
    }
  }

  if (speedKmh > maxSpeed && accuracy < 25) {
    maxSpeed = speedKmh;
  }

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

map.addLayer(
  new VectorLayer({
    source: new VectorSource({
      features: [positionMarker],
    }),
  }),
);

positionMarker.setStyle(
  new Style({
    image: new Icon({
      src: "https://jole84.se/images/geolocation_marker.svg",
      color: "rgba(0, 255, 0, 0.8)",
      rotateWithView: true,
    }),
  }),
);

async function restoreTrip() {
  window.userChoseRestore = true;
  const oldRoute = await trackLog.getAllRaw();
  trackLineString.setCoordinates(oldRoute.map(coordinate => fromLonLat(coordinate.coordinates)));
  trackLineString.appendCoordinate(currentPosition);

  document.getElementById("restoreTripButton").style.display = "none";
  setExtraInfo(["Tripp återställd"]);

  distanceTraveled = getLength(trackLineString);
  document.getElementById("distanceTraveledDiv").innerHTML = (
    distanceTraveled / 1000
  ).toFixed(2);
}

function clearTrip() {
  distanceTraveled = 0;
  document.getElementById("distanceTraveledDiv").innerHTML = "0.00";
  document.getElementById("restoreTripButton").style.display = "none";
  trackLineString.setCoordinates([]);
  localStorage.removeItem("trackLog");
  maxSpeed = 0;
  menuDiv.classList.add("invisible");
  setExtraInfo(["Tripp nollställd"]);
  trackLog.clear();
  trackLog.push([lonlat, altitude, Date.now()]);
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
  jole84TileLayer.setVisible(false);
  ortofoto.setVisible(false);
  topoweb.setVisible(false);
  osm.setVisible(false);
  document.body.classList.remove("darkMode");

  if (localStorage.mapMode > 5) {
    localStorage.mapMode = 0;
  }

  layerSelector.value = localStorage.mapMode;

  if (localStorage.mapMode == 0) {
    // mapMode 0: MVT Tärräng
    jole84TileLayer.setVisible(true);
    jole84TileLayer.getSource().refresh({ force: true });
    ortofoto.setVisible(true);
    jole84TileLayer.setMaxZoom(17);
    ortofoto.setMinZoom(17);
  } else if (localStorage.mapMode == 1) {
    // mapMode 1: MVT Vägkarta
    jole84TileLayer.setVisible(true);
    jole84TileLayer.getSource().refresh({ force: true });
    topoweb.setVisible(true);
    ortofoto.setVisible(true);
    jole84TileLayer.setMaxZoom(16);
    topoweb.setMinZoom(16);
    topoweb.setMaxZoom(17.5);
    ortofoto.setMinZoom(17.5);
  } else if (localStorage.mapMode == 2) {
    // mapMode 2: MVT Vägkarta + night mode
    document.body.classList.add("darkMode");
    jole84TileLayer.setVisible(true);
    jole84TileLayer.getSource().refresh({ force: true });
    jole84TileLayer.setMaxZoom(20);
  } else if (localStorage.mapMode == 3) {
    // mapMode 3: Openstreetmap
    osm.setVisible(true);
  } else if (localStorage.mapMode == 4) {
    // mapMode 4: topoweb
    topoweb.setVisible(true);
    topoweb.setMinZoom(0);
    topoweb.setMaxZoom(20);
  } else if (localStorage.mapMode == 5) {
    // mapMode 5: orto
    ortofoto.setVisible(true);
    ortofoto.setMinZoom(0);
  }
  infoGroup.style.fontSize = localStorage.preferredFontSize;
}

// new saveLog function
async function saveLog() {
  let oldRoute = await trackLog.getAllRaw();
  if (!window.userChoseRestore) oldRoute = oldRoute.filter(element => element.timestamp >= pageLoadTime);
  const filename = new Date(oldRoute[0].timestamp).toLocaleString().replace(/ /g, "_").replace(/:/g, ".") + "_" + (distanceTraveled / 1000).toFixed(2) + "km.gpx";

  oldRoute = oldRoute.map(coordinate => ([coordinate.coordinates[0], coordinate.coordinates[1], coordinate.altitude || 1, coordinate.timestamp / 1000]));

  const gpxFile = new GPX().writeFeatures([new Feature({ geometry: new MultiLineString([oldRoute]) })]);
  let blob = new Blob([gpxFile], { type: "application/gpx+xml" });

  // tries to share text file
  if (window.showSaveFilePicker) {
    saveFile(blob, filename);
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

async function saveFile(data, filename) {
  // create a new handle
  const newHandle = await window.showSaveFilePicker({ suggestedName: filename });

  // create a FileSystemWritableFileStream to write to
  const writableStream = await newHandle.createWritable();

  // write our file
  await writableStream.write(data);

  // close the file and write the contents to disk.
  await writableStream.close();

  alert("GPX sparad!");
}

function setExtraInfo(infoText) {
  window.clearTimeout(timeOut);
  const extraInfo = infoText.join("<br>");
  document.getElementById("extraInfo").innerHTML = extraInfo;
  timeOut = setTimeout(function () {
    document.getElementById("extraInfo").innerHTML = "";
  }, 10000);
}

function routeMe() {
  try {
    routeMeGoogle();
    // routeMeOSRM(); // default router
  } catch (error) {
    routeMeOSR(); // backup router
    setExtraInfo(["OSRM error:", error]);
  }
}

// OSRM routing
async function routeMeOSRM() {
  const requsetParams = new URLSearchParams({
    geometries: 'geojson',
    overview: 'full',
    continue_straight: false,
    generate_hints: false,
    // skip_waypoints: true,
    steps: true,
  });

  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${destinationCoordinates.list().join(";")}?` + requsetParams);
  const result = await response.json();
  destinationCoordinates.updateLast(result.waypoints[destinationCoordinates.getLength() - 1].location);
  const format = new GeoJSON();
  const newGeometry = format.readFeature(result.routes[0].geometry, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857"
  });


  // adding navigationSteps
  navigationSteps = [];
  const newMultiPoint = new MultiPoint(newGeometry.getGeometry().getCoordinates());
  result.routes[0].legs.forEach(leg => {
    leg.steps.filter(element => !["arrive", "depart", "new name"].includes(element.maneuver.type)).forEach(step => {
      const newStep = {};
      const closestPoint = newMultiPoint.getClosestPoint(fromLonLat(step.maneuver.location))
      newStep["stepIndex"] = findIndexOf(closestPoint, newGeometry.getGeometry().getCoordinates());
      newStep["message"] = step.destinations || step.name || "";
      newStep["maneuverType"] = createOSRMTurnHint(step);
      navigationSteps.push(newStep);
    })
  });

  // last step, arriving
  navigationSteps.push({
    stepIndex: newMultiPoint.getCoordinates().length,
    message: "Ankomst",
    maneuverType: translateArray["arrive"],
  })

  getRemainingDistance(
    newGeometry.getGeometry(),
    speedKmh,
    navigationSteps,
    currentPosition
  );

  routeLineString.setCoordinates(newGeometry.getGeometry().getCoordinates());
  endMarker.setCoordinates(destinationCoordinates.getLastCoordinate());
}

// Open Route Service routing
async function routeMeOSR() {
  const requestParams = {
    method: "post",
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
      'Authorization': '5b3ce3597851110001cf62482ba2170071134e8a80497f7f4f2a0683'
    },
    body: JSON.stringify({
      coordinates: destinationCoordinates.list(),
      instructions: false,
      // maneuvers: true,
      // preference: "recommended",
      // preference: "shortest",
      // preference: "fastest",
    })
  };

  const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car/geojson?`, requestParams);
  const result = await response.json();
  navigationSteps = [];

  console.log(result);
  destinationCoordinates.updateLast(result.features[0].geometry.coordinates[result.features[0].geometry.coordinates.length - 1]);
  const format = new GeoJSON();
  const newGeometry = format.readFeature(result.features[0].geometry, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857"
  });

  // const totalLength = result.features[0].properties.summary.distance / 1000; // track-length in km
  // const totalTime = result.features[0].properties.summary.duration;
  getRemainingDistance(
    newGeometry.getGeometry(),
    speedKmh,
    [],
    currentPosition
  );

  routeLineString.setCoordinates(newGeometry.getGeometry().getCoordinates());
  endMarker.setCoordinates(destinationCoordinates.getLastCoordinate());
}

async function routeMeGoogle() {
  const points = destinationCoordinates.list().map(element => ({ longitude: element[0], latitude: element[1] }));
  const origin = { location: { latLng: points[0] } };
  const destination = { location: { latLng: points[points.length - 1] } };
  const intermediates = points.slice(1, -1).map(p => ({ location: { latLng: p } }));

  const FieldMask = 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.startLocation'

  const requestBody = {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': FieldMask,
    },
    body: JSON.stringify({
      origin,
      destination,
      intermediates,
      travelMode: 'DRIVE',
      // routingPreference: 'TRAFFIC_AWARE',
      routingPreference: 'TRAFFIC_UNAWARE',
      units: 'METRIC',
      languageCode: 'sv-SE',
      routeModifiers: {
        // avoidTolls: true,
        // avoidFerries: true,
        avoidHighways: false,
      },
    }),
  };

  // return;
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', requestBody);
  const result = await response.json();
  console.log(result);

  const format = new Polyline();
  const newGeometry = format.readFeature(result.routes[0].polyline.encodedPolyline, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857"
  });

  routeLineString.setCoordinates(newGeometry.getGeometry().getCoordinates());
  endMarker.setCoordinates(destinationCoordinates.getLastCoordinate());


  // adding navigationSteps
  navigationSteps = [];
  const newMultiPoint = new MultiPoint(newGeometry.getGeometry().getCoordinates());
  result.routes[0].legs.forEach(leg => {
    leg.steps.forEach(step => {
      const newStep = {};
      const closestPoint = newMultiPoint.getClosestPoint(fromLonLat([step.startLocation.latLng.longitude, step.startLocation.latLng.latitude]));
      newStep["stepIndex"] = findIndexOf(closestPoint, newGeometry.getGeometry().getCoordinates());
      newStep["message"] = step.navigationInstruction.instructions.replaceAll("\n", ". ").replaceAll('/', "/<wbr>");
      newStep["maneuverType"] = translateArray[step.navigationInstruction.maneuver];
      navigationSteps.push(newStep);
    })
  });

  // last step, arriving
  navigationSteps.push({
    stepIndex: newMultiPoint.getCoordinates().length,
    message: "Ankomst",
    maneuverType: translateArray["arrive"],
  })

  getRemainingDistance(
    newGeometry.getGeometry(),
    speedKmh,
    navigationSteps,
    currentPosition
  );
}

map.on("singleclick", async function (evt) {
  if (localStorage.testing) {
    // for testing
    trackLineString.appendCoordinate(evt.coordinate);

    distanceTraveled = getLength(trackLineString);
    document.getElementById("distanceTraveledDiv").innerHTML = (
      distanceTraveled / 1000
    ).toFixed(2);
    trackLog.push([toLonLat(evt.coordinate), altitude, Date.now()]);

    let gpxGeometry;
    gpxSource.forEachFeature(function (feature) {
      const featureType = feature.getGeometry().getType();
      if (featureType == "LineString" || featureType == "MultiLineString") {
        gpxGeometry = featureType == "MultiLineString" ? feature.getGeometry().getLineString() : feature.getGeometry();
      }
    });

    getRemainingDistance(
      gpxGeometry || routeLineString,
      50,
      navigationSteps,
      evt.coordinate
    );
  }

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
  destinationCoordinates.updateFirst(lonlat);
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

  if (clickedOnCurrentPosition || (clickedOnEndMarker && destinationCoordinates.getLength() <= 2)) {
    setExtraInfo([
      Math.round(getDistance(lonlat, eventLonLat)) +
      '<font class="infoFormat">m</font>',
    ]);
    endMarker.setCoordinates([]);
    navigationSteps = [];
    routeLineString.setCoordinates([]);
    clearRouteInfo();
    destinationCoordinates.clear();
  } else if (clickedOnEndMarker) {
    destinationCoordinates.pop();
  } else if (clickedOnWaypoint) {
    setExtraInfo(["<font style='float: left;'>Navigerar till:</font>", "<font style='float: left;font-weight: normal;'>" + clickedOnWaypoint.get("name") + "</font>"]);
    destinationCoordinates.push(toLonLat(clickedOnWaypoint.getGeometry().getCoordinates()).splice(0, 2));
  } else {
    setExtraInfo([
      `<a href="http://maps.google.com/maps?q=${eventLonLat[1]},${eventLonLat[0]}" target="_blank">Gmap</a> <a href="http://maps.google.com/maps?layer=c&cbll=${eventLonLat[1]},${eventLonLat[0]}" target="_blank">Streetview</a>`,
    ]);
    destinationCoordinates.push(eventLonLat);
  }

  // start routing
  if (destinationCoordinates.getLength() >= 2) {
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
    destinationCoordinates.updateFirst(lonlat);
    destinationCoordinates.push(destinationPoints[0]);
    routeMe();
  } else if (destinationPoints.length > 1) {
    destinationCoordinates.coordinates = destinationPoints;
    routeMe();
  }
}

if (searchParams.has("destinationPoints64")) {
  const destinationPoints = JSON.parse(atob(searchParams.get("destinationPoints64")).replace('\n', ', '));
  if (destinationPoints.length == 1) {
    destinationCoordinates.updateFirst(lonlat);
    destinationCoordinates.push(destinationPoints[0]);
    routeMe();
  } else if (destinationPoints.length > 1) {
    destinationCoordinates.coordinates = destinationPoints;
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
    .then((response) => response.text())
    .then((response) => {
      gpxSourceLoader(new File([response], gpxFile, { type: "application/gpx" }));
    });
}

if (searchParams.has("getId")) {
  let getId = searchParams.get("getId");
  loadItem(getId);
}
switchMap();

// navigator.keyboard.lock(["Escape", "Enter"]);
// add keyboard controls
document.addEventListener("keydown", function (event) {
  if (menuDiv.checkVisibility()) {
    if (event.key == "Escape" || event.key == "§") {
      event.preventDefault();
      menuDiv.classList.add("invisible");
    }
  } else if (loadGpxMenu.checkVisibility()) {
    if (event.key == "Escape" || event.key == "§") {
      event.preventDefault();
      loadGpxMenu.classList.add("invisible");
    }
  } else {
    for (let i = 1; i < 9; i++) {
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
    if (event.key == "c" || event.key == "l") {
      // remotek double press left
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
      // remotek double press down
      lastInteraction = Date.now();
      view.setRotation(0);
    }
    if (event.key == "m") {
      // remotek double press right || event.key == "m"
      toggleFullscreen();
    }
    if (event.key == "d") {
      focusDestination();
    }
    if (event.key == "Escape" || event.key == "§" || event.key == "PageUp") {
      event.preventDefault();
      // carpe iter adventure controller minus button
      if (view.getZoom() >= 17) {
        lastInteraction = Date.now();
      }
      view.adjustZoom(-zoomStep);
    }
    if (event.key == "a" || event.key == "PageDown") {
      // carpe iter adventure controller plus button
      if (view.getZoom() >= 17) {
        lastInteraction = Date.now();
      }
      view.adjustZoom(zoomStep);
    }
    if (event.code == "Space" || event.key == "k") {
      // remotek double press up = "k"
      event.preventDefault();
      focusTrafficWarning();
    }
    if (event.key == "r") {
      recalculateRoute();
    }
    resetRotation();
  }
});

map.addInteraction(new KeyboardZoom({
  duration: 0,
  // delta: 0.5,
}));

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
// <EQ name="Deviation.MessageCodeValue" value="roadClosed" />
async function getDeviations() {
  let xmlRequest = `
    <REQUEST>
      <LOGIN authenticationkey='fa68891ca1284d38a637fe8d100861f0' />
      <QUERY objecttype='Situation' namespace="road.trafficinfo" schemaversion='1.6'>
        <FILTER>
          <LTE name="Deviation.StartTime" value="$dateadd(0.01:00)"/>
          <GTE name="Deviation.EndTime" value="$now"/>
          <NE name="Deviation.Suspended" value="true" />
          <NEAR name="Deviation.Geometry.WGS84" value="${lonlat.join(" ")}" maxdistance="300000" />
          <OR>
            <EQ name='Deviation.MessageType' value='Olycka' />
            <IN name="Deviation.MessageTypeValue" value="AnimalPresenceObstruction,EnvironmentalObstruction,EquipmentOrSystemFault,GeneralInstructionOrMessageToRoadUsers,NonWeatherRelatedRoadConditions,ReroutingManagement,RoadsideAssistance,VehicleObstruction"/>
            <EQ name='Deviation.IconId' value='roadClosed'/>
            <ELEMENTMATCH>
              <EQ name="Deviation.MessageTypeValue" value="MaintenanceWorks" />
              <GTE name="Deviation.SeverityCode" value="4" />
            </ELEMENTMATCH>
          </OR>
        </FILTER>
        <INCLUDE>Deviation.Message</INCLUDE>
        <INCLUDE>Deviation.IconId</INCLUDE>
        <INCLUDE>Deviation.Geometry.Point.WGS84</INCLUDE>
        <INCLUDE>Deviation.RoadNumber</INCLUDE>
        <INCLUDE>Deviation.LocationDescriptor</INCLUDE>
        <INCLUDE>Deviation.EndTime</INCLUDE>
        <INCLUDE>Deviation.MessageCode</INCLUDE>

      </QUERY>
    </REQUEST>
  `;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
    },
    body: xmlRequest,
  });
  const result = await response.json();
  try {
    trafficWarningSource.clear();
    const resultRoadSituation = result.RESPONSE.RESULT[0].Situation;
    resultRoadSituation.forEach(function (item) {

      // console.table(item.Deviation);
      let IconId = item.Deviation[0].IconId;
      item.Deviation.forEach(function (deviation) {
        if (deviation.IconId == "roadClosed") {
          IconId = "roadClosed";
        }
      });

      const format = new WKT();
      const position = format
        .readGeometry(item.Deviation[0].Geometry.Point.WGS84)
        .transform("EPSG:4326", "EPSG:3857");
      const feature = new Feature({
        geometry: position,
        name:
          breakSentence(
            (item.Deviation[0].LocationDescriptor || item.Deviation[0].RoadNumber) + ": " +
            // (item.Deviation[0].RoadNumber ? item.Deviation[0].RoadNumber + ": " : "") +
            (item.Deviation[0].Message || item.Deviation[0].MessageCode || "?"),
          ) +
          "\nSluttid: " +
          new Date(item.Deviation[0].EndTime).toLocaleString("sv-SE", { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }),
        roadNumber: item.Deviation[0].RoadNumber || "väg",
        iconId: IconId,
        messageCode: item.Deviation[0].MessageCode || "Tillbud",
      });
      trafficWarningSource.addFeature(feature);
    });
    getClosestAccident();
  } catch (ex) {
    setExtraInfo(["getDeviations error:", ex]);
    console.log(ex);
  }
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
  const duration = 0;
  view.animate({
    center: closestAccidentPosition,
    duration: duration,
  });
  view.animate({
    zoom: closestAccident ? 15.1 : 11,
    duration: duration,
  });
  view.animate({
    rotation: 0,
    duration: duration,
  });
}

function focusDestination() {
  if (destinationCoordinates.getLength() > 1) {
    lastInteraction = Date.now();
    const coordinates = destinationCoordinates.getLastCoordinate();

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
            feature => {
              return getDistance(
                toLonLat(feature.getGeometry().getCoordinates()),
                toLonLat(featureCoordinates[i])) < 100
              // && (feature.get("messageCode") == "Olycka" || feature.get("iconId") == "roadClosed");
            },
          );
      }
    } else {
      closestAccident = trafficWarningSource.getClosestFeatureToCoordinate(
        currentPosition,
        feature => {
          return getDistance(
            toLonLat(feature.getGeometry().getCoordinates()),
            lonlat) < 30000 &&
            (feature.get("messageCode") == "Olycka" || feature.get("iconId") == "roadClosed");
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
        messageCode + ",<br>" +
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
  if (destinationCoordinates.getLength() >= 2) {
    if (
      getDistance(
        lonlat,
        destinationCoordinates.getLastLonLat(),
      ) < 1000
    ) {
      document.getElementById("extraInfo").innerHTML = "";
      destinationCoordinates.clear();
      endMarker.setCoordinates([]);
      routeLineString.setCoordinates([]);
    } else {
      destinationCoordinates.coordinates = [lonlat, destinationCoordinates.getLastLonLat()];
      routeMe();
    }
  }
}

document.getElementById("userName").value = localStorage.userName || "";
document.getElementById("userName").addEventListener("change", function () {
  if (document.getElementById("userName").value == "") {
    userLocationLayer.getSource().clear();
  }
  if (localStorage.userName) {
    // remove old username by setting timeStamp to 0
    const formData = new FormData();
    formData.append("userName", localStorage.userName);
    formData.append("timeStamp", 0);
    formData.append("x", 0);
    formData.append("y", 0);
    formData.append("heading", 0);
    formData.append("accuracy", 0);
    formData.append("speed", 0);
    fetch("https://jole84.se/locationHandler/sql-location-handler.php", {
      method: "POST",
      body: formData,
    });
  }
  localStorage.userName = document.getElementById("userName").value.trim();
  updateUserPosition();
});

setInterval(updateUserPosition, 15000);
async function updateUserPosition() {
  if (!localStorage.userName) return; // stop function if userName missing

  const formData = new FormData();
  formData.append("userName", localStorage.userName);
  formData.append("timeStamp", Date.now());
  formData.append("x", Math.round(geolocation.getPosition()[0]));
  formData.append("y", Math.round(geolocation.getPosition()[1]));
  formData.append("heading", (heading).toFixed(2));
  formData.append("accuracy", Math.round(accuracy));
  formData.append("speed", Math.floor(speedKmh));
  const response = await fetch("https://jole84.se/locationHandler/sql-location-handler.php", {
    method: "POST",
    body: formData,
  });
  const userList = await response.json();

  userLocationLayer.getSource().clear();
  for (let i = 0; i < userList.length; i++) {
    // add the other users
    const name = [
      userList[i]["userName"],
    ];

    if (userList[i]["accuracy"] > 50) {
      name.push("Osäker position (" + userList[i]["accuracy"] + "m)");
    }

    if (Date.now() - userList[i]["timeStamp"] > 120000) {
      name.push(msToTime(Date.now() - userList[i]["timeStamp"]));
    }

    name.push((userList[i]["speed"] < 100 ? userList[i]["speed"] : "--") + "km/h");

    const marker = new Feature({
      geometry: new Point([userList[i]["x"], userList[i]["y"]]),
      rotation: userList[i]["heading"],
      name: name.join("\n"),
    });
    userLocationLayer.getSource().addFeature(marker);
  }
}

function addPoiMarker(coordinate, sourceLayer, name = "") {
  const marker = new Feature({
    geometry: new Point(coordinate),
    name: String(name),
  });
  sourceLayer.addFeature(marker);
}

function addTripPoint(lonlat, lastLonlat, altitude, distanceTraveled, timeStamp, lastTimeStamp) {
  const segmentDistanceM = getDistance(lastLonlat, lonlat);
  const segmentTimeMS = new Date(timeStamp) - new Date(lastTimeStamp);
  const speedKmh = (segmentDistanceM / segmentTimeMS) * 3600;
  addPoiMarker(
    fromLonLat(lonlat),
    trackPointLayer.getSource(),
    String(
      new Date(timeStamp).toLocaleTimeString() + " " + Math.round(speedKmh) + "km/h\n" +
      (distanceTraveled / 1000).toFixed(1) + "km ") + altitude + "möh"
  );
}

async function showTripLayer() {
  let oldRoute = await trackLog.getAllRaw();
  if (!window.userChoseRestore) oldRoute = oldRoute.filter(element => element.timestamp >= pageLoadTime);

  trackPointLayer.getSource().clear();
  trackPointLayer.setVisible(tripPointButton.checked);
  if (tripPointButton.checked) {
    let newDistanceTraveled = 0;
    for (var i = 0; i < oldRoute.length - 1; i++) {
      newDistanceTraveled += getDistance(
        oldRoute[i].coordinates,
        oldRoute[i + 1].coordinates
      );
      addTripPoint(
        oldRoute[i].coordinates,
        oldRoute[i + 1].coordinates,
        oldRoute[i].altitude,
        newDistanceTraveled,
        oldRoute[i + 1].timestamp,
        oldRoute[i].timestamp
      );
    }
  }
}

async function fetchRoadCondition() {
  roadConditionLayer.getSource().clear();
  const xmlRequest = `<REQUEST>
    <LOGIN authenticationkey='fa68891ca1284d38a637fe8d100861f0' />
    <QUERY objecttype='RoadCondition' schemaversion='1.2' >
    <FILTER>
      <GTE name="ConditionCode" value="2" />
      <NEAR name="Geometry.WGS84" value="${lonlat.join(" ")}" maxdistance="300000" />
    </FILTER>
    <INCLUDE>Geometry.WGS84</INCLUDE>
    <INCLUDE>ConditionCode</INCLUDE>
    </QUERY>
    </REQUEST>`;

  const response = await fetch(apiUrl, {
    method: "Post",
    headers: {
      "Content-Type": "text/xml",
    },
    body: xmlRequest,
  });

  const result = await response.json();
  const resultRoadCondition = result.RESPONSE.RESULT[0].RoadCondition;
  var format = new WKT();
  resultRoadCondition.forEach(function (item) {
    var feature = new Feature({
      geometry: format.readGeometry(item.Geometry.WGS84).transform("EPSG:4326", "EPSG:3857").simplify(500),
      conditionCode: item.ConditionCode
    });
    roadConditionLayer.getSource().addFeature(feature);
  });
}

fetchRoadCondition();
setInterval(fetchRoadCondition, 1800000); // fetch every 30 min (30 * 60 * 1000)


// load from storage

document.getElementById("loginButton").onclick = login;
document.getElementById("logoutButton").onclick = logout;

const selectUpload = document.getElementById("selectUpload");

async function api(action, data = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch("https://jole84.se/routeStorage/api.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token, ...data })
  });

  return res.json();
}

async function loadData() {
  const r = await api("list");

  const el = document.createElement("option");
  el.textContent = "Välj uppladdning";
  el.value = "0";
  selectUpload.replaceChildren(el);

  r.uploads.forEach(u => {
    const el = document.createElement("option");
    el.textContent = u.item_name + " " + (u.is_public ? '(Publik)' : "(Privat)") + ` (${u.username} ${new Date(u.created_at).toLocaleDateString()})`;
    el.value = u.id;
    el.title = `By ${u.username} — ${new Date(u.created_at).toLocaleString()}`;
    selectUpload.appendChild(el);

    if (u.id == selectedUpload) selectUpload.value = u.id;
  });
}

let selectedUpload;
selectUpload.addEventListener("change", () => {
  selectedUpload = selectUpload.value;
  if (selectUpload.value > 0) {
    loadItem(selectUpload.value);
  } else {
    gpxSource.clear();
  }
});

function showApp(username) {
  try {
    if (localStorage.token) {
      document.getElementById("loginView").classList.add("invisible");
      document.getElementById("appView").classList.remove("invisible");
      document.getElementById("userLabel").textContent = username;
    } else {
      document.getElementById("loginView").classList.remove("invisible");
      document.getElementById("appView").classList.add("invisible");
    }
  } catch (error) {
    console.log(error);
  }
}


async function loadItem(id) {
  const r = await api("get_item", { id });

  if (r.error) {
    alert(r.error);
    return;
  }

  const format = new GeoJSON();
  const newGeometry = format.readFeatures(decodeURIComponent(atob(r.item.item_text)), {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857",
  });

  gpxSource.clear();
  newGeometry.forEach(element => {
    // console.log(element.getProperties())
    if (!!element.get("routeLineString") || !!element.get("poi") || !!element.get("gpxFeature")) gpxSource.addFeature(element);
  });
}

async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  const r = await api("login", { username, password });

  console.log(r);
  if (r.success) {
    localStorage.setItem("token", r.token);
    localStorage.setItem("username", r.username);
    showApp(username);
    loadData();
  } else {
    alert(r.error);
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  showApp("");
  loadData();
}
