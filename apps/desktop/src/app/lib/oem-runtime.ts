import { loadOemRuntimeSnapshot, saveOemRuntimeSnapshot } from './tauri-runtime-config';

export type BrandRuntimeConfig = {
  brandId: string;
  publishedVersion: number;
  config: Record<string, unknown>;
};

export type ResolvedMenuUiConfig = {
  displayName?: string;
  group?: string;
  iconKey?: string;
};

export type RequiredResolvedMenuUiConfig = {
  displayName: string;
  group: string | null;
  iconKey: string;
};

export type ResolvedComposerControlOption = {
  value: string;
  label: string;
  description: string;
};

export type ResolvedComposerControlConfig = {
  controlKey: string;
  displayName: string;
  controlType: string;
  iconKey: string | null;
  sortOrder: number;
  options: ResolvedComposerControlOption[];
  metadata: Record<string, unknown>;
  config: Record<string, unknown>;
};

export type ResolvedComposerShortcutConfig = {
  shortcutKey: string;
  displayName: string;
  description: string;
  template: string;
  iconKey: string | null;
  tone: string | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
  config: Record<string, unknown>;
};

export type ResolvedInputComposerConfig = {
  placeholderText: string;
  topBarControls: ResolvedComposerControlConfig[];
  footerShortcuts: ResolvedComposerShortcutConfig[];
};

export type ResolvedWelcomeQuickActionConfig = {
  label: string;
  prompt: string;
  iconKey: string | null;
};

export type ResolvedWelcomePageConfig = {
  enabled: boolean;
  entryLabel: string;
  kolName: string;
  expertName: string;
  slogan: string;
  avatarUrl: string;
  primaryColor: string;
  backgroundImageUrl: string;
  description: string;
  expertiseAreas: string[];
  targetAudience: string;
  quickActions: ResolvedWelcomeQuickActionConfig[];
  disclaimer: string;
};

export type ResolvedHeaderQuoteConfig = {
  id: string;
  label: string;
  value: string;
  change: number;
  changePercent: string;
};

export type ResolvedHeaderHeadlineConfig = {
  id: string;
  title: string;
  source: string | null;
  href: string | null;
};

export type ResolvedHeaderConfig = {
  enabled: boolean;
  statusLabel: string;
  liveStatusLabel: string;
  showLiveBadge: boolean;
  showQuotes: boolean;
  showHeadlines: boolean;
  showSecurityBadge: boolean;
  securityLabel: string;
  showCredits: boolean;
  showRechargeButton: boolean;
  rechargeLabel: string;
  showModeBadge: boolean;
  modeBadgeLabel: string;
  fallbackQuotes: ResolvedHeaderQuoteConfig[];
  fallbackHeadlines: ResolvedHeaderHeadlineConfig[];
};

export type ResolvedRechargePackageConfig = {
  packageId: string;
  packageName: string;
  credits: number;
  bonusCredits: number;
  totalCredits: number;
  amountCnyFen: number;
  sortOrder: number;
  recommended: boolean;
  default: boolean;
  description: string;
  badgeLabel: string | null;
  highlight: string | null;
  featureList: string[];
  metadata: Record<string, unknown>;
};

export type ResolvedRechargePaymentMethodConfig = {
  provider: 'wechat_qr' | 'alipay_qr';
  sortOrder: number;
  default: boolean;
  label: string | null;
  metadata: Record<string, unknown>;
};

export type ResolvedAuthAgreementConfig = {
  key: string;
  title: string;
  version: string;
  effectiveDate: string;
  summary: string;
  content: string;
};

export type ResolvedAuthExperienceConfig = {
  title: string;
  subtitle: string;
  socialNotice: string;
  agreements: ResolvedAuthAgreementConfig[];
};

const AUTH_AGREEMENT_ORDER = ['service', 'privacy', 'billing'] as const;
const AUTH_AGREEMENT_LABELS: Record<string, string> = {
  service: '服务协议',
  privacy: '隐私说明',
  billing: '龙虾币计费规则',
};

const DEFAULT_ENABLED_MENU_KEYS = [
  'chat',
  'cron',
  'thought-library',
  'investment-experts',
  'stock-market',
  'fund-market',
  'lobster-store',
  'skill-store',
  'finance-skills',
  'foundation-skills',
  'mcp-store',
  'memory',
  'data-connections',
  'im-bots',
  'security',
] as const;

