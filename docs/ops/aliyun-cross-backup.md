# Aliyun Cross Backup

更新时间：2026-04-20

## 目标

- `39.106.110.149` 每天把自己的 PostgreSQL 和 MinIO 备份到 `47.93.231.197`
- `47.93.231.197` 每天把自己的 PostgreSQL 和 MinIO 备份到 `39.106.110.149`
- 调度时间默认为每天 `03:00`，以服务器本地时区为准

这里做的是备份，不是双向 restore / 同步生产数据：

- PostgreSQL：每天生成 `pg_dump -Fc`，覆盖写入对端 MinIO 的固定备份对象
- S3 / MinIO：每天把业务 bucket 覆盖镜像到对端专用 backup bucket
- 默认只保留“当前最新一份”，不保留按日期滚动历史

## 文件

- 执行脚本：`scripts/run-cross-backup.sh`
- 安装脚本：`scripts/install-cross-backup.sh`
- 配置模板：`scripts/cross-backup.env.example`

## 推荐目录

- 远端执行脚本：`/usr/local/bin/iclaw-cross-backup.sh`
- 远端配置文件：`/etc/iclaw/cross-backup.env`
- 日志文件：`/var/log/iclaw-cross-backup.log`

## 配置方式

推荐在每台服务器各自准备一个 env 文件。这个文件本身是 shell 脚本，可以先 `source /opt/iclaw/.env.prod`，然后只补 backup 所需的 peer 配置。

最关键的变量：

- `ICLAW_CROSS_BACKUP_NODE_NAME`
- `ICLAW_CROSS_BACKUP_PG_URL`
- `ICLAW_CROSS_BACKUP_PG_SCHEMA`
- `ICLAW_CROSS_BACKUP_PG_PREFIX`
- `ICLAW_CROSS_BACKUP_PG_OBJECT_NAME`
- `ICLAW_CROSS_BACKUP_S3_SOURCE_ENDPOINT`
- `ICLAW_CROSS_BACKUP_S3_SOURCE_ACCESS_KEY`
- `ICLAW_CROSS_BACKUP_S3_SOURCE_SECRET_KEY`
- `ICLAW_CROSS_BACKUP_S3_BUCKETS`
- `ICLAW_CROSS_BACKUP_S3_TARGET_ENDPOINT`
- `ICLAW_CROSS_BACKUP_S3_TARGET_ACCESS_KEY`
- `ICLAW_CROSS_BACKUP_S3_TARGET_SECRET_KEY`
- `ICLAW_CROSS_BACKUP_MANIFEST_PREFIX`
- `ICLAW_CROSS_BACKUP_MANIFEST_OBJECT_NAME`

## Aliyun 实例建议值

### 39.106.110.149

- `ICLAW_CROSS_BACKUP_NODE_NAME=aliyun-prod`
- `ICLAW_CROSS_BACKUP_S3_TARGET_ENDPOINT=http://47.93.231.197:9000`
- `ICLAW_CROSS_BACKUP_PG_URL` 建议复用本机 `DATABASE_URL`
- `ICLAW_CROSS_BACKUP_S3_SOURCE_*` 建议复用本机 `S3_*`

### 47.93.231.197

- `ICLAW_CROSS_BACKUP_NODE_NAME=aliyun-dev`
- `ICLAW_CROSS_BACKUP_S3_TARGET_ENDPOINT=http://39.106.110.149:9000`
- `ICLAW_CROSS_BACKUP_PG_URL` 指向本机 PostgreSQL
- `ICLAW_CROSS_BACKUP_S3_SOURCE_*` 指向本机 MinIO

## 安装

先分别准备两份 env 文件，例如：

- `cross-backup.aliyun-prod.env`
- `cross-backup.aliyun-dev.env`

然后从本机执行：

```bash
bash scripts/install-cross-backup.sh ./cross-backup.aliyun-prod.env root@39.106.110.149
bash scripts/install-cross-backup.sh ./cross-backup.aliyun-dev.env root@47.93.231.197
```

安装脚本会做这些事情：

- 下发 `scripts/run-cross-backup.sh`
- 下发 `/etc/iclaw/cross-backup.env`
- 检查 `mc`，缺失时自动安装
- 写入 cron：

