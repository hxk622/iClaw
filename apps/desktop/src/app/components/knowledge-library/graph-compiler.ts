import { upsertOntologyDocument } from './ontology-storage.ts';
import { compileRawToOntology } from './ontology-pipeline.ts';
import { buildOntologyDocumentsFromOutputArtifacts } from './output-ontology-pipeline.ts';
import { importGraphifyGraphToOntologyDocument } from './graphify-importer.ts';
import type { OntologyDocument } from './ontology-types.ts';
import type { OutputArtifact } from './output-types.ts';
import type { RawMaterial } from './types.ts';
import { runGraphifyCompile, type GraphifyCorpusItem } from '../../lib/tauri-graphify.ts';

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

function normalizeText(value: string | null | undefined, maxLength = 24000): string {
  const compact = String(value || '').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function buildGraphifyCorpusItems(input: GraphCompilerJobInput): GraphifyCorpusItem[] {
  const rawItems = (input.rawMaterials ?? []).map((item) => ({
    id: item.id,
    kind: 'raw' as const,
    title: item.title,
    content: normalizeText(item.content_text || item.excerpt || item.title),
    metadata: {
      source_type: item.source_type,
      source_url: item.source_url,
      tags: item.tags,
    },
  }));
  const outputItems = (input.outputArtifacts ?? []).map((item) => ({
    id: item.id,
    kind: 'output' as const,
    title: item.title,
    content: normalizeText(item.content || item.summary || item.title),
    metadata: item.metadata || null,
  }));
  return [...rawItems, ...outputItems];
}

function applyGraphifyMetadata(
  documents: OntologyDocument[],
  graphifyResult: Awaited<ReturnType<typeof runGraphifyCompile>>,
): OntologyDocument[] {
  if (!graphifyResult || !graphifyResult.available) {
    return documents;
  }
  return documents.map((document) => ({
    ...document,
    metadata: {
      ...(document.metadata || null),
      compiler_backend: 'graphify-v3',
      graphify_corpus_dir: graphifyResult.corpusDir,
      graphify_output_dir: graphifyResult.outputDir,
      graphify_graph_json_path: graphifyResult.graphJsonPath,
      graphify_report_path: graphifyResult.reportPath,
      graphify_html_path: graphifyResult.htmlPath,
    },
  }));
}

function importGraphifyDocuments(
  input: GraphCompilerJobInput,
  graphifyResult: NonNullable<Awaited<ReturnType<typeof runGraphifyCompile>>>,
): OntologyDocument[] {
  if (!graphifyResult.graphJsonText) {
    return [];
  }
  return [
    importGraphifyGraphToOntologyDocument({
      graphJsonText: graphifyResult.graphJsonText,
      trigger: input.trigger,
      rawMaterials: input.rawMaterials,
      outputArtifacts: input.outputArtifacts,
      graphifyMetadata: {
        corpusDir: graphifyResult.corpusDir,
        outputDir: graphifyResult.outputDir,
        graphJsonPath: graphifyResult.graphJsonPath,
        reportPath: graphifyResult.reportPath,
        htmlPath: graphifyResult.htmlPath,
      },
    }),
  ];
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

export async function runGraphCompilerJob(input: GraphCompilerJobInput): Promise<GraphCompilerJobResult> {
  const fallback = await runLocalGraphCompilerJob(input);
  const graphifyResult = await runGraphifyCompile({
    corpusLabel: input.trigger,
    items: buildGraphifyCorpusItems(input),
    update: input.trigger === 'output_feedback',
    noViz: false,
  }).catch(() => null);

  if (!graphifyResult || !graphifyResult.available || graphifyResult.error) {
    return fallback;
  }

  const importedDocuments = importGraphifyDocuments(input, graphifyResult);
  if (importedDocuments.length > 0) {
    return {
      backend: 'graphify-v3',
      trigger: input.trigger,
      documents: importedDocuments,
    };
  }

  return {
    backend: 'graphify-v3',
    trigger: input.trigger,
    documents: applyGraphifyMetadata(fallback.documents, graphifyResult),
  };
}

export async function syncRawMaterialsIntoOntology(rawMaterials: RawMaterial[]): Promise<OntologyDocument[]> {
  const result = await runGraphCompilerJob({
    trigger: 'raw_ingest',
    rawMaterials,
  });
  return result.documents.map((document) => upsertOntologyDocument(document));
}

export async function syncOutputArtifactsIntoOntology(outputArtifacts: OutputArtifact[]): Promise<OntologyDocument[]> {
  const result = await runGraphCompilerJob({
    trigger: 'output_feedback',
    outputArtifacts,
  });
  return result.documents.map((document) => upsertOntologyDocument(document));
}
