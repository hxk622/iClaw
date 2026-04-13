import {
  ArrowDown,
  Copy,
  Film,
  FileText,
  Image as ImageIcon,
  MessageCircleQuestionMark,
  MessageSquarePlus,
  RefreshCw,
  ScrollText,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent as ReactDragEvent } from 'react';
import { createPortal } from 'react-dom';
import type { CreditQuoteData, IClawClient, MarketFundData, MarketStockData, RunBillingSummaryData } from '@iclaw/sdk';
import '@openclaw-ui/main.ts';
import {
  normalizeMessage,
  normalizeRoleForGrouping,
} from '@openclaw-ui/ui/chat/message-normalizer.ts';
import { toSanitizedMarkdownHtml } from '@openclaw-ui/ui/markdown.ts';
import './openclaw-chat-surface.css';
import { Button } from '@/app/components/ui/Button';
import { EmptyStatePanel } from '@/app/components/ui/EmptyStatePanel';
import { PageSurface } from '@/app/components/ui/PageLayout';
import {
  HighRiskConfirmationModal,
  type HighRiskConfirmationModalProps,
  type HighRiskImpactItem,
  type HighRiskRollbackStatus,
} from '@/app/components/HighRiskConfirmationModal';
import { K2CWelcomePage } from '@/app/components/K2CWelcomePage';
import { createCoalescedDomTask } from '@/app/lib/coalesced-dom-task';
import { readAppLocale } from '@/app/lib/general-preferences';
import {
  isChatSemanticDirectiveClose,
  matchChatSemanticLead,
  parseChatSemanticDirective,
  resolveChatSemanticDefaultTitle,
  type ChatSemanticTone,
} from '@/app/lib/chat-semantic-formatting';
import {
  looksLikeOpenClawCompatibilityIssue,
  looksLikeOpenClawTransportIssue,
  resolveOpenClawChatRecoveryAction,
} from '@/app/lib/openclaw-chat-recovery';
import { deriveChatResponsePhase, type ChatResponsePhase } from '@/app/lib/chat-response-phase';
import { buildArtifactWorkspaceNameCandidates } from '@/app/lib/artifact-workspace-path';
import {
  deriveOpenClawChatSurfaceLifecycle,
  shouldShowOpenClawWelcomePage,
} from '@/app/lib/openclaw-chat-connection';
import {
  buildComposerModelOptions,
  findComposerModelOption,
  type ComposerModelOption,
} from '../lib/model-catalog';
import {
  fetchRuntimeModelCatalog,
  mapRuntimeModelsToGatewayEntries,
  resolveRuntimeKernelModelRef,
  type RuntimeModelCatalogResponse,
} from '../lib/runtime-models';
import {
  buildGeneratedUserAvatarDataUrl,
  resolveUserAvatarUrl,
  type AppUserAvatarSource,
} from '../lib/user-avatar';
import {
  buildChatSessionPressureSnapshot,
  canonicalizeChatSessionKey,
  getChatSessionId,
  isGeneralChatSessionKey,
  type ChatSessionPressureSnapshot,
} from '../lib/chat-session';
import type { ResolvedInputComposerConfig, ResolvedWelcomePageConfig } from '../lib/oem-runtime';
import { loadSkillStoreCatalog, subscribeSkillStoreEvents } from '@/app/lib/skill-store';
import { buildMemoryContextPrompt, pickRelevantMemories } from '@/app/lib/memory-recall';
import {
  isInvestmentExpertAgent,
  loadLobsterAgents,
  subscribeLobsterStoreEvents,
} from '../lib/lobster-store';
import {
  inferChatTurnArtifactsFromText,
  markChatTurnCompleted,
  markChatTurnFailed,
  readChatTurns,
  startChatTurn,
} from '../lib/chat-turns';
import {
  findChatConversationBySessionKey,
  readChatConversation,
  syncChatConversationActiveAgent,
} from '../lib/chat-conversations';
import {
  clearCacheKeysByPrefix,
  clearSessionKeysByPrefix,
  readCacheJson,
  removeCacheKeys,
} from '../lib/persistence/cache-store';
import {
  countRenderableMessageGroups,
  hydrateChatSnapshotForRender,
  readStoredChatSnapshot,
  writeStoredChatSnapshot,
} from '../lib/chat-history';
import {
  filterPendingUsageSettlementsForSession,
  mergePendingUsageSettlementRecords,
  normalizePendingUsageSettlementRecords,
  readStoredPendingUsageSettlements,
  writeStoredPendingUsageSettlements,
  type PendingUsageSettlementRecord,
} from '../lib/chat-billing';
import {
  RichChatComposer,
  type ComposerAgentOption,
  type ComposerDraftAttachment,
  type ComposerSkillOption,
  type ComposerDraftPayload,
  type ComposerInstrumentSearchPage,
  type ComposerSendPayload,
  type ComposerStockContext,
  type OpenClawImageAttachment,
  type RichChatComposerHandle,
} from './RichChatComposer';
import { loadMemorySnapshot, saveMemoryEntry, type MemoryEntryRecord } from '@/app/lib/tauri-memory';

declare global {
  interface Window {
    __ICLAW_OPENCLAW_DIAGNOSTICS__?: Record<string, unknown>;
  }
}

type OpenClawTheme = 'system' | 'light' | 'dark';

type FlushableCoalescedDomTask = {
  flush: () => void;
};

function attachVisibilityResumeFlush(task: FlushableCoalescedDomTask): () => void {
  const handleResume = () => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
      return;
    }
    task.flush();
  };

  document.addEventListener('visibilitychange', handleResume);
  window.addEventListener('focus', handleResume);

  return () => {
    document.removeEventListener('visibilitychange', handleResume);
    window.removeEventListener('focus', handleResume);
  };
}

function resolveFundComposerInstrumentLabel(fund: MarketFundData): '基金' | 'ETF' | 'QDII' {
  if (fund.instrument_kind === 'etf') {
    return 'ETF';
  }
  if (fund.instrument_kind === 'qdii') {
    return 'QDII';
  }
  return '基金';
}

function resolveFundComposerBoard(fund: MarketFundData): string | null {
  if (fund.instrument_kind === 'qdii' && fund.exchange !== 'otc') {
    return 'QDII ETF';
  }
  if (fund.instrument_kind === 'etf') {
    return '场内 ETF';
  }
  if (fund.exchange === 'otc') {
    return '场外公募';
  }
  if (fund.exchange === 'sz') {
    return '场内 LOF';
  }
  return '基金';
}

function resolveStockComposerBoard(stock: MarketStockData): string | null {
  return typeof stock.board === 'string' && stock.board.trim() ? stock.board.trim() : 'A股';
}

function isModelNotAllowedError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : '';
  return message.toLowerCase().includes('model not allowed');
}

type OpenClawSettings = {
  gatewayUrl: string;
  token: string;
  sessionKey: string;
  lastActiveSessionKey: string;
  theme: OpenClawTheme;
  chatFocusMode: boolean;
  chatShowThinking: boolean;
  splitRatio: number;
  navCollapsed: boolean;
  navGroupsCollapsed: Record<string, boolean>;
  locale?: string;
};

type OpenClawAppElement = HTMLElement & {
  password: string;
  sessionKey: string;
  tab: string;
  settings: OpenClawSettings;
  connected: boolean;
  chatSending: boolean;
  chatRunId: string | null;
  chatMessages: unknown[];
  chatStream: string | null;
  chatStreamStartedAt: number | null;
  chatMessage: string;
  chatAttachments: OpenClawImageAttachment[];
  lastError: string | null;
  lastErrorCode?: string | null;
  sidebarOpen?: boolean;
  sidebarContent?: string | null;
  eventLog?: Array<{
    ts: number;
    event: string;
    payload?: unknown;
  }>;
  eventLogBuffer?: Array<{
    ts: number;
    event: string;
    payload?: unknown;
  }>;
  hello?: {
    auth?: {
      role?: string;
      scopes?: string[];
    };
  } | null;
  client?: {
    request?: <T = unknown>(method: string, params?: unknown) => Promise<T>;
  } | null;
  applySettings: (next: OpenClawSettings) => void;
  connect: () => void;
  scrollToBottom: (opts?: { smooth?: boolean }) => void;
  handleSendChat: (message?: string, options?: { restoreDraft?: boolean }) => Promise<void>;
  handleAbortChat: () => Promise<void>;
  handleOpenSidebar?: (content: string) => void;
  handleCloseSidebar?: () => void;
};

type OpenClawChatSurfaceProps = {
  gatewayUrl: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  authBaseUrl: string;
  appName: string;
  conversationId?: string | null;
  sessionKey?: string;
  initialPrompt?: string | null;
  initialPromptKey?: string | null;
  focusedTurnId?: string | null;
  focusedTurnKey?: string | null;
  initialAgentSlug?: string | null;
  initialSkillSlug?: string | null;
  initialSkillOption?: ComposerSkillOption | null;
  initialStockContext?: ComposerStockContext | null;
  shellAuthenticated?: boolean;
  creditClient?: IClawClient;
  creditToken?: string | null;
  onCreditBalanceRefresh?: () => Promise<void> | void;
  user?: {
    name?: string | null;
    username?: string | null;
    display_name?: string | null;
    nickname?: string | null;
    email?: string | null;
    avatar_url?: string | null;
    avatar?: string | null;
    avatarUrl?: string | null;
  } | null;
  inputComposerConfig?: ResolvedInputComposerConfig | null;
  welcomePageConfig?: ResolvedWelcomePageConfig | null;
  onGeneralChatSessionOverloaded?: (snapshot: ChatSessionPressureSnapshot) => void;
  onOpenRechargeCenter?: () => void;
  onRequireAuth?: (mode?: 'login' | 'register', nextView?: 'account' | 'recharge' | null) => void;
  runtimeStateKey?: string | null;
  onRuntimeStateChange?: (
    runtimeStateKey: string,
    patch: {
      busy?: boolean;
      hasPendingBilling?: boolean;
      ready?: boolean;
    },
  ) => void;
  ensureRuntimeReadyForRecovery?: () => Promise<
    'unsupported' | 'healthy' | 'restarted' | 'restarting' | 'cooldown' | 'failed'
  >;
  surfaceVisible?: boolean;
  sendBlockedReason?: string | null;
};

type ComposerCreditEstimateState = {
  loading: boolean;
  low: number | null;
  high: number | null;
  error: string | null;
  estimatedInputTokens: number | null;
  estimatedOutputTokens: number | null;
};

type ChatSurfaceStatus = {
  busy: boolean;
  responsePhase: ChatResponsePhase;
  connected: boolean;
  lastError: string | null;
  lastErrorCode: string | null;
};

type ChatSurfaceRenderState = {
  hostHeight: number;
  hasNativeInput: boolean;
  nativeInputVisible: boolean;
  nativeInputHeight: number;
  hasThread: boolean;
  threadVisible: boolean;
  threadHeight: number;
  groupCount: number;
  chatMessageCount: number;
};

function createEmptyChatSurfaceRenderState(): ChatSurfaceRenderState {
  return {
    hostHeight: 0,
    hasNativeInput: false,
    nativeInputVisible: false,
    nativeInputHeight: 0,
    hasThread: false,
    threadVisible: false,
    threadHeight: 0,
    groupCount: 0,
    chatMessageCount: 0,
  };
}

type CreditBlockNotice = {
  message: string;
  code: 'INSUFFICIENT_CREDITS' | 'CREDIT_LIMIT_EXCEEDED';
};

type ChatSurfaceTransitionMode = 'boot' | 'switch';
type SessionHistoryState = 'unknown' | 'empty' | 'has-history';

type UnhandledGatewayError = {
  message: string;
  code: string | null;
  detailCode: string | null;
  httpStatus: number | null;
  raw: string | null;
};

type GatewayRpcFailure = {
  method: string;
  code: string | null;
  detailCode: string | null;
  message: string;
};

type ChatTableType = 'narrative' | 'market' | 'tool';
type ChatTableColumnType = 'text' | 'number' | 'change' | 'status' | 'risk' | 'key';
type ChatTableHeaderTone = 'blue' | 'green';

function buildSkillScopedPrompt(payload: ComposerSendPayload): string {
  const prompt = payload.prompt.trim();
  const controlLines = [
    payload.selectedAgentName ? `专家：${payload.selectedAgentName}` : null,
    payload.selectedSkillName ? `技能：${payload.selectedSkillName}` : null,
    payload.selectedModeLabel ? `模式：${payload.selectedModeLabel}` : null,
    payload.selectedMarketScopeLabel ? `市场范围：${payload.selectedMarketScopeLabel}` : null,
    payload.selectedStockContextLabel ? `标的：${payload.selectedStockContextLabel}` : null,
    payload.selectedWatchlistLabel ? `自选股：${payload.selectedWatchlistLabel}` : null,
    payload.selectedOutputLabel ? `输出：${payload.selectedOutputLabel}` : null,
  ].filter((line): line is string => Boolean(line));

  if (controlLines.length === 0) {
    return prompt;
  }

  const instructionParts = [
    payload.selectedAgentSystemPrompt
      ? `你当前以「${payload.selectedAgentName || '已选专家'}」身份工作。必须遵循以下专家要求：\n${payload.selectedAgentSystemPrompt}`
      : null,
    payload.selectedSkillName
      ? `请以「${payload.selectedSkillName}」这个技能的能力与工作方式优先处理下面这个任务；如果需要，请显式调用对应技能能力，不要忽略这个技能上下文。`
      : null,
    payload.selectedModeLabel ? `回答模式请遵循「${payload.selectedModeLabel}」。` : null,
    payload.selectedMarketScopeLabel ? `分析范围请聚焦「${payload.selectedMarketScopeLabel}」。` : null,
    payload.selectedStockContextLabel ? `本次对话请聚焦标的「${payload.selectedStockContextLabel}」，除非用户明确要求，否则不要扩展到其它标的。` : null,
    payload.selectedWatchlistLabel ? `如果涉及用户关注标的，请优先围绕「${payload.selectedWatchlistLabel}」这组自选股展开分析。` : null,
    payload.selectedOutputLabel ? `输出形式请优先按「${payload.selectedOutputLabel}」呈现。` : null,
  ].filter((line): line is string => Boolean(line));

  return `${instructionParts.join('\n')}\n\n已选控制项：${controlLines.join('｜')}\n\n用户任务：${prompt}`;
}

function buildNativeAgentSessionKey(agentSlug: string | null | undefined): string | null {
  const normalized = typeof agentSlug === 'string' ? agentSlug.trim() : '';
  if (!normalized) {
    return null;
  }
  return canonicalizeChatSessionKey(`agent:${normalized}:main`);
}

type SelectionMenuState = {
  x: number;
  y: number;
  text: string;
  label: string;
};

const ASSISTANT_AVATAR_SRC = '/favicon.png';
const OPENCLAW_CONTROL_SETTINGS_KEY = 'openclaw.control.settings.v1';
const OPENCLAW_CONTROL_TOKEN_PREFIX = 'openclaw.control.token.v1';
const OPENCLAW_DEVICE_AUTH_KEY = 'openclaw.device.auth.v1';
const OPENCLAW_DEVICE_IDENTITY_KEY = 'openclaw-device-identity-v1';
const CHAT_SELECTION_MENU_WIDTH = 220;
const CHAT_SELECTION_MENU_HEIGHT = 176;
const CHAT_SELECTION_MENU_GAP = 12;
const SESSION_TRANSITION_MIN_DURATION_MS = 0;
const INITIAL_SURFACE_BOOT_TIMEOUT_MS = 3200;
const INITIAL_EMPTY_SESSION_SETTLE_MS = 120;
const STATUS_POLL_INTERVAL_MS = 120;
const CONNECTION_LOSS_GRACE_MS = 1200;
const SEEDED_EMPTY_SESSION_PREFIXES = ['chat-', 'skill-', 'stock-', 'fund-'] as const;
const ICLAW_BILLING_SUMMARY_KEY = '__iclawBillingSummary';
const ICLAW_BILLING_STATE_KEY = '__iclawBillingState';
const ICLAW_BILLING_RUN_ID_KEY = '__iclawBillingRunId';
const REFERENCE_MARKER_PATTERN = /\[\[引用:([\s\S]*?)\]\]/g;
const CHAT_TABLE_CARD_SELECTOR = '.iclaw-chat-table-card';
const CHAT_TABLE_SCROLL_CONTAINER_SELECTOR = '.iclaw-chat-table-scroll-container';
const CHAT_TABLE_LEFT_SCROLL_ICON = `
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M9.75 3.5 5.25 8l4.5 4.5" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;
const CHAT_TABLE_RIGHT_SCROLL_ICON = `
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6.25 3.5 10.75 8l-4.5 4.5" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;
const CHAT_TABLE_STATUS_TONE_PATTERNS: Array<{
  tone: 'success' | 'running' | 'error' | 'pending' | 'default';
  pattern: RegExp;
}> = [
  { tone: 'success', pattern: /^(success|successful|succeeded|completed|done|ok|passed|成功|已完成|完成|已生成|可用|就绪)$/i },
  { tone: 'running', pattern: /^(running|in[\s-]?progress|processing|syncing|active|executing|执行中|运行中|处理中|同步中|分析中)$/i },
  { tone: 'error', pattern: /^(failed|failure|error|errored|aborted|timeout|失败|异常|错误|中断|超时)$/i },
  { tone: 'pending', pattern: /^(pending|queued|waiting|scheduled|等待中|排队中|待执行|待处理|待同步)$/i },
];
const CHAT_TABLE_RISK_TONE_PATTERNS: Array<{
  tone: 'low' | 'medium' | 'high' | 'extreme' | 'default';
  pattern: RegExp;
}> = [
  { tone: 'low', pattern: /^(low|低|较低)$/i },
  { tone: 'medium', pattern: /^(medium|med|中|中等)$/i },
  { tone: 'high', pattern: /^(high|高|较高)$/i },
  { tone: 'extreme', pattern: /^(extreme|very[\s-]?high|critical|极高|很高)$/i },
];
const ARTIFACT_CARD_EXTENSIONS = ['md', 'markdown', 'html', 'htm', 'pdf', 'ppt', 'pptx', 'key', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'tsv'];
const ARTIFACT_CARD_KEYWORDS = [
  'artifact',
  'report',
  'memo',
  'brief',
  'briefing',
  'slides',
  'slide',
  'deck',
  'presentation',
  'document',
  'markdown',
  'html',
  'pdf',
  'ppt',
  'pptx',
  'docx',
  'xlsx',
  '投研',
  '报告',
  '研报',
  '简报',
  '纪要',
  '备忘录',
  '演示',
  '幻灯片',
  '文档',
];
const ARTIFACT_PREVIEW_HTML_EXTENSIONS = new Set(['html', 'htm']);
const ARTIFACT_PREVIEW_MARKDOWN_EXTENSIONS = new Set(['md', 'markdown']);
const ARTIFACT_PREVIEW_TEXT_EXTENSIONS = new Set([
  'txt',
  'text',
  'json',
  'js',
  'jsx',
  'ts',
  'tsx',
  'css',
  'scss',
  'less',
  'xml',
  'yml',
  'yaml',
  'csv',
  'tsv',
  'sql',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'sh',
  'bash',
  'zsh',
  'c',
  'cc',
  'cpp',
  'h',
  'hpp',
  'vue',
  'svelte',
  'mdx',
]);
const ARTIFACT_PATH_PATTERN = new RegExp(
  `([^\\s|)\\]}]+?\\.(?:${ARTIFACT_CARD_EXTENSIONS.join('|')}))`,
  'ig',
);

type ArtifactAutoOpenState = {
  lastBusy: boolean;
  runSequence: number;
  pendingRunSequence: number | null;
  pendingScanCount: number;
  lastOpenedToken: string | null;
};

type ActiveChatTurnRun = {
  turnId: string;
  baselineError: string | null;
  failureMessage: string | null;
};

type AssistantBillingState = 'charged' | 'pending' | 'missing';

type AssistantFooterMeta = {
  timestampLabel: string;
  state: AssistantBillingState;
  label: string;
  value: string | null;
  credits: number | null;
  inputTokens: number;
  outputTokens: number;
  tooltip: string | null;
};

type AssistantUsageSettlement = {
  inputTokens: number;
  outputTokens: number;
  model: string | null;
  timestamp: number;
};

type PendingUsageSettlement = PendingUsageSettlementRecord;

type UsageSettlementAttemptDiagnostic = {
  sequence: number;
  runId: string;
  sessionKey: string;
  terminalState: PendingUsageSettlement['terminalState'];
  matchedTerminalSessionKey: string | null;
  matchedTerminalState: PendingUsageSettlement['terminalState'] | null;
  baselineInputTokens: number | null;
  baselineOutputTokens: number | null;
  sessionInputTokens: number | null;
  sessionOutputTokens: number | null;
  derivedUsage: AssistantUsageSettlement | null;
  action:
    | 'start'
    | 'loaded-summary'
    | 'usage-missing'
    | 'usage-missing-terminal-error'
    | 'usage-missing-terminal-timeout'
    | 'usage-missing-expired'
    | 'reported'
    | 'reported-zero'
    | 'report-failed'
    | 'report-failed-loaded-summary';
  detail: string | null;
};

type QueuedComposerMessage = {
  id: string;
  createdAt: number;
  preview: string;
  attachmentCount: number;
  payload: ComposerSendPayload;
};

type SendAttemptResult = 'sent' | 'retry' | 'failed';

type GatewaySessionsListResult = {
  defaults: {
    model: string | null;
  };
  sessions: Array<{
    key: string;
    model?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
  }>;
};

type DraggedFileSummary = {
  totalFiles: number;
  supportedFiles: number;
  imageCount: number;
  pdfCount: number;
  videoCount: number;
  unsupportedCount: number;
};

type ArtifactPreviewKind = 'html' | 'markdown' | 'text' | 'unsupported';

type ArtifactPreviewState = {
  title: string;
  path: string;
  kind: ArtifactPreviewKind;
  content: string | null;
  loading: boolean;
  error: string | null;
};

type ChatSessionSnapshot = {
  sessionKey: string;
  savedAt: number;
  messages: unknown[];
  pendingUsageSettlements?: unknown[];
};

function readChatSessionSnapshot(
  appName: string,
  sessionKey: string,
  conversationId?: string | null,
): ChatSessionSnapshot | null {
  return hydrateChatSnapshotForRender({
    appName,
    sessionKey: canonicalizeChatSessionKey(sessionKey),
    conversationId,
  });
}

function writeChatSessionSnapshot(
  appName: string,
  sessionKey: string,
  snapshot: ChatSessionSnapshot | null,
  conversationId?: string | null,
): void {
  writeStoredChatSnapshot({
    appName,
    sessionKey: canonicalizeChatSessionKey(sessionKey),
    conversationId,
    snapshot,
  });
}

function buildChatSessionSnapshotComparableValue(
  snapshot:
    | Pick<ChatSessionSnapshot, 'sessionKey' | 'messages' | 'pendingUsageSettlements'>
    | null
    | undefined,
): string | null {
  if (!snapshot) {
    return null;
  }
  return JSON.stringify({
    sessionKey: canonicalizeChatSessionKey(snapshot.sessionKey),
    messages: Array.isArray(snapshot.messages) ? snapshot.messages : [],
    pendingUsageSettlements: Array.isArray(snapshot.pendingUsageSettlements)
      ? snapshot.pendingUsageSettlements
      : [],
  });
}

function tryCanonicalizeSessionKey(value?: string | null): string | null {
  try {
    return canonicalizeChatSessionKey(value);
  } catch {
    return null;
  }
}

function collectCanonicalSessionKeys(...candidates: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();
  const keys: string[] = [];
  candidates.forEach((candidate) => {
    const canonical = tryCanonicalizeSessionKey(candidate);
    if (!canonical || unique.has(canonical)) {
      return;
    }
    unique.add(canonical);
    keys.push(canonical);
  });
  return keys;
}

function buildGatewaySessionPatchTargets(
  sessionKey: string,
  resolvedSessionKey?: string | null,
): string[] {
  return collectCanonicalSessionKeys(resolvedSessionKey, sessionKey);
}

function findPreferredGatewaySessionEntry(
  sessionsResult: GatewaySessionsListResult | null | undefined,
  targetSessionKey: string,
): GatewaySessionsListResult['sessions'][number] | null {
  const canonicalTargetSessionKey = canonicalizeChatSessionKey(targetSessionKey);
  return (
    sessionsResult?.sessions.find((session) => tryCanonicalizeSessionKey(session.key) === canonicalTargetSessionKey) ??
    null
  );
}

function resolveSessionModelFromList(
  sessionsResult: GatewaySessionsListResult | null | undefined,
  targetSessionKey: string,
): string {
  return findPreferredGatewaySessionEntry(sessionsResult, targetSessionKey)?.model?.trim() ?? '';
}

function cloneComposerSendPayload(payload: ComposerSendPayload): ComposerSendPayload {
  return {
    ...payload,
    imageAttachments: payload.imageAttachments.map((attachment) => ({ ...attachment })),
    selectedStockContext: payload.selectedStockContext ? { ...payload.selectedStockContext } : null,
  };
}

function formatQueuedComposerMessagePreview(payload: ComposerSendPayload): string {
  const normalizedPrompt = payload.prompt.trim().replace(/\s+/g, ' ');
  if (normalizedPrompt) {
    return normalizedPrompt.length > 72 ? `${normalizedPrompt.slice(0, 72)}…` : normalizedPrompt;
  }
  const attachmentCount = payload.imageAttachments.length;
  if (attachmentCount > 0) {
    return attachmentCount === 1 ? '图片消息' : `图片消息 (${attachmentCount})`;
  }
  return '新消息';
}

function createQueuedComposerMessage(payload: ComposerSendPayload): QueuedComposerMessage {
  return {
    id: createDesktopRunId(),
    createdAt: Date.now(),
    preview: formatQueuedComposerMessagePreview(payload),
    attachmentCount: payload.imageAttachments.length,
    payload: cloneComposerSendPayload(payload),
  };
}

function hasDraggedFiles(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) {
    return false;
  }
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    return Array.from(dataTransfer.items).some((item) => item.kind === 'file');
  }
  return Array.from(dataTransfer.types ?? []).includes('Files');
}

function summarizeDraggedFiles(dataTransfer: DataTransfer | null | undefined): DraggedFileSummary {
  const summary: DraggedFileSummary = {
    totalFiles: 0,
    supportedFiles: 0,
    imageCount: 0,
    pdfCount: 0,
    videoCount: 0,
    unsupportedCount: 0,
  };

  if (!dataTransfer) {
    return summary;
  }

  const items =
    dataTransfer.items && dataTransfer.items.length > 0
      ? Array.from(dataTransfer.items).filter((item) => item.kind === 'file')
      : Array.from(dataTransfer.files ?? []).map((file) => ({
          kind: 'file',
          type: file.type,
        } as DataTransferItem));

  summary.totalFiles = items.length;

  for (const item of items) {
    const mimeType = String(item.type || '').trim().toLowerCase();
    if (mimeType.startsWith('image/')) {
      summary.imageCount += 1;
      summary.supportedFiles += 1;
      continue;
    }
    if (mimeType === 'application/pdf') {
      summary.pdfCount += 1;
      summary.supportedFiles += 1;
      continue;
    }
    if (mimeType.startsWith('video/')) {
      summary.videoCount += 1;
      summary.supportedFiles += 1;
      continue;
    }
    summary.unsupportedCount += 1;
  }

  return summary;
}

const MESSAGE_ACTION_FEEDBACK_MS = 1600;
const USAGE_SETTLEMENT_RETRY_INTERVAL_MS = 1500;
const USAGE_SETTLEMENT_MAX_WAIT_MS = 60_000;
const USAGE_SETTLEMENT_TERMINAL_GRACE_MS = 6_000;
const GATEWAY_SESSION_LIST_LIMIT = 1000;
const MESSAGE_ACTION_ICONS = {
  copy:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7.4" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  thumbsUp:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.7 10.15v8.95H6.35A2.35 2.35 0 0 1 4 16.75v-4.25a2.35 2.35 0 0 1 2.35-2.35H8.7Z" fill="none" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.95 19.1v-8.05l3-4.95c.58-.96 2.1-.5 2.1.64v3.18h2.45a2.02 2.02 0 0 1 1.99 2.4l-.72 3.99a3.18 3.18 0 0 1-3.12 2.79h-5.7Z" fill="none" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  thumbsDown:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.05 4.9v8.05l-3 4.95c-.58.96-2.1.5-2.1-.64v-3.18H5.5a2.02 2.02 0 0 1-1.99-2.4l.72-3.99A3.18 3.18 0 0 1 7.35 4.9h5.7Z" fill="none" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.3 13.85V4.9h2.35A2.35 2.35 0 0 1 20 7.25v4.25a2.35 2.35 0 0 1-2.35 2.35H15.3Z" fill="none" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  refresh:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 2v6h-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 8a8 8 0 1 0 2 5.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
} as const;

function readAgentMetadataString(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key];
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized || null;
}

function isVisibleElement(node: Element | null): { visible: boolean; height: number } {
  if (!(node instanceof HTMLElement)) {
    return { visible: false, height: 0 };
  }

  const style = window.getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  const visible =
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0;

  return {
    visible,
    height: Math.round(rect.height),
  };
}

function resolveThemeMode(): OpenClawTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

function shouldResetEmbeddedOpenClawState(gatewayUrl: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!isLoopbackHost(window.location.hostname)) {
    return false;
  }

  try {
    const gatewayHost = new URL(gatewayUrl, window.location.href).hostname;
    return isLoopbackHost(gatewayHost);
  } catch {
    return false;
  }
}

function buildChatScopeIdentity(sessionKey: string, conversationId?: string | null): string {
  const normalizedSessionKey = canonicalizeChatSessionKey(sessionKey);
  const normalizedConversationId = typeof conversationId === 'string' ? conversationId.trim() : '';
  return `${normalizedSessionKey}::${normalizedConversationId}`;
}

function estimateHistoryMessagesFromGroups(groupCount: number): number {
  if (groupCount <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(24, Math.floor(groupCount / 2)));
}

function clearOpenClawEmbeddedState(gatewayUrl: string): void {
  if (!shouldResetEmbeddedOpenClawState(gatewayUrl)) {
    return;
  }

  try {
    removeCacheKeys([OPENCLAW_CONTROL_SETTINGS_KEY, OPENCLAW_DEVICE_AUTH_KEY, OPENCLAW_DEVICE_IDENTITY_KEY]);
    clearCacheKeysByPrefix(OPENCLAW_CONTROL_TOKEN_PREFIX);
  } catch {}

  try {
    clearSessionKeysByPrefix(OPENCLAW_CONTROL_TOKEN_PREFIX);
  } catch {}
}

function buildSettings(params: {
  gatewayUrl: string;
  gatewayToken?: string;
  sessionKey: string;
}): OpenClawSettings {
  return {
    gatewayUrl: params.gatewayUrl,
    token: params.gatewayToken?.trim() ?? '',
    sessionKey: params.sessionKey,
    lastActiveSessionKey: params.sessionKey,
    theme: resolveThemeMode(),
    chatFocusMode: true,
    chatShowThinking: true,
    splitRatio: 0.6,
    navCollapsed: true,
    navGroupsCollapsed: {
      control: true,
      agent: true,
      settings: true,
    },
    locale: readAppLocale(),
  };
}

function buildSelectionLabel(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 35) {
    return collapsed;
  }
  return `${collapsed.slice(0, 34)}...`;
}

function buildToolCardSignature(card: HTMLElement): string {
  const parts = Array.from(
    card.querySelectorAll(
      '.chat-tool-card__title, .chat-tool-card__detail, .chat-tool-card__preview, .chat-tool-card__inline',
    ),
  )
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .filter(Boolean);

  return parts.join(' | ');
}

function extractArtifactExtension(path: string | null): string | null {
  if (!path) {
    return null;
  }
  const match = /\.([a-z0-9]+)$/i.exec(path.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

function resolveArtifactPreviewKind(path: string | null): ArtifactPreviewKind {
  const extension = extractArtifactExtension(path);
  if (!extension) {
    return 'text';
  }
  if (ARTIFACT_PREVIEW_HTML_EXTENSIONS.has(extension)) {
    return 'html';
  }
  if (ARTIFACT_PREVIEW_MARKDOWN_EXTENSIONS.has(extension)) {
    return 'markdown';
  }
  if (ARTIFACT_PREVIEW_TEXT_EXTENSIONS.has(extension)) {
    return 'text';
  }
  return 'unsupported';
}

function sanitizeArtifactPathCandidate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value
    .trim()
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .replace(/[),.;:]+$/, '');
  if (!trimmed) {
    return null;
  }
  return /\.(?:[a-z0-9]+)$/i.test(trimmed) ? trimmed : null;
}

