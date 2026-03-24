#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${ICLAW_API_PORT:-2126}"
AUTH_PORT="${ICLAW_CONTROL_PLANE_PORT:-2130}"
WEB_PORT="${ICLAW_WEB_PORT:-1520}"
WEB_HOST="${ICLAW_WEB_HOST:-127.0.0.1}"
APP_NAME="${APP_NAME:-${ICLAW_PORTAL_APP_NAME:-${ICLAW_BRAND:-${ICLAW_APP_NAME:-}}}}"

read_env_value() {
  local key="$1"
  local env_file="$ROOT_DIR/.env"
  [[ -f "$env_file" ]] || return 0
  sed -n "s/^${key}=//p" "$env_file" | tail -n1
}

ENV_GATEWAY_TOKEN="$(read_env_value VITE_GATEWAY_TOKEN)"
ENV_APP_NAME="$(read_env_value APP_NAME)"
APP_NAME="${APP_NAME:-${ENV_APP_NAME:-}}"

if [[ -z "${APP_NAME:-}" ]]; then
  echo "[web-dev] APP_NAME is required. Set it in .env.dev or pass APP_NAME/ICLAW_PORTAL_APP_NAME." >&2
  exit 1
fi

stop_existing_web() {
  local pids=""
  pids="$(lsof -ti ":$WEB_PORT" || true)"
  if [[ -n "$pids" ]]; then
    echo "[web-dev] Closing existing frontend process (:$WEB_PORT): $pids"
    kill $pids >/dev/null 2>&1 || true
    sleep 0.4
  fi
}

stop_existing_web

echo "[web-dev] Preparing OEM app resources for $APP_NAME"
cd "$ROOT_DIR"
node scripts/apply-brand.mjs "$APP_NAME"
pnpm --filter @iclaw/control-plane sync:local-app-runtime -- --app "$APP_NAME"
node scripts/sync-openclaw-resources.mjs

echo "[web-dev] Starting frontend on $WEB_HOST:$WEB_PORT"
VITE_API_BASE_URL="http://127.0.0.1:$API_PORT" \
VITE_AUTH_BASE_URL="http://127.0.0.1:$AUTH_PORT" \
VITE_GATEWAY_TOKEN="${VITE_GATEWAY_TOKEN:-${ENV_GATEWAY_TOKEN:-iclaw-local-dev-gateway-token}}" \
ICLAW_PORTAL_APP_NAME="$APP_NAME" \
pnpm --filter @iclaw/desktop dev --host "$WEB_HOST" --port "$WEB_PORT" --strictPort
