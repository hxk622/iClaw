import test from 'node:test';
import assert from 'node:assert/strict';

import { isWindowsDesktopRuntime, resolveSurfaceCacheLimits } from './surface-cache-profile.ts';

test('isWindowsDesktopRuntime only matches tauri windows shells', () => {
  assert.equal(
    isWindowsDesktopRuntime({
      isTauriRuntime: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32',
    }),
    true,
  );

  assert.equal(
    isWindowsDesktopRuntime({
      isTauriRuntime: false,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32',
    }),
    false,
  );
});

test('resolveSurfaceCacheLimits tightens menu cache on windows desktop', () => {
  assert.deepEqual(
    resolveSurfaceCacheLimits({
      isTauriRuntime: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32',
    }),
    {
      menu: 2,
      overlay: 3,
    },
  );
});

test('resolveSurfaceCacheLimits leaves non-windows environments unchanged', () => {
  assert.deepEqual(
    resolveSurfaceCacheLimits({
      isTauriRuntime: true,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
    }),
    {},
  );
});
