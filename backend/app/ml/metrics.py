"""Verification scores for downscaled forecasts versus the block baseline."""

from __future__ import annotations

import math

import numpy as np


def _clean(y_true, y_pred) -> tuple[np.ndarray, np.ndarray]:
    yt = np.asarray(y_true, dtype=float)
    yp = np.asarray(y_pred, dtype=float)
    mask = np.isfinite(yt) & np.isfinite(yp)
    return yt[mask], yp[mask]


def regression_metrics(y_true, y_pred) -> dict:
    yt, yp = _clean(y_true, y_pred)
    if len(yt) == 0:
        return {"n": 0, "mae": None, "rmse": None, "bias": None, "r2": None, "correlation": None}
    error = yp - yt
    mae = float(np.mean(np.abs(error)))
    rmse = float(np.sqrt(np.mean(error**2)))
    bias = float(np.mean(error))
    if len(yt) < 2 or float(np.std(yt)) == 0 or float(np.std(yp)) == 0:
        r2 = None
        correlation = None
    else:
        ss_res = float(np.sum(error**2))
        ss_tot = float(np.sum((yt - np.mean(yt)) ** 2))
        r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else None
        correlation = float(np.corrcoef(yt, yp)[0, 1])
    return {"n": int(len(yt)), "mae": mae, "rmse": rmse, "bias": bias, "r2": r2, "correlation": correlation}


def improvement_percent(baseline_rmse: float | None, model_rmse: float | None) -> float | None:
    if baseline_rmse is None or model_rmse is None or baseline_rmse <= 0:
        return None
    return float((baseline_rmse - model_rmse) / baseline_rmse * 100)


def improvement_statement(variable: str, baseline_rmse: float | None, model_rmse: float | None) -> str:
    """Human-readable result. Says plainly when downscaling does not help."""
    label = variable.replace("_", " ")
    pct = improvement_percent(baseline_rmse, model_rmse)
    if pct is None:
        return f"Downscaling could not be compared with the baseline for {label} in this period."
    if pct > 0.5:
        return f"Downscaling improved {label} RMSE by {pct:.1f}% over the block baseline."
    return f"Downscaling did not improve the baseline for {label} and this period."


def binary_scores(y_true, y_pred, threshold: float = 1.0) -> dict:
    yt, yp = _clean(y_true, y_pred)
    if len(yt) == 0:
        return {"accuracy": None, "precision": None, "recall": None, "f1": None, "n": 0}
    actual = yt >= threshold
    predicted = yp >= threshold
    tp = int(np.sum(actual & predicted))
    tn = int(np.sum(~actual & ~predicted))
    fp = int(np.sum(~actual & predicted))
    fn = int(np.sum(actual & ~predicted))
    accuracy = (tp + tn) / len(yt)
    precision = tp / (tp + fp) if (tp + fp) else None
    recall = tp / (tp + fn) if (tp + fn) else None
    if precision is None or recall is None or (precision + recall) == 0:
        f1 = None
    else:
        f1 = 2 * precision * recall / (precision + recall)
    return {
        "n": int(len(yt)),
        "accuracy": float(accuracy),
        "precision": None if precision is None else float(precision),
        "recall": None if recall is None else float(recall),
        "f1": None if f1 is None else float(f1),
        "threshold": threshold,
    }


def interval_stats(y_true, lower, upper) -> dict:
    yt = np.asarray(y_true, dtype=float)
    lo = np.asarray(lower, dtype=float)
    hi = np.asarray(upper, dtype=float)
    mask = np.isfinite(yt) & np.isfinite(lo) & np.isfinite(hi)
    if not np.any(mask):
        return {"coverage": None, "average_width": None, "n": 0}
    yt, lo, hi = yt[mask], lo[mask], hi[mask]
    covered = (yt >= lo) & (yt <= hi)
    return {
        "n": int(len(yt)),
        "coverage": float(np.mean(covered)),
        "average_width": float(np.mean(hi - lo)),
    }


def crps_gaussian(y_true, mu, sigma) -> float | None:
    """Mean CRPS for a Gaussian predictive distribution. Returns None if sigma is missing."""
    yt = np.asarray(y_true, dtype=float)
    mean = np.asarray(mu, dtype=float)
    sig = np.asarray(sigma, dtype=float)
    mask = np.isfinite(yt) & np.isfinite(mean) & np.isfinite(sig) & (sig > 1e-6)
    if not np.any(mask):
        return None
    yt, mean, sig = yt[mask], mean[mask], sig[mask]
    z = (yt - mean) / sig
    pdf = np.exp(-0.5 * z**2) / math.sqrt(2 * math.pi)
    # Abramowitz-ish via math.erf for the cdf, vectorized.
    cdf = 0.5 * (1 + np.vectorize(math.erf)(z / math.sqrt(2)))
    crps = sig * (z * (2 * cdf - 1) + 2 * pdf - 1 / math.sqrt(math.pi))
    return float(np.mean(crps))


def season_name(month: int) -> str:
    if month in (12, 1, 2):
        return "winter"
    if month in (3, 4, 5):
        return "summer"
    if month in (6, 7, 8, 9):
        return "monsoon"
    return "post_monsoon"
