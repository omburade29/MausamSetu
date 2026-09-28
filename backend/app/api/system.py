from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.database import get_db, get_engine
from app.models import AuditLog, ModelRun, PanchayatForecast, User
from app.services.cache import redis_status
from app.utils.responses import ok

router = APIRouter(tags=["System"])


@router.get("/system/status")
def status(db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "officer"))):
    database = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        database = "unavailable"
    latest = db.query(ModelRun).order_by(ModelRun.created_at.desc()).first()
    audits = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(8).all()
    return ok(
        {
            "database": database,
            "dialect": get_engine().dialect.name,
            "postgis": get_engine().dialect.name == "postgresql",
            "redis": redis_status(),
            "scheduler": "enabled" if __import__("app.config", fromlist=["get_settings"]).get_settings().enable_scheduler else "disabled",
            "forecast_rows": db.query(PanchayatForecast).count(),
            "latest_model_version": None if latest is None else latest.model_version,
            "latest_model_at": None if latest is None or latest.created_at is None else latest.created_at.isoformat(),
            "recent_audit": [
                {
                    "id": row.id,
                    "action": row.action,
                    "entity": row.entity,
                    "detail": row.detail,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
                for row in audits
            ],
        }
    )