const DEFAULT_MENU_UI_CONFIG: Record<string, RequiredResolvedMenuUiConfig> = {
  chat: { displayName: '智能对话', group: '工作台', iconKey: 'chat' },
  cron: { displayName: '定时任务', group: '工作台', iconKey: 'cron' },
  'thought-library': { displayName: '思维库', group: '工作台', iconKey: 'thought-library' },
  'investment-experts': { displayName: '智能投资专家', group: '商店', iconKey: 'investment-experts' },
  'stock-market': { displayName: '股票市场', group: '市场', iconKey: 'stock-market' },
  'fund-market': { displayName: '基金市场', group: '市场', iconKey: 'fund-market' },
  'lobster-store': { displayName: '龙虾商店', group: '商店', iconKey: 'lobster-store' },
  'skill-store': { displayName: '技能商店', group: '商店', iconKey: 'skill-store' },
  'finance-skills': { displayName: '财经技能', group: '商店', iconKey: 'finance-skills' },
  'foundation-skills': { displayName: '基础技能', group: '商店', iconKey: 'foundation-skills' },
  'mcp-store': { displayName: 'MCP商店', group: '商店', iconKey: 'mcp-store' },
  memory: { displayName: '记忆管理', group: '工作台', iconKey: 'memory' },
  'data-connections': { displayName: '数据连接', group: '工作台', iconKey: 'data-connections' },
  'im-bots': { displayName: 'IM机器人', group: '工作台', iconKey: 'im-bots' },
  security: { displayName: '安全防护', group: '工作台', iconKey: 'security' },
  'task-center': { displayName: '历史任务', group: null, iconKey: 'task-center' },
  settings: { displayName: '设置', group: null, iconKey: 'settings' },
};

function buildDefaultAuthExperiencePreset(brandId: string, displayName: string, legalName: string): ResolvedAuthExperienceConfig {
  const normalizedBrandId = String(brandId || '').trim().toLowerCase();
  const productLabel = String(displayName || brandId || '本产品').trim() || '本产品';
  const legalEntity = String(legalName || displayName || brandId || '本产品').trim() || '本产品';
  const socialNotice = '微信和 Gmail 登录暂未开放，请先使用账号密码登录。';
  if (normalizedBrandId === 'caiclaw' || normalizedBrandId === 'licaiclaw') {
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

type PublicBrandConfigResponse = {
  success?: boolean;
  data?: {
    brand?: {
      brandId?: string | null;
      displayName?: string | null;
    } | null;
    app?: {
      appName?: string | null;
    } | null;
    publishedVersion?: number | null;
    config?: Record<string, unknown> | null;
  } | null;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  const seen = new Set<string>();
  for (const item of asArray(value)) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim();
    if (!normalized) continue;
    seen.add(normalized);
  }
  return Array.from(seen);
}

function resolveComposerControlConfigs(value: unknown): ResolvedComposerControlConfig[] {
  return asArray(value)
    .map((item) => {
      const entry = asObject(item);
      const controlKey = String(entry.control_key ?? entry.controlKey ?? '').trim();
      if (!controlKey) return null;
      return {
        controlKey,
        displayName: String(entry.display_name || entry.displayName || '').trim() || controlKey,
        controlType: String(entry.control_type || entry.controlType || 'static').trim() || 'static',
        iconKey: String(entry.icon_key || entry.iconKey || '').trim() || null,
        sortOrder: Number(entry.sort_order || entry.sortOrder || 100) || 100,
        metadata: asObject(entry.metadata),
        config: asObject(entry.config),
        options: asArray(entry.options)
          .map((option) => {
            const rawOption = asObject(option);
            const value = String(rawOption.option_value ?? rawOption.optionValue ?? rawOption.value ?? '').trim();
            if (!value) return null;
            return {
              value,
              label: String(rawOption.label || value).trim() || value,
              description: String(rawOption.description || rawOption.detail || '').trim(),
            };
          })
          .filter((option): option is ResolvedComposerControlOption => Boolean(option)),
      };
    })
    .filter((item): item is ResolvedComposerControlConfig => Boolean(item))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.controlKey.localeCompare(right.controlKey, 'zh-CN'));
}

function resolveComposerShortcutConfigs(value: unknown): ResolvedComposerShortcutConfig[] {
  return asArray(value)
    .map((item) => {
      const entry = asObject(item);
      const shortcutKey = String(entry.shortcut_key ?? entry.shortcutKey ?? '').trim();
      if (!shortcutKey) return null;
      return {
        shortcutKey,
        displayName: String(entry.display_name || entry.displayName || '').trim() || shortcutKey,
        description: String(entry.description || '').trim(),
        template: String(entry.template || entry.template_text || '').trim(),
        iconKey: String(entry.icon_key || entry.iconKey || '').trim() || null,
        tone: String(entry.tone || '').trim() || null,
        sortOrder: Number(entry.sort_order || entry.sortOrder || 100) || 100,
        metadata: asObject(entry.metadata),
        config: asObject(entry.config),
      };
    })
    .filter((item): item is ResolvedComposerShortcutConfig => Boolean(item))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.shortcutKey.localeCompare(right.shortcutKey, 'zh-CN'));
}

