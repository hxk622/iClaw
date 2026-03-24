#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const origRoot = path.join(repoRoot, '.tmp-docs/agency-agents-src/orig');
const zhRoot = path.join(repoRoot, '.tmp-docs/agency-agents-src/zh');
const origReadmePath = path.join(origRoot, 'README.md');
const zhReadmePath = path.join(zhRoot, 'README.md');
const outputPath = path.join(repoRoot, 'services/control-plane/src/generated/agency-agents-catalog.ts');

const DIVISION_CONFIG = {
  academic: {label: '学术研究', category: 'general', emoji: '📚'},
  design: {label: '设计创意', category: 'content', emoji: '🎨'},
  engineering: {label: '工程开发', category: 'general', emoji: '💻'},
  'game-development': {label: '游戏开发', category: 'general', emoji: '🎮'},
  marketing: {label: '市场营销', category: 'content', emoji: '📣'},
  'paid-media': {label: '付费投放', category: 'commerce', emoji: '📡'},
  product: {label: '产品策划', category: 'productivity', emoji: '📊'},
  'project-management': {label: '项目管理', category: 'productivity', emoji: '🎬'},
  sales: {label: '销售增长', category: 'commerce', emoji: '💼'},
  'spatial-computing': {label: '空间计算', category: 'general', emoji: '🥽'},
  specialized: {label: '专项专家', category: 'general', emoji: '🎯'},
  strategy: {label: '战略咨询', category: 'commerce', emoji: '♟️'},
  support: {label: '运营支持', category: 'productivity', emoji: '🛟'},
  testing: {label: '测试质控', category: 'productivity', emoji: '🧪'},
};

function normalizeWhitespace(value) {
  return value.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return {meta: {}, body: raw};
  }

  const meta = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }

  return {meta, body: raw.slice(match[0].length)};
}

function splitListText(value, limit = 3) {
  const items = value
    .split(/[、，,；;｜|]/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);

  return [...new Set(items)].slice(0, limit);
}

function extractSummary(body) {
  const withoutCode = body.replace(/```[\s\S]*?```/g, '');
  const lines = withoutCode
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .filter((line) => !line.startsWith('```'));

  const picked = [];
  let length = 0;
  for (const line of lines) {
    const normalized = line.replace(/^[-*]\s*/, '');
    if (!normalized) {
      continue;
    }
    picked.push(normalized);
    length += normalized.length;
    if (picked.length >= 4 || length >= 260) {
      break;
    }
  }

  return normalizeWhitespace(picked.join(' ')).slice(0, 320);
}

function parseZhReadmeTableRows(readme) {
  const rows = new Map();
  const regex = /^\|\s*\[([^\]]+)\]\(([^)]+\.md)\)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm;
  let match = regex.exec(readme);
  while (match) {
    const [, name, relPath, specialty, useCase] = match;
    rows.set(relPath.trim(), {
      name: normalizeWhitespace(name),
      specialty: normalizeWhitespace(specialty),
      useCase: normalizeWhitespace(useCase),
    });
    match = regex.exec(readme);
  }
  return rows;
}

function slugFromPath(relPath) {
  return `agency-${relPath.replace(/\.md$/i, '').replace(/[\\/]+/g, '-')}`;
}

function buildSystemPrompt(input) {
  const capabilityLines = input.capabilities.map((item, index) => `${index + 1}. ${item}`).join('\n');
  const useCaseLines = input.useCases.map((item, index) => `${index + 1}. ${item}`).join('\n');

  return [
    `你是${input.name}。`,
    `角色定位：${input.description}`,
    `所属分组：${input.divisionLabel}`,
    input.subtitle ? `核心专长：${input.subtitle}` : '',
    input.summary ? `工作摘要：${input.summary}` : '',
    '重点能力：',
    capabilityLines,
    '适用场景：',
    useCaseLines,
    '输出要求：',
    '1. 先明确目标、约束和成功标准，再展开方案。',
    '2. 默认给出可执行步骤、关键判断依据、风险提醒和下一步建议。',
    '3. 回答要保持专业、直接、面向交付，而不是泛泛而谈。',
  ]
    .filter(Boolean)
    .join('\n');
}

