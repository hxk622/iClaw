# Native Agent Store Architecture

## Goal

`龙虾商店` 与 `智能投资专家` 安装的对象必须是 **OpenClaw native agent**，而不是仅靠 `system_prompt + skill` 伪装出来的专家模板。

目标体验：

- 用户在商店点击“安装”后，本地会在 `~/.openclaw/agents/<agentId>/...` 落地真实 agent。
- agent 有独立的：
  - `agentDir`
  - `sessions`
  - `auth-profiles`
  - `workspace`
  - `skills`
- 用户在同一个聊天窗口里切换 agent 时：
  - 不换窗口
  - 不丢当前对话上下文
  - 新 agent 能看到当前 conversation 的历史和 handoff 摘要
  - 但仍保留自己的长期记忆、权限和配置边界

## Problem Statement

当前实现中：

- `skill 商店` 安装的是真 skill
- `agent/专家 商店` 安装的本质上仍是 skill，再叠一层 `system_prompt`
- 这意味着产品层宣称是 “agent”，但运行时并没有 native agent 实体

结果：

- 安装语义不成立
- agent 没有独立长期记忆
- agent 没有独立 `sessions`
- agent 没有独立 `auth-profiles`
- agent 商店与 skill 商店底层边界不清

## Current Model

### Cloud truth

- `agent_catalog_entries` 保存商店里的 agent/expert 卡片
- `user_agent_library` 保存用户安装记录
- `metadata.skill_slugs` 定义该 agent 依赖的 skill
- `metadata.system_prompt` 定义该 agent 的专家 persona

### Desktop runtime

- 前端在 composer 里选中一个 agent
- 发送时把 `selectedAgentSystemPrompt` 注入当前请求
- OpenClaw 仍然运行在当前主 runtime session 中

### Result

这更像：

- `expert preset`
- `persona card`
- `skill bundle entry`

而不是：

- `native agent`

## Target Model

系统分成三层：

### 1. Skill

能力组件。负责：

- workflow
- 工具调用
- 外部数据能力
- 知识/模板

### 2. Native Agent

真正独立的执行者。负责：

- 身份
- 长期记忆
- session store
- auth profile
- workspace
- model/tool policy
- 依赖 skills

### 3. Conversation

用户看到的连续对话线程。负责：

- UI 上的同一聊天窗口
- 同一条 thread 的历史消息
- agent handoff 记录
- 当前 active agent

一个 conversation 可以经历多个 agent handoff。

## File-System Model

安装后的 native agent 建议落成：

```text
~/.openclaw/
  agents/
    nuwa-munger/
      agent/
        agent.json
        auth-profiles.json
      sessions/
        sessions.json
        *.jsonl
  workspace-nuwa-munger/
    AGENTS.md
    SOUL.md
    USER.md
    skills/
```

### agent.json responsibilities

- `id`
- `name`
- `workspace`
- `agentDir`
- `model`
- `tool policy`
- `default session routing`
- `catalog linkage metadata`

示意：

```json
{
  "id": "nuwa-munger",
  "name": "芒格",
  "workspace": "~/.openclaw/workspace-nuwa-munger",
  "agentDir": "~/.openclaw/agents/nuwa-munger/agent",
  "model": "anthropic/claude-sonnet-4-5",
  "skills": ["munger-skill"],
  "metadata": {
    "catalogSlug": "nuwa-munger",
    "surface": "lobster-store"
  }
}
```

## Install Flow

用户点击安装 agent 时，必须做两层同步：

### A. Cloud layer

- 写入 `user_agent_library`
- 保留商店安装状态
- 便于跨端、运营、推荐、恢复

### B. Local native-agent layer

- 创建 `~/.openclaw/agents/<agentId>/agent/`
- 创建 `~/.openclaw/agents/<agentId>/sessions/`
- 初始化 `agent.json`
- 初始化 `auth-profiles.json`（可为空）
- 准备 `workspace-<agentId>`
- 安装该 agent 依赖的 `skill_slugs`

### Install API responsibilities

未来 `installAgent` 不应只做：

- `installUserSkill(...)`
- `installUserAgent(...)`

还应做：

- `reconcileLocalNativeAgent(agentDefinition)`

