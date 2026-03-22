# iClaw Home Web

iClaw 下载站（首版）。

## 本地开发

```bash
ICLAW_PORTAL_APP_NAME=iclaw pnpm dev:home-web
ICLAW_PORTAL_APP_NAME=licaiclaw pnpm dev:home-web
# 或
pnpm dev:home
bash scripts/deploy-home.sh dev
```

默认运行在 `http://localhost:1477`。

## 构建

```bash
ICLAW_PORTAL_APP_NAME=licaiclaw pnpm build:home-web
# 或
pnpm build:home
```

构建产物位于 `home-web/dist`。

说明：

- 品牌资料来自 control-plane portal app，不再从仓库内 `brands/` 目录读取
- `predev` / `prebuild` 会自动执行 `node ../scripts/apply-brand.mjs`

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
