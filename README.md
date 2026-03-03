# iClaw

iClaw is a consumer desktop shell for OpenClaw.

## Scope (v0)

- UI shell (chat-focused)
- Packaging and distribution (macOS first)
- Login/register integration with OpenAlpha cloud auth

## Non-scope (v0)

- No OpenClaw capability orchestration changes
- No model/skill/provider control panel in UI
- No IM bot settings (planned for future Settings area)

## Monorepo Layout

```text
apps/desktop        # Desktop shell (UI + Tauri)
services/openclaw   # OpenClaw service fork/integration
packages/sdk        # API client wrapper for desktop -> openclaw
packages/shared     # Shared types/constants
scripts/            # Build/release scripts
```

See `docs/` for product decisions and contracts.
