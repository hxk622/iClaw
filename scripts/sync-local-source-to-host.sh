#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

: "${ICLAW_TARGET_HOST:=47.93.231.197}"
: "${ICLAW_TARGET_USER:=root}"
: "${ICLAW_LOCAL_DB_URL:=postgresql://iclaw_app:change_me@127.0.0.1:5432/iclaw_control}"
: "${ICLAW_TARGET_DB_URL:=postgresql://iclaw_app:%2Fyk1HMBzsnATxpaelZaEq8x1t2Vm3c8G@127.0.0.1:5432/iclaw_control}"
: "${ICLAW_SYNC_SCHEMA:=app}"
: "${ICLAW_LOCAL_MINIO_ALIAS:=localsrc}"
: "${ICLAW_LOCAL_MINIO_URL:=http://127.0.0.1:9000}"
: "${ICLAW_LOCAL_MINIO_ACCESS_KEY:=minioadmin}"
: "${ICLAW_LOCAL_MINIO_SECRET_KEY:=minioadmin}"
: "${ICLAW_TARGET_MINIO_ALIAS:=localsourcehost}"
: "${ICLAW_TARGET_MINIO_URL:=http://47.93.231.197:9000}"
: "${ICLAW_TARGET_MINIO_ACCESS_KEY:=openalpha}"
: "${ICLAW_TARGET_MINIO_SECRET_KEY:=b1+G+wc/UX28Eo4JDbirB6Abs6uVm6t1}"

STAMP="$(date +%Y%m%d%H%M%S)"
TMP_DIR="${ROOT_DIR}/.tmp-source-sync"
DUMP_PATH="${TMP_DIR}/${ICLAW_SYNC_SCHEMA}_${STAMP}.dump"
REMOTE_DUMP="/root/iclaw-source-sync/${ICLAW_SYNC_SCHEMA}_${STAMP}.dump"

mkdir -p "${TMP_DIR}"

echo "[source-sync] dumping local PostgreSQL schema ${ICLAW_SYNC_SCHEMA}"
pg_dump -Fc -n "${ICLAW_SYNC_SCHEMA}" -f "${DUMP_PATH}" "${ICLAW_LOCAL_DB_URL}"

echo "[source-sync] uploading dump to ${ICLAW_TARGET_USER}@${ICLAW_TARGET_HOST}"
ssh "${ICLAW_TARGET_USER}@${ICLAW_TARGET_HOST}" "mkdir -p /root/iclaw-source-sync"
rsync -a "${DUMP_PATH}" "${ICLAW_TARGET_USER}@${ICLAW_TARGET_HOST}:${REMOTE_DUMP}"

echo "[source-sync] restoring dump on target"
ssh "${ICLAW_TARGET_USER}@${ICLAW_TARGET_HOST}" \
  "pg_restore --clean --if-exists --no-owner --no-privileges -d '${ICLAW_TARGET_DB_URL}' '${REMOTE_DUMP}'"

echo "[source-sync] mirroring MinIO buckets"
mc alias set "${ICLAW_LOCAL_MINIO_ALIAS}" "${ICLAW_LOCAL_MINIO_URL}" "${ICLAW_LOCAL_MINIO_ACCESS_KEY}" "${ICLAW_LOCAL_MINIO_SECRET_KEY}" >/dev/null
mc alias set "${ICLAW_TARGET_MINIO_ALIAS}" "${ICLAW_TARGET_MINIO_URL}" "${ICLAW_TARGET_MINIO_ACCESS_KEY}" "${ICLAW_TARGET_MINIO_SECRET_KEY}" >/dev/null

for bucket in iclaw-files iclaw-user-assets licaiclaw-files caiclaw-prod openalpha-files; do
  if mc ls "${ICLAW_LOCAL_MINIO_ALIAS}/${bucket}" >/dev/null 2>&1; then
    mc mb --ignore-existing "${ICLAW_TARGET_MINIO_ALIAS}/${bucket}" >/dev/null
    mc mirror --overwrite "${ICLAW_LOCAL_MINIO_ALIAS}/${bucket}" "${ICLAW_TARGET_MINIO_ALIAS}/${bucket}"
  fi
done

echo "[source-sync] done"
