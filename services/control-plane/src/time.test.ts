import test from 'node:test';
import assert from 'node:assert/strict';

import {startOfNextShanghaiDayIso} from './time.ts';

function formatInShanghai(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(iso));
}

test('startOfNextShanghaiDayIso resolves to next Shanghai midnight for same-day timestamps', () => {
  assert.equal(
    formatInShanghai(startOfNextShanghaiDayIso(new Date('2026-03-30T01:00:00+08:00'))),
    '2026-03-31 00:00:00',
  );
  assert.equal(
    formatInShanghai(startOfNextShanghaiDayIso(new Date('2026-03-30T23:00:00+08:00'))),
    '2026-03-31 00:00:00',
  );
});

test('startOfNextShanghaiDayIso rolls month and year boundaries correctly', () => {
  assert.equal(
    formatInShanghai(startOfNextShanghaiDayIso(new Date('2026-03-31T00:01:00+08:00'))),
    '2026-04-01 00:00:00',
  );
  assert.equal(
    formatInShanghai(startOfNextShanghaiDayIso(new Date('2026-12-31T23:59:00+08:00'))),
    '2027-01-01 00:00:00',
  );
});
