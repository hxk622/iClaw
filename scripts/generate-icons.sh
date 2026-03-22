#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRAND_ID="${1:-${ICLAW_PORTAL_APP_NAME:-${ICLAW_BRAND:-iclaw}}}"
RGBA_HELPER="$ROOT_DIR/scripts/ensure-rgba-png.swift"

BRAND_PATHS="$(
  node --input-type=module -e "
    import path from 'node:path';
    import {loadBrandProfile} from './scripts/lib/brand-profile.mjs';

    const rootDir = process.argv[1];
    const brandId = process.argv[2];
    const {brandDir, profile} = await loadBrandProfile({rootDir, brandId});
    const logoMaster = profile.assets.logoMaster || path.join(profile.assets.tauriIconsDir, 'icon.png');
    console.log(path.resolve(brandDir, logoMaster));
    console.log(path.resolve(brandDir, profile.assets.tauriIconsDir));
  " "$ROOT_DIR" "$BRAND_ID"
)"

SOURCE_LOGO="$(printf '%s\n' "$BRAND_PATHS" | sed -n '1p')"
ICONS_DIR="$(printf '%s\n' "$BRAND_PATHS" | sed -n '2p')"

if [[ ! -f "$SOURCE_LOGO" ]]; then
  echo "Missing source logo: $SOURCE_LOGO"
  exit 1
fi

TMP_DIR="$(mktemp -d /tmp/iclaw-iconset.XXXXXX)"
ICONSET_DIR="$TMP_DIR/icon.iconset"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

normalize_png_rgba() {
  local input_path="$1"
  local tmp_output="$TMP_DIR/rgba-$(basename "$input_path")"
  swift "$RGBA_HELPER" "$input_path" "$tmp_output"
  mv "$tmp_output" "$input_path"
}

mkdir -p "$ICONS_DIR"
mkdir -p "$ICONSET_DIR"

# Keep visual balance for Dock/app list: ~84% content + ~16% transparent margin.
# Re-encode first; some legacy PNGs trip iconutil even when dimensions are valid.
sips -s format png "$SOURCE_LOGO" --out "$TMP_DIR/source.png" >/dev/null
sips -z 860 860 "$TMP_DIR/source.png" --out "$TMP_DIR/master-860.png" >/dev/null
sips --padToHeightWidth 1024 1024 "$TMP_DIR/master-860.png" --out "$TMP_DIR/master-1024.png" >/dev/null

sips -s format png "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null
sips -z 512 512 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
sips -z 512 512 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -z 256 256 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
sips -z 256 256 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 128 128 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
sips -z 64 64 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
sips -z 32 32 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
sips -z 32 32 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
sips -z 16 16 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null

for icon_png in \
  "$ICONSET_DIR/icon_16x16.png" \
  "$ICONSET_DIR/icon_16x16@2x.png" \
  "$ICONSET_DIR/icon_32x32.png" \
  "$ICONSET_DIR/icon_32x32@2x.png" \
  "$ICONSET_DIR/icon_128x128.png" \
  "$ICONSET_DIR/icon_128x128@2x.png" \
  "$ICONSET_DIR/icon_256x256.png" \
  "$ICONSET_DIR/icon_256x256@2x.png" \
  "$ICONSET_DIR/icon_512x512.png" \
  "$ICONSET_DIR/icon_512x512@2x.png"; do
  normalize_png_rgba "$icon_png"
done

for required in \
  icon_16x16.png \
  icon_16x16@2x.png \
  icon_32x32.png \
  icon_32x32@2x.png \
  icon_128x128.png \
  icon_128x128@2x.png \
  icon_256x256.png \
  icon_256x256@2x.png \
  icon_512x512.png \
  icon_512x512@2x.png; do
  if [[ ! -f "$ICONSET_DIR/$required" ]]; then
    echo "Missing generated iconset asset: $ICONSET_DIR/$required"
    exit 1
  fi
done

tmp_icns="$TMP_DIR/generated.icns"
icns_generated=""
for attempt in 1 2 3 4 5; do
  sleep 0.2
  if iconutil -c icns "$ICONSET_DIR" -o "$tmp_icns" >/dev/null 2>&1; then
    icns_generated="1"
    break
  fi
done

if [[ -n "$icns_generated" ]]; then
  mv "$tmp_icns" "$ICONS_DIR/icon.icns"
else
  echo "Warning: icon.icns generation failed after retries, keeping existing icon.icns"
fi

cp "$TMP_DIR/master-1024.png" "$ICONS_DIR/icon.png"
sips -z 32 32 "$TMP_DIR/master-1024.png" --out "$ICONS_DIR/32x32.png" >/dev/null
sips -z 128 128 "$TMP_DIR/master-1024.png" --out "$ICONS_DIR/128x128.png" >/dev/null
sips -z 256 256 "$TMP_DIR/master-1024.png" --out "$ICONS_DIR/128x128@2x.png" >/dev/null

for icon_png in \
  "$ICONS_DIR/icon.png" \
  "$ICONS_DIR/32x32.png" \
  "$ICONS_DIR/128x128.png" \
  "$ICONS_DIR/128x128@2x.png"; do
  normalize_png_rgba "$icon_png"
done

# Keep current icon.ico if conversion fails (sips can be flaky on some systems).
if ! sips -s format ico "$TMP_DIR/master-1024.png" --out "$ICONS_DIR/icon.ico" >/dev/null 2>&1; then
  echo "Warning: icon.ico generation failed, keeping existing icon.ico"
fi

echo "Generated icons for brand '$BRAND_ID' from $SOURCE_LOGO -> $ICONS_DIR"
