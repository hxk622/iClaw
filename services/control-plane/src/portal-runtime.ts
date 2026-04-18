import type {
  PortalAppAssetRecord,
  PortalAppDetail,
  PortalComposerControlRecord,
  PortalComposerShortcutRecord,
  PortalJsonObject,
  PortalMenuRecord,
  PortalRechargePackageRecord,
} from './portal-domain.ts';

function buildDefaultMarketingLegalPageContent(appName: string, displayName: string): {
  privacyTitle: string;
  privacyContent: string;
  termsTitle: string;
  termsContent: string;
} {
  const normalizedAppName = String(appName || '').trim().toLowerCase();
  const productLabel = String(displayName || appName || '本产品').trim() || '本产品';
  const legalEntity = productLabel;
  if (normalizedAppName === 'caiclaw') {
    return {
      privacyTitle: '隐私政策',
      privacyContent: `${legalEntity} 重视用户隐私与数据安全。为提供 ${productLabel} 服务，我们会在最小必要范围内处理账号信息、设备信息、操作日志、充值记录，以及用户主动提交的研究问题、标的代码、基金列表、组合偏好和自定义策略信息。\n\n1. 账号信息主要用于身份识别、登录鉴权、额度结算、风险控制和客服支持。\n2. 用户输入的研究问题、筛选条件、观察清单与相关上下文，可能用于生成答案、恢复会话、展示历史记录以及改进交互体验。\n3. 若某项能力需要调用第三方模型、支付、消息通知或数据服务，相关必要字段会在任务执行范围内传输给对应服务提供方。\n4. 我们不会因平台商业宣传目的擅自公开用户的账户资产、持仓、观察列表或个性化研究偏好。\n5. 我们会采取访问控制、日志审计、环境隔离与密钥管理等措施保护数据安全，但仍提醒用户避免在平台内提交超出使用目的的敏感个人信息。\n6. 用户可申请查询、导出、更正或删除与账户相关的数据；如法律法规或监管要求另有规定，我们将在符合法定义务范围内处理。`,
      termsTitle: '用户协议',
      termsContent: `${legalEntity}向用户提供 ${productLabel} 桌面端、研究工具、模型问答与相关增值能力。用户在使用前，应确认自己具备相应的民事行为能力，并保证注册资料真实、完整、可验证。\n\n1. ${productLabel} 提供的信息、分析、摘要、研报辅助、组合观察、基金与股票数据解释，仅供研究参考，不构成投资建议、收益承诺或适当性匹配结论。\n2. 用户应基于自身风险承受能力、投资期限、流动性需求和合规要求，独立作出投资决策，并自行承担由此产生的结果。\n3. 未经 ${legalEntity} 书面许可，用户不得将平台内容用于非法证券咨询、违规荐股、误导性营销、代客理财或其他违法违规用途。\n4. 平台可能接入第三方模型、行情、基金、资讯或工具服务，相关结果受上游时效、稳定性和数据口径限制影响，不保证持续可用、完全准确或绝对实时。\n5. 如用户存在异常刷量、接口滥用、账号转借、恶意抓取、利用平台开展违规金融活动等行为，${legalEntity} 有权限制功能、冻结额度或终止服务。\n6. ${legalEntity} 有权基于产品演进、合规要求或监管变化更新本协议。继续使用 ${productLabel} 即视为接受更新后的协议内容。`,
    };
  }
  return {
    privacyTitle: '隐私政策',
    privacyContent: `${legalEntity} 会在提供 ${productLabel} 服务所需的最小范围内处理用户信息，包括账号资料、设备信息、登录日志、充值记录、会话内容、文件元数据与必要的运行诊断数据。\n\n1. 账号与设备信息主要用于身份认证、安全校验、额度结算、异常排查与客服支持。\n2. 用户主动输入的问题、上传的文件、选择的工具与会话记录，可能用于任务执行、历史恢复和界面展示。\n3. 当某项能力需要调用第三方模型、存储、支付或消息服务时，完成任务所必需的信息会在相应范围内传输给合作服务提供方。\n4. 平台默认不会将用户内容公开展示，也不会在超出服务目的的情况下向无关第三方出售用户数据。\n5. 我们会采取权限控制、密钥隔离、日志审计与存储保护等措施保障安全，但请用户避免上传与当前任务无关的高度敏感信息。\n6. 用户可就其账户信息提出查询、更正、导出或删除请求；如需履行法律法规义务，我们将在法定范围内保留必要记录。`,
    termsTitle: '用户协议',
    termsContent: `${legalEntity} 向用户提供 ${productLabel} 桌面端、AI 问答、工具执行、内容处理与配套账户服务。用户应保证注册资料真实、完整、可联系，并妥善保管账号、密码与本地设备环境。\n\n1. ${productLabel} 可调用本地运行时、第三方模型、云端接口或工具服务，回答结果受模型能力、上下文、外部依赖与网络状态影响，不保证绝对准确、连续或无中断。\n2. 用户不得利用平台从事违法违规、侵权、恶意攻击、批量滥用、绕过计费、传播恶意内容或损害平台及第三方权益的行为。\n3. 涉及文件、工具执行、浏览器操作、设备调用等能力时，用户应自行确认任务目标、系统权限与潜在影响，并承担由主动操作产生的后果。\n4. ${productLabel} 输出内容仅供参考，用户应结合具体场景自行判断，不应在未经核验的情况下直接用于高风险决策。\n5. 如用户存在账号共享、自动化刷量、恶意并发、逆向接口或其他破坏服务稳定性的行为，${legalEntity} 有权限制、暂停或终止服务。\n6. ${legalEntity} 可根据产品演进、技术变化或合规要求更新本协议，更新后继续使用即视为接受新的协议内容。`,
  };
}

