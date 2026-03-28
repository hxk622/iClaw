# Admin Web

Independent OEM operations platform scaffold.

## Architecture boundary

`admin-web` is an operations console over `control-plane`, not the long-term owner of platform capability data.

For OEM capability management, especially `skill / mcp / model`, the console must keep the platform data layer and the OEM assembly layer separate.

For `skill` and `mcp`, the current structure is explicitly three-layer:

- `云技能`
  - full skill catalog
  - global marketplace / source-of-truth view
- `平台级 Skill`
  - backed by `platform_bundled_skills`
  - platform preinstalled subset selected from `云技能`
  - automatically inherited by every OEM app
- `OEM Skill 装配`
  - backed by `oem_bundled_skills`
  - OEM incremental preinstalled subset
  - automatically excludes skills already inherited from platform
- `平台级 MCP`
  - platform preinstalled subset selected from the full MCP registry
  - automatically inherited by every OEM app

- Platform center:
  - edit shared platform catalogs or shared preinstalled subsets
  - maintain capability metadata itself
- OEM assembly view:
  - edit app-level bindings only
  - control incremental visibility, default-installed, recommended, order, and lightweight presentation metadata

In other words:

- OEM skill page = OEM incremental preinstall layer, not full catalog ownership
- OEM MCP page = OEM incremental assembly layer, not registry ownership
- platform-level capabilities must not be copied into per-OEM ownership semantics

For `MCP` specifically:

- MCP content, metadata, logo, category, transport, docs links, crawl results, and other raw fields are platform-level shared data
- `iclaw` / `licaiclaw` and other OEM apps are not MCP content owners
- OEM pages must only configure binding state such as display, default install, recommendation, and ordering
- UI copy, tables, actions, and forms should avoid mixing “edit platform MCP” with “configure OEM MCP visibility”

## Local development

```bash
pnpm dev:admin
```

Default URL: `http://localhost:1479`.

Bootstrap credentials:

```text
username: admin
password: admin
```

This app now uses the control-plane auth and OEM APIs. The bootstrap `admin / admin` account is auto-created by the control-plane on startup unless disabled by env.
