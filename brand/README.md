# Brand Assets

`brand/logo.master.png` is the single source of truth for iClaw logo assets.

All app icons must be generated from this file via:

```bash
bash scripts/generate-icons.sh
```

Notes:
- The generator applies a safe margin (about 16%) for balanced Dock/App icon appearance.
- Do not edit files in `apps/desktop/src-tauri/icons/` manually.
