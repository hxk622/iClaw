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
    poolInstance = createPgPool(controlPlaneConfig.databaseUrl, 'data-sync:stock-basics');
  }
  return poolInstance;
}

export interface StockBasic {
  stock_code: string;
  stock_name: string;
  exchange: string;
  company_name: string;
  main_business: string;
  industry: string;
  region: string;
  market_cap: number;
  float_cap: number;
  total_shares: number;
  float_shares: number;
  pe_ttm: number;
  pb: number;
  list_date: string;
}

type SyncTaskExecutionResult = {
  syncCount: number;
  dataSource: string;
};

export async function syncStockBasics(): Promise<SyncTaskExecutionResult> {
  const scriptPath = path.join(__dirname, '../python-scripts/fetch-stock-basics.py');
  const pool = getPool();
  const taskId = await logTaskStart('sync_stock_basics');

  let syncCount = 0;
  const dataSource = 'akshare+efinance';

  try {
    const stocks = await runPythonScript<StockBasic[]>(scriptPath, [], 120000);
    logInfo(`Fetched ${stocks.length} stock basics records`);
    syncCount = stocks.length;

    if (stocks.length < 5000) {
      throw new Error(`Fetched only ${stocks.length} stocks, data is incomplete, abort sync`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        CREATE TEMP TABLE stock_basics_temp (LIKE stock_basics INCLUDING ALL) ON COMMIT DROP;
      `);

      const insertQuery = `
        INSERT INTO stock_basics_temp (
          stock_code, stock_name, exchange, company_name, main_business,
          industry, region, market_cap, float_cap, total_shares,
          float_shares, pe_ttm, pb, list_date, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
        ON CONFLICT (stock_code) DO UPDATE SET
          stock_name = EXCLUDED.stock_name,
          exchange = EXCLUDED.exchange,
          company_name = EXCLUDED.company_name,
          main_business = EXCLUDED.main_business,
          industry = EXCLUDED.industry,
          region = EXCLUDED.region,
          market_cap = EXCLUDED.market_cap,
          float_cap = EXCLUDED.float_cap,
          total_shares = EXCLUDED.total_shares,
          float_shares = EXCLUDED.float_shares,
          pe_ttm = EXCLUDED.pe_ttm,
          pb = EXCLUDED.pb,
          list_date = EXCLUDED.list_date,
          updated_at = CURRENT_TIMESTAMP;
      `;

      for (const stock of stocks) {
        await client.query(insertQuery, [
          stock.stock_code,
          stock.stock_name,
          stock.exchange,
          stock.company_name,
          stock.main_business,
          stock.industry,
          stock.region,
          stock.market_cap || 0,
          stock.float_cap || 0,
          stock.total_shares || 0,
          stock.float_shares || 0,
          stock.pe_ttm || 0,
          stock.pb || 0,
          stock.list_date || null,
        ]);
      }

      const countResult = await client.query('SELECT COUNT(*) FROM stock_basics_temp');
      const count = parseInt(countResult.rows[0].count, 10);
      syncCount = count;

      if (count < 5000) {
        throw new Error(`Temp table only has ${count} records, data incomplete, rollback`);
      }

      await client.query('TRUNCATE TABLE stock_basics');
      await client.query('INSERT INTO stock_basics SELECT * FROM stock_basics_temp');
      await client.query('COMMIT');

      logInfo(`Successfully synced ${count} stock basics records`);
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
    logError('Sync stock basics failed', { error: e });
    await logTaskFailed(taskId, errorMsg, syncCount);
    throw e;
  }
}
