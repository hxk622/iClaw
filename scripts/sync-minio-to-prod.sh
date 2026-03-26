#!/usr/bin/env bash
set -euo pipefail

: "${ICLAW_SOURCE_MINIO_ALIAS:=source}"
: "${ICLAW_SOURCE_MINIO_URL:=http://39.106.74.65:9000}"
: "${ICLAW_SOURCE_MINIO_ACCESS_KEY:=openalpha}"
: "${ICLAW_SOURCE_MINIO_SECRET_KEY:=}"

: "${ICLAW_PROD_MINIO_ALIAS:=prodsync}"
: "${ICLAW_PROD_MINIO_URL:=http://115.191.6.179:9000}"
: "${ICLAW_PROD_MINIO_ACCESS_KEY:=openalpha}"
: "${ICLAW_PROD_MINIO_SECRET_KEY:=}"

: "${ICLAW_FILE_BUCKET:=licaiclaw-files}"
: "${ICLAW_RELEASE_BUCKET:=licaiclaw-prod}"

if [[ -z "${ICLAW_SOURCE_MINIO_SECRET_KEY}" ]]; then
  echo "ICLAW_SOURCE_MINIO_SECRET_KEY is required" >&2
  exit 1
fi

if [[ -z "${ICLAW_PROD_MINIO_SECRET_KEY}" ]]; then
  echo "ICLAW_PROD_MINIO_SECRET_KEY is required" >&2
  exit 1
fi

mc alias set "${ICLAW_SOURCE_MINIO_ALIAS}" "${ICLAW_SOURCE_MINIO_URL}" "${ICLAW_SOURCE_MINIO_ACCESS_KEY}" "${ICLAW_SOURCE_MINIO_SECRET_KEY}" >/dev/null
mc alias set "${ICLAW_PROD_MINIO_ALIAS}" "${ICLAW_PROD_MINIO_URL}" "${ICLAW_PROD_MINIO_ACCESS_KEY}" "${ICLAW_PROD_MINIO_SECRET_KEY}" >/dev/null

mc mb --ignore-existing "${ICLAW_PROD_MINIO_ALIAS}/${ICLAW_FILE_BUCKET}" >/dev/null
mc mb --ignore-existing "${ICLAW_PROD_MINIO_ALIAS}/${ICLAW_RELEASE_BUCKET}" >/dev/null

echo "[minio-sync] mirroring ${ICLAW_FILE_BUCKET}"
mc mirror --overwrite "${ICLAW_SOURCE_MINIO_ALIAS}/${ICLAW_FILE_BUCKET}" "${ICLAW_PROD_MINIO_ALIAS}/${ICLAW_FILE_BUCKET}"

echo "[minio-sync] mirroring ${ICLAW_RELEASE_BUCKET}"
mc mirror --overwrite "${ICLAW_SOURCE_MINIO_ALIAS}/${ICLAW_RELEASE_BUCKET}" "${ICLAW_PROD_MINIO_ALIAS}/${ICLAW_RELEASE_BUCKET}"

echo "[minio-sync] done"
