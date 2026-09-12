"""Shared pytest fixtures: isolated SQLite database + FastAPI TestClient.

The environment is configured *before* importing the app because
``app.database`` selects the engine at import time.
"""

import os
import tempfile

# Isolated SQLite database per test session (no network, no Docker, no Postgres).
_fd, _db_path = tempfile.mkstemp(prefix="kensei-test-", suffix=".db")
os.close(_fd)
os.environ["DB_DRIVER"] = "sqlite"
os.environ["DB_PATH"] = _db_path
os.environ.pop("KENSEI_JWT_SECRET", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import database, models  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_database():
    """Recreate every table before each test."""
    models.Base.metadata.drop_all(bind=database.engine)
    models.Base.metadata.create_all(bind=database.engine)
    yield


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def db_session():
    session = database.SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def make_profile(db_session):
    """Insert a Profile with related rows directly through SQLAlchemy."""

    def _make(domain="example.com", status="COMPLETED", technologies=(), routes=(), dependencies=()):
        profile = models.Profile(domain_target=domain, status=status)
        db_session.add(profile)
        db_session.flush()
        for tech in technologies:
            db_session.add(models.Technology(profile_id=profile.id, **tech))
        for route in routes:
            db_session.add(models.DiscoveredRoute(profile_id=profile.id, **route))
        for dep in dependencies:
            db_session.add(models.JsDependency(profile_id=profile.id, **dep))
        db_session.commit()
        db_session.refresh(profile)
        return profile

    return _make


def pytest_sessionfinish(session, exitstatus):
    # Remove the temporary database file (plus WAL companions) after the run.
    for suffix in ("", "-wal", "-shm"):
        try:
            os.unlink(_db_path + suffix)
        except OSError:
            pass
