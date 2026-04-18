import { useEffect, useState } from 'react';
import { readCacheJson, writeCacheJson } from '@/app/lib/persistence/cache-store';
import { buildChatScopedStorageKey } from '@/app/lib/chat-persistence-scope';
import type { FinanceComplianceSnapshot } from '@/app/lib/finance-compliance';

export type AppNotificationTone = 'success' | 'error' | 'info';
export type AppNotificationSource = 'cron' | 'chat' | 'system';
export type AppNotificationRouteTarget = 'cron' | 'chat' | 'task-center';

export interface AppNotificationMetadata {
  taskName?: string | null;
  routeTarget?: AppNotificationRouteTarget | null;
  sessionKey?: string | null;
  conversationId?: string | null;
  cronJobId?: string | null;
  model?: string | null;
  provider?: string | null;
  nextRunAt?: number | null;
  runAt?: number | null;
  errorReason?: string | null;
  result?: string | null;
  financeCompliance?: FinanceComplianceSnapshot | null;
}

export interface AppNotificationRecord {
  id: string;
  tone: AppNotificationTone;
  source: AppNotificationSource;
  title: string;
  text: string;
  createdAt: string;
  readAt?: string | null;
  metadata?: AppNotificationMetadata | null;
}

const TASK_NOTIFICATIONS_STORAGE_KEY = 'iclaw.task.notifications.v1';
const TASK_NOTIFICATIONS_UPDATED_EVENT = 'iclaw:task-notifications:updated';
const MAX_PERSISTED_NOTIFICATIONS = 40;

function resolveTaskNotificationsStorageKey(): string {
  return buildChatScopedStorageKey(TASK_NOTIFICATIONS_STORAGE_KEY);
}

function emitTaskNotificationsUpdated(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(TASK_NOTIFICATIONS_UPDATED_EVENT));
}

function normalizeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeMetadata(value: unknown): AppNotificationMetadata | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Record<string, unknown>;
  return {
    taskName: normalizeText(source.taskName),
    routeTarget:
      source.routeTarget === 'cron' || source.routeTarget === 'chat' || source.routeTarget === 'task-center'
        ? source.routeTarget
        : null,
    sessionKey: normalizeText(source.sessionKey),
    conversationId: normalizeText(source.conversationId),
    cronJobId: normalizeText(source.cronJobId),
    model: normalizeText(source.model),
    provider: normalizeText(source.provider),
    nextRunAt: normalizeOptionalNumber(source.nextRunAt),
    runAt: normalizeOptionalNumber(source.runAt),
    errorReason: normalizeText(source.errorReason),
    result: normalizeText(source.result),
    financeCompliance: normalizeFinanceCompliance(source.financeCompliance),
  };
}

function normalizeFinanceCompliance(value: unknown): FinanceComplianceSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const source = value as Record<string, unknown>;
  if (source.domain !== 'finance') {
    return null;
  }
  return {
    domain: 'finance',
    inputClassification:
      source.inputClassification === 'market_info' ||
      source.inputClassification === 'research_request' ||
      source.inputClassification === 'advice_request' ||
      source.inputClassification === 'personalized_request' ||
      source.inputClassification === 'execution_request'
        ? source.inputClassification
        : null,
    outputClassification:
      source.outputClassification === 'market_data' ||
      source.outputClassification === 'research_summary' ||
      source.outputClassification === 'investment_view' ||
      source.outputClassification === 'actionable_advice'
        ? source.outputClassification
        : null,
    riskLevel: source.riskLevel === 'low' || source.riskLevel === 'high' ? source.riskLevel : 'medium',
    showDisclaimer: source.showDisclaimer === true,
    disclaimerText: normalizeText(source.disclaimerText),
    requiresRiskSection: source.requiresRiskSection === true,
    blocked: source.blocked === true,
    degraded: source.degraded === true,
    reasons: Array.isArray(source.reasons) ? source.reasons.filter((item): item is string => typeof item === 'string') : [],
    usedCapabilities: Array.isArray(source.usedCapabilities)
      ? source.usedCapabilities.filter((item): item is string => typeof item === 'string')
      : [],
    usedModel: normalizeText(source.usedModel),
    sourceAttributionRequired: source.sourceAttributionRequired === true,
    timestampRequired: source.timestampRequired === true,
  };
}

