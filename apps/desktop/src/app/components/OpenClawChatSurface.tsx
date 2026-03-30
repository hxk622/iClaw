import {
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
import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent } from 'react';
import type { CreditQuoteData, IClawClient, MarketFundData, MarketStockData, RunBillingSummaryData } from '@iclaw/sdk';
import '@openclaw-ui/main.ts';
import {
  normalizeMessage,
  normalizeRoleForGrouping,
} from '@openclaw-ui/ui/chat/message-normalizer.ts';
import './openclaw-chat-surface.css';
import { Button } from '@/app/components/ui/Button';
import { EmptyStatePanel } from '@/app/components/ui/EmptyStatePanel';
import { PageSurface } from '@/app/components/ui/PageLayout';
import { K2CWelcomePage } from '@/app/components/K2CWelcomePage';
import { readAppLocale } from '@/app/lib/general-preferences';
import {
  buildComposerModelOptions,
  findComposerModelOption,
  type ComposerModelOption,
} from '../lib/model-catalog';
import { fetchRuntimeModelCatalog, mapRuntimeModelsToGatewayEntries } from '../lib/runtime-models';
import {
  buildGeneratedUserAvatarDataUrl,
  resolveUserAvatarUrl,
  type AppUserAvatarSource,
} from '../lib/user-avatar';
import type { ResolvedInputComposerConfig, ResolvedWelcomePageConfig } from '../lib/oem-runtime';
import { loadSkillStoreCatalog } from '@/app/lib/skill-store';
import {
  isInvestmentExpertAgent,
  loadLobsterAgents,
} from '../lib/lobster-store';
import {
  inferRecentTaskArtifactsFromText,
  markRecentTaskCompleted,
  markRecentTaskFailed,
  startRecentTask,
} from '../lib/recent-tasks';
import { clearCacheKeysByPrefix, clearSessionKeysByPrefix, removeCacheKeys } from '../lib/persistence/cache-store';
import {
  RichChatComposer,
  type ComposerAgentOption,
  type ComposerSkillOption,
  type ComposerDraftPayload,
  type ComposerInstrumentSearchPage,
  type ComposerSendPayload,
  type ComposerStockContext,
  type OpenClawImageAttachment,
  type RichChatComposerHandle,
} from './RichChatComposer';

declare global {
  interface Window {
    __ICLAW_OPENCLAW_DIAGNOSTICS__?: Record<string, unknown>;
  }
}

type OpenClawTheme = 'system' | 'light' | 'dark';

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
};

