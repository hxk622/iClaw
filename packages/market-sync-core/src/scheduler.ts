import type { SyncTaskDefinition, SyncTaskRunTrigger } from './types.ts';
import { filterWarmupTasks, listTaskIds } from './registry.ts';

export type SyncTaskExecutor = (
  task: SyncTaskDefinition,
  trigger: SyncTaskRunTrigger,
) => Promise<unknown>;

export type SyncTaskSchedulerLogger = {
  info(message: string, fields?: Record<string, unknown>): void;
};

export function startScheduledSyncTasks(
  tasks: SyncTaskDefinition[],
  runtime: {
    schedule: (
      expression: string,
      callback: () => Promise<void> | void,
      options: { timezone: string },
    ) => void;
    execute: SyncTaskExecutor;
    logger: SyncTaskSchedulerLogger;
  },
): void {
  runtime.logger.info('Starting all market data sync tasks...', {
    taskIds: listTaskIds(tasks),
  });

  for (const task of tasks) {
    runtime.schedule(task.schedule, async () => {
      await runtime.execute(task, 'schedule');
    }, {
      timezone: task.timezone,
    });
  }

  const warmupTasks = filterWarmupTasks(tasks);
  if (warmupTasks.length > 0) {
    runtime.logger.info('Running initial market feed warmup...', {
      taskIds: listTaskIds(warmupTasks),
    });
    void Promise.allSettled(warmupTasks.map((task) => runtime.execute(task, 'warmup'))).then(() => {
      runtime.logger.info('Initial market feed warmup completed');
    });
  }

  runtime.logger.info('All market data sync tasks started successfully', {
    taskIds: listTaskIds(tasks),
  });
}
