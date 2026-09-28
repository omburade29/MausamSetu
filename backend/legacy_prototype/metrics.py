"""Error metrics for baseline and downscaled forecasts."""

from __future__ import annotations

import json
from typing import Any

import numpy as np
import pandas as pd

from app.engine import VARIABLE_META


def regression_metrics(predicted: list[float], reference: list[float]) -> dict[str, float | None]:
    pred = np.asarray(predicted, dtype=float)
    ref = np.asarray(reference, dtype=float)
    error = pred - ref
    mae = float(np.mean(np.abs(error)))
    rmse = float(np.sqrt(np.mean(np.square(error))))
    bias = float(np.mean(error))
    ss_res = float(np.sum(np.square(ref - pred)))
    ss_tot = float(np.sum(np.square(ref - np.mean(ref))))
    r2 = None if len(ref) < 3 or ss_tot < 1e-9 else float(1.0 - ss_res / ss_tot)
    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "bias": round(bias, 3),
        "r2": None if r2 is None else round(r2, 3),
    }


def validation_table(panchayats: list[dict[str, Any]], variable: str) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for item in panchayats:
        if not item.get("reference"):
            continue
        baseline = float(item["baseline"][variable])
        downscaled = float(item["forecasts"][variable])
        reference = float(item["reference"][variable])
        baseline_error = abs(baseline - reference)
        downscaled_error = abs(downscaled - reference)
        rows.append(
            {
                "panchayat_id": item["panchayat_id"],
                "panchayat": item["name"],
                "baseline": baseline,
                "downscaled": downscaled,
                "reference": reference,
                "baseline_error": round(baseline_error, 3),
                "downscaled_error": round(downscaled_error, 3),
                "difference": round(baseline_error - downscaled_error, 3),
                "uncertainty_category": item["uncertainty_by_variable"][variable]["category"],
                "confidence": item["uncertainty_by_variable"][variable]["confidence"],
            }
        )
    frame = pd.DataFrame(rows)
    if frame.empty:
        raise ValueError("No reference values are available for validation.")
    baseline_metrics = regression_metrics(frame["baseline"].tolist(), frame["reference"].tolist())
    downscaled_metrics = regression_metrics(frame["downscaled"].tolist(), frame["reference"].tolist())
    base_mae = float(baseline_metrics["mae"] or 0)
    down_mae = float(downscaled_metrics["mae"] or 0)
    improvement = None if base_mae < 1e-9 else round((base_mae - down_mae) / base_mae * 100.0, 1)
    meta = VARIABLE_META[variable]
    return {
        "variable": variable,
        "label": meta["label"],
        "unit": meta["unit"],
        "baseline_metrics": baseline_metrics,
        "downscaled_metrics": downscaled_metrics,
        "improvement_percent": improvement,
        "rows": json.loads(frame.to_json(orient="records")),
        "warning": (
            "Validation quality depends on the availability and reliability "
            "of fine-scale reference observations."
        ),
        "reference_note": (
            "Reference values in this prototype are simulated. They are not field "
            "observations. A lower error on this sample is not operational accuracy."
        ),
        "labels": {
            "baseline_error": "Baseline error",
            "downscaled_error": "Downscaled error",
            "difference": "Difference",
            "improvement": "Improvement",
        },
        "simulation_mode": True,
        "source": "demo_simulation",
        "is_simulated": True,
    }
