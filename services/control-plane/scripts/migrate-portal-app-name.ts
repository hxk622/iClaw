import {Pool, type PoolClient} from 'pg';
import {config} from '../src/config.ts';

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

const REWRITE_VALUE_KEYS = new Set([
  'appName',
  'app_name',
  'brandId',
  'brand_id',
  'tenantKey',
  'tenant_key',
  'namespace',
  'scopeKey',
  'scope_key',
]);

function rewriteString(value: string, fromAppName: string, toAppName: string, keyName = ''): string {
  let next = value;
  if (REWRITE_VALUE_KEYS.has(keyName) && value === fromAppName) {
    next = toAppName;
  }
  next = next.replaceAll(`app_name=${fromAppName}`, `app_name=${toAppName}`);
  next = next.replaceAll(`appName=${fromAppName}`, `appName=${toAppName}`);
  return next;
}

function rewriteJsonValue<T>(value: T, fromAppName: string, toAppName: string, keyName = ''): T {
  if (typeof value === 'string') {
    return rewriteString(value, fromAppName, toAppName, keyName) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteJsonValue(item, fromAppName, toAppName)) as T;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      rewriteJsonValue(item, fromAppName, toAppName, key),
    ]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

async function updateJsonbColumn(
  client: PoolClient,
  tableName: string,
  columnName: string,
  whereClause: string,
  fromAppName: string,
  toAppName: string,
) {
  const rows = await client.query<{id?: string; payload: unknown}>(
    `select ctid::text as id, ${columnName} as payload from ${tableName} where ${whereClause}`,
  );
  for (const row of rows.rows) {
    const nextPayload = rewriteJsonValue(row.payload, fromAppName, toAppName);
    await client.query(
      `update ${tableName} set ${columnName} = $1::jsonb where ctid::text = $2`,
      [JSON.stringify(nextPayload || {}), row.id],
    );
  }
}

async function updateTextColumn(
  client: PoolClient,
  tableName: string,
  columnName: string,
  whereClause: string,
  fromAppName: string,
  toAppName: string,
) {
  await client.query(
    `update ${tableName}
        set ${columnName} =
          replace(${columnName}, $1, $2)
      where ${whereClause}`,
    [`app_name=${fromAppName}`, `app_name=${toAppName}`],
  );
}

async function main() {
  const fromAppName = trimString(readArg('--from') || 'licaiclaw').toLowerCase();
  const toAppName = trimString(readArg('--to') || 'caiclaw').toLowerCase();
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  if (!fromAppName || !toAppName) {
    throw new Error('--from and --to are required');
  }
  if (fromAppName === toAppName) {
    throw new Error('--from and --to must be different');
  }

  const pool = new Pool({connectionString: config.databaseUrl});
  const client = await pool.connect();
  try {
    await client.query('begin');

    const sourceApp = await client.query<{
      display_name: string;
      description: string | null;
      status: string;
      default_locale: string;
      config_json: unknown;
      created_at: string;
      updated_at: string;
    }>(
      `select display_name, description, status, default_locale, config_json, created_at, updated_at
         from oem_apps
        where app_name = $1`,
      [fromAppName],
    );
    if (sourceApp.rowCount === 0) {
      throw new Error(`source app not found: ${fromAppName}`);
    }

    const targetApp = await client.query<{app_name: string}>(
      `select app_name from oem_apps where app_name = $1`,
      [toAppName],
    );
    if (targetApp.rowCount > 0) {
      throw new Error(`target app already exists: ${toAppName}`);
    }

    const source = sourceApp.rows[0];
    const nextConfig = rewriteJsonValue(source.config_json, fromAppName, toAppName);

    await client.query(
      `insert into oem_apps (
         app_name, display_name, description, status, default_locale, config_json, created_at, updated_at
       ) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        toAppName,
        source.display_name,
        source.description,
        source.status,
        source.default_locale,
        JSON.stringify(nextConfig || {}),
        source.created_at,
        source.updated_at,
      ],
    );

    const appNameTables = [
      'app_model_runtime_overrides',
      'app_payment_provider_overrides',
      'oem_bundled_skills',
      'oem_bundled_mcps',
      'oem_app_model_bindings',
      'oem_app_menu_bindings',
      'oem_app_recharge_package_bindings',
      'oem_app_composer_control_bindings',
      'oem_app_composer_shortcut_bindings',
      'oem_app_assets',
      'portal_app_marketing_site_state',
      'portal_app_marketing_site_shell_bindings',
      'portal_app_marketing_site_page_bindings',
      'portal_app_marketing_site_block_bindings',
      'oem_app_releases',
      'oem_app_audit_events',
      'user_custom_mcp_library',
      'chat_conversations',
      'desktop_fault_reports',
      'client_metric_events',
      'client_crash_events',
      'client_perf_samples',
    ];

    for (const tableName of appNameTables) {
      await client.query(
        `update ${tableName} set app_name = $1 where app_name = $2`,
        [toAppName, fromAppName],
      );
    }

    const scopeKeyTables = [
      'runtime_release_bindings',
      'runtime_release_binding_history',
      'model_provider_profiles',
      'memory_embedding_profiles',
      'payment_provider_profiles',
    ];

    for (const tableName of scopeKeyTables) {
      await client.query(
        `update ${tableName} set scope_key = $1 where scope_type = 'app' and scope_key = $2`,
        [toAppName, fromAppName],
      );
    }

    await client.query(
      `update payment_orders
          set metadata = jsonb_set(metadata, '{app_name}', to_jsonb($1::text))
        where metadata->>'app_name' = $2`,
      [toAppName, fromAppName],
    );

    await updateTextColumn(client, 'oem_app_assets', 'public_url', `app_name = '${toAppName}' and public_url is not null`, fromAppName, toAppName);
    await updateJsonbColumn(client, 'oem_app_releases', 'snapshot_json', `app_name = '${toAppName}'`, fromAppName, toAppName);
    await updateJsonbColumn(client, 'oem_app_releases', 'summary_json', `app_name = '${toAppName}'`, fromAppName, toAppName);
    await updateJsonbColumn(client, 'oem_app_audit_events', 'payload', `app_name = '${toAppName}'`, fromAppName, toAppName);

    await client.query(`delete from oem_apps where app_name = $1`, [fromAppName]);

    const remaining = await client.query<{count: string}>(
      `select count(*)::text as count from oem_apps where app_name = $1`,
      [fromAppName],
    );
    if (Number.parseInt(remaining.rows[0]?.count || '0', 10) !== 0) {
      throw new Error(`source app still exists after migration: ${fromAppName}`);
    }

    await client.query('commit');
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          fromAppName,
          toAppName,
        },
        null,
        2,
      )}\n`,
    );
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
