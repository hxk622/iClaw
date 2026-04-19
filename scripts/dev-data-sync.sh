#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SYNC_PORT="${DATA_SYNC_SERVICE_PORT:-2140}"
LOG_DIR="${ICLAW_LOG_DIR:-$ROOT_DIR/logs/data-sync-service}"
LOG_FILE="${ICLAW_DATA_SYNC_LOG:-$LOG_DIR/data-sync-service-$(date +%Y%m%d-%H%M%S).log}"
LATEST_LOG="$LOG_DIR/latest.log"
DATA_SYNC_DETACH="${DATA_SYNC_SERVICE_DETACH:-1}"
DATA_SYNC_SCRIPT="${DATA_SYNC_SERVICE_SCRIPT:-start}"
HEALTH_RETRIES="${DATA_SYNC_SERVICE_HEALTH_RETRIES:-240}"

stop_existing_data_sync() {
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti ":$SYNC_PORT" || true)"
  fi
  if [[ -n "$pids" ]]; then
    echo "[data-sync-dev] 关闭已存在 data-sync-service (:$SYNC_PORT): $pids"
    kill $pids >/dev/null 2>&1 || true
    sleep 0.4
  fi
}

start_detached() {
  mkdir -p "$LOG_DIR"
  ln -sfn "$LOG_FILE" "$LATEST_LOG"
  echo "[data-sync-dev] 启动 data-sync-service :$SYNC_PORT"
  (
    cd "$ROOT_DIR"
    PORT="$SYNC_PORT" nohup pnpm --filter @iclaw/data-sync-service "$DATA_SYNC_SCRIPT" >"$LOG_FILE" 2>&1 &
    echo $! > /tmp/iclaw-data-sync.pid
  )
  local pid
  pid="$(cat /tmp/iclaw-data-sync.pid)"
  rm -f /tmp/iclaw-data-sync.pid

  local ok=""
  for ((attempt = 1; attempt <= HEALTH_RETRIES; attempt += 1)); do
    if env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u all_proxy -u ALL_PROXY \
      curl -sS "http://127.0.0.1:$SYNC_PORT/health" >/dev/null 2>&1; then
      ok="1"
      break
    fi
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done

  if [[ -z "$ok" ]]; then
    echo "[data-sync-dev] data-sync-service 健康检查失败: http://127.0.0.1:$SYNC_PORT/health" >&2
    echo "[data-sync-dev] Check logs: $LOG_FILE" >&2
    exit 1
  fi

  echo "[data-sync-dev] data-sync-service 已就绪 PID=$pid (log: $LOG_FILE)"
  echo "[data-sync-dev] 最新日志软链: $LATEST_LOG"
}

start_foreground() {
  echo "[data-sync-dev] 启动 data-sync-service :$SYNC_PORT (foreground)"
  echo "[data-sync-dev] Ctrl+C 将停止 data-sync-service"
  cd "$ROOT_DIR"
  exec env PORT="$SYNC_PORT" pnpm --filter @iclaw/data-sync-service "$DATA_SYNC_SCRIPT"
}

stop_existing_data_sync
if [[ "$DATA_SYNC_DETACH" == "1" ]]; then
  start_detached
else
  start_foreground
fi
