#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/gateway-token.sh"
source "$ROOT_DIR/scripts/lib/openclaw-package.sh"
source "$ROOT_DIR/scripts/lib/env-files.sh"
API_PORT="${ICLAW_API_PORT:-2126}"
API_DETACH="${ICLAW_API_DETACH:-0}"
LOG_DIR="${ICLAW_LOG_DIR:-$ROOT_DIR/logs/openclaw}"
LOG_FILE="${ICLAW_OPENCLAW_LOG:-$LOG_DIR/openclaw-$(date +%Y%m%d-%H%M%S).log}"
LATEST_LOG="$LOG_DIR/latest.log"
RUNTIME_CONFIG_PATH="${ICLAW_RUNTIME_CONFIG_PATH:-$ROOT_DIR/services/openclaw/resources/config/runtime-config.json}"
EXTRA_CA_CERTS_PATH="${ICLAW_EXTRA_CA_CERTS_PATH:-$ROOT_DIR/services/openclaw/resources/certs/isrg-root-x1.pem}"
OPENCLAW_VERBOSE="${ICLAW_OPENCLAW_VERBOSE:-1}"
OPENCLAW_WS_LOG_STYLE="${ICLAW_OPENCLAW_WS_LOG:-compact}"
OPENCLAW_RAW_STREAM="${ICLAW_OPENCLAW_RAW_STREAM:-0}"
HEALTHCHECK_ATTEMPTS="${ICLAW_API_HEALTHCHECK_ATTEMPTS:-80}"
HEALTHCHECK_INTERVAL_SECONDS="${ICLAW_API_HEALTHCHECK_INTERVAL_SECONDS:-0.25}"
TARGET_ENV="$(normalize_iclaw_env_name "${ICLAW_ENV_NAME:-${NODE_ENV:-dev}}")"
PORTAL_APP_NAME=""
PORTAL_APP_SOURCE=""

if [[ -n "${APP_NAME:-}" ]]; then
  PORTAL_APP_NAME="${APP_NAME}"
  PORTAL_APP_SOURCE="env"
elif [[ -n "${ICLAW_PORTAL_APP_NAME:-}" ]]; then
  PORTAL_APP_NAME="${ICLAW_PORTAL_APP_NAME}"
  PORTAL_APP_SOURCE="env"
fi

