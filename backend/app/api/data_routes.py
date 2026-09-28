import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.config import REPO_ROOT, get_settings
from app.database import get_db
from app.geospatial.geometry import dumps
from app.models import Block, BlockForecast, DataJob, EnvironmentalFeature, Panchayat, User, WeatherObservation
from app.models.entities import utcnow
from app.services.audit import write_audit
from app.services.pipeline import build_features
from app.services.uploads import (
    BLOCK_FORECAST_COLUMNS,
    OBSERVATION_COLUMNS,
    PANCHAYAT_COLUMNS,
    preview_rows,
    validate_geojson,
    validate_table,
)
from app.utils.responses import error_body, ok

router = APIRouter(prefix="/data", tags=["Data"])

TEMPLATES = {
    "observations": OBSERVATION_COLUMNS,
    "block-forecasts": BLOCK_FORECAST_COLUMNS,
    "panchayats": PANCHAYAT_COLUMNS,
    "environment": [
        "panchayat_code",
        "elevation_m",
        "slope_degree",
        "aspect_degree",
        "land_cover",
        "distance_to_water_km",
    ],
}


async def _read(file: UploadFile) -> bytes:
    settings = get_settings()
    if not file.filename:
        raise HTTPException(status_code=400, detail=error_body("invalid_file", "A filename is required"))
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=error_body("file_too_large", f"Files must be under {settings.max_upload_mb} MB"))
    return content