## Uninstall Flow

卸载也应分层：

### Cloud layer

- 从 `user_agent_library` 中移除

### Local layer

- 标记本地 native agent 已卸载
- 默认保留 `sessions` 与 `workspace`
- 提供单独的“彻底删除本地记忆”危险动作

默认不应该在普通卸载时直接删除：

- 历史会话
- 本地工作区
- agent 私有记忆

## Conversation Model

### Product rule

用户在一个聊天窗口里切换 agent 时：

- conversation 不变
- active agent 变化
- thread 历史保留
- 新 agent 能理解为什么轮到自己

这不是“切到一个空白新会话”，也不是“继续在同一个主 agent 上伪装换 prompt”。

正确模型是：

- **thread context shared**
- **agent memory isolated**

### Shared context

共享给新 agent 的内容：

- 当前 conversation 历史消息
- 最近任务目标
- 为什么从 A 切到 B
- A 已经做过哪些尝试
- 用户对 A 的不满意点

### Isolated context

不共享的内容：

- A 的长期私有记忆
- A 的 `auth-profiles`
- A 的权限策略
- A 的 workspace 私有文件

## Session Strategy

### Window

- 同一个 UI 窗口

### Conversation

- 同一个 `conversationId`

### Runtime session

- 切到新的 native agent session key

建议使用 OpenClaw 原生 session key 形态：

- `agent:<agentId>:main`

例如：

- A: `agent:nuwa-jobs:main`
- B: `agent:nuwa-munger:main`

用户从 A 切到 B 时：

1. `conversationId` 保持不变
2. `activeAgentId` 从 A 改到 B
3. `activeSessionKey` 切到 `agent:nuwa-munger:main`
4. 写入一条 handoff record

## Handoff Model

每次 agent 切换时，系统应写：

- `fromAgentId`
- `toAgentId`
- `fromSessionKey`
- `toSessionKey`
- `reason`
- `summary`
- `createdAt`

### Handoff summary

建议自动生成一条内部 handoff 摘要，而不是让新 agent 直接从长 transcript 生啃：

- 用户当前目标
- 最近讨论到哪里
- 上一个 agent 的关键判断
- 用户切换的原因
- 新 agent 应接什么问题

这条摘要应作为当前 conversation 的系统内部上下文，而不是普通用户消息。

## Desktop UX

### Switching behavior

切换 agent 时：

- 不新开窗口
- 不清空消息列表
- 不要求用户重新喂上下文
- 显示轻量提示：
  - `已切换到 芒格，正在接手当前上下文`

### Reopen behavior

当用户重新打开某条 conversation：

- 恢复其 `activeAgentId`
- 恢复其 `activeSessionKey`
- 仍能查看历史 handoff 前的所有消息

## Why This Model

### Compared to prompt-only experts

优点：

- 安装语义真实
- agent 有长期记忆
- agent 有独立凭证/权限边界
- 可接入 OpenClaw native multi-agent routing
- 与 skill 商店形成真实分层

### Compared to fully isolated empty session switch

优点：

- 用户体验连续
- agent B 能理解为何接手
- 减少重复喂养上下文
- 保留 thread 视角的一致性

## Rollout Plan

### Phase 1

先打通本地 native agent 注册：

- install/uninstall/reconcile
- `~/.openclaw/agents/<agentId>` 落盘
- 依赖 skill 安装

### Phase 2

conversation 增加：

- `activeAgentId`
- `agentHandoffs`

### Phase 3

发送链路从：

- `prompt injection only`

切到：

- `native agent session selection + shared conversation handoff`

### Phase 4

补齐：

- auth profile
- tool policy
- per-agent workspace bootstrap
- uninstall cleanup policy

## Non-Goals

- 不要求一开始就把所有 prompt-based experts 全量迁移
- 不要求第一版就做复杂 agent-to-agent 并行协作
- 不要求切 agent 时切换到空白新 conversation

## Decision

后续产品口径冻结为：

- `skill 商店` 安装 skill
- `agent/专家 商店` 安装 native agent
- 同一对话窗口允许 agent handoff
- 当前对话上下文共享，长期记忆按 agent 隔离
