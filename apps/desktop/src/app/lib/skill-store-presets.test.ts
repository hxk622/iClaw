import test from 'node:test';
import assert from 'node:assert/strict';

import type { SkillStoreItem } from './skill-store.ts';
import {
  applySkillPreset,
  FINANCE_TAG_KEYWORDS,
  getCatalogTagKeywordsForPreset,
  isFinanceSkill,
  isFoundationSkill,
} from './skill-store-presets.ts';

function makeSkill(input: Partial<SkillStoreItem> & Pick<SkillStoreItem, 'slug' | 'name'>): SkillStoreItem {
  return {
    slug: input.slug,
    name: input.name,
    description: input.description || '',
    tags: input.tags || [],
    downloadCount: input.downloadCount ?? null,
    featured: input.featured ?? false,
    source: input.source || 'cloud',
    market: input.market || '通用',
    skillType: input.skillType || '工具包',
    categoryId: input.categoryId || 'general',
    categoryLabel: input.categoryLabel || '通用工具',
    official: input.official ?? false,
    installed: input.installed ?? false,
    userInstalled: input.userInstalled ?? false,
    localInstalled: input.localInstalled ?? false,
    enabled: input.enabled ?? true,
    sourceLabel: input.sourceLabel || '云端',
    publisher: input.publisher || 'test',
    version: input.version ?? '1.0.0',
    artifactUrl: input.artifactUrl ?? null,
    artifactFormat: input.artifactFormat ?? null,
    artifactSha256: input.artifactSha256 ?? null,
    sourceUrl: input.sourceUrl ?? null,
    metadata: input.metadata || {},
    setupSchema: input.setupSchema ?? null,
    setupStatus: input.setupStatus || 'ready',
    setupSchemaVersion: input.setupSchemaVersion ?? null,
    setupUpdatedAt: input.setupUpdatedAt ?? null,
  };
}

test('finance skill detection still follows finance tag keywords', () => {
  const financeSkill = makeSkill({
    slug: 'quant-skill',
    name: '量化因子',
    tags: ['量化', '研究'],
  });
  const generalSkill = makeSkill({
    slug: 'docx',
    name: 'DOCX',
    tags: ['办公', '文档'],
  });

  assert.equal(isFinanceSkill(financeSkill), true);
  assert.equal(isFinanceSkill(generalSkill), false);
});

test('foundation skill is defined as skill-store minus finance skills', () => {
  const financeSkill = makeSkill({
    slug: 'a-share-data',
    name: 'A股数据',
    tags: ['A股', '数据工具'],
  });
  const unlabeledGeneralSkill = makeSkill({
    slug: 'rtk-awareness',
    name: 'RTK Awareness',
    tags: ['cli', 'developer-tools'],
  });

  assert.equal(isFoundationSkill(financeSkill), false);
  assert.equal(isFoundationSkill(unlabeledGeneralSkill), true);
});

test('preset partition keeps skill-store equal to finance plus foundation without overlap', () => {
  const items = [
    makeSkill({slug: 'finance-1', name: 'Finance 1', tags: ['基金']}),
    makeSkill({slug: 'finance-2', name: 'Finance 2', tags: ['股票', '研究']}),
    makeSkill({slug: 'general-1', name: 'General 1', tags: ['办公']}),
    makeSkill({slug: 'general-2', name: 'General 2', tags: []}),
  ];

  const all = applySkillPreset(items, 'all').map((item) => item.slug);
  const finance = applySkillPreset(items, 'finance').map((item) => item.slug);
  const foundation = applySkillPreset(items, 'foundation').map((item) => item.slug);

  assert.deepEqual(all, ['finance-1', 'finance-2', 'general-1', 'general-2']);
  assert.deepEqual(finance, ['finance-1', 'finance-2']);
  assert.deepEqual(foundation, ['general-1', 'general-2']);
  assert.deepEqual([...finance, ...foundation].sort(), [...all].sort());
  assert.equal(finance.some((slug) => foundation.includes(slug)), false);
});

test('foundation preset no longer applies an independent backend tag filter', () => {
  assert.deepEqual(getCatalogTagKeywordsForPreset('all'), []);
  assert.deepEqual(getCatalogTagKeywordsForPreset('foundation'), []);
  assert.deepEqual(getCatalogTagKeywordsForPreset('finance'), [...FINANCE_TAG_KEYWORDS]);
});
