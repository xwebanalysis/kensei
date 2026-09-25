"""Security middleware: optional JWT auth with RBAC, and in-memory rate limiting."""

from __future__ import annotations

import os
import time
from collections import defaultdict, deque

import jwt as pyjwt
from fastapi import Request
from fastapi.responses import JSONResponse

JWT_SECRET = os.getenv("KENSEI_JWT_SECRET") or None
# Admin password accepted by POST /api/auth/login. KENSEI_AUTH_PASSWORD is a
# deprecated alias kept for backward compatibility.
ADMIN_PASSWORD = (
    os.getenv("KENSEI_ADMIN_PASSWORD")
    or os.getenv("KENSEI_AUTH_PASSWORD")
    or "changeme"
)
TOKEN_TTL_HOURS = 24

ADMIN_ROLE = "admin"
ANALYST_ROLE = "analyst"
ROLES = (ADMIN_ROLE, ANALYST_ROLE)

RATE_LIMIT_MAX = int(
    os.getenv("KENSEI_RATE_LIMIT_MAX") or os.getenv("XWA_RATE_LIMIT_MAX") or "120"
)
RATE_LIMIT_WINDOW = 60.0

_hits: dict[str, deque[float]] = defaultdict(deque)

EXEMPT_PATHS = {
    "/",
    "/api/health",
    "/api/auth/token",
    "/api/auth/login",
    "/docs",
    "/redoc",
    "/openapi.json",
}

AUTH_REQUIRED = JWT_SECRET is not None


def is_exempt(path: str) -> bool:
    return path in EXEMPT_PATHS


def is_destructive(request: Request) -> bool:
    """Routes that mutate/remove stored profiles: admin-only under RBAC."""
    method = request.method
    path = request.url.path
    if method == "DELETE" and (
        path == "/api/profiles" or path.startswith("/api/profiles/")
    ):
        return True
    if method == "POST" and path.startswith("/api/profiles/") and path.endswith("/cancel"):
        return True
    return False


async def rate_limit_middleware(request: Request, call_next):
    """In-process token bucket: RATE_LIMIT_MAX requests per client per minute."""
    if is_exempt(request.url.path):
        return await call_next(request)

    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    hits = _hits[client]
    while hits and now - hits[0] > RATE_LIMIT_WINDOW:
        hits.popleft()
    if len(hits) >= RATE_LIMIT_MAX:
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": "RATE_LIMITED",
                    "message": "Rate limit exceeded, try again later.",
                    "detail": None,
                    "retryable": True,
                }
            },
        )
    hits.append(now)
    return await call_next(request)


async def auth_middleware(request: Request, call_next):
    if not AUTH_REQUIRED or is_exempt(request.url.path):
        return await call_next(request)

    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Missing bearer token."})
    token = auth.removeprefix("Bearer ").strip()
    if not token_is_valid(token):
        return JSONResponse(status_code=401, content={"detail": "Invalid or expired token."})

    # RBAC: destructive routes (profile deletion / cancellation) require admin.
    if is_destructive(request) and token_role(token) != ADMIN_ROLE:
        return JSONResponse(
            status_code=403,
            content={"detail": "Admin role required for this action."},
        )
    return await call_next(request)


def token_is_valid(token: str | None) -> bool:
    """Validate an HS256 token; used by HTTP middleware and the WebSocket."""
    if not AUTH_REQUIRED:
        return True
    if not token:
        return False
    try:
        pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return True
    except pyjwt.PyJWTError:
        return False


def token_role(token: str | None) -> str | None:
    """Extract the `role` claim from a valid token (None when unknown/invalid)."""
    if not AUTH_REQUIRED or not token:
        return None
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except pyjwt.PyJWTError:
        return None
    role = payload.get("role")
    return role if role in ROLES else None


def issue_token(sub: str = "kensei-user", role: str = ADMIN_ROLE) -> str:
    now = int(time.time())
    return pyjwt.encode(
        {"sub": sub, "role": role, "iat": now, "exp": now + TOKEN_TTL_HOURS * 3600},
        JWT_SECRET,
        algorithm="HS256",
    )
