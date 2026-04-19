import { randomUUID } from 'node:crypto';

import { createPgPool } from '../pg-connection.ts';
import { config } from '../config.ts';

let poolInstance: any = null;
function getPool() {
  if (!poolInstance) {
    poolInstance = createPgPool(config.databaseUrl, 'sync-task-runs');
  }
  return poolInstance;
}

export type SyncTaskRunTrigger = 'manual' | 'schedule' | 'warmup';
export type SyncTaskExecutionResult = {
  syncCount?: number | null;
  dataSource?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createSyncTaskRun(input: {
  taskId: string;
  taskLabel: string;
  category: string;
  triggerType: SyncTaskRunTrigger;
  schedule?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const pool = getPool();
  const runId = randomUUID();
  await pool.query(
    `
      insert into sync_task_runs (
        run_id,
        task_id,
        task_label,
        category,
        trigger_type,
        schedule,
        status,
        started_at,
        metadata_json,
        created_at,
        updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, 'running', now(), $7::jsonb, now(), now()
      )
    `,
    [
      runId,
      input.taskId,
      input.taskLabel,
      input.category,
      input.triggerType,
      input.schedule || null,
      JSON.stringify(input.metadata || {}),
    ],
  );
  return runId;
}

export async function markSyncTaskRunSucceeded(
  runId: string,
  result: SyncTaskExecutionResult = {},
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `
      update sync_task_runs
      set
        status = 'success',
        finished_at = now(),
        duration_ms = greatest(0, floor(extract(epoch from (now() - started_at)) * 1000))::int,
        sync_count = $2,
        data_source = $3,
        metadata_json = coalesce(metadata_json, '{}'::jsonb) || $4::jsonb,
        updated_at = now()
      where run_id = $1
    `,
    [
      runId,
      typeof result.syncCount === 'number' && Number.isFinite(result.syncCount) ? Math.floor(result.syncCount) : null,
      result.dataSource || null,
      JSON.stringify(result.metadata || {}),
    ],
  );
}

export async function markSyncTaskRunFailed(
  runId: string,
  errorMessage: string,
  result: SyncTaskExecutionResult = {},
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `
      update sync_task_runs
      set
        status = 'failed',
        finished_at = now(),
        duration_ms = greatest(0, floor(extract(epoch from (now() - started_at)) * 1000))::int,
        sync_count = $2,
        data_source = $3,
        error_message = $4,
        metadata_json = coalesce(metadata_json, '{}'::jsonb) || $5::jsonb,
        updated_at = now()
      where run_id = $1
    `,
    [
      runId,
      typeof result.syncCount === 'number' && Number.isFinite(result.syncCount) ? Math.floor(result.syncCount) : null,
      result.dataSource || null,
      errorMessage,
      JSON.stringify(result.metadata || {}),
    ],
  );
}
