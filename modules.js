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

export const fileFormats = {
  "gpx": new GPX(),
  "kml": new KML({ extractStyles: false }),
  "geojson": new GeoJSON(),
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

export function findNextStep(featureCoordinates, navigationSteps, lonlat) {
  console.log(navigationSteps);
  const newMultiPoint = new MultiPoint(featureCoordinates);
  const closestPoint = newMultiPoint.getClosestPoint(fromLonLat(lonlat));
  let distanceToNextStep = 0;
  const startPos = featureCoordinates.findIndex(element => element.toString() == closestPoint.toString());

  // featureCoordinates = featureCoordinates.slice(startPos);
  // const mapped = navigationSteps.map(element => fromLonLat(element.maneuver.location).toString());
  // const nextStepfeatureCoordinates = featureCoordinates.find(element => mapped.includes(element.toString()));
  // const nextStepIndex = navigationSteps.findIndex(element => featureCoordinates.includes(nextStepfeatureCoordinates.toString()));

  // console.log(mapped);
  // console.log(navigationSteps);
  // console.log(nextStepfeatureCoordinates);
  // console.log(nextStepIndex)
  // console.log(navigationSteps[nextStepIndex]);

  // start at closestPoint and stop at next step
  for (var i = startPos; i < featureCoordinates.length - 1; i++) {
    distanceToNextStep += getDistance(
      toLonLat(featureCoordinates[i]),
      toLonLat(featureCoordinates[i + 1])
    );

    // determine which step is next
    for (var stepI = 0; stepI < navigationSteps.length; stepI++) {
      if (featureCoordinates[i].toString() == fromLonLat(navigationSteps[stepI].maneuver.location).toString()) {
        return [
          navigationSteps[stepI],
          (distanceToNextStep > 1000 ?
            ((distanceToNextStep / 1000).toFixed(1) + "km") :
            ((Math.round(distanceToNextStep / 25) * 25) + "m")
          )];
      }
    }
  }
  return [navigationSteps[navigationSteps.length - 1], (
    distanceToNextStep > 1000 ? ((distanceToNextStep / 1000).toFixed(1) + "km") :
      ((Math.round(distanceToNextStep / 25) * 25) + "m"))];
}

const translateArray = {
  "turn": "sväng",
  // "new name": "nytt vägnamn", //?
  // "depart": "start",
  "arrive": "ankomst",
  // "merge": "sammansätt?", //?
  "on ramp": "påfart",
  "off ramp": "avfart",
  // "fork": "", //?
  "end of road": "slutet av vägen sväng",
  // "continue": "fortsätt",
  "roundabout": "rondell",
  "rotary": "rondell",
  "roundabout turn": "i rondellen sväng",
  // "notification": "", //?
  "exit roundabout": "kör ut ur rondell",
  "exit rotary": "kör ut ur rondell",
  // turns
  "uturn": "u-sväng",
  "sharp right": "höger",
  "right": "höger",
  "slight right": "höger",
  "straight": "rakt",
  "slight left": "vänster",
  "left": "vänster",
  "sharp left": "vänster",
  1: "första utfarten",
  2: "andra utfarten",
  3: "tredje utfarten",
  4: "fjärde utfarten",
  5: "femte utfarten",
};

export function createTurnHint(routeStep) {
  console.log(routeStep);
  const destinations = routeStep.destinations;
  const maneuverType = routeStep.maneuver.type;
  const maneuverModifier = routeStep.maneuver.modifier;
  const roundaboutExit = routeStep.maneuver.exit;
  const maneuverName = routeStep.name;
  const rampExit = routeStep.exits;
  const ref = routeStep.ref;

  if (!translateArray.hasOwnProperty(maneuverType)) {
    return
  }

  const turnString = [];

  if (["exit roundabout", "exit rotary"].includes(maneuverType)) {
    turnString.push(destinations);
    turnString.push(translateArray[maneuverType]);
    turnString.push(translateArray[roundaboutExit]);
  }

  if (["roundabout turn"].includes(maneuverType)) {
    turnString.push(destinations);
    turnString.push(translateArray[maneuverType]);
    turnString.push(translateArray[maneuverModifier]);
  }

  if (["roundabout", "rotary"].includes(maneuverType)) {
    turnString.push(translateArray[maneuverType]);
    turnString.push(translateArray[roundaboutExit]);
  }

  if (["arrive"].includes(maneuverType)) {
    turnString.unshift(translateArray[maneuverType]);
  }

  if (["turn", "end of road"].includes(maneuverType)) {
    turnString.push(translateArray[maneuverType]);
    turnString.push(translateArray[maneuverModifier]);
  }

  if (["on ramp", "off ramp"].includes(maneuverType)) {
    turnString.push(translateArray[maneuverType]);
    turnString.push(rampExit);
    turnString.push(destinations);
  }
  turnString.push(maneuverName);

  return turnString.join(" ");
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

export function findIndexOf(value, array) {
  for (let i = 0; i < array.length; i++) {
    if (array[i].toString() == value.toString()) {
      return i;
    }
  }
}