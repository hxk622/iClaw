#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BOOTSTRAP_SQL="$ROOT_DIR/services/control-plane/sql/000_bootstrap.sql"
SCHEMA_SQL="$ROOT_DIR/services/control-plane/sql/001_init.sql"

DATABASE_URL_INPUT="${DATABASE_URL:-}"
PARSED_DB_HOST=""
PARSED_DB_PORT=""
PARSED_APP_DB=""
PARSED_APP_USER=""
PARSED_APP_PASSWORD=""

if [[ -n "$DATABASE_URL_INPUT" ]]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "[init-control-plane-db] node is required to parse DATABASE_URL" >&2
    exit 1
  fi

  while IFS='=' read -r key value; do
    case "$key" in
      DB_HOST) PARSED_DB_HOST="$value" ;;
      DB_PORT) PARSED_DB_PORT="$value" ;;
      APP_DB) PARSED_APP_DB="$value" ;;
      APP_USER) PARSED_APP_USER="$value" ;;
      APP_PASSWORD) PARSED_APP_PASSWORD="$value" ;;
    esac
  done < <(
    node - <<'NODE' "$DATABASE_URL_INPUT"
const raw = process.argv[2] || '';
const url = new URL(raw);
const decode = (value) => decodeURIComponent(String(value || ''));
const appDb = decode((url.pathname || '').replace(/^\/+/, ''));
if (!appDb) {
  throw new Error('DATABASE_URL must include a database name');
}
console.log(`DB_HOST=${url.hostname || '127.0.0.1'}`);
console.log(`DB_PORT=${url.port || '5432'}`);
console.log(`APP_DB=${appDb}`);
console.log(`APP_USER=${decode(url.username)}`);
console.log(`APP_PASSWORD=${decode(url.password)}`);
NODE
  )
fi

DB_HOST="${ICLAW_CONTROL_DB_HOST:-${PARSED_DB_HOST:-127.0.0.1}}"
DB_PORT="${ICLAW_CONTROL_DB_PORT:-${PARSED_DB_PORT:-5432}}"
DB_SUPERUSER="${ICLAW_CONTROL_DB_SUPERUSER:-${USER:-postgres}}"
DB_ADMIN_DB="${ICLAW_CONTROL_DB_ADMIN_DB:-postgres}"
APP_DB="${ICLAW_CONTROL_DB_NAME:-${PARSED_APP_DB:-iclaw_control}}"
APP_USER="${ICLAW_CONTROL_DB_USER:-${PARSED_APP_USER:-iclaw_app}}"
APP_PASSWORD="${ICLAW_CONTROL_DB_PASSWORD:-${PARSED_APP_PASSWORD:-change_me}}"
PSQL_BIN="${ICLAW_PSQL_BIN:-}"
SKIP_BOOTSTRAP="${ICLAW_CONTROL_DB_SKIP_BOOTSTRAP:-}"

if [[ -n "$DATABASE_URL_INPUT" && -z "${ICLAW_CONTROL_DB_SUPERUSER:-}" && -z "$SKIP_BOOTSTRAP" ]]; then
  SKIP_BOOTSTRAP="1"
fi

if [[ -n "$PSQL_BIN" && -d "$PSQL_BIN" ]]; then
  PSQL_BIN="$PSQL_BIN/psql"
fi

if [[ -z "$PSQL_BIN" ]]; then
  if command -v psql >/dev/null 2>&1; then
    PSQL_BIN="$(command -v psql)"
  elif [[ -x "/opt/homebrew/opt/postgresql@16/bin/psql" ]]; then
    PSQL_BIN="/opt/homebrew/opt/postgresql@16/bin/psql"
  elif [[ -x "/opt/homebrew/Cellar/postgresql@16/16.9/bin/psql" ]]; then
    PSQL_BIN="/opt/homebrew/Cellar/postgresql@16/16.9/bin/psql"
  fi
fi

if [[ -z "$PSQL_BIN" ]]; then
  echo "[init-control-plane-db] psql not found" >&2
  exit 1
fi

if [[ "$SKIP_BOOTSTRAP" == "1" ]]; then
  echo "[init-control-plane-db] skip bootstrap; applying schema directly to ${APP_USER}@${DB_HOST}:${DB_PORT}/${APP_DB}"
else
  echo "[init-control-plane-db] bootstrap role/database on ${DB_HOST}:${DB_PORT}"
  PGPASSWORD="${PGPASSWORD:-}" \
  "$PSQL_BIN" \
    -v ON_ERROR_STOP=1 \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_SUPERUSER" \
    -d "$DB_ADMIN_DB" \
    -v iclaw_db="$APP_DB" \
    -v iclaw_user="$APP_USER" \
    -v iclaw_password="$APP_PASSWORD" \
    -f "$BOOTSTRAP_SQL"
fi

echo "[init-control-plane-db] apply schema to ${APP_DB}"
PGPASSWORD="$APP_PASSWORD" \
"$PSQL_BIN" \
  -v ON_ERROR_STOP=1 \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$APP_USER" \
  -d "$APP_DB" \
  -f "$SCHEMA_SQL"

echo "[init-control-plane-db] done"
