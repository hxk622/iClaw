import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { config as controlPlaneConfig } from '../../../control-plane/src/config.ts';
import { logInfo, logError } from '../../../control-plane/src/logger.ts';
import { createPgPool } from '../../../control-plane/src/pg-connection.ts';
import { runPythonScript } from '../../../control-plane/src/sync-tasks/utils/python-runner.ts';
import { logTaskFailed, logTaskStart, logTaskSuccess } from '../../../control-plane/src/sync-tasks/utils/task-logger.ts';

let poolInstance: any = null;
function getPool() {
  if (!poolInstance) {
    poolInstance = createPgPool(controlPlaneConfig.databaseUrl, 'data-sync:market-news');
  }
  return poolInstance;
}

interface MarketNewsItemInput {
  news_id: string;
  source: string;
  source_item_id: string | null;
  title: string;
  summary: string | null;
  content_url: string | null;
  published_at: string;
  occurred_at: string | null;
  language: string | null;
  market_scope: string;
  importance_score: number | null;
  sentiment_label: string | null;
  related_symbols: string[];
  related_tags: string[];
  metadata: Record<string, unknown>;
}

type SyncTaskExecutionResult = {
  syncCount: number;
  dataSource: string;
};

export async function syncMarketNews(): Promise<SyncTaskExecutionResult> {
  const scriptPath = path.join(__dirname, '../python-scripts/fetch_market_news.py');
  const pool = getPool();
  const taskId = await logTaskStart('sync_market_news');
  let syncCount = 0;
  const dataSource = 'akshare:eastmoney+cls+sina';

  try {
    const items = await runPythonScript<MarketNewsItemInput[]>(scriptPath, [], 120000);
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Fetched no market news items');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const upsertSql = `
        insert into market_news_item (
          news_id,
          source,
          source_item_id,
          title,
          summary,
          content_url,
          published_at,
          occurred_at,
          language,
          market_scope,
          importance_score,
          sentiment_label,
          related_symbols,
          related_tags,
          metadata_json,
          created_at,
          updated_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9, $10, $11, $12, $13::text[], $14::text[], $15::jsonb, now(), now()
        )
        on conflict (news_id) do update set
          source = excluded.source,
          source_item_id = excluded.source_item_id,
          title = excluded.title,
          summary = excluded.summary,
          content_url = excluded.content_url,
          published_at = excluded.published_at,
          occurred_at = excluded.occurred_at,
          language = excluded.language,
          market_scope = excluded.market_scope,
          importance_score = excluded.importance_score,
          sentiment_label = excluded.sentiment_label,
          related_symbols = excluded.related_symbols,
          related_tags = excluded.related_tags,
          metadata_json = excluded.metadata_json,
          updated_at = now()
      `;

      for (const item of items) {
        await client.query(upsertSql, [
          item.news_id,
          item.source,
          item.source_item_id,
          item.title,
          item.summary,
          item.content_url,
          item.published_at,
          item.occurred_at,
          item.language,
          item.market_scope || 'cn',
          item.importance_score,
          item.sentiment_label,
          item.related_symbols || [],
          item.related_tags || [],
          JSON.stringify(item.metadata || {}),
        ]);
      }

      await client.query(`delete from market_news_item where published_at < now() - interval '7 days'`);

      await client.query('COMMIT');
      syncCount = items.length;
      logInfo(`Successfully synced ${items.length} market news items`);
      await logTaskSuccess(taskId, syncCount, dataSource);
      return { syncCount, dataSource };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    logError('Sync market news failed', { error: e });
    await logTaskFailed(taskId, errorMsg, syncCount);
    throw e;
  }
}
