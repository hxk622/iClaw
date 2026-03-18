import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {Pool, type PoolClient} from 'pg';

import type {
  AgentCatalogEntryRecord,
  AgentCatalogRecord,
  CreateUserInput,
  CreditLedgerRecord,
  ImportUserPrivateSkillInput,
  InstallAgentInput,
  InstallSkillInput,
  OAuthAccountRecord,
  OAuthProvider,
  RunGrantRecord,
  SessionRecord,
  SessionTokenPair,
  SkillCatalogEntryRecord,
  SkillCatalogRecord,
  SkillReleaseRecord,
  UpsertSkillCatalogEntryInput,
  UsageEventInput,
  UsageEventResult,
  UserAgentLibraryRecord,
  UserPrivateSkillRecord,
  UserRole,
  UserSkillLibraryRecord,
  UpdateSkillLibraryItemInput,
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
  role: UserRole;
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

type SkillCatalogRow = {
  slug: string;
  name: string;
  description: string;
  visibility: 'showcase' | 'internal';
  market: string | null;
  category: string | null;
  skill_type: string | null;
  publisher: string;
  distribution: 'bundled' | 'cloud';
  tags: unknown;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type AgentCatalogRow = {
  slug: string;
  name: string;
  description: string;
  category: 'finance' | 'content' | 'productivity' | 'commerce' | 'general';
  publisher: string;
  featured: boolean;
  official: boolean;
  tags: unknown;
  capabilities: unknown;
  use_cases: unknown;
  sort_order: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type SkillReleaseRow = {
  skill_slug: string;
  version: string;
  artifact_format: 'tar.gz' | 'zip';
  artifact_url: string | null;
  artifact_sha256: string | null;
  artifact_source_path: string | null;
  published_at: Date;
  created_at: Date;
};

type UserSkillLibraryRow = {
  user_id: string;
  skill_slug: string;
  source: 'cloud' | 'private';
  installed_version: string;
  enabled: boolean;
  installed_at: Date;
  updated_at: Date;
};

type UserPrivateSkillRow = {
  user_id: string;
  slug: string;
  name: string;
  description: string;
  market: string | null;
  category: string | null;
  skill_type: string | null;
  publisher: string;
  tags: unknown;
  source_kind: 'github' | 'local';
  source_url: string | null;
  version: string;
  artifact_format: 'tar.gz' | 'zip';
  artifact_key: string;
  artifact_sha256: string | null;
  created_at: Date;
  updated_at: Date;
};

type UserAgentLibraryRow = {
  user_id: string;
  agent_slug: string;
  installed_at: Date;
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
    role: row.role,
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

function parseSkillTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function mapAgentCatalogRow(row: AgentCatalogRow): AgentCatalogRecord {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    publisher: row.publisher,
    featured: row.featured,
    official: row.official,
    tags: parseStringArray(row.tags),
    capabilities: parseStringArray(row.capabilities),
    useCases: parseStringArray(row.use_cases),
    sortOrder: row.sort_order,
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapSkillCatalogRow(row: SkillCatalogRow): SkillCatalogRecord {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    market: row.market,
    category: row.category,
    skillType: row.skill_type,
    publisher: row.publisher,
    distribution: row.distribution,
    tags: parseSkillTags(row.tags),
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapSkillReleaseRow(row: SkillReleaseRow): SkillReleaseRecord {
  return {
    slug: row.skill_slug,
    version: row.version,
    artifactFormat: row.artifact_format,
    artifactUrl: row.artifact_url,
    artifactSha256: row.artifact_sha256,
    artifactSourcePath: row.artifact_source_path,
    publishedAt: row.published_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

function mapUserSkillLibraryRow(row: UserSkillLibraryRow): UserSkillLibraryRecord {
  return {
    userId: row.user_id,
    slug: row.skill_slug,
    version: row.installed_version,
    source: row.source,
    enabled: row.enabled,
    installedAt: row.installed_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapUserPrivateSkillRow(row: UserPrivateSkillRow): UserPrivateSkillRecord {
  return {
    userId: row.user_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    market: row.market,
    category: row.category,
    skillType: row.skill_type,
    publisher: row.publisher,
    tags: parseSkillTags(row.tags),
    sourceKind: row.source_kind,
    sourceUrl: row.source_url,
    version: row.version,
    artifactFormat: row.artifact_format,
    artifactKey: row.artifact_key,
    artifactSha256: row.artifact_sha256,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapUserAgentLibraryRow(row: UserAgentLibraryRow): UserAgentLibraryRecord {
  return {
    userId: row.user_id,
    slug: row.agent_slug,
    installedAt: row.installed_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const schemaPath = resolve(repoRoot, 'services/control-plane/sql/001_init.sql');

export async function ensureControlPlaneSchema(databaseUrl: string): Promise<void> {
  const sql = await readFile(schemaPath, 'utf8');
  const pool = new Pool({connectionString: databaseUrl});
  try {
    await pool.query(sql);
  } finally {
    await pool.end();
  }
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
          u.role,
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
          u.role,
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
          u.role,
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

  async updateUserRole(userId: string, role: UserRole): Promise<UserRecord | null> {
    await this.pool.query(
      `
        update users
        set role = $2, updated_at = now()
        where id = $1
      `,
      [userId, role],
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
          insert into users (id, username, display_name, avatar_url, role, status, created_at, updated_at)
          values ($1, $2, $3, $4, $5, 'active', $6, $6)
        `,
        [
          userId,
          input.username.trim().replace(/\s+/g, ' '),
          input.displayName,
          input.avatarUrl?.trim() || null,
          input.role || 'user',
          now,
        ],
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
        role: input.role || 'user',
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
      const existing = await client.query<{device_session_id: string; user_id: string; created_at: Date}>(
        `
          select rt.device_session_id, rt.user_id, ds.created_at
          from refresh_tokens rt
          join device_sessions ds on ds.id = rt.device_session_id
          where token_hash = $1
            and rt.revoked_at is null
            and rt.expires_at > now()
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
      await client.query(
        `
          update device_sessions
          set status = 'active', last_seen_at = now(), revoked_at = null
          where id = $1
        `,
        [row.device_session_id],
      );

      const session = await this.insertSessionTokens(
        client,
        row.user_id,
        row.device_session_id,
        tokens,
        row.created_at,
      );
      await client.query('commit');
      return session;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async touchSession(
    sessionId: string,
    expiresAt: {
      accessTokenExpiresAt: number;
      refreshTokenExpiresAt: number;
    },
  ): Promise<SessionRecord | null> {
    const client = await this.pool.connect();

    try {
      await client.query('begin');
      const accessResult = await client.query(
        `
          update access_tokens
          set expires_at = $2
          where device_session_id = $1 and revoked_at is null
        `,
        [sessionId, new Date(expiresAt.accessTokenExpiresAt)],
      );
      const refreshResult = await client.query(
        `
          update refresh_tokens
          set expires_at = $2
          where device_session_id = $1 and revoked_at is null
        `,
        [sessionId, new Date(expiresAt.refreshTokenExpiresAt)],
      );

      if ((accessResult.rowCount || 0) === 0 || (refreshResult.rowCount || 0) === 0) {
        await client.query('rollback');
        return null;
      }

      await client.query(
        `
          update device_sessions
          set last_seen_at = now()
          where id = $1
        `,
        [sessionId],
      );
      const session = await this.getSessionById(sessionId, client);
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
          u.role,
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

  async listAgentCatalog(): Promise<AgentCatalogEntryRecord[]> {
    const result = await this.pool.query<AgentCatalogRow>(
      `
        select
          slug,
          name,
          description,
          category,
          publisher,
          featured,
          official,
          tags,
          capabilities,
          use_cases,
          sort_order,
          active,
          created_at,
          updated_at
        from agent_catalog_entries
        where active = true
        order by sort_order asc, name asc
      `,
    );
    return result.rows.map(mapAgentCatalogRow);
  }

  async getAgentCatalogEntry(slug: string): Promise<AgentCatalogEntryRecord | null> {
    const result = await this.pool.query<AgentCatalogRow>(
      `
        select
          slug,
          name,
          description,
          category,
          publisher,
          featured,
          official,
          tags,
          capabilities,
          use_cases,
          sort_order,
          active,
          created_at,
          updated_at
        from agent_catalog_entries
        where slug = $1
        limit 1
      `,
      [slug],
    );
    return result.rows[0] ? mapAgentCatalogRow(result.rows[0]) : null;
  }

  async listSkillCatalog(): Promise<SkillCatalogEntryRecord[]> {
    return this.listSkillCatalogEntries(`
      select
        slug,
        name,
        description,
        visibility,
        market,
        category,
        skill_type,
        publisher,
        distribution,
        tags,
        active,
        created_at,
        updated_at
      from skill_catalog_entries
      where distribution = 'cloud' and active = true
      order by name asc
    `);
  }

  async listSkillCatalogAdmin(): Promise<SkillCatalogEntryRecord[]> {
    return this.listSkillCatalogEntries(`
      select
        slug,
        name,
        description,
        visibility,
        market,
        category,
        skill_type,
        publisher,
        distribution,
        tags,
        active,
        created_at,
        updated_at
      from skill_catalog_entries
      order by name asc
    `);
  }

  async getSkillCatalogEntry(slug: string): Promise<SkillCatalogEntryRecord | null> {
    const items = await this.listSkillCatalogEntries(
      `
        select
          slug,
          name,
          description,
          visibility,
          market,
          category,
          skill_type,
          publisher,
          distribution,
          tags,
          active,
          created_at,
          updated_at
        from skill_catalog_entries
        where slug = $1
        limit 1
      `,
      [slug],
    );
    return items[0] || null;
  }

  async upsertSkillCatalogEntry(input: Required<UpsertSkillCatalogEntryInput>): Promise<SkillCatalogEntryRecord> {
    await this.pool.query(
      `
        insert into skill_catalog_entries (
          slug,
          name,
          description,
          visibility,
          market,
          category,
          skill_type,
          publisher,
          distribution,
          tags,
          active,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, now(), now())
        on conflict (slug)
        do update set
          name = excluded.name,
          description = excluded.description,
          visibility = excluded.visibility,
          market = excluded.market,
          category = excluded.category,
          skill_type = excluded.skill_type,
          publisher = excluded.publisher,
          distribution = excluded.distribution,
          tags = excluded.tags,
          active = excluded.active,
          updated_at = now()
      `,
      [
        input.slug,
        input.name,
        input.description,
        input.visibility,
        input.market,
        input.category,
        input.skill_type,
        input.publisher,
        input.distribution,
        JSON.stringify(input.tags),
        input.active,
      ],
    );

    const record = await this.getSkillCatalogEntry(input.slug);
    if (!record) {
      throw new Error('SKILL_UPSERT_FAILED');
    }
    return record;
  }

  async deleteSkillCatalogEntry(slug: string): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from skill_catalog_entries
        where slug = $1
      `,
      [slug],
    );
    return (result.rowCount || 0) > 0;
  }

  async getSkillRelease(slug: string, version?: string): Promise<SkillReleaseRecord | null> {
    const result = await this.pool.query<SkillReleaseRow>(
      `
        select
          skill_slug,
          version,
          artifact_format,
          artifact_url,
          artifact_sha256,
          artifact_source_path,
          published_at,
          created_at
        from skill_releases
        where skill_slug = $1
          and status = 'published'
          and ($2::text is null or version = $2)
        order by published_at desc, created_at desc
        limit 1
      `,
      [slug, version || null],
    );
    return result.rows[0] ? mapSkillReleaseRow(result.rows[0]) : null;
  }

  async listUserPrivateSkills(userId: string): Promise<UserPrivateSkillRecord[]> {
    const result = await this.pool.query<UserPrivateSkillRow>(
      `
        select
          user_id,
          slug,
          name,
          description,
          market,
          category,
          skill_type,
          publisher,
          tags,
          source_kind,
          source_url,
          version,
          artifact_format,
          artifact_key,
          artifact_sha256,
          created_at,
          updated_at
        from user_private_skills
        where user_id = $1
        order by updated_at desc, created_at desc
      `,
      [userId],
    );
    return result.rows.map(mapUserPrivateSkillRow);
  }

  async getUserPrivateSkill(userId: string, slug: string): Promise<UserPrivateSkillRecord | null> {
    const result = await this.pool.query<UserPrivateSkillRow>(
      `
        select
          user_id,
          slug,
          name,
          description,
          market,
          category,
          skill_type,
          publisher,
          tags,
          source_kind,
          source_url,
          version,
          artifact_format,
          artifact_key,
          artifact_sha256,
          created_at,
          updated_at
        from user_private_skills
        where user_id = $1 and slug = $2
        limit 1
      `,
      [userId, slug],
    );
    return result.rows[0] ? mapUserPrivateSkillRow(result.rows[0]) : null;
  }

  async upsertUserPrivateSkill(
    userId: string,
    input: Omit<Required<ImportUserPrivateSkillInput>, 'artifact_base64'> & {artifactKey: string},
  ): Promise<UserPrivateSkillRecord> {
    const result = await this.pool.query<UserPrivateSkillRow>(
      `
        insert into user_private_skills (
          user_id,
          slug,
          name,
          description,
          market,
          category,
          skill_type,
          publisher,
          tags,
          source_kind,
          source_url,
          version,
          artifact_format,
          artifact_key,
          artifact_sha256,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, now(), now())
        on conflict (user_id, slug)
        do update set
          name = excluded.name,
          description = excluded.description,
          market = excluded.market,
          category = excluded.category,
          skill_type = excluded.skill_type,
          publisher = excluded.publisher,
          tags = excluded.tags,
          source_kind = excluded.source_kind,
          source_url = excluded.source_url,
          version = excluded.version,
          artifact_format = excluded.artifact_format,
          artifact_key = excluded.artifact_key,
          artifact_sha256 = excluded.artifact_sha256,
          updated_at = now()
        returning
          user_id,
          slug,
          name,
          description,
          market,
          category,
          skill_type,
          publisher,
          tags,
          source_kind,
          source_url,
          version,
          artifact_format,
          artifact_key,
          artifact_sha256,
          created_at,
          updated_at
      `,
      [
        userId,
        input.slug,
        input.name,
        input.description,
        input.market,
        input.category,
        input.skill_type,
        input.publisher,
        JSON.stringify(input.tags),
        input.source_kind,
        input.source_url,
        input.version,
        input.artifact_format,
        input.artifactKey,
        input.artifact_sha256,
      ],
    );
    return mapUserPrivateSkillRow(result.rows[0]);
  }

  async listUserAgentLibrary(userId: string): Promise<UserAgentLibraryRecord[]> {
    const result = await this.pool.query<UserAgentLibraryRow>(
      `
        select user_id, agent_slug, installed_at, updated_at
        from user_agent_library
        where user_id = $1
        order by installed_at desc
      `,
      [userId],
    );
    return result.rows.map(mapUserAgentLibraryRow);
  }

  async installUserAgent(userId: string, input: Required<InstallAgentInput>): Promise<UserAgentLibraryRecord> {
    const result = await this.pool.query<UserAgentLibraryRow>(
      `
        insert into user_agent_library (
          user_id,
          agent_slug,
          installed_at,
          updated_at
        )
        values ($1, $2, now(), now())
        on conflict (user_id, agent_slug)
        do update set
          updated_at = now()
        returning user_id, agent_slug, installed_at, updated_at
      `,
      [userId, input.slug],
    );
    return mapUserAgentLibraryRow(result.rows[0]);
  }

  async removeUserAgent(userId: string, slug: string): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from user_agent_library
        where user_id = $1 and agent_slug = $2
      `,
      [userId, slug],
    );
    return (result.rowCount || 0) > 0;
  }

  async listUserSkillLibrary(userId: string): Promise<UserSkillLibraryRecord[]> {
    const result = await this.pool.query<UserSkillLibraryRow>(
      `
        select user_id, skill_slug, source, installed_version, enabled, installed_at, updated_at
        from user_skill_library
        where user_id = $1
        order by installed_at desc
      `,
      [userId],
    );
    return result.rows.map(mapUserSkillLibraryRow);
  }

  async installUserSkill(
    userId: string,
    input: Required<InstallSkillInput> & {source?: 'cloud' | 'private'},
  ): Promise<UserSkillLibraryRecord> {
    const result = await this.pool.query<UserSkillLibraryRow>(
      `
        insert into user_skill_library (
          user_id,
          skill_slug,
          source,
          installed_version,
          enabled,
          installed_at,
          updated_at
        )
        values ($1, $2, $3, $4, true, now(), now())
        on conflict (user_id, skill_slug)
        do update set
          source = excluded.source,
          installed_version = excluded.installed_version,
          enabled = true,
          updated_at = now()
        returning user_id, skill_slug, source, installed_version, enabled, installed_at, updated_at
      `,
      [userId, input.slug, input.source || 'cloud', input.version],
    );
    return mapUserSkillLibraryRow(result.rows[0]);
  }

  async updateUserSkill(
    userId: string,
    input: Required<UpdateSkillLibraryItemInput>,
  ): Promise<UserSkillLibraryRecord | null> {
    const result = await this.pool.query<UserSkillLibraryRow>(
      `
        update user_skill_library
        set enabled = $3, updated_at = now()
        where user_id = $1 and skill_slug = $2
        returning user_id, skill_slug, source, installed_version, enabled, installed_at, updated_at
      `,
      [userId, input.slug, input.enabled],
    );
    return result.rows[0] ? mapUserSkillLibraryRow(result.rows[0]) : null;
  }

  async removeUserSkill(userId: string, slug: string): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from user_skill_library
        where user_id = $1 and skill_slug = $2
      `,
      [userId, slug],
    );
    return (result.rowCount || 0) > 0;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async listSkillCatalogEntries(query: string, values: unknown[] = []): Promise<SkillCatalogEntryRecord[]> {
    const catalogResult = await this.pool.query<SkillCatalogRow>(query, values);

    const releasesResult = await this.pool.query<SkillReleaseRow>(
      `
        select distinct on (skill_slug)
          skill_slug,
          version,
          artifact_format,
          artifact_url,
          artifact_sha256,
          artifact_source_path,
          published_at,
          created_at
        from skill_releases
        where status = 'published'
        order by skill_slug, published_at desc, created_at desc
      `,
    );

    const latestReleaseBySlug = new Map(
      releasesResult.rows.map((row) => [row.skill_slug, mapSkillReleaseRow(row)]),
    );

    return catalogResult.rows.map((row) => {
      const base = mapSkillCatalogRow(row);
      return {
        ...base,
        latestRelease: latestReleaseBySlug.get(base.slug) || null,
      };
    });
  }

  private async insertSession(
    db: Pool | PoolClient,
    userId: string,
    tokens: SessionTokenPair,
  ): Promise<SessionRecord> {
    const sessionId = randomUUID();
    const now = new Date();

    await db.query(
      `
        insert into device_sessions (id, user_id, device_id, client_type, status, created_at)
        values ($1, $2, $3, $4, 'active', $5)
      `,
      [sessionId, userId, tokens.deviceId, tokens.clientType, now],
    );
    return this.insertSessionTokens(db, userId, sessionId, tokens, now);
  }

  private async insertSessionTokens(
    db: Pool | PoolClient,
    userId: string,
    sessionId: string,
    tokens: SessionTokenPair,
    createdAt: Date,
  ): Promise<SessionRecord> {
    const now = new Date();
    const accessTokenExpiresAt = new Date(tokens.accessTokenExpiresAt);
    const refreshTokenExpiresAt = new Date(tokens.refreshTokenExpiresAt);

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
      createdAt: createdAt.toISOString(),
    };
  }

  private async getSessionById(dbSessionId: string, db: Pool | PoolClient): Promise<SessionRecord | null> {
    const result = await db.query<SessionRow>(
      `
        select
          ds.id as session_id,
          ds.user_id,
          at.token_hash as access_token_hash,
          at.expires_at as access_token_expires_at,
          rt.token_hash as refresh_token_hash,
          rt.expires_at as refresh_token_expires_at,
          ds.created_at
        from device_sessions ds
        join access_tokens at on at.device_session_id = ds.id and at.revoked_at is null
        join refresh_tokens rt on rt.device_session_id = ds.id and rt.revoked_at is null
        where ds.id = $1
        order by at.created_at desc, rt.created_at desc
        limit 1
      `,
      [dbSessionId],
    );
    return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
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
