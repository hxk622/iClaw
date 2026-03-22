#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
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
PORTAL_APP_NAME="${ICLAW_PORTAL_APP_NAME:-}"

if [[ $# -gt 0 ]]; then
  if [[ "${1:-}" == "--app" ]]; then
    PORTAL_APP_NAME="${2:-}"
    shift 2 || true
  elif [[ "${1:-}" != --* ]]; then
    PORTAL_APP_NAME="$1"
    shift || true
  fi
fi

read_env_value() {
  local key="$1"
  local env_file="$ROOT_DIR/.env"
  [[ -f "$env_file" ]] || return 0
  sed -n "s/^${key}=//p" "$env_file" | tail -n1
}

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

ENV_GATEWAY_TOKEN="$(read_env_value VITE_GATEWAY_TOKEN)"
GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-${ENV_GATEWAY_TOKEN:-iclaw-local-dev-gateway-token}}"
OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
OPENCLAW_CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-$OPENCLAW_STATE_DIR/openclaw.json}"
RUNTIME_OPENAI_API_KEY="${OPENAI_API_KEY:-$(read_runtime_config_value openai_api_key)}"
RUNTIME_OPENAI_BASE_URL="${OPENAI_BASE_URL:-${OPENAI_API_BASE:-$(read_runtime_config_value openai_base_url)}}"
RUNTIME_OPENAI_MODEL="${OPENAI_MODEL:-$(read_runtime_config_value openai_model)}"
RUNTIME_ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-$(read_runtime_config_value anthropic_api_key)}"

