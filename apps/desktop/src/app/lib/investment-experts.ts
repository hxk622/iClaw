import type { IClawClient } from '@iclaw/sdk';

import { isInvestmentExpertAgent, loadLobsterAgents, type LobsterAgent } from './lobster-store';

export type InvestmentExpertCategory =
  | 'stock'
  | 'fund'
  | 'bond'
  | 'futures'
  | 'forex'
  | 'reits'
  | 'macro'
  | 'global'
  | 'quant'
  | 'comprehensive';

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
  {id: 'stock', label: '股票类', color: '#2563eb'},
  {id: 'fund', label: '基金类', color: '#059669'},
  {id: 'bond', label: '债券类', color: '#dc2626'},
  {id: 'futures', label: '期货类', color: '#ea580c'},
  {id: 'forex', label: '外汇类', color: '#7c3aed'},
  {id: 'reits', label: 'REITs类', color: '#f59e0b'},
  {id: 'macro', label: '宏观研究', color: '#0891b2'},
  {id: 'global', label: '全球市场', color: '#4f46e5'},
  {id: 'quant', label: '量化策略', color: '#db2777'},
  {id: 'comprehensive', label: '综合全能', color: '#6b7280'},
];

const CATEGORY_LOOKUP: Record<InvestmentExpertCategory, {label: string; color: string}> = {
  stock: {label: '股票类', color: '#2563eb'},
  fund: {label: '基金类', color: '#059669'},
  bond: {label: '债券类', color: '#dc2626'},
  futures: {label: '期货类', color: '#ea580c'},
  forex: {label: '外汇类', color: '#7c3aed'},
  reits: {label: 'REITs类', color: '#f59e0b'},
  macro: {label: '宏观研究', color: '#0891b2'},
  global: {label: '全球市场', color: '#4f46e5'},
  quant: {label: '量化策略', color: '#db2777'},
  comprehensive: {label: '综合全能', color: '#6b7280'},
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
  return 'comprehensive';
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
