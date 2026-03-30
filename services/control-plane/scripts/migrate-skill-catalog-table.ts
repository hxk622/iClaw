import {config} from '../src/config.ts';
import {ensureControlPlaneSchema} from '../src/pg-store.ts';

import {Pool} from 'pg';

type SchemaName = 'app' | 'public';

async function migrateSchema(pool: Pool, schemaName: SchemaName): Promise<void> {
  const relationCheck = await pool.query<{
    legacy_table_kind: string | null;
    cloud_relation_kind: string | null;
  }>(
    `
      select
        (select c.relkind::text from pg_class c where c.oid = to_regclass($1)) as legacy_table_kind,
        (select c.relkind::text from pg_class c where c.oid = to_regclass($2)) as cloud_relation_kind
    `,
    [`${schemaName}.skill_catalog_entries`, `${schemaName}.cloud_skill_catalog`],
  );
  const current = relationCheck.rows[0];
  if (current?.legacy_table_kind !== 'r') {
    return;
  }
  if (current.cloud_relation_kind === 'r') {
    return;
  }

  await pool.query('begin');
  try {
    if (current.cloud_relation_kind === 'v') {
      await pool.query(`drop view if exists ${schemaName}.cloud_skill_catalog`);
    }
    await pool.query(`alter table ${schemaName}.skill_catalog_entries rename to cloud_skill_catalog`);

    const indexRows = await pool.query<{indexname: string}>(
      `
        select indexname
        from pg_indexes
        where schemaname = $1
          and tablename = 'cloud_skill_catalog'
      `,
      [schemaName],
    );
    for (const row of indexRows.rows) {
      if (row.indexname.includes('skill_catalog_entries')) {
        const nextName = row.indexname.replaceAll('skill_catalog_entries', 'cloud_skill_catalog');
        await pool.query(`alter index ${schemaName}."${row.indexname}" rename to "${nextName}"`);
      }
    }
    await pool.query('commit');
  } catch (error) {
    await pool.query('rollback');
    throw error;
  }
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({connectionString: config.databaseUrl});
  try {
    await migrateSchema(pool, 'app');
    await migrateSchema(pool, 'public');
  } finally {
    await pool.end();
  }

  await ensureControlPlaneSchema(config.databaseUrl);
  process.stdout.write(`${JSON.stringify({ok: true, migrated: ['app', 'public']}, null, 2)}\n`);
}

await main();
