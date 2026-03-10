#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT_DIR/apps/desktop/src-tauri/binaries"
CACHE_DIR="$ROOT_DIR/.cache/openclaw-release"

TARGET_TRIPLE="${1:-}"
infer_target_triple_from_system() {
  local os
  local arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin)
      case "$arch" in
        arm64|aarch64) echo "aarch64-apple-darwin" ;;
        x86_64) echo "x86_64-apple-darwin" ;;
        *) return 1 ;;
      esac
      ;;
    Linux)
      case "$arch" in
        x86_64|amd64) echo "x86_64-unknown-linux-gnu" ;;
        arm64|aarch64) echo "aarch64-unknown-linux-gnu" ;;
        *) return 1 ;;
      esac
      ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      case "$arch" in
        x86_64|amd64) echo "x86_64-pc-windows-msvc" ;;
        arm64|aarch64) echo "aarch64-pc-windows-msvc" ;;
        *) return 1 ;;
      esac
      ;;
    *)
      return 1
      ;;
  esac
}

if [[ -z "$TARGET_TRIPLE" ]]; then
  if command -v rustc >/dev/null 2>&1; then
    TARGET_TRIPLE="$(rustc -vV | sed -n 's/^host: //p')"
  else
    TARGET_TRIPLE="$(infer_target_triple_from_system || true)"
  fi
fi

if [[ -z "$TARGET_TRIPLE" ]]; then
  echo "Cannot determine rust target triple (missing rustc and system inference failed)" >&2
  exit 1
fi

DEST_NAME="openclaw-$TARGET_TRIPLE"
if [[ "$TARGET_TRIPLE" == *"windows"* ]]; then
  DEST_NAME="${DEST_NAME}.exe"
fi

SOURCE_KIND=""
RESOLVED_RELEASE_TAG=""
RESOLVED_RELEASE_ASSET=""
RESOLVED_RELEASE_URL=""
DOWNLOADED_BIN=""

resolve_local_source_bin() {
  if [[ -n "${OPENCLAW_BINARY_PATH:-}" ]]; then
    local source_bin="$OPENCLAW_BINARY_PATH"

    if [[ "$TARGET_TRIPLE" == *"windows"* && -f "${source_bin}.exe" ]]; then
      source_bin="${source_bin}.exe"
    fi

    if [[ -f "$source_bin" ]]; then
      echo "$source_bin"
      return 0
    fi
    return 1
  fi

  local source_bin="$ROOT_DIR/services/openclaw/bin/openclaw-server"

  if [[ "$TARGET_TRIPLE" == *"windows"* ]]; then
    if [[ -f "${source_bin}.exe" ]]; then
      source_bin="${source_bin}.exe"
    fi
  fi

  if [[ -f "$source_bin" ]]; then
    echo "$source_bin"
    return 0
  fi

  return 1
}

resolve_release_asset() {
  local repo="${OPENCLAW_RELEASE_REPO:-openclaw/openclaw}"
  local version="${OPENCLAW_RELEASE_VERSION:-latest}"
  local release_api

  if [[ "$version" == "latest" ]]; then
    release_api="https://api.github.com/repos/${repo}/releases/latest"
  else
    release_api="https://api.github.com/repos/${repo}/releases/tags/${version}"
  fi

  local release_json
  if ! release_json="$(curl -fsSL "$release_api")"; then
    echo "Failed to fetch release metadata: $release_api" >&2
    return 1
  fi

  if ! node -e '
const fs = require("fs");
const raw = fs.readFileSync(0, "utf8");
let release;
try {
  release = JSON.parse(raw);
} catch {
  process.exit(3);
}
const target = process.argv[1];
const assets = Array.isArray(release.assets) ? release.assets : [];

const serverRe = /(openclaw[-_.]?server|server[-_.]?openclaw)/i;
const byTarget = (name) => {
  if (target.includes("apple-darwin")) return /(darwin|mac|osx)/i.test(name);
  if (target.includes("windows")) return /(windows|win)/i.test(name);
  return /(linux|gnu|appimage)/i.test(name);
};
const serverAssets = assets.filter((a) => serverRe.test(a.name));

const asset = serverAssets.find((a) => byTarget(a.name)) || serverAssets[0] || null;

if (!asset) {
  process.exit(2);
}

const tag = release.tag_name || "unknown";
process.stdout.write(`${tag}\n${asset.name}\n${asset.browser_download_url}\n`);
' "$TARGET_TRIPLE" <<<"$release_json"; then
    echo "Failed to parse or resolve release asset for target: $TARGET_TRIPLE" >&2
    return 1
  fi
}

