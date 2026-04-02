import { Pool } from 'pg';
import { createPgPool } from '../src/pg-connection.ts';
import { config } from '../src/config.ts';
import { ensureControlPlaneSchema } from '../src/pg-store.ts';
import { toCanonicalSessionKey } from '@iclaw/shared';

type SchemaName = 'app' | 'public';

function migrateLegacySessionKey(value?: string | null): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    return toCanonicalSessionKey();
  }
  if (normalized.startsWith('agent:main:')) {
    return toCanonicalSessionKey(normalized.slice('agent:main:'.length));
  }
  const legacyAgentMainMatch = normalized.match(/^agent:(.+):main$/);
  if (legacyAgentMainMatch?.[1]) {
    return toCanonicalSessionKey(legacyAgentMainMatch[1]);
  }
  if (normalized.includes(':')) {
    throw new Error(`Unsupported legacy session key: ${normalized}`);
  }
  return toCanonicalSessionKey(normalized);
}

async function relationExists(pool: Pool, schemaName: SchemaName, tableName: string): Promise<boolean> {
  const result = await pool.query<{ relation_kind: string | null }>(
    `select (select c.relkind::text from pg_class c where c.oid = to_regclass($1)) as relation_kind`,
    [`${schemaName}.${tableName}`],
  );
  return result.rows[0]?.relation_kind === 'r';
}

async function migrateRunGrants(pool: Pool, schemaName: SchemaName): Promise<number> {
  if (!(await relationExists(pool, schemaName, 'run_grants'))) {
    return 0;
  }

  const result = await pool.query<{ id: string; metadata: Record<string, unknown> | null }>(
    `select id, metadata from ${schemaName}.run_grants`,
  );

  let updated = 0;
  for (const row of result.rows) {
    const metadata = row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {};
    const currentSessionKey =
      typeof metadata.session_key === 'string' ? metadata.session_key : typeof metadata.sessionKey === 'string' ? metadata.sessionKey : null;
    const canonicalSessionKey = migrateLegacySessionKey(currentSessionKey);

    let changed = currentSessionKey !== canonicalSessionKey;
    metadata.session_key = canonicalSessionKey;
    delete metadata.sessionKey;

    const billingSummary =
      metadata.billing_summary && typeof metadata.billing_summary === 'object' && !Array.isArray(metadata.billing_summary)
        ? { ...(metadata.billing_summary as Record<string, unknown>) }
        : null;
    if (billingSummary) {
      const summarySessionKey =
        typeof billingSummary.session_key === 'string'
          ? billingSummary.session_key
          : typeof billingSummary.sessionKey === 'string'
            ? billingSummary.sessionKey
            : canonicalSessionKey;
      const canonicalSummarySessionKey = migrateLegacySessionKey(summarySessionKey);
      if (summarySessionKey !== canonicalSummarySessionKey || !('session_key' in billingSummary) || 'sessionKey' in billingSummary) {
        changed = true;
      }
      billingSummary.session_key = canonicalSummarySessionKey;
      delete billingSummary.sessionKey;
      metadata.billing_summary = billingSummary;
    }

    if (!changed) {
      continue;
    }

    await pool.query(
      `update ${schemaName}.run_grants set metadata = $2::jsonb where id = $1`,
      [row.id, JSON.stringify(metadata)],
    );
    updated += 1;
  }

  await pool.query(`drop index if exists ${schemaName}.idx_run_grants_billing_session_lookup`);
  await pool.query(
    `
      create index if not exists idx_run_grants_billing_session_lookup
        on ${schemaName}.run_grants (
          user_id,
          (coalesce(metadata->>'session_key', 'agent:main:main')),
          (coalesce(used_at, created_at)) desc,
          created_at desc
        )
        where status = 'settled' and metadata ? 'billing_summary'
    `,
  );

  return updated;
}

