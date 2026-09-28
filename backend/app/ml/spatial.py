"""Light spatial smoothing that keeps local extremes."""

from __future__ import annotations

import logging

logger = logging.getLogger("app.ml.spatial")


def smooth_group(
    values: list[float],
    weight: float,
    max_relative_change: float = 0.3,
) -> tuple[list[float], list[dict]]:
    """Blend each value slightly toward the mean of the other values in the group.

    If the blend would move a value by more than ``max_relative_change``, the
    original value is kept so a real local extreme is not painted away.
    ``weight`` of 0 disables smoothing.
    """
    notes: list[dict] = []
    if weight <= 0 or len(values) < 2:
        return list(values), notes
    smoothed: list[float] = []
    for index, value in enumerate(values):
        others = [item for item_index, item in enumerate(values) if item_index != index]
        neighbor_mean = sum(others) / len(others)
        blended = (1 - weight) * value + weight * neighbor_mean
        scale = max(abs(value), 1.0)
        relative = abs(blended - value) / scale
        if relative > max_relative_change:
            notes.append(
                {
                    "index": index,
                    "from": value,
                    "rejected_value": blended,
                    "reason": "preserved_local_extreme",
                }
            )
            logger.info("Skipped spatial smooth at index %s to preserve a local extreme", index)
            smoothed.append(value)
        else:
            if abs(blended - value) > 1e-6:
                notes.append({"index": index, "from": value, "to": blended, "reason": "spatial_smooth"})
            smoothed.append(blended)
    return smoothed, notes
