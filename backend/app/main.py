import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Dict

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from . import database, models, profiler, security
from .events import EventStream

APP_VERSION = "0.3.0"
TOOL_NAME = "kensei"

# LAN/localhost origins allowed by default when XWA_CORS_ORIGINS is unset.
DEFAULT_CORS_REGEX = (
    r"^https?://("
    r"localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|"
    r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
    r"192\.168\.\d{1,3}\.\d{1,3}|"
    r"172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
    r")(?::\d+)?$"
)


def _cors_kwargs() -> Dict[str, object]:
    raw = os.getenv("XWA_CORS_ORIGINS", "").strip()
    if not raw:
        return {"allow_origin_regex": DEFAULT_CORS_REGEX}
    if raw == "*":
        return {"allow_origins": ["*"]}
    return {"allow_origins": [origin.strip() for origin in raw.split(",") if origin.strip()]}


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.wait_for_db()
    models.Base.metadata.create_all(bind=database.engine)
    yield


app = FastAPI(
    title="Kensei API",
    description="Web Technology Stack Profiler API",
    version=APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    **_cors_kwargs(),
)
app.middleware("http")(security.auth_middleware)
app.middleware("http")(security.rate_limit_middleware)


class TokenRequest(BaseModel):
    password: str


class TokenResponse(BaseModel):
    token: str
    expires_in: int


# ── Service / health ─────────────────────────────────────────────────────────


@app.get("/")
def read_root():
    return {"status": "ok", "service": TOOL_NAME, "version": APP_VERSION}


@app.get("/api/health")
def health_check(db: Session = Depends(database.get_db)):
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"
    return {
        "status": "ok" if db_status == "ok" else "error",
        "database": db_status,
        "version": APP_VERSION,
        "tool": TOOL_NAME,
    }


@app.post("/api/auth/token", response_model=TokenResponse)
def issue_token(request: TokenRequest):
    """Issue a signed token. Only available when KENSEI_JWT_SECRET is set."""
    if not security.AUTH_REQUIRED:
        raise HTTPException(status_code=403, detail="Auth is disabled (no KENSEI_JWT_SECRET).")
    if request.password != security.AUTH_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password.")
    return TokenResponse(
        token=security.issue_token(),
        expires_in=security.TOKEN_TTL_HOURS * 3600,
    )


@app.get("/api/version-db")
def get_version_db():
    from .modules.version_db import KNOWN_VERSIONS

    return {
        name: {"latest": versions[0], "all": versions}
        for name, versions in KNOWN_VERSIONS.items()
    }


# ── Live WebSocket (xwa-sdk Event envelopes) ─────────────────────────────────


@app.websocket("/api/profile/live")
async def websocket_profile(
    websocket: WebSocket,
    target: str,
    timeout: int = 180,
    token: str | None = None,
    db: Session = Depends(database.get_db),
):
    if security.AUTH_REQUIRED and not security.token_is_valid(token):
        await websocket.close(code=1008, reason="Authentication required")
        return

    await websocket.accept()
    profile_record = None
    stream: EventStream | None = None

    try:
        profile_record = models.Profile(domain_target=target, status="RUNNING")
        db.add(profile_record)
        db.commit()
        db.refresh(profile_record)

        stream = EventStream(websocket, analysis_id=str(profile_record.id))
        await stream.emit(
            "analysis_started",
            {"target": target, "timeout": timeout, "phases": profiler.PHASES},
        )

        summary = await asyncio.wait_for(
            profiler.run_full_profile(
                target, stream, db, profile_record.id, timeout_seconds=timeout
            ),
            timeout=timeout,
        )

        profile_record.status = "COMPLETED"
        db.commit()
        await stream.emit(
            "analysis_completed",
            {"profile_id": profile_record.id, "summary": summary},
        )

    except WebSocketDisconnect:
        if profile_record:
            profile_record.status = "CANCELLED"
            db.commit()
    except Exception as e:
        if profile_record:
            profile_record.status = "ERROR"
            db.commit()
        if stream is None:
            stream = EventStream(websocket, analysis_id=str(profile_record.id) if profile_record else "")
        error_payload = {
            "code": "ANALYSIS_ERROR",
            "message": str(e) or e.__class__.__name__,
            "detail": None,
            "retryable": True,
        }
        try:
            await stream.emit("analysis_error", error_payload)
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass


# ── Profiles (static routes MUST stay before /{profile_id}) ──────────────────


@app.get("/api/profiles")
def list_profiles(db: Session = Depends(database.get_db)):
    return db.query(models.Profile).order_by(models.Profile.id.desc()).all()


