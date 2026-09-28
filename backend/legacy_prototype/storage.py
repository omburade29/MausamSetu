"""SQLite persistence for downscaling runs."""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "app_data" / "history.db"


def db_path() -> Path:
    return Path(os.environ.get("MAUSAM_DB", DEFAULT_DB))


def connect() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS runs (
            run_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            state_name TEXT NOT NULL,
            district_name TEXT NOT NULL,
            block_name TEXT NOT NULL,
            block_id TEXT NOT NULL,
            variable TEXT NOT NULL,
            model TEXT NOT NULL,
            panchayat_count INTEGER NOT NULL,
            validation_status TEXT NOT NULL,
            payload TEXT NOT NULL
        )
        """
    )
    return connection


def save_run(payload: dict[str, Any]) -> None:
    geography = payload["geography"]
    metrics = payload["validation_metrics"]
    improvement = metrics.get("improvement_percent")
    if improvement is None:
        status = "Reference unavailable"
    elif improvement > 0:
        status = "Lower error than baseline on this sample"
    elif improvement < 0:
        status = "Higher error than baseline on this sample"
    else:
        status = "Same error as baseline on this sample"
    with connect() as connection:
        connection.execute(
            """
            INSERT INTO runs (
                run_id, created_at, state_name, district_name, block_name, block_id,
                variable, model, panchayat_count, validation_status, payload
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload["run_id"],
                payload["created_at"],
                geography["state_name"],
                geography["district_name"],
                geography["block_name"],
                geography["block_id"],
                payload["variable"],
                payload["model"],
                len(payload["panchayat_forecasts"]),
                status,
                json.dumps(payload),
            ),
        )


def list_runs() -> list[dict[str, Any]]:
    with connect() as connection:
        rows = connection.execute(
            "SELECT * FROM runs ORDER BY created_at DESC, run_id DESC"
        ).fetchall()
    return [
        {
            "run_id": row["run_id"],
            "created_at": row["created_at"],
            "state_name": row["state_name"],
            "district_name": row["district_name"],
            "block_name": row["block_name"],
            "block_id": row["block_id"],
            "variable": row["variable"],
            "model": row["model"],
            "panchayat_count": row["panchayat_count"],
            "validation_status": row["validation_status"],
            "source": "demo_simulation",
            "is_simulated": True,
        }
        for row in rows
    ]


def get_run(run_id: str) -> dict[str, Any] | None:
    with connect() as connection:
        row = connection.execute("SELECT payload FROM runs WHERE run_id = ?", (run_id,)).fetchone()
    if row is None:
        return None
    return json.loads(row["payload"])


def clear_runs() -> int:
    with connect() as connection:
        count = connection.execute("SELECT COUNT(*) AS n FROM runs").fetchone()["n"]
        connection.execute("DELETE FROM runs")
    return int(count)