if [[ $# -gt 0 ]]; then
  if [[ "${1:-}" == "--app" ]]; then
    PORTAL_APP_NAME="${2:-}"
    PORTAL_APP_SOURCE="arg"
    shift 2 || true
  elif [[ "${1:-}" != --* ]]; then
    PORTAL_APP_NAME="$1"
    PORTAL_APP_SOURCE="arg"
    shift || true
  fi
fi

read_runtime_config_value() {
  local key="$1"
  [[ -f "$RUNTIME_CONFIG_PATH" ]] || return 0
  node -e '
const fs = require("fs");
const [configPath, key] = process.argv.slice(1);
try {
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const value = parsed && typeof parsed === "object" ? parsed[key] : undefined;
  if (typeof value === "string") process.stdout.write(value);
} catch {}
' "$RUNTIME_CONFIG_PATH" "$key"
}

read_generated_brand_id() {
  local generated_brand_path="$ROOT_DIR/apps/desktop/src-tauri/brand.generated.json"
  [[ -f "$generated_brand_path" ]] || return 0
  node -e '
const fs = require("fs");
const targetPath = process.argv[1];
try {
  const parsed = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  const value = typeof parsed?.brandId === "string" ? parsed.brandId.trim() : "";
  if (value) process.stdout.write(value);
} catch {}
' "$generated_brand_path"
}

normalize_app_state_key() {
  local raw="$1"
  local normalized
  normalized="$(
    printf '%s' "$raw" \
      | tr '[:upper:]' '[:lower:]' \
      | tr -cs 'a-z0-9._-' '-'
  )"
  normalized="${normalized#-}"
  normalized="${normalized%-}"
  if [[ -z "$normalized" ]]; then
    normalized="default"
  fi
  printf '%s\n' "$normalized"
}

warn_if_iclaw_env_mismatch "$ROOT_DIR" "APP_NAME" "$TARGET_ENV"
ENV_GATEWAY_TOKEN="$(read_iclaw_env_value "$ROOT_DIR" "VITE_GATEWAY_TOKEN" "$TARGET_ENV" || true)"
ENV_APP_NAME="$(read_iclaw_env_value "$ROOT_DIR" "APP_NAME" "$TARGET_ENV" || true)"
if [[ -z "${PORTAL_APP_NAME:-}" && -n "${ENV_APP_NAME:-}" ]]; then
  PORTAL_APP_NAME="${ENV_APP_NAME}"
  PORTAL_APP_SOURCE="env-file"
fi
GENERATED_BRAND_ID="$(read_generated_brand_id)"
if [[ -n "${GENERATED_BRAND_ID:-}" ]]; then
  if [[ -z "${PORTAL_APP_NAME:-}" ]]; then
    PORTAL_APP_NAME="${GENERATED_BRAND_ID}"
    PORTAL_APP_SOURCE="generated-brand"
  elif [[ "$PORTAL_APP_NAME" != "$GENERATED_BRAND_ID" ]]; then
    if [[ "$PORTAL_APP_SOURCE" == "arg" ]]; then
      echo "[api-dev] 检测到显式 --app=${PORTAL_APP_NAME}，与当前生成品牌 ${GENERATED_BRAND_ID} 不一致，按显式参数继续。"
    else
      echo "[api-dev] 检测到当前生成品牌为 ${GENERATED_BRAND_ID}，但环境解析得到的 app 为 ${PORTAL_APP_NAME}。"
      echo "[api-dev] 为避免前端品牌与 OpenClaw runtime 品牌错配，dev:api 将跟随当前生成品牌。"
      PORTAL_APP_NAME="${GENERATED_BRAND_ID}"
      PORTAL_APP_SOURCE="generated-brand"
    fi
  fi
fi
OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
OPENCLAW_APP_STATE_KEY="$(normalize_app_state_key "${PORTAL_APP_NAME:-default}")"
OPENCLAW_APP_STATE_ROOT="${OPENCLAW_APP_STATE_ROOT:-$OPENCLAW_STATE_DIR/apps/$OPENCLAW_APP_STATE_KEY}"
OPENCLAW_WORKSPACE_DIR="${OPENCLAW_WORKSPACE_DIR:-$OPENCLAW_APP_STATE_ROOT/workspace}"
OPENCLAW_CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-$OPENCLAW_APP_STATE_ROOT/openclaw.json}"
PORTAL_RUNTIME_CONFIG_PATH="${ICLAW_PORTAL_RUNTIME_CONFIG_PATH:-$OPENCLAW_APP_STATE_ROOT/portal-app-runtime.json}"
PORTAL_MCP_CONFIG_PATH="${ICLAW_PORTAL_MCP_CONFIG_PATH:-$OPENCLAW_APP_STATE_ROOT/mcp.json}"
GATEWAY_TOKEN_FILE="$(resolve_gateway_token_file)"
RUNTIME_ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-$(read_runtime_config_value anthropic_api_key)}"

detect_target_triple() {
  rustc -vV 2>/dev/null | sed -n 's/^host: //p'
}

resolve_openclaw_bin() {
  if [[ -n "${OPENCLAW_BINARY_PATH:-}" ]]; then
    echo "$OPENCLAW_BINARY_PATH"
    return 0
  fi

  local local_openclaw_server_bin="$ROOT_DIR/services/openclaw/bin/openclaw-server"
  if [[ -x "$local_openclaw_server_bin" ]]; then
    echo "$local_openclaw_server_bin"
    return 0
  fi

  echo "$local_openclaw_server_bin"
}

OPENCLAW_BIN="$(resolve_openclaw_bin)"
OPENCLAW_CLI_BIN="$ROOT_DIR/services/openclaw/bin/openclaw"
OPENCLAW_RUNTIME_NODE_DIR="$ROOT_DIR/services/openclaw/runtime/node"

is_mock_sidecar_bin() {
  local bin_path="$1"
  [[ -f "$bin_path" ]] || return 1
  if command -v rg >/dev/null 2>&1; then
    rg -q 'mock-openclaw|mock":true' "$bin_path"
    return $?
  fi

  grep -E -q 'mock-openclaw|mock":true' "$bin_path"
}

