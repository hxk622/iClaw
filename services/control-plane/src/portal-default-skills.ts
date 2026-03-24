export const PLATFORM_FORCED_SKILL_SLUGS = [
  'document-skills',
  'docx',
  'find-skills',
  'liang-tavily-search',
  'multi-search-engine',
  'pdf',
  'proactive-agent-skill',
  'self-improving-agent',
  'skill-vetter',
  'stock-analysis-skill',
  'stock-watcher',
  'summarize',
  'xlsx',
  '股票技术分析师',
  '股票研究分析师',
  '财务报表分析师',
] as const;

const PLATFORM_FORCED_SKILL_SET = new Set<string>(PLATFORM_FORCED_SKILL_SLUGS);

export function isPlatformForcedSkillSlug(skillSlug: string): boolean {
  return PLATFORM_FORCED_SKILL_SET.has(skillSlug.trim());
}
