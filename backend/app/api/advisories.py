import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.advisory.engine import generate_advisories
from app.api.deps import get_current_user, require_roles
from app.database import get_db
from app.models import Advisory, Crop, CropStage, Panchayat, PanchayatForecast, User
from app.models.entities import utcnow
from app.services.audit import write_audit
from app.services.pipeline import _context_from_forecast
from app.utils.responses import error_body, ok
from app.utils.time import as_naive

router = APIRouter(prefix="/advisories", tags=["Advisories"])


class GenerateIn(BaseModel):
    panchayat_id: int
    crop_id: int
    crop_stage_id: int | None = None
    soil_type: str = Field(default="loam", max_length=80)
    forecast_date: str | None = None


class ReviewIn(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")
    notes: str | None = None


def _dict(row: Advisory, names: dict | None = None) -> dict:
    return {
        "id": row.id,
        "panchayat_id": row.panchayat_id,
        "panchayat_name": None if not names else names.get(row.panchayat_id),
        "crop_id": row.crop_id,
        "crop_stage_id": row.crop_stage_id,
        "forecast_date": row.forecast_date.isoformat(),
        "advisory_type": row.advisory_type,
        "title": row.title,
        "message": row.message,
        "reason": row.reason,
        "action": row.action,
        "severity": row.severity,
        "confidence_score": row.confidence_score,
        "low_confidence": row.confidence_score is not None and row.confidence_score < 0.5,
        "soil_type": row.soil_type,
        "disclaimer": row.disclaimer,
        "reviewed_by": row.reviewed_by,
        "status": row.status,
        "rule_id": row.rule_id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "decision_support": True,
    }


@router.get("/crops")
def crops(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(Crop).order_by(Crop.name).all()
    payload = []
    for crop in rows:
        stages = db.query(CropStage).filter(CropStage.crop_id == crop.id).order_by(CropStage.start_day).all()
        payload.append(
            {
                "id": crop.id,
                "name": crop.name,
                "scientific_name": crop.scientific_name,
                "season": crop.season,
                "typical_duration_days": crop.typical_duration_days,
                "stages": [{"id": stage.id, "name": stage.name, "start_day": stage.start_day, "end_day": stage.end_day} for stage in stages],
            }
        )
    return ok(payload)


@router.get("")
def list_advisories(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    status: str | None = None,
    panchayat_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Advisory).order_by(Advisory.forecast_date.desc(), Advisory.id.desc())
    if user.role == "farmer":
        query = query.filter(Advisory.status == "published")
    elif status:
        query = query.filter(Advisory.status == status)
    if panchayat_id is not None:
        query = query.filter(Advisory.panchayat_id == panchayat_id)
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    names = {item.id: item.name for item in db.query(Panchayat).all()}
    return ok([_dict(row, names) for row in rows], meta={"page": page, "page_size": page_size, "total": total}, disclaimer=True)


@router.get("/panchayat/{panchayat_id}")
def by_panchayat(panchayat_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if db.get(Panchayat, panchayat_id) is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Panchayat not found"))
    query = db.query(Advisory).filter(Advisory.panchayat_id == panchayat_id)
    if user.role == "farmer":
        query = query.filter(Advisory.status == "published")
    rows = query.order_by(Advisory.forecast_date.desc()).all()
    return ok([_dict(row) for row in rows], disclaimer=True)


@router.post("/generate", status_code=201)
def generate(body: GenerateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    place = db.get(Panchayat, body.panchayat_id)
    crop = db.get(Crop, body.crop_id)
    if place is None or crop is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Panchayat or crop not found"))
    stage = db.get(CropStage, body.crop_stage_id) if body.crop_stage_id else None
    forecasts = db.query(PanchayatForecast).filter(PanchayatForecast.panchayat_id == place.id).all()
    if not forecasts:
        raise HTTPException(status_code=404, detail=error_body("not_found", "No downscaled forecast is available"))
    target = None
    if body.forecast_date:
        day = as_naive(body.forecast_date).normalize()
        target = next((item for item in forecasts if as_naive(item.forecast_time).normalize() == day), None)
    if target is None:
        today = pd.Timestamp.today().normalize()
        future = [item for item in forecasts if as_naive(item.forecast_time).normalize() >= today]
        target = sorted(future or forecasts, key=lambda item: item.forecast_time)[0]
    context = _context_from_forecast(target, forecasts, crop.name, stage.name if stage else "", body.soil_type)
    created = []
    for advice in generate_advisories(context, valid_on=pd.Timestamp(target.forecast_time).date()):
        row = Advisory(
            panchayat_id=place.id,
            crop_id=crop.id,
            crop_stage_id=stage.id if stage else None,
            forecast_date=target.forecast_time,
            advisory_type=advice["advisory_type"],
            title=advice["title"],
            message=advice["message"],
            reason=advice["reason"],
            action=advice["action"],
            severity=advice["severity"],
            confidence_score=advice["confidence_score"],
            soil_type=body.soil_type,
            disclaimer=advice["disclaimer"],
            status="draft",
            rule_id=advice["rule_id"],
            created_at=utcnow(),
        )
        db.add(row)
        db.flush()
        created.append(row)
    write_audit(db, user.id, "generate_advisory", "advisory", str(place.id), f"{len(created)} draft advisories")
    db.commit()
    return ok([_dict(row) for row in created], disclaimer=True)


@router.put("/{advisory_id}/review")
def review(advisory_id: int, body: ReviewIn, db: Session = Depends(get_db), user: User = Depends(require_roles("admin", "officer"))):
    row = db.get(Advisory, advisory_id)
    if row is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Advisory not found"))
    row.reviewed_by = user.id
    row.review_notes = body.notes
    row.status = "reviewed" if body.decision == "approve" else "rejected"
    write_audit(db, user.id, "review_advisory", "advisory", str(row.id), body.decision)
    db.commit()
    return ok(_dict(row), disclaimer=True)


@router.post("/{advisory_id}/publish")
def publish(advisory_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles("admin", "officer"))):
    row = db.get(Advisory, advisory_id)
    if row is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Advisory not found"))
    if row.status not in {"reviewed", "published"} and user.role != "admin":
        raise HTTPException(status_code=409, detail=error_body("not_reviewed", "Review the advisory before publishing"))
    row.status = "published"
    row.reviewed_by = row.reviewed_by or user.id
    write_audit(db, user.id, "publish_advisory", "advisory", str(row.id), row.title)
    db.commit()
    return ok(_dict(row), disclaimer=True)