```cron
0 3 * * * flock -n /var/lock/iclaw-cross-backup.lock /usr/local/bin/iclaw-cross-backup.sh /etc/iclaw/cross-backup.env >> /var/log/iclaw-cross-backup.log 2>&1 # iclaw-cross-backup
```

如果要安装后立刻跑一次：

```bash
ICLAW_CROSS_BACKUP_RUN_AFTER_INSTALL=1 \
bash scripts/install-cross-backup.sh ./cross-backup.aliyun-prod.env root@39.106.110.149
```

## 当前线上定时任务配置

当前线上是通过 `root` 用户的 `crontab` 落地，不是 `systemd timer`。

已安装主机：

- `39.106.110.149`
- `47.93.231.197`

当前实际 cron 行：

```cron
0 3 * * * flock -n /var/lock/iclaw-cross-backup.lock /usr/local/bin/iclaw-cross-backup.sh /etc/iclaw/cross-backup.env >> /var/log/iclaw-cross-backup.log 2>&1 # iclaw-cross-backup
```

含义：

- 每天凌晨 `03:00` 执行
- 以服务器本地时区为准
- 通过 `flock` 防止同机重复执行
- 读取 `/etc/iclaw/cross-backup.env`
- 执行 `/usr/local/bin/iclaw-cross-backup.sh`
- 输出追加到 `/var/log/iclaw-cross-backup.log`

当前路径约定：

- 执行脚本：`/usr/local/bin/iclaw-cross-backup.sh`
- 配置文件：`/etc/iclaw/cross-backup.env`
- 日志文件：`/var/log/iclaw-cross-backup.log`
- 锁文件：`/var/lock/iclaw-cross-backup.lock`

## 当前线上备份路径

### 本机临时目录

每次执行时，源机器会先在本机生成临时目录：

- `/var/tmp/iclaw-cross-backup/run-<UTC时间戳>.*`

用途：

- 暂存 PostgreSQL dump
- 暂存 dump 校验文件 `.sha256`
- 暂存本次执行 manifest

这些临时文件在脚本退出时会自动清理，不作为长期备份保留路径。

### PostgreSQL 备份落点

PostgreSQL dump 不落本地长期目录，长期保存在对端 MinIO 的固定对象路径，每次执行覆盖上一份：

- dump：
  - `iclaw-cross-backup-postgres/<node>/current/<node>-control-plane.dump`
- checksum：
  - `iclaw-cross-backup-postgres/<node>/current/<node>-control-plane.dump.sha256`

当前两台机器对应关系：

- `39.106.110.149` 生成的 PostgreSQL 备份写到 `47.93.231.197:9000`
  - `iclaw-cross-backup-postgres/aliyun-prod/current/aliyun-prod-control-plane.dump`
- `47.93.231.197` 生成的 PostgreSQL 备份写到 `39.106.110.149:9000`
  - `iclaw-cross-backup-postgres/aliyun-dev/current/aliyun-dev-control-plane.dump`

### Manifest 落点

每次执行都会在对端 MinIO 覆盖写一份 manifest：

- `iclaw-cross-backup-manifests/<node>/latest.txt`

当前两台机器对应关系：

- `39.106.110.149 -> 47.93.231.197`
  - `iclaw-cross-backup-manifests/aliyun-prod/latest.txt`
- `47.93.231.197 -> 39.106.110.149`
  - `iclaw-cross-backup-manifests/aliyun-dev/latest.txt`

### S3 / MinIO 备份落点

对象存储采用“每个源 bucket 对应一个对端 backup bucket”的方式，不直接覆盖对端业务 bucket。

命名规则：

- backup bucket：
  - `iclaw-cross-backup-<node>-<source-bucket>`
- bucket 内对象根目录：
  - `data/`

因此对象的长期落点格式是：

- `iclaw-cross-backup-<node>-<source-bucket>/data/<原始对象路径>`

这里的 `data/` 始终表示“当前最新镜像”，通过 `mc mirror --overwrite --remove` 覆盖同步，不保留时间分层。

### 当前线上实际 bucket 映射

