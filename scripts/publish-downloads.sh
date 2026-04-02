#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE_DIR="$ROOT_DIR/dist/releases"
ENV_NAME="${1:-dev}"
KEEP_VERSIONS="${ICLAW_KEEP_VERSIONS:-2}"

export ICLAW_PACKAGING_ENV="$ENV_NAME"
ARTIFACT_BASE_NAME="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" distribution.artifactBaseName | tail -n1)"
DEV_BUCKET_DEFAULT="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" distribution.downloads.dev.bucket | tail -n1)"
TEST_BUCKET_DEFAULT="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" distribution.downloads.test.bucket | tail -n1)"
PROD_BUCKET_DEFAULT="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" distribution.downloads.prod.bucket | tail -n1)"
DEV_PUBLIC_BASE_URL="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" distribution.downloads.dev.publicBaseUrl | tail -n1)"
TEST_PUBLIC_BASE_URL="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" distribution.downloads.test.publicBaseUrl | tail -n1)"
PROD_PUBLIC_BASE_URL="$(node "$ROOT_DIR/scripts/read-brand-value.mjs" distribution.downloads.prod.publicBaseUrl | tail -n1)"

if [[ ! -d "$RELEASE_DIR" ]]; then
  echo "Missing release dir: $RELEASE_DIR" >&2
  exit 1
fi

if ! [[ "$KEEP_VERSIONS" =~ ^[0-9]+$ ]] || [[ "$KEEP_VERSIONS" -lt 1 ]]; then
  echo "Invalid ICLAW_KEEP_VERSIONS: $KEEP_VERSIONS" >&2
  exit 1
fi

node "$ROOT_DIR/scripts/export-desktop-release-manifests.mjs" --channel "$ENV_NAME"

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
  local platform="$5"
  local arch="$6"
  local extension_pattern=""

  case "$platform" in
    mac)
      extension_pattern='dmg'
      ;;
    windows)
      extension_pattern='exe'
      ;;
    *)
      echo "Unsupported public platform for prune: $platform" >&2
      return 1
      ;;
  esac

  local remote_root="$alias/$bucket"
  if [[ -n "$prefix" ]]; then
    remote_root="$remote_root/$prefix"
  fi
  remote_root="$remote_root/$platform/$arch"

  local objects
  objects="$(
    mc ls "$remote_root" 2>/dev/null | awk '{print $NF}' | grep -E "^${ARTIFACT_BASE_NAME}_.*_${arch}_${channel}\\.${extension_pattern}$" | sort -V || true
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

remove_legacy_root_objects() {
  local alias="$1"
  local bucket="$2"
  local prefix="$3"
  local channel="$4"

  local remote_root="$alias/$bucket"
  if [[ -n "$prefix" ]]; then
    remote_root="$remote_root/$prefix"
  fi

  local objects
  objects="$(
    mc ls "$remote_root" 2>/dev/null | awk '{print $NF}' | grep -E "^(${ARTIFACT_BASE_NAME}_.*_(aarch64|x64)_${channel}\\.(dmg|exe|app\\.tar\\.gz|app\\.tar\\.gz\\.sig|nsis\\.zip|nsis\\.zip\\.sig)|latest-${channel}-(darwin|mac|windows)-(aarch64|x64)\\.json)$" || true
  )"
  [[ -z "$objects" ]] && return 0

  printf '%s\n' "$objects" | sed '/^$/d' | while IFS= read -r obj; do
    mc rm "$remote_root/$obj"
    echo "[minio-cleanup] removed legacy root object: $obj from $remote_root"
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

platform_arch_from_name() {
  local file_name="$1"
  local platform=""
  local arch=""

  if [[ "$file_name" =~ ^latest-(dev|test|prod)-(mac|windows)-(aarch64|x64)\.json$ ]]; then
    printf '%s/%s\n' "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}"
    return 0
  fi

  case "$file_name" in
    *.dmg|*.app.tar.gz|*.app.tar.gz.sig)
      platform="mac"
      ;;
    *.exe|*.nsis.zip|*.nsis.zip.sig)
      platform="windows"
      ;;
  esac

  if [[ "$file_name" == *_aarch64_* ]] || [[ "$file_name" == *_arm64_* ]]; then
    arch="aarch64"
  elif [[ "$file_name" == *_x64_* ]]; then
    arch="x64"
  fi

  if [[ -n "$platform" && -n "$arch" ]]; then
    printf '%s/%s\n' "$platform" "$arch"
  fi
}