function normalizeHeaderQuoteConfig(value: unknown, index: number): ResolvedHeaderQuoteConfig | null {
  const raw = asObject(value);
  const label = String(raw.label || raw.name || raw.title || '').trim();
  if (!label) {
    return null;
  }
  const numericChange =
    typeof raw.change === 'number'
      ? raw.change
      : typeof raw.change === 'string' && raw.change.trim()
        ? Number(raw.change.trim().replace(/%$/, ''))
        : typeof raw.change_percent === 'number'
          ? raw.change_percent
          : typeof raw.changePercent === 'number'
            ? raw.changePercent
            : 0;
  const change = Number.isFinite(numericChange) ? numericChange : 0;
  const changePercent =
    typeof raw.change_percent === 'string' && raw.change_percent.trim()
      ? raw.change_percent.trim()
      : typeof raw.changePercent === 'string' && raw.changePercent.trim()
        ? raw.changePercent.trim()
        : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
  return {
    id: String(raw.id || `header-quote-${index}`).trim() || `header-quote-${index}`,
    label,
    value: String(raw.value || raw.price || raw.last || '--').trim() || '--',
    change,
    changePercent,
  };
}

function normalizeHeaderHeadlineConfig(value: unknown, index: number): ResolvedHeaderHeadlineConfig | null {
  const raw = asObject(value);
  const title = String(raw.title || raw.text || raw.headline || '').trim();
  if (!title) {
    return null;
  }
  return {
    id: String(raw.id || `header-headline-${index}`).trim() || `header-headline-${index}`,
    title,
    source: String(raw.source || raw.provider || '').trim() || null,
    href: String(raw.href || raw.url || '').trim() || null,
  };
}

const LEGACY_MENU_KEY_MAP: Record<string, string[]> = {
  workspace: ['chat'],
  skills: ['skill-store'],
  mcp: ['mcp-store'],
  settings: ['settings'],
  assets: [],
  models: [],
};

function normalizeMenuKeys(keys: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const mapped = LEGACY_MENU_KEY_MAP[key] ?? [key];
    for (const nextKey of mapped) {
      const trimmed = nextKey.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      normalized.push(trimmed);
    }
  }
  return normalized;
}

function resolveMenuCatalogUiDefaults(
  root: Record<string, unknown>,
): Record<string, ResolvedMenuUiConfig> {
  const catalog = asArray(root.menu_catalog);
  const entries: Record<string, ResolvedMenuUiConfig> = {};
  for (const entry of catalog) {
    const item = asObject(entry);
    const metadata = asObject(item.metadata);
    const key = String(item.menu_key ?? item.menuKey ?? '').trim();
    if (!key) continue;
    const displayName = String(item.display_name || item.displayName || '').trim();
    const group = String(metadata.group_label || metadata.groupLabel || metadata.group || item.group || '').trim();
    const iconKey = String(item.icon_key || item.iconKey || '').trim();
    entries[key] = {
      ...(displayName ? {displayName} : {}),
      ...(group ? {group} : {}),
      ...(iconKey ? {iconKey} : {}),
    };
  }
  return entries;
}

function resolveEnabledSkillSlugs(root: Record<string, unknown>): Set<string> {
  const skillBindings = asArray(root.skill_bindings);
  const bound = skillBindings
    .filter((item) => asObject(item).enabled !== false)
    .map((item) => String(asObject(item).skill_slug ?? asObject(item).skillSlug ?? '').trim())
    .filter(Boolean);
  const fallback = asStringArray(asObject(root.capabilities).skills);
  return new Set(bound.length ? bound : fallback);
}

function resolveEnabledMcpKeys(root: Record<string, unknown>): Set<string> {
  const mcpBindings = asArray(root.mcp_bindings);
  const bound = mcpBindings
    .filter((item) => asObject(item).enabled !== false)
    .map((item) => String(asObject(item).mcp_key ?? asObject(item).mcpKey ?? '').trim())
    .filter(Boolean);
  const fallback = asStringArray(asObject(root.capabilities).mcp_servers);
  return new Set(bound.length ? bound : fallback);
}

