#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"
OUT_DIR="$ROOT_DIR/dist/releases"
APP_VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
HOST_PLATFORM="$(node -p "process.platform")"
timestamp="$(date +%Y%m%d%H%M)"
RELEASE_VERSION="${1:-${APP_VERSION}.${timestamp}}"
CHANNELS=("dev" "prod")

case "$HOST_PLATFORM" in
  darwin)
    TARGETS=(
      "aarch64-apple-darwin"
      "x86_64-apple-darwin"
    )
    ;;
  win32)
    TARGETS=(
      "x86_64-pc-windows-msvc"
      "aarch64-pc-windows-msvc"
    )
    ;;
  *)
    echo "Unsupported host platform: $HOST_PLATFORM (expected darwin or win32)" >&2
    exit 1
    ;;
esac

if [[ -n "${ICLAW_DESKTOP_TARGETS:-}" ]]; then
  read -r -a TARGETS <<<"${ICLAW_DESKTOP_TARGETS//,/ }"
fi

if [[ -n "${ICLAW_DESKTOP_CHANNELS:-}" ]]; then
  read -r -a CHANNELS <<<"${ICLAW_DESKTOP_CHANNELS//,/ }"
fi

mkdir -p "$OUT_DIR"

product_name() {
  local brand_id="${1:-}"
  local env_name="${2:-dev}"
  NODE_ENV="$env_name" APP_NAME="$brand_id" node "$ROOT_DIR/scripts/read-brand-value.mjs" --brand "$brand_id" productName | tail -n1
}

artifact_base_name() {
  local brand_id="${1:-}"
  local env_name="${2:-dev}"
  NODE_ENV="$env_name" APP_NAME="$brand_id" node "$ROOT_DIR/scripts/read-brand-value.mjs" --brand "$brand_id" distribution.artifactBaseName | tail -n1
}

host_label() {
  case "$HOST_PLATFORM" in
    darwin)
      echo "macOS"
      ;;
    win32)
      echo "Windows"
      ;;
  esac
}

arch_label_for_target() {
  case "$1" in
    aarch64-apple-darwin|aarch64-pc-windows-msvc)
      echo "aarch64"
      ;;
    x86_64-apple-darwin|x86_64-pc-windows-msvc)
      echo "x64"
      ;;
    *)
      echo "Unsupported target architecture: $1" >&2
      exit 1
      ;;
  esac
}

bundle_dir_for_target() {
  case "$1" in
    *-apple-darwin)
      echo "$DESKTOP_DIR/src-tauri/target/$1/release/bundle"
      ;;
    *-pc-windows-msvc)
      echo "$DESKTOP_DIR/src-tauri/target/$1/release/bundle"
      ;;
    *)
      echo "Unsupported target triple: $1" >&2
      exit 1
      ;;
  esac
}

find_latest_file() {
  local dir="$1"
  local pattern="$2"
  find "$dir" -maxdepth 1 -type f -name "$pattern" -print | sort | tail -n 1
}

find_first_matching_file() {
  local dir="$1"
  shift

  local pattern
  for pattern in "$@"; do
    local matched
    matched="$(find_latest_file "$dir" "$pattern")"
    if [[ -n "$matched" ]]; then
      printf '%s\n' "$matched"
      return 0
    fi
  done
  return 1
}

