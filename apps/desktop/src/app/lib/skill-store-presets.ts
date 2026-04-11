import type { SkillStoreItem } from './skill-store.ts';

export type SkillStorePreset = 'all' | 'finance' | 'foundation';

export const FINANCE_TAG_KEYWORDS = [
  '财经',
  '金融',
  '投资',
  '股票',
  '股市',
  'a股',
  '美股',
  '港股',
  '基金',
  '债券',
  '期权',
  '量化',
  '因子',
  '财报',
  '研报',
  '研究报告',
  '市场',
  '行业',
  '宏观',
  '组合',
  '风控',
  '风险',
  '回撤',
  '估值',
  '交易',
  '加密',
  '币圈',
  'esg',
] as const;

function normalizeSkillTag(value: string): string {
  return value.trim().toLowerCase();
}

function skillHasTagKeyword(skill: SkillStoreItem, keywords: readonly string[]): boolean {
  const normalizedTags = skill.tags.map(normalizeSkillTag);
  return normalizedTags.some((tag) => keywords.some((keyword) => tag.includes(keyword)));
}

export function isFinanceSkill(skill: SkillStoreItem): boolean {
  return skillHasTagKeyword(skill, FINANCE_TAG_KEYWORDS);
}

export function isFoundationSkill(skill: SkillStoreItem): boolean {
  return !isFinanceSkill(skill);
}

export function applySkillPreset<T extends SkillStoreItem>(items: T[], preset: SkillStorePreset): T[] {
  if (preset === 'all') {
    return items;
  }
  if (preset === 'finance') {
    return items.filter(isFinanceSkill);
  }
  return items.filter(isFoundationSkill);
}

export function getCatalogTagKeywordsForPreset(preset: SkillStorePreset): string[] {
  return preset === 'finance' ? [...FINANCE_TAG_KEYWORDS] : [];
}
