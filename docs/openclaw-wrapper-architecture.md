# OpenClaw Wrapper Architecture

更新时间：2026-03-15

## 目标

在 `iClaw` 中复用 OpenClaw `control-ui` 作为 chat kernel，同时保留我们在 `3.8` 阶段验证过的工程化实践。

核心原则：

- `control-ui` 负责 chat 内核：会话、发送、流式渲染、消息分组、工具卡片、滚动、slash command、gateway 事件处理。
- `iClaw` 只提供 wrapper shell：认证桥接、状态观测、品牌主题、空态/错误兜底、诊断埋点。
- 对扩展开放，对修改关闭。优先组合、包裹、注入，不直接修改 OpenClaw chat JS 主逻辑。

## 3.8 的有效经验

`3.8` 阶段真正有效的部分，不是“自定义 chat UI”本身，而是以下工程实践：

1. 用户消息先本地回显。
2. 对上游消息 shape 做防御性归一化。
3. 把服务状态、错误状态明确展示给用户。
4. 空态和输入区稳定，不允许“纯白板”。
5. 认证和发送链路由同一层壳 orchestrate，避免前端局部状态分叉。

对应旧实现可以参考：

- [App.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/App.tsx)
  旧版本在 `224aa36^` 中的 `sendMessage` / `syncChatHistory` / auth bootstrap
- [controller.ts](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/chat-core/controller.ts)
  旧版本在 `224aa36^` 中的本地回显与流式兜底
- [message-extract.ts](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/chat-core/message-extract.ts)
  旧版本在 `224aa36^` 中的消息归一化

## 3.8 为什么没那么容易出现“双登录态撕裂”

`3.8` 不是严格意义上的“所有 auth 已统一”，但它的 chat 主链路确实更集中：

- 登录态由 app shell 统一 bootstrap：
  - `readAuth()`
  - `client.me()`
  - `client.refresh()`
- chat send/history 也走同一个 `IClawClient`
- `sendMessage()` 里先检查 `isAuthenticated && accessToken`
- 未登录时直接打开登录框，而不是让 chat 内核自行决定

也就是说，`3.8` 的一致性来自：

- 同一个 app shell 同时控制：
  - control-plane 登录态
  - chat send/history 入口
  - UI 空态/错误态

而不是来自“OpenClaw 内核本身已经和 iClaw 登录体系统一”。

## 3.13 后的新问题

引入 `openclaw-app` 之后，chat 内核迁回 OpenClaw `control-ui`，于是出现了两层状态：

1. iClaw shell 状态

- `2130` control-plane 登录
- `iclaw:auth.access_token` / `refresh_token`
- 左下角用户资料、账户面板、credit 等

2. OpenClaw chat 内核状态

- `2126` gateway 连接
- gateway token/password
- `openclaw.control.settings.v1`
- `openclaw.device.auth.v1`
- `openclaw-device-identity-v1`
- `openclaw-app.connected / lastError / lastErrorCode`

因此当前的白板问题，必须拆成两类排查：

- A. iClaw shell 未认证或错误渲染
- B. `openclaw-app` 已挂载，但 gateway/device auth/theme/visibility 出问题

## Wrapper 的职责边界

### 允许在 wrapper 做的事情

1. 认证桥接

- 统一定义 `AuthState`：
  - `shellAuthenticated`
  - `gatewayConfigured`
  - `gatewayConnected`
  - `gatewayLastError`
- 把 control-plane 登录态和 gateway 连接态并排展示
- 在 chat 区提供明确兜底文案，禁止出现无解释白板

2. Gateway 凭据桥接

- 由 wrapper 明确向 `openclaw-app` 注入：
  - `gatewayUrl`
  - `token`
  - `password`
  - `sessionKey`
- 在 dev/desktop/web 三种运行态下，统一 gateway 凭据来源的优先级和日志

3. 浏览器状态治理

- 限定在 localhost/loopback 环境下，清理已知会污染嵌入 chat 的 OpenClaw 持久化状态
- 对 `openclaw-app` 的 `connected / lastError / lastErrorCode` 做观测和埋点

4. 品牌和主题封装

- CSS 变量映射
- 头像、logo、留白、外层 header/shell
- light/dark 主题同步
- 原生空态上方或外围的品牌化信息

5. 失败兜底

- 若 `openclaw-app` 未连接，显示明确状态卡，不允许白屏
- 若 shell 未登录，显示明确登录态，不允许白屏
- 若 gateway 已连上但渲染不可见，记录诊断信息并给出可操作提示

6. 调试能力

- 保留 CDP 诊断脚本
- 在 wrapper 层暴露最小必要调试观测值

### 禁止在 wrapper 做的事情

1. 不直接读写 OpenClaw 内部 chat state：

- `chatMessages`
- `chatStream`
- `chatToolMessages`
- `chatRunId`
- `chatThinkingLevel`

2. 不自己接管：

- 发送按钮逻辑
- 停止逻辑
- 历史消息回填
- 分组渲染
- 滚动调度
- 工具卡片渲染
- slash command

3. 不复制一套自定义 chat kernel

- 不重新实现 `send/history/stream/event merge`
- 不再恢复 `3.8` 那套 ChatWorkspace 作为主 chat 路径

## 推荐的 wrapper 分层

### 1. Auth Bridge

负责：

- shell 登录态 bootstrap
- token refresh
- 当前用户信息
- control-plane / gateway 双状态统一输出

建议输出：

```ts
type ChatShellAuthState = {
  shellAuthenticated: boolean;
  shellUser: AuthUser | null;
  gatewayConfigured: boolean;
  gatewayConnected: boolean;
  gatewayLastError: string | null;
  gatewayLastErrorCode: string | null;
};
```

### 2. Gateway Bridge

负责：

- 统一 gateway url / token / password 来源
- dev/web/tauri 的差异收口
- localhost 持久化状态清理

### 3. Theme Bridge

负责：

- `iClaw` 主题状态 → OpenClaw CSS 变量
- light/dark 同步
- 品牌头像/图标/外层容器注入

### 4. State Overlay

负责：

- loading / disconnected / auth required / gateway failed / diagnostic hint
- 明确兜底，不允许纯白板

### 5. Diagnostics

负责：

- CDP 检查脚本
- 页面状态快照
- `openclaw-app` 观测值导出

## 当前代码的落位建议

### 应保留

- [OpenClawChatSurface.tsx](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/OpenClawChatSurface.tsx)
  作为 wrapper 入口
- [openclaw-chat-surface.css](/Users/xingkaihan/Documents/Code/iClaw/apps/desktop/src/app/components/openclaw-chat-surface.css)
  作为主题/品牌覆盖层
- [.tmp-tests/cdp-console-debug.mjs](/Users/xingkaihan/Documents/Code/iClaw/.tmp-tests/cdp-console-debug.mjs)
  作为诊断资产

### 应继续收敛

- `App.tsx` 中与 chat 相关的 shell/gateway 状态，逐步抽到 bridge hooks
- 把“左下角登录态”和“gateway 连接态”显式并列，而不是混在一个 `authenticated`

### 不应恢复

- `3.8` 的 `ChatWorkspace`
- `ChatArea`
- `InputBar`
- `chat-core/controller.ts`

这些代码可以作为经验参考，但不应再成为主实现。

## 执行原则

未来每次升级 OpenClaw 时，按下面顺序：

1. 先验证原生 `control-ui` 在容器内可工作。
2. 再验证 wrapper 的 auth bridge / theme bridge / diagnostics。
3. 只在 wrapper 层修复兼容问题。
4. 若必须改上游 JS，先证明无法通过 wrapper 层解决，再最小化修改并记录原因。
