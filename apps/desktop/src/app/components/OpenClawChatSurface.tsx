import {
  Copy,
  MessageCircleQuestionMark,
  MessageSquarePlus,
  RefreshCw,
  ScrollText,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreditQuoteData, IClawClient } from '@iclaw/sdk';
import '@openclaw-ui/main.ts';
import {
  normalizeMessage,
  normalizeRoleForGrouping,
} from '@openclaw-ui/ui/chat/message-normalizer.ts';
import './openclaw-chat-surface.css';
import { Button } from '@/app/components/ui/Button';
import { EmptyStatePanel } from '@/app/components/ui/EmptyStatePanel';
import { PageSurface } from '@/app/components/ui/PageLayout';
import { readAppLocale } from '@/app/lib/general-preferences';
import {
  buildComposerModelOptions,
  type ComposerModelOption,
  type GatewayModelCatalogEntry,
} from '../lib/model-catalog';
import {
  buildGeneratedUserAvatarDataUrl,
  resolveUserAvatarUrl,
  type AppUserAvatarSource,
} from '../lib/user-avatar';
import {
  loadLobsterAgents,
  type LobsterAgent,
} from '../lib/lobster-store';
import {
  inferRecentTaskArtifactsFromText,
  markRecentTaskCompleted,
  markRecentTaskFailed,
  startRecentTask,
} from '../lib/recent-tasks';
import {
  RichChatComposer,
  type ComposerDraftPayload,
  type ComposerSendPayload,
  type OpenClawImageAttachment,
  type RichChatComposerHandle,
} from './RichChatComposer';

declare global {
  interface Window {
    __ICLAW_OPENCLAW_DIAGNOSTICS__?: Record<string, unknown>;
  }
}

type OpenClawTheme = 'system' | 'light' | 'dark';

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
  sessionKey?: string;
  initialPrompt?: string | null;
  initialPromptKey?: string | null;
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
};

type ComposerCreditEstimateState = {
  loading: boolean;
  low: number | null;
  high: number | null;
  error: string | null;
  estimatedInputTokens: number | null;
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
};

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
const CREDIT_INPUT_COST_PER_1K = 1;
const CREDIT_OUTPUT_COST_PER_1K = 2;
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

type AssistantFooterMeta = {
  timestampLabel: string;
  credits: number;
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
  }>;
};

const MESSAGE_ACTION_FEEDBACK_MS = 1600;
const USAGE_SETTLEMENT_RETRY_INTERVAL_MS = 1500;
const USAGE_SETTLEMENT_MAX_WAIT_MS = 60_000;
const MESSAGE_ACTION_ICONS = {
  copy:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7.4" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  thumbsUp:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h2m5-7-1.4 5H18a2 2 0 0 1 2 2l-1 6a2 2 0 0 1-2 1H7V11.5L12 4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  thumbsDown:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2m-5 7 1.4-5H6a2 2 0 0 1-2-2l1-6a2 2 0 0 1 2-1h10v7.5L12 20Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  refresh:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 2v6h-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 8a8 8 0 1 0 2 5.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
} as const;

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

  const clearPrefixedKeys = (storage: Storage | undefined, prefix: string) => {
    if (!storage) {
      return;
    }
    const toDelete: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(prefix)) {
        toDelete.push(key);
      }
    }
    toDelete.forEach((key) => storage.removeItem(key));
  };

  try {
    window.localStorage.removeItem(OPENCLAW_CONTROL_SETTINGS_KEY);
    window.localStorage.removeItem(OPENCLAW_DEVICE_AUTH_KEY);
    window.localStorage.removeItem(OPENCLAW_DEVICE_IDENTITY_KEY);
    clearPrefixedKeys(window.localStorage, OPENCLAW_CONTROL_TOKEN_PREFIX);
  } catch {}

  try {
    clearPrefixedKeys(window.sessionStorage, OPENCLAW_CONTROL_TOKEN_PREFIX);
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

function findLastRenderableAssistantGroup(host: HTMLElement): HTMLElement | null {
  const groups = Array.from(host.querySelectorAll('.chat-group.assistant')).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );

  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (group.querySelector('.chat-reading-indicator, .chat-bubble.streaming')) {
      continue;
    }
    if (extractChatGroupText(group) || group.querySelector('.chat-tool-card--clickable, .chat-message-image')) {
      return group;
    }
  }

  return null;
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

