import { useEffect, useMemo, useRef, useState } from 'react';
import { BookPlus, FilePlus2, Plus, RefreshCw, Search, Sparkles } from 'lucide-react';

import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { cn } from '@/app/lib/cn';
import {
  KNOWLEDGE_LIBRARY_TAB_CONFIG,
  getStaticKnowledgeLibraryItems,
  getKnowledgeLibraryPanelDescription,
  getKnowledgeLibraryPanelTitle,
  type KnowledgeLibraryItem,
  type GraphViewMode,
  type KnowledgeLibraryTab,
} from './model';
import { readKnowledgeLibraryState, writeKnowledgeLibraryState } from './persistence';
import { buildKnowledgeLibraryContextPrompt } from './chat-context';
import { KnowledgeLibraryEmbeddedChatSurface } from './KnowledgeLibraryEmbeddedChatSurface';
import type { IClawClient } from '@iclaw/sdk';
import type { ResolvedInputComposerConfig, ResolvedWelcomePageConfig } from '@/app/lib/oem-runtime';
import { createLocalKnowledgeLibraryRepository } from './repository';
import { useCreateRawMaterial, useOntologyDocumentDetail, useOntologyDocuments, useOutputArtifactDetail, useOutputArtifacts, useRawMaterialDetail, useRawMaterials } from './hooks';
import { mapRawMaterialToKnowledgeLibraryItem } from './raw-mappers';
import { mapOntologyDocumentToKnowledgeLibraryItem } from './ontology-mappers';
import { GraphifyOntologyGraphView } from './GraphifyOntologyGraphView';
import { mapOutputArtifactToKnowledgeLibraryItem } from './output-mappers';
import {
  extractChatFeedbackFromContainer,
  saveChatFeedbackAsMemo,
  saveChatFeedbackAsOntologyClaim,
  saveChatFeedbackAsRaw,
} from './chat-feedback';
import {
  importBrowserCaptureBatch,
  importBrowserCapturePayload,
  KNOWLEDGE_LIBRARY_IMPORT_EVENT,
  KNOWLEDGE_LIBRARY_IMPORT_MESSAGE_TYPE,
  type BrowserCaptureBatchPayload,
  type BrowserCapturePayload,
} from './browser-capture';

