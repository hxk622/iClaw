import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileUp,
  Filter,
  GitMerge,
  History,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  ShieldCheck,
  Tag,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react';
import { cn } from '@/app/lib/cn';
import {
  archiveMemoryEntry,
  deleteMemoryEntry as deleteMemoryEntryRecord,
  loadMemorySnapshot,
  reindexMemory,
  saveMemoryEntry as persistMemoryEntry,
  type MemoryRuntimeStatus,
} from '@/app/lib/tauri-memory';

type MemoryDomain = '财经' | '产品' | '个人' | '项目' | '研究' | '其他';
type MemoryType = '偏好' | '事实' | '决策' | '实体' | '其他';
type MemoryImportance = '高' | '中' | '低';
type MemorySourceType = '手动创建' | '自动捕获' | '导入' | '对话沉淀';
type MemoryStatus = '已确认' | '待检查';

type MemoryEntry = {
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

type MemoryFilters = {
  domains: MemoryDomain[];
  types: MemoryType[];
  tags: string[];
  importance: MemoryImportance[];
  sourceTypes: MemorySourceType[];
  recalledState: Array<'最近被召回' | '从未召回'>;
  onlyAutoCaptured: boolean;
  onlyHighImportance: boolean;
};

type MemoryEditDraft = {
  title: string;
  content: string;
  domain: MemoryDomain;
  type: MemoryType;
  importance: MemoryImportance;
  status: MemoryStatus;
  tags: string[];
  sourceLabel: string;
};

const DOMAIN_OPTIONS: MemoryDomain[] = ['财经', '产品', '个人', '项目', '研究', '其他'];
const TYPE_OPTIONS: MemoryType[] = ['偏好', '事实', '决策', '实体', '其他'];
const IMPORTANCE_OPTIONS: MemoryImportance[] = ['高', '中', '低'];
const SOURCE_OPTIONS: MemorySourceType[] = ['手动创建', '自动捕获', '导入', '对话沉淀'];
const RECALL_OPTIONS: Array<'最近被召回' | '从未召回'> = ['最近被召回', '从未召回'];
const EMPTY_FILTERS: MemoryFilters = {
  domains: [],
  types: [],
  tags: [],
  importance: [],
  sourceTypes: [],
  recalledState: [],
  onlyAutoCaptured: false,
  onlyHighImportance: false,
};

const DOMAIN_SURFACE: Record<MemoryDomain, string> = {
  财经: 'bg-[#e8f5e9] text-[#2e7d32]',
  产品: 'bg-[#e3f2fd] text-[#1565c0]',
  个人: 'bg-[#fce4ec] text-[#c2185b]',
  项目: 'bg-[#fff3e0] text-[#e65100]',
  研究: 'bg-[#f3e5f5] text-[#6a1b9a]',
  其他: 'bg-[#f5f5f5] text-[#616161]',
};

const TYPE_SURFACE: Record<MemoryType, string> = {
  偏好: 'bg-[#e8eaf6] text-[#3f51b5]',
  事实: 'bg-[#e0f2f1] text-[#00796b]',
  决策: 'bg-[#fff8e1] text-[#f57f17]',
  实体: 'bg-[#fbe9e7] text-[#d84315]',
  其他: 'bg-[#f5f5f5] text-[#616161]',
};

function toggleValue<T>(current: T[], value: T) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function formatRecallState(entry: MemoryEntry): '最近被召回' | '从未召回' {
  return entry.recallCount > 0 ? '最近被召回' : '从未召回';
}

function deriveRelatedEntries(entries: MemoryEntry[], target: MemoryEntry | null) {
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

function createEditDraft(entry: MemoryEntry): MemoryEditDraft {
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

function todayStamp() {
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

function createMemoryId() {
  return `memory-${Math.random().toString(36).slice(2, 10)}`;
}

function createMemorySummary(content: string, fallback: string) {
  const normalized = content.trim().replace(/\s+/g, ' ');
  return normalized.slice(0, 58) || fallback;
}

function normalizeImportedEntry(value: unknown): MemoryEntry | null {
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

export function MemoryView() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<MemoryFilters>(EMPTY_FILTERS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MemoryEditDraft | null>(null);
  const [tagInput, setTagInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<MemoryRuntimeStatus | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [memoryDir, setMemoryDir] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const reloadSnapshot = async () => {
    setLoading(true);
    try {
      const snapshot = await loadMemorySnapshot();
      if (!snapshot) {
        setEntries([]);
        setRuntimeStatus(null);
        setRuntimeError('当前不是桌面运行环境，无法读取真实记忆。');
        return;
      }
      setEntries(snapshot.entries as MemoryEntry[]);
      setRuntimeStatus(snapshot.runtimeStatus ?? null);
      setRuntimeError(snapshot.runtimeError ?? null);
      setMemoryDir(snapshot.memoryDir);
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : '读取真实记忆失败');
      setEntries([]);
      setRuntimeStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reloadSnapshot();
  }, []);

  const activeEntries = useMemo(() => entries.filter((entry) => entry.active), [entries]);
  const availableTags = useMemo(
    () =>
      Array.from(new Set(activeEntries.flatMap((entry) => entry.tags)))
        .sort((left, right) => left.localeCompare(right, 'zh-CN')),
    [activeEntries],
  );

  const filteredEntries = useMemo(() => {
    return activeEntries.filter((entry) => {
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const matchesQuery =
          entry.title.toLowerCase().includes(query) ||
          entry.summary.toLowerCase().includes(query) ||
          entry.content.toLowerCase().includes(query) ||
          entry.tags.some((tag) => tag.toLowerCase().includes(query));
        if (!matchesQuery) return false;
      }

      if (filters.domains.length > 0 && !filters.domains.includes(entry.domain)) return false;
      if (filters.types.length > 0 && !filters.types.includes(entry.type)) return false;
      if (filters.tags.length > 0 && !filters.tags.every((tag) => entry.tags.includes(tag))) return false;
      if (filters.importance.length > 0 && !filters.importance.includes(entry.importance)) return false;
      if (filters.sourceTypes.length > 0 && !filters.sourceTypes.includes(entry.sourceType)) return false;
      if (filters.recalledState.length > 0 && !filters.recalledState.includes(formatRecallState(entry))) return false;
      if (filters.onlyAutoCaptured && entry.sourceType !== '自动捕获') return false;
      if (filters.onlyHighImportance && entry.importance !== '高') return false;

      return true;
    });
  }, [activeEntries, filters, searchQuery]);

  useEffect(() => {
    if (filteredEntries.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId && !filteredEntries.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredEntries, selectedId]);

  const selectedEntry = filteredEntries.find((entry) => entry.id === selectedId) ?? null;
  const relatedEntries = useMemo(() => deriveRelatedEntries(activeEntries, selectedEntry), [activeEntries, selectedEntry]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    filters.domains.length > 0 ||
    filters.types.length > 0 ||
    filters.tags.length > 0 ||
    filters.importance.length > 0 ||
    filters.sourceTypes.length > 0 ||
    filters.recalledState.length > 0 ||
    filters.onlyAutoCaptured ||
    filters.onlyHighImportance;

  const statusSummary = useMemo(() => {
    const total = activeEntries.length;
    const autoCaptured = activeEntries.filter((entry) => entry.sourceType === '自动捕获').length;
    const recalled = activeEntries.filter((entry) => entry.recallCount > 0).length;
    const pendingReview = activeEntries.filter((entry) => entry.status === '待检查').length;
    const unhealthy =
      runtimeStatus?.dirty === true
        ? 1
        : activeEntries.filter((entry) => entry.indexHealth !== '健康').length;
    const totalRecalls = activeEntries.reduce((sum, entry) => sum + entry.recallCount, 0);
    return {
      total,
      autoCaptured,
      recalled,
      pendingReview,
      totalRecalls,
      indexedFiles: runtimeStatus?.files ?? total,
      indexedChunks: runtimeStatus?.chunks ?? 0,
      indexHealth: unhealthy === 0 ? '健康' : '待刷新',
    };
  }, [activeEntries, runtimeStatus]);

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of activeEntries) {
      for (const tag of entry.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5);
  }, [activeEntries]);

  const handleToggleFilter = <K extends keyof MemoryFilters>(key: K, value: MemoryFilters[K][number]) => {
    setFilters((current) => ({
      ...current,
      [key]: toggleValue(current[key] as Array<MemoryFilters[K][number]>, value),
    }));
  };

  const handleStartEdit = (entry: MemoryEntry) => {
    setEditingId(entry.id);
    setDraft(createEditDraft(entry));
    setTagInput('');
  };

  const handleSaveEdit = async () => {
    if (!selectedEntry || !draft) return;
    const nextEntry: MemoryEntry = {
      ...selectedEntry,
      title: draft.title.trim() || selectedEntry.title,
      summary: createMemorySummary(draft.content, selectedEntry.summary),
      content: draft.content.trim() || selectedEntry.content,
      domain: draft.domain,
      type: draft.type,
      importance: draft.importance,
      status: draft.status,
      tags: draft.tags,
      sourceLabel: draft.sourceLabel.trim() || selectedEntry.sourceLabel,
      updatedAt: todayStamp(),
      indexHealth: '待刷新',
    };

    setMutating(true);
    try {
      await persistMemoryEntry(nextEntry);
      setSelectedId(nextEntry.id);
      setEditingId(null);
      setDraft(null);
      setTagInput('');
      await reloadSnapshot();
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : '保存记忆失败');
    } finally {
      setMutating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setTagInput('');
  };

  const handleCreateMemory = async () => {
    const now = todayStamp();
    const nextEntry: MemoryEntry = {
      id: createMemoryId(),
      title: '新记忆',
      summary: '等待补充内容和标签',
      content: '',
      domain: '其他',
      type: '事实',
      importance: '中',
      sourceType: '手动创建',
      sourceLabel: '控制台手动创建',
      tags: ['待整理'],
      createdAt: now,
      updatedAt: now,
      lastRecalledAt: null,
      recallCount: 0,
      captureConfidence: 1,
      indexHealth: '同步中',
      status: '待检查',
      active: true,
    };

    setMutating(true);
    try {
      await persistMemoryEntry(nextEntry);
      await reloadSnapshot();
      setSelectedId(nextEntry.id);
      setEditingId(nextEntry.id);
      setDraft(createEditDraft(nextEntry));
      setTagInput('');
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : '创建记忆失败');
    } finally {
      setMutating(false);
    }
  };

  const handleRefreshIndex = async () => {
    setMutating(true);
    try {
      await reindexMemory(true);
      await reloadSnapshot();
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : '刷新索引失败');
      await reloadSnapshot();
    } finally {
      setMutating(false);
    }
  };

  const handleExport = () => {
    const payload = JSON.stringify(activeEntries, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `iclaw-memory-${todayStamp().replace(/[\s:]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const rawItems = Array.isArray(parsed) ? parsed : [parsed];
      const importedEntries = rawItems
        .map((item) => normalizeImportedEntry(item))
        .filter((item): item is MemoryEntry => item !== null);

      if (importedEntries.length === 0) return;
      setMutating(true);
      const dedupedImports = importedEntries.map((entry) =>
        entries.some((current) => current.id === entry.id) ? { ...entry, id: createMemoryId(), updatedAt: todayStamp() } : entry,
      );
      for (const entry of dedupedImports) {
        await persistMemoryEntry(entry);
      }
      await reloadSnapshot();
      setSelectedId(dedupedImports[0]?.id ?? null);
      setEditingId(null);
      setDraft(null);
    } finally {
      setMutating(false);
      event.target.value = '';
    }
  };

  const handleAddTagToDraft = () => {
    if (!draft) return;
    const next = tagInput.trim();
    if (!next || draft.tags.includes(next)) return;
    setDraft({ ...draft, tags: [...draft.tags, next] });
    setTagInput('');
  };

  const handleMergeSelected = async () => {
    if (!selectedEntry || relatedEntries.length === 0) return;
    const candidate = relatedEntries[0];
    const mergedEntry: MemoryEntry = {
      ...selectedEntry,
      content: `${selectedEntry.content}\n\n[合并补充]\n${candidate.content}`.trim(),
      summary: createMemorySummary(`${selectedEntry.summary} ${candidate.summary}`, selectedEntry.title),
      tags: Array.from(new Set([...selectedEntry.tags, ...candidate.tags])),
      recallCount: selectedEntry.recallCount + candidate.recallCount,
      updatedAt: todayStamp(),
      status: '已确认',
      indexHealth: '待刷新',
    };

    setMutating(true);
    try {
      await persistMemoryEntry(mergedEntry);
      await deleteMemoryEntryRecord(candidate.id);
      await reloadSnapshot();
      setSelectedId(mergedEntry.id);
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : '合并记忆失败');
    } finally {
      setMutating(false);
    }
  };

  const handleForgetSelected = async () => {
    if (!selectedEntry) return;
    setMutating(true);
    try {
      await archiveMemoryEntry(selectedEntry.id);
      setSelectedId(null);
      setEditingId(null);
      setDraft(null);
      await reloadSnapshot();
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : '归档记忆失败');
    } finally {
      setMutating(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedEntry) return;
    setMutating(true);
    try {
      await deleteMemoryEntryRecord(selectedEntry.id);
      setSelectedId(null);
      setEditingId(null);
      setDraft(null);
      await reloadSnapshot();
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : '删除记忆失败');
    } finally {
      setMutating(false);
    }
  };

  const handleMarkConfirmed = async () => {
    if (!selectedEntry) return;
    setMutating(true);
    try {
      await persistMemoryEntry({
        ...selectedEntry,
        status: '已确认',
        updatedAt: todayStamp(),
        indexHealth: '待刷新',
      });
      await reloadSnapshot();
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : '更新记忆状态失败');
    } finally {
      setMutating(false);
    }
  };

  const emptyState = (
    <div className="flex flex-1 items-center justify-center px-8">
      <div className="max-w-[420px] text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(59,130,246,0.10)] text-[var(--brand-primary)]">
          {hasActiveFilters ? <SearchX className="h-7 w-7" /> : <BookOpen className="h-7 w-7" />}
        </div>
        <div className="text-[20px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
          {hasActiveFilters ? '没有找到匹配的记忆' : '还没有可展示的记忆'}
        </div>
        <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">
          {hasActiveFilters
            ? '试着放宽标签、来源或召回状态筛选，或者改用更宽泛的关键词。'
            : memoryDir
              ? `当前真实记忆目录是 ${memoryDir}。这里现在为空，说明还没有落盘的记忆文件。`
              : '当前还没有读取到真实记忆目录。'}
        </p>
        {runtimeError ? <p className="mt-3 text-[12px] leading-6 text-[rgb(180,100,24)]">{runtimeError}</p> : null}
        {hasActiveFilters ? (
          <div className="mt-5">
            <DrawerSecondaryButton
              onClick={() => {
                setSearchQuery('');
                setFilters(EMPTY_FILTERS);
              }}
            >
              清除全部筛选
            </DrawerSecondaryButton>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-1 overflow-hidden bg-[var(--bg-page)]">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-[var(--border-default)] bg-[rgba(255,255,255,0.82)] px-8 pb-6 pt-8 backdrop-blur dark:bg-[rgba(10,10,10,0.82)]">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-medium tracking-[-0.03em] text-[#1d1d1f] dark:text-[var(--text-primary)]">记忆</h1>
              <p className="mt-1 text-[14px] text-[#6e6e73] dark:text-[var(--text-secondary)]">AI 的长期记忆与标签化管理</p>
            </div>
            <div className="flex items-center gap-2">
              <HeaderIconButton onClick={handleRefreshIndex} label="刷新索引" disabled={mutating}>
                <RefreshCw className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </HeaderIconButton>
              <HeaderIconButton onClick={handleExport} label="导出" disabled={loading || mutating}>
                <Download className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </HeaderIconButton>
              <HeaderIconButton onClick={handleImportClick} label="导入" disabled={mutating}>
                <FileUp className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </HeaderIconButton>
              <HeaderPrimaryButton onClick={handleCreateMemory} disabled={mutating}>
                <Plus className="h-[18px] w-[18px]" strokeWidth={1.5} />
                <span className="text-sm">新建记忆</span>
              </HeaderPrimaryButton>
            </div>
          </div>

          <label className="relative block max-w-[560px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索记忆、标签、来源……"
              className="w-full rounded-[16px] border border-transparent bg-[var(--bg-hover)] py-3 pl-10 pr-4 text-[14px] text-[var(--text-primary)] outline-none transition-all duration-[var(--motion-panel)] placeholder:text-[var(--text-muted)] focus:border-[rgba(59,130,246,0.22)] focus:bg-[var(--bg-elevated)]"
              style={{ transitionTimingFunction: 'var(--motion-spring)' }}
            />
          </label>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            void handleImportFile(event);
          }}
        />

        <div className="border-b border-[var(--border-default)] bg-[rgba(250,250,250,0.9)] px-8 py-4 text-[12px] dark:bg-[rgba(20,20,20,0.86)]">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-secondary)]">记忆引擎:</span>
              <span className="text-[var(--text-primary)]">{runtimeStatus?.backend === 'builtin' ? 'Builtin' : 'LanceDB'}</span>
            </div>
            <div className="h-4 w-px bg-[var(--border-default)]" />
            <div className="flex items-center gap-2">
              <WandSparkles className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-secondary)]">最近召回:</span>
              <span className="text-[var(--text-primary)]">{statusSummary.totalRecalls} 次</span>
            </div>
            <div className="h-4 w-px bg-[var(--border-default)]" />
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-secondary)]">自动捕获:</span>
              <span className="text-[var(--text-primary)]">{statusSummary.autoCaptured} 条</span>
            </div>
            <div className="h-4 w-px bg-[var(--border-default)]" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-secondary)]">索引状态:</span>
              <span className={cn('text-[var(--text-primary)]', (runtimeStatus?.dirty || statusSummary.pendingReview > 0) && 'text-[rgb(180,100,24)]')}>
                {statusSummary.indexHealth}
              </span>
            </div>
            {runtimeError ? (
              <>
                <div className="h-4 w-px bg-[var(--border-default)]" />
                <div className="flex items-center gap-2 text-[rgb(180,100,24)]">
                  <span>runtime:</span>
                  <span className="max-w-[360px] truncate">{runtimeError}</span>
                </div>
              </>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              <Tag className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-secondary)]">高频:</span>
              <div className="flex gap-1.5">
                {topTags.slice(0, 3).map(([tag]) => (
                  <span key={tag} className="text-[var(--text-primary)]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)] px-8 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <FilterGroup label="领域">
              {DOMAIN_OPTIONS.map((domain) => (
                <FilterChip
                  key={domain}
                  active={filters.domains.includes(domain)}
                  onClick={() => handleToggleFilter('domains', domain)}
                >
                  {domain}
                </FilterChip>
              ))}
            </FilterGroup>
            <div className="hidden h-6 w-px bg-[var(--border-default)] xl:block" />
            <FilterGroup label="类型">
              {TYPE_OPTIONS.map((type) => (
                <FilterChip
                  key={type}
                  active={filters.types.includes(type)}
                  onClick={() => handleToggleFilter('types', type)}
                >
                  {type}
                </FilterChip>
              ))}
            </FilterGroup>
            <div className="hidden h-6 w-px bg-[var(--border-default)] xl:block" />
            <FilterGroup label="重要性">
              {IMPORTANCE_OPTIONS.map((importance) => (
                <FilterChip
                  key={importance}
                  active={filters.importance.includes(importance)}
                  onClick={() => handleToggleFilter('importance', importance)}
                >
                  {importance}
                </FilterChip>
              ))}
            </FilterGroup>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
            <FilterGroup label="来源">
              {SOURCE_OPTIONS.map((source) => (
                <FilterChip
                  key={source}
                  active={filters.sourceTypes.includes(source)}
                  onClick={() => handleToggleFilter('sourceTypes', source)}
                >
                  {source}
                </FilterChip>
              ))}
            </FilterGroup>
            <div className="hidden h-6 w-px bg-[var(--border-default)] xl:block" />
            <FilterGroup label="标签">
              {availableTags.slice(0, 6).map((tag) => (
                <FilterChip
                  key={tag}
                  active={filters.tags.includes(tag)}
                  onClick={() => handleToggleFilter('tags', tag)}
                >
                  {tag}
                </FilterChip>
              ))}
            </FilterGroup>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {RECALL_OPTIONS.map((state) => (
                <FilterChip
                  key={state}
                  active={filters.recalledState.includes(state)}
                  onClick={() => handleToggleFilter('recalledState', state)}
                >
                  {state}
                </FilterChip>
              ))}
              <FilterChip
                active={filters.onlyAutoCaptured}
                onClick={() => setFilters((current) => ({ ...current, onlyAutoCaptured: !current.onlyAutoCaptured }))}
              >
                仅自动捕获
              </FilterChip>
              <FilterChip
                active={filters.onlyHighImportance}
                onClick={() => setFilters((current) => ({ ...current, onlyHighImportance: !current.onlyHighImportance }))}
              >
                仅高重要性
              </FilterChip>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setSearchQuery('');
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <X className="h-3.5 w-3.5" />
                  清除
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="flex min-h-full flex-col">
            <div className="border-b border-[var(--border-default)] px-8 py-4">
              <div className="flex items-center justify-between">
                <div className="text-[13px] text-[var(--text-secondary)]">
                  当前显示 <span className="font-medium text-[var(--text-primary)]">{filteredEntries.length}</span> / {statusSummary.total} 条记忆
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f7] px-3 py-1 text-xs text-[#6e6e73] dark:bg-[rgba(255,255,255,0.06)] dark:text-[var(--text-secondary)]">
                  <Filter className="h-3.5 w-3.5" />
                  标签与来源已进入筛选
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-1 items-center justify-center px-8 py-16">
                <div className="text-center text-[13px] text-[var(--text-secondary)]">正在读取真实记忆…</div>
              </div>
            ) : filteredEntries.length === 0 ? (
              emptyState
            ) : (
              <div className="divide-y divide-[var(--border-default)]">
                {filteredEntries.map((entry) => {
                  const selected = entry.id === selectedId;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelectedId(entry.id)}
                      className={cn(
                        'w-full cursor-pointer px-8 py-5 text-left transition-all duration-[var(--motion-panel)] hover:bg-[rgba(15,23,42,0.03)] dark:hover:bg-[rgba(255,255,255,0.03)]',
                        selected && 'bg-[rgba(15,23,42,0.04)] dark:bg-[rgba(255,255,255,0.05)]',
                      )}
                      style={{ transitionTimingFunction: 'var(--motion-spring)' }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <p className="text-[15px] font-medium text-[var(--text-primary)]">{entry.summary}</p>
                          </div>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <MetaBadge className={DOMAIN_SURFACE[entry.domain]}>{entry.domain}</MetaBadge>
                            <MetaBadge className={TYPE_SURFACE[entry.type]}>{entry.type}</MetaBadge>
                            {entry.tags.slice(0, 3).map((tag) => (
                              <MetaBadge key={tag} className="bg-[#f0f0f5] text-[#6e6e73] dark:bg-[rgba(255,255,255,0.06)] dark:text-[var(--text-secondary)]">
                                {tag}
                              </MetaBadge>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--text-muted)]">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className={cn('h-3.5 w-3.5', entry.status === '已确认' ? 'text-[rgb(21,128,61)]' : 'text-[rgb(180,100,24)]')} />
                              <span>{entry.status}</span>
                            </div>
                            <span>•</span>
                            <span>{entry.sourceType}</span>
                            {entry.lastRecalledAt ? (
                              <>
                                <span>•</span>
                                <span>召回: {entry.lastRecalledAt}</span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex min-w-[120px] flex-col items-end gap-2">
                          <MetaBadge
                            className={
                              entry.importance === '高'
                                ? 'bg-[#fff3e0] text-[#e65100]'
                                : entry.importance === '中'
                                  ? 'bg-[#fff8e1] text-[#f57f17]'
                                  : 'bg-[#f5f5f5] text-[#616161]'
                            }
                          >
                            {entry.importance}重要性
                          </MetaBadge>
                          <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                            <Clock3 className="h-3.5 w-3.5" />
                            <span>{entry.createdAt}</span>
                          </div>
                          {entry.recallCount > 0 ? (
                            <div className="text-[12px] text-[var(--brand-primary)]">{entry.recallCount} 次召回</div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'absolute inset-0 z-20 bg-[rgba(15,23,42,0.18)] transition-opacity duration-200 ease-out',
          selectedEntry ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => {
          setSelectedId(null);
          setEditingId(null);
          setDraft(null);
        }}
      />

      <div
        className={cn(
          'absolute inset-y-0 right-0 z-30 w-[min(624px,calc(100vw-80px))] border-l border-[var(--border-default)] bg-[rgba(250,250,250,0.96)] shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-transform duration-200 ease-out dark:bg-[rgba(18,18,18,0.96)]',
          selectedEntry ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <MemoryInspector
          entry={selectedEntry}
          relatedEntries={relatedEntries}
          editing={selectedEntry ? editingId === selectedEntry.id : false}
          draft={draft}
          tagInput={tagInput}
          setTagInput={setTagInput}
          onDraftChange={setDraft}
          onStartEdit={() => {
            if (selectedEntry) handleStartEdit(selectedEntry);
          }}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          onAddTag={handleAddTagToDraft}
          onRemoveDraftTag={(tag) => {
            if (!draft) return;
            setDraft({ ...draft, tags: draft.tags.filter((item) => item !== tag) });
          }}
          onMarkConfirmed={handleMarkConfirmed}
          onMerge={handleMergeSelected}
          onForget={handleForgetSelected}
          onDelete={handleDeleteSelected}
          onSelectRelated={setSelectedId}
          onClose={() => {
            setSelectedId(null);
            setEditingId(null);
            setDraft(null);
          }}
        />
      </div>
    </div>
  );
}

function HeaderIconButton({
  children,
  label,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer rounded-lg p-2 text-[#6e6e73] transition-all duration-200 hover:bg-[#f0f0f5] hover:text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[var(--text-secondary)] dark:hover:bg-[rgba(255,255,255,0.06)] dark:hover:text-[var(--text-primary)]"
    >
      {children}
    </button>
  );
}

function HeaderPrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#007aff] px-4 py-2 text-white transition-all duration-200 hover:bg-[#0051d5] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function FilterChip({
  children,
  active = false,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-full px-3 py-1.5 text-xs transition-all duration-200',
        active ? 'bg-[#007aff] text-white' : 'bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e8e8ed]',
      )}
    >
      {children}
    </button>
  );
}

function MetaBadge({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return <span className={cn('rounded px-2 py-0.5 text-xs', className)}>{children}</span>;
}

function DrawerPrimaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 cursor-pointer rounded-lg bg-[#007aff] px-4 py-2.5 text-sm text-white transition-all duration-200 hover:bg-[#0051d5]"
    >
      {children}
    </button>
  );
}

function DrawerConfirmButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#34c759] px-4 py-2.5 text-sm text-white transition-all duration-200 hover:bg-[#2da84a]"
    >
      {children}
    </button>
  );
}

function DrawerSecondaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#d1d1d6] bg-white px-4 py-2.5 text-sm text-[#1d1d1f] transition-all duration-200 hover:bg-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[rgba(255,255,255,0.12)] dark:bg-[rgba(255,255,255,0.03)] dark:text-[var(--text-primary)] dark:hover:bg-[rgba(255,255,255,0.06)]"
    >
      {children}
    </button>
  );
}

function DrawerDangerButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ffd6d6] bg-[#fff5f5] px-4 py-2.5 text-sm text-[#c62828] transition-all duration-200 hover:bg-[#ffecec] dark:border-[rgba(248,113,113,0.18)] dark:bg-[rgba(239,68,68,0.10)] dark:text-[#fecaca] dark:hover:bg-[rgba(239,68,68,0.16)]"
    >
      {children}
    </button>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-[28px] text-[12px] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function MemoryInspector({
  entry,
  relatedEntries,
  editing,
  draft,
  tagInput,
  setTagInput,
  onDraftChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onAddTag,
  onRemoveDraftTag,
  onMarkConfirmed,
  onMerge,
  onForget,
  onDelete,
  onSelectRelated,
  onClose,
}: {
  entry: MemoryEntry | null;
  relatedEntries: MemoryEntry[];
  editing: boolean;
  draft: MemoryEditDraft | null;
  tagInput: string;
  setTagInput: (value: string) => void;
  onDraftChange: Dispatch<SetStateAction<MemoryEditDraft | null>>;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onAddTag: () => void;
  onRemoveDraftTag: (tag: string) => void;
  onMarkConfirmed: () => void;
  onMerge: () => void;
  onForget: () => void;
  onDelete: () => void;
  onSelectRelated: (id: string) => void;
  onClose: () => void;
}) {
  if (!entry) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-hover)] text-[var(--text-secondary)]">
            <BookOpen className="h-7 w-7" />
          </div>
          <p className="text-[14px] text-[var(--text-secondary)]">选择一条记忆查看详情</p>
        </div>
      </div>
    );
  }

  const view = editing && draft ? draft : entry;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border-default)] px-6 py-4">
        <div>
          <div className="text-[14px] text-[var(--text-primary)]">记忆详情</div>
          <div className="mt-1 text-[12px] text-[var(--text-muted)]">点击外部区域或右上角可关闭</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-full p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{entry.title}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
              <MetaBadge className={DOMAIN_SURFACE[view.domain]}>{view.domain}</MetaBadge>
              <MetaBadge className={TYPE_SURFACE[view.type]}>{view.type}</MetaBadge>
              <MetaBadge className={entry.status === '已确认' ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#fff8e1] text-[#f57f17]'}>
                {entry.status}
              </MetaBadge>
            </div>
          </div>
          {!editing ? (
            <DrawerSecondaryButton onClick={onStartEdit}>
              <PencilLine className="h-4 w-4" />
              <span>编辑</span>
            </DrawerSecondaryButton>
          ) : null}
        </div>

        <div className="space-y-6">
          <InspectorSection label="内容">
          {editing && draft ? (
            <div className="space-y-3">
              <input
                value={draft.title}
                onChange={(event) => onDraftChange((current) => (current ? { ...current, title: event.target.value } : current))}
                className="w-full rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-[15px] text-[var(--text-primary)] outline-none"
              />
              <textarea
                value={draft.content}
                onChange={(event) => onDraftChange((current) => (current ? { ...current, content: event.target.value } : current))}
                className="min-h-[180px] w-full rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-[14px] leading-7 text-[var(--text-primary)] outline-none"
              />
            </div>
          ) : (
            <p className="text-[14px] leading-7 text-[var(--text-primary)]">{entry.content}</p>
          )}
          </InspectorSection>

          <InspectorSection label="标签与分类">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MetaBadge className={view.importance === '高' ? 'bg-[#fff3e0] text-[#e65100]' : view.importance === '中' ? 'bg-[#fff8e1] text-[#f57f17]' : 'bg-[#f5f5f5] text-[#616161]'}>
                  {view.importance}重要性
                </MetaBadge>
              </div>
              <div className="flex flex-wrap gap-2">
                {view.tags.map((tag) => (
                  <MetaBadge key={tag} className="bg-[#f0f0f5] text-[#6e6e73] dark:bg-[rgba(255,255,255,0.06)] dark:text-[var(--text-secondary)]">
                    {tag}
                    {editing ? (
                      <button type="button" className="ml-1 cursor-pointer text-[var(--text-muted)]" onClick={() => onRemoveDraftTag(tag)}>
                        ×
                      </button>
                    ) : null}
                  </MetaBadge>
                ))}
              </div>
              {editing && draft ? (
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        onAddTag();
                      }
                    }}
                  placeholder="新增标签"
                  className="flex-1 rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none"
                />
                <DrawerSecondaryButton onClick={onAddTag}>添加</DrawerSecondaryButton>
              </div>
            ) : null}
              {editing && draft ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField label="领域" value={draft.domain} options={DOMAIN_OPTIONS} onChange={(value) => onDraftChange((current) => (current ? { ...current, domain: value as MemoryDomain } : current))} />
                  <SelectField label="类型" value={draft.type} options={TYPE_OPTIONS} onChange={(value) => onDraftChange((current) => (current ? { ...current, type: value as MemoryType } : current))} />
                  <SelectField label="重要性" value={draft.importance} options={IMPORTANCE_OPTIONS} onChange={(value) => onDraftChange((current) => (current ? { ...current, importance: value as MemoryImportance } : current))} />
                  <SelectField label="状态" value={draft.status} options={['已确认', '待检查']} onChange={(value) => onDraftChange((current) => (current ? { ...current, status: value as MemoryStatus } : current))} />
                </div>
              ) : null}
            </div>
          </InspectorSection>

          <InspectorSection label="来源与召回">
            <div className="space-y-3 text-[13px] text-[var(--text-secondary)]">
              <InfoRow label="来源类型" value={entry.sourceType} />
              <InfoRow label="来源说明" value={editing && draft ? draft.sourceLabel : entry.sourceLabel} />
              <InfoRow label="创建时间" value={entry.createdAt} />
              <InfoRow label="更新时间" value={entry.updatedAt} />
              <InfoRow label="最近召回" value={entry.lastRecalledAt ?? '从未召回'} />
              <InfoRow label="召回次数" value={`${entry.recallCount} 次`} />
              <InfoRow label="捕获置信度" value={`${Math.round(entry.captureConfidence * 100)}%`} />
              <InfoRow label="索引状态" value={entry.indexHealth} />
              {editing && draft ? (
                <input
                  value={draft.sourceLabel}
                  onChange={(event) => onDraftChange((current) => (current ? { ...current, sourceLabel: event.target.value } : current))}
                  className="w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none"
                />
              ) : null}
            </div>
          </InspectorSection>

          <InspectorSection label="相关记忆">
            <div className="space-y-2">
              {relatedEntries.length > 0 ? (
                relatedEntries.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectRelated(item.id)}
                    className="w-full cursor-pointer rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-3 text-left transition-all duration-[var(--motion-panel)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
                    style={{ transitionTimingFunction: 'var(--motion-spring)' }}
                  >
                    <div className="text-[13px] font-medium text-[var(--text-primary)]">{item.title}</div>
                    <div className="mt-1 text-[12px] leading-6 text-[var(--text-secondary)]">{item.summary}</div>
                  </button>
                ))
              ) : (
                <div className="rounded-[16px] border border-dashed border-[var(--border-default)] px-3 py-4 text-[12px] text-[var(--text-secondary)]">
                  当前没有足够接近的候选记忆。
                </div>
              )}
            </div>
          </InspectorSection>
        </div>
      </div>

      <div className="space-y-2 border-t border-[var(--border-default)] px-6 py-4">
        {editing ? (
          <div className="flex gap-2">
            <DrawerPrimaryButton onClick={onSaveEdit}>保存修改</DrawerPrimaryButton>
            <DrawerSecondaryButton onClick={onCancelEdit}>取消</DrawerSecondaryButton>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <DrawerConfirmButton onClick={onMarkConfirmed}>
                <CheckCircle2 className="h-4 w-4" />
                <span>标记为已确认</span>
              </DrawerConfirmButton>
              <DrawerSecondaryButton onClick={onMerge} disabled={relatedEntries.length === 0}>
                <GitMerge className="h-4 w-4" />
                <span>合并</span>
              </DrawerSecondaryButton>
            </div>
            <div className="flex gap-2">
              <DrawerSecondaryButton onClick={onForget}>
                <Clock3 className="h-4 w-4" />
                <span>忘记</span>
              </DrawerSecondaryButton>
              <DrawerDangerButton onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                <span>删除</span>
              </DrawerDangerButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InspectorSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 text-[12px] text-[var(--text-muted)]">{label}</div>
      {children}
    </section>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="max-w-[220px] text-right text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <div className="text-[12px] text-[var(--text-muted)]">{label}</div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
