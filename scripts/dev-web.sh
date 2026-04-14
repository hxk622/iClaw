#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/gateway-token.sh"
source "$ROOT_DIR/scripts/lib/env-files.sh"
API_PORT="${ICLAW_API_PORT:-2126}"
AUTH_PORT="${ICLAW_CONTROL_PLANE_PORT:-2130}"
WEB_PORT="${ICLAW_WEB_PORT:-1520}"
WEB_HOST="${ICLAW_WEB_HOST:-127.0.0.1}"
APP_NAME="${APP_NAME:-${ICLAW_PORTAL_APP_NAME:-${ICLAW_BRAND:-${ICLAW_APP_NAME:-}}}}"
OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
TARGET_ENV="$(normalize_iclaw_env_name "${ICLAW_ENV_NAME:-${NODE_ENV:-dev}}")"

warn_if_iclaw_env_mismatch "$ROOT_DIR" "APP_NAME" "$TARGET_ENV"
ENV_GATEWAY_TOKEN="$(read_iclaw_env_value "$ROOT_DIR" "VITE_GATEWAY_TOKEN" "$TARGET_ENV" || true)"
ENV_APP_NAME="$(read_iclaw_env_value "$ROOT_DIR" "APP_NAME" "$TARGET_ENV" || true)"
ENV_API_BASE_URL="$(read_iclaw_env_value "$ROOT_DIR" "VITE_API_BASE_URL" "$TARGET_ENV" || true)"
ENV_AUTH_BASE_URL="$(read_iclaw_env_value "$ROOT_DIR" "VITE_AUTH_BASE_URL" "$TARGET_ENV" || true)"
APP_NAME="${APP_NAME:-${ENV_APP_NAME:-}}"
GATEWAY_TOKEN_FILE="$(resolve_gateway_token_file)"

if [[ -z "${APP_NAME:-}" ]]; then
  echo "[web-dev] APP_NAME is required. Set it in .env.${TARGET_ENV} or pass APP_NAME/ICLAW_PORTAL_APP_NAME." >&2
  exit 1
fi

resolve_gateway_token "$ENV_GATEWAY_TOKEN" "$GATEWAY_TOKEN_FILE"
echo "[web-dev] gateway token source: $GATEWAY_TOKEN_SOURCE"

RESOLVED_API_BASE_URL="${VITE_API_BASE_URL:-${ENV_API_BASE_URL:-http://127.0.0.1:$API_PORT}}"
RESOLVED_AUTH_BASE_URL="${VITE_AUTH_BASE_URL:-${ENV_AUTH_BASE_URL:-http://127.0.0.1:$AUTH_PORT}}"

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
const stageMarkerPath = path.join(rootDir, '.build', 'desktop', expectedBrandId, 'current.json');
const stageMarker = JSON.parse(fs.readFileSync(stageMarkerPath, 'utf8'));
const generatedBrandPath = path.join(stageMarker.stageRoot, 'desktop', 'src-tauri', 'brand.generated.json');
const generatedBrandTsPath = path.join(stageMarker.stageRoot, 'desktop', 'src', 'app', 'lib', 'brand.generated.ts');
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

echo "[web-dev] Starting frontend on $WEB_HOST:$WEB_PORT"
echo "[web-dev] VITE_API_BASE_URL=$RESOLVED_API_BASE_URL"
echo "[web-dev] VITE_AUTH_BASE_URL=$RESOLVED_AUTH_BASE_URL"
VITE_API_BASE_URL="$RESOLVED_API_BASE_URL" \
VITE_AUTH_BASE_URL="$RESOLVED_AUTH_BASE_URL" \
VITE_GATEWAY_TOKEN="$GATEWAY_TOKEN" \
ICLAW_PORTAL_APP_NAME="$APP_NAME" \
pnpm --filter @iclaw/desktop dev --host "$WEB_HOST" --port "$WEB_PORT" --strictPort
