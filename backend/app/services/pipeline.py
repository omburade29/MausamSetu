"""Load database tables, train models, and store panchayat forecasts."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pandas as pd
from sqlalchemy.orm import Session

from app.advisory.engine import generate_advisories
from app.constants import PANCHAYAT_SOURCE_LABEL
from app.ml.features import build_feature_table
from app.ml.predict import predict_frame
from app.ml.train import save_bundle, train_models
from app.models import (
    Advisory,
    Block,
    BlockForecast,
    Crop,
    CropStage,
    ModelRun,
    Panchayat,
    PanchayatForecast,
    User,
    WeatherObservation,
)
from app.models.entities import utcnow


def load_frames(db: Session) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    bind = db.get_bind()
    panchayats = pd.read_sql(db.query(Panchayat).statement, bind)
    observations = pd.read_sql(db.query(WeatherObservation).statement, bind)
    forecasts = pd.read_sql(db.query(BlockForecast).statement, bind)
    return panchayats, observations, forecasts


def build_features(db: Session):
    panchayats, observations, forecasts = load_frames(db)
    return build_feature_table(panchayats, observations, forecasts)


def train_and_store(db: Session) -> dict:
    frame, log = build_features(db)
    bundle, _rows = train_models(frame, log)
    save_bundle(bundle)
    for variable, payload in bundle["metrics"].items():
        db.add(
            ModelRun(
                model_name=bundle["library"],
                model_version=bundle["model_version"],
                variable=variable,
                training_start_date=_parse_day(bundle["training_start"]),
                training_end_date=_parse_day(bundle["training_end"]),
                validation_start_date=_parse_day(bundle["validation_start"]),
                validation_end_date=_parse_day(bundle["validation_end"]),
                mae=payload.get("mae"),
                rmse=payload.get("rmse"),
                r2=payload.get("r2"),
                baseline_mae=payload.get("baseline_mae"),
                baseline_rmse=payload.get("baseline_rmse"),
                improvement_percent=payload.get("improvement_percent"),
                status="completed",
                statement=payload.get("statement"),
                metrics_json=json.dumps(payload),
                created_at=utcnow(),
            )
        )
    db.commit()
    return {
        "model_version": bundle["model_version"],
        "library": bundle["library"],
        "statements": {name: payload["statement"] for name, payload in bundle["metrics"].items()},
        "imputation_events": len(bundle.get("imputation_log") or []),
    }


def generate_and_store(db: Session) -> dict:
    frame, feature_log = build_features(db)
    if frame.empty:
        return {"stored": 0, "reason": "no features"}
    day = pd.to_datetime(frame["day"])
    if getattr(day.dt, "tz", None) is not None:
        day = day.dt.tz_convert("UTC").dt.tz_localize(None)
    day = day.dt.normalize()
    today = pd.Timestamp.today().normalize()
    past_start = today - pd.Timedelta(days=30)
    historical = frame.loc[(day < today) & (day >= past_start) & (frame["lead_time_hours"] == 24)]
    future = frame.loc[day >= today].sort_values(["panchayat_id", "day", "lead_time_hours"])
    future = future.groupby(["panchayat_id", "day"], as_index=False).head(1)
    subset = pd.concat([historical, future], ignore_index=True)
    predicted, predict_log = predict_frame(subset)
    db.query(PanchayatForecast).delete()
    now = datetime.now(timezone.utc)
    for record in predicted.to_dict(orient="records"):
        db.add(
            PanchayatForecast(
                panchayat_id=int(record["panchayat_id"]),
                block_forecast_id=record["block_forecast_id"],
                forecast_time=_as_utc(record["forecast_time"]),
                model_version=record["model_version"],
                rainfall_mm=_num(record["rainfall_mm"]),
                temperature_min_c=_num(record["temperature_min_c"]),
                temperature_max_c=_num(record["temperature_max_c"]),
                humidity_percent=_num(record["humidity_percent"]),
                wind_speed_kmh=_num(record["wind_speed_kmh"]),
                wind_direction_deg=_num(record["wind_direction_deg"]),
                cloud_cover_percent=_num(record["cloud_cover_percent"]),
                probability_of_rain=_num(record["probability_of_rain"]),
                lower_bound=_num(record["lower_bound"]),
                upper_bound=_num(record["upper_bound"]),
                confidence_score=_num(record["confidence_score"]),
                intervals_json=json.dumps(record["intervals"]),
                confidence_json=json.dumps(record["confidence_by_variable"]),
                data_source_label=record["data_source_label"] or PANCHAYAT_SOURCE_LABEL,
                generated_at=now,
            )
        )
    db.commit()
    advisory_count = ensure_sample_advisories(db)
    return {
        "stored": int(len(predicted)),
        "model_version": None if predicted.empty else str(predicted.iloc[0]["model_version"]),
        "feature_log_events": len(feature_log),
        "predict_log_events": len(predict_log),
        "advisories": advisory_count,
    }


def ensure_sample_advisories(db: Session) -> int:
    if db.query(Advisory).count():
        return 0
    forecasts = (
        db.query(PanchayatForecast)
        .order_by(PanchayatForecast.forecast_time)
        .all()
    )
    if not forecasts:
        return 0
    from app.utils.time import as_naive

    today = pd.Timestamp.today().normalize()
    upcoming = [item for item in forecasts if as_naive(item.forecast_time) >= today]
    chosen = upcoming[: 24 * 3] or forecasts[-24:]
    crops = {crop.name: crop for crop in db.query(Crop).all()}
    stages = db.query(CropStage).all()
    stage_by_crop: dict[int, list[CropStage]] = {}
    for stage in stages:
        stage_by_crop.setdefault(stage.crop_id, []).append(stage)
    soils = ["clay loam", "sandy loam", "black cotton soil", "loam"]
    admin = db.query(User).filter(User.role == "admin").first()
    created = 0
    by_place: dict[int, list[PanchayatForecast]] = {}
    for item in forecasts:
        by_place.setdefault(item.panchayat_id, []).append(item)
    for forecast in chosen:
        moment = pd.Timestamp(forecast.forecast_time)
        month = int(moment.month)
        for crop_name in _crops_for_month(month):
            crop = crops.get(crop_name)
            if crop is None:
                continue
            stage = _pick_stage(stage_by_crop.get(crop.id, []), crop_name, month)
            context = _context_from_forecast(forecast, by_place.get(forecast.panchayat_id, []), crop_name, stage.name if stage else "", soils[forecast.panchayat_id % len(soils)])
            for advice in generate_advisories(context, valid_on=moment.date()):
                db.add(
                    Advisory(
                        panchayat_id=forecast.panchayat_id,
                        crop_id=crop.id,
                        crop_stage_id=stage.id if stage else None,
                        forecast_date=_as_utc(forecast.forecast_time),
                        advisory_type=advice["advisory_type"],
                        title=advice["title"],
                        message=advice["message"],
                        reason=advice["reason"],
                        action=advice["action"],
                        severity=advice["severity"],
                        confidence_score=advice["confidence_score"],
                        soil_type=context["soil_type"],
                        disclaimer=advice["disclaimer"],
                        reviewed_by=admin.id if admin else None,
                        status="published",
                        rule_id=advice["rule_id"],
                        created_at=utcnow(),
                    )
                )
                created += 1
    db.commit()
    return created


def _crops_for_month(month: int) -> list[str]:
    if month in (6, 7, 8, 9, 10):
        return ["Rice", "Cotton"]
    if month in (11, 12, 1, 2, 3):
        return ["Wheat"]
    return ["Rice"]


def _pick_stage(stages: list[CropStage], crop_name: str, month: int) -> CropStage | None:
    preferred = {
        ("Rice", 6): "Tillering",
        ("Rice", 7): "Tillering",
        ("Rice", 8): "Grain filling",
        ("Rice", 9): "Grain filling",
        ("Rice", 10): "Harvest",
        ("Cotton", 6): "Square formation",
        ("Cotton", 7): "Flowering",
        ("Cotton", 8): "Boll development",
        ("Cotton", 9): "Boll development",
        ("Cotton", 10): "Boll development",
        ("Wheat", 11): "Sowing",
        ("Wheat", 12): "Crown root initiation",
        ("Wheat", 1): "Tillering",
        ("Wheat", 2): "Flowering",
        ("Wheat", 3): "Grain filling",
    }.get((crop_name, month))
    if preferred:
        for stage in stages:
            if stage.name == preferred:
                return stage
    return stages[0] if stages else None


def _context_from_forecast(forecast: PanchayatForecast, series: list[PanchayatForecast], crop_name: str, stage_name: str, soil: str) -> dict:
    ordered = sorted(series, key=lambda item: item.forecast_time)
    high = 0
    for item in ordered:
        if item.forecast_time > forecast.forecast_time:
            break
        if (item.humidity_percent or 0) >= 80:
            high += 1
        else:
            high = 0
    moment = pd.Timestamp(forecast.forecast_time)
    return {
        "rainfall_mm": forecast.rainfall_mm or 0,
        "probability_of_rain": forecast.probability_of_rain or 0,
        "temperature_max_c": forecast.temperature_max_c or 0,
        "temperature_min_c": forecast.temperature_min_c or 0,
        "humidity_percent": forecast.humidity_percent or 0,
        "humidity_high_days": high,
        "wind_speed_kmh": forecast.wind_speed_kmh or 0,
        "confidence_score": forecast.confidence_score or 0,
        "crop_name": crop_name,
        "stage_name": stage_name,
        "soil_type": soil,
        "month": int(moment.month),
        "forecast_date": moment.date(),
    }


def _parse_day(value: str) -> datetime:
    return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)


def _as_utc(value) -> datetime:
    stamp = pd.Timestamp(value)
    if stamp.tzinfo is None:
        stamp = stamp.tz_localize("UTC")
    return stamp.to_pydatetime()


def _num(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    return float(value)
