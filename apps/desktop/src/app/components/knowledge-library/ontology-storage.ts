import { readCacheJson, writeCacheJson } from '../../lib/persistence/cache-store.ts';
import { buildStorageKey } from '../../lib/storage.ts';
import type { OntologyDocument } from './ontology-types.ts';

const ONTOLOGY_STORAGE_KEY = buildStorageKey('knowledge-library.ontology.v1');

type OntologyStore = {
  version: 1;
  updated_at: string;
  items: OntologyDocument[];
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
      .map((item) => item as OntologyDocument)
      .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || ''))),
  };
}

function readStore(): OntologyStore {
  return parseStore(readCacheJson<OntologyStore>(ONTOLOGY_STORAGE_KEY));
}

function writeStore(store: OntologyStore): void {
  writeCacheJson(ONTOLOGY_STORAGE_KEY, store);
}

export function listOntologyDocuments(): OntologyDocument[] {
  return readStore().items;
}

export function getOntologyDocumentById(id: string): OntologyDocument | null {
  return readStore().items.find((item) => item.id === id) || null;
}

export function upsertOntologyDocument(document: OntologyDocument): OntologyDocument {
  const store = readStore();
  const next: OntologyDocument = {
    ...document,
    updated_at: nowIso(),
  };
  const items = [next, ...store.items.filter((item) => item.id !== next.id)].sort((left, right) =>
    String(right.updated_at || '').localeCompare(String(left.updated_at || '')),
  );
  writeStore({ version: 1, updated_at: next.updated_at, items });
  return next;
}
