import { Feature, Map, View } from "ol";
import XYZ from "ol/source/XYZ.js";
import { fromLonLat, toLonLat } from "ol/proj.js";
import TileLayer from "ol/layer/Tile.js";
import Overlay from "ol/Overlay.js";
import LineString from "ol/geom/LineString";
import Geolocation from "ol/Geolocation.js";
import VectorSource from "ol/source/Vector.js";
import GPX from "ol/format/GPX.js";
import { Stroke, Style, Icon, Fill, Text } from "ol/style.js";
import { Vector as VectorLayer } from "ol/layer.js";
import TileWMS from "ol/source/TileWMS.js";
import Point from "ol/geom/Point.js";
import GeoJSON from "ol/format/GeoJSON.js";
import WKT from "ol/format/WKT.js";
import { getDistance } from "ol/sphere";
import OSM from "ol/source/OSM.js";

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

var center = fromLonLat([14.18, 57.786]);
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
var customFileButton = document.getElementById("customFileButton");
var trafficWarning = document.getElementById("trafficWarning");
saveLogButton.onclick = saveLogButtonFunction;
centerButton.onclick = centerFunction;

const view = new View({
  center: center,
  zoom: 8,
  // minZoom: 6,
  maxZoom: 20,
  constrainRotation: false,
  // extent: [900000, 7200000, 2900000, 11000000]
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
      width: 6,
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

var line = new LineString([]);
var trackLine = new Feature({
  geometry: line,
});

var osm = new TileLayer({
  source: new OSM(),
  visible: false,
});

var slitlagerkarta = new TileLayer({
  source: new XYZ({
    url: "https://jole84.se/slitlagerkarta/{z}/{x}/{y}.jpg",
    minZoom: 6,
    maxZoom: 14,
  }),
  visible: false,
});

var slitlagerkarta_nedtonad = new TileLayer({
  source: new XYZ({
    url: "https://jole84.se/slitlagerkarta_nedtonad/{z}/{x}/{y}.jpg",
    minZoom: 6,
    maxZoom: 14,
  }),
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
  ],
  target: "map",
  view: view,
  keyboardEventTarget: document,
});

// clear layer when new feature is added
function clearLayer(layerToClear) {
  layerToClear
    .getSource()
    .getFeatures()
    .forEach(function (feature) {
      layerToClear.getSource().removeFeature(feature);
    });
}

// gpx loader
var gpxFormat = new GPX();
var gpxFeatures;
customFileButton.addEventListener("change", handleFileSelect, false);
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
      gpxFeatures = gpxFormat.readFeatures(evt.target.result, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });

      // if (files.length > 1) {
      //   // set random color if two or more files is loaded
      //   var color = [
      //     Math.floor(Math.random() * 255),
      //     Math.floor(Math.random() * 255),
      //     Math.floor(Math.random() * 255),
      //     0.8,
      //   ];
      //   gpxFeatures.forEach((f) => {
      //     f.setStyle(
      //       new Style({
      //         stroke: new Stroke({
      //           color: color,
      //           width: 10,
      //         }),
      //         text: new Text({
      //           text: f.get("name"),
      //           font: "bold 14px Roboto,monospace",
      //           placement: "line",
      //           repeat: 1000,
      //           fill: new Fill({
      //             color: color,
      //           }),
      //           stroke: new Stroke({
      //             color: "white",
      //             width: 4,
      //           }),
      //         }),
      //         image: new Icon({
      //           anchor: [0.5, 1],
      //           src: "https://jole84.se/poi-marker.svg",
      //         }),
      //       }),
      //     );
      //   });
      // }
      gpxLayer.getSource().addFeatures(gpxFeatures);
    };
  }
  gpxLayer.getSource().once("change", function () {
    if (gpxLayer.getSource().getState() === "ready") {
      var padding = 100;
      view.fit(gpxLayer.getSource().getExtent(), {
        padding: [padding, padding, padding, padding],
        duration: 500,
      });
    }
  });
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

