import { Feature } from "ol";
import { fromLonLat } from "ol/proj.js";
import { getDistance } from "ol/sphere";
import { GeoJSON } from "ol/format.js";
import VectorSource from "ol/source/Vector.js";

const apiUrl = "https://api.trafikinfo.trafikverket.se/v2/data.json";
const speedSource = new VectorSource();
let getPoint = [0, 0];
let currentSpeedlimit = 70;

export function getSpeedLimit(coordinate) {
  if (getDistance(getPoint, coordinate) > 5000 || speedSource.getFeatures().length < 1) {
    console.log("getting speenlimits");
    getPoint = coordinate;
    const xmlRequest = "<REQUEST>" +
      // Use your valid authenticationkey
      "<LOGIN authenticationkey='fa68891ca1284d38a637fe8d100861f0' />" +
      '<QUERY objecttype="Hastighetsgräns" namespace="vägdata.nvdb_dk_o" schemaversion="1.3">' +
      "<FILTER>" +
      `<NEAR name="Geometry.WKT-WGS84-3D" value="${coordinate[0]} ${coordinate[1]}" maxdistance="5000m"/>` +
      // '<NE name="Högsta_tillåtna_hastighet" value="70" />' +
      "</FILTER>" +
      "<INCLUDE>Högsta_tillåtna_hastighet</INCLUDE>" +
      "<INCLUDE>Geometry.WKT-WGS84-3D</INCLUDE>" +
      "</QUERY></REQUEST>";

    fetch(apiUrl, {
      method: "Post",
      headers: {
        "Content-Type": "text/xml",
      },
      body: xmlRequest,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(result => {
        const speedlimits = result.RESPONSE.RESULT[0].Hastighetsgräns;
        const format = new GeoJSON();
        speedSource.clear();
        speedlimits.forEach(element => {
          const linestring = turf.lineString(wkt2json(element.Geometry["WKT-WGS84-3D"]));
          const buffer = turf.buffer(linestring, 0.03, { steps: 1 });
          const feature = new Feature({
            geometry: format.readGeometry(buffer.geometry).transform("EPSG:4326", "EPSG:3857"),
            speed: element["Högsta_tillåtna_hastighet"],
          });
          speedSource.addFeature(feature);
        });
      });
  } else {
    const possibleSpeedLimits = [];
    speedSource.getFeaturesAtCoordinate(fromLonLat(coordinate)).forEach(function (feature) {
      possibleSpeedLimits.push(feature.get("speed"));
    });
    return determineSpeed(possibleSpeedLimits);
  }
}

function allEqual(arr) {
  return new Set(arr).size == 1;
}

function determineSpeed(possibleSpeedLimits) {
  if (allEqual(possibleSpeedLimits)) {
    currentSpeedlimit = possibleSpeedLimits[0];
  } else if (!possibleSpeedLimits[0]) {
    currentSpeedlimit = "";
  }
  return currentSpeedlimit;
}

function wkt2json(geometry) {
  const coordinateStrings = geometry.split("(")[1].split(")")[0].split(",");
  const returnCoordinates = [];
  coordinateStrings.forEach(function (item) {
    const coords = item.trim().split(" ");
    returnCoordinates.push([parseFloat((coords[0])), parseFloat(coords[1])]);
  });
  return returnCoordinates;
}