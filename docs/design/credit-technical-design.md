# iClaw Credit 技术设计草案

更新时间：2026-03-20

## 1. 目标

为 iClaw control plane 提供一套可审计、可幂等、可扩展的 credit 账务体系，支持：

- 每日免费额度
- 充值额度
- 任务预估
- 执行后结算
- 退款
- 成本与毛利回溯

当前阶段范围聚焦在两个真实可消费 bucket：

- `daily_free`
- `topup`

`subscription` 与长任务 `reserve` 先保留为后续扩展，不进入本阶段强依赖。

## 2. 设计原则

- PostgreSQL 为唯一权威账本
- 本地 sidecar 不作为最终计费依据
- 所有扣费操作必须幂等
- 余额字段只是读优化，账本才是权威事实
- 预估与实扣分离

## 2.1 当前实现基线

截至当前代码实现，已经冻结的最小计费口径如下：

- control plane 为唯一计费权威
- 客户端不再传入可信 `credit_cost`
- 服务端根据 `input_tokens` 与 `output_tokens` 计算最终龙虾币消耗
- 结算结果会同时写入 `usage_events`、`credit_ledger`，并回填到 `run_grants`

当前默认费率：

```text
输入 1000 tokens = 1 龙虾币
输出 500 tokens = 1 龙虾币
```

当前服务端公式：

```text
charged_credits =
  ceil(input_tokens / 1000 * CREDIT_COST_INPUT_PER_1K)
  + ceil(output_tokens / 1000 * CREDIT_COST_OUTPUT_PER_1K)
```

按当前默认配置，它等价于：

```text
charged_credits =
  ceil(input_tokens / 1000)
  + ceil(output_tokens / 500)
```

默认配置值：

- `CREDIT_COST_INPUT_PER_1K = 1`
- `CREDIT_COST_OUTPUT_PER_1K = 2`

设计含义：

- 先明确“输出比输入更贵”的基本原则
- 先用简单、稳定、可解释的费率跑通账务闭环
- 后续再演进到 `model_pricing`、`markup_multiplier`、`platform_fee_credits` 等更细粒度模型

## 3. 核心数据模型

## 3.1 `credit_accounts`

用途：用户当前余额快照。

建议字段：

```text
id
user_id
daily_free_balance
topup_balance
daily_free_granted_at
daily_free_expires_at
status
created_at
updated_at
```

说明：

- `daily_free_balance` 每天按 Asia/Shanghai 时区 00:00 重置为 `200`
- `topup_balance` 为用户充值后长期可消费余额
- `daily_free_expires_at` 固定指向下一个 Asia/Shanghai 00:00
- 页面显示的“可用余额”应为 `daily_free_balance + topup_balance`

## 3.2 `credit_ledger`

用途：资金流动权威记录。

建议字段：

```text
id
user_id
bucket
direction
amount
balance_after
reference_type
reference_id
idempotency_key
meta_json
created_at
```

枚举建议：

- `bucket`
  - `daily_free`
  - `topup`
- `direction`
  - `grant`
  - `consume`
  - `topup`
  - `refund`
  - `expire`
- `reference_type`
  - `daily_reset`
  - `trial_grant`
  - `topup_order`
  - `usage_quote`
  - `chat_run`
  - `agent_run`
  - `manual_adjustment`

说明：

- `daily_reset` 表示当天免费额度发放或重置
- `topup_order` 表示支付成功后的充值入账
- 一次真实扣费允许拆成多条 ledger，例如先扣 `daily_free` 再扣 `topup`

## 3.3 `payment_orders`

用途：充值订单主表。

建议字段：

```text
id
user_id
provider
package_id
package_name
credits
bonus_credits
amount_cny_fen
currency
status
provider_order_id
provider_prepay_id
paid_at
expired_at
meta_json
created_at
updated_at
```

状态建议：

- `created`
- `pending`
- `paid`
- `failed`
- `expired`
- `refunded`

## 3.4 `payment_webhook_events`

用途：记录支付回调原文，保证验签、幂等、审计可追溯。

建议字段：

```text
id
provider
event_id
event_type
order_id
payload_json
signature
processed_at
process_status
created_at
```

