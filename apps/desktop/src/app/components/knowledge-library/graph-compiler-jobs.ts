import { useEffect, useState } from 'react';
import { readCacheJson, writeCacheJson } from '../../lib/persistence/cache-store.ts';
import { buildStorageKey } from '../../lib/storage.ts';

export type GraphCompilerJobStatus = 'running' | 'succeeded' | 'fallback' | 'failed';
export type GraphCompilerJobTrigger = 'raw_ingest' | 'output_feedback';
export type GraphCompilerJobBackend = 'local-fallback' | 'graphify-v3';

export interface GraphCompilerJobRecord {
  id: string;
  trigger: GraphCompilerJobTrigger;
  status: GraphCompilerJobStatus;
  backend: GraphCompilerJobBackend;
  startedAt: string;
  finishedAt: string | null;
  sourceRawIds: string[];
  sourceOutputIds: string[];
  ontologyDocumentIds: string[];
  error: string | null;
}

type GraphCompilerJobStore = {
  version: 1;
  updatedAt: string;
  items: GraphCompilerJobRecord[];
};

const GRAPH_COMPILER_JOBS_STORAGE_KEY = buildStorageKey('knowledge-library.graph-compiler-jobs.v1');
const GRAPH_COMPILER_JOBS_UPDATED_EVENT = 'iclaw:knowledge-library:graph-compiler-jobs:updated';
const MAX_GRAPH_COMPILER_JOBS = 120;

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `graph_job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeText(value: unknown, maxLength = 160): string {
  if (typeof value !== 'string') {
    return '';
  }
  const compact = value.trim();
  return compact.length > maxLength ? `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : compact;
}

function normalizeStringArray(value: unknown, maxLength = 160): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry, maxLength)).filter(Boolean)));
}

function parseStore(raw: unknown): GraphCompilerJobStore {
  if (!raw || typeof raw !== 'object') {
    return {
      version: 1,
      updatedAt: nowIso(),
      items: [],
    };
  }
  const candidate = raw as Partial<GraphCompilerJobStore>;
  const items = Array.isArray(candidate.items) ? candidate.items : [];
  return {
    version: 1,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : nowIso(),
    items: items
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const rawItem = item as Partial<GraphCompilerJobRecord>;
        return {
          id: normalizeText(rawItem.id, 120) || createId(),
          trigger: rawItem.trigger === 'output_feedback' ? 'output_feedback' : 'raw_ingest',
          status:
            rawItem.status === 'succeeded' ||
            rawItem.status === 'fallback' ||
            rawItem.status === 'failed'
              ? rawItem.status
              : 'running',
          backend: rawItem.backend === 'graphify-v3' ? 'graphify-v3' : 'local-fallback',
          startedAt: typeof rawItem.startedAt === 'string' ? rawItem.startedAt : nowIso(),
          finishedAt: typeof rawItem.finishedAt === 'string' ? rawItem.finishedAt : null,
          sourceRawIds: normalizeStringArray(rawItem.sourceRawIds, 120),
          sourceOutputIds: normalizeStringArray(rawItem.sourceOutputIds, 120),
          ontologyDocumentIds: normalizeStringArray(rawItem.ontologyDocumentIds, 120),
          error: normalizeText(rawItem.error, 400) || null,
        } satisfies GraphCompilerJobRecord;
      })
      .sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt)))
      .slice(0, MAX_GRAPH_COMPILER_JOBS),
  };
}

function readStore(): GraphCompilerJobStore {
  return parseStore(readCacheJson<GraphCompilerJobStore>(GRAPH_COMPILER_JOBS_STORAGE_KEY));
}

function emitJobsUpdated(): void {
  if (
    typeof window === 'undefined' ||
    typeof window.dispatchEvent !== 'function'
  ) {
    return;
  }
  window.dispatchEvent(new CustomEvent(GRAPH_COMPILER_JOBS_UPDATED_EVENT));
}

function writeStore(store: GraphCompilerJobStore): void {
  writeCacheJson(GRAPH_COMPILER_JOBS_STORAGE_KEY, store);
  emitJobsUpdated();
}

function updateStore(updater: (items: GraphCompilerJobRecord[]) => GraphCompilerJobRecord[]): GraphCompilerJobRecord[] {
  const current = readStore();
  const nextItems = updater(current.items)
    .sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt)))
    .slice(0, MAX_GRAPH_COMPILER_JOBS);
  writeStore({
    version: 1,
    updatedAt: nowIso(),
    items: nextItems,
  });
  return nextItems;
}

export function startGraphCompilerJob(input: {
  trigger: GraphCompilerJobTrigger;
  backend: GraphCompilerJobBackend;
  sourceRawIds?: string[];
  sourceOutputIds?: string[];
}): GraphCompilerJobRecord {
  const record: GraphCompilerJobRecord = {
    id: createId(),
    trigger: input.trigger,
    status: 'running',
    backend: input.backend,
    startedAt: nowIso(),
    finishedAt: null,
    sourceRawIds: normalizeStringArray(input.sourceRawIds, 120),
    sourceOutputIds: normalizeStringArray(input.sourceOutputIds, 120),
    ontologyDocumentIds: [],
    error: null,
  };
  updateStore((items) => [record, ...items.filter((item) => item.id !== record.id)]);
  return record;
}

export function finishGraphCompilerJob(
  jobId: string,
  input: {
    status: GraphCompilerJobStatus;
    backend: GraphCompilerJobBackend;
    ontologyDocumentIds?: string[];
    error?: string | null;
  },
): void {
  updateStore((items) =>
    items.map((item) =>
      item.id === jobId
        ? {
            ...item,
            status: input.status,
            backend: input.backend,
            finishedAt: nowIso(),
            ontologyDocumentIds: normalizeStringArray(input.ontologyDocumentIds, 120),
            error: normalizeText(input.error, 400) || null,
          }
        : item,
    ),
  );
}

export function readGraphCompilerJobs(): GraphCompilerJobRecord[] {
  return readStore().items;
}

export function useGraphCompilerJobs(refreshKey = 0): GraphCompilerJobRecord[] {
  const [items, setItems] = useState<GraphCompilerJobRecord[]>(() => readGraphCompilerJobs());

  useEffect(() => {
    setItems(readGraphCompilerJobs());
  }, [refreshKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }
    const listener = () => {
      setItems(readGraphCompilerJobs());
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === GRAPH_COMPILER_JOBS_STORAGE_KEY || event.key === null) {
        listener();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(GRAPH_COMPILER_JOBS_UPDATED_EVENT, listener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(GRAPH_COMPILER_JOBS_UPDATED_EVENT, listener);
    };
  }, []);

  return items;
}
