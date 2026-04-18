# Prod Aliyun Migration Runbook

更新时间：2026-04-18

## 目标

把 prod 从旧火山云后端 `115.191.6.179` 迁移到阿里云新主机 `39.106.110.149`，并恢复：

- `iclaw.aiyuanxi.com`
- `caiclaw.aiyuanxi.com`
- `caiclaw-admin.aiyuanxi.com`
- `/downloads/*`
- `/runtime/*`

## 当前审计结论

2026-04-18 实测：

- 华为云 Nginx 入口 `113.44.132.75` 仍把 `iclaw.aiyuanxi.com` / `caiclaw.aiyuanxi.com` API upstream 指向 `115.191.6.179:2130`
- 同一台华为云机器访问 `115.191.6.179:2130` 和 `115.191.6.179:9000` 都超时
- 本地 SSH 访问 `115.191.6.179:22` 也超时
- `47.93.231.197` 仍可访问，且 PostgreSQL / Redis / MinIO 正常
- `47.93.231.197` 的关键数据：
  - PostgreSQL 数据库：`iclaw_control`
  - `app.users`: `6`
  - `app.oem_app_assets`: `35`
  - `app.cloud_skill_catalog`: `31153`
  - `app.cloud_mcp_catalog`: `34`
  - `app.oem_system_state` 存在，包含 `payment_gateway:epay`
  - MinIO buckets:
    - `iclaw-files` `147MiB / 752 objects`
    - `licaiclaw-files` `438MiB / 2533 objects`
    - `iclaw-user-assets` `0 objects`
- `47.93.231.197` 上未发现 `iclaw-prod` / `licaiclaw-prod` 下载桶，说明下载/runtime 历史上在旧 prod 主机侧维护
- 阿里云 `39.106.110.149` 是干净机：
  - Ubuntu 24.04
  - 仅 SSH 开放
  - 未安装 Node / pnpm / pm2 / PostgreSQL / Redis / MinIO
  - `/opt/iclaw` 不存在

结论：

- 真实迁移不是“一台机对一台机 copy”
- 当前至少有两类来源：
  - 业务数据、支付状态、品牌资产：`47.93.231.197`
  - 下载/runtime：历史上在 `115.191.6.179`
- 如果 `115.191.6.179` 无法恢复，下载/runtime 需要从本地 `dist/releases` 和本地 runtime artifact 重新发布

## 迁移原则

1. 先恢复服务，再做架构优化
2. 先保持单机 prod 结构：
   - 华为云 Nginx 继续做统一入口
   - 阿里云 `39.106.110.149` 承接 control-plane + PostgreSQL + Redis + MinIO
3. 不把 RDS / OSS / ALB 双活和这次恢复切换绑在一起
4. Redis 不做强制数据迁移，允许用户重新登录；PostgreSQL 和 MinIO 资产必须迁

## 步骤 1：初始化阿里云目标机

在本地执行，先安装 Node / pnpm / pm2，再把 repo 同步到目标机，最后用现有脚本安装 PostgreSQL / Redis / MinIO：

```bash
ssh root@39.106.110.149 '
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y curl ca-certificates gnupg rsync
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" >/etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
  npm install -g pnpm pm2
  mkdir -p /opt/iclaw
'
```

然后同步仓库并安装状态服务：

```bash
rsync -avz --delete ./ root@39.106.110.149:/opt/iclaw/

ssh root@39.106.110.149 '
  cd /opt/iclaw &&
  ICLAW_SOURCE_PG_DB=iclaw_control_prod \
  ICLAW_SOURCE_PG_USER=iclaw_app \
  ICLAW_SOURCE_PG_PASSWORD=/yk1HMBzsnATxpaelZaEq8x1t2Vm3c8G \
  ICLAW_SOURCE_REDIS_PASSWORD=ghN+pxXds9oofegp7CgPH00bpfLkDV5l \
  ICLAW_SOURCE_MINIO_ROOT_USER=minioadmin \
  ICLAW_SOURCE_MINIO_ROOT_PASSWORD=minioadmin \
  ICLAW_SOURCE_MINIO_USER=openalpha \
  ICLAW_SOURCE_MINIO_PASSWORD=openalpha_prod_2026 \
  bash scripts/setup-source-infra.sh
'
```

