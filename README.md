# iClaw

iClaw is a consumer desktop shell for OpenClaw.

## Scope (v0)

- UI shell (chat-focused)
- Packaging and distribution (macOS first)
- Login/register integration with iClaw cloud control plane

## Non-scope (v0)

- No OpenClaw capability orchestration changes
- No model/skill/provider control panel in UI
- No IM bot settings (planned for future Settings area)

## Monorepo Layout

```text
apps/desktop        # Desktop shell (UI + Tauri)
services/control-plane # Cloud auth / billing / credits / usage
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

默认从 `apps/desktop/src-tauri/resources/config/openclaw-runtime.json` 读取 OpenClaw 版本，前台运行并直接输出日志到控制台，`Ctrl+C` 会停止 sidecar。

前后端联调（一键）：

```bash
pnpm dev:all
```

默认地址：

- Web: `http://127.0.0.1:1520`
- API: `http://127.0.0.1:2126`
- Control Plane: `http://127.0.0.1:2130`

端口约定：

- 前端 Web 调试地址固定为 `127.0.0.1:1520`
- OAuth 回调页也走前端地址：`http://127.0.0.1:1520/oauth-callback.html`
- `1420` 只给 control-plane 登录/注册/credit API 使用，不是前端地址

## 新账号体系初始化

新 control-plane 使用全新 PostgreSQL，不复用 OpenAlpha 的表。

1. 初始化数据库和角色：

```bash
ICLAW_CONTROL_DB_SUPERUSER=postgres \
ICLAW_CONTROL_DB_PASSWORD=change_me_now \
pnpm db:init:control-plane
```

2. 可选启动 Redis：

```bash
docker run --name iclaw-redis -p 6379:6379 redis:7
```

3. 配置 control-plane 环境变量：

- 本地开发直接使用根目录 `.env.dev` / `.env.test` / `.env.prod`
- control-plane 需要的后端变量也统一放在根目录 `.env.*`
- 本地 OAuth 回调 URI 如未单独覆盖，默认应指向 `http://127.0.0.1:1520/oauth-callback.html`

4. 本地联调：

```bash
pnpm dev:all
```

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

## OpenClaw Runtime Artifact

桌面端发布包默认不再内置 OpenClaw sidecar。推荐基于 OpenClaw npm 发布包产出自包含 runtime artifact：

```bash
OPENCLAW_NPM_SPEC=openclaw@2026.3.7 pnpm build:openclaw-runtime
```

脚本会把原始 npm package tgz 保留到 `.artifacts/openclaw-runtime/packages/`，同时输出可直接给桌面端使用的 runtime tar.gz。

本地 `dev:api` 也可以直接复用同一来源：

```bash
OPENCLAW_PACKAGE_TGZ=/abs/path/to/.artifacts/openclaw-runtime/packages/openclaw-2026.3.7.tgz \
bash scripts/build-openclaw-server-runtime.sh
```

artifact 可以通过 HTTPS 地址分发，也可以在本地验证时直接使用绝对路径。

发布到 MinIO 并回写桌面端下载地址：

```bash
pnpm publish:openclaw-runtime prod
```

默认行为：

- `prod` 上传到 `remoteprod/iclaw-prod/runtime/`
- `artifact_url` 回写为 `https://iclaw.aiyuanxi.com/downloads/runtime/<archive>`

如果需要覆盖，可设置：

- `ICLAW_RUNTIME_MINIO_ALIAS`
- `ICLAW_RUNTIME_MINIO_BUCKET`
- `ICLAW_RUNTIME_MINIO_PREFIX`
- `ICLAW_RUNTIME_PUBLIC_BASE_URL`

## Versioning

iClaw 版本统一使用 SemVer + build metadata：

- 对外版本：`MAJOR.MINOR.PATCH`
- 排障构建号：`YYYYMMDDHHMM`
- 完整版本：`MAJOR.MINOR.PATCH+YYYYMMDDHHMM`

例如：`1.0.0+202603091514`

其中：

- 更新判断只看前三位 `MAJOR.MINOR.PATCH`
- `+` 后的 build metadata 不参与升级比较，仅用于 troubleshooting

设置版本：

```bash
bash scripts/version.sh 1.0.0
bash scripts/version.sh 1.0.0 202603091514
```
