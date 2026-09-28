"""Turn a feature table into constrained panchayat estimates with intervals."""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from app.config import get_settings
from app.constants import PANCHAYAT_SOURCE_LABEL, TARGET_VARIABLES
from app.ml.constraints import apply_constraints, clip_interval
from app.ml.features import FEATURE_COLUMNS, impute_numeric
from app.ml.spatial import smooth_group
from app.ml.train import _predict_rainfall, load_bundle
from app.ml.uncertainty import confidence_score, out_of_distribution, prediction_interval

logger = logging.getLogger("app.ml.predict")


def predict_frame(frame: pd.DataFrame, bundle: dict | None = None) -> tuple[pd.DataFrame, list[dict]]:
    """Predict every row. Uses the saved ML bundle, or bias correction if no model exists."""
    model = bundle if bundle is not None else load_bundle()
    if model is None:
        return statistical_fallback(frame)
    frame = frame.reset_index(drop=True).copy()
    log: list[dict] = []
    work, _, notes = impute_numeric(frame, FEATURE_COLUMNS, medians=model["medians"], log=log)
    log.extend(notes)
    features = work[FEATURE_COLUMNS].to_numpy(dtype=float)
    mean = np.asarray(model["feature_mean"], dtype=float)
    std = np.asarray(model["feature_std"], dtype=float)
    max_lead = max(model.get("trained_leads") or [24])

    raw = {variable: np.zeros(len(work)) for variable in TARGET_VARIABLES}
    for variable in TARGET_VARIABLES:
        if variable == "rainfall_mm":
            raw[variable] = np.asarray(_predict_rainfall(model["models"]["rainfall"], work), dtype=float)
        else:
            raw[variable] = np.asarray(model["models"][variable].predict(work[FEATURE_COLUMNS]), dtype=float)

    raw = _smooth(work, raw, log)
    records = []
    for index in range(len(work)):
        row = work.iloc[index]
        values = {variable: float(raw[variable][index]) for variable in TARGET_VARIABLES}
        if "block_probability_of_rain" in work.columns and pd.notna(row.get("block_probability_of_rain")):
            # Occurrence model is inside the rainfall point estimate. Keep a bounded probability.
            rain_q = model["conformal_q"].get("rainfall_mm", 1.0)
            chance = 1 - np.exp(-max(values["rainfall_mm"], 0) / 8.0)
            values["probability_of_rain"] = float(np.clip(0.5 * chance + 0.5 * float(row["block_probability_of_rain"]), 0, 1))
        else:
            values["probability_of_rain"] = float(np.clip(1 - np.exp(-max(values["rainfall_mm"], 0) / 8.0), 0, 1))
        direction = row.get("block_wind_direction_deg")
        values["wind_direction_deg"] = float(direction) if pd.notna(direction) else None
        clip_notes: list[dict] = []
        values = apply_constraints(values, clip_notes)
        log.extend(clip_notes)

        missing = int(row.get("missing_feature_count") or 0)
        history_days = int(row.get("history_days") or 0)
        lead = float(row.get("lead_time_hours") or 24)
        ood = out_of_distribution(features[index], mean, std)
        if lead not in set(model.get("trained_leads") or []):
            ood += 0.35
        intervals = {}
        confidences = {}
        for variable in TARGET_VARIABLES:
            qhat = float(model["conformal_q"].get(variable, 1.0))
            lower, upper = prediction_interval(values[variable], qhat, ood=ood)
            lower, upper = clip_interval(variable, lower, upper)
            if variable == "temperature_min_c" and upper > values["temperature_max_c"]:
                upper = values["temperature_max_c"]
            intervals[variable] = {"lower": lower, "upper": upper}
            width = upper - lower
            confidences[variable] = confidence_score(
                interval_width=width,
                typical_width=max(2 * qhat, 0.5),
                missing_count=missing,
                ood=ood,
                history_days=history_days,
                lead_time_hours=lead,
                max_lead_trained=max_lead,
            )
        headline = min(confidences.values()) if confidences else 0.5
        records.append(
            {
                "panchayat_id": int(row["panchayat_id"]),
                "block_forecast_id": None if pd.isna(row.get("block_forecast_id")) else int(row["block_forecast_id"]),
                "forecast_time": pd.Timestamp(row["day"]).to_pydatetime(),
                "model_version": model["model_version"],
                "rainfall_mm": values["rainfall_mm"],
                "temperature_min_c": values["temperature_min_c"],
                "temperature_max_c": values["temperature_max_c"],
                "humidity_percent": values["humidity_percent"],
                "wind_speed_kmh": values["wind_speed_kmh"],
                "wind_direction_deg": values["wind_direction_deg"],
                "cloud_cover_percent": values["cloud_cover_percent"],
                "probability_of_rain": values["probability_of_rain"],
                "lower_bound": intervals["rainfall_mm"]["lower"],
                "upper_bound": intervals["rainfall_mm"]["upper"],
                "confidence_score": headline,
                "intervals": intervals,
                "confidence_by_variable": confidences,
                "data_source_label": PANCHAYAT_SOURCE_LABEL,
                "code": row.get("code"),
                "lead_time_hours": lead,
            }
        )
    return pd.DataFrame(records), log


