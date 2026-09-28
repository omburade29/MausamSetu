from app.services.uploads import BLOCK_FORECAST_COLUMNS, OBSERVATION_COLUMNS, validate_table


def test_observation_csv_accepts_template_shape():
    csv = (
        "panchayat_code,observation_time,rainfall_mm,temperature_min_c,temperature_max_c,"
        "humidity_percent,wind_speed_kmh,wind_direction_deg,cloud_cover_percent,data_source\n"
        "HAV-01,2026-09-01T06:00:00Z,12.4,21.2,30.8,78,11,230,62,station_upload\n"
    )
    result = validate_table(csv, OBSERVATION_COLUMNS)
    assert result.errors == []
    assert result.accepted == 1
    assert result.rows[0]["rainfall_mm"] == 12.4


def test_observation_csv_rejects_impossible_humidity_and_keeps_valid_rows():
    csv = (
        "panchayat_code,observation_time,rainfall_mm,temperature_min_c,temperature_max_c,"
        "humidity_percent,wind_speed_kmh,wind_direction_deg,cloud_cover_percent,data_source\n"
        "HAV-01,2026-09-01T06:00:00Z,12.4,21.2,30.8,140,11,230,62,station_upload\n"
        "HAV-02,2026-09-01T06:00:00Z,4.0,20.0,31.0,60,10,200,40,station_upload\n"
    )
    result = validate_table(csv, OBSERVATION_COLUMNS)
    assert result.accepted == 1
    assert result.errors[0]["column"] == "humidity_percent"


def test_missing_column_is_a_file_error():
    result = validate_table("block_code,rainfall_mm\nHAV,1\n", BLOCK_FORECAST_COLUMNS)
    assert result.accepted == 0
    assert "missing" in result.errors[0]["message"].lower()
