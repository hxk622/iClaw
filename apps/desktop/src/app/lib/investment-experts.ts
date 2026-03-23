import type { IClawClient } from '@iclaw/sdk';

import { isInvestmentExpertAgent, loadLobsterAgents, type LobsterAgent } from './lobster-store';

export type InvestmentExpertCategory =
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

export type InvestmentExpertFilter = 'all' | InvestmentExpertCategory;
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
  category: InvestmentExpertCategory;
  categoryLabel: string;
  categoryColor: string;
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
  {id: 'value', label: '价值投资', color: '#2563eb'},
  {id: 'income', label: '红利收益', color: '#059669'},
  {id: 'quant', label: '量化策略', color: '#7c3aed'},
  {id: 'macro', label: '宏观轮动', color: '#0891b2'},
  {id: 'event', label: '事件驱动', color: '#ea580c'},
  {id: 'sentiment', label: '情绪背离', color: '#db2777'},
  {id: 'signal', label: '内部信号', color: '#dc2626'},
  {id: 'growth', label: '成长挖掘', color: '#16a34a'},
  {id: 'technology', label: '科技估值', color: '#4f46e5'},
  {id: 'portfolio', label: '组合诊断', color: '#b45309'},
  {id: 'other', label: '其他', color: '#6b7280'},
];

const CATEGORY_LOOKUP: Record<InvestmentExpertCategory, {label: string; color: string}> = {
  value: {label: '价值投资', color: '#2563eb'},
  income: {label: '红利收益', color: '#059669'},
  event: {label: '事件驱动', color: '#ea580c'},
  sentiment: {label: '情绪背离', color: '#db2777'},
  signal: {label: '内部信号', color: '#dc2626'},
  growth: {label: '成长挖掘', color: '#16a34a'},
  technology: {label: '科技估值', color: '#4f46e5'},
  portfolio: {label: '组合诊断', color: '#b45309'},
  macro: {label: '宏观轮动', color: '#0891b2'},
  quant: {label: '量化策略', color: '#7c3aed'},
  other: {label: '其他', color: '#6b7280'},
};

const LEGACY_CATEGORY_ALIASES: Record<string, InvestmentExpertCategory> = {
  stock: 'value',
  fund: 'portfolio',
  bond: 'income',
  futures: 'event',
  forex: 'macro',
  reits: 'income',
  global: 'value',
  comprehensive: 'other',
};

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

function normalizeCategory(value: string | null): InvestmentExpertCategory {
  if (value && value in CATEGORY_LOOKUP) {
    return value as InvestmentExpertCategory;
  }
  if (value && value in LEGACY_CATEGORY_ALIASES) {
    return LEGACY_CATEGORY_ALIASES[value];
  }
  return 'other';
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
  const category = normalizeCategory(readMetadataString(metadata.investment_category));
  const categoryMeta = CATEGORY_LOOKUP[category];

  return {
    id: agent.slug,
    slug: agent.slug,
    name: agent.name,
    subtitle: readMetadataString(metadata.subtitle) || agent.description,
    category,
    categoryLabel: categoryMeta.label,
    categoryColor: categoryMeta.color,
    description: agent.description,
    tags: [...agent.tags],
    avatar: readMetadataString(metadata.avatar_url) || agent.avatarSrc,
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

export async function loadInvestmentExperts(input: {
  client: IClawClient;
  accessToken: string | null;
}): Promise<InvestmentExpert[]> {
  const agents = await loadLobsterAgents(input);
  return hydrateInvestmentExperts(agents);
}
