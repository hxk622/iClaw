import { readCacheJson, writeCacheJson } from '@/app/lib/persistence/cache-store';
import { buildStorageKey } from '@/app/lib/storage';
import type { ThoughtLibraryTab } from './model';

const KNOWLEDGE_LIBRARY_STATE_KEY = buildStorageKey('knowledge-library.state.v1');
const LEGACY_THOUGHT_LIBRARY_STATE_KEY = buildStorageKey('thought-library.state.v1');

type ThoughtLibraryPersistedState = {
  activeTab?: unknown;
  selectedByTab?: unknown;
};

export type ThoughtLibrarySelectionState = Record<ThoughtLibraryTab, string | null>;

function normalizeTab(value: unknown): ThoughtLibraryTab {
  return value === 'graph' || value === 'artifacts' ? value : 'materials';
}

function normalizeSelectedByTab(value: unknown): ThoughtLibrarySelectionState {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const normalize = (entry: unknown) => (typeof entry === 'string' && entry.trim() ? entry.trim() : null);
  return {
    materials: normalize(raw.materials),
    graph: normalize(raw.graph),
    artifacts: normalize(raw.artifacts),
  };
}

export function readThoughtLibraryState(): {
  activeTab: ThoughtLibraryTab;
  selectedByTab: ThoughtLibrarySelectionState;
} {
  const snapshot =
    readCacheJson<ThoughtLibraryPersistedState>(KNOWLEDGE_LIBRARY_STATE_KEY) ||
    readCacheJson<ThoughtLibraryPersistedState>(LEGACY_THOUGHT_LIBRARY_STATE_KEY);
  return {
    activeTab: normalizeTab(snapshot?.activeTab),
    selectedByTab: normalizeSelectedByTab(snapshot?.selectedByTab),
  };
}

export function writeThoughtLibraryState(input: {
  activeTab: ThoughtLibraryTab;
  selectedByTab: ThoughtLibrarySelectionState;
}): void {
  writeCacheJson(KNOWLEDGE_LIBRARY_STATE_KEY, input);
}