function computeCreditCostFromUsage(inputTokens: number, outputTokens: number): number {
  const inputCost = Math.ceil((Math.max(0, inputTokens) / 1000) * CREDIT_INPUT_COST_PER_1K);
  const outputCost = Math.ceil((Math.max(0, outputTokens) / 1000) * CREDIT_OUTPUT_COST_PER_1K);
  return Math.max(0, inputCost + outputCost);
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

function buildAssistantFooterTooltip(inputTokens: number, outputTokens: number, credits: number): string | null {
  if (inputTokens <= 0 && outputTokens <= 0) {
    return credits > 0 ? `实际消耗 ${credits} 龙虾币` : null;
  }
  return `输入 ${inputTokens} tokens · 输出 ${outputTokens} tokens · 实际消耗 ${credits} 龙虾币`;
}

function deriveLatestAssistantFooterMeta(messages: unknown[]): AssistantFooterMeta | null {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  type MessageGroup = {
    role: string;
    timestamp: number;
    messages: unknown[];
  };
  type AssistantMessageGroup = {
    timestamp: number;
    messages: unknown[];
  };

  let currentGroup: MessageGroup | null = null;
  let latestAssistantGroup: AssistantMessageGroup | null = null;

  const finalizeCurrentGroup = () => {
    if (!currentGroup || currentGroup.role !== 'assistant') {
      return;
    }
    latestAssistantGroup = {
      timestamp: currentGroup.timestamp,
      messages: [...currentGroup.messages],
    };
  };

  messages.forEach((message) => {
    const normalized = normalizeMessage(message);
    const role = normalizeRoleForGrouping(normalized.role);
    const timestamp = normalized.timestamp || Date.now();

    if (!currentGroup || currentGroup.role !== role) {
      finalizeCurrentGroup();
      currentGroup = {
        role,
        timestamp,
        messages: [message],
      };
      return;
    }

    currentGroup.messages.push(message);
  });

  finalizeCurrentGroup();

  if (!latestAssistantGroup) {
    return null;
  }

  const assistantGroup = latestAssistantGroup as AssistantMessageGroup;
  let inputTokens = 0;
  let outputTokens = 0;
  assistantGroup.messages.forEach((message: unknown) => {
    const record = message as Record<string, unknown>;
    const usage = record.usage as Record<string, unknown> | undefined;
    if (!usage) {
      return;
    }
    inputTokens += getUsageMetric(usage, ['input', 'inputTokens', 'input_tokens']);
    outputTokens += getUsageMetric(usage, ['output', 'outputTokens', 'output_tokens']);
  });

  const credits = computeCreditCostFromUsage(inputTokens, outputTokens);
  return {
    timestampLabel: formatAssistantFooterTimestamp(assistantGroup.timestamp),
    credits,
    inputTokens,
    outputTokens,
    tooltip: buildAssistantFooterTooltip(inputTokens, outputTokens, credits),
  };
}

function extractChatGroupTimestampLabel(group: HTMLElement): string {
  return group.querySelector('.chat-group-footer .chat-group-timestamp')?.textContent?.trim() ?? '';
}

function deriveLatestAssistantUsageSince(
  messages: unknown[],
  startedAt: number,
): AssistantUsageSettlement | null {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  type MessageGroup = {
    role: string;
    timestamp: number;
    messages: unknown[];
  };

  let currentGroup: MessageGroup | null = null;
  let latestAssistantGroup: MessageGroup | null = null;

  const finalizeCurrentGroup = () => {
    if (!currentGroup || currentGroup.role !== 'assistant' || currentGroup.timestamp < startedAt) {
      return;
    }
    latestAssistantGroup = {
      role: currentGroup.role,
      timestamp: currentGroup.timestamp,
      messages: [...currentGroup.messages],
    };
  };

  messages.forEach((message) => {
    const normalized = normalizeMessage(message);
    const role = normalizeRoleForGrouping(normalized.role);
    const timestamp = normalized.timestamp || Date.now();

    if (!currentGroup || currentGroup.role !== role) {
      finalizeCurrentGroup();
      currentGroup = {
        role,
        timestamp,
        messages: [message],
      };
      return;
    }

    currentGroup.messages.push(message);
  });

  finalizeCurrentGroup();

  if (!latestAssistantGroup) {
    return null;
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let model: string | null = null;
  let hasUsage = false;

  latestAssistantGroup.messages.forEach((message) => {
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
    timestamp: latestAssistantGroup.timestamp,
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
    },
  ];
  app.chatMessage = '';
  app.chatAttachments = [];
  app.chatSending = true;
  app.lastError = null;
  app.chatRunId = runId;
  app.chatStream = '';
  app.chatStreamStartedAt = startedAt;

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
    const detail = error instanceof Error ? error.message : String(error);
    app.chatRunId = null;
    app.chatStream = null;
    app.chatStreamStartedAt = null;
    app.lastError = detail;
    app.chatMessages = [
      ...app.chatMessages,
      {
        role: 'assistant',
        content: [{ type: 'text', text: `Error: ${detail}` }],
        timestamp: Date.now(),
      },
    ];
    throw error;
  } finally {
    app.chatSending = false;
  }
}

function setMessageActionFeedback(button: HTMLButtonElement, state: 'idle' | 'success'): void {
  button.dataset.state = state;
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
): Promise<{
  options: ComposerModelOption[];
  selectedModelId: string | null;
} | null> {
  const request = app.client?.request;
  if (!app.connected || typeof request !== 'function') {
    return null;
  }

  const [modelsResult, sessionsResult] = await Promise.all([
    request<{ models?: GatewayModelCatalogEntry[] }>('models.list', {}),
    request<GatewaySessionsListResult>('sessions.list', {
      includeGlobal: true,
      includeUnknown: true,
      limit: 200,
    }),
  ]);

  const options = buildComposerModelOptions(modelsResult?.models ?? []);
  const sessionModel =
    sessionsResult?.sessions.find((session) => session.key === targetSessionKey)?.model?.trim() ?? '';
  const defaultModel = sessionsResult?.defaults?.model?.trim() ?? '';
  const fallbackModel = options[0]?.id ?? null;

  return {
    options,
    selectedModelId: sessionModel || defaultModel || fallbackModel,
  };
}

export function OpenClawChatSurface({
  gatewayUrl,
  gatewayToken,
  gatewayPassword,
  sessionKey = 'main',
  initialPrompt = null,
  initialPromptKey = null,
  shellAuthenticated = false,
  creditClient,
  creditToken,
  onCreditBalanceRefresh,
  user,
}: OpenClawChatSurfaceProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<OpenClawAppElement | null>(null);
  const composerRef = useRef<RichChatComposerHandle | null>(null);
  const reconnectKeyRef = useRef<string | null>(null);
  const initialScrollScheduledRef = useRef(false);
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
  const pendingUsageSettlementRef = useRef<PendingUsageSettlement | null>(null);
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
  });
  const [showConnectionCard, setShowConnectionCard] = useState(false);
  const [showRenderDiagnosticsCard, setShowRenderDiagnosticsCard] = useState(false);
  const [unhandledGatewayError, setUnhandledGatewayError] = useState<UnhandledGatewayError | null>(null);
  const [lastRpcFailure, setLastRpcFailure] = useState<GatewayRpcFailure | null>(null);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(null);
  const [modelOptions, setModelOptions] = useState<ComposerModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelSwitching, setModelSwitching] = useState(false);
  const [composerDraft, setComposerDraft] = useState<ComposerDraftPayload | null>(null);
  const [creditEstimate, setCreditEstimate] = useState<ComposerCreditEstimateState>({
    loading: false,
    low: null,
    high: null,
    error: null,
    estimatedInputTokens: null,
  });
  const [installedLobsterAgents, setInstalledLobsterAgents] = useState<LobsterAgent[]>([]);
  const consumedInitialPromptKeyRef = useRef<string | null>(null);
  const statusLogRef = useRef<string | null>(null);
  const rpcLogRef = useRef<string | null>(null);
  const unhandledLogRef = useRef<string | null>(null);
  const selectionMenuRef = useRef<HTMLDivElement | null>(null);
  const modelLoadVersionRef = useRef(0);
  const messageActionTimersRef = useRef<number[]>([]);

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
      const snapshot = await loadChatModelSnapshot(app, sessionKey);
      if (!snapshot || modelLoadVersionRef.current !== requestVersion) {
        return false;
      }

      setModelOptions(snapshot.options);
      setSelectedModelId(snapshot.selectedModelId);
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
  }, [sessionKey]);

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
        await request('sessions.patch', {
          key: sessionKey,
          model: nextModelId,
        });
        await refreshModelCatalog();
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
    [refreshModelCatalog, selectedModelId, sessionKey],
  );

  useEffect(() => {
    if (pendingUsageSettlementRef.current) {
      console.warn('[desktop] drop pending credit settlement because session changed', pendingUsageSettlementRef.current);
    }
    artifactAutoOpenStateRef.current = {
      lastBusy: false,
      runSequence: 0,
      pendingRunSequence: null,
      pendingScanCount: 0,
      lastOpenedToken: null,
    };
    activeRecentTaskRunRef.current = null;
    pendingUsageSettlementRef.current = null;
    clearArtifactAutoOpenTimers();
    clearUsageSettlementTimers();
    modelLoadVersionRef.current += 1;
    setModelOptions([]);
    setSelectedModelId(null);
    setModelsLoading(false);
    setModelSwitching(false);
    setComposerDraft(null);
    setCreditEstimate({
      loading: false,
      low: null,
      high: null,
      error: null,
      estimatedInputTokens: null,
    });
  }, [clearArtifactAutoOpenTimers, clearUsageSettlementTimers, sessionKey]);

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
    }));

    const timer = window.setTimeout(() => {
      const historyMessages = estimateHistoryMessagesFromGroups(renderState.groupCount);
      void creditClient
        .creditsQuote(creditToken, {
          message: prompt,
          model: selectedModelId || undefined,
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
          });
        });
    }, 360);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [composerDraft, creditClient, creditToken, renderState.groupCount, selectedModelId]);

  useEffect(() => {
    if (!creditClient || !creditToken) {
      setInstalledLobsterAgents([]);
      return;
    }

    let cancelled = false;
    void loadLobsterAgents({
      client: creditClient,
      accessToken: creditToken,
    })
      .then((agents) => {
        if (cancelled) {
          return;
        }
        setInstalledLobsterAgents(agents.filter((agent) => agent.installed));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setInstalledLobsterAgents([]);
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
    const timer = window.setInterval(() => {
      const app = appRef.current;
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
    }, 250);

    return () => window.clearInterval(timer);
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

    const updateComposerHeight = () => {
      const composer = shell.querySelector('.iclaw-composer') as HTMLElement | null;
      const thread = shell.querySelector('.openclaw-chat-surface .chat-thread') as HTMLElement | null;
      const composerHeight = composer?.getBoundingClientRect().height ?? 0;
      const overlap =
        composer && thread
          ? Math.max(0, thread.getBoundingClientRect().bottom - composer.getBoundingClientRect().top)
          : 0;
      shell.style.setProperty('--iclaw-composer-height', `${Math.ceil(composerHeight)}px`);
      shell.style.setProperty('--iclaw-thread-bottom-gap', `${Math.ceil(overlap + 24)}px`);
    };

    updateComposerHeight();
    const observer = new ResizeObserver(() => {
      updateComposerHeight();
    });
    const composer = shell.querySelector('.iclaw-composer');
    const thread = shell.querySelector('.openclaw-chat-surface .chat-thread');
    if (composer) {
      observer.observe(composer);
    }
    if (thread) {
      observer.observe(thread);
    }
    window.addEventListener('resize', updateComposerHeight);

    return () => {
      observer.disconnect();
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
      };
      setStatus((current) =>
        current.busy === nextStatus.busy &&
        current.connected === nextStatus.connected &&
        current.lastError === nextStatus.lastError &&
        current.lastErrorCode === nextStatus.lastErrorCode
          ? current
          : nextStatus,
      );
      setRenderState((current) =>
        current.hostHeight === nextRenderState.hostHeight &&
        current.hasNativeInput === nextRenderState.hasNativeInput &&
        current.nativeInputVisible === nextRenderState.nativeInputVisible &&
        current.nativeInputHeight === nextRenderState.nativeInputHeight &&
        current.hasThread === nextRenderState.hasThread &&
        current.threadVisible === nextRenderState.threadVisible &&
        current.threadHeight === nextRenderState.threadHeight &&
        current.groupCount === nextRenderState.groupCount
          ? current
          : nextRenderState,
      );
    }, 180);

    return () => window.clearInterval(timer);
  }, []);

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
    if (!status.connected) {
      modelLoadVersionRef.current += 1;
      setModelOptions([]);
      setSelectedModelId(null);
      setModelsLoading(false);
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
  }, [status.connected, status.lastError]);

  useEffect(() => {
    const threadReady = renderState.hasThread && renderState.threadVisible;
    if (!shellAuthenticated || !status.connected || threadReady) {
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
    shellAuthenticated,
    status.connected,
  ]);

  const hasGatewayAuth = Boolean((gatewayToken ?? '').trim() || (gatewayPassword ?? '').trim());
  const connectionMessage = status.lastError
    ? status.lastError
    : hasGatewayAuth
      ? '正在连接 OpenClaw 网关…'
      : '缺少本地网关凭据，当前无法连接 OpenClaw。';
  const showBootMask = shellAuthenticated && !status.connected;
  const secureContextHint =
    typeof window !== 'undefined' && !window.isSecureContext
      ? '当前页面不是安全上下文，OpenClaw 可能会拒绝设备身份校验。'
      : null;
  const authRole = appRef.current?.hello?.auth?.role ?? null;
  const authScopes = appRef.current?.hello?.auth?.scopes ?? null;

  useEffect(() => {
    window.__ICLAW_OPENCLAW_DIAGNOSTICS__ = {
      connected: status.connected,
      lastError: status.lastError,
      lastErrorCode: status.lastErrorCode,
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
    renderState,
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
    const pending = pendingUsageSettlementRef.current;
    const app = appRef.current;
    if (!pending || !app || !creditClient || !creditToken) {
      return false;
    }

    const terminalEvent = findTerminalChatEventForRun(app, pending.sessionKey, pending.runId);
    if (terminalEvent) {
      pending.terminalState = terminalEvent.state;
    }

    const usage =
      (terminalEvent?.message ? deriveAssistantUsageFromMessage(terminalEvent.message) : null) ||
      (findLatestTerminalChatRunSince(app, pending.sessionKey, pending.startedAt) === pending.runId
        ? deriveLatestAssistantUsageSince(app.chatMessages, pending.startedAt)
        : null);

    if (!usage) {
      pending.attempts += 1;
      if (pending.terminalState === 'error') {
        console.warn('[desktop] skip credit settlement because run ended with error', pending);
        clearUsageSettlementTimers();
        pendingUsageSettlementRef.current = null;
        return false;
      }
      if (Date.now() >= pending.expiresAt) {
        console.warn('[desktop] skip credit settlement because assistant usage was not found before expiry', pending);
        clearUsageSettlementTimers();
        pendingUsageSettlementRef.current = null;
      }
      return false;
    }

    try {
      await creditClient.reportUsageEvent({
        token: creditToken,
        eventId: pending.runId,
        grantId: pending.grantId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        model: usage.model || pending.model || undefined,
      });
      clearUsageSettlementTimers();
      pendingUsageSettlementRef.current = null;
      await onCreditBalanceRefresh?.();
      return true;
    } catch (error) {
      pending.attempts += 1;
      console.error('[desktop] failed to report usage event', {
        runId: pending.runId,
        grantId: pending.grantId,
        error,
      });
      if (Date.now() >= pending.expiresAt) {
        clearUsageSettlementTimers();
        pendingUsageSettlementRef.current = null;
      }
      return false;
    }
  }, [clearUsageSettlementTimers, creditClient, creditToken, onCreditBalanceRefresh]);

  useEffect(() => {
    if (status.busy || !activeRecentTaskRunRef.current) {
      return;
    }

    finalizeRecentTaskRun();
  }, [finalizeRecentTaskRun, status.busy]);

  useEffect(() => {
    if (status.busy || !pendingUsageSettlementRef.current) {
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
  }, [attemptPendingUsageSettlement, clearUsageSettlementTimers, status.busy]);

  useEffect(() => {
    const activeRun = activeRecentTaskRunRef.current;
    if (!status.busy || !activeRun || !status.lastError) {
      return;
    }

    if (status.lastError !== activeRun.baselineError) {
      activeRun.failureMessage = status.lastError;
    }
  }, [status.busy, status.lastError]);

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

    const normalizedPrompt = payload.prompt.trim();
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

    try {
      if (!creditClient || !creditToken) {
        throw new Error('当前账号龙虾币鉴权尚未就绪，暂时不能发送消息。');
      }

      clearUsageSettlementTimers();
      pendingUsageSettlementRef.current = null;

      const runId = createDesktopRunId();
      const startedAt = Date.now();
      const fallbackEstimatedInputTokens =
        Math.max(0, Math.ceil(payload.prompt.trim().length * 0.75)) + payload.imageAttachments.length * 220;
      const runGrant = await creditClient.authorizeRun({
        token: creditToken,
        sessionKey,
        client: 'desktop',
        estimatedInputTokens: Math.max(
          0,
          creditEstimate.estimatedInputTokens ?? fallbackEstimatedInputTokens,
        ),
      });

      pendingUsageSettlementRef.current = {
        runId,
        grantId: runGrant.grant_id,
        sessionKey,
        startedAt,
        expiresAt: startedAt + USAGE_SETTLEMENT_MAX_WAIT_MS,
        model: selectedModelId,
        attempts: 0,
        terminalState: 'pending',
      };

      await sendAuthorizedChatMessage({
        app,
        sessionKey,
        prompt: payload.prompt,
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
      pendingUsageSettlementRef.current = null;
      const detail = error instanceof Error ? error.message : '任务发送失败';
      markRecentTaskFailed({
        id: task.id,
        artifacts: collectLatestArtifactKinds(hostRef.current),
        error: detail,
      });
      activeRecentTaskRunRef.current = null;
      setStatus((current) => ({
        ...current,
        lastError: detail,
      }));
      return false;
    }
  }, [
    clearUsageSettlementTimers,
    collectLatestArtifactKinds,
    creditClient,
    creditEstimate.estimatedInputTokens,
    creditToken,
    finalizeRecentTaskRun,
    selectedModelId,
    sessionKey,
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
    const host = hostRef.current;
    if (!host) {
      return;
    }

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
          void handleCopyAction(button!, extractChatGroupText(group));
        });
        group.append(button);
      }

      button.disabled = !text;
      button.setAttribute('aria-hidden', text ? 'false' : 'true');
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
            return;
          }

          if (action === 'copy') {
            void handleCopyAction(target, extractChatGroupText(group));
            return;
          }

          if (action === 'regenerate') {
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
            });
          }
        });

        messages.append(footer);
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
        const credits = footerMeta?.credits ?? 0;
        const nextState = credits > 0 ? 'charged' : 'idle';
        if (metaNode.dataset.state !== nextState) {
          metaNode.dataset.state = nextState;
        }
        const nextTitle = footerMeta?.tooltip ?? '';
        if (metaNode.title !== nextTitle) {
          metaNode.title = nextTitle;
        }
        if (credits > 0) {
          if (metaValueNode?.hasAttribute('hidden')) {
            metaValueNode.removeAttribute('hidden');
          }
          setElementTextIfChanged(metaLabelNode, '实际消耗 ');
          setElementTextIfChanged(metaValueNode, String(credits));
        } else {
          if (metaValueNode && !metaValueNode.hasAttribute('hidden')) {
            metaValueNode.setAttribute('hidden', 'true');
          }
          setElementTextIfChanged(metaLabelNode, '本次未计费');
          setElementTextIfChanged(metaValueNode, '');
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
      const lastAssistantGroup = findLastRenderableAssistantGroup(host);
      const footerMeta = deriveLatestAssistantFooterMeta(appRef.current?.chatMessages ?? []);
      const groups = Array.from(host.querySelectorAll('.chat-group')).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      );

      groups.forEach((group) => {
        if (group.classList.contains('user')) {
          ensureUserCopyButton(group);
          return;
        }

        if (group.classList.contains('assistant')) {
          const footer = group.querySelector('.iclaw-chat-assistant-footer');
          if (group === lastAssistantGroup) {
            ensureAssistantFooter(group, footerMeta);
          } else if (footer) {
            footer.remove();
          }
        }
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

    return () => {
      observer.disconnect();
      clearMessageActionTimers();
    };
  }, [clearMessageActionTimers, handleSend, status.busy]);

  return (
    <PageSurface as="div" className="bg-[var(--bg-page)]">
      <div className="flex min-h-0 flex-1 flex-col px-6 py-5 lg:px-8">
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

        <div className="relative flex min-h-[720px] min-w-0 flex-1 overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none">
          <div ref={shellRef} className="openclaw-chat-surface-shell h-full flex-1 overflow-hidden">
            <div ref={hostRef} className="openclaw-chat-surface h-full min-h-0 flex-1 overflow-hidden" />

            {showBootMask ? (
              <div className="iclaw-chat-boot-mask" role="status" aria-live="polite">
                <span className="iclaw-chat-boot-mask__sr-only">
                  {status.lastError ? '聊天界面恢复失败，正在等待重连' : '正在恢复聊天界面'}
                </span>
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
            ) : null}

            <RichChatComposer
              ref={composerRef}
              connected={status.connected}
              busy={status.busy}
              lobsterAgents={installedLobsterAgents}
              modelOptions={modelOptions}
              selectedModelId={selectedModelId}
              modelsLoading={modelsLoading}
              modelSwitching={modelSwitching}
              onModelChange={handleModelChange}
              onDraftChange={setComposerDraft}
              creditEstimate={composerDraft?.hasContent ? creditEstimate : null}
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
