"""CSV and GeoJSON validation for administrator uploads."""

from __future__ import annotations

import io
import json
from dataclasses import dataclass, field
from datetime import datetime

import pandas as pd

OBSERVATION_COLUMNS = [
    "panchayat_code",
    "observation_time",
    "rainfall_mm",
    "temperature_min_c",
    "temperature_max_c",
    "humidity_percent",
    "wind_speed_kmh",
    "wind_direction_deg",
    "cloud_cover_percent",
    "data_source",
]
BLOCK_FORECAST_COLUMNS = [
    "block_code",
    "issue_time",
    "forecast_time",
    "lead_time_hours",
    "rainfall_mm",
    "temperature_min_c",
    "temperature_max_c",
    "humidity_percent",
    "wind_speed_kmh",
    "wind_direction_deg",
    "cloud_cover_percent",
    "probability_of_rain",
    "source",
]
PANCHAYAT_COLUMNS = ["panchayat_code", "panchayat_name", "block_code", "latitude", "longitude"]

RANGES = {
    "humidity_percent": (0, 100),
    "cloud_cover_percent": (0, 100),
    "rainfall_mm": (0, 1000),
    "wind_speed_kmh": (0, 300),
    "wind_direction_deg": (0, 360),
    "probability_of_rain": (0, 1),
    "temperature_min_c": (-40, 55),
    "temperature_max_c": (-30, 60),
    "latitude": (-90, 90),
    "longitude": (-180, 180),
    "lead_time_hours": (0, 360),
}


@dataclass
class TabularValidation:
    rows: list[dict] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)

    @property
    def accepted(self) -> int:
        return len(self.rows)

    @property
    def rejected(self) -> int:
        return len({item["row"] for item in self.errors})


def validate_table(content: str, required: list[str], numeric: list[str] | None = None) -> TabularValidation:
    result = TabularValidation()
    try:
        frame = pd.read_csv(io.StringIO(content))
    except Exception as exc:
        result.errors.append({"row": 0, "column": "*", "message": f"CSV could not be parsed: {exc}"})
        return result
    missing = [column for column in required if column not in frame.columns]
    if missing:
        result.errors.append({"row": 0, "column": ",".join(missing), "message": "Required columns are missing"})
        return result
    numeric = numeric or []
    for index, record in frame.iterrows():
        row_number = int(index) + 2
        row_errors = []
        cleaned = {}
        for column in required:
            value = record[column]
            if pd.isna(value) or str(value).strip() == "":
                if column in ("panchayat_code", "block_code", "observation_time", "forecast_time", "issue_time", "panchayat_name"):
                    row_errors.append({"row": row_number, "column": column, "message": "Value is required"})
                cleaned[column] = None
                continue
            if column in ("observation_time", "forecast_time", "issue_time"):
                parsed = pd.to_datetime(value, errors="coerce", utc=True)
                if pd.isna(parsed):
                    row_errors.append({"row": row_number, "column": column, "message": "Date could not be parsed"})
                    cleaned[column] = None
                else:
                    cleaned[column] = parsed.to_pydatetime()
                continue
            if column in numeric or column in RANGES:
                number = pd.to_numeric(value, errors="coerce")
                if pd.isna(number):
                    row_errors.append({"row": row_number, "column": column, "message": "Expected a number"})
                    cleaned[column] = None
                    continue
                low, high = RANGES.get(column, (None, None))
                if low is not None and (float(number) < low or float(number) > high):
                    row_errors.append(
                        {"row": row_number, "column": column, "message": f"Value {number} is outside {low}–{high}"}
                    )
                cleaned[column] = float(number) if column != "lead_time_hours" else int(number)
                continue
            cleaned[column] = str(value).strip()
        if row_errors:
            result.errors.extend(row_errors)
            continue
        result.rows.append(cleaned)
    return result


def validate_geojson(content: bytes) -> tuple[dict | None, list[dict]]:
    try:
        payload = json.loads(content.decode("utf-8"))
    except Exception as exc:
        return None, [{"row": 0, "column": "*", "message": f"GeoJSON could not be parsed: {exc}"}]
    if payload.get("type") != "FeatureCollection" or not isinstance(payload.get("features"), list):
        return None, [{"row": 0, "column": "type", "message": "Expected a FeatureCollection"}]
    return payload, []


def preview_rows(rows: list[dict], limit: int = 15) -> list[dict]:
    preview = []
    for row in rows[:limit]:
        item = {}
        for key, value in row.items():
            item[key] = value.isoformat() if isinstance(value, datetime) else value
        preview.append(item)
    return preview
