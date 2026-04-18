import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveRequiredEnabledMenuKeys } from './oem-runtime.ts';

test('resolveRequiredEnabledMenuKeys respects explicit menu bindings without forcing knowledge-library back in', () => {
  const resolved = resolveRequiredEnabledMenuKeys({
    menu_bindings: [
      {
        menu_key: 'chat',
        enabled: true,
      },
      {
        menu_key: 'cron',
        enabled: true,
      },
      {
        menu_key: 'knowledge-library',
        enabled: false,
      },
    ],
    capabilities: {
      menus: ['chat', 'cron'],
    },
    surfaces: {
      'knowledge-library': {
        enabled: false,
      },
    },
  });

  assert.deepEqual(resolved, ['chat', 'cron']);
  assert.equal(resolved.includes('knowledge-library'), false);
});

test('resolveRequiredEnabledMenuKeys falls back to default menus when runtime config is absent', () => {
  const resolved = resolveRequiredEnabledMenuKeys(null);
  assert.equal(resolved.includes('knowledge-library'), true);
  assert.equal(resolved.includes('chat'), true);
});