当前线上配置了以下源 bucket；如果某个 bucket 在源端不存在，脚本会自动跳过。

`39.106.110.149 -> 47.93.231.197`

- `iclaw-files`
  - `iclaw-cross-backup-aliyun-prod-iclaw-files/data/`
- `licaiclaw-files`
  - `iclaw-cross-backup-aliyun-prod-licaiclaw-files/data/`
- `iclaw-user-assets`
  - `iclaw-cross-backup-aliyun-prod-iclaw-user-assets/data/`
- `iclaw-prod`
  - `iclaw-cross-backup-aliyun-prod-iclaw-prod/data/`
- `licaiclaw-prod`
  - `iclaw-cross-backup-aliyun-prod-licaiclaw-prod/data/`
- `caiclaw-prod`
  - `iclaw-cross-backup-aliyun-prod-caiclaw-prod/data/`
- `openalpha-files`
  - `iclaw-cross-backup-aliyun-prod-openalpha-files/data/`

`47.93.231.197 -> 39.106.110.149`

- `iclaw-files`
  - `iclaw-cross-backup-aliyun-dev-iclaw-files/data/`
- `licaiclaw-files`
  - `iclaw-cross-backup-aliyun-dev-licaiclaw-files/data/`
- `iclaw-user-assets`
  - `iclaw-cross-backup-aliyun-dev-iclaw-user-assets/data/`
- `iclaw-prod`
  - `iclaw-cross-backup-aliyun-dev-iclaw-prod/data/`
- `licaiclaw-prod`
  - `iclaw-cross-backup-aliyun-dev-licaiclaw-prod/data/`
- `caiclaw-prod`
  - `iclaw-cross-backup-aliyun-dev-caiclaw-prod/data/`
- `openalpha-files`
  - `iclaw-cross-backup-aliyun-dev-openalpha-files/data/`

如果后续需要改调度时间，不直接手改线上 crontab，优先重新执行安装脚本并覆盖：

```bash
ICLAW_CROSS_BACKUP_CRON_SCHEDULE="30 2 * * *" \
bash scripts/install-cross-backup.sh ./cross-backup.aliyun-prod.env root@39.106.110.149

ICLAW_CROSS_BACKUP_CRON_SCHEDULE="30 2 * * *" \
bash scripts/install-cross-backup.sh ./cross-backup.aliyun-dev.env root@47.93.231.197
```

## 手工验证

### 单机先跑一次

```bash
bash scripts/run-cross-backup.sh ./cross-backup.aliyun-prod.env
```

### 检查 cron

```bash
ssh root@39.106.110.149 'crontab -l | grep iclaw-cross-backup'
ssh root@47.93.231.197 'crontab -l | grep iclaw-cross-backup'
```

### 检查日志

```bash
ssh root@39.106.110.149 'tail -n 100 /var/log/iclaw-cross-backup.log'
ssh root@47.93.231.197 'tail -n 100 /var/log/iclaw-cross-backup.log'
```

### 检查备份对象

查看对端 MinIO 上是否出现：

- `iclaw-cross-backup-postgres/<node>/current/*.dump`
- `iclaw-cross-backup-manifests/<node>/latest.txt`
- `iclaw-cross-backup-<node>-<bucket>/data/*`

## 保留策略

当前策略是“单份覆盖式同步”：

- PostgreSQL：固定对象覆盖
- manifest：固定对象覆盖
- S3 / MinIO：固定 bucket 的 `data/` 目录覆盖镜像
- 默认关闭 backup bucket versioning，避免对象版本持续膨胀

如果历史上已经跑过旧版“按日期归档”或开过 versioning，旧对象不会被这次脚本自动清掉；那部分需要单独做一次性清理。

## 风险提示

- 这是“跨机灾备副本”，不是第三份异地副本；任一侧的 MinIO 自身损坏仍然会影响作为 backup target 的那一侧
- `ICLAW_CROSS_BACKUP_S3_MIRROR_REMOVE=1` 时，对端 backup bucket 会被同步成“当前源 bucket 的精确副本”；被源端删除的对象会在下一次同步时从 backup bucket 删除
- 如果 bucket 特别大，首次 mirror 会比较慢，建议先手工跑一次再依赖 cron
