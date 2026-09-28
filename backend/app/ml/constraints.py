"""Physical constraints applied after model inference. Every clip is logged."""

import logging
from typing import Any

logger = logging.getLogger("app.ml.constraints")

CLIP_RULES: dict[str, tuple[float | None, float | None]] = {
    "rainfall_mm": (0.0, None),
    "humidity_percent": (0.0, 100.0),
    "cloud_cover_percent": (0.0, 100.0),
    "wind_speed_kmh": (0.0, None),
    "probability_of_rain": (0.0, 1.0),
}


def apply_constraints(values: dict[str, Any], log: list[dict] | None = None) -> dict[str, Any]:
    """Return a copy with physically impossible values corrected.

    Rainfall and wind cannot be negative. Humidity and cloud cover stay inside
    0–100. Minimum temperature is forced to be less than or equal to maximum.
    """
    corrected = dict(values)
    notes = log if log is not None else []
    for field, (lower, upper) in CLIP_RULES.items():
        if corrected.get(field) is None:
            continue
        original = float(corrected[field])
        updated = original
        if lower is not None and updated < lower:
            updated = lower
        if upper is not None and updated > upper:
            updated = upper
        if updated != original:
            note = {"field": field, "from": original, "to": updated, "reason": "physical_constraint"}
            notes.append(note)
            logger.info("Clipped %s from %s to %s", field, original, updated)
            corrected[field] = updated

    tmin = corrected.get("temperature_min_c")
    tmax = corrected.get("temperature_max_c")
    if tmin is not None and tmax is not None and float(tmin) > float(tmax):
        note = {
            "field": "temperature_min_c",
            "from": float(tmin),
            "to": float(tmax),
            "reason": "min_temperature_exceeded_max",
        }
        notes.append(note)
        logger.info("Swapped temperature bounds because min %.2f exceeded max %.2f", tmin, tmax)
        corrected["temperature_min_c"] = float(tmax)
        corrected["temperature_max_c"] = float(tmin)
    return corrected


def clip_interval(variable: str, lower: float, upper: float) -> tuple[float, float]:
    rules = CLIP_RULES.get(variable)
    if not rules:
        return lower, upper
    lo_bound, hi_bound = rules
    lo, hi = lower, upper
    if lo_bound is not None:
        lo = max(lo, lo_bound)
        hi = max(hi, lo_bound)
    if hi_bound is not None:
        lo = min(lo, hi_bound)
        hi = min(hi, hi_bound)
    if lo > hi:
        lo, hi = hi, lo
    return lo, hi
