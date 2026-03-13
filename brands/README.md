# Brand Profiles

OEM branding is configured with `brands/<brand-id>/brand.json`.

Use:

```bash
ICLAW_BRAND=iclaw pnpm --filter @iclaw/desktop build
ICLAW_BRAND=licaiclaw pnpm tauri:build
node scripts/apply-brand.mjs licaiclaw
```

Brand selection is controlled by:

- `node scripts/apply-brand.mjs <brand-id>`
- or `ICLAW_BRAND=<brand-id>`
- default: `iclaw`

Each profile can override:

- app/product name
- website title
- sidebar subtitle
- bundle identifier
- keychain auth service name
- light/dark brand colors
- web favicon assets
- installer illustration
- Tauri bundle icons
- optional icon source master for regenerating brand icons

Expected asset layout inside each brand directory:

```text
brands/<brand-id>/
  brand.json
  assets/
    favicon.ico
    favicon.png
    apple-touch-icon.png
    installer-hero.png
    tauri-icons/
      32x32.png
      128x128.png
      128x128@2x.png
      icon.icns
      icon.ico
      icon.png
```

If you want a new OEM package, copy `brands/licaiclaw` and replace the assets.

If a brand wants a dedicated icon master, add this optional field to `brand.json`:

```json
{
  "assets": {
    "logoMaster": "./assets/logo.master.png"
  }
}
```

If you need to regenerate a brand's Tauri icons:

```bash
bash scripts/generate-icons.sh iclaw
ICLAW_BRAND=licaiclaw bash scripts/generate-icons.sh
```