async function migrateChatConversations(pool: Pool, schemaName: SchemaName): Promise<{
  conversations: number;
  sessionsUpdated: number;
  sessionsDeleted: number;
  handoffs: number;
}> {
  let conversations = 0;
  let sessionsUpdated = 0;
  let sessionsDeleted = 0;
  let handoffs = 0;

  if (await relationExists(pool, schemaName, 'chat_conversations')) {
    const result = await pool.query<{ id: string; active_session_key: string }>(
      `select id, active_session_key from ${schemaName}.chat_conversations`,
    );
    for (const row of result.rows) {
      const canonicalSessionKey = migrateLegacySessionKey(row.active_session_key);
      if (canonicalSessionKey === row.active_session_key) {
        continue;
      }
      await pool.query(
        `update ${schemaName}.chat_conversations set active_session_key = $2 where id = $1`,
        [row.id, canonicalSessionKey],
      );
      conversations += 1;
    }
  }

  if (await relationExists(pool, schemaName, 'chat_conversation_sessions')) {
    const result = await pool.query<{
      id: string;
      conversation_id: string;
      session_key: string;
      is_active: boolean;
      joined_at: Date;
      left_at: Date | null;
    }>(
      `
        select id, conversation_id, session_key, is_active, joined_at, left_at
        from ${schemaName}.chat_conversation_sessions
        order by is_active desc, joined_at desc, id asc
      `,
    );

    const grouped = new Map<string, typeof result.rows>();
    for (const row of result.rows) {
      const canonicalSessionKey = migrateLegacySessionKey(row.session_key);
      const key = `${row.conversation_id}:${canonicalSessionKey}`;
      const list = grouped.get(key);
      if (list) {
        list.push(row);
      } else {
        grouped.set(key, [row]);
      }
    }

    for (const rows of grouped.values()) {
      const [keeper, ...duplicates] = rows;
      const canonicalSessionKey = migrateLegacySessionKey(keeper.session_key);

      if (keeper.session_key !== canonicalSessionKey) {
        await pool.query(
          `update ${schemaName}.chat_conversation_sessions set session_key = $2 where id = $1`,
          [keeper.id, canonicalSessionKey],
        );
        sessionsUpdated += 1;
      }

      if (duplicates.length === 0) {
        continue;
      }

      if (duplicates.some((row) => row.is_active) && !keeper.is_active) {
        await pool.query(
          `update ${schemaName}.chat_conversation_sessions set is_active = true, left_at = null where id = $1`,
          [keeper.id],
        );
      }

      for (const duplicate of duplicates) {
        await pool.query(`delete from ${schemaName}.chat_conversation_sessions where id = $1`, [duplicate.id]);
        sessionsDeleted += 1;
      }
    }
  }

  if (await relationExists(pool, schemaName, 'chat_conversation_handoffs')) {
    const result = await pool.query<{
      id: string;
      from_session_key: string;
      to_session_key: string;
    }>(
      `select id, from_session_key, to_session_key from ${schemaName}.chat_conversation_handoffs`,
    );
    for (const row of result.rows) {
      const canonicalFrom = migrateLegacySessionKey(row.from_session_key);
      const canonicalTo = migrateLegacySessionKey(row.to_session_key);
      if (canonicalFrom === row.from_session_key && canonicalTo === row.to_session_key) {
        continue;
      }
      await pool.query(
        `update ${schemaName}.chat_conversation_handoffs set from_session_key = $2, to_session_key = $3 where id = $1`,
        [row.id, canonicalFrom, canonicalTo],
      );
      handoffs += 1;
    }
  }

  return {
    conversations,
    sessionsUpdated,
    sessionsDeleted,
    handoffs,
  };
}

async function migrateSchema(pool: Pool, schemaName: SchemaName) {
  await pool.query('begin');
  try {
    const runGrants = await migrateRunGrants(pool, schemaName);
    const chats = await migrateChatConversations(pool, schemaName);
    await pool.query('commit');
    return {
      schema: schemaName,
      runGrants,
      ...chats,
    };
  } catch (error) {
    await pool.query('rollback');
    throw error;
  }
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = createPgPool(config.databaseUrl, 'script:migrate-canonical-session-keys');
  try {
    const migrated = [];
    migrated.push(await migrateSchema(pool, 'app'));
    migrated.push(await migrateSchema(pool, 'public'));
    await ensureControlPlaneSchema(config.databaseUrl);
    process.stdout.write(`${JSON.stringify({ ok: true, migrated }, null, 2)}\n`);
  } finally {
    await pool.end();
  }
}

await main();
