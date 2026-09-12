"""Module tests with httpx monkeypatched — no network access."""

import asyncio

from app.modules import server_fingerprint, version_db


class FakeResponse:
    def __init__(self, text="", status_code=200, headers=None):
        self.text = text
        self.status_code = status_code
        self.headers = headers or {}
        self.content = text.encode()


class FakeAsyncClient:
    """Minimal async httpx.AsyncClient replacement."""

    handler = None

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, url, **kwargs):
        if FakeAsyncClient.handler is not None:
            return FakeAsyncClient.handler(url)
        return FakeResponse()


def test_server_fingerprint_detects_server_cdn_and_powered_by(monkeypatch):
    def handler(url):
        return FakeResponse(
            text="<html></html>",
            headers={
                "Server": "nginx/1.27.4",
                "X-Powered-By": "Express/4.18.2",
                "CF-RAY": "8a1b2c3d4e5f",
            },
        )

    FakeAsyncClient.handler = handler
    monkeypatch.setattr(server_fingerprint.httpx, "AsyncClient", FakeAsyncClient)

    logs = []

    async def log(message):
        logs.append(message)

    result = asyncio.run(server_fingerprint.run("example.com", log))

    names = {server["name"] for server in result["servers"]}
    assert "nginx" in names
    assert "nodejs" in names
    versions = {server["name"]: server["version"] for server in result["servers"]}
    assert versions["nginx"] == "1.27.4"
    assert result["cdn"]["name"] == "cloudflare"
    assert result["headers"]["Server"] == "nginx/1.27.4"
    assert any("HTTP 200" in line for line in logs)


def test_server_fingerprint_handles_fetch_error(monkeypatch):
    class BrokenClient(FakeAsyncClient):
        async def get(self, url, **kwargs):
            raise RuntimeError("connection refused")

    monkeypatch.setattr(server_fingerprint.httpx, "AsyncClient", BrokenClient)

    async def log(message):
        pass

    result = asyncio.run(server_fingerprint.run("unreachable.invalid", log))
    assert result == {"servers": [], "cdn": None, "headers": {}}


def test_version_db_statuses():
    assert version_db.check("react", "18.3.1")["status"] == "up_to_date"
    assert version_db.check("angular", "15.2.10")["status"] == "major_behind"
    assert version_db.check("totally-unknown", "1.0.0")["status"] == "unknown"
    assert version_db.check("react", None)["status"] == "unknown"
    assert version_db.check("react", "17.0.2")["latest"] == "18.3.1"
