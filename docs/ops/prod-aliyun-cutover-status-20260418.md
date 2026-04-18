# Prod Aliyun Cutover Status

更新时间：2026-04-18

## 结论

本次 prod 迁移的核心链路已经恢复并切到阿里云 `39.106.110.149`。

当前可视为：

- control-plane 已迁移完成
- PostgreSQL / Redis / MinIO 已迁移完成
- 华为云 Nginx 入口已切流完成
- mac 下载与 runtime 已恢复
- Windows 安装包本体仍待手动补包

## 当前生产拓扑

- 公网入口 / Nginx：`113.44.132.75`
- 新 prod 主机 / control-plane / PostgreSQL / Redis / MinIO：`39.106.110.149`
- 默认数据源 / 资产源：`47.93.231.197`
- 旧火山云 prod：`115.191.6.179`
  - 2026-04-18 审计时不可达

## 已完成项

### 1. 新 prod 主机初始化

已在 `39.106.110.149` 完成：

- Node / pnpm / pm2 安装
- PostgreSQL 安装与初始化
- Redis 安装与初始化
- MinIO 安装与初始化
- root SSH 免密登录
- `pm2-root.service` 开机自启

### 2. 数据迁移

已从 `47.93.231.197` 迁移并核对：

- PostgreSQL `app` schema
- `iclaw-files`
- `licaiclaw-files`
- `iclaw-user-assets`

核对结果：

- `app.users = 6`
- `app.oem_app_assets = 35`
- `app.cloud_skill_catalog = 31153`
- `app.cloud_mcp_catalog = 34`
- `app.oem_system_state = 4`

### 3. 入口切流

华为云 Nginx 已切换：

- API upstream -> `39.106.110.149:2130`
- `/runtime/*` -> `39.106.110.149:9000`
- `/downloads/*` -> `39.106.110.149:9000`

### 4. control-plane 恢复

新机 control-plane 已恢复并由 PM2 托管：

- 本机健康检查：`http://127.0.0.1:2130/health`
- 公网健康检查：`https://caiclaw.aiyuanxi.com/health`

### 5. 桌面发布恢复

已在新 control-plane 中恢复 mac 版本发布记录：

- `caiclaw` `1.0.8`
- `licaiclaw` `1.0.8`
- `iclaw` `1.0.5`

已恢复：

- `desktop/release-manifest`
- `desktop/release-file`
- 静态 `/downloads/latest-prod.json`
- 静态 mac DMG 下载

## 验证结果

### 公网健康检查

- `https://caiclaw.aiyuanxi.com/health` -> `200`
- `https://iclaw.aiyuanxi.com/health` -> `200`
- `https://caiclaw-admin.aiyuanxi.com` -> `200`

### CORS

- `OPTIONS https://caiclaw.aiyuanxi.com/auth/login` -> `204`
- `Access-Control-Allow-Origin: tauri://localhost`

### Public Config

- `https://caiclaw.aiyuanxi.com/portal/public-config?app_name=caiclaw&surface_key=home-web` -> 成功
- `https://iclaw.aiyuanxi.com/portal/public-config?app_name=iclaw&surface_key=home-web` -> 成功

### Release Manifest

- `https://caiclaw.aiyuanxi.com/desktop/release-manifest?app_name=caiclaw&channel=prod` -> 成功
- `https://caiclaw.aiyuanxi.com/desktop/release-manifest?app_name=licaiclaw&channel=prod` -> 成功
- `https://iclaw.aiyuanxi.com/desktop/release-manifest?app_name=iclaw&channel=prod` -> 成功

### Runtime

- `https://caiclaw.aiyuanxi.com/runtime/openclaw/2026.3.13/openclaw-runtime-aarch64-apple-darwin-2026.3.13.tar.gz` -> `200`
- `https://iclaw.aiyuanxi.com/runtime/openclaw/2026.3.13/openclaw-runtime-aarch64-apple-darwin-2026.3.13.tar.gz` -> `200`

### 静态下载

- `https://caiclaw.aiyuanxi.com/downloads/latest-prod.json` -> `200`
- `https://iclaw.aiyuanxi.com/downloads/latest-prod.json` -> `200`
- `https://caiclaw.aiyuanxi.com/downloads/mac/aarch64/LiCaiClaw_1.0.8.202604161726_aarch64_prod.dmg` -> `200`
- `https://iclaw.aiyuanxi.com/downloads/mac/aarch64/iClaw_1.0.5.202604131802_aarch64_prod.dmg` -> `200`
- `https://caiclaw.aiyuanxi.com/downloads/windows/x64/latest-prod-windows-x64.json` -> `200`

## 仍未完成

### Windows 安装包本体

当前仅缺：

- Windows `.exe` 安装包本体恢复

现状：

- Windows manifest 已可访问
- 本地仓库、阿里云新机、华为云入口机均未找到现成的 prod `.exe`
- 因此不能从现有资产直接恢复 Windows 安装包下载

后续动作：

1. 手动打新的 Windows 包
2. 上传到新 prod
3. 如需走 control-plane 下载链路，再补一条 Windows desktop release publish

## 运维备注

- `deploy-control-plane.sh` 已修复，会同步 `packages/shared/src/`
- `setup-source-infra.sh` 已修复 MinIO systemd 参数展开问题
- 新 prod 当前已具备标准化重复部署能力，不再依赖手工补文件

## 关联提交

- `f871c2a` `ops: move prod target to aliyun`
- `535def6` `ops: sync shared sources in control plane deploy`
