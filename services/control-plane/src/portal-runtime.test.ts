import test from 'node:test';
import assert from 'node:assert/strict';

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

test('canonical default recharge package seeds keep a single default package', () => {
  const defaultPackages = DEFAULT_PLATFORM_RECHARGE_PACKAGE_SEEDS.filter((item) => item.default);
  assert.equal(defaultPackages.length, 1);
  assert.equal(defaultPackages[0]?.packageId, 'topup_7000');
});
