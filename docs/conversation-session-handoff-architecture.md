# Conversation Session Handoff Architecture

## Goal

Desktop chat must stop treating a single OpenClaw `sessionKey` as the long-lived user-visible conversation.

The correct product model is:

- `task` = task center entry shown to the user
- `conversation` = user-visible continuous chat
- `runtime session` = OpenClaw execution thread, can rotate over time

One conversation may span multiple runtime sessions through handoff.

## Design Principles

- User-facing continuity is owned by `conversation`, not by `sessionKey`.
- Runtime sessions are disposable execution carriers.
- Session rotation must not create a new window or visually reset the chat thread.
- Task center opens a conversation aggregate view, not an individual runtime session.
- System / cron / debug traffic must never share the same conversation as user chat.

## Data Model

### Task

- `task.id`
- `task.conversation_id`
- `task.latest_session_key`
- `task.title`
- `task.prompt`
- `task.status`

### Conversation

- `conversation.id`
- `conversation.kind`
- `conversation.title`
- `conversation.active_session_key`
- `conversation.created_at`
- `conversation.updated_at`

### Conversation Session Link

- `conversation_id`
- `session_key`
- `is_active`
- `joined_at`
- `left_at`
- `join_reason`

### Conversation Handoff

- `conversation_id`
- `from_session_key`
- `to_session_key`
- `reason`
- `summary`
- `created_at`

## Runtime Behavior

### Normal

- User enters a chat view.
- UI binds to one `conversationId`.
- Conversation points to one active runtime session.

### Pressure / Handoff

When session pressure exceeds threshold:

1. Keep the current `conversationId`.
2. Create successor runtime session.
3. Write a handoff record from old session to new session.
4. Switch `conversation.active_session_key` to the new session.
5. UI continues rendering the same conversation thread.

## UI Rules

- Chat window remains the same.
- Sidebar task item remains the same.
- Task center entry remains the same.
- Historical messages must be rendered as one continuous thread for the conversation.
- Session boundaries are internal implementation detail unless explicitly exposed for debugging.

## Current Local Rollout

The desktop local layer now includes:

- local `conversation registry`
- task grouping by `conversationId` instead of raw `sessionKey`
- general chat session rotation that preserves `conversationId`
- task-center reopen logic that resolves the conversation's active runtime session
- local chat snapshot continuity keyed by `conversationId`, so handoff does not visually drop prior messages

This is still local-first. Control-plane persistence is the next stage.

## Control-Plane Follow-up

Next server-side steps:

1. Add `chat_conversations`
2. Add `chat_conversation_sessions`
3. Add `chat_conversation_handoffs`
4. Persist task-to-conversation relationship in backend APIs
5. Expose conversation aggregate history instead of only per-session history

## Non-Goals

- Do not expose session handoff mechanics to normal end users.
- Do not keep `main` as a permanent chat bucket.
- Do not let OEM wrapper logic depend on a single immutable session forever.
