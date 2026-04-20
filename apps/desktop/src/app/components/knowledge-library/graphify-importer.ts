import type { OntologyDocument, OntologyEdge, OntologyNode, OntologyNodeType, OntologyRelationType } from './ontology-types.ts';
import type { OutputArtifact } from './output-types.ts';
import type { RawMaterial } from './types.ts';
import { buildOntologySourceSignature, buildOntologyRevisionId } from './ontology-revisions.ts';

type GraphifyJsonNode = {
  id: string;
  label?: string;
  file_type?: string | null;
  source_file?: string | null;
  source_location?: string | null;
  community?: number | string | null;
};

type GraphifyJsonLink = {
  source: string;
  target: string;
  relation?: string | null;
  confidence?: string | null;
  weight?: number | null;
  source_file?: string | null;
  source_location?: string | null;
};

type GraphifyJson = {
  nodes?: GraphifyJsonNode[];
  links?: GraphifyJsonLink[];
};

export interface ImportGraphifyGraphInput {
  graphJsonText: string;
  trigger: 'raw_ingest' | 'output_feedback';
  rawMaterials?: RawMaterial[];
  outputArtifacts?: OutputArtifact[];
  graphIdentity?: string | null;
  previousRevisionId?: string | null;
  preferredTitle?: string | null;
  preferredSummary?: string | null;
  graphifyMetadata?: {
    corpusDir?: string | null;
    outputDir?: string | null;
    graphJsonPath?: string | null;
    reportPath?: string | null;
    htmlPath?: string | null;
  } | null;
}

