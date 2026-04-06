# P1 Chat Cases

## Case: 无历史会话时展示空态与首个动作入口

ID:
- `CHAT-E2E-004`

脚本:
- `tests/chat/conversation-empty-state.test.mjs`

目标:
- 验证全新用户或清空历史后，不会进入异常空白页

前置:
- 存在可清空或隔离的测试环境

步骤:
1. 清空历史会话
2. 打开 chat

断言:
- 出现清晰空态
- 可直接开始首轮对话

截图点:
- 空态页
