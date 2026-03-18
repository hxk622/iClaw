# iClaw Credit 技术设计草案

更新时间：2026-03-18

## 1. 目标

为 iClaw control plane 提供一套可审计、可幂等、可扩展的 credit 账务体系，支持：

- 免费额度
- 订阅赠送额度
- 充值额度
- 任务预估
- 额度预留
- 执行后结算
- 退款/释放
- 成本与毛利回溯

## 2. 设计原则

- PostgreSQL 为唯一权威账本
- 本地 sidecar 不作为最终计费依据
- 所有扣费操作必须幂等
- 余额字段只是读优化，账本才是权威事实
- 预估与实扣分离

## 3. 核心数据模型

## 3.1 `credit_accounts`

用途：用户当前余额快照。

建议字段：

```text
id
user_id
daily_free_balance
subscription_balance
topup_balance
reserved_balance
status
created_at
updated_at
```

说明：

- `reserved_balance` 表示已预留但尚未最终消耗的额度
- 页面显示的“可用余额”应排除已预留额度的重复计算

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
  - `subscription`
  - `topup`
  - `reserved`
- `direction`
  - `grant`
  - `consume`
  - `refund`
  - `expire`
  - `reserve`
  - `release`
- `reference_type`
  - `daily_reset`
  - `trial_grant`
  - `subscription_grant`
  - `topup_order`
  - `usage_quote`
  - `chat_run`
  - `agent_run`
  - `manual_adjustment`

## 3.3 `model_pricing`

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

## 3.4 `usage_quotes`

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

## 3.5 `usage_charges`

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

## 5. 额度扣减顺序

统一顺序：

1. `daily_free_balance`
2. `subscription_balance`
3. `topup_balance`

理由：

- 先消耗会过期的额度
- 提升用户体验
- 减少充值额度被优先消耗导致的心理损失

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
    "subscription_balance": 1200,
    "topup_balance": 5000,
    "reserved_balance": 120,
    "total_available_balance": 6286,
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
    "quote_id": "q_123",
    "estimated_credits_low": 18,
    "estimated_credits_high": 42,
    "max_charge_credits": 60,
    "estimated_input_tokens": 3200,
    "estimated_output_tokens_p80": 900,
    "free_cover_credits": 18,
    "payable_credits": 0,
    "balance_after_estimate": 6268,
    "expires_at": "2026-03-18T12:00:00Z"
  }
}
```

## 7.4 `POST /credits/reserve`

用途：长任务前预留额度。

请求：

```json
{
  "quote_id": "q_123",
  "amount": 60
}
```

响应：

```json
{
  "success": true,
  "data": {
    "reservation_id": "r_123",
    "reserved_amount": 60
  }
}
```

## 7.5 `POST /usage/events`

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
    "balance_after": 6263
  }
}
```

## 8. 幂等与一致性

- `usage_quotes.quote_id` 唯一
- `credit_ledger.idempotency_key` 唯一
- `usage_events.event_id` 唯一
- `usage_charges.run_id` 唯一
- 所有结算操作在一个数据库事务内完成

建议：

- quote 可以短期过期
- reserve / charge / release 必须幂等
- 同一 run 重放时只能返回已存在结果，不能重复扣费

## 9. 定时任务

至少需要以下定时任务：

- 每日免费额度重置
- 试用包失效
- 订阅赠送额度失效
- 未完成预留额度释放
- usage profile 统计更新

## 10. 前端接入建议

前端至少展示三类信息：

- 当前总可用余额
- 今日免费额度剩余
- 本次请求预计消耗

建议交互：

- Header 胶囊显示总余额和今日免费
- 输入框旁显示 `约 x-y 龙虾币`
- 长任务弹窗显示 `预计 <= N，本次最多预留 N`
- 响应完成后显示 `实际消耗 N`

## 11. Phase 1 落地范围

建议第一阶段只落以下能力：

- `credit_accounts`
- `credit_ledger`
- `model_pricing`
- `usage_quotes`
- `usage_charges`
- `GET /credits/me`
- `GET /credits/ledger`
- `POST /credits/quote`
- 在 `POST /usage/events` 中完成最终扣费

暂不实现：

- 独立充值系统
- 发票与财务对账
- 企业账户
- 跨成员共享额度

## 12. Phase 2 落地范围

- `POST /credits/reserve`
- 长任务预留与释放
- 试用包/订阅包失效策略
- 按模型/场景维护 usage profile
- 充值与账单页
