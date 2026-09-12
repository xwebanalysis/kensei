# API Reference

Base URL (local): `http://localhost:8010`. OpenAPI/Swagger UI: `http://localhost:8010/docs`.

## REST

### GET /

Service information.

```json
{ "status": "ok", "service": "kensei", "version": "0.3.0" }
```

### GET /api/health

Health check including database connectivity. Exempt from rate limiting.

```json
{ "status": "ok", "database": "ok", "version": "0.3.0", "tool": "kensei" }
```

### POST /api/auth/token

Only available when `KENSEI_JWT_SECRET` is set (`403` otherwise).

Request:

```json
{ "password": "kensei" }
```

Response `200 OK`:

```json
{ "token": "<HS256 JWT>", "expires_in": 86400 }
```

### GET /api/version-db

Built-in library version database used to flag outdated technologies.

```json
{ "angular": { "latest": "19.2.5", "all": ["19.2.5", "..."] } }
```

### GET /api/profiles

Stored profiles, newest first.

```json
[
  {
    "id": 2,
    "domain_target": "example.com",
    "status": "COMPLETED",
    "created_at": "2026-09-12T00:00:00"
  }
]
```

### GET /api/profiles/{id}

Profile detail with related technologies, routes and JS dependencies.

Errors: `404` when the profile does not exist.

### DELETE /api/profiles/{id}

Deletes one profile (cascades to its items). Response: `{"status": "deleted", "profile_id": 2}`.

### DELETE /api/profiles

Deletes every profile. Response: `{"status": "deleted", "count": 2}`.

### GET /api/profiles/{id}/export/json

Server-side JSON export. Sets `Content-Disposition: attachment; filename=kensei-profile-{id}.json`.

### GET /api/profiles/{id}/report

Composed report for the UI:

```json
{
  "domain": "example.com",
  "profile_id": 2,
  "created_at": "...",
  "summary": {
    "technologies_found": 6,
    "routes_discovered": 4,
    "guards_detected": 1,
    "js_dependencies_found": 3,
    "categories": ["security", "backend", "frontend"]
  },
  "technologies_by_category": { "backend": [{ "name": "nginx", "version": "1.27.4", "confidence": "high" }] }
}
```

### GET /api/profiles/compare?ids=1,2

Compares at least two stored profiles and lists added/removed technologies between consecutive ids.

Aliases: `GET /api/compare?ids=1,2`.

Errors: `400` for fewer than two ids; `404` when any profile is missing.

### GET /api/profiles/trends?domain=example.com

Timeline of metrics for every matching profile, oldest first.

Aliases: `GET /api/trends?domain=example.com`.

```json
{
  "domain": "example.com",
  "points": [
    { "profile_id": 1, "created_at": "...", "technologies": 5, "routes": 4, "guards": 1, "js_dependencies": 3 }
  ]
}
```

Errors: `404` when no profile matches.

## WebSocket

### WS /api/profile/live?target=...&timeout=180

Streams one xwa-sdk `Event` JSON envelope per message. Query parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `target` | yes | Domain or URL to profile |
| `timeout` | no | Hard timeout in seconds (default 180) |
| `token` | when auth is enabled | HS256 token issued by `POST /api/auth/token`; the socket is closed with code `1008` otherwise |

Event types, in order:

| type | payload | notes |
|------|---------|-------|
| `analysis_started` | `{target, timeout, phases[]}` | `seq` 1, after the profile row is persisted |
| `analysis_progress` | `{phase, total_phases, name, status, percent}` | `status` is `running` or `complete` |
| `item_found` | `{kind, ...}` | `kind`: `technology`, `route` (with `route_type`) or `dependency` |
| `log` | `{message}` | module log lines |
| `analysis_completed` | `{profile_id, summary}` | terminal on success |
| `analysis_error` | `{code, message, detail, retryable}` | terminal on failure |

All envelopes carry `seq`, `type`, `tool: "kensei"`, `analysis_id` (persisted profile id as a string) and `ts` (UTC).

Example (Python):

```bash
python -m pip install websockets
python - <<'EOF'
import asyncio, json, websockets

async def main():
    async with websockets.connect(
        "ws://localhost:8010/api/profile/live?target=example.com"
    ) as ws:
        async for message in ws:
            event = json.loads(message)
            print(event["seq"], event["type"])
            if event["type"] in ("analysis_completed", "analysis_error"):
                break

asyncio.run(main())
EOF
```

## Errors

Errors use the xwa-sdk shape where middleware owns the response:

```json
{ "error": { "code": "RATE_LIMITED", "message": "...", "detail": null, "retryable": true } }
```

FastAPI route validation keeps its standard `{"detail": ...}` shape. Status codes: `400`, `401`, `403`, `404`, `422`, `429`.
