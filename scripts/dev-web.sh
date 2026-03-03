#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${ICLAW_API_PORT:-2026}"
WEB_PORT="${ICLAW_WEB_PORT:-1420}"
OPENCLAW_BIN="${OPENCLAW_BINARY_PATH:-$ROOT_DIR/services/openclaw/bin/openclaw}"
LOG_FILE="${ICLAW_OPENCLAW_LOG:-/tmp/iclaw-openclaw.log}"

ensure_sidecar_bin() {
  if [[ -x "$OPENCLAW_BIN" ]]; then
    return 0
  fi

  echo "[web-dev] OpenClaw binary missing, preparing sidecar..."
  (cd "$ROOT_DIR" && bash scripts/build-openclaw.sh)

  if [[ ! -x "$OPENCLAW_BIN" ]]; then
    echo "[web-dev] OpenClaw binary not found: $OPENCLAW_BIN" >&2
    exit 1
  fi
}

start_openclaw_if_needed() {
  if lsof -ti ":$API_PORT" >/dev/null 2>&1; then
    echo "[web-dev] Port $API_PORT already in use, reusing existing service"
    return 0
  fi

  echo "[web-dev] Starting OpenClaw on :$API_PORT"
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
    echo "[web-dev] OpenClaw health check failed: http://127.0.0.1:$API_PORT/health" >&2
    echo "[web-dev] Check logs: $LOG_FILE" >&2
    exit 1
  fi

  echo "[web-dev] OpenClaw ready (log: $LOG_FILE)"
}

ensure_sidecar_bin
start_openclaw_if_needed

echo "[web-dev] Starting frontend on :$WEB_PORT"
cd "$ROOT_DIR"
VITE_API_BASE_URL="http://127.0.0.1:$API_PORT" pnpm --filter @iclaw/desktop dev --host 0.0.0.0 --port "$WEB_PORT"
