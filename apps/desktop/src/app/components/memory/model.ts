export type MemoryDomain = '财经' | '产品' | '个人' | '项目' | '研究' | '其他';
export type MemoryType = '偏好' | '事实' | '决策' | '实体' | '其他';
export type MemoryImportance = '高' | '中' | '低';
export type MemorySourceType = '手动创建' | '自动捕获' | '导入' | '对话沉淀';
export type MemoryStatus = '已确认' | '待检查';
export type RecallState = '最近被用到' | '从未用到';
export type MemoryTimeRange = '最近 7 天' | '最近 30 天' | '全部';

export type MemoryEntry = {
  id: string;
  title: string;
  summary: string;
  content: string;
  domain: MemoryDomain;
  type: MemoryType;
  importance: MemoryImportance;
  sourceType: MemorySourceType;
  sourceLabel: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastRecalledAt: string | null;
  recallCount: number;
  captureConfidence: number;
  indexHealth: '健康' | '待刷新' | '同步中';
  status: MemoryStatus;
  active: boolean;
};

export type MemoryFilters = {
  domains: MemoryDomain[];
  types: MemoryType[];
  tags: string[];
  importance: MemoryImportance[];
  sourceTypes: MemorySourceType[];
  timeRange: MemoryTimeRange[];
  recalledState: RecallState[];
  onlyAutoCaptured: boolean;
  onlyHighImportance: boolean;
};

export type MemoryArrayFilterKey =
  | 'domains'
  | 'types'
  | 'tags'
  | 'importance'
  | 'sourceTypes'
  | 'timeRange'
  | 'recalledState';

export type MemoryEditDraft = {
  title: string;
  content: string;
  domain: MemoryDomain;
  type: MemoryType;
  importance: MemoryImportance;
  status: MemoryStatus;
  tags: string[];
  sourceLabel: string;
};

export type MemoryStatusSummary = {
  total: number;
  autoCaptured: number;
  recalled: number;
  pendingReview: number;
  totalRecalls: number;
  indexedFiles: number;
  indexedChunks: number;
  indexHealth: '健康' | '待刷新';
};

export const DOMAIN_OPTIONS: MemoryDomain[] = ['财经', '产品', '个人', '项目', '研究', '其他'];
export const TYPE_OPTIONS: MemoryType[] = ['偏好', '事实', '决策', '实体', '其他'];
export const IMPORTANCE_OPTIONS: MemoryImportance[] = ['高', '中', '低'];
export const SOURCE_OPTIONS: MemorySourceType[] = ['手动创建', '自动捕获', '导入', '对话沉淀'];
export const TIME_RANGE_OPTIONS: MemoryTimeRange[] = ['最近 7 天', '最近 30 天', '全部'];
export const RECALL_OPTIONS: RecallState[] = ['最近被用到', '从未用到'];

export const EMPTY_FILTERS: MemoryFilters = {
  domains: [],
  types: [],
  tags: [],
  importance: [],
  sourceTypes: [],
  timeRange: [],
  recalledState: [],
  onlyAutoCaptured: false,
  onlyHighImportance: false,
};

const DOMAIN_BADGE_CLASS: Record<MemoryDomain, string> = {
  财经: 'border-[#d4e3d8] bg-[#e8f0ea] text-[#5a7860]',
  产品: 'border-[#d8e1e6] bg-[#e8eef1] text-[#5b7c8d]',
  个人: 'border-[#eadfd4] bg-[#f5efe8] text-[#a0765c]',
  项目: 'border-[#ead8d7] bg-[#f5eaea] text-[#9a5956]',
  研究: 'border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)]',
  其他: 'border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] text-[var(--lobster-text-secondary)]',
};

const TYPE_BADGE_CLASS: Record<MemoryType, string> = {
  偏好: 'border-[#d8e1e6] bg-[#e8eef1] text-[#5b7c8d]',
  事实: 'border-[#d4e3d8] bg-[#e8f0ea] text-[#5a7860]',
  决策: 'border-[#eadfd4] bg-[#f5efe8] text-[#a0765c]',
  实体: 'border-[#ead8d7] bg-[#f5eaea] text-[#9a5956]',
  其他: 'border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] text-[var(--lobster-text-secondary)]',
};

const IMPORTANCE_BADGE_CLASS: Record<MemoryImportance, string> = {
  高: 'border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)]',
  中: 'border-[#eadfd4] bg-[#f5efe8] text-[#a0765c]',
  低: 'border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] text-[var(--lobster-text-secondary)]',
};

const STATUS_BADGE_CLASS: Record<MemoryStatus, string> = {
  已确认: 'border-[var(--lobster-success-border)] bg-[var(--lobster-success-soft)] text-[var(--lobster-success-text)]',
  待检查: 'border-[#eadfd4] bg-[#f5efe8] text-[#a0765c]',
};

export function getDomainBadgeClass(domain: MemoryDomain) {
  return DOMAIN_BADGE_CLASS[domain];
}

export function getTypeBadgeClass(type: MemoryType) {
  return TYPE_BADGE_CLASS[type];
}

export function getImportanceBadgeClass(importance: MemoryImportance) {
  return IMPORTANCE_BADGE_CLASS[importance];
}

