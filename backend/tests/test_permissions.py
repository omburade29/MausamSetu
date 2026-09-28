from tests.helpers import auth_header


def test_farmer_cannot_upload_or_train(client):
    headers = auth_header(client, "farmer@example.com", "Farmer@123")
    upload = client.post(
        "/api/data/upload/observations",
        headers=headers,
        files={"file": ("observations.csv", b"panchayat_code\n", "text/csv")},
    )
    assert upload.status_code == 403
    train = client.post("/api/models/train", headers=headers)
    assert train.status_code == 403
    status = client.get("/api/system/status", headers=headers)
    assert status.status_code == 403


def test_admin_can_view_system_status(client):
    headers = auth_header(client, "admin@example.com", "Admin@123")
    response = client.get("/api/system/status", headers=headers)
    assert response.status_code == 200
    assert response.json()["data"]["database"] == "ok"
