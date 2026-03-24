import { randomUUID } from 'node:crypto';

import {config} from './config.ts';
import {
  createDefaultAgentCatalogEntries,
  createDefaultCloudSkillCatalogEntries,
} from './catalog-defaults.ts';
import type {
  AgentCatalogEntryRecord,
  CreatePaymentOrderInput,
  CreateUserInput,
  CreditAccountRecord,
  CreditLedgerRecord,
  ImportUserPrivateSkillInput,
  InstallAgentInput,
  InstallMcpInput,
  InstallSkillInput,
  McpCatalogEntryRecord,
  OAuthAccountRecord,
  OAuthProvider,
  PaymentOrderRecord,
  PaymentProvider,
  PaymentWebhookInput,
  RunBillingSummaryRecord,
  RunGrantRecord,
  SessionRecord,
  SessionTokenPair,
  SkillCatalogEntryRecord,
  SkillSyncRunRecord,
  SkillSyncSourceRecord,
  UpsertAgentCatalogEntryInput,
  UpsertSkillCatalogEntryInput,
  UpsertSkillSyncSourceInput,
  UsageEventInput,
  UsageEventResult,
  UserAgentLibraryRecord,
  UserMcpLibraryRecord,
  UserPrivateSkillRecord,
  UserRole,
  UserSkillLibraryRecord,
  UpdateMcpLibraryItemInput,
  UpdateSkillLibraryItemInput,
  UserFileRecord,
  UserRecord,
  WorkspaceBackupInput,
  WorkspaceBackupRecord,
} from './domain.ts';
import { DEFAULT_CLAWHUB_SYNC_SOURCE } from './skill-sync-defaults.ts';
import {buildPlaceholderPaymentUrl} from './payment-placeholders.ts';

