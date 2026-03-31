# OpenClaw Bundled Resources

This directory stores static sidecar resources that are synced into the desktop app.

- Skills are no longer sourced from this directory.
- Effective cloud skills are materialized into the OpenClaw workspace at runtime:
  `~/.openclaw/workspace/skills/`
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