function safeId(parts: string[]): string {
  return parts.join('::').replace(/[^a-zA-Z0-9:_-]/g, '_');
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: string | null | undefined, maxLength = 400): string {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
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

function parseGraphifyJson(raw: string): GraphifyJson {
  const parsed = JSON.parse(raw) as GraphifyJson;
  return {
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    links: Array.isArray(parsed.links) ? parsed.links : [],
  };
}

function resolveDocumentIdentity(input: ImportGraphifyGraphInput): { id: string; title: string; summary: string } {
  if (input.graphIdentity) {
    return {
      id: safeId([input.graphIdentity]),
      title: normalizeText(input.preferredTitle || '', 240) || '图谱',
      summary:
        normalizeText(input.preferredSummary || '', 240) ||
        `由 graphify v3 基于${input.trigger === 'output_feedback' ? '成果反馈' : '素材输入'}编译生成。`,
    };
  }
  const rawMaterials = input.rawMaterials ?? [];
  const outputArtifacts = input.outputArtifacts ?? [];
  if (outputArtifacts.length === 1) {
    return {
      id: safeId(['ontology', 'graphify', 'output', outputArtifacts[0].id]),
      title: `${outputArtifacts[0].title} 图谱`,
      summary: `由 graphify v3 基于成果 ${outputArtifacts[0].title} 编译生成。`,
    };
  }
  if (rawMaterials.length === 1) {
    return {
      id: safeId(['ontology', 'graphify', rawMaterials[0].id]),
      title: rawMaterials[0].title,
      summary: `由 graphify v3 基于素材 ${rawMaterials[0].title} 编译生成。`,
    };
  }
  const joinedIds = [...rawMaterials.map((item) => item.id), ...outputArtifacts.map((item) => item.id)].join('-') || input.trigger;
  return {
    id: safeId(['ontology', 'graphify', input.trigger, joinedIds]),
    title: input.trigger === 'output_feedback' ? '成果反哺图谱' : '素材编译图谱',
    summary: `由 graphify v3 基于 ${input.trigger === 'output_feedback' ? '成果反馈' : '素材输入'} 编译生成。`,
  };
}

function resolveGraphifyNodeType(node: GraphifyJsonNode, outputArtifacts: OutputArtifact[]): OntologyNodeType {
  const label = normalizeText(node.label || node.id, 160);
  if (outputArtifacts.some((artifact) => artifact.title === label)) {
    return 'Output';
  }
  const fileType = (node.file_type || '').toLowerCase();
  if (fileType === 'image' || fileType === 'paper' || fileType === 'document') {
    return 'Evidence';
  }
  if (/\.[a-z0-9]{1,8}$/i.test(label) || (node.source_location || '').trim() === 'L1') {
    return 'Evidence';
  }
  return 'Concept';
}

function resolveGraphifyRelationType(relation: string | null | undefined): OntologyRelationType {
  const normalized = String(relation || '').trim().toLowerCase();
  if (!normalized) {
    return 'mentions';
  }
  if (normalized === 'rationale_for') {
    return 'supports';
  }
  if (normalized === 'cites') {
    return 'evidenced_by';
  }
  if (normalized === 'imports_from' || normalized === 'references' || normalized === 'contains') {
    return 'mentions';
  }
  if (normalized === 'implements') {
    return 'derived_from';
  }
  if (normalized === 'calls' || normalized === 'shares_data_with') {
    return 'influences';
  }
  return 'mentions';
}

function resolveEdgeWeight(link: GraphifyJsonLink): number {
  const weight = typeof link.weight === 'number' && Number.isFinite(link.weight) ? link.weight : 1;
  const confidence = String(link.confidence || '').trim().toUpperCase();
  if (confidence === 'AMBIGUOUS') {
    return Math.max(0.2, weight * 0.35);
  }
  if (confidence === 'INFERRED') {
    return Math.max(0.4, weight * 0.75);
  }
  return weight;
}

export function importGraphifyGraphToOntologyDocument(input: ImportGraphifyGraphInput): OntologyDocument {
  const graph = parseGraphifyJson(input.graphJsonText);
  const identity = resolveDocumentIdentity(input);
  const rawMaterials = input.rawMaterials ?? [];
  const outputArtifacts = input.outputArtifacts ?? [];
  const outputArtifactIds = outputArtifacts.map((item) => item.id);
  const sourceRawIds = uniqueStrings([
    ...rawMaterials.map((item) => item.id),
    ...outputArtifacts.flatMap((item) => item.source_raw_ids),
  ]);
  const sourceOntologyIds = uniqueStrings(outputArtifacts.flatMap((item) => item.source_ontology_ids));
  const nodes: OntologyNode[] = (graph.nodes ?? []).map((node) => ({
    id: safeId([identity.id, 'node', node.id]),
    graph_id: identity.id,
    label: normalizeText(node.label || node.id, 160) || node.id,
    node_type: resolveGraphifyNodeType(node, outputArtifacts),
    summary: normalizeText(node.source_file || node.label || node.id, 240),
    weight: 1,
    evidence_links: sourceRawIds.slice(0, 3).map((rawId) => ({
      raw_id: rawId,
      excerpt: normalizeText(`${node.source_file || ''} ${node.source_location || ''}`, 240),
    })),
    metadata: {
      graphify_id: node.id,
      file_type: node.file_type || null,
      source_file: node.source_file || null,
      source_location: node.source_location || null,
      community: node.community ?? null,
    },
  }));

  const nodeByGraphifyId = new Map((graph.nodes ?? []).map((node, index) => [node.id, nodes[index]]));

  const edges: OntologyEdge[] = (graph.links ?? [])
    .map((link) => {
      const sourceNode = nodeByGraphifyId.get(link.source);
      const targetNode = nodeByGraphifyId.get(link.target);
      if (!sourceNode || !targetNode) {
        return null;
      }
      return {
        id: safeId([identity.id, 'edge', sourceNode.id, targetNode.id, String(link.relation || 'mentions')]),
        graph_id: identity.id,
        from_node_id: sourceNode.id,
        to_node_id: targetNode.id,
        relation_type: resolveGraphifyRelationType(link.relation),
        weight: resolveEdgeWeight(link),
        evidence_links: sourceRawIds.slice(0, 3).map((rawId) => ({
          raw_id: rawId,
          excerpt: normalizeText(`${link.source_file || ''} ${link.source_location || ''}`, 240),
        })),
        metadata: {
          graphify_relation: link.relation || null,
          graphify_confidence: link.confidence || null,
          source_file: link.source_file || null,
          source_location: link.source_location || null,
        },
      } satisfies OntologyEdge;
    })
    .filter((edge): edge is OntologyEdge => Boolean(edge));

  const now = nowIso();
  const graphIdentity = identity.id;
  const sourceSignature = buildOntologySourceSignature({
    graphIdentity,
    sourceRawIds,
    sourceOutputIds: outputArtifactIds,
    compilerBackend: 'graphify-v3',
    compilerVersion: 'graphify-v3-importer-v1',
    generatedFrom: input.trigger === 'output_feedback' ? 'output' : 'raw',
  });
  return {
    id: buildOntologyRevisionId({
      graphIdentity,
      compiledAt: now,
      sourceSignature,
    }),
    title: identity.title,
    summary: identity.summary,
    source_raw_ids: sourceRawIds,
    status: 'compiled',
    created_at: now,
    updated_at: now,
    nodes,
    edges,
    metadata: {
      graph_identity: graphIdentity,
      revision_id: buildOntologyRevisionId({
        graphIdentity,
        compiledAt: now,
        sourceSignature,
      }),
      previous_revision_id: input.previousRevisionId || null,
      compiled_at: now,
      source_signature: sourceSignature,
      chunk_count: 0,
      compiler_version: 'graphify-v3-importer-v1',
      compiler_backend: 'graphify-v3',
      generated_from: input.trigger === 'output_feedback' ? 'output' : 'raw',
      source_output_artifact_ids: outputArtifactIds,
      source_ontology_ids: sourceOntologyIds,
      source_surface:
        outputArtifacts.length === 1 && outputArtifacts[0].metadata && typeof outputArtifacts[0].metadata === 'object'
          ? ((outputArtifacts[0].metadata as Record<string, unknown>).source_surface as string | null) || null
          : null,
      graphify_corpus_dir: input.graphifyMetadata?.corpusDir || null,
      graphify_output_dir: input.graphifyMetadata?.outputDir || null,
      graphify_graph_json_path: input.graphifyMetadata?.graphJsonPath || null,
      graphify_report_path: input.graphifyMetadata?.reportPath || null,
      graphify_html_path: input.graphifyMetadata?.htmlPath || null,
    },
  };
}
