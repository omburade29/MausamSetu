from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.api.serialize import block_forecast_dict, observation_dict, panchayat_forecast_dict
from app.constants import BLOCK_SOURCE_LABEL, DISCLAIMER, OBSERVED_SOURCE_LABEL, PANCHAYAT_SOURCE_LABEL, VARIABLE_UNITS
from app.database import get_db
from app.geospatial.geometry import loads_geometry
from app.models import Block, BlockForecast, Panchayat, PanchayatForecast, User, WeatherObservation
from app.services.audit import write_audit
from app.services.cache import cache_get, cache_set
from app.services.pipeline import generate_and_store
from app.utils.responses import error_body, ok
from app.utils.time import as_naive

router = APIRouter(prefix="/forecasts", tags=["Forecasts"])

VARIABLES = [
    "rainfall_mm",
    "temperature_min_c",
    "temperature_max_c",
    "humidity_percent",
    "wind_speed_kmh",
    "wind_direction_deg",
    "cloud_cover_percent",
    "probability_of_rain",
]


def _source():
    return {
        "label": PANCHAYAT_SOURCE_LABEL,
        "kind": "model_generated_estimate",
        "official_forecast": False,
    }


@router.get("/panchayat/{panchayat_id}")
def panchayat_forecasts(
    panchayat_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    place = db.get(Panchayat, panchayat_id)
    if place is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Panchayat not found"))
    query = db.query(PanchayatForecast).filter(PanchayatForecast.panchayat_id == panchayat_id)
    if start:
        query = query.filter(PanchayatForecast.forecast_time >= start)
    if end:
        query = query.filter(PanchayatForecast.forecast_time <= end)
    rows = _latest_per_day(query.order_by(PanchayatForecast.forecast_time).all(), "forecast_time")
    return ok([panchayat_forecast_dict(row, place.code) for row in rows], source=_source(), disclaimer=True)


@router.get("/block/{block_id}")
def block_forecasts(
    block_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.get(Block, block_id) is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Block not found"))
    query = db.query(BlockForecast).filter(BlockForecast.block_id == block_id)
    if start:
        query = query.filter(BlockForecast.forecast_time >= start)
    if end:
        query = query.filter(BlockForecast.forecast_time <= end)
    rows = query.order_by(BlockForecast.forecast_time, BlockForecast.lead_time_hours).all()
    return ok(
        [block_forecast_dict(row) for row in rows],
        source={"label": BLOCK_SOURCE_LABEL, "kind": "block_forecast", "official_forecast": False},
        disclaimer=True,
    )


@router.get("/compare/{panchayat_id}")
def compare_forecast(
    panchayat_id: int,
    on: datetime | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    place = db.get(Panchayat, panchayat_id)
    if place is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Panchayat not found"))
    query = db.query(PanchayatForecast).filter(PanchayatForecast.panchayat_id == panchayat_id)
    if on is not None:
        day = as_naive(on).normalize()
        rows = _latest_per_day(query.order_by(PanchayatForecast.forecast_time).all(), "forecast_time")
        downscaled = next((row for row in rows if as_naive(row.forecast_time).normalize() == day), None)
    else:
        today = pd.Timestamp.today().normalize()
        rows = _latest_per_day(query.order_by(PanchayatForecast.forecast_time).all(), "forecast_time")
        downscaled = next(
            (row for row in rows if pd.Timestamp(row.forecast_time).tz_localize(None).normalize() >= today),
            rows[-1] if rows else None,
        )
    if downscaled is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "No downscaled estimate is stored for this date"))
    moment = as_naive(downscaled.forecast_time)
    block_rows = (
        db.query(BlockForecast)
        .filter(BlockForecast.block_id == place.block_id)
        .order_by(BlockForecast.lead_time_hours)
        .all()
    )
    block = next(
        (row for row in block_rows if as_naive(row.forecast_time).normalize() == moment.normalize()),
        None,
    )
    observations = (
        db.query(WeatherObservation)
        .filter(WeatherObservation.panchayat_id == place.id)
        .all()
    )
    observed = next(
        (row for row in observations if as_naive(row.observation_time).normalize() == moment.normalize()),
        None,
    )
    month = int(moment.month)
    history = [
        row
        for row in observations
        if as_naive(row.observation_time).month == month and as_naive(row.observation_time) < moment
    ]
    intervals = panchayat_forecast_dict(downscaled)["intervals"]
    confidences = panchayat_forecast_dict(downscaled)["confidence_by_variable"]
    variables = []
    for name in VARIABLES:
        block_value = getattr(block, name, None) if block else None
        down_value = getattr(downscaled, name, None)
        obs_value = getattr(observed, name, None) if observed else None
        hist_values = [
            getattr(row, name)
            for row in history
            if hasattr(row, name) and getattr(row, name) is not None
        ]
        historical_average = float(sum(hist_values) / len(hist_values)) if hist_values else None
        difference = None if block_value is None or down_value is None else float(down_value) - float(block_value)
        band = intervals.get(name, {})
        variables.append(
            {
                "variable": name,
                "unit": VARIABLE_UNITS.get(name, ""),
                "block_forecast": block_value,
                "downscaled": down_value,
                "observed": obs_value,
                "historical_average": historical_average,
                "difference_downscaled_minus_block": difference,
                "lower_bound": band.get("lower", downscaled.lower_bound if name == "rainfall_mm" else None),
                "upper_bound": band.get("upper", downscaled.upper_bound if name == "rainfall_mm" else None),
                "confidence_score": confidences.get(name, downscaled.confidence_score),
            }
        )
    return ok(
        {
            "panchayat": {"id": place.id, "name": place.name, "code": place.code, "block_id": place.block_id},
            "date": moment.date().isoformat(),
            "model_version": downscaled.model_version,
            "generated_at": downscaled.generated_at.isoformat() if downscaled.generated_at else None,
            "data_source_label": downscaled.data_source_label,
            "block_source_label": BLOCK_SOURCE_LABEL,
            "observed_source_label": OBSERVED_SOURCE_LABEL if observed else "No observation is available for this date.",
            "official_forecast": False,
            "disclaimer": DISCLAIMER,
            "variables": variables,
            "downscaled": panchayat_forecast_dict(downscaled, place.code),
            "block": block_forecast_dict(block) if block else None,
            "observation": observation_dict(observed) if observed else None,
        },
        source=_source(),
        disclaimer=True,
    )


@router.get("/map")
def forecast_map(
    on: datetime | None = None,
    variable: str = "rainfall_mm",
    layer: str = "downscaled",
    block_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if variable not in VARIABLES and variable != "confidence_score":
        raise HTTPException(status_code=422, detail=error_body("invalid_variable", "Unknown map variable"))
    if layer not in {"downscaled", "block", "observed", "error", "confidence"}:
        raise HTTPException(status_code=422, detail=error_body("invalid_layer", "Unknown map layer"))
    day = as_naive(on).normalize() if on else pd.Timestamp.today().normalize()
    cache_key = f"map:{day.date().isoformat()}:{variable}:{layer}:{block_id}"
    cached = cache_get(cache_key)
    if cached:
        return ok(cached, source=_source(), disclaimer=True)

    places = db.query(Panchayat)
    if block_id is not None:
        places = places.filter(Panchayat.block_id == block_id)
    places = places.all()
    place_ids = [place.id for place in places]
    block_ids = {place.block_id for place in places}
    forecasts_by_place: dict[int, list] = {}
    for row in db.query(PanchayatForecast).filter(PanchayatForecast.panchayat_id.in_(place_ids or [-1])).all():
        forecasts_by_place.setdefault(row.panchayat_id, []).append(row)
    blocks_by_id: dict[int, list] = {}
    for row in db.query(BlockForecast).filter(BlockForecast.block_id.in_(block_ids or [-1])).all():
        blocks_by_id.setdefault(row.block_id, []).append(row)
    observed_by_place: dict[int, list] = {}
    for row in db.query(WeatherObservation).filter(WeatherObservation.panchayat_id.in_(place_ids or [-1])).all():
        observed_by_place.setdefault(row.panchayat_id, []).append(row)
    features = []
    for place in places:
        geometry = loads_geometry(place.geometry)
        if geometry is None and place.latitude and place.longitude:
            geometry = {"type": "Point", "coordinates": [place.longitude, place.latitude]}
        if geometry is None:
            continue
        down = _latest_on_day(forecasts_by_place.get(place.id, []), "forecast_time", day)
        block = _latest_on_day(blocks_by_id.get(place.block_id, []), "forecast_time", day)
        observed = _latest_on_day(observed_by_place.get(place.id, []), "observation_time", day)
        value, note = _layer_value(layer, variable, down, block, observed)
        features.append(
            {
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "id": place.id,
                    "name": place.name,
                    "code": place.code,
                    "block_id": place.block_id,
                    "value": value,
                    "variable": variable if layer != "confidence" else "confidence_score",
                    "layer": layer,
                    "unit": "%" if layer == "confidence" else VARIABLE_UNITS.get(variable, ""),
                    "confidence_score": None if down is None else down.confidence_score,
                    "low_confidence": bool(down and down.confidence_score is not None and down.confidence_score < 0.5),
                    "note": note,
                    "data_source_label": PANCHAYAT_SOURCE_LABEL if layer in {"downscaled", "error", "confidence"} else BLOCK_SOURCE_LABEL,
                    "model_version": None if down is None else down.model_version,
                    "generated_at": None if down is None or down.generated_at is None else down.generated_at.isoformat(),
                },
            }
        )
    payload = {"type": "FeatureCollection", "features": features, "date": day.date().isoformat(), "official_forecast": False}
    cache_set(cache_key, payload, ttl_seconds=60)
    return ok(payload, source=_source(), disclaimer=True)


def _latest_on_day(rows, field: str, day: pd.Timestamp):
    matches = [row for row in rows if as_naive(getattr(row, field)).normalize() == day]
    if not matches:
        return None

    def rank(row):
        generated = getattr(row, "generated_at", None)
        stamp = as_naive(generated) if generated is not None else pd.Timestamp.min
        return (stamp, getattr(row, "id", 0) or 0)

    return max(matches, key=rank)


def _latest_per_day(rows, field: str):
    chosen = {}
    for row in rows:
        day = as_naive(getattr(row, field)).normalize()
        current = chosen.get(day)
        chosen[day] = row if current is None else _latest_on_day([current, row], field, day)
    return [chosen[day] for day in sorted(chosen)]


def _layer_value(layer: str, variable: str, down, block, observed):
    if layer == "confidence":
        if down is None or down.confidence_score is None:
            return None, "Confidence unavailable"
        return down.confidence_score, "Model confidence, not an official probability"
    if layer == "block":
        if block is None:
            return None, "Block forecast unavailable"
        return getattr(block, variable, None), BLOCK_SOURCE_LABEL
    if layer == "observed":
        if observed is None or getattr(observed, variable, None) is None:
            return None, "Observation unavailable for this date"
        return getattr(observed, variable), OBSERVED_SOURCE_LABEL
    if layer == "error":
        if down is None or getattr(down, variable, None) is None:
            return None, "Downscaled estimate unavailable"
        if observed is not None and getattr(observed, variable, None) is not None:
            return float(getattr(down, variable)) - float(getattr(observed, variable)), "Downscaled minus observation"
        if block is not None and getattr(block, variable, None) is not None:
            return float(getattr(down, variable)) - float(getattr(block, variable)), "Downscaled minus block forecast"
        return None, "No reference value"
    if down is None:
        return None, "Downscaled estimate unavailable"
    return getattr(down, variable, None), down.data_source_label


@router.post("/generate")
def generate(db: Session = Depends(get_db), user: User = Depends(require_roles("admin", "officer"))):
    result = generate_and_store(db)
    write_audit(db, user.id, "generate_forecasts", "panchayat_forecast", None, json_detail(result))
    db.commit()
    return ok(result, source=_source(), disclaimer=True)


def json_detail(result: dict) -> str:
    return str(result)


@router.get("/latest")
def latest(
    panchayat_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(PanchayatForecast)
    if panchayat_id is not None:
        query = query.filter(PanchayatForecast.panchayat_id == panchayat_id)
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    rows = query.filter(PanchayatForecast.forecast_time >= today).order_by(PanchayatForecast.forecast_time).all()
    if not rows:
        rows = query.order_by(PanchayatForecast.forecast_time.desc()).limit(20).all()
    codes = {item.id: item.code for item in db.query(Panchayat).all()}
    return ok(
        [panchayat_forecast_dict(row, codes.get(row.panchayat_id)) for row in rows],
        source=_source(),
        disclaimer=True,
    )