function buildDefaultFinanceComplianceConfig(appName: string): PortalJsonObject {
  const normalizedAppName = String(appName || '').trim().toLowerCase();
  if (normalizedAppName !== 'caiclaw' && normalizedAppName !== 'licaiclaw') {
    return {};
  }
  return {
    enabled: true,
    classificationPolicy: 'finance_v1',
    disclaimerPolicy: 'finance_inline_small',
    disclaimerText: '本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。',
    blockingPolicy: 'research_only',
    showFor: ['investment_view', 'actionable_advice'],
    hideFor: ['market_data'],
    blockFor: ['execution_request'],
    degradeFor: ['advice_request', 'personalized_request'],
  };
}
import {stripPortalDesktopReleaseConfig} from './portal-desktop-release.ts';
import {resolveRechargePaymentMethods} from './recharge-payment-methods.ts';

function asObject(value: unknown): PortalJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as PortalJsonObject;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compareBySortOrder(left: {sortOrder: number}, right: {sortOrder: number}): number {
  return left.sortOrder - right.sortOrder;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  const seen = new Set<string>();
  for (const item of asArray(value)) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
  }
  return Array.from(seen);
}

const LEGACY_MENU_KEY_MAP: Record<string, string[]> = {
  workspace: ['chat'],
  skills: ['skill-store'],
  mcp: ['mcp-store'],
  settings: ['settings'],
  assets: [],
  models: [],
};
const SYSTEM_MANAGED_MENU_KEYS = new Set(['settings']);

function normalizePortalMenuKeys(keys: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const mapped = LEGACY_MENU_KEY_MAP[key] || [key];
    for (const nextKey of mapped) {
      const trimmed = nextKey.trim();
      if (!trimmed || SYSTEM_MANAGED_MENU_KEYS.has(trimmed) || seen.has(trimmed)) continue;
      seen.add(trimmed);
      normalized.push(trimmed);
    }
  }
  return normalized;
}

function normalizeMarketingTemplateKey(value: unknown, appName: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw) {
    return raw;
  }
  return appName === 'caiclaw' ? 'wealth-premium' : 'classic-download';
}

