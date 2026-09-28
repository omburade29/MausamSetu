from fastapi.testclient import TestClient
from shapely.geometry import shape

from app.main import app

client = TestClient(app)

BODY = {
    "state_id": "st-odisha",
    "district_id": "dist-kendrapara",
    "block_id": "blk-marshaghai",
    "date": "2026-09-28",
    "variable": "rainfall_mm",
    "model": "contextual_baseline",
    "predictors": [
        "elevation",
        "location",
        "land_cover",
        "soil_moisture",
        "distance_water",
        "vegetation",
    ],
}


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["is_simulated"] is True


def test_regions_and_geometries():
    response = client.get("/api/regions")
    assert response.status_code == 200
    assert response.json()["states"][0]["name"] == "Odisha"
    collection = client.get("/api/panchayats/blk-marshaghai")
    assert collection.status_code == 200
    payload = collection.json()
    assert len(payload["features"]) == 8
    block = shape(payload["block"]["geometry"])
    assert block.is_valid
    for feature in payload["features"]:
        polygon = shape(feature["geometry"])
        assert polygon.is_valid
        assert block.covers(polygon)


def test_downscale_history_validation_and_reset():
    created = client.post("/api/downscale", json=BODY)
    assert created.status_code == 200
    payload = created.json()
    for key in (
        "run_id",
        "status",
        "model",
        "geography",
        "variable",
        "block_forecast",
        "panchayat_forecasts",
        "uncertainty_summary",
        "validation_metrics",
        "advisories",
        "simulation_metadata",
    ):
        assert key in payload
    rains = [row["forecasts"]["rainfall_mm"] for row in payload["panchayat_forecasts"]]
    assert len(set(rains)) > 1
    assert payload["simulation_metadata"]["is_simulated"] is True
    assert payload["block_forecast"]["values"]["rainfall_mm"] == 42.0
    assert "Finer spatial detail does not automatically imply higher forecast accuracy." in (
        payload["simulation_metadata"]["statements"]
    )

    fetched = client.get(f"/api/downscale/{payload['run_id']}")
    assert fetched.status_code == 200
    validation = client.get(f"/api/validation/{payload['run_id']}")
    assert validation.status_code == 200
    metrics = validation.json()
    assert "mae" in metrics["baseline_metrics"]
    assert "mae" in metrics["downscaled_metrics"]
    assert "fine-scale reference" in metrics["warning"]
    advisories = client.get(f"/api/advisories/{payload['run_id']}")
    assert advisories.status_code == 200
    assert advisories.json()["advisories"]
    history = client.get("/api/history")
    assert history.status_code == 200
    assert len(history.json()["runs"]) == 1
    cleared = client.delete("/api/history")
    assert cleared.status_code == 200
    assert cleared.json()["deleted"] == 1
    assert client.get("/api/history").json()["runs"] == []


def test_unknown_run_and_bad_geography():
    missing = client.get("/api/downscale/MS-DOESNOTEXIST")
    assert missing.status_code == 404
    assert "No downscaling run" in missing.json()["detail"]
    bad = client.post("/api/downscale", json={**BODY, "district_id": "dist-other"})
    assert bad.status_code == 400
    invalid = client.post("/api/downscale", json={**BODY, "variable": "snowfall"})
    assert invalid.status_code == 422


def test_block_forecast_requires_known_date():
    ok = client.get("/api/block-forecast", params={"block_id": "blk-marshaghai", "date": "2026-09-28"})
    assert ok.status_code == 200
    assert ok.json()["resolution_text"] == "Current resolution: Block level"
    missing = client.get("/api/block-forecast", params={"block_id": "blk-marshaghai", "date": "2020-01-01"})
    assert missing.status_code == 404
