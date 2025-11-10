import { Stroke, Style, Icon, Fill, Text } from "ol/style.js";

export function trafficWarningTextStyleFunction(feature) {
    //Function to determine style of icons
    return [
        new Style({
            text: new Text({
                text: feature.get("name"),
                font: "13px Arial, Helvetica, sans-serif",
                textAlign: "left",
                textBaseline: "top",
                offsetX: 20,
                fill: new Fill({
                    color: "black",
                }),
                backgroundFill: new Fill({
                    color: [252, 208, 30, 0.9],
                }),
                backgroundStroke: new Stroke({
                    color: [238, 41, 61, 0.9],
                    width: 2,
                }),
                padding: [1, 1, 1, 1],
            }),
        }),
    ];
};
export function trafficWarningIconStyleFunction(feature) {
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
            scale: 0.8,
        }),
    ];
};

export function gpxStyleText(feature) {
    const featureType = feature.getGeometry().getType();
    if (featureType == "Point") {
        return new Style({
            text: new Text({
                text: feature.get("name"),
                font: "13px Arial, Helvetica, sans-serif",
                placement: "line",
                textAlign: "left",
                textBaseline: "bottom",
                offsetX: 10,
                fill: new Fill({
                    color: "#b41412",
                }),
                backgroundFill: new Fill({
                    color: [255, 255, 255, 0.9],
                }),
                backgroundStroke: new Stroke({
                    color: [0, 0, 0, 0.9],
                    width: 1.5,
                }),
                padding: [0, 0, 0, 1],
            }),
        });
    }
}

export function gpxStyle(feature) {
    const featureType = feature.getGeometry().getType();
    if (featureType == "Point") {
        return new Style({
            image: new Icon({
                anchor: [0.5, 1],
                src: "https://jole84.se/poi-marker.svg",
                opacity: 0.8,
                scale: 0.8,
            }),
        });
    }

    if (featureType == "LineString" || featureType == "MultiLineString") {
        return new Style({
            stroke: new Stroke({
                color: [0, 0, 255, 0.5],
                width: 10,
            }),
        });
    }

    if (featureType == "Polygon" || featureType == "MultiPolygon") {
        return new Style({
            stroke: new Stroke({
                color: [255, 0, 0, 1],
                width: 2,
            }),
            fill: new Fill({
                color: [255, 0, 0, 0.2],
            }),
            text: new Text({
                text: feature.get("name"),
                font: "13px Arial, Helvetica, sans-serif",
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

export function userLocationStyle(feature) {
    return new Style({
        text: new Text({
            text: feature.get("name"),
            font: "12px Arial, Helvetica, sans-serif",
            textAlign: "left",
            textBaseline: "top",
            offsetX: 17,
            offsetY: 5,
            fill: new Fill({
                color: "black",
            }),
            // stroke: new Stroke({
            //     color: "white",
            //     width: 4,
            // }),
            backgroundFill: new Fill({
                color: [255, 255, 255, 1],
            }),
            backgroundStroke: new Stroke({
                color: [0, 0, 0, 1],
                width: 1.5,
            }),
            padding: [1, 0, 0, 2],
        }),
        image: new Icon({
            rotation: feature.get("rotation"),
            rotateWithView: true,
            anchor: [0.5, 0.67],
            color: "red",
            src: "https://openlayers.org/en/latest/examples/data/geolocation_marker_heading.png",
        }),
    });
}

export function trackStyle(feature) {
    return new Style({
        stroke: new Stroke({
            color: [255, 0, 0, 0.9],
            width: 4,
        }),
    })
}

export function routeStyle(feature) {
    const featureType = feature.getGeometry().getType();
    if (featureType == "LineString" || featureType == "MultiLineString") {
        return new Style({
            stroke: new Stroke({
                color: [0, 0, 255, 0.5],
                width: 10,
            }),
        })
    }
    if (featureType == "Point") {
        return new Style({
            image: new Icon({
                anchor: [0.5, 1],
                src: "https://jole84.se/end-marker.svg",
                opacity: 0.8,
                scale: 0.8,
            }),
        })
    }
}