import {Pool} from 'pg';

import {config} from '../src/config.ts';
import {buildPgPoolConfig} from '../src/pg-connection.ts';

type TableReport = {
  tableName: string;
  appRows: number;
  publicRows: number;
  pkColumns: string[];
  publicMissingInApp: number | null;
};

const MERGE_BY_PRIMARY_KEY = new Map<string, string[]>([['platform_bundled_mcps', ['mcp_key']]]);

const ARCHIVE_ONLY_PUBLIC_ROWS = new Set([
  'access_tokens',
  'refresh_tokens',
  'device_sessions',
  'credit_accounts',
  'credit_ledger',
  'user_emails',
  'user_password_credentials',
  'users',
]);

function quoteIdent(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function buildBackupSchemaName(): string {
  const now = new Date();
  const parts = [
    now.getUTCFullYear().toString().padStart(4, '0'),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ];
  return `public_shadow_backup_${parts.join('')}`;
}

function parseArgs(argv: string[]): {apply: boolean; backupSchema: string} {
  let apply = false;
  let backupSchema = buildBackupSchemaName();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--apply') {
      apply = true;
      continue;
    }
    if (token === '--backup-schema') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('missing value for --backup-schema');
      }
      backupSchema = next.trim();
      index += 1;
      continue;
    }
    throw new Error(`unsupported argument: ${token}`);
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(backupSchema)) {
    throw new Error(`invalid backup schema: ${backupSchema}`);
  }
  return {apply, backupSchema};
}

async function listDuplicateTables(pool: Pool): Promise<string[]> {
  const result = await pool.query<{relname: string}>(`
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname = 'app'
    intersect
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname = 'public'
    order by 1
  `);
  return result.rows.map((row) => row.relname);
}

async function listPrimaryKeyColumns(pool: Pool, tableName: string): Promise<string[]> {
  const result = await pool.query<{attname: string}>(
    `
      select a.attname
      from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      join pg_class c on c.oid = i.indrelid
      join pg_namespace n on n.oid = c.relnamespace
      where i.indisprimary
        and n.nspname = 'app'
        and c.relname = $1
      order by array_position(i.indkey, a.attnum)
    `,
    [tableName],
  );
  return result.rows.map((row) => row.attname);
}

async function countRows(pool: Pool, schemaName: 'app' | 'public', tableName: string): Promise<number> {
  const result = await pool.query<{count: string}>(`select count(*)::text as count from ${schemaName}.${quoteIdent(tableName)}`);
  return Number(result.rows[0]?.count || 0);
}

async function countPublicMissingInApp(pool: Pool, tableName: string, pkColumns: string[]): Promise<number | null> {
  if (pkColumns.length === 0) {
    return null;
  }
  const joinClause = pkColumns.map((column) => `a.${quoteIdent(column)} = p.${quoteIdent(column)}`).join(' and ');
  const probeColumn = quoteIdent(pkColumns[0]);
  const result = await pool.query<{count: string}>(
    `
      select count(*)::text as count
      from public.${quoteIdent(tableName)} p
      left join app.${quoteIdent(tableName)} a
        on ${joinClause}
      where a.${probeColumn} is null
    `,
  );
  return Number(result.rows[0]?.count || 0);
}

async function buildReport(pool: Pool): Promise<TableReport[]> {
  const duplicates = await listDuplicateTables(pool);
  const items: TableReport[] = [];
  for (const tableName of duplicates) {
    const [appRows, publicRows, pkColumns] = await Promise.all([
      countRows(pool, 'app', tableName),
      countRows(pool, 'public', tableName),
      listPrimaryKeyColumns(pool, tableName),
    ]);
    const publicMissingInApp = publicRows > 0 ? await countPublicMissingInApp(pool, tableName, pkColumns) : 0;
    items.push({
      tableName,
      appRows,
      publicRows,
      pkColumns,
      publicMissingInApp,
    });
  }
  return items;
}