export function getStatusBadgeClass(status: MemoryStatus) {
  return STATUS_BADGE_CLASS[status];
}

export function getIndexHealthClass(indexHealth: MemoryEntry['indexHealth']) {
  if (indexHealth === '健康') {
    return 'text-[var(--lobster-success-text)]';
  }
  if (indexHealth === '同步中') {
    return 'text-[#5b7c8d]';
  }
  return 'text-[#a0765c]';
}

export function toggleValue<T>(current: T[], value: T) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

export function formatRecallState(entry: MemoryEntry): RecallState {
  return entry.recallCount > 0 ? '最近被用到' : '从未用到';
}

export function parseMemoryDate(value: string | null | undefined): number | null {
  if (!value) return null;

  const normalized = value.trim();
  if (!normalized) return null;

  const directCandidate =
    normalized.length <= 10 ? `${normalized.replace(/\//g, '-')}T00:00:00` : normalized.replace(/\//g, '-').replace(' ', 'T');
  const directTimestamp = Date.parse(directCandidate);
  if (Number.isFinite(directTimestamp)) return directTimestamp;

  const match = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;

  const [, year, month, day, hour = '0', minute = '0'] = match;
  const timestamp = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  ).getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
}

export function matchesTimeRange(updatedAt: string, ranges: MemoryTimeRange[], now = Date.now()) {
  if (ranges.length === 0 || ranges.includes('全部')) return true;

  const timestamp = parseMemoryDate(updatedAt);
  if (timestamp === null) return false;

  return ranges.some((range) => {
    const days = range === '最近 7 天' ? 7 : 30;
    return timestamp >= now - days * 24 * 60 * 60 * 1000;
  });
}

export function deriveRelatedEntries(entries: MemoryEntry[], target: MemoryEntry | null) {
  if (!target) return [];
  return entries
    .filter(
      (entry) =>
        entry.id !== target.id &&
        entry.active &&
        (entry.domain === target.domain ||
          entry.type === target.type ||
          entry.tags.some((tag) => target.tags.includes(tag))),
    )
    .sort((left, right) => right.recallCount - left.recallCount)
    .slice(0, 4);
}

export function createEditDraft(entry: MemoryEntry): MemoryEditDraft {
  return {
    title: entry.title,
    content: entry.content,
    domain: entry.domain,
    type: entry.type,
    importance: entry.importance,
    status: entry.status,
    tags: entry.tags,
    sourceLabel: entry.sourceLabel,
  };
}

export function todayStamp() {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace(/\//g, '-');
}

export function createMemoryId() {
  return `memory-${Math.random().toString(36).slice(2, 10)}`;
}

export function createMemorySummary(content: string, fallback: string) {
  const normalized = content.trim().replace(/\s+/g, ' ');
  return normalized.slice(0, 58) || fallback;
}

export function normalizeImportedEntry(value: unknown): MemoryEntry | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<MemoryEntry>;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;

  const content = typeof raw.content === 'string' && raw.content.trim() ? raw.content.trim() : title;
  const tags =
    Array.isArray(raw.tags) && raw.tags.every((tag) => typeof tag === 'string')
      ? Array.from(new Set(raw.tags.map((tag) => tag.trim()).filter(Boolean)))
      : [];
  const now = todayStamp();

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : createMemoryId(),
    title,
    summary:
      typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim()
        : createMemorySummary(content, `${title} 的导入记忆`),
    content,
    domain: DOMAIN_OPTIONS.includes(raw.domain as MemoryDomain) ? (raw.domain as MemoryDomain) : '其他',
    type: TYPE_OPTIONS.includes(raw.type as MemoryType) ? (raw.type as MemoryType) : '事实',
    importance: IMPORTANCE_OPTIONS.includes(raw.importance as MemoryImportance)
      ? (raw.importance as MemoryImportance)
      : '中',
    sourceType: SOURCE_OPTIONS.includes(raw.sourceType as MemorySourceType)
      ? (raw.sourceType as MemorySourceType)
      : '导入',
    sourceLabel:
      typeof raw.sourceLabel === 'string' && raw.sourceLabel.trim() ? raw.sourceLabel.trim() : '本地 JSON 导入',
    tags,
    createdAt: typeof raw.createdAt === 'string' && raw.createdAt.trim() ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt.trim() ? raw.updatedAt : now,
    lastRecalledAt: typeof raw.lastRecalledAt === 'string' && raw.lastRecalledAt.trim() ? raw.lastRecalledAt : null,
    recallCount: typeof raw.recallCount === 'number' && Number.isFinite(raw.recallCount) ? raw.recallCount : 0,
    captureConfidence:
      typeof raw.captureConfidence === 'number' && Number.isFinite(raw.captureConfidence) ? raw.captureConfidence : 0.82,
    indexHealth:
      raw.indexHealth === '健康' || raw.indexHealth === '待刷新' || raw.indexHealth === '同步中'
        ? raw.indexHealth
        : '待刷新',
    status: raw.status === '已确认' || raw.status === '待检查' ? raw.status : '待检查',
    active: raw.active !== false,
  };
}
