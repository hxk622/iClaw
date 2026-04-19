import type { RawMaterial } from './types';
import type {
  CompileRawToOntologyInput,
  CompiledOntologyGraph,
  EvidenceLink,
  GraphifyDocumentViewModel,
  OntologyCompilerStats,
  OntologyDocument,
  OntologyEdge,
  OntologyEdgeCandidate,
  OntologyNode,
  OntologyNodeCandidate,
  OntologyNodeType,
  OntologyRelationType,
  PreprocessedRawChunk,
} from './ontology-types';

const COMPILER_VERSION = 'ontology-v2';
const MAX_CHUNK_CHARS = 320;
const CHINESE_ENTITY_MIN = 2;
const CHINESE_ENTITY_MAX = 10;
const ENGLISH_ENTITY_PATTERN = /\b([A-Z][a-zA-Z0-9+.-]{1,}(?:\s+[A-Z][a-zA-Z0-9+.-]{1,}){0,3})\b/g;
const CHINESE_ENTITY_PATTERN = /[\u4e00-\u9fa5]{2,10}/g;
const STOP_TERMS = new Set([
  '当前',
  '其中',
  '我们',
  '你可以',
  '如果',
  '然后',
  '内容',
  '页面',
  '资料',
  '素材',
  '摘要',
  '正文',
  '来源',
  '结构',
  '关系',
  '对象',
]);

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

function mergeEvidenceLinks(items: EvidenceLink[]): EvidenceLink[] {
  return uniqueBy(
    items
      .filter(Boolean)
      .map((item) => ({
        raw_id: item.raw_id,
        chunk_id: item.chunk_id || null,
        excerpt: item.excerpt || null,
      })),
    (item) => `${item.raw_id}:${item.chunk_id || ''}:${item.excerpt || ''}`,
  );
}

function normalizeText(value: string, maxLength = 400): string {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function splitParagraphs(text: string): string[] {
  return String(text || '')
    .split(/\n{2,}|(?<=[。！？!?])\s+|(?<=\.)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function chunkParagraph(paragraph: string): string[] {
  if (paragraph.length <= MAX_CHUNK_CHARS) return [paragraph];
  const chunks: string[] = [];
  let current = '';
  for (const segment of paragraph.split(/(?<=[，。；：,.])/)) {
    const part = segment.trim();
    if (!part) continue;
    if ((current + part).length > MAX_CHUNK_CHARS && current) {
      chunks.push(current.trim());
      current = part;
    } else {
      current += `${current ? ' ' : ''}${part}`;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function estimateTokens(text: string): number {
  const compact = normalizeText(text, 10000);
  if (!compact) return 0;
  return Math.max(1, Math.ceil(compact.length / 4));
}

export function preprocessRawMaterial(raw: RawMaterial): PreprocessedRawChunk[] {
  const sourceText = raw.content_text?.trim() || raw.excerpt?.trim() || raw.title;
  const paragraphs = splitParagraphs(sourceText);
  const chunks = paragraphs.flatMap(chunkParagraph);
  if (chunks.length === 0) {
    chunks.push(raw.title);
  }
  return chunks.map((text, index) => ({
    raw_id: raw.id,
    chunk_id: safeId([raw.id, 'chunk', String(index)]),
    text,
    token_estimate: estimateTokens(text),
    chunk_order: index,
    source_metadata: {
      source_name: raw.source_name,
      source_type: raw.source_type,
      title: raw.title,
    },
  }));
}

function evidenceFromRaw(raw: RawMaterial, chunk?: PreprocessedRawChunk): EvidenceLink[] {
  return [
    {
      raw_id: raw.id,
      chunk_id: chunk?.chunk_id || null,
      excerpt: normalizeText(chunk?.text || raw.excerpt || raw.content_text || raw.title, 240),
    },
  ];
}

function inferNodeType(label: string, fallback: OntologyNodeType = 'Concept'): OntologyNodeType {
  const normalized = label.trim();
  if (!normalized) return fallback;
  if (/ETF|债券|黄金|股票|基金|期货|指数|现金|美元|原油/i.test(normalized)) return 'Asset';
  if (/公司|平台|品牌|机构|组织|银行|基金会|企业|集团/i.test(normalized)) return 'Organization';
  if (/先生|女士|巴菲特|芒格|张磊|朱啸虎|霍华德|马克斯|达利欧|索罗斯/i.test(normalized)) return 'Person';
  if (/危机|回撤|通胀|利率|降息|衰退|复苏|牛市|熊市|事件/i.test(normalized)) return 'Event';
  if (/观点|命题|假设|判断|策略|逻辑|结论/i.test(normalized)) return 'Claim';
  return fallback;
}

function addCandidate(
  map: Map<string, OntologyNodeCandidate>,
  candidate: OntologyNodeCandidate,
): void {
  const key = `${candidate.node_type}:${candidate.label}`;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      ...candidate,
      evidence_links: mergeEvidenceLinks(candidate.evidence_links),
    });
    return;
  }
  existing.weight = Math.max(existing.weight, candidate.weight);
  existing.summary = existing.summary || candidate.summary;
  existing.evidence_links = mergeEvidenceLinks([...existing.evidence_links, ...candidate.evidence_links]);
}

function addEdgeCandidate(
  map: Map<string, OntologyEdgeCandidate>,
  candidate: OntologyEdgeCandidate,
): void {
  const key = `${candidate.from_label}:${candidate.relation_type}:${candidate.to_label}`;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      ...candidate,
      evidence_links: mergeEvidenceLinks(candidate.evidence_links),
    });
    return;
  }
  existing.weight = Math.max(existing.weight, candidate.weight);
  existing.evidence_links = mergeEvidenceLinks([...existing.evidence_links, ...candidate.evidence_links]);
}

