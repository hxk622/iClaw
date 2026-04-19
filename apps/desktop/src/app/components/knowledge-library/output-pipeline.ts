import type { OntologyDocument } from './ontology-types';
import type { CreateOutputArtifactInput, OutputArtifact } from './output-types';

function normalizeText(value: string, maxLength = 400): string {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function buildMemoArtifactFromOntology(document: OntologyDocument): CreateOutputArtifactInput {
  const topNodes = document.nodes
    .filter((node) => node.node_type !== 'Evidence')
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 6)
    .map((node) => `- ${node.label}（${node.node_type}）`)
    .join('\n');

  const topEdges = document.edges
    .slice(0, 8)
    .map((edge) => `- ${edge.relation_type}: ${edge.from_node_id.split('::').slice(-1)[0]} -> ${edge.to_node_id.split('::').slice(-1)[0]}`)
    .join('\n');

  return {
    type: 'memo',
    title: `${document.title} Memo`,
    summary: normalizeText(document.summary || `基于 ${document.title} 本体图谱生成的研究备忘录。`, 240),
    content: `# ${document.title} Memo\n\n## 摘要\n${document.summary}\n\n## 核心实体\n${topNodes || '- 暂无'}\n\n## 核心关系\n${topEdges || '- 暂无'}\n\n## 来源\n- Ontology Document: ${document.id}`,
    content_format: 'markdown',
    source_raw_ids: document.source_raw_ids,
    source_ontology_ids: [document.id],
    status: 'draft',
    publish_targets: [],
    metadata: {
      generated_from: 'ontology',
      ontology_id: document.id,
      ontology_node_count: document.nodes.length,
      ontology_edge_count: document.edges.length,
    },
  };
}

export function buildOutputArtifactsFromOntologyDocuments(documents: OntologyDocument[]): CreateOutputArtifactInput[] {
  return documents.map(buildMemoArtifactFromOntology);
}

export function buildOutputDedupeKeyFromOntology(document: OntologyDocument): string {
  return `memo::ontology::${document.id}`;
}

export function mapStoredOutputToCreateInput(item: OutputArtifact): CreateOutputArtifactInput & { id: string } {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    summary: item.summary,
    content: item.content,
    content_format: item.content_format,
    source_raw_ids: item.source_raw_ids,
    source_ontology_ids: item.source_ontology_ids,
    status: item.status,
    publish_targets: item.publish_targets,
    metadata: item.metadata || null,
  };
}