// runs when position changes
let prevCoordinate = geolocation.getPosition();
let lastFix = new Date();
geolocation.on("change", function () {
  const position = geolocation.getPosition();
  const accuracy = geolocation.getAccuracy();
  const heading = geolocation.getHeading() || 0;
  const speed = geolocation.getSpeed() * 3.6 || 0;
  const altitude = geolocation.getAltitude() || 0;
  const lonlat = toLonLat(position);
  const currentTime = new Date();
  marker.setPosition(position); // move marker to current location

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
      trackLog.push([
        lonlat[0].toFixed(6),
        lonlat[1].toFixed(6),
        altitude.toFixed(2),
        currentTime,
      ]);
      line.appendCoordinate(position);
    }
  } else if (currentTime - lastFix > 5000 && lastFix > startTime) {
    lastFix = 0;
    trackLog.push([
      lonlat[0].toFixed(6),
      lonlat[1].toFixed(6),
      altitude.toFixed(2),
      currentTime,
    ]);
    line.appendCoordinate(position);
  }

  if (speed > maxSpeed) {
    maxSpeed = Math.floor(speed);
  }

  // send text to info box
  const html = [
    lonlat[1].toFixed(5) + ", " + lonlat[0].toFixed(5),
    (distanceTraveled / 1000).toFixed(2) +
      " km / " +
      Math.round(accuracy) +
      " m",
    '<b style="font-size:120%">' +
      Math.floor(speed) +
      '</b> (<font style="color:#e60000;">' +
      maxSpeed +
      "</font>) km/h",
  ].join("<br />");
  document.getElementById("info").innerHTML = html;
});

// alert user if geolocation fails
geolocation.on("error", function () {
  setExtraInfo([
    "&#128543 Aktivera platsjänster för <br>att se din position på kartan!",
  ]);
});

// Geolocation marker
const markerEl = document.getElementById("geolocation_marker");
markerEl.style.display = "unset";
const marker = new Overlay({
  positioning: "center-center",
  element: markerEl,
  stopEvent: false,
});
map.addOverlay(marker);

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
  const position = geolocation.getPosition() || center;
  const heading = geolocation.getHeading() || 0;
  const speed = geolocation.getSpeed() || 0;
  const duration = 500;
  if (speed > 1) {
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
      duration: duration,
    });
    view.animate({
      zoom: defaultZoom,
      duration: duration,
    });
    view.animate({
      rotation: 0,
      duration: duration,
    });
  }
  acquireWakeLock();
}

function updateView(position, heading) {
  if (view.getZoom() < 11) {
    view.setZoom(defaultZoom);
  }
  view.setCenter(getCenterWithHeading(position, -heading));
  view.setRotation(-heading);
  map.render();
}

view.on("change:resolution", function () {
  // document.getElementById("info3").innerHTML = view.getZoom().toFixed(1);
  if (view.getRotation() != 0 && view.getZoom() < 11) {
    view.setRotation(0);
  }
});

// run once when first position is recieved
geolocation.once("change", function () {
  centerFunction();
});

layerSelector.addEventListener("change", function () {
  mapMode = layerSelector.value;
  switchMap();
});

