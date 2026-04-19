#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-${ICLAW_CROSS_BACKUP_ENV_FILE:-/etc/iclaw/cross-backup.env}}"

if [[ -n "${ENV_FILE}" && -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
elif [[ -n "${ENV_FILE}" && ( $# -gt 0 || -n "${ICLAW_CROSS_BACKUP_ENV_FILE:-}" ) ]]; then
  echo "[cross-backup] env file not found: ${ENV_FILE}" >&2
  exit 1
fi

: "${ICLAW_CROSS_BACKUP_NODE_NAME:=}"
: "${ICLAW_CROSS_BACKUP_LOCAL_TMP_DIR:=/var/tmp/iclaw-cross-backup}"
: "${ICLAW_CROSS_BACKUP_PG_ENABLED:=1}"
: "${ICLAW_CROSS_BACKUP_PG_URL:=}"
: "${ICLAW_CROSS_BACKUP_PG_SCHEMA:=app}"
: "${ICLAW_CROSS_BACKUP_PG_LABEL:=control-plane}"
: "${ICLAW_CROSS_BACKUP_PG_BUCKET:=iclaw-cross-backup-postgres}"
: "${ICLAW_CROSS_BACKUP_PG_PREFIX:=${ICLAW_CROSS_BACKUP_NODE_NAME}/current}"
: "${ICLAW_CROSS_BACKUP_PG_OBJECT_NAME:=${ICLAW_CROSS_BACKUP_NODE_NAME}-${ICLAW_CROSS_BACKUP_PG_LABEL}.dump}"
: "${ICLAW_CROSS_BACKUP_S3_ENABLED:=1}"
: "${ICLAW_CROSS_BACKUP_S3_BUCKETS:=}"
: "${ICLAW_CROSS_BACKUP_S3_SOURCE_ALIAS:=iclawcrosssrc}"
: "${ICLAW_CROSS_BACKUP_S3_SOURCE_ENDPOINT:=}"
: "${ICLAW_CROSS_BACKUP_S3_SOURCE_ACCESS_KEY:=}"
: "${ICLAW_CROSS_BACKUP_S3_SOURCE_SECRET_KEY:=}"
: "${ICLAW_CROSS_BACKUP_S3_TARGET_ALIAS:=iclawcrosstgt}"
: "${ICLAW_CROSS_BACKUP_S3_TARGET_ENDPOINT:=}"
: "${ICLAW_CROSS_BACKUP_S3_TARGET_ACCESS_KEY:=}"
: "${ICLAW_CROSS_BACKUP_S3_TARGET_SECRET_KEY:=}"
: "${ICLAW_CROSS_BACKUP_S3_BACKUP_BUCKET_PREFIX:=iclaw-cross-backup}"
: "${ICLAW_CROSS_BACKUP_MANIFEST_BUCKET:=iclaw-cross-backup-manifests}"
: "${ICLAW_CROSS_BACKUP_MANIFEST_PREFIX:=${ICLAW_CROSS_BACKUP_NODE_NAME}}"
: "${ICLAW_CROSS_BACKUP_MANIFEST_OBJECT_NAME:=latest.txt}"
: "${ICLAW_CROSS_BACKUP_ENABLE_VERSIONING:=0}"
: "${ICLAW_CROSS_BACKUP_S3_MIRROR_REMOVE:=1}"

RUN_TIMESTAMP_UTC="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR=""
POSTGRES_OBJECT_PATH=""
POSTGRES_CHECKSUM=""
MIRRORED_BUCKETS=()

log() {
  echo "[cross-backup] $*"
}

fail() {
  echo "[cross-backup] $*" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    fail "missing required command: ${cmd}"
  fi
}

require_value() {
  local key="$1"
  local value="${!key:-}"
  if [[ -z "${value}" ]]; then
    fail "missing required env: ${key}"
  fi
}

cleanup() {
  if [[ -n "${RUN_DIR}" && -d "${RUN_DIR}" ]]; then
    rm -rf "${RUN_DIR}"
  fi
}

checksum_file() {
  local file_path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${file_path}" | awk '{print $1}'
    return
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${file_path}" | awk '{print $1}'
    return
  fi
  fail "missing checksum tool: sha256sum or shasum"
}

trim() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

sanitize_bucket_name() {
  local raw="$1"
  local sanitized
  sanitized="$(
    printf '%s' "${raw}" |
      tr '[:upper:]' '[:lower:]' |
      sed \
        -e 's/[^a-z0-9.-]/-/g' \
        -e 's/--*/-/g' \
        -e 's/\.\.+/./g' \
        -e 's/^[.-]*//' \
        -e 's/[.-]*$//'
  )"
  sanitized="${sanitized:0:63}"
  sanitized="$(printf '%s' "${sanitized}" | sed -e 's/[.-]*$//' -e 's/^[.-]*//')"
  if [[ -z "${sanitized}" ]]; then
    sanitized="iclaw-cross-backup"
  fi
  printf '%s' "${sanitized}"
}

ensure_target_bucket() {
  local bucket_name="$1"
  mc mb --ignore-existing "${ICLAW_CROSS_BACKUP_S3_TARGET_ALIAS}/${bucket_name}" >/dev/null
  if [[ "${ICLAW_CROSS_BACKUP_ENABLE_VERSIONING}" == "1" ]]; then
    mc version enable "${ICLAW_CROSS_BACKUP_S3_TARGET_ALIAS}/${bucket_name}" >/dev/null 2>&1 || true
  else
    mc version suspend "${ICLAW_CROSS_BACKUP_S3_TARGET_ALIAS}/${bucket_name}" >/dev/null 2>&1 || true
  fi
}

init_target_alias() {
  require_value ICLAW_CROSS_BACKUP_S3_TARGET_ENDPOINT
  require_value ICLAW_CROSS_BACKUP_S3_TARGET_ACCESS_KEY
  require_value ICLAW_CROSS_BACKUP_S3_TARGET_SECRET_KEY
  mc alias set \
    "${ICLAW_CROSS_BACKUP_S3_TARGET_ALIAS}" \
    "${ICLAW_CROSS_BACKUP_S3_TARGET_ENDPOINT}" \
    "${ICLAW_CROSS_BACKUP_S3_TARGET_ACCESS_KEY}" \
    "${ICLAW_CROSS_BACKUP_S3_TARGET_SECRET_KEY}" >/dev/null
}

init_source_alias() {
  require_value ICLAW_CROSS_BACKUP_S3_SOURCE_ENDPOINT
  require_value ICLAW_CROSS_BACKUP_S3_SOURCE_ACCESS_KEY
  require_value ICLAW_CROSS_BACKUP_S3_SOURCE_SECRET_KEY
  mc alias set \
    "${ICLAW_CROSS_BACKUP_S3_SOURCE_ALIAS}" \
    "${ICLAW_CROSS_BACKUP_S3_SOURCE_ENDPOINT}" \
    "${ICLAW_CROSS_BACKUP_S3_SOURCE_ACCESS_KEY}" \
    "${ICLAW_CROSS_BACKUP_S3_SOURCE_SECRET_KEY}" >/dev/null
}

backup_postgres() {
  require_command pg_dump
  require_value ICLAW_CROSS_BACKUP_PG_URL
  require_value ICLAW_CROSS_BACKUP_PG_OBJECT_NAME

  local dump_name="${ICLAW_CROSS_BACKUP_PG_OBJECT_NAME}"
  local dump_path="${RUN_DIR}/${dump_name}"
  local checksum_path="${dump_path}.sha256"

  log "dumping PostgreSQL (${ICLAW_CROSS_BACKUP_PG_LABEL})"
  if [[ -n "${ICLAW_CROSS_BACKUP_PG_SCHEMA}" ]]; then
    pg_dump -Fc -n "${ICLAW_CROSS_BACKUP_PG_SCHEMA}" -f "${dump_path}" "${ICLAW_CROSS_BACKUP_PG_URL}"
  else
    pg_dump -Fc -f "${dump_path}" "${ICLAW_CROSS_BACKUP_PG_URL}"
  fi

  POSTGRES_CHECKSUM="$(checksum_file "${dump_path}")"
  printf '%s  %s\n' "${POSTGRES_CHECKSUM}" "${dump_name}" >"${checksum_path}"

  ensure_target_bucket "${ICLAW_CROSS_BACKUP_PG_BUCKET}"
  mc cp "${dump_path}" \
    "${ICLAW_CROSS_BACKUP_S3_TARGET_ALIAS}/${ICLAW_CROSS_BACKUP_PG_BUCKET}/${ICLAW_CROSS_BACKUP_PG_PREFIX}/${dump_name}"
  mc cp "${checksum_path}" \
    "${ICLAW_CROSS_BACKUP_S3_TARGET_ALIAS}/${ICLAW_CROSS_BACKUP_PG_BUCKET}/${ICLAW_CROSS_BACKUP_PG_PREFIX}/${dump_name}.sha256"

  POSTGRES_OBJECT_PATH="${ICLAW_CROSS_BACKUP_PG_BUCKET}/${ICLAW_CROSS_BACKUP_PG_PREFIX}/${dump_name}"
  log "postgres uploaded to ${POSTGRES_OBJECT_PATH}"
}

backup_s3_buckets() {
  local bucket_name=""
  local backup_bucket_name=""
  local mirror_args=(--overwrite)

  if [[ "${ICLAW_CROSS_BACKUP_S3_MIRROR_REMOVE}" == "1" ]]; then
    mirror_args+=(--remove)
  fi

  while IFS= read -r bucket_name; do
    bucket_name="$(trim "${bucket_name}")"
    [[ -n "${bucket_name}" ]] || continue

    if ! mc ls "${ICLAW_CROSS_BACKUP_S3_SOURCE_ALIAS}/${bucket_name}" >/dev/null 2>&1; then
      log "skip missing source bucket: ${bucket_name}"
      continue
    fi

    backup_bucket_name="$(sanitize_bucket_name "${ICLAW_CROSS_BACKUP_S3_BACKUP_BUCKET_PREFIX}-${ICLAW_CROSS_BACKUP_NODE_NAME}-${bucket_name}")"
    ensure_target_bucket "${backup_bucket_name}"

    log "mirroring bucket ${bucket_name} -> ${backup_bucket_name}/data"
    mc mirror \
      "${mirror_args[@]}" \
      "${ICLAW_CROSS_BACKUP_S3_SOURCE_ALIAS}/${bucket_name}" \
      "${ICLAW_CROSS_BACKUP_S3_TARGET_ALIAS}/${backup_bucket_name}/data"

    MIRRORED_BUCKETS+=("${bucket_name}=${backup_bucket_name}")
  done < <(printf '%s\n' "${ICLAW_CROSS_BACKUP_S3_BUCKETS}" | tr ',' '\n')
}

upload_manifest() {
  local manifest_path="${RUN_DIR}/${ICLAW_CROSS_BACKUP_MANIFEST_OBJECT_NAME}"
  local mapping=""

  ensure_target_bucket "${ICLAW_CROSS_BACKUP_MANIFEST_BUCKET}"

  {
    echo "node_name=${ICLAW_CROSS_BACKUP_NODE_NAME}"
    echo "run_timestamp_utc=${RUN_TIMESTAMP_UTC}"
    echo "pg_enabled=${ICLAW_CROSS_BACKUP_PG_ENABLED}"
    if [[ -n "${POSTGRES_OBJECT_PATH}" ]]; then
      echo "postgres_object=${POSTGRES_OBJECT_PATH}"
      echo "postgres_sha256=${POSTGRES_CHECKSUM}"
      echo "postgres_schema=${ICLAW_CROSS_BACKUP_PG_SCHEMA}"
    fi
    echo "s3_enabled=${ICLAW_CROSS_BACKUP_S3_ENABLED}"
    for mapping in "${MIRRORED_BUCKETS[@]}"; do
      echo "s3_bucket=${mapping}"
    done
  } >"${manifest_path}"

  mc cp \
    "${manifest_path}" \
    "${ICLAW_CROSS_BACKUP_S3_TARGET_ALIAS}/${ICLAW_CROSS_BACKUP_MANIFEST_BUCKET}/${ICLAW_CROSS_BACKUP_MANIFEST_PREFIX}/${ICLAW_CROSS_BACKUP_MANIFEST_OBJECT_NAME}"
}

main() {
  trap cleanup EXIT

  require_command mc
  require_value ICLAW_CROSS_BACKUP_NODE_NAME

  if [[ "${ICLAW_CROSS_BACKUP_PG_ENABLED}" != "1" && "${ICLAW_CROSS_BACKUP_S3_ENABLED}" != "1" ]]; then
    fail "nothing to do: enable PostgreSQL and/or S3 backup"
  fi

  mkdir -p "${ICLAW_CROSS_BACKUP_LOCAL_TMP_DIR}"
  RUN_DIR="$(mktemp -d "${ICLAW_CROSS_BACKUP_LOCAL_TMP_DIR%/}/run-${RUN_TIMESTAMP_UTC}.XXXXXX")"

  init_target_alias

  if [[ "${ICLAW_CROSS_BACKUP_PG_ENABLED}" == "1" ]]; then
    backup_postgres
  fi

  if [[ "${ICLAW_CROSS_BACKUP_S3_ENABLED}" == "1" ]]; then
    require_value ICLAW_CROSS_BACKUP_S3_BUCKETS
    init_source_alias
    backup_s3_buckets
  fi

  upload_manifest
  log "done"
}

main "$@"