upload_target_file() {
  local source_path="$1"
  local target_root="$2"
  local file_name
  file_name="$(basename "$source_path")"

  local platform_arch=""
  platform_arch="$(platform_arch_from_name "$file_name" || true)"
  if [[ -n "$platform_arch" ]]; then
    mc mb --ignore-existing "$target_root/$platform_arch"
    mc cp "$source_path" "$target_root/$platform_arch/"
    return 0
  fi

  mc cp "$source_path" "$target_root/"
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
  for file_path in "${dev_uploads[@]}"; do
    upload_target_file "$file_path" "$dev_upload_target"
  done
  mc anonymous set download "$ICLAW_MINIO_DEV_ALIAS/$ICLAW_MINIO_DEV_BUCKET"

  for platform in mac windows; do
    for arch in aarch64 x64; do
      minio_prune "$ICLAW_MINIO_DEV_ALIAS" "$ICLAW_MINIO_DEV_BUCKET" "$ICLAW_MINIO_DEV_PREFIX" dev "$platform" "$arch"
    done
  done
  remove_legacy_root_objects "$ICLAW_MINIO_DEV_ALIAS" "$ICLAW_MINIO_DEV_BUCKET" "$ICLAW_MINIO_DEV_PREFIX" dev

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
  for file_path in "${prod_uploads[@]}"; do
    upload_target_file "$file_path" "$prod_upload_target"
  done
  mc anonymous set download "$ICLAW_MINIO_PROD_ALIAS/$ICLAW_MINIO_PROD_BUCKET"

  for platform in mac windows; do
    for arch in aarch64 x64; do
      minio_prune "$ICLAW_MINIO_PROD_ALIAS" "$ICLAW_MINIO_PROD_BUCKET" "$ICLAW_MINIO_PROD_PREFIX" prod "$platform" "$arch"
    done
  done
  remove_legacy_root_objects "$ICLAW_MINIO_PROD_ALIAS" "$ICLAW_MINIO_PROD_BUCKET" "$ICLAW_MINIO_PROD_PREFIX" prod

  echo "Uploaded to prod minio: $prod_upload_target"
elif [[ "$ENV_NAME" == "test" ]]; then
  : "${ICLAW_MINIO_TEST_ALIAS:=local}"
  : "${ICLAW_MINIO_TEST_BUCKET:=$TEST_BUCKET_DEFAULT}"
  : "${ICLAW_MINIO_TEST_PREFIX:=$(resolve_upload_prefix "$TEST_PUBLIC_BASE_URL")}"

  prune_all_local

  mc mb --ignore-existing "$ICLAW_MINIO_TEST_ALIAS/$ICLAW_MINIO_TEST_BUCKET"
  test_upload_target="$ICLAW_MINIO_TEST_ALIAS/$ICLAW_MINIO_TEST_BUCKET"
  if [[ -n "$ICLAW_MINIO_TEST_PREFIX" ]]; then
    test_upload_target="$test_upload_target/$ICLAW_MINIO_TEST_PREFIX"
  fi
  test_files=()
  test_updater_files=()
  shopt -s nullglob
  test_files=(
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_test.dmg
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_test.exe
  )
  test_updater_files=(
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_test.app.tar.gz
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_test.app.tar.gz.sig
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_test.nsis.zip
    "$RELEASE_DIR"/"${ARTIFACT_BASE_NAME}"_*_test.nsis.zip.sig
  )
  shopt -u nullglob
  if [[ ${#test_files[@]} -eq 0 ]]; then
    echo "No test desktop installers found for brand artifact prefix: $ARTIFACT_BASE_NAME" >&2
    exit 1
  fi
  shopt -s nullglob
  test_manifests=("$RELEASE_DIR"/latest-test*.json)
  shopt -u nullglob
  if [[ ${#test_manifests[@]} -eq 0 ]]; then
    echo "No test desktop release manifests found under: $RELEASE_DIR" >&2
    exit 1
  fi
  test_uploads=()
  test_uploads+=("${test_files[@]}")
  if [[ ${#test_updater_files[@]} -gt 0 ]]; then
    test_uploads+=("${test_updater_files[@]}")
  fi
  test_uploads+=("${test_manifests[@]}")
  for file_path in "${test_uploads[@]}"; do
    upload_target_file "$file_path" "$test_upload_target"
  done
  mc anonymous set download "$ICLAW_MINIO_TEST_ALIAS/$ICLAW_MINIO_TEST_BUCKET"

  for platform in mac windows; do
    for arch in aarch64 x64; do
      minio_prune "$ICLAW_MINIO_TEST_ALIAS" "$ICLAW_MINIO_TEST_BUCKET" "$ICLAW_MINIO_TEST_PREFIX" test "$platform" "$arch"
    done
  done
  remove_legacy_root_objects "$ICLAW_MINIO_TEST_ALIAS" "$ICLAW_MINIO_TEST_BUCKET" "$ICLAW_MINIO_TEST_PREFIX" test

  echo "Uploaded to test minio: $test_upload_target"
else
  echo "Unknown env: $ENV_NAME (use dev | test | prod)" >&2
  exit 1
fi
