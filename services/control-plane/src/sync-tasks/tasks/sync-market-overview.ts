import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { createPgPool } from '../../pg-connection.ts';
import { config } from '../../config.ts';
import { logInfo, logError } from '../../logger.ts';
import { runPythonScript } from '../utils/python-runner.ts';
import { logTaskStart, logTaskSuccess, logTaskFailed } from '../utils/task-logger.ts';

let poolInstance: any = null;
function getPool() {
  if (!poolInstance) {
    poolInstance = createPgPool(config.databaseUrl, 'sync-tasks');
  }
  return poolInstance;
}

interface MarketIndexSnapshotInput {
  index_key: string;
  index_name: string;
  market_scope: string;
  value: number | null;
  change_amount: number | null;
  change_percent: number | null;
  source: string | null;
  snapshot_at: string;
  is_delayed: boolean;
  metadata: Record<string, unknown>;
}

type SyncTaskExecutionResult = {
  syncCount: number;
  dataSource: string;
};

export async function syncMarketOverview(): Promise<SyncTaskExecutionResult> {
  const scriptPath = path.join(__dirname, '../python-scripts/fetch_market_indices.py');
  const pool = getPool();
  const taskId = await logTaskStart('sync_market_overview');
  let syncCount = 0;
  const dataSource = 'stock_quotes+stock_industry_relation+akshare';

  try {
    const indices = await runPythonScript<MarketIndexSnapshotInput[]>(scriptPath, [], 120000);
    if (!Array.isArray(indices) || indices.length < 3) {
      throw new Error(`Fetched only ${Array.isArray(indices) ? indices.length : 0} market indices, data incomplete`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const latestDateResult = await client.query<{trade_date: string | null}>(
        `select max(trade_date)::text as trade_date from stock_quotes`,
      );
      const tradeDate = latestDateResult.rows[0]?.trade_date;
      if (!tradeDate) {
        throw new Error('stock_quotes has no trade_date available');
      }

      const breadthResult = await client.query<{
        total_turnover: string | null;
        advancers: string | null;
        decliners: string | null;
        flat_count: string | null;
        limit_up_count: string | null;
        limit_down_count: string | null;
      }>(
        `
          select
            coalesce(sum(amount), 0)::text as total_turnover,
            count(*) filter (where change > 0)::text as advancers,
            count(*) filter (where change < 0)::text as decliners,
            count(*) filter (where change = 0)::text as flat_count,
            count(*) filter (where change_percent >= 9.5)::text as limit_up_count,
            count(*) filter (where change_percent <= -9.5)::text as limit_down_count
          from stock_quotes
          where trade_date = $1
        `,
        [tradeDate],
      );

      const sectorRows = await client.query<{
        sector_name: string;
        avg_change_percent: string | null;
        total_amount: string | null;
        stock_count: string | null;
      }>(
        `
          select
            rel.industry_name as sector_name,
            avg(q.change_percent)::text as avg_change_percent,
            sum(q.amount)::text as total_amount,
            count(*)::text as stock_count
          from stock_industry_relation rel
          join stock_quotes q
            on q.stock_code = rel.stock_code
           and q.trade_date = $1
          group by rel.industry_name
          having count(*) >= 3
          order by avg(q.change_percent) desc nulls last, sum(q.amount) desc nulls last
          limit 6
        `,
        [tradeDate],
      );

      const snapshotAt = new Date().toISOString();
      const topSectors = sectorRows.rows.map((row) => ({
        sector_name: row.sector_name,
        avg_change_percent: row.avg_change_percent == null ? null : Number(row.avg_change_percent),
        total_amount: row.total_amount == null ? null : Number(row.total_amount),
        stock_count: row.stock_count == null ? null : Number(row.stock_count),
      }));

      await client.query(
        `
          insert into market_overview_snapshot (
            overview_key,
            market_scope,
            source,
            trading_date,
            snapshot_at,
            total_turnover,
            advancers,
            decliners,
            flat_count,
            limit_up_count,
            limit_down_count,
            top_sectors_json,
            metadata_json,
            created_at,
            updated_at
          )
          values (
            $1, $2, $3, $4::date, $5::timestamptz, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, now(), now()
          )
        `,
        [
          'cn_overview',
          'cn',
          dataSource,
          tradeDate,
          snapshotAt,
          breadthResult.rows[0]?.total_turnover ? Number(breadthResult.rows[0].total_turnover) : null,
          breadthResult.rows[0]?.advancers ? Number(breadthResult.rows[0].advancers) : 0,
          breadthResult.rows[0]?.decliners ? Number(breadthResult.rows[0].decliners) : 0,
          breadthResult.rows[0]?.flat_count ? Number(breadthResult.rows[0].flat_count) : 0,
          breadthResult.rows[0]?.limit_up_count ? Number(breadthResult.rows[0].limit_up_count) : 0,
          breadthResult.rows[0]?.limit_down_count ? Number(breadthResult.rows[0].limit_down_count) : 0,
          JSON.stringify(topSectors),
          JSON.stringify({trade_date: tradeDate, generated_from: 'stock_quotes'}),
        ],
      );

      for (const item of indices) {
        await client.query(
          `
            insert into market_index_snapshot (
              index_key,
              index_name,
              market_scope,
              value,
              change_amount,
              change_percent,
              source,
              snapshot_at,
              is_delayed,
              metadata_json,
              created_at,
              updated_at
            )
            values (
              $1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10::jsonb, now(), now()
            )
            on conflict (index_key, snapshot_at) do update set
              index_name = excluded.index_name,
              market_scope = excluded.market_scope,
              value = excluded.value,
              change_amount = excluded.change_amount,
              change_percent = excluded.change_percent,
              source = excluded.source,
              is_delayed = excluded.is_delayed,
              metadata_json = excluded.metadata_json,
              updated_at = now()
          `,
          [
            item.index_key,
            item.index_name,
            item.market_scope || 'cn',
            item.value,
            item.change_amount,
            item.change_percent,
            item.source,
            item.snapshot_at || snapshotAt,
            item.is_delayed !== false,
            JSON.stringify(item.metadata || {}),
          ],
        );
      }

      await client.query(
        `delete from market_overview_snapshot where snapshot_at < now() - interval '14 days'`,
      );
      await client.query(
        `delete from market_index_snapshot where snapshot_at < now() - interval '14 days'`,
      );

      await client.query('COMMIT');
      syncCount = indices.length + topSectors.length + 1;
      logInfo(`Successfully synced market overview snapshot with ${indices.length} indices`);
      await logTaskSuccess(taskId, syncCount, dataSource);
      return {
        syncCount,
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
    logError('Sync market overview failed', { error: e });
    await logTaskFailed(taskId, errorMsg, syncCount);
    throw e;
  }
}
