from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.database import get_db
from app.models import ModelRun, Panchayat, User
from app.services.audit import write_audit
from app.services.pipeline import build_features, train_and_store
from app.ml.predict import predict_frame
from app.ml.train import load_bundle
from app.utils.responses import error_body, ok, parse_json

router = APIRouter(prefix="/models", tags=["Models"])


class PredictIn(BaseModel):
    panchayat_id: int


@router.post("/train")
def train(db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    try:
        result = train_and_store(db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=error_body("training_failed", str(exc)))
    write_audit(db, user.id, "train_model", "model_run", result["model_version"], str(result))
    db.commit()
    return ok(result, disclaimer=True)


@router.get("")
def list_models(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = db.query(ModelRun).order_by(ModelRun.created_at.desc()).all()
    return ok([_run_dict(row) for row in rows], disclaimer=True)


@router.get("/{model_id}")
def get_model(model_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    row = db.get(ModelRun, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Model run not found"))
    return ok(_run_dict(row), disclaimer=True)


@router.get("/{model_id}/metrics")
def model_metrics(model_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    row = db.get(ModelRun, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Model run not found"))
    payload = _run_dict(row)
    payload["detail"] = parse_json(row.metrics_json, {})
    return ok(payload, disclaimer=True)


@router.post("/{model_id}/predict")
def predict(model_id: int, body: PredictIn, db: Session = Depends(get_db), user: User = Depends(require_roles("admin", "officer"))):
    row = db.get(ModelRun, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Model run not found"))
    place = db.get(Panchayat, body.panchayat_id)
    if place is None:
        raise HTTPException(status_code=404, detail=error_body("not_found", "Panchayat not found"))
    bundle = load_bundle()
    if bundle is None or bundle.get("model_version") != row.model_version:
        raise HTTPException(status_code=409, detail=error_body("model_mismatch", "The saved model file does not match this run"))
    frame, _log = build_features(db)
    subset = frame[frame["panchayat_id"] == place.id].sort_values("day").tail(5)
    predicted, _notes = predict_frame(subset, bundle)
    write_audit(db, user.id, "predict", "model_run", str(model_id), f"panchayat {place.code}")
    db.commit()
    return ok(predicted.to_dict(orient="records"), source={"label": predicted.iloc[0]["data_source_label"] if len(predicted) else "", "official_forecast": False}, disclaimer=True)


def _run_dict(row: ModelRun) -> dict:
    metrics = parse_json(row.metrics_json, {})
    return {
        "id": row.id,
        "model_name": row.model_name,
        "model_version": row.model_version,
        "variable": row.variable,
        "training_start_date": _iso(row.training_start_date),
        "training_end_date": _iso(row.training_end_date),
        "validation_start_date": _iso(row.validation_start_date),
        "validation_end_date": _iso(row.validation_end_date),
        "mae": row.mae,
        "rmse": row.rmse,
        "r2": row.r2,
        "bias": metrics.get("bias"),
        "correlation": metrics.get("correlation"),
        "baseline_mae": row.baseline_mae,
        "baseline_rmse": row.baseline_rmse,
        "improvement_percent": row.improvement_percent,
        "crps": metrics.get("crps"),
        "interval_coverage": metrics.get("interval_coverage"),
        "average_interval_width": metrics.get("average_interval_width"),
        "rain_classification": metrics.get("rain_classification"),
        "extreme_rain": metrics.get("extreme_rain"),
        "by_horizon": metrics.get("by_horizon"),
        "by_season": metrics.get("by_season"),
        "by_panchayat": metrics.get("by_panchayat"),
        "statement": row.statement,
        "status": row.status,
        "created_at": _iso(row.created_at),
        "official_forecast": False,
    }


def _iso(value):
    return value.isoformat() if value else None