function extractArtifactPathFromText(text: unknown): string | null {
  if (typeof text !== 'string') {
    return null;
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  const directionalMatch = normalized.match(
    new RegExp(`(?:from|to|in)\\s+(.+?\\.(?:${ARTIFACT_CARD_EXTENSIONS.join('|')}))(?:\\s*\\(|$)`, 'i'),
  );
  const directionalPath = sanitizeArtifactPathCandidate(directionalMatch?.[1] ?? null);
  if (directionalPath) {
    return directionalPath;
  }

  ARTIFACT_PATH_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = null;
  while ((match = ARTIFACT_PATH_PATTERN.exec(normalized)) !== null) {
    const candidate = sanitizeArtifactPathCandidate(match[1]);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function extractArtifactPathFromCard(card: HTMLElement): string | null {
  const candidates = [
    card.dataset.iclawArtifactPath,
    ...Array.from(
      card.querySelectorAll('.chat-tool-card__detail, .chat-tool-card__preview, .chat-tool-card__inline'),
    ).map((node) => node.textContent ?? ''),
    buildToolCardSignature(card),
  ];

  for (const candidate of candidates) {
    const path = extractArtifactPathFromText(candidate);
    if (path) {
      return path;
    }
  }

  return null;
}

function extractArtifactInlineContentFromCard(card: HTMLElement): string | null {
  const sections = Array.from(
    card.querySelectorAll('.chat-tool-card__inline, .chat-tool-card__preview, .chat-tool-card__output'),
  )
    .map((node) => node.textContent?.trim() ?? '')
    .filter(Boolean);
  if (sections.length === 0) {
    return null;
  }
  return sections.join('\n\n');
}

function buildArtifactPreviewTitle(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  return segments.at(-1) ?? normalized;
}

function isLikelyArtifactToolCard(card: HTMLElement): boolean {
  const normalized = buildToolCardSignature(card).toLowerCase();
  if (!normalized) {
    return false;
  }

  const hasArtifactPath = ARTIFACT_CARD_EXTENSIONS.some((extension) =>
    normalized.includes(`.${extension}`),
  );
  if (hasArtifactPath) {
    return true;
  }

  return ARTIFACT_CARD_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function findLatestArtifactToolCard(host: HTMLElement): HTMLElement | null {
  const groups = Array.from(host.querySelectorAll('.chat-group.assistant')).reverse();
  for (const group of groups) {
    const cards = Array.from(group.querySelectorAll('.chat-tool-card--clickable')).reverse();
    if (cards.length === 0) {
      continue;
    }
    for (const candidate of cards) {
      if (candidate instanceof HTMLElement && isLikelyArtifactToolCard(candidate)) {
        return candidate;
      }
    }
    return null;
  }
  return null;
}

function collectLatestArtifactKinds(host: HTMLElement | null): ReturnType<typeof inferChatTurnArtifactsFromText> {
  if (!host) {
    return [];
  }

  const groups = Array.from(host.querySelectorAll('.chat-group.assistant')).reverse();
  for (const group of groups) {
    const cards = Array.from(group.querySelectorAll('.chat-tool-card--clickable')).filter(
      (node): node is HTMLElement => node instanceof HTMLElement && isLikelyArtifactToolCard(node),
    );
    if (cards.length === 0) {
      continue;
    }

    const artifacts = new Set<ReturnType<typeof inferChatTurnArtifactsFromText>[number]>();
    cards.forEach((card) => {
      inferChatTurnArtifactsFromText(buildToolCardSignature(card)).forEach((artifact) => {
        artifacts.add(artifact);
      });
    });

    if (artifacts.size > 0) {
      return Array.from(artifacts);
    }
  }

  return [];
}

function hasVisibleMessageContent(group: HTMLElement): boolean {
  return Array.from(group.querySelectorAll('.chat-text, .chat-message')).some((node) => {
    if (
      !(node instanceof HTMLElement) ||
      node.hasAttribute('hidden') ||
      (node.parentElement?.closest('[hidden]') ?? null)
    ) {
      return false;
    }
    return Boolean(node.textContent?.replace(/\s+/g, ' ').trim());
  });
}

function isToolLikeChatGroup(group: HTMLElement): boolean {
  return Boolean(group.querySelector('.chat-tool-card, .chat-tools-collapse, .chat-tool-msg-collapse, .chat-json-collapse'));
}

function buildNormalizedGroupText(group: HTMLElement): string {
  return group.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';
}

function normalizeTurnFocusText(value: string): string {
  return value
    .replace(/\[\[(?:引用|图片|PDF|视频|附件):[\s\S]*?\]\]/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findFocusedTurnGroup(host: HTMLElement, prompt: string): HTMLElement | null {
  const normalizedPrompt = normalizeTurnFocusText(prompt);
  if (!normalizedPrompt) {
    return null;
  }

  let bestMatch: { group: HTMLElement; score: number } | null = null;
  const groups = Array.from(host.querySelectorAll('.chat-group.user')).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );

  for (const group of groups) {
    const textNodes = Array.from(group.querySelectorAll('.chat-text'))
      .map((node) => normalizeTurnFocusText(node.textContent ?? ''))
      .filter(Boolean);
    const normalizedGroupText = textNodes.join(' ').trim();
    if (!normalizedGroupText) {
      continue;
    }
    if (
      !normalizedGroupText.includes(normalizedPrompt) &&
      !normalizedPrompt.includes(normalizedGroupText)
    ) {
      continue;
    }

    const score = Math.min(normalizedGroupText.length, normalizedPrompt.length);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { group, score };
    }
  }

  return bestMatch?.group ?? null;
}

function isLikelyInternalToolTraceGroup(group: HTMLElement): boolean {
  const normalized = buildNormalizedGroupText(group);
  if (!normalized) {
    return false;
  }

  const hasToolOutputHeading = normalized.includes('tool output');
  const hasCommandTrace = normalized.includes('command:');
  const hasToolCompletionTrace =
    normalized.includes('tool completed successfully') ||
    normalized.includes('no output') ||
    normalized.includes('no output - tool completed successfully');
  const hasFileActionTrace =
    normalized.includes(' with from ') ||
    normalized.includes(' with to ') ||
    normalized.includes('/users/') ||
    normalized.includes('/tmp/');

  if (hasToolOutputHeading && (hasCommandTrace || hasToolCompletionTrace || hasFileActionTrace)) {
    return true;
  }

  return group.classList.contains('tool') && (hasCommandTrace || hasToolCompletionTrace);
}

function collapseArtifactToolCardInlineBody(card: HTMLElement): void {
  const inlineSections = Array.from(
    card.querySelectorAll('.chat-tool-card__output, .chat-tool-card__preview, .chat-tool-card__inline'),
  ).filter((node): node is HTMLElement => node instanceof HTMLElement);

  inlineSections.forEach((section) => {
    section.setAttribute('hidden', 'true');
    section.dataset.iclawArtifactInlineBody = 'collapsed';
  });
}

function resolveToolCardVisualVariant(card: HTMLElement): 'running' | 'success' | 'error' | 'artifact' {
  if (isLikelyArtifactToolCard(card) || card.dataset.iclawToolCard === 'artifact') {
    return 'artifact';
  }

  const normalized = [
    card.dataset.iclawArtifactPath,
    buildToolCardSignature(card),
    card.querySelector('.chat-tool-card__status')?.textContent ?? '',
    card.querySelector('.chat-tool-card__status-text')?.textContent ?? '',
    card.querySelector('.chat-tool-card__action')?.textContent ?? '',
    card.querySelector('.chat-tool-card__output')?.textContent ?? '',
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!normalized) {
    return 'success';
  }

  if (
    /(error|failed|failure|exception|invalid|denied|timeout|timed out|unavailable|not found|refused|失败|错误|异常|超时|拒绝|无法|未能|无效|找不到)/i.test(
      normalized,
    )
  ) {
    return 'error';
  }

  if (
    /(running|working|processing|pending|executing|in progress|loading|thinking|generating|creating|准备中|执行中|处理中|运行中|等待中|思考中|生成中)/i.test(
      normalized,
    )
  ) {
    return 'running';
  }

  if (
    /(success|succeeded|completed|complete|finished|done|generated|created|opened|saved|成功|完成|已生成|已完成|已保存)/i.test(
      normalized,
    )
  ) {
    return 'success';
  }

  return 'success';
}

function normalizeToolCards(group: HTMLElement): void {
  const toolCards = Array.from(group.querySelectorAll('.chat-tool-card')).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
  const hasInternalTraceGroup = isLikelyInternalToolTraceGroup(group);
  if (toolCards.length === 0) {
    if (hasInternalTraceGroup) {
      group.dataset.iclawToolGroupState = 'internal';
      group.setAttribute('hidden', 'true');
      return;
    }
    group.removeAttribute('data-iclaw-tool-group-state');
    if (group.hasAttribute('hidden') && !group.classList.contains('tool')) {
      group.removeAttribute('hidden');
    }
    return;
  }

  let artifactCardCount = 0;
  toolCards.forEach((card) => {
    card.dataset.iclawToolVariant = resolveToolCardVisualVariant(card);
    if (isLikelyArtifactToolCard(card)) {
      artifactCardCount += 1;
      collapseArtifactToolCardInlineBody(card);
      card.removeAttribute('hidden');
      card.dataset.iclawToolCard = 'artifact';
      const artifactPath = extractArtifactPathFromCard(card);
      if (artifactPath) {
        card.dataset.iclawArtifactPath = artifactPath;
      } else {
        delete card.dataset.iclawArtifactPath;
      }
      return;
    }
    card.setAttribute('hidden', 'true');
    card.dataset.iclawToolCard = 'internal';
  });

  group.dataset.iclawToolGroupState = artifactCardCount > 0 ? 'artifact' : 'internal';
  if (artifactCardCount > 0) {
    group.removeAttribute('hidden');
    return;
  }

  if (group.classList.contains('tool') || hasInternalTraceGroup || !hasVisibleMessageContent(group)) {
    group.setAttribute('hidden', 'true');
    return;
  }

  group.removeAttribute('hidden');
}

type ChatApprovalRiskLevel = 'low' | 'medium' | 'high' | 'critical';

type ParsedApprovalActionGroup = {
  intent: string;
  command: string | null;
  riskLevel: ChatApprovalRiskLevel;
  requiresElevation: boolean;
  uploadsData: boolean;
  isReadOnly: boolean;
  paths: string[];
  timeoutLabel: string | null;
  buttons: HTMLButtonElement[];
};

type ApprovalActionSlot = 'once' | 'task' | 'session' | 'reject';

type HighRiskConfirmationRequest = Omit<
  HighRiskConfirmationModalProps,
  'open' | 'onOpenChange' | 'onConfirm' | 'onCancel'
> & {
  onConfirm: () => void;
  onCancel?: () => void;
};

const CHAT_HIGH_RISK_CONFIRMATION_EVENT = 'iclaw:chat-high-risk-confirmation';

const CHAT_APPROVAL_POSITIVE_LABEL_PATTERNS = [
  /(allow|允许|批准|同意|继续执行|继续|执行)/i,
  /(session|会话|task|任务|once|一次)/i,
];

const CHAT_APPROVAL_NEGATIVE_LABEL_PATTERN = /(reject|拒绝|取消|deny|不允许|停止)/i;

function normalizeApprovalActionButtonLabel(value: string): string {
  return value.replace(/^\s*\d+\s*[.)、：:-]?\s*/, '').replace(/\s+/g, ' ').trim();
}

function classifyApprovalActionSlot(label: string): ApprovalActionSlot | null {
  if (CHAT_APPROVAL_NEGATIVE_LABEL_PATTERN.test(label)) {
    return 'reject';
  }
  if (/(session|会话)/i.test(label)) {
    return 'session';
  }
  if (/(task|任务)/i.test(label)) {
    return 'task';
  }
  if (/(once|一次)/i.test(label) || /(allow|允许|批准|同意|继续执行|继续|执行)/i.test(label)) {
    return 'once';
  }
  return null;
}

function collectApprovalActionButtons(group: HTMLElement): HTMLButtonElement[] {
  return Array.from(group.querySelectorAll<HTMLButtonElement>('.chat-group-messages button')).filter((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return false;
    }
    if (button.closest('.iclaw-chat-approval-card, .iclaw-chat-assistant-footer')) {
      return false;
    }
    const label = normalizeApprovalActionButtonLabel(button.textContent ?? '');
    if (!label) {
      return false;
    }
    return (
      CHAT_APPROVAL_NEGATIVE_LABEL_PATTERN.test(label) ||
      CHAT_APPROVAL_POSITIVE_LABEL_PATTERNS.some((pattern) => pattern.test(label))
    );
  });
}

function extractApprovalCommandText(group: HTMLElement): string | null {
  const preformattedNodes = Array.from(group.querySelectorAll('pre, code')).filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && node.closest('.iclaw-chat-approval-card') === null,
  );
  for (const node of preformattedNodes) {
    const text = node.textContent?.trim() ?? '';
    if (text) {
      return text;
    }
  }

  const fullText = extractChatGroupText(group);
  const commandLine = fullText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) =>
      /^(sudo|rm\b|cat\b|ls\b|cp\b|mv\b|chmod\b|chown\b|tee\b|curl\b|wget\b|pnpm\b|npm\b|yarn\b|python\b|node\b|bash\b|sh\b|git\b|systemctl\b|launchctl\b|powershell\b|pwsh\b|cmd\b|reg\b|sc\b)/i.test(
        line,
      ),
    );
  return commandLine || null;
}

function extractApprovalPaths(text: string): string[] {
  const matches = text.match(/(?:[A-Za-z]:\\[^\s"'`<>|]+|(?:~|\/)[^\s"'`<>|]+)/g) ?? [];
  const unique = new Set<string>();
  matches.forEach((match) => {
    const normalized = match.replace(/[),.;:]+$/, '').trim();
    if (normalized) {
      unique.add(normalized);
    }
  });
  return Array.from(unique).slice(0, 6);
}

function inferApprovalRiskLevel(text: string, options: { requiresElevation: boolean; uploadsData: boolean }): ChatApprovalRiskLevel {
  const normalized = text.toLowerCase();
  if (
    /(rm\s+-rf|iptables|sudoers|reg\s+add|reg\s+delete|format\b|diskpart|bcdedit|shutdown\b|reboot\b|launchctl\s+bootout|systemctl\s+(?:stop|disable|mask|restart))/i.test(
      normalized,
    )
  ) {
    return 'critical';
  }
  if (
    options.uploadsData ||
    /(curl\b|wget\b|scp\b|s3\b|minio\b|upload|上传|远端|云端|external network|公网)/i.test(normalized)
  ) {
    return options.requiresElevation ? 'critical' : 'high';
  }
  if (
    options.requiresElevation ||
    /(sudo\b|管理员权限|elevated|提权|写入|delete|删除|修改|变更|install|安装|restart|重启)/i.test(normalized)
  ) {
    return 'high';
  }
  if (/(write|写入|create|创建|move|移动|copy|复制|rename|重命名)/i.test(normalized)) {
    return 'medium';
  }
  return 'low';
}

function resolveApprovalFallbackIntent(parsed: {
  requiresElevation: boolean;
  uploadsData: boolean;
  isReadOnly: boolean;
}): string {
  if (parsed.requiresElevation && parsed.uploadsData) {
    return '需要管理员权限并可能上传本地诊断信息，继续前需要你的授权。';
  }
  if (parsed.requiresElevation) {
    return '需要管理员权限来执行本地命令，继续前需要你的授权。';
  }
  if (parsed.uploadsData) {
    return '需要上传本地数据到远端服务，继续前需要你的授权。';
  }
  if (parsed.isReadOnly) {
    return '需要读取本地环境信息来继续处理当前任务。';
  }
  return '需要执行本地动作来继续处理当前任务。';
}

function parseApprovalActionGroup(group: HTMLElement): ParsedApprovalActionGroup | null {
  const buttons = collectApprovalActionButtons(group);
  if (buttons.length < 2) {
    return null;
  }

  const fullText = extractChatGroupText(group);
  const normalized = fullText.replace(/\s+/g, ' ').trim();
  if (
    !/(授权|允许执行|allow|approve|批准|是否允许|执行这个命令|执行命令|管理员权限|elevated|sudo)/i.test(normalized)
  ) {
    return null;
  }

  const command = extractApprovalCommandText(group);
  const paths = extractApprovalPaths(`${normalized}\n${command ?? ''}`);
  const requiresElevation =
    /(管理员权限|elevated|sudo|uac|root permission)/i.test(normalized) || /(^|\s)sudo(\s|$)/i.test(command ?? '');
  const uploadsData =
    /(上传|远端|云端|upload|s3|minio|curl\b|wget\b|scp\b|https?:\/\/)/i.test(normalized) ||
    /(curl\b|wget\b|scp\b|https?:\/\/)/i.test(command ?? '');
  const isReadOnly =
    !requiresElevation &&
    !uploadsData &&
    !/(写入|删除|修改|install|restart|tee\b|rm\b|mv\b|chmod\b|chown\b|touch\b|echo\s+.+>|cp\b)/i.test(
      `${normalized}\n${command ?? ''}`,
    );

  const intentCandidates = normalized
    .split(/(?<=[。！？!?])\s+|\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => segment !== command)
    .filter((segment) => !/^(\d+\s*[.)、：:-]?\s*)?(允许|本任务允许|本会话允许|拒绝|allow|reject|deny)/i.test(segment))
    .filter((segment) => !/^\d+\s*秒后自动取消/.test(segment));

  const intent =
    intentCandidates.find((segment) => segment.length >= 8 && !/^(sudo|rm\b|cat\b|ls\b|curl\b|pnpm\b|npm\b|python\b)/i.test(segment)) ||
    resolveApprovalFallbackIntent({ requiresElevation, uploadsData, isReadOnly });

  const timeoutMatch = normalized.match(/(\d+\s*秒后自动取消)/);

  return {
    intent,
    command,
    riskLevel: inferApprovalRiskLevel(`${normalized}\n${command ?? ''}`, { requiresElevation, uploadsData }),
    requiresElevation,
    uploadsData,
    isReadOnly,
    paths,
    timeoutLabel: timeoutMatch?.[1] ?? null,
    buttons,
  };
}

function clearApprovalActionCard(group: HTMLElement): void {
  group.querySelectorAll<HTMLElement>('[data-iclaw-approval-card="true"]').forEach((node) => node.remove());
  group.querySelectorAll<HTMLElement>('[data-iclaw-approval-hidden="true"]').forEach((node) => {
    node.removeAttribute('hidden');
    delete node.dataset.iclawApprovalHidden;
  });
}

function summarizeApprovalCommand(command: string | null): string {
  const normalized = (command ?? '').trim();
  if (!normalized) {
    return '当前动作未返回可展示的命令摘要';
  }
  const firstLine = normalized.split(/\r?\n/).find((line) => line.trim())?.trim() ?? normalized;
  return firstLine.length > 160 ? `${firstLine.slice(0, 157)}...` : firstLine;
}

function buildHighRiskConfirmationRequest(
  parsed: ParsedApprovalActionGroup,
  onConfirm: () => void,
): HighRiskConfirmationRequest {
  const impactItems: HighRiskImpactItem[] = [];

  parsed.paths.forEach((path) => {
    impactItems.push({
      type: path.includes('.') ? 'file' : 'directory',
      value: path,
    });
  });

  impactItems.push({
    type: 'privilege',
    label: '权限等级',
    value: parsed.requiresElevation ? '需要管理员权限后才可执行' : parsed.isReadOnly ? '当前动作为只读访问' : '普通本地权限',
  });

  impactItems.push({
    type: 'cloud',
    label: '网络传输',
    value: parsed.uploadsData ? '动作会上传本地数据到远端服务' : '动作本身不涉及远端上传',
  });

  const title =
    parsed.riskLevel === 'critical'
      ? '这是一个严重风险动作，执行前需要你再次确认'
      : '这是一个高危动作，执行前需要你再次确认';

  const description = parsed.intent;

  const rollbackStatus: HighRiskRollbackStatus =
    parsed.uploadsData ? 'partial' : parsed.requiresElevation && !parsed.isReadOnly ? 'partial' : parsed.isReadOnly ? 'full' : 'none';

  const rollbackDescription =
    rollbackStatus === 'full'
      ? '该动作以读取和诊断为主，可通过停止执行或关闭本次任务完全回退。'
      : rollbackStatus === 'partial'
        ? '该动作可能涉及系统状态修改或数据上传，部分影响可通过后续修复撤回，但已上传数据无法保证完全回退。'
        : '该动作可能直接修改本地环境或系统配置，执行后不保证可以自动恢复到原状态。';

  const reason =
    parsed.requiresElevation
      ? '该动作需要更高系统权限才能完成目标，继续前你需要确认这是你预期的系统级操作。'
      : parsed.uploadsData
        ? '该动作会把本地信息发送到远端服务，继续前你需要确认这些数据允许被上传。'
        : '该动作会对本地环境产生较强影响，继续前你需要确认影响范围和后果。';

  return {
    riskLevel: parsed.riskLevel === 'critical' ? 'critical' : 'high',
    title,
    description,
    reason,
    impactItems,
    rollbackStatus,
    rollbackDescription,
    commandSummary: summarizeApprovalCommand(parsed.command),
    fullCommand: parsed.command,
    requireAcknowledgement: true,
    acknowledgementText: '我已知晓该操作可能影响本地系统、文件或隐私数据',
    confirmText: '确认执行',
    cancelText: '取消',
    onConfirm,
  };
}

function buildApprovalRollbackHint(parsed: ParsedApprovalActionGroup): { available: boolean; note: string } {
  if (parsed.isReadOnly && !parsed.uploadsData && !parsed.requiresElevation) {
    return {
      available: true,
      note: '当前动作仅用于读取和诊断，不会修改本地环境，无需额外回滚。',
    };
  }
  if (parsed.uploadsData) {
    return {
      available: false,
      note: '若涉及日志或本地数据上传，远端已接收的数据无法保证自动撤回，请在执行前确认可上传范围。',
    };
  }
  if (parsed.requiresElevation) {
    return {
      available: true,
      note: '该动作可能修改系统或应用配置，建议在执行后保留当前会话，便于 AI 继续完成校验和必要的修复回退。',
    };
  }
  return {
    available: true,
    note: '该动作影响范围相对有限，如结果不符合预期，可在当前任务中继续要求 AI 执行补救或恢复动作。',
  };
}

function normalizeApprovalActionCard(group: HTMLElement): void {
  clearApprovalActionCard(group);

  const parsed = parseApprovalActionGroup(group);
  if (!parsed) {
    return;
  }

  const messages = group.querySelector('.chat-group-messages') as HTMLElement | null;
  if (!messages) {
    return;
  }

  Array.from(messages.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) {
      return;
    }
    if (child.classList.contains('iclaw-chat-assistant-footer')) {
      return;
    }
    child.dataset.iclawApprovalHidden = 'true';
    child.setAttribute('hidden', 'true');
  });

  const footer = messages.querySelector(':scope > .iclaw-chat-assistant-footer');
  const card = document.createElement('section');
  card.className = 'iclaw-chat-approval-card';
  card.dataset.iclawApprovalCard = 'true';
  card.dataset.iclawRiskLevel = parsed.riskLevel;
  card.dataset.iclawApprovalStatus = 'pending';

  const commandMarkup = parsed.command
    ? `<pre class="iclaw-chat-approval-card__command"></pre>`
    : '<div class="iclaw-chat-approval-card__empty">当前未返回可展示的命令明细</div>';

  const pathMarkup =
    parsed.paths.length > 0
      ? `<div class="iclaw-chat-approval-card__paths"></div>`
      : '';

  const timeoutMarkup = parsed.timeoutLabel
    ? `<span class="iclaw-chat-approval-card__timeout">${parsed.timeoutLabel}</span>`
    : '';

  const rollbackHint = buildApprovalRollbackHint(parsed);

  card.innerHTML = `
    <div class="iclaw-chat-approval-card__header">
      <div class="iclaw-chat-approval-card__icon" aria-hidden="true"></div>
      <div class="iclaw-chat-approval-card__headline">
        <div class="iclaw-chat-approval-card__title-row">
          <h3 class="iclaw-chat-approval-card__title">需要你的授权</h3>
          <span class="iclaw-chat-approval-card__badge"></span>
        </div>
        <p class="iclaw-chat-approval-card__intent"></p>
      </div>
    </div>
    <div class="iclaw-chat-approval-card__impact">
      <div class="iclaw-chat-approval-card__impact-grid">
        <div class="iclaw-chat-approval-card__impact-item">
          <span class="iclaw-chat-approval-card__impact-label">资源范围</span>
          <strong class="iclaw-chat-approval-card__impact-value">${parsed.paths.length > 0 ? `${parsed.paths.length} 个路径` : '当前动作'}</strong>
        </div>
        <div class="iclaw-chat-approval-card__impact-item">
          <span class="iclaw-chat-approval-card__impact-label">权限需求</span>
          <strong class="iclaw-chat-approval-card__impact-value">${parsed.requiresElevation ? '需要管理员权限' : parsed.isReadOnly ? '仅读取，不修改' : '普通权限'}</strong>
        </div>
        <div class="iclaw-chat-approval-card__impact-item">
          <span class="iclaw-chat-approval-card__impact-label">网络传输</span>
          <strong class="iclaw-chat-approval-card__impact-value">${parsed.uploadsData ? '上传到远端' : '不会上传远端'}</strong>
        </div>
      </div>
    </div>
    <button type="button" class="iclaw-chat-approval-card__toggle" aria-expanded="false">
      查看技术细节
    </button>
    <div class="iclaw-chat-approval-card__details" hidden>
      <div class="iclaw-chat-approval-card__details-inner">
        <div class="iclaw-chat-approval-card__detail-group">
          <div class="iclaw-chat-approval-card__detail-title-row">
            <span class="iclaw-chat-approval-card__detail-title">执行命令</span>
            ${timeoutMarkup}
          </div>
          ${commandMarkup}
        </div>
        ${pathMarkup}
        <div class="iclaw-chat-approval-card__detail-group">
          <div class="iclaw-chat-approval-card__detail-title-row">
            <span class="iclaw-chat-approval-card__detail-title">回滚提示</span>
            <span class="iclaw-chat-approval-card__rollback-chip" data-iclaw-rollback="${rollbackHint.available ? 'yes' : 'no'}">
              ${rollbackHint.available ? '支持补救' : '谨慎执行'}
            </span>
          </div>
          <div class="iclaw-chat-approval-card__rollback-note">${rollbackHint.note}</div>
        </div>
      </div>
    </div>
    <div class="iclaw-chat-approval-card__actions">
      <button type="button" class="iclaw-chat-approval-card__action iclaw-chat-approval-card__action--reject" data-iclaw-action-slot="reject">拒绝</button>
      <div class="iclaw-chat-approval-card__action-group"></div>
    </div>
    <div class="iclaw-chat-approval-card__footer" hidden></div>
  `;

  const intentNode = card.querySelector('.iclaw-chat-approval-card__intent') as HTMLParagraphElement | null;
  if (intentNode) {
    intentNode.textContent = parsed.intent;
  }
  const badgeNode = card.querySelector('.iclaw-chat-approval-card__badge') as HTMLSpanElement | null;
  if (badgeNode) {
    const labels: Record<ChatApprovalRiskLevel, string> = {
      low: '低风险',
      medium: '中风险',
      high: '高风险',
      critical: '极高风险',
    };
    badgeNode.textContent = labels[parsed.riskLevel];
  }

  const commandNode = card.querySelector('.iclaw-chat-approval-card__command') as HTMLPreElement | null;
  if (commandNode && parsed.command) {
    commandNode.textContent = parsed.command;
  }

  const pathsNode = card.querySelector('.iclaw-chat-approval-card__paths') as HTMLDivElement | null;
  if (pathsNode) {
    const title = document.createElement('div');
    title.className = 'iclaw-chat-approval-card__detail-title';
    title.textContent = '涉及路径';
    pathsNode.append(title);
    parsed.paths.forEach((path) => {
      const item = document.createElement('div');
      item.className = 'iclaw-chat-approval-card__path';
      item.textContent = path;
      pathsNode.append(item);
    });
  }

  const details = card.querySelector('.iclaw-chat-approval-card__details') as HTMLDivElement | null;
  const toggle = card.querySelector('.iclaw-chat-approval-card__toggle') as HTMLButtonElement | null;
  toggle?.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    toggle.textContent = expanded ? '查看技术细节' : '收起技术细节';
    if (details) {
      if (expanded) {
        details.setAttribute('hidden', 'true');
      } else {
        details.removeAttribute('hidden');
      }
    }
  });

  const actionGroup = card.querySelector('.iclaw-chat-approval-card__action-group') as HTMLDivElement | null;
  const rejectButton = card.querySelector('[data-iclaw-action-slot="reject"]') as HTMLButtonElement | null;
  const footerNode = card.querySelector('.iclaw-chat-approval-card__footer') as HTMLDivElement | null;
  const titleNode = card.querySelector('.iclaw-chat-approval-card__title') as HTMLHeadingElement | null;
  const slotButtons = new Map<ApprovalActionSlot, HTMLButtonElement>();

  const actionOrder: Array<{ slot: Exclude<ApprovalActionSlot, 'reject'>; label: string; tone: string }> = [
    { slot: 'once', label: '允许一次', tone: 'secondary' },
    { slot: 'task', label: '本任务允许', tone: 'secondary' },
    { slot: 'session', label: '本会话允许', tone: 'primary' },
  ];

  actionOrder.forEach(({ slot, label, tone }) => {
    const proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.textContent = label;
    proxy.className = `iclaw-chat-approval-card__action iclaw-chat-approval-card__action--${tone}`;
    proxy.dataset.iclawActionSlot = slot;
    proxy.hidden = true;
    proxy.disabled = true;
    slotButtons.set(slot, proxy);
    actionGroup?.append(proxy);
  });

  const settleCard = (status: 'approved' | 'rejected') => {
    card.dataset.iclawApprovalStatus = status;
    if (titleNode) {
      titleNode.textContent = status === 'approved' ? '已授权' : '已拒绝';
    }
    toggle?.setAttribute('hidden', 'true');
    actionGroup?.setAttribute('hidden', 'true');
    rejectButton?.setAttribute('hidden', 'true');
    if (footerNode) {
      footerNode.hidden = false;
      footerNode.textContent =
        status === 'approved' ? '✓ 操作已执行，AI 正在继续处理当前任务。' : '✗ 此操作已被拒绝，AI 将尝试寻找其他方案。';
    }
  };

  parsed.buttons.forEach((originalButton) => {
    const label = normalizeApprovalActionButtonLabel(originalButton.textContent ?? '');
    const slot = classifyApprovalActionSlot(label);
    if (!slot) {
      return;
    }

    const proxy = slot === 'reject' ? rejectButton : slotButtons.get(slot);
    if (!proxy) {
      return;
    }
    proxy.hidden = false;
    proxy.disabled = false;
    proxy.dataset.iclawOriginalLabel = label;

    proxy.addEventListener('click', () => {
      const isReject = CHAT_APPROVAL_NEGATIVE_LABEL_PATTERN.test(label);
      const commitDecision = () => {
        settleCard(isReject ? 'rejected' : 'approved');
        originalButton.click();
      };

      if (!isReject && (parsed.riskLevel === 'high' || parsed.riskLevel === 'critical')) {
        window.dispatchEvent(
          new CustomEvent<HighRiskConfirmationRequest>(CHAT_HIGH_RISK_CONFIRMATION_EVENT, {
            detail: buildHighRiskConfirmationRequest(parsed, commitDecision),
          }),
        );
        return;
      }

      commitDecision();
    });
  });

  if (rejectButton?.hidden) {
    rejectButton?.remove();
  }

  if (footer instanceof HTMLElement) {
    messages.insertBefore(card, footer);
  } else {
    messages.append(card);
  }
}

function createReferenceChip(text: string): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = 'iclaw-chat-inline-reference';

  const badge = document.createElement('span');
  badge.className = 'iclaw-chat-inline-reference__badge';
  badge.textContent = '引';

  const label = document.createElement('span');
  label.className = 'iclaw-chat-inline-reference__label';
  label.textContent = text;

  chip.append(badge, label);
  return chip;
}

function isSemanticDirectiveElement(node: Element | null): node is HTMLParagraphElement {
  return node instanceof HTMLParagraphElement;
}

function isSemanticHeadingCandidateElement(node: Element | null): node is HTMLElement {
  return (
    node instanceof HTMLElement &&
    ['P', 'H1', 'H2', 'H3', 'H4'].includes(node.tagName)
  );
}

function createSemanticCallout(tone: ChatSemanticTone, title: string): {
  wrapper: HTMLDivElement;
  body: HTMLDivElement;
} {
  const wrapper = document.createElement('div');
  wrapper.className = `iclaw-chat-semantic-callout iclaw-chat-semantic-callout--${tone}`;
  wrapper.dataset.iclawSemanticCallout = tone;

  const header = document.createElement('div');
  header.className = 'iclaw-chat-semantic-callout__header';

  const dot = document.createElement('span');
  dot.className = 'iclaw-chat-semantic-callout__dot';
  dot.setAttribute('aria-hidden', 'true');

  const titleElement = document.createElement('div');
  titleElement.className = 'iclaw-chat-semantic-callout__title';
  titleElement.textContent = title;

  const body = document.createElement('div');
  body.className = 'iclaw-chat-semantic-callout__body';

  header.append(dot, titleElement);
  wrapper.append(header, body);

  return { wrapper, body };
}

function trimLeadingTextFromElement(element: HTMLElement, leadingText: string): void {
  if (!leadingText) {
    return;
  }

  let remaining = leadingText.length;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (remaining > 0 && walker.nextNode()) {
    const current = walker.currentNode;
    if (!(current instanceof Text)) {
      continue;
    }

    const source = current.nodeValue ?? '';
    if (!source) {
      continue;
    }

    if (source.length <= remaining) {
      current.nodeValue = '';
      remaining -= source.length;
      continue;
    }

    current.nodeValue = source.slice(remaining);
    remaining = 0;
  }
}

function applySemanticDirectiveBlocks(container: HTMLElement): void {
  while (true) {
    const children = Array.from(container.children);
    let transformed = false;

    for (let index = 0; index < children.length; index += 1) {
      const start = children[index];
      if (!isSemanticDirectiveElement(start)) {
        continue;
      }

      const directive = parseChatSemanticDirective(start.textContent ?? '');
      if (!directive) {
        continue;
      }

      const collected: HTMLElement[] = [];
      let closeElement: HTMLParagraphElement | null = null;

      for (let innerIndex = index + 1; innerIndex < children.length; innerIndex += 1) {
        const current = children[innerIndex];
        if (isSemanticDirectiveElement(current) && isChatSemanticDirectiveClose(current.textContent ?? '')) {
          closeElement = current;
          break;
        }
        if (current instanceof HTMLElement) {
          collected.push(current);
        }
      }

      if (!closeElement || collected.length === 0) {
        continue;
      }

      const title = directive.title?.trim() || resolveChatSemanticDefaultTitle(directive.tone);
      const { wrapper, body } = createSemanticCallout(directive.tone, title);
      collected.forEach((node) => body.append(node));
      start.replaceWith(wrapper);
      closeElement.remove();
      transformed = true;
      break;
    }

    if (!transformed) {
      return;
    }
  }
}

function applySemanticHeadingBlocks(container: HTMLElement): void {
  while (true) {
    const children = Array.from(container.children);
    let transformed = false;

    for (let index = 0; index < children.length; index += 1) {
      const current = children[index];
      if (!isSemanticHeadingCandidateElement(current) || current.dataset.iclawSemanticCallout === 'true') {
        continue;
      }

      const heading = matchChatSemanticLead(current.textContent ?? '');
      if (!heading || !heading.standalone) {
        continue;
      }

      const collected: HTMLElement[] = [];
      for (let innerIndex = index + 1; innerIndex < children.length; innerIndex += 1) {
        const next = children[innerIndex];
        if (!(next instanceof HTMLElement)) {
          break;
        }
        if (matchChatSemanticLead(next.textContent ?? '') || parseChatSemanticDirective(next.textContent ?? '')) {
          break;
        }
        collected.push(next);
      }

      if (collected.length === 0) {
        continue;
      }

      const { wrapper, body } = createSemanticCallout(heading.tone, heading.title);
      collected.forEach((node) => body.append(node));
      current.replaceWith(wrapper);
      transformed = true;
      break;
    }

    if (!transformed) {
      return;
    }
  }
}

function applySemanticPrefixFormatting(container: HTMLElement): void {
  const elements = Array.from(container.querySelectorAll('p, li')).filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && node.closest('.iclaw-chat-semantic-callout') === null,
  );

  elements.forEach((element) => {
    if (element.dataset.iclawSemanticInline === 'true' || element.dataset.iclawSemanticCallout === 'true') {
      return;
    }

    const lead = matchChatSemanticLead(element.textContent ?? '');
    if (!lead || lead.standalone) {
      return;
    }

    if (element instanceof HTMLParagraphElement) {
      const clone = element.cloneNode(true) as HTMLParagraphElement;
      trimLeadingTextFromElement(clone, lead.matchedPrefix);
      const { wrapper, body } = createSemanticCallout(lead.tone, lead.title);
      body.append(clone);
      element.replaceWith(wrapper);
      return;
    }

    const label = document.createElement('span');
    label.className = `iclaw-chat-semantic-inline-label iclaw-chat-semantic-inline-label--${lead.tone}`;
    label.textContent = `${lead.label}：`;
    trimLeadingTextFromElement(element, lead.matchedPrefix);
    element.dataset.iclawSemanticInline = 'true';
    element.prepend(label, document.createTextNode(' '));
  });
}

function applySemanticFormattingToContainer(container: HTMLElement): void {
  applySemanticDirectiveBlocks(container);
  applySemanticHeadingBlocks(container);
  applySemanticPrefixFormatting(container);
}

function normalizeChatTableText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeChatTableToken(value: string | null | undefined): string {
  return normalizeChatTableText(value).toLowerCase();
}

function isDecorativeTableValue(value: string): boolean {
  return value === '' || value === '—' || value === '--' || value === '暂无' || value === 'n/a';
}

function isLikelyNumericTableValue(value: string): boolean {
  if (isDecorativeTableValue(value)) {
    return false;
  }

  const compact = value.replace(/[,\s，]/g, '');
  const match = compact.match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/);
  if (!match) {
    return false;
  }

  const unit = compact
    .slice((match.index ?? 0) + match[0].length)
    .replace(/[()]/g, '')
    .trim();
  return unit === '' || /^[%‰bpBPxXkKmMbBwW万亿元¥￥$秒分时天年sSmMhHdD]+$/.test(unit);
}

function isLikelyChangeTableValue(value: string): boolean {
  if (isDecorativeTableValue(value)) {
    return false;
  }
  const compact = value.replace(/\s+/g, '');
  return /^[+-]/.test(compact) || compact.includes('%') || compact.includes('bp');
}

function isLikelyKeyTableValue(value: string): boolean {
  if (isDecorativeTableValue(value)) {
    return false;
  }

  const compact = value.replace(/\s+/g, '');
  if (/^\d{4,8}$/.test(compact)) {
    return true;
  }
  if (/^[A-Z][A-Z0-9._-]{1,9}$/.test(compact)) {
    return true;
  }
  if (/^[a-z0-9._-]{3,24}$/.test(compact) && !/[一-龥]/.test(compact) && !compact.includes('/')) {
    return true;
  }
  return false;
}

function matchesEveryMeaningfulValue(values: string[], predicate: (value: string) => boolean): boolean {
  const meaningful = values.filter((value) => !isDecorativeTableValue(value));
  return meaningful.length > 0 && meaningful.every(predicate);
}

function resolveChatTableStatusTone(value: string): 'success' | 'running' | 'error' | 'pending' | 'default' {
  const normalized = normalizeChatTableToken(value);
  const match = CHAT_TABLE_STATUS_TONE_PATTERNS.find((item) => item.pattern.test(normalized));
  return match?.tone ?? 'default';
}

function resolveChatTableRiskTone(value: string): 'low' | 'medium' | 'high' | 'extreme' | 'default' {
  const normalized = normalizeChatTableToken(value);
  const match = CHAT_TABLE_RISK_TONE_PATTERNS.find((item) => item.pattern.test(normalized));
  return match?.tone ?? 'default';
}

function resolveChatTableChangeTone(value: string): 'positive' | 'negative' | 'neutral' {
  const normalized = normalizeChatTableText(value);
  if (!normalized) {
    return 'neutral';
  }
  if (/^[+＋]/.test(normalized)) {
    return 'positive';
  }
  if (/^[-−]/.test(normalized)) {
    return 'negative';
  }
  if (normalized.includes('上涨') || normalized.includes('增长')) {
    return 'positive';
  }
  if (normalized.includes('下跌') || normalized.includes('下降')) {
    return 'negative';
  }
  const numberMatch = normalized.match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/);
  const numericValue = numberMatch ? Number(numberMatch[0]) : null;
  if (numericValue == null || Number.isNaN(numericValue)) {
    return 'neutral';
  }
  if (numericValue > 0) {
    return 'positive';
  }
  if (numericValue < 0) {
    return 'negative';
  }
  return 'neutral';
}

function inferChatTableColumnType(headerText: string, values: string[], columnIndex: number): ChatTableColumnType {
  const normalizedHeader = normalizeChatTableToken(headerText);

  if (
    /^(状态|status|state|result status|执行状态)$/.test(normalizedHeader) ||
    matchesEveryMeaningfulValue(values, (value) => resolveChatTableStatusTone(value) !== 'default')
  ) {
    return 'status';
  }

  if (
    normalizedHeader.includes('风险') ||
    normalizedHeader.includes('risk') ||
    normalizedHeader.includes('评级') ||
    matchesEveryMeaningfulValue(values, (value) => resolveChatTableRiskTone(value) !== 'default')
  ) {
    return 'risk';
  }

  if (
    normalizedHeader.includes('代码') ||
    normalizedHeader.includes('ticker') ||
    normalizedHeader.includes('symbol') ||
    normalizedHeader.includes('slug') ||
    normalizedHeader.includes('编号') ||
    matchesEveryMeaningfulValue(values, isLikelyKeyTableValue) ||
    (columnIndex === 0 && matchesEveryMeaningfulValue(values, isLikelyKeyTableValue))
  ) {
    return 'key';
  }

  if (
    normalizedHeader.includes('涨跌') ||
    normalizedHeader.includes('收益') ||
    normalizedHeader.includes('回撤') ||
    normalizedHeader.includes('变化') ||
    normalizedHeader.includes('change') ||
    normalizedHeader.includes('return') ||
    normalizedHeader.includes('alpha') ||
    normalizedHeader.includes('beta') ||
    matchesEveryMeaningfulValue(values, isLikelyChangeTableValue)
  ) {
    return 'change';
  }

  if (
    normalizedHeader.includes('价格') ||
    normalizedHeader.includes('金额') ||
    normalizedHeader.includes('费') ||
    normalizedHeader.includes('净值') ||
    normalizedHeader.includes('规模') ||
    normalizedHeader.includes('数量') ||
    normalizedHeader.includes('耗时') ||
    normalizedHeader.includes('duration') ||
    normalizedHeader.includes('time') ||
    normalizedHeader.includes('value') ||
    normalizedHeader.includes('price') ||
    normalizedHeader.includes('volume') ||
    normalizedHeader.includes('cap') ||
    normalizedHeader.includes('pe') ||
    matchesEveryMeaningfulValue(values, isLikelyNumericTableValue)
  ) {
    return 'number';
  }

  return 'text';
}

