import { buildChatScopedStorageKey } from '@/app/lib/chat-persistence-scope';
import { readCacheJson, writeCacheJson } from '@/app/lib/persistence/cache-store';
import type { ChatTurnRecord } from '@/app/lib/chat-turns';

const CRON_NOTIFICATION_WATERMARKS_KEY = 'iclaw.cron.notification.watermarks.v1';

type CronNotificationWatermarkMap = Record<string, number>;

function resolveStorageKey() {
  return buildChatScopedStorageKey(CRON_NOTIFICATION_WATERMARKS_KEY);
}

function readWatermarks(): CronNotificationWatermarkMap {
  const parsed = readCacheJson<Record<string, unknown>>(resolveStorageKey());
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }
  const result: CronNotificationWatermarkMap = {};
  Object.entries(parsed).forEach(([jobId, value]) => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      result[jobId] = value;
    }
  });
  return result;
}

function writeWatermarks(next: CronNotificationWatermarkMap) {
  writeCacheJson(resolveStorageKey(), next);
}

export function shouldNotifyCronRun(jobId: string, runTs: number): boolean {
  if (!jobId || !Number.isFinite(runTs) || runTs <= 0) {
    return false;
  }
  return runTs > (readWatermarks()[jobId] ?? 0);
}

export function markCronRunNotified(jobId: string, runTs: number): void {
  if (!jobId || !Number.isFinite(runTs) || runTs <= 0) {
    return;
  }
  const watermarks = readWatermarks();
  if ((watermarks[jobId] ?? 0) >= runTs) {
    return;
  }
  watermarks[jobId] = runTs;
  writeWatermarks(watermarks);
}

export function seedCronNotificationWatermarks(turns: ChatTurnRecord[]): void {
  const watermarks = readWatermarks();
  let mutated = false;
  turns.forEach((turn) => {
    if (turn.source !== 'cron' || !turn.sourceEntityId || (turn.status !== 'completed' && turn.status !== 'failed')) {
      return;
    }
    const updatedAtMs = new Date(turn.updatedAt).getTime();
    if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) {
      return;
    }
    if ((watermarks[turn.sourceEntityId] ?? 0) >= updatedAtMs) {
      return;
    }
    watermarks[turn.sourceEntityId] = updatedAtMs;
    mutated = true;
  });
  if (mutated) {
    writeWatermarks(watermarks);
  }
}
