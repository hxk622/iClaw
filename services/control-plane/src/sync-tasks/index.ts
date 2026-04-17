import cron from 'node-cron';
import { syncStockBasics } from './tasks/sync-stock-basics.ts';
import { syncStockQuotes } from './tasks/sync-stock-quotes.ts';
import { syncIndustryConcept } from './tasks/sync-industry-concept.ts';
import { syncFinanceData } from './tasks/sync-finance-data.ts';
import { logInfo, logError } from '../logger.ts';

/**
 * 启动所有定时同步任务
 */
export function startSyncTasks() {
  logInfo('Starting all market data sync tasks...');

  // 1. 交易日每天17:00 同步股票基础信息（北京时间）
  cron.schedule('0 17 * * 1-5', async () => {
    logInfo('Running daily stock basics sync task...');
    try {
      await syncStockBasics();
      logInfo('Stock basics sync task completed successfully');
    } catch (e) {
      logError('Stock basics sync task failed', { error: e });
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // 2. 交易日9:30-15:00 每小时同步一次行情数据（北京时间）
  cron.schedule('0 9-15 * * 1-5', async () => {
    logInfo('Running hourly stock quotes sync task...');
    try {
      await syncStockQuotes();
      logInfo('Stock quotes sync task completed successfully');
    } catch (e) {
      logError('Stock quotes sync task failed', { error: e });
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // 3. 交易日每天18:00 同步行业概念数据（北京时间）
  cron.schedule('0 18 * * 1-5', async () => {
    logInfo('Running daily industry concept sync task...');
    try {
      await syncIndustryConcept();
      logInfo('Industry concept sync task completed successfully');
    } catch (e) {
      logError('Industry concept sync task failed', { error: e });
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // 4. 每季度第一天10:00 同步财务数据（北京时间）
  cron.schedule('0 10 1 1,4,7,10 *', async () => {
    logInfo('Running quarterly finance data sync task...');
    try {
      await syncFinanceData();
      logInfo('Finance data sync task completed successfully');
    } catch (e) {
      logError('Finance data sync task failed', { error: e });
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  logInfo('All market data sync tasks started successfully');
}
