import type {
  AppNotificationRecord,
  AppNotificationRouteTarget,
  AppNotificationSource,
  AppNotificationTone,
} from '@/app/lib/task-notifications';

export type NotificationCenterCategory = 'all' | 'scheduled' | 'chat' | 'system';
export type NotificationCenterTimeGroup = 'today' | 'yesterday' | 'earlier';

export interface NotificationCenterDetail {
  taskName: string;
  status: AppNotificationTone;
  executionTime: string;
  nextRunTime?: string;
  model?: string;
  provider?: string;
  result?: string;
  errorReason?: string;
  financeDisclaimer?: string;
}

export interface NotificationCenterItem {
  id: string;
  type: AppNotificationTone;
  category: NotificationCenterCategory;
  title: string;
  summary: string;
  time: string;
  source: string;
  isRead: boolean;
  timeGroup: NotificationCenterTimeGroup;
  createdAt: string;
  routeTarget: AppNotificationRouteTarget | null;
  conversationId: string | null;
  sessionKey: string | null;
  cronJobId: string | null;
  details: NotificationCenterDetail;
}

function formatRelativeTime(input: string): string {
  const timestamp = new Date(input).getTime();
  if (!Number.isFinite(timestamp)) {
    return '';
  }
  const diff = Date.now() - timestamp;
  if (diff < 60_000) {
    return '刚刚';
  }
  if (diff < 3_600_000) {
    return `${Math.max(1, Math.floor(diff / 60_000))}分钟前`;
  }
  if (diff < 86_400_000) {
    return `${Math.max(1, Math.floor(diff / 3_600_000))}小时前`;
  }
  const days = Math.floor(diff / 86_400_000);
  if (days <= 3) {
    return `${days}天前`;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

function resolveTimeGroup(input: string): NotificationCenterTimeGroup {
  const target = new Date(input);
  if (!Number.isFinite(target.getTime())) {
    return 'earlier';
  }
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const targetTime = target.getTime();
  if (targetTime >= startOfToday) {
    return 'today';
  }
  if (targetTime >= startOfYesterday) {
    return 'yesterday';
  }
  return 'earlier';
}

function formatDateTime(input?: number | string | null): string {
  if (input == null) {
    return '未记录';
  }
  const timestamp =
    typeof input === 'number' ? input : typeof input === 'string' ? new Date(input).getTime() : Number.NaN;
  if (!Number.isFinite(timestamp)) {
    return '未记录';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(timestamp);
}

function resolveCategory(source: AppNotificationSource): NotificationCenterCategory {
  if (source === 'cron') {
    return 'scheduled';
  }
  if (source === 'chat') {
    return 'chat';
  }
  return 'system';
}

function resolveSourceLabel(source: AppNotificationSource): string {
  if (source === 'cron') {
    return '定时任务';
  }
  if (source === 'chat') {
    return '聊天';
  }
  return '系统';
}

function resolveResult(record: AppNotificationRecord): string | undefined {
  if (record.tone === 'success') {
    return record.metadata?.result || record.text;
  }
  if (record.tone === 'info') {
    return record.metadata?.result || record.text;
  }
  return record.metadata?.result || undefined;
}

function resolveErrorReason(record: AppNotificationRecord): string | undefined {
  if (record.tone === 'error') {
    return record.metadata?.errorReason || record.text;
  }
  return record.metadata?.errorReason || undefined;
}

export function buildNotificationCenterItems(records: AppNotificationRecord[]): NotificationCenterItem[] {
  return records.map((record) => ({
    id: record.id,
    type: record.tone,
    category: resolveCategory(record.source),
    title: record.title,
    summary: record.text,
    time: formatRelativeTime(record.createdAt),
    source: resolveSourceLabel(record.source),
    isRead: Boolean(record.readAt),
    timeGroup: resolveTimeGroup(record.createdAt),
    createdAt: record.createdAt,
    routeTarget: record.metadata?.routeTarget || (record.source === 'cron' ? 'cron' : null),
    conversationId: record.metadata?.conversationId || null,
    sessionKey: record.metadata?.sessionKey || null,
    cronJobId: record.metadata?.cronJobId || null,
    details: {
      taskName: record.metadata?.taskName || record.title,
      status: record.tone,
      executionTime: formatDateTime(record.metadata?.runAt || record.createdAt),
      nextRunTime: record.metadata?.nextRunAt ? formatDateTime(record.metadata.nextRunAt) : undefined,
      model: record.metadata?.model || undefined,
      provider: record.metadata?.provider || undefined,
      result: resolveResult(record),
      errorReason: resolveErrorReason(record),
      financeDisclaimer:
        record.metadata?.financeCompliance?.showDisclaimer === true
          ? record.metadata.financeCompliance.disclaimerText || '本回答由AI生成，仅供参考，请仔细甄别，谨慎投资。'
          : undefined,
    },
  }));
}