// switch map logic
var mapMode = 0; // default map

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

  if (enableLnt && mapMode > 5) {
    mapMode = 0;
  } else if (!enableLnt && mapMode > 3) {
    mapMode = 0;
  }
  layerSelector.value = mapMode;

  if (mapMode == 0) {
    // mapMode 0: slitlagerkarta
    slitlagerkarta.setVisible(true);
    ortofoto.setVisible(true);
    slitlagerkarta.setMaxZoom(15.5);
    ortofoto.setMinZoom(15.5);
  } else if (mapMode == 1) {
    // mapMode 1: slitlagerkarta_nedtonad
    slitlagerkarta_nedtonad.setVisible(true);
    topoweb.setVisible(true);
    ortofoto.setVisible(true);
    slitlagerkarta_nedtonad.setMaxZoom(15.5);
    topoweb.setMinZoom(15.5);
    topoweb.setMaxZoom(17.5);
    ortofoto.setMinZoom(17.5);
  } else if (mapMode == 2) {
    // mapMode 2: slitlagerkarta_nedtonad + night mode
    slitlagerkarta_nedtonad.setVisible(true);
    slitlagerkarta_nedtonad.setMaxZoom(20);
    mapDiv.setAttribute("style", "filter: invert(1) hue-rotate(180deg);");
  } else if (mapMode == 3) {
    // mapMode 3: Openstreetmap
    osm.setVisible(true);
    // ortofoto.setVisible(true);
    // ortofoto.setMinZoom(6);
  } else if (enableLnt && mapMode == 4) {
    // mapMode 4: topoweb
    topoweb.setVisible(true);
    topoweb.setMinZoom(6);
    topoweb.setMaxZoom(20);
  } else if (enableLnt && mapMode == 5) {
    // mapMode 4: orto
    ortofoto.setVisible(true);
    ortofoto.setMinZoom(6);
  }

  infoGroup.style.fontSize = preferredFontSize;
}

