import type { IClawClient } from '@iclaw/sdk';

import {
  isInvestmentExpertAgent,
  loadLobsterAgents,
  resolveLobsterAgentAvatar,
  type LobsterAgent,
} from './lobster-store';

export type InvestmentExpertDomain =
  | 'stock'
  | 'fund'
  | 'gold'
  | 'bond'
  | 'futures'
  | 'public-fund'
  | 'private-fund'
  | 'vc-pe'
  | 'macro'
  | 'portfolio'
  | 'other';

export type InvestmentExpertStyle =
  | 'value'
  | 'income'
  | 'event'
  | 'sentiment'
  | 'signal'
  | 'growth'
  | 'technology'
  | 'portfolio'
  | 'macro'
  | 'quant'
  | 'other';

export type InvestmentExpertFilter = 'all' | InvestmentExpertDomain;
export type InvestmentExpertStyleFilter = 'all' | InvestmentExpertStyle;
export type InvestmentExpertTab = 'all' | 'mine';

export interface InvestmentExpertSkill {
  title: string;
  description: string;
}

export interface InvestmentExpertConversationMessage {
  role: 'user' | 'expert';
  content: string;
}

export interface InvestmentExpert {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  domain: InvestmentExpertDomain;
  domainLabel: string;
  domainColor: string;
  style: InvestmentExpertStyle;
  styleLabel: string;
  styleColor: string;
  description: string;
  tags: string[];
  avatar: string;
  isOnline: boolean;
  usageCount: number;
  taskCount: number;
  rating: number;
  isRecommended?: boolean;
  isHot?: boolean;
  skills: InvestmentExpertSkill[];
  taskExamples: string[];
  conversationPreview: InvestmentExpertConversationMessage[];
  installed: boolean;
  primarySkillSlug: string | null;
}

export const INVESTMENT_EXPERT_CATEGORIES: Array<{
  id: InvestmentExpertFilter;
  label: string;
  color: string;
}> = [
  {id: 'all', label: '全部', color: '#7b8190'},
  {id: 'stock', label: '股票', color: '#2563eb'},
  {id: 'fund', label: '基金', color: '#0f766e'},
  {id: 'gold', label: '黄金', color: '#ca8a04'},
  {id: 'bond', label: '债券', color: '#059669'},
  {id: 'futures', label: '期货', color: '#ea580c'},
  {id: 'public-fund', label: '公募', color: '#7c3aed'},
  {id: 'private-fund', label: '私募', color: '#dc2626'},
  {id: 'vc-pe', label: 'VC/PE', color: '#db2777'},
  {id: 'macro', label: '宏观', color: '#0891b2'},
  {id: 'portfolio', label: '组合配置', color: '#b45309'},
  {id: 'other', label: '其他', color: '#6b7280'},
];

export const INVESTMENT_EXPERT_STYLES: Array<{
  id: InvestmentExpertStyleFilter;
  label: string;
  color: string;
}> = [
  {id: 'all', label: '全部风格', color: '#7b8190'},
  {id: 'value', label: '价值', color: '#2563eb'},
  {id: 'income', label: '红利收益', color: '#059669'},
  {id: 'quant', label: '量化', color: '#7c3aed'},
  {id: 'macro', label: '宏观', color: '#0891b2'},
  {id: 'event', label: '事件驱动', color: '#ea580c'},
  {id: 'sentiment', label: '情绪', color: '#db2777'},
  {id: 'signal', label: '信号', color: '#dc2626'},
  {id: 'growth', label: '成长', color: '#16a34a'},
  {id: 'technology', label: '科技', color: '#4f46e5'},
  {id: 'portfolio', label: '组合', color: '#b45309'},
  {id: 'other', label: '其他', color: '#6b7280'},
];

const DOMAIN_LOOKUP: Record<InvestmentExpertDomain, {label: string; color: string}> = {
  stock: {label: '股票', color: '#2563eb'},
  fund: {label: '基金', color: '#0f766e'},
  gold: {label: '黄金', color: '#ca8a04'},
  bond: {label: '债券', color: '#059669'},
  futures: {label: '期货', color: '#ea580c'},
  'public-fund': {label: '公募', color: '#7c3aed'},
  'private-fund': {label: '私募', color: '#dc2626'},
  'vc-pe': {label: 'VC/PE', color: '#db2777'},
  macro: {label: '宏观', color: '#0891b2'},
  portfolio: {label: '组合配置', color: '#b45309'},
  other: {label: '其他', color: '#6b7280'},
};

