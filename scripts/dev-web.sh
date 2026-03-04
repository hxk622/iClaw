#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${ICLAW_API_PORT:-2126}"
WEB_PORT="${ICLAW_WEB_PORT:-1520}"
OPENCLAW_BIN="${OPENCLAW_BINARY_PATH:-$ROOT_DIR/services/openclaw/bin/openclaw}"
LOG_DIR="${ICLAW_LOG_DIR:-$ROOT_DIR/logs/openclaw}"
LOG_FILE="${ICLAW_OPENCLAW_LOG:-$LOG_DIR/openclaw-$(date +%Y%m%d-%H%M%S).log}"
LATEST_LOG="$LOG_DIR/latest.log"

ensure_sidecar_bin() {
  if [[ -x "$OPENCLAW_BIN" ]]; then
    return 0
  fi

  echo "[web-dev] 后端二进制缺失，正在准备..."
  (cd "$ROOT_DIR" && bash scripts/build-openclaw.sh)

  if [[ ! -x "$OPENCLAW_BIN" ]]; then
    echo "[web-dev] 后端二进制不可用: $OPENCLAW_BIN" >&2
    exit 1
  fi
}

start_openclaw_if_needed() {
  if lsof -ti ":$API_PORT" >/dev/null 2>&1; then
    echo "[web-dev] 复用已存在后端服务 (:$API_PORT)"
    return 0
  fi

  mkdir -p "$LOG_DIR"
  ln -sfn "$LOG_FILE" "$LATEST_LOG"

  echo "[web-dev] 启动后端服务 :$API_PORT"
  nohup "$OPENCLAW_BIN" --port "$API_PORT" >"$LOG_FILE" 2>&1 &

  local ok=""
  for _ in {1..40}; do
    if curl -fsS "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1; then
      ok="1"
      break
    fi
    sleep 0.25
  done

  if [[ -z "$ok" ]]; then
    echo "[web-dev] 后端健康检查失败: http://127.0.0.1:$API_PORT/health" >&2
    echo "[web-dev] Check logs: $LOG_FILE" >&2
    exit 1
  fi

  echo "[web-dev] 后端已就绪 (log: $LOG_FILE)"
  echo "[web-dev] 最新日志软链: $LATEST_LOG"
}

ensure_sidecar_bin
start_openclaw_if_needed

echo "[web-dev] Starting frontend on :$WEB_PORT"
cd "$ROOT_DIR"
VITE_API_BASE_URL="http://127.0.0.1:$API_PORT" pnpm --filter @iclaw/desktop dev --host 0.0.0.0 --port "$WEB_PORT"
