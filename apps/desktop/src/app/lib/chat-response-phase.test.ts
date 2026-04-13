import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveChatResponsePhase, hasVisibleAssistantResponseForRun } from './chat-response-phase.ts';

const RUN_ID = 'run-123';
const STARTED_AT = 1_700_000_000_000;

test('hasVisibleAssistantResponseForRun returns false before any assistant content appears', () => {
  const messages = [
    {
      role: 'user',
      timestamp: STARTED_AT,
      content: [{ type: 'text', text: 'hello' }],
      __iclawBillingRunId: RUN_ID,
    },
  ];

  assert.equal(hasVisibleAssistantResponseForRun(messages, RUN_ID, STARTED_AT), false);
});

test('hasVisibleAssistantResponseForRun returns true once the active run has assistant text', () => {
  const messages = [
    {
      role: 'user',
      timestamp: STARTED_AT,
      content: [{ type: 'text', text: 'hello' }],
      __iclawBillingRunId: RUN_ID,
    },
    {
      role: 'assistant',
      timestamp: STARTED_AT + 1_000,
      content: [{ type: 'text', text: '你好！有什么我可以帮你的吗？' }],
      __iclawBillingRunId: RUN_ID,
    },
  ];

  assert.equal(hasVisibleAssistantResponseForRun(messages, RUN_ID, STARTED_AT), true);
});

test('deriveChatResponsePhase distinguishes waiting for first visible assistant output from generic busy', () => {
  const baseMessages = [
    {
      role: 'user',
      timestamp: STARTED_AT,
      content: [{ type: 'text', text: 'hello' }],
      __iclawBillingRunId: RUN_ID,
    },
  ];

  assert.equal(
    deriveChatResponsePhase({
      busy: true,
      lastError: null,
      messages: baseMessages,
      runId: RUN_ID,
      startedAt: STARTED_AT,
    }),
    'awaiting-visible-assistant',
  );

  assert.equal(
    deriveChatResponsePhase({
      busy: true,
      lastError: null,
      messages: [
        ...baseMessages,
        {
          role: 'assistant',
          timestamp: STARTED_AT + 1_000,
          content: [{ type: 'text', text: '你好！有什么我可以帮你的吗？' }],
          __iclawBillingRunId: RUN_ID,
        },
      ],
      runId: RUN_ID,
      startedAt: STARTED_AT,
    }),
    'streaming-visible-assistant',
  );
});

test('deriveChatResponsePhase returns idle when an error already exists even if busy has not settled', () => {
  assert.equal(
    deriveChatResponsePhase({
      busy: true,
      lastError: 'Unknown model: anthropic/qwen3.5-plus',
      messages: [
        {
          role: 'user',
          timestamp: STARTED_AT,
          content: [{ type: 'text', text: 'hello' }],
          __iclawBillingRunId: RUN_ID,
        },
        {
          role: 'assistant',
          timestamp: STARTED_AT + 1_000,
          content: [{ type: 'text', text: 'Error: Unknown model: anthropic/qwen3.5-plus' }],
          __iclawBillingRunId: RUN_ID,
        },
      ],
      runId: RUN_ID,
      startedAt: STARTED_AT,
    }),
    'idle',
  );
});
