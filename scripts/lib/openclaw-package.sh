#!/usr/bin/env bash

openclaw_runtime_artifacts_dir() {
  local root_dir="$1"
  printf '%s\n' "${OPENCLAW_RUNTIME_OUT_DIR:-$root_dir/.artifacts/openclaw-runtime}"
}

openclaw_runtime_bootstrap_config_path() {
  local root_dir="$1"
  printf '%s\n' "$root_dir/apps/desktop/src-tauri/resources/config/openclaw-runtime.json"
}

openclaw_default_npm_spec() {
  local root_dir="$1"

  if [[ -n "${ICLAW_OPENCLAW_RUNTIME_VERSION:-}" ]]; then
    printf 'openclaw@%s\n' "$ICLAW_OPENCLAW_RUNTIME_VERSION"
    return 0
  fi

  local config_path
  config_path="$(openclaw_runtime_bootstrap_config_path "$root_dir")"
  if [[ ! -f "$config_path" ]]; then
    return 1
  fi

  local version
  version="$(node -e 'const fs=require("fs"); const path=process.argv[1]; const raw=JSON.parse(fs.readFileSync(path, "utf8")); process.stdout.write((raw.version || "").trim());' "$config_path" 2>/dev/null || true)"
  if [[ -z "$version" ]]; then
    return 1
  fi

  printf 'openclaw@%s\n' "$version"
}

