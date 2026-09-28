from app.advisory import DISCLAIMER, build_advisories
from app.engine import active_weights, apply_adjustment, reference_field, run_models, uncertainty_category
from app.loader import load_bundle
from app.metrics import regression_metrics


def test_metrics_match_hand_calculation():
    metrics = regression_metrics([10, 20, 30], [12, 18, 33])
    assert metrics["mae"] == 2.333
    assert metrics["bias"] == -1.0
    assert metrics["r2"] is not None


def test_weights_sum_to_one_with_vegetation():
    weights = active_weights(
        ["elevation", "location", "land_cover", "soil_moisture", "distance_water", "vegetation"]
    )
    assert round(sum(weights.values()), 6) == 1
    assert weights["vegetation"] == 0.1
    assert abs(weights["elevation"] - 0.27) < 1e-9


def test_adjustment_stays_inside_domain():
    value, factor = apply_adjustment(42, 5, "rainfall_mm")
    assert 0 <= value <= 250
    assert factor <= 0.42


def test_uncertainty_categories():
    assert uncertainty_category(0.2) == "Low uncertainty"
    assert uncertainty_category(0.4) == "Moderate uncertainty"
    assert uncertainty_category(0.66) == "High uncertainty"


def _demo_inputs():
    bundle = load_bundle()
    forecast = next(row for row in bundle["forecasts"] if row["date"] == "2026-09-28")
    block = next(
        block
        for state in bundle["regions"]["states"]
        for district in state["districts"]
        for block in district["blocks"]
    )
    origin = (
        block["representative_point"]["latitude"],
        block["representative_point"]["longitude"],
    )
    references = {
        item["id"]: bundle["references"][(item["id"], "2026-09-28")] for item in bundle["panchayats"]
    }
    values = {
        "rainfall_mm": float(forecast["rainfall_mm"]),
        "temperature_c": float(forecast["temperature_c"]),
        "humidity_pct": float(forecast["humidity_pct"]),
        "wind_kmh": float(forecast["wind_kmh"]),
    }
    selected = [
        "elevation",
        "location",
        "land_cover",
        "soil_moisture",
        "distance_water",
        "vegetation",
    ]
    return bundle, origin, references, values, selected


def test_contextual_values_differ_and_are_deterministic():
    bundle, origin, references, values, selected = _demo_inputs()
    first = run_models(bundle["panchayats"], values, origin, references, "contextual_baseline", selected)
    second = run_models(bundle["panchayats"], values, origin, references, "contextual_baseline", selected)
    rains = [row["forecasts"]["rainfall_mm"] for row in first["panchayats"]]
    assert len(set(rains)) > 1
    assert rains == [row["forecasts"]["rainfall_mm"] for row in second["panchayats"]]
    assert all(row["is_simulated"] for row in first["panchayats"])
    categories = {row["uncertainty_by_variable"]["rainfall_mm"]["category"] for row in first["panchayats"]}
    assert "Low uncertainty" in categories
    assert "High uncertainty" in categories


def test_random_forest_is_deterministic_and_bounded():
    bundle, origin, references, values, selected = _demo_inputs()
    first = run_models(bundle["panchayats"], values, origin, references, "random_forest", selected)
    second = run_models(bundle["panchayats"], values, origin, references, "random_forest", selected)
    assert [row["forecasts"] for row in first["panchayats"]] == [
        row["forecasts"] for row in second["panchayats"]
    ]
    assert len(first["feature_importance"]["rainfall_mm"]) == 6
    for row in first["panchayats"]:
        assert 0 <= row["forecasts"]["rainfall_mm"] <= 250


def test_frozen_references_match_documented_generator():
    bundle = load_bundle()
    forecast = next(row for row in bundle["forecasts"] if row["date"] == "2026-09-28")
    block_values = {
        "rainfall_mm": float(forecast["rainfall_mm"]),
        "temperature_c": float(forecast["temperature_c"]),
        "humidity_pct": float(forecast["humidity_pct"]),
        "wind_kmh": float(forecast["wind_kmh"]),
    }
    expected = reference_field(block_values, bundle["panchayats"])
    sample = bundle["panchayats"][0]
    stored = bundle["references"][(sample["id"], "2026-09-28")]
    assert stored == expected[sample["id"]]


def test_advisory_contains_required_disclaimer_and_actions():
    panchayat = {
        "panchayat_id": "pan-test",
        "name": "Testpur",
        "forecasts": {
            "rainfall_mm": 66.0,
            "temperature_c": 36.0,
            "humidity_pct": 90,
            "wind_kmh": 30.0,
        },
        "uncertainty_by_variable": {
            "rainfall_mm": {"category": "High uncertainty", "confidence": 42}
        },
    }
    cards = build_advisories([panchayat], "2026-09-29", "rainfall_mm")
    blob = " ".join(card["recommended_farm_action"] for card in cards)
    assert "Avoid irrigation." in blob
    assert "Delay fertilizer application." in blob
    assert "Check drainage." in blob
    assert "Protect harvested produce." in blob
    assert "Irrigate during cooler hours." in blob
    assert "Secure temporary structures." in blob
    assert "Verify with local observations." in blob
    assert all(card["disclaimer"] == DISCLAIMER for card in cards)
    assert panchayat["advisory_priority"] == "High"
