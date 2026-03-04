#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${ICLAW_API_PORT:-2126}"
OPENCLAW_BIN="${OPENCLAW_BINARY_PATH:-$ROOT_DIR/services/openclaw/bin/openclaw}"
LOG_DIR="${ICLAW_LOG_DIR:-$ROOT_DIR/logs/openclaw}"
LOG_FILE="${ICLAW_OPENCLAW_LOG:-$LOG_DIR/openclaw-$(date +%Y%m%d-%H%M%S).log}"
LATEST_LOG="$LOG_DIR/latest.log"

ensure_sidecar_bin() {
  if [[ -x "$OPENCLAW_BIN" ]]; then
    return 0
  fi

  echo "[api-dev] 后端二进制缺失，正在准备..."
  (cd "$ROOT_DIR" && bash scripts/build-openclaw.sh)

  if [[ ! -x "$OPENCLAW_BIN" ]]; then
    echo "[api-dev] 后端二进制不可用: $OPENCLAW_BIN" >&2
    exit 1
  fi
}

ensure_macos_codesign_if_needed() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    return 0
  fi

  if codesign --verify --deep --strict --verbose=1 "$OPENCLAW_BIN" >/dev/null 2>&1; then
    return 0
  fi

  echo "[api-dev] 检测到 openclaw 签名无效，执行本地 ad-hoc 重签名..."
  codesign --force --sign - "$OPENCLAW_BIN"
}

stop_existing_api() {
  local pids=""
  pids="$(lsof -ti ":$API_PORT" || true)"
  if [[ -n "$pids" ]]; then
    echo "[api-dev] 关闭已存在后端进程 (:$API_PORT): $pids"
    kill $pids >/dev/null 2>&1 || true
    sleep 0.4
  fi
}

start_openclaw() {
  mkdir -p "$LOG_DIR"
  ln -sfn "$LOG_FILE" "$LATEST_LOG"

  echo "[api-dev] 启动后端服务 :$API_PORT"
  OPENCLAW_LOG_DIR="$LOG_DIR" nohup "$OPENCLAW_BIN" --port "$API_PORT" >"$LOG_FILE" 2>&1 &
  local pid=$!

  local ok=""
  for _ in {1..40}; do
    if curl -fsS "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1; then
      ok="1"
      break
    fi
    sleep 0.25
  done

  if [[ -z "$ok" ]]; then
    echo "[api-dev] 后端健康检查失败: http://127.0.0.1:$API_PORT/health" >&2
    echo "[api-dev] Check logs: $LOG_FILE" >&2
    exit 1
  fi

  echo "[api-dev] 后端已就绪 PID=$pid (log: $LOG_FILE)"
  echo "[api-dev] 最新日志软链: $LATEST_LOG"
  echo "[api-dev] Tail logs: tail -f $LATEST_LOG"
}

ensure_sidecar_bin
ensure_macos_codesign_if_needed
bash "$ROOT_DIR/scripts/prepare-openclaw-workspace.sh"
stop_existing_api
start_openclaw
