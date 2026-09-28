"""Freeze the independent simulated reference field into data/reference_values.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.engine import reference_field, run_models  # noqa: E402
from app.loader import DATA_DIR, clear_cache, load_bundle  # noqa: E402
from app.metrics import validation_table  # noqa: E402


def main() -> None:
    bundle = load_bundle()
    rows = []
    dates = sorted({row["date"] for row in bundle["forecasts"]})
    for date in dates:
        forecast = next(row for row in bundle["forecasts"] if row["date"] == date)
        block_values = {
            "rainfall_mm": float(forecast["rainfall_mm"]),
            "temperature_c": float(forecast["temperature_c"]),
            "humidity_pct": float(forecast["humidity_pct"]),
            "wind_kmh": float(forecast["wind_kmh"]),
        }
        for panchayat in bundle["panchayats"]:
            reference = reference_field(block_values, bundle["panchayats"])[panchayat["id"]]
            rows.append(
                {
                    "panchayat_id": panchayat["id"],
                    "name": panchayat["name"],
                    "date": date,
                    **reference,
                    "source": "demo_simulation",
                    "is_simulated": True,
                }
            )
    payload = {
        "source": "demo_simulation",
        "is_simulated": True,
        "method": "independent_synthetic_reference_field",
        "description": (
            "Simulated fine-scale reference values for the demonstration. "
            "A creek-distance and elevation field is calculated independently of the "
            "contextual weights, then recentered so each variable's Panchayat mean "
            "matches that day's block forecast. They are not raingauge, AWS, or satellite observations."
        ),
        "references": rows,
    }
    path = DATA_DIR / "reference_values.json"
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    clear_cache()
    bundle = load_bundle()
    block = next(
        block
        for state in bundle["regions"]["states"]
        for district in state["districts"]
        for block in district["blocks"]
    )
    origin = (
        float(block["representative_point"]["latitude"]),
        float(block["representative_point"]["longitude"]),
    )
    forecast = next(row for row in bundle["forecasts"] if row["date"] == "2026-09-28")
    references = {
        item["id"]: bundle["references"][(item["id"], "2026-09-28")] for item in bundle["panchayats"]
    }
    selected = [
        "elevation",
        "location",
        "land_cover",
        "soil_moisture",
        "distance_water",
        "vegetation",
    ]
    modeled = run_models(
        bundle["panchayats"],
        {
            "rainfall_mm": float(forecast["rainfall_mm"]),
            "temperature_c": float(forecast["temperature_c"]),
            "humidity_pct": float(forecast["humidity_pct"]),
            "wind_kmh": float(forecast["wind_kmh"]),
        },
        origin,
        references,
        "contextual_baseline",
        selected,
    )
    print(f"Wrote {len(rows)} reference rows to {path}")
    for variable in ("rainfall_mm", "temperature_c", "humidity_pct", "wind_kmh"):
        table = validation_table(modeled["panchayats"], variable)
        print(
            variable,
            "MAE base",
            table["baseline_metrics"]["mae"],
            "down",
            table["downscaled_metrics"]["mae"],
            "improvement",
            table["improvement_percent"],
        )
        for row in modeled["panchayats"]:
            print(
                " ",
                row["name"],
                row["forecasts"][variable],
                "ref",
                row["reference"][variable],
                row["uncertainty_by_variable"][variable]["category"],
            )


if __name__ == "__main__":
    main()
