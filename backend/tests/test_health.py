from app.main import APP_VERSION, TOOL_NAME


def test_root_service_envelope(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": TOOL_NAME, "version": APP_VERSION}


def test_health_standard_shape(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "status": "ok",
        "database": "ok",
        "version": APP_VERSION,
        "tool": "kensei",
    }


def test_health_is_exempt_from_rate_limit(client):
    for _ in range(150):
        assert client.get("/api/health").status_code == 200