约束建议：

- `provider + event_id` 唯一
- 回调处理与充值入账必须在同一事务内完成，或由明确的 outbox/job 衔接

## 3.5 `model_pricing`

用途：底层模型定价配置。

建议字段：

```text
id
provider
model
input_usd_per_1m
output_usd_per_1m
cache_read_usd_per_1m
cache_write_usd_per_1m
tool_flat_usd
markup_multiplier
platform_fee_credits
effective_from
effective_to
created_at
```

说明：

- 不要把价格硬编码在业务逻辑里
- 价格变更应通过时间区间生效

## 3.6 `usage_quotes`

用途：保存发起前的估价结果。

建议字段：

```text
quote_id
user_id
scenario
provider_route
model
estimated_input_tokens
estimated_output_tokens_p50
estimated_output_tokens_p80
estimated_output_tokens_p95
estimated_credits_low
estimated_credits_high
max_charge_credits
expires_at
meta_json
created_at
```

## 3.7 `usage_charges`

用途：保存最终执行结算结果。

建议字段：

```text
run_id
quote_id
user_id
provider
model
input_tokens
output_tokens
cache_read_tokens
cache_write_tokens
tool_calls
raw_cost_usd_micros
cost_credits
charged_credits
status
created_at
```

## 4. 估价与结算流程

## 4.1 短请求

流程：

1. 客户端请求 quote
2. control plane 返回预计消耗
3. 客户端发起执行
4. 执行完成后按实际 usage 直接扣费

适用：

- 普通聊天
- 短回答
- 无长链工具执行

## 4.2 长任务

流程：

1. 客户端请求 quote
2. control plane 返回 `max_charge_credits`
3. control plane 先做 `reserve`
4. sidecar 执行任务
5. sidecar 上报实际 usage
6. control plane 结算实际扣费
7. 未用完的预留额度 `release/refund`

适用：

- 深度 agent
- 搜索/文件/多轮工具调用
- 批量任务

说明：

- 本阶段先不实现 `reserve`
- 长任务先沿用 `run_grant.credit_limit` 做上限控制
- `reserve/release` 放到后续迭代再补

## 4.3 每日赠送额度重置

推荐采用“定时重置 + 读写懒校正”双保险。

流程：

1. 定时任务在 Asia/Shanghai 每天 `00:00` 扫描活跃账户
2. 将 `daily_free_balance` 重置为 `200`
3. 更新 `daily_free_granted_at` 与 `daily_free_expires_at`
4. 写入一条 `credit_ledger(bucket=daily_free, direction=grant, reference_type=daily_reset)`
5. 若定时任务漏跑，则在 `GET /credits/me`、`POST /agent/run/authorize`、`POST /usage/events` 前做懒校正

设计要求：

- 用户当天未用完的 `daily_free_balance` 不结转
- 重置不会影响 `topup_balance`
- 同一天内重复执行重置必须幂等

## 4.4 充值到账流程

流程：

1. 客户端创建充值订单
2. control plane 返回支付参数或支付链接
3. 用户在微信或支付宝内扫码完成支付
4. 支付渠道回调 control plane webhook
5. control plane 验签、幂等校验、更新订单状态
6. 向 `topup_balance` 入账，并写 `credit_ledger(bucket=topup, direction=topup, reference_type=topup_order)`
7. 客户端查询订单状态并刷新余额

## 5. 额度扣减顺序

统一顺序：

1. `daily_free_balance`
2. `topup_balance`

理由：

- 先消耗会过期的额度
- 提升用户体验
- 减少充值额度被优先消耗导致的心理损失

扣费要求：

- 任何一次扣费都不允许把任何 bucket 扣成负数
- 若 `daily_free_balance` 不足，则差额从 `topup_balance` 扣减
- 若两者合计不足，`authorizeRun` 应直接拒绝，`usage/events` 也要再次兜底拒绝

## 6. 预估算法建议

## 6.1 输入 token 估算

建议纳入：

- 系统 prompt
- 历史消息
- 用户输入
- 工具 schema
- 检索片段
- 文件转文本后的内容

## 6.2 输出 token 预测

