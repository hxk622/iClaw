export type OutputArtifactType =
  | 'memo'
  | 'graph_query_note'
  | 'graph_path_note'
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

export interface OutputArtifactLineage {
  source: string;
  turn_id: string | null;
  conversation_id: string | null;
  session_key: string | null;
  artifact_kinds: string[];
  artifact_refs: Array<{
    kind: string;
    path?: string | null;
    title?: string | null;
    mimeType?: string | null;
    previewKind?: string | null;
  }>;
  prompt_excerpt: string | null;
  source_raw_ids: string[];
  source_ontology_ids: string[];
}

export interface OutputArtifactFinanceComplianceSnapshot {
  domain: 'finance';
  inputClassification: string | null;
  outputClassification: string | null;
  riskLevel: 'low' | 'medium' | 'high';
  showDisclaimer: boolean;
  disclaimerText: string | null;
  requiresRiskSection: boolean;
  blocked: boolean;
  degraded: boolean;
  reasons: string[];
  matchedRules: string[];
  confidence: 'low' | 'medium' | 'high';
  classifierVersion: string | null;
  decisionSource: 'plugin' | 'server' | 'heuristic_fallback';
  usedCapabilities: string[];
  usedModel: string | null;
  sourceAttributionRequired: boolean;
  timestampRequired: boolean;
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

function normalizeOptionalText(value: unknown, maxLength = 400): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const compact = value.trim();
  if (!compact) {
    return null;
  }
  return compact.length > maxLength ? `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : compact;
}

function normalizeStringArray(value: unknown, maxLength = 120): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((entry) => normalizeOptionalText(entry, maxLength))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
}

export function parseOutputArtifactLineage(metadata: Record<string, unknown> | null | undefined): OutputArtifactLineage | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  const raw = metadata.lineage;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const source = normalizeOptionalText((raw as Record<string, unknown>).source, 80) || 'unknown';
  const artifactRefsRaw = Array.isArray((raw as Record<string, unknown>).artifact_refs)
    ? ((raw as Record<string, unknown>).artifact_refs as unknown[])
    : [];

  return {
    source,
    turn_id: normalizeOptionalText((raw as Record<string, unknown>).turn_id, 120),
    conversation_id: normalizeOptionalText((raw as Record<string, unknown>).conversation_id, 120),
    session_key: normalizeOptionalText((raw as Record<string, unknown>).session_key, 240),
    artifact_kinds: normalizeStringArray((raw as Record<string, unknown>).artifact_kinds, 80),
    artifact_refs: artifactRefsRaw
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
      .map((entry) => ({
        kind: normalizeOptionalText(entry.kind, 80) || 'artifact',
        path: normalizeOptionalText(entry.path, 400),
        title: normalizeOptionalText(entry.title, 160),
        mimeType: normalizeOptionalText(entry.mimeType, 120),
        previewKind: normalizeOptionalText(entry.previewKind, 80),
      })),
    prompt_excerpt: normalizeOptionalText((raw as Record<string, unknown>).prompt_excerpt, 240),
    source_raw_ids: normalizeStringArray((raw as Record<string, unknown>).source_raw_ids, 120),
    source_ontology_ids: normalizeStringArray((raw as Record<string, unknown>).source_ontology_ids, 120),
  };
}

export function parseOutputArtifactSourceSurface(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  return normalizeOptionalText(metadata.source_surface, 80);
}

export function parseOutputArtifactFinanceCompliance(
  metadata: Record<string, unknown> | null | undefined,
): OutputArtifactFinanceComplianceSnapshot | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  const raw = metadata.finance_compliance;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const domain = (raw as Record<string, unknown>).domain === 'finance' ? 'finance' : null;
  if (!domain) {
    return null;
  }
  const riskLevel = (raw as Record<string, unknown>).riskLevel;
  return {
    domain,
    inputClassification: normalizeOptionalText((raw as Record<string, unknown>).inputClassification, 80),
    outputClassification: normalizeOptionalText((raw as Record<string, unknown>).outputClassification, 80),
    riskLevel: riskLevel === 'low' || riskLevel === 'high' ? riskLevel : 'medium',
    showDisclaimer: (raw as Record<string, unknown>).showDisclaimer === true,
    disclaimerText: normalizeOptionalText((raw as Record<string, unknown>).disclaimerText, 240),
    requiresRiskSection: (raw as Record<string, unknown>).requiresRiskSection === true,
    blocked: (raw as Record<string, unknown>).blocked === true,
    degraded: (raw as Record<string, unknown>).degraded === true,
    reasons: normalizeStringArray((raw as Record<string, unknown>).reasons, 120),
    matchedRules: normalizeStringArray((raw as Record<string, unknown>).matchedRules, 120),
    confidence:
      (raw as Record<string, unknown>).confidence === 'low' || (raw as Record<string, unknown>).confidence === 'high'
        ? ((raw as Record<string, unknown>).confidence as 'low' | 'high')
        : 'medium',
    classifierVersion: normalizeOptionalText((raw as Record<string, unknown>).classifierVersion, 120),
    decisionSource:
      (raw as Record<string, unknown>).decisionSource === 'plugin' ||
      (raw as Record<string, unknown>).decisionSource === 'server' ||
      (raw as Record<string, unknown>).decisionSource === 'heuristic_fallback'
        ? ((raw as Record<string, unknown>).decisionSource as 'plugin' | 'server' | 'heuristic_fallback')
        : 'heuristic_fallback',
    usedCapabilities: normalizeStringArray((raw as Record<string, unknown>).usedCapabilities, 120),
    usedModel: normalizeOptionalText((raw as Record<string, unknown>).usedModel, 160),
    sourceAttributionRequired: (raw as Record<string, unknown>).sourceAttributionRequired === true,
    timestampRequired: (raw as Record<string, unknown>).timestampRequired === true,
  };
}
