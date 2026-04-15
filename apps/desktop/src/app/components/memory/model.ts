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
  sourceTypes: MemorySourceType[];
  timeRange: MemoryTimeRange[];
  recalledState: RecallState[];
  onlyAutoCaptured: boolean;
};

export type MemoryArrayFilterKey =
  | 'domains'
  | 'types'
  | 'tags'
  | 'sourceTypes'
  | 'timeRange'
  | 'recalledState';

export type MemoryEditDraft = {
  title: string;
  content: string;
  domain: MemoryDomain;
  type: MemoryType;
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
export const SOURCE_OPTIONS: MemorySourceType[] = ['手动创建', '自动捕获', '导入', '对话沉淀'];
export const TIME_RANGE_OPTIONS: MemoryTimeRange[] = ['最近 7 天', '最近 30 天', '全部'];
export const RECALL_OPTIONS: RecallState[] = ['最近被用到', '从未用到'];

export const EMPTY_FILTERS: MemoryFilters = {
  domains: [],
  types: [],
  tags: [],
  sourceTypes: [],
  timeRange: [],
  recalledState: [],
  onlyAutoCaptured: false,
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
    status: entry.status,
    tags: entry.tags,
    sourceLabel: entry.sourceLabel,
  };
}

const MEMORY_TAG_STOP_WORDS = new Set([
  '今天',
  '当前',
  '这个',
  '那个',
  '这些',
  '那些',
  '已经',
  '需要',
  '进行',
  '相关',
  '问题',
  '情况',
  '内容',
  '信息',
  '记录',
  '总结',
  '分析',
  '整理',
  '判断',
  '关注',
  '使用',
  '用户',
  '我们',
  '他们',
  '你们',
  '如果',
  '因为',
  '以及',
  '或者',
  '但是',
  '然后',
  '所以',
  '一个',
  '一些',
  '没有',
  '可以',
  '继续',
  '本次',
  '需要',
  '进行',
  'about',
  'with',
  'from',
  'that',
  'this',
  'have',
  'will',
  'your',
  'they',
  'them',
  'what',
  'when',
  'where',
  'which',
  '因为',
  '还是',
]);

const LEGACY_MEMORY_PLACEHOLDER_TAGS = new Set(['待整理']);

function normalizeMemoryTagCandidate(value: string): string | null {
  const trimmed = value.trim().replace(/[：:，,。！？!?\[\]【】（）()"'“”‘’]/g, '');
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  if (MEMORY_TAG_STOP_WORDS.has(normalized) || MEMORY_TAG_STOP_WORDS.has(trimmed)) {
    return null;
  }
  const isChinese = /[\p{Script=Han}]/u.test(trimmed);
  if (isChinese && (trimmed.length < 2 || trimmed.length > 8)) {
    return null;
  }
  if (!isChinese && !/^[a-z0-9][a-z0-9\-+.]{1,23}$/i.test(trimmed)) {
    return null;
  }
  if (!isChinese && trimmed.length < 3) {
    return null;
  }
  return trimmed;
}

export function generateMemoryTags(input: {
  title: string;
  content: string;
  domain?: MemoryDomain;
  type?: MemoryType;
  limit?: number;
}): string[] {
  const limit = Math.max(1, input.limit ?? 4);
  const scored = new Map<string, number>();
  const addCandidate = (raw: string, weight: number) => {
    const normalized = normalizeMemoryTagCandidate(raw);
    if (!normalized) return;
    scored.set(normalized, (scored.get(normalized) ?? 0) + weight);
  };

  const collect = (text: string, baseWeight: number) => {
    if (!text.trim()) return;
    const chineseTerms = text.match(/[\p{Script=Han}]{2,8}/gu) ?? [];
    const englishTerms = text.match(/\b[a-zA-Z][a-zA-Z0-9.+-]{2,23}\b/g) ?? [];
    chineseTerms.forEach((term) => addCandidate(term, baseWeight));
    englishTerms.forEach((term) => addCandidate(term, baseWeight));
  };

  collect(input.title, 3);
  collect(input.content, 1);

  return [...scored.entries()]
    .sort((left, right) => (right[1] !== left[1] ? right[1] - left[1] : left[0].localeCompare(right[0], 'zh-CN')))
    .slice(0, limit)
    .map(([tag]) => tag);
}

export function sanitizeMemoryTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter((tag) => tag && !LEGACY_MEMORY_PLACEHOLDER_TAGS.has(tag)),
    ),
  );
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
      ? sanitizeMemoryTags(raw.tags)
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
    importance: '中',
    sourceType: SOURCE_OPTIONS.includes(raw.sourceType as MemorySourceType)
      ? (raw.sourceType as MemorySourceType)
      : '导入',
    sourceLabel:
      typeof raw.sourceLabel === 'string' && raw.sourceLabel.trim() ? raw.sourceLabel.trim() : '本地 JSON 导入',
    tags: tags.length > 0 ? tags : generateMemoryTags({ title, content }),
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
