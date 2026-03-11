#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/openclaw-package.sh"

ENV_NAME="${1:-prod}"
RUNTIME_CONFIG_PATH="$(openclaw_runtime_bootstrap_config_path "$ROOT_DIR")"

if [[ ! -f "$RUNTIME_CONFIG_PATH" ]]; then
  echo "Missing runtime config: $RUNTIME_CONFIG_PATH" >&2
  exit 1
fi

read_runtime_field() {
  local key="$1"
  node -e '
const fs = require("fs");
const [configPath, key] = process.argv.slice(1);
const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
const value = raw && typeof raw === "object" ? raw[key] : undefined;
if (typeof value === "string") process.stdout.write(value);
' "$RUNTIME_CONFIG_PATH" "$key"
}

VERSION="$(read_runtime_field version)"
ARCHIVE_PATH_RAW="$(read_runtime_field artifact_url)"
ARCHIVE_SHA256="$(read_runtime_field artifact_sha256)"
ARTIFACT_FORMAT="$(read_runtime_field artifact_format)"
LAUNCHER_RELATIVE_PATH="$(read_runtime_field launcher_relative_path)"

if [[ -z "$VERSION" ]]; then
  echo "Runtime version missing in $RUNTIME_CONFIG_PATH" >&2
  exit 1
fi

if [[ -z "$ARCHIVE_PATH_RAW" ]]; then
  echo "Runtime artifact_url missing in $RUNTIME_CONFIG_PATH" >&2
  exit 1
fi

ARCHIVE_PATH="$(openclaw_abs_path "$ARCHIVE_PATH_RAW")"
if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "Runtime archive not found: $ARCHIVE_PATH" >&2
  exit 1
fi

if [[ -z "$ARTIFACT_FORMAT" ]]; then
  ARTIFACT_FORMAT="tar.gz"
fi

runtime_public_url_for() {
  local base_url="$1"
  local object_key="$2"
  local normalized="${base_url%/}"
  printf '%s/%s\n' "$normalized" "$object_key"
}

case "$ENV_NAME" in
  dev)
    : "${ICLAW_RUNTIME_MINIO_ALIAS:=${ICLAW_MINIO_DEV_ALIAS:-local}}"
    : "${ICLAW_RUNTIME_MINIO_BUCKET:=${ICLAW_MINIO_DEV_BUCKET:-iclaw-dev}}"
    : "${ICLAW_RUNTIME_PUBLIC_BASE_URL:=http://127.0.0.1:9000/$ICLAW_RUNTIME_MINIO_BUCKET}"
    ;;
  prod)
    : "${ICLAW_RUNTIME_MINIO_ALIAS:=${ICLAW_MINIO_PROD_ALIAS:-remoteprod}}"
    : "${ICLAW_RUNTIME_MINIO_BUCKET:=${ICLAW_MINIO_PROD_BUCKET:-iclaw-prod}}"
    : "${ICLAW_RUNTIME_PUBLIC_BASE_URL:=https://iclaw.aiyuanxi.com/downloads}"
    ;;
  *)
    echo "Unknown env: $ENV_NAME (use dev or prod)" >&2
    exit 1
    ;;
esac

: "${ICLAW_RUNTIME_MINIO_PREFIX:=runtime}"

if ! command -v mc >/dev/null 2>&1; then
  echo "mc not found in PATH" >&2
  exit 1
fi

OBJECT_NAME="$(basename "$ARCHIVE_PATH")"
OBJECT_KEY="${ICLAW_RUNTIME_MINIO_PREFIX%/}/$OBJECT_NAME"
TARGET_URI="$ICLAW_RUNTIME_MINIO_ALIAS/$ICLAW_RUNTIME_MINIO_BUCKET/$OBJECT_KEY"
PUBLIC_URL="$(runtime_public_url_for "$ICLAW_RUNTIME_PUBLIC_BASE_URL" "$OBJECT_KEY")"

echo "Publishing OpenClaw runtime:"
echo "  env:        $ENV_NAME"
echo "  archive:    $ARCHIVE_PATH"
echo "  target:     $TARGET_URI"
echo "  public_url: $PUBLIC_URL"
echo

mc mb --ignore-existing "$ICLAW_RUNTIME_MINIO_ALIAS/$ICLAW_RUNTIME_MINIO_BUCKET"
mc cp "$ARCHIVE_PATH" "$TARGET_URI"
mc anonymous set download "$ICLAW_RUNTIME_MINIO_ALIAS/$ICLAW_RUNTIME_MINIO_BUCKET"

openclaw_write_runtime_bootstrap_config \
  "$ROOT_DIR" \
  "$VERSION" \
  "$PUBLIC_URL" \
  "$ARCHIVE_SHA256" \
  "$ARTIFACT_FORMAT" \
  "$LAUNCHER_RELATIVE_PATH"

echo "Updated runtime bootstrap config:"
echo "  $RUNTIME_CONFIG_PATH"
