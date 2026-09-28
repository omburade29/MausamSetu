export type Role = "farmer" | "officer" | "admin";

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  state: string | null;
  district: string | null;
};

export type Place = {
  id: number;
  name: string;
  code: string;
  state_id?: number;
  district_id?: number;
  block_id?: number;
  latitude?: number;
  longitude?: number;
  elevation_mean?: number;
  land_cover_type?: string;
  distance_to_water_km?: number;
  geometry?: { type: string; coordinates: unknown } | null;
  block_name?: string;
  district_name?: string;
  state_name?: string;
};

export type Forecast = {
  id: number;
  panchayat_id: number;
  panchayat_code?: string | null;
  forecast_time: string;
  model_version: string;
  rainfall_mm: number;
  temperature_min_c: number;
  temperature_max_c: number;
  humidity_percent: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  cloud_cover_percent: number;
  probability_of_rain: number;
  lower_bound: number;
  upper_bound: number;
  confidence_score: number;
  low_confidence: boolean;
  intervals: Record<string, { lower: number; upper: number }>;
  confidence_by_variable: Record<string, number>;
  data_source_label: string;
  generated_at: string;
  estimate_kind: string;
};

export type CompareVariable = {
  variable: string;
  unit: string;
  block_forecast: number | null;
  downscaled: number | null;
  observed: number | null;
  historical_average: number | null;
  difference_downscaled_minus_block: number | null;
  lower_bound: number | null;
  upper_bound: number | null;
  confidence_score: number | null;
};

export type ComparePayload = {
  panchayat: { id: number; name: string; code: string };
  date: string;
  model_version: string;
  generated_at: string;
  data_source_label: string;
  block_source_label: string;
  observed_source_label: string;
  official_forecast: boolean;
  disclaimer: string;
  variables: CompareVariable[];
  downscaled: Forecast;
  block: Record<string, number | string | null> | null;
};

export type Advisory = {
  id: number;
  panchayat_id: number;
  panchayat_name?: string | null;
  crop_id: number;
  crop_stage_id: number | null;
  forecast_date: string;
  advisory_type: string;
  title: string;
  message: string;
  reason: string;
  action: string;
  severity: string;
  confidence_score: number | null;
  low_confidence: boolean;
  soil_type: string | null;
  disclaimer: string;
  status: string;
  rule_id: string | null;
};

export type Crop = {
  id: number;
  name: string;
  scientific_name: string;
  season: string;
  typical_duration_days: number;
  stages: { id: number; name: string; start_day: number; end_day: number }[];
};

export type ModelRun = {
  id: number;
  model_name: string;
  model_version: string;
  variable: string;
  mae: number | null;
  rmse: number | null;
  r2: number | null;
  bias: number | null;
  correlation: number | null;
  baseline_mae: number | null;
  baseline_rmse: number | null;
  improvement_percent: number | null;
  crps: number | null;
  interval_coverage: number | null;
  average_interval_width: number | null;
  statement: string;
  by_horizon?: { key: string; rmse: number | null; baseline_rmse: number | null; improvement_percent: number | null }[];
  by_season?: { key: string; rmse: number | null; baseline_rmse: number | null; improvement_percent: number | null }[];
  by_panchayat?: { key: string; rmse: number | null; baseline_rmse: number | null; improvement_percent: number | null }[];
  rain_classification?: { accuracy: number | null; precision: number | null; recall: number | null; f1: number | null } | null;
  created_at: string;
};

export type Envelope<T> = {
  data: T;
  meta?: { page: number; page_size: number; total: number };
  disclaimer?: string;
  source?: { label?: string; official_forecast?: boolean; kind?: string };
};

export type MapFeatureCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: string; coordinates: number[] | number[][] | number[][][] };
    properties: {
      id: number;
      name: string;
      code: string;
      value: number | null;
      unit: string;
      layer: string;
      confidence_score: number | null;
      low_confidence: boolean;
      note: string;
      data_source_label: string;
      model_version: string | null;
      generated_at: string | null;
    };
  }[];
  date: string;
  official_forecast: boolean;
};
