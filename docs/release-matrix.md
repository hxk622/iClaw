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

- mac installer：`<artifactBaseName>_<releaseVersion>_<arch>_<channel>.dmg`
- mac updater：`<artifactBaseName>_<releaseVersion>_<arch>_<channel>.app.tar.gz`
- Windows installer：`<artifactBaseName>_<releaseVersion>_<arch>_<channel>.exe`
- Windows updater：`<artifactBaseName>_<releaseVersion>_<arch>_<channel>.nsis.zip`

例子：

- `LiCaiClaw_1.0.0+202603091514.202603211230_aarch64_dev.dmg`
- `LiCaiClaw_1.0.0+202603091514.202603211230_x64_prod.exe`

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

- dev：本地 Vite（home）+ 本地 MinIO
- prod：Nginx（`113.44.132.75`）+ 火山 MinIO（`115.191.6.179`）