function normalizeUsernameLookup(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function startOfNextShanghaiDayIso(from = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(from);
  const year = Number(parts.find((item) => item.type === 'year')?.value || '1970');
  const month = Number(parts.find((item) => item.type === 'month')?.value || '01');
  const day = Number(parts.find((item) => item.type === 'day')?.value || '01');
  const nextUtc = Date.UTC(year, month - 1, day, 16, 0, 0, 0) + 24 * 60 * 60 * 1000;
  return new Date(nextUtc).toISOString();
}

function expirePaymentOrderIfNeeded(order: PaymentOrderRecord): PaymentOrderRecord {
  if (order.status !== 'pending' || !order.expiredAt) {
    return order;
  }
  if (new Date(order.expiredAt).getTime() > Date.now()) {
    return order;
  }
  return {
    ...order,
    status: 'expired',
    updatedAt: new Date().toISOString(),
  };
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
  getCreditAccount(userId: string): Promise<CreditAccountRecord>;
  getCreditBalance(userId: string): Promise<number>;
  getCreditLedger(userId: string): Promise<CreditLedgerRecord[]>;
  createPaymentOrder(userId: string, input: Required<CreatePaymentOrderInput> & {packageName: string; credits: number; bonusCredits: number; amountCnyFen: number;}): Promise<PaymentOrderRecord>;
  getPaymentOrderById(userId: string, orderId: string): Promise<PaymentOrderRecord | null>;
  applyPaymentWebhook(provider: PaymentProvider, input: Required<PaymentWebhookInput>): Promise<PaymentOrderRecord | null>;
  getRunGrantById(grantId: string): Promise<RunGrantRecord | null>;
  getRunBillingSummary(grantId: string): Promise<RunBillingSummaryRecord | null>;
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
  listUserFiles(
    userId: string,
    options?: {kind?: string | null; includeDeleted?: boolean; limit?: number | null},
  ): Promise<UserFileRecord[]>;
  getUserFile(userId: string, fileId: string): Promise<UserFileRecord | null>;
  createUserFile(
    userId: string,
    input: {
      tenantId: string;
      kind: string;
      storageProvider: 'minio';
      objectKey: string;
      originalFileName: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
      source?: string | null;
      taskId?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<UserFileRecord>;
  markUserFileDeleted(userId: string, fileId: string): Promise<UserFileRecord | null>;
  listAgentCatalog(): Promise<AgentCatalogEntryRecord[]>;
  listAgentCatalogAdmin(): Promise<AgentCatalogEntryRecord[]>;
  countAgentCatalogAdmin(): Promise<number>;
  getAgentCatalogEntry(slug: string): Promise<AgentCatalogEntryRecord | null>;
  upsertAgentCatalogEntry(input: Required<UpsertAgentCatalogEntryInput>): Promise<AgentCatalogEntryRecord>;
  deleteAgentCatalogEntry(slug: string): Promise<boolean>;
  listSkillCatalog(limit?: number, offset?: number): Promise<SkillCatalogEntryRecord[]>;
  countSkillCatalog(): Promise<number>;
  listSkillCatalogAdmin(limit?: number, offset?: number): Promise<SkillCatalogEntryRecord[]>;
  countSkillCatalogAdmin(): Promise<number>;
  getSkillCatalogEntry(slug: string): Promise<SkillCatalogEntryRecord | null>;
  upsertSkillCatalogEntry(input: Required<UpsertSkillCatalogEntryInput>): Promise<SkillCatalogEntryRecord>;
  deleteSkillCatalogEntry(slug: string): Promise<boolean>;
  listMcpCatalog(limit?: number, offset?: number): Promise<McpCatalogEntryRecord[]>;
  countMcpCatalog(): Promise<number>;
  getMcpCatalogEntry(mcpKey: string): Promise<McpCatalogEntryRecord | null>;
  listSkillSyncSources(): Promise<SkillSyncSourceRecord[]>;
  getSkillSyncSource(id: string): Promise<SkillSyncSourceRecord | null>;
  upsertSkillSyncSource(input: Required<UpsertSkillSyncSourceInput>): Promise<SkillSyncSourceRecord>;
  deleteSkillSyncSource(id: string): Promise<boolean>;
  listSkillSyncRuns(limit?: number): Promise<SkillSyncRunRecord[]>;
  createSkillSyncRun(input: {
    sourceId: string;
    sourceKey: string;
    sourceType: SkillSyncSourceRecord['sourceType'];
    displayName: string;
    status: SkillSyncRunRecord['status'];
    summary: Record<string, unknown>;
    items: SkillSyncRunRecord['items'];
    startedAt: string;
    finishedAt?: string | null;
  }): Promise<SkillSyncRunRecord>;
  listUserAgentLibrary(userId: string): Promise<UserAgentLibraryRecord[]>;
  installUserAgent(userId: string, input: Required<InstallAgentInput>): Promise<UserAgentLibraryRecord>;
  removeUserAgent(userId: string, slug: string): Promise<boolean>;
  listUserPrivateSkills(userId: string): Promise<UserPrivateSkillRecord[]>;
  getUserPrivateSkill(userId: string, slug: string): Promise<UserPrivateSkillRecord | null>;
  upsertUserPrivateSkill(
    userId: string,
    input: Omit<Required<ImportUserPrivateSkillInput>, 'artifact_base64'> & {artifactKey: string},
  ): Promise<UserPrivateSkillRecord>;
  deleteUserPrivateSkill(userId: string, slug: string): Promise<boolean>;
  listUserMcpLibrary(userId: string): Promise<UserMcpLibraryRecord[]>;
  installUserMcp(
    userId: string,
    input: Required<InstallMcpInput> & {source?: 'cloud'},
  ): Promise<UserMcpLibraryRecord>;
  updateUserMcp(userId: string, input: Required<UpdateMcpLibraryItemInput>): Promise<UserMcpLibraryRecord | null>;
  removeUserMcp(userId: string, mcpKey: string): Promise<boolean>;
  listUserSkillLibrary(userId: string): Promise<UserSkillLibraryRecord[]>;
  installUserSkill(
    userId: string,
    input: Required<InstallSkillInput> & {source?: 'cloud' | 'private'},
  ): Promise<UserSkillLibraryRecord>;
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
  private readonly creditAccountsByUserId = new Map<string, CreditAccountRecord>();
  private readonly creditLedgerByUserId = new Map<string, CreditLedgerRecord[]>();
  private readonly paymentOrdersById = new Map<string, PaymentOrderRecord>();
  private readonly runGrantsById = new Map<string, RunGrantRecord>();
  private readonly usageEventsByEventId = new Map<string, UsageEventResult>();
  private readonly runBillingSummaryByGrantId = new Map<string, RunBillingSummaryRecord>();
  private readonly workspaceBackupsByUserId = new Map<string, WorkspaceBackupRecord>();
  private readonly userFiles = new Map<string, UserFileRecord>();
  private readonly agentCatalog = new Map<string, AgentCatalogEntryRecord>();
  private readonly userAgentLibrary = new Map<string, UserAgentLibraryRecord>();
  private readonly skillCatalog = new Map<string, SkillCatalogEntryRecord>();
  private readonly mcpCatalog = new Map<string, McpCatalogEntryRecord>();
  private readonly skillSyncSources = new Map<string, SkillSyncSourceRecord>();
  private readonly skillSyncRuns = new Map<string, SkillSyncRunRecord>();
  private readonly userMcpLibrary = new Map<string, UserMcpLibraryRecord>();
  private readonly userSkillLibrary = new Map<string, UserSkillLibraryRecord>();
  private readonly userPrivateSkills = new Map<string, UserPrivateSkillRecord>();

  constructor() {
    const now = new Date().toISOString();
    for (const entry of createDefaultCloudSkillCatalogEntries(now)) {
      this.skillCatalog.set(entry.slug, entry);
    }

    const defaultSource: SkillSyncSourceRecord = {
      id: DEFAULT_CLAWHUB_SYNC_SOURCE.id,
      sourceType: DEFAULT_CLAWHUB_SYNC_SOURCE.source_type,
      sourceKey: DEFAULT_CLAWHUB_SYNC_SOURCE.source_key,
      displayName: DEFAULT_CLAWHUB_SYNC_SOURCE.display_name,
      sourceUrl: DEFAULT_CLAWHUB_SYNC_SOURCE.source_url,
      config: DEFAULT_CLAWHUB_SYNC_SOURCE.config,
      active: DEFAULT_CLAWHUB_SYNC_SOURCE.active,
      lastRunAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.skillSyncSources.set(defaultSource.id, defaultSource);

    for (const entry of createDefaultAgentCatalogEntries(now)) {
      this.agentCatalog.set(entry.slug, entry);
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
    const account: CreditAccountRecord = {
      userId: user.id,
      dailyFreeBalance: config.dailyFreeCredits,
      topupBalance: Math.max(0, input.initialCreditBalance),
      dailyFreeQuota: config.dailyFreeCredits,
      totalAvailableBalance: config.dailyFreeCredits + Math.max(0, input.initialCreditBalance),
      dailyFreeGrantedAt: now,
      dailyFreeExpiresAt: startOfNextShanghaiDayIso(new Date(now)),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const ledger: CreditLedgerRecord[] = [
      {
        id: randomUUID(),
        userId: user.id,
        bucket: 'daily_free',
        direction: 'grant',
        amount: config.dailyFreeCredits,
        balanceAfter: config.dailyFreeCredits,
        referenceType: 'daily_reset',
        referenceId: user.id,
        eventType: 'daily_reset',
        delta: config.dailyFreeCredits,
        createdAt: now,
      },
    ];
    if (account.topupBalance > 0) {
      ledger.unshift({
        id: randomUUID(),
        userId: user.id,
        bucket: 'topup',
        direction: 'grant',
        amount: account.topupBalance,
        balanceAfter: account.topupBalance,
        referenceType: 'trial_grant',
        referenceId: user.id,
        eventType: 'signup_grant',
        delta: account.topupBalance,
        createdAt: now,
      });
    }
    this.creditAccountsByUserId.set(user.id, account);
    this.creditLedgerByUserId.set(user.id, ledger);

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

  async getCreditAccount(userId: string): Promise<CreditAccountRecord> {
    const current = this.creditAccountsByUserId.get(userId);
    if (!current) {
      const now = new Date().toISOString();
      const next: CreditAccountRecord = {
        userId,
        dailyFreeBalance: config.dailyFreeCredits,
        topupBalance: 0,
        dailyFreeQuota: config.dailyFreeCredits,
        totalAvailableBalance: config.dailyFreeCredits,
        dailyFreeGrantedAt: now,
        dailyFreeExpiresAt: startOfNextShanghaiDayIso(new Date(now)),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      this.creditAccountsByUserId.set(userId, next);
      return next;
    }
    if (new Date(current.dailyFreeExpiresAt).getTime() > Date.now()) {
      return current;
    }
    const now = new Date().toISOString();
    const next: CreditAccountRecord = {
      ...current,
      dailyFreeBalance: config.dailyFreeCredits,
      dailyFreeQuota: config.dailyFreeCredits,
      totalAvailableBalance: config.dailyFreeCredits + current.topupBalance,
      dailyFreeGrantedAt: now,
      dailyFreeExpiresAt: startOfNextShanghaiDayIso(new Date(now)),
      updatedAt: now,
    };
    this.creditAccountsByUserId.set(userId, next);
    const ledger = this.creditLedgerByUserId.get(userId) || [];
    ledger.unshift({
      id: randomUUID(),
      userId,
      bucket: 'daily_free',
      direction: 'grant',
      amount: config.dailyFreeCredits,
      balanceAfter: config.dailyFreeCredits,
      referenceType: 'daily_reset',
      referenceId: next.dailyFreeGrantedAt,
      eventType: 'daily_reset',
      delta: config.dailyFreeCredits,
      createdAt: now,
    });
    this.creditLedgerByUserId.set(userId, ledger);
    return next;
  }

  async getCreditBalance(userId: string): Promise<number> {
    const account = await this.getCreditAccount(userId);
    return account.totalAvailableBalance;
  }

  async getCreditLedger(userId: string): Promise<CreditLedgerRecord[]> {
    await this.getCreditAccount(userId);
    return this.creditLedgerByUserId.get(userId) || [];
  }

  async createPaymentOrder(
    userId: string,
    input: Required<CreatePaymentOrderInput> & {packageName: string; credits: number; bonusCredits: number; amountCnyFen: number},
  ): Promise<PaymentOrderRecord> {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const orderId = randomUUID();
    const order: PaymentOrderRecord = {
      id: orderId,
      userId,
      provider: input.provider as PaymentProvider,
      packageId: input.package_id,
      packageName: input.packageName,
      credits: input.credits,
      bonusCredits: input.bonusCredits,
      amountCnyFen: input.amountCnyFen,
      currency: 'cny',
      status: 'pending',
      providerOrderId: null,
      providerPrepayId: null,
      paymentUrl: buildPlaceholderPaymentUrl({
        provider: input.provider as PaymentProvider,
        orderId,
        packageName: input.packageName,
        amountCnyFen: input.amountCnyFen,
        expiresAt,
      }),
      paidAt: null,
      expiredAt: expiresAt,
      createdAt: now,
      updatedAt: now,
    };
    this.paymentOrdersById.set(order.id, order);
    return order;
  }

  async getPaymentOrderById(userId: string, orderId: string): Promise<PaymentOrderRecord | null> {
    const order = this.paymentOrdersById.get(orderId) || null;
    if (!order || order.userId !== userId) {
      return null;
    }
    const normalized = expirePaymentOrderIfNeeded(order);
    if (normalized !== order) {
      this.paymentOrdersById.set(order.id, normalized);
    }
    return normalized;
  }

  async applyPaymentWebhook(provider: PaymentProvider, input: Required<PaymentWebhookInput>): Promise<PaymentOrderRecord | null> {
    const order = this.paymentOrdersById.get(input.order_id || '');
    if (!order || order.provider !== provider) {
      return null;
    }
    if (order.status === 'paid') {
      return order;
    }
    const now = input.paid_at?.trim() || new Date().toISOString();
    const paidOrder: PaymentOrderRecord = {
      ...order,
      providerOrderId: input.provider_order_id || order.providerOrderId,
      status:
        input.status === 'paid' || input.status === 'failed' || input.status === 'expired' || input.status === 'refunded'
          ? input.status
          : order.status,
      paidAt: input.status === 'paid' ? now : order.paidAt,
      updatedAt: new Date().toISOString(),
    };
    this.paymentOrdersById.set(order.id, paidOrder);
    if (paidOrder.status === 'paid') {
      const account = await this.getCreditAccount(order.userId);
      const nextTopup = account.topupBalance + paidOrder.credits + paidOrder.bonusCredits;
      const nextAccount: CreditAccountRecord = {
        ...account,
        topupBalance: nextTopup,
        totalAvailableBalance: account.dailyFreeBalance + nextTopup,
        updatedAt: paidOrder.updatedAt,
      };
      this.creditAccountsByUserId.set(order.userId, nextAccount);
      const ledger = this.creditLedgerByUserId.get(order.userId) || [];
      ledger.unshift({
        id: randomUUID(),
        userId: order.userId,
        bucket: 'topup',
        direction: 'topup',
        amount: paidOrder.credits + paidOrder.bonusCredits,
        balanceAfter: nextTopup,
        referenceType: 'topup_order',
        referenceId: order.id,
        eventType: 'topup',
        delta: paidOrder.credits + paidOrder.bonusCredits,
        createdAt: paidOrder.updatedAt,
      });
      this.creditLedgerByUserId.set(order.userId, ledger);
    }
    return paidOrder;
  }

  async getRunGrantById(grantId: string): Promise<RunGrantRecord | null> {
    return this.runGrantsById.get(grantId) || null;
  }

  async getRunBillingSummary(grantId: string): Promise<RunBillingSummaryRecord | null> {
    return this.runBillingSummaryByGrantId.get(grantId) || null;
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
      status: 'issued',
      nonce: input.nonce,
      maxInputTokens: input.maxInputTokens,
      maxOutputTokens: input.maxOutputTokens,
      creditLimit: input.creditLimit,
      expiresAt: input.expiresAt,
      usedAt: null,
      signature: input.signature,
      billingSummary: null,
      createdAt: new Date().toISOString(),
    };
    this.runGrantsById.set(grant.id, grant);
    return grant;
  }

  async recordUsageEvent(userId: string, input: Required<UsageEventInput>): Promise<UsageEventResult> {
    const existing = this.usageEventsByEventId.get(input.event_id);
    if (existing) return existing;

    const currentAccount = await this.getCreditAccount(userId);
    const requestedCost = Math.max(0, input.credit_cost);
    const dailyDebit = Math.min(currentAccount.dailyFreeBalance, requestedCost);
    const topupDebit = requestedCost - dailyDebit;
    if (topupDebit > currentAccount.topupBalance) {
      throw new Error('INSUFFICIENT_CREDITS');
    }
    const nextAccount: CreditAccountRecord = {
      ...currentAccount,
      dailyFreeBalance: currentAccount.dailyFreeBalance - dailyDebit,
      topupBalance: currentAccount.topupBalance - topupDebit,
      totalAvailableBalance: currentAccount.totalAvailableBalance - requestedCost,
      updatedAt: new Date().toISOString(),
    };
    this.creditAccountsByUserId.set(userId, nextAccount);

    const ledger = this.creditLedgerByUserId.get(userId) || [];
    const createdAt = new Date().toISOString();
    if (topupDebit > 0) {
      ledger.unshift({
        id: randomUUID(),
        userId,
        bucket: 'topup',
        direction: 'consume',
        amount: -topupDebit,
        balanceAfter: nextAccount.topupBalance,
        referenceType: 'chat_run',
        referenceId: input.event_id,
        eventType: 'usage_debit',
        delta: -topupDebit,
        createdAt,
      });
    }
    if (dailyDebit > 0) {
      ledger.unshift({
        id: randomUUID(),
        userId,
        bucket: 'daily_free',
        direction: 'consume',
        amount: -dailyDebit,
        balanceAfter: nextAccount.dailyFreeBalance,
        referenceType: 'chat_run',
        referenceId: input.event_id,
        eventType: 'usage_debit',
        delta: -dailyDebit,
        createdAt,
      });
    }
    this.creditLedgerByUserId.set(userId, ledger);

    const grant = input.grant_id ? this.runGrantsById.get(input.grant_id) || null : null;
    const settledAt = createdAt;
    const summary: RunBillingSummaryRecord = {
      grantId: input.grant_id,
      eventId: input.event_id,
      sessionKey: grant?.sessionKey || 'main',
      client: grant?.client || 'desktop',
      status: 'settled',
      inputTokens: Math.max(0, input.input_tokens),
      outputTokens: Math.max(0, input.output_tokens),
      creditCost: Math.max(0, input.credit_cost),
      provider: input.provider || null,
      model: input.model || null,
      balanceAfter: nextAccount.totalAvailableBalance,
      settledAt,
    };

    if (grant) {
      this.runGrantsById.set(grant.id, {
        ...grant,
        status: 'settled',
        usedAt: settledAt,
        billingSummary: summary,
      });
      this.runBillingSummaryByGrantId.set(grant.id, summary);
    }

    const result: UsageEventResult = {
      accepted: true,
      balanceAfter: nextAccount,
      debits: [
        ...(dailyDebit > 0 ? [{bucket: 'daily_free' as const, amount: dailyDebit}] : []),
        ...(topupDebit > 0 ? [{bucket: 'topup' as const, amount: topupDebit}] : []),
      ],
      summary,
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

  async listUserFiles(
    userId: string,
    options?: {kind?: string | null; includeDeleted?: boolean; limit?: number | null},
  ): Promise<UserFileRecord[]> {
    const normalizedKind = options?.kind?.trim() || null;
    const includeDeleted = Boolean(options?.includeDeleted);
    const limit = typeof options?.limit === 'number' && Number.isFinite(options.limit) ? Math.max(1, Math.floor(options.limit)) : null;
    const items = Array.from(this.userFiles.values())
      .filter((item) => item.userId === userId)
      .filter((item) => !normalizedKind || item.kind === normalizedKind)
      .filter((item) => includeDeleted || item.status !== 'deleted')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return limit ? items.slice(0, limit) : items;
  }

  async getUserFile(userId: string, fileId: string): Promise<UserFileRecord | null> {
    const record = this.userFiles.get(fileId);
    return record && record.userId === userId ? record : null;
  }

  async createUserFile(
    userId: string,
    input: {
      tenantId: string;
      kind: string;
      storageProvider: 'minio';
      objectKey: string;
      originalFileName: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
      source?: string | null;
      taskId?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<UserFileRecord> {
    const now = new Date().toISOString();
    const record: UserFileRecord = {
      id: randomUUID(),
      userId,
      tenantId: input.tenantId,
      kind: input.kind,
      status: 'active',
      storageProvider: input.storageProvider,
      objectKey: input.objectKey,
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256,
      source: input.source?.trim() || null,
      taskId: input.taskId?.trim() || null,
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.userFiles.set(record.id, record);
    return record;
  }

  async markUserFileDeleted(userId: string, fileId: string): Promise<UserFileRecord | null> {
    const current = this.userFiles.get(fileId);
    if (!current || current.userId !== userId) {
      return null;
    }
    if (current.status === 'deleted') {
      return current;
    }
    const now = new Date().toISOString();
    const record: UserFileRecord = {
      ...current,
      status: 'deleted',
      updatedAt: now,
      deletedAt: now,
    };
    this.userFiles.set(fileId, record);
    return record;
  }

  async listAgentCatalog(): Promise<AgentCatalogEntryRecord[]> {
    return Array.from(this.agentCatalog.values())
      .filter((item) => item.active)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'zh-CN'));
  }

  async listAgentCatalogAdmin(): Promise<AgentCatalogEntryRecord[]> {
    return Array.from(this.agentCatalog.values()).sort(
      (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'zh-CN'),
    );
  }

  async countAgentCatalogAdmin(): Promise<number> {
    return this.agentCatalog.size;
  }

  async getAgentCatalogEntry(slug: string): Promise<AgentCatalogEntryRecord | null> {
    return this.agentCatalog.get(slug) || null;
  }

  async upsertAgentCatalogEntry(input: Required<UpsertAgentCatalogEntryInput>): Promise<AgentCatalogEntryRecord> {
    const now = new Date().toISOString();
    const existing = this.agentCatalog.get(input.slug);
    const next: AgentCatalogEntryRecord = {
      slug: input.slug,
      name: input.name,
      description: input.description,
      category: input.category,
      publisher: input.publisher,
      featured: input.featured,
      official: input.official,
      tags: input.tags,
      capabilities: input.capabilities,
      useCases: input.use_cases,
      metadata: input.metadata,
      sortOrder: input.sort_order,
      active: input.active,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.agentCatalog.set(input.slug, next);
    return next;
  }

  async deleteAgentCatalogEntry(slug: string): Promise<boolean> {
    return this.agentCatalog.delete(slug);
  }

  async listSkillCatalog(limit?: number, offset?: number): Promise<SkillCatalogEntryRecord[]> {
    const items = Array.from(this.skillCatalog.values())
      .filter((item) => item.distribution === 'cloud' && item.active)
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
    return this.paginateSkillCatalog(items, limit, offset);
  }

  async countSkillCatalog(): Promise<number> {
    return Array.from(this.skillCatalog.values()).filter((item) => item.distribution === 'cloud' && item.active).length;
  }

  async listSkillCatalogAdmin(limit?: number, offset?: number): Promise<SkillCatalogEntryRecord[]> {
    const items = Array.from(this.skillCatalog.values()).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
    return this.paginateSkillCatalog(items, limit, offset);
  }

  async countSkillCatalogAdmin(): Promise<number> {
    return this.skillCatalog.size;
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
      version: input.version,
      artifactFormat: input.artifact_format,
      artifactUrl: input.artifact_url,
      artifactSha256: input.artifact_sha256,
      artifactSourcePath: input.artifact_source_path,
      originType: input.origin_type,
      sourceUrl: input.source_url,
      metadata: input.metadata,
      active: input.active,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.skillCatalog.set(input.slug, next);
    for (const [key, item] of this.userSkillLibrary.entries()) {
      if (item.slug !== input.slug || item.source !== 'cloud') continue;
      this.userSkillLibrary.set(key, {
        ...item,
        version: input.version,
        updatedAt: now,
      });
    }
    return next;
  }

  async deleteSkillCatalogEntry(slug: string): Promise<boolean> {
    return this.skillCatalog.delete(slug);
  }

  async listMcpCatalog(limit?: number, offset?: number): Promise<McpCatalogEntryRecord[]> {
    const items = Array.from(this.mcpCatalog.values())
      .filter((item) => item.active)
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
    return this.paginateSkillCatalog(items, limit, offset);
  }

  async countMcpCatalog(): Promise<number> {
    return Array.from(this.mcpCatalog.values()).filter((item) => item.active).length;
  }

  async getMcpCatalogEntry(mcpKey: string): Promise<McpCatalogEntryRecord | null> {
    return this.mcpCatalog.get(mcpKey) || null;
  }

  async listSkillSyncSources(): Promise<SkillSyncSourceRecord[]> {
    return Array.from(this.skillSyncSources.values()).sort((left, right) =>
      left.displayName.localeCompare(right.displayName, 'zh-CN'),
    );
  }

  async getSkillSyncSource(id: string): Promise<SkillSyncSourceRecord | null> {
    return this.skillSyncSources.get(id) || null;
  }

  async upsertSkillSyncSource(input: Required<UpsertSkillSyncSourceInput>): Promise<SkillSyncSourceRecord> {
    const now = new Date().toISOString();
    const id = input.id || randomUUID();
    const existing = this.skillSyncSources.get(id);
    const record: SkillSyncSourceRecord = {
      id,
      sourceType: input.source_type,
      sourceKey: input.source_key,
      displayName: input.display_name,
      sourceUrl: input.source_url,
      config: input.config,
      active: input.active,
      lastRunAt: existing?.lastRunAt || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.skillSyncSources.set(id, record);
    return record;
  }

  async deleteSkillSyncSource(id: string): Promise<boolean> {
    return this.skillSyncSources.delete(id);
  }

  async listSkillSyncRuns(limit = 20): Promise<SkillSyncRunRecord[]> {
    return Array.from(this.skillSyncRuns.values())
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .slice(0, limit);
  }

  async createSkillSyncRun(input: {
    sourceId: string;
    sourceKey: string;
    sourceType: SkillSyncSourceRecord['sourceType'];
    displayName: string;
    status: SkillSyncRunRecord['status'];
    summary: Record<string, unknown>;
    items: SkillSyncRunRecord['items'];
    startedAt: string;
    finishedAt?: string | null;
  }): Promise<SkillSyncRunRecord> {
    const record: SkillSyncRunRecord = {
      id: randomUUID(),
      sourceId: input.sourceId,
      sourceKey: input.sourceKey,
      sourceType: input.sourceType,
      displayName: input.displayName,
      status: input.status,
      summary: input.summary,
      items: input.items,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt || null,
    };
    this.skillSyncRuns.set(record.id, record);
    const source = this.skillSyncSources.get(record.sourceId);
    if (source) {
      this.skillSyncSources.set(source.id, {
        ...source,
        lastRunAt: record.finishedAt || record.startedAt,
        updatedAt: new Date().toISOString(),
      });
    }
    return record;
  }

  async listUserPrivateSkills(userId: string): Promise<UserPrivateSkillRecord[]> {
    return Array.from(this.userPrivateSkills.values()).filter((item) => item.userId === userId);
  }

  async getUserPrivateSkill(userId: string, slug: string): Promise<UserPrivateSkillRecord | null> {
    return this.userPrivateSkills.get(`${userId}:${slug}`) || null;
  }

  async upsertUserPrivateSkill(
    userId: string,
    input: Omit<Required<ImportUserPrivateSkillInput>, 'artifact_base64'> & {artifactKey: string},
  ): Promise<UserPrivateSkillRecord> {
    const now = new Date().toISOString();
    const key = `${userId}:${input.slug}`;
    const existing = this.userPrivateSkills.get(key);
    const record: UserPrivateSkillRecord = {
      userId,
      slug: input.slug,
      name: input.name,
      description: input.description,
      market: input.market,
      category: input.category,
      skillType: input.skill_type,
      publisher: input.publisher,
      tags: input.tags,
      sourceKind: input.source_kind,
      sourceUrl: input.source_url,
      version: input.version,
      artifactFormat: input.artifact_format,
      artifactKey: input.artifactKey,
      artifactSha256: input.artifact_sha256,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.userPrivateSkills.set(key, record);
    return record;
  }

  async deleteUserPrivateSkill(userId: string, slug: string): Promise<boolean> {
    return this.userPrivateSkills.delete(`${userId}:${slug}`);
  }

  async listUserAgentLibrary(userId: string): Promise<UserAgentLibraryRecord[]> {
    return Array.from(this.userAgentLibrary.values())
      .filter((item) => item.userId === userId)
      .sort((left, right) => right.installedAt.localeCompare(left.installedAt));
  }

  async installUserAgent(userId: string, input: Required<InstallAgentInput>): Promise<UserAgentLibraryRecord> {
    const now = new Date().toISOString();
    const key = `${userId}:${input.slug}`;
    const existing = this.userAgentLibrary.get(key);
    const record: UserAgentLibraryRecord = {
      userId,
      slug: input.slug,
      installedAt: existing?.installedAt || now,
      updatedAt: now,
    };
    this.userAgentLibrary.set(key, record);
    return record;
  }

  async removeUserAgent(userId: string, slug: string): Promise<boolean> {
    return this.userAgentLibrary.delete(`${userId}:${slug}`);
  }

  async listUserSkillLibrary(userId: string): Promise<UserSkillLibraryRecord[]> {
    return Array.from(this.userSkillLibrary.values()).filter((item) => item.userId === userId);
  }

  async listUserMcpLibrary(userId: string): Promise<UserMcpLibraryRecord[]> {
    return Array.from(this.userMcpLibrary.values()).filter((item) => item.userId === userId);
  }

  async installUserMcp(
    userId: string,
    input: Required<InstallMcpInput> & {source?: 'cloud'},
  ): Promise<UserMcpLibraryRecord> {
    const now = new Date().toISOString();
    const key = `${userId}:${input.mcp_key}`;
    const existing = this.userMcpLibrary.get(key);
    const record: UserMcpLibraryRecord = {
      userId,
      mcpKey: input.mcp_key,
      source: input.source || existing?.source || 'cloud',
      enabled: true,
      installedAt: existing?.installedAt || now,
      updatedAt: now,
    };
    this.userMcpLibrary.set(key, record);
    return record;
  }

  async updateUserMcp(
    userId: string,
    input: Required<UpdateMcpLibraryItemInput>,
  ): Promise<UserMcpLibraryRecord | null> {
    const key = `${userId}:${input.mcp_key}`;
    const existing = this.userMcpLibrary.get(key);
    if (!existing) return null;
    const record: UserMcpLibraryRecord = {
      ...existing,
      enabled: input.enabled,
      updatedAt: new Date().toISOString(),
    };
    this.userMcpLibrary.set(key, record);
    return record;
  }

  async removeUserMcp(userId: string, mcpKey: string): Promise<boolean> {
    return this.userMcpLibrary.delete(`${userId}:${mcpKey}`);
  }

  async installUserSkill(
    userId: string,
    input: Required<InstallSkillInput> & {source?: 'cloud' | 'private'},
  ): Promise<UserSkillLibraryRecord> {
    const now = new Date().toISOString();
    const key = `${userId}:${input.slug}`;
    const existing = this.userSkillLibrary.get(key);
    const record: UserSkillLibraryRecord = {
      userId,
      slug: input.slug,
      version: input.version,
      source: input.source || existing?.source || 'cloud',
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

  private paginateSkillCatalog<T>(
    items: T[],
    limit?: number,
    offset?: number,
  ): T[] {
    const normalizedOffset =
      typeof offset === 'number' && Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
    if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
      return items.slice(normalizedOffset);
    }
    return items.slice(normalizedOffset, normalizedOffset + Math.floor(limit));
  }
}
