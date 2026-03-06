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

## 环境切换

统一使用根目录环境文件：

- `.env.dev`
- `.env.test`
- `.env.prod`

在编译/启动前，通过脚本生成 `.env`：

```bash
pnpm env:dev
pnpm env:test
pnpm env:prod
```

## Web 调试（免 DMG）

仅启动前端 Web（不自动拉起后端）：

```bash
pnpm dev:web
```

仅启动本地后端 sidecar（Web/桌面共用）：

```bash
pnpm dev:api
```

前后端联调（一键）：

```bash
pnpm dev:all
```

默认地址：

- Web: `http://127.0.0.1:1520`
- API: `http://127.0.0.1:2126`

后端日志默认保存到：

- `logs/openclaw/`
- 最新日志软链：`logs/openclaw/latest.log`

## Logo Source of Truth

Brand source is centralized at:

- `brand/logo.master.png`

Generate all app icon derivatives with:

```bash
bash scripts/generate-icons.sh
```
