import {
  createRawMaterial,
  deleteRawMaterial,
  getRawMaterialById,
  listRawMaterials,
  upsertRawMaterial,
} from './raw-storage';
import type { CreateRawMaterialInput, RawMaterial } from './types';

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
  };
}
