import { logError, logInfo } from '../logger.ts';
import { createSyncTaskRun, markSyncTaskRunFailed, markSyncTaskRunSucceeded, type SyncTaskRunTrigger } from './execution-store.ts';
import type { SyncTaskDefinition } from './task-registry.ts';

export async function executeRegisteredSyncTask(
  task: SyncTaskDefinition,
  trigger: SyncTaskRunTrigger,
): Promise<void> {
  const runId = await createSyncTaskRun({
    taskId: task.id,
    taskLabel: task.label,
    category: task.category,
    triggerType: trigger,
    schedule: task.schedule,
  });

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
  }
}
