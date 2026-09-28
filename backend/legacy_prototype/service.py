"""Orchestrate a deterministic downscaling run."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.advisory import build_advisories
from app.engine import (
    MODEL_LIMITATIONS,
    PREDICTOR_LABELS,
    VARIABLE_META,
    VARIABLES,
    run_models,
)
from app.loader import load_bundle
from app.metrics import validation_table
from app.schemas import DownscaleRequest
from app.storage import get_run, save_run

logger = logging.getLogger("mausamsetu")

MODEL_LABELS = {
    "contextual_baseline": "Contextual Baseline",
    "random_forest": "Random Forest Prototype",
}

STATEMENTS = [
    "This is a prototype decision-support tool.",
    "Demo values may be simulated.",
    "Finer spatial detail does not automatically imply higher forecast accuracy.",
    "Validation depends on available fine-scale reference data.",
    "This is not an official warning or emergency alert system.",
    "Verify advisories with official meteorological and agricultural guidance.",
]


def _index_regions(bundle: dict[str, Any]) -> dict[str, Any]:
    states = {}
    districts = {}
    blocks = {}
    for state in bundle["regions"]["states"]:
        states[state["id"]] = state
        for district in state["districts"]:
            districts[district["id"]] = {**district, "state_id": state["id"], "state_name": state["name"]}
            for block in district["blocks"]:
                blocks[block["id"]] = {
                    **block,
                    "district_id": district["id"],
                    "district_name": district["name"],
                    "state_id": state["id"],
                    "state_name": state["name"],
                }
    return {"states": states, "districts": districts, "blocks": blocks}


def _forecast_for(bundle: dict[str, Any], block_id: str, date: str) -> dict[str, Any]:
    matches = [
        row for row in bundle["forecasts"] if row["block_id"] == block_id and row["date"] == date
    ]
    if not matches:
        raise HTTPException(
            status_code=404,
            detail=f"No demo block forecast is available for {block_id} on {date}.",
        )
    return matches[0]


def block_forecast_payload(block_id: str, date: str | None) -> dict[str, Any]:
    bundle = load_bundle()
    index = _index_regions(bundle)
    block = index["blocks"].get(block_id)
    if block is None:
        raise HTTPException(status_code=404, detail="Block not found in the demo geography.")
    series = [row for row in bundle["forecasts"] if row["block_id"] == block_id]
    series = sorted(series, key=lambda row: row["date"])
    if not series:
        raise HTTPException(status_code=404, detail="No demo block forecast is stored for this block.")
    if date and not any(row["date"] == date for row in series):
        raise HTTPException(
            status_code=404,
            detail=f"No demo block forecast is available for {block_id} on {date}.",
        )
    chosen_date = date or "2026-09-28"
    if not any(row["date"] == chosen_date for row in series):
        chosen_date = series[-1]["date"]
    current = _forecast_for(bundle, block_id, chosen_date)
    return {
        "block_id": block_id,
        "block_name": block["name"],
        "state_name": block["state_name"],
        "district_name": block["district_name"],
        "date": chosen_date,
        "dates": [row["date"] for row in series],
        "values": {
            "rainfall_mm": current["rainfall_mm"],
            "temperature_c": current["temperature_c"],
            "humidity_pct": current["humidity_pct"],
            "wind_kmh": current["wind_kmh"],
        },
        "series": [
            {
                "date": row["date"],
                "rainfall_mm": row["rainfall_mm"],
                "temperature_c": row["temperature_c"],
                "humidity_pct": row["humidity_pct"],
                "wind_kmh": row["wind_kmh"],
            }
            for row in series
        ],
        "resolution": "Block level",
        "resolution_text": "Current resolution: Block level",
        "geometry": bundle["block_feature"]["geometry"],
        "representative_point": block["representative_point"],
        "note": "Coarse block guidance for the demonstration. Not an IMD bulletin.",
        "source": "demo_simulation",
        "is_simulated": True,
    }


def panchayat_collection(block_id: str) -> dict[str, Any]:
    bundle = load_bundle()
    index = _index_regions(bundle)
    if block_id not in index["blocks"]:
        raise HTTPException(status_code=404, detail="Block not found in the demo geography.")
    features = []
    for item in bundle["panchayats"]:
        if item["block_id"] != block_id:
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": item["id"],
                    "name": item["name"],
                    "block_id": item["block_id"],
                    "latitude": item["latitude"],
                    "longitude": item["longitude"],
                    "elevation_m": item["elevation"],
                    "land_cover": item["land_cover"],
                    "soil_moisture": item["soil_moisture"],
                    "distance_to_water_km": item["distance_water"],
                    "vegetation": item["vegetation"],
                    "data_quality": item["data_quality"],
                },
                "geometry": item["geometry"],
            }
        )
    return {
        "type": "FeatureCollection",
        "block": bundle["block_feature"],
        "features": features,
        "note": "Schematic demo boundaries, not official cadastral maps.",
        "source": "demo_simulation",
        "is_simulated": True,
    }


def regions_payload() -> dict[str, Any]:
    return load_bundle()["regions"]


def _uncertainty_summary(panchayats: list[dict[str, Any]], variable: str) -> dict[str, Any]:
    scores = [item["uncertainty_by_variable"][variable] for item in panchayats]
    counts = {"Low uncertainty": 0, "Moderate uncertainty": 0, "High uncertainty": 0}
    for score in scores:
        counts[score["category"]] += 1
    rank = {"High": 2, "Moderate": 1, "Low": 0}
    ranked = sorted(
        panchayats,
        key=lambda item: (
            -rank[item["advisory_priority"]],
            item["uncertainty_by_variable"][variable]["confidence"],
            item["name"],
        ),
    )
    highest = ranked[0]
    values = [float(item["forecasts"][variable]) for item in panchayats]
    return {
        "mean_uncertainty": round(sum(score["value"] for score in scores) / len(scores), 3),
        "mean_confidence": round(sum(score["confidence"] for score in scores) / len(scores), 1),
        "counts": counts,
        "average_forecast": round(sum(values) / len(values), 2),
        "highest_risk_panchayat": {
            "id": highest["panchayat_id"],
            "name": highest["name"],
            "priority": highest["advisory_priority"],
            "confidence": highest["uncertainty_by_variable"][variable]["confidence"],
        },
        "explanation": (
            "Uncertainty reflects predictor completeness, distance from the block "
            "representative point, predictor disagreement, model residual, and the "
            "data-quality flag. It is not a guarantee of forecast error."
        ),
    }


def perform_downscale(body: DownscaleRequest) -> dict[str, Any]:
    bundle = load_bundle()
    index = _index_regions(bundle)
    state = index["states"].get(body.state_id)
    district = index["districts"].get(body.district_id)
    block = index["blocks"].get(body.block_id)
    if state is None:
        raise HTTPException(status_code=404, detail="State not found in the demo geography.")
    if district is None or district["state_id"] != body.state_id:
        raise HTTPException(status_code=400, detail="District does not belong to the selected state.")
    if block is None or block["district_id"] != body.district_id:
        raise HTTPException(status_code=400, detail="Block does not belong to the selected district.")

    forecast = _forecast_for(bundle, body.block_id, body.date)
    panchayats = [item for item in bundle["panchayats"] if item["block_id"] == body.block_id]
    if not panchayats:
        raise HTTPException(status_code=404, detail="No Panchayats are available for this block.")

    references = {}
    for item in panchayats:
        ref = bundle["references"].get((item["id"], body.date))
        if ref is None:
            raise HTTPException(
                status_code=400,
                detail=f"Simulated reference values are missing for {item['name']} on {body.date}.",
            )
        references[item["id"]] = ref

    origin = (
        float(block["representative_point"]["latitude"]),
        float(block["representative_point"]["longitude"]),
    )
    block_values = {
        "rainfall_mm": float(forecast["rainfall_mm"]),
        "temperature_c": float(forecast["temperature_c"]),
        "humidity_pct": float(forecast["humidity_pct"]),
        "wind_kmh": float(forecast["wind_kmh"]),
    }
    modeled = run_models(
        panchayats,
        block_values,
        origin,
        references,
        body.model,
        list(body.predictors),
    )
    advisories = build_advisories(modeled["panchayats"], body.date, body.variable)
    validations = {
        variable: validation_table(modeled["panchayats"], variable) for variable in VARIABLES
    }
    summary = _uncertainty_summary(modeled["panchayats"], body.variable)
    created = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    meta = VARIABLE_META[body.variable]
    payload = {
        "run_id": f"MS-{uuid.uuid4().hex[:10].upper()}",
        "status": "completed",
        "created_at": created,
        "model": body.model,
        "model_label": MODEL_LABELS[body.model],
        "geography": {
            "state_id": state["id"],
            "state_name": state["name"],
            "district_id": district["id"],
            "district_name": district["name"],
            "block_id": block["id"],
            "block_name": block["name"],
            "date": body.date,
        },
        "variable": body.variable,
        "variable_label": meta["label"],
        "unit": meta["unit"],
        "block_forecast": {
            "date": body.date,
            "values": block_values,
            "primary_value": block_values[body.variable],
            "resolution": "Block level",
            "resolution_text": "Current resolution: Block level",
            "series": block_forecast_payload(body.block_id, body.date)["series"],
            "source": "demo_simulation",
            "is_simulated": True,
        },
        "block_geometry": bundle["block_feature"]["geometry"],
        "panchayat_forecasts": modeled["panchayats"],
        "uncertainty_summary": summary,
        "validation_metrics": validations[body.variable],
        "validations": validations,
        "advisories": advisories,
        "feature_importance": modeled["feature_importance"],
        "weights": modeled["weights"],
        "predictors": list(body.predictors),
        "predictor_labels": PREDICTOR_LABELS,
        "simulation_metadata": {
            "source": "demo_simulation",
            "is_simulated": True,
            "seed": 42,
            "model_limitation": MODEL_LIMITATIONS[body.model],
            "reference_note": (
                "Reference values are an independent simulated field frozen in "
                "data/reference_values.json. They are not observations, and the "
                "validation page reads them as supplied reference values."
            ),
            "resolution_before": "Current resolution: Block level",
            "resolution_after": "Output resolution: Panchayat level",
            "statements": STATEMENTS,
        },
    }
    save_run(payload)
    logger.info(
        "Completed downscale %s model=%s block=%s variable=%s panchayats=%s improvement=%s",
        payload["run_id"],
        body.model,
        body.block_id,
        body.variable,
        len(modeled["panchayats"]),
        validations[body.variable]["improvement_percent"],
    )
    return payload


def fetch_run(run_id: str) -> dict[str, Any]:
    payload = get_run(run_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"No downscaling run found for id {run_id}.")
    return payload


def validation_for_run(run_id: str, variable: str | None) -> dict[str, Any]:
    payload = fetch_run(run_id)
    chosen = variable or payload["variable"]
    if chosen not in payload["validations"]:
        raise HTTPException(status_code=400, detail=f"Unsupported validation variable: {chosen}.")
    return payload["validations"][chosen]


def advisories_for_run(run_id: str) -> dict[str, Any]:
    payload = fetch_run(run_id)
    return {
        "run_id": run_id,
        "advisories": payload["advisories"],
        "source": "demo_simulation",
        "is_simulated": True,
    }

