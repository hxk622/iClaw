# Extension Session Contracts V1

## 目标

把 iClaw 浏览器插件自动登录方案从原则层落成可实现的对象模型与接口契约。

本文件只覆盖：

- 插件授权关系（grant）
- 插件 session / token
- 桌面授权桥接口
- control-plane 接口
- 状态机与错误码

不覆盖：

- 浏览器插件 UI
- 知识库 Raw/Graph/Output 业务对象
- 图谱编译逻辑

## 1. 核心原则

1. 桌面端主 token 不下发给插件
2. 插件使用单独的 extension session
3. 用户态以桌面授权桥为唯一正式登录路径
4. 首次授权弹一次，后续记住授权关系
5. 自测态允许浏览器单独登录，但不影响正式用户路径

## 2. 对象模型

## 2.1 ExtensionGrant

表示“桌面用户允许某个插件在当前设备上代表自己工作”的授权关系。

### 字段

- `id: string`
- `user_id: string`
- `brand_id: string`
- `extension_id: string`
- `device_id: string`
- `browser_family: string | null`
- `browser_profile_id: string | null`
- `scope: string[]`
- `status: 'active' | 'revoked'`
- `granted_at: string`
- `last_used_at: string | null`
- `revoked_at: string | null`
- `metadata: Record<string, unknown> | null`

### 说明

- `extension_id`：唯一标识插件实例/品牌插件
- `device_id`：唯一标识当前桌面设备
- `browser_profile_id`：可选，用于区分同一设备上的不同浏览器 profile
- `scope`：插件可用权限范围

## 2.2 ExtensionSession

表示发给插件使用的短期认证凭证。

### 字段

- `access_token: string`
- `refresh_token: string`
- `expires_in: number`
- `refresh_expires_in: number`
- `token_type: 'Bearer'`
- `scope: string[]`
- `audience: 'extension'`
- `grant_id: string`
- `user: { id: string; name?: string; email?: string }`

### 建议默认值

- `access_token`: 15 ~ 30 分钟
- `refresh_token`: 1 ~ 7 天

## 2.3 ExtensionBridgeRequest

插件请求桌面桥签发 session 时使用的输入。

### 字段

- `extension_id: string`
- `brand_id: string`
- `device_id: string`
- `browser_family: string`
- `browser_profile_id?: string`
- `requested_scope: string[]`
- `challenge: string`
- `nonce: string`
- `version: string`

## 3. scope 建议

V1 插件不应拿到高危后台权限。

### 建议 scope

- `knowledge.raw.read`
- `knowledge.raw.write`
- `knowledge.output.read`
- `profile.basic.read`

### 不应给出的 scope

- 管理后台权限
- 支付/充值权限
- 高危 OEM 管理权限
- 运行时管理权限

## 4. 桌面授权桥接口

本地桥建议监听：

- `http://127.0.0.1:1537`

仅供本机访问。

## 4.1 POST /v1/extension/session

### 用途

插件向桌面端申请 extension session。

### 请求体

```json
{
  "extension_id": "iclaw-browser-extension",
  "brand_id": "iclaw",
  "device_id": "device_xxx",
  "browser_family": "chrome",
  "browser_profile_id": "profile_default",
  "requested_scope": [
    "knowledge.raw.read",
    "knowledge.raw.write",
    "profile.basic.read"
  ],
  "challenge": "random_challenge",
  "nonce": "random_nonce",
  "version": "1.0.0"
}
```

### 成功响应

```json
{
  "ok": true,
  "grant_required": false,
  "session": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_in": 1800,
    "refresh_expires_in": 604800,
    "token_type": "Bearer",
    "scope": ["knowledge.raw.read", "knowledge.raw.write", "profile.basic.read"],
    "audience": "extension",
    "grant_id": "grant_xxx",
    "user": {
      "id": "user_xxx",
      "name": "Kevin Han",
      "email": "515177265@qq.com"
    }
  }
}
```

### 首次授权响应

```json
{
  "ok": false,
  "grant_required": true,
  "error": "GRANT_CONFIRMATION_REQUIRED"
}
```

### 典型错误

- `DESKTOP_APP_NOT_READY`
- `DESKTOP_NOT_LOGGED_IN`
- `GRANT_CONFIRMATION_REQUIRED`
- `GRANT_REVOKED`
- `INVALID_REQUEST`
- `UNSUPPORTED_SCOPE`
- `INTERNAL_ERROR`

