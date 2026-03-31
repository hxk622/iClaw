import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { PageContent, PageSurface } from '@/app/components/ui/PageLayout';
import { searchMemoryEntries, sortMemoryEntriesForDisplay } from '@/app/lib/memory-recall';
import {
  archiveMemoryEntry,
  deleteMemoryEntry as deleteMemoryEntryRecord,
  loadMemorySnapshot,
  reindexMemory,
  saveMemoryEntry as persistMemoryEntry,
  type MemoryRuntimeStatus,
} from '@/app/lib/tauri-memory';
import { MemoryDetailDrawer } from './MemoryDetailDrawer';
import { MemoryFilterBar } from './MemoryFilterBar';
import { MemoryHeader } from './MemoryHeader';
import { MemoryListPanel } from './MemoryListPanel';
import { MemoryStatusBar } from './MemoryStatusBar';
import {
  createEditDraft,
  createMemoryId,
  createMemorySummary,
  deriveRelatedEntries,
  EMPTY_FILTERS,
  formatRecallState,
  matchesTimeRange,
  normalizeImportedEntry,
  parseMemoryDate,
  toggleValue,
  todayStamp,
  type MemoryArrayFilterKey,
  type MemoryEditDraft,
  type MemoryEntry,
  type MemoryFilters,
  type MemoryStatusSummary,
} from './model';

