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

echo "Deploying control-plane source -> ${REMOTE}:${ICLAW_CONTROL_PLANE_PATH}/services/control-plane"

rsync -a \
  "$ROOT_DIR/services/control-plane/src/" \
  "${REMOTE}:${ICLAW_CONTROL_PLANE_PATH}/services/control-plane/src/"

rsync -a \
  "$ROOT_DIR/services/control-plane/scripts/" \
  "${REMOTE}:${ICLAW_CONTROL_PLANE_PATH}/services/control-plane/scripts/"

rsync -a \
  "$ROOT_DIR/services/control-plane/sql/" \
  "${REMOTE}:${ICLAW_CONTROL_PLANE_PATH}/services/control-plane/sql/"

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

echo "Verifying desktop CORS on prod"
curl -i -X OPTIONS \
  -H 'Origin: tauri://localhost' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,x-iclaw-app-name,x-iclaw-channel' \
  https://caiclaw.aiyuanxi.com/auth/login
