# Kensei Documentation

Documentation for the Kensei web technology stack profiler.

| Document | Description |
|----------|-------------|
| [architecture.md](architecture.md) | Stack, project layout, data flow and event contract |
| [ui-architecture.md](ui-architecture.md) | Frontend structure (core/shared/features), i18n, exports and tests |
| [api.md](api.md) | REST and WebSocket API reference |
| [development.md](development.md) | Running, environment variables and verification |

## Quick orientation

- Kensei is a self-contained web application: an Angular 22 (zoneless, self-hosted Nothing fonts, en/es i18n) frontend and a FastAPI backend.
- The backend runs 100% locally with SQLite by default (`./kensei.sh`); PostgreSQL is opt-in through Docker Compose.
- Four profiling phases run per target: SSL/TLS, server fingerprinting, JS bundle analysis and SPA route discovery.
- Profiles are persisted in the database and can be compared, trended and exported (JSON server-side; JSON/CSV/PDF/BIN client-side).
- Live stream events use the xwa-sdk `Event` envelope, the shared data contract of the XWA ecosystem.

## Quick start

```bash
./kensei.sh                 # local SQLite: frontend :4210, backend :8010
./kensei.sh local backend   # backend only
./kensei.sh docker          # Docker Compose with PostgreSQL
```

See [development.md](development.md) for all execution modes.
