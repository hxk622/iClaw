import './styles.css';

const API_BASE_URL = ((import.meta.env.VITE_AUTH_BASE_URL || 'http://127.0.0.1:2130') + '').trim().replace(/\/+$/, '');
const TOKEN_STORAGE_KEY = 'iclaw.admin-web.tokens';
const THEME_STORAGE_KEY = 'iclaw.admin-web.theme';
const NAV_GROUP_COLLAPSE_STORAGE_KEY = 'iclaw.admin-web.nav-groups.v1';
const SYSTEM_MANAGED_MENU_KEYS = new Set(['settings']);
const NAV_ITEMS = [
  {id: 'overview', label: '总览', icon: 'layoutGrid'},
  {id: 'brands', label: '品牌管理', icon: 'layers'},
  {id: 'agent-center', label: 'Agent中心', icon: 'messageSquare'},
  {id: 'skill-center', label: '平台级 Skill', icon: 'zap'},
  {id: 'mcp-center', label: '平台级 MCP', icon: 'network'},
  {id: 'model-center', label: '模型中心', icon: 'package'},
  {id: 'runtime-management', label: 'Runtime包管理', icon: 'package'},
  {id: 'cloud-skills', label: '云技能', icon: 'store'},
  {id: 'cloud-mcps', label: '云MCP', icon: 'network'},
  {id: 'assets', label: '资源管理', icon: 'image'},
  {id: 'releases', label: '版本发布', icon: 'rocket'},
  {
    id: 'payments',
    label: '支付中心',
    icon: 'package',
    children: [
      {id: 'payments-config', label: '账户配置', icon: 'settings'},
      {id: 'payments-packages', label: '充值套餐', icon: 'zap'},
      {id: 'payments-orders', label: '订单中心', icon: 'fileText'},
    ],
  },
  {id: 'audit-log', label: '审计日志', icon: 'fileText'},
];
const PRIMARY_PAYMENT_PROVIDER = 'wechat_qr';
const PAYMENT_PROVIDER_REQUIRED_FIELDS = ['sp_mchid', 'sp_appid', 'sub_mchid', 'notify_url', 'serial_no', 'api_v3_key', 'private_key_pem'];
const PAYMENT_PROVIDER_CONFIG_FIELDS = ['sp_mchid', 'sp_appid', 'sub_mchid', 'notify_url', 'serial_no'];
const PAYMENT_PROVIDER_SECRET_FIELDS = ['api_v3_key', 'private_key_pem'];
const PAYMENT_GATEWAY_CONFIG_FIELDS = ['partner_id', 'gateway'];
const PAYMENT_GATEWAY_SECRET_FIELDS = ['key'];
const DEFAULT_RECHARGE_PAYMENT_METHODS = [
  {
    provider: 'wechat_qr',
    label: '微信支付',
    enabled: true,
    default: true,
    sortOrder: 10,
  },
  {
    provider: 'alipay_qr',
    label: '支付宝',
    enabled: true,
    default: false,
    sortOrder: 20,
  },
];
const HEADER_SURFACE_PRESETS = [
  {
    key: 'wealth',
    label: '理财版',
    description: '稳健、陪伴感更强，适合理财、财富管理、基金投顾类 OEM。',
    config: {
      statusLabel: '理财观察',
      liveStatusLabel: '实时策略',
      showLiveBadge: true,
      showQuotes: true,
      showHeadlines: true,
      showSecurityBadge: true,
      securityLabel: '交易风控中',
      showCredits: true,
      showRechargeButton: true,
      rechargeLabel: '充值中心',
      showModeBadge: true,
      modeBadgeLabel: '机构版',
      fallbackQuotes: [
        {id: 'sh000300', label: '沪深300', value: '3,942.18', change: 0.86, changePercent: '+0.86%'},
        {id: 'sz399001', label: '深证成指', value: '11,248.72', change: -0.42, changePercent: '-0.42%'},
        {id: 'csi-bank', label: '银行指数', value: '5,184.33', change: 0.57, changePercent: '+0.57%'},
        {id: 'gold', label: '现货黄金', value: '2,184.60', change: 0.34, changePercent: '+0.34%'},
      ],
      fallbackHeadlines: [
        {id: 'wealth-1', title: '央国企红利与低波资产继续受到中长期资金关注', source: '策略晨会', href: ''},
        {id: 'wealth-2', title: 'TMT 交易拥挤度回升，成长风格短线波动可能放大', source: '市场监控', href: ''},
        {id: 'wealth-3', title: '组合回撤预警、仓位管理与再平衡建议已接入顶部策略栏', source: '系统提示', href: ''},
      ],
    },
  },
  {
    key: 'broker',
    label: '券商版',
    description: '偏行情驱动和交易氛围，适合券商、交易终端、投研协同场景。',
    config: {
      statusLabel: '盘口速递',
      liveStatusLabel: '实时行情',
      showLiveBadge: true,
      showQuotes: true,
      showHeadlines: true,
      showSecurityBadge: true,
      securityLabel: '交易链路正常',
      showCredits: true,
      showRechargeButton: true,
      rechargeLabel: '账户增值',
      showModeBadge: true,
      modeBadgeLabel: '交易席位',
      fallbackQuotes: [
        {id: 'sse-a', label: '上证指数', value: '3,118.55', change: 0.68, changePercent: '+0.68%'},
        {id: 'gem', label: '创业板指', value: '1,862.40', change: 1.14, changePercent: '+1.14%'},
        {id: 'northbound', label: '北向净流入', value: '32.6 亿', change: 0.52, changePercent: '+0.52%'},
        {id: 'turnover', label: '两市成交', value: '9,846 亿', change: -0.27, changePercent: '-0.27%'},
      ],
      fallbackHeadlines: [
        {id: 'broker-1', title: 'AI 算力链再度活跃，龙头股成交额显著放大', source: '盘中快讯', href: ''},
        {id: 'broker-2', title: '券商板块估值修复延续，量价配合改善', source: '行业盯盘', href: ''},
        {id: 'broker-3', title: '北向资金午后回流，核心宽基 ETF 获持续申购', source: '资金流监测', href: ''},
      ],
    },
  },
  {
    key: 'advisor',
    label: '投顾版',
    description: '更偏组合诊断、风险提示和陪伴式投顾，适合投顾、顾问服务类 OEM。',
    config: {
      statusLabel: '组合守护',
      liveStatusLabel: '风险扫描',
      showLiveBadge: true,
      showQuotes: true,
      showHeadlines: true,
      showSecurityBadge: true,
      securityLabel: '合规陪伴中',
      showCredits: true,
      showRechargeButton: true,
      rechargeLabel: '升级服务',
      showModeBadge: true,
      modeBadgeLabel: '顾问席',
      fallbackQuotes: [
        {id: 'portfolio', label: '组合波动', value: '12.4%', change: -0.36, changePercent: '-0.36%'},
        {id: 'drawdown', label: '年内回撤', value: '4.8%', change: -0.12, changePercent: '-0.12%'},
        {id: 'alpha', label: '超额收益', value: '+3.2%', change: 0.28, changePercent: '+0.28%'},
        {id: 'cash', label: '建议现金', value: '18%', change: 0.00, changePercent: '0.00%'},
      ],
      fallbackHeadlines: [
        {id: 'advisor-1', title: '权益仓位建议保持中性偏均衡，等待增量信号确认', source: '组合建议', href: ''},
        {id: 'advisor-2', title: '高波动板块建议分批止盈，避免短线情绪回撤放大', source: '风险提示', href: ''},
        {id: 'advisor-3', title: '债券与红利资产可继续作为账户稳定器进行配置', source: '顾问观点', href: ''},
      ],
    },
  },
];
const HOME_WEB_SURFACE_PRESETS = [
  {
    key: 'wealth',
    label: '理财版',
    description: '强调稳健配置、资产陪伴和财富管理语境的官网文案。',
    config: {
      website: {
        homeTitle: '财富顾问官网',
        metaDescription: '面向财富管理、基金投顾和长期配置场景的桌面 AI 工作台。',
        brandLabel: '财富顾问',
        kicker: 'Wealth AI Desktop',
        heroTitlePre: '把 AI 装进你的资产配置流程',
        heroTitleMain: '稳健研究，打开即用',
        heroDescription: '适合理财顾问、基金投顾和高净值陪伴场景，聚焦研究、组合诊断与长期配置。',
        topCtaLabel: '立即下载',
        scrollLabel: '查看下载版本',
        downloadTitle: '下载财富顾问桌面端',
      },
    },
  },
  {
    key: 'broker',
    label: '券商版',
    description: '更突出行情、交易效率和终端属性的官网文案。',
    config: {
      website: {
        homeTitle: '交易终端官网',
        metaDescription: '面向券商、交易终端和投研协同场景的本地 AI 客户端。',
        brandLabel: '交易终端',
        kicker: 'Broker Research Terminal',
        heroTitlePre: '把 AI 接到你的行情与研究链路里',
        heroTitleMain: '盯盘、研究、问答一站完成',
        heroDescription: '聚焦行情理解、标的筛选、盘中问答和交易协同，适合券商与专业投资团队。',
        topCtaLabel: '下载终端',
        scrollLabel: '查看终端下载',
        downloadTitle: '下载交易终端',
      },
    },
  },
  {
    key: 'advisor',
    label: '投顾版',
    description: '更偏顾问服务、组合陪伴和客户沟通的官网文案。',
    config: {
      website: {
        homeTitle: '投顾助手官网',
        metaDescription: '面向投顾服务、客户陪伴和组合运营场景的 AI 桌面应用。',
        brandLabel: '投顾助手',
        kicker: 'Advisor Companion',
        heroTitlePre: '让 AI 成为你的顾问席位',
        heroTitleMain: '陪客户，也陪组合',
        heroDescription: '聚焦组合跟踪、风险提示、客户陪伴和日常投顾交付，适合顾问型 OEM 场景。',
        topCtaLabel: '下载顾问端',
        scrollLabel: '查看顾问端下载',
        downloadTitle: '下载投顾助手',
      },
    },
  },
];
const SIDEBAR_SURFACE_PRESETS = [
  {
    key: 'wealth',
    label: '理财版',
    description: '突出顾问陪伴、组合跟踪和长期配置的侧边栏结构。',
    config: {
      variant: 'wealth',
      brandBlock: {
        title: '财富顾问台',
        subtitle: '组合、基金、客户陪伴',
      },
      layout: {
        sectionStyle: 'soft-card',
        emphasizeActiveItem: true,
      },
    },
    selectedMenus: ['chat', 'investment-experts', 'fund-market', 'memory', 'im-bots', 'security', 'task-center'],
    menuOrder: ['chat', 'investment-experts', 'fund-market', 'memory', 'im-bots', 'security', 'task-center'],
    menuConfigs: {
      chat: {group_label: '顾问台'},
      'investment-experts': {group_label: '顾问台', display_name: '投顾专家'},
      'fund-market': {group_label: '市场跟踪', display_name: '基金市场'},
      memory: {group_label: '顾问台'},
      'im-bots': {group_label: '协同触达'},
      security: {group_label: '系统'},
      'task-center': {group_label: '系统'},
    },
  },
  {
    key: 'broker',
    label: '券商版',
    description: '突出盯盘、研究和交易支持的侧边栏结构。',
    config: {
      variant: 'broker',
      brandBlock: {
        title: '交易研究台',
        subtitle: '盯盘、标的、投研协同',
      },
      layout: {
        sectionStyle: 'dense',
        emphasizeActiveItem: true,
      },
    },
    selectedMenus: ['chat', 'stock-market', 'fund-market', 'investment-experts', 'data-connections', 'skill-store', 'mcp-store', 'task-center'],
    menuOrder: ['chat', 'stock-market', 'fund-market', 'investment-experts', 'data-connections', 'skill-store', 'mcp-store', 'task-center'],
    menuConfigs: {
      chat: {group_label: '交易台'},
      'stock-market': {group_label: '行情'},
      'fund-market': {group_label: '行情'},
      'investment-experts': {group_label: '研究'},
      'data-connections': {group_label: '研究'},
      'skill-store': {group_label: '扩展'},
      'mcp-store': {group_label: '扩展'},
      'task-center': {group_label: '系统'},
    },
  },
  {
    key: 'advisor',
    label: '投顾版',
    description: '突出客户运营、组合诊断和服务交付的侧边栏结构。',
    config: {
      variant: 'advisor',
      brandBlock: {
        title: '顾问服务台',
        subtitle: '客户、组合、服务交付',
      },
      layout: {
        sectionStyle: 'service',
        emphasizeActiveItem: true,
      },
    },
    selectedMenus: ['chat', 'investment-experts', 'stock-market', 'fund-market', 'im-bots', 'memory', 'security', 'task-center'],
    menuOrder: ['chat', 'investment-experts', 'stock-market', 'fund-market', 'im-bots', 'memory', 'security', 'task-center'],
    menuConfigs: {
      chat: {group_label: '服务台'},
      'investment-experts': {group_label: '服务台', display_name: '顾问专家'},
      'stock-market': {group_label: '市场跟踪'},
      'fund-market': {group_label: '市场跟踪'},
      'im-bots': {group_label: '客户触达'},
      memory: {group_label: '客户触达', display_name: '客户记忆'},
      security: {group_label: '系统'},
      'task-center': {group_label: '系统'},
    },
  },
];
const INPUT_ASSEMBLY_PRESETS = [
  {
    key: 'wealth',
    label: '理财版',
    description: '偏组合诊断、基金分析和长期配置的输入框模板。',
    selectedComposerControls: ['expert', 'mode', 'fund-context', 'watchlist', 'output-format'],
    composerControlOrder: ['expert', 'mode', 'fund-context', 'watchlist', 'output-format'],
    composerControlConfigs: {
      mode: {display_name: '分析模式', allowed_option_values: ['quick', 'deep-research', 'report']},
      watchlist: {display_name: '组合视角', allowed_option_values: ['all', 'core', 'long-term']},
      'output-format': {display_name: '输出形式', allowed_option_values: ['summary', 'table', 'report']},
    },
    selectedComposerShortcuts: ['fund-analysis', 'valuation-analysis', 'market-recap'],
    composerShortcutOrder: ['fund-analysis', 'valuation-analysis', 'market-recap'],
    composerShortcutConfigs: {
      'fund-analysis': {display_name: '基金体检'},
      'valuation-analysis': {display_name: '估值校准'},
      'market-recap': {display_name: '市场跟踪'},
    },
  },
  {
    key: 'broker',
    label: '券商版',
    description: '偏标的研究、行情跟踪和研报输出的输入框模板。',
    selectedComposerControls: ['expert', 'skill', 'mode', 'market-scope', 'stock-context', 'output-format'],
    composerControlOrder: ['expert', 'skill', 'mode', 'market-scope', 'stock-context', 'output-format'],
    composerControlConfigs: {
      mode: {display_name: '工作模式', allowed_option_values: ['quick', 'deep-research', 'report']},
      'market-scope': {display_name: '市场范围', allowed_option_values: ['cn', 'us', 'hk', 'macro']},
      'output-format': {display_name: '交付形式', allowed_option_values: ['summary', 'table', 'minutes', 'report']},
    },
    selectedComposerShortcuts: ['market-recap', 'earnings-analysis', 'valuation-analysis', 'company-compare', 'sector-review'],
    composerShortcutOrder: ['market-recap', 'earnings-analysis', 'valuation-analysis', 'company-compare', 'sector-review'],
    composerShortcutConfigs: {
      'market-recap': {display_name: '盘面复盘'},
      'earnings-analysis': {display_name: '财报速读'},
      'company-compare': {display_name: '双标的对比'},
    },
  },
  {
    key: 'advisor',
    label: '投顾版',
    description: '偏顾问问答、组合视角和客户沟通输出的输入框模板。',
    selectedComposerControls: ['expert', 'mode', 'watchlist', 'fund-context', 'output-format'],
    composerControlOrder: ['expert', 'mode', 'watchlist', 'fund-context', 'output-format'],
    composerControlConfigs: {
      mode: {display_name: '顾问模式', allowed_option_values: ['quick', 'report']},
      watchlist: {display_name: '客户组合', allowed_option_values: ['all', 'core', 'long-term']},
      'output-format': {display_name: '交付模版', allowed_option_values: ['summary', 'table', 'minutes', 'report']},
    },
    selectedComposerShortcuts: ['market-recap', 'fund-analysis', 'valuation-analysis', 'company-compare'],
    composerShortcutOrder: ['market-recap', 'fund-analysis', 'valuation-analysis', 'company-compare'],
    composerShortcutConfigs: {
      'market-recap': {display_name: '晨会摘要'},
      'fund-analysis': {display_name: '组合体检'},
      'company-compare': {display_name: '客户对比'},
    },
  },
  {
    key: 'xiaohongshu',
    label: '小红书运营版',
    description: '偏内容选题、爆文拆解、笔记润色和评论互动的输入框模板。',
    selectedComposerControls: ['skill', 'mode', 'output-format'],
    composerControlOrder: ['skill', 'mode', 'output-format'],
    composerControlConfigs: {
      skill: {display_name: '运营技能'},
      mode: {display_name: '运营模式', allowed_option_values: ['quick', 'deep-research', 'report']},
      'output-format': {display_name: '产出形式', allowed_option_values: ['summary', 'table', 'minutes', 'report']},
    },
    selectedComposerShortcuts: [
      'xhs-topic-mining',
      'xhs-viral-analysis',
      'xhs-competitor-review',
      'xhs-note-polish',
      'xhs-comment-reply',
      'xhs-publishing-plan',
    ],
    composerShortcutOrder: [
      'xhs-topic-mining',
      'xhs-viral-analysis',
      'xhs-competitor-review',
      'xhs-note-polish',
      'xhs-comment-reply',
      'xhs-publishing-plan',
    ],
    composerShortcutConfigs: {
      'xhs-topic-mining': {display_name: '选题挖掘'},
      'xhs-viral-analysis': {display_name: '爆文拆解'},
      'xhs-competitor-review': {display_name: '竞品对标'},
      'xhs-note-polish': {display_name: '笔记润色'},
      'xhs-comment-reply': {display_name: '评论回复'},
      'xhs-publishing-plan': {display_name: '发布计划'},
    },
  },
];
const CAPABILITY_ROUTE_MODE = {
  'skills-mcp': 'skills',
  'skill-center': 'skills',
  'mcp-center': 'mcp',
  'model-center': 'models',
};
const SURFACE_LABELS = {
  desktop: '桌面端',
  'home-web': 'Web 主页',
  welcome: 'Welcome页',
  header: '顶部栏',
  sidebar: '侧边栏',
  input: '输入编辑器',
  'input-composer': '输入编辑器',
  'skill-store': '技能商店',
  'mcp-store': 'MCP商店',
  'lobster-store': '龙虾商店',
  'investment-experts': '智能投资专家',
  security: '安全中心',
  memory: '记忆管理',
  'data-connections': '数据连接',
  'im-bots': 'IM机器人',
  'task-center': '历史任务',
};
const SURFACE_BLUEPRINTS = [
  {key: 'desktop', label: '桌面端', icon: 'monitor', kind: 'shell'},
  {key: 'home-web', label: 'Home页', icon: 'globe', kind: 'shell'},
  {key: 'welcome', label: 'Welcome页', icon: 'sparkles', kind: 'shell'},
  {key: 'header', label: 'Header栏', icon: 'layout', kind: 'shell'},
  {key: 'sidebar', label: '侧边栏', icon: 'sidebar', kind: 'shell'},
  {key: 'input', label: '输入框', icon: 'messageSquare', kind: 'shell'},
  {key: 'skill-store', label: '技能商店', icon: 'store', kind: 'module', menuKey: 'skill-store'},
  {key: 'mcp-store', label: 'MCP商店', icon: 'network', kind: 'module', menuKey: 'mcp-store'},
  {key: 'lobster-store', label: '龙虾商店', icon: 'package', kind: 'module', menuKey: 'lobster-store'},
  {key: 'investment-experts', label: '智能投资专家', icon: 'trendingUp', kind: 'module', menuKey: 'investment-experts'},
  {key: 'security', label: '安全中心', icon: 'shield', kind: 'module', menuKey: 'security'},
  {key: 'memory', label: '记忆管理', icon: 'fileText', kind: 'module', menuKey: 'memory'},
  {key: 'data-connections', label: '数据连接', icon: 'network', kind: 'module', menuKey: 'data-connections'},
  {key: 'im-bots', label: 'IM机器人', icon: 'messageSquare', kind: 'module', menuKey: 'im-bots'},
  {key: 'task-center', label: '历史任务', icon: 'checkCircle', kind: 'module', menuKey: 'task-center'},
];
const DEFAULT_SURFACE_KEYS = SURFACE_BLUEPRINTS.filter((item) => item.key !== 'welcome').map((item) => item.key);
const MODULE_SURFACE_KEYS = SURFACE_BLUEPRINTS.filter((item) => item.kind === 'module').map((item) => item.key);
const BRAND_DETAIL_TABS = [
  {id: 'desktop', label: '桌面端', icon: 'monitor'},
  {id: 'home-web', label: 'Home页', icon: 'globe'},
  {id: 'welcome', label: 'Welcome页', icon: 'sparkles'},
  {id: 'auth', label: '登录与协议', icon: 'shield'},
  {id: 'header', label: 'Header栏', icon: 'layout'},
  {id: 'sidebar', label: '侧边栏', icon: 'sidebar'},
  {id: 'input', label: '输入框', icon: 'messageSquare'},
  {id: 'skills', label: '技能', icon: 'zap'},
  {id: 'mcps', label: 'MCP', icon: 'network'},
  {id: 'recharge', label: '充值套餐', icon: 'package'},
  {id: 'menus', label: '左菜单栏', icon: 'layers'},
  {id: 'assets', label: '品牌资源', icon: 'image'},
  {id: 'theme', label: '主题样式', icon: 'palette'},
];
const BRAND_DETAIL_TAB_GROUPS = [
  {id: 'shell', label: 'Shell骨架', icon: 'monitor', tabs: ['desktop', 'home-web', 'welcome', 'auth', 'header', 'sidebar', 'input']},
  {id: 'capabilities', label: '能力绑定', icon: 'zap', tabs: ['skills', 'mcps', 'recharge', 'menus']},
  {id: 'brand', label: '品牌资源', icon: 'image', tabs: ['assets', 'theme']},
];
const ADMIN_SKILL_BROWSER_PAGE_SIZE = 100;
const AGENT_AVATAR_PRESET_OPTIONS = Array.from({length: 16}, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    value: `/agent-avatars/pexels/portrait-${number}.jpg`,
    label: `职业头像 ${number}`,
  };
});

const app = document.querySelector('#app');

if (!app) {
  throw new Error('admin-web mount failed');
}

function ensureCanonicalAdminWebOrigin() {
  try {
    const url = new URL(window.location.href);
    if (url.port === '1520' && url.hostname === 'localhost') {
      url.hostname = '127.0.0.1';
      window.location.replace(url.toString());
      return true;
    }
  } catch {}
  return false;
}

const redirectedToCanonicalOrigin = ensureCanonicalAdminWebOrigin();

function isThemeMode(value) {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredThemeMode() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

function resolveThemeMode(mode) {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeMode(mode) {
  const resolved = resolveThemeMode(mode);
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.resolvedTheme = resolved;
  return resolved;
}

function persistThemeMode(mode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {}
}

function cycleThemeMode(mode) {
  if (mode === 'system') return 'light';
  if (mode === 'light') return 'dark';
  return 'system';
}

function themeModeLabel(mode) {
  if (mode === 'light') return '浅色';
  if (mode === 'dark') return '深色';
  return '跟随系统';
}

const THEME_MODE_OPTIONS = [
  {value: 'light', label: '浅色', icon: 'sun'},
  {value: 'dark', label: '深色', icon: 'moon'},
  {value: 'system', label: '系统', icon: 'monitor'},
];

const state = {
  themeMode: readStoredThemeMode(),
  busy: false,
  loading: false,
  error: '',
  notice: '',
  view: 'login',
  route: 'overview',
  tokens: loadTokens(),
  user: null,
  dashboard: null,
  brands: [],
  portalAppDetails: {},
  selectedBrandId: '',
  brandDetail: null,
  brandDraftBuffer: null,
  brandDetailTab: 'desktop',
  capabilities: null,
  menuCatalog: [],
  composerControlCatalog: [],
  composerShortcutCatalog: [],
  rechargePackageCatalog: [],
  skillCatalog: [],
  cloudSkillCatalog: [],
  cloudSkillCatalogMeta: {
    total: 0,
    limit: ADMIN_SKILL_BROWSER_PAGE_SIZE,
    offset: 0,
    hasMore: false,
    nextOffset: null,
    query: '',
    loading: false,
  },
  brandSkillCatalog: [],
  brandSkillCatalogMeta: {
    total: 0,
    limit: ADMIN_SKILL_BROWSER_PAGE_SIZE,
    offset: 0,
    hasMore: false,
    nextOffset: null,
    query: '',
    loading: false,
  },
  personalSkillCatalog: [],
  skillLibrary: [],
  mcpCatalog: [],
  cloudMcpCatalog: [],
  modelCatalog: [],
  modelProviderProfiles: [],
  modelProviderOverrides: {},
  modelProviderDrafts: {},
  memoryEmbeddingProfiles: [],
  memoryEmbeddingDrafts: {},
  modelLogoPresets: [],
  paymentGatewayConfigs: {},
  paymentGatewayModeDrafts: {},
  paymentProviderProfiles: [],
  paymentProviderBindings: [],
  skillSyncSources: [],
  skillSyncRuns: [],
  capabilityMode: 'skills',
  agentCatalog: [],
  selectedAgentSlug: '',
  selectedSkillSlug: '',
  selectedMcpKey: '',
  selectedModelRef: '',
  selectedModelProviderTab: 'platform',
  selectedModelCenterSection: 'chat-provider',
  selectedPaymentProviderTab: 'platform',
  selectedRuntimeSection: 'release',
  selectedRuntimeImportChannel: 'prod',
  selectedRuntimeImportBindScopeType: 'none',
  selectedRuntimeImportBindScopeKey: '',
  selectedRechargePackageId: '',
  selectedBrandMenuKey: '',
  selectedCloudSkillSlug: '',
  selectedCloudMcpKey: '',
  selectedSkillSyncSourceId: '',
  selectedReleaseId: '',
  selectedRuntimeReleaseId: '',
  selectedRuntimeBindingId: '',
  selectedPaymentOrderId: '',
  selectedAuditId: '',
  selectedDesktopReleaseChannel: 'prod',
  navGroupsCollapsed: loadNavGroupsCollapsedState(),
  mcpTestResult: null,
  memoryEmbeddingTestResult: null,
  assets: [],
  releases: [],
  runtimeReleases: [],
  runtimeBindings: [],
  runtimeBindingHistory: [],
  runtimeBootstrapSource: null,
  runtimeReleaseDraftBuffer: null,
  runtimeBindingDraftBuffer: null,
  paymentOrders: [],
  paymentOrderDetails: {},
  audit: [],
  showCreateBrandForm: false,
  showAgentImportPanel: false,
  showSkillImportPanel: false,
  showPlatformSkillAddPanel: false,
  showPlatformMcpAddPanel: false,
  showSkillSyncSourceForm: false,
  showAssetUploadPanel: false,
  filters: {
    brandQuery: '',
    brandStatus: 'all',
    agentQuery: '',
    agentStatus: 'all',
    agentSurface: 'all',
    agentSourceRepo: 'all',
    capabilityQuery: '',
    capabilitySkillStatus: 'all',
    capabilitySkillCategory: 'all',
    capabilitySkillBrand: 'all',
    capabilityMcpStatus: 'all',
    capabilityMcpTransport: 'all',
    capabilityMcpBrand: 'all',
    capabilityModelStatus: 'all',
    capabilityModelProvider: 'all',
    capabilityModelBrand: 'all',
    assetQuery: '',
    assetBrand: 'all',
    assetKind: 'all',
    releaseBrand: 'all',
    paymentStatus: 'all',
    paymentProvider: 'all',
    paymentApp: 'all',
    paymentQuery: '',
    auditBrand: 'all',
    auditAction: 'all',
    auditQuery: '',
  },
};

let filterRenderTimer = null;
let pendingFilterFocus = null;

function loadTokens() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistTokens(tokens) {
  state.tokens = tokens;
  if (tokens) {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    return;
  }
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function loadNavGroupsCollapsedState() {
  try {
    const raw = localStorage.getItem(NAV_GROUP_COLLAPSE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      payments: parsed && typeof parsed === 'object' && parsed.payments === false ? false : true,
    };
  } catch {
    return {payments: true};
  }
}

function persistNavGroupsCollapsedState() {
  try {
    localStorage.setItem(NAV_GROUP_COLLAPSE_STORAGE_KEY, JSON.stringify(state.navGroupsCollapsed || {payments: true}));
  } catch {}
}

function isUnauthorizedError(error) {
  return Boolean(error && typeof error === 'object' && error.code === 'UNAUTHORIZED');
}

function shouldKeepSessionOnError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = String(error.code || '').trim();
  return Boolean(code) && code !== 'UNAUTHORIZED';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value) {
  const seen = new Set();
  for (const item of asArray(value)) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim();
    if (!normalized) continue;
    seen.add(normalized);
  }
  return Array.from(seen);
}

function getUserAvatarUrl(user) {
  const avatarUrl = String(user?.avatar_url || user?.avatarUrl || '').trim();
  return avatarUrl || '';
}

function getUserDisplayName(user) {
  return String(user?.name || user?.username || 'admin').trim() || 'admin';
}

function getUserInitials(user) {
  const label = getUserDisplayName(user);
  return Array.from(label).slice(0, 1).join('').toUpperCase();
}

function splitLines(value) {
  return String(value || '')
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function icon(name, className = '') {
  const cls = className ? ` class="${escapeHtml(className)}"` : '';
  const common = `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
  const icons = {
    plus: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M12 5v14"/><path ${common} d="M5 12h14"/></svg>`,
    search: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="11" cy="11" r="7"/><path ${common} d="m20 20-3.5-3.5"/></svg>`,
    clock: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="12" r="9"/><path ${common} d="M12 7v5l3 2"/></svg>`,
    activity: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M3 12h4l2-5 4 10 2-5h6"/></svg>`,
    rocket: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M5 19c2-2 4-3 7-3 0-3 1-5 3-7 2-2 4-3 7-4-1 3-2 5-4 7-2 2-4 3-7 3-1 3-2 5-3 7-1-1-2-2-3-3Z"/><path ${common} d="M9 15l-4 4"/><path ${common} d="M9 19H5v-4"/></svg>`,
    trendingUp: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M3 17 10 10l4 4 7-7"/><path ${common} d="M14 7h7v7"/></svg>`,
    pieChart: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M12 3v9h9"/><path ${common} d="M20.5 13A8.5 8.5 0 1 1 11 3.5"/></svg>`,
    lightbulb: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M9 18h6"/><path ${common} d="M10 22h4"/><path ${common} d="M8 14a6 6 0 1 1 8 0c-.8.8-1.3 1.8-1.5 3h-5c-.2-1.2-.7-2.2-1.5-3z"/></svg>`,
    messageCircle: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M21 11.5a8.5 8.5 0 1 1-4-7.1A8.4 8.4 0 0 1 21 11.5Z"/><path ${common} d="M8 20l-3 3v-4"/></svg>`,
    shieldCheck: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M12 3 5 6v5c0 4.7 2.8 7.9 7 10 4.2-2.1 7-5.3 7-10V6z"/><path ${common} d="m9.5 12 1.8 1.8 3.7-3.8"/></svg>`,
    arrowLeft: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M19 12H5"/><path ${common} d="m12 19-7-7 7-7"/></svg>`,
    chevronUp: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="m6 14 6-6 6 6"/></svg>`,
    chevronDown: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="m6 10 6 6 6-6"/></svg>`,
    save: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M5 5h11l3 3v11H5z"/><path ${common} d="M8 5v5h8"/><path ${common} d="M9 19v-5h6v5"/></svg>`,
    rotateCcw: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M3 12a9 9 0 1 0 3-6.7"/><path ${common} d="M3 4v5h5"/></svg>`,
    monitor: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="4" width="18" height="12" rx="2"/><path ${common} d="M8 20h8"/><path ${common} d="M12 16v4"/></svg>`,
    globe: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="12" r="9"/><path ${common} d="M3 12h18"/><path ${common} d="M12 3a15 15 0 0 1 0 18"/><path ${common} d="M12 3a15 15 0 0 0 0 18"/></svg>`,
    layout: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="4" width="18" height="16" rx="2"/><path ${common} d="M3 10h18"/><path ${common} d="M9 10v10"/></svg>`,
    sidebar: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="4" width="18" height="16" rx="2"/><path ${common} d="M9 4v16"/></svg>`,
    messageSquare: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M7 18H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-4 3z"/></svg>`,
    store: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M4 9l1-4h14l1 4"/><path ${common} d="M5 9h14v10H5z"/><path ${common} d="M9 13h6"/></svg>`,
    palette: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4 5 5 0 0 0 0-10Z"/><circle ${common} cx="7.5" cy="10.5" r=".5"/><circle ${common} cx="9.5" cy="7.5" r=".5"/><circle ${common} cx="14.5" cy="7.5" r=".5"/></svg>`,
    sparkles: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path ${common} d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/><path ${common} d="m5.5 14 .6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/></svg>`,
    image: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="5" width="18" height="14" rx="2"/><circle ${common} cx="8.5" cy="10" r="1.5"/><path ${common} d="m21 16-5-5-6 6-3-3-4 4"/></svg>`,
    zap: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>`,
    network: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="5" r="2"/><circle ${common} cx="5" cy="18" r="2"/><circle ${common} cx="19" cy="18" r="2"/><path ${common} d="M12 7v4"/><path ${common} d="M12 11 6.5 16"/><path ${common} d="M12 11 17.5 16"/></svg>`,
    shield: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M12 3 5 6v5c0 4.7 2.8 7.9 7 10 4.2-2.1 7-5.3 7-10V6z"/><path ${common} d="m9.5 12 1.8 1.8 3.7-3.8"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="5" width="18" height="16" rx="2"/><path ${common} d="M16 3v4"/><path ${common} d="M8 3v4"/><path ${common} d="M3 10h18"/></svg>`,
    user: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="8" r="4"/><path ${common} d="M5 20a7 7 0 0 1 14 0"/></svg>`,
    package: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path ${common} d="m12 12 8-4.5"/><path ${common} d="m12 12-8-4.5"/><path ${common} d="M12 21v-9"/></svg>`,
    checkCircle: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="12" r="9"/><path ${common} d="m8.5 12 2.5 2.5 4.5-5"/></svg>`,
    check: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="m5 12 4.2 4.2L19 6.5"/></svg>`,
    sun: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="12" r="4"/><path ${common} d="M12 2v2.5"/><path ${common} d="M12 19.5V22"/><path ${common} d="m4.93 4.93 1.77 1.77"/><path ${common} d="m17.3 17.3 1.77 1.77"/><path ${common} d="M2 12h2.5"/><path ${common} d="M19.5 12H22"/><path ${common} d="m4.93 19.07 1.77-1.77"/><path ${common} d="m17.3 6.7 1.77-1.77"/></svg>`,
    moon: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M21 13.2A8.7 8.7 0 1 1 10.8 3a7 7 0 0 0 10.2 10.2Z"/></svg>`,
    filter: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M4 6h16"/><path ${common} d="M7 12h10"/><path ${common} d="M10 18h4"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M12 20h9"/><path ${common} d="m16.5 3.5 4 4L8 20l-5 1 1-5z"/></svg>`,
    upload: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M12 16V4"/><path ${common} d="m7 9 5-5 5 5"/><path ${common} d="M4 20h16"/></svg>`,
    trash: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M3 6h18"/><path ${common} d="M8 6V4h8v2"/><path ${common} d="M6 6l1 14h10l1-14"/><path ${common} d="M10 10v6"/><path ${common} d="M14 10v6"/></svg>`,
    settings: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="12" r="3"/><path ${common} d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2H9a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1V9c0 .4.2.7.6.9H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.7z"/></svg>`,
    square: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="5" y="5" width="14" height="14" rx="2"/></svg>`,
    fileImage: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path ${common} d="M14 3v5h5"/><circle ${common} cx="10" cy="13" r="1.5"/><path ${common} d="m8 19 3-3 2 2 3-3 2 4"/></svg>`,
    layoutGrid: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="3" width="7" height="7" rx="1.5"/><rect ${common} x="14" y="3" width="7" height="7" rx="1.5"/><rect ${common} x="3" y="14" width="7" height="7" rx="1.5"/><rect ${common} x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
    layers: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="m12 4 8 4-8 4-8-4z"/><path ${common} d="m4 12 8 4 8-4"/><path ${common} d="m4 16 8 4 8-4"/></svg>`,
    fileText: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path ${common} d="M14 3v5h5"/><path ${common} d="M9 13h6"/><path ${common} d="M9 17h6"/><path ${common} d="M9 9h2"/></svg>`,
  };
  return icons[name] || '';
}

const ICON_KEY_ALIASES = {
  '': 'sparkles',
  chat: 'messageSquare',
  cron: 'calendar',
  'skill-store': 'store',
  'lobster-store': 'package',
  'mcp-store': 'network',
  'im-bots': 'messageSquare',
  memory: 'fileText',
  security: 'shield',
  'task-center': 'checkCircle',
  'investment-experts': 'trendingUp',
  'data-connections': 'network',
  'finance-skills': 'zap',
  'foundation-skills': 'layers',
  'stock-market': 'trendingUp',
  'fund-market': 'pieChart',
  workspace: 'layout',
  skills: 'zap',
  mcp: 'network',
  assets: 'image',
  models: 'package',
  TrendingUp: 'trendingUp',
  PieChart: 'pieChart',
  Search: 'search',
  Lightbulb: 'lightbulb',
  MessageCircle: 'messageCircle',
  Sparkles: 'sparkles',
  ShieldCheck: 'shieldCheck',
};

function resolveIconName(value, fallback = 'sparkles') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return ICON_KEY_ALIASES[raw] || raw;
}

function renderIconPreview(iconKey, className = '') {
  const name = resolveIconName(iconKey);
  return icon(name, className) || icon('square', className);
}

function renderAdminLogo(className = '') {
  const cls = className ? ` ${className}` : '';
  return `
    <span class="brand-mark${cls}" aria-hidden="true">
      <svg class="brand-mark__svg" viewBox="0 0 72 72" fill="none">
        <defs>
          <linearGradient id="adminBrandGradient" x1="12" y1="10" x2="60" y2="62" gradientUnits="userSpaceOnUse">
            <stop stop-color="#7DB0AF" />
            <stop offset="0.54" stop-color="#B89573" />
            <stop offset="1" stop-color="#314036" />
          </linearGradient>
        </defs>
        <rect x="6" y="6" width="60" height="60" rx="18" fill="#221f1b" />
        <rect x="13" y="13" width="46" height="46" rx="14" fill="url(#adminBrandGradient)" opacity="0.2" />
        <path d="M20 46.5V24.5L36 16l16 8.5v22L36 55l-16-8.5Z" fill="url(#adminBrandGradient)" />
        <path d="M36 16v39" stroke="#F9F7F3" stroke-opacity="0.88" stroke-width="2.2" stroke-linecap="round" />
        <path d="M20 24.5 36 33l16-8.5" stroke="#F9F7F3" stroke-opacity="0.82" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M20 46.5 36 38l16 8.5" stroke="#F9F7F3" stroke-opacity="0.64" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
  `;
}

function setThemeMode(mode) {
  const nextMode = isThemeMode(mode) ? mode : 'system';
  state.themeMode = nextMode;
  persistThemeMode(nextMode);
  applyThemeMode(nextMode);
}

function renderThemeModeSwitcher(className = '') {
  return `
    <div class="theme-switcher${className ? ` ${escapeHtml(className)}` : ''}" role="group" aria-label="主题模式">
      ${THEME_MODE_OPTIONS.map((item) => {
        const active = state.themeMode === item.value;
        return `
          <button
            class="theme-switcher__button${active ? ' is-active' : ''}"
            type="button"
            data-action="set-theme-mode"
            data-theme-mode="${escapeHtml(item.value)}"
            title="${escapeHtml(themeModeLabel(item.value))}"
            aria-pressed="${active ? 'true' : 'false'}"
          >
            ${icon(item.icon, 'theme-switcher__icon')}
            <span>${escapeHtml(item.label)}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function formatDateTime(value) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCredits(value) {
  const amount = Number(value || 0);
  return `${Number.isFinite(amount) ? amount.toLocaleString('zh-CN') : '0'} 龙虾币`;
}

function formatFen(value) {
  const amount = Number(value || 0);
  const normalized = Number.isFinite(amount) ? amount : 0;
  return `¥${(normalized / 100).toFixed(2)}`;
}

function formatFenInputValue(value) {
  const amount = Number(value || 0);
  const normalized = Number.isFinite(amount) ? amount : 0;
  return (normalized / 100).toFixed(2);
}

function parseYuanInputToFen(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/^¥/, '')
    .replace(/,/g, '');
  if (!normalized) {
    return 0;
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error('金额请输入合法的元金额，最多保留两位小数');
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) {
    throw new Error('金额请输入合法的元金额');
  }
  return Math.round(amount * 100);
}

function formatDateTimeInputValue(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (input) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRelative(value) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未记录';
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) {
    return `${Math.max(1, Math.round(diff / minute))} 分钟前`;
  }
  if (diff < day) {
    return `${Math.max(1, Math.round(diff / hour))} 小时前`;
  }
  return `${Math.max(1, Math.round(diff / day))} 天前`;
}

function titleizeKey(value) {
  return String(value || '')
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function surfaceLabel(key) {
  return SURFACE_LABELS[key] || titleizeKey(key);
}

function getSurfaceBlueprint(key) {
  return SURFACE_BLUEPRINTS.find((item) => item.key === key) || null;
}

function normalizeBrandDetailTab(tabId) {
  const normalized = String(tabId || '').trim();
  if (!normalized) {
    return 'desktop';
  }
  if (MODULE_SURFACE_KEYS.includes(normalized)) {
    return 'menus';
  }
  return BRAND_DETAIL_TABS.find((item) => item.id === normalized)?.id || 'desktop';
}

function getBrandDetailTabConfig(tabId) {
  const normalized = normalizeBrandDetailTab(tabId);
  return BRAND_DETAIL_TABS.find((item) => item.id === normalized) || null;
}

function getBrandDetailTabGroup(tabId) {
  const normalized = normalizeBrandDetailTab(tabId);
  return BRAND_DETAIL_TAB_GROUPS.find((group) => group.tabs.includes(normalized)) || BRAND_DETAIL_TAB_GROUPS[0];
}

function normalizeRechargePackageCatalogItem(item, index = 0) {
  const raw = asObject(item);
  const packageId = String(raw.packageId || raw.package_id || '').trim();
  if (!packageId) return null;
  const metadata = asObject(raw.metadata);
  return {
    packageId,
    packageName: String(raw.packageName || raw.package_name || '').trim() || packageId,
    credits: Number(raw.credits || 0) || 0,
    bonusCredits: Number(raw.bonusCredits || raw.bonus_credits || 0) || 0,
    amountCnyFen: Number(raw.amountCnyFen || raw.amount_cny_fen || 0) || 0,
    sortOrder: Number(raw.sortOrder || raw.sort_order || (index + 1) * 10) || (index + 1) * 10,
    recommended: raw.recommended === true,
    default: raw.default === true || raw.is_default === true,
    active: raw.active !== false,
    metadata,
    description: String(metadata.description || '').trim(),
    badgeLabel: String(metadata.badge_label || metadata.badgeLabel || '').trim(),
    highlight: String(metadata.highlight || '').trim(),
    featureList: asStringArray(metadata.feature_list ?? metadata.featureList),
  };
}

function getRechargePackageCatalogItems() {
  return asArray(state.rechargePackageCatalog)
    .map((item, index) => normalizeRechargePackageCatalogItem(item, index))
    .filter(Boolean)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.packageId.localeCompare(right.packageId, 'zh-CN'));
}

function getRechargePackageCatalogEntry(packageId) {
  const normalized = String(packageId || '').trim();
  if (!normalized) return null;
  return getRechargePackageCatalogItems().find((item) => item.packageId === normalized) || null;
}

function buildOrderedRechargePackageList(order) {
  const catalogItems = getRechargePackageCatalogItems();
  const known = new Set(catalogItems.map((item) => item.packageId));
  const list = asStringArray(order).filter((key) => known.has(key));
  for (const item of catalogItems) {
    if (!list.includes(item.packageId)) {
      list.push(item.packageId);
    }
  }
  return list;
}

function getPortalRechargePackageOverrideConnections(packageId) {
  const normalized = String(packageId || '').trim();
  if (!normalized) return [];
  return state.brands
    .filter((brand) =>
      asArray(state.portalAppDetails[brand.brandId]?.rechargePackageBindings).some(
        (item) => String(item?.packageId || item?.package_id || '').trim() === normalized && item?.enabled !== false,
      ),
    )
    .map((brand) => ({
      brand_id: brand.brandId,
      display_name: brand.displayName,
    }));
}

function normalizeMenuCatalogItem(item, index = 0) {
  const raw = asObject(item);
  const key = String(raw.menuKey || raw.menu_key || raw.key || '').trim();
  if (!key) return null;
  return {
    key,
    label: String(raw.displayName || raw.display_name || raw.label || titleizeKey(key)).trim() || titleizeKey(key),
    category: String(raw.category || '').trim() || 'sidebar',
    routeKey: String(raw.routeKey || raw.route_key || '').trim(),
    iconKey: String(raw.iconKey || raw.icon_key || '').trim(),
    metadata: asObject(raw.metadata),
    active: raw.active !== false,
    sortOrder: Number(raw.sortOrder || raw.sort_order || (index + 1) * 10) || (index + 1) * 10,
  };
}

function getMenuCatalogItems() {
  return asArray(state.menuCatalog)
    .map((item, index) => normalizeMenuCatalogItem(item, index))
    .filter(Boolean);
}

function getManageableMenuCatalogItems() {
  return getMenuCatalogItems().filter((item) => item.category !== 'legacy' && !SYSTEM_MANAGED_MENU_KEYS.has(item.key));
}

function isMenuEnabledByDefault(menu) {
  const item = normalizeMenuCatalogItem(menu);
  if (!item) return false;
  const metadata = asObject(item.metadata);
  if (metadata.enabled_by_default !== undefined) {
    return metadata.enabled_by_default === true;
  }
  if (metadata.enabledByDefault !== undefined) {
    return metadata.enabledByDefault === true;
  }
  return false;
}

function getMenuDefinition(menuKey) {
  const normalized = String(menuKey || '').trim();
  const match = getMenuCatalogItems().find((item) => item.key === normalized);
  if (match) return match;
  if (!normalized) return null;
  return {
    key: normalized,
    label: titleizeKey(normalized),
    category: 'legacy',
    routeKey: '',
    iconKey: '',
    metadata: {},
    active: true,
    sortOrder: 9999,
  };
}

function getMenuIconOptions() {
  const options = [['', '默认图标']];
  const seen = new Set(['']);
  for (const item of getMenuCatalogItems()) {
    const value = String(item.iconKey || item.key || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push([value, item.label]);
  }
  return options;
}

function getIconOptionLabel(options, value) {
  const normalized = String(value || '').trim();
  const match = asArray(options).find(([optionValue]) => String(optionValue || '').trim() === normalized);
  return match?.[1] || normalized || '默认图标';
}

function renderIconChoiceGroup(name, selectedValue, options) {
  const currentValue = String(selectedValue || '').trim();
  return `
    <div class="icon-choice-group" role="radiogroup" aria-label="${escapeHtml(name)}">
      ${options
        .map(([value, label]) => {
          const normalizedValue = String(value || '').trim();
          const checked = normalizedValue === currentValue;
          return `
            <label class="icon-choice">
              <input class="visually-hidden" type="radio" name="${escapeHtml(name)}" value="${escapeHtml(normalizedValue)}"${checked ? ' checked' : ''} />
              <span class="icon-choice__card">
                <span class="icon-choice__icon">${renderIconPreview(normalizedValue, 'icon-choice__svg')}</span>
                <span class="icon-choice__label">${escapeHtml(label || normalizedValue || '默认')}</span>
              </span>
            </label>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderIconSelector(name, selectedValue, options, selectorLabel = '选择图标') {
  const currentValue = String(selectedValue || '').trim();
  return `
    <div class="icon-selector">
      <span class="icon-selector__preview">${renderIconPreview(currentValue, 'icon-selector__svg')}</span>
      <div class="icon-selector__body">
        <select class="field-select" name="${escapeHtml(name)}">
          ${options
            .map(([value, label]) => {
              const normalizedValue = String(value || '').trim();
              return `<option value="${escapeHtml(normalizedValue)}"${normalizedValue === currentValue ? ' selected' : ''}>${escapeHtml(label || normalizedValue || '默认图标')}</option>`;
            })
            .join('')}
        </select>
        <span class="icon-selector__hint">${escapeHtml(selectorLabel)}，当前：${escapeHtml(getIconOptionLabel(options, currentValue))}</span>
      </div>
    </div>
  `;
}

function normalizeComposerControlOption(item, index = 0) {
  const raw = asObject(item);
  const optionValue = String(raw.optionValue || raw.option_value || raw.value || '').trim();
  if (!optionValue) return null;
  return {
    optionValue,
    label: String(raw.label || titleizeKey(optionValue)).trim() || titleizeKey(optionValue),
    description: String(raw.description || raw.detail || '').trim(),
    sortOrder: Number(raw.sortOrder || raw.sort_order || (index + 1) * 10) || (index + 1) * 10,
    metadata: asObject(raw.metadata),
    active: raw.active !== false,
  };
}

function normalizeComposerControlCatalogItem(item, index = 0) {
  const raw = asObject(item);
  const controlKey = String(raw.controlKey || raw.control_key || '').trim();
  if (!controlKey) return null;
  return {
    controlKey,
    displayName: String(raw.displayName || raw.display_name || titleizeKey(controlKey)).trim() || titleizeKey(controlKey),
    controlType: String(raw.controlType || raw.control_type || 'static').trim() || 'static',
    iconKey: String(raw.iconKey || raw.icon_key || '').trim(),
    metadata: asObject(raw.metadata),
    active: raw.active !== false,
    sortOrder: Number(raw.sortOrder || raw.sort_order || (index + 1) * 10) || (index + 1) * 10,
    options: asArray(raw.options).map((option, optionIndex) => normalizeComposerControlOption(option, optionIndex)).filter(Boolean),
  };
}

function normalizeComposerShortcutCatalogItem(item, index = 0) {
  const raw = asObject(item);
  const shortcutKey = String(raw.shortcutKey || raw.shortcut_key || '').trim();
  if (!shortcutKey) return null;
  return {
    shortcutKey,
    displayName: String(raw.displayName || raw.display_name || titleizeKey(shortcutKey)).trim() || titleizeKey(shortcutKey),
    description: String(raw.description || '').trim(),
    template: String(raw.template || raw.template_text || '').trim(),
    iconKey: String(raw.iconKey || raw.icon_key || '').trim(),
    tone: String(raw.tone || '').trim(),
    metadata: asObject(raw.metadata),
    active: raw.active !== false,
    sortOrder: Number(raw.sortOrder || raw.sort_order || (index + 1) * 10) || (index + 1) * 10,
  };
}

function getComposerControlCatalogItems() {
  return asArray(state.composerControlCatalog)
    .map((item, index) => normalizeComposerControlCatalogItem(item, index))
    .filter(Boolean)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.controlKey.localeCompare(right.controlKey, 'zh-CN'));
}

function getComposerShortcutCatalogItems() {
  return asArray(state.composerShortcutCatalog)
    .map((item, index) => normalizeComposerShortcutCatalogItem(item, index))
    .filter(Boolean)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.shortcutKey.localeCompare(right.shortcutKey, 'zh-CN'));
}

function getComposerControlDefinition(controlKey) {
  const normalized = String(controlKey || '').trim();
  const match = getComposerControlCatalogItems().find((item) => item.controlKey === normalized);
  if (match) return match;
  if (!normalized) return null;
  return {
    controlKey: normalized,
    displayName: titleizeKey(normalized),
    controlType: 'static',
    iconKey: '',
    metadata: {},
    active: true,
    sortOrder: 9999,
    options: [],
  };
}

function getComposerShortcutDefinition(shortcutKey) {
  const normalized = String(shortcutKey || '').trim();
  const match = getComposerShortcutCatalogItems().find((item) => item.shortcutKey === normalized);
  if (match) return match;
  if (!normalized) return null;
  return {
    shortcutKey: normalized,
    displayName: titleizeKey(normalized),
    description: '',
    template: '',
    iconKey: '',
    tone: '',
    metadata: {},
    active: true,
    sortOrder: 9999,
  };
}

function normalizeComposerControlDraftConfig(value) {
  const config = asObject(value);
  return {
    displayName: String(config.display_name || config.displayName || '').trim(),
    iconKey: String(config.icon_key || config.iconKey || '').trim(),
    allowedOptionValues: asStringArray(config.allowed_option_values || config.allowedOptionValues),
  };
}

function normalizeComposerShortcutDraftConfig(value) {
  const config = asObject(value);
  return {
    displayName: String(config.display_name || config.displayName || '').trim(),
    description: String(config.description || config.subtitle || '').trim(),
    template: String(config.template || config.template_text || '').trim(),
    iconKey: String(config.icon_key || config.iconKey || '').trim(),
    tone: String(config.tone || '').trim(),
  };
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
  avatarUrl:
    'https://images.unsplash.com/photo-1581065178047-8ee15951ede6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBhc2lhbiUyMHdvbWFuJTIwYnVzaW5lc3N8ZW58MXx8fHwxNzc0MjgzMTg0fDA&ixlib=rb-4.1.0&q=80&w=1080',
  backgroundImageUrl:
    'https://images.unsplash.com/photo-1760172287483-02d382f63a6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVnYW50JTIwYWJzdHJhY3QlMjBnb2xkJTIwZ3JhZGllbnR8ZW58MXx8fHwxNzc0MjgzMTgzfDA&ixlib=rb-4.1.0&q=80&w=1080',
  primaryColor: '#C4975F',
  description: '我会用我 10 年的投资框架和市场洞察，帮你理解复杂的金融市场，找到适合你的投资路径。',
  expertiseAreas: ['价值投资', '资产配置', '长期持有策略', '市场周期分析'],
  targetAudience: '希望建立长期投资思维的理性投资者。',
  disclaimer: '本智囊提供的所有信息仅供学习参考，不构成投资建议。投资有风险，决策需谨慎。',
  quickActions: DEFAULT_WELCOME_QUICK_ACTIONS,
};
const WELCOME_ASSEMBLY_PRESETS = [
  {
    key: 'wealth',
    label: '理财版',
    description: '强调长期配置、组合诊断和理性投资陪伴的 Welcome 模板。',
    config: {
      entry_label: '面向粉丝开放的 K2C 服务入口',
      kol_name: '林安',
      expert_name: '林安的财富顾问',
      slogan: '用长期主义管理波动，用纪律守住回报',
      avatar_url:
        'https://images.unsplash.com/photo-1573497491765-cf4147d9d62f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
      background_image_url:
        'https://images.unsplash.com/photo-1516321497487-e288fb19713f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
      primary_color: '#B68B4C',
      description: '我会围绕组合体检、基金筛选、资产配置和长期持有策略，帮你把复杂的理财问题拆成可执行判断。',
      expertise_areas: ['资产配置', '基金分析', '组合诊断', '长期配置'],
      target_audience: '希望稳步提升认知、重视回撤管理和长期目标的理性投资者。',
      disclaimer: '内容仅供学习与研究参考，不构成任何收益承诺或投资建议。',
      quick_actions: [
        {label: '组合诊断', prompt: '帮我看看当前组合的风险暴露、仓位分布和是否需要再平衡。', icon_key: 'PieChart'},
        {label: '基金筛选', prompt: '帮我筛一下适合长期配置的基金或 ETF，并解释适用场景。', icon_key: 'TrendingUp'},
        {label: '风险提示', prompt: '基于当前市场环境，提示我组合里最需要注意的风险点。', icon_key: 'ShieldCheck'},
        {label: '长期计划', prompt: '如果目标是 3 到 5 年长期投资，现在应该如何制定配置计划？', icon_key: 'Lightbulb'},
      ],
    },
  },
  {
    key: 'broker',
    label: '券商版',
    description: '强调行情、财报、板块和标的研究的 Welcome 模板。',
    config: {
      entry_label: '面向交易用户开放的研究服务入口',
      kol_name: '周策',
      expert_name: '周策的交易研究席',
      slogan: '先抓主线，再看估值，最后回到交易纪律',
      avatar_url:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
      background_image_url:
        'https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
      primary_color: '#4F82C9',
      description: '我会围绕盘中主线、财报预期差、行业轮动和估值框架，快速给你研究线索与结论。',
      expertise_areas: ['盘面复盘', '财报解读', '行业轮动', '估值比较'],
      target_audience: '需要更快形成盘面判断、跟踪主线并输出研究结论的专业投资者。',
      disclaimer: '所有内容仅供研究交流，不构成买卖建议，盘中波动请结合风险承受能力独立决策。',
      quick_actions: [
        {label: '盘面复盘', prompt: '复盘今天市场，说明指数、板块、资金风格和背后的驱动。', icon_key: 'TrendingUp'},
        {label: '财报速读', prompt: '解读最新财报，重点看增长、利润率、现金流和管理层指引。', icon_key: 'Search'},
        {label: '板块机会', prompt: '当前哪些板块更值得重点跟踪？为什么？', icon_key: 'Lightbulb'},
        {label: '标的对比', prompt: '请对比两个候选标的的商业模式、估值和主要风险。', icon_key: 'MessageCircle'},
      ],
    },
  },
  {
    key: 'advisor',
    label: '投顾版',
    description: '强调顾问陪伴、客户沟通和组合建议的 Welcome 模板。',
    config: {
      entry_label: '面向客户开放的投顾服务入口',
      kol_name: '顾言',
      expert_name: '顾言的投顾助手',
      slogan: '把复杂市场翻译成客户能听懂的行动建议',
      avatar_url:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
      background_image_url:
        'https://images.unsplash.com/photo-1519389950473-47ba0277781c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
      primary_color: '#8E6BBE',
      description: '我会从组合解释、客户沟通、风险提示和顾问交付四个角度，帮你更高效地服务客户。',
      expertise_areas: ['客户陪伴', '组合解释', '顾问交付', '风险提示'],
      target_audience: '需要把研究结论转成顾问服务、陪伴沟通和客户交付的投顾团队。',
      disclaimer: '内容仅供顾问内部研究与沟通参考，正式服务需遵循适当性、合规和风险披露要求。',
      quick_actions: [
        {label: '客户话术', prompt: '把当前市场判断整理成适合客户沟通的话术和重点结论。', icon_key: 'MessageCircle'},
        {label: '组合回顾', prompt: '帮我生成一段组合回顾，解释近期表现、风险和后续建议。', icon_key: 'PieChart'},
        {label: '风险说明', prompt: '把这次调整涉及的风险点和适当性提示整理清楚。', icon_key: 'ShieldCheck'},
        {label: '服务建议', prompt: '基于当前组合和市场环境，下一步顾问服务该怎么推进？', icon_key: 'Sparkles'},
      ],
    },
  },
];
const WELCOME_ACTION_ICON_OPTIONS = [
  ['', '默认'],
  ['TrendingUp', '趋势上涨'],
  ['PieChart', '饼图'],
  ['Search', '搜索'],
  ['Lightbulb', '灯泡'],
  ['MessageCircle', '消息'],
  ['Sparkles', '火花'],
  ['ShieldCheck', '盾牌'],
];

const DEFAULT_HEADER_QUOTES = [
  {label: '沪深300', value: '3,942.18', change: 0.86, changePercent: '+0.86%'},
  {label: '深证成指', value: '11,248.72', change: -0.42, changePercent: '-0.42%'},
  {label: '银行指数', value: '5,184.33', change: 0.57, changePercent: '+0.57%'},
  {label: '现货黄金', value: '2,184.60', change: 0.34, changePercent: '+0.34%'},
];

const DEFAULT_HEADER_HEADLINES = [
  {title: '央国企红利与低波资产继续受到中长期资金关注', source: '策略晨会', href: ''},
  {title: 'TMT 交易拥挤度回升，成长风格短线波动可能放大', source: '市场监控', href: ''},
  {title: '组合回撤预警、仓位管理与再平衡建议已接入顶部策略栏', source: '系统提示', href: ''},
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

const DEFAULT_HOME_WEB_SURFACE_CONFIG = {
  website: {
    homeTitle: 'iClaw 官网',
    metaDescription: 'iClaw 官网，面向普通用户的本地 AI 客户端。',
    brandLabel: 'iClaw',
    kicker: 'Official Website',
    heroTitlePre: '让AI真正像软件一样',
    heroTitleMain: '装上就能用！',
    heroDescription: 'iClaw 面向普通用户设计。少一点配置，多一点结果。打开、提问、执行、拿答案。',
    topCtaLabel: '下载',
    scrollLabel: '向下下载',
    downloadTitle: '下载 iClaw',
  },
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
const AUTH_AGREEMENT_LABELS = {
  service: '服务协议',
  privacy: '隐私说明',
  billing: '龙虾币计费规则',
};

function buildDefaultAuthExperiencePreset(brandId, displayName, legalName) {
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

function normalizeAuthAgreementDraft(value, fallback) {
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

function normalizeAuthExperienceConfig(value, options = {}) {
  const config = asObject(value);
  const preset = buildDefaultAuthExperiencePreset(options.brandId, options.displayName, options.legalName);
  const rawAgreementMap = new Map(
    asArray(config.agreements || config.items)
      .map((item) => normalizeAuthAgreementDraft(item, {}))
      .filter((item) => item.key)
      .map((item) => [item.key, item]),
  );
  const fallbackAgreementMap = new Map(
    asArray(preset.agreements)
      .map((item) => normalizeAuthAgreementDraft(item, {}))
      .filter((item) => item.key)
      .map((item) => [item.key, item]),
  );
  return {
    title: String(config.title || preset.title || '').trim(),
    subtitle: String(config.subtitle || preset.subtitle || '').trim(),
    socialNotice: String(config.social_notice || config.socialNotice || preset.socialNotice || '').trim(),
    agreements: AUTH_AGREEMENT_ORDER.map((key) =>
      normalizeAuthAgreementDraft(rawAgreementMap.get(key), fallbackAgreementMap.get(key) || {key, title: AUTH_AGREEMENT_LABELS[key]}),
    ),
  };
}

function buildAuthExperienceConfigFromBuffer(value, options = {}) {
  const next = normalizeAuthExperienceConfig(value, options);
  return {
    title: next.title,
    subtitle: next.subtitle,
    social_notice: next.socialNotice,
    agreements: next.agreements.map((item) => ({
      key: item.key,
      title: item.title,
      version: item.version,
      effective_date: item.effectiveDate,
      summary: item.summary,
      content: item.content,
    })),
  };
}

function normalizeWelcomeQuickAction(value, index = 0) {
  const raw = asObject(value);
  return {
    label: String(raw.label || DEFAULT_WELCOME_QUICK_ACTIONS[index]?.label || '').trim(),
    prompt: String(raw.prompt || DEFAULT_WELCOME_QUICK_ACTIONS[index]?.prompt || '').trim(),
    iconKey: String(raw.icon_key || raw.iconKey || raw.icon || DEFAULT_WELCOME_QUICK_ACTIONS[index]?.iconKey || '').trim(),
  };
}

function normalizeWelcomeSurfaceConfig(value) {
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
    backgroundImageUrl: String(
      config.background_image_url || config.backgroundImageUrl || config.backgroundImage || DEFAULT_WELCOME_SURFACE_CONFIG.backgroundImageUrl,
    ).trim(),
    primaryColor: String(config.primary_color || config.primaryColor || DEFAULT_WELCOME_SURFACE_CONFIG.primaryColor).trim(),
    description: String(config.description || DEFAULT_WELCOME_SURFACE_CONFIG.description).trim(),
    expertiseAreas: areas.length ? areas : [...DEFAULT_WELCOME_SURFACE_CONFIG.expertiseAreas],
    targetAudience: String(config.target_audience || config.targetAudience || DEFAULT_WELCOME_SURFACE_CONFIG.targetAudience).trim(),
    disclaimer: String(config.disclaimer || DEFAULT_WELCOME_SURFACE_CONFIG.disclaimer).trim(),
    quickActions: Array.from({length: 4}, (_, index) => ({
      ...normalizeWelcomeQuickAction(DEFAULT_WELCOME_QUICK_ACTIONS[index], index),
      ...(quickActions[index] || {}),
    })),
  };
}

function buildWelcomeSurfaceConfigFromBuffer(welcome) {
  const next = normalizeWelcomeSurfaceConfig(welcome);
  return {
    entry_label: next.entryLabel,
    kol_name: next.kolName,
    expert_name: next.expertName,
    slogan: next.slogan,
    avatar_url: next.avatarUrl,
    background_image_url: next.backgroundImageUrl,
    primary_color: next.primaryColor,
    description: next.description,
    expertise_areas: [...next.expertiseAreas],
    target_audience: next.targetAudience,
    disclaimer: next.disclaimer,
    quick_actions: next.quickActions
      .map((item) => ({
        label: String(item.label || '').trim(),
        prompt: String(item.prompt || '').trim(),
        icon_key: String(item.iconKey || '').trim(),
      }))
      .filter((item) => item.label || item.prompt || item.icon_key),
  };
}

function normalizeHomeWebSurfaceConfig(value) {
  const config = asObject(value);
  const website = asObject(config.website);
  return {
    homeTitle: String(website.homeTitle || DEFAULT_HOME_WEB_SURFACE_CONFIG.website.homeTitle).trim(),
    metaDescription: String(website.metaDescription || DEFAULT_HOME_WEB_SURFACE_CONFIG.website.metaDescription).trim(),
    brandLabel: String(website.brandLabel || DEFAULT_HOME_WEB_SURFACE_CONFIG.website.brandLabel).trim(),
    kicker: String(website.kicker || DEFAULT_HOME_WEB_SURFACE_CONFIG.website.kicker).trim(),
    heroTitlePre: String(website.heroTitlePre || DEFAULT_HOME_WEB_SURFACE_CONFIG.website.heroTitlePre).trim(),
    heroTitleMain: String(website.heroTitleMain || DEFAULT_HOME_WEB_SURFACE_CONFIG.website.heroTitleMain).trim(),
    heroDescription: String(website.heroDescription || DEFAULT_HOME_WEB_SURFACE_CONFIG.website.heroDescription).trim(),
    topCtaLabel: String(website.topCtaLabel || DEFAULT_HOME_WEB_SURFACE_CONFIG.website.topCtaLabel).trim(),
    scrollLabel: String(website.scrollLabel || DEFAULT_HOME_WEB_SURFACE_CONFIG.website.scrollLabel).trim(),
    downloadTitle: String(website.downloadTitle || DEFAULT_HOME_WEB_SURFACE_CONFIG.website.downloadTitle).trim(),
  };
}

function buildHomeWebSurfaceConfigFromBuffer(homeWeb) {
  const next = normalizeHomeWebSurfaceConfig({website: homeWeb});
  return {
    website: {
      homeTitle: next.homeTitle,
      metaDescription: next.metaDescription,
      brandLabel: next.brandLabel,
      kicker: next.kicker,
      heroTitlePre: next.heroTitlePre,
      heroTitleMain: next.heroTitleMain,
      heroDescription: next.heroDescription,
      topCtaLabel: next.topCtaLabel,
      scrollLabel: next.scrollLabel,
      downloadTitle: next.downloadTitle,
    },
  };
}

function normalizeInputSurfaceConfig(value) {
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

function buildInputSurfaceConfigFromBuffer(input) {
  const next = normalizeInputSurfaceConfig(input);
  return {
    placeholder_text: next.placeholderText,
  };
}

function normalizeSidebarSurfaceConfig(value) {
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

function buildSidebarSurfaceConfigFromBuffer(sidebar) {
  const next = normalizeSidebarSurfaceConfig(sidebar);
  return {
    variant: next.variant,
    brandBlock: {
      title: next.brandTitle,
      subtitle: next.brandSubtitle,
    },
    layout: {
      sectionStyle: next.sectionStyle,
      emphasizeActiveItem: next.emphasizeActiveItem,
    },
  };
}

function normalizeDesktopShellConfig(value) {
  const config = asObject(value);
  return {
    websiteTitle: String(config.websiteTitle || config.website_title || DEFAULT_DESKTOP_SHELL_CONFIG.websiteTitle).trim(),
    devWebsiteTitle: String(config.devWebsiteTitle || config.dev_website_title || DEFAULT_DESKTOP_SHELL_CONFIG.devWebsiteTitle).trim(),
    sidebarTitle: String(config.sidebarTitle || config.sidebar_title || DEFAULT_DESKTOP_SHELL_CONFIG.sidebarTitle).trim(),
    devSidebarTitle: String(config.devSidebarTitle || config.dev_sidebar_title || DEFAULT_DESKTOP_SHELL_CONFIG.devSidebarTitle).trim(),
    sidebarSubtitle: String(config.sidebarSubtitle || config.sidebar_subtitle || DEFAULT_DESKTOP_SHELL_CONFIG.sidebarSubtitle).trim(),
    legalName: String(config.legalName || config.legal_name || DEFAULT_DESKTOP_SHELL_CONFIG.legalName).trim(),
    bundleIdentifier: String(config.bundleIdentifier || config.bundle_identifier || DEFAULT_DESKTOP_SHELL_CONFIG.bundleIdentifier).trim(),
    authService: String(config.authService || config.auth_service || DEFAULT_DESKTOP_SHELL_CONFIG.authService).trim(),
  };
}

function normalizeHeaderQuoteDraft(value, index = 0) {
  const raw = asObject(value);
  const defaults = DEFAULT_HEADER_QUOTES[index] || DEFAULT_HEADER_QUOTES[DEFAULT_HEADER_QUOTES.length - 1] || {};
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

function normalizeHeaderHeadlineDraft(value, index = 0) {
  const raw = asObject(value);
  const defaults =
    DEFAULT_HEADER_HEADLINES[index] || DEFAULT_HEADER_HEADLINES[DEFAULT_HEADER_HEADLINES.length - 1] || {};
  return {
    title: String(raw.title || defaults.title || '').trim(),
    source: String(raw.source || defaults.source || '').trim(),
    href: String(raw.href || raw.url || defaults.href || '').trim(),
  };
}

function normalizeHeaderSurfaceConfig(value) {
  const config = asObject(value);
  const quotes = asArray(config.fallback_quotes ?? config.fallbackQuotes ?? config.quotes)
    .map((item, index) => normalizeHeaderQuoteDraft(item, index))
    .filter((item) => item.label);
  const headlines = asArray(config.fallback_headlines ?? config.fallbackHeadlines ?? config.headlines)
    .map((item, index) => normalizeHeaderHeadlineDraft(item, index))
    .filter((item) => item.title);

  return {
    statusLabel:
      String(config.status_label || config.statusLabel || config.badge_label || config.badgeLabel || DEFAULT_HEADER_SURFACE_CONFIG.statusLabel).trim(),
    liveStatusLabel:
      String(config.live_status_label || config.liveStatusLabel || DEFAULT_HEADER_SURFACE_CONFIG.liveStatusLabel).trim(),
    showLiveBadge: config.show_live_badge !== false && config.showLiveBadge !== false,
    showQuotes: config.show_quotes !== false && config.showQuotes !== false,
    showHeadlines: config.show_headlines !== false && config.showHeadlines !== false,
    showSecurityBadge: config.show_security_badge !== false && config.showSecurityBadge !== false,
    securityLabel:
      String(config.security_label || config.securityLabel || DEFAULT_HEADER_SURFACE_CONFIG.securityLabel).trim(),
    showCredits: config.show_credits !== false && config.showCredits !== false,
    showRechargeButton: config.show_recharge_button !== false && config.showRechargeButton !== false,
    rechargeLabel:
      String(config.recharge_label || config.rechargeLabel || DEFAULT_HEADER_SURFACE_CONFIG.rechargeLabel).trim(),
    showModeBadge: config.show_mode_badge !== false && config.showModeBadge !== false,
    modeBadgeLabel:
      String(config.mode_badge_label || config.modeBadgeLabel || DEFAULT_HEADER_SURFACE_CONFIG.modeBadgeLabel).trim(),
    fallbackQuotes: Array.from({length: 4}, (_, index) => ({
      ...normalizeHeaderQuoteDraft(DEFAULT_HEADER_QUOTES[index], index),
      ...(quotes[index] || {}),
    })),
    fallbackHeadlines: Array.from({length: 3}, (_, index) => ({
      ...normalizeHeaderHeadlineDraft(DEFAULT_HEADER_HEADLINES[index], index),
      ...(headlines[index] || {}),
    })),
  };
}

function buildHeaderSurfaceConfigFromBuffer(header) {
  const next = normalizeHeaderSurfaceConfig(header);
  return {
    status_label: next.statusLabel,
    live_status_label: next.liveStatusLabel,
    show_live_badge: next.showLiveBadge,
    show_quotes: next.showQuotes,
    show_headlines: next.showHeadlines,
    show_security_badge: next.showSecurityBadge,
    security_label: next.securityLabel,
    show_credits: next.showCredits,
    show_recharge_button: next.showRechargeButton,
    recharge_label: next.rechargeLabel,
    show_mode_badge: next.showModeBadge,
    mode_badge_label: next.modeBadgeLabel,
    fallback_quotes: next.fallbackQuotes.map((item) => ({
      label: String(item.label || '').trim(),
      value: String(item.value || '').trim(),
      change: Number(item.change || 0),
      change_percent: String(item.changePercent || '').trim(),
    })),
    fallback_headlines: next.fallbackHeadlines.map((item) => ({
      title: String(item.title || '').trim(),
      source: String(item.source || '').trim(),
      href: String(item.href || '').trim(),
    })),
  };
}

function buildComposerControlBindingConfig(existingValue, draftValue) {
  const next = {...asObject(existingValue)};
  delete next.display_name;
  delete next.displayName;
  delete next.icon_key;
  delete next.iconKey;
  delete next.allowed_option_values;
  delete next.allowedOptionValues;
  const draft = normalizeComposerControlDraftConfig(draftValue);
  if (draft.displayName) next.display_name = draft.displayName;
  if (draft.iconKey) next.icon_key = draft.iconKey;
  if (draft.allowedOptionValues.length) next.allowed_option_values = draft.allowedOptionValues;
  return next;
}

function buildComposerShortcutBindingConfig(existingValue, draftValue) {
  const next = {...asObject(existingValue)};
  delete next.display_name;
  delete next.displayName;
  delete next.description;
  delete next.subtitle;
  delete next.template;
  delete next.template_text;
  delete next.icon_key;
  delete next.iconKey;
  delete next.tone;
  const draft = normalizeComposerShortcutDraftConfig(draftValue);
  if (draft.displayName) next.display_name = draft.displayName;
  if (draft.description) next.description = draft.description;
  if (draft.template) next.template = draft.template;
  if (draft.iconKey) next.icon_key = draft.iconKey;
  if (draft.tone) next.tone = draft.tone;
  return next;
}

function mergeComposerControlBindings(bindings) {
  const existing = new Map(
    asArray(bindings).map((item) => {
      const entry = asObject(item);
      return [
        String(entry.controlKey || entry.control_key || '').trim(),
        {
          appName: String(entry.appName || entry.app_name || '').trim(),
          controlKey: String(entry.controlKey || entry.control_key || '').trim(),
          enabled: entry.enabled !== false,
          sortOrder: Number(entry.sortOrder || entry.sort_order || 100) || 100,
          config: asObject(entry.config || entry.config_json),
        },
      ];
    }),
  );
  const catalogItems = getComposerControlCatalogItems();
  const merged = catalogItems.map((item, index) => ({
    appName: existing.get(item.controlKey)?.appName || '',
    controlKey: item.controlKey,
    enabled: existing.get(item.controlKey)?.enabled ?? false,
    sortOrder: existing.get(item.controlKey)?.sortOrder ?? (index + 1) * 10,
    config: asObject(existing.get(item.controlKey)?.config),
  }));
  const known = new Set(catalogItems.map((item) => item.controlKey));
  const extras = Array.from(existing.values())
    .filter((item) => item.controlKey && !known.has(item.controlKey))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.controlKey.localeCompare(right.controlKey, 'zh-CN'));
  return [...merged, ...extras];
}

function mergeComposerShortcutBindings(bindings) {
  const existing = new Map(
    asArray(bindings).map((item) => {
      const entry = asObject(item);
      return [
        String(entry.shortcutKey || entry.shortcut_key || '').trim(),
        {
          appName: String(entry.appName || entry.app_name || '').trim(),
          shortcutKey: String(entry.shortcutKey || entry.shortcut_key || '').trim(),
          enabled: entry.enabled !== false,
          sortOrder: Number(entry.sortOrder || entry.sort_order || 100) || 100,
          config: asObject(entry.config || entry.config_json),
        },
      ];
    }),
  );
  const catalogItems = getComposerShortcutCatalogItems();
  const merged = catalogItems.map((item, index) => ({
    appName: existing.get(item.shortcutKey)?.appName || '',
    shortcutKey: item.shortcutKey,
    enabled: existing.get(item.shortcutKey)?.enabled ?? false,
    sortOrder: existing.get(item.shortcutKey)?.sortOrder ?? (index + 1) * 10,
    config: asObject(existing.get(item.shortcutKey)?.config),
  }));
  const known = new Set(catalogItems.map((item) => item.shortcutKey));
  const extras = Array.from(existing.values())
    .filter((item) => item.shortcutKey && !known.has(item.shortcutKey))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.shortcutKey.localeCompare(right.shortcutKey, 'zh-CN'));
  return [...merged, ...extras];
}

function buildOrderedComposerControlList(order) {
  const catalogItems = getComposerControlCatalogItems();
  const known = new Set(catalogItems.map((item) => item.controlKey));
  const list = asStringArray(order).filter((key) => known.has(key));
  for (const item of catalogItems) {
    if (!list.includes(item.controlKey)) {
      list.push(item.controlKey);
    }
  }
  return list;
}

function buildOrderedComposerShortcutList(order) {
  const catalogItems = getComposerShortcutCatalogItems();
  const known = new Set(catalogItems.map((item) => item.shortcutKey));
  const list = asStringArray(order).filter((key) => known.has(key));
  for (const item of catalogItems) {
    if (!list.includes(item.shortcutKey)) {
      list.push(item.shortcutKey);
    }
  }
  return list;
}

function moveOrderedItem(list, value, direction, builder) {
  const current = builder(list);
  const index = current.indexOf(value);
  if (index < 0) return current;
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= current.length) return current;
  const [item] = current.splice(index, 1);
  current.splice(nextIndex, 0, item);
  return current;
}

function reorderOrderedItem(list, sourceValue, targetValue, placement, builder) {
  const current = builder(list);
  const sourceIndex = current.indexOf(sourceValue);
  const targetIndex = current.indexOf(targetValue);
  if (sourceIndex < 0 || targetIndex < 0 || sourceValue === targetValue) {
    return current;
  }
  const [item] = current.splice(sourceIndex, 1);
  const normalizedTargetIndex = current.indexOf(targetValue);
  const insertIndex = placement === 'after' ? normalizedTargetIndex + 1 : normalizedTargetIndex;
  current.splice(insertIndex, 0, item);
  return current;
}

function getMenuItemsByCategory(category) {
  const menuItems = getMenuCatalogItems();
  if (!category) {
    return menuItems;
  }
  return menuItems.filter((item) => item.category === category);
}

function statusLabel(status) {
  switch (status) {
    case 'active':
      return '已启用';
    case 'disabled':
      return '已禁用';
    case 'published':
      return '已发布';
    case 'draft':
      return '草稿';
    case 'archived':
      return '已归档';
    case 'deprecated':
      return '已废弃';
    case 'staging':
      return '预发布';
    default:
      return status || '未知';
  }
}

function visibilityStateLabel(visible) {
  return visible ? '已显示' : '已隐藏';
}

function renderPresetPicker(options) {
  const presets = asArray(options?.presets);
  if (!presets.length) {
    return '';
  }
  const title = String(options?.title || '平台预置模板').trim() || '平台预置模板';
  const action = String(options?.action || '').trim();
  if (!action) {
    return '';
  }
  const attrs = asObject(options?.attrs);
  return `
    <div class="fig-card__section-copy">
      <p>${escapeHtml(title)}：</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
        ${presets
          .map((preset) => {
            const entry = asObject(preset);
            const extraAttrs = Object.entries(attrs)
              .map(([key, value]) => `data-${escapeHtml(key)}="${escapeHtml(value)}"`)
              .join(' ');
            return `
              <button
                class="capability-card"
                type="button"
                data-action="${escapeHtml(action)}"
                data-preset-key="${escapeHtml(entry.key || '')}"
                ${extraAttrs}
                style="text-align:left;"
              >
                <strong>${escapeHtml(entry.label || entry.key || '未命名模板')}</strong>
                <span>${escapeHtml(entry.description || '')}</span>
              </button>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

function installStateLabel(installed) {
  return installed ? '已安装' : '未安装';
}

function getPlatformManagedSkillSlugs() {
  return state.skillCatalog
    .filter((item) => item?.active !== false)
    .map((item) => String(item?.slug || '').trim())
    .filter(Boolean);
}

function getPlatformManagedMcpKeys() {
  return state.mcpCatalog
    .filter((item) => item?.active !== false)
    .map((item) => String(item?.mcpKey || item?.key || '').trim())
    .filter(Boolean);
}

function isPlatformManagedSkillSlug(skillSlug) {
  return Boolean(skillSlug) && getPlatformManagedSkillSlugs().includes(skillSlug);
}

function isPlatformManagedMcpKey(mcpKey) {
  return Boolean(mcpKey) && getPlatformManagedMcpKeys().includes(mcpKey);
}

function ensureEffectiveSkillSelection(selectedSkills) {
  const next = new Set(asStringArray(selectedSkills));
  getPlatformManagedSkillSlugs().forEach((skillSlug) => next.add(skillSlug));
  return Array.from(next);
}

function ensureEffectiveMcpSelection(selectedMcp) {
  const next = new Set(asStringArray(selectedMcp));
  getPlatformManagedMcpKeys().forEach((mcpKey) => next.add(mcpKey));
  return Array.from(next);
}

function getSkillBinding(detail, skillSlug) {
  return asArray(detail?.skillBindings).find((item) => String(item?.skillSlug || '').trim() === skillSlug) || null;
}

function getMcpBinding(detail, mcpKey) {
  return asArray(detail?.mcpBindings).find((item) => String(item?.mcpKey || '').trim() === mcpKey) || null;
}

function capabilityBindingCountLabel(type, count) {
  if (type === 'skill' || type === 'mcp') {
    return `${count} 个品牌已安装`;
  }
  return `${count} 个 OEM 已启用`;
}

function capabilityBindingEmptyLabel(type) {
  if (type === 'skill') return '当前没有品牌安装此技能。';
  if (type === 'mcp') return '当前没有品牌安装此 MCP。';
  return '当前没有 OEM 绑定此模型。';
}

function getCheckedInputValue(form, name) {
  const node = form.querySelector(`[name="${CSS.escape(name)}"]:checked`);
  return node instanceof HTMLInputElement ? node.value : '';
}

function getMenuLabel(menuKey) {
  return getMenuDefinition(menuKey)?.label || titleizeKey(menuKey);
}

function getMenuDisplayNameOverride(source) {
  const config = asObject(source?.config);
  return String(config.display_name || config.displayName || '').trim();
}

function normalizeMenuDraftConfig(value) {
  const config = asObject(value);
  const requires = asObject(config.requires);
  return {
    displayName: String(config.display_name || config.displayName || '').trim(),
    group: String(config.group_label || config.groupLabel || config.group || '').trim(),
    iconKey: String(config.icon_key || config.iconKey || '').trim(),
    requiresSkillSlug: String(
      requires.skill_slug || requires.skillSlug || config.requires_skill_slug || config.requiresSkillSlug || '',
    ).trim(),
    requiresMcpKey: String(
      requires.mcp_key || requires.mcpKey || config.requires_mcp_key || config.requiresMcpKey || '',
    ).trim(),
    requiresModelRef: String(
      requires.model_ref || requires.modelRef || config.requires_model_ref || config.requiresModelRef || '',
    ).trim(),
  };
}

function buildMenuBindingConfig(existingValue, draftValue) {
  const next = {...asObject(existingValue)};
  delete next.display_name;
  delete next.displayName;
  delete next.group_label;
  delete next.groupLabel;
  delete next.group;
  delete next.icon_key;
  delete next.iconKey;
  delete next.requires;
  delete next.requires_skill_slug;
  delete next.requiresSkillSlug;
  delete next.requires_mcp_key;
  delete next.requiresMcpKey;
  delete next.requires_model_ref;
  delete next.requiresModelRef;

  const draft = normalizeMenuDraftConfig(draftValue);
  if (draft.displayName) next.display_name = draft.displayName;
  if (draft.group) next.group_label = draft.group;
  if (draft.iconKey) next.icon_key = draft.iconKey;
  if (draft.requiresSkillSlug || draft.requiresMcpKey || draft.requiresModelRef) {
    next.requires = {
      ...(draft.requiresSkillSlug ? {skill_slug: draft.requiresSkillSlug} : {}),
      ...(draft.requiresMcpKey ? {mcp_key: draft.requiresMcpKey} : {}),
      ...(draft.requiresModelRef ? {model_ref: draft.requiresModelRef} : {}),
    };
  }
  return next;
}

function buildDefaultMenuOrder(bindings) {
  return mergeMenuBindings(bindings)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.menuKey.localeCompare(right.menuKey, 'zh-CN'))
    .map((item) => item.menuKey);
}

function buildOrderedMenuList(order) {
  const catalogItems = getMenuCatalogItems();
  const known = new Set(catalogItems.map((item) => item.key));
  const list = asStringArray(order).filter((key) => known.has(key));
  for (const item of catalogItems) {
    if (!list.includes(item.key)) {
      list.push(item.key);
    }
  }
  return list;
}

function buildManageableMenuOrder(order) {
  const manageableKeys = new Set(getManageableMenuCatalogItems().map((item) => item.key));
  return buildOrderedMenuList(order).filter((key) => manageableKeys.has(key));
}

function moveManageableMenuItem(list, value, direction) {
  const visible = buildManageableMenuOrder(list);
  const hidden = buildOrderedMenuList(list).filter((key) => !visible.includes(key));
  const index = visible.indexOf(value);
  if (index < 0) {
    return [...visible, ...hidden];
  }
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= visible.length) {
    return [...visible, ...hidden];
  }
  const [item] = visible.splice(index, 1);
  visible.splice(nextIndex, 0, item);
  return [...visible, ...hidden];
}

function reorderManageableMenuItems(list, sourceValue, targetValue, placement = 'before') {
  const visible = buildManageableMenuOrder(list);
  const hidden = buildOrderedMenuList(list).filter((key) => !visible.includes(key));
  const sourceIndex = visible.indexOf(sourceValue);
  const targetIndex = visible.indexOf(targetValue);
  if (sourceIndex < 0 || targetIndex < 0 || sourceValue === targetValue) {
    return [...visible, ...hidden];
  }
  const [item] = visible.splice(sourceIndex, 1);
  const normalizedTargetIndex = visible.indexOf(targetValue);
  const insertIndex = placement === 'after' ? normalizedTargetIndex + 1 : normalizedTargetIndex;
  visible.splice(insertIndex, 0, item);
  return [...visible, ...hidden];
}

function moveListItem(list, value, direction) {
  const current = buildOrderedMenuList(list);
  const index = current.indexOf(value);
  if (index < 0) return current;
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= current.length) return current;
  const [item] = current.splice(index, 1);
  current.splice(nextIndex, 0, item);
  return current;
}

function getAppConfig(source) {
  return asObject(source?.config || source?.draftConfig);
}

function getDesktopReleaseConfig(source) {
  const config = getAppConfig(source);
  const root = asObject(config.desktop_release_admin);
  const channels = asObject(root.channels);
  const ensureSnapshot = (value) => {
    const snapshot = asObject(value);
    return {
      version: String(snapshot.version || '').trim(),
      notes: String(snapshot.notes || '').trim(),
      publishedAt: String(snapshot.publishedAt || snapshot.published_at || '').trim(),
      policy: {
        mandatory: Boolean(asObject(snapshot.policy).mandatory),
        forceUpdateBelowVersion: String(
          asObject(snapshot.policy).forceUpdateBelowVersion || asObject(snapshot.policy).force_update_below_version || '',
        ).trim(),
        allowCurrentRunToFinish:
          asObject(snapshot.policy).allowCurrentRunToFinish === undefined &&
          asObject(snapshot.policy).allow_current_run_to_finish === undefined
            ? true
            : Boolean(
                asObject(snapshot.policy).allowCurrentRunToFinish ?? asObject(snapshot.policy).allow_current_run_to_finish,
              ),
        reasonCode: String(asObject(snapshot.policy).reasonCode || asObject(snapshot.policy).reason_code || '').trim(),
        reasonMessage: String(
          asObject(snapshot.policy).reasonMessage || asObject(snapshot.policy).reason_message || '',
        ).trim(),
      },
      targets: asArray(snapshot.targets).map((item) => {
        const target = asObject(item);
        return {
          platform: String(target.platform || '').trim(),
          arch: String(target.arch || '').trim(),
          installer: asObject(target.installer),
          updater: asObject(target.updater),
          signature: asObject(target.signature),
        };
      }),
    };
  };
  const ensureChannel = (value) => {
    const channel = asObject(value);
    return {
      draft: ensureSnapshot(channel.draft),
      published: ensureSnapshot(channel.published),
    };
  };
  return {
    dev: ensureChannel(channels.dev),
    prod: ensureChannel(channels.prod),
  };
}

function resolveDesktopEnforcementMode(policy) {
  const normalized = asObject(policy);
  const mandatory = Boolean(normalized.mandatory);
  const allowCurrentRunToFinish =
    normalized.allowCurrentRunToFinish === undefined &&
    normalized.allow_current_run_to_finish === undefined
      ? true
      : Boolean(normalized.allowCurrentRunToFinish ?? normalized.allow_current_run_to_finish);
  if (!mandatory) {
    return 'recommended';
  }
  return allowCurrentRunToFinish ? 'required_after_run' : 'required_now';
}

function findDesktopReleaseTarget(snapshot, platform, arch) {
  return asArray(snapshot?.targets).find((item) => item.platform === platform && item.arch === arch) || null;
}

function formatDesktopTargetLabel(platform, arch) {
  const platformLabel = platform === 'darwin' ? 'macOS' : platform === 'windows' ? 'Windows' : platform;
  return `${platformLabel} / ${arch === 'aarch64' ? 'ARM64' : arch === 'x64' ? 'x64' : arch}`;
}

function inferBinaryContentType(file) {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.dmg')) return 'application/x-apple-diskimage';
  if (name.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable';
  if (name.endsWith('.app.tar.gz') || name.endsWith('.tar.gz') || name.endsWith('.tgz')) return 'application/gzip';
  if (name.endsWith('.nsis.zip') || name.endsWith('.zip')) return 'application/zip';
  if (name.endsWith('.sig')) return 'text/plain; charset=utf-8';
  return file?.type || 'application/octet-stream';
}

function getAppBrandMeta(source) {
  const config = getAppConfig(source);
  const brandMeta = {
    ...asObject(config.brand_meta),
    ...asObject(config.brandMeta),
  };
  return {
    productName: String(
      brandMeta.productName || brandMeta.product_name || config.productName || config.product_name || '',
    ).trim(),
    tenantKey: String(
      brandMeta.tenantKey || brandMeta.tenant_key || config.tenantKey || config.tenant_key || source?.appName || source?.brandId || '',
    ).trim(),
    description: String(brandMeta.description || brandMeta.description_text || config.description || source?.description || '').trim(),
  };
}

function mapAppStatusToBrandStatus(status) {
  return status === 'disabled' ? 'disabled' : 'active';
}

function mergeMenuBindings(bindings) {
  const existing = new Map(
    asArray(bindings).map((item) => {
      const entry = asObject(item);
      return [
        String(entry.menuKey || entry.menu_key || '').trim(),
        {
          ...entry,
          menuKey: String(entry.menuKey || entry.menu_key || '').trim(),
          appName: String(entry.appName || entry.app_name || '').trim(),
          enabled: entry.enabled !== false,
          sortOrder: Number(entry.sortOrder || entry.sort_order || 100) || 100,
          config: asObject(entry.config || entry.config_json),
        },
      ];
    }),
  );
  const catalogItems = getMenuCatalogItems();
  const merged = catalogItems.map((item, index) => ({
    appName: existing.get(item.key)?.appName || '',
    menuKey: item.key,
    enabled: existing.get(item.key)?.enabled ?? false,
    sortOrder: existing.get(item.key)?.sortOrder ?? (index + 1) * 10,
    config: asObject(existing.get(item.key)?.config),
  }));
  const known = new Set(catalogItems.map((item) => item.key));
  const extras = Array.from(existing.values())
    .filter((item) => item.menuKey && !known.has(item.menuKey))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.menuKey.localeCompare(right.menuKey, 'zh-CN'))
    .map((item) => ({
      appName: item.appName || '',
      menuKey: item.menuKey,
      enabled: item.enabled ?? false,
      sortOrder: item.sortOrder ?? 9999,
      config: asObject(item.config),
    }));
  return [...merged, ...extras];
}

function adaptPortalDetail(detail) {
  if (!detail?.app) return null;
  const meta = getAppBrandMeta(detail.app);
  const config = clone(getAppConfig(detail.app));
  return {
    app: detail.app,
    brand: {
      brandId: detail.app.appName,
      displayName: detail.app.displayName,
      productName: meta.productName || detail.app.displayName,
      tenantKey: meta.tenantKey || detail.app.appName,
      description: meta.description,
      status: mapAppStatusToBrandStatus(detail.app.status),
      draftConfig: config,
      publishedConfig: config,
      updatedAt: detail.app.updatedAt,
      publishedVersion: detail.releases?.[0]?.version || 0,
    },
    skillBindings: asArray(detail.skillBindings),
    mcpBindings: asArray(detail.mcpBindings),
    modelBindings: asArray(detail.modelBindings),
    rechargePackageBindings: asArray(detail.rechargePackageBindings),
    menuBindings: mergeMenuBindings(detail.menuBindings),
    composerControlBindings: mergeComposerControlBindings(detail.composerControlBindings),
    composerShortcutBindings: mergeComposerShortcutBindings(detail.composerShortcutBindings),
    assets: asArray(detail.assets).map((item) => ({
      ...item,
      appName: item.appName,
      brandId: item.appName,
      brandDisplayName: detail.app.displayName,
      storageProvider: item.storageProvider || 's3',
      publicUrl: item.publicUrl || buildPortalAssetUrl(item.appName, item.assetKey),
      metadata: asObject(item.metadata),
      updatedAt: item.updatedAt,
    })),
    versions: asArray(detail.releases).map((item) => ({
      id: item.id,
      brandId: item.appName,
      brandDisplayName: item.appDisplayName,
      version: item.version,
      config: asObject(item.config),
      createdByName: item.createdByName,
      createdByUsername: item.createdByUsername,
      createdAt: item.createdAt,
      publishedAt: item.publishedAt,
    })),
    audit: asArray(detail.audit).map((item) => ({
      id: item.id,
      brandId: item.appName,
      brandDisplayName: item.appDisplayName,
      action: item.action,
      actorName: item.actorName,
      actorUsername: item.actorUsername,
      createdAt: item.createdAt,
      environment: 'portal',
      payload: asObject(item.payload),
    })),
  };
}

function mapPortalAppToBrand(app, detail) {
  const config = getAppConfig(detail?.app || app);
  const meta = getAppBrandMeta(detail?.app || app);
  const surfaces = Object.values(asObject(config.surfaces)).filter((surface) => asObject(surface).enabled !== false);
  const enabledSkills = asArray(detail?.skillBindings).filter((item) => item?.enabled).length;
  const enabledMcps = asArray(detail?.mcpBindings).filter((item) => item?.enabled).length;
  const enabledModels = asArray(detail?.modelBindings).filter((item) => item?.enabled).length;
  return {
    brandId: app.appName,
    displayName: app.displayName,
    productName: meta.productName || app.displayName,
    tenantKey: meta.tenantKey || app.appName,
    status: mapAppStatusToBrandStatus(app.status),
    updatedAt: app.updatedAt,
    publishedVersion: 0,
    draftConfig: clone(config),
    publishedConfig: clone(config),
    _surfaceCount: surfaces.length,
    _skillCount: enabledSkills,
    _mcpCount: enabledMcps,
    _modelCount: enabledModels,
  };
}

function buildPortalDashboard(apps, skills, mcps, detailsMap) {
  const detailList = Object.values(detailsMap).map((detail) => adaptPortalDetail(detail)).filter(Boolean);
  const recentReleases = detailList
    .flatMap((detail) => detail.versions.map((item) => ({
      id: item.id,
      display_name: detail.brand.displayName,
      version: item.version,
      published_at: item.publishedAt,
    })))
    .sort((left, right) => String(right.published_at).localeCompare(String(left.published_at)))
    .slice(0, 6);
  const recentEdits = detailList
    .flatMap((detail) => detail.audit.map((item) => ({
      id: item.id,
      display_name: detail.brand.displayName,
      action: item.action,
      actor_name: item.actorName || item.actorUsername || 'admin',
      created_at: item.createdAt,
    })))
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, 6);

  return {
    stats: {
      brands_total: apps.length,
      published_count: apps.filter((app) => app.status === 'active').length,
      draft_count: 0,
      cloud_skills_count: Number(state.cloudSkillCatalogMeta?.total || 0),
      mcp_servers_count: mcps.length,
      skills_count: skills.length,
      pending_changes_count: 0,
    },
    recent_releases: recentReleases,
    recent_edits: recentEdits,
    app_bindings: detailList.length,
  };
}

function getPortalSkillConnections(slug) {
  return state.brands
    .filter((brand) =>
      isPlatformManagedSkillSlug(slug) ||
      asArray(state.portalAppDetails[brand.brandId]?.skillBindings).some((item) => item.skillSlug === slug && item.enabled),
    )
    .map((brand) => ({
      brand_id: brand.brandId,
      display_name: brand.displayName,
    }));
}

function getPortalMcpConnections(mcpKey) {
  return state.brands
    .filter((brand) =>
      isPlatformManagedMcpKey(mcpKey) ||
      asArray(state.portalAppDetails[brand.brandId]?.mcpBindings).some((item) => item.mcpKey === mcpKey && item.enabled),
    )
    .map((brand) => ({
      brand_id: brand.brandId,
      display_name: brand.displayName,
    }));
}

function actionLabel(action) {
  switch (action) {
    case 'app_saved':
      return '保存应用配置';
    case 'skill_bindings_saved':
      return '更新 Skill 绑定';
    case 'mcp_bindings_saved':
      return '更新 MCP 绑定';
    case 'recharge_package_bindings_saved':
      return '更新充值套餐绑定';
    case 'menu_bindings_saved':
      return '更新菜单绑定';
    case 'composer_control_bindings_saved':
      return '更新输入控件绑定';
    case 'composer_shortcut_bindings_saved':
      return '更新输入快捷方式绑定';
    case 'draft_saved':
      return '保存草稿';
    case 'published':
      return '发布版本';
    case 'rollback_prepared':
      return '回滚到历史版本';
    case 'asset_upserted':
      return '更新品牌资源';
    case 'asset_deleted':
      return '删除品牌资源';
    default:
      return titleizeKey(action);
  }
}

function navIsActive(itemId) {
  if (itemId === 'brands') {
    return state.route === 'brands' || state.route === 'brand-detail';
  }
  if (itemId === 'payments') {
    return state.route === 'payments-config' || state.route === 'payments-packages' || state.route === 'payments-orders';
  }
  if (CAPABILITY_ROUTE_MODE[itemId]) {
    return state.route === itemId;
  }
  return state.route === itemId;
}

function isNavGroupCollapsed(groupId) {
  return Boolean(state.navGroupsCollapsed?.[groupId]);
}

function isCapabilityRoute(route) {
  return Boolean(CAPABILITY_ROUTE_MODE[route]);
}

function getCapabilityModeForRoute(route) {
  return CAPABILITY_ROUTE_MODE[route] || 'skills';
}

function getCapabilityRouteForMode(mode) {
  if (mode === 'mcp') return 'mcp-center';
  if (mode === 'models') return 'model-center';
  return 'skill-center';
}

function brandLastPublished(brandDetail) {
  const publishedAt = brandDetail?.versions?.[0]?.publishedAt || brandDetail?.brand?.updatedAt;
  return publishedAt ? formatRelative(publishedAt) : '未发布';
}

function statusBadge(status) {
  return `<span class="status-pill status-pill--${escapeHtml(status || 'default')}">${escapeHtml(statusLabel(status))}</span>`;
}

function renderSwitch({checked = false, action = '', attrs = '', label = '', disabled = false} = {}) {
  return `
    <button
      class="switch${checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}"
      type="button"
      role="switch"
      aria-checked="${checked ? 'true' : 'false'}"
      aria-disabled="${disabled ? 'true' : 'false'}"
      data-action="${escapeHtml(action)}"
      ${disabled ? 'disabled' : ''}
      ${attrs}
    >
      <span class="switch__track"><span class="switch__thumb"></span></span>
      ${label ? `<span class="switch__label">${escapeHtml(label)}</span>` : ''}
    </button>
  `;
}

function isImageLike(contentType, url, objectKey) {
  const source = [contentType, url, objectKey].filter(Boolean).join(' ').toLowerCase();
  return ['image/', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'].some((token) => source.includes(token));
}

function buildOemAssetUrl(brandId, assetKey) {
  return `${API_BASE_URL}/oem/asset/file?brand_id=${encodeURIComponent(brandId)}&asset_key=${encodeURIComponent(assetKey)}`;
}

function buildPortalAssetUrl(appName, assetKey) {
  return `${API_BASE_URL}/portal/asset/file?app_name=${encodeURIComponent(appName)}&asset_key=${encodeURIComponent(assetKey)}`;
}

function resolveAssetUrl(item) {
  if (item?.publicUrl) {
    return item.publicUrl;
  }
  if (item?.appName || item?.brandId) {
    return buildPortalAssetUrl(item?.appName || item?.brandId || '', item?.assetKey || '');
  }
  return buildOemAssetUrl(item?.brandId || '', item?.assetKey || '');
}

function prettyJson(value) {
  return JSON.stringify(value || {}, null, 2);
}

function normalizeMetadataEntryDraft(value, fallbackPath = '') {
  const raw = asObject(value);
  const type = String(raw.type || 'string').trim();
  return {
    path: String(raw.path || fallbackPath || '').trim(),
    type: ['string', 'number', 'boolean'].includes(type) ? type : 'string',
    value: raw.value == null ? '' : String(raw.value),
  };
}

function flattenObjectEntries(value, parentPath = '') {
  const source = asObject(value);
  return Object.entries(source).flatMap(([key, nested]) => {
    const path = parentPath ? `${parentPath}.${key}` : key;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return flattenObjectEntries(nested, path);
    }
    return [normalizeMetadataEntryDraft({
      path,
      type: typeof nested === 'number' ? 'number' : typeof nested === 'boolean' ? 'boolean' : 'string',
      value:
        typeof nested === 'string'
          ? nested
          : typeof nested === 'number' || typeof nested === 'boolean'
            ? String(nested)
            : nested == null
              ? ''
              : JSON.stringify(nested),
    })];
  });
}

function expandMetadataEntries(entries) {
  const result = {};
  for (const entry of asArray(entries)) {
    const draft = normalizeMetadataEntryDraft(entry);
    if (!draft.path) continue;
    const segments = draft.path
      .split('.')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!segments.length) continue;
    let cursor = result;
    while (segments.length > 1) {
      const segment = segments.shift();
      if (!segment) break;
      if (!cursor[segment] || typeof cursor[segment] !== 'object' || Array.isArray(cursor[segment])) {
        cursor[segment] = {};
      }
      cursor = cursor[segment];
    }
    const leaf = segments[0];
    if (!leaf) continue;
    if (draft.type === 'number') {
      const numeric = Number(draft.value);
      cursor[leaf] = Number.isFinite(numeric) ? numeric : 0;
    } else if (draft.type === 'boolean') {
      cursor[leaf] = draft.value === 'true';
    } else {
      cursor[leaf] = String(draft.value || '');
    }
  }
  return result;
}

function renderMetadataEntriesEditor({
  name,
  title,
  description = '',
  value,
  addLabel = '新增字段',
}) {
  const entries = flattenObjectEntries(value);
  const safeEntries = entries.length ? entries : [normalizeMetadataEntryDraft({}, '')];
  return `
    <section class="fig-kv-editor" data-metadata-editor="${escapeHtml(name)}">
      <div class="fig-kv-editor__head">
        <div>
          <h4>${escapeHtml(title)}</h4>
          ${description ? `<p>${escapeHtml(description)}</p>` : ''}
        </div>
        <button class="ghost-button" type="button" data-action="add-metadata-entry" data-editor-name="${escapeHtml(name)}">${escapeHtml(addLabel)}</button>
      </div>
      <div class="fig-kv-editor__stack">
        ${safeEntries
          .map(
            (entry, index) => `
              <div class="fig-kv-row" data-metadata-entry>
                <label class="field">
                  <span>字段路径</span>
                  <input class="field-input" name="${escapeHtml(name)}__path__${index}" value="${fieldValue(entry.path)}" placeholder="例如 sourceType / setup.schemaVersion" />
                </label>
                <label class="field">
                  <span>类型</span>
                  <select class="field-select" name="${escapeHtml(name)}__type__${index}">
                    <option value="string"${entry.type === 'string' ? ' selected' : ''}>文本</option>
                    <option value="number"${entry.type === 'number' ? ' selected' : ''}>数字</option>
                    <option value="boolean"${entry.type === 'boolean' ? ' selected' : ''}>布尔</option>
                  </select>
                </label>
                <label class="field">
                  <span>值</span>
                  <input class="field-input" name="${escapeHtml(name)}__value__${index}" value="${fieldValue(entry.value)}" placeholder="字段值" />
                </label>
                <button class="ghost-button fig-kv-row__remove" type="button" data-action="remove-metadata-entry">删除</button>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}

function readMetadataEntriesFromForm(form, name) {
  if (!(form instanceof Element)) {
    return [];
  }
  const rows = Array.from(form.querySelectorAll(`[data-metadata-editor="${CSS.escape(name)}"] [data-metadata-entry]`));
  return rows
    .map((row) =>
      normalizeMetadataEntryDraft({
        path: row.querySelector(`input[name^="${CSS.escape(name)}__path__"]`) instanceof HTMLInputElement
          ? row.querySelector(`input[name^="${CSS.escape(name)}__path__"]`).value
          : '',
        type: row.querySelector(`select[name^="${CSS.escape(name)}__type__"]`) instanceof HTMLSelectElement
          ? row.querySelector(`select[name^="${CSS.escape(name)}__type__"]`).value
          : 'string',
        value: row.querySelector(`input[name^="${CSS.escape(name)}__value__"]`) instanceof HTMLInputElement
          ? row.querySelector(`input[name^="${CSS.escape(name)}__value__"]`).value
          : '',
      }),
    )
    .filter((item) => item.path);
}

function getAgentEditableAvatarUrl(agent) {
  return String(asObject(agent?.metadata).avatar_url || '').trim();
}

function getAgentAvatarPresetValue(avatarUrl) {
  const matched = AGENT_AVATAR_PRESET_OPTIONS.find((item) => item.value === avatarUrl);
  if (matched) {
    return matched.value;
  }
  return avatarUrl ? '__custom__' : '';
}

function getPreferredAgentAvatarAppName() {
  const iclawBrand = state.brands.find((item) => item.brandId === 'iclaw');
  if (iclawBrand?.brandId) {
    return iclawBrand.brandId;
  }
  if (state.selectedBrandId) {
    return state.selectedBrandId;
  }
  return state.brands[0]?.brandId || '';
}

function slugifyFilename(value, fallback = 'agent-avatar') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function formatEnvPairs(env) {
  return Object.entries(asObject(env))
    .map(([key, value]) => `${key}=${String(value || '')}`)
    .join('\n');
}

function parseEnvText(raw) {
  const env = {};
  for (const line of String(raw || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)) {
    const index = line.indexOf('=');
    if (index <= 0) {
      throw new Error(`环境变量格式错误: ${line}`);
    }
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1);
    if (!key) {
      throw new Error(`环境变量 key 不能为空: ${line}`);
    }
    env[key] = value;
  }
  return env;
}

function getSkillLibraryItem(slug) {
  return state.skillLibrary.find((item) => item.slug === slug) || null;
}

function getAdminSkillCatalogEntry(slug) {
  return state.skillCatalog.find((item) => item.slug === slug) || null;
}

function getAgentCatalogEntry(slug) {
  return state.agentCatalog.find((item) => item.slug === slug) || null;
}

function getAgentSurface(agent) {
  return String(asObject(agent?.metadata).surface || '').trim() || 'general';
}

function getAgentSourceRepo(agent) {
  return String(asObject(agent?.metadata).source_repo || '').trim() || 'manual';
}

function getAgentSourceLabel(sourceRepo) {
  if (!sourceRepo || sourceRepo === 'manual') {
    return '手动维护';
  }
  if (sourceRepo === 'msitarzewski/agency-agents') {
    return 'Agency Agents';
  }
  return sourceRepo;
}

function getCloudSkillCatalogEntry(slug) {
  return state.cloudSkillCatalog.find((item) => item.slug === slug) || null;
}

function getAdminSkillCatalogQueryValue(selector, fallback = '') {
  const input = document.querySelector(selector);
  return input instanceof HTMLInputElement ? input.value.trim() : String(fallback || '').trim();
}

function buildAdminSkillCatalogPath({limit, offset, query}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit > 0 ? limit : ADMIN_SKILL_BROWSER_PAGE_SIZE));
  params.set('offset', String(offset > 0 ? offset : 0));
  if (query) {
    params.set('q', query);
  }
  return `/admin/skills/catalog?${params.toString()}`;
}

function getPersonalSkillCatalogEntry(slug) {
  return state.personalSkillCatalog.find((item) => item.slug === slug) || null;
}

function getMcpCatalogEntry(key) {
  return state.mcpCatalog.find((item) => item.key === key || item.mcpKey === key) || null;
}

function getCloudMcpCatalogEntry(key) {
  return state.cloudMcpCatalog.find((item) => item.key === key || item.mcpKey === key) || null;
}

function normalizeBillingMultiplierValue(value, fallback = 1) {
  const parsed = typeof value === 'number' ? value : Number(String(value || '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : fallback;
}

function getActiveModelProfile() {
  const selectedBrandId = String(state.selectedBrandId || '').trim();
  const platformProfile = getModelProviderProfilesByScope('platform', 'platform').find((item) => item.enabled !== false) || null;
  const override = selectedBrandId ? asObject(state.modelProviderOverrides[selectedBrandId]) : null;
  const appProfile =
    selectedBrandId && override.providerMode === 'use_app_profile'
      ? getModelProviderProfilesByScope('app', selectedBrandId).find((item) => item.enabled !== false) || null
      : null;
  return appProfile || platformProfile || null;
}

function normalizeModelProfileEntry(profile, item, index = 0) {
  const profileData = asObject(profile);
  const model = asObject(item);
  const providerId = String(profileData.providerKey || '').trim();
  const modelId = String(model.modelId || '').trim();
  const ref = String(model.modelRef || '').trim() || (providerId && modelId ? `${providerId}/${modelId}` : '');
  if (!ref) {
    return null;
  }
  const active = model.enabled !== false;
  return {
    ref,
    label: String(model.label || modelId || ref).trim() || ref,
    providerId,
    modelId,
    logoPresetKey: String(model.logoPresetKey || '').trim(),
    billingMultiplier: normalizeBillingMultiplierValue(model.billingMultiplier ?? model.billing_multiplier, 1),
    reasoning: model.reasoning === true,
    active,
    enabled: active,
    sortOrder: Number(model.sortOrder || model.sort_order || (index + 1) * 10) || (index + 1) * 10,
  };
}

function findAnyModelProfileEntry(ref) {
  const normalizedRef = String(ref || '').trim();
  if (!normalizedRef) return null;
  for (const profile of asArray(state.modelProviderProfiles)) {
    const matched = asArray(asObject(profile).models).find(
      (item) => String(asObject(item).modelRef || '').trim() === normalizedRef,
    );
    if (!matched) continue;
    return normalizeModelProfileEntry(profile, matched);
  }
  return null;
}

function getModelCatalogEntry(ref) {
  const normalizedRef = String(ref || '').trim();
  if (!normalizedRef) return null;
  const catalogEntry =
    asArray(state.modelCatalog).find((item) => String(asObject(item).ref || '').trim() === normalizedRef) || null;
  const profileEntry = findAnyModelProfileEntry(normalizedRef);
  if (catalogEntry) {
    const model = asObject(catalogEntry);
    return {
      ref: normalizedRef,
      label: String(model.label || profileEntry?.label || normalizedRef).trim() || normalizedRef,
      providerId: String(model.providerId || profileEntry?.providerId || '').trim(),
      modelId: String(model.modelId || profileEntry?.modelId || '').trim(),
      api: String(model.api || 'openai-completions').trim() || 'openai-completions',
      baseUrl: typeof model.baseUrl === 'string' ? model.baseUrl : model.baseUrl || '',
      useRuntimeOpenai: model.useRuntimeOpenai !== false,
      authHeader: model.authHeader !== false,
      reasoning: model.reasoning === true || profileEntry?.reasoning === true,
      input: asStringArray(model.input),
      contextWindow: Number(model.contextWindow || 0) || 0,
      maxTokens: Number(model.maxTokens || 0) || 0,
      metadata: asObject(model.metadata),
      logoPresetKey: String(profileEntry?.logoPresetKey || '').trim(),
      billingMultiplier: normalizeBillingMultiplierValue(profileEntry?.billingMultiplier, 1),
      active: model.active !== false,
    };
  }
  return profileEntry;
}

function getMergedSkills() {
  return state.skillCatalog
    .map((item) => {
      const connectedBrands = getPortalSkillConnections(item.slug);
      return {
        ...item,
        distribution: item.distribution || null,
        brand_count: connectedBrands.length,
        connectedBrands,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function getMergedMcpServers() {
  return state.mcpCatalog
    .map((item) => {
      const connectedBrands = getPortalMcpConnections(item.mcpKey);
      const config = asObject(item.config);
      const env = asObject(config.env);
      return {
        key: item.mcpKey,
        mcpKey: item.mcpKey,
        name: item.name || titleizeKey(item.mcpKey),
        description: item.description || '',
        enabled_by_default: item.active,
        command: typeof config.command === 'string' ? config.command : '',
        args: asArray(config.args).map((arg) => String(arg)),
        http_url: typeof config.http_url === 'string' ? config.http_url : '',
        env_keys: Object.keys(env),
        connected_brands: connectedBrands,
        connected_brand_count: connectedBrands.length,
        transport: item.transport,
        objectKey: item.objectKey,
        metadata: asObject(item.metadata),
        config,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function getPortalModelConnections(ref) {
  return Object.values(state.portalAppDetails)
    .filter(Boolean)
    .flatMap((detail) => {
      const app = detail?.app;
      if (!app) return [];
      return asArray(detail.modelBindings)
        .filter((item) => item.modelRef === ref && item.enabled)
        .map(() => ({
          brand_id: app.appName,
          display_name: app.displayName,
          status: app.status,
        }));
    });
}

function getMergedModelCatalog() {
  const profile = getActiveModelProfile();
  const profileEntries = new Map();
  asArray(profile?.models).forEach((item, index) => {
    const normalized = normalizeModelProfileEntry(profile, item, index);
    if (normalized) {
      profileEntries.set(normalized.ref, normalized);
    }
  });

  const refs = new Set([
    ...asArray(state.modelCatalog).map((item) => String(asObject(item).ref || '').trim()).filter(Boolean),
    ...profileEntries.keys(),
  ]);

  return Array.from(refs)
    .map((ref, index) => {
      const catalog = asObject(
        asArray(state.modelCatalog).find((item) => String(asObject(item).ref || '').trim() === ref) || {},
      );
      const profileEntry = profileEntries.get(ref) || null;
      const active = (Object.keys(catalog).length ? catalog.active !== false : true) && (profileEntry ? profileEntry.active !== false : true);
      const connectedBrands = getPortalModelConnections(ref);
      return {
        ref,
        label: String(catalog.label || profileEntry?.label || ref).trim() || ref,
        providerId: String(catalog.providerId || profileEntry?.providerId || '').trim(),
        modelId: String(catalog.modelId || profileEntry?.modelId || '').trim(),
        api: String(catalog.api || 'openai-completions').trim() || 'openai-completions',
        baseUrl: typeof catalog.baseUrl === 'string' ? catalog.baseUrl : catalog.baseUrl || '',
        useRuntimeOpenai: catalog.useRuntimeOpenai !== false,
        authHeader: catalog.authHeader !== false,
        reasoning: catalog.reasoning === true || profileEntry?.reasoning === true,
        input: asStringArray(catalog.input),
        contextWindow: Number(catalog.contextWindow || 0) || 0,
        maxTokens: Number(catalog.maxTokens || 0) || 0,
        metadata: asObject(catalog.metadata),
        logoPresetKey: String(profileEntry?.logoPresetKey || '').trim(),
        billingMultiplier: normalizeBillingMultiplierValue(profileEntry?.billingMultiplier, 1),
        active,
        enabled: active,
        sortOrder: profileEntry?.sortOrder ?? (index + 1) * 10,
        connectedBrands,
        connected_brand_count: connectedBrands.length,
      };
    })
    .filter((item) => item.ref)
    .filter((item) => item.active !== false)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, 'zh-CN'));
}

function getCapabilityFilterOptions() {
  const skills = getMergedSkills();
  const mcpServers = getMergedMcpServers();
  const models = getMergedModelCatalog();
  const categories = Array.from(
    new Set(
      skills
        .map((item) => String(item.category || '').trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const skillBrands = Array.from(
    new Map(
      skills
        .flatMap((item) => asArray(item.connectedBrands))
        .map((brand) => [brand.brand_id, brand]),
    ).values(),
  ).sort((left, right) => String(left.display_name || '').localeCompare(String(right.display_name || ''), 'zh-CN'));
  const mcpBrands = Array.from(
    new Map(
      mcpServers
        .flatMap((item) => asArray(item.connected_brands))
        .map((brand) => [brand.brand_id, brand]),
    ).values(),
  ).sort((left, right) => String(left.display_name || '').localeCompare(String(right.display_name || ''), 'zh-CN'));
  const transports = Array.from(
    new Set(
      mcpServers
        .map((item) => String(item.transport || '').trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const modelProviders = Array.from(
    new Set(
      models
        .map((item) => String(item.providerId || '').trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const modelBrands = Array.from(
    new Map(
      models
        .flatMap((item) => asArray(item.connectedBrands))
        .map((brand) => [brand.brand_id, brand]),
    ).values(),
  ).sort((left, right) => String(left.display_name || '').localeCompare(String(right.display_name || ''), 'zh-CN'));

  return {
    categories,
    skillBrands,
    mcpBrands,
    transports,
    modelProviders,
    modelBrands,
  };
}

function summarizeChangedAreas(currentConfig, compareConfig) {
  const keys = [
    ['brand_meta', 'brand_meta'],
    ['theme', 'theme'],
    ['assets', 'assets'],
    ['distribution', 'distribution'],
    ['endpoints', 'endpoints'],
    ['oauth', 'oauth'],
    ['surfaces', 'surfaces'],
    ['capabilities', 'capabilities'],
  ];
  return keys
    .filter(([key]) => JSON.stringify(asObject(currentConfig?.[key])) !== JSON.stringify(asObject(compareConfig?.[key])))
    .map(([, label]) => label);
}

function fieldValue(value) {
  return escapeHtml(value == null ? '' : value);
}

function metricsFromBrand(brand) {
  const draftConfig = asObject(brand?.draftConfig);
  const surfaces = Object.values(asObject(draftConfig.surfaces)).filter((surface) => asObject(surface).enabled !== false);
  return {
    surfaces: brand?._surfaceCount ?? surfaces.length,
    skills: brand?._skillCount ?? 0,
    mcpServers: brand?._mcpCount ?? 0,
    models: brand?._modelCount ?? 0,
    pendingChanges: false,
  };
}

function resetBanner() {
  state.error = '';
  state.notice = '';
}

function setError(message) {
  state.error = message;
  state.notice = '';
  render();
}

function setNotice(message) {
  state.notice = message;
  state.error = '';
  render();
}

function getModelProviderDraftKey(scopeType, scopeKey) {
  return `${String(scopeType || '').trim()}:${String(scopeKey || '').trim()}`;
}

function getMemoryEmbeddingDraftKey(scopeType, scopeKey) {
  return `${String(scopeType || '').trim()}:${String(scopeKey || '').trim()}`;
}

function buildModelProviderDraft(input = {}) {
  const profile = asObject(input.profile);
  const override = asObject(input.override);
  const metadata = asObject(profile.metadata);
  return {
    id: String(profile.id || '').trim(),
    scopeType: String(input.scopeType || profile.scopeType || '').trim(),
    scopeKey: String(input.scopeKey || profile.scopeKey || '').trim(),
    providerMode: String(input.providerMode || override.providerMode || 'inherit_platform').trim() || 'inherit_platform',
    providerKey: String(profile.providerKey || '').trim(),
    baseUrl: String(profile.baseUrl || '').trim(),
    apiKey: String(profile.apiKey || '').trim(),
    logoPresetKey: String(profile.logoPresetKey || '').trim(),
    defaultModelRef:
      String(metadata.default_model_ref || metadata.defaultModelRef || '').trim(),
    models: asArray(profile.models).map((item) => {
      const model = asObject(item);
      return {
        label: String(model.label || '').trim(),
        modelId: String(model.modelId || '').trim(),
        logoPresetKey: String(model.logoPresetKey || '').trim(),
        billingMultiplier: normalizeBillingMultiplierValue(model.billingMultiplier ?? model.billing_multiplier, 1),
      };
    }),
  };
}

function buildMemoryEmbeddingDraft(input = {}) {
  const profile = asObject(input.profile);
  return {
    id: String(profile.id || '').trim(),
    scopeType: String(input.scopeType || profile.scopeType || '').trim(),
    scopeKey: String(input.scopeKey || profile.scopeKey || '').trim(),
    providerKey: String(profile.providerKey || '').trim(),
    baseUrl: String(profile.baseUrl || '').trim(),
    apiKey: String(profile.apiKey || '').trim(),
    embeddingModel: String(profile.embeddingModel || '').trim(),
    logoPresetKey: String(profile.logoPresetKey || '').trim(),
    autoRecall: profile.autoRecall !== false,
  };
}

function captureModelProviderDraft(form) {
  if (!(form instanceof HTMLFormElement)) {
    return null;
  }
  const formData = new FormData(form);
  const scopeType = String(formData.get('scope_type') || '').trim();
  const scopeKey = String(formData.get('scope_key') || '').trim();
  if (!scopeType || !scopeKey) {
    return null;
  }
  const draft = {
    id: String(formData.get('profile_id') || '').trim(),
    scopeType,
    scopeKey,
    providerMode: String(formData.get('provider_mode') || 'inherit_platform').trim() || 'inherit_platform',
    providerKey: String(formData.get('provider_key') || '').trim(),
    baseUrl: String(formData.get('base_url') || '').trim(),
    apiKey: String(formData.get('api_key') || '').trim(),
    logoPresetKey: String(formData.get('logo_preset_key') || '').trim(),
    defaultModelRef: String(formData.get('default_model_ref') || '').trim(),
    models: Array.from(form.querySelectorAll('[data-model-provider-row="true"]')).map((row) => {
      const getValue = (name) => row.querySelector(`[name="${name}"]`);
      return {
        label: String(getValue('model_label')?.value || '').trim(),
        modelId: String(getValue('model_id')?.value || '').trim(),
        logoPresetKey: String(getValue('model_logo_preset_key')?.value || '').trim(),
        billingMultiplier: normalizeBillingMultiplierValue(getValue('model_billing_multiplier')?.value, 1),
      };
    }),
  };
  state.modelProviderDrafts[getModelProviderDraftKey(scopeType, scopeKey)] = draft;
  return draft;
}

function buildProviderDraftModelRef(providerKey, modelId) {
  const normalizedProviderKey = String(providerKey || '').trim();
  const normalizedModelId = String(modelId || '').trim();
  if (!normalizedProviderKey || !normalizedModelId) {
    return '';
  }
  return `${normalizedProviderKey}/${normalizedModelId}`;
}

function computeRuntimeTargetTriple(platform, arch) {
  const normalizedPlatform = String(platform || '').trim().toLowerCase();
  const normalizedArch = String(arch || '').trim().toLowerCase();
  if (normalizedPlatform === 'darwin' && normalizedArch === 'aarch64') {
    return 'aarch64-apple-darwin';
  }
  if (normalizedPlatform === 'darwin' && normalizedArch === 'x64') {
    return 'x86_64-apple-darwin';
  }
  if (normalizedPlatform === 'windows' && normalizedArch === 'aarch64') {
    return 'aarch64-pc-windows-msvc';
  }
  if (normalizedPlatform === 'windows' && normalizedArch === 'x64') {
    return 'x86_64-pc-windows-msvc';
  }
  if (normalizedPlatform === 'linux' && normalizedArch === 'aarch64') {
    return 'aarch64-unknown-linux-gnu';
  }
  if (normalizedPlatform === 'linux' && normalizedArch === 'x64') {
    return 'x86_64-unknown-linux-gnu';
  }
  return '';
}

function formatRuntimeTargetLabel(platform, arch) {
  const platformLabel =
    String(platform || '').trim() === 'darwin'
      ? 'macOS'
      : String(platform || '').trim() === 'windows'
        ? 'Windows'
        : String(platform || '').trim() === 'linux'
          ? 'Linux'
          : String(platform || '').trim() || 'Unknown';
  const archLabel = String(arch || '').trim() || 'unknown';
  return `${platformLabel} / ${archLabel}`;
}

function formatBytes(value) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return '未记录';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let current = size;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  const digits = current >= 100 || index === 0 ? 0 : current >= 10 ? 1 : 2;
  return `${current.toFixed(digits)} ${units[index]}`;
}

function syncRuntimeSelection() {
  if (!state.runtimeReleases.find((item) => item.id === state.selectedRuntimeReleaseId)) {
    state.selectedRuntimeReleaseId = state.runtimeReleases[0]?.id || '';
  }
  if (!state.runtimeBindings.find((item) => item.id === state.selectedRuntimeBindingId)) {
    state.selectedRuntimeBindingId = state.runtimeBindings[0]?.id || '';
  }
}

function buildRuntimeReleaseDraft(release = null) {
  const value = asObject(release);
  const platform = String(value.platform || 'darwin').trim() || 'darwin';
  const arch = String(value.arch || 'aarch64').trim() || 'aarch64';
  return {
    id: String(value.id || '').trim(),
    runtimeKind: String(value.runtimeKind || 'openclaw').trim() || 'openclaw',
    version: String(value.version || '').trim(),
    channel: String(value.channel || 'prod').trim() || 'prod',
    platform,
    arch,
    targetTriple: String(value.targetTriple || computeRuntimeTargetTriple(platform, arch)).trim(),
    artifactUrl: String(value.artifactUrl || '').trim(),
    bucketName: String(value.bucketName || '').trim(),
    objectKey: String(value.objectKey || '').trim(),
    artifactSha256: String(value.artifactSha256 || '').trim(),
    artifactSizeBytes: String(value.artifactSizeBytes || '').trim(),
    launcherRelativePath: String(value.launcherRelativePath || '').trim(),
    gitCommit: String(value.gitCommit || '').trim(),
    gitTag: String(value.gitTag || '').trim(),
    releaseVersion: String(value.releaseVersion || '').trim(),
    buildTime: String(value.buildTime || '').trim(),
    status: String(value.status || 'draft').trim() || 'draft',
  };
}

function buildRuntimeBindingDraft(binding = null) {
  const value = asObject(binding);
  const scopeType = String(value.scopeType || 'platform').trim() === 'app' ? 'app' : 'platform';
  const platform = String(value.platform || 'darwin').trim() || 'darwin';
  const arch = String(value.arch || 'aarch64').trim() || 'aarch64';
  return {
    id: String(value.id || '').trim(),
    scopeType,
    scopeKey: scopeType === 'platform' ? 'platform' : String(value.scopeKey || state.brands[0]?.brandId || '').trim(),
    runtimeKind: String(value.runtimeKind || 'openclaw').trim() || 'openclaw',
    channel: String(value.channel || 'prod').trim() || 'prod',
    platform,
    arch,
    targetTriple: String(value.targetTriple || computeRuntimeTargetTriple(platform, arch)).trim(),
    releaseId: String(value.releaseId || '').trim(),
    enabled: value.enabled !== false,
    changeReason: '',
  };
}

function captureRuntimeReleaseDraft(form) {
  if (!(form instanceof HTMLFormElement)) {
    return null;
  }
  const formData = new FormData(form);
  const platform = String(formData.get('platform') || 'darwin').trim() || 'darwin';
  const arch = String(formData.get('arch') || 'aarch64').trim() || 'aarch64';
  state.runtimeReleaseDraftBuffer = {
    id: String(formData.get('release_id') || '').trim(),
    runtimeKind: String(formData.get('runtime_kind') || 'openclaw').trim() || 'openclaw',
    version: String(formData.get('version') || '').trim(),
    channel: String(formData.get('channel') || 'prod').trim() || 'prod',
    platform,
    arch,
    targetTriple: computeRuntimeTargetTriple(platform, arch),
    artifactUrl: String(formData.get('artifact_url') || '').trim(),
    bucketName: String(formData.get('bucket_name') || '').trim(),
    objectKey: String(formData.get('object_key') || '').trim(),
    artifactSha256: String(formData.get('artifact_sha256') || '').trim(),
    artifactSizeBytes: String(formData.get('artifact_size_bytes') || '').trim(),
    launcherRelativePath: String(formData.get('launcher_relative_path') || '').trim(),
    gitCommit: String(formData.get('git_commit') || '').trim(),
    gitTag: String(formData.get('git_tag') || '').trim(),
    releaseVersion: String(formData.get('release_version') || '').trim(),
    buildTime: String(formData.get('build_time') || '').trim(),
    status: String(formData.get('status') || 'draft').trim() || 'draft',
  };
  return state.runtimeReleaseDraftBuffer;
}

function captureRuntimeBindingDraft(form) {
  if (!(form instanceof HTMLFormElement)) {
    return null;
  }
  const formData = new FormData(form);
  const scopeType = String(formData.get('scope_type') || 'platform').trim() === 'app' ? 'app' : 'platform';
  const platform = String(formData.get('platform') || 'darwin').trim() || 'darwin';
  const arch = String(formData.get('arch') || 'aarch64').trim() || 'aarch64';
  state.runtimeBindingDraftBuffer = {
    id: String(formData.get('binding_id') || '').trim(),
    scopeType,
    scopeKey: scopeType === 'platform' ? 'platform' : String(formData.get('scope_key') || '').trim(),
    runtimeKind: String(formData.get('runtime_kind') || 'openclaw').trim() || 'openclaw',
    channel: String(formData.get('channel') || 'prod').trim() || 'prod',
    platform,
    arch,
    targetTriple: computeRuntimeTargetTriple(platform, arch),
    releaseId: String(formData.get('release_id') || '').trim(),
    enabled: formData.get('enabled') === 'on',
    changeReason: String(formData.get('change_reason') || '').trim(),
  };
  return state.runtimeBindingDraftBuffer;
}

function captureMemoryEmbeddingDraft(form) {
  if (!(form instanceof HTMLFormElement)) {
    return null;
  }
  const formData = new FormData(form);
  const scopeType = String(formData.get('scope_type') || '').trim();
  const scopeKey = String(formData.get('scope_key') || '').trim();
  if (!scopeType || !scopeKey) {
    return null;
  }
  const draft = {
    id: String(formData.get('memory_profile_id') || '').trim(),
    scopeType,
    scopeKey,
    providerKey: String(formData.get('memory_provider_key') || '').trim(),
    baseUrl: String(formData.get('memory_base_url') || '').trim(),
    apiKey: String(formData.get('memory_api_key') || '').trim(),
    embeddingModel: String(formData.get('memory_embedding_model') || '').trim(),
    logoPresetKey: String(formData.get('memory_logo_preset_key') || '').trim(),
    autoRecall: formData.get('memory_auto_recall') === 'on',
  };
  state.memoryEmbeddingDrafts[getMemoryEmbeddingDraftKey(scopeType, scopeKey)] = draft;
  return draft;
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.error?.message || `Request failed with status ${response.status}`);
    error.code = payload?.error?.code || 'REQUEST_FAILED';
    throw error;
  }
  return payload.data;
}

async function refreshToken() {
  if (!state.tokens?.refresh_token) {
    return false;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: state.tokens.refresh_token,
    }),
  });

  const tokens = await parseResponse(response);
  persistTokens({
    ...state.tokens,
    ...tokens,
  });
  return true;
}

async function apiFetch(path, init = {}, options = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  if (state.tokens?.access_token) {
    headers.set('Authorization', `Bearer ${state.tokens.access_token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && !options.skipRefresh && state.tokens?.refresh_token) {
    const refreshed = await refreshToken().catch(() => false);
    if (refreshed) {
      return apiFetch(path, init, {skipRefresh: true});
    }
  }

  return parseResponse(response);
}

async function apiUploadBinary(path, file, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.tokens?.access_token) {
    headers.set('Authorization', `Bearer ${state.tokens.access_token}`);
  }
  headers.set('Content-Type', options.contentType || file.type || 'application/octet-stream');
  headers.set('x-iclaw-file-name', file.name || 'artifact.bin');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers,
    body: file,
  });

  if (response.status === 401 && state.tokens?.refresh_token) {
    const refreshed = await refreshToken().catch(() => false);
    if (refreshed) {
      return apiUploadBinary(path, file, options);
    }
  }

  return parseResponse(response);
}

async function loadCloudSkillCatalogPage(options = {}) {
  const previous = state.cloudSkillCatalogMeta || {};
  const limit = Number.isFinite(options.limit) ? Math.max(1, Number(options.limit)) : Number(previous.limit || ADMIN_SKILL_BROWSER_PAGE_SIZE);
  const offset = Number.isFinite(options.offset) ? Math.max(0, Number(options.offset)) : Number(previous.offset || 0);
  const query = typeof options.query === 'string' ? options.query.trim() : String(previous.query || '').trim();
  state.cloudSkillCatalogMeta = {
    ...previous,
    limit,
    offset,
    query,
    loading: true,
  };
  if (!options.suppressRender) {
    render();
  }
  try {
    const data = await apiFetch(buildAdminSkillCatalogPath({limit, offset, query}), {method: 'GET'});
    state.cloudSkillCatalog = Array.isArray(data.items) ? data.items : [];
    state.cloudSkillCatalogMeta = {
      total: Number(data.total || 0),
      limit: Number(data.limit || limit),
      offset: Number(data.offset || 0),
      hasMore: data.has_more === true,
      nextOffset: Number.isFinite(data.next_offset) ? Number(data.next_offset) : null,
      query,
      loading: false,
    };
    if (!state.selectedCloudSkillSlug || !state.cloudSkillCatalog.find((item) => item.slug === state.selectedCloudSkillSlug)) {
      state.selectedCloudSkillSlug = state.cloudSkillCatalog[0]?.slug || '';
    }
  } catch (error) {
    state.cloudSkillCatalogMeta = {
      ...state.cloudSkillCatalogMeta,
      loading: false,
    };
    setError(error instanceof Error ? error.message : '云技能目录加载失败');
  } finally {
    if (!options.suppressRender) {
      render();
    }
  }
}

async function loadBrandSkillCatalogPage(options = {}) {
  const previous = state.brandSkillCatalogMeta || {};
  const limit = Number.isFinite(options.limit) ? Math.max(1, Number(options.limit)) : Number(previous.limit || ADMIN_SKILL_BROWSER_PAGE_SIZE);
  const offset = Number.isFinite(options.offset) ? Math.max(0, Number(options.offset)) : Number(previous.offset || 0);
  const query = typeof options.query === 'string' ? options.query.trim() : String(previous.query || '').trim();
  state.brandSkillCatalogMeta = {
    ...previous,
    limit,
    offset,
    query,
    loading: true,
  };
  if (!options.suppressRender) {
    render();
  }
  try {
    const data = await apiFetch(buildAdminSkillCatalogPath({limit, offset, query}), {method: 'GET'});
    state.brandSkillCatalog = Array.isArray(data.items) ? data.items : [];
    state.brandSkillCatalogMeta = {
      total: Number(data.total || 0),
      limit: Number(data.limit || limit),
      offset: Number(data.offset || 0),
      hasMore: data.has_more === true,
      nextOffset: Number.isFinite(data.next_offset) ? Number(data.next_offset) : null,
      query,
      loading: false,
    };
  } catch (error) {
    state.brandSkillCatalogMeta = {
      ...state.brandSkillCatalogMeta,
      loading: false,
    };
    setError(error instanceof Error ? error.message : 'OEM 技能目录加载失败');
  } finally {
    if (!options.suppressRender) {
      render();
    }
  }
}

function buildBrandDraftBuffer(detail) {
  const brand = detail?.brand || null;
  const draftConfig = clone(asObject(brand?.draftConfig));
  const draftTheme = asObject(draftConfig.theme);
  const lightTheme = asObject(draftTheme.light);
  const darkTheme = asObject(draftTheme.dark);
  const capabilities = asObject(draftConfig.capabilities);
  const modelConfig = asObject(capabilities.models);
  const modelBindings = asArray(detail?.modelBindings);
  const selectedModels = modelBindings
    .filter((item) => item?.enabled)
    .map((item) => String(item.modelRef || '').trim())
    .filter(Boolean);
  const modelEntries = selectedModels
    .map((ref) => getModelCatalogEntry(ref) || asObject(modelBindings.find((item) => item.modelRef === ref)?.model))
    .filter((item) => item && typeof item === 'object');
  const recommendedModelsFromBindings = modelBindings
    .filter((item) => item?.enabled && asObject(item.config).recommended === true)
    .map((item) => String(item.modelRef || '').trim())
    .filter(Boolean);
  const defaultModelFromBindings =
    modelBindings.find((item) => item?.enabled && asObject(item.config).default === true)?.modelRef || '';
  const surfaceEntries = asObject(draftConfig.surfaces);
  const orderedSurfaceKeys = Array.from(
    new Set([
      ...DEFAULT_SURFACE_KEYS,
      ...Object.keys(surfaceEntries),
    ]),
  );
  const selectedMenus = mergeMenuBindings(detail?.menuBindings)
    .filter((item) => item.enabled)
    .map((item) => item.menuKey);
  const menuConfigs = Object.fromEntries(
    mergeMenuBindings(detail?.menuBindings).map((item) => [item.menuKey, normalizeMenuDraftConfig(item.config)]),
  );
  const menuOrder = buildDefaultMenuOrder(detail?.menuBindings);
  const selectedComposerControls = mergeComposerControlBindings(detail?.composerControlBindings)
    .filter((item) => item.enabled)
    .map((item) => item.controlKey);
  const composerControlConfigs = Object.fromEntries(
    mergeComposerControlBindings(detail?.composerControlBindings).map((item) => [
      item.controlKey,
      normalizeComposerControlDraftConfig(item.config),
    ]),
  );
  const composerControlOrder = mergeComposerControlBindings(detail?.composerControlBindings)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.controlKey.localeCompare(right.controlKey, 'zh-CN'))
    .map((item) => item.controlKey);
  const selectedComposerShortcuts = mergeComposerShortcutBindings(detail?.composerShortcutBindings)
    .filter((item) => item.enabled)
    .map((item) => item.shortcutKey);
  const composerShortcutConfigs = Object.fromEntries(
    mergeComposerShortcutBindings(detail?.composerShortcutBindings).map((item) => [
      item.shortcutKey,
      normalizeComposerShortcutDraftConfig(item.config),
    ]),
  );
  const composerShortcutOrder = mergeComposerShortcutBindings(detail?.composerShortcutBindings)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.shortcutKey.localeCompare(right.shortcutKey, 'zh-CN'))
    .map((item) => item.shortcutKey);
  const rechargeCatalogItems = getRechargePackageCatalogItems();
  const rechargeBindings = asArray(detail?.rechargePackageBindings)
    .map((item, index) => {
      const entry = asObject(item);
      const packageId = String(entry.packageId || entry.package_id || '').trim();
      if (!packageId) return null;
      return {
        packageId,
        enabled: entry.enabled !== false,
        sortOrder: Number(entry.sortOrder || entry.sort_order || (index + 1) * 10) || (index + 1) * 10,
        recommended: entry.recommended === true,
        default: entry.default === true || entry.is_default === true,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.packageId.localeCompare(right.packageId, 'zh-CN'));
  const useRechargePackagesOverride = rechargeBindings.length > 0;
  const rechargePackageOrder = buildOrderedRechargePackageList(
    useRechargePackagesOverride ? rechargeBindings.map((item) => item.packageId) : rechargeCatalogItems.map((item) => item.packageId),
  );
  const selectedRechargePackages = useRechargePackagesOverride
    ? rechargeBindings.filter((item) => item.enabled).map((item) => item.packageId)
    : rechargeCatalogItems.filter((item) => item.active !== false).map((item) => item.packageId);
  const recommendedRechargePackages = useRechargePackagesOverride
    ? rechargeBindings.filter((item) => item.enabled && item.recommended).map((item) => item.packageId)
    : rechargeCatalogItems.filter((item) => item.active !== false && item.recommended).map((item) => item.packageId);
  const defaultRechargePackage =
    (useRechargePackagesOverride
      ? rechargeBindings.find((item) => item.enabled && item.default)?.packageId
      : rechargeCatalogItems.find((item) => item.active !== false && item.default)?.packageId) ||
    recommendedRechargePackages[0] ||
    selectedRechargePackages[0] ||
    '';
  const meta = getAppBrandMeta(brand);
  const desktopShellConfig = normalizeDesktopShellConfig(draftConfig);
  const welcomeSurface = asObject(surfaceEntries.welcome);
  const welcomeConfig = normalizeWelcomeSurfaceConfig(asObject(welcomeSurface.config));
  const headerSurface = asObject(surfaceEntries.header);
  const headerConfig = normalizeHeaderSurfaceConfig(asObject(headerSurface.config));
  const homeWebSurface = asObject(surfaceEntries['home-web']);
  const homeWebConfig = normalizeHomeWebSurfaceConfig(asObject(homeWebSurface.config));
  const inputSurface = asObject(surfaceEntries.input);
  const inputConfig = normalizeInputSurfaceConfig(asObject(inputSurface.config));
  const sidebarSurface = asObject(surfaceEntries.sidebar);
  const sidebarConfig = normalizeSidebarSurfaceConfig(asObject(sidebarSurface.config));
  const authExperienceConfig = normalizeAuthExperienceConfig(asObject(draftConfig.auth_experience || draftConfig.authExperience), {
    brandId: brand?.brandId || '',
    displayName: brand?.displayName || '',
    legalName: desktopShellConfig.legalName,
  });

  return {
    brandId: brand?.brandId || '',
    displayName: brand?.displayName || '',
    productName: meta.productName || brand?.productName || '',
    tenantKey: meta.tenantKey || brand?.tenantKey || '',
    status: brand?.status || 'active',
    advancedJson: JSON.stringify(draftConfig, null, 2),
    theme: {
      defaultMode: isThemeMode(draftTheme.defaultMode || draftTheme.default_mode) ? (draftTheme.defaultMode || draftTheme.default_mode) : 'dark',
      lightPrimary: lightTheme.primary || '',
      lightPrimaryHover: lightTheme.primaryHover || '',
      lightOnPrimary: lightTheme.onPrimary || '',
      darkPrimary: darkTheme.primary || '',
      darkPrimaryHover: darkTheme.primaryHover || '',
      darkOnPrimary: darkTheme.onPrimary || '',
    },
    selectedSkills: ensureEffectiveSkillSelection(
      asArray(detail?.skillBindings).filter((item) => item.enabled).map((item) => item.skillSlug),
    ),
    selectedMcp: ensureEffectiveMcpSelection(
      asArray(detail?.mcpBindings).filter((item) => item.enabled).map((item) => item.mcpKey),
    ),
    useRechargePackagesOverride,
    selectedRechargePackages,
    rechargePackageOrder,
    recommendedRechargePackages,
    defaultRechargePackage,
    selectedMenus,
    menuConfigs,
    menuOrder,
    selectedComposerControls,
    composerControlConfigs,
    composerControlOrder,
    selectedComposerShortcuts,
    composerShortcutConfigs,
    composerShortcutOrder,
    selectedModels,
    recommendedModels: (recommendedModelsFromBindings.length
      ? recommendedModelsFromBindings
      : asStringArray(modelConfig.recommended)
    ).filter((ref) => selectedModels.includes(ref)),
    defaultModel: defaultModelFromBindings || (typeof modelConfig.default === 'string' && modelConfig.default.trim()) || selectedModels[0] || '',
    savedModelEntries: modelEntries.map((item) => clone(asObject(item))),
    agentsText: asStringArray(capabilities.agents).join('\n'),
    menusText: selectedMenus.join('\n'),
    desktopShell: desktopShellConfig,
    homeWeb: {
      enabled: homeWebSurface.enabled !== false,
      ...homeWebConfig,
    },
    welcome: {
      enabled: welcomeSurface.enabled !== false,
      ...welcomeConfig,
    },
    header: {
      enabled: headerSurface.enabled !== false,
      ...headerConfig,
    },
    input: {
      enabled: inputSurface.enabled !== false,
      ...inputConfig,
    },
    sidebar: {
      enabled: sidebarSurface.enabled !== false,
      ...sidebarConfig,
    },
    authExperience: authExperienceConfig,
    surfaces: orderedSurfaceKeys.map((key) => {
      const surface = asObject(surfaceEntries[key]);
      return {
        key,
        label: surfaceLabel(key),
        enabled: surface.enabled !== false,
        json: JSON.stringify(asObject(surface.config), null, 2),
      };
    }),
  };
}

function ensureBrandDraftBuffer() {
  if (!state.brandDraftBuffer && state.brandDetail?.brand) {
    state.brandDraftBuffer = buildBrandDraftBuffer(state.brandDetail);
  }
  return state.brandDraftBuffer;
}

function mergeCheckedValues(form, selector, existingValues) {
  const inputs = Array.from(form.querySelectorAll(selector));
  const next = new Set(asStringArray(existingValues));
  if (!inputs.length) {
    return Array.from(next);
  }
  inputs.forEach((node) => {
    const value = String(node.value || '').trim();
    if (!value) return;
    if (node.checked) {
      next.add(value);
    } else {
      next.delete(value);
    }
  });
  return Array.from(next);
}

function captureBrandEditorBuffer() {
  const form = document.querySelector('#brand-editor-form');
  if (!form) {
    return state.brandDraftBuffer;
  }

  const data = new FormData(form);
  const existing = clone(state.brandDraftBuffer || ensureBrandDraftBuffer() || {});
  const visibleSurfaces = Array.from(form.querySelectorAll('.surface-editor')).map((node) => ({
    key: node.getAttribute('data-surface-key') || '',
    label: node.getAttribute('data-surface-label') || '',
    enabled: Boolean(node.querySelector('input[type="checkbox"]')?.checked),
    json: String(node.querySelector('textarea')?.value || '{}'),
  }));
  const surfaceMap = new Map(asArray(existing.surfaces).map((item) => [item.key, clone(item)]));
  visibleSurfaces.forEach((surface) => {
    if (!surface.key) return;
    surfaceMap.set(surface.key, surface);
  });
  const menuConfigs = {...asObject(existing.menuConfigs)};
  for (const item of getMenuCatalogItems()) {
    const key = item.key;
    menuConfigs[key] = normalizeMenuDraftConfig({
      ...(asObject(menuConfigs[key])),
      display_name: form.querySelector(`[name="menu_display_name__${CSS.escape(key)}"]`) instanceof HTMLInputElement
        ? form.querySelector(`[name="menu_display_name__${CSS.escape(key)}"]`).value
        : asObject(menuConfigs[key]).displayName,
      group_label: form.querySelector(`[name="menu_group__${CSS.escape(key)}"]`) instanceof HTMLInputElement
        ? form.querySelector(`[name="menu_group__${CSS.escape(key)}"]`).value
        : asObject(menuConfigs[key]).group,
      icon_key:
        form.querySelector(`[name="menu_icon__${CSS.escape(key)}"]`) instanceof HTMLSelectElement
          ? form.querySelector(`[name="menu_icon__${CSS.escape(key)}"]`).value
          : getCheckedInputValue(form, `menu_icon__${key}`) || asObject(menuConfigs[key]).iconKey,
      requires: {
        skill_slug:
          form.querySelector(`[name="menu_requires_skill__${CSS.escape(key)}"]`) instanceof HTMLSelectElement
            ? form.querySelector(`[name="menu_requires_skill__${CSS.escape(key)}"]`).value
            : asObject(asObject(menuConfigs[key]).requires).skill_slug,
        mcp_key:
          form.querySelector(`[name="menu_requires_mcp__${CSS.escape(key)}"]`) instanceof HTMLSelectElement
            ? form.querySelector(`[name="menu_requires_mcp__${CSS.escape(key)}"]`).value
            : asObject(asObject(menuConfigs[key]).requires).mcp_key,
        model_ref:
          form.querySelector(`[name="menu_requires_model__${CSS.escape(key)}"]`) instanceof HTMLSelectElement
            ? form.querySelector(`[name="menu_requires_model__${CSS.escape(key)}"]`).value
            : asObject(asObject(menuConfigs[key]).requires).model_ref,
      },
    });
  }
  const composerControlConfigs = {...asObject(existing.composerControlConfigs)};
  for (const item of getComposerControlCatalogItems()) {
    const key = item.controlKey;
    const displayNameInput = form.querySelector(`[name="composer_control_display_name__${CSS.escape(key)}"]`);
    const allowedOptionsInput = form.querySelector(`[name="composer_control_allowed_options__${CSS.escape(key)}"]`);
    composerControlConfigs[key] = normalizeComposerControlDraftConfig({
      ...(asObject(composerControlConfigs[key])),
      display_name:
        displayNameInput instanceof HTMLInputElement
          ? displayNameInput.value
          : asObject(composerControlConfigs[key]).displayName,
      allowed_option_values:
        allowedOptionsInput instanceof HTMLInputElement
          ? splitLines(allowedOptionsInput.value)
          : asObject(composerControlConfigs[key]).allowedOptionValues,
    });
  }
  const composerShortcutConfigs = {...asObject(existing.composerShortcutConfigs)};
  for (const item of getComposerShortcutCatalogItems()) {
    const key = item.shortcutKey;
    const displayNameInput = form.querySelector(`[name="composer_shortcut_display_name__${CSS.escape(key)}"]`);
    const descriptionInput = form.querySelector(`[name="composer_shortcut_description__${CSS.escape(key)}"]`);
    const templateInput = form.querySelector(`[name="composer_shortcut_template__${CSS.escape(key)}"]`);
    composerShortcutConfigs[key] = normalizeComposerShortcutDraftConfig({
      ...(asObject(composerShortcutConfigs[key])),
      display_name:
        displayNameInput instanceof HTMLInputElement
          ? displayNameInput.value
          : asObject(composerShortcutConfigs[key]).displayName,
      description:
        descriptionInput instanceof HTMLInputElement
          ? descriptionInput.value
          : asObject(composerShortcutConfigs[key]).description,
      template:
        templateInput instanceof HTMLTextAreaElement
          ? templateInput.value
          : asObject(composerShortcutConfigs[key]).template,
    });
  }
  const welcomeEnabledInput = form.querySelector('[name="welcome_enabled"]');
  const homeWebEnabledInput = form.querySelector('[name="home_web_enabled"]');
  const headerEnabledInput = form.querySelector('[name="header_enabled"]');
  const inputEnabledInput = form.querySelector('[name="input_enabled"]');
  const sidebarEnabledInput = form.querySelector('[name="sidebar_enabled"]');
  const welcomeQuickActions = Array.from({length: 4}, (_, index) => ({
    label:
      form.querySelector(`[name="welcome_quick_action_label__${index}"]`) instanceof HTMLInputElement
        ? form.querySelector(`[name="welcome_quick_action_label__${index}"]`).value
        : asArray(existing.welcome?.quickActions)[index]?.label,
    prompt:
      form.querySelector(`[name="welcome_quick_action_prompt__${index}"]`) instanceof HTMLTextAreaElement
        ? form.querySelector(`[name="welcome_quick_action_prompt__${index}"]`).value
        : asArray(existing.welcome?.quickActions)[index]?.prompt,
    iconKey:
      getCheckedInputValue(form, `welcome_quick_action_icon__${index}`) || asArray(existing.welcome?.quickActions)[index]?.iconKey,
  }));
  const welcome = normalizeWelcomeSurfaceConfig({
    entry_label:
      form.querySelector('[name="welcome_entry_label"]') instanceof HTMLInputElement
        ? form.querySelector('[name="welcome_entry_label"]').value
        : existing.welcome?.entryLabel,
    kol_name:
      form.querySelector('[name="welcome_kol_name"]') instanceof HTMLInputElement
        ? form.querySelector('[name="welcome_kol_name"]').value
        : existing.welcome?.kolName,
    expert_name:
      form.querySelector('[name="welcome_expert_name"]') instanceof HTMLInputElement
        ? form.querySelector('[name="welcome_expert_name"]').value
        : existing.welcome?.expertName,
    slogan:
      form.querySelector('[name="welcome_slogan"]') instanceof HTMLInputElement
        ? form.querySelector('[name="welcome_slogan"]').value
        : existing.welcome?.slogan,
    avatar_url:
      form.querySelector('[name="welcome_avatar_url"]') instanceof HTMLInputElement
        ? form.querySelector('[name="welcome_avatar_url"]').value
        : existing.welcome?.avatarUrl,
    background_image_url:
      form.querySelector('[name="welcome_background_image_url"]') instanceof HTMLInputElement
        ? form.querySelector('[name="welcome_background_image_url"]').value
        : existing.welcome?.backgroundImageUrl,
    primary_color:
      form.querySelector('[name="welcome_primary_color"]') instanceof HTMLInputElement
        ? form.querySelector('[name="welcome_primary_color"]').value
        : existing.welcome?.primaryColor,
    description:
      form.querySelector('[name="welcome_description"]') instanceof HTMLTextAreaElement
        ? form.querySelector('[name="welcome_description"]').value
        : existing.welcome?.description,
    expertise_areas:
      form.querySelector('[name="welcome_expertise_areas"]') instanceof HTMLTextAreaElement
        ? splitLines(form.querySelector('[name="welcome_expertise_areas"]').value)
        : existing.welcome?.expertiseAreas,
    target_audience:
      form.querySelector('[name="welcome_target_audience"]') instanceof HTMLTextAreaElement
        ? form.querySelector('[name="welcome_target_audience"]').value
        : existing.welcome?.targetAudience,
    disclaimer:
      form.querySelector('[name="welcome_disclaimer"]') instanceof HTMLTextAreaElement
        ? form.querySelector('[name="welcome_disclaimer"]').value
        : existing.welcome?.disclaimer,
    quick_actions: welcomeQuickActions,
  });
  if (form.querySelector('[name="welcome_enabled"]') || form.querySelector('[name="welcome_kol_name"]')) {
    surfaceMap.set('welcome', {
      key: 'welcome',
      label: surfaceLabel('welcome'),
      enabled: welcomeEnabledInput instanceof HTMLInputElement ? welcomeEnabledInput.checked : existing.welcome?.enabled !== false,
      json: JSON.stringify(buildWelcomeSurfaceConfigFromBuffer(welcome), null, 2),
    });
  }
  const homeWeb = normalizeHomeWebSurfaceConfig({
    website: {
      homeTitle:
        form.querySelector('[name="home_web_home_title"]') instanceof HTMLInputElement
          ? form.querySelector('[name="home_web_home_title"]').value
          : existing.homeWeb?.homeTitle,
      metaDescription:
        form.querySelector('[name="home_web_meta_description"]') instanceof HTMLTextAreaElement
          ? form.querySelector('[name="home_web_meta_description"]').value
          : existing.homeWeb?.metaDescription,
      brandLabel:
        form.querySelector('[name="home_web_brand_label"]') instanceof HTMLInputElement
          ? form.querySelector('[name="home_web_brand_label"]').value
          : existing.homeWeb?.brandLabel,
      kicker:
        form.querySelector('[name="home_web_kicker"]') instanceof HTMLInputElement
          ? form.querySelector('[name="home_web_kicker"]').value
          : existing.homeWeb?.kicker,
      heroTitlePre:
        form.querySelector('[name="home_web_hero_title_pre"]') instanceof HTMLInputElement
          ? form.querySelector('[name="home_web_hero_title_pre"]').value
          : existing.homeWeb?.heroTitlePre,
      heroTitleMain:
        form.querySelector('[name="home_web_hero_title_main"]') instanceof HTMLInputElement
          ? form.querySelector('[name="home_web_hero_title_main"]').value
          : existing.homeWeb?.heroTitleMain,
      heroDescription:
        form.querySelector('[name="home_web_hero_description"]') instanceof HTMLTextAreaElement
          ? form.querySelector('[name="home_web_hero_description"]').value
          : existing.homeWeb?.heroDescription,
      topCtaLabel:
        form.querySelector('[name="home_web_top_cta_label"]') instanceof HTMLInputElement
          ? form.querySelector('[name="home_web_top_cta_label"]').value
          : existing.homeWeb?.topCtaLabel,
      scrollLabel:
        form.querySelector('[name="home_web_scroll_label"]') instanceof HTMLInputElement
          ? form.querySelector('[name="home_web_scroll_label"]').value
          : existing.homeWeb?.scrollLabel,
      downloadTitle:
        form.querySelector('[name="home_web_download_title"]') instanceof HTMLInputElement
          ? form.querySelector('[name="home_web_download_title"]').value
          : existing.homeWeb?.downloadTitle,
    },
  });
  if (form.querySelector('[name="home_web_enabled"]') || form.querySelector('[name="home_web_home_title"]')) {
    surfaceMap.set('home-web', {
      key: 'home-web',
      label: surfaceLabel('home-web'),
      enabled: homeWebEnabledInput instanceof HTMLInputElement ? homeWebEnabledInput.checked : existing.homeWeb?.enabled !== false,
      json: JSON.stringify(buildHomeWebSurfaceConfigFromBuffer(homeWeb), null, 2),
    });
  }
  const header = normalizeHeaderSurfaceConfig({
    status_label:
      form.querySelector('[name="header_status_label"]') instanceof HTMLInputElement
        ? form.querySelector('[name="header_status_label"]').value
        : '',
    live_status_label:
      form.querySelector('[name="header_live_status_label"]') instanceof HTMLInputElement
        ? form.querySelector('[name="header_live_status_label"]').value
        : '',
    show_live_badge:
      form.querySelector('[name="header_show_live_badge"]') instanceof HTMLInputElement
        ? form.querySelector('[name="header_show_live_badge"]').checked
        : undefined,
    show_quotes:
      form.querySelector('[name="header_show_quotes"]') instanceof HTMLInputElement
        ? form.querySelector('[name="header_show_quotes"]').checked
        : undefined,
    show_headlines:
      form.querySelector('[name="header_show_headlines"]') instanceof HTMLInputElement
        ? form.querySelector('[name="header_show_headlines"]').checked
        : undefined,
    show_security_badge:
      form.querySelector('[name="header_show_security_badge"]') instanceof HTMLInputElement
        ? form.querySelector('[name="header_show_security_badge"]').checked
        : undefined,
    security_label:
      form.querySelector('[name="header_security_label"]') instanceof HTMLInputElement
        ? form.querySelector('[name="header_security_label"]').value
        : '',
    show_credits:
      form.querySelector('[name="header_show_credits"]') instanceof HTMLInputElement
        ? form.querySelector('[name="header_show_credits"]').checked
        : undefined,
    show_recharge_button:
      form.querySelector('[name="header_show_recharge_button"]') instanceof HTMLInputElement
        ? form.querySelector('[name="header_show_recharge_button"]').checked
        : undefined,
    recharge_label:
      form.querySelector('[name="header_recharge_label"]') instanceof HTMLInputElement
        ? form.querySelector('[name="header_recharge_label"]').value
        : '',
    show_mode_badge:
      form.querySelector('[name="header_show_mode_badge"]') instanceof HTMLInputElement
        ? form.querySelector('[name="header_show_mode_badge"]').checked
        : undefined,
    mode_badge_label:
      form.querySelector('[name="header_mode_badge_label"]') instanceof HTMLInputElement
        ? form.querySelector('[name="header_mode_badge_label"]').value
        : '',
    fallback_quotes: Array.from({length: 4}, (_, index) => ({
      label:
        form.querySelector(`[name="header_quote_label__${index}"]`) instanceof HTMLInputElement
          ? form.querySelector(`[name="header_quote_label__${index}"]`).value
          : '',
      value:
        form.querySelector(`[name="header_quote_value__${index}"]`) instanceof HTMLInputElement
          ? form.querySelector(`[name="header_quote_value__${index}"]`).value
          : '',
      change:
        form.querySelector(`[name="header_quote_change__${index}"]`) instanceof HTMLInputElement
          ? Number(form.querySelector(`[name="header_quote_change__${index}"]`).value || 0)
          : 0,
      change_percent:
        form.querySelector(`[name="header_quote_change_percent__${index}"]`) instanceof HTMLInputElement
          ? form.querySelector(`[name="header_quote_change_percent__${index}"]`).value
          : '',
    })),
    fallback_headlines: Array.from({length: 3}, (_, index) => ({
      title:
        form.querySelector(`[name="header_headline_title__${index}"]`) instanceof HTMLInputElement
          ? form.querySelector(`[name="header_headline_title__${index}"]`).value
          : '',
      source:
        form.querySelector(`[name="header_headline_source__${index}"]`) instanceof HTMLInputElement
          ? form.querySelector(`[name="header_headline_source__${index}"]`).value
          : '',
      href:
        form.querySelector(`[name="header_headline_href__${index}"]`) instanceof HTMLInputElement
          ? form.querySelector(`[name="header_headline_href__${index}"]`).value
          : '',
    })),
  });
  if (form.querySelector('[name="header_enabled"]') || form.querySelector('[name="header_status_label"]')) {
    surfaceMap.set('header', {
      key: 'header',
      label: surfaceLabel('header'),
      enabled: headerEnabledInput instanceof HTMLInputElement ? headerEnabledInput.checked : existing.header?.enabled !== false,
      json: JSON.stringify(buildHeaderSurfaceConfigFromBuffer(header), null, 2),
    });
  }
  const input = normalizeInputSurfaceConfig({
    placeholder_text:
      form.querySelector('[name="input_placeholder_text"]') instanceof HTMLTextAreaElement
        ? form.querySelector('[name="input_placeholder_text"]').value
        : existing.input?.placeholderText,
  });
  if (form.querySelector('[name="input_enabled"]') || form.querySelector('[name="input_placeholder_text"]')) {
    surfaceMap.set('input', {
      key: 'input',
      label: surfaceLabel('input'),
      enabled: inputEnabledInput instanceof HTMLInputElement ? inputEnabledInput.checked : existing.input?.enabled !== false,
      json: JSON.stringify(buildInputSurfaceConfigFromBuffer(input), null, 2),
    });
  }
  const sidebar = normalizeSidebarSurfaceConfig({
    variant:
      form.querySelector('[name="sidebar_variant"]') instanceof HTMLInputElement
        ? form.querySelector('[name="sidebar_variant"]').value
        : existing.sidebar?.variant,
    brandBlock: {
      title:
        form.querySelector('[name="sidebar_brand_title"]') instanceof HTMLInputElement
          ? form.querySelector('[name="sidebar_brand_title"]').value
          : existing.sidebar?.brandTitle,
      subtitle:
        form.querySelector('[name="sidebar_brand_subtitle"]') instanceof HTMLInputElement
          ? form.querySelector('[name="sidebar_brand_subtitle"]').value
          : existing.sidebar?.brandSubtitle,
    },
    layout: {
      sectionStyle:
        form.querySelector('[name="sidebar_section_style"]') instanceof HTMLInputElement
          ? form.querySelector('[name="sidebar_section_style"]').value
          : existing.sidebar?.sectionStyle,
      emphasizeActiveItem:
        form.querySelector('[name="sidebar_emphasize_active_item"]') instanceof HTMLInputElement
          ? form.querySelector('[name="sidebar_emphasize_active_item"]').checked
          : existing.sidebar?.emphasizeActiveItem,
    },
  });
  if (form.querySelector('[name="sidebar_enabled"]') || form.querySelector('[name="sidebar_variant"]')) {
    surfaceMap.set('sidebar', {
      key: 'sidebar',
      label: surfaceLabel('sidebar'),
      enabled: sidebarEnabledInput instanceof HTMLInputElement ? sidebarEnabledInput.checked : existing.sidebar?.enabled !== false,
      json: JSON.stringify(buildSidebarSurfaceConfigFromBuffer(sidebar), null, 2),
    });
  }
  const surfaces = Array.from(surfaceMap.values());
  const rechargePackageOrder = buildOrderedRechargePackageList(existing.rechargePackageOrder);
  const selectedRechargePackages = rechargePackageOrder.filter((packageId) => {
    const input = form.querySelector(`[name="recharge_enabled__${CSS.escape(packageId)}"]`);
    return input instanceof HTMLInputElement ? input.checked : asStringArray(existing.selectedRechargePackages).includes(packageId);
  });
  const recommendedRechargePackages = rechargePackageOrder.filter((packageId) => {
    const input = form.querySelector(`[name="recharge_recommended__${CSS.escape(packageId)}"]`);
    return input instanceof HTMLInputElement
      ? input.checked && selectedRechargePackages.includes(packageId)
      : asStringArray(existing.recommendedRechargePackages).includes(packageId) && selectedRechargePackages.includes(packageId);
  });
  let defaultRechargePackage = form.querySelector('input[name="recharge_default_package"]:checked') instanceof HTMLInputElement
    ? String(form.querySelector('input[name="recharge_default_package"]:checked').value || '').trim()
    : String(existing.defaultRechargePackage || '').trim();
  if (!selectedRechargePackages.includes(defaultRechargePackage)) {
    defaultRechargePackage = recommendedRechargePackages[0] || selectedRechargePackages[0] || '';
  }
  const nextBrandId = String(data.get('brand_id') || existing.brandId || '');
  const nextDisplayName = String(data.get('display_name') || existing.displayName || '');
  const nextLegalName =
    form.querySelector('[name="desktop_legal_name"]') instanceof HTMLInputElement
      ? form.querySelector('[name="desktop_legal_name"]').value
      : existing.desktopShell?.legalName;
  const existingAgreementMap = new Map(
    asArray(existing.authExperience?.agreements)
      .map((item) => normalizeAuthAgreementDraft(item, {}))
      .filter((item) => item.key)
      .map((item) => [item.key, item]),
  );
  const authExperience = normalizeAuthExperienceConfig(
    {
      title:
        form.querySelector('[name="auth_panel_title"]') instanceof HTMLInputElement
          ? form.querySelector('[name="auth_panel_title"]').value
          : existing.authExperience?.title,
      subtitle:
        form.querySelector('[name="auth_panel_subtitle"]') instanceof HTMLTextAreaElement
          ? form.querySelector('[name="auth_panel_subtitle"]').value
          : existing.authExperience?.subtitle,
      social_notice:
        form.querySelector('[name="auth_social_notice"]') instanceof HTMLTextAreaElement
          ? form.querySelector('[name="auth_social_notice"]').value
          : existing.authExperience?.socialNotice,
      agreements: AUTH_AGREEMENT_ORDER.map((key) => ({
        key,
        title:
          form.querySelector(`[name="auth_agreement_title__${CSS.escape(key)}"]`) instanceof HTMLInputElement
            ? form.querySelector(`[name="auth_agreement_title__${CSS.escape(key)}"]`).value
            : existingAgreementMap.get(key)?.title,
        version:
          form.querySelector(`[name="auth_agreement_version__${CSS.escape(key)}"]`) instanceof HTMLInputElement
            ? form.querySelector(`[name="auth_agreement_version__${CSS.escape(key)}"]`).value
            : existingAgreementMap.get(key)?.version,
        effective_date:
          form.querySelector(`[name="auth_agreement_effective_date__${CSS.escape(key)}"]`) instanceof HTMLInputElement
            ? form.querySelector(`[name="auth_agreement_effective_date__${CSS.escape(key)}"]`).value
            : existingAgreementMap.get(key)?.effectiveDate,
        summary:
          form.querySelector(`[name="auth_agreement_summary__${CSS.escape(key)}"]`) instanceof HTMLTextAreaElement
            ? form.querySelector(`[name="auth_agreement_summary__${CSS.escape(key)}"]`).value
            : existingAgreementMap.get(key)?.summary,
        content:
          form.querySelector(`[name="auth_agreement_content__${CSS.escape(key)}"]`) instanceof HTMLTextAreaElement
            ? form.querySelector(`[name="auth_agreement_content__${CSS.escape(key)}"]`).value
            : existingAgreementMap.get(key)?.content,
      })),
    },
    {
      brandId: nextBrandId,
      displayName: nextDisplayName,
      legalName: nextLegalName,
    },
  );

  state.brandDraftBuffer = {
    ...existing,
    brandId: nextBrandId,
    displayName: nextDisplayName,
    productName: String(data.get('product_name') || existing.productName || ''),
    tenantKey: String(data.get('tenant_key') || existing.tenantKey || ''),
    status: String(data.get('status') || existing.status || 'draft'),
    advancedJson: form.querySelector('[name="advanced_json"]')
      ? String(data.get('advanced_json') || existing.advancedJson || '{}')
      : String(existing.advancedJson || '{}'),
    theme: {
      defaultMode: form.querySelector('[name="theme_default_mode"]')
        ? String(data.get('theme_default_mode') || existing.theme?.defaultMode || 'dark')
        : String(existing.theme?.defaultMode || 'dark'),
      lightPrimary: form.querySelector('[name="theme_light_primary"]')
        ? String(data.get('theme_light_primary') || existing.theme?.lightPrimary || '')
        : String(existing.theme?.lightPrimary || ''),
      lightPrimaryHover: form.querySelector('[name="theme_light_primary_hover"]')
        ? String(data.get('theme_light_primary_hover') || existing.theme?.lightPrimaryHover || '')
        : String(existing.theme?.lightPrimaryHover || ''),
      lightOnPrimary: form.querySelector('[name="theme_light_on_primary"]')
        ? String(data.get('theme_light_on_primary') || existing.theme?.lightOnPrimary || '')
        : String(existing.theme?.lightOnPrimary || ''),
      darkPrimary: form.querySelector('[name="theme_dark_primary"]')
        ? String(data.get('theme_dark_primary') || existing.theme?.darkPrimary || '')
        : String(existing.theme?.darkPrimary || ''),
      darkPrimaryHover: form.querySelector('[name="theme_dark_primary_hover"]')
        ? String(data.get('theme_dark_primary_hover') || existing.theme?.darkPrimaryHover || '')
        : String(existing.theme?.darkPrimaryHover || ''),
      darkOnPrimary: form.querySelector('[name="theme_dark_on_primary"]')
        ? String(data.get('theme_dark_on_primary') || existing.theme?.darkOnPrimary || '')
        : String(existing.theme?.darkOnPrimary || ''),
    },
    // Capability switches are managed through in-memory draft state.
    // Do not recompute them from hidden checkbox markup during save, otherwise
    // stale DOM can overwrite the latest toggle state back to old values.
    selectedSkills: ensureEffectiveSkillSelection(existing.selectedSkills),
    selectedMcp: ensureEffectiveMcpSelection(existing.selectedMcp),
    useRechargePackagesOverride:
      form.querySelector('[name="recharge_use_override"]') instanceof HTMLInputElement
        ? form.querySelector('[name="recharge_use_override"]').checked
        : existing.useRechargePackagesOverride === true,
    selectedRechargePackages,
    rechargePackageOrder,
    recommendedRechargePackages,
    defaultRechargePackage,
    selectedMenus: asStringArray(existing.selectedMenus),
    menuConfigs,
    menuOrder: buildOrderedMenuList(existing.menuOrder),
    selectedComposerControls: asStringArray(existing.selectedComposerControls),
    composerControlConfigs,
    composerControlOrder: buildOrderedComposerControlList(existing.composerControlOrder),
    selectedComposerShortcuts: asStringArray(existing.selectedComposerShortcuts),
    composerShortcutConfigs,
    composerShortcutOrder: buildOrderedComposerShortcutList(existing.composerShortcutOrder),
    selectedModels: asStringArray(existing.selectedModels),
    recommendedModels: asStringArray(existing.recommendedModels),
    defaultModel: form.querySelector('[name="default_model"]')
      ? String(data.get('default_model') || existing.defaultModel || '')
      : String(existing.defaultModel || ''),
    savedModelEntries: asArray(existing.savedModelEntries).map((item) => clone(asObject(item))),
    agentsText: form.querySelector('[name="agents_text"]')
      ? String(data.get('agents_text') || existing.agentsText || '')
      : String(existing.agentsText || ''),
    menusText: form.querySelector('[name="menus_text"]')
      ? String(data.get('menus_text') || existing.menusText || '')
      : String(existing.menusText || ''),
    desktopShell: normalizeDesktopShellConfig({
      websiteTitle:
        form.querySelector('[name="desktop_website_title"]') instanceof HTMLInputElement
          ? form.querySelector('[name="desktop_website_title"]').value
          : existing.desktopShell?.websiteTitle,
      devWebsiteTitle:
        form.querySelector('[name="desktop_dev_website_title"]') instanceof HTMLInputElement
          ? form.querySelector('[name="desktop_dev_website_title"]').value
          : existing.desktopShell?.devWebsiteTitle,
      sidebarTitle:
        form.querySelector('[name="desktop_sidebar_title"]') instanceof HTMLInputElement
          ? form.querySelector('[name="desktop_sidebar_title"]').value
          : existing.desktopShell?.sidebarTitle,
      devSidebarTitle:
        form.querySelector('[name="desktop_dev_sidebar_title"]') instanceof HTMLInputElement
          ? form.querySelector('[name="desktop_dev_sidebar_title"]').value
          : existing.desktopShell?.devSidebarTitle,
      sidebarSubtitle:
        form.querySelector('[name="desktop_sidebar_subtitle"]') instanceof HTMLInputElement
          ? form.querySelector('[name="desktop_sidebar_subtitle"]').value
          : existing.desktopShell?.sidebarSubtitle,
      legalName:
        form.querySelector('[name="desktop_legal_name"]') instanceof HTMLInputElement
          ? form.querySelector('[name="desktop_legal_name"]').value
          : existing.desktopShell?.legalName,
      bundleIdentifier:
        form.querySelector('[name="desktop_bundle_identifier"]') instanceof HTMLInputElement
          ? form.querySelector('[name="desktop_bundle_identifier"]').value
          : existing.desktopShell?.bundleIdentifier,
      authService:
        form.querySelector('[name="desktop_auth_service"]') instanceof HTMLInputElement
          ? form.querySelector('[name="desktop_auth_service"]').value
          : existing.desktopShell?.authService,
    }),
    homeWeb: {
      enabled: homeWebEnabledInput instanceof HTMLInputElement ? homeWebEnabledInput.checked : existing.homeWeb?.enabled !== false,
      ...homeWeb,
    },
    welcome: {
      enabled: welcomeEnabledInput instanceof HTMLInputElement ? welcomeEnabledInput.checked : existing.welcome?.enabled !== false,
      ...welcome,
    },
    header: {
      enabled: headerEnabledInput instanceof HTMLInputElement ? headerEnabledInput.checked : existing.header?.enabled !== false,
      ...header,
    },
    sidebar: {
      enabled: sidebarEnabledInput instanceof HTMLInputElement ? sidebarEnabledInput.checked : existing.sidebar?.enabled !== false,
      ...sidebar,
    },
    authExperience,
    surfaces,
  };

  return state.brandDraftBuffer;
}

function syncBrandEditorBuffer() {
  const form = document.querySelector('#brand-editor-form');
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
  captureBrandEditorBuffer();
}

function parseJsonText(raw, label) {
  try {
    const parsed = JSON.parse(String(raw || '{}'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} 必须是 JSON 对象`);
    }
    return parsed;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : `${label} 不是合法 JSON`);
  }
}

function composeDraftConfig(buffer) {
  const draftConfig = parseJsonText(buffer.advancedJson, '高级配置');
  const theme = asObject(draftConfig.theme);
  draftConfig.theme = {
    ...theme,
    defaultMode: isThemeMode(buffer.theme.defaultMode) ? buffer.theme.defaultMode : 'dark',
    default_mode: isThemeMode(buffer.theme.defaultMode) ? buffer.theme.defaultMode : 'dark',
    light: {
      ...asObject(theme.light),
      primary: buffer.theme.lightPrimary.trim(),
      primaryHover: buffer.theme.lightPrimaryHover.trim(),
      onPrimary: buffer.theme.lightOnPrimary.trim(),
    },
    dark: {
      ...asObject(theme.dark),
      primary: buffer.theme.darkPrimary.trim(),
      primaryHover: buffer.theme.darkPrimaryHover.trim(),
      onPrimary: buffer.theme.darkOnPrimary.trim(),
    },
  };
  const desktopShell = normalizeDesktopShellConfig(buffer.desktopShell);
  draftConfig.websiteTitle = desktopShell.websiteTitle;
  draftConfig.website_title = desktopShell.websiteTitle;
  draftConfig.devWebsiteTitle = desktopShell.devWebsiteTitle;
  draftConfig.dev_website_title = desktopShell.devWebsiteTitle;
  draftConfig.sidebarTitle = desktopShell.sidebarTitle;
  draftConfig.sidebar_title = desktopShell.sidebarTitle;
  draftConfig.devSidebarTitle = desktopShell.devSidebarTitle;
  draftConfig.dev_sidebar_title = desktopShell.devSidebarTitle;
  draftConfig.sidebarSubtitle = desktopShell.sidebarSubtitle;
  draftConfig.sidebar_subtitle = desktopShell.sidebarSubtitle;
  draftConfig.legalName = desktopShell.legalName;
  draftConfig.legal_name = desktopShell.legalName;
  draftConfig.bundleIdentifier = desktopShell.bundleIdentifier;
  draftConfig.bundle_identifier = desktopShell.bundleIdentifier;
  draftConfig.authService = desktopShell.authService;
  draftConfig.auth_service = desktopShell.authService;

  draftConfig.surfaces = buffer.surfaces.reduce((accumulator, surface) => {
    accumulator[surface.key] = {
      enabled: surface.enabled,
      config: parseJsonText(surface.json, `${surface.label} 配置`),
    };
    return accumulator;
  }, {});
  const brandMetaSnake = asObject(draftConfig.brand_meta);
  const brandMetaCamel = asObject(draftConfig.brandMeta);
  const nextProductName = buffer.productName.trim();
  const nextTenantKey = buffer.tenantKey.trim() || buffer.brandId.trim();
  draftConfig.brand_meta = {
    ...brandMetaSnake,
    brand_id: buffer.brandId.trim(),
    display_name: buffer.displayName.trim(),
    product_name: nextProductName,
    tenant_key: nextTenantKey,
    legal_name: String(desktopShell.legalName || brandMetaSnake.legal_name || draftConfig.legalName || draftConfig.legal_name || buffer.displayName.trim()).trim(),
    storage_namespace: String(brandMetaSnake.storage_namespace || asObject(draftConfig.storage).namespace || nextTenantKey).trim(),
  };
  draftConfig.brandMeta = {
    ...brandMetaCamel,
    productName: nextProductName,
    tenantKey: nextTenantKey,
  };
  draftConfig.auth_experience = buildAuthExperienceConfigFromBuffer(buffer.authExperience, {
    brandId: buffer.brandId,
    displayName: buffer.displayName,
    legalName: desktopShell.legalName,
  });
  draftConfig.authExperience = clone(draftConfig.auth_experience);
  draftConfig.productName = nextProductName;
  draftConfig.product_name = nextProductName;
  draftConfig.tenantKey = nextTenantKey;
  draftConfig.tenant_key = nextTenantKey;
  draftConfig.capabilities = {
    ...asObject(draftConfig.capabilities),
    skills: [...buffer.selectedSkills],
    mcp_servers: [...buffer.selectedMcp],
    menus: [...buffer.selectedMenus],
    models: {
      default: buffer.defaultModel || null,
      recommended: buffer.recommendedModels.filter((ref) => buffer.selectedModels.includes(ref)),
      entries: buffer.selectedModels
        .map((ref) => getModelCatalogEntry(ref) || asObject(buffer.savedModelEntries.find((item) => asObject(item).ref === ref)))
        .filter((item) => item && typeof item === 'object')
        .map((item) => clone(item)),
    },
  };

  return draftConfig;
}

async function authenticate(identifier, password) {
  state.busy = true;
  resetBanner();
  render();

  try {
    const data = await apiFetch(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          password,
        }),
      },
      {skipRefresh: true},
    );
    persistTokens(data.tokens);
    state.user = data.user;
    state.view = 'dashboard';
    state.route = 'overview';
    await loadAppData();
    setNotice('运营控制台已就绪。');
  } catch (error) {
    setError(error instanceof Error ? error.message : '登录失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function ensureSession() {
  if (!state.tokens?.access_token && !state.tokens?.refresh_token) {
    state.view = 'login';
    render();
    return;
  }

  try {
    if (!state.tokens?.access_token && state.tokens?.refresh_token) {
      await refreshToken();
    }
    state.user = await apiFetch('/auth/me', {method: 'GET'});
    state.view = 'dashboard';
    await loadAppData();
  } catch (error) {
    if (isUnauthorizedError(error)) {
      state.user = null;
      persistTokens(null);
      state.view = 'login';
      render();
      return;
    }
    if (shouldKeepSessionOnError(error)) {
      state.view = 'dashboard';
      setError(error instanceof Error ? `恢复登录态失败：${error.message}` : '恢复登录态失败，请稍后刷新重试');
      return;
    }
    state.user = null;
    state.view = 'login';
    setError(error instanceof Error ? `恢复登录态失败：${error.message}` : '恢复登录态失败，请稍后刷新重试');
  }
}

function syncCapabilitySelection() {
  const skills = getMergedSkills();
  const mcpServers = getMergedMcpServers();
  const models = getMergedModelCatalog();
  if (!skills.find((item) => item.slug === state.selectedSkillSlug)) {
    state.selectedSkillSlug = skills[0]?.slug || '';
  }
  if (!mcpServers.find((item) => item.key === state.selectedMcpKey)) {
    state.selectedMcpKey = mcpServers[0]?.key || '';
  }
  if (!models.find((item) => item.ref === state.selectedModelRef)) {
    state.selectedModelRef = models[0]?.ref || '';
  }
}

function resetCapabilityFilters() {
  state.filters.capabilityQuery = '';
  state.filters.capabilitySkillStatus = 'all';
  state.filters.capabilitySkillCategory = 'all';
  state.filters.capabilitySkillBrand = 'all';
  state.filters.capabilityMcpStatus = 'all';
  state.filters.capabilityMcpTransport = 'all';
  state.filters.capabilityMcpBrand = 'all';
  state.filters.capabilityModelStatus = 'all';
  state.filters.capabilityModelProvider = 'all';
  state.filters.capabilityModelBrand = 'all';
}

function syncSupplementalSelection() {
  if (!state.selectedAgentSlug || (!state.agentCatalog.find((item) => item.slug === state.selectedAgentSlug) && state.selectedAgentSlug !== '__new__')) {
    state.selectedAgentSlug = state.agentCatalog[0]?.slug || '';
  }
  if (!state.releases.find((item) => item.id === state.selectedReleaseId)) {
    state.selectedReleaseId = state.releases[0]?.id || '';
  }
  if (!state.paymentOrders.find((item) => item.order_id === state.selectedPaymentOrderId)) {
    state.selectedPaymentOrderId = state.paymentOrders[0]?.order_id || '';
  }
  if (!state.audit.find((item) => item.id === state.selectedAuditId)) {
    state.selectedAuditId = state.audit[0]?.id || '';
  }
  const appNames = (state.brands || []).map((item) => item.brandId);
  if (state.selectedPaymentProviderTab !== 'platform' && !appNames.includes(state.selectedPaymentProviderTab)) {
    state.selectedPaymentProviderTab = 'platform';
  }
}

async function ensurePaymentOrderDetail(orderId) {
  const normalized = String(orderId || '').trim();
  if (!normalized) return null;
  if (state.paymentOrderDetails[normalized]) {
    return state.paymentOrderDetails[normalized];
  }
  const detail = await apiFetch(`/admin/payments/orders/${encodeURIComponent(normalized)}`, {method: 'GET'});
  state.paymentOrderDetails[normalized] = detail;
  return detail;
}

async function refreshPaymentOrders(selectedOrderId = '') {
  const data = await apiFetch('/admin/payments/orders?limit=200', {method: 'GET'});
  state.paymentOrders = Array.isArray(data.items) ? data.items : [];
  if (selectedOrderId) {
    state.selectedPaymentOrderId = selectedOrderId;
  }
  if (!state.paymentOrders.find((item) => item.order_id === state.selectedPaymentOrderId)) {
    state.selectedPaymentOrderId = state.paymentOrders[0]?.order_id || '';
  }
  if (state.selectedPaymentOrderId) {
    const detail = await apiFetch(`/admin/payments/orders/${encodeURIComponent(state.selectedPaymentOrderId)}`, {method: 'GET'});
    state.paymentOrderDetails[state.selectedPaymentOrderId] = detail;
  }
}

async function markPaymentOrderPaid(orderId, payload) {
  state.busy = true;
  resetBanner();
  render();
  try {
    const detail = await apiFetch(`/admin/payments/orders/${encodeURIComponent(orderId)}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.paymentOrderDetails[orderId] = detail;
    await refreshPaymentOrders(orderId);
    setNotice('订单已人工确认到账。');
  } catch (error) {
    setError(error instanceof Error ? error.message : '人工确认到账失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function refundPaymentOrder(orderId, payload) {
  state.busy = true;
  resetBanner();
  render();
  try {
    const detail = await apiFetch(`/admin/payments/orders/${encodeURIComponent(orderId)}/refund`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.paymentOrderDetails[orderId] = detail;
    await refreshPaymentOrders(orderId);
    setNotice('订单已完成退款冲正。');
  } catch (error) {
    setError(error instanceof Error ? error.message : '退款冲正失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function saveRechargePackageCatalogEntry(form) {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
  const formData = new FormData(form);
  state.busy = true;
  resetBanner();
  render();

  try {
    const packageId = String(formData.get('package_id') || '').trim();
    if (!packageId) {
      throw new Error('请填写 package_id');
    }
    await apiFetch(`/admin/portal/catalog/recharge-packages/${encodeURIComponent(packageId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        packageName: String(formData.get('package_name') || '').trim(),
        credits: Number(formData.get('credits') || 0) || 0,
        bonusCredits: Number(formData.get('bonus_credits') || 0) || 0,
        amountCnyFen: parseYuanInputToFen(formData.get('amount_cny_yuan')),
        sortOrder: Number(formData.get('sort_order') || 0) || 0,
        recommended: formData.get('recommended') === 'on',
        default: formData.get('default') === 'on',
        active: formData.get('active') === 'on',
        metadata: buildRechargePackageMetadataFromForm(form),
      }),
    });
    await loadAppData();
    state.selectedRechargePackageId = packageId;
    setNotice(`充值套餐 ${packageId} 已保存。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '充值套餐保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function deleteRechargePackageCatalogEntry(packageId) {
  const normalized = String(packageId || '').trim();
  if (!normalized) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch(`/admin/portal/catalog/recharge-packages/${encodeURIComponent(normalized)}`, {
      method: 'DELETE',
    });
    await loadAppData();
    state.selectedRechargePackageId = '';
    setNotice(`已删除充值套餐 ${normalized}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '充值套餐删除失败');
  } finally {
    state.busy = false;
    render();
  }
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportPaymentOrdersCsv() {
  const items = getFilteredPaymentOrders();
  const headers = [
    'order_id',
    'status',
    'provider',
    'amount_cny_fen',
    'credits',
    'bonus_credits',
    'total_credits',
    'app_name',
    'app_version',
    'release_channel',
    'platform',
    'arch',
    'provider_order_id',
    'user_id',
    'username',
    'user_email',
    'user_display_name',
    'created_at',
    'paid_at',
    'expires_at',
    'latest_webhook_at',
    'webhook_event_count',
  ];
  const lines = [
    headers.join(','),
    ...items.map((item) =>
      headers
        .map((key) => csvEscape(item[key] ?? ''))
        .join(','),
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payment-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function refreshRuntimeManagementData(options = {}) {
  const [runtimeReleasesData, runtimeBindingsData, runtimeBindingHistoryData, runtimeBootstrapSourceData] = await Promise.all([
    apiFetch('/admin/portal/runtime-releases?limit=200', {method: 'GET'}),
    apiFetch('/admin/portal/runtime-bindings?limit=200', {method: 'GET'}),
    apiFetch('/admin/portal/runtime-binding-history?limit=200', {method: 'GET'}),
    apiFetch('/admin/portal/runtime-bootstrap-source', {method: 'GET'}).catch(() => null),
  ]);
  state.runtimeReleases = Array.isArray(runtimeReleasesData.items) ? runtimeReleasesData.items : [];
  state.runtimeBindings = Array.isArray(runtimeBindingsData.items) ? runtimeBindingsData.items : [];
  state.runtimeBindingHistory = Array.isArray(runtimeBindingHistoryData.items) ? runtimeBindingHistoryData.items : [];
  state.runtimeBootstrapSource = runtimeBootstrapSourceData && typeof runtimeBootstrapSourceData === 'object' ? runtimeBootstrapSourceData : null;
  if (Object.prototype.hasOwnProperty.call(options, 'selectedRuntimeReleaseId')) {
    state.selectedRuntimeReleaseId = String(options.selectedRuntimeReleaseId || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(options, 'selectedRuntimeBindingId')) {
    state.selectedRuntimeBindingId = String(options.selectedRuntimeBindingId || '').trim();
  }
  syncRuntimeSelection();
  if (!options.suppressRender) {
    render();
  }
}

async function saveRuntimeRelease(form) {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
  const formData = new FormData(form);
  const platform = String(formData.get('platform') || '').trim();
  const arch = String(formData.get('arch') || '').trim();
  const targetTriple = computeRuntimeTargetTriple(platform, arch);
  if (!targetTriple) {
    setError('当前 platform / arch 组合还不支持自动推导 target triple');
    return;
  }
  state.busy = true;
  resetBanner();
  render();
  try {
    const saved = await apiFetch('/admin/portal/runtime-releases', {
      method: 'PUT',
      body: JSON.stringify({
        id: String(formData.get('release_id') || '').trim() || null,
        runtimeKind: String(formData.get('runtime_kind') || '').trim(),
        version: String(formData.get('version') || '').trim(),
        channel: String(formData.get('channel') || '').trim(),
        platform,
        arch,
        targetTriple,
        artifactUrl: String(formData.get('artifact_url') || '').trim(),
        bucketName: String(formData.get('bucket_name') || '').trim() || null,
        objectKey: String(formData.get('object_key') || '').trim() || null,
        artifactSha256: String(formData.get('artifact_sha256') || '').trim() || null,
        artifactSizeBytes: Number(formData.get('artifact_size_bytes') || 0) || null,
        launcherRelativePath: String(formData.get('launcher_relative_path') || '').trim() || null,
        gitCommit: String(formData.get('git_commit') || '').trim() || null,
        gitTag: String(formData.get('git_tag') || '').trim() || null,
        releaseVersion: String(formData.get('release_version') || '').trim() || null,
        buildTime: String(formData.get('build_time') || '').trim() || null,
        status: String(formData.get('status') || '').trim() || 'draft',
      }),
    });
    await refreshRuntimeManagementData({
      selectedRuntimeReleaseId: saved?.id || '',
      suppressRender: true,
    });
    state.runtimeReleaseDraftBuffer = null;
    state.selectedRuntimeSection = 'release';
    setNotice(`Runtime release ${saved?.version || ''} 已保存。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Runtime release 保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function saveRuntimeBinding(form) {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
  const formData = new FormData(form);
  const scopeType = String(formData.get('scope_type') || '').trim() === 'app' ? 'app' : 'platform';
  const scopeKey = scopeType === 'platform' ? 'platform' : String(formData.get('scope_key') || '').trim();
  const platform = String(formData.get('platform') || '').trim();
  const arch = String(formData.get('arch') || '').trim();
  const targetTriple = computeRuntimeTargetTriple(platform, arch);
  if (!scopeKey) {
    setError('请选择 OEM 应用');
    return;
  }
  if (!targetTriple) {
    setError('当前 platform / arch 组合还不支持自动推导 target triple');
    return;
  }
  state.busy = true;
  resetBanner();
  render();
  try {
    const saved = await apiFetch('/admin/portal/runtime-bindings', {
      method: 'PUT',
      body: JSON.stringify({
        id: String(formData.get('binding_id') || '').trim() || null,
        scopeType,
        scopeKey,
        runtimeKind: String(formData.get('runtime_kind') || '').trim(),
        channel: String(formData.get('channel') || '').trim(),
        platform,
        arch,
        targetTriple,
        releaseId: String(formData.get('release_id') || '').trim(),
        enabled: formData.get('enabled') === 'on',
        changeReason: String(formData.get('change_reason') || '').trim() || null,
      }),
    });
    await refreshRuntimeManagementData({
      selectedRuntimeBindingId: saved?.id || '',
      suppressRender: true,
    });
    state.runtimeBindingDraftBuffer = null;
    state.selectedRuntimeSection = 'binding';
    setNotice('Runtime binding 已保存。');
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Runtime binding 保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function importLegacyRuntimeBootstrapSource() {
  state.busy = true;
  resetBanner();
  render();
  try {
    const bindScopeType = state.selectedRuntimeImportBindScopeType === 'platform'
      ? 'platform'
      : state.selectedRuntimeImportBindScopeType === 'app'
        ? 'app'
        : 'none';
    const payload = {
      channel: state.selectedRuntimeImportChannel === 'dev' ? 'dev' : 'prod',
      bind_scope_type: bindScopeType === 'none' ? null : bindScopeType,
      bind_scope_key:
        bindScopeType === 'app'
          ? String(state.selectedRuntimeImportBindScopeKey || '').trim()
          : bindScopeType === 'platform'
            ? 'platform'
            : null,
    };
    const result = await apiFetch('/admin/portal/runtime-bootstrap-source/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await refreshRuntimeManagementData({suppressRender: true});
    state.selectedRuntimeSection = bindScopeType === 'none' ? 'release' : 'binding';
    setNotice(
      `已从 legacy runtime bootstrap 导入 ${Number(result?.importedReleases?.length || 0)} 条 release` +
        (bindScopeType === 'none' ? '。' : `，并更新 ${Number(result?.importedBindings?.length || 0)} 条 binding。`),
    );
  } catch (error) {
    setError(error instanceof Error ? error.message : 'legacy runtime bootstrap 导入失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function loadAppData() {
  state.loading = true;
  render();

  try {
    const [appsData, agentCatalogData, skillCatalogData, mcpCatalogData, cloudMcpCatalogData, modelCatalogData, modelProviderProfilesData, memoryEmbeddingProfilesData, modelLogoPresetsData, menuCatalogData, rechargePackageCatalogData, composerControlCatalogData, composerShortcutCatalogData, skillSyncSourcesData, skillSyncRunsData, paymentGatewayConfigData, paymentProviderProfilesData, paymentProviderBindingsData, paymentOrdersData, runtimeReleasesData, runtimeBindingsData, runtimeBindingHistoryData, runtimeBootstrapSourceData] = await Promise.all([
      apiFetch('/admin/portal/apps', {method: 'GET'}),
      apiFetch('/admin/agents/catalog', {method: 'GET'}),
      apiFetch('/admin/portal/catalog/skills', {method: 'GET'}),
      apiFetch('/admin/portal/catalog/mcps', {method: 'GET'}),
      apiFetch('/admin/mcp/catalog', {method: 'GET'}),
      apiFetch('/admin/portal/catalog/models', {method: 'GET'}),
      apiFetch('/admin/portal/model-provider-profiles', {method: 'GET'}),
      apiFetch('/admin/portal/memory-embedding-profiles', {method: 'GET'}),
      apiFetch('/admin/portal/model-logo-presets', {method: 'GET'}),
      apiFetch('/admin/portal/catalog/menus', {method: 'GET'}),
      apiFetch('/admin/portal/catalog/recharge-packages', {method: 'GET'}),
      apiFetch('/admin/portal/catalog/composer-controls', {method: 'GET'}),
      apiFetch('/admin/portal/catalog/composer-shortcuts', {method: 'GET'}),
      apiFetch('/admin/skills/sync/sources', {method: 'GET'}),
      apiFetch('/admin/skills/sync/runs', {method: 'GET'}),
      apiFetch('/admin/payments/gateway-config', {method: 'GET'}),
      apiFetch(`/admin/payments/provider-profiles?provider=${encodeURIComponent(PRIMARY_PAYMENT_PROVIDER)}`, {method: 'GET'}),
      apiFetch(`/admin/payments/provider-bindings?provider=${encodeURIComponent(PRIMARY_PAYMENT_PROVIDER)}`, {method: 'GET'}),
      apiFetch('/admin/payments/orders?limit=200', {method: 'GET'}),
      apiFetch('/admin/portal/runtime-releases?limit=200', {method: 'GET'}),
      apiFetch('/admin/portal/runtime-bindings?limit=200', {method: 'GET'}),
      apiFetch('/admin/portal/runtime-binding-history?limit=200', {method: 'GET'}),
      apiFetch('/admin/portal/runtime-bootstrap-source', {method: 'GET'}).catch(() => null),
    ]);
    const apps = Array.isArray(appsData.items) ? appsData.items : [];
    const details = await Promise.all(
      apps.map(async (app) => {
        const detail = await apiFetch(`/admin/portal/apps/${encodeURIComponent(app.appName)}`, {method: 'GET'});
        return [app.appName, detail];
      }),
    );
    const overrides = await Promise.all(
      apps.map(async (app) => {
        const detail = await apiFetch(`/admin/portal/apps/${encodeURIComponent(app.appName)}/model-provider-override`, {method: 'GET'});
        return [app.appName, detail || null];
      }),
    );
    const detailsMap = Object.fromEntries(details);
    const overridesMap = Object.fromEntries(overrides);
    const paymentGatewayConfigs = {
      platform: paymentGatewayConfigData && typeof paymentGatewayConfigData === 'object' ? paymentGatewayConfigData : null,
    };
    await Promise.all(
      apps.map(async (app) => {
        const gatewayDetail = await apiFetch(
          `/admin/payments/gateway-config?scope_type=app&scope_key=${encodeURIComponent(app.appName)}`,
          {method: 'GET'},
        );
        paymentGatewayConfigs[app.appName] = gatewayDetail && typeof gatewayDetail === 'object' ? gatewayDetail : null;
      }),
    );

    state.portalAppDetails = detailsMap;
    state.agentCatalog = Array.isArray(agentCatalogData.items) ? agentCatalogData.items : [];
    state.skillCatalog = Array.isArray(skillCatalogData.items) ? skillCatalogData.items : [];
    state.mcpCatalog = Array.isArray(mcpCatalogData.items) ? mcpCatalogData.items : [];
    state.cloudMcpCatalog = Array.isArray(cloudMcpCatalogData.items) ? cloudMcpCatalogData.items : [];
    state.modelCatalog = Array.isArray(modelCatalogData.items) ? modelCatalogData.items : [];
    state.modelProviderProfiles = Array.isArray(modelProviderProfilesData.items) ? modelProviderProfilesData.items : [];
    state.memoryEmbeddingProfiles = Array.isArray(memoryEmbeddingProfilesData.items) ? memoryEmbeddingProfilesData.items : [];
    state.modelProviderOverrides = overridesMap;
    state.modelLogoPresets = Array.isArray(modelLogoPresetsData.items) ? modelLogoPresetsData.items : [];
    state.paymentGatewayConfigs = paymentGatewayConfigs;
    state.paymentProviderProfiles = Array.isArray(paymentProviderProfilesData.items) ? paymentProviderProfilesData.items : [];
    state.paymentProviderBindings = Array.isArray(paymentProviderBindingsData.items) ? paymentProviderBindingsData.items : [];
    state.runtimeReleases = Array.isArray(runtimeReleasesData.items) ? runtimeReleasesData.items : [];
    state.runtimeBindings = Array.isArray(runtimeBindingsData.items) ? runtimeBindingsData.items : [];
    state.runtimeBindingHistory = Array.isArray(runtimeBindingHistoryData.items) ? runtimeBindingHistoryData.items : [];
    state.runtimeBootstrapSource = runtimeBootstrapSourceData && typeof runtimeBootstrapSourceData === 'object' ? runtimeBootstrapSourceData : null;
    state.menuCatalog = Array.isArray(menuCatalogData.items)
      ? menuCatalogData.items.map((item, index) => normalizeMenuCatalogItem(item, index)).filter(Boolean)
      : [];
    state.rechargePackageCatalog = Array.isArray(rechargePackageCatalogData.items)
      ? rechargePackageCatalogData.items.map((item, index) => normalizeRechargePackageCatalogItem(item, index)).filter(Boolean)
      : [];
    state.composerControlCatalog = Array.isArray(composerControlCatalogData.items)
      ? composerControlCatalogData.items.map((item, index) => normalizeComposerControlCatalogItem(item, index)).filter(Boolean)
      : [];
    state.composerShortcutCatalog = Array.isArray(composerShortcutCatalogData.items)
      ? composerShortcutCatalogData.items.map((item, index) => normalizeComposerShortcutCatalogItem(item, index)).filter(Boolean)
      : [];
    state.skillSyncSources = Array.isArray(skillSyncSourcesData.items) ? skillSyncSourcesData.items : [];
    state.skillSyncRuns = Array.isArray(skillSyncRunsData.items) ? skillSyncRunsData.items : [];
    state.personalSkillCatalog = [];
    state.skillLibrary = [];
    state.cloudSkillCatalog = [];
    state.brandSkillCatalog = [];
    state.brands = apps.map((app) => mapPortalAppToBrand(app, detailsMap[app.appName]));
    state.dashboard = buildPortalDashboard(apps, state.skillCatalog, state.mcpCatalog, detailsMap);
    const adaptedDetails = Object.values(detailsMap).map((detail) => adaptPortalDetail(detail)).filter(Boolean);
    state.capabilities = {
      brands: state.brands,
      skills: state.skillCatalog.map((item) => ({
        ...item,
        brand_count: getPortalSkillConnections(item.slug).length,
        connectedBrands: getPortalSkillConnections(item.slug),
      })),
      mcp_servers: state.mcpCatalog.map((item) => ({
        key: item.mcpKey,
        mcpKey: item.mcpKey,
        name: item.name,
        description: item.description,
        connected_brand_count: getPortalMcpConnections(item.mcpKey).length,
        connected_brands: getPortalMcpConnections(item.mcpKey),
        enabled_by_default: item.active,
        transport: item.transport,
      })),
      models: getMergedModelCatalog(),
    };
    state.assets = adaptedDetails.flatMap((detail) => detail.assets || []);
    state.releases = adaptedDetails.flatMap((detail) =>
      asArray(detail.versions).map((item) => ({
        id: item.id,
        brand_id: detail.brand.brandId,
        display_name: detail.brand.displayName,
        version: item.version,
        published_at: item.publishedAt,
        created_by_name: item.createdByName,
        created_by_username: item.createdByUsername,
        changed_areas: ['config', 'skills', 'mcps', 'menus', 'assets'],
        surfaces: Object.keys(asObject(detail.brand.draftConfig?.surfaces || {})).filter(
          (key) => asObject(asObject(detail.brand.draftConfig?.surfaces || {})[key]).enabled !== false,
        ),
        skill_count: asArray(detail.skillBindings).filter((entry) => entry.enabled).length,
        mcp_count: asArray(detail.mcpBindings).filter((entry) => entry.enabled).length,
        config: asObject(item.config),
      })),
    );
    state.paymentOrders = Array.isArray(paymentOrdersData.items) ? paymentOrdersData.items : [];
    state.paymentOrderDetails = {};
    state.audit = adaptedDetails.flatMap((detail) => detail.audit || []);

    if (!state.selectedBrandId || !state.brands.find((brand) => brand.brandId === state.selectedBrandId)) {
      state.selectedBrandId = state.brands[0]?.brandId || '';
    }
    if (!state.selectedCloudSkillSlug || !state.cloudSkillCatalog.find((item) => item.slug === state.selectedCloudSkillSlug)) {
      state.selectedCloudSkillSlug = state.cloudSkillCatalog[0]?.slug || '';
    }
    if (!state.selectedCloudMcpKey || !state.cloudMcpCatalog.find((item) => (item.key || item.mcpKey) === state.selectedCloudMcpKey)) {
      state.selectedCloudMcpKey = state.cloudMcpCatalog[0]?.key || state.cloudMcpCatalog[0]?.mcpKey || '';
    }
    if (
      state.selectedRechargePackageId !== '__new__' &&
      (!state.selectedRechargePackageId || !state.rechargePackageCatalog.find((item) => item.packageId === state.selectedRechargePackageId))
    ) {
      state.selectedRechargePackageId = state.rechargePackageCatalog[0]?.packageId || '';
    }
    if (!state.selectedSkillSyncSourceId || !state.skillSyncSources.find((item) => item.id === state.selectedSkillSyncSourceId)) {
      state.selectedSkillSyncSourceId = state.skillSyncSources[0]?.id || '';
    }

    syncCapabilitySelection();
    syncSupplementalSelection();
    syncRuntimeSelection();

    if (state.selectedBrandId) {
      await loadBrandDetail(state.selectedBrandId, {silent: true, suppressRender: true});
    } else {
      state.brandDetail = null;
      state.brandDraftBuffer = null;
    }
    await Promise.all([
      loadCloudSkillCatalogPage({suppressRender: true, offset: 0}),
      loadBrandSkillCatalogPage({suppressRender: true, offset: 0}),
    ]);
    if (state.selectedPaymentOrderId) {
      await ensurePaymentOrderDetail(state.selectedPaymentOrderId);
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : '加载运营数据失败');
  } finally {
    state.loading = false;
    render();
  }
}

async function loadBrandDetail(brandId, options = {}) {
  if (!brandId) {
    return;
  }

  if (!options.silent) {
    state.busy = true;
    render();
  }

  try {
    const detail =
      state.portalAppDetails[brandId] || (await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}`, {method: 'GET'}));
    state.portalAppDetails[brandId] = detail;
    const data = adaptPortalDetail(detail);
    state.selectedBrandId = brandId;
    state.brandDetail = data;
    state.brandDraftBuffer = buildBrandDraftBuffer(data);
    state.selectedBrandMenuKey = '';
  } catch (error) {
    setError(error instanceof Error ? error.message : '品牌详情加载失败');
  } finally {
    if (!options.silent) {
      state.busy = false;
    }
    if (!options.suppressRender) {
      render();
    }
  }
}

async function saveBrandEditor(form) {
  const snapshot = captureBrandEditorBuffer();
  snapshot.selectedSkills = ensureEffectiveSkillSelection(snapshot.selectedSkills);
  snapshot.selectedMcp = ensureEffectiveMcpSelection(snapshot.selectedMcp);
  let draftConfig;
  try {
    draftConfig = composeDraftConfig(snapshot);
  } catch (error) {
    setError(error instanceof Error ? error.message : '品牌配置不是合法 JSON');
    return false;
  }

  state.busy = true;
  resetBanner();
  render();

  try {
    const detail = state.portalAppDetails[snapshot.brandId] || {};
    const existingSkillBindings = new Map(asArray(detail.skillBindings).map((item) => [item.skillSlug, item]));
    const existingMcpBindings = new Map(asArray(detail.mcpBindings).map((item) => [item.mcpKey, item]));
    const existingModelBindings = new Map(asArray(detail.modelBindings).map((item) => [item.modelRef, item]));
    const existingMenuBindings = new Map(mergeMenuBindings(detail.menuBindings).map((item) => [item.menuKey, item]));
    const existingComposerControlBindings = new Map(
      mergeComposerControlBindings(detail.composerControlBindings).map((item) => [item.controlKey, item]),
    );
    const existingComposerShortcutBindings = new Map(
      mergeComposerShortcutBindings(detail.composerShortcutBindings).map((item) => [item.shortcutKey, item]),
    );
    const oemSelectedSkills = snapshot.selectedSkills.filter((skillSlug) => !isPlatformManagedSkillSlug(skillSlug));
    const oemSelectedMcp = snapshot.selectedMcp.filter((mcpKey) => !isPlatformManagedMcpKey(mcpKey));
    const selectedRechargePackages = buildOrderedRechargePackageList(snapshot.rechargePackageOrder)
      .filter((packageId) => asStringArray(snapshot.selectedRechargePackages).includes(packageId));
    if (snapshot.useRechargePackagesOverride && !selectedRechargePackages.length) {
      throw new Error('OEM 充值套餐至少选择一个套餐，或关闭 OEM 覆盖回退到平台默认。');
    }
    const defaultRechargePackage = selectedRechargePackages.includes(snapshot.defaultRechargePackage)
      ? snapshot.defaultRechargePackage
      : selectedRechargePackages.find((packageId) => asStringArray(snapshot.recommendedRechargePackages).includes(packageId)) ||
        selectedRechargePackages[0] ||
        '';
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        displayName: snapshot.displayName,
        status: snapshot.status === 'disabled' ? 'disabled' : 'active',
        defaultLocale: 'zh-CN',
        config: draftConfig,
      }),
    });
    await Promise.all([
      apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}/skills`, {
        method: 'PUT',
        body: JSON.stringify(
          oemSelectedSkills.map((skillSlug, index) => ({
            skillSlug,
            enabled: true,
            sortOrder: (index + 1) * 10,
            config: asObject(existingSkillBindings.get(skillSlug)?.config),
          })),
        ),
      }),
      apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}/mcps`, {
        method: 'PUT',
        body: JSON.stringify(
          oemSelectedMcp.map((mcpKey, index) => ({
            mcpKey,
            enabled: true,
            sortOrder: (index + 1) * 10,
            config: asObject(existingMcpBindings.get(mcpKey)?.config),
          })),
        ),
      }),
      apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}/recharge-packages`, {
        method: 'PUT',
        body: JSON.stringify(
          snapshot.useRechargePackagesOverride
            ? selectedRechargePackages.map((packageId, index) => ({
                packageId,
                enabled: true,
                sortOrder: (index + 1) * 10,
                recommended: asStringArray(snapshot.recommendedRechargePackages).includes(packageId),
                default: packageId === defaultRechargePackage,
                config: {},
              }))
            : [],
        ),
      }),
      apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}/models`, {
        method: 'PUT',
        body: JSON.stringify([]),
      }),
      apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}/menus`, {
        method: 'PUT',
        body: JSON.stringify(
          buildOrderedMenuList(snapshot.menuOrder).map((menuKey, index) => {
            const item = getMenuDefinition(menuKey) || {key: menuKey};
            return {
              menuKey: item.key,
              enabled: snapshot.selectedMenus.includes(item.key),
              sortOrder: (index + 1) * 10,
              config: buildMenuBindingConfig(
                asObject(existingMenuBindings.get(item.key)?.config),
                asObject(snapshot.menuConfigs)[item.key],
              ),
            };
          }),
        ),
      }),
      apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}/composer-controls`, {
        method: 'PUT',
        body: JSON.stringify(
          buildOrderedComposerControlList(snapshot.composerControlOrder).map((controlKey, index) => ({
            controlKey,
            enabled: snapshot.selectedComposerControls.includes(controlKey),
            sortOrder: (index + 1) * 10,
            config: buildComposerControlBindingConfig(
              asObject(existingComposerControlBindings.get(controlKey)?.config),
              asObject(snapshot.composerControlConfigs)[controlKey],
            ),
          })),
        ),
      }),
      apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}/composer-shortcuts`, {
        method: 'PUT',
        body: JSON.stringify(
          buildOrderedComposerShortcutList(snapshot.composerShortcutOrder).map((shortcutKey, index) => ({
            shortcutKey,
            enabled: snapshot.selectedComposerShortcuts.includes(shortcutKey),
            sortOrder: (index + 1) * 10,
            config: buildComposerShortcutBindingConfig(
              asObject(existingComposerShortcutBindings.get(shortcutKey)?.config),
              asObject(snapshot.composerShortcutConfigs)[shortcutKey],
            ),
          })),
        ),
      }),
    ]);

    await loadAppData();
    state.route = 'brand-detail';
    await loadBrandDetail(snapshot.brandId, {silent: true, suppressRender: true});
    setNotice(`已保存 ${snapshot.displayName || snapshot.brandId} 的应用配置。`);
    return true;
  } catch (error) {
    setError(error instanceof Error ? error.message : '保存应用配置失败');
    return false;
  } finally {
    state.busy = false;
    render();
  }
}

async function publishCurrentBrand() {
  const brandId = state.selectedBrandId;
  if (!brandId) return;
  const form = document.querySelector('#brand-editor-form');
  if (form instanceof HTMLFormElement) {
    const saved = await saveBrandEditor(form);
    if (!saved) return;
  }
  state.busy = true;
  resetBanner();
  render();
  try {
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/publish`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    await loadAppData();
    state.route = 'brand-detail';
    await loadBrandDetail(brandId, {silent: true, suppressRender: true});
    setNotice(`已发布 ${brandId} 当前快照。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '发布失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function rollbackBrand(version) {
  if (!state.selectedBrandId || !version) return;
  state.busy = true;
  resetBanner();
  render();
  try {
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(state.selectedBrandId)}/restore`, {
      method: 'POST',
      body: JSON.stringify({version}),
    });
    await loadAppData();
    state.route = 'brand-detail';
    await loadBrandDetail(state.selectedBrandId, {silent: true, suppressRender: true});
    setNotice(`已将 ${state.selectedBrandId} 恢复到 v${version}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '恢复版本失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function createBrand(formData) {
  const brandId = String(formData.get('brand_id') || '').trim().toLowerCase();
  const displayName = String(formData.get('display_name') || '').trim();
  const productName = String(formData.get('product_name') || '').trim();
  const tenantKey = String(formData.get('tenant_key') || brandId).trim();

  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        displayName: displayName,
        status: 'active',
        defaultLocale: 'zh-CN',
        config: {
          productName,
          product_name: productName,
          tenantKey,
          tenant_key: tenantKey,
          brand_meta: {
            brand_id: brandId,
            display_name: displayName || brandId,
            product_name: productName || displayName || brandId,
            tenant_key: tenantKey,
            legal_name: displayName || brandId,
            storage_namespace: tenantKey,
          },
          brandMeta: {
            productName,
            tenantKey,
          },
          surfaces: DEFAULT_SURFACE_KEYS.reduce((accumulator, key) => {
            accumulator[key] = {enabled: true, config: {}};
            return accumulator;
          }, {}),
          theme: {
            light: {},
            dark: {},
          },
        },
      }),
    });
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/menus`, {
      method: 'PUT',
      body: JSON.stringify(
        getMenuCatalogItems().map((item, index) => ({
          menuKey: item.key,
          enabled: isMenuEnabledByDefault(item),
          sortOrder: (index + 1) * 10,
          config: {},
        })),
      ),
    });
    await Promise.all([
      apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/composer-controls`, {
        method: 'PUT',
        body: JSON.stringify(
          getComposerControlCatalogItems().map((item, index) => ({
            controlKey: item.controlKey,
            enabled: item.active !== false,
            sortOrder: (index + 1) * 10,
            config: {},
          })),
        ),
      }),
      apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/composer-shortcuts`, {
        method: 'PUT',
        body: JSON.stringify(
          getComposerShortcutCatalogItems().map((item, index) => ({
            shortcutKey: item.shortcutKey,
            enabled: item.active !== false,
            sortOrder: (index + 1) * 10,
            config: {},
          })),
        ),
      }),
    ]);
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/models`, {
      method: 'PUT',
      body: JSON.stringify([]),
    });
    await loadAppData();
    state.showCreateBrandForm = false;
    state.route = 'brand-detail';
    await loadBrandDetail(brandId, {silent: true, suppressRender: true});
    setNotice(`已创建 OEM 应用 ${displayName || brandId}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '创建 OEM 应用失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function saveAsset(formData) {
  const brandId = String(formData.get('brand_id') || '').trim();
  const assetKey = String(formData.get('asset_key') || '').trim();
  const kind = String(formData.get('kind') || '').trim();
  const file = formData.get('file');
  const metadata = expandMetadataEntries(readMetadataEntriesFromForm(document.querySelector('#asset-form'), 'metadata_entries'));

  state.busy = true;
  resetBanner();
  render();

  try {
    if (!(file instanceof File) || file.size === 0) {
      throw new Error('请选择要上传的资源文件');
    }
    const fileBase64 = await readFileAsBase64(file);
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/assets/${encodeURIComponent(assetKey)}/upload`, {
      method: 'POST',
      body: JSON.stringify({
        content_type: file.type || 'application/octet-stream',
        file_name: file.name,
        file_base64: fileBase64,
        metadata: {
          ...metadata,
          kind,
        },
      }),
    });

    await loadAppData();
    state.showAssetUploadPanel = false;
    if (brandId) {
      await loadBrandDetail(brandId, {silent: true, suppressRender: true});
    }
    setNotice(`已更新 ${assetKey} 资源绑定。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '资源保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function deleteAsset(brandId, assetKey) {
  if (!brandId || !assetKey) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/assets/${encodeURIComponent(assetKey)}`, {
      method: 'DELETE',
    });
    await loadAppData();
    if (brandId) {
      await loadBrandDetail(brandId, {silent: true, suppressRender: true});
    }
    setNotice(`已删除资源 ${assetKey}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '资源删除失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function uploadDesktopReleaseFiles(formData) {
  const brandId = String(formData.get('brand_id') || '').trim();
  const channel = String(formData.get('channel') || 'prod').trim() || 'prod';
  if (!brandId) {
    throw new Error('请选择要发布的品牌');
  }

  const slots = [
    ['darwin', 'aarch64', 'installer'],
    ['darwin', 'aarch64', 'updater'],
    ['darwin', 'aarch64', 'signature'],
    ['darwin', 'x64', 'installer'],
    ['darwin', 'x64', 'updater'],
    ['darwin', 'x64', 'signature'],
    ['windows', 'x64', 'installer'],
    ['windows', 'x64', 'updater'],
    ['windows', 'x64', 'signature'],
    ['windows', 'aarch64', 'installer'],
    ['windows', 'aarch64', 'updater'],
    ['windows', 'aarch64', 'signature'],
  ];
  let uploaded = 0;

  for (const [platform, arch, artifactType] of slots) {
    const fieldName = `desktop_file_${platform}_${arch}_${artifactType}`;
    const file = formData.get(fieldName);
    if (!(file instanceof File) || file.size === 0) {
      continue;
    }
    await apiUploadBinary(
      `/admin/portal/apps/${encodeURIComponent(brandId)}/desktop-release/${encodeURIComponent(channel)}/${encodeURIComponent(platform)}/${encodeURIComponent(arch)}/${encodeURIComponent(artifactType)}`,
      file,
      {
        contentType: inferBinaryContentType(file),
      },
    );
    uploaded += 1;
  }

  return uploaded;
}

async function publishDesktopRelease(formData) {
  const brandId = String(formData.get('brand_id') || '').trim();
  const channel = String(formData.get('channel') || 'prod').trim() || 'prod';
  const version = String(formData.get('version') || '').trim();
  const notes = String(formData.get('notes') || '').trim();
  const enforcementMode = String(formData.get('enforcement_mode') || 'recommended').trim() || 'recommended';
  const mandatory = enforcementMode === 'required_after_run' || enforcementMode === 'required_now';
  const forceUpdateBelowVersion = String(formData.get('force_update_below_version') || '').trim();
  const allowCurrentRunToFinish = enforcementMode !== 'required_now';
  const reasonMessage = String(formData.get('reason_message') || '').trim();

  if (!brandId) {
    setError('请选择要发布的品牌');
    return;
  }
  if (!version) {
    setError('请填写桌面版本号');
    return;
  }

  state.busy = true;
  resetBanner();
  render();

  try {
    const uploadedCount = await uploadDesktopReleaseFiles(formData);
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/desktop-release/${encodeURIComponent(channel)}/publish`, {
      method: 'POST',
      body: JSON.stringify({
        version,
        notes: notes || null,
        mandatory,
        force_update_below_version: forceUpdateBelowVersion || null,
        allow_current_run_to_finish: allowCurrentRunToFinish,
        reason_code: mandatory ? (enforcementMode === 'required_now' ? 'mandatory_immediate' : 'stability_hotfix') : null,
        reason_message: reasonMessage || null,
      }),
    });
    await loadAppData();
    setNotice(
      uploadedCount > 0
        ? `桌面版本 ${version} 已发布并生效，同时上传了 ${uploadedCount} 个发布文件。`
        : `桌面版本 ${version} 已发布并生效。`,
    );
  } catch (error) {
    setError(error instanceof Error ? error.message : '桌面发布失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function setSkillEnabled(slug, enabled) {
  if (!slug) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    const skill = getMergedSkills().find((item) => item.slug === slug);
    if (!skill) {
      throw new Error('skill not found');
    }
    await apiFetch(`/admin/portal/catalog/skills/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      body: JSON.stringify({
        metadata: asObject(skill.metadata),
        active: enabled,
      }),
    });
    await loadAppData();
    setNotice(`平台预装 Skill ${slug} 已${enabled ? '启用' : '停用'}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : `平台预装 Skill ${enabled ? '启用' : '停用'}失败`);
  } finally {
    state.busy = false;
    render();
  }
}

async function setAgentEnabled(slug, enabled) {
  if (!slug) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    const agent = getAgentCatalogEntry(slug);
    if (!agent) {
      throw new Error('agent not found');
    }
    await apiFetch('/admin/agents/catalog', {
      method: 'PUT',
      body: JSON.stringify({
        slug: agent.slug,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        publisher: agent.publisher,
        featured: agent.featured === true,
        official: agent.official !== false,
        tags: agent.tags || [],
        capabilities: agent.capabilities || [],
        use_cases: agent.use_cases || [],
        metadata: asObject(agent.metadata),
        sort_order: Number(agent.sort_order || 0),
        active: enabled,
      }),
    });
    await loadAppData();
    setNotice(`${slug} 已${enabled ? '启用' : '停用'}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : `Agent${enabled ? '启用' : '停用'}失败`);
  } finally {
    state.busy = false;
    render();
  }
}

async function deleteAgentCatalogEntry(slug) {
  if (!slug) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch(`/admin/agents/catalog?slug=${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    });
    await loadAppData();
    setNotice(`已删除 Agent ${slug}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Agent 删除失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function saveAgentCatalogEntry(formData) {
  state.busy = true;
  resetBanner();
  render();

  try {
    const slug = String(formData.get('slug') || '').trim();
    const form = document.querySelector('#agent-editor-form');
    const metadata = expandMetadataEntries(readMetadataEntriesFromForm(form, 'metadata_entries'));
    const avatarUrl = String(formData.get('avatar_url') || '').trim();
    if (avatarUrl) {
      metadata.avatar_url = avatarUrl;
    } else {
      delete metadata.avatar_url;
    }
    await apiFetch('/admin/agents/catalog', {
      method: 'PUT',
      body: JSON.stringify({
        slug,
        name: String(formData.get('name') || '').trim(),
        description: String(formData.get('description') || '').trim(),
        category: String(formData.get('category') || '').trim() || 'general',
        publisher: String(formData.get('publisher') || '').trim() || 'admin-web',
        featured: String(formData.get('featured') || 'false') === 'true',
        official: String(formData.get('official') || 'true') === 'true',
        tags: splitLines(formData.get('tags_text')),
        capabilities: splitLines(formData.get('capabilities_text')),
        use_cases: splitLines(formData.get('use_cases_text')),
        metadata,
        sort_order: Number.parseInt(String(formData.get('sort_order') || '9999').trim() || '9999', 10),
        active: String(formData.get('active') || 'true') === 'true',
      }),
    });
    await loadAppData();
    state.selectedAgentSlug = slug;
    state.showAgentImportPanel = false;
    setNotice(`已保存 Agent ${slug}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Agent 保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

function canAutoSaveAgentForm(form) {
  if (!(form instanceof HTMLFormElement)) {
    return false;
  }
  const slugInput = form.querySelector('input[name="slug"]');
  const nameInput = form.querySelector('input[name="name"]');
  const slug = slugInput instanceof HTMLInputElement ? slugInput.value.trim() : '';
  const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '';
  return Boolean(slug && name);
}

async function deleteSkill(slug) {
  if (!slug) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch(`/admin/portal/catalog/skills/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    });
    await loadAppData();
    setNotice(`已将 ${slug} 移出平台预装 Skill。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '移出平台预装 Skill 失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function importSkill(formData) {
  state.busy = true;
  resetBanner();
  render();

  try {
    const slug = String(formData.get('slug') || '').trim();
    if (!slug) {
      throw new Error('请填写 Skill slug');
    }
    const skill = getMergedSkills().find((item) => item.slug === slug) || null;
    if (!skill) {
      throw new Error(`未找到 Skill ${slug}`);
    }
    const body = {
      metadata: expandMetadataEntries(readMetadataEntriesFromForm(document.querySelector('#skill-import-form'), 'metadata_entries')),
      active: String(formData.get('active') || 'true') === 'true',
    };
    await apiFetch(`/admin/portal/catalog/skills/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    await loadAppData();
    state.showSkillImportPanel = false;
    state.selectedSkillSlug = slug;
    setNotice(`已保存平台预装 Skill 绑定 ${slug}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '平台预装 Skill 保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function addPlatformSkillFromCloud(formData) {
  state.busy = true;
  resetBanner();
  render();

  try {
    const slug = String(formData.get('slug') || '').trim();
    if (!slug) {
      throw new Error('请填写 cloud skill slug');
    }
    let cloudSkill =
      state.cloudSkillCatalog.find((item) => item.slug === slug) ||
      state.brandSkillCatalog.find((item) => item.slug === slug) ||
      null;
    if (!cloudSkill) {
      const data = await apiFetch(buildAdminSkillCatalogPath({limit: ADMIN_SKILL_BROWSER_PAGE_SIZE, offset: 0, query: slug}), {method: 'GET'});
      cloudSkill = asArray(data.items).find((item) => String(item?.slug || '').trim() === slug) || null;
    }
    if (!cloudSkill) {
      throw new Error(`云技能中未找到 ${slug}`);
    }
    await apiFetch(`/admin/portal/catalog/skills/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      body: JSON.stringify({
        metadata: {
          sourceType: 'platform-binding',
          sourceCatalog: 'cloud-skills',
          cloudSkillSlug: slug,
        },
        active: cloudSkill.active !== false,
      }),
    });
    await loadAppData();
    state.selectedSkillSlug = slug;
    state.showPlatformSkillAddPanel = false;
    setNotice(`已将云技能 ${slug} 加入平台预装 Skill。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '加入平台预装 Skill 失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function setCloudSkillEnabled(slug, enabled) {
  if (!slug) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    const skill = getCloudSkillCatalogEntry(slug);
    if (!skill) {
      throw new Error('cloud skill not found');
    }
    await apiFetch('/admin/skills/catalog', {
      method: 'PUT',
      body: JSON.stringify({
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        market: skill.market || null,
        category: skill.category || null,
        skill_type: skill.skill_type || null,
        publisher: skill.publisher,
        distribution: skill.distribution,
        tags: skill.tags || [],
        version: skill.version,
        artifact_url: skill.artifact_url || null,
        artifact_format: skill.artifact_format,
        artifact_sha256: skill.artifact_sha256 || null,
        artifact_source_path: skill.distribution === 'bundled' ? (skill.artifact_path || null) : null,
        origin_type: skill.origin_type,
        source_url: skill.source_url || null,
        metadata: asObject(skill.metadata),
        active: enabled,
      }),
    });
    await loadAppData();
    setNotice(`${slug} 已${enabled ? '上架' : '下架'}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : `云技能${enabled ? '上架' : '下架'}失败`);
  } finally {
    state.busy = false;
    render();
  }
}

async function addPlatformMcpFromRegistry(formData) {
  state.busy = true;
  resetBanner();
  render();

  try {
    const key = String(formData.get('key') || '').trim();
    if (!key) {
      throw new Error('请填写 MCP key');
    }
    const cloudMcpEntry = getCloudMcpCatalogEntry(key);
    if (!cloudMcpEntry) {
      throw new Error(`云MCP总库中未找到 ${key}`);
    }
    await apiFetch(`/admin/portal/catalog/mcps/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({
        metadata: {
          ...asObject(cloudMcpEntry.metadata),
          sourceType: 'cloud-mcp-import',
          sourceCatalog: 'cloud-mcps',
          cloudMcpKey: key,
        },
        active: cloudMcpEntry.enabled !== false,
      }),
    });
    await loadAppData();
    state.selectedMcpKey = key;
    state.showPlatformMcpAddPanel = false;
    setNotice(`已将 MCP ${key} 加入平台级 MCP。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '加入平台级 MCP 失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function saveSkillSyncSource(formData) {
  state.busy = true;
  resetBanner();
  render();

  try {
    const id = String(formData.get('id') || '').trim() || undefined;
    const sourceType = String(formData.get('source_type') || 'github_repo').trim();
    await apiFetch('/admin/skills/sync/sources', {
      method: 'PUT',
      body: JSON.stringify({
        id,
        source_type: sourceType,
        source_key: String(formData.get('source_key') || '').trim(),
        display_name: String(formData.get('display_name') || '').trim(),
        source_url: String(formData.get('source_url') || '').trim(),
        config: expandMetadataEntries(readMetadataEntriesFromForm(document.querySelector('#skill-sync-source-form'), 'config_entries')),
        active: String(formData.get('active') || 'true') === 'true',
      }),
    });
    await loadAppData();
    state.showSkillSyncSourceForm = false;
    setNotice('已保存同步源。');
  } catch (error) {
    setError(error instanceof Error ? error.message : '同步源保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function runSkillSync(sourceId) {
  if (!sourceId) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    const result = await apiFetch('/admin/skills/sync/run', {
      method: 'POST',
      body: JSON.stringify({
        source_id: sourceId,
      }),
    });
    await loadAppData();
    const summary = asObject(result.summary);
    setNotice(
      `同步完成：新增 ${Number(summary.created || 0)}，更新 ${Number(summary.updated || 0)}，跳过 ${Number(summary.skipped || 0)}。`,
    );
  } catch (error) {
    setError(error instanceof Error ? error.message : '技能同步失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function saveMcpCatalogEntry(formData) {
  state.busy = true;
  resetBanner();
  render();

  try {
    const key = String(formData.get('key') || '').trim();
    await apiFetch(`/admin/portal/catalog/mcps/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({
        metadata: expandMetadataEntries(readMetadataEntriesFromForm(document.querySelector('#mcp-editor-form'), 'metadata_entries')),
        active: String(formData.get('enabled') || 'true') === 'true',
      }),
    });
    await loadAppData();
    state.selectedMcpKey = key;
    setNotice(`平台级 MCP ${state.selectedMcpKey} 已保存。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'MCP 保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function saveCloudMcpCatalogEntry(formData) {
  state.busy = true;
  resetBanner();
  render();

  try {
    const key = String(formData.get('key') || '').trim();
    await apiFetch('/admin/mcp/catalog', {
      method: 'PUT',
      body: JSON.stringify({
        key,
        name: String(formData.get('name') || '').trim(),
        description: String(formData.get('description') || '').trim(),
        transport: String(formData.get('transport') || '').trim() || 'config',
        object_key: String(formData.get('object_key') || '').trim() || null,
        enabled: String(formData.get('enabled') || 'true') === 'true',
        command: String(formData.get('command') || '').trim() || null,
        args: splitLines(String(formData.get('args_text') || '')),
        http_url: String(formData.get('http_url') || '').trim() || null,
        env: parseEnvText(String(formData.get('env_text') || '')),
        metadata: expandMetadataEntries(readMetadataEntriesFromForm(document.querySelector('#cloud-mcp-editor-form'), 'cloud_mcp_metadata_entries')),
      }),
    });
    await loadAppData();
    state.selectedCloudMcpKey = key;
    setNotice(`云MCP ${key} 已保存。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '云MCP 保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function testMcpCatalogEntry(payload) {
  state.busy = true;
  resetBanner();
  render();

  try {
    state.mcpTestResult = await apiFetch('/admin/mcp/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setNotice(`MCP 测试${state.mcpTestResult.ok ? '通过' : '失败'}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'MCP 测试失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function deleteMcpCatalogEntry(key) {
  if (!key) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch(`/admin/portal/catalog/mcps/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    await loadAppData();
    state.selectedMcpKey = '';
    setNotice(`已将 ${key} 移出平台级 MCP。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'MCP 删除失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function deleteCloudMcpCatalogEntry(key) {
  if (!key) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch(`/admin/mcp/catalog?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    await loadAppData();
    state.selectedCloudMcpKey = '';
    setNotice(`已删除云MCP ${key}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '云MCP 删除失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function setModelEnabled(ref, enabled) {
  if (!ref) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    const model = getModelCatalogEntry(ref);
    if (!model) {
      throw new Error('model not found');
    }
    await apiFetch('/admin/portal/catalog/models', {
      method: 'PUT',
      body: JSON.stringify({
        ref: model.ref,
        label: model.label,
        providerId: model.providerId,
        modelId: model.modelId,
        api: model.api,
        baseUrl: model.baseUrl || null,
        useRuntimeOpenai: model.useRuntimeOpenai !== false,
        authHeader: model.authHeader !== false,
        reasoning: model.reasoning === true,
        input: asStringArray(model.input),
        contextWindow: Number(model.contextWindow || 0),
        maxTokens: Number(model.maxTokens || 0),
        metadata: asObject(model.metadata),
        active: enabled,
      }),
    });
    await loadAppData();
    setNotice(`${ref} 已${enabled ? '启用' : '停用'}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : `模型${enabled ? '启用' : '停用'}失败`);
  } finally {
    state.busy = false;
    render();
  }
}

async function saveModelCatalogEntry(formData) {
  state.busy = true;
  resetBanner();
  render();

  try {
    const ref = String(formData.get('ref') || '').trim();
    await apiFetch('/admin/portal/catalog/models', {
      method: 'PUT',
      body: JSON.stringify({
        ref,
        label: String(formData.get('label') || '').trim(),
        providerId: String(formData.get('provider_id') || '').trim(),
        modelId: String(formData.get('model_id') || '').trim(),
        api: String(formData.get('api') || '').trim() || 'openai-completions',
        baseUrl: String(formData.get('base_url') || '').trim() || null,
        useRuntimeOpenai: String(formData.get('use_runtime_openai') || 'true') === 'true',
        authHeader: String(formData.get('auth_header') || 'true') === 'true',
        reasoning: String(formData.get('reasoning') || 'false') === 'true',
        input: splitLines(String(formData.get('input_text') || '')),
        contextWindow: Number(formData.get('context_window') || 0) || 0,
        maxTokens: Number(formData.get('max_tokens') || 0) || 0,
        metadata: expandMetadataEntries(readMetadataEntriesFromForm(document.querySelector('#model-editor-form'), 'metadata_entries')),
        active: String(formData.get('enabled') || 'true') === 'true',
      }),
    });
    await loadAppData();
    state.selectedModelRef = ref;
    setNotice(`模型 ${ref} 已保存。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '模型保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function deleteModelCatalogEntry(ref) {
  if (!ref) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch(`/admin/portal/catalog/models?ref=${encodeURIComponent(ref)}`, {
      method: 'DELETE',
    });
    await loadAppData();
    state.selectedModelRef = '';
    setNotice(`已删除模型 ${ref}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '模型删除失败');
  } finally {
    state.busy = false;
    render();
  }
}

function buildProviderModelRowNode(values = {}) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderModelProviderRow(values, document.querySelectorAll('[data-model-provider-row="true"]').length);
  return wrapper.firstElementChild;
}

function appendProviderModelRow(values = {}) {
  const container = document.querySelector('[data-model-provider-rows="true"]');
  if (!(container instanceof HTMLElement)) {
    return;
  }
  const node = buildProviderModelRowNode(values);
  if (node) {
    container.appendChild(node);
  }
}

function splitCommaLines(value) {
  return String(value || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderLogoPreviewInto(container, presetKey) {
  if (!(container instanceof HTMLElement)) return;
  container.innerHTML = renderModelLogoPreview(presetKey, 'Logo');
}

function openModelLogoPicker(form, inputName) {
  const presets = Array.isArray(state.modelLogoPresets) ? state.modelLogoPresets : [];
  if (!presets.length) {
    setError('还没有可用的 logo preset');
    render();
    return;
  }
  const dialog = document.createElement('dialog');
  dialog.className = 'fig-card';
  dialog.style.maxWidth = '840px';
  dialog.style.width = 'min(840px, calc(100vw - 48px))';
  dialog.innerHTML = `
    <form method="dialog" style="display:flex;flex-direction:column;gap:16px;">
      <div class="fig-card__head">
        <h3>选择 Logo</h3>
        <button class="ghost-button" value="cancel">关闭</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;max-height:60vh;overflow:auto;">
        ${presets
          .map(
            (item) => `
              <button class="capability-card" type="button" data-logo-preset-choice="${escapeHtml(item.presetKey)}" style="text-align:left;">
                <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.label)}" style="width:40px;height:40px;object-fit:contain;margin-bottom:10px;" />
                <strong>${escapeHtml(item.label)}</strong>
                <span>${escapeHtml(item.presetKey)}</span>
              </button>
            `,
          )
          .join('')}
      </div>
    </form>
  `;
  document.body.appendChild(dialog);
  dialog.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-logo-preset-choice]') : null;
    if (!target) return;
    const presetKey = target.getAttribute('data-logo-preset-choice') || '';
    const input = form.querySelector(`[name="${inputName}"]`);
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      input.value = presetKey;
      const preview = input.closest('.field')?.nextElementSibling?.querySelector('[data-logo-preview="true"]')
        || input.closest('.field')?.parentElement?.querySelector('[data-logo-preview="true"]');
      renderLogoPreviewInto(preview, presetKey);
    }
    dialog.close();
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
  });
  dialog.showModal();
}

async function restoreRecommendedRechargePackages() {
  state.busy = true;
  resetBanner();
  render();

  try {
    const result = await apiFetch('/admin/portal/catalog/recharge-packages/restore-recommended', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    await loadAppData();
    state.selectedRechargePackageId = 'topup_7000';
    setNotice(`已恢复超值推荐三挡：保留 ${Number(result.restoredCount || 0)} 个套餐，移除 ${Number(result.deletedCount || 0)} 个其它平台套餐。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '恢复超值推荐三挡失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function saveModelProviderProfile(form) {
  captureModelProviderDraft(form);
  const formData = new FormData(form);
  state.busy = true;
  resetBanner();

  try {
    const scopeType = String(formData.get('scope_type') || '').trim();
    const scopeKey = String(formData.get('scope_key') || '').trim();
    const providerMode = String(formData.get('provider_mode') || 'inherit_platform').trim();
    const providerKey = String(formData.get('provider_key') || '').trim();
    const baseUrl = String(formData.get('base_url') || '').trim();
    const apiKey = String(formData.get('api_key') || '').trim();
    const shouldSaveProfile = scopeType === 'platform' || providerMode === 'use_app_profile' || Boolean(providerKey);
    let savedProfile = null;
    let effectiveProviderMode = providerMode;

    if (shouldSaveProfile) {
      const models = Array.from(form.querySelectorAll('[data-model-provider-row="true"]'))
        .map((row, index) => {
          const getValue = (name) => row.querySelector(`[name="${name}"]`);
          return {
            label: String(getValue('model_label')?.value || '').trim(),
            modelId: String(getValue('model_id')?.value || '').trim(),
            logoPresetKey: String(getValue('model_logo_preset_key')?.value || '').trim() || null,
            billingMultiplier: normalizeBillingMultiplierValue(getValue('model_billing_multiplier')?.value, 1),
            reasoning: false,
            inputModalities: ['text'],
            contextWindow: null,
            maxTokens: null,
            enabled: true,
            sortOrder: 100 + index,
            metadata: {},
          };
        })
        .filter((item) => item.modelId && item.label);
      const modelRefs = models.map((item) => buildProviderDraftModelRef(providerKey, item.modelId)).filter(Boolean);
      let defaultModelRef = String(formData.get('default_model_ref') || '').trim();
      if (defaultModelRef && !modelRefs.includes(defaultModelRef)) {
        defaultModelRef = '';
      }

      if (
        scopeType === 'app' &&
        providerMode !== 'use_app_profile' &&
        (providerKey || baseUrl || apiKey || models.length > 0)
      ) {
        effectiveProviderMode = 'use_app_profile';
      }

      savedProfile = await apiFetch('/admin/portal/model-provider-profiles', {
        method: 'PUT',
        body: JSON.stringify({
          id: String(formData.get('profile_id') || '').trim() || null,
          scopeType,
          scopeKey,
          providerKey,
          providerLabel: providerKey,
          apiProtocol: 'openai-completions',
          baseUrl,
          authMode: 'bearer',
          apiKey,
          logoPresetKey: String(formData.get('logo_preset_key') || '').trim() || null,
          metadata: defaultModelRef ? {default_model_ref: defaultModelRef} : {},
          enabled: true,
          sortOrder: 100,
          models,
        }),
      });
    }

    if (scopeType === 'app') {
      await apiFetch(`/admin/portal/apps/${encodeURIComponent(scopeKey)}/model-provider-override`, {
        method: 'PUT',
        body: JSON.stringify({
          providerMode: effectiveProviderMode,
          activeProfileId:
            effectiveProviderMode === 'use_app_profile'
              ? savedProfile?.id || String(formData.get('profile_id') || '').trim() || null
              : null,
          cacheVersion: Date.now(),
        }),
      });
    }

    await loadAppData();
    delete state.modelProviderDrafts[getModelProviderDraftKey(scopeType, scopeKey)];
    state.selectedModelProviderTab = scopeType === 'platform' ? 'platform' : scopeKey;
    setNotice(
      `${scopeType === 'platform' ? '平台' : scopeKey} provider 已保存${scopeType === 'app' && effectiveProviderMode === 'use_app_profile' && providerMode !== 'use_app_profile' ? '，并已自动切到 OEM Provider。' : '。'}`,
    );
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Provider 保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function saveMemoryEmbeddingProfile(form) {
  captureMemoryEmbeddingDraft(form);
  const formData = new FormData(form);
  state.busy = true;
  resetBanner();

  try {
    const scopeType = String(formData.get('scope_type') || '').trim();
    const scopeKey = String(formData.get('scope_key') || '').trim();
    const providerKey = String(formData.get('memory_provider_key') || '').trim();
    const baseUrl = String(formData.get('memory_base_url') || '').trim();
    const apiKey = String(formData.get('memory_api_key') || '').trim();
    const embeddingModel = String(formData.get('memory_embedding_model') || '').trim();
    const autoRecall = formData.get('memory_auto_recall') === 'on';

    const preflight = await apiFetch('/admin/portal/memory-embedding-profiles/preflight', {
      method: 'POST',
      body: JSON.stringify({
        providerKey,
        baseUrl,
        authMode: 'bearer',
        apiKey,
        embeddingModel,
      }),
    });
    state.memoryEmbeddingTestResult = {
      ok: true,
      message: preflight?.dimensions ? `${preflight.dimensions} 维向量返回成功` : '预检通过',
      dimensions: preflight?.dimensions || null,
    };

    await apiFetch('/admin/portal/memory-embedding-profiles', {
      method: 'PUT',
      body: JSON.stringify({
        id: String(formData.get('memory_profile_id') || '').trim() || null,
        scopeType,
        scopeKey,
        providerKey,
        providerLabel: providerKey,
        baseUrl,
        authMode: 'bearer',
        apiKey,
        embeddingModel,
        logoPresetKey: String(formData.get('memory_logo_preset_key') || '').trim() || null,
        autoRecall,
        metadata: {},
        enabled: true,
      }),
    });

    await loadAppData();
    delete state.memoryEmbeddingDrafts[getMemoryEmbeddingDraftKey(scopeType, scopeKey)];
    setNotice(
      `${scopeType === 'platform' ? '平台' : scopeKey} 记忆 Embedding 已保存，并通过预检${preflight?.dimensions ? `（${preflight.dimensions} 维）` : ''}。`,
    );
  } catch (error) {
    setError(error instanceof Error ? error.message : '记忆 Embedding 保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function testMemoryEmbeddingProfile(form) {
  captureMemoryEmbeddingDraft(form);
  const formData = new FormData(form);
  state.busy = true;
  resetBanner();
  render();

  try {
    state.memoryEmbeddingTestResult = await apiFetch('/admin/portal/memory-embedding-profiles/preflight', {
      method: 'POST',
      body: JSON.stringify({
        providerKey: String(formData.get('memory_provider_key') || '').trim(),
        baseUrl: String(formData.get('memory_base_url') || '').trim(),
        authMode: 'bearer',
        apiKey: String(formData.get('memory_api_key') || '').trim(),
        embeddingModel: String(formData.get('memory_embedding_model') || '').trim(),
      }),
    });
    setNotice(
      `记忆 Embedding 测试通过${state.memoryEmbeddingTestResult?.dimensions ? `（${state.memoryEmbeddingTestResult.dimensions} 维）` : ''}。`,
    );
  } catch (error) {
    state.memoryEmbeddingTestResult = {ok: false, message: error instanceof Error ? error.message : '记忆 Embedding 测试失败'};
    setError(error instanceof Error ? error.message : '记忆 Embedding 测试失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function restorePlatformMemoryEmbedding(appName) {
  const normalizedAppName = String(appName || '').trim();
  if (!normalizedAppName) {
    return;
  }
  const appProfile = getMemoryEmbeddingProfilesByScope('app', normalizedAppName)[0] || null;
  if (!appProfile?.id) {
    return;
  }

  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch(`/admin/portal/memory-embedding-profiles?id=${encodeURIComponent(appProfile.id)}`, {
      method: 'DELETE',
    });
    delete state.memoryEmbeddingDrafts[getMemoryEmbeddingDraftKey('app', normalizedAppName)];
    await loadAppData();
    setNotice(`${normalizedAppName} 已恢复跟随平台记忆 Embedding。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '恢复平台记忆 Embedding 失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function restorePlatformModelProvider(appName) {
  const normalizedAppName = String(appName || '').trim();
  if (!normalizedAppName) {
    return;
  }

  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(normalizedAppName)}/model-provider-override`, {
      method: 'PUT',
      body: JSON.stringify({
        providerMode: 'inherit_platform',
        activeProfileId: null,
        cacheVersion: Date.now(),
      }),
    });
    delete state.modelProviderDrafts[getModelProviderDraftKey('app', normalizedAppName)];
    await loadAppData();
    state.selectedModelProviderTab = normalizedAppName;
    setNotice(`${normalizedAppName} 已恢复跟随平台 Provider。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '恢复平台 Provider 失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function savePaymentProviderConfig(form) {
  const formData = new FormData(form);
  state.busy = true;
  resetBanner();

  try {
    const scopeType = String(formData.get('scope_type') || '').trim() || 'platform';
    const scopeKey = String(formData.get('scope_key') || '').trim() || 'platform';
    const provider = String(formData.get('provider') || PRIMARY_PAYMENT_PROVIDER).trim() || PRIMARY_PAYMENT_PROVIDER;
    const mode = String(formData.get('mode') || 'inherit_platform').trim() || 'inherit_platform';
    const existingProfile = getPaymentProviderProfilesByScope(scopeType, scopeKey, provider)[0] || null;
    const shouldSaveProfile =
      scopeType === 'platform' || mode === 'use_app_profile' || Boolean(existingProfile) || hasAnyPaymentProviderValues(formData);
    let savedProfile = existingProfile;

    if (shouldSaveProfile) {
      const configValues = Object.fromEntries(
        PAYMENT_PROVIDER_CONFIG_FIELDS.map((key) => [key, String(formData.get(key) || '').trim()]),
      );
      const secretValues = Object.fromEntries(
        PAYMENT_PROVIDER_SECRET_FIELDS.map((key) => [key, String(formData.get(key) || '')]),
      );
      savedProfile = await apiFetch('/admin/payments/provider-profiles', {
        method: 'PUT',
        body: JSON.stringify({
          id: String(formData.get('profile_id') || '').trim() || null,
          provider,
          scope_type: scopeType,
          scope_key: scopeKey,
          channel_kind: 'wechat_service_provider',
          display_name: String(formData.get('display_name') || '').trim(),
          enabled: formData.get('enabled') === 'on',
          config_values: configValues,
          secret_values: secretValues,
        }),
      });
    }

    if (scopeType === 'app') {
      await apiFetch(`/admin/payments/provider-bindings/${encodeURIComponent(scopeKey)}`, {
        method: 'PUT',
        body: JSON.stringify({
          provider,
          mode,
          active_profile_id: mode === 'use_app_profile' ? savedProfile?.id || String(formData.get('profile_id') || '').trim() || null : null,
        }),
      });
      const usePaymentMethodsOverride = formData.get('use_oem_payment_methods_override') === 'on';
      const paymentMethodItems = DEFAULT_RECHARGE_PAYMENT_METHODS.map((item, index) => ({
        provider: item.provider,
        label: getRechargePaymentMethodOptionLabel(item.provider, item.label),
        enabled: formData.get(`payment_method_enabled__${item.provider}`) === 'on',
        default: false,
        sortOrder: Number(formData.get(`payment_method_sort_order__${item.provider}`) || (index + 1) * 10) || (index + 1) * 10,
        metadata: {},
      }))
        .sort((left, right) => left.sortOrder - right.sortOrder || left.provider.localeCompare(right.provider, 'zh-CN'));
      const enabledMethodProviders = paymentMethodItems.filter((item) => item.enabled).map((item) => item.provider);
      const requestedDefaultProvider = String(formData.get('default_payment_method') || '').trim();
      const resolvedDefaultProvider =
        enabledMethodProviders.includes(requestedDefaultProvider) ? requestedDefaultProvider : enabledMethodProviders[0] || '';
      await saveOemRechargePaymentMethodConfig(scopeKey, {
        useOverride: usePaymentMethodsOverride,
        items: paymentMethodItems.map((item) => ({
          ...item,
          default: Boolean(item.enabled && item.provider === resolvedDefaultProvider),
        })),
      });
    }

    await loadAppData();
    state.selectedPaymentProviderTab = scopeType === 'platform' ? 'platform' : scopeKey;
    setNotice(`${scopeType === 'platform' ? '平台默认支付配置' : `${scopeKey} 支付配置`}已保存。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '支付配置保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function savePaymentGatewayConfig(form) {
  const formData = new FormData(form);
  const scopeType = String(formData.get('scope_type') || 'platform').trim() === 'app' ? 'app' : 'platform';
  const scopeKey = String(formData.get('scope_key') || (scopeType === 'app' ? getSelectedPaymentProviderTab() : 'platform'))
    .trim()
    .toLowerCase();
  const mode =
    scopeType === 'app' && String(formData.get('mode') || '').trim() === 'inherit_platform'
      ? 'inherit_platform'
      : 'use_app_config';
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch('/admin/payments/gateway-config', {
      method: 'PUT',
      body: JSON.stringify({
        provider: String(formData.get('provider') || 'epay').trim() || 'epay',
        scope_type: scopeType,
        scope_key: scopeType === 'app' ? scopeKey : 'platform',
        mode,
        config_values: Object.fromEntries(
          PAYMENT_GATEWAY_CONFIG_FIELDS.map((key) => [key, String(formData.get(key) || '').trim()]),
        ),
        secret_values: Object.fromEntries(
          PAYMENT_GATEWAY_SECRET_FIELDS.map((key) => [key, String(formData.get(key) || '')]),
        ),
      }),
    });
    await loadAppData();
    delete state.paymentGatewayModeDrafts[getPaymentGatewayModeDraftKey(scopeType, scopeType === 'app' ? scopeKey : 'platform')];
    state.selectedPaymentProviderTab = scopeType === 'platform' ? 'platform' : scopeKey;
    setNotice(
      scopeType === 'app' && mode === 'inherit_platform'
        ? `${scopeKey} 已恢复继承平台支付网关。`
        : `${scopeType === 'platform' ? '平台支付网关' : `${scopeKey} 支付网关`}已保存。`,
    );
  } catch (error) {
    setError(error instanceof Error ? error.message : '支付网关保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

function toggleBrandCapability(type, value) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  if (type === 'skill' && isPlatformManagedSkillSlug(value)) {
    return;
  }
  const current =
    type === 'skill'
      ? new Set(buffer.selectedSkills)
      : type === 'mcp'
        ? new Set(buffer.selectedMcp)
        : type === 'menu'
          ? new Set(buffer.selectedMenus)
        : new Set(buffer.selectedModels);
  if (current.has(value)) {
    current.delete(value);
  } else {
    current.add(value);
  }
  if (type === 'skill') {
    buffer.selectedSkills = Array.from(current);
  } else if (type === 'mcp') {
    buffer.selectedMcp = Array.from(current);
  } else if (type === 'menu') {
    buffer.selectedMenus = Array.from(current);
  } else {
    buffer.selectedModels = Array.from(current);
    buffer.recommendedModels = buffer.recommendedModels.filter((ref) => current.has(ref));
    if (!buffer.selectedModels.includes(buffer.defaultModel)) {
      buffer.defaultModel = buffer.selectedModels[0] || '';
    }
  }
  state.brandDraftBuffer = buffer;
  render();
}

function toggleBrandRechargeOverride() {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  buffer.useRechargePackagesOverride = buffer.useRechargePackagesOverride !== true;
  if (buffer.useRechargePackagesOverride && !asStringArray(buffer.selectedRechargePackages).length) {
    const platformItems = getRechargePackageCatalogItems().filter((item) => item.active !== false);
    buffer.selectedRechargePackages = platformItems.map((item) => item.packageId);
    buffer.recommendedRechargePackages = platformItems.filter((item) => item.recommended).map((item) => item.packageId);
    buffer.defaultRechargePackage =
      platformItems.find((item) => item.default)?.packageId ||
      buffer.recommendedRechargePackages[0] ||
      buffer.selectedRechargePackages[0] ||
      '';
  }
  state.brandDraftBuffer = buffer;
  render();
}

function toggleBrandRechargePackage(packageId) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer || !buffer.useRechargePackagesOverride) return;
  const normalized = String(packageId || '').trim();
  if (!normalized) return;
  const current = new Set(asStringArray(buffer.selectedRechargePackages));
  if (current.has(normalized)) {
    current.delete(normalized);
  } else {
    current.add(normalized);
  }
  buffer.selectedRechargePackages = buildOrderedRechargePackageList(buffer.rechargePackageOrder)
    .filter((item) => current.has(item));
  buffer.recommendedRechargePackages = asStringArray(buffer.recommendedRechargePackages)
    .filter((item) => current.has(item));
  if (!buffer.selectedRechargePackages.includes(buffer.defaultRechargePackage)) {
    buffer.defaultRechargePackage = buffer.recommendedRechargePackages[0] || buffer.selectedRechargePackages[0] || '';
  }
  state.brandDraftBuffer = buffer;
  render();
}

function moveBrandRechargePackage(packageId, direction) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer || !buffer.useRechargePackagesOverride) return;
  buffer.rechargePackageOrder = moveOrderedItem(
    buffer.rechargePackageOrder,
    String(packageId || '').trim(),
    direction,
    buildOrderedRechargePackageList,
  );
  state.brandDraftBuffer = buffer;
  render();
}

function moveBrandMenu(value, direction) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  buffer.menuOrder = moveManageableMenuItem(buffer.menuOrder, value, direction);
  state.brandDraftBuffer = buffer;
  render();
}

function reorderBrandMenu(sourceValue, targetValue, placement = 'before') {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  buffer.menuOrder = reorderManageableMenuItems(buffer.menuOrder, sourceValue, targetValue, placement);
  state.brandDraftBuffer = buffer;
  state.selectedBrandMenuKey = sourceValue;
  render();
}

function toggleBrandComposerControl(controlKey) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  const current = new Set(asStringArray(buffer.selectedComposerControls));
  if (current.has(controlKey)) {
    current.delete(controlKey);
  } else {
    current.add(controlKey);
  }
  buffer.selectedComposerControls = Array.from(current);
  state.brandDraftBuffer = buffer;
  render();
}

function moveBrandComposerControl(controlKey, direction) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  buffer.composerControlOrder = moveOrderedItem(buffer.composerControlOrder, controlKey, direction, buildOrderedComposerControlList);
  state.brandDraftBuffer = buffer;
  render();
}

function reorderBrandComposerControl(sourceKey, targetKey, placement = 'before') {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  buffer.composerControlOrder = reorderOrderedItem(
    buffer.composerControlOrder,
    sourceKey,
    targetKey,
    placement,
    buildOrderedComposerControlList,
  );
  state.brandDraftBuffer = buffer;
  render();
}

function toggleBrandComposerShortcut(shortcutKey) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  const current = new Set(asStringArray(buffer.selectedComposerShortcuts));
  if (current.has(shortcutKey)) {
    current.delete(shortcutKey);
  } else {
    current.add(shortcutKey);
  }
  buffer.selectedComposerShortcuts = Array.from(current);
  state.brandDraftBuffer = buffer;
  render();
}

function moveBrandComposerShortcut(shortcutKey, direction) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  buffer.composerShortcutOrder = moveOrderedItem(
    buffer.composerShortcutOrder,
    shortcutKey,
    direction,
    buildOrderedComposerShortcutList,
  );
  state.brandDraftBuffer = buffer;
  render();
}

function reorderBrandComposerShortcut(sourceKey, targetKey, placement = 'before') {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  buffer.composerShortcutOrder = reorderOrderedItem(
    buffer.composerShortcutOrder,
    sourceKey,
    targetKey,
    placement,
    buildOrderedComposerShortcutList,
  );
  state.brandDraftBuffer = buffer;
  render();
}

function applySidebarPresetToBuffer(buffer, preset) {
  const selectedMenus = asStringArray(preset.selectedMenus);
  if (!selectedMenus.length) {
    return buffer;
  }
  const nextMenuConfigs = {...asObject(buffer.menuConfigs)};
  for (const [menuKey, config] of Object.entries(asObject(preset.menuConfigs))) {
    nextMenuConfigs[menuKey] = normalizeMenuDraftConfig({
      ...asObject(nextMenuConfigs[menuKey]),
      ...asObject(config),
    });
  }
  buffer.selectedMenus = selectedMenus;
  buffer.menuOrder = buildOrderedMenuList(asStringArray(preset.menuOrder).length ? preset.menuOrder : selectedMenus);
  buffer.menuConfigs = nextMenuConfigs;
  return buffer;
}

function applyInputAssemblyPresetToBuffer(buffer, preset) {
  const selectedComposerControls = asStringArray(preset.selectedComposerControls);
  const selectedComposerShortcuts = asStringArray(preset.selectedComposerShortcuts);
  if (selectedComposerControls.length) {
    buffer.selectedComposerControls = selectedComposerControls;
    buffer.composerControlOrder = buildOrderedComposerControlList(
      asStringArray(preset.composerControlOrder).length ? preset.composerControlOrder : selectedComposerControls,
    );
    buffer.composerControlConfigs = {
      ...asObject(buffer.composerControlConfigs),
      ...Object.fromEntries(
        Object.entries(asObject(preset.composerControlConfigs)).map(([key, value]) => [
          key,
          normalizeComposerControlDraftConfig(value),
        ]),
      ),
    };
  }
  if (selectedComposerShortcuts.length) {
    buffer.selectedComposerShortcuts = selectedComposerShortcuts;
    buffer.composerShortcutOrder = buildOrderedComposerShortcutList(
      asStringArray(preset.composerShortcutOrder).length ? preset.composerShortcutOrder : selectedComposerShortcuts,
    );
    buffer.composerShortcutConfigs = {
      ...asObject(buffer.composerShortcutConfigs),
      ...Object.fromEntries(
        Object.entries(asObject(preset.composerShortcutConfigs)).map(([key, value]) => [
          key,
          normalizeComposerShortcutDraftConfig(value),
        ]),
      ),
    };
  }
  return buffer;
}

function applyWelcomeAssemblyPresetToBuffer(buffer, preset) {
  const config = normalizeWelcomeSurfaceConfig(asObject(preset.config));
  buffer.welcome = {
    enabled: true,
    ...config,
  };
  return buffer;
}

function upsertSurfaceDraft(buffer, surfaceKey, enabled, config) {
  const nextSurface = {
    key: surfaceKey,
    label: surfaceLabel(surfaceKey),
    enabled,
    json: JSON.stringify(asObject(config), null, 2),
  };
  const nextSurfaces = asArray(buffer.surfaces)
    .filter((item) => String(asObject(item).key || '').trim() !== surfaceKey)
    .map((item) => clone(item));
  nextSurfaces.push(nextSurface);
  buffer.surfaces = nextSurfaces;
  return buffer;
}

function applyHeaderAssemblyPresetToBuffer(buffer, preset) {
  const config = normalizeHeaderSurfaceConfig(asObject(preset.config));
  return upsertSurfaceDraft(buffer, 'header', true, buildHeaderSurfaceConfigFromBuffer(config));
}

function applyHomeWebAssemblyPresetToBuffer(buffer, preset) {
  const config = normalizeHomeWebSurfaceConfig(asObject(preset.config));
  buffer.homeWeb = {
    enabled: true,
    ...config,
  };
  return upsertSurfaceDraft(buffer, 'home-web', true, buildHomeWebSurfaceConfigFromBuffer(config));
}

function applySidebarAssemblyPresetToBuffer(buffer, preset) {
  const config = normalizeSidebarSurfaceConfig(asObject(preset.config));
  buffer.sidebar = {
    enabled: true,
    ...config,
  };
  applySidebarPresetToBuffer(buffer, preset);
  return upsertSurfaceDraft(buffer, 'sidebar', true, buildSidebarSurfaceConfigFromBuffer(config));
}

function toggleBrandRecommendedModel(value) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer || !buffer.selectedModels.includes(value)) return;
  const current = new Set(buffer.recommendedModels);
  if (current.has(value)) {
    current.delete(value);
  } else {
    current.add(value);
  }
  buffer.recommendedModels = Array.from(current);
  state.brandDraftBuffer = buffer;
  render();
}

function logout() {
  persistTokens(null);
  state.user = null;
  state.view = 'login';
  state.route = 'overview';
  state.dashboard = null;
  state.brands = [];
  state.portalAppDetails = {};
  state.brandDetail = null;
  state.brandDraftBuffer = null;
  state.capabilities = null;
  state.skillCatalog = [];
  state.cloudSkillCatalog = [];
  state.cloudSkillCatalogMeta = {
    total: 0,
    limit: ADMIN_SKILL_BROWSER_PAGE_SIZE,
    offset: 0,
    hasMore: false,
    nextOffset: null,
    query: '',
    loading: false,
  };
  state.brandSkillCatalog = [];
  state.brandSkillCatalogMeta = {
    total: 0,
    limit: ADMIN_SKILL_BROWSER_PAGE_SIZE,
    offset: 0,
    hasMore: false,
    nextOffset: null,
    query: '',
    loading: false,
  };
  state.personalSkillCatalog = [];
  state.skillLibrary = [];
  state.mcpCatalog = [];
  state.modelCatalog = [];
  state.paymentProviderProfiles = [];
  state.paymentProviderBindings = [];
  state.skillSyncSources = [];
  state.skillSyncRuns = [];
  state.selectedModelRef = '';
  state.selectedPaymentProviderTab = 'platform';
  state.selectedRuntimeSection = 'release';
  state.selectedRuntimeImportChannel = 'prod';
  state.selectedRuntimeImportBindScopeType = 'none';
  state.selectedRuntimeImportBindScopeKey = '';
  state.selectedCloudSkillSlug = '';
  state.selectedSkillSyncSourceId = '';
  state.selectedReleaseId = '';
  state.selectedRuntimeReleaseId = '';
  state.selectedRuntimeBindingId = '';
  state.selectedAuditId = '';
  state.mcpTestResult = null;
  state.assets = [];
  state.releases = [];
  state.runtimeReleases = [];
  state.runtimeBindings = [];
  state.runtimeBindingHistory = [];
  state.runtimeBootstrapSource = null;
  state.runtimeReleaseDraftBuffer = null;
  state.runtimeBindingDraftBuffer = null;
  state.audit = [];
  state.showCreateBrandForm = false;
  state.showSkillImportPanel = false;
  state.showSkillSyncSourceForm = false;
  state.showAssetUploadPanel = false;
  resetBanner();
  render();
}

function renderBanner() {
  const hasMessage = Boolean(state.error || state.notice);
  return `
    <div class="banner-row${hasMessage ? ' banner-row--toast' : ''}">
      <div class="banner banner--error"${state.error ? '' : ' hidden'}>${escapeHtml(state.error)}</div>
      <div class="banner banner--success"${state.notice ? '' : ' hidden'}>${escapeHtml(state.notice)}</div>
    </div>
  `;
}

function renderSidebar() {
  const userName = getUserDisplayName(state.user);
  const avatarUrl = getUserAvatarUrl(state.user);
  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-lockup brand-lockup--sidebar">
          ${renderAdminLogo('brand-mark--sidebar')}
          <div class="brand-lockup__copy">
            <div class="brand-lockup__kicker">iClaw Console</div>
            <h1 class="sidebar-brand__title">iClaw管理控制台</h1>
            <p class="sidebar-brand__copy">企业运营平台</p>
          </div>
        </div>
      </div>
      <nav class="nav-list">
        ${NAV_ITEMS.map(
          (item) =>
            Array.isArray(item.children) && item.children.length
              ? `
                <div class="nav-group${navIsActive(item.id) ? ' is-active' : ''}${isNavGroupCollapsed(item.id) ? ' is-collapsed' : ''}">
                  <div class="nav-item nav-item--group" data-action="navigate" data-page="${escapeHtml(item.children[0]?.id || item.id)}">
                    <div class="nav-group__summary">
                      ${icon(item.icon, 'nav-item__icon')}
                      <span class="nav-item__label">${escapeHtml(item.label)}</span>
                    </div>
                    <button
                      class="nav-group__toggle"
                      type="button"
                      data-action="toggle-nav-group"
                      data-group-id="${escapeHtml(item.id)}"
                      aria-expanded="${isNavGroupCollapsed(item.id) ? 'false' : 'true'}"
                    >
                      <span>${isNavGroupCollapsed(item.id) ? '展开' : '收起'}</span>
                      ${icon(isNavGroupCollapsed(item.id) ? 'chevronDown' : 'chevronUp', 'nav-group__toggle-icon')}
                    </button>
                  </div>
                  <div class="nav-sublist${isNavGroupCollapsed(item.id) ? ' is-collapsed' : ''}">
                    ${item.children
                      .map(
                        (child) => `
                          <button class="nav-subitem${navIsActive(child.id) ? ' is-active' : ''}" type="button" data-action="navigate" data-page="${child.id}">
                            ${icon(child.icon, 'nav-item__icon')}
                            <span class="nav-item__label">${escapeHtml(child.label)}</span>
                          </button>
                        `,
                      )
                      .join('')}
                  </div>
                </div>
              `
              : `
                <button class="nav-item${navIsActive(item.id) ? ' is-active' : ''}" type="button" data-action="navigate" data-page="${item.id}">
                  ${icon(item.icon, 'nav-item__icon')}
                  <span class="nav-item__label">${escapeHtml(item.label)}</span>
                </button>
              `,
        ).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-footer__identity">
          ${
            avatarUrl
              ? `<img class="sidebar-footer__avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(userName)}" />`
              : `<div class="sidebar-footer__avatar sidebar-footer__avatar--fallback">${escapeHtml(getUserInitials(state.user))}</div>`
          }
        <div class="sidebar-footer__meta">
            <div>${escapeHtml(userName)}</div>
          <div>v1.2.4 • 2026年3月</div>
        </div>
        </div>
        <button class="sidebar-footer__logout" type="button" data-action="logout">退出登录</button>
      </div>
    </aside>
  `;
}

function renderMiniBrandButton(brand) {
  return `
    <button
      class="mini-brand-card${brand.brandId === state.selectedBrandId ? ' is-active' : ''}"
      type="button"
      data-action="select-brand"
      data-brand-id="${escapeHtml(brand.brandId)}"
    >
      <strong>${escapeHtml(brand.displayName)}</strong>
      <span>${escapeHtml(brand.brandId)}</span>
    </button>
  `;
}

function renderHeader(title, description, actions = '') {
  return `
    <header class="page-header">
      <div class="page-header__copy">
        <p class="eyebrow">Control Plane</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="page-description">${escapeHtml(description)}</p>
      </div>
      <div class="page-actions">
        ${renderThemeModeSwitcher('theme-switcher--header')}
        ${actions}
      </div>
    </header>
  `;
}

function renderPageGuide(title, items = [], accent = 'default') {
  const safeItems = items.filter(Boolean).slice(0, 4);
  if (!safeItems.length) {
    return '';
  }
  return `
    <section class="fig-guide fig-guide--${escapeHtml(accent)}">
      <div class="fig-guide__head">
        <span class="fig-guide__eyebrow">操作指南</span>
        <h3>${escapeHtml(title)}</h3>
      </div>
      <div class="fig-guide__grid">
        ${safeItems
          .map(
            (item, index) => `
              <article class="fig-guide__item">
                <span class="fig-guide__index">${index + 1}</span>
                <p>${escapeHtml(item)}</p>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderBrandDetailGuide(activeTab) {
  const normalizedTab = normalizeBrandDetailTab(activeTab);
  if (activeTab === 'welcome') {
    return renderPageGuide('Welcome 页怎么配', [
      '这里配置聊天空状态上的 K2C Welcome 页面，用于粉丝看到的 KOL 专属入口。',
      '配置会走 OEM runtime 下发到桌面端，只替换欢迎内容区，不替换现有输入框。',
      '保存后更新草稿，发布快照后对应 OEM 才会切到新的欢迎页内容。',
    ], 'brand');
  }
  if (activeTab === 'auth') {
    return renderPageGuide('登录与协议怎么配', [
      '这里维护登录 / 注册弹窗里的说明文案、第三方登录提示，以及 OEM 专属的协议正文。',
      '协议按 OEM 独立下发，适合区分 iClaw 的通用 AI 场景和理财Claw的金融研究场景。',
      '法律主体名称仍然沿用“桌面端”里的 Legal Name，这里主要负责对用户展示的文案与正文内容。',
    ], 'brand');
  }
  if (activeTab === 'assets') {
    return renderPageGuide('品牌资源怎么用', [
      '先给品牌上传 logo、favicon、home 图等资源，asset key 要和前端约定槽位一致。',
      '同一页面可以直接预览当前品牌已登记资源，并跳转打开原文件。',
      '资源保存后若要让客户端吃到最新资源，仍需要保存品牌配置并发布快照。',
    ], 'brand');
  }
  if (activeTab === 'theme') {
    return renderPageGuide('主题样式怎么改', [
      '优先在 Light / Dark Theme 中维护主色、hover 色和文字色。',
      '页面底部会展示当前草稿快照，方便核对，但不再要求手写 JSON。',
      '保存只会更新草稿，发布快照后品牌端才会切到新主题。',
    ], 'brand');
  }
  if (activeTab === 'skills') {
    return renderPageGuide('技能装配怎么配', [
      '技能全集先在“云技能”维护；平台预装子集存到 `platform_bundled_skills`。',
      '当前页面只负责当前 OEM 的增量预装；OEM 增量层存到 `oem_bundled_skills`，平台预装会自动继承并锁定。',
      '保存配置后再发布快照，客户端同步新 snapshot 后技能入口和运行时能力才会更新。',
    ], 'brand');
  }
  if (activeTab === 'mcps') {
    return renderPageGuide('MCP 装配怎么配', [
      '云MCP总库先在“云MCP”页维护，平台通用预装子集在“平台级 MCP”维护。',
      '当前页面只负责当前 OEM 的增量装配；平台级 MCP 会自动继承并锁定。',
      '保存配置后再发布快照，客户端同步后才会加载新的 MCP 清单。',
    ], 'brand');
  }
  if (activeTab === 'recharge') {
    return renderPageGuide('充值套餐怎么配', [
      '平台级套餐目录是真值，统一维护套餐金额、龙虾币、赠送额度和充值文案。',
      'OEM 默认继承平台套餐；只有当前页保存了 OEM 绑定，运行时才会切到 OEM 自己的套餐集合。',
      '如果要恢复平台默认，直接关闭 OEM 覆盖并保存；发布快照后客户端就会吃到新的套餐配置。',
    ], 'brand');
  }
  if (activeTab === 'models') {
    return renderPageGuide('模型 Allowlist 怎么配', [
      '模型全集先在 模型中心 维护，这里只做当前 OEM 的可见模型、默认模型和推荐模型。',
      '勾选的模型就是这个 app 的 allowlist；不勾选，输入框模型选择里就不应该看到。',
      '保存配置并发布快照后，客户端同步 snapshot，必要时重启 sidecar 才会刷新 models.list。',
    ], 'brand');
  }
  if (normalizedTab === 'menus') {
    return renderPageGuide('左菜单栏怎么配', [
      '这里控制当前 OEM app 的真实左菜单，不再把“业务模块”单独拆成另一排 tab。',
      '左侧决定菜单显隐和排序，右侧同一屏维护 displayName、icon、依赖条件，以及这个菜单对应页面的 surface 配置。',
      '保存配置并发布快照后，前端才会按品牌显示新的菜单组合和对应页面配置。',
    ], 'brand');
  }
  const surfaceBlueprint = getSurfaceBlueprint(normalizedTab);
  if (surfaceBlueprint?.kind === 'shell') {
    return renderPageGuide(`${surfaceBlueprint.label}怎么配`, [
      `这里单独维护 ${surfaceBlueprint.label} 的 OEM 配置，不再和其他 UI 位混在一个大 Surface tab 里。`,
      '所有常用字段都改成了组件化表单，不再需要手写 JSON。',
      '保存配置只更新草稿；发布快照后，该 OEM 才会真正切到这套界面配置。',
    ], 'brand');
  }
  if (surfaceBlueprint?.kind === 'module') {
    return renderPageGuide(`${surfaceBlueprint.label}怎么配`, [
      `这里单独维护 ${surfaceBlueprint.label} 这个业务模块，包含入口显隐和模块 surface 配置。`,
      '如果该模块有侧边栏入口，会单独显示模块入口开关；模块内部配置改成轻量字段编辑，不再直接贴 JSON。',
      '保存配置并发布快照后，该 OEM 才会按品牌显示这块模块能力。',
    ], 'brand');
  }
  return '';
}

function renderOverviewPage() {
  const stats = state.dashboard?.stats || {};
  const releases = state.dashboard?.recent_releases || [];
  const edits = state.dashboard?.recent_edits || [];
  const cloudSkillsTotal = Number(state.cloudSkillCatalogMeta?.total || stats.cloud_skills_count || 0);
  const statCards = [
    ['品牌总数', stats.brands_total, 'portal apps', 'trendingUp'],
    ['已启用', stats.published_count, '运行中', 'checkCircle'],
    ['已禁用', stats.brands_total - stats.published_count, '已关闭', 'clock'],
    ['云技能总库', cloudSkillsTotal, 'cloud catalog', 'store'],
    ['平台级 MCP', stats.mcp_servers_count, '平台预装子集', 'network'],
    ['平台级 Skill', stats.skills_count, '平台预装子集', 'zap'],
    ['资源索引', state.assets.length, 'portal assets', 'rocket'],
  ];

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>总览</h1>
            <p class="fig-page__description">从统一 control-plane 管理所有 OEM 应用、Skill、MCP 与菜单绑定</p>
          </div>
          <button class="solid-button fig-button" type="button" data-action="navigate" data-page="brands">
            ${icon('plus', 'button-icon')}
            创建新品牌
          </button>
        </div>
      </div>
      <div class="fig-page__body">
        ${renderPageGuide('总览页怎么看', [
          '这里看全局运营面：品牌数、技能数、MCP 数、最近发布和最近编辑。',
          '要新建一个 OEM 应用，先点右上角“创建新品牌”。',
          '要排查最近谁改了什么，直接看“最近编辑”或进审计日志。',
        ], 'overview')}
        <section class="fig-stats-grid">
          ${statCards
            .map(
              ([label, value, note, iconName]) => `
                <article class="fig-stat-card">
                  <div class="fig-stat-card__label">${escapeHtml(label)}</div>
                  <div class="fig-stat-card__value">${escapeHtml(value ?? 0)}</div>
                  <div class="fig-stat-card__note">
                    ${icon(iconName, 'fig-inline-icon')}
                    ${escapeHtml(note)}
                  </div>
                </article>
              `,
            )
            .join('')}
        </section>
        <section class="fig-two-column">
          <article class="fig-card">
            <div class="fig-card__head">
              <h3>${icon('rocket', 'fig-inline-icon')}最近发布</h3>
            </div>
            <div class="fig-list">
        ${
          releases.length
            ? releases
                .map(
                  (item) => `
                    <div class="fig-list-item">
                      <div>
                        <div class="fig-list-item__title">${escapeHtml(item.display_name)}</div>
                        <div class="fig-list-item__meta">
                          <span>${escapeHtml(`v${item.version}`)}</span>
                          <span>•</span>
                          <span>${icon('clock', 'fig-inline-icon')} ${escapeHtml(formatRelative(item.published_at))}</span>
                        </div>
                      </div>
                      ${statusBadge('published')}
                    </div>
                  `,
                )
                .join('')
            : `<div class="empty-state">当前没有发布记录。</div>`
        }
            </div>
            <div class="fig-card__footer">
              <button class="text-button" type="button" data-action="navigate" data-page="releases">查看所有发布</button>
            </div>
          </article>
          <article class="fig-card">
            <div class="fig-card__head">
              <h3>${icon('activity', 'fig-inline-icon')}最近编辑</h3>
            </div>
            <div class="fig-list">
              ${edits.length
                ? edits
                    .map(
                      (item) => `
                        <div class="fig-list-item">
                          <div>
                            <div class="fig-list-item__title">${escapeHtml(item.display_name)}</div>
                            <div class="fig-list-item__body">${escapeHtml(actionLabel(item.action))}</div>
                            <div class="fig-list-item__meta">
                              <span>${escapeHtml(item.actor_name || item.actor_username || 'system')}</span>
                              <span>•</span>
                              <span>${escapeHtml(formatRelative(item.created_at))}</span>
                            </div>
                          </div>
                        </div>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">当前没有编辑记录。</div>`}
            </div>
            <div class="fig-card__footer">
              <button class="text-button" type="button" data-action="navigate" data-page="audit-log">查看审计日志</button>
            </div>
          </article>
        </section>
      </div>
    </div>
  `;
}

function getFilteredBrands() {
  const query = state.filters.brandQuery.trim().toLowerCase();
  return state.brands.filter((brand) => {
    if (state.filters.brandStatus !== 'all' && brand.status !== state.filters.brandStatus) {
      return false;
    }
    if (!query) return true;
    return [brand.brandId, brand.displayName, brand.productName, brand.tenantKey].some((item) =>
      String(item || '').toLowerCase().includes(query),
    );
  });
}

function renderBrandsPage() {
  const brands = getFilteredBrands();

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner fig-page__header-inner--stack">
          <div class="fig-page__header-row">
            <div>
              <h1>品牌管理</h1>
              <p class="fig-page__description">管理 OEM 应用配置、Skill 绑定、MCP 绑定和菜单显隐</p>
            </div>
            <button class="solid-button fig-button" type="button" data-action="toggle-create-brand">
              ${icon('plus', 'button-icon')}
              创建品牌
            </button>
          </div>
          <div class="fig-toolbar">
            <label class="fig-search">
              ${icon('search', 'fig-search__icon')}
              <input
                class="field-input fig-search__input"
                data-filter-key="brandQuery"
                placeholder="搜索品牌..."
                value="${fieldValue(state.filters.brandQuery)}"
              />
            </label>
            <select class="field-select fig-filter" data-filter-key="brandStatus">
              ${['all', 'active', 'disabled']
                .map(
                  (item) => `
                    <option value="${item}"${state.filters.brandStatus === item ? ' selected' : ''}>
                      ${item === 'all' ? '所有状态' : statusLabel(item)}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="fig-page__body">
        ${renderPageGuide('品牌管理怎么用', [
          '一个品牌就是一个 OEM app，这里负责创建、搜索和进入每个品牌的配置空间。',
          '进入品牌详情后，分别维护 shell 区域、能力绑定、业务模块、资源和主题。',
          '改完先保存配置，再发布快照；不发布，客户端不会切到新配置。',
        ], 'brands')}
        ${
          state.showCreateBrandForm
            ? `
              <section class="fig-card fig-create-panel">
                <div class="fig-card__head">
                  <h3>创建新品牌</h3>
                  <button class="text-button" type="button" data-action="toggle-create-brand">收起</button>
                </div>
                <form class="form-grid form-grid--two" id="create-brand-form">
                  <label class="field">
                    <span>App Name</span>
                    <input class="field-input" name="brand_id" placeholder="brand-id" />
                  </label>
                  <label class="field">
                    <span>显示名称</span>
                    <input class="field-input" name="display_name" placeholder="品牌显示名称" />
                  </label>
                  <label class="field">
                    <span>产品名称</span>
                    <input class="field-input" name="product_name" placeholder="品牌产品名称" />
                  </label>
                  <label class="field">
                    <span>Tenant Key</span>
                    <input class="field-input" name="tenant_key" placeholder="tenant-key" />
                  </label>
                  <div class="fig-form-actions">
                    <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>创建品牌</button>
                  </div>
                </form>
              </section>
            `
            : ''
        }
        <section class="fig-brand-grid">
          ${brands.length
            ? brands.map(renderBrandCard).join('')
            : `<div class="empty-state empty-state--panel">没有匹配的品牌。</div>`}
        </section>
      </div>
    </div>
  `;
}

function renderBrandCard(brand) {
  const metrics = metricsFromBrand(brand);
  return `
    <button class="fig-brand-card" type="button" data-action="select-brand" data-brand-id="${escapeHtml(brand.brandId)}">
      <div class="fig-brand-card__head">
        <div>
          <h3>${escapeHtml(brand.displayName)}</h3>
          <p>${escapeHtml(brand.productName)}</p>
        </div>
        ${statusBadge(brand.status)}
      </div>
      <div class="fig-brand-card__meta">
        <div><span>租户密钥:</span><code>${escapeHtml(brand.tenantKey)}</code></div>
        <div><span>App:</span><code>${escapeHtml(brand.brandId)}</code></div>
      </div>
      <div class="fig-brand-card__footer">
        <span>${escapeHtml(metrics.surfaces)} 个 Surface / ${escapeHtml(metrics.skills)} 个 Skill / ${escapeHtml(metrics.mcpServers)} 个 MCP</span>
        <span>${escapeHtml(formatRelative(brand.updatedAt))}</span>
      </div>
    </button>
  `;
}

function getBrandSurfaceDraft(buffer, key) {
  return (
    asArray(buffer?.surfaces).find((item) => item.key === key) || {
      key,
      label: surfaceLabel(key),
      enabled: true,
      json: '{}',
    }
  );
}

function renderBrandDesktopAssembly(buffer) {
  const desktop = normalizeDesktopShellConfig(buffer.desktopShell);
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>桌面端</h2>
        <p>维护桌面端壳层真正生效的基础品牌字段，包括窗口标题、侧栏标题和打包标识。</p>
      </div>
      <div class="fig-capability-columns">
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>展示文案</h3>
            <span>这些字段会进桌面端 brand profile，不再通过 JSON 手填。</span>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>Website Title</span>
              <input class="field-input" name="desktop_website_title" value="${fieldValue(desktop.websiteTitle)}" />
            </label>
            <label class="field">
              <span>Dev Website Title</span>
              <input class="field-input" name="desktop_dev_website_title" value="${fieldValue(desktop.devWebsiteTitle)}" />
            </label>
            <label class="field">
              <span>Sidebar Title</span>
              <input class="field-input" name="desktop_sidebar_title" value="${fieldValue(desktop.sidebarTitle)}" />
            </label>
            <label class="field">
              <span>Dev Sidebar Title</span>
              <input class="field-input" name="desktop_dev_sidebar_title" value="${fieldValue(desktop.devSidebarTitle)}" />
            </label>
            <label class="field field--wide">
              <span>Sidebar Subtitle</span>
              <input class="field-input" name="desktop_sidebar_subtitle" value="${fieldValue(desktop.sidebarSubtitle)}" />
            </label>
          </div>
        </article>
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>打包 / 登录标识</h3>
            <span>用于桌面端协议、服务名和协议文案等运行时标识。</span>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>Legal Name</span>
              <input class="field-input" name="desktop_legal_name" value="${fieldValue(desktop.legalName)}" />
            </label>
            <label class="field">
              <span>Bundle Identifier</span>
              <input class="field-input" name="desktop_bundle_identifier" value="${fieldValue(desktop.bundleIdentifier)}" />
            </label>
            <label class="field field--wide">
              <span>Auth Service</span>
              <input class="field-input" name="desktop_auth_service" value="${fieldValue(desktop.authService)}" />
            </label>
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderBrandHomeWebAssembly(buffer) {
  const homeWeb = normalizeHomeWebSurfaceConfig({website: buffer.homeWeb});
  const enabled = buffer.homeWeb?.enabled !== false;
  const presetPicker = renderPresetPicker({
    presets: HOME_WEB_SURFACE_PRESETS,
    action: 'apply-home-web-assembly-preset',
  });
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>Home页</h2>
        <p>按内容区块维护官网 / Home 页文案，保存后仍然写回 <code>surfaces["home-web"].config.website</code>。</p>
      </div>
      ${presetPicker}
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>显示开关</h3>
          <span>关闭后保留配置，但不让这一层 Home surface 生效。</span>
        </div>
        <label class="toggle fig-toggle">
          <input type="checkbox" name="home_web_enabled"${enabled ? ' checked' : ''} />
          <span>${visibilityStateLabel(enabled)}</span>
        </label>
      </article>
      <div class="fig-capability-columns">
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>品牌与 Hero</h3>
            <span>控制顶部按钮、品牌名和 Hero 主文案。</span>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>Brand Label</span>
              <input class="field-input" name="home_web_brand_label" value="${fieldValue(homeWeb.brandLabel)}" />
            </label>
            <label class="field">
              <span>Kicker</span>
              <input class="field-input" name="home_web_kicker" value="${fieldValue(homeWeb.kicker)}" />
            </label>
            <label class="field">
              <span>Hero Title Pre</span>
              <input class="field-input" name="home_web_hero_title_pre" value="${fieldValue(homeWeb.heroTitlePre)}" />
            </label>
            <label class="field">
              <span>Hero Title Main</span>
              <input class="field-input" name="home_web_hero_title_main" value="${fieldValue(homeWeb.heroTitleMain)}" />
            </label>
            <label class="field">
              <span>Top CTA Label</span>
              <input class="field-input" name="home_web_top_cta_label" value="${fieldValue(homeWeb.topCtaLabel)}" />
            </label>
            <label class="field">
              <span>Scroll Label</span>
              <input class="field-input" name="home_web_scroll_label" value="${fieldValue(homeWeb.scrollLabel)}" />
            </label>
          </div>
        </article>
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>SEO 与下载区</h3>
            <span>控制浏览器标题、描述和下载区域标题。</span>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>Home Title</span>
              <input class="field-input" name="home_web_home_title" value="${fieldValue(homeWeb.homeTitle)}" />
            </label>
            <label class="field">
              <span>Download Title</span>
              <input class="field-input" name="home_web_download_title" value="${fieldValue(homeWeb.downloadTitle)}" />
            </label>
            <label class="field field--wide">
              <span>Meta Description</span>
              <textarea class="field-textarea" name="home_web_meta_description" rows="4">${fieldValue(homeWeb.metaDescription)}</textarea>
            </label>
            <label class="field field--wide">
              <span>Hero Description</span>
              <textarea class="field-textarea" name="home_web_hero_description" rows="4">${fieldValue(homeWeb.heroDescription)}</textarea>
            </label>
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderBrandSidebarAssembly(buffer) {
  const sidebar = normalizeSidebarSurfaceConfig(buffer.sidebar);
  const enabled = buffer.sidebar?.enabled !== false;
  const presetPicker = renderPresetPicker({
    presets: SIDEBAR_SURFACE_PRESETS,
    action: 'apply-sidebar-assembly-preset',
  });
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>侧边栏</h2>
        <p>维护侧边栏容器本身的品牌块和布局风格。菜单显隐与排序继续在「左菜单栏」里做。</p>
      </div>
      ${presetPicker}
      <div class="fig-capability-columns">
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>显示与品牌块</h3>
            <span>控制侧边栏是否生效，以及品牌标题、副标题。</span>
          </div>
          <div class="form-grid">
            <label class="toggle fig-toggle field field--wide">
              <input type="checkbox" name="sidebar_enabled"${enabled ? ' checked' : ''} />
              <span>${visibilityStateLabel(enabled)}</span>
            </label>
            <label class="field">
              <span>Variant</span>
              <input class="field-input" name="sidebar_variant" value="${fieldValue(sidebar.variant)}" />
            </label>
            <label class="field">
              <span>Brand Title</span>
              <input class="field-input" name="sidebar_brand_title" value="${fieldValue(sidebar.brandTitle)}" />
            </label>
            <label class="field field--wide">
              <span>Brand Subtitle</span>
              <input class="field-input" name="sidebar_brand_subtitle" value="${fieldValue(sidebar.brandSubtitle)}" />
            </label>
          </div>
        </article>
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>布局风格</h3>
            <span>保留轻量布局字段，避免再手填一整段 sidebar JSON。</span>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>Section Style</span>
              <input class="field-input" name="sidebar_section_style" value="${fieldValue(sidebar.sectionStyle)}" placeholder="soft-card / dense / service" />
            </label>
            <label class="toggle fig-toggle field">
              <input type="checkbox" name="sidebar_emphasize_active_item"${sidebar.emphasizeActiveItem ? ' checked' : ''} />
              <span>高亮当前激活菜单</span>
            </label>
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderBrandModuleSurfaceInline(buffer, surfaceKey) {
  const surface = getBrandSurfaceDraft(buffer, surfaceKey);
  const blueprint = getSurfaceBlueprint(surfaceKey);
  if (!blueprint || blueprint.kind !== 'module') {
    return '';
  }
  let metadata = {};
  try {
    metadata = JSON.parse(String(surface.json || '{}'));
  } catch {}
  return `
    <article class="surface-editor fig-surface-card" data-surface-key="${escapeHtml(surface.key)}" data-surface-label="${escapeHtml(surface.label)}">
      <div class="fig-surface-card__preview">
        ${icon(blueprint.icon || 'layout', 'fig-surface-card__preview-icon')}
      </div>
      <div class="fig-surface-card__body">
        <div class="surface-editor__head fig-surface-card__head">
          <div>
            <h3>${escapeHtml(`${surface.label} 页面配置`)}</h3>
            <p>${escapeHtml(visibilityStateLabel(surface.enabled))}</p>
          </div>
          <label class="toggle fig-toggle">
            <input type="checkbox" name="surface_enabled__${escapeHtml(surface.key)}"${surface.enabled ? ' checked' : ''} />
            <span>${visibilityStateLabel(surface.enabled)}</span>
          </label>
        </div>
        <div class="fig-card__section-copy">
          <p>这里维护这个左菜单对应业务页的 surface 配置。入口和页面不再拆成两排 tab，统一在同一个菜单详情里编辑。</p>
        </div>
        ${renderMetadataEntriesEditor({
          name: `surface_config__${surface.key}`,
          title: `${surface.label} 页面字段`,
          description: '填写该模块页面需要的轻量字段；键支持点路径。',
          value: metadata,
        })}
      </div>
    </article>
  `;
}

function renderBrandSkillsAssembly(buffer) {
  const skills = [...state.brandSkillCatalog];
  const meta = state.brandSkillCatalogMeta || {};
  const installedCount = ensureEffectiveSkillSelection(buffer.selectedSkills).length;
  const managedCount = getPlatformManagedSkillSlugs().length;
  const oemInstalledCount = ensureEffectiveSkillSelection(buffer.selectedSkills).filter((skillSlug) => !isPlatformManagedSkillSlug(skillSlug)).length;
  const pageStart = skills.length ? Number(meta.offset || 0) + 1 : 0;
  const pageEnd = skills.length ? Number(meta.offset || 0) + skills.length : 0;
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>技能</h2>
        <p>这里是 OEM 级增量预装层。页面读取云技能全集，但平台预装子集会自动继承并锁定，OEM 只负责额外加装自己的那部分。</p>
      </div>
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>OEM Skill 装配</h3>
          <span>平台预装自动继承，当前页面只做 OEM 增量安装</span>
        </div>
        <div class="fig-toolbar">
          <label class="fig-search fig-search--grow">
            ${icon('search', 'fig-search__icon')}
            <input
              class="field-input fig-search__input"
              data-brand-skill-query
              placeholder="搜索 cloud skill slug、名称、分类、发布者..."
              value="${fieldValue(meta.query || '')}"
            />
          </label>
          <button class="ghost-button" type="button" data-action="brand-skill-search"${meta.loading ? ' disabled' : ''}>搜索</button>
          <button class="ghost-button" type="button" data-action="brand-skill-clear-search"${meta.loading ? ' disabled' : ''}>清空</button>
          <button class="ghost-button" type="button" data-action="brand-skill-prev-page"${meta.loading || Number(meta.offset || 0) <= 0 ? ' disabled' : ''}>上一页</button>
          <button class="ghost-button" type="button" data-action="brand-skill-next-page"${meta.loading || !meta.hasMore ? ' disabled' : ''}>下一页</button>
        </div>
        <div class="fig-meta-cards">
          <div class="fig-meta-card"><span>云技能总数</span><strong>${escapeHtml(meta.total || 0)}</strong></div>
          <div class="fig-meta-card"><span>生效总数</span><strong>${escapeHtml(installedCount)}</strong></div>
          <div class="fig-meta-card"><span>OEM 增量</span><strong>${escapeHtml(oemInstalledCount)}</strong></div>
          <div class="fig-meta-card"><span>平台继承</span><strong>${escapeHtml(managedCount)}</strong></div>
          <div class="fig-meta-card"><span>当前页</span><strong>${escapeHtml(pageStart && pageEnd ? `${pageStart}-${pageEnd}` : '0')}</strong></div>
        </div>
        <div class="fig-capability-stack">
          ${meta.loading
            ? `<div class="empty-state">正在加载技能目录...</div>`
            : skills.length
            ? skills
                .map(
                  (skill) => {
                    const platformManaged = isPlatformManagedSkillSlug(skill.slug);
                    const installed = ensureEffectiveSkillSelection(buffer.selectedSkills).includes(skill.slug);
                    return `
                    <article class="checkbox-card checkbox-card--capability fig-capability-item${platformManaged ? ' is-platform-managed' : ''}">
                      <input class="skill-checkbox visually-hidden" type="checkbox" value="${escapeHtml(skill.slug)}"${installed ? ' checked' : ''} />
                      <div class="fig-capability-item__body">
                        <strong>${escapeHtml(skill.name)}</strong>
                        <span>${escapeHtml(skill.category || '未分类')} · ${escapeHtml(skill.publisher || 'iClaw')}</span>
                        ${platformManaged ? '<div class="metric-chips"><span>平台预装</span><span>OEM 不可修改</span></div>' : ''}
                      </div>
                      ${renderSwitch({
                        checked: installed,
                        action: 'toggle-brand-skill',
                        attrs: `data-skill-slug="${escapeHtml(skill.slug)}"`,
                        label: platformManaged ? '平台继承' : installStateLabel(installed),
                        disabled: platformManaged,
                      })}
                    </article>
                  `;
                  },
                )
                .join('')
            : `<div class="empty-state">没有匹配的技能。</div>`}
        </div>
      </article>
    </section>
  `;
}

function renderBrandMcpAssembly(buffer) {
  const mcpServers = [...state.cloudMcpCatalog]
    .map((item) => {
      const key = String(item.key || item.mcpKey || '').trim();
      const config = asObject(item.config);
      const env = asObject(config.env);
      return {
        key,
        name: item.name || titleizeKey(key),
        description: item.description || '',
        transport: item.transport || 'config',
        envKeys: Object.keys(env),
      };
    })
    .filter((item) => item.key)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
  const effectiveSelectedMcp = ensureEffectiveMcpSelection(buffer.selectedMcp);
  const platformManagedCount = getPlatformManagedMcpKeys().length;
  const oemInstalledCount = effectiveSelectedMcp.filter((mcpKey) => !isPlatformManagedMcpKey(mcpKey)).length;
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>MCP</h2>
        <p>这里是 OEM 级 MCP 增量装配层。平台级 MCP 自动继承并锁定，当前页面只负责从云MCP总库里给这个 OEM 追加能力。</p>
      </div>
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>OEM MCP 装配</h3>
          <span>平台级 MCP 自动继承，当前页面只做 OEM 增量安装</span>
        </div>
        <div class="fig-meta-cards">
          <div class="fig-meta-card"><span>云MCP总库</span><strong>${escapeHtml(mcpServers.length)}</strong></div>
          <div class="fig-meta-card"><span>生效总数</span><strong>${escapeHtml(effectiveSelectedMcp.length)}</strong></div>
          <div class="fig-meta-card"><span>OEM 增量</span><strong>${escapeHtml(oemInstalledCount)}</strong></div>
          <div class="fig-meta-card"><span>平台继承</span><strong>${escapeHtml(platformManagedCount)}</strong></div>
        </div>
        <div class="fig-capability-stack">
          ${mcpServers.length
            ? mcpServers
                .map(
                  (server) => {
                    const platformManaged = isPlatformManagedMcpKey(server.key);
                    const installed = effectiveSelectedMcp.includes(server.key);
                    return `
                    <article class="checkbox-card checkbox-card--capability fig-capability-item${platformManaged ? ' is-platform-managed' : ''}">
                      <input class="mcp-checkbox visually-hidden" type="checkbox" value="${escapeHtml(server.key)}"${installed ? ' checked' : ''} />
                      <div>
                        <strong>${escapeHtml(server.name)}</strong>
                        <span>${escapeHtml(server.transport || 'config')} · ${escapeHtml(server.envKeys.length)} 个环境变量</span>
                        ${platformManaged ? '<div class="metric-chips"><span>平台级 MCP</span><span>OEM 不可修改</span></div>' : ''}
                      </div>
                      ${renderSwitch({
                        checked: installed,
                        action: 'toggle-brand-mcp',
                        attrs: `data-mcp-key="${escapeHtml(server.key)}"`,
                        label: platformManaged ? '平台继承' : installStateLabel(installed),
                        disabled: platformManaged,
                      })}
                    </article>
                  `;
                  },
                )
                .join('')
            : `<div class="empty-state">当前没有 MCP 目录。</div>`}
        </div>
      </article>
    </section>
  `;
}

function renderBrandRechargeAssembly(buffer) {
  const packages = buildOrderedRechargePackageList(buffer.rechargePackageOrder)
    .map((packageId) => getRechargePackageCatalogEntry(packageId))
    .filter(Boolean);
  const selectedPackages = asStringArray(buffer.selectedRechargePackages);
  const recommendedPackages = asStringArray(buffer.recommendedRechargePackages).filter((packageId) => selectedPackages.includes(packageId));
  const defaultPackage = selectedPackages.includes(buffer.defaultRechargePackage)
    ? buffer.defaultRechargePackage
    : recommendedPackages[0] || selectedPackages[0] || '';
  const defaultPackageEntry = getRechargePackageCatalogEntry(defaultPackage);
  const platformDefaultPackageEntry =
    getRechargePackageCatalogItems().find((item) => item.active !== false && item.default) ||
    getRechargePackageCatalogItems().find((item) => item.active !== false && item.recommended) ||
    getRechargePackageCatalogItems().find((item) => item.active !== false) ||
    null;
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>充值套餐</h2>
        <p>默认走平台级套餐目录；只有当前 OEM 保存了绑定，运行时才切到 OEM 自己的套餐集合。</p>
      </div>
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <div>
            <h3>OEM 套餐覆盖</h3>
            <span>${buffer.useRechargePackagesOverride ? '当前已切到 OEM 专属套餐' : '当前跟随平台默认套餐'}</span>
          </div>
          ${renderSwitch({
            checked: buffer.useRechargePackagesOverride === true,
            action: 'toggle-brand-recharge-override',
            label: buffer.useRechargePackagesOverride ? '使用 OEM 套餐' : '跟随平台',
          })}
        </div>
        <div class="fig-meta-cards">
          <div class="fig-meta-card"><span>平台套餐数</span><strong>${escapeHtml(getRechargePackageCatalogItems().length)}</strong></div>
          <div class="fig-meta-card"><span>当前模式</span><strong>${escapeHtml(buffer.useRechargePackagesOverride ? 'OEM 覆盖' : '平台默认')}</strong></div>
          <div class="fig-meta-card"><span>生效套餐数</span><strong>${escapeHtml(selectedPackages.length)}</strong></div>
          <div class="fig-meta-card"><span>默认套餐</span><strong>${escapeHtml((buffer.useRechargePackagesOverride ? defaultPackageEntry : platformDefaultPackageEntry)?.packageName || '未设置')}</strong></div>
        </div>
        <label class="toggle fig-toggle" style="display:none;">
          <input type="checkbox" name="recharge_use_override"${buffer.useRechargePackagesOverride ? ' checked' : ''} />
          <span>${buffer.useRechargePackagesOverride ? '使用 OEM 套餐' : '跟随平台'}</span>
        </label>
        <div class="fig-card__section-copy">
          <p>${buffer.useRechargePackagesOverride ? '你现在维护的是这个 OEM 自己的套餐集合。未勾选的套餐不会下发到该 OEM。' : '当前只是预览平台套餐。若要做 OEM 定制，打开上面的开关后再勾选和排序。'}</p>
        </div>
        <div class="fig-capability-stack">
          ${packages.length
            ? packages
                .map((item, index) => {
                  const enabled = selectedPackages.includes(item.packageId);
                  const editable = buffer.useRechargePackagesOverride === true;
                  const disabled = !editable;
                  return `
                    <article class="checkbox-card checkbox-card--capability fig-capability-item${editable ? '' : ' is-platform-managed'}">
                      <div class="fig-capability-item__body">
                        <div>
                          <strong>${escapeHtml(item.packageName)}</strong>
                          <span>${escapeHtml(`${formatFen(item.amountCnyFen)} · 实得 ${formatCredits(item.credits + item.bonusCredits)}`)}</span>
                          <div class="metric-chips">
                            <span>${escapeHtml(item.badgeLabel || (item.active !== false ? '平台套餐' : '已下架'))}</span>
                            ${item.recommended ? '<span>平台超值推荐</span>' : ''}
                            ${item.default ? '<span>平台默认</span>' : ''}
                          </div>
                        </div>
                        <p>${escapeHtml(item.description || '未配置描述')}</p>
                        ${item.featureList.length ? `<span>${escapeHtml(item.featureList.join(' / '))}</span>` : ''}
                        <div class="fig-menu-card__grid">
                          <label class="toggle fig-toggle">
                            <input type="checkbox" name="recharge_enabled__${escapeHtml(item.packageId)}"${enabled ? ' checked' : ''}${disabled ? ' disabled' : ''} />
                            <span>${enabled ? '已加入 OEM 套餐' : '未加入 OEM 套餐'}</span>
                          </label>
                          <label class="toggle fig-toggle">
                            <input type="checkbox" name="recharge_recommended__${escapeHtml(item.packageId)}"${recommendedPackages.includes(item.packageId) ? ' checked' : ''}${!editable || !enabled ? ' disabled' : ''} />
                            <span>设为超值推荐</span>
                          </label>
                          <label class="toggle fig-toggle">
                            <input type="radio" name="recharge_default_package" value="${escapeHtml(item.packageId)}"${defaultPackage === item.packageId ? ' checked' : ''}${!editable || !enabled ? ' disabled' : ''} />
                            <span>设为默认套餐</span>
                          </label>
                        </div>
                      </div>
                      <div class="fig-list-item__actions">
                        ${renderSwitch({
                          checked: enabled,
                          action: 'toggle-brand-recharge-package',
                          attrs: `data-package-id="${escapeHtml(item.packageId)}"`,
                          label: editable ? (enabled ? '已启用' : '未启用') : '平台预览',
                          disabled,
                        })}
                        <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-recharge-package-up" data-package-id="${escapeHtml(item.packageId)}"${!editable || index <= 0 ? ' disabled' : ''}>
                          ${icon('chevronUp', 'fig-inline-icon')}
                        </button>
                        <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-recharge-package-down" data-package-id="${escapeHtml(item.packageId)}"${!editable || index >= packages.length - 1 ? ' disabled' : ''}>
                          ${icon('chevronDown', 'fig-inline-icon')}
                        </button>
                      </div>
                    </article>
                  `;
                })
                .join('')
            : `<div class="empty-state">平台侧还没有充值套餐，请先去“支付中心 / 充值套餐”建立平台主数据。</div>`}
        </div>
      </article>
    </section>
  `;
}

function renderBrandModelAssembly(buffer) {
  const models = getMergedModelCatalog();
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>模型</h2>
        <p>当前 OEM 应用的模型 allowlist、默认模型和推荐模型都在这里单独配置。</p>
      </div>
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>模型 Allowlist</h3>
          <span>按 OEM 应用控制输入框可见模型、推荐模型和默认模型</span>
        </div>
        <div class="form-grid">
          <label class="field">
            <span>默认模型</span>
            <select class="field-select" name="default_model">
              <option value="">请选择默认模型</option>
              ${buffer.selectedModels
                .map((ref) => {
                  const model = getModelCatalogEntry(ref);
                  const label = model?.label || ref;
                  return `<option value="${escapeHtml(ref)}"${buffer.defaultModel === ref ? ' selected' : ''}>${escapeHtml(label)}</option>`;
                })
                .join('')}
            </select>
          </label>
        </div>
        <div class="fig-capability-stack">
          ${models.length
            ? models
                .map(
                  (model) => `
                    <article class="checkbox-card checkbox-card--capability fig-capability-item">
                      <input class="model-checkbox visually-hidden" type="checkbox" value="${escapeHtml(model.ref)}"${buffer.selectedModels.includes(model.ref) ? ' checked' : ''} />
                      <div>
                        <strong>${escapeHtml(model.label)}</strong>
                        <span>${escapeHtml(model.providerId)} · ${escapeHtml(model.modelId)} · ${escapeHtml(`${normalizeBillingMultiplierValue(model.billingMultiplier, 1)}x`)}</span>
                      </div>
                      <div class="metric-chips">
                        ${renderSwitch({
                          checked: buffer.recommendedModels.includes(model.ref),
                          action: 'toggle-brand-model-recommended',
                          attrs: `data-model-ref="${escapeHtml(model.ref)}"${buffer.selectedModels.includes(model.ref) ? '' : ' disabled'}`,
                          label: '推荐',
                        })}
                        ${renderSwitch({
                          checked: buffer.selectedModels.includes(model.ref),
                          action: 'toggle-brand-model',
                          attrs: `data-model-ref="${escapeHtml(model.ref)}"`,
                          label: buffer.selectedModels.includes(model.ref) ? '已启用' : '已禁用',
                        })}
                      </div>
                    </article>
                  `,
                )
                .join('')
            : `<div class="empty-state">当前没有模型目录。</div>`}
        </div>
      </article>
    </section>
  `;
}

function getOrderedMenuItemsByCategory(buffer, category) {
  const order = buildManageableMenuOrder(buffer.menuOrder);
  return order
    .map((key) => getMenuDefinition(key))
    .filter((item) => item && item.category === category);
}

function getSelectedBrandMenuKey(buffer, items) {
  const available = asArray(items).filter(Boolean);
  if (!available.length) return '';
  const current = String(state.selectedBrandMenuKey || '').trim();
  if (current && available.some((item) => item.key === current)) {
    return current;
  }
  return available[0].key;
}

function renderMenuAssemblyListCard(buffer, item, note, isActive = false) {
  const enabled = buffer.selectedMenus.includes(item.key);
  const editorOrder = buildManageableMenuOrder(buffer.menuOrder);
  const index = editorOrder.indexOf(item.key);
  const menuConfig = normalizeMenuDraftConfig(asObject(asObject(buffer.menuConfigs)[item.key]));
  const displayName = menuConfig.displayName || item.label;
  const group = menuConfig.group || '主体区';
  const effectiveIconKey = menuConfig.iconKey || item.iconKey || item.key;
  return `
    <button
      class="menu-assembly-card${isActive ? ' is-active' : ''}"
      type="button"
      draggable="true"
      data-action="select-brand-menu"
      data-menu-key="${escapeHtml(item.key)}"
      aria-label="${escapeHtml(`拖动排序或编辑 ${displayName}`)}"
    >
      <span class="menu-assembly-card__icon">${renderIconPreview(effectiveIconKey, 'menu-assembly-card__svg')}</span>
      <span class="menu-assembly-card__body">
        <span class="menu-assembly-card__title-row">
          <strong>${escapeHtml(displayName)}</strong>
          <span class="menu-assembly-card__order">#${index + 1}</span>
        </span>
        <span class="menu-assembly-card__meta">${escapeHtml(`Menu ID: ${item.key}${note ? ` · ${note}` : ''}`)}</span>
        <span class="menu-assembly-card__submeta">${escapeHtml(group)} · ${escapeHtml(visibilityStateLabel(enabled))}</span>
      </span>
      <span class="menu-assembly-card__drag" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </span>
    </button>
  `;
}

function renderMenuAssemblyDetail(buffer, item, note) {
  if (!item) {
    return `
      <article class="fig-card fig-card--subtle menu-assembly-detail menu-assembly-detail--empty">
        <div class="empty-state">当前没有可配置的菜单入口。</div>
      </article>
    `;
  }
  const enabled = buffer.selectedMenus.includes(item.key);
  const editorOrder = buildManageableMenuOrder(buffer.menuOrder);
  const index = editorOrder.indexOf(item.key);
  const menuConfig = normalizeMenuDraftConfig(asObject(asObject(buffer.menuConfigs)[item.key]));
  const skillOptions = getMergedSkills();
  const mcpOptions = getMergedMcpServers();
  const modelOptions = getMergedModelCatalog();
  const iconOptions = getMenuIconOptions();
  const displayName = menuConfig.displayName || item.label;
  const group = menuConfig.group || '主体区';
  const effectiveIconKey = menuConfig.iconKey || item.iconKey || item.key;
  const moduleSurface = renderBrandModuleSurfaceInline(buffer, item.key);
  const requirementSummary = [
    menuConfig.requiresSkillSlug ? `Skill: ${skillOptions.find((skill) => skill.slug === menuConfig.requiresSkillSlug)?.name || menuConfig.requiresSkillSlug}` : '',
    menuConfig.requiresMcpKey ? `MCP: ${mcpOptions.find((server) => server.key === menuConfig.requiresMcpKey)?.name || menuConfig.requiresMcpKey}` : '',
    menuConfig.requiresModelRef ? `模型: ${modelOptions.find((model) => model.ref === menuConfig.requiresModelRef)?.label || menuConfig.requiresModelRef}` : '',
  ].filter(Boolean);
  return `
    <article class="fig-card fig-card--subtle menu-assembly-detail">
      <div class="fig-card__head">
        <div>
          <h3>${escapeHtml(displayName)}</h3>
          <span>${escapeHtml(`Menu ID: ${item.key}${note ? ` · ${note}` : ''}`)}</span>
        </div>
        <div class="fig-capability-actions fig-menu-detail__actions">
          <span class="chip">排序 ${index + 1}</span>
          <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-menu-up" data-menu-key="${escapeHtml(item.key)}"${index <= 0 ? ' disabled' : ''}>
            ${icon('chevronUp', 'button-icon')}
          </button>
          <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-menu-down" data-menu-key="${escapeHtml(item.key)}"${index < 0 || index >= editorOrder.length - 1 ? ' disabled' : ''}>
            ${icon('chevronDown', 'button-icon')}
          </button>
          ${renderSwitch({
            checked: enabled,
            action: 'toggle-brand-menu',
            attrs: `data-menu-key="${escapeHtml(item.key)}"`,
            label: visibilityStateLabel(enabled),
          })}
        </div>
      </div>
      <div class="menu-assembly-preview">
        <div class="menu-assembly-preview__icon">${renderIconPreview(effectiveIconKey, 'menu-assembly-preview__svg')}</div>
        <div class="menu-assembly-preview__body">
          <div class="menu-assembly-preview__eyebrow">${escapeHtml(group)}</div>
          <div class="menu-assembly-preview__title">${escapeHtml(displayName)}</div>
          <div class="menu-assembly-preview__meta">${escapeHtml(requirementSummary.length ? requirementSummary.join(' · ') : '无依赖约束，直接展示给 OEM 用户。')}</div>
        </div>
      </div>
      <div class="fig-menu-card__grid fig-menu-card__grid--detail">
        <label class="field fig-inline-field">
          <span>显示名称</span>
          <input
            class="field-input"
            name="menu_display_name__${escapeHtml(item.key)}"
            value="${fieldValue(menuConfig.displayName)}"
            placeholder="${escapeHtml(item.label)}"
          />
        </label>
        <label class="field fig-inline-field">
          <span>分组</span>
          <input
            class="field-input"
            name="menu_group__${escapeHtml(item.key)}"
            value="${fieldValue(menuConfig.group)}"
            placeholder="主体区"
          />
        </label>
        <label class="field fig-inline-field">
          <span>图标</span>
          ${renderIconSelector(`menu_icon__${item.key}`, menuConfig.iconKey, iconOptions, '从图标目录中选择')}
        </label>
        <label class="field fig-inline-field">
          <span>依赖 Skill</span>
          <select class="field-select" name="menu_requires_skill__${escapeHtml(item.key)}">
            <option value="">无</option>
            ${skillOptions
              .map(
                (skill) =>
                  `<option value="${escapeHtml(skill.slug)}"${menuConfig.requiresSkillSlug === skill.slug ? ' selected' : ''}>${escapeHtml(skill.name)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="field fig-inline-field">
          <span>依赖 MCP</span>
          <select class="field-select" name="menu_requires_mcp__${escapeHtml(item.key)}">
            <option value="">无</option>
            ${mcpOptions
              .map(
                (server) =>
                  `<option value="${escapeHtml(server.key)}"${menuConfig.requiresMcpKey === server.key ? ' selected' : ''}>${escapeHtml(server.name)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="field fig-inline-field">
          <span>依赖模型</span>
          <select class="field-select" name="menu_requires_model__${escapeHtml(item.key)}">
            <option value="">无</option>
            ${modelOptions
              .map(
                (model) =>
                  `<option value="${escapeHtml(model.ref)}"${menuConfig.requiresModelRef === model.ref ? ' selected' : ''}>${escapeHtml(model.label)}</option>`,
              )
              .join('')}
          </select>
        </label>
      </div>
      ${moduleSurface}
    </article>
  `;
}

function renderMenuToggleCard(buffer, item, note) {
  const enabled = buffer.selectedMenus.includes(item.key);
  const editorOrder = buildManageableMenuOrder(buffer.menuOrder);
  const index = editorOrder.indexOf(item.key);
  const menuConfig = normalizeMenuDraftConfig(asObject(asObject(buffer.menuConfigs)[item.key]));
  const skillOptions = getMergedSkills();
  const mcpOptions = getMergedMcpServers();
  const modelOptions = getMergedModelCatalog();
  return `
    <article class="checkbox-card checkbox-card--capability fig-capability-item">
      <input class="menu-checkbox visually-hidden" type="checkbox" value="${escapeHtml(item.key)}"${enabled ? ' checked' : ''} />
      <div class="fig-capability-item__body">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(`Menu ID: ${item.key}${note ? ` · ${note}` : ''}`)}</span>
        </div>
        <div class="fig-menu-card__grid">
          <label class="field fig-inline-field">
            <span>显示名称</span>
            <input
              class="field-input"
              name="menu_display_name__${escapeHtml(item.key)}"
              value="${fieldValue(menuConfig.displayName)}"
              placeholder="${escapeHtml(item.label)}"
            />
          </label>
          <label class="field fig-inline-field">
            <span>分组</span>
            <input
              class="field-input"
              name="menu_group__${escapeHtml(item.key)}"
              value="${fieldValue(menuConfig.group)}"
              placeholder="主体区"
            />
          </label>
          <label class="field fig-inline-field">
            <span>图标</span>
            ${renderIconChoiceGroup(`menu_icon__${item.key}`, menuConfig.iconKey, getMenuIconOptions())}
          </label>
          <label class="field fig-inline-field">
            <span>依赖 Skill</span>
            <select class="field-select" name="menu_requires_skill__${escapeHtml(item.key)}">
              <option value="">无</option>
              ${skillOptions
                .map(
                  (skill) =>
                    `<option value="${escapeHtml(skill.slug)}"${menuConfig.requiresSkillSlug === skill.slug ? ' selected' : ''}>${escapeHtml(skill.name)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="field fig-inline-field">
            <span>依赖 MCP</span>
            <select class="field-select" name="menu_requires_mcp__${escapeHtml(item.key)}">
              <option value="">无</option>
              ${mcpOptions
                .map(
                  (server) =>
                    `<option value="${escapeHtml(server.key)}"${menuConfig.requiresMcpKey === server.key ? ' selected' : ''}>${escapeHtml(server.name)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="field fig-inline-field">
            <span>依赖模型</span>
            <select class="field-select" name="menu_requires_model__${escapeHtml(item.key)}">
              <option value="">无</option>
              ${modelOptions
                .map(
                  (model) =>
                    `<option value="${escapeHtml(model.ref)}"${menuConfig.requiresModelRef === model.ref ? ' selected' : ''}>${escapeHtml(model.label)}</option>`,
                )
                .join('')}
            </select>
          </label>
        </div>
      </div>
      <div class="fig-capability-actions fig-menu-card__actions">
        <span class="chip">排序 ${index + 1}</span>
        <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-menu-up" data-menu-key="${escapeHtml(item.key)}"${index <= 0 ? ' disabled' : ''}>
          ${icon('chevronUp', 'button-icon')}
        </button>
        <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-menu-down" data-menu-key="${escapeHtml(item.key)}"${index < 0 || index >= editorOrder.length - 1 ? ' disabled' : ''}>
          ${icon('chevronDown', 'button-icon')}
        </button>
        ${renderSwitch({
          checked: enabled,
          action: 'toggle-brand-menu',
          attrs: `data-menu-key="${escapeHtml(item.key)}"`,
          label: visibilityStateLabel(enabled),
        })}
      </div>
    </article>
  `;
}

function renderBrandMenusAssembly(buffer, preferredMenuKey = '') {
  const sidebarItems = getOrderedMenuItemsByCategory(buffer, 'sidebar');
  const preferred = String(preferredMenuKey || '').trim();
  const selectedMenuKey =
    preferred && sidebarItems.some((item) => item.key === preferred)
      ? preferred
      : getSelectedBrandMenuKey(buffer, sidebarItems);
  const selectedItem = sidebarItems.find((item) => item.key === selectedMenuKey) || sidebarItems[0] || null;
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>左菜单栏</h2>
        <p>这里就是 OEM 左菜单的唯一配置入口。左侧管显隐和排序，右侧同时维护入口配置和对应业务页的 surface，不再拆成独立“业务模块”tab。</p>
      </div>
      <div class="fig-capability-columns">
        <article class="fig-card fig-card--subtle menu-assembly-list">
          <div class="fig-card__head">
            <h3>OEM 菜单入口</h3>
            <span>左侧选一个真实菜单，右侧直接编辑入口和页面配置。</span>
          </div>
          <div class="menu-assembly-list__stack">
            ${sidebarItems.map((item) => renderMenuAssemblyListCard(buffer, item, '主导航', item.key === selectedMenuKey)).join('')}
          </div>
        </article>
        ${renderMenuAssemblyDetail(buffer, selectedItem, '主导航')}
      </div>
    </section>
  `;
}

function renderComposerControlCard(buffer, item, index, total) {
  const enabled = asStringArray(buffer.selectedComposerControls).includes(item.controlKey);
  const config = normalizeComposerControlDraftConfig(asObject(asObject(buffer.composerControlConfigs)[item.controlKey]));
  const allowedValueMap = new Map(item.options.map((option) => [option.optionValue, option]));
  const allowedLabel = config.allowedOptionValues
    .map((value) => allowedValueMap.get(value)?.label || value)
    .join('、');
  return `
    <article
      class="fig-capability-card fig-menu-card sortable-card"
      draggable="true"
      data-sortable-kind="composer-control"
      data-sortable-key="${escapeHtml(item.controlKey)}"
    >
      <div class="fig-capability-main">
        <div class="fig-capability-copy">
          <div class="fig-capability-title-row">
            <h3>${escapeHtml(item.displayName)}</h3>
            <span class="chip">${escapeHtml(item.controlType)}</span>
          </div>
          <p>${escapeHtml(item.controlKey)}</p>
        </div>
        <div class="fig-capability-meta">
          <label class="field fig-inline-field">
            <span>显示名称</span>
            <input class="field-input" name="composer_control_display_name__${escapeHtml(item.controlKey)}" value="${fieldValue(config.displayName)}" placeholder="${escapeHtml(item.displayName)}" />
          </label>
          ${
            item.options.length
              ? `
                <label class="field fig-inline-field">
                  <span>允许选项</span>
                  <input class="field-input" name="composer_control_allowed_options__${escapeHtml(item.controlKey)}" value="${fieldValue(config.allowedOptionValues.join(', '))}" placeholder="${escapeHtml(item.options.map((option) => option.optionValue).join(', '))}" />
                </label>
                <div class="fig-capability-inline-note">当前：${escapeHtml(allowedLabel || '全部可选')}</div>
              `
              : `<div class="fig-capability-inline-note">动态控件，不做静态选项过滤。</div>`
          }
        </div>
      </div>
      <div class="fig-capability-actions fig-menu-card__actions">
        <span class="sortable-card__drag" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </span>
        <span class="chip">排序 ${index + 1}</span>
        <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-composer-control-up" data-control-key="${escapeHtml(item.controlKey)}"${index <= 0 ? ' disabled' : ''}>
          ${icon('chevronUp', 'button-icon')}
        </button>
        <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-composer-control-down" data-control-key="${escapeHtml(item.controlKey)}"${index >= total - 1 ? ' disabled' : ''}>
          ${icon('chevronDown', 'button-icon')}
        </button>
        ${renderSwitch({
          checked: enabled,
          action: 'toggle-brand-composer-control',
          attrs: `data-control-key="${escapeHtml(item.controlKey)}"`,
          label: visibilityStateLabel(enabled),
        })}
      </div>
    </article>
  `;
}

function renderComposerShortcutCard(buffer, item, index, total) {
  const enabled = asStringArray(buffer.selectedComposerShortcuts).includes(item.shortcutKey);
  const config = normalizeComposerShortcutDraftConfig(asObject(asObject(buffer.composerShortcutConfigs)[item.shortcutKey]));
  return `
    <article
      class="fig-capability-card fig-menu-card sortable-card"
      draggable="true"
      data-sortable-kind="composer-shortcut"
      data-sortable-key="${escapeHtml(item.shortcutKey)}"
    >
      <div class="fig-capability-main">
        <div class="fig-capability-copy">
          <div class="fig-capability-title-row">
            <h3>${escapeHtml(item.displayName)}</h3>
            <span class="chip">${escapeHtml(item.tone || 'default')}</span>
          </div>
          <p>${escapeHtml(item.shortcutKey)}</p>
        </div>
        <div class="fig-capability-meta">
          <label class="field fig-inline-field">
            <span>显示名称</span>
            <input class="field-input" name="composer_shortcut_display_name__${escapeHtml(item.shortcutKey)}" value="${fieldValue(config.displayName)}" placeholder="${escapeHtml(item.displayName)}" />
          </label>
          <label class="field fig-inline-field">
            <span>说明</span>
            <input class="field-input" name="composer_shortcut_description__${escapeHtml(item.shortcutKey)}" value="${fieldValue(config.description)}" placeholder="${escapeHtml(item.description)}" />
          </label>
          <label class="field field--wide">
            <span>快捷模板</span>
            <textarea class="field-textarea" name="composer_shortcut_template__${escapeHtml(item.shortcutKey)}">${escapeHtml(config.template || item.template)}</textarea>
          </label>
        </div>
      </div>
      <div class="fig-capability-actions fig-menu-card__actions">
        <span class="sortable-card__drag" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </span>
        <span class="chip">排序 ${index + 1}</span>
        <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-composer-shortcut-up" data-shortcut-key="${escapeHtml(item.shortcutKey)}"${index <= 0 ? ' disabled' : ''}>
          ${icon('chevronUp', 'button-icon')}
        </button>
        <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-composer-shortcut-down" data-shortcut-key="${escapeHtml(item.shortcutKey)}"${index >= total - 1 ? ' disabled' : ''}>
          ${icon('chevronDown', 'button-icon')}
        </button>
        ${renderSwitch({
          checked: enabled,
          action: 'toggle-brand-composer-shortcut',
          attrs: `data-shortcut-key="${escapeHtml(item.shortcutKey)}"`,
          label: visibilityStateLabel(enabled),
        })}
      </div>
    </article>
  `;
}

function renderBrandInputAssembly(buffer) {
  const surface = getBrandSurfaceDraft(buffer, 'input');
  let rawConfig = {};
  try {
    rawConfig = JSON.parse(String(surface.json || '{}'));
  } catch {}
  const inputConfig = normalizeInputSurfaceConfig(rawConfig);
  const enabled = surface.enabled !== false;
  const controls = buildOrderedComposerControlList(buffer.composerControlOrder)
    .map((controlKey) => getComposerControlDefinition(controlKey))
    .filter(Boolean);
  const shortcuts = buildOrderedComposerShortcutList(buffer.composerShortcutOrder)
    .map((shortcutKey) => getComposerShortcutDefinition(shortcutKey))
    .filter(Boolean);
  const presetPicker = renderPresetPicker({
    presets: INPUT_ASSEMBLY_PRESETS,
    action: 'apply-input-assembly-preset',
  });
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>输入框</h2>
        <p>第一栏维护顶部快捷选择控件，第二栏维护输入提示文案，第三栏维护底部快捷方式；全部走平台目录 + OEM 绑定。</p>
      </div>
      ${presetPicker}
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>第二栏输入区</h3>
          <span>控制输入框 placeholder 文案，发送前的空状态提示走这里。</span>
        </div>
        <div class="form-grid">
          <label class="toggle fig-toggle field field--wide">
            <input type="checkbox" name="input_enabled"${enabled ? ' checked' : ''} />
            <span>${visibilityStateLabel(enabled)}</span>
          </label>
          <label class="field field--wide">
            <span>Placeholder</span>
            <textarea class="field-textarea" name="input_placeholder_text" rows="3">${fieldValue(inputConfig.placeholderText)}</textarea>
          </label>
        </div>
      </article>
      <div class="fig-capability-columns">
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>第一栏快捷选择框</h3>
            <span>控制专家、技能、模式、市场、自选股、输出等顶栏控件的显隐、排序与显示文案</span>
          </div>
          <div class="fig-capability-stack">
            ${controls.length ? controls.map((item, index) => renderComposerControlCard(buffer, item, index, controls.length)).join('') : `<div class="empty-state">还没有输入控件目录。</div>`}
          </div>
        </article>
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>第三栏快捷方式</h3>
            <span>控制底部快捷 chip 的显隐、排序、名称和模板内容</span>
          </div>
          <div class="fig-capability-stack">
            ${shortcuts.length ? shortcuts.map((item, index) => renderComposerShortcutCard(buffer, item, index, shortcuts.length)).join('') : `<div class="empty-state">还没有快捷方式目录。</div>`}
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderBrandHeaderAssembly(buffer) {
  const surface = getBrandSurfaceDraft(buffer, 'header');
  let rawConfig = {};
  try {
    rawConfig = JSON.parse(String(surface.json || '{}'));
  } catch {}
  const header = normalizeHeaderSurfaceConfig(rawConfig);
  const enabled = surface.enabled !== false;
  const presetPicker = renderPresetPicker({
    presets: HEADER_SURFACE_PRESETS,
    action: 'apply-header-assembly-preset',
  });
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>Header栏</h2>
        <p>按组件配置顶部状态、行情、头条和按钮文案，保存后仍然写回 <code>surfaces.header.config</code>，但不再需要手写 JSON。</p>
      </div>
      ${presetPicker}
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>显示开关</h3>
          <span>控制顶部栏整体及各个区块的显示状态。</span>
        </div>
        <div class="fig-menu-card__grid">
          <label class="toggle fig-toggle">
            <input type="checkbox" name="header_enabled"${enabled ? ' checked' : ''} />
            <span>Header栏${enabled ? '已启用' : '已禁用'}</span>
          </label>
          <label class="toggle fig-toggle">
            <input type="checkbox" name="header_show_live_badge"${header.showLiveBadge ? ' checked' : ''} />
            <span>显示实时状态</span>
          </label>
          <label class="toggle fig-toggle">
            <input type="checkbox" name="header_show_quotes"${header.showQuotes ? ' checked' : ''} />
            <span>显示行情卡片</span>
          </label>
          <label class="toggle fig-toggle">
            <input type="checkbox" name="header_show_headlines"${header.showHeadlines ? ' checked' : ''} />
            <span>显示头条区域</span>
          </label>
          <label class="toggle fig-toggle">
            <input type="checkbox" name="header_show_security_badge"${header.showSecurityBadge ? ' checked' : ''} />
            <span>显示安全标签</span>
          </label>
          <label class="toggle fig-toggle">
            <input type="checkbox" name="header_show_credits"${header.showCredits ? ' checked' : ''} />
            <span>显示积分额度</span>
          </label>
          <label class="toggle fig-toggle">
            <input type="checkbox" name="header_show_recharge_button"${header.showRechargeButton ? ' checked' : ''} />
            <span>显示充值按钮</span>
          </label>
          <label class="toggle fig-toggle">
            <input type="checkbox" name="header_show_mode_badge"${header.showModeBadge ? ' checked' : ''} />
            <span>显示模式标签</span>
          </label>
        </div>
      </article>
      <div class="fig-capability-columns">
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>基础文案</h3>
            <span>控制左上状态、按钮和辅助标签的文案。</span>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>状态标题</span>
              <input class="field-input" name="header_status_label" value="${fieldValue(header.statusLabel)}" />
            </label>
            <label class="field">
              <span>实时状态文案</span>
              <input class="field-input" name="header_live_status_label" value="${fieldValue(header.liveStatusLabel)}" />
            </label>
            <label class="field">
              <span>安全标签文案</span>
              <input class="field-input" name="header_security_label" value="${fieldValue(header.securityLabel)}" />
            </label>
            <label class="field">
              <span>充值按钮文案</span>
              <input class="field-input" name="header_recharge_label" value="${fieldValue(header.rechargeLabel)}" />
            </label>
            <label class="field">
              <span>模式标签文案</span>
              <input class="field-input" name="header_mode_badge_label" value="${fieldValue(header.modeBadgeLabel)}" />
            </label>
          </div>
        </article>
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>行情卡片</h3>
            <span>最多 4 个行情位，未接实时数据时会回退到这里。</span>
          </div>
          <div class="fig-capability-stack">
            ${header.fallbackQuotes
              .map(
                (item, index) => `
                  <article class="checkbox-card checkbox-card--capability fig-capability-item">
                    <div class="fig-capability-item__body">
                      <div>
                        <strong>行情卡 ${index + 1}</strong>
                        <span>配置名称、数值和涨跌幅。</span>
                      </div>
                      <div class="fig-menu-card__grid">
                        <label class="field fig-inline-field">
                          <span>名称</span>
                          <input class="field-input" name="header_quote_label__${index}" value="${fieldValue(item.label)}" />
                        </label>
                        <label class="field fig-inline-field">
                          <span>数值</span>
                          <input class="field-input" name="header_quote_value__${index}" value="${fieldValue(item.value)}" />
                        </label>
                        <label class="field fig-inline-field">
                          <span>涨跌数值</span>
                          <input class="field-input" name="header_quote_change__${index}" type="number" step="0.01" value="${fieldValue(item.change)}" />
                        </label>
                        <label class="field fig-inline-field">
                          <span>涨跌文案</span>
                          <input class="field-input" name="header_quote_change_percent__${index}" value="${fieldValue(item.changePercent)}" placeholder="+0.86%" />
                        </label>
                      </div>
                    </div>
                  </article>
                `,
              )
              .join('')}
          </div>
        </article>
      </div>
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>头条区域</h3>
          <span>最多 3 条头条，支持标题、来源和跳转链接。</span>
        </div>
        <div class="fig-capability-stack">
          ${header.fallbackHeadlines
            .map(
              (item, index) => `
                <article class="checkbox-card checkbox-card--capability fig-capability-item">
                  <div class="fig-capability-item__body">
                    <div>
                      <strong>头条 ${index + 1}</strong>
                      <span>配置标题、来源和链接。</span>
                    </div>
                    <div class="fig-menu-card__grid">
                      <label class="field" style="grid-column: 1 / -1;">
                        <span>标题</span>
                        <input class="field-input" name="header_headline_title__${index}" value="${fieldValue(item.title)}" />
                      </label>
                      <label class="field fig-inline-field">
                        <span>来源</span>
                        <input class="field-input" name="header_headline_source__${index}" value="${fieldValue(item.source)}" />
                      </label>
                      <label class="field fig-inline-field">
                        <span>链接</span>
                        <input class="field-input" name="header_headline_href__${index}" value="${fieldValue(item.href)}" placeholder="https://..." />
                      </label>
                    </div>
                  </div>
                </article>
              `,
            )
            .join('')}
        </div>
      </article>
    </section>
  `;
}

function renderBrandWelcomeAssembly(buffer) {
  const welcome = normalizeWelcomeSurfaceConfig(buffer.welcome);
  const enabled = buffer.welcome?.enabled !== false;
  const presetPicker = renderPresetPicker({
    presets: WELCOME_ASSEMBLY_PRESETS,
    action: 'apply-welcome-assembly-preset',
  });
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>Welcome页</h2>
        <p>维护聊天空状态里的 K2C 欢迎内容，服务对象是 KOL 的粉丝，输入框仍复用现有聊天输入区。</p>
      </div>
      ${presetPicker}
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>显示开关</h3>
          <span>关闭后，空会话时不展示 Welcome 内容卡片。</span>
        </div>
        <label class="toggle fig-toggle">
          <input type="checkbox" name="welcome_enabled"${enabled ? ' checked' : ''} />
          <span>${visibilityStateLabel(enabled)}</span>
        </label>
      </article>
      <div class="fig-capability-columns">
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>KOL 信息</h3>
            <span>配置头像、欢迎语和主视觉颜色。</span>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>入口标题</span>
              <input class="field-input" name="welcome_entry_label" value="${fieldValue(welcome.entryLabel)}" />
            </label>
            <label class="field">
              <span>KOL 名称</span>
              <input class="field-input" name="welcome_kol_name" value="${fieldValue(welcome.kolName)}" />
            </label>
            <label class="field">
              <span>专家名称</span>
              <input class="field-input" name="welcome_expert_name" value="${fieldValue(welcome.expertName)}" />
            </label>
            <label class="field">
              <span>Slogan</span>
              <input class="field-input" name="welcome_slogan" value="${fieldValue(welcome.slogan)}" />
            </label>
            <label class="field">
              <span>头像 URL</span>
              <input class="field-input" name="welcome_avatar_url" value="${fieldValue(welcome.avatarUrl)}" />
            </label>
            <label class="field">
              <span>背景图 URL</span>
              <input class="field-input" name="welcome_background_image_url" value="${fieldValue(welcome.backgroundImageUrl)}" />
            </label>
            <label class="field">
              <span>主色</span>
              <input class="field-input" name="welcome_primary_color" value="${fieldValue(welcome.primaryColor)}" placeholder="#C4975F" />
            </label>
          </div>
        </article>
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>内容文案</h3>
            <span>配置擅长领域、适配人群与免责声明。</span>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>描述文案</span>
              <textarea class="field-textarea" name="welcome_description" rows="4">${fieldValue(welcome.description)}</textarea>
            </label>
            <label class="field">
              <span>擅长领域</span>
              <textarea class="field-textarea" name="welcome_expertise_areas" rows="4" placeholder="每行一个领域">${fieldValue(welcome.expertiseAreas.join('\n'))}</textarea>
            </label>
            <label class="field">
              <span>目标人群</span>
              <textarea class="field-textarea" name="welcome_target_audience" rows="4">${fieldValue(welcome.targetAudience)}</textarea>
            </label>
            <label class="field">
              <span>免责声明</span>
              <textarea class="field-textarea" name="welcome_disclaimer" rows="4">${fieldValue(welcome.disclaimer)}</textarea>
            </label>
          </div>
        </article>
      </div>
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>快捷问题</h3>
          <span>点击后只填充 prompt，不会自动发送。</span>
        </div>
        <div class="fig-capability-stack">
          ${welcome.quickActions
            .map(
              (item, index) => `
                <article class="checkbox-card checkbox-card--capability fig-capability-item">
                  <div class="fig-capability-item__body">
                    <div>
                      <strong>快捷问题 ${index + 1}</strong>
                      <span>配置卡片标题、图标和 prompt 内容。</span>
                    </div>
                    <div class="fig-menu-card__grid">
                      <label class="field fig-inline-field">
                        <span>标题</span>
                        <input class="field-input" name="welcome_quick_action_label__${index}" value="${fieldValue(item.label)}" />
                      </label>
                      <label class="field fig-inline-field">
                        <span>图标</span>
                        ${renderIconChoiceGroup(`welcome_quick_action_icon__${index}`, item.iconKey, WELCOME_ACTION_ICON_OPTIONS)}
                      </label>
                      <label class="field" style="grid-column: 1 / -1;">
                        <span>Prompt</span>
                        <textarea class="field-textarea" name="welcome_quick_action_prompt__${index}" rows="3">${fieldValue(item.prompt)}</textarea>
                      </label>
                    </div>
                  </div>
                </article>
              `,
            )
            .join('')}
        </div>
      </article>
    </section>
  `;
}

function renderBrandAuthAssembly(buffer) {
  const authExperience = normalizeAuthExperienceConfig(buffer.authExperience, {
    brandId: buffer.brandId,
    displayName: buffer.displayName,
    legalName: buffer.desktopShell?.legalName,
  });
  const legalName = String(buffer.desktopShell?.legalName || buffer.displayName || buffer.brandId || '').trim() || '当前品牌';
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>登录与协议</h2>
        <p>维护桌面端登录 / 注册弹窗里的说明文案、第三方登录提示，以及用户可点击查看的 OEM 协议正文。</p>
      </div>
      <div class="fig-capability-columns">
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>弹窗文案</h3>
            <span>这些字段会直接展示在登录框内。</span>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>弹窗标题</span>
              <input class="field-input" name="auth_panel_title" value="${fieldValue(authExperience.title)}" />
            </label>
            <label class="field field--wide">
              <span>副标题</span>
              <textarea class="field-textarea" name="auth_panel_subtitle" rows="4">${fieldValue(authExperience.subtitle)}</textarea>
            </label>
            <label class="field field--wide">
              <span>第三方登录提示</span>
              <textarea class="field-textarea" name="auth_social_notice" rows="3">${fieldValue(authExperience.socialNotice)}</textarea>
            </label>
            <label class="field field--wide">
              <span>法律主体</span>
              <input class="field-input" value="${fieldValue(legalName)}" readonly />
            </label>
          </div>
        </article>
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>注册勾选区</h3>
            <span>勾选区会自动展示下面三份协议的标题，并支持用户点击查看正文。</span>
          </div>
          <div class="fig-list">
            ${authExperience.agreements
              .map(
                (item) => `
                  <div class="fig-list-item">
                    <div>
                      <div class="fig-list-item__title">${escapeHtml(item.title)}</div>
                      <div class="fig-list-item__body">${escapeHtml(item.summary || AUTH_AGREEMENT_LABELS[item.key] || '')}</div>
                      <div class="fig-list-item__meta">
                        <span>${escapeHtml(item.version || '未设置版本')}</span>
                        <span>•</span>
                        <span>${escapeHtml(item.effectiveDate || '未设置生效时间')}</span>
                      </div>
                    </div>
                    <span class="chip">${escapeHtml(AUTH_AGREEMENT_LABELS[item.key] || item.key)}</span>
                  </div>
                `,
              )
              .join('')}
          </div>
        </article>
      </div>
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>协议正文</h3>
          <span>默认已针对 iClaw / 理财Claw 预填一版，可按 OEM 继续改成更贴近业务与法务要求的版本。</span>
        </div>
        <div class="fig-capability-stack">
          ${authExperience.agreements
            .map(
              (item) => `
                <article class="checkbox-card checkbox-card--capability fig-capability-item">
                  <div class="fig-capability-item__body">
                    <div>
                      <strong>${escapeHtml(AUTH_AGREEMENT_LABELS[item.key] || item.key)}</strong>
                      <span>${escapeHtml(item.summary || '维护标题、版本、摘要与正文。')}</span>
                    </div>
                    <div class="fig-menu-card__grid">
                      <label class="field fig-inline-field">
                        <span>标题</span>
                        <input class="field-input" name="auth_agreement_title__${escapeHtml(item.key)}" value="${fieldValue(item.title)}" />
                      </label>
                      <label class="field fig-inline-field">
                        <span>版本号</span>
                        <input class="field-input" name="auth_agreement_version__${escapeHtml(item.key)}" value="${fieldValue(item.version)}" placeholder="v2026.04" />
                      </label>
                      <label class="field fig-inline-field">
                        <span>生效日期</span>
                        <input class="field-input" name="auth_agreement_effective_date__${escapeHtml(item.key)}" value="${fieldValue(item.effectiveDate)}" placeholder="2026-04-04" />
                      </label>
                      <label class="field" style="grid-column: 1 / -1;">
                        <span>摘要</span>
                        <textarea class="field-textarea" name="auth_agreement_summary__${escapeHtml(item.key)}" rows="3">${fieldValue(item.summary)}</textarea>
                      </label>
                      <label class="field" style="grid-column: 1 / -1;">
                        <span>正文</span>
                        <textarea class="field-textarea" name="auth_agreement_content__${escapeHtml(item.key)}" rows="12">${fieldValue(item.content)}</textarea>
                      </label>
                    </div>
                  </div>
                </article>
              `,
            )
            .join('')}
        </div>
      </article>
    </section>
  `;
}

function renderBrandModuleAssembly(buffer, surfaceKey) {
  const blueprint = getSurfaceBlueprint(surfaceKey);
  const menuItem = getMenuDefinition(blueprint?.menuKey) || null;
  const enabled = menuItem ? buffer.selectedMenus.includes(menuItem.key) : true;
  const surface = getBrandSurfaceDraft(buffer, surfaceKey);
  let metadata = {};
  try {
    metadata = JSON.parse(String(surface.json || '{}'));
  } catch {}
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>${escapeHtml(blueprint?.label || surfaceLabel(surfaceKey))}</h2>
        <p>单独维护这个业务模块的入口开关和模块 surface 配置，满足不同 OEM 的积木化装配需求。</p>
      </div>
      <div class="fig-capability-columns">
        ${
          menuItem
            ? `
              <article class="fig-card fig-card--subtle">
                <div class="fig-card__head">
                  <h3>模块入口</h3>
                  <span>控制该模块是否在左侧菜单中可见</span>
                </div>
                <div class="fig-capability-stack">
                  ${renderMenuToggleCard(buffer, menuItem, '业务模块入口')}
                </div>
                <div class="fig-card__footer">
                  <span>${enabled ? '当前模块入口已显示在 OEM 菜单中。' : '当前模块入口已隐藏，不会在 OEM 菜单中显示。'}</span>
                </div>
              </article>
            `
            : ''
        }
        <article class="surface-editor fig-surface-card" data-surface-key="${escapeHtml(surface.key)}" data-surface-label="${escapeHtml(surface.label)}">
          <div class="fig-surface-card__preview">
            ${icon(blueprint?.icon || 'layout', 'fig-surface-card__preview-icon')}
          </div>
          <div class="fig-surface-card__body">
            <div class="surface-editor__head fig-surface-card__head">
              <div>
                <h3>${escapeHtml(surface.label)} Surface</h3>
                <p>${visibilityStateLabel(surface.enabled)}</p>
              </div>
              <label class="toggle fig-toggle">
                <input type="checkbox" name="surface_enabled__${escapeHtml(surface.key)}"${surface.enabled ? ' checked' : ''} />
                <span>${visibilityStateLabel(surface.enabled)}</span>
              </label>
            </div>
            ${renderMetadataEntriesEditor({
              name: `surface_config__${surface.key}`,
              title: `${surface.label} 页面字段`,
              description: '模块配置改为键值编辑，不再直接输入原始 JSON。',
              value: metadata,
            })}
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderBrandDetailPage() {
  if (!state.brandDetail?.brand) {
    return `
      <div class="fig-page">
        <div class="fig-page__header">
          <div class="fig-page__header-inner">
            <div>
              <h1>品牌详情</h1>
              <p class="fig-page__description">选择品牌后查看真实配置、资源和发布轨迹</p>
            </div>
          </div>
        </div>
        <div class="fig-page__body">
          <div class="empty-state empty-state--panel">当前没有可查看的品牌。</div>
        </div>
      </div>
    `;
  }

  const brand = state.brandDetail.brand;
  const buffer = ensureBrandDraftBuffer();
  const assets = state.brandDetail.assets || [];
  const versions = state.brandDetail.versions || [];
  const audit = state.brandDetail.audit || [];
  const rawActiveTab = String(state.brandDetailTab || '').trim();
  const activeTab = getBrandDetailTabConfig(rawActiveTab)?.id || 'desktop';
  const activeGroup = getBrandDetailTabGroup(activeTab);
  const app = state.brandDetail.app || null;
  const metrics = metricsFromBrand(brand);
  const rollbackTarget = versions[0]?.version || '';

  return `
    <div class="fig-brand-detail">
      <div class="fig-brand-detail__header">
        <div class="fig-brand-detail__header-inner">
          <div class="fig-brand-detail__header-main">
            <button class="fig-icon-button" type="button" data-action="navigate" data-page="brands" aria-label="返回品牌列表">
              ${icon('arrowLeft', 'fig-icon-button__icon')}
            </button>
            <div class="fig-brand-detail__title-wrap">
              <div class="fig-brand-detail__title-row">
                <h1>${escapeHtml(brand.displayName)}</h1>
                ${statusBadge(brand.status)}
              </div>
              <p class="fig-brand-detail__subtitle">
                ${escapeHtml(brand.productName)} • 租户:
                <code>${escapeHtml(brand.tenantKey)}</code>
              </p>
            </div>
          </div>
          <div class="fig-brand-detail__actions">
            <button class="ghost-button fig-button" type="button" data-action="save-brand-draft"${state.busy ? ' disabled' : ''}>
              ${icon('save', 'button-icon')}
              保存配置
            </button>
            <button class="solid-button fig-button" type="button" data-action="publish-brand"${state.busy ? ' disabled' : ''}>
              ${icon('rocket', 'button-icon')}
              发布快照
            </button>
            <button class="fig-icon-button" type="button" data-action="rollback-brand" data-version="${escapeHtml(rollbackTarget)}"${rollbackTarget ? '' : ' disabled'} aria-label="恢复到最近发布版本">
              ${icon('rotateCcw', 'fig-icon-button__icon')}
            </button>
          </div>
        </div>
        <div class="fig-brand-detail__meta">
          <div>App Name: <code>${escapeHtml(brand.brandId)}</code></div>
          <div>•</div>
          <div>默认语言: ${escapeHtml(app?.defaultLocale || 'zh-CN')}</div>
          <div>•</div>
          <div>当前版本: <code>v${escapeHtml(brand.publishedVersion || 0)}</code></div>
          <div>•</div>
          <div>最后更新: ${escapeHtml(formatDateTime(app?.updatedAt || brand.updatedAt))}</div>
        </div>
      </div>
      <div class="fig-brand-nav">
        <div class="fig-brand-groups">
          ${BRAND_DETAIL_TAB_GROUPS
            .map(
              ({id, label, icon: iconName}) => `
                <button
                  class="fig-brand-group${activeGroup?.id === id ? ' is-active' : ''}"
                  type="button"
                  data-action="brand-tab-group"
                  data-group-id="${id}"
                >
                  ${icon(iconName, 'fig-inline-icon')}
                  ${escapeHtml(label)}
                </button>
              `,
            )
            .join('')}
        </div>
        <div class="fig-brand-tabs">
          ${activeGroup.tabs
            .map((tabId) => getBrandDetailTabConfig(tabId))
            .filter(Boolean)
            .map(
              ({id, label, icon: iconName}) => `
                <button
                  class="fig-brand-tab${activeTab === id ? ' is-active' : ''}"
                  type="button"
                  data-action="brand-tab"
                  data-tab="${id}"
                >
                  ${icon(iconName, 'fig-inline-icon')}
                  ${escapeHtml(label)}
                </button>
              `,
            )
            .join('')}
        </div>
      </div>
      <div class="fig-page__body fig-page__body--brand-detail">
        ${renderBrandDetailGuide(rawActiveTab || activeTab)}
        <form id="brand-editor-form" class="fig-brand-form">
          <input type="hidden" name="brand_id" value="${fieldValue(buffer.brandId)}" />
          <section class="fig-card fig-brand-meta-editor">
            <div class="fig-card__head">
              <h3>品牌信息</h3>
              <span>基础元数据会写入真实草稿配置</span>
            </div>
            <div class="form-grid form-grid--three">
              <label class="field">
                <span>显示名称</span>
                <input class="field-input" name="display_name" value="${fieldValue(buffer.displayName)}" />
              </label>
              <label class="field">
                <span>产品名称</span>
                <input class="field-input" name="product_name" value="${fieldValue(buffer.productName)}" />
              </label>
              <label class="field">
                <span>Tenant Key</span>
                <input class="field-input" name="tenant_key" value="${fieldValue(buffer.tenantKey)}" />
              </label>
              <label class="field">
                <span>应用状态</span>
                <select class="field-select" name="status">
                  ${['active', 'disabled']
                    .map(
                      (item) => `
                        <option value="${item}"${buffer.status === item ? ' selected' : ''}>${escapeHtml(statusLabel(item))}</option>
                      `,
                    )
                    .join('')}
                </select>
              </label>
            </div>
          </section>
          ${renderBrandEditorBody(buffer, assets, rawActiveTab || activeTab)}
        </form>
        <section class="fig-support-grid">
          <article class="fig-card">
            <div class="fig-card__head">
              <h3>版本轨迹</h3>
              <span>portal app 的发布快照</span>
            </div>
            <div class="fig-list">
              ${versions.length
                ? versions
                    .map(
                      (item) => `
                        <div class="fig-list-item fig-list-item--spread">
                          <div>
                            <div class="fig-list-item__title">v${escapeHtml(item.version)}</div>
                            <div class="fig-list-item__meta">
                              <span>${escapeHtml(formatDateTime(item.publishedAt))}</span>
                              <span>•</span>
                              <span>${escapeHtml(item.createdByName || item.createdByUsername || 'system')}</span>
                            </div>
                          </div>
                          <button class="text-button" type="button" data-action="rollback-brand" data-version="${escapeHtml(item.version)}"${state.busy ? ' disabled' : ''}>
                            恢复
                          </button>
                        </div>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">还没有发布快照。</div>`}
            </div>
          </article>
          <article class="fig-card">
            <div class="fig-card__head">
              <h3>最近审计</h3>
              <button class="text-button" type="button" data-action="navigate" data-page="audit-log">全部日志</button>
            </div>
            <div class="fig-list">
              ${audit.length
                ? audit
                    .slice(0, 6)
                    .map(
                      (item) => `
                        <div class="fig-list-item">
                          <div>
                            <div class="fig-list-item__title">${escapeHtml(actionLabel(item.action))}</div>
                            <div class="fig-list-item__meta">
                              <span>${escapeHtml(item.actorName || item.actorUsername || 'system')}</span>
                              <span>•</span>
                              <span>${escapeHtml(formatRelative(item.createdAt))}</span>
                            </div>
                          </div>
                        </div>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">暂无审计记录。</div>`}
            </div>
          </article>
        </section>
      </div>
    </div>
  `;
}

function renderBrandEditorBody(buffer, assets, activeTab = state.brandDetailTab) {
  const normalizedTab = normalizeBrandDetailTab(activeTab);

  if (normalizedTab === 'desktop') {
    return renderBrandDesktopAssembly(buffer);
  }

  if (normalizedTab === 'home-web') {
    return renderBrandHomeWebAssembly(buffer);
  }

  if (normalizedTab === 'welcome') {
    return renderBrandWelcomeAssembly(buffer);
  }

  if (normalizedTab === 'auth') {
    return renderBrandAuthAssembly(buffer);
  }

  if (normalizedTab === 'header') {
    return renderBrandHeaderAssembly(buffer);
  }

  if (normalizedTab === 'sidebar') {
    return renderBrandSidebarAssembly(buffer);
  }

  if (normalizedTab === 'input') {
    return renderBrandInputAssembly(buffer);
  }

  if (normalizedTab === 'skills') {
    return renderBrandSkillsAssembly(buffer);
  }

  if (normalizedTab === 'mcps') {
    return renderBrandMcpAssembly(buffer);
  }

  if (normalizedTab === 'recharge') {
    return renderBrandRechargeAssembly(buffer);
  }

  if (normalizedTab === 'menus') {
    const preferredMenuKey = MODULE_SURFACE_KEYS.includes(String(activeTab || '').trim()) ? String(activeTab || '').trim() : '';
    return renderBrandMenusAssembly(buffer, preferredMenuKey);
  }

  if (normalizedTab === 'assets') {
    const assetSlots = [
      ['logoMaster', 'Logo', 'logo'],
      ['homeLogo', 'Home Logo', 'logo'],
      ['faviconPng', 'Favicon PNG', 'favicon'],
      ['faviconIco', 'Favicon ICO', 'favicon'],
    ];
    return `
      <section class="fig-brand-section">
        <div class="fig-section-heading">
          <h2>品牌资源</h2>
          <p>上传和维护 Logo、Favicon 与其它品牌资源，真实写入 MinIO 和 oem_app_assets。</p>
        </div>
        <div class="fig-assets-layout">
          <article class="fig-card fig-card--subtle">
            <div class="fig-card__head">
              <h3>Logo / Favicon 上传器</h3>
              <span>上传的新图会真正写入 MinIO，并为当前 OEM 应用建立资源索引。</span>
            </div>
            <form id="asset-form" class="stack-form">
              <input type="hidden" name="brand_id" value="${fieldValue(buffer.brandId)}" />
              <div class="asset-slot-grid fig-asset-slot-grid">
                ${assetSlots
                  .map(([assetKey, label, kind]) => {
                    const current = assets.find((item) => item.assetKey === assetKey) || null;
                    return `
                      <article class="fig-asset-slot-card">
                        <div class="asset-slot-card__head">
                          <strong>${escapeHtml(label)}</strong>
                          <small>${escapeHtml(assetKey)}</small>
                        </div>
                        ${
                          current && isImageLike(current.contentType, current.publicUrl, current.objectKey)
                            ? `<img class="asset-thumb asset-thumb--slot" src="${escapeHtml(resolveAssetUrl(current))}" alt="${escapeHtml(assetKey)}" />`
                            : `<div class="asset-thumb asset-thumb--slot asset-thumb--placeholder">No Asset</div>`
                        }
                        <button class="ghost-button control-button" type="button" data-action="fill-asset-preset" data-asset-key="${escapeHtml(assetKey)}" data-asset-kind="${escapeHtml(kind)}">使用此槽位</button>
                      </article>
                    `;
                  })
                  .join('')}
              </div>
              <div class="form-grid form-grid--two">
                <label class="field">
                  <span>Asset Key</span>
                  <input class="field-input" name="asset_key" placeholder="logoMaster / homeLogo / faviconPng" />
                </label>
                <label class="field">
                  <span>资源类型</span>
                  <input class="field-input" name="kind" placeholder="logo / favicon / hero" />
                </label>
                <label class="field field--wide">
                  <span>上传文件</span>
                  <input class="field-input" name="file" type="file" />
                </label>
                <div class="field field--wide">
                  ${renderMetadataEntriesEditor({
                    name: 'metadata_entries',
                    title: '资源 Metadata',
                    description: '可选。按字段路径补充资源附加信息。',
                    value: {},
                  })}
                </div>
              </div>
              <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>上传资源</button>
            </form>
          </article>
          <article class="fig-card fig-card--subtle">
            <div class="fig-card__head">
              <h3>当前品牌资源</h3>
              <span>来自 oem_app_assets 的真实记录</span>
            </div>
            <div class="fig-list">
              ${assets.length
                ? assets
                    .map(
                      (item) => `
                        <div class="fig-list-item fig-list-item--spread">
                          <div>
                            <div class="fig-list-item__title">${escapeHtml(item.assetKey)}</div>
                            <div class="fig-list-item__body">${escapeHtml(item.objectKey || '')}</div>
                            ${
                              isImageLike(item.contentType, item.publicUrl, item.objectKey)
                                ? `<div class="asset-thumb-wrap"><img class="asset-thumb" src="${escapeHtml(resolveAssetUrl(item))}" alt="${escapeHtml(item.assetKey)}" /></div>`
                                : ''
                            }
                          </div>
                          <div class="fig-list-item__actions">
                            <span>${escapeHtml(item.storageProvider || 's3')}</span>
                            <button class="text-button" type="button" data-action="delete-asset" data-brand-id="${escapeHtml(item.brandId)}" data-asset-key="${escapeHtml(item.assetKey)}">删除</button>
                            <small>${escapeHtml(formatDateTime(item.updatedAt))}</small>
                          </div>
                        </div>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">当前品牌还没有登记资源。</div>`}
            </div>
          </article>
        </div>
      </section>
    `;
  }

  if (normalizedTab === 'theme') {
    const draftPreview = composeDraftConfig(buffer);
    return `
      <section class="fig-brand-section">
        <div class="fig-section-heading">
          <h2>主题样式</h2>
          <p>维护 Light / Dark 主题色。底部只展示当前草稿快照，不再要求手写 JSON。</p>
        </div>
        <div class="fig-theme-grid">
          <article class="fig-card fig-card--subtle">
            <div class="fig-card__head">
              <h3>默认主题模式</h3>
              <span>写入 draft_config.theme.defaultMode</span>
            </div>
            <div class="form-grid">
              <label class="field">
                <span>Default Theme</span>
                <select class="field-select" name="theme_default_mode">
                  ${THEME_MODE_OPTIONS.map((option) => `
                    <option value="${escapeHtml(option.value)}"${buffer.theme.defaultMode === option.value ? ' selected' : ''}>${escapeHtml(option.label)}</option>
                  `).join('')}
                </select>
              </label>
            </div>
          </article>
          <article class="fig-card fig-card--subtle">
            <div class="fig-card__head">
            <h3>Light Theme</h3>
            <span>写入 draft_config.theme.light</span>
          </div>
          <div class="form-grid form-grid--two">
            <label class="field">
              <span>Primary</span>
              <input class="field-input" name="theme_light_primary" value="${fieldValue(buffer.theme.lightPrimary)}" />
            </label>
            <label class="field">
              <span>Primary Hover</span>
              <input class="field-input" name="theme_light_primary_hover" value="${fieldValue(buffer.theme.lightPrimaryHover)}" />
            </label>
            <label class="field field--wide">
              <span>On Primary</span>
              <input class="field-input" name="theme_light_on_primary" value="${fieldValue(buffer.theme.lightOnPrimary)}" />
            </label>
          </div>
        </article>
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>Dark Theme</h3>
            <span>写入 draft_config.theme.dark</span>
          </div>
          <div class="form-grid form-grid--two">
            <label class="field">
              <span>Primary</span>
              <input class="field-input" name="theme_dark_primary" value="${fieldValue(buffer.theme.darkPrimary)}" />
            </label>
            <label class="field">
              <span>Primary Hover</span>
              <input class="field-input" name="theme_dark_primary_hover" value="${fieldValue(buffer.theme.darkPrimaryHover)}" />
            </label>
            <label class="field field--wide">
              <span>On Primary</span>
              <input class="field-input" name="theme_dark_on_primary" value="${fieldValue(buffer.theme.darkOnPrimary)}" />
            </label>
          </div>
        </article>
        </div>
        <section class="fig-card">
          <div class="fig-card__head">
            <h3>当前草稿快照</h3>
            <span>只读预览，保存时按上面的结构化字段生成</span>
          </div>
          <label class="field">
            <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(draftPreview))}</textarea>
          </label>
        </section>
      </section>
    `;
  }

  return `
    <section class="fig-card">
      <label class="field">
        <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(composeDraftConfig(buffer)))}</textarea>
      </label>
    </section>
  `;
}

function getFilteredCapabilities() {
  const query = state.filters.capabilityQuery.trim().toLowerCase();
  const skills = getMergedSkills().filter((item) => {
    const skillEnabled = item.active !== false;
    if (state.filters.capabilitySkillStatus === 'active' && !skillEnabled) return false;
    if (state.filters.capabilitySkillStatus === 'disabled' && skillEnabled) return false;
    if (
      state.filters.capabilitySkillCategory !== 'all' &&
      String(item.category || '').trim() !== state.filters.capabilitySkillCategory
    ) {
      return false;
    }
    if (
      state.filters.capabilitySkillBrand !== 'all' &&
      !asArray(item.connectedBrands).some((brand) => brand.brand_id === state.filters.capabilitySkillBrand)
    ) {
      return false;
    }
    if (!query) return true;
    return [item.slug, item.name, item.category, item.publisher].some((value) =>
      String(value || '').toLowerCase().includes(query),
    );
  });
  const mcpServers = getMergedMcpServers().filter((item) => {
    const enabled = item.enabled_by_default !== false;
    if (state.filters.capabilityMcpStatus === 'active' && !enabled) return false;
    if (state.filters.capabilityMcpStatus === 'disabled' && enabled) return false;
    if (
      state.filters.capabilityMcpTransport !== 'all' &&
      String(item.transport || '').trim() !== state.filters.capabilityMcpTransport
    ) {
      return false;
    }
    if (
      state.filters.capabilityMcpBrand !== 'all' &&
      !asArray(item.connected_brands).some((brand) => brand.brand_id === state.filters.capabilityMcpBrand)
    ) {
      return false;
    }
    if (!query) return true;
    return [item.key, item.name, item.command, item.http_url, ...(item.env_keys || [])].some((value) =>
      String(value || '').toLowerCase().includes(query),
    );
  });
  const models = getMergedModelCatalog().filter((item) => {
    const enabled = item.active !== false;
    if (state.filters.capabilityModelStatus === 'active' && !enabled) return false;
    if (state.filters.capabilityModelStatus === 'disabled' && enabled) return false;
    if (
      state.filters.capabilityModelProvider !== 'all' &&
      String(item.providerId || '').trim() !== state.filters.capabilityModelProvider
    ) {
      return false;
    }
    if (
      state.filters.capabilityModelBrand !== 'all' &&
      !asArray(item.connectedBrands).some((brand) => brand.brand_id === state.filters.capabilityModelBrand)
    ) {
      return false;
    }
    if (!query) return true;
    return [item.ref, item.label, item.providerId, item.modelId, ...(item.input || [])].some((value) =>
      String(value || '').toLowerCase().includes(query),
    );
  });
  return {skills, mcpServers, models};
}

function getModelProviderProfilesByScope(scopeType, scopeKey) {
  return (state.modelProviderProfiles || [])
    .filter((item) => item.scopeType === scopeType && item.scopeKey === scopeKey)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
}

function getMemoryEmbeddingProfilesByScope(scopeType, scopeKey) {
  return (state.memoryEmbeddingProfiles || []).filter((item) => item.scopeType === scopeType && item.scopeKey === scopeKey);
}

function getSelectedModelProviderTab() {
  const appNames = (state.brands || []).map((item) => item.brandId);
  if (state.selectedModelProviderTab === 'platform') {
    return 'platform';
  }
  return appNames.includes(state.selectedModelProviderTab) ? state.selectedModelProviderTab : 'platform';
}

function getPaymentProviderProfilesByScope(scopeType, scopeKey, provider = PRIMARY_PAYMENT_PROVIDER) {
  return (state.paymentProviderProfiles || []).filter(
    (item) => item.provider === provider && item.scope_type === scopeType && item.scope_key === scopeKey,
  );
}

function getPaymentProviderBinding(appName, provider = PRIMARY_PAYMENT_PROVIDER) {
  return (state.paymentProviderBindings || []).find((item) => item.provider === provider && item.app_name === appName) || null;
}

function getSelectedPaymentProviderTab() {
  const appNames = (state.brands || []).map((item) => item.brandId);
  if (state.selectedPaymentProviderTab === 'platform') {
    return 'platform';
  }
  return appNames.includes(state.selectedPaymentProviderTab) ? state.selectedPaymentProviderTab : 'platform';
}

function getPaymentGatewayConfigView() {
  const selectedTab = getSelectedPaymentProviderTab();
  const raw =
    selectedTab === 'platform'
      ? state.paymentGatewayConfigs?.platform
      : state.paymentGatewayConfigs?.[selectedTab] || null;
  const value = asObject(raw);
  return {
    provider: String(value.provider || 'epay').trim() || 'epay',
    source: String(value.source || 'unset').trim() || 'unset',
    scope_type: String(value.scope_type || (selectedTab === 'platform' ? 'platform' : 'app')).trim() || 'platform',
    scope_key: String(value.scope_key || (selectedTab === 'platform' ? 'platform' : selectedTab)).trim() || 'platform',
    config: asObject(value.config),
    secret_values: asObject(value.secret_values),
    configured_secret_keys: asStringArray(value.configured_secret_keys),
    completeness_status: String(value.completeness_status || 'missing').trim() || 'missing',
    missing_fields: asStringArray(value.missing_fields),
    updated_at: String(value.updated_at || '').trim() || '',
  };
}

function getPaymentGatewayModeDraftKey(scopeType, scopeKey) {
  return `${scopeType}:${scopeKey}`;
}

function getPaymentGatewayMode(scopeType, scopeKey, source) {
  const draft = state.paymentGatewayModeDrafts?.[getPaymentGatewayModeDraftKey(scopeType, scopeKey)];
  if (draft === 'inherit_platform' || draft === 'use_app_config') {
    return draft;
  }
  if (scopeType === 'app') {
    return source === 'admin' ? 'use_app_config' : 'inherit_platform';
  }
  return 'use_app_config';
}

function getPaymentGatewaySourceLabel(source) {
  if (source === 'admin') {
    return 'admin-web';
  }
  if (source === 'platform_inherited') {
    return '继承平台';
  }
  if (source === 'env_fallback') {
    return 'env fallback';
  }
  return '未配置';
}

function hasAnyPaymentProviderValues(formData) {
  return [...PAYMENT_PROVIDER_CONFIG_FIELDS, ...PAYMENT_PROVIDER_SECRET_FIELDS].some((key) =>
    String(formData.get(key) || '').trim(),
  );
}

function getRechargePaymentMethodOptionLabel(provider, fallbackLabel = '') {
  if (fallbackLabel && String(fallbackLabel).trim()) {
    return String(fallbackLabel).trim();
  }
  return provider === 'wechat_qr' ? '微信支付' : provider === 'alipay_qr' ? '支付宝' : provider;
}

function getRechargePaymentMethodDefaults() {
  return DEFAULT_RECHARGE_PAYMENT_METHODS.map((item) => ({
    provider: item.provider,
    label: item.label,
    enabled: item.enabled !== false,
    default: item.default === true,
    sortOrder: Number(item.sortOrder || 100) || 100,
    metadata: {},
    sourceLayer: 'platform_default',
  }));
}

function getRawRechargePaymentMethodEntries(config) {
  const rechargeConfig = asObject(asObject(asObject(asObject(config).surfaces).recharge).config);
  return Array.isArray(rechargeConfig.payment_methods)
    ? rechargeConfig.payment_methods
    : Array.isArray(rechargeConfig.paymentMethods)
      ? rechargeConfig.paymentMethods
      : null;
}

function hasOemRechargePaymentMethodOverride(detail) {
  if (!detail?.app) {
    return false;
  }
  return Array.isArray(getRawRechargePaymentMethodEntries(getAppConfig(detail.app)));
}

function normalizeRechargePaymentMethodConfig(config) {
  const rawEntries = getRawRechargePaymentMethodEntries(config);
  const sourceLayer = Array.isArray(rawEntries) ? 'oem_binding' : 'platform_default';
  const seen = new Set();
  const sourceEntries = Array.isArray(rawEntries) ? rawEntries : DEFAULT_RECHARGE_PAYMENT_METHODS;
  const items = (sourceEntries.length ? sourceEntries : [])
    .map((item, index) => {
      const entry = asObject(item);
      const provider = String(entry.provider || '').trim().toLowerCase();
      if (!['wechat_qr', 'alipay_qr'].includes(provider) || seen.has(provider)) {
        return null;
      }
      seen.add(provider);
      const metadata = asObject(entry.metadata);
      return {
        provider,
        label: String(entry.label || metadata.label || '').trim() || getRechargePaymentMethodOptionLabel(provider),
        enabled: entry.enabled !== false,
        default: entry.is_default === true || entry.default === true,
        sortOrder: Number(entry.sort_order ?? entry.sortOrder ?? (index + 1) * 10) || (index + 1) * 10,
        metadata,
        sourceLayer,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.provider.localeCompare(right.provider, 'zh-CN'));
  if (!items.length && !Array.isArray(rawEntries)) {
    return getRechargePaymentMethodDefaults();
  }
  const enabledItems = items.filter((item) => item.enabled);
  const defaultProvider = enabledItems.find((item) => item.default)?.provider || enabledItems[0]?.provider || '';
  return items.map((item) => ({
    ...item,
    default: Boolean(item.enabled && item.provider === defaultProvider),
  }));
}

async function saveOemRechargePaymentMethodConfig(appName, input) {
  const normalizedAppName = String(appName || '').trim();
  if (!normalizedAppName) {
    return;
  }
  const detail =
    state.portalAppDetails[normalizedAppName] ||
    (await apiFetch(`/admin/portal/apps/${encodeURIComponent(normalizedAppName)}`, {method: 'GET'}));
  state.portalAppDetails[normalizedAppName] = detail;
  if (!detail?.app) {
    throw new Error(`未找到 OEM 应用 ${normalizedAppName}`);
  }
  const currentConfig = clone(getAppConfig(detail.app));
  const nextConfig = {...currentConfig};
  const surfaces = {...asObject(nextConfig.surfaces)};
  const rechargeSurface = {...asObject(surfaces.recharge)};
  const rechargeConfig = {...asObject(rechargeSurface.config)};
  if (input.useOverride) {
    rechargeConfig.payment_methods = input.items.map((item) => ({
      provider: item.provider,
      enabled: item.enabled !== false,
      sort_order: item.sortOrder,
      is_default: item.default === true,
      label: item.label,
      metadata: asObject(item.metadata),
    }));
    delete rechargeConfig.paymentMethods;
  } else {
    delete rechargeConfig.payment_methods;
    delete rechargeConfig.paymentMethods;
  }
  rechargeSurface.config = rechargeConfig;
  surfaces.recharge = rechargeSurface;
  nextConfig.surfaces = surfaces;
  await apiFetch(`/admin/portal/apps/${encodeURIComponent(normalizedAppName)}`, {
    method: 'PUT',
    body: JSON.stringify({
      displayName: detail.app.displayName,
      description: detail.app.description,
      status: detail.app.status,
      defaultLocale: detail.app.defaultLocale || 'zh-CN',
      config: nextConfig,
    }),
  });
}

function getModelLogoPreset(presetKey) {
  return (state.modelLogoPresets || []).find((item) => item.presetKey === presetKey) || null;
}

function renderModelLogoPreview(presetKey, label = 'Logo') {
  const preset = getModelLogoPreset(presetKey);
  if (!preset) {
    return `<div class="empty-state" style="min-height:40px;">${escapeHtml(label)} 未设置</div>`;
  }
  return `
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="${escapeHtml(preset.url)}" alt="${escapeHtml(preset.label)}" style="width:40px;height:40px;object-fit:contain;border-radius:10px;background:rgba(255,255,255,0.04);padding:6px;border:1px solid rgba(212,183,120,0.18);" />
      <span>${escapeHtml(preset.label)}</span>
    </div>
  `;
}

function renderModelProviderRow(item = {}, index = 0) {
  const logoPresetKey = String(item.logoPresetKey || '');
  const logoPreset = getModelLogoPreset(logoPresetKey);
  const billingMultiplier = normalizeBillingMultiplierValue(item.billingMultiplier ?? item.billing_multiplier, 1);
  return `
    <div class="fig-card fig-card--subtle" data-model-provider-row="true" style="padding:16px;">
      <div class="fig-card__head">
        <h3>模型 ${index + 1}</h3>
        <button class="ghost-button" type="button" data-action="remove-provider-model-row">删除</button>
      </div>
      <div class="form-grid form-grid--two">
        <label class="field">
          <span>Label</span>
          <input class="field-input" name="model_label" value="${fieldValue(item.label || '')}" placeholder="显示名称" />
        </label>
        <label class="field">
          <span>Model ID</span>
          <input class="field-input" name="model_id" value="${fieldValue(item.modelId || '')}" placeholder="qwen-max" />
        </label>
        <label class="field">
          <span>倍率</span>
          <input class="field-input" name="model_billing_multiplier" type="number" min="0.01" step="0.01" value="${fieldValue(billingMultiplier)}" placeholder="1.0" />
        </label>
        <label class="field field--wide">
          <span>Logo Preset</span>
          <select class="field-select" name="model_logo_preset_key" data-logo-select="true">
            <option value="">不设置</option>
            ${(state.modelLogoPresets || [])
              .map(
                (preset) =>
                  `<option value="${escapeHtml(preset.presetKey)}"${logoPresetKey === preset.presetKey ? ' selected' : ''}>${escapeHtml(preset.label)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <div class="field field--wide">
          <span>Logo Preview</span>
          <div data-logo-preview="true">${logoPreset ? renderModelLogoPreview(logoPreset.presetKey, '模型 Logo') : '<div class="empty-state" style="min-height:40px;">模型 Logo 未设置</div>'}</div>
        </div>
      </div>
    </div>
  `;
}

function renderModelProviderCenterPage() {
  const selectedTab = getSelectedModelProviderTab();
  const selectedBrand = selectedTab === 'platform' ? null : (state.brands || []).find((item) => item.brandId === selectedTab) || null;
  const scopeType = selectedBrand ? 'app' : 'platform';
  const scopeKey = selectedBrand ? selectedBrand.brandId : 'platform';
  const platformProfile = getModelProviderProfilesByScope('platform', 'platform')[0] || null;
  const profiles = getModelProviderProfilesByScope(scopeType, scopeKey);
  const profile = profiles[0] || {
    id: '',
    scopeType,
    scopeKey,
    providerKey: '',
    baseUrl: '',
    apiKey: '',
    logoPresetKey: '',
    models: [],
  };
  const override = selectedBrand ? state.modelProviderOverrides[selectedBrand.brandId] || null : null;
  const draftKey = getModelProviderDraftKey(scopeType, scopeKey);
  const draft = state.modelProviderDrafts[draftKey] || buildModelProviderDraft({profile, override, scopeType, scopeKey});
  const memoryProfile = getMemoryEmbeddingProfilesByScope(scopeType, scopeKey)[0] || {
    id: '',
    scopeType,
    scopeKey,
    providerKey: '',
    baseUrl: '',
    apiKey: '',
    embeddingModel: '',
    logoPresetKey: '',
    autoRecall: true,
  };
  const memoryDraftKey = getMemoryEmbeddingDraftKey(scopeType, scopeKey);
  const memoryDraft = state.memoryEmbeddingDrafts[memoryDraftKey] || buildMemoryEmbeddingDraft({profile: memoryProfile, scopeType, scopeKey});
  const providerLogoPresetKey = String(draft.logoPresetKey || '');
  const providerLogoPreset = getModelLogoPreset(providerLogoPresetKey);
  const memoryLogoPresetKey = String(memoryDraft.logoPresetKey || '');
  const memoryLogoPreset = getModelLogoPreset(memoryLogoPresetKey);
  const currentProviderMode = String(draft.providerMode || 'inherit_platform').trim() || 'inherit_platform';
  const usesOemProvider = currentProviderMode === 'use_app_profile';
  const hasSavedOemProfile = Boolean(selectedBrand && String(profile.id || '').trim());
  const hasSavedOemMemoryProfile = Boolean(selectedBrand && String(memoryProfile.id || '').trim());
  const platformProviderLabel = String(platformProfile?.providerKey || platformProfile?.providerLabel || '').trim() || '未配置';
  const oemProviderLabel = String(draft.providerKey || profile.providerKey || '').trim() || '未配置';
  const platformMemoryProfile = getMemoryEmbeddingProfilesByScope('platform', 'platform')[0] || null;
  const platformMemoryLabel = String(platformMemoryProfile?.providerKey || platformMemoryProfile?.providerLabel || '').trim() || '未配置';
  const oemMemoryLabel = String(memoryDraft.providerKey || memoryProfile.providerKey || '').trim() || '未配置';
  const providerStatusTitle = !selectedBrand
    ? `当前平台默认 Provider：${platformProviderLabel}`
    : usesOemProvider
      ? `当前使用 OEM Provider：${oemProviderLabel}`
      : `当前跟随平台 Provider：${platformProviderLabel}`;
  const providerStatusDescription = !selectedBrand
    ? '这里是所有 OEM 的默认 provider。OEM 未单独启用时都会继承这里。'
    : usesOemProvider
      ? '当前这个 OEM 已经切到自己的 provider。修改并保存下方配置，会直接更新当前生效配置。'
      : hasSavedOemProfile
        ? '这个 OEM 已保存独立 provider，但当前仍跟随平台。再次保存下方配置会自动启用 OEM Provider。'
        : '这个 OEM 当前跟随平台。填写并保存下方配置后，会自动切到自己的 Provider。';
  const memoryStatusTitle = !selectedBrand
    ? `当前平台默认记忆 Embedding：${platformMemoryLabel}`
    : hasSavedOemMemoryProfile
      ? `当前使用 OEM 记忆 Embedding：${oemMemoryLabel}`
      : `当前跟随平台记忆 Embedding：${platformMemoryLabel}`;
  const memoryStatusDescription = !selectedBrand
    ? '这里是所有 OEM 的默认记忆向量配置。OEM 没有单独配置时都会继承这里。'
    : hasSavedOemMemoryProfile
      ? '当前这个 OEM 已经切到自己的记忆 Embedding。保存后会直接更新当前生效配置。'
      : '这个 OEM 当前跟随平台记忆 Embedding。填写并保存下方配置后，会只影响这个 OEM 的记忆索引与召回。';
  const selectedSection = state.selectedModelCenterSection === 'memory-embedding' ? 'memory-embedding' : 'chat-provider';
  const tabs = [
    {key: 'platform', label: '平台'},
    ...(state.brands || []).map((brand) => ({key: brand.brandId, label: brand.displayName})),
  ];
  const providerModelOptions = (draft.models || [])
    .map((item) => {
      const model = asObject(item);
      const modelId = String(model.modelId || '').trim();
      const label = String(model.label || modelId).trim();
      const ref = buildProviderDraftModelRef(draft.providerKey, modelId);
      if (!ref || !label) {
        return null;
      }
      return {
        ref,
        label,
      };
    })
    .filter(Boolean);
  const providerDefaultModelRef =
    providerModelOptions.some((item) => item.ref === draft.defaultModelRef) ? draft.defaultModelRef : '';

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>模型中心</h1>
            <p class="fig-page__description">按 provider layer 配置平台和 OEM 的模型运行时。OEM 未配置时回落平台层；一旦启用 OEM provider，就整套切走 OEM。</p>
          </div>
        </div>
      </div>
      ${renderPageGuide('模型中心怎么用', [
        '平台 tab 维护全局 fallback provider。',
        'OEM tab 不再暴露 Provider Mode。填写并保存独立 provider 后，会自动切到 OEM Provider。',
        '如果要恢复到平台默认 provider，直接点“恢复跟随平台”。',
        '模型列表、默认模型、Base URL、API Key、Logo、倍率都在同一个 provider profile 里维护；保存后会同步清理 runtime 缓存。',
        '记忆 Embedding 现在是独立配置，不再复用聊天 provider。聊天能用，不代表记忆向量一定能用。',
        '保存记忆 Embedding 前会先做一次真实 /embeddings 预检；预检不过，配置不会被当成可用保存。',
        '平台记忆 Embedding 是所有 OEM 的默认兜底；OEM 一旦配置独立记忆 Embedding，只影响这个 OEM 的记忆索引和召回。',
      ], 'capability')}
      <div class="fig-detail-stack">
        <section class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <div>
              <h3>Baseline 维护规范</h3>
              <span>数据库是唯一主数据来源；需要留痕或跨环境恢复时，使用 baseline snapshot 的导出 / 校验 / 回灌脚本</span>
            </div>
          </div>
          <div class="empty-state" style="min-height:auto; align-items:flex-start; text-align:left;">
            <strong>已移除 core-oem.json legacy preset 链路。</strong>
            <span>日常维护直接改数据库；需要基线快照时导出 platform-db.snapshot.json，恢复时走 baseline apply。</span>
          </div>
        </section>
        <section class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>Provider Scope</h3>
            <span>1 + N Tab</span>
          </div>
          <div class="segmented" style="flex-wrap:wrap;">
            ${tabs
              .map(
                (tab) =>
                  `<button class="tab-pill${selectedTab === tab.key ? ' is-active' : ''}" type="button" data-action="select-model-provider-tab" data-tab-key="${escapeHtml(tab.key)}">${escapeHtml(tab.label)}</button>`,
              )
              .join('')}
          </div>
        </section>
        <section class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>配置视图</h3>
            <span>先定视图，再定配置</span>
          </div>
          <div class="segmented">
            <button class="tab-pill${selectedSection === 'chat-provider' ? ' is-active' : ''}" type="button" data-action="select-model-center-section" data-section-key="chat-provider">聊天 Provider</button>
            <button class="tab-pill${selectedSection === 'memory-embedding' ? ' is-active' : ''}" type="button" data-action="select-model-center-section" data-section-key="memory-embedding">记忆 Embedding</button>
          </div>
        </section>
        <form id="model-provider-form" class="fig-card fig-card--subtle"${selectedSection !== 'chat-provider' ? ' style="display:none;"' : ''}>
          <input type="hidden" name="profile_id" value="${fieldValue(draft.id || '')}" />
          <input type="hidden" name="scope_type" value="${fieldValue(scopeType)}" />
          <input type="hidden" name="scope_key" value="${fieldValue(scopeKey)}" />
          <input type="hidden" name="provider_mode" value="${fieldValue(currentProviderMode)}" />
          <div class="fig-card__head">
            <div>
              <h3>${escapeHtml(selectedBrand ? `${selectedBrand.displayName} Provider` : '平台 Fallback Provider')}</h3>
              <span>${escapeHtml(scopeType === 'platform' ? '所有 OEM 默认继承这里' : '这里维护这个 OEM 的独立 provider 配置')}</span>
            </div>
          </div>
          <div class="empty-state" style="min-height:auto; align-items:flex-start; text-align:left; margin-bottom:16px;">
            <strong>${escapeHtml(providerStatusTitle)}</strong>
            <span>${escapeHtml(providerStatusDescription)}</span>
          </div>
          <div class="form-grid form-grid--two">
            <label class="field">
              <span>Provider Key</span>
              <input class="field-input" name="provider_key" value="${fieldValue(draft.providerKey || '')}" placeholder="bailian / siliconflow" />
            </label>
            <label class="field field--wide">
              <span>Base URL</span>
              <input class="field-input" name="base_url" value="${fieldValue(draft.baseUrl || '')}" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
            </label>
            <label class="field field--wide">
              <span>API Key</span>
              <input class="field-input" name="api_key" value="${fieldValue(draft.apiKey || '')}" placeholder="直接落表保存" />
            </label>
            <label class="field field--wide">
              <span>Provider Logo Preset</span>
              <select class="field-select" name="logo_preset_key" data-logo-select="true">
                <option value="">不设置</option>
                ${(state.modelLogoPresets || [])
                  .map(
                    (preset) =>
                      `<option value="${escapeHtml(preset.presetKey)}"${providerLogoPresetKey === preset.presetKey ? ' selected' : ''}>${escapeHtml(preset.label)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <div class="field field--wide">
              <span>Provider Logo Preview</span>
              <div data-logo-preview="true">${providerLogoPreset ? renderModelLogoPreview(providerLogoPreset.presetKey, 'Provider Logo') : '<div class="empty-state" style="min-height:40px;">Provider Logo 未设置</div>'}</div>
            </div>
          </div>
          <section class="fig-card fig-card--subtle" style="margin-top:16px;">
            <div class="fig-card__head">
              <h3>Model List</h3>
              <button class="ghost-button" type="button" data-action="add-provider-model-row">新增模型</button>
            </div>
            <div class="form-grid" style="margin-bottom:16px;">
              <label class="field field--wide">
                <span>默认模型</span>
                <select class="field-select" name="default_model_ref">
                  <option value="">请选择默认模型</option>
                  ${providerModelOptions
                    .map(
                      (item) =>
                        `<option value="${escapeHtml(item.ref)}"${providerDefaultModelRef === item.ref ? ' selected' : ''}>${escapeHtml(item.label)} · ${escapeHtml(item.ref)}</option>`,
                    )
                    .join('')}
                </select>
              </label>
            </div>
            <div data-model-provider-rows="true" class="fig-detail-stack">
              ${(draft.models || []).length ? draft.models.map((item, index) => renderModelProviderRow(item, index)).join('') : renderModelProviderRow({}, 0)}
            </div>
          </section>
          <div class="fig-form-actions">
            <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存 Provider</button>
            ${selectedBrand ? `<button class="ghost-button" type="button" data-action="restore-platform-model-provider" data-app-name="${escapeHtml(selectedBrand.brandId)}"${state.busy || currentProviderMode !== 'use_app_profile' ? ' disabled' : ''}>恢复跟随平台</button>` : ''}
          </div>
        </form>
        <form id="memory-embedding-form" class="fig-card fig-card--subtle"${selectedSection !== 'memory-embedding' ? ' style="display:none;"' : ''}>
          <input type="hidden" name="memory_profile_id" value="${fieldValue(memoryDraft.id || '')}" />
          <input type="hidden" name="scope_type" value="${fieldValue(scopeType)}" />
          <input type="hidden" name="scope_key" value="${fieldValue(scopeKey)}" />
          <div class="fig-card__head">
            <div>
              <h3>${escapeHtml(selectedBrand ? `${selectedBrand.displayName} 记忆 Embedding` : '平台记忆 Embedding Fallback')}</h3>
              <span>${escapeHtml(scopeType === 'platform' ? '所有 OEM 默认继承这里' : '这里维护这个 OEM 的独立记忆向量配置')}</span>
            </div>
          </div>
          <div class="empty-state" style="min-height:auto; align-items:flex-start; text-align:left; margin-bottom:16px;">
            <strong>${escapeHtml(memoryStatusTitle)}</strong>
            <span>${escapeHtml(memoryStatusDescription)}</span>
          </div>
          ${
            state.memoryEmbeddingTestResult
              ? `<div class="banner ${state.memoryEmbeddingTestResult.ok ? 'banner--success' : 'banner--error'}" style="margin-bottom:16px;">测试结果: ${escapeHtml(state.memoryEmbeddingTestResult.message || (state.memoryEmbeddingTestResult.dimensions ? `${state.memoryEmbeddingTestResult.dimensions} 维向量返回成功` : '已通过'))}</div>`
              : ''
          }
          <div class="form-grid form-grid--two">
            <label class="field">
              <span>Provider Key</span>
              <input class="field-input" name="memory_provider_key" value="${fieldValue(memoryDraft.providerKey || '')}" placeholder="bailian / siliconflow" />
            </label>
            <label class="field field--wide">
              <span>Base URL</span>
              <input class="field-input" name="memory_base_url" value="${fieldValue(memoryDraft.baseUrl || '')}" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
            </label>
            <label class="field field--wide">
              <span>API Key</span>
              <input class="field-input" name="memory_api_key" value="${fieldValue(memoryDraft.apiKey || '')}" placeholder="Embedding API Key" />
            </label>
            <label class="field">
              <span>Embedding Model</span>
              <input class="field-input" name="memory_embedding_model" value="${fieldValue(memoryDraft.embeddingModel || '')}" placeholder="text-embedding-v4" />
            </label>
            <label class="field field--wide">
              <span>Provider Logo Preset</span>
              <select class="field-select" name="memory_logo_preset_key" data-logo-select="true">
                <option value="">不设置</option>
                ${(state.modelLogoPresets || [])
                  .map(
                    (preset) =>
                      `<option value="${escapeHtml(preset.presetKey)}"${memoryLogoPresetKey === preset.presetKey ? ' selected' : ''}>${escapeHtml(preset.label)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <div class="field field--wide">
              <span>Provider Logo Preview</span>
              <div data-logo-preview="true">${memoryLogoPreset ? renderModelLogoPreview(memoryLogoPreset.presetKey, 'Memory Provider Logo') : '<div class="empty-state" style="min-height:40px;">Provider Logo 未设置</div>'}</div>
            </div>
            <label class="field field--wide" style="display:flex;align-items:center;gap:10px;">
              <input type="checkbox" name="memory_auto_recall"${memoryDraft.autoRecall !== false ? ' checked' : ''} />
              <span>开启 Auto Recall</span>
            </label>
          </div>
          <div class="fig-form-actions">
            <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存记忆 Embedding</button>
            <button class="ghost-button" type="button" data-action="test-memory-embedding"${state.busy ? ' disabled' : ''}>测试连接</button>
            ${selectedBrand ? `<button class="ghost-button" type="button" data-action="restore-platform-memory-embedding" data-app-name="${escapeHtml(selectedBrand.brandId)}"${state.busy || !hasSavedOemMemoryProfile ? ' disabled' : ''}>恢复跟随平台</button>` : ''}
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderSkillsMcpPage() {
  if (state.capabilityMode === 'models') {
    return renderModelProviderCenterPage();
  }
  const filterOptions = getCapabilityFilterOptions();
  const {skills, mcpServers, models} = getFilteredCapabilities();
  const cloudSkillTotal = Number(state.cloudSkillCatalogMeta?.total || 0);
  const selectedSkill = state.selectedSkillSlug === '__new__' ? null : skills.find((item) => item.slug === state.selectedSkillSlug) || skills[0] || null;
  const selectedMcp = state.selectedMcpKey === '__new__' ? null : mcpServers.find((item) => item.key === state.selectedMcpKey) || mcpServers[0] || null;
  const selectedModel = state.selectedModelRef === '__new__' ? null : models.find((item) => item.ref === state.selectedModelRef) || models[0] || null;
  const actionButton =
    state.capabilityMode === 'skills'
      ? `
        <button class="solid-button fig-button" type="button" data-action="new-skill">
          ${icon('plus', 'button-icon')}
          从云技能加入
        </button>
      `
      : state.capabilityMode === 'mcp'
        ? `
          <button class="solid-button fig-button" type="button" data-action="new-mcp">
            ${icon('plus', 'button-icon')}
            从云MCP加入
          </button>
        `
        : `
          <button class="solid-button fig-button" type="button" data-action="new-model">
            ${icon('plus', 'button-icon')}
            新增模型
          </button>
        `;
  const pageDescription =
    state.capabilityMode === 'skills'
      ? `管理平台预装 Skill 子集；云技能总库当前 ${cloudSkillTotal} 条`
      : state.capabilityMode === 'mcp'
        ? '管理平台级 MCP 预装子集；云MCP总库是唯一主数据来源'
        : '管理模型主目录、OEM allowlist、推荐和默认模型';
  const pageTitle =
    state.capabilityMode === 'skills' ? '平台级 Skill' : state.capabilityMode === 'mcp' ? '平台级 MCP' : '模型中心';
  const listCountLabel =
    state.capabilityMode === 'skills'
      ? `当前显示 ${skills.length} 个平台预装 Skill / 云总库 ${cloudSkillTotal}`
      : state.capabilityMode === 'mcp'
        ? `当前显示 ${mcpServers.length} 个平台级 MCP`
        : `当前显示 ${models.length} 个模型`;
  const searchPlaceholder =
    state.capabilityMode === 'skills'
      ? '搜索平台级 Skill...'
      : state.capabilityMode === 'mcp'
        ? '搜索平台级 MCP...'
        : '搜索模型...';
  const filterControls =
    state.capabilityMode === 'skills'
      ? `
        <div class="fig-capability-filter-row">
          <select class="field-select fig-filter" data-filter-key="capabilitySkillStatus">
            ${['all', 'active', 'disabled']
              .map(
                (item) =>
                  `<option value="${item}"${state.filters.capabilitySkillStatus === item ? ' selected' : ''}>${escapeHtml(item === 'all' ? '全部目录' : item === 'active' ? '仅上架' : '仅下架')}</option>`,
              )
              .join('')}
          </select>
          <select class="field-select fig-filter" data-filter-key="capabilitySkillCategory">
            <option value="all">全部分类</option>
            ${filterOptions.categories
              .map(
                (item) =>
                  `<option value="${escapeHtml(item)}"${state.filters.capabilitySkillCategory === item ? ' selected' : ''}>${escapeHtml(item)}</option>`,
              )
              .join('')}
          </select>
          <select class="field-select fig-filter" data-filter-key="capabilitySkillBrand">
            <option value="all">全部品牌</option>
            ${filterOptions.skillBrands
              .map(
                (brand) =>
                  `<option value="${escapeHtml(brand.brand_id)}"${state.filters.capabilitySkillBrand === brand.brand_id ? ' selected' : ''}>${escapeHtml(brand.display_name)}</option>`,
              )
              .join('')}
          </select>
        </div>
      `
      : state.capabilityMode === 'mcp'
        ? `
          <div class="fig-capability-filter-row">
            <select class="field-select fig-filter" data-filter-key="capabilityMcpStatus">
              ${['all', 'active', 'disabled']
                .map(
                  (item) =>
                    `<option value="${item}"${state.filters.capabilityMcpStatus === item ? ' selected' : ''}>${escapeHtml(item === 'all' ? '全部目录' : item === 'active' ? '仅可用' : '仅关闭')}</option>`,
                )
                .join('')}
            </select>
            <select class="field-select fig-filter" data-filter-key="capabilityMcpTransport">
              <option value="all">全部传输</option>
              ${filterOptions.transports
                .map(
                  (item) =>
                    `<option value="${escapeHtml(item)}"${state.filters.capabilityMcpTransport === item ? ' selected' : ''}>${escapeHtml(item)}</option>`,
                )
                .join('')}
            </select>
            <select class="field-select fig-filter" data-filter-key="capabilityMcpBrand">
              <option value="all">全部品牌</option>
              ${filterOptions.mcpBrands
                .map(
                  (brand) =>
                    `<option value="${escapeHtml(brand.brand_id)}"${state.filters.capabilityMcpBrand === brand.brand_id ? ' selected' : ''}>${escapeHtml(brand.display_name)}</option>`,
                )
                .join('')}
            </select>
          </div>
        `
        : `
          <div class="fig-capability-filter-row">
            <select class="field-select fig-filter" data-filter-key="capabilityModelStatus">
              ${['all', 'active', 'disabled']
                .map(
                  (item) =>
                    `<option value="${item}"${state.filters.capabilityModelStatus === item ? ' selected' : ''}>${escapeHtml(item === 'all' ? '全部状态' : item === 'active' ? '仅启用' : '仅禁用')}</option>`,
                )
                .join('')}
            </select>
            <select class="field-select fig-filter" data-filter-key="capabilityModelProvider">
              <option value="all">全部 Provider</option>
              ${filterOptions.modelProviders
                .map(
                  (item) =>
                    `<option value="${escapeHtml(item)}"${state.filters.capabilityModelProvider === item ? ' selected' : ''}>${escapeHtml(item)}</option>`,
                )
                .join('')}
            </select>
            <select class="field-select fig-filter" data-filter-key="capabilityModelBrand">
              <option value="all">全部品牌</option>
              ${filterOptions.modelBrands
                .map(
                  (brand) =>
                    `<option value="${escapeHtml(brand.brand_id)}"${state.filters.capabilityModelBrand === brand.brand_id ? ' selected' : ''}>${escapeHtml(brand.display_name)}</option>`,
                )
                .join('')}
            </select>
          </div>
        `;
  const listMarkup =
    state.capabilityMode === 'skills'
      ? `
        ${skills.length
          ? skills
              .map(
                (item) => `
                  <button class="capability-card${selectedSkill?.slug === item.slug ? ' is-active' : ''}" type="button" data-action="select-skill" data-skill-slug="${escapeHtml(item.slug)}">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.category || '未分类')} • ${escapeHtml(item.brand_count)} 个 OEM 生效</span>
                  </button>
                `,
              )
              .join('')
          : `<div class="empty-state">还没有平台预装 Skill，先从云技能全集加入。</div>`}
      `
      : state.capabilityMode === 'mcp'
        ? `
          ${mcpServers.length
            ? mcpServers
                .map(
                  (item) => `
                    <button class="capability-card${selectedMcp?.key === item.key ? ' is-active' : ''}" type="button" data-action="select-mcp" data-mcp-key="${escapeHtml(item.key)}">
                      <strong>${escapeHtml(item.name)}</strong>
                      <span>${escapeHtml(item.connected_brand_count)} 个 OEM 生效 • ${escapeHtml(item.env_keys.length)} 个环境变量</span>
                    </button>
                  `,
                )
                .join('')
            : `<div class="empty-state">还没有平台级 MCP，先从云MCP加入。</div>`}
        `
        : `
          ${models.length
            ? models
                .map(
                  (item) => `
                    <button class="capability-card${selectedModel?.ref === item.ref ? ' is-active' : ''}" type="button" data-action="select-model" data-model-ref="${escapeHtml(item.ref)}">
                      <strong>${escapeHtml(item.label)}</strong>
                      <span>${escapeHtml(item.providerId)} • ${escapeHtml(item.connected_brand_count)} 个品牌使用</span>
                    </button>
                  `,
                )
                .join('')
            : `<div class="empty-state">没有匹配的模型。</div>`}
          <button class="capability-card${state.selectedModelRef === '__new__' ? ' is-active' : ''}" type="button" data-action="select-model" data-model-ref="__new__">
            <strong>新建模型</strong>
            <span>新增一个 OEM 可装配的模型目录项</span>
          </button>
        `;
  const detailMarkup =
    state.capabilityMode === 'skills'
      ? renderSkillDetail(selectedSkill)
      : state.capabilityMode === 'mcp'
        ? renderMcpDetail(selectedMcp)
        : renderModelDetail(selectedModel);

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>${pageTitle}</h1>
            <p class="fig-page__description">${pageDescription}</p>
          </div>
          ${actionButton}
        </div>
      </div>
      ${renderPageGuide(`${pageTitle}怎么用`, state.capabilityMode === 'skills'
        ? [
            '这里不是云技能全集，而是 `platform_bundled_skill` 这一层。',
            '点击“从云技能加入”后，会把云技能中的某个 skill 纳入平台预装子集，并自动继承到所有 OEM。',
            '品牌详情里的“技能”页只做 `oem_bundled_skill` 增量预装，不重复管理平台预装层。',
          ]
        : state.capabilityMode === 'mcp'
          ? [
              '这里不是云MCP全集，而是 `platform_bundled_mcps` 这一层。',
              '点击“从云MCP加入”后，会把云MCP总库中的某个 MCP 纳入平台级 MCP，并自动继承到所有 OEM。',
              '品牌详情里的“MCP”页只做 OEM 增量装配，不重复管理平台级 MCP。',
            ]
          : [
              '这里维护模型全集，不直接决定某个 OEM 能看到什么。',
              '每个 OEM 的模型可见性在品牌详情的“模型”tab里单独勾选。',
              '模型主数据改完后，品牌发布新快照，客户端同步后输入框模型列表才会变化。',
            ], 'capability')}
      <div class="fig-capability-screen">
        <aside class="fig-capability-sidebar">
          <div class="fig-capability-sidebar__toolbar">
            <label class="fig-search">
              ${icon('search', 'fig-search__icon')}
              <input
                class="field-input fig-search__input"
                data-filter-key="capabilityQuery"
                placeholder="${searchPlaceholder}"
                value="${fieldValue(state.filters.capabilityQuery)}"
              />
            </label>
            <div class="segmented">
              <button class="tab-pill${state.capabilityMode === 'skills' ? ' is-active' : ''}" type="button" data-action="capability-mode" data-mode="skills">技能</button>
              <button class="tab-pill${state.capabilityMode === 'mcp' ? ' is-active' : ''}" type="button" data-action="capability-mode" data-mode="mcp">MCP</button>
              <button class="tab-pill${state.capabilityMode === 'models' ? ' is-active' : ''}" type="button" data-action="capability-mode" data-mode="models">模型</button>
            </div>
            ${filterControls}
            <div class="fig-capability-filter-meta">
              <span>${escapeHtml(listCountLabel)}</span>
              <button class="text-button" type="button" data-action="capability-filter-reset">重置筛选</button>
            </div>
          </div>
          <div class="fig-capability-list">${listMarkup}</div>
        </aside>
        <section class="fig-capability-detail">${detailMarkup}</section>
      </div>
    </div>
  `;
}

function getFilteredAgents() {
  const query = state.filters.agentQuery.trim().toLowerCase();
  return [...state.agentCatalog]
    .filter((item) => {
      if (state.filters.agentStatus === 'active' && item.active === false) {
        return false;
      }
      if (state.filters.agentStatus === 'disabled' && item.active !== false) {
        return false;
      }
      const surface = getAgentSurface(item);
      if (state.filters.agentSurface !== 'all' && surface !== state.filters.agentSurface) {
        return false;
      }
      const sourceRepo = getAgentSourceRepo(item);
      if (state.filters.agentSourceRepo !== 'all' && sourceRepo !== state.filters.agentSourceRepo) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [
        item.slug,
        item.name,
        item.description,
        item.category,
        item.publisher,
        surface,
        sourceRepo,
        ...(item.tags || []),
      ].some((value) => String(value || '').toLowerCase().includes(query));
    })
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0) || left.name.localeCompare(right.name, 'zh-CN'));
}

function renderAgentEditorForm(agent) {
  const isNew = !agent;
  const editable = agent || {
    slug: '',
    name: '',
    description: '',
    category: 'general',
    publisher: 'iClaw',
    featured: false,
    official: true,
    tags: [],
    capabilities: [],
    use_cases: [],
    metadata: {},
    sort_order: 9999,
    active: true,
  };
  const avatarUrl = getAgentEditableAvatarUrl(editable);
  const avatarPresetValue = getAgentAvatarPresetValue(avatarUrl);
  const avatarPreviewUrl = avatarUrl || '';

  return `
    <section class="fig-card fig-card--subtle">
      <div class="fig-card__head">
        <h3>${isNew ? '新增 Agent Catalog' : '编辑 Agent Catalog'}</h3>
        <span>这里直接维护数据库中的 agent catalog 主数据。</span>
      </div>
      <form id="agent-editor-form" class="form-grid form-grid--two">
        <label class="field">
          <span>Slug</span>
          <input class="field-input" name="slug" value="${fieldValue(editable.slug)}" placeholder="agent-slug" ${isNew ? '' : 'readonly'} />
        </label>
        <label class="field">
          <span>Name</span>
          <input class="field-input" name="name" value="${fieldValue(editable.name)}" placeholder="Agent 名称" />
        </label>
        <label class="field field--wide">
          <span>Description</span>
          <textarea class="field-textarea" name="description" placeholder="Agent 做什么">${escapeHtml(editable.description || '')}</textarea>
        </label>
        <label class="field">
          <span>Category</span>
          <select class="field-select" name="category">
            ${['finance', 'content', 'productivity', 'commerce', 'general']
              .map((item) => `<option value="${item}"${editable.category === item ? ' selected' : ''}>${escapeHtml(item)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="field">
          <span>Publisher</span>
          <input class="field-input" name="publisher" value="${fieldValue(editable.publisher || 'iClaw')}" />
        </label>
        <label class="field">
          <span>Sort Order</span>
          <input class="field-input" name="sort_order" type="number" min="0" value="${fieldValue(editable.sort_order || 9999)}" />
        </label>
        <label class="field">
          <span>状态</span>
          <select class="field-select" name="active">
            <option value="true"${editable.active !== false ? ' selected' : ''}>启用</option>
            <option value="false"${editable.active === false ? ' selected' : ''}>禁用</option>
          </select>
        </label>
        <label class="field">
          <span>Featured</span>
          <select class="field-select" name="featured">
            <option value="true"${editable.featured === true ? ' selected' : ''}>true</option>
            <option value="false"${editable.featured === true ? '' : ' selected'}>false</option>
          </select>
        </label>
        <label class="field">
          <span>Official</span>
          <select class="field-select" name="official">
            <option value="true"${editable.official !== false ? ' selected' : ''}>true</option>
            <option value="false"${editable.official === false ? ' selected' : ''}>false</option>
          </select>
        </label>
        <label class="field">
          <span>头像预设</span>
          <select class="field-select" name="avatar_preset" data-agent-avatar-preset="true">
            <option value=""${avatarPresetValue === '' ? ' selected' : ''}>自动分配</option>
            ${AGENT_AVATAR_PRESET_OPTIONS.map((item) => `<option value="${escapeHtml(item.value)}"${avatarPresetValue === item.value ? ' selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
            <option value="__custom__"${avatarPresetValue === '__custom__' ? ' selected' : ''}>自定义 URL</option>
          </select>
        </label>
        <label class="field">
          <span>头像 URL</span>
          <input
            class="field-input"
            name="avatar_url"
            value="${fieldValue(avatarUrl)}"
            placeholder="/agent-avatars/pexels/portrait-01.jpg"
            data-agent-avatar-url="true"
          />
        </label>
        <label class="field">
          <span>本地上传头像</span>
          <input
            class="field-input"
            type="file"
            accept="image/*"
            data-agent-avatar-file="true"
          />
          <small style="display:block;margin-top:8px;color:var(--text-secondary);">选择图片后会自动上传；若当前 Agent 已填好 slug 和名称，会继续自动保存。</small>
        </label>
        <div class="field">
          <span>头像预览</span>
          <div style="display:flex;align-items:center;gap:12px;min-height:72px;">
            <div style="width:56px;height:56px;border-radius:999px;overflow:hidden;border:1px solid rgba(212,183,120,0.28);background:rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              ${
                avatarPreviewUrl
                  ? `<img src="${escapeHtml(avatarPreviewUrl)}" alt="avatar preview" data-agent-avatar-preview="true" style="width:100%;height:100%;object-fit:cover;" />`
                  : `<span data-agent-avatar-empty="true" style="font-size:12px;color:var(--text-secondary);">自动</span><img src="" alt="avatar preview" data-agent-avatar-preview="true" style="display:none;width:100%;height:100%;object-fit:cover;" />`
              }
            </div>
            <div style="font-size:12px;line-height:1.6;color:var(--text-secondary);">
              留空时前台会走自动头像池分配。选择预设会自动写入 URL。
            </div>
          </div>
          <div data-agent-avatar-upload-status="true" style="margin-top:8px;font-size:12px;line-height:1.6;color:var(--text-secondary);"></div>
        </div>
        <label class="field field--wide">
          <span>Tags</span>
          <textarea class="field-textarea" name="tags_text" placeholder="每行一个 tag">${escapeHtml((editable.tags || []).join('\n'))}</textarea>
        </label>
        <label class="field field--wide">
          <span>Capabilities</span>
          <textarea class="field-textarea" name="capabilities_text" placeholder="每行一个 capability">${escapeHtml((editable.capabilities || []).join('\n'))}</textarea>
        </label>
        <label class="field field--wide">
          <span>Use Cases</span>
          <textarea class="field-textarea" name="use_cases_text" placeholder="每行一个 use case">${escapeHtml((editable.use_cases || []).join('\n'))}</textarea>
        </label>
        <div class="field field--wide">
          ${renderMetadataEntriesEditor({
            name: 'metadata_entries',
            title: 'Metadata',
            description: 'Agent 的附加字段，支持点路径。',
            value: editable.metadata || {},
          })}
        </div>
        <div class="fig-form-actions">
          <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存 Agent</button>
        </div>
      </form>
    </section>
  `;
}

function renderAgentCenterPage() {
  const agents = getFilteredAgents();
  const selectedAgent =
    state.selectedAgentSlug === '__new__'
      ? null
      : getAgentCatalogEntry(state.selectedAgentSlug) || agents[0] || null;
  const selectedSurface = selectedAgent ? getAgentSurface(selectedAgent) : 'all';
  const selectedSourceRepo = selectedAgent ? getAgentSourceRepo(selectedAgent) : 'manual';
  const primarySkill = String(asObject(selectedAgent?.metadata).primary_skill_slug || '').trim();
  const surfaces = Array.from(new Set(state.agentCatalog.map((item) => getAgentSurface(item)).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'zh-CN'),
  );
  const sourceRepos = Array.from(new Set(state.agentCatalog.map((item) => getAgentSourceRepo(item)).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'zh-CN'),
  );

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>Agent中心</h1>
            <p class="fig-page__description">统一维护龙虾商店、智能投资专家等 agent catalog 主数据。</p>
          </div>
          <button class="solid-button fig-button" type="button" data-action="new-agent">
            ${icon('plus', 'button-icon')}
            新建 Agent
          </button>
        </div>
      </div>
      <div class="fig-page__body">
        ${renderPageGuide('Agent中心怎么用', [
          '这里维护 agent catalog 主数据，前台龙虾商店和智能投资专家都直接读这里。',
          'metadata 内保存 surface、primary skill、skill slugs、prompt、MCP preset 等扩展字段。',
          '保存后会直接写数据库，并同步刷新 control-plane 的 agent catalog 缓存。',
        ], 'agent')}
        <div class="fig-capability-screen">
          <aside class="fig-capability-sidebar">
            <div class="fig-capability-sidebar__toolbar">
              <label class="fig-search">
                ${icon('search', 'fig-search__icon')}
                <input
                  class="field-input fig-search__input"
                  data-filter-key="agentQuery"
                  placeholder="搜索 agent..."
                  value="${fieldValue(state.filters.agentQuery)}"
                />
              </label>
              <div class="fig-capability-filter-row">
                <select class="field-select fig-filter" data-filter-key="agentStatus">
                  ${['all', 'active', 'disabled']
                    .map((item) => `<option value="${item}"${state.filters.agentStatus === item ? ' selected' : ''}>${escapeHtml(item === 'all' ? '全部状态' : item === 'active' ? '仅启用' : '仅禁用')}</option>`)
                    .join('')}
                </select>
                <select class="field-select fig-filter" data-filter-key="agentSurface">
                  <option value="all">全部 Surface</option>
                  ${surfaces.map((item) => `<option value="${escapeHtml(item)}"${state.filters.agentSurface === item ? ' selected' : ''}>${escapeHtml(item)}</option>`).join('')}
                </select>
                <select class="field-select fig-filter" data-filter-key="agentSourceRepo">
                  <option value="all">全部来源仓库</option>
                  ${sourceRepos
                    .map((item) => `<option value="${escapeHtml(item)}"${state.filters.agentSourceRepo === item ? ' selected' : ''}>${escapeHtml(getAgentSourceLabel(item))}</option>`)
                    .join('')}
                </select>
              </div>
              <div class="fig-capability-filter-meta">
                <span>${escapeHtml(`${agents.length} 个 Agent`)}</span>
                <button class="text-button" type="button" data-action="agent-filter-reset">重置筛选</button>
              </div>
            </div>
            <div class="fig-capability-list">
              ${agents.length
                ? agents
                    .map(
                      (item) => `
                        <button class="capability-card${selectedAgent?.slug === item.slug ? ' is-active' : ''}" type="button" data-action="select-agent" data-agent-slug="${escapeHtml(item.slug)}">
                          <strong>${escapeHtml(item.name)}</strong>
                          <span>${escapeHtml(getAgentSurface(item))} • ${escapeHtml(item.active === false ? 'disabled' : 'active')} • ${escapeHtml(getAgentSourceLabel(getAgentSourceRepo(item)))}</span>
                        </button>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">没有匹配的 Agent。</div>`}
              <button class="capability-card${state.selectedAgentSlug === '__new__' ? ' is-active' : ''}" type="button" data-action="new-agent">
                <strong>新建 Agent</strong>
                <span>新增一个可投放到前台的 agent 目录项</span>
              </button>
            </div>
          </aside>
          <section class="fig-capability-detail">
            ${
              selectedAgent
                ? `
                  <div class="fig-detail-stack">
                    <div class="fig-card">
                      <div class="fig-card__head">
                        <div>
                          <h2>${escapeHtml(selectedAgent.name)}</h2>
                          <span>${escapeHtml(selectedAgent.slug)} · ${escapeHtml(selectedAgent.publisher || 'iClaw')}</span>
                        </div>
                        ${renderSwitch({
                          checked: selectedAgent.active !== false,
                          action: 'agent-toggle',
                          attrs: `data-agent-slug="${escapeHtml(selectedAgent.slug)}" data-enabled="${selectedAgent.active !== false ? 'true' : 'false'}"`,
                          label: selectedAgent.active !== false ? '已启用' : '已禁用',
                        })}
                      </div>
                      <p class="detail-copy">${escapeHtml(selectedAgent.description || '暂无描述。')}</p>
                      <div class="fig-meta-cards">
                        <div class="fig-meta-card"><span>Surface</span><strong>${escapeHtml(selectedSurface)}</strong></div>
                        <div class="fig-meta-card"><span>来源仓库</span><strong>${escapeHtml(getAgentSourceLabel(selectedSourceRepo))}</strong></div>
                        <div class="fig-meta-card"><span>Primary Skill</span><strong>${escapeHtml(primarySkill || '未设置')}</strong></div>
                        <div class="fig-meta-card"><span>Sort Order</span><strong>${escapeHtml(selectedAgent.sort_order || 0)}</strong></div>
                      </div>
                      <div class="chip-grid">
                        ${(selectedAgent.tags || []).length ? selectedAgent.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join('') : `<div class="empty-state">暂无标签。</div>`}
                      </div>
                      <div class="action-row">
                        <button class="text-button" type="button" data-action="toggle-agent-import">${state.showAgentImportPanel ? '收起编辑面板' : '编辑 Agent'}</button>
                        <button class="ghost-button" type="button" data-action="agent-delete" data-agent-slug="${escapeHtml(selectedAgent.slug)}">删除 Agent</button>
                      </div>
                    </div>
                    ${state.showAgentImportPanel ? renderAgentEditorForm(selectedAgent) : ''}
                    <section class="fig-card fig-card--subtle">
                      <div class="fig-card__head">
                        <h3>Metadata</h3>
                        <span>真实写入 agent_catalog_entries.metadata_json</span>
                      </div>
                      <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(selectedAgent.metadata || {}))}</textarea>
                    </section>
                  </div>
                `
                : renderAgentEditorForm(null)
            }
          </section>
        </div>
      </div>
    </div>
  `;
}

function renderSkillSyncSourceForm() {
  const source = state.skillSyncSources.find((item) => item.id === state.selectedSkillSyncSourceId) || null;
  const editable = source || {
    id: '',
    source_type: 'github_repo',
    source_key: '',
    display_name: '',
    source_url: '',
    config: {},
    active: true,
  };
  return `
    <section class="fig-card fig-card--subtle">
      <div class="fig-card__head">
        <h3>${source ? '编辑同步源' : '新增同步源'}</h3>
        <span>同步结果会直接灌入 cloud skill 主库，并在 portal 中保留运行记录。</span>
      </div>
      <form id="skill-sync-source-form" class="form-grid form-grid--two">
        <input type="hidden" name="id" value="${fieldValue(editable.id)}" />
        <label class="field">
          <span>Source Type</span>
          <select class="field-select" name="source_type">
            <option value="clawhub"${editable.source_type === 'clawhub' ? ' selected' : ''}>ClawHub</option>
            <option value="github_repo"${editable.source_type === 'github_repo' ? ' selected' : ''}>GitHub Repo</option>
          </select>
        </label>
        <label class="field">
          <span>Source Key</span>
          <input class="field-input" name="source_key" value="${fieldValue(editable.source_key)}" placeholder="github:owner/repo" />
        </label>
        <label class="field">
          <span>Display Name</span>
          <input class="field-input" name="display_name" value="${fieldValue(editable.display_name)}" placeholder="Claude Code Skills" />
        </label>
        <label class="field">
          <span>Source URL</span>
          <input class="field-input" name="source_url" value="${fieldValue(editable.source_url)}" placeholder="https://github.com/owner/repo" />
        </label>
        <label class="field">
          <span>状态</span>
          <select class="field-select" name="active">
            <option value="true"${editable.active !== false ? ' selected' : ''}>启用</option>
            <option value="false"${editable.active === false ? ' selected' : ''}>禁用</option>
          </select>
        </label>
        <div class="field field--wide">
          ${renderMetadataEntriesEditor({
            name: 'config_entries',
            title: 'Config',
            description: '同步源附加配置，支持点路径。',
            value: editable.config || {},
          })}
        </div>
        <div class="fig-form-actions">
          <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存同步源</button>
        </div>
      </form>
    </section>
  `;
}

function renderCloudSkillsPage() {
  const skills = [...state.cloudSkillCatalog];
  const meta = state.cloudSkillCatalogMeta || {};
  const selectedSkill = getCloudSkillCatalogEntry(state.selectedCloudSkillSlug) || skills[0] || null;
  const selectedSkillMetadata = selectedSkill && selectedSkill.metadata && typeof selectedSkill.metadata === 'object' ? selectedSkill.metadata : {};
  const selectedSkillSetupSchema =
    selectedSkillMetadata && typeof selectedSkillMetadata.setup_schema === 'object'
      ? selectedSkillMetadata.setup_schema
      : selectedSkillMetadata && typeof selectedSkillMetadata.setupSchema === 'object'
        ? selectedSkillMetadata.setupSchema
        : null;
  const selectedSkillRequiresConfig =
    Boolean(selectedSkillSetupSchema) ||
    (Array.isArray(selectedSkillMetadata.required_env) && selectedSkillMetadata.required_env.length > 0) ||
    (Array.isArray(selectedSkillMetadata.requiredEnv) && selectedSkillMetadata.requiredEnv.length > 0);
  const selectedSkillSourceLabel =
    typeof selectedSkillMetadata.source_label === 'string'
      ? selectedSkillMetadata.source_label
      : typeof selectedSkillMetadata.sourceLabel === 'string'
        ? selectedSkillMetadata.sourceLabel
        : typeof selectedSkillMetadata.provider === 'string'
          ? selectedSkillMetadata.provider
          : '未知';
  const selectedSource = state.skillSyncSources.find((item) => item.id === state.selectedSkillSyncSourceId) || state.skillSyncSources[0] || null;
  const runs = state.skillSyncRuns || [];
  const pageStart = skills.length ? Number(meta.offset || 0) + 1 : 0;
  const pageEnd = skills.length ? Number(meta.offset || 0) + skills.length : 0;

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>云技能</h1>
            <p class="fig-page__description">同步 ClawHub 和 GitHub 来源，直接维护技能商店主库。</p>
          </div>
          <div class="action-row">
            <button class="ghost-button" type="button" data-action="toggle-skill-sync-source-form">${state.showSkillSyncSourceForm ? '收起表单' : '新增同步源'}</button>
            ${selectedSource ? `<button class="solid-button fig-button" type="button" data-action="run-skill-sync" data-source-id="${escapeHtml(selectedSource.id)}"${state.busy ? ' disabled' : ''}>同步当前来源</button>` : ''}
          </div>
        </div>
      </div>
      <div class="page-stack">
        ${renderPageGuide('云技能怎么用', [
          '这里维护技能商店主库，支持从 ClawHub 或 GitHub 同步技能目录。',
          '先新增同步源，再执行同步，把技能灌入云技能主库。',
          '云技能入库后，可先加入“平台预装 Skill”子集，或直接去品牌管理做 OEM 增量装配。',
        ], 'cloud')}
        <section class="fig-card">
          <div class="fig-card__head">
            <h2>主库概览</h2>
            <span>技能商店直接读取这里的已上架技能</span>
          </div>
          <div class="fig-meta-cards">
            <div class="fig-meta-card"><span>云技能</span><strong>${escapeHtml(meta.total || 0)}</strong></div>
            <div class="fig-meta-card"><span>同步源</span><strong>${escapeHtml(state.skillSyncSources.length)}</strong></div>
            <div class="fig-meta-card"><span>同步记录</span><strong>${escapeHtml(runs.length)}</strong></div>
            <div class="fig-meta-card"><span>当前页</span><strong>${escapeHtml(skills.length ? `${pageStart}-${pageEnd}` : '0')}</strong></div>
          </div>
        </section>
        ${state.showSkillSyncSourceForm ? renderSkillSyncSourceForm() : ''}
        <div class="fig-layout">
          <aside class="fig-sidebar">
            <section class="fig-card fig-card--subtle">
              <div class="fig-card__head">
                <h3>同步源</h3>
                <span>${escapeHtml(state.skillSyncSources.length)} 个</span>
              </div>
              <div class="fig-capability-list">
                ${state.skillSyncSources.length
                  ? state.skillSyncSources
                      .map(
                        (item) => `
                          <button class="capability-card${selectedSource?.id === item.id ? ' is-active' : ''}" type="button" data-action="select-skill-sync-source" data-source-id="${escapeHtml(item.id)}">
                            <strong>${escapeHtml(item.display_name)}</strong>
                            <span>${escapeHtml(item.source_type)} • ${item.active ? '启用' : '禁用'}</span>
                          </button>
                        `,
                      )
                      .join('')
                  : `<div class="empty-state">还没有同步源。</div>`}
              </div>
            </section>
            <section class="fig-card fig-card--subtle">
              <div class="fig-card__head">
                <h3>云技能列表</h3>
                <span>${escapeHtml(meta.total || 0)} 个</span>
              </div>
              <div class="fig-toolbar">
                <label class="fig-search fig-search--grow">
                  ${icon('search', 'fig-search__icon')}
                  <input
                    class="field-input fig-search__input"
                    data-cloud-skill-query
                    placeholder="搜索 slug / 名称 / 分类 / 发布者 / 标签..."
                    value="${fieldValue(meta.query || '')}"
                  />
                </label>
                <button class="ghost-button" type="button" data-action="search-cloud-skills"${meta.loading ? ' disabled' : ''}>搜索</button>
                <button class="ghost-button" type="button" data-action="clear-cloud-skills"${meta.loading || !meta.query ? ' disabled' : ''}>清空</button>
                <button class="ghost-button" type="button" data-action="cloud-skills-prev-page"${meta.loading || Number(meta.offset || 0) <= 0 ? ' disabled' : ''}>上一页</button>
                <button class="ghost-button" type="button" data-action="cloud-skills-next-page"${meta.loading || meta.hasMore !== true ? ' disabled' : ''}>下一页</button>
              </div>
              <div class="fig-capability-list">
                ${meta.loading
                  ? `<div class="empty-state">正在加载云技能目录...</div>`
                  : skills.length
                  ? skills
                      .map(
                        (item) => `
                          <button class="capability-card${selectedSkill?.slug === item.slug ? ' is-active' : ''}" type="button" data-action="select-cloud-skill" data-skill-slug="${escapeHtml(item.slug)}">
                            <strong>${escapeHtml(item.name)}</strong>
                            <span>v${escapeHtml(item.version || '0.0.0')} • ${escapeHtml(item.origin_type || 'manual')}</span>
                          </button>
                        `,
                      )
                      .join('')
                  : `<div class="empty-state">没有匹配的云技能。</div>`}
              </div>
            </section>
          </aside>
          <section class="fig-capability-detail">
            ${selectedSkill
              ? `
                <div class="fig-detail-stack">
                  <div class="fig-card">
                    <div class="fig-card__head">
                      <div>
                        <h2>${escapeHtml(selectedSkill.name)}</h2>
                        <span>${escapeHtml(selectedSkill.slug)} · v${escapeHtml(selectedSkill.version || '0.0.0')}</span>
                      </div>
                      ${renderSwitch({
                        checked: selectedSkill.active !== false,
                        action: 'cloud-skill-toggle',
                        attrs: `data-skill-slug="${escapeHtml(selectedSkill.slug)}" data-enabled="${selectedSkill.active !== false ? 'true' : 'false'}"`,
                        label: selectedSkill.active !== false ? '已上架' : '已下架',
                      })}
                    </div>
                    <p class="detail-copy">${escapeHtml(selectedSkill.description || '暂无描述。')}</p>
                    <div class="fig-meta-cards">
                      <div class="fig-meta-card"><span>版本</span><strong>v${escapeHtml(selectedSkill.version || '0.0.0')}</strong></div>
                      <div class="fig-meta-card"><span>来源</span><strong>${escapeHtml(selectedSkill.origin_type || 'manual')}</strong></div>
                      <div class="fig-meta-card"><span>发布者</span><strong>${escapeHtml(selectedSkill.publisher || '未知')}</strong></div>
                      <div class="fig-meta-card"><span>安装配置</span><strong>${escapeHtml(selectedSkillRequiresConfig ? '需配置' : '免配置')}</strong></div>
                    </div>
                    <div class="chip-grid">
                      ${(selectedSkill.tags || []).length
                        ? selectedSkill.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join('')
                        : `<div class="empty-state">暂无标签。</div>`}
                    </div>
                    <div class="fig-meta-cards">
                      <div class="fig-meta-card"><span>来源标识</span><strong>${escapeHtml(selectedSkillSourceLabel)}</strong></div>
                      <div class="fig-meta-card"><span>平台预装建议</span><strong>${escapeHtml(selectedSkillRequiresConfig ? '不建议直接平台预装' : '可进平台级 Skill')}</strong></div>
                    </div>
                    <div class="action-row">
                      ${selectedSkill.source_url ? `<a class="text-button" href="${escapeHtml(selectedSkill.source_url)}" target="_blank" rel="noreferrer">查看来源</a>` : ''}
                      ${selectedSkill.artifact_url ? `<a class="text-button" href="${escapeHtml(selectedSkill.artifact_url)}" target="_blank" rel="noreferrer">查看 Artifact</a>` : ''}
                    </div>
                  </div>
                  <section class="fig-card fig-card--subtle">
                    <div class="fig-card__head">
                      <h3>同步元数据</h3>
                      <span>先完整爬取，后续按需消费</span>
                    </div>
                    <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(selectedSkill.metadata || {}))}</textarea>
                  </section>
                  <section class="fig-card fig-card--subtle">
                    <div class="fig-card__head">
                      <h3>最近同步记录</h3>
                      <span>${escapeHtml(runs.length)} 条</span>
                    </div>
                    <div class="fig-list">
                      ${runs.length
                        ? runs
                            .slice(0, 8)
                            .map(
                              (run) => `
                                <article class="fig-list-item">
                                  <div class="fig-list-item__body">
                                    <div class="fig-list-item__title">${escapeHtml(run.display_name)}</div>
                                    <div class="fig-list-item__meta">${escapeHtml(run.status)} • ${escapeHtml(formatDateTime(run.finished_at || run.started_at))}</div>
                                    <div class="fig-list-item__summary">${escapeHtml((run.items || []).slice(0, 3).map((item) => `${item.slug}@${item.version || 'n/a'}:${item.status}`).join(' / ') || '无结果')}</div>
                                  </div>
                                </article>
                              `,
                            )
                            .join('')
                        : `<div class="empty-state">还没有同步记录。</div>`}
                    </div>
                  </section>
                </div>
              `
              : `<div class="fig-card fig-card--detail-empty"><div class="empty-state">还没有云技能，先新增同步源并执行同步。</div></div>`}
          </section>
        </div>
      </div>
    </div>
  `;
}

function renderCloudMcpsPage() {
  const mcps = [...state.cloudMcpCatalog]
    .map((item) => {
      const key = String(item.key || item.mcpKey || '').trim();
      return {
        key,
        name: String(item.name || titleizeKey(key)).trim() || key,
        description: String(item.description || '').trim(),
        transport: String(item.transport || 'config').trim() || 'config',
        objectKey: String(item.object_key || item.objectKey || '').trim(),
        config: asObject(item.config),
        metadata: asObject(item.metadata),
        enabled: item.enabled !== false && item.active !== false,
      };
    })
    .filter((item) => item.key)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
  const selected =
    state.selectedCloudMcpKey === '__new__'
      ? {
          key: '',
          name: '',
          description: '',
          transport: 'config',
          objectKey: '',
          config: {},
          metadata: {},
          enabled: true,
        }
      : mcps.find((item) => item.key === state.selectedCloudMcpKey) || mcps[0] || null;
  const selectedConfig = asObject(selected?.config);
  const selectedEnv = asObject(selectedConfig.env);

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>云MCP</h1>
            <p class="fig-page__description">这里是 MCP 商店总库，也是 MCP 的唯一主数据来源。</p>
          </div>
          <div class="action-row">
            <button class="solid-button fig-button" type="button" data-action="new-cloud-mcp">
              ${icon('plus', 'button-icon')}
              新增云MCP
            </button>
          </div>
        </div>
      </div>
      ${renderPageGuide('云MCP怎么用', [
        '这里维护 cloud MCP 总库，MCP 商店直接读取这里。',
        '平台级 MCP 只是从云MCP里挑出来的预装子集；品牌页 MCP 只是 OEM 增量装配层。',
        '不要在平台级 MCP 页面维护 MCP 主数据，主数据统一在这里维护。',
      ], 'cloud')}
      <div class="fig-layout">
        <aside class="fig-sidebar">
          <section class="fig-card fig-card--subtle">
            <div class="fig-card__head">
              <h3>云MCP列表</h3>
              <span>${escapeHtml(mcps.length)} 个</span>
            </div>
            <div class="fig-capability-list">
              ${mcps.length
                ? mcps.map((item) => `
                    <button class="capability-card${selected && selected.key === item.key ? ' is-active' : ''}" type="button" data-action="select-cloud-mcp" data-mcp-key="${escapeHtml(item.key)}">
                      <strong>${escapeHtml(item.name)}</strong>
                      <span>${escapeHtml(item.transport)} • ${item.enabled ? '已启用' : '已关闭'}</span>
                    </button>
                  `).join('')
                : `<div class="empty-state">还没有云MCP。</div>`}
            </div>
          </section>
        </aside>
        <section class="fig-capability-detail">
          <div class="fig-detail-stack">
            <div class="fig-card">
              <div class="fig-card__head">
                <div>
                  <h2>${escapeHtml(selected?.name || '新建云MCP')}</h2>
                  <span>${escapeHtml(selected?.key || 'new-cloud-mcp')} · Cloud MCP Catalog</span>
                </div>
                <div class="metric-chips">
                  <span>${selected?.enabled === false ? '目录关闭' : '目录可用'}</span>
                  <span>${escapeHtml(selected?.transport || 'config')}</span>
                </div>
              </div>
              <p class="detail-copy">${escapeHtml(selected?.description || '维护 MCP 名称、描述、连接方式、启动参数、环境变量和扩展元数据。')}</p>
            </div>
            <form id="cloud-mcp-editor-form" class="fig-card fig-card--subtle">
              <div class="fig-card__head">
                <h3>云MCP主数据</h3>
                <span>这里维护 cloud MCP 的唯一真值。</span>
              </div>
              <div class="form-grid form-grid--two">
                <label class="field">
                  <span>Key</span>
                  <input class="field-input" name="key" value="${fieldValue(selected?.key || '')}" placeholder="browser / yahoo-finance" ${selected?.key ? 'readonly' : ''} />
                </label>
                <label class="field">
                  <span>Name</span>
                  <input class="field-input" name="name" value="${fieldValue(selected?.name || '')}" placeholder="Browser" />
                </label>
                <label class="field field--wide">
                  <span>Description</span>
                  <textarea class="field-textarea" name="description">${escapeHtml(selected?.description || '')}</textarea>
                </label>
                <label class="field">
                  <span>默认状态</span>
                  <select class="field-select" name="enabled">
                    <option value="true"${selected?.enabled === false ? '' : ' selected'}>可用</option>
                    <option value="false"${selected?.enabled === false ? ' selected' : ''}>关闭</option>
                  </select>
                </label>
                <label class="field">
                  <span>Transport</span>
                  <input class="field-input" name="transport" value="${fieldValue(selected?.transport || 'config')}" placeholder="stdio / http / config" />
                </label>
                <label class="field">
                  <span>Command</span>
                  <input class="field-input" name="command" value="${fieldValue(selectedConfig.command)}" placeholder="uvx / npx / node" />
                </label>
                <label class="field field--wide">
                  <span>Args</span>
                  <textarea class="field-textarea" name="args_text" placeholder="每行一个参数">${escapeHtml(asArray(selectedConfig.args).map((item) => String(item || '')).join('\n'))}</textarea>
                </label>
                <label class="field field--wide">
                  <span>HTTP URL</span>
                  <input class="field-input" name="http_url" value="${fieldValue(selectedConfig.http_url || selectedConfig.httpUrl)}" placeholder="http://127.0.0.1:4010/mcp" />
                </label>
                <label class="field field--wide">
                  <span>Env</span>
                  <textarea class="field-textarea" name="env_text" placeholder="KEY=value">${escapeHtml(formatEnvPairs(selectedEnv))}</textarea>
                </label>
                <label class="field">
                  <span>Object Key</span>
                  <input class="field-input" name="object_key" value="${fieldValue(selected?.objectKey || '')}" placeholder="minio://mcps/key.json" />
                </label>
                <div class="field field--wide">
                  ${renderMetadataEntriesEditor({
                    name: 'cloud_mcp_metadata_entries',
                    title: 'Metadata',
                    description: 'Cloud MCP 附加字段，支持点路径。',
                    value: selected?.metadata || {},
                  })}
                </div>
              </div>
              <div class="action-row">
                <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存云MCP</button>
                <button class="ghost-button" type="button" data-action="cloud-mcp-test" data-mcp-key="${escapeHtml(selected?.key || '')}"${state.busy ? ' disabled' : ''}>测试连接</button>
                ${selected?.key ? `<button class="ghost-button" type="button" data-action="cloud-mcp-delete" data-mcp-key="${escapeHtml(selected.key)}"${state.busy ? ' disabled' : ''}>删除云MCP</button>` : ''}
                ${selected?.key ? `<button class="ghost-button" type="button" data-action="navigate" data-page="mcp-center">查看平台级 MCP</button>` : ''}
              </div>
              ${
                state.mcpTestResult
                  ? `<div class="banner ${state.mcpTestResult.ok ? 'banner--success' : 'banner--error'}">测试结果: ${escapeHtml(state.mcpTestResult.message || '未返回消息')}</div>`
                  : ''
              }
            </form>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderPlatformSkillAddPanel() {
  const knownCloudSkills = [...state.cloudSkillCatalog]
    .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN'))
    .slice(0, 80);
  return `
    <section class="fig-card fig-card--subtle">
      <div class="fig-card__head">
        <h3>从云技能加入平台预装 Skill</h3>
        <span>这里只创建 <code>platform_bundled_skill</code> 绑定；真实全集仍在“云技能”。</span>
      </div>
      <form id="platform-skill-add-form" class="form-grid form-grid--two">
        <label class="field">
          <span>Cloud Skill Slug</span>
          <input class="field-input" name="slug" list="platform-skill-cloud-options" placeholder="输入云技能 slug" />
          <datalist id="platform-skill-cloud-options">
            ${knownCloudSkills.map((item) => `<option value="${escapeHtml(item.slug)}">${escapeHtml(item.name)}</option>`).join('')}
          </datalist>
        </label>
        <div class="field">
          <span>说明</span>
          <small style="display:block;line-height:1.7;color:var(--text-secondary);">
            输入云技能 slug 后保存，系统会从云技能全集读取该 skill，并把它加入平台预装子集。
          </small>
        </div>
        <div class="fig-form-actions">
          <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>加入平台预装</button>
        </div>
      </form>
    </section>
  `;
}

function renderSkillImportPanel() {
  const skill = state.selectedSkillSlug === '__new__'
    ? null
    : getMergedSkills().find((item) => item.slug === state.selectedSkillSlug) || null;
  return `
    <section class="fig-card fig-card--subtle">
      <div class="fig-card__head">
        <h3>${skill ? '编辑平台预装 Skill 绑定' : '新增平台预装 Skill 绑定'}</h3>
        <span>平台页只维护 bundled binding；名称、描述、版本等主数据属于云技能总库。</span>
      </div>
      <form id="skill-import-form" class="form-grid">
        <label class="field">
          <span>Slug</span>
          <input class="field-input" name="slug" placeholder="cloud-skill-slug" value="${fieldValue(skill?.slug)}" ${skill ? 'readonly' : ''} />
        </label>
        <div class="fig-meta-cards">
          <div class="fig-meta-card"><span>名称</span><strong>${escapeHtml(skill?.name || '-')}</strong></div>
          <div class="fig-meta-card"><span>发布者</span><strong>${escapeHtml(skill?.publisher || 'iClaw')}</strong></div>
          <div class="fig-meta-card"><span>分类</span><strong>${escapeHtml(skill?.category || '未分类')}</strong></div>
          <div class="fig-meta-card"><span>版本</span><strong>${escapeHtml(skill?.version || '-')}</strong></div>
        </div>
        <div class="fig-card__section-copy">
          <p>云技能主数据请在“云技能”页维护；这里仅控制平台预装层的启停和 binding metadata。</p>
        </div>
        <label class="field">
          <span>平台预装状态</span>
          <select class="field-select" name="active">
            <option value="true"${skill?.active !== false ? ' selected' : ''}>上架</option>
            <option value="false"${skill?.active === false ? ' selected' : ''}>下架</option>
          </select>
        </label>
        <div class="field field--wide">
          ${renderMetadataEntriesEditor({
            name: 'metadata_entries',
            title: 'Metadata',
            description: '平台预装 Skill binding 的附加字段。',
            value: skill?.metadata || {},
          })}
        </div>
        <div class="fig-form-actions">
          <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存 Skill</button>
        </div>
      </form>
    </section>
  `;
}

function renderSkillDetail(skill) {
  if (!skill) {
    return `${state.showPlatformSkillAddPanel ? renderPlatformSkillAddPanel() : ''}${state.showSkillImportPanel ? renderSkillImportPanel() : ''}<div class="fig-card fig-card--detail-empty"><div class="empty-state">选择一个平台预装 Skill 查看详情，或先从云技能全集加入。</div></div>`;
  }
  return `
    <div class="fig-detail-stack">
      ${state.showPlatformSkillAddPanel ? renderPlatformSkillAddPanel() : ''}
      <div class="fig-card">
        <div class="fig-card__head">
          <div>
            <h2>${escapeHtml(skill.name)}</h2>
            <span>${escapeHtml(skill.slug)} · ${escapeHtml(skill.publisher || 'iClaw')} · 平台预装 Skill</span>
          </div>
          ${renderSwitch({
            checked: skill.active !== false,
            action: 'skill-toggle',
            attrs: `data-skill-slug="${escapeHtml(skill.slug)}" data-enabled="${skill.active !== false ? 'true' : 'false'}"`,
            label: skill.active !== false ? '已上架' : '已下架',
          })}
        </div>
        <p class="detail-copy">${escapeHtml(skill.description || '暂无描述。')}</p>
        <div class="fig-meta-cards">
          <div class="fig-meta-card"><span>分类</span><strong>${escapeHtml(skill.category || '未分类')}</strong></div>
          <div class="fig-meta-card"><span>来源</span><strong>${escapeHtml(skill.distribution === 'bundled' ? '云总库 / 预置' : '云总库')}</strong></div>
          <div class="fig-meta-card"><span>版本</span><strong>${escapeHtml(skill.version || '-')}</strong></div>
          <div class="fig-meta-card"><span>生效 OEM</span><strong>${escapeHtml(skill.brand_count)}</strong></div>
        </div>
        <div class="action-row">
          <button class="ghost-button" type="button" data-action="skill-delete" data-skill-slug="${escapeHtml(skill.slug)}">移出平台预装</button>
          <button class="text-button" type="button" data-action="toggle-skill-import">${state.showSkillImportPanel ? '收起编辑面板' : '编辑 bundled 绑定'}</button>
        </div>
      </div>
      <section class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>品牌访问权限</h3>
          <span>${escapeHtml(capabilityBindingCountLabel('skill', skill.brand_count))}</span>
        </div>
        <div class="chip-grid">
        ${(skill.connectedBrands || []).length
          ? skill.connectedBrands
              .map(
                (brand) => `
                  <button class="chip chip--interactive" type="button" data-action="select-brand" data-brand-id="${escapeHtml(brand.brand_id)}">
                    ${escapeHtml(brand.display_name)}
                  </button>
                `,
              )
              .join('')
          : `<div class="empty-state">${capabilityBindingEmptyLabel('skill')}</div>`}
        </div>
      </section>
      ${renderCapabilityBrandMatrix('skill', skill)}
      ${state.showSkillImportPanel ? renderSkillImportPanel() : ''}
    </div>
  `;
}

function renderPlatformMcpAddPanel() {
  const knownMcps = [...state.cloudMcpCatalog]
    .map((item) => ({
      key: String(item.key || item.mcpKey || '').trim(),
      name: String(item.name || '').trim(),
    }))
    .filter((item) => item.key)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
    .slice(0, 120);
  return `
    <section class="fig-card fig-card--subtle">
      <div class="fig-card__head">
        <h3>从云MCP加入平台级 MCP</h3>
        <span>这里只创建 <code>platform_bundled_mcps</code> 绑定；真实全集仍在“云MCP”。</span>
      </div>
      <form id="platform-mcp-add-form" class="form-grid form-grid--two">
        <label class="field">
          <span>Cloud MCP Key</span>
          <input class="field-input" name="key" list="platform-mcp-cloud-options" placeholder="输入 MCP key" />
          <datalist id="platform-mcp-cloud-options">
            ${knownMcps.map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.name)}</option>`).join('')}
          </datalist>
        </label>
        <div class="field">
          <span>说明</span>
          <small style="display:block;line-height:1.7;color:var(--text-secondary);">
            输入云MCP key 后保存，系统会从云MCP总库读取该记录，并把它加入平台级 MCP 子集。
          </small>
        </div>
        <div class="fig-form-actions">
          <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>加入平台级 MCP</button>
        </div>
      </form>
    </section>
  `;
}

function renderMcpDetail(server) {
  if (!server) {
    return `
      <div class="fig-detail-stack">
        ${state.showPlatformMcpAddPanel ? renderPlatformMcpAddPanel() : ''}
        <div class="fig-card fig-card--detail-empty"><div class="empty-state">选择一个平台级 MCP 查看详情，或先从云MCP加入。</div></div>
      </div>
    `;
  }
  return `
    <div class="fig-detail-stack">
      ${state.showPlatformMcpAddPanel ? renderPlatformMcpAddPanel() : ''}
      <div class="fig-card">
        <div class="fig-card__head">
          <div>
            <h2>${escapeHtml(server.name)}</h2>
            <span>${escapeHtml(server.key)} · 平台级 MCP</span>
          </div>
          <div class="metric-chips">
            <span>${escapeHtml(server.connected_brand_count)} 个 OEM 生效</span>
            <span>${server.enabled_by_default ? '目录可用' : '目录关闭'}</span>
          </div>
        </div>
        <p class="detail-copy">${escapeHtml(server.description || '暂无描述。')}</p>
        <div class="fig-meta-cards">
          <div class="fig-meta-card"><span>Transport</span><strong>${escapeHtml(server.transport || 'config')}</strong></div>
          <div class="fig-meta-card"><span>Command</span><strong>${escapeHtml(server.command || '未声明')}</strong></div>
          <div class="fig-meta-card"><span>HTTP URL</span><strong>${escapeHtml(server.http_url || '未声明')}</strong></div>
          <div class="fig-meta-card"><span>环境变量</span><strong>${escapeHtml((server.env_keys || []).length)}</strong></div>
        </div>
      </div>
      <form id="mcp-editor-form" class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>平台级 MCP 绑定</h3>
          <span>这里只维护 platform bundled binding；MCP 主数据请到“云MCP”维护。</span>
        </div>
        <div class="form-grid">
          <label class="field">
            <span>Key</span>
            <input class="field-input" name="key" value="${fieldValue(server.key)}" readonly />
          </label>
          <label class="field">
            <span>平台预装状态</span>
            <select class="field-select" name="enabled">
              <option value="true"${server.enabled_by_default ? ' selected' : ''}>上架</option>
              <option value="false"${server.enabled_by_default ? '' : ' selected'}>下架</option>
            </select>
          </label>
          <div class="field field--wide">
            ${renderMetadataEntriesEditor({
              name: 'metadata_entries',
              title: 'Metadata',
              description: '平台级 MCP binding 的附加字段。',
              value: asObject(server.metadata),
            })}
          </div>
        </div>
        <div class="action-row">
          <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存平台级 MCP</button>
          <button class="ghost-button" type="button" data-action="mcp-delete" data-mcp-key="${escapeHtml(server.key)}"${state.busy ? ' disabled' : ''}>移出平台级 MCP</button>
          <button class="ghost-button" type="button" data-action="navigate" data-page="cloud-mcps">查看云MCP主数据</button>
        </div>
      </form>
      <section class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>品牌连接图</h3>
          <span>真实来自各品牌 capabilities.mcp_servers</span>
        </div>
        <div class="chip-grid">
          ${(server.connected_brands || []).length
            ? server.connected_brands
                .map(
                  (brand) => `
                    <button class="chip chip--interactive" type="button" data-action="select-brand" data-brand-id="${escapeHtml(brand.brand_id)}">
                      ${escapeHtml(brand.display_name)}
                    </button>
                  `,
                )
                .join('')
            : `<div class="empty-state">${capabilityBindingEmptyLabel('mcp')}</div>`}
        </div>
      </section>
      ${renderCapabilityBrandMatrix('mcp', server)}
    </div>
  `;
}

function renderModelDetail(model) {
  if (!model) {
    model = {
      ref: '',
      label: '新建模型',
      providerId: 'openai',
      modelId: '',
      api: 'openai-completions',
      baseUrl: '',
      useRuntimeOpenai: true,
      authHeader: true,
      reasoning: true,
      input: ['text'],
      contextWindow: 0,
      maxTokens: 0,
      metadata: {},
      connected_brand_count: 0,
      connectedBrands: [],
      active: true,
    };
  }
  const isNew = !model.ref;
  return `
    <div class="fig-detail-stack">
      <div class="fig-card">
        <div class="fig-card__head">
          <div>
            <h2>${escapeHtml(model.label)}</h2>
            <span>${escapeHtml(model.ref || 'new-model')} · ${escapeHtml(model.providerId || 'provider')}</span>
          </div>
          ${!isNew
            ? renderSwitch({
                checked: model.active !== false,
                action: 'model-toggle',
                attrs: `data-model-ref="${escapeHtml(model.ref)}" data-enabled="${model.active !== false ? 'true' : 'false'}"`,
                label: model.active !== false ? '已启用' : '已禁用',
              })
            : ''}
        </div>
        <div class="fig-meta-cards">
          <div class="fig-meta-card"><span>Provider</span><strong>${escapeHtml(model.providerId || '未设置')}</strong></div>
          <div class="fig-meta-card"><span>Model ID</span><strong>${escapeHtml(model.modelId || '未设置')}</strong></div>
          <div class="fig-meta-card"><span>OEM 使用数</span><strong>${escapeHtml(model.connected_brand_count || 0)}</strong></div>
        </div>
      </div>
      <form id="model-editor-form" class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>模型目录</h3>
          <span>主数据统一维护在 portal model catalog，OEM 侧只做勾选和装配</span>
        </div>
        <div class="form-grid form-grid--two">
          <label class="field">
            <span>Ref</span>
            <input class="field-input" name="ref" value="${fieldValue(model.ref)}" placeholder="provider/model" ${isNew ? '' : 'readonly'} />
          </label>
          <label class="field">
            <span>Label</span>
            <input class="field-input" name="label" value="${fieldValue(model.label)}" placeholder="显示名称" />
          </label>
          <label class="field">
            <span>Provider ID</span>
            <input class="field-input" name="provider_id" value="${fieldValue(model.providerId)}" placeholder="openai / deepseek" />
          </label>
          <label class="field">
            <span>Model ID</span>
            <input class="field-input" name="model_id" value="${fieldValue(model.modelId)}" placeholder="qwen3.5-plus" />
          </label>
          <label class="field">
            <span>API</span>
            <input class="field-input" name="api" value="${fieldValue(model.api || 'openai-completions')}" placeholder="openai-completions" />
          </label>
          <label class="field">
            <span>Base URL</span>
            <input class="field-input" name="base_url" value="${fieldValue(model.baseUrl || '')}" placeholder="https://api.example.com/v1" />
          </label>
          <label class="field">
            <span>Use Runtime OpenAI</span>
            <select class="field-select" name="use_runtime_openai">
              <option value="true"${model.useRuntimeOpenai !== false ? ' selected' : ''}>true</option>
              <option value="false"${model.useRuntimeOpenai === false ? ' selected' : ''}>false</option>
            </select>
          </label>
          <label class="field">
            <span>Auth Header</span>
            <select class="field-select" name="auth_header">
              <option value="true"${model.authHeader !== false ? ' selected' : ''}>true</option>
              <option value="false"${model.authHeader === false ? ' selected' : ''}>false</option>
            </select>
          </label>
          <label class="field">
            <span>Reasoning</span>
            <select class="field-select" name="reasoning">
              <option value="true"${model.reasoning === true ? ' selected' : ''}>true</option>
              <option value="false"${model.reasoning === true ? '' : ' selected'}>false</option>
            </select>
          </label>
          <label class="field">
            <span>状态</span>
            <select class="field-select" name="enabled">
              <option value="true"${model.active !== false ? ' selected' : ''}>启用</option>
              <option value="false"${model.active === false ? ' selected' : ''}>禁用</option>
            </select>
          </label>
          <label class="field field--wide">
            <span>Input Modalities</span>
            <textarea class="field-textarea" name="input_text" placeholder="每行一个，如 text / image">${escapeHtml((model.input || []).join('\n'))}</textarea>
          </label>
          <label class="field">
            <span>Context Window</span>
            <input class="field-input" name="context_window" type="number" min="0" value="${fieldValue(model.contextWindow || 0)}" />
          </label>
          <label class="field">
            <span>Max Tokens</span>
            <input class="field-input" name="max_tokens" type="number" min="0" value="${fieldValue(model.maxTokens || 0)}" />
          </label>
          <div class="field field--wide">
            ${renderMetadataEntriesEditor({
              name: 'metadata_entries',
              title: 'Metadata',
              description: '模型附加字段，支持点路径。',
              value: model.metadata || {},
            })}
          </div>
        </div>
        <div class="action-row">
          <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存模型</button>
          ${isNew ? '' : `<button class="ghost-button" type="button" data-action="model-delete" data-model-ref="${escapeHtml(model.ref)}"${state.busy ? ' disabled' : ''}>删除模型</button>`}
        </div>
      </form>
      <section class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>品牌访问权限</h3>
          <span>${escapeHtml(model.connected_brand_count || 0)} 个 OEM 已启用</span>
        </div>
        <div class="chip-grid">
          ${(model.connectedBrands || []).length
            ? model.connectedBrands
                .map(
                  (brand) => `
                    <button class="chip chip--interactive" type="button" data-action="select-brand" data-brand-id="${escapeHtml(brand.brand_id)}">
                      ${escapeHtml(brand.display_name)}
                    </button>
                  `,
                )
                .join('')
            : `<div class="empty-state">当前没有 OEM 绑定此模型。</div>`}
        </div>
      </section>
      ${renderCapabilityBrandMatrix('model', model)}
    </div>
  `;
}

function renderCapabilityBrandMatrix(type, item) {
  const brands = state.capabilities?.brands || [];
  const connectedIds = new Set(
    (type === 'skill' || type === 'model' ? item.connectedBrands : item.connected_brands || []).map((brand) => brand.brand_id),
  );
  return `
    <section class="fig-card fig-card--subtle">
      <div class="fig-card__head">
        <h3>${type === 'skill' ? 'Skill / Brand Matrix' : type === 'model' ? 'Model / Brand Matrix' : 'MCP / Brand Matrix'}</h3>
        <span>按品牌查看能力开放范围</span>
      </div>
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>品牌</th>
              <th>状态</th>
              <th>${type === 'skill' || type === 'mcp' ? '已安装' : '已连接'}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${brands
              .map(
                (brand) => `
                  <tr>
                    <td>${escapeHtml(brand.displayName)}</td>
                    <td>${statusBadge(brand.status)}</td>
                    <td>${connectedIds.has(brand.brandId) ? '是' : '否'}</td>
                    <td>
                      <button class="table-link" type="button" data-action="select-brand" data-brand-id="${escapeHtml(brand.brandId)}">
                        打开品牌
                      </button>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function getFilteredAssets() {
  const query = state.filters.assetQuery.trim().toLowerCase();
  return state.assets.filter((item) => {
    if (state.filters.assetBrand !== 'all' && item.brandId !== state.filters.assetBrand) {
      return false;
    }
    const kind = String(item.metadata?.kind || '').trim();
    if (state.filters.assetKind !== 'all' && kind !== state.filters.assetKind) {
      return false;
    }
    if (!query) return true;
    return [item.assetKey, item.brandDisplayName, item.objectKey, item.contentType, kind].some((value) =>
      String(value || '').toLowerCase().includes(query),
    );
  });
}

function renderAssetsPage() {
  const items = getFilteredAssets();
  const kinds = Array.from(
    new Set(state.assets.map((item) => String(item.metadata?.kind || '').trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const typeTabs = ['all', ...kinds];

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner fig-page__header-inner--stack">
          <div class="fig-page__header-row">
            <div>
              <h1>资源管理</h1>
              <p class="fig-page__description">品牌资源库，真实读写 portal assets 和 MinIO</p>
            </div>
            <button class="solid-button fig-button" type="button" data-action="toggle-asset-upload">
              ${icon('plus', 'button-icon')}
              上传资源
            </button>
          </div>
          <div class="fig-toolbar">
            <label class="fig-search">
              ${icon('search', 'fig-search__icon')}
              <input class="field-input fig-search__input" data-filter-key="assetQuery" placeholder="搜索资源..." value="${fieldValue(state.filters.assetQuery)}" />
            </label>
            <select class="field-select fig-filter" data-filter-key="assetBrand">
              <option value="all">全部品牌</option>
              ${state.brands
                .map(
                  (brand) => `
                    <option value="${escapeHtml(brand.brandId)}"${state.filters.assetBrand === brand.brandId ? ' selected' : ''}>${escapeHtml(brand.displayName)}</option>
                  `,
                )
                .join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="fig-page__body">
        ${renderPageGuide('资源管理怎么用', [
          '这里是所有品牌的统一资源库，可上传 logo、favicon、hero 图等素材。',
          '资源上传时要填写稳定的 asset key，前端按这个 key 取图。',
          '资源本身入库后，若品牌端要正式切换，通常还需要对应品牌再发布快照。',
        ], 'assets')}
        ${
          state.showAssetUploadPanel
            ? `
              <section class="fig-card fig-create-panel">
                <div class="fig-card__head">
                  <h3>上传资源</h3>
                  <button class="text-button" type="button" data-action="toggle-asset-upload">收起</button>
                </div>
                <form id="asset-form" class="form-grid form-grid--two">
                  <label class="field">
                    <span>App</span>
                    <select class="field-select" name="brand_id">
                      ${state.brands
                        .map(
                          (brand) => `
                            <option value="${escapeHtml(brand.brandId)}"${state.selectedBrandId === brand.brandId ? ' selected' : ''}>${escapeHtml(brand.displayName)}</option>
                          `,
                        )
                        .join('')}
                    </select>
                  </label>
                  <label class="field">
                    <span>Asset Key</span>
                    <input class="field-input" name="asset_key" placeholder="logoMaster" />
                  </label>
                  <label class="field">
                    <span>类型</span>
                    <input class="field-input" name="kind" placeholder="logo / favicon / hero" />
                  </label>
                  <label class="field">
                    <span>上传文件</span>
                    <input class="field-input" name="file" type="file" />
                  </label>
                  <div class="field field--wide">
                    ${renderMetadataEntriesEditor({
                      name: 'metadata_entries',
                      title: '资源 Metadata',
                      description: '可选。按字段路径补充资源附加信息。',
                      value: {},
                    })}
                  </div>
                  <div class="fig-form-actions">
                    <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>上传并登记</button>
                  </div>
                </form>
              </section>
            `
            : ''
        }
        <div class="fig-type-tabs">
          ${typeTabs
            .map(
              (kind) => `
                <button class="fig-type-tab${state.filters.assetKind === kind ? ' is-active' : ''}" type="button" data-action="set-asset-kind" data-kind="${escapeHtml(kind)}">
                  ${escapeHtml(kind === 'all' ? '全部' : kind)}
                </button>
              `,
            )
            .join('')}
        </div>
        <section class="fig-assets-grid">
          ${items.length
            ? items
                .map(
                  (item) => `
                    <article class="fig-asset-card">
                      <div class="fig-asset-card__preview">
                        ${
                          isImageLike(item.contentType, item.publicUrl, item.objectKey)
                            ? `<img class="fig-asset-card__image" src="${escapeHtml(resolveAssetUrl(item))}" alt="${escapeHtml(item.assetKey)}" />`
                            : `<div class="asset-thumb asset-thumb--placeholder">${escapeHtml((item.assetKey || 'AS').slice(0, 2).toUpperCase())}</div>`
                        }
                      </div>
                      <div class="fig-asset-card__body">
                        <div class="fig-asset-card__title">${escapeHtml(item.assetKey)}</div>
                        <div class="fig-asset-card__meta">${escapeHtml(String(item.metadata?.kind || 'asset'))} • ${escapeHtml(item.storageProvider || 's3')}</div>
                        <div class="fig-asset-card__brand">${escapeHtml(item.brandDisplayName || item.brandId)}</div>
                        <div class="fig-asset-card__actions">
                          <button class="text-button" type="button" data-action="select-brand" data-brand-id="${escapeHtml(item.brandId)}">打开品牌</button>
                          ${
                            item.publicUrl || item.objectKey
                              ? `<a class="text-link" href="${escapeHtml(resolveAssetUrl(item))}" target="_blank" rel="noreferrer">打开资源</a>`
                              : ''
                          }
                          <button class="text-button" type="button" data-action="delete-asset" data-brand-id="${escapeHtml(item.brandId)}" data-asset-key="${escapeHtml(item.assetKey)}">删除</button>
                        </div>
                      </div>
                    </article>
                  `,
                )
                .join('')
            : `<div class="empty-state empty-state--panel">没有匹配的资源。</div>`}
        </section>
      </div>
    </div>
  `;
}

function getFilteredReleases() {
  return state.releases.filter((item) => {
    if (state.filters.releaseBrand !== 'all' && item.brand_id !== state.filters.releaseBrand) {
      return false;
    }
    return true;
  });
}

function renderRuntimeManagementPage() {
  const selectedSection = ['release', 'binding', 'history'].includes(state.selectedRuntimeSection)
    ? state.selectedRuntimeSection
    : 'release';
  const selectedRelease =
    state.selectedRuntimeReleaseId === '__new__'
      ? null
      : state.runtimeReleases.find((item) => item.id === state.selectedRuntimeReleaseId) || state.runtimeReleases[0] || null;
  const selectedBinding =
    state.selectedRuntimeBindingId === '__new__'
      ? null
      : state.runtimeBindings.find((item) => item.id === state.selectedRuntimeBindingId) || state.runtimeBindings[0] || null;
  const releaseDraft = state.runtimeReleaseDraftBuffer || buildRuntimeReleaseDraft(selectedRelease);
  const bindingDraft = state.runtimeBindingDraftBuffer || buildRuntimeBindingDraft(selectedBinding);
  const releaseOptions = state.runtimeReleases
    .filter((item) => item.status === 'published' || item.id === bindingDraft.releaseId)
    .map((item) => ({
      id: item.id,
      label: `${item.version} · ${item.channel} · ${formatRuntimeTargetLabel(item.platform, item.arch)}`,
    }));
  const runtimeBootstrapSource = state.runtimeBootstrapSource && typeof state.runtimeBootstrapSource === 'object'
    ? state.runtimeBootstrapSource
    : null;
  const historyItems = selectedBinding
    ? state.runtimeBindingHistory.filter((item) => item.bindingId === selectedBinding.id)
    : state.runtimeBindingHistory;

  const renderReleaseList = () =>
    state.runtimeReleases.length
      ? state.runtimeReleases
          .map((item) => {
            const isActive = item.id === (selectedRelease?.id || '');
            return `
              <button class="fig-list-item" type="button" data-action="select-runtime-release" data-release-id="${escapeHtml(item.id)}"${isActive ? ' style="background:color-mix(in srgb, var(--card-subtle) 88%, transparent);border-radius:14px;padding:14px;"' : ''}>
                <div style="text-align:left; width:100%;">
                  <div class="fig-list-item__title">${escapeHtml(item.version)} · ${escapeHtml(item.channel)}</div>
                  <div class="fig-list-item__body">${escapeHtml(formatRuntimeTargetLabel(item.platform, item.arch))}</div>
                  <div class="fig-list-item__meta">
                    ${statusBadge(item.status)}
                    <span>${escapeHtml(item.runtimeKind)}</span>
                    <span>${escapeHtml(formatDateTime(item.updatedAt))}</span>
                  </div>
                </div>
              </button>
            `;
          })
          .join('')
      : `<div class="empty-state empty-state--panel">还没有 runtime release。</div>`;

  const renderBindingList = () =>
    state.runtimeBindings.length
      ? state.runtimeBindings
          .map((item) => {
            const isActive = item.id === (selectedBinding?.id || '');
            const matchedRelease = state.runtimeReleases.find((release) => release.id === item.releaseId) || null;
            const scopeLabel = item.scopeType === 'platform' ? '平台' : item.scopeKey;
            return `
              <button class="fig-list-item" type="button" data-action="select-runtime-binding" data-binding-id="${escapeHtml(item.id)}"${isActive ? ' style="background:color-mix(in srgb, var(--card-subtle) 88%, transparent);border-radius:14px;padding:14px;"' : ''}>
                <div style="text-align:left; width:100%;">
                  <div class="fig-list-item__title">${escapeHtml(scopeLabel)} · ${escapeHtml(item.channel)} · ${escapeHtml(formatRuntimeTargetLabel(item.platform, item.arch))}</div>
                  <div class="fig-list-item__body">${escapeHtml(matchedRelease?.version || item.releaseId)}</div>
                  <div class="fig-list-item__meta">
                    ${statusBadge(item.enabled === false ? 'disabled' : 'active')}
                    <span>${escapeHtml(item.runtimeKind)}</span>
                    <span>${escapeHtml(formatDateTime(item.updatedAt))}</span>
                  </div>
                </div>
              </button>
            `;
          })
          .join('')
      : `<div class="empty-state empty-state--panel">还没有 runtime binding。</div>`;

  const renderBootstrapArtifactList = () =>
    Array.isArray(runtimeBootstrapSource?.artifacts) && runtimeBootstrapSource.artifacts.length
      ? runtimeBootstrapSource.artifacts
          .map(
            (item) => `
              <div class="fig-list-item">
                <div style="width:100%;">
                  <div class="fig-list-item__title">${escapeHtml(item.targetTriple)} · ${escapeHtml(formatRuntimeTargetLabel(item.platform, item.arch))}</div>
                  <div class="fig-list-item__body" style="word-break:break-all;">${escapeHtml(item.artifactUrl)}</div>
                  <div class="fig-list-item__meta">
                    <span>${escapeHtml(item.artifactFormat || 'tar.gz')}</span>
                    <span>${escapeHtml(item.objectKey || 'object_key 未解析')}</span>
                  </div>
                </div>
              </div>
            `,
          )
          .join('')
      : `<div class="empty-state empty-state--panel">当前 legacy runtime bootstrap 没有可导入 artifact。</div>`;

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>Runtime包管理</h1>
            <p class="fig-page__description">独立管理 runtime 包发布、平台/OEM 绑定关系，以及历史切换记录。</p>
          </div>
        </div>
      </div>
      <div class="fig-page__body">
        ${renderPageGuide('Runtime包管理怎么用', [
          'Release 负责登记每个 runtime 包的版本、平台、下载地址和构建信息。',
          'Binding 负责把平台或某个 OEM 应用绑定到一个已发布的 runtime release。',
          'History 只做审计追踪，方便回溯当前版本到底从哪次切换生效。',
        ], 'releases')}
        <section class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>配置视图</h3>
            <span>Release / Binding / History</span>
          </div>
          <div class="segmented">
            <button class="tab-pill${selectedSection === 'release' ? ' is-active' : ''}" type="button" data-action="select-runtime-section" data-runtime-section="release">Release</button>
            <button class="tab-pill${selectedSection === 'binding' ? ' is-active' : ''}" type="button" data-action="select-runtime-section" data-runtime-section="binding">Binding</button>
            <button class="tab-pill${selectedSection === 'history' ? ' is-active' : ''}" type="button" data-action="select-runtime-section" data-runtime-section="history">History</button>
          </div>
        </section>
        <div class="fig-detail-stack"${selectedSection !== 'release' ? ' style="display:none;"' : ''}>
          <section class="fig-card fig-card--subtle">
            <div class="fig-card__head">
              <div>
                <h3>Legacy Runtime Bootstrap</h3>
                <span>兼容当前已经在 S3 上的 runtime 包</span>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="ghost-button" type="button" data-action="refresh-runtime-bootstrap"${state.busy ? ' disabled' : ''}>刷新源预览</button>
                <button class="ghost-button" type="button" data-action="import-runtime-bootstrap"${state.busy ? ' disabled' : ''}>${state.busy ? '导入中…' : '导入到 Runtime Center'}</button>
              </div>
            </div>
            <div class="fig-meta-cards">
              <div class="fig-meta-card">
                <span>Source Path</span>
                <strong>${escapeHtml(runtimeBootstrapSource?.sourcePath || '未找到')}</strong>
              </div>
              <div class="fig-meta-card">
                <span>Version</span>
                <strong>${escapeHtml(runtimeBootstrapSource?.version || '未找到')}</strong>
              </div>
              <div class="fig-meta-card">
                <span>Artifacts</span>
                <strong>${escapeHtml(String(runtimeBootstrapSource?.artifacts?.length || 0))}</strong>
              </div>
            </div>
            <div class="fig-toolbar">
              <label class="field">
                <span>导入到哪个 Channel</span>
                <select class="field-select" data-state-key="selectedRuntimeImportChannel">
                  <option value="prod"${state.selectedRuntimeImportChannel === 'prod' ? ' selected' : ''}>prod</option>
                  <option value="dev"${state.selectedRuntimeImportChannel === 'dev' ? ' selected' : ''}>dev</option>
                </select>
              </label>
              <label class="field">
                <span>导入后自动绑定</span>
                <select class="field-select" data-state-key="selectedRuntimeImportBindScopeType">
                  <option value="none"${state.selectedRuntimeImportBindScopeType === 'none' ? ' selected' : ''}>只导入 Release</option>
                  <option value="platform"${state.selectedRuntimeImportBindScopeType === 'platform' ? ' selected' : ''}>绑定到平台默认</option>
                  <option value="app"${state.selectedRuntimeImportBindScopeType === 'app' ? ' selected' : ''}>绑定到 OEM</option>
                </select>
              </label>
              <label class="field"${state.selectedRuntimeImportBindScopeType === 'app' ? '' : ' style="opacity:.55;"'}>
                <span>OEM 应用</span>
                <select class="field-select" data-state-key="selectedRuntimeImportBindScopeKey"${state.selectedRuntimeImportBindScopeType === 'app' ? '' : ' disabled'}>
                  <option value="">请选择 OEM</option>
                  ${state.brands
                    .map(
                      (brand) => `<option value="${escapeHtml(brand.brandId)}"${state.selectedRuntimeImportBindScopeKey === brand.brandId ? ' selected' : ''}>${escapeHtml(brand.displayName)}</option>`,
                    )
                    .join('')}
                </select>
              </label>
            </div>
            <div class="fig-list">${renderBootstrapArtifactList()}</div>
          </section>
          <section class="fig-card fig-card--subtle">
            <div class="fig-card__head">
              <div>
                <h3>Release 列表</h3>
                <span>${escapeHtml(String(state.runtimeReleases.length))} 条</span>
              </div>
              <button class="ghost-button" type="button" data-action="new-runtime-release">新建 Release</button>
            </div>
            <div class="fig-list">${renderReleaseList()}</div>
          </section>
          <form id="runtime-release-form" class="fig-card fig-card--subtle">
            <input type="hidden" name="release_id" value="${fieldValue(releaseDraft.id)}" />
            <div class="fig-card__head">
              <div>
                <h3>${releaseDraft.id ? '编辑 Release' : '新建 Release'}</h3>
                <span>target triple 自动推导，不单独暴露编辑</span>
              </div>
            </div>
            <div class="fig-toolbar">
              <label class="field">
                <span>Runtime Kind</span>
                <input class="field-input" name="runtime_kind" value="${fieldValue(releaseDraft.runtimeKind)}" placeholder="openclaw" />
              </label>
              <label class="field">
                <span>Version</span>
                <input class="field-input" name="version" value="${fieldValue(releaseDraft.version)}" placeholder="1.0.1+20260404" />
              </label>
              <label class="field">
                <span>Channel</span>
                <select class="field-select" name="channel">
                  <option value="prod"${releaseDraft.channel === 'prod' ? ' selected' : ''}>prod</option>
                  <option value="dev"${releaseDraft.channel === 'dev' ? ' selected' : ''}>dev</option>
                </select>
              </label>
              <label class="field">
                <span>Status</span>
                <select class="field-select" name="status">
                  <option value="draft"${releaseDraft.status === 'draft' ? ' selected' : ''}>draft</option>
                  <option value="published"${releaseDraft.status === 'published' ? ' selected' : ''}>published</option>
                  <option value="deprecated"${releaseDraft.status === 'deprecated' ? ' selected' : ''}>deprecated</option>
                  <option value="archived"${releaseDraft.status === 'archived' ? ' selected' : ''}>archived</option>
                </select>
              </label>
              <label class="field">
                <span>Platform</span>
                <select class="field-select" name="platform">
                  <option value="darwin"${releaseDraft.platform === 'darwin' ? ' selected' : ''}>darwin</option>
                  <option value="windows"${releaseDraft.platform === 'windows' ? ' selected' : ''}>windows</option>
                  <option value="linux"${releaseDraft.platform === 'linux' ? ' selected' : ''}>linux</option>
                </select>
              </label>
              <label class="field">
                <span>Arch</span>
                <select class="field-select" name="arch">
                  <option value="aarch64"${releaseDraft.arch === 'aarch64' ? ' selected' : ''}>aarch64</option>
                  <option value="x64"${releaseDraft.arch === 'x64' ? ' selected' : ''}>x64</option>
                </select>
              </label>
            </div>
            <div class="fig-meta-cards">
              <div class="fig-meta-card">
                <span>Target Triple</span>
                <strong>${escapeHtml(computeRuntimeTargetTriple(releaseDraft.platform, releaseDraft.arch) || '未识别')}</strong>
              </div>
              <div class="fig-meta-card">
                <span>包大小</span>
                <strong>${escapeHtml(formatBytes(releaseDraft.artifactSizeBytes))}</strong>
              </div>
              <div class="fig-meta-card">
                <span>最后更新时间</span>
                <strong>${escapeHtml(formatDateTime(selectedRelease?.updatedAt || ''))}</strong>
              </div>
            </div>
            <label class="field">
              <span>Artifact URL</span>
              <input class="field-input" name="artifact_url" value="${fieldValue(releaseDraft.artifactUrl)}" placeholder="https://..." />
            </label>
            <div class="fig-toolbar">
              <label class="field">
                <span>Bucket</span>
                <input class="field-input" name="bucket_name" value="${fieldValue(releaseDraft.bucketName)}" placeholder="iclaw-prod" />
              </label>
              <label class="field">
                <span>Object Key</span>
                <input class="field-input" name="object_key" value="${fieldValue(releaseDraft.objectKey)}" placeholder="downloads/runtime/..." />
              </label>
              <label class="field">
                <span>SHA256</span>
                <input class="field-input" name="artifact_sha256" value="${fieldValue(releaseDraft.artifactSha256)}" placeholder="可选" />
              </label>
            </div>
            <div class="fig-toolbar">
              <label class="field">
                <span>Size Bytes</span>
                <input class="field-input" name="artifact_size_bytes" value="${fieldValue(releaseDraft.artifactSizeBytes)}" placeholder="可选" />
              </label>
              <label class="field">
                <span>Launcher Path</span>
                <input class="field-input" name="launcher_relative_path" value="${fieldValue(releaseDraft.launcherRelativePath)}" placeholder="可选" />
              </label>
              <label class="field">
                <span>Build Time</span>
                <input class="field-input" name="build_time" value="${fieldValue(releaseDraft.buildTime)}" placeholder="ISO 时间" />
              </label>
            </div>
            <div class="fig-toolbar">
              <label class="field">
                <span>Git Commit</span>
                <input class="field-input" name="git_commit" value="${fieldValue(releaseDraft.gitCommit)}" placeholder="可选" />
              </label>
              <label class="field">
                <span>Git Tag</span>
                <input class="field-input" name="git_tag" value="${fieldValue(releaseDraft.gitTag)}" placeholder="可选" />
              </label>
              <label class="field">
                <span>Release Version</span>
                <input class="field-input" name="release_version" value="${fieldValue(releaseDraft.releaseVersion)}" placeholder="可选" />
              </label>
            </div>
            <div class="fig-release-card__actions">
              <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>${state.busy ? '保存中…' : '保存 Release'}</button>
            </div>
          </form>
        </div>
        <div class="fig-detail-stack"${selectedSection !== 'binding' ? ' style="display:none;"' : ''}>
          <section class="fig-card fig-card--subtle">
            <div class="fig-card__head">
              <div>
                <h3>Binding 列表</h3>
                <span>${escapeHtml(String(state.runtimeBindings.length))} 条</span>
              </div>
              <button class="ghost-button" type="button" data-action="new-runtime-binding">新建 Binding</button>
            </div>
            <div class="fig-list">${renderBindingList()}</div>
          </section>
          <form id="runtime-binding-form" class="fig-card fig-card--subtle">
            <input type="hidden" name="binding_id" value="${fieldValue(bindingDraft.id)}" />
            <div class="fig-card__head">
              <div>
                <h3>${bindingDraft.id ? '编辑 Binding' : '新建 Binding'}</h3>
                <span>OEM 配了 binding 就用 OEM；没配就回落平台</span>
              </div>
            </div>
            <div class="fig-toolbar">
              <label class="field">
                <span>Scope</span>
                <select class="field-select" name="scope_type">
                  <option value="platform"${bindingDraft.scopeType === 'platform' ? ' selected' : ''}>platform</option>
                  <option value="app"${bindingDraft.scopeType === 'app' ? ' selected' : ''}>OEM app</option>
                </select>
              </label>
              <label class="field"${bindingDraft.scopeType === 'app' ? '' : ' style="opacity:.55;"'}>
                <span>OEM 应用</span>
                <select class="field-select" name="scope_key"${bindingDraft.scopeType === 'app' ? '' : ' disabled'}>
                  ${state.brands
                    .map(
                      (brand) => `<option value="${escapeHtml(brand.brandId)}"${bindingDraft.scopeKey === brand.brandId ? ' selected' : ''}>${escapeHtml(brand.displayName)}</option>`,
                    )
                    .join('')}
                </select>
              </label>
              <label class="field">
                <span>Runtime Kind</span>
                <input class="field-input" name="runtime_kind" value="${fieldValue(bindingDraft.runtimeKind)}" placeholder="openclaw" />
              </label>
              <label class="field">
                <span>Channel</span>
                <select class="field-select" name="channel">
                  <option value="prod"${bindingDraft.channel === 'prod' ? ' selected' : ''}>prod</option>
                  <option value="dev"${bindingDraft.channel === 'dev' ? ' selected' : ''}>dev</option>
                </select>
              </label>
              <label class="field">
                <span>Platform</span>
                <select class="field-select" name="platform">
                  <option value="darwin"${bindingDraft.platform === 'darwin' ? ' selected' : ''}>darwin</option>
                  <option value="windows"${bindingDraft.platform === 'windows' ? ' selected' : ''}>windows</option>
                  <option value="linux"${bindingDraft.platform === 'linux' ? ' selected' : ''}>linux</option>
                </select>
              </label>
              <label class="field">
                <span>Arch</span>
                <select class="field-select" name="arch">
                  <option value="aarch64"${bindingDraft.arch === 'aarch64' ? ' selected' : ''}>aarch64</option>
                  <option value="x64"${bindingDraft.arch === 'x64' ? ' selected' : ''}>x64</option>
                </select>
              </label>
            </div>
            <div class="fig-meta-cards">
              <div class="fig-meta-card">
                <span>Target Triple</span>
                <strong>${escapeHtml(computeRuntimeTargetTriple(bindingDraft.platform, bindingDraft.arch) || '未识别')}</strong>
              </div>
              <div class="fig-meta-card">
                <span>当前作用域</span>
                <strong>${escapeHtml(bindingDraft.scopeType === 'platform' ? '平台默认' : bindingDraft.scopeKey || '未选 OEM')}</strong>
              </div>
            </div>
            <label class="field">
              <span>绑定到哪个 Release</span>
              <select class="field-select" name="release_id">
                <option value="">请选择已发布 release</option>
                ${releaseOptions
                  .map(
                    (item) => `<option value="${escapeHtml(item.id)}"${bindingDraft.releaseId === item.id ? ' selected' : ''}>${escapeHtml(item.label)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="field">
              <span>切换原因</span>
              <textarea class="field-input" name="change_reason" rows="3" placeholder="写明这次绑定为什么切换，方便后续审计追踪">${fieldValue(bindingDraft.changeReason)}</textarea>
            </label>
            <label class="field" style="max-width:220px;">
              <span>Enabled</span>
              <input type="checkbox" name="enabled"${bindingDraft.enabled ? ' checked' : ''} />
            </label>
            <div class="fig-release-card__actions">
              <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>${state.busy ? '保存中…' : '保存 Binding'}</button>
            </div>
          </form>
        </div>
        <div class="fig-detail-stack"${selectedSection !== 'history' ? ' style="display:none;"' : ''}>
          <section class="fig-card fig-card--subtle">
            <div class="fig-card__head">
              <div>
                <h3>Binding History</h3>
                <span>${selectedBinding ? '当前选中 binding 的历史' : '全部历史'}</span>
              </div>
            </div>
            <div class="fig-list">
              ${historyItems.length
                ? historyItems
                    .map((item) => {
                      const fromRelease = state.runtimeReleases.find((release) => release.id === item.fromReleaseId) || null;
                      const toRelease = state.runtimeReleases.find((release) => release.id === item.toReleaseId) || null;
                      return `
                        <div class="fig-list-item">
                          <div style="width:100%;">
                            <div class="fig-list-item__title">${escapeHtml(item.scopeType === 'platform' ? '平台' : item.scopeKey)} · ${escapeHtml(item.channel)} · ${escapeHtml(item.targetTriple)}</div>
                            <div class="fig-list-item__body">从 ${escapeHtml(fromRelease?.version || item.fromReleaseId || '空')} 切到 ${escapeHtml(toRelease?.version || item.toReleaseId || '空')}</div>
                            <div class="fig-list-item__meta">
                              <span>${escapeHtml(item.runtimeKind)}</span>
                              <span>${escapeHtml(formatDateTime(item.createdAt))}</span>
                              ${item.changeReason ? `<span>${escapeHtml(item.changeReason)}</span>` : ''}
                            </div>
                          </div>
                        </div>
                      `;
                    })
                    .join('')
                : `<div class="empty-state empty-state--panel">还没有 runtime binding history。</div>`}
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

function renderReleasesPage() {
  const items = getFilteredReleases();
  const selectedRelease = items.find((item) => item.id === state.selectedReleaseId) || items[0] || null;
  const selectedBrand = state.brands.find((item) => item.brandId === selectedRelease?.brand_id) || null;
  const diffAreas = selectedRelease ? summarizeChangedAreas(selectedBrand?.draftConfig, selectedRelease.config) : [];
  const desktopBrandId = state.filters.releaseBrand !== 'all' ? state.filters.releaseBrand : '';
  const desktopBrandDetail = desktopBrandId ? state.portalAppDetails[desktopBrandId] || null : null;
  const desktopReleaseChannel = state.selectedDesktopReleaseChannel === 'dev' ? 'dev' : 'prod';
  const desktopReleaseConfig = desktopBrandDetail ? getDesktopReleaseConfig(desktopBrandDetail.app) : null;
  const desktopDraft = desktopReleaseConfig ? desktopReleaseConfig[desktopReleaseChannel].draft : null;
  const desktopPublished = desktopReleaseConfig ? desktopReleaseConfig[desktopReleaseChannel].published : null;
  const renderDesktopTargetCard = (platform, arch) => {
    const target = findDesktopReleaseTarget(desktopDraft, platform, arch);
    const publishedTarget = findDesktopReleaseTarget(desktopPublished, platform, arch);
    const fileRow = (label, field, publishedField = null) => `
      <div class="fig-meta-card">
        <span>${label}</span>
        <strong>${escapeHtml(field?.fileName || '未上传')}</strong>
        ${publishedField?.fileName ? `<div class="text-[11px] text-[var(--text-secondary)]">已生效：${escapeHtml(publishedField.fileName)}</div>` : ''}
        <input class="field-input" type="file" name="desktop_file_${platform}_${arch}_${label === '安装包' ? 'installer' : label === 'Updater' ? 'updater' : 'signature'}" />
      </div>
    `;
    return `
      <section class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>${escapeHtml(formatDesktopTargetLabel(platform, arch))}</h3>
          <span>要求 installer / updater / signature 成套存在</span>
        </div>
        <div class="fig-meta-cards">
          ${fileRow('安装包', target?.installer, publishedTarget?.installer)}
          ${fileRow('Updater', target?.updater, publishedTarget?.updater)}
          ${fileRow('Signature', target?.signature, publishedTarget?.signature)}
        </div>
      </section>
    `;
  };
  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>版本发布</h1>
            <p class="fig-page__description">桌面安装包发布、强更策略与 portal app 快照版本时间线</p>
          </div>
        </div>
      </div>
      <div class="fig-page__body">
        ${renderPageGuide('版本发布怎么用', [
          '先选择品牌，再维护该品牌桌面端的 dmg、exe、updater 和签名文件。',
          '版本号、强更阈值、说明文案和 3 档更新策略都在这里统一配置并发布生效。',
          '下方时间线用于回看历史快照和对比当前草稿差异。',
        ], 'releases')}
        <div class="fig-toolbar">
          <select class="field-select fig-filter" data-filter-key="releaseBrand">
            <option value="all">全部品牌</option>
            ${state.brands
              .map(
                (brand) => `
                  <option value="${escapeHtml(brand.brandId)}"${state.filters.releaseBrand === brand.brandId ? ' selected' : ''}>${escapeHtml(brand.displayName)}</option>
                `,
              )
              .join('')}
          </select>
        </div>
        <section class="fig-card">
          <div class="fig-card__head">
            <div>
              <h3>桌面发布中心</h3>
              <span>上传 dmg / exe / updater / sig，并在同一页配置常规提醒、任务结束后强更、立即强更</span>
            </div>
          </div>
          ${
            desktopBrandId && desktopBrandDetail
              ? `
                <form id="desktop-release-publish-form" class="space-y-4">
                  <input type="hidden" name="brand_id" value="${escapeHtml(desktopBrandId)}" />
                  <div class="fig-toolbar">
                    <label class="field">
                      <span>发布 Channel</span>
                      <select class="field-select" name="channel" data-state-key="selectedDesktopReleaseChannel">
                        <option value="prod"${desktopReleaseChannel === 'prod' ? ' selected' : ''}>prod</option>
                        <option value="dev"${desktopReleaseChannel === 'dev' ? ' selected' : ''}>dev</option>
                      </select>
                    </label>
                    <label class="field">
                      <span>版本号</span>
                      <input class="field-input" name="version" value="${fieldValue(desktopDraft?.version || desktopPublished?.version || '')}" placeholder="例如 1.4.7" />
                    </label>
                    <label class="field">
                      <span>Force Below</span>
                      <input class="field-input" name="force_update_below_version" value="${fieldValue(desktopDraft?.policy?.forceUpdateBelowVersion || desktopPublished?.policy?.forceUpdateBelowVersion || '')}" placeholder="例如 1.4.6" />
                    </label>
                    <label class="field">
                      <span>更新策略</span>
                      <select class="field-select" name="enforcement_mode">
                        <option value="recommended"${
                          resolveDesktopEnforcementMode(desktopDraft?.policy || desktopPublished?.policy) === 'recommended' ? ' selected' : ''
                        }>常规提醒</option>
                        <option value="required_after_run"${
                          resolveDesktopEnforcementMode(desktopDraft?.policy || desktopPublished?.policy) === 'required_after_run' ? ' selected' : ''
                        }>强更，但允许当前任务跑完</option>
                        <option value="required_now"${
                          resolveDesktopEnforcementMode(desktopDraft?.policy || desktopPublished?.policy) === 'required_now' ? ' selected' : ''
                        }>立即强更</option>
                      </select>
                    </label>
                  </div>
                  <div class="fig-meta-cards">
                    <div class="fig-meta-card"><span>当前草稿</span><strong>${escapeHtml(desktopDraft?.version || '未配置')}</strong></div>
                    <div class="fig-meta-card"><span>当前已生效</span><strong>${escapeHtml(desktopPublished?.version || '未发布')}</strong></div>
                    <div class="fig-meta-card"><span>已生效时间</span><strong>${escapeHtml(formatDateTime(desktopPublished?.publishedAt || ''))}</strong></div>
                  </div>
                  <label class="field">
                    <span>发布说明</span>
                    <textarea class="field-input" name="notes" rows="3" placeholder="写给更新弹窗 / updater notes 的说明">${fieldValue(desktopDraft?.notes || desktopPublished?.notes || '')}</textarea>
                  </label>
                  <div class="fig-meta-cards">
                    <div class="fig-meta-card">
                      <span>当前策略</span>
                      <strong>${escapeHtml(
                        resolveDesktopEnforcementMode(desktopPublished?.policy) === 'required_now'
                          ? '立即强更'
                          : resolveDesktopEnforcementMode(desktopPublished?.policy) === 'required_after_run'
                            ? '任务结束后强更'
                            : '常规提醒',
                      )}</strong>
                    </div>
                    <div class="fig-meta-card">
                      <span>策略说明</span>
                      <strong>${escapeHtml(desktopPublished?.policy?.reasonMessage || '未配置')}</strong>
                    </div>
                  </div>
                  <label class="field">
                    <span>强更说明文案</span>
                    <textarea class="field-input" name="reason_message" rows="2" placeholder="例如：当前版本存在已知稳定性问题，请在当前任务完成后升级。">${fieldValue(
                      desktopDraft?.policy?.reasonMessage || desktopPublished?.policy?.reasonMessage || '',
                    )}</textarea>
                  </label>
                  <div class="space-y-3">
                    ${renderDesktopTargetCard('darwin', 'aarch64')}
                    ${renderDesktopTargetCard('darwin', 'x64')}
                    ${renderDesktopTargetCard('windows', 'x64')}
                    ${renderDesktopTargetCard('windows', 'aarch64')}
                  </div>
                  <div class="fig-release-card__actions">
                    <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>${state.busy ? '发布中…' : '发布并生效'}</button>
                  </div>
                </form>
              `
              : `
                <div class="empty-state empty-state--panel">
                  先在上方选择一个品牌，再管理该品牌的桌面安装包与强更策略。
                </div>
              `
          }
        </section>
        <div class="fig-release-timeline">
          ${items.length
            ? items
                .map(
                  (item) => {
                    const isActive = selectedRelease?.id === item.id;
                    const releaseBrand = state.brands.find((brand) => brand.brandId === item.brand_id) || null;
                    const releaseDiffAreas = isActive ? summarizeChangedAreas(releaseBrand?.draftConfig, item.config) : [];
                    return `
                      <div class="fig-release-entry${isActive ? ' is-active' : ''}">
                        <div class="fig-release-entry__dot"></div>
                        <div class="fig-release-card">
                          <button class="fig-release-card__summary" type="button" data-action="select-release" data-release-id="${escapeHtml(item.id)}">
                            <div>
                              <div class="fig-release-card__title-row">
                                <h3>${escapeHtml(item.display_name)}</h3>
                                ${statusBadge('published')}
                              </div>
                              <div class="fig-release-card__meta">
                                <span><code>v${escapeHtml(item.version)}</code></span>
                                <span>•</span>
                                <span>${icon('calendar', 'fig-inline-icon')} ${escapeHtml(formatDateTime(item.published_at))}</span>
                                <span>•</span>
                                <span>${icon('user', 'fig-inline-icon')} ${escapeHtml(item.created_by_name || item.created_by_username || 'system')}</span>
                              </div>
                            </div>
                          </button>
                          ${
                            isActive
                              ? `
                                <div class="fig-release-card__detail">
                                  <div class="metric-chips">
                                    ${(item.changed_areas || []).length ? item.changed_areas.map((area) => `<span>${escapeHtml(area)}</span>`).join('') : '<span>无变更区域</span>'}
                                  </div>
                                  <div class="release-metrics">
                                    <div><span>Surface</span><strong>${escapeHtml((item.surfaces || []).join(' / ') || '无')}</strong></div>
                                    <div><span>技能数</span><strong>${escapeHtml(item.skill_count)}</strong></div>
                                    <div><span>MCP 数</span><strong>${escapeHtml(item.mcp_count)}</strong></div>
                                    <div><span>当前草稿 Diff</span><strong>${escapeHtml(releaseDiffAreas.join(' / ') || diffAreas.join(' / ') || '无差异')}</strong></div>
                                  </div>
                                  <div class="fig-release-card__actions">
                                    <button class="ghost-button" type="button" data-action="select-brand" data-brand-id="${escapeHtml(item.brand_id)}">打开品牌</button>
                                  </div>
                                  <section class="fig-card fig-card--subtle">
                                    <div class="fig-card__head">
                                      <h3>Diff 视图</h3>
                                      <span>对比选中发布版本与当前品牌草稿</span>
                                    </div>
                                    <div class="diff-grid">
                                      <label class="field">
                                        <span>发布版本 JSON</span>
                                        <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(item.config))}</textarea>
                                      </label>
                                      <label class="field">
                                        <span>当前草稿 JSON</span>
                                        <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(releaseBrand?.draftConfig || {}))}</textarea>
                                      </label>
                                    </div>
                                  </section>
                                </div>
                              `
                              : ''
                          }
                        </div>
                      </div>
                    `;
                  },
                )
                .join('')
            : `<div class="empty-state empty-state--panel">当前没有发布记录。</div>`}
        </div>
      </div>
    </div>
  `;
}

function getFilteredAudit() {
  const query = state.filters.auditQuery.trim().toLowerCase();
  return state.audit.filter((item) => {
    if (state.filters.auditBrand !== 'all' && item.brandId !== state.filters.auditBrand) {
      return false;
    }
    if (state.filters.auditAction !== 'all' && item.action !== state.filters.auditAction) {
      return false;
    }
    if (!query) return true;
    return [item.brandDisplayName, item.action, item.actorName, item.actorUsername, item.environment]
      .some((value) => String(value || '').toLowerCase().includes(query));
  });
}

function paymentStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'paid') return '已支付';
  if (normalized === 'pending' || normalized === 'created') return '待支付';
  if (normalized === 'failed') return '支付失败';
  if (normalized === 'expired') return '已过期';
  if (normalized === 'refunded') return '已退款';
  return normalized || '未知状态';
}

function paymentProviderLabel(provider) {
  const normalized = String(provider || '').trim().toLowerCase();
  if (normalized === 'wechat_qr') return '微信扫码';
  if (normalized === 'alipay_qr') return '支付宝扫码';
  if (normalized === 'mock') return '测试支付';
  return normalized || '未知渠道';
}

function buildRechargePackageMetadataFromForm(form) {
  const extraMetadata = expandMetadataEntries(readMetadataEntriesFromForm(form, 'recharge_package_metadata_entries'));
  const featureListRaw = form.querySelector('[name="feature_list"]');
  const featureList = featureListRaw instanceof HTMLTextAreaElement ? splitLines(featureListRaw.value) : [];
  return {
    ...extraMetadata,
    description:
      form.querySelector('[name="description"]') instanceof HTMLTextAreaElement
        ? form.querySelector('[name="description"]').value.trim()
        : '',
    badge_label:
      form.querySelector('[name="badge_label"]') instanceof HTMLInputElement
        ? form.querySelector('[name="badge_label"]').value.trim()
        : '',
    highlight:
      form.querySelector('[name="highlight"]') instanceof HTMLInputElement
        ? form.querySelector('[name="highlight"]').value.trim()
        : '',
    feature_list: featureList,
  };
}

function renderRechargePackageCatalogPage() {
  const items = getRechargePackageCatalogItems();
  const selectedPackage =
    state.selectedRechargePackageId === '__new__'
      ? null
      : items.find((item) => item.packageId === state.selectedRechargePackageId) || items[0] || null;
  const editingItem = selectedPackage || {
    packageId: '',
    packageName: '',
    credits: 0,
    bonusCredits: 0,
    amountCnyFen: 0,
    sortOrder: (items.length + 1) * 10 || 10,
    recommended: false,
    default: false,
    active: true,
    description: '',
    badgeLabel: '',
    highlight: '',
    featureList: [],
    metadata: {},
  };
  const overrideConnections = selectedPackage ? getPortalRechargePackageOverrideConnections(selectedPackage.packageId) : [];
  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>充值套餐</h1>
            <p class="fig-page__description">这里维护平台级套餐主数据。所有 OEM 默认继承这里；只有 OEM 明确配置了绑定，才会切到 OEM 自己的套餐集合。</p>
          </div>
          <div style="display:flex; gap:12px;">
            <button class="ghost-button fig-button" type="button" data-action="restore-recommended-recharge-packages"${state.busy ? ' disabled' : ''}>
              ${icon('sparkles', 'button-icon')}
              恢复超值推荐三挡
            </button>
            <button class="solid-button fig-button" type="button" data-action="new-recharge-package">
              ${icon('plus', 'button-icon')}
              新增套餐
            </button>
          </div>
        </div>
      </div>
      ${renderPageGuide('充值套餐怎么用', [
        '平台页维护唯一套餐目录：金额、基础龙虾币、赠送龙虾币、推荐位和展示文案都在这里。',
        'OEM 页只做 binding，不另建一套主数据；不想让某个 OEM 跟平台一致时，再去品牌详情里做覆盖。',
        '删除平台套餐会影响所有 OEM 绑定，所以这里只保留平台真值，不在桌面端或 runtime 做硬编码。',
      ], 'payments')}
      <div class="fig-page__body">
        <section class="fig-card fig-audit-table-card">
          <div class="fig-card__head">
            <h3>平台套餐目录</h3>
            <span>${escapeHtml(items.length)} 个</span>
          </div>
          <div class="fig-audit-table">
            <div class="fig-audit-table__header">
              <div>套餐</div>
              <div>价格</div>
              <div>到账</div>
              <div>排序</div>
              <div>状态</div>
            </div>
            <div class="fig-audit-table__body">
              ${items.length
                ? items
                    .map(
                      (item) => `
                        <button class="fig-audit-row${selectedPackage?.packageId === item.packageId ? ' is-active' : ''}" type="button" data-action="select-recharge-package" data-package-id="${escapeHtml(item.packageId)}">
                          <div>
                            <div class="fig-audit-row__title">${escapeHtml(item.packageName)}</div>
                            <div class="fig-audit-row__detail">${escapeHtml(item.packageId)}</div>
                          </div>
                          <div>${escapeHtml(formatFen(item.amountCnyFen))}</div>
                          <div>${escapeHtml(formatCredits(item.credits + item.bonusCredits))}</div>
                          <div>${escapeHtml(String(item.sortOrder))}</div>
                          <div>${escapeHtml(item.active !== false ? '已启用' : '已下架')}</div>
                        </button>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">还没有平台充值套餐。</div>`}
            </div>
          </div>
        </section>
        <section class="fig-card">
          <div class="fig-card__head">
            <div>
              <h3>${selectedPackage ? selectedPackage.packageName : '新增平台充值套餐'}</h3>
              <span>${escapeHtml(selectedPackage ? `${selectedPackage.packageId} · 平台主数据` : '新套餐会直接写入 platform_recharge_package_catalog')}</span>
            </div>
          </div>
          ${selectedPackage
            ? `
              <div class="fig-meta-cards">
                <div class="fig-meta-card"><span>平台默认</span><strong>${selectedPackage.default ? '是' : '否'}</strong></div>
                <div class="fig-meta-card"><span>超值推荐</span><strong>${selectedPackage.recommended ? '是' : '否'}</strong></div>
                <div class="fig-meta-card"><span>OEM 覆盖使用数</span><strong>${escapeHtml(overrideConnections.length)}</strong></div>
                <div class="fig-meta-card"><span>总到账</span><strong>${escapeHtml(formatCredits(selectedPackage.credits + selectedPackage.bonusCredits))}</strong></div>
              </div>
            `
            : ''}
          <form id="recharge-package-form" class="fig-card fig-card--subtle" style="margin-top:16px;">
            <div class="form-grid form-grid--two">
              <label class="field">
                <span>Package ID</span>
                <input class="field-input" name="package_id" value="${fieldValue(editingItem.packageId)}" placeholder="topup_7000" ${selectedPackage ? 'readonly' : ''} />
              </label>
              <label class="field">
                <span>套餐名称</span>
                <input class="field-input" name="package_name" value="${fieldValue(editingItem.packageName)}" placeholder="7000 龙虾币" />
              </label>
              <label class="field">
                <span>金额（元）</span>
                <input class="field-input" name="amount_cny_yuan" type="number" min="0.01" step="0.01" value="${fieldValue(formatFenInputValue(editingItem.amountCnyFen))}" />
              </label>
              <label class="field">
                <span>基础龙虾币</span>
                <input class="field-input" name="credits" type="number" min="1" step="1" value="${fieldValue(editingItem.credits)}" />
              </label>
              <label class="field">
                <span>赠送龙虾币</span>
                <input class="field-input" name="bonus_credits" type="number" min="0" step="1" value="${fieldValue(editingItem.bonusCredits)}" />
              </label>
              <label class="field">
                <span>排序</span>
                <input class="field-input" name="sort_order" type="number" min="1" step="1" value="${fieldValue(editingItem.sortOrder)}" />
              </label>
              <label class="field field--wide">
                <span>描述文案</span>
                <textarea class="field-textarea" name="description" rows="3">${fieldValue(editingItem.description)}</textarea>
              </label>
              <label class="field">
                <span>Badge</span>
                <input class="field-input" name="badge_label" value="${fieldValue(editingItem.badgeLabel)}" placeholder="超值推荐" />
              </label>
              <label class="field">
                <span>Highlight</span>
                <input class="field-input" name="highlight" value="${fieldValue(editingItem.highlight)}" placeholder="到账 7,000 龙虾币" />
              </label>
              <label class="field field--wide">
                <span>特性列表</span>
                <textarea class="field-textarea" name="feature_list" rows="4" placeholder="每行一条卖点">${fieldValue(editingItem.featureList.join('\n'))}</textarea>
              </label>
              <div class="field field--wide">
                ${renderMetadataEntriesEditor({
                  name: 'recharge_package_metadata_entries',
                  title: '额外 Metadata',
                  description: '除 description / badge_label / highlight / feature_list 外的附加字段。',
                  value: Object.fromEntries(
                    Object.entries(asObject(editingItem.metadata)).filter(([key]) => !['description', 'badge_label', 'badgeLabel', 'highlight', 'feature_list', 'featureList'].includes(key)),
                  ),
                })}
              </div>
            </div>
            <div class="fig-capability-columns" style="margin-top:16px;">
              <label class="toggle fig-toggle">
                <input type="checkbox" name="recommended"${editingItem.recommended ? ' checked' : ''} />
                <span>超值推荐套餐</span>
              </label>
              <label class="toggle fig-toggle">
                <input type="checkbox" name="default"${editingItem.default ? ' checked' : ''} />
                <span>平台默认套餐</span>
              </label>
              <label class="toggle fig-toggle">
                <input type="checkbox" name="active"${editingItem.active !== false ? ' checked' : ''} />
                <span>启用套餐</span>
              </label>
            </div>
            <div class="fig-form-actions">
              <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存套餐</button>
              ${selectedPackage ? `<button class="ghost-button" type="button" data-action="delete-recharge-package" data-package-id="${escapeHtml(selectedPackage.packageId)}"${state.busy ? ' disabled' : ''}>删除套餐</button>` : ''}
            </div>
          </form>
        </section>
      </div>
    </div>
  `;
}

function renderPaymentProviderConfigPage() {
  const selectedTab = getSelectedPaymentProviderTab();
  const selectedBrand = selectedTab === 'platform' ? null : (state.brands || []).find((item) => item.brandId === selectedTab) || null;
  const scopeType = selectedBrand ? 'app' : 'platform';
  const scopeKey = selectedBrand ? selectedBrand.brandId : 'platform';
  const gatewayConfig = getPaymentGatewayConfigView();
  const gatewayConfigValues = asObject(gatewayConfig.config);
  const gatewaySecretValues = asObject(gatewayConfig.secret_values);
  const gatewayConfiguredSecrets = Array.isArray(gatewayConfig.configured_secret_keys) ? gatewayConfig.configured_secret_keys : [];
  const gatewayMissingFields = Array.isArray(gatewayConfig.missing_fields) ? gatewayConfig.missing_fields : [];
  const gatewayMode = getPaymentGatewayMode(scopeType, scopeKey, gatewayConfig.source);
  const gatewayInheritMode = selectedBrand && gatewayMode === 'inherit_platform';
  const selectedBrandDetail = selectedBrand ? state.portalAppDetails[selectedBrand.brandId] || null : null;
  const profile = getPaymentProviderProfilesByScope(scopeType, scopeKey)[0] || {
    id: '',
    provider: PRIMARY_PAYMENT_PROVIDER,
    scope_type: scopeType,
    scope_key: scopeKey,
    channel_kind: 'wechat_service_provider',
    display_name: selectedBrand ? `${selectedBrand.displayName} 微信支付` : '平台默认微信支付',
    enabled: true,
    config: {},
    configured_secret_keys: [],
    completeness_status: 'missing',
    missing_fields: PAYMENT_PROVIDER_REQUIRED_FIELDS,
  };
  const binding = selectedBrand ? getPaymentProviderBinding(selectedBrand.brandId) : null;
  const tabs = [
    {key: 'platform', label: '平台'},
    ...(state.brands || []).map((brand) => ({key: brand.brandId, label: brand.displayName})),
  ];
  const config = asObject(profile.config);
  const mode = selectedBrand ? binding?.mode || 'inherit_platform' : 'inherit_platform';
  const missingFields = Array.isArray(profile.missing_fields) ? profile.missing_fields : [];
  const configuredSecrets = Array.isArray(profile.configured_secret_keys) ? profile.configured_secret_keys : [];
  const paymentMethodConfig = normalizeRechargePaymentMethodConfig(selectedBrandDetail?.app ? getAppConfig(selectedBrandDetail.app) : null);
  const hasPaymentMethodOverride = selectedBrand ? hasOemRechargePaymentMethodOverride(selectedBrandDetail) : false;
  const enabledPaymentMethodProviders = paymentMethodConfig.filter((item) => item.enabled).map((item) => item.provider);
  const selectedDefaultPaymentMethod =
    paymentMethodConfig.find((item) => item.default && item.enabled)?.provider || enabledPaymentMethodProviders[0] || '';
  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>支付账户配置</h1>
            <p class="fig-page__description">先按“平台默认 + OEM 绑定”管理微信服务商。OEM 未指定时，订单回落平台配置；指定后切到该 OEM 自己的商户资料。</p>
          </div>
        </div>
      </div>
      ${renderPageGuide('支付中心怎么用', [
        '平台 tab 维护默认微信服务商资料，所有 OEM 默认继承这里。',
        'OEM tab 可以先录入自己的服务商配置，再决定是继承平台还是切到 OEM 专属资料。',
        'OEM tab 还能单独控制前台可见支付方式；未开启 OEM 覆盖时，自动继承平台默认的微信支付 + 支付宝。',
        '当前先实现配置、绑定和订单解析落表；真实微信下单执行器后续直接复用这套 profile。',
      ], 'payments')}
      <div class="fig-detail-stack">
        <section class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>Scope</h3>
            <span>平台默认 + OEM 覆盖</span>
          </div>
          <div class="segmented" style="flex-wrap:wrap;">
            ${tabs
              .map(
                (tab) =>
                  `<button class="tab-pill${selectedTab === tab.key ? ' is-active' : ''}" type="button" data-action="select-payment-provider-tab" data-tab-key="${escapeHtml(tab.key)}" data-testid="payment-provider-tab-${escapeHtml(tab.key)}">${escapeHtml(tab.label)}</button>`,
              )
              .join('')}
          </div>
        </section>
        <form id="payment-gateway-form" class="fig-card fig-card--subtle" data-testid="payment-gateway-form">
          <input type="hidden" name="provider" value="epay" />
          <input type="hidden" name="scope_type" value="${fieldValue(scopeType)}" />
          <input type="hidden" name="scope_key" value="${fieldValue(scopeKey)}" />
          <div class="fig-card__head">
            <div>
              <h3>${escapeHtml(selectedBrand ? `${selectedBrand.displayName} 支付网关` : '平台支付网关')}</h3>
              <span>${escapeHtml(
                selectedBrand
                  ? 'OEM 可以显式选择“继承平台”或“使用 OEM 独立网关”；独立配置保存后只影响当前 OEM。'
                  : 'epay 属于平台级基础设施。所有 OEM 默认继承这里；一旦保存，将优先使用数据库配置。',
              )}</span>
            </div>
            ${
              selectedBrand
                ? `
                  <label class="field" style="min-width:220px;">
                    <span>Gateway Mode</span>
                    <select class="field-select" name="mode" data-testid="payment-gateway-mode">
                      <option value="inherit_platform"${gatewayMode === 'inherit_platform' ? ' selected' : ''}>继承平台</option>
                      <option value="use_app_config"${gatewayMode === 'use_app_config' ? ' selected' : ''}>使用 OEM 独立网关</option>
                    </select>
                  </label>
                `
                : ''
            }
          </div>
          <div class="payment-provider-summary">
            <div class="payment-provider-summary__item">
              <span>当前来源</span>
              <strong>${escapeHtml(getPaymentGatewaySourceLabel(gatewayConfig.source))}</strong>
            </div>
            <div class="payment-provider-summary__item">
              <span>完整度</span>
              <strong>${escapeHtml(gatewayConfig.completeness_status === 'configured' ? '已配置完整' : '配置缺失')}</strong>
            </div>
            <div class="payment-provider-summary__item">
              <span>已录入密钥</span>
              <strong>${escapeHtml(gatewayConfiguredSecrets.join(' / ') || '无')}</strong>
            </div>
            <div class="payment-provider-summary__item">
              <span>更新时间</span>
              <strong>${escapeHtml(gatewayConfig.updated_at ? formatDateTime(gatewayConfig.updated_at) : '未保存')}</strong>
            </div>
          </div>
          <div class="form-grid form-grid--two">
            <label class="field">
              <span>partner_id</span>
              <input class="field-input" name="partner_id" value="${fieldValue(gatewayConfigValues.partner_id || '')}" placeholder="准付商户 partner_id" data-testid="payment-gateway-partner-id"${gatewayInheritMode ? ' disabled' : ''} />
            </label>
            <label class="field">
              <span>gateway</span>
              <input class="field-input" name="gateway" value="${fieldValue(gatewayConfigValues.gateway || '')}" placeholder="https://..." data-testid="payment-gateway-endpoint"${gatewayInheritMode ? ' disabled' : ''} />
            </label>
            <label class="field field--wide">
              <span>key</span>
              <input class="field-input" name="key" value="${fieldValue(gatewaySecretValues.key || '')}" placeholder="准付签名 key" data-testid="payment-gateway-key"${gatewayInheritMode ? ' disabled' : ''} />
            </label>
          </div>
          <div class="fig-card fig-card--subtle" style="margin-top:16px;">
            <div style="font-size:13px;line-height:1.6;opacity:0.78;">
              ${escapeHtml(
                selectedBrand
                  ? gatewayInheritMode
                    ? `当前已选择继承平台。来源：${getPaymentGatewaySourceLabel(gatewayConfig.source)}；保存后将删除当前 OEM 的独立网关配置，并继续跟随平台。`
                    : `缺失字段：${gatewayMissingFields.join(' / ') || '无'}。当前来源是 ${getPaymentGatewaySourceLabel(gatewayConfig.source)}；保存后只更新当前 OEM 的独立网关，不影响平台和其它 OEM。`
                  : `缺失字段：${gatewayMissingFields.join(' / ') || '无'}。保存空值后也会以 admin 配置为准，不再回退 .env。`,
              )}
            </div>
          </div>
          <div class="fig-form-actions">
            <button class="solid-button" type="submit" data-testid="payment-gateway-save"${state.busy ? ' disabled' : ''}>${escapeHtml(
              selectedBrand ? (gatewayInheritMode ? '保存并继承平台' : '保存 OEM 网关') : '保存平台网关',
            )}</button>
          </div>
        </form>
        <form id="payment-provider-form" class="fig-card fig-card--subtle">
          <input type="hidden" name="profile_id" value="${fieldValue(profile.id || '')}" />
          <input type="hidden" name="provider" value="${fieldValue(profile.provider || PRIMARY_PAYMENT_PROVIDER)}" />
          <input type="hidden" name="scope_type" value="${fieldValue(scopeType)}" />
          <input type="hidden" name="scope_key" value="${fieldValue(scopeKey)}" />
          <div class="fig-card__head">
            <div>
              <h3>${escapeHtml(selectedBrand ? `${selectedBrand.displayName} 微信服务商` : '平台默认微信服务商')}</h3>
              <span>${escapeHtml(selectedBrand ? 'OEM 可以继承平台，或切到自己的服务商配置' : '所有 OEM 默认回落到这里')}</span>
            </div>
            ${selectedBrand
              ? `
                <label class="field" style="min-width:220px;">
                  <span>Provider Mode</span>
                  <select class="field-select" name="mode">
                    <option value="inherit_platform"${mode !== 'use_app_profile' ? ' selected' : ''}>继承平台</option>
                    <option value="use_app_profile"${mode === 'use_app_profile' ? ' selected' : ''}>使用 OEM 服务商</option>
                  </select>
                </label>
              `
              : ''}
          </div>
          <div class="payment-provider-summary">
            <div class="payment-provider-summary__item">
              <span>当前状态</span>
              <strong>${escapeHtml(profile.completeness_status === 'configured' ? '已配置完整' : '配置缺失')}</strong>
            </div>
            <div class="payment-provider-summary__item">
              <span>启用状态</span>
              <strong>${profile.enabled !== false ? '已启用' : '已禁用'}</strong>
            </div>
            <div class="payment-provider-summary__item">
              <span>已录入密钥</span>
              <strong>${escapeHtml(configuredSecrets.join(' / ') || '无')}</strong>
            </div>
            <div class="payment-provider-summary__item">
              <span>缺失字段</span>
              <strong>${escapeHtml(missingFields.join(' / ') || '无')}</strong>
            </div>
          </div>
          <div class="form-grid form-grid--two">
            <label class="field">
              <span>显示名称</span>
              <input class="field-input" name="display_name" value="${fieldValue(profile.display_name || '')}" placeholder="例如：平台默认微信服务商" />
            </label>
            <label class="field">
              <span>通道类型</span>
              <input class="field-input" value="wechat_service_provider" readonly />
            </label>
            <label class="field">
              <span>服务商商户号 SP_MCHID</span>
              <input class="field-input" name="sp_mchid" value="${fieldValue(config.sp_mchid || '')}" placeholder="服务商商户号" />
            </label>
            <label class="field">
              <span>服务商应用 AppID</span>
              <input class="field-input" name="sp_appid" value="${fieldValue(config.sp_appid || '')}" placeholder="wx..." />
            </label>
            <label class="field">
              <span>子商户号 SUB_MCHID</span>
              <input class="field-input" name="sub_mchid" value="${fieldValue(config.sub_mchid || '')}" placeholder="OEM 对应子商户号" />
            </label>
            <label class="field">
              <span>证书序列号 SERIAL_NO</span>
              <input class="field-input" name="serial_no" value="${fieldValue(config.serial_no || '')}" placeholder="平台证书序列号" />
            </label>
            <label class="field field--wide">
              <span>回调地址 NOTIFY_URL</span>
              <input class="field-input" name="notify_url" value="${fieldValue(config.notify_url || '')}" placeholder="https://api.example.com/payments/wechat/webhook" />
            </label>
            <label class="field field--wide">
              <span>API V3 Key</span>
              <input class="field-input" name="api_v3_key" value="" placeholder="${configuredSecrets.includes('api_v3_key') ? '已配置，留空表示保持不变' : '32 位 APIv3 Key'}" />
            </label>
            <label class="field field--wide">
              <span>商户私钥 PEM</span>
              <textarea class="field-textarea" name="private_key_pem" rows="8" placeholder="${configuredSecrets.includes('private_key_pem') ? '已配置，留空表示保持不变' : '-----BEGIN PRIVATE KEY-----'}"></textarea>
            </label>
          </div>
          <div class="fig-card fig-card--subtle" style="margin-top:16px;">
            <label class="toggle fig-toggle">
              <input type="checkbox" name="enabled"${profile.enabled !== false ? ' checked' : ''} />
              <span>启用该支付资料</span>
            </label>
          </div>
          <div class="fig-card fig-card--subtle" style="margin-top:16px;">
            <div class="fig-card__head">
              <div>
                <h3>支付方式可见性</h3>
                <span>${escapeHtml(selectedBrand ? '控制该 OEM 前台可看到哪些支付方式，以及默认选中哪一个' : '平台默认固定为 微信支付 + 支付宝，OEM 未覆盖时自动继承')}</span>
              </div>
            </div>
            ${
              selectedBrand
                ? `
                  <label class="toggle fig-toggle" style="margin-bottom:16px;">
                    <input type="checkbox" name="use_oem_payment_methods_override"${hasPaymentMethodOverride ? ' checked' : ''} />
                    <span>启用 OEM 支付方式覆盖</span>
                  </label>
                  <div class="space-y-3">
                    ${paymentMethodConfig
                      .map((item, index) => {
                        return `
                          <div class="fig-card fig-card--subtle" style="padding:14px;${!hasPaymentMethodOverride ? 'opacity:0.78;' : ''}">
                            <input type="hidden" name="payment_method_sort_order__${escapeHtml(item.provider)}" value="${fieldValue(String(item.sortOrder || (index + 1) * 10))}" />
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
                              <div>
                                <div style="font-weight:600;">${escapeHtml(getRechargePaymentMethodOptionLabel(item.provider, item.label))}</div>
                                <div style="font-size:12px;opacity:0.75;margin-top:4px;">${escapeHtml(item.provider === 'wechat_qr' ? '微信原生扫码链路' : '支付宝扫码链路')}</div>
                              </div>
                              <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">
                                <label class="toggle fig-toggle">
                                  <input type="checkbox" name="payment_method_enabled__${escapeHtml(item.provider)}"${item.enabled ? ' checked' : ''} />
                                  <span>启用</span>
                                </label>
                                <label class="field" style="min-width:140px;">
                                  <span>设为默认</span>
                                  <input type="radio" name="default_payment_method" value="${escapeHtml(item.provider)}"${selectedDefaultPaymentMethod === item.provider ? ' checked' : ''} />
                                </label>
                              </div>
                            </div>
                          </div>
                        `;
                      })
                      .join('')}
                  </div>
                `
                : `
                  <div class="payment-provider-summary">
                    ${getRechargePaymentMethodDefaults()
                      .map(
                        (item) => `
                          <div class="payment-provider-summary__item">
                            <span>${escapeHtml(getRechargePaymentMethodOptionLabel(item.provider, item.label))}</span>
                            <strong>${item.default ? '默认启用' : '已启用'}</strong>
                          </div>
                        `,
                      )
                      .join('')}
                  </div>
                `
            }
          </div>
          <div class="fig-form-actions">
            <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存支付配置</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function getFilteredPaymentOrders() {
  return state.paymentOrders.filter((item) => {
    if (state.filters.paymentStatus !== 'all' && item.status !== state.filters.paymentStatus) {
      return false;
    }
    if (state.filters.paymentProvider !== 'all' && item.provider !== state.filters.paymentProvider) {
      return false;
    }
    if (state.filters.paymentApp !== 'all' && (item.app_name || '') !== state.filters.paymentApp) {
      return false;
    }
    const query = String(state.filters.paymentQuery || '').trim().toLowerCase();
    if (!query) return true;
    const haystack = [
      item.order_id,
      item.user_id,
      item.username,
      item.user_email,
      item.user_display_name,
      item.package_id,
      item.package_name,
      item.provider_order_id,
      item.app_name,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

function renderPaymentsPage() {
  const items = getFilteredPaymentOrders();
  const selectedPaymentOrder = items.find((item) => item.order_id === state.selectedPaymentOrderId) || items[0] || null;
  const selectedPaymentDetail = selectedPaymentOrder ? state.paymentOrderDetails[selectedPaymentOrder.order_id] || null : null;
  const appNames = Array.from(new Set(state.paymentOrders.map((item) => String(item.app_name || '').trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'zh-CN'),
  );
  const statusOptions = ['pending', 'paid', 'failed', 'expired', 'refunded'];
  const providerOptions = ['wechat_qr', 'alipay_qr', 'mock'];
  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner fig-page__header-inner--stack">
          <div>
            <h1>订单中心</h1>
            <p class="fig-page__description">查看充值订单、来源 OEM app、到账与 webhook 全链路明细</p>
          </div>
          <div class="fig-toolbar fig-toolbar--audit">
            <button class="ghost-button" type="button" data-action="export-payment-orders">导出 CSV</button>
            <label class="fig-search">
              ${icon('search', 'fig-search__icon')}
              <input class="field-input fig-search__input" data-filter-key="paymentQuery" placeholder="搜索订单号 / user / app / provider order id..." value="${fieldValue(state.filters.paymentQuery)}" />
            </label>
            <select class="field-select fig-filter" data-filter-key="paymentStatus">
              <option value="all">所有状态</option>
              ${statusOptions
                .map(
                  (status) => `<option value="${escapeHtml(status)}"${state.filters.paymentStatus === status ? ' selected' : ''}>${escapeHtml(paymentStatusLabel(status))}</option>`,
                )
                .join('')}
            </select>
            <select class="field-select fig-filter" data-filter-key="paymentProvider">
              <option value="all">所有渠道</option>
              ${providerOptions
                .map(
                  (provider) => `<option value="${escapeHtml(provider)}"${state.filters.paymentProvider === provider ? ' selected' : ''}>${escapeHtml(paymentProviderLabel(provider))}</option>`,
                )
                .join('')}
            </select>
            <select class="field-select fig-filter" data-filter-key="paymentApp">
              <option value="all">所有 OEM App</option>
              ${appNames
                .map(
                  (appName) => `<option value="${escapeHtml(appName)}"${state.filters.paymentApp === appName ? ' selected' : ''}>${escapeHtml(appName)}</option>`,
                )
                .join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="fig-page__body">
        ${renderPageGuide('订单页怎么用', [
          '先看左侧列表里的状态、金额、龙虾币、OEM app 和付款渠道，快速定位异常单。',
          '点开右侧详情后，可以看到 who、userId、provider order id、客户端版本、回调事件与原始 metadata。',
          '如果后续要接补单、退款、对账，这一页可以直接继续往下长，不需要重做结构。',
        ], 'payments')}
        <section class="fig-card fig-audit-table-card">
          <div class="fig-audit-table">
            <div class="fig-audit-table__header">
              <div>订单</div>
              <div>用户</div>
              <div>OEM App</div>
              <div>渠道</div>
              <div>金额 / 龙虾币</div>
            </div>
            <div class="fig-audit-table__body">
              ${items.length
                ? items
                    .map(
                      (item) => `
                        <button class="fig-audit-row${selectedPaymentOrder?.order_id === item.order_id ? ' is-active' : ''}" type="button" data-action="select-payment-order" data-order-id="${escapeHtml(item.order_id)}">
                          <div>
                            <div class="fig-audit-row__title">${escapeHtml(paymentStatusLabel(item.status))}</div>
                            <div class="fig-audit-row__detail">${escapeHtml(item.order_id)}</div>
                          </div>
                          <div>${escapeHtml(item.user_display_name || item.username || item.user_id)}</div>
                          <div>${escapeHtml(item.app_name || '未上报')}</div>
                          <div>${escapeHtml(paymentProviderLabel(item.provider))}</div>
                          <div>${escapeHtml(`${formatFen(item.amount_cny_fen)} / ${formatCredits(item.total_credits)}`)}</div>
                        </button>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">没有匹配的订单。</div>`}
            </div>
          </div>
        </section>
        ${
          selectedPaymentOrder
            ? `
              <section class="fig-card">
                <div class="fig-card__head">
                  <div>
                    <h3>${escapeHtml(selectedPaymentOrder.order_id)}</h3>
                    <span>${escapeHtml(paymentStatusLabel(selectedPaymentOrder.status))} · ${escapeHtml(formatDateTime(selectedPaymentOrder.created_at))}</span>
                  </div>
                  <button class="ghost-button" type="button" data-action="refresh-page">刷新</button>
                </div>
                <div class="fig-meta-cards">
                  <div class="fig-meta-card"><span>Who</span><strong>${escapeHtml(selectedPaymentOrder.user_display_name || selectedPaymentOrder.username || selectedPaymentOrder.user_id)}</strong></div>
                  <div class="fig-meta-card"><span>User ID</span><strong>${escapeHtml(selectedPaymentOrder.user_id)}</strong></div>
                  <div class="fig-meta-card"><span>账号</span><strong>${escapeHtml(selectedPaymentOrder.user_email || selectedPaymentOrder.username || '未记录')}</strong></div>
                  <div class="fig-meta-card"><span>OEM App</span><strong>${escapeHtml(selectedPaymentOrder.app_name || '未上报')}</strong></div>
                  <div class="fig-meta-card"><span>支付渠道</span><strong>${escapeHtml(paymentProviderLabel(selectedPaymentOrder.provider))}</strong></div>
                  <div class="fig-meta-card"><span>金额</span><strong>${escapeHtml(formatFen(selectedPaymentOrder.amount_cny_fen))}</strong></div>
                  <div class="fig-meta-card"><span>充值额度</span><strong>${escapeHtml(formatCredits(selectedPaymentOrder.total_credits))}</strong></div>
                  <div class="fig-meta-card"><span>创建时间</span><strong>${escapeHtml(formatDateTime(selectedPaymentOrder.created_at))}</strong></div>
                  <div class="fig-meta-card"><span>支付时间</span><strong>${escapeHtml(formatDateTime(selectedPaymentOrder.paid_at))}</strong></div>
                  <div class="fig-meta-card"><span>过期时间</span><strong>${escapeHtml(formatDateTime(selectedPaymentOrder.expires_at))}</strong></div>
                  <div class="fig-meta-card"><span>Provider Order</span><strong>${escapeHtml(selectedPaymentOrder.provider_order_id || '未记录')}</strong></div>
                  <div class="fig-meta-card"><span>Webhook 数</span><strong>${escapeHtml(String(selectedPaymentOrder.webhook_event_count || 0))}</strong></div>
                </div>
                <section class="fig-card fig-card--subtle">
                  <div class="fig-card__head">
                    <h3>订单技术明细</h3>
                    <span>客户端与渠道侧字段</span>
                  </div>
                  <div class="fig-meta-cards">
                    <div class="fig-meta-card"><span>App Version</span><strong>${escapeHtml(selectedPaymentOrder.app_version || '未上报')}</strong></div>
                    <div class="fig-meta-card"><span>Release Channel</span><strong>${escapeHtml(selectedPaymentOrder.release_channel || '未上报')}</strong></div>
                    <div class="fig-meta-card"><span>Platform</span><strong>${escapeHtml(selectedPaymentOrder.platform || '未上报')}</strong></div>
                    <div class="fig-meta-card"><span>Arch</span><strong>${escapeHtml(selectedPaymentOrder.arch || '未上报')}</strong></div>
                    <div class="fig-meta-card"><span>Return URL</span><strong>${escapeHtml(selectedPaymentOrder.return_url || '未记录')}</strong></div>
                    <div class="fig-meta-card"><span>Prepay ID</span><strong>${escapeHtml(selectedPaymentOrder.provider_prepay_id || '未记录')}</strong></div>
                    <div class="fig-meta-card"><span>Latest Webhook</span><strong>${escapeHtml(formatDateTime(selectedPaymentOrder.latest_webhook_at))}</strong></div>
                    <div class="fig-meta-card"><span>Updated At</span><strong>${escapeHtml(formatDateTime(selectedPaymentOrder.updated_at))}</strong></div>
                  </div>
                </section>
                <section class="fig-card fig-card--subtle">
                  <div class="fig-card__head">
                    <h3>Metadata</h3>
                    <span>订单原始元数据</span>
                  </div>
                  <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(selectedPaymentDetail?.metadata || selectedPaymentOrder.metadata || {}))}</textarea>
                </section>
                ${
                  selectedPaymentOrder.status !== 'paid'
                    ? `
                      <section class="fig-card fig-card--subtle">
                        <div class="fig-card__head">
                          <h3>人工确认到账</h3>
                          <span>后台补单 / 运营补录</span>
                        </div>
                        <form id="payment-order-manual-form" class="space-y-4">
                          <input type="hidden" name="order_id" value="${escapeHtml(selectedPaymentOrder.order_id)}" />
                          <label class="field">
                            <span>Provider Order ID</span>
                            <input class="field-input" name="provider_order_id" value="${fieldValue(selectedPaymentOrder.provider_order_id || '')}" placeholder="渠道侧订单号，可选" />
                          </label>
                          <label class="field">
                            <span>Paid At</span>
                            <input class="field-input" name="paid_at" type="datetime-local" value="${fieldValue(formatDateTimeInputValue(selectedPaymentOrder.paid_at))}" />
                          </label>
                          <label class="field">
                            <span>备注</span>
                            <textarea class="field-textarea" name="note" rows="3" placeholder="例如：用户线下已付款，运营人工补单"></textarea>
                          </label>
                          <div class="fig-release-card__actions">
                            <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>${state.busy ? '提交中…' : '人工确认到账'}</button>
                          </div>
                        </form>
                      </section>
                    `
                    : ''
                }
                ${
                  selectedPaymentOrder.status === 'paid'
                    ? `
                      <section class="fig-card fig-card--subtle">
                        <div class="fig-card__head">
                          <h3>人工退款/冲正</h3>
                          <span>仅对未消耗完充值余额的订单开放</span>
                        </div>
                        <form id="payment-order-refund-form" class="space-y-4">
                          <input type="hidden" name="order_id" value="${escapeHtml(selectedPaymentOrder.order_id)}" />
                          <label class="field">
                            <span>备注</span>
                            <textarea class="field-textarea" name="note" rows="3" placeholder="例如：用户重复支付，运营人工退款冲正"></textarea>
                          </label>
                          <div class="fig-release-card__actions">
                            <button class="ghost-button" type="submit"${state.busy ? ' disabled' : ''}>${state.busy ? '处理中…' : '人工退款/冲正'}</button>
                          </div>
                        </form>
                      </section>
                    `
                    : ''
                }
                <section class="fig-card fig-card--subtle">
                  <div class="fig-card__head">
                    <h3>Webhook Events</h3>
                    <span>支付渠道回调原文</span>
                  </div>
                  ${
                    selectedPaymentDetail?.webhook_events?.length
                      ? `
                        <div>
                          ${selectedPaymentDetail.webhook_events
                            .map(
                              (event) => `
                                <div class="fig-card fig-card--subtle">
                                  <div class="fig-meta-cards">
                                    <div class="fig-meta-card"><span>Event ID</span><strong>${escapeHtml(event.event_id)}</strong></div>
                                    <div class="fig-meta-card"><span>Status</span><strong>${escapeHtml(event.event_type || '未记录')}</strong></div>
                                    <div class="fig-meta-card"><span>Processed</span><strong>${escapeHtml(event.process_status || 'pending')}</strong></div>
                                    <div class="fig-meta-card"><span>Created</span><strong>${escapeHtml(formatDateTime(event.created_at))}</strong></div>
                                  </div>
                                  <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(event.payload || {}))}</textarea>
                                </div>
                              `,
                            )
                            .join('')}
                        </div>
                      `
                      : `<div class="empty-state">暂无 webhook 回调。</div>`
                  }
                </section>
              </section>
            `
            : ''
        }
      </div>
    </div>
  `;
}

function renderAuditPage() {
  const items = getFilteredAudit();
  const selectedAudit = items.find((item) => item.id === state.selectedAuditId) || items[0] || null;
  const actions = Array.from(new Set(state.audit.map((item) => item.action).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'zh-CN'),
  );
  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner fig-page__header-inner--stack">
          <div>
            <h1>审计日志</h1>
            <p class="fig-page__description">portal app 的完整操作审计记录</p>
          </div>
          <div class="fig-toolbar fig-toolbar--audit">
            <label class="fig-search">
              ${icon('search', 'fig-search__icon')}
              <input class="field-input fig-search__input" data-filter-key="auditQuery" placeholder="搜索审计日志..." value="${fieldValue(state.filters.auditQuery)}" />
            </label>
            <select class="field-select fig-filter" data-filter-key="auditBrand">
              <option value="all">所有品牌</option>
              ${state.brands
                .map(
                  (brand) => `
                    <option value="${escapeHtml(brand.brandId)}"${state.filters.auditBrand === brand.brandId ? ' selected' : ''}>${escapeHtml(brand.displayName)}</option>
                  `,
                )
                .join('')}
            </select>
            <select class="field-select fig-filter" data-filter-key="auditAction">
              <option value="all">所有操作</option>
              ${actions
                .map(
                  (action) => `
                    <option value="${escapeHtml(action)}"${state.filters.auditAction === action ? ' selected' : ''}>${escapeHtml(actionLabel(action))}</option>
                  `,
                )
                .join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="fig-page__body">
        ${renderPageGuide('审计日志怎么看', [
          '这里记录 portal app 的关键操作，包括保存草稿、发布、回滚、资源变更等。',
          '先按品牌、操作类型或关键词筛选，再点具体记录查看 payload。',
          '发现异常后，可以直接从详情跳回对应品牌继续排查。',
        ], 'audit')}
        <section class="fig-card fig-audit-table-card">
          <div class="fig-audit-table">
            <div class="fig-audit-table__header">
              <div>操作</div>
              <div>品牌</div>
              <div>操作人</div>
              <div>环境</div>
              <div>时间戳</div>
            </div>
            <div class="fig-audit-table__body">
              ${items.length
                ? items
                    .map(
                      (item) => `
                        <button class="fig-audit-row${selectedAudit?.id === item.id ? ' is-active' : ''}" type="button" data-action="select-audit" data-audit-id="${escapeHtml(item.id)}">
                          <div>
                            <div class="fig-audit-row__title">${escapeHtml(actionLabel(item.action))}</div>
                            <div class="fig-audit-row__detail">${escapeHtml(item.environment || 'portal')}</div>
                          </div>
                          <div>${escapeHtml(item.brandDisplayName || item.brandId)}</div>
                          <div>${escapeHtml(item.actorName || item.actorUsername || 'system')}</div>
                          <div>${escapeHtml(item.environment || 'portal')}</div>
                          <div>${escapeHtml(formatDateTime(item.createdAt))}</div>
                        </button>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">没有匹配的审计记录。</div>`}
            </div>
          </div>
        </section>
        ${
          selectedAudit
            ? `
              <section class="fig-card">
                <div class="fig-card__head">
                  <div>
                    <h3>${escapeHtml(actionLabel(selectedAudit.action))}</h3>
                    <span>${escapeHtml(selectedAudit.brandDisplayName || selectedAudit.brandId)} · ${escapeHtml(formatDateTime(selectedAudit.createdAt))}</span>
                  </div>
                  <button class="ghost-button" type="button" data-action="select-brand" data-brand-id="${escapeHtml(selectedAudit.brandId)}">打开品牌</button>
                </div>
                <div class="fig-meta-cards">
                  <div class="fig-meta-card"><span>操作人</span><strong>${escapeHtml(selectedAudit.actorName || selectedAudit.actorUsername || 'system')}</strong></div>
                  <div class="fig-meta-card"><span>环境</span><strong>${escapeHtml(selectedAudit.environment || 'portal')}</strong></div>
                  <div class="fig-meta-card"><span>Brand</span><strong>${escapeHtml(selectedAudit.brandId)}</strong></div>
                </div>
                <section class="fig-card fig-card--subtle">
                  <div class="fig-card__head">
                    <h3>审计详情</h3>
                    <span>真实 payload</span>
                  </div>
                  <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(selectedAudit.payload || {}))}</textarea>
                </section>
              </section>
            `
            : ''
        }
      </div>
    </div>
  `;
}

function renderLoadingPage() {
  return `
    <section class="loading-panel">
      <div class="loading-spinner"></div>
      <p>控制面数据加载中…</p>
    </section>
  `;
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-stage">
        <div class="login-copy-group">
          <div class="brand-lockup brand-lockup--login">
            ${renderAdminLogo('brand-mark--login')}
            <div class="brand-lockup__copy">
              <p class="eyebrow">iClaw management console</p>
              <div class="brand-lockup__title">iClaw管理控制台</div>
            </div>
          </div>
          <h1>把品牌、版本、技能与发布放进同一个运营平面</h1>
          <p class="login-copy">
            当前后台直连真实 control-plane 接口，按 iClaw管理控制台设计稿重构。默认账号：<strong>admin / admin</strong>。
          </p>
          ${renderThemeModeSwitcher('theme-switcher--login')}
        </div>
        <form class="login-card" id="login-form" data-testid="admin-login-form">
          <label class="field">
            <span>Username</span>
            <input class="field-input" name="identifier" autocomplete="username" value="admin" data-testid="admin-login-identifier" />
          </label>
          <label class="field">
            <span>Password</span>
            <input class="field-input" name="password" type="password" autocomplete="current-password" value="admin" data-testid="admin-login-password" />
          </label>
          <div class="banner banner--error"${state.error ? '' : ' hidden'}>${escapeHtml(state.error)}</div>
          <button class="solid-button solid-button--full" type="submit" data-testid="admin-login-submit"${state.busy ? ' disabled' : ''}>
            ${state.busy ? '进入中…' : '进入控制台'}
          </button>
        </form>
      </section>
    </main>
  `;
}

let customSelectListenersBound = false;
let menuAssemblyListenersBound = false;
let composerSortableListenersBound = false;
let shouldResetDashboardContentScroll = false;
const menuAssemblyDragState = {
  sourceKey: '',
  overKey: '',
  placement: 'before',
};
const composerSortableDragState = {
  kind: '',
  sourceKey: '',
  overKey: '',
  placement: 'before',
};

function closeCustomSelectMenus(exceptShell = null) {
  app.querySelectorAll('.field-select-shell.is-open').forEach((node) => {
    if (!(node instanceof HTMLElement) || node === exceptShell) {
      return;
    }
    node.classList.remove('is-open');
    const trigger = node.querySelector('.field-select-trigger');
    if (trigger instanceof HTMLButtonElement) {
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

function clearMenuAssemblyDragIndicators() {
  app.querySelectorAll('.menu-assembly-card.is-dragging, .menu-assembly-card.is-drop-before, .menu-assembly-card.is-drop-after').forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    node.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after');
  });
  document.body.classList.remove('is-dragging-menu-assembly');
}

function resetMenuAssemblyDragState() {
  menuAssemblyDragState.sourceKey = '';
  menuAssemblyDragState.overKey = '';
  menuAssemblyDragState.placement = 'before';
  clearMenuAssemblyDragIndicators();
}

function clearComposerSortableDragIndicators() {
  app.querySelectorAll('.sortable-card.is-dragging, .sortable-card.is-drop-before, .sortable-card.is-drop-after').forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    node.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after');
  });
  document.body.classList.remove('is-dragging-sortable-card');
}

function resetComposerSortableDragState() {
  composerSortableDragState.kind = '';
  composerSortableDragState.sourceKey = '';
  composerSortableDragState.overKey = '';
  composerSortableDragState.placement = 'before';
  clearComposerSortableDragIndicators();
}

function applyComposerSortableDropIndicator(targetCard, placement) {
  clearComposerSortableDragIndicators();
  document.body.classList.add('is-dragging-sortable-card');
  app.querySelectorAll('.sortable-card').forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    if (node.getAttribute('data-sortable-kind') === composerSortableDragState.kind &&
        node.getAttribute('data-sortable-key') === composerSortableDragState.sourceKey) {
      node.classList.add('is-dragging');
    }
  });
  if (!(targetCard instanceof HTMLElement)) {
    return;
  }
  targetCard.classList.add(placement === 'after' ? 'is-drop-after' : 'is-drop-before');
}

function applyMenuAssemblyDropIndicator(targetCard, placement) {
  clearMenuAssemblyDragIndicators();
  document.body.classList.add('is-dragging-menu-assembly');
  app.querySelectorAll('.menu-assembly-card').forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    if (node.getAttribute('data-menu-key') === menuAssemblyDragState.sourceKey) {
      node.classList.add('is-dragging');
    }
  });
  if (!(targetCard instanceof HTMLElement)) {
    return;
  }
  targetCard.classList.add(placement === 'after' ? 'is-drop-after' : 'is-drop-before');
}

function syncCustomSelectControl(select) {
  const shell = select.closest('.field-select-shell');
  if (!(shell instanceof HTMLElement)) {
    return;
  }
  const trigger = shell.querySelector('.field-select-trigger');
  const label = shell.querySelector('.field-select-trigger__label');
  const value = String(select.value || '');
  const selectedOption = Array.from(select.options).find((option) => option.value === value) || select.options[select.selectedIndex] || null;
  if (label instanceof HTMLElement) {
    label.textContent = (selectedOption?.textContent || '').trim() || select.getAttribute('placeholder') || '请选择';
    label.dataset.placeholder = selectedOption ? 'false' : 'true';
  }
  if (trigger instanceof HTMLButtonElement) {
    trigger.disabled = select.disabled;
  }
  shell.classList.toggle('is-disabled', select.disabled);
  shell.querySelectorAll('.field-select-option').forEach((node) => {
    if (!(node instanceof HTMLButtonElement)) {
      return;
    }
    const active = (node.getAttribute('data-value') || '') === value;
    node.classList.toggle('is-active', active);
    node.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function mountCustomSelect(select) {
  if (!(select instanceof HTMLSelectElement) || select.dataset.customSelectMounted === 'true') {
    return;
  }
  const shell = document.createElement('div');
  shell.className = 'field-select-shell';
  if (select.classList.contains('fig-filter')) {
    shell.classList.add('fig-filter-shell');
  }

  select.dataset.customSelectMounted = 'true';
  select.classList.add('field-select--native-hidden');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'field-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `
    <span class="field-select-trigger__copy">
      <span class="field-select-trigger__label"></span>
    </span>
    ${icon('chevronDown', 'field-select-trigger__caret')}
  `;

  const menu = document.createElement('div');
  menu.className = 'field-select-menu';
  menu.setAttribute('role', 'listbox');
  menu.innerHTML = Array.from(select.options)
    .map((option) => {
      const label = (option.textContent || '').trim();
      return `
        <button
          class="field-select-option"
          type="button"
          role="option"
          data-value="${escapeHtml(option.value)}"
          ${option.disabled ? 'disabled' : ''}
        >
          <span class="field-select-option__label">${escapeHtml(label)}</span>
          ${icon('check', 'field-select-option__check')}
        </button>
      `;
    })
    .join('');

  select.parentNode?.insertBefore(shell, select);
  shell.append(select, trigger, menu);

  trigger.addEventListener('click', () => {
    if (select.disabled) {
      return;
    }
    const willOpen = !shell.classList.contains('is-open');
    closeCustomSelectMenus(willOpen ? shell : null);
    shell.classList.toggle('is-open', willOpen);
    trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });

  menu.addEventListener('click', (event) => {
    const optionButton = event.target instanceof Element ? event.target.closest('.field-select-option') : null;
    if (!(optionButton instanceof HTMLButtonElement) || optionButton.disabled) {
      return;
    }
    const nextValue = optionButton.getAttribute('data-value') || '';
    if (select.value !== nextValue) {
      select.value = nextValue;
      select.dispatchEvent(new Event('change', {bubbles: true}));
    }
    syncCustomSelectControl(select);
    closeCustomSelectMenus();
  });

  select.addEventListener('change', () => {
    syncCustomSelectControl(select);
  });

  syncCustomSelectControl(select);
}

function ensureCustomSelectListeners() {
  if (customSelectListenersBound) {
    return;
  }
  customSelectListenersBound = true;

  document.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.field-select-shell')) {
      closeCustomSelectMenus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCustomSelectMenus();
    }
  });
}

function ensureMenuAssemblyListeners() {
  if (menuAssemblyListenersBound) {
    return;
  }
  menuAssemblyListenersBound = true;

  document.addEventListener('dragstart', (event) => {
    const target = event.target;
    const card = target instanceof Element ? target.closest('.menu-assembly-card[data-menu-key]') : null;
    if (!(card instanceof HTMLElement)) {
      return;
    }
    const menuKey = String(card.getAttribute('data-menu-key') || '').trim();
    if (!menuKey) {
      return;
    }
    menuAssemblyDragState.sourceKey = menuKey;
    menuAssemblyDragState.overKey = '';
    menuAssemblyDragState.placement = 'before';
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', menuKey);
    }
    requestAnimationFrame(() => {
      clearMenuAssemblyDragIndicators();
      card.classList.add('is-dragging');
      document.body.classList.add('is-dragging-menu-assembly');
    });
  });

  document.addEventListener('dragover', (event) => {
    if (!menuAssemblyDragState.sourceKey) {
      return;
    }
    const target = event.target;
    const card = target instanceof Element ? target.closest('.menu-assembly-card[data-menu-key]') : null;
    if (!(card instanceof HTMLElement)) {
      return;
    }
    const targetKey = String(card.getAttribute('data-menu-key') || '').trim();
    if (!targetKey || targetKey === menuAssemblyDragState.sourceKey) {
      return;
    }
    event.preventDefault();
    const rect = card.getBoundingClientRect();
    const placement = event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before';
    menuAssemblyDragState.overKey = targetKey;
    menuAssemblyDragState.placement = placement;
    applyMenuAssemblyDropIndicator(card, placement);
  });

  document.addEventListener('drop', (event) => {
    if (!menuAssemblyDragState.sourceKey) {
      return;
    }
    const target = event.target;
    const card = target instanceof Element ? target.closest('.menu-assembly-card[data-menu-key]') : null;
    const sourceKey = menuAssemblyDragState.sourceKey;
    const targetKey = card instanceof HTMLElement ? String(card.getAttribute('data-menu-key') || '').trim() : '';
    const placement = menuAssemblyDragState.placement;
    event.preventDefault();
    resetMenuAssemblyDragState();
    if (!targetKey || targetKey === sourceKey) {
      return;
    }
    reorderBrandMenu(sourceKey, targetKey, placement);
  });

  document.addEventListener('dragend', () => {
    resetMenuAssemblyDragState();
  });
}

function ensureComposerSortableListeners() {
  if (composerSortableListenersBound) {
    return;
  }
  composerSortableListenersBound = true;

  document.addEventListener('dragstart', (event) => {
    const target = event.target;
    const card = target instanceof Element ? target.closest('.sortable-card[data-sortable-kind][data-sortable-key]') : null;
    if (!(card instanceof HTMLElement)) {
      return;
    }
    const kind = String(card.getAttribute('data-sortable-kind') || '').trim();
    const key = String(card.getAttribute('data-sortable-key') || '').trim();
    if (!kind || !key) {
      return;
    }
    composerSortableDragState.kind = kind;
    composerSortableDragState.sourceKey = key;
    composerSortableDragState.overKey = '';
    composerSortableDragState.placement = 'before';
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `${kind}:${key}`);
    }
    requestAnimationFrame(() => {
      clearComposerSortableDragIndicators();
      card.classList.add('is-dragging');
      document.body.classList.add('is-dragging-sortable-card');
    });
  });

  document.addEventListener('dragover', (event) => {
    if (!composerSortableDragState.sourceKey || !composerSortableDragState.kind) {
      return;
    }
    const target = event.target;
    const card = target instanceof Element ? target.closest('.sortable-card[data-sortable-kind][data-sortable-key]') : null;
    if (!(card instanceof HTMLElement)) {
      return;
    }
    const kind = String(card.getAttribute('data-sortable-kind') || '').trim();
    const key = String(card.getAttribute('data-sortable-key') || '').trim();
    if (!kind || kind !== composerSortableDragState.kind || !key || key === composerSortableDragState.sourceKey) {
      return;
    }
    event.preventDefault();
    const rect = card.getBoundingClientRect();
    const placement = event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before';
    composerSortableDragState.overKey = key;
    composerSortableDragState.placement = placement;
    applyComposerSortableDropIndicator(card, placement);
  });

  document.addEventListener('drop', (event) => {
    if (!composerSortableDragState.sourceKey || !composerSortableDragState.kind) {
      return;
    }
    const target = event.target;
    const card = target instanceof Element ? target.closest('.sortable-card[data-sortable-kind][data-sortable-key]') : null;
    const kind = composerSortableDragState.kind;
    const sourceKey = composerSortableDragState.sourceKey;
    const targetKey = card instanceof HTMLElement ? String(card.getAttribute('data-sortable-key') || '').trim() : '';
    const placement = composerSortableDragState.placement;
    event.preventDefault();
    resetComposerSortableDragState();
    if (!targetKey || targetKey === sourceKey) {
      return;
    }
    if (kind === 'composer-control') {
      reorderBrandComposerControl(sourceKey, targetKey, placement);
      return;
    }
    if (kind === 'composer-shortcut') {
      reorderBrandComposerShortcut(sourceKey, targetKey, placement);
    }
  });

  document.addEventListener('dragend', () => {
    resetComposerSortableDragState();
  });
}

function enhanceCustomSelects() {
  ensureCustomSelectListeners();
  ensureMenuAssemblyListeners();
  ensureComposerSortableListeners();
  app.querySelectorAll('select.field-select').forEach((node) => {
    if (node instanceof HTMLSelectElement) {
      mountCustomSelect(node);
      syncCustomSelectControl(node);
    }
  });
}

function ensureDashboardShell() {
  let shell = app.querySelector('[data-dashboard-shell="true"]');
  if (!(shell instanceof HTMLElement)) {
    app.innerHTML = `
      <main class="shell" data-dashboard-shell="true">
        <div data-dashboard-sidebar="true"></div>
        <section class="content" data-dashboard-content="true"></section>
      </main>
    `;
    shell = app.querySelector('[data-dashboard-shell="true"]');
  }
  const sidebarHost = app.querySelector('[data-dashboard-sidebar="true"]');
  const contentHost = app.querySelector('[data-dashboard-content="true"]');
  if (!(shell instanceof HTMLElement) || !(sidebarHost instanceof HTMLElement) || !(contentHost instanceof HTMLElement)) {
    throw new Error('dashboard shell mount failed');
  }
  return {shell, sidebarHost, contentHost};
}

function renderDashboardErrorPage(route, error) {
  const message = error instanceof Error ? error.message : String(error || 'unknown dashboard render error');
  const stack = error instanceof Error ? error.stack || '' : '';
  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>页面渲染失败</h1>
            <p class="fig-page__description">当前路由：${escapeHtml(route || 'unknown')}</p>
          </div>
        </div>
      </div>
      <div class="fig-page__body">
        <section class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>错误信息</h3>
            <span>admin-web runtime error</span>
          </div>
          <textarea class="code-input code-input--tall" readonly>${escapeHtml(`${message}${stack ? `\n\n${stack}` : ''}`)}</textarea>
        </section>
      </div>
    </div>
  `;
}

function renderDashboard() {
  let pageContent = '';
  try {
    pageContent = state.loading
      ? renderLoadingPage()
      : state.route === 'overview'
        ? renderOverviewPage()
        : state.route === 'brands'
          ? renderBrandsPage()
        : state.route === 'agent-center'
          ? renderAgentCenterPage()
        : state.route === 'brand-detail'
          ? renderBrandDetailPage()
          : isCapabilityRoute(state.route)
            ? renderSkillsMcpPage()
            : state.route === 'cloud-skills'
            ? renderCloudSkillsPage()
            : state.route === 'cloud-mcps'
              ? renderCloudMcpsPage()
            : state.route === 'runtime-management'
              ? renderRuntimeManagementPage()
            : state.route === 'assets'
              ? renderAssetsPage()
              : state.route === 'releases'
                ? renderReleasesPage()
                : state.route === 'payments-config'
                  ? renderPaymentProviderConfigPage()
                  : state.route === 'payments-packages'
                    ? renderRechargePackageCatalogPage()
                  : state.route === 'payments-orders'
                    ? renderPaymentsPage()
                  : renderAuditPage();
  } catch (error) {
    console.error('[admin-web] dashboard render failed', {route: state.route, error});
    pageContent = renderDashboardErrorPage(state.route, error);
  }

  const {sidebarHost, contentHost} = ensureDashboardShell();
  const previousNavList = sidebarHost.querySelector('.nav-list');
  const previousSidebarScrollTop = previousNavList instanceof HTMLElement ? previousNavList.scrollTop : 0;
  const previousContentScrollTop = contentHost.scrollTop;

  sidebarHost.innerHTML = renderSidebar();
  contentHost.innerHTML = `
    ${renderBanner()}
    ${pageContent}
  `;

  const nextNavList = sidebarHost.querySelector('.nav-list');
  if (nextNavList instanceof HTMLElement) {
    nextNavList.scrollTop = previousSidebarScrollTop;
  }
  contentHost.scrollTop = shouldResetDashboardContentScroll ? 0 : previousContentScrollTop;
  shouldResetDashboardContentScroll = false;
}

function render() {
  if (state.view === 'dashboard') {
    renderDashboard();
  } else {
    renderLogin();
  }
  enhanceCustomSelects();
}

app.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  event.preventDefault();

  if (form.id === 'login-form') {
    const data = new FormData(form);
    await authenticate(String(data.get('identifier') || ''), String(data.get('password') || ''));
    return;
  }

  if (form.id === 'create-brand-form') {
    await createBrand(new FormData(form));
    return;
  }

  if (form.id === 'brand-editor-form') {
    await saveBrandEditor(form);
    return;
  }

  if (form.id === 'asset-form') {
    await saveAsset(new FormData(form));
    return;
  }

  if (form.id === 'desktop-release-publish-form') {
    await publishDesktopRelease(new FormData(form));
    return;
  }

  if (form.id === 'agent-editor-form') {
    await saveAgentCatalogEntry(new FormData(form));
    return;
  }

  if (form.id === 'skill-import-form') {
    await importSkill(new FormData(form));
    return;
  }

  if (form.id === 'platform-skill-add-form') {
    await addPlatformSkillFromCloud(new FormData(form));
    return;
  }

  if (form.id === 'skill-sync-source-form') {
    await saveSkillSyncSource(new FormData(form));
    return;
  }

  if (form.id === 'platform-mcp-add-form') {
    await addPlatformMcpFromRegistry(new FormData(form));
    return;
  }

  if (form.id === 'mcp-editor-form') {
    await saveMcpCatalogEntry(new FormData(form));
    return;
  }

  if (form.id === 'cloud-mcp-editor-form') {
    await saveCloudMcpCatalogEntry(new FormData(form));
    return;
  }

  if (form.id === 'model-editor-form') {
    await saveModelCatalogEntry(new FormData(form));
    return;
  }

  if (form.id === 'model-provider-form') {
    await saveModelProviderProfile(form);
    return;
  }

  if (form.id === 'memory-embedding-form') {
    await saveMemoryEmbeddingProfile(form);
    return;
  }

  if (form.id === 'runtime-release-form') {
    await saveRuntimeRelease(form);
    return;
  }

  if (form.id === 'runtime-binding-form') {
    await saveRuntimeBinding(form);
    return;
  }

  if (form.id === 'payment-provider-form') {
    await savePaymentProviderConfig(form);
    return;
  }

  if (form.id === 'payment-gateway-form') {
    await savePaymentGatewayConfig(form);
    return;
  }

  if (form.id === 'recharge-package-form') {
    await saveRechargePackageCatalogEntry(form);
    return;
  }

  if (form.id === 'payment-order-manual-form') {
    const data = new FormData(form);
    const orderId = String(data.get('order_id') || '').trim();
    await markPaymentOrderPaid(orderId, {
      provider_order_id: String(data.get('provider_order_id') || '').trim(),
      paid_at: (() => {
        const raw = String(data.get('paid_at') || '').trim();
        if (!raw) return '';
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? raw : date.toISOString();
      })(),
      note: String(data.get('note') || '').trim(),
    });
    return;
  }

  if (form.id === 'payment-order-refund-form') {
    const data = new FormData(form);
    const orderId = String(data.get('order_id') || '').trim();
    await refundPaymentOrder(orderId, {
      note: String(data.get('note') || '').trim(),
    });
  }
});

app.addEventListener('input', (event) => {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const form = target?.closest('form');
  if (form instanceof HTMLFormElement && form.id === 'model-provider-form') {
    captureModelProviderDraft(form);
    return;
  }
  if (form instanceof HTMLFormElement && form.id === 'memory-embedding-form') {
    captureMemoryEmbeddingDraft(form);
    state.memoryEmbeddingTestResult = null;
    return;
  }
  if (form instanceof HTMLFormElement && form.id === 'runtime-release-form') {
    captureRuntimeReleaseDraft(form);
    return;
  }
  if (form instanceof HTMLFormElement && form.id === 'runtime-binding-form') {
    captureRuntimeBindingDraft(form);
  }
});

app.addEventListener('change', (event) => {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const form = target?.closest('form');
  if (form instanceof HTMLFormElement && form.id === 'payment-gateway-form') {
    const changedField = target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement ? target.name : '';
    if (changedField !== 'mode') {
      return;
    }
    const scopeType =
      String(new FormData(form).get('scope_type') || 'platform').trim() === 'app' ? 'app' : 'platform';
    const scopeKey = String(new FormData(form).get('scope_key') || (scopeType === 'app' ? getSelectedPaymentProviderTab() : 'platform'))
      .trim()
      .toLowerCase() || 'platform';
    const mode =
      scopeType === 'app' && String(new FormData(form).get('mode') || '').trim() === 'inherit_platform'
        ? 'inherit_platform'
        : 'use_app_config';
    state.paymentGatewayModeDrafts[getPaymentGatewayModeDraftKey(scopeType, scopeKey)] = mode;
    render();
    return;
  }
  if (form instanceof HTMLFormElement && form.id === 'model-provider-form') {
    captureModelProviderDraft(form);
    render();
    return;
  }
  if (form instanceof HTMLFormElement && form.id === 'memory-embedding-form') {
    captureMemoryEmbeddingDraft(form);
    state.memoryEmbeddingTestResult = null;
    return;
  }
  if (form instanceof HTMLFormElement && form.id === 'runtime-release-form') {
    captureRuntimeReleaseDraft(form);
    render();
    return;
  }
  if (form instanceof HTMLFormElement && form.id === 'runtime-binding-form') {
    captureRuntimeBindingDraft(form);
    render();
  }
});

app.addEventListener('click', async (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
  if (!target) {
    return;
  }

  const action = target.getAttribute('data-action');

  if (action === 'set-theme-mode') {
    setThemeMode(target.getAttribute('data-theme-mode') || 'system');
    render();
    return;
  }

  if (action === 'navigate') {
    captureBrandEditorBuffer();
    const nextRoute = target.getAttribute('data-page') || 'overview';
    shouldResetDashboardContentScroll = state.route !== nextRoute;
    state.route = nextRoute;
    if (isCapabilityRoute(state.route)) {
      state.capabilityMode = getCapabilityModeForRoute(state.route);
    }
    if (state.route === 'runtime-management') {
      await refreshRuntimeManagementData({suppressRender: true}).catch((error) => {
        setError(error instanceof Error ? error.message : 'runtime 管理数据刷新失败');
      });
    }
    if (state.route === 'payments-orders' && state.selectedPaymentOrderId) {
      await ensurePaymentOrderDetail(state.selectedPaymentOrderId);
    }
    render();
    return;
  }

  if (action === 'toggle-nav-group') {
    const groupId = String(target.getAttribute('data-group-id') || '').trim();
    if (!groupId) {
      return;
    }
    state.navGroupsCollapsed = {
      ...(state.navGroupsCollapsed || {}),
      [groupId]: !isNavGroupCollapsed(groupId),
    };
    persistNavGroupsCollapsedState();
    render();
    return;
  }

  if (action === 'toggle-create-brand') {
    state.showCreateBrandForm = !state.showCreateBrandForm;
    render();
    return;
  }

  if (action === 'toggle-agent-import') {
    state.showAgentImportPanel = !state.showAgentImportPanel;
    render();
    return;
  }

  if (action === 'toggle-skill-import') {
    state.showSkillImportPanel = !state.showSkillImportPanel;
    render();
    return;
  }

  if (action === 'toggle-platform-skill-add') {
    state.showPlatformSkillAddPanel = !state.showPlatformSkillAddPanel;
    render();
    return;
  }

  if (action === 'toggle-platform-mcp-add') {
    state.showPlatformMcpAddPanel = !state.showPlatformMcpAddPanel;
    render();
    return;
  }

  if (action === 'toggle-skill-sync-source-form') {
    state.showSkillSyncSourceForm = !state.showSkillSyncSourceForm;
    render();
    return;
  }

  if (action === 'select-skill-sync-source') {
    state.selectedSkillSyncSourceId = target.getAttribute('data-source-id') || '';
    render();
    return;
  }

  if (action === 'run-skill-sync') {
    await runSkillSync(target.getAttribute('data-source-id') || '');
    return;
  }

  if (action === 'select-cloud-skill') {
    state.selectedCloudSkillSlug = target.getAttribute('data-skill-slug') || '';
    render();
    return;
  }

  if (action === 'select-cloud-mcp') {
    state.selectedCloudMcpKey = target.getAttribute('data-mcp-key') || '';
    state.mcpTestResult = null;
    render();
    return;
  }

  if (action === 'search-cloud-skills') {
    await loadCloudSkillCatalogPage({
      query: getAdminSkillCatalogQueryValue('[data-cloud-skill-query]', state.cloudSkillCatalogMeta.query),
      offset: 0,
    });
    return;
  }

  if (action === 'clear-cloud-skills') {
    await loadCloudSkillCatalogPage({query: '', offset: 0});
    return;
  }

  if (action === 'cloud-skills-prev-page') {
    await loadCloudSkillCatalogPage({
      offset: Math.max(0, Number(state.cloudSkillCatalogMeta.offset || 0) - Number(state.cloudSkillCatalogMeta.limit || ADMIN_SKILL_BROWSER_PAGE_SIZE)),
    });
    return;
  }

  if (action === 'cloud-skills-next-page') {
    await loadCloudSkillCatalogPage({
      offset: Number(state.cloudSkillCatalogMeta.nextOffset || Number(state.cloudSkillCatalogMeta.offset || 0) + Number(state.cloudSkillCatalogMeta.limit || ADMIN_SKILL_BROWSER_PAGE_SIZE)),
    });
    return;
  }

  if (action === 'new-agent') {
    state.route = 'agent-center';
    state.selectedAgentSlug = '__new__';
    state.showAgentImportPanel = true;
    render();
    return;
  }

  if (action === 'select-agent') {
    state.route = 'agent-center';
    state.selectedAgentSlug = target.getAttribute('data-agent-slug') || '';
    state.showAgentImportPanel = false;
    render();
    return;
  }

  if (action === 'agent-filter-reset') {
    state.filters.agentQuery = '';
    state.filters.agentStatus = 'all';
    state.filters.agentSurface = 'all';
    state.filters.agentSourceRepo = 'all';
    render();
    return;
  }

  if (action === 'agent-toggle') {
    const enabled = target.getAttribute('data-enabled') === 'true';
    await setAgentEnabled(target.getAttribute('data-agent-slug') || '', !enabled);
    return;
  }

  if (action === 'agent-delete') {
    const slug = target.getAttribute('data-agent-slug') || '';
    if (window.confirm(`确认删除 Agent ${slug}？`)) {
      await deleteAgentCatalogEntry(slug);
    }
    return;
  }

  if (action === 'cloud-skill-toggle') {
    const slug = target.getAttribute('data-skill-slug') || '';
    const enabled = target.getAttribute('data-enabled') === 'true';
    await setCloudSkillEnabled(slug, !enabled);
    return;
  }

  if (action === 'new-skill') {
    state.capabilityMode = 'skills';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    state.showPlatformSkillAddPanel = !state.showPlatformSkillAddPanel;
    render();
    return;
  }

  if (action === 'new-mcp') {
    state.capabilityMode = 'mcp';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    state.showPlatformMcpAddPanel = !state.showPlatformMcpAddPanel;
    state.mcpTestResult = null;
    render();
    return;
  }

  if (action === 'new-cloud-mcp') {
    state.route = 'cloud-mcps';
    state.selectedCloudMcpKey = '__new__';
    state.mcpTestResult = null;
    render();
    return;
  }

  if (action === 'new-model') {
    state.capabilityMode = 'models';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    state.selectedModelRef = '__new__';
    render();
    return;
  }

  if (action === 'toggle-asset-upload') {
    state.showAssetUploadPanel = !state.showAssetUploadPanel;
    render();
    return;
  }

  if (action === 'set-asset-kind') {
    state.filters.assetKind = target.getAttribute('data-kind') || 'all';
    render();
    return;
  }

  if (action === 'select-brand') {
    captureBrandEditorBuffer();
    state.route = 'brand-detail';
    state.brandDetailTab = 'desktop';
    await loadBrandDetail(target.getAttribute('data-brand-id') || '');
    return;
  }

  if (action === 'brand-tab') {
    captureBrandEditorBuffer();
    state.brandDetailTab = normalizeBrandDetailTab(target.getAttribute('data-tab') || 'desktop');
    render();
    return;
  }

  if (action === 'brand-tab-group') {
    captureBrandEditorBuffer();
    const groupId = target.getAttribute('data-group-id') || '';
    const group = BRAND_DETAIL_TAB_GROUPS.find((item) => item.id === groupId) || BRAND_DETAIL_TAB_GROUPS[0];
    state.brandDetailTab = normalizeBrandDetailTab(group?.tabs[0] || 'desktop');
    render();
    return;
  }

  if (action === 'capability-mode') {
    state.capabilityMode = target.getAttribute('data-mode') || 'skills';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    render();
    return;
  }

  if (action === 'select-model-provider-tab') {
    state.capabilityMode = 'models';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    state.selectedModelProviderTab = target.getAttribute('data-tab-key') || 'platform';
    state.memoryEmbeddingTestResult = null;
    render();
    return;
  }

  if (action === 'select-model-center-section') {
    state.capabilityMode = 'models';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    state.selectedModelCenterSection = target.getAttribute('data-section-key') || 'chat-provider';
    render();
    return;
  }

  if (action === 'select-runtime-section') {
    state.route = 'runtime-management';
    state.selectedRuntimeSection = target.getAttribute('data-runtime-section') || 'release';
    render();
    return;
  }

  if (action === 'new-runtime-release') {
    state.route = 'runtime-management';
    state.selectedRuntimeSection = 'release';
    state.selectedRuntimeReleaseId = '__new__';
    state.runtimeReleaseDraftBuffer = buildRuntimeReleaseDraft(null);
    render();
    return;
  }

  if (action === 'select-runtime-release') {
    state.route = 'runtime-management';
    state.selectedRuntimeSection = 'release';
    state.selectedRuntimeReleaseId = target.getAttribute('data-release-id') || '';
    state.runtimeReleaseDraftBuffer = null;
    render();
    return;
  }

  if (action === 'new-runtime-binding') {
    state.route = 'runtime-management';
    state.selectedRuntimeSection = 'binding';
    state.selectedRuntimeBindingId = '__new__';
    state.runtimeBindingDraftBuffer = buildRuntimeBindingDraft(null);
    render();
    return;
  }

  if (action === 'select-runtime-binding') {
    state.route = 'runtime-management';
    state.selectedRuntimeSection = 'binding';
    state.selectedRuntimeBindingId = target.getAttribute('data-binding-id') || '';
    state.runtimeBindingDraftBuffer = null;
    render();
    return;
  }

  if (action === 'import-runtime-bootstrap') {
    await importLegacyRuntimeBootstrapSource();
    return;
  }

  if (action === 'refresh-runtime-bootstrap') {
    state.busy = true;
    resetBanner();
    render();
    try {
      await refreshRuntimeManagementData({suppressRender: true});
    } catch (error) {
      setError(error instanceof Error ? error.message : 'runtime bootstrap 刷新失败');
      state.busy = false;
      return;
    }
    state.busy = false;
    render();
    return;
  }

  if (action === 'restore-platform-model-provider') {
    const appName = target.getAttribute('data-app-name') || '';
    if (appName && window.confirm(`确认让 ${appName} 恢复跟随平台 Provider？`)) {
      await restorePlatformModelProvider(appName);
    }
    return;
  }

  if (action === 'restore-platform-memory-embedding') {
    const appName = target.getAttribute('data-app-name') || '';
    if (appName && window.confirm(`确认让 ${appName} 恢复跟随平台记忆 Embedding？`)) {
      await restorePlatformMemoryEmbedding(appName);
    }
    return;
  }

  if (action === 'test-memory-embedding') {
    const form = target.closest('form');
    if (form instanceof HTMLFormElement) {
      await testMemoryEmbeddingProfile(form);
    }
    return;
  }

  if (action === 'select-payment-provider-tab') {
    state.route = 'payments-config';
    state.selectedPaymentProviderTab = target.getAttribute('data-tab-key') || 'platform';
    render();
    return;
  }

  if (action === 'new-recharge-package') {
    state.route = 'payments-packages';
    state.selectedRechargePackageId = '__new__';
    render();
    return;
  }

  if (action === 'restore-recommended-recharge-packages') {
    if (window.confirm('确认恢复平台超值推荐三挡套餐？这会把平台套餐目录重置为 29.9 / 59.9 / 99.9 三挡，并删除其它平台套餐。')) {
      await restoreRecommendedRechargePackages();
    }
    return;
  }

  if (action === 'select-recharge-package') {
    state.route = 'payments-packages';
    state.selectedRechargePackageId = target.getAttribute('data-package-id') || '';
    render();
    return;
  }

  if (action === 'delete-recharge-package') {
    const packageId = target.getAttribute('data-package-id') || '';
    if (window.confirm(`确认删除充值套餐 ${packageId}？`)) {
      await deleteRechargePackageCatalogEntry(packageId);
    }
    return;
  }

  if (action === 'apply-home-web-assembly-preset') {
    const presetKey = target.getAttribute('data-preset-key') || '';
    const preset = HOME_WEB_SURFACE_PRESETS.find((item) => item.key === presetKey) || null;
    const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
    if (!buffer || !preset) {
      return;
    }
    applyHomeWebAssemblyPresetToBuffer(buffer, preset);
    state.brandDraftBuffer = buffer;
    setNotice(`已填充 Home 模板：${preset.label}`);
    render();
    return;
  }

  if (action === 'apply-sidebar-assembly-preset') {
    const presetKey = target.getAttribute('data-preset-key') || '';
    const preset = SIDEBAR_SURFACE_PRESETS.find((item) => item.key === presetKey) || null;
    const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
    if (!buffer || !preset) {
      return;
    }
    applySidebarAssemblyPresetToBuffer(buffer, preset);
    state.brandDraftBuffer = buffer;
    setNotice(`已填充 Sidebar 模板：${preset.label}`);
    render();
    return;
  }

  if (action === 'apply-input-assembly-preset') {
    const presetKey = target.getAttribute('data-preset-key') || '';
    const preset = INPUT_ASSEMBLY_PRESETS.find((item) => item.key === presetKey) || null;
    const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
    if (!buffer || !preset) {
      return;
    }
    applyInputAssemblyPresetToBuffer(buffer, preset);
    state.brandDraftBuffer = buffer;
    setNotice(`已填充输入框模板：${preset.label}`);
    render();
    return;
  }

  if (action === 'apply-welcome-assembly-preset') {
    const presetKey = target.getAttribute('data-preset-key') || '';
    const preset = WELCOME_ASSEMBLY_PRESETS.find((item) => item.key === presetKey) || null;
    const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
    if (!buffer || !preset) {
      return;
    }
    applyWelcomeAssemblyPresetToBuffer(buffer, preset);
    state.brandDraftBuffer = buffer;
    setNotice(`已填充 Welcome 模板：${preset.label}`);
    render();
    return;
  }

  if (action === 'apply-header-assembly-preset') {
    const presetKey = target.getAttribute('data-preset-key') || '';
    const preset = HEADER_SURFACE_PRESETS.find((item) => item.key === presetKey) || null;
    const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
    if (!buffer || !preset) {
      return;
    }
    applyHeaderAssemblyPresetToBuffer(buffer, preset);
    state.brandDraftBuffer = buffer;
    setNotice(`已填充 Header 模板：${preset.label}`);
    render();
    return;
  }

  if (action === 'add-metadata-entry') {
    const editorName = target.getAttribute('data-editor-name') || '';
    const editor = editorName ? document.querySelector(`[data-metadata-editor="${CSS.escape(editorName)}"]`) : null;
    const stack = editor?.querySelector('.fig-kv-editor__stack');
    if (!(editor instanceof HTMLElement) || !(stack instanceof HTMLElement)) {
      return;
    }
    const nextIndex = stack.querySelectorAll('[data-metadata-entry]').length;
    const row = document.createElement('div');
    row.className = 'fig-kv-row';
    row.setAttribute('data-metadata-entry', 'true');
    row.innerHTML = `
      <label class="field">
        <span>字段路径</span>
        <input class="field-input" name="${escapeHtml(editorName)}__path__${nextIndex}" placeholder="例如 sourceType / setup.schemaVersion" />
      </label>
      <label class="field">
        <span>类型</span>
        <select class="field-select" name="${escapeHtml(editorName)}__type__${nextIndex}">
          <option value="string">文本</option>
          <option value="number">数字</option>
          <option value="boolean">布尔</option>
        </select>
      </label>
      <label class="field">
        <span>值</span>
        <input class="field-input" name="${escapeHtml(editorName)}__value__${nextIndex}" placeholder="字段值" />
      </label>
      <button class="ghost-button fig-kv-row__remove" type="button" data-action="remove-metadata-entry">删除</button>
    `;
    stack.appendChild(row);
    enhanceCustomSelects();
    return;
  }

  if (action === 'remove-metadata-entry') {
    const row = target.closest('[data-metadata-entry]');
    const stack = row?.parentElement;
    if (!(row instanceof HTMLElement) || !(stack instanceof HTMLElement)) {
      return;
    }
    if (stack.querySelectorAll('[data-metadata-entry]').length <= 1) {
      const pathInput = row.querySelector('input[name*="__path__"]');
      const valueInput = row.querySelector('input[name*="__value__"]');
      const typeInput = row.querySelector('select[name*="__type__"]');
      if (pathInput instanceof HTMLInputElement) pathInput.value = '';
      if (valueInput instanceof HTMLInputElement) valueInput.value = '';
      if (typeInput instanceof HTMLSelectElement) typeInput.value = 'string';
      return;
    }
    row.remove();
    return;
  }

  if (action === 'capability-filter-reset') {
    resetCapabilityFilters();
    render();
    return;
  }

  if (action === 'select-skill') {
    state.capabilityMode = 'skills';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    state.selectedSkillSlug = target.getAttribute('data-skill-slug') || '';
    state.showSkillImportPanel = false;
    state.showPlatformSkillAddPanel = false;
    render();
    return;
  }

  if (action === 'select-mcp') {
    state.capabilityMode = 'mcp';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    state.selectedMcpKey = target.getAttribute('data-mcp-key') || '';
    state.showPlatformMcpAddPanel = false;
    state.mcpTestResult = null;
    render();
    return;
  }

  if (action === 'select-model') {
    state.capabilityMode = 'models';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    state.selectedModelRef = target.getAttribute('data-model-ref') || '';
    render();
    return;
  }

  if (action === 'add-provider-model-row') {
    appendProviderModelRow({});
    const form = target.closest('form');
    if (form instanceof HTMLFormElement) {
      captureModelProviderDraft(form);
      render();
    }
    return;
  }

  if (action === 'remove-provider-model-row') {
    const row = target.closest('[data-model-provider-row="true"]');
    if (row && row.parentElement && row.parentElement.querySelectorAll('[data-model-provider-row="true"]').length > 1) {
      row.remove();
      const form = target.closest('form');
      if (form instanceof HTMLFormElement) {
        captureModelProviderDraft(form);
        render();
      }
    }
    return;
  }

  if (action === 'pick-model-logo') {
    const form = target.closest('form');
    if (form instanceof HTMLFormElement) {
      openModelLogoPicker(form, target.getAttribute('data-input-name') || '');
    }
    return;
  }

  if (action === 'clear-model-logo') {
    const form = target.closest('form');
    const inputName = target.getAttribute('data-input-name') || '';
    if (form instanceof HTMLFormElement && inputName) {
      const input = form.querySelector(`[name="${inputName}"]`);
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
        input.value = '';
      }
      const preview = target.closest('.field')?.querySelector('[data-logo-preview="true"]');
      if (preview instanceof HTMLElement) {
        preview.innerHTML = '<div class="empty-state" style="min-height:40px;">Logo 未设置</div>';
      }
    }
    return;
  }

  if (action === 'toggle-brand-skill') {
    toggleBrandCapability('skill', target.getAttribute('data-skill-slug') || '');
    return;
  }

  if (action === 'brand-skill-search') {
    await loadBrandSkillCatalogPage({
      query: getAdminSkillCatalogQueryValue('[data-brand-skill-query]', state.brandSkillCatalogMeta.query),
      offset: 0,
    });
    return;
  }

  if (action === 'brand-skill-clear-search') {
    await loadBrandSkillCatalogPage({query: '', offset: 0});
    return;
  }

  if (action === 'brand-skill-prev-page') {
    await loadBrandSkillCatalogPage({
      offset: Math.max(0, Number(state.brandSkillCatalogMeta.offset || 0) - Number(state.brandSkillCatalogMeta.limit || ADMIN_SKILL_BROWSER_PAGE_SIZE)),
    });
    return;
  }

  if (action === 'brand-skill-next-page') {
    await loadBrandSkillCatalogPage({
      offset: Number(state.brandSkillCatalogMeta.nextOffset || Number(state.brandSkillCatalogMeta.offset || 0) + Number(state.brandSkillCatalogMeta.limit || ADMIN_SKILL_BROWSER_PAGE_SIZE)),
    });
    return;
  }

  if (action === 'toggle-brand-mcp') {
    toggleBrandCapability('mcp', target.getAttribute('data-mcp-key') || '');
    return;
  }

  if (action === 'toggle-brand-recharge-override') {
    toggleBrandRechargeOverride();
    return;
  }

  if (action === 'toggle-brand-recharge-package') {
    toggleBrandRechargePackage(target.getAttribute('data-package-id') || '');
    return;
  }

  if (action === 'move-brand-recharge-package-up') {
    moveBrandRechargePackage(target.getAttribute('data-package-id') || '', 'up');
    return;
  }

  if (action === 'move-brand-recharge-package-down') {
    moveBrandRechargePackage(target.getAttribute('data-package-id') || '', 'down');
    return;
  }

  if (action === 'toggle-brand-menu') {
    toggleBrandCapability('menu', target.getAttribute('data-menu-key') || '');
    return;
  }

  if (action === 'select-brand-menu') {
    captureBrandEditorBuffer();
    state.selectedBrandMenuKey = target.getAttribute('data-menu-key') || '';
    render();
    return;
  }

  if (action === 'move-brand-menu-up') {
    moveBrandMenu(target.getAttribute('data-menu-key') || '', 'up');
    return;
  }

  if (action === 'move-brand-menu-down') {
    moveBrandMenu(target.getAttribute('data-menu-key') || '', 'down');
    return;
  }

  if (action === 'toggle-brand-composer-control') {
    toggleBrandComposerControl(target.getAttribute('data-control-key') || '');
    return;
  }

  if (action === 'move-brand-composer-control-up') {
    moveBrandComposerControl(target.getAttribute('data-control-key') || '', 'up');
    return;
  }

  if (action === 'move-brand-composer-control-down') {
    moveBrandComposerControl(target.getAttribute('data-control-key') || '', 'down');
    return;
  }

  if (action === 'toggle-brand-composer-shortcut') {
    toggleBrandComposerShortcut(target.getAttribute('data-shortcut-key') || '');
    return;
  }

  if (action === 'move-brand-composer-shortcut-up') {
    moveBrandComposerShortcut(target.getAttribute('data-shortcut-key') || '', 'up');
    return;
  }

  if (action === 'move-brand-composer-shortcut-down') {
    moveBrandComposerShortcut(target.getAttribute('data-shortcut-key') || '', 'down');
    return;
  }

  if (action === 'skill-toggle') {
    const enabled = (target.getAttribute('data-enabled') || '') === 'true';
    await setSkillEnabled(target.getAttribute('data-skill-slug') || '', !enabled);
    return;
  }

  if (action === 'skill-enable') {
    await setSkillEnabled(target.getAttribute('data-skill-slug') || '', true);
    return;
  }

  if (action === 'skill-disable') {
    await setSkillEnabled(target.getAttribute('data-skill-slug') || '', false);
    return;
  }

  if (action === 'skill-delete') {
    const slug = target.getAttribute('data-skill-slug') || '';
    if (window.confirm(`确认删除技能 ${slug}？`)) {
      await deleteSkill(slug);
    }
    return;
  }

  if (action === 'mcp-test') {
    const form = document.querySelector('#mcp-editor-form');
    if (form instanceof HTMLFormElement) {
      const data = new FormData(form);
      await testMcpCatalogEntry({
        key: String(data.get('key') || '').trim() || target.getAttribute('data-mcp-key') || '',
        command: String(data.get('command') || '').trim() || null,
        http_url: String(data.get('http_url') || '').trim() || null,
      });
    } else {
      await testMcpCatalogEntry({
        key: target.getAttribute('data-mcp-key') || '',
      });
    }
    return;
  }

  if (action === 'cloud-mcp-test') {
    const form = document.querySelector('#cloud-mcp-editor-form');
    if (form instanceof HTMLFormElement) {
      const data = new FormData(form);
      await testMcpCatalogEntry({
        key: String(data.get('key') || '').trim() || target.getAttribute('data-mcp-key') || '',
        command: String(data.get('command') || '').trim() || null,
        http_url: String(data.get('http_url') || '').trim() || null,
      });
    }
    return;
  }

  if (action === 'mcp-delete') {
    const key = target.getAttribute('data-mcp-key') || '';
    if (window.confirm(`确认删除 MCP ${key}？`)) {
      await deleteMcpCatalogEntry(key);
    }
    return;
  }

  if (action === 'cloud-mcp-delete') {
    const key = target.getAttribute('data-mcp-key') || '';
    if (window.confirm(`确认删除云MCP ${key}？`)) {
      await deleteCloudMcpCatalogEntry(key);
    }
    return;
  }

  if (action === 'model-toggle') {
    const enabled = (target.getAttribute('data-enabled') || '') === 'true';
    await setModelEnabled(target.getAttribute('data-model-ref') || '', !enabled);
    return;
  }

  if (action === 'model-delete') {
    const ref = target.getAttribute('data-model-ref') || '';
    if (window.confirm(`确认删除模型 ${ref}？`)) {
      await deleteModelCatalogEntry(ref);
    }
    return;
  }

  if (action === 'delete-asset') {
    const brandId = target.getAttribute('data-brand-id') || '';
    const assetKey = target.getAttribute('data-asset-key') || '';
    if (window.confirm(`确认删除资源 ${assetKey}？`)) {
      await deleteAsset(brandId, assetKey);
    }
    return;
  }

  if (action === 'fill-asset-preset') {
    const form = document.querySelector('#asset-form');
    if (form instanceof HTMLFormElement) {
      const assetKeyInput = form.querySelector('input[name="asset_key"]');
      const kindInput = form.querySelector('input[name="kind"]');
      if (assetKeyInput instanceof HTMLInputElement) {
        assetKeyInput.value = target.getAttribute('data-asset-key') || '';
      }
      if (kindInput instanceof HTMLInputElement) {
        kindInput.value = target.getAttribute('data-asset-kind') || '';
      }
    }
    return;
  }

  if (action === 'publish-brand') {
    const brandId = state.selectedBrandId || '';
    if (window.confirm(`确认发布 ${brandId} 当前草稿？`)) {
      await publishCurrentBrand();
    }
    return;
  }

  if (action === 'save-brand-draft') {
    const form = document.querySelector('#brand-editor-form');
    if (form instanceof HTMLFormElement) {
      await saveBrandEditor(form);
    }
    return;
  }

  if (action === 'rollback-brand') {
    const version = Number(target.getAttribute('data-version') || 0);
    await rollbackBrand(version);
    return;
  }

  if (action === 'refresh-page') {
    await loadAppData();
    return;
  }

  if (action === 'export-payment-orders') {
    exportPaymentOrdersCsv();
    return;
  }

  if (action === 'select-release') {
    state.selectedReleaseId = target.getAttribute('data-release-id') || '';
    render();
    return;
  }

  if (action === 'select-payment-order') {
    state.selectedPaymentOrderId = target.getAttribute('data-order-id') || '';
    if (state.selectedPaymentOrderId) {
      await ensurePaymentOrderDetail(state.selectedPaymentOrderId);
    }
    render();
    return;
  }

  if (action === 'select-audit') {
    state.selectedAuditId = target.getAttribute('data-audit-id') || '';
    render();
    return;
  }

  if (action === 'logout') {
    logout();
  }
});

function handleFilterInput(target) {
  const stateKey = target.getAttribute('data-state-key');
  if (stateKey === 'selectedDesktopReleaseChannel') {
    state.selectedDesktopReleaseChannel = target.value === 'dev' ? 'dev' : 'prod';
    render();
    return;
  }
  if (stateKey === 'selectedRuntimeImportChannel') {
    state.selectedRuntimeImportChannel = target.value === 'dev' ? 'dev' : 'prod';
    render();
    return;
  }
  if (stateKey === 'selectedRuntimeImportBindScopeType') {
    state.selectedRuntimeImportBindScopeType =
      target.value === 'platform' ? 'platform' : target.value === 'app' ? 'app' : 'none';
    if (state.selectedRuntimeImportBindScopeType !== 'app') {
      state.selectedRuntimeImportBindScopeKey = '';
    }
    render();
    return;
  }
  if (stateKey === 'selectedRuntimeImportBindScopeKey') {
    state.selectedRuntimeImportBindScopeKey = target.value;
    render();
    return;
  }
  const key = target.getAttribute('data-filter-key');
  if (!key) return;
  state.filters[key] = target.value;
  if (filterRenderTimer) {
    window.clearTimeout(filterRenderTimer);
  }
  pendingFilterFocus = {
    key,
    value: target.value,
    selectionStart:
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.selectionStart : null,
    selectionEnd:
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.selectionEnd : null,
  };
  filterRenderTimer = window.setTimeout(() => {
    filterRenderTimer = null;
    render();
    if (!pendingFilterFocus) {
      return;
    }
    const active = document.querySelector(`[data-filter-key="${CSS.escape(pendingFilterFocus.key)}"]`);
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      active.focus();
      const start = typeof pendingFilterFocus.selectionStart === 'number' ? pendingFilterFocus.selectionStart : active.value.length;
      const end = typeof pendingFilterFocus.selectionEnd === 'number' ? pendingFilterFocus.selectionEnd : start;
      active.setSelectionRange(start, end);
    }
    pendingFilterFocus = null;
  }, 80);
}

function syncAgentAvatarEditor(form) {
  if (!(form instanceof HTMLFormElement) || form.id !== 'agent-editor-form') {
    return;
  }
  const preset = form.querySelector('[data-agent-avatar-preset="true"]');
  const input = form.querySelector('[data-agent-avatar-url="true"]');
  const preview = form.querySelector('[data-agent-avatar-preview="true"]');
  const empty = form.querySelector('[data-agent-avatar-empty="true"]');
  if (!(preset instanceof HTMLSelectElement) || !(input instanceof HTMLInputElement) || !(preview instanceof HTMLImageElement)) {
    return;
  }

  if (document.activeElement === preset) {
    if (preset.value === '__custom__') {
      if (AGENT_AVATAR_PRESET_OPTIONS.some((item) => item.value === input.value.trim())) {
        input.value = '';
      }
    } else {
      input.value = preset.value;
    }
  } else {
    const normalized = input.value.trim();
    const matchedPreset = AGENT_AVATAR_PRESET_OPTIONS.find((item) => item.value === normalized);
    preset.value = matchedPreset ? matchedPreset.value : normalized ? '__custom__' : '';
  }

  const nextUrl = input.value.trim();
  if (nextUrl) {
    preview.src = nextUrl;
    preview.style.display = 'block';
    if (empty instanceof HTMLElement) {
      empty.style.display = 'none';
    }
  } else {
    preview.removeAttribute('src');
    preview.style.display = 'none';
    if (empty instanceof HTMLElement) {
      empty.style.display = 'inline';
    }
  }
}

function setAgentAvatarUploadStatus(form, message, tone = 'muted') {
  const status = form.querySelector('[data-agent-avatar-upload-status="true"]');
  if (!(status instanceof HTMLElement)) {
    return;
  }
  const color =
    tone === 'error'
      ? 'var(--danger-strong, #d35b5b)'
      : tone === 'success'
        ? 'var(--success-strong, #4ea46e)'
        : 'var(--text-secondary)';
  status.textContent = message || '';
  status.style.color = color;
}

async function uploadAgentAvatarFile(form, file) {
  if (!(form instanceof HTMLFormElement) || !(file instanceof File) || file.size === 0) {
    return;
  }
  const appName = getPreferredAgentAvatarAppName();
  if (!appName) {
    setAgentAvatarUploadStatus(form, '没有可用的上传目标应用，请先确认品牌数据已加载。', 'error');
    return;
  }

  const slugInput = form.querySelector('input[name="slug"]');
  const avatarUrlInput = form.querySelector('[data-agent-avatar-url="true"]');
  const fileInput = form.querySelector('[data-agent-avatar-file="true"]');
  if (!(slugInput instanceof HTMLInputElement) || !(avatarUrlInput instanceof HTMLInputElement)) {
    setAgentAvatarUploadStatus(form, '头像上传表单缺少必要字段。', 'error');
    return;
  }

  const slug = slugInput.value.trim() || 'draft-agent';
  const rawFileName = String(file.name || slug).trim();
  const fileStem = rawFileName.replace(/\.[a-z0-9]+$/i, '') || slug;
  const extensionFromType = String(file.type || '').toLowerCase().includes('png')
    ? 'png'
    : String(file.type || '').toLowerCase().includes('webp')
      ? 'webp'
      : 'jpg';
  const assetKey = `agent-avatar-${slugifyFilename(slug)}-${Date.now()}`;

  try {
    setAgentAvatarUploadStatus(form, '头像上传中...');
    const fileBase64 = await readFileAsBase64(file);
    const response = await apiFetch(`/admin/portal/apps/${encodeURIComponent(appName)}/assets/${encodeURIComponent(assetKey)}/upload`, {
      method: 'POST',
      body: JSON.stringify({
        content_type: file.type || 'image/jpeg',
        file_name: `${slugifyFilename(fileStem, slugifyFilename(slug))}.${extensionFromType}`,
        file_base64: fileBase64,
        metadata: {
          kind: 'agent-avatar',
          scope: 'agent-center',
          agent_slug: slug,
        },
      }),
    });
    const uploadedAsset = response?.asset || {};
    const nextUrl = String(uploadedAsset.publicUrl || buildPortalAssetUrl(appName, assetKey)).trim();
    avatarUrlInput.value = nextUrl;
    syncAgentAvatarEditor(form);
    if (fileInput instanceof HTMLInputElement) {
      fileInput.value = '';
    }
    if (canAutoSaveAgentForm(form)) {
      setAgentAvatarUploadStatus(form, '头像已上传，正在自动保存 Agent...', 'success');
      await saveAgentCatalogEntry(new FormData(form));
      return;
    }
    setAgentAvatarUploadStatus(form, '头像已上传，请先补全 slug 和名称后再保存 Agent。', 'success');
  } catch (error) {
    setAgentAvatarUploadStatus(form, error instanceof Error ? error.message : '头像上传失败', 'error');
  }
}

app.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
    return;
  }
  if (target.closest('#brand-editor-form')) {
    syncBrandEditorBuffer();
  }
  const agentEditorForm = target.closest('#agent-editor-form');
  if (agentEditorForm) {
    syncAgentAvatarEditor(agentEditorForm);
  }
  handleFilterInput(target);
});

app.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
    return;
  }
  if (target.closest('#brand-editor-form')) {
    syncBrandEditorBuffer();
  }
  const agentEditorForm = target.closest('#agent-editor-form');
  if (agentEditorForm) {
    syncAgentAvatarEditor(agentEditorForm);
    if (target instanceof HTMLInputElement && target.matches('[data-agent-avatar-file="true"]')) {
      const file = target.files?.[0];
      if (file) {
        void uploadAgentAvatarFile(agentEditorForm, file);
      }
    }
  }
  if (target.matches('[data-logo-select="true"]')) {
    const preview = target.closest('.field')?.nextElementSibling?.querySelector('[data-logo-preview="true"]');
    renderLogoPreviewInto(preview, target.value);
  }
  handleFilterInput(target);
});

applyThemeMode(state.themeMode);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.themeMode === 'system') {
    applyThemeMode('system');
    render();
  }
});

if (!redirectedToCanonicalOrigin) {
  render();
  ensureSession();
}
