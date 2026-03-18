#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RAW_ENV="${1:-${NODE_ENV:-dev}}"

normalize_env() {
  local raw="$1"
  local normalized
  normalized="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  case "$normalized" in
    dev|development|local)
      echo "dev"
      ;;
    test|testing|staging)
      echo "test"
      ;;
    prod|production|release)
      echo "prod"
      ;;
    *)
      echo ""
      ;;
  esac
}

TARGET_ENV="$(normalize_env "$RAW_ENV")"
if [[ -z "$TARGET_ENV" ]]; then
  echo "[env] Unsupported env: $RAW_ENV" >&2
  echo "[env] Use one of: dev | test | prod" >&2
  exit 1
fi

SOURCE_FILE="$ROOT_DIR/.env.$TARGET_ENV"
TARGET_FILE="$ROOT_DIR/.env"
COMMON_OVERRIDE_FILE="$ROOT_DIR/.env.local"
ENV_OVERRIDE_FILE="$ROOT_DIR/.env.$TARGET_ENV.local"

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "[env] Source file not found: $SOURCE_FILE" >&2
  exit 1
fi

cp "$SOURCE_FILE" "$TARGET_FILE"
if [[ -f "$COMMON_OVERRIDE_FILE" ]]; then
  printf '\n# merged from %s\n' "$(basename "$COMMON_OVERRIDE_FILE")" >>"$TARGET_FILE"
  cat "$COMMON_OVERRIDE_FILE" >>"$TARGET_FILE"
fi
if [[ -f "$ENV_OVERRIDE_FILE" ]]; then
  printf '\n# merged from %s\n' "$(basename "$ENV_OVERRIDE_FILE")" >>"$TARGET_FILE"
  cat "$ENV_OVERRIDE_FILE" >>"$TARGET_FILE"
fi
echo "[env] Applied $SOURCE_FILE -> $TARGET_FILE"
