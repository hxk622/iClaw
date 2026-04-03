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

腾讯云堡垒机发布脚本：

```bash
bash scripts/deploy-home-tecent.sh build
ICLAW_BASTION_PASSWORD='***' bash scripts/deploy-home-tecent.sh prod
```

默认行为：

- 品牌默认使用 `licaiclaw`
- 堡垒机默认使用 `w-hanxingkai@relay1.idc.hexun.com`
- 目标机器默认使用 `hxyw_admin@172.17.0.5` 和 `hxyw_admin@172.17.0.9`
- nginx 目录默认读取 `config/packaging/prod/licaiclaw.json` 中的 `distribution.home.nginxPath`
- 默认写入 `/etc/nginx/conf.d/caiclaw.hexun.com.conf`，并执行 `nginx -t` + reload
- 默认通过 `artifact` 模式发布：
  - 本地构建 `home-web`
  - 创建临时 GitHub artifact 分支
  - 堡垒机登录后在跳板机上用 `curl` 拉取构建包
  - 再从跳板机分发到两台 ECS
- 发布成功后默认删除临时 artifact 分支；如需保留，设置 `ICLAW_ARTIFACT_KEEP_BRANCH=1`

常用覆盖项：

- `ICLAW_TARGET_USER`
- `ICLAW_TENCENT_TARGETS`
- `ICLAW_NGINX_PATH`
- `ICLAW_NGINX_CONF_PATH`
- `ICLAW_INSTALL_NGINX_CONF`
- `ICLAW_BASTION_HOST`
- `ICLAW_BASTION_USER`
- `ICLAW_BASTION_TRANSFER_MODE`
- `ICLAW_ARTIFACT_GITHUB_REPO`
- `ICLAW_ARTIFACT_KEEP_BRANCH`

备用模式：

```bash
ICLAW_BASTION_TRANSFER_MODE=scp ICLAW_BASTION_PASSWORD='***' bash scripts/deploy-home-tecent.sh prod
```

说明：

- `artifact`：适用于齐治堡垒机不支持标准 `scp` 上传的情况，是当前推荐默认值
- `scp`：适用于堡垒机本身支持标准 `scp`/`ssh remote command` 的情况
