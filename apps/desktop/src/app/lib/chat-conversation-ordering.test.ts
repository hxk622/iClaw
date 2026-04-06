import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyConversationMetadataSyncUpdate,
  applyEnsureConversationUpdate,
} from './chat-conversation-ordering.ts';

const BASE_RECORD = {
  title: 'B',
  summary: 'B summary',
  activeSessionKey: 'session-b',
  sessionKeys: ['session-b'],
  updatedAt: '2026-04-06T09:00:00.000Z',
};

test('applyEnsureConversationUpdate does not bump ordering time on pure reopen', () => {
  const result = applyEnsureConversationUpdate(BASE_RECORD, {
    sessionKey: 'session-b',
    title: null,
    summary: null,
    nowIso: '2026-04-06T12:00:00.000Z',
  });

  assert.equal(result.changed, false);
  assert.equal(result.activityChanged, false);
  assert.equal(result.record.updatedAt, BASE_RECORD.updatedAt);
});

test('applyConversationMetadataSyncUpdate preserves updatedAt for structural session changes', () => {
  const result = applyConversationMetadataSyncUpdate(BASE_RECORD, {
    sessionKey: 'session-b-next',
    title: null,
    summary: null,
    nowIso: '2026-04-06T12:00:00.000Z',
  });

  assert.equal(result.changed, true);
  assert.equal(result.activityChanged, false);
  assert.equal(result.record.updatedAt, BASE_RECORD.updatedAt);
  assert.equal(result.record.activeSessionKey, 'session-b-next');
  assert.deepEqual(result.record.sessionKeys, ['session-b-next', 'session-b']);
});

test('applyConversationMetadataSyncUpdate bumps updatedAt only for real content changes', () => {
  const result = applyConversationMetadataSyncUpdate(
    {
      ...BASE_RECORD,
      title: null,
    },
    {
      sessionKey: 'session-b',
      title: 'New title',
      summary: null,
      nowIso: '2026-04-06T12:00:00.000Z',
    },
  );

  assert.equal(result.changed, true);
  assert.equal(result.activityChanged, true);
  assert.equal(result.record.updatedAt, '2026-04-06T12:00:00.000Z');
  assert.equal(result.record.title, 'New title');
});
