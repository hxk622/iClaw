# Brand Surface Asset Contract

## Goal

Separate desktop icon masters from in-product avatar/brand-mark assets, and require every surface owner to be declared explicitly in the packaging profile. Brand assets must fail fast when a surface-specific source is missing.

## Asset ownership

- `assets.logoMaster`
  - Source of truth for desktop icon generation only.
  - Used by `scripts/generate-icons.sh` and installer/OS icon outputs.
  - Transparent padding is allowed here.
- `assets.faviconPng`
  - Small square brand token for web/favicon usage.
  - Source of truth for generated in-product `brand-mark.png`.
- `assets.assistantAvatar`
  - Preferred source for assistant/chat avatar surfaces.
  - Should be tightly cropped and safe inside circular masks.
- `assets.homeLogo`
  - Preferred source for home/marketing logo usage.
  - Can be rectangular and does not need to be chat-safe.

## Surface mapping

- Desktop app icon / installer icon / generated Tauri icons
  - `logoMaster`
- Chat assistant avatar
  - `assistantAvatar`
- In-product `brand-mark.png`
  - `faviconPng`
- Home/marketing logo
  - `homeLogo`

## Rules

- Every packaging profile must explicitly provide `assistantAvatar`, `faviconPng`, `homeLogo`, and `logoMaster`.
- No surface asset fallback is allowed inside the packaging/build pipeline.
- `logoMaster` is never a substitute for `assistantAvatar`.
- `brand-mark.png` and `assistant-avatar.png` must be generated from their explicit owners, not from a fallback chain.

## Build enforcement

- `scripts/lib/brand-asset-policy.mjs` is the shared contract resolver.
- `scripts/lib/packaging-profile.mjs` validates hard requirements and rejects incomplete profiles.
- `scripts/apply-brand.mjs` materializes generated assets using the explicit surface mapping only.
- `scripts/release-guard.mjs` reports whether a brand matches the explicit asset contract.

## Current application

- `caiclaw` now declares `assets.assistantAvatar = assets.faviconPng`.
- This keeps chat/avatar surfaces visually full while leaving `logoMaster` dedicated to desktop icon generation.
