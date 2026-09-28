import json
import logging
from typing import Any

from app.constants import DISCLAIMER

logger = logging.getLogger("app.ml")


def ok(data: Any, meta: dict | None = None, source: dict | None = None, disclaimer: bool = False) -> dict:
    body: dict[str, Any] = {"data": data}
    if meta is not None:
        body["meta"] = meta
    if source is not None:
        body["source"] = source
    if disclaimer:
        body["disclaimer"] = DISCLAIMER
    return body


def error_body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def parse_json(text: str | None, fallback: Any) -> Any:
    if not text:
        return fallback
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Could not parse stored JSON")
        return fallback
