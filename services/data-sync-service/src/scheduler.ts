import cron from 'node-cron';

import { startScheduledSyncTasks } from '../../../packages/market-sync-core/src/scheduler.ts';
import { logInfo } from '../../control-plane/src/logger.ts';
import { executeRegisteredSyncTask } from '../../control-plane/src/sync-tasks/runner.ts';
import { MARKET_SYNC_TASKS } from './task-registry.ts';

export function startSyncTasks() {
  startScheduledSyncTasks(MARKET_SYNC_TASKS, {
    schedule: (expression, callback, options) => {
      cron.schedule(expression, callback, options);
    },
    execute: executeRegisteredSyncTask,
    logger: {
      info: logInfo,
    },
  });
}