download_release_binary() {
  local repo="${OPENCLAW_RELEASE_REPO:-openclaw/openclaw}"
  local resolved

  if ! resolved="$(resolve_release_asset)"; then
    echo "Cannot resolve release asset from ${repo} for target ${TARGET_TRIPLE}" >&2
    return 1
  fi

  local tag
  local asset_name
  local asset_url
  tag="$(echo "$resolved" | sed -n '1p')"
  asset_name="$(echo "$resolved" | sed -n '2p')"
  asset_url="$(echo "$resolved" | sed -n '3p')"

  RESOLVED_RELEASE_TAG="$tag"
  RESOLVED_RELEASE_ASSET="$asset_name"
  RESOLVED_RELEASE_URL="$asset_url"

  local target_cache="$CACHE_DIR/$tag"
  local asset_file="$target_cache/$asset_name"
  local extract_dir="$target_cache/extracted"

  mkdir -p "$target_cache"

  if [[ ! -f "$asset_file" ]]; then
    echo "Downloading OpenClaw release asset: $asset_name ($tag)" >&2
    curl -fL "$asset_url" -o "$asset_file"
  else
    echo "Using cached release asset: $asset_file" >&2
  fi

  rm -rf "$extract_dir"
  mkdir -p "$extract_dir"

  case "$asset_name" in
    *.zip)
      unzip -q "$asset_file" -d "$extract_dir"
      ;;
    *.tar.gz|*.tgz)
      tar -xzf "$asset_file" -C "$extract_dir"
      ;;
    *.exe)
      cp "$asset_file" "$extract_dir/"
      ;;
    *.dmg)
      echo "DMG asset is not supported for automated extraction. Please set OPENCLAW_BINARY_PATH manually." >&2
      return 1
      ;;
    *)
      echo "Unsupported asset format: $asset_name" >&2
      return 1
      ;;
  esac

  local extracted_bin=""
  if [[ "$TARGET_TRIPLE" == *"windows"* ]]; then
    extracted_bin="$(find "$extract_dir" -type f \( -iname 'openclaw-server*.exe' -o -iname '*openclaw*server*.exe' \) | head -n1)"
  else
    extracted_bin="$(find "$extract_dir" -type f \( -name 'openclaw-server*' -o -name '*openclaw*server*' \) ! -name '*.dSYM' | head -n1)"
  fi

  if [[ -z "$extracted_bin" || ! -f "$extracted_bin" ]]; then
    echo "Cannot find openclaw-server executable in asset: $asset_name" >&2
    return 1
  fi

  DOWNLOADED_BIN="$extracted_bin"
  return 0
}

write_metadata() {
  local source_bin="$1"
  local dest_bin="$2"
  local metadata_file="$BIN_DIR/openclaw-meta-$TARGET_TRIPLE.json"
  local now_utc
  now_utc="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  local repo="${OPENCLAW_RELEASE_REPO:-openclaw/openclaw}"
  local version_req="${OPENCLAW_RELEASE_VERSION:-latest}"

  cat > "$metadata_file" <<JSON
{
  "target_triple": "$TARGET_TRIPLE",
  "source_kind": "$SOURCE_KIND",
  "source_bin": "$source_bin",
  "dest_bin": "$dest_bin",
  "release_repo": "$repo",
  "release_version_request": "$version_req",
  "release_tag": "$RESOLVED_RELEASE_TAG",
  "release_asset": "$RESOLVED_RELEASE_ASSET",
  "release_url": "$RESOLVED_RELEASE_URL",
  "prepared_at_utc": "$now_utc"
}
JSON

  echo "Sidecar metadata: $metadata_file"
}

SOURCE_BIN=""
if SOURCE_BIN="$(resolve_local_source_bin)"; then
  if [[ -n "${OPENCLAW_BINARY_PATH:-}" && "$SOURCE_BIN" == "${OPENCLAW_BINARY_PATH}"* ]]; then
    SOURCE_KIND="manual"
  else
    SOURCE_KIND="local"
  fi
  echo "Using sidecar source binary ($SOURCE_KIND): $SOURCE_BIN"
else
  SOURCE_KIND="github_release"
  echo "Local openclaw-server binary not found, trying GitHub Releases"
  if ! download_release_binary; then
    echo "Failed to prepare openclaw-server sidecar binary" >&2
    echo "Hint: provide OPENCLAW_BINARY_PATH=/path/to/openclaw-server" >&2
    echo "Hint: or build runtime from source: OPENCLAW_SOURCE_DIR=/path/to/openclaw bash scripts/build-openclaw-server-runtime.sh" >&2
    exit 1
  fi
  SOURCE_BIN="$DOWNLOADED_BIN"
fi

mkdir -p "$BIN_DIR"
DEST_BIN="$BIN_DIR/$DEST_NAME"
cp "$SOURCE_BIN" "$DEST_BIN"

if [[ "$TARGET_TRIPLE" != *"windows"* ]]; then
  chmod +x "$DEST_BIN"
fi

write_metadata "$SOURCE_BIN" "$DEST_BIN"

echo "Sidecar prepared: $DEST_BIN"
