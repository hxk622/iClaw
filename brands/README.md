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
- storage namespace
- auth/OAuth defaults
- home site copy
- download artifact naming
- home deploy path
- control-plane service/bucket/redis defaults
- runtime publish bucket/base URL defaults
- light/dark brand colors
- web favicon assets
- installer illustration
- Tauri bundle icons
- optional icon source master for regenerating brand icons
- optional home logo / hero assets

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
    # optional home assets
    home-logo.png
    home-hero-art.svg
    home-hero-layer-1.svg
    home-hero-layer-2.svg
    home-hero-photo.jpg
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

Home 页左上角 logo 现在统一来自品牌目录：

- 如果设置了 `assets.homeLogo`，使用该文件
- 否则默认回退到该品牌自己的 `assets.faviconPng`

如果品牌需要 dedicated home page assets，可加这些可选字段：

```json
{
  "assets": {
    "homeLogo": "./assets/home-logo.png",
    "homeHeroArt": "./assets/home-hero-art.svg",
    "homeHeroLayer1": "./assets/home-hero-layer-1.svg",
    "homeHeroLayer2": "./assets/home-hero-layer-2.svg",
    "homeHeroPhoto": "./assets/home-hero-photo.jpg"
  }
}
```

`scripts/apply-brand.mjs` now generates brand outputs for both:

- desktop shell
- home download site

Shell scripts can query normalized brand fields via:

```bash
node scripts/read-brand-value.mjs distribution.artifactBaseName
node scripts/read-brand-value.mjs controlPlane.s3Bucket
```

If you need to regenerate a brand's Tauri icons:

```bash
bash scripts/generate-icons.sh iclaw
ICLAW_BRAND=licaiclaw bash scripts/generate-icons.sh
```
