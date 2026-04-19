#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-dev}"

if [[ "$MODE" == "dev" ]]; then
  echo "Starting admin-web in dev mode (Vite)..."
  cd "$ROOT_DIR"
  exec pnpm dev:admin
fi

if [[ "$MODE" == "prod" ]]; then
  : "${ICLAW_NGINX_HOST:=113.44.132.75}"
  : "${ICLAW_NGINX_USER:=root}"
  : "${ICLAW_ADMIN_NGINX_PATH:=/var/www/caiclaw/admin}"

  cd "$ROOT_DIR"
  pnpm build:admin

  if grep -R -E -n 'http://127\.0\.0\.1:2130|http://localhost:2130|http://0\.0\.0\.0:2130' "$ROOT_DIR/admin-web/dist" >/dev/null 2>&1; then
    echo "[deploy-admin] Refusing to deploy admin-web: built assets still reference a local auth base URL." >&2
    echo "[deploy-admin] Rebuild with prod env via: pnpm build:admin" >&2
    exit 1
  fi

  echo "Deploying admin-web/dist -> ${ICLAW_NGINX_USER}@${ICLAW_NGINX_HOST}:${ICLAW_ADMIN_NGINX_PATH}"
  ssh "${ICLAW_NGINX_USER}@${ICLAW_NGINX_HOST}" "mkdir -p ${ICLAW_ADMIN_NGINX_PATH}"
  rsync -avz --delete "$ROOT_DIR/admin-web/dist/" "${ICLAW_NGINX_USER}@${ICLAW_NGINX_HOST}:${ICLAW_ADMIN_NGINX_PATH}/"
  node "$ROOT_DIR/scripts/verify-prod-deploy.mjs" --component admin-web --brand "${APP_NAME:-caiclaw}" --channel prod
  echo "admin-web deployed to prod nginx"
  exit 0
fi

echo "Unknown mode: $MODE (use dev or prod)" >&2
exit 1
