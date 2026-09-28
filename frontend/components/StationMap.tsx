"use client";

import { INDIA_OUTLINE, project } from "@/lib/india";

export type MapStation = {
  station_id: string;
  name: string;
  lat: number;
  lon: number;
  fill: string;
  label: string;
};

const WIDTH = 640;
const HEIGHT = 760;

export function StationMap({
  stations,
  selectedId,
  onSelect,
}: {
  stations: MapStation[];
  selectedId?: string;
  onSelect?: (stationId: string) => void;
}) {
  const outline = INDIA_OUTLINE.map(([lon, lat]) => {
    const point = project(lon, lat, WIDTH, HEIGHT);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" role="img" aria-label="India station map">
      <rect width={WIDTH} height={HEIGHT} fill="#091722" rx="18" />
      <polygon points={outline} fill="#10283a" stroke="#2ee6c7" strokeOpacity="0.45" strokeWidth="1.4" />
      {stations.map((station) => {
        const { x, y } = project(station.lon, station.lat, WIDTH, HEIGHT);
        const selected = station.station_id === selectedId;
        return (
          <g key={station.station_id} onClick={() => onSelect?.(station.station_id)} className="cursor-pointer">
            <title>{`${station.name}: ${station.label}`}</title>
            {selected && <circle cx={x} cy={y} r={16} fill="none" stroke="#e7f2f4" strokeWidth="1.2" />}
            <circle cx={x} cy={y} r={selected ? 9 : 7} fill={station.fill} stroke="#071018" strokeWidth="1.5" />
            {selected && (
              <text x={x + 12} y={y - 10} fill="#e7f2f4" fontSize="13" fontFamily="IBM Plex Mono, ui-monospace, monospace">
                {station.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
