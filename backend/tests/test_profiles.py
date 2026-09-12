import json

from app import models

TECH = {"category": "frontend", "name": "angular", "version": "19.2.5", "confidence": "high", "evidence": "ng-version"}
ROUTE = {"path": "/login", "framework": "angular", "route_type": "static", "module": None}
GUARD = {"path": "AuthGuard", "framework": "angular", "route_type": "guard", "module": "app.bundle.js"}
DEP = {"name": "rxjs", "version": "7.8.1", "source": "bundle", "package_manager": "npm"}


def _seed_two(make_profile):
    first = make_profile(
        domain="example.com",
        technologies=[TECH],
        routes=[ROUTE, GUARD],
        dependencies=[DEP],
    )
    second = make_profile(
        domain="example.com",
        technologies=[
            TECH,
            {"category": "cdn", "name": "cloudflare", "version": None, "confidence": "high", "evidence": "cf-ray"},
        ],
        routes=[ROUTE],
        dependencies=[],
    )
    return first, second


def test_list_profiles_is_newest_first(client, make_profile):
    first, second = _seed_two(make_profile)
    response = client.get("/api/profiles")
    assert response.status_code == 200
    ids = [p["id"] for p in response.json()]
    assert ids == [second.id, first.id]


def test_get_profile_details_and_404(client, make_profile):
    first, _ = _seed_two(make_profile)

    response = client.get(f"/api/profiles/{first.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["domain_target"] == "example.com"
    assert len(body["technologies"]) == 1
    assert len(body["routes"]) == 2
    assert len(body["js_dependencies"]) == 1

    assert client.get("/api/profiles/99999").status_code == 404


def test_delete_profile_and_delete_all(client, make_profile):
    first, second = _seed_two(make_profile)

    assert client.delete(f"/api/profiles/{first.id}").json() == {
        "status": "deleted",
        "profile_id": first.id,
    }
    assert client.get(f"/api/profiles/{first.id}").status_code == 404

    response = client.delete("/api/profiles")
    assert response.status_code == 200
    assert response.json() == {"status": "deleted", "count": 1}
    assert client.get("/api/profiles").json() == []
    assert second.id is not None


def test_export_json_has_attachment_header(client, make_profile):
    first, _ = _seed_two(make_profile)
    response = client.get(f"/api/profiles/{first.id}/export/json")
    assert response.status_code == 200
    assert "attachment" in response.headers["content-disposition"]
    assert f"kensei-profile-{first.id}.json" in response.headers["content-disposition"]

    payload = json.loads(response.content)
    assert payload["domain"] == "example.com"
    assert payload["technologies"][0]["name"] == "angular"
    assert payload["routes"][0]["path"] == "/login"


def test_report_summary(client, make_profile):
    first, _ = _seed_two(make_profile)
    response = client.get(f"/api/profiles/{first.id}/report")
    assert response.status_code == 200
    body = response.json()
    assert body["profile_id"] == first.id
    assert body["summary"]["technologies_found"] == 1
    assert body["summary"]["routes_discovered"] == 1
    assert body["summary"]["guards_detected"] == 1
    assert body["summary"]["js_dependencies_found"] == 1
    assert "frontend" in body["summary"]["categories"]


def test_compare_and_trends_return_200_after_static_route_order(client, make_profile):
    """Regression: /compare and /trends must not be shadowed by /{profile_id}."""
    first, second = _seed_two(make_profile)

    compare = client.get(f"/api/profiles/compare?ids={first.id},{second.id}")
    assert compare.status_code == 200
    body = compare.json()
    assert [p["profile_id"] for p in body["profiles"]] == [first.id, second.id]
    assert body["changes"][0]["added"] == ["cloudflare@?"]

    trends = client.get("/api/profiles/trends?domain=example.com")
    assert trends.status_code == 200
    points = trends.json()["points"]
    assert [p["profile_id"] for p in points] == [first.id, second.id]
    assert points[0]["guards"] == 1


def test_compare_validation_errors(client, make_profile):
    _seed_two(make_profile)

    # Too few IDs -> 400 (proves it reached compare_profiles, not {profile_id}: int parse -> 422).
    response = client.get("/api/profiles/compare?ids=1")
    assert response.status_code == 400
    assert "at least 2" in response.json()["detail"]

    response = client.get("/api/profiles/compare?ids=1,99999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_static_aliases(client, make_profile):
    first, second = _seed_two(make_profile)
    assert client.get(f"/api/compare?ids={first.id},{second.id}").status_code == 200
    assert client.get("/api/trends?domain=example.com").status_code == 200


def test_models_cascade_delete(make_profile, db_session):
    profile = make_profile(technologies=[TECH], routes=[ROUTE], dependencies=[DEP])
    assert db_session.query(models.Technology).count() == 1
    db_session.delete(profile)
    db_session.commit()
    assert db_session.query(models.Technology).count() == 0
    assert db_session.query(models.DiscoveredRoute).count() == 0
    assert db_session.query(models.JsDependency).count() == 0
