import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KnowledgeLibraryRepository } from './repository';
import type { CreateRawMaterialInput, RawMaterial } from './types';
import type { OntologyDocument } from './ontology-types';
import type { OutputArtifact } from './output-types';

export function useRawMaterials(input: {
  repository: KnowledgeLibraryRepository;
  query: string;
  sourceKinds?: string[];
  refreshKey?: number;
}) {
  const { repository, query, sourceKinds, refreshKey = 0 } = input;
  const [items, setItems] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextItems = await repository.listRawMaterials({ query, sourceKinds });
      setItems(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed_to_load_raw_materials');
    } finally {
      setLoading(false);
    }
  }, [query, repository, sourceKinds]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  return {
    items,
    loading,
    error,
    refresh,
  };
}

export function useRawMaterialDetail(input: {
  repository: KnowledgeLibraryRepository;
  rawMaterialId: string | null;
  refreshKey?: number;
}) {
  const { repository, rawMaterialId, refreshKey = 0 } = input;
  const [item, setItem] = useState<RawMaterial | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!rawMaterialId) {
      setItem(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    void repository
      .getRawMaterialById(rawMaterialId)
      .then((next) => {
        if (!cancelled) setItem(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'failed_to_load_raw_material');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rawMaterialId, refreshKey, repository]);

  return { item, loading, error };
}

export function useCreateRawMaterial(repository: KnowledgeLibraryRepository) {
  return useMemo(
    () => ({
      create: async (input: CreateRawMaterialInput) => repository.createRawMaterial(input),
      upsert: async (input: CreateRawMaterialInput) => repository.upsertRawMaterial(input),
    }),
    [repository],
  );
}

export function useOntologyDocuments(input: {
  repository: KnowledgeLibraryRepository;
  query: string;
  refreshKey?: number;
}) {
  const { repository, query, refreshKey = 0 } = input;
  const [items, setItems] = useState<OntologyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextItems = await repository.listOntologyDocuments({ query });
      setItems(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed_to_load_ontology_documents');
    } finally {
      setLoading(false);
    }
  }, [query, repository]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  return { items, loading, error, refresh };
}

export function useOntologyDocumentDetail(input: {
  repository: KnowledgeLibraryRepository;
  ontologyDocumentId: string | null;
  refreshKey?: number;
}) {
  const { repository, ontologyDocumentId, refreshKey = 0 } = input;
  const [item, setItem] = useState<OntologyDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!ontologyDocumentId) {
      setItem(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    void repository
      .getOntologyDocumentById(ontologyDocumentId)
      .then((next) => {
        if (!cancelled) setItem(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'failed_to_load_ontology_document');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ontologyDocumentId, refreshKey, repository]);

  return { item, loading, error };
}

export function useOntologyRevisions(input: {
  repository: KnowledgeLibraryRepository;
  graphIdentity: string | null;
  refreshKey?: number;
}) {
  const { repository, graphIdentity, refreshKey = 0 } = input;
  const [items, setItems] = useState<OntologyDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!graphIdentity) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    void repository
      .listOntologyRevisionsByIdentity(graphIdentity)
      .then((next) => {
        if (!cancelled) {
          setItems(next);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'failed_to_load_ontology_revisions');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [graphIdentity, refreshKey, repository]);

  return { items, loading, error };
}

export function useOutputArtifacts(input: {
  repository: KnowledgeLibraryRepository;
  query: string;
  refreshKey?: number;
}) {
  const { repository, query, refreshKey = 0 } = input;
  const [items, setItems] = useState<OutputArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextItems = await repository.listOutputArtifacts({ query });
      setItems(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed_to_load_output_artifacts');
    } finally {
      setLoading(false);
    }
  }, [query, repository]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  return { items, loading, error, refresh };
}

export function useOutputArtifactDetail(input: {
  repository: KnowledgeLibraryRepository;
  outputArtifactId: string | null;
  refreshKey?: number;
}) {
  const { repository, outputArtifactId, refreshKey = 0 } = input;
  const [item, setItem] = useState<OutputArtifact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!outputArtifactId) {
      setItem(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    void repository
      .getOutputArtifactById(outputArtifactId)
      .then((next) => {
        if (!cancelled) setItem(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'failed_to_load_output_artifact');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [outputArtifactId, refreshKey, repository]);

  return { item, loading, error };
}
