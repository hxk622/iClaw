import { randomUUID } from 'node:crypto';

import type {
  CreateUserInput,
  CreditLedgerRecord,
  InstallSkillInput,
  OAuthAccountRecord,
  OAuthProvider,
  RunGrantRecord,
  SessionRecord,
  SessionTokenPair,
  SkillCatalogEntryRecord,
  SkillReleaseRecord,
  UpsertSkillCatalogEntryInput,
  UsageEventInput,
  UsageEventResult,
  UserRole,
  UserSkillLibraryRecord,
  UpdateSkillLibraryItemInput,
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
  updateUserRole(userId: string, role: UserRole): Promise<UserRecord | null>;
  setPasswordHash(userId: string, passwordHash: string): Promise<UserRecord | null>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  createSession(userId: string, tokens: SessionTokenPair): Promise<SessionRecord>;
  replaceSession(refreshTokenHash: string, tokens: SessionTokenPair): Promise<SessionRecord | null>;
  touchSession(sessionId: string, expiresAt: {
    accessTokenExpiresAt: number;
    refreshTokenExpiresAt: number;
  }): Promise<SessionRecord | null>;
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
  listSkillCatalog(): Promise<SkillCatalogEntryRecord[]>;
  listSkillCatalogAdmin(): Promise<SkillCatalogEntryRecord[]>;
  getSkillCatalogEntry(slug: string): Promise<SkillCatalogEntryRecord | null>;
  upsertSkillCatalogEntry(input: Required<UpsertSkillCatalogEntryInput>): Promise<SkillCatalogEntryRecord>;
  deleteSkillCatalogEntry(slug: string): Promise<boolean>;
  getSkillRelease(slug: string, version?: string): Promise<SkillReleaseRecord | null>;
  listUserSkillLibrary(userId: string): Promise<UserSkillLibraryRecord[]>;
  installUserSkill(userId: string, input: Required<InstallSkillInput>): Promise<UserSkillLibraryRecord>;
  updateUserSkill(userId: string, input: Required<UpdateSkillLibraryItemInput>): Promise<UserSkillLibraryRecord | null>;
  removeUserSkill(userId: string, slug: string): Promise<boolean>;
}

export class InMemoryControlPlaneStore implements ControlPlaneStore {
  readonly storageLabel = 'in-memory';

  private readonly users = new Map<string, UserRecord>();
  private readonly userIdsByUsername = new Map<string, string>();
  private readonly userIdsByEmail = new Map<string, string>();
  private readonly oauthAccountsByProviderKey = new Map<string, OAuthAccountRecord>();
  private readonly sessionsById = new Map<string, SessionRecord>();
  private readonly sessionsByAccessToken = new Map<string, SessionRecord>();
  private readonly sessionsByRefreshToken = new Map<string, SessionRecord>();
  private readonly creditBalanceByUserId = new Map<string, number>();
  private readonly creditLedgerByUserId = new Map<string, CreditLedgerRecord[]>();
  private readonly runGrantsById = new Map<string, RunGrantRecord>();
  private readonly usageEventsByEventId = new Map<string, UsageEventResult>();
  private readonly workspaceBackupsByUserId = new Map<string, WorkspaceBackupRecord>();
  private readonly skillCatalog = new Map<string, SkillCatalogEntryRecord>();
  private readonly userSkillLibrary = new Map<string, UserSkillLibraryRecord>();

  constructor() {
    const now = new Date().toISOString();
    const cloudSkills: SkillCatalogEntryRecord[] = [
      {
        slug: 'a-share-esg',
        name: 'A股ESG筛选分析',
        description: '从ESG角度筛选A股上市公司，评估可持续发展实践与争议风险。',
        visibility: 'showcase',
        market: 'A股',
        category: 'research',
        skillType: '分析师',
        publisher: 'iClaw',
        distribution: 'cloud',
        tags: ['A股', 'ESG', '筛选'],
        active: true,
        createdAt: now,
        updatedAt: now,
        latestRelease: {
          slug: 'a-share-esg',
          version: '1.0.0',
          artifactFormat: 'tar.gz',
          artifactUrl: null,
          artifactSha256: null,
          artifactSourcePath: 'A股ESG筛选器',
          publishedAt: now,
          createdAt: now,
        },
      },
      {
        slug: 'us-factor-screener',
        name: '美股量化因子筛选',
        description: '使用多因子框架筛选美股，识别价值、动量、质量等因子暴露有利的股票。',
        visibility: 'showcase',
        market: '美股',
        category: 'research',
        skillType: '扫描器',
        publisher: 'iClaw',
        distribution: 'cloud',
        tags: ['美股', '量化', '因子'],
        active: true,
        createdAt: now,
        updatedAt: now,
        latestRelease: {
          slug: 'us-factor-screener',
          version: '1.0.0',
          artifactFormat: 'tar.gz',
          artifactUrl: null,
          artifactSha256: null,
          artifactSourcePath: '美股量化因子扫描器',
          publishedAt: now,
          createdAt: now,
        },
      },
    ];

    for (const entry of cloudSkills) {
      this.skillCatalog.set(entry.slug, entry);
    }
  }

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

