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

生产环境主机清单见：

- [prod-infra-inventory.md](./docs/ops/prod-infra-inventory.md)

默认源环境说明：

- PostgreSQL / MinIO 的默认 source host 为 `39.106.74.65`
- 当前开发机不再作为默认 PostgreSQL / MinIO 源头
- 本机 PostgreSQL / MinIO 默认关闭，不依赖开机自启

## 环境切换

统一使用根目录环境文件：

- `.env.dev`
- `.env.test`
- `.env.prod`

签名相关敏感值单独放：

- `.env.signing.local`
- 可选：`.env.signing.dev.local`
- 可选：`.env.signing.test.local`
- 可选：`.env.signing.prod.local`

例如 Apple 签名、公证、updater key 应放在 `.env.signing.*`，不要混进 `.env.dev/.env.test/.env.prod`。

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
- `2130` 只给 control-plane 登录/注册/credit API 使用，不是前端地址

## 新账号体系初始化

新 control-plane 使用全新 PostgreSQL，不复用 OpenAlpha 的表。

1. 初始化数据库和角色：

```bash
DATABASE_URL=postgres://iclaw_app:change_me_now@127.0.0.1:5432/iclaw_control \
pnpm db:init:control-plane
```

如果要由脚本自动创建 role / database，再补充：

```bash
DATABASE_URL=postgres://iclaw_app:change_me_now@127.0.0.1:5432/iclaw_control \
ICLAW_CONTROL_DB_SUPERUSER=postgres \
ICLAW_CONTROL_DB_ADMIN_DB=postgres \
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
pnpm dev:control-plane
pnpm dev:all
```

`pnpm dev:api` / `pnpm dev:all` 不再自动启动或重启 control-plane；需要单独保持 `pnpm dev:control-plane` 运行。

后端日志默认保存到：

- `logs/openclaw/`
- 最新日志软链：`logs/openclaw/latest.log`

## OEM Source of Truth

OEM app / skill / MCP / menu / asset 的真实来源已经切到 control-plane portal。

- App 配置、skill binding、MCP binding、菜单显隐：存 PostgreSQL
- Logo / favicon / 安装图 / tauri icons：存 MinIO，对应元数据存 PostgreSQL
- 本地构建与本地调试：通过 control-plane 同步到 `.cache/portal-apps/<app-name>` 和 `services/openclaw/resources/`
- 仓库里的 `services/control-plane/presets/` 只用于预置 seed，不再是运行时配置源

配置分层原则：

- `runtime-bound`
  - 被 OpenClaw runtime / sidecar 直接依赖的配置
  - 必须由 control-plane 下发到本地 snapshot / runtime config，再供本地 runtime 消费
  - 例如 model allowlist、默认模型、推荐模型、MCP runtime config、skill runtime binding
- `cloud-live`
  - 不被 OpenClaw runtime 直接消费的展示层 / 运营层配置
  - 可以由前端实时从云端获取
  - 例如商店列表、运营文案、非关键 UI 展示内容、menu / sidebar / header / input / home 这类 shell 装配

注意：

- 输入框里的 `models.list` 不直接实时查 control-plane
- 它最终读取的是本地 sidecar 当前消费的 runtime 配置
- 因此 model allowlist 明确属于 `runtime-bound`
- 桌面端会在前端启动阶段尝试同步 OEM snapshot；同时 Rust 会在 sidecar 启动前再兜底同步一次，避免因为前端触发失败而退回单模型
- 左侧菜单这类 OEM shell 配置默认优先实时读取 `control-plane / portal/public-config`
- Tauri 会把最近一次成功的 shell 配置写入本地 snapshot，作为云端暂时不可用时的兜底

常用命令：

```bash
pnpm preset:sync:oem
pnpm dev:control-plane
pnpm dev:api -- iclaw
pnpm dev:api -- caiclaw
node scripts/apply-brand.mjs iclaw
ICLAW_PORTAL_APP_NAME=caiclaw bash scripts/generate-icons.sh
```

说明：

