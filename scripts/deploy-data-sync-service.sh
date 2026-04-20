#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-prod}"

if [[ "$MODE" != "prod" ]]; then
  echo "Unknown mode: $MODE (use prod)" >&2
  exit 1
fi

: "${ICLAW_DATA_SYNC_USER:=root}"
: "${ICLAW_DATA_SYNC_PATH:=/opt/iclaw}"
: "${ICLAW_DATA_SYNC_PM2_APP:=iclaw-data-sync-service}"
: "${ICLAW_DATA_SYNC_INSTALL_DEPS:=1}"
: "${ICLAW_DATA_SYNC_HEALTH_TIMEOUT_SECONDS:=90}"
: "${ICLAW_DATA_SYNC_PORT:=2140}"

resolve_required_host() {
  local host="${ICLAW_DATA_SYNC_HOST:-${ICLAW_PROD_APP_HOST:-}}"
  host="$(printf '%s' "$host" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  if [[ -z "$host" ]]; then
    echo "Missing required host: set ICLAW_DATA_SYNC_HOST or ICLAW_PROD_APP_HOST" >&2
    exit 1
  fi
  printf '%s' "$host"
}

ICLAW_DATA_SYNC_HOST="$(resolve_required_host)"
REMOTE="${ICLAW_DATA_SYNC_USER}@${ICLAW_DATA_SYNC_HOST}"

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

echo "Deploying data-sync-service source -> ${REMOTE}:${ICLAW_DATA_SYNC_PATH}/services/data-sync-service"

sync_path "$ROOT_DIR/package.json" "${ICLAW_DATA_SYNC_PATH}/package.json"
sync_path "$ROOT_DIR/pnpm-lock.yaml" "${ICLAW_DATA_SYNC_PATH}/pnpm-lock.yaml"
sync_path "$ROOT_DIR/pnpm-workspace.yaml" "${ICLAW_DATA_SYNC_PATH}/pnpm-workspace.yaml"
sync_path "$ROOT_DIR/packages/shared/package.json" "${ICLAW_DATA_SYNC_PATH}/packages/shared/package.json"
sync_path "$ROOT_DIR/packages/market-sync-core/package.json" "${ICLAW_DATA_SYNC_PATH}/packages/market-sync-core/package.json"
sync_path "$ROOT_DIR/services/control-plane/package.json" "${ICLAW_DATA_SYNC_PATH}/services/control-plane/package.json"
sync_path "$ROOT_DIR/services/data-sync-service/package.json" "${ICLAW_DATA_SYNC_PATH}/services/data-sync-service/package.json"
sync_path "$ROOT_DIR/packages/shared/src/" "${ICLAW_DATA_SYNC_PATH}/packages/shared/src/"
sync_path "$ROOT_DIR/packages/market-sync-core/src/" "${ICLAW_DATA_SYNC_PATH}/packages/market-sync-core/src/"
sync_path "$ROOT_DIR/services/control-plane/src/" "${ICLAW_DATA_SYNC_PATH}/services/control-plane/src/"
sync_path "$ROOT_DIR/services/control-plane/sql/" "${ICLAW_DATA_SYNC_PATH}/services/control-plane/sql/"
sync_path "$ROOT_DIR/services/control-plane/scripts/" "${ICLAW_DATA_SYNC_PATH}/services/control-plane/scripts/"
sync_path "$ROOT_DIR/services/data-sync-service/src/" "${ICLAW_DATA_SYNC_PATH}/services/data-sync-service/src/"

if [[ "$ICLAW_DATA_SYNC_INSTALL_DEPS" == "1" ]]; then
  echo "Installing workspace dependencies on remote host"
  ssh "${REMOTE}" "cd ${ICLAW_DATA_SYNC_PATH} && pnpm install --frozen-lockfile --ignore-scripts"
else
  echo "Skipping remote pnpm install because ICLAW_DATA_SYNC_INSTALL_DEPS=${ICLAW_DATA_SYNC_INSTALL_DEPS}"
fi

echo "Restarting PM2 app: ${ICLAW_DATA_SYNC_PM2_APP}"
ssh "${REMOTE}" "cd ${ICLAW_DATA_SYNC_PATH} && pm2 restart ${ICLAW_DATA_SYNC_PM2_APP}"

echo "Waiting for data-sync-service health on prod"
ssh "${REMOTE}" '
timeout_seconds='"${ICLAW_DATA_SYNC_HEALTH_TIMEOUT_SECONDS}"'
port='"${ICLAW_DATA_SYNC_PORT}"'
for _ in $(seq 1 "$timeout_seconds"); do
  if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done
echo "data-sync-service health check timed out after restart" >&2
echo "==== PM2 STATUS ====" >&2
pm2 status '"${ICLAW_DATA_SYNC_PM2_APP}"' >&2 || true
echo "==== PORT ${port} ====" >&2
ss -ltnp | grep "${port}" >&2 || true
echo "==== LAST ERROR LOGS ====" >&2
tail -n 120 ~/.pm2/logs/'"${ICLAW_DATA_SYNC_PM2_APP}"'-error.log >&2 || true
echo "==== LAST OUT LOGS ====" >&2
tail -n 120 ~/.pm2/logs/'"${ICLAW_DATA_SYNC_PM2_APP}"'-out.log >&2 || true
exit 1
'
