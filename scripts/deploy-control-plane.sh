#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-prod}"

if [[ "$MODE" != "prod" ]]; then
  echo "Unknown mode: $MODE (use prod)" >&2
  exit 1
fi

: "${ICLAW_CONTROL_PLANE_HOST:=115.191.6.179}"
: "${ICLAW_CONTROL_PLANE_USER:=root}"
: "${ICLAW_CONTROL_PLANE_PATH:=/opt/iclaw}"
: "${ICLAW_CONTROL_PLANE_PM2_APP:=iclaw-control-plane}"

REMOTE="${ICLAW_CONTROL_PLANE_USER}@${ICLAW_CONTROL_PLANE_HOST}"
LOCAL_PROD_ENV_FILE="${ROOT_DIR}/.env.prod"

sync_path() {
  local source_path="$1"
  local remote_path="$2"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a "$source_path" "${REMOTE}:${remote_path}"
    return
  fi

  if [[ "$source_path" == */ ]]; then
    ssh "${REMOTE}" "mkdir -p '${remote_path}'"
    scp -r "${source_path%/}" "${REMOTE}:$(dirname "${remote_path%/}")/"
    return
  fi

  ssh "${REMOTE}" "mkdir -p '$(dirname "${remote_path}")'"
  scp "$source_path" "${REMOTE}:${remote_path}"
}

resolve_local_env_value() {
  local key="$1"
  if [[ ! -f "$LOCAL_PROD_ENV_FILE" ]]; then
    return 0
  fi
  grep -E "^${key}=" "$LOCAL_PROD_ENV_FILE" | tail -n 1 | sed "s/^${key}=//"
}

node "$ROOT_DIR/scripts/write-build-info.mjs" \
  --component control-plane \
  --package services/control-plane/package.json \
  --out services/control-plane/build-info.json

echo "Deploying control-plane source -> ${REMOTE}:${ICLAW_CONTROL_PLANE_PATH}/services/control-plane"

sync_path \
  "$ROOT_DIR/services/control-plane/assets/" \
  "${ICLAW_CONTROL_PLANE_PATH}/services/control-plane/assets/"

sync_path \
  "$ROOT_DIR/services/control-plane/src/" \
  "${ICLAW_CONTROL_PLANE_PATH}/services/control-plane/src/"

sync_path \
  "$ROOT_DIR/services/control-plane/scripts/" \
  "${ICLAW_CONTROL_PLANE_PATH}/services/control-plane/scripts/"

sync_path \
  "$ROOT_DIR/services/control-plane/sql/" \
  "${ICLAW_CONTROL_PLANE_PATH}/services/control-plane/sql/"

sync_path \
  "$ROOT_DIR/services/control-plane/build-info.json" \
  "${ICLAW_CONTROL_PLANE_PATH}/services/control-plane/build-info.json"

echo "Restarting PM2 app: ${ICLAW_CONTROL_PLANE_PM2_APP}"
ssh "${REMOTE}" "cd ${ICLAW_CONTROL_PLANE_PATH} && pm2 restart ${ICLAW_CONTROL_PLANE_PM2_APP}"

echo "Waiting for control-plane health on prod"
ssh "${REMOTE}" '
for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:2130/health >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done
echo "control-plane health check timed out after restart" >&2
exit 1
'

SOURCE_DATABASE_URL="$(resolve_local_env_value "ICLAW_PACKAGE_SOURCE_DATABASE_URL")"
if [[ -z "${SOURCE_DATABASE_URL}" ]]; then
  echo "ICLAW_PACKAGE_SOURCE_DATABASE_URL is required in local .env.prod for prod override sync" >&2
  exit 1
fi
SOURCE_INSTALL_SECRET_KEY="$(resolve_local_env_value "ICLAW_PACKAGE_SOURCE_INSTALL_SECRET_KEY")"
if [[ -z "${SOURCE_INSTALL_SECRET_KEY}" ]]; then
  SOURCE_INSTALL_SECRET_KEY="$(resolve_local_env_value "ICLAW_PACKAGE_SOURCE_S3_SECRET_KEY")"
fi
if [[ -z "${SOURCE_INSTALL_SECRET_KEY}" ]]; then
  echo "ICLAW_PACKAGE_SOURCE_INSTALL_SECRET_KEY or ICLAW_PACKAGE_SOURCE_S3_SECRET_KEY is required in local .env.prod for prod override sync" >&2
  exit 1
fi

echo "Syncing system overrides from source database into prod database"
ssh "${REMOTE}" "cd ${ICLAW_CONTROL_PLANE_PATH} && env ICLAW_PACKAGE_SOURCE_DATABASE_URL='${SOURCE_DATABASE_URL}' ICLAW_PACKAGE_SOURCE_INSTALL_SECRET_KEY='${SOURCE_INSTALL_SECRET_KEY}' node --experimental-strip-types services/control-plane/scripts/sync-system-overrides.ts"

echo "Verifying desktop CORS on prod"
curl -i -X OPTIONS \
  -H 'Origin: tauri://localhost' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,x-iclaw-app-name,x-iclaw-channel' \
  https://caiclaw.aiyuanxi.com/auth/login
