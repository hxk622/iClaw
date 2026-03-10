import {randomUUID} from 'node:crypto';

import {Pool, type PoolClient} from 'pg';

import type {
  CreateUserInput,
  CreditLedgerRecord,
  OAuthAccountRecord,
  OAuthProvider,
  RunGrantRecord,
  SessionRecord,
  SessionTokenPair,
  UsageEventInput,
  UsageEventResult,
  UserRecord,
  WorkspaceBackupInput,
  WorkspaceBackupRecord,
} from './domain.ts';
import type {ControlPlaneStore} from './store.ts';

type UserRow = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  passwordHash: string | null;
  status: 'active';
  createdAt: Date;
  updatedAt: Date;
};

type SessionRow = {
  session_id: string;
  user_id: string;
  access_token_hash: string;
  access_token_expires_at: Date;
  refresh_token_hash: string;
  refresh_token_expires_at: Date;
  created_at: Date;
};

type CreditLedgerRow = {
  id: string;
  user_id: string;
  event_type: string;
  delta: string | number;
  balance_after: string | number;
  created_at: Date;
};

type UsageEventLookupRow = {
  event_id: string;
  credit_cost: string | number;
};

type OAuthAccountRow = {
  user_id: string;
  provider: OAuthProvider;
  provider_id: string;
  created_at: Date;
};

type RunGrantRow = {
  id: string;
  user_id: string;
  nonce: string;
  max_input_tokens: number;
  max_output_tokens: number;
  credit_limit: string | number;
  expires_at: Date;
  metadata: Record<string, unknown> | null;
  created_at: Date;
};

type WorkspaceBackupRow = {
  user_id: string;
  identity_md: string;
  user_md: string;
  soul_md: string;
  agents_md: string;
  created_at: Date;
  updated_at: Date;
};

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.displayName || '',
    avatarUrl: row.avatarUrl || null,
    passwordHash: row.passwordHash,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapSessionRow(row: SessionRow): SessionRecord {
  return {
    id: row.session_id,
    userId: row.user_id,
    accessTokenHash: row.access_token_hash,
    refreshTokenHash: row.refresh_token_hash,
    accessTokenExpiresAt: row.access_token_expires_at.getTime(),
    refreshTokenExpiresAt: row.refresh_token_expires_at.getTime(),
    createdAt: row.created_at.toISOString(),
  };
}

