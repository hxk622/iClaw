import { useEffect, useState } from 'react';
import { readCacheJson, writeCacheJson } from '@/app/lib/persistence/cache-store';
import { findChatConversationBySessionKey, syncChatConversationMetadata } from '@/app/lib/chat-conversations';
import { canonicalizeChatSessionKey, tryCanonicalizeChatSessionKey } from '@/app/lib/chat-session';
import { buildChatScopedStorageKey } from '@/app/lib/chat-persistence-scope';
import type { FinanceComplianceSnapshot } from '@/app/lib/finance-compliance';

export type ChatTurnStatus = 'running' | 'completed' | 'failed';
export type ChatTurnArtifact = 'report' | 'ppt' | 'webpage' | 'pdf' | 'sheet';
export type TaskTurnSource = 'chat' | 'cron';
export type TaskRouteTarget = 'chat' | 'cron';

export interface ChatTurnRecord {
  id: string;
  source: TaskTurnSource;
  conversationId: string;
  sessionKey: string;
  title: string;
  summary: string;
  prompt: string;
  status: ChatTurnStatus;
  createdAt: string;
  updatedAt: string;
  pinnedAt?: string | null;
  artifacts: ChatTurnArtifact[];
  lastError: string | null;
  sourceLabel?: string | null;
  routeTarget?: TaskRouteTarget;
  sourceEntityId?: string | null;
  model?: string | null;
  provider?: string | null;
  deliveryStatus?: string | null;
  nextRunAt?: number | null;
  financeCompliance?: FinanceComplianceSnapshot | null;
}

interface StartChatTurnInput {
  prompt: string;
  conversationId?: string | null;
  sessionKey?: string;
}

interface FinishChatTurnInput {
  id: string;
  artifacts?: ChatTurnArtifact[];
  error?: string | null;
}

interface UpsertCronTaskTurnInput {
  jobId: string;
  name: string;
  prompt: string;
  summary: string;
  status: ChatTurnStatus;
  sessionKey?: string | null;
  error?: string | null;
  artifacts?: ChatTurnArtifact[];
  model?: string | null;
  provider?: string | null;
  deliveryStatus?: string | null;
  nextRunAt?: number | null;
  runAt?: number | null;
  financeCompliance?: FinanceComplianceSnapshot | null;
}

const CHAT_TURNS_STORAGE_KEY = 'iclaw.chat.turns.v1';
const LEGACY_RECENT_TASKS_STORAGE_KEY = 'iclaw.recent-tasks.v1';
const CHAT_TURNS_UPDATED_EVENT = 'iclaw:chat-turns:updated';
const MAX_PERSISTED_TURNS = 240;

function resolveChatTurnsStorageKey(): string {
  return buildChatScopedStorageKey(CHAT_TURNS_STORAGE_KEY);
}

function resolveLegacyRecentTasksStorageKey(): string {
  return buildChatScopedStorageKey(LEGACY_RECENT_TASKS_STORAGE_KEY);
}

export const CHAT_TURN_ARTIFACT_LABELS: Record<ChatTurnArtifact, string> = {
  report: '报告',
  ppt: 'PPT',
  webpage: '网页',
  pdf: 'PDF',
  sheet: '表格',
};

function emitChatTurnsUpdated(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(CHAT_TURNS_UPDATED_EVENT));
}

function stripPromptMarkers(prompt: string): string {
  return prompt.replace(/\[\[(?:引用|图片|PDF|视频|附件):[\s\S]*?\]\]/g, ' ');
}

