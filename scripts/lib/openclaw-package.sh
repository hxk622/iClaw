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
    printf '%s\n' "$raw"
    return 0
  fi

  local dir
  dir="$(cd "$(dirname "$raw")" && pwd)"
  printf '%s/%s\n' "$dir" "$(basename "$raw")"
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
  rsync -a --delete "$tmp_root/package/" "$dest_dir/"
  rm -rf "$tmp_root"
}

openclaw_package_has_runtime_deps() {
  local source_dir="$1"
  [[ -f "$source_dir/node_modules/chalk/package.json" ]]
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
