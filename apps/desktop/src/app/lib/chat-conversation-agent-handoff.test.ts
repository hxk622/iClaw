import test from 'node:test';
import assert from 'node:assert/strict';

type ConversationHandoff = {
  fromAgentId: string | null;
  toAgentId: string | null;
};

type ConversationRecord = {
  activeAgentId: string | null;
  handoffs: ConversationHandoff[];
};

function applyAgentHandoff(record: ConversationRecord, nextAgentId: string | null): ConversationRecord {
  if ((record.activeAgentId || null) === nextAgentId) {
    return record;
  }
  return {
    activeAgentId: nextAgentId,
    handoffs: [
      {
        fromAgentId: record.activeAgentId || null,
        toAgentId: nextAgentId,
      },
      ...record.handoffs,
    ],
  };
}

test('agent handoff keeps same conversation while tracking agent transition history', () => {
  const initial: ConversationRecord = {
    activeAgentId: null,
    handoffs: [],
  };

  const afterA = applyAgentHandoff(initial, 'nuwa-jobs');
  assert.equal(afterA.activeAgentId, 'nuwa-jobs');
  assert.deepEqual(afterA.handoffs[0], {
    fromAgentId: null,
    toAgentId: 'nuwa-jobs',
  });

  const afterB = applyAgentHandoff(afterA, 'nuwa-munger');
  assert.equal(afterB.activeAgentId, 'nuwa-munger');
  assert.deepEqual(afterB.handoffs[0], {
    fromAgentId: 'nuwa-jobs',
    toAgentId: 'nuwa-munger',
  });

  const afterClear = applyAgentHandoff(afterB, null);
  assert.equal(afterClear.activeAgentId, null);
  assert.deepEqual(afterClear.handoffs[0], {
    fromAgentId: 'nuwa-munger',
    toAgentId: null,
  });
});
