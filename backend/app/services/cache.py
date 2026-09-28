"""Optional Redis cache with an in-process fallback."""

import json
from typing import Any

from app.config import get_settings

_memory: dict[str, str] = {}
_redis = None
_redis_checked = False


def _client():
    global _redis, _redis_checked
    if _redis_checked:
        return _redis
    _redis_checked = True
    try:
        import redis

        client = redis.Redis.from_url(get_settings().redis_url, socket_connect_timeout=0.3)
        client.ping()
        _redis = client
    except Exception:
        _redis = None
    return _redis


def cache_get(key: str) -> Any | None:
    client = _client()
    if client is not None:
        try:
            raw = client.get(key)
            if raw:
                return json.loads(raw)
        except Exception:
            return None
    raw_mem = _memory.get(key)
    return json.loads(raw_mem) if raw_mem else None


def cache_set(key: str, value: Any, ttl_seconds: int = 60) -> None:
    payload = json.dumps(value)
    client = _client()
    if client is not None:
        try:
            client.setex(key, ttl_seconds, payload)
            return
        except Exception:
            pass
    _memory[key] = payload
    if len(_memory) > 128:
        _memory.pop(next(iter(_memory)))


def redis_status() -> str:
    return "ok" if _client() is not None else "unavailable"
