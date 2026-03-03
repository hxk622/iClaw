#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE_DIR="$ROOT_DIR/dist/releases"

ENV_NAME="${1:-dev}"

if [[ ! -d "$RELEASE_DIR" ]]; then
  echo "Missing release dir: $RELEASE_DIR" >&2
  exit 1
fi

if [[ "$ENV_NAME" == "dev" ]]; then
  : "${ICLAW_MINIO_DEV_ALIAS:=localminio}"
  : "${ICLAW_MINIO_DEV_BUCKET:=iclaw-dev}"
  mc cp --recursive "$RELEASE_DIR/" "$ICLAW_MINIO_DEV_ALIAS/$ICLAW_MINIO_DEV_BUCKET/"
  echo "Uploaded to dev minio: $ICLAW_MINIO_DEV_ALIAS/$ICLAW_MINIO_DEV_BUCKET"
elif [[ "$ENV_NAME" == "prod" ]]; then
  : "${ICLAW_MINIO_PROD_ALIAS:=volcminio}"
  : "${ICLAW_MINIO_PROD_BUCKET:=iclaw-prod}"
  mc cp --recursive "$RELEASE_DIR/" "$ICLAW_MINIO_PROD_ALIAS/$ICLAW_MINIO_PROD_BUCKET/"
  echo "Uploaded to prod minio: $ICLAW_MINIO_PROD_ALIAS/$ICLAW_MINIO_PROD_BUCKET"
else
  echo "Unknown env: $ENV_NAME (use dev or prod)" >&2
  exit 1
fi