ensure_sidecar_bin() {
  echo "[api-dev] 使用后端二进制: $OPENCLAW_BIN"

  if [[ -x "$OPENCLAW_BIN" ]] && [[ -x "$OPENCLAW_CLI_BIN" ]] && ! is_mock_sidecar_bin "$OPENCLAW_BIN"; then
    return 0
  fi

  if [[ -x "$OPENCLAW_BIN" ]] && is_mock_sidecar_bin "$OPENCLAW_BIN"; then
    echo "[api-dev] 检测到 mock openclaw-server，切换为真实 runtime..."
  elif [[ -x "$OPENCLAW_BIN" ]] && [[ ! -x "$OPENCLAW_CLI_BIN" ]]; then
    echo "[api-dev] 检测到 openclaw CLI launcher 缺失，重新准备 server runtime..."
  else
    echo "[api-dev] 后端二进制缺失，正在准备真实 runtime..."
  fi

  (cd "$ROOT_DIR" && bash scripts/build-openclaw-server-runtime.sh)

  if [[ ! -x "$OPENCLAW_BIN" ]] || [[ ! -x "$OPENCLAW_CLI_BIN" ]] || is_mock_sidecar_bin "$OPENCLAW_BIN"; then
    echo "[api-dev] 后端二进制不可用: $OPENCLAW_BIN" >&2
    echo "[api-dev] openclaw CLI launcher: $OPENCLAW_CLI_BIN" >&2
    echo "[api-dev] 请设置 OPENCLAW_PACKAGE_TGZ=/abs/path/to/openclaw.tgz，或在 openclaw-runtime.json / ICLAW_OPENCLAW_RUNTIME_VERSION 中提供版本。" >&2
    exit 1
  fi
}

ensure_runtime_ui_patches() {
  local runtime_dir="$ROOT_DIR/services/openclaw/runtime/openclaw"
  [[ -d "$runtime_dir/dist" ]] || return 0
  openclaw_patch_package_runtime_openai_usage "$runtime_dir"
  openclaw_patch_package_runtime_control_ui_tool_output "$runtime_dir"
}

ensure_macos_codesign_if_needed() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    return 0
  fi

  if ! file "$OPENCLAW_BIN" 2>/dev/null | grep -qi "Mach-O"; then
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

sync_gateway_token_config() {
  mkdir -p "$(dirname "$OPENCLAW_CONFIG_PATH")"
  ICLAW_OPENCLAW_CONFIG_PATH="$OPENCLAW_CONFIG_PATH" \
  ICLAW_OPENCLAW_RUNTIME_CONFIG_PATH="$RUNTIME_CONFIG_PATH" \
  ICLAW_OPENCLAW_GATEWAY_TOKEN="$GATEWAY_TOKEN" \
  ICLAW_OPENCLAW_PORTAL_RUNTIME_CONFIG_PATH="$PORTAL_RUNTIME_CONFIG_PATH" \
  ICLAW_OPENCLAW_WORKSPACE_DIR="$OPENCLAW_WORKSPACE_DIR" \
  ICLAW_OPENCLAW_RUNTIME_MODE="dev" \
  ICLAW_OPENCLAW_ALLOWED_ORIGINS="http://127.0.0.1:1520,http://localhost:1520" \
  node "$ROOT_DIR/apps/desktop/src-tauri/resources/runtime/generate-openclaw-config.mjs"

  echo "[api-dev] gateway token synced to $OPENCLAW_CONFIG_PATH"
}

stop_existing_api() {
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti ":$API_PORT" || true)"
  elif command -v powershell.exe >/dev/null 2>&1; then
    pids="$(
      powershell.exe -NoProfile -NonInteractive -Command '
        $pids = Get-NetTCPConnection -LocalPort '"$API_PORT"' -State Listen -ErrorAction SilentlyContinue |
          Select-Object -ExpandProperty OwningProcess -Unique
        if ($pids) { ($pids | ForEach-Object { [string]$_ }) -join " " }
      ' \
        | tr -d '\r' \
        || true
    )"
  elif command -v netstat >/dev/null 2>&1; then
    pids="$(
      netstat -ano 2>/dev/null \
        | awk -v port=":$API_PORT" '$2 ~ port"$" && $4 == "LISTENING" {print $5}' \
        | sort -u \
        | tr '\n' ' ' \
        || true
    )"
  else
    echo "[api-dev] 未找到 lsof / powershell / netstat，跳过端口占用进程回收。"
  fi
  if [[ -n "$pids" ]]; then
    echo "[api-dev] 关闭已存在后端进程 (:$API_PORT): $pids"
    if command -v taskkill.exe >/dev/null 2>&1; then
      for pid in $pids; do
        taskkill.exe //PID "$pid" //F >/dev/null 2>&1 || true
      done
    else
      kill $pids >/dev/null 2>&1 || true
    fi
    sleep 0.4
  fi
}

