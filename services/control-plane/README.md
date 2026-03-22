# services/control-plane

iClaw 云端 control plane 服务目录。

职责：

- auth
- session
- credit ledger
- run authorize
- usage settlement

非职责：

- OpenClaw agent 执行
- skill / tool orchestration
- 本地附件和工作区管理

当前目录已包含一个最小 Node/TypeScript 服务骨架：

```text
services/control-plane/
  README.md
  package.json
  src/
  sql/
    000_bootstrap.sql
    001_init.sql
```

说明：

- 当前阶段先用 Node/TypeScript 起第一版，便于复用 monorepo 和前端团队现有工具链。
- 当前运行时只支持 PostgreSQL；`DATABASE_URL` 必填。
- 账号体系为 iClaw 全新设计，不复用 OpenAlpha 现有 PG 表。

## Commands

```bash
pnpm install
pnpm db:init:control-plane
pnpm preset:sync:oem
pnpm --filter @iclaw/control-plane dev
pnpm --filter @iclaw/control-plane check
```

初始化新 PostgreSQL：

```bash
ICLAW_CONTROL_DB_SUPERUSER=postgres \
ICLAW_CONTROL_DB_PASSWORD=change_me \
pnpm db:init:control-plane
```

可覆盖变量：

- `ICLAW_CONTROL_DB_HOST`
- `ICLAW_CONTROL_DB_PORT`
- `ICLAW_CONTROL_DB_SUPERUSER`
- `ICLAW_CONTROL_DB_NAME`
- `ICLAW_CONTROL_DB_USER`
- `ICLAW_CONTROL_DB_PASSWORD`

默认地址：

- `http://127.0.0.1:2130`

说明：

- `2130` 是 control-plane 后端端口，只负责 auth / credits / usage
- 本地前端调试端口固定是 `http://127.0.0.1:1520`
- OAuth 回调 URI 在本地开发时应配置为 `http://127.0.0.1:1520/oauth-callback.html`，除非你显式覆盖

默认会从环境变量读取：

- `PORT`
- `DATABASE_URL`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`
- `API_URL` / `APP_URL`
- `CONTROL_PLANE_REDIS_URL` / `REDIS_URL`
- `CONTROL_PLANE_REDIS_KEY_PREFIX`
- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `CONTROL_PLANE_ADMIN_EMAILS`
- `CONTROL_PLANE_SUPER_ADMIN_EMAILS`
- `ACCESS_TOKEN_TTL_SECONDS`
- `REFRESH_TOKEN_TTL_SECONDS`
- `DEFAULT_CREDIT_BALANCE`
- `CREDIT_COST_INPUT_PER_1K`
- `CREDIT_COST_OUTPUT_PER_1K`

默认值不再从 `brands/<brand-id>/brand.json` 读取。当前 control-plane 只使用：

- 环境变量
- `ICLAW_PORTAL_APP_NAME` / `ICLAW_BRAND` / `ICLAW_APP_NAME` 推导的 app-name 级默认前缀

OEM portal 现在也是 control-plane 的职责范围之一：

- `oem_apps` 保存 OEM app 主配置
- `oem_skill_catalog` / `oem_mcp_catalog` / `oem_model_catalog` 保存平台能力目录
- `oem_app_skill_bindings` / `oem_app_mcp_bindings` / `oem_app_model_bindings` / `oem_app_menu_bindings` 保存 OEM app 级 binding
- `oem_app_assets` 保存 MinIO 资产索引
- `pnpm preset:sync:oem` 会把 `services/control-plane/presets/core-oem.json` 里的预置 app、skill、MCP、model、menu、asset 同步进数据库和对象存储

在未显式覆盖环境变量时，会按 app-name 推导这些默认值：

- `serviceName`
- `S3_BUCKET`
- `CONTROL_PLANE_REDIS_KEY_PREFIX`
- `CONTROL_PLANE_ALLOWED_ORIGINS` 使用本地固定白名单

Redis 是可选的：

- 不配置：直接走 PostgreSQL
- 配置后：缓存 token session、user lookup、credit balance、credit ledger、usage event 幂等结果

头像存储：

- 用户头像走 MinIO / S3 兼容接口
- 推荐为 iClaw 单独使用一个 bucket，例如 `iclaw-files`
- 不要复用 OpenAlpha 的业务数据库；同一个 PostgreSQL 实例可以，但 database 应保持隔离

OAuth：

- `POST /auth/wechat`
- `POST /auth/google`

角色引导：

- `CONTROL_PLANE_SUPER_ADMIN_EMAILS` 中的邮箱会在注册、登录、OAuth 登录和 `GET /auth/me` 时自动提升为 `super_admin`
- `CONTROL_PLANE_ADMIN_EMAILS` 中的邮箱会自动提升为 `admin`

账号相关：

- `PUT /auth/profile`
- `POST /auth/change-password`
- `GET /auth/linked-accounts`

技能目录管理（admin / super_admin）：

- `GET /admin/skills/catalog`
- `PUT /admin/skills/catalog`
- `DELETE /admin/skills/catalog?slug=<slug>`

usage 结算：

- `usage/events` 现在以服务端按 token 数量计费为准，不再信任客户端传入的 `credit_cost`
- 必须带有效 `grant_id`
- `usage/events` 返回服务端 settled billing summary，供前端只做展示
- `GET /agent/run/billing?grant_id=...` 可按 run grant 查询 billing summary

已实现接口：

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `GET /credits/me`
- `GET /credits/ledger`
- `POST /agent/run/authorize`
- `GET /agent/run/billing`
- `POST /usage/events`
