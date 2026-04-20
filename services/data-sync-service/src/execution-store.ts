import { randomUUID } from 'node:crypto';

import { config as controlPlaneConfig } from '../../control-plane/src/config.ts';
import { createPgPool } from '../../control-plane/src/pg-connection.ts';
import type { SyncTaskExecutionResult, SyncTaskRunTrigger } from '../../../packages/market-sync-core/src/types.ts';

let poolInstance: any = null;
function getPool() {
  if (!poolInstance) {
    poolInstance = createPgPool(controlPlaneConfig.databaseUrl, 'data-sync:task-runs');
  }
  return poolInstance;
}

const DEFAULT_LEASE_DURATION_MS = 15 * 60 * 1000;

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

export async function markSyncTaskRunSkipped(
  runId: string,
  reason: string,
  result: SyncTaskExecutionResult = {},
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `
      update sync_task_runs
      set
        status = 'skipped',
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
      reason,
      JSON.stringify(result.metadata || {}),
    ],
  );
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

export async function acquireSyncTaskLease(input: {
  taskId: string;
  runId: string;
  triggerType: SyncTaskRunTrigger;
  ownerToken: string;
  durationMs?: number | null;
}): Promise<boolean> {
  const pool = getPool();
  const durationMs =
    typeof input.durationMs === 'number' && Number.isFinite(input.durationMs) && input.durationMs > 0
      ? Math.floor(input.durationMs)
      : DEFAULT_LEASE_DURATION_MS;
  const result = await pool.query<{acquired: boolean}>(
    `
      insert into sync_task_leases (
        task_id,
        owner_token,
        run_id,
        trigger_type,
        leased_until,
        metadata_json,
        created_at,
        updated_at
      )
      values (
        $1,
        $2,
        $3,
        $4,
        now() + ($5::bigint * interval '1 millisecond'),
        '{}'::jsonb,
        now(),
        now()
      )
      on conflict (task_id) do update
      set
        owner_token = excluded.owner_token,
        run_id = excluded.run_id,
        trigger_type = excluded.trigger_type,
        leased_until = excluded.leased_until,
        updated_at = now()
      where sync_task_leases.leased_until <= now()
         or sync_task_leases.owner_token = excluded.owner_token
      returning true as acquired
    `,
    [input.taskId, input.ownerToken, input.runId, input.triggerType, durationMs],
  );
  return result.rows.length > 0 && result.rows[0]?.acquired === true;
}

export async function releaseSyncTaskLease(input: {
  taskId: string;
  ownerToken: string;
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `
      delete from sync_task_leases
      where task_id = $1
        and owner_token = $2
    `,
    [input.taskId, input.ownerToken],
  );
}