function shouldKeepChineseEntity(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  if (normalized.length < CHINESE_ENTITY_MIN || normalized.length > CHINESE_ENTITY_MAX) return false;
  if (STOP_TERMS.has(normalized)) return false;
  return true;
}

function extractEntityLabels(raw: RawMaterial, chunk: PreprocessedRawChunk): Array<{ label: string; node_type: OntologyNodeType; weight: number }> {
  const candidates: Array<{ label: string; node_type: OntologyNodeType; weight: number }> = [];
  const title = normalizeText(raw.title, 120);
  if (title) {
    candidates.push({ label: title, node_type: raw.kind === 'snippet' ? 'Claim' : inferNodeType(title, 'Concept'), weight: 1.2 });
  }
  if (raw.source_name?.trim()) {
    candidates.push({ label: raw.source_name.trim(), node_type: raw.kind === 'chat' ? 'Person' : inferNodeType(raw.source_name.trim(), 'Organization'), weight: 1 });
  }
  for (const tag of raw.tags || []) {
    const label = tag.trim();
    if (!label) continue;
    candidates.push({ label, node_type: inferNodeType(label, 'Concept'), weight: 0.9 });
  }

  const englishMatches = Array.from(chunk.text.matchAll(ENGLISH_ENTITY_PATTERN)).map((match) => match[1]?.trim()).filter(Boolean);
  for (const match of englishMatches.slice(0, 6)) {
    candidates.push({ label: match, node_type: inferNodeType(match, 'Concept'), weight: 0.8 });
  }

  const chineseMatches = Array.from(chunk.text.match(CHINESE_ENTITY_PATTERN) || []);
  for (const match of chineseMatches.filter(shouldKeepChineseEntity).slice(0, 10)) {
    candidates.push({ label: match, node_type: inferNodeType(match, 'Concept'), weight: 0.7 });
  }

  return uniqueBy(candidates, (item) => `${item.node_type}:${item.label}`);
}

function extractNodeCandidates(raw: RawMaterial, chunks: PreprocessedRawChunk[]): OntologyNodeCandidate[] {
  const map = new Map<string, OntologyNodeCandidate>();
  for (const chunk of chunks) {
    for (const item of extractEntityLabels(raw, chunk)) {
      addCandidate(map, {
        label: item.label,
        node_type: item.node_type,
        summary: raw.excerpt || item.label,
        weight: item.weight,
        evidence_links: evidenceFromRaw(raw, chunk),
      });
    }
  }

  for (const chunk of chunks) {
    addCandidate(map, {
      label: `证据 ${chunk.chunk_order + 1}`,
      node_type: 'Evidence',
      summary: normalizeText(chunk.text, 120),
      weight: 0.6,
      evidence_links: evidenceFromRaw(raw, chunk),
    });
  }

  return Array.from(map.values());
}

function buildCentralLabel(raw: RawMaterial): string {
  return normalizeText(raw.title, 120) || '未命名本体对象';
}