function resolveEnabledModelRefs(root: Record<string, unknown>): Set<string> {
  const modelBindings = asArray(root.model_bindings);
  const bound = modelBindings
    .filter((item) => asObject(item).enabled !== false)
    .map((item) => String(asObject(item).model_ref ?? asObject(item).modelRef ?? '').trim())
    .filter(Boolean);
  const providerModels = asArray(asObject(root.model_provider).models)
    .map((item) => String(asObject(item).model_ref ?? asObject(item).modelRef ?? '').trim())
    .filter(Boolean);
  return new Set(bound.length ? bound : providerModels);
}

function matchesMenuRequirements(
  menuConfig: Record<string, unknown>,
  availability: {
    skills: Set<string>;
    mcps: Set<string>;
    models: Set<string>;
  },
): boolean {
  const requires = asObject(menuConfig.requires);
  const skillSlug = String(
    requires.skill_slug || requires.skillSlug || menuConfig.requires_skill_slug || menuConfig.requiresSkillSlug || '',
  ).trim();
  const mcpKey = String(
    requires.mcp_key || requires.mcpKey || menuConfig.requires_mcp_key || menuConfig.requiresMcpKey || '',
  ).trim();
  const modelRef = String(
    requires.model_ref || requires.modelRef || menuConfig.requires_model_ref || menuConfig.requiresModelRef || '',
  ).trim();
  if (skillSlug && !availability.skills.has(skillSlug)) return false;
  if (mcpKey && !availability.mcps.has(mcpKey)) return false;
  if (modelRef && !availability.models.has(modelRef)) return false;
  return true;
}

function normalizeBrandRuntimeConfig(
  data: PublicBrandConfigResponse['data'],
  fallbackBrandId: string,
): BrandRuntimeConfig | null {
  if (!data?.config || typeof data.config !== 'object' || Array.isArray(data.config)) {
    return null;
  }

  return {
    brandId: String(data.brand?.brandId || data.app?.appName || fallbackBrandId).trim() || fallbackBrandId,
    publishedVersion:
      typeof data.publishedVersion === 'number' && Number.isFinite(data.publishedVersion) ? data.publishedVersion : 0,
    config: data.config,
  };
}