normalize_openai_base_url() {
  local base_url="${1:-}"
  base_url="${base_url%"${base_url##*[![:space:]]}"}"
  base_url="${base_url#"${base_url%%[![:space:]]*}"}"
  base_url="${base_url%/}"
  if [[ -z "$base_url" ]]; then
    return 0
  fi
  if [[ "$base_url" == */v1 ]]; then
    printf '%s' "$base_url"
  else
    printf '%s/v1' "$base_url"
  fi
}

RUNTIME_OPENAI_BASE_URL="$(normalize_openai_base_url "$RUNTIME_OPENAI_BASE_URL")"

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

is_mock_sidecar_bin() {
  local bin_path="$1"
  [[ -f "$bin_path" ]] || return 1
  rg -q "mock-openclaw|mock\":true" "$bin_path"
}

ensure_sidecar_bin() {
  echo "[api-dev] 使用后端二进制: $OPENCLAW_BIN"

  if [[ -x "$OPENCLAW_BIN" ]] && ! is_mock_sidecar_bin "$OPENCLAW_BIN"; then
    return 0
  fi

  if [[ -x "$OPENCLAW_BIN" ]] && is_mock_sidecar_bin "$OPENCLAW_BIN"; then
    echo "[api-dev] 检测到 mock openclaw-server，切换为真实 runtime..."
  else
    echo "[api-dev] 后端二进制缺失，正在准备真实 runtime..."
  fi

  (cd "$ROOT_DIR" && bash scripts/build-openclaw-server-runtime.sh)

  if [[ ! -x "$OPENCLAW_BIN" ]] || is_mock_sidecar_bin "$OPENCLAW_BIN"; then
    echo "[api-dev] 后端二进制不可用: $OPENCLAW_BIN" >&2
    echo "[api-dev] 请设置 OPENCLAW_PACKAGE_TGZ=/abs/path/to/openclaw.tgz，或在 openclaw-runtime.json / ICLAW_OPENCLAW_RUNTIME_VERSION 中提供版本。" >&2
    exit 1
  fi
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

  OPENCLAW_CONFIG_PATH="$OPENCLAW_CONFIG_PATH" \
  OPENCLAW_SYNC_GATEWAY_TOKEN="$GATEWAY_TOKEN" \
  OPENCLAW_SYNC_OPENAI_MODEL="$RUNTIME_OPENAI_MODEL" \
  OPENCLAW_SYNC_OPENAI_BASE_URL="$RUNTIME_OPENAI_BASE_URL" \
  OPENCLAW_SYNC_OPENAI_API_KEY="$RUNTIME_OPENAI_API_KEY" \
  OPENCLAW_SYNC_WORKSPACE_DIR="$OPENCLAW_STATE_DIR/workspace" \
  node <<'EOF'
const fs = require('fs');

const configPath = process.env.OPENCLAW_CONFIG_PATH;
const nextToken = (process.env.OPENCLAW_SYNC_GATEWAY_TOKEN || '').trim();
const rawOpenAiModel = (process.env.OPENCLAW_SYNC_OPENAI_MODEL || '').trim();
const rawOpenAiBaseUrl = (process.env.OPENCLAW_SYNC_OPENAI_BASE_URL || '').trim();
const rawOpenAiApiKey = (process.env.OPENCLAW_SYNC_OPENAI_API_KEY || '').trim();
const rawWorkspaceDir = (process.env.OPENCLAW_SYNC_WORKSPACE_DIR || '').trim();
if (!configPath || !nextToken) process.exit(0);

let config = {};
try {
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (error) {
  console.error(`[api-dev] failed to parse ${configPath}: ${String(error)}`);
  process.exit(1);
}

if (!config || typeof config !== 'object' || Array.isArray(config)) {
  config = {};
}

function ensureObject(parent, key) {
  const current = parent[key];
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    parent[key] = {};
  }
  return parent[key];
}

function upsertManagedOpenAiModel(models, modelId) {
  if (!modelId) return models;
  const index = models.findIndex((entry) => entry && typeof entry === 'object' && entry.id === modelId);
  const base = index >= 0 && models[index] && typeof models[index] === 'object' ? models[index] : {};
  const next = {
    ...base,
    id: modelId,
    name: modelId === 'gpt-5.4' ? 'GPT 5.4' : (base.name || modelId),
    reasoning: true,
    input: ['text', 'image'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 272000,
    maxTokens: 128000,
  };
  if (index >= 0) {
    models[index] = next;
  } else {
    models.push(next);
  }
  return models;
}

function sanitizeLegacySkillEntries(root) {
  const skills = root.skills;
  if (!skills || typeof skills !== 'object' || Array.isArray(skills)) {
    return;
  }
  const entries = skills.entries;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return;
  }
  for (const [key, value] of Object.entries(entries)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    if ('apiKeys' in value) {
      delete value.apiKeys;
    }
    entries[key] = value;
  }
  skills.entries = entries;
  root.skills = skills;
}

const gateway = config.gateway && typeof config.gateway === 'object' && !Array.isArray(config.gateway)
  ? config.gateway
  : {};
const auth = gateway.auth && typeof gateway.auth === 'object' && !Array.isArray(gateway.auth)
  ? gateway.auth
  : {};
const controlUi = gateway.controlUi && typeof gateway.controlUi === 'object' && !Array.isArray(gateway.controlUi)
  ? gateway.controlUi
  : {};
const existingOrigins = Array.isArray(controlUi.allowedOrigins)
  ? controlUi.allowedOrigins.filter((value) => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
  : [];
const devOrigins = ['http://127.0.0.1:1520', 'http://localhost:1520'];
const mergedOrigins = [...new Set([...existingOrigins, ...devOrigins])];

auth.mode = 'token';
auth.token = nextToken;
gateway.auth = auth;
controlUi.allowedOrigins = mergedOrigins;
controlUi.allowInsecureAuth = true;
gateway.controlUi = controlUi;
config.gateway = gateway;
sanitizeLegacySkillEntries(config);

if (rawOpenAiModel) {
  const modelRef = rawOpenAiModel.includes('/') ? rawOpenAiModel : `openai/${rawOpenAiModel}`;
  const modelId = modelRef.split('/').pop() || rawOpenAiModel;
  const agents = ensureObject(config, 'agents');
  const defaults = ensureObject(agents, 'defaults');
  const existingModel = defaults.model;
  defaults.model = existingModel && typeof existingModel === 'object' && !Array.isArray(existingModel)
    ? { ...existingModel, primary: modelRef }
    : { primary: modelRef };
  const models = defaults.models && typeof defaults.models === 'object' && !Array.isArray(defaults.models)
    ? defaults.models
    : {};
  models[modelRef] = models[modelRef] && typeof models[modelRef] === 'object' && !Array.isArray(models[modelRef])
    ? models[modelRef]
    : {};
  defaults.workspace = rawWorkspaceDir || defaults.workspace || '';
  defaults.compaction = {
    ...(defaults.compaction && typeof defaults.compaction === 'object' && !Array.isArray(defaults.compaction)
      ? defaults.compaction
      : {}),
    mode: 'safeguard',
  };
  defaults.thinkingDefault = 'xhigh';
  defaults.timeoutSeconds = 1800;
  defaults.maxConcurrent = 4;
  defaults.subagents = {
    ...(defaults.subagents && typeof defaults.subagents === 'object' && !Array.isArray(defaults.subagents)
      ? defaults.subagents
      : {}),
    maxConcurrent: 8,
  };
  defaults.models = models;
  agents.defaults = defaults;
  config.agents = agents;
  const modelsConfig = ensureObject(config, 'models');
  const providers = ensureObject(modelsConfig, 'providers');
  const openaiProvider = ensureObject(providers, 'openai');
  openaiProvider.api = 'openai-completions';
  openaiProvider.authHeader = true;
  if (rawOpenAiBaseUrl) {
    openaiProvider.baseUrl = rawOpenAiBaseUrl;
  }
  if (rawOpenAiApiKey) {
    openaiProvider.apiKey = rawOpenAiApiKey;
  }
  openaiProvider.models = upsertManagedOpenAiModel(
    Array.isArray(openaiProvider.models) ? openaiProvider.models : [],
    modelId,
  );
  providers.openai = openaiProvider;
  modelsConfig.providers = providers;
  config.models = modelsConfig;
} else if (rawOpenAiBaseUrl || rawOpenAiApiKey) {
  const modelsConfig = ensureObject(config, 'models');
  const providers = ensureObject(modelsConfig, 'providers');
  const openaiProvider = ensureObject(providers, 'openai');
  openaiProvider.api = 'openai-completions';
  openaiProvider.authHeader = true;
  if (rawOpenAiBaseUrl) {
    openaiProvider.baseUrl = rawOpenAiBaseUrl;
  }
  if (rawOpenAiApiKey) {
    openaiProvider.apiKey = rawOpenAiApiKey;
  }
  if (!Array.isArray(openaiProvider.models)) {
    openaiProvider.models = [];
  }
  providers.openai = openaiProvider;
  modelsConfig.providers = providers;
  config.models = modelsConfig;
}

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
EOF

  echo "[api-dev] gateway token synced to $OPENCLAW_CONFIG_PATH"
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

wait_for_health() {
  local pid="$1"
  local ok=""
  local health_http=""
  local health_body=""

  for _ in {1..40}; do
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
    if ! kill -0 "$pid" >/dev/null 2>&1; then
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
  mkdir -p "$LOG_DIR"
  ln -sfn "$LOG_FILE" "$LATEST_LOG"
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
  OPENCLAW_LOG_DIR="$LOG_DIR" \
  OPENCLAW_GATEWAY_TOKEN="$GATEWAY_TOKEN" \
  OPENAI_API_KEY="$RUNTIME_OPENAI_API_KEY" \
  OPENAI_BASE_URL="$RUNTIME_OPENAI_BASE_URL" \
  OPENAI_API_BASE="$RUNTIME_OPENAI_BASE_URL" \
  OPENAI_MODEL="$RUNTIME_OPENAI_MODEL" \
  ANTHROPIC_API_KEY="$RUNTIME_ANTHROPIC_API_KEY" \
  NODE_EXTRA_CA_CERTS="$EXTRA_CA_CERTS_PATH" \
  PORT="$API_PORT" \
  nohup "$OPENCLAW_BIN" "${openclaw_args[@]}" >"$LOG_FILE" 2>&1 &
  local pid=$!

  wait_for_health "$pid"

  echo "[api-dev] 后端已就绪 PID=$pid (log: $LOG_FILE)"
  echo "[api-dev] 最新日志软链: $LATEST_LOG"
  echo "[api-dev] Tail logs: tail -f $LATEST_LOG"
}

start_openclaw_foreground() {
  mkdir -p "$LOG_DIR"
  ln -sfn "$LOG_FILE" "$LATEST_LOG"
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
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" 2>/dev/null || true
    fi
    if [[ -n "$tee_pid" ]] && kill -0 "$tee_pid" >/dev/null 2>&1; then
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
  OPENCLAW_LOG_DIR="$LOG_DIR" \
  OPENCLAW_GATEWAY_TOKEN="$GATEWAY_TOKEN" \
  OPENAI_API_KEY="$RUNTIME_OPENAI_API_KEY" \
  OPENAI_BASE_URL="$RUNTIME_OPENAI_BASE_URL" \
  OPENAI_API_BASE="$RUNTIME_OPENAI_BASE_URL" \
  OPENAI_MODEL="$RUNTIME_OPENAI_MODEL" \
  ANTHROPIC_API_KEY="$RUNTIME_ANTHROPIC_API_KEY" \
  NODE_EXTRA_CA_CERTS="$EXTRA_CA_CERTS_PATH" \
  PORT="$API_PORT" \
  "$OPENCLAW_BIN" "${openclaw_args[@]}" >"$pipe_path" 2>&1 &
  pid=$!

  wait_for_health "$pid"

  echo "[api-dev] 后端已就绪 PID=$pid (log: $LOG_FILE)"
  echo "[api-dev] 最新日志软链: $LATEST_LOG"
  echo "[api-dev] Ctrl+C 将停止后端服务"

  wait "$pid"
}

ensure_sidecar_bin
ensure_macos_runtime_frameworks
ensure_macos_codesign_if_needed
if [[ -n "${PORTAL_APP_NAME:-}" ]]; then
  echo "[api-dev] 同步 portal app 本地运行资源: ${PORTAL_APP_NAME}"
  node --experimental-strip-types "$ROOT_DIR/services/control-plane/scripts/sync-local-app-runtime.ts" --app "$PORTAL_APP_NAME"
fi
bash "$ROOT_DIR/scripts/prepare-openclaw-workspace.sh"
sync_gateway_token_config
stop_existing_api
if [[ "$API_DETACH" == "1" ]]; then
  start_openclaw_detached
else
  start_openclaw_foreground
fi
