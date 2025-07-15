import { fromLonLat, toLonLat } from "ol/proj.js";
import { getDistance } from "ol/sphere";
import { GPX, GeoJSON, KML } from "ol/format.js";
import MultiPoint from "ol/geom/MultiPoint.js";

export function getPixelDistance(pixel, pixel2) {
  return Math.sqrt(
    (pixel[1] - pixel2[1]) * (pixel[1] - pixel2[1]) +
    (pixel[0] - pixel2[0]) * (pixel[0] - pixel2[0]),
  );
}

export function getFileFormat(fileExtention) {
  const extentions = {
    gpx: new GPX(),
    kml: new KML({ extractStyles: false }),
    geojson: new GeoJSON(),
  }
  return extentions[fileExtention];
}

export function breakSentence(sentence) {
  sentence = sentence.replaceAll(".:", ":").replaceAll("\n", "").trim();
  let returnSentence = "";
  let x = 0;
  for (let i = 0; i < sentence.length; i++) {
    if (x > 20 && sentence[i] == " " && sentence.length - i > 10) {
      x = 0;
      returnSentence += "\n";
    } else {
      returnSentence += sentence[i];
    }
    x++;
  }
  return returnSentence;
}

export function msToTime(milliseconds) {
  return milliseconds > 120000 ? (Math.ceil(milliseconds / 1000 / 60) + " min sedan\n") : "";
}

export function toHHMMSS(milliSecondsInt) {
  const dateObj = new Date(milliSecondsInt);
  const hours = dateObj.getUTCHours().toString().padStart(2, "0");
  const minutes = dateObj.getUTCMinutes().toString().padStart(2, "0");
  const seconds = dateObj.getSeconds().toString().padStart(2, "0");
  return hours + ":" + minutes + ":" + seconds;
}

export function getRemainingDistance(featureCoordinates, lonlat) {
  const newMultiPoint = new MultiPoint(featureCoordinates.reverse());
  let remainingDistance = 0;
  const closestPoint = newMultiPoint.getClosestPoint(fromLonLat(lonlat));
  const closeToRoute = getDistance(toLonLat(closestPoint), lonlat) < 500;

  if (closeToRoute) {
    for (let i = 0; i < featureCoordinates.length - 1; i++) {
      if (
        featureCoordinates[0].toString() === closestPoint.toString() ||
        featureCoordinates[i + 1].toString() === closestPoint.toString()
      ) {
        remainingDistance += getDistance(
          toLonLat(featureCoordinates[i]),
          lonlat,
        );
        break;
      } else {
        remainingDistance += getDistance(
          toLonLat(featureCoordinates[i]),
          toLonLat(featureCoordinates[i + 1]),
        );
      }
    }
    return remainingDistance / 1000;
  }
}

export function toRemainingString(remainingDistance, secondsInt) {
  const totalMinutes = Math.floor(secondsInt / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ETA = new Date(new Date().getTime() + secondsInt * 1000);

  // first row
  let returnString = `<div class="equalSpace"><div><font class="infoFormat">-></font> ${Number(remainingDistance).toFixed(1)}<font class="infoFormat">KM</font></div><div>`;
  if (hours > 0) {
    returnString += `${hours}<font class="infoFormat">H</font> `;
  }
  returnString += `${minutes}<font class="infoFormat">MIN</font></div></div>`

  // second row
  returnString += `<div class="equalSpace"> <div></div> <div>${ETA.getHours()}:${ETA.getMinutes().toString().padStart(2, "0")}<font class="infoFormat">ETA</font></div></div>`;
  return returnString;
}

// convert degrees to radians
export function degToRad(deg) {
  return (deg * Math.PI * 2) / 360;
}

export function radToDeg(rad) {
  return rad * (180 / Math.PI);
}

export function addTestMarker(coordinate, name = "") {
  const marker = new Feature({
    geometry: new Point(coordinate),
    name: String(name),
  });
  gpxSource.addFeature(marker);
}

export function findIndexOf(value, array) {
  for (let i = 0; i < array.length; i++) {
    if (array[i].toString() == value.toString()) {
      return i;
    }
  }
}