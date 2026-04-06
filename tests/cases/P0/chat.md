# P0 Chat Cases

## Case: 新建对话后可切回已有对话

ID:
- `CHAT-E2E-001`

脚本:
- `tests/chat/new-chat-create-and-switch.test.mjs`

目标:
- 验证用户创建新对话后，仍可从最近对话切回原会话

前置:
- `desktop web shell` 运行在 `http://127.0.0.1:1520`
- `control-plane` 运行在 `http://127.0.0.1:2130`
- Chrome CDP 已开启
- 存在可登录测试账号

步骤:
1. 登录并进入 chat
2. 发送一条消息，生成可切回的原会话
3. 点击 `新建对话`
4. 从最近对话切回原会话

断言:
- 新建对话后 active surface 变化
- 切回后原消息仍可见
- 最近对话入口可用

截图点:
- 原会话
- 新会话
- 切回后的原会话

## Case: 刷新页面后恢复上次活跃会话

ID:
- `CHAT-E2E-002`

脚本:
- `tests/chat/persisted-session-restore.test.mjs`

目标:
- 验证页面刷新后恢复到上次活跃对话，而不是丢到空白新会话

前置:
- 同上

步骤:
1. 登录并进入 chat
2. 发送一条消息
3. 刷新页面
4. 等待 chat surface 恢复

断言:
- 刷新前后 active session key 一致
- 已发送的消息仍可见

截图点:
- 刷新前
- 刷新后

## Case: 聊天发送最小 happy path

ID:
- `CHAT-E2E-003`

脚本:
- `tests/chat/send-smoke.test.mjs`

目标:
- 验证输入、发送、消息渲染的最小主链路正常

前置:
- 同上

步骤:
1. 登录并进入 chat
2. 输入一条新消息
3. 点击发送

断言:
- 输入后发送按钮可用
- 发送后用户消息出现在消息列表

截图点:
- 发送后聊天界面