export async function loadPublishedBrandRuntimeConfig(input: {
  authBaseUrl: string;
  brandId: string;
}): Promise<BrandRuntimeConfig> {
  const brandId = input.brandId.trim();
  const authBaseUrl = input.authBaseUrl.trim();
  if (!brandId || !authBaseUrl) {
    throw new Error('brand runtime config requires authBaseUrl and brandId');
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      joinUrl(authBaseUrl, `/portal/public-config?app_name=${encodeURIComponent(brandId)}`),
      {
        method: 'GET',
        signal: controller.signal,
      },
    );
    const payload = (await response.json().catch(() => ({}))) as PublicBrandConfigResponse;
    const normalized = normalizeBrandRuntimeConfig(payload?.data, brandId);
    if (!response.ok || !payload?.success || !normalized) {
      throw new Error(`failed to load OEM runtime config (${response.status})`);
    }
    return normalized;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function loadBrandRuntimeConfigWithFallback(input: {
  authBaseUrl: string;
  brandId: string;
}): Promise<BrandRuntimeConfig | null> {
  try {
    const runtimeConfig = await loadPublishedBrandRuntimeConfig(input);
    if (isTauriRuntime()) {
      await saveOemRuntimeSnapshot(runtimeConfig).catch(() => false);
    }
    return runtimeConfig;
  } catch (error) {
    if (!isTauriRuntime()) {
      throw error;
    }
    return loadOemRuntimeSnapshot();
  }
}

export function resolveEnabledMenuKeys(config: Record<string, unknown> | null | undefined): string[] | null {
  const root = asObject(config);
  const menuBindings = asArray(root.menu_bindings);
  const capabilityMenus = asStringArray(asObject(root.capabilities).menus);
  if (!menuBindings.length && !capabilityMenus.length) {
    return [...DEFAULT_ENABLED_MENU_KEYS];
  }

  const surfaces = asObject(root.surfaces);
  const orderedFromBindings = menuBindings
    .filter((item) => asObject(item).enabled !== false)
    .sort((left, right) => {
      const leftOrder = Number(asObject(left).sort_order ?? asObject(left).sortOrder ?? 100);
      const rightOrder = Number(asObject(right).sort_order ?? asObject(right).sortOrder ?? 100);
      return leftOrder - rightOrder;
    })
    .map((item) => String(asObject(item).menu_key ?? asObject(item).menuKey ?? '').trim())
    .filter(Boolean);
  const keys = normalizeMenuKeys(orderedFromBindings.length ? orderedFromBindings : capabilityMenus);
  const visible = new Set<string>();
  const availability = {
    skills: resolveEnabledSkillSlugs(root),
    mcps: resolveEnabledMcpKeys(root),
    models: resolveEnabledModelRefs(root),
  };

  for (const key of keys) {
    const binding = menuBindings.find((item) => {
      const entry = asObject(item);
      return normalizeMenuKeys([String(entry.menu_key ?? entry.menuKey ?? '').trim()]).includes(key);
    });
    if (binding && !matchesMenuRequirements(asObject(asObject(binding).config), availability)) {
      continue;
    }
    const surface = asObject(surfaces[key]);
    if (Object.keys(surface).length > 0 && surface.enabled === false) {
      continue;
    }
    visible.add(key);
  }

  return Array.from(visible);
}

export function resolveRequiredEnabledMenuKeys(config: Record<string, unknown> | null | undefined): string[] {
  const resolved = resolveEnabledMenuKeys(config);
  if (!resolved || resolved.length === 0) {
    return [...DEFAULT_ENABLED_MENU_KEYS];
  }
  return normalizeMenuKeys([...resolved, 'thought-library']);
}

export function resolveMenuDisplayNames(config: Record<string, unknown> | null | undefined): Record<string, string> | null {
  const resolved = resolveMenuUiConfig(config);
  if (!resolved) return null;
  const displayNames = Object.fromEntries(
    Object.entries(resolved)
      .map(([key, value]) => [key, String(value.displayName || '').trim()])
      .filter((entry) => Boolean(entry[1])),
  );
  return Object.keys(displayNames).length ? displayNames : null;
}

export function resolveMenuUiConfig(config: Record<string, unknown> | null | undefined): Record<string, ResolvedMenuUiConfig> | null {
  const root = asObject(config);
  const menuBindings = asArray(root.menu_bindings);
  const entries: Record<string, ResolvedMenuUiConfig> = resolveMenuCatalogUiDefaults(root);
  if (!menuBindings.length && Object.keys(entries).length === 0) {
    return null;
  }

  for (const entry of menuBindings) {
    const item = asObject(entry);
    const config = asObject(item.config);
    const displayName = String(config.display_name || config.displayName || '').trim();
    const group = String(config.group_label || config.groupLabel || config.group || '').trim();
    const iconKey = String(config.icon_key || config.iconKey || '').trim();
    for (const key of normalizeMenuKeys([String(item.menu_key ?? item.menuKey ?? '').trim()])) {
      if (!key) continue;
      entries[key] = {
        ...(entries[key] || {}),
        ...(displayName ? {displayName} : {}),
        ...(group ? {group} : {}),
        ...(iconKey ? {iconKey} : {}),
      };
    }
  }

  return Object.keys(entries).length ? entries : null;
}

export function resolveRequiredMenuUiConfig(
  config: Record<string, unknown> | null | undefined,
  requiredMenuKeys: string[],
): Record<string, RequiredResolvedMenuUiConfig> {
  const resolved = resolveMenuUiConfig(config);
  if (!resolved) {
    return Object.fromEntries(
      normalizeMenuKeys(requiredMenuKeys)
        .map((menuKey) => [menuKey, DEFAULT_MENU_UI_CONFIG[menuKey]])
        .filter((entry): entry is [string, RequiredResolvedMenuUiConfig] => Boolean(entry[1])),
    );
  }

  const entries: Record<string, RequiredResolvedMenuUiConfig> = {};
  for (const menuKey of normalizeMenuKeys(requiredMenuKeys)) {
    const item = resolved[menuKey] ?? DEFAULT_MENU_UI_CONFIG[menuKey];
    if (!item) {
      throw new Error(`OEM runtime menu config is missing for "${menuKey}"`);
    }

    const displayName = String(item.displayName || '').trim();
    if (!displayName) {
      throw new Error(`OEM runtime menu displayName is missing for "${menuKey}"`);
    }

    const iconKey = String(item.iconKey || '').trim();
    if (!iconKey) {
      throw new Error(`OEM runtime menu iconKey is missing for "${menuKey}"`);
    }

    const group = String(item.group || '').trim();
    entries[menuKey] = {
      displayName,
      group: group || null,
      iconKey,
    };
  }

  return entries;
}

export function resolveInputComposerConfig(
  config: Record<string, unknown> | null | undefined,
): ResolvedInputComposerConfig | null {
  const root = asObject(config);
  const inputConfig = asObject(asObject(asObject(root.surfaces).input).config);
  const rootTopBarControls = resolveComposerControlConfigs(root.composer_control_bindings);
  const rootFooterShortcuts = resolveComposerShortcutConfigs(root.composer_shortcut_bindings);
  const topBarControls = rootTopBarControls.length
    ? rootTopBarControls
    : resolveComposerControlConfigs(inputConfig.top_bar_controls);
  const footerShortcuts = rootFooterShortcuts.length
    ? rootFooterShortcuts
    : resolveComposerShortcutConfigs(inputConfig.footer_shortcuts);
  if (!topBarControls.length && !footerShortcuts.length) {
    const placeholderText = String(
      inputConfig.placeholder_text ||
      inputConfig.placeholderText ||
      inputConfig.composer_placeholder ||
      inputConfig.composerPlaceholder ||
      '',
    ).trim();
    return placeholderText
      ? {
          placeholderText,
          topBarControls,
          footerShortcuts,
        }
      : null;
  }
  return {
    placeholderText: String(
      inputConfig.placeholder_text ||
      inputConfig.placeholderText ||
      inputConfig.composer_placeholder ||
      inputConfig.composerPlaceholder ||
      '',
    ).trim(),
    topBarControls,
    footerShortcuts,
  };
}

export function resolveWelcomePageConfig(
  config: Record<string, unknown> | null | undefined,
): ResolvedWelcomePageConfig | null {
  const root = asObject(config);
  const welcomeSurface = asObject(asObject(root.surfaces).welcome);
  if (Object.keys(welcomeSurface).length === 0) {
    return null;
  }

  const welcomeConfig = asObject(welcomeSurface.config);
  const quickActions = asArray(welcomeConfig.quick_actions ?? welcomeConfig.quickActions)
    .map((item) => {
      const entry = asObject(item);
      const label = String(entry.label || entry.display_name || entry.displayName || '').trim();
      const prompt = String(entry.prompt || entry.template || entry.template_text || '').trim();
      if (!label && !prompt) return null;
      return {
        label,
        prompt,
        iconKey: String(entry.icon_key || entry.iconKey || entry.icon || '').trim() || null,
      };
    })
    .filter((item): item is ResolvedWelcomeQuickActionConfig => Boolean(item));

  return {
    enabled: welcomeSurface.enabled !== false,
    entryLabel: String(welcomeConfig.entry_label || welcomeConfig.entryLabel || '').trim(),
    kolName: String(welcomeConfig.kol_name || welcomeConfig.kolName || '').trim(),
    expertName: String(welcomeConfig.expert_name || welcomeConfig.expertName || '').trim(),
    slogan: String(welcomeConfig.slogan || '').trim(),
    avatarUrl: String(welcomeConfig.avatar_url || welcomeConfig.avatar || welcomeConfig.avatarUrl || '').trim(),
    primaryColor: String(welcomeConfig.primary_color || welcomeConfig.primaryColor || '').trim(),
    backgroundImageUrl: String(
      welcomeConfig.background_image_url || welcomeConfig.backgroundImageUrl || welcomeConfig.backgroundImage || '',
    ).trim(),
    description: String(welcomeConfig.description || '').trim(),
    expertiseAreas: asStringArray(welcomeConfig.expertise_areas || welcomeConfig.expertiseAreas),
    targetAudience: String(welcomeConfig.target_audience || welcomeConfig.targetAudience || '').trim(),
    quickActions,
    disclaimer: String(welcomeConfig.disclaimer || '').trim(),
  };
}

function normalizeAuthAgreementConfig(
  value: unknown,
  fallback: ResolvedAuthAgreementConfig,
): ResolvedAuthAgreementConfig {
  const raw = asObject(value);
  return {
    key: String(raw.key || fallback.key || '').trim(),
    title: String(raw.title || fallback.title || AUTH_AGREEMENT_LABELS[fallback.key] || '').trim(),
    version: String(raw.version || fallback.version || '').trim(),
    effectiveDate: String(raw.effective_date || raw.effectiveDate || fallback.effectiveDate || '').trim(),
    summary: String(raw.summary || fallback.summary || '').trim(),
    content: String(raw.content || fallback.content || '').trim(),
  };
}

export function resolveAuthExperienceConfig(
  config: Record<string, unknown> | null | undefined,
): ResolvedAuthExperienceConfig {
  const root = asObject(config);
  const brandMeta = {
    ...asObject(root.brand_meta),
    ...asObject(root.brandMeta),
  };
  const brandId = String(brandMeta.brand_id || brandMeta.brandId || '').trim();
  const displayName = String(brandMeta.display_name || brandMeta.displayName || '').trim() || brandId;
  const legalName = String(brandMeta.legal_name || brandMeta.legalName || displayName || brandId).trim() || displayName || brandId;
  const preset = buildDefaultAuthExperiencePreset(brandId, displayName, legalName);
  const rawConfig = asObject(root.auth_experience || root.authExperience);
  const rawAgreementMap = new Map(
    asArray(rawConfig.agreements || rawConfig.items)
      .map((item) => normalizeAuthAgreementConfig(item, {
        key: '',
        title: '',
        version: '',
        effectiveDate: '',
        summary: '',
        content: '',
      }))
      .filter((item) => item.key)
      .map((item) => [item.key, item]),
  );
  const fallbackAgreementMap = new Map(preset.agreements.map((item) => [item.key, item]));
  return {
    title: String(rawConfig.title || preset.title || '').trim(),
    subtitle: String(rawConfig.subtitle || preset.subtitle || '').trim(),
    socialNotice: String(rawConfig.social_notice || rawConfig.socialNotice || preset.socialNotice || '').trim(),
    agreements: AUTH_AGREEMENT_ORDER.map((key) =>
      normalizeAuthAgreementConfig(rawAgreementMap.get(key), fallbackAgreementMap.get(key) || {
        key,
        title: AUTH_AGREEMENT_LABELS[key],
        version: '',
        effectiveDate: '',
        summary: '',
        content: '',
      }),
    ),
  };
}

export function resolveHeaderConfig(
  config: Record<string, unknown> | null | undefined,
): ResolvedHeaderConfig {
  const root = asObject(config);
  const headerSurface = asObject(asObject(root.surfaces).header);
  const headerConfig = asObject(headerSurface.config);
  return {
    enabled: headerSurface.enabled !== false,
    statusLabel:
      String(
        headerConfig.status_label ||
          headerConfig.statusLabel ||
          headerConfig.badge_label ||
          headerConfig.badgeLabel ||
          '',
      ).trim() || '市场概览',
    liveStatusLabel:
      String(headerConfig.live_status_label || headerConfig.liveStatusLabel || '').trim() || '实时更新',
    showLiveBadge: headerConfig.show_live_badge !== false && headerConfig.showLiveBadge !== false,
    showQuotes: headerConfig.show_quotes !== false && headerConfig.showQuotes !== false,
    showHeadlines: headerConfig.show_headlines !== false && headerConfig.showHeadlines !== false,
    showSecurityBadge: headerConfig.show_security_badge !== false && headerConfig.showSecurityBadge !== false,
    securityLabel:
      String(headerConfig.security_label || headerConfig.securityLabel || '').trim() || '安全防护中',
    showCredits: headerConfig.show_credits !== false && headerConfig.showCredits !== false,
    showRechargeButton: headerConfig.show_recharge_button !== false && headerConfig.showRechargeButton !== false,
    rechargeLabel:
      String(headerConfig.recharge_label || headerConfig.rechargeLabel || '').trim() || '充值中心',
    showModeBadge: headerConfig.show_mode_badge !== false && headerConfig.showModeBadge !== false,
    modeBadgeLabel:
      String(headerConfig.mode_badge_label || headerConfig.modeBadgeLabel || '').trim() || '脉搏模式',
    fallbackQuotes: asArray(headerConfig.fallback_quotes ?? headerConfig.fallbackQuotes ?? headerConfig.quotes)
      .map((item, index) => normalizeHeaderQuoteConfig(item, index))
      .filter((item): item is ResolvedHeaderQuoteConfig => Boolean(item)),
    fallbackHeadlines: asArray(
      headerConfig.fallback_headlines ?? headerConfig.fallbackHeadlines ?? headerConfig.headlines,
    )
      .map((item, index) => normalizeHeaderHeadlineConfig(item, index))
      .filter((item): item is ResolvedHeaderHeadlineConfig => Boolean(item)),
  };
}

export function resolveRechargePackageConfig(
  config: Record<string, unknown> | null | undefined,
): ResolvedRechargePackageConfig[] | null {
  const root = asObject(config);
  const rechargeSurface = asObject(asObject(root.surfaces).recharge);
  const rechargeConfig = asObject(rechargeSurface.config);
  const rawPackages = asArray(
    rechargeConfig.packages ??
      root.recharge_package_bindings ??
      rechargeConfig.package_list ??
      rechargeConfig.packageList,
  );
  if (!rawPackages.length) {
    return null;
  }

  return rawPackages
    .map((item) => {
      const entry = asObject(item);
      const packageId = String(entry.package_id ?? entry.packageId ?? '').trim();
      const packageName = String(entry.package_name ?? entry.packageName ?? '').trim();
      if (!packageId || !packageName) {
        return null;
      }
      const metadata = asObject(entry.metadata);
      const credits = Number(entry.credits ?? 0) || 0;
      const bonusCredits = Number(entry.bonus_credits ?? entry.bonusCredits ?? 0) || 0;
      return {
        packageId,
        packageName,
        credits,
        bonusCredits,
        totalCredits: Number(entry.total_credits ?? entry.totalCredits ?? credits + bonusCredits) || credits + bonusCredits,
        amountCnyFen: Number(entry.amount_cny_fen ?? entry.amountCnyFen ?? 0) || 0,
        sortOrder: Number(entry.sort_order ?? entry.sortOrder ?? 100) || 100,
        recommended: entry.recommended === true,
        default: entry.is_default === true || entry.default === true,
        description: String(metadata.description || '').trim(),
        badgeLabel: String(metadata.badge_label || metadata.badgeLabel || '').trim() || null,
        highlight: String(metadata.highlight || '').trim() || null,
        featureList: asStringArray(metadata.feature_list ?? metadata.featureList),
        metadata,
      };
    })
    .filter((item): item is ResolvedRechargePackageConfig => Boolean(item))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.packageId.localeCompare(right.packageId, 'zh-CN'));
}

