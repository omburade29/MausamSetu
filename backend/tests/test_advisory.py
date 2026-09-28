from app.advisory.engine import generate_advisories


def _context(**overrides):
    base = {
        "rainfall_mm": 2,
        "probability_of_rain": 0.2,
        "temperature_max_c": 31,
        "temperature_min_c": 20,
        "humidity_percent": 60,
        "humidity_high_days": 0,
        "wind_speed_kmh": 10,
        "confidence_score": 0.8,
        "crop_name": "Rice",
        "stage_name": "Tillering",
        "soil_type": "loam",
        "month": 9,
    }
    base.update(overrides)
    return base


def test_heavy_rain_rule_is_severe_and_explains_why():
    advisories = generate_advisories(_context(rainfall_mm=60, probability_of_rain=0.8))
    heavy = next(item for item in advisories if item["rule_id"] == "heavy_rain_preparation")
    assert heavy["severity"] == "severe"
    assert "60.0 mm" in heavy["reason"]
    assert heavy["action"]
    assert heavy["disclaimer"]
    assert "Valid for" in heavy["message"]


def test_low_confidence_adds_local_verification():
    advisories = generate_advisories(_context(confidence_score=0.42, wind_speed_kmh=35))
    assert any(item["rule_id"] == "low_confidence" for item in advisories)
    spraying = next(item for item in advisories if item["rule_id"] == "strong_wind_spraying")
    assert "Verify locally before taking high-cost action." in spraying["message"]


def test_heat_and_wind_rules():
    advisories = generate_advisories(_context(temperature_max_c=39, temperature_min_c=9, wind_speed_kmh=32))
    ids = {item["rule_id"] for item in advisories}
    assert "heat_stress" in ids
    assert "cold_stress" in ids
    assert "strong_wind_spraying" in ids