const STYLE_LOOKUP: Record<InvestmentExpertStyle, {label: string; color: string}> = {
  value: {label: '价值', color: '#2563eb'},
  income: {label: '红利收益', color: '#059669'},
  event: {label: '事件驱动', color: '#ea580c'},
  sentiment: {label: '情绪', color: '#db2777'},
  signal: {label: '信号', color: '#dc2626'},
  growth: {label: '成长', color: '#16a34a'},
  technology: {label: '科技', color: '#4f46e5'},
  portfolio: {label: '组合', color: '#b45309'},
  macro: {label: '宏观', color: '#0891b2'},
  quant: {label: '量化', color: '#7c3aed'},
  other: {label: '其他', color: '#6b7280'},
};

const LEGACY_CATEGORY_ALIASES: Record<string, InvestmentExpertDomain> = {
  stock: 'stock',
  value: 'stock',
  growth: 'stock',
  technology: 'stock',
  event: 'stock',
  sentiment: 'stock',
  signal: 'stock',
  quant: 'stock',
  fund: 'fund',
  'public-fund': 'public-fund',
  'private-fund': 'private-fund',
  bond: 'bond',
  income: 'bond',
  futures: 'futures',
  forex: 'macro',
  reits: 'fund',
  global: 'macro',
  gold: 'gold',
  portfolio: 'portfolio',
  macro: 'macro',
  comprehensive: 'other',
};

const DOMAIN_KEYWORDS: Array<{domain: InvestmentExpertDomain; patterns: RegExp[]}> = [
  {domain: 'gold', patterns: [/黄金|gold|贵金属/i]},
  {domain: 'bond', patterns: [/债券|固收|bond|credit|利差|久期/i]},
  {domain: 'futures', patterns: [/期货|futures|商品|cta\b/i]},
  {domain: 'public-fund', patterns: [/公募|mutual fund|fund manager|基金经理/i]},
  {domain: 'private-fund', patterns: [/私募|hedge fund|对冲基金|私募基金/i]},
  {domain: 'vc-pe', patterns: [/\bvc\b|\bpe\b|venture|private equity|一级市场|创投|风投|并购基金/i]},
  {domain: 'macro', patterns: [/宏观|macro|大类资产|资产配置|bridgewater|利率|通胀|美元/i]},
  {domain: 'fund', patterns: [/基金|etf|fof|qdii|基金投顾/i]},
  {domain: 'stock', patterns: [/股票|a股|港股|美股|选股|value|growth|quality|dividend|红利|股息|科技|价值投资/i]},
  {domain: 'portfolio', patterns: [/组合|portfolio|配置|allocation|风险管理|再平衡/i]},
];

function readMetadataString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized || null;
}

function readMetadataNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

function readMetadataBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return null;
}

function readMetadataStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCategory(value: string | null): InvestmentExpertDomain {
  if (value && value in DOMAIN_LOOKUP) {
    return value as InvestmentExpertDomain;
  }
  if (value && value in LEGACY_CATEGORY_ALIASES) {
    return LEGACY_CATEGORY_ALIASES[value];
  }
  return 'other';
}

function normalizeStyle(value: string | null): InvestmentExpertStyle {
  if (value && value in STYLE_LOOKUP) {
    return value as InvestmentExpertStyle;
  }
  return 'other';
}

function inferDomainFromMetadata(agent: LobsterAgent, metadata: Record<string, unknown>): InvestmentExpertDomain {
  const explicitDomain = normalizeCategory(
    readMetadataString(metadata.financial_domain) ||
      readMetadataString(metadata.asset_domain) ||
      readMetadataString(metadata.market_domain),
  );
  if (explicitDomain !== 'other') {
    return explicitDomain;
  }

  const legacyCategory = normalizeCategory(readMetadataString(metadata.investment_category));
  const haystack = [
    agent.name,
    agent.description,
    readMetadataString(metadata.subtitle) || '',
    readMetadataString(metadata.source_person) || '',
    ...agent.tags,
    ...readMetadataStringArray(metadata.task_examples),
  ]
    .join(' ')
    .toLowerCase();

  for (const rule of DOMAIN_KEYWORDS) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      return rule.domain;
    }
  }

  return legacyCategory;
}