function inferChatTableType(headers: string[], columnTypes: ChatTableColumnType[]): ChatTableType {
  const joinedHeaders = headers.map((value) => normalizeChatTableToken(value)).join(' | ');

  if (
    columnTypes.includes('status') ||
    joinedHeaders.includes('任务') ||
    joinedHeaders.includes('task') ||
    joinedHeaders.includes('摘要') ||
    joinedHeaders.includes('summary') ||
    joinedHeaders.includes('耗时')
  ) {
    return 'tool';
  }

  if (
    columnTypes.includes('change') ||
    columnTypes.includes('risk') ||
    joinedHeaders.includes('基金') ||
    joinedHeaders.includes('股票') ||
    joinedHeaders.includes('行情') ||
    joinedHeaders.includes('price') ||
    joinedHeaders.includes('nav') ||
    joinedHeaders.includes('ticker') ||
    joinedHeaders.includes('市值')
  ) {
    return 'market';
  }

  return 'narrative';
}

function resolveChatTableAlign(columnType: ChatTableColumnType): 'left' | 'right' | 'center' {
  if (columnType === 'number' || columnType === 'change') {
    return 'right';
  }
  if (columnType === 'status' || columnType === 'risk') {
    return 'center';
  }
  return 'left';
}

function resolveChatTableHeaderTone(seed: string): ChatTableHeaderTone {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % 2 === 0 ? 'blue' : 'green';
}

function ensureChatTableBadge(cell: HTMLTableCellElement, tone: string): void {
  let badge = cell.querySelector(':scope > .iclaw-chat-table-badge[data-iclaw-generated="true"]') as HTMLSpanElement | null;
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'iclaw-chat-table-badge';
    badge.dataset.iclawGenerated = 'true';
    const fragment = document.createDocumentFragment();
    while (cell.firstChild) {
      fragment.append(cell.firstChild);
    }
    badge.append(fragment);
    cell.append(badge);
  }
  badge.dataset.iclawBadgeTone = tone;
}

function clearChatTableBadge(cell: HTMLTableCellElement): void {
  const badge = cell.querySelector(':scope > .iclaw-chat-table-badge[data-iclaw-generated="true"]') as HTMLSpanElement | null;
  if (!badge) {
    return;
  }
  while (badge.firstChild) {
    cell.insertBefore(badge.firstChild, badge);
  }
  badge.remove();
}

function removeEmptyTrailingChatTableColumns(table: HTMLTableElement): void {
  const rows = Array.from(table.querySelectorAll(':scope > thead > tr, :scope > tbody > tr')).filter(
    (row): row is HTMLTableRowElement => row instanceof HTMLTableRowElement,
  );
  if (rows.length === 0) {
    return;
  }

  const maxColumnCount = rows.reduce((count, row) => Math.max(count, row.cells.length), 0);
  if (maxColumnCount <= 1) {
    return;
  }

  for (let columnIndex = maxColumnCount - 1; columnIndex >= 0; columnIndex -= 1) {
    let hasMeaningfulContent = false;

    rows.forEach((row) => {
      const cell = row.cells.item(columnIndex);
      if (!cell) {
        return;
      }
      const text = normalizeChatTableText(cell.textContent);
      if (text) {
        hasMeaningfulContent = true;
      }
    });

    if (hasMeaningfulContent) {
      break;
    }

    rows.forEach((row) => {
      row.cells.item(columnIndex)?.remove();
    });
  }
}

function ensureChatTableScrollChrome(table: HTMLTableElement): {
  card: HTMLDivElement;
  scrollContainer: HTMLDivElement;
} {
  const existingCard = table.closest(CHAT_TABLE_CARD_SELECTOR) as HTMLDivElement | null;
  if (existingCard) {
    const existingScrollContainer = existingCard.querySelector(
      `:scope > .iclaw-chat-table-scroll-region > ${CHAT_TABLE_SCROLL_CONTAINER_SELECTOR}`,
    ) as HTMLDivElement | null;
    if (existingScrollContainer) {
      return { card: existingCard, scrollContainer: existingScrollContainer };
    }
  }

  const card = document.createElement('div');
  card.className = 'iclaw-chat-table-card';

  const scrollRegion = document.createElement('div');
  scrollRegion.className = 'iclaw-chat-table-scroll-region';

  const leftIndicator = document.createElement('div');
  leftIndicator.className = 'iclaw-chat-table-scroll-indicator iclaw-chat-table-scroll-indicator--left';
  leftIndicator.setAttribute('aria-hidden', 'true');
  leftIndicator.innerHTML = `<span class="iclaw-chat-table-scroll-indicator__glyph">${CHAT_TABLE_LEFT_SCROLL_ICON}</span>`;

  const rightIndicator = document.createElement('div');
  rightIndicator.className = 'iclaw-chat-table-scroll-indicator iclaw-chat-table-scroll-indicator--right';
  rightIndicator.setAttribute('aria-hidden', 'true');
  rightIndicator.innerHTML = `<span class="iclaw-chat-table-scroll-indicator__glyph">${CHAT_TABLE_RIGHT_SCROLL_ICON}</span>`;

  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'iclaw-chat-table-scroll-container';

  const parent = table.parentElement;
  parent?.insertBefore(card, table);
  scrollContainer.append(table);
  scrollRegion.append(leftIndicator, scrollContainer, rightIndicator);
  card.append(scrollRegion);

  return { card, scrollContainer };
}

function syncChatTableHeader(card: HTMLDivElement, table: HTMLTableElement): void {
  const caption = table.querySelector(':scope > caption');
  const rawCaption = normalizeChatTableText(caption?.textContent);
  caption?.remove();

  const existingHeader = card.querySelector(':scope > .iclaw-chat-table-card__header') as HTMLDivElement | null;
  if (!rawCaption) {
    existingHeader?.remove();
    return;
  }

  const [title, ...rest] = rawCaption
    .split(/\n+/)
    .map((value) => normalizeChatTableText(value))
    .filter(Boolean);
  const subtitle = rest.join(' ');

  const header = existingHeader ?? document.createElement('div');
  header.className = 'iclaw-chat-table-card__header';

  let titleNode = header.querySelector(':scope > .iclaw-chat-table-card__title') as HTMLDivElement | null;
  if (!titleNode) {
    titleNode = document.createElement('div');
    titleNode.className = 'iclaw-chat-table-card__title';
    header.append(titleNode);
  }
  titleNode.textContent = title;

  let subtitleNode = header.querySelector(':scope > .iclaw-chat-table-card__subtitle') as HTMLDivElement | null;
  if (subtitle) {
    if (!subtitleNode) {
      subtitleNode = document.createElement('div');
      subtitleNode.className = 'iclaw-chat-table-card__subtitle';
      header.append(subtitleNode);
    }
    subtitleNode.textContent = subtitle;
  } else {
    subtitleNode?.remove();
  }

  if (!existingHeader) {
    card.prepend(header);
  }
}

function syncChatTableScrollState(card: HTMLDivElement, scrollContainer: HTMLDivElement): void {
  const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
  const scrollLeft = Math.max(0, scrollContainer.scrollLeft);
  card.dataset.scrollLeft = scrollLeft > 8 ? 'true' : 'false';
  card.dataset.scrollRight = scrollLeft < maxScrollLeft - 8 ? 'true' : 'false';
}

function syncChatTableLayout(
  card: HTMLDivElement,
  scrollContainer: HTMLDivElement,
  table: HTMLTableElement,
): void {
  const previousWidth = table.style.width;
  const previousMinWidth = table.style.minWidth;
  const previousMaxWidth = table.style.maxWidth;
  const previousTableLayout = table.style.tableLayout;

  table.style.width = 'max-content';
  table.style.minWidth = '0';
  table.style.maxWidth = 'none';
  table.style.tableLayout = 'auto';
  const intrinsicWidth = Math.ceil(table.getBoundingClientRect().width);

  table.style.width = previousWidth;
  table.style.minWidth = previousMinWidth;
  table.style.maxWidth = previousMaxWidth;
  table.style.tableLayout = previousTableLayout;

  const containerWidth = Math.ceil(scrollContainer.clientWidth);
  const layout = intrinsicWidth > containerWidth + 1 ? 'scroll' : 'fit';
  card.dataset.iclawTableLayout = layout;
  table.dataset.iclawTableLayout = layout;

  if (layout === 'fit') {
    card.style.width = 'fit-content';
    card.style.maxWidth = '100%';
    scrollContainer.style.width = 'fit-content';
    scrollContainer.style.maxWidth = '100%';
    table.style.width = 'max-content';
    table.style.minWidth = '0';
    table.style.maxWidth = 'none';
    table.style.tableLayout = 'auto';
    return;
  }

  card.style.width = '100%';
  card.style.maxWidth = '100%';
  scrollContainer.style.width = '100%';
  scrollContainer.style.maxWidth = '100%';
  table.style.width = 'max-content';
  table.style.minWidth = '100%';
  table.style.maxWidth = 'none';
  table.style.tableLayout = 'auto';
}

function enhanceChatMarkdownTable(table: HTMLTableElement): void {
  removeEmptyTrailingChatTableColumns(table);

  const rows = Array.from(table.querySelectorAll(':scope > tbody > tr'));
  const headerCells = Array.from(table.querySelectorAll(':scope > thead > tr:first-child > th')).filter(
    (cell): cell is HTMLTableCellElement => cell instanceof HTMLTableCellElement,
  );
  if (headerCells.length === 0 || rows.length === 0) {
    return;
  }

  const headers = headerCells.map((cell) => normalizeChatTableText(cell.textContent));
  const valuesByColumn = headers.map((_, columnIndex) =>
    rows
      .map((row) => {
        const cell = row.children.item(columnIndex);
        return cell instanceof HTMLTableCellElement ? normalizeChatTableText(cell.textContent) : '';
      })
      .filter((value) => value.length > 0),
  );
  const columnTypes = headers.map((header, columnIndex) =>
    inferChatTableColumnType(header, valuesByColumn[columnIndex] ?? [], columnIndex),
  );
  const tableType = inferChatTableType(headers, columnTypes);
  const { card, scrollContainer } = ensureChatTableScrollChrome(table);
  const headerTone = resolveChatTableHeaderTone(headers.join('|') || normalizeChatTableText(table.textContent));

  table.dataset.iclawChatTableEnhanced = 'true';
  table.dataset.iclawChatTableType = tableType;
  card.dataset.iclawTableType = tableType;
  card.dataset.iclawHeaderTone = headerTone;
  syncChatTableHeader(card, table);

  headerCells.forEach((cell, columnIndex) => {
    const columnType = columnTypes[columnIndex] ?? 'text';
    const align = resolveChatTableAlign(columnType);
    cell.dataset.iclawColumnType = columnType;
    cell.dataset.iclawColumnAlign = align;
  });

  rows.forEach((row) => {
    Array.from(row.children).forEach((cell, columnIndex) => {
      if (!(cell instanceof HTMLTableCellElement)) {
        return;
      }
      const columnType = columnTypes[columnIndex] ?? 'text';
      const align = resolveChatTableAlign(columnType);
      cell.dataset.iclawColumnType = columnType;
      cell.dataset.iclawColumnAlign = align;
      delete cell.dataset.iclawChangeTone;

      clearChatTableBadge(cell);
      if (columnType === 'status') {
        ensureChatTableBadge(cell, resolveChatTableStatusTone(normalizeChatTableText(cell.textContent)));
      } else if (columnType === 'risk') {
        ensureChatTableBadge(cell, resolveChatTableRiskTone(normalizeChatTableText(cell.textContent)));
      } else if (columnType === 'change') {
        cell.dataset.iclawChangeTone = resolveChatTableChangeTone(normalizeChatTableText(cell.textContent));
      }
    });
  });

  if (scrollContainer.dataset.iclawScrollBound !== 'true') {
    scrollContainer.dataset.iclawScrollBound = 'true';
    scrollContainer.addEventListener(
      'scroll',
      () => {
        syncChatTableScrollState(card, scrollContainer);
      },
      { passive: true },
    );
  }

  syncChatTableLayout(card, scrollContainer, table);
  syncChatTableScrollState(card, scrollContainer);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text.trim()) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

function extractChatGroupText(group: HTMLElement | null): string {
  if (!group) {
    return '';
  }

  const textBlocks = Array.from(group.querySelectorAll('.chat-text'))
    .map((node) => node.textContent?.replace(/\u00a0/g, ' ').trim() ?? '')
    .filter(Boolean);

  return textBlocks.join('\n\n').trim();
}

function extractMessageText(message: unknown): string {
  const normalized = normalizeMessage(message);
  return normalized.content
    .map((item) => (typeof item.text === 'string' ? item.text.replace(/\u00a0/g, ' ').trim() : ''))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function extractChatMessageGroupText(group: ChatMessageGroup | null): string {
  if (!group) {
    return '';
  }

  return group.messages
    .map((message) => extractMessageText(message))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

const INTERNAL_MEMORY_FLUSH_MARKERS = [
  'session nearing compaction. store durable memories now.',
  'write durable notes for decisions',
  'store durable memories only in memory/',
  'reply with no_reply',
] as const;

function normalizeInternalPromptText(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isInternalMemoryFlushPrompt(text: string): boolean {
  const normalized = normalizeInternalPromptText(text);
  if (!normalized) {
    return false;
  }

  let matchedMarkers = 0;
  INTERNAL_MEMORY_FLUSH_MARKERS.forEach((marker) => {
    if (normalized.includes(marker)) {
      matchedMarkers += 1;
    }
  });

  return matchedMarkers >= 2;
}

function setElementTextIfChanged(node: Node | null, nextText: string): void {
  if (!node) {
    return;
  }
  if (node.textContent === nextText) {
    return;
  }
  node.textContent = nextText;
}

function getUsageMetric(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return 0;
}

function formatAssistantFooterTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(readAppLocale(), {
    hour: 'numeric',
    minute: '2-digit',
  });
}

type AssistantMessageGroup = {
  role: string;
  timestamp: number;
  messages: unknown[];
  runId: string | null;
};

type ChatMessageGroup = {
  role: string;
  timestamp: number;
  messages: unknown[];
  runId: string | null;
};

type ChatMessageTurn = {
  startedAt: number;
  userGroup: ChatMessageGroup | null;
  assistantGroups: ChatMessageGroup[];
  runId: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function readBillingRunId(message: unknown): string | null {
  if (!isRecord(message)) {
    return null;
  }
  const runId = message[ICLAW_BILLING_RUN_ID_KEY];
  return typeof runId === 'string' && runId.trim() ? runId.trim() : null;
}

function collectMessageGroups(messages: unknown[]): ChatMessageGroup[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  let currentGroup: ChatMessageGroup | null = null;
  const groups: ChatMessageGroup[] = [];

  const finalizeCurrentGroup = () => {
    if (!currentGroup) {
      return;
    }
    groups.push({
      role: currentGroup.role,
      timestamp: currentGroup.timestamp,
      messages: [...currentGroup.messages],
      runId: currentGroup.runId,
    });
  };

  messages.forEach((message) => {
    const normalized = normalizeMessage(message);
    const role = normalizeRoleForGrouping(normalized.role);
    const timestamp = normalized.timestamp || Date.now();
    const runId = readBillingRunId(message);

    if (!currentGroup || currentGroup.role !== role) {
      finalizeCurrentGroup();
      currentGroup = {
        role,
        timestamp,
        messages: [message],
        runId,
      };
      return;
    }

    currentGroup.messages.push(message);
    if (!currentGroup.runId && runId) {
      currentGroup.runId = runId;
    }
  });

  finalizeCurrentGroup();

  return groups;
}

function collectAssistantMessageGroups(messages: unknown[]): AssistantMessageGroup[] {
  const groups = collectMessageGroups(messages);
  if (groups.length === 0) {
    return [];
  }

  const assistantGroups: AssistantMessageGroup[] = [];
  let activeRunId: string | null = null;

  groups.forEach((group) => {
    if (group.role === 'user') {
      activeRunId = group.runId;
      return;
    }
    if (group.role !== 'assistant') {
      return;
    }
    assistantGroups.push({
      role: group.role,
      timestamp: group.timestamp,
      messages: group.messages,
      runId: activeRunId,
    });
  });

  return assistantGroups;
}

function findAssistantGroupForRun(
  messages: unknown[],
  runId: string | null,
  startedAt: number,
): AssistantMessageGroup | null {
  const assistantGroups = findAssistantGroupsForRun(messages, runId, startedAt);
  return assistantGroups.length > 0 ? assistantGroups[assistantGroups.length - 1] ?? null : null;
}

function findAssistantGroupsForRun(
  messages: unknown[],
  runId: string | null,
  startedAt: number,
): AssistantMessageGroup[] {
  const assistantGroups = collectAssistantMessageGroups(messages);
  if (runId) {
    return assistantGroups.filter((group) => group.runId === runId);
  }
  return assistantGroups.filter((group) => group.timestamp >= startedAt);
}

function summarizeAssistantGroupUsage(group: AssistantMessageGroup): {inputTokens: number; outputTokens: number} | null {
  let inputTokens = 0;
  let outputTokens = 0;
  let hasUsage = false;

  group.messages.forEach((message) => {
    if (!isRecord(message)) {
      return;
    }
    const usage = isRecord(message.usage) ? message.usage : null;
    if (!usage) {
      return;
    }
    const nextInputTokens = getUsageMetric(usage, ['input', 'inputTokens', 'input_tokens']);
    const nextOutputTokens = getUsageMetric(usage, ['output', 'outputTokens', 'output_tokens']);
    if (nextInputTokens > 0 || nextOutputTokens > 0) {
      hasUsage = true;
    }
    inputTokens += nextInputTokens;
    outputTokens += nextOutputTokens;
  });

  if (!hasUsage) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
  };
}

function readAssistantBillingSummary(message: unknown): RunBillingSummaryData | null {
  if (!isRecord(message)) {
    return null;
  }
  const summary = message[ICLAW_BILLING_SUMMARY_KEY];
  return isRecord(summary) ? (summary as unknown as RunBillingSummaryData) : null;
}

function readAssistantBillingState(message: unknown): AssistantBillingState | null {
  if (!isRecord(message)) {
    return null;
  }
  const state = message[ICLAW_BILLING_STATE_KEY];
  return state === 'charged' || state === 'pending' || state === 'missing' ? state : null;
}

function getBillingSummaryMergeKey(summary: RunBillingSummaryData): string | null {
  const eventId = summary.event_id?.trim();
  if (eventId) {
    return `event:${eventId}`;
  }
  const grantId = summary.grant_id?.trim();
  if (grantId) {
    return `grant:${grantId}`;
  }
  return null;
}

function getBillingSummarySortTime(summary: RunBillingSummaryData): number {
  if (typeof summary.assistant_timestamp === 'number' && Number.isFinite(summary.assistant_timestamp)) {
    return summary.assistant_timestamp;
  }
  return Date.parse(summary.settled_at || '') || 0;
}

function mergeRunBillingSummaries(
  current: RunBillingSummaryData[],
  incoming: RunBillingSummaryData[],
): RunBillingSummaryData[] {
  const merged = new Map<string, RunBillingSummaryData>();
  const appendSummary = (summary: RunBillingSummaryData) => {
    const key = getBillingSummaryMergeKey(summary);
    if (!key) {
      return;
    }
    merged.set(key, summary);
  };

  current.forEach(appendSummary);
  incoming.forEach(appendSummary);

  return Array.from(merged.values()).sort((left, right) => getBillingSummarySortTime(right) - getBillingSummarySortTime(left));
}

function filterRunBillingSummariesBySessionKeys(
  summaries: RunBillingSummaryData[],
  sessionKeys: Array<string | null | undefined>,
): RunBillingSummaryData[] {
  const allowedSessionKeys = new Set(collectCanonicalSessionKeys(...sessionKeys));
  if (allowedSessionKeys.size === 0) {
    return [];
  }

  return summaries.filter((summary) => {
    const summarySessionKey = tryCanonicalizeSessionKey(summary.session_key);
    return Boolean(summarySessionKey && allowedSessionKeys.has(summarySessionKey));
  });
}

function annotateAssistantGroup(
  messages: unknown[],
  runId: string | null,
  startedAt: number,
  annotation: {
    billingSummary?: RunBillingSummaryData | null;
    billingState?: AssistantBillingState | null;
  },
): boolean {
  const assistantGroup = findAssistantGroupForRun(messages, runId, startedAt);
  if (!assistantGroup) {
    return false;
  }

  assistantGroup.messages.forEach((message) => {
    if (!isRecord(message)) {
      return;
    }

    if (annotation.billingSummary === null) {
      delete message[ICLAW_BILLING_SUMMARY_KEY];
    } else if (annotation.billingSummary) {
      message[ICLAW_BILLING_SUMMARY_KEY] = annotation.billingSummary;
    }

    if (annotation.billingState === null) {
      delete message[ICLAW_BILLING_STATE_KEY];
    } else if (annotation.billingState) {
      message[ICLAW_BILLING_STATE_KEY] = annotation.billingState;
    }
  });

  return true;
}

function collectMessageTurns(messages: unknown[]): ChatMessageTurn[] {
  const groups = collectMessageGroups(messages);
  if (groups.length === 0) {
    return [];
  }

  const turns: ChatMessageTurn[] = [];
  let currentTurn: ChatMessageTurn | null = null;

  const finalizeCurrentTurn = () => {
    if (!currentTurn?.userGroup) {
      return;
    }
    turns.push({
      startedAt: currentTurn.startedAt,
      userGroup: currentTurn.userGroup,
      assistantGroups: [...currentTurn.assistantGroups],
      runId: currentTurn.runId,
    });
  };

  groups.forEach((group) => {
    if (group.role === 'user') {
      finalizeCurrentTurn();
      currentTurn = {
        startedAt: group.timestamp,
        userGroup: group,
        assistantGroups: [],
        runId: group.runId,
      };
      return;
    }

    if (group.role !== 'assistant' || !currentTurn) {
      return;
    }

    currentTurn.assistantGroups.push(group);
    if (!currentTurn.runId && group.runId) {
      currentTurn.runId = group.runId;
    }
  });

  finalizeCurrentTurn();
  return turns;
}

function buildTerminalAssistantPromptMap(messages: unknown[]): Map<number, string> {
  const turns = collectMessageTurns(messages);
  const promptByAssistantIndex = new Map<number, string>();
  let assistantGroupIndex = 0;

  turns.forEach((turn) => {
    const assistantGroupCount = turn.assistantGroups.length;
    if (assistantGroupCount <= 0) {
      return;
    }

    const promptText = extractChatMessageGroupText(turn.userGroup);
    const terminalAssistantIndex = assistantGroupIndex + assistantGroupCount - 1;
    promptByAssistantIndex.set(terminalAssistantIndex, promptText);
    assistantGroupIndex += assistantGroupCount;
  });

  return promptByAssistantIndex;
}

function readRunIdFromTurn(turn: ChatMessageTurn): string | null {
  if (turn.runId) {
    return turn.runId;
  }
  if (turn.userGroup?.runId) {
    return turn.userGroup.runId;
  }
  for (const assistantGroup of turn.assistantGroups) {
    if (assistantGroup.runId) {
      return assistantGroup.runId;
    }
  }
  return null;
}

function getTurnAssistantTimestamp(turn: ChatMessageTurn): number {
  return turn.assistantGroups[turn.assistantGroups.length - 1]?.timestamp ?? turn.startedAt;
}

function summarizeTurnUsage(turn: ChatMessageTurn): {inputTokens: number; outputTokens: number} | null {
  let inputTokens = 0;
  let outputTokens = 0;
  let hasUsage = false;

  turn.assistantGroups.forEach((assistantGroup) => {
    const usage = summarizeAssistantGroupUsage(assistantGroup);
    if (!usage) {
      return;
    }
    hasUsage = true;
    inputTokens += usage.inputTokens;
    outputTokens += usage.outputTokens;
  });

  if (!hasUsage) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
  };
}

function applyRunIdToTurn(turn: ChatMessageTurn, runId: string): boolean {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    return false;
  }

  let mutated = false;
  const groups = turn.userGroup ? [turn.userGroup, ...turn.assistantGroups] : [...turn.assistantGroups];

  groups.forEach((group) => {
    group.runId = normalizedRunId;
    group.messages.forEach((message) => {
      if (!isRecord(message)) {
        return;
      }
      if (readBillingRunId(message) === normalizedRunId) {
        return;
      }
      message[ICLAW_BILLING_RUN_ID_KEY] = normalizedRunId;
      mutated = true;
    });
  });

  if (turn.runId !== normalizedRunId) {
    turn.runId = normalizedRunId;
    mutated = true;
  }

  return mutated;
}

function findTurnIndexForRunIdRecovery(input: {
  turns: ChatMessageTurn[];
  runId: string;
  startedAt?: number | null;
  assistantTimestamp?: number | null;
  summary?: RunBillingSummaryData | null;
}): number {
  const normalizedRunId = input.runId.trim();
  if (!normalizedRunId || input.turns.length === 0) {
    return -1;
  }

  for (let index = input.turns.length - 1; index >= 0; index -= 1) {
    if (readRunIdFromTurn(input.turns[index]) === normalizedRunId) {
      return index;
    }
  }

  const TURN_START_MATCH_MAX_DELTA_MS = 2_000;
  const ASSISTANT_MATCH_MAX_DELTA_MS = 15_000;
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestDelta = Number.POSITIVE_INFINITY;
  const targetInputTokens = Math.max(0, input.summary?.input_tokens || 0);
  const targetOutputTokens = Math.max(0, input.summary?.output_tokens || 0);
  const hasTargetUsage = targetInputTokens > 0 || targetOutputTokens > 0;

  input.turns.forEach((turn, index) => {
    const existingRunId = readRunIdFromTurn(turn);
    if (existingRunId && existingRunId !== normalizedRunId) {
      return;
    }

    let score = 0;
    let delta = Number.POSITIVE_INFINITY;

    if (typeof input.startedAt === 'number' && Number.isFinite(input.startedAt)) {
      const startedAtDelta = Math.abs(turn.startedAt - input.startedAt);
      if (startedAtDelta <= TURN_START_MATCH_MAX_DELTA_MS) {
        score = Math.max(score, 4);
        delta = Math.min(delta, startedAtDelta);
      }
    }

    if (
      typeof input.assistantTimestamp === 'number' &&
      Number.isFinite(input.assistantTimestamp) &&
      turn.assistantGroups.length > 0
    ) {
      const assistantDelta = Math.abs(getTurnAssistantTimestamp(turn) - input.assistantTimestamp);
      if (assistantDelta <= ASSISTANT_MATCH_MAX_DELTA_MS) {
        const usage = summarizeTurnUsage(turn);
        const usageMatches =
          usage !== null &&
          usage.inputTokens === targetInputTokens &&
          usage.outputTokens === targetOutputTokens;
        score = Math.max(score, usageMatches ? 3 : hasTargetUsage ? 1 : 2);
        delta = Math.min(delta, assistantDelta);
      }
    }

    if (score <= 0) {
      return;
    }
    if (score > bestScore || (score === bestScore && delta < bestDelta)) {
      bestIndex = index;
      bestScore = score;
      bestDelta = delta;
    }
  });

  return bestIndex;
}

function reconcileChatMessageRunMetadata(input: {
  messages: unknown[];
  pendingSettlements: PendingUsageSettlement[];
  sessionBillingSummaries: RunBillingSummaryData[];
}): boolean {
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    return false;
  }

  const turns = collectMessageTurns(input.messages);
  if (turns.length === 0) {
    return false;
  }

  let mutated = false;

  input.pendingSettlements.forEach((pending) => {
    const runId = pending.runId?.trim();
    if (!runId) {
      return;
    }
    const turnIndex = findTurnIndexForRunIdRecovery({
      turns,
      runId,
      startedAt: pending.startedAt,
    });
    if (turnIndex < 0) {
      return;
    }
    mutated = applyRunIdToTurn(turns[turnIndex], runId) || mutated;
  });

  input.sessionBillingSummaries.forEach((summary) => {
    const runId = summary.event_id?.trim();
    if (!runId) {
      return;
    }
    const assistantTimestamp =
      typeof summary.assistant_timestamp === 'number' && Number.isFinite(summary.assistant_timestamp)
        ? summary.assistant_timestamp
        : Date.parse(summary.settled_at || '') || null;
    const turnIndex = findTurnIndexForRunIdRecovery({
      turns,
      runId,
      assistantTimestamp,
      summary,
    });
    if (turnIndex < 0) {
      return;
    }
    mutated = applyRunIdToTurn(turns[turnIndex], runId) || mutated;
  });

  return mutated;
}

function buildAssistantFooterTooltip(input: {
  state: AssistantBillingState;
  inputTokens: number;
  outputTokens: number;
  credits: number | null;
}): string {
  const usageDetail =
    input.inputTokens > 0 || input.outputTokens > 0
      ? `输入 ${input.inputTokens} tokens · 输出 ${input.outputTokens} tokens`
      : '当前消息还没有可用的 tokens 明细';

  if (input.state === 'charged') {
    if ((input.credits ?? 0) <= 0) {
      return usageDetail;
    }
    return `${usageDetail} · 实际消耗 ${input.credits} 龙虾币`;
  }

  if (input.state === 'pending') {
    return `${usageDetail} · 后端正在结算本次消耗`;
  }

  return `${usageDetail} · 实际消耗 0 龙虾币`;
}

function buildAssistantFooterMetaFromSummary(summary: RunBillingSummaryData): AssistantFooterMeta {
  const inputTokens = Math.max(0, summary.input_tokens || 0);
  const outputTokens = Math.max(0, summary.output_tokens || 0);
  const credits = Math.max(0, summary.credit_cost || 0);
  const timestamp =
    (typeof summary.assistant_timestamp === 'number' && Number.isFinite(summary.assistant_timestamp)
      ? summary.assistant_timestamp
      : Date.parse(summary.settled_at || '')) || Date.now();

  return {
    timestampLabel: formatAssistantFooterTimestamp(timestamp),
    state: 'charged',
    label: '实际消耗 ',
    value: String(credits),
    credits,
    inputTokens,
    outputTokens,
    tooltip: buildAssistantFooterTooltip({
      state: 'charged',
      inputTokens,
      outputTokens,
      credits,
    }),
  };
}

function buildAssistantFooterMetaFromPending(
  pending: PendingUsageSettlement,
  usage: AssistantUsageSettlement | null,
): AssistantFooterMeta {
  const inputTokens = Math.max(0, usage?.inputTokens ?? 0);
  const outputTokens = Math.max(0, usage?.outputTokens ?? 0);
  const state: AssistantBillingState = 'pending';

  return {
    timestampLabel: formatAssistantFooterTimestamp(usage?.timestamp ?? pending.startedAt),
    state,
    label: '计费结算中',
    value: null,
    credits: null,
    inputTokens,
    outputTokens,
    tooltip: buildAssistantFooterTooltip({
      state,
      inputTokens,
      outputTokens,
      credits: null,
    }),
  };
}

function deriveAssistantFooterMetas(
  messages: unknown[],
  pendingSettlements: PendingUsageSettlement[],
  sessionBillingSummaries: RunBillingSummaryData[],
  app: OpenClawAppElement | null,
  isBusy: boolean,
): Array<AssistantFooterMeta | null> {
  const assistantGroups = collectAssistantMessageGroups(messages);
  if (assistantGroups.length === 0) {
    return [];
  }
  const LEGACY_SUMMARY_MATCH_MAX_DELTA_MS = 15_000;
  const persistedBillingByRunId = new Map<string, RunBillingSummaryData>();
  const persistedBillingByAssistantIndex = new Map<number, RunBillingSummaryData>();
  const matchedSummaryEventIds = new Set<string>();
  sessionBillingSummaries.forEach((summary) => {
    const runId = summary.event_id?.trim();
    if (runId) {
      persistedBillingByRunId.set(runId, summary);
    }
  });

  assistantGroups.forEach((assistantGroup, assistantGroupIndex) => {
    const summary = assistantGroup.runId ? persistedBillingByRunId.get(assistantGroup.runId) ?? null : null;
    if (!summary) {
      return;
    }
    persistedBillingByAssistantIndex.set(assistantGroupIndex, summary);
    if (summary.event_id?.trim()) {
      matchedSummaryEventIds.add(summary.event_id.trim());
    }
  });

  const unmatchedAssistantIndexes = assistantGroups
    .map((_, assistantGroupIndex) => assistantGroupIndex)
    .filter((assistantGroupIndex) => !persistedBillingByAssistantIndex.has(assistantGroupIndex));
  const remainingSummaries = sessionBillingSummaries.filter((summary) => {
    const eventId = summary.event_id?.trim();
    return !eventId || !matchedSummaryEventIds.has(eventId);
  });

  remainingSummaries.forEach((summary) => {
    const anchorTimestamp = summary.assistant_timestamp;
    if (typeof anchorTimestamp !== 'number' || !Number.isFinite(anchorTimestamp)) {
      return;
    }

    let bestAssistantIndex = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestDelta = Number.POSITIVE_INFINITY;

    unmatchedAssistantIndexes.forEach((assistantGroupIndex) => {
      const assistantGroup = assistantGroups[assistantGroupIndex];
      if (!assistantGroup) {
        return;
      }

      const timestampDelta = Math.abs((assistantGroup.timestamp || 0) - anchorTimestamp);
      if (timestampDelta > LEGACY_SUMMARY_MATCH_MAX_DELTA_MS) {
        return;
      }

      const usage = summarizeAssistantGroupUsage(assistantGroup);
      const usageMatches =
        usage !== null &&
        usage.inputTokens === Math.max(0, summary.input_tokens || 0) &&
        usage.outputTokens === Math.max(0, summary.output_tokens || 0);
      const score = usageMatches ? 2 : usage === null ? 1 : -1;
      if (score < 0) {
        return;
      }
      if (score > bestScore || (score === bestScore && timestampDelta < bestDelta)) {
        bestAssistantIndex = assistantGroupIndex;
        bestScore = score;
        bestDelta = timestampDelta;
      }
    });

    if (bestAssistantIndex < 0) {
      return;
    }

    persistedBillingByAssistantIndex.set(bestAssistantIndex, summary);
    const nextIndex = unmatchedAssistantIndexes.indexOf(bestAssistantIndex);
    if (nextIndex >= 0) {
      unmatchedAssistantIndexes.splice(nextIndex, 1);
    }
  });

  const stillUnmatchedSummaries = sessionBillingSummaries.filter((summary) => {
    const eventId = summary.event_id?.trim();
    if (eventId && matchedSummaryEventIds.has(eventId)) {
      return false;
    }
    return !Array.from(persistedBillingByAssistantIndex.values()).some((value) => value === summary);
  });

  if (stillUnmatchedSummaries.length > 0 && unmatchedAssistantIndexes.length > 0) {
    const sortedSummaryIndexes = stillUnmatchedSummaries
      .map((summary, index) => ({
        index,
        summary,
        anchorTimestamp:
          (typeof summary.assistant_timestamp === 'number' && Number.isFinite(summary.assistant_timestamp)
            ? summary.assistant_timestamp
            : Date.parse(summary.settled_at || '')) || 0,
      }))
      .sort((left, right) => right.anchorTimestamp - left.anchorTimestamp);

    const sortedAssistantIndexes = [...unmatchedAssistantIndexes].sort((left, right) => {
      const leftTimestamp = assistantGroups[left]?.timestamp ?? 0;
      const rightTimestamp = assistantGroups[right]?.timestamp ?? 0;
      return rightTimestamp - leftTimestamp;
    });

    sortedSummaryIndexes.forEach(({ summary, anchorTimestamp }) => {
      const candidatePosition = sortedAssistantIndexes.findIndex((assistantGroupIndex) => {
        const assistantGroup = assistantGroups[assistantGroupIndex];
        if (!assistantGroup) {
          return false;
        }
        if (anchorTimestamp <= 0) {
          return true;
        }
        return (assistantGroup.timestamp || 0) <= anchorTimestamp + LEGACY_SUMMARY_MATCH_MAX_DELTA_MS;
      });
      if (candidatePosition < 0) {
        return;
      }
      const assistantGroupIndex = sortedAssistantIndexes[candidatePosition];
      if (typeof assistantGroupIndex !== 'number') {
        return;
      }
      persistedBillingByAssistantIndex.set(assistantGroupIndex, summary);
      sortedAssistantIndexes.splice(candidatePosition, 1);
      if (summary.event_id?.trim()) {
        matchedSummaryEventIds.add(summary.event_id.trim());
      }
    });
  }

  const pendingAssistantIndexes = new Set<number>();
  const optimisticUsageByAssistantIndex = new Map<number, AssistantUsageSettlement>();
  pendingSettlements.forEach((pending) => {
    const terminalEvent = app ? findTerminalChatEventForRun(app, pending.sessionKey, pending.runId) : null;
    const optimisticUsage = derivePendingSettlementUsage(messages, pending, terminalEvent?.message);

    if (pending.runId) {
      let matchedIndex = -1;
      for (let index = assistantGroups.length - 1; index >= 0; index -= 1) {
        if (assistantGroups[index]?.runId === pending.runId) {
          matchedIndex = index;
          break;
        }
      }
      if (matchedIndex >= 0) {
        if (optimisticUsage) {
          optimisticUsageByAssistantIndex.set(matchedIndex, optimisticUsage);
        }
        pendingAssistantIndexes.add(matchedIndex);
        return;
      }
    }
  });

  const latestAssistantGroupIndex = assistantGroups.length - 1;

  return assistantGroups.map((assistantGroup, assistantGroupIndex) => {
    let inputTokens = 0;
    let outputTokens = 0;
    let model: string | null = null;
    let billingSummary: RunBillingSummaryData | null = null;
    let billingState: AssistantBillingState | null = null;
    const optimisticUsage = optimisticUsageByAssistantIndex.get(assistantGroupIndex) ?? null;
    const persistedBilling = persistedBillingByAssistantIndex.get(assistantGroupIndex) ?? null;

    assistantGroup.messages.forEach((message: unknown) => {
      const record = message as Record<string, unknown>;
      const usage = record.usage as Record<string, unknown> | undefined;
      if (!usage) {
        const messageBillingSummary = readAssistantBillingSummary(message);
        if (messageBillingSummary) {
          billingSummary = messageBillingSummary;
        }
        const messageBillingState = readAssistantBillingState(message);
        if (messageBillingState === 'missing' || (!billingState && messageBillingState)) {
          billingState = messageBillingState;
        }
        return;
      }
      inputTokens += getUsageMetric(usage, ['input', 'inputTokens', 'input_tokens']);
      outputTokens += getUsageMetric(usage, ['output', 'outputTokens', 'output_tokens']);
      if (typeof record.model === 'string' && record.model.trim() && record.model !== 'gateway-injected') {
        model = record.model.trim();
      }
      const messageBillingSummary = readAssistantBillingSummary(message);
      if (messageBillingSummary) {
        billingSummary = messageBillingSummary;
      }
      const messageBillingState = readAssistantBillingState(message);
      if (messageBillingState === 'missing' || (!billingState && messageBillingState)) {
        billingState = messageBillingState;
      }
    });

    if (!billingSummary && persistedBilling) {
      billingSummary = persistedBilling;
    }

    if (billingSummary) {
      inputTokens = Math.max(inputTokens, billingSummary.input_tokens || 0);
      outputTokens = Math.max(outputTokens, billingSummary.output_tokens || 0);
      const credits = Math.max(0, billingSummary.credit_cost || 0);
      return {
        timestampLabel: formatAssistantFooterTimestamp(assistantGroup.timestamp),
        state: 'charged',
        label: '实际消耗 ',
        value: String(credits),
        credits,
        inputTokens,
        outputTokens,
        tooltip: buildAssistantFooterTooltip({
          state: 'charged',
          inputTokens,
          outputTokens,
          credits,
        }),
      };
    }

    if (isBusy && assistantGroupIndex === latestAssistantGroupIndex) {
      return null;
    }

    if ((inputTokens <= 0 && outputTokens <= 0) && optimisticUsage) {
      inputTokens = optimisticUsage.inputTokens;
      outputTokens = optimisticUsage.outputTokens;
      model = model || optimisticUsage.model;
    }

    const derivedState =
      pendingAssistantIndexes.has(assistantGroupIndex) || billingState === 'pending'
        ? 'pending'
        : 'charged';
    const derivedCredits = derivedState === 'charged' ? 0 : null;

    return {
      timestampLabel: formatAssistantFooterTimestamp(assistantGroup.timestamp),
      state: derivedState,
      label: derivedState === 'pending' ? '计费结算中' : '实际消耗 ',
      value: derivedState === 'pending' ? null : '0',
      credits: derivedCredits,
      inputTokens,
      outputTokens,
      tooltip: buildAssistantFooterTooltip({
        state: derivedState,
        inputTokens,
        outputTokens,
        credits: derivedCredits,
      }),
    };
  });
}