@app.get("/api/profiles/compare")
@app.get("/api/compare", include_in_schema=False)
def compare_profiles(ids: str, db: Session = Depends(database.get_db)):
    id_list = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]
    if len(id_list) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 profile IDs (comma-separated)")

    profiles = db.query(models.Profile).filter(models.Profile.id.in_(id_list)).all()
    if len(profiles) != len(id_list):
        raise HTTPException(status_code=404, detail="One or more profiles not found")

    result = []
    for p in sorted(profiles, key=lambda x: x.id):
        tech_names = set()
        for t in p.technologies:
            if t.category not in ("outdated",):
                tech_names.add(f"{t.name}@{t.version or '?'}")

        result.append({
            "profile_id": p.id,
            "domain": p.domain_target,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "technology_count": len(p.technologies),
            "technologies": sorted(tech_names),
        })

    diffs = []
    for i in range(1, len(result)):
        prev_techs = set(result[i - 1]["technologies"])
        curr_techs = set(result[i]["technologies"])
        added = curr_techs - prev_techs
        removed = prev_techs - curr_techs
        if added or removed:
            diffs.append({
                "from_profile": result[i - 1]["profile_id"],
                "to_profile": result[i]["profile_id"],
                "added": sorted(added),
                "removed": sorted(removed),
            })

    return {"profiles": result, "changes": diffs}


@app.get("/api/profiles/trends")
@app.get("/api/trends", include_in_schema=False)
def profile_trends(domain: str, db: Session = Depends(database.get_db)):
    """Timeline of profile metrics for a domain, oldest first."""
    profiles = (
        db.query(models.Profile)
        .filter(models.Profile.domain_target.ilike(f"%{domain}%"))
        .options(
            joinedload(models.Profile.technologies),
            joinedload(models.Profile.routes),
            joinedload(models.Profile.js_dependencies),
        )
        .order_by(models.Profile.id.asc())
        .all()
    )

    if not profiles:
        raise HTTPException(status_code=404, detail="No profiles found for this domain")

    return {
        "domain": profiles[0].domain_target,
        "points": [
            {
                "profile_id": p.id,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "technologies": len(p.technologies),
                "routes": len([r for r in p.routes if r.route_type != "guard"]),
                "guards": len([r for r in p.routes if r.route_type == "guard"]),
                "js_dependencies": len(p.js_dependencies),
            }
            for p in profiles
        ],
    }


@app.delete("/api/profiles")
def delete_all_profiles(db: Session = Depends(database.get_db)):
    count = db.query(models.Profile).delete()
    db.commit()
    return {"status": "deleted", "count": count}


@app.get("/api/profiles/{profile_id}")
def get_profile_details(profile_id: int, db: Session = Depends(database.get_db)):
    profile = (
        db.query(models.Profile)
        .options(
            joinedload(models.Profile.technologies),
            joinedload(models.Profile.routes),
            joinedload(models.Profile.js_dependencies),
        )
        .filter(models.Profile.id == profile_id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.delete("/api/profiles/{profile_id}")
def delete_profile(profile_id: int, db: Session = Depends(database.get_db)):
    profile = db.query(models.Profile).filter(models.Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.delete(profile)
    db.commit()
    return {"status": "deleted", "profile_id": profile_id}


@app.get("/api/profiles/{profile_id}/export/json")
def export_profile_json(profile_id: int, db: Session = Depends(database.get_db)):
    profile = (
        db.query(models.Profile)
        .options(
            joinedload(models.Profile.technologies),
            joinedload(models.Profile.routes),
            joinedload(models.Profile.js_dependencies),
        )
        .filter(models.Profile.id == profile_id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    payload = {
        "domain": profile.domain_target,
        "status": profile.status,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "technologies": [
            {
                "category": t.category,
                "name": t.name,
                "version": t.version,
                "confidence": t.confidence,
                "evidence": t.evidence,
            }
            for t in profile.technologies
        ],
        "routes": [
            {
                "path": r.path,
                "framework": r.framework,
                "route_type": r.route_type,
                "module": r.module,
            }
            for r in profile.routes
        ],
        "js_dependencies": [
            {
                "name": d.name,
                "version": d.version,
                "source": d.source,
                "package_manager": d.package_manager,
            }
            for d in profile.js_dependencies
        ],
    }

    json_bytes = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename=kensei-profile-{profile_id}.json'
        },
    )


@app.get("/api/profiles/{profile_id}/report")
def build_report(profile_id: int, db: Session = Depends(database.get_db)):
    profile = (
        db.query(models.Profile)
        .options(
            joinedload(models.Profile.technologies),
            joinedload(models.Profile.routes),
            joinedload(models.Profile.js_dependencies),
        )
        .filter(models.Profile.id == profile_id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    tech_by_category: Dict[str, list] = {}
    for t in profile.technologies:
        tech_by_category.setdefault(t.category, []).append({
            "name": t.name, "version": t.version, "confidence": t.confidence,
        })

    guard_count = len([r for r in profile.routes if r.route_type == "guard"])
    route_count = len([r for r in profile.routes if r.route_type != "guard"])
    dep_count = len(profile.js_dependencies)

    report = {
        "domain": profile.domain_target,
        "profile_id": profile_id,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "summary": {
            "technologies_found": len(profile.technologies),
            "routes_discovered": route_count,
            "guards_detected": guard_count,
            "js_dependencies_found": dep_count,
            "categories": list(tech_by_category.keys()),
        },
        "technologies_by_category": tech_by_category,
    }

    outdated = [t for t in profile.technologies if t.category == "outdated"]
    if outdated:
        report["outdated_technologies"] = [
            {"name": t.name, "version": t.version, "evidence": t.evidence}
            for t in outdated
        ]

    return report