不要拍脑袋写固定值。

建议建立 `usage_profiles` 统计维度：

```text
model
scenario
has_tools
has_files
has_search
```

并维护：

- `output_tokens_p50`
- `output_tokens_p80`
- `output_tokens_p95`

前端 quote 默认用：

- `p80` 做主展示
- `p95` 计算 `max_charge_credits`

## 6.3 价格计算

内部统一基准：

```text
1 credit = $0.0001
```

```text
raw_cost_usd =
  input_tokens * input_price_per_token
  + output_tokens * output_price_per_token
  + cache_read_tokens * cache_read_price_per_token
  + cache_write_tokens * cache_write_price_per_token
  + tool_calls * tool_flat_price
```

```text
cost_credits = ceil(raw_cost_usd / 0.0001)
charged_credits = ceil(cost_credits * markup_multiplier + platform_fee_credits)
```

## 7. API 草案

## 7.1 `GET /credits/me`

响应：

```json
{
  "success": true,
  "data": {
    "currency": "lobster_credit",
    "daily_free_balance": 86,
    "topup_balance": 5000,
    "total_available_balance": 5086,
    "daily_free_quota": 200,
    "daily_free_expires_at": "2026-03-21T00:00:00+08:00",
    "status": "active"
  }
}
```

## 7.2 `GET /credits/ledger`

