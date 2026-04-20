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
import {
  buildKnowledgeLibraryContextPrompt,
  buildKnowledgeLibraryGraphQueryPrompt,
  buildKnowledgeLibraryNodeFocusPrompt,
  buildKnowledgeLibraryShortestPathPrompt,
} from './chat-context';
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
  parseOutputArtifactFinanceCompliance,
  parseOutputArtifactLineage,
  parseOutputArtifactSourceSurface,
} from './output-types';
import { openWorkspaceArtifact } from '@/app/lib/tauri-artifact-preview';
import { openGraphifyOutputFile, readGraphifyOutputText } from '@/app/lib/tauri-graphify-output';
import { runGraphifyQuery, runGraphifySaveResult } from '@/app/lib/tauri-graphify';
import { getOutputArtifactByDedupeKey, upsertOutputArtifact } from './output-storage';
import type { RawMaterial } from './types';
import {
  buildGraphReasoningOutputArtifactInput,
  buildGraphQueryMemoryRawMaterialInput,
  extractChatFeedbackFromContainer,
  saveChatFeedbackAsMemo,
  saveChatFeedbackAsOntologyClaim,
  saveChatFeedbackAsRaw,
} from './chat-feedback';
import {
  KNOWLEDGE_LIBRARY_IMPORT_EVENT,
  KNOWLEDGE_LIBRARY_IMPORT_MESSAGE_TYPE,
  type BrowserCaptureBatchPayload,
  type BrowserCapturePayload,
} from './browser-capture';
import {
  importBrowserCaptureBatchIntoKnowledgeFlywheel,
  importBrowserCaptureIntoKnowledgeFlywheel,
} from './flywheel-service';
import { refreshOntologyDocumentFromGraphFeedback } from './graph-compiler';
import { useGraphCompilerJobs } from './graph-compiler-jobs';
import { classifyGraphQueryIntent } from './graph-query-intent';
import { findOntologyShortestPath, getOntologyEdgeDetail, getOntologyNodeDetail } from './graph-navigation';
import { useGraphReasoningSession, writeGraphReasoningSession } from './graph-reasoning-session';
import { appendRelevantGraphContextMemoryToPrompt, persistGraphContextMemory } from './graph-memory-bridge';