export function resolveRechargePaymentMethodConfig(
  config: Record<string, unknown> | null | undefined,
): ResolvedRechargePaymentMethodConfig[] | null {
  const root = asObject(config);
  const rechargeSurface = asObject(asObject(root.surfaces).recharge);
  const rechargeConfig = asObject(rechargeSurface.config);
  const hasExplicitPaymentMethods =
    Array.isArray(rechargeConfig.payment_methods) || Array.isArray(rechargeConfig.paymentMethods);
  const rawPaymentMethods = hasExplicitPaymentMethods
    ? asArray(rechargeConfig.payment_methods ?? rechargeConfig.paymentMethods)
    : [
        {provider: 'wechat_qr', sort_order: 10, is_default: true, label: '微信支付'},
        {provider: 'alipay_qr', sort_order: 20, is_default: false, label: '支付宝'},
      ];
  if (!rawPaymentMethods.length) {
    return null;
  }

  const seenProviders = new Set<'wechat_qr' | 'alipay_qr'>();
  const items = rawPaymentMethods
    .map((item, index) => {
      const entry = asObject(item);
      const provider = String(entry.provider || '').trim().toLowerCase();
      if ((provider !== 'wechat_qr' && provider !== 'alipay_qr') || seenProviders.has(provider as 'wechat_qr' | 'alipay_qr')) {
        return null;
      }
      seenProviders.add(provider as 'wechat_qr' | 'alipay_qr');
      return {
        provider: provider as 'wechat_qr' | 'alipay_qr',
        sortOrder: Number(entry.sort_order ?? entry.sortOrder ?? (index + 1) * 10) || (index + 1) * 10,
        default: entry.is_default === true || entry.default === true,
        label: String(entry.label || '').trim() || null,
        metadata: asObject(entry.metadata),
      };
    })
    .filter((item): item is ResolvedRechargePaymentMethodConfig => Boolean(item))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.provider.localeCompare(right.provider, 'zh-CN'));
  if (!items.length) {
    return null;
  }
  const defaultProvider = items.find((item) => item.default)?.provider || items[0].provider;
  return items.map((item) => ({
    ...item,
    default: item.provider === defaultProvider,
  }));
}

export async function syncPublishedBrandRuntimeSnapshot(input: {
  authBaseUrl: string;
  brandId: string;
}): Promise<boolean> {
  const brandId = input.brandId.trim();
  const authBaseUrl = input.authBaseUrl.trim();
  if (!brandId || !authBaseUrl) {
    return false;
  }

  try {
    const runtimeConfig = await loadPublishedBrandRuntimeConfig({ authBaseUrl, brandId });
    return saveOemRuntimeSnapshot({
      brandId: runtimeConfig.brandId,
      publishedVersion: runtimeConfig.publishedVersion,
      config: runtimeConfig.config,
    });
  } catch {
    return false;
  }
}
