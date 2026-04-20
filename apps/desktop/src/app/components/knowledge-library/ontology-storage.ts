import { readCacheJson, writeCacheJson } from '../../lib/persistence/cache-store.ts';
import { buildStorageKey } from '../../lib/storage.ts';
import type { OntologyDocument } from './ontology-types.ts';
import {
  getOntologyGraphIdentity,
  getOntologyRevisionId,
  withOntologyRevisionMetadata,
} from './ontology-revisions.ts';

const ONTOLOGY_STORAGE_KEY = buildStorageKey('knowledge-library.ontology.v1');

type OntologyStore = {
  version: 1;
  updated_at: string;
  items: OntologyDocument[];
  latest_by_identity?: Record<string, string>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseStore(raw: unknown): OntologyStore {
  if (!raw || typeof raw !== 'object') {
    return { version: 1, updated_at: nowIso(), items: [] };
  }
  const candidate = raw as Partial<OntologyStore>;
  const items = Array.isArray(candidate.items) ? candidate.items : [];
  return {
    version: 1,
    updated_at: typeof candidate.updated_at === 'string' ? candidate.updated_at : nowIso(),
    items: items
      .filter((item) => item && typeof item === 'object')
      .map((item) => withOntologyRevisionMetadata(item as OntologyDocument))
      .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || ''))),
    latest_by_identity:
      candidate.latest_by_identity && typeof candidate.latest_by_identity === 'object'
        ? Object.fromEntries(
            Object.entries(candidate.latest_by_identity).filter(
              ([key, value]) => Boolean(key) && typeof value === 'string' && value.trim(),
            ),
          )
        : undefined,
  };
}

function readStore(): OntologyStore {
  return parseStore(readCacheJson<OntologyStore>(ONTOLOGY_STORAGE_KEY));
}

function writeStore(store: OntologyStore): void {
  writeCacheJson(ONTOLOGY_STORAGE_KEY, store);
}

export function listOntologyDocuments(): OntologyDocument[] {
  const store = readStore();
  const latestByIdentity = store.latest_by_identity || {};
  const seen = new Set<string>();
  const results: OntologyDocument[] = [];
  store.items.forEach((item) => {
    const identity = getOntologyGraphIdentity(item);
    const latestRevisionId = latestByIdentity[identity] || getOntologyRevisionId(item);
    if (seen.has(identity) || getOntologyRevisionId(item) !== latestRevisionId) {
      return;
    }
    seen.add(identity);
    results.push(item);
  });
  return results;
}

export function getOntologyDocumentById(id: string): OntologyDocument | null {
  const store = readStore();
  const exact = store.items.find((item) => item.id === id) || null;
  if (exact) {
    return exact;
  }
  const latestRevisionId = store.latest_by_identity?.[id] || null;
  if (latestRevisionId) {
    return store.items.find((item) => item.id === latestRevisionId) || null;
  }
  return store.items.find((item) => getOntologyGraphIdentity(item) === id) || null;
}

export function listOntologyRevisionsByIdentity(graphIdentity: string): OntologyDocument[] {
  const safeIdentity = String(graphIdentity || '').trim();
  if (!safeIdentity) {
    return [];
  }
  return readStore().items
    .filter((item) => getOntologyGraphIdentity(item) === safeIdentity)
    .sort((left, right) =>
      String(right.metadata?.compiled_at || right.updated_at || '').localeCompare(
        String(left.metadata?.compiled_at || left.updated_at || ''),
      ),
    );
}

export function upsertOntologyDocument(document: OntologyDocument): OntologyDocument {
  const store = readStore();
  const next: OntologyDocument = withOntologyRevisionMetadata({
    ...document,
    updated_at: nowIso(),
  });
  const items = [next, ...store.items.filter((item) => item.id !== next.id)].sort((left, right) =>
    String(right.updated_at || '').localeCompare(String(left.updated_at || '')),
  );
  const latestByIdentity = {
    ...(store.latest_by_identity || {}),
    [getOntologyGraphIdentity(next)]: getOntologyRevisionId(next),
  };
  writeStore({ version: 1, updated_at: next.updated_at, items, latest_by_identity: latestByIdentity });
  return next;
}