async function backupPublicTables(pool: Pool, backupSchema: string, reports: TableReport[]): Promise<void> {
  await pool.query(`create schema if not exists ${quoteIdent(backupSchema)}`);
  await pool.query(`
    create table if not exists ${quoteIdent(backupSchema)}.cleanup_report (
      table_name text primary key,
      app_rows bigint not null,
      public_rows bigint not null,
      pk_columns jsonb not null,
      public_missing_in_app bigint,
      captured_at timestamptz not null default now()
    )
  `);
  for (const item of reports) {
    await pool.query(`drop table if exists ${quoteIdent(backupSchema)}.${quoteIdent(item.tableName)} cascade`);
    await pool.query(`create table ${quoteIdent(backupSchema)}.${quoteIdent(item.tableName)} as table public.${quoteIdent(item.tableName)}`);
    await pool.query(
      `
        insert into ${quoteIdent(backupSchema)}.cleanup_report (
          table_name,
          app_rows,
          public_rows,
          pk_columns,
          public_missing_in_app
        )
        values ($1, $2, $3, $4::jsonb, $5)
        on conflict (table_name) do update
        set
          app_rows = excluded.app_rows,
          public_rows = excluded.public_rows,
          pk_columns = excluded.pk_columns,
          public_missing_in_app = excluded.public_missing_in_app,
          captured_at = now()
      `,
      [item.tableName, item.appRows, item.publicRows, JSON.stringify(item.pkColumns), item.publicMissingInApp],
    );
  }
}

async function mergePlatformBundledMcps(pool: Pool): Promise<number> {
  const result = await pool.query<{mcp_key: string}>(
    `
      insert into app.platform_bundled_mcps (
        mcp_key,
        sort_order,
        metadata_json,
        active,
        created_at,
        updated_at
      )
      select
        p.mcp_key,
        p.sort_order,
        p.metadata_json,
        p.active,
        p.created_at,
        p.updated_at
      from public.platform_bundled_mcps p
      left join app.platform_bundled_mcps a on a.mcp_key = p.mcp_key
      where a.mcp_key is null
      returning mcp_key
    `,
  );
  return result.rowCount || 0;
}

async function dropPublicDuplicateTables(pool: Pool, reports: TableReport[]): Promise<void> {
  for (const item of reports) {
    await pool.query(`drop table if exists public.${quoteIdent(item.tableName)} cascade`);
  }
}

async function verifyNoDuplicateTables(pool: Pool): Promise<number> {
  const result = await pool.query<{count: string}>(`
    select count(*)::text as count
    from (
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname = 'app'
      intersect
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname = 'public'
    ) t
  `);
  return Number(result.rows[0]?.count || 0);
}

async function main() {
  const {apply, backupSchema} = parseArgs(process.argv.slice(2));
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool(buildPgPoolConfig(config.databaseUrl));
  try {
    const reports = await buildReport(pool);
    const unexpected = reports.filter((item) => {
      if (!item.publicRows || !item.publicMissingInApp || item.publicMissingInApp <= 0) {
        return false;
      }
      if (MERGE_BY_PRIMARY_KEY.has(item.tableName)) {
        return false;
      }
      return !ARCHIVE_ONLY_PUBLIC_ROWS.has(item.tableName);
    });
    if (unexpected.length > 0) {
      throw new Error(`unexpected public-only rows detected: ${JSON.stringify(unexpected, null, 2)}`);
    }

    if (!apply) {
      process.stdout.write(
        `${JSON.stringify({ok: true, dryRun: true, backupSchema, reports}, null, 2)}\n`,
      );
      return;
    }

    await pool.query('begin');
    try {
      await backupPublicTables(pool, backupSchema, reports);
      const mergedPlatformMcps = await mergePlatformBundledMcps(pool);
      await dropPublicDuplicateTables(pool, reports);
      await pool.query('commit');

      const duplicateCount = await verifyNoDuplicateTables(pool);
      process.stdout.write(
        `${JSON.stringify(
          {
            ok: true,
            dryRun: false,
            backupSchema,
            mergedPlatformMcps,
            duplicateCount,
            reports,
          },
          null,
          2,
        )}\n`,
      );
    } catch (error) {
      await pool.query('rollback');
      throw error;
    }
  } finally {
    await pool.end();
  }
}

await main();
