"""Pydantic schemas for the MausamSetu prototype API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Variable = Literal["rainfall_mm", "temperature_c", "humidity_pct", "wind_kmh"]
ModelName = Literal["contextual_baseline", "random_forest"]
PredictorName = Literal[
    "elevation",
    "location",
    "land_cover",
    "soil_moisture",
    "distance_water",
    "vegetation",
]


class DownscaleRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    state_id: str = Field(min_length=1)
    district_id: str = Field(min_length=1)
    block_id: str = Field(min_length=1)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    variable: Variable
    model: ModelName
    predictors: list[PredictorName] = Field(default_factory=list)

    @field_validator("predictors")
    @classmethod
    def unique_predictors(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("Predictors must be unique.")
        return value


class HealthResponse(BaseModel):
    status: str
    service: str
    mode: str
    problem: str
    team: str
    source: str
    is_simulated: bool


class SimulationMetadata(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    source: Literal["demo_simulation"]
    is_simulated: Literal[True]
    seed: int
    model_limitation: str
    reference_note: str
    resolution_before: str
    resolution_after: str
    statements: list[str]


class MetricBlock(BaseModel):
    mae: float
    rmse: float
    bias: float
    r2: float | None = None


class ValidationResponse(BaseModel):
    variable: str
    label: str
    unit: str
    baseline_metrics: MetricBlock
    downscaled_metrics: MetricBlock
    improvement_percent: float | None
    rows: list[dict[str, Any]]
    warning: str
    reference_note: str
    labels: dict[str, str]
    simulation_mode: bool
    source: str
    is_simulated: bool


class DownscaleResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    run_id: str
    status: str
    created_at: str
    model: str
    model_label: str
    geography: dict[str, Any]
    variable: str
    variable_label: str
    unit: str
    block_forecast: dict[str, Any]
    block_geometry: dict[str, Any]
    panchayat_forecasts: list[dict[str, Any]]
    uncertainty_summary: dict[str, Any]
    validation_metrics: ValidationResponse
    validations: dict[str, ValidationResponse]
    advisories: list[dict[str, Any]]
    feature_importance: dict[str, list[dict[str, Any]]]
    weights: dict[str, float]
    predictors: list[str]
    predictor_labels: dict[str, str]
    simulation_metadata: SimulationMetadata


class HistoryItem(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    run_id: str
    created_at: str
    state_name: str
    district_name: str
    block_name: str
    block_id: str
    variable: str
    model: str
    panchayat_count: int
    validation_status: str
    source: str
    is_simulated: bool


class HistoryResponse(BaseModel):
    runs: list[HistoryItem]
    source: str
    is_simulated: bool


class ClearHistoryResponse(BaseModel):
    deleted: int
    status: str
