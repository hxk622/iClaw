import { upsertOntologyDocument } from './ontology-storage.ts';
import { compileRawToOntology } from './ontology-pipeline.ts';
import { buildOntologyDocumentsFromOutputArtifacts } from './output-ontology-pipeline.ts';
import type { OntologyDocument } from './ontology-types.ts';
import type { OutputArtifact } from './output-types.ts';
import type { RawMaterial } from './types.ts';

export type GraphCompilerBackend = 'local-fallback' | 'graphify-v3';
export type GraphCompilerTrigger = 'raw_ingest' | 'output_feedback';

export interface GraphCompilerJobInput {
  trigger: GraphCompilerTrigger;
  rawMaterials?: RawMaterial[];
  outputArtifacts?: OutputArtifact[];
}

export interface GraphCompilerJobResult {
  backend: GraphCompilerBackend;
  trigger: GraphCompilerTrigger;
  documents: OntologyDocument[];
}

export async function runLocalGraphCompilerJob(input: GraphCompilerJobInput): Promise<GraphCompilerJobResult> {
  const rawMaterials = Array.isArray(input.rawMaterials) ? input.rawMaterials : [];
  const outputArtifacts = Array.isArray(input.outputArtifacts) ? input.outputArtifacts : [];
  const rawDocuments = rawMaterials.length > 0 ? compileRawToOntology({ rawMaterials }).documents : [];
  const outputDocuments = outputArtifacts.length > 0 ? buildOntologyDocumentsFromOutputArtifacts(outputArtifacts) : [];
  return {
    backend: 'local-fallback',
    trigger: input.trigger,
    documents: [...rawDocuments, ...outputDocuments],
  };
}

export async function syncRawMaterialsIntoOntology(rawMaterials: RawMaterial[]): Promise<OntologyDocument[]> {
  const result = await runLocalGraphCompilerJob({
    trigger: 'raw_ingest',
    rawMaterials,
  });
  return result.documents.map((document) => upsertOntologyDocument(document));
}

export async function syncOutputArtifactsIntoOntology(outputArtifacts: OutputArtifact[]): Promise<OntologyDocument[]> {
  const result = await runLocalGraphCompilerJob({
    trigger: 'output_feedback',
    outputArtifacts,
  });
  return result.documents.map((document) => upsertOntologyDocument(document));
}
