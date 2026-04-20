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
    poolInstance = createPgPool(controlPlaneConfig.databaseUrl, 'data-sync:industry-concept');
  }
  return poolInstance;
}

export interface IndustryRelation {
  stock_code: string;
  industry_code: string;
  industry_name: string;
}

export interface ConceptRelation {
  stock_code: string;
  concept_code: string;
  concept_name: string;
}

interface FetchResult {
  industry_relations: IndustryRelation[];
  concept_relations: ConceptRelation[];
}

type SyncTaskExecutionResult = {
  syncCount: number;
  dataSource: string;
};

export async function syncIndustryConcept(): Promise<SyncTaskExecutionResult> {
  const scriptPath = path.join(__dirname, '../python-scripts/fetch_industry_concept.py');
  const pool = getPool();
  const taskId = await logTaskStart('sync_industry_concept');

  let syncCount = 0;
  const dataSource = 'akshare+efinance';

  try {
    const result = await runPythonScript<FetchResult>(scriptPath, [], 600000);
    const { industry_relations, concept_relations } = result;

    logInfo(`Fetched ${industry_relations.length} industry relations, ${concept_relations.length} concept relations`);
    syncCount = industry_relations.length + concept_relations.length;

    if (industry_relations.length < 4000) {
      throw new Error(`Fetched only ${industry_relations.length} industry relations, data incomplete, abort sync`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`TRUNCATE TABLE stock_industry_relation`);
      await client.query(`TRUNCATE TABLE stock_concept_relation`);

      const industryInsertQuery = `
        INSERT INTO stock_industry_relation (stock_code, industry_code, industry_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (stock_code, industry_code) DO NOTHING;
      `;

      for (const rel of industry_relations) {
        await client.query(industryInsertQuery, [rel.stock_code, rel.industry_code, rel.industry_name]);
      }

      const conceptInsertQuery = `
        INSERT INTO stock_concept_relation (stock_code, concept_code, concept_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (stock_code, concept_code) DO NOTHING;
      `;

      for (const rel of concept_relations) {
        await client.query(conceptInsertQuery, [rel.stock_code, rel.concept_code, rel.concept_name]);
      }

      const industryCountResult = await client.query(`SELECT COUNT(*) FROM stock_industry_relation`);
      const industryCount = parseInt(industryCountResult.rows[0].count, 10);
      const conceptCountResult = await client.query(`SELECT COUNT(*) FROM stock_concept_relation`);
      const conceptCount = parseInt(conceptCountResult.rows[0].count, 10);
      syncCount = industryCount + conceptCount;

      if (industryCount < 4000) {
        throw new Error(`Inserted only ${industryCount} industry relations, data incomplete, rollback`);
      }

      await client.query('COMMIT');
      logInfo(`Successfully synced ${industryCount} industry relations, ${conceptCount} concept relations`);
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
    logError('Sync industry concept failed', { error: e });
    await logTaskFailed(taskId, errorMsg, syncCount);
    throw e;
  }
}
