# OpenClaw Bundled Resources

This directory is the canonical source for bundled local sidecar resources.

- `skills/`: preinstalled core skills
- `mcp/mcp.json`: default MCP server config

Sync to Tauri bundle resources:

```bash
bash scripts/sync-openclaw-resources.sh
```

Then package:

```bash
cd apps/desktop
pnpm tauri build
```
