"""SQLAlchemy models for geography, weather, models, crops, and audit."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), index=True)
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class State(Base):
    __tablename__ = "states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    geometry: Mapped[str | None] = mapped_column(Text, nullable=True)
    districts: Mapped[list["District"]] = relationship(back_populates="state")


class District(Base):
    __tablename__ = "districts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    state_id: Mapped[int] = mapped_column(ForeignKey("states.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    geometry: Mapped[str | None] = mapped_column(Text, nullable=True)
    state: Mapped[State] = relationship(back_populates="districts")
    blocks: Mapped[list["Block"]] = relationship(back_populates="district")


class Block(Base):
    __tablename__ = "blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    district_id: Mapped[int] = mapped_column(ForeignKey("districts.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    geometry: Mapped[str | None] = mapped_column(Text, nullable=True)
    district: Mapped[District] = relationship(back_populates="blocks")
    panchayats: Mapped[list["Panchayat"]] = relationship(back_populates="block")


class Panchayat(Base):
    __tablename__ = "panchayats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    block_id: Mapped[int] = mapped_column(ForeignKey("blocks.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    area_sq_km: Mapped[float] = mapped_column(Float, default=0)
    elevation_mean: Mapped[float] = mapped_column(Float, default=0)
    slope_mean: Mapped[float] = mapped_column(Float, default=0)
    aspect_mean: Mapped[float] = mapped_column(Float, default=0)
    land_cover_type: Mapped[str] = mapped_column(String(64), default="unknown")
    distance_to_water_km: Mapped[float] = mapped_column(Float, default=0)
    geometry: Mapped[str | None] = mapped_column(Text, nullable=True)
    block: Mapped[Block] = relationship(back_populates="panchayats")


class WeatherObservation(Base):
    __tablename__ = "weather_observations"
    __table_args__ = (UniqueConstraint("panchayat_id", "observation_time", name="uq_obs_place_time"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    panchayat_id: Mapped[int] = mapped_column(ForeignKey("panchayats.id"), index=True)
    observation_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    rainfall_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    temperature_min_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    temperature_max_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_speed_kmh: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_direction_deg: Mapped[float | None] = mapped_column(Float, nullable=True)
    cloud_cover_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    data_source: Mapped[str] = mapped_column(String(120), default="demo")
    quality_flag: Mapped[str] = mapped_column(String(32), default="ok")


class BlockForecast(Base):
    __tablename__ = "block_forecasts"
    __table_args__ = (
        UniqueConstraint("block_id", "forecast_time", "lead_time_hours", name="uq_block_fc"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    block_id: Mapped[int] = mapped_column(ForeignKey("blocks.id"), index=True)
    forecast_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    issue_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    lead_time_hours: Mapped[int] = mapped_column(Integer)
    rainfall_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    temperature_min_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    temperature_max_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_speed_kmh: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_direction_deg: Mapped[float | None] = mapped_column(Float, nullable=True)
    cloud_cover_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    probability_of_rain: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(120), default="demo_block_forecast")
    quality_flag: Mapped[str] = mapped_column(String(32), default="ok")


class PanchayatForecast(Base):
    __tablename__ = "panchayat_forecasts"
    __table_args__ = (
        UniqueConstraint("panchayat_id", "forecast_time", "model_version", name="uq_panchayat_fc"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    panchayat_id: Mapped[int] = mapped_column(ForeignKey("panchayats.id"), index=True)
    block_forecast_id: Mapped[int | None] = mapped_column(ForeignKey("block_forecasts.id"), nullable=True)
    forecast_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    model_version: Mapped[str] = mapped_column(String(80))
    rainfall_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    temperature_min_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    temperature_max_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_speed_kmh: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_direction_deg: Mapped[float | None] = mapped_column(Float, nullable=True)
    cloud_cover_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    probability_of_rain: Mapped[float | None] = mapped_column(Float, nullable=True)
    lower_bound: Mapped[float | None] = mapped_column(Float, nullable=True)
    upper_bound: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    intervals_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_source_label: Mapped[str] = mapped_column(String(255))
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class EnvironmentalFeature(Base):
    __tablename__ = "environmental_features"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    panchayat_id: Mapped[int] = mapped_column(ForeignKey("panchayats.id"), unique=True, index=True)
    elevation_m: Mapped[float] = mapped_column(Float)
    slope_degree: Mapped[float] = mapped_column(Float)
    aspect_degree: Mapped[float] = mapped_column(Float)
    land_cover: Mapped[str] = mapped_column(String(64))
    distance_to_water_km: Mapped[float] = mapped_column(Float)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    normalized_x: Mapped[float] = mapped_column(Float, default=0)
    normalized_y: Mapped[float] = mapped_column(Float, default=0)


class ModelRun(Base):
    __tablename__ = "model_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_name: Mapped[str] = mapped_column(String(80))
    model_version: Mapped[str] = mapped_column(String(80), index=True)
    variable: Mapped[str] = mapped_column(String(64), index=True)
    training_start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    training_end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    validation_start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    validation_end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    mae: Mapped[float | None] = mapped_column(Float, nullable=True)
    rmse: Mapped[float | None] = mapped_column(Float, nullable=True)
    r2: Mapped[float | None] = mapped_column(Float, nullable=True)
    baseline_mae: Mapped[float | None] = mapped_column(Float, nullable=True)
    baseline_rmse: Mapped[float | None] = mapped_column(Float, nullable=True)
    improvement_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="completed")
    statement: Mapped[str | None] = mapped_column(Text, nullable=True)
    metrics_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Crop(Base):
    __tablename__ = "crops"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    scientific_name: Mapped[str] = mapped_column(String(160))
    season: Mapped[str] = mapped_column(String(40))
    typical_duration_days: Mapped[int] = mapped_column(Integer)
    stages: Mapped[list["CropStage"]] = relationship(back_populates="crop")


class CropStage(Base):
    __tablename__ = "crop_stages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    crop_id: Mapped[int] = mapped_column(ForeignKey("crops.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    start_day: Mapped[int] = mapped_column(Integer)
    end_day: Mapped[int] = mapped_column(Integer)
    crop: Mapped[Crop] = relationship(back_populates="stages")


class Advisory(Base):
    __tablename__ = "advisories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    panchayat_id: Mapped[int] = mapped_column(ForeignKey("panchayats.id"), index=True)
    crop_id: Mapped[int] = mapped_column(ForeignKey("crops.id"), index=True)
    crop_stage_id: Mapped[int | None] = mapped_column(ForeignKey("crop_stages.id"), nullable=True)
    forecast_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    advisory_type: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text, default="")
    action: Mapped[str] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(32))
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    soil_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    disclaimer: Mapped[str] = mapped_column(Text)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    rule_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DataJob(Base):
    __tablename__ = "data_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_type: Mapped[str] = mapped_column(String(80), index=True)
    status: Mapped[str] = mapped_column(String(32), default="completed")
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    errors_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    preview_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
