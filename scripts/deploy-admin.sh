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

  echo "Deploying admin-web/dist -> ${ICLAW_NGINX_USER}@${ICLAW_NGINX_HOST}:${ICLAW_ADMIN_NGINX_PATH}"
  ssh "${ICLAW_NGINX_USER}@${ICLAW_NGINX_HOST}" "mkdir -p ${ICLAW_ADMIN_NGINX_PATH}"
  rsync -avz --delete "$ROOT_DIR/admin-web/dist/" "${ICLAW_NGINX_USER}@${ICLAW_NGINX_HOST}:${ICLAW_ADMIN_NGINX_PATH}/"
  echo "admin-web deployed to prod nginx"
  exit 0
fi

echo "Unknown mode: $MODE (use dev or prod)" >&2
exit 1
