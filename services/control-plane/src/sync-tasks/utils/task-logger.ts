import { createPgPool } from '../../pg-connection.ts';
import { config } from '../../config.ts';
import { logInfo, logError } from '../../logger.ts';

// 创建单例数据库连接
let poolInstance: any = null;
function getPool() {
  if (!poolInstance) {
    poolInstance = createPgPool(config.databaseUrl, 'sync-tasks');
  }
  return poolInstance;
}

export type TaskStatus = 'running' | 'success' | 'failed';

export interface TaskLogRecord {
  id?: number;
  taskName: string;
  status: TaskStatus;
  startTime: Date;
  endTime?: Date;
  errorMessage?: string;
  syncCount?: number;
  dataSource?: string;
}

/**
 * 记录任务开始日志
 */
export async function logTaskStart(taskName: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO sync_task_logs (task_name, status, start_time) VALUES ($1, 'running', $2) RETURNING id`,
    [taskName, new Date()]
  );
  const taskId = result.rows[0].id;
  logInfo(`[sync-task] ${taskName} started, log id: ${taskId}`);
  return taskId;
}

/**
 * 记录任务成功日志
 */
export async function logTaskSuccess(
  taskId: number,
  syncCount: number = 0,
  dataSource: string = ''
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE sync_task_logs SET status = 'success', end_time = $1, sync_count = $2, data_source = $3 WHERE id = $4`,
    [new Date(), syncCount, dataSource, taskId]
  );
  logInfo(`[sync-task] task ${taskId} succeeded, sync count: ${syncCount}, data source: ${dataSource}`);
}

/**
 * 记录任务失败日志
 */
export async function logTaskFailed(
  taskId: number,
  errorMessage: string,
  syncCount: number = 0
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE sync_task_logs SET status = 'failed', end_time = $1, sync_count = $2, error_message = $3 WHERE id = $4`,
    [new Date(), syncCount, errorMessage, taskId]
  );
  logError(`[sync-task] task ${taskId} failed: ${errorMessage}`);
}