prepare_log_output() {
  mkdir -p "$LOG_DIR"
  if ! ln -sfn "$LOG_FILE" "$LATEST_LOG" 2>/dev/null; then
    LATEST_LOG="$LOG_FILE"
  fi
}

wait_for_health() {
  local pid="$1"
  local tolerate_pid_exit="${2:-0}"
  local ok=""
  local health_http=""
  local health_body=""

  local attempt=0
  while [[ "$attempt" -lt "$HEALTHCHECK_ATTEMPTS" ]]; do
    attempt=$((attempt + 1))
    health_http="$(env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u all_proxy -u ALL_PROXY \
      curl -sS -o /tmp/iclaw-dev-api-health-body.$$ -w '%{http_code}' "http://127.0.0.1:$API_PORT/health" 2>/dev/null || true)"
    health_body="$(cat /tmp/iclaw-dev-api-health-body.$$ 2>/dev/null || true)"
    rm -f /tmp/iclaw-dev-api-health-body.$$ >/dev/null 2>&1 || true

    if [[ "$health_http" =~ ^2[0-9][0-9]$ ]]; then
      ok="1"
      break
    fi
    if [[ "$health_http" == "503" ]] && echo "$health_body" | grep -q "Control UI assets not found"; then
      ok="1"
      break
    fi
    if [[ "$tolerate_pid_exit" != "1" ]] && ! kill -0 "$pid" >/dev/null 2>&1; then
      break
    fi
    sleep "$HEALTHCHECK_INTERVAL_SECONDS"
  done

  if [[ -z "$ok" ]]; then
    if grep -q "bundleProxyForCurrentProcess is nil" "$LOG_FILE" 2>/dev/null; then
      echo "[api-dev] 检测到 OpenClaw 二进制在无 App Bundle 场景下崩溃（NSInternalInconsistencyException）。" >&2
      echo "[api-dev] 当前 $OPENCLAW_BIN 更像 GUI App 主程序，不适合作为 headless API sidecar 直接 nohup 启动。" >&2
      echo "[api-dev] 请提供可独立运行 API 的 OpenClaw binary，并通过 OPENCLAW_BINARY_PATH 指定路径。" >&2
    fi
    if [[ -n "$health_http" ]]; then
      echo "[api-dev] /health 响应状态: $health_http" >&2
    fi
    if [[ -n "$health_body" ]]; then
      echo "[api-dev] /health 响应内容: $health_body" >&2
    fi
    echo "[api-dev] 后端健康检查失败: http://127.0.0.1:$API_PORT/health" >&2
    echo "[api-dev] Check logs: $LOG_FILE" >&2
    return 1
  fi
}