build_one() {
  local target="$1"
  local channel="$2"
  local node_env
  local arch_label
  local current_artifact_base_name
  local current_product_name
  local current_brand_id

  if [[ "$channel" == "dev" ]]; then
    node_env="dev"
  elif [[ "$channel" == "test" ]]; then
    node_env="test"
  elif [[ "$channel" == "prod" ]]; then
    node_env="prod"
  else
    echo "Unsupported channel: $channel" >&2
    exit 1
  fi

  arch_label="$(arch_label_for_target "$target")"
  current_brand_id="${ICLAW_BRAND:-${APP_NAME:-}}"
  if [[ -z "$current_brand_id" ]]; then
    echo "Missing ICLAW_BRAND or APP_NAME for desktop build" >&2
    exit 1
  fi
  current_artifact_base_name="$(artifact_base_name "$current_brand_id" "$node_env")"
  current_product_name="$(product_name "$current_brand_id" "$node_env")"

  echo "==> building: target=$target channel=$channel"

  (
    cd "$ROOT_DIR"
    bash "$ROOT_DIR/scripts/with-env.sh" "$node_env" \
      env \
      APP_NAME="$current_brand_id" \
      ICLAW_PORTAL_APP_NAME="${ICLAW_PORTAL_APP_NAME:-$current_brand_id}" \
      ICLAW_BRAND="$current_brand_id" \
      ICLAW_OPENCLAW_RUNTIME_VERSION="${ICLAW_OPENCLAW_RUNTIME_VERSION:-}" \
      ICLAW_OPENCLAW_RUNTIME_URL="${ICLAW_OPENCLAW_RUNTIME_URL:-}" \
      ICLAW_OPENCLAW_RUNTIME_SHA256="${ICLAW_OPENCLAW_RUNTIME_SHA256:-}" \
      ICLAW_OPENCLAW_RUNTIME_FORMAT="${ICLAW_OPENCLAW_RUNTIME_FORMAT:-}" \
      NODE_ENV="$node_env" \
      ICLAW_ENV_NAME="$node_env" \
      node "$ROOT_DIR/scripts/build-desktop-package.mjs" --target "$target"
  )

  local bundle_dir
  bundle_dir="$(bundle_dir_for_target "$target")"

  if [[ "$target" == *-apple-darwin ]]; then
    local installer_dir="$bundle_dir/dmg"
    local installer_path
    if [[ "$channel" == "dev" || "$channel" == "prod" ]]; then
      installer_path="$installer_dir/${current_artifact_base_name}_${APP_VERSION}_${arch_label}_${channel}.dmg"
    else
      installer_path="$installer_dir/${current_artifact_base_name}_${APP_VERSION}_${arch_label}.dmg"
    fi
    if [[ ! -f "$installer_path" ]]; then
      echo "Expected DMG not found under: $installer_dir (artifactBaseName=$current_artifact_base_name appVersion=$APP_VERSION arch=$arch_label)" >&2
      exit 1
    fi

    local installer_out="$OUT_DIR/${current_artifact_base_name}_${RELEASE_VERSION}_${arch_label}_${channel}.dmg"
    cp "$installer_path" "$installer_out"
    echo "saved: $installer_out"

    local updater_dir="$bundle_dir/macos"
    local updater_archive="$updater_dir/${current_product_name}.app.tar.gz"
    local updater_signature="${updater_archive}.sig"
    if [[ -f "$updater_archive" && -f "$updater_signature" ]]; then
      local updater_out="$OUT_DIR/${current_artifact_base_name}_${RELEASE_VERSION}_${arch_label}_${channel}.app.tar.gz"
      local updater_sig_out="${updater_out}.sig"
      cp "$updater_archive" "$updater_out"
      cp "$updater_signature" "$updater_sig_out"
      echo "saved: $updater_out"
      echo "saved: $updater_sig_out"
    fi
    return
  fi

  if [[ "$target" == *-pc-windows-msvc ]]; then
    local installer_dir="$bundle_dir/nsis"
    local installer_path
    if [[ "$arch_label" == "aarch64" ]]; then
      installer_path="$(
        find_first_matching_file \
          "$installer_dir" \
          "*${APP_VERSION}*aarch64*.exe" \
          "*${APP_VERSION}*arm64*.exe"
      )" || true
    else
      installer_path="$(find_first_matching_file "$installer_dir" "*${APP_VERSION}*x64*.exe")" || true
    fi
    if [[ -z "$installer_path" ]]; then
      echo "Expected Windows installer not found under: $installer_dir (appVersion=$APP_VERSION arch=$arch_label)" >&2
      exit 1
    fi

    local installer_out="$OUT_DIR/${current_artifact_base_name}_${RELEASE_VERSION}_${arch_label}_${channel}.exe"
    cp "$installer_path" "$installer_out"
    echo "saved: $installer_out"

    local updater_archive
    if [[ "$arch_label" == "aarch64" ]]; then
      updater_archive="$(
        find_first_matching_file \
          "$installer_dir" \
          "*${APP_VERSION}*aarch64*.nsis.zip" \
          "*${APP_VERSION}*arm64*.nsis.zip"
      )" || true
    else
      updater_archive="$(find_first_matching_file "$installer_dir" "*${APP_VERSION}*x64*.nsis.zip")" || true
    fi
    local updater_signature=""
    if [[ -n "$updater_archive" ]]; then
      updater_signature="${updater_archive}.sig"
    fi
    if [[ -n "$updater_archive" && -f "$updater_signature" ]]; then
      local updater_out="$OUT_DIR/${current_artifact_base_name}_${RELEASE_VERSION}_${arch_label}_${channel}.nsis.zip"
      local updater_sig_out="${updater_out}.sig"
      cp "$updater_archive" "$updater_out"
      cp "$updater_signature" "$updater_sig_out"
      echo "saved: $updater_out"
      echo "saved: $updater_sig_out"
    fi
    return
  fi

  echo "Unsupported target triple: $target" >&2
  exit 1
}

echo "Host platform: $(host_label)"
printf 'Targets: %s\n' "${TARGETS[*]}"
printf 'Channels: %s\n' "${CHANNELS[*]}"

for target in "${TARGETS[@]}"; do
  for channel in "${CHANNELS[@]}"; do
    build_one "$target" "$channel"
  done
done

echo "All done. output => $OUT_DIR"
