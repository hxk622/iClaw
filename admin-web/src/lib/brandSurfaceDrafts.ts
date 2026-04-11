import { asObject, stringValue } from './adminApi';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asStringArray(value: unknown): string[] {
  return asArray<unknown>(value).map((item) => String(item || '').trim()).filter(Boolean);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function splitLines(value: unknown) {
  return String(value || '')
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLinkItem(value: unknown, fallbackLabel = '', fallbackHref = '#') {
  const item = asObject(value);
  return {
    label: String(item.label || fallbackLabel).trim(),
    href: String(item.href || fallbackHref).trim() || fallbackHref,
  };
}

function formatLabelHrefLines(items: unknown[]) {
  return asArray<unknown>(items)
    .map((item) => {
      const entry = normalizeLinkItem(item);
      if (!entry.label && !entry.href) {
        return '';
      }
      return `${entry.label}|${entry.href}`;
    })
    .filter(Boolean)
    .join('\n');
}

function normalizeBlockItem(value: unknown, fallbackKey: string, fallbackSortOrder: number, fallbackProps: Record<string, unknown> = {}) {
  const item = asObject(value);
  return {
    blockKey: String(item.blockKey || fallbackKey).trim() || fallbackKey,
    enabled: item.enabled !== false,
    sortOrder: Number(item.sortOrder || fallbackSortOrder) || fallbackSortOrder,
    props: {
      ...clone(fallbackProps),
      ...clone(asObject(item.props)),
    },
  };
}

function normalizeBlockList(items: unknown, fallbackItems: Array<Record<string, unknown>>) {
  const source = asArray<Record<string, unknown>>(items);
  if (!source.length) {
    return fallbackItems.map((item, index) =>
      normalizeBlockItem(item, stringValue(item.blockKey), Number(item.sortOrder || (index + 1) * 10), asObject(item.props)),
    );
  }
  return source
    .map((item, index) =>
      normalizeBlockItem(
        item,
        stringValue(asObject(item).blockKey) || `block-${index + 1}`,
        Number(asObject(item).sortOrder || (index + 1) * 10),
        asObject(asObject(item).props),
      ),
    )
    .sort((left, right) => left.sortOrder - right.sortOrder || left.blockKey.localeCompare(right.blockKey, 'zh-CN'));
}

function findMarketingPage(config: Record<string, unknown>, pageKey: string) {
  return asArray<Record<string, unknown>>(config.pages).find((item) => stringValue(asObject(item).pageKey) === pageKey) || null;
}

function findMarketingBlock(page: unknown, blockPrefix: string) {
  return normalizeBlockList(asObject(page).blocks, []).find((item) => stringValue(item.blockKey).startsWith(blockPrefix)) || null;
}

const DEFAULT_WELCOME_QUICK_ACTIONS = [
  {
    label: '市场行情分析',
    prompt: '帮我分析一下当前市场形势，有哪些值得关注的板块和投资机会？',
    iconKey: 'TrendingUp',
  },
  {
    label: '投资组合诊断',
    prompt: '帮我分析我的投资组合，看看是否需要调整配置？',
    iconKey: 'PieChart',
  },
  {
    label: '个股深度研究',
    prompt: '我想了解某个公司的投资价值，能帮我做个深度分析吗？',
    iconKey: 'Search',
  },
  {
    label: '投资策略咨询',
    prompt: '基于当前市场环境，给我一些长期投资的建议。',
    iconKey: 'Lightbulb',
  },
];

const DEFAULT_WELCOME_SURFACE_CONFIG = {
  entryLabel: '面向粉丝开放的 K2C 服务入口',
  kolName: '陈雪',
  expertName: '陈雪的投资智囊',
  slogan: '用价值投资思维，陪你穿越市场周期',
  avatarUrl: '',
  backgroundImageUrl: '',
  primaryColor: '#C4975F',
  description: '我会用我 10 年的投资框架和市场洞察，帮你理解复杂的金融市场，找到适合你的投资路径。',
  expertiseAreas: ['价值投资', '资产配置', '长期持有策略', '市场周期分析'],
  targetAudience: '希望建立长期投资思维的理性投资者。',
  disclaimer: '本智囊提供的所有信息仅供学习参考，不构成投资建议。投资有风险，决策需谨慎。',
  quickActions: DEFAULT_WELCOME_QUICK_ACTIONS,
};

const DEFAULT_HEADER_QUOTES = [
  { label: '沪深300', value: '3,942.18', change: 0.86, changePercent: '+0.86%' },
  { label: '深证成指', value: '11,248.72', change: -0.42, changePercent: '-0.42%' },
  { label: '银行指数', value: '5,184.33', change: 0.57, changePercent: '+0.57%' },
  { label: '现货黄金', value: '2,184.60', change: 0.34, changePercent: '+0.34%' },
];

const DEFAULT_HEADER_HEADLINES = [
  { title: '央国企红利与低波资产继续受到中长期资金关注', source: '策略晨会', href: '' },
  { title: 'TMT 交易拥挤度回升，成长风格短线波动可能放大', source: '市场监控', href: '' },
  { title: '组合回撤预警、仓位管理与再平衡建议已接入顶部策略栏', source: '系统提示', href: '' },
];

const DEFAULT_HEADER_SURFACE_CONFIG = {
  statusLabel: '市场概览',
  liveStatusLabel: '实时更新',
  showLiveBadge: true,
  showQuotes: true,
  showHeadlines: true,
  showSecurityBadge: true,
  securityLabel: '安全防护中',
  showCredits: true,
  showRechargeButton: true,
  rechargeLabel: '充值中心',
  showModeBadge: true,
  modeBadgeLabel: '脉搏模式',
  fallbackQuotes: DEFAULT_HEADER_QUOTES,
  fallbackHeadlines: DEFAULT_HEADER_HEADLINES,
};

const DEFAULT_SIDEBAR_SURFACE_CONFIG = {
  variant: 'default',
  brandBlock: {
    title: 'iClaw',
    subtitle: '',
  },
  layout: {
    sectionStyle: 'default',
    emphasizeActiveItem: true,
  },
};

const DEFAULT_DESKTOP_SHELL_CONFIG = {
  websiteTitle: 'iClaw',
  devWebsiteTitle: 'iClaw-dev',
  sidebarTitle: 'iClaw',
  devSidebarTitle: 'iClaw-dev',
  sidebarSubtitle: '',
  legalName: 'iClaw',
  bundleIdentifier: 'ai.iclaw.desktop',
  authService: 'ai.iclaw.desktop',
};

const DEFAULT_INPUT_SURFACE_CONFIG = {
  placeholderText: '输入研究问题，@专家，或选择下方财经快捷模板...',
};

const AUTH_AGREEMENT_ORDER = ['service', 'privacy', 'billing'];
const AUTH_AGREEMENT_LABELS: Record<string, string> = {
  service: '服务协议',
  privacy: '隐私说明',
  billing: '龙虾币计费规则',
};

function buildDefaultAuthExperiencePreset(brandId: string, displayName: string, legalName: string) {
  const normalizedBrandId = String(brandId || '').trim().toLowerCase();
  const productLabel = String(displayName || brandId || '本产品').trim() || '本产品';
  const legalEntity = String(legalName || displayName || brandId || '本产品').trim() || '本产品';
  const socialNotice = '微信和 Gmail 登录暂未开放，请先使用账号密码登录。';

  if (normalizedBrandId === 'licaiclaw') {
    return {
      title: '登录后继续使用理财研究与额度体系',
      subtitle: `${productLabel} 面向财富管理、基金投顾与长期配置场景，协议文案会更强调信息披露、风险揭示与用户自主决策。`,
      socialNotice,
      agreements: [
        {
          key: 'service',
          title: `${productLabel}服务协议`,
          version: 'v2026.04',
          effectiveDate: '2026-04-04',
          summary: '适用于财富管理、基金投顾与金融研究类桌面 AI 服务。',
          content: `${legalEntity}向用户提供 ${productLabel} 桌面端、研究工具、模型问答与相关增值能力。用户在使用前，应确认自己具备相应的民事行为能力，并保证注册资料真实、完整、可验证。\n\n1. ${productLabel} 提供的信息、分析、摘要、研报辅助、组合观察、基金与股票数据解释，仅供研究参考，不构成投资建议、收益承诺或适当性匹配结论。\n2. 用户应基于自身风险承受能力、投资期限、流动性需求和合规要求，独立作出投资决策，并自行承担由此产生的结果。\n3. 未经 ${legalEntity} 书面许可，用户不得将平台内容用于非法证券咨询、违规荐股、误导性营销、代客理财或其他违法违规用途。\n4. 平台可能接入第三方模型、行情、基金、资讯或工具服务，相关结果受上游时效、稳定性和数据口径限制影响，不保证持续可用、完全准确或绝对实时。\n5. 如用户存在异常刷量、接口滥用、账号转借、恶意抓取、利用平台开展违规金融活动等行为，${legalEntity} 有权限制功能、冻结额度或终止服务。\n6. ${legalEntity} 有权基于产品演进、合规要求或监管变化更新本协议。继续使用 ${productLabel} 即视为接受更新后的协议内容。`,
        },
        {
          key: 'privacy',
          title: `${productLabel}隐私说明`,
          version: 'v2026.04',
          effectiveDate: '2026-04-04',
          summary: '重点覆盖账户信息、研究输入、投资偏好与行为日志的处理方式。',
          content: `${legalEntity} 重视用户隐私与数据安全。为提供 ${productLabel} 服务，我们会在最小必要范围内处理账号信息、设备信息、操作日志、充值记录，以及用户主动提交的研究问题、标的代码、基金列表、组合偏好和自定义策略信息。\n\n1. 账号信息主要用于身份识别、登录鉴权、额度结算、风险控制和客服支持。\n2. 用户输入的研究问题、筛选条件、观察清单与相关上下文，可能用于生成答案、恢复会话、展示历史记录以及改进交互体验。\n3. 若某项能力需要调用第三方模型、支付、消息通知或数据服务，相关必要字段会在任务执行范围内传输给对应服务提供方。\n4. 我们不会因平台商业宣传目的擅自公开用户的账户资产、持仓、观察列表或个性化研究偏好。\n5. 我们会采取访问控制、日志审计、环境隔离与密钥管理等措施保护数据安全，但仍提醒用户避免在平台内提交超出使用目的的敏感个人信息。\n6. 用户可申请查询、导出、更正或删除与账户相关的数据；如法律法规或监管要求另有规定，我们将在符合法定义务范围内处理。`,
        },
        {
          key: 'billing',
          title: `${productLabel}龙虾币计费规则`,
          version: 'v2026.04',
          effectiveDate: '2026-04-04',
          summary: '说明日免费额度、充值额度、结算时点与异常处理规则。',
          content: `${productLabel} 采用龙虾币额度体系。用户可通过平台赠送额度、日免费额度或充值额度使用模型问答、金融数据与工具能力。\n\n1. 每次调用的实际扣费以后端结算结果为准，不同模型、工具链、行情数据或研究任务可能适用不同倍数与成本口径。\n2. 页面上的预估消耗、模型倍数、套餐文案仅作参考，最终以任务完成后的真实 usage 与结算明细为准。\n3. 平台赠送额度、日免费额度与充值额度可能具有不同的优先级、有效期与重置规则，具体以当日账户显示为准。\n4. 因用户主动发起的任务、批量研究、长文本处理、工具调用或高成本模型使用所产生的额度消耗，原则上不支持撤销或回退；法律另有规定或平台自身故障导致的异常扣费除外。\n5. 若用户存在恶意套利、批量刷量、绕过限制、支付异常或退款滥用等行为，${legalEntity} 有权暂停额度结算、冻结账户功能并追究相应责任。`,
        },
      ],
    };
  }

  return {
    title: '登录后继续使用账户与额度体系',
    subtitle: `${productLabel} 面向更通用的本地 AI 助手与工作台场景，协议文案会更强调通用能力、账户安全与本地运行体验。`,
    socialNotice,
    agreements: [
      {
        key: 'service',
        title: `${productLabel}服务协议`,
        version: 'v2026.04',
        effectiveDate: '2026-04-04',
        summary: '适用于通用桌面 AI 客户端、问答、工具执行与本地运行场景。',
        content: `${legalEntity} 向用户提供 ${productLabel} 桌面端、AI 问答、工具执行、内容处理与配套账户服务。用户应保证注册资料真实、完整、可联系，并妥善保管账号、密码与本地设备环境。\n\n1. ${productLabel} 可调用本地运行时、第三方模型、云端接口或工具服务，回答结果受模型能力、上下文、外部依赖与网络状态影响，不保证绝对准确、连续或无中断。\n2. 用户不得利用平台从事违法违规、侵权、恶意攻击、批量滥用、绕过计费、传播恶意内容或损害平台及第三方权益的行为。\n3. 涉及文件、工具执行、浏览器操作、设备调用等能力时，用户应自行确认任务目标、系统权限与潜在影响，并承担由主动操作产生的后果。\n4. ${productLabel} 输出内容仅供参考，用户应结合具体场景自行判断，不应在未经核验的情况下直接用于高风险决策。\n5. 如用户存在账号共享、自动化刷量、恶意并发、逆向接口或其他破坏服务稳定性的行为，${legalEntity} 有权限制、暂停或终止服务。\n6. ${legalEntity} 可根据产品演进、技术变化或合规要求更新本协议，更新后继续使用即视为接受新的协议内容。`,
      },
      {
        key: 'privacy',
        title: `${productLabel}隐私说明`,
        version: 'v2026.04',
        effectiveDate: '2026-04-04',
        summary: '重点覆盖账号、设备、会话、文件与运行日志数据的处理方式。',
        content: `${legalEntity} 会在提供 ${productLabel} 服务所需的最小范围内处理用户信息，包括账号资料、设备信息、登录日志、充值记录、会话内容、文件元数据与必要的运行诊断数据。\n\n1. 账号与设备信息主要用于身份认证、安全校验、额度结算、异常排查与客服支持。\n2. 用户主动输入的问题、上传的文件、选择的工具与会话记录，可能用于任务执行、历史恢复和界面展示。\n3. 当某项能力需要调用第三方模型、存储、支付或消息服务时，完成任务所必需的信息会在相应范围内传输给合作服务提供方。\n4. 平台默认不会将用户内容公开展示，也不会在超出服务目的的情况下向无关第三方出售用户数据。\n5. 我们会采取权限控制、密钥隔离、日志审计与存储保护等措施保障安全，但请用户避免上传与当前任务无关的高度敏感信息。\n6. 用户可就其账户信息提出查询、更正、导出或删除请求；如需履行法律法规义务，我们将在法定范围内保留必要记录。`,
      },
      {
        key: 'billing',
        title: `${productLabel}龙虾币计费规则`,
        version: 'v2026.04',
        effectiveDate: '2026-04-04',
        summary: '说明通用 AI 使用额度、模型倍数、预估与结算规则。',
        content: `${productLabel} 通过龙虾币额度提供模型问答、工具调用与相关增值能力。用户的实际消耗以后端结算记录为准。\n\n1. 不同模型、上下文长度、输出长度、工具调用链路与外部服务成本，可能对应不同计费倍数或额度消耗。\n2. 页面上的预估值用于帮助用户理解大致成本，但不构成最终结算承诺；任务完成后展示的结算结果才是正式扣费依据。\n3. 日免费额度、赠送额度与充值额度可能具有不同的使用顺序、重置周期和有效期，具体以账户显示为准。\n4. 因用户主动发起的正常请求所产生的消耗，原则上不支持撤销；若因平台故障、重复结算或系统异常导致错误扣费，平台会按规则核实处理。\n5. 若用户存在恶意刷量、规避限制、退款滥用、支付异常或其他损害平台利益的行为，${legalEntity} 有权暂停结算、冻结账户或采取进一步风控措施。`,
      },
    ],
  };
}

function buildDefaultMarketingLegalPageContent(brandId: string, displayName: string, legalName: string) {
  const preset = buildDefaultAuthExperiencePreset(brandId, displayName, legalName);
  const serviceAgreement = preset.agreements.find((item) => item.key === 'service');
  const privacyAgreement = preset.agreements.find((item) => item.key === 'privacy');
  return {
    privacyTitle: '隐私政策',
    privacyContent: String(privacyAgreement?.content || '').trim(),
    termsTitle: '用户协议',
    termsContent: String(serviceAgreement?.content || '').trim(),
  };
}

const DEFAULT_HOME_WEB_SURFACE_CONFIG = {
  templateKey: 'classic-download',
  siteShell: {
    header: {
      enabled: true,
      variant: 'default-header',
      props: {
        brandLabel: 'iClaw',
        subline: 'Official Website',
        navItems: [],
        primaryCta: {
          label: '下载',
          href: '#download',
        },
      },
    },
    footer: {
      enabled: true,
      variant: 'default-footer',
      props: {
        columns: [
          {
            title: '站点',
            links: [
              { label: '首页', href: '/' },
              { label: '下载', href: '#download' },
            ],
          },
        ],
        legalLinks: [
          { label: '隐私政策', href: '/privacy' },
          { label: '用户协议', href: '/terms' },
        ],
        copyrightText: '© 2026 iClaw',
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
        title: 'iClaw 官网',
        description: 'iClaw 官网，面向普通用户的本地 AI 客户端。',
      },
      blocks: [
        {
          blockKey: 'hero.basic',
          enabled: true,
          sortOrder: 10,
          props: {
            eyebrow: 'Official Website',
            titlePre: '让AI真正像软件一样',
            titleMain: '装上就能用！',
            description: 'iClaw 面向普通用户设计。少一点配置，多一点结果。打开、提问、执行、拿答案。',
          },
        },
        {
          blockKey: 'download-grid.classic',
          enabled: true,
          sortOrder: 20,
          props: {
            title: '下载 iClaw',
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
            title: '隐私政策',
            content: buildDefaultMarketingLegalPageContent('iclaw', 'iClaw', 'iClaw').privacyContent,
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
            title: '用户协议',
            content: buildDefaultMarketingLegalPageContent('iclaw', 'iClaw', 'iClaw').termsContent,
          },
        },
      ],
    },
  ],
};

function buildDefaultHomeWebSurfaceConfig(context: { brandId?: string; displayName?: string } = {}) {
  const brandId = String(context.brandId || '').trim();
  const displayName = String(context.displayName || '').trim() || 'iClaw';
  const isWealth = brandId === 'licaiclaw';
  const legalPages = buildDefaultMarketingLegalPageContent(brandId || 'iclaw', displayName, displayName);
  return {
    ...clone(DEFAULT_HOME_WEB_SURFACE_CONFIG),
    templateKey: isWealth ? 'wealth-premium' : DEFAULT_HOME_WEB_SURFACE_CONFIG.templateKey,
    siteShell: {
      ...clone(DEFAULT_HOME_WEB_SURFACE_CONFIG.siteShell),
      header: {
        ...clone(DEFAULT_HOME_WEB_SURFACE_CONFIG.siteShell.header),
        variant: isWealth ? 'finance-header' : DEFAULT_HOME_WEB_SURFACE_CONFIG.siteShell.header.variant,
        props: {
          ...clone(DEFAULT_HOME_WEB_SURFACE_CONFIG.siteShell.header.props),
          brandLabel: displayName,
        },
      },
      footer: {
        ...clone(DEFAULT_HOME_WEB_SURFACE_CONFIG.siteShell.footer),
        variant: isWealth ? 'finance-legal-footer' : DEFAULT_HOME_WEB_SURFACE_CONFIG.siteShell.footer.variant,
        props: {
          ...clone(DEFAULT_HOME_WEB_SURFACE_CONFIG.siteShell.footer.props),
          copyrightText: `© 2026 ${displayName}`,
        },
      },
    },
    pages: clone(DEFAULT_HOME_WEB_SURFACE_CONFIG.pages).map((page: Record<string, unknown>) => {
      const nextPage = clone(page);
      if (stringValue(page.pageKey) === 'privacy') {
        asArray<Record<string, unknown>>(nextPage.blocks)[0].props = {
          ...asObject(asArray<Record<string, unknown>>(nextPage.blocks)[0]?.props),
          title: legalPages.privacyTitle,
          content: legalPages.privacyContent,
        };
        return nextPage;
      }
      if (stringValue(page.pageKey) === 'terms') {
        asArray<Record<string, unknown>>(nextPage.blocks)[0].props = {
          ...asObject(asArray<Record<string, unknown>>(nextPage.blocks)[0]?.props),
          title: legalPages.termsTitle,
          content: legalPages.termsContent,
        };
        return nextPage;
      }
      asObject(nextPage.seo).title = `${displayName} 官网`;
      asObject(nextPage.seo).description = `${displayName} 官网，面向${isWealth ? '财富管理' : '普通用户'}场景的本地 AI 客户端。`;
      asArray<Record<string, unknown>>(nextPage.blocks)[0].blockKey = isWealth ? 'hero.wealth' : stringValue(asArray<Record<string, unknown>>(nextPage.blocks)[0]?.blockKey);
      asObject(asArray<Record<string, unknown>>(nextPage.blocks)[0]?.props).titlePre = isWealth ? '把 AI 装进你的财富工作流' : stringValue(asObject(asArray<Record<string, unknown>>(nextPage.blocks)[0]?.props).titlePre);
      asObject(asArray<Record<string, unknown>>(nextPage.blocks)[0]?.props).titleMain = isWealth ? '打开就能干活' : stringValue(asObject(asArray<Record<string, unknown>>(nextPage.blocks)[0]?.props).titleMain);
      asObject(asArray<Record<string, unknown>>(nextPage.blocks)[0]?.props).description = isWealth
        ? `${displayName} 面向财富管理场景设计。少一点配置，多一点交付。`
        : stringValue(asObject(asArray<Record<string, unknown>>(nextPage.blocks)[0]?.props).description);
      asArray<Record<string, unknown>>(nextPage.blocks)[1].blockKey = isWealth ? 'download-grid.finance' : stringValue(asArray<Record<string, unknown>>(nextPage.blocks)[1]?.blockKey);
      asObject(asArray<Record<string, unknown>>(nextPage.blocks)[1]?.props).title = `下载 ${displayName}`;
      return nextPage;
    }),
  };
}

function deriveWebsiteFromMarketingState(input: {
  defaults?: Record<string, unknown>;
  context?: { displayName?: string; brandId?: string };
  siteShell?: Record<string, unknown>;
  pages?: Array<Record<string, unknown>>;
}) {
  const defaults = asObject(input.defaults);
  const context = input.context || {};
  const displayName = String(context.displayName || '').trim() || 'iClaw';
  const brandId = String(context.brandId || '').trim();
  const isWealth = brandId === 'licaiclaw';
  const siteShell = asObject(input.siteShell);
  const pages = Array.isArray(input.pages) ? input.pages : [];
  const header = asObject(siteShell.header);
  const headerProps = asObject(header.props);
  const defaultPages = asArray<Record<string, unknown>>(defaults.pages);
  const defaultHomePage = asObject(defaultPages[0]);
  const defaultHeader = asObject(asObject(defaults.siteShell).header);
  const defaultHeaderProps = asObject(defaultHeader.props);
  const homePage = findMarketingPage({ pages }, 'home') || defaultHomePage;
  const heroBlock =
    findMarketingBlock(homePage, 'hero.') ||
    normalizeBlockItem(asArray<Record<string, unknown>>(defaultHomePage.blocks)[0], 'hero.basic', 10, asObject(asArray<Record<string, unknown>>(defaultHomePage.blocks)[0]?.props));
  const downloadBlock =
    findMarketingBlock(homePage, 'download-grid.') ||
    normalizeBlockItem(asArray<Record<string, unknown>>(defaultHomePage.blocks)[1], 'download-grid.classic', 20, asObject(asArray<Record<string, unknown>>(defaultHomePage.blocks)[1]?.props));

  return {
    homeTitle: String(asObject(homePage.seo).title || `${displayName} 官网`).trim() || `${displayName} 官网`,
    metaDescription:
      String(asObject(homePage.seo).description || `${displayName} 官网，面向${isWealth ? '财富管理' : '普通用户'}场景的本地 AI 客户端。`).trim() ||
      `${displayName} 官网`,
    brandLabel: String(headerProps.brandLabel || displayName).trim() || displayName,
    kicker: String(asObject(heroBlock.props).eyebrow || defaultHeaderProps.subline).trim() || stringValue(defaultHeaderProps.subline),
    heroTitlePre: String(asObject(heroBlock.props).titlePre || asObject(asArray<Record<string, unknown>>(defaultHomePage.blocks)[0]?.props).titlePre).trim(),
    heroTitleMain: String(asObject(heroBlock.props).titleMain || asObject(asArray<Record<string, unknown>>(defaultHomePage.blocks)[0]?.props).titleMain).trim(),
    heroDescription: String(asObject(heroBlock.props).description || asObject(asArray<Record<string, unknown>>(defaultHomePage.blocks)[0]?.props).description).trim(),
    topCtaLabel: String(asObject(headerProps.primaryCta).label || asObject(defaultHeaderProps.primaryCta).label).trim(),
    downloadTitle: String(asObject(downloadBlock.props).title || `下载 ${displayName}`).trim() || `下载 ${displayName}`,
  };
}

function normalizeBlockPages(
  config: Record<string, unknown>,
  marketingSite: Record<string, unknown>,
  website: Record<string, unknown>,
  templateKey: string,
  defaults: { templateKey: string; siteShell: Record<string, unknown>; pages: Array<Record<string, unknown>> } = DEFAULT_HOME_WEB_SURFACE_CONFIG as unknown as { templateKey: string; siteShell: Record<string, unknown>; pages: Array<Record<string, unknown>> },
) {
  const sourcePages = Array.isArray(config.pages)
    ? config.pages
    : Array.isArray(marketingSite.pages)
      ? marketingSite.pages
      : [];
  if (sourcePages.length) {
    return sourcePages.map((item) => clone(asObject(item)));
  }
  const isWealth = templateKey === 'wealth-premium';
  const base = clone(defaults.pages);
  asObject(base[0].seo).title = stringValue(website.homeTitle || asObject(base[0].seo).title);
  asObject(base[0].seo).description = stringValue(website.metaDescription || asObject(base[0].seo).description);
  asArray<Record<string, unknown>>(base[0].blocks)[0].blockKey = isWealth ? 'hero.wealth' : stringValue(asArray<Record<string, unknown>>(base[0].blocks)[0].blockKey);
  asObject(asArray<Record<string, unknown>>(base[0].blocks)[0].props).eyebrow = stringValue(website.kicker || asObject(asArray<Record<string, unknown>>(base[0].blocks)[0].props).eyebrow);
  asObject(asArray<Record<string, unknown>>(base[0].blocks)[0].props).titlePre = stringValue(website.heroTitlePre || asObject(asArray<Record<string, unknown>>(base[0].blocks)[0].props).titlePre);
  asObject(asArray<Record<string, unknown>>(base[0].blocks)[0].props).titleMain = stringValue(website.heroTitleMain || asObject(asArray<Record<string, unknown>>(base[0].blocks)[0].props).titleMain);
  asObject(asArray<Record<string, unknown>>(base[0].blocks)[0].props).description = stringValue(website.heroDescription || asObject(asArray<Record<string, unknown>>(base[0].blocks)[0].props).description);
  asArray<Record<string, unknown>>(base[0].blocks)[1].blockKey = isWealth ? 'download-grid.finance' : stringValue(asArray<Record<string, unknown>>(base[0].blocks)[1].blockKey);
  asObject(asArray<Record<string, unknown>>(base[0].blocks)[1].props).title = stringValue(website.downloadTitle || asObject(asArray<Record<string, unknown>>(base[0].blocks)[1].props).title);
  return base;
}

function normalizeAuthAgreementDraft(value: unknown, fallback: unknown) {
  const raw = asObject(value);
  const defaults = asObject(fallback);
  const key = String(raw.key || defaults.key || '').trim();
  return {
    key,
    title: String(raw.title || defaults.title || AUTH_AGREEMENT_LABELS[key] || '').trim(),
    version: String(raw.version || defaults.version || '').trim(),
    effectiveDate: String(raw.effective_date || raw.effectiveDate || defaults.effectiveDate || defaults.effective_date || '').trim(),
    summary: String(raw.summary || defaults.summary || '').trim(),
    content: String(raw.content || defaults.content || '').trim(),
  };
}

function normalizeWelcomeQuickAction(value: unknown, index = 0) {
  const raw = asObject(value);
  return {
    label: String(raw.label || DEFAULT_WELCOME_QUICK_ACTIONS[index]?.label || '').trim(),
    prompt: String(raw.prompt || DEFAULT_WELCOME_QUICK_ACTIONS[index]?.prompt || '').trim(),
    iconKey: String(raw.icon_key || raw.iconKey || raw.icon || DEFAULT_WELCOME_QUICK_ACTIONS[index]?.iconKey || '').trim(),
  };
}

function normalizeHeaderQuoteDraft(value: unknown, index = 0) {
  const raw = asObject(value);
  const defaults = DEFAULT_HEADER_QUOTES[index] || DEFAULT_HEADER_QUOTES[DEFAULT_HEADER_QUOTES.length - 1] || { label: '', value: '--', change: 0, changePercent: '' };
  const changeValue =
    typeof raw.change === 'number'
      ? raw.change
      : typeof raw.change === 'string' && raw.change.trim()
        ? Number(raw.change.trim().replace(/%$/, ''))
        : typeof defaults.change === 'number'
          ? defaults.change
          : 0;
  const numericChange = Number.isFinite(changeValue) ? changeValue : 0;
  return {
    label: String(raw.label || defaults.label || '').trim(),
    value: String(raw.value || defaults.value || '--').trim() || '--',
    change: numericChange,
    changePercent:
      String(raw.change_percent || raw.changePercent || '').trim() ||
      `${numericChange > 0 ? '+' : ''}${numericChange.toFixed(2)}%`,
  };
}

function normalizeHeaderHeadlineDraft(value: unknown, index = 0) {
  const raw = asObject(value);
  const defaults =
    DEFAULT_HEADER_HEADLINES[index] || DEFAULT_HEADER_HEADLINES[DEFAULT_HEADER_HEADLINES.length - 1] || { title: '', source: '', href: '' };
  return {
    title: String(raw.title || defaults.title || '').trim(),
    source: String(raw.source || defaults.source || '').trim(),
    href: String(raw.href || raw.url || defaults.href || '').trim(),
  };
}

export function normalizeDesktopShellConfig(value: unknown) {
  const config = asObject(value);
  return {
    websiteTitle: String(config.websiteTitle || config.website_title || DEFAULT_DESKTOP_SHELL_CONFIG.websiteTitle).trim(),
    devWebsiteTitle: String(config.devWebsiteTitle || config.dev_website_title || DEFAULT_DESKTOP_SHELL_CONFIG.devWebsiteTitle).trim(),
    sidebarTitle: String(config.sidebarTitle || config.sidebar_title || DEFAULT_DESKTOP_SHELL_CONFIG.sidebarTitle).trim(),
    devSidebarTitle: String(config.devSidebarTitle || config.dev_sidebar_title || DEFAULT_DESKTOP_SHELL_CONFIG.devSidebarTitle).trim(),
    sidebarSubtitle: String(config.sidebarSubtitle || config.sidebar_subtitle || DEFAULT_DESKTOP_SHELL_CONFIG.sidebarSubtitle).trim(),
    legalName: String(asObject(config.brand_meta).legal_name || config.legalName || config.legal_name || DEFAULT_DESKTOP_SHELL_CONFIG.legalName).trim(),
    bundleIdentifier: String(config.bundleIdentifier || config.bundle_identifier || DEFAULT_DESKTOP_SHELL_CONFIG.bundleIdentifier).trim(),
    authService: String(config.authService || config.auth_service || DEFAULT_DESKTOP_SHELL_CONFIG.authService).trim(),
  };
}

export function normalizeAuthExperienceConfig(
  value: unknown,
  options: { brandId?: string; displayName?: string; legalName?: string } = {},
) {
  const config = asObject(value);
  const preset = buildDefaultAuthExperiencePreset(
    String(options.brandId || ''),
    String(options.displayName || ''),
    String(options.legalName || ''),
  );
  const rawAgreementMap = new Map(
    asArray(config.agreements || config.items)
      .map((item) => normalizeAuthAgreementDraft(item, {}))
      .filter((item) => item.key)
      .map((item) => [item.key, item] as const),
  );
  const fallbackAgreementMap = new Map(
    asArray(preset.agreements)
      .map((item) => normalizeAuthAgreementDraft(item, {}))
      .filter((item) => item.key)
      .map((item) => [item.key, item] as const),
  );
  return {
    title: String(config.title || preset.title || '').trim(),
    subtitle: String(config.subtitle || preset.subtitle || '').trim(),
    socialNotice: String(config.social_notice || config.socialNotice || preset.socialNotice || '').trim(),
    agreements: AUTH_AGREEMENT_ORDER.map((key) =>
      normalizeAuthAgreementDraft(rawAgreementMap.get(key), fallbackAgreementMap.get(key) || { key, title: AUTH_AGREEMENT_LABELS[key] }),
    ),
  };
}

export function normalizeWelcomeSurfaceConfig(value: unknown) {
  const config = asObject(value);
  const areas = asStringArray(config.expertise_areas || config.expertiseAreas);
  const quickActions = asArray(config.quick_actions || config.quickActions)
    .map((item, index) => normalizeWelcomeQuickAction(item, index))
    .filter((item) => item.label || item.prompt || item.iconKey);

  return {
    entryLabel: String(config.entry_label || config.entryLabel || DEFAULT_WELCOME_SURFACE_CONFIG.entryLabel).trim(),
    kolName: String(config.kol_name || config.kolName || DEFAULT_WELCOME_SURFACE_CONFIG.kolName).trim(),
    expertName: String(config.expert_name || config.expertName || DEFAULT_WELCOME_SURFACE_CONFIG.expertName).trim(),
    slogan: String(config.slogan || DEFAULT_WELCOME_SURFACE_CONFIG.slogan).trim(),
    avatarUrl: String(config.avatar_url || config.avatar || config.avatarUrl || DEFAULT_WELCOME_SURFACE_CONFIG.avatarUrl).trim(),
    backgroundImageUrl: String(config.background_image_url || config.backgroundImageUrl || config.backgroundImage || DEFAULT_WELCOME_SURFACE_CONFIG.backgroundImageUrl).trim(),
    primaryColor: String(config.primary_color || config.primaryColor || DEFAULT_WELCOME_SURFACE_CONFIG.primaryColor).trim(),
    description: String(config.description || DEFAULT_WELCOME_SURFACE_CONFIG.description).trim(),
    expertiseAreas: areas.length ? areas : [...DEFAULT_WELCOME_SURFACE_CONFIG.expertiseAreas],
    targetAudience: String(config.target_audience || config.targetAudience || DEFAULT_WELCOME_SURFACE_CONFIG.targetAudience).trim(),
    disclaimer: String(config.disclaimer || DEFAULT_WELCOME_SURFACE_CONFIG.disclaimer).trim(),
    quickActions: Array.from({ length: 4 }, (_, index) => ({
      ...normalizeWelcomeQuickAction(DEFAULT_WELCOME_QUICK_ACTIONS[index], index),
      ...(quickActions[index] || {}),
    })),
  };
}

export function normalizeHeaderSurfaceConfig(value: unknown) {
  const config = asObject(value);
  const quotes = asArray(config.fallback_quotes ?? config.fallbackQuotes ?? config.quotes)
    .map((item, index) => normalizeHeaderQuoteDraft(item, index))
    .filter((item) => item.label);
  const headlines = asArray(config.fallback_headlines ?? config.fallbackHeadlines ?? config.headlines)
    .map((item, index) => normalizeHeaderHeadlineDraft(item, index))
    .filter((item) => item.title);

  return {
    statusLabel: String(config.status_label || config.statusLabel || config.badge_label || config.badgeLabel || DEFAULT_HEADER_SURFACE_CONFIG.statusLabel).trim(),
    liveStatusLabel: String(config.live_status_label || config.liveStatusLabel || DEFAULT_HEADER_SURFACE_CONFIG.liveStatusLabel).trim(),
    showLiveBadge: config.show_live_badge !== false && config.showLiveBadge !== false,
    showQuotes: config.show_quotes !== false && config.showQuotes !== false,
    showHeadlines: config.show_headlines !== false && config.showHeadlines !== false,
    showSecurityBadge: config.show_security_badge !== false && config.showSecurityBadge !== false,
    securityLabel: String(config.security_label || config.securityLabel || DEFAULT_HEADER_SURFACE_CONFIG.securityLabel).trim(),
    showCredits: config.show_credits !== false && config.showCredits !== false,
    showRechargeButton: config.show_recharge_button !== false && config.showRechargeButton !== false,
    rechargeLabel: String(config.recharge_label || config.rechargeLabel || DEFAULT_HEADER_SURFACE_CONFIG.rechargeLabel).trim(),
    showModeBadge: config.show_mode_badge !== false && config.showModeBadge !== false,
    modeBadgeLabel: String(config.mode_badge_label || config.modeBadgeLabel || DEFAULT_HEADER_SURFACE_CONFIG.modeBadgeLabel).trim(),
    fallbackQuotes: Array.from({ length: 4 }, (_, index) => ({
      ...normalizeHeaderQuoteDraft(DEFAULT_HEADER_QUOTES[index], index),
      ...(quotes[index] || {}),
    })),
    fallbackHeadlines: Array.from({ length: 3 }, (_, index) => ({
      ...normalizeHeaderHeadlineDraft(DEFAULT_HEADER_HEADLINES[index], index),
      ...(headlines[index] || {}),
    })),
  };
}

export function normalizeInputSurfaceConfig(value: unknown) {
  const config = asObject(value);
  return {
    placeholderText: String(
      config.placeholder_text ||
      config.placeholderText ||
      config.composer_placeholder ||
      config.composerPlaceholder ||
      DEFAULT_INPUT_SURFACE_CONFIG.placeholderText,
    ).trim() || DEFAULT_INPUT_SURFACE_CONFIG.placeholderText,
  };
}

export function normalizeSidebarSurfaceConfig(value: unknown) {
  const config = asObject(value);
  const brandBlock = asObject(config.brandBlock || config.brand_block);
  const layout = asObject(config.layout);
  return {
    variant: String(config.variant || DEFAULT_SIDEBAR_SURFACE_CONFIG.variant).trim() || DEFAULT_SIDEBAR_SURFACE_CONFIG.variant,
    brandTitle: String(brandBlock.title || DEFAULT_SIDEBAR_SURFACE_CONFIG.brandBlock.title).trim(),
    brandSubtitle: String(brandBlock.subtitle || DEFAULT_SIDEBAR_SURFACE_CONFIG.brandBlock.subtitle).trim(),
    sectionStyle: String(layout.sectionStyle || layout.section_style || DEFAULT_SIDEBAR_SURFACE_CONFIG.layout.sectionStyle).trim(),
    emphasizeActiveItem: layout.emphasizeActiveItem !== false && layout.emphasize_active_item !== false,
  };
}

export function normalizeHomeWebSurfaceConfig(
  value: unknown,
  context: { brandId?: string; displayName?: string } = {},
) {
  const config = asObject(value);
  const defaults = buildDefaultHomeWebSurfaceConfig(context);
  const marketingSite = asObject(config.marketingSite);
  const siteShell = asObject(config.siteShell);
  const header = asObject(siteShell.header || asObject(marketingSite.siteShell).header);
  const footer = asObject(siteShell.footer || asObject(marketingSite.siteShell).footer);
  const rawWebsite = asObject(config.website);
  const templateKey = String(config.templateKey || marketingSite.templateKey || defaults.templateKey).trim() || defaults.templateKey;
  const pages = normalizeBlockPages(config, marketingSite, rawWebsite, templateKey, defaults);
  const homePage = findMarketingPage({ pages }, 'home') || asObject(defaults.pages[0]);
  const privacyPage = findMarketingPage({ pages }, 'privacy') || asObject(defaults.pages[1]);
  const termsPage = findMarketingPage({ pages }, 'terms') || asObject(defaults.pages[2]);
  const heroBlock = findMarketingBlock(homePage, 'hero.') || normalizeBlockItem(asArray<Record<string, unknown>>(defaults.pages[0].blocks)[0], 'hero.basic', 10, asObject(asArray<Record<string, unknown>>(defaults.pages[0].blocks)[0]?.props));
  const downloadBlock = findMarketingBlock(homePage, 'download-grid.') || normalizeBlockItem(asArray<Record<string, unknown>>(defaults.pages[0].blocks)[1], 'download-grid.classic', 20, asObject(asArray<Record<string, unknown>>(defaults.pages[0].blocks)[1]?.props));
  const privacyBlock = findMarketingBlock(privacyPage, 'rich-text.') || normalizeBlockItem(asArray<Record<string, unknown>>(defaults.pages[1].blocks)[0], 'rich-text.legal', 10, asObject(asArray<Record<string, unknown>>(defaults.pages[1].blocks)[0]?.props));
  const termsBlock = findMarketingBlock(termsPage, 'rich-text.') || normalizeBlockItem(asArray<Record<string, unknown>>(defaults.pages[2].blocks)[0], 'rich-text.legal', 10, asObject(asArray<Record<string, unknown>>(defaults.pages[2].blocks)[0]?.props));
  const headerProps = asObject(header.props);
  const footerProps = asObject(footer.props);
  const hasStructuredMarketing =
    (Array.isArray(marketingSite.pages) && marketingSite.pages.length > 0) ||
    (Array.isArray(config.pages) && config.pages.length > 0) ||
    Object.keys(asObject(config.siteShell)).length > 0 ||
    Object.keys(asObject(marketingSite.siteShell)).length > 0;
  const website = hasStructuredMarketing
    ? deriveWebsiteFromMarketingState({
        defaults,
        context,
        siteShell: {
          ...clone(asObject(marketingSite.siteShell)),
          ...clone(asObject(config.siteShell)),
        },
        pages,
      })
    : rawWebsite;

  return {
    enabled: config.enabled !== false,
    templateKey,
    headerEnabled: header.enabled !== false,
    headerVariant: String(header.variant || asObject(asObject(defaults.siteShell).header).variant).trim(),
    headerBrandLabel: String(headerProps.brandLabel || website.brandLabel || asObject(asObject(asObject(defaults.siteShell).header).props).brandLabel).trim(),
    headerSubline: String(headerProps.subline || website.kicker || asObject(asObject(asObject(defaults.siteShell).header).props).subline).trim(),
    headerNavItemsText: formatLabelHrefLines(asArray(headerProps.navItems)),
    headerPrimaryCtaLabel: String(
      asObject(headerProps.primaryCta).label ||
      website.topCtaLabel ||
      asObject(asObject(asObject(asObject(defaults.siteShell).header).props).primaryCta).label,
    ).trim(),
    headerPrimaryCtaHref: String(
      asObject(headerProps.primaryCta).href ||
      asObject(asObject(asObject(asObject(defaults.siteShell).header).props).primaryCta).href,
    ).trim(),
    footerEnabled: footer.enabled !== false,
    footerVariant: String(footer.variant || asObject(asObject(defaults.siteShell).footer).variant).trim(),
    footerColumnsText: formatLabelHrefLines(asArray(asObject(asArray(footerProps.columns)[0]).links)),
    footerLegalLinksText: formatLabelHrefLines(asArray(footerProps.legalLinks)),
    footerCopyrightText: String(footerProps.copyrightText || asObject(asObject(asObject(defaults.siteShell).footer).props).copyrightText).trim(),
    footerIcpText: String(footerProps.icpText || '').trim(),
    homeSeoTitle: String(asObject(homePage.seo).title || website.homeTitle || asObject(asObject(defaults.pages[0]).seo).title).trim(),
    homeSeoDescription: String(asObject(homePage.seo).description || website.metaDescription || asObject(asObject(defaults.pages[0]).seo).description).trim(),
    heroEyebrow: String(asObject(heroBlock.props).eyebrow || website.kicker || asObject(asArray<Record<string, unknown>>(asObject(defaults.pages[0]).blocks)[0]?.props).eyebrow).trim(),
    heroTitlePre: String(asObject(heroBlock.props).titlePre || website.heroTitlePre || asObject(asArray<Record<string, unknown>>(asObject(defaults.pages[0]).blocks)[0]?.props).titlePre).trim(),
    heroTitleMain: String(asObject(heroBlock.props).titleMain || website.heroTitleMain || asObject(asArray<Record<string, unknown>>(asObject(defaults.pages[0]).blocks)[0]?.props).titleMain).trim(),
    heroDescription: String(asObject(heroBlock.props).description || website.heroDescription || asObject(asArray<Record<string, unknown>>(asObject(defaults.pages[0]).blocks)[0]?.props).description).trim(),
    downloadTitle: String(asObject(downloadBlock.props).title || website.downloadTitle || asObject(asArray<Record<string, unknown>>(asObject(defaults.pages[0]).blocks)[1]?.props).title).trim(),
    privacyTitle: String(asObject(privacyBlock.props).title || asObject(asArray<Record<string, unknown>>(asObject(defaults.pages[1]).blocks)[0]?.props).title).trim(),
    privacyContent: String(asObject(privacyBlock.props).content || asObject(asArray<Record<string, unknown>>(asObject(defaults.pages[1]).blocks)[0]?.props).content).trim(),
    termsTitle: String(asObject(termsBlock.props).title || asObject(asArray<Record<string, unknown>>(asObject(defaults.pages[2]).blocks)[0]?.props).title).trim(),
    termsContent: String(asObject(termsBlock.props).content || asObject(asArray<Record<string, unknown>>(asObject(defaults.pages[2]).blocks)[0]?.props).content).trim(),
  };
}
