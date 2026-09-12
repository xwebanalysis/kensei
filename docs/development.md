# Development

## Requirements

| Component | Requirement |
|-----------|-------------|
| Node.js | >= 20 (Node 24 via mise recommended; Angular 21 CLI) |
| Python | 3.13 (created with `uv` by `kensei.sh`) |
| Docker | optional — only for the compose (PostgreSQL) mode |
| Database | none for local mode (SQLite); PostgreSQL for compose mode |

## Execution modes

`kensei.sh` is the entry point. `local` is the default mode.

| Command | Description |
|---------|-------------|
| `./kensei.sh` | Local backend + frontend: `:8010` / `:4210`, SQLite |
| `./kensei.sh local backend` | Native backend only, SQLite at `<repo>/kensei.db` |
| `./kensei.sh local frontend` | Native frontend only, `:4210` |
| `./kensei.sh docker` | Full stack with Docker Compose (PostgreSQL) |
| `./kensei.sh docker backend` | Backend + `db` service only |

Legacy flags remain as aliases for `local`: `--sqlite`, `--native`, `--native-no-infra`, `--fast`.

Manual equivalents:

```bash
# backend (native, SQLite)
cd backend
~/.local/bin/uv venv --python 3.13 --seed .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/pip install -e ../../xwa-sdk/bindings/python   # or the git fallback below
export DB_DRIVER=sqlite
export DB_PATH="$(pwd)/../kensei.db"
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload

# frontend (native)
cd frontend
npm ci
npm start        # ng serve --host 0.0.0.0 --port 4210
```

## xwa-sdk

`kensei.sh` installs the local editable checkout first:

```bash
.venv/bin/pip install -e /home/x/Documents/xwebanalysis/xwa-sdk/bindings/python
```

If the sibling repo is absent it falls back to:

```bash
.venv/bin/pip install "xwa-sdk @ git+https://github.com/xwebanalysis/xwa-sdk.git#subdirectory=bindings/python"
```

The SDK is intentionally not pinned in `requirements.txt`. Without it the backend still emits the same `Event` envelopes thanks to the local fallback in `app/events.py`.

## Environment variables (backend)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_DRIVER` | `sqlite` | `sqlite` or `postgresql` |
| `DB_PATH` | `<repo>/kensei.db` | SQLite database file |
| `DB_HOST` / `DB_PORT` | `db` / `5432` | PostgreSQL host/port |
| `DB_NAME` / `DB_USER` / `DB_PASS` | `kensei` / `postgres` / `postgres` | PostgreSQL credentials |
| `XWA_CORS_ORIGINS` | unset | Comma-separated exact origins, or `*`. Unset allows localhost/LAN regex (`allow_credentials=False`) |
| `KENSEI_JWT_SECRET` | unset | When set, all `/api/*` routes and the WebSocket require an HS256 token |
| `KENSEI_AUTH_PASSWORD` | `kensei` | Password accepted by `POST /api/auth/token` |
| `KENSEI_RATE_LIMIT_MAX` | `120` | Requests per IP per 60 s window; `/api/health` is exempt |

Example with auth enabled:

```bash
export KENSEI_JWT_SECRET=change-me
export KENSEI_AUTH_PASSWORD=change-me
.venv/bin/uvicorn app.main:app --port 8010
# obtain a token:
curl -X POST http://localhost:8010/api/auth/token \
  -H 'Content-Type: application/json' -d '{"password":"change-me"}'
# use it (HTTP and WebSocket):
curl -H 'Authorization: Bearer <token>' http://localhost:8010/api/profiles
# ws://localhost:8010/api/profile/live?target=example.com&token=<token>
```

## Verification

### Backend

```bash
cd backend
.venv/bin/python -m pytest -q

export DB_DRIVER=sqlite DB_PATH=/tmp/kensei-verify.db
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8010 &
curl -s localhost:8010/api/health
curl -s localhost:8010/api/profiles
curl -s "localhost:8010/api/profiles/compare?ids=1,2"
curl -s "localhost:8010/api/profiles/trends?domain=example.com"
kill %1
```

### Frontend

```bash
cd frontend
npm ci
npm run build       # production build into dist/kensei-web
npm test            # Vitest unit tests (ng test --watch=false)
```

Open http://localhost:4210, choose **Profiler**, enter a target and press SCAN.

## Cleanup

```bash
./clean.sh
```

Kills leftover processes, stops compose services, removes `.venv`, Python caches, `node_modules`, `dist` and `.angular`. `package-lock.json` is preserved.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Frontend cannot reach the API | Backend not running on `:8010`; start it first (`./kensei.sh local backend`) |
| WebSocket closes with code 1008 | `KENSEI_JWT_SECRET` is set — pass `?token=<jwt>` or unset the variable |
| `429` responses | Rate limit hit (120/min); `/api/health` is exempt. Raise `KENSEI_RATE_LIMIT_MAX` if needed |
| `sourcemap`/`redis`/`celery` install errors | Stale environment from an old `requirements.txt`; run `./clean.sh` and reinstall |
| Angular CLI version mismatch | Node below 20 — use Node 24 via mise (`export PATH="$HOME/.local/share/mise/installs/node/24/bin:$PATH"`) |
| `xwa-sdk` install fails | Local sibling missing and GitHub unreachable; the backend keeps working with the fallback event envelope |
