# Architecture

## Overview

Kensei is a two-tier web application: an Angular single-page application and a FastAPI service. The backend owns the profiling pipeline and persistence; the frontend triggers scans, renders progress from the live stream and explores stored profiles.

```
Browser (Angular 21, :4210)
   │  REST (fetch/HttpClient)          WS (Event envelopes)
   ▼                                     ▼
FastAPI (:8010) ── security.py (optional JWT + rate limit)
   │
   ▼
profiler.py orchestrator
   ├── modules/ssl_tls.py             TLS handshake, cipher, certificate
   ├── modules/server_fingerprint.py  Server/X-Powered-By headers, CDN
   ├── modules/js_analyzer.py         Bundles, dependencies, source maps
   └── modules/spa_discovery.py       Angular/React/Vue routes and guards
   │
   ▼
SQLAlchemy 2 → SQLite (default, WAL) | PostgreSQL (opt-in)
```

## Backend

Layout:

```
backend/
├── app/
│   ├── __init__.py
│   ├── database.py      # engine setup, SQLite/PostgreSQL switch, PRAGMAs
│   ├── events.py        # xwa-sdk Event envelope + EventStream emitter
│   ├── main.py          # FastAPI app, REST routes, WebSocket endpoint
│   ├── models.py        # SQLAlchemy ORM models
│   ├── profiler.py      # profiling orchestrator (4 phases, persists items)
│   ├── security.py      # optional JWT auth + in-process rate limiting
│   └── modules/         # profiling modules (network + pure logic)
├── tests/               # pytest suite (SQLite tmp DB, httpx monkeypatched)
├── Dockerfile           # python:3.13-slim
├── requirements.txt     # runtime pins (Python 3.13)
├── requirements-postgres.txt
└── requirements-dev.txt # pytest + anyio
```

### Components

- **database.py** — `DB_DRIVER` selects the engine: `sqlite` (default) or `postgresql`. SQLite connections set `foreign_keys=ON`, `journal_mode=WAL` and `busy_timeout=5000`. `wait_for_db()` retries PostgreSQL at startup.
- **models.py** — four tables: `profiles` (the analysis session), `technologies`, `discovered_routes` and `js_dependencies`, all cascading from the profile.
- **events.py** — wraps `xwa_sdk.Event` when the SDK is installed and falls back to an identical local dataclass. `EventStream` increments `seq`, stamps UTC `ts` and serializes the JSON envelope.
- **profiler.py** — runs the four phases in order. Each phase logs, emits `analysis_progress`, persists its items and emits one `item_found` per technology/route/dependency. Returns the summary used by `analysis_completed`.
- **security.py** — optional HS256 JWT (`KENSEI_JWT_SECRET`) and an in-process rate limiter (default 120 req/min per IP; `/api/health` is exempt). WebSockets validate the token when auth is enabled.

### Analysis flow

1. The client opens `WS /api/profile/live?target=...`.
2. A `Profile` row is created with status `RUNNING`; its persisted id becomes the `analysis_id` of every event.
3. `analysis_started` is emitted, then each phase streams `analysis_progress` and `item_found` events.
4. Results are persisted per phase; the profile becomes `COMPLETED` and `analysis_completed` carries the summary.
5. On failure the profile becomes `ERROR` and `analysis_error` is emitted; a disconnect marks it `CANCELLED`.

### Event contract (xwa-sdk `Event`)

| type | payload |
|------|---------|
| `analysis_started` | `{target, timeout, phases[]}` |
| `analysis_progress` | `{phase, total_phases, name, status, percent}` |
| `item_found` | `{kind: technology\|route\|dependency, ...item fields}` |
| `log` | `{message}` |
| `analysis_completed` | `{profile_id, summary: {technologies, routes, guards, dependencies}}` |
| `analysis_error` | `{code, message, detail, retryable}` |

Every envelope carries `seq` (monotonic), `type`, `tool="kensei"`, `analysis_id` (persisted id as string) and `ts` (UTC RFC 3339).

## Frontend

Layout:

```
frontend/
├── src/
│   ├── environments/environment.ts  # apiBaseUrl / wsBaseUrl (:8010)
│   ├── app/
│   │   ├── services/api.service.ts  # central typed REST client + live URL builder
│   │   ├── app.config.ts            # providers (router, HttpClient)
│   │   ├── app.routes.ts
│   │   └── features/
│   │       ├── profiler/            # live scan dashboard (WS Event consumer)
│   │       ├── inventory/           # stored profile explorer + exports
│   │       ├── js-analysis/         # JS dependencies and version database
│   │       ├── spa-routes/          # route tree and guards
│   │       └── history/             # list, compare, trends, delete
│   └── styles.scss
├── angular.json                     # build/serve/test targets (@angular/build)
├── Dockerfile                       # node:24
└── package.json                     # Angular 21, Vitest unit tests
```

- `ProfilerComponent` parses each WebSocket message as JSON and updates phase state and counters from `analysis_progress` and `item_found` events; an unexpected text payload is ignored.
- `ApiService` centralizes every HTTP call and builds the `ws://` live URL (appending a stored `kensei_token` when present).
- Design tokens and typography follow the Nothing Design System shared across the XWA modules.

## Data contracts

REST responses follow the analysis envelope where applicable; live stream events conform to the xwa-sdk `Event` schema. The backend uses the installed `xwa-sdk` package when available and a compatible local fallback otherwise.