// logic for saveLogButton
function saveLogButtonFunction() {
  if (trackLog.length > 5) {
    saveLog();
  } else {
    setExtraInfo([
      "zoomLevel = " + view.getZoom().toFixed(2),
      "Spår för kort!",
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
<name>${startTime.toLocaleString()}, max ${maxSpeed.toFixed(1)} km/h, total ${(
    distanceTraveled / 1000
  ).toFixed(2)} km, ${toHHMMSS(new Date() - startTime)}</name>
<trkseg>`;

  for (let i = 0; i < trackLog.length; i++) {
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

  const filename =
    startTime.toLocaleString().replace(/ /g, "_").replace(/:/g, ".") + ".gpx";
  setExtraInfo(["Sparar fil:", filename]);
  download(gpxFile, filename);
}

var timeOut; // create timeout variable so it can be cleared
function setExtraInfo(infoText) {
  window.clearTimeout(timeOut);
  var extraInfo = infoText.join("<br />");
  document.getElementById("info2").innerHTML = extraInfo;
  timeOut = setTimeout(function () {
    document.getElementById("info2").innerHTML = "";
  }, 60000);
}

// Function to download data to a file
function download(data, filename) {
  var file = new Blob([data], { type: "application/gpx+xml" });
  if (window.navigator.msSaveOrOpenBlob) {
    // IE10+
    window.navigator.msSaveOrOpenBlob(file, filename);
  } else {
    // Others
    var a = document.createElement("a"),
      url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  }
}

// brouter routing
function routeMe(destinationCoordinates) {
  const endMarker = new Feature({
    type: "icon",
    geometry: new Point(
      fromLonLat(destinationCoordinates[destinationCoordinates.length - 1]),
    ),
  });
  routeLayer.getSource().addFeature(endMarker);

  fetch(
    "https://brouter.de/brouter" +
      // fetch('https://jole84.se:17777/brouter' +
      "?lonlats=" +
      destinationCoordinates.join("|") +
      "&profile=car-fast&alternativeidx=0&format=geojson",
  ).then(function (response) {
    response.json().then(function (result) {
      const route = new GeoJSON()
        .readFeature(result.features[0], {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        })
        .getGeometry();

      const trackLength = result.features[0].properties["track-length"] / 1000; // track-length in km
      const totalTime = result.features[0].properties["total-time"] * 1000; // track-time in milliseconds

      // add route information to info box
      setExtraInfo([
        "Avstånd: " + trackLength.toFixed(2) + " km",
        "Restid: " + toHHMMSS(totalTime),
        "Ankomsttid: " +
          new Date(new Date().valueOf() + totalTime).toString().slice(16, 25),
        `<a href="http://maps.google.com/maps?q=${
          destinationCoordinates[destinationCoordinates.length - 1][1]
        },${
          destinationCoordinates[destinationCoordinates.length - 1][0]
        }" target="_blank">Gmap</a>`,
        `<a href="http://maps.google.com/maps?layer=c&cbll=${
          destinationCoordinates[destinationCoordinates.length - 1][1]
        },${
          destinationCoordinates[destinationCoordinates.length - 1][0]
        }" target="_blank">Streetview</a>`,
      ]);

      const routeFeature = new Feature({
        type: "route",
        geometry: route,
      });

      const endMarker = new Feature({
        type: "icon",
        geometry: new Point(route.getLastCoordinate().splice(0, 2)),
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
map.on("contextmenu", function (event) {
  var currentPostition = toLonLat(geolocation.getPosition());
  console.log(toLonLat(event.coordinate)[1]);
  console.log(toLonLat(event.coordinate)[0]);
  console.log(
    Math.round(getDistance(currentPostition, toLonLat(event.coordinate))) +
      " m",
  );

  if (destinationCoordinates.length == 0) {
    // set start position
    destinationCoordinates.push(currentPostition);
  }

  // remove last coord if < 0.2 km if click on last coord
  if (
    destinationCoordinates.length > 2 &&
    getDistance(
      toLonLat(event.coordinate),
      destinationCoordinates[destinationCoordinates.length - 1],
    ) < 200
  ) {
    destinationCoordinates.pop();
  }
  // clear route if click < 0.2 km if coord is last
  else if (
    destinationCoordinates.length == 2 &&
    getDistance(
      toLonLat(event.coordinate),
      destinationCoordinates[destinationCoordinates.length - 1],
    ) < 200
  ) {
    clearLayer(routeLayer);
    setExtraInfo([""]);
    destinationCoordinates = [];
  } else {
    // else push clicked coord do route
    destinationCoordinates.push(toLonLat(event.coordinate));
  }

  lastInteraction = new Date();
  // if click less than 0.2km from current position clear route else start route
  if (getDistance(currentPostition, toLonLat(event.coordinate)) < 200) {
    clearLayer(routeLayer);
    setExtraInfo([
      Math.round(getDistance(currentPostition, toLonLat(event.coordinate))) +
        " m",
    ]);
    destinationCoordinates = [];
  } else if (destinationCoordinates.length >= 2) {
    routeMe(destinationCoordinates);
  }
});

// store time of last interaction
map.on("pointerdrag", function () {
  lastInteraction = new Date();
});

// checks url parameters and loads gpx file from url:
var urlParams = window.location.href.split("?").pop().split("&");
var enableLnt = urlParams.includes("Lnt");
for (var i = 0; i < urlParams.length; i++) {
  console.log(decodeURIComponent(urlParams[i]));
  if (urlParams[i].includes(".gpx")) {
    if (!urlParams[i].includes("http")) {
      urlParams[i] = "https://jole84.se/rutter/" + urlParams[i];
    }
    var titleString = decodeURIComponent(urlParams[i].split("/").pop());
    setExtraInfo([titleString]);
    fetch(urlParams[i])
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
    gpxLayer.getSource().once("change", function () {
      if (gpxLayer.getSource().getState() === "ready") {
        var padding = 100;
        view.fit(gpxLayer.getSource().getExtent(), {
          padding: [padding, padding, padding, padding],
        });
      }
    });
  } else if (urlParams[i].includes("Lnt")) {
    var option4 = document.createElement("option");
    var option5 = document.createElement("option");
    option4.text = "Lantmäteriet Topo";
    option4.value = 4;
    option5.text = "Lantmäteriet Orto";
    option5.value = 5;
    layerSelector.add(option4);
    layerSelector.add(option5);
  } else if (urlParams[i].includes("zoom=")) {
    defaultZoom = urlParams[i].split("=").pop();
  } else if (urlParams[i].includes("mapMode=")) {
    mapMode = urlParams[i].split("=").pop();
  } else if (urlParams[i].includes("info=")) {
    preferredFontSize = urlParams[i].split("=").pop();
  } else if (urlParams[i].includes("onunload")) {
    window.onunload = window.onbeforeunload = function () {
      return "";
    };
  }
}
switchMap();

// add keyboard controls
document.addEventListener("keydown", function (event) {
  const zoomStep = 0.5;
  if (event.key != "a" && event.key != "Escape") {
    // store time of last interaction
    lastInteraction = new Date();
  }
  if (event.key == "c") {
    centerFunction();
  }
  if (event.key == "v") {
    mapMode++;
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
  if (event.key == "Escape") {
    // carpe iter adventure controller minus button
    view.adjustZoom(-zoomStep);
  }
  if (event.key == "a") {
    // carpe iter adventure controller plus button
    view.adjustZoom(zoomStep);
  }
});

var apiUrl = "https://api.trafikinfo.trafikverket.se/v2/";
var styleFunction = function (feature) {
  //Function to determine style of icons
  return [
    new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        src: apiUrl + "icons/" + feature.get("iconId") + "?type=png32x32",
      }),
      text: new Text({
        text: feature.get("name"),
        font: "bold 14px Roboto,monospace",
        textAlign: "left",
        textBaseline: "top",
        offsetX: 20,
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

function breakSentence(sentence) {
  var returnSentence = "";
  var x = 0;
  for (var i = 0; i < sentence.length; i++) {
    if (x > 20 && sentence[i] == " ") {
      x = 0;
      returnSentence += "\n";
    } else {
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
  },
});

$.support.cors = true; // Enable Cross domain requests
var trafikLayer = new VectorLayer({
  //Creates a layer for deviations
  source: new VectorSource(),
  declutter: true,
  style: styleFunction,
});
map.addLayer(trafikLayer);

function getDeviations() {
  clearLayer(trafikLayer);

  var xmlRequest =
    "<REQUEST>" +
    "<LOGIN authenticationkey='fa68891ca1284d38a637fe8d100861f0' />" +
    "<QUERY objecttype='Situation' schemaversion='1.2'>" +
    "<FILTER>" +
    "<OR>" +
    "<ELEMENTMATCH>" +
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
    "<INCLUDE>Deviation.EndTime</INCLUDE>" +
    "</QUERY>" +
    "</REQUEST>";

  $.ajax({
    type: "POST",
    contentType: "text/xml",
    dataType: "json",
    data: xmlRequest,
    success: function (response) {
      if (response == null) return;
      var noAccidents = true;
      try {
        $.each(response.RESPONSE.RESULT[0].Situation, function (index, item) {
          var format = new WKT();
          var position = format
            .readGeometry(item.Deviation[0].Geometry.WGS84)
            .transform("EPSG:4326", "EPSG:3857");
          var distance = getDistance(
            toLonLat(position.getCoordinates()),
            toLonLat(geolocation.getPosition() || [0, 0]),
          );
          var feature = new Feature({
            geometry: position,
            name: breakSentence(
              (item.Deviation[0].RoadNumber || "Väg") +
                ": " +
                item.Deviation[0].Message,
              // + " " + new Date(item.Deviation[0].EndTime).toLocaleTimeString().slice(0, 5)
            ),
            iconId: item.Deviation[0].IconId,
          });
          trafikLayer.getSource().addFeature(feature);
          // if roadAccident < 40000 meters
          if (distance < 40000 && item.Deviation[0].IconId == "roadAccident") {
            noAccidents = false;
            trafficWarning.innerHTML =
              "Olycka på " + (item.Deviation[0].RoadNumber || "väg") + "!";
          }
        });
        if (noAccidents) {
          trafficWarning.innerHTML = "";
        }
      } catch (ex) {
        console.log(ex);
      }
    },
  });
}

getDeviations();

setInterval(getDeviations, 60000); // getDeviations interval
