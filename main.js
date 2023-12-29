import { Feature, Map, View } from "ol";
import XYZ from "ol/source/XYZ.js";
import { fromLonLat, toLonLat } from "ol/proj.js";
import TileLayer from "ol/layer/Tile.js";
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
import { getDistance, getLength } from "ol/sphere";
// import OSM from "ol/source/OSM.js";
import {MapboxVectorLayer} from 'ol-mapbox-style';
import MultiPoint from 'ol/geom/MultiPoint.js';
import { saveAs } from 'file-saver';

setExtraInfo(["<font size=1> Build: INSERTDATEHERE</font>"]);

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
var interactionDelay = 10000;
var lastInteraction = new Date() - interactionDelay;
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
      color: [255, 0, 0, 0.6],
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

// var osm = new TileLayer({
//   source: new OSM(),
//   visible: false,
// });

var osm = new MapboxVectorLayer({
  // styleUrl: "mapbox://styles/mapbox/streets-v12",
  styleUrl: "mapbox://styles/tryckluft/clqmovmf100pb01o9g1li1hxb",
  accessToken : "pk.eyJ1IjoidHJ5Y2tsdWZ0IiwiYSI6ImNrcTU1YTIzeTFlem8yd3A4MXRsMTZreWQifQ.lI612CDqRgWujJDv6zlBqw",
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

// gpx loader
gpxLayer.getSource().addEventListener("addfeature", function() {
  if (gpxLayer.getSource().getState() === "ready") {
    var padding = 100;
    lastInteraction = new Date();
    view.fit(gpxLayer.getSource().getExtent(), {
      padding: [200, padding, padding, padding],
      duration: 500,
    });
  }
});

var gpxFormat = new GPX();
var gpxFeatures;
customFileButton.addEventListener("change", handleFileSelect, false);
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

let prevCoordinate;
// let lastFix = new Date();
// run once to get things going
geolocation.once("change", function () {
  const position = geolocation.getPosition();
  const altitude = geolocation.getAltitude() || 0;
  const lonlat = toLonLat(position);
  const currentTime = new Date();
  if (currentTime - lastInteraction > interactionDelay) {
    centerFunction();
  }
  getDeviations();

  trackLog.push([
    lonlat,
    altitude,
    currentTime,
  ]);
  line.appendCoordinate(position);

  prevCoordinate = lonlat;
});

// runs when position changes
geolocation.on("change", function () {
  const position = geolocation.getPosition();
  const accuracy = geolocation.getAccuracy();
  const heading = geolocation.getHeading() || 0;
  const speed = geolocation.getSpeed() * 3.6 || 0;
  const altitude = geolocation.getAltitude() || 0;
  const lonlat = toLonLat(position);
  const currentTime = new Date();
  markerEl.getGeometry().setCoordinates(position); // move marker to current location
  markerElHeading.getGeometry().setCoordinates(position);

  // measure distance and push log if position change > 10 meters and accuracy is good
  if (getDistance(trackLog[trackLog.length - 1][0], lonlat) > 10 && accuracy < 20) {
    trackLog.push([
      lonlat,
      altitude,
      currentTime,
    ]);
    line.appendCoordinate(position);

    // calculate remaing distance on gpx
    info3.innerHTML = "";
    gpxLayer.getSource().forEachFeature(function (feature) {
      if (feature.getGeometry().getType() == "MultiLineString") {
        const featureCoordinates = feature.getGeometry().getLineString().getCoordinates()
        info3.innerHTML += getRemainingDistance(featureCoordinates, position);
      }
    });

    // calculate remaing distance on route
    if (routeLayer.getSource().getFeatureById(0) != null) {
      const featureCoordinates = routeLayer.getSource().getFeatureById(0).getGeometry().getCoordinates();
      const routeRemainingDistance = getRemainingDistance(featureCoordinates, position);
      if (routeRemainingDistance != "") {
        info3.innerHTML += "Rutt " + routeRemainingDistance;
      }
    }
  }

  distanceTraveled += getDistance(prevCoordinate, lonlat);
  prevCoordinate = lonlat;

  if (speed > 3.6) {
    // change marker if speed
    markerElHeading.getStyle().getImage().setRotation(heading);
    markerEl.getStyle().getImage().setOpacity(0);
    markerElHeading.getStyle().getImage().setOpacity(1);

    // change view if no interaction occurred last 10 seconds
    if (currentTime - lastInteraction > interactionDelay) {
      updateView(position, heading);
    }
  }

  if (speed < 3.6) {
    markerEl.getStyle().getImage().setOpacity(1);
    markerElHeading.getStyle().getImage().setOpacity(0);
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

function getRemainingDistance(featureCoordinates, position) {
  var newLineString = new LineString([]);
  var newMultiPoint = new MultiPoint(
    featureCoordinates.reverse(),
  );
  
  const newLineStringclosestPoint = newMultiPoint.getClosestPoint(position);
  const distanceToclosestPoint = getDistance(toLonLat(newLineStringclosestPoint), toLonLat(position));

  if (distanceToclosestPoint > 500) {
    return "";
  } else {
    for (var i = 0; i < featureCoordinates.length; i++) {
      newLineString.appendCoordinate([featureCoordinates[i]]);
      if (featureCoordinates[i].toString() === newLineStringclosestPoint.toString()) {
        break;
      }
    }
    return "-> " + (getLength(newLineString) / 1000).toFixed(1) + " km<br>";
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
var markerEl = new Feature({
  geometry: new Point({}),
});
var markerElHeading = new Feature({
  geometry: new Point({}),
});

map.addLayer(
  new VectorLayer({
    source: new VectorSource({
      features: [markerEl, markerElHeading],
    }),
  }),
);

markerEl.setStyle(
  new Style({
    image: new Icon({
      anchor: [0.5, 0.5],
      src: "https://openlayers.org/en/latest/examples/data/geolocation_marker.png",
    }),
  }),
);

markerElHeading.setStyle(
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
  const position = geolocation.getPosition() || center;
  const heading = geolocation.getHeading() || 0;
  const speed = geolocation.getSpeed() || 0;
  const duration = 500;
  if (speed > 1) {
    lastInteraction = new Date() - interactionDelay;
    view.setZoom(defaultZoom);
    updateView(position, heading);
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
  if (view.getZoom() <= 11) {
    view.setZoom(defaultZoom);
  }
  view.setCenter(getCenterWithHeading(position, -heading));
  view.setRotation(-heading);
  // map.render();
}

view.on("change:resolution", function () {
  // document.getElementById("info3").innerHTML = view.getZoom().toFixed(1);
  if (view.getRotation() != 0 && view.getZoom() < 11) {
    view.setRotation(0);
  }
});

layerSelector.addEventListener("change", function () {
  mapMode = layerSelector.value;
  switchMap();
});

layerSelector.addEventListener("focus", function () {
  layerSelector.blur();
})

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
    if (enableLnt) {
      ortofoto.setVisible(true);
      slitlagerkarta.setMaxZoom(15.5);
      ortofoto.setMinZoom(15.5);
    }
  } else if (mapMode == 1) {
    // mapMode 1: slitlagerkarta_nedtonad
    slitlagerkarta_nedtonad.setVisible(true);
    if (enableLnt) {
      topoweb.setVisible(true);
      ortofoto.setVisible(true);
      slitlagerkarta_nedtonad.setMaxZoom(15.5);
      topoweb.setMinZoom(15.5);
      topoweb.setMaxZoom(17.5);
      ortofoto.setMinZoom(17.5);
    }
  } else if (mapMode == 2) {
    // mapMode 2: slitlagerkarta_nedtonad + night mode
    slitlagerkarta_nedtonad.setVisible(true);
    mapDiv.setAttribute("style", "filter: invert(1) hue-rotate(180deg);");
    if (enableLnt) {
      topoweb.setVisible(true);
      slitlagerkarta_nedtonad.setMaxZoom(15.5);
      topoweb.setMinZoom(15.5);
      topoweb.setMaxZoom(20);
    }
  } else if (mapMode == 3) {
    // mapMode 3: Openstreetmap
    osm.setVisible(true);
  } else if (enableLnt && mapMode == 4) {
    // mapMode 4: topoweb
    topoweb.setVisible(true);
    topoweb.setMinZoom(0);
    topoweb.setMaxZoom(20);
  } else if (enableLnt && mapMode == 5) {
    // mapMode 4: orto
    ortofoto.setVisible(true);
    ortofoto.setMinZoom(0);
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

function download(data, filename) {
  var file = new Blob([data], { type: "application/gpx+xml" });
  saveAs(file, filename);
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
    // "https://jole84.se:17777/brouter" +
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
        // "Avstånd: " + trackLength.toFixed(2) + " km",
        // "Ankomsttid: " +
        // new Date(new Date().valueOf() + totalTime).toString().slice(16, 25),
        `<a href="http://maps.google.com/maps?q=${destinationCoordinates[destinationCoordinates.length - 1][1]
        },${destinationCoordinates[destinationCoordinates.length - 1][0]
        }" target="_blank">Gmap</a>`,
        `<a href="http://maps.google.com/maps?layer=c&cbll=${destinationCoordinates[destinationCoordinates.length - 1][1]
        },${destinationCoordinates[destinationCoordinates.length - 1][0]
        }" target="_blank">Streetview</a>`,
        "Restid: " + toHHMMSS(totalTime),
      ]);
      info3.innerHTML = "Rutt " + getRemainingDistance(route.getCoordinates(), geolocation.getPosition());

      const routeFeature = new Feature({
        type: "route",
        geometry: route,
      });
      routeFeature.setId(0);

      const endMarker = new Feature({
        type: "icon",
        geometry: new Point(route.getLastCoordinate().splice(0, 2)),
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

var destinationCoordinates = [];
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
  var currentPostition = toLonLat(geolocation.getPosition());

  // set start position
  if (destinationCoordinates.length == 0) {
    destinationCoordinates.push(currentPostition);
  }

  var clickedOnCurrentPosition = getDistance(currentPostition, toLonLat(event.coordinate)) < 200 || getPixelDistance(event.pixel, map.getPixelFromCoordinate(fromLonLat(currentPostition))) < 50;
  var clickedOnLastDestination = getPixelDistance(event.pixel, map.getPixelFromCoordinate(fromLonLat(destinationCoordinates[destinationCoordinates.length - 1]))) < 40;

  // remove last point if click < 40 pixels from last point
  if (destinationCoordinates.length > 2 && clickedOnLastDestination) {
    destinationCoordinates.pop();
    // clear route if click < 40 pixels from last point or click on current position
  } else if (destinationCoordinates.length == 2 && clickedOnLastDestination || clickedOnCurrentPosition) {
    routeLayer.getSource().clear();
    setExtraInfo([Math.round(getDistance(currentPostition, toLonLat(event.coordinate))) + " m"]);
    info3.innerHTML = "";
    destinationCoordinates = [];
  } else {
    // else push clicked coord to destinationCoordinates
    if (waypointIsClose) {
      destinationCoordinates.push(toLonLat(closestWaypoint.getGeometry().getCoordinates()));
    } else {
      destinationCoordinates.push(toLonLat(event.coordinate));
    }
  }

  // start routing
  if (destinationCoordinates.length >= 2) {
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
  if (event.key != "a" && event.key != "Escape" && event.key != "§") {
    // store time of last interaction
    lastInteraction = new Date();
  }
  if (event.key == "c" || event.key == "Enter") {
    event.preventDefault();
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

function breakSentence(sentence) {
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
  // declutter: true,
  style: styleFunction,
});
map.addLayer(trafikLayer);

function getDeviations() {
  trafikLayer.getSource().clear();

  var xmlRequest =
    "<REQUEST>" +
    "<LOGIN authenticationkey='fa68891ca1284d38a637fe8d100861f0' />" +
    "<QUERY objecttype='Situation' schemaversion='1.2'>" +
    "<FILTER>" +
    // "<OR>" +
    "<ELEMENTMATCH>" +
    "<EQ name='Deviation.ManagedCause' value='true' />" +
    "<EQ name='Deviation.MessageType' value='Olycka' />" +
    "<GTE name='Deviation.EndTime' value='$now'/>" +
    "</ELEMENTMATCH>" +
    // "<ELEMENTMATCH>" +
    // "<GTE name='Deviation.SeverityCode' value='5' />" +
    // "</ELEMENTMATCH>" +
    // "<ELEMENTMATCH>" +
    // "<EQ name='Deviation.IconId' value='roadClosed' />" +
    // "</ELEMENTMATCH>" +
    // "</OR>" +
    "</FILTER>" +
    "<INCLUDE>Deviation.Message</INCLUDE>" +
    "<INCLUDE>Deviation.IconId</INCLUDE>" +
    "<INCLUDE>Deviation.Geometry.WGS84</INCLUDE>" +
    "<INCLUDE>Deviation.RoadNumber</INCLUDE>" +
    "<INCLUDE>Deviation.EndTime</INCLUDE>" +
    "<INCLUDE>Deviation.LocationDescriptor</INCLUDE>" +
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
          var position = format
            .readGeometry(item.Deviation[0].Geometry.WGS84)
            .transform("EPSG:4326", "EPSG:3857");
          var feature = new Feature({
            geometry: position,
            name: breakSentence(
              (item.Deviation[0].LocationDescriptor ||
                item.Deviation[0].RoadNumber ||
                "Väg") +
              ": " +
              (item.Deviation[0].Message.replace(/[\t\n\r]/g, '') || "-") +
              "\n" +
              new Date(item.Deviation[0].EndTime)
                .toLocaleTimeString()
                .slice(0, 5),
            ),
            roadNumber: (item.Deviation[0].RoadNumber || "väg"),
            iconId: item.Deviation[0].IconId,
            locationDescriptor: item.Deviation[0].LocationDescriptor,
          });
          trafikLayer.getSource().addFeature(feature);
        });
        // if roadAccident < 30000 meters
        try {
          var closestAccident = trafikLayer
            .getSource()
            .getClosestFeatureToCoordinate(
              geolocation.getPosition(),
              function (feature) {
                return feature.get("iconId") === "roadAccident";
              },
            );
          var closestAccidentCoords = closestAccident.getGeometry().getCoordinates();
          var closestAccidentDistance = getDistance(
            toLonLat(closestAccidentCoords),
            toLonLat(geolocation.getPosition()),
          );
          var closestAccidentRoadNumber = closestAccident.get("roadNumber");
          var locationDescriptor = closestAccident.get("locationDescriptor");
          if (closestAccidentDistance < 30000) {
            trafficWarning.innerHTML =
              "Olycka " + closestAccidentRoadNumber.replace(/^V/, "v") + " (" + Math.round(closestAccidentDistance / 1000) + "km)";
          } else {
            trafficWarning.innerHTML = "";
          }
        } catch {
          trafficWarning.innerHTML = "";
        }
      } catch (ex) {
        console.log(ex);
      }
    },
  });
}

trafficWarning.addEventListener("click", focusTrafficWarning);

function focusTrafficWarning() {
  lastInteraction = new Date();
  var coordinates = geolocation.getPosition()
  try {
    var closestAccidentCoords = trafikLayer
      .getSource()
      .getClosestFeatureToCoordinate(
        geolocation.getPosition(),
        function (feature) {
          return feature.get("iconId") === "roadAccident";
        },
      ).getGeometry().getCoordinates();

    var closestAccidentDistance = getDistance(
      toLonLat(closestAccidentCoords),
      toLonLat(coordinates),
    );

    if (closestAccidentDistance < 30000) {
      coordinates = closestAccidentCoords;
    }
  } finally {
    var duration = 500;
    view.animate({
      center: coordinates,
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
}

setInterval(getDeviations, 60000); // getDeviations interval

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
