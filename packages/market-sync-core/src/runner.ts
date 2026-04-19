import { randomUUID } from 'node:crypto';

import type { SyncTaskDefinition, SyncTaskExecutionResult, SyncTaskRunTrigger } from './types.ts';

export type SyncTaskExecutionStore = {
  createRun(input: {
    taskId: string;
    taskLabel: string;
    category: string;
    triggerType: SyncTaskRunTrigger;
    schedule?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<string>;
  markSucceeded(runId: string, result?: SyncTaskExecutionResult): Promise<void>;
  markFailed(runId: string, errorMessage: string, result?: SyncTaskExecutionResult): Promise<void>;
  markSkipped(runId: string, reason: string, result?: SyncTaskExecutionResult): Promise<void>;
  acquireLease(input: {
    taskId: string;
    runId: string;
    triggerType: SyncTaskRunTrigger;
    ownerToken: string;
  }): Promise<boolean>;
  releaseLease(input: {
    taskId: string;
    ownerToken: string;
  }): Promise<void>;
};

export type SyncTaskLogger = {
  info(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
};

export async function executeSyncTaskWithRuntime(
  task: SyncTaskDefinition,
  trigger: SyncTaskRunTrigger,
  runtime: {
    store: SyncTaskExecutionStore;
    logger: SyncTaskLogger;
  },
): Promise<{ runId: string; status: 'success' | 'failed' | 'skipped' }> {
  const runId = await runtime.store.createRun({
    taskId: task.id,
    taskLabel: task.label,
    category: task.category,
    triggerType: trigger,
    schedule: task.schedule,
  });
  const ownerToken = randomUUID();
  const acquired = await runtime.store.acquireLease({
    taskId: task.id,
    runId,
    triggerType: trigger,
    ownerToken,
  });

  if (!acquired) {
    await runtime.store.markSkipped(runId, `lease_not_acquired:${task.id}`, {
      metadata: {
        skip_reason: 'lease_not_acquired',
      },
    });
    runtime.logger.info('Sync task skipped because lease is held by another instance', {
      runId,
      taskId: task.id,
      trigger,
    });
    return { runId, status: 'skipped' };
  }

  runtime.logger.info('Running sync task...', {
    runId,
    taskId: task.id,
    label: task.label,
    category: task.category,
    trigger,
  });

  try {
    const result = (await task.run()) || {};
    await runtime.store.markSucceeded(runId, result);
    runtime.logger.info('Sync task completed successfully', {
      runId,
      taskId: task.id,
      trigger,
      syncCount: result.syncCount ?? null,
      dataSource: result.dataSource ?? null,
    });
    return { runId, status: 'success' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await runtime.store.markFailed(runId, message);
    runtime.logger.error('Sync task failed', {
      runId,
      taskId: task.id,
      label: task.label,
      category: task.category,
      trigger,
      error,
    });
    throw error;
  } finally {
    await runtime.store.releaseLease({
      taskId: task.id,
      ownerToken,
    });
  }
}
