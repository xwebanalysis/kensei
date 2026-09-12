"""WebSocket contract tests: xwa-sdk Event envelopes."""

import pytest

from app import security
from app.main import app


def test_ws_streams_event_envelopes(client, monkeypatch):
    captured = {}

    async def fake_run_full_profile(target, stream, db, profile_id, timeout_seconds=180):
        captured["analysis_id"] = stream.analysis_id
        await stream.log("[kensei] fake log")
        await stream.emit(
            "item_found",
            {"kind": "technology", "category": "backend", "name": "nginx", "version": "1.27.4"},
        )
        return {"technologies": 1, "routes": 0, "guards": 0, "dependencies": 0}

    monkeypatch.setattr("app.main.profiler.run_full_profile", fake_run_full_profile)

    with client.websocket_connect("/api/profile/live?target=example.com") as websocket:
        events = [websocket.receive_json() for _ in range(4)]

    types = [event["type"] for event in events]
    assert types == ["analysis_started", "log", "item_found", "analysis_completed"]
    assert [event["seq"] for event in events] == [1, 2, 3, 4]
    assert all(event["tool"] == "kensei" for event in events)
    assert all(event["analysis_id"].isdigit() for event in events)
    assert all(event["ts"].endswith("Z") for event in events)
    assert events[0]["payload"]["target"] == "example.com"
    assert len(events[0]["payload"]["phases"]) == 4
    assert events[2]["payload"]["kind"] == "technology"
    assert events[3]["payload"]["summary"]["technologies"] == 1

    # The persisted profile was completed and keyed by the emitted analysis_id.
    detail = client.get(f"/api/profiles/{captured['analysis_id']}")
    assert detail.status_code == 200
    assert detail.json()["status"] == "COMPLETED"


def test_ws_auth_required_when_secret_configured(client, monkeypatch):
    monkeypatch.setattr(security, "AUTH_REQUIRED", True)
    monkeypatch.setattr(security, "JWT_SECRET", "unit-test-secret-0123456789abcdef")

    with pytest.raises(Exception):
        with client.websocket_connect("/api/profile/live?target=example.com") as websocket:
            websocket.receive_json()

    # A valid token is accepted by the same validator used by the WS handler.
    assert security.token_is_valid(security.issue_token())
    assert not security.token_is_valid("not-a-token")
