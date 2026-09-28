"""Load deterministic demo datasets."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("MAUSAM_DATA", ROOT / "data"))


def _read(name: str) -> dict[str, Any]:
    path = DATA_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Demo data file is missing: {path}")
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


@lru_cache(maxsize=1)
def load_bundle() -> dict[str, Any]:
    regions = _read("regions.json")
    forecasts = _read("block_forecasts.json")
    predictors = _read("predictors.json")
    references = _read("reference_values.json")
    geojson = _read("panchayats.geojson")

    predictor_by_id = {row["panchayat_id"]: row for row in predictors["predictors"]}
    block_feature = None
    panchayats: list[dict[str, Any]] = []
    for feature in geojson["features"]:
        geometry = shape(feature["geometry"])
        if not geometry.is_valid:
            raise ValueError(f"Invalid geometry for {feature['properties'].get('id')}")
        props = feature["properties"]
        if props.get("kind") == "block":
            block_feature = feature
            continue
        predictor = predictor_by_id.get(props["id"])
        if predictor is None:
            raise ValueError(f"Missing predictors for {props['id']}")
        panchayats.append(
            {
                "id": props["id"],
                "name": props["name"],
                "block_id": props["block_id"],
                "latitude": props["latitude"],
                "longitude": props["longitude"],
                "geometry": feature["geometry"],
                "elevation": predictor["elevation_m"],
                "land_cover": predictor["land_cover"],
                "soil_moisture": predictor["soil_moisture"],
                "distance_water": predictor["distance_to_water_km"],
                "vegetation": predictor["vegetation"],
                "data_quality": predictor["data_quality"],
            }
        )

    if block_feature is None:
        raise ValueError("Demo GeoJSON is missing the block boundary.")

    reference_index: dict[tuple[str, str], dict[str, float]] = {}
    for row in references.get("references", []):
        reference_index[(row["panchayat_id"], row["date"])] = {
            "rainfall_mm": row["rainfall_mm"],
            "temperature_c": row["temperature_c"],
            "humidity_pct": row["humidity_pct"],
            "wind_kmh": row["wind_kmh"],
        }

    return {
        "regions": regions,
        "forecasts": forecasts["forecasts"],
        "forecast_meta": {
            "source": forecasts["source"],
            "is_simulated": forecasts["is_simulated"],
            "description": forecasts.get("description", ""),
        },
        "panchayats": panchayats,
        "block_feature": block_feature,
        "references": reference_index,
        "reference_meta": {
            "source": references.get("source", "demo_simulation"),
            "is_simulated": references.get("is_simulated", True),
            "description": references.get("description", ""),
            "method": references.get("method", ""),
        },
        "geojson_note": geojson.get("description", ""),
    }


def clear_cache() -> None:
    load_bundle.cache_clear()
