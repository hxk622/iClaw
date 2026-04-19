export type OutputArtifactType =
  | 'memo'
  | 'expert'
  | 'card'
  | 'article'
  | 'wechat_post'
  | 'xhs_post'
  | 'ppt'
  | 'doc'
  | 'rule';

export interface OutputArtifact {
  id: string;
  type: OutputArtifactType;
  title: string;
  summary: string;
  content: string;
  content_format: 'markdown' | 'html' | 'json' | 'binary';
  source_raw_ids: string[];
  source_ontology_ids: string[];
  status: 'draft' | 'published' | 'archived';
  publish_targets: string[];
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOutputArtifactInput {
  type: OutputArtifactType;
  title: string;
  summary?: string;
  content?: string;
  content_format?: OutputArtifact['content_format'];
  source_raw_ids?: string[];
  source_ontology_ids?: string[];
  status?: OutputArtifact['status'];
  publish_targets?: string[];
  metadata?: Record<string, unknown> | null;
}
