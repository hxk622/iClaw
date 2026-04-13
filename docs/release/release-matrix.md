# iClaw Release Matrix

更新时间：2026-04-05

## 目标

桌面发版按宿主平台拆分：

- macOS 主机默认产出当前正式所需的 mac 安装包：
  - Apple Silicon + prod
- Windows 主机默认产出当前正式所需的 Windows 安装包：
  - x64 + prod
  - ARM64 + prod

一个宿主只负责自己平台，不做“单机同时出 mac + Windows”。

当前限制：

- `macOS x64` 当前标记为“暂不支持正式发版”
- 原因是发布链路尚未齐备：
  - 缺少 `openclaw-runtime-x86_64-apple-darwin`
  - 当前执行机没有可稳定使用的 `x64 node` 环境
- 在这两个条件补齐前，`prod` 发布口径只覆盖 `macOS arm64`

## 构建命令

```bash
bash scripts/build-desktop-matrix.sh
```

输出目录：`dist/releases`

脚本会读取当前品牌的 `distribution.artifactBaseName` 作为文件名前缀。

命名格式：

- `releaseVersion` 固定为：`<baseVersion>.<datetime>`
- mac installer：`<artifactBaseName>_<releaseVersion>_<arch>_<channel>.dmg`
- Windows installer：`<artifactBaseName>_<releaseVersion>_<arch>_<channel>.exe`
- 如显式开启 native updater：
  - mac updater：`<artifactBaseName>_<releaseVersion>_<arch>_<channel>.app.tar.gz`
  - Windows updater：`<artifactBaseName>_<releaseVersion>_<arch>_<channel>.nsis.zip`

例子：

- `LiCaiClaw_1.0.0.202603211230_aarch64_dev.dmg`
- `LiCaiClaw_1.0.0.202603211230_x64_prod.exe`

约束：

- 发布文件名不再包含 package.json 里的 `+build` metadata
- 例如 `1.0.0+202603091514` 对外发布时统一转成 `1.0.0.<datetime>`
- channel 继续使用下划线字段：`_dev` / `_prod`
- 下载页公开展示的版本号也必须使用同一四段点号版本，不能直接暴露 `package.json` 中的 `+build` 版本
- 下载页默认应指向当前最新成功发布的 installer 时间戳；如重新补包，页面也必须切到新的 `<releaseVersion>`

## 默认矩阵

- macOS:
  - `aarch64-apple-darwin`
- Windows:
  - `x86_64-pc-windows-msvc`
  - `aarch64-pc-windows-msvc`

可选环境变量：

- `ICLAW_DESKTOP_TARGETS`
  - 逗号分隔，覆盖默认 target 列表
  - 例：`ICLAW_DESKTOP_TARGETS=x86_64-pc-windows-msvc`
- `ICLAW_DESKTOP_CHANNELS`
  - 逗号分隔，覆盖默认 channel 列表
  - 默认值：`prod`
  - 例：`ICLAW_DESKTOP_CHANNELS=dev`

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
- 正式打包默认只打 `prod`，不再默认顺手产出 `dev`
- 厚包为默认路径：安装包内直接携带 runtime archive，首次启动优先从安装包内解压到本地缓存
- native updater 默认关闭，不再作为正式发版主链路
- 只有显式传入 `ICLAW_DESKTOP_ENABLE_NATIVE_UPDATER=1` 时，脚本才会保留 updater 压缩包
- 任何桌面发布链路变更默认要求 macOS / Windows 双系统同改，不能只修单边脚本后留下另一边旧口径

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
- macOS 下载路径执行单轨制，只保留 `/downloads/mac/<arch>/`
- 不再维护 `/downloads/darwin/<arch>/` 兼容别名

## macOS Prod 标准流程

macOS 正式发版当前默认只发 `Apple Silicon`。

要求产物：

- `aarch64-apple-darwin`

标准命令：

```bash
ICLAW_DESKTOP_TARGETS=aarch64-apple-darwin ICLAW_DESKTOP_CHANNELS=prod bash scripts/build-desktop-matrix.sh
bash scripts/publish-downloads.sh prod
```

如果后续要恢复 `macOS x64`，必须先补齐 runtime 与构建环境，再手动显式启用：

```bash
ICLAW_DESKTOP_TARGETS=aarch64-apple-darwin ICLAW_DESKTOP_CHANNELS=prod bash scripts/build-desktop-matrix.sh
ICLAW_DESKTOP_TARGETS=x86_64-apple-darwin ICLAW_DESKTOP_CHANNELS=prod bash scripts/build-desktop-matrix.sh
bash scripts/publish-downloads.sh prod
```

发布完成后，`dist/releases/` 至少应包含：

- `*_aarch64_prod.dmg`
- `latest-prod-mac-aarch64.json`
- `latest-prod.json`

只有显式开启 native updater 时，才额外要求：

- `*_aarch64_prod.app.tar.gz`
- `*_aarch64_prod.app.tar.gz.sig`

说明：

- 在当前规范下，macOS `prod` 发布应显式限制为 `aarch64-apple-darwin`
- `scripts/publish-downloads.sh prod` 默认上传 installer 和 manifest；若本次显式生成了 updater 产物，也会一并上传
- prod 构建必须通过签名校验；macOS 公证失败时不会产出可公开发布的 prod 包
- 如果 `home-web` 需要展示下载链接，发布时应显式传入本次对外版本，例如 `ICLAW_HOME_PUBLIC_RELEASE_VERSION=<releaseVersion>`，避免页面继续显示旧时间戳

补充：

- 默认 PostgreSQL / MinIO 源环境：`47.93.231.197`
- 前端 / Nginx / DNS 落点：`113.44.132.75`
- 后端 / control-plane / PM2：`115.191.6.179`
- 详细清单见：
  - [prod-infra-inventory.md](../ops/prod-infra-inventory.md)
