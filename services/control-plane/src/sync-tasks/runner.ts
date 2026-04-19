import { executeSyncTaskWithRuntime } from '../../../../packages/market-sync-core/src/runner.ts';
import { logError, logInfo } from '../logger.ts';
import type { SyncTaskDefinition, SyncTaskRunTrigger } from '../../../../packages/market-sync-core/src/types.ts';
import {
  acquireSyncTaskLease,
  createSyncTaskRun,
  markSyncTaskRunFailed,
  markSyncTaskRunSkipped,
  markSyncTaskRunSucceeded,
  releaseSyncTaskLease,
} from './execution-store.ts';

export async function executeRegisteredSyncTask(
  task: SyncTaskDefinition,
  trigger: SyncTaskRunTrigger,
): Promise<{runId: string; status: 'success' | 'failed' | 'skipped'}> {
  return executeSyncTaskWithRuntime(task, trigger, {
    store: {
      createRun: createSyncTaskRun,
      markSucceeded: markSyncTaskRunSucceeded,
      markFailed: markSyncTaskRunFailed,
      markSkipped: markSyncTaskRunSkipped,
      acquireLease: acquireSyncTaskLease,
      releaseLease: releaseSyncTaskLease,
    },
    logger: {
      info: logInfo,
      error: logError,
    },
  });
}
