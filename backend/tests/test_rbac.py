"""RBAC tests: JWT auth + role-gated destructive routes (opt-in via env)."""

import jwt as pyjwt
import pytest

from app import security


@pytest.fixture()
def auth_enabled(monkeypatch):
    """Simulate KENSEI_JWT_SECRET being set (module attrs are read at import)."""
    monkeypatch.setattr(security, "JWT_SECRET", "rbac-test-secret-0123456789abcdef")
    monkeypatch.setattr(security, "AUTH_REQUIRED", True)
    monkeypatch.setattr(security, "ADMIN_PASSWORD", "changeme")
    return security


def _admin_token():
    return security.issue_token(sub="kensei-admin", role=security.ADMIN_ROLE)


def _analyst_token():
    return security.issue_token(sub="kensei-analyst", role=security.ANALYST_ROLE)


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_disabled_by_default_login_rejected_and_routes_open(client):
    """With no KENSEI_JWT_SECRET, auth is off: no token anywhere, login 403s."""
    assert security.AUTH_REQUIRED is False

    # Login refuses to issue tokens while auth is disabled.
    response = client.post("/api/auth/login", json={"password": "changeme"})
    assert response.status_code == 403

    # Destructive routes behave exactly as before: no token required.
    assert client.delete("/api/profiles").status_code == 200
    assert client.get("/api/profiles").status_code == 200


def test_login_issues_admin_token(client, auth_enabled):
    response = client.post("/api/auth/login", json={"password": "changeme"})
    assert response.status_code == 200
    body = response.json()
    assert body["expires_in"] == security.TOKEN_TTL_HOURS * 3600

    payload = pyjwt.decode(
        body["token"], auth_enabled.JWT_SECRET, algorithms=["HS256"]
    )
    assert payload["sub"] == "kensei-user"
    assert payload["role"] == "admin"


def test_login_rejects_wrong_password(client, auth_enabled):
    response = client.post("/api/auth/login", json={"password": "wrong"})
    assert response.status_code == 401


def test_health_and_root_stay_exempt(client, auth_enabled):
    assert client.get("/api/health").status_code == 200
    assert client.get("/").status_code == 200


def test_unauthorized_without_token_when_enabled(client, auth_enabled):
    assert client.get("/api/profiles").status_code == 401
    assert client.delete("/api/profiles").status_code == 401


def test_analyst_can_read_but_is_denied_on_destructive_routes(client, auth_enabled, make_profile):
    profile = make_profile()
    token = _analyst_token()

    # Read-only routes are fine for analysts.
    assert client.get("/api/profiles", headers=_auth(token)).status_code == 200
    assert client.get(f"/api/profiles/{profile.id}", headers=_auth(token)).status_code == 200

    # Destructive routes -> 403.
    delete_one = client.delete(f"/api/profiles/{profile.id}", headers=_auth(token))
    assert delete_one.status_code == 403
    assert delete_one.json()["detail"] == "Admin role required for this action."

    delete_all = client.delete("/api/profiles", headers=_auth(token))
    assert delete_all.status_code == 403

    cancel = client.post(f"/api/profiles/{profile.id}/cancel", headers=_auth(token))
    assert cancel.status_code == 403


def test_admin_can_delete_and_cancel(client, auth_enabled, make_profile):
    profile = make_profile(status="RUNNING")
    token = _admin_token()

    response = client.delete(f"/api/profiles/{profile.id}", headers=_auth(token))
    assert response.status_code == 200
    assert response.json() == {"status": "deleted", "profile_id": profile.id}

    running = make_profile(status="RUNNING")
    cancel = client.post(f"/api/profiles/{running.id}/cancel", headers=_auth(token))
    assert cancel.status_code == 200
    assert cancel.json() == {"status": "cancelled", "profile_id": running.id}
    assert client.get(f"/api/profiles/{running.id}", headers=_auth(token)).json()["status"] == "CANCELLED"

    assert client.delete("/api/profiles", headers=_auth(token)).json()["count"] == 1


def test_analyst_token_issued_for_cancel_of_finished_profile_conflicts(
    client, auth_enabled, make_profile
):
    """Even an admin gets a 409 when cancelling a non-RUNNING profile."""
    profile = make_profile(status="COMPLETED")
    cancel = client.post(f"/api/profiles/{profile.id}/cancel", headers=_auth(_admin_token()))
    assert cancel.status_code == 409


def test_token_role_extraction(client, auth_enabled):
    assert security.token_role(_admin_token()) == "admin"
    assert security.token_role(_analyst_token()) == "analyst"
    assert security.token_role("garbage") is None