## 4.2 POST /v1/extension/grant/confirm

### 用途

桌面端在用户点击确认后，完成授权并签发 session。

### 请求体

```json
{
  "extension_id": "iclaw-browser-extension",
  "brand_id": "iclaw",
  "device_id": "device_xxx",
  "browser_family": "chrome",
  "browser_profile_id": "profile_default",
  "requested_scope": ["knowledge.raw.read", "knowledge.raw.write", "profile.basic.read"],
  "challenge": "random_challenge",
  "nonce": "random_nonce"
}
```

### 响应

与 `/v1/extension/session` 成功响应相同。

## 4.3 POST /v1/extension/grant/revoke

### 用途

撤销某个插件授权关系。

### 请求体

```json
{
  "grant_id": "grant_xxx"
}
```

### 响应

```json
{
  "ok": true
}
```

## 4.4 GET /v1/extension/grants

### 用途

桌面端设置页查看当前已授权插件。

### 响应

```json
{
  "ok": true,
  "items": [
    {
      "id": "grant_xxx",
      "extension_id": "iclaw-browser-extension",
      "device_id": "device_xxx",
      "scope": ["knowledge.raw.read", "knowledge.raw.write"],
      "status": "active",
      "granted_at": "2026-04-18T12:00:00.000Z",
      "last_used_at": "2026-04-18T13:00:00.000Z"
    }
  ]
}
```

## 5. control-plane 接口

## 5.1 POST /auth/extension/device-grant

### 用途

桌面端用主登录态向 control-plane 申请插件专用 session。

### 请求头

- `Authorization: Bearer <desktop_access_token>`

### 请求体

```json
{
  "extension_id": "iclaw-browser-extension",
  "brand_id": "iclaw",
  "device_id": "device_xxx",
  "browser_family": "chrome",
  "browser_profile_id": "profile_default",
  "requested_scope": [
    "knowledge.raw.read",
    "knowledge.raw.write",
    "profile.basic.read"
  ]
}
```

### 响应

返回 `ExtensionSession`。

## 5.2 POST /auth/extension/refresh

### 用途

插件使用自己的 refresh token 刷新 extension session。

### 请求体

```json
{
  "refresh_token": "..."
}
```

### 响应

返回新的 `ExtensionSession`。

## 5.3 GET /auth/me

### 用途

插件拿到 access token 后获取当前用户基本信息。

## 6. 授权状态机

## 6.1 用户态

### 状态

- `bridge_unavailable`
- `desktop_not_logged_in`
- `grant_missing`
- `grant_pending_confirmation`
- `grant_active`
- `session_active`
- `session_expired`
- `grant_revoked`

### 流程

1. 插件启动
2. 请求 `/v1/extension/session`
3. 若已有 active grant -> 返回 session
4. 若无 grant -> 桌面弹确认
5. 用户确认 -> `/v1/extension/grant/confirm`
6. 返回 session
7. 后续通过 refresh 自动续期

## 6.2 自测态

### 状态

- `browser_login_missing`
- `browser_login_active`

### 流程

1. 插件走浏览器登录页
2. 获取浏览器态会话
3. 继续插件链路验证

## 7. 重复弹框策略

### 默认行为

- 首次授权弹一次
- 后续不再弹

### 重新弹框条件

- 用户换账号
- extension id 变化
- 本地 grant 丢失
- scope 提升
- grant 被撤销
- 风险策略要求重新确认

## 8. 桌面端最小实现建议

V1 桌面端最少需要支持：

1. 启动本地 loopback bridge
2. 读取当前桌面登录态
3. 维护本地 `extension_grants`
4. 首次弹窗确认
5. 调 control-plane 签发 extension session
6. 返回 session 给插件

## 9. 插件最小实现建议

V1 插件最少需要支持：

1. 检测桌面桥可达性
2. 请求 extension session
3. 本地保存 extension session
4. 用 refresh token 自动续期
5. grant 缺失时提示“请打开桌面端并确认授权”

## 10. 最终结论

如果只看一句实现级结论：

> iClaw 插件自动登录的核心，不是共享桌面 token，而是“桌面端记住授权关系，并持续签发插件专用 session”。
