#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

: "${ICLAW_SOURCE_HOST:=47.93.231.197}"
: "${ICLAW_SOURCE_USER:=root}"
: "${ICLAW_PROD_HOST:=39.106.110.149}"
: "${ICLAW_PROD_USER:=root}"
: "${ICLAW_SOURCE_DB_URL:=postgresql://iclaw_app:change_me@127.0.0.1:5432/iclaw_control}"
: "${ICLAW_PROD_DB_URL:=postgresql://iclaw_app:change_me@127.0.0.1:5432/iclaw_control_prod}"
: "${ICLAW_SYNC_SCHEMA:=app}"
: "${ICLAW_PRESERVE_TABLES:=}"

STAMP="$(date +%Y%m%d%H%M%S)"
LOCAL_TMP_DIR="${ROOT_DIR}/.tmp-db-sync"
LOCAL_DUMP_PATH="${LOCAL_TMP_DIR}/${ICLAW_SYNC_SCHEMA}_${STAMP}.dump"
SOURCE_REMOTE_DUMP="/root/iclaw-sync/${ICLAW_SYNC_SCHEMA}_${STAMP}.dump"
PROD_REMOTE_RESTORE_DIR="/root/iclaw-restore"
PROD_REMOTE_BACKUP_DIR="/root/iclaw-backups"
PROD_REMOTE_DUMP="${PROD_REMOTE_RESTORE_DIR}/${ICLAW_SYNC_SCHEMA}_${STAMP}.dump"
PROD_REMOTE_PRESERVE_DUMP="${PROD_REMOTE_BACKUP_DIR}/iclaw_control_prod_${ICLAW_SYNC_SCHEMA}_preserve_${STAMP}.dump"

shell_join() {
  local joined=""
  local arg=""
  for arg in "$@"; do
    joined+=" $(printf '%q' "$arg")"
  done
  printf '%s' "${joined# }"
}

mkdir -p "${LOCAL_TMP_DIR}"

preserve_tables=()
preserve_table_args=()
preserve_truncate_list=()
if [[ -n "${ICLAW_PRESERVE_TABLES}" ]]; then
  while IFS= read -r table_name; do
    [[ -z "${table_name}" ]] && continue
    qualified_name="${table_name}"
    if [[ "${table_name}" != *.* ]]; then
      qualified_name="${ICLAW_SYNC_SCHEMA}.${table_name}"
    fi
    preserve_tables+=("${qualified_name}")
    preserve_table_args+=("--table=${qualified_name}")
    preserve_truncate_list+=("${qualified_name}")
  done < <(printf '%s\n' "${ICLAW_PRESERVE_TABLES}" | tr ',' '\n' | awk 'NF')
fi

echo "[db-sync] dumping ${ICLAW_SYNC_SCHEMA} from ${ICLAW_SOURCE_USER}@${ICLAW_SOURCE_HOST}"
ssh "${ICLAW_SOURCE_USER}@${ICLAW_SOURCE_HOST}" \
  "mkdir -p /root/iclaw-sync && pg_dump -Fc -n ${ICLAW_SYNC_SCHEMA} -f ${SOURCE_REMOTE_DUMP} '${ICLAW_SOURCE_DB_URL}'"

echo "[db-sync] downloading source dump to ${LOCAL_DUMP_PATH}"
rsync -a "${ICLAW_SOURCE_USER}@${ICLAW_SOURCE_HOST}:${SOURCE_REMOTE_DUMP}" "${LOCAL_DUMP_PATH}"

echo "[db-sync] backing up prod ${ICLAW_SYNC_SCHEMA} on ${ICLAW_PROD_USER}@${ICLAW_PROD_HOST}"
ssh "${ICLAW_PROD_USER}@${ICLAW_PROD_HOST}" \
  "mkdir -p ${PROD_REMOTE_BACKUP_DIR} ${PROD_REMOTE_RESTORE_DIR} && pg_dump -Fc -n ${ICLAW_SYNC_SCHEMA} -f ${PROD_REMOTE_BACKUP_DIR}/iclaw_control_prod_${ICLAW_SYNC_SCHEMA}_${STAMP}.dump '${ICLAW_PROD_DB_URL}'"

if [[ ${#preserve_tables[@]} -gt 0 ]]; then
  echo "[db-sync] preserving prod table data: ${preserve_tables[*]}"
  preserve_dump_args=(
    -Fc
    --data-only
    --disable-triggers
    -f
    "${PROD_REMOTE_PRESERVE_DUMP}"
    "${ICLAW_PROD_DB_URL}"
  )
  preserve_dump_args=("${preserve_table_args[@]}" "${preserve_dump_args[@]}")
  ssh "${ICLAW_PROD_USER}@${ICLAW_PROD_HOST}" \
    "pg_dump $(shell_join "${preserve_dump_args[@]}")"
fi

echo "[db-sync] uploading dump to prod host"
rsync -a "${LOCAL_DUMP_PATH}" "${ICLAW_PROD_USER}@${ICLAW_PROD_HOST}:${PROD_REMOTE_DUMP}"

echo "[db-sync] restoring ${ICLAW_SYNC_SCHEMA} into prod and restarting control-plane"
restore_command="cd /opt/iclaw && pm2 stop iclaw-control-plane && pg_restore --clean --if-exists --no-owner --no-privileges -d '${ICLAW_PROD_DB_URL}' '${PROD_REMOTE_DUMP}'"
if [[ ${#preserve_truncate_list[@]} -gt 0 ]]; then
  truncate_list_csv="$(IFS=, ; printf '%s' "${preserve_truncate_list[*]}")"
  truncate_sql="TRUNCATE TABLE ${truncate_list_csv} CASCADE;"
  restore_command+=" && psql '${ICLAW_PROD_DB_URL}' -v ON_ERROR_STOP=1 -c $(printf '%q' "${truncate_sql}")"
  restore_command+=" && pg_restore --data-only --disable-triggers --no-owner --no-privileges -d '${ICLAW_PROD_DB_URL}' '${PROD_REMOTE_PRESERVE_DUMP}'"
fi
restore_command+=" && pm2 start iclaw-control-plane"
ssh "${ICLAW_PROD_USER}@${ICLAW_PROD_HOST}" "${restore_command}"

echo "[db-sync] verifying prod health"
curl -sS https://caiclaw.aiyuanxi.com/health

echo
echo "[db-sync] done"
