"""Feature construction for block-to-panchayat downscaling.

Missing numeric values are filled with training-set medians. Unknown land cover
uses an explicit code. Rows are not dropped; only rows with a missing target
are left out of that variable's training set, and the exclusion is logged.
"""

from __future__ import annotations

import logging
import math

import numpy as np
import pandas as pd

from app.constants import LAND_COVER_CODES

logger = logging.getLogger("app.ml.features")

FEATURE_COLUMNS = [
    "block_rainfall_mm",
    "block_temperature_min_c",
    "block_temperature_max_c",
    "block_humidity_percent",
    "block_wind_speed_kmh",
    "block_wind_direction_sin",
    "block_wind_direction_cos",
    "block_cloud_cover_percent",
    "block_probability_of_rain",
    "latitude",
    "longitude",
    "elevation_m",
    "slope_degree",
    "aspect_sin",
    "aspect_cos",
    "distance_to_water_km",
    "land_cover_code",
    "hist_rain_mean",
    "hist_rain_std",
    "hist_temp_mean",
    "month",
    "doy_sin",
    "doy_cos",
    "lead_time_hours",
    "neighbor_elev_mean",
    "neighbor_rain_mean",
    "lag1_rainfall_mm",
    "lag1_temperature_max_c",
    "lag3_rainfall_mean",
    "correction_rainfall",
    "correction_temperature_max",
    "elevation_diff_m",
    "missing_feature_count",
]

TARGET_VARIABLES = [
    "rainfall_mm",
    "temperature_min_c",
    "temperature_max_c",
    "humidity_percent",
    "wind_speed_kmh",
    "cloud_cover_percent",
]


def chronological_split(dates, ratios: tuple[float, float, float] = (0.70, 0.15, 0.15)):
    """Split unique dates in time order. Later dates never enter an earlier split."""
    unique = sorted({pd.Timestamp(item).normalize() for item in dates})
    n = len(unique)
    if n < 3:
        raise ValueError("Need at least 3 distinct dates for a chronological split")
    i1 = max(1, int(n * ratios[0]))
    i2 = max(i1 + 1, int(n * (ratios[0] + ratios[1])))
    i2 = min(i2, n - 1)
    return unique[:i1], unique[i1:i2], unique[i2:]


