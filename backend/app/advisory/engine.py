"""Transparent rule advisory engine.

Rules live in rules.yaml. A later model or language-model engine can implement
the same `generate_advisories` contract without changing the API.
"""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

import yaml

from app.constants import ADVISORY_DISCLAIMER

RULE_PATH = Path(__file__).with_name("rules.yaml")
OPS = {
    "gte": lambda left, right: left >= right,
    "gt": lambda left, right: left > right,
    "lte": lambda left, right: left <= right,
    "lt": lambda left, right: left < right,
    "eq": lambda left, right: left == right,
}


def load_rules(path: Path | None = None) -> dict:
    source = path or RULE_PATH
    return yaml.safe_load(source.read_text(encoding="utf-8"))


def generate_advisories(context: dict, ruleset: dict | None = None, valid_on: date | None = None) -> list[dict]:
    ruleset = ruleset or load_rules()
    valid = valid_on or _as_date(context.get("forecast_date")) or date.today()
    disclaimer = ruleset.get("disclaimer") or ADVISORY_DISCLAIMER
    produced = []
    for rule in ruleset.get("rules", []):
        if not _matches_scope(rule, context):
            continue
        if not _matches_conditions(rule.get("conditions", []), context):
            continue
        reason = _format(rule.get("reason", ""), context)
        action = _format(rule.get("action", ""), context)
        confidence = _float(context.get("confidence_score"))
        message = f"{reason} Recommended action: {action} Valid for {valid.isoformat()}."
        if confidence is not None and confidence < 0.5 and rule.get("id") != "low_confidence":
            message += " Verify locally before taking high-cost action."
        produced.append(
            {
                "advisory_type": rule["advisory_type"],
                "title": rule["title"],
                "message": message,
                "reason": reason,
                "action": action,
                "severity": rule["severity"],
                "confidence_score": confidence,
                "disclaimer": disclaimer,
                "rule_id": rule["id"],
                "valid_on": valid.isoformat(),
                "status": "draft",
            }
        )
    if not produced:
        produced.append(
            {
                "advisory_type": "general",
                "title": "No specific weather hazard flagged",
                "message": (
                    f"No rule matched this crop stage and forecast for {valid.isoformat()}. "
                    "Continue regular crop monitoring. Recommended action: recheck the forecast tomorrow."
                ),
                "reason": "No configured hazard threshold was crossed.",
                "action": "Continue regular monitoring and recheck the forecast tomorrow.",
                "severity": "normal",
                "confidence_score": _float(context.get("confidence_score")),
                "disclaimer": disclaimer,
                "rule_id": "none",
                "valid_on": valid.isoformat(),
                "status": "draft",
            }
        )
    return produced


def _matches_scope(rule: dict, context: dict) -> bool:
    crop = str(context.get("crop_name") or "").strip().lower()
    stage = str(context.get("stage_name") or "").strip().lower()
    soil = str(context.get("soil_type") or "").strip().lower()
    if rule.get("crops") and crop not in {item.lower() for item in rule["crops"]}:
        return False
    if rule.get("stages") and stage not in {item.lower() for item in rule["stages"]}:
        return False
    if rule.get("soils") and soil not in {item.lower() for item in rule["soils"]}:
        return False
    return True


def _matches_conditions(conditions: list[dict], context: dict) -> bool:
    for condition in conditions:
        value = context.get(condition["field"])
        if value is None:
            return False
        op = OPS[condition["op"]]
        if not op(float(value), float(condition["value"])):
            return False
    return True


class _Safe(dict):
    def __missing__(self, key):
        return 0


def _format(template: str, context: dict) -> str:
    safe = _Safe({key: _number(value) for key, value in context.items()})
    try:
        return template.format_map(safe)
    except (ValueError, KeyError):
        return template


def _number(value):
    if isinstance(value, float):
        return value
    try:
        return float(value)
    except (TypeError, ValueError):
        return value


def _float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _as_date(value) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None