响应：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cl_123",
        "bucket": "daily_free",
        "direction": "consume",
        "amount": -18,
        "balance_after": 86,
        "reference_type": "chat_run",
        "reference_id": "run_123",
        "created_at": "2026-03-18T10:00:00Z"
      },
      {
        "id": "cl_124",
        "bucket": "topup",
        "direction": "topup",
        "amount": 1000,
        "balance_after": 5000,
        "reference_type": "topup_order",
        "reference_id": "po_123",
        "created_at": "2026-03-18T09:00:00Z"
      }
    ]
  }
}
```

## 7.3 `POST /credits/quote`

请求：

```json
{
  "scenario": "chat",
  "model": "sonnet",
  "message": "用户当前输入",
  "history_messages": 12,
  "has_search": false,
  "has_tools": true,
  "attachments": [
    {
      "type": "pdf",
      "chars": 18000
    }
  ]
}
```

响应：

```json
{
  "success": true,
  "data": {
    "estimated_credits_low": 18,
    "estimated_credits_high": 42,
    "max_charge_credits": 60,
    "estimated_input_tokens": 3200,
    "estimated_output_tokens_p80": 900,
    "daily_free_cover_credits": 18,
    "topup_cover_credits": 24,
    "payable_credits": 0,
    "balance_after_estimate": 5044
  }
}
```

## 7.4 `POST /payments/orders`

用途：创建充值订单。

请求：

```json
{
  "provider": "wechat_qr",
  "package_id": "topup_1000",
  "return_url": "iclaw://payments/result"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "order_id": "po_123",
    "status": "pending",
    "provider": "wechat_qr",
    "credits": 1000,
    "bonus_credits": 100,
    "amount_cny_fen": 1000,
    "payment_url": "https://pay.example.com/checkout/po_123",
    "expires_at": "2026-03-20T20:15:00+08:00"
  }
}
```

## 7.5 `GET /payments/orders/:order_id`

用途：查询充值订单状态。

响应：

```json
{
  "success": true,
  "data": {
    "order_id": "po_123",
    "status": "paid",
    "provider": "wechat_qr",
    "credits": 1000,
    "bonus_credits": 100,
    "paid_at": "2026-03-20T20:03:00+08:00"
  }
}
```

## 7.6 `POST /payments/webhooks/:provider`

用途：接收支付平台回调，验签并完成充值入账。

要求：

- 必须验签
- 必须保证 `provider + event_id` 幂等
- 如果订单已经是 `paid/refunded`，需要返回幂等成功，不重复入账
- 设计上当前支持 `wechat_qr` 与 `alipay_qr`

## 7.7 `POST /usage/events`

请求：

```json
{
  "event_id": "ue_123",
  "grant_id": "rg_123",
  "quote_id": "q_123",
  "run_id": "run_123",
  "provider": "anthropic",
  "model": "claude-sonnet-4",
  "input_tokens": 1234,
  "output_tokens": 456,
  "cache_read_tokens": 0,
  "cache_write_tokens": 0,
  "tool_calls": 1
}
```

响应：

```json
{
  "success": true,
  "data": {
    "accepted": true,
    "charged_credits": 23,
    "debits": [
      {
        "bucket": "daily_free",
        "amount": 18
      },
      {
        "bucket": "topup",
        "amount": 5
      }
    ],
    "balance_after": {
      "daily_free_balance": 68,
      "topup_balance": 4995,
      "total_available_balance": 5063
    }
  }
}
```

## 8. 幂等与一致性

- `usage_quotes.quote_id` 唯一
- `credit_ledger.idempotency_key` 唯一
- `usage_events.event_id` 唯一
- `usage_charges.run_id` 唯一
- `payment_orders.id` 唯一
- `payment_webhook_events(provider, event_id)` 唯一
- 所有结算操作在一个数据库事务内完成

建议：

- quote 可以短期过期
- 支付回调与充值入账必须幂等
- 同一 run 重放时只能返回已存在结果，不能重复扣费

## 9. 定时任务

至少需要以下定时任务：

- 每日免费额度重置
- 试用包失效
- usage profile 统计更新

## 10. 前端接入建议

前端至少展示三类信息：

- 当前总可用余额
- 今日免费额度剩余
- 充值余额
- 本次请求预计消耗

建议交互：

- Header 胶囊显示总余额和今日免费
- 账户页单独展示“今日赠送 200”和“充值余额”
- 输入框旁显示 `约 x-y 龙虾币`
- 余额不足时直接弹充值引导，而不是等执行失败
- 响应完成后显示 `实际消耗 N`

## 11. Phase 1 落地范围

建议第一阶段只落以下能力：

- `credit_accounts`
- `credit_ledger`
- `payment_orders`
- `payment_webhook_events`
- `model_pricing`
- `usage_quotes`
- `usage_charges`
- `GET /credits/me`
- `GET /credits/ledger`
- `POST /credits/quote`
- `POST /payments/orders`
- `GET /payments/orders/:order_id`
- `POST /payments/webhooks/:provider`
- 在 `POST /usage/events` 中完成最终扣费
- 每日免费额度重置与懒校正
- 余额不足硬拦截

暂不实现：

- 发票与财务对账
- 企业账户
- 跨成员共享额度
- 订阅额度
- 长任务额度预留

## 12. Phase 2 落地范围

- `POST /credits/reserve`
- 长任务预留与释放
- 试用包失效策略
- 按模型/场景维护 usage profile
- 账单页与退款自动化
- 订阅额度

## 13. 充值闭环 Todo

### 13.1 后端与数据库

- 将 `credit_accounts` 从单一 `balance` 升级为 `daily_free_balance + topup_balance`
- 增加 `daily_free_granted_at`、`daily_free_expires_at`
- 增加 `payment_orders`
- 增加 `payment_webhook_events`
- 扩展 `credit_ledger`，支持 `bucket`、`direction`、`reference_type`、`idempotency_key`
- 在 `authorizeRun` 前做余额懒校正与余额不足拦截
- 在 `usage/events` 内按 bucket 拆分扣费，并禁止负余额
- 实现支付下单、订单查询、webhook 回调和充值入账事务

### 13.2 桌面前端

- 账户页展示今日赠送、充值余额、总可用余额
- 增加“充值”入口与档位选择
- 支付后轮询订单状态并刷新余额
- 低余额或余额不足时显示充值引导
- 在聊天输入区继续展示预估消耗

### 13.3 管理后台与运营

- 查看充值订单列表和订单状态
- 查看 webhook 原始回调和处理结果
- 支持人工补单
- 支持人工调账与备注

### 13.4 测试与风控

- 同一 webhook 重放不重复入账
- 支付成功但前端未跳回，后台仍到账
- 每日 00:00 重置幂等
- 扣费跨 bucket 拆分正确
- 余额不足时不会创建可执行的 run grant
- 退款后 `topup_balance` 与 ledger 正确回滚
