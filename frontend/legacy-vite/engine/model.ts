import type { PredictorId, UncertaintyCategory, VariableId } from "@/types"

export const PREDICTOR_ORDER: PredictorId[] = [
  "elevation",
  "location",
  "land_cover",
  "soil_moisture",
  "distance_water",
  "vegetation",
]

const CORE_WEIGHTS: Record<Exclude<PredictorId, "vegetation">, number> = {
  elevation: 0.3,
  location: 0.25,
  land_cover: 0.2,
  soil_moisture: 0.15,
  distance_water: 0.1,
}

const EFFECT_SIGN: Record<VariableId, Record<PredictorId, number>> = {
  rainfall_mm: {
    elevation: -0.45,
    location: 0.55,
    land_cover: -0.15,
    soil_moisture: 0.7,
    distance_water: -1,
    vegetation: 0.3,
  },
  temperature_c: {
    elevation: -0.9,
    location: 0.25,
    land_cover: 0.15,
    soil_moisture: -0.55,
    distance_water: 0.8,
    vegetation: -0.7,
  },
  humidity_pct: {
    elevation: -0.35,
    location: -0.2,
    land_cover: 0.1,
    soil_moisture: 0.85,
    distance_water: -0.9,
    vegetation: 0.4,
  },
  wind_kmh: {
    elevation: 0.55,
    location: 0.2,
    land_cover: -0.25,
    soil_moisture: -0.1,
    distance_water: 0.45,
    vegetation: -0.85,
  },
}

const LIMITS: Record<VariableId, [number, number]> = {
  rainfall_mm: [0, 250],
  temperature_c: [8, 48],
  humidity_pct: [20, 98],
  wind_kmh: [0, 80],
}

export function clamp(value: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, value))
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dphi = ((lat2 - lat1) * Math.PI) / 180
  const dlmb = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlmb / 2) ** 2
  return 2 * radius * Math.asin(Math.sqrt(Math.min(1, a)))
}

export function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

export function normalize(values: number[]) {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  if (Math.abs(hi - lo) < 1e-9) return values.map(() => 0)
  return values.map((value) => (2 * (value - lo)) / (hi - lo) - 1)
}

export function activeWeights(selected: PredictorId[]) {
  const chosen = PREDICTOR_ORDER.filter((key) => selected.includes(key))
  if (!chosen.length) return {} as Partial<Record<PredictorId, number>>
  const useVeg = chosen.includes("vegetation")
  const raw: Partial<Record<PredictorId, number>> = {}
  for (const key of chosen) {
    if (key === "vegetation") continue
    raw[key] = CORE_WEIGHTS[key] * (useVeg ? 0.9 : 1)
  }
  if (useVeg) raw.vegetation = chosen.length > 1 ? 0.1 : 1
  const total = Object.values(raw).reduce((sum, value) => sum + (value ?? 0), 0)
  const weights: Partial<Record<PredictorId, number>> = {}
  for (const [key, value] of Object.entries(raw) as Array<[PredictorId, number]>) {
    weights[key] = value / total
  }
  return weights
}

export function applyAdjustment(blockValue: number, raw: number, variable: VariableId) {
  if (variable === "rainfall_mm") {
    const factor = clamp(raw * 0.62, -0.3, 0.42)
    return { value: clamp(blockValue * (1 + factor), ...LIMITS[variable]), adjustment: factor }
  }
  if (variable === "temperature_c") {
    const delta = clamp(raw * 2.8, -3.2, 3.2)
    return { value: clamp(blockValue + delta, ...LIMITS[variable]), adjustment: delta }
  }
  if (variable === "humidity_pct") {
    const delta = clamp(raw * 8, -12, 12)
    return { value: clamp(blockValue + delta, ...LIMITS[variable]), adjustment: delta }
  }
  const factor = clamp(raw * 0.4, -0.28, 0.38)
  return { value: clamp(blockValue * (1 + factor), ...LIMITS.wind_kmh), adjustment: factor }
}

export function uncertaintyCategory(score: number): UncertaintyCategory {
  if (score < 0.33) return "Low uncertainty"
  if (score < 0.5) return "Moderate uncertainty"
  return "High uncertainty"
}

export function effectSign(variable: VariableId, predictor: PredictorId) {
  return EFFECT_SIGN[variable][predictor]
}

export function populationStd(values: number[]) {
  if (!values.length) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}
