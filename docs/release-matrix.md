# iClaw Release Matrix

## 目标

每次发布产出 4 个 mac 包：

1. Apple Silicon + dev
2. Apple Silicon + prod
3. Intel + dev
4. Intel + prod

## 构建命令

```bash
bash scripts/build-desktop-matrix.sh
```

输出目录：`dist/releases`

命名格式：

- `iClaw_<version>_aarch64_dev.dmg`
- `iClaw_<version>_aarch64_prod.dmg`
- `iClaw_<version>_x64_dev.dmg`
- `iClaw_<version>_x64_prod.dmg`

## 环境行为

- dev 包：
  - `NODE_ENV=dev`，自动应用 `.env.dev -> .env`
  - Logo hover 显示 `iClaw-dev`
- prod 包：
  - `NODE_ENV=prod`，自动应用 `.env.prod -> .env`
  - 桌面端 API/Gateway 固定走内置 sidecar（`127.0.0.1:2126`）

## 下载站部署

- dev：本地 Vite（home）+ 本地 MinIO
- prod：Nginx（`113.44.132.75`）+ 火山 MinIO（`115.191.6.179`）
