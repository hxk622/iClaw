#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

: "${ICLAW_SOURCE_HOST:=47.93.231.197}"
: "${ICLAW_SOURCE_USER:=root}"
: "${ICLAW_PROD_HOST:=115.191.6.179}"
: "${ICLAW_PROD_USER:=root}"
: "${ICLAW_SOURCE_DB_URL:=postgresql://iclaw_app:change_me@127.0.0.1:5432/iclaw_control}"
: "${ICLAW_PROD_DB_URL:=postgresql://iclaw_app:change_me@127.0.0.1:5432/iclaw_control_prod}"
: "${ICLAW_SYNC_SCHEMA:=app}"

STAMP="$(date +%Y%m%d%H%M%S)"
LOCAL_TMP_DIR="${ROOT_DIR}/.tmp-db-sync"
LOCAL_DUMP_PATH="${LOCAL_TMP_DIR}/${ICLAW_SYNC_SCHEMA}_${STAMP}.dump"
SOURCE_REMOTE_DUMP="/root/iclaw-sync/${ICLAW_SYNC_SCHEMA}_${STAMP}.dump"
PROD_REMOTE_RESTORE_DIR="/root/iclaw-restore"
PROD_REMOTE_BACKUP_DIR="/root/iclaw-backups"
PROD_REMOTE_DUMP="${PROD_REMOTE_RESTORE_DIR}/${ICLAW_SYNC_SCHEMA}_${STAMP}.dump"

mkdir -p "${LOCAL_TMP_DIR}"

echo "[db-sync] dumping ${ICLAW_SYNC_SCHEMA} from ${ICLAW_SOURCE_USER}@${ICLAW_SOURCE_HOST}"
ssh "${ICLAW_SOURCE_USER}@${ICLAW_SOURCE_HOST}" \
  "mkdir -p /root/iclaw-sync && pg_dump -Fc -n ${ICLAW_SYNC_SCHEMA} -f ${SOURCE_REMOTE_DUMP} '${ICLAW_SOURCE_DB_URL}'"

echo "[db-sync] downloading source dump to ${LOCAL_DUMP_PATH}"
rsync -a "${ICLAW_SOURCE_USER}@${ICLAW_SOURCE_HOST}:${SOURCE_REMOTE_DUMP}" "${LOCAL_DUMP_PATH}"

echo "[db-sync] backing up prod ${ICLAW_SYNC_SCHEMA} on ${ICLAW_PROD_USER}@${ICLAW_PROD_HOST}"
ssh "${ICLAW_PROD_USER}@${ICLAW_PROD_HOST}" \
  "mkdir -p ${PROD_REMOTE_BACKUP_DIR} ${PROD_REMOTE_RESTORE_DIR} && pg_dump -Fc -n ${ICLAW_SYNC_SCHEMA} -f ${PROD_REMOTE_BACKUP_DIR}/iclaw_control_prod_${ICLAW_SYNC_SCHEMA}_${STAMP}.dump '${ICLAW_PROD_DB_URL}'"

echo "[db-sync] uploading dump to prod host"
rsync -a "${LOCAL_DUMP_PATH}" "${ICLAW_PROD_USER}@${ICLAW_PROD_HOST}:${PROD_REMOTE_DUMP}"

echo "[db-sync] restoring ${ICLAW_SYNC_SCHEMA} into prod and restarting control-plane"
ssh "${ICLAW_PROD_USER}@${ICLAW_PROD_HOST}" \
  "cd /opt/iclaw && pm2 stop iclaw-control-plane && pg_restore --clean --if-exists --no-owner --no-privileges -d '${ICLAW_PROD_DB_URL}' '${PROD_REMOTE_DUMP}' && pm2 start iclaw-control-plane"

echo "[db-sync] verifying prod health"
curl -sS https://caiclaw.aiyuanxi.com/health

echo
echo "[db-sync] done"
