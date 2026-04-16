import {asArray, asObject, deepMerge, normalizeTemplateKey, trimString} from './renderers/shared.js';

function defaultLegalPageContent(runtimeBrand) {
  const brandId = trimString(runtimeBrand.brandId).toLowerCase();
  const displayName = trimString(runtimeBrand.displayName) || '本产品';
  if (brandId === 'caiclaw' || brandId === 'licaiclaw') {
    return {
      privacyTitle: '隐私政策',
      privacyContent: `${displayName} 重视用户隐私与数据安全。为提供 ${displayName} 服务，我们会在最小必要范围内处理账号信息、设备信息、操作日志、充值记录，以及用户主动提交的研究问题、标的代码、基金列表、组合偏好和自定义策略信息。\n\n1. 账号信息主要用于身份识别、登录鉴权、额度结算、风险控制和客服支持。\n2. 用户输入的研究问题、筛选条件、观察清单与相关上下文，可能用于生成答案、恢复会话、展示历史记录以及改进交互体验。\n3. 若某项能力需要调用第三方模型、支付、消息通知或数据服务，相关必要字段会在任务执行范围内传输给对应服务提供方。\n4. 我们不会因平台商业宣传目的擅自公开用户的账户资产、持仓、观察列表或个性化研究偏好。\n5. 我们会采取访问控制、日志审计、环境隔离与密钥管理等措施保护数据安全，但仍提醒用户避免在平台内提交超出使用目的的敏感个人信息。\n6. 用户可申请查询、导出、更正或删除与账户相关的数据；如法律法规或监管要求另有规定，我们将在符合法定义务范围内处理。`,
      termsTitle: '用户协议',
      termsContent: `${displayName}向用户提供 ${displayName} 桌面端、研究工具、模型问答与相关增值能力。用户在使用前，应确认自己具备相应的民事行为能力，并保证注册资料真实、完整、可验证。\n\n1. ${displayName} 提供的信息、分析、摘要、研报辅助、组合观察、基金与股票数据解释，仅供研究参考，不构成投资建议、收益承诺或适当性匹配结论。\n2. 用户应基于自身风险承受能力、投资期限、流动性需求和合规要求，独立作出投资决策，并自行承担由此产生的结果。\n3. 未经 ${displayName} 书面许可，用户不得将平台内容用于非法证券咨询、违规荐股、误导性营销、代客理财或其他违法违规用途。\n4. 平台可能接入第三方模型、行情、基金、资讯或工具服务，相关结果受上游时效、稳定性和数据口径限制影响，不保证持续可用、完全准确或绝对实时。\n5. 如用户存在异常刷量、接口滥用、账号转借、恶意抓取、利用平台开展违规金融活动等行为，平台有权限制功能、冻结额度或终止服务。\n6. 平台有权基于产品演进、合规要求或监管变化更新本协议。继续使用即视为接受更新后的协议内容。`,
    };
  }
  return {
    privacyTitle: '隐私政策',
    privacyContent: `${displayName} 会在提供 ${displayName} 服务所需的最小范围内处理用户信息，包括账号资料、设备信息、登录日志、充值记录、会话内容、文件元数据与必要的运行诊断数据。\n\n1. 账号与设备信息主要用于身份认证、安全校验、额度结算、异常排查与客服支持。\n2. 用户主动输入的问题、上传的文件、选择的工具与会话记录，可能用于任务执行、历史恢复和界面展示。\n3. 当某项能力需要调用第三方模型、存储、支付或消息服务时，完成任务所必需的信息会在相应范围内传输给合作服务提供方。\n4. 平台默认不会将用户内容公开展示，也不会在超出服务目的的情况下向无关第三方出售用户数据。\n5. 我们会采取权限控制、密钥隔离、日志审计与存储保护等措施保障安全，但请用户避免上传与当前任务无关的高度敏感信息。\n6. 用户可就其账户信息提出查询、更正、导出或删除请求；如需履行法律法规义务，我们将在法定范围内保留必要记录。`,
    termsTitle: '用户协议',
    termsContent: `${displayName} 向用户提供桌面端、AI 问答、工具执行、内容处理与配套账户服务。用户应保证注册资料真实、完整、可联系，并妥善保管账号、密码与本地设备环境。\n\n1. ${displayName} 可调用本地运行时、第三方模型、云端接口或工具服务，回答结果受模型能力、上下文、外部依赖与网络状态影响，不保证绝对准确、连续或无中断。\n2. 用户不得利用平台从事违法违规、侵权、恶意攻击、批量滥用、绕过计费、传播恶意内容或损害平台及第三方权益的行为。\n3. 涉及文件、工具执行、浏览器操作、设备调用等能力时，用户应自行确认任务目标、系统权限与潜在影响，并承担由主动操作产生的后果。\n4. 输出内容仅供参考，用户应结合具体场景自行判断，不应在未经核验的情况下直接用于高风险决策。\n5. 如用户存在账号共享、自动化刷量、恶意并发、逆向接口或其他破坏服务稳定性的行为，平台有权限制、暂停或终止服务。\n6. 平台可根据产品演进、技术变化或合规要求更新本协议，更新后继续使用即视为接受新的协议内容。`,
  };
}

