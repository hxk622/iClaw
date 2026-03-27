#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTROL_PORT="${ICLAW_CONTROL_PLANE_PORT:-2130}"
LOG_DIR="${ICLAW_LOG_DIR:-$ROOT_DIR/logs/control-plane}"
LOG_FILE="${ICLAW_CONTROL_PLANE_LOG:-$LOG_DIR/control-plane-$(date +%Y%m%d-%H%M%S).log}"
LATEST_LOG="$LOG_DIR/latest.log"
CONTROL_PLANE_DETACH="${ICLAW_CONTROL_PLANE_DETACH:-1}"
CONTROL_PLANE_SCRIPT="${ICLAW_CONTROL_PLANE_SCRIPT:-start}"
CONTROL_PLANE_HEALTH_RETRIES="${ICLAW_CONTROL_PLANE_HEALTH_RETRIES:-240}"

port_pids_with_netstat() {
  netstat.exe -ano 2>/dev/null | awk -v port=":$CONTROL_PORT" '
    index($2, port) && $4 == "LISTENING" { print $5 }
  ' | tr -d '\r' | sort -u
}

stop_existing_control_plane() {
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti ":$CONTROL_PORT" || true)"
  elif command -v netstat.exe >/dev/null 2>&1; then
    pids="$(port_pids_with_netstat || true)"
  fi
  if [[ -n "$pids" ]]; then
    echo "[control-plane-dev] 关闭已存在 control-plane (:$CONTROL_PORT): $pids"
    if command -v taskkill.exe >/dev/null 2>&1; then
      while IFS= read -r pid; do
        [[ -n "$pid" ]] || continue
        taskkill.exe //PID "$pid" //F >/dev/null 2>&1 || true
      done <<< "$pids"
    else
      kill $pids >/dev/null 2>&1 || true
    fi
    sleep 0.4
  fi
}

start_control_plane_detached() {
  mkdir -p "$LOG_DIR"
  ln -sfn "$LOG_FILE" "$LATEST_LOG"

  echo "[control-plane-dev] 启动 cloud control plane :$CONTROL_PORT"
  (
    cd "$ROOT_DIR"
    PORT="$CONTROL_PORT" nohup pnpm --filter @iclaw/control-plane "$CONTROL_PLANE_SCRIPT" >"$LOG_FILE" 2>&1 &
    echo $! > /tmp/iclaw-control-plane.pid
  )
  local pid
  pid="$(cat /tmp/iclaw-control-plane.pid)"
  rm -f /tmp/iclaw-control-plane.pid

  local ok=""
  for ((attempt = 1; attempt <= CONTROL_PLANE_HEALTH_RETRIES; attempt += 1)); do
    if env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u all_proxy -u ALL_PROXY \
      curl -sS "http://127.0.0.1:$CONTROL_PORT/health" >/dev/null 2>&1; then
      ok="1"
      break
    fi
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done

  if [[ -z "$ok" ]]; then
    echo "[control-plane-dev] control-plane 健康检查失败: http://127.0.0.1:$CONTROL_PORT/health" >&2
    echo "[control-plane-dev] Check logs: $LOG_FILE" >&2
    exit 1
  fi

  echo "[control-plane-dev] control-plane 已就绪 PID=$pid (log: $LOG_FILE)"
  echo "[control-plane-dev] 最新日志软链: $LATEST_LOG"
}

start_control_plane_foreground() {
  echo "[control-plane-dev] 启动 cloud control plane :$CONTROL_PORT (foreground)"
  echo "[control-plane-dev] Ctrl+C 将停止 control-plane"
  cd "$ROOT_DIR"
  exec env PORT="$CONTROL_PORT" pnpm --filter @iclaw/control-plane "$CONTROL_PLANE_SCRIPT"
}

stop_existing_control_plane
if [[ "$CONTROL_PLANE_DETACH" == "1" ]]; then
  start_control_plane_detached
else
  start_control_plane_foreground
fi
