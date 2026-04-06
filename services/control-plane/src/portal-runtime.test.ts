import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import type {PortalAppDetail} from './portal-domain.ts';
import {buildPortalPublicConfig} from './portal-runtime.ts';
import {DEFAULT_PLATFORM_RECHARGE_PACKAGE_SEEDS} from './recharge-packages.ts';

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

test('buildPortalPublicConfig publishes OEM recharge payment methods when configured', () => {
  const detail: PortalAppDetail = {
    app: {
      appName: 'iclaw-oem',
      displayName: 'iClaw OEM',
      description: null,
      status: 'active',
      defaultLocale: 'zh-CN',
      config: {
        surfaces: {
          recharge: {
            config: {
              payment_methods: [
                {
                  provider: 'alipay_qr',
                  enabled: true,
                  sort_order: 10,
                  is_default: true,
                  label: '支付宝',
                },
                {
                  provider: 'wechat_qr',
                  enabled: false,
                  sort_order: 20,
                },
              ],
            },
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
  const rechargeSurface = ((result.config.surfaces as Record<string, unknown>).recharge || {}) as Record<string, unknown>;
  const rechargeConfig = (rechargeSurface.config || {}) as Record<string, unknown>;
  const paymentMethods = Array.isArray(rechargeConfig.payment_methods) ? rechargeConfig.payment_methods : [];

  assert.equal(paymentMethods.length, 1);
  assert.equal((paymentMethods[0] as Record<string, unknown>).provider, 'alipay_qr');
  assert.equal((paymentMethods[0] as Record<string, unknown>).is_default, true);
  assert.equal(rechargeConfig.payment_methods_source_layer, 'oem_binding');
});

test('core OEM preset recharge packages stay aligned with the canonical default seeds', async () => {
  const raw = JSON.parse(await readFile(new URL('../presets/core-oem.json', import.meta.url), 'utf8')) as {
    rechargePackages?: Array<Record<string, unknown>>;
  };
  const actual = (raw.rechargePackages || []).map((item) => ({
    packageId: item.packageId,
    packageName: item.packageName,
    credits: item.credits,
    bonusCredits: item.bonusCredits,
    amountCnyFen: item.amountCnyFen,
    sortOrder: item.sortOrder,
    recommended: item.recommended,
    default: item.default,
    active: item.active,
    metadata: item.metadata,
  }));
  const expected = DEFAULT_PLATFORM_RECHARGE_PACKAGE_SEEDS.map((item) => ({
    packageId: item.packageId,
    packageName: item.packageName,
    credits: item.credits,
    bonusCredits: item.bonusCredits,
    amountCnyFen: item.amountCnyFen,
    sortOrder: item.sortOrder,
    recommended: item.recommended,
    default: item.default,
    active: item.active,
    metadata: item.metadata,
  }));

  assert.deepEqual(actual, expected);
});