def rolling_origin_splits(dates, n_splits: int = 3, min_train: int = 20):
    """Yield expanding-window (train_dates, test_dates) pairs."""
    unique = sorted({pd.Timestamp(item).normalize() for item in dates})
    if len(unique) <= min_train + 1:
        return
    usable = len(unique) - min_train
    fold = max(1, usable // n_splits)
    for split_index in range(n_splits):
        test_start = min_train + split_index * fold
        test_end = len(unique) if split_index == n_splits - 1 else min_train + (split_index + 1) * fold
        if test_start >= len(unique) or test_start >= test_end:
            continue
        yield unique[:test_start], unique[test_start:test_end]


def impute_numeric(frame: pd.DataFrame, columns: list[str], medians: dict | None = None, log: list | None = None):
    """Fill numeric gaps with medians. Does not drop rows."""
    notes = log if log is not None else []
    fitted = dict(medians or {})
    output = frame.copy()
    for column in columns:
        if column not in output.columns:
            continue
        if column not in fitted:
            series = output[column]
            fitted[column] = float(np.nanmedian(series.to_numpy(dtype=float))) if series.notna().any() else 0.0
        missing = int(output[column].isna().sum())
        if missing:
            notes.append(
                {"column": column, "imputed": missing, "strategy": "median", "value": fitted[column]}
            )
            logger.info("Imputed %s missing values in %s with median %s", missing, column, fitted[column])
            output[column] = output[column].fillna(fitted[column])
    return output, fitted, notes


def build_feature_table(
    panchayats: pd.DataFrame,
    observations: pd.DataFrame,
    block_forecasts: pd.DataFrame,
) -> tuple[pd.DataFrame, list[dict]]:
    log: list[dict] = []
    if panchayats.empty or block_forecasts.empty:
        return pd.DataFrame(columns=FEATURE_COLUMNS), [{"event": "empty_input", "rows": 0}]

    places = _prepare_places(panchayats, log)
    forecasts = _prepare_forecasts(block_forecasts)
    history = _prepare_history(observations)

    merged = forecasts.merge(places, on="block_id", how="inner")
    if not history.empty:
        merged = merged.merge(history, on=["panchayat_id", "day"], how="left")
    else:
        for column in _history_columns():
            merged[column] = np.nan

    merged = _attach_calendar(merged)
    merged = _attach_corrections(merged, log)
    merged = _attach_neighbor_rain(merged)
    merged = _carry_history_forward(merged)

    predictors = [column for column in FEATURE_COLUMNS if column != "missing_feature_count"]
    for column in predictors:
        if column not in merged.columns:
            merged[column] = np.nan
    merged["missing_feature_count"] = merged[predictors].isna().sum(axis=1)
    heavy = int((merged["missing_feature_count"] > len(predictors) / 2).sum())
    if heavy:
        log.append({"event": "rows_with_many_missing_features", "rows": heavy, "action": "kept_and_imputed_later"})
        logger.warning("Kept %s rows with more than half of features missing", heavy)

    if "target_rainfall_mm" not in merged.columns:
        merged["target_rainfall_mm"] = np.nan
    missing_targets = int(merged["target_rainfall_mm"].isna().sum())
    if missing_targets:
        log.append(
            {
                "event": "rows_without_observation_target",
                "rows": missing_targets,
                "action": "excluded_from_training_only",
            }
        )
    return merged, log


def _prepare_places(panchayats: pd.DataFrame, log: list[dict]) -> pd.DataFrame:
    places = panchayats.rename(columns={"id": "panchayat_id"}).copy()
    places["land_cover_code"] = places["land_cover_type"].map(LAND_COVER_CODES)
    unknown = int(places["land_cover_code"].isna().sum())
    if unknown:
        log.append({"column": "land_cover_code", "imputed": unknown, "strategy": "unknown_class", "value": -1})
        places["land_cover_code"] = places["land_cover_code"].fillna(-1)
    block_mean = places.groupby("block_id")["elevation_mean"].transform("mean")
    block_sum = places.groupby("block_id")["elevation_mean"].transform("sum")
    block_count = places.groupby("block_id")["panchayat_id"].transform("count")
    places["elevation_diff_m"] = places["elevation_mean"] - block_mean
    places["neighbor_elev_mean"] = (block_sum - places["elevation_mean"]) / (block_count - 1).clip(lower=1)
    places["aspect_sin"] = np.sin(np.deg2rad(places["aspect_mean"].astype(float)))
    places["aspect_cos"] = np.cos(np.deg2rad(places["aspect_mean"].astype(float)))
    places["elevation_m"] = places["elevation_mean"]
    places["slope_degree"] = places["slope_mean"]
    keep = [
        "panchayat_id",
        "block_id",
        "code",
        "name",
        "latitude",
        "longitude",
        "elevation_m",
        "slope_degree",
        "aspect_sin",
        "aspect_cos",
        "distance_to_water_km",
        "land_cover_code",
        "land_cover_type",
        "elevation_diff_m",
        "neighbor_elev_mean",
    ]
    return places[keep]


def _prepare_forecasts(block_forecasts: pd.DataFrame) -> pd.DataFrame:
    rename = {
        "id": "block_forecast_id",
        "rainfall_mm": "block_rainfall_mm",
        "temperature_min_c": "block_temperature_min_c",
        "temperature_max_c": "block_temperature_max_c",
        "humidity_percent": "block_humidity_percent",
        "wind_speed_kmh": "block_wind_speed_kmh",
        "wind_direction_deg": "block_wind_direction_deg",
        "cloud_cover_percent": "block_cloud_cover_percent",
        "probability_of_rain": "block_probability_of_rain",
    }
    forecasts = block_forecasts.rename(columns=rename).copy()
    forecasts["day"] = pd.to_datetime(forecasts["forecast_time"]).dt.normalize()
    direction = pd.to_numeric(forecasts["block_wind_direction_deg"], errors="coerce")
    forecasts["block_wind_direction_sin"] = np.sin(np.deg2rad(direction))
    forecasts["block_wind_direction_cos"] = np.cos(np.deg2rad(direction))
    return forecasts


def _history_columns() -> list[str]:
    targets = [f"target_{name}" for name in TARGET_VARIABLES]
    return targets + [
        "hist_rain_mean",
        "hist_rain_std",
        "hist_temp_mean",
        "lag1_rainfall_mm",
        "lag1_temperature_max_c",
        "lag3_rainfall_mean",
        "history_days",
    ]


def _prepare_history(observations: pd.DataFrame) -> pd.DataFrame:
    if observations.empty:
        return pd.DataFrame()
    obs = observations.copy()
    obs["day"] = pd.to_datetime(obs["observation_time"]).dt.normalize()
    obs = obs.sort_values(["panchayat_id", "day"])
    for name in TARGET_VARIABLES:
        obs[f"target_{name}"] = pd.to_numeric(obs[name], errors="coerce")
    grouped = obs.groupby("panchayat_id")
    obs["hist_rain_mean"] = grouped["target_rainfall_mm"].transform(lambda s: s.shift(1).expanding().mean())
    obs["hist_rain_std"] = grouped["target_rainfall_mm"].transform(lambda s: s.shift(1).expanding().std())
    obs["hist_temp_mean"] = grouped["target_temperature_max_c"].transform(lambda s: s.shift(1).expanding().mean())
    obs["lag1_rainfall_mm"] = grouped["target_rainfall_mm"].shift(1)
    obs["lag1_temperature_max_c"] = grouped["target_temperature_max_c"].shift(1)
    obs["lag3_rainfall_mean"] = grouped["target_rainfall_mm"].transform(
        lambda s: s.shift(1).rolling(3, min_periods=1).mean()
    )
    obs["history_days"] = grouped.cumcount()
    columns = ["panchayat_id", "day", *_history_columns()]
    return obs[columns]


def _attach_calendar(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    day = pd.to_datetime(out["day"])
    doy = day.dt.dayofyear
    out["month"] = day.dt.month.astype(float)
    out["doy_sin"] = np.sin(2 * math.pi * doy / 365.25)
    out["doy_cos"] = np.cos(2 * math.pi * doy / 365.25)
    return out


def _attach_corrections(frame: pd.DataFrame, log: list[dict]) -> pd.DataFrame:
    out = frame.copy()
    lead = pd.to_numeric(out["lead_time_hours"], errors="coerce")
    preferred = out[lead == 24].copy()
    if preferred.empty:
        preferred = out.sort_values("lead_time_hours").groupby(["panchayat_id", "day"], as_index=False).head(1)
        log.append({"event": "correction_factor_lead", "detail": "24h lead missing; used shortest available lead"})
    preferred["residual_rain"] = preferred["target_rainfall_mm"] - preferred["block_rainfall_mm"]
    preferred["residual_tmax"] = preferred["target_temperature_max_c"] - preferred["block_temperature_max_c"]
    preferred = preferred.sort_values(["panchayat_id", "day"])
    grouped = preferred.groupby("panchayat_id")
    preferred["correction_rainfall"] = grouped["residual_rain"].transform(lambda s: s.shift(1).expanding().mean())
    preferred["correction_temperature_max"] = grouped["residual_tmax"].transform(
        lambda s: s.shift(1).expanding().mean()
    )
    corrections = preferred[["panchayat_id", "day", "correction_rainfall", "correction_temperature_max"]]
    return out.merge(corrections, on=["panchayat_id", "day"], how="left")


def _attach_neighbor_rain(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    daily = out.sort_values("lead_time_hours").groupby(["panchayat_id", "day"], as_index=False).head(1).copy()
    if daily.empty or "lag1_rainfall_mm" not in daily.columns:
        out["neighbor_rain_mean"] = np.nan
        return out
    sums = daily.groupby(["block_id", "day"])["lag1_rainfall_mm"].transform("sum")
    counts = daily.groupby(["block_id", "day"])["lag1_rainfall_mm"].transform("count")
    self_lag = daily["lag1_rainfall_mm"]
    daily["neighbor_rain_mean"] = (sums - self_lag) / (counts - 1).clip(lower=1)
    neighbor = daily[["panchayat_id", "day", "neighbor_rain_mean"]]
    return out.merge(neighbor, on=["panchayat_id", "day"], how="left")


def _carry_history_forward(frame: pd.DataFrame) -> pd.DataFrame:
    """Dates without an observation keep the latest strictly earlier history."""
    out = frame.sort_values(["panchayat_id", "day", "lead_time_hours"]).copy()
    columns = [
        "hist_rain_mean",
        "hist_rain_std",
        "hist_temp_mean",
        "lag1_rainfall_mm",
        "lag1_temperature_max_c",
        "lag3_rainfall_mean",
        "correction_rainfall",
        "correction_temperature_max",
        "neighbor_rain_mean",
        "history_days",
    ]
    for column in columns:
        if column not in out.columns:
            out[column] = np.nan
        out[column] = out.groupby("panchayat_id")[column].ffill()
    out["history_days"] = out["history_days"].fillna(0)
    return out
