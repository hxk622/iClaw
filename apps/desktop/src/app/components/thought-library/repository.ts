import {
  createRawMaterial,
  deleteRawMaterial,
  getRawMaterialById,
  listRawMaterials,
  upsertRawMaterial,
} from './raw-storage';
import type { CreateRawMaterialInput, RawMaterial } from './types';
import { compileRawToOntology } from './ontology-pipeline';
import { getOntologyDocumentById, listOntologyDocuments, upsertOntologyDocument } from './ontology-storage';
import type { OntologyDocument } from './ontology-types';

export interface KnowledgeLibraryRepository {
  listRawMaterials(input?: {
    query?: string;
    sourceKinds?: string[];
    limit?: number;
  }): Promise<RawMaterial[]>;
  getRawMaterialById(id: string): Promise<RawMaterial | null>;
  createRawMaterial(input: CreateRawMaterialInput): Promise<RawMaterial>;
  upsertRawMaterial(input: CreateRawMaterialInput): Promise<RawMaterial>;
  deleteRawMaterial(id: string): Promise<void>;
  listOntologyDocuments(input?: {
    query?: string;
    limit?: number;
  }): Promise<OntologyDocument[]>;
  getOntologyDocumentById(id: string): Promise<OntologyDocument | null>;
  compileRawMaterialsToOntology(rawMaterials: RawMaterial[]): Promise<OntologyDocument[]>;
}

function filterRawMaterials(items: RawMaterial[], input?: { query?: string; sourceKinds?: string[]; limit?: number }): RawMaterial[] {
  const normalizedQuery = input?.query?.trim().toLowerCase() || '';
  const kinds = Array.isArray(input?.sourceKinds)
    ? new Set(input?.sourceKinds.map((entry) => String(entry || '').trim()).filter(Boolean))
    : null;
  const filtered = items.filter((item) => {
    if (kinds && !kinds.has(item.kind)) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return [item.title, item.excerpt, item.content_text, item.source_name, ...(item.tags || [])]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });
  if (typeof input?.limit === 'number' && Number.isFinite(input.limit) && input.limit > 0) {
    return filtered.slice(0, Math.floor(input.limit));
  }
  return filtered;
}

export function createLocalKnowledgeLibraryRepository(): KnowledgeLibraryRepository {
  return {
    async listRawMaterials(input) {
      return filterRawMaterials(listRawMaterials(), input);
    },
    async getRawMaterialById(id) {
      return getRawMaterialById(id);
    },
    async createRawMaterial(input) {
      return createRawMaterial(input);
    },
    async upsertRawMaterial(input) {
      return upsertRawMaterial(input);
    },
    async deleteRawMaterial(id) {
      deleteRawMaterial(id);
    },
    async listOntologyDocuments(input) {
      const normalizedQuery = input?.query?.trim().toLowerCase() || '';
      const items = listOntologyDocuments().filter((item) => {
        if (!normalizedQuery) return true;
        return [item.title, item.summary, ...item.nodes.map((node) => node.label)]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      });
      if (typeof input?.limit === 'number' && Number.isFinite(input.limit) && input.limit > 0) {
        return items.slice(0, Math.floor(input.limit));
      }
      return items;
    },
    async getOntologyDocumentById(id) {
      return getOntologyDocumentById(id);
    },
    async compileRawMaterialsToOntology(rawMaterials) {
      const compiled = compileRawToOntology({ rawMaterials });
      return compiled.documents.map((document) => upsertOntologyDocument(document));
    },
  };
}