说明：

- 这里复用了现有安装脚本，但显式把数据库名改成 `iclaw_control_prod`
- Redis 默认仅本机 `127.0.0.1` 使用即可
- 如果后续决定轮换密码，应在切流量前同步改远端 `.env.prod`

## 步骤 2：准备阿里云远端 `.env.prod`

远端 `/opt/iclaw/.env.prod` 至少需要：

```dotenv
APP_NAME=caiclaw
PORT=2130
API_URL=https://caiclaw.aiyuanxi.com
VITE_API_BASE_URL=https://caiclaw.aiyuanxi.com
VITE_AUTH_BASE_URL=https://caiclaw.aiyuanxi.com
DATABASE_URL=postgres://iclaw_app:%2Fyk1HMBzsnATxpaelZaEq8x1t2Vm3c8G@127.0.0.1:5432/iclaw_control_prod?options=-c%20search_path%3Dapp%2Cpublic
CONTROL_PLANE_REDIS_URL=redis://127.0.0.1:6379/2
CONTROL_PLANE_REDIS_KEY_PREFIX=caiclaw:control-plane:prod
CONTROL_PLANE_ALLOWED_ORIGINS=https://caiclaw.aiyuanxi.com,https://caiclaw-admin.aiyuanxi.com,https://iclaw.aiyuanxi.com
CONTROL_PLANE_HOST=0.0.0.0
S3_ENDPOINT=http://127.0.0.1:9000
S3_ACCESS_KEY=openalpha
S3_SECRET_KEY=openalpha_prod_2026
S3_BUCKET=iclaw-files
ICLAW_PACKAGE_SOURCE_DATABASE_URL=postgres://iclaw_app:%2Fyk1HMBzsnATxpaelZaEq8x1t2Vm3c8G@47.93.231.197:5432/iclaw_control?options=-c%20search_path%3Dapp%2Cpublic
ICLAW_PACKAGE_SOURCE_CONTROL_PLANE_REDIS_URL=redis://default:ghN+pxXds9oofegp7CgPH00bpfLkDV5l@47.93.231.197:6379/0
ICLAW_PACKAGE_SOURCE_S3_ENDPOINT=http://47.93.231.197:9000
ICLAW_PACKAGE_SOURCE_S3_ACCESS_KEY=openalpha
ICLAW_PACKAGE_SOURCE_S3_SECRET_KEY=b1+G+wc/UX28Eo4JDbirB6Abs6uVm6t1
```

补充：

- 生产第三方 API key / OAuth secret / 支付配置沿用原 `.env.prod` 的现有值
- `CONTROL_PLANE_SUPER_ADMIN_EMAILS` 也要一并带上

## 步骤 3：迁 PostgreSQL

从 `47.93.231.197` 导出 `app` schema，恢复到阿里云 `iclaw_control_prod`：

```bash
ICLAW_SOURCE_HOST=47.93.231.197 \
ICLAW_PROD_HOST=39.106.110.149 \
ICLAW_SOURCE_DB_URL='postgresql://iclaw_app:/yk1HMBzsnATxpaelZaEq8x1t2Vm3c8G@127.0.0.1:5432/iclaw_control' \
ICLAW_PROD_DB_URL='postgresql://iclaw_app:/yk1HMBzsnATxpaelZaEq8x1t2Vm3c8G@127.0.0.1:5432/iclaw_control_prod' \
bash scripts/sync-control-plane-db-to-prod.sh
```

恢复后立刻核对：

```bash
ssh root@39.106.110.149 \
  'PGPASSWORD="/yk1HMBzsnATxpaelZaEq8x1t2Vm3c8G" psql -h 127.0.0.1 -U iclaw_app -d iclaw_control_prod -c "select count(*) from app.users; select count(*) from app.oem_app_assets;"'
```

## 步骤 4：迁 MinIO 资产桶

