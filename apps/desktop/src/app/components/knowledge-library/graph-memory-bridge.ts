import type { OntologyDocument } from './ontology-types.ts';
import { getOntologyGraphIdentity, getOntologyRevisionId } from './ontology-revisions.ts';
import { saveMemoryEntry, type MemoryEntryRecord } from '../../lib/tauri-memory.ts';

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