export function KnowledgeLibraryView({
  title,
  onOpenContextChat,
  onOpenSourceTurn,
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
  onOpenSourceTurn?: (input: {
    conversationId: string;
    sessionKey: string;
    turnId: string;
    title: string;
  }) => void;
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
  const { create: createRawMaterialRecord, upsert: upsertRawMaterialRecord } = useCreateRawMaterial(repository);
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
  const [outputArtifactActionMessage, setOutputArtifactActionMessage] = useState<string | null>(null);
  const [openingArtifactRefPath, setOpeningArtifactRefPath] = useState<string | null>(null);
  const [graphifyHtmlContent, setGraphifyHtmlContent] = useState<string | null>(null);
  const [graphifyHtmlLoading, setGraphifyHtmlLoading] = useState(false);
  const [graphifyHtmlError, setGraphifyHtmlError] = useState<string | null>(null);
  const [graphifyQueryText, setGraphifyQueryText] = useState('');
  const [graphifyQueryUseDfs, setGraphifyQueryUseDfs] = useState(false);
  const [graphifyQueryLoading, setGraphifyQueryLoading] = useState(false);
  const [graphifyQueryResult, setGraphifyQueryResult] = useState<string | null>(null);
  const [graphifyQueryError, setGraphifyQueryError] = useState<string | null>(null);
  const [graphifyQuerySaveBusy, setGraphifyQuerySaveBusy] = useState<'query' | 'path' | null>(null);
  const [graphifyQuerySaveMessage, setGraphifyQuerySaveMessage] = useState<string | null>(null);
  const [selectedGraphNode, setSelectedGraphNode] = useState<{ id: string; label: string; type: string } | null>(null);
  const [graphPathTargetNodeId, setGraphPathTargetNodeId] = useState<string | null>(null);
  const [graphPathResult, setGraphPathResult] = useState<string | null>(null);
  const [selectedGraphEdgeId, setSelectedGraphEdgeId] = useState<string | null>(null);
  const [embeddedChatSeedPrompt, setEmbeddedChatSeedPrompt] = useState<string | null>(null);
  const [embeddedChatSeedPromptKey, setEmbeddedChatSeedPromptKey] = useState<string | null>(null);
  const [embeddedAutoGraphQueryEnabled, setEmbeddedAutoGraphQueryEnabled] = useState(true);
  const graphCompilerJobs = useGraphCompilerJobs(ontologyRefreshKey + outputRefreshKey + materialsRefreshKey);

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
  const selectedOutputLineage = useMemo(
    () => parseOutputArtifactLineage(selectedOutputArtifact?.metadata || null),
    [selectedOutputArtifact],
  );
  const selectedOutputSourceSurface = useMemo(
    () => parseOutputArtifactSourceSurface(selectedOutputArtifact?.metadata || null),
    [selectedOutputArtifact],
  );
  const selectedOutputFinanceCompliance = useMemo(
    () => parseOutputArtifactFinanceCompliance(selectedOutputArtifact?.metadata || null),
    [selectedOutputArtifact],
  );
  const selectedOntologyGraphifyHtmlPath = useMemo(
    () => selectedOntologyDocument?.metadata?.graphify_html_path || null,
    [selectedOntologyDocument],
  );
  const selectedOntologyGraphifyGraphPath = useMemo(
    () => selectedOntologyDocument?.metadata?.graphify_graph_json_path || null,
    [selectedOntologyDocument],
  );
  const selectedOntologyGraphifyReportArtifact = useMemo(
    () => (selectedOntologyDocument ? getOutputArtifactByDedupeKey(`graphify-report::${selectedOntologyDocument.id}`) : null),
    [selectedOntologyDocument],
  );
  const selectedOntologyLatestJob = useMemo(() => {
    if (!selectedOntologyDocument) {
      return null;
    }
    return (
      graphCompilerJobs.find((job) => job.ontologyDocumentIds.includes(selectedOntologyDocument.id)) ?? null
    );
  }, [graphCompilerJobs, selectedOntologyDocument]);
  const selectedOntologyGraphIdentity = useMemo(
    () => selectedOntologyDocument?.metadata?.graph_identity || selectedOntologyDocument?.id || null,
    [selectedOntologyDocument],
  );
  const selectedOntologyRevisionId = useMemo(
    () => selectedOntologyDocument?.metadata?.revision_id || selectedOntologyDocument?.id || null,
    [selectedOntologyDocument],
  );
  const graphReasoningSession = useGraphReasoningSession(selectedOntologyGraphIdentity);
  const selectedGraphNodeDetail = useMemo(
    () => (selectedOntologyDocument ? getOntologyNodeDetail(selectedOntologyDocument, selectedGraphNode?.id) : null),
    [selectedGraphNode?.id, selectedOntologyDocument],
  );
  const graphPathTargetNode = useMemo(
    () =>
      selectedOntologyDocument && graphPathTargetNodeId
        ? selectedOntologyDocument.nodes.find((node) => node.id === graphPathTargetNodeId) || null
        : null,
    [graphPathTargetNodeId, selectedOntologyDocument],
  );
  const selectedGraphEdgeDetail = useMemo(
    () => (selectedOntologyDocument ? getOntologyEdgeDetail(selectedOntologyDocument, selectedGraphEdgeId) : null),
    [selectedGraphEdgeId, selectedOntologyDocument],
  );

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
      const result = await importBrowserCaptureIntoKnowledgeFlywheel(repository, payload);
      const imported = result.rawMaterials[0] || null;
      if (!imported) return;
      setMaterialsRefreshKey((current) => current + 1);
      setOntologyRefreshKey((current) => current + 1);
      setOutputRefreshKey((current) => current + 1);
      setActiveTab('materials');
      setSelectedByTab((current) => ({ ...current, materials: imported.id }));
    };

    const importBatch = async (payload: BrowserCaptureBatchPayload) => {
      const result = await importBrowserCaptureBatchIntoKnowledgeFlywheel(repository, payload);
      const imported = result.rawMaterials;
      if (imported.length === 0) return;
      setMaterialsRefreshKey((current) => current + 1);
      setOntologyRefreshKey((current) => current + 1);
      setOutputRefreshKey((current) => current + 1);
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

  const handleOpenContextChat = async () => {
    if (!effectiveSelectedItem || !onOpenContextChat) {
      return;
    }
    let prompt = buildKnowledgeLibraryContextPrompt({
      tab: activeTab,
      item: effectiveSelectedItem,
    });
    if (effectiveSelectedItem.ontologyDocument) {
      prompt = await appendRelevantGraphContextMemoryToPrompt({
        basePrompt: prompt,
        ontologyDocument: effectiveSelectedItem.ontologyDocument,
        limit: 2,
      });
    }
    onOpenContextChat({
      title: effectiveSelectedItem.title,
      prompt,
    });
  };

  const handleInjectPromptIntoEmbeddedChat = (prompt: string) => {
    const normalized = prompt.trim();
    if (!normalized) {
      return;
    }
    setEmbeddedChatSeedPrompt(normalized);
    setEmbeddedChatSeedPromptKey(`knowledge-library-seed:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`);
  };

  const handleOpenSourceTurn = () => {
    if (!selectedOutputArtifact || !selectedOutputLineage || !onOpenSourceTurn) {
      return;
    }
    if (!selectedOutputLineage.conversation_id || !selectedOutputLineage.session_key || !selectedOutputLineage.turn_id) {
      return;
    }
    onOpenSourceTurn({
      conversationId: selectedOutputLineage.conversation_id,
      sessionKey: selectedOutputLineage.session_key,
      turnId: selectedOutputLineage.turn_id,
      title: selectedOutputArtifact.title,
    });
  };

  const handleOpenArtifactRef = async (path: string | null | undefined) => {
    if (!path) {
      return;
    }
    setOpeningArtifactRefPath(path);
    setOutputArtifactActionMessage(null);
    try {
      const opened = path.includes('graph-revisions')
        ? await openGraphifyOutputFile(path)
        : await openWorkspaceArtifact(path);
      if (!opened) {
        setOutputArtifactActionMessage('来源文件没有成功打开，请检查本地默认应用。');
      }
    } catch {
      setOutputArtifactActionMessage('打开来源文件失败。');
    } finally {
      setOpeningArtifactRefPath((current) => (current === path ? null : current));
    }
  };

  useEffect(() => {
    setOutputArtifactActionMessage(null);
    setOpeningArtifactRefPath(null);
  }, [selectedOutputArtifact?.id]);

  useEffect(() => {
    let cancelled = false;
    if (activeTab !== 'graph' || graphViewMode !== 'graphify') {
      setGraphifyHtmlContent(null);
      setGraphifyHtmlError(null);
      setGraphifyHtmlLoading(false);
      return;
    }
    if (!selectedOntologyGraphifyHtmlPath) {
      setGraphifyHtmlContent(null);
      setGraphifyHtmlError('当前图谱还没有可显示的增强视图。');
      setGraphifyHtmlLoading(false);
      return;
    }
    setGraphifyHtmlLoading(true);
    setGraphifyHtmlError(null);
    void readGraphifyOutputText(selectedOntologyGraphifyHtmlPath)
      .then((content) => {
        if (cancelled) return;
        if (!content) {
          setGraphifyHtmlContent(null);
          setGraphifyHtmlError('没有读取到增强图谱内容。');
          return;
        }
        setGraphifyHtmlContent(content);
      })
      .catch((error) => {
        if (cancelled) return;
        setGraphifyHtmlContent(null);
        setGraphifyHtmlError(error instanceof Error ? error.message : '读取增强图谱失败。');
      })
      .finally(() => {
        if (!cancelled) {
          setGraphifyHtmlLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, graphViewMode, selectedOntologyGraphifyHtmlPath]);

  useEffect(() => {
    setGraphifyQueryError(null);
    setGraphifyQuerySaveBusy(null);
    setGraphifyQuerySaveMessage(null);
    if (!selectedOntologyDocument || !graphReasoningSession || !selectedOntologyRevisionId) {
      setGraphifyQueryResult(null);
      setGraphifyQueryText('');
      setGraphifyQueryUseDfs(false);
      setSelectedGraphNode(null);
      setGraphPathTargetNodeId(null);
      setGraphPathResult(null);
      setSelectedGraphEdgeId(null);
      return;
    }
    if (graphReasoningSession.ontologyRevisionId !== selectedOntologyRevisionId) {
      setGraphifyQueryResult(null);
      setGraphifyQueryText('');
      setGraphifyQueryUseDfs(false);
      setSelectedGraphNode(null);
      setGraphPathTargetNodeId(null);
      setGraphPathResult(null);
      setSelectedGraphEdgeId(null);
      return;
    }
    setGraphifyQueryText(graphReasoningSession.graphQueryText || '');
    setGraphifyQueryUseDfs(graphReasoningSession.graphQueryUseDfs === true);
    setGraphifyQueryResult(graphReasoningSession.graphQueryResult || null);
    setSelectedGraphNode(
      graphReasoningSession.selectedNodeId
        ? (
            selectedOntologyDocument.nodes.find((node) => node.id === graphReasoningSession.selectedNodeId) &&
            {
              id: graphReasoningSession.selectedNodeId,
              label:
                selectedOntologyDocument.nodes.find((node) => node.id === graphReasoningSession.selectedNodeId)?.label ||
                graphReasoningSession.selectedNodeId,
              type:
                selectedOntologyDocument.nodes.find((node) => node.id === graphReasoningSession.selectedNodeId)?.node_type ||
                'Concept',
            }
          ) || null
        : null,
    );
    setGraphPathTargetNodeId(graphReasoningSession.pathTargetNodeId || null);
    setGraphPathResult(graphReasoningSession.pathResult || null);
    setSelectedGraphEdgeId(graphReasoningSession.selectedEdgeId || null);
    setEmbeddedAutoGraphQueryEnabled(graphReasoningSession.autoGraphQueryEnabled !== false);
  }, [graphReasoningSession, selectedOntologyDocument, selectedOntologyRevisionId]);

  useEffect(() => {
    if (!selectedOntologyGraphIdentity || !selectedOntologyRevisionId) {
      return;
    }
    writeGraphReasoningSession({
      graphIdentity: selectedOntologyGraphIdentity,
      ontologyRevisionId: selectedOntologyRevisionId,
      selectedNodeId: selectedGraphNode?.id || null,
      selectedEdgeId: selectedGraphEdgeId,
      pathTargetNodeId: graphPathTargetNodeId,
      pathResult: graphPathResult,
      graphQueryText,
      graphQueryUseDfs,
      graphQueryResult,
      autoGraphQueryEnabled: embeddedAutoGraphQueryEnabled,
    });
  }, [
    embeddedAutoGraphQueryEnabled,
    graphPathResult,
    graphPathTargetNodeId,
    graphQueryResult,
    graphQueryText,
    graphQueryUseDfs,
    selectedGraphEdgeId,
    selectedGraphNode?.id,
    selectedOntologyGraphIdentity,
    selectedOntologyRevisionId,
  ]);

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
    const createdRawMaterials: RawMaterial[] = [];
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
      createdRawMaterials.push(created);
    }
    if (createdRawMaterials.length > 0) {
      const ontologyDocuments = await repository.compileRawMaterialsToOntology(createdRawMaterials);
      if (ontologyDocuments.length > 0) {
        await repository.generateOutputArtifactsFromOntology(ontologyDocuments);
      }
    }
    setMaterialsRefreshKey((current) => current + 1);
    setOntologyRefreshKey((current) => current + 1);
    setOutputRefreshKey((current) => current + 1);
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
        setOntologyRefreshKey((current) => current + 1);
        setActiveTab('artifacts');
        setSelectedByTab((current) => ({ ...current, artifacts: created.id }));
      }
    } finally {
      setFeedbackBusy(null);
    }
  };

  const handleRunGraphifyQuery = async () => {
    if (!selectedOntologyGraphifyGraphPath || !graphifyQueryText.trim()) {
      return;
    }
    const intent = classifyGraphQueryIntent({
      question: graphifyQueryText.trim(),
      selectedNodeLabel: selectedGraphNode?.label || null,
    });
    setGraphifyQueryLoading(true);
    setGraphifyQueryError(null);
    setGraphifyQueryResult(null);
    setGraphifyQuerySaveMessage(null);
    try {
      const result = await runGraphifyQuery({
        graphPath: selectedOntologyGraphifyGraphPath,
        question: intent.rewrittenQuestion,
        useDfs: graphifyQueryUseDfs || intent.useDfs,
        budget: intent.budget,
      });
      if (!result) {
        setGraphifyQueryError('当前环境暂不支持图谱关系查询。');
        return;
      }
      if (!result.available || result.error) {
        setGraphifyQueryError(result.error || result.stderr || '图谱关系查询失败。');
        return;
      }
      const normalizedResult = (result.stdout || '').trim() || '图谱关系查询没有返回结果。';
      setGraphifyQueryResult(normalizedResult);
      if (selectedOntologyDocument) {
        void persistGraphContextMemory({
          ontologyDocument: selectedOntologyDocument,
          kind: 'query',
          question: graphifyQueryText.trim(),
          answer: normalizedResult,
          focusedNodeLabels: selectedGraphNode ? [selectedGraphNode.label] : [],
          sourceOutputIds:
            selectedOntologyDocument.metadata?.source_output_artifact_ids || [],
        });
      }
    } catch (error) {
      setGraphifyQueryError(error instanceof Error ? error.message : '图谱关系查询失败。');
    } finally {
      setGraphifyQueryLoading(false);
    }
  };

  const handleRunShortestPath = () => {
    if (!selectedOntologyDocument || !selectedGraphNode?.id || !graphPathTargetNodeId) {
      return;
    }
    const result = findOntologyShortestPath(selectedOntologyDocument, selectedGraphNode.id, graphPathTargetNodeId);
    if (!result) {
      setGraphPathResult('当前两个节点之间没有找到路径。');
      setGraphifyQuerySaveMessage(null);
      setSelectedGraphEdgeId(null);
      return;
    }
    const text = result.nodes
      .map((node, index) => {
        if (index === result.nodes.length - 1) {
          return node.label;
        }
        const edge = result.edges[index];
        return `${node.label} --${edge?.relation_type || 'related_to'}--> `;
      })
      .join('');
    setGraphPathResult(text);
    setSelectedGraphEdgeId(result.edges[0]?.id || null);
    setGraphifyQuerySaveMessage(null);
    if (selectedOntologyDocument) {
      void persistGraphContextMemory({
        ontologyDocument: selectedOntologyDocument,
        kind: 'path',
        question: `从 ${selectedGraphNode.label} 到 ${graphPathTargetNode?.label || ''} 的路径是什么？`,
        answer: text,
        focusedNodeLabels: [selectedGraphNode.label, graphPathTargetNode?.label || ''].filter(Boolean),
        sourceOutputIds: selectedOntologyDocument.metadata?.source_output_artifact_ids || [],
      });
    }
  };

  const persistGraphifyQueryMemory = async (input: {
    queryType: 'query' | 'path_query';
    question: string;
    answer: string;
    sourceNodes: string[];
  }) => {
    if (!selectedOntologyGraphifyGraphPath || !effectiveSelectedItem || !selectedOntologyDocument) {
      return;
    }
    const busyKey = input.queryType === 'path_query' ? 'path' : 'query';
    setGraphifyQuerySaveBusy(busyKey);
    setGraphifyQuerySaveMessage(null);
    try {
      const result = await runGraphifySaveResult({
        graphPath: selectedOntologyGraphifyGraphPath,
        question: input.question,
        answer: input.answer,
        queryType: input.queryType,
        sourceNodes: input.sourceNodes,
      });
      if (!result || !result.available || result.error) {
        setGraphifyQuerySaveMessage(result?.error || '图谱记忆保存失败。');
        return;
      }
      const raw = await upsertRawMaterialRecord(
        buildGraphQueryMemoryRawMaterialInput({
          selectedItem: effectiveSelectedItem,
          question: input.question,
          answer: input.answer,
          queryType: input.queryType,
          sourceNodes: input.sourceNodes,
          savedPath: result.savedPath,
        }),
      );
      const outputInput = buildGraphReasoningOutputArtifactInput({
        selectedItem: effectiveSelectedItem,
        ontologyDocument: selectedOntologyDocument,
        question: input.question,
        answer: input.answer,
        queryType: input.queryType,
        sourceNodes: input.sourceNodes,
        savedPath: result.savedPath,
      });
      const outputDedupeKey =
        outputInput.metadata && typeof outputInput.metadata === 'object'
          ? (outputInput.metadata as Record<string, unknown>).dedupe_key
          : null;
      const existingOutput =
        typeof outputDedupeKey === 'string' && outputDedupeKey.trim()
          ? getOutputArtifactByDedupeKey(outputDedupeKey)
          : null;
      const savedOutput = upsertOutputArtifact({
        ...outputInput,
        id: existingOutput?.id,
      });
      const documents = await refreshOntologyDocumentFromGraphFeedback({
        ontologyDocument: selectedOntologyDocument,
        rawMaterials: [raw],
        outputArtifacts: [savedOutput],
      });
      setMaterialsRefreshKey((current) => current + 1);
      setOntologyRefreshKey((current) => current + 1);
      setOutputRefreshKey((current) => current + 1);
      setSelectedByTab((current) => ({
        ...current,
        graph: documents[0]?.id || current.graph,
        artifacts: savedOutput.id || current.artifacts,
      }));
      setGraphifyQuerySaveMessage('已沉淀为成果，并触发图谱更新。');
    } catch (error) {
      setGraphifyQuerySaveMessage(error instanceof Error ? error.message : '保存图谱记忆失败。');
    } finally {
      setGraphifyQuerySaveBusy(null);
    }
  };

  const handleOpenGraphifyQueryInChat = async () => {
    if (!effectiveSelectedItem || !onOpenContextChat || !graphifyQueryResult || !graphifyQueryText.trim()) {
      return;
    }
    let prompt = buildKnowledgeLibraryGraphQueryPrompt({
      tab: activeTab,
      item: effectiveSelectedItem,
      question: graphifyQueryText.trim(),
      queryResult: graphifyQueryResult,
    });
    if (effectiveSelectedItem.ontologyDocument) {
      prompt = await appendRelevantGraphContextMemoryToPrompt({
        basePrompt: prompt,
        ontologyDocument: effectiveSelectedItem.ontologyDocument,
        limit: 2,
      });
    }
    onOpenContextChat({
      title: `${effectiveSelectedItem.title} · 图谱查询`,
      prompt,
    });
  };

  const handleInjectCurrentContextIntoEmbeddedChat = () => {
    if (!effectiveSelectedItem) {
      return;
    }
    handleInjectPromptIntoEmbeddedChat(
      buildKnowledgeLibraryContextPrompt({
        tab: activeTab,
        item: effectiveSelectedItem,
      }),
    );
  };

  const handleInjectGraphifyQueryIntoEmbeddedChat = () => {
    if (!effectiveSelectedItem || !graphifyQueryResult || !graphifyQueryText.trim()) {
      return;
    }
    handleInjectPromptIntoEmbeddedChat(
      buildKnowledgeLibraryGraphQueryPrompt({
        tab: activeTab,
        item: effectiveSelectedItem,
        question: graphifyQueryText.trim(),
        queryResult: graphifyQueryResult,
      }),
    );
  };

  const handleInjectSelectedNodeIntoEmbeddedChat = () => {
    if (!effectiveSelectedItem || !selectedGraphNodeDetail) {
      return;
    }
    handleInjectPromptIntoEmbeddedChat(
      buildKnowledgeLibraryNodeFocusPrompt({
        tab: activeTab,
        item: effectiveSelectedItem,
        nodeLabel: selectedGraphNodeDetail.node.label,
        nodeSummary: selectedGraphNodeDetail.node.summary,
        neighbors: selectedGraphNodeDetail.neighbors.map((item) => item.node.label).slice(0, 8),
      }),
    );
  };

  const handleInjectShortestPathIntoEmbeddedChat = () => {
    if (!effectiveSelectedItem || !selectedGraphNode || !graphPathTargetNode || !graphPathResult) {
      return;
    }
    handleInjectPromptIntoEmbeddedChat(
      buildKnowledgeLibraryShortestPathPrompt({
        tab: activeTab,
        item: effectiveSelectedItem,
        fromLabel: selectedGraphNode.label,
        toLabel: graphPathTargetNode.label,
        pathText: graphPathResult,
      }),
    );
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
                          ['graphify', '增强图谱视图'],
                        ] as const).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setGraphViewMode(mode as GraphViewMode)}
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
                        <GraphifyOntologyGraphView
                          graph={effectiveSelectedItem.ontologyGraphView}
                          selectedNodeId={selectedGraphNode?.id || null}
                          onSelectNode={setSelectedGraphNode}
                        />
                      ) : (
                        <div className="rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-4 text-[13px] leading-7 text-[#64748B] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525] dark:text-[#94A3B8]">
                          当前本体图谱还没有可渲染的节点与关系。
                        </div>
                      )
                    ) : activeTab === 'graph' && graphViewMode === 'graphify' ? (
                      graphifyHtmlLoading ? (
                        <div className="rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-4 text-[13px] leading-7 text-[#64748B] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525] dark:text-[#94A3B8]">
                          正在加载增强图谱视图...
                        </div>
                      ) : graphifyHtmlError ? (
                        <div className="rounded-[16px] border border-[rgba(180,83,9,0.16)] bg-[rgba(180,83,9,0.08)] px-4 py-4 text-[13px] leading-7 text-[#92400E] dark:border-[rgba(251,191,36,0.18)] dark:bg-[rgba(251,191,36,0.08)] dark:text-[#FDE68A]">
                          {graphifyHtmlError}
                        </div>
                      ) : graphifyHtmlContent ? (
                        <iframe
                          title={selectedOntologyDocument?.title || '图谱视图'}
                          className="h-[480px] w-full rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-white dark:border-[rgba(255,255,255,0.08)]"
                          sandbox="allow-downloads allow-forms allow-modals allow-popups allow-scripts"
                          srcDoc={graphifyHtmlContent}
                        />
                      ) : (
                        <div className="rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-4 text-[13px] leading-7 text-[#64748B] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525] dark:text-[#94A3B8]">
                          当前图谱没有可显示的增强图谱。
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
                        {selectedOutputLineage ? (
                          <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-4 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525]">
                            <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">Lineage</div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div>
                                <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">来源</div>
                                <div className="mt-1 text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                                  {selectedOutputLineage.source}
                                  {selectedOutputSourceSurface ? ` · ${selectedOutputSourceSurface}` : ''}
                                </div>
                              </div>
                              <div>
                                <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">来源 turn</div>
                                <div className="mt-1 break-all text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                                  {selectedOutputLineage.turn_id || '未记录'}
                                </div>
                              </div>
                              <div>
                                <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">来源对话</div>
                                <div className="mt-1 break-all text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                                  {selectedOutputLineage.conversation_id || '未记录'}
                                </div>
                              </div>
                              <div>
                                <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">执行产物</div>
                                <div className="mt-1 text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                                  {selectedOutputLineage.artifact_kinds.length > 0
                                    ? selectedOutputLineage.artifact_kinds.join(' / ')
                                    : '未记录'}
                                </div>
                              </div>
                            </div>
                            {selectedOutputLineage.prompt_excerpt ? (
                              <div className="mt-3 rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white/70 px-3 py-3 text-[12px] leading-6 text-[#475569] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#CBD5E1]">
                                {selectedOutputLineage.prompt_excerpt}
                              </div>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={handleOpenSourceTurn}
                                disabled={
                                  !selectedOutputLineage.conversation_id ||
                                  !selectedOutputLineage.session_key ||
                                  !selectedOutputLineage.turn_id ||
                                  !onOpenSourceTurn
                                }
                              >
                                回到来源对话
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={handleInjectCurrentContextIntoEmbeddedChat}
                              >
                                送到右侧对话
                              </Button>
                            </div>
                            {selectedOutputLineage.artifact_refs.length > 0 ? (
                              <div className="mt-4 space-y-2">
                                <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">来源文件</div>
                                {selectedOutputLineage.artifact_refs.map((artifactRef, index) => (
                                  <div
                                    key={`${artifactRef.kind}:${artifactRef.path || artifactRef.title || index}`}
                                    className="rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white/70 px-3 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A]"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-[13px] font-medium text-[#1E293B] dark:text-[#E8E8E3]">
                                          {artifactRef.title || artifactRef.kind}
                                        </div>
                                        <div className="mt-1 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                                          {artifactRef.kind}
                                          {artifactRef.previewKind ? ` · ${artifactRef.previewKind}` : ''}
                                        </div>
                                        {artifactRef.path ? (
                                          <div className="mt-1 break-all text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                            {artifactRef.path}
                                          </div>
                                        ) : null}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={!artifactRef.path || openingArtifactRefPath === artifactRef.path}
                                        onClick={() => {
                                          void handleOpenArtifactRef(artifactRef.path);
                                        }}
                                      >
                                        {openingArtifactRefPath === artifactRef.path ? '打开中' : '打开文件'}
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                {outputArtifactActionMessage ? (
                                  <div className="text-[12px] text-[#B45309] dark:text-[#EBCB8B]">
                                    {outputArtifactActionMessage}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {selectedOutputFinanceCompliance ? (
                          <div className="rounded-[14px] border border-[rgba(212,165,116,0.28)] bg-[rgba(212,165,116,0.10)] px-4 py-4 dark:border-[rgba(212,165,116,0.2)] dark:bg-[rgba(212,165,116,0.08)]">
                            <div className="text-[12px] text-[#8A5A14] dark:text-[#EBCB8B]">金融合规快照</div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div>
                                <div className="text-[12px] text-[#8A5A14] dark:text-[#DDBB74]">风险等级</div>
                                <div className="mt-1 text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                                  {selectedOutputFinanceCompliance.riskLevel}
                                </div>
                              </div>
                              <div>
                                <div className="text-[12px] text-[#8A5A14] dark:text-[#DDBB74]">输出分类</div>
                                <div className="mt-1 text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                                  {selectedOutputFinanceCompliance.outputClassification || '未记录'}
                                </div>
                              </div>
                              <div>
                                <div className="text-[12px] text-[#8A5A14] dark:text-[#DDBB74]">免责声明</div>
                                <div className="mt-1 text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                                  {selectedOutputFinanceCompliance.showDisclaimer ? '已要求展示' : '未要求展示'}
                                </div>
                              </div>
                              <div>
                                <div className="text-[12px] text-[#8A5A14] dark:text-[#DDBB74]">处理动作</div>
                                <div className="mt-1 text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                                  {selectedOutputFinanceCompliance.blocked
                                    ? '拦截'
                                    : selectedOutputFinanceCompliance.degraded
                                      ? '降级'
                                      : '直出'}
                                </div>
                              </div>
                            </div>
                            {selectedOutputFinanceCompliance.disclaimerText ? (
                              <div className="mt-3 text-[12px] leading-6 text-[#8A5A14] dark:text-[#EBCB8B]">
                                {selectedOutputFinanceCompliance.disclaimerText}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
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
                      {activeTab === 'graph' ? (
                        <>
                          <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525]">
                            <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">图谱状态</div>
                            <div className="mt-1 text-[14px] text-[#1E293B] dark:text-[#E8E8E3]">
                              {selectedOntologyLatestJob?.status === 'running'
                                ? '图谱整理中'
                                : selectedOntologyLatestJob?.status === 'failed'
                                  ? '图谱关系仍在补充'
                                  : '图谱已更新'}
                            </div>
                            {selectedOntologyRevisionId ? (
                              <div className="mt-2 break-all text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                当前 revision：{selectedOntologyRevisionId}
                              </div>
                            ) : null}
                          </div>
                          {selectedOntologyGraphifyReportArtifact ? (
                            <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525]">
                              <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">结构导航摘要</div>
                              <div className="mt-2 text-[12px] leading-6 text-[#475569] dark:text-[#CBD5E1]">
                                {selectedOntologyGraphifyReportArtifact.summary}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setActiveTab('artifacts');
                                    setSelectedByTab((current) => ({
                                      ...current,
                                      artifacts: selectedOntologyGraphifyReportArtifact.id,
                                    }));
                                  }}
                                >
                                  打开图谱摘要
                                </Button>
                              </div>
                            </div>
                          ) : null}
                          {selectedGraphNodeDetail ? (
                            <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525]">
                              <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">节点详情</div>
                              <div className="mt-2 text-[14px] font-medium text-[#1E293B] dark:text-[#E8E8E3]">
                                {selectedGraphNodeDetail.node.label}
                              </div>
                              <div className="mt-1 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                                {selectedGraphNodeDetail.node.node_type} · degree {selectedGraphNodeDetail.degree}
                              </div>
                              <div className="mt-2 text-[12px] leading-6 text-[#475569] dark:text-[#CBD5E1]">
                                {selectedGraphNodeDetail.node.summary}
                              </div>
                              {selectedGraphNodeDetail.node.metadata?.source_file ? (
                                <div className="mt-2 break-all text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                  {String(selectedGraphNodeDetail.node.metadata.source_file)}
                                  {selectedGraphNodeDetail.node.metadata?.source_location
                                    ? ` · ${String(selectedGraphNodeDetail.node.metadata.source_location)}`
                                    : ''}
                                </div>
                              ) : null}
                              <div className="mt-3 text-[12px] text-[#64748B] dark:text-[#94A3B8]">相邻节点</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {selectedGraphNodeDetail.neighbors.slice(0, 8).map((neighbor) => (
                                  <button
                                    key={`${neighbor.direction}:${neighbor.node.id}:${neighbor.edge.id}`}
                                    type="button"
                                    onClick={() =>
                                      setSelectedGraphNode({
                                        id: neighbor.node.id,
                                        label: neighbor.node.label,
                                        type: neighbor.node.node_type,
                                      })
                                    }
                                    className="rounded-full border border-[rgba(0,0,0,0.08)] bg-white px-3 py-1 text-[11px] text-[#1E293B] transition hover:border-[rgba(212,165,116,0.28)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#E8E8E3]"
                                  >
                                    {neighbor.node.label}
                                  </button>
                                ))}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={handleInjectSelectedNodeIntoEmbeddedChat}
                                >
                                  送到右侧对话
                                </Button>
                              </div>
                              {selectedGraphNodeDetail.node.evidence_links.length > 0 ? (
                                <div className="mt-3 rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white/70 px-3 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A]">
                                  <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">节点证据</div>
                                  <div className="mt-2 space-y-2">
                                    {selectedGraphNodeDetail.node.evidence_links.slice(0, 6).map((link, index) => (
                                      <div key={`${link.raw_id}:${link.chunk_id || 'none'}:${index}`} className="text-[11px] leading-6 text-[#475569] dark:text-[#CBD5E1]">
                                        <div>{link.excerpt || '无摘要证据'}</div>
                                        <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                          {link.raw_id}
                                          {link.chunk_id ? ` · ${link.chunk_id}` : ''}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525]">
                            <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">图谱关系查询</div>
                            {selectedGraphNode ? (
                              <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-[rgba(212,165,116,0.28)] bg-[rgba(212,165,116,0.10)] px-3 py-1 text-[11px] text-[#1E293B] dark:text-[#E8E8E3]">
                                <span className="truncate">当前节点：{selectedGraphNode.label}</span>
                              </div>
                            ) : null}
                            <textarea
                              value={graphifyQueryText}
                              onChange={(event) => setGraphifyQueryText(event.target.value)}
                              placeholder={selectedGraphNode ? `围绕「${selectedGraphNode.label}」继续提问...` : '例如：什么连接资本开支和现金流？'}
                              className="mt-3 min-h-[88px] w-full resize-none rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white px-3 py-3 text-[12px] text-[#1E293B] outline-none transition placeholder:text-[#64748B] focus:border-[#D4A574] focus:ring-2 focus:ring-[rgba(212,165,116,0.18)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#E8E8E3] dark:placeholder:text-[#94A3B8]"
                            />
                            <label className="mt-3 flex items-center gap-2 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                              <input
                                type="checkbox"
                                checked={graphifyQueryUseDfs}
                                onChange={(event) => setGraphifyQueryUseDfs(event.target.checked)}
                                className="h-3.5 w-3.5 rounded border-[rgba(0,0,0,0.18)] accent-[#D4A574]"
                              />
                              <span>使用 DFS 深挖单条路径</span>
                            </label>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void handleRunGraphifyQuery()}
                                disabled={!selectedOntologyGraphifyGraphPath || !graphifyQueryText.trim() || graphifyQueryLoading}
                              >
                                {graphifyQueryLoading ? '查询中' : '运行图谱查询'}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void handleOpenGraphifyQueryInChat()}
                                disabled={!graphifyQueryResult || !onOpenContextChat}
                              >
                                在主对话中继续
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={handleInjectGraphifyQueryIntoEmbeddedChat}
                                disabled={!graphifyQueryResult}
                              >
                                送到右侧对话
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  void persistGraphifyQueryMemory({
                                    queryType: 'query',
                                    question: graphifyQueryText.trim(),
                                    answer: graphifyQueryResult || '',
                                    sourceNodes: selectedGraphNode ? [selectedGraphNode.label] : [],
                                  })
                                }
                                disabled={!graphifyQueryResult || graphifyQuerySaveBusy !== null}
                              >
                                {graphifyQuerySaveBusy === 'query' ? '保存中' : '沉淀为关系笔记'}
                              </Button>
                            </div>
                            {graphifyQueryError ? (
                              <div className="mt-3 text-[12px] leading-6 text-[#B45309] dark:text-[#EBCB8B]">
                                {graphifyQueryError}
                              </div>
                            ) : null}
                            {graphifyQuerySaveMessage ? (
                              <div className="mt-3 text-[12px] leading-6 text-[#8A5A14] dark:text-[#EBCB8B]">
                                {graphifyQuerySaveMessage}
                              </div>
                            ) : null}
                            {graphifyQueryResult ? (
                              <pre className="mt-3 max-h-[240px] overflow-auto rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white/70 px-3 py-3 text-[11px] leading-6 text-[#334155] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#CBD5E1]">
                                {graphifyQueryResult}
                              </pre>
                            ) : null}
                          </div>
                          {selectedGraphNode ? (
                            <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#FAFAF8] px-4 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#252525]">
                              <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">最短路径</div>
                              <div className="mt-2 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                                起点：{selectedGraphNode.label}
                              </div>
                              <select
                                value={graphPathTargetNodeId || ''}
                                onChange={(event) => setGraphPathTargetNodeId(event.target.value || null)}
                                className="mt-3 h-10 w-full rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white px-3 text-[12px] text-[#1E293B] outline-none dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#E8E8E3]"
                              >
                                <option value="">选择目标节点</option>
                                {(selectedOntologyDocument?.nodes || [])
                                  .filter((node) => node.id !== selectedGraphNode.id)
                                  .slice(0, 80)
                                  .map((node) => (
                                    <option key={node.id} value={node.id}>
                                      {node.label}
                                    </option>
                                  ))}
                              </select>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={handleRunShortestPath}
                                  disabled={!graphPathTargetNodeId}
                                >
                                  计算路径
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={handleInjectShortestPathIntoEmbeddedChat}
                                  disabled={!graphPathResult}
                                >
                                  送到右侧对话
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    void persistGraphifyQueryMemory({
                                      queryType: 'path_query',
                                      question: `从 ${selectedGraphNode.label} 到 ${graphPathTargetNode?.label || ''} 的路径是什么？`,
                                      answer: graphPathResult || '',
                                      sourceNodes: [selectedGraphNode.label, graphPathTargetNode?.label || ''].filter(Boolean),
                                    })
                                  }
                                  disabled={!graphPathResult || graphifyQuerySaveBusy !== null}
                                >
                                  {graphifyQuerySaveBusy === 'path' ? '保存中' : '沉淀为关系笔记'}
                                </Button>
                              </div>
                              {graphPathResult ? (
                                <pre className="mt-3 max-h-[180px] overflow-auto rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white/70 px-3 py-3 text-[11px] leading-6 text-[#334155] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#CBD5E1]">
                                  {graphPathResult}
                                </pre>
                              ) : null}
                              {selectedGraphNode && graphPathTargetNode && selectedOntologyDocument ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {findOntologyShortestPath(selectedOntologyDocument, selectedGraphNode.id, graphPathTargetNode.id)?.edges.map((edge) => (
                                    <button
                                      key={edge.id}
                                      type="button"
                                      onClick={() => setSelectedGraphEdgeId(edge.id)}
                                      className={cn(
                                        'rounded-full border px-3 py-1 text-[11px] transition',
                                        selectedGraphEdgeId === edge.id
                                          ? 'border-[rgba(212,165,116,0.48)] bg-[rgba(212,165,116,0.14)] text-[#1E293B] dark:text-[#E8E8E3]'
                                          : 'border-[rgba(0,0,0,0.08)] bg-white text-[#1E293B] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#E8E8E3]',
                                      )}
                                    >
                                      {edge.relation_type}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              {selectedGraphEdgeDetail ? (
                                <div className="mt-3 rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white/70 px-3 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A]">
                                  <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">边详情</div>
                                  <div className="mt-2 text-[11px] leading-6 text-[#475569] dark:text-[#CBD5E1]">
                                    {selectedGraphEdgeDetail.sourceNode?.label || selectedGraphEdgeDetail.edge.from_node_id}
                                    {' -> '}
                                    {selectedGraphEdgeDetail.targetNode?.label || selectedGraphEdgeDetail.edge.to_node_id}
                                    {' · '}
                                    {selectedGraphEdgeDetail.edge.relation_type}
                                  </div>
                                  {selectedGraphEdgeDetail.edge.evidence_links.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                      {selectedGraphEdgeDetail.edge.evidence_links.slice(0, 6).map((link, index) => (
                                        <div key={`${link.raw_id}:${link.chunk_id || 'none'}:${index}`} className="text-[11px] leading-6 text-[#475569] dark:text-[#CBD5E1]">
                                          <div>{link.excerpt || '无摘要证据'}</div>
                                          <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                            {link.raw_id}
                                            {link.chunk_id ? ` · ${link.chunk_id}` : ''}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                  {(selectedGraphEdgeDetail.edge.metadata?.source_file || selectedGraphEdgeDetail.edge.metadata?.source_location) ? (
                                    <div className="mt-2 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                      {String(selectedGraphEdgeDetail.edge.metadata?.source_file || 'unknown')}
                                      {selectedGraphEdgeDetail.edge.metadata?.source_location
                                        ? ` · ${String(selectedGraphEdgeDetail.edge.metadata.source_location)}`
                                        : ''}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              {graphPathResult && selectedGraphNodeDetail?.neighbors.length ? (
                                <div className="mt-3 rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white/70 px-3 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A]">
                                  <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">路径相关证据</div>
                                  <div className="mt-2 space-y-2">
                                    {selectedGraphNodeDetail.neighbors.slice(0, 6).map((neighbor) => (
                                      <div key={`${neighbor.direction}:${neighbor.edge.id}`} className="text-[11px] leading-6 text-[#475569] dark:text-[#CBD5E1]">
                                        <div>
                                          {neighbor.direction === 'outgoing'
                                            ? `${selectedGraphNodeDetail.node.label} -> ${neighbor.node.label}`
                                            : `${neighbor.node.label} -> ${selectedGraphNodeDetail.node.label}`} · {neighbor.edge.relation_type}
                                        </div>
                                        <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                          {String(neighbor.edge.metadata?.source_file || 'unknown')}
                                          {neighbor.edge.metadata?.source_location ? ` · ${String(neighbor.edge.metadata.source_location)}` : ''}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      ) : null}
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
            <div>
              <div className="text-[14px] font-medium text-[#1E293B] dark:text-[#E8E8E3]">对话</div>
              {activeTab === 'graph' ? (
                <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  {embeddedAutoGraphQueryEnabled ? '自动图查询已开启' : '自动图查询已关闭'}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {activeTab === 'graph' ? (
                <label className="inline-flex h-8 items-center gap-2 rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white px-3 text-[11px] text-[#1E293B] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#E8E8E3]">
                  <input
                    type="checkbox"
                    checked={embeddedAutoGraphQueryEnabled}
                    onChange={(event) => setEmbeddedAutoGraphQueryEnabled(event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[rgba(0,0,0,0.18)] accent-[#D4A574]"
                  />
                  <span>自动图查询</span>
                </label>
              ) : null}
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
                  <button
                    type="button"
                    onClick={handleInjectCurrentContextIntoEmbeddedChat}
                    className="inline-flex h-8 items-center justify-center rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white px-3 text-[11px] text-[#1E293B] transition hover:border-[rgba(212,165,116,0.28)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1A1A1A] dark:text-[#E8E8E3]"
                  >
                    注入右侧对话
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <KnowledgeLibraryEmbeddedChatSurface
            ref={embeddedChatRef}
            selectedItem={effectiveSelectedItem}
            activeTab={activeTab}
            autoGraphQueryEnabled={embeddedAutoGraphQueryEnabled && activeTab === 'graph'}
            selectedGraphNodeLabel={selectedGraphNode?.label || null}
            initialPrompt={embeddedChatSeedPrompt}
            initialPromptKey={embeddedChatSeedPromptKey}
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
