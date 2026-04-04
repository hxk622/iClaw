#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/openclaw-package.sh"

ENV_NAME="${1:-prod}"
TARGET_TRIPLE="${2:-${ICLAW_OPENCLAW_RUNTIME_TARGET:-$(openclaw_host_target_triple || true)}}"
export ICLAW_PACKAGING_ENV="$ENV_NAME"
RUNTIME_CONFIG_PATH="$(openclaw_runtime_bootstrap_config_path "$ROOT_DIR")"
RUNTIME_PREFIX_DEFAULT="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" runtimeDistribution.minioPrefix | tail -n1)"
RUNTIME_DEV_BUCKET_DEFAULT="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" runtimeDistribution.dev.bucket | tail -n1)"
RUNTIME_PROD_BUCKET_DEFAULT="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" runtimeDistribution.prod.bucket | tail -n1)"
RUNTIME_DEV_BASE_URL_DEFAULT="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" runtimeDistribution.dev.publicBaseUrl | tail -n1)"
RUNTIME_PROD_BASE_URL_DEFAULT="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" runtimeDistribution.prod.publicBaseUrl | tail -n1)"

if [[ ! -f "$RUNTIME_CONFIG_PATH" ]]; then
  echo "Missing runtime config: $RUNTIME_CONFIG_PATH" >&2
  exit 1
fi

read_runtime_field() {
  local key="$1"
  node -e '
const fs = require("fs");
const [configPath, key, targetTriple] = process.argv.slice(1);
const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
const root = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
const artifacts = root.artifacts && typeof root.artifacts === "object" && !Array.isArray(root.artifacts) ? root.artifacts : {};
const scoped = targetTriple && artifacts[targetTriple] && typeof artifacts[targetTriple] === "object" && !Array.isArray(artifacts[targetTriple])
  ? artifacts[targetTriple]
  : null;
const value = scoped && typeof scoped[key] !== "undefined" ? scoped[key] : root[key];
if (typeof value === "string") process.stdout.write(value);
' "$RUNTIME_CONFIG_PATH" "$key" "$TARGET_TRIPLE"
}

VERSION="$(read_runtime_field version)"
ARCHIVE_PATH_RAW="$(read_runtime_field artifact_url)"
ARCHIVE_SHA256="$(read_runtime_field artifact_sha256)"
ARTIFACT_FORMAT="$(read_runtime_field artifact_format)"
LAUNCHER_RELATIVE_PATH="$(read_runtime_field launcher_relative_path)"

if [[ -z "$TARGET_TRIPLE" ]]; then
  echo "Unable to determine runtime target triple; pass it as the second argument or set ICLAW_OPENCLAW_RUNTIME_TARGET" >&2
  exit 1
fi

if [[ -z "$VERSION" ]]; then
  echo "Runtime version missing in $RUNTIME_CONFIG_PATH" >&2
  exit 1
fi

if [[ -z "$ARTIFACT_FORMAT" ]]; then
  ARTIFACT_FORMAT="tar.gz"
fi

