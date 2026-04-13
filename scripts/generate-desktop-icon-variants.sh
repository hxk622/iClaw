#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRAND_ID="${1:-${APP_NAME:-${ICLAW_PORTAL_APP_NAME:-${ICLAW_BRAND:-iclaw}}}}"
VARIANT_HELPER="$ROOT_DIR/scripts/generate-platform-desktop-icon.swift"

BRAND_PATHS="$(
  node --input-type=module -e "
    import path from 'node:path';
    import {loadBrandProfile} from './scripts/lib/brand-profile.mjs';

    const rootDir = process.argv[1];
    const brandId = process.argv[2];
    const {brandDir, profile} = await loadBrandProfile({rootDir, brandId});
    const logoMaster = profile.assets.logoMaster || path.join(profile.assets.tauriIconsDir, 'icon.png');
    const sourceLogo = path.resolve(brandDir, logoMaster);
    const assetsDir = path.dirname(sourceLogo);
    console.log(sourceLogo);
    console.log(assetsDir);
  " "$ROOT_DIR" "$BRAND_ID"
)"

SOURCE_LOGO="$(printf '%s\n' "$BRAND_PATHS" | sed -n '1p')"
ASSETS_DIR="$(printf '%s\n' "$BRAND_PATHS" | sed -n '2p')"

if [[ ! -f "$SOURCE_LOGO" ]]; then
  echo "Missing source logo: $SOURCE_LOGO"
  exit 1
fi

mkdir -p "$ASSETS_DIR"
env \
  SWIFTC_MODULECACHE_PATH=/tmp/swift-module-cache \
  CLANG_MODULE_CACHE_PATH=/tmp/clang-module-cache \
  swift "$VARIANT_HELPER" "$SOURCE_LOGO" macos "$ASSETS_DIR/desktop-icon-macos.png"
env \
  SWIFTC_MODULECACHE_PATH=/tmp/swift-module-cache \
  CLANG_MODULE_CACHE_PATH=/tmp/clang-module-cache \
  swift "$VARIANT_HELPER" "$SOURCE_LOGO" windows "$ASSETS_DIR/desktop-icon-windows.png"

echo "Generated desktop icon variants for '$BRAND_ID' from $SOURCE_LOGO -> $ASSETS_DIR"
