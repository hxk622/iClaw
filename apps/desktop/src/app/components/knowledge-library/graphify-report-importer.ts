import type { CreateOutputArtifactInput, OutputArtifact } from './output-types.ts';
import type { OntologyDocument } from './ontology-types.ts';
import type { RawMaterial } from './types.ts';

export interface ImportGraphifyReportInput {
  trigger: 'raw_ingest' | 'output_feedback';
  reportText: string;
  reportPath?: string | null;
  htmlPath?: string | null;
  graphJsonPath?: string | null;
  corpusDir?: string | null;
  outputDir?: string | null;
  ontologyDocument: OntologyDocument;
  rawMaterials?: RawMaterial[];
  outputArtifacts?: OutputArtifact[];
}

function normalizeText(value: string | null | undefined, maxLength = 12000): string {
  const compact = String(value || '').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function uniqueStrings(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return Array.from(new Set(values.map((value) => normalizeText(value, 160)).filter(Boolean)));
}

export function buildGraphifyReportOutputArtifact(input: ImportGraphifyReportInput): CreateOutputArtifactInput {
  const sourceRawIds = uniqueStrings([
    ...(input.rawMaterials ?? []).map((item) => item.id),
    ...input.ontologyDocument.source_raw_ids,
    ...(input.outputArtifacts ?? []).flatMap((item) => item.source_raw_ids),
  ]);
  const sourceOntologyIds = uniqueStrings([
    input.ontologyDocument.id,
    ...(input.outputArtifacts ?? []).flatMap((item) => item.source_ontology_ids),
  ]);
  const title =
    input.trigger === 'output_feedback'
      ? `${input.ontologyDocument.title} Graphify Report`
      : `${input.ontologyDocument.title} Graphify Report`;

  return {
    type: 'memo',
    title,
    summary: normalizeText(input.reportText.split('\n').find((line) => line.trim().startsWith('-')) || input.ontologyDocument.summary, 240),
    content: normalizeText(input.reportText, 40000),
    content_format: 'markdown',
    source_raw_ids: sourceRawIds,
    source_ontology_ids: sourceOntologyIds,
    status: 'draft',
    publish_targets: [],
    metadata: {
      generated_from: 'graphify-report',
      dedupe_key: `graphify-report::${input.ontologyDocument.id}`,
      source_surface:
        input.outputArtifacts && input.outputArtifacts.length === 1 && input.outputArtifacts[0].metadata && typeof input.outputArtifacts[0].metadata === 'object'
          ? (input.outputArtifacts[0].metadata as Record<string, unknown>).source_surface || null
          : null,
      lineage: {
        source: 'graphify-report',
        turn_id: null,
        conversation_id: null,
        session_key: null,
        artifact_kinds: ['report', ...(input.htmlPath ? ['webpage'] : [])],
        artifact_refs: [
          {
            kind: 'report',
            path: input.reportPath || null,
            title,
            previewKind: 'markdown',
          },
          ...(input.htmlPath
            ? [
                {
                  kind: 'webpage',
                  path: input.htmlPath,
                  title: `${input.ontologyDocument.title} Graph`,
                  previewKind: 'html',
                },
              ]
            : []),
        ],
        prompt_excerpt: null,
        source_raw_ids: sourceRawIds,
        source_ontology_ids: sourceOntologyIds,
      },
      graphify_report_path: input.reportPath || null,
      graphify_html_path: input.htmlPath || null,
      graphify_graph_json_path: input.graphJsonPath || null,
      graphify_corpus_dir: input.corpusDir || null,
      graphify_output_dir: input.outputDir || null,
      graphify_ontology_id: input.ontologyDocument.id,
    },
  };
}