先镜像 `47.93.231.197` 上的业务/品牌资产桶到阿里云：

```bash
ICLAW_SOURCE_MINIO_URL=http://47.93.231.197:9000 \
ICLAW_SOURCE_MINIO_ACCESS_KEY=openalpha \
ICLAW_SOURCE_MINIO_SECRET_KEY='b1+G+wc/UX28Eo4JDbirB6Abs6uVm6t1' \
ICLAW_PROD_MINIO_URL=http://39.106.110.149:9000 \
ICLAW_PROD_MINIO_ACCESS_KEY=openalpha \
ICLAW_PROD_MINIO_SECRET_KEY='openalpha_prod_2026' \
ICLAW_SYNC_BUCKETS=iclaw-files,licaiclaw-files,iclaw-user-assets \
bash scripts/sync-minio-to-prod.sh
```

## 步骤 5：恢复下载与 runtime

这是本次迁移最容易漏掉的一段。

### 方案 A：如果 `115.191.6.179` 恢复可访问

直接从旧 prod 镜像：

- `iclaw-prod`
- `licaiclaw-prod`

### 方案 B：如果 `115.191.6.179` 继续不可访问

从本地重新发布：

1. 下载包：用 `dist/releases/` 里的现有 prod 产物重新上传
2. OpenClaw runtime：用本地 runtime archive 重新执行 `bash scripts/publish-openclaw-runtime.sh prod <target>`

切换前必须确保以下 URL 至少恢复：

- `/downloads/latest-prod.json`
- `/downloads/mac/aarch64/...`
- `/downloads/windows/x64/...`
- `/runtime/openclaw/...`

## 步骤 6：部署 control-plane 到阿里云

```bash
ICLAW_CONTROL_PLANE_HOST=39.106.110.149 \
bash scripts/deploy-control-plane.sh prod
```

该脚本会：

- rsync control-plane 代码
- 远端 `pnpm install`
- `pm2 restart iclaw-control-plane`
- 调用 `sync-system-overrides.ts` 把 `payment_gateway:epay` 等 system state 从 source DB 同步到 prod DB

部署完成后在阿里云本机验证：

```bash
ssh root@39.106.110.149 'curl -i http://127.0.0.1:2130/health'
```

## 步骤 7：修改华为云 Nginx

需要把以下回源全部从 `115.191.6.179` 改到 `39.106.110.149`：

- `upstream iclaw_control_plane`
- `upstream caiclaw_control_plane`
- `/runtime/`
- `/downloads/`

改完后执行：

```bash
ssh root@113.44.132.75 'nginx -t && systemctl reload nginx'
```

## 步骤 8：切换后验证

必做：

```bash
curl -i https://caiclaw.aiyuanxi.com/health
curl -i https://iclaw.aiyuanxi.com/health
curl -i -X OPTIONS \
  -H "Origin: tauri://localhost" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,x-iclaw-app-name,x-iclaw-channel" \
  https://caiclaw.aiyuanxi.com/auth/login
curl -I https://caiclaw.aiyuanxi.com/downloads/latest-prod.json
curl -I https://caiclaw.aiyuanxi.com/runtime/openclaw/2026.3.13/openclaw-runtime-aarch64-apple-darwin-2026.3.13.tar.gz
```

业务验证：

- 登录 / 刷新 token
- `portal/public-config`
- `desktop/release-manifest`
- 管理后台打开与保存
- 头像 / 品牌资产 URL 可访问
- 支付配置读取正常

## 步骤 9：回滚

回滚条件：

- control-plane 频繁 5xx
- 登录不可用
- 下载或 runtime 无法访问
- 支付配置丢失

回滚动作：

1. 华为云 Nginx 把 upstream 改回原值
2. 保留阿里云数据库和 MinIO 不删除，留作排障现场
3. 如果旧 prod 仍不可达，则回滚没有意义，应继续修阿里云目标机

现实判断：

- 当前 `115.191.6.179` 已不可达，传统意义上的“回滚到旧 prod”大概率不可用
- 这次更像“恢复到新 prod”，不是经典双活切换
