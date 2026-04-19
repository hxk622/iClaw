#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-dev}"

export ICLAW_PACKAGING_ENV="$MODE"
HOME_NGINX_PATH_DEFAULT="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" distribution.home.nginxPath | tail -n1)"

if [[ "$MODE" == "dev" ]]; then
  echo "Starting home-web in dev mode (Vite)..."
  cd "$ROOT_DIR"
  exec pnpm dev:home-web
fi

if [[ "$MODE" == "prod" ]]; then
  : "${ICLAW_NGINX_HOST:=113.44.132.75}"
  : "${ICLAW_NGINX_USER:=root}"
  : "${ICLAW_NGINX_PATH:=$HOME_NGINX_PATH_DEFAULT}"

  cd "$ROOT_DIR"
  ICLAW_USE_PACKAGING_SOURCE_ENV=1 pnpm build:home-web

  echo "Deploying home-web/dist -> ${ICLAW_NGINX_USER}@${ICLAW_NGINX_HOST}:${ICLAW_NGINX_PATH}"
  ssh "${ICLAW_NGINX_USER}@${ICLAW_NGINX_HOST}" "mkdir -p ${ICLAW_NGINX_PATH}"
  rsync -avz --delete "$ROOT_DIR/home-web/dist/" "${ICLAW_NGINX_USER}@${ICLAW_NGINX_HOST}:${ICLAW_NGINX_PATH}/"
  node "$ROOT_DIR/scripts/verify-prod-deploy.mjs" --component home-web --brand "${APP_NAME:-caiclaw}" --channel prod
  echo "home-web deployed to prod nginx"
  exit 0
fi

echo "Unknown mode: $MODE (use dev or prod)" >&2
exit 1
