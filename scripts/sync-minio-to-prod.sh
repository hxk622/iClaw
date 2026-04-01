#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

: "${ICLAW_SOURCE_MINIO_ALIAS:=source}"
: "${ICLAW_SOURCE_MINIO_URL:=http://47.93.231.197:9000}"
: "${ICLAW_SOURCE_MINIO_ACCESS_KEY:=openalpha}"
: "${ICLAW_SOURCE_MINIO_SECRET_KEY:=}"

: "${ICLAW_PROD_MINIO_ALIAS:=prodsync}"
: "${ICLAW_PROD_MINIO_URL:=http://115.191.6.179:9000}"
: "${ICLAW_PROD_MINIO_ACCESS_KEY:=openalpha}"
: "${ICLAW_PROD_MINIO_SECRET_KEY:=}"
: "${ICLAW_MINIO_BUCKET_MANIFEST:=${ROOT_DIR}/services/control-plane/presets/core-oem.json}"

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

if [[ -n "${ICLAW_SYNC_BUCKETS:-}" ]]; then
  mapfile -t sync_buckets < <(printf '%s\n' "${ICLAW_SYNC_BUCKETS}" | tr ',' '\n' | awk 'NF')
else
  mapfile -t sync_buckets < <(
    env \
      USER_ASSETS_BUCKET="${USER_ASSETS_BUCKET:-}" \
      ICLAW_USER_ASSETS_BUCKET="${ICLAW_USER_ASSETS_BUCKET:-}" \
      ICLAW_EXTRA_SYNC_BUCKETS="${ICLAW_EXTRA_SYNC_BUCKETS:-}" \
      node "${ROOT_DIR}/scripts/list-minio-sync-buckets.mjs" --manifest "${ICLAW_MINIO_BUCKET_MANIFEST}"
  )
fi

if [[ ${#sync_buckets[@]} -eq 0 ]]; then
  echo "[minio-sync] no buckets resolved" >&2
  exit 1
fi

echo "[minio-sync] buckets: ${sync_buckets[*]}"

for bucket in "${sync_buckets[@]}"; do
  if ! mc ls "${ICLAW_SOURCE_MINIO_ALIAS}/${bucket}" >/dev/null 2>&1; then
    echo "[minio-sync] skip missing source bucket: ${bucket}"
    continue
  fi

  mc mb --ignore-existing "${ICLAW_PROD_MINIO_ALIAS}/${bucket}" >/dev/null
  echo "[minio-sync] mirroring ${bucket}"
  mc mirror --overwrite "${ICLAW_SOURCE_MINIO_ALIAS}/${bucket}" "${ICLAW_PROD_MINIO_ALIAS}/${bucket}"
done

echo "[minio-sync] done"
