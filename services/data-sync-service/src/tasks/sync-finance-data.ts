import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { config as controlPlaneConfig } from '../../../control-plane/src/config.ts';
import { logInfo, logError } from '../../../control-plane/src/logger.ts';
import { createPgPool } from '../../../control-plane/src/pg-connection.ts';
import { runPythonScript } from '../../../control-plane/src/sync-tasks/utils/python-runner.ts';
import { logTaskStart, logTaskSuccess, logTaskFailed } from '../../../control-plane/src/sync-tasks/utils/task-logger.ts';

let poolInstance: any = null;
function getPool() {
  if (!poolInstance) {
    poolInstance = createPgPool(controlPlaneConfig.databaseUrl, 'data-sync:finance-data');
  }
  return poolInstance;
}

export interface FinanceData {
  stock_code: string;
  report_year: number;
  report_quarter: number;
  revenue: number;
  net_profit: number;
  roe: number;
  gross_margin: number;
  debt_ratio: number;
  eps: number;
}

type SyncTaskExecutionResult = {
  syncCount: number;
  dataSource: string;
};

export async function syncFinanceData(): Promise<SyncTaskExecutionResult> {
  const scriptPath = path.join(__dirname, '../python-scripts/fetch-finance-data.py');
  const pool = getPool();
  const taskId = await logTaskStart('sync_finance_data');

  let syncCount = 0;
  const dataSource = 'akshare+efinance+tushare';
  let reportYear: number | null = null;
  let reportQuarter: number | null = null;

  try {
    const financeData = await runPythonScript<FinanceData[]>(scriptPath, [], 300000);
    logInfo(`Fetched ${financeData.length} finance data records`);
    syncCount = financeData.length;

    if (financeData.length < 1000) {
      throw new Error(`Fetched only ${financeData.length} records, data is incomplete, abort sync`);
    }

    reportYear = financeData[0].report_year;
    reportQuarter = financeData[0].report_quarter;
    logInfo(`Report period: ${reportYear}Q${reportQuarter}`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
        DELETE FROM stock_finance
        WHERE report_year = $1 AND report_quarter = $2
      `,
        [reportYear, reportQuarter],
      );
      logInfo(`Deleted old data for ${reportYear}Q${reportQuarter}`);

      const insertQuery = `
        INSERT INTO stock_finance (
          stock_code, report_year, report_quarter, revenue, net_profit,
          roe, gross_margin, debt_ratio, eps, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        ON CONFLICT (stock_code, report_year, report_quarter) DO UPDATE SET
          revenue = EXCLUDED.revenue,
          net_profit = EXCLUDED.net_profit,
          roe = EXCLUDED.roe,
          gross_margin = EXCLUDED.gross_margin,
          debt_ratio = EXCLUDED.debt_ratio,
          eps = EXCLUDED.eps,
          updated_at = CURRENT_TIMESTAMP;
      `;

      for (const data of financeData) {
        await client.query(insertQuery, [
          data.stock_code,
          data.report_year,
          data.report_quarter,
          data.revenue || 0,
          data.net_profit || 0,
          data.roe || 0,
          data.gross_margin || 0,
          data.debt_ratio || 0,
          data.eps || 0,
        ]);
      }

      const countResult = await client.query(
        `
        SELECT COUNT(*) FROM stock_finance
        WHERE report_year = $1 AND report_quarter = $2
      `,
        [reportYear, reportQuarter],
      );
      const count = parseInt(countResult.rows[0].count, 10);
      syncCount = count;

      if (count < 1000) {
        throw new Error(`Inserted only ${count} records, data incomplete, rollback`);
      }

      await client.query('COMMIT');
      logInfo(`Successfully synced ${count} finance data records for ${reportYear}Q${reportQuarter}`);
      await logTaskSuccess(taskId, count, dataSource);
      return {
        syncCount: count,
        dataSource,
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    logError('Sync finance data failed', { error: e });
    await logTaskFailed(taskId, errorMsg, syncCount);
    throw e;
  }
}
