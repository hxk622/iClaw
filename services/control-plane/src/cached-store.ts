import type {
  AgentCatalogEntryRecord,
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
import type {KeyValueCache} from './cache.ts';
import type {ControlPlaneStore} from './store.ts';

const USER_CACHE_TTL_SECONDS = 5 * 60;
const CREDIT_BALANCE_CACHE_TTL_SECONDS = 15;
const CREDIT_LEDGER_CACHE_TTL_SECONDS = 15;
const USAGE_EVENT_CACHE_TTL_SECONDS = 24 * 60 * 60;
const WORKSPACE_BACKUP_CACHE_TTL_SECONDS = 5 * 60;
const AGENT_CATALOG_CACHE_TTL_SECONDS = 5 * 60;
const SKILL_CATALOG_CACHE_TTL_SECONDS = 5 * 60;
const USER_SKILL_LIBRARY_CACHE_TTL_SECONDS = 60;

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().replace(/\s+/g, ' ').toLowerCase();
}

function sessionTtlSeconds(session: SessionRecord, kind: 'access' | 'refresh'): number {
  const expiresAt = kind === 'access' ? session.accessTokenExpiresAt : session.refreshTokenExpiresAt;
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
}

export class CachedControlPlaneStore implements ControlPlaneStore {
  readonly storageLabel: string;
  private readonly base: ControlPlaneStore;
  private readonly cache: KeyValueCache;

  constructor(base: ControlPlaneStore, cache: KeyValueCache) {
    this.base = base;
    this.cache = cache;
    this.storageLabel = `${base.storageLabel}+${cache.label}`;
  }

  async getUserByIdentifier(identifier: string): Promise<UserRecord | null> {
    const normalized = normalizeIdentifier(identifier);
    return this.getOrLoad(this.userIdentifierKey(normalized), USER_CACHE_TTL_SECONDS, () =>
      this.base.getUserByIdentifier(normalized),
    );
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const normalized = normalizeIdentifier(email);
    return this.getOrLoad(this.userIdentifierKey(normalized), USER_CACHE_TTL_SECONDS, () =>
      this.base.getUserByEmail(normalized),
    );
  }

  async getUserByOAuthAccount(provider: OAuthProvider, providerId: string): Promise<UserRecord | null> {
    return this.getOrLoad(this.oauthUserKey(provider, providerId), USER_CACHE_TTL_SECONDS, () =>
      this.base.getUserByOAuthAccount(provider, providerId),
    );
  }

  async linkOAuthAccount(userId: string, provider: OAuthProvider, providerId: string): Promise<OAuthAccountRecord> {
    const record = await this.base.linkOAuthAccount(userId, provider, providerId);
    const user = await this.base.getUserById(userId);
    if (user) {
      await this.cache.set(this.oauthUserKey(provider, providerId), user, USER_CACHE_TTL_SECONDS);
      await this.cache.set(this.userIdKey(user.id), user, USER_CACHE_TTL_SECONDS);
    }
    return record;
  }

  async unlinkOAuthAccount(userId: string, provider: OAuthProvider): Promise<boolean> {
    const removed = await this.base.unlinkOAuthAccount(userId, provider);
    if (removed) {
      await this.cache.delete(this.oauthAccountsKey(userId));
    }
    return removed;
  }

  async getOAuthAccountsForUser(userId: string): Promise<OAuthAccountRecord[]> {
    return this.getOrLoadValue(this.oauthAccountsKey(userId), USER_CACHE_TTL_SECONDS, () =>
      this.base.getOAuthAccountsForUser(userId),
    );
  }