  async updateUserRole(userId: string, role: UserRole): Promise<UserRecord | null> {
    const current = this.users.get(userId);
    if (!current) return null;
    if (current.role === role) {
      return current;
    }
    const next: UserRecord = {
      ...current,
      role,
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
      role: input.role || 'user',
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
    this.sessionsById.set(session.id, session);
    this.sessionsByAccessToken.set(session.accessTokenHash, session);
    this.sessionsByRefreshToken.set(session.refreshTokenHash, session);
    return session;
  }

  async replaceSession(refreshTokenHash: string, tokens: SessionTokenPair): Promise<SessionRecord | null> {
    const current = this.sessionsByRefreshToken.get(refreshTokenHash);
    if (!current) return null;
    this.sessionsByAccessToken.delete(current.accessTokenHash);
    this.sessionsByRefreshToken.delete(current.refreshTokenHash);
    const next: SessionRecord = {
      ...current,
      accessTokenHash: tokens.accessTokenHash,
      refreshTokenHash: tokens.refreshTokenHash,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    };
    this.sessionsById.set(next.id, next);
    this.sessionsByAccessToken.set(next.accessTokenHash, next);
    this.sessionsByRefreshToken.set(next.refreshTokenHash, next);
    return next;
  }

  async touchSession(
    sessionId: string,
    expiresAt: {
      accessTokenExpiresAt: number;
      refreshTokenExpiresAt: number;
    },
  ): Promise<SessionRecord | null> {
    const current = this.sessionsById.get(sessionId);
    if (!current) {
      return null;
    }
    const next: SessionRecord = {
      ...current,
      accessTokenExpiresAt: expiresAt.accessTokenExpiresAt,
      refreshTokenExpiresAt: expiresAt.refreshTokenExpiresAt,
    };
    this.sessionsById.set(next.id, next);
    this.sessionsByAccessToken.set(next.accessTokenHash, next);
    this.sessionsByRefreshToken.set(next.refreshTokenHash, next);
    return next;
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

  async listSkillCatalog(): Promise<SkillCatalogEntryRecord[]> {
    return Array.from(this.skillCatalog.values()).filter((item) => item.distribution === 'cloud' && item.active);
  }

  async listSkillCatalogAdmin(): Promise<SkillCatalogEntryRecord[]> {
    return Array.from(this.skillCatalog.values()).sort((left, right) => left.name.localeCompare(right.name));
  }

  async getSkillCatalogEntry(slug: string): Promise<SkillCatalogEntryRecord | null> {
    return this.skillCatalog.get(slug) || null;
  }

  async upsertSkillCatalogEntry(input: Required<UpsertSkillCatalogEntryInput>): Promise<SkillCatalogEntryRecord> {
    const now = new Date().toISOString();
    const existing = this.skillCatalog.get(input.slug);
    const next: SkillCatalogEntryRecord = {
      slug: input.slug,
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      market: input.market,
      category: input.category,
      skillType: input.skill_type,
      publisher: input.publisher,
      distribution: input.distribution,
      tags: input.tags,
      active: input.active,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      latestRelease: existing?.latestRelease || null,
    };
    this.skillCatalog.set(input.slug, next);
    return next;
  }

  async deleteSkillCatalogEntry(slug: string): Promise<boolean> {
    return this.skillCatalog.delete(slug);
  }

  async getSkillRelease(slug: string, version?: string): Promise<SkillReleaseRecord | null> {
    const entry = this.skillCatalog.get(slug);
    if (!entry?.latestRelease) return null;
    if (version && entry.latestRelease.version !== version) return null;
    return entry.latestRelease;
  }

  async listUserSkillLibrary(userId: string): Promise<UserSkillLibraryRecord[]> {
    return Array.from(this.userSkillLibrary.values()).filter((item) => item.userId === userId);
  }

  async installUserSkill(userId: string, input: Required<InstallSkillInput>): Promise<UserSkillLibraryRecord> {
    const now = new Date().toISOString();
    const key = `${userId}:${input.slug}`;
    const existing = this.userSkillLibrary.get(key);
    const record: UserSkillLibraryRecord = {
      userId,
      slug: input.slug,
      version: input.version,
      enabled: true,
      installedAt: existing?.installedAt || now,
      updatedAt: now,
    };
    this.userSkillLibrary.set(key, record);
    return record;
  }

  async updateUserSkill(
    userId: string,
    input: Required<UpdateSkillLibraryItemInput>,
  ): Promise<UserSkillLibraryRecord | null> {
    const key = `${userId}:${input.slug}`;
    const existing = this.userSkillLibrary.get(key);
    if (!existing) return null;
    const record: UserSkillLibraryRecord = {
      ...existing,
      enabled: input.enabled,
      updatedAt: new Date().toISOString(),
    };
    this.userSkillLibrary.set(key, record);
    return record;
  }

  async removeUserSkill(userId: string, slug: string): Promise<boolean> {
    return this.userSkillLibrary.delete(`${userId}:${slug}`);
  }

  private oauthKey(provider: OAuthProvider, providerId: string): string {
    return `${provider}:${providerId}`;
  }
}