function normalizeUsernameLookup(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function mapWorkspaceBackupRow(row: WorkspaceBackupRow): WorkspaceBackupRecord {
  return {
    userId: row.user_id,
    identityMd: row.identity_md,
    userMd: row.user_md,
    soulMd: row.soul_md,
    agentsMd: row.agents_md,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class PgControlPlaneStore implements ControlPlaneStore {
  readonly storageLabel = 'postgres';
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({connectionString});
  }

  async getUserByIdentifier(identifier: string): Promise<UserRecord | null> {
    const normalized = normalizeUsernameLookup(identifier);
    const result = await this.pool.query<UserRow>(
      `
        select
          u.id,
          u.username,
          e.email,
          u.display_name as "displayName",
          u.avatar_url as "avatarUrl",
          c.password_hash as "passwordHash",
          u.status,
          u.created_at as "createdAt",
          u.updated_at as "updatedAt"
        from users u
        join user_emails e on e.user_id = u.id and e.is_primary = true
        left join user_password_credentials c on c.user_id = u.id
        where lower(u.username) = $1 or e.email = $1
        limit 1
      `,
      [normalized],
    );

    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.trim().toLowerCase();
    const result = await this.pool.query<UserRow>(
      `
        select
          u.id,
          u.username,
          e.email,
          u.display_name as "displayName",
          u.avatar_url as "avatarUrl",
          c.password_hash as "passwordHash",
          u.status,
          u.created_at as "createdAt",
          u.updated_at as "updatedAt"
        from users u
        join user_emails e on e.user_id = u.id and e.is_primary = true
        left join user_password_credentials c on c.user_id = u.id
        where e.email = $1
        limit 1
      `,
      [normalized],
    );
    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async getUserByOAuthAccount(provider: OAuthProvider, providerId: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRow>(
      `
        select
          u.id,
          u.username,
          e.email,
          u.display_name as "displayName",
          u.avatar_url as "avatarUrl",
          c.password_hash as "passwordHash",
          u.status,
          u.created_at as "createdAt",
          u.updated_at as "updatedAt"
        from user_oauth_accounts oa
        join users u on u.id = oa.user_id
        join user_emails e on e.user_id = u.id and e.is_primary = true
        left join user_password_credentials c on c.user_id = u.id
        where oa.provider = $1 and oa.provider_id = $2
        limit 1
      `,
      [provider, providerId],
    );
    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async linkOAuthAccount(userId: string, provider: OAuthProvider, providerId: string): Promise<OAuthAccountRecord> {
    const result = await this.pool.query<OAuthAccountRow>(
      `
        insert into user_oauth_accounts (id, user_id, provider, provider_id, created_at)
        values ($1, $2, $3, $4, now())
        on conflict (provider, provider_id)
        do update set user_id = excluded.user_id
        returning user_id, provider, provider_id, created_at
      `,
      [randomUUID(), userId, provider, providerId],
    );

    return {
      userId: result.rows[0].user_id,
      provider: result.rows[0].provider,
      providerId: result.rows[0].provider_id,
      createdAt: result.rows[0].created_at.toISOString(),
    };
  }

  async unlinkOAuthAccount(userId: string, provider: OAuthProvider): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from user_oauth_accounts
        where user_id = $1 and provider = $2
      `,
      [userId, provider],
    );
    return (result.rowCount || 0) > 0;
  }

  async getOAuthAccountsForUser(userId: string): Promise<OAuthAccountRecord[]> {
    const result = await this.pool.query<OAuthAccountRow>(
      `
        select user_id, provider, provider_id, created_at
        from user_oauth_accounts
        where user_id = $1
        order by created_at asc
      `,
      [userId],
    );
    return result.rows.map((row) => ({
      userId: row.user_id,
      provider: row.provider,
      providerId: row.provider_id,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async updateUserProfile(userId: string, input: {displayName?: string; avatarUrl?: string | null}): Promise<UserRecord | null> {
    const displayName = input.displayName?.trim();
    const avatarUrl = input.avatarUrl === undefined ? undefined : input.avatarUrl?.trim() || null;
    if (displayName === undefined && avatarUrl === undefined) {
      return this.getUserById(userId);
    }
    const fields: string[] = [];
    const values: Array<string | null> = [userId];
    let index = 2;
    if (displayName !== undefined) {
      fields.push(`display_name = $${index++}`);
      values.push(displayName);
    }
    if (avatarUrl !== undefined) {
      fields.push(`avatar_url = $${index++}`);
      values.push(avatarUrl);
    }
    if (fields.length === 0) {
      return this.getUserById(userId);
    }
    await this.pool.query(
      `
        update users
        set ${fields.join(', ')}, updated_at = now()
        where id = $1
      `,
      values,
    );
    return this.getUserById(userId);
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<UserRecord | null> {
    await this.pool.query(
      `
        insert into user_password_credentials (
          user_id,
          password_hash,
          password_algo,
          password_updated_at,
          created_at,
          updated_at
        )
        values ($1, $2, 'scrypt', now(), now(), now())
        on conflict (user_id)
        do update set
          password_hash = excluded.password_hash,
          password_algo = excluded.password_algo,
          password_updated_at = now(),
          updated_at = now()
      `,
      [userId, passwordHash],
    );
    return this.getUserById(userId);
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const normalizedUsername = normalizeUsernameLookup(input.username);
    const existingUser = await this.getUserByIdentifier(input.username);
    if (existingUser && normalizeUsernameLookup(existingUser.username) === normalizedUsername) {
      throw new Error('USERNAME_TAKEN');
    }

    const client = await this.pool.connect();
    const userId = randomUUID();
    const now = new Date();

    try {
      await client.query('begin');
      await client.query(
        `
          insert into users (id, username, display_name, avatar_url, status, created_at, updated_at)
          values ($1, $2, $3, $4, 'active', $5, $5)
        `,
        [userId, input.username.trim().replace(/\s+/g, ' '), input.displayName, input.avatarUrl?.trim() || null, now],
      );
      await client.query(
        `
          insert into user_emails (id, user_id, email, is_primary, created_at)
          values ($1, $2, $3, true, $4)
        `,
        [randomUUID(), userId, input.email, now],
      );
      if (input.passwordHash?.trim()) {
        await client.query(
          `
            insert into user_password_credentials (
              user_id,
              password_hash,
              password_algo,
              password_updated_at,
              created_at,
              updated_at
            )
            values ($1, $2, 'scrypt', $3, $3, $3)
          `,
          [userId, input.passwordHash, now],
        );
      }
      await client.query(
        `
          insert into credit_accounts (user_id, balance, updated_at)
          values ($1, $2, $3)
        `,
        [userId, input.initialCreditBalance, now],
      );
      await client.query(
        `
          insert into credit_ledger (id, user_id, event_type, delta, balance_after, created_at)
          values ($1, $2, 'signup_grant', $3, $3, $4)
        `,
        [randomUUID(), userId, input.initialCreditBalance, now],
      );
      await client.query('commit');
      return {
        id: userId,
        username: input.username.trim().replace(/\s+/g, ' '),
        email: input.email,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl?.trim() || null,
        passwordHash: input.passwordHash?.trim() || null,
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async createSession(userId: string, tokens: SessionTokenPair): Promise<SessionRecord> {
    return this.insertSession(this.pool, userId, tokens);
  }

  async replaceSession(refreshTokenHash: string, tokens: SessionTokenPair): Promise<SessionRecord | null> {
    const client = await this.pool.connect();

    try {
      await client.query('begin');
      const existing = await client.query<{device_session_id: string; user_id: string}>(
        `
          select device_session_id, user_id
          from refresh_tokens
          where token_hash = $1
            and revoked_at is null
            and expires_at > now()
          limit 1
        `,
        [refreshTokenHash],
      );

      const row = existing.rows[0];
      if (!row) {
        await client.query('rollback');
        return null;
      }

      await client.query(
        `
          update access_tokens
          set revoked_at = now()
          where device_session_id = $1 and revoked_at is null
        `,
        [row.device_session_id],
      );
      await client.query(
        `
          update refresh_tokens
          set revoked_at = now()
          where device_session_id = $1 and revoked_at is null
        `,
        [row.device_session_id],
      );

      const session = await this.insertSession(client, row.user_id, tokens);
      await client.query('commit');
      return session;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async getSessionByAccessToken(accessTokenHash: string): Promise<SessionRecord | null> {
    const result = await this.pool.query<SessionRow>(
      `
        select
          ds.id as session_id,
          ds.user_id,
          at.token_hash as access_token_hash,
          at.expires_at as access_token_expires_at,
          rt.token_hash as refresh_token_hash,
          rt.expires_at as refresh_token_expires_at,
          ds.created_at
        from access_tokens at
        join device_sessions ds on ds.id = at.device_session_id
        join refresh_tokens rt on rt.device_session_id = ds.id and rt.revoked_at is null
        where at.token_hash = $1
          and at.revoked_at is null
        order by rt.created_at desc
        limit 1
      `,
      [accessTokenHash],
    );

    return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
  }

  async getSessionByRefreshToken(refreshTokenHash: string): Promise<SessionRecord | null> {
    const result = await this.pool.query<SessionRow>(
      `
        select
          ds.id as session_id,
          ds.user_id,
          at.token_hash as access_token_hash,
          at.expires_at as access_token_expires_at,
          rt.token_hash as refresh_token_hash,
          rt.expires_at as refresh_token_expires_at,
          ds.created_at
        from refresh_tokens rt
        join device_sessions ds on ds.id = rt.device_session_id
        join access_tokens at on at.device_session_id = ds.id and at.revoked_at is null
        where rt.token_hash = $1
          and rt.revoked_at is null
        order by at.created_at desc
        limit 1
      `,
      [refreshTokenHash],
    );

    return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRow>(
      `
        select
          u.id,
          u.username,
          e.email,
          u.display_name as "displayName",
          u.avatar_url as "avatarUrl",
          c.password_hash as "passwordHash",
          u.status,
          u.created_at as "createdAt",
          u.updated_at as "updatedAt"
        from users u
        join user_emails e on e.user_id = u.id and e.is_primary = true
        left join user_password_credentials c on c.user_id = u.id
        where u.id = $1
        limit 1
      `,
      [userId],
    );
    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async getCreditBalance(userId: string): Promise<number> {
    const result = await this.pool.query<{balance: string | number}>(
      `select balance from credit_accounts where user_id = $1 limit 1`,
      [userId],
    );
    const balance = result.rows[0]?.balance;
    return typeof balance === 'string' ? Number.parseInt(balance, 10) : balance || 0;
  }

  async getCreditLedger(userId: string): Promise<CreditLedgerRecord[]> {
    const result = await this.pool.query<CreditLedgerRow>(
      `
        select id, user_id, event_type, delta, balance_after, created_at
        from credit_ledger
        where user_id = $1
        order by created_at desc
      `,
      [userId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      eventType: row.event_type as 'signup_grant',
      delta: typeof row.delta === 'string' ? Number.parseInt(row.delta, 10) : row.delta,
      balanceAfter:
        typeof row.balance_after === 'string' ? Number.parseInt(row.balance_after, 10) : row.balance_after,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async getRunGrantById(grantId: string): Promise<RunGrantRecord | null> {
    const result = await this.pool.query<RunGrantRow>(
      `
        select id, user_id, nonce, max_input_tokens, max_output_tokens, credit_limit, expires_at, metadata, created_at
        from run_grants
        where id = $1
        limit 1
      `,
      [grantId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const metadata = row.metadata || {};
    return {
      id: row.id,
      userId: row.user_id,
      sessionKey: typeof metadata.session_key === 'string' ? metadata.session_key : 'main',
      client: typeof metadata.client === 'string' ? metadata.client : 'desktop',
      nonce: row.nonce,
      maxInputTokens: row.max_input_tokens,
      maxOutputTokens: row.max_output_tokens,
      creditLimit: typeof row.credit_limit === 'string' ? Number.parseInt(row.credit_limit, 10) : row.credit_limit,
      expiresAt: row.expires_at.toISOString(),
      signature: typeof metadata.signature === 'string' ? metadata.signature : '',
      createdAt: row.created_at.toISOString(),
    };
  }

  async createRunGrant(input: {
    userId: string;
    sessionKey: string;
    client: string;
    nonce: string;
    maxInputTokens: number;
    maxOutputTokens: number;
    creditLimit: number;
    expiresAt: string;
    signature: string;
  }): Promise<RunGrantRecord> {
    const grantId = randomUUID();
    const createdAt = new Date();
    await this.pool.query(
      `
        insert into run_grants (
          id,
          user_id,
          status,
          nonce,
          max_input_tokens,
          max_output_tokens,
          credit_limit,
          expires_at,
          metadata,
          created_at
        )
        values ($1, $2, 'issued', $3, $4, $5, $6, $7, $8::jsonb, $9)
      `,
      [
        grantId,
        input.userId,
        input.nonce,
        input.maxInputTokens,
        input.maxOutputTokens,
        input.creditLimit,
        input.expiresAt,
        JSON.stringify({
          session_key: input.sessionKey,
          client: input.client,
          signature: input.signature,
        }),
        createdAt,
      ],
    );

    return {
      id: grantId,
      userId: input.userId,
      sessionKey: input.sessionKey,
      client: input.client,
      nonce: input.nonce,
      maxInputTokens: input.maxInputTokens,
      maxOutputTokens: input.maxOutputTokens,
      creditLimit: input.creditLimit,
      expiresAt: input.expiresAt,
      signature: input.signature,
      createdAt: createdAt.toISOString(),
    };
  }

  async recordUsageEvent(userId: string, input: Required<UsageEventInput>): Promise<UsageEventResult> {
    const client = await this.pool.connect();

    try {
      await client.query('begin');

      const existing = await client.query<UsageEventLookupRow>(
        `select event_id, credit_cost from usage_events where event_id = $1 limit 1`,
        [input.event_id],
      );
      if (existing.rows[0]) {
        const balance = await this.lockAndReadBalance(client, userId);
        await client.query('commit');
        return {
          accepted: true,
          balanceAfter: balance,
        };
      }

      const balance = await this.lockAndReadBalance(client, userId);
      const nextBalance = balance - input.credit_cost;

      await client.query(
        `
          insert into usage_events (
            id,
            event_id,
            user_id,
            run_grant_id,
            input_tokens,
            output_tokens,
            credit_cost,
            provider,
            model,
            created_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
        `,
        [
          randomUUID(),
          input.event_id,
          userId,
          input.grant_id || null,
          input.input_tokens,
          input.output_tokens,
          input.credit_cost,
          input.provider || null,
          input.model || null,
        ],
      );

      await client.query(
        `update credit_accounts set balance = $2, updated_at = now() where user_id = $1`,
        [userId, nextBalance],
      );
      await client.query(
        `
          insert into credit_ledger (
            id,
            user_id,
            event_type,
            delta,
            balance_after,
            reference_type,
            reference_id,
            metadata,
            created_at
          )
          values ($1, $2, 'usage_debit', $3, $4, 'usage_event', $5, $6::jsonb, now())
        `,
        [
          randomUUID(),
          userId,
          -input.credit_cost,
          nextBalance,
          input.event_id,
          JSON.stringify({
            grant_id: input.grant_id,
            input_tokens: input.input_tokens,
            output_tokens: input.output_tokens,
            provider: input.provider,
            model: input.model,
          }),
        ],
      );

      await client.query('commit');
      return {
        accepted: true,
        balanceAfter: nextBalance,
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async getWorkspaceBackup(userId: string): Promise<WorkspaceBackupRecord | null> {
    const result = await this.pool.query<WorkspaceBackupRow>(
      `
        select user_id, identity_md, user_md, soul_md, agents_md, created_at, updated_at
        from user_workspace_backups
        where user_id = $1
        limit 1
      `,
      [userId],
    );
    return result.rows[0] ? mapWorkspaceBackupRow(result.rows[0]) : null;
  }

  async saveWorkspaceBackup(userId: string, input: WorkspaceBackupInput): Promise<WorkspaceBackupRecord> {
    const result = await this.pool.query<WorkspaceBackupRow>(
      `
        insert into user_workspace_backups (
          user_id,
          identity_md,
          user_md,
          soul_md,
          agents_md,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, now(), now())
        on conflict (user_id)
        do update set
          identity_md = excluded.identity_md,
          user_md = excluded.user_md,
          soul_md = excluded.soul_md,
          agents_md = excluded.agents_md,
          updated_at = now()
        returning user_id, identity_md, user_md, soul_md, agents_md, created_at, updated_at
      `,
      [userId, input.identity_md, input.user_md, input.soul_md, input.agents_md],
    );
    return mapWorkspaceBackupRow(result.rows[0]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async insertSession(
    db: Pool | PoolClient,
    userId: string,
    tokens: SessionTokenPair,
  ): Promise<SessionRecord> {
    const sessionId = randomUUID();
    const now = new Date();
    const accessTokenExpiresAt = new Date(tokens.accessTokenExpiresAt);
    const refreshTokenExpiresAt = new Date(tokens.refreshTokenExpiresAt);

    await db.query(
      `
        insert into device_sessions (id, user_id, device_id, client_type, status, created_at)
        values ($1, $2, $3, $4, 'active', $5)
      `,
      [sessionId, userId, tokens.deviceId, tokens.clientType, now],
    );
    await db.query(
      `
        insert into access_tokens (id, user_id, device_session_id, token_hash, expires_at, created_at)
        values ($1, $2, $3, $4, $5, $6)
      `,
      [randomUUID(), userId, sessionId, tokens.accessTokenHash, accessTokenExpiresAt, now],
    );
    await db.query(
      `
        insert into refresh_tokens (id, user_id, device_session_id, token_hash, expires_at, created_at)
        values ($1, $2, $3, $4, $5, $6)
      `,
      [randomUUID(), userId, sessionId, tokens.refreshTokenHash, refreshTokenExpiresAt, now],
    );

    return {
      id: sessionId,
      userId,
      accessTokenHash: tokens.accessTokenHash,
      refreshTokenHash: tokens.refreshTokenHash,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      createdAt: now.toISOString(),
    };
  }

  private async lockAndReadBalance(client: PoolClient, userId: string): Promise<number> {
    const result = await client.query<{balance: string | number}>(
      `select balance from credit_accounts where user_id = $1 for update`,
      [userId],
    );
    const balance = result.rows[0]?.balance;
    return typeof balance === 'string' ? Number.parseInt(balance, 10) : balance || 0;
  }
}