function inferRelationType(fromType: OntologyNodeType, toType: OntologyNodeType): OntologyRelationType {
  if (toType === 'Evidence') return 'evidenced_by';
  if (toType === 'Organization' || toType === 'Person') return 'derived_from';
  if (toType === 'Asset') return 'belongs_to';
  if (toType === 'Event') return 'influences';
  if (fromType === 'Claim' && (toType === 'Concept' || toType === 'Claim')) return 'supports';
  return 'mentions';
}

function extractEdgeCandidates(raw: RawMaterial, nodeCandidates: OntologyNodeCandidate[]): OntologyEdgeCandidate[] {
  const map = new Map<string, OntologyEdgeCandidate>();
  const centralLabel = buildCentralLabel(raw);
  const centralNode = nodeCandidates.find((node) => node.label === centralLabel) || nodeCandidates[0];
  if (!centralNode) return [];

  for (const node of nodeCandidates) {
    if (node.label === centralNode.label && node.node_type === centralNode.node_type) continue;
    addEdgeCandidate(map, {
      from_label: centralNode.label,
      to_label: node.label,
      relation_type: inferRelationType(centralNode.node_type, node.node_type),
      weight: node.node_type === 'Evidence' ? 0.8 : 1,
      evidence_links: mergeEvidenceLinks(node.evidence_links),
    });
  }

  const evidenceNodes = nodeCandidates.filter((node) => node.node_type === 'Evidence');
  const conceptNodes = nodeCandidates.filter((node) => node.node_type !== 'Evidence' && node.label !== centralNode.label);
  for (const evidence of evidenceNodes) {
    for (const concept of conceptNodes.slice(0, 3)) {
      addEdgeCandidate(map, {
        from_label: concept.label,
        to_label: evidence.label,
        relation_type: 'evidenced_by',
        weight: 0.7,
        evidence_links: mergeEvidenceLinks([...concept.evidence_links, ...evidence.evidence_links]),
      });
    }
  }

  return Array.from(map.values());
}

function materializeDocument(raw: RawMaterial, nodes: OntologyNodeCandidate[], edges: OntologyEdgeCandidate[], chunks: PreprocessedRawChunk[]): OntologyDocument {
  const graphId = safeId(['ontology', raw.id]);
  const materializedNodes: OntologyNode[] = nodes.map((node) => ({
    id: safeId([graphId, 'node', node.node_type, node.label]),
    graph_id: graphId,
    label: node.label,
    node_type: node.node_type,
    summary: node.summary,
    weight: node.weight,
    evidence_links: mergeEvidenceLinks(node.evidence_links),
    metadata: node.node_type === 'Evidence' ? { source_raw_id: raw.id } : null,
  }));

  const materializedEdges: OntologyEdge[] = edges
    .map((edge) => {
      const fromNode = materializedNodes.find((node) => node.label === edge.from_label);
      const toNode = materializedNodes.find((node) => node.label === edge.to_label);
      if (!fromNode || !toNode) return null;
      return {
        id: safeId([graphId, 'edge', fromNode.id, edge.relation_type, toNode.id]),
        graph_id: graphId,
        from_node_id: fromNode.id,
        to_node_id: toNode.id,
        relation_type: edge.relation_type,
        weight: edge.weight,
        evidence_links: mergeEvidenceLinks(edge.evidence_links),
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
    nodes: materializedNodes,
    edges: materializedEdges,
    metadata: {
      chunk_count: chunks.length,
      compiler_version: COMPILER_VERSION,
    },
  };
}

export function compileSingleRawToOntology(raw: RawMaterial): OntologyDocument {
  const chunks = preprocessRawMaterial(raw);
  const nodes = extractNodeCandidates(raw, chunks);
  const edges = extractEdgeCandidates(raw, nodes);
  return materializeDocument(raw, nodes, edges, chunks);
}

export function compileRawToOntology(input: CompileRawToOntologyInput): CompiledOntologyGraph {
  return {
    documents: input.rawMaterials.map(compileSingleRawToOntology),
  };
}

export function summarizeOntologyCompilerStats(documents: OntologyDocument[]): OntologyCompilerStats {
  return {
    raw_count: documents.length,
    chunk_count: documents.reduce((sum, item) => sum + Number(item.metadata?.chunk_count || 0), 0),
    node_count: documents.reduce((sum, item) => sum + item.nodes.length, 0),
    edge_count: documents.reduce((sum, item) => sum + item.edges.length, 0),
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
      return '#F5F5F5';
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