def _job(db, user, job_type, message, errors, preview, status="completed") -> DataJob:
    row = DataJob(
        job_type=job_type,
        status=status,
        message=message,
        errors_json=json.dumps(errors),
        preview_json=json.dumps(preview),
        created_by=user.id,
        created_at=utcnow(),
        finished_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.flush()
    write_audit(db, user.id, "upload", job_type, str(row.id), message)
    return row


@router.get("/templates/{name}")
def template(name: str, _: User = Depends(require_roles("admin"))):
    path = REPO_ROOT / "data" / "templates" / f"{name}.csv"
    if not path.exists():
        raise HTTPException(status_code=404, detail=error_body("not_found", "Template not found"))
    return ok({"name": name, "csv": path.read_text(encoding="utf-8")})


@router.post("/upload/observations")
async def upload_observations(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    _check_extension(file.filename, {".csv"})
    content = await _read(file)
    result = validate_table(content.decode("utf-8-sig"), OBSERVATION_COLUMNS)
    codes = {row.code: row.id for row in db.query(Panchayat).all()}
    accepted = 0
    for row in result.rows:
        panchayat_id = codes.get(row["panchayat_code"])
        if panchayat_id is None:
            result.errors.append({"row": row["panchayat_code"], "column": "panchayat_code", "message": "Unknown panchayat code"})
            continue
        db.add(
            WeatherObservation(
                panchayat_id=panchayat_id,
                observation_time=row["observation_time"],
                rainfall_mm=row["rainfall_mm"],
                temperature_min_c=row["temperature_min_c"],
                temperature_max_c=row["temperature_max_c"],
                humidity_percent=row["humidity_percent"],
                wind_speed_kmh=row["wind_speed_kmh"],
                wind_direction_deg=row["wind_direction_deg"],
                cloud_cover_percent=row["cloud_cover_percent"],
                data_source=row.get("data_source") or "upload",
                quality_flag="ok",
            )
        )
        accepted += 1
    job = _job(db, user, "observations", f"Accepted {accepted} observation rows", result.errors, preview_rows(result.rows))
    db.commit()
    return ok(_job_dict(job, accepted))


@router.post("/upload/block-forecasts")
async def upload_block_forecasts(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    _check_extension(file.filename, {".csv"})
    content = await _read(file)
    result = validate_table(content.decode("utf-8-sig"), BLOCK_FORECAST_COLUMNS)
    codes = {row.code: row.id for row in db.query(Block).all()}
    accepted = 0
    for row in result.rows:
        block_id = codes.get(row["block_code"])
        if block_id is None:
            result.errors.append({"row": row["block_code"], "column": "block_code", "message": "Unknown block code"})
            continue
        db.add(
            BlockForecast(
                block_id=block_id,
                forecast_time=row["forecast_time"],
                issue_time=row["issue_time"],
                lead_time_hours=int(row["lead_time_hours"]),
                rainfall_mm=row["rainfall_mm"],
                temperature_min_c=row["temperature_min_c"],
                temperature_max_c=row["temperature_max_c"],
                humidity_percent=row["humidity_percent"],
                wind_speed_kmh=row["wind_speed_kmh"],
                wind_direction_deg=row["wind_direction_deg"],
                cloud_cover_percent=row["cloud_cover_percent"],
                probability_of_rain=row["probability_of_rain"],
                source=row.get("source") or "upload",
                quality_flag="ok",
            )
        )
        accepted += 1
    job = _job(db, user, "block_forecasts", f"Accepted {accepted} block forecast rows", result.errors, preview_rows(result.rows))
    db.commit()
    return ok(_job_dict(job, accepted))


@router.post("/upload/panchayat-boundaries")
async def upload_panchayat_boundaries(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    _check_extension(file.filename, {".json", ".geojson"})
    content = await _read(file)
    payload, errors = validate_geojson(content)
    updated = 0
    if payload:
        codes = {row.code: row for row in db.query(Panchayat).all()}
        for feature in payload["features"]:
            props = feature.get("properties") or {}
            code = props.get("panchayat_code") or props.get("code")
            row = codes.get(code)
            if row is None or not feature.get("geometry"):
                errors.append({"row": code or "?", "column": "code", "message": "Panchayat code was not matched"})
                continue
            row.geometry = dumps(feature["geometry"])
            updated += 1
    job = _job(db, user, "panchayat_boundaries", f"Updated {updated} panchayat geometries", errors, [])
    db.commit()
    return ok(_job_dict(job, updated))


@router.post("/upload/environmental-data")
async def upload_environment(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    filename = (file.filename or "").lower()
    content = await _read(file)
    if filename.endswith((".tif", ".tiff")):
        saved = get_settings().upload_path() / file.filename
        saved.write_bytes(content)
        message = _raster_message(saved)
        job = _job(db, user, "environment_raster", message, [], [])
        db.commit()
        return ok(_job_dict(job, 0))
    if filename.endswith((".json", ".geojson")):
        payload, errors = validate_geojson(content)
        saved = get_settings().upload_path() / (file.filename or "water.geojson")
        saved.write_bytes(content)
        count = len(payload["features"]) if payload else 0
        job = _job(db, user, "water_bodies", f"Stored water-body GeoJSON with {count} features", errors, [])
        db.commit()
        return ok(_job_dict(job, count))
    _check_extension(file.filename, {".csv"})
    required = TEMPLATES["environment"]
    result = validate_table(
        content.decode("utf-8-sig"),
        required,
        numeric=["elevation_m", "slope_degree", "aspect_degree", "distance_to_water_km"],
    )
    codes = {row.code: row for row in db.query(Panchayat).all()}
    accepted = 0
    for row in result.rows:
        place = codes.get(row["panchayat_code"])
        if place is None:
            result.errors.append({"row": row["panchayat_code"], "column": "panchayat_code", "message": "Unknown panchayat code"})
            continue
        feature = db.query(EnvironmentalFeature).filter(EnvironmentalFeature.panchayat_id == place.id).first()
        if feature is None:
            feature = EnvironmentalFeature(
                panchayat_id=place.id,
                elevation_m=row["elevation_m"] or 0,
                slope_degree=row["slope_degree"] or 0,
                aspect_degree=row["aspect_degree"] or 0,
                land_cover=row["land_cover"] or "unknown",
                distance_to_water_km=row["distance_to_water_km"] or 0,
                latitude=place.latitude,
                longitude=place.longitude,
                normalized_x=0,
                normalized_y=0,
            )
            db.add(feature)
        else:
            feature.elevation_m = row["elevation_m"] or feature.elevation_m
            feature.slope_degree = row["slope_degree"] or feature.slope_degree
            feature.aspect_degree = row["aspect_degree"] or feature.aspect_degree
            feature.land_cover = row["land_cover"] or feature.land_cover
            feature.distance_to_water_km = row["distance_to_water_km"] or feature.distance_to_water_km
        place.elevation_mean = feature.elevation_m
        place.slope_mean = feature.slope_degree
        place.aspect_mean = feature.aspect_degree
        place.land_cover_type = feature.land_cover
        place.distance_to_water_km = feature.distance_to_water_km
        accepted += 1
    job = _job(db, user, "environment", f"Updated {accepted} environmental records", result.errors, preview_rows(result.rows))
    db.commit()
    return ok(_job_dict(job, accepted))


@router.post("/features/generate")
def generate_features(db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    frame, log = build_features(db)
    summary = {
        "rows": int(len(frame)),
        "panchayats": int(frame["panchayat_id"].nunique()) if not frame.empty else 0,
        "missing_feature_rows": int((frame["missing_feature_count"] > 0).sum()) if not frame.empty else 0,
        "log": log[:40],
    }
    job = _job(db, user, "feature_generation", "Feature table built", [], [summary])
    db.commit()
    return ok(_job_dict(job, summary["rows"]))


@router.get("/jobs")
def jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    query = db.query(DataJob).order_by(DataJob.created_at.desc())
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    return ok([_job_dict(row) for row in rows], meta={"page": page, "page_size": page_size, "total": total})


@router.get("/jobs/{job_id}")
def job_detail(job_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    row = db.get(DataJob, job_id)
    if row is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Job not found"))
    return ok(_job_dict(row))


def _job_dict(row: DataJob, accepted: int | None = None) -> dict:
    return {
        "id": row.id,
        "job_type": row.job_type,
        "status": row.status,
        "message": row.message,
        "accepted_rows": accepted,
        "errors": json.loads(row.errors_json or "[]"),
        "preview": json.loads(row.preview_json or "[]"),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "finished_at": row.finished_at.isoformat() if row.finished_at else None,
    }


def _check_extension(filename: str | None, allowed: set[str]) -> None:
    name = (filename or "").lower()
    if not any(name.endswith(ext) for ext in allowed):
        raise HTTPException(status_code=400, detail=error_body("invalid_file_type", f"Allowed types: {', '.join(sorted(allowed))}"))


def _raster_message(path) -> str:
    try:
        import rasterio  # type: ignore

        with rasterio.open(path) as src:
            return f"Stored raster {path.name}. Bands: {src.count}. Width: {src.width}. Height: {src.height}. Zonal statistics are available when you retrain."
    except Exception:
        return (
            f"Stored raster {path.name}. rasterio is not installed, so zonal statistics were not computed. "
            "Install backend/requirements-geo.txt to enable elevation and land-cover raster reads. The file was not interpreted as official data."
        )
