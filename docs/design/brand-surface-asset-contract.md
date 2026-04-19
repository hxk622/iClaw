# Brand Surface Asset Contract

## Goal

Separate desktop icon masters from in-product avatar/brand-mark assets, and require every surface owner to be declared explicitly in the packaging profile. Brand assets must fail fast when a surface-specific source is missing.

## Asset ownership

- `assets.logoMaster`
  - Untouched original brand-art master.
  - Must not be mutated by desktop icon generation.
- `assets.desktopLogo`
  - Source of truth for desktop icon generation only.
  - Can be a cropped or tuned derivative of `logoMaster`.
- `assets.faviconPng`
  - Small square brand token for web/favicon usage.
- `assets.brandMark`
  - Source of truth for left-top/sidebar/header brand mark usage.
  - Should be composed for small rounded-square presentation in the shell.
- `assets.assistantAvatar`
  - Preferred source for assistant/chat avatar surfaces.
  - Should be tightly cropped and safe inside circular masks.
- `assets.homeLogo`
  - Preferred source for home/marketing logo usage.
  - Can be rectangular and does not need to be chat-safe.

## Surface mapping

- Desktop app icon / installer icon / generated Tauri icons
  - `desktopLogo`
- Original brand-art master
  - `logoMaster`
- Chat assistant avatar
  - `assistantAvatar`
- In-product `brand-mark.png`
  - `brandMark`
- Browser/app favicon
  - `faviconPng`
- Home/marketing logo
  - `homeLogo`

## Rules

- Every packaging profile must explicitly provide `assistantAvatar`, `brandMark`, `faviconPng`, `homeLogo`, `desktopLogo`, and `logoMaster`.
- No surface asset fallback is allowed inside the packaging/build pipeline.
- `logoMaster` is never a substitute for `assistantAvatar`.
- `logoMaster` is never a substitute for `brandMark`.
- `desktopLogo` is the only asset allowed to drive desktop icon generation.
- `logoMaster` must remain the untouched original.
- `brand-mark.png` and `assistant-avatar.png` must be generated from their explicit owners, not from a fallback chain.

## Build enforcement

- `scripts/lib/brand-asset-policy.mjs` is the shared contract resolver.
- `scripts/lib/packaging-profile.mjs` validates hard requirements and rejects incomplete profiles.
- `scripts/apply-brand.mjs` materializes generated assets using the explicit surface mapping only.
- `scripts/generate-icons.sh` and `scripts/generate-desktop-icon-variants.sh` read `desktopLogo`, not `logoMaster`.
- `scripts/release-guard.mjs` reports whether a brand matches the explicit asset contract.

## Current application

- `iclaw` and `caiclaw` now declare `assets.brandMark` and `assets.desktopLogo` explicitly.
- `logoMaster` remains available as the untouched original master asset instead of being the desktop-icon source by default.
