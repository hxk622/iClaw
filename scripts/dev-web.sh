#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/gateway-token.sh"
API_PORT="${ICLAW_API_PORT:-2126}"
AUTH_PORT="${ICLAW_CONTROL_PLANE_PORT:-2130}"
WEB_PORT="${ICLAW_WEB_PORT:-1520}"
WEB_HOST="${ICLAW_WEB_HOST:-127.0.0.1}"
APP_NAME="${APP_NAME:-${ICLAW_PORTAL_APP_NAME:-${ICLAW_BRAND:-${ICLAW_APP_NAME:-}}}}"
OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"

read_env_value() {
  local key="$1"
  local env_file="$ROOT_DIR/.env"
  [[ -f "$env_file" ]] || return 0
  sed -n "s/^${key}=//p" "$env_file" | tail -n1
}

ENV_GATEWAY_TOKEN="$(read_env_value VITE_GATEWAY_TOKEN)"
ENV_APP_NAME="$(read_env_value APP_NAME)"
APP_NAME="${APP_NAME:-${ENV_APP_NAME:-}}"
GATEWAY_TOKEN_FILE="$(resolve_gateway_token_file)"

if [[ -z "${APP_NAME:-}" ]]; then
  echo "[web-dev] APP_NAME is required. Set it in .env.dev or pass APP_NAME/ICLAW_PORTAL_APP_NAME." >&2
  exit 1
fi

resolve_gateway_token "$ENV_GATEWAY_TOKEN" "$GATEWAY_TOKEN_FILE"
echo "[web-dev] gateway token source: $GATEWAY_TOKEN_SOURCE"

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
APP_NAME="$APP_NAME" node - <<'EOF'
const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const expectedBrandId = String(process.env.APP_NAME || process.env.ICLAW_PORTAL_APP_NAME || '').trim();
const generatedBrandPath = path.join(rootDir, 'apps', 'desktop', 'src-tauri', 'brand.generated.json');
const generatedBrandTsPath = path.join(rootDir, 'apps', 'desktop', 'src', 'app', 'lib', 'brand.generated.ts');
const generatedBrand = JSON.parse(fs.readFileSync(generatedBrandPath, 'utf8'));
const actualBrandId = String(generatedBrand.brandId || '').trim();
const generatedBrandTs = fs.readFileSync(generatedBrandTsPath, 'utf8');
const actualBrandTsId = String(/"brandId":\s*"([^"]+)"/.exec(generatedBrandTs)?.[1] || '').trim();

if (!expectedBrandId) {
  throw new Error('APP_NAME is required to validate generated brand files');
}

if (actualBrandId !== expectedBrandId) {
  throw new Error(`brand generation mismatch: expected ${expectedBrandId}, got ${actualBrandId}`);
}

if (actualBrandTsId !== expectedBrandId) {
  throw new Error(`brand ts generation mismatch: expected ${expectedBrandId}, got ${actualBrandTsId || 'unknown'}`);
}

process.stdout.write(`[web-dev] Verified generated brand: ${actualBrandId}\n`);
EOF
pnpm --filter @iclaw/control-plane sync:local-app-runtime -- --app "$APP_NAME"
node scripts/sync-openclaw-resources.mjs

echo "[web-dev] Starting frontend on $WEB_HOST:$WEB_PORT"
VITE_API_BASE_URL="http://127.0.0.1:$API_PORT" \
VITE_AUTH_BASE_URL="http://127.0.0.1:$AUTH_PORT" \
VITE_GATEWAY_TOKEN="$GATEWAY_TOKEN" \
ICLAW_PORTAL_APP_NAME="$APP_NAME" \
pnpm --filter @iclaw/desktop dev --host "$WEB_HOST" --port "$WEB_PORT" --strictPort
