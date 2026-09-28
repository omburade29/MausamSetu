"""Baseline forecasts.

The operational baseline copies the block forecast onto every panchayat in the block.
An optional bias-correction baseline and a quantile-mapping baseline are available
when enough paired history exists.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def block_baseline(block_values: pd.Series | np.ndarray) -> np.ndarray:
    """Assign the block forecast uniformly to each panchayat row."""
    return np.asarray(block_values, dtype=float).copy()


def bias_correct(block_values, corrections) -> np.ndarray:
    base = np.asarray(block_values, dtype=float)
    corr = np.asarray(corrections, dtype=float)
    corr = np.where(np.isfinite(corr), corr, 0.0)
    return base + corr


def quantile_map(values, source_history, target_history, min_samples: int = 30) -> np.ndarray | None:
    """Map values from the block-forecast distribution onto the observed distribution.

    Returns None when history is too short. Callers should keep the unmapped value
    and record that quantile mapping was skipped.
    """
    source = np.asarray(source_history, dtype=float)
    target = np.asarray(target_history, dtype=float)
    source = source[np.isfinite(source)]
    target = target[np.isfinite(target)]
    if len(source) < min_samples or len(target) < min_samples:
        return None
    quantiles = np.linspace(0, 1, 101)
    src_q = np.quantile(source, quantiles)
    dst_q = np.quantile(target, quantiles)
    # np.interp needs increasing xp.
    order = np.argsort(src_q)
    src_q = src_q[order]
    dst_q = dst_q[order]
    unique_src, unique_idx = np.unique(src_q, return_index=True)
    return np.interp(np.asarray(values, dtype=float), unique_src, dst_q[unique_idx])
