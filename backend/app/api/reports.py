import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.api.serialize import panchayat_forecast_dict
from app.database import get_db
from app.geospatial.geometry import loads_geometry
from app.models import Advisory, ModelRun, Panchayat, PanchayatForecast, User
from app.services.reports import advisory_pdf, forecasts_csv, model_report_pdf, panchayat_forecast_pdf
from app.utils.responses import error_body, parse_json

router = APIRouter(tags=["Reports"])


@router.get("/reports/panchayat/{panchayat_id}/pdf")
def panchayat_pdf(panchayat_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    place = db.get(Panchayat, panchayat_id)
    if place is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Panchayat not found"))
    rows = (
        db.query(PanchayatForecast)
        .filter(PanchayatForecast.panchayat_id == place.id)
        .order_by(PanchayatForecast.forecast_time)
        .all()
    )
    payload = panchayat_forecast_pdf(
        {"name": place.name, "code": place.code, "block_id": place.block_id},
        [panchayat_forecast_dict(row, place.code) for row in rows],
    )
    return _pdf(payload, f"{place.code}-forecast.pdf")


@router.get("/reports/model/{model_id}/pdf")
def model_pdf(model_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "officer"))):
    row = db.get(ModelRun, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Model run not found"))
    data = {
        "model_version": row.model_version,
        "variable": row.variable,
        "statement": row.statement,
        "mae": row.mae,
        "rmse": row.rmse,
        "r2": row.r2,
        "baseline_rmse": row.baseline_rmse,
        "improvement_percent": row.improvement_percent,
        "metrics_json": row.metrics_json,
    }
    return _pdf(model_report_pdf(data), f"model-{row.variable}.pdf")


@router.get("/reports/advisory/{advisory_id}/pdf")
def advisory_report(advisory_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.get(Advisory, advisory_id)
    if row is None or (user.role == "farmer" and row.status != "published"):
        raise HTTPException(status_code=404, detail=error_body("not_found", "Advisory not found"))
    place = db.get(Panchayat, row.panchayat_id)
    payload = {
        "title": row.title,
        "severity": row.severity,
        "status": row.status,
        "reason": row.reason,
        "action": row.action,
        "message": row.message,
        "disclaimer": row.disclaimer,
    }
    return _pdf(advisory_pdf(payload, place.name if place else ""), f"advisory-{row.id}.pdf")


@router.get("/export/forecasts.csv")
def export_csv(
    panchayat_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(PanchayatForecast, Panchayat).join(Panchayat, Panchayat.id == PanchayatForecast.panchayat_id)
    if panchayat_id is not None:
        query = query.filter(PanchayatForecast.panchayat_id == panchayat_id)
    elif user.role == "farmer" and user.district:
        # Farmers without an explicit panchayat still receive the demo set; district is informational.
        pass
    rows = []
    for forecast, place in query.order_by(PanchayatForecast.forecast_time).all():
        item = panchayat_forecast_dict(forecast, place.code)
        item["panchayat_code"] = place.code
        rows.append(item)
    return Response(
        content=forecasts_csv(rows),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=panchayat-forecasts.csv"},
    )


@router.get("/export/forecasts.geojson")
def export_geojson(
    panchayat_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Panchayat)
    if panchayat_id is not None:
        query = query.filter(Panchayat.id == panchayat_id)
    features = []
    for place in query.all():
        forecast = (
            db.query(PanchayatForecast)
            .filter(PanchayatForecast.panchayat_id == place.id)
            .order_by(PanchayatForecast.forecast_time.desc())
            .first()
        )
        geometry = loads_geometry(place.geometry)
        if geometry is None:
            continue
        properties = {"id": place.id, "name": place.name, "code": place.code}
        if forecast:
            properties.update(
                {
                    "forecast_time": forecast.forecast_time.isoformat(),
                    "rainfall_mm": forecast.rainfall_mm,
                    "temperature_max_c": forecast.temperature_max_c,
                    "confidence_score": forecast.confidence_score,
                    "model_version": forecast.model_version,
                    "data_source_label": forecast.data_source_label,
                    "generated_at": forecast.generated_at.isoformat() if forecast.generated_at else None,
                    "official_forecast": False,
                }
            )
        features.append({"type": "Feature", "geometry": geometry, "properties": properties})
    return Response(
        content=json.dumps({"type": "FeatureCollection", "features": features}),
        media_type="application/geo+json",
        headers={"Content-Disposition": "attachment; filename=panchayat-forecasts.geojson"},
    )


def _pdf(payload: bytes, filename: str) -> Response:
    return Response(
        content=payload,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
