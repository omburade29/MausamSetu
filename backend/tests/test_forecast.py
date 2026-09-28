from tests.helpers import auth_header


def _headers(client):
    return auth_header(client, "officer@example.com", "Officer@123")


def _first_panchayat(client, headers):
    response = client.get("/api/panchayats", headers=headers)
    return response.json()["data"][0]


def test_forecasts_are_labeled_separately_from_block_values(client):
    headers = _headers(client)
    place = _first_panchayat(client, headers)
    forecasts = client.get(f"/api/forecasts/panchayat/{place['id']}", headers=headers)
    assert forecasts.status_code == 200
    body = forecasts.json()
    assert body["disclaimer"]
    assert body["source"]["official_forecast"] is False
    row = body["data"][0]
    assert row["estimate_kind"] == "downscaled_model_estimate"
    assert "Not an official IMD forecast" in row["data_source_label"]
    assert row["generated_at"]
    assert row["lower_bound"] <= row["rainfall_mm"] <= row["upper_bound"]
    assert 0 <= row["confidence_score"] <= 1
    compare = client.get(f"/api/forecasts/compare/{place['id']}", headers=headers)
    assert compare.status_code == 200
    compared = compare.json()["data"]
    assert compared["block"]["estimate_kind"] == "block_forecast"
    assert compared["downscaled"]["estimate_kind"] == "downscaled_model_estimate"
    rainfall = next(item for item in compared["variables"] if item["variable"] == "rainfall_mm")
    assert rainfall["block_forecast"] is not None
    assert rainfall["downscaled"] is not None


def test_model_metrics_include_baseline_statement(client):
    headers = _headers(client)
    listing = client.get("/api/models", headers=headers)
    assert listing.status_code == 200
    runs = listing.json()["data"]
    rainfall = next(item for item in runs if item["variable"] == "rainfall_mm")
    assert rainfall["baseline_rmse"] is not None
    assert rainfall["rmse"] is not None
    assert rainfall["statement"].startswith("Downscaling ")
    detail = client.get(f"/api/models/{rainfall['id']}/metrics", headers=headers)
    assert detail.status_code == 200
    metrics = detail.json()["data"]["detail"]
    assert "by_horizon" in metrics
    assert "by_season" in metrics
    assert "by_panchayat" in metrics


def test_constraints_hold_on_generated_forecasts(client):
    headers = auth_header(client, "farmer@example.com", "Farmer@123")
    response = client.get("/api/forecasts/latest", headers=headers)
    assert response.status_code == 200
    for row in response.json()["data"]:
        assert row["rainfall_mm"] >= 0
        assert row["wind_speed_kmh"] >= 0
        assert 0 <= row["humidity_percent"] <= 100
        assert 0 <= row["cloud_cover_percent"] <= 100
        assert row["temperature_min_c"] <= row["temperature_max_c"]
        if row["confidence_score"] < 0.5:
            assert row["low_confidence"] is True
