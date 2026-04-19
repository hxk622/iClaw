import type { RawMaterial } from './types';
import type {
  CompileRawToOntologyInput,
  CompiledOntologyGraph,
  EvidenceLink,
  GraphifyDocumentViewModel,
  OntologyDocument,
  OntologyEdge,
  OntologyEdgeCandidate,
  OntologyNode,
  OntologyNodeCandidate,
  OntologyNodeType,
} from './ontology-types';

function nowIso(): string {
  return new Date().toISOString();
}

function safeId(parts: string[]): string {
  return parts.join('::').replace(/[^a-zA-Z0-9:_-]/g, '_');
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function evidenceFromRaw(raw: RawMaterial): EvidenceLink[] {
  return [
    {
      raw_id: raw.id,
      excerpt: raw.excerpt || raw.content_text.slice(0, 240) || raw.title,
    },
  ];
}

function inferNodeTypeFromTag(tag: string): OntologyNodeType {
  if (/ETF|债券|黄金|股票|基金|期货/i.test(tag)) return 'Asset';
  if (/公司|平台|品牌|机构|组织/i.test(tag)) return 'Organization';
  if (/人物|专家|作者|投资人/i.test(tag)) return 'Person';
  if (/事件|危机|回撤|通胀|利率/i.test(tag)) return 'Event';
  return 'Concept';
}

function buildNodeCandidates(raw: RawMaterial): OntologyNodeCandidate[] {
  const base: OntologyNodeCandidate[] = [
    {
      label: raw.title,
      node_type: raw.kind === 'snippet' ? 'Claim' : raw.source_type === 'video' ? 'Event' : 'Concept',
      summary: raw.excerpt || raw.title,
      weight: 1,
      evidence_links: evidenceFromRaw(raw),
    },
  ];

  if (raw.source_name) {
    base.push({
      label: raw.source_name,
      node_type: raw.kind === 'chat' ? 'Person' : 'Organization',
      summary: `${raw.source_name} 来源节点`,
      weight: 0.8,
      evidence_links: evidenceFromRaw(raw),
    });
  }

  for (const tag of raw.tags || []) {
    base.push({
      label: tag,
      node_type: inferNodeTypeFromTag(tag),
      summary: `${tag} 标签概念`,
      weight: 0.7,
      evidence_links: evidenceFromRaw(raw),
    });
  }

  return uniqueBy(base, (item) => `${item.node_type}:${item.label}`);
}

function buildEdgeCandidates(raw: RawMaterial, nodeCandidates: OntologyNodeCandidate[]): OntologyEdgeCandidate[] {
  const central = nodeCandidates[0];
  if (!central) return [];
  return nodeCandidates.slice(1).map((item) => ({
    from_label: central.label,
    to_label: item.label,
    relation_type: item.node_type === 'Organization' ? 'derived_from' : 'mentions',
    weight: 1,
    evidence_links: evidenceFromRaw(raw),
  }));
}

function compileSingleRaw(raw: RawMaterial): OntologyDocument {
  const graphId = safeId(['ontology', raw.id]);
  const nodeCandidates = buildNodeCandidates(raw);
  const edgeCandidates = buildEdgeCandidates(raw, nodeCandidates);

  const nodes: OntologyNode[] = nodeCandidates.map((node) => ({
    id: safeId([graphId, 'node', node.node_type, node.label]),
    graph_id: graphId,
    label: node.label,
    node_type: node.node_type,
    summary: node.summary,
    weight: node.weight,
    evidence_links: node.evidence_links,
  }));

  const edges: OntologyEdge[] = edgeCandidates
    .map((edge) => {
      const fromNode = nodes.find((item) => item.label === edge.from_label);
      const toNode = nodes.find((item) => item.label === edge.to_label);
      if (!fromNode || !toNode) return null;
      return {
        id: safeId([graphId, 'edge', fromNode.id, edge.relation_type, toNode.id]),
        graph_id: graphId,
        from_node_id: fromNode.id,
        to_node_id: toNode.id,
        relation_type: edge.relation_type,
        weight: edge.weight,
        evidence_links: edge.evidence_links,
      } satisfies OntologyEdge;
    })
    .filter((item): item is OntologyEdge => Boolean(item));

  const now = nowIso();
  return {
    id: graphId,
    title: raw.title,
    summary: raw.excerpt || `由素材 ${raw.title} 自动 graphify 成的本体图谱。`,
    source_raw_ids: [raw.id],
    status: 'compiled',
    created_at: now,
    updated_at: now,
    nodes,
    edges,
  };
}

export function compileRawToOntology(input: CompileRawToOntologyInput): CompiledOntologyGraph {
  return {
    documents: input.rawMaterials.map(compileSingleRaw),
  };
}

function nodeColor(type: OntologyNodeType): string {
  switch (type) {
    case 'Person':
      return '#FF6B6B';
    case 'Organization':
      return '#F59E0B';
    case 'Asset':
      return '#60A5FA';
    case 'Event':
      return '#A78BFA';
    case 'Claim':
      return '#F97316';
    case 'Evidence':
      return '#E5E7EB';
    case 'Output':
      return '#34D399';
    default:
      return '#FBBF24';
  }
}

export function mapOntologyDocumentToGraphifyView(document: OntologyDocument): GraphifyDocumentViewModel {
  return {
    id: document.id,
    title: document.title,
    nodes: document.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.node_type,
      size: Math.max(8, Math.round(node.weight * 20)),
      color: nodeColor(node.node_type),
    })),
    edges: document.edges.map((edge) => ({
      id: edge.id,
      source: edge.from_node_id,
      target: edge.to_node_id,
      relation: edge.relation_type,
      width: Math.max(1, Math.round(edge.weight * 2)),
    })),
  };
}
