export type VariableId = "rainfall_mm" | "temperature_c" | "humidity_pct" | "wind_kmh"
export type ModelId = "contextual_baseline" | "random_forest"
export type PredictorId =
  | "elevation"
  | "location"
  | "land_cover"
  | "soil_moisture"
  | "distance_water"
  | "vegetation"
export type RiskLevel = "Low" | "Moderate" | "High"
export type UncertaintyCategory = "Low uncertainty" | "Moderate uncertainty" | "High uncertainty"

export interface PolygonGeometry {
  type: "Polygon"
  coordinates: number[][][]
}

export interface RegionBlock {
  id: string
  name: string
  panchayat_count: number
  representative_point: { latitude: number; longitude: number }
  note?: string
}

export interface RegionDistrict {
  id: string
  name: string
  blocks: RegionBlock[]
}

export interface RegionState {
  id: string
  name: string
  districts: RegionDistrict[]
}

export interface RegionsFile {
  source: "demo_simulation"
  is_simulated: boolean
  description?: string
  states: RegionState[]
}

export interface WeatherValues {
  rainfall_mm: number
  temperature_c: number
  humidity_pct: number
  wind_kmh: number
}

export interface BlockForecast {
  block_id: string
  block_name: string
  state_name: string
  district_name: string
  date: string
  dates: string[]
  values: WeatherValues
  series: Array<WeatherValues & { date: string }>
  resolution: string
  resolution_text: string
  geometry: PolygonGeometry
  representative_point: { latitude: number; longitude: number }
  note: string
  source: "demo_simulation"
  is_simulated: true
}

export interface PanchayatFeature {
  id: string
  name: string
  latitude: number
  longitude: number
  geometry: PolygonGeometry
  elevation_m: number | null
  land_cover: number | null
  soil_moisture: number | null
  distance_to_water_km: number | null
  vegetation: number | null
  data_quality: number | null
}

export interface UncertaintyScore {
  value: number
  category: UncertaintyCategory
  confidence: number
  explanation: string
  completeness: number
  distance_km: number
  model_residual: number
}

export interface Contribution {
  id: PredictorId
  label: string
  normalized: number
  weighted_effect: number
  weight: number
  available: boolean
  imputed: boolean
}

export interface PanchayatForecast {
  panchayat_id: string
  name: string
  latitude: number
  longitude: number
  geometry: PolygonGeometry
  forecasts: WeatherValues
  baseline: WeatherValues
  reference: WeatherValues | null
  adjustments: Record<VariableId, number>
  uncertainty_by_variable: Record<VariableId, UncertaintyScore>
  predictor_contributions: Record<VariableId, Contribution[]>
  predictors: {
    elevation_m: number | null
    land_cover: number | null
    soil_moisture: number | null
    distance_to_water_km: number | null
    vegetation: number | null
    data_quality: number | null
  }
  data_quality: number
  advisory_priority: RiskLevel
  source: "demo_simulation"
  is_simulated: true
}

export interface MetricBlock {
  mae: number
  rmse: number
  bias: number
  r2: number | null
}

export interface ValidationRow {
  panchayat_id: string
  panchayat: string
  baseline: number
  downscaled: number
  reference: number
  baseline_error: number
  downscaled_error: number
  difference: number
  uncertainty_category: UncertaintyCategory
  confidence: number
}

export interface ValidationReport {
  variable: VariableId | string
  label: string
  unit: string
  baseline_metrics: MetricBlock
  downscaled_metrics: MetricBlock
  improvement_percent: number | null
  rows: ValidationRow[]
  warning: string
  reference_note: string
  labels: Record<string, string>
  simulation_mode: boolean
  source: "demo_simulation"
  is_simulated: true
}

export interface Advisory {
  panchayat_id: string
  panchayat: string
  risk_level: RiskLevel
  weather_condition: string
  recommended_farm_action: string
  recommended_actions: string[]
  reason: string
  validity: string
  data_confidence: number
  uncertainty_category: UncertaintyCategory
  advisory_priority: RiskLevel
  crop_context: string
  disclaimer: string
  source: "demo_simulation"
  is_simulated: true
}

export interface ImportanceRow {
  id: PredictorId
  label: string
  value: number
  kind: string
}

export interface DownscaleRun {
  run_id: string
  status: string
  created_at: string
  model: ModelId
  model_label: string
  geography: {
    state_id: string
    state_name: string
    district_id: string
    district_name: string
    block_id: string
    block_name: string
    date: string
  }
  variable: VariableId
  variable_label: string
  unit: string
  predictors: PredictorId[]
  predictor_labels: Record<string, string>
  block_forecast: {
    date: string
    values: WeatherValues
    primary_value: number
    resolution: string
    resolution_text: string
    series: Array<WeatherValues & { date: string }>
    source: "demo_simulation"
    is_simulated: true
  }
  block_geometry: PolygonGeometry
  panchayat_forecasts: PanchayatForecast[]
  uncertainty_summary: {
    mean_uncertainty: number
    mean_confidence: number
    counts: Record<UncertaintyCategory, number>
    average_forecast: number
    highest_risk_panchayat: {
      id: string
      name: string
      priority: RiskLevel
      confidence: number
    }
    explanation: string
  }
  validation_metrics: ValidationReport
  validations: Record<VariableId, ValidationReport>
  advisories: Advisory[]
  feature_importance: Record<VariableId, ImportanceRow[]>
  weights: Partial<Record<PredictorId, number>>
  simulation_metadata: {
    source: "demo_simulation"
    is_simulated: true
    seed: number
    model_limitation: string
    reference_note: string
    resolution_before: string
    resolution_after: string
    statements: string[]
    fallback_note?: string
  }
}

export interface HistoryItem {
  run_id: string
  created_at: string
  state_name: string
  district_name: string
  block_name: string
  block_id: string
  variable: string
  model: string
  panchayat_count: number
  validation_status: string
  source: "demo_simulation"
  is_simulated: true
}

export interface Selection {
  stateId: string
  districtId: string
  blockId: string
  date: string
  variable: VariableId
  model: ModelId
  predictors: PredictorId[]
}
