#!/usr/bin/env bash
# Kensei launcher — local (SQLite, default) or docker (Postgres via Compose).
set -euo pipefail

# Prefer the mise-managed Node 24 LTS for Angular tooling (system Node may be unsupported)
if [ -d "$HOME/.local/share/mise/installs/node/24/bin" ]; then
    case ":$PATH:" in
        *":$HOME/.local/share/mise/installs/node/24/bin:"*) ;;
        *) export PATH="$HOME/.local/share/mise/installs/node/24/bin:$PATH" ;;
    esac
fi

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKEND_PORT=8010
FRONTEND_PORT=4210
BACKEND_PID=""
FRONTEND_PID=""
COMPOSE=""

find_compose() {
    if docker compose version &>/dev/null; then
        COMPOSE="docker compose"; return 0
    fi
    if command -v docker-compose &>/dev/null; then
        COMPOSE="docker-compose"; return 0
    fi
    echo -e "${RED}[!] Docker Compose not found. Install Docker, or use './kensei.sh local'.${NC}"
    return 1
}

usage() {
    cat <<EOF
Usage: ./kensei.sh [local|docker] [all|backend|frontend]

Modes:
  local    Native processes with SQLite (DEFAULT — zero infra)
  docker   Full stack with Docker Compose (PostgreSQL)

Legacy flags (aliases for local):
  --sqlite, --native, --native-no-infra, --fast

Examples:
  ./kensei.sh                 # local backend + frontend on :${BACKEND_PORT}/${FRONTEND_PORT}
  ./kensei.sh local backend   # backend only
  ./kensei.sh docker          # docker compose (PostgreSQL)
EOF
    exit 1
}

ensure_node() {
    if [ -x "$HOME/.local/share/mise/installs/node/24/bin/node" ]; then
        export PATH="$HOME/.local/share/mise/installs/node/24/bin:$PATH"
    fi
    if ! command -v node &>/dev/null; then
        echo -e "${RED}[!] Node.js not found. Install Node 24 (mise) and retry.${NC}"
        return 1
    fi
    local major
    major="$(node -p 'process.versions.node.split(".")[0]')"
    if [ "$major" -lt 20 ]; then
        echo -e "${RED}[!] Node $major found; Angular requires Node 20+. Use mise Node 24.${NC}"
        return 1
    fi
}

ensure_env() {
    echo -e "${CYAN}[+] Setting up Python environment...${NC}"
    if [ ! -d "$ROOT_DIR/backend/.venv" ]; then
        if [ -x "$HOME/.local/bin/uv" ]; then
            "$HOME/.local/bin/uv" venv --python 3.13 --seed "$ROOT_DIR/backend/.venv"
        else
            python3 -m venv "$ROOT_DIR/backend/.venv"
        fi
    fi

    local pip="$ROOT_DIR/backend/.venv/bin/pip"
    if [ ! -x "$pip" ]; then
        "$ROOT_DIR/backend/.venv/bin/python" -m ensurepip --upgrade &>/dev/null || true
    fi
    if ! "$pip" install --quiet -r "$ROOT_DIR/backend/requirements.txt"; then
        echo -e "${YELLOW}[~] requirements.txt failed; installing a minimal fallback set.${NC}"
        "$pip" install --quiet fastapi uvicorn SQLAlchemy pydantic httpx PyJWT jsonschema
    fi

    # xwa-sdk: local editable checkout first, documented git fallback otherwise.
    local sdk="$ROOT_DIR/../xwa-sdk/bindings/python"
    if [ -d "$sdk" ]; then
        echo -e "${CYAN}[+] Installing local xwa-sdk ($sdk)...${NC}"
        "$pip" install --quiet -e "$sdk"
    else
        echo -e "${YELLOW}[~] Local xwa-sdk not found; falling back to git.${NC}"
        "$pip" install --quiet \
            "xwa-sdk @ git+https://github.com/xwebanalysis/xwa-sdk.git#subdirectory=bindings/python" \
            || echo -e "${YELLOW}[!] xwa-sdk unavailable; backend keeps a compatible fallback envelope.${NC}"
    fi
}

wait_for_health() {
    if ! command -v curl &>/dev/null; then return 0; fi
    local url="http://localhost:${BACKEND_PORT}/api/health"
    echo -n -e "${CYAN}[~] Waiting for backend health at ${url}...${NC}"
    for _ in $(seq 1 45); do
        if curl -fsS "$url" &>/dev/null; then
            echo -e " ${GREEN}ready${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    echo -e " ${YELLOW}timeout (backend may still be starting)${NC}"
    return 0
}

run_backend_local() {
    ensure_env
    cd "$ROOT_DIR/backend"
    export DB_DRIVER=sqlite
    export DB_PATH="${DB_PATH:-$ROOT_DIR/kensei.db}"
    echo -e "${CYAN}[+] Starting backend on :${BACKEND_PORT} (SQLite: $DB_PATH)...${NC}"
    "$ROOT_DIR/backend/.venv/bin/uvicorn" app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" &
    BACKEND_PID=$!
    wait_for_health
}

run_frontend_local() {
    ensure_node
    cd "$ROOT_DIR/frontend"
    if [ ! -d node_modules ]; then
        echo -e "${CYAN}[+] Installing npm dependencies...${NC}"
        npm install
    fi
    echo -e "${CYAN}[+] Starting frontend on :${FRONTEND_PORT}...${NC}"
    npm start &
    FRONTEND_PID=$!
}

cleanup() {
    echo -e "\n${RED}[!] Shutting down...${NC}"
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
    wait 2>/dev/null || true
    echo -e "${GREEN}[+] Done.${NC}"
    exit 0
}

MODE="${1:-local}"
SERVICE="${2:-all}"

case "$MODE" in
    local|--sqlite|--native|--native-no-infra|--fast) MODE="local" ;;
    docker|--docker) MODE="docker" ;;
    -h|--help) usage ;;
    *) echo -e "${RED}[!] Unknown mode: $MODE${NC}"; usage ;;
esac

case "$SERVICE" in
    all|backend|frontend) ;;
    *) echo -e "${RED}[!] Unknown service: $SERVICE${NC}"; usage ;;
esac

if [ "$MODE" = "docker" ]; then
    find_compose
    echo -e "${CYAN}[+] Starting Kensei with Docker Compose (PostgreSQL)...${NC}"
    case "$SERVICE" in
        all) "$COMPOSE" -f "$ROOT_DIR/docker-compose.yml" up --build ;;
        backend) "$COMPOSE" -f "$ROOT_DIR/docker-compose.yml" up --build backend ;;
        frontend) "$COMPOSE" -f "$ROOT_DIR/docker-compose.yml" up --build frontend ;;
    esac
    exit $?
fi

echo -e "${CYAN}[+] Starting Kensei locally (SQLite, zero infra)...${NC}"
trap cleanup SIGINT SIGTERM

case "$SERVICE" in
    backend)
        run_backend_local
        wait
        ;;
    frontend)
        run_frontend_local
        wait
        ;;
    all)
        run_backend_local
        run_frontend_local
        echo ""
        echo -e "${GREEN}[+] Kensei is running:${NC}"
        echo -e "    Frontend:  ${CYAN}http://localhost:${FRONTEND_PORT}${NC}"
        echo -e "    Backend:   ${CYAN}http://localhost:${BACKEND_PORT}${NC}"
        echo -e "    API docs:  ${CYAN}http://localhost:${BACKEND_PORT}/docs${NC}"
        echo -e "    Press ${RED}Ctrl+C${NC} to stop."
        echo ""
        wait
        ;;
esac
