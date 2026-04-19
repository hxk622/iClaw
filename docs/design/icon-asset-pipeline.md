# Icon Asset Pipeline

## Goal

Unify desktop icon generation so macOS Dock, Windows taskbar/start menu, installer icons, and bundled Tauri assets all derive from one brand-owned master icon source.

## Rules

- `desktopLogo` is the only source image for desktop app icon generation.
- `logoMaster` is the untouched original master and must not be repurposed as the desktop icon source by convention.
- `desktopLogo` must not be reused as a fallback for chat assistant avatars or in-product brand marks.
- `desktopLogo` should be a transparent PNG when the icon needs transparency-safe padding.
- `homeLogo` and marketing assets can use JPG/WebP if needed, but desktop icon generation must not depend on them.
- `assistantAvatar`, `brandMark`, `faviconPng`, `homeLogo`, `desktopLogo`, and `logoMaster` have explicit ownership; see `docs/design/brand-surface-asset-contract.md`.
- `tauri-icons/icon.png`, `icon.icns`, and `icon.ico` are generated artifacts, not hand-edited source-of-truth assets.

## Generation flow

1. Brand profile points `assets.desktopLogo` to the desktop icon source.
2. Brand profile keeps `assets.logoMaster` as the untouched original master.
3. `scripts/apply-brand.mjs` invokes `scripts/generate-icons.sh <brandId>`.
4. `scripts/generate-icons.sh` regenerates the full Tauri icon set under `assets/<brand>/tauri-icons/`.
5. `apply-brand.mjs` copies the generated icons into `apps/desktop/src-tauri/icons-generated/`.

## Visual constraints

- Keep the icon subject centered.
- Keep transparent padding around the subject.
- Avoid dark/solid square backgrounds unless that is intentionally part of the logo.
- Validate at small sizes (`16x16`, `32x32`) and large sizes (`512x512`, `1024x1024`).

## Licaiclaw note

- If Dock/taskbar visuals still look wrong after regeneration, replace `desktopLogo` rather than editing generated `.icns` / `.ico` files directly.
- `logoMaster` should stay as the preserved original artwork, even when `desktopLogo` becomes a cropped derivative.