start_openclaw_detached() {
  prepare_log_output
  local -a openclaw_args=("--port" "$API_PORT")
  if [[ "$OPENCLAW_VERBOSE" == "1" ]]; then
    openclaw_args+=("--verbose")
    if [[ "$OPENCLAW_WS_LOG_STYLE" == "compact" || "$OPENCLAW_WS_LOG_STYLE" == "full" || "$OPENCLAW_WS_LOG_STYLE" == "auto" ]]; then
      openclaw_args+=("--ws-log" "$OPENCLAW_WS_LOG_STYLE")
    fi
  fi
  if [[ "$OPENCLAW_RAW_STREAM" == "1" ]]; then
    openclaw_args+=("--raw-stream")
  fi

  echo "[api-dev] 启动后端服务 :$API_PORT"
  echo "[api-dev] gateway tracing: verbose=$OPENCLAW_VERBOSE ws-log=$OPENCLAW_WS_LOG_STYLE raw-stream=$OPENCLAW_RAW_STREAM"
  local spawn_command="$OPENCLAW_BIN"
  local spawn_uses_bash="0"
  if [[ "$OPENCLAW_BIN" != *.exe ]] && [[ "$OPENCLAW_BIN" != *.cmd ]] && [[ "$OPENCLAW_BIN" != *.bat ]]; then
    spawn_command="$(command -v bash)"
    spawn_uses_bash="1"
  fi
  local pid
  pid="$(
    PATH="$ROOT_DIR/services/openclaw/bin:$OPENCLAW_RUNTIME_NODE_DIR${PATH:+:$PATH}" \
    OPENCLAW_LOG_DIR="$LOG_DIR" \
    OPENCLAW_GATEWAY_TOKEN="$GATEWAY_TOKEN" \
    OPENCLAW_CONFIG_PATH="$OPENCLAW_CONFIG_PATH" \
    OPENCLAW_WORKSPACE_DIR="$OPENCLAW_WORKSPACE_DIR" \
    ANTHROPIC_API_KEY="$RUNTIME_ANTHROPIC_API_KEY" \
    ICLAW_OPENCLAW_CLI_PATH="$OPENCLAW_CLI_BIN" \
    NODE_EXTRA_CA_CERTS="$EXTRA_CA_CERTS_PATH" \
    PORT="$API_PORT" \
    OPENCLAW_BIN_PATH="$OPENCLAW_BIN" \
    OPENCLAW_DETACHED_COMMAND="$spawn_command" \
    OPENCLAW_LOG_FILE="$LOG_FILE" \
    OPENCLAW_SPAWN_USE_BASH="$spawn_uses_bash" \
    OPENCLAW_ARGS_JSON="$(printf '%s\n' "${openclaw_args[@]}" | node -e 'const fs=require("fs"); const args=fs.readFileSync(0, "utf8").split(/\n/).filter(Boolean); process.stdout.write(JSON.stringify(args));')" \
    node <<'EOF'
const fs = require('fs');
const { spawn } = require('child_process');

const originalCmd = process.env.OPENCLAW_BIN_PATH;
const cmd = process.env.OPENCLAW_DETACHED_COMMAND || originalCmd;
const logFile = process.env.OPENCLAW_LOG_FILE;
const usesBash = process.env.OPENCLAW_SPAWN_USE_BASH === '1';
const runtimeArgs = JSON.parse(process.env.OPENCLAW_ARGS_JSON || '[]');
const args = usesBash ? [originalCmd, ...runtimeArgs] : runtimeArgs;

if (!cmd || !originalCmd || !logFile) {
  process.stderr.write('[api-dev] detached spawn missing command or log path\n');
  process.exit(1);
}

const out = fs.openSync(logFile, 'a');
const child = spawn(cmd, args, {
  detached: true,
  stdio: ['ignore', out, out],
  env: process.env,
});

child.unref();
process.stdout.write(String(child.pid));
EOF
  )"
  if [[ -z "$pid" ]]; then
    echo "[api-dev] detached spawn failed: empty pid" >&2
    return 1
  fi

  wait_for_health "$pid" 1

  echo "[api-dev] 后端已就绪 PID=$pid (log: $LOG_FILE)"
  echo "[api-dev] 最新日志软链: $LATEST_LOG"
  echo "[api-dev] Tail logs: tail -f $LATEST_LOG"
}

