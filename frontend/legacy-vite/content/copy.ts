import type { ModelId, PredictorId, VariableId } from "@/types"

export const STATEMENTS = [
  "This is a prototype decision-support tool.",
  "Demo values may be simulated.",
  "Finer spatial detail does not automatically imply higher forecast accuracy.",
  "Validation depends on available fine-scale reference data.",
  "This is not an official warning or emergency alert system.",
  "Verify advisories with official meteorological and agricultural guidance.",
]

export const ADVISORY_DISCLAIMER =
  "Prototype advisory generated from demo downscaled data. Verify with official local guidance."

export const VALIDATION_WARNING =
  "Validation quality depends on the availability and reliability of fine-scale reference observations."

export const VARIABLE_META: Record<VariableId, { label: string; unit: string; decimals: number }> = {
  rainfall_mm: { label: "Rainfall", unit: "mm", decimals: 1 },
  temperature_c: { label: "Temperature", unit: "°C", decimals: 1 },
  humidity_pct: { label: "Humidity", unit: "%", decimals: 0 },
  wind_kmh: { label: "Wind", unit: "km/h", decimals: 1 },
}

export const MODEL_LABELS: Record<ModelId, string> = {
  contextual_baseline: "Contextual Baseline",
  random_forest: "Random Forest Prototype",
}

export const MODEL_LIMITATIONS: Record<ModelId, string> = {
  contextual_baseline:
    "Transparent weighted adjustment. It redistributes the block forecast using relative geographic context inside this block. It is not a physical weather model and it does not create new observed skill by itself.",
  random_forest:
    "Random Forest trained on deterministic synthetic samples for this prototype. Feature importance is impurity-based and indicative only. It is not an operational forecast model.",
}

export const PREDICTORS: { id: PredictorId; label: string }[] = [
  { id: "elevation", label: "Elevation" },
  { id: "location", label: "Location" },
  { id: "land_cover", label: "Land-cover proxy" },
  { id: "soil_moisture", label: "Soil-moisture proxy" },
  { id: "distance_water", label: "Distance from water" },
  { id: "vegetation", label: "Vegetation proxy" },
]

export const ALL_PREDICTORS = PREDICTORS.map((item) => item.id)
