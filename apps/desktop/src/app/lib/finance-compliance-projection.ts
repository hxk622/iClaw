import type { ChatTurnRecord } from './chat-turns';
import type { AppNotificationRecord } from './task-notifications';
import { resolveSurfaceFinanceCompliance } from './finance-compliance-surface.ts';

export function resolveConversationFinanceDisclaimer(
  turn: Pick<ChatTurnRecord, 'source' | 'financeCompliance' | 'title' | 'prompt' | 'summary' | 'model'>,
  options?: { appName?: string },
): string | null {
  return resolveSurfaceFinanceCompliance({
    snapshot: turn.financeCompliance,
    appName: options?.appName || 'licaiclaw',
    channel: turn.source === 'cron' ? 'cron' : 'chat',
    title: turn.title,
    prompt: turn.prompt,
    answer: turn.summary,
    usedModel: turn.model || null,
  }).disclaimerText;
}

export function resolveNotificationFinanceDisclaimer(
  record: Pick<AppNotificationRecord, 'source' | 'title' | 'text' | 'metadata'>,
  options?: { appName?: string },
): string | null {
  const resultText =
    typeof record.metadata?.result === 'string' && record.metadata.result.trim()
      ? record.metadata.result.trim()
      : record.text;
  return resolveSurfaceFinanceCompliance({
    snapshot: record.metadata?.financeCompliance ?? null,
    appName: options?.appName || 'licaiclaw',
    channel: record.source === 'cron' ? 'cron' : record.source === 'chat' ? 'chat' : 'notification',
    title:
      typeof record.metadata?.taskName === 'string' && record.metadata.taskName.trim()
        ? record.metadata.taskName.trim()
        : record.title,
    answer: resultText,
    usedModel:
      typeof record.metadata?.model === 'string' && record.metadata.model.trim()
        ? record.metadata.model.trim()
        : null,
  }).disclaimerText;
}
