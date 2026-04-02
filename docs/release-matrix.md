# iClaw Release Matrix

## 目标

桌面发版按宿主平台拆分：

- macOS 主机产出 4 个 mac 安装包：
  - Apple Silicon + dev
  - Apple Silicon + prod
  - Intel + dev
  - Intel + prod
- Windows 主机产出 4 个 Windows 安装包：
  - x64 + dev
  - x64 + prod
  - ARM64 + dev
  - ARM64 + prod

一个宿主只负责自己平台，不做“单机同时出 mac + Windows”。

## 构建命令

```bash
bash scripts/build-desktop-matrix.sh
```

输出目录：`dist/releases`

脚本会读取当前品牌的 `distribution.artifactBaseName` 作为文件名前缀。

命名格式：

- `releaseVersion` 固定为：`<baseVersion>.<datetime>`
- mac installer：`<artifactBaseName>_<releaseVersion>_<arch>_<channel>.dmg`
- mac updater：`<artifactBaseName>_<releaseVersion>_<arch>_<channel>.app.tar.gz`
- Windows installer：`<artifactBaseName>_<releaseVersion>_<arch>_<channel>.exe`
- Windows updater：`<artifactBaseName>_<releaseVersion>_<arch>_<channel>.nsis.zip`

例子：

- `LiCaiClaw_1.0.0.202603211230_aarch64_dev.dmg`
- `LiCaiClaw_1.0.0.202603211230_x64_prod.exe`

约束：

- 发布文件名不再包含 package.json 里的 `+build` metadata
- 例如 `1.0.0+202603091514` 对外发布时统一转成 `1.0.0.<datetime>`
- channel 继续使用下划线字段：`_dev` / `_prod`

## 默认矩阵

- macOS:
  - `aarch64-apple-darwin`
  - `x86_64-apple-darwin`
- Windows:
  - `x86_64-pc-windows-msvc`
  - `aarch64-pc-windows-msvc`

可选环境变量：

- `ICLAW_DESKTOP_TARGETS`
  - 逗号分隔，覆盖默认 target 列表
  - 例：`ICLAW_DESKTOP_TARGETS=x86_64-pc-windows-msvc`
- `ICLAW_DESKTOP_CHANNELS`
  - 逗号分隔，覆盖默认 channel 列表
  - 例：`ICLAW_DESKTOP_CHANNELS=prod`

签名配置：

- 优先从 `.env.signing.local` / `.env.signing.<env>.local` 读取 Apple 签名、公证和 updater key
- 旧的 `.env.packaging.*` 仍兼容，但只作为过渡 fallback

## 环境行为

- dev 包：
  - `NODE_ENV=dev`，自动应用 `.env.dev -> .env`
  - Logo hover 显示 `iClaw-dev`
- prod 包：
  - `NODE_ENV=prod`，自动应用 `.env.prod -> .env`
  - 桌面端 API/Gateway 固定走内置 sidecar（`127.0.0.1:2126`）

注意：

- `scripts/build-desktop-matrix.sh` 会在每轮构建前调用 `scripts/env.sh`，因此它会切换仓库根目录 `.env`
- updater 压缩包是否生成，取决于对应平台的签名/更新配置是否已准备好

## 下载站部署

- dev：本地 Vite（home）+ 远端源 MinIO（`47.93.231.197`）
- prod：Nginx（`113.44.132.75`）+ 火山 MinIO（`115.191.6.179`）

## 下载路径约定

公开下载地址必须按平台和架构分层，避免不同安装包互相覆盖。

- 根索引：`/downloads/latest-<channel>.json`
- Windows x64：`/downloads/windows/x64/<artifact>`
- Windows ARM64：`/downloads/windows/aarch64/<artifact>`
- macOS Intel：`/downloads/mac/x64/<artifact>`
- macOS Apple Silicon：`/downloads/mac/aarch64/<artifact>`

说明：

- 平台 manifest 也放在对应目录，例如 `latest-prod-mac-aarch64.json` 应位于 `/downloads/mac/aarch64/`
- installer、updater、签名文件都跟随同一平台/架构目录发布
- 脚本侧不得再把公开下载产物只上传到桶根目录，必须和公网 URL 前缀保持一致

## macOS Prod 标准流程

macOS 正式发版默认按“双打”执行，不再只打一种架构。

要求产物：

- `aarch64-apple-darwin`
- `x86_64-apple-darwin`

标准命令：

```bash
bash scripts/build-desktop-matrix.sh
bash scripts/publish-downloads.sh prod
```

如果只想手动补打单个架构，可用：

```bash
ICLAW_DESKTOP_TARGETS=aarch64-apple-darwin ICLAW_DESKTOP_CHANNELS=prod bash scripts/build-desktop-matrix.sh
ICLAW_DESKTOP_TARGETS=x86_64-apple-darwin ICLAW_DESKTOP_CHANNELS=prod bash scripts/build-desktop-matrix.sh
bash scripts/publish-downloads.sh prod
```

发布完成后，`dist/releases/` 至少应包含：

- `*_aarch64_prod.dmg`
- `*_x64_prod.dmg`
- `*_aarch64_prod.app.tar.gz`
- `*_aarch64_prod.app.tar.gz.sig`
- `*_x64_prod.app.tar.gz`
- `*_x64_prod.app.tar.gz.sig`
- `latest-prod-mac-aarch64.json`
- `latest-prod-mac-x64.json`
- `latest-prod.json`

说明：

- `scripts/build-desktop-matrix.sh` 在 macOS 主机上默认就会同时打 `aarch64` 和 `x64`
- `scripts/publish-downloads.sh prod` 会上传 installer、updater 和 manifest，并按保留策略清理旧版本
- prod 构建必须通过签名校验；macOS 公证失败时不会产出可公开发布的 prod 包

补充：

- 默认 PostgreSQL / MinIO 源环境：`47.93.231.197`
- 前端 / Nginx / DNS 落点：`113.44.132.75`
- 后端 / control-plane / PM2：`115.191.6.179`
- 详细清单见：
  - [prod-infra-inventory.md](/Users/xingkaihan/Documents/Code/iClaw/docs/prod-infra-inventory.md)
