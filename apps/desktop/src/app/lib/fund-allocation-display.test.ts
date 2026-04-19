import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveFundAllocationSnapshot } from './fund-allocation-display.ts';

test('resolveFundAllocationSnapshot extracts latest allocation values', () => {
  const snapshot = resolveFundAllocationSnapshot({
    categories: ['2025-09-30', '2025-12-31'],
    series: [
      { name: '股票占净比', data: [97.83, 99.37] },
      { name: '债券占净比', data: [0, 0] },
      { name: '现金占净比', data: [2.02, 0.68] },
      { name: '净资产', data: [1996.9486, 1971.2399] },
    ],
  });

  assert.deepEqual(snapshot, [
    { label: '股票占净比', value: '99.37%' },
    { label: '债券占净比', value: '0.00%' },
    { label: '现金占净比', value: '0.68%' },
    { label: '净资产', value: '1971亿' },
  ]);
});

test('resolveFundAllocationSnapshot returns empty array when categories are missing', () => {
  assert.deepEqual(resolveFundAllocationSnapshot({}), []);
});