resolve_publish_source_archive() {
  local explicit_path="${ICLAW_OPENCLAW_RUNTIME_ARCHIVE_PATH:-${OPENCLAW_RUNTIME_ARCHIVE_PATH:-}}"
  if [[ -n "$explicit_path" ]]; then
    openclaw_abs_path "$explicit_path"
    return 0
  fi

  if [[ -n "$ARCHIVE_PATH_RAW" && "$ARCHIVE_PATH_RAW" != http://* && "$ARCHIVE_PATH_RAW" != https://* ]]; then
    openclaw_abs_path "$ARCHIVE_PATH_RAW"
    return 0
  fi

  openclaw_local_runtime_archive_path "$ROOT_DIR" "$VERSION" "$TARGET_TRIPLE" "$ARTIFACT_FORMAT"
}

ARCHIVE_PATH="$(resolve_publish_source_archive)"
if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "Runtime archive not found for publish source: $ARCHIVE_PATH" >&2
  echo "Build it first with pnpm build:openclaw-runtime, or pass ICLAW_OPENCLAW_RUNTIME_ARCHIVE_PATH=/abs/path/to/archive" >&2
  exit 1
fi

DETECTED_TARGET_TRIPLE="$(openclaw_detect_runtime_target_triple "$ARCHIVE_PATH" || true)"
if [[ -n "$DETECTED_TARGET_TRIPLE" && "$DETECTED_TARGET_TRIPLE" != "$TARGET_TRIPLE" ]]; then
  echo "Runtime archive target mismatch: expected $TARGET_TRIPLE but got $DETECTED_TARGET_TRIPLE from $ARCHIVE_PATH" >&2
  exit 1
fi

runtime_public_url_for() {
  local base_url="$1"
  local object_key="$2"
  local normalized="${base_url%/}"
  printf '%s/%s\n' "$normalized" "$object_key"
}

normalize_base_url() {
  local value="$1"
  printf '%s\n' "${value%/}"
}

EXPECTED_RUNTIME_PUBLIC_BASE_URL=""

case "$ENV_NAME" in
  dev)
    : "${ICLAW_RUNTIME_MINIO_ALIAS:=${ICLAW_MINIO_DEV_ALIAS:-local}}"
    : "${ICLAW_RUNTIME_MINIO_BUCKET:=${ICLAW_MINIO_DEV_BUCKET:-$RUNTIME_DEV_BUCKET_DEFAULT}}"
    EXPECTED_RUNTIME_PUBLIC_BASE_URL="${RUNTIME_DEV_BASE_URL_DEFAULT:-http://127.0.0.1:9000/$ICLAW_RUNTIME_MINIO_BUCKET}"
    : "${ICLAW_RUNTIME_PUBLIC_BASE_URL:=${RUNTIME_DEV_BASE_URL_DEFAULT:-http://127.0.0.1:9000/$ICLAW_RUNTIME_MINIO_BUCKET}}"
    ;;
  prod)
    : "${ICLAW_RUNTIME_MINIO_ALIAS:=${ICLAW_MINIO_PROD_ALIAS:-remoteprod}}"
    : "${ICLAW_RUNTIME_MINIO_BUCKET:=${ICLAW_MINIO_PROD_BUCKET:-$RUNTIME_PROD_BUCKET_DEFAULT}}"
    EXPECTED_RUNTIME_PUBLIC_BASE_URL="${RUNTIME_PROD_BASE_URL_DEFAULT:-}"
    : "${ICLAW_RUNTIME_PUBLIC_BASE_URL:=${RUNTIME_PROD_BASE_URL_DEFAULT:-}}"
    ;;
  *)
    echo "Unknown env: $ENV_NAME (use dev or prod)" >&2
    exit 1
    ;;
esac

: "${ICLAW_RUNTIME_MINIO_PREFIX:=$RUNTIME_PREFIX_DEFAULT}"

if [[ -z "${ICLAW_RUNTIME_PUBLIC_BASE_URL:-}" ]]; then
  echo "ICLAW_RUNTIME_PUBLIC_BASE_URL is required for brand $(node "$ROOT_DIR/scripts/read-brand-value.mjs" brandId | tail -n1) env $ENV_NAME" >&2
  exit 1
fi

NORMALIZED_RUNTIME_PUBLIC_BASE_URL="$(normalize_base_url "$ICLAW_RUNTIME_PUBLIC_BASE_URL")"
NORMALIZED_EXPECTED_RUNTIME_PUBLIC_BASE_URL="$(normalize_base_url "$EXPECTED_RUNTIME_PUBLIC_BASE_URL")"
if [[ -n "$NORMALIZED_EXPECTED_RUNTIME_PUBLIC_BASE_URL" && "$NORMALIZED_RUNTIME_PUBLIC_BASE_URL" != "$NORMALIZED_EXPECTED_RUNTIME_PUBLIC_BASE_URL" ]]; then
  if [[ "${ICLAW_RUNTIME_ALLOW_PUBLIC_BASE_URL_OVERRIDE:-0}" != "1" ]]; then
    echo "ICLAW_RUNTIME_PUBLIC_BASE_URL mismatch for env $ENV_NAME" >&2
    echo "  expected: $NORMALIZED_EXPECTED_RUNTIME_PUBLIC_BASE_URL" >&2
    echo "  actual:   $NORMALIZED_RUNTIME_PUBLIC_BASE_URL" >&2
    echo "If this override is intentional, rerun with ICLAW_RUNTIME_ALLOW_PUBLIC_BASE_URL_OVERRIDE=1" >&2
    exit 1
  fi
  echo "[publish-openclaw-runtime] allowing overridden public base url: $NORMALIZED_RUNTIME_PUBLIC_BASE_URL" >&2
fi
ICLAW_RUNTIME_PUBLIC_BASE_URL="$NORMALIZED_RUNTIME_PUBLIC_BASE_URL"

if ! command -v mc >/dev/null 2>&1; then
  echo "mc not found in PATH" >&2
  exit 1
fi

OBJECT_NAME="$(basename "$ARCHIVE_PATH")"
OBJECT_KEY="${ICLAW_RUNTIME_MINIO_PREFIX%/}/openclaw/$VERSION/$OBJECT_NAME"
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
  "$LAUNCHER_RELATIVE_PATH" \
  "$TARGET_TRIPLE"

echo "Updated runtime bootstrap config:"
echo "  $RUNTIME_CONFIG_PATH"