function resolveAssetUrl(rawAssets, candidates, fallback = '') {
  for (const candidate of candidates) {
    const raw = rawAssets[candidate];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
    const nested = asObject(raw);
    const url = trimString(nested.url || nested.publicUrl || nested.public_url || nested.src);
    if (url) {
      return url;
    }
  }
  return fallback;
}

function defaultSiteShell(runtimeBrand, templateKey) {
  const isWealth = templateKey === 'wealth-premium';
  return {
    themeKey: isWealth ? 'wealth-gold' : 'classic-default',
    header: {
      enabled: true,
      variant: isWealth ? 'finance-header' : 'default-header',
      props: {
        brandLabel: runtimeBrand.website.brandLabel || runtimeBrand.displayName,
        primaryCta: {
          label: runtimeBrand.website.topCtaLabel || '下载',
          href: '#download',
        },
        navItems: isWealth
          ? [
              {label: '核心能力', href: '#capabilities'},
              {label: '适用场景', href: '#scenes'},
              {label: '安全合规', href: '#security'},
            ]
          : [],
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
              {label: runtimeBrand.website.downloadTitle || '下载', href: '#download'},
            ],
          },
        ],
        legalLinks: [
          {label: '隐私政策', href: '/privacy'},
          {label: '用户协议', href: '/terms'},
        ],
        copyrightText: `© ${new Date().getFullYear()} ${runtimeBrand.displayName}`,
      },
    },
  };
}

