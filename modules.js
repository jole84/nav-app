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
  return Math.ceil(milliseconds / 1000 / 60) + " min sedan";
}

export function toHHMMSS(milliSecondsInt) {
  const dateObj = new Date(milliSecondsInt);
  const hours = dateObj.getUTCHours().toString().padStart(2, "0");
  const minutes = dateObj.getUTCMinutes().toString().padStart(2, "0");
  const seconds = dateObj.getSeconds().toString().padStart(2, "0");
  return hours + ":" + minutes + ":" + seconds;
}

export function getRemainingDistance(featureCoordinates, speedKmh, navigationSteps, currentPosition) {
  // console.log(featureCoordinates, speedKmh, navigationSteps, currentPosition);
  const newMultiPoint = new MultiPoint(featureCoordinates);
  const closestPoint = newMultiPoint.getClosestPoint(currentPosition);
  const closeToRoute = getDistance(toLonLat(closestPoint), toLonLat(currentPosition)) < 500;
  let nextStep;
  let nextStepIndex = 0;
  let distanceToNextStep = 0;
  let remainingDistance = 0;
  if (!closeToRoute) {
    return "";
  }

  const startPos = featureCoordinates.findIndex(element => element.toString() == closestPoint.toString());
  // measure route remaining distance
  try {
    const distanceToStartPos = getDistance(
      toLonLat(currentPosition),
      toLonLat(featureCoordinates[startPos + 1]),
    );
    remainingDistance += distanceToStartPos;
    distanceToNextStep += distanceToStartPos;
    if (navigationSteps.length > 0) {
      nextStep = navigationSteps.find(element => element.stepIndex > startPos);
      nextStepIndex = nextStep.stepIndex;
    }

    for (let i = startPos + 1; i < featureCoordinates.length - 1; i++) {
      remainingDistance += getDistance(
        toLonLat(featureCoordinates[i]),
        toLonLat(featureCoordinates[i + 1]),
      );

      if (i < nextStepIndex) {
        distanceToNextStep += getDistance(
          toLonLat(featureCoordinates[i]),
          toLonLat(featureCoordinates[i + 1])
        );
      }
    }
  } catch (error) {
    console.log(error);
    // measure distance if past the last featureCoordinates
    remainingDistance += getDistance(
      toLonLat(currentPosition),
      toLonLat(featureCoordinates[featureCoordinates.length - 1]),
    );
  }

  // calculate remaining time
  const secondsInt = (remainingDistance / 1000) / ((speedKmh < 30 ? 75 : speedKmh) / 60 / 60);
  const totalMinutes = Math.floor(secondsInt / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ETA = new Date(new Date().getTime() + secondsInt * 1000);

  // const infoTable = document.getElementById("infoTable");
  // const testRow = infoTable.insertRow(3);
  // var cell1 = testRow.insertCell(0);
  // var cell2 = testRow.insertCell(1);
  // cell1.innerHTML = "1";
  // cell1.colSpan = 2;
  // cell2.innerHTML = "NEW CELL2";
  // testRow.remove()
  // testRow.deleteCell(1);
  // infoTable.deleteRow(3)

  // first row
  routeInfoRemainingDistance.innerHTML = `<font class="">⩡</font>${Number(remainingDistance / 1000).toFixed(1)}<font class="infoFormat">km</font>`;

  let remainingTime = ``;
  if (hours > 0) {
    remainingTime += `${hours}<font class="infoFormat">h</font> `;
  }
  remainingTime += `${minutes}<font class="infoFormat">min</font>`
  routeInfoRemainingTime.innerHTML = remainingTime;
  
  // second row
  distanceToNextStep = distanceToNextStep > 1000 ?
    ((distanceToNextStep / 1000).toFixed(1) + '<font class="infoFormat">km</font>') :
    ((Math.round(distanceToNextStep / 25) * 25) + '<font class="infoFormat">m</font>');
  routeInfoTurnHint.innerHTML = `${nextStep ? (createTurnHint(nextStep) + distanceToNextStep) : ""}`;
  routeInfoETA.innerHTML = `${ETA.getHours()}:${ETA.getMinutes().toString().padStart(2, "0")}<font class="infoFormat">ETA</font>`;
  // third row
  routeInfoDestinations.innerHTML = nextStep ? (nextStep.destinations || nextStep.name || "") : "";
}

const translateArray = {
  "turn": "sväng",
  "new name": "↑", //?
  // "depart": "start",
  "arrive": "🏁",
  "merge": "⇈↖", //?
  "on ramp": "⇈↖",
  "off ramp": "⇈↗",
  // "fork": "", //?
  "end of road right": "↱",
  "end of road left": "↰",
  "end of road slight right": "↱",
  "end of road slight left": "↰",
  "end of road sharp right": "↱",
  "end of road sharp left": "↰",
  "end of road": "slutet av vägen",
  "continue": "↑",
  "roundabout": "⟲",
  "rotary": "⟲",
  "roundabout turn": "⟲",
  // "notification": "", //?
  "exit roundabout": "⟲",
  "exit rotary": "⟲",
  // turns
  "uturn": "↶",
  "sharp right": "⟶",
  "right": "⟶",
  "slight right": "⟶",
  "straight": "↑",
  "slight left": "⟵",
  "left": "⟵",
  "sharp left": "⟵",
  1: "➊",
  2: "➋",
  3: "➌",
  4: "➍",
  5: "➎",
};

export function createTurnHint(routeStep) {
  const destinations = routeStep.destinations;
  const maneuverType = routeStep.maneuver.type;
  const maneuverModifier = routeStep.maneuver.modifier;
  const roundaboutExit = routeStep.maneuver.exit;
  const maneuverName = routeStep.name;
  const rampExit = routeStep.exits;
  const ref = routeStep.ref;

  // if (!translateArray.hasOwnProperty(maneuverType)) {
  //   return
  // }

  const turnString = [];

  if (["roundabout turn"].includes(maneuverType)) {
    // turnString.push(destinations);
    turnString.push(translateArray[maneuverType]);
    turnString.push(translateArray[maneuverModifier]);
  }

  if (["roundabout", "rotary", "exit roundabout", "exit rotary"].includes(maneuverType)) {
    turnString.push(translateArray[maneuverType]);
    turnString.push(translateArray[roundaboutExit]);
  }

  if (["arrive"].includes(maneuverType)) {
    turnString.unshift(translateArray[maneuverType]);
  }

  if (maneuverType == "end of road") {
    turnString.push(translateArray["end of road " + maneuverModifier]);
  }

  if (["turn", "fork", "continue"].includes(maneuverType)) {
    turnString.push(translateArray[maneuverModifier]);
  }

  if (["on ramp", "off ramp"].includes(maneuverType)) {
    turnString.push(translateArray[maneuverType]);
  }

  if (["merge"].includes(maneuverType)) {
    turnString.push(translateArray[maneuverType]);
  }

  if (["straight", "new name"].includes(maneuverType)) {
    turnString.push(translateArray[maneuverType]);
  }

  // console.log(routeStep);
  // console.log(turnString);
  return turnString.filter(element => element).join("");
}

// convert degrees to radians
export function degToRad(deg) {
  return (deg * Math.PI * 2) / 360;
}

export function radToDeg(rad) {
  return rad * (180 / Math.PI);
}

export function findIndexOf(value, array) {
  return array.findIndex(element => element.toString() == value.toString())
}