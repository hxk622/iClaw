# iClaw v0 API 契约草案

更新时间：2026-03-03

## 0. 目标

冻结 iClaw v0 所需最小接口：`health`、`auth`、`chat(stream)`、`upload`。

---

## 1. Health

### GET /health

用途：客户端启动后健康检查（sidecar 可用性）。

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

## 2. Auth（OpenAlpha 云端）

### POST /auth/register

请求：
```json
{
  "email": "user@example.com",
  "password": "******",
  "name": "User"
}
```

### POST /auth/login

请求：
```json
{
  "email": "user@example.com",
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

## 3. Chat Stream（OpenClaw sidecar）

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

## 4. Upload

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

## 5. 统一错误结构

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
