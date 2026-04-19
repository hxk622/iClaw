import { Network } from 'lucide-react';
import type { KnowledgeLibraryItem } from './model';
import type { OntologyDocument } from './ontology-types';
import { mapOntologyDocumentToGraphifyView } from './ontology-pipeline';

function formatRelativeTime(timestamp: string): string {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return '刚刚';
  const diffSeconds = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
  if (diffSeconds < 60) return '刚刚';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} 分钟前`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} 小时前`;
  return `${Math.floor(diffSeconds / 86400)} 天前`;
}

export function mapOntologyDocumentToKnowledgeLibraryItem(document: OntologyDocument): KnowledgeLibraryItem {
  const graph = mapOntologyDocumentToGraphifyView(document);
  return {
    id: document.id,
    title: document.title,
    subtitle: `本体图谱 · ${document.nodes.length} 个节点 / ${document.edges.length} 条关系`,
    summary: document.summary,
    tags: Array.from(new Set(document.nodes.slice(0, 4).map((node) => node.label))).slice(0, 4),
    icon: Network,
    meta: `${formatRelativeTime(document.updated_at)}编译`,
    ontologyDocument: document,
    ontologyGraphView: graph,
  };
}
