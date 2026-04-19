import { randomUUID } from 'node:crypto';

import { logError, logInfo } from '../logger.ts';
import {
  acquireSyncTaskLease,
  createSyncTaskRun,
  markSyncTaskRunFailed,
  markSyncTaskRunSkipped,
  markSyncTaskRunSucceeded,
  releaseSyncTaskLease,
  type SyncTaskRunTrigger,
} from './execution-store.ts';
import type { SyncTaskDefinition } from './task-registry.ts';

export async function executeRegisteredSyncTask(
  task: SyncTaskDefinition,
  trigger: SyncTaskRunTrigger,
): Promise<{runId: string; status: 'success' | 'failed' | 'skipped'}> {
  const runId = await createSyncTaskRun({
    taskId: task.id,
    taskLabel: task.label,
    category: task.category,
    triggerType: trigger,
    schedule: task.schedule,
  });
  const ownerToken = randomUUID();
  const acquired = await acquireSyncTaskLease({
    taskId: task.id,
    runId,
    triggerType: trigger,
    ownerToken,
  });

  if (!acquired) {
    const reason = `lease_not_acquired:${task.id}`;
    await markSyncTaskRunSkipped(runId, reason, {
      metadata: {
        skip_reason: 'lease_not_acquired',
      },
    });
    logInfo('Sync task skipped because lease is held by another instance', {
      runId,
      taskId: task.id,
      trigger,
    });
    return {runId, status: 'skipped'};
  }

  logInfo('Running sync task...', {
    runId,
    taskId: task.id,
    label: task.label,
    category: task.category,
    trigger,
  });

  try {
    const result = (await task.run()) || {};
    await markSyncTaskRunSucceeded(runId, result);
    logInfo('Sync task completed successfully', {
      runId,
      taskId: task.id,
      trigger,
      syncCount: result.syncCount ?? null,
      dataSource: result.dataSource ?? null,
    });
    return {runId, status: 'success'};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markSyncTaskRunFailed(runId, message);
    logError('Sync task failed', {
      runId,
      taskId: task.id,
      label: task.label,
      category: task.category,
      trigger,
      error,
    });
    throw error;
  } finally {
    await releaseSyncTaskLease({
      taskId: task.id,
      ownerToken,
    });
  }
}
