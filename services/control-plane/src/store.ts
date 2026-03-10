import { randomUUID } from 'node:crypto';

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

function normalizeUsernameLookup(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface ControlPlaneStore {
  readonly storageLabel: string;
  getUserByIdentifier(identifier: string): Promise<UserRecord | null>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserByOAuthAccount(provider: OAuthProvider, providerId: string): Promise<UserRecord | null>;
  linkOAuthAccount(userId: string, provider: OAuthProvider, providerId: string): Promise<OAuthAccountRecord>;
  unlinkOAuthAccount(userId: string, provider: OAuthProvider): Promise<boolean>;
  getOAuthAccountsForUser(userId: string): Promise<OAuthAccountRecord[]>;
  updateUserProfile(userId: string, input: {displayName?: string; avatarUrl?: string | null}): Promise<UserRecord | null>;
  setPasswordHash(userId: string, passwordHash: string): Promise<UserRecord | null>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  createSession(userId: string, tokens: SessionTokenPair): Promise<SessionRecord>;
  replaceSession(refreshTokenHash: string, tokens: SessionTokenPair): Promise<SessionRecord | null>;
  getSessionByAccessToken(accessTokenHash: string): Promise<SessionRecord | null>;
  getSessionByRefreshToken(refreshTokenHash: string): Promise<SessionRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  getCreditBalance(userId: string): Promise<number>;
  getCreditLedger(userId: string): Promise<CreditLedgerRecord[]>;
  getRunGrantById(grantId: string): Promise<RunGrantRecord | null>;
  createRunGrant(input: {
    userId: string;
    sessionKey: string;
    client: string;
    nonce: string;
    maxInputTokens: number;
    maxOutputTokens: number;
    creditLimit: number;
    expiresAt: string;
    signature: string;
  }): Promise<RunGrantRecord>;
  recordUsageEvent(userId: string, input: Required<UsageEventInput>): Promise<UsageEventResult>;
  getWorkspaceBackup(userId: string): Promise<WorkspaceBackupRecord | null>;
  saveWorkspaceBackup(userId: string, input: WorkspaceBackupInput): Promise<WorkspaceBackupRecord>;
}

export class InMemoryControlPlaneStore implements ControlPlaneStore {
  readonly storageLabel = 'in-memory';

  private readonly users = new Map<string, UserRecord>();
  private readonly userIdsByUsername = new Map<string, string>();
  private readonly userIdsByEmail = new Map<string, string>();
  private readonly oauthAccountsByProviderKey = new Map<string, OAuthAccountRecord>();
  private readonly sessionsByAccessToken = new Map<string, SessionRecord>();
  private readonly sessionsByRefreshToken = new Map<string, SessionRecord>();
  private readonly creditBalanceByUserId = new Map<string, number>();
  private readonly creditLedgerByUserId = new Map<string, CreditLedgerRecord[]>();
  private readonly runGrantsById = new Map<string, RunGrantRecord>();
  private readonly usageEventsByEventId = new Map<string, UsageEventResult>();
  private readonly workspaceBackupsByUserId = new Map<string, WorkspaceBackupRecord>();

  async getUserByIdentifier(identifier: string): Promise<UserRecord | null> {
    const normalized = normalizeUsernameLookup(identifier);
    const userId = this.userIdsByUsername.get(normalized) || this.userIdsByEmail.get(normalized);
    return userId ? this.users.get(userId) || null : null;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const userId = this.userIdsByEmail.get(email.trim().toLowerCase());
    return userId ? this.users.get(userId) || null : null;
  }

  async getUserByOAuthAccount(provider: OAuthProvider, providerId: string): Promise<UserRecord | null> {
    const account = this.oauthAccountsByProviderKey.get(this.oauthKey(provider, providerId));
    return account ? this.users.get(account.userId) || null : null;
  }

  async linkOAuthAccount(userId: string, provider: OAuthProvider, providerId: string): Promise<OAuthAccountRecord> {
    const record: OAuthAccountRecord = {
      userId,
      provider,
      providerId,
      createdAt: new Date().toISOString(),
    };
    this.oauthAccountsByProviderKey.set(this.oauthKey(provider, providerId), record);
    return record;
  }

  async unlinkOAuthAccount(userId: string, provider: OAuthProvider): Promise<boolean> {
    for (const [key, value] of this.oauthAccountsByProviderKey.entries()) {
      if (value.userId === userId && value.provider === provider) {
        this.oauthAccountsByProviderKey.delete(key);
        return true;
      }
    }
    return false;
  }

  async getOAuthAccountsForUser(userId: string): Promise<OAuthAccountRecord[]> {
    return Array.from(this.oauthAccountsByProviderKey.values()).filter((item) => item.userId === userId);
  }

  async updateUserProfile(userId: string, input: {displayName?: string; avatarUrl?: string | null}): Promise<UserRecord | null> {
    const current = this.users.get(userId);
    if (!current) return null;
    const next: UserRecord = {
      ...current,
      displayName: input.displayName?.trim() ? input.displayName.trim() : current.displayName,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : current.avatarUrl,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(userId, next);
    return next;
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<UserRecord | null> {
    const current = this.users.get(userId);
    if (!current) return null;
    const next: UserRecord = {
      ...current,
      passwordHash,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(userId, next);
    return next;
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const normalizedUsername = normalizeUsernameLookup(input.username);
    const normalizedEmail = input.email.trim().toLowerCase();
    if (this.userIdsByUsername.has(normalizedUsername)) {
      throw new Error('USERNAME_TAKEN');
    }
    if (this.userIdsByEmail.has(normalizedEmail)) {
      throw new Error('EMAIL_TAKEN');
    }

    const now = new Date().toISOString();
    const user: UserRecord = {
      id: randomUUID(),
      username: input.username.trim().replace(/\s+/g, ' '),
      email: normalizedEmail,
      displayName: input.displayName.trim(),
      avatarUrl: input.avatarUrl?.trim() || null,
      passwordHash: input.passwordHash?.trim() || null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    this.userIdsByUsername.set(normalizedUsername, user.id);
    this.userIdsByEmail.set(normalizedEmail, user.id);
    this.creditBalanceByUserId.set(user.id, input.initialCreditBalance);
    this.creditLedgerByUserId.set(user.id, [
      {
        id: randomUUID(),
        userId: user.id,
        eventType: 'signup_grant',
        delta: input.initialCreditBalance,
        balanceAfter: input.initialCreditBalance,
        createdAt: now,
      },
    ]);

    return user;
  }

  async createSession(userId: string, tokens: SessionTokenPair): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: randomUUID(),
      userId,
      accessTokenHash: tokens.accessTokenHash,
      refreshTokenHash: tokens.refreshTokenHash,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      createdAt: new Date().toISOString(),
    };
    this.sessionsByAccessToken.set(session.accessTokenHash, session);
    this.sessionsByRefreshToken.set(session.refreshTokenHash, session);
    return session;
  }

  async replaceSession(refreshTokenHash: string, tokens: SessionTokenPair): Promise<SessionRecord | null> {
    const current = this.sessionsByRefreshToken.get(refreshTokenHash);
    if (!current) return null;
    this.sessionsByAccessToken.delete(current.accessTokenHash);
    this.sessionsByRefreshToken.delete(current.refreshTokenHash);
    return this.createSession(current.userId, tokens);
  }

  async getSessionByAccessToken(accessTokenHash: string): Promise<SessionRecord | null> {
    return this.sessionsByAccessToken.get(accessTokenHash) || null;
  }

  async getSessionByRefreshToken(refreshTokenHash: string): Promise<SessionRecord | null> {
    return this.sessionsByRefreshToken.get(refreshTokenHash) || null;
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    return this.users.get(userId) || null;
  }

  async getCreditBalance(userId: string): Promise<number> {
    return this.creditBalanceByUserId.get(userId) || 0;
  }

  async getCreditLedger(userId: string): Promise<CreditLedgerRecord[]> {
    return this.creditLedgerByUserId.get(userId) || [];
  }

  async getRunGrantById(grantId: string): Promise<RunGrantRecord | null> {
    return this.runGrantsById.get(grantId) || null;
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
    const grant: RunGrantRecord = {
      id: randomUUID(),
      userId: input.userId,
      sessionKey: input.sessionKey,
      client: input.client,
      nonce: input.nonce,
      maxInputTokens: input.maxInputTokens,
      maxOutputTokens: input.maxOutputTokens,
      creditLimit: input.creditLimit,
      expiresAt: input.expiresAt,
      signature: input.signature,
      createdAt: new Date().toISOString(),
    };
    this.runGrantsById.set(grant.id, grant);
    return grant;
  }

  async recordUsageEvent(userId: string, input: Required<UsageEventInput>): Promise<UsageEventResult> {
    const existing = this.usageEventsByEventId.get(input.event_id);
    if (existing) return existing;

    const currentBalance = this.creditBalanceByUserId.get(userId) || 0;
    const nextBalance = currentBalance - Math.max(0, input.credit_cost);
    this.creditBalanceByUserId.set(userId, nextBalance);

    const ledger = this.creditLedgerByUserId.get(userId) || [];
    ledger.unshift({
      id: randomUUID(),
      userId,
      eventType: 'usage_debit',
      delta: -Math.max(0, input.credit_cost),
      balanceAfter: nextBalance,
      createdAt: new Date().toISOString(),
    });
    this.creditLedgerByUserId.set(userId, ledger);

    const result: UsageEventResult = {
      accepted: true,
      balanceAfter: nextBalance,
    };
    this.usageEventsByEventId.set(input.event_id, result);
    return result;
  }

  async getWorkspaceBackup(userId: string): Promise<WorkspaceBackupRecord | null> {
    return this.workspaceBackupsByUserId.get(userId) || null;
  }

  async saveWorkspaceBackup(userId: string, input: WorkspaceBackupInput): Promise<WorkspaceBackupRecord> {
    const now = new Date().toISOString();
    const existing = this.workspaceBackupsByUserId.get(userId);
    const record: WorkspaceBackupRecord = {
      userId,
      identityMd: input.identity_md,
      userMd: input.user_md,
      soulMd: input.soul_md,
      agentsMd: input.agents_md,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.workspaceBackupsByUserId.set(userId, record);
    return record;
  }

  private oauthKey(provider: OAuthProvider, providerId: string): string {
    return `${provider}:${providerId}`;
  }
}
