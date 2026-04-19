import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './desktop-runtime';

const MEMORY_DEV_ENDPOINT = '/__iclaw/memory';
const MEMORY_SNAPSHOT_TIMEOUT_MS = 8000;

export interface MemoryEntryRecord {
  id: string;
  title: string;
  summary: string;
  content: string;
  domain: string;
  type: string;
  importance: string;
  sourceType: string;
  sourceLabel: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastRecalledAt: string | null;
  recallCount: number;
  captureConfidence: number;
  indexHealth: string;
  status: string;
  active: boolean;
}

export interface MemoryRuntimeStatus {
  backend?: string | null;
  files: number;
  chunks: number;
  dirty: boolean;
  workspaceDir?: string | null;
  memoryDir: string;
  dbPath?: string | null;
  provider?: string | null;
  model?: string | null;
  sourceCounts: Array<Record<string, unknown>>;
  scanTotalFiles?: number | null;
  scanIssues: string[];
  ftsAvailable?: boolean | null;
  ftsError?: string | null;
  vectorAvailable?: boolean | null;
  vectorError?: string | null;
  embeddingConfigured: boolean;
  configuredScope?: string | null;
  configuredProvider?: string | null;
  configuredModel?: string | null;
}

export interface MemoryEntriesSnapshot {
  entries: MemoryEntryRecord[];
  memoryDir: string;
  archiveDir: string;
}

export interface MemorySnapshot extends MemoryEntriesSnapshot {
  runtimeStatus?: MemoryRuntimeStatus | null;
  runtimeError?: string | null;
}

export interface MemoryRuntimeStatusSnapshot {
  runtimeStatus?: MemoryRuntimeStatus | null;
  runtimeError?: string | null;
  memoryDir: string;
  archiveDir: string;
  cachedAt?: number | null;
  stale?: boolean;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function loadMemorySnapshot(): Promise<MemorySnapshot | null> {
  if (!isTauriRuntime()) {
    try {
      const response = await withTimeout(
        fetch(`${MEMORY_DEV_ENDPOINT}?view=entries`, {
          method: 'GET',
          credentials: 'same-origin',
        }),
        MEMORY_SNAPSHOT_TIMEOUT_MS,
        'memory snapshot request timed out',
      );
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as MemorySnapshot;
    } catch {
      return null;
    }
  }
  return withTimeout(
    invoke<MemorySnapshot>('load_memory_entries_snapshot'),
    MEMORY_SNAPSHOT_TIMEOUT_MS,
    'memory snapshot request timed out',
  );
}

export async function loadMemoryRuntimeStatus(force = false): Promise<MemoryRuntimeStatusSnapshot | null> {
  if (!isTauriRuntime()) {
    try {
      const response = await withTimeout(
        fetch(`${MEMORY_DEV_ENDPOINT}?view=status${force ? '&force=1' : ''}`, {
          method: 'GET',
          credentials: 'same-origin',
        }),
        MEMORY_SNAPSHOT_TIMEOUT_MS,
        'memory runtime status request timed out',
      );
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as MemoryRuntimeStatusSnapshot;
    } catch {
      return null;
    }
  }
  return withTimeout(
    invoke<MemoryRuntimeStatusSnapshot>('load_memory_runtime_status_snapshot', { force }),
    MEMORY_SNAPSHOT_TIMEOUT_MS,
    'memory runtime status request timed out',
  );
}

export async function saveMemoryEntry(entry: MemoryEntryRecord): Promise<MemoryEntryRecord | null> {
  if (!isTauriRuntime()) {
    const response = await fetch(MEMORY_DEV_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'save',
        entry,
      }),
    });
    if (!response.ok) {
      throw new Error(`memory save failed: ${response.status}`);
    }
    return (await response.json()) as MemoryEntryRecord;
  }
  return invoke<MemoryEntryRecord>('save_memory_entry', { entry });
}

export async function deleteMemoryEntry(id: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    const response = await fetch(MEMORY_DEV_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'delete',
        id,
      }),
    });
    if (!response.ok) {
      throw new Error(`memory delete failed: ${response.status}`);
    }
    return (await response.json()) as boolean;
  }
  return invoke<boolean>('delete_memory_entry', { id });
}

export async function archiveMemoryEntry(id: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    const response = await fetch(MEMORY_DEV_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'archive',
        id,
      }),
    });
    if (!response.ok) {
      throw new Error(`memory archive failed: ${response.status}`);
    }
    return (await response.json()) as boolean;
  }
  return invoke<boolean>('archive_memory_entry', { id });
}

export async function reindexMemory(force = false): Promise<boolean> {
  if (!isTauriRuntime()) {
    const response = await fetch(MEMORY_DEV_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'reindex',
        force,
      }),
    });
    if (!response.ok) {
      throw new Error(`memory reindex failed: ${response.status}`);
    }
    return (await response.json()) as boolean;
  }
  return invoke<boolean>('reindex_memory', { force });
}
