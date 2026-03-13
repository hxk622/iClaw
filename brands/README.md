# Brand Profiles

OEM branding is configured with `brands/<brand-id>/brand.json`.

Use:

```bash
ICLAW_BRAND=iclaw pnpm --filter @iclaw/desktop build
ICLAW_BRAND=licaiclaw pnpm tauri:build
```

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
