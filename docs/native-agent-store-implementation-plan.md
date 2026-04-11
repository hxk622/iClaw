# Native Agent Store Implementation Plan

## Scope

把 `龙虾商店 / 智能投资专家` 从 prompt-based expert preset 升级为 OpenClaw native agent 安装链路。

## Phase 1: Local Native Agent Reconciler

### Goal

安装/卸载商店 agent 时，同步本地：

- `~/.openclaw/agents/<agentId>/agent/`
- `~/.openclaw/agents/<agentId>/sessions/`
- `~/.openclaw/workspace-<agentId>/`

### Deliverables

- desktop local reconciler service
- install reconcile
- uninstall reconcile
- doctor/reconcile command

### Suggested modules

- `apps/desktop/src/app/lib/native-agent-registry.ts`
- `apps/desktop/src/app/lib/native-agent-reconciler.ts`
- `apps/desktop/src/app/lib/native-agent-paths.ts`
- `apps/desktop/src/app/lib/native-agent-manifest.ts`

### Suggested data sources

- control-plane `agent_catalog_entries`
- control-plane `user_agent_library`
- agent metadata:
  - `skill_slugs`
  - `system_prompt`
  - `surface`
  - `model/tool policy` (future)

## Phase 2: Conversation Active-Agent Model

### Goal

在现有 conversation 模型上增加 native agent handoff 语义。

### Deliverables

- `conversation.activeAgentId`
- `conversation.handoffs[].fromAgentId`
- `conversation.handoffs[].toAgentId`
- `conversation.handoffs[].summary`

### Affected modules

- `apps/desktop/src/app/lib/chat-conversations.ts`
- `apps/desktop/src/app/lib/chat-conversation-ordering.ts`
- `apps/desktop/src/app/components/OpenClawChatSurface.tsx`
- `apps/desktop/src/app/components/RichChatComposer.tsx`

## Phase 3: Send Path Switch to Native Agent Sessions

### Goal

发送链路不再只做 `selectedAgentSystemPrompt` 注入，而是切换到 agent-scoped runtime session。

### Desired behavior

- 同一 conversation
- 不同 `activeAgentId`
- 不同 `activeSessionKey`
- 当前 thread 上下文共享
- agent 私有长期记忆隔离

### Session-key strategy

使用：

- `agent:<agentId>:main`

可选扩展：

- `agent:<agentId>:conversation:<conversationId>`

是否需要 per-conversation session key，要根据 OpenClaw runtime 对 session 生命周期的约束再决定。

## Phase 4: Handoff Summary Injection

### Goal

切换 agent 时自动生成 handoff note，减少新 agent 生啃长 transcript 的成本。

### Minimum summary fields

- current objective
- recent user dissatisfaction
- previous agent conclusion
- unresolved question
- why this new agent is being selected

## Phase 5: Auth / Tool / Workspace Policy

### Goal

把 native agent 的隔离真正做全。

### Deliverables

- per-agent `auth-profiles.json`
- per-agent tool allowlist
- per-agent model selection
- workspace bootstrap templates

## Phase 6: Uninstall / Cleanup Policy

### Default behavior

- uninstall removes availability
- local sessions/workspace retained

### Explicit destructive option

- `remove local memory`
- `remove local workspace`
- `remove auth profiles`

## Control-Plane Follow-up

需要把 catalog agent 与 native agent 落地语义对齐：

- `agent_catalog_entries` 增加 native agent template fields
- admin API 返回 native-agent install metadata
- future: backend expose install manifest instead of raw free-form metadata

## Testing

### Critical tests

1. Install agent creates native directories
2. Uninstall agent does not silently delete history
3. Same conversation handoff A -> B preserves visible thread
4. B receives handoff summary
5. B does not inherit A private auth/workspace state
6. Reopen conversation restores active native agent

## Non-Goals For First Rollout

- Full agent-to-agent parallel orchestration
- Cross-device native session migration
- Automatic auth-profile cloning between agents
