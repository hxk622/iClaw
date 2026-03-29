import { invoke } from '@tauri-apps/api/core';

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
  if (!isTauriRuntime()) return null;
  return invoke<MemorySnapshot>('load_memory_snapshot');
}

export async function saveMemoryEntry(entry: MemoryEntryRecord): Promise<MemoryEntryRecord | null> {
  if (!isTauriRuntime()) return null;
  return invoke<MemoryEntryRecord>('save_memory_entry', { entry });
}

export async function deleteMemoryEntry(id: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('delete_memory_entry', { id });
}

export async function archiveMemoryEntry(id: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('archive_memory_entry', { id });
}

export async function reindexMemory(force = false): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('reindex_memory', { force });
}
