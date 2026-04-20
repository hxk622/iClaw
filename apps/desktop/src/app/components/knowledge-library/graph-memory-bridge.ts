import type { OntologyDocument } from './ontology-types.ts';
import { getOntologyGraphIdentity, getOntologyRevisionId } from './ontology-revisions.ts';
import { loadMemorySnapshot, saveMemoryEntry, type MemoryEntryRecord } from '../../lib/tauri-memory.ts';

function normalizeText(value: string | null | undefined, maxLength = 2400): string {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface BuildGraphContextMemoryInput {
  ontologyDocument: OntologyDocument;
  kind: 'query' | 'path';
  question: string;
  answer: string;
  focusedNodeLabels?: string[];
  sourceOutputIds?: string[];
}

export interface GraphContextMemoryCard {
  id: string;
  graphIdentity: string;
  revisionId: string;
  question: string;
  answer: string;
  focusedNodeLabels: string[];
  sourceOutputIds: string[];
  updatedAt: string;
  summary: string;
}

export function buildGraphContextMemoryEntry(input: BuildGraphContextMemoryInput): MemoryEntryRecord {
  const graphIdentity = getOntologyGraphIdentity(input.ontologyDocument);
  const revisionId = getOntologyRevisionId(input.ontologyDocument);
  const focusedNodeLabels = (input.focusedNodeLabels || []).filter(Boolean).slice(0, 8);
  const sourceOutputIds = (input.sourceOutputIds || []).filter(Boolean).slice(0, 8);
  const summary = normalizeText(input.answer, 120);
  const seed = JSON.stringify({
    graphIdentity,
    revisionId,
    kind: input.kind,
    question: input.question,
    answer: input.answer,
    focusedNodeLabels,
  });
  const id = `memory-graph-context-${fnv1a(seed)}`;
  const createdAt = nowIso();

  return {
    id,
    title: input.kind === 'path' ? `${input.ontologyDocument.title} 路径推理` : `${input.ontologyDocument.title} 图查询`,
    summary: summary || `${input.ontologyDocument.title} 图谱上下文`,
    content: `# 图谱上下文\n\n## Graph Identity\n${graphIdentity}\n\n## Revision\n${revisionId}\n\n## 问题\n${normalizeText(
      input.question,
      1200,
    )}\n\n## 结果\n${normalizeText(input.answer, 6000)}${
      focusedNodeLabels.length > 0 ? `\n\n## Focused Nodes\n${focusedNodeLabels.map((label) => `- ${label}`).join('\n')}` : ''
    }${
      sourceOutputIds.length > 0 ? `\n\n## Source Outputs\n${sourceOutputIds.map((id) => `- ${id}`).join('\n')}` : ''
    }`,
    domain: '研究',
    type: '事实',
    importance: '中',
    sourceType: '对话沉淀',
    sourceLabel: '图谱上下文',
    tags: ['图谱', '上下文', input.kind === 'path' ? '路径' : '查询'],
    createdAt,
    updatedAt: createdAt,
    lastRecalledAt: null,
    recallCount: 0,
    captureConfidence: 0.92,
    indexHealth: '待刷新',
    status: '已确认',
    active: true,
  };
}

export async function persistGraphContextMemory(input: BuildGraphContextMemoryInput): Promise<MemoryEntryRecord | null> {
  const entry = buildGraphContextMemoryEntry(input);
  try {
    return (await saveMemoryEntry(entry)) ?? entry;
  } catch {
    return null;
  }
}

function extractSection(content: string, heading: string): string | null {
  const pattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = content.match(pattern);
  return match?.[1]?.trim() || null;
}

export function parseGraphContextMemoryEntry(entry: MemoryEntryRecord): GraphContextMemoryCard | null {
  if (!entry.active) {
    return null;
  }
  if (entry.sourceLabel !== '图谱上下文') {
    return null;
  }
  if (!entry.tags.includes('图谱')) {
    return null;
  }
  const graphIdentity = extractSection(entry.content, 'Graph Identity');
  const revisionId = extractSection(entry.content, 'Revision');
  const question = extractSection(entry.content, '问题');
  const answer = extractSection(entry.content, '结果');
  if (!graphIdentity || !revisionId || !question || !answer) {
    return null;
  }
  const focusedNodeLabels = (extractSection(entry.content, 'Focused Nodes') || '')
    .split('\n')
    .map((line) => line.replace(/^- /, '').trim())
    .filter(Boolean);
  const sourceOutputIds = (extractSection(entry.content, 'Source Outputs') || '')
    .split('\n')
    .map((line) => line.replace(/^- /, '').trim())
    .filter(Boolean);
  return {
    id: entry.id,
    graphIdentity,
    revisionId,
    question,
    answer,
    focusedNodeLabels,
    sourceOutputIds,
    updatedAt: entry.updatedAt,
    summary: entry.summary,
  };
}

export async function loadRelevantGraphContextMemory(input: {
  graphIdentity: string;
  revisionId: string;
  limit?: number;
}): Promise<GraphContextMemoryCard[]> {
  const snapshot = await loadMemorySnapshot();
  if (!snapshot) {
    return [];
  }
  return selectRelevantGraphContextMemoryCards(
    snapshot.entries
      .map(parseGraphContextMemoryEntry)
      .filter((entry): entry is GraphContextMemoryCard => Boolean(entry)),
    input,
  );
}

export function selectRelevantGraphContextMemoryCards(
  cards: readonly GraphContextMemoryCard[],
  input: {
    graphIdentity: string;
    revisionId: string;
    limit?: number;
  },
): GraphContextMemoryCard[] {
  const limit = Math.max(1, input.limit ?? 2);
  return cards
    .filter((entry) => entry.graphIdentity === input.graphIdentity && entry.revisionId === input.revisionId)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .slice(0, limit);
}

export function buildGraphContextMemoryPrompt(cards: GraphContextMemoryCard[]): string | null {
  if (!cards.length) {
    return null;
  }
  return cards
    .map(
      (card, index) =>
        `图谱上下文卡片 ${index + 1}\n问题：${normalizeText(card.question, 400)}\n结论：${normalizeText(
          card.answer,
          1200,
        )}${card.focusedNodeLabels.length ? `\n聚焦节点：${card.focusedNodeLabels.join('、')}` : ''}`,
    )
    .join('\n\n');
}

export function appendGraphContextMemoryPrompt(
  basePrompt: string,
  cards: GraphContextMemoryCard[],
  heading = '近期图谱工作记忆',
): string {
  const normalizedBasePrompt = String(basePrompt || '').trim();
  const memoryPrompt = buildGraphContextMemoryPrompt(cards);
  if (!normalizedBasePrompt || !memoryPrompt) {
    return normalizedBasePrompt;
  }
  return `${normalizedBasePrompt}\n\n${heading}：\n${memoryPrompt}`;
}

export async function appendRelevantGraphContextMemoryToPrompt(input: {
  basePrompt: string;
  ontologyDocument: OntologyDocument;
  limit?: number;
  heading?: string;
}): Promise<string> {
  const normalizedBasePrompt = String(input.basePrompt || '').trim();
  if (!normalizedBasePrompt) {
    return normalizedBasePrompt;
  }
  try {
    const cards = await loadRelevantGraphContextMemory({
      graphIdentity: getOntologyGraphIdentity(input.ontologyDocument),
      revisionId: getOntologyRevisionId(input.ontologyDocument),
      limit: input.limit,
    });
    return appendGraphContextMemoryPrompt(normalizedBasePrompt, cards, input.heading);
  } catch {
    return normalizedBasePrompt;
  }
}
