# OpenClaw Bundled Resources

This directory stores bundled local sidecar resources that are synced into the desktop app.

- Skills source: repo root `skills/`
- `mcp/mcp.json`: generated MCP runtime config synced into the desktop bundle
- `config/runtime-config.json`: default runtime model/provider config

Sync to Tauri bundle resources:

```bash
bash scripts/sync-openclaw-resources.sh
```

Then package:

```bash
cd apps/desktop
pnpm tauri build
```