- `node scripts/apply-brand.mjs <app-name>` 会先从 control-plane 拉取 app profile 与素材，再生成桌面端 / home-web 所需品牌文件
- `pnpm dev:api -- <app-name>` 会把该 OEM app 已启用的 skill / MCP 同步到本地 OpenClaw runtime
- `ICLAW_BRAND` 目前仍兼容，但推荐统一使用 `ICLAW_PORTAL_APP_NAME`

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
pnpm publish:openclaw-runtime prod aarch64-apple-darwin
```

默认行为：

- `prod` 上传到 `remoteprod/iclaw-prod/runtime/openclaw/<runtime-version>/<archive>`
- 对应 target 的 `artifacts.<target-triple>.artifact_url` 会回写为
  `https://iclaw.aiyuanxi.com/downloads/runtime/openclaw/<runtime-version>/<archive>`

`apps/desktop/src-tauri/resources/config/openclaw-runtime.json` 现在按 target triple 维护
runtime artifact 映射；桌面端启动和 `pnpm tauri:build` 都会优先选择当前 target 对应的条目。
这样发布 Windows runtime 时，不会再把 macOS runtime 配置覆盖掉。

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

## Desktop Release Manifests

桌面端发布现在会为每个 channel 生成一组 latest manifest，位置在 `dist/releases/`：

- `latest-dev.json`
- `latest-dev-mac-aarch64.json`
- `latest-dev-mac-x64.json`
- `latest-prod.json`
- `latest-prod-mac-aarch64.json`
- `latest-prod-mac-x64.json`

manifest 内容包含：

- 当前桌面应用版本号
- base version / build id
- channel、platform、arch
- 安装包文件名、公开下载地址、文件大小、SHA-256
- 若存在 signed updater bundle，则附带 `updater.url` / `updater.signature`

生成命令：

```bash
node scripts/generate-desktop-release-manifests.mjs --channel dev
node scripts/generate-desktop-release-manifests.mjs --channel prod
```

上传安装包时，`bash scripts/publish-downloads.sh <dev|prod>` 会把对应的 manifest 一起上传到 MinIO。

如果构建时设置了 `TAURI_SIGNING_PRIVATE_KEY`，桌面端构建会额外生成 updater bundle 和 `.sig`，并自动写入 release manifest。

当前发布策略补充：

- Windows 正式发版不把 `updater/signature` 作为强依赖。
- Windows 主更新链路是：control-plane 版本检查与强更裁决 -> 获取 installer 下载地址 -> 自动下载安装包 -> 自动拉起安装器 -> 重启后恢复退出前页面。
- `updater/signature` 在 Windows 上属于可选增强能力，不是强更提醒或强更执行的必要条件。

## Desktop Update Hints

control-plane 现在会基于 desktop release manifest，在常规响应里附带桌面更新 hint。

客户端请求头：

- `x-iclaw-app-version`
- `x-iclaw-channel`
- `x-iclaw-platform`（可选）
- `x-iclaw-arch`（可选）

control-plane 响应头：

- `x-iclaw-latest-version`
- `x-iclaw-update-available`
- `x-iclaw-update-mandatory`
- `x-iclaw-update-manifest-url`
- `x-iclaw-update-artifact-url`

手动检查接口：

- `GET /desktop/update-hint?current_version=...&channel=...`

Tauri updater 动态接口：

- `GET /desktop/update?current_version=...&target=...&arch=...&channel=...`

说明：

- `/desktop/update-hint` 是强更策略与版本检查主入口。
- Windows 端即使不依赖 Tauri native updater，也必须依赖 `/desktop/update-hint` 做版本裁决。
- `/desktop/update` 主要服务于存在 native updater 能力的平台或场景，不能被视为 Windows 强更是否可用的唯一依据。

服务端优先从本地 `dist/releases/` 读取 manifest，也支持通过环境变量覆盖：

- `DESKTOP_RELEASE_MANIFEST_DIR`
- `DESKTOP_RELEASE_MANIFEST_DEV_BASE_URL`
- `DESKTOP_RELEASE_MANIFEST_PROD_BASE_URL`
- `DESKTOP_RELEASE_MANIFEST_CACHE_TTL_MS`
- `DESKTOP_RELEASE_CHANNEL`
- `DESKTOP_UPDATE_MANDATORY`
- `DESKTOP_FORCE_UPDATE_BELOW_VERSION`
- `TAURI_UPDATER_PUBLIC_KEY`
