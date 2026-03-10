#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BOOTSTRAP_SQL="$ROOT_DIR/services/control-plane/sql/000_bootstrap.sql"
SCHEMA_SQL="$ROOT_DIR/services/control-plane/sql/001_init.sql"

DB_HOST="${ICLAW_CONTROL_DB_HOST:-127.0.0.1}"
DB_PORT="${ICLAW_CONTROL_DB_PORT:-5432}"
DB_SUPERUSER="${ICLAW_CONTROL_DB_SUPERUSER:-${USER:-postgres}}"
DB_ADMIN_DB="${ICLAW_CONTROL_DB_ADMIN_DB:-postgres}"
APP_DB="${ICLAW_CONTROL_DB_NAME:-iclaw_control}"
APP_USER="${ICLAW_CONTROL_DB_USER:-iclaw_app}"
APP_PASSWORD="${ICLAW_CONTROL_DB_PASSWORD:-change_me}"
PSQL_BIN="${ICLAW_PSQL_BIN:-}"

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
