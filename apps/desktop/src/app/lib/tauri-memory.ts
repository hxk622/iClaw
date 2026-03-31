import { invoke } from '@tauri-apps/api/core';

const MEMORY_DEV_ENDPOINT = '/__iclaw/memory';

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

export interface MemorySnapshot {
  entries: MemoryEntryRecord[];
  runtimeStatus?: MemoryRuntimeStatus | null;
  runtimeError?: string | null;
  memoryDir: string;
  archiveDir: string;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function loadMemorySnapshot(): Promise<MemorySnapshot | null> {
  if (!isTauriRuntime()) {
    try {
      const response = await fetch(MEMORY_DEV_ENDPOINT, {
        method: 'GET',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as MemorySnapshot;
    } catch {
      return null;
    }
  }
  return invoke<MemorySnapshot>('load_memory_snapshot');
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