def _smooth(frame: pd.DataFrame, raw: dict[str, np.ndarray], log: list[dict]) -> dict[str, np.ndarray]:
    weight = get_settings().spatial_smooth_weight
    if weight <= 0:
        return raw
    out = {key: values.copy() for key, values in raw.items()}
    days = pd.to_datetime(frame["day"]).dt.normalize()
    for day, index in frame.groupby(days).groups.items():
        positions = list(index)
        for variable, values in out.items():
            group_values = [float(values[pos]) for pos in positions]
            smoothed, notes = smooth_group(group_values, weight=weight)
            for note in notes:
                note["day"] = str(pd.Timestamp(day).date())
                note["variable"] = variable
            log.extend(notes)
            for pos, value in zip(positions, smoothed):
                values[pos] = value
    return out


def statistical_fallback(frame: pd.DataFrame) -> tuple[pd.DataFrame, list[dict]]:
    """Historical mean bias correction when a trained model file is not present."""
    log = [{"event": "statistical_fallback", "reason": "model_bundle_missing"}]
    logger.warning("No trained model found. Using historical bias correction.")
    records = []
    for _, row in frame.iterrows():
        values = {}
        for variable in TARGET_VARIABLES:
            block_value = row.get(f"block_{variable}")
            block_value = float(block_value) if pd.notna(block_value) else 0.0
            if variable == "rainfall_mm":
                correction = row.get("correction_rainfall")
            elif variable == "temperature_max_c":
                correction = row.get("correction_temperature_max")
            elif variable == "temperature_min_c":
                correction = row.get("correction_temperature_max")
            else:
                correction = 0.0
            correction = float(correction) if pd.notna(correction) else 0.0
            values[variable] = block_value + correction
        values["probability_of_rain"] = float(row["block_probability_of_rain"]) if pd.notna(row.get("block_probability_of_rain")) else 0.0
        values["wind_direction_deg"] = float(row["block_wind_direction_deg"]) if pd.notna(row.get("block_wind_direction_deg")) else None
        values = apply_constraints(values, log)
        intervals = {}
        for variable in TARGET_VARIABLES:
            span = 2.0 if "temperature" in variable else (6.0 if variable == "rainfall_mm" else 8.0)
            lower, upper = clip_interval(variable, values[variable] - span, values[variable] + span)
            intervals[variable] = {"lower": lower, "upper": upper}
        history_days = int(row.get("history_days") or 0)
        confidences = {
            variable: confidence_score(
                interval_width=intervals[variable]["upper"] - intervals[variable]["lower"],
                typical_width=4.0,
                missing_count=int(row.get("missing_feature_count") or 0),
                ood=0.4,
                history_days=history_days,
                lead_time_hours=float(row.get("lead_time_hours") or 24),
                max_lead_trained=24,
            )
            for variable in TARGET_VARIABLES
        }
        # Bias correction is a baseline, so the headline confidence stays modest.
        headline = min(0.62, min(confidences.values()))
        records.append(
            {
                "panchayat_id": int(row["panchayat_id"]),
                "block_forecast_id": None if pd.isna(row.get("block_forecast_id")) else int(row["block_forecast_id"]),
                "forecast_time": pd.Timestamp(row["day"]).to_pydatetime(),
                "model_version": "statistical-bias-correction-1.0.0",
                "rainfall_mm": values["rainfall_mm"],
                "temperature_min_c": values["temperature_min_c"],
                "temperature_max_c": values["temperature_max_c"],
                "humidity_percent": values["humidity_percent"],
                "wind_speed_kmh": values["wind_speed_kmh"],
                "wind_direction_deg": values["wind_direction_deg"],
                "cloud_cover_percent": values["cloud_cover_percent"],
                "probability_of_rain": values["probability_of_rain"],
                "lower_bound": intervals["rainfall_mm"]["lower"],
                "upper_bound": intervals["rainfall_mm"]["upper"],
                "confidence_score": headline,
                "intervals": intervals,
                "confidence_by_variable": confidences,
                "data_source_label": PANCHAYAT_SOURCE_LABEL + " Method: historical bias correction.",
                "code": row.get("code"),
                "lead_time_hours": float(row.get("lead_time_hours") or 24),
            }
        )
    return pd.DataFrame(records), log
