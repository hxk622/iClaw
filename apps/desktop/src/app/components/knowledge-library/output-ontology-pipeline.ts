import { getRawMaterialById } from './raw-storage.ts';
import { getOntologyDocumentById } from './ontology-storage.ts';
import type { OntologyDocument, OntologyEdge, OntologyNode } from './ontology-types.ts';
import {
  parseOutputArtifactFinanceCompliance,
  parseOutputArtifactLineage,
  parseOutputArtifactSourceSurface,
  type OutputArtifact,
} from './output-types.ts';

const OUTPUT_ONTOLOGY_COMPILER_VERSION = 'graph-compiler-output-v1';

function nowIso(): string {
  return new Date().toISOString();
}

function safeId(parts: string[]): string {
  return parts.join('::').replace(/[^a-zA-Z0-9:_-]/g, '_');
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

function extractOutputConceptLabels(artifact: OutputArtifact): string[] {
  const text = `${artifact.title}\n${artifact.summary}\n${artifact.content}`.replace(/\s+/g, ' ').trim();
  if (!text) {
    return [];
  }
  const chineseMatches = Array.from(text.match(/[\u4e00-\u9fa5]{2,10}/g) || []);
  const englishMatches = Array.from(text.match(/\b[A-Z][a-zA-Z0-9+.-]{1,}(?:\s+[A-Z][a-zA-Z0-9+.-]{1,}){0,2}\b/g) || []);
  return uniqueStrings([...chineseMatches, ...englishMatches]).filter(
    (label) => label !== artifact.title && label !== artifact.summary,
  ).slice(0, 6);
}

export function buildOntologyDocumentFromOutputArtifact(artifact: OutputArtifact): OntologyDocument {
  const graphId = safeId(['ontology', 'output', artifact.id]);
  const now = nowIso();
  const lineage = parseOutputArtifactLineage(artifact.metadata || null);
  const sourceSurface = parseOutputArtifactSourceSurface(artifact.metadata || null);
  const financeCompliance = parseOutputArtifactFinanceCompliance(artifact.metadata || null);

  const sourceRawMaterials = uniqueStrings(artifact.source_raw_ids)
    .map((id) => getRawMaterialById(id))
    .filter((item): item is NonNullable<ReturnType<typeof getRawMaterialById>> => Boolean(item));
  const sourceOntologyDocuments = uniqueStrings(artifact.source_ontology_ids)
    .map((id) => getOntologyDocumentById(id))
    .filter((item): item is NonNullable<ReturnType<typeof getOntologyDocumentById>> => Boolean(item));

  const nodes: OntologyNode[] = [];
  const edges: OntologyEdge[] = [];

  const outputNodeId = safeId([graphId, 'node', 'Output', artifact.title]);
  nodes.push({
    id: outputNodeId,
    graph_id: graphId,
    label: artifact.title,
    node_type: 'Output',
    summary: artifact.summary || normalizeText(artifact.content, 240),
    weight: 1.4,
    evidence_links: sourceRawMaterials.map((raw) => ({
      raw_id: raw.id,
      excerpt: normalizeText(raw.excerpt || raw.title, 240),
    })),
    metadata: {
      output_artifact_id: artifact.id,
      output_type: artifact.type,
      source_surface: sourceSurface,
      generated_from:
        artifact.metadata && typeof artifact.metadata === 'object'
          ? (artifact.metadata as Record<string, unknown>).generated_from || null
          : null,
      finance_compliance: financeCompliance,
    },
  });

  sourceOntologyDocuments.forEach((document) => {
    const nodeId = safeId([graphId, 'node', 'Concept', document.title]);
    nodes.push({
      id: nodeId,
      graph_id: graphId,
      label: document.title,
      node_type: 'Concept',
      summary: document.summary,
      weight: 1.0,
      evidence_links: document.source_raw_ids.map((rawId) => ({
        raw_id: rawId,
        excerpt: normalizeText(document.summary, 240),
      })),
      metadata: {
        source_ontology_id: document.id,
      },
    });
    edges.push({
      id: safeId([graphId, 'edge', outputNodeId, 'derived_from', nodeId]),
      graph_id: graphId,
      from_node_id: outputNodeId,
      to_node_id: nodeId,
      relation_type: 'derived_from',
      weight: 1.1,
      evidence_links: document.source_raw_ids.map((rawId) => ({
        raw_id: rawId,
        excerpt: normalizeText(document.summary, 240),
      })),
      metadata: {
        source_ontology_id: document.id,
      },
    });
  });

  sourceRawMaterials.forEach((raw) => {
    const nodeId = safeId([graphId, 'node', 'Evidence', raw.title]);
    nodes.push({
      id: nodeId,
      graph_id: graphId,
      label: raw.title,
      node_type: 'Evidence',
      summary: raw.excerpt || normalizeText(raw.content_text, 180),
      weight: 0.8,
      evidence_links: [
        {
          raw_id: raw.id,
          excerpt: normalizeText(raw.excerpt || raw.title, 240),
        },
      ],
      metadata: {
        source_raw_id: raw.id,
      },
    });
    edges.push({
      id: safeId([graphId, 'edge', outputNodeId, 'evidenced_by', nodeId]),
      graph_id: graphId,
      from_node_id: outputNodeId,
      to_node_id: nodeId,
      relation_type: 'evidenced_by',
      weight: 0.9,
      evidence_links: [
        {
          raw_id: raw.id,
          excerpt: normalizeText(raw.excerpt || raw.title, 240),
        },
      ],
      metadata: {
        source_raw_id: raw.id,
      },
    });
  });

  extractOutputConceptLabels(artifact).forEach((label) => {
    const nodeId = safeId([graphId, 'node', 'Concept', label]);
    nodes.push({
      id: nodeId,
      graph_id: graphId,
      label,
      node_type: 'Concept',
      summary: normalizeText(artifact.summary || artifact.content, 180),
      weight: 0.9,
      evidence_links: sourceRawMaterials.slice(0, 3).map((raw) => ({
        raw_id: raw.id,
        excerpt: normalizeText(raw.excerpt || raw.title, 240),
      })),
      metadata: {
        derived_from_output_id: artifact.id,
      },
    });
    edges.push({
      id: safeId([graphId, 'edge', outputNodeId, 'mentions', nodeId]),
      graph_id: graphId,
      from_node_id: outputNodeId,
      to_node_id: nodeId,
      relation_type: 'mentions',
      weight: 0.8,
      evidence_links: sourceRawMaterials.slice(0, 3).map((raw) => ({
        raw_id: raw.id,
        excerpt: normalizeText(raw.excerpt || raw.title, 240),
      })),
      metadata: {
        derived_from_output_id: artifact.id,
      },
    });
  });

  if (lineage?.prompt_excerpt) {
    const claimNodeId = safeId([graphId, 'node', 'Claim', artifact.id]);
    nodes.push({
      id: claimNodeId,
      graph_id: graphId,
      label: 'Prompt Claim',
      node_type: 'Claim',
      summary: lineage.prompt_excerpt,
      weight: 0.85,
      evidence_links: sourceRawMaterials.slice(0, 2).map((raw) => ({
        raw_id: raw.id,
        excerpt: normalizeText(raw.excerpt || raw.title, 240),
      })),
      metadata: {
        turn_id: lineage.turn_id,
        conversation_id: lineage.conversation_id,
      },
    });
    edges.push({
      id: safeId([graphId, 'edge', outputNodeId, 'supports', claimNodeId]),
      graph_id: graphId,
      from_node_id: outputNodeId,
      to_node_id: claimNodeId,
      relation_type: 'supports',
      weight: 0.75,
      evidence_links: sourceRawMaterials.slice(0, 2).map((raw) => ({
        raw_id: raw.id,
        excerpt: normalizeText(raw.excerpt || raw.title, 240),
      })),
      metadata: {
        turn_id: lineage.turn_id,
      },
    });
  }

  return {
    id: graphId,
    title: `${artifact.title} 图谱`,
    summary: `由成果 ${artifact.title} 反哺生成的本体图谱。`,
    source_raw_ids: uniqueStrings(artifact.source_raw_ids),
    status: 'compiled',
    created_at: now,
    updated_at: now,
    nodes,
    edges,
    metadata: {
      chunk_count: 0,
      compiler_version: OUTPUT_ONTOLOGY_COMPILER_VERSION,
      compiler_backend: 'local-fallback',
      generated_from: 'output',
      source_output_artifact_ids: [artifact.id],
      source_ontology_ids: uniqueStrings(artifact.source_ontology_ids),
      source_surface: sourceSurface,
    },
  };
}

export function buildOntologyDocumentsFromOutputArtifacts(artifacts: OutputArtifact[]): OntologyDocument[] {
  return artifacts.map(buildOntologyDocumentFromOutputArtifact);
}
