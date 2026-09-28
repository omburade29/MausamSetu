/** Schematic mainland outline, lon/lat, for the station map. */
export const INDIA_OUTLINE: [number, number][] = [
  [68.2, 23.7],
  [69.1, 22.8],
  [70.4, 20.9],
  [72.6, 21.6],
  [72.8, 19.1],
  [73.2, 16.2],
  [74.1, 14.9],
  [74.9, 12.9],
  [76.2, 9.9],
  [77.5, 8.1],
  [78.2, 8.8],
  [79.8, 10.4],
  [80.3, 13.1],
  [80.2, 15.5],
  [81.2, 16.7],
  [83.3, 17.7],
  [85.1, 19.4],
  [87.0, 21.5],
  [88.2, 21.6],
  [88.6, 22.2],
  [88.1, 24.2],
  [88.2, 26.4],
  [89.8, 26.2],
  [92.0, 26.2],
  [93.9, 24.6],
  [94.6, 26.6],
  [97.0, 28.0],
  [97.2, 27.2],
  [95.2, 26.8],
  [92.4, 26.9],
  [89.4, 27.1],
  [85.3, 27.4],
  [82.4, 27.6],
  [80.0, 30.2],
  [77.5, 32.4],
  [76.4, 34.2],
  [74.4, 34.5],
  [73.9, 32.3],
  [74.4, 29.6],
  [71.4, 27.2],
  [69.6, 24.5],
  [68.2, 23.7],
];

export const GEO = {
  lonMin: 67.2,
  lonMax: 98.4,
  latMin: 6.2,
  latMax: 36.2,
};

export function project(lon: number, lat: number, width: number, height: number) {
  const x = ((lon - GEO.lonMin) / (GEO.lonMax - GEO.lonMin)) * width;
  const y = ((GEO.latMax - lat) / (GEO.latMax - GEO.latMin)) * height;
  return { x, y };
}
