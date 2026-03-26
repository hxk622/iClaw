# Prod Infra Inventory

更新时间：2026-03-26

## 主机角色

- 前端 / Nginx / 公网 DNS 落点
  - Host: `113.44.132.75`
  - User: `root`
  - 用途：
    - 官网 / 下载页静态资源
    - Nginx 对外入口
- 后端 / control-plane / PM2
  - Host: `115.191.6.179`
  - User: `root`
  - Repo path: `/opt/iclaw`
  - PM2 process: `iclaw-control-plane`
  - 用途：
    - `services/control-plane`
    - PostgreSQL / Redis 相关后端运行环境

## 约束

- 这些地址、用户名、默认路径可以写进文档和脚本默认值
- 密码、私钥、令牌等敏感凭据不写入仓库
- 生产部署优先通过脚本默认值 + 环境变量 override，不依赖人工口述

## 常用校验

- control-plane 健康检查：
  - `curl -i https://caiclaw.aiyuanxi.com/health`
- 桌面端 CORS 校验：
  - `curl -i -X OPTIONS -H 'Origin: tauri://localhost' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type,x-iclaw-app-name,x-iclaw-channel' https://caiclaw.aiyuanxi.com/auth/login`
