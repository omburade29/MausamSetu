export type Station = {
  station_id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  terrain: string;
  coast_km: number;
};

export type Meta = {
  generated_at: string;
  engine: string;
  test_start: string;
  default_date: string;
  date_min: string;
  date_max: string;
  dates: string[];
  variables: string[];
  leads: number[];
  sources: string[];
  units: Record<string, string>;
  stations: Station[];
  n_rows: number;
  thresholds: {
    heavy_rainfall_mm: number;
    high_wind_ms: number;
    heatwave_c: Record<string, number>;
  };
  ready: boolean;
};

export type ForecastPoint = {
  station_id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  terrain: string;
  regime: string;
  season: string;
  nwp: number;
  ai: number;
  ensemble: number;
  blended: number;
  blended_raw: number;
  truth: number;
  w_nwp: number;
  w_ai: number;
  w_ensemble: number;
  dominant: "NWP" | "AI" | "ENSEMBLE";
};

export type ForecastResponse = {
  variable: string;
  lead_time_hours: number;
  valid_time: string;
  units: string;
  points: ForecastPoint[];
};

export type WeightProfile = {
  variable: string;
  valid_time: string;
  by_lead: { lead_time_hours: number; terrain: string | null; w_nwp: number; w_ai: number; w_ensemble: number }[];
  by_terrain: { lead_time_hours: number; terrain: string | null; w_nwp: number; w_ai: number; w_ensemble: number }[];
};

export type TimeSeries = {
  station_id: string;
  name: string;
  variable: string;
  lead_time_hours: number;
  units: string;
  points: {
    valid_time: string;
    nwp: number;
    ai: number;
    ensemble: number;
    blended: number;
    truth: number;
    w_nwp: number;
    w_ai: number;
    w_ensemble: number;
  }[];
};

export type ScoreRow = {
  variable: string;
  model: string;
  n: number;
  rmse: number;
  mae: number;
  correlation: number | null;
  lead_time_hours?: number;
  terrain?: string;
};

export type ExtremeScore = {
  variable: string;
  model: string;
  event: string;
  hits: number;
  misses: number;
  false_alarms: number;
  pod: number | null;
  far: number | null;
  csi: number | null;
};

export type Metrics = {
  by_variable: ScoreRow[];
  by_lead: ScoreRow[];
  by_terrain: ScoreRow[];
  extreme_scores: ExtremeScore[];
  test_start: string;
  test_end: string;
  note: string;
  summary: {
    mean_improvement_pct: number;
    variables: Record<
      string,
      {
        best_individual: string;
        best_individual_rmse: number;
        blended_rmse: number;
        blended_mae: number;
        blended_correlation: number | null;
        improvement_pct: number;
      }
    >;
  };
};

export type Alert = {
  station_id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  terrain: string;
  valid_time: string;
  lead_time_hours: number;
  variable: string;
  event: string;
  severity: "high" | "moderate" | "low";
  probability: number;
  blended: number;
  threshold: number;
  regime: string;
};

export type ExtremesResponse = {
  valid_time: string;
  lead_time_hours: number;
  alerts: Alert[];
  counts: Record<string, number>;
};

export type OperationalResult = {
  status: string;
  appended_valid_time: string | null;
  date_min: string;
  date_max: string;
  n_rows: number;
  alerts: Alert[];
  message: string;
};
