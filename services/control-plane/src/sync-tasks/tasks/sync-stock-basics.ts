import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { logInfo, logError } from '../../logger.ts';
import { runPythonScript } from '../utils/python-runner.ts';
import { logTaskStart, logTaskSuccess, logTaskFailed } from '../utils/task-logger.ts';
// 从task-logger复用getPool
import { createPgPool } from '../../pg-connection.ts';
import { config } from '../../config.ts';

let poolInstance: any = null;
function getPool() {
  if (!poolInstance) {
    poolInstance = createPgPool(config.databaseUrl, 'sync-tasks');
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

/**
 * 同步股票基础信息
 */
export async function syncStockBasics() {
  const scriptPath = path.join(__dirname, '../python-scripts/fetch-stock-basics.py');
  const pool = getPool();
  const taskId = await logTaskStart('sync_stock_basics');

  let syncCount = 0;
  const dataSource = 'akshare+efinance';

  try {
    // 1. 调用Python脚本拉取数据
    const stocks = await runPythonScript<StockBasic[]>(scriptPath, [], 120000); // 超时2分钟
    logInfo(`Fetched ${stocks.length} stock basics records`);
    syncCount = stocks.length;

    if (stocks.length < 5000) { // A股至少有5000多只股票，少于这个数说明数据不全，异常
      throw new Error(`Fetched only ${stocks.length} stocks, data is incomplete, abort sync`);
    }

    // 2. 开启事务，先写入临时表，再原子切换正式表
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 创建临时表
      await client.query(`
        CREATE TEMP TABLE stock_basics_temp (LIKE stock_basics INCLUDING ALL) ON COMMIT DROP;
      `);

      // 批量插入临时表
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
          stock.list_date || null
        ]);
      }

      // 校验临时表数据量
      const countResult = await client.query('SELECT COUNT(*) FROM stock_basics_temp');
      const count = parseInt(countResult.rows[0].count, 10);
      syncCount = count;

      if (count < 5000) {
        throw new Error(`Temp table only has ${count} records, data incomplete, rollback`);
      }

      // 原子替换正式表数据
      await client.query('TRUNCATE TABLE stock_basics');
      await client.query('INSERT INTO stock_basics SELECT * FROM stock_basics_temp');

      await client.query('COMMIT');
      logInfo(`Successfully synced ${count} stock basics records`);
      await logTaskSuccess(taskId, count, dataSource);

    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    logError('Sync stock basics failed:', e);
    await logTaskFailed(taskId, errorMsg, syncCount);
    throw e;
  }
}