function buildDefaultMarketingSiteConfig(input: {
  appName: string;
  displayName: string;
  website: PortalJsonObject;
}): PortalJsonObject {
  const isWealth = input.appName === 'caiclaw';
  const legalPages = buildDefaultMarketingLegalPageContent(input.appName, input.displayName);
  return {
    templateKey: normalizeMarketingTemplateKey('', input.appName),
    siteShell: {
      header: {
        enabled: true,
        variant: isWealth ? 'finance-header' : 'default-header',
        props: {
          brandLabel: String(input.website.brandLabel || input.displayName).trim() || input.displayName,
          subline: String(input.website.kicker || 'Official Website').trim() || 'Official Website',
          navItems: isWealth
            ? [
                {label: '核心能力', href: '#capabilities'},
                {label: '适用场景', href: '#scenes'},
                {label: '安全合规', href: '#security'},
              ]
            : [],
          primaryCta: {
            label: String(input.website.topCtaLabel || '下载').trim() || '下载',
            href: '#download',
          },
        },
      },
      footer: {
        enabled: true,
        variant: isWealth ? 'finance-legal-footer' : 'default-footer',
        props: {
          columns: [
            {
              title: '站点',
              links: [
                {label: '首页', href: '/'},
                {label: String(input.website.downloadTitle || `下载 ${input.displayName}`).trim() || `下载 ${input.displayName}`, href: '#download'},
              ],
            },
          ],
          legalLinks: [
            {label: '隐私政策', href: '/privacy'},
            {label: '用户协议', href: '/terms'},
          ],
          copyrightText: `© ${new Date().getFullYear()} ${input.displayName}`,
          icpText: '',
        },
      },
    },
    pages: [
      {
        pageKey: 'home',
        path: '/',
        enabled: true,
        seo: {
          title: String(input.website.homeTitle || `${input.displayName} 官网`).trim() || `${input.displayName} 官网`,
          description:
            String(input.website.metaDescription || `${input.displayName} 官网`).trim() || `${input.displayName} 官网`,
        },
        blocks: [
          {
            blockKey: isWealth ? 'hero.wealth' : 'hero.basic',
            enabled: true,
            sortOrder: 10,
            props: {
              eyebrow: String(input.website.kicker || 'Official Website').trim() || 'Official Website',
              titlePre: String(input.website.heroTitlePre || '').trim(),
              titleMain: String(input.website.heroTitleMain || '').trim(),
              description: String(input.website.heroDescription || '').trim(),
            },
          },
          {
            blockKey: isWealth ? 'download-grid.finance' : 'download-grid.classic',
            enabled: true,
            sortOrder: 20,
            props: {
              title: String(input.website.downloadTitle || `下载 ${input.displayName}`).trim() || `下载 ${input.displayName}`,
            },
          },
        ],
      },
      {
        pageKey: 'privacy',
        path: '/privacy',
        enabled: true,
        seo: {
          title: '隐私政策',
          description: '查看隐私政策',
        },
        blocks: [
          {
            blockKey: 'rich-text.legal',
            enabled: true,
            sortOrder: 10,
            props: {
              title: legalPages.privacyTitle,
              content: legalPages.privacyContent,
            },
          },
        ],
      },
      {
        pageKey: 'terms',
        path: '/terms',
        enabled: true,
        seo: {
          title: '用户协议',
          description: '查看用户协议',
        },
        blocks: [
          {
            blockKey: 'rich-text.legal',
            enabled: true,
            sortOrder: 10,
            props: {
              title: legalPages.termsTitle,
              content: legalPages.termsContent,
            },
          },
        ],
      },
    ],
  };
}

function normalizeMarketingSiteConfig(
  homeWebSurfaceConfig: PortalJsonObject,
  input: {appName: string; displayName: string; website: PortalJsonObject},
): PortalJsonObject {
  const direct = asObject(homeWebSurfaceConfig);
  const nested = asObject(direct.marketingSite);
  const defaultConfig = buildDefaultMarketingSiteConfig(input);
  return {
    ...cloneJson(defaultConfig),
    ...cloneJson(nested),
    ...cloneJson(direct),
    templateKey: normalizeMarketingTemplateKey(direct.templateKey || nested.templateKey, input.appName),
    siteShell: {
      ...cloneJson(asObject(defaultConfig.siteShell)),
      ...cloneJson(asObject(nested.siteShell)),
      ...cloneJson(asObject(direct.siteShell)),
    },
    pages: Array.isArray(direct.pages)
      ? cloneJson(direct.pages)
      : Array.isArray(nested.pages)
        ? cloneJson(nested.pages)
        : cloneJson(asArray(defaultConfig.pages)),
  };
}

