import type { CreateRawMaterialInput, RawMaterial } from './types';
import type { KnowledgeLibraryRepository } from './repository';

export const KNOWLEDGE_LIBRARY_IMPORT_MESSAGE_TYPE = 'iclaw-knowledge-library-import-raw';
export const KNOWLEDGE_LIBRARY_IMPORT_EVENT = 'iclaw:knowledge-library:import-raw';

type BrowserCaptureKind = 'source' | 'snippet';
type BrowserCaptureSourceType = 'text' | 'video' | 'pdf' | 'image' | 'audio' | 'chat' | 'file';

export interface BrowserCapturePayload {
  version?: 1;
  kind: BrowserCaptureKind;
  title?: string;
  excerpt?: string;
  text?: string;
  url?: string | null;
  sourceName?: string;
  sourceType?: BrowserCaptureSourceType;
  sourceIcon?: string | null;
  mimeType?: string | null;
  timestampLabel?: string | null;
  note?: string | null;
  tags?: string[];
  dedupeKey?: string;
}

export interface BrowserCaptureBatchPayload {
  version?: 1;
  items: BrowserCapturePayload[];
}

function normalizeString(value: unknown, maxLength = 4000): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : trimmed;
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

function normalizeKind(value: unknown): BrowserCaptureKind {
  return value === 'snippet' ? 'snippet' : 'source';
}

function normalizeSourceType(value: unknown): BrowserCaptureSourceType {
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
      return 'text';
  }
}

export function normalizeBrowserCapturePayload(value: unknown): BrowserCapturePayload | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const kind = normalizeKind(record.kind);
  const title = normalizeString(record.title, 240);
  const excerpt = normalizeString(record.excerpt, 400);
  const text = normalizeString(record.text, 20000);
  const url = normalizeUrl(record.url);
  const sourceName = normalizeString(record.sourceName, 80) || '浏览器采集';
  const sourceType = normalizeSourceType(record.sourceType);
  const sourceIcon = normalizeString(record.sourceIcon, 40) || null;
  const mimeType = normalizeString(record.mimeType, 120) || null;
  const timestampLabel = normalizeString(record.timestampLabel, 40) || null;
  const note = normalizeString(record.note, 280) || null;
  const tags = Array.isArray(record.tags)
    ? Array.from(new Set(record.tags.map((tag) => normalizeString(tag, 40)).filter(Boolean))).slice(0, 8)
    : [];
  const dedupeKey = normalizeString(record.dedupeKey, 500) || undefined;

  if (!title && !excerpt && !text && !url) {
    return null;
  }

  return {
    version: 1,
    kind,
    title,
    excerpt,
    text,
    url,
    sourceName,
    sourceType,
    sourceIcon,
    mimeType,
    timestampLabel,
    note,
    tags,
    dedupeKey,
  };
}

export function mapBrowserCaptureToRawInput(payload: BrowserCapturePayload): CreateRawMaterialInput {
  const title = payload.title || (payload.kind === 'snippet' ? normalizeString(payload.text, 80) || '未命名摘录' : payload.url || '未命名网页');
  const text = payload.text || '';
  const excerpt = payload.excerpt || normalizeString(text, 400) || title;
  return {
    kind: payload.kind,
    title,
    excerpt,
    content_text: text,
    source_url: payload.url,
    source_name: payload.sourceName || '浏览器采集',
    source_type: payload.sourceType || 'text',
    source_icon: payload.sourceIcon || null,
    mime_type: payload.mimeType || null,
    timestamp_label: payload.timestampLabel || null,
    note: payload.note || null,
    tags: payload.tags || (payload.kind === 'snippet' ? ['摘录'] : ['网页']),
    dedupe_key: payload.dedupeKey,
  };
}

export async function importBrowserCapturePayload(
  repository: KnowledgeLibraryRepository,
  payload: unknown,
): Promise<RawMaterial | null> {
  const normalized = normalizeBrowserCapturePayload(payload);
  if (!normalized) return null;
  return repository.upsertRawMaterial(mapBrowserCaptureToRawInput(normalized));
}

export async function importBrowserCaptureBatch(
  repository: KnowledgeLibraryRepository,
  payload: unknown,
): Promise<RawMaterial[]> {
  const batch = payload && typeof payload === 'object' ? (payload as Partial<BrowserCaptureBatchPayload>) : null;
  const items = Array.isArray(batch?.items) ? batch.items : [];
  const imported: RawMaterial[] = [];
  for (const item of items) {
    const next = await importBrowserCapturePayload(repository, item);
    if (next) imported.push(next);
  }
  return imported;
}

declare global {
  interface Window {
    __ICLAW_IMPORT_RAW__?: (payload: BrowserCapturePayload | BrowserCaptureBatchPayload) => Promise<RawMaterial | RawMaterial[] | null>;
  }
}
