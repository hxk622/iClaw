import type { OntologyDocument } from './ontology-types.ts';

function normalizeText(value: string | null | undefined, maxLength = 240): string {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function compactTimestamp(iso: string): string {
  return normalizeText(iso, 32).replace(/[-:TZ.]/g, '').slice(0, 14) || '00000000000000';
}

export function getOntologyGraphIdentity(document: OntologyDocument): string {
  return (
    document.metadata?.graph_identity ||
    document.metadata?.revision_id ||
    document.id
  );
}

export function getOntologyRevisionId(document: OntologyDocument): string {
  return document.metadata?.revision_id || document.id;
}

export function buildOntologySourceSignature(input: {
  graphIdentity: string;
  sourceRawIds?: string[];
  sourceOutputIds?: string[];
  compilerBackend?: string | null;
  compilerVersion?: string | null;
  generatedFrom?: string | null;
}): string {
  return fnv1a(
    JSON.stringify({
      graphIdentity: normalizeText(input.graphIdentity, 240),
      sourceRawIds: (input.sourceRawIds || []).slice().sort(),
      sourceOutputIds: (input.sourceOutputIds || []).slice().sort(),
      compilerBackend: normalizeText(input.compilerBackend || '', 80),
      compilerVersion: normalizeText(input.compilerVersion || '', 80),
      generatedFrom: normalizeText(input.generatedFrom || '', 80),
    }),
  );
}

export function buildOntologyRevisionId(input: {
  graphIdentity: string;
  compiledAt: string;
  sourceSignature: string;
}): string {
  return `${normalizeText(input.graphIdentity, 240)}::rev::${compactTimestamp(input.compiledAt)}::${input.sourceSignature}`;
}

export function withOntologyRevisionMetadata(document: OntologyDocument): OntologyDocument {
  const graphIdentity = document.metadata?.graph_identity || document.id;
  const compiledAt = document.metadata?.compiled_at || document.updated_at || document.created_at;
  const sourceSignature =
    document.metadata?.source_signature ||
    buildOntologySourceSignature({
      graphIdentity,
      sourceRawIds: document.source_raw_ids,
      sourceOutputIds: document.metadata?.source_output_artifact_ids || [],
      compilerBackend: document.metadata?.compiler_backend || null,
      compilerVersion: document.metadata?.compiler_version || null,
      generatedFrom: document.metadata?.generated_from || null,
    });
  const revisionId = document.metadata?.revision_id || buildOntologyRevisionId({
    graphIdentity,
    compiledAt,
    sourceSignature,
  });

  return {
    ...document,
    id: revisionId,
    metadata: {
      ...(document.metadata || null),
      graph_identity: graphIdentity,
      revision_id: revisionId,
      compiled_at: compiledAt,
      source_signature: sourceSignature,
    },
  };
}
