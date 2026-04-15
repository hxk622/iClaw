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

export interface StockQuote {
  stock_code: string;
  stock_name: string;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  change_percent: number;
  volume: number;
  amount: number;
  turnover_rate: number;
  pe_ttm: number;
  pb: number;
  total_market_cap: number;
  float_market_cap: number;
  trade_date: string;
}

/**
 * 同步全市场最新行情
 */
export async function syncStockQuotes() {
  const scriptPath = path.join(__dirname, '../python-scripts/fetch_stock_quotes.py');
  const pool = getPool();
  const taskId = await logTaskStart('sync_stock_quotes');

  let syncCount = 0;
  const dataSource = 'akshare+efinance';
  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. 调用Python脚本拉取数据
    const quotes = await runPythonScript<StockQuote[]>(scriptPath, [], 120000); // 超时2分钟
    logInfo(`Fetched ${quotes.length} stock quotes records`);
    syncCount = quotes.length;

    if (quotes.length < 5000) { // 数据完整性校验
      throw new Error(`Fetched only ${quotes.length} quotes, data is incomplete, abort sync`);
    }

    // 2. 开启事务，写入当天行情数据
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 先删除当天已有的旧数据
      await client.query(`DELETE FROM stock_quotes WHERE trade_date = $1`, [today]);

      // 批量插入新行情数据
      const insertQuery = `
        INSERT INTO stock_quotes (
          stock_code, trade_date, open, high, low, close, volume, amount,
          change, change_percent, turnover_rate, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      `;

      for (const quote of quotes) {
        await client.query(insertQuery, [
          quote.stock_code,
          quote.trade_date || today,
          quote.open || 0,
          quote.high || 0,
          quote.low || 0,
          quote.close || 0,
          quote.volume || 0,
          quote.amount || 0,
          quote.change || 0,
          quote.change_percent || 0,
          quote.turnover_rate || 0
        ]);
      }

      // 校验插入数量
      const countResult = await client.query(`SELECT COUNT(*) FROM stock_quotes WHERE trade_date = $1`, [today]);
      const count = parseInt(countResult.rows[0].count, 10);
      syncCount = count;

      if (count < 5000) {
        throw new Error(`Inserted only ${count} quotes, data incomplete, rollback`);
      }

      await client.query('COMMIT');
      logInfo(`Successfully synced ${count} stock quotes for ${today}`);
      await logTaskSuccess(taskId, count, dataSource);

    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    logError('Sync stock quotes failed:', e);
    await logTaskFailed(taskId, errorMsg, syncCount);
    throw e;
  }
}
