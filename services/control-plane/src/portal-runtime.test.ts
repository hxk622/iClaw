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

test('buildPortalPublicConfig derives marketing-site defaults for licaiclaw home-web surface', () => {
  const detail: PortalAppDetail = {
    app: {
      appName: 'licaiclaw',
      displayName: '理财客',
      description: null,
      status: 'active',
      defaultLocale: 'zh-CN',
      config: {
        website: {
          homeTitle: '理财客官网',
          metaDescription: '理财客官网，面向财富管理场景的本地 AI 客户端。',
          brandLabel: '理财客',
          kicker: 'Official Website',
          heroTitlePre: '把 AI 装进你的财富工作流',
          heroTitleMain: '打开就能干活',
          heroDescription: '理财客面向财富管理场景设计。少一点配置，多一点交付。',
          topCtaLabel: '下载',
          downloadTitle: '下载理财客',
        },
        surfaces: {
          'home-web': {
            enabled: true,
            config: {},
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

  const result = buildPortalPublicConfig(detail, {surfaceKey: 'home-web'});
  const marketingSite = (result.config.marketingSite || {}) as Record<string, unknown>;
  const surfaceConfig = (result.surfaceConfig || {}) as Record<string, unknown>;
  const pages = Array.isArray(marketingSite.pages) ? marketingSite.pages : [];
  const homePage = pages.find((item) => ((item as Record<string, unknown>).pageKey || '') === 'home') as Record<string, unknown> | undefined;
  const privacyPage = pages.find((item) => ((item as Record<string, unknown>).pageKey || '') === 'privacy') as Record<string, unknown> | undefined;

  assert.equal(marketingSite.templateKey, 'wealth-premium');
  assert.equal(surfaceConfig.templateKey, 'wealth-premium');
  assert.equal(((marketingSite.siteShell as Record<string, unknown>).header as Record<string, unknown>).variant, 'finance-header');
  assert.equal(((marketingSite.siteShell as Record<string, unknown>).footer as Record<string, unknown>).variant, 'finance-legal-footer');
  assert.ok(homePage);
  assert.ok(privacyPage);
  assert.equal(((homePage.seo as Record<string, unknown>).title || ''), '理财客官网');
  assert.equal((((homePage.blocks as unknown[])?.[0] as Record<string, unknown>).blockKey || ''), 'hero.wealth');
  assert.equal((((homePage.blocks as unknown[])?.[1] as Record<string, unknown>).blockKey || ''), 'download-grid.finance');
});

test('buildPortalPublicConfig preserves explicit marketing-site config from home-web surface', () => {
  const detail: PortalAppDetail = {
    app: {
      appName: 'iclaw',
      displayName: 'iClaw',
      description: null,
      status: 'active',
      defaultLocale: 'zh-CN',
      config: {
        website: {
          homeTitle: 'iClaw 官网',
          metaDescription: 'iClaw 官网，面向普通用户的本地 AI 客户端。',
          brandLabel: 'iClaw',
          kicker: 'Official Website',
          heroTitlePre: '让 AI 真正像软件一样',
          heroTitleMain: '装上就能用',
          heroDescription: '面向普通用户设计。',
          topCtaLabel: '下载',
          downloadTitle: '下载 iClaw',
        },
        surfaces: {
          'home-web': {
            enabled: true,
            config: {
              templateKey: 'classic-download',
              siteShell: {
                header: {
                  enabled: true,
                  variant: 'custom-header',
                  props: {
                    brandLabel: 'iClaw Pro',
                  },
                },
              },
              pages: [
                {
                  pageKey: 'home',
                  path: '/',
                  enabled: true,
                  seo: {
                    title: 'Custom Home',
                    description: 'Custom Desc',
                  },
                  blocks: [
                    {
                      blockKey: 'hero.basic',
                      enabled: true,
                      sortOrder: 10,
                      props: {
                        titleMain: 'Custom Hero',
                      },
                    },
                  ],
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

  const result = buildPortalPublicConfig(detail, {surfaceKey: 'home-web'});
  const marketingSite = (result.config.marketingSite || {}) as Record<string, unknown>;
  const pages = Array.isArray(marketingSite.pages) ? marketingSite.pages : [];
  const homePage = pages.find((item) => ((item as Record<string, unknown>).pageKey || '') === 'home') as Record<string, unknown> | undefined;
  const header = (((marketingSite.siteShell as Record<string, unknown>).header || {}) as Record<string, unknown>);

  assert.equal(marketingSite.templateKey, 'classic-download');
  assert.equal(header.variant, 'custom-header');
  assert.equal(((header.props as Record<string, unknown>).brandLabel || ''), 'iClaw Pro');
  assert.ok(homePage);
  assert.equal(((homePage.seo as Record<string, unknown>).title || ''), 'Custom Home');
  assert.equal((((homePage.blocks as unknown[])?.[0] as Record<string, unknown>).props as Record<string, unknown>).titleMain, 'Custom Hero');
});
