import { useEffect, useState } from 'react';
import { readCacheJson, writeCacheJson } from '../../lib/persistence/cache-store.ts';
import { buildStorageKey } from '../../lib/storage.ts';

export interface GraphReasoningSessionState {
  graphIdentity: string;
  ontologyRevisionId: string;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  pathTargetNodeId: string | null;
  pathResult: string | null;
  graphQueryText: string;
  graphQueryUseDfs: boolean;
  graphQueryResult: string | null;
  autoGraphQueryEnabled: boolean;
  updatedAt: string;
}

type GraphReasoningSessionStore = {
  version: 1;
  updatedAt: string;
  sessions: Record<string, GraphReasoningSessionState>;
};

const GRAPH_REASONING_SESSION_STORAGE_KEY = buildStorageKey('knowledge-library.graph-reasoning-session.v1');
const GRAPH_REASONING_SESSION_UPDATED_EVENT = 'iclaw:knowledge-library:graph-reasoning-session:updated';

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeOptionalText(value: unknown, maxLength = 240): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const compact = value.trim();
  if (!compact) {
    return null;
  }
  return compact.length > maxLength ? `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : compact;
}

function parseStore(raw: unknown): GraphReasoningSessionStore {
  if (!raw || typeof raw !== 'object') {
    return {
      version: 1,
      updatedAt: nowIso(),
      sessions: {},
    };
  }
  const candidate = raw as Partial<GraphReasoningSessionStore>;
  const sessions = candidate.sessions && typeof candidate.sessions === 'object' ? candidate.sessions : {};
  return {
    version: 1,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : nowIso(),
    sessions: Object.fromEntries(
      Object.entries(sessions)
        .filter(([key]) => Boolean(key))
        .map(([key, value]) => {
          const rawSession = (value || {}) as Partial<GraphReasoningSessionState>;
          return [
            key,
            {
              graphIdentity: normalizeOptionalText(rawSession.graphIdentity, 240) || key,
              ontologyRevisionId: normalizeOptionalText(rawSession.ontologyRevisionId, 320) || '',
              selectedNodeId: normalizeOptionalText(rawSession.selectedNodeId, 320),
              selectedEdgeId: normalizeOptionalText(rawSession.selectedEdgeId, 320),
              pathTargetNodeId: normalizeOptionalText(rawSession.pathTargetNodeId, 320),
              pathResult: normalizeOptionalText(rawSession.pathResult, 4000),
              graphQueryText: normalizeOptionalText(rawSession.graphQueryText, 1200) || '',
              graphQueryUseDfs: rawSession.graphQueryUseDfs === true,
              graphQueryResult: normalizeOptionalText(rawSession.graphQueryResult, 6000),
              autoGraphQueryEnabled: rawSession.autoGraphQueryEnabled !== false,
              updatedAt: typeof rawSession.updatedAt === 'string' ? rawSession.updatedAt : nowIso(),
            } satisfies GraphReasoningSessionState,
          ];
        }),
    ),
  };
}

function readStore(): GraphReasoningSessionStore {
  return parseStore(readCacheJson<GraphReasoningSessionStore>(GRAPH_REASONING_SESSION_STORAGE_KEY));
}

function writeStore(store: GraphReasoningSessionStore): void {
  writeCacheJson(GRAPH_REASONING_SESSION_STORAGE_KEY, store);
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(GRAPH_REASONING_SESSION_UPDATED_EVENT));
  }
}

export function readGraphReasoningSession(graphIdentity: string | null | undefined): GraphReasoningSessionState | null {
  const key = normalizeOptionalText(graphIdentity, 240);
  if (!key) {
    return null;
  }
  return readStore().sessions[key] || null;
}

export function writeGraphReasoningSession(
  input: Omit<GraphReasoningSessionState, 'updatedAt'>,
): GraphReasoningSessionState {
  const graphIdentity = normalizeOptionalText(input.graphIdentity, 240);
  if (!graphIdentity) {
    throw new Error('graphIdentity is required');
  }
  const store = readStore();
  const next: GraphReasoningSessionState = {
    ...input,
    graphIdentity,
    updatedAt: nowIso(),
  };
  writeStore({
    version: 1,
    updatedAt: next.updatedAt,
    sessions: {
      ...store.sessions,
      [graphIdentity]: next,
    },
  });
  return next;
}

export function useGraphReasoningSession(graphIdentity: string | null | undefined): GraphReasoningSessionState | null {
  const [session, setSession] = useState<GraphReasoningSessionState | null>(() => readGraphReasoningSession(graphIdentity));

  useEffect(() => {
    setSession(readGraphReasoningSession(graphIdentity));
  }, [graphIdentity]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }
    const listener = () => {
      setSession(readGraphReasoningSession(graphIdentity));
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === GRAPH_REASONING_SESSION_STORAGE_KEY || event.key === null) {
        listener();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(GRAPH_REASONING_SESSION_UPDATED_EVENT, listener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(GRAPH_REASONING_SESSION_UPDATED_EVENT, listener);
    };
  }, [graphIdentity]);

  return session;
}
