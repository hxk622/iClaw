import { readCacheJson, writeCacheJson } from '../../lib/persistence/cache-store.ts';
import { buildStorageKey } from '../../lib/storage.ts';
import type { CreateRawMaterialInput, RawMaterial, RawMaterialKind, RawMaterialSourceType } from './types.ts';

const RAW_MATERIALS_STORAGE_KEY = buildStorageKey('knowledge-library.raw-materials.v1');

type RawMaterialStore = {
  version: 1;
  updated_at: string;
  items: RawMaterial[];
};

const MAX_RAW_MATERIALS = 500;

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `raw_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeString(value: unknown, maxLength = 2000): string {
  if (typeof value !== 'string') return '';
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > maxLength ? `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : compact;
}

function normalizeBodyText(value: unknown, maxLength = 20000): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : trimmed;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags = value
    .map((entry) => normalizeString(entry, 40))
    .filter(Boolean)
    .slice(0, 8);
  return Array.from(new Set(tags));
}

function normalizeKind(value: unknown): RawMaterialKind {
  switch (value) {
    case 'source':
    case 'snippet':
    case 'upload':
    case 'transcript':
    case 'chat':
    case 'url':
      return value;
    default:
      return 'upload';
  }
}

function normalizeSourceType(value: unknown): RawMaterialSourceType {
  switch (value) {
    case 'text':
    case 'video':
    case 'pdf':
    case 'image':
    case 'audio':
    case 'chat':
    case 'file':
      return value;
    default:
      return 'file';
  }
}

function normalizeIso(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return nowIso();
}

function normalizeUrl(value: unknown): string | null {
  const raw = normalizeString(value, 4096);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    const serialized = parsed.toString();
    return serialized.endsWith('/') ? serialized.slice(0, -1) : serialized;
  } catch {
    return raw;
  }
}

function buildDedupeKey(input: {
  kind: RawMaterialKind;
  title: string;
  sourceUrl: string | null;
  contentText: string;
  mimeType: string | null;
}): string {
  const seed = [
    input.kind,
    input.sourceUrl || '',
    normalizeString(input.title, 180).toLowerCase(),
    normalizeString(input.contentText, 240).toLowerCase(),
    input.mimeType || '',
  ].join('::');
  return seed;
}

function parseStore(raw: unknown): RawMaterialStore {
  if (!raw || typeof raw !== 'object') {
    return { version: 1, updated_at: nowIso(), items: [] };
  }
  const candidate = raw as Partial<RawMaterialStore>;
  const items = Array.isArray(candidate.items) ? candidate.items : [];
  return {
    version: 1,
    updated_at: normalizeIso(candidate.updated_at),
    items: items
      .filter((item) => Boolean(item && typeof item === 'object'))
      .map((item) => {
        const record = item as Partial<RawMaterial>;
        return {
          id: normalizeString(record.id, 120) || createId(),
          kind: normalizeKind(record.kind),
          title: normalizeString(record.title, 240) || '未命名素材',
          excerpt: normalizeString(record.excerpt, 400),
          content_text: normalizeBodyText(record.content_text),
          source_url: normalizeUrl(record.source_url),
          source_name: normalizeString(record.source_name, 80) || '本地素材',
          source_type: normalizeSourceType(record.source_type),
          source_icon: normalizeString(record.source_icon, 40) || null,
          mime_type: normalizeString(record.mime_type, 120) || null,
          timestamp_label: normalizeString(record.timestamp_label, 40) || null,
          note: normalizeString(record.note, 280) || null,
          tags: normalizeTags(record.tags),
          dedupe_key:
            normalizeString(record.dedupe_key, 500) ||
            buildDedupeKey({
              kind: normalizeKind(record.kind),
              title: normalizeString(record.title, 240),
              sourceUrl: normalizeUrl(record.source_url),
              contentText: normalizeBodyText(record.content_text),
              mimeType: normalizeString(record.mime_type, 120) || null,
            }),
          created_at: normalizeIso(record.created_at),
          updated_at: normalizeIso(record.updated_at),
        } satisfies RawMaterial;
      })
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
      .slice(0, MAX_RAW_MATERIALS),
  };
}

function readStore(): RawMaterialStore {
  return parseStore(readCacheJson<RawMaterialStore>(RAW_MATERIALS_STORAGE_KEY));
}

function writeStore(store: RawMaterialStore): void {
  writeCacheJson(RAW_MATERIALS_STORAGE_KEY, store);
}

function toRawMaterial(input: CreateRawMaterialInput, id = createId()): RawMaterial {
  const title = normalizeString(input.title, 240) || '未命名素材';
  const contentText = normalizeBodyText(input.content_text);
  const excerpt = normalizeString(input.excerpt, 400) || normalizeString(contentText, 400);
  const sourceUrl = normalizeUrl(input.source_url);
  const mimeType = normalizeString(input.mime_type, 120) || null;
  const timestampLabel = normalizeString(input.timestamp_label, 40) || null;
  const createdAt = nowIso();
  return {
    id,
    kind: normalizeKind(input.kind),
    title,
    excerpt,
    content_text: contentText,
    source_url: sourceUrl,
    source_name: normalizeString(input.source_name, 80) || '本地素材',
    source_type: normalizeSourceType(input.source_type),
    source_icon: normalizeString(input.source_icon, 40) || null,
    mime_type: mimeType,
    timestamp_label: timestampLabel,
    note: normalizeString(input.note, 280) || null,
    tags: normalizeTags(input.tags),
    dedupe_key:
      normalizeString(input.dedupe_key, 500) ||
      buildDedupeKey({
        kind: normalizeKind(input.kind),
        title,
        sourceUrl,
        contentText,
        mimeType,
      }),
    created_at: createdAt,
    updated_at: createdAt,
  };
}

export function listRawMaterials(): RawMaterial[] {
  return readStore().items;
}

export function getRawMaterialById(id: string): RawMaterial | null {
  const safeId = normalizeString(id, 120);
  if (!safeId) return null;
  return readStore().items.find((item) => item.id === safeId) || null;
}

export function upsertRawMaterial(input: CreateRawMaterialInput): RawMaterial {
  const store = readStore();
  const next = toRawMaterial(input);
  const duplicate = store.items.find((item) => item.dedupe_key === next.dedupe_key);
  if (duplicate) {
    const updated: RawMaterial = {
      ...duplicate,
      ...next,
      id: duplicate.id,
      created_at: duplicate.created_at,
      updated_at: nowIso(),
    };
    writeStore({
      version: 1,
      updated_at: updated.updated_at,
      items: [updated, ...store.items.filter((item) => item.id !== duplicate.id)].slice(0, MAX_RAW_MATERIALS),
    });
    return updated;
  }
  writeStore({
    version: 1,
    updated_at: next.updated_at,
    items: [next, ...store.items].slice(0, MAX_RAW_MATERIALS),
  });
  return next;
}

export function createRawMaterial(input: CreateRawMaterialInput): RawMaterial {
  const next = toRawMaterial(input);
  const store = readStore();
  writeStore({
    version: 1,
    updated_at: next.updated_at,
    items: [next, ...store.items].slice(0, MAX_RAW_MATERIALS),
  });
  return next;
}

export function deleteRawMaterial(id: string): void {
  const safeId = normalizeString(id, 120);
  if (!safeId) return;
  const store = readStore();
  const items = store.items.filter((item) => item.id !== safeId);
  writeStore({ version: 1, updated_at: nowIso(), items });
}
