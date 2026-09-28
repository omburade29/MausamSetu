import json

from app.constants import BLOCK_SOURCE_LABEL, OBSERVED_SOURCE_LABEL, PANCHAYAT_SOURCE_LABEL
from app.utils.responses import parse_json


def user_dict(user) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "state": user.state,
        "district": user.district,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def place_dict(row, extra: dict | None = None) -> dict:
    payload = {
        "id": row.id,
        "name": row.name,
        "code": row.code,
        "geometry": json.loads(row.geometry) if row.geometry else None,
    }
    for field in ("state_id", "district_id", "block_id", "latitude", "longitude", "area_sq_km", "elevation_mean", "slope_mean", "aspect_mean", "land_cover_type", "distance_to_water_km"):
        if hasattr(row, field):
            payload[field] = getattr(row, field)
    if extra:
        payload.update(extra)
    return payload


def panchayat_forecast_dict(row, code: str | None = None) -> dict:
    score = row.confidence_score
    return {
        "id": row.id,
        "panchayat_id": row.panchayat_id,
        "panchayat_code": code,
        "block_forecast_id": row.block_forecast_id,
        "forecast_time": row.forecast_time.isoformat(),
        "model_version": row.model_version,
        "rainfall_mm": row.rainfall_mm,
        "temperature_min_c": row.temperature_min_c,
        "temperature_max_c": row.temperature_max_c,
        "humidity_percent": row.humidity_percent,
        "wind_speed_kmh": row.wind_speed_kmh,
        "wind_direction_deg": row.wind_direction_deg,
        "cloud_cover_percent": row.cloud_cover_percent,
        "probability_of_rain": row.probability_of_rain,
        "lower_bound": row.lower_bound,
        "upper_bound": row.upper_bound,
        "confidence_score": score,
        "low_confidence": score is not None and score < 0.5,
        "intervals": parse_json(row.intervals_json, {}),
        "confidence_by_variable": parse_json(row.confidence_json, {}),
        "data_source_label": row.data_source_label or PANCHAYAT_SOURCE_LABEL,
        "generated_at": row.generated_at.isoformat() if row.generated_at else None,
        "estimate_kind": "downscaled_model_estimate",
    }


def block_forecast_dict(row) -> dict:
    return {
        "id": row.id,
        "block_id": row.block_id,
        "forecast_time": row.forecast_time.isoformat(),
        "issue_time": row.issue_time.isoformat() if row.issue_time else None,
        "lead_time_hours": row.lead_time_hours,
        "rainfall_mm": row.rainfall_mm,
        "temperature_min_c": row.temperature_min_c,
        "temperature_max_c": row.temperature_max_c,
        "humidity_percent": row.humidity_percent,
        "wind_speed_kmh": row.wind_speed_kmh,
        "wind_direction_deg": row.wind_direction_deg,
        "cloud_cover_percent": row.cloud_cover_percent,
        "probability_of_rain": row.probability_of_rain,
        "source": row.source,
        "quality_flag": row.quality_flag,
        "data_source_label": BLOCK_SOURCE_LABEL,
        "estimate_kind": "block_forecast",
    }


def observation_dict(row) -> dict:
    return {
        "id": row.id,
        "panchayat_id": row.panchayat_id,
        "observation_time": row.observation_time.isoformat(),
        "rainfall_mm": row.rainfall_mm,
        "temperature_min_c": row.temperature_min_c,
        "temperature_max_c": row.temperature_max_c,
        "humidity_percent": row.humidity_percent,
        "wind_speed_kmh": row.wind_speed_kmh,
        "wind_direction_deg": row.wind_direction_deg,
        "cloud_cover_percent": row.cloud_cover_percent,
        "data_source": row.data_source,
        "quality_flag": row.quality_flag,
        "data_source_label": OBSERVED_SOURCE_LABEL,
        "estimate_kind": "observation",
    }
