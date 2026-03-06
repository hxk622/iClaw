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

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "[env] Source file not found: $SOURCE_FILE" >&2
  exit 1
fi

cp "$SOURCE_FILE" "$TARGET_FILE"
echo "[env] Applied $SOURCE_FILE -> $TARGET_FILE"
