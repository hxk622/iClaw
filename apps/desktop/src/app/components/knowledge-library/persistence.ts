import { readCacheJson, writeCacheJson } from '@/app/lib/persistence/cache-store';
import { buildStorageKey } from '@/app/lib/storage';
import type { KnowledgeLibraryTab } from './model';

const KNOWLEDGE_LIBRARY_STATE_KEY = buildStorageKey('knowledge-library.state.v1');
const LEGACY_THOUGHT_LIBRARY_STATE_KEY = buildStorageKey('thought-library.state.v1');

type KnowledgeLibraryPersistedState = {
  activeTab?: unknown;
  selectedByTab?: unknown;
};

export type KnowledgeLibrarySelectionState = Record<KnowledgeLibraryTab, string | null>;

function normalizeTab(value: unknown): KnowledgeLibraryTab {
  return value === 'graph' || value === 'artifacts' ? value : 'materials';
}

function normalizeSelectedByTab(value: unknown): KnowledgeLibrarySelectionState {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const normalize = (entry: unknown) => (typeof entry === 'string' && entry.trim() ? entry.trim() : null);
  return {
    materials: normalize(raw.materials),
    graph: normalize(raw.graph),
    artifacts: normalize(raw.artifacts),
  };
}

export function readKnowledgeLibraryState(): {
  activeTab: KnowledgeLibraryTab;
  selectedByTab: KnowledgeLibrarySelectionState;
} {
  const snapshot =
    readCacheJson<KnowledgeLibraryPersistedState>(KNOWLEDGE_LIBRARY_STATE_KEY) ||
    readCacheJson<KnowledgeLibraryPersistedState>(LEGACY_THOUGHT_LIBRARY_STATE_KEY);
  return {
    activeTab: normalizeTab(snapshot?.activeTab),
    selectedByTab: normalizeSelectedByTab(snapshot?.selectedByTab),
  };
}

export function writeKnowledgeLibraryState(input: {
  activeTab: KnowledgeLibraryTab;
  selectedByTab: KnowledgeLibrarySelectionState;
}): void {
  writeCacheJson(KNOWLEDGE_LIBRARY_STATE_KEY, input);
}
