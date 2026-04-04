import test from 'node:test';
import assert from 'node:assert/strict';

import type {PortalAppDetail} from './portal-domain.ts';
import {buildPortalPublicConfig} from './portal-runtime.ts';

test('buildPortalPublicConfig preserves skill catalog visibility mode', () => {
  const detail: PortalAppDetail = {
    app: {
      appName: 'licaiclaw',
      displayName: '理财客',
      description: null,
      status: 'active',
      defaultLocale: 'zh-CN',
      config: {
        capabilities: {
          skill_catalog: {
            visibility_mode: 'all_cloud',
          },
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    skillBindings: [],
    mcpBindings: [],
    modelBindings: [],
    menuBindings: [],
    composerControlBindings: [],
    composerShortcutBindings: [],
    rechargePackageBindings: [],
    assets: [],
    releases: [],
    audit: [],
  };

  const result = buildPortalPublicConfig(detail);
  assert.equal(
    (result.config.capabilities as Record<string, unknown>)?.skill_catalog &&
      ((result.config.capabilities as Record<string, unknown>).skill_catalog as Record<string, unknown>).visibility_mode,
    'all_cloud',
  );
});
