"""Persist the synthetic demonstration dataset."""

from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import REPO_ROOT, get_settings
from app.geospatial.geometry import dumps
from app.models import (
    Block,
    BlockForecast,
    Crop,
    CropStage,
    District,
    EnvironmentalFeature,
    Panchayat,
    State,
    User,
    WeatherObservation,
)
from app.services.demo_data import build_demo_bundle
from app.services.security import hash_password

DEMO_USERS = [
    ("Farmer Demo", "farmer@example.com", "Farmer@123", "farmer", "Maharashtra", "Pune"),
    ("Officer Demo", "officer@example.com", "Officer@123", "officer", "Maharashtra", "Pune"),
    ("Admin Demo", "admin@example.com", "Admin@123", "admin", "Maharashtra", "Ahilyanagar"),
]


def persist_demo(db: Session, reset: bool = False) -> dict:
    existing = db.query(User).count()
    if existing and not reset:
        return {"seeded": False, "reason": "database already has users"}
    if reset:
        _wipe(db)
    settings = get_settings()
    bundle = build_demo_bundle(history_days=settings.demo_history_days, leads=settings.lead_hours)
    _write_files(bundle)

    state_row = State(name=bundle["states"][0]["name"], code=bundle["states"][0]["code"], geometry=dumps(bundle["states"][0]["geometry"]))
    db.add(state_row)
    db.flush()

    district_ids = {}
    for item in bundle["districts"]:
        row = District(state_id=state_row.id, name=item["name"], code=item["code"], geometry=dumps(item["geometry"]))
        db.add(row)
        db.flush()
        district_ids[item["code"]] = row.id

    block_ids = {}
    for item in bundle["blocks"]:
        row = Block(
            district_id=district_ids[item["district_code"]],
            name=item["name"],
            code=item["code"],
            geometry=dumps(item["geometry"]),
        )
        db.add(row)
        db.flush()
        block_ids[item["code"]] = row.id

    panchayat_ids = {}
    for item in bundle["panchayats"]:
        row = Panchayat(
            block_id=block_ids[item["block_code"]],
            name=item["name"],
            code=item["code"],
            latitude=item["latitude"],
            longitude=item["longitude"],
            area_sq_km=item["area_sq_km"],
            elevation_mean=item["elevation_mean"],
            slope_mean=item["slope_mean"],
            aspect_mean=item["aspect_mean"],
            land_cover_type=item["land_cover_type"],
            distance_to_water_km=item["distance_to_water_km"],
            geometry=dumps(item["geometry"]),
        )
        db.add(row)
        db.flush()
        panchayat_ids[item["code"]] = row.id

    for item in bundle["environmental_features"]:
        db.add(
            EnvironmentalFeature(
                panchayat_id=panchayat_ids[item["panchayat_code"]],
                elevation_m=item["elevation_m"],
                slope_degree=item["slope_degree"],
                aspect_degree=item["aspect_degree"],
                land_cover=item["land_cover"],
                distance_to_water_km=item["distance_to_water_km"],
                latitude=item["latitude"],
                longitude=item["longitude"],
                normalized_x=item["normalized_x"],
                normalized_y=item["normalized_y"],
            )
        )

    db.bulk_save_objects(
        [
            WeatherObservation(
                panchayat_id=panchayat_ids[item["panchayat_code"]],
                observation_time=item["observation_time"],
                rainfall_mm=item["rainfall_mm"],
                temperature_min_c=item["temperature_min_c"],
                temperature_max_c=item["temperature_max_c"],
                humidity_percent=item["humidity_percent"],
                wind_speed_kmh=item["wind_speed_kmh"],
                wind_direction_deg=item["wind_direction_deg"],
                cloud_cover_percent=item["cloud_cover_percent"],
                data_source=item["data_source"],
                quality_flag=item["quality_flag"],
            )
            for item in bundle["observations"]
        ]
    )
    db.bulk_save_objects(
        [
            BlockForecast(
                block_id=block_ids[item["block_code"]],
                forecast_time=item["forecast_time"],
                issue_time=item["issue_time"],
                lead_time_hours=item["lead_time_hours"],
                rainfall_mm=item["rainfall_mm"],
                temperature_min_c=item["temperature_min_c"],
                temperature_max_c=item["temperature_max_c"],
                humidity_percent=item["humidity_percent"],
                wind_speed_kmh=item["wind_speed_kmh"],
                wind_direction_deg=item["wind_direction_deg"],
                cloud_cover_percent=item["cloud_cover_percent"],
                probability_of_rain=item["probability_of_rain"],
                source=item["source"],
                quality_flag=item["quality_flag"],
            )
            for item in bundle["block_forecasts"]
        ]
    )

    for crop in bundle["crops"]:
        crop_row = Crop(
            name=crop["name"],
            scientific_name=crop["scientific_name"],
            season=crop["season"],
            typical_duration_days=crop["typical_duration_days"],
        )
        db.add(crop_row)
        db.flush()
        for name, start_day, end_day in crop["stages"]:
            db.add(CropStage(crop_id=crop_row.id, name=name, start_day=start_day, end_day=end_day))

    for name, email, password, role, state, district in DEMO_USERS:
        db.add(
            User(
                name=name,
                email=email,
                password_hash=hash_password(password),
                role=role,
                state=state,
                district=district,
            )
        )
    db.commit()
    return {
        "seeded": True,
        "panchayats": len(bundle["panchayats"]),
        "observations": len(bundle["observations"]),
        "block_forecasts": len(bundle["block_forecasts"]),
        "meta": bundle["meta"],
    }


def _write_files(bundle: dict) -> None:
    folder = REPO_ROOT / "data" / "demo"
    folder.mkdir(parents=True, exist_ok=True)
    features = []
    for place in bundle["panchayats"]:
        features.append(
            {
                "type": "Feature",
                "geometry": place["geometry"],
                "properties": {"code": place["code"], "name": place["name"], "block_code": place["block_code"]},
            }
        )
    (folder / "panchayats.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
    (folder / "water_bodies.geojson").write_text(json.dumps(bundle["water_geojson"]), encoding="utf-8")
    (folder / "README.txt").write_text(
        "Synthetic demonstration boundaries and water bodies. Not official geospatial products.\n",
        encoding="utf-8",
    )


def _wipe(db: Session) -> None:
    from app.models import Advisory, AuditLog, DataJob, ModelRun, PanchayatForecast

    for model in (
        Advisory,
        PanchayatForecast,
        WeatherObservation,
        BlockForecast,
        EnvironmentalFeature,
        ModelRun,
        DataJob,
        AuditLog,
        CropStage,
        Crop,
        Panchayat,
        Block,
        District,
        State,
        User,
    ):
        db.query(model).delete()
    db.commit()
