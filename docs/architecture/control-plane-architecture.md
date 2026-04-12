# iClaw Control Plane Architecture

更新时间：2026-03-09

## 1. 目标

将 iClaw 的产品级后端能力从 OpenAlpha / OpenClaw 执行层中剥离出来，形成独立的云端 control plane。

明确约束：

- 不复用 OpenAlpha 的 PG 表结构
- 不复用 OpenAlpha 的 users / auth / billing 表
- iClaw 使用全新数据库模型和迁移体系

control plane 负责：

- 账号注册、登录、刷新、注销
- 用户资料与设备会话
- credit 余额与账本
- run 授权与额度控制
- usage 事件接收与结算

OpenClaw / 本地 sidecar 继续负责：

- 本地运行时管理
- agent 执行
- chat / file / tool / skill 处理
- 本地历史、附件、重试队列

## 2. 架构分层

```text
Desktop / Web Client
  -> iClaw Cloud Control API
     -> PostgreSQL

Desktop / Web Client
  -> Local iClaw Sidecar
     -> OpenClaw runtime
     -> local sqlite / file storage
```

关键原则：

- PG 是云端权威数据库，不直接暴露给客户端。
- login / credit / usage 不进入 OpenClaw 内部模型。
- 本地 sidecar 不是可信计费点，只是执行与缓存层。
- 客户端只通过稳定的 SDK 边界访问云端 control plane 和本地 sidecar。

## 3. 信任边界

### 3.1 云端可信

以下数据必须只以云端为准：

- 用户身份
- refresh token / session
- credit 余额
- usage 结算记录
- run 授权状态

### 3.2 本地不可信

以下数据可以落本地，但不能作为最终权威：

- chat history
- file cache
- usage 草稿 / 待上报记录
- 当前 sidecar 运行状态

原因：

- 用户可修改本地文件和进程环境
- 用户可拦截或伪造本地请求
- 本地 sidecar 无法承担真钱成本下的最终计费责任

## 4. 为什么不把产品后端包进 OpenClaw

不建议把 auth / billing / credit 直接塞进 OpenClaw，原因如下：

- OpenClaw 是执行层，不是产品 control plane。
- auth / credit / billing 的变更频率和执行引擎不同。
- 将产品数据模型耦合到 OpenClaw，会显著增加升级和替换成本。
- 后续即使执行层替换为别的 agent runtime，云端 control plane 仍可复用。

结论：

- 云端必须有独立 control plane。
- 本地可以有一个很薄的 wrapper / gateway，但不要做成“大一统后端”。

## 5. 推荐的最小链路

### 5.1 登录

1. 客户端调用 cloud control plane 的 `/auth/login`
2. control plane 校验用户并签发 access token / refresh token
3. 客户端将 token 存入系统安全存储
4. sidecar 不持有用户密码

### 5.2 启动

1. 客户端拉起本地 sidecar
2. sidecar 准备本地 sqlite、workspace、日志目录
3. 客户端调用 cloud control plane 的 `/auth/me` 和 `/credits/me`

### 5.3 发起一次对话 run

1. 客户端先向云端请求 `/agent/run/authorize`
2. 云端返回短期 run grant
3. 客户端将 run grant 连同用户输入发送到本地 sidecar
4. sidecar 驱动 OpenClaw 执行
5. sidecar 将 usage 草稿落本地，并异步上报云端
6. 云端按幂等 key 记账、扣减 credit、写入 usage ledger

### 5.4 离线 / 重试

1. sidecar 本地保存 `pending_usage_events`
2. 网络恢复后自动重放
3. 云端以 `event_id` 做幂等去重

## 6. Cloud Control API 最小职责

建议最先实现以下接口：

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/wechat`
- `POST /auth/google`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `PUT /auth/profile`
- `POST /auth/change-password`
- `GET /auth/linked-accounts`
- `GET /credits/me`
- `GET /credits/ledger`
- `POST /agent/run/authorize`
- `POST /usage/events`

其中：

- `/agent/run/authorize` 返回短期运行授权，不负责实际执行 agent。
- `/usage/events` 只接收执行结果与 token/credit 统计，不负责生成内容。

## 7. 数据模型建议

PostgreSQL 建议拆为以下核心表：

- `users`
- `user_emails`
- `user_oauth_accounts`
- `user_password_credentials`
- `device_sessions`
- `refresh_tokens`
- `credit_accounts`
- `credit_ledger`
- `run_grants`
- `usage_events`

建议约束：

- `username` 全局唯一
- `email` 全局唯一且标准化存储
- 密码凭据单独建表，不把密码相关字段混进 profile 模型
- credit 采用 ledger，不要只存余额字段
- 所有扣费事件必须幂等
- `usage_events.event_id` 全局唯一
- `run_grants` 必须有过期时间和状态

## 8. Run Grant 设计

建议 run grant 至少包含：

- `grant_id`
- `user_id`
- `device_id`
- `session_id`
- `issued_at`
- `expires_at`
- `max_input_tokens`
- `max_output_tokens`
- `credit_limit`
- `nonce`
- `signature`

目的：

- 防止客户端无限制调用本地 sidecar
- 让云端保留每次 run 的授权记录
- 为后续额度、套餐、风控提供统一切入点

## 9. Sidecar 职责收敛

本地 sidecar 建议只承担：

- OpenClaw 进程管理
- 本地聊天与附件缓存
- run 执行
- usage 上报重试
- 错误诊断与日志导出

不承担：

- 最终鉴权权威
- credit 结算权威
- 用户余额写入
- 套餐与计费规则

## 10. 分阶段落地

### Phase 1

- 建 control plane 服务目录
- 从 OpenAlpha 切出 `/auth/*`
- 保留本地 sidecar 聊天链路不变

### Phase 2

- 增加 `credits`、`run authorize`、`usage events`
- sidecar 接入本地 usage outbox

### Phase 3

- 增加账单、风控、后台管理
- 决定是否引入云端推理代理

## 11. 当前仓库建议

短期内不改 OpenClaw 内核，先做以下结构：

```text
services/
  openclaw/
  control-plane/
```

这样可以保持：

- `services/openclaw` 继续是执行层
- `services/control-plane` 成为 auth / billing / credits 的云端服务
- `packages/sdk` 继续作为客户端统一访问层
- 新账号体系与 OpenAlpha 物理隔离，后续迁移策略单独处理
