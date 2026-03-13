#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"
TAURI_CONFIG_PATH="$DESKTOP_DIR/src-tauri/tauri.generated.conf.json"

node "$ROOT_DIR/scripts/apply-brand.mjs"

tauri_args=()
skip_next=0
for arg in "$@"; do
  if [[ $skip_next -eq 1 ]]; then
    skip_next=0
    continue
  fi

  case "$arg" in
    -b|--bundles)
      skip_next=1
      ;;
    --bundles=*)
      ;;
    --no-bundle)
      ;;
    *)
      tauri_args+=("$arg")
      ;;
  esac
done

(
  cd "$DESKTOP_DIR"
  if [[ ${#tauri_args[@]} -gt 0 ]]; then
    pnpm tauri build --config "$TAURI_CONFIG_PATH" --bundles app "${tauri_args[@]}"
  else
    pnpm tauri build --config "$TAURI_CONFIG_PATH" --bundles app
  fi
)

if [[ ${#tauri_args[@]} -gt 0 ]]; then
  bash "$ROOT_DIR/scripts/package-desktop-dmg.sh" "${tauri_args[@]}"
else
  bash "$ROOT_DIR/scripts/package-desktop-dmg.sh"
fi
