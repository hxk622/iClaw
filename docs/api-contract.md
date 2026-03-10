# iClaw v0 API 契约草案

更新时间：2026-03-03

## 0. 目标

冻结 iClaw 下一阶段所需最小接口：云端 `auth` / `credits` / `run authorize`，以及本地 sidecar `health` / `chat(stream)` / `upload`。

---

## 1. Local Health

### GET /health

用途：客户端启动后健康检查（本地 sidecar 可用性）。

响应（200）：
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "openclaw",
    "version": "x.y.z"
  }
}
```

失败：返回统一错误结构。

---

## 2. Auth（iClaw Cloud Control Plane）

### POST /auth/register

请求：
```json
{
  "username": "alice",
  "email": "user@example.com",
  "password": "******",
  "name": "User"
}
```

### POST /auth/login

请求：
```json
{
  "identifier": "alice",
  "password": "******"
}
```

成功响应（register/login 一致）：
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "u_xxx",
      "username": "alice",
      "email": "user@example.com",
      "name": "User"
    },
    "tokens": {
      "access_token": "...",
      "refresh_token": "...",
      "expires_in": 3600
    }
  }
}
```

### POST /auth/refresh

请求：
```json
{
  "refresh_token": "..."
}
```

响应：新的 `access_token`（必要时轮换 refresh_token）。

### GET /auth/me

请求头：`Authorization: Bearer <access_token>`

响应：当前用户信息。

---

## 3. Credits（iClaw Cloud Control Plane）

### GET /credits/me

用途：读取当前用户 credit 余额与账户状态。

响应（200）：
```json
{
  "success": true,
  "data": {
    "balance": 125000,
    "currency": "credit",
    "status": "active"
  }
}
```

### GET /credits/ledger

用途：读取 credit 账本明细。

响应（200）：
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cl_123",
        "event_type": "usage_debit",
        "delta": -120,
        "balance_after": 124880,
        "created_at": "2026-03-09T12:00:00Z"
      }
    ]
  }
}
```

---

## 4. Run Authorize（iClaw Cloud Control Plane）

### POST /agent/run/authorize

用途：在本地 sidecar 执行前，由云端签发一次短期 run grant。

请求：
```json
{
  "session_key": "main",
  "client": "desktop",
  "estimated_input_tokens": 1200
}
```

响应（200）：
```json
{
  "success": true,
  "data": {
    "grant_id": "rg_123",
    "nonce": "n_123",
    "expires_at": "2026-03-09T12:05:00Z",
    "max_input_tokens": 4000,
    "max_output_tokens": 8000,
    "credit_limit": 300,
    "signature": "base64_or_jws"
  }
}
```

---

## 5. Usage Events（iClaw Cloud Control Plane）

### POST /usage/events

用途：sidecar 执行完成后回传 usage，用于幂等结算和记账。

请求：
```json
{
  "event_id": "ue_123",
  "grant_id": "rg_123",
  "input_tokens": 123,
  "output_tokens": 456,
  "credit_cost": 78,
  "provider": "openai",
  "model": "gpt-5"
}
```

响应（200）：
```json
{
  "success": true,
  "data": {
    "accepted": true,
    "balance_after": 124802
  }
}
```

---

## 6. Chat Stream（OpenClaw sidecar）

### POST /agent/stream

请求头：
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

请求：
```json
{
  "taskId": "optional_task_id",
  "message": "用户输入内容",
  "attachments": []
}
```

响应：`text/event-stream`

SSE 事件定义：
- `event: start`
- `event: delta`
- `event: end`
- `event: error`

示例：
```text
event: start
data: {"requestId":"r_123","taskId":"t_123"}

event: delta
data: {"requestId":"r_123","text":"你好"}

event: delta
data: {"requestId":"r_123","text":"，我是 iClaw"}

event: end
data: {"requestId":"r_123","usage":{"input":123,"output":45}}
```

错误事件：
```text
event: error
data: {"requestId":"r_123","code":"RATE_LIMIT","message":"Too many requests"}
```

约束：
- `end` 必须出现且带 `requestId`。
- 任意失败必须发送 `error` 事件或标准 HTTP 错误。

---

请求体建议附带 `run_grant` 或 `grant_id`，用于把本地执行与云端授权关联起来。

---

## 7. Upload

### POST /files/upload

用途：上传附件供对话使用。

请求：`multipart/form-data`
- `file`: 二进制文件
- `taskId`（可选）

响应（200）：
```json
{
  "success": true,
  "data": {
    "fileId": "f_xxx",
    "name": "report.pdf",
    "size": 123456,
    "mime": "application/pdf",
    "url": "..."
  }
}
```

---

## 8. 统一错误结构

HTTP 错误响应：
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token expired",
    "requestId": "r_xxx"
  }
}
```

错误码最小集合：
- `UNAUTHORIZED`
- `FORBIDDEN`
- `RATE_LIMIT`
- `BAD_REQUEST`
- `INTERNAL_ERROR`
- `SERVICE_UNAVAILABLE`
- `NETWORK_ERROR`（客户端本地映射）