function collapseText(value: string | null | undefined): string {
  return (value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function trimText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function normalizeChatTurn(turn: ChatTurnRecord): ChatTurnRecord {
  const normalizedPrompt = collapseText(stripPromptMarkers(turn.prompt));
  const prompt = normalizedPrompt || '基于上传内容发起的任务';
  const title = collapseText(turn.title) || buildChatTurnTitle(prompt);
  const summary = collapseText(turn.summary) || buildChatTurnSummary(prompt);
  const normalizedSource: TaskTurnSource = turn.source === 'cron' ? 'cron' : 'chat';

  if (normalizedSource === 'cron') {
    const sessionKey = collapseText(turn.sessionKey) || `agent:main:cron:${collapseText(turn.sourceEntityId) || turn.id}`;
    const conversationId = collapseText(turn.conversationId) || collapseText(turn.sourceEntityId) || turn.id;
    return {
      ...turn,
      source: 'cron',
      conversationId,
      sessionKey,
      prompt,
      title,
      summary,
      createdAt: turn.createdAt || new Date().toISOString(),
      updatedAt: turn.updatedAt || turn.createdAt || new Date().toISOString(),
      pinnedAt: typeof turn.pinnedAt === 'string' && turn.pinnedAt ? turn.pinnedAt : null,
      artifacts: dedupeArtifacts(turn.artifacts ?? []),
      lastError: turn.lastError ?? null,
      sourceLabel: collapseText(turn.sourceLabel) || '定时任务',
      routeTarget: turn.routeTarget === 'cron' ? 'cron' : 'cron',
      sourceEntityId: collapseText(turn.sourceEntityId) || conversationId,
      model: collapseText(turn.model),
      provider: collapseText(turn.provider),
      deliveryStatus: collapseText(turn.deliveryStatus),
      nextRunAt: typeof turn.nextRunAt === 'number' && Number.isFinite(turn.nextRunAt) ? turn.nextRunAt : null,
      financeCompliance: normalizeFinanceCompliance(turn.financeCompliance),
    };
  }

  const resolvedSessionKey = tryCanonicalizeChatSessionKey(turn.sessionKey);
  if (!resolvedSessionKey) {
    throw new Error('invalid session key');
  }
  const resolvedConversationId =
    turn.conversationId || findChatConversationBySessionKey(resolvedSessionKey)?.id || resolvedSessionKey;

  return {
    ...turn,
    source: 'chat',
    conversationId: resolvedConversationId,
    sessionKey: resolvedSessionKey,
    prompt,
    title,
    summary,
    createdAt: turn.createdAt || new Date().toISOString(),
    updatedAt: turn.updatedAt || turn.createdAt || new Date().toISOString(),
    pinnedAt: typeof turn.pinnedAt === 'string' && turn.pinnedAt ? turn.pinnedAt : null,
    artifacts: dedupeArtifacts(turn.artifacts ?? []),
    lastError: turn.lastError ?? null,
    sourceLabel: collapseText(turn.sourceLabel) || null,
    routeTarget: turn.routeTarget === 'cron' ? 'cron' : 'chat',
    sourceEntityId: collapseText(turn.sourceEntityId),
    model: collapseText(turn.model),
    provider: collapseText(turn.provider),
    deliveryStatus: collapseText(turn.deliveryStatus),
    nextRunAt: typeof turn.nextRunAt === 'number' && Number.isFinite(turn.nextRunAt) ? turn.nextRunAt : null,
    financeCompliance: normalizeFinanceCompliance(turn.financeCompliance),
  };
}

function normalizeFinanceCompliance(value: unknown): FinanceComplianceSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const source = value as Record<string, unknown>;
  const domain = source.domain === 'finance' ? 'finance' : null;
  if (!domain) {
    return null;
  }
  return {
    domain,
    inputClassification:
      source.inputClassification === 'market_info' ||
      source.inputClassification === 'research_request' ||
      source.inputClassification === 'advice_request' ||
      source.inputClassification === 'personalized_request' ||
      source.inputClassification === 'execution_request' ||
      source.inputClassification === 'unknown'
        ? source.inputClassification
        : null,
    outputClassification:
      source.outputClassification === 'market_data' ||
      source.outputClassification === 'research_summary' ||
      source.outputClassification === 'investment_view' ||
      source.outputClassification === 'actionable_advice' ||
      source.outputClassification === 'unknown'
        ? source.outputClassification
        : null,
    riskLevel: source.riskLevel === 'low' || source.riskLevel === 'high' ? source.riskLevel : 'medium',
    showDisclaimer: source.showDisclaimer === true,
    disclaimerText: collapseText(typeof source.disclaimerText === 'string' ? source.disclaimerText : null) || null,
    requiresRiskSection: source.requiresRiskSection === true,
    blocked: source.blocked === true,
    degraded: source.degraded === true,
    reasons: Array.isArray(source.reasons) ? source.reasons.filter((item): item is string => typeof item === 'string') : [],
    matchedRules: Array.isArray(source.matchedRules) ? source.matchedRules.filter((item): item is string => typeof item === 'string') : [],
    confidence: source.confidence === 'low' || source.confidence === 'high' ? source.confidence : 'medium',
    classifierVersion: collapseText(typeof source.classifierVersion === 'string' ? source.classifierVersion : null) || null,
    decisionSource:
      source.decisionSource === 'plugin' || source.decisionSource === 'server' || source.decisionSource === 'heuristic_fallback'
        ? source.decisionSource
        : 'heuristic_fallback',
    usedCapabilities: Array.isArray(source.usedCapabilities)
      ? source.usedCapabilities.filter((item): item is string => typeof item === 'string')
      : [],
    usedModel: collapseText(typeof source.usedModel === 'string' ? source.usedModel : null) || null,
    sourceAttributionRequired: source.sourceAttributionRequired === true,
    timestampRequired: source.timestampRequired === true,
  };
}

function compareChatTurns(a: ChatTurnRecord, b: ChatTurnRecord): number {
  const aPinned = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
  const bPinned = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;

  if (aPinned !== bPinned) {
    return bPinned - aPinned;
  }

  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function readTurnsFromStorage(): ChatTurnRecord[] {
  try {
    const parsed =
      readCacheJson<unknown[]>(resolveChatTurnsStorageKey()) ??
      readCacheJson<unknown[]>(resolveLegacyRecentTasksStorageKey());
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is ChatTurnRecord => Boolean(item && typeof item === 'object' && 'id' in item))
      .map((item) => {
        try {
          return normalizeChatTurn(item);
        } catch {
          return null;
        }
      })
      .filter((item): item is ChatTurnRecord => item !== null)
      .sort(compareChatTurns)
      .slice(0, MAX_PERSISTED_TURNS);
  } catch {
    return [];
  }
}

function writeTurnsToStorage(turns: ChatTurnRecord[]): void {
  try {
    writeCacheJson(resolveChatTurnsStorageKey(), turns.slice(0, MAX_PERSISTED_TURNS));
    emitChatTurnsUpdated();
  } catch {}
}

function updateTurnList(
  updater: (turns: ChatTurnRecord[]) => ChatTurnRecord[],
): ChatTurnRecord[] {
  const nextTurns = updater(readTurnsFromStorage());
  writeTurnsToStorage(nextTurns);
  return nextTurns;
}

function createChatTurnId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `turn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function dedupeArtifacts(artifacts: ChatTurnArtifact[]): ChatTurnArtifact[] {
  return Array.from(new Set(artifacts));
}

function buildCronTurnRecordId(jobId: string, status: ChatTurnStatus, runAt?: number | null): string {
  if (status === 'running') {
    return `cron:${jobId}:running`;
  }
  if (typeof runAt === 'number' && Number.isFinite(runAt) && runAt > 0) {
    return `cron:${jobId}:${Math.trunc(runAt)}`;
  }
  return `cron:${jobId}:latest`;
}

export function buildChatTurnTitle(prompt: string): string {
  const cleaned = collapseText(stripPromptMarkers(prompt));
  if (!cleaned) {
    return '基于上传内容发起的任务';
  }

  const firstSentence = cleaned.split(/[。！？!?]/, 1)[0]?.trim() || cleaned;
  return trimText(firstSentence, 24);
}

export function buildChatTurnSummary(prompt: string): string {
  const cleaned = collapseText(stripPromptMarkers(prompt));
  if (!cleaned) {
    return '基于上传内容生成结果与分析。';
  }
  return trimText(cleaned, 72);
}

export function readChatTurns(): ChatTurnRecord[] {
  return readTurnsFromStorage();
}

export function startChatTurn(input: StartChatTurnInput): ChatTurnRecord {
  const now = new Date().toISOString();
  const sessionKey = canonicalizeChatSessionKey(input.sessionKey);
  const conversationId = input.conversationId || findChatConversationBySessionKey(sessionKey)?.id || sessionKey;
  const prompt = collapseText(stripPromptMarkers(input.prompt)) || '基于上传内容发起的任务';
  const title = buildChatTurnTitle(input.prompt);
  const summary = buildChatTurnSummary(input.prompt);

  const nextTurn: ChatTurnRecord = {
    id: createChatTurnId(),
    source: 'chat',
    conversationId,
    sessionKey,
    prompt,
    title,
    summary,
    status: 'running',
    createdAt: now,
    updatedAt: now,
    pinnedAt: null,
    artifacts: [],
    lastError: null,
    sourceLabel: null,
    routeTarget: 'chat',
    sourceEntityId: null,
    model: null,
    provider: null,
    deliveryStatus: null,
    nextRunAt: null,
    financeCompliance: null,
  };

  updateTurnList((turns) => [nextTurn, ...turns]);
  syncChatConversationMetadata({
    conversationId,
    sessionKey,
    title,
    summary,
  });
  return nextTurn;
}

export function markChatTurnCompleted(input: FinishChatTurnInput): void {
  updateTurnList((turns) =>
    turns.map((turn) =>
      turn.id === input.id
        ? {
            ...turn,
            status: 'completed',
            updatedAt: new Date().toISOString(),
            artifacts: dedupeArtifacts([...(turn.artifacts ?? []), ...(input.artifacts ?? [])]),
            lastError: null,
            financeCompliance: turn.financeCompliance ?? null,
          }
        : turn,
    ),
  );
}

export function markChatTurnFailed(input: FinishChatTurnInput): void {
  updateTurnList((turns) =>
    turns.map((turn) =>
      turn.id === input.id
        ? {
            ...turn,
            status: 'failed',
            updatedAt: new Date().toISOString(),
            artifacts: dedupeArtifacts([...(turn.artifacts ?? []), ...(input.artifacts ?? [])]),
            lastError: collapseText(input.error ?? '') || '任务执行失败',
            financeCompliance: turn.financeCompliance ?? null,
          }
        : turn,
    ),
  );
}

export function setChatTurnFinanceCompliance(id: string, financeCompliance: FinanceComplianceSnapshot | null): void {
  updateTurnList((turns) =>
    turns.map((turn) =>
      turn.id === id
        ? {
            ...turn,
            financeCompliance: normalizeFinanceCompliance(financeCompliance),
          }
        : turn,
    ),
  );
}

export function setChatTurnPinned(id: string, pinned: boolean): void {
  updateTurnList((turns) =>
    turns.map((turn) =>
      turn.id === id
        ? {
            ...turn,
            pinnedAt: pinned ? turn.pinnedAt || new Date().toISOString() : null,
          }
        : turn,
    ),
  );
}

export function renameChatTurn(id: string, title: string): void {
  const normalizedTitle = collapseText(title);
  if (!normalizedTitle) {
    return;
  }

  updateTurnList((turns) =>
    turns.map((turn) =>
      turn.id === id
        ? {
            ...turn,
            title: trimText(normalizedTitle, 48),
          }
        : turn,
    ),
  );
}

export function deleteChatTurn(id: string): void {
  updateTurnList((turns) => turns.filter((turn) => turn.id !== id));
}

export function deleteChatTurnsByConversationId(conversationId: string): void {
  const normalizedConversationId = collapseText(conversationId);
  if (!normalizedConversationId) {
    return;
  }

  updateTurnList((turns) => turns.filter((turn) => turn.source !== 'chat' || turn.conversationId !== normalizedConversationId));
}

export function upsertCronTaskTurn(input: UpsertCronTaskTurnInput): ChatTurnRecord | null {
  const jobId = collapseText(input.jobId);
  const name = collapseText(input.name);
  if (!jobId || !name) {
    return null;
  }

  const nowIso = new Date(input.runAt ?? Date.now()).toISOString();
  const prompt = collapseText(stripPromptMarkers(input.prompt)) || name;
  const summary = trimText(collapseText(input.summary) || name, 120);
  const nextRecordId = buildCronTurnRecordId(jobId, input.status, input.runAt);
  const runningRecordId = `cron:${jobId}:running`;

  let nextRecord: ChatTurnRecord | null = null;

  updateTurnList((turns) => {
    const existing = turns.find((turn) => turn.id === nextRecordId) ?? null;
    nextRecord = {
      id: nextRecordId,
      source: 'cron',
      conversationId: nextRecordId,
      sessionKey: collapseText(input.sessionKey) || existing?.sessionKey || `agent:main:cron:${jobId}`,
      title: trimText(name, 48),
      summary,
      prompt,
      status: input.status,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
      pinnedAt: existing?.pinnedAt ?? null,
      artifacts: dedupeArtifacts([...(existing?.artifacts ?? []), ...(input.artifacts ?? [])]),
      lastError: collapseText(input.error) || (input.status === 'failed' ? '任务执行失败' : null),
      sourceLabel: '定时任务',
      routeTarget: 'cron',
      sourceEntityId: jobId,
      model: collapseText(input.model),
      provider: collapseText(input.provider),
      deliveryStatus: collapseText(input.deliveryStatus),
      nextRunAt: typeof input.nextRunAt === 'number' && Number.isFinite(input.nextRunAt) ? input.nextRunAt : null,
      financeCompliance: normalizeFinanceCompliance(input.financeCompliance),
    };
    return [
      nextRecord as ChatTurnRecord,
      ...turns.filter((turn) => {
        if (turn.id === nextRecordId) {
          return false;
        }
        if (input.status !== 'running' && turn.id === runningRecordId) {
          return false;
        }
        return true;
      }),
    ];
  });

  return nextRecord;
}

export function deleteCronTaskTurn(jobId: string): void {
  const normalizedJobId = collapseText(jobId);
  if (!normalizedJobId) {
    return;
  }
  const recordIdPrefix = `cron:${normalizedJobId}`;
  updateTurnList((turns) =>
    turns.filter(
      (turn) =>
        !(
          turn.source === 'cron' &&
          ((turn.sourceEntityId && collapseText(turn.sourceEntityId) === normalizedJobId) || turn.id.startsWith(recordIdPrefix))
        ),
    ),
  );
}

export function subscribeChatTurns(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== CHAT_TURNS_STORAGE_KEY && event.key !== LEGACY_RECENT_TASKS_STORAGE_KEY) {
      return;
    }
    listener();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(CHAT_TURNS_UPDATED_EVENT, listener);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(CHAT_TURNS_UPDATED_EVENT, listener);
  };
}

export function useChatTurns(): ChatTurnRecord[] {
  const [turns, setTurns] = useState<ChatTurnRecord[]>(() => readChatTurns());

  useEffect(() => {
    setTurns(readChatTurns());
    return subscribeChatTurns(() => {
      setTurns(readChatTurns());
    });
  }, []);

  return turns;
}

export function inferChatTurnArtifactsFromText(text: string): ChatTurnArtifact[] {
  const normalized = text.toLowerCase();
  const result = new Set<ChatTurnArtifact>();

  if (
    normalized.includes('.ppt') ||
    normalized.includes('.pptx') ||
    normalized.includes('slide') ||
    normalized.includes('deck') ||
    normalized.includes('presentation') ||
    normalized.includes('幻灯片') ||
    normalized.includes('演示')
  ) {
    result.add('ppt');
  }

  if (normalized.includes('.pdf') || normalized.includes(' pdf ') || normalized.includes('pdf')) {
    result.add('pdf');
  }

  if (
    normalized.includes('.html') ||
    normalized.includes('.htm') ||
    normalized.includes('网页') ||
    normalized.includes('站点') ||
    normalized.includes('site') ||
    normalized.includes('web')
  ) {
    result.add('webpage');
  }

  if (
    normalized.includes('.xls') ||
    normalized.includes('.xlsx') ||
    normalized.includes('.csv') ||
    normalized.includes('表格') ||
    normalized.includes('sheet') ||
    normalized.includes('spreadsheet')
  ) {
    result.add('sheet');
  }

  if (
    normalized.includes('.doc') ||
    normalized.includes('.docx') ||
    normalized.includes('报告') ||
    normalized.includes('文档') ||
    normalized.includes('report')
  ) {
    result.add('report');
  }

  return Array.from(result);
}

export function formatChatTurnRelativeTime(dateString: string): string {
  const timestamp = new Date(dateString).getTime();
  if (!Number.isFinite(timestamp)) {
    return '刚刚';
  }

  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} 天前`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} 个月前`;

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} 年前`;
}
