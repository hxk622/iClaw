import type { RawMaterial } from './types';

export type OntologyNodeType =
  | 'Person'
  | 'Organization'
  | 'Concept'
  | 'Asset'
  | 'Event'
  | 'Claim'
  | 'Evidence'
  | 'Output';

export type OntologyRelationType =
  | 'supports'
  | 'contradicts'
  | 'influences'
  | 'belongs_to'
  | 'mentions'
  | 'authored_by'
  | 'derived_from'
  | 'evidenced_by';

export interface EvidenceLink {
  raw_id: string;
  chunk_id?: string | null;
  excerpt?: string | null;
}

export interface OntologyNode {
  id: string;
  graph_id: string;
  label: string;
  node_type: OntologyNodeType;
  summary: string;
  weight: number;
  evidence_links: EvidenceLink[];
  metadata?: Record<string, unknown> | null;
}

export interface OntologyEdge {
  id: string;
  graph_id: string;
  from_node_id: string;
  to_node_id: string;
  relation_type: OntologyRelationType;
  weight: number;
  evidence_links: EvidenceLink[];
  metadata?: Record<string, unknown> | null;
}

export interface OntologyDocument {
  id: string;
  title: string;
  summary: string;
  source_raw_ids: string[];
  status: 'draft' | 'compiled' | 'stale';
  updated_at: string;
  created_at: string;
  nodes: OntologyNode[];
  edges: OntologyEdge[];
}

export interface OntologyNodeCandidate {
  label: string;
  node_type: OntologyNodeType;
  summary: string;
  weight: number;
  evidence_links: EvidenceLink[];
}

export interface OntologyEdgeCandidate {
  from_label: string;
  to_label: string;
  relation_type: OntologyRelationType;
  weight: number;
  evidence_links: EvidenceLink[];
}

export interface PreprocessedRawChunk {
  raw_id: string;
  chunk_id: string;
  text: string;
  token_estimate: number;
  chunk_order: number;
  source_metadata: {
    source_name: string;
    source_type: RawMaterial['source_type'];
    title: string;
  };
}

export interface CompileRawToOntologyInput {
  rawMaterials: RawMaterial[];
}

export interface CompiledOntologyGraph {
  documents: OntologyDocument[];
}

export interface GraphifyNodeViewModel {
  id: string;
  label: string;
  type: OntologyNodeType;
  size: number;
  color: string;
}

export interface GraphifyEdgeViewModel {
  id: string;
  source: string;
  target: string;
  relation: OntologyRelationType;
  width: number;
}

export interface GraphifyDocumentViewModel {
  id: string;
  title: string;
  nodes: GraphifyNodeViewModel[];
  edges: GraphifyEdgeViewModel[];
}