function safeReadFile(targetPath) {
  return fs.readFile(targetPath, 'utf8').catch(() => null);
}

function ensureArray(value, fallback) {
  return value.length > 0 ? value : fallback;
}

function titleFallbackFromSlug(relPath) {
  const base = path.basename(relPath, '.md');
  return base
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

async function main() {
  const origReadme = await fs.readFile(origReadmePath, 'utf8');
  const zhReadme = await fs.readFile(zhReadmePath, 'utf8');
  const zhRows = parseZhReadmeTableRows(zhReadme);

  const seeds = [];
  const sortedFiles = [...new Set(origReadme.match(/\]\(([^)#]+\.md)\)/g)?.map((item) => item.slice(2, -1)) || [])]
    .filter((relPath) => relPath.includes('/'))
    .filter((relPath) => !relPath.startsWith('examples/'))
    .filter((relPath) => !relPath.startsWith('integrations/'))
    .sort((left, right) => left.localeCompare(right, 'en'));

  for (const [index, relPath] of sortedFiles.entries()) {
    const division = relPath.split('/')[0];
    const divisionConfig = DIVISION_CONFIG[division] || {label: '通用助手', category: 'general', emoji: '🦞'};
    const origRaw = await safeReadFile(path.join(origRoot, relPath));
    const zhRaw = await safeReadFile(path.join(zhRoot, relPath));
    if (!origRaw || !zhRaw) {
      throw new Error(`missing source file for ${relPath}`);
    }

    const {meta: origMeta} = parseFrontmatter(origRaw);
    const {meta: zhMeta, body: zhBody} = parseFrontmatter(zhRaw);
    const readmeRow = zhRows.get(relPath);

    const name = normalizeWhitespace(zhMeta.name || readmeRow?.name || titleFallbackFromSlug(relPath));
    const description = normalizeWhitespace(zhMeta.description || readmeRow?.specialty || name);
    const subtitle = normalizeWhitespace(readmeRow?.specialty || description);
    const capabilities = ensureArray(
      splitListText(readmeRow?.specialty || ''),
      ensureArray(splitListText(description), [divisionConfig.label]),
    );
    const useCases = ensureArray(
      splitListText(readmeRow?.useCase || ''),
      [`适合需要${divisionConfig.label}支持的任务`, `适合需要${name}参与的复杂工作`],
    );
    const summary = extractSummary(zhBody);
    const emoji = normalizeWhitespace(zhMeta.emoji || origMeta.emoji || divisionConfig.emoji);
    const tags = [...new Set([divisionConfig.label, ...capabilities].filter(Boolean))].slice(0, 5);

    seeds.push({
      slug: slugFromPath(relPath),
      name,
      description,
      category: divisionConfig.category,
      publisher: 'Agency Agents',
      featured: false,
      official: false,
      tags,
      capabilities,
      useCases,
      metadata: {
        surface: 'lobster-store',
        subtitle,
        avatar_emoji: emoji,
        agency_division: division,
        agency_division_label: divisionConfig.label,
        source_repo: 'msitarzewski/agency-agents',
        source_translation_repo: 'jnMetaCode/agency-agents-zh',
        source_path: relPath,
        locale: 'zh-CN',
        system_prompt: buildSystemPrompt({
          name,
          description,
          divisionLabel: divisionConfig.label,
          subtitle,
          summary,
          capabilities,
          useCases,
        }),
      },
      active: true,
      sortOrder: 3000 + index,
    });
  }

  const output = `import type {AgentCatalogEntryRecord} from '../domain.ts';\n\n` +
    `export const AGENCY_AGENTS_CATALOG_SEEDS = ${JSON.stringify(seeds, null, 2)} as const satisfies Array<Omit<AgentCatalogEntryRecord, 'createdAt' | 'updatedAt'>>;\n`;

  await fs.mkdir(path.dirname(outputPath), {recursive: true});
  await fs.writeFile(outputPath, output);

  console.log(`Generated ${seeds.length} agency agent seeds -> ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