export function MemoryView({ title }: { title: string }) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<MemoryFilters>(EMPTY_FILTERS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MemoryEditDraft | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [runtimeStatus, setRuntimeStatus] = useState<MemoryRuntimeStatus | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [memoryDir, setMemoryDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reloadSnapshot = async () => {
    setLoading(true);
    try {
      const snapshot = await loadMemorySnapshot();
      if (!snapshot) {
        setEntries([]);
        setRuntimeStatus(null);
        setRuntimeError('当前不是桌面运行环境，无法读取真实记忆。');
        setMemoryDir('');
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
      setMemoryDir('');
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
      Array.from(new Set(activeEntries.flatMap((entry) => entry.tags))).sort((left, right) =>
        left.localeCompare(right, 'zh-CN'),
      ),
    [activeEntries],
  );

  const baseFilteredEntries = useMemo(() => {
    return activeEntries.filter((entry) => {
      if (filters.domains.length > 0 && !filters.domains.includes(entry.domain)) return false;
      if (filters.types.length > 0 && !filters.types.includes(entry.type)) return false;
      if (filters.tags.length > 0 && !filters.tags.some((tag) => entry.tags.includes(tag))) return false;
      if (filters.importance.length > 0 && !filters.importance.includes(entry.importance)) return false;
      if (filters.sourceTypes.length > 0 && !filters.sourceTypes.includes(entry.sourceType)) return false;
      if (!matchesTimeRange(entry.updatedAt, filters.timeRange)) return false;
      if (filters.recalledState.length > 0 && !filters.recalledState.includes(formatRecallState(entry))) {
        return false;
      }
      if (filters.onlyAutoCaptured && entry.sourceType !== '自动捕获') return false;
      if (filters.onlyHighImportance && entry.importance !== '高') return false;

      return true;
    });
  }, [activeEntries, filters]);

  const searchResults = useMemo(
    () => searchMemoryEntries(baseFilteredEntries, searchQuery),
    [baseFilteredEntries, searchQuery],
  );

  const searchMatchesById = useMemo(
    () => new Map(searchResults.map((result) => [result.entry.id, result])),
    [searchResults],
  );

  const filteredEntries = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults.map((result) => result.entry);
    }
    return sortMemoryEntriesForDisplay(baseFilteredEntries);
  }, [baseFilteredEntries, searchQuery, searchResults]);

  useEffect(() => {
    if (filteredEntries.length === 0) {
      setSelectedId(null);
      return;
    }

    if (selectedId && !filteredEntries.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
      setEditingId(null);
      setDraft(null);
    }
  }, [filteredEntries, selectedId]);

  const selectedEntry = filteredEntries.find((entry) => entry.id === selectedId) ?? null;
  const relatedEntries = useMemo(
    () => deriveRelatedEntries(activeEntries, selectedEntry),
    [activeEntries, selectedEntry],
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    filters.domains.length > 0 ||
    filters.types.length > 0 ||
    filters.tags.length > 0 ||
    filters.importance.length > 0 ||
    filters.sourceTypes.length > 0 ||
    filters.timeRange.length > 0 ||
    filters.recalledState.length > 0 ||
    filters.onlyAutoCaptured ||
    filters.onlyHighImportance;

  const statusSummary = useMemo<MemoryStatusSummary>(() => {
    const total = activeEntries.length;
    const autoCaptured = activeEntries.filter((entry) => entry.sourceType === '自动捕获').length;
    const recalled = activeEntries.filter((entry) => entry.recallCount > 0).length;
    const pendingReview = activeEntries.filter((entry) => entry.status === '待检查').length;
    const unhealthy =
      runtimeStatus?.dirty === true ? 1 : activeEntries.filter((entry) => entry.indexHealth !== '健康').length;
    const totalRecalls = activeEntries.reduce((sum, entry) => sum + entry.recallCount, 0);

    return {
      total,
      autoCaptured,
      recalled,
      pendingReview,
      totalRecalls,
      indexedFiles: runtimeStatus?.files && runtimeStatus.files > 0 ? runtimeStatus.files : total,
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
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5);
  }, [activeEntries]);

  const latestUpdatedAt = useMemo(() => {
    const timestamps = activeEntries
      .map((entry) => ({ label: entry.updatedAt, value: parseMemoryDate(entry.updatedAt) }))
      .filter((item): item is { label: string; value: number } => item.value !== null)
      .sort((left, right) => right.value - left.value);

    return timestamps[0]?.label ?? null;
  }, [activeEntries]);

  const handleToggleFilter = <K extends MemoryArrayFilterKey>(key: K, value: MemoryFilters[K][number]) => {
    setFilters((current) => ({
      ...current,
      [key]: toggleValue(current[key] as Array<MemoryFilters[K][number]>, value),
    }));
  };

  const handleToggleBooleanFilter = (key: 'onlyAutoCaptured' | 'onlyHighImportance') => {
    setFilters((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchQuery('');
  };

  const handleStartEdit = () => {
    if (!selectedEntry) return;
    setEditingId(selectedEntry.id);
    setDraft(createEditDraft(selectedEntry));
    setTagInput('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDraft(null);
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
      setRuntimeError(error instanceof Error ? error.message : '更新整理状态失败');
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
        entries.some((current) => current.id === entry.id)
          ? { ...entry, id: createMemoryId(), updatedAt: todayStamp() }
          : entry,
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

  const handleSelectRelated = (id: string) => {
    setSelectedId(id);
    setEditingId(null);
    setDraft(null);
    setTagInput('');
  };

  const handleCloseDrawer = () => {
    setSelectedId(null);
    setEditingId(null);
    setDraft(null);
    setTagInput('');
  };

  return (
    <PageSurface as="div" className="bg-[var(--lobster-page-bg)]">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(event) => {
          void handleImportFile(event);
        }}
      />

      <div className="flex min-w-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <PageContent className="max-w-[1480px] py-5">
            <MemoryHeader
              title={title}
              onRefreshIndex={handleRefreshIndex}
              onExport={handleExport}
              onImport={handleImportClick}
              onCreate={handleCreateMemory}
              loading={loading}
              mutating={mutating}
            />

            <div className="mt-3.5 flex flex-col gap-3">
              <MemoryStatusBar
                runtimeStatus={runtimeStatus}
                runtimeError={runtimeError}
                statusSummary={statusSummary}
                topTags={topTags}
                latestUpdatedAt={latestUpdatedAt}
              />
              <MemoryFilterBar
                searchQuery={searchQuery}
                filters={filters}
                availableTags={availableTags}
                hasActiveFilters={hasActiveFilters}
                onSearchChange={setSearchQuery}
                onToggleFilter={handleToggleFilter}
                onToggleBoolean={handleToggleBooleanFilter}
                onClear={handleClearFilters}
              />
              <MemoryListPanel
                entries={filteredEntries}
                totalCount={statusSummary.total}
                searchQuery={searchQuery}
                searchMatchesById={searchMatchesById}
                selectedId={selectedId}
                loading={loading}
                hasActiveFilters={hasActiveFilters}
                runtimeError={runtimeError}
                runtimeStatus={runtimeStatus}
                memoryDir={memoryDir}
                onSelect={setSelectedId}
                onClearFilters={handleClearFilters}
              />
            </div>
          </PageContent>
        </div>

        <MemoryDetailDrawer
          open={selectedEntry !== null}
          entry={selectedEntry}
          relatedEntries={relatedEntries}
          editing={Boolean(selectedEntry && editingId === selectedEntry.id && draft)}
          draft={draft}
          tagInput={tagInput}
          setTagInput={setTagInput}
          onDraftChange={setDraft}
          onStartEdit={handleStartEdit}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          onAddTag={handleAddTagToDraft}
          onRemoveDraftTag={(tag) =>
            setDraft((current) =>
              current ? { ...current, tags: current.tags.filter((item) => item !== tag) } : current,
            )
          }
          onMarkConfirmed={handleMarkConfirmed}
          onMerge={handleMergeSelected}
          onForget={handleForgetSelected}
          onDelete={handleDeleteSelected}
          onSelectRelated={handleSelectRelated}
          onClose={handleCloseDrawer}
          busy={mutating}
        />
      </div>
    </PageSurface>
  );
}
