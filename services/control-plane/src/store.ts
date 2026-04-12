import { randomUUID } from 'node:crypto';
import { toCanonicalSessionKey } from '@iclaw/shared';

import {config} from './config.ts';
import {
  createDefaultAgentCatalogEntries,
  createDefaultCloudSkillCatalogEntries,
} from './catalog-defaults.ts';
import {
  DEFAULT_PLATFORM_RECHARGE_PACKAGE_SEEDS,
  type ResolvedRechargePackageRecord,
} from './recharge-packages.ts';
import {
  resolveRechargePaymentMethods,
  type ResolvedRechargePaymentMethodRecord,
} from './recharge-payment-methods.ts';
import type {
  AdminPaymentOrderDetailRecord,
  AdminPaymentOrderSummaryRecord,
  AgentCatalogEntryRecord,
  CreateDesktopActionApprovalGrantInput,
  CreateDesktopActionAuditEventInput,
  CreateDesktopDiagnosticUploadInput,
  CreateDesktopFaultReportInput,
  CreateClientMetricEventInput,
  CreateClientCrashEventInput,
  CreatePaymentOrderInput,
  CreateUserInput,
  CreditAccountRecord,
  CreditLedgerRecord,
  DesktopActionApprovalGrantRecord,
  DesktopActionAuditEventRecord,
  DesktopActionPolicyRuleRecord,
  DesktopDiagnosticUploadRecord,
  DesktopFaultReportRecord,
  ClientMetricEventRecord,
  ClientCrashEventRecord,
  ExtensionInstallTarget,
  ImportUserPrivateSkillInput,
  InstallAgentInput,
  InstallMcpInput,
  InstallSkillInput,
  MarketFundRecord,
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
  PaymentWebhookEventRecord,
  PaymentWebhookInput,
  RunBillingSummaryRecord,
  RunGrantRecord,
  PersistedUsageEventInput,
  SessionRecord,
  SessionTokenPair,
  SkillCatalogEntryRecord,
  SkillSyncRunRecord,
  SkillSyncSourceRecord,
  UpsertAgentCatalogEntryInput,
  UpsertAdminPaymentProviderBindingInput,
  UpsertAdminPaymentProviderProfileInput,
  UpsertDesktopActionPolicyRuleInput,
  UpsertMcpCatalogEntryInput,
  UpsertSkillCatalogEntryInput,
  UpsertSkillSyncSourceInput,
  UpsertUserExtensionInstallConfigInput,
  UsageEventResult,
  UserAgentLibraryRecord,
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
import { DEFAULT_CLAWHUB_SYNC_SOURCE } from './skill-sync-defaults.ts';
import {startOfNextShanghaiDayIso} from './time.ts';

function normalizeUsernameLookup(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
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

function resolveCreditLedgerSortTimestamp(item: CreditLedgerRecord): number {
  if (typeof item.assistantTimestamp === 'number' && Number.isFinite(item.assistantTimestamp)) {
    return item.assistantTimestamp;
  }
  return Date.parse(item.createdAt) || 0;
}

export interface ControlPlaneStore {
  readonly storageLabel: string;
  getSystemState(stateKey: string): Promise<Record<string, unknown> | null>;
  setSystemState(stateKey: string, stateValue: Record<string, unknown>): Promise<void>;
  deleteSystemState(stateKey: string): Promise<void>;
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
  createPaymentOrder(
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
  ): Promise<PaymentOrderRecord>;
  getPaymentOrderById(userId: string, orderId: string): Promise<PaymentOrderRecord | null>;
  resolveRechargePackage(packageId: string, appName?: string | null): Promise<ResolvedRechargePackageRecord | null>;
  resolveRechargePaymentMethods(appName?: string | null): Promise<ResolvedRechargePaymentMethodRecord[]>;
  listPaymentOrdersAdmin(input?: {
    limit?: number | null;
    status?: string | null;
    provider?: string | null;
    appName?: string | null;
    query?: string | null;
  }): Promise<AdminPaymentOrderSummaryRecord[]>;
  listPaymentProviderProfiles(input?: {
    provider?: PaymentProvider | null;
    scopeType?: PaymentProviderScopeType | null;
    scopeKey?: string | null;
  }): Promise<PaymentProviderProfileRecord[]>;
  getPaymentProviderProfileById(id: string): Promise<PaymentProviderProfileRecord | null>;
  getPaymentProviderProfileByScope(
    provider: PaymentProvider,
    scopeType: PaymentProviderScopeType,
    scopeKey: string,
  ): Promise<PaymentProviderProfileRecord | null>;
  upsertPaymentProviderProfile(
    input: Required<UpsertAdminPaymentProviderProfileInput> & {
      provider: PaymentProvider;
      scope_type: PaymentProviderScopeType;
      channel_kind: PaymentProviderChannelKind;
      configured_secret_keys: string[];
      secret_payload_encrypted?: string | null;
      config_values: Record<string, unknown>;
    },
  ): Promise<PaymentProviderProfileRecord>;
  listPaymentProviderBindings(provider?: PaymentProvider | null): Promise<PaymentProviderBindingRecord[]>;
  getPaymentProviderBinding(appName: string, provider: PaymentProvider): Promise<PaymentProviderBindingRecord | null>;
  upsertPaymentProviderBinding(
    appName: string,
    input: Required<UpsertAdminPaymentProviderBindingInput> & {
      provider: PaymentProvider;
      mode: PaymentProviderBindingMode;
      active_profile_id?: string | null;
    },
  ): Promise<PaymentProviderBindingRecord>;
  getPaymentOrderAdmin(orderId: string): Promise<AdminPaymentOrderDetailRecord | null>;
  markPaymentOrderPaidAdmin(input: {
    orderId: string;
    operatorUserId: string;
    operatorDisplayName: string;
    providerOrderId?: string | null;
    paidAt?: string | null;
    note?: string | null;
  }): Promise<AdminPaymentOrderDetailRecord | null>;
  refundPaymentOrderAdmin(input: {
    orderId: string;
    operatorUserId: string;
    operatorDisplayName: string;
    note?: string | null;
  }): Promise<AdminPaymentOrderDetailRecord | null>;
  listDesktopActionPolicyRules(input?: {
    scope?: string | null;
    capability?: string | null;
    riskLevel?: string | null;
    enabled?: boolean | null;
    query?: string | null;
    limit?: number | null;
  }): Promise<DesktopActionPolicyRuleRecord[]>;
  getDesktopActionPolicyRuleById(id: string): Promise<DesktopActionPolicyRuleRecord | null>;
  upsertDesktopActionPolicyRule(input: Required<UpsertDesktopActionPolicyRuleInput> & {id: string}): Promise<DesktopActionPolicyRuleRecord>;
  listDesktopActionApprovalGrants(input?: {
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    capability?: string | null;
    activeOnly?: boolean | null;
    limit?: number | null;
  }): Promise<DesktopActionApprovalGrantRecord[]>;
  createDesktopActionApprovalGrant(input: Required<CreateDesktopActionApprovalGrantInput> & {id: string; created_at: string}): Promise<DesktopActionApprovalGrantRecord>;
  revokeDesktopActionApprovalGrant(id: string, revokedAt: string): Promise<DesktopActionApprovalGrantRecord | null>;
  listDesktopActionAuditEvents(input?: {
    intentId?: string | null;
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    capability?: string | null;
    riskLevel?: string | null;
    decision?: string | null;
    limit?: number | null;
  }): Promise<DesktopActionAuditEventRecord[]>;
  createDesktopActionAuditEvents(
    input: Array<Required<CreateDesktopActionAuditEventInput> & {id: string; created_at: string}>,
  ): Promise<DesktopActionAuditEventRecord[]>;
  listDesktopDiagnosticUploads(input?: {
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    sourceType?: string | null;
    limit?: number | null;
  }): Promise<DesktopDiagnosticUploadRecord[]>;
  createDesktopDiagnosticUpload(
    input: Required<CreateDesktopDiagnosticUploadInput> & {id: string; created_at: string},
  ): Promise<DesktopDiagnosticUploadRecord>;
  listDesktopFaultReports(input?: {
    reportId?: string | null;
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    platform?: string | null;
    entry?: string | null;
    accountState?: string | null;
    appVersion?: string | null;
    limit?: number | null;
  }): Promise<DesktopFaultReportRecord[]>;
  getDesktopFaultReportById(id: string): Promise<DesktopFaultReportRecord | null>;
  getDesktopFaultReportByReportId(reportId: string): Promise<DesktopFaultReportRecord | null>;
  createDesktopFaultReport(
    input: Required<CreateDesktopFaultReportInput> & {id: string; created_at: string},
  ): Promise<DesktopFaultReportRecord>;
  listClientMetricEvents(input?: {
    eventName?: string | null;
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    brandId?: string | null;
    appVersion?: string | null;
    platform?: string | null;
    result?: string | null;
    limit?: number | null;
  }): Promise<ClientMetricEventRecord[]>;
  createClientMetricEvents(
    input: Array<Required<CreateClientMetricEventInput> & {id: string; created_at: string}>,
  ): Promise<ClientMetricEventRecord[]>;
  listClientCrashEvents(input?: {
    crashType?: string | null;
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    brandId?: string | null;
    appVersion?: string | null;
    platform?: string | null;
    limit?: number | null;
  }): Promise<ClientCrashEventRecord[]>;
  createClientCrashEvent(
    input: Required<CreateClientCrashEventInput> & {id: string; created_at: string},
  ): Promise<ClientCrashEventRecord>;
  applyPaymentWebhook(provider: PaymentProvider, input: Required<PaymentWebhookInput>): Promise<PaymentOrderRecord | null>;
  getRunGrantById(grantId: string): Promise<RunGrantRecord | null>;
  getRunBillingSummary(grantId: string): Promise<RunBillingSummaryRecord | null>;
  listRunBillingSummariesBySession(
    userId: string,
    sessionKey: string,
    limit?: number | null,
  ): Promise<RunBillingSummaryRecord[]>;
  createRunGrant(input: {
    userId: string;
    sessionKey: string;
    eventId?: string | null;
    client: string;
    nonce: string;
    maxInputTokens: number;
    maxOutputTokens: number;
    creditLimit: number;
    expiresAt: string;
    signature: string;
  }): Promise<RunGrantRecord>;
  recordUsageEvent(userId: string, input: PersistedUsageEventInput): Promise<UsageEventResult>;
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
  listMarketStocks(input?: {
    market?: string | null;
    exchange?: string | null;
    search?: string | null;
    tag?: string | null;
    sort?: string | null;
    limit?: number | null;
    offset?: number | null;
  }): Promise<{items: MarketStockRecord[]; total: number}>;
  getMarketStock(stockId: string): Promise<MarketStockRecord | null>;
  listMarketFunds(input?: {
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
  }): Promise<{items: MarketFundRecord[]; total: number}>;
  getMarketFund(fundId: string): Promise<MarketFundRecord | null>;
  listAgentCatalog(): Promise<AgentCatalogEntryRecord[]>;
  listAgentCatalogAdmin(): Promise<AgentCatalogEntryRecord[]>;
  countAgentCatalogAdmin(): Promise<number>;
  getAgentCatalogEntry(slug: string): Promise<AgentCatalogEntryRecord | null>;
  upsertAgentCatalogEntry(input: Required<UpsertAgentCatalogEntryInput>): Promise<AgentCatalogEntryRecord>;
  deleteAgentCatalogEntry(slug: string): Promise<boolean>;
  listSkillCatalog(
    limit?: number,
    offset?: number,
    filters?: {tagKeywords?: string[] | null; extraSkillSlugs?: string[] | null},
  ): Promise<SkillCatalogEntryRecord[]>;
  countSkillCatalog(filters?: {tagKeywords?: string[] | null; extraSkillSlugs?: string[] | null}): Promise<number>;
  listSkillCatalogBySlugs(
    slugs: string[],
    limit?: number,
    offset?: number,
    filters?: {tagKeywords?: string[] | null},
  ): Promise<SkillCatalogEntryRecord[]>;
  countSkillCatalogBySlugs(slugs: string[], filters?: {tagKeywords?: string[] | null}): Promise<number>;
  listSkillCatalogAdmin(limit?: number, offset?: number, query?: string): Promise<SkillCatalogEntryRecord[]>;
  countSkillCatalogAdmin(query?: string): Promise<number>;
  getSkillCatalogEntry(slug: string): Promise<SkillCatalogEntryRecord | null>;
  upsertSkillCatalogEntry(input: Required<UpsertSkillCatalogEntryInput>): Promise<SkillCatalogEntryRecord>;
  deleteSkillCatalogEntry(slug: string): Promise<boolean>;
  listMcpCatalog(limit?: number, offset?: number): Promise<McpCatalogEntryRecord[]>;
  listMcpCatalogAdmin(): Promise<McpCatalogEntryRecord[]>;
  countMcpCatalog(): Promise<number>;
  getMcpCatalogEntry(mcpKey: string): Promise<McpCatalogEntryRecord | null>;
  upsertMcpCatalogEntry(input: Required<UpsertMcpCatalogEntryInput>): Promise<McpCatalogEntryRecord>;
  deleteMcpCatalogEntry(mcpKey: string): Promise<boolean>;
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
  listUserExtensionInstallConfigs(
    userId: string,
    extensionType?: ExtensionInstallTarget,
  ): Promise<UserExtensionInstallConfigRecord[]>;
  getUserExtensionInstallConfig(
    userId: string,
    extensionType: ExtensionInstallTarget,
    extensionKey: string,
  ): Promise<UserExtensionInstallConfigRecord | null>;
  upsertUserExtensionInstallConfig(
    userId: string,
    input: Required<UpsertUserExtensionInstallConfigInput> & {
      schema_version: number | null;
      status: UserExtensionInstallConfigRecord['status'];
      configured_secret_keys: string[];
      secret_payload_encrypted?: string | null;
    },
  ): Promise<UserExtensionInstallConfigRecord>;
  removeUserExtensionInstallConfig(
    userId: string,
    extensionType: ExtensionInstallTarget,
    extensionKey: string,
  ): Promise<boolean>;
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
  private readonly paymentProviderProfilesById = new Map<string, PaymentProviderProfileRecord>();
  private readonly paymentProviderBindingsByKey = new Map<string, PaymentProviderBindingRecord>();
  private readonly desktopActionPolicyRulesById = new Map<string, DesktopActionPolicyRuleRecord>();
  private readonly desktopActionApprovalGrantsById = new Map<string, DesktopActionApprovalGrantRecord>();
  private readonly desktopActionAuditEventsById = new Map<string, DesktopActionAuditEventRecord>();
  private readonly desktopDiagnosticUploadsById = new Map<string, DesktopDiagnosticUploadRecord>();
  private readonly desktopFaultReportsById = new Map<string, DesktopFaultReportRecord>();
  private readonly clientMetricEventsById = new Map<string, ClientMetricEventRecord>();
  private readonly clientCrashEventsById = new Map<string, ClientCrashEventRecord>();
  private readonly paymentOrdersById = new Map<string, PaymentOrderRecord>();
  private readonly rechargePaymentMethodConfigsByApp = new Map<string, Record<string, unknown>>();
  private readonly systemStateByKey = new Map<string, Record<string, unknown>>();
  private readonly paymentWebhookEventsByOrderId = new Map<string, PaymentWebhookEventRecord[]>();
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
  private readonly userExtensionInstallConfigs = new Map<string, UserExtensionInstallConfigRecord>();

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

  async getSystemState(stateKey: string): Promise<Record<string, unknown> | null> {
    return this.systemStateByKey.get(stateKey) || null;
  }

  async setSystemState(stateKey: string, stateValue: Record<string, unknown>): Promise<void> {
    this.systemStateByKey.set(stateKey, {...stateValue});
  }

  async deleteSystemState(stateKey: string): Promise<void> {
    this.systemStateByKey.delete(stateKey);
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
    return [...(this.creditLedgerByUserId.get(userId) || [])].sort((left, right) => {
      const rightTimestamp = resolveCreditLedgerSortTimestamp(right);
      const leftTimestamp = resolveCreditLedgerSortTimestamp(left);
      if (rightTimestamp !== leftTimestamp) {
        return rightTimestamp - leftTimestamp;
      }
      return (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0);
    });
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
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const orderId = input.order_id?.trim() || randomUUID();
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
      paymentUrl: typeof input.payment_url === 'string' && input.payment_url.trim() ? input.payment_url.trim() : null,
      appName: input.app_name || null,
      appVersion: input.app_version || null,
      releaseChannel: input.release_channel || null,
      platform: input.platform || null,
      arch: input.arch || null,
      returnUrl: input.return_url || null,
      userAgent: input.user_agent || null,
      metadata: {
        app_name: input.app_name || null,
        app_version: input.app_version || null,
        release_channel: input.release_channel || null,
        platform: input.platform || null,
        arch: input.arch || null,
        return_url: input.return_url || null,
        user_agent: input.user_agent || null,
        ...((input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
          ? input.metadata
          : {}) as Record<string, unknown>),
      },
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

  async resolveRechargePackage(packageId: string, _appName?: string | null): Promise<ResolvedRechargePackageRecord | null> {
    const seed = DEFAULT_PLATFORM_RECHARGE_PACKAGE_SEEDS.find((item) => item.packageId === packageId) || null;
    if (!seed || seed.active === false) {
      return null;
    }
    return {
      packageId: seed.packageId,
      packageName: seed.packageName,
      credits: seed.credits,
      bonusCredits: seed.bonusCredits,
      amountCnyFen: seed.amountCnyFen,
      sortOrder: seed.sortOrder,
      recommended: seed.recommended,
      default: seed.default,
      metadata: {...seed.metadata},
      active: true,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      sourceLayer: 'platform_catalog',
      bindingConfig: {},
    };
  }

  async resolveRechargePaymentMethods(appName?: string | null): Promise<ResolvedRechargePaymentMethodRecord[]> {
    const normalizedAppName = (appName || '').trim();
    return resolveRechargePaymentMethods(
      normalizedAppName ? this.rechargePaymentMethodConfigsByApp.get(normalizedAppName) || null : null,
    );
  }

  setRechargePaymentMethodsConfig(appName: string, config: Record<string, unknown> | null | undefined): void {
    const normalizedAppName = appName.trim();
    if (!normalizedAppName) {
      return;
    }
    if (!config) {
      this.rechargePaymentMethodConfigsByApp.delete(normalizedAppName);
      return;
    }
    this.rechargePaymentMethodConfigsByApp.set(normalizedAppName, JSON.parse(JSON.stringify(config)) as Record<string, unknown>);
  }

  async listPaymentOrdersAdmin(input?: {
    limit?: number | null;
    status?: string | null;
    provider?: string | null;
    appName?: string | null;
    query?: string | null;
  }): Promise<AdminPaymentOrderSummaryRecord[]> {
    const status = (input?.status || '').trim().toLowerCase();
    const provider = (input?.provider || '').trim().toLowerCase();
    const appName = (input?.appName || '').trim().toLowerCase();
    const query = (input?.query || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(500, Number(input?.limit || 200) || 200));
    const items = Array.from(this.paymentOrdersById.values())
      .map((order) => expirePaymentOrderIfNeeded(order))
      .filter((order) => {
        if (status && order.status !== status) return false;
        if (provider && order.provider !== provider) return false;
        if (appName && (order.appName || '').trim().toLowerCase() !== appName) return false;
        if (!query) return true;
        const user = this.users.get(order.userId);
        const haystack = [
          order.id,
          order.packageId,
          order.packageName,
          order.provider,
          order.providerOrderId || '',
          order.appName || '',
          order.userId,
          user?.username || '',
          user?.email || '',
          user?.displayName || '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, limit)
      .map((order) => {
        const user = this.users.get(order.userId);
        const webhookEvents = this.paymentWebhookEventsByOrderId.get(order.id) || [];
        return {
          ...order,
          username: user?.username || order.userId,
          userEmail: user?.email || '',
          userDisplayName: user?.displayName || user?.username || order.userId,
          webhookEventCount: webhookEvents.length,
          latestWebhookAt: webhookEvents[0]?.createdAt || null,
        };
      });
    return items;
  }

  async listPaymentProviderProfiles(input?: {
    provider?: PaymentProvider | null;
    scopeType?: PaymentProviderScopeType | null;
    scopeKey?: string | null;
  }): Promise<PaymentProviderProfileRecord[]> {
    const provider = (input?.provider || '').trim().toLowerCase();
    const scopeType = (input?.scopeType || '').trim().toLowerCase();
    const scopeKey = (input?.scopeKey || '').trim();
    return Array.from(this.paymentProviderProfilesById.values())
      .filter((item) => {
        if (provider && item.provider !== provider) return false;
        if (scopeType && item.scopeType !== scopeType) return false;
        if (scopeKey && item.scopeKey !== scopeKey) return false;
        return true;
      })
      .sort((left, right) =>
        `${left.provider}:${left.scopeType}:${left.scopeKey}:${left.displayName}`.localeCompare(
          `${right.provider}:${right.scopeType}:${right.scopeKey}:${right.displayName}`,
          'zh-CN',
        ),
      );
  }

  async getPaymentProviderProfileById(id: string): Promise<PaymentProviderProfileRecord | null> {
    return this.paymentProviderProfilesById.get(id) || null;
  }

  async getPaymentProviderProfileByScope(
    provider: PaymentProvider,
    scopeType: PaymentProviderScopeType,
    scopeKey: string,
  ): Promise<PaymentProviderProfileRecord | null> {
    return (
      Array.from(this.paymentProviderProfilesById.values()).find(
        (item) => item.provider === provider && item.scopeType === scopeType && item.scopeKey === scopeKey,
      ) || null
    );
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
    const now = new Date().toISOString();
    const existing =
      (input.id ? this.paymentProviderProfilesById.get(input.id) : null) ||
      (await this.getPaymentProviderProfileByScope(input.provider, input.scope_type, input.scope_key));
    const record: PaymentProviderProfileRecord = {
      id: existing?.id || input.id || randomUUID(),
      provider: input.provider,
      scopeType: input.scope_type,
      scopeKey: input.scope_key,
      channelKind: input.channel_kind,
      displayName: input.display_name,
      enabled: input.enabled !== false,
      config: input.config_values,
      configuredSecretKeys: input.configured_secret_keys,
      secretPayloadEncrypted: input.secret_payload_encrypted ?? existing?.secretPayloadEncrypted ?? null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.paymentProviderProfilesById.set(record.id, record);
    return record;
  }

  async listPaymentProviderBindings(provider?: PaymentProvider | null): Promise<PaymentProviderBindingRecord[]> {
    const normalizedProvider = (provider || '').trim().toLowerCase();
    return Array.from(this.paymentProviderBindingsByKey.values())
      .filter((item) => !normalizedProvider || item.provider === normalizedProvider)
      .sort((left, right) => left.appName.localeCompare(right.appName, 'zh-CN'));
  }

  async getPaymentProviderBinding(appName: string, provider: PaymentProvider): Promise<PaymentProviderBindingRecord | null> {
    return this.paymentProviderBindingsByKey.get(`${appName}:${provider}`) || null;
  }

  async upsertPaymentProviderBinding(
    appName: string,
    input: Required<UpsertAdminPaymentProviderBindingInput> & {
      provider: PaymentProvider;
      mode: PaymentProviderBindingMode;
      active_profile_id?: string | null;
    },
  ): Promise<PaymentProviderBindingRecord> {
    const now = new Date().toISOString();
    const key = `${appName}:${input.provider}`;
    const existing = this.paymentProviderBindingsByKey.get(key);
    const record: PaymentProviderBindingRecord = {
      appName,
      provider: input.provider,
      mode: input.mode,
      activeProfileId: input.active_profile_id || null,
      updatedAt: existing?.updatedAt || now,
    };
    record.updatedAt = now;
    this.paymentProviderBindingsByKey.set(key, record);
    return record;
  }

  async getPaymentOrderAdmin(orderId: string): Promise<AdminPaymentOrderDetailRecord | null> {
    const order = this.paymentOrdersById.get(orderId) || null;
    if (!order) {
      return null;
    }
    const normalized = expirePaymentOrderIfNeeded(order);
    if (normalized !== order) {
      this.paymentOrdersById.set(order.id, normalized);
    }
    const user = this.users.get(normalized.userId);
    const webhookEvents = (this.paymentWebhookEventsByOrderId.get(normalized.id) || []).slice();
    return {
      ...normalized,
      username: user?.username || normalized.userId,
      userEmail: user?.email || '',
      userDisplayName: user?.displayName || user?.username || normalized.userId,
      webhookEventCount: webhookEvents.length,
      latestWebhookAt: webhookEvents[0]?.createdAt || null,
      webhookEvents,
    };
  }

  async markPaymentOrderPaidAdmin(input: {
    orderId: string;
    operatorUserId: string;
    operatorDisplayName: string;
    providerOrderId?: string | null;
    paidAt?: string | null;
    note?: string | null;
  }): Promise<AdminPaymentOrderDetailRecord | null> {
    const order = this.paymentOrdersById.get(input.orderId) || null;
    if (!order) {
      return null;
    }
    if (order.status !== 'paid') {
      const paidAt = input.paidAt?.trim() || new Date().toISOString();
      const paidOrder: PaymentOrderRecord = {
        ...order,
        status: 'paid',
        providerOrderId: input.providerOrderId?.trim() || order.providerOrderId,
        paidAt,
        updatedAt: new Date().toISOString(),
      };
      this.paymentOrdersById.set(order.id, paidOrder);
      const account = await this.getCreditAccount(order.userId);
      const creditTotal = paidOrder.credits + paidOrder.bonusCredits;
      const nextTopup = account.topupBalance + creditTotal;
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
        amount: creditTotal,
        balanceAfter: nextTopup,
        referenceType: 'topup_order',
        referenceId: order.id,
        eventType: 'topup',
        delta: creditTotal,
        createdAt: paidOrder.updatedAt,
      });
      this.creditLedgerByUserId.set(order.userId, ledger);
    }
    const events = this.paymentWebhookEventsByOrderId.get(order.id) || [];
    events.unshift({
      id: randomUUID(),
      provider: order.provider,
      eventId: `admin_manual_paid_${Date.now()}`,
      eventType: 'admin_manual_paid',
      orderId: order.id,
      payload: {
        source: 'admin_manual',
        action: 'mark_paid',
        operator_user_id: input.operatorUserId,
        operator_display_name: input.operatorDisplayName,
        provider_order_id: input.providerOrderId || null,
        paid_at: input.paidAt || null,
        note: input.note || null,
      },
      signature: null,
      processedAt: new Date().toISOString(),
      processStatus: 'processed',
      createdAt: new Date().toISOString(),
    });
    this.paymentWebhookEventsByOrderId.set(order.id, events);
    return this.getPaymentOrderAdmin(order.id);
  }

  async refundPaymentOrderAdmin(input: {
    orderId: string;
    operatorUserId: string;
    operatorDisplayName: string;
    note?: string | null;
  }): Promise<AdminPaymentOrderDetailRecord | null> {
    const order = this.paymentOrdersById.get(input.orderId) || null;
    if (!order) {
      return null;
    }
    if (order.status === 'refunded') {
      return this.getPaymentOrderAdmin(order.id);
    }
    if (order.status !== 'paid') {
      const error = new Error('payment order is not paid');
      (error).name = 'INVALID_PAYMENT_ORDER_STATUS';
      throw error;
    }
    const totalCredits = order.credits + order.bonusCredits;
    const account = await this.getCreditAccount(order.userId);
    if (account.topupBalance < totalCredits) {
      const error = new Error('insufficient topup balance for refund');
      (error).name = 'INSUFFICIENT_TOPUP_BALANCE_FOR_REFUND';
      throw error;
    }
    const refundedOrder: PaymentOrderRecord = {
      ...order,
      status: 'refunded',
      updatedAt: new Date().toISOString(),
    };
    this.paymentOrdersById.set(order.id, refundedOrder);
    const nextTopup = account.topupBalance - totalCredits;
    const nextAccount: CreditAccountRecord = {
      ...account,
      topupBalance: nextTopup,
      totalAvailableBalance: account.dailyFreeBalance + nextTopup,
      updatedAt: refundedOrder.updatedAt,
    };
    this.creditAccountsByUserId.set(order.userId, nextAccount);
    const ledger = this.creditLedgerByUserId.get(order.userId) || [];
    ledger.unshift({
      id: randomUUID(),
      userId: order.userId,
      bucket: 'topup',
      direction: 'refund',
      amount: totalCredits,
      balanceAfter: nextTopup,
      referenceType: 'topup_order',
      referenceId: order.id,
      eventType: 'refund',
      delta: -totalCredits,
      createdAt: refundedOrder.updatedAt,
    });
    this.creditLedgerByUserId.set(order.userId, ledger);
    const events = this.paymentWebhookEventsByOrderId.get(order.id) || [];
    events.unshift({
      id: randomUUID(),
      provider: order.provider,
      eventId: `admin_manual_refund_${Date.now()}`,
      eventType: 'admin_manual_refund',
      orderId: order.id,
      payload: {
        source: 'admin_manual',
        action: 'refund',
        operator_user_id: input.operatorUserId,
        operator_display_name: input.operatorDisplayName,
        refunded_credits: totalCredits,
        note: input.note || null,
      },
      signature: null,
      processedAt: new Date().toISOString(),
      processStatus: 'processed',
      createdAt: new Date().toISOString(),
    });
    this.paymentWebhookEventsByOrderId.set(order.id, events);
    return this.getPaymentOrderAdmin(order.id);
  }

  async listDesktopActionPolicyRules(input?: {
    scope?: string | null;
    capability?: string | null;
    riskLevel?: string | null;
    enabled?: boolean | null;
    query?: string | null;
    limit?: number | null;
  }): Promise<DesktopActionPolicyRuleRecord[]> {
    const scope = String(input?.scope || '').trim().toLowerCase();
    const capability = String(input?.capability || '').trim().toLowerCase();
    const riskLevel = String(input?.riskLevel || '').trim().toLowerCase();
    const query = String(input?.query || '').trim().toLowerCase();
    const limit = typeof input?.limit === 'number' && Number.isFinite(input.limit) ? Math.max(1, Math.floor(input.limit)) : 200;
    return Array.from(this.desktopActionPolicyRulesById.values())
      .filter((item) => (!scope ? true : item.scope === scope))
      .filter((item) => (!capability ? true : item.capability.toLowerCase() === capability))
      .filter((item) => (!riskLevel ? true : item.riskLevel === riskLevel))
      .filter((item) => (typeof input?.enabled === 'boolean' ? item.enabled === input.enabled : true))
      .filter((item) =>
        !query
          ? true
          : item.name.toLowerCase().includes(query) ||
            item.capability.toLowerCase().includes(query) ||
            (item.scopeId || '').toLowerCase().includes(query),
      )
      .sort((left, right) => left.priority - right.priority || Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit);
  }

  async getDesktopActionPolicyRuleById(id: string): Promise<DesktopActionPolicyRuleRecord | null> {
    return this.desktopActionPolicyRulesById.get(id) || null;
  }

  async upsertDesktopActionPolicyRule(
    input: Required<UpsertDesktopActionPolicyRuleInput> & {id: string},
  ): Promise<DesktopActionPolicyRuleRecord> {
    const existing = this.desktopActionPolicyRulesById.get(input.id);
    const record: DesktopActionPolicyRuleRecord = {
      id: input.id,
      scope: input.scope || existing?.scope || 'platform',
      scopeId: input.scope_id || null,
      name: input.name || existing?.name || '',
      effect: input.effect || existing?.effect || 'allow_with_approval',
      capability: input.capability || existing?.capability || '',
      riskLevel: input.risk_level || existing?.riskLevel || 'medium',
      officialOnly: input.official_only ?? existing?.officialOnly ?? false,
      publisherIds: [...(input.publisher_ids || existing?.publisherIds || [])],
      packageDigests: [...(input.package_digests || existing?.packageDigests || [])],
      skillSlugs: [...(input.skill_slugs || existing?.skillSlugs || [])],
      workflowIds: [...(input.workflow_ids || existing?.workflowIds || [])],
      executorTypes: [...(input.executor_types || existing?.executorTypes || [])],
      executorTemplateIds: [...(input.executor_template_ids || existing?.executorTemplateIds || [])],
      canonicalPathPrefixes: [...(input.canonical_path_prefixes || existing?.canonicalPathPrefixes || [])],
      networkDestinations: [...(input.network_destinations || existing?.networkDestinations || [])],
      accessModes: [...(input.access_modes || existing?.accessModes || [])],
      allowElevation: input.allow_elevation ?? existing?.allowElevation ?? false,
      allowNetworkEgress: input.allow_network_egress ?? existing?.allowNetworkEgress ?? false,
      grantScope: input.grant_scope || existing?.grantScope || 'once',
      maxGrantScope: input.max_grant_scope || existing?.maxGrantScope || 'once',
      ttlSeconds: input.ttl_seconds ?? existing?.ttlSeconds ?? null,
      enabled: input.enabled ?? existing?.enabled ?? true,
      priority: input.priority ?? existing?.priority ?? 100,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.desktopActionPolicyRulesById.set(record.id, record);
    return record;
  }

  async listDesktopActionApprovalGrants(input?: {
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    capability?: string | null;
    activeOnly?: boolean | null;
    limit?: number | null;
  }): Promise<DesktopActionApprovalGrantRecord[]> {
    const now = Date.now();
    const limit = typeof input?.limit === 'number' && Number.isFinite(input.limit) ? Math.max(1, Math.floor(input.limit)) : 200;
    return Array.from(this.desktopActionApprovalGrantsById.values())
      .filter((item) => (!input?.userId ? true : item.userId === input.userId))
      .filter((item) => (!input?.deviceId ? true : item.deviceId === input.deviceId))
      .filter((item) => (!input?.appName ? true : item.appName === input.appName))
      .filter((item) => (!input?.capability ? true : item.capability === input.capability))
      .filter((item) => {
        if (!input?.activeOnly) {
          return true;
        }
        if (item.revokedAt) {
          return false;
        }
        if (item.expiresAt && Date.parse(item.expiresAt) <= now) {
          return false;
        }
        return true;
      })
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, limit);
  }

  async createDesktopActionApprovalGrant(
    input: Required<CreateDesktopActionApprovalGrantInput> & {id: string; created_at: string},
  ): Promise<DesktopActionApprovalGrantRecord> {
    const record: DesktopActionApprovalGrantRecord = {
      id: input.id,
      userId: input.user_id || '',
      deviceId: input.device_id || '',
      appName: input.app_name || '',
      intentFingerprint: input.intent_fingerprint || '',
      approvedPlanHash: input.approved_plan_hash || '',
      capability: input.capability || '',
      riskLevel: input.risk_level || 'medium',
      accessModes: [...(input.access_modes || [])],
      normalizedResources: [...(input.normalized_resources || [])],
      networkDestinations: [...(input.network_destinations || [])],
      executorType: input.executor_type || 'template',
      executorTemplateId: input.executor_template_id || null,
      publisherId: input.publisher_id || null,
      packageDigest: input.package_digest || null,
      scope: input.scope || 'once',
      taskId: input.task_id || null,
      sessionKey: input.session_key || null,
      expiresAt: input.expires_at || null,
      revokedAt: null,
      createdAt: input.created_at,
    };
    this.desktopActionApprovalGrantsById.set(record.id, record);
    return record;
  }

  async revokeDesktopActionApprovalGrant(id: string, revokedAt: string): Promise<DesktopActionApprovalGrantRecord | null> {
    const current = this.desktopActionApprovalGrantsById.get(id);
    if (!current) {
      return null;
    }
    const next = {...current, revokedAt};
    this.desktopActionApprovalGrantsById.set(id, next);
    return next;
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
    const limit = typeof input?.limit === 'number' && Number.isFinite(input.limit) ? Math.max(1, Math.floor(input.limit)) : 200;
    return Array.from(this.desktopActionAuditEventsById.values())
      .filter((item) => (!input?.intentId ? true : item.intentId === input.intentId))
      .filter((item) => (!input?.userId ? true : item.userId === input.userId))
      .filter((item) => (!input?.deviceId ? true : item.deviceId === input.deviceId))
      .filter((item) => (!input?.appName ? true : item.appName === input.appName))
      .filter((item) => (!input?.capability ? true : item.capability === input.capability))
      .filter((item) => (!input?.riskLevel ? true : item.riskLevel === input.riskLevel))
      .filter((item) => (!input?.decision ? true : item.decision === input.decision))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, limit);
  }

  async createDesktopActionAuditEvents(
    input: Array<Required<CreateDesktopActionAuditEventInput> & {id: string; created_at: string}>,
  ): Promise<DesktopActionAuditEventRecord[]> {
    const created: DesktopActionAuditEventRecord[] = input.map((item) => {
      const record: DesktopActionAuditEventRecord = {
        id: item.id,
        intentId: item.intent_id || '',
        traceId: item.trace_id || '',
        userId: item.user_id || null,
        deviceId: item.device_id || '',
        appName: item.app_name || '',
        agentId: item.agent_id || null,
        skillSlug: item.skill_slug || null,
        workflowId: item.workflow_id || null,
        capability: item.capability || '',
        riskLevel: item.risk_level || 'medium',
        requiresElevation: item.requires_elevation ?? false,
        decision: item.decision || 'pending',
        stage: item.stage || 'intent_created',
        summary: item.summary || '',
        reason: item.reason || null,
        resources: item.resources || [],
        matchedPolicyRuleId: item.matched_policy_rule_id || null,
        approvedPlanHash: item.approved_plan_hash || null,
        executedPlanHash: item.executed_plan_hash || null,
        commandSnapshotRedacted: item.command_snapshot_redacted || null,
        resultCode: item.result_code || null,
        resultSummary: item.result_summary || null,
        durationMs: item.duration_ms,
        createdAt: item.created_at,
      };
      this.desktopActionAuditEventsById.set(record.id, record);
      return record;
    });
    return created;
  }

  async listDesktopDiagnosticUploads(input?: {
    userId?: string | null;
    deviceId?: string | null;
    appName?: string | null;
    sourceType?: string | null;
    limit?: number | null;
  }): Promise<DesktopDiagnosticUploadRecord[]> {
    const limit = typeof input?.limit === 'number' && Number.isFinite(input.limit) ? Math.max(1, Math.floor(input.limit)) : 200;
    return Array.from(this.desktopDiagnosticUploadsById.values())
      .filter((item) => (!input?.userId ? true : item.userId === input.userId))
      .filter((item) => (!input?.deviceId ? true : item.deviceId === input.deviceId))
      .filter((item) => (!input?.appName ? true : item.appName === input.appName))
      .filter((item) => (!input?.sourceType ? true : item.sourceType === input.sourceType))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, limit);
  }

  async createDesktopDiagnosticUpload(
    input: Required<CreateDesktopDiagnosticUploadInput> & {id: string; created_at: string},
  ): Promise<DesktopDiagnosticUploadRecord> {
    const record: DesktopDiagnosticUploadRecord = {
      id: input.id,
      userId: input.user_id || null,
      deviceId: input.device_id || '',
      appName: input.app_name || '',
      uploadBucket: input.upload_bucket || '',
      uploadKey: input.upload_key || '',
      fileName: input.file_name || '',
      fileSizeBytes: input.file_size_bytes ?? 0,
      sha256: input.sha256 || null,
      sourceType: input.source_type || 'manual',
      containsCustomerLogs: input.contains_customer_logs ?? true,
      sensitivityLevel: input.sensitivity_level || 'customer',
      linkedIntentId: input.linked_intent_id || null,
      createdAt: input.created_at,
    };
    this.desktopDiagnosticUploadsById.set(record.id, record);
    return record;
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
    const items = Array.from(this.desktopFaultReportsById.values())
      .filter((item) => (!input?.reportId ? true : item.reportId === input.reportId))
      .filter((item) => (!input?.userId ? true : item.userId === input.userId))
      .filter((item) => (!input?.deviceId ? true : item.deviceId === input.deviceId))
      .filter((item) => (!input?.appName ? true : item.appName === input.appName))
      .filter((item) => (!input?.platform ? true : item.platform === input.platform))
      .filter((item) => (!input?.entry ? true : item.entry === input.entry))
      .filter((item) => (!input?.accountState ? true : item.accountState === input.accountState))
      .filter((item) => (!input?.appVersion ? true : item.appVersion === input.appVersion))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const limit = input?.limit && input.limit > 0 ? input.limit : items.length;
    return items.slice(0, limit);
  }

  async getDesktopFaultReportById(id: string): Promise<DesktopFaultReportRecord | null> {
    return this.desktopFaultReportsById.get(id) || null;
  }

  async getDesktopFaultReportByReportId(reportId: string): Promise<DesktopFaultReportRecord | null> {
    for (const item of this.desktopFaultReportsById.values()) {
      if (item.reportId === reportId) {
        return item;
      }
    }
    return null;
  }

  async createDesktopFaultReport(
    input: Required<CreateDesktopFaultReportInput> & {id: string; created_at: string},
  ): Promise<DesktopFaultReportRecord> {
    const record: DesktopFaultReportRecord = {
      id: input.id,
      reportId: input.report_id || '',
      entry: input.entry || 'installer',
      accountState: input.account_state || 'anonymous',
      userId: input.user_id || null,
      deviceId: input.device_id || '',
      installSessionId: input.install_session_id || null,
      appName: input.app_name || '',
      brandId: input.brand_id || '',
      appVersion: input.app_version || '',
      releaseChannel: input.release_channel || null,
      platform: input.platform || '',
      platformVersion: input.platform_version || null,
      arch: input.arch || '',
      failureStage: input.failure_stage || '',
      errorTitle: input.error_title || '',
      errorMessage: input.error_message || '',
      errorCode: input.error_code || null,
      runtimeFound: input.runtime_found === true,
      runtimeInstallable: input.runtime_installable === true,
      runtimeVersion: input.runtime_version || null,
      runtimePath: input.runtime_path || null,
      workDir: input.work_dir || null,
      logDir: input.log_dir || null,
      runtimeDownloadUrl: input.runtime_download_url || null,
      installProgressPhase: input.install_progress_phase || null,
      installProgressPercent:
        typeof input.install_progress_percent === 'number' ? input.install_progress_percent : null,
      uploadBucket: input.upload_bucket || '',
      uploadKey: input.upload_key || '',
      fileName: input.file_name || '',
      fileSizeBytes: Number(input.file_size_bytes || 0),
      fileSha256: input.file_sha256 || null,
      createdAt: input.created_at,
    };
    this.desktopFaultReportsById.set(record.id, record);
    return record;
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
    const items = Array.from(this.clientMetricEventsById.values())
      .filter((item) => (!input?.eventName ? true : item.eventName === input.eventName))
      .filter((item) => (!input?.userId ? true : item.userId === input.userId))
      .filter((item) => (!input?.deviceId ? true : item.deviceId === input.deviceId))
      .filter((item) => (!input?.appName ? true : item.appName === input.appName))
      .filter((item) => (!input?.brandId ? true : item.brandId === input.brandId))
      .filter((item) => (!input?.appVersion ? true : item.appVersion === input.appVersion))
      .filter((item) => (!input?.platform ? true : item.platform === input.platform))
      .filter((item) => (!input?.result ? true : item.result === input.result))
      .sort((left, right) => right.eventTime.localeCompare(left.eventTime));
    const limit = input?.limit && input.limit > 0 ? input.limit : items.length;
    return items.slice(0, limit);
  }

  async createClientMetricEvents(
    input: Array<Required<CreateClientMetricEventInput> & {id: string; created_at: string}>,
  ): Promise<ClientMetricEventRecord[]> {
    const created: ClientMetricEventRecord[] = input.map((item) => {
      const record: ClientMetricEventRecord = {
        id: item.id,
        eventName: item.event_name || '',
        eventTime: item.event_time || item.created_at,
        userId: item.user_id || null,
        deviceId: item.device_id || '',
        sessionId: item.session_id || null,
        installId: item.install_id || null,
        appName: item.app_name || '',
        brandId: item.brand_id || '',
        appVersion: item.app_version || '',
        releaseChannel: item.release_channel || null,
        platform: item.platform || '',
        osVersion: item.os_version || null,
        arch: item.arch || '',
        page: item.page || null,
        result: item.result || null,
        errorCode: item.error_code || null,
        durationMs: typeof item.duration_ms === 'number' ? item.duration_ms : null,
        payload: item.payload_json || {},
        createdAt: item.created_at,
      };
      this.clientMetricEventsById.set(record.id, record);
      return record;
    });
    return created;
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
    const items = Array.from(this.clientCrashEventsById.values())
      .filter((item) => (!input?.crashType ? true : item.crashType === input.crashType))
      .filter((item) => (!input?.userId ? true : item.userId === input.userId))
      .filter((item) => (!input?.deviceId ? true : item.deviceId === input.deviceId))
      .filter((item) => (!input?.appName ? true : item.appName === input.appName))
      .filter((item) => (!input?.brandId ? true : item.brandId === input.brandId))
      .filter((item) => (!input?.appVersion ? true : item.appVersion === input.appVersion))
      .filter((item) => (!input?.platform ? true : item.platform === input.platform))
      .sort((left, right) => right.eventTime.localeCompare(left.eventTime));
    const limit = input?.limit && input.limit > 0 ? input.limit : items.length;
    return items.slice(0, limit);
  }

  async createClientCrashEvent(
    input: Required<CreateClientCrashEventInput> & {id: string; created_at: string},
  ): Promise<ClientCrashEventRecord> {
    const record: ClientCrashEventRecord = {
      id: input.id,
      crashType: input.crash_type || 'renderer',
      eventTime: input.event_time || input.created_at,
      userId: input.user_id || null,
      deviceId: input.device_id || '',
      appName: input.app_name || '',
      brandId: input.brand_id || '',
      appVersion: input.app_version || '',
      platform: input.platform || '',
      osVersion: input.os_version || null,
      arch: input.arch || '',
      errorTitle: input.error_title || null,
      errorMessage: input.error_message || null,
      stackSummary: input.stack_summary || null,
      fileBucket: input.file_bucket || null,
      fileKey: input.file_key || null,
      createdAt: input.created_at,
    };
    this.clientCrashEventsById.set(record.id, record);
    return record;
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
    const existingEvents = this.paymentWebhookEventsByOrderId.get(order.id) || [];
    existingEvents.unshift({
      id: randomUUID(),
      provider,
      eventId: input.event_id,
      eventType: input.status,
      orderId: order.id,
      payload: {
        event_id: input.event_id,
        order_id: input.order_id,
        provider_order_id: input.provider_order_id,
        status: input.status,
        paid_at: input.paid_at,
      },
      signature: null,
      processedAt: new Date().toISOString(),
      processStatus: 'processed',
      createdAt: new Date().toISOString(),
    });
    this.paymentWebhookEventsByOrderId.set(order.id, existingEvents);
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

  async listRunBillingSummariesBySession(
    userId: string,
    sessionKey: string,
    limit?: number | null,
  ): Promise<RunBillingSummaryRecord[]> {
    const normalizedSessionKey = toCanonicalSessionKey(sessionKey);
    const normalizedLimit =
      typeof limit === 'number' && Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 200;
    return Array.from(this.runGrantsById.values())
      .filter((grant) => grant.userId === userId && grant.sessionKey === normalizedSessionKey && grant.billingSummary)
      .map((grant) => grant.billingSummary as RunBillingSummaryRecord)
      .sort((left, right) => Date.parse(right.settledAt) - Date.parse(left.settledAt))
      .slice(0, normalizedLimit);
  }

  async createRunGrant(input: {
    userId: string;
    sessionKey: string;
    eventId?: string | null;
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
      sessionKey: toCanonicalSessionKey(input.sessionKey),
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

  async recordUsageEvent(userId: string, input: PersistedUsageEventInput): Promise<UsageEventResult> {
    const existing = this.usageEventsByEventId.get(input.event_id);
    if (existing) return existing;

    const currentAccount = await this.getCreditAccount(userId);
    const requestedCost = Math.max(0, input.credit_cost);
    const dailyDebit = Math.min(currentAccount.dailyFreeBalance, requestedCost);
    const topupDebit = requestedCost - dailyDebit;
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
        assistantTimestamp:
          typeof input.assistant_timestamp === 'number' && Number.isFinite(input.assistant_timestamp)
            ? Math.floor(input.assistant_timestamp)
            : null,
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
        assistantTimestamp:
          typeof input.assistant_timestamp === 'number' && Number.isFinite(input.assistant_timestamp)
            ? Math.floor(input.assistant_timestamp)
            : null,
        createdAt,
      });
    }
    this.creditLedgerByUserId.set(userId, ledger);

    const grant = input.grant_id ? this.runGrantsById.get(input.grant_id) || null : null;
    const settledAt = createdAt;
    const summary: RunBillingSummaryRecord = {
      grantId: input.grant_id,
      eventId: input.event_id,
      sessionKey: grant?.sessionKey || toCanonicalSessionKey(),
      client: grant?.client || 'desktop',
      status: 'settled',
      inputTokens: Math.max(0, input.input_tokens),
      outputTokens: Math.max(0, input.output_tokens),
      creditCost: Math.max(0, input.credit_cost),
      provider: input.provider || null,
      model: input.model || null,
      balanceAfter: nextAccount.totalAvailableBalance,
      settledAt,
      assistantTimestamp:
        typeof input.assistant_timestamp === 'number' && Number.isFinite(input.assistant_timestamp)
          ? Math.floor(input.assistant_timestamp)
          : null,
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

  async listMarketStocks(): Promise<{items: MarketStockRecord[]; total: number}> {
    return {items: [], total: 0};
  }

  async getMarketStock(_stockId: string): Promise<MarketStockRecord | null> {
    return null;
  }

  async listMarketFunds(): Promise<{items: MarketFundRecord[]; total: number}> {
    return {items: [], total: 0};
  }

  async getMarketFund(_fundId: string): Promise<MarketFundRecord | null> {
    return null;
  }

  async listAgentCatalog(): Promise<AgentCatalogEntryRecord[]> {
    return Array.from(this.agentCatalog.values())
      .filter((item) => item.active)
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
          left.sortOrder - right.sortOrder ||
          left.name.localeCompare(right.name, 'zh-CN'),
      );
  }

  async listAgentCatalogAdmin(): Promise<AgentCatalogEntryRecord[]> {
    return Array.from(this.agentCatalog.values()).sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name, 'zh-CN'),
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

  async listSkillCatalog(
    limit?: number,
    offset?: number,
    filters?: {tagKeywords?: string[] | null; extraSkillSlugs?: string[] | null},
  ): Promise<SkillCatalogEntryRecord[]> {
    const normalizedKeywords = Array.from(
      new Set((filters?.tagKeywords || []).map((keyword) => keyword.trim().toLowerCase()).filter(Boolean)),
    );
    const extraSlugSet = new Set((filters?.extraSkillSlugs || []).map((slug) => slug.trim()).filter(Boolean));
    const items = Array.from(this.skillCatalog.values())
      .filter((item) => item.active && (item.distribution === 'cloud' || extraSlugSet.has(item.slug)))
      .filter((item) => {
        if (normalizedKeywords.length === 0) return true;
        return item.tags.some((tag) => {
          const normalizedTag = tag.trim().toLowerCase();
          return normalizedKeywords.some((keyword) => normalizedTag.includes(keyword));
        });
      })
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
    return this.paginateSkillCatalog(items, limit, offset);
  }

  async countSkillCatalog(filters?: {tagKeywords?: string[] | null; extraSkillSlugs?: string[] | null}): Promise<number> {
    return (await this.listSkillCatalog(undefined, undefined, filters)).length;
  }

  async listSkillCatalogBySlugs(
    slugs: string[],
    limit?: number,
    offset?: number,
    filters?: {tagKeywords?: string[] | null},
  ): Promise<SkillCatalogEntryRecord[]> {
    const slugSet = new Set(slugs.map((slug) => slug.trim()).filter(Boolean));
    const normalizedKeywords = Array.from(
      new Set((filters?.tagKeywords || []).map((keyword) => keyword.trim().toLowerCase()).filter(Boolean)),
    );
    return this.paginateSkillCatalog(
      Array.from(this.skillCatalog.values())
        .filter((item) => item.active && slugSet.has(item.slug))
        .filter((item) => {
          if (normalizedKeywords.length === 0) return true;
          return item.tags.some((tag) => {
            const normalizedTag = tag.trim().toLowerCase();
            return normalizedKeywords.some((keyword) => normalizedTag.includes(keyword));
          });
        })
        .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')),
      limit,
      offset,
    );
  }

  async countSkillCatalogBySlugs(slugs: string[], filters?: {tagKeywords?: string[] | null}): Promise<number> {
    const slugSet = new Set(slugs.map((slug) => slug.trim()).filter(Boolean));
    const normalizedKeywords = Array.from(
      new Set((filters?.tagKeywords || []).map((keyword) => keyword.trim().toLowerCase()).filter(Boolean)),
    );
    return Array.from(this.skillCatalog.values())
      .filter((item) => item.active && slugSet.has(item.slug))
      .filter((item) => {
        if (normalizedKeywords.length === 0) return true;
        return item.tags.some((tag) => {
          const normalizedTag = tag.trim().toLowerCase();
          return normalizedKeywords.some((keyword) => normalizedTag.includes(keyword));
        });
      })
      .length;
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

  async listMcpCatalogAdmin(): Promise<McpCatalogEntryRecord[]> {
    return Array.from(this.mcpCatalog.values()).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
  }

  async countMcpCatalog(): Promise<number> {
    return Array.from(this.mcpCatalog.values()).filter((item) => item.active).length;
  }

  async getMcpCatalogEntry(mcpKey: string): Promise<McpCatalogEntryRecord | null> {
    return this.mcpCatalog.get(mcpKey) || null;
  }

  async upsertMcpCatalogEntry(input: Required<UpsertMcpCatalogEntryInput>): Promise<McpCatalogEntryRecord> {
    const now = new Date().toISOString();
    const existing = this.mcpCatalog.get(input.mcp_key);
    const next: McpCatalogEntryRecord = {
      mcpKey: input.mcp_key,
      name: input.name,
      description: input.description,
      transport: input.transport || 'config',
      objectKey: input.object_key,
      config: input.config,
      metadata: input.metadata,
      active: input.active,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.mcpCatalog.set(input.mcp_key, next);
    return next;
  }

  async deleteMcpCatalogEntry(mcpKey: string): Promise<boolean> {
    return this.mcpCatalog.delete(mcpKey);
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

  async listUserExtensionInstallConfigs(
    userId: string,
    extensionType?: ExtensionInstallTarget,
  ): Promise<UserExtensionInstallConfigRecord[]> {
    return Array.from(this.userExtensionInstallConfigs.values()).filter(
      (item) => item.userId === userId && (!extensionType || item.extensionType === extensionType),
    );
  }

  async getUserExtensionInstallConfig(
    userId: string,
    extensionType: ExtensionInstallTarget,
    extensionKey: string,
  ): Promise<UserExtensionInstallConfigRecord | null> {
    return (
      this.userExtensionInstallConfigs.get(
        this.extensionInstallConfigKey(userId, extensionType, extensionKey),
      ) || null
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
    const now = new Date().toISOString();
    const key = this.extensionInstallConfigKey(userId, input.extension_type, input.extension_key);
    const existing = this.userExtensionInstallConfigs.get(key);
    const record: UserExtensionInstallConfigRecord = {
      userId,
      extensionType: input.extension_type,
      extensionKey: input.extension_key,
      schemaVersion: input.schema_version,
      status: input.status,
      config: input.setup_values,
      configuredSecretKeys: input.configured_secret_keys,
      secretPayloadEncrypted: input.secret_payload_encrypted ?? null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.userExtensionInstallConfigs.set(key, record);
    return record;
  }

  async removeUserExtensionInstallConfig(
    userId: string,
    extensionType: ExtensionInstallTarget,
    extensionKey: string,
  ): Promise<boolean> {
    return this.userExtensionInstallConfigs.delete(
      this.extensionInstallConfigKey(userId, extensionType, extensionKey),
    );
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
    const removed = this.userMcpLibrary.delete(`${userId}:${mcpKey}`);
    if (removed) {
      this.userExtensionInstallConfigs.delete(this.extensionInstallConfigKey(userId, 'mcp', mcpKey));
    }
    return removed;
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
    const removed = this.userSkillLibrary.delete(`${userId}:${slug}`);
    if (removed) {
      this.userExtensionInstallConfigs.delete(this.extensionInstallConfigKey(userId, 'skill', slug));
    }
    return removed;
  }

  private oauthKey(provider: OAuthProvider, providerId: string): string {
    return `${provider}:${providerId}`;
  }

  private extensionInstallConfigKey(
    userId: string,
    extensionType: ExtensionInstallTarget,
    extensionKey: string,
  ): string {
    return `${userId}:${extensionType}:${extensionKey}`;
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
