import type {
  CreateDesktopActionApprovalGrantInput,
  CreateDesktopActionAuditEventInput,
  CreateDesktopDiagnosticUploadInput,
  CreateDesktopFaultReportInput,
  CreateFinanceComplianceEventInput,
  CreateClientMetricEventInput,
  CreateClientCrashEventInput,
  CreateClientPerfSampleInput,
  AdminPaymentOrderDetailRecord,
  AdminPaymentOrderSummaryRecord,
  AgentCatalogEntryRecord,
  InvestmentExpertCatalogSummaryRecord,
  CreatePaymentOrderInput,
  CreateUserInput,
  CreditAccountRecord,
  CreditLedgerRecord,
  ExtensionInstallTarget,
  ImportUserPrivateSkillInput,
  InstallAgentInput,
  InstallMcpInput,
  InstallSkillInput,
  MarketFundRecord,
  MarketNewsItemRecord,
  MarketOverviewRecord,
  MarketStockRecord,
  McpCatalogEntryRecord,
  OAuthAccountRecord,
  OAuthProvider,
  PaymentOrderRecord,
  PaymentProviderBindingMode,
  PaymentProviderBindingRecord,
  PaymentProviderChannelKind,
  PaymentProviderProfileRecord,
  PaymentProviderScopeType,
  PaymentProvider,
  PaymentWebhookInput,
  PersistedUsageEventInput,
  RunBillingSummaryRecord,
  RunGrantRecord,
  SessionRecord,
  SessionTokenPair,
  SkillCatalogEntryRecord,
  SyncTaskRunRecord,
  SkillSyncRunRecord,
  SkillSyncSourceRecord,
  DesktopActionApprovalGrantRecord,
  DesktopActionAuditEventRecord,
  DesktopActionPolicyRuleRecord,
  DesktopDiagnosticUploadRecord,
  DesktopFaultReportRecord,
  ClientMetricEventRecord,
  ClientCrashEventRecord,
  ClientPerfSampleRecord,
  FinanceComplianceEventRecord,
  UpsertAgentCatalogEntryInput,
  UpsertAdminPaymentProviderBindingInput,
  UpsertAdminPaymentProviderProfileInput,
  UpsertDesktopActionPolicyRuleInput,
  UpsertMcpCatalogEntryInput,
  UpsertSkillCatalogEntryInput,
  UpsertSkillSyncSourceInput,
  UpsertUserCustomMcpInput,
  UpsertUserExtensionInstallConfigInput,
  UsageEventResult,
  UserAgentLibraryRecord,
  UserCustomMcpRecord,
  UserExtensionInstallConfigRecord,
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
import type {KeyValueCache} from './cache.ts';
import type {ResolvedRechargePackageRecord} from './recharge-packages.ts';
import type {ResolvedRechargePaymentMethodRecord} from './recharge-payment-methods.ts';
import type {ControlPlaneStore} from './store.ts';

const USER_CACHE_TTL_SECONDS = 5 * 60;
const CREDIT_BALANCE_CACHE_TTL_SECONDS = 15;
const CREDIT_LEDGER_CACHE_TTL_SECONDS = 15;
const USAGE_EVENT_CACHE_TTL_SECONDS = 24 * 60 * 60;
const WORKSPACE_BACKUP_CACHE_TTL_SECONDS = 5 * 60;
const AGENT_CATALOG_CACHE_TTL_SECONDS = 5 * 60;
const SKILL_CATALOG_CACHE_TTL_SECONDS = 5 * 60;
const SKILL_CATALOG_PAGE_CACHE_TTL_SECONDS = 60;
const USER_SKILL_LIBRARY_CACHE_TTL_SECONDS = 60;
const MCP_CATALOG_CACHE_TTL_SECONDS = 5 * 60;
const MCP_CATALOG_PAGE_CACHE_TTL_SECONDS = 60;
const USER_MCP_LIBRARY_CACHE_TTL_SECONDS = 60;

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

  async getSystemState(stateKey: string): Promise<Record<string, unknown> | null> {
    return this.base.getSystemState(stateKey);
  }

  async setSystemState(stateKey: string, stateValue: Record<string, unknown>): Promise<void> {
    await this.base.setSystemState(stateKey, stateValue);
  }

  async deleteSystemState(stateKey: string): Promise<void> {
    await this.base.deleteSystemState(stateKey);
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
    const account = await this.base.getCreditAccount(user.id);
    await Promise.all([
      this.cache.set(this.userIdKey(user.id), user, USER_CACHE_TTL_SECONDS),
      this.cache.set(this.userIdentifierKey(user.username), user, USER_CACHE_TTL_SECONDS),
      this.cache.set(this.userIdentifierKey(user.email), user, USER_CACHE_TTL_SECONDS),
      this.cache.set(this.creditBalanceKey(user.id), account.totalAvailableBalance, CREDIT_BALANCE_CACHE_TTL_SECONDS),
      this.cache.set(this.creditAccountKey(user.id), account, CREDIT_BALANCE_CACHE_TTL_SECONDS),
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

  async getCreditAccount(userId: string): Promise<CreditAccountRecord> {
    return this.getOrLoadValue(this.creditAccountKey(userId), CREDIT_BALANCE_CACHE_TTL_SECONDS, () =>
      this.base.getCreditAccount(userId),
    );
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

  async createPaymentOrder(
    userId: string,
    input: Required<CreatePaymentOrderInput> & {
      order_id?: string;
      payment_url?: string | null;
      packageName: string;
      credits: number;
      bonusCredits: number;
      amountCnyFen: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<PaymentOrderRecord> {
    const order = await this.base.createPaymentOrder(userId, input);
    await this.cache.set(this.paymentOrderKey(order.id), order, CREDIT_BALANCE_CACHE_TTL_SECONDS);
    return order;
  }

  async getPaymentOrderById(userId: string, orderId: string): Promise<PaymentOrderRecord | null> {
    const cached = await this.cache.get<PaymentOrderRecord>(this.paymentOrderKey(orderId));
    if (cached && cached.userId === userId) {
      return cached;
    }
    const order = await this.base.getPaymentOrderById(userId, orderId);
    if (order) {
      await this.cache.set(this.paymentOrderKey(orderId), order, CREDIT_BALANCE_CACHE_TTL_SECONDS);
    }
    return order;
  }

  async resolveRechargePackage(packageId: string, appName?: string | null): Promise<ResolvedRechargePackageRecord | null> {
    return this.base.resolveRechargePackage(packageId, appName);
  }

  async resolveRechargePaymentMethods(appName?: string | null): Promise<ResolvedRechargePaymentMethodRecord[]> {
    return this.base.resolveRechargePaymentMethods(appName);
  }

  async listPaymentOrdersAdmin(input?: {
    limit?: number | null;
    status?: string | null;
    provider?: string | null;
    appName?: string | null;
    query?: string | null;
  }): Promise<AdminPaymentOrderSummaryRecord[]> {
    return this.base.listPaymentOrdersAdmin(input);
  }

  async listPaymentProviderProfiles(input?: {
    provider?: PaymentProvider | null;
    scopeType?: PaymentProviderScopeType | null;
    scopeKey?: string | null;
  }): Promise<PaymentProviderProfileRecord[]> {
    return this.base.listPaymentProviderProfiles(input);
  }

  async getPaymentProviderProfileById(id: string): Promise<PaymentProviderProfileRecord | null> {
    return this.base.getPaymentProviderProfileById(id);
  }

  async getPaymentProviderProfileByScope(
    provider: PaymentProvider,
    scopeType: PaymentProviderScopeType,
    scopeKey: string,
  ): Promise<PaymentProviderProfileRecord | null> {
    return this.base.getPaymentProviderProfileByScope(provider, scopeType, scopeKey);
  }

  async upsertPaymentProviderProfile(
    input: Required<UpsertAdminPaymentProviderProfileInput> & {
      provider: PaymentProvider;
      scope_type: PaymentProviderScopeType;
      channel_kind: PaymentProviderChannelKind;
      configured_secret_keys: string[];
      secret_payload_encrypted?: string | null;
      config_values: Record<string, unknown>;
    },
  ): Promise<PaymentProviderProfileRecord> {
    return this.base.upsertPaymentProviderProfile(input);
  }

  async listPaymentProviderBindings(provider?: PaymentProvider | null): Promise<PaymentProviderBindingRecord[]> {
    return this.base.listPaymentProviderBindings(provider);
  }

  async getPaymentProviderBinding(appName: string, provider: PaymentProvider): Promise<PaymentProviderBindingRecord | null> {
    return this.base.getPaymentProviderBinding(appName, provider);
  }

  async upsertPaymentProviderBinding(
    appName: string,
    input: Required<UpsertAdminPaymentProviderBindingInput> & {
      provider: PaymentProvider;
      mode: PaymentProviderBindingMode;
      active_profile_id?: string | null;
    },
  ): Promise<PaymentProviderBindingRecord> {
    return this.base.upsertPaymentProviderBinding(appName, input);
  }

  async getPaymentOrderAdmin(orderId: string): Promise<AdminPaymentOrderDetailRecord | null> {
    return this.base.getPaymentOrderAdmin(orderId);
  }

  async markPaymentOrderPaidAdmin(input: {
    orderId: string;
    operatorUserId: string;
    operatorDisplayName: string;
    providerOrderId?: string | null;
    paidAt?: string | null;
    note?: string | null;
  }): Promise<AdminPaymentOrderDetailRecord | null> {
    const detail = await this.base.markPaymentOrderPaidAdmin(input);
    if (detail) {
      await Promise.all([
        this.cache.delete(this.creditBalanceKey(detail.userId), this.creditAccountKey(detail.userId), this.creditLedgerKey(detail.userId)),
        this.cache.delete(this.paymentOrderKey(detail.id)),
      ]);
    }
    return detail;
  }

  async refundPaymentOrderAdmin(input: {
    orderId: string;
    operatorUserId: string;
    operatorDisplayName: string;
    note?: string | null;
  }): Promise<AdminPaymentOrderDetailRecord | null> {
    const detail = await this.base.refundPaymentOrderAdmin(input);
    if (detail) {
      await Promise.all([
        this.cache.delete(this.creditBalanceKey(detail.userId), this.creditAccountKey(detail.userId), this.creditLedgerKey(detail.userId)),
        this.cache.delete(this.paymentOrderKey(detail.id)),
      ]);
    }
    return detail;
  }

  async listDesktopActionPolicyRules(input?: {
    scope?: string | null;
    capability?: string | null;
    riskLevel?: string | null;
    enabled?: boolean | null;
    query?: string | null;
    limit?: number | null;
  }): Promise<DesktopActionPolicyRuleRecord[]> {
    return this.base.listDesktopActionPolicyRules(input);
  }

  async getDesktopActionPolicyRuleById(id: string): Promise<DesktopActionPolicyRuleRecord | null> {
    return this.base.getDesktopActionPolicyRuleById(id);
  }

  async upsertDesktopActionPolicyRule(
    input: Required<UpsertDesktopActionPolicyRuleInput> & {id: string},
  ): Promise<DesktopActionPolicyRuleRecord> {
    return this.base.upsertDesktopActionPolicyRule(input);
  }

  async listDesktopActionApprovalGrants(input?: {
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    capability?: string | null;
    activeOnly?: boolean | null;
    limit?: number | null;
  }): Promise<DesktopActionApprovalGrantRecord[]> {
    return this.base.listDesktopActionApprovalGrants(input);
  }

  async createDesktopActionApprovalGrant(
    input: Required<CreateDesktopActionApprovalGrantInput> & {id: string; created_at: string},
  ): Promise<DesktopActionApprovalGrantRecord> {
    return this.base.createDesktopActionApprovalGrant(input);
  }

  async revokeDesktopActionApprovalGrant(id: string, revokedAt: string): Promise<DesktopActionApprovalGrantRecord | null> {
    return this.base.revokeDesktopActionApprovalGrant(id, revokedAt);
  }

  async listDesktopActionAuditEvents(input?: {
    intentId?: string | null;
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    capability?: string | null;
    riskLevel?: string | null;
    decision?: string | null;
    limit?: number | null;
  }): Promise<DesktopActionAuditEventRecord[]> {
    return this.base.listDesktopActionAuditEvents(input);
  }

  async createDesktopActionAuditEvents(
    input: Array<Required<CreateDesktopActionAuditEventInput> & {id: string; created_at: string}>,
  ): Promise<DesktopActionAuditEventRecord[]> {
    return this.base.createDesktopActionAuditEvents(input);
  }

  async listDesktopDiagnosticUploads(input?: {
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    sourceType?: string | null;
    limit?: number | null;
  }): Promise<DesktopDiagnosticUploadRecord[]> {
    return this.base.listDesktopDiagnosticUploads(input);
  }

  async getDesktopDiagnosticUploadById(id: string): Promise<DesktopDiagnosticUploadRecord | null> {
    return this.base.getDesktopDiagnosticUploadById(id);
  }

  async createDesktopDiagnosticUpload(
    input: Required<CreateDesktopDiagnosticUploadInput> & {id: string; created_at: string},
  ): Promise<DesktopDiagnosticUploadRecord> {
    return this.base.createDesktopDiagnosticUpload(input);
  }

  async listDesktopFaultReports(input?: {
    reportId?: string | null;
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    platform?: string | null;
    entry?: string | null;
    accountState?: string | null;
    appVersion?: string | null;
    limit?: number | null;
  }): Promise<DesktopFaultReportRecord[]> {
    return this.base.listDesktopFaultReports(input);
  }

  async getDesktopFaultReportById(id: string): Promise<DesktopFaultReportRecord | null> {
    return this.base.getDesktopFaultReportById(id);
  }

  async getDesktopFaultReportByReportId(reportId: string): Promise<DesktopFaultReportRecord | null> {
    return this.base.getDesktopFaultReportByReportId(reportId);
  }

  async createDesktopFaultReport(
    input: Required<CreateDesktopFaultReportInput> & {id: string; created_at: string},
  ): Promise<DesktopFaultReportRecord> {
    return this.base.createDesktopFaultReport(input);
  }

  async listClientMetricEvents(input?: {
    eventName?: string | null;
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    brandId?: string | null;
    appVersion?: string | null;
    platform?: string | null;
    result?: string | null;
    limit?: number | null;
  }): Promise<ClientMetricEventRecord[]> {
    return this.base.listClientMetricEvents(input);
  }

  async createClientMetricEvents(
    input: Array<Required<CreateClientMetricEventInput> & {id: string; created_at: string}>,
  ): Promise<ClientMetricEventRecord[]> {
    return this.base.createClientMetricEvents(input);
  }

  async listClientCrashEvents(input?: {
    crashType?: string | null;
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    brandId?: string | null;
    appVersion?: string | null;
    platform?: string | null;
    limit?: number | null;
  }): Promise<ClientCrashEventRecord[]> {
    return this.base.listClientCrashEvents(input);
  }

  async createClientCrashEvent(
    input: Required<CreateClientCrashEventInput> & {id: string; created_at: string},
  ): Promise<ClientCrashEventRecord> {
    return this.base.createClientCrashEvent(input);
  }

  async listClientPerfSamples(input?: {
    metricName?: string | null;
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    brandId?: string | null;
    appVersion?: string | null;
    platform?: string | null;
    limit?: number | null;
  }): Promise<ClientPerfSampleRecord[]> {
    return this.base.listClientPerfSamples(input);
  }

  async createClientPerfSamples(
    input: Array<Required<CreateClientPerfSampleInput> & {id: string; created_at: string}>,
  ): Promise<ClientPerfSampleRecord[]> {
    return this.base.createClientPerfSamples(input);
  }

  async listFinanceComplianceEvents(input?: {
    appName?: string | null;
    sessionKey?: string | null;
    channel?: string | null;
    inputClassification?: string | null;
    outputClassification?: string | null;
    riskLevel?: string | null;
    limit?: number | null;
  }): Promise<FinanceComplianceEventRecord[]> {
    return this.base.listFinanceComplianceEvents(input);
  }

  async createFinanceComplianceEvent(
    input: Required<CreateFinanceComplianceEventInput> & {id: string; created_at: string},
  ): Promise<FinanceComplianceEventRecord> {
    return this.base.createFinanceComplianceEvent(input);
  }

  async applyPaymentWebhook(provider: PaymentProvider, input: Required<PaymentWebhookInput>): Promise<PaymentOrderRecord | null> {
    const order = await this.base.applyPaymentWebhook(provider, input);
    if (order) {
      await Promise.all([
        this.cache.set(this.paymentOrderKey(order.id), order, CREDIT_BALANCE_CACHE_TTL_SECONDS),
        this.cache.delete(this.creditBalanceKey(order.userId), this.creditAccountKey(order.userId), this.creditLedgerKey(order.userId)),
      ]);
    }
    return order;
  }

  async getRunGrantById(grantId: string): Promise<RunGrantRecord | null> {
    return this.getOrLoad(this.runGrantKey(grantId), USER_CACHE_TTL_SECONDS, () => this.base.getRunGrantById(grantId));
  }

  async getRunBillingSummary(grantId: string): Promise<RunBillingSummaryRecord | null> {
    return this.getOrLoad(this.runBillingSummaryKey(grantId), USER_CACHE_TTL_SECONDS, () =>
      this.base.getRunBillingSummary(grantId),
    );
  }

  async listRunBillingSummariesBySession(
    userId: string,
    sessionKey: string,
    limit?: number | null,
  ): Promise<RunBillingSummaryRecord[]> {
    return this.base.listRunBillingSummariesBySession(userId, sessionKey, limit);
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

  async recordUsageEvent(userId: string, input: PersistedUsageEventInput): Promise<UsageEventResult> {
    const cached = await this.cache.get<UsageEventResult>(this.usageEventKey(input.event_id));
    if (cached) {
      return cached;
    }

    const result = await this.base.recordUsageEvent(userId, input);
    await Promise.all([
      this.cache.set(this.usageEventKey(input.event_id), result, USAGE_EVENT_CACHE_TTL_SECONDS),
      this.cache.set(this.runBillingSummaryKey(input.grant_id), result.summary, USAGE_EVENT_CACHE_TTL_SECONDS),
      this.cache.delete(this.creditBalanceKey(userId), this.creditAccountKey(userId), this.creditLedgerKey(userId), this.runGrantKey(input.grant_id)),
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

  async listUserFiles(
    userId: string,
    options?: {kind?: string | null; includeDeleted?: boolean; limit?: number | null},
  ): Promise<UserFileRecord[]> {
    return this.base.listUserFiles(userId, options);
  }

  async getUserFile(userId: string, fileId: string): Promise<UserFileRecord | null> {
    return this.base.getUserFile(userId, fileId);
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
    return this.base.createUserFile(userId, input);
  }

  async markUserFileDeleted(userId: string, fileId: string): Promise<UserFileRecord | null> {
    return this.base.markUserFileDeleted(userId, fileId);
  }

  async listMarketStocks(input?: {
    market?: string | null;
    exchange?: string | null;
    search?: string | null;
    tag?: string | null;
    sort?: string | null;
    limit?: number | null;
    offset?: number | null;
  }): Promise<{items: MarketStockRecord[]; total: number}> {
    return this.base.listMarketStocks(input);
  }

  async getMarketStock(stockId: string): Promise<MarketStockRecord | null> {
    return this.base.getMarketStock(stockId);
  }

  async listMarketFunds(input?: {
    market?: string | null;
    exchange?: string | null;
    instrumentKind?: string | null;
    region?: string | null;
    riskLevel?: string | null;
    search?: string | null;
    tag?: string | null;
    sort?: string | null;
    limit?: number | null;
    offset?: number | null;
  }): Promise<{items: MarketFundRecord[]; total: number}> {
    return this.base.listMarketFunds(input);
  }

  async getMarketFund(fundId: string): Promise<MarketFundRecord | null> {
    return this.base.getMarketFund(fundId);
  }

  async getMarketOverview(input?: {
    marketScope?: string | null;
    indexLimit?: number | null;
    headlineLimit?: number | null;
  }): Promise<MarketOverviewRecord | null> {
    return this.base.getMarketOverview(input);
  }

  async listMarketNews(input?: {
    marketScope?: string | null;
    symbol?: string | null;
    tag?: string | null;
    limit?: number | null;
    offset?: number | null;
  }): Promise<{items: MarketNewsItemRecord[]; total: number}> {
    return this.base.listMarketNews(input);
  }

  async listSyncTaskRuns(input?: {
    taskId?: string | null;
    status?: string | null;
    triggerType?: string | null;
    limit?: number | null;
  }): Promise<SyncTaskRunRecord[]> {
    return this.base.listSyncTaskRuns(input);
  }

  async listAgentCatalog(): Promise<AgentCatalogEntryRecord[]> {
    return this.getOrLoadValue(this.agentCatalogKey(), AGENT_CATALOG_CACHE_TTL_SECONDS, () =>
      this.base.listAgentCatalog(),
    );
  }

  async listInvestmentExpertCatalogSummaries(): Promise<InvestmentExpertCatalogSummaryRecord[]> {
    return this.getOrLoadValue(this.investmentExpertCatalogKey(), AGENT_CATALOG_CACHE_TTL_SECONDS, () =>
      this.base.listInvestmentExpertCatalogSummaries(),
    );
  }

  async listAgentCatalogAdmin(): Promise<AgentCatalogEntryRecord[]> {
    return this.getOrLoadValue(this.adminAgentCatalogKey(), AGENT_CATALOG_CACHE_TTL_SECONDS, () =>
      this.base.listAgentCatalogAdmin(),
    );
  }

  async countAgentCatalogAdmin(): Promise<number> {
    return this.getOrLoadValue(this.adminAgentCatalogCountKey(), AGENT_CATALOG_CACHE_TTL_SECONDS, () =>
      this.base.countAgentCatalogAdmin(),
    );
  }

  async getAgentCatalogEntry(slug: string): Promise<AgentCatalogEntryRecord | null> {
    return this.getOrLoad(this.agentCatalogEntryKey(slug), AGENT_CATALOG_CACHE_TTL_SECONDS, () =>
      this.base.getAgentCatalogEntry(slug),
    );
  }

  async upsertAgentCatalogEntry(input: Required<UpsertAgentCatalogEntryInput>): Promise<AgentCatalogEntryRecord> {
    const record = await this.base.upsertAgentCatalogEntry(input);
    await this.cache.delete(
      this.agentCatalogKey(),
      this.investmentExpertCatalogKey(),
      this.adminAgentCatalogKey(),
      this.adminAgentCatalogCountKey(),
      this.agentCatalogEntryKey(input.slug),
    );
    return record;
  }

  async deleteAgentCatalogEntry(slug: string): Promise<boolean> {
    const removed = await this.base.deleteAgentCatalogEntry(slug);
    if (removed) {
      await this.cache.delete(
        this.agentCatalogKey(),
        this.investmentExpertCatalogKey(),
        this.adminAgentCatalogKey(),
        this.adminAgentCatalogCountKey(),
        this.agentCatalogEntryKey(slug),
      );
    }
    return removed;
  }

  async listSkillCatalog(
    limit?: number,
    offset?: number,
    filters?: {tagKeywords?: string[] | null; extraSkillSlugs?: string[] | null},
  ): Promise<SkillCatalogEntryRecord[]> {
    if (
      (Array.isArray(filters?.tagKeywords) && filters.tagKeywords.some((keyword) => keyword.trim())) ||
      (Array.isArray(filters?.extraSkillSlugs) && filters.extraSkillSlugs.some((slug) => slug.trim()))
    ) {
      return this.base.listSkillCatalog(limit, offset, filters);
    }
    if (typeof limit === 'number' || typeof offset === 'number') {
      return this.getOrLoadValue(
        this.skillCatalogPageKey(limit, offset),
        SKILL_CATALOG_PAGE_CACHE_TTL_SECONDS,
        () => this.base.listSkillCatalog(limit, offset),
      );
    }
    return this.getOrLoadValue(this.skillCatalogKey(), SKILL_CATALOG_CACHE_TTL_SECONDS, () =>
      this.base.listSkillCatalog(),
    );
  }

  async countSkillCatalog(filters?: {tagKeywords?: string[] | null; extraSkillSlugs?: string[] | null}): Promise<number> {
    if (
      (Array.isArray(filters?.tagKeywords) && filters.tagKeywords.some((keyword) => keyword.trim())) ||
      (Array.isArray(filters?.extraSkillSlugs) && filters.extraSkillSlugs.some((slug) => slug.trim()))
    ) {
      return this.base.countSkillCatalog(filters);
    }
    return this.getOrLoadValue(this.skillCatalogCountKey(), SKILL_CATALOG_PAGE_CACHE_TTL_SECONDS, () =>
      this.base.countSkillCatalog(),
    );
  }

  async listSkillCatalogBySlugs(
    slugs: string[],
    limit?: number,
    offset?: number,
    filters?: {tagKeywords?: string[] | null},
  ): Promise<SkillCatalogEntryRecord[]> {
    return this.base.listSkillCatalogBySlugs(slugs, limit, offset, filters);
  }

  async countSkillCatalogBySlugs(slugs: string[], filters?: {tagKeywords?: string[] | null}): Promise<number> {
    return this.base.countSkillCatalogBySlugs(slugs, filters);
  }

  async listSkillCatalogAdmin(limit?: number, offset?: number, query?: string): Promise<SkillCatalogEntryRecord[]> {
    if (typeof query === 'string' && query.trim()) {
      return this.base.listSkillCatalogAdmin(limit, offset, query);
    }
    if (typeof limit === 'number' || typeof offset === 'number') {
      return this.getOrLoadValue(
        this.adminSkillCatalogPageKey(limit, offset),
        SKILL_CATALOG_PAGE_CACHE_TTL_SECONDS,
        () => this.base.listSkillCatalogAdmin(limit, offset),
      );
    }
    return this.getOrLoadValue(this.adminSkillCatalogKey(), SKILL_CATALOG_CACHE_TTL_SECONDS, () =>
      this.base.listSkillCatalogAdmin(),
    );
  }

  async countSkillCatalogAdmin(query?: string): Promise<number> {
    if (typeof query === 'string' && query.trim()) {
      return this.base.countSkillCatalogAdmin(query);
    }
    return this.getOrLoadValue(this.adminSkillCatalogCountKey(), SKILL_CATALOG_PAGE_CACHE_TTL_SECONDS, () =>
      this.base.countSkillCatalogAdmin(),
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
      this.skillCatalogCountKey(),
      this.adminSkillCatalogCountKey(),
      this.skillCatalogPageKey(60, 0),
      this.skillCatalogPageKey(60, 60),
      this.skillCatalogPageKey(300, 0),
      this.skillCatalogPageKey(1000, 0),
      this.adminSkillCatalogPageKey(60, 0),
      this.adminSkillCatalogPageKey(60, 60),
      this.adminSkillCatalogPageKey(300, 0),
      this.adminSkillCatalogPageKey(1000, 0),
      this.skillCatalogEntryKey(input.slug),
    );
    return record;
  }

  async deleteSkillCatalogEntry(slug: string): Promise<boolean> {
    const removed = await this.base.deleteSkillCatalogEntry(slug);
    if (removed) {
      await this.cache.delete(
        this.skillCatalogKey(),
        this.adminSkillCatalogKey(),
        this.skillCatalogCountKey(),
        this.adminSkillCatalogCountKey(),
        this.skillCatalogPageKey(60, 0),
        this.skillCatalogPageKey(60, 60),
        this.skillCatalogPageKey(300, 0),
        this.skillCatalogPageKey(1000, 0),
        this.adminSkillCatalogPageKey(60, 0),
        this.adminSkillCatalogPageKey(60, 60),
        this.adminSkillCatalogPageKey(300, 0),
        this.adminSkillCatalogPageKey(1000, 0),
        this.skillCatalogEntryKey(slug),
      );
    }
    return removed;
  }

  async listMcpCatalog(limit?: number, offset?: number): Promise<McpCatalogEntryRecord[]> {
    if (typeof limit === 'number' || typeof offset === 'number') {
      return this.getOrLoadValue(
        this.mcpCatalogPageKey(limit, offset),
        MCP_CATALOG_PAGE_CACHE_TTL_SECONDS,
        () => this.base.listMcpCatalog(limit, offset),
      );
    }
    return this.getOrLoadValue(this.mcpCatalogKey(), MCP_CATALOG_CACHE_TTL_SECONDS, () => this.base.listMcpCatalog());
  }

  async listMcpCatalogAdmin(): Promise<McpCatalogEntryRecord[]> {
    return this.base.listMcpCatalogAdmin();
  }

  async countMcpCatalog(): Promise<number> {
    return this.getOrLoadValue(this.mcpCatalogCountKey(), MCP_CATALOG_PAGE_CACHE_TTL_SECONDS, () =>
      this.base.countMcpCatalog(),
    );
  }

  async getMcpCatalogEntry(mcpKey: string): Promise<McpCatalogEntryRecord | null> {
    return this.getOrLoad(this.mcpCatalogEntryKey(mcpKey), MCP_CATALOG_CACHE_TTL_SECONDS, () =>
      this.base.getMcpCatalogEntry(mcpKey),
    );
  }

  async upsertMcpCatalogEntry(input: Required<UpsertMcpCatalogEntryInput>): Promise<McpCatalogEntryRecord> {
    const record = await this.base.upsertMcpCatalogEntry(input);
    await this.cache.delete(
      this.mcpCatalogKey(),
      this.mcpCatalogCountKey(),
      this.mcpCatalogPageKey(60, 0),
      this.mcpCatalogPageKey(60, 60),
      this.mcpCatalogPageKey(300, 0),
      this.mcpCatalogPageKey(1000, 0),
      this.mcpCatalogEntryKey(record.mcpKey),
    );
    return record;
  }

  async deleteMcpCatalogEntry(mcpKey: string): Promise<boolean> {
    const removed = await this.base.deleteMcpCatalogEntry(mcpKey);
    if (removed) {
      await this.cache.delete(
        this.mcpCatalogKey(),
        this.mcpCatalogCountKey(),
        this.mcpCatalogPageKey(60, 0),
        this.mcpCatalogPageKey(60, 60),
        this.mcpCatalogPageKey(300, 0),
        this.mcpCatalogPageKey(1000, 0),
        this.mcpCatalogEntryKey(mcpKey),
      );
    }
    return removed;
  }

  async listSkillSyncSources(): Promise<SkillSyncSourceRecord[]> {
    return this.base.listSkillSyncSources();
  }

  async getSkillSyncSource(id: string): Promise<SkillSyncSourceRecord | null> {
    return this.base.getSkillSyncSource(id);
  }

  async upsertSkillSyncSource(input: Required<UpsertSkillSyncSourceInput>): Promise<SkillSyncSourceRecord> {
    return this.base.upsertSkillSyncSource(input);
  }

  async deleteSkillSyncSource(id: string): Promise<boolean> {
    return this.base.deleteSkillSyncSource(id);
  }

  async listSkillSyncRuns(limit?: number): Promise<SkillSyncRunRecord[]> {
    return this.base.listSkillSyncRuns(limit);
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
    return this.base.createSkillSyncRun(input);
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

  async deleteUserPrivateSkill(userId: string, slug: string): Promise<boolean> {
    const removed = await this.base.deleteUserPrivateSkill(userId, slug);
    if (removed) {
      await this.cache.delete(
        this.userPrivateSkillsKey(userId),
        this.userPrivateSkillKey(userId, slug),
        this.userSkillLibraryKey(userId),
      );
    }
    return removed;
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

  async listUserMcpLibrary(userId: string): Promise<UserMcpLibraryRecord[]> {
    return this.getOrLoadValue(this.userMcpLibraryKey(userId), USER_MCP_LIBRARY_CACHE_TTL_SECONDS, () =>
      this.base.listUserMcpLibrary(userId),
    );
  }

  async listUserCustomMcpLibrary(userId: string, appName: string): Promise<UserCustomMcpRecord[]> {
    return this.getOrLoadValue(`user:custom-mcp:${userId}:${appName}`, USER_MCP_LIBRARY_CACHE_TTL_SECONDS, () =>
      this.base.listUserCustomMcpLibrary(userId, appName),
    );
  }

  async listUserExtensionInstallConfigs(
    userId: string,
    extensionType?: ExtensionInstallTarget,
  ): Promise<UserExtensionInstallConfigRecord[]> {
    return this.getOrLoadValue(
      this.userExtensionInstallConfigsKey(userId, extensionType),
      USER_MCP_LIBRARY_CACHE_TTL_SECONDS,
      () => this.base.listUserExtensionInstallConfigs(userId, extensionType),
    );
  }

  async getUserExtensionInstallConfig(
    userId: string,
    extensionType: ExtensionInstallTarget,
    extensionKey: string,
  ): Promise<UserExtensionInstallConfigRecord | null> {
    return this.getOrLoad(
      this.userExtensionInstallConfigKey(userId, extensionType, extensionKey),
      USER_MCP_LIBRARY_CACHE_TTL_SECONDS,
      () => this.base.getUserExtensionInstallConfig(userId, extensionType, extensionKey),
    );
  }

  async upsertUserExtensionInstallConfig(
    userId: string,
    input: Required<UpsertUserExtensionInstallConfigInput> & {
      schema_version: number | null;
      status: UserExtensionInstallConfigRecord['status'];
      configured_secret_keys: string[];
      secret_payload_encrypted?: string | null;
    },
  ): Promise<UserExtensionInstallConfigRecord> {
    const record = await this.base.upsertUserExtensionInstallConfig(userId, input);
    await this.cache.delete(
      this.userExtensionInstallConfigsKey(userId),
      this.userExtensionInstallConfigsKey(userId, input.extension_type),
      this.userExtensionInstallConfigKey(userId, input.extension_type, input.extension_key),
      this.userSkillLibraryKey(userId),
      this.userMcpLibraryKey(userId),
    );
    return record;
  }

  async removeUserExtensionInstallConfig(
    userId: string,
    extensionType: ExtensionInstallTarget,
    extensionKey: string,
  ): Promise<boolean> {
    const removed = await this.base.removeUserExtensionInstallConfig(userId, extensionType, extensionKey);
    if (removed) {
      await this.cache.delete(
        this.userExtensionInstallConfigsKey(userId),
        this.userExtensionInstallConfigsKey(userId, extensionType),
        this.userExtensionInstallConfigKey(userId, extensionType, extensionKey),
        this.userSkillLibraryKey(userId),
        this.userMcpLibraryKey(userId),
      );
    }
    return removed;
  }

  async installUserMcp(
    userId: string,
    input: Required<InstallMcpInput> & {source?: 'cloud'},
  ): Promise<UserMcpLibraryRecord> {
    const record = await this.base.installUserMcp(userId, input);
    await this.cache.delete(this.userMcpLibraryKey(userId));
    return record;
  }

  async updateUserMcp(
    userId: string,
    input: Required<UpdateMcpLibraryItemInput>,
  ): Promise<UserMcpLibraryRecord | null> {
    const record = await this.base.updateUserMcp(userId, input);
    await this.cache.delete(this.userMcpLibraryKey(userId));
    return record;
  }

  async removeUserMcp(userId: string, mcpKey: string): Promise<boolean> {
    const removed = await this.base.removeUserMcp(userId, mcpKey);
    if (removed) {
      await this.cache.delete(
        this.userMcpLibraryKey(userId),
        this.userExtensionInstallConfigsKey(userId),
        this.userExtensionInstallConfigsKey(userId, 'mcp'),
        this.userExtensionInstallConfigKey(userId, 'mcp', mcpKey),
      );
    }
    return removed;
  }

  async upsertUserCustomMcp(
    userId: string,
    input: Required<UpsertUserCustomMcpInput> & {
      app_name: string;
      mcp_key: string;
      transport: 'stdio' | 'http' | 'sse';
      enabled: boolean;
      sort_order: number;
    },
  ): Promise<UserCustomMcpRecord> {
    const record = await this.base.upsertUserCustomMcp(userId, input);
    await this.cache.delete(
      `user:custom-mcp:${userId}:${input.app_name}`,
      this.userExtensionInstallConfigsKey(userId),
      this.userExtensionInstallConfigsKey(userId, 'mcp'),
      this.userExtensionInstallConfigKey(userId, 'mcp', input.mcp_key),
    );
    return record;
  }

  async removeUserCustomMcp(userId: string, appName: string, mcpKey: string): Promise<boolean> {
    const removed = await this.base.removeUserCustomMcp(userId, appName, mcpKey);
    if (removed) {
      await this.cache.delete(
        `user:custom-mcp:${userId}:${appName}`,
        this.userExtensionInstallConfigsKey(userId),
        this.userExtensionInstallConfigsKey(userId, 'mcp'),
        this.userExtensionInstallConfigKey(userId, 'mcp', mcpKey),
      );
    }
    return removed;
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
      await this.cache.delete(
        this.userSkillLibraryKey(userId),
        this.userExtensionInstallConfigsKey(userId),
        this.userExtensionInstallConfigsKey(userId, 'skill'),
        this.userExtensionInstallConfigKey(userId, 'skill', slug),
      );
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

  private creditAccountKey(userId: string): string {
    return `credit:account:${userId}`;
  }

  private creditLedgerKey(userId: string): string {
    return `credit:ledger:${userId}`;
  }

  private paymentOrderKey(orderId: string): string {
    return `payment-order:${orderId}`;
  }

  private runGrantKey(grantId: string): string {
    return `run-grant:${grantId}`;
  }

  private usageEventKey(eventId: string): string {
    return `usage-event:${eventId}`;
  }

  private runBillingSummaryKey(grantId: string): string {
    return `run-billing:${grantId}`;
  }

  private workspaceBackupKey(userId: string): string {
    return `workspace-backup:${userId}`;
  }

  private agentCatalogKey(): string {
    return 'agents:catalog';
  }

  private investmentExpertCatalogKey(): string {
    return 'agents:catalog:investment-experts';
  }

  private adminAgentCatalogKey(): string {
    return 'agents:catalog:admin';
  }

  private adminAgentCatalogCountKey(): string {
    return 'agents:catalog:admin:count';
  }

  private agentCatalogEntryKey(slug: string): string {
    return `agents:entry:${slug}`;
  }

  private skillCatalogKey(): string {
    return 'skills:catalog';
  }

  private skillCatalogCountKey(): string {
    return 'skills:catalog:count';
  }

  private skillCatalogPageKey(limit?: number, offset?: number): string {
    return `skills:catalog:page:${this.normalizePageSegment(limit)}:${this.normalizePageSegment(offset)}`;
  }

  private adminSkillCatalogKey(): string {
    return 'skills:catalog:admin';
  }

  private adminSkillCatalogCountKey(): string {
    return 'skills:catalog:admin:count';
  }

  private adminSkillCatalogPageKey(limit?: number, offset?: number): string {
    return `skills:catalog:admin:page:${this.normalizePageSegment(limit)}:${this.normalizePageSegment(offset)}`;
  }

  private skillCatalogEntryKey(slug: string): string {
    return `skills:entry:${slug}`;
  }

  private mcpCatalogKey(): string {
    return 'mcp:catalog';
  }

  private mcpCatalogCountKey(): string {
    return 'mcp:catalog:count';
  }

  private mcpCatalogPageKey(limit?: number, offset?: number): string {
    return `mcp:catalog:page:${this.normalizePageSegment(limit)}:${this.normalizePageSegment(offset)}`;
  }

  private mcpCatalogEntryKey(mcpKey: string): string {
    return `mcp:entry:${mcpKey}`;
  }

  private userSkillLibraryKey(userId: string): string {
    return `skills:library:${userId}`;
  }

  private userMcpLibraryKey(userId: string): string {
    return `mcp:library:${userId}`;
  }

  private userExtensionInstallConfigsKey(
    userId: string,
    extensionType?: ExtensionInstallTarget,
  ): string {
    return extensionType ? `extension-configs:${userId}:${extensionType}` : `extension-configs:${userId}:all`;
  }

  private userExtensionInstallConfigKey(
    userId: string,
    extensionType: ExtensionInstallTarget,
    extensionKey: string,
  ): string {
    return `extension-config:${userId}:${extensionType}:${extensionKey}`;
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

  private normalizePageSegment(value?: number): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'default';
    }
    return String(Math.max(0, Math.floor(value)));
  }
}
