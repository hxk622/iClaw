import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';

import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { cn } from '@/app/lib/cn';
import {
  THOUGHT_LIBRARY_TAB_CONFIG,
  getStaticThoughtLibraryItems,
  getThoughtLibraryPanelDescription,
  getThoughtLibraryPanelTitle,
  type ThoughtLibraryItem,
  type GraphViewMode,
  type ThoughtLibraryTab,
} from './model';
import { readThoughtLibraryState, writeThoughtLibraryState } from './persistence';
import { buildThoughtLibraryContextPrompt } from './chat-context';
import { ThoughtLibraryEmbeddedChatSurface } from './ThoughtLibraryEmbeddedChatSurface';
import type { IClawClient } from '@iclaw/sdk';
import type { ResolvedInputComposerConfig, ResolvedWelcomePageConfig } from '@/app/lib/oem-runtime';
import { createLocalKnowledgeLibraryRepository } from './repository';
import { useCreateRawMaterial, useRawMaterialDetail, useRawMaterials } from './hooks';
import { mapRawMaterialToThoughtLibraryItem } from './raw-mappers';

export function ThoughtLibraryView({
  title,
  onOpenContextChat,
  gatewayUrl,
  gatewayToken,
  gatewayPassword,
  authBaseUrl,
  appName,
  client,
  accessToken,
  currentUser,
  authenticated,
  onRequestAuth,
  inputComposerConfig,
  welcomePageConfig,
}: {
  title: string;
  onOpenContextChat?: (input: { title: string; prompt: string }) => void;
  gatewayUrl: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  authBaseUrl: string;
  appName: string;
  client: IClawClient;
  accessToken: string | null;
  currentUser: {
    name?: string | null;
    username?: string | null;
    display_name?: string | null;
    nickname?: string | null;
    email?: string | null;
    avatar_url?: string | null;
    avatar?: string | null;
    avatarUrl?: string | null;
  } | null;
  authenticated: boolean;
  onRequestAuth: (mode?: 'login' | 'register', nextView?: 'account' | 'recharge' | null) => void;
  inputComposerConfig?: ResolvedInputComposerConfig | null;
  welcomePageConfig?: ResolvedWelcomePageConfig | null;
}) {
  const initialState = useMemo(() => readThoughtLibraryState(), []);
  const repository = useMemo(() => createLocalKnowledgeLibraryRepository(), []);
  const { create: createRawMaterialRecord } = useCreateRawMaterial(repository);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<ThoughtLibraryTab>(initialState.activeTab);
  const [selectedByTab, setSelectedByTab] = useState(initialState.selectedByTab);
  const [query, setQuery] = useState('');
  const [graphViewMode, setGraphViewMode] = useState<GraphViewMode>('page');
  const [materialsRefreshKey, setMaterialsRefreshKey] = useState(0);

  const {
    items: rawMaterials,
    loading: rawMaterialsLoading,
  } = useRawMaterials({
    repository,
    query: activeTab === 'materials' ? query : '',
    refreshKey: materialsRefreshKey,
  });

  const items = useMemo<ThoughtLibraryItem[]>(() => {
    if (activeTab === 'materials') {
      return rawMaterials.map(mapRawMaterialToThoughtLibraryItem);
    }
    const source = getStaticThoughtLibraryItems(activeTab);
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return source;
    return source.filter((item) =>
      [item.title, item.subtitle, item.summary, ...item.tags].join(' ').toLowerCase().includes(normalizedQuery),
    );
  }, [activeTab, query, rawMaterials]);

  const selectedId = selectedByTab[activeTab];
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) || items[0] || null, [items, selectedId]);
  const { item: selectedRawMaterial } = useRawMaterialDetail({
    repository,
    rawMaterialId: activeTab === 'materials' ? selectedItem?.id || null : null,
    refreshKey: materialsRefreshKey,
  });
  const selectedDisplayItem = useMemo<ThoughtLibraryItem | null>(() => {
    if (!selectedItem) return null;
    if (activeTab !== 'materials') return selectedItem;
    return selectedRawMaterial ? mapRawMaterialToThoughtLibraryItem(selectedRawMaterial) : selectedItem;
  }, [activeTab, selectedItem, selectedRawMaterial]);

  useEffect(() => {
    if (!selectedItem) return;
    setSelectedByTab((current) => {
      if (current[activeTab] === selectedItem.id) return current;
      return { ...current, [activeTab]: selectedItem.id };
    });
  }, [activeTab, selectedItem]);

  useEffect(() => {
    writeThoughtLibraryState({ activeTab, selectedByTab });
  }, [activeTab, selectedByTab]);

  const handleSwitchTab = (nextTab: ThoughtLibraryTab) => {
    setActiveTab(nextTab);
    const nextItems = nextTab === 'materials' ? rawMaterials.map(mapRawMaterialToThoughtLibraryItem) : getStaticThoughtLibraryItems(nextTab);
    setSelectedByTab((current) => ({
      ...current,
      [nextTab]: current[nextTab] || nextItems[0]?.id || null,
    }));
    if (nextTab !== 'graph') {
      setGraphViewMode('page');
    }
  };

  const handleOpenContextChat = () => {
    if (!selectedDisplayItem || !onOpenContextChat) {
      return;
    }
    onOpenContextChat({
      title: selectedDisplayItem.title,
      prompt: buildThoughtLibraryContextPrompt({
        tab: activeTab,
        item: selectedDisplayItem,
      }),
    });
  };

  const handleRefresh = async () => {
    if (activeTab === 'materials') {
      setMaterialsRefreshKey((current) => current + 1);
      return;
    }
  };

  const handleOpenNew = () => {
    if (activeTab === 'materials') {
      fileInputRef.current?.click();
    }
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    let lastCreatedId: string | null = null;
    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const isTextLike =
        file.type.startsWith('text/') ||
        file.type === 'application/json' ||
        file.type === 'application/xml' ||
        lowerName.endsWith('.md') ||
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.json') ||
        lowerName.endsWith('.csv');

      let contentText = '';
      if (isTextLike) {
        try {
          contentText = await file.text();
        } catch {
          contentText = '';
        }
      }
      const title = file.name.replace(/\\.[^.]+$/, '') || file.name;
      const created = await createRawMaterialRecord({
        kind: 'upload',
        title,
        excerpt:
          contentText.trim().slice(0, 260) ||
          `已导入文件 ${file.name}，当前版本先完成素材入库，正文解析会在后续迭代补齐。`,
        content_text: contentText,
        source_name: '本地上传',
        source_type:
          isTextLike
            ? 'text'
            : file.type === 'application/pdf'
            ? 'pdf'
            : file.type.startsWith('image/')
              ? 'image'
              : file.type.startsWith('audio/')
                ? 'audio'
                : 'file',
        mime_type: file.type || 'application/octet-stream',
        tags: ['上传', ...(file.type === 'application/pdf' ? ['PDF'] : [])],
      });
      lastCreatedId = created.id;
    }
    setMaterialsRefreshKey((current) => current + 1);
    if (lastCreatedId) {
      setActiveTab('materials');
      setSelectedByTab((current) => ({ ...current, materials: lastCreatedId }));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#F5F5F0] text-[#1E293B] dark:bg-[#0F0F0F] dark:text-[#E8E8E3]">
      <div className="border-b border-[rgba(0,0,0,0.08)] bg-[#FFFFFF]/92 px-5 py-4 backdrop-blur dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A]/92">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-[24px] font-semibold tracking-[-0.04em] text-[#1E293B] dark:text-[#E8E8E3]">{title}</h1>
              <Chip tone="accent" className="px-2.5 py-1 text-[11px]">
                知识飞轮
              </Chip>
            </div>
            <p className="mt-1 text-[13px] leading-6 text-[#64748B] dark:text-[#94A3B8]">
              素材进入，AI 编译图谱，对话生成成果，成果再反哺图谱。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative block w-[340px] max-w-[40vw]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索素材、图谱、成果..."
                className="h-10 w-full rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] pl-10 pr-4 text-[13px] text-[#1E293B] outline-none transition placeholder:text-[#64748B] focus:border-[#D4A574] focus:ring-2 focus:ring-[rgba(212,165,116,0.18)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525] dark:text-[#E8E8E3] dark:placeholder:text-[#94A3B8]"
              />
            </label>
            <Button variant="secondary" size="sm" leadingIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void handleRefresh()}>
              刷新
            </Button>
            <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={handleOpenNew}>
              {activeTab === 'materials' ? '上传' : '新建'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[300px] shrink-0 flex-col border-r border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#161616]">
          <div className="flex items-center gap-1 border-b border-[rgba(0,0,0,0.08)] px-3 py-2 dark:border-[rgba(255,255,255,0.08)]">
            {THOUGHT_LIBRARY_TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSwitchTab(tab.id)}
                  className={cn(
                    'inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-medium transition',
                    active
                      ? 'bg-[rgba(212,165,116,0.16)] text-[#1E293B] dark:text-[#E8E8E3]'
                      : 'text-[#64748B] hover:bg-[#F1F1EC] hover:text-[#1E293B] dark:text-[#94A3B8] dark:hover:bg-[#252525] dark:hover:text-[#E8E8E3]',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {activeTab === 'materials' && rawMaterialsLoading ? (
              <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-white px-4 py-4 text-[12px] text-[#64748B] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#94A3B8]">
                正在加载素材...
              </div>
            ) : null}
            {items.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[rgba(0,0,0,0.12)] bg-white/70 px-4 py-5 text-[12px] leading-6 text-[#64748B] dark:border-[rgba(255,255,255,0.12)] dark:bg-[#1A1A1A] dark:text-[#94A3B8]">
                {activeTab === 'materials'
                  ? '还没有真实素材。你可以先点击右上角“上传”，把本地文件导入到 Raw / 素材。'
                  : '当前分类下还没有可显示对象。'}
              </div>
            ) : null}
            {items.map((item) => {
              const active = selectedItem?.id === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setSelectedByTab((current) => ({
                      ...current,
                      [activeTab]: item.id,
                    }))
                  }
                  className={cn(
                    'w-full rounded-[14px] border px-3 py-3 text-left transition',
                    active
                      ? 'border-[rgba(212,165,116,0.34)] bg-[rgba(212,165,116,0.10)]'
                      : 'border-[rgba(0,0,0,0.08)] bg-white hover:border-[rgba(212,165,116,0.22)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A]',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#F1F1EC] text-[#D4A574] dark:bg-[#252525]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-[#1E293B] dark:text-[#E8E8E3]">{item.title}</div>
                      <div className="mt-1 text-[12px] text-[#64748B] dark:text-[#94A3B8]">{item.subtitle}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.tags.slice(0, 3).map((tag) => (
                          <Chip key={tag} tone="outline" className="px-2 py-0.5 text-[10px]">
                            {tag}
                          </Chip>
                        ))}
                      </div>
                      <div className="mt-2 text-[11px] text-[#64748B] dark:text-[#94A3B8]">{item.meta}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto bg-[#F5F5F0] dark:bg-[#0F0F0F]">
          <div className="mx-auto flex h-full max-w-[960px] flex-col px-6 py-6">
            <div className="mb-4">
              <div className="text-[20px] font-semibold text-[#1E293B] dark:text-[#E8E8E3]">{getThoughtLibraryPanelTitle(activeTab)}</div>
              <p className="mt-1 text-[13px] leading-6 text-[#64748B] dark:text-[#94A3B8]">{getThoughtLibraryPanelDescription(activeTab)}</p>
            </div>

            {selectedDisplayItem ? (
              <div className="space-y-4">
                <div className="rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-white px-5 py-5 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-[#1E293B] dark:text-[#E8E8E3]">{selectedDisplayItem.title}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {selectedDisplayItem.tags.map((tag) => (
                          <Chip key={tag} tone="accent" className="px-2.5 py-1 text-[11px]">
                            {tag}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (selectedDisplayItem.sourceUrl) {
                          window.open(selectedDisplayItem.sourceUrl, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      disabled={!selectedDisplayItem.sourceUrl}
                    >
                      查看来源
                    </Button>
                  </div>
                  <p className="mt-4 text-[14px] leading-7 text-[#64748B] dark:text-[#94A3B8]">{selectedDisplayItem.summary}</p>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-white px-5 py-5 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A]">
                    <div className="mb-3 text-[14px] font-medium text-[#1E293B] dark:text-[#E8E8E3]">
                      {activeTab === 'graph' ? (graphViewMode === 'graph' ? '关系图谱视图' : '图谱页面视图') : '结构化内容视图'}
                    </div>
                    {activeTab === 'graph' ? (
                      <div className="mb-3 flex gap-2">
                        {([
                          ['page', '页面视图'],
                          ['graph', '图谱视图'],
                        ] as const).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setGraphViewMode(mode)}
                            className={cn(
                              'rounded-full px-3 py-1.5 text-[12px] transition',
                              graphViewMode === mode
                                ? 'bg-[rgba(212,165,116,0.16)] text-[#1E293B] dark:text-[#E8E8E3]'
                                : 'bg-[#F1F1EC] text-[#64748B] dark:bg-[#252525] dark:text-[#94A3B8]',
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {activeTab === 'graph' && graphViewMode === 'graph' ? (
                      <div className="relative h-[360px] overflow-hidden rounded-[16px] border border-[var(--border-primary)] bg-[radial-gradient(circle_at_top,rgba(180,154,112,0.10),transparent_46%),var(--bg-page)]">
                        <div className="absolute left-1/2 top-[20%] -translate-x-1/2 rounded-full border border-[rgba(180,154,112,0.35)] bg-[rgba(180,154,112,0.12)] px-4 py-2 text-[12px] text-[var(--text-primary)]">
                          {selectedDisplayItem.title}
                        </div>
                        <div className="absolute left-[18%] top-[52%] rounded-full border border-[var(--border-primary)] bg-[var(--bg-panel)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)]">
                          关键关系 A
                        </div>
                        <div className="absolute right-[18%] top-[46%] rounded-full border border-[var(--border-primary)] bg-[var(--bg-panel)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)]">
                          关键关系 B
                        </div>
                        <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-panel)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)]">
                          证据来源
                        </div>
                        <svg className="absolute inset-0 h-full w-full">
                          <line x1="50%" y1="24%" x2="22%" y2="52%" stroke="rgba(180,154,112,0.35)" strokeWidth="1.5" />
                          <line x1="50%" y1="24%" x2="78%" y2="46%" stroke="rgba(180,154,112,0.35)" strokeWidth="1.5" />
                          <line x1="50%" y1="24%" x2="50%" y2="74%" stroke="rgba(180,154,112,0.25)" strokeWidth="1.5" />
                        </svg>
                      </div>
                    ) : activeTab === 'materials' ? (
                      <div className="space-y-3">
                        <div className="rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-4 text-[13px] leading-7 text-[#64748B] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525] dark:text-[#94A3B8]">
                          {selectedDisplayItem.bodyText?.trim() || selectedDisplayItem.summary}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525]">
                            <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">来源类型</div>
                            <div className="mt-1 text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                              {selectedRawMaterial?.source_type || 'file'} · {selectedRawMaterial?.source_name || '本地素材'}
                            </div>
                          </div>
                          <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525]">
                            <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">更新时间</div>
                            <div className="mt-1 text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                              {selectedRawMaterial?.updated_at ? new Date(selectedRawMaterial.updated_at).toLocaleString() : '刚刚'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-4 text-[13px] leading-7 text-[#64748B] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525] dark:text-[#94A3B8]">
                        AI 会在这里展示当前对象的正文、摘要、来源结构、关键摘录，以及可被引用的压缩知识块。对于图谱对象，页面视图会优先展示关系说明和来源证据。
                      </div>
                    )}
                  </div>

                  <div className="rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-white px-5 py-5 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A]">
                    <div className="mb-3 text-[14px] font-medium text-[#1E293B] dark:text-[#E8E8E3]">状态与关系</div>
                    <div className="space-y-3">
                      <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525]">
                        <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">当前层级</div>
                        <div className="mt-1 text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                          {activeTab === 'materials' ? '素材输入层' : activeTab === 'graph' ? '图谱编译层' : '成果产出层'}
                        </div>
                      </div>
                      <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525]">
                        <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">推荐动作</div>
                        <div className="mt-1 text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                          {activeTab === 'materials'
                            ? '加入图谱 / 继续提炼'
                            : activeTab === 'graph'
                              ? '加入对话上下文 / 查看来源'
                              : '继续二创 / 反哺图谱'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[18px] border border-dashed border-[rgba(0,0,0,0.12)] bg-white/70 px-5 py-6 text-[13px] leading-7 text-[#64748B] dark:border-[rgba(255,255,255,0.12)] dark:bg-[#1A1A1A] dark:text-[#94A3B8]">
                {activeTab === 'materials'
                  ? '还没有可展示的素材详情。先从右上角上传一个本地文件，知识库会把它写入 Raw / 素材。'
                  : '当前对象视图将在后续阶段继续真实化。'}
              </div>
            )}
          </div>
        </section>

        <div
          className="flex shrink-0 flex-col border-l border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#161616]"
          style={{ width: 'clamp(360px, 31vw, 420px)' }}
        >
          <div className="flex items-center justify-between border-b border-[rgba(0,0,0,0.08)] px-4 py-3 dark:border-[rgba(255,255,255,0.08)]">
            <div className="text-[14px] font-medium text-[#1E293B] dark:text-[#E8E8E3]">对话</div>
            {selectedDisplayItem ? (
              <button
                type="button"
                onClick={handleOpenContextChat}
                className="inline-flex h-8 items-center justify-center rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white px-3 text-[11px] text-[#1E293B] transition hover:border-[rgba(212,165,116,0.28)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#E8E8E3]"
              >
                在主对话中打开
              </button>
            ) : null}
          </div>
          <ThoughtLibraryEmbeddedChatSurface
            selectedItem={selectedDisplayItem}
            activeTab={activeTab}
            gatewayUrl={gatewayUrl}
            gatewayToken={gatewayToken}
            gatewayPassword={gatewayPassword}
            authBaseUrl={authBaseUrl}
            appName={appName}
            client={client}
            accessToken={accessToken}
            currentUser={currentUser}
            authenticated={authenticated}
            onRequestAuth={onRequestAuth}
            inputComposerConfig={inputComposerConfig}
            welcomePageConfig={welcomePageConfig}
          />
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".txt,.md,.json,.csv,.pdf,text/*,application/json,application/pdf"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          void processFiles(files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