function extractChatGroupTimestampLabel(group: HTMLElement): string {
  return group.querySelector('.chat-group-footer .chat-group-timestamp')?.textContent?.trim() ?? '';
}

function normalizeChatSenderLabel(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function inferCreditQuoteHasSearch(prompt: string): boolean {
  const normalized = prompt.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return /天气|气温|下雨|降雨|新闻|最新|最近|今日|今天|现在|当前|行情|股价|价格|汇率|热搜|搜索|查一下|查查|weather|forecast|news|latest|today|current|price|quote|search/.test(
    normalized,
  );
}

function deriveRunAssistantUsageSince(
  messages: unknown[],
  runId: string | null,
  startedAt: number,
): AssistantUsageSettlement | null {
  const assistantGroups = findAssistantGroupsForRun(messages, runId, startedAt);
  if (assistantGroups.length === 0) {
    return null;
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let model: string | null = null;
  let hasUsage = false;

  assistantGroups.forEach((assistantGroup) => {
    assistantGroup.messages.forEach((message: unknown) => {
      const record = message as Record<string, unknown>;
      const usage = record.usage as Record<string, unknown> | undefined;
      if (usage) {
        const messageInputTokens = getUsageMetric(usage, ['input', 'inputTokens', 'input_tokens']);
        const messageOutputTokens = getUsageMetric(usage, ['output', 'outputTokens', 'output_tokens']);
        if (messageInputTokens > 0 || messageOutputTokens > 0) {
          hasUsage = true;
        }
        inputTokens += messageInputTokens;
        outputTokens += messageOutputTokens;
      }
      if (typeof record.model === 'string' && record.model.trim() && record.model !== 'gateway-injected') {
        model = record.model.trim();
      }
    });
  });

  if (!hasUsage) {
    return null;
  }

  const latestAssistantGroup = assistantGroups[assistantGroups.length - 1] ?? null;
  return {
    inputTokens,
    outputTokens,
    model,
    timestamp: latestAssistantGroup?.timestamp ?? startedAt,
  };
}

function deriveAssistantUsageFromMessage(message: unknown): AssistantUsageSettlement | null {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const normalized = normalizeMessage(message);
  const record = message as Record<string, unknown>;
  const usage = record.usage as Record<string, unknown> | undefined;
  if (!usage) {
    return null;
  }

  const inputTokens = getUsageMetric(usage, ['input', 'inputTokens', 'input_tokens']);
  const outputTokens = getUsageMetric(usage, ['output', 'outputTokens', 'output_tokens']);
  if (inputTokens <= 0 && outputTokens <= 0) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    model:
      typeof record.model === 'string' && record.model.trim() && record.model !== 'gateway-injected'
        ? record.model.trim()
        : null,
    timestamp: normalized.timestamp || Date.now(),
  };
}

function derivePendingSettlementUsage(
  messages: unknown[],
  pending: PendingUsageSettlement,
  terminalEventMessage?: unknown,
): AssistantUsageSettlement | null {
  const runAssistantUsage =
    // A single run may produce multiple assistant groups around tool calls, so
    // settlement must aggregate usage across the whole run instead of reading only
    // the last visible assistant group.
    deriveRunAssistantUsageSince(messages, pending.runId, pending.startedAt);
  const terminalUsage = terminalEventMessage ? deriveAssistantUsageFromMessage(terminalEventMessage) : null;
  const directUsage =
    runAssistantUsage || terminalUsage
      ? {
          inputTokens: Math.max(runAssistantUsage?.inputTokens ?? 0, terminalUsage?.inputTokens ?? 0),
          outputTokens: Math.max(runAssistantUsage?.outputTokens ?? 0, terminalUsage?.outputTokens ?? 0),
          model: terminalUsage?.model || runAssistantUsage?.model || null,
          // Use the latest assistant message timestamp as the persisted anchor.
          timestamp: runAssistantUsage?.timestamp ?? terminalUsage?.timestamp ?? Date.now(),
        }
      : null;
  if (directUsage) {
    return directUsage;
  }
  return null;
}

function derivePendingSettlementUsageFromSessionSnapshot(
  messages: unknown[],
  pending: PendingUsageSettlement,
  sessionTokens: { inputTokens: number; outputTokens: number } | null,
): AssistantUsageSettlement | null {
  if (!sessionTokens) {
    return null;
  }

  const currentInputTokens = Math.max(0, sessionTokens.inputTokens);
  const currentOutputTokens = Math.max(0, sessionTokens.outputTokens);
  const baselineInputTokens = Math.max(0, pending.baselineInputTokens ?? 0);
  const baselineOutputTokens = Math.max(0, pending.baselineOutputTokens ?? 0);
  const deltaInputTokens = Math.max(0, currentInputTokens - baselineInputTokens);
  const deltaOutputTokens = Math.max(0, currentOutputTokens - baselineOutputTokens);
  if (deltaInputTokens <= 0 && deltaOutputTokens <= 0) {
    return null;
  }

  const assistantGroup = findAssistantGroupForRun(messages, pending.runId, pending.startedAt);

  return {
    inputTokens: deltaInputTokens,
    outputTokens: deltaOutputTokens,
    model: pending.model || null,
    timestamp: assistantGroup?.timestamp ?? pending.startedAt,
  };
}

type TerminalChatEventMatch = {
  ts: number;
  sessionKey: string | null;
  runId: string | null;
  state: 'final' | 'aborted' | 'error';
  message?: unknown;
};

function findTerminalChatEventForRun(
  app: OpenClawAppElement,
  sessionKey: string,
  runId: string,
): TerminalChatEventMatch | null {
  const canonicalSessionKey = canonicalizeChatSessionKey(sessionKey);
  const entries = Array.isArray(app.eventLogBuffer)
    ? app.eventLogBuffer
    : Array.isArray(app.eventLog)
      ? app.eventLog
      : [];

  for (const entry of entries) {
    if (!entry || entry.event !== 'chat' || typeof entry.payload !== 'object' || !entry.payload) {
      continue;
    }
    const payload = entry.payload as Record<string, unknown>;
    if (payload.runId !== runId) {
      continue;
    }
    const state = payload.state;
    if (state !== 'final' && state !== 'aborted' && state !== 'error') {
      continue;
    }
    const match: TerminalChatEventMatch = {
      ts: entry.ts,
      sessionKey: typeof payload.sessionKey === 'string' ? payload.sessionKey : null,
      runId: typeof payload.runId === 'string' ? payload.runId : null,
      state,
      message: payload.message,
    };
    if (
      typeof payload.sessionKey === 'string' &&
      payload.sessionKey &&
      tryCanonicalizeSessionKey(payload.sessionKey) !== canonicalSessionKey
    ) {
      continue;
    }
    return match;
  }

  return null;
}

function findLatestTerminalChatEventSince(
  app: OpenClawAppElement,
  sessionKey: string,
  startedAt: number,
): TerminalChatEventMatch | null {
  const entries = Array.isArray(app.eventLogBuffer)
    ? app.eventLogBuffer
    : Array.isArray(app.eventLog)
      ? app.eventLog
      : [];

  for (const entry of entries) {
    if (!entry || entry.event !== 'chat' || typeof entry.payload !== 'object' || !entry.payload) {
      continue;
    }
    if (typeof entry.ts === 'number' && entry.ts < startedAt) {
      break;
    }
    const payload = entry.payload as Record<string, unknown>;
    if (typeof payload.sessionKey === 'string' && tryCanonicalizeSessionKey(payload.sessionKey) !== canonicalizeChatSessionKey(sessionKey)) {
      continue;
    }
    const state = payload.state;
    if (state !== 'final' && state !== 'aborted' && state !== 'error') {
      continue;
    }
    return {
      ts: entry.ts,
      sessionKey: typeof payload.sessionKey === 'string' ? payload.sessionKey : null,
      runId: typeof payload.runId === 'string' ? payload.runId : null,
      state,
      message: payload.message,
    };
  }

  return null;
}

function reconcileGatewayChatBusyState(
  app: OpenClawAppElement,
  sessionKey: string,
): { busy: boolean; settledRunId: string | null; terminalState: TerminalChatEventMatch['state'] | null } {
  const activeRunId = typeof app.chatRunId === 'string' ? app.chatRunId.trim() : '';
  const startedAt = typeof app.chatStreamStartedAt === 'number' && Number.isFinite(app.chatStreamStartedAt) ? app.chatStreamStartedAt : 0;
  if (!activeRunId) {
    return {
      busy: Boolean(app.chatSending),
      settledRunId: null,
      terminalState: null,
    };
  }

  const terminalEvent =
    findTerminalChatEventForRun(app, sessionKey, activeRunId) ||
    // Single-track chat should tolerate a gateway terminal event whose runId drifted,
    // as long as it belongs to the same session and happened after this send started.
    (startedAt > 0 ? findLatestTerminalChatEventSince(app, sessionKey, startedAt) : null);
  if (terminalEvent) {
    app.chatSending = false;
    app.chatRunId = null;
    app.chatStream = null;
    app.chatStreamStartedAt = null;
    return {
      busy: false,
      settledRunId: activeRunId,
      terminalState: terminalEvent.state,
    };
  }

  return {
    busy: true,
    settledRunId: null,
    terminalState: null,
  };
}

function createDesktopRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `desktop-run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createMemoryUsageTimestamp() {
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

function dataUrlToBase64(dataUrl: string): { content: string; mimeType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return null;
  }
  return {
    mimeType: match[1],
    content: match[2],
  };
}

async function sendAuthorizedChatMessage(params: {
  app: OpenClawAppElement;
  sessionKey: string;
  prompt: string;
  imageAttachments: OpenClawImageAttachment[];
  runId: string;
  startedAt: number;
}): Promise<void> {
  const { app, sessionKey, prompt, imageAttachments, runId, startedAt } = params;
  const request = app.client?.request;
  if (!app.connected || typeof request !== 'function') {
    throw new Error('尚未连接到 OpenClaw 网关，请稍后再试。');
  }

  const message = prompt.trim();
  const hasAttachments = imageAttachments.length > 0;
  if (!message && !hasAttachments) {
    throw new Error('发送内容为空。');
  }

  const apiAttachments = imageAttachments
    .map((attachment) => {
      const parsed = dataUrlToBase64(attachment.dataUrl);
      if (!parsed) {
        return null;
      }
      return {
        type: 'image',
        mimeType: parsed.mimeType,
        content: parsed.content,
      };
    })
    .filter((attachment): attachment is NonNullable<typeof attachment> => attachment !== null);

  try {
    await request('chat.send', {
      sessionKey,
      message,
      idempotencyKey: runId,
      attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
    });
  } catch (error) {
    const { message: detail, code } = resolveGatewayErrorDetail(error);
    app.chatRunId = null;
    app.chatStream = null;
    app.chatStreamStartedAt = null;
    app.lastError = isCreditBlockCode(code) ? null : detail;
    app.lastErrorCode = isCreditBlockCode(code) ? null : code;
    if (!shouldSuppressInlineChatError(code)) {
      app.chatMessages = [
        ...app.chatMessages,
        {
          role: 'assistant',
          content: [{ type: 'text', text: `Error: ${detail}` }],
          timestamp: Date.now(),
        },
      ];
    }
    throw error;
  } finally {
    app.chatSending = false;
  }
}

function stageOutgoingChatMessage(params: {
  app: OpenClawAppElement;
  prompt: string;
  imageAttachments: OpenClawImageAttachment[];
  runId: string;
  startedAt: number;
}): void {
  const { app, prompt, imageAttachments, runId, startedAt } = params;
  const message = prompt.trim();
  const contentBlocks: Array<{ type: string; text?: string; source?: unknown }> = [];
  if (message) {
    contentBlocks.push({ type: 'text', text: message });
  }
  imageAttachments.forEach((attachment) => {
    contentBlocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: attachment.mimeType,
        data: attachment.dataUrl,
      },
    });
  });

  app.chatMessages = [
    ...app.chatMessages,
    {
      role: 'user',
      content: contentBlocks,
      timestamp: startedAt,
      [ICLAW_BILLING_RUN_ID_KEY]: runId,
    },
  ];
  app.chatMessage = '';
  app.chatAttachments = [];
  app.chatSending = true;
  app.lastError = null;
  app.lastErrorCode = null;
  app.chatRunId = runId;
  app.chatStream = '';
  app.chatStreamStartedAt = startedAt;
}

function markOutgoingChatFailed(params: {
  app: OpenClawAppElement;
  detail: string;
  code?: string | null;
}): void {
  const { app, detail, code = null } = params;
  app.chatSending = false;
  app.chatRunId = null;
  app.chatStream = null;
  app.chatStreamStartedAt = null;
  app.lastError = isCreditBlockCode(code) ? null : detail;
  app.lastErrorCode = isCreditBlockCode(code) ? null : code;
  if (!shouldSuppressInlineChatError(code)) {
    app.chatMessages = [
      ...app.chatMessages,
      {
        role: 'assistant',
        content: [{ type: 'text', text: `Error: ${detail}` }],
        timestamp: Date.now(),
      },
    ];
  }
}

function resolveGatewayErrorDetail(error: unknown): { message: string; code: string | null } {
  const message = error instanceof Error ? error.message : '任务发送失败';
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : null;
  return { message, code };
}

function shouldSuppressInlineChatError(code: string | null | undefined): boolean {
  return code === 'INSUFFICIENT_CREDITS';
}

function isCreditBlockCode(code: string | null | undefined): code is CreditBlockNotice['code'] {
  return code === 'INSUFFICIENT_CREDITS' || code === 'CREDIT_LIMIT_EXCEEDED';
}

function setMessageActionFeedback(button: HTMLButtonElement, state: 'idle' | 'success'): void {
  button.dataset.state = state;
}

const MODEL_SNAPSHOT_RPC_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error(`${label} timeout`));
    }, timeoutMs);

    promise.then(
      (value) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function createMessageActionButton(params: {
  className: string;
  title: string;
  icon: keyof typeof MESSAGE_ACTION_ICONS;
  successIcon?: keyof typeof MESSAGE_ACTION_ICONS;
}): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = params.className;
  button.title = params.title;
  button.setAttribute('aria-label', params.title);
  button.dataset.state = 'idle';
  button.innerHTML = `
    <span class="iclaw-message-action__icon iclaw-message-action__icon--idle">${MESSAGE_ACTION_ICONS[params.icon]}</span>
    <span class="iclaw-message-action__icon iclaw-message-action__icon--success">${MESSAGE_ACTION_ICONS[params.successIcon ?? 'check']}</span>
  `;
  return button;
}

function isSeededEmptySessionKey(value: string): boolean {
  const normalized = getChatSessionId(value).trim().toLowerCase();
  return SEEDED_EMPTY_SESSION_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function hasStoredChatSnapshotMessages(
  appName: string,
  sessionKey: string,
  conversationId?: string | null,
): boolean {
  return (readChatSessionSnapshot(appName, sessionKey, conversationId)?.messages?.length ?? 0) > 0;
}

function snapshotHasMeaningfulRenderableMessages(messages: unknown[]): boolean {
  return messages.some((message) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      return false;
    }

    const record = message as Record<string, unknown>;
    const role = typeof record.role === 'string' ? record.role.trim().toLowerCase() : '';
    if (role !== 'user' && role !== 'assistant') {
      return false;
    }

    if (typeof record.content === 'string' && record.content.trim()) {
      return true;
    }

    if (!Array.isArray(record.content)) {
      return false;
    }

    return record.content.some((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return false;
      }
      const block = item as Record<string, unknown>;
      if (typeof block.text === 'string' && block.text.trim()) {
        return true;
      }
      if (block.type === 'image' || block.type === 'file' || block.type === 'video') {
        return true;
      }
      return Boolean(block.source);
    });
  });
}

function hasReusableEmptyGeneralConversation(
  appName: string,
  sessionKey: string,
  conversationId?: string | null,
): boolean {
  if (!isGeneralChatSessionKey(sessionKey)) {
    return false;
  }

  const conversation =
    (conversationId ? readChatConversation(conversationId) : null) ||
    findChatConversationBySessionKey(sessionKey);
  if (!conversation || conversation.kind !== 'general') {
    return false;
  }
  if ((conversation.title ?? '').trim()) {
    return false;
  }

  const hasTurns = readChatTurns().some((turn) => turn.source === 'chat' && turn.conversationId === conversation.id);
  if (hasTurns) {
    return false;
  }

  const snapshot = readChatSessionSnapshot(appName, sessionKey, conversationId);
  return !snapshotHasMeaningfulRenderableMessages(snapshot?.messages ?? []);
}

function shouldTreatAsImmediateEmptySession(
  appName: string,
  sessionKey: string,
  conversationId?: string | null,
): boolean {
  if (isSeededEmptySessionKey(sessionKey) && !hasStoredChatSnapshotMessages(appName, sessionKey, conversationId)) {
    return true;
  }
  return hasReusableEmptyGeneralConversation(appName, sessionKey, conversationId);
}

async function loadChatModelSnapshot(
  app: OpenClawAppElement,
  targetSessionKey: string,
  input: {
    authBaseUrl: string;
    appName: string;
    conversationId?: string | null;
  },
): Promise<{
  options: ComposerModelOption[];
  selectedModelId: string | null;
  resolvedSessionKey: string | null;
  hasPersistedHistory: boolean;
  sessionPressure: ChatSessionPressureSnapshot;
  runtimeCatalog: RuntimeModelCatalogResponse;
} | null> {
  const request = app.client?.request;
  if (!app.connected || typeof request !== 'function') {
    return null;
  }

  const [runtimeCatalog, sessionsResult] = await Promise.all([
    fetchRuntimeModelCatalog(input),
    withTimeout(
      request<GatewaySessionsListResult>('sessions.list', {
        includeGlobal: true,
        includeUnknown: true,
        limit: GATEWAY_SESSION_LIST_LIMIT,
      }),
      MODEL_SNAPSHOT_RPC_TIMEOUT_MS,
      'gateway sessions.list',
    ),
  ]);

  const options = buildComposerModelOptions(mapRuntimeModelsToGatewayEntries(runtimeCatalog));
  const matchedSession = findPreferredGatewaySessionEntry(sessionsResult, targetSessionKey);
  const sessionModel = matchedSession?.model?.trim() ?? '';
  const defaultModel = sessionsResult?.defaults?.model?.trim() ?? '';
  const runtimeProfileMetadata =
    runtimeCatalog.profile && typeof runtimeCatalog.profile.metadata === 'object' && runtimeCatalog.profile.metadata
      ? runtimeCatalog.profile.metadata
      : null;
  const providerDefaultModel =
    typeof runtimeProfileMetadata?.default_model_ref === 'string'
      ? runtimeProfileMetadata.default_model_ref.trim()
      : typeof runtimeProfileMetadata?.defaultModelRef === 'string'
        ? runtimeProfileMetadata.defaultModelRef.trim()
        : '';
  const resolvedSelection =
    findComposerModelOption(options, sessionModel)?.id ||
    findComposerModelOption(options, defaultModel)?.id ||
    findComposerModelOption(options, providerDefaultModel)?.id ||
    options[0]?.id ||
    null;

  const storedSnapshot = readStoredChatSnapshot({
    appName: input.appName,
    sessionKey: targetSessionKey,
    conversationId: input.conversationId,
  });
  const storedMessageGroups = countRenderableMessageGroups(storedSnapshot?.messages ?? []);
  const hasStoredHistory = storedMessageGroups > 0;
  const hasSessionTokenHistory =
    Math.max(0, Number(matchedSession?.inputTokens ?? 0)) + Math.max(0, Number(matchedSession?.outputTokens ?? 0)) > 0;
  const hasPersistedHistory = hasStoredHistory || hasSessionTokenHistory;

  return {
    options,
    selectedModelId: resolvedSelection,
    resolvedSessionKey: matchedSession ? canonicalizeChatSessionKey(matchedSession.key) : null,
    hasPersistedHistory,
    sessionPressure: buildChatSessionPressureSnapshot({
      inputTokens: matchedSession?.inputTokens ?? 0,
      outputTokens: matchedSession?.outputTokens ?? 0,
      messageGroups: storedMessageGroups,
      hasPersistedHistory,
    }),
    runtimeCatalog,
  };
}

function findGatewaySessionEntry(
  sessionsResult: GatewaySessionsListResult | null | undefined,
  targetSessionKey: string,
): GatewaySessionsListResult['sessions'][number] | null {
  return findPreferredGatewaySessionEntry(sessionsResult, targetSessionKey);
}

async function loadGatewaySessionTokenSnapshot(
  app: OpenClawAppElement,
  targetSessionKey: string,
): Promise<{ inputTokens: number; outputTokens: number } | null> {
  const request = app.client?.request;
  if (!app.connected || typeof request !== 'function') {
    return null;
  }

  const sessionsResult = await request<GatewaySessionsListResult>('sessions.list', {
    includeGlobal: true,
    includeUnknown: true,
    limit: GATEWAY_SESSION_LIST_LIMIT,
  });
  const session = findGatewaySessionEntry(sessionsResult, targetSessionKey);
  if (!session) {
    return null;
  }

  return {
    inputTokens: Math.max(0, Number(session.inputTokens || 0)),
    outputTokens: Math.max(0, Number(session.outputTokens || 0)),
  };
}

function isSessionRenderReady(renderState: ChatSurfaceRenderState): boolean {
  if (renderState.hasNativeInput && renderState.nativeInputVisible) {
    return true;
  }
  if (!renderState.hasThread) {
    return renderState.hostHeight > 0;
  }

  return renderState.threadVisible || renderState.groupCount === 0;
}

function ChatSurfaceSkeletonMask({
  mode,
  label,
}: {
  mode: ChatSurfaceTransitionMode;
  label: string;
}) {
  if (mode === 'switch') {
    return (
      <div className="iclaw-chat-switch-indicator" role="status" aria-live="polite">
        <span className="iclaw-chat-switch-indicator__dot" aria-hidden="true" />
        <span className="iclaw-chat-switch-indicator__label">{label}</span>
      </div>
    );
  }

  return (
    <div className="iclaw-chat-boot-mask" data-mode={mode} role="status" aria-live="polite">
      <span className="iclaw-chat-boot-mask__sr-only">{label}</span>
      <div className="iclaw-chat-skeleton" aria-hidden="true">
        <div className="iclaw-chat-skeleton__header">
          <div className="iclaw-chat-skeleton__dot" />
          <div className="iclaw-chat-skeleton__title" />
          <div className="iclaw-chat-skeleton__meta" />
        </div>
        <div className="iclaw-chat-skeleton__thread">
          <div className="iclaw-chat-skeleton__group iclaw-chat-skeleton__group--assistant">
            <div className="iclaw-chat-skeleton__avatar" />
            <div className="iclaw-chat-skeleton__stack">
              <div className="iclaw-chat-skeleton__line iclaw-chat-skeleton__line--wide" />
              <div className="iclaw-chat-skeleton__line iclaw-chat-skeleton__line--medium" />
              <div className="iclaw-chat-skeleton__line iclaw-chat-skeleton__line--short" />
            </div>
          </div>
          <div className="iclaw-chat-skeleton__group iclaw-chat-skeleton__group--user">
            <div className="iclaw-chat-skeleton__stack iclaw-chat-skeleton__stack--user">
              <div className="iclaw-chat-skeleton__bubble iclaw-chat-skeleton__bubble--long" />
              <div className="iclaw-chat-skeleton__bubble iclaw-chat-skeleton__bubble--short" />
            </div>
            <div className="iclaw-chat-skeleton__avatar iclaw-chat-skeleton__avatar--user" />
          </div>
          <div className="iclaw-chat-skeleton__group iclaw-chat-skeleton__group--assistant">
            <div className="iclaw-chat-skeleton__avatar" />
            <div className="iclaw-chat-skeleton__stack">
              <div className="iclaw-chat-skeleton__line iclaw-chat-skeleton__line--medium" />
              <div className="iclaw-chat-skeleton__line iclaw-chat-skeleton__line--wide" />
            </div>
          </div>
        </div>
        <div className="iclaw-chat-skeleton__composer">
          <div className="iclaw-chat-skeleton__composer-line" />
          <div className="iclaw-chat-skeleton__composer-actions">
            <div className="iclaw-chat-skeleton__composer-chip" />
            <div className="iclaw-chat-skeleton__composer-button" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function OpenClawChatSurface({
  gatewayUrl,
  gatewayToken,
  gatewayPassword,
  authBaseUrl,
  appName,
  conversationId = null,
  sessionKey = 'agent:main:main',
  initialPrompt = null,
  initialPromptKey = null,
  focusedTurnId = null,
  focusedTurnKey = null,
  initialAgentSlug = null,
  initialSkillSlug = null,
  initialSkillOption = null,
  initialStockContext = null,
  shellAuthenticated = false,
  creditClient,
  creditToken,
  onCreditBalanceRefresh,
  user,
  inputComposerConfig = null,
  welcomePageConfig = null,
  onGeneralChatSessionOverloaded,
  onOpenRechargeCenter,
  onRequireAuth,
  runtimeStateKey,
  onRuntimeStateChange,
  ensureRuntimeReadyForRecovery,
  surfaceVisible = true,
  sendBlockedReason = null,
}: OpenClawChatSurfaceProps) {
  const normalizedSnapshotSessionKey = canonicalizeChatSessionKey(sessionKey);
  const localStoredSnapshot = readStoredChatSnapshot({
    appName,
    sessionKey: normalizedSnapshotSessionKey,
    conversationId,
  });
  const localStoredSnapshotMessageCount = Array.isArray(localStoredSnapshot?.messages)
    ? localStoredSnapshot.messages.length
    : 0;
  const hasLocalStoredSnapshotMessages = localStoredSnapshotMessageCount > 0;
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<OpenClawAppElement | null>(null);
  const composerRef = useRef<RichChatComposerHandle | null>(null);
  const reconnectKeyRef = useRef<string | null>(null);
  const autoRecoveryTimerRef = useRef<number | null>(null);
  const autoRecoveryAttemptsRef = useRef(0);
  const overloadedGeneralSessionRef = useRef<string | null>(null);
  const overloadedGeneralSessionRotationTimerRef = useRef<number | null>(null);
  const initialScrollScheduledRef = useRef(false);
  const consumedFocusedTurnKeyRef = useRef<string | null>(null);
  const focusedTurnHighlightTimerRef = useRef<number | null>(null);
  const shellDragDepthRef = useRef(0);
  const artifactAutoOpenStateRef = useRef<ArtifactAutoOpenState>({
    lastBusy: false,
    runSequence: 0,
    pendingRunSequence: null,
    pendingScanCount: 0,
    lastOpenedToken: null,
  });
  const artifactAutoOpenTimerRef = useRef<number | null>(null);
  const artifactAutoOpenBurstTimersRef = useRef<number[]>([]);
  const usageSettlementTimersRef = useRef<number[]>([]);
  const usageSettlementAttemptSequenceRef = useRef(0);
  const usageSettlementDiagnosticsRef = useRef<UsageSettlementAttemptDiagnostic[]>([]);
  const activeChatTurnRunRef = useRef<ActiveChatTurnRun | null>(null);
  const storedPendingUsageSettlementsRef = useRef<PendingUsageSettlement[]>([]);
  const pendingUsageSettlementsRef = useRef<PendingUsageSettlement[]>([]);
  const queuedMessagesRef = useRef<QueuedComposerMessage[]>([]);
  const queueDispatchInFlightRef = useRef<string | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const [status, setStatus] = useState<ChatSurfaceStatus>({
    busy: false,
    responsePhase: 'idle',
    connected: false,
    lastError: null,
    lastErrorCode: null,
  });
  const [renderState, setRenderState] = useState<ChatSurfaceRenderState>(() => ({
    ...createEmptyChatSurfaceRenderState(),
    chatMessageCount: localStoredSnapshotMessageCount,
  }));
  const [showConnectionCard, setShowConnectionCard] = useState(false);
  const [showRenderDiagnosticsCard, setShowRenderDiagnosticsCard] = useState(false);
  const [rechargeNoticeDismissed, setRechargeNoticeDismissed] = useState(false);
  const [creditBlockNotice, setCreditBlockNotice] = useState<CreditBlockNotice | null>(null);
  const [initialSurfaceRestorePending, setInitialSurfaceRestorePending] = useState(
    () =>
      shellAuthenticated &&
      !hasLocalStoredSnapshotMessages &&
      !shouldTreatAsImmediateEmptySession(appName, sessionKey, conversationId),
  );
  const [hasBootSettled, setHasBootSettled] = useState(false);
  const [sessionHistoryState, setSessionHistoryState] = useState<SessionHistoryState>(
    !shellAuthenticated
      ? 'empty'
      : shouldTreatAsImmediateEmptySession(appName, sessionKey, conversationId)
        ? 'empty'
        : 'unknown',
  );
  const [unhandledGatewayError, setUnhandledGatewayError] = useState<UnhandledGatewayError | null>(null);
  const [lastRpcFailure, setLastRpcFailure] = useState<GatewayRpcFailure | null>(null);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(null);
  const [highRiskConfirmationRequest, setHighRiskConfirmationRequest] = useState<HighRiskConfirmationRequest | null>(null);
  const [modelOptions, setModelOptions] = useState<ComposerModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [resolvedModelSessionKey, setResolvedModelSessionKey] = useState<string | null>(null);
  const [shellDropActive, setShellDropActive] = useState(false);
  const [shellDropSummary, setShellDropSummary] = useState<DraggedFileSummary | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelSwitching, setModelSwitching] = useState(false);
  const [sessionTransitionVisible, setSessionTransitionVisible] = useState(false);
  const [surfaceReactivating, setSurfaceReactivating] = useState(false);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const [optimisticEmptySessionActive, setOptimisticEmptySessionActive] = useState(() =>
    shouldTreatAsImmediateEmptySession(appName, sessionKey, conversationId),
  );
  const [embeddedResetEpoch, setEmbeddedResetEpoch] = useState(0);
  const [compatibilityRecoveryActive, setCompatibilityRecoveryActive] = useState(false);
  const [composerDraft, setComposerDraft] = useState<ComposerDraftPayload | null>(null);
  const [assistantFooterVersion, setAssistantFooterVersion] = useState(0);
  const [sessionBillingSummaries, setSessionBillingSummaries] = useState<RunBillingSummaryData[]>([]);
  const [globalPendingSettlementCount, setGlobalPendingSettlementCount] = useState(0);
  const [pendingSettlementCount, setPendingSettlementCount] = useState(0);
  const [queuedMessages, setQueuedMessages] = useState<QueuedComposerMessage[]>([]);
  const [artifactPreview, setArtifactPreview] = useState<ArtifactPreviewState | null>(null);
  const [creditEstimate, setCreditEstimate] = useState<ComposerCreditEstimateState>({
    loading: false,
    low: null,
    high: null,
    error: null,
    estimatedInputTokens: null,
    estimatedOutputTokens: null,
  });

  useEffect(() => {
    if (!runtimeStateKey) {
      return;
    }
    onRuntimeStateChange?.(runtimeStateKey, {busy: status.busy});
  }, [onRuntimeStateChange, runtimeStateKey, status.busy]);

  useEffect(() => {
    return () => {
      if (!runtimeStateKey) {
        return;
      }
      onRuntimeStateChange?.(runtimeStateKey, {busy: false});
    };
  }, [onRuntimeStateChange, runtimeStateKey]);

  useEffect(() => {
    return () => {
      if (focusedTurnHighlightTimerRef.current != null) {
        window.clearTimeout(focusedTurnHighlightTimerRef.current);
        focusedTurnHighlightTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!runtimeStateKey) {
      return;
    }
    onRuntimeStateChange?.(runtimeStateKey, {
      hasPendingBilling: globalPendingSettlementCount > 0,
    });
  }, [globalPendingSettlementCount, onRuntimeStateChange, runtimeStateKey]);

  useEffect(() => {
    return () => {
      if (!runtimeStateKey) {
        return;
      }
      onRuntimeStateChange?.(runtimeStateKey, {hasPendingBilling: false});
    };
  }, [onRuntimeStateChange, runtimeStateKey]);

  useEffect(() => {
    queuedMessagesRef.current = queuedMessages;
  }, [queuedMessages]);

  const effectiveGatewaySessionKey = resolvedModelSessionKey || sessionKey;
  const sessionBillingScopeKeys = collectCanonicalSessionKeys(sessionKey, effectiveGatewaySessionKey);
  const sessionBillingScopeKeySignature = sessionBillingScopeKeys.join('|');
  const [installedLobsterAgents, setInstalledLobsterAgents] = useState<ComposerAgentOption[]>([]);
  const [skillOptions, setSkillOptions] = useState<ComposerSkillOption[]>([]);
  const consumedInitialPromptKeyRef = useRef<string | null>(null);
  const statusLogRef = useRef<string | null>(null);
  const rpcLogRef = useRef<string | null>(null);
  const unhandledLogRef = useRef<string | null>(null);
  const selectionMenuRef = useRef<HTMLDivElement | null>(null);
  const modelLoadVersionRef = useRef(0);
  const messageActionTimersRef = useRef<number[]>([]);
  const previousChatScopeRef = useRef(buildChatScopeIdentity(sessionKey, conversationId));
  const sessionTransitionPendingRef = useRef(false);
  const sessionTransitionStartedAtRef = useRef(0);
  const sessionModelBootstrapKeyRef = useRef<string | null>(null);
  const runtimeModelCatalogRef = useRef<RuntimeModelCatalogResponse | null>(null);
  const responseUsageEnabledSessionKeyRef = useRef<string | null>(null);
  const persistedChatSnapshotRef = useRef<string | null>(null);
  const forcedSnapshotRestoreScopeRef = useRef<string | null>(null);
  const artifactPreviewWorkspaceDirRef = useRef<string | null>(null);
  const artifactPreviewRequestSeqRef = useRef(0);
  const sessionTransitionHideTimerRef = useRef<number | null>(null);
  const surfaceReactivationTimerRef = useRef<number | null>(null);
  const connectionLossTimerRef = useRef<number | null>(null);
  const busyRef = useRef(status.busy);
  const previousSurfaceVisibleRef = useRef(surfaceVisible);
  const hasActivatedStableSurfaceRef = useRef(false);
  const compatibilityRecoveryAttemptsRef = useRef(0);
  const renderRecoveryAttemptsRef = useRef(0);
  const pendingConnectionLossStatusRef = useRef<ChatSurfaceStatus>({
    busy: false,
    responsePhase: 'idle',
    connected: false,
    lastError: null,
    lastErrorCode: null,
  });
  const hasObservedHistory =
    !optimisticEmptySessionActive &&
    (
      hasLocalStoredSnapshotMessages ||
      renderState.groupCount > 0 ||
      renderState.chatMessageCount > 0 ||
      Boolean(appRef.current?.chatMessages?.length)
    );

  const closeSelectionMenu = useCallback(() => {
    setSelectionMenu(null);
  }, []);

  const clearSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }
    selection.removeAllRanges();
  }, []);

  const resolveActiveThread = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) {
      return null;
    }
    const threads = Array.from(
      shell.querySelectorAll<HTMLElement>('.openclaw-chat-surface .chat-thread'),
    );
    return (
      threads.find((thread) => {
        const rect = thread.getBoundingClientRect();
        return rect.height > 0 && rect.width > 0;
      }) ?? null
    );
  }, []);

  const getThreadDistanceToBottom = useCallback((thread: HTMLElement | null) => {
    if (!thread) {
      return 0;
    }
    return Math.max(0, thread.scrollHeight - thread.clientHeight - thread.scrollTop);
  }, []);

  const syncScrollToBottomState = useCallback((thread?: HTMLElement | null) => {
    const activeThread = thread ?? resolveActiveThread();
    if (!activeThread) {
      shouldAutoScrollRef.current = true;
      setShowScrollToBottomButton(false);
      return true;
    }

    const distanceToBottom = getThreadDistanceToBottom(activeThread);
    const nearBottomThreshold = Math.max(96, Math.ceil(activeThread.clientHeight * 0.1));
    const showButtonThreshold = Math.max(220, nearBottomThreshold * 2);
    const isNearBottom = distanceToBottom <= nearBottomThreshold;

    shouldAutoScrollRef.current = isNearBottom;
    setShowScrollToBottomButton((current) => {
      const next = distanceToBottom > showButtonThreshold;
      return current === next ? current : next;
    });
    return isNearBottom;
  }, [getThreadDistanceToBottom, resolveActiveThread]);

  const scrollChatToBottom = useCallback(
    ({force = false, smooth = false}: {force?: boolean; smooth?: boolean} = {}) => {
      const app = appRef.current;
      if (!app) {
        return;
      }

      if (force) {
        shouldAutoScrollRef.current = true;
        setShowScrollToBottomButton(false);
      } else if (!syncScrollToBottomState()) {
        return;
      }

      if (smooth) {
        app.scrollToBottom({smooth: true});
      } else {
        app.scrollToBottom();
      }

      window.requestAnimationFrame(() => {
        syncScrollToBottomState();
      });
    },
    [syncScrollToBottomState],
  );

  const clearArtifactAutoOpenTimers = useCallback(() => {
    if (artifactAutoOpenTimerRef.current != null) {
      window.clearTimeout(artifactAutoOpenTimerRef.current);
      artifactAutoOpenTimerRef.current = null;
    }
    artifactAutoOpenBurstTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    artifactAutoOpenBurstTimersRef.current = [];
  }, []);

  const clearMessageActionTimers = useCallback(() => {
    messageActionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    messageActionTimersRef.current = [];
  }, []);

  const clearUsageSettlementTimers = useCallback(() => {
    usageSettlementTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    usageSettlementTimersRef.current = [];
  }, []);

  const clearOverloadedGeneralSessionRotationTimer = useCallback(() => {
    if (overloadedGeneralSessionRotationTimerRef.current == null) {
      return;
    }
    window.clearTimeout(overloadedGeneralSessionRotationTimerRef.current);
    overloadedGeneralSessionRotationTimerRef.current = null;
  }, []);

  const closeArtifactPreview = useCallback(() => {
    artifactPreviewRequestSeqRef.current += 1;
    setArtifactPreview(null);
  }, []);

  const ensureArtifactPreviewWorkspaceDir = useCallback(async (): Promise<string | null> => {
    if (artifactPreviewWorkspaceDirRef.current) {
      return artifactPreviewWorkspaceDirRef.current;
    }

    const app = appRef.current;
    const request = app?.client?.request;
    if (!app?.connected || typeof request !== 'function') {
      return null;
    }

    try {
      const result = await request<{workspace?: string} | null>('agents.files.list', {
        agentId: 'main',
      });
      const workspace =
        typeof result?.workspace === 'string' && result.workspace.trim()
          ? result.workspace.trim()
          : null;
      artifactPreviewWorkspaceDirRef.current = workspace;
      return workspace;
    } catch {
      return null;
    }
  }, []);

  const openArtifactPreviewFromCard = useCallback(
    async (card: HTMLElement) => {
      const app = appRef.current;
      const request = app?.client?.request;
      if (!app?.connected || typeof request !== 'function') {
        return false;
      }

      app.handleCloseSidebar?.();

      const path = extractArtifactPathFromCard(card);
      const inlineContent = extractArtifactInlineContentFromCard(card);
      const previewPath = path ?? 'artifact';
      const previewKind = resolveArtifactPreviewKind(path);
      const title = buildArtifactPreviewTitle(previewPath);
      const requestSeq = artifactPreviewRequestSeqRef.current + 1;
      artifactPreviewRequestSeqRef.current = requestSeq;

      if (!path && inlineContent) {
        setArtifactPreview({
          title,
          path: previewPath,
          kind: 'text',
          content: inlineContent,
          loading: false,
          error: null,
        });
        return true;
      }

      if (!path) {
        setArtifactPreview({
          title,
          path: previewPath,
          kind: 'unsupported',
          content: null,
          loading: false,
          error: '未解析到制品文件路径，当前无法在右侧分屏展示真实内容。',
        });
        return false;
      }

      if (previewKind === 'unsupported') {
        setArtifactPreview({
          title,
          path,
          kind: previewKind,
          content: null,
          loading: false,
          error: `暂不支持直接预览 ${extractArtifactExtension(path)?.toUpperCase() ?? '该'} 文件，请改成文本/Markdown/HTML 制品后再预览。`,
        });
        return false;
      }

      setArtifactPreview({
        title,
        path,
        kind: previewKind,
        content: null,
        loading: true,
        error: null,
      });

      const workspaceDir = await ensureArtifactPreviewWorkspaceDir();
      const nameCandidates = buildArtifactWorkspaceNameCandidates(path, workspaceDir);

      let resolvedContent: string | null = null;
      let resolvedName: string | null = null;
      for (const candidateName of nameCandidates) {
        try {
          const result = await request<{file?: {content?: string | null}} | null>('agents.files.get', {
            agentId: 'main',
            name: candidateName,
          });
          if (typeof result?.file?.content === 'string') {
            resolvedContent = result.file.content;
            resolvedName = candidateName;
            break;
          }
        } catch {
          // Try the next candidate before surfacing a failure.
        }
      }

      if (artifactPreviewRequestSeqRef.current !== requestSeq) {
        return true;
      }

      if (resolvedContent == null) {
        setArtifactPreview({
          title,
          path,
          kind: previewKind,
          content: null,
          loading: false,
          error: '已识别到制品卡片，但没有从 OpenClaw workspace 读到对应文件内容。',
        });
        return false;
      }

      setArtifactPreview({
        title,
        path: resolvedName ?? path,
        kind: previewKind,
        content: resolvedContent,
        loading: false,
        error: null,
      });
      return true;
    },
    [ensureArtifactPreviewWorkspaceDir],
  );

  useEffect(() => {
    busyRef.current = status.busy;
  }, [status.busy]);

  const clearSessionTransitionTimer = useCallback(() => {
    if (sessionTransitionHideTimerRef.current != null) {
      window.clearTimeout(sessionTransitionHideTimerRef.current);
      sessionTransitionHideTimerRef.current = null;
    }
  }, []);

  const clearConnectionLossTimer = useCallback(() => {
    if (connectionLossTimerRef.current != null) {
      window.clearTimeout(connectionLossTimerRef.current);
      connectionLossTimerRef.current = null;
    }
  }, []);

  const clearAutoRecoveryTimer = useCallback(() => {
    if (autoRecoveryTimerRef.current != null) {
      window.clearTimeout(autoRecoveryTimerRef.current);
      autoRecoveryTimerRef.current = null;
    }
  }, []);

  const scheduleOverloadedGeneralSessionRotation = useCallback(
    (pressure: ChatSessionPressureSnapshot, targetSessionKey: string) => {
      clearOverloadedGeneralSessionRotationTimer();
      overloadedGeneralSessionRotationTimerRef.current = window.setTimeout(() => {
        overloadedGeneralSessionRotationTimerRef.current = null;
        if (overloadedGeneralSessionRef.current !== targetSessionKey) {
          return;
        }
        onGeneralChatSessionOverloaded?.(pressure);
      }, 0);
    },
    [clearOverloadedGeneralSessionRotationTimer, onGeneralChatSessionOverloaded],
  );

  const persistChatSessionSnapshot = useCallback(() => {
    const app = appRef.current;
    if (!app) {
      return;
    }
    const messages = Array.isArray(app.chatMessages) ? app.chatMessages : [];
    if (messages.length === 0 && persistedChatSnapshotRef.current) {
      return;
    }
    const activePendingUsageSettlements = filterPendingUsageSettlementsForSession(
      storedPendingUsageSettlementsRef.current,
      sessionKey,
      conversationId,
    );
    reconcileChatMessageRunMetadata({
      messages,
      pendingSettlements: activePendingUsageSettlements,
      sessionBillingSummaries,
    });
    const comparableSnapshotValue =
      messages.length > 0
        ? buildChatSessionSnapshotComparableValue({
            sessionKey,
            messages,
            pendingUsageSettlements: activePendingUsageSettlements,
          })
        : null;
    if (persistedChatSnapshotRef.current === comparableSnapshotValue) {
      return;
    }
    const previousSnapshot =
      messages.length > 0
        ? readChatSessionSnapshot(appName, sessionKey, conversationId)
        : null;
    const snapshot =
      messages.length > 0
        ? {
            sessionKey,
            savedAt:
              comparableSnapshotValue !== null &&
              buildChatSessionSnapshotComparableValue(previousSnapshot) === comparableSnapshotValue
                ? previousSnapshot?.savedAt ?? Date.now()
                : Date.now(),
            messages,
            pendingUsageSettlements: activePendingUsageSettlements,
          }
        : null;
    writeChatSessionSnapshot(appName, sessionKey, snapshot, conversationId);
    persistedChatSnapshotRef.current = comparableSnapshotValue;
  }, [appName, conversationId, sessionBillingSummaries, sessionKey]);

  const replacePendingUsageSettlements = useCallback(
    (next: PendingUsageSettlement[]) => {
      const normalizedNext = mergePendingUsageSettlementRecords([], next);
      storedPendingUsageSettlementsRef.current = normalizedNext;
      writeStoredPendingUsageSettlements(appName, normalizedNext);
      const activeSessionPendings = filterPendingUsageSettlementsForSession(normalizedNext, sessionKey, conversationId);
      pendingUsageSettlementsRef.current = activeSessionPendings;
      setGlobalPendingSettlementCount(normalizedNext.length);
      setPendingSettlementCount(activeSessionPendings.length);
      persistChatSessionSnapshot();
    },
    [appName, conversationId, persistChatSessionSnapshot, sessionKey],
  );

  const mergeSessionBillingSummary = useCallback((summary: RunBillingSummaryData) => {
    setSessionBillingSummaries((current) =>
      filterRunBillingSummariesBySessionKeys(mergeRunBillingSummaries(current, [summary]), sessionBillingScopeKeys),
    );
  }, [sessionBillingScopeKeySignature]);

  const requestFreshCreditQuote = useCallback(
    async (
      prompt: string,
      attachments: ComposerDraftAttachment[],
    ): Promise<CreditQuoteData> => {
      if (!creditClient || !creditToken) {
        throw new Error('当前账号龙虾币鉴权尚未就绪，暂时不能发送消息。');
      }

      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt && attachments.length === 0) {
        throw new Error('发送内容为空。');
      }

      const historyMessages = estimateHistoryMessagesFromGroups(renderState.groupCount);
      return creditClient.creditsQuote(creditToken, {
        message: trimmedPrompt,
        model: selectedModelId || undefined,
        appName,
        historyMessages,
        hasSearch: inferCreditQuoteHasSearch(trimmedPrompt),
        hasTools: true,
        attachments: attachments.map((item) => ({
          type: item.type,
        })),
      });
    },
    [appName, creditClient, creditToken, renderState.groupCount, selectedModelId],
  );

  const tryAutoOpenArtifactCard = useCallback(() => {
    const host = hostRef.current;
    const state = artifactAutoOpenStateRef.current;
    if (!host || state.pendingRunSequence == null) {
      return false;
    }

    const candidate = findLatestArtifactToolCard(host);
    if (!candidate) {
      if (state.pendingScanCount >= 12) {
        state.pendingRunSequence = null;
      }
      return false;
    }

    const signature = buildToolCardSignature(candidate);
    const token = `${state.pendingRunSequence}:${signature}`;
    if (state.lastOpenedToken === token) {
      state.pendingRunSequence = null;
      return true;
    }

    state.lastOpenedToken = token;
    state.pendingRunSequence = null;
    void openArtifactPreviewFromCard(candidate);
    return true;
  }, [openArtifactPreviewFromCard]);

  const queueArtifactAutoOpenScan = useCallback(
    (delay = 80) => {
      if (artifactAutoOpenTimerRef.current != null) {
        window.clearTimeout(artifactAutoOpenTimerRef.current);
      }
      artifactAutoOpenTimerRef.current = window.setTimeout(() => {
        artifactAutoOpenTimerRef.current = null;
        artifactAutoOpenStateRef.current.pendingScanCount += 1;
        tryAutoOpenArtifactCard();
      }, delay);
    },
    [tryAutoOpenArtifactCard],
  );

  const resolveChatSelection = useCallback((): { text: string; label: string } | null => {
    const host = hostRef.current;
    const selection = window.getSelection();
    if (!host || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }

    const text = selection.toString().replace(/\u00a0/g, ' ').trim();
    if (!text) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const commonAncestor =
      range.commonAncestorContainer instanceof Element
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    if (!commonAncestor) {
      return null;
    }

    const chatThread = commonAncestor.closest('.chat-thread');
    if (!chatThread || !host.contains(chatThread)) {
      return null;
    }

    return {
      text,
      label: buildSelectionLabel(text),
    };
  }, []);

  // Keep this callback declared before any hooks/callbacks that reference it.
  const refreshModelCatalog = useCallback(async (): Promise<boolean> => {
    const app = appRef.current;
    if (!app) {
      return false;
    }

    const requestVersion = modelLoadVersionRef.current + 1;
    modelLoadVersionRef.current = requestVersion;
    setModelsLoading(true);

    try {
      const snapshot = await loadChatModelSnapshot(app, sessionKey, {
        authBaseUrl,
        appName,
        conversationId,
      });
      if (!snapshot || modelLoadVersionRef.current !== requestVersion) {
        return false;
      }
      if (
        isGeneralChatSessionKey(sessionKey) &&
        snapshot.sessionPressure.overloaded &&
        snapshot.hasPersistedHistory &&
        overloadedGeneralSessionRef.current !== sessionKey
      ) {
        overloadedGeneralSessionRef.current = sessionKey;
        scheduleOverloadedGeneralSessionRotation(snapshot.sessionPressure, sessionKey);
        return true;
      }
      if (!snapshot.sessionPressure.overloaded && overloadedGeneralSessionRef.current === sessionKey) {
        clearOverloadedGeneralSessionRotationTimer();
        overloadedGeneralSessionRef.current = null;
      }

      setModelOptions(snapshot.options);
      setSelectedModelId(snapshot.selectedModelId);
      setResolvedModelSessionKey(snapshot.resolvedSessionKey);
      runtimeModelCatalogRef.current = snapshot.runtimeCatalog;
      setSessionHistoryState(snapshot.hasPersistedHistory ? 'has-history' : 'empty');
      if (snapshot.hasPersistedHistory) {
        setOptimisticEmptySessionActive(false);
      }
      return true;
    } catch (error) {
      if (modelLoadVersionRef.current === requestVersion) {
        const message = error instanceof Error ? error.message : '模型列表同步失败';
        setStatus((current) => ({
          ...current,
          lastError: current.lastError ?? message,
        }));
      }
      return false;
    } finally {
      if (modelLoadVersionRef.current === requestVersion) {
        setModelsLoading(false);
      }
    }
  }, [
    appName,
    authBaseUrl,
    clearOverloadedGeneralSessionRotationTimer,
    conversationId,
    scheduleOverloadedGeneralSessionRotation,
    sessionKey,
  ]);

  const performEmbeddedCompatibilityReset = useCallback(
    (reason: string) => {
      console.warn('[desktop] reset openclaw embedded chat surface for self-heal', {
        sessionKey,
        reason,
        compatibilityAttempt: compatibilityRecoveryAttemptsRef.current,
        renderAttempt: renderRecoveryAttemptsRef.current,
      });
      clearOpenClawEmbeddedState(gatewayUrl);
      reconnectKeyRef.current = null;
      initialScrollScheduledRef.current = false;
      pendingConnectionLossStatusRef.current = {
        busy: false,
        responsePhase: 'idle',
        connected: false,
        lastError: null,
        lastErrorCode: null,
      };
      setCompatibilityRecoveryActive(false);
      setStatus((current) => ({
        ...current,
        responsePhase: 'idle',
        connected: false,
        lastError: null,
        lastErrorCode: null,
      }));
      setRenderState(createEmptyChatSurfaceRenderState());
      setHasBootSettled(false);
      setShowConnectionCard(false);
      setShowRenderDiagnosticsCard(false);
      if (
        shellAuthenticated &&
        !hasStoredChatSnapshotMessages(appName, sessionKey, conversationId) &&
        !shouldTreatAsImmediateEmptySession(appName, sessionKey, conversationId)
      ) {
        setInitialSurfaceRestorePending(true);
      }
      setEmbeddedResetEpoch((current) => current + 1);
    },
    [appName, conversationId, gatewayUrl, sessionKey, shellAuthenticated],
  );

  const scheduleSelfHealingRecovery = useCallback(
    (cause: 'transport' | 'compatibility' | 'render-stuck', reason: string, baseDelayMs = 320) => {
      if (autoRecoveryTimerRef.current != null) {
        return;
      }

      const attempt =
        cause === 'transport'
          ? autoRecoveryAttemptsRef.current
          : cause === 'compatibility'
            ? compatibilityRecoveryAttemptsRef.current
            : renderRecoveryAttemptsRef.current;
      const action = resolveOpenClawChatRecoveryAction({ attempt, cause });
      if (action === 'none') {
        return;
      }

      const delayMs = Math.min(2_500, baseDelayMs * Math.max(1, 2 ** attempt));
      autoRecoveryTimerRef.current = window.setTimeout(() => {
        autoRecoveryTimerRef.current = null;
        if (cause === 'transport') {
          autoRecoveryAttemptsRef.current += 1;
        } else if (cause === 'compatibility') {
          compatibilityRecoveryAttemptsRef.current += 1;
        } else {
          renderRecoveryAttemptsRef.current += 1;
        }

        if (action === 'force-reveal') {
          console.warn('[desktop] force reveal openclaw chat surface in compatibility recovery mode', {
            sessionKey,
            cause,
            reason,
            attempt:
              cause === 'transport'
                ? autoRecoveryAttemptsRef.current
                : cause === 'compatibility'
                  ? compatibilityRecoveryAttemptsRef.current
                  : renderRecoveryAttemptsRef.current,
          });
          setCompatibilityRecoveryActive(true);
          try {
            appRef.current?.connect();
          } catch (error) {
            console.warn('[desktop] force-reveal reconnect failed to start', {
              sessionKey,
              cause,
              reason,
              error,
            });
          }
          window.setTimeout(() => {
            void refreshModelCatalog();
          }, 220);
          return;
        }

        if (action === 'reset-embedded') {
          performEmbeddedCompatibilityReset(reason);
          return;
        }

        const app = appRef.current;
        if (!app) {
          return;
        }
        console.warn('[desktop] attempt openclaw chat auto-recovery reconnect', {
          sessionKey,
          cause,
          reason,
          attempt:
            cause === 'transport'
              ? autoRecoveryAttemptsRef.current
              : cause === 'compatibility'
                ? compatibilityRecoveryAttemptsRef.current
                : renderRecoveryAttemptsRef.current,
        });
        void (async () => {
          if (cause === 'transport' && ensureRuntimeReadyForRecovery) {
            const recoveryResult = await ensureRuntimeReadyForRecovery();
            if (recoveryResult === 'failed' || recoveryResult === 'cooldown' || recoveryResult === 'restarting') {
              console.warn('[desktop] skip reconnect because local runtime recovery is pending', {
                sessionKey,
                cause,
                reason,
                recoveryResult,
              });
              return;
            }
          }

          try {
            app.connect();
          } catch (error) {
            console.warn('[desktop] openclaw reconnect attempt failed to start', {
              sessionKey,
              cause,
              reason,
              error,
            });
          }
          window.setTimeout(() => {
            void refreshModelCatalog();
          }, 220);
        })();
      }, delayMs);
    },
    [ensureRuntimeReadyForRecovery, performEmbeddedCompatibilityReset, refreshModelCatalog, sessionKey],
  );

  const ensureWrappedClientRequest = useCallback((app: OpenClawAppElement | null) => {
    const client = app?.client;
    if (!app || !client || typeof client.request !== 'function') {
      return;
    }

    const currentRequest = client.request as (((method: string, params?: unknown) => Promise<unknown>) & {
      __iclawWrapped?: boolean;
    });
    if (currentRequest.__iclawWrapped) {
      return;
    }

    const wrappedRequest = (async <T = unknown>(method: string, params?: unknown): Promise<T> => {
      try {
        return (await currentRequest.call(client, method, params)) as T;
      } catch (error) {
        const detailCode =
          typeof (error as { details?: { code?: unknown } }).details?.code === 'string'
            ? String((error as { details?: { code?: unknown } }).details?.code)
            : null;
        const codeValue = (error as { code?: unknown }).code;
        const messageValue = (error as { message?: unknown }).message;
        const code =
          typeof codeValue === 'number' || typeof codeValue === 'string' ? String(codeValue) : null;
        const message =
          typeof messageValue === 'string' && messageValue.trim()
            ? messageValue
            : error instanceof Error
              ? error.message
              : String(error);

        const compatibilityIssue =
          looksLikeOpenClawCompatibilityIssue(message) || looksLikeOpenClawCompatibilityIssue(detailCode);
        if (code === '403' || detailCode !== null || compatibilityIssue || message.toLowerCase().includes('forbidden')) {
          console.error('[iclaw][openclaw-rpc-failure]', {
            method,
            code,
            detailCode,
            message,
            params,
          });
          setLastRpcFailure({
            method,
            code,
            detailCode,
            message,
          });
        }
        throw error;
      }
    }) as typeof client.request & { __iclawWrapped?: boolean };

    wrappedRequest.__iclawWrapped = true;
    client.request = wrappedRequest;
  }, []);

  const resolveKernelModelSelection = useCallback((modelId: string | null | undefined): string | null => {
    return resolveRuntimeKernelModelRef(runtimeModelCatalogRef.current, modelId);
  }, []);

  const ensureGatewaySessionPrepared = useCallback(async (): Promise<void> => {
    const app = appRef.current;
    const request = app?.client?.request;
    if (!app?.connected || typeof request !== 'function') {
      throw new Error('尚未连接到 OpenClaw 网关，请稍后再试。');
    }

    const patchTargets = buildGatewaySessionPatchTargets(sessionKey, resolvedModelSessionKey);
    if (patchTargets.length === 0) {
      return;
    }
    const kernelModel = resolveKernelModelSelection(selectedModelId);

    await Promise.all(
      patchTargets.map((key) =>
        request('sessions.patch', {
          key,
          responseUsage: 'tokens',
          ...(kernelModel ? { model: kernelModel } : {}),
        }),
      ),
    );
    responseUsageEnabledSessionKeyRef.current = effectiveGatewaySessionKey;
  }, [effectiveGatewaySessionKey, resolveKernelModelSelection, resolvedModelSessionKey, selectedModelId, sessionKey]);

  const handleModelChange = useCallback(
    async (modelId: string) => {
      const nextModelId = modelId.trim();
      if (!nextModelId || nextModelId === selectedModelId) {
        return;
      }

      const app = appRef.current;
      const request = app?.client?.request;
      if (!app?.connected || typeof request !== 'function') {
        return;
      }

      const previousModelId = selectedModelId;
      const nextKernelModel = resolveKernelModelSelection(nextModelId);
      setModelSwitching(true);
      setSelectedModelId(nextModelId);

      try {
        const patchTargets = buildGatewaySessionPatchTargets(sessionKey, resolvedModelSessionKey);
        await Promise.all(
          patchTargets.map((key) =>
            request('sessions.patch', {
              key,
              model: nextKernelModel || nextModelId,
            }),
          ),
        );
        await refreshModelCatalog();
        setSelectedModelId((current) => current || nextModelId);
      } catch (error) {
        setSelectedModelId(previousModelId);
        if (isModelNotAllowedError(error)) {
          setSelectedModelId(null);
          setResolvedModelSessionKey(null);
          void refreshModelCatalog();
        }
        const message = error instanceof Error ? error.message : '模型切换失败';
        setStatus((current) => ({
          ...current,
          lastError: message,
        }));
      } finally {
        setModelSwitching(false);
      }
    },
    [refreshModelCatalog, resolveKernelModelSelection, resolvedModelSessionKey, selectedModelId, sessionKey],
  );

  const handleSearchStocks = useCallback(
    async (
      query: string,
      options?: {limit?: number; offset?: number},
    ): Promise<ComposerInstrumentSearchPage> => {
      if (!creditClient) {
        return {
          items: [],
          hasMore: false,
          nextOffset: null,
        };
      }

      const trimmedQuery = query.trim();
      const page = await creditClient.listMarketStocksPage({
        market: 'a_share',
        search: trimmedQuery || undefined,
        sort: 'amount_desc',
        limit: options?.limit ?? 8,
        offset: options?.offset ?? 0,
      });

      return {
        items: page.items.map((stock) => ({
          id: stock.id,
          symbol: stock.symbol,
          companyName: stock.company_name,
          exchange: stock.exchange,
          board: resolveStockComposerBoard(stock),
          instrumentKind: 'stock',
          instrumentLabel: '股票',
        })),
        hasMore: page.has_more,
        nextOffset: page.next_offset,
      };
    },
    [creditClient],
  );

  const handleSearchFunds = useCallback(
    async (
      query: string,
      options?: {limit?: number; offset?: number},
    ): Promise<ComposerInstrumentSearchPage> => {
      if (!creditClient) {
        return {
          items: [],
          hasMore: false,
          nextOffset: null,
        };
      }

      const trimmedQuery = query.trim();
      const page = await creditClient.listMarketFundsPage({
        market: 'cn_fund',
        search: trimmedQuery || undefined,
        sort: 'scale_desc',
        limit: options?.limit ?? 8,
        offset: options?.offset ?? 0,
      });

      return {
        items: page.items.map((fund) => ({
          id: fund.id,
          symbol: fund.symbol,
          companyName: fund.fund_name,
          exchange: fund.exchange,
          board: resolveFundComposerBoard(fund),
          instrumentKind: fund.instrument_kind,
          instrumentLabel: resolveFundComposerInstrumentLabel(fund),
        })),
        hasMore: page.has_more,
        nextOffset: page.next_offset,
      };
    },
    [creditClient],
  );

  const scheduleAutoRecoveryReconnect = useCallback((reason: string, baseDelayMs = 320) => {
    scheduleSelfHealingRecovery('transport', reason, baseDelayMs);
  }, [scheduleSelfHealingRecovery]);

  useLayoutEffect(() => {
    const nextChatScope = buildChatScopeIdentity(sessionKey, conversationId);
    if (previousChatScopeRef.current === nextChatScope) {
      return;
    }

    const localSnapshot = readChatSessionSnapshot(appName, sessionKey, conversationId);
    const hasImmediateSnapshot = (localSnapshot?.messages?.length ?? 0) > 0;
    const fastOpenEmptySession = !hasImmediateSnapshot && isSeededEmptySessionKey(sessionKey);
    const preserveVisibleSurfaceDuringSwitch =
      !hasImmediateSnapshot && !fastOpenEmptySession && hasActivatedStableSurfaceRef.current;
    setOptimisticEmptySessionActive(fastOpenEmptySession);
    setCompatibilityRecoveryActive(false);
    previousChatScopeRef.current = nextChatScope;
    sessionTransitionPendingRef.current = !hasImmediateSnapshot && !fastOpenEmptySession;
    sessionTransitionStartedAtRef.current = performance.now();
    clearSessionTransitionTimer();
    setStatus((current) =>
      hasImmediateSnapshot || fastOpenEmptySession || preserveVisibleSurfaceDuringSwitch
        ? {
            ...current,
            responsePhase: 'idle',
            lastError: null,
            lastErrorCode: null,
          }
        : {
            ...current,
            responsePhase: 'idle',
            connected: false,
            lastError: null,
            lastErrorCode: null,
          },
    );
    if (!hasImmediateSnapshot && !preserveVisibleSurfaceDuringSwitch) {
      setRenderState(createEmptyChatSurfaceRenderState());
    }
    if (hasImmediateSnapshot) {
      setSessionHistoryState('has-history');
      setInitialSurfaceRestorePending(false);
      setSessionTransitionVisible(false);
    } else if (fastOpenEmptySession) {
      setSessionHistoryState('empty');
      setInitialSurfaceRestorePending(false);
      setSessionTransitionVisible(false);
    } else {
      setSessionTransitionVisible(true);
    }
    closeSelectionMenu();
  }, [appName, clearSessionTransitionTimer, closeSelectionMenu, conversationId, sessionKey]);

  useLayoutEffect(() => {
    if (pendingUsageSettlementsRef.current.length > 0) {
      console.warn('[desktop] drop pending credit settlements because session changed', pendingUsageSettlementsRef.current);
    }
    clearAutoRecoveryTimer();
    autoRecoveryAttemptsRef.current = 0;
    compatibilityRecoveryAttemptsRef.current = 0;
    renderRecoveryAttemptsRef.current = 0;
    clearOverloadedGeneralSessionRotationTimer();
    overloadedGeneralSessionRef.current = null;
    artifactAutoOpenStateRef.current = {
      lastBusy: false,
      runSequence: 0,
      pendingRunSequence: null,
      pendingScanCount: 0,
      lastOpenedToken: null,
    };
    activeChatTurnRunRef.current = null;
    pendingUsageSettlementsRef.current = filterPendingUsageSettlementsForSession(
      storedPendingUsageSettlementsRef.current,
      sessionKey,
      conversationId,
    );
    setPendingSettlementCount(0);
    clearArtifactAutoOpenTimers();
    clearUsageSettlementTimers();
    modelLoadVersionRef.current += 1;
    setResolvedModelSessionKey(null);
    setModelsLoading(true);
    setModelSwitching(false);
    setComposerDraft(null);
    setSessionBillingSummaries([]);
    queuedMessagesRef.current = [];
    queueDispatchInFlightRef.current = null;
    setQueuedMessages([]);
    setAssistantFooterVersion((current) => current + 1);
    sessionModelBootstrapKeyRef.current = null;
    responseUsageEnabledSessionKeyRef.current = null;
    setCreditEstimate({
      loading: false,
      low: null,
      high: null,
      error: null,
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
    });
    persistedChatSnapshotRef.current = null;
    forcedSnapshotRestoreScopeRef.current = null;
    artifactPreviewWorkspaceDirRef.current = null;
    artifactPreviewRequestSeqRef.current += 1;
    setArtifactPreview(null);
  }, [
    clearArtifactAutoOpenTimers,
    clearAutoRecoveryTimer,
    clearOverloadedGeneralSessionRotationTimer,
    clearUsageSettlementTimers,
    conversationId,
    sessionKey,
  ]);

  useLayoutEffect(() => {
    const app = appRef.current;
    if (!app) {
      return;
    }
    const snapshot = hydrateChatSnapshotForRender({
      appName,
      sessionKey,
      conversationId,
    });
    if (snapshot) {
      app.chatMessages = snapshot.messages ?? [];
    } else if (!sessionTransitionPendingRef.current) {
      app.chatMessages = [];
    }
    const mergedStoredSettlements = mergePendingUsageSettlementRecords(
      readStoredPendingUsageSettlements(appName),
      normalizePendingUsageSettlementRecords(snapshot?.pendingUsageSettlements),
    );
    storedPendingUsageSettlementsRef.current = mergedStoredSettlements;
    writeStoredPendingUsageSettlements(appName, mergedStoredSettlements);
    pendingUsageSettlementsRef.current = filterPendingUsageSettlementsForSession(
      mergedStoredSettlements,
      sessionKey,
      conversationId,
    );
    setGlobalPendingSettlementCount(mergedStoredSettlements.length);
    setPendingSettlementCount(pendingUsageSettlementsRef.current.length);
    persistedChatSnapshotRef.current = buildChatSessionSnapshotComparableValue(snapshot);
    if ((snapshot?.messages?.length ?? 0) > 0) {
      setOptimisticEmptySessionActive(false);
      setSessionHistoryState('has-history');
      setInitialSurfaceRestorePending(false);
    }
  }, [appName, conversationId, sessionKey]);

  useLayoutEffect(() => {
    const app = appRef.current;
    if (!app || !status.connected) {
      return;
    }
    if ((renderState.chatMessageCount ?? 0) > 0 || (renderState.groupCount ?? 0) > 0) {
      return;
    }

    const snapshot = readChatSessionSnapshot(appName, sessionKey, conversationId);
    if (!snapshotHasMeaningfulRenderableMessages(snapshot?.messages ?? [])) {
      return;
    }

    const restoreScope = `${buildChatScopeIdentity(sessionKey, conversationId)}:${snapshot?.savedAt ?? 0}`;
    if (forcedSnapshotRestoreScopeRef.current === restoreScope) {
      return;
    }

    app.chatMessages = snapshot?.messages ?? [];
    persistedChatSnapshotRef.current = buildChatSessionSnapshotComparableValue(snapshot);
    forcedSnapshotRestoreScopeRef.current = restoreScope;
    setOptimisticEmptySessionActive(false);
    setSessionHistoryState('has-history');
    setInitialSurfaceRestorePending(false);
    setAssistantFooterVersion((current) => current + 1);
  }, [
    appName,
    conversationId,
    renderState.chatMessageCount,
    renderState.groupCount,
    sessionKey,
    status.connected,
  ]);

  useEffect(() => {
    if (!creditClient || !creditToken) {
      setSessionBillingSummaries([]);
      return;
    }

    if (sessionBillingScopeKeys.length === 0) {
      setSessionBillingSummaries([]);
      return;
    }

    let cancelled = false;
    void Promise.all(
      sessionBillingScopeKeys.map((targetSessionKey) =>
        creditClient
          .listRunBillingSummariesBySession(creditToken, {
            sessionKey: targetSessionKey,
            limit: 200,
          })
          .catch(() => []),
      ),
    ).then((summaryLists) => {
      if (cancelled) {
        return;
      }
      const summaries = filterRunBillingSummariesBySessionKeys(
        summaryLists.flat().filter((summary): summary is RunBillingSummaryData => Boolean(summary)),
        sessionBillingScopeKeys,
      );
      setSessionBillingSummaries(mergeRunBillingSummaries([], summaries));
      setAssistantFooterVersion((current) => current + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [creditClient, creditToken, sessionBillingScopeKeySignature]);

  useEffect(() => {
    const prompt = composerDraft?.prompt?.trim() || '';
    const attachmentItems = composerDraft?.attachments || [];
    if (!creditClient || !creditToken || (!prompt && attachmentItems.length === 0)) {
      setCreditEstimate({
        loading: false,
        low: null,
        high: null,
        error: null,
        estimatedInputTokens: null,
        estimatedOutputTokens: null,
      });
      return;
    }

    let cancelled = false;
    setCreditEstimate((current) => ({
      loading: true,
      low: current.low,
      high: current.high,
      error: null,
      estimatedInputTokens: current.estimatedInputTokens,
      estimatedOutputTokens: current.estimatedOutputTokens,
    }));

    const timer = window.setTimeout(() => {
      void requestFreshCreditQuote(prompt, attachmentItems)
        .then((quote: CreditQuoteData) => {
          if (cancelled) {
            return;
          }
          setCreditEstimate({
            loading: false,
            low: quote.estimated_credits_low,
            high: quote.estimated_credits_high,
            error: null,
            estimatedInputTokens: quote.estimated_input_tokens,
            estimatedOutputTokens: quote.estimated_output_tokens,
          });
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          setCreditEstimate({
            loading: false,
            low: null,
            high: null,
            error: error instanceof Error ? error.message : 'estimate unavailable',
            estimatedInputTokens: null,
            estimatedOutputTokens: null,
          });
        });
    }, 360);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [composerDraft, creditClient, creditToken, requestFreshCreditQuote]);

  useEffect(() => {
    if (!creditClient || !creditToken) {
      setInstalledLobsterAgents([]);
      setSkillOptions([]);
      return;
    }

    let cancelled = false;
    const reloadComposerCatalogs = async () => {
      const [lobsterResult, skillResult] = await Promise.allSettled([
        loadLobsterAgents({
          client: creditClient,
          accessToken: creditToken,
        }),
        loadSkillStoreCatalog({
          client: creditClient,
          accessToken: creditToken,
        }),
      ]);

      if (cancelled) {
        return;
      }

      if (lobsterResult.status === 'fulfilled') {
        setInstalledLobsterAgents(
          lobsterResult.value
            .filter((agent) => agent.installed)
            .map((agent) => ({
              slug: agent.slug,
              name: agent.name,
              avatarSrc: agent.avatarSrc,
              installed: agent.installed,
              systemPrompt:
                readAgentMetadataString(agent.metadata, 'system_prompt') ||
                (isInvestmentExpertAgent(agent) ? agent.description : null),
            }))
            .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')),
        );
      } else {
        setInstalledLobsterAgents([]);
      }

      if (skillResult.status === 'fulfilled') {
        setSkillOptions(
          skillResult.value
            .filter((skill) => skill.enabled && (skill.installed || skill.userInstalled || skill.localInstalled))
            .map((skill) => ({
              slug: skill.slug,
              name: skill.name,
              market: skill.market,
              skillType: skill.skillType,
              categoryLabel: skill.categoryLabel,
            })),
        );
      } else {
        setSkillOptions([]);
      }
    };

    void reloadComposerCatalogs();
    const unsubscribeSkillStore = subscribeSkillStoreEvents(() => {
      void reloadComposerCatalogs();
    });
    const unsubscribeLobsterStore = subscribeLobsterStoreEvents(() => {
      void reloadComposerCatalogs();
    });

    return () => {
      cancelled = true;
      unsubscribeSkillStore();
      unsubscribeLobsterStore();
    };
  }, [creditClient, creditToken]);

  const maybeRotateOverloadedGeneralSession = useCallback(
    (pressure: ChatSessionPressureSnapshot, targetSessionKey: string) => {
      if (!pressure.overloaded || !pressure.hasPersistedHistory) {
        clearOverloadedGeneralSessionRotationTimer();
        if (overloadedGeneralSessionRef.current === targetSessionKey) {
          overloadedGeneralSessionRef.current = null;
        }
        return false;
      }
      if (!isGeneralChatSessionKey(targetSessionKey)) {
        return false;
      }
      if (overloadedGeneralSessionRef.current === targetSessionKey) {
        return false;
      }
      overloadedGeneralSessionRef.current = targetSessionKey;
      scheduleOverloadedGeneralSessionRotation(pressure, targetSessionKey);
      return true;
    },
    [clearOverloadedGeneralSessionRotationTimer, scheduleOverloadedGeneralSessionRotation],
  );

  useEffect(() => clearOverloadedGeneralSessionRotationTimer, [clearOverloadedGeneralSessionRotationTimer]);

  useEffect(() => {
    persistChatSessionSnapshot();
  }, [
    assistantFooterVersion,
    persistChatSessionSnapshot,
    renderState.chatMessageCount,
    renderState.groupCount,
    renderState.threadHeight,
    status.busy,
  ]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    clearOpenClawEmbeddedState(gatewayUrl);
    initialScrollScheduledRef.current = false;

    const app = document.createElement('openclaw-app') as OpenClawAppElement;
    const settings = buildSettings({ gatewayUrl, gatewayToken, sessionKey: effectiveGatewaySessionKey });

    app.applySettings(settings);
    app.password = gatewayPassword?.trim() ?? '';
    app.sessionKey = effectiveGatewaySessionKey;
    app.tab = 'chat';

    const snapshot = hydrateChatSnapshotForRender({
      appName,
      sessionKey,
      conversationId,
    });
    app.chatMessages = snapshot?.messages ?? [];
    persistedChatSnapshotRef.current = buildChatSessionSnapshotComparableValue(snapshot);
    if ((snapshot?.messages?.length ?? 0) > 0) {
      setSessionHistoryState('has-history');
      setInitialSurfaceRestorePending(false);
    }

    appRef.current = app;
    host.replaceChildren(app);

    return () => {
      if (appRef.current === app) {
        appRef.current = null;
      }
      host.replaceChildren();
    };
  }, [embeddedResetEpoch]);

  useEffect(() => {
    const app = appRef.current;
    if (!app) {
      return;
    }

    const runtimeSessionKey = effectiveGatewaySessionKey;
    const settings = buildSettings({ gatewayUrl, gatewayToken, sessionKey: runtimeSessionKey });
    app.applySettings(settings);
    app.password = gatewayPassword?.trim() ?? '';
    app.sessionKey = runtimeSessionKey;
    app.tab = 'chat';

    const reconnectKey = JSON.stringify({
      gatewayUrl,
      gatewayToken: gatewayToken?.trim() ?? '',
      gatewayPassword: gatewayPassword?.trim() ?? '',
    });
    if (reconnectKeyRef.current === null) {
      reconnectKeyRef.current = reconnectKey;
      initialScrollScheduledRef.current = false;
      app.connect();
      return;
    }
    if (reconnectKeyRef.current !== reconnectKey) {
      reconnectKeyRef.current = reconnectKey;
      initialScrollScheduledRef.current = false;
      app.connect();
    }
  }, [effectiveGatewaySessionKey, gatewayPassword, gatewayToken, gatewayUrl]);

  useEffect(() => {
    const app = appRef.current;
    const request = app?.client?.request;
    if (!app?.connected || typeof request !== 'function' || !selectedModelId || modelSwitching) {
      return;
    }
    if (resolvedModelSessionKey) {
      return;
    }

    const bootstrapKey = `${sessionKey}:${selectedModelId}`;
    if (sessionModelBootstrapKeyRef.current === bootstrapKey) {
      return;
    }
    sessionModelBootstrapKeyRef.current = bootstrapKey;

    let cancelled = false;
    const patchTargets = buildGatewaySessionPatchTargets(sessionKey, resolvedModelSessionKey);
    const kernelModel = resolveKernelModelSelection(selectedModelId);
    void Promise.all(
      patchTargets.map((key) =>
        request('sessions.patch', {
          key,
          model: kernelModel || selectedModelId,
        }),
      ),
    )
      .then(() => {
        if (cancelled) {
          return;
        }
        void refreshModelCatalog();
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        sessionModelBootstrapKeyRef.current = null;
        if (isModelNotAllowedError(error)) {
          setSelectedModelId(null);
          setResolvedModelSessionKey(null);
          void refreshModelCatalog();
        }
        console.warn('[desktop] failed to bootstrap model for fresh chat session', {
          sessionKey,
          model: selectedModelId,
          error,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [modelSwitching, refreshModelCatalog, resolveKernelModelSelection, resolvedModelSessionKey, selectedModelId, sessionKey, status.connected]);

  useEffect(() => {
    const app = appRef.current;
    const request = app?.client?.request;
    if (!app?.connected || typeof request !== 'function') {
      return;
    }
    if (responseUsageEnabledSessionKeyRef.current === effectiveGatewaySessionKey) {
      return;
    }

    let cancelled = false;
    let retryTimer: number | null = null;
    let attemptCount = 0;

    const enableResponseUsage = () => {
      if (cancelled) {
        return;
      }
      attemptCount += 1;

      const patchTargets = buildGatewaySessionPatchTargets(sessionKey, resolvedModelSessionKey);
      Promise.resolve()
        .then(() =>
          Promise.all(
            patchTargets.map((key) =>
              request('sessions.patch', {
                key,
                responseUsage: 'tokens',
              }),
            ),
          ),
        )
        .then(() => {
          if (cancelled) {
            return;
          }
          responseUsageEnabledSessionKeyRef.current = effectiveGatewaySessionKey;
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          const message =
            error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);
          const wsNotReady =
            message.includes("reading 'ws'") ||
            message.includes('Gateway websocket closed') ||
            message.includes('gateway connection closed');

          if (wsNotReady && attemptCount < 6) {
            retryTimer = window.setTimeout(() => {
              retryTimer = null;
              enableResponseUsage();
            }, 250);
            return;
          }

          console.warn('[desktop] failed to enable response usage footer for session', {
            sessionKey,
            error,
          });
        });
    };

    enableResponseUsage();

    return () => {
      cancelled = true;
      if (retryTimer != null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [effectiveGatewaySessionKey, resolvedModelSessionKey, sessionKey, status.connected]);

  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (!reason || typeof reason !== 'object') {
        return;
      }

      const detailCode =
        typeof (reason as { details?: { code?: unknown } }).details?.code === 'string'
          ? String((reason as { details?: { code?: unknown } }).details?.code)
          : null;
      const codeValue = (reason as { code?: unknown }).code;
      const messageValue = (reason as { message?: unknown }).message;
      const httpStatusValue = (reason as { httpStatus?: unknown }).httpStatus;
      const code =
        typeof codeValue === 'number' || typeof codeValue === 'string' ? String(codeValue) : null;
      const message =
        typeof messageValue === 'string' && messageValue.trim()
          ? messageValue
          : reason instanceof Error
            ? reason.message
            : 'Unhandled promise rejection';
      const httpStatus = typeof httpStatusValue === 'number' ? httpStatusValue : null;

      let raw: string | null = null;
      try {
        raw = JSON.stringify(reason);
      } catch {
        raw = String(reason);
      }

      const lowerMessage = message.toLowerCase();
      const lowerRaw = raw?.toLowerCase() ?? '';
      const compatibilityIssue =
        looksLikeOpenClawCompatibilityIssue(message) || looksLikeOpenClawCompatibilityIssue(raw);
      const looksRelevant =
        code === '403' ||
        detailCode !== null ||
        compatibilityIssue ||
        lowerMessage.includes('forbidden') ||
        lowerRaw.includes('openclaw') ||
        lowerRaw.includes('gateway') ||
        lowerRaw.includes('"code":403');

      if (!looksRelevant) {
        return;
      }

      console.error('[iclaw][openclaw-unhandled]', {
        message,
        code,
        detailCode,
        httpStatus,
        raw,
      });
      setUnhandledGatewayError({
        message,
        code,
        detailCode,
        httpStatus,
        raw,
      });
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const rewriteReferenceMarkers = () => {
      const textNodes = host.querySelectorAll('.chat-group.user .chat-text');
      textNodes.forEach((container) => {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        const pending: Text[] = [];
        while (walker.nextNode()) {
          const current = walker.currentNode;
          if (!(current instanceof Text)) {
            continue;
          }
          if (!current.nodeValue || !REFERENCE_MARKER_PATTERN.test(current.nodeValue)) {
            REFERENCE_MARKER_PATTERN.lastIndex = 0;
            continue;
          }
          REFERENCE_MARKER_PATTERN.lastIndex = 0;
          pending.push(current);
        }

        pending.forEach((node) => {
          const source = node.nodeValue ?? '';
          const fragment = document.createDocumentFragment();
          let lastIndex = 0;
          let match: RegExpExecArray | null = null;
          REFERENCE_MARKER_PATTERN.lastIndex = 0;

          while ((match = REFERENCE_MARKER_PATTERN.exec(source)) !== null) {
            const leading = source.slice(lastIndex, match.index);
            if (leading) {
              fragment.append(document.createTextNode(leading));
            }
            fragment.append(createReferenceChip(match[1].trim()));
            lastIndex = match.index + match[0].length;
          }

          const trailing = source.slice(lastIndex);
          if (trailing) {
            fragment.append(document.createTextNode(trailing));
          }
          node.parentNode?.replaceChild(fragment, node);
          REFERENCE_MARKER_PATTERN.lastIndex = 0;
        });
      });
    };

    const scheduleReferenceMarkerRewrite = createCoalescedDomTask(rewriteReferenceMarkers);
    const detachResumeListener = attachVisibilityResumeFlush(scheduleReferenceMarkerRewrite);

    rewriteReferenceMarkers();
    const observer = new MutationObserver(() => {
      scheduleReferenceMarkerRewrite.schedule();
    });
    observer.observe(host, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      detachResumeListener();
      scheduleReferenceMarkerRewrite.cancel();
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const decorateSemanticText = () => {
      if (status.busy) {
        return;
      }

      const containers = Array.from(host.querySelectorAll('.chat-group.assistant .chat-text')).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      );

      containers.forEach((container) => {
        applySemanticFormattingToContainer(container);
      });
    };

    const scheduleSemanticTextDecoration = createCoalescedDomTask(decorateSemanticText);
    const detachResumeListener = attachVisibilityResumeFlush(scheduleSemanticTextDecoration);

    decorateSemanticText();

    const observer = new MutationObserver(() => {
      scheduleSemanticTextDecoration.schedule();
    });

    observer.observe(host, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      detachResumeListener();
      scheduleSemanticTextDecoration.cancel();
    };
  }, [status.busy]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const decorateChatTables = () => {
      const tables = Array.from(
        host.querySelectorAll('.chat-group.assistant .chat-text table, .chat-group.tool .chat-text table, .chat-group.other .chat-text table'),
      ).filter((node): node is HTMLTableElement => node instanceof HTMLTableElement);

      tables.forEach((table) => {
        enhanceChatMarkdownTable(table);
      });
    };

    const scheduleTableDecoration = createCoalescedDomTask(decorateChatTables);

    decorateChatTables();

    const observer = new MutationObserver(() => {
      scheduleTableDecoration.schedule();
    });

    observer.observe(host, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const detachResumeListener = attachVisibilityResumeFlush(scheduleTableDecoration);

    window.addEventListener('resize', scheduleTableDecoration.schedule);

    return () => {
      observer.disconnect();
      scheduleTableDecoration.cancel();
      detachResumeListener();
      window.removeEventListener('resize', scheduleTableDecoration.schedule);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const scheduleArtifactAutoOpenScanTask = createCoalescedDomTask(() => {
      if (artifactAutoOpenStateRef.current.pendingRunSequence == null) {
        return;
      }
      queueArtifactAutoOpenScan(90);
    });
    const observer = new MutationObserver(() => {
      scheduleArtifactAutoOpenScanTask.schedule();
    });
    observer.observe(host, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      scheduleArtifactAutoOpenScanTask.cancel();
    };
  }, [queueArtifactAutoOpenScan]);

  useEffect(() => {
    const authRole = appRef.current?.hello?.auth?.role ?? null;
    const authScopes = appRef.current?.hello?.auth?.scopes ?? null;
    const snapshot = JSON.stringify({
      connected: status.connected,
      lastError: status.lastError,
      lastErrorCode: status.lastErrorCode,
      authRole,
      authScopes,
    });
    if (statusLogRef.current === snapshot) {
      return;
    }
    statusLogRef.current = snapshot;
    console.info('[iclaw][openclaw-status]', {
      connected: status.connected,
      lastError: status.lastError,
      lastErrorCode: status.lastErrorCode,
      authRole,
      authScopes,
    });
  }, [status.connected, status.lastError, status.lastErrorCode]);

  useEffect(() => {
    if (!lastRpcFailure) {
      return;
    }
    const snapshot = JSON.stringify(lastRpcFailure);
    if (rpcLogRef.current === snapshot) {
      return;
    }
    rpcLogRef.current = snapshot;
    console.warn('[iclaw][openclaw-last-rpc-failure]', lastRpcFailure);
  }, [lastRpcFailure]);

  useEffect(() => {
    if (!unhandledGatewayError) {
      return;
    }
    const snapshot = JSON.stringify(unhandledGatewayError);
    if (unhandledLogRef.current === snapshot) {
      return;
    }
    unhandledLogRef.current = snapshot;
    console.warn('[iclaw][openclaw-last-unhandled]', unhandledGatewayError);
  }, [unhandledGatewayError]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const assistantAvatarUrl = new URL(ASSISTANT_AVATAR_SRC, window.location.href).href;
    const userAvatarUrl =
      resolveUserAvatarUrl(user as AppUserAvatarSource) ||
      buildGeneratedUserAvatarDataUrl(user as AppUserAvatarSource, 'i');

    host.style.setProperty('--iclaw-assistant-avatar-image', `url("${assistantAvatarUrl}")`);
    host.dataset.hasUserAvatar = 'true';
    host.style.setProperty('--iclaw-user-avatar-image', `url("${userAvatarUrl}")`);
  }, [
    user?.avatar,
    user?.avatarUrl,
    user?.avatar_url,
    user?.display_name,
    user?.email,
    user?.name,
    user?.nickname,
    user?.username,
  ]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const updateComposerHeight = () => {
      const composer = shell.querySelector('.iclaw-composer') as HTMLElement | null;
      const composerHeight = composer?.getBoundingClientRect().height ?? 0;
      shell.style.setProperty('--iclaw-composer-height', `${Math.ceil(composerHeight)}px`);
    };

    const canElementConsumeWheel = (element: HTMLElement | null, deltaY: number): boolean => {
      if (!element || element.scrollHeight <= element.clientHeight + 1) {
        return false;
      }
      const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
      if (deltaY < 0) {
        return element.scrollTop > 0;
      }
      if (deltaY > 0) {
        return element.scrollTop < maxScrollTop;
      }
      return false;
    };

    const normalizeWheelDelta = (event: WheelEvent): number => {
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        return event.deltaY * 16;
      }
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        return event.deltaY * Math.max(240, shell.clientHeight * 0.85);
      }
      return event.deltaY;
    };

    let observedThread: HTMLElement | null = null;
    const refreshShellLayout = () => {
      updateComposerHeight();
      bindActiveThread();
    };
    const scheduleShellLayoutRefresh = createCoalescedDomTask(refreshShellLayout);
    const resizeObserver = new ResizeObserver(() => {
      scheduleShellLayoutRefresh.schedule();
    });
    const composer = shell.querySelector<HTMLElement>('.iclaw-composer');
    const handleThreadScroll = () => {
      syncScrollToBottomState(observedThread);
    };
    const bindActiveThread = () => {
      const nextThread = resolveActiveThread();
      if (observedThread === nextThread) {
        syncScrollToBottomState(nextThread);
        return;
      }
      if (observedThread) {
        resizeObserver.unobserve(observedThread);
        observedThread.removeEventListener('scroll', handleThreadScroll);
      }
      observedThread = nextThread;
      if (observedThread) {
        resizeObserver.observe(observedThread);
        observedThread.addEventListener('scroll', handleThreadScroll, {passive: true});
      }
      syncScrollToBottomState(observedThread);
    };
    const detachResumeListener = attachVisibilityResumeFlush(scheduleShellLayoutRefresh);
    if (composer) {
      resizeObserver.observe(composer);
    }
    refreshShellLayout();
    const mutationObserver = new MutationObserver(() => {
      scheduleShellLayoutRefresh.schedule();
    });
    mutationObserver.observe(shell, {childList: true, subtree: true});

    const handleShellWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      const deltaY = normalizeWheelDelta(event);
      if (
        target?.closest(
          '.iclaw-composer__mention-menu, .iclaw-composer__model-menu, .iclaw-composer__selector-menu, .iclaw-composer__floating-menu',
        )
      ) {
        return;
      }

      const editor = target?.closest('.iclaw-composer__editor') as HTMLElement | null;
      if (canElementConsumeWheel(editor, deltaY)) {
        return;
      }

      const innerScrollable = target?.closest(
        '.chat-tool-card__output, .chat-tool-card__preview, .chat-tool-card__inline, pre, code, table',
      ) as HTMLElement | null;
      if (canElementConsumeWheel(innerScrollable, deltaY)) {
        return;
      }

      const activeThread = resolveActiveThread();
      if (!activeThread || activeThread.scrollHeight <= activeThread.clientHeight) {
        return;
      }

      const maxScrollTop = activeThread.scrollHeight - activeThread.clientHeight;
      const nextScrollTop = Math.max(0, Math.min(maxScrollTop, activeThread.scrollTop + deltaY));
      if (Math.abs(nextScrollTop - activeThread.scrollTop) < 1) {
        return;
      }

      activeThread.scrollTop = nextScrollTop;
      syncScrollToBottomState(activeThread);
      event.preventDefault();
    };

    shell.addEventListener('wheel', handleShellWheel, {passive: false});
    window.addEventListener('resize', scheduleShellLayoutRefresh.schedule);

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      scheduleShellLayoutRefresh.cancel();
      detachResumeListener();
      if (observedThread) {
        observedThread.removeEventListener('scroll', handleThreadScroll);
      }
      shell.removeEventListener('wheel', handleShellWheel);
      window.removeEventListener('resize', scheduleShellLayoutRefresh.schedule);
    };
  }, [resolveActiveThread, status.connected, status.busy, syncScrollToBottomState]);

  useEffect(() => {
    const state = artifactAutoOpenStateRef.current;

    if (status.busy && !state.lastBusy) {
      state.runSequence += 1;
      state.pendingRunSequence = null;
      state.pendingScanCount = 0;
    } else if (!status.busy && state.lastBusy) {
      state.pendingRunSequence = state.runSequence;
      state.pendingScanCount = 0;
      clearArtifactAutoOpenTimers();
      [60, 220, 700, 1400].forEach((delay) => {
        const timer = window.setTimeout(() => {
          artifactAutoOpenStateRef.current.pendingScanCount += 1;
          tryAutoOpenArtifactCard();
        }, delay);
        artifactAutoOpenBurstTimersRef.current.push(timer);
      });
    }

    state.lastBusy = status.busy;
  }, [clearArtifactAutoOpenTimers, status.busy, tryAutoOpenArtifactCard]);

  useEffect(() => {
    const syncSurfaceState = () => {
      const app = appRef.current;
      const host = hostRef.current;
      const shell = shellRef.current;
      if (!app || !host || !shell) {
        return;
      }

      ensureWrappedClientRequest(app);
      const reconciledBusyState = reconcileGatewayChatBusyState(app, effectiveGatewaySessionKey);
      const responsePhase = deriveChatResponsePhase({
        busy: reconciledBusyState.busy,
        lastError: app.lastError ?? null,
        messages: Array.isArray(app.chatMessages) ? app.chatMessages : [],
        runId: typeof app.chatRunId === 'string' ? app.chatRunId : null,
        startedAt: app.chatStreamStartedAt,
      });

      const nextStatus: ChatSurfaceStatus = {
        busy: reconciledBusyState.busy,
        responsePhase,
        connected: Boolean(app.connected),
        lastError: app.lastError ?? null,
        lastErrorCode: app.lastErrorCode ?? null,
      };
      const nativeInput = shell.querySelector(
        '.iclaw-composer__editor, .iclaw-composer, .agent-chat__input, .chat-compose',
      );
      const thread = host.querySelector('.chat-thread');
      const nativeInputState = isVisibleElement(nativeInput);
      const threadState = isVisibleElement(thread);
      const nextRenderState: ChatSurfaceRenderState = {
        hostHeight: Math.round(host.getBoundingClientRect().height),
        hasNativeInput: Boolean(nativeInput),
        nativeInputVisible: nativeInputState.visible,
        nativeInputHeight: nativeInputState.height,
        hasThread: Boolean(thread),
        threadVisible: threadState.visible,
        threadHeight: threadState.height,
        groupCount: host.querySelectorAll('.chat-group').length,
        chatMessageCount: Array.isArray(app.chatMessages) ? app.chatMessages.length : 0,
      };
      setRenderState((current) =>
        current.hostHeight === nextRenderState.hostHeight &&
        current.hasNativeInput === nextRenderState.hasNativeInput &&
        current.nativeInputVisible === nextRenderState.nativeInputVisible &&
        current.nativeInputHeight === nextRenderState.nativeInputHeight &&
        current.hasThread === nextRenderState.hasThread &&
        current.threadVisible === nextRenderState.threadVisible &&
        current.threadHeight === nextRenderState.threadHeight &&
        current.groupCount === nextRenderState.groupCount &&
        current.chatMessageCount === nextRenderState.chatMessageCount
          ? current
          : nextRenderState,
      );
      if (nextStatus.connected) {
        clearConnectionLossTimer();
        setStatus((current) =>
          current.busy === nextStatus.busy &&
          current.responsePhase === nextStatus.responsePhase &&
          current.connected === true &&
          current.lastError === nextStatus.lastError &&
          current.lastErrorCode === nextStatus.lastErrorCode
            ? current
            : {
                busy: nextStatus.busy,
                responsePhase: nextStatus.responsePhase,
                connected: true,
                lastError: nextStatus.lastError,
                lastErrorCode: nextStatus.lastErrorCode,
              },
        );
        return;
      }

      pendingConnectionLossStatusRef.current = nextStatus;
      setStatus((current) =>
        current.busy === nextStatus.busy &&
        current.responsePhase === nextStatus.responsePhase &&
        current.lastError === (nextStatus.lastError ?? current.lastError) &&
        current.lastErrorCode === (nextStatus.lastErrorCode ?? current.lastErrorCode)
          ? current
          : {
              busy: nextStatus.busy,
              responsePhase: nextStatus.responsePhase,
              connected: current.connected,
              lastError: nextStatus.lastError ?? current.lastError,
              lastErrorCode: nextStatus.lastErrorCode ?? current.lastErrorCode,
            },
      );

      if (connectionLossTimerRef.current != null) {
        return;
      }
      connectionLossTimerRef.current = window.setTimeout(() => {
        connectionLossTimerRef.current = null;
        const pending = pendingConnectionLossStatusRef.current;
        setStatus((current) =>
          current.busy === pending.busy &&
          current.responsePhase === pending.responsePhase &&
          current.connected === false &&
          current.lastError === pending.lastError &&
          current.lastErrorCode === pending.lastErrorCode
            ? current
            : {
                busy: pending.busy,
                responsePhase: pending.responsePhase,
                connected: false,
                lastError: pending.lastError,
                lastErrorCode: pending.lastErrorCode,
              },
        );
      }, CONNECTION_LOSS_GRACE_MS);
    };

    syncSurfaceState();
    const timer = window.setInterval(syncSurfaceState, STATUS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      clearConnectionLossTimer();
    };
  }, [clearConnectionLossTimer, effectiveGatewaySessionKey, ensureWrappedClientRequest]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !status.connected || initialScrollScheduledRef.current) {
      return;
    }
    initialScrollScheduledRef.current = true;

    const delays = [0, 180, 700, 1500];
    const timers = delays.map((delay) =>
      window.setTimeout(() => {
        scrollChatToBottom({force: true, smooth: delay > 0});
      }, delay),
    );

    return () => {
      clearArtifactAutoOpenTimers();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [clearArtifactAutoOpenTimers, scrollChatToBottom, status.connected]);

  useEffect(() => {
    if (!shellAuthenticated) {
      setInitialSurfaceRestorePending(false);
      setSessionHistoryState('empty');
      return;
    }
    if (hasStoredChatSnapshotMessages(appName, sessionKey, conversationId)) {
      setInitialSurfaceRestorePending(false);
      setSessionHistoryState('has-history');
      return;
    }
    if (shouldTreatAsImmediateEmptySession(appName, sessionKey, conversationId)) {
      setInitialSurfaceRestorePending(false);
      setSessionHistoryState('empty');
      return;
    }
    setInitialSurfaceRestorePending(true);
    setSessionHistoryState('unknown');
  }, [appName, conversationId, sessionKey, shellAuthenticated]);

  useEffect(() => {
    if (!initialSurfaceRestorePending) {
      return;
    }

    const timer = window.setTimeout(() => {
      setInitialSurfaceRestorePending(false);
    }, INITIAL_SURFACE_BOOT_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [initialSurfaceRestorePending]);

  useEffect(() => {
    if (!initialSurfaceRestorePending) {
      return;
    }

    if (!shellAuthenticated || status.lastError || hasObservedHistory) {
      setInitialSurfaceRestorePending(false);
      return;
    }

    if (!status.connected || !isSessionRenderReady(renderState)) {
      return;
    }

    if (sessionHistoryState === 'unknown' || sessionHistoryState === 'has-history') {
      return;
    }

    const timer = window.setTimeout(() => {
      setInitialSurfaceRestorePending(false);
    }, INITIAL_EMPTY_SESSION_SETTLE_MS);

    return () => window.clearTimeout(timer);
  }, [
    hasObservedHistory,
    initialSurfaceRestorePending,
    renderState,
    sessionHistoryState,
    shellAuthenticated,
    status.connected,
    status.lastError,
  ]);

  useEffect(() => {
    if (hasBootSettled) {
      return;
    }
    if (!shellAuthenticated || initialSurfaceRestorePending || !status.connected || !isSessionRenderReady(renderState)) {
      return;
    }
    setHasBootSettled(true);
  }, [hasBootSettled, initialSurfaceRestorePending, renderState, shellAuthenticated, status.connected]);

  useEffect(() => {
    if (optimisticEmptySessionActive || !hasObservedHistory || sessionHistoryState === 'has-history') {
      return;
    }
    setSessionHistoryState('has-history');
  }, [hasObservedHistory, optimisticEmptySessionActive, sessionHistoryState]);

  useEffect(() => {
    if (!status.connected) {
      if (sessionTransitionPendingRef.current) {
        setModelsLoading(true);
      } else {
        modelLoadVersionRef.current += 1;
        setModelOptions([]);
        setSelectedModelId(null);
        setResolvedModelSessionKey(null);
        setModelsLoading(false);
      }
      setModelSwitching(false);
      return;
    }

    let disposed = false;
    let attempts = 0;
    const maxAttempts = 8;

    const syncModels = async () => {
      if (disposed) {
        return;
      }

      const loaded = await refreshModelCatalog();
      attempts += 1;
      if (!loaded && attempts < maxAttempts && !disposed) {
        window.setTimeout(() => {
          void syncModels();
        }, 420);
      }
    };

    void syncModels();

    return () => {
      disposed = true;
    };
  }, [refreshModelCatalog, status.connected]);

  useEffect(() => {
    if (!status.connected || status.lastError) {
      return;
    }
    if (lastRpcFailure) {
      setLastRpcFailure(null);
    }
    if (unhandledGatewayError) {
      setUnhandledGatewayError(null);
    }
  }, [lastRpcFailure, status.connected, status.lastError, unhandledGatewayError]);

  useEffect(() => {
    const canAttemptAutoRecovery =
      hasBootSettled && !initialSurfaceRestorePending && !sessionTransitionPendingRef.current;
    const transportIssue =
      !status.connected &&
      (
        looksLikeOpenClawTransportIssue(status.lastError) ||
        looksLikeOpenClawTransportIssue(lastRpcFailure?.message) ||
        looksLikeOpenClawTransportIssue(unhandledGatewayError?.message) ||
        looksLikeOpenClawTransportIssue(unhandledGatewayError?.raw)
      );

    if (!canAttemptAutoRecovery || !transportIssue) {
      clearAutoRecoveryTimer();
      autoRecoveryAttemptsRef.current = 0;
      return;
    }

    scheduleAutoRecoveryReconnect('transport-recover');
  }, [
    clearAutoRecoveryTimer,
    hasBootSettled,
    initialSurfaceRestorePending,
    lastRpcFailure?.message,
    scheduleAutoRecoveryReconnect,
    status.connected,
    status.lastError,
    unhandledGatewayError?.message,
    unhandledGatewayError?.raw,
  ]);

  useEffect(() => {
    const compatibilityIssue =
      looksLikeOpenClawCompatibilityIssue(status.lastError) ||
      looksLikeOpenClawCompatibilityIssue(lastRpcFailure?.message) ||
      looksLikeOpenClawCompatibilityIssue(unhandledGatewayError?.message) ||
      looksLikeOpenClawCompatibilityIssue(unhandledGatewayError?.raw);
    if (!compatibilityIssue) {
      compatibilityRecoveryAttemptsRef.current = 0;
      return;
    }

    scheduleSelfHealingRecovery('compatibility', 'protocol-compatibility', 180);
  }, [
    lastRpcFailure?.message,
    scheduleSelfHealingRecovery,
    status.lastError,
    unhandledGatewayError?.message,
    unhandledGatewayError?.raw,
  ]);

  useEffect(() => clearAutoRecoveryTimer, [clearAutoRecoveryTimer]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const handleContextMenu = (event: MouseEvent) => {
      const selected = resolveChatSelection();
      if (!selected) {
        closeSelectionMenu();
        return;
      }

      event.preventDefault();
      setSelectionMenu({
        x: Math.max(
          CHAT_SELECTION_MENU_GAP,
          Math.min(event.clientX, window.innerWidth - CHAT_SELECTION_MENU_WIDTH - CHAT_SELECTION_MENU_GAP),
        ),
        y: Math.max(
          CHAT_SELECTION_MENU_GAP,
          Math.min(event.clientY, window.innerHeight - CHAT_SELECTION_MENU_HEIGHT - CHAT_SELECTION_MENU_GAP),
        ),
        text: selected.text,
        label: selected.label,
      });
    };

    host.addEventListener('contextmenu', handleContextMenu);
    return () => host.removeEventListener('contextmenu', handleContextMenu);
  }, [closeSelectionMenu, resolveChatSelection]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const handleCardClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const card = target?.closest('.chat-tool-card--clickable') as HTMLElement | null;
      if (!card || !host.contains(card)) {
        return;
      }

      if (card.dataset.iclawToolCard === 'artifact') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void openArtifactPreviewFromCard(card);
        return;
      }

      if (artifactPreview) {
        closeArtifactPreview();
      }
    };

    host.addEventListener('click', handleCardClickCapture, true);
    return () => host.removeEventListener('click', handleCardClickCapture, true);
  }, [artifactPreview, closeArtifactPreview, openArtifactPreviewFromCard]);

  useEffect(() => {
    if (!selectionMenu) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (selectionMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      closeSelectionMenu();
    };

    const handleSelectionChange = () => {
      if (!resolveChatSelection()) {
        closeSelectionMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSelectionMenu();
      }
    };

    const handleViewportChange = () => {
      closeSelectionMenu();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('blur', handleViewportChange);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('blur', handleViewportChange);
    };
  }, [closeSelectionMenu, resolveChatSelection, selectionMenu]);

  const hasGatewayAuth = Boolean((gatewayToken ?? '').trim() || (gatewayPassword ?? '').trim());
  const connectionMessage = status.lastError
    ? status.lastError
    : hasGatewayAuth
      ? '正在连接 OpenClaw 网关…'
      : '缺少本地网关凭据，当前无法连接 OpenClaw。';
  const hasStableVisibleChat =
    hasLocalStoredSnapshotMessages || hasObservedHistory || renderState.groupCount > 0 || renderState.chatMessageCount > 0;
  const hasStableVisibleInput = renderState.hasNativeInput && renderState.nativeInputVisible;
  const renderReady = isSessionRenderReady(renderState);
  const localSendBlockedReason =
    modelSwitching
      ? '正在切换模型，请稍后发送。'
      : modelsLoading
        ? '正在准备对话模型，请稍后发送。'
        : null;
  const effectiveSendBlockedReason = sendBlockedReason || localSendBlockedReason;
  const lifecycle = deriveOpenClawChatSurfaceLifecycle({
    optimisticEmptySessionActive,
    statusConnected: status.connected,
    statusLastError: status.lastError,
    surfaceVisible,
    surfaceReactivating,
    sessionTransitionVisible,
    initialSurfaceRestorePending,
    hasBootSettled,
    shellAuthenticated,
    sessionHistoryState,
    hasObservedHistory,
    hasStableVisibleInput,
    hasStableVisibleChat,
    renderReady,
    compatibilityRecoveryActive,
    sendBlockedReason: effectiveSendBlockedReason,
  });
  const {
    allowImmediateEmptySessionUi,
    showBootMask,
    showSessionTransitionMask,
    showSurfaceReactivationMask,
    shellTransitioning,
    surfaceReadyForReveal,
    shouldForceSurfaceReveal,
    allowDisconnectedComposerQueue,
  } = lifecycle;
  const secureContextHint =
    typeof window !== 'undefined' && !window.isSecureContext
      ? '当前页面不是安全上下文，OpenClaw 可能会拒绝设备身份校验。'
      : null;
  const authRole = appRef.current?.hello?.auth?.role ?? null;
  const authScopes = appRef.current?.hello?.auth?.scopes ?? null;
  const showRechargeCtaCard = status.connected && Boolean(creditBlockNotice) && !rechargeNoticeDismissed;

  useEffect(() => {
    const shouldShow = lifecycle.shouldShowConnectionCard;

    if (!shouldShow) {
      setShowConnectionCard(false);
      return;
    }

    if (status.lastError) {
      setShowConnectionCard(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowConnectionCard(true);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [
    lifecycle.shouldShowConnectionCard,
    status.lastError,
  ]);

  useEffect(() => {
    if (!lifecycle.shouldShowRenderDiagnostics) {
      setShowRenderDiagnosticsCard(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowRenderDiagnosticsCard(true);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    lifecycle.shouldShowRenderDiagnostics,
  ]);

  useEffect(() => {
    if (!sessionTransitionPendingRef.current) {
      return;
    }

    const ready =
      status.connected &&
      !modelSwitching &&
      isSessionRenderReady(renderState);

    if (!ready) {
      return;
    }

    const elapsed = performance.now() - sessionTransitionStartedAtRef.current;
    const remaining = Math.max(0, SESSION_TRANSITION_MIN_DURATION_MS - elapsed);

    clearSessionTransitionTimer();
    sessionTransitionHideTimerRef.current = window.setTimeout(() => {
      sessionTransitionPendingRef.current = false;
      sessionTransitionHideTimerRef.current = null;
      setSessionTransitionVisible(false);
    }, remaining);

    return clearSessionTransitionTimer;
  }, [
    clearSessionTransitionTimer,
    modelSwitching,
    modelsLoading,
    renderState,
    status.connected,
  ]);

  useEffect(() => clearSessionTransitionTimer, [clearSessionTransitionTimer]);

  useEffect(() => {
    const renderStuck =
      shellAuthenticated &&
      status.connected &&
      !status.lastError &&
      !renderReady &&
      !showSurfaceReactivationMask &&
      !showSessionTransitionMask &&
      !lifecycle.bootStillSettling &&
      !allowImmediateEmptySessionUi &&
      !hasStableVisibleChat;

    if (!renderStuck) {
      renderRecoveryAttemptsRef.current = 0;
      return;
    }

    scheduleSelfHealingRecovery('render-stuck', 'render-stuck-after-connect', 260);
  }, [
    allowImmediateEmptySessionUi,
    hasStableVisibleChat,
    lifecycle.bootStillSettling,
    renderReady,
    scheduleSelfHealingRecovery,
    showSessionTransitionMask,
    shellAuthenticated,
    status.connected,
    status.lastError,
    showSurfaceReactivationMask,
  ]);

  useEffect(() => {
    if (!creditBlockNotice) {
      setRechargeNoticeDismissed(false);
    }
  }, [creditBlockNotice]);

  useEffect(() => {
    if (!compatibilityRecoveryActive || !status.connected || status.lastError || !renderReady) {
      return;
    }
    setCompatibilityRecoveryActive(false);
    compatibilityRecoveryAttemptsRef.current = 0;
    renderRecoveryAttemptsRef.current = 0;
  }, [compatibilityRecoveryActive, renderReady, status.connected, status.lastError]);

  useEffect(() => {
    if (surfaceReadyForReveal) {
      hasActivatedStableSurfaceRef.current = true;
    }
  }, [surfaceReadyForReveal]);

  useEffect(() => {
    if (!runtimeStateKey) {
      return;
    }
    onRuntimeStateChange?.(runtimeStateKey, {ready: surfaceReadyForReveal});
  }, [onRuntimeStateChange, runtimeStateKey, surfaceReadyForReveal]);

  useEffect(() => {
    const wasVisible = previousSurfaceVisibleRef.current;
    previousSurfaceVisibleRef.current = surfaceVisible;
    if (!surfaceVisible || wasVisible || !hasActivatedStableSurfaceRef.current) {
      return;
    }
    if (surfaceReactivationTimerRef.current != null) {
      window.clearTimeout(surfaceReactivationTimerRef.current);
      surfaceReactivationTimerRef.current = null;
    }
    setSurfaceReactivating(true);
  }, [surfaceVisible]);

  useEffect(() => {
    if (!surfaceReactivating) {
      return;
    }
    if (!surfaceReadyForReveal) {
      return;
    }
    if (surfaceReactivationTimerRef.current != null) {
      window.clearTimeout(surfaceReactivationTimerRef.current);
    }
    surfaceReactivationTimerRef.current = window.setTimeout(() => {
      surfaceReactivationTimerRef.current = null;
      setSurfaceReactivating(false);
    }, 120);
    return () => {
      if (surfaceReactivationTimerRef.current != null) {
        window.clearTimeout(surfaceReactivationTimerRef.current);
        surfaceReactivationTimerRef.current = null;
      }
    };
  }, [surfaceReadyForReveal, surfaceReactivating]);

  useEffect(
    () => () => {
      if (surfaceReactivationTimerRef.current != null) {
        window.clearTimeout(surfaceReactivationTimerRef.current);
        surfaceReactivationTimerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    window.__ICLAW_OPENCLAW_DIAGNOSTICS__ = {
      connected: status.connected,
      lastError: status.lastError,
      lastErrorCode: status.lastErrorCode,
      selectedModelId,
      effectiveGatewaySessionKey,
      resolvedModelSessionKey,
      modelOptions: modelOptions.map((option) => option.id),
      modelsLoading,
      modelSwitching,
      compatibilityRecoveryActive,
      compatibilityRecoveryAttempts: compatibilityRecoveryAttemptsRef.current,
      renderRecoveryAttempts: renderRecoveryAttemptsRef.current,
      transportRecoveryAttempts: autoRecoveryAttemptsRef.current,
      pendingSettlementCount,
      sessionBillingSummaries: sessionBillingSummaries.map((summary) => ({
        grantId: summary.grant_id,
        eventId: summary.event_id,
        sessionKey: summary.session_key,
        creditCost: summary.credit_cost,
        settledAt: summary.settled_at,
      })),
      pendingUsageSettlements: pendingUsageSettlementsRef.current.map((pending) => ({
        runId: pending.runId,
        grantId: pending.grantId,
        sessionKey: pending.sessionKey,
        startedAt: pending.startedAt,
        expiresAt: pending.expiresAt,
        baselineInputTokens: pending.baselineInputTokens,
        baselineOutputTokens: pending.baselineOutputTokens,
        attempts: pending.attempts,
        terminalState: pending.terminalState,
      })),
      usageSettlementTimerCount: usageSettlementTimersRef.current.length,
      usageSettlementAttemptSequence: usageSettlementAttemptSequenceRef.current,
      usageSettlementDiagnostics: usageSettlementDiagnosticsRef.current,
      renderState,
      unhandledGatewayError,
      lastRpcFailure,
      authRole,
      authScopes,
      gatewayUrl,
      hasGatewayAuth,
      shellAuthenticated,
    };
  }, [
    authRole,
    authScopes,
    gatewayUrl,
    hasGatewayAuth,
    lastRpcFailure,
    modelOptions,
    modelsLoading,
    modelSwitching,
    compatibilityRecoveryActive,
    pendingSettlementCount,
    renderState,
    resolvedModelSessionKey,
    selectedModelId,
    sessionBillingSummaries,
    effectiveGatewaySessionKey,
    shellAuthenticated,
    status.connected,
    status.lastError,
    status.lastErrorCode,
    unhandledGatewayError,
  ]);

  const renderDiagnosticsMessage = (() => {
    if (compatibilityRecoveryActive) {
      return '已自动切换到兼容恢复模式。输入区会先恢复可用，聊天内核会在后台继续自动重建。';
    }
    if (unhandledGatewayError?.code === '403') {
      return '当前页面捕获到了未处理的 403。更像是 OpenClaw 某个初始化或刷新请求被 gateway 拒绝，不是纯样式白板。';
    }
    if (renderState.hasThread && !renderState.threadVisible) {
      return 'OpenClaw 已连接，聊天线程节点已挂载，但在当前页面中不可见。更像是容器尺寸或样式兼容问题。';
    }
    if (renderState.hasThread || renderState.groupCount > 0) {
      return 'OpenClaw 已连接，但聊天线程没有进入稳定可见态。更像是前端可见性或布局兼容问题，不是账户登录失败。';
    }
    return 'OpenClaw 已连接，但聊天线程和输入区都没有渲染出来。更像是当前浏览器实例中的嵌入层兼容问题。';
  })();

  const finalizeChatTurnRun = useCallback(() => {
    const activeRun = activeChatTurnRunRef.current;
    if (!activeRun) {
      return;
    }

    const artifacts = collectLatestArtifactKinds(hostRef.current);
    if (activeRun.failureMessage) {
      markChatTurnFailed({
        id: activeRun.turnId,
        artifacts,
        error: activeRun.failureMessage,
      });
    } else {
      markChatTurnCompleted({
        id: activeRun.turnId,
        artifacts,
      });
    }

    activeChatTurnRunRef.current = null;
  }, []);

  const attemptPendingUsageSettlement = useCallback(async (): Promise<boolean> => {
    const app = appRef.current;
    const pendings = storedPendingUsageSettlementsRef.current;
    if (pendings.length === 0 || !creditClient || !creditToken) {
      return false;
    }

    const remaining: PendingUsageSettlement[] = [];
    let settledAny = false;
    let shouldRefreshBalance = false;
    let shouldRefreshFooter = false;

    const pushSettlementDiagnostic = (
      pending: PendingUsageSettlement,
      input: {
        terminalEvent?: TerminalChatEventMatch | null;
        usage?: AssistantUsageSettlement | null;
        sessionTokens?: { inputTokens: number; outputTokens: number } | null;
        action: UsageSettlementAttemptDiagnostic['action'];
        detail?: string | null;
      },
    ) => {
      const sequence = usageSettlementAttemptSequenceRef.current + 1;
      usageSettlementAttemptSequenceRef.current = sequence;
      usageSettlementDiagnosticsRef.current = [
        {
          sequence,
          runId: pending.runId,
          sessionKey: pending.sessionKey,
          terminalState: pending.terminalState,
          matchedTerminalSessionKey: input.terminalEvent?.sessionKey ?? null,
          matchedTerminalState: input.terminalEvent?.state ?? null,
          baselineInputTokens: pending.baselineInputTokens ?? null,
          baselineOutputTokens: pending.baselineOutputTokens ?? null,
          sessionInputTokens: input.sessionTokens?.inputTokens ?? null,
          sessionOutputTokens: input.sessionTokens?.outputTokens ?? null,
          derivedUsage: input.usage ?? null,
          action: input.action,
          detail: input.detail ?? null,
        },
        ...usageSettlementDiagnosticsRef.current,
      ].slice(0, 16);
    };

    for (const pending of pendings) {
      const isActivePending =
        pending.sessionKey === canonicalizeChatSessionKey(sessionKey) &&
        (!pending.conversationId || !conversationId || pending.conversationId === conversationId);
      const sessionSnapshot = !isActivePending
        ? readChatSessionSnapshot(appName, pending.sessionKey, pending.conversationId)
        : null;
      const sourceMessages =
        (isActivePending ? (Array.isArray(app?.chatMessages) ? app.chatMessages : []) : sessionSnapshot?.messages) ?? [];
      const terminalEvent =
        isActivePending && app
          ? findTerminalChatEventForRun(app, pending.sessionKey, pending.runId) ||
            findLatestTerminalChatEventSince(app, pending.sessionKey, pending.startedAt)
          : null;
      if (terminalEvent) {
        pending.terminalState = terminalEvent.state;
      }
      pushSettlementDiagnostic(pending, {
        action: 'start',
        terminalEvent,
      });

      const tryLoadBillingSummary = async (): Promise<boolean> => {
        try {
          const billingSummary = await creditClient.getRunBillingSummary(creditToken, pending.grantId);
          if (isActivePending && app) {
            annotateAssistantGroup(app.chatMessages, pending.runId, pending.startedAt, {
              billingSummary,
              billingState: 'charged',
            });
            mergeSessionBillingSummary(billingSummary);
          }
          settledAny = true;
          shouldRefreshBalance = true;
          shouldRefreshFooter = shouldRefreshFooter || isActivePending;
          pushSettlementDiagnostic(pending, {
            action: 'loaded-summary',
            terminalEvent,
            detail: 'resolved from existing billing summary',
          });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!/not found/i.test(message)) {
            console.warn('[desktop] failed to load run billing summary', {
              runId: pending.runId,
              grantId: pending.grantId,
              error,
            });
          }
          return false;
        }
      };

      if (pending.terminalState !== 'pending') {
        const resolvedFromSummary = await tryLoadBillingSummary();
        if (resolvedFromSummary) {
          continue;
        }
      }

      const directUsage = derivePendingSettlementUsage(sourceMessages, pending, terminalEvent?.message);
      let sessionTokens: { inputTokens: number; outputTokens: number } | null = null;
      if (!directUsage && app) {
        try {
          sessionTokens = await loadGatewaySessionTokenSnapshot(app, pending.sessionKey);
          if (sessionTokens && pending.sessionKey === sessionKey) {
            maybeRotateOverloadedGeneralSession(
              buildChatSessionPressureSnapshot({
                inputTokens: sessionTokens.inputTokens,
                outputTokens: sessionTokens.outputTokens,
                hasPersistedHistory: true,
              }),
              pending.sessionKey,
            );
          }
        } catch (error) {
          console.warn('[desktop] failed to load gateway session token snapshot', {
            runId: pending.runId,
            sessionKey: pending.sessionKey,
            error,
          });
        }
      }
      const usage =
        directUsage ||
        ((pending.terminalState === 'final' || pending.terminalState === 'aborted')
          ? derivePendingSettlementUsageFromSessionSnapshot(sourceMessages, pending, sessionTokens)
          : null);

      const settleUsage = async (
        settledUsage: AssistantUsageSettlement,
        action: 'reported' | 'reported-zero',
        detail: string,
      ): Promise<boolean> => {
        try {
          const result = await creditClient.reportUsageEvent({
            token: creditToken,
            eventId: pending.runId,
            grantId: pending.grantId,
            inputTokens: settledUsage.inputTokens,
            outputTokens: settledUsage.outputTokens,
            model: settledUsage.model || pending.model || undefined,
            appName,
            assistantTimestamp: settledUsage.timestamp,
          });
          if (isActivePending && app) {
            annotateAssistantGroup(app.chatMessages, pending.runId, pending.startedAt, {
              billingSummary: result.billing_summary,
              billingState: 'charged',
            });
            mergeSessionBillingSummary(result.billing_summary);
          }
          settledAny = true;
          shouldRefreshBalance = true;
          shouldRefreshFooter = shouldRefreshFooter || isActivePending;
          pushSettlementDiagnostic(pending, {
            action,
            terminalEvent,
            sessionTokens,
            usage: settledUsage,
            detail,
          });
          return true;
        } catch (error) {
          pending.attempts += 1;
          console.error('[desktop] failed to report usage event', {
            runId: pending.runId,
            grantId: pending.grantId,
            error,
          });
          pushSettlementDiagnostic(pending, {
            action: 'report-failed',
            terminalEvent,
            sessionTokens,
            usage: settledUsage,
            detail: error instanceof Error ? error.message : String(error),
          });
          if (await tryLoadBillingSummary()) {
            pushSettlementDiagnostic(pending, {
              action: 'report-failed-loaded-summary',
              terminalEvent,
              sessionTokens,
              usage: settledUsage,
              detail: 'report failed but billing summary was already persisted',
            });
            return true;
          }
          return false;
        }
      };

      if (!usage) {
        pending.attempts += 1;
        if (pending.terminalState === 'error') {
          console.warn('[desktop] skip credit settlement because run ended with error', pending);
          if (isActivePending && app) {
            annotateAssistantGroup(app.chatMessages, pending.runId, pending.startedAt, {
              billingState: 'missing',
            });
            shouldRefreshFooter = true;
          }
          pushSettlementDiagnostic(pending, {
            action: 'usage-missing-terminal-error',
            terminalEvent,
            sessionTokens,
            detail: 'terminal state is error and no usage could be derived',
          });
          continue;
        }
        if (
          pending.terminalState !== 'pending' &&
          Date.now() - pending.startedAt >= USAGE_SETTLEMENT_TERMINAL_GRACE_MS
        ) {
          if (pending.terminalState === 'aborted') {
            const zeroUsage: AssistantUsageSettlement = {
              inputTokens: 0,
              outputTokens: 0,
              model: pending.model || null,
              timestamp: terminalEvent?.ts ?? pending.startedAt,
            };
            if (
              await settleUsage(
                zeroUsage,
                'reported-zero',
                'aborted run settled at zero after usage fallback exhausted',
              )
            ) {
              continue;
            }
            if (Date.now() < pending.expiresAt) {
              remaining.push(pending);
              continue;
            }
          }
          if (isActivePending && app) {
            annotateAssistantGroup(app.chatMessages, pending.runId, pending.startedAt, {
              billingState: 'missing',
            });
            shouldRefreshFooter = true;
          }
          pushSettlementDiagnostic(pending, {
            action: 'usage-missing-terminal-timeout',
            terminalEvent,
            sessionTokens,
            detail: 'terminal grace elapsed without usage',
          });
          continue;
        }
        if (Date.now() >= pending.expiresAt) {
          if (pending.terminalState === 'aborted') {
            const zeroUsage: AssistantUsageSettlement = {
              inputTokens: 0,
              outputTokens: 0,
              model: pending.model || null,
              timestamp: terminalEvent?.ts ?? pending.startedAt,
            };
            if (
              await settleUsage(
                zeroUsage,
                'reported-zero',
                'aborted run settled at zero after settlement expiry fallback',
              )
            ) {
              continue;
            }
          }
          console.warn('[desktop] mark billing as missing because assistant usage was not found before expiry', pending);
          if (isActivePending && app) {
            annotateAssistantGroup(app.chatMessages, pending.runId, pending.startedAt, {
              billingState: 'missing',
            });
            shouldRefreshFooter = true;
          }
          pushSettlementDiagnostic(pending, {
            action: 'usage-missing-expired',
            terminalEvent,
            sessionTokens,
            detail: 'usage settlement expired',
          });
          continue;
        }
        pushSettlementDiagnostic(pending, {
          action: 'usage-missing',
          terminalEvent,
          sessionTokens,
          detail: 'usage could not be derived yet',
        });
        remaining.push(pending);
        continue;
      }

      if (
        await settleUsage(
          usage,
          'reported',
          directUsage
            ? 'usage event reported successfully'
            : 'usage event reported from gateway session token snapshot delta',
        )
      ) {
        continue;
      }
      if (Date.now() >= pending.expiresAt) {
        if (isActivePending && app) {
          annotateAssistantGroup(app.chatMessages, pending.runId, pending.startedAt, {
            billingState: 'missing',
          });
          shouldRefreshFooter = true;
        }
        continue;
      }
      remaining.push(pending);
    }

    replacePendingUsageSettlements(remaining);
    if (remaining.length === 0) {
      clearUsageSettlementTimers();
    }
    if (shouldRefreshFooter) {
      setAssistantFooterVersion((current) => current + 1);
    }
    if (shouldRefreshBalance) {
      await onCreditBalanceRefresh?.();
    }
    return settledAny;
  }, [
    appName,
    clearUsageSettlementTimers,
    creditClient,
    creditToken,
    maybeRotateOverloadedGeneralSession,
    mergeSessionBillingSummary,
    onCreditBalanceRefresh,
    replacePendingUsageSettlements,
    conversationId,
    effectiveGatewaySessionKey,
    sessionKey,
  ]);

  const scheduleUsageSettlementAttempt = useCallback(
    (delay = 0) => {
      clearUsageSettlementTimers();
      if (storedPendingUsageSettlementsRef.current.length === 0) {
        return;
      }

      const timer = window.setTimeout(async () => {
        usageSettlementTimersRef.current = usageSettlementTimersRef.current.filter((value) => value !== timer);

        if (storedPendingUsageSettlementsRef.current.length === 0) {
          return;
        }

        if (busyRef.current) {
          scheduleUsageSettlementAttempt(USAGE_SETTLEMENT_RETRY_INTERVAL_MS);
          return;
        }

        await attemptPendingUsageSettlement();
        if (storedPendingUsageSettlementsRef.current.length > 0) {
          scheduleUsageSettlementAttempt(USAGE_SETTLEMENT_RETRY_INTERVAL_MS);
        }
      }, Math.max(0, delay));

      usageSettlementTimersRef.current = [timer];
    },
    [attemptPendingUsageSettlement, clearUsageSettlementTimers],
  );

  useEffect(() => {
    if (status.busy || !activeChatTurnRunRef.current) {
      return;
    }

    finalizeChatTurnRun();
  }, [finalizeChatTurnRun, status.busy]);

  useEffect(() => {
    if (status.busy) {
      return;
    }

    const app = appRef.current;
    if (!app) {
      return;
    }

    if (!syncScrollToBottomState()) {
      return;
    }

    const timer = window.setTimeout(() => {
      scrollChatToBottom({smooth: true});
    }, 40);

    return () => {
      window.clearTimeout(timer);
    };
  }, [assistantFooterVersion, pendingSettlementCount, scrollChatToBottom, status.busy, syncScrollToBottomState]);

  useEffect(() => {
    if (globalPendingSettlementCount === 0) {
      clearUsageSettlementTimers();
      return;
    }

    scheduleUsageSettlementAttempt(0);
  }, [clearUsageSettlementTimers, globalPendingSettlementCount, scheduleUsageSettlementAttempt]);

  useEffect(() => {
    if (status.busy || globalPendingSettlementCount === 0) {
      return;
    }

    scheduleUsageSettlementAttempt(0);
  }, [globalPendingSettlementCount, scheduleUsageSettlementAttempt, status.busy]);

  useEffect(() => clearUsageSettlementTimers, [clearUsageSettlementTimers]);

  useEffect(() => {
    const activeRun = activeChatTurnRunRef.current;
    if (!status.busy || !activeRun || !status.lastError) {
      return;
    }

    if (status.lastError !== activeRun.baselineError) {
      activeRun.failureMessage = status.lastError;
    }
  }, [status.busy, status.lastError]);

  useEffect(() => {
    if (status.connected && !shellTransitioning) {
      return;
    }
    shellDragDepthRef.current = 0;
    setShellDropActive(false);
    setShellDropSummary(null);
  }, [shellTransitioning, status.connected]);

  const resetShellDropState = useCallback(() => {
    shellDragDepthRef.current = 0;
    setShellDropActive(false);
    setShellDropSummary(null);
  }, []);

  const handleShellDragEnter = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!status.connected || shellTransitioning || !hasDraggedFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    shellDragDepthRef.current += 1;
    setShellDropActive(true);
    setShellDropSummary(summarizeDraggedFiles(event.dataTransfer));
  }, [shellTransitioning, status.connected]);

  const handleShellDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!status.connected || shellTransitioning || !hasDraggedFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!shellDropActive) {
      setShellDropActive(true);
    }
    setShellDropSummary(summarizeDraggedFiles(event.dataTransfer));
  }, [shellDropActive, shellTransitioning, status.connected]);

  const handleShellDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    shellDragDepthRef.current = Math.max(0, shellDragDepthRef.current - 1);
    if (shellDragDepthRef.current === 0) {
      setShellDropActive(false);
      setShellDropSummary(null);
    }
  }, []);

  const handleShellDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!status.connected || shellTransitioning || !hasDraggedFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files ?? []);
    resetShellDropState();
    if (files.length === 0) {
      return;
    }
    void composerRef.current?.addFiles(files);
  }, [resetShellDropState, shellTransitioning, status.connected]);

  const loadRelevantMemoryMatches = useCallback(async (prompt: string) => {
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length < 2) {
      return [];
    }

    try {
      const snapshot = await loadMemorySnapshot();
      if (!snapshot) {
        return [];
      }

      const activeEntries = snapshot.entries.filter(
        (entry): entry is MemoryEntryRecord => Boolean(entry && entry.active),
      );
      return pickRelevantMemories(activeEntries, trimmedPrompt, 3);
    } catch {
      return [];
    }
  }, []);

  const noteMemoryUsage = useCallback(async (entryIds: string[]) => {
    if (entryIds.length === 0) {
      return;
    }

    try {
      const snapshot = await loadMemorySnapshot();
      if (!snapshot) {
        return;
      }

      const stamp = createMemoryUsageTimestamp();
      const idSet = new Set(entryIds);
      const targets = snapshot.entries.filter((entry) => entry.active && idSet.has(entry.id)).slice(0, 6);

      await Promise.all(
        targets.map((entry) =>
          saveMemoryEntry({
            ...entry,
            lastRecalledAt: stamp,
            recallCount: (entry.recallCount ?? 0) + 1,
          }),
        ),
      );
    } catch {
      // Keep chat sending non-blocking even if memory bookkeeping fails.
    }
  }, []);

  const dropSummary = shellDropSummary ?? {
    totalFiles: 0,
    supportedFiles: 0,
    imageCount: 0,
    pdfCount: 0,
    videoCount: 0,
    unsupportedCount: 0,
  };
  const dropTitle =
    dropSummary.supportedFiles > 0
      ? `松手添加 ${dropSummary.supportedFiles} 个附件`
      : dropSummary.totalFiles > 0
        ? `这 ${dropSummary.totalFiles} 个文件暂不支持`
        : '松手即可添加附件';
  const dropDescription =
    dropSummary.totalFiles === 0
      ? '右侧对话区和输入框都支持拖拽添加，当前支持图片、PDF 和视频。'
      : dropSummary.unsupportedCount > 0
        ? `已识别 ${dropSummary.totalFiles} 个文件，其中 ${dropSummary.supportedFiles} 个会加入输入框，${dropSummary.unsupportedCount} 个会被忽略。`
        : `已识别 ${dropSummary.totalFiles} 个文件，都会直接加入当前输入框。`;

  const sendQueuedOrImmediateMessage = useCallback(async (payload: ComposerSendPayload): Promise<SendAttemptResult> => {
    const app = appRef.current;
    const request = app?.client?.request;
    if (effectiveSendBlockedReason) {
      setStatus((current) => ({
        ...current,
        lastError: effectiveSendBlockedReason,
      }));
      return 'failed';
    }
    if (!app?.connected || typeof request !== 'function') {
      setStatus((current) => ({
        ...current,
        lastError: app?.lastError ?? '尚未连接到 OpenClaw 网关，请稍等或重新进入页面。',
      }));
      return 'retry';
    }

    const matchingPrompt = payload.prompt.trim();
    const promptToSend = buildSkillScopedPrompt(payload);
    const normalizedPrompt = promptToSend.trim();
    if (normalizedPrompt.startsWith('/') && payload.imageAttachments.length === 0) {
      try {
        app.chatMessage = normalizedPrompt;
        app.chatAttachments = [];
        await app.handleSendChat();
        scrollChatToBottom({force: true});
        return 'sent';
      } catch (error) {
        const detail = error instanceof Error ? error.message : '任务发送失败';
        setStatus((current) => ({
          ...current,
          lastError: detail,
        }));
        return looksLikeOpenClawTransportIssue(detail) ? 'retry' : 'failed';
      }
    }

    const runtimeSessionKey =
      buildNativeAgentSessionKey(payload.selectedAgentSlug) || effectiveGatewaySessionKey;

    const turn = startChatTurn({
      prompt: payload.prompt,
      conversationId,
      sessionKey: runtimeSessionKey,
      agentId: payload.selectedAgentSlug,
    });
    syncChatConversationActiveAgent({
      conversationId: turn.conversationId,
      sessionKey: runtimeSessionKey,
      agentId: payload.selectedAgentSlug,
      reason: payload.selectedAgentSlug ? 'agent-selected-for-send' : 'agent-cleared-for-send',
      summary: payload.selectedAgentName
        ? `当前对话切换到 ${payload.selectedAgentName} 接手。`
        : '当前对话恢复为未指定专家的主执行上下文。',
    });

    activeChatTurnRunRef.current = {
      turnId: turn.id,
      baselineError: status.lastError,
      failureMessage: null,
    };

    const shouldAugmentWithMemory = !normalizedPrompt.startsWith('/');
    let runId: string | null = null;
    let handoffStarted = false;

    try {
      if (!creditClient || !creditToken) {
        throw new Error('当前账号龙虾币鉴权尚未就绪，暂时不能发送消息。');
      }

      clearUsageSettlementTimers();

      runId = createDesktopRunId();
      const startedAt = Date.now();
      stageOutgoingChatMessage({
        app,
        prompt: normalizedPrompt,
        imageAttachments: payload.imageAttachments,
        runId,
        startedAt,
      });
      persistChatSessionSnapshot();
      scrollChatToBottom({force: true});
      const relevantMemoryMatchesPromise = shouldAugmentWithMemory
        ? loadRelevantMemoryMatches(matchingPrompt || normalizedPrompt)
        : Promise.resolve([]);
      const gatewaySessionPreparedPromise = ensureGatewaySessionPrepared();
      const relevantMemoryMatches = await relevantMemoryMatchesPromise;
      const runtimePrompt =
        shouldAugmentWithMemory && relevantMemoryMatches.length > 0
          ? buildMemoryContextPrompt(normalizedPrompt, relevantMemoryMatches)
          : normalizedPrompt;

      const runGrant = await Promise.all([
        creditClient.authorizeRun({
          token: creditToken,
          eventId: runId,
          sessionKey: runtimeSessionKey,
          client: 'desktop',
          message: runtimePrompt,
          historyMessages: estimateHistoryMessagesFromGroups(renderState.groupCount),
          hasSearch: inferCreditQuoteHasSearch(normalizedPrompt),
          hasTools: true,
          attachments: payload.imageAttachments.map((item) => ({
            type: item.mimeType.startsWith('image/') ? 'image' : 'file',
          })),
          model: selectedModelId || undefined,
          appName,
        }),
        gatewaySessionPreparedPromise,
      ]).then(([grant]) => grant);
      setCreditBlockNotice(null);
      const baselineTokenSnapshot = await loadGatewaySessionTokenSnapshot(app, runtimeSessionKey).catch(() => null);

      replacePendingUsageSettlements([
        ...storedPendingUsageSettlementsRef.current.filter((pending) => pending.runId !== runId),
        {
          runId,
          grantId: runGrant.grant_id,
          sessionKey: runtimeSessionKey,
          conversationId,
          startedAt,
          expiresAt: startedAt + USAGE_SETTLEMENT_MAX_WAIT_MS,
          model: selectedModelId,
          baselineInputTokens: baselineTokenSnapshot?.inputTokens ?? null,
          baselineOutputTokens: baselineTokenSnapshot?.outputTokens ?? null,
          attempts: 0,
          terminalState: 'pending',
        },
      ]);

      handoffStarted = true;
      await sendAuthorizedChatMessage({
        app,
        sessionKey: runtimeSessionKey,
        prompt: runtimePrompt,
        imageAttachments: payload.imageAttachments,
        runId,
        startedAt,
      });
      void noteMemoryUsage(relevantMemoryMatches.map((item) => item.entry.id));
      scrollChatToBottom({force: true});
      window.setTimeout(() => scrollChatToBottom({smooth: true}), 180);
      window.setTimeout(() => scrollChatToBottom({smooth: true}), 900);
      window.setTimeout(() => {
        const latestApp = appRef.current;
        if (!activeChatTurnRunRef.current) {
          return;
        }
        if (!latestApp?.chatSending && !latestApp?.chatRunId) {
          finalizeChatTurnRun();
        }
      }, 420);
      return 'sent';
    } catch (error) {
      const { message: detail, code } = resolveGatewayErrorDetail(error);
      if (isCreditBlockCode(code)) {
        setCreditBlockNotice({ message: detail, code });
        setRechargeNoticeDismissed(false);
      } else {
        setCreditBlockNotice(null);
      }
      if (runId) {
        replacePendingUsageSettlements(
          storedPendingUsageSettlementsRef.current.filter((pending) => pending.runId !== runId),
        );
      }
      if (!handoffStarted) {
        markOutgoingChatFailed({ app, detail, code });
      }
      persistChatSessionSnapshot();
      if (storedPendingUsageSettlementsRef.current.length === 0) {
        clearUsageSettlementTimers();
      }
      markChatTurnFailed({
        id: turn.id,
        artifacts: collectLatestArtifactKinds(hostRef.current),
        error: detail,
      });
      activeChatTurnRunRef.current = null;
      setStatus((current) => ({
        ...current,
        lastError: isCreditBlockCode(code) ? null : detail,
        lastErrorCode: isCreditBlockCode(code) ? null : code,
      }));
      return looksLikeOpenClawTransportIssue(detail) ? 'retry' : 'failed';
    }
  }, [
    clearUsageSettlementTimers,
    collectLatestArtifactKinds,
    creditClient,
    creditToken,
    finalizeChatTurnRun,
    ensureGatewaySessionPrepared,
    appName,
    conversationId,
    persistChatSessionSnapshot,
    renderState.groupCount,
    replacePendingUsageSettlements,
    loadRelevantMemoryMatches,
    noteMemoryUsage,
    selectedModelId,
    effectiveGatewaySessionKey,
    effectiveSendBlockedReason,
    scrollChatToBottom,
    status.lastError,
    sessionKey,
  ]);

  const enqueueQueuedMessage = useCallback((payload: ComposerSendPayload) => {
    const next = createQueuedComposerMessage(payload);
    setQueuedMessages((current) => [...current, next]);
  }, []);

  const removeQueuedMessage = useCallback((id: string) => {
    setQueuedMessages((current) => current.filter((item) => item.id !== id));
  }, []);

  const flushQueuedMessages = useCallback(async () => {
    if (queueDispatchInFlightRef.current) {
      return;
    }

    const app = appRef.current;
    const gatewayBusy = app ? reconcileGatewayChatBusyState(app, effectiveGatewaySessionKey).busy : false;
    if (effectiveSendBlockedReason) {
      return;
    }
    if (!status.connected) {
      if (allowDisconnectedComposerQueue) {
        app?.connect();
      }
      return;
    }
    if (status.busy || gatewayBusy) {
      return;
    }

    const [next] = queuedMessagesRef.current;
    if (!next) {
      return;
    }

    queueDispatchInFlightRef.current = next.id;
    setQueuedMessages((current) => current.filter((item) => item.id !== next.id));

    let result: SendAttemptResult = 'failed';
    try {
      result = await sendQueuedOrImmediateMessage(next.payload);
    } finally {
      queueDispatchInFlightRef.current = null;
    }

    if (result === 'retry') {
      setQueuedMessages((current) => (current.some((item) => item.id === next.id) ? current : [next, ...current]));
    }
  }, [
    allowDisconnectedComposerQueue,
    effectiveGatewaySessionKey,
    effectiveSendBlockedReason,
    sendQueuedOrImmediateMessage,
    status.busy,
    status.connected,
  ]);

  useEffect(() => {
    if (queuedMessages.length === 0) {
      return;
    }
    void flushQueuedMessages();
  }, [effectiveSendBlockedReason, flushQueuedMessages, queuedMessages.length, status.busy, status.connected]);

  const handleSend = useCallback(async (payload: ComposerSendPayload): Promise<boolean> => {
    if (!shellAuthenticated) {
      onRequireAuth?.('login');
      return false;
    }
    const app = appRef.current;
    const gatewayBusy = app ? reconcileGatewayChatBusyState(app, effectiveGatewaySessionKey).busy : false;
    if (!effectiveSendBlockedReason && !status.connected && allowDisconnectedComposerQueue) {
      if (optimisticEmptySessionActive) {
        setOptimisticEmptySessionActive(false);
      }
      enqueueQueuedMessage(payload);
      app?.connect();
      return true;
    }
    if (!effectiveSendBlockedReason && (status.busy || gatewayBusy)) {
      if (optimisticEmptySessionActive) {
        setOptimisticEmptySessionActive(false);
      }
      enqueueQueuedMessage(payload);
      return true;
    }
    if (optimisticEmptySessionActive) {
      setOptimisticEmptySessionActive(false);
    }
    return (await sendQueuedOrImmediateMessage(payload)) === 'sent';
  }, [
    allowDisconnectedComposerQueue,
    effectiveGatewaySessionKey,
    effectiveSendBlockedReason,
    enqueueQueuedMessage,
    optimisticEmptySessionActive,
    onRequireAuth,
    sendQueuedOrImmediateMessage,
    shellAuthenticated,
    status.busy,
    status.connected,
  ]);

  const handleAbort = useCallback(async () => {
    await appRef.current?.handleAbortChat();
    if (activeChatTurnRunRef.current) {
      activeChatTurnRunRef.current.failureMessage = '任务已中止';
    }
  }, []);

  const handleSelectionAction = useCallback((trailingText: string) => {
    if (!selectionMenu) {
      return;
    }
    composerRef.current?.insertReference(selectionMenu.text, {
      label: selectionMenu.label,
      trailingText,
    });
    composerRef.current?.focus();
    clearSelection();
    closeSelectionMenu();
  }, [clearSelection, closeSelectionMenu, selectionMenu]);

  const handleSelectionCopy = useCallback(async () => {
    if (!selectionMenu) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectionMenu.text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = selectionMenu.text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.append(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    closeSelectionMenu();
  }, [closeSelectionMenu, selectionMenu]);

  const selectionMenuContent =
    selectionMenu && typeof document !== 'undefined' ? (
      <div
        ref={selectionMenuRef}
        className="iclaw-chat-selection-menu"
        style={{ left: selectionMenu.x, top: selectionMenu.y }}
        role="menu"
        aria-label="选中文本操作"
      >
        <button type="button" className="iclaw-chat-selection-menu__item" onClick={() => handleSelectionAction('')}>
          <MessageSquarePlus className="iclaw-chat-selection-menu__icon" />
          追问
        </button>
        <button
          type="button"
          className="iclaw-chat-selection-menu__item"
          onClick={() => handleSelectionAction('请总结这段内容的要点。')}
        >
          <ScrollText className="iclaw-chat-selection-menu__icon" />
          总结
        </button>
        <button
          type="button"
          className="iclaw-chat-selection-menu__item"
          onClick={() => handleSelectionAction('请用更容易理解的话解释这段内容。')}
        >
          <MessageCircleQuestionMark className="iclaw-chat-selection-menu__icon" />
          解释
        </button>
        <button type="button" className="iclaw-chat-selection-menu__item" onClick={() => void handleSelectionCopy()}>
          <Copy className="iclaw-chat-selection-menu__icon" />
          复制
        </button>
      </div>
    ) : null;

  useEffect(() => {
    const handleHighRiskConfirmationRequest = (event: Event) => {
      const detail = (event as CustomEvent<HighRiskConfirmationRequest | null>).detail;
      if (!detail) {
        return;
      }
      setHighRiskConfirmationRequest(detail);
    };

    window.addEventListener(CHAT_HIGH_RISK_CONFIRMATION_EVENT, handleHighRiskConfirmationRequest);
    return () => {
      window.removeEventListener(CHAT_HIGH_RISK_CONFIRMATION_EVENT, handleHighRiskConfirmationRequest);
    };
  }, []);

  const handleWelcomeStartChat = useCallback(() => {
    composerRef.current?.focus();
  }, []);

  const handleWelcomeFillPrompt = useCallback((prompt: string) => {
    composerRef.current?.replacePrompt(prompt);
    window.setTimeout(() => {
      composerRef.current?.focus();
    }, 80);
  }, []);

  useEffect(() => {
    if (!initialPromptKey || !initialPrompt?.trim()) {
      return;
    }
    if (consumedInitialPromptKeyRef.current === initialPromptKey) {
      return;
    }
    composerRef.current?.replacePrompt(initialPrompt);
    composerRef.current?.focus();
    consumedInitialPromptKeyRef.current = initialPromptKey;
  }, [initialPrompt, initialPromptKey]);

  useEffect(() => {
    if (!surfaceVisible || !focusedTurnId) {
      return;
    }

    const focusSignal = focusedTurnKey || focusedTurnId;
    if (!focusSignal || consumedFocusedTurnKeyRef.current === focusSignal) {
      return;
    }

    const turn = readChatTurns().find((item) => item.source === 'chat' && item.id === focusedTurnId);
    const prompt = turn?.prompt?.trim() ?? '';
    if (!prompt) {
      consumedFocusedTurnKeyRef.current = focusSignal;
      return;
    }

    const timers = [0, 180, 520, 1100].map((delay) =>
      window.setTimeout(() => {
        const host = hostRef.current;
        if (!host || consumedFocusedTurnKeyRef.current === focusSignal) {
          return;
        }

        const targetGroup = findFocusedTurnGroup(host, prompt);
        if (!targetGroup) {
          return;
        }

        targetGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
        host.querySelectorAll('.chat-group--turn-focused').forEach((node) => {
          node.classList.remove('chat-group--turn-focused');
        });
        targetGroup.classList.add('chat-group--turn-focused');

        if (focusedTurnHighlightTimerRef.current != null) {
          window.clearTimeout(focusedTurnHighlightTimerRef.current);
        }
        focusedTurnHighlightTimerRef.current = window.setTimeout(() => {
          targetGroup.classList.remove('chat-group--turn-focused');
          focusedTurnHighlightTimerRef.current = null;
        }, 2200);

        consumedFocusedTurnKeyRef.current = focusSignal;
      }, delay),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [focusedTurnId, focusedTurnKey, renderState.groupCount, renderState.chatMessageCount, surfaceVisible]);

  const allowWelcomeForCurrentRoute =
    !conversationId || shouldTreatAsImmediateEmptySession(appName, sessionKey, conversationId);

  const showWelcomePage = shouldShowOpenClawWelcomePage({
    allowWelcomeForCurrentRoute,
    allowImmediateEmptySessionUi,
    bootStillSettling: lifecycle.bootStillSettling,
    shellTransitioning,
    sessionHistoryState,
    hasObservedHistory,
    renderGroupCount: renderState.groupCount,
    showRenderDiagnosticsCard,
    showConnectionCard,
    statusBusy: status.busy,
    welcomePageEnabled: welcomePageConfig?.enabled !== false,
  });

  const artifactPreviewMarkup =
    artifactPreview?.kind === 'markdown' && artifactPreview.content
      ? { __html: toSanitizedMarkdownHtml(artifactPreview.content) }
      : null;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const userSenderLabels = new Set(
      [
        'you',
        'user',
        user?.name,
        user?.username,
        user?.display_name,
        user?.nickname,
        user?.email,
      ]
        .map((value) => normalizeChatSenderLabel(value))
        .filter(Boolean),
    );

    const scheduleButtonReset = (button: HTMLButtonElement) => {
      const timer = window.setTimeout(() => {
        if (!button.isConnected) {
          return;
        }
        setMessageActionFeedback(button, 'idle');
      }, MESSAGE_ACTION_FEEDBACK_MS);
      messageActionTimersRef.current.push(timer);
    };

    const handleCopyAction = async (button: HTMLButtonElement, text: string) => {
      const copied = await copyTextToClipboard(text);
      if (!copied || !button.isConnected) {
        return;
      }
      setMessageActionFeedback(button, 'success');
      scheduleButtonReset(button);
    };

    const normalizeUserGroupClass = (group: HTMLElement) => {
      if (group.classList.contains('user')) {
        return;
      }

      const senderName = normalizeChatSenderLabel(
        group.querySelector('.chat-group-footer .chat-sender-name')?.textContent,
      );
      if (!senderName || !userSenderLabels.has(senderName)) {
        return;
      }

      group.classList.remove('assistant', 'other', 'tool');
      group.classList.add('user');

      const avatar = group.querySelector(':scope > .chat-avatar');
      if (avatar instanceof HTMLElement) {
        avatar.classList.remove('assistant', 'other', 'tool');
        avatar.classList.add('user');
      }
    };

    const ensureUserCopyButton = (group: HTMLElement) => {
      const text = extractChatGroupText(group);
      let button = group.querySelector(':scope > .iclaw-chat-user-copy') as HTMLButtonElement | null;

      if (!button) {
        button = createMessageActionButton({
          className: 'iclaw-chat-user-copy',
          title: '复制消息',
          icon: 'copy',
        });
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          button?.blur();
          void handleCopyAction(button!, extractChatGroupText(group));
        });
        group.append(button);
      }

      button.disabled = !text;
      button.setAttribute('aria-hidden', text ? 'false' : 'true');
    };

    const normalizeAssistantTurnGroups = (groups: HTMLElement[]) => {
      let assistantSegment: HTMLElement[] = [];

      const flushAssistantSegment = () => {
        if (assistantSegment.length === 0) {
          return;
        }

        const preferredAnchorIndex = assistantSegment.findIndex(
          (group) =>
            group.classList.contains('assistant') &&
            !group.classList.contains('tool') &&
            !isToolLikeChatGroup(group) &&
            hasVisibleMessageContent(group),
        );
        const anchorIndex = preferredAnchorIndex >= 0 ? preferredAnchorIndex : 0;

        assistantSegment.forEach((group, index) => {
          if (index === anchorIndex) {
            group.classList.remove('iclaw-chat-group--continued');
            return;
          }
          group.classList.add('iclaw-chat-group--continued');
        });

        assistantSegment = [];
      };

      groups.forEach((group) => {
        if (group.hasAttribute('hidden')) {
          flushAssistantSegment();
          group.classList.remove('iclaw-chat-group--continued');
          return;
        }

        if (group.classList.contains('user')) {
          flushAssistantSegment();
          group.classList.remove('iclaw-chat-group--continued');
          return;
        }

        const toolLikeGroup = isToolLikeChatGroup(group);
        const isAssistantSide =
          group.classList.contains('assistant') ||
          group.classList.contains('tool') ||
          group.classList.contains('other') ||
          toolLikeGroup;

        if (!isAssistantSide) {
          if (!hasVisibleMessageContent(group) && !toolLikeGroup) {
            group.classList.remove('iclaw-chat-group--continued');
            return;
          }
          flushAssistantSegment();
          group.classList.remove('iclaw-chat-group--continued');
          return;
        }

        assistantSegment.push(group);
      });

      flushAssistantSegment();
    };

    const isInternallyHiddenNode = (node: Element | null): node is HTMLElement =>
      node instanceof HTMLElement && node.dataset.iclawInternalHidden === 'true';

    const setInternalNodeHidden = (node: HTMLElement, hidden: boolean) => {
      if (hidden) {
        node.dataset.iclawInternalHidden = 'true';
        node.setAttribute('hidden', 'true');
        return;
      }

      if (node.dataset.iclawInternalHidden === 'true') {
        delete node.dataset.iclawInternalHidden;
        node.removeAttribute('hidden');
      }
    };

    const isHiddenChatGroup = (group: HTMLElement) =>
      group.dataset.iclawInternalHidden === 'true' || group.hasAttribute('hidden');

    const collectInternalMemoryFlushGroupIndexes = (groups: HTMLElement[]): Set<number> => {
      const hiddenIndexes = new Set<number>();

      groups.forEach((group, groupIndex) => {
        if (!isInternalMemoryFlushPrompt(extractChatGroupText(group))) {
          return;
        }

        let startIndex = groupIndex;
        if (group.classList.contains('user')) {
          hiddenIndexes.add(groupIndex);
        }

        for (let index = startIndex; index < groups.length; index += 1) {
          const nextGroup = groups[index];
          if (!nextGroup) {
            break;
          }
          if (index !== startIndex && nextGroup.classList.contains('user')) {
            break;
          }
          hiddenIndexes.add(index);
        }
      });

      return hiddenIndexes;
    };

    const findAdjacentChatGroup = (
      node: Element,
      direction: 'previousElementSibling' | 'nextElementSibling',
    ): HTMLElement | null => {
      let sibling = node[direction];
      while (sibling) {
        if (sibling instanceof HTMLElement && sibling.classList.contains('chat-group')) {
          return sibling;
        }
        sibling = sibling[direction];
      }
      return null;
    };

    const syncInternalCompactionDividerVisibility = () => {
      const dividers = Array.from(host.querySelectorAll('.chat-divider')).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      );

      dividers.forEach((divider) => {
        const label = normalizeInternalPromptText(
          divider.querySelector('.chat-divider__label')?.textContent ?? '',
        );
        const shouldHide =
          label === 'compaction' &&
          (isInternallyHiddenNode(findAdjacentChatGroup(divider, 'previousElementSibling')) ||
            isInternallyHiddenNode(findAdjacentChatGroup(divider, 'nextElementSibling')));
        setInternalNodeHidden(divider, shouldHide);
      });
    };

    const normalizeToolCollapseDefaults = (group: HTMLElement) => {
      Array.from(group.querySelectorAll('details.chat-tools-collapse, details.chat-tool-msg-collapse, details.chat-json-collapse')).forEach(
        (node) => {
          if (!(node instanceof HTMLDetailsElement)) {
            return;
          }
          if (node.dataset.iclawAutoExpanded !== 'true') {
            node.open = true;
            node.dataset.iclawAutoExpanded = 'true';
          }
        },
      );
    };

    const isAssistantSideGroup = (group: HTMLElement) =>
      !group.classList.contains('user') &&
      (group.classList.contains('assistant') ||
        group.classList.contains('tool') ||
        group.classList.contains('other'));

    const isTerminalAssistantTurnGroup = (groups: HTMLElement[], groupIndex: number) => {
      const current = groups[groupIndex];
      if (!current || !isAssistantSideGroup(current)) {
        return false;
      }

      for (let index = groupIndex + 1; index < groups.length; index += 1) {
        const nextGroup = groups[index];
        if (!nextGroup) {
          continue;
        }
        if (nextGroup.classList.contains('user')) {
          return true;
        }
        if (isAssistantSideGroup(nextGroup)) {
          return false;
        }
      }

      return true;
    };

    const clearAssistantFooter = (group: HTMLElement) => {
      const footer = group.querySelector(
        '.chat-group-messages > .iclaw-chat-assistant-footer',
      ) as HTMLDivElement | null;
      if (footer && !footer.hasAttribute('hidden')) {
        footer.setAttribute('hidden', 'true');
      }
    };

    const removeInterAssistantThinkingPlaceholder = () => {
      host.querySelectorAll(':scope > .iclaw-chat-intermediate-thinking').forEach((node) => {
        node.remove();
      });
    };

    const ensureInterAssistantThinkingPlaceholder = (anchorGroup: HTMLElement) => {
      const existingRows = Array.from(
        host.querySelectorAll(':scope > .iclaw-chat-intermediate-thinking'),
      ) as HTMLDivElement[];
      let row = existingRows.shift() ?? null;
      existingRows.forEach((node) => node.remove());
      if (!row) {
        row = document.createElement('div');
        row.className = 'iclaw-chat-intermediate-thinking';
        row.setAttribute('role', 'status');
        row.setAttribute('aria-live', 'polite');
        row.innerHTML = `
          <span class="iclaw-chat-intermediate-thinking__avatar-spacer" aria-hidden="true"></span>
          <div class="iclaw-chat-intermediate-thinking__body">
            <div class="chat-bubble chat-reading-indicator" aria-hidden="true">
              <span class="chat-reading-indicator__dots">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
        `;
      }

      if (anchorGroup.nextElementSibling !== row) {
        anchorGroup.insertAdjacentElement('afterend', row);
      }
    };

    const findInterAssistantThinkingAnchor = (groups: HTMLElement[]) => {
      if (status.responsePhase !== 'awaiting-visible-assistant') {
        return null;
      }

      let lastUserIndex = -1;
      groups.forEach((group, index) => {
        if (!isHiddenChatGroup(group) && group.classList.contains('user')) {
          lastUserIndex = index;
        }
      });

      if (lastUserIndex < 0) {
        return null;
      }

      const currentTurnGroups = groups
        .slice(lastUserIndex + 1)
        .filter((group) => !isHiddenChatGroup(group) && isAssistantSideGroup(group));

      if (currentTurnGroups.length === 0) {
        return groups[lastUserIndex] ?? null;
      }

      return currentTurnGroups[currentTurnGroups.length - 1] ?? null;
    };

    const clearUserRunFooter = (group: HTMLElement) => {
      const footer = group.querySelector(
        '.chat-group-messages > .iclaw-chat-run-footer',
      ) as HTMLDivElement | null;
      if (footer && !footer.hasAttribute('hidden')) {
        footer.setAttribute('hidden', 'true');
      }
    };

    const ensureAssistantFooter = (
      group: HTMLElement,
      footerMeta: AssistantFooterMeta | null,
      regeneratePromptText: string,
    ) => {
      const messages = group.querySelector('.chat-group-messages') as HTMLElement | null;
      if (!messages) {
        return;
      }

      const assistantText = extractChatGroupText(group);
      const fallbackTimestamp = extractChatGroupTimestampLabel(group);
      let footer = messages.querySelector(':scope > .iclaw-chat-assistant-footer') as HTMLDivElement | null;

      if (!footer) {
        footer = document.createElement('div');
        footer.className = 'iclaw-chat-assistant-footer';
        footer.innerHTML = `
          <div class="iclaw-chat-assistant-meta" data-state="idle">
            <span class="iclaw-chat-assistant-meta__label"></span>
            <strong class="iclaw-chat-assistant-meta__value"></strong>
          </div>
          <div class="iclaw-chat-assistant-footer__right">
            <span class="iclaw-chat-assistant-footer__timestamp"></span>
            <div class="iclaw-chat-assistant-toolbar">
              <button type="button" class="iclaw-chat-assistant-toolbar__btn" data-action="like" data-state="idle" aria-label="点赞" title="点赞">
                <span class="iclaw-message-action__icon iclaw-message-action__icon--idle">${MESSAGE_ACTION_ICONS.thumbsUp}</span>
                <span class="iclaw-message-action__icon iclaw-message-action__icon--success">${MESSAGE_ACTION_ICONS.check}</span>
              </button>
              <button type="button" class="iclaw-chat-assistant-toolbar__btn" data-action="dislike" data-state="idle" aria-label="点踩" title="点踩">
                <span class="iclaw-message-action__icon iclaw-message-action__icon--idle">${MESSAGE_ACTION_ICONS.thumbsDown}</span>
                <span class="iclaw-message-action__icon iclaw-message-action__icon--success">${MESSAGE_ACTION_ICONS.check}</span>
              </button>
              <button type="button" class="iclaw-chat-assistant-toolbar__btn iclaw-chat-assistant-toolbar__btn--copyable" data-action="copy" data-state="idle" aria-label="复制" title="复制">
                <span class="iclaw-message-action__icon iclaw-message-action__icon--idle">${MESSAGE_ACTION_ICONS.copy}</span>
                <span class="iclaw-message-action__icon iclaw-message-action__icon--success">${MESSAGE_ACTION_ICONS.check}</span>
              </button>
              <button type="button" class="iclaw-chat-assistant-toolbar__btn" data-action="regenerate" aria-label="重新生成" title="重新生成">${MESSAGE_ACTION_ICONS.refresh}</button>
            </div>
          </div>
        `;

        footer.addEventListener('click', (event) => {
          const target = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-action]');
          if (!target) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          const action = target.dataset.action;

          if (action === 'like' || action === 'dislike') {
            const opposite = footer!.querySelector<HTMLButtonElement>(
              `[data-action="${action === 'like' ? 'dislike' : 'like'}"]`,
            );
            const active = target.dataset.active === 'true';
            if (active) {
              target.removeAttribute('data-active');
              setMessageActionFeedback(target, 'idle');
            } else {
              target.dataset.active = 'true';
              opposite?.removeAttribute('data-active');
              setMessageActionFeedback(target, 'success');
              if (opposite) {
                setMessageActionFeedback(opposite, 'idle');
              }
              scheduleButtonReset(target);
            }
            target.blur();
            return;
          }

          if (action === 'copy') {
            target.blur();
            void handleCopyAction(target, extractChatGroupText(group));
            return;
          }

          if (action === 'regenerate') {
            target.blur();
            if (status.busy) {
              return;
            }
            const nextPrompt = footer?.dataset.regeneratePrompt?.trim() || '';
            if (!nextPrompt) {
              return;
            }
            void handleSend({
              prompt: nextPrompt,
              imageAttachments: [],
              selectedAgentSlug: null,
              selectedAgentName: null,
              selectedAgentSystemPrompt: null,
              selectedSkillSlug: null,
              selectedSkillName: null,
              selectedMode: null,
              selectedModeLabel: null,
              selectedMarketScope: null,
              selectedMarketScopeLabel: null,
              selectedStockContext: null,
              selectedStockContextLabel: null,
              selectedWatchlist: null,
              selectedWatchlistLabel: null,
              selectedOutput: null,
              selectedOutputLabel: null,
            });
          }
        });

        messages.append(footer);
      }

      if (footer.hasAttribute('hidden')) {
        footer.removeAttribute('hidden');
      }

      const metaNode = footer.querySelector(':scope > .iclaw-chat-assistant-meta') as HTMLDivElement | null;
      const metaLabelNode = metaNode?.querySelector(
        ':scope > .iclaw-chat-assistant-meta__label',
      ) as HTMLSpanElement | null;
      const metaValueNode = metaNode?.querySelector(
        ':scope > .iclaw-chat-assistant-meta__value',
      ) as HTMLElement | null;
      const timestampNode = footer.querySelector(
        ':scope > .iclaw-chat-assistant-footer__right > .iclaw-chat-assistant-footer__timestamp',
      ) as HTMLSpanElement | null;
      const toolbar = footer.querySelector(
        ':scope > .iclaw-chat-assistant-footer__right > .iclaw-chat-assistant-toolbar',
      ) as HTMLDivElement | null;
      const copyButton = toolbar?.querySelector<HTMLButtonElement>('[data-action="copy"]') ?? null;
      const regenerateButton =
        toolbar?.querySelector<HTMLButtonElement>('[data-action="regenerate"]') ?? null;

      if (metaNode) {
        if (!footerMeta) {
          if (!metaNode.hasAttribute('hidden')) {
            metaNode.setAttribute('hidden', 'true');
          }
          if (metaNode.dataset.state !== 'idle') {
            metaNode.dataset.state = 'idle';
          }
          if (metaNode.title) {
            metaNode.title = '';
          }
          setElementTextIfChanged(metaLabelNode, '');
          if (metaValueNode && !metaValueNode.hasAttribute('hidden')) {
            metaValueNode.setAttribute('hidden', 'true');
          }
          setElementTextIfChanged(metaValueNode, '');
        } else {
          if (metaNode.hasAttribute('hidden')) {
            metaNode.removeAttribute('hidden');
          }
          const nextState = footerMeta.state;
          if (metaNode.dataset.state !== nextState) {
            metaNode.dataset.state = nextState;
          }
          const nextTitle = footerMeta.tooltip ?? '';
          if (metaNode.title !== nextTitle) {
            metaNode.title = nextTitle;
          }
          if (footerMeta.value) {
            if (metaValueNode?.hasAttribute('hidden')) {
              metaValueNode.removeAttribute('hidden');
            }
            setElementTextIfChanged(metaLabelNode, footerMeta.label);
            setElementTextIfChanged(metaValueNode, footerMeta.value);
          } else {
            if (metaValueNode && !metaValueNode.hasAttribute('hidden')) {
              metaValueNode.setAttribute('hidden', 'true');
            }
            setElementTextIfChanged(metaLabelNode, footerMeta.label);
            setElementTextIfChanged(metaValueNode, '');
          }
        }
      }
      if (timestampNode) {
        setElementTextIfChanged(timestampNode, footerMeta?.timestampLabel || fallbackTimestamp);
      }

      if (copyButton) {
        copyButton.disabled = !assistantText;
      }
      if (footer.dataset.regeneratePrompt !== regeneratePromptText) {
        footer.dataset.regeneratePrompt = regeneratePromptText;
      }
      if (regenerateButton) {
        regenerateButton.disabled = status.busy || !regeneratePromptText;
      }
    };

    const removeUserRunFooter = (group: HTMLElement) => {
      const messages = group.querySelector('.chat-group-messages') as HTMLElement | null;
      if (!messages) {
        return;
      }
      let footer = messages.querySelector(':scope > .iclaw-chat-run-footer') as HTMLDivElement | null;
      if (footer) {
        footer.remove();
        footer = null;
      }
    };

    const decorateChatGroups = () => {
      const chatMessages = appRef.current?.chatMessages ?? [];
      reconcileChatMessageRunMetadata({
        messages: chatMessages,
        pendingSettlements: pendingUsageSettlementsRef.current,
        sessionBillingSummaries,
      });
      const assistantFooterMetas = deriveAssistantFooterMetas(
        chatMessages,
        pendingUsageSettlementsRef.current,
        sessionBillingSummaries,
        appRef.current,
        status.busy,
      );
      const terminalAssistantPromptMap = buildTerminalAssistantPromptMap(chatMessages);
      const groups = Array.from(host.querySelectorAll<HTMLElement>('.chat-group'));
      const assistantGroupCount = groups.filter((group) => group.classList.contains('assistant')).length;
      const domFallbackFooterMetas =
        assistantFooterMetas.length === 0 && sessionBillingSummaries.length > 0
          ? sessionBillingSummaries
              .slice(0, assistantGroupCount)
              .reverse()
              .map((summary) => buildAssistantFooterMetaFromSummary(summary))
          : [];
      let assistantIndex = 0;
      let userIndex = 0;
      let domFallbackAssistantIndex = 0;

      groups.forEach((group) => {
        normalizeUserGroupClass(group);
        normalizeToolCards(group);
        normalizeApprovalActionCard(group);
        normalizeToolCollapseDefaults(group);
      });

      const internalMemoryFlushGroupIndexes = collectInternalMemoryFlushGroupIndexes(groups);
      groups.forEach((group, groupIndex) => {
        setInternalNodeHidden(group, internalMemoryFlushGroupIndexes.has(groupIndex));
      });
      syncInternalCompactionDividerVisibility();
      normalizeAssistantTurnGroups(groups);

      const interAssistantThinkingAnchor = findInterAssistantThinkingAnchor(groups);
      if (interAssistantThinkingAnchor) {
        ensureInterAssistantThinkingPlaceholder(interAssistantThinkingAnchor);
      } else {
        removeInterAssistantThinkingPlaceholder();
      }

      groups.forEach((rawGroup, groupIndex) => {
        const group = rawGroup as HTMLElement;
        if (isHiddenChatGroup(group)) {
          clearUserRunFooter(group);
          clearAssistantFooter(group);
          return;
        }

        if (group.classList.contains('user')) {
          ensureUserCopyButton(group);
          removeUserRunFooter(group);
          userIndex += 1;
          return;
        }

        if (group.classList.contains('assistant')) {
          clearUserRunFooter(group);
          const footerMeta =
            assistantFooterMetas[assistantIndex] ??
            domFallbackFooterMetas[domFallbackAssistantIndex] ??
            null;
          const shouldShowFooter = isTerminalAssistantTurnGroup(groups, groupIndex) && !status.busy;
          if (shouldShowFooter) {
            ensureAssistantFooter(group, footerMeta, terminalAssistantPromptMap.get(assistantIndex) ?? '');
          } else {
            clearAssistantFooter(group);
          }
          assistantIndex += 1;
          domFallbackAssistantIndex += 1;
          return;
        }

        clearUserRunFooter(group);
        clearAssistantFooter(group);
      });
    };

    const scheduleChatGroupDecoration = createCoalescedDomTask(decorateChatGroups);
    const detachResumeListener = attachVisibilityResumeFlush(scheduleChatGroupDecoration);

    decorateChatGroups();

    const observer = new MutationObserver(() => {
      scheduleChatGroupDecoration.schedule();
    });
    observer.observe(host, {
      childList: true,
      subtree: true,
    });

    const handleToolbarOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target instanceof HTMLElement &&
        target.closest('.iclaw-chat-assistant-toolbar, .iclaw-chat-user-copy')
      ) {
        return;
      }

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        activeElement.matches('.iclaw-chat-assistant-toolbar__btn, .iclaw-chat-user-copy')
      ) {
        activeElement.blur();
      }
    };

    document.addEventListener('pointerdown', handleToolbarOutsidePointerDown, true);

    return () => {
      observer.disconnect();
      scheduleChatGroupDecoration.cancel();
      detachResumeListener();
      document.removeEventListener('pointerdown', handleToolbarOutsidePointerDown, true);
      clearMessageActionTimers();
    };
  }, [
    assistantFooterVersion,
    clearMessageActionTimers,
    handleSend,
    pendingSettlementCount,
    sessionBillingSummaries,
    status.busy,
    user?.display_name,
    user?.email,
    user?.name,
    user?.nickname,
    user?.username,
  ]);

  return (
    <PageSurface as="div" className="bg-[var(--bg-page)]">
      <div className="flex min-h-0 flex-1 flex-col px-6 pt-3.5 pb-2 lg:px-8">
        {surfaceVisible && !showSurfaceReactivationMask && showRenderDiagnosticsCard ? (
          <div className="mb-4">
            <EmptyStatePanel
              compact
              title="聊天嵌入层还没有进入稳定可见态"
              description={renderDiagnosticsMessage}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<RefreshCw className="h-4 w-4" />}
                  onClick={() => appRef.current?.connect()}
                >
                  重新连接
                </Button>
              }
            />
          </div>
        ) : null}

        {surfaceVisible && !showSurfaceReactivationMask && !status.connected && showConnectionCard ? (
          <div className="mb-4">
            <EmptyStatePanel
              compact
              title={status.lastError ? '聊天网关连接失败' : '正在建立聊天连接'}
              description={
                <>
                  {connectionMessage}
                  <br />
                  网关地址：{gatewayUrl}
                  {secureContextHint ? ` · ${secureContextHint}` : ''}
                </>
              }
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<WifiOff className="h-4 w-4" />}
                  onClick={() => appRef.current?.connect()}
                >
                  重新尝试
                </Button>
              }
            />
          </div>
        ) : null}

        {showRechargeCtaCard ? (
          <div className="mb-4">
            <div className="relative">
              <EmptyStatePanel
                compact
                className="pr-14"
                title={
                  creditBlockNotice?.code === 'CREDIT_LIMIT_EXCEEDED'
                    ? '本次消息超过单次额度限制，当前已被拦截'
                    : '龙虾币余额不足，当前消息已被拦截'
                }
                description={
                  creditBlockNotice?.message || '新积分将在次日发放。请先前往充值中心充值后再继续发送。'
                }
                action={
                  onOpenRechargeCenter ? (
                    <Button
                      variant="primary"
                      size="sm"
                      leadingIcon={<Wallet className="h-4 w-4" />}
                      onClick={onOpenRechargeCenter}
                    >
                      去充值中心
                    </Button>
                  ) : undefined
                }
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-3 right-3 rounded-full p-2"
                aria-label="关闭龙虾币余额提醒"
                onClick={() => setRechargeNoticeDismissed(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        <div
          className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none"
          onDragEnterCapture={handleShellDragEnter}
          onDragOverCapture={handleShellDragOver}
          onDragLeaveCapture={handleShellDragLeave}
          onDropCapture={handleShellDrop}
        >
          <div
            className={`iclaw-chat-stage flex min-h-0 min-w-0 flex-1 overflow-hidden ${
              artifactPreview ? 'iclaw-chat-stage--artifact-open' : ''
            }`}
          >
            <div className="iclaw-chat-stage__main min-h-0 min-w-0 flex-1 overflow-hidden">
              <div
                ref={shellRef}
                className="openclaw-chat-surface-shell h-full flex-1 overflow-hidden"
                data-session-transitioning={shellTransitioning ? 'true' : 'false'}
                data-surface-reactivating={showSurfaceReactivationMask ? 'true' : 'false'}
              >
                <div
                  ref={hostRef}
                  className={`openclaw-chat-surface min-h-0 flex-1 overflow-hidden ${
                    allowImmediateEmptySessionUi ? 'pointer-events-none opacity-0' : ''
                  }`}
                />

                {showWelcomePage ? (
                  <K2CWelcomePage
                    onStartChat={handleWelcomeStartChat}
                    onFillPrompt={handleWelcomeFillPrompt}
                    config={welcomePageConfig}
                  />
                ) : null}

                {showBootMask ? (
                  <ChatSurfaceSkeletonMask
                    mode="boot"
                    label={status.lastError ? '聊天界面恢复失败，正在等待重连' : '正在恢复聊天界面'}
                  />
                ) : null}

                {showSessionTransitionMask ? (
                  <ChatSurfaceSkeletonMask
                    mode="switch"
                    label="正在切换对话，正在同步消息与输入状态"
                  />
                ) : null}

                {showSurfaceReactivationMask ? (
                  <ChatSurfaceSkeletonMask
                    mode="switch"
                    label="正在恢复已缓存的对话界面"
                  />
                ) : null}

                {shellDropActive ? (
                  <div className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-[30px] border border-[color:color-mix(in_srgb,var(--brand-primary)_30%,rgba(255,255,255,0.48))] bg-[color:color-mix(in_srgb,var(--chat-surface-panel)_72%,rgba(255,255,255,0.28)_28%)] backdrop-blur-[14px] shadow-[0_24px_60px_rgba(26,22,18,0.16)]">
                    <div className="flex max-w-[420px] flex-col items-center gap-3 px-6 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-[color:color-mix(in_srgb,var(--brand-primary)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white_88%)] text-[var(--brand-primary)] shadow-[0_14px_30px_rgba(0,0,0,0.08)]">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                      <div className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                        {dropTitle}
                      </div>
                      <div className="text-[14px] leading-7 text-[var(--text-secondary)]">
                        {dropDescription}
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2 text-[13px]">
                        {dropSummary.imageCount > 0 ? (
                          <span className="iclaw-chat-drop-chip" data-tone="image">
                            <ImageIcon className="h-3.5 w-3.5" />
                            图片 {dropSummary.imageCount}
                          </span>
                        ) : null}
                        {dropSummary.pdfCount > 0 ? (
                          <span className="iclaw-chat-drop-chip" data-tone="pdf">
                            <FileText className="h-3.5 w-3.5" />
                            PDF {dropSummary.pdfCount}
                          </span>
                        ) : null}
                        {dropSummary.videoCount > 0 ? (
                          <span className="iclaw-chat-drop-chip" data-tone="video">
                            <Film className="h-3.5 w-3.5" />
                            视频 {dropSummary.videoCount}
                          </span>
                        ) : null}
                        {dropSummary.unsupportedCount > 0 ? (
                          <span className="iclaw-chat-drop-chip" data-tone="unsupported">
                            <ScrollText className="h-3.5 w-3.5" />
                            忽略 {dropSummary.unsupportedCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {queuedMessages.length > 0 ? (
                  <div className="iclaw-chat-queue-panel" role="status" aria-live="polite">
                    <div className="iclaw-chat-queue-panel__header">
                      <div className="iclaw-chat-queue-panel__title">
                        <MessageSquarePlus className="h-4 w-4" />
                        <span>已排队 {queuedMessages.length} 条</span>
                      </div>
                      <div className="iclaw-chat-queue-panel__subtitle">当前回答结束后会自动顺序发送</div>
                    </div>
                    <div className="iclaw-chat-queue-panel__list">
                      {queuedMessages.map((item, index) => (
                        <div key={item.id} className="iclaw-chat-queue-panel__item">
                          <div className="iclaw-chat-queue-panel__item-main">
                            <span className="iclaw-chat-queue-panel__item-order">{index + 1}</span>
                            <div className="iclaw-chat-queue-panel__item-copy">
                              <div className="iclaw-chat-queue-panel__item-preview" title={item.preview}>
                                {item.preview}
                              </div>
                              <div className="iclaw-chat-queue-panel__item-meta">
                                {item.attachmentCount > 0 ? `附件 ${item.attachmentCount} 个` : '纯文本'}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="iclaw-chat-queue-panel__remove"
                            aria-label="移除排队消息"
                            title="移除排队消息"
                            onClick={() => removeQueuedMessage(item.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {showScrollToBottomButton ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="iclaw-chat-scroll-bottom-button"
                    leadingIcon={<ArrowDown className="h-4 w-4" />}
                    aria-label="回到底部"
                    title="回到底部"
                    onClick={() => scrollChatToBottom({force: true, smooth: true})}
                  />
                ) : null}

                <RichChatComposer
                  authBaseUrl={authBaseUrl}
                  ref={composerRef}
                  connected={status.connected}
                  busy={status.busy}
                  sendDisabledReason={effectiveSendBlockedReason}
                  dropActive={shellDropActive}
                  sessionTransitioning={shellTransitioning}
                  queueWhileConnecting={allowDisconnectedComposerQueue || !shellAuthenticated}
                  lobsterAgents={installedLobsterAgents}
                  skillOptions={skillOptions}
                  initialSelectedAgentSlug={initialAgentSlug}
                  skillSelectionScopeKey={sessionKey}
                  initialSelectedSkillSeedKey={initialPromptKey}
                  initialSelectedSkillSlug={initialSkillSlug}
                  initialSelectedSkillOption={initialSkillOption}
                  initialSelectedStock={initialStockContext}
                  searchStocks={handleSearchStocks}
                  searchFunds={handleSearchFunds}
                  modelOptions={modelOptions}
                  selectedModelId={selectedModelId}
                  modelsLoading={modelsLoading}
                  modelSwitching={modelSwitching}
                  onModelChange={handleModelChange}
                  onDraftChange={setComposerDraft}
                  creditEstimate={composerDraft?.hasContent ? creditEstimate : null}
                  composerConfig={inputComposerConfig}
                  onSend={handleSend}
                  onAbort={handleAbort}
                />

            {surfaceVisible && !showSurfaceReactivationMask && showRenderDiagnosticsCard ? (
              <div className="iclaw-chat-render-card" role="status" aria-live="polite">
                <div className="iclaw-chat-state-card__eyebrow">渲染诊断</div>
                <div className="iclaw-chat-state-card__title">{renderDiagnosticsMessage}</div>
                <div className="iclaw-chat-state-card__meta">
                  shell 登录：{shellAuthenticated ? '已登录' : '未登录'} · gateway 认证：
                  {hasGatewayAuth ? '已配置' : '缺失'}
                </div>
                <div className="iclaw-chat-state-card__meta">
                  gateway 连接：{status.connected ? '已连接' : '未连接'} · 输入区：
                  {renderState.hasNativeInput ? (renderState.nativeInputVisible ? '可见' : '已挂载但不可见') : '未渲染'} ·
                  线程：{renderState.hasThread ? (renderState.threadVisible ? '可见' : '已挂载但不可见') : '未渲染'} ·
                  消息组：{renderState.groupCount}
                </div>
                <div className="iclaw-chat-state-card__meta">
                  网关错误码：{status.lastErrorCode ?? '无'} · 最近未捕获错误码：{unhandledGatewayError?.code ?? '无'} ·
                  详情码：{unhandledGatewayError?.detailCode ?? '无'}
                </div>
                <div className="iclaw-chat-state-card__meta">
                  最近失败 RPC：{lastRpcFailure?.method ?? '无'} · RPC 错误码：{lastRpcFailure?.code ?? '无'} ·
                  RPC 详情码：{lastRpcFailure?.detailCode ?? '无'}
                </div>
                <div className="iclaw-chat-state-card__meta">
                  gateway 角色：{authRole ?? '未知'} · scopes：
                  {authScopes && authScopes.length > 0 ? authScopes.join(', ') : '未知'}
                </div>
                <div className="iclaw-chat-state-card__meta">
                  容器高度：{renderState.hostHeight}px · 输入区高度：{renderState.nativeInputHeight}px · 线程高度：
                  {renderState.threadHeight}px
                </div>
                {unhandledGatewayError ? (
                  <div className="iclaw-chat-state-card__meta">
                    最近未捕获错误：{unhandledGatewayError.message}
                    {unhandledGatewayError.httpStatus != null ? ` · httpStatus=${unhandledGatewayError.httpStatus}` : ''}
                  </div>
                ) : null}
                {lastRpcFailure ? (
                  <div className="iclaw-chat-state-card__meta">
                    最近失败 RPC 信息：{lastRpcFailure.message}
                  </div>
                ) : null}
              </div>
            ) : null}

                {selectionMenuContent ? createPortal(selectionMenuContent, document.body) : null}
                {highRiskConfirmationRequest
                  ? createPortal(
                      <HighRiskConfirmationModal
                        open
                        riskLevel={highRiskConfirmationRequest.riskLevel}
                        title={highRiskConfirmationRequest.title}
                        description={highRiskConfirmationRequest.description}
                        reason={highRiskConfirmationRequest.reason}
                        impactItems={highRiskConfirmationRequest.impactItems}
                        rollbackStatus={highRiskConfirmationRequest.rollbackStatus}
                        rollbackDescription={highRiskConfirmationRequest.rollbackDescription}
                        commandSummary={highRiskConfirmationRequest.commandSummary}
                        fullCommand={highRiskConfirmationRequest.fullCommand}
                        requireAcknowledgement={highRiskConfirmationRequest.requireAcknowledgement}
                        acknowledgementText={highRiskConfirmationRequest.acknowledgementText}
                        confirmText={highRiskConfirmationRequest.confirmText}
                        cancelText={highRiskConfirmationRequest.cancelText}
                        onConfirm={() => {
                          const currentRequest = highRiskConfirmationRequest;
                          setHighRiskConfirmationRequest(null);
                          currentRequest.onConfirm();
                        }}
                        onCancel={() => {
                          highRiskConfirmationRequest.onCancel?.();
                          setHighRiskConfirmationRequest(null);
                        }}
                        onOpenChange={(open) => {
                          if (!open) {
                            setHighRiskConfirmationRequest(null);
                          }
                        }}
                      />,
                      document.body,
                    )
                  : null}
              </div>
            </div>

            {artifactPreview ? (
              <aside className="iclaw-artifact-preview-pane">
                <div className="iclaw-artifact-preview-pane__header">
                  <div className="iclaw-artifact-preview-pane__meta">
                    <div className="iclaw-artifact-preview-pane__title">{artifactPreview.title}</div>
                    <div className="iclaw-artifact-preview-pane__path">{artifactPreview.path}</div>
                  </div>
                  <button
                    type="button"
                    className="iclaw-artifact-preview-pane__close"
                    aria-label="关闭制品预览"
                    title="关闭制品预览"
                    onClick={closeArtifactPreview}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="iclaw-artifact-preview-pane__body">
                  {artifactPreview.loading ? (
                    <div className="iclaw-artifact-preview-pane__loading" role="status" aria-live="polite">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      正在读取制品内容...
                    </div>
                  ) : artifactPreview.error ? (
                    <EmptyStatePanel
                      compact
                      title="右侧分屏暂时没有拿到真实内容"
                      description={artifactPreview.error}
                    />
                  ) : artifactPreview.kind === 'html' ? (
                    <iframe
                      title={artifactPreview.title}
                      className="iclaw-artifact-preview-pane__frame"
                      sandbox="allow-downloads allow-forms allow-modals allow-popups allow-scripts"
                      srcDoc={artifactPreview.content ?? ''}
                    />
                  ) : artifactPreview.kind === 'markdown' && artifactPreviewMarkup ? (
                    <div
                      className="iclaw-artifact-preview-pane__markdown"
                      dangerouslySetInnerHTML={artifactPreviewMarkup}
                    />
                  ) : (
                    <pre className="iclaw-artifact-preview-pane__text">{artifactPreview.content ?? ''}</pre>
                  )}
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </PageSurface>
  );
}
