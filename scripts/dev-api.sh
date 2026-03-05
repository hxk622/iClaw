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

find_cached_release_zip() {
  find "$ROOT_DIR/.cache/openclaw-release" -type f -name 'OpenClaw-*.zip' 2>/dev/null | sort | tail -n1
}

ensure_macos_runtime_frameworks() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    return 0
  fi

  if ! otool -L "$OPENCLAW_BIN" 2>/dev/null | grep -q '@rpath/Sparkle.framework/Versions/B/Sparkle'; then
    return 0
  fi

  local openclaw_dir
  openclaw_dir="$(cd "$(dirname "$OPENCLAW_BIN")" && pwd)"
  local frameworks_dir="$openclaw_dir/../Frameworks"
  local sparkle_bin="$frameworks_dir/Sparkle.framework/Versions/B/Sparkle"

  if [[ -f "$sparkle_bin" ]]; then
    return 0
  fi

  local release_zip
  release_zip="$(find_cached_release_zip || true)"
  if [[ -z "$release_zip" ]]; then
    echo "[api-dev] 未找到本地 OpenClaw release 缓存，尝试下载..."
    OPENCLAW_BINARY_PATH="/__missing_openclaw_binary__" bash "$ROOT_DIR/scripts/build-openclaw.sh" >/dev/null
    release_zip="$(find_cached_release_zip || true)"
  fi

  if [[ -z "$release_zip" ]]; then
    echo "[api-dev] 无法准备 Sparkle.framework（未找到 OpenClaw release zip）" >&2
    exit 1
  fi

  echo "[api-dev] 补齐运行时依赖 Sparkle.framework"
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  unzip -q "$release_zip" -d "$tmp_dir"

  local src_framework
  src_framework="$(find "$tmp_dir" -type d -path '*/OpenClaw.app/Contents/Frameworks/Sparkle.framework' | head -n1)"
  if [[ -z "$src_framework" || ! -d "$src_framework" ]]; then
    rm -rf "$tmp_dir"
    echo "[api-dev] OpenClaw release 中未找到 Sparkle.framework" >&2
    exit 1
  fi

  mkdir -p "$frameworks_dir"
  rm -rf "$frameworks_dir/Sparkle.framework"
  cp -R "$src_framework" "$frameworks_dir/"
  rm -rf "$tmp_dir"
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
    if grep -q "bundleProxyForCurrentProcess is nil" "$LOG_FILE" 2>/dev/null; then
      echo "[api-dev] 检测到 OpenClaw 二进制在无 App Bundle 场景下崩溃（NSInternalInconsistencyException）。" >&2
      echo "[api-dev] 当前 $OPENCLAW_BIN 更像 GUI App 主程序，不适合作为 headless API sidecar 直接 nohup 启动。" >&2
      echo "[api-dev] 请提供可独立运行 API 的 OpenClaw binary，并通过 OPENCLAW_BINARY_PATH 指定路径。" >&2
    fi
    echo "[api-dev] 后端健康检查失败: http://127.0.0.1:$API_PORT/health" >&2
    echo "[api-dev] Check logs: $LOG_FILE" >&2
    exit 1
  fi

  echo "[api-dev] 后端已就绪 PID=$pid (log: $LOG_FILE)"
  echo "[api-dev] 最新日志软链: $LATEST_LOG"
  echo "[api-dev] Tail logs: tail -f $LATEST_LOG"
}

ensure_sidecar_bin
ensure_macos_runtime_frameworks
ensure_macos_codesign_if_needed
bash "$ROOT_DIR/scripts/prepare-openclaw-workspace.sh"
stop_existing_api
start_openclaw
