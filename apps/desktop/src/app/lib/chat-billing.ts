import { readCacheJson, writeCacheJson } from './persistence/cache-store';

export type PendingUsageSettlementRecord = {
  runId: string;
  grantId: string;
  sessionKey: string;
  conversationId?: string | null;
  startedAt: number;
  expiresAt: number;
  model: string | null;
  baselineInputTokens: number | null;
  baselineOutputTokens: number | null;
  attempts: number;
  terminalState: 'pending' | 'final' | 'aborted' | 'error';
};

const CHAT_PENDING_USAGE_SETTLEMENTS_PREFIX = 'iclaw.chat.billing.pending.v1';

function normalizeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildPendingUsageSettlementsStorageKey(appName: string): string {
  const normalizedAppName = appName.trim().toLowerCase() || 'default';
  return `${CHAT_PENDING_USAGE_SETTLEMENTS_PREFIX}:${normalizedAppName}`;
}

export function normalizePendingUsageSettlementRecord(value: unknown): PendingUsageSettlementRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const runId = normalizeText(record.runId);
  const grantId = normalizeText(record.grantId);
  const sessionKey = normalizeText(record.sessionKey);
  const startedAt = typeof record.startedAt === 'number' && Number.isFinite(record.startedAt) ? record.startedAt : NaN;
  const expiresAt = typeof record.expiresAt === 'number' && Number.isFinite(record.expiresAt) ? record.expiresAt : NaN;

  if (!runId || !grantId || !sessionKey || !Number.isFinite(startedAt) || !Number.isFinite(expiresAt)) {
    return null;
  }

  return {
    runId,
    grantId,
    sessionKey,
    conversationId: normalizeText(record.conversationId),
    startedAt,
    expiresAt,
    model: normalizeText(record.model),
    baselineInputTokens:
      typeof record.baselineInputTokens === 'number' && Number.isFinite(record.baselineInputTokens)
        ? record.baselineInputTokens
        : null,
    baselineOutputTokens:
      typeof record.baselineOutputTokens === 'number' && Number.isFinite(record.baselineOutputTokens)
        ? record.baselineOutputTokens
        : null,
    attempts: typeof record.attempts === 'number' && Number.isFinite(record.attempts) ? Math.max(0, record.attempts) : 0,
    terminalState:
      record.terminalState === 'final' ||
      record.terminalState === 'aborted' ||
      record.terminalState === 'error'
        ? record.terminalState
        : 'pending',
  };
}

export function normalizePendingUsageSettlementRecords(values: unknown): PendingUsageSettlementRecord[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((value) => normalizePendingUsageSettlementRecord(value))
    .filter((value): value is PendingUsageSettlementRecord => value !== null);
}

export function mergePendingUsageSettlementRecords(
  current: PendingUsageSettlementRecord[],
  incoming: PendingUsageSettlementRecord[],
): PendingUsageSettlementRecord[] {
  const merged = new Map<string, PendingUsageSettlementRecord>();
  current.forEach((item) => merged.set(item.runId, item));
  incoming.forEach((item) => merged.set(item.runId, item));
  return Array.from(merged.values()).sort((left, right) => left.startedAt - right.startedAt);
}

export function readStoredPendingUsageSettlements(appName: string): PendingUsageSettlementRecord[] {
  return normalizePendingUsageSettlementRecords(
    readCacheJson<unknown[]>(buildPendingUsageSettlementsStorageKey(appName)),
  );
}

export function writeStoredPendingUsageSettlements(
  appName: string,
  settlements: PendingUsageSettlementRecord[],
): void {
  writeCacheJson(buildPendingUsageSettlementsStorageKey(appName), settlements);
}

export function filterPendingUsageSettlementsForSession(
  settlements: PendingUsageSettlementRecord[],
  sessionKey: string,
  conversationId?: string | null,
): PendingUsageSettlementRecord[] {
  const normalizedSessionKey = sessionKey.trim();
  const normalizedConversationId = normalizeText(conversationId);

  return settlements.filter((item) => {
    if (item.sessionKey !== normalizedSessionKey) {
      return false;
    }
    if (!normalizedConversationId) {
      return true;
    }
    return !item.conversationId || item.conversationId === normalizedConversationId;
  });
}
