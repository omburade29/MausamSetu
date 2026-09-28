"use client";

const layers = [
  { id: "downscaled", label: "Downscaled estimate" },
  { id: "block", label: "Block forecast" },
  { id: "observed", label: "Observed" },
  { id: "error", label: "Model error" },
  { id: "confidence", label: "Confidence" },
];

const variables = [
  { id: "rainfall_mm", label: "Rainfall" },
  { id: "temperature_max_c", label: "Maximum temperature" },
  { id: "temperature_min_c", label: "Minimum temperature" },
  { id: "humidity_percent", label: "Humidity" },
  { id: "wind_speed_kmh", label: "Wind" },
];

export function MapLayerControl({
  layer,
  variable,
  onLayer,
  onVariable,
}: {
  layer: string;
  variable: string;
  onLayer: (value: string) => void;
  onVariable: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="font-medium">Layer</span>
        <select aria-label="Map layer" className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3" value={layer} onChange={(event) => onLayer(event.target.value)}>
          {layers.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="font-medium">Variable</span>
        <select aria-label="Map variable" className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3" value={variable} onChange={(event) => onVariable(event.target.value)} disabled={layer === "confidence"}>
          {variables.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
