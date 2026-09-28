from tests.helpers import auth_header


def test_user_flow_login_forecast_advisory_export(client):
    farmer = auth_header(client, "farmer@example.com", "Farmer@123")
    places = client.get("/api/panchayats", headers=farmer).json()["data"]
    place = places[0]
    forecast = client.get(f"/api/forecasts/panchayat/{place['id']}", headers=farmer)
    assert forecast.status_code == 200
    assert forecast.json()["data"]

    compare = client.get(f"/api/forecasts/compare/{place['id']}", headers=farmer)
    assert compare.status_code == 200
    variables = compare.json()["data"]["variables"]
    assert any(item["difference_downscaled_minus_block"] is not None for item in variables)

    crops = None
    officer = auth_header(client, "officer@example.com", "Officer@123")
    # Crops are not a public list endpoint; generate uses known seeded ids via advisories.
    existing = client.get(f"/api/advisories/panchayat/{place['id']}", headers=farmer)
    assert existing.status_code == 200
    assert existing.json()["data"], "sample published advisories should exist"
    published = existing.json()["data"][0]
    assert published["status"] == "published"
    assert published["disclaimer"]

    generated = client.post(
        "/api/advisories/generate",
        headers=officer,
        json={"panchayat_id": place["id"], "crop_id": published["crop_id"], "soil_type": "clay loam"},
    )
    assert generated.status_code == 201
    draft = generated.json()["data"][0]
    assert draft["status"] == "draft"
    review = client.put(
        f"/api/advisories/{draft['id']}/review",
        headers=officer,
        json={"decision": "approve", "notes": "Checked against the block forecast."},
    )
    assert review.status_code == 200
    published_now = client.post(f"/api/advisories/{draft['id']}/publish", headers=officer)
    assert published_now.status_code == 200
    assert published_now.json()["data"]["status"] == "published"

    export = client.get("/api/export/forecasts.csv", headers=officer, params={"panchayat_id": place["id"]})
    assert export.status_code == 200
    assert "panchayat_code" in export.text.splitlines()[0]
    assert "Not an official IMD forecast" in export.text

    pdf = client.get(f"/api/reports/panchayat/{place['id']}/pdf", headers=farmer)
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF")

    geo = client.get("/api/export/forecasts.geojson", headers=officer)
    assert geo.status_code == 200
    assert geo.json()["type"] == "FeatureCollection"
    assert crops is None