function normalizeNotification(record: AppNotificationRecord): AppNotificationRecord | null {
  const id = normalizeText(record.id);
  const title = normalizeText(record.title);
  const text = normalizeText(record.text);
  const createdAt = normalizeText(record.createdAt);
  if (!id || !title || !text || !createdAt) {
    return null;
  }
  return {
    id,
    tone: record.tone === 'success' || record.tone === 'error' ? record.tone : 'info',
    source: record.source === 'cron' || record.source === 'chat' ? record.source : 'system',
    title,
    text,
    createdAt,
    readAt: normalizeText(record.readAt),
    metadata: normalizeMetadata(record.metadata),
  };
}

function sortNotifications(records: AppNotificationRecord[]): AppNotificationRecord[] {
  return [...records].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function readAppNotifications(): AppNotificationRecord[] {
  try {
    const parsed = readCacheJson<unknown[]>(resolveTaskNotificationsStorageKey());
    if (!Array.isArray(parsed)) {
      return [];
    }
    return sortNotifications(
      parsed
        .filter(
          (item): item is AppNotificationRecord =>
            Boolean(item && typeof item === 'object' && 'id' in item && 'title' in item),
        )
        .map((item) => normalizeNotification(item))
        .filter((item): item is AppNotificationRecord => item !== null),
    ).slice(0, MAX_PERSISTED_NOTIFICATIONS);
  } catch {
    return [];
  }
}

function writeAppNotifications(records: AppNotificationRecord[]): void {
  try {
    writeCacheJson(
      resolveTaskNotificationsStorageKey(),
      sortNotifications(records).slice(0, MAX_PERSISTED_NOTIFICATIONS),
    );
    emitTaskNotificationsUpdated();
  } catch {}
}

export function pushAppNotification(input: {
  tone: AppNotificationTone;
  source?: AppNotificationSource;
  title: string;
  text: string;
  metadata?: AppNotificationMetadata | null;
}): AppNotificationRecord | null {
  const title = normalizeText(input.title);
  const text = normalizeText(input.text);
  if (!title || !text) {
    return null;
  }
  const nextRecord: AppNotificationRecord = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    tone: input.tone,
    source: input.source === 'cron' || input.source === 'chat' ? input.source : 'system',
    title,
    text,
    createdAt: new Date().toISOString(),
    readAt: null,
    metadata: input.metadata ? normalizeMetadata(input.metadata) : null,
  };
  writeAppNotifications([nextRecord, ...readAppNotifications()]);
  return nextRecord;
}

export function markAppNotificationRead(id: string): void {
  const normalizedId = normalizeText(id);
  if (!normalizedId) {
    return;
  }
  const now = new Date().toISOString();
  writeAppNotifications(
    readAppNotifications().map((record) =>
      record.id === normalizedId && !record.readAt
        ? {
            ...record,
            readAt: now,
          }
        : record,
    ),
  );
}

export function markAllAppNotificationsRead(): void {
  const now = new Date().toISOString();
  writeAppNotifications(
    readAppNotifications().map((record) =>
      record.readAt
        ? record
        : {
            ...record,
            readAt: now,
          },
    ),
  );
}

export function dismissAppNotification(id: string): void {
  const normalizedId = normalizeText(id);
  if (!normalizedId) {
    return;
  }
  writeAppNotifications(readAppNotifications().filter((record) => record.id !== normalizedId));
}

export function clearAppNotifications(): void {
  writeAppNotifications([]);
}

export function subscribeAppNotifications(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== TASK_NOTIFICATIONS_STORAGE_KEY) {
      return;
    }
    listener();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(TASK_NOTIFICATIONS_UPDATED_EVENT, listener);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(TASK_NOTIFICATIONS_UPDATED_EVENT, listener);
  };
}

export function useAppNotifications(): AppNotificationRecord[] {
  const [records, setRecords] = useState<AppNotificationRecord[]>(() => readAppNotifications());

  useEffect(() => {
    setRecords(readAppNotifications());
    return subscribeAppNotifications(() => {
      setRecords(readAppNotifications());
    });
  }, []);

  return records;
}