  async updateUserProfile(userId: string, input: {displayName?: string}): Promise<UserRecord | null> {
    const user = await this.base.updateUserProfile(userId, input);
    if (user) {
      await Promise.all([
        this.cache.set(this.userIdKey(user.id), user, USER_CACHE_TTL_SECONDS),
        this.cache.set(this.userIdentifierKey(user.username), user, USER_CACHE_TTL_SECONDS),
        this.cache.set(this.userIdentifierKey(user.email), user, USER_CACHE_TTL_SECONDS),
      ]);
    }
    return user;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<UserRecord | null> {
    const user = await this.base.updateUserRole(userId, role);
    if (user) {
      await Promise.all([
        this.cache.set(this.userIdKey(user.id), user, USER_CACHE_TTL_SECONDS),
        this.cache.set(this.userIdentifierKey(user.username), user, USER_CACHE_TTL_SECONDS),
        this.cache.set(this.userIdentifierKey(user.email), user, USER_CACHE_TTL_SECONDS),
      ]);
    }
    return user;
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<UserRecord | null> {
    const user = await this.base.setPasswordHash(userId, passwordHash);
    if (user) {
      await Promise.all([
        this.cache.set(this.userIdKey(user.id), user, USER_CACHE_TTL_SECONDS),
        this.cache.set(this.userIdentifierKey(user.username), user, USER_CACHE_TTL_SECONDS),
        this.cache.set(this.userIdentifierKey(user.email), user, USER_CACHE_TTL_SECONDS),
      ]);
    }
    return user;
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const user = await this.base.createUser(input);
    await Promise.all([
      this.cache.set(this.userIdKey(user.id), user, USER_CACHE_TTL_SECONDS),
      this.cache.set(this.userIdentifierKey(user.username), user, USER_CACHE_TTL_SECONDS),
      this.cache.set(this.userIdentifierKey(user.email), user, USER_CACHE_TTL_SECONDS),
      this.cache.set(this.creditBalanceKey(user.id), input.initialCreditBalance, CREDIT_BALANCE_CACHE_TTL_SECONDS),
      this.cache.delete(this.creditLedgerKey(user.id)),
    ]);
    return user;
  }

  async createSession(userId: string, tokens: SessionTokenPair): Promise<SessionRecord> {
    const session = await this.base.createSession(userId, tokens);
    await this.cacheSession(session);
    return session;
  }

  async replaceSession(refreshTokenHash: string, tokens: SessionTokenPair): Promise<SessionRecord | null> {
    const current = await this.base.getSessionByRefreshToken(refreshTokenHash);
    const session = await this.base.replaceSession(refreshTokenHash, tokens);

    await this.cache.delete(
      this.refreshSessionKey(refreshTokenHash),
      current ? this.accessSessionKey(current.accessTokenHash) : '',
    );

    if (session) {
      await this.cacheSession(session);
    }
    return session;
  }

  async touchSession(
    sessionId: string,
    expiresAt: {
      accessTokenExpiresAt: number;
      refreshTokenExpiresAt: number;
    },
  ): Promise<SessionRecord | null> {
    const session = await this.base.touchSession(sessionId, expiresAt);
    if (session) {
      await this.cacheSession(session);
    }
    return session;
  }

  async getSessionByAccessToken(accessTokenHash: string): Promise<SessionRecord | null> {
    const key = this.accessSessionKey(accessTokenHash);
    const cached = await this.cache.get<SessionRecord>(key);
    if (cached !== null) {
      return cached;
    }

    const session = await this.base.getSessionByAccessToken(accessTokenHash);
    if (session) {
      await this.cache.set(key, session, sessionTtlSeconds(session, 'access'));
    }
    return session;
  }

  async getSessionByRefreshToken(refreshTokenHash: string): Promise<SessionRecord | null> {
    const key = this.refreshSessionKey(refreshTokenHash);
    const cached = await this.cache.get<SessionRecord>(key);
    if (cached !== null) {
      return cached;
    }

    const session = await this.base.getSessionByRefreshToken(refreshTokenHash);
    if (session) {
      await this.cache.set(key, session, sessionTtlSeconds(session, 'refresh'));
    }
    return session;
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    return this.getOrLoad(this.userIdKey(userId), USER_CACHE_TTL_SECONDS, () => this.base.getUserById(userId));
  }

  async getCreditBalance(userId: string): Promise<number> {
    return this.getOrLoadValue(this.creditBalanceKey(userId), CREDIT_BALANCE_CACHE_TTL_SECONDS, () =>
      this.base.getCreditBalance(userId),
    );
  }

  async getCreditLedger(userId: string): Promise<CreditLedgerRecord[]> {
    return this.getOrLoadValue(this.creditLedgerKey(userId), CREDIT_LEDGER_CACHE_TTL_SECONDS, () =>
      this.base.getCreditLedger(userId),
    );
  }

  async getRunGrantById(grantId: string): Promise<RunGrantRecord | null> {
    return this.getOrLoad(this.runGrantKey(grantId), USER_CACHE_TTL_SECONDS, () => this.base.getRunGrantById(grantId));
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
    const grant = await this.base.createRunGrant(input);
    const ttlSeconds = Math.max(1, Math.ceil((new Date(grant.expiresAt).getTime() - Date.now()) / 1000));
    await this.cache.set(this.runGrantKey(grant.id), grant, ttlSeconds);
    return grant;
  }

  async recordUsageEvent(userId: string, input: Required<UsageEventInput>): Promise<UsageEventResult> {
    const cached = await this.cache.get<UsageEventResult>(this.usageEventKey(input.event_id));
    if (cached) {
      return cached;
    }

    const result = await this.base.recordUsageEvent(userId, input);
    await Promise.all([
      this.cache.set(this.usageEventKey(input.event_id), result, USAGE_EVENT_CACHE_TTL_SECONDS),
      this.cache.delete(this.creditBalanceKey(userId), this.creditLedgerKey(userId)),
    ]);
    return result;
  }

  async getWorkspaceBackup(userId: string): Promise<WorkspaceBackupRecord | null> {
    return this.getOrLoad(this.workspaceBackupKey(userId), WORKSPACE_BACKUP_CACHE_TTL_SECONDS, () =>
      this.base.getWorkspaceBackup(userId),
    );
  }

  async saveWorkspaceBackup(userId: string, input: WorkspaceBackupInput): Promise<WorkspaceBackupRecord> {
    const backup = await this.base.saveWorkspaceBackup(userId, input);
    await this.cache.set(this.workspaceBackupKey(userId), backup, WORKSPACE_BACKUP_CACHE_TTL_SECONDS);
    return backup;
  }

  async listAgentCatalog(): Promise<AgentCatalogEntryRecord[]> {
    return this.getOrLoadValue(this.agentCatalogKey(), AGENT_CATALOG_CACHE_TTL_SECONDS, () =>
      this.base.listAgentCatalog(),
    );
  }

  async getAgentCatalogEntry(slug: string): Promise<AgentCatalogEntryRecord | null> {
    return this.getOrLoad(this.agentCatalogEntryKey(slug), AGENT_CATALOG_CACHE_TTL_SECONDS, () =>
      this.base.getAgentCatalogEntry(slug),
    );
  }

  async listSkillCatalog(): Promise<SkillCatalogEntryRecord[]> {
    return this.getOrLoadValue(this.skillCatalogKey(), SKILL_CATALOG_CACHE_TTL_SECONDS, () =>
      this.base.listSkillCatalog(),
    );
  }

  async listSkillCatalogAdmin(): Promise<SkillCatalogEntryRecord[]> {
    return this.getOrLoadValue(this.adminSkillCatalogKey(), SKILL_CATALOG_CACHE_TTL_SECONDS, () =>
      this.base.listSkillCatalogAdmin(),
    );
  }

  async getSkillCatalogEntry(slug: string): Promise<SkillCatalogEntryRecord | null> {
    return this.getOrLoad(this.skillCatalogEntryKey(slug), SKILL_CATALOG_CACHE_TTL_SECONDS, () =>
      this.base.getSkillCatalogEntry(slug),
    );
  }

  async upsertSkillCatalogEntry(input: Required<UpsertSkillCatalogEntryInput>): Promise<SkillCatalogEntryRecord> {
    const record = await this.base.upsertSkillCatalogEntry(input);
    await this.cache.delete(
      this.skillCatalogKey(),
      this.adminSkillCatalogKey(),
      this.skillCatalogEntryKey(input.slug),
      this.skillReleaseKey(input.slug),
    );
    return record;
  }

  async deleteSkillCatalogEntry(slug: string): Promise<boolean> {
    const removed = await this.base.deleteSkillCatalogEntry(slug);
    if (removed) {
      await this.cache.delete(
        this.skillCatalogKey(),
        this.adminSkillCatalogKey(),
        this.skillCatalogEntryKey(slug),
        this.skillReleaseKey(slug),
      );
    }
    return removed;
  }

  async getSkillRelease(slug: string, version?: string): Promise<SkillReleaseRecord | null> {
    return this.getOrLoad(this.skillReleaseKey(slug, version), USER_CACHE_TTL_SECONDS, () =>
      this.base.getSkillRelease(slug, version),
    );
  }

  async listUserPrivateSkills(userId: string): Promise<UserPrivateSkillRecord[]> {
    return this.getOrLoadValue(this.userPrivateSkillsKey(userId), USER_SKILL_LIBRARY_CACHE_TTL_SECONDS, () =>
      this.base.listUserPrivateSkills(userId),
    );
  }

  async getUserPrivateSkill(userId: string, slug: string): Promise<UserPrivateSkillRecord | null> {
    return this.getOrLoad(
      this.userPrivateSkillKey(userId, slug),
      USER_SKILL_LIBRARY_CACHE_TTL_SECONDS,
      () => this.base.getUserPrivateSkill(userId, slug),
    );
  }

  async upsertUserPrivateSkill(
    userId: string,
    input: Omit<Required<ImportUserPrivateSkillInput>, 'artifact_base64'> & {artifactKey: string},
  ): Promise<UserPrivateSkillRecord> {
    const record = await this.base.upsertUserPrivateSkill(userId, input);
    await this.cache.delete(
      this.userPrivateSkillsKey(userId),
      this.userPrivateSkillKey(userId, input.slug),
      this.userSkillLibraryKey(userId),
    );
    return record;
  }

  async listUserAgentLibrary(userId: string): Promise<UserAgentLibraryRecord[]> {
    return this.getOrLoadValue(this.userAgentLibraryKey(userId), USER_SKILL_LIBRARY_CACHE_TTL_SECONDS, () =>
      this.base.listUserAgentLibrary(userId),
    );
  }

  async installUserAgent(userId: string, input: Required<InstallAgentInput>): Promise<UserAgentLibraryRecord> {
    const record = await this.base.installUserAgent(userId, input);
    await this.cache.delete(this.userAgentLibraryKey(userId));
    return record;
  }

  async removeUserAgent(userId: string, slug: string): Promise<boolean> {
    const removed = await this.base.removeUserAgent(userId, slug);
    if (removed) {
      await this.cache.delete(this.userAgentLibraryKey(userId));
    }
    return removed;
  }

  async listUserSkillLibrary(userId: string): Promise<UserSkillLibraryRecord[]> {
    return this.getOrLoadValue(this.userSkillLibraryKey(userId), USER_SKILL_LIBRARY_CACHE_TTL_SECONDS, () =>
      this.base.listUserSkillLibrary(userId),
    );
  }

  async installUserSkill(
    userId: string,
    input: Required<InstallSkillInput> & {source?: 'cloud' | 'private'},
  ): Promise<UserSkillLibraryRecord> {
    const record = await this.base.installUserSkill(userId, input);
    await this.cache.delete(this.userSkillLibraryKey(userId));
    return record;
  }

  async updateUserSkill(
    userId: string,
    input: Required<UpdateSkillLibraryItemInput>,
  ): Promise<UserSkillLibraryRecord | null> {
    const record = await this.base.updateUserSkill(userId, input);
    await this.cache.delete(this.userSkillLibraryKey(userId));
    return record;
  }

  async removeUserSkill(userId: string, slug: string): Promise<boolean> {
    const removed = await this.base.removeUserSkill(userId, slug);
    if (removed) {
      await this.cache.delete(this.userSkillLibraryKey(userId));
    }
    return removed;
  }

  private async getOrLoad<T>(key: string, ttlSeconds: number, loader: () => Promise<T | null>): Promise<T | null> {
    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    if (value !== null) {
      await this.cache.set(key, value, ttlSeconds);
    }
    return value;
  }

  private async getOrLoadValue<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    await this.cache.set(key, value, ttlSeconds);
    return value;
  }

  private async cacheSession(session: SessionRecord): Promise<void> {
    await Promise.all([
      this.cache.set(
        this.accessSessionKey(session.accessTokenHash),
        session,
        sessionTtlSeconds(session, 'access'),
      ),
      this.cache.set(
        this.refreshSessionKey(session.refreshTokenHash),
        session,
        sessionTtlSeconds(session, 'refresh'),
      ),
    ]);
  }

  private userIdKey(userId: string): string {
    return `user:id:${userId}`;
  }

  private userIdentifierKey(identifier: string): string {
    return `user:identifier:${normalizeIdentifier(identifier)}`;
  }

  private accessSessionKey(tokenHash: string): string {
    return `session:access:${tokenHash}`;
  }

  private refreshSessionKey(tokenHash: string): string {
    return `session:refresh:${tokenHash}`;
  }

  private creditBalanceKey(userId: string): string {
    return `credit:balance:${userId}`;
  }

  private creditLedgerKey(userId: string): string {
    return `credit:ledger:${userId}`;
  }

  private runGrantKey(grantId: string): string {
    return `run-grant:${grantId}`;
  }

  private usageEventKey(eventId: string): string {
    return `usage-event:${eventId}`;
  }

  private workspaceBackupKey(userId: string): string {
    return `workspace-backup:${userId}`;
  }

  private agentCatalogKey(): string {
    return 'agents:catalog';
  }

  private agentCatalogEntryKey(slug: string): string {
    return `agents:entry:${slug}`;
  }

  private skillCatalogKey(): string {
    return 'skills:catalog';
  }

  private adminSkillCatalogKey(): string {
    return 'skills:catalog:admin';
  }

  private skillCatalogEntryKey(slug: string): string {
    return `skills:entry:${slug}`;
  }

  private skillReleaseKey(slug: string, version?: string): string {
    return `skills:release:${slug}:${version || 'latest'}`;
  }

  private userSkillLibraryKey(userId: string): string {
    return `skills:library:${userId}`;
  }

  private userAgentLibraryKey(userId: string): string {
    return `agents:library:${userId}`;
  }

  private userPrivateSkillsKey(userId: string): string {
    return `skills:private:${userId}`;
  }

  private userPrivateSkillKey(userId: string, slug: string): string {
    return `skills:private:${userId}:${slug}`;
  }

  private oauthUserKey(provider: OAuthProvider, providerId: string): string {
    return `user:oauth:${provider}:${providerId}`;
  }

  private oauthAccountsKey(userId: string): string {
    return `user:oauth-accounts:${userId}`;
  }
}
