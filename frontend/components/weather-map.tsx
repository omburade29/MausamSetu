"use client";

import { useEffect } from "react";
import L from "leaflet";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { MapFeatureCollection } from "@/types";
import { formatNumber } from "@/lib/format";
import "leaflet/dist/leaflet.css";

function collectLatLngs(node: unknown, points: [number, number][]) {
  if (!Array.isArray(node)) return;
  if (typeof node[0] === "number" && typeof node[1] === "number") {
    points.push([node[1] as number, node[0] as number]);
    return;
  }
  node.forEach((child) => collectLatLngs(child, points));
}

function FitMap({ collection }: { collection: MapFeatureCollection }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [];
    collection.features.forEach((feature) => collectLatLngs(feature.geometry?.coordinates, points));
    const frame = () => {
      map.invalidateSize();
      if (!points.length) return;
      const lats = points.map((point) => point[0]);
      const lngs = points.map((point) => point[1]);
      if (Math.max(...lats) - Math.min(...lats) < 0.02 && Math.max(...lngs) - Math.min(...lngs) < 0.02) {
        map.setView([lats[0], lngs[0]], 12);
        return;
      }
      map.fitBounds(
        [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ],
        { padding: [28, 28] },
      );
    };
    frame();
    const timer = window.setTimeout(frame, 200);
    return () => window.clearTimeout(timer);
  }, [map, collection]);
  return null;
}

function color(value: number | null, min: number, max: number) {
  if (value === null || Number.isNaN(value)) return "#d6d3d1";
  const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const red = Math.round(232 - t * 150);
  const green = Math.round(214 - t * 40);
  const blue = Math.round(176 + t * 40);
  return `rgb(${red}, ${green}, ${blue})`;
}

export default function WeatherMap({
  collection,
  onSelect,
  selectedId,
}: {
  collection: MapFeatureCollection;
  onSelect: (id: number) => void;
  selectedId?: number | null;
}) {
  const values = collection.features.map((feature) => feature.properties.value).filter((value): value is number => value !== null);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  return (
    <div className="h-[560px] w-full overflow-hidden rounded-2xl border border-line">
    <MapContainer center={[18.85, 74.25]} zoom={8} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
      <FitMap collection={collection} />
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <GeoJSON
        key={`${selectedId ?? "none"}-${JSON.stringify(collection.features.map((feature) => [feature.properties.id, feature.properties.value, feature.properties.layer]))}`}
        data={collection as never}
        pointToLayer={(feature, latlng) =>
          L.circleMarker(latlng, {
            radius: feature.properties.id === selectedId ? 9 : 6,
            color: feature.properties.id === selectedId ? "#0b1c33" : "#0f766e",
            weight: 2,
            fillColor: color(feature.properties.value ?? null, min, max),
            fillOpacity: 0.9,
          })
        }
        style={(feature) => ({
          color: feature?.properties.id === selectedId ? "#0b1c33" : "#0f766e",
          weight: feature?.properties.id === selectedId ? 3 : 1,
          fillColor: color(feature?.properties.value ?? null, min, max),
          fillOpacity: 0.78,
        })}
        onEachFeature={(feature, layer) => {
          const props = feature.properties;
          layer.bindTooltip(`${props.name}: ${formatNumber(props.value)} ${props.unit}`);
          layer.on("click", () => onSelect(props.id));
        }}
      />
    </MapContainer>
    </div>
  );
}
