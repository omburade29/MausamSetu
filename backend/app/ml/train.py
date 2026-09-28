"""Train separate downscaling models and compare them with the block baseline."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor

from app.config import get_settings
from app.ml.baseline import block_baseline
from app.ml.constraints import apply_constraints
from app.ml.features import FEATURE_COLUMNS, TARGET_VARIABLES, chronological_split, impute_numeric
from app.ml.metrics import (
    binary_scores,
    crps_gaussian,
    improvement_percent,
    improvement_statement,
    interval_stats,
    regression_metrics,
    season_name,
)
from app.ml.uncertainty import conformal_quantile

logger = logging.getLogger("app.ml.train")


def _point_regressor():
    try:
        from xgboost import XGBRegressor

        model = XGBRegressor(
            n_estimators=80,
            max_depth=3,
            learning_rate=0.08,
            subsample=0.9,
            colsample_bytree=0.9,
            objective="reg:squarederror",
            random_state=42,
            n_jobs=1,
        )
        return model, "xgboost"
    except Exception as exc:
        logger.warning("XGBoost unavailable (%s). Using HistGradientBoostingRegressor.", exc)
        model = HistGradientBoostingRegressor(max_depth=4, learning_rate=0.08, max_iter=120, random_state=42)
        return model, "hist_gradient_boosting"


def _mask_dates(frame: pd.DataFrame, dates: list) -> pd.DataFrame:
    day = pd.to_datetime(frame["day"]).dt.normalize()
    allowed = {pd.Timestamp(item).normalize() for item in dates}
    return frame.loc[day.isin(allowed)].copy()


def train_models(frame: pd.DataFrame, imputation_log: list | None = None) -> tuple[dict, list[dict]]:
    """Fit one model per weather variable on a chronological split and score the test period."""
    if frame.empty:
        raise ValueError("Feature table is empty")
    log = list(imputation_log or [])
    dates = pd.to_datetime(frame["day"]).dt.normalize()
    train_dates, val_dates, test_dates = chronological_split(dates)
    train_df = _mask_dates(frame, train_dates)
    val_df = _mask_dates(frame, val_dates)
    test_df = _mask_dates(frame, test_dates)

    # Impute using training rows only, then apply those medians forward.
    _, medians, impute_notes = impute_numeric(train_df, FEATURE_COLUMNS, log=log)
    log.extend(impute_notes)
    train_df, _, _ = impute_numeric(train_df, FEATURE_COLUMNS, medians=medians)
    val_df, _, val_notes = impute_numeric(val_df, FEATURE_COLUMNS, medians=medians)
    test_df, _, test_notes = impute_numeric(test_df, FEATURE_COLUMNS, medians=medians)
    log.extend(val_notes)
    log.extend(test_notes)

    library_name = "hist_gradient_boosting"
    models: dict = {}
    conformal: dict[str, float] = {}
    metrics: dict[str, dict] = {}
    rainfall_models = _fit_rainfall(train_df, log)
    models["rainfall"] = rainfall_models
    library_name = rainfall_models["library"]

    for variable in TARGET_VARIABLES:
        if variable == "rainfall_mm":
            predict_fn = lambda data, bundle=rainfall_models: _predict_rainfall(bundle, data)
        else:
            estimator, library_name = _fit_regressor(train_df, variable, log)
            models[variable] = estimator
            predict_fn = lambda data, est=estimator: est.predict(data[FEATURE_COLUMNS])

        val_pred = np.asarray(predict_fn(val_df), dtype=float)
        val_true = val_df[f"target_{variable}"].to_numpy(dtype=float)
        residual_mask = np.isfinite(val_true) & np.isfinite(val_pred)
        qhat = conformal_quantile(val_true[residual_mask] - val_pred[residual_mask]) if residual_mask.any() else 1.0
        conformal[variable] = qhat

        test_pred = np.asarray(predict_fn(test_df), dtype=float)
        constrained_pred = []
        clip_log: list[dict] = []
        for value in test_pred:
            corrected = apply_constraints({variable: float(value)}, clip_log)
            constrained_pred.append(corrected[variable])
        test_pred = np.asarray(constrained_pred, dtype=float)
        if clip_log:
            log.append({"event": "constraint_clips_on_test", "variable": variable, "count": len(clip_log)})

        y_true = test_df[f"target_{variable}"].to_numpy(dtype=float)
        y_base = block_baseline(test_df[f"block_{variable}"])
        finite = np.isfinite(y_true)
        dropped = int((~finite).sum())
        if dropped:
            log.append(
                {
                    "event": "excluded_missing_target",
                    "variable": variable,
                    "rows": dropped,
                    "action": "logged_and_removed_from_metric_only",
                }
            )
            logger.warning("Excluded %s %s test rows with a missing target", dropped, variable)

        model_stats = regression_metrics(y_true, test_pred)
        base_stats = regression_metrics(y_true, y_base)
        lower = test_pred - qhat
        upper = test_pred + qhat
        intervals = interval_stats(y_true, lower, upper)
        sigma = np.full_like(test_pred, max(qhat / 1.64, 1e-3))
        statement = improvement_statement(variable, base_stats["rmse"], model_stats["rmse"])
        payload = {
            **model_stats,
            "baseline_mae": base_stats["mae"],
            "baseline_rmse": base_stats["rmse"],
            "baseline_bias": base_stats["bias"],
            "baseline_r2": base_stats["r2"],
            "baseline_correlation": base_stats["correlation"],
            "improvement_percent": improvement_percent(base_stats["rmse"], model_stats["rmse"]),
            "statement": statement,
            "interval_coverage": intervals["coverage"],
            "average_interval_width": intervals["average_width"],
            "crps": crps_gaussian(y_true, test_pred, sigma),
            "by_horizon": _grouped_scores(test_df, y_true, test_pred, y_base, "lead_time_hours"),
            "by_season": _season_scores(test_df, y_true, test_pred, y_base),
            "by_panchayat": _grouped_scores(test_df, y_true, test_pred, y_base, "code"),
        }
        if variable == "rainfall_mm":
            payload["rain_classification"] = binary_scores(y_true, test_pred, threshold=1.0)
            payload["extreme_rain"] = binary_scores(y_true, test_pred, threshold=50.0)
        metrics[variable] = payload
        logger.info("%s", statement)

    feature_mean = train_df[FEATURE_COLUMNS].mean().to_numpy(dtype=float)
    feature_std = train_df[FEATURE_COLUMNS].std().replace(0, 1).to_numpy(dtype=float)
    version = f"demo-{library_name}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
    bundle = {
        "model_version": version,
        "library": library_name,
        "feature_columns": FEATURE_COLUMNS,
        "medians": medians,
        "models": models,
        "conformal_q": conformal,
        "feature_mean": feature_mean,
        "feature_std": feature_std,
        "trained_leads": sorted({int(v) for v in train_df["lead_time_hours"].dropna().unique()}),
        "training_start": str(pd.Timestamp(train_dates[0]).date()),
        "training_end": str(pd.Timestamp(train_dates[-1]).date()),
        "validation_start": str(pd.Timestamp(val_dates[0]).date()),
        "validation_end": str(pd.Timestamp(test_dates[-1]).date()),
        "metrics": metrics,
        "imputation_log": log,
        "target_variables": TARGET_VARIABLES,
    }
    return bundle, [metrics[name] | {"variable": name} for name in TARGET_VARIABLES]


def _fit_regressor(train_df: pd.DataFrame, variable: str, log: list[dict]):
    target = train_df[f"target_{variable}"]
    usable = train_df.loc[target.notna()].copy()
    dropped = len(train_df) - len(usable)
    if dropped:
        log.append({"event": "excluded_missing_target", "variable": variable, "rows": dropped, "split": "train"})
    estimator, library = _point_regressor()
    estimator.fit(usable[FEATURE_COLUMNS], usable[f"target_{variable}"].to_numpy(dtype=float))
    return estimator, library


def _fit_rainfall(train_df: pd.DataFrame, log: list[dict]) -> dict:
    target = train_df["target_rainfall_mm"]
    usable = train_df.loc[target.notna()].copy()
    dropped = len(train_df) - len(usable)
    if dropped:
        log.append({"event": "excluded_missing_target", "variable": "rainfall_mm", "rows": dropped, "split": "train"})
    y = usable["target_rainfall_mm"].to_numpy(dtype=float)
    rainy = y >= 0.2
    library = "hist_gradient_boosting"
    classifier = None
    if rainy.any() and (~rainy).any():
        classifier = HistGradientBoostingClassifier(max_depth=4, learning_rate=0.08, max_iter=80, random_state=42)
        classifier.fit(usable[FEATURE_COLUMNS], rainy.astype(int))
    else:
        log.append({"event": "rainfall_classifier_skipped", "reason": "single_class_in_training"})
    regressor, library = _point_regressor()
    rain_rows = usable.loc[rainy]
    if len(rain_rows) >= 8:
        regressor.fit(rain_rows[FEATURE_COLUMNS], np.log1p(rain_rows["target_rainfall_mm"].to_numpy(dtype=float)))
        mode = "two_stage"
    else:
        regressor.fit(usable[FEATURE_COLUMNS], np.log1p(np.clip(y, 0, None)))
        mode = "regression_fallback"
        log.append({"event": "rainfall_regression_fallback", "reason": "too_few_rainy_rows"})
    return {"classifier": classifier, "regressor": regressor, "mode": mode, "library": library}


def _predict_rainfall(bundle: dict, frame: pd.DataFrame) -> np.ndarray:
    features = frame[FEATURE_COLUMNS]
    amount = np.expm1(bundle["regressor"].predict(features))
    amount = np.clip(amount, 0, None)
    if bundle["classifier"] is None:
        return amount
    proba = bundle["classifier"].predict_proba(features)[:, 1]
    return proba * amount


def _grouped_scores(frame, y_true, y_pred, y_base, column: str) -> list[dict]:
    results = []
    temp = frame.copy()
    temp["_y"] = y_true
    temp["_p"] = y_pred
    temp["_b"] = y_base
    for key, part in temp.groupby(column):
        stats = regression_metrics(part["_y"], part["_p"])
        base = regression_metrics(part["_y"], part["_b"])
        results.append(
            {
                "key": str(key),
                "n": stats["n"],
                "rmse": stats["rmse"],
                "mae": stats["mae"],
                "baseline_rmse": base["rmse"],
                "improvement_percent": improvement_percent(base["rmse"], stats["rmse"]),
            }
        )
    return results


def _season_scores(frame, y_true, y_pred, y_base) -> list[dict]:
    temp = frame.copy()
    temp["_season"] = pd.to_datetime(temp["day"]).dt.month.map(season_name)
    return _grouped_scores(temp, y_true, y_pred, y_base, "_season")


def save_bundle(bundle: dict) -> str:
    path = get_settings().model_path() / "latest.joblib"
    joblib.dump(bundle, path)
    return str(path)


def load_bundle() -> dict | None:
    path = get_settings().model_path() / "latest.joblib"
    if not path.exists():
        return None
    return joblib.load(path)
