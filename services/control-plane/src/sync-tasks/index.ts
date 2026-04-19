import cron from 'node-cron';
import { filterWarmupTasks, listTaskIds } from '../../../../packages/market-sync-core/src/registry.ts';
import { MARKET_SYNC_TASKS, type SyncTaskDefinition } from './task-registry.ts';
import { logInfo } from '../logger.ts';
import { executeRegisteredSyncTask } from './runner.ts';

async function warmupMarketFeeds(): Promise<void> {
  const warmupTasks = filterWarmupTasks(MARKET_SYNC_TASKS);
  if (warmupTasks.length === 0) {
    return;
  }
  logInfo('Running initial market feed warmup...', {
    taskIds: listTaskIds(warmupTasks),
  });
  await Promise.allSettled(warmupTasks.map((task) => executeRegisteredSyncTask(task, 'warmup')));
  logInfo('Initial market feed warmup completed');
}

/**
 * 启动所有定时同步任务
 */
export function startSyncTasks() {
  logInfo('Starting all market data sync tasks...');
  for (const task of MARKET_SYNC_TASKS) {
    cron.schedule(
      task.schedule,
      async () => {
        await executeRegisteredSyncTask(task, 'schedule');
      },
      {
        timezone: task.timezone,
      },
    );
  }

  void warmupMarketFeeds();
  logInfo('All market data sync tasks started successfully', {
    taskIds: listTaskIds(MARKET_SYNC_TASKS),
  });
}
