import { readCacheJson, writeCacheJson } from '@/app/lib/persistence/cache-store';
import { buildStorageKey } from '@/app/lib/storage';
import type { CreateOutputArtifactInput, OutputArtifact } from './output-types';

const OUTPUT_STORAGE_KEY = buildStorageKey('knowledge-library.output.v1');

type OutputStore = {
  version: 1;
  updated_at: string;
  items: OutputArtifact[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `output_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeString(value: unknown, maxLength = 8000): string {
  if (typeof value !== 'string') return '';
  const compact = value.trim();
  return compact.length > maxLength ? `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : compact;
}

function normalizeStringArray(value: unknown, maxLength = 80): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((entry) => normalizeString(entry, maxLength)).filter(Boolean)));
}

function parseStore(raw: unknown): OutputStore {
  if (!raw || typeof raw !== 'object') {
    return { version: 1, updated_at: nowIso(), items: [] };
  }
  const candidate = raw as Partial<OutputStore>;
  const items = Array.isArray(candidate.items) ? candidate.items : [];
  return {
    version: 1,
    updated_at: typeof candidate.updated_at === 'string' ? candidate.updated_at : nowIso(),
    items: items
      .filter((item) => item && typeof item === 'object')
      .map((item) => item as OutputArtifact)
      .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || ''))),
  };
}

function readStore(): OutputStore {
  return parseStore(readCacheJson<OutputStore>(OUTPUT_STORAGE_KEY));
}

function writeStore(store: OutputStore): void {
  writeCacheJson(OUTPUT_STORAGE_KEY, store);
}

function toOutputArtifact(input: CreateOutputArtifactInput, id = createId()): OutputArtifact {
  const now = nowIso();
  return {
    id,
    type: (input.type || 'memo') as OutputArtifact['type'],
    title: normalizeString(input.title, 240) || '未命名成果',
    summary: normalizeString(input.summary, 400) || '暂无摘要',
    content: normalizeString(input.content, 20000) || '',
    content_format: input.content_format || 'markdown',
    source_raw_ids: normalizeStringArray(input.source_raw_ids, 120),
    source_ontology_ids: normalizeStringArray(input.source_ontology_ids, 120),
    status: input.status || 'draft',
    publish_targets: normalizeStringArray(input.publish_targets, 80),
    metadata: input.metadata || null,
    created_at: now,
    updated_at: now,
  };
}

export function listOutputArtifacts(): OutputArtifact[] {
  return readStore().items;
}

export function getOutputArtifactById(id: string): OutputArtifact | null {
  const safeId = normalizeString(id, 120);
  if (!safeId) return null;
  return readStore().items.find((item) => item.id === safeId) || null;
}

export function upsertOutputArtifact(input: CreateOutputArtifactInput & { id?: string }): OutputArtifact {
  const store = readStore();
  const next = toOutputArtifact(input, input.id || createId());
  const items = [next, ...store.items.filter((item) => item.id !== next.id)].sort((left, right) =>
    String(right.updated_at || '').localeCompare(String(left.updated_at || '')),
  );
  writeStore({ version: 1, updated_at: next.updated_at, items });
  return next;
}
