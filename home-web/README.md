# iClaw Home Web

iClaw 下载站（首版）。

## 本地开发

```bash
ICLAW_BRAND=iclaw pnpm dev:home-web
ICLAW_BRAND=licaiclaw pnpm dev:home-web
# 或
pnpm dev:home
bash scripts/deploy-home.sh dev
```

默认运行在 `http://localhost:1477`。

## 构建

```bash
ICLAW_BRAND=licaiclaw pnpm build:home-web
# 或
pnpm build:home
```

构建产物位于 `home-web/dist`。

## 发布策略

- dev：本地 Vite 运行，下载包上传本地 MinIO
- prod：前端部署到华为云 Nginx（`113.44.132.75`），下载包上传火山 MinIO（`115.191.6.179`）

下载包上传脚本：

```bash
bash scripts/publish-downloads.sh dev
bash scripts/publish-downloads.sh prod
```

前端发布脚本：

```bash
bash scripts/deploy-home.sh prod
```
