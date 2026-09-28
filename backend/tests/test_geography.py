from tests.helpers import auth_header


def test_hierarchy_filters(client):
    headers = auth_header(client, "officer@example.com", "Officer@123")
    states = client.get("/api/states", headers=headers)
    assert states.status_code == 200
    state_id = states.json()["data"][0]["id"]
    districts = client.get("/api/districts", params={"state_id": state_id}, headers=headers)
    assert districts.status_code == 200
    assert len(districts.json()["data"]) == 2
    district_id = districts.json()["data"][0]["id"]
    blocks = client.get("/api/blocks", params={"district_id": district_id}, headers=headers)
    assert blocks.status_code == 200
    assert len(blocks.json()["data"]) == 2
    block_id = blocks.json()["data"][0]["id"]
    panchayats = client.get("/api/panchayats", params={"block_id": block_id}, headers=headers)
    assert panchayats.status_code == 200
    assert len(panchayats.json()["data"]) == 6
    detail = client.get(f"/api/panchayats/{panchayats.json()['data'][0]['id']}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["data"]["geometry"]["type"] in {"Polygon", "MultiPolygon"}


def test_geodata_feature_collection(client):
    headers = auth_header(client, "farmer@example.com", "Farmer@123")
    response = client.get("/api/geodata/panchayats", headers=headers)
    assert response.status_code == 200
    features = response.json()["data"]["features"]
    assert len(features) >= 20
    assert features[0]["geometry"]["type"] == "Polygon"