export function KnowledgeLibraryView({
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
  const initialState = useMemo(() => readKnowledgeLibraryState(), []);
  const repository = useMemo(() => createLocalKnowledgeLibraryRepository(), []);
  const { create: createRawMaterialRecord } = useCreateRawMaterial(repository);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const embeddedChatRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<KnowledgeLibraryTab>(initialState.activeTab);
  const [selectedByTab, setSelectedByTab] = useState(initialState.selectedByTab);
  const [query, setQuery] = useState('');
  const [graphViewMode, setGraphViewMode] = useState<GraphViewMode>('page');
  const [materialsRefreshKey, setMaterialsRefreshKey] = useState(0);
  const [ontologyRefreshKey, setOntologyRefreshKey] = useState(0);
  const [outputRefreshKey, setOutputRefreshKey] = useState(0);
  const [feedbackBusy, setFeedbackBusy] = useState<'raw' | 'claim' | 'memo' | null>(null);

  const {
    items: rawMaterials,
    loading: rawMaterialsLoading,
  } = useRawMaterials({
    repository,
    query: activeTab === 'materials' ? query : '',
    refreshKey: materialsRefreshKey,
  });
  const { items: ontologyDocuments } = useOntologyDocuments({
    repository,
    query: activeTab === 'graph' ? query : '',
    refreshKey: ontologyRefreshKey,
  });
  const { items: outputArtifacts } = useOutputArtifacts({
    repository,
    query: activeTab === 'artifacts' ? query : '',
    refreshKey: outputRefreshKey,
  });

  const items = useMemo<KnowledgeLibraryItem[]>(() => {
    if (activeTab === 'materials') {
      return rawMaterials.map(mapRawMaterialToKnowledgeLibraryItem);
    }
    if (activeTab === 'graph') {
      return ontologyDocuments.map(mapOntologyDocumentToKnowledgeLibraryItem);
    }
    if (activeTab === 'artifacts') {
      return outputArtifacts.map(mapOutputArtifactToKnowledgeLibraryItem);
    }
    const source = getStaticKnowledgeLibraryItems(activeTab);
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return source;
    return source.filter((item) =>
      [item.title, item.subtitle, item.summary, ...item.tags].join(' ').toLowerCase().includes(normalizedQuery),
    );
  }, [activeTab, ontologyDocuments, outputArtifacts, query, rawMaterials]);

  const selectedId = selectedByTab[activeTab];
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) || items[0] || null, [items, selectedId]);
  const { item: selectedRawMaterial } = useRawMaterialDetail({
    repository,
    rawMaterialId: activeTab === 'materials' ? selectedItem?.id || null : null,
    refreshKey: materialsRefreshKey,
  });
  const { item: selectedOntologyDocument } = useOntologyDocumentDetail({
    repository,
    ontologyDocumentId: activeTab === 'graph' ? selectedItem?.id || null : null,
    refreshKey: ontologyRefreshKey,
  });
  const { item: selectedOutputArtifact } = useOutputArtifactDetail({
    repository,
    outputArtifactId: activeTab === 'artifacts' ? selectedItem?.id || null : null,
    refreshKey: outputRefreshKey,
  });
  const selectedDisplayItem = useMemo<KnowledgeLibraryItem | null>(() => {
    if (!selectedItem) return null;
    if (activeTab !== 'materials') return selectedItem;
    return selectedRawMaterial ? mapRawMaterialToKnowledgeLibraryItem(selectedRawMaterial) : selectedItem;
  }, [activeTab, selectedItem, selectedRawMaterial]);
  const selectedOntologyDisplayItem = useMemo<KnowledgeLibraryItem | null>(() => {
    if (activeTab !== 'graph' || !selectedItem) return selectedDisplayItem;
    return selectedOntologyDocument ? mapOntologyDocumentToKnowledgeLibraryItem(selectedOntologyDocument) : selectedItem;
  }, [activeTab, selectedDisplayItem, selectedItem, selectedOntologyDocument]);
  const selectedOutputDisplayItem = useMemo<KnowledgeLibraryItem | null>(() => {
    if (activeTab !== 'artifacts' || !selectedItem) return selectedDisplayItem;
    return selectedOutputArtifact ? mapOutputArtifactToKnowledgeLibraryItem(selectedOutputArtifact) : selectedItem;
  }, [activeTab, selectedDisplayItem, selectedItem, selectedOutputArtifact]);
  const effectiveSelectedItem =
    activeTab === 'graph' ? selectedOntologyDisplayItem : activeTab === 'artifacts' ? selectedOutputDisplayItem : selectedDisplayItem;

  useEffect(() => {
    if (rawMaterials.length === 0) {
      return;
    }
    void repository.compileRawMaterialsToOntology(rawMaterials).then((documents) => {
      setOntologyRefreshKey((current) => current + 1);
      void repository.generateOutputArtifactsFromOntology(documents).then(() => {
        setOutputRefreshKey((current) => current + 1);
      });
    });
  }, [rawMaterials, repository]);

  useEffect(() => {
    if (!selectedItem) return;
    setSelectedByTab((current) => {
      if (current[activeTab] === selectedItem.id) return current;
      return { ...current, [activeTab]: selectedItem.id };
    });
  }, [activeTab, selectedItem]);

  useEffect(() => {
    writeKnowledgeLibraryState({ activeTab, selectedByTab });
  }, [activeTab, selectedByTab]);

  useEffect(() => {
    const importSingle = async (payload: BrowserCapturePayload) => {
      const imported = await importBrowserCapturePayload(repository, payload);
      if (!imported) return;
      setMaterialsRefreshKey((current) => current + 1);
      setActiveTab('materials');
      setSelectedByTab((current) => ({ ...current, materials: imported.id }));
    };

    const importBatch = async (payload: BrowserCaptureBatchPayload) => {
      const imported = await importBrowserCaptureBatch(repository, payload);
      if (imported.length === 0) return;
      setMaterialsRefreshKey((current) => current + 1);
      setActiveTab('materials');
      setSelectedByTab((current) => ({ ...current, materials: imported[0]?.id || current.materials }));
    };

    const messageHandler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      const record = data as Record<string, unknown>;
      if (record.type !== KNOWLEDGE_LIBRARY_IMPORT_MESSAGE_TYPE) return;
      if (record.payload && typeof record.payload === 'object' && Array.isArray((record.payload as { items?: unknown[] }).items)) {
        void importBatch(record.payload as BrowserCaptureBatchPayload);
        return;
      }
      void importSingle(record.payload as BrowserCapturePayload);
    };

    const customEventHandler = (event: Event) => {
      const custom = event as CustomEvent<BrowserCapturePayload | BrowserCaptureBatchPayload | undefined>;
      const detail = custom.detail;
      if (!detail || typeof detail !== 'object') return;
      if (Array.isArray((detail as BrowserCaptureBatchPayload).items)) {
        void importBatch(detail as BrowserCaptureBatchPayload);
        return;
      }
      void importSingle(detail as BrowserCapturePayload);
    };

    window.__ICLAW_IMPORT_RAW__ = async (payload) => {
      if (Array.isArray((payload as BrowserCaptureBatchPayload).items)) {
        const imported = await importBrowserCaptureBatch(repository, payload as BrowserCaptureBatchPayload);
        if (imported.length > 0) {
          setMaterialsRefreshKey((current) => current + 1);
          setActiveTab('materials');
          setSelectedByTab((current) => ({ ...current, materials: imported[0]?.id || current.materials }));
          return imported;
        }
        return [];
      }
      const imported = await importBrowserCapturePayload(repository, payload as BrowserCapturePayload);
      if (imported) {
        setMaterialsRefreshKey((current) => current + 1);
        setActiveTab('materials');
        setSelectedByTab((current) => ({ ...current, materials: imported.id }));
      }
      return imported;
    };

    window.addEventListener('message', messageHandler);
    window.addEventListener(KNOWLEDGE_LIBRARY_IMPORT_EVENT, customEventHandler as EventListener);
    return () => {
      window.removeEventListener('message', messageHandler);
      window.removeEventListener(KNOWLEDGE_LIBRARY_IMPORT_EVENT, customEventHandler as EventListener);
      if (window.__ICLAW_IMPORT_RAW__) {
        delete window.__ICLAW_IMPORT_RAW__;
      }
    };
  }, [repository]);

  const handleSwitchTab = (nextTab: KnowledgeLibraryTab) => {
    setActiveTab(nextTab);
    const nextItems =
      nextTab === 'materials'
        ? rawMaterials.map(mapRawMaterialToKnowledgeLibraryItem)
        : nextTab === 'graph'
          ? ontologyDocuments.map(mapOntologyDocumentToKnowledgeLibraryItem)
          : outputArtifacts.map(mapOutputArtifactToKnowledgeLibraryItem);
    setSelectedByTab((current) => ({
      ...current,
      [nextTab]: current[nextTab] || nextItems[0]?.id || null,
    }));
    if (nextTab !== 'graph') {
      setGraphViewMode('page');
    }
  };

  const handleOpenContextChat = () => {
    if (!effectiveSelectedItem || !onOpenContextChat) {
      return;
    }
    onOpenContextChat({
      title: effectiveSelectedItem.title,
      prompt: buildKnowledgeLibraryContextPrompt({
        tab: activeTab,
        item: effectiveSelectedItem,
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

  const handleSaveFeedbackAsRaw = async () => {
    setFeedbackBusy('raw');
    try {
      const feedback = extractChatFeedbackFromContainer(embeddedChatRef.current);
      const created = await saveChatFeedbackAsRaw({
        repository,
        activeTab,
        selectedItem: effectiveSelectedItem,
        feedback,
      });
      if (created) {
        setMaterialsRefreshKey((current) => current + 1);
        setActiveTab('materials');
        setSelectedByTab((current) => ({ ...current, materials: created.id }));
      }
    } finally {
      setFeedbackBusy(null);
    }
  };

  const handleSaveFeedbackAsClaim = async () => {
    setFeedbackBusy('claim');
    try {
      const feedback = extractChatFeedbackFromContainer(embeddedChatRef.current);
      const created = await saveChatFeedbackAsOntologyClaim({
        repository,
        selectedItem: effectiveSelectedItem,
        feedback,
      });
      if (created) {
        setOntologyRefreshKey((current) => current + 1);
        setActiveTab('graph');
        setSelectedByTab((current) => ({ ...current, graph: created.id }));
      }
    } finally {
      setFeedbackBusy(null);
    }
  };

  const handleSaveFeedbackAsMemo = async () => {
    setFeedbackBusy('memo');
    try {
      const feedback = extractChatFeedbackFromContainer(embeddedChatRef.current);
      const created = await saveChatFeedbackAsMemo({
        repository,
        selectedItem: effectiveSelectedItem,
        feedback,
      });
      if (created) {
        setOutputRefreshKey((current) => current + 1);
        setActiveTab('artifacts');
        setSelectedByTab((current) => ({ ...current, artifacts: created.id }));
      }
    } finally {
      setFeedbackBusy(null);
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
              素材进入，AI 编译本体图谱，对话生成成果，成果再反哺本体图谱。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative block w-[340px] max-w-[40vw]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索素材、本体图谱、成果..."
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
            {KNOWLEDGE_LIBRARY_TAB_CONFIG.map((tab) => {
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
              <div className="text-[20px] font-semibold text-[#1E293B] dark:text-[#E8E8E3]">{getKnowledgeLibraryPanelTitle(activeTab)}</div>
              <p className="mt-1 text-[13px] leading-6 text-[#64748B] dark:text-[#94A3B8]">{getKnowledgeLibraryPanelDescription(activeTab)}</p>
            </div>

            {effectiveSelectedItem ? (
              <div className="space-y-4">
                <div className="rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-white px-5 py-5 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-[#1E293B] dark:text-[#E8E8E3]">{effectiveSelectedItem.title}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {effectiveSelectedItem.tags.map((tag) => (
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
                        if (effectiveSelectedItem.sourceUrl) {
                          window.open(effectiveSelectedItem.sourceUrl, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      disabled={!effectiveSelectedItem.sourceUrl}
                    >
                      查看来源
                    </Button>
                  </div>
                  <p className="mt-4 text-[14px] leading-7 text-[#64748B] dark:text-[#94A3B8]">{effectiveSelectedItem.summary}</p>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-white px-5 py-5 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A]">
                    <div className="mb-3 text-[14px] font-medium text-[#1E293B] dark:text-[#E8E8E3]">
                      {activeTab === 'graph' ? (graphViewMode === 'graph' ? '关系图谱视图' : '本体图谱页面视图') : '结构化内容视图'}
                    </div>
                    {activeTab === 'graph' ? (
                      <div className="mb-3 flex gap-2">
                        {([
                          ['page', '页面视图'],
                          ['graph', '关系图谱视图'],
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
                      effectiveSelectedItem.ontologyGraphView ? (
                        <GraphifyOntologyGraphView graph={effectiveSelectedItem.ontologyGraphView} />
                      ) : (
                        <div className="rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-4 text-[13px] leading-7 text-[#64748B] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525] dark:text-[#94A3B8]">
                          当前本体图谱还没有可渲染的节点与关系。
                        </div>
                      )
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
                    ) : activeTab === 'artifacts' ? (
                      <div className="space-y-3">
                        <div className="rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-4 text-[13px] leading-7 text-[#64748B] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525] dark:text-[#94A3B8]">
                          {effectiveSelectedItem.bodyText?.trim() || effectiveSelectedItem.summary}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525]">
                            <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">成果类型</div>
                            <div className="mt-1 text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                              {selectedOutputArtifact?.type || 'artifact'} · {selectedOutputArtifact?.status || 'draft'}
                            </div>
                          </div>
                          <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525]">
                            <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">来源本体图谱</div>
                            <div className="mt-1 text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                              {(selectedOutputArtifact?.source_ontology_ids || []).length || 0} 个
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-4 text-[13px] leading-7 text-[#64748B] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525] dark:text-[#94A3B8]">
                        AI 会在这里展示当前对象的正文、摘要、来源结构、关键摘录，以及可被引用的压缩知识块。对于本体图谱对象，页面视图会优先展示关系说明和来源证据。
                      </div>
                    )}
                  </div>

                  <div className="rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-white px-5 py-5 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A]">
                    <div className="mb-3 text-[14px] font-medium text-[#1E293B] dark:text-[#E8E8E3]">状态与关系</div>
                    <div className="space-y-3">
                      <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525]">
                        <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">当前层级</div>
                        <div className="mt-1 text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                          {activeTab === 'materials' ? '素材输入层' : activeTab === 'graph' ? '本体图谱编译层' : '成果产出层'}
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              {effectiveSelectedItem ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleSaveFeedbackAsRaw()}
                    disabled={feedbackBusy !== null}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white px-2.5 text-[11px] text-[#1E293B] transition hover:border-[rgba(212,165,116,0.28)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#E8E8E3]"
                  >
                    <FilePlus2 className="h-3.5 w-3.5" />
                    <span>{feedbackBusy === 'raw' ? '沉淀中' : '存为 Raw'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveFeedbackAsClaim()}
                    disabled={feedbackBusy !== null}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white px-2.5 text-[11px] text-[#1E293B] transition hover:border-[rgba(212,165,116,0.28)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#E8E8E3]"
                  >
                    <BookPlus className="h-3.5 w-3.5" />
                    <span>{feedbackBusy === 'claim' ? '沉淀中' : '存为 Claim'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveFeedbackAsMemo()}
                    disabled={feedbackBusy !== null}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white px-2.5 text-[11px] text-[#1E293B] transition hover:border-[rgba(212,165,116,0.28)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#E8E8E3]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{feedbackBusy === 'memo' ? '沉淀中' : '存为 Memo'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenContextChat}
                    className="inline-flex h-8 items-center justify-center rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white px-3 text-[11px] text-[#1E293B] transition hover:border-[rgba(212,165,116,0.28)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#E8E8E3]"
                  >
                    在主对话中打开
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <KnowledgeLibraryEmbeddedChatSurface
            ref={embeddedChatRef}
            selectedItem={effectiveSelectedItem}
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
