#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RAW_ENV="${1:-}"

if [[ -z "$RAW_ENV" ]]; then
  echo "[with-env] Missing target env (use dev | test | prod)" >&2
  exit 1
fi

shift || true

if [[ $# -eq 0 ]]; then
  echo "[with-env] Missing command to run" >&2
  exit 1
fi

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

strip_wrapping_quotes() {
  local value="$1"
  local length="${#value}"
  if [[ "$length" -ge 2 ]]; then
    local first="${value:0:1}"
    local last="${value: -1}"
    if [[ ( "$first" == '"' && "$last" == '"' ) || ( "$first" == "'" && "$last" == "'" ) ]]; then
      printf '%s' "${value:1:length-2}"
      return
    fi
  fi
  printf '%s' "$value"
}

load_env_vars() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  local raw_line=""
  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    local line="$raw_line"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    if [[ -z "$line" || "${line:0:1}" == "#" ]]; then
      continue
    fi

    if [[ "$line" != *=* ]]; then
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    value="$(strip_wrapping_quotes "$value")"
    export "$key=$value"
  done <"$file"
}

append_env_file() {
  local file="$1"
  local target="$2"
  [[ -f "$file" ]] || return 0
  printf '\n# merged from %s\n' "$(basename "$file")" >>"$target"
  cat "$file" >>"$target"
}

TARGET_ENV="$(normalize_env "$RAW_ENV")"
if [[ -z "$TARGET_ENV" ]]; then
  echo "[with-env] Unsupported env: $RAW_ENV" >&2
  echo "[with-env] Use one of: dev | test | prod" >&2
  exit 1
fi

SOURCE_FILE="$ROOT_DIR/.env.$TARGET_ENV"
TARGET_FILE="$ROOT_DIR/.env"
COMMON_OVERRIDE_FILE="$ROOT_DIR/.env.local"
ENV_OVERRIDE_FILE="$ROOT_DIR/.env.$TARGET_ENV.local"

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "[with-env] Source file not found: $SOURCE_FILE" >&2
  exit 1
fi

BACKUP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/iclaw-env-backup.XXXXXX")"
BACKUP_FILE="$BACKUP_DIR/.env.backup"
TARGET_EXISTED="0"

if [[ -f "$TARGET_FILE" ]]; then
  cp "$TARGET_FILE" "$BACKUP_FILE"
  TARGET_EXISTED="1"
fi

restore_env() {
  if [[ "$TARGET_EXISTED" == "1" && -f "$BACKUP_FILE" ]]; then
    cp "$BACKUP_FILE" "$TARGET_FILE"
  else
    rm -f "$TARGET_FILE"
  fi
  rm -rf "$BACKUP_DIR"
}

trap restore_env EXIT

cp "$SOURCE_FILE" "$TARGET_FILE"
append_env_file "$COMMON_OVERRIDE_FILE" "$TARGET_FILE"
append_env_file "$ENV_OVERRIDE_FILE" "$TARGET_FILE"
echo "[with-env] Applied $SOURCE_FILE for command: $*"
# Export the selected env file into the child process so stale shell-level
# variables (for example DATABASE_URL from another terminal session) cannot
# override the intended environment.
load_env_vars "$SOURCE_FILE"
load_env_vars "$COMMON_OVERRIDE_FILE"
load_env_vars "$ENV_OVERRIDE_FILE"
export ICLAW_ENV_NAME="$TARGET_ENV"
"$@"
