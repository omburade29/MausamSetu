from tests.helpers import auth_header


def test_login_and_me(client):
    headers = auth_header(client, "farmer@example.com", "Farmer@123")
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    body = response.json()["data"]
    assert body["role"] == "farmer"
    assert body["email"] == "farmer@example.com"


def test_login_rejects_bad_password(client):
    response = client.post("/api/auth/login", json={"email": "farmer@example.com", "password": "wrong-password"})
    assert response.status_code == 401


def test_register_creates_farmer(client):
    response = client.post(
        "/api/auth/register",
        json={"name": "New Farmer", "email": "new.farmer@example.com", "password": "Farmer@123", "state": "Maharashtra"},
    )
    assert response.status_code == 201
    assert response.json()["data"]["user"]["role"] == "farmer"


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["database"] == "ok"