start_openclaw_foreground() {
  prepare_log_output
  local -a openclaw_args=("--port" "$API_PORT")
  if [[ "$OPENCLAW_VERBOSE" == "1" ]]; then
    openclaw_args+=("--verbose")
    if [[ "$OPENCLAW_WS_LOG_STYLE" == "compact" || "$OPENCLAW_WS_LOG_STYLE" == "full" || "$OPENCLAW_WS_LOG_STYLE" == "auto" ]]; then
      openclaw_args+=("--ws-log" "$OPENCLAW_WS_LOG_STYLE")
    fi
  fi
  if [[ "$OPENCLAW_RAW_STREAM" == "1" ]]; then
    openclaw_args+=("--raw-stream")
  fi

  local pipe_dir
  local pipe_path
  pipe_dir="$(mktemp -d /tmp/iclaw-dev-api.XXXXXX)"
  pipe_path="$pipe_dir/output.pipe"
  mkfifo "$pipe_path"

  local tee_pid=""
  local pid=""
  cleanup_foreground() {
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" 2>/dev/null || true
    fi
    if [[ -n "${tee_pid:-}" ]] && kill -0 "$tee_pid" >/dev/null 2>&1; then
      kill "$tee_pid" >/dev/null 2>&1 || true
      wait "$tee_pid" 2>/dev/null || true
    fi
    rm -f "$pipe_path"
    rmdir "$pipe_dir" >/dev/null 2>&1 || true
  }
  trap cleanup_foreground EXIT INT TERM

  tee "$LOG_FILE" <"$pipe_path" &
  tee_pid=$!

  echo "[api-dev] 启动后端服务 :$API_PORT (foreground)"
  echo "[api-dev] gateway tracing: verbose=$OPENCLAW_VERBOSE ws-log=$OPENCLAW_WS_LOG_STYLE raw-stream=$OPENCLAW_RAW_STREAM"
  PATH="$ROOT_DIR/services/openclaw/bin:$OPENCLAW_RUNTIME_NODE_DIR${PATH:+:$PATH}" \
  OPENCLAW_LOG_DIR="$LOG_DIR" \
  OPENCLAW_GATEWAY_TOKEN="$GATEWAY_TOKEN" \
  OPENCLAW_CONFIG_PATH="$OPENCLAW_CONFIG_PATH" \
  OPENCLAW_WORKSPACE_DIR="$OPENCLAW_WORKSPACE_DIR" \
  ANTHROPIC_API_KEY="$RUNTIME_ANTHROPIC_API_KEY" \
  ICLAW_OPENCLAW_CLI_PATH="$OPENCLAW_CLI_BIN" \
  NODE_EXTRA_CA_CERTS="$EXTRA_CA_CERTS_PATH" \
  PORT="$API_PORT" \
  "$OPENCLAW_BIN" "${openclaw_args[@]}" >"$pipe_path" 2>&1 &
  pid=$!

  wait_for_health "$pid"

  echo "[api-dev] 后端已就绪 PID=$pid (log: $LOG_FILE)"
  echo "[api-dev] 最新日志软链: $LATEST_LOG"
  echo "[api-dev] Ctrl+C 将停止后端服务"

  local wait_status=0
  wait "$pid" || wait_status=$?
  trap - EXIT INT TERM
  cleanup_foreground
  return "$wait_status"
}

ensure_sidecar_bin
ensure_runtime_ui_patches
ensure_macos_runtime_frameworks
ensure_macos_codesign_if_needed
if [[ -n "${PORTAL_APP_NAME:-}" ]]; then
  echo "[api-dev] 同步 portal app 本地运行资源: ${PORTAL_APP_NAME} (source: ${PORTAL_APP_SOURCE:-unknown})"
  echo "[api-dev] app runtime state root: $OPENCLAW_APP_STATE_ROOT"
  export ICLAW_OPENCLAW_WORKSPACE_DIR="$OPENCLAW_WORKSPACE_DIR"
  export ICLAW_RUNTIME_APP_CONFIG_PATH="$PORTAL_RUNTIME_CONFIG_PATH"
  export ICLAW_RUNTIME_MCP_CONFIG_PATH="$PORTAL_MCP_CONFIG_PATH"
  node --experimental-strip-types "$ROOT_DIR/services/control-plane/scripts/sync-local-app-runtime.ts" --app "$PORTAL_APP_NAME"
fi
OPENCLAW_WORKSPACE_DIR="$OPENCLAW_WORKSPACE_DIR" bash "$ROOT_DIR/scripts/prepare-openclaw-workspace.sh"
resolve_gateway_token "$ENV_GATEWAY_TOKEN" "$GATEWAY_TOKEN_FILE"
echo "[api-dev] gateway token source: $GATEWAY_TOKEN_SOURCE"
sync_gateway_token_config
stop_existing_api
if [[ "$API_DETACH" == "1" ]]; then
  start_openclaw_detached
else
  start_openclaw_foreground
fi
