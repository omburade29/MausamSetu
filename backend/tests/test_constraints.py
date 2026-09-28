import logging

from app.ml.constraints import apply_constraints


def test_physical_constraints_clip_and_log():
    notes = []
    corrected = apply_constraints(
        {
            "rainfall_mm": -3,
            "humidity_percent": 120,
            "cloud_cover_percent": -5,
            "wind_speed_kmh": -2,
            "probability_of_rain": 1.4,
            "temperature_min_c": 36,
            "temperature_max_c": 30,
        },
        notes,
    )
    assert corrected["rainfall_mm"] == 0
    assert corrected["humidity_percent"] == 100
    assert corrected["cloud_cover_percent"] == 0
    assert corrected["wind_speed_kmh"] == 0
    assert corrected["probability_of_rain"] == 1
    assert corrected["temperature_min_c"] == 30
    assert corrected["temperature_max_c"] == 36
    assert any(note["field"] == "rainfall_mm" for note in notes)
    assert any(note["reason"] == "min_temperature_exceeded_max" for note in notes)


def test_constraint_log_uses_logger(caplog):
    with caplog.at_level(logging.INFO, logger="app.ml.constraints"):
        apply_constraints({"rainfall_mm": -1}, [])
    assert any("Clipped rainfall_mm" in message for message in caplog.messages)
