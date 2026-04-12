# Prod Infra Inventory

更新时间：2026-03-26

## 主机角色

- 源环境 / PostgreSQL / MinIO
  - Host: `47.93.231.197`
  - User: `root`
  - 用途：
    - 作为默认 PostgreSQL 源库主机
    - 作为默认 MinIO 源桶主机
    - 给线上 `prod` 做数据与对象同步时的默认 source
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
    - 火山 MinIO
  - MinIO:
    - Endpoint: `http://115.191.6.179:9000`
    - Bucket: `licaiclaw-prod`
    - 当前远端 `mc` 默认 alias：`local`
    - 下载页实际发布目录：`licaiclaw-prod/downloads/`
    - `https://caiclaw.aiyuanxi.com/downloads/<file>` 对应桶内 `downloads/<file>`

## 约束

- 这些地址、用户名、默认路径可以写进文档和脚本默认值
- 密码、私钥、令牌等敏感凭据不写入仓库
- 生产部署优先通过脚本默认值 + 环境变量 override，不依赖人工口述
- 当前开发机不再默认承载 PostgreSQL / MinIO
- 当前开发机上的 PostgreSQL / MinIO 默认关闭，并取消开机自动重启
- 以后需要把本地数据推到线上时，默认 source 为 `47.93.231.197`

## 常用校验

- control-plane 健康检查：
  - `curl -i https://caiclaw.aiyuanxi.com/health`
- 桌面端 CORS 校验：
  - `curl -i -X OPTIONS -H 'Origin: tauri://localhost' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type,x-iclaw-app-name,x-iclaw-channel' https://caiclaw.aiyuanxi.com/auth/login`
