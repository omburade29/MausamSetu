"""PDF and tabular exports. Every report repeats the non-official-forecast disclaimer."""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table

from app.constants import DISCLAIMER
from app.utils.responses import parse_json


def panchayat_forecast_pdf(panchayat: dict, forecasts: list[dict]) -> bytes:
    return _pdf(
        f"Panchayat weather estimate — {panchayat['name']}",
        [
            f"Code: {panchayat['code']}",
            f"Block id: {panchayat['block_id']}",
            "These panchayat values are model-generated estimates, not official IMD forecasts.",
            DISCLAIMER,
        ],
        [
            ["Date", "Rain mm", "Tmin", "Tmax", "Humidity", "Wind", "Confidence", "Model"],
            *[
                [
                    _day(item.get("forecast_time")),
                    _fmt(item.get("rainfall_mm")),
                    _fmt(item.get("temperature_min_c")),
                    _fmt(item.get("temperature_max_c")),
                    _fmt(item.get("humidity_percent")),
                    _fmt(item.get("wind_speed_kmh")),
                    _fmt(item.get("confidence_score")),
                    str(item.get("model_version") or ""),
                ]
                for item in forecasts
            ],
        ],
    )


def model_report_pdf(run: dict) -> bytes:
    metrics = parse_json(run.get("metrics_json"), {})
    lines = [
        f"Model {run.get('model_version')} · {run.get('variable')}",
        run.get("statement") or "",
        DISCLAIMER,
        f"MAE { _fmt(run.get('mae')) }  RMSE { _fmt(run.get('rmse')) }  R² { _fmt(run.get('r2')) }",
        f"Baseline RMSE { _fmt(run.get('baseline_rmse')) }  Improvement { _fmt(run.get('improvement_percent')) }%",
        f"Bias { _fmt(metrics.get('bias')) }  Correlation { _fmt(metrics.get('correlation')) }",
        f"Interval coverage { _fmt(metrics.get('interval_coverage')) }  CRPS { _fmt(metrics.get('crps')) }",
    ]
    return _pdf(f"Model performance — {run.get('variable')}", lines, [])


def advisory_pdf(advisory: dict, panchayat_name: str) -> bytes:
    return _pdf(
        f"Advisory — {advisory.get('title')}",
        [
            f"Panchayat: {panchayat_name}",
            f"Severity: {advisory.get('severity')}",
            f"Status: {advisory.get('status')}",
            f"Reason: {advisory.get('reason')}",
            f"Action: {advisory.get('action')}",
            advisory.get("message") or "",
            advisory.get("disclaimer") or DISCLAIMER,
        ],
        [],
    )


def forecasts_csv(rows: list[dict]) -> str:
    fieldnames = [
        "panchayat_code",
        "forecast_time",
        "rainfall_mm",
        "temperature_min_c",
        "temperature_max_c",
        "humidity_percent",
        "wind_speed_kmh",
        "wind_direction_deg",
        "cloud_cover_percent",
        "probability_of_rain",
        "lower_bound",
        "upper_bound",
        "confidence_score",
        "model_version",
        "data_source_label",
        "generated_at",
    ]
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue()


def forecasts_geojson(features: list[dict]) -> dict:
    return {"type": "FeatureCollection", "features": features}


def _pdf(title: str, paragraphs: list[str], table_rows: list[list[str]]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=title)
    styles = getSampleStyleSheet()
    story = [Paragraph(title, styles["Title"]), Spacer(1, 12)]
    story.append(Paragraph(f"Generated at {datetime.now(timezone.utc).isoformat()}", styles["Normal"]))
    story.append(Spacer(1, 8))
    for text in paragraphs:
        story.append(Paragraph(str(text).replace("\n", "<br/>"), styles["Normal"]))
        story.append(Spacer(1, 6))
    if table_rows:
        story.append(Spacer(1, 8))
        story.append(Table(table_rows, repeatRows=1))
    doc.build(story)
    return buffer.getvalue()


def _fmt(value) -> str:
    if value is None:
        return ""
    try:
        return f"{float(value):.2f}"
    except (TypeError, ValueError):
        return str(value)


def _day(value) -> str:
    if value is None:
        return ""
    text = str(value)
    return text[:10]
