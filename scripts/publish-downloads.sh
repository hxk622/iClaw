#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE_DIR="$ROOT_DIR/dist/releases"
ENV_NAME="${1:-dev}"
KEEP_VERSIONS="${ICLAW_KEEP_VERSIONS:-2}"
ARTIFACT_BASE_NAME="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" distribution.artifactBaseName | tail -n1)"
DEV_BUCKET_DEFAULT="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" distribution.downloads.dev.bucket | tail -n1)"
PROD_BUCKET_DEFAULT="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" distribution.downloads.prod.bucket | tail -n1)"
DEV_PUBLIC_BASE_URL="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" distribution.downloads.dev.publicBaseUrl | tail -n1)"
PROD_PUBLIC_BASE_URL="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" distribution.downloads.prod.publicBaseUrl | tail -n1)"

if [[ ! -d "$RELEASE_DIR" ]]; then
  echo "Missing release dir: $RELEASE_DIR" >&2
  exit 1
fi

if ! [[ "$KEEP_VERSIONS" =~ ^[0-9]+$ ]] || [[ "$KEEP_VERSIONS" -lt 1 ]]; then
  echo "Invalid ICLAW_KEEP_VERSIONS: $KEEP_VERSIONS" >&2
  exit 1
fi

node "$ROOT_DIR/scripts/generate-desktop-release-manifests.mjs" --channel "$ENV_NAME"

local_prune() {
  local channel="$1"
  local arch="$2"
  local patterns=(
    "${ARTIFACT_BASE_NAME}_*_${arch}_${channel}.dmg"
    "${ARTIFACT_BASE_NAME}_*_${arch}_${channel}.exe"
  )
  local files=""
  for pattern in "${patterns[@]}"; do
    local matched
    matched="$(cd "$RELEASE_DIR" && ls -1 $pattern 2>/dev/null | sort -V || true)"
    if [[ -n "$matched" ]]; then
      files+=$'\n'"$matched"
    fi
  done
  files="$(printf '%s\n' "$files" | sed '/^$/d' | sort -V || true)"
  [[ -z "$files" ]] && return 0

  local count
  count="$(printf '%s\n' "$files" | sed '/^$/d' | wc -l | tr -d ' ')"
  if (( count <= KEEP_VERSIONS )); then
    return 0
  fi

  local remove_count=$((count - KEEP_VERSIONS))
  local idx=0
  printf '%s\n' "$files" | sed '/^$/d' | while IFS= read -r f; do
    if (( idx < remove_count )); then
      rm -f "$RELEASE_DIR/$f"
      echo "[local-prune] removed: $f"
    fi
    idx=$((idx + 1))
  done
}

minio_prune() {
  local alias="$1"
  local bucket="$2"
  local prefix="$3"
  local channel="$4"
  local arch="$5"

  local remote_root="$alias/$bucket"
  if [[ -n "$prefix" ]]; then
    remote_root="$remote_root/$prefix"
  fi

  local objects
  objects="$(
    mc ls "$remote_root" | awk '{print $NF}' | grep -E "^${ARTIFACT_BASE_NAME}_.*_${arch}_${channel}\\.(dmg|exe)$" | sort -V || true
  )"
  [[ -z "$objects" ]] && return 0

  local count
  count="$(printf '%s\n' "$objects" | sed '/^$/d' | wc -l | tr -d ' ')"
  if (( count <= KEEP_VERSIONS )); then
    return 0
  fi

  local remove_count=$((count - KEEP_VERSIONS))
  local idx=0
  printf '%s\n' "$objects" | sed '/^$/d' | while IFS= read -r obj; do
    if (( idx < remove_count )); then
      mc rm "$remote_root/$obj"
      echo "[minio-prune] removed: $obj from $remote_root"
    fi
    idx=$((idx + 1))
  done
}

resolve_upload_prefix() {
  local public_base_url="$1"
  node -e '
const raw = String(process.argv[1] || "").trim();
if (!raw) process.exit(0);
try {
  const parsed = new URL(raw);
  const normalized = parsed.pathname.replace(/^\/+|\/+$/g, "");
  if (normalized) process.stdout.write(normalized);
} catch {}
' "$public_base_url"
}

prune_all_local() {
  for arch in aarch64 x64; do
    local_prune "$ENV_NAME" "$arch"
  done
}

