import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveOrphanReadingIndicatorIndexes, type EmbeddedChatGroupDescriptor } from './embedded-chat-normalization.ts';

function createGroup(overrides: Partial<EmbeddedChatGroupDescriptor> = {}): EmbeddedChatGroupDescriptor {
  return {
    hidden: false,
    user: false,
    assistantSide: true,
    hasVisibleContent: false,
    hasReadingIndicator: false,
    toolLike: false,
    ...overrides,
  };
}

test('hides indicator-only groups once the assistant segment has visible content', () => {
  const hidden = resolveOrphanReadingIndicatorIndexes(
    [
      createGroup({ hasReadingIndicator: true }),
      createGroup({ hasVisibleContent: true }),
      createGroup({ hasReadingIndicator: true }),
    ],
    true,
  );

  assert.deepEqual([...hidden], [0, 2]);
});

test('keeps only the newest indicator-only group while busy in an empty assistant segment', () => {
  const hidden = resolveOrphanReadingIndicatorIndexes(
    [
      createGroup({ hasReadingIndicator: true }),
      createGroup({ hasReadingIndicator: true }),
      createGroup({ hasReadingIndicator: true }),
    ],
    true,
  );

  assert.deepEqual([...hidden], [0, 1]);
});

test('hides all indicator-only groups once the host is no longer busy', () => {
  const hidden = resolveOrphanReadingIndicatorIndexes(
    [
      createGroup({ hasReadingIndicator: true }),
      createGroup({ hasReadingIndicator: true }),
    ],
    false,
  );

  assert.deepEqual([...hidden], [0, 1]);
});

test('resets assistant segments when a user group appears', () => {
  const hidden = resolveOrphanReadingIndicatorIndexes(
    [
      createGroup({ hasReadingIndicator: true }),
      createGroup({ user: true, assistantSide: false }),
      createGroup({ hasReadingIndicator: true }),
    ],
    true,
  );

  assert.deepEqual([...hidden], []);
});
