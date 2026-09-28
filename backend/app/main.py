"""Panchayat weather downscaling API.

Downscaled responses are model-generated estimates. They are not official IMD forecasts.
"""

import logging
import time
from collections import defaultdict

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import advisories, auth, data_routes, forecasts, geography, model_routes, reports, system
from app.config import get_settings
from app.database import SessionLocal, get_engine, init_db
from app.services.pipeline import generate_and_store
from app.utils.responses import error_body

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("app")

settings = get_settings()
app = FastAPI(
    title="Panchayat Weather Downscaling and Agro-Advisory Platform",
    description=(
        "Downscales coarse block forecasts to panchayat estimates for agro-advisory decision support. "
        "Model output is not an official IMD forecast."
    ),
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_hits: dict[str, list[float]] = defaultdict(list)
_scheduler: BackgroundScheduler | None = None


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    """In-memory limit. Replace the counter with Redis when more than one API process is running."""
    if request.url.path in {"/health", "/docs", "/openapi.json"}:
        return await call_next(request)
    now = time.time()
    ip = request.client.host if request.client else "local"
    window = [stamp for stamp in _hits[ip] if now - stamp < 60]
    if len(window) >= settings.rate_limit_per_minute:
        return JSONResponse(status_code=429, content=error_body("rate_limited", "Too many requests"))
    window.append(now)
    _hits[ip] = window
    return await call_next(request)


@app.exception_handler(StarletteHTTPException)
async def http_error(_request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content=error_body("http_error", str(exc.detail)))


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content=error_body("validation_error", "Request validation failed"))


@app.exception_handler(Exception)
async def unhandled(_request: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content=error_body("internal_error", "The request could not be completed"))


@app.on_event("startup")
def startup():
    global _scheduler
    if settings.secret_key.startswith("dev-only") or settings.secret_key.startswith("change-me"):
        logger.warning("SECRET_KEY is a development placeholder. Set a private value before deployment.")
    init_db()
    if settings.auto_bootstrap:
        from scripts.bootstrap import bootstrap

        bootstrap()
    if settings.enable_scheduler:
        _scheduler = BackgroundScheduler()
        _scheduler.add_job(_refresh, "interval", hours=24, id="forecast_refresh", replace_existing=True)
        _scheduler.start()
        logger.info("APScheduler started for daily forecast refresh")


@app.on_event("shutdown")
def shutdown():
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)


def _refresh():
    db = SessionLocal()
    try:
        logger.info("Scheduled forecast refresh started")
        generate_and_store(db)
    finally:
        db.close()


@app.get("/health", tags=["System"])
def health():
    from sqlalchemy import text

    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "unavailable"})


app.include_router(auth.router, prefix="/api")
app.include_router(geography.router, prefix="/api")
app.include_router(forecasts.router, prefix="/api")
app.include_router(model_routes.router, prefix="/api")
app.include_router(advisories.router, prefix="/api")
app.include_router(data_routes.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(system.router, prefix="/api")