function defaultPages(runtimeBrand, templateKey) {
  const isWealth = templateKey === 'wealth-premium';
  const legalPages = defaultLegalPageContent(runtimeBrand);
  return [
    {
      pageKey: 'home',
      path: '/',
      enabled: true,
      seo: {
        title: runtimeBrand.website.homeTitle,
        description: runtimeBrand.website.metaDescription,
      },
      blocks: isWealth
        ? [
            {blockKey: 'hero.wealth', enabled: true, sortOrder: 10, props: {}},
            {blockKey: 'download-grid.finance', enabled: true, sortOrder: 20, props: {}},
            {blockKey: 'feature-cards.wealth', enabled: true, sortOrder: 30, props: {}},
            {blockKey: 'scenario-cards.wealth', enabled: true, sortOrder: 40, props: {}},
            {blockKey: 'workflow-steps.wealth', enabled: true, sortOrder: 50, props: {}},
            {blockKey: 'capability-grid.wealth', enabled: true, sortOrder: 60, props: {}},
            {blockKey: 'security-badges.finance', enabled: true, sortOrder: 70, props: {}},
            {blockKey: 'cta-banner.finance', enabled: true, sortOrder: 80, props: {}},
          ]
        : [
            {blockKey: 'hero.basic', enabled: true, sortOrder: 10, props: {}},
            {blockKey: 'download-grid.classic', enabled: true, sortOrder: 20, props: {}},
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
  ];
}

function mergePages(defaultValue, ...sources) {
  const pageMap = new Map(asArray(defaultValue).map((page) => [trimString(asObject(page).pageKey), page]));
  for (const source of sources) {
    for (const page of asArray(source)) {
      const entry = asObject(page);
      const pageKey = trimString(entry.pageKey);
      if (!pageKey) continue;
      const existing = asObject(pageMap.get(pageKey));
      pageMap.set(pageKey, {
        ...existing,
        ...entry,
        seo: deepMerge(existing.seo, entry.seo),
        blocks: asArray(entry.blocks).length > 0 ? asArray(entry.blocks) : asArray(existing.blocks),
      });
    }
  }
  return Array.from(pageMap.values());
}

function normalizeLegacyWebsite(base, payload) {
  const rootConfig = asObject(payload?.config);
  const surfaceConfig = asObject(payload?.surfaceConfig);
  return {
    ...base.website,
    ...asObject(rootConfig.website),
    ...asObject(surfaceConfig.website),
  };
}

function normalizeFlatAssets(base, payload) {
  const rootConfig = asObject(payload?.config);
  const surfaceConfig = asObject(payload?.surfaceConfig);
  const rootAssets = asObject(rootConfig.assets);
  const surfaceAssets = asObject(surfaceConfig.assets);
  return {
    ...base.assets,
    ...Object.fromEntries(Object.entries(surfaceAssets).filter(([, value]) => typeof value === 'string')),
    faviconPngSrc: resolveAssetUrl({...rootAssets, ...surfaceAssets}, ['faviconPngSrc', 'faviconPng'], base.assets.faviconPngSrc),
    appleTouchIconSrc: resolveAssetUrl(
      {...rootAssets, ...surfaceAssets},
      ['appleTouchIconSrc', 'appleTouchIcon'],
      base.assets.appleTouchIconSrc,
    ),
    logoSrc: resolveAssetUrl({...rootAssets, ...surfaceAssets}, ['logoSrc', 'homeLogo', 'logoMaster'], base.assets.logoSrc),
    installerHeroSrc: resolveAssetUrl(
      {...rootAssets, ...surfaceAssets},
      ['installerHeroSrc', 'installerHero'],
      base.assets.installerHeroSrc,
    ),
    logoMasterSrc: resolveAssetUrl({...rootAssets, ...surfaceAssets}, ['logoMasterSrc', 'logoMaster'], base.assets.logoMasterSrc),
    heroArtSrc: resolveAssetUrl({...rootAssets, ...surfaceAssets}, ['heroArtSrc', 'homeHeroArt'], base.assets.heroArtSrc),
    heroLayer1Src: resolveAssetUrl(
      {...rootAssets, ...surfaceAssets},
      ['heroLayer1Src', 'homeHeroLayer1'],
      base.assets.heroLayer1Src,
    ),
    heroLayer2Src: resolveAssetUrl(
      {...rootAssets, ...surfaceAssets},
      ['heroLayer2Src', 'homeHeroLayer2'],
      base.assets.heroLayer2Src,
    ),
    heroPhotoSrc: resolveAssetUrl({...rootAssets, ...surfaceAssets}, ['heroPhotoSrc', 'homeHeroPhoto'], base.assets.heroPhotoSrc),
  };
}

export function normalizeRuntimeBrand(base, payload) {
  const rootConfig = asObject(payload?.config);
  const surfaceConfig = asObject(payload?.surfaceConfig);
  const rootMarketing = asObject(rootConfig.marketingSite);
  const surfaceMarketing = asObject(surfaceConfig.marketingSite);
  const website = normalizeLegacyWebsite(base, payload);
  const assets = normalizeFlatAssets(base, payload);
  const distribution = deepMerge(base.distribution, asObject(rootConfig.distribution), asObject(surfaceConfig.distribution));
  const release = {
    ...base.release,
    publishedVersion: payload?.publishedVersion || base.release.publishedVersion || 0,
  };
  const runtimeBrand = {
    ...base,
    brandId: trimString(payload?.app?.appName || payload?.brand?.brandId) || base.brandId,
    displayName: trimString(payload?.brand?.displayName || payload?.app?.displayName) || base.displayName,
    website,
    assets,
    distribution,
    release,
  };

  const templateKey = normalizeTemplateKey(
    surfaceConfig.templateKey ||
      surfaceMarketing.templateKey ||
      rootConfig.templateKey ||
      rootMarketing.templateKey ||
      asObject(base.marketingSite).templateKey,
    runtimeBrand.brandId,
  );

  const defaultShell = defaultSiteShell(runtimeBrand, templateKey);
  const siteShell = deepMerge(
    defaultShell,
    asObject(asObject(base.marketingSite).siteShell),
    asObject(rootMarketing.siteShell),
    asObject(rootConfig.siteShell),
    asObject(surfaceMarketing.siteShell),
    asObject(surfaceConfig.siteShell),
  );

  const pages = mergePages(
    defaultPages(runtimeBrand, templateKey),
    asObject(base.marketingSite).pages,
    rootMarketing.pages,
    rootConfig.pages,
    surfaceMarketing.pages,
    surfaceConfig.pages,
  );

  return {
    ...runtimeBrand,
    marketingSite: {
      templateKey,
      siteShell,
      pages,
    },
  };
}
