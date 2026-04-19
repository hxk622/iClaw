# Icon Asset Pipeline

## Goal

Unify desktop icon generation so macOS Dock, Windows taskbar/start menu, installer icons, and bundled Tauri assets all derive from one brand-owned master icon source.

## Rules

- `logoMaster` is the only source image for desktop app icon generation.
- `logoMaster` must not be reused as a fallback for chat assistant avatars or in-product brand marks.
- `logoMaster` must be a transparent PNG.
- Do not use JPG as `logoMaster`.
- `homeLogo` and marketing assets can use JPG/WebP if needed, but desktop icon generation must not depend on them.
- `assistantAvatar`, `brandMark`, `faviconPng`, and `homeLogo` are explicit surface-owned assets; see `docs/design/brand-surface-asset-contract.md`.
- `tauri-icons/icon.png`, `icon.icns`, and `icon.ico` are generated artifacts, not hand-edited source-of-truth assets.

## Generation flow

1. Brand profile points `assets.logoMaster` to the transparent PNG master.
2. `scripts/apply-brand.mjs` invokes `scripts/generate-icons.sh <brandId>`.
3. `scripts/generate-icons.sh` regenerates the full Tauri icon set under `assets/<brand>/tauri-icons/`.
4. `apply-brand.mjs` copies the generated icons into `apps/desktop/src-tauri/icons-generated/`.

## Visual constraints

- Keep the icon subject centered.
- Keep transparent padding around the subject.
- Avoid dark/solid square backgrounds unless that is intentionally part of the logo.
- Validate at small sizes (`16x16`, `32x32`) and large sizes (`512x512`, `1024x1024`).

## Licaiclaw note

- `licaiclaw` now uses `services/control-plane/assets/licaiclaw/logo-master.png` as the app icon master.
- If Dock/taskbar visuals still look wrong after regeneration, replace this PNG source asset rather than editing generated `.icns` / `.ico` files directly.
