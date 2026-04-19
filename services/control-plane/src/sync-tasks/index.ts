import cron from 'node-cron';
import { logInfo, logError } from '../logger.ts';
import { MARKET_SYNC_TASKS, type SyncTaskDefinition } from './task-registry.ts';

async function executeSyncTask(task: SyncTaskDefinition, context: 'schedule' | 'warmup'): Promise<void> {
  logInfo(`Running sync task...`, {
    taskId: task.id,
    label: task.label,
    category: task.category,
    context,
  });
  try {
    await task.run();
    logInfo(`Sync task completed successfully`, {
      taskId: task.id,
      label: task.label,
      context,
    });
  } catch (error) {
    logError(`Sync task failed`, {
      taskId: task.id,
      label: task.label,
      category: task.category,
      context,
      error,
    });
  }
}

async function warmupMarketFeeds(): Promise<void> {
  const warmupTasks = MARKET_SYNC_TASKS.filter((task) => task.warmupOnStartup);
  if (warmupTasks.length === 0) {
    return;
  }
  logInfo('Running initial market feed warmup...', {
    taskIds: warmupTasks.map((task) => task.id),
  });
  await Promise.allSettled(warmupTasks.map((task) => executeSyncTask(task, 'warmup')));
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
        await executeSyncTask(task, 'schedule');
      },
      {
        timezone: task.timezone,
      },
    );
  }

  void warmupMarketFeeds();
  logInfo('All market data sync tasks started successfully', {
    taskIds: MARKET_SYNC_TASKS.map((task) => task.id),
  });
}