type OpenClawChatSurfaceProps = {
  gatewayUrl: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  authBaseUrl: string;
  appName: string;
  sessionKey?: string;
  initialPrompt?: string | null;
  initialPromptKey?: string | null;
  initialAgentSlug?: string | null;
  initialSkillSlug?: string | null;
  initialStockContext?: ComposerStockContext | null;
  focusTaskId?: string | null;
  focusTaskPrompt?: string | null;
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
  onInitialSkillSlugChange?: (slug: string | null) => void;
  onOpenRechargeCenter?: () => void;
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
const SESSION_TRANSITION_MIN_DURATION_MS = 260;
const INITIAL_SURFACE_BOOT_TIMEOUT_MS = 3200;
const INITIAL_EMPTY_SESSION_SETTLE_MS = 1100;
const STATUS_POLL_INTERVAL_MS = 420;
const CONNECTION_LOSS_GRACE_MS = 1200;
const ICLAW_BILLING_SUMMARY_KEY = '__iclawBillingSummary';
const ICLAW_BILLING_STATE_KEY = '__iclawBillingState';
const ICLAW_BILLING_RUN_ID_KEY = '__iclawBillingRunId';
const REFERENCE_MARKER_PATTERN = /\[\[引用:([\s\S]*?)\]\]/g;
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

type ArtifactAutoOpenState = {
  lastBusy: boolean;
  runSequence: number;
  pendingRunSequence: number | null;
  pendingScanCount: number;
  lastOpenedToken: string | null;
};

type ActiveRecentTaskRun = {
  taskId: string;
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

type PendingUsageSettlement = {
  runId: string;
  grantId: string;
  sessionKey: string;
  startedAt: number;
  expiresAt: number;
  model: string | null;
  baselineInputTokens: number | null;
  baselineOutputTokens: number | null;
  attempts: number;
  terminalState: 'pending' | 'final' | 'aborted' | 'error';
};

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

function normalizeGatewaySessionKey(key?: string | null): string {
  return key?.trim().toLowerCase() ?? '';
}

function resolveEquivalentGatewaySessionKeys(targetSessionKey: string): Set<string> {
  const normalized = normalizeGatewaySessionKey(targetSessionKey);
  const keys = new Set<string>();
  if (!normalized) {
    return keys;
  }

  keys.add(normalized);

  if (normalized === 'main') {
    keys.add('agent:main:main');
    return keys;
  }

  if (!normalized.includes(':')) {
    keys.add(`agent:${normalized}:main`);
    return keys;
  }

  const canonicalMainMatch = normalized.match(/^agent:([^:]+):main$/);
  if (canonicalMainMatch) {
    keys.add(canonicalMainMatch[1] ?? normalized);
  }

  return keys;
}

function buildGatewaySessionPatchTargets(
  sessionKey: string,
  resolvedSessionKey?: string | null,
): string[] {
  const candidates = [resolvedSessionKey?.trim() || '', sessionKey.trim()];
  const normalized = new Set<string>();
  const targets: string[] = [];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const aliases = resolveEquivalentGatewaySessionKeys(candidate);
    if (aliases.size === 0) {
      const key = normalizeGatewaySessionKey(candidate);
      if (!key || normalized.has(key)) continue;
      normalized.add(key);
      targets.push(candidate);
      continue;
    }
    for (const alias of aliases) {
      const key = normalizeGatewaySessionKey(alias);
      if (!key || normalized.has(key)) continue;
      normalized.add(key);
      targets.push(alias);
    }
  }

  return targets;
}

function resolveSessionModelFromList(
  sessionsResult: GatewaySessionsListResult | null | undefined,
  targetSessionKey: string,
): string {
  const aliases = resolveEquivalentGatewaySessionKeys(targetSessionKey);
  if (aliases.size === 0) {
    return '';
  }

  return (
    sessionsResult?.sessions.find((session) =>
      aliases.has(normalizeGatewaySessionKey(session.key)),
    )?.model?.trim() ?? ''
  );
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
const BILLING_REHYDRATION_FALLBACK_WINDOW_MS = 90_000;
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

function collectLatestArtifactKinds(host: HTMLElement | null): ReturnType<typeof inferRecentTaskArtifactsFromText> {
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

    const artifacts = new Set<ReturnType<typeof inferRecentTaskArtifactsFromText>[number]>();
    cards.forEach((card) => {
      inferRecentTaskArtifactsFromText(buildToolCardSignature(card)).forEach((artifact) => {
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
  return Array.from(group.querySelectorAll('.chat-message')).some((node) => {
    if (!(node instanceof HTMLElement) || node.hasAttribute('hidden')) {
      return false;
    }
    return Boolean(node.textContent?.replace(/\s+/g, ' ').trim());
  });
}

function buildNormalizedGroupText(group: HTMLElement): string {
  return group.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';
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
    if (isLikelyArtifactToolCard(card)) {
      artifactCardCount += 1;
      collapseArtifactToolCardInlineBody(card);
      card.removeAttribute('hidden');
      card.dataset.iclawToolCard = 'artifact';
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

function setElementTextIfChanged(node: Node | null, nextText: string): void {
  if (!node) {
    return;
  }
  if (node.textContent === nextText) {
    return;
  }
  node.textContent = nextText;
}

function findPreviousUserGroup(group: HTMLElement): HTMLElement | null {
  let current = group.previousElementSibling;
  while (current) {
    if (current instanceof HTMLElement && current.classList.contains('chat-group') && current.classList.contains('user')) {
      return current;
    }
    current = current.previousElementSibling;
  }
  return null;
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
  const assistantGroups = collectAssistantMessageGroups(messages);
  if (runId) {
    const matchedGroup = assistantGroups.find((group) => group.runId === runId);
    if (matchedGroup) {
      return matchedGroup;
    }
  }
  for (let index = assistantGroups.length - 1; index >= 0; index -= 1) {
    const group = assistantGroups[index];
    if (group && group.timestamp >= startedAt) {
      return group;
    }
  }
  return null;
}

function readAssistantBillingSummary(message: unknown): RunBillingSummaryData | null {
  if (!isRecord(message)) {
    return null;
  }
  const summary = message[ICLAW_BILLING_SUMMARY_KEY];
  return isRecord(summary) ? (summary as RunBillingSummaryData) : null;
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

  return `${usageDetail} · 结算结果缺失，请排查 usage 回传或结算上报链路`;
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
  const persistedBillingByRunId = new Map<string, RunBillingSummaryData>();
  const persistedBillingByTimestamp = new Map<number, RunBillingSummaryData>();
  const persistedBillingByAssistantIndex = new Map<number, RunBillingSummaryData>();
  const usedSummaryEventIds = new Set<string>();
  sessionBillingSummaries.forEach((summary) => {
    const runId = summary.event_id?.trim();
    if (runId) {
      persistedBillingByRunId.set(runId, summary);
    }
    if (typeof summary.assistant_timestamp === 'number' && Number.isFinite(summary.assistant_timestamp)) {
      persistedBillingByTimestamp.set(summary.assistant_timestamp, summary);
    }
  });

  assistantGroups.forEach((assistantGroup, assistantGroupIndex) => {
    const summary =
      (assistantGroup.runId ? persistedBillingByRunId.get(assistantGroup.runId) ?? null : null) ||
      persistedBillingByTimestamp.get(assistantGroup.timestamp) ||
      null;
    if (!summary) {
      return;
    }
    persistedBillingByAssistantIndex.set(assistantGroupIndex, summary);
    if (summary.event_id?.trim()) {
      usedSummaryEventIds.add(summary.event_id.trim());
    }
  });

  const unmatchedSummaries = sessionBillingSummaries
    .filter((summary) => {
      const eventId = summary.event_id?.trim();
      return eventId ? !usedSummaryEventIds.has(eventId) : false;
    })
    .sort((left, right) => {
      const leftTime =
        (typeof left.assistant_timestamp === 'number' && Number.isFinite(left.assistant_timestamp)
          ? left.assistant_timestamp
          : Date.parse(left.settled_at || '')) || 0;
      const rightTime =
        (typeof right.assistant_timestamp === 'number' && Number.isFinite(right.assistant_timestamp)
          ? right.assistant_timestamp
          : Date.parse(right.settled_at || '')) || 0;
      return rightTime - leftTime;
    });

  const unmatchedAssistantIndexes = assistantGroups
    .map((_, index) => index)
    .filter((index) => !persistedBillingByAssistantIndex.has(index))
    .sort((left, right) => right - left);

  for (const assistantGroupIndex of unmatchedAssistantIndexes) {
    const assistantGroup = assistantGroups[assistantGroupIndex];
    if (!assistantGroup) {
      continue;
    }
    const candidateIndex = unmatchedSummaries.findIndex((summary) => {
      const summaryTime =
        (typeof summary.assistant_timestamp === 'number' && Number.isFinite(summary.assistant_timestamp)
          ? summary.assistant_timestamp
          : Date.parse(summary.settled_at || '')) || 0;
      if (summaryTime <= 0) {
        return false;
      }
      const delta = Math.abs(summaryTime - assistantGroup.timestamp);
      return delta <= BILLING_REHYDRATION_FALLBACK_WINDOW_MS;
    });
    if (candidateIndex < 0) {
      continue;
    }
    const [matchedSummary] = unmatchedSummaries.splice(candidateIndex, 1);
    if (matchedSummary) {
      persistedBillingByAssistantIndex.set(assistantGroupIndex, matchedSummary);
    }
  }

  const pendingAssistantIndexes = new Set<number>();
  const optimisticUsageByAssistantIndex = new Map<number, AssistantUsageSettlement>();
  pendingSettlements.forEach((pending) => {
    const terminalEvent = app ? findTerminalChatEventForRun(app, pending.sessionKey, pending.runId) : null;
    const optimisticUsage = derivePendingSettlementUsage(messages, pending, terminalEvent?.message);

    if (pending.runId) {
      const matchedIndex = assistantGroups.findIndex((group) => group.runId === pending.runId);
      if (matchedIndex >= 0) {
        if (optimisticUsage) {
          optimisticUsageByAssistantIndex.set(matchedIndex, optimisticUsage);
        }
        pendingAssistantIndexes.add(matchedIndex);
        return;
      }
    }
    for (let index = assistantGroups.length - 1; index >= 0; index -= 1) {
      const group = assistantGroups[index];
      if (group && group.timestamp >= pending.startedAt) {
        if (optimisticUsage) {
          optimisticUsageByAssistantIndex.set(index, optimisticUsage);
        }
        pendingAssistantIndexes.add(index);
        break;
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
      billingState === 'missing'
        ? 'missing'
        : pendingAssistantIndexes.has(assistantGroupIndex) || billingState === 'pending'
          ? 'pending'
          : 'missing';

    return {
      timestampLabel: formatAssistantFooterTimestamp(assistantGroup.timestamp),
      state: derivedState,
      label: derivedState === 'pending' ? '计费结算中' : '计费数据缺失',
      value: null,
      credits: null,
      inputTokens,
      outputTokens,
      tooltip: buildAssistantFooterTooltip({
        state: derivedState,
        inputTokens,
        outputTokens,
        credits: null,
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

function deriveLatestAssistantUsageSince(
  messages: unknown[],
  runId: string | null,
  startedAt: number,
): AssistantUsageSettlement | null {
  const latestAssistantGroup = findAssistantGroupForRun(messages, runId, startedAt);
  if (!latestAssistantGroup) {
    return null;
  }
  const assistantGroup = latestAssistantGroup;

  let inputTokens = 0;
  let outputTokens = 0;
  let model: string | null = null;
  let hasUsage = false;

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

  if (!hasUsage) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    model,
    timestamp: assistantGroup.timestamp,
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
  sessionTokenSnapshot?: { inputTokens: number; outputTokens: number } | null,
): AssistantUsageSettlement | null {
  const latestAssistantUsage =
    // Embedded webchat does not always retain terminal chat events, but the final
    // assistant message still carries usage in chatMessages after the run completes.
    deriveLatestAssistantUsageSince(messages, pending.runId, pending.startedAt);
  const terminalUsage = terminalEventMessage ? deriveAssistantUsageFromMessage(terminalEventMessage) : null;
  const directUsage =
    latestAssistantUsage || terminalUsage
      ? {
          inputTokens: terminalUsage?.inputTokens ?? latestAssistantUsage?.inputTokens ?? 0,
          outputTokens: terminalUsage?.outputTokens ?? latestAssistantUsage?.outputTokens ?? 0,
          model: terminalUsage?.model || latestAssistantUsage?.model || null,
          // Use the assistant message timestamp as the persisted anchor.
          timestamp: latestAssistantUsage?.timestamp ?? terminalUsage?.timestamp ?? Date.now(),
        }
      : null;
  if (directUsage) {
    return directUsage;
  }

  if (!sessionTokenSnapshot) {
    return null;
  }

  const baselineInputTokens = pending.baselineInputTokens ?? null;
  const baselineOutputTokens = pending.baselineOutputTokens ?? null;
  if (baselineInputTokens == null || baselineOutputTokens == null) {
    return null;
  }

  const inputTokens = Math.max(0, sessionTokenSnapshot.inputTokens - baselineInputTokens);
  const outputTokens = Math.max(0, sessionTokenSnapshot.outputTokens - baselineOutputTokens);
  if (inputTokens <= 0 && outputTokens <= 0) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    model: pending.model,
    timestamp: pending.startedAt,
  };
}

type TerminalChatEventMatch = {
  ts: number;
  state: 'final' | 'aborted' | 'error';
  message?: unknown;
};

function findTerminalChatEventForRun(
  app: OpenClawAppElement,
  sessionKey: string,
  runId: string,
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
    const payload = entry.payload as Record<string, unknown>;
    if (payload.runId !== runId) {
      continue;
    }
    if (typeof payload.sessionKey === 'string' && payload.sessionKey !== sessionKey) {
      continue;
    }
    const state = payload.state;
    if (state !== 'final' && state !== 'aborted' && state !== 'error') {
      continue;
    }
    return {
      ts: entry.ts,
      state,
      message: payload.message,
    };
  }

  return null;
}

function findLatestTerminalChatRunSince(
  app: OpenClawAppElement,
  sessionKey: string,
  startedAt: number,
): string | null {
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
    if (typeof payload.sessionKey === 'string' && payload.sessionKey !== sessionKey) {
      continue;
    }
    const state = payload.state;
    if (state !== 'final' && state !== 'aborted' && state !== 'error') {
      continue;
    }
    return typeof payload.runId === 'string' ? payload.runId : null;
  }

  return null;
}

function createDesktopRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `desktop-run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
      deliver: false,
      idempotencyKey: runId,
      attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
    });
  } catch (error) {
    const { message: detail, code } = resolveGatewayErrorDetail(error);
    app.chatRunId = null;
    app.chatStream = null;
    app.chatStreamStartedAt = null;
    app.lastError = detail;
    app.lastErrorCode = code;
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
  app.lastError = detail;
  app.lastErrorCode = code;
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

async function loadChatModelSnapshot(
  app: OpenClawAppElement,
  targetSessionKey: string,
  input: {
    authBaseUrl: string;
    appName: string;
  },
): Promise<{
  options: ComposerModelOption[];
  selectedModelId: string | null;
  resolvedSessionKey: string | null;
  hasPersistedHistory: boolean;
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
        limit: 200,
      }),
      MODEL_SNAPSHOT_RPC_TIMEOUT_MS,
      'gateway sessions.list',
    ),
  ]);

  const options = buildComposerModelOptions(mapRuntimeModelsToGatewayEntries(runtimeCatalog));
  const aliases = resolveEquivalentGatewaySessionKeys(targetSessionKey);
  const matchedSession =
    sessionsResult?.sessions.find((session) =>
      aliases.has(normalizeGatewaySessionKey(session.key)),
    ) ?? null;
  const sessionModel = matchedSession?.model?.trim() ?? '';
  const defaultModel = sessionsResult?.defaults?.model?.trim() ?? '';
  const resolvedSelection =
    findComposerModelOption(options, sessionModel)?.id ||
    findComposerModelOption(options, defaultModel)?.id ||
    options[0]?.id ||
    null;

  return {
    options,
    selectedModelId: resolvedSelection,
    resolvedSessionKey: matchedSession?.key?.trim() ?? null,
    hasPersistedHistory:
      Math.max(0, Number(matchedSession?.inputTokens ?? 0)) + Math.max(0, Number(matchedSession?.outputTokens ?? 0)) > 0,
  };
}

function findGatewaySessionEntry(
  sessionsResult: GatewaySessionsListResult | null | undefined,
  targetSessionKey: string,
): GatewaySessionsListResult['sessions'][number] | null {
  const aliases = resolveEquivalentGatewaySessionKeys(targetSessionKey);
  return (
    sessionsResult?.sessions.find((session) =>
      aliases.has(normalizeGatewaySessionKey(session.key)),
    ) ?? null
  );
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
    limit: 200,
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

function estimateRunGrantInputTokens(input: {
  quotedInputTokens: number | null;
  fallbackInputTokens: number;
  baselineSessionTokens: { inputTokens: number; outputTokens: number } | null;
}): number {
  const quotedInputTokens = Math.max(0, input.quotedInputTokens ?? 0);
  const fallbackInputTokens = Math.max(0, input.fallbackInputTokens);
  const baselineInputTokens = Math.max(0, input.baselineSessionTokens?.inputTokens ?? 0);
  const baselineOutputTokens = Math.max(0, input.baselineSessionTokens?.outputTokens ?? 0);
  const promptBudget = Math.max(quotedInputTokens, fallbackInputTokens, 1);
  const transcriptAwareBudget =
    baselineInputTokens +
    baselineOutputTokens +
    Math.max(4096, Math.ceil(promptBudget * 1.5));

  return Math.max(quotedInputTokens, fallbackInputTokens, transcriptAwareBudget);
}

function isSessionRenderReady(renderState: ChatSurfaceRenderState): boolean {
  if (!renderState.hasNativeInput || !renderState.nativeInputVisible) {
    return false;
  }

  if (!renderState.hasThread) {
    return true;
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
  sessionKey = 'main',
  initialPrompt = null,
  initialPromptKey = null,
  initialAgentSlug = null,
  initialSkillSlug = null,
  initialStockContext = null,
  focusTaskId = null,
  focusTaskPrompt = null,
  shellAuthenticated = false,
  creditClient,
  creditToken,
  onCreditBalanceRefresh,
  user,
  inputComposerConfig = null,
  welcomePageConfig = null,
  onInitialSkillSlugChange,
  onOpenRechargeCenter,
}: OpenClawChatSurfaceProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<OpenClawAppElement | null>(null);
  const composerRef = useRef<RichChatComposerHandle | null>(null);
  const reconnectKeyRef = useRef<string | null>(null);
  const initialScrollScheduledRef = useRef(false);
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
  const activeRecentTaskRunRef = useRef<ActiveRecentTaskRun | null>(null);
  const pendingUsageSettlementsRef = useRef<PendingUsageSettlement[]>([]);
  const [status, setStatus] = useState<ChatSurfaceStatus>({
    busy: false,
    connected: false,
    lastError: null,
    lastErrorCode: null,
  });
  const [renderState, setRenderState] = useState<ChatSurfaceRenderState>({
    hostHeight: 0,
    hasNativeInput: false,
    nativeInputVisible: false,
    nativeInputHeight: 0,
    hasThread: false,
    threadVisible: false,
    threadHeight: 0,
    groupCount: 0,
    chatMessageCount: 0,
  });
  const [showConnectionCard, setShowConnectionCard] = useState(false);
  const [showRenderDiagnosticsCard, setShowRenderDiagnosticsCard] = useState(false);
  const [rechargeNoticeDismissed, setRechargeNoticeDismissed] = useState(false);
  const [initialSurfaceRestorePending, setInitialSurfaceRestorePending] = useState(shellAuthenticated);
  const [hasBootSettled, setHasBootSettled] = useState(false);
  const [sessionHistoryState, setSessionHistoryState] = useState<SessionHistoryState>(
    shellAuthenticated ? 'unknown' : 'empty',
  );
  const [unhandledGatewayError, setUnhandledGatewayError] = useState<UnhandledGatewayError | null>(null);
  const [lastRpcFailure, setLastRpcFailure] = useState<GatewayRpcFailure | null>(null);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(null);
  const [modelOptions, setModelOptions] = useState<ComposerModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [resolvedModelSessionKey, setResolvedModelSessionKey] = useState<string | null>(null);
  const [shellDropActive, setShellDropActive] = useState(false);
  const [shellDropSummary, setShellDropSummary] = useState<DraggedFileSummary | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelSwitching, setModelSwitching] = useState(false);
  const [sessionTransitionVisible, setSessionTransitionVisible] = useState(false);
  const [composerDraft, setComposerDraft] = useState<ComposerDraftPayload | null>(null);
  const [assistantFooterVersion, setAssistantFooterVersion] = useState(0);
  const [sessionBillingSummaries, setSessionBillingSummaries] = useState<RunBillingSummaryData[]>([]);
  const [pendingSettlementCount, setPendingSettlementCount] = useState(0);
  const [creditEstimate, setCreditEstimate] = useState<ComposerCreditEstimateState>({
    loading: false,
    low: null,
    high: null,
    error: null,
    estimatedInputTokens: null,
    estimatedOutputTokens: null,
  });
  const effectiveGatewaySessionKey = resolvedModelSessionKey || sessionKey;
  const [installedLobsterAgents, setInstalledLobsterAgents] = useState<ComposerAgentOption[]>([]);
  const [skillOptions, setSkillOptions] = useState<ComposerSkillOption[]>([]);
  const consumedInitialPromptKeyRef = useRef<string | null>(null);
  const statusLogRef = useRef<string | null>(null);
  const rpcLogRef = useRef<string | null>(null);
  const unhandledLogRef = useRef<string | null>(null);
  const selectionMenuRef = useRef<HTMLDivElement | null>(null);
  const modelLoadVersionRef = useRef(0);
  const messageActionTimersRef = useRef<number[]>([]);
  const previousSessionKeyRef = useRef(sessionKey);
  const sessionTransitionPendingRef = useRef(false);
  const sessionTransitionStartedAtRef = useRef(0);
  const responseUsageEnabledSessionKeyRef = useRef<string | null>(null);
  const sessionTransitionHideTimerRef = useRef<number | null>(null);
  const connectionLossTimerRef = useRef<number | null>(null);
  const pendingConnectionLossStatusRef = useRef<ChatSurfaceStatus>({
    busy: false,
    connected: false,
    lastError: null,
    lastErrorCode: null,
  });
  const hasObservedHistory =
    renderState.groupCount > 0 || renderState.chatMessageCount > 0 || Boolean(appRef.current?.chatMessages?.length);

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

  const mergeSessionBillingSummary = useCallback((summary: RunBillingSummaryData) => {
    setSessionBillingSummaries((current) => mergeRunBillingSummaries(current, [summary]));
  }, []);

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
    candidate.click();
    return true;
  }, []);

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
      });
      if (!snapshot || modelLoadVersionRef.current !== requestVersion) {
        return false;
      }

      setModelOptions(snapshot.options);
      setSelectedModelId(snapshot.selectedModelId);
      setResolvedModelSessionKey(snapshot.resolvedSessionKey);
      setSessionHistoryState(snapshot.hasPersistedHistory ? 'has-history' : 'empty');
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
  }, [appName, authBaseUrl, sessionKey]);

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

        if (code === '403' || detailCode !== null || message.toLowerCase().includes('forbidden')) {
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
      setModelSwitching(true);
      setSelectedModelId(nextModelId);

      try {
        const patchTargets = buildGatewaySessionPatchTargets(sessionKey, resolvedModelSessionKey);
        await Promise.all(
          patchTargets.map((key) =>
            request('sessions.patch', {
              key,
              model: nextModelId,
            }),
          ),
        );
        await refreshModelCatalog();
        setSelectedModelId((current) => current || nextModelId);
      } catch (error) {
        setSelectedModelId(previousModelId);
        const message = error instanceof Error ? error.message : '模型切换失败';
        setStatus((current) => ({
          ...current,
          lastError: message,
        }));
      } finally {
        setModelSwitching(false);
      }
    },
    [refreshModelCatalog, resolvedModelSessionKey, selectedModelId, sessionKey],
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

  useEffect(() => {
    if (previousSessionKeyRef.current === sessionKey) {
      return;
    }

    previousSessionKeyRef.current = sessionKey;
    sessionTransitionPendingRef.current = true;
    sessionTransitionStartedAtRef.current = performance.now();
    clearSessionTransitionTimer();
    setSessionTransitionVisible(true);
    closeSelectionMenu();
  }, [clearSessionTransitionTimer, closeSelectionMenu, sessionKey]);

  useEffect(() => {
    if (pendingUsageSettlementsRef.current.length > 0) {
      console.warn('[desktop] drop pending credit settlements because session changed', pendingUsageSettlementsRef.current);
    }
    artifactAutoOpenStateRef.current = {
      lastBusy: false,
      runSequence: 0,
      pendingRunSequence: null,
      pendingScanCount: 0,
      lastOpenedToken: null,
    };
    activeRecentTaskRunRef.current = null;
    pendingUsageSettlementsRef.current = [];
    setPendingSettlementCount(0);
    clearArtifactAutoOpenTimers();
    clearUsageSettlementTimers();
    modelLoadVersionRef.current += 1;
    setModelsLoading(true);
    setModelSwitching(false);
    setComposerDraft(null);
    setSessionBillingSummaries([]);
    setAssistantFooterVersion((current) => current + 1);
    setCreditEstimate({
      loading: false,
      low: null,
      high: null,
      error: null,
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
    });
  }, [clearArtifactAutoOpenTimers, clearUsageSettlementTimers, sessionKey]);

  useEffect(() => {
    if (!creditClient || !creditToken) {
      setSessionBillingSummaries([]);
      return;
    }

    let cancelled = false;
    void creditClient
      .listRunBillingSummariesBySession(creditToken, {
        sessionKey,
        limit: 200,
      })
      .then((summaries) => {
        if (cancelled) {
          return;
        }
        setSessionBillingSummaries((current) =>
          mergeRunBillingSummaries(current, Array.isArray(summaries) ? summaries : []),
        );
        setAssistantFooterVersion((current) => current + 1);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [creditClient, creditToken, sessionKey]);

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
      const historyMessages = estimateHistoryMessagesFromGroups(renderState.groupCount);
      void creditClient
        .creditsQuote(creditToken, {
          message: prompt,
          model: selectedModelId || undefined,
          appName,
          historyMessages,
          hasTools: true,
          attachments: attachmentItems.map((item) => ({
            type: item.type,
          })),
        })
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
  }, [appName, composerDraft, creditClient, creditToken, renderState.groupCount, selectedModelId]);

  useEffect(() => {
    if (!creditClient || !creditToken) {
      setInstalledLobsterAgents([]);
      setSkillOptions([]);
      return;
    }

    let cancelled = false;
    void loadLobsterAgents({
      client: creditClient,
      accessToken: creditToken,
    })
      .then((lobsterAgents) => {
        if (cancelled) {
          return;
        }

        setInstalledLobsterAgents(
          lobsterAgents
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
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setInstalledLobsterAgents([]);
      });

    void loadSkillStoreCatalog({
      client: creditClient,
      accessToken: creditToken,
    })
      .then((skills) => {
        if (cancelled) {
          return;
        }
        setSkillOptions(
          skills
            .filter((skill) => skill.enabled && (skill.installed || skill.userInstalled || skill.source === 'bundled'))
            .map((skill) => ({
              slug: skill.slug,
              name: skill.name,
              market: skill.market,
              skillType: skill.skillType,
              categoryLabel: skill.categoryLabel,
            })),
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setSkillOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [creditClient, creditToken]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    clearOpenClawEmbeddedState(gatewayUrl);

    const app = document.createElement('openclaw-app') as OpenClawAppElement;
    const settings = buildSettings({ gatewayUrl, gatewayToken, sessionKey });

    app.applySettings(settings);
    app.password = gatewayPassword?.trim() ?? '';
    app.sessionKey = sessionKey;
    app.tab = 'chat';

    appRef.current = app;
    host.replaceChildren(app);

    return () => {
      if (appRef.current === app) {
        appRef.current = null;
      }
      host.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app) {
      return;
    }

    const settings = buildSettings({ gatewayUrl, gatewayToken, sessionKey });
    app.applySettings(settings);
    app.password = gatewayPassword?.trim() ?? '';
    app.sessionKey = sessionKey;
    app.tab = 'chat';

    const reconnectKey = JSON.stringify({
      gatewayUrl,
      gatewayToken: gatewayToken?.trim() ?? '',
      gatewayPassword: gatewayPassword?.trim() ?? '',
      sessionKey,
    });
    if (reconnectKeyRef.current === null) {
      reconnectKeyRef.current = reconnectKey;
      return;
    }
    if (reconnectKeyRef.current !== reconnectKey) {
      reconnectKeyRef.current = reconnectKey;
      initialScrollScheduledRef.current = false;
      app.connect();
    }
  }, [gatewayPassword, gatewayToken, gatewayUrl, sessionKey]);

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
      const looksRelevant =
        code === '403' ||
        detailCode !== null ||
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

    rewriteReferenceMarkers();
    const observer = new MutationObserver(() => {
      rewriteReferenceMarkers();
    });
    observer.observe(host, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (artifactAutoOpenStateRef.current.pendingRunSequence == null) {
        return;
      }
      queueArtifactAutoOpenScan(90);
    });
    observer.observe(host, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
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

    const resolveActiveThread = () => {
      const threads = Array.from(
        shell.querySelectorAll<HTMLElement>('.openclaw-chat-surface .chat-thread'),
      );
      return (
        threads.find((thread) => {
          const rect = thread.getBoundingClientRect();
          return rect.height > 0 && rect.width > 0;
        }) ?? null
      );
    };

    const updateComposerHeight = () => {
      const composer = shell.querySelector('.iclaw-composer') as HTMLElement | null;
      const thread = resolveActiveThread();
      const composerHeight = composer?.getBoundingClientRect().height ?? 0;
      const overlap =
        composer && thread
          ? Math.max(0, thread.getBoundingClientRect().bottom - composer.getBoundingClientRect().top)
          : 0;
      shell.style.setProperty('--iclaw-composer-height', `${Math.ceil(composerHeight)}px`);
      shell.style.setProperty('--iclaw-thread-bottom-gap', `${Math.ceil(overlap + 24)}px`);
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

    updateComposerHeight();
    const observer = new ResizeObserver(() => {
      updateComposerHeight();
    });
    const composer = shell.querySelector<HTMLElement>('.iclaw-composer');
    const thread = resolveActiveThread();
    if (composer) {
      observer.observe(composer);
    }
    if (thread) {
      observer.observe(thread);
    }

    const handleShellWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          '.iclaw-composer__mention-menu, .iclaw-composer__model-menu, .iclaw-composer__selector-menu, .iclaw-composer__floating-menu',
        )
      ) {
        return;
      }

      const editor = target?.closest('.iclaw-composer__editor') as HTMLElement | null;
      if (canElementConsumeWheel(editor, event.deltaY)) {
        return;
      }

      const activeThread = resolveActiveThread();
      if (!activeThread || activeThread.scrollHeight <= activeThread.clientHeight) {
        return;
      }
      if (target?.closest('.chat-thread') && canElementConsumeWheel(activeThread, event.deltaY)) {
        activeThread.scrollTop = Math.max(
          0,
          Math.min(
            activeThread.scrollHeight - activeThread.clientHeight,
            activeThread.scrollTop + event.deltaY,
          ),
        );
        event.preventDefault();
        return;
      }

      const maxScrollTop = activeThread.scrollHeight - activeThread.clientHeight;
      const nextScrollTop = Math.max(0, Math.min(maxScrollTop, activeThread.scrollTop + event.deltaY));
      if (Math.abs(nextScrollTop - activeThread.scrollTop) < 1) {
        return;
      }

      activeThread.scrollTop = nextScrollTop;
      event.preventDefault();
    };

    shell.addEventListener('wheel', handleShellWheel, {passive: false});
    window.addEventListener('resize', updateComposerHeight);

    return () => {
      observer.disconnect();
      shell.removeEventListener('wheel', handleShellWheel);
      window.removeEventListener('resize', updateComposerHeight);
    };
  }, [status.connected, status.busy]);

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
    const timer = window.setInterval(() => {
      const app = appRef.current;
      const host = hostRef.current;
      if (!app || !host) {
        return;
      }

      ensureWrappedClientRequest(app);

      const nextStatus: ChatSurfaceStatus = {
        busy: Boolean(app.chatSending || app.chatRunId),
        connected: Boolean(app.connected),
        lastError: app.lastError ?? null,
        lastErrorCode: app.lastErrorCode ?? null,
      };
      const nativeInput = host.querySelector('.agent-chat__input, .chat-compose');
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
          current.connected === true &&
          current.lastError === nextStatus.lastError &&
          current.lastErrorCode === nextStatus.lastErrorCode
            ? current
            : {
                busy: nextStatus.busy,
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
        current.lastError === (nextStatus.lastError ?? current.lastError) &&
        current.lastErrorCode === (nextStatus.lastErrorCode ?? current.lastErrorCode)
          ? current
          : {
              busy: nextStatus.busy,
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
          current.connected === false &&
          current.lastError === pending.lastError &&
          current.lastErrorCode === pending.lastErrorCode
            ? current
            : {
                busy: pending.busy,
                connected: false,
                lastError: pending.lastError,
                lastErrorCode: pending.lastErrorCode,
              },
        );
      }, CONNECTION_LOSS_GRACE_MS);
    }, STATUS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      clearConnectionLossTimer();
    };
  }, [clearConnectionLossTimer, ensureWrappedClientRequest]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !status.connected || initialScrollScheduledRef.current) {
      return;
    }
    initialScrollScheduledRef.current = true;

    const delays = [0, 180, 700, 1500];
    const timers = delays.map((delay) =>
      window.setTimeout(() => {
        app.scrollToBottom({ smooth: delay > 0 });
      }, delay),
    );

    return () => {
      clearArtifactAutoOpenTimers();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [clearArtifactAutoOpenTimers, status.connected]);

  useEffect(() => {
    if (!shellAuthenticated) {
      setInitialSurfaceRestorePending(false);
      setSessionHistoryState('empty');
      return;
    }
    setInitialSurfaceRestorePending(true);
    setSessionHistoryState('unknown');
  }, [sessionKey, shellAuthenticated]);

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
    if (!hasObservedHistory || sessionHistoryState === 'has-history') {
      return;
    }
    setSessionHistoryState('has-history');
  }, [hasObservedHistory, sessionHistoryState]);

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

  useEffect(() => {
    const bootStillSettling =
      initialSurfaceRestorePending ||
      !hasBootSettled ||
      (shellAuthenticated && sessionHistoryState === 'unknown' && !hasObservedHistory);

    if ((sessionTransitionVisible || bootStillSettling) && !status.lastError) {
      setShowConnectionCard(false);
      return;
    }

    if (status.connected) {
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
    hasBootSettled,
    hasObservedHistory,
    initialSurfaceRestorePending,
    sessionHistoryState,
    sessionTransitionVisible,
    shellAuthenticated,
    status.connected,
    status.lastError,
  ]);

  useEffect(() => {
    const threadReady = renderState.hasThread && renderState.threadVisible;
    if (
      initialSurfaceRestorePending ||
      sessionTransitionVisible ||
      !shellAuthenticated ||
      !status.connected ||
      threadReady
    ) {
      setShowRenderDiagnosticsCard(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowRenderDiagnosticsCard(true);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    renderState.hasNativeInput,
    renderState.hasThread,
    renderState.nativeInputVisible,
    renderState.threadVisible,
    initialSurfaceRestorePending,
    shellAuthenticated,
    sessionTransitionVisible,
    status.connected,
  ]);

  useEffect(() => {
    if (!sessionTransitionPendingRef.current) {
      return;
    }

    const ready =
      status.connected &&
      !modelsLoading &&
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

  const hasGatewayAuth = Boolean((gatewayToken ?? '').trim() || (gatewayPassword ?? '').trim());
  const connectionMessage = status.lastError
    ? status.lastError
    : hasGatewayAuth
      ? '正在连接 OpenClaw 网关…'
      : '缺少本地网关凭据，当前无法连接 OpenClaw。';
  const waitingForHistoryResolution =
    shellAuthenticated && sessionHistoryState === 'unknown' && !hasObservedHistory;
  const showBootMask =
    shellAuthenticated &&
    !status.lastError &&
    ((!hasBootSettled && (!status.connected || initialSurfaceRestorePending)) || waitingForHistoryResolution);
  const showSessionTransitionMask = sessionTransitionVisible && !showBootMask;
  const shellTransitioning = showBootMask || showSessionTransitionMask;
  const secureContextHint =
    typeof window !== 'undefined' && !window.isSecureContext
      ? '当前页面不是安全上下文，OpenClaw 可能会拒绝设备身份校验。'
      : null;
  const authRole = appRef.current?.hello?.auth?.role ?? null;
  const authScopes = appRef.current?.hello?.auth?.scopes ?? null;
  const showRechargeCtaCard =
    status.connected && status.lastErrorCode === 'INSUFFICIENT_CREDITS' && !rechargeNoticeDismissed;

  useEffect(() => {
    if (status.lastErrorCode !== 'INSUFFICIENT_CREDITS') {
      setRechargeNoticeDismissed(false);
    }
  }, [status.lastErrorCode]);

  useEffect(() => {
    window.__ICLAW_OPENCLAW_DIAGNOSTICS__ = {
      connected: status.connected,
      lastError: status.lastError,
      lastErrorCode: status.lastErrorCode,
      selectedModelId,
      resolvedModelSessionKey,
      modelOptions: modelOptions.map((option) => option.id),
      modelsLoading,
      modelSwitching,
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
    renderState,
    resolvedModelSessionKey,
    selectedModelId,
    shellAuthenticated,
    status.connected,
    status.lastError,
    status.lastErrorCode,
    unhandledGatewayError,
  ]);

  const renderDiagnosticsMessage = (() => {
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

  const finalizeRecentTaskRun = useCallback(() => {
    const activeRun = activeRecentTaskRunRef.current;
    if (!activeRun) {
      return;
    }

    const artifacts = collectLatestArtifactKinds(hostRef.current);
    if (activeRun.failureMessage) {
      markRecentTaskFailed({
        id: activeRun.taskId,
        artifacts,
        error: activeRun.failureMessage,
      });
    } else {
      markRecentTaskCompleted({
        id: activeRun.taskId,
        artifacts,
      });
    }

    activeRecentTaskRunRef.current = null;
  }, []);

  const attemptPendingUsageSettlement = useCallback(async (): Promise<boolean> => {
    const app = appRef.current;
    const pendings = pendingUsageSettlementsRef.current;
    if (pendings.length === 0 || !app || !creditClient || !creditToken) {
      return false;
    }

    const remaining: PendingUsageSettlement[] = [];
    let settledAny = false;
    let shouldRefreshBalance = false;
    let shouldRefreshFooter = false;

    for (const pending of pendings) {
      const terminalEvent = findTerminalChatEventForRun(app, pending.sessionKey, pending.runId);
      if (terminalEvent) {
        pending.terminalState = terminalEvent.state;
      }

      const tryLoadBillingSummary = async (): Promise<boolean> => {
        try {
          const billingSummary = await creditClient.getRunBillingSummary(creditToken, pending.grantId);
          annotateAssistantGroup(app.chatMessages, pending.runId, pending.startedAt, {
            billingSummary,
            billingState: 'charged',
          });
          mergeSessionBillingSummary(billingSummary);
          settledAny = true;
          shouldRefreshBalance = true;
          shouldRefreshFooter = true;
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

      const sessionTokenSnapshot = await loadGatewaySessionTokenSnapshot(app, pending.sessionKey);
      const usage = derivePendingSettlementUsage(
        app.chatMessages,
        pending,
        terminalEvent?.message,
        sessionTokenSnapshot,
      );

      if (!usage) {
        pending.attempts += 1;
        if (pending.terminalState === 'error') {
          console.warn('[desktop] skip credit settlement because run ended with error', pending);
          annotateAssistantGroup(app.chatMessages, pending.runId, pending.startedAt, {
            billingState: 'missing',
          });
          shouldRefreshFooter = true;
          continue;
        }
        if (
          pending.terminalState !== 'pending' &&
          Date.now() - pending.startedAt >= USAGE_SETTLEMENT_TERMINAL_GRACE_MS
        ) {
          annotateAssistantGroup(app.chatMessages, pending.runId, pending.startedAt, {
            billingState: 'missing',
          });
          shouldRefreshFooter = true;
          continue;
        }
        if (Date.now() >= pending.expiresAt) {
          console.warn('[desktop] mark billing as missing because assistant usage was not found before expiry', pending);
          annotateAssistantGroup(app.chatMessages, pending.runId, pending.startedAt, {
            billingState: 'missing',
          });
          shouldRefreshFooter = true;
          continue;
        }
        remaining.push(pending);
        continue;
      }

      try {
        const result = await creditClient.reportUsageEvent({
          token: creditToken,
          eventId: pending.runId,
          grantId: pending.grantId,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          model: usage.model || pending.model || undefined,
          appName,
          assistantTimestamp: usage.timestamp,
        });
        annotateAssistantGroup(app.chatMessages, pending.runId, pending.startedAt, {
          billingSummary: result.billing_summary,
          billingState: 'charged',
        });
        mergeSessionBillingSummary(result.billing_summary);
        settledAny = true;
        shouldRefreshBalance = true;
        shouldRefreshFooter = true;
      } catch (error) {
        pending.attempts += 1;
        console.error('[desktop] failed to report usage event', {
          runId: pending.runId,
          grantId: pending.grantId,
          error,
        });
        if (await tryLoadBillingSummary()) {
          continue;
        }
        if (Date.now() >= pending.expiresAt) {
          annotateAssistantGroup(app.chatMessages, pending.runId, pending.startedAt, {
            billingState: 'missing',
          });
          shouldRefreshFooter = true;
          continue;
        }
        remaining.push(pending);
      }
    }

    pendingUsageSettlementsRef.current = remaining;
    setPendingSettlementCount(remaining.length);
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
  }, [appName, clearUsageSettlementTimers, creditClient, creditToken, mergeSessionBillingSummary, onCreditBalanceRefresh]);

  useEffect(() => {
    if (status.busy || !activeRecentTaskRunRef.current) {
      return;
    }

    finalizeRecentTaskRun();
  }, [finalizeRecentTaskRun, status.busy]);

  useEffect(() => {
    if (status.busy || pendingSettlementCount === 0) {
      return;
    }

    clearUsageSettlementTimers();
    void attemptPendingUsageSettlement();
    const timer = window.setInterval(() => {
      void attemptPendingUsageSettlement();
    }, USAGE_SETTLEMENT_RETRY_INTERVAL_MS);
    usageSettlementTimersRef.current.push(timer);

    return () => {
      clearUsageSettlementTimers();
    };
  }, [attemptPendingUsageSettlement, clearUsageSettlementTimers, pendingSettlementCount, status.busy]);

  useEffect(() => {
    const activeRun = activeRecentTaskRunRef.current;
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

  const handleSend = useCallback(async (payload: ComposerSendPayload): Promise<boolean> => {
    const app = appRef.current;
    const request = app?.client?.request;
    if (!app?.connected || typeof request !== 'function') {
      setStatus((current) => ({
        ...current,
        lastError: app?.lastError ?? '尚未连接到 OpenClaw 网关，请稍等或重新进入页面。',
      }));
      return false;
    }

    const promptToSend = buildSkillScopedPrompt(payload);
    const normalizedPrompt = promptToSend.trim();
    if (normalizedPrompt.startsWith('/') && payload.imageAttachments.length === 0) {
      try {
        app.chatMessage = normalizedPrompt;
        app.chatAttachments = [];
        await app.handleSendChat();
        app.scrollToBottom();
        return true;
      } catch (error) {
        const detail = error instanceof Error ? error.message : '任务发送失败';
        setStatus((current) => ({
          ...current,
          lastError: detail,
        }));
        return false;
      }
    }

    const task = startRecentTask({
      prompt: payload.prompt,
      sessionKey,
    });

    activeRecentTaskRunRef.current = {
      taskId: task.id,
      baselineError: status.lastError,
      failureMessage: null,
    };

    let runId: string | null = null;
    let handoffStarted = false;

    try {
      if (!creditClient || !creditToken) {
        throw new Error('当前账号龙虾币鉴权尚未就绪，暂时不能发送消息。');
      }

      clearUsageSettlementTimers();

      runId = createDesktopRunId();
      const startedAt = Date.now();
      const fallbackEstimatedInputTokens =
        Math.max(0, Math.ceil(normalizedPrompt.length * 0.75)) + payload.imageAttachments.length * 220;
      const baselineSessionTokens = await loadGatewaySessionTokenSnapshot(app, effectiveGatewaySessionKey);
      const runGrant = await creditClient.authorizeRun({
        token: creditToken,
        sessionKey: effectiveGatewaySessionKey,
        client: 'desktop',
        estimatedInputTokens: estimateRunGrantInputTokens({
          quotedInputTokens: creditEstimate.estimatedInputTokens ?? null,
          fallbackInputTokens: fallbackEstimatedInputTokens,
          baselineSessionTokens,
        }),
        estimatedOutputTokens: Math.max(0, creditEstimate.estimatedOutputTokens ?? 0),
        model: selectedModelId || undefined,
        appName,
      });

      stageOutgoingChatMessage({
        app,
        prompt: normalizedPrompt,
        imageAttachments: payload.imageAttachments,
        runId,
        startedAt,
      });
      app.scrollToBottom();

      pendingUsageSettlementsRef.current = [
        ...pendingUsageSettlementsRef.current,
        {
          runId,
          grantId: runGrant.grant_id,
          sessionKey: effectiveGatewaySessionKey,
          startedAt,
          expiresAt: startedAt + USAGE_SETTLEMENT_MAX_WAIT_MS,
          model: selectedModelId,
          baselineInputTokens: baselineSessionTokens?.inputTokens ?? null,
          baselineOutputTokens: baselineSessionTokens?.outputTokens ?? null,
          attempts: 0,
          terminalState: 'pending',
        },
      ];
      setPendingSettlementCount(pendingUsageSettlementsRef.current.length);

      handoffStarted = true;
      await sendAuthorizedChatMessage({
        app,
        sessionKey: effectiveGatewaySessionKey,
        prompt: normalizedPrompt,
        imageAttachments: payload.imageAttachments,
        runId,
        startedAt,
      });
      app.scrollToBottom();
      window.setTimeout(() => app.scrollToBottom({ smooth: true }), 180);
      window.setTimeout(() => app.scrollToBottom({ smooth: true }), 900);
      window.setTimeout(() => {
        const latestApp = appRef.current;
        if (!activeRecentTaskRunRef.current) {
          return;
        }
        if (!latestApp?.chatSending && !latestApp?.chatRunId) {
          finalizeRecentTaskRun();
        }
      }, 420);
      return true;
    } catch (error) {
      const { message: detail, code } = resolveGatewayErrorDetail(error);
      if (code === 'INSUFFICIENT_CREDITS') {
        setRechargeNoticeDismissed(false);
      }
      if (runId) {
        pendingUsageSettlementsRef.current = pendingUsageSettlementsRef.current.filter(
          (pending) => pending.runId !== runId,
        );
      }
      if (!handoffStarted) {
        markOutgoingChatFailed({ app, detail, code });
      }
      setPendingSettlementCount(pendingUsageSettlementsRef.current.length);
      if (pendingUsageSettlementsRef.current.length === 0) {
        clearUsageSettlementTimers();
      }
      markRecentTaskFailed({
        id: task.id,
        artifacts: collectLatestArtifactKinds(hostRef.current),
        error: detail,
      });
      activeRecentTaskRunRef.current = null;
      setStatus((current) => ({
        ...current,
        lastError: detail,
        lastErrorCode: code,
      }));
      return false;
    }
  }, [
    clearUsageSettlementTimers,
    collectLatestArtifactKinds,
    creditClient,
    creditEstimate.estimatedInputTokens,
    creditEstimate.estimatedOutputTokens,
    creditToken,
    finalizeRecentTaskRun,
    appName,
    selectedModelId,
    effectiveGatewaySessionKey,
    status.lastError,
  ]);

  const handleAbort = useCallback(async () => {
    await appRef.current?.handleAbortChat();
    if (activeRecentTaskRunRef.current) {
      activeRecentTaskRunRef.current.failureMessage = '任务已中止';
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

  const showWelcomePage =
    !initialSurfaceRestorePending &&
    !hasObservedHistory &&
    sessionHistoryState === 'empty' &&
    !showRenderDiagnosticsCard &&
    !showConnectionCard &&
    !showBootMask &&
    !showSessionTransitionMask &&
    !status.busy &&
    welcomePageConfig?.enabled !== false &&
    renderState.groupCount === 0;

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
      let inAssistantTurn = false;

      groups.forEach((group) => {
        if (group.hasAttribute('hidden')) {
          group.classList.remove('iclaw-chat-group--continued');
          return;
        }

        const isUser = group.classList.contains('user');
        const isAssistantSide =
          !isUser &&
          (group.classList.contains('assistant') ||
            group.classList.contains('tool') ||
            group.classList.contains('other'));

        if (isUser) {
          inAssistantTurn = false;
          group.classList.remove('iclaw-chat-group--continued');
          return;
        }

        if (!isAssistantSide) {
          group.classList.remove('iclaw-chat-group--continued');
          return;
        }

        if (!inAssistantTurn) {
          group.classList.remove('iclaw-chat-group--continued');
          inAssistantTurn = true;
          return;
        }

        group.classList.add('iclaw-chat-group--continued');
      });
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

    const ensureAssistantFooter = (group: HTMLElement, footerMeta: AssistantFooterMeta | null) => {
      const messages = group.querySelector('.chat-group-messages') as HTMLElement | null;
      if (!messages) {
        return;
      }

      const assistantText = extractChatGroupText(group);
      const promptText = extractChatGroupText(findPreviousUserGroup(group));
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
              <button type="button" class="iclaw-chat-assistant-toolbar__btn" data-action="like" aria-label="点赞" title="点赞">${MESSAGE_ACTION_ICONS.thumbsUp}</button>
              <button type="button" class="iclaw-chat-assistant-toolbar__btn" data-action="dislike" aria-label="点踩" title="点踩">${MESSAGE_ACTION_ICONS.thumbsDown}</button>
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
            } else {
              target.dataset.active = 'true';
              opposite?.removeAttribute('data-active');
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
            const nextPrompt = extractChatGroupText(findPreviousUserGroup(group));
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
      if (regenerateButton) {
        regenerateButton.disabled = status.busy || !promptText;
      }
    };

    const decorateChatGroups = () => {
      const assistantFooterMetas = deriveAssistantFooterMetas(
        appRef.current?.chatMessages ?? [],
        pendingUsageSettlementsRef.current,
        sessionBillingSummaries,
        appRef.current,
        status.busy,
      );
      const groups = Array.from(host.querySelectorAll('.chat-group')).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      );
      let assistantIndex = 0;

      groups.forEach((group) => {
        normalizeUserGroupClass(group);
        normalizeToolCards(group);
      });

      normalizeAssistantTurnGroups(groups);

      groups.forEach((group, groupIndex) => {

        if (group.classList.contains('user')) {
          ensureUserCopyButton(group);
          return;
        }

        if (group.classList.contains('assistant')) {
          const footerMeta = assistantFooterMetas[assistantIndex] ?? null;
          const shouldShowFooter = isTerminalAssistantTurnGroup(groups, groupIndex);
          if (shouldShowFooter) {
            ensureAssistantFooter(group, footerMeta);
          } else {
            clearAssistantFooter(group);
          }
          assistantIndex += 1;
          return;
        }

        clearAssistantFooter(group);
      });
    };

    decorateChatGroups();

    const observer = new MutationObserver(() => {
      decorateChatGroups();
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
        {showRenderDiagnosticsCard ? (
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

        {!status.connected && showConnectionCard ? (
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
                title="龙虾币余额不足，当前消息已被拦截"
                description={status.lastError || '请先前往充值中心充值后再继续发送。'}
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
            ref={shellRef}
            className="openclaw-chat-surface-shell h-full flex-1 overflow-hidden"
            data-session-transitioning={shellTransitioning ? 'true' : 'false'}
          >
            <div ref={hostRef} className="openclaw-chat-surface h-full min-h-0 flex-1 overflow-hidden" />

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

            {shellDropActive ? (
              <div className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-[30px] border border-[color:color-mix(in_srgb,var(--brand-primary)_30%,rgba(255,255,255,0.48))] bg-[color:color-mix(in_srgb,var(--chat-surface-panel)_72%,rgba(255,255,255,0.28)_28%)] backdrop-blur-[14px] shadow-[0_24px_60px_rgba(26,22,18,0.16)]">
                <div className="flex max-w-[420px] flex-col items-center gap-3 px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-[color:color-mix(in_srgb,var(--brand-primary)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white_88%)] text-[var(--brand-primary)] shadow-[0_14px_30px_rgba(0,0,0,0.08)]">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <div className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                    {dropTitle}
                  </div>
                  <div className="text-[13px] leading-6 text-[var(--text-secondary)]">
                    {dropDescription}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 text-[12px]">
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

            <RichChatComposer
              authBaseUrl={authBaseUrl}
              ref={composerRef}
              connected={status.connected}
              busy={status.busy}
              dropActive={shellDropActive}
              sessionTransitioning={shellTransitioning}
              lobsterAgents={installedLobsterAgents}
              skillOptions={skillOptions}
              initialSelectedAgentSlug={initialAgentSlug}
              initialSelectedSkillSlug={initialSkillSlug}
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
              onSelectedSkillSlugChange={onInitialSkillSlugChange}
              onSend={handleSend}
              onAbort={handleAbort}
            />

            {showRenderDiagnosticsCard ? (
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

            {selectionMenu ? (
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
            ) : null}
          </div>
        </div>
      </div>
    </PageSurface>
  );
}