if [[ "$ENV_NAME" == "dev" ]]; then
  : "${ICLAW_MINIO_DEV_ALIAS:=local}"
  : "${ICLAW_MINIO_DEV_BUCKET:=$DEV_BUCKET_DEFAULT}"
  : "${ICLAW_MINIO_DEV_PREFIX:=$(resolve_upload_prefix "$DEV_PUBLIC_BASE_URL")}"

  prune_all_local

  mc mb --ignore-existing "$ICLAW_MINIO_DEV_ALIAS/$ICLAW_MINIO_DEV_BUCKET"
  dev_upload_target="$ICLAW_MINIO_DEV_ALIAS/$ICLAW_MINIO_DEV_BUCKET"
  if [[ -n "$ICLAW_MINIO_DEV_PREFIX" ]]; then
    dev_upload_target="$dev_upload_target/$ICLAW_MINIO_DEV_PREFIX"
  fi
  dev_files=()
  dev_updater_files=()
  shopt -s nullglob
  dev_files=(
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_dev.dmg
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_dev.exe
  )
  dev_updater_files=(
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_dev.app.tar.gz
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_dev.app.tar.gz.sig
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_dev.nsis.zip
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_dev.nsis.zip.sig
  )
  shopt -u nullglob
  if [[ ${#dev_files[@]} -eq 0 ]]; then
    echo "No dev desktop installers found for brand artifact prefix: $ARTIFACT_BASE_NAME" >&2
    exit 1
  fi
  shopt -s nullglob
  dev_manifests=("$RELEASE_DIR"/latest-dev*.json)
  shopt -u nullglob
  if [[ ${#dev_manifests[@]} -eq 0 ]]; then
    echo "No dev desktop release manifests found under: $RELEASE_DIR" >&2
    exit 1
  fi
  dev_uploads=()
  dev_uploads+=("${dev_files[@]}")
  if [[ ${#dev_updater_files[@]} -gt 0 ]]; then
    dev_uploads+=("${dev_updater_files[@]}")
  fi
  dev_uploads+=("${dev_manifests[@]}")
  mc cp "${dev_uploads[@]}" "$dev_upload_target/"
  mc anonymous set download "$ICLAW_MINIO_DEV_ALIAS/$ICLAW_MINIO_DEV_BUCKET"

  for arch in aarch64 x64; do
    minio_prune "$ICLAW_MINIO_DEV_ALIAS" "$ICLAW_MINIO_DEV_BUCKET" "$ICLAW_MINIO_DEV_PREFIX" dev "$arch"
  done

  echo "Uploaded to dev minio: $dev_upload_target"
elif [[ "$ENV_NAME" == "prod" ]]; then
  : "${ICLAW_MINIO_PROD_ALIAS:=prod115x}"
  : "${ICLAW_MINIO_PROD_BUCKET:=$PROD_BUCKET_DEFAULT}"
  : "${ICLAW_MINIO_PROD_PREFIX:=$(resolve_upload_prefix "$PROD_PUBLIC_BASE_URL")}"

  prune_all_local

  mc mb --ignore-existing "$ICLAW_MINIO_PROD_ALIAS/$ICLAW_MINIO_PROD_BUCKET"
  prod_upload_target="$ICLAW_MINIO_PROD_ALIAS/$ICLAW_MINIO_PROD_BUCKET"
  if [[ -n "$ICLAW_MINIO_PROD_PREFIX" ]]; then
    prod_upload_target="$prod_upload_target/$ICLAW_MINIO_PROD_PREFIX"
  fi
  prod_files=()
  prod_updater_files=()
  shopt -s nullglob
  prod_files=(
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_prod.dmg
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_prod.exe
  )
  prod_updater_files=(
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_prod.app.tar.gz
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_prod.app.tar.gz.sig
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_prod.nsis.zip
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_prod.nsis.zip.sig
  )
  shopt -u nullglob
  if [[ ${#prod_files[@]} -eq 0 ]]; then
    echo "No prod desktop installers found for brand artifact prefix: $ARTIFACT_BASE_NAME" >&2
    exit 1
  fi
  shopt -s nullglob
  prod_manifests=("$RELEASE_DIR"/latest-prod*.json)
  shopt -u nullglob
  if [[ ${#prod_manifests[@]} -eq 0 ]]; then
    echo "No prod desktop release manifests found under: $RELEASE_DIR" >&2
    exit 1
  fi
  prod_uploads=()
  prod_uploads+=("${prod_files[@]}")
  if [[ ${#prod_updater_files[@]} -gt 0 ]]; then
    prod_uploads+=("${prod_updater_files[@]}")
  fi
  prod_uploads+=("${prod_manifests[@]}")
  mc cp "${prod_uploads[@]}" "$prod_upload_target/"
  mc anonymous set download "$ICLAW_MINIO_PROD_ALIAS/$ICLAW_MINIO_PROD_BUCKET"

  for arch in aarch64 x64; do
    minio_prune "$ICLAW_MINIO_PROD_ALIAS" "$ICLAW_MINIO_PROD_BUCKET" "$ICLAW_MINIO_PROD_PREFIX" prod "$arch"
  done

  echo "Uploaded to prod minio: $prod_upload_target"
else
  echo "Unknown env: $ENV_NAME (use dev or prod)" >&2
  exit 1
fi
