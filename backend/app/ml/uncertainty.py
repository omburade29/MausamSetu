"""Split-conformal prediction intervals and a conservative confidence score."""

from __future__ import annotations

import numpy as np


def conformal_quantile(residuals, alpha: float = 0.1) -> float:
    """Absolute residual quantile with the finite-sample split-conformal level."""
    clean = np.abs(np.asarray(residuals, dtype=float))
    clean = clean[np.isfinite(clean)]
    if len(clean) == 0:
        return 1.0
    n = len(clean)
    level = min(1.0, math_ceil_level(n, alpha))
    return float(np.quantile(clean, level))


def math_ceil_level(n: int, alpha: float) -> float:
    return float(np.ceil((n + 1) * (1 - alpha)) / n)


def prediction_interval(point: float, qhat: float, ood: float = 0.0) -> tuple[float, float]:
    widen = 1.0 + 0.35 * max(0.0, ood)
    half = abs(qhat) * widen
    return float(point - half), float(point + half)


def confidence_score(
    *,
    interval_width: float,
    typical_width: float,
    missing_count: int,
    ood: float,
    history_days: int,
    lead_time_hours: float,
    max_lead_trained: float,
) -> float:
    """Score in [0.05, 0.97]. Lower when history, features, or lead time are weak."""
    typical = max(typical_width, 1e-3)
    width_penalty = min(1.0, interval_width / (typical * 3.0))
    missing_penalty = min(1.0, missing_count / 8.0)
    ood_penalty = min(1.0, max(0.0, ood) / 2.0)
    if history_days < 14:
        history_penalty = 0.85
    elif history_days < 30:
        history_penalty = 0.45
    elif history_days < 60:
        history_penalty = 0.15
    else:
        history_penalty = 0.0
    lead_penalty = 0.0
    if lead_time_hours > max_lead_trained:
        lead_penalty = min(0.4, (lead_time_hours - max_lead_trained) / max(max_lead_trained, 1) * 0.4)
    score = (
        0.92
        - 0.34 * width_penalty
        - 0.22 * missing_penalty
        - 0.18 * ood_penalty
        - 0.16 * history_penalty
        - lead_penalty
    )
    return float(np.clip(score, 0.05, 0.97))


def out_of_distribution(feature_row: np.ndarray, mean: np.ndarray, std: np.ndarray) -> float:
    scale = np.where(std < 1e-6, 1.0, std)
    z = np.abs((feature_row - mean) / scale)
    z = z[np.isfinite(z)]
    if len(z) == 0:
        return 1.0
    return float(np.mean(z))