openclaw_abs_path() {
  local raw="$1"
  if [[ "$raw" == /* ]]; then
    if command -v cygpath >/dev/null 2>&1; then
      cygpath -aw "$raw"
    else
      printf '%s\n' "$raw"
    fi
    return 0
  fi

  local dir
  dir="$(cd "$(dirname "$raw")" && pwd)"
  local joined="$dir/$(basename "$raw")"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -aw "$joined"
  else
    printf '%s\n' "$joined"
  fi
}

openclaw_prepare_package_tgz() {
  local root_dir="$1"
  local artifacts_dir
  artifacts_dir="$(openclaw_runtime_artifacts_dir "$root_dir")"
  local package_cache_dir="${OPENCLAW_PACKAGE_CACHE_DIR:-$artifacts_dir/packages}"
  local tmp_root=""
  local src_tgz=""
  local dest_tgz=""
  local npm_spec="${OPENCLAW_NPM_SPEC:-}"

  mkdir -p "$package_cache_dir"

  if [[ -n "${OPENCLAW_PACKAGE_TGZ:-}" ]]; then
    src_tgz="$(openclaw_abs_path "$OPENCLAW_PACKAGE_TGZ")"
    if [[ ! -f "$src_tgz" ]]; then
      echo "OpenClaw package tgz not found: $src_tgz" >&2
      return 1
    fi
    dest_tgz="$package_cache_dir/$(basename "$src_tgz")"
    if [[ "$src_tgz" != "$dest_tgz" ]]; then
      cp "$src_tgz" "$dest_tgz"
    else
      touch "$dest_tgz"
    fi
  else
    if [[ -z "$npm_spec" ]]; then
      npm_spec="$(openclaw_default_npm_spec "$root_dir" || true)"
    fi
  fi

  if [[ -n "$dest_tgz" ]]; then
    OPENCLAW_PREPARED_PACKAGE_TGZ="$dest_tgz"
    export OPENCLAW_PREPARED_PACKAGE_TGZ
    return 0
  fi

  if [[ -n "$npm_spec" ]]; then
    tmp_root="$(mktemp -d /tmp/openclaw-package.XXXXXX)"
    (
      cd "$tmp_root"
      npm pack "$npm_spec" >/tmp/openclaw_package_npm_pack.log 2>&1
    )

    local packed_name
    packed_name="$(tail -n 1 /tmp/openclaw_package_npm_pack.log | tr -d '\r')"
    if [[ -z "$packed_name" || ! -f "$tmp_root/$packed_name" ]]; then
      echo "Failed to pack npm spec: $npm_spec" >&2
      cat /tmp/openclaw_package_npm_pack.log >&2 || true
      rm -rf "$tmp_root"
      return 1
    fi

    dest_tgz="$package_cache_dir/$packed_name"
    cp "$tmp_root/$packed_name" "$dest_tgz"
    rm -rf "$tmp_root"
  else
    return 1
  fi

  OPENCLAW_PREPARED_PACKAGE_TGZ="$dest_tgz"
  export OPENCLAW_PREPARED_PACKAGE_TGZ
}

openclaw_extract_package_tgz() {
  local package_tgz="$1"
  local dest_dir="$2"
  local tmp_root
  tmp_root="$(mktemp -d /tmp/openclaw-package-src.XXXXXX)"

  tar -xzf "$package_tgz" -C "$tmp_root"
  if [[ ! -d "$tmp_root/package" ]]; then
    rm -rf "$tmp_root"
    echo "OpenClaw package tgz is missing package/ root: $package_tgz" >&2
    return 1
  fi

  mkdir -p "$dest_dir"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$tmp_root/package/" "$dest_dir/"
  else
    find "$dest_dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    cp -R "$tmp_root/package/." "$dest_dir/"
  fi
  rm -rf "$tmp_root"
}

openclaw_package_has_runtime_deps() {
  local source_dir="$1"
  [[ -f "$source_dir/node_modules/chalk/package.json" ]]
}

openclaw_patch_package_runtime_http_cors() {
  local source_dir="$1"
  local dist_dir="$source_dir/dist"

  [[ -d "$dist_dir" ]] || return 0

  SOURCE_DIR_FOR_PATCH="$source_dir" node <<'EOF'
const fs = require('fs');
const path = require('path');

const sourceDir = process.env.SOURCE_DIR_FOR_PATCH;
if (!sourceDir) process.exit(0);

const distDir = path.join(sourceDir, 'dist');
if (!fs.existsSync(distDir) || !fs.statSync(distDir).isDirectory()) process.exit(0);

const gatewayCorsSnippet = `const ICLAW_DESKTOP_ALLOWED_ORIGINS = new Set([
\t"http://127.0.0.1:1520",
\t"http://localhost:1520",
\t"https://tauri.localhost",
\t"http://tauri.localhost",
\t"tauri://localhost"
]);
function resolveIclawDesktopCorsOrigin(originHeader) {
\tconst origin = typeof originHeader === "string" ? originHeader.trim() : "";
\tif (!origin) return null;
\treturn ICLAW_DESKTOP_ALLOWED_ORIGINS.has(origin) ? origin : null;
}
function applyIclawDesktopCorsHeaders(req, res) {
\tconst allowOrigin = resolveIclawDesktopCorsOrigin(req.headers.origin);
\tif (!allowOrigin) return false;
\tres.setHeader("Access-Control-Allow-Origin", allowOrigin);
\tres.setHeader("Access-Control-Allow-Credentials", "true");
\tres.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
\tres.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-OpenClaw-Password");
\tres.setHeader("Vary", "Origin");
\treturn true;
}
`;

const browserCorsSnippet = `const ICLAW_DESKTOP_ALLOWED_ORIGINS = new Set([
\t"http://127.0.0.1:1520",
\t"http://localhost:1520",
\t"https://tauri.localhost",
\t"http://tauri.localhost",
\t"tauri://localhost"
]);
function resolveIclawDesktopCorsOrigin(originHeader) {
\tconst origin = typeof originHeader === "string" ? originHeader.trim() : "";
\tif (!origin) return null;
\treturn ICLAW_DESKTOP_ALLOWED_ORIGINS.has(origin) ? origin : null;
}
function applyIclawDesktopCorsHeaders(req, res) {
\tconst allowOrigin = resolveIclawDesktopCorsOrigin(req.headers.origin);
\tif (!allowOrigin) return false;
\tres.setHeader("Access-Control-Allow-Origin", allowOrigin);
\tres.setHeader("Access-Control-Allow-Credentials", "true");
\tres.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
\tres.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-OpenClaw-Password");
\tres.setHeader("Vary", "Origin");
\treturn true;
}
`;

function patchGatewayFile(filePath) {
  let raw = fs.readFileSync(filePath, 'utf8');
  if (raw.includes('ICLAW_DESKTOP_ALLOWED_ORIGINS')) return false;
  if (!raw.includes('function createGatewayHttpServer(opts) {')) return false;
  if (!raw.includes('setDefaultSecurityHeaders(res, { strictTransportSecurity: strictTransportSecurityHeader });')) {
    throw new Error(`gateway server patch anchor missing in ${filePath}`);
  }

  raw = raw.replace(
    'function createGatewayHttpServer(opts) {',
    `${gatewayCorsSnippet}\nfunction createGatewayHttpServer(opts) {`,
  );
  raw = raw.replace(
    'setDefaultSecurityHeaders(res, { strictTransportSecurity: strictTransportSecurityHeader });',
    `setDefaultSecurityHeaders(res, { strictTransportSecurity: strictTransportSecurityHeader });\n\t\t\tapplyIclawDesktopCorsHeaders(req, res);\n\t\t\tif (req.method === "OPTIONS") {\n\t\t\t\tres.statusCode = 204;\n\t\t\t\tres.end();\n\t\t\t\treturn;\n\t\t\t}`,
  );
  fs.writeFileSync(filePath, raw);
  return true;
}

function patchBrowserMiddlewareFile(filePath) {
  let raw = fs.readFileSync(filePath, 'utf8');
  if (raw.includes('ICLAW_DESKTOP_ALLOWED_ORIGINS')) return false;
  if (!raw.includes('function installBrowserCommonMiddleware(app) {')) return false;
  if (!raw.includes('app.use(express.json({ limit: "1mb" }));')) {
    throw new Error(`browser middleware patch anchor missing in ${filePath}`);
  }

  raw = raw.replace(
    'function installBrowserCommonMiddleware(app) {',
    `${browserCorsSnippet}\nfunction installBrowserCommonMiddleware(app) {`,
  );
  raw = raw.replace(
    'function installBrowserCommonMiddleware(app) {\n\tapp.use((req, res, next) => {',
    'function installBrowserCommonMiddleware(app) {\n\tapp.use((req, res, next) => {\n\t\tapplyIclawDesktopCorsHeaders(req, res);\n\t\tif (req.method === "OPTIONS") {\n\t\t\tres.status(204).end();\n\t\t\treturn;\n\t\t}\n\t\tnext();\n\t});\n\tapp.use((req, res, next) => {',
  );
  fs.writeFileSync(filePath, raw);
  return true;
}

function collectJavaScriptFiles(dirPath, out) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectJavaScriptFiles(entryPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(entryPath);
    }
  }
}

const entries = [];
collectJavaScriptFiles(distDir, entries);
let patched = 0;
for (const filePath of entries) {
  const name = path.basename(filePath);
  if (/^gateway-cli-.*\.js$/.test(name)) {
    if (patchGatewayFile(filePath)) patched += 1;
    continue;
  }
  if (/^(?:server-middleware|pi-embedded-helpers)-.*\.js$/.test(name)) {
    if (patchBrowserMiddlewareFile(filePath)) patched += 1;
  }
}

if (patched > 0) {
  process.stderr.write(`[openclaw-runtime] patched local CORS allowlist into ${patched} dist files\n`);
}
EOF
}

openclaw_patch_package_runtime_openai_usage() {
  local source_dir="$1"
  local dist_dir="$source_dir/dist"

  [[ -d "$dist_dir" ]] || return 0

  SOURCE_DIR_FOR_PATCH="$source_dir" node <<'EOF'
const fs = require('fs');
const path = require('path');

const sourceDir = process.env.SOURCE_DIR_FOR_PATCH;
if (!sourceDir) process.exit(0);

const distDir = path.join(sourceDir, 'dist');
if (!fs.existsSync(distDir) || !fs.statSync(distDir).isDirectory()) process.exit(0);

const PATCH_MARKER = 'payloadObj.stream_options = { ...(payloadObj.stream_options ?? {}), include_usage: true };';

function collectJavaScriptFiles(dirPath, out) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectJavaScriptFiles(entryPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(entryPath);
    }
  }
}

function patchOpenAiWrapperFile(filePath) {
  let raw = fs.readFileSync(filePath, 'utf8');
  const APPLY_MARKER = 'agent.streamFn = createOpenAIDefaultTransportWrapper(agent.streamFn);';
  const LEGACY_PROVIDER_FILTER = 'if (model.api === "openai-completions" && model.provider === "openai" && payload && typeof payload === "object") {';
  let changed = false;

  if (raw.includes(LEGACY_PROVIDER_FILTER)) {
    raw = raw.replace(LEGACY_PROVIDER_FILTER, 'if (model.api === "openai-completions" && payload && typeof payload === "object") {');
    changed = true;
  }
  if (raw.includes('else if (provider === "openai") agent.streamFn = createOpenAIDefaultTransportWrapper(agent.streamFn);')) {
    raw = raw.replace('else if (provider === "openai") agent.streamFn = createOpenAIDefaultTransportWrapper(agent.streamFn);', 'agent.streamFn = createOpenAIDefaultTransportWrapper(agent.streamFn);');
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(filePath, raw);
    return true;
  }
  if (raw.includes(PATCH_MARKER) && raw.includes(APPLY_MARKER)) {
    return false;
  }
  if (raw.includes(PATCH_MARKER) && !raw.includes(APPLY_MARKER)) {
    raw = raw.replace('else if (provider === "openai") agent.streamFn = createOpenAIDefaultTransportWrapper(agent.streamFn);', 'agent.streamFn = createOpenAIDefaultTransportWrapper(agent.streamFn);');
    fs.writeFileSync(filePath, raw);
    return true;
  }

  const anchor = `function createOpenAIDefaultTransportWrapper(baseStreamFn) {\n\tconst underlying = baseStreamFn ?? streamSimple;\n\treturn (model, context, options) => {\n\t\tconst typedOptions = options;\n\t\treturn underlying(model, context, {\n\t\t\t...options,\n\t\t\ttransport: options?.transport ?? "auto",\n\t\t\topenaiWsWarmup: typedOptions?.openaiWsWarmup ?? false\n\t\t});\n\t};\n}`;

  if (!raw.includes(anchor)) {
    return false;
  }

  const replacement = `function createOpenAIDefaultTransportWrapper(baseStreamFn) {\n\tconst underlying = baseStreamFn ?? streamSimple;\n\treturn (model, context, options) => {\n\t\tconst typedOptions = options;\n\t\tconst originalOnPayload = options?.onPayload;\n\t\treturn underlying(model, context, {\n\t\t\t...options,\n\t\t\ttransport: options?.transport ?? "auto",\n\t\t\topenaiWsWarmup: typedOptions?.openaiWsWarmup ?? false,\n\t\t\tonPayload: (payload) => {\n\t\t\t\tif (model.api === "openai-completions" && payload && typeof payload === "object") {\n\t\t\t\t\tconst payloadObj = payload;\n\t\t\t\t\tpayloadObj.stream_options = { ...(payloadObj.stream_options ?? {}), include_usage: true };\n\t\t\t\t}\n\t\t\t\treturn originalOnPayload?.(payload, model);\n\t\t\t}\n\t\t});\n\t};\n}`;

  raw = raw.replace(anchor, replacement);
  raw = raw.replace('else if (provider === "openai") agent.streamFn = createOpenAIDefaultTransportWrapper(agent.streamFn);', 'agent.streamFn = createOpenAIDefaultTransportWrapper(agent.streamFn);');
  fs.writeFileSync(filePath, raw);
  return true;
}

const entries = [];
collectJavaScriptFiles(distDir, entries);
let patched = 0;
for (const filePath of entries) {
  const name = path.basename(filePath);
  if (/^(?:reply|auth-profiles)-.*\.js$/.test(name)) {
    if (patchOpenAiWrapperFile(filePath)) patched += 1;
  }
}

if (patched > 0) {
  process.stderr.write(`[openclaw-runtime] patched OpenAI-compatible chat.completions stream_options.include_usage into ${patched} dist files\n`);
}
EOF
}

openclaw_ensure_package_runtime_deps() {
  local source_dir="$1"

  if openclaw_package_has_runtime_deps "$source_dir"; then
    return 0
  fi

  if [[ -d "$source_dir/node_modules" ]]; then
    echo "[openclaw-runtime] runtime deps incomplete, refreshing with npm install --omit=dev"
  else
    echo "[openclaw-runtime] node_modules missing, running npm install --omit=dev"
  fi
  (
    cd "$source_dir"
    npm install --omit=dev
  )

  if ! openclaw_package_has_runtime_deps "$source_dir"; then
    echo "[openclaw-runtime] required root dependency missing after npm install: chalk" >&2
    return 1
  fi
}

openclaw_write_runtime_bootstrap_config() {
  local root_dir="$1"
  local version="$2"
  local artifact_url="$3"
  local artifact_sha256="${4:-}"
  local artifact_format="${5:-tar.gz}"
  local launcher_relative_path="${6:-}"
  local config_path
  config_path="$(openclaw_runtime_bootstrap_config_path "$root_dir")"

  mkdir -p "$(dirname "$config_path")"
  node -e '
const fs = require("fs");
const [configPath, version, artifactUrl, artifactSha, artifactFormat, launcherPath] = process.argv.slice(1);
const payload = {
  version,
  artifact_url: artifactUrl,
  artifact_sha256: artifactSha || null,
  artifact_format: artifactFormat || "tar.gz",
  launcher_relative_path: launcherPath || null,
  dev_source_dir: null,
  dev_node_path: null,
};
fs.writeFileSync(configPath, `${JSON.stringify(payload, null, 2)}\n`);
' "$config_path" "$version" "$artifact_url" "$artifact_sha256" "$artifact_format" "$launcher_relative_path"
}