export function buildPortalPublicConfig(
  detail: PortalAppDetail,
  options: {
    surfaceKey?: string | null;
    menuCatalog?: PortalMenuRecord[];
    composerControlCatalog?: PortalComposerControlRecord[];
    composerShortcutCatalog?: PortalComposerShortcutRecord[];
    rechargePackageCatalog?: PortalRechargePackageRecord[];
    assetUrlResolver?: (asset: PortalAppAssetRecord) => string | null;
  } = {},
): {
  brand: {
    brandId: string;
    displayName: string;
    productName: string;
    tenantKey: string;
    status: string;
  };
  app: {
    appName: string;
    displayName: string;
    description: string | null;
    status: string;
    defaultLocale: string;
  };
  publishedVersion: number;
  config: PortalJsonObject;
  surfaceKey: string | null;
  surfaceConfig: PortalJsonObject | null;
} {
  const existingConfig = stripPortalDesktopReleaseConfig(cloneJson(asObject(detail.app.config)));
  const existingAssets = asObject(existingConfig.assets);
  const existingCapabilities = asObject(existingConfig.capabilities);
  const existingBrandMeta = {
    ...asObject(existingConfig.brand_meta),
    ...asObject(existingConfig.brandMeta),
  };
  const existingStorage = asObject(existingConfig.storage);
  const resolveAssetUrl = options.assetUrlResolver || (() => null);
  const menuCatalog = Array.isArray(options.menuCatalog) ? options.menuCatalog : [];
  const composerControlCatalog = Array.isArray(options.composerControlCatalog) ? options.composerControlCatalog : [];
  const composerShortcutCatalog = Array.isArray(options.composerShortcutCatalog) ? options.composerShortcutCatalog : [];
  const rechargePackageCatalog = Array.isArray(options.rechargePackageCatalog) ? options.rechargePackageCatalog : [];
  const surfaceKey = typeof options.surfaceKey === 'string' ? options.surfaceKey.trim() : '';
  const surfaces = asObject(existingConfig.surfaces);
  const inputSurface = asObject(surfaces.input);
  const inputSurfaceConfig = asObject(inputSurface.config);
  const rechargeSurface = asObject(surfaces.recharge);
  const rechargeSurfaceConfig = asObject(rechargeSurface.config);
  const hasExplicitRechargePaymentMethods =
    Array.isArray(rechargeSurfaceConfig.payment_methods) || Array.isArray(rechargeSurfaceConfig.paymentMethods);

  const skillBindings = detail.skillBindings
    .filter((item) => item.enabled)
    .sort(compareBySortOrder)
    .map((item) => ({
      skill_slug: item.skillSlug,
      sort_order: item.sortOrder,
      config: cloneJson(item.config),
    }));
  const mcpBindings = detail.mcpBindings
    .filter((item) => item.enabled)
    .sort(compareBySortOrder)
    .map((item) => ({
      mcp_key: item.mcpKey,
      sort_order: item.sortOrder,
      config: cloneJson(item.config),
    }));
  const menuBindings = detail.menuBindings
    .filter((item) => item.enabled)
    .sort(compareBySortOrder)
    .flatMap((item) =>
      normalizePortalMenuKeys([item.menuKey]).map((menuKey) => ({
        menu_key: menuKey,
        sort_order: item.sortOrder,
        config: cloneJson(item.config),
      })),
    )
    .filter((item, index, items) => items.findIndex((entry) => entry.menu_key === item.menu_key) === index);
  const brandId = detail.app.appName;
  const tenantKey =
    String(existingBrandMeta.tenant_key || existingBrandMeta.tenantKey || existingStorage.namespace || brandId).trim() ||
    brandId;
  const productName =
    String(existingBrandMeta.product_name || existingBrandMeta.productName || existingConfig.productName || detail.app.displayName).trim() ||
    detail.app.displayName;

  const assetEntries = detail.assets
    .map((asset) => {
      const resolvedUrl = resolveAssetUrl(asset);
      return [
        asset.assetKey,
        {
          url: resolvedUrl,
          content_type: asset.contentType,
          object_key: asset.objectKey,
          storage_provider: asset.storageProvider || null,
          metadata: cloneJson(asset.metadata),
        },
      ] as const;
    })
    .filter((entry) => Boolean(entry[1].url || entry[1].object_key));
  const publicMenuCatalog = menuCatalog
    .filter((item) => item.active && !SYSTEM_MANAGED_MENU_KEYS.has(item.menuKey))
    .map((item) => ({
      menu_key: item.menuKey,
      display_name: item.displayName,
      category: item.category,
      route_key: item.routeKey,
      icon_key: item.iconKey,
      metadata: cloneJson(item.metadata),
    }));
  const publicComposerControls = detail.composerControlBindings
    .filter((item) => item.enabled)
    .sort(compareBySortOrder)
    .map((item) => {
      const catalog = composerControlCatalog.find((entry) => entry.controlKey === item.controlKey && entry.active);
      if (!catalog) return null;
      const bindingConfig = asObject(item.config);
      const allowedOptionValues = asStringArray(bindingConfig.allowed_option_values ?? bindingConfig.allowedOptionValues);
      const options = catalog.options
        .filter((entry) => entry.active)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.optionValue.localeCompare(right.optionValue, 'zh-CN'))
        .filter((entry) => allowedOptionValues.length === 0 || allowedOptionValues.includes(entry.optionValue))
        .map((entry) => ({
          option_value: entry.optionValue,
          label: entry.label,
          description: entry.description,
          sort_order: entry.sortOrder,
          metadata: cloneJson(entry.metadata),
        }));
      return {
        control_key: catalog.controlKey,
        display_name: String(bindingConfig.display_name || bindingConfig.displayName || catalog.displayName).trim() || catalog.displayName,
        control_type: catalog.controlType,
        icon_key: String(bindingConfig.icon_key || bindingConfig.iconKey || catalog.iconKey || '').trim() || null,
        sort_order: item.sortOrder,
        metadata: cloneJson(catalog.metadata),
        config: cloneJson(bindingConfig),
        options,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const publicComposerShortcuts = detail.composerShortcutBindings
    .filter((item) => item.enabled)
    .sort(compareBySortOrder)
    .map((item) => {
      const catalog = composerShortcutCatalog.find((entry) => entry.shortcutKey === item.shortcutKey && entry.active);
      if (!catalog) return null;
      const bindingConfig = asObject(item.config);
      return {
        shortcut_key: catalog.shortcutKey,
        display_name:
          String(bindingConfig.display_name || bindingConfig.displayName || catalog.displayName).trim() || catalog.displayName,
        description:
          String(bindingConfig.description || bindingConfig.subtitle || catalog.description).trim() || catalog.description,
        template:
          String(bindingConfig.template || bindingConfig.template_text || catalog.template).trim() || catalog.template,
        icon_key: String(bindingConfig.icon_key || bindingConfig.iconKey || catalog.iconKey || '').trim() || null,
        tone: String(bindingConfig.tone || catalog.tone || '').trim() || null,
        sort_order: item.sortOrder,
        metadata: cloneJson(catalog.metadata),
        config: cloneJson(bindingConfig),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const platformRechargePackages = rechargePackageCatalog
    .filter((item) => item.active !== false)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.packageId.localeCompare(right.packageId, 'zh-CN'));
  const enabledRechargeBindings = detail.rechargePackageBindings
    .filter((item) => item.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.packageId.localeCompare(right.packageId, 'zh-CN'));
  const hasAppRechargeBindings = enabledRechargeBindings.length > 0;
  const publicRechargePackages = (hasAppRechargeBindings
    ? enabledRechargeBindings
        .map((binding) => {
          const catalog = platformRechargePackages.find((item) => item.packageId === binding.packageId);
          if (!catalog) return null;
          return {
            package_id: catalog.packageId,
            package_name: catalog.packageName,
            credits: catalog.credits,
            bonus_credits: catalog.bonusCredits,
            total_credits: catalog.credits + catalog.bonusCredits,
            amount_cny_fen: catalog.amountCnyFen,
            sort_order: binding.sortOrder,
            recommended: binding.recommended === true,
            is_default: binding.default === true,
            metadata: {
              ...cloneJson(catalog.metadata),
              ...cloneJson(binding.config),
              source_layer: 'oem_binding',
            },
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : platformRechargePackages.map((item) => ({
        package_id: item.packageId,
        package_name: item.packageName,
        credits: item.credits,
        bonus_credits: item.bonusCredits,
        total_credits: item.credits + item.bonusCredits,
        amount_cny_fen: item.amountCnyFen,
        sort_order: item.sortOrder,
        recommended: item.recommended,
        is_default: item.default,
        metadata: {
          ...cloneJson(item.metadata),
          source_layer: 'platform_catalog',
        },
      })))
    .sort((left, right) => left.sort_order - right.sort_order || left.package_id.localeCompare(right.package_id, 'zh-CN'));
  const resolvedRechargePaymentMethods = resolveRechargePaymentMethods(detail.app.config);
  const publicRechargePaymentMethods = resolvedRechargePaymentMethods
    .filter((item) => item.enabled)
    .map((item) => ({
      provider: item.provider,
      sort_order: item.sortOrder,
      is_default: item.default,
      label: item.label,
      metadata: {
        ...cloneJson(item.metadata),
        source_layer: item.sourceLayer,
      },
    }));
  const rechargePaymentMethodsSourceLayer =
    resolvedRechargePaymentMethods[0]?.sourceLayer || (hasExplicitRechargePaymentMethods ? 'oem_binding' : 'platform_default');
  const nextInputSurfaceConfig = {
    ...inputSurfaceConfig,
    top_bar_controls: publicComposerControls,
    footer_shortcuts: publicComposerShortcuts,
  };
  const nextRechargeSurfaceConfig = {
    ...rechargeSurfaceConfig,
    packages: publicRechargePackages,
    payment_methods: publicRechargePaymentMethods,
    payment_methods_source_layer: rechargePaymentMethodsSourceLayer,
    source_layer: hasAppRechargeBindings ? 'oem_binding' : 'platform_catalog',
  };
  const nextHomeWebSurface = asObject(surfaces['home-web']);
  const nextHomeWebSurfaceConfig = normalizeMarketingSiteConfig(asObject(nextHomeWebSurface.config), {
    appName: detail.app.appName,
    displayName: detail.app.displayName,
    website: asObject(existingConfig.website),
  });
  const resolvedSurfaces: PortalJsonObject = {
    ...surfaces,
    'home-web': {
      ...nextHomeWebSurface,
      enabled: nextHomeWebSurface.enabled !== false,
      config: nextHomeWebSurfaceConfig,
    },
    input: {
      ...inputSurface,
      config: nextInputSurfaceConfig,
    },
    recharge: {
      ...rechargeSurface,
      enabled: rechargeSurface.enabled !== false,
      config: nextRechargeSurfaceConfig,
    },
  };
  const surfaceEntry = surfaceKey ? asObject(resolvedSurfaces[surfaceKey]) : null;

  return {
    brand: {
      brandId,
      displayName: detail.app.displayName,
      productName,
      tenantKey,
      status: detail.app.status,
    },
    app: {
      appName: detail.app.appName,
      displayName: detail.app.displayName,
      description: detail.app.description,
      status: detail.app.status,
      defaultLocale: detail.app.defaultLocale,
    },
    publishedVersion: detail.releases[0]?.version || 0,
    config: {
      ...existingConfig,
      brand_meta: {
        ...existingBrandMeta,
        brand_id: brandId,
        tenant_key: tenantKey,
        display_name: detail.app.displayName,
        product_name: productName,
        legal_name: String(existingBrandMeta.legal_name || detail.app.displayName).trim() || detail.app.displayName,
        storage_namespace: String(existingBrandMeta.storage_namespace || existingStorage.namespace || brandId).trim() || brandId,
      },
      assets: {
        ...existingAssets,
        ...Object.fromEntries(assetEntries),
      },
      marketingSite: cloneJson(nextHomeWebSurfaceConfig),
      financeCompliance: {
        ...buildDefaultFinanceComplianceConfig(detail.app.appName),
        ...cloneJson(asObject(existingConfig.financeCompliance)),
      },
      surfaces: resolvedSurfaces,
      capabilities: {
        ...existingCapabilities,
        skills: skillBindings.map((item) => item.skill_slug),
        mcp_servers: mcpBindings.map((item) => item.mcp_key),
        menus: menuBindings.map((item) => item.menu_key),
      },
      skill_bindings: skillBindings,
      mcp_bindings: mcpBindings,
      menu_bindings: menuBindings,
      menu_catalog: publicMenuCatalog,
      composer_control_bindings: publicComposerControls,
      composer_shortcut_bindings: publicComposerShortcuts,
      recharge_package_catalog: platformRechargePackages.map((item) => ({
        package_id: item.packageId,
        package_name: item.packageName,
        credits: item.credits,
        bonus_credits: item.bonusCredits,
        total_credits: item.credits + item.bonusCredits,
        amount_cny_fen: item.amountCnyFen,
        sort_order: item.sortOrder,
        recommended: item.recommended,
        is_default: item.default,
        metadata: cloneJson(item.metadata),
      })),
      recharge_package_bindings: enabledRechargeBindings.map((item) => ({
        package_id: item.packageId,
        sort_order: item.sortOrder,
        recommended: item.recommended,
        is_default: item.default,
        config: cloneJson(item.config),
      })),
      recharge_payment_method_bindings: resolvedRechargePaymentMethods.map((item) => ({
        provider: item.provider,
        enabled: item.enabled,
        sort_order: item.sortOrder,
        is_default: item.default,
        label: item.label,
        metadata: cloneJson(item.metadata),
        source_layer: item.sourceLayer,
      })),
    },
    surfaceKey: surfaceKey || null,
    surfaceConfig: surfaceEntry ? asObject(surfaceEntry.config) : null,
  };
}