function readSkillHighlights(value: unknown): InvestmentExpertSkill[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null;
      }
      const title = readMetadataString((item as Record<string, unknown>).title);
      const description = readMetadataString((item as Record<string, unknown>).description);
      if (!title || !description) {
        return null;
      }
      return {title, description};
    })
    .filter((item): item is InvestmentExpertSkill => Boolean(item));
}

function readConversationPreview(value: unknown): InvestmentExpertConversationMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null;
      }
      const role = readMetadataString((item as Record<string, unknown>).role);
      const content = readMetadataString((item as Record<string, unknown>).content);
      if (!content || (role !== 'user' && role !== 'expert')) {
        return null;
      }
      return {role, content};
    })
    .filter((item): item is InvestmentExpertConversationMessage => Boolean(item));
}

export function toInvestmentExpert(agent: LobsterAgent): InvestmentExpert | null {
  if (!isInvestmentExpertAgent(agent)) {
    return null;
  }

  const metadata = agent.metadata || {};
  const domain = inferDomainFromMetadata(agent, metadata);
  const domainMeta = DOMAIN_LOOKUP[domain];
  const style = normalizeStyle(readMetadataString(metadata.investment_category));
  const styleMeta = STYLE_LOOKUP[style];

  return {
    id: agent.slug,
    slug: agent.slug,
    name: agent.name,
    subtitle: readMetadataString(metadata.subtitle) || agent.description,
    domain,
    domainLabel: domainMeta.label,
    domainColor: domainMeta.color,
    style,
    styleLabel: styleMeta.label,
    styleColor: styleMeta.color,
    description: agent.description,
    tags: [...agent.tags],
    avatar: resolveLobsterAgentAvatar(agent),
    isOnline: readMetadataBoolean(metadata.is_online) ?? true,
    usageCount: readMetadataNumber(metadata.usage_count) ?? 0,
    taskCount: readMetadataNumber(metadata.task_count) ?? 0,
    rating: readMetadataNumber(metadata.rating) ?? 0,
    isRecommended: readMetadataBoolean(metadata.is_recommended) ?? false,
    isHot: readMetadataBoolean(metadata.is_hot) ?? false,
    skills: readSkillHighlights(metadata.skill_highlights),
    taskExamples: readMetadataStringArray(metadata.task_examples),
    conversationPreview: readConversationPreview(metadata.conversation_preview),
    installed: agent.installed,
    primarySkillSlug: readMetadataString(metadata.primary_skill_slug),
  };
}

export function hydrateInvestmentExperts(agents: LobsterAgent[]): InvestmentExpert[] {
  return agents
    .map((agent) => toInvestmentExpert(agent))
    .filter((expert): expert is InvestmentExpert => Boolean(expert))
    .sort((left, right) => {
      if (left.isRecommended !== right.isRecommended) {
        return left.isRecommended ? -1 : 1;
      }
      if (left.isHot !== right.isHot) {
        return left.isHot ? -1 : 1;
      }
      return right.usageCount - left.usageCount || left.name.localeCompare(right.name, 'zh-CN');
    });
}

export function resolveVisibleInvestmentExpertCategories(
  experts: InvestmentExpert[],
): Array<{id: InvestmentExpertFilter; label: string; color: string}> {
  const present = new Set<InvestmentExpertDomain>(experts.map((expert) => expert.domain));
  return INVESTMENT_EXPERT_CATEGORIES.filter((category) => category.id === 'all' || present.has(category.id));
}

export function resolveVisibleInvestmentExpertStyles(
  experts: InvestmentExpert[],
): Array<{id: InvestmentExpertStyleFilter; label: string; color: string}> {
  const present = new Set<InvestmentExpertStyle>(experts.map((expert) => expert.style));
  return INVESTMENT_EXPERT_STYLES.filter((style) => style.id === 'all' || present.has(style.id));
}

export async function loadInvestmentExperts(input: {
  client: IClawClient;
  accessToken: string | null;
}): Promise<InvestmentExpert[]> {
  const agents = await loadLobsterAgents(input);
  return hydrateInvestmentExperts(agents);
}
