import { toCanonicalSessionKey, type AuthTokens } from '@iclaw/shared';

import { deleteAvatarByKey, deleteOldAvatars, extractAvatarKey, normalizeAvatarUrl, uploadAvatar } from './avatar-storage.ts';
import {config} from './config.ts';
import {randomBytes, randomUUID} from 'node:crypto';
import {decryptInstallSecretPayload, encryptInstallSecretPayload} from './install-config-secrets.ts';
import {
  buildCloudSkillArtifactProxyUrl,
  getCloudSkillArtifactObjectKey,
  shouldServeCloudSkillViaControlPlane,
} from './cloud-skill-artifacts.ts';
import {deletePrivateSkillArtifact, uploadPrivateSkillArtifact} from './skill-storage.ts';
import {
  deleteUserFile as deleteStoredUserFile,
  downloadUserFile as downloadStoredUserFile,
  uploadUserFile as storeUserFile,
} from './user-file-storage.ts';
import {
  downloadDesktopFaultReportFile as downloadStoredDesktopFaultReportFile,
  uploadDesktopFaultReportFile,
} from './desktop-fault-report-storage.ts';

import type {
  AdminDesktopActionApprovalGrantView,
  AdminDesktopActionAuditEventView,
  AdminDesktopActionPolicyRuleView,
  AdminDesktopDiagnosticUploadView,
  AdminDesktopFaultReportDetailView,
  AdminDesktopFaultReportSummaryView,
  AdminClientMetricEventView,
  AdminClientCrashEventView,
  AdminRefundPaymentOrderInput,
  AdminMarkPaymentOrderPaidInput,
  AdminPaymentOrderDetailView,
  AdminPaymentProviderBindingView,
  AdminPaymentGatewayConfigSource,
  AdminPaymentGatewayConfigView,
  AdminPaymentProviderProfileView,
  AdminPaymentOrderSummaryView,
  AdminAgentCatalogEntryView,
  AgentCategory,
  AgentCatalogEntryRecord,
  AgentCatalogEntryView,
  AdminSkillCatalogEntryView,
  ChangePasswordInput,
  CreatePaymentOrderInput,
  CreditBalanceView,
  CreditLedgerRecord,
  CreditQuoteInput,
  CreditQuoteView,
  CreditLedgerItemView,
  CreateDesktopActionApprovalGrantInput,
  CreateDesktopActionAuditEventInput,
  CreateDesktopDiagnosticUploadInput,
  CreateDesktopFaultReportInput,
  CreateClientMetricEventInput,
  CreateClientCrashEventInput,
  CreateClientPerfSampleInput,
  DesktopActionAccessMode,
  DesktopActionApprovalGrantRecord,
  DesktopActionAuditDecision,
  DesktopActionAuditEventRecord,
  DesktopActionAuditStage,
  DesktopActionExecutorType,
  DesktopActionGrantScope,
  DesktopActionNetworkDestination,
  DesktopActionPolicyEffect,
  DesktopActionPolicyRuleRecord,
  DesktopActionPolicyScope,
  DesktopActionRiskClass,
  DesktopActionRiskLevel,
  DesktopDiagnosticUploadRecord,
  DesktopFaultReportAccountState,
  DesktopFaultReportEntry,
  DesktopFaultReportRecord,
  DesktopDiagnosticUploadSourceType,
  ClientMetricEventRecord,
  ClientMetricEventResult,
  ClientCrashEventRecord,
  ClientCrashType,
  ClientPerfMetricName,
  ClientPerfSampleRecord,
  AdminClientPerfSampleView,
  ExtensionInstallTarget,
  ExtensionSetupStatus,
  ImportUserPrivateSkillInput,
  InstallAgentInput,
  InstallMcpInput,
  InstallSkillInput,
  MarketFundRecord,
  MarketFundView,
  LoginInput,
  MarketStockRecord,
  MarketStockView,
  McpCatalogEntryRecord,
  McpCatalogEntryView,
  OAuthProvider,
  PaymentOrderRecord,
  PaymentOrderView,
  PaymentProviderBindingRecord,
  PaymentProviderBindingMode,
  PaymentProviderChannelKind,
  PaymentProviderProfileRecord,
  PaymentProviderScopeType,
  PaymentProvider,
  PaymentWebhookEventRecord,
  PaymentWebhookEventView,
  PaymentWebhookInput,
  PublicUser,
  RegisterInput,
  RunBillingSummaryRecord,
  RunBillingSummaryView,
  RunAuthorizeInput,
  RunGrantView,
  SkillSource,
  SkillCatalogEntryRecord,
  SkillCatalogEntryView,
  SkillSyncRunView,
  SkillSyncSourceView,
  UpsertAgentCatalogEntryInput,
  UpsertAdminPaymentProviderBindingInput,
  UpsertAdminPaymentGatewayConfigInput,
  UpsertAdminPaymentProviderProfileInput,
  UpsertDesktopActionPolicyRuleInput,
  UpsertSkillCatalogEntryInput,
  UpsertSkillSyncSourceInput,
  UpsertUserExtensionInstallConfigInput,
  UpdateSkillLibraryItemInput,
  UpdateProfileInput,
  UsageEventInput,
  UsageEventResult,
  UserAgentLibraryItemView,
  UserExtensionInstallConfigRecord,
  UserExtensionInstallConfigView,
  UserFileRecord,
  UserFileView,
  UserMcpLibraryItemView,
  UserPrivateSkillRecord,
  UserRecord,
  UserRole,
  UserSkillLibraryItemView,
  UserSkillLibrarySource,
  UpdateMcpLibraryItemInput,
  WorkspaceBackupInput,
  WorkspaceBackupView,
} from './domain.ts';
import {HttpError} from './errors.ts';
import {EpayService} from './epay-service.ts';
import {logWarn} from './logger.ts';
import {loadOAuthUserProfile} from './oauth.ts';
import {hashPassword, verifyPassword} from './passwords.ts';
import {syncSkillsFromSource} from './skill-sync.ts';
import type {ControlPlaneStore} from './store.ts';
import {generateOpaqueToken, hashOpaqueToken} from './tokens.ts';

const SUPPORTED_PAYMENT_PROVIDERS = new Set<PaymentProvider>(['mock', 'wechat_qr', 'alipay_qr']);
const SUPPORTED_PAYMENT_PROVIDER_SCOPE_TYPES = new Set<PaymentProviderScopeType>(['platform', 'app']);
const SUPPORTED_PAYMENT_PROVIDER_BINDING_MODES = new Set<PaymentProviderBindingMode>([
  'inherit_platform',
  'use_app_profile',
]);
const SUPPORTED_PAYMENT_PROVIDER_CHANNEL_KINDS = new Set<PaymentProviderChannelKind>(['wechat_service_provider']);
const SUPPORTED_PAYMENT_WEBHOOK_STATUSES = new Set<PaymentOrderRecord['status']>([
  'pending',
  'paid',
  'failed',
  'expired',
  'refunded',
]);
const SKILL_SYNC_RUN_ITEM_LIMIT = 500;
const SKILL_CATALOG_DEFAULT_LIMIT = 300;
const SKILL_CATALOG_MAX_LIMIT = 1000;
const MARKET_STOCK_DEFAULT_LIMIT = 120;
const MARKET_STOCK_MAX_LIMIT = 500;
const MARKET_FUND_DEFAULT_LIMIT = 120;
const MARKET_FUND_MAX_LIMIT = 500;
const PAYMENT_PROVIDER_SECRET_FIELDS = ['api_v3_key', 'private_key_pem'] as const;
const PAYMENT_PROVIDER_REQUIRED_CONFIG_FIELDS = ['sp_mchid', 'sp_appid', 'sub_mchid', 'notify_url', 'serial_no'] as const;
const EPAY_PAYMENT_GATEWAY_STATE_KEY = 'payment_gateway:epay';
const EPAY_GATEWAY_CONFIG_FIELDS = ['partner_id', 'gateway'] as const;
const EPAY_GATEWAY_SECRET_FIELDS = ['key'] as const;
const DESKTOP_ACTION_POLICY_SCOPES = new Set<DesktopActionPolicyScope>(['platform', 'oem', 'org']);
const DESKTOP_ACTION_POLICY_EFFECTS = new Set<DesktopActionPolicyEffect>(['allow', 'allow_with_approval', 'deny']);
const DESKTOP_ACTION_RISK_LEVELS = new Set<DesktopActionRiskLevel>(['low', 'medium', 'high', 'critical']);
const DESKTOP_ACTION_GRANT_SCOPES = new Set<DesktopActionGrantScope>(['once', 'task', 'session', 'ttl']);
const DESKTOP_ACTION_ACCESS_MODES = new Set<DesktopActionAccessMode>(['read', 'write', 'execute', 'connect']);
const DESKTOP_ACTION_EXECUTOR_TYPES = new Set<DesktopActionExecutorType>([
  'template',
  'shell',
  'browser',
  'filesystem',
  'process',
  'upload',
]);
const DESKTOP_ACTION_RISK_CLASSES = new Set<DesktopActionRiskClass>(['L1', 'L2', 'L3', 'L4']);
const DESKTOP_ACTION_AUDIT_DECISIONS = new Set<DesktopActionAuditDecision>(['allow', 'deny', 'pending']);
const DESKTOP_ACTION_AUDIT_STAGES = new Set<DesktopActionAuditStage>([
  'intent_created',
  'policy_evaluated',
  'approval_requested',
  'approval_granted',
  'approval_denied',
  'plan_mismatch_denied',
  'execution_started',
  'execution_finished',
]);
const DESKTOP_DIAGNOSTIC_UPLOAD_SOURCE_TYPES = new Set<DesktopDiagnosticUploadSourceType>([
  'manual',
  'auto_error_capture',
  'approval_flow',
]);
const DESKTOP_DIAGNOSTIC_SENSITIVITY_LEVELS = new Set(['customer', 'internal', 'redacted']);
const DESKTOP_FAULT_REPORT_ENTRIES = new Set<DesktopFaultReportEntry>(['installer', 'exception-dialog']);
const DESKTOP_FAULT_REPORT_ACCOUNT_STATES = new Set<DesktopFaultReportAccountState>(['anonymous', 'authenticated']);
const CLIENT_METRIC_EVENT_RESULTS = new Set<ClientMetricEventResult>(['success', 'failed']);
const CLIENT_CRASH_TYPES = new Set<ClientCrashType>(['native', 'renderer', 'sidecar']);
const CLIENT_PERF_METRIC_NAMES = new Set<ClientPerfMetricName>([
  'cold_start_ms',
  'warm_start_ms',
  'page_load_ms',
  'api_latency_ms',
  'memory_mb',
  'cpu_percent',
]);

function resolvePublicApiBaseUrl(): string {
  if (config.apiUrl.trim()) {
    return config.apiUrl.trim().replace(/\/$/, '');
  }
  return `http://127.0.0.1:${config.port}`;
}

function normalizePersistedAvatarUrl(value?: string | null): string | null {
  return normalizeAvatarUrl(value);
}

function normalizeCatalogLimit(limitInput?: number | null): number {
  if (typeof limitInput !== 'number' || !Number.isFinite(limitInput)) {
    return SKILL_CATALOG_DEFAULT_LIMIT;
  }
  const normalized = Math.floor(limitInput);
  if (normalized <= 0) {
    return SKILL_CATALOG_DEFAULT_LIMIT;
  }
  return Math.min(normalized, SKILL_CATALOG_MAX_LIMIT);
}

function normalizeCatalogOffset(offsetInput?: number | null): number {
  if (typeof offsetInput !== 'number' || !Number.isFinite(offsetInput)) {
    return 0;
  }
  const normalized = Math.floor(offsetInput);
  if (normalized <= 0) {
    return 0;
  }
  return normalized;
}

function normalizeMarketStockLimit(limitInput?: number | null): number {
  if (typeof limitInput !== 'number' || !Number.isFinite(limitInput)) {
    return MARKET_STOCK_DEFAULT_LIMIT;
  }
  const normalized = Math.floor(limitInput);
  if (normalized <= 0) {
    return MARKET_STOCK_DEFAULT_LIMIT;
  }
  return Math.min(normalized, MARKET_STOCK_MAX_LIMIT);
}

function normalizeMarketFundLimit(limitInput?: number | null): number {
  if (typeof limitInput !== 'number' || !Number.isFinite(limitInput)) {
    return MARKET_FUND_DEFAULT_LIMIT;
  }
  const normalized = Math.floor(limitInput);
  if (normalized <= 0) {
    return MARKET_FUND_DEFAULT_LIMIT;
  }
  return Math.min(normalized, MARKET_FUND_MAX_LIMIT);
}

function normalizeIdentifier(value: string, field: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalized) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} is required`);
  }
  return normalized;
}

function normalizeUsername(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new HttpError(400, 'BAD_REQUEST', 'username is required');
  }
  return normalized;
}

function toPublicUser(user: {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  role: UserRole;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.displayName,
    avatar_url: normalizePersistedAvatarUrl(user.avatarUrl),
    role: user.role,
  };
}

function toRunBillingSummaryView(summary: RunBillingSummaryRecord): RunBillingSummaryView {
  return {
    grant_id: summary.grantId,
    event_id: summary.eventId,
    session_key: summary.sessionKey,
    client: summary.client,
    status: summary.status,
    input_tokens: summary.inputTokens,
    output_tokens: summary.outputTokens,
    credit_cost: summary.creditCost,
    provider: summary.provider,
    model: summary.model,
    balance_after: summary.balanceAfter,
    settled_at: summary.settledAt,
    assistant_timestamp: summary.assistantTimestamp,
  };
}

function toCreditLedgerItemView(item: CreditLedgerRecord): CreditLedgerItemView {
  return {
    id: item.id,
    bucket: item.bucket,
    direction: item.direction,
    amount: item.amount,
    reference_type: item.referenceType,
    reference_id: item.referenceId,
    event_type: item.eventType,
    delta: item.delta,
    balance_after: item.balanceAfter,
    created_at: item.createdAt,
  };
}

function toPaymentOrderView(order: PaymentOrderRecord): PaymentOrderView {
  return {
    order_id: order.id,
    status: order.status,
    provider: order.provider,
    package_id: order.packageId,
    package_name: order.packageName,
    credits: order.credits,
    bonus_credits: order.bonusCredits,
    total_credits: order.credits + order.bonusCredits,
    amount_cny_fen: order.amountCnyFen,
    payment_url: order.paymentUrl,
    app_name: order.appName,
    paid_at: order.paidAt,
    expires_at: order.expiredAt,
  };
}

function toPaymentWebhookEventView(event: PaymentWebhookEventRecord): PaymentWebhookEventView {
  return {
    id: event.id,
    provider: event.provider,
    event_id: event.eventId,
    event_type: event.eventType,
    order_id: event.orderId,
    payload: event.payload,
    signature: event.signature,
    processed_at: event.processedAt,
    process_status: event.processStatus,
    created_at: event.createdAt,
  };
}

function toMarketStockView(record: MarketStockRecord): MarketStockView {
  return {
    id: record.id,
    market: record.market,
    exchange: record.exchange,
    symbol: record.symbol,
    company_name: record.companyName,
    board: record.board,
    status: record.status,
    source: record.source,
    source_id: record.sourceId,
    current_price: record.currentPrice,
    change_percent: record.changePercent,
    amount: record.amount,
    turnover_rate: record.turnoverRate,
    pe_ttm: record.peTtm,
    open_price: record.openPrice,
    prev_close: record.prevClose,
    total_market_cap: record.totalMarketCap,
    circulating_market_cap: record.circulatingMarketCap,
    strategy_tags: record.strategyTags,
    metadata: record.metadata,
    imported_at: record.importedAt,
    updated_at: record.updatedAt,
  };
}

function toMarketFundView(record: MarketFundRecord): MarketFundView {
  return {
    id: record.id,
    market: record.market,
    exchange: record.exchange,
    symbol: record.symbol,
    fund_name: record.fundName,
    fund_type: record.fundType,
    instrument_kind: record.instrumentKind,
    region: record.region,
    risk_level: record.riskLevel,
    manager_name: record.managerName,
    tracking_target: record.trackingTarget,
    status: record.status,
    source: record.source,
    source_id: record.sourceId,
    current_price: record.currentPrice,
    nav_price: record.navPrice,
    change_percent: record.changePercent,
    return_1m: record.return1m,
    return_1y: record.return1y,
    max_drawdown: record.maxDrawdown,
    scale_amount: record.scaleAmount,
    fee_rate: record.feeRate,
    amount: record.amount,
    turnover_rate: record.turnoverRate,
    dividend_mode: record.dividendMode,
    strategy_tags: record.strategyTags,
    metadata: record.metadata,
    imported_at: record.importedAt,
    updated_at: record.updatedAt,
  };
}

function toAdminPaymentOrderSummaryView(order: {
  id: string;
  status: PaymentOrderRecord['status'];
  provider: PaymentProvider;
  packageId: string;
  packageName: string;
  credits: number;
  bonusCredits: number;
  amountCnyFen: number;
  currency: 'cny';
  paymentUrl: string | null;
  appName: string | null;
  appVersion: string | null;
  releaseChannel: string | null;
  platform: string | null;
  arch: string | null;
  returnUrl: string | null;
  userAgent: string | null;
  providerOrderId: string | null;
  providerPrepayId: string | null;
  userId: string;
  username: string;
  userEmail: string;
  userDisplayName: string;
  webhookEventCount: number;
  latestWebhookAt: string | null;
  paidAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}): AdminPaymentOrderSummaryView {
  return {
    order_id: order.id,
    status: order.status,
    provider: order.provider,
    package_id: order.packageId,
    package_name: order.packageName,
    credits: order.credits,
    bonus_credits: order.bonusCredits,
    total_credits: order.credits + order.bonusCredits,
    amount_cny_fen: order.amountCnyFen,
    currency: order.currency,
    payment_url: order.paymentUrl,
    app_name: order.appName,
    app_version: order.appVersion,
    release_channel: order.releaseChannel,
    platform: order.platform,
    arch: order.arch,
    return_url: order.returnUrl,
    user_agent: order.userAgent,
    provider_order_id: order.providerOrderId,
    provider_prepay_id: order.providerPrepayId,
    user_id: order.userId,
    username: order.username,
    user_email: order.userEmail,
    user_display_name: order.userDisplayName,
    webhook_event_count: order.webhookEventCount,
    latest_webhook_at: order.latestWebhookAt,
    paid_at: order.paidAt,
    expires_at: order.expiredAt,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    metadata: order.metadata,
  };
}

function toAdminPaymentOrderDetailView(order: {
  webhookEvents: PaymentWebhookEventRecord[];
} & Parameters<typeof toAdminPaymentOrderSummaryView>[0]): AdminPaymentOrderDetailView {
  return {
    ...toAdminPaymentOrderSummaryView(order),
    webhook_events: order.webhookEvents.map((event) => toPaymentWebhookEventView(event)),
  };
}

function toUserFileView(record: UserFileRecord, baseUrl: string): UserFileView {
  return {
    file_id: record.id,
    tenant_id: record.tenantId,
    kind: record.kind,
    status: record.status,
    name: record.originalFileName,
    mime: record.mimeType,
    size: record.sizeBytes,
    sha256: record.sha256,
    source: record.source,
    task_id: record.taskId,
    url: `${baseUrl.replace(/\/$/, '')}/files/${encodeURIComponent(record.id)}/content`,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
  };
}

function toAdminDesktopActionPolicyRuleView(record: DesktopActionPolicyRuleRecord): AdminDesktopActionPolicyRuleView {
  return {
    id: record.id,
    scope: record.scope,
    scope_id: record.scopeId,
    name: record.name,
    effect: record.effect,
    capability: record.capability,
    risk_level: record.riskLevel,
    official_only: record.officialOnly,
    publisher_ids: record.publisherIds,
    package_digests: record.packageDigests,
    skill_slugs: record.skillSlugs,
    workflow_ids: record.workflowIds,
    executor_types: record.executorTypes,
    executor_template_ids: record.executorTemplateIds,
    canonical_path_prefixes: record.canonicalPathPrefixes,
    network_destinations: record.networkDestinations,
    access_modes: record.accessModes,
    allow_elevation: record.allowElevation,
    allow_network_egress: record.allowNetworkEgress,
    grant_scope: record.grantScope,
    max_grant_scope: record.maxGrantScope,
    ttl_seconds: record.ttlSeconds,
    enabled: record.enabled,
    priority: record.priority,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function toAdminDesktopActionApprovalGrantView(
  record: DesktopActionApprovalGrantRecord,
): AdminDesktopActionApprovalGrantView {
  return {
    id: record.id,
    user_id: record.userId,
    device_id: record.deviceId,
    app_name: record.appName,
    intent_fingerprint: record.intentFingerprint,
    approved_plan_hash: record.approvedPlanHash,
    capability: record.capability,
    risk_level: record.riskLevel,
    access_modes: record.accessModes,
    normalized_resources: record.normalizedResources,
    network_destinations: record.networkDestinations,
    executor_type: record.executorType,
    executor_template_id: record.executorTemplateId,
    publisher_id: record.publisherId,
    package_digest: record.packageDigest,
    scope: record.scope,
    task_id: record.taskId,
    session_key: record.sessionKey,
    expires_at: record.expiresAt,
    revoked_at: record.revokedAt,
    created_at: record.createdAt,
  };
}

function toAdminDesktopActionAuditEventView(record: DesktopActionAuditEventRecord): AdminDesktopActionAuditEventView {
  return {
    id: record.id,
    intent_id: record.intentId,
    trace_id: record.traceId,
    user_id: record.userId,
    device_id: record.deviceId,
    app_name: record.appName,
    agent_id: record.agentId,
    skill_slug: record.skillSlug,
    workflow_id: record.workflowId,
    capability: record.capability,
    risk_level: record.riskLevel,
    requires_elevation: record.requiresElevation,
    decision: record.decision,
    stage: record.stage,
    summary: record.summary,
    reason: record.reason,
    resources: record.resources,
    matched_policy_rule_id: record.matchedPolicyRuleId,
    approved_plan_hash: record.approvedPlanHash,
    executed_plan_hash: record.executedPlanHash,
    command_snapshot_redacted: record.commandSnapshotRedacted,
    result_code: record.resultCode,
    result_summary: record.resultSummary,
    duration_ms: record.durationMs,
    created_at: record.createdAt,
  };
}

function toAdminDesktopDiagnosticUploadView(record: DesktopDiagnosticUploadRecord): AdminDesktopDiagnosticUploadView {
  return {
    id: record.id,
    user_id: record.userId,
    device_id: record.deviceId,
    app_name: record.appName,
    upload_bucket: record.uploadBucket,
    upload_key: record.uploadKey,
    file_name: record.fileName,
    file_size_bytes: record.fileSizeBytes,
    sha256: record.sha256,
    source_type: record.sourceType,
    contains_customer_logs: record.containsCustomerLogs,
    sensitivity_level: record.sensitivityLevel,
    linked_intent_id: record.linkedIntentId,
    created_at: record.createdAt,
  };
}

function toAdminDesktopFaultReportSummaryView(
  record: DesktopFaultReportRecord,
): AdminDesktopFaultReportSummaryView {
  return {
    id: record.id,
    report_id: record.reportId,
    entry: record.entry,
    account_state: record.accountState,
    user_id: record.userId,
    device_id: record.deviceId,
    install_session_id: record.installSessionId,
    app_name: record.appName,
    brand_id: record.brandId,
    app_version: record.appVersion,
    release_channel: record.releaseChannel,
    platform: record.platform,
    platform_version: record.platformVersion,
    arch: record.arch,
    failure_stage: record.failureStage,
    error_title: record.errorTitle,
    error_message: record.errorMessage,
    error_code: record.errorCode,
    file_name: record.fileName,
    file_size_bytes: record.fileSizeBytes,
    file_sha256: record.fileSha256,
    created_at: record.createdAt,
  };
}

function toAdminDesktopFaultReportDetailView(
  record: DesktopFaultReportRecord,
  baseUrl: string,
): AdminDesktopFaultReportDetailView {
  return {
    ...toAdminDesktopFaultReportSummaryView(record),
    runtime_found: record.runtimeFound,
    runtime_installable: record.runtimeInstallable,
    runtime_version: record.runtimeVersion,
    runtime_path: record.runtimePath,
    work_dir: record.workDir,
    log_dir: record.logDir,
    runtime_download_url: record.runtimeDownloadUrl,
    install_progress_phase: record.installProgressPhase,
    install_progress_percent: record.installProgressPercent,
    upload_bucket: record.uploadBucket,
    upload_key: record.uploadKey,
    download_url: `${baseUrl.replace(/\/$/, '')}/admin/desktop/fault-reports/${encodeURIComponent(record.id)}/download`,
  };
}

function toAdminClientMetricEventView(record: ClientMetricEventRecord): AdminClientMetricEventView {
  return {
    id: record.id,
    event_name: record.eventName,
    event_time: record.eventTime,
    user_id: record.userId,
    device_id: record.deviceId,
    session_id: record.sessionId,
    install_id: record.installId,
    app_name: record.appName,
    brand_id: record.brandId,
    app_version: record.appVersion,
    release_channel: record.releaseChannel,
    platform: record.platform,
    os_version: record.osVersion,
    arch: record.arch,
    page: record.page,
    result: record.result,
    error_code: record.errorCode,
    duration_ms: record.durationMs,
    payload: record.payload,
    created_at: record.createdAt,
  };
}

function toAdminClientCrashEventView(record: ClientCrashEventRecord): AdminClientCrashEventView {
  return {
    id: record.id,
    crash_type: record.crashType,
    event_time: record.eventTime,
    user_id: record.userId,
    device_id: record.deviceId,
    app_name: record.appName,
    brand_id: record.brandId,
    app_version: record.appVersion,
    platform: record.platform,
    os_version: record.osVersion,
    arch: record.arch,
    error_title: record.errorTitle,
    error_message: record.errorMessage,
    stack_summary: record.stackSummary,
    file_bucket: record.fileBucket,
    file_key: record.fileKey,
    created_at: record.createdAt,
  };
}

function toAdminClientPerfSampleView(record: ClientPerfSampleRecord): AdminClientPerfSampleView {
  return {
    id: record.id,
    metric_name: record.metricName,
    metric_time: record.metricTime,
    user_id: record.userId,
    device_id: record.deviceId,
    app_name: record.appName,
    brand_id: record.brandId,
    app_version: record.appVersion,
    release_channel: record.releaseChannel,
    platform: record.platform,
    os_version: record.osVersion,
    arch: record.arch,
    value: record.value,
    unit: record.unit,
    sample_rate: record.sampleRate,
    payload: record.payload,
    created_at: record.createdAt,
  };
}

function rolePriority(role: UserRole): number {
  switch (role) {
    case 'super_admin':
      return 3;
    case 'admin':
      return 2;
    default:
      return 1;
  }
}

function makeNonce(): string {
  return randomBytes(12).toString('hex');
}

function makeSignature(input: {userId: string; nonce: string; expiresAt: string}): string {
  return Buffer.from(`${input.userId}:${input.nonce}:${input.expiresAt}`, 'utf8').toString('base64url');
}

export function normalizePaymentProvider(value: string | undefined, fallback: PaymentProvider = 'wechat_qr'): PaymentProvider {
  const normalized = (value || '').trim();
  const provider = (normalized || fallback) as PaymentProvider;
  if (!SUPPORTED_PAYMENT_PROVIDERS.has(provider)) {
    throw new HttpError(400, 'BAD_REQUEST', 'unsupported payment provider');
  }
  return provider;
}

function paymentProviderLabel(provider: PaymentProvider): string {
  if (provider === 'wechat_qr') return '微信支付';
  if (provider === 'alipay_qr') return '支付宝';
  return '测试支付';
}

function normalizePaymentProviderScopeType(
  value: string | undefined,
  fallback: PaymentProviderScopeType = 'platform',
): PaymentProviderScopeType {
  const normalized = (value || '').trim();
  const scopeType = (normalized || fallback) as PaymentProviderScopeType;
  if (!SUPPORTED_PAYMENT_PROVIDER_SCOPE_TYPES.has(scopeType)) {
    throw new HttpError(400, 'BAD_REQUEST', 'unsupported payment provider scope_type');
  }
  return scopeType;
}

function normalizePaymentGatewayMode(value: string | undefined, fallback: 'use_app_config' | 'inherit_platform' = 'use_app_config') {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return fallback;
  }
  if (normalized === 'use_app_config' || normalized === 'inherit_platform') {
    return normalized;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'unsupported payment gateway mode');
}

function normalizePaymentProviderBindingMode(
  value: string | undefined,
  fallback: PaymentProviderBindingMode = 'inherit_platform',
): PaymentProviderBindingMode {
  const normalized = (value || '').trim();
  const mode = (normalized || fallback) as PaymentProviderBindingMode;
  if (!SUPPORTED_PAYMENT_PROVIDER_BINDING_MODES.has(mode)) {
    throw new HttpError(400, 'BAD_REQUEST', 'unsupported payment provider mode');
  }
  return mode;
}

function normalizePaymentProviderChannelKind(
  provider: PaymentProvider,
  value: string | undefined,
): PaymentProviderChannelKind {
  const normalized = (value || '').trim();
  const fallback: PaymentProviderChannelKind = provider === 'wechat_qr' ? 'wechat_service_provider' : 'wechat_service_provider';
  const channelKind = (normalized || fallback) as PaymentProviderChannelKind;
  if (!SUPPORTED_PAYMENT_PROVIDER_CHANNEL_KINDS.has(channelKind)) {
    throw new HttpError(400, 'BAD_REQUEST', 'unsupported payment provider channel_kind');
  }
  return channelKind;
}

function normalizeConfigStringMap(value: unknown): Record<string, string> {
  const raw = asObject(value);
  const normalized: Record<string, string> = {};
  for (const [key, item] of Object.entries(raw)) {
    const nextKey = String(key || '').trim();
    if (!nextKey) {
      continue;
    }
    if (typeof item === 'string') {
      normalized[nextKey] = item.trim();
      continue;
    }
    if (typeof item === 'number' || typeof item === 'boolean') {
      normalized[nextKey] = String(item);
    }
  }
  return normalized;
}

function paymentProviderRequiredFields(
  profile: Pick<PaymentProviderProfileRecord, 'provider' | 'channelKind' | 'config' | 'secretPayloadEncrypted'>,
): string[] {
  if (profile.provider !== 'wechat_qr' || profile.channelKind !== 'wechat_service_provider') {
    return [];
  }
  const configValues = normalizeConfigStringMap(profile.config);
  const secretValues = decryptInstallSecretPayload(profile.secretPayloadEncrypted);
  const missing: string[] = [];
  for (const key of PAYMENT_PROVIDER_REQUIRED_CONFIG_FIELDS) {
    if (!configValues[key]?.trim()) {
      missing.push(key);
    }
  }
  for (const key of PAYMENT_PROVIDER_SECRET_FIELDS) {
    if (!secretValues[key]?.trim()) {
      missing.push(key);
    }
  }
  return missing;
}

function toAdminPaymentProviderProfileView(record: PaymentProviderProfileRecord): AdminPaymentProviderProfileView {
  const missingFields = paymentProviderRequiredFields(record);
  return {
    id: record.id,
    provider: record.provider,
    scope_type: record.scopeType,
    scope_key: record.scopeKey,
    channel_kind: record.channelKind,
    display_name: record.displayName,
    enabled: record.enabled,
    config: record.config,
    configured_secret_keys: record.configuredSecretKeys,
    completeness_status: missingFields.length === 0 ? 'configured' : 'missing',
    missing_fields: missingFields,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function toAdminPaymentProviderBindingView(record: PaymentProviderBindingRecord): AdminPaymentProviderBindingView {
  return {
    app_name: record.appName,
    provider: record.provider,
    mode: record.mode,
    active_profile_id: record.activeProfileId,
    updated_at: record.updatedAt,
  };
}

function mergePaymentProviderSecretValues(
  existingProfile: PaymentProviderProfileRecord | null,
  inputSecretValues: Record<string, unknown> | undefined,
): {secretValues: Record<string, string>; configuredSecretKeys: string[]} {
  const merged = decryptInstallSecretPayload(existingProfile?.secretPayloadEncrypted);
  const normalizedInput = asObject(inputSecretValues);
  for (const key of PAYMENT_PROVIDER_SECRET_FIELDS) {
    const nextValue = normalizedInput[key];
    if (typeof nextValue === 'string' && nextValue.trim()) {
      merged[key] = nextValue.trim();
    }
  }
  return {
    secretValues: merged,
    configuredSecretKeys: PAYMENT_PROVIDER_SECRET_FIELDS.filter((key) => Boolean(merged[key]?.trim())),
  };
}

function normalizePaymentProviderConfigValues(value: unknown): Record<string, string> {
  const normalized = normalizeConfigStringMap(value);
  const next: Record<string, string> = {};
  for (const [key, item] of Object.entries(normalized)) {
    if (!key.trim()) {
      continue;
    }
    next[key] = item.trim();
  }
  return next;
}

type ResolvedPaymentGatewayConfigState = {
  provider: 'epay';
  source: AdminPaymentGatewayConfigSource;
  scopeType: 'platform' | 'app';
  scopeKey: string;
  configValues: {
    partner_id: string;
    gateway: string;
  };
  secretValues: Record<string, string>;
  configuredSecretKeys: string[];
  updatedAt: string | null;
};

function normalizeEpayGatewayConfigValues(value: unknown): {partner_id: string; gateway: string} {
  const normalized = normalizeConfigStringMap(value);
  return {
    partner_id: String(normalized.partner_id || '').trim(),
    gateway: String(normalized.gateway || '').trim(),
  };
}

function resolveEpayGatewayMissingFields(state: Pick<ResolvedPaymentGatewayConfigState, 'configValues' | 'secretValues'>): string[] {
  const missing: string[] = [];
  for (const key of EPAY_GATEWAY_CONFIG_FIELDS) {
    if (!String(state.configValues[key] || '').trim()) {
      missing.push(key);
    }
  }
  for (const key of EPAY_GATEWAY_SECRET_FIELDS) {
    if (!String(state.secretValues[key] || '').trim()) {
      missing.push(key);
    }
  }
  return missing;
}

function toAdminPaymentGatewayConfigView(state: ResolvedPaymentGatewayConfigState): AdminPaymentGatewayConfigView {
  const missingFields = resolveEpayGatewayMissingFields(state);
  return {
    provider: state.provider,
    source: state.source,
    scope_type: state.scopeType,
    scope_key: state.scopeKey,
    config: {
      partner_id: state.configValues.partner_id,
      gateway: state.configValues.gateway,
    },
    secret_values: {
      key: String(state.secretValues.key || '').trim(),
    },
    configured_secret_keys: state.configuredSecretKeys,
    completeness_status: missingFields.length === 0 ? 'configured' : 'missing',
    missing_fields: missingFields,
    updated_at: state.updatedAt,
  };
}

type ResolvedPaymentProviderProfile = {
  scopeType: PaymentProviderScopeType;
  profile: PaymentProviderProfileRecord;
  missingFields: string[];
};

function slugifyUsername(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return base || 'user';
}

function isRealEmail(email: string): boolean {
  return !email.endsWith('@oauth.local');
}

function toWorkspaceBackupView(record: {
  identityMd: string;
  userMd: string;
  soulMd: string;
  agentsMd: string;
  createdAt: string;
  updatedAt: string;
}): WorkspaceBackupView {
  return {
    identity_md: record.identityMd,
    user_md: record.userMd,
    soul_md: record.soulMd,
    agents_md: record.agentsMd,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function requireWorkspaceMarkdown(input: unknown, field: string): string {
  if (typeof input !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a string`);
  }
  if (!input.trim()) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} is required`);
  }
  return input;
}

function normalizeSkillSlug(value: string | undefined): string {
  const normalized = (value || '').trim();
  if (!normalized) {
    throw new HttpError(400, 'BAD_REQUEST', 'skill slug is required');
  }
  return normalized;
}

function normalizeMcpKey(value: string | undefined): string {
  const normalized = (value || '').trim();
  if (!normalized) {
    throw new HttpError(400, 'BAD_REQUEST', 'mcp key is required');
  }
  return normalized;
}

function normalizeOptionalSkillVersion(value: string | undefined): string | undefined {
  const normalized = (value || '').trim();
  return normalized || undefined;
}

function normalizeSkillEnabled(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new HttpError(400, 'BAD_REQUEST', 'enabled must be a boolean');
  }
  return value;
}

function normalizeSkillDistribution(value: unknown, fallback?: 'cloud'): 'cloud' {
  if (value === undefined) {
    if (fallback) return fallback;
    throw new HttpError(400, 'BAD_REQUEST', 'distribution is required');
  }
  if (value === 'cloud') {
    return 'cloud';
  }
  throw new HttpError(400, 'BAD_REQUEST', 'distribution must be cloud');
}

function normalizeSkillOriginType(
  value: unknown,
  fallback: 'clawhub' | 'github_repo' | 'manual' | 'private' = 'manual',
): 'clawhub' | 'github_repo' | 'manual' | 'private' {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (value === 'clawhub' || value === 'github_repo' || value === 'manual' || value === 'private') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'origin_type must be clawhub, github_repo, manual, or private');
}

function normalizeOptionalCatalogString(
  value: unknown,
  field: string,
  options: {allowNull?: boolean; trimToNull?: boolean} = {},
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    if (options.allowNull) return null;
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a string`);
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized) {
    return options.trimToNull ? null : '';
  }
  return normalized;
}

function normalizeSkillTags(value: unknown, fallback?: string[]): string[] {
  if (value === undefined) {
    return fallback ? [...fallback] : [];
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'tags must be an array of strings');
  }
  const deduped = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new HttpError(400, 'BAD_REQUEST', 'tags must be an array of strings');
    }
    const normalized = item.trim();
    if (!normalized) continue;
    deduped.add(normalized);
  }
  return Array.from(deduped);
}

function normalizeOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a boolean`);
  }
  return value;
}

function normalizeDesktopActionPolicyScope(
  value: unknown,
  fallback?: DesktopActionPolicyScope,
): DesktopActionPolicyScope {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const resolved = (normalized || fallback || '') as DesktopActionPolicyScope;
  if (!DESKTOP_ACTION_POLICY_SCOPES.has(resolved)) {
    throw new HttpError(400, 'BAD_REQUEST', 'scope must be platform, oem, or org');
  }
  return resolved;
}

function normalizeDesktopActionPolicyEffect(
  value: unknown,
  fallback?: DesktopActionPolicyEffect,
): DesktopActionPolicyEffect {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const resolved = (normalized || fallback || '') as DesktopActionPolicyEffect;
  if (!DESKTOP_ACTION_POLICY_EFFECTS.has(resolved)) {
    throw new HttpError(400, 'BAD_REQUEST', 'effect must be allow, allow_with_approval, or deny');
  }
  return resolved;
}

function normalizeDesktopActionRiskLevel(
  value: unknown,
  fallback?: DesktopActionRiskLevel,
): DesktopActionRiskLevel {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const resolved = (normalized || fallback || '') as DesktopActionRiskLevel;
  if (!DESKTOP_ACTION_RISK_LEVELS.has(resolved)) {
    throw new HttpError(400, 'BAD_REQUEST', 'risk_level must be low, medium, high, or critical');
  }
  return resolved;
}

function normalizeDesktopActionGrantScope(
  value: unknown,
  fallback?: DesktopActionGrantScope,
): DesktopActionGrantScope {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const resolved = (normalized || fallback || '') as DesktopActionGrantScope;
  if (!DESKTOP_ACTION_GRANT_SCOPES.has(resolved)) {
    throw new HttpError(400, 'BAD_REQUEST', 'grant_scope must be once, task, session, or ttl');
  }
  return resolved;
}

function normalizeDesktopActionAuditDecision(
  value: unknown,
  fallback?: DesktopActionAuditDecision,
): DesktopActionAuditDecision {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const resolved = (normalized || fallback || '') as DesktopActionAuditDecision;
  if (!DESKTOP_ACTION_AUDIT_DECISIONS.has(resolved)) {
    throw new HttpError(400, 'BAD_REQUEST', 'decision must be allow, deny, or pending');
  }
  return resolved;
}

function normalizeDesktopActionAuditStage(
  value: unknown,
  fallback?: DesktopActionAuditStage,
): DesktopActionAuditStage {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const resolved = (normalized || fallback || '') as DesktopActionAuditStage;
  if (!DESKTOP_ACTION_AUDIT_STAGES.has(resolved)) {
    throw new HttpError(400, 'BAD_REQUEST', 'stage is invalid');
  }
  return resolved;
}

function normalizeDesktopDiagnosticUploadSourceType(
  value: unknown,
  fallback?: DesktopDiagnosticUploadSourceType,
): DesktopDiagnosticUploadSourceType {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const resolved = (normalized || fallback || '') as DesktopDiagnosticUploadSourceType;
  if (!DESKTOP_DIAGNOSTIC_UPLOAD_SOURCE_TYPES.has(resolved)) {
    throw new HttpError(400, 'BAD_REQUEST', 'source_type must be manual, auto_error_capture, or approval_flow');
  }
  return resolved;
}

function normalizeDesktopFaultReportEntry(
  value: unknown,
  fallback?: DesktopFaultReportEntry,
): DesktopFaultReportEntry {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const resolved = (normalized || fallback || '') as DesktopFaultReportEntry;
  if (!DESKTOP_FAULT_REPORT_ENTRIES.has(resolved)) {
    throw new HttpError(400, 'BAD_REQUEST', 'entry must be installer or exception-dialog');
  }
  return resolved;
}

function normalizeDesktopFaultReportAccountState(
  value: unknown,
  fallback?: DesktopFaultReportAccountState,
): DesktopFaultReportAccountState {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const resolved = (normalized || fallback || '') as DesktopFaultReportAccountState;
  if (!DESKTOP_FAULT_REPORT_ACCOUNT_STATES.has(resolved)) {
    throw new HttpError(400, 'BAD_REQUEST', 'account_state must be anonymous or authenticated');
  }
  return resolved;
}

function normalizeClientMetricEventResult(
  value: unknown,
  fallback?: ClientMetricEventResult | null,
): ClientMetricEventResult | null {
  if (value === undefined || value === null || value === '') {
    return fallback ?? null;
  }
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const resolved = normalized as ClientMetricEventResult;
  if (!CLIENT_METRIC_EVENT_RESULTS.has(resolved)) {
    throw new HttpError(400, 'BAD_REQUEST', 'result must be success or failed');
  }
  return resolved;
}

function normalizeClientCrashType(value: unknown, fallback?: ClientCrashType): ClientCrashType {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const resolved = (normalized || fallback || '') as ClientCrashType;
  if (!CLIENT_CRASH_TYPES.has(resolved)) {
    throw new HttpError(400, 'BAD_REQUEST', 'crash_type must be native, renderer, or sidecar');
  }
  return resolved;
}

function normalizeClientPerfMetricName(value: unknown, fallback?: ClientPerfMetricName): ClientPerfMetricName {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const resolved = (normalized || fallback || '') as ClientPerfMetricName;
  if (!CLIENT_PERF_METRIC_NAMES.has(resolved)) {
    throw new HttpError(
      400,
      'BAD_REQUEST',
      'metric_name must be cold_start_ms, warm_start_ms, page_load_ms, api_latency_ms, memory_mb, or cpu_percent',
    );
  }
  return resolved;
}

function normalizeStringArray(value: unknown, field: string, fallback: string[] = []): string[] {
  if (value === undefined) {
    return [...fallback];
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be an array of strings`);
  }
  const deduped = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new HttpError(400, 'BAD_REQUEST', `${field} must be an array of strings`);
    }
    const normalized = item.trim();
    if (!normalized) continue;
    deduped.add(normalized);
  }
  return Array.from(deduped);
}

function normalizeIntegerArray(value: unknown, field: string, fallback: number[] = []): number[] {
  if (value === undefined) {
    return [...fallback];
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be an array of integers`);
  }
  const deduped = new Set<number>();
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      throw new HttpError(400, 'BAD_REQUEST', `${field} must be an array of integers`);
    }
    const normalized = Math.floor(item);
    if (normalized < 0) {
      throw new HttpError(400, 'BAD_REQUEST', `${field} must contain non-negative integers`);
    }
    deduped.add(normalized);
  }
  return Array.from(deduped);
}

function normalizeDesktopActionAccessModeArray(
  value: unknown,
  field: string,
  fallback: DesktopActionAccessMode[] = [],
): DesktopActionAccessMode[] {
  if (value === undefined) {
    return [...fallback];
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be an array of access modes`);
  }
  const deduped = new Set<DesktopActionAccessMode>();
  for (const item of value) {
    const normalized = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (!DESKTOP_ACTION_ACCESS_MODES.has(normalized as DesktopActionAccessMode)) {
      throw new HttpError(400, 'BAD_REQUEST', `${field} contains invalid access mode`);
    }
    deduped.add(normalized as DesktopActionAccessMode);
  }
  return Array.from(deduped);
}

function normalizeDesktopActionExecutorType(
  value: unknown,
  field: string,
  fallback?: DesktopActionExecutorType,
): DesktopActionExecutorType {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const resolved = (normalized || fallback || '') as DesktopActionExecutorType;
  if (!DESKTOP_ACTION_EXECUTOR_TYPES.has(resolved)) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} is invalid`);
  }
  return resolved;
}

function normalizeDesktopActionExecutorTypeArray(
  value: unknown,
  field: string,
  fallback: DesktopActionExecutorType[] = [],
): DesktopActionExecutorType[] {
  if (value === undefined) {
    return [...fallback];
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be an array of executor types`);
  }
  const deduped = new Set<DesktopActionExecutorType>();
  for (const item of value) {
    deduped.add(normalizeDesktopActionExecutorType(item, field));
  }
  return Array.from(deduped);
}

function normalizeDesktopActionNetworkDestinations(
  value: unknown,
  field: string,
  fallback: DesktopActionNetworkDestination[] = [],
): DesktopActionNetworkDestination[] {
  if (value === undefined) {
    return fallback.map((item) => ({...item}));
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be an array`);
  }
  const deduped = new Map<string, DesktopActionNetworkDestination>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(400, 'BAD_REQUEST', `${field} must contain objects`);
    }
    const record = item as Record<string, unknown>;
    const scheme = normalizeOptionalCatalogString(record.scheme, `${field}.scheme`)?.toLowerCase() || '';
    const host = normalizeOptionalCatalogString(record.host, `${field}.host`)?.toLowerCase() || '';
    const pathPrefixValue = normalizeOptionalCatalogString(
      record.pathPrefix ?? record.path_prefix,
      `${field}.pathPrefix`,
      {
        allowNull: true,
        trimToNull: true,
      },
    );
    const pathPrefix: string | null = pathPrefixValue ?? null;
    const redirectPolicy =
      normalizeOptionalCatalogString(record.redirectPolicy ?? record.redirect_policy, `${field}.redirectPolicy`, {
        allowNull: true,
        trimToNull: true,
      })?.toLowerCase() || 'none';
    const port =
      normalizeOptionalIntegerField(record.port, `${field}.port`, {min: 1, allowNull: true}) ?? null;
    if (!scheme || !host) {
      throw new HttpError(400, 'BAD_REQUEST', `${field} requires scheme and host`);
    }
    if (!['none', 'same-origin-only', 'allowlisted'].includes(redirectPolicy)) {
      throw new HttpError(400, 'BAD_REQUEST', `${field}.redirectPolicy is invalid`);
    }
    const normalized: DesktopActionNetworkDestination = {
      scheme,
      host,
      port,
      pathPrefix,
      redirectPolicy: redirectPolicy as DesktopActionNetworkDestination['redirectPolicy'],
    };
    deduped.set(JSON.stringify(normalized), normalized);
  }
  return Array.from(deduped.values());
}

function normalizeRecordArray(
  value: unknown,
  field: string,
  fallback: Array<Record<string, unknown>> = [],
): Array<Record<string, unknown>> {
  if (value === undefined) {
    return fallback.map((item) => ({...item}));
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be an array`);
  }
  return value.map((item) => normalizeJsonObject(item, field));
}

function resolveDesktopActionRiskClass(riskLevel: DesktopActionRiskLevel): DesktopActionRiskClass {
  switch (riskLevel) {
    case 'low':
      return 'L1';
    case 'medium':
      return 'L2';
    case 'high':
      return 'L3';
    case 'critical':
      return 'L4';
  }
}

function clampDesktopActionGrantScope(
  scope: DesktopActionGrantScope,
  capability: string,
  riskLevel: DesktopActionRiskLevel,
): DesktopActionGrantScope {
  const normalizedCapability = capability.trim().toLowerCase();
  const riskClass = resolveDesktopActionRiskClass(riskLevel);
  if (riskClass === 'L4') {
    return 'once';
  }
  if (riskClass === 'L3') {
    return 'once';
  }
  if (normalizedCapability === 'elevated_execute') {
    return 'once';
  }
  return scope;
}

function validateDesktopPolicyInvariant(input: {
  capability: string;
  effect: DesktopActionPolicyEffect;
  riskLevel: DesktopActionRiskLevel;
  grantScope: DesktopActionGrantScope;
  maxGrantScope: DesktopActionGrantScope;
  officialOnly: boolean;
  publisherIds: string[];
  packageDigests: string[];
  executorTemplateIds: string[];
}): void {
  const capability = input.capability.trim().toLowerCase();
  if ((capability === 'execute_shell' || capability === 'elevated_execute') && input.effect === 'allow') {
    throw new HttpError(400, 'BAD_REQUEST', `${capability} cannot use effect=allow`);
  }
  if (capability === 'elevated_execute' && (input.grantScope !== 'once' || input.maxGrantScope !== 'once')) {
    throw new HttpError(400, 'BAD_REQUEST', 'elevated_execute must use once-only grants');
  }
  if (resolveDesktopActionRiskClass(input.riskLevel) === 'L4' && input.effect === 'allow') {
    throw new HttpError(400, 'BAD_REQUEST', 'L4 actions cannot be auto-allowed');
  }
  if (input.effect === 'allow' && input.executorTemplateIds.length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'effect=allow requires executor_template_ids');
  }
  if (input.officialOnly && input.publisherIds.length === 0 && input.packageDigests.length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'official_only requires publisher_ids or package_digests');
  }
}

function normalizeOptionalIntegerField(
  value: unknown,
  field: string,
  options: {min?: number; allowNull?: boolean} = {},
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    if (options.allowNull) {
      return null;
    }
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be an integer`);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be an integer`);
  }
  const normalized = Math.floor(value);
  if (typeof options.min === 'number' && normalized < options.min) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be >= ${options.min}`);
  }
  return normalized;
}

function normalizeJsonObject(value: unknown, field: string, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  if (value === undefined) {
    return {...fallback};
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function normalizeExtensionInstallTarget(value: unknown): ExtensionInstallTarget {
  if (value === 'skill' || value === 'mcp') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'extension_type must be skill or mcp');
}

function readCompactCatalogMetric(metadata: Record<string, unknown>, candidatePaths: string[][]): number | null {
  for (const path of candidatePaths) {
    let current: unknown = metadata;
    for (const segment of path) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        current = null;
        break;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    if (typeof current === 'number' && Number.isFinite(current) && current >= 0) {
      return Math.round(current);
    }
    if (typeof current === 'string' && /^\d+(\.\d+)?$/.test(current.trim())) {
      return Math.round(Number(current));
    }
  }
  return null;
}

function compactSkillCatalogMetadata(
  metadata: Record<string, unknown>,
  options: {includeSourceKind?: boolean} = {},
): Record<string, unknown> {
  const compact: Record<string, unknown> = {};
  const downloads = readCompactCatalogMetric(metadata, [
    ['downloads'],
    ['download_count'],
    ['downloadCount'],
    ['install_count'],
    ['installCount'],
    ['installs'],
    ['stats', 'downloads'],
    ['stats', 'download_count'],
    ['stats', 'downloadCount'],
    ['clawhub', 'listing', 'skill', 'stats', 'downloads'],
    ['clawhub', 'listing', 'skill', 'stats', 'download_count'],
    ['clawhub', 'listing', 'skill', 'stats', 'downloadCount'],
    ['clawhub', 'detail', 'skill', 'stats', 'downloads'],
    ['clawhub', 'detail', 'skill', 'stats', 'download_count'],
    ['clawhub', 'detail', 'skill', 'stats', 'downloadCount'],
  ]);
  if (downloads != null) {
    compact.stats = {downloads};
  }
  for (const key of ['source_label', 'sourceLabel', 'provider', 'requires_api_key', 'requiresApiKey']) {
    if (metadata[key] !== undefined) {
      compact[key] = metadata[key];
    }
  }
  if (Array.isArray(metadata.required_env)) {
    compact.required_env = metadata.required_env;
  } else if (Array.isArray(metadata.requiredEnv)) {
    compact.requiredEnv = metadata.requiredEnv;
  }
  if (metadata.setup_schema && typeof metadata.setup_schema === 'object') {
    compact.setup_schema = metadata.setup_schema;
  } else if (metadata.setupSchema && typeof metadata.setupSchema === 'object') {
    compact.setupSchema = metadata.setupSchema;
  }
  if (options.includeSourceKind && typeof metadata.source_kind === 'string' && metadata.source_kind.trim()) {
    compact.source_kind = metadata.source_kind.trim();
  }
  return compact;
}

type ExtensionSetupFieldType = 'secret' | 'text' | 'textarea' | 'number' | 'select' | 'boolean';
type ExtensionSetupFieldOption = {
  label: string;
  value: string;
};
type ExtensionSetupField = {
  key: string;
  label: string;
  type: ExtensionSetupFieldType;
  required: boolean;
  placeholder?: string | null;
  helpText?: string | null;
  injectAs?: string | null;
  options?: ExtensionSetupFieldOption[];
};
type ExtensionSetupSchema = {
  version: number;
  fields: ExtensionSetupField[];
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function titleizeSetupFieldKey(value: string): string {
  return value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => (part.length <= 3 && /^[A-Z0-9]+$/.test(part) ? part : `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`))
    .join(' ');
}

function normalizeExtensionSetupField(value: unknown): ExtensionSetupField | null {
  const raw = asObject(value);
  const key = typeof raw.key === 'string' ? raw.key.trim() : '';
  if (!key) {
    return null;
  }
  const rawType = typeof raw.type === 'string' ? raw.type.trim().toLowerCase() : '';
  const type: ExtensionSetupFieldType =
    rawType === 'secret' ||
    rawType === 'textarea' ||
    rawType === 'number' ||
    rawType === 'select' ||
    rawType === 'boolean'
      ? rawType
      : 'text';
  const options =
    type === 'select'
      ? (Array.isArray(raw.options) ? raw.options : [])
          .map((item) => {
            const option = asObject(item);
            const optionValue = typeof option.value === 'string' ? option.value.trim() : '';
            if (!optionValue) return null;
            const optionLabel = typeof option.label === 'string' && option.label.trim() ? option.label.trim() : optionValue;
            return {label: optionLabel, value: optionValue};
          })
          .filter((item): item is ExtensionSetupFieldOption => Boolean(item))
      : undefined;
  return {
    key,
    label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : titleizeSetupFieldKey(key),
    type,
    required: raw.required !== false,
    placeholder: typeof raw.placeholder === 'string' ? raw.placeholder : null,
    helpText:
      typeof raw.help_text === 'string'
        ? raw.help_text
        : typeof raw.helpText === 'string'
          ? raw.helpText
          : null,
    injectAs:
      typeof raw.inject_as === 'string'
        ? raw.inject_as.trim() || null
        : typeof raw.injectAs === 'string'
          ? raw.injectAs.trim() || null
          : null,
    options,
  };
}

function normalizeExtensionSetupSchema(value: unknown): ExtensionSetupSchema | null {
  const raw = asObject(value);
  const fields = (Array.isArray(raw.fields) ? raw.fields : [])
    .map(normalizeExtensionSetupField)
    .filter((item): item is ExtensionSetupField => Boolean(item));
  if (fields.length === 0) {
    return null;
  }
  const version =
    typeof raw.version === 'number' && Number.isFinite(raw.version) && raw.version > 0
      ? Math.floor(raw.version)
      : 1;
  return {version, fields};
}

function isLikelySecretEnvKey(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith('UV_') || normalized === 'PORT' || normalized === 'NODE_ENV') {
    return false;
  }
  return ['KEY', 'TOKEN', 'SECRET', 'COOKIE', 'PASSWORD'].some((part) => normalized.includes(part));
}

function inferExtensionSetupSchema(
  metadata: Record<string, unknown>,
  configValues: Record<string, unknown> = {},
): ExtensionSetupSchema | null {
  const explicit =
    normalizeExtensionSetupSchema(metadata.setup_schema) ||
    normalizeExtensionSetupSchema(metadata.setupSchema) ||
    normalizeExtensionSetupSchema(configValues.setup_schema) ||
    normalizeExtensionSetupSchema(configValues.setupSchema);
  if (explicit) {
    return explicit;
  }

  const envKeys = new Set<string>();
  for (const key of [
    ...asStringArray(metadata.required_env),
    ...asStringArray(metadata.requiredEnv),
    ...asStringArray(configValues.required_env),
    ...asStringArray(configValues.requiredEnv),
  ]) {
    envKeys.add(key);
  }
  for (const key of Object.keys(asObject(configValues.env))) {
    if (isLikelySecretEnvKey(key)) {
      envKeys.add(key);
    }
  }

  if (envKeys.size === 0) {
    return null;
  }

  return {
    version: 1,
    fields: Array.from(envKeys).map((key) => ({
      key,
      label: titleizeSetupFieldKey(key),
      type: 'secret',
      required: true,
      injectAs: key,
    })),
  };
}

function normalizeSetupValueByField(field: ExtensionSetupField, value: unknown): unknown {
  if (value == null) {
    return value;
  }
  switch (field.type) {
    case 'boolean':
      return typeof value === 'boolean' ? value : String(value).trim().toLowerCase() === 'true';
    case 'number': {
      const numeric = typeof value === 'number' ? value : Number(String(value).trim());
      if (!Number.isFinite(numeric)) {
        throw new HttpError(400, 'BAD_REQUEST', `${field.label} 必须是数字`);
      }
      return numeric;
    }
    default:
      return typeof value === 'string' ? value.trim() : String(value).trim();
  }
}

function hasRequiredSetupValue(field: ExtensionSetupField, configValues: Record<string, unknown>, secretValues: Record<string, string>): boolean {
  if (field.type === 'secret') {
    return Boolean(secretValues[field.key]?.trim());
  }
  const value = configValues[field.key];
  if (typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  return typeof value === 'string' ? value.trim().length > 0 : value != null;
}

function mergeExtensionSetupPayload(
  schema: ExtensionSetupSchema | null,
  inputSetupValues: Record<string, unknown> | undefined,
  inputSecretValues: Record<string, string> | undefined,
  existingRecord: UserExtensionInstallConfigRecord | null,
  options: {requireComplete?: boolean} = {},
): {
  schemaVersion: number | null;
  status: ExtensionSetupStatus;
  setupValues: Record<string, unknown>;
  secretValues: Record<string, string>;
  configuredSecretKeys: string[];
} {
  if (!schema) {
    return {
      schemaVersion: null,
      status: 'not_required',
      setupValues: {},
      secretValues: {},
      configuredSecretKeys: [],
    };
  }

  const existingSecrets = decryptInstallSecretPayload(existingRecord?.secretPayloadEncrypted);
  const mergedSetupValues: Record<string, unknown> = {...(existingRecord?.config || {})};
  const mergedSecretValues: Record<string, string> = {...existingSecrets};
  const normalizedInputSetupValues = asObject(inputSetupValues);
  const normalizedInputSecretValues = asObject(inputSecretValues) as Record<string, unknown>;

  for (const field of schema.fields) {
    if (field.type === 'secret') {
      const nextSecretValue = normalizedInputSecretValues[field.key];
      if (typeof nextSecretValue === 'string' && nextSecretValue.trim()) {
        mergedSecretValues[field.key] = nextSecretValue.trim();
      }
      continue;
    }
    if (field.key in normalizedInputSetupValues) {
      mergedSetupValues[field.key] = normalizeSetupValueByField(field, normalizedInputSetupValues[field.key]);
    }
  }

  const missingRequiredFields = schema.fields.filter(
    (field) => field.required && !hasRequiredSetupValue(field, mergedSetupValues, mergedSecretValues),
  );
  if (options.requireComplete && missingRequiredFields.length > 0) {
    throw new HttpError(
      400,
      'SETUP_REQUIRED',
      `缺少安装配置：${missingRequiredFields.map((field) => field.label).join('、')}`,
    );
  }

  return {
    schemaVersion: schema.version,
    status: missingRequiredFields.length > 0 ? 'missing' : 'configured',
    setupValues: mergedSetupValues,
    secretValues: mergedSecretValues,
    configuredSecretKeys: Object.keys(mergedSecretValues).filter((key) => mergedSecretValues[key]?.trim()),
  };
}

function resolveExtensionSetupState(
  schema: ExtensionSetupSchema | null,
  configRecord: UserExtensionInstallConfigRecord | null,
): {
  setupStatus: ExtensionSetupStatus;
  setupSchemaVersion: number | null;
  setupUpdatedAt: string | null;
} {
  if (!schema) {
    return {
      setupStatus: 'not_required',
      setupSchemaVersion: null,
      setupUpdatedAt: null,
    };
  }
  return {
    setupStatus: configRecord?.status || 'missing',
    setupSchemaVersion: configRecord?.schemaVersion ?? schema.version,
    setupUpdatedAt: configRecord?.updatedAt ?? null,
  };
}

function toSkillCatalogEntryView(
  record: SkillCatalogEntryRecord,
  baseUrl?: string,
  source: SkillSource = 'cloud',
): SkillCatalogEntryView {
  const artifactUrl =
    record.artifactUrl ||
    (shouldServeCloudSkillViaControlPlane(record)
      ? buildCloudSkillArtifactProxyUrl(record.slug, baseUrl)
      : null);
  return {
    slug: record.slug,
    name: record.name,
    description: record.description,
    market: record.market,
    category: record.category,
    skill_type: record.skillType,
    publisher: record.publisher,
    distribution: record.distribution,
    source,
    tags: record.tags,
    version: record.version,
    artifact_url: artifactUrl,
    artifact_path: null,
    artifact_format: record.artifactFormat,
    artifact_sha256: record.artifactSha256,
    origin_type: record.originType,
    source_url: record.sourceUrl,
    metadata: compactSkillCatalogMetadata(record.metadata),
  };
}

function toUserSkillLibraryItemView(record: {
  slug: string;
  version: string;
  source?: UserSkillLibrarySource;
  enabled: boolean;
  setupStatus?: ExtensionSetupStatus;
  setupSchemaVersion?: number | null;
  setupUpdatedAt?: string | null;
  installedAt: string;
  updatedAt: string;
}): UserSkillLibraryItemView {
  return {
    slug: record.slug,
    version: record.version,
    source: record.source || 'cloud',
    enabled: record.enabled,
    setup_status: record.setupStatus || 'not_required',
    setup_schema_version: record.setupSchemaVersion ?? null,
    setup_updated_at: record.setupUpdatedAt ?? null,
    installed_at: record.installedAt,
    updated_at: record.updatedAt,
  };
}

function toMcpCatalogEntryView(
  record: McpCatalogEntryRecord,
  options: {defaultInstalled?: boolean} = {},
): McpCatalogEntryView {
  return {
    mcp_key: record.mcpKey,
    name: record.name,
    description: record.description,
    transport: record.transport,
    source: 'cloud',
    default_installed: options.defaultInstalled === true,
    object_key: record.objectKey,
    config: record.config,
    metadata: record.metadata,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function toUserMcpLibraryItemView(record: {
  mcpKey: string;
  source?: 'cloud';
  enabled: boolean;
  setupStatus?: ExtensionSetupStatus;
  setupSchemaVersion?: number | null;
  setupUpdatedAt?: string | null;
  installedAt: string;
  updatedAt: string;
}): UserMcpLibraryItemView {
  return {
    mcp_key: record.mcpKey,
    source: record.source || 'cloud',
    enabled: record.enabled,
    setup_status: record.setupStatus || 'not_required',
    setup_schema_version: record.setupSchemaVersion ?? null,
    setup_updated_at: record.setupUpdatedAt ?? null,
    installed_at: record.installedAt,
    updated_at: record.updatedAt,
  };
}

function toUserExtensionInstallConfigView(record: UserExtensionInstallConfigRecord): UserExtensionInstallConfigView {
  return {
    extension_type: record.extensionType,
    extension_key: record.extensionKey,
    schema_version: record.schemaVersion,
    status: record.status,
    config_values: record.config,
    configured_secret_keys: record.configuredSecretKeys,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function toAdminSkillCatalogEntryView(record: SkillCatalogEntryRecord, baseUrl?: string): AdminSkillCatalogEntryView {
  return {
    ...toSkillCatalogEntryView(record, baseUrl),
    active: record.active,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function toSkillSyncSourceView(record: {
  id: string;
  sourceType: string;
  sourceKey: string;
  displayName: string;
  sourceUrl: string;
  config: Record<string, unknown>;
  active: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}): SkillSyncSourceView {
  return {
    id: record.id,
    source_type: record.sourceType as SkillSyncSourceView['source_type'],
    source_key: record.sourceKey,
    display_name: record.displayName,
    source_url: record.sourceUrl,
    config: record.config,
    active: record.active,
    last_run_at: record.lastRunAt,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function toSkillSyncRunView(record: {
  id: string;
  sourceId: string;
  sourceKey: string;
  sourceType: string;
  displayName: string;
  status: string;
  summary: Record<string, unknown>;
  items: Array<{slug: string; name: string; version: string | null; status: string; reason: string | null; sourceUrl: string | null}>;
  startedAt: string;
  finishedAt: string | null;
}): SkillSyncRunView {
  return {
    id: record.id,
    source_id: record.sourceId,
    source_key: record.sourceKey,
    source_type: record.sourceType as SkillSyncRunView['source_type'],
    display_name: record.displayName,
    status: record.status as SkillSyncRunView['status'],
    summary: record.summary,
    items: record.items.map((item) => ({
      slug: item.slug,
      name: item.name,
      version: item.version,
      status: item.status as SkillSyncRunView['items'][number]['status'],
      reason: item.reason,
      source_url: item.sourceUrl,
    })),
    started_at: record.startedAt,
    finished_at: record.finishedAt,
  };
}

function toAgentCatalogEntryView(record: AgentCatalogEntryRecord): AgentCatalogEntryView {
  return {
    slug: record.slug,
    name: record.name,
    description: record.description,
    category: record.category,
    publisher: record.publisher,
    featured: record.featured,
    official: record.official,
    tags: record.tags,
    capabilities: record.capabilities,
    use_cases: record.useCases,
    metadata: record.metadata,
  };
}

function toAdminAgentCatalogEntryView(record: AgentCatalogEntryRecord): AdminAgentCatalogEntryView {
  return {
    ...toAgentCatalogEntryView(record),
    sort_order: record.sortOrder,
    active: record.active,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function readMetadataStringArray(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeAgentCategory(value: unknown, fallback?: AgentCategory): AgentCategory {
  const normalized = String(value || fallback || '').trim();
  if (
    normalized === 'finance' ||
    normalized === 'content' ||
    normalized === 'productivity' ||
    normalized === 'commerce' ||
    normalized === 'general'
  ) {
    return normalized;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'category must be finance, content, productivity, commerce or general');
}

function normalizeCatalogStringArray(value: unknown, fallback: string[] = []): string[] {
  const items = Array.isArray(value) ? value : fallback;
  const seen = new Set<string>();
  for (const item of items) {
    if (typeof item !== 'string') {
      continue;
    }
    const normalized = item.trim();
    if (!normalized) {
      continue;
    }
    seen.add(normalized);
  }
  return Array.from(seen);
}

function normalizeOptionalInteger(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a finite number`);
  }
  return Math.floor(value);
}

function normalizeUserFileKind(value: unknown, fallback = 'generic'): string {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', 'kind must be a string');
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(normalized)) {
    throw new HttpError(400, 'BAD_REQUEST', 'kind must match [a-z0-9_-] and be 1-48 chars');
  }
  return normalized;
}

function normalizeUserFileSource(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', 'source must be a string');
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > 80) {
    throw new HttpError(400, 'BAD_REQUEST', 'source must be 80 chars or fewer');
  }
  return normalized;
}

function normalizeUserFileTaskId(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', 'task_id must be a string');
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > 120) {
    throw new HttpError(400, 'BAD_REQUEST', 'task_id must be 120 chars or fewer');
  }
  return normalized;
}

function toUserAgentLibraryItemView(record: {
  slug: string;
  installedAt: string;
  updatedAt: string;
}): UserAgentLibraryItemView {
  return {
    slug: record.slug,
    installed_at: record.installedAt,
    updated_at: record.updatedAt,
  };
}

function parseAvatarDataBase64(input: string, contentType: string): Buffer {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new HttpError(400, 'BAD_REQUEST', 'avatar_data_base64 is required');
  }

  const dataUrlMatch = trimmed.match(/^data:([^;,]+);base64,(.+)$/);
  if (dataUrlMatch) {
    if (dataUrlMatch[1].trim().toLowerCase() !== contentType.toLowerCase()) {
      throw new HttpError(400, 'BAD_REQUEST', 'avatar content type does not match payload');
    }
    return Buffer.from(dataUrlMatch[2], 'base64');
  }

  return Buffer.from(trimmed, 'base64');
}

function parseRequiredBase64(input: unknown, field: string): Buffer {
  if (typeof input !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a base64 string`);
  }
  const trimmed = input.trim();
  if (!trimmed) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} is required`);
  }
  try {
    return Buffer.from(trimmed, 'base64');
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be valid base64`);
  }
}

function normalizePrivateSkillSourceKind(value: unknown): 'github' | 'local' {
  if (value === 'github' || value === 'local') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'source_kind must be github or local');
}

function normalizeArtifactFormat(value: unknown): 'tar.gz' | 'zip' {
  if (value === 'tar.gz' || value === 'zip') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'artifact_format must be tar.gz or zip');
}

function toPrivateSkillCatalogEntryView(record: UserPrivateSkillRecord, baseUrl?: string): SkillCatalogEntryView {
  const origin = (baseUrl || '').trim().replace(/\/$/, '');
  const artifactUrl = origin
    ? `${origin}/skills/private-artifact?slug=${encodeURIComponent(record.slug)}&version=${encodeURIComponent(record.version)}`
    : null;
  return {
    slug: record.slug,
    name: record.name,
    description: record.description,
    market: record.market,
    category: record.category,
    skill_type: record.skillType,
    publisher: record.publisher,
    distribution: 'cloud',
    source: 'private',
    tags: record.tags,
    version: record.version,
    artifact_url: artifactUrl,
    artifact_path: null,
    artifact_format: record.artifactFormat,
    artifact_sha256: record.artifactSha256,
    origin_type: 'private',
    source_url: record.sourceUrl,
    metadata: compactSkillCatalogMetadata({source_kind: record.sourceKind}, {includeSourceKind: true}),
  };
}

export class ControlPlaneService {
  private readonly store: ControlPlaneStore;
  private readonly resolveBillingMultiplierForModel: (
    appName: string | null,
    model: string | null,
  ) => Promise<number>;

  constructor(
    store: ControlPlaneStore,
    options: {
      resolveBillingMultiplierForModel?: (appName: string | null, model: string | null) => Promise<number>;
    } = {},
  ) {
    this.store = store;
    this.resolveBillingMultiplierForModel = options.resolveBillingMultiplierForModel || (async () => 1);
  }

  private resolvePaymentGatewayStateKey(scopeType: 'platform' | 'app', scopeKey: string): string {
    return scopeType === 'platform' ? EPAY_PAYMENT_GATEWAY_STATE_KEY : `${EPAY_PAYMENT_GATEWAY_STATE_KEY}:app:${scopeKey}`;
  }

  private async resolvePaymentGatewayConfigState(
    scopeType: 'platform' | 'app' = 'platform',
    scopeKey = 'platform',
  ): Promise<ResolvedPaymentGatewayConfigState> {
    const normalizedScopeKey =
      scopeType === 'platform'
        ? 'platform'
        : String(scopeKey || '')
            .trim()
            .toLowerCase();
    const persisted = await this.store.getSystemState(this.resolvePaymentGatewayStateKey(scopeType, normalizedScopeKey));
    if (persisted) {
      const persistedObject = asObject(persisted);
      const configValues = normalizeEpayGatewayConfigValues(persistedObject.config_values);
      const configuredSecretKeys = asStringArray(persistedObject.configured_secret_keys).filter((key) =>
        EPAY_GATEWAY_SECRET_FIELDS.includes(key as (typeof EPAY_GATEWAY_SECRET_FIELDS)[number]),
      );
      const secretValues = decryptInstallSecretPayload(
        typeof persistedObject.secret_payload_encrypted === 'string' ? persistedObject.secret_payload_encrypted : null,
      );
      return {
        provider: 'epay',
        source: 'admin',
        scopeType,
        scopeKey: normalizedScopeKey,
        configValues,
        secretValues,
        configuredSecretKeys,
        updatedAt: String(persistedObject.updated_at || '').trim() || null,
      };
    }

    if (scopeType === 'app') {
      const platformState = await this.resolvePaymentGatewayConfigState('platform', 'platform');
      return {
        ...platformState,
        source: platformState.source === 'admin' ? 'platform_inherited' : platformState.source,
        scopeType: 'app',
        scopeKey: normalizedScopeKey,
      };
    }

    const envConfigValues = {
      partner_id: String(config.epayPartnerId || '').trim(),
      gateway: String(config.epayGateway || '').trim(),
    };
    const envSecretValues = {
      key: String(config.epayKey || '').trim(),
    };
    const hasEnvValues = Boolean(
      envConfigValues.partner_id ||
        envConfigValues.gateway ||
        envSecretValues.key,
    );
    return {
      provider: 'epay',
      source: hasEnvValues ? 'env_fallback' : 'unset',
      scopeType: 'platform',
      scopeKey: 'platform',
      configValues: envConfigValues,
      secretValues: envSecretValues,
      configuredSecretKeys: envSecretValues.key ? ['key'] : [],
      updatedAt: null,
    };
  }

  private async resolveEpayService(appName: string | null = null): Promise<{
    gateway: ResolvedPaymentGatewayConfigState;
    service: EpayService;
  }> {
    const normalizedAppName = String(appName || '').trim().toLowerCase();
    const gateway = normalizedAppName
      ? await this.resolvePaymentGatewayConfigState('app', normalizedAppName)
      : await this.resolvePaymentGatewayConfigState('platform', 'platform');
    return {
      gateway,
      service: new EpayService({
        partnerId: gateway.configValues.partner_id,
        key: String(gateway.secretValues.key || '').trim(),
        gateway: gateway.configValues.gateway,
      }),
    };
  }

  async register(input: RegisterInput): Promise<{tokens: AuthTokens; user: PublicUser}> {
    const username = normalizeUsername(input.username);
    const email = normalizeIdentifier(input.email, 'email');
    const password = input.password.trim();
    const name = (input.name || input.username || '').trim();

    if (
      username.length < 3 ||
      username.length > 32 ||
      !/^[\p{L}\p{N}][\p{L}\p{N}_.-]*(?: [\p{L}\p{N}_.-]+)*$/u.test(username)
    ) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'username must be 3-32 chars and may contain letters, numbers, spaces, dot, underscore, hyphen',
      );
    }
    if (!email.includes('@')) {
      throw new HttpError(400, 'BAD_REQUEST', 'email is invalid');
    }
    if (password.length < 8) {
      throw new HttpError(400, 'BAD_REQUEST', 'password must be at least 8 characters');
    }
    if (!name) {
      throw new HttpError(400, 'BAD_REQUEST', 'name is required');
    }

    try {
      const user = await this.store.createUser({
        username,
        email,
        displayName: name,
        passwordHash: hashPassword(password),
        role: this.resolveBootstrapRole(email) || 'user',
        initialCreditBalance: config.defaultCreditBalance,
      });
      const tokens = await this.issueTokens(user.id);
      return {
        tokens: tokens.payload,
        user: toPublicUser(user),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'USERNAME_TAKEN') {
        throw new HttpError(409, 'USERNAME_TAKEN', 'username already exists');
      }
      if (error instanceof Error && error.message === 'EMAIL_TAKEN') {
        throw new HttpError(409, 'EMAIL_TAKEN', 'email already exists');
      }
      if (typeof error === 'object' && error && 'code' in error) {
        const code = String((error as {code?: string}).code);
        const detail = String((error as {detail?: string}).detail || '');
        if (code === '23505' && detail.includes('(username)')) {
          throw new HttpError(409, 'USERNAME_TAKEN', 'username already exists');
        }
        if (code === '23505' && detail.includes('(email)')) {
          throw new HttpError(409, 'EMAIL_TAKEN', 'email already exists');
        }
      }
      throw error;
    }
  }

  async login(input: LoginInput): Promise<{tokens: AuthTokens; user: PublicUser}> {
    const identifier = normalizeIdentifier(input.identifier, 'identifier');
    const password = (input.password ?? input.credential ?? '').trim();
    if (!password) {
      throw new HttpError(400, 'BAD_REQUEST', 'password is required');
    }
    const existingUser = await this.store.getUserByIdentifier(identifier);
    if (!existingUser || !existingUser.passwordHash || !verifyPassword(password, existingUser.passwordHash)) {
      throw new HttpError(401, 'UNAUTHORIZED', 'invalid credentials');
    }
    const user = await this.ensureBootstrapRole(existingUser);

    const tokens = await this.issueTokens(user.id);
    return {
      tokens: tokens.payload,
      user: toPublicUser(user),
    };
  }

  async oauthLogin(provider: OAuthProvider, code: string): Promise<{tokens: AuthTokens; user: PublicUser}> {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      throw new HttpError(400, 'BAD_REQUEST', 'oauth code is required');
    }

    const profile = await loadOAuthUserProfile(provider, normalizedCode);
    let user = await this.store.getUserByOAuthAccount(provider, profile.providerId);

    if (!user && profile.email && isRealEmail(profile.email)) {
      user = await this.store.getUserByEmail(profile.email);
    }

    if (!user) {
      user = await this.createOAuthUser(profile);
    }

    user = await this.ensureBootstrapRole(user);

    await this.store.linkOAuthAccount(user.id, provider, profile.providerId);
    const tokens = await this.issueTokens(user.id, 'oauth');
    return {
      tokens: tokens.payload,
      user: toPublicUser(user),
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const normalized = refreshToken.trim();
    if (!normalized) {
      throw new HttpError(400, 'BAD_REQUEST', 'refresh_token is required');
    }

    const session = await this.store.getSessionByRefreshToken(hashOpaqueToken(normalized));
    const now = Date.now();
    if (
      !session ||
      session.refreshTokenExpiresAt <= now ||
      this.getAbsoluteSessionExpiresAt(session.createdAt) <= now
    ) {
      throw new HttpError(401, 'UNAUTHORIZED', 'refresh token is invalid or expired');
    }

    return (await this.rotateTokens(normalized, session.createdAt)).payload;
  }

  async me(accessToken: string): Promise<PublicUser> {
    const user = await this.getUserForAccessToken(accessToken);
    return toPublicUser(user);
  }

  async updateProfile(accessToken: string, input: UpdateProfileInput): Promise<PublicUser> {
    const user = await this.getUserForAccessToken(accessToken);
    const nextName = input.name?.trim();
    const hasNameUpdate = input.name !== undefined;
    const hasAvatarUpload = Boolean(input.avatar_data_base64?.trim());
    const shouldRemoveAvatar = Boolean(input.remove_avatar);

    if (!hasNameUpdate && !hasAvatarUpload && !shouldRemoveAvatar) {
      throw new HttpError(400, 'BAD_REQUEST', 'no profile changes provided');
    }

    if (hasNameUpdate && !nextName) {
      throw new HttpError(400, 'BAD_REQUEST', 'name is required');
    }

    let nextAvatarUrl: string | null | undefined;
    let uploadedAvatarKey: string | undefined;

    if (hasAvatarUpload) {
      const contentType = (input.avatar_content_type || '').trim().toLowerCase();
      if (!contentType) {
        throw new HttpError(400, 'BAD_REQUEST', 'avatar_content_type is required');
      }
      const avatarBuffer = parseAvatarDataBase64(input.avatar_data_base64 || '', contentType);
      const upload = await uploadAvatar(user.id, avatarBuffer, contentType, input.avatar_filename);
      nextAvatarUrl = upload.url;
      uploadedAvatarKey = upload.key;
    } else if (shouldRemoveAvatar) {
      nextAvatarUrl = null;
    }

    const updated = await this.store.updateUserProfile(user.id, {
      displayName: nextName,
      avatarUrl: nextAvatarUrl,
    });
    if (!updated) {
      throw new HttpError(404, 'NOT_FOUND', 'user not found');
    }

    const oldAvatarKey = extractAvatarKey(user.avatarUrl);
    if (uploadedAvatarKey) {
      await deleteOldAvatars(user.id, uploadedAvatarKey);
    } else if (shouldRemoveAvatar && oldAvatarKey) {
      await deleteAvatarByKey(oldAvatarKey);
    }

    return toPublicUser(updated);
  }

  async changePassword(accessToken: string, input: ChangePasswordInput): Promise<{message: string}> {
    const user = await this.getUserForAccessToken(accessToken);
    const nextPassword = input.new_password.trim();
    if (nextPassword.length < 8) {
      throw new HttpError(400, 'BAD_REQUEST', 'new password must be at least 8 characters');
    }

    if (user.passwordHash) {
      const currentPassword = (input.current_password || '').trim();
      if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
        throw new HttpError(401, 'UNAUTHORIZED', 'current password is invalid');
      }
    }

    const updated = await this.store.setPasswordHash(user.id, hashPassword(nextPassword));
    if (!updated) {
      throw new HttpError(404, 'NOT_FOUND', 'user not found');
    }

    return {
      message: 'password updated',
    };
  }

  async linkedAccounts(accessToken: string): Promise<{items: Array<{provider: string; provider_id: string; created_at: string}>}> {
    const user = await this.getUserForAccessToken(accessToken);
    const accounts = await this.store.getOAuthAccountsForUser(user.id);
    return {
      items: accounts.map((item) => ({
        provider: item.provider,
        provider_id: item.providerId,
        created_at: item.createdAt,
      })),
    };
  }

  async unlinkOAuthAccount(accessToken: string, provider: OAuthProvider): Promise<{message: string}> {
    const user = await this.getUserForAccessToken(accessToken);
    const accounts = await this.store.getOAuthAccountsForUser(user.id);
    const hasPassword = Boolean(user.passwordHash);
    const otherAccounts = accounts.filter((item) => item.provider !== provider);

    if (!hasPassword && otherAccounts.length === 0) {
      throw new HttpError(400, 'LAST_LOGIN_METHOD', 'at least one login method must remain');
    }

    const removed = await this.store.unlinkOAuthAccount(user.id, provider);
    if (!removed) {
      throw new HttpError(404, 'NOT_FOUND', 'linked account not found');
    }

    return {
      message: `${provider} account unlinked`,
    };
  }

  async creditsMe(accessToken: string): Promise<CreditBalanceView> {
    const user = await this.getUserForAccessToken(accessToken);
    const account = await this.store.getCreditAccount(user.id);
    return {
      daily_free_balance: account.dailyFreeBalance,
      topup_balance: account.topupBalance,
      total_available_balance: account.totalAvailableBalance,
      daily_free_quota: account.dailyFreeQuota,
      daily_free_expires_at: account.dailyFreeExpiresAt,
      balance: account.totalAvailableBalance,
      currency: 'lobster_credit',
      currency_display: '龙虾币',
      available_balance: account.totalAvailableBalance,
      status: 'active',
    };
  }

  async creditsLedger(accessToken: string): Promise<{items: CreditLedgerItemView[]}> {
    const user = await this.getUserForAccessToken(accessToken);
    return {
      items: (await this.store.getCreditLedger(user.id)).map((item) => toCreditLedgerItemView(item)),
    };
  }

  async creditsQuote(accessToken: string, input: CreditQuoteInput): Promise<CreditQuoteView> {
    const user = await this.getUserForAccessToken(accessToken);
    const message = (input.message || '').trim();
    const attachments = Array.isArray(input.attachments) ? input.attachments : [];
    const hasSearch = Boolean(input.has_search);
    const hasTools = Boolean(input.has_tools);
    const historyMessages = Math.max(0, Math.min(48, input.history_messages || 0));
    const normalizedModel = (input.model || '').trim() || null;
    const normalizedAppName = (input.app_name || '').trim() || null;
    const account = await this.store.getCreditAccount(user.id);

    if (!message && attachments.length === 0) {
      return {
        currency: 'lobster_credit',
        currency_display: '龙虾币',
        estimated_credits_low: 0,
        estimated_credits_high: 0,
        max_charge_credits: 0,
        estimated_input_tokens: 0,
        estimated_output_tokens: 0,
        daily_free_cover_credits: 0,
        topup_cover_credits: 0,
        payable_credits: 0,
        balance_after_estimate: account.totalAvailableBalance,
        balance_after_max: account.totalAvailableBalance,
        model: normalizedModel,
      };
    }

    const estimatedInputTokens = this.estimateQuoteInputTokens({
      message,
      historyMessages,
      attachments,
      hasSearch,
      hasTools,
    });
    const outputEstimate = this.estimateQuoteOutputTokens({
      message,
      historyMessages,
      attachmentCount: attachments.length,
      hasSearch,
      hasTools,
    });
    const billingMultiplier = await this.resolveBillingMultiplier(normalizedAppName, normalizedModel);
    const lowCost = this.computeBilledCreditCost(estimatedInputTokens, outputEstimate.low, billingMultiplier);
    const highCost = Math.max(
      lowCost,
      this.computeBilledCreditCost(estimatedInputTokens, outputEstimate.high, billingMultiplier),
    );
    const maxChargeCredits = Math.max(
      highCost,
      this.computeBilledCreditCost(estimatedInputTokens, outputEstimate.max, billingMultiplier),
    );

    return {
      currency: 'lobster_credit',
      currency_display: '龙虾币',
      estimated_credits_low: lowCost,
      estimated_credits_high: highCost,
      max_charge_credits: maxChargeCredits,
      estimated_input_tokens: estimatedInputTokens,
      estimated_output_tokens: outputEstimate.high,
      daily_free_cover_credits: Math.min(account.dailyFreeBalance, highCost),
      topup_cover_credits: Math.min(account.topupBalance, Math.max(0, highCost - account.dailyFreeBalance)),
      payable_credits: Math.max(0, highCost - account.totalAvailableBalance),
      balance_after_estimate: Math.max(0, account.totalAvailableBalance - highCost),
      balance_after_max: Math.max(0, account.totalAvailableBalance - maxChargeCredits),
      model: normalizedModel,
    };
  }

  async createPaymentOrder(
    accessToken: string,
    input: CreatePaymentOrderInput,
    options?: {publicBaseUrl?: string},
  ): Promise<PaymentOrderView> {
    const user = await this.getUserForAccessToken(accessToken);
    const provider = normalizePaymentProvider(input.provider, 'wechat_qr');
    const packageId = (input.package_id || '').trim();
    const appName = (input.app_name || '').trim();
    const appVersion = (input.app_version || '').trim();
    const releaseChannel = (input.release_channel || '').trim();
    const platform = (input.platform || '').trim();
    const arch = (input.arch || '').trim();
    const userAgent = (input.user_agent || '').trim();
    const packageConfig = await this.store.resolveRechargePackage(packageId, appName || null);
    if (!packageConfig) {
      throw new HttpError(400, 'BAD_REQUEST', 'invalid package_id');
    }
    const rechargePaymentMethods = await this.store.resolveRechargePaymentMethods(appName || null);
    const resolvedRechargePaymentMethod = rechargePaymentMethods.find((item) => item.provider === provider && item.enabled) || null;
    if ((provider === 'wechat_qr' || provider === 'alipay_qr') && !resolvedRechargePaymentMethod) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        appName
          ? `当前 OEM 未启用 ${paymentProviderLabel(provider)}，请先在 admin-web 配置支付方式`
          : `${paymentProviderLabel(provider)} 当前不可用`,
      );
    }
    const {gateway: paymentGatewayConfig, service: epayService} = await this.resolveEpayService(appName || null);
    const paymentProfileResolution = await this.resolvePaymentProviderProfileForOrder(provider, appName || null);
    if ((provider === 'wechat_qr' || provider === 'alipay_qr') && !epayService.isEnabled()) {
      throw new HttpError(
        503,
        'SERVICE_UNAVAILABLE',
        appName
          ? '支付通道未配置，请先在 admin-web 的支付中心为当前 OEM 或平台填写 partner_id / key / gateway'
          : '支付通道未配置，请先在 admin-web 的平台支付网关中填写 partner_id / key / gateway',
      );
    }
    const orderId = randomUUID();
    const checkout =
      epayService.isEnabled() && (provider === 'wechat_qr' || provider === 'alipay_qr')
        ? epayService.createCheckout({
            orderId,
            provider,
            packageName: packageConfig.packageName,
            amountCnyFen: packageConfig.amountCnyFen,
            publicBaseUrl: options?.publicBaseUrl || resolvePublicApiBaseUrl(),
            returnUrl: (input.return_url || '').trim(),
          })
        : null;
    const order = await this.store.createPaymentOrder(user.id, {
      order_id: orderId,
      provider,
      package_id: packageId,
      return_url: (input.return_url || '').trim(),
      app_name: appName,
      app_version: appVersion,
      release_channel: releaseChannel,
      platform,
      arch,
      user_agent: userAgent,
      payment_url: checkout?.paymentUrl || null,
      metadata: {
        ...paymentProfileResolution.metadata,
        ...(checkout?.metadata || {}),
        recharge_source_layer: packageConfig.sourceLayer,
        recharge_payment_method_source_layer: resolvedRechargePaymentMethod?.sourceLayer || null,
        payment_gateway_source: paymentGatewayConfig.source,
      },
      packageName: packageConfig.packageName,
      credits: packageConfig.credits,
      bonusCredits: packageConfig.bonusCredits,
      amountCnyFen: packageConfig.amountCnyFen,
    });
    return toPaymentOrderView(order);
  }

  async getPaymentOrder(accessToken: string, orderIdInput: string): Promise<PaymentOrderView> {
    const user = await this.getUserForAccessToken(accessToken);
    const orderId = orderIdInput.trim();
    if (!orderId) {
      throw new HttpError(400, 'BAD_REQUEST', 'order_id is required');
    }
    let order = await this.store.getPaymentOrderById(user.id, orderId);
    if (!order) {
      throw new HttpError(404, 'NOT_FOUND', 'payment order not found');
    }
    if (
      order.status === 'pending' &&
      (order.provider === 'wechat_qr' || order.provider === 'alipay_qr')
    ) {
      try {
        const {service: epayService} = await this.resolveEpayService();
        const queried = await epayService.queryOrder(order.id);
        if (queried && queried.status !== 'pending') {
          const reconciled = await this.store.applyPaymentWebhook(order.provider, {
            event_id: `epay_query:${queried.providerOrderId || queried.orderId}:${queried.status}`,
            order_id: queried.orderId,
            provider_order_id: queried.providerOrderId || '',
            status: queried.status,
            paid_at: queried.paidAt || '',
          });
          if (reconciled) {
            order = reconciled;
          }
        }
      } catch (error) {
        logWarn('epay order query reconciliation failed', {
          orderId: order.id,
          provider: order.provider,
          error: error instanceof Error ? error.message : String(error || 'unknown error'),
        });
      }
    }
    return toPaymentOrderView(order);
  }

  async applyPaymentWebhook(providerInput: string, input: PaymentWebhookInput): Promise<PaymentOrderView> {
    const provider = normalizePaymentProvider(providerInput, 'mock');
    const eventId = (input.event_id || '').trim();
    const orderId = (input.order_id || '').trim();
    const status = (input.status || '').trim().toLowerCase();
    if (!eventId || !orderId || !status) {
      throw new HttpError(400, 'BAD_REQUEST', 'event_id, order_id and status are required');
    }
    if (!SUPPORTED_PAYMENT_WEBHOOK_STATUSES.has(status as PaymentOrderRecord['status'])) {
      throw new HttpError(400, 'BAD_REQUEST', 'unsupported payment status');
    }
    const order = await this.store.applyPaymentWebhook(provider, {
      event_id: eventId,
      order_id: orderId,
      provider_order_id: (input.provider_order_id || '').trim(),
      status,
      paid_at: (input.paid_at || '').trim(),
    });
    if (!order) {
      throw new HttpError(404, 'NOT_FOUND', 'payment order not found');
    }
    return toPaymentOrderView(order);
  }

  async applyEpayWebhook(input: Record<string, unknown>): Promise<PaymentOrderView> {
    const orderId = String(input.out_trade_no || '').trim();
    if (!orderId) {
      throw new HttpError(400, 'BAD_REQUEST', 'invalid epay webhook payload');
    }
    const adminOrder = await this.store.getPaymentOrderAdmin(orderId);
    if (!adminOrder) {
      throw new HttpError(404, 'NOT_FOUND', 'payment order not found');
    }
    const {service: epayService} = await this.resolveEpayService(adminOrder.appName || null);
    const webhook = epayService.parseWebhook(input);
    const order = await this.store.applyPaymentWebhook(adminOrder.provider, {
      event_id: webhook.eventId,
      order_id: webhook.orderId,
      provider_order_id: webhook.providerOrderId,
      status: webhook.status,
      paid_at: webhook.paidAt || '',
    });
    if (!order) {
      throw new HttpError(404, 'NOT_FOUND', 'payment order not found');
    }
    return toPaymentOrderView(order);
  }

  async listAdminPaymentOrders(
    accessToken: string,
    input: {
      limit?: number | null;
      status?: string | null;
      provider?: string | null;
      app_name?: string | null;
      query?: string | null;
    },
  ): Promise<{items: AdminPaymentOrderSummaryView[]}> {
    await this.requireAdminUser(accessToken);
    const items = await this.store.listPaymentOrdersAdmin({
      limit: input.limit,
      status: input.status,
      provider: input.provider,
      appName: input.app_name,
      query: input.query,
    });
    return {
      items: items.map((item) => toAdminPaymentOrderSummaryView(item)),
    };
  }

  async getAdminPaymentGatewayConfig(
    accessToken: string,
    input?: {scope_type?: string | null; scope_key?: string | null},
  ): Promise<AdminPaymentGatewayConfigView> {
    await this.requireAdminUser(accessToken);
    const scopeType = normalizePaymentProviderScopeType(input?.scope_type || undefined, 'platform');
    const scopeKey =
      scopeType === 'platform'
        ? 'platform'
        : String(input?.scope_key || '')
            .trim()
            .toLowerCase();
    if (scopeType === 'app' && !scopeKey) {
      throw new HttpError(400, 'BAD_REQUEST', 'scope_key is required');
    }
    return toAdminPaymentGatewayConfigView(await this.resolvePaymentGatewayConfigState(scopeType, scopeKey));
  }

  async upsertAdminPaymentGatewayConfig(
    accessToken: string,
    input: UpsertAdminPaymentGatewayConfigInput,
  ): Promise<AdminPaymentGatewayConfigView> {
    await this.requireAdminUser(accessToken);
    const provider = String(input.provider || 'epay').trim().toLowerCase();
    if (provider !== 'epay') {
      throw new HttpError(400, 'BAD_REQUEST', 'unsupported payment gateway provider');
    }
    const scopeType = normalizePaymentProviderScopeType(input.scope_type, 'platform');
    const scopeKey =
      scopeType === 'platform'
        ? 'platform'
        : String(input.scope_key || '')
            .trim()
            .toLowerCase();
    const mode = normalizePaymentGatewayMode(input.mode || undefined, scopeType === 'app' ? 'use_app_config' : 'use_app_config');
    if (scopeType === 'app' && !scopeKey) {
      throw new HttpError(400, 'BAD_REQUEST', 'scope_key is required');
    }
    if (scopeType === 'platform' && mode === 'inherit_platform') {
      throw new HttpError(400, 'BAD_REQUEST', 'platform payment gateway cannot inherit another scope');
    }
    if (scopeType === 'app' && mode === 'inherit_platform') {
      await this.store.deleteSystemState(this.resolvePaymentGatewayStateKey(scopeType, scopeKey));
      return toAdminPaymentGatewayConfigView(await this.resolvePaymentGatewayConfigState(scopeType, scopeKey));
    }
    const normalizedConfigValues = normalizeConfigStringMap(input.config_values);
    const normalizedSecretValues = asObject(input.secret_values);
    const nextSecretValues: Record<string, string> = {};
    for (const key of EPAY_GATEWAY_SECRET_FIELDS) {
      const rawValue = normalizedSecretValues[key];
      nextSecretValues[key] = typeof rawValue === 'string' ? rawValue.trim() : '';
    }
    const nextState = {
      provider: 'epay',
      config_values: {
        partner_id: String(normalizedConfigValues.partner_id || '').trim(),
        gateway: String(normalizedConfigValues.gateway || '').trim(),
      },
      configured_secret_keys: EPAY_GATEWAY_SECRET_FIELDS.filter((key) => Boolean(nextSecretValues[key])),
      secret_payload_encrypted: encryptInstallSecretPayload(nextSecretValues),
      updated_at: new Date().toISOString(),
    };
    await this.store.setSystemState(this.resolvePaymentGatewayStateKey(scopeType, scopeKey), nextState);
    return toAdminPaymentGatewayConfigView(await this.resolvePaymentGatewayConfigState(scopeType, scopeKey));
  }

  async listAdminPaymentProviderProfiles(
    accessToken: string,
    input?: {provider?: string | null},
  ): Promise<{items: AdminPaymentProviderProfileView[]}> {
    await this.requireAdminUser(accessToken);
    const provider = input?.provider ? normalizePaymentProvider(input.provider, 'wechat_qr') : null;
    const items = await this.store.listPaymentProviderProfiles({provider});
    return {
      items: items.map((item) => toAdminPaymentProviderProfileView(item)),
    };
  }

  async upsertAdminPaymentProviderProfile(
    accessToken: string,
    input: UpsertAdminPaymentProviderProfileInput,
  ): Promise<AdminPaymentProviderProfileView> {
    await this.requireAdminUser(accessToken);
    const provider = normalizePaymentProvider(input.provider, 'wechat_qr');
    const scopeType = normalizePaymentProviderScopeType(input.scope_type, 'platform');
    const scopeKey =
      scopeType === 'platform'
        ? 'platform'
        : String(input.scope_key || '')
            .trim()
            .toLowerCase();
    if (!scopeKey) {
      throw new HttpError(400, 'BAD_REQUEST', 'scope_key is required');
    }
    const existing =
      (input.id ? await this.store.getPaymentProviderProfileById(String(input.id).trim()) : null) ||
      (await this.store.getPaymentProviderProfileByScope(provider, scopeType, scopeKey));
    const channelKind = normalizePaymentProviderChannelKind(provider, input.channel_kind || existing?.channelKind);
    const displayName =
      String(input.display_name || '').trim() ||
      existing?.displayName ||
      `${scopeType === 'platform' ? '平台默认' : scopeKey} ${paymentProviderLabel(provider)}`;
    const configValues = {
      ...(existing ? normalizePaymentProviderConfigValues(existing.config) : {}),
      ...normalizePaymentProviderConfigValues(input.config_values),
    };
    const mergedSecrets = mergePaymentProviderSecretValues(existing, input.secret_values);
    const record = await this.store.upsertPaymentProviderProfile({
      id: existing?.id || String(input.id || '').trim() || null,
      provider,
      scope_type: scopeType,
      scope_key: scopeKey,
      channel_kind: channelKind,
      display_name: displayName,
      enabled: input.enabled ?? existing?.enabled ?? true,
      config_values: configValues,
      configured_secret_keys: mergedSecrets.configuredSecretKeys,
      secret_payload_encrypted: encryptInstallSecretPayload(mergedSecrets.secretValues),
      secret_values: {},
    });
    return toAdminPaymentProviderProfileView(record);
  }

  async listAdminPaymentProviderBindings(
    accessToken: string,
    input?: {provider?: string | null},
  ): Promise<{items: AdminPaymentProviderBindingView[]}> {
    await this.requireAdminUser(accessToken);
    const provider = input?.provider ? normalizePaymentProvider(input.provider, 'wechat_qr') : null;
    const items = await this.store.listPaymentProviderBindings(provider);
    return {
      items: items.map((item) => toAdminPaymentProviderBindingView(item)),
    };
  }

  async upsertAdminPaymentProviderBinding(
    accessToken: string,
    appNameInput: string,
    input: UpsertAdminPaymentProviderBindingInput,
  ): Promise<AdminPaymentProviderBindingView> {
    await this.requireAdminUser(accessToken);
    const appName = String(appNameInput || '')
      .trim()
      .toLowerCase();
    if (!appName) {
      throw new HttpError(400, 'BAD_REQUEST', 'app_name is required');
    }
    const provider = normalizePaymentProvider(input.provider, 'wechat_qr');
    const mode = normalizePaymentProviderBindingMode(input.mode, 'inherit_platform');
    let activeProfileId = String(input.active_profile_id || '').trim() || null;

    if (mode === 'use_app_profile') {
      const fallbackProfile = await this.store.getPaymentProviderProfileByScope(provider, 'app', appName);
      if (!activeProfileId) {
        activeProfileId = fallbackProfile?.id || null;
      }
      if (!activeProfileId) {
        throw new HttpError(400, 'BAD_REQUEST', 'active_profile_id is required when mode=use_app_profile');
      }
      const activeProfile = await this.store.getPaymentProviderProfileById(activeProfileId);
      if (!activeProfile) {
        throw new HttpError(404, 'NOT_FOUND', 'payment provider profile not found');
      }
      if (activeProfile.provider !== provider || activeProfile.scopeType !== 'app' || activeProfile.scopeKey !== appName) {
        throw new HttpError(400, 'BAD_REQUEST', 'active_profile_id must belong to the current OEM app');
      }
    } else {
      activeProfileId = null;
    }

    const record = await this.store.upsertPaymentProviderBinding(appName, {
      provider,
      mode,
      active_profile_id: activeProfileId,
    });
    return toAdminPaymentProviderBindingView(record);
  }

  async getAdminPaymentOrder(accessToken: string, orderIdInput: string): Promise<AdminPaymentOrderDetailView> {
    await this.requireAdminUser(accessToken);
    const orderId = orderIdInput.trim();
    if (!orderId) {
      throw new HttpError(400, 'BAD_REQUEST', 'order_id is required');
    }
    const item = await this.store.getPaymentOrderAdmin(orderId);
    if (!item) {
      throw new HttpError(404, 'NOT_FOUND', 'payment order not found');
    }
    return toAdminPaymentOrderDetailView(item);
  }

  async markAdminPaymentOrderPaid(
    accessToken: string,
    orderIdInput: string,
    input: AdminMarkPaymentOrderPaidInput,
  ): Promise<AdminPaymentOrderDetailView> {
    const admin = await this.requireAdminUser(accessToken);
    const orderId = orderIdInput.trim();
    if (!orderId) {
      throw new HttpError(400, 'BAD_REQUEST', 'order_id is required');
    }
    const item = await this.store.markPaymentOrderPaidAdmin({
      orderId,
      operatorUserId: admin.id,
      operatorDisplayName: admin.displayName || admin.username,
      providerOrderId: (input.provider_order_id || '').trim() || null,
      paidAt: (input.paid_at || '').trim() || null,
      note: (input.note || '').trim() || null,
    });
    if (!item) {
      throw new HttpError(404, 'NOT_FOUND', 'payment order not found');
    }
    return toAdminPaymentOrderDetailView(item);
  }

  async refundAdminPaymentOrder(
    accessToken: string,
    orderIdInput: string,
    input: AdminRefundPaymentOrderInput,
  ): Promise<AdminPaymentOrderDetailView> {
    const admin = await this.requireAdminUser(accessToken);
    const orderId = orderIdInput.trim();
    if (!orderId) {
      throw new HttpError(400, 'BAD_REQUEST', 'order_id is required');
    }
    try {
      const item = await this.store.refundPaymentOrderAdmin({
        orderId,
        operatorUserId: admin.id,
        operatorDisplayName: admin.displayName || admin.username,
        note: (input.note || '').trim() || null,
      });
      if (!item) {
        throw new HttpError(404, 'NOT_FOUND', 'payment order not found');
      }
      return toAdminPaymentOrderDetailView(item);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'INSUFFICIENT_TOPUP_BALANCE_FOR_REFUND') {
        throw new HttpError(409, 'CONFLICT', 'topup balance is insufficient to refund this order');
      }
      if (error instanceof Error && error.name === 'INVALID_PAYMENT_ORDER_STATUS') {
        throw new HttpError(409, 'CONFLICT', 'only paid orders can be refunded');
      }
      throw error;
    }
  }

  async listAdminDesktopActionPolicies(
    accessToken: string,
    input: {
      scope?: string | null;
      capability?: string | null;
      risk_level?: string | null;
      enabled?: boolean | null;
      query?: string | null;
      limit?: number | null;
    } = {},
  ): Promise<{items: AdminDesktopActionPolicyRuleView[]}> {
    await this.requireAdminUser(accessToken);
    const items = await this.store.listDesktopActionPolicyRules({
      scope: input.scope || null,
      capability: input.capability || null,
      riskLevel: input.risk_level || null,
      enabled: typeof input.enabled === 'boolean' ? input.enabled : null,
      query: input.query || null,
      limit: input.limit,
    });
    return {items: items.map(toAdminDesktopActionPolicyRuleView)};
  }

  async upsertAdminDesktopActionPolicy(
    accessToken: string,
    input: UpsertDesktopActionPolicyRuleInput,
  ): Promise<AdminDesktopActionPolicyRuleView> {
    await this.requireAdminUser(accessToken);
    const existing = input.id ? await this.store.getDesktopActionPolicyRuleById(String(input.id).trim()) : null;
    const id = String(input.id || existing?.id || randomUUID()).trim();
    if (!id) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }

    const nameCandidate = normalizeOptionalCatalogString(input.name, 'name');
    const capabilityCandidate = normalizeOptionalCatalogString(input.capability, 'capability');
    const scopeIdCandidate = normalizeOptionalCatalogString(input.scope_id, 'scope_id', {allowNull: true, trimToNull: true});
    const name = (nameCandidate === undefined ? existing?.name : nameCandidate) || '';
    const capability = ((capabilityCandidate === undefined ? existing?.capability : capabilityCandidate) || '')
      .trim()
      .toLowerCase();
    if (!name.trim()) {
      throw new HttpError(400, 'BAD_REQUEST', 'name is required');
    }
    if (!capability) {
      throw new HttpError(400, 'BAD_REQUEST', 'capability is required');
    }

    const effect = normalizeDesktopActionPolicyEffect(input.effect, existing?.effect || 'allow_with_approval');
    const riskLevel = normalizeDesktopActionRiskLevel(input.risk_level, existing?.riskLevel || 'medium');
    const officialOnly = normalizeOptionalBoolean(input.official_only, 'official_only') ?? existing?.officialOnly ?? false;
    const publisherIds = normalizeStringArray(input.publisher_ids, 'publisher_ids', existing?.publisherIds || []);
    const packageDigests = normalizeStringArray(input.package_digests, 'package_digests', existing?.packageDigests || []);
    const grantScope = normalizeDesktopActionGrantScope(input.grant_scope, existing?.grantScope || 'once');
    const maxGrantScopeRequested = normalizeDesktopActionGrantScope(
      input.max_grant_scope,
      existing?.maxGrantScope || grantScope,
    );
    const clampedGrantScope = clampDesktopActionGrantScope(grantScope, capability, riskLevel);
    const maxGrantScope = clampDesktopActionGrantScope(maxGrantScopeRequested, capability, riskLevel);
    const executorTemplateIds = normalizeStringArray(
      input.executor_template_ids,
      'executor_template_ids',
      existing?.executorTemplateIds || [],
    );

    validateDesktopPolicyInvariant({
      capability,
      effect,
      riskLevel,
      grantScope: clampedGrantScope,
      maxGrantScope,
      officialOnly,
      publisherIds,
      packageDigests,
      executorTemplateIds,
    });

    const record = await this.store.upsertDesktopActionPolicyRule({
      id,
      scope: normalizeDesktopActionPolicyScope(input.scope, existing?.scope || 'platform'),
      scope_id: scopeIdCandidate === undefined ? (existing?.scopeId || null) : scopeIdCandidate,
      name: name.trim(),
      effect,
      capability,
      risk_level: riskLevel,
      official_only: officialOnly,
      publisher_ids: publisherIds,
      package_digests: packageDigests,
      skill_slugs: normalizeStringArray(input.skill_slugs, 'skill_slugs', existing?.skillSlugs || []),
      workflow_ids: normalizeStringArray(input.workflow_ids, 'workflow_ids', existing?.workflowIds || []),
      executor_types: normalizeDesktopActionExecutorTypeArray(
        input.executor_types,
        'executor_types',
        existing?.executorTypes || [],
      ),
      executor_template_ids: executorTemplateIds,
      canonical_path_prefixes: normalizeStringArray(
        input.canonical_path_prefixes,
        'canonical_path_prefixes',
        existing?.canonicalPathPrefixes || [],
      ),
      network_destinations: normalizeDesktopActionNetworkDestinations(
        input.network_destinations,
        'network_destinations',
        existing?.networkDestinations || [],
      ),
      access_modes: normalizeDesktopActionAccessModeArray(input.access_modes, 'access_modes', existing?.accessModes || []),
      allow_elevation:
        normalizeOptionalBoolean(input.allow_elevation, 'allow_elevation') ?? existing?.allowElevation ?? false,
      allow_network_egress:
        normalizeOptionalBoolean(input.allow_network_egress, 'allow_network_egress') ??
        existing?.allowNetworkEgress ??
        false,
      grant_scope: clampedGrantScope,
      max_grant_scope: maxGrantScope,
      ttl_seconds:
        normalizeOptionalIntegerField(input.ttl_seconds, 'ttl_seconds', {min: 1, allowNull: true}) ??
        existing?.ttlSeconds ??
        null,
      enabled: normalizeOptionalBoolean(input.enabled, 'enabled') ?? existing?.enabled ?? true,
      priority: normalizeOptionalIntegerField(input.priority, 'priority', {min: 0}) ?? existing?.priority ?? 100,
    });
    return toAdminDesktopActionPolicyRuleView(record);
  }

  async listAdminDesktopActionApprovalGrants(
    accessToken: string,
    input: {
      user_id?: string | null;
      device_id?: string | null;
      app_name?: string | null;
      capability?: string | null;
      active_only?: boolean | null;
      limit?: number | null;
    } = {},
  ): Promise<{items: AdminDesktopActionApprovalGrantView[]}> {
    await this.requireAdminUser(accessToken);
    const items = await this.store.listDesktopActionApprovalGrants({
      userId: input.user_id || null,
      deviceId: input.device_id || null,
      appName: input.app_name || null,
      capability: input.capability || null,
      activeOnly: typeof input.active_only === 'boolean' ? input.active_only : null,
      limit: input.limit,
    });
    return {items: items.map(toAdminDesktopActionApprovalGrantView)};
  }

  async revokeAdminDesktopActionApprovalGrant(
    accessToken: string,
    idInput: string,
  ): Promise<AdminDesktopActionApprovalGrantView> {
    await this.requireAdminUser(accessToken);
    const id = String(idInput || '').trim();
    if (!id) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }
    const record = await this.store.revokeDesktopActionApprovalGrant(id, new Date().toISOString());
    if (!record) {
      throw new HttpError(404, 'NOT_FOUND', 'desktop action approval grant not found');
    }
    return toAdminDesktopActionApprovalGrantView(record);
  }

  async listAdminDesktopActionAuditEvents(
    accessToken: string,
    input: {
      intent_id?: string | null;
      user_id?: string | null;
      device_id?: string | null;
      app_name?: string | null;
      capability?: string | null;
      risk_level?: string | null;
      decision?: string | null;
      limit?: number | null;
    } = {},
  ): Promise<{items: AdminDesktopActionAuditEventView[]}> {
    await this.requireAdminUser(accessToken);
    const items = await this.store.listDesktopActionAuditEvents({
      intentId: input.intent_id || null,
      userId: input.user_id || null,
      deviceId: input.device_id || null,
      appName: input.app_name || null,
      capability: input.capability || null,
      riskLevel: input.risk_level || null,
      decision: input.decision || null,
      limit: input.limit,
    });
    return {items: items.map(toAdminDesktopActionAuditEventView)};
  }

  async listAdminDesktopDiagnosticUploads(
    accessToken: string,
    input: {
      user_id?: string | null;
      device_id?: string | null;
      app_name?: string | null;
      source_type?: string | null;
      limit?: number | null;
    } = {},
  ): Promise<{items: AdminDesktopDiagnosticUploadView[]}> {
    await this.requireAdminUser(accessToken);
    const items = await this.store.listDesktopDiagnosticUploads({
      userId: input.user_id || null,
      deviceId: input.device_id || null,
      appName: input.app_name || null,
      sourceType: input.source_type || null,
      limit: input.limit,
    });
    return {items: items.map(toAdminDesktopDiagnosticUploadView)};
  }

  async listAdminDesktopFaultReports(
    accessToken: string,
    input: {
      report_id?: string | null;
      user_id?: string | null;
      device_id?: string | null;
      app_name?: string | null;
      platform?: string | null;
      entry?: string | null;
      account_state?: string | null;
      app_version?: string | null;
      limit?: number | null;
    } = {},
  ): Promise<{items: AdminDesktopFaultReportSummaryView[]}> {
    await this.requireAdminUser(accessToken);
    const items = await this.store.listDesktopFaultReports({
      reportId: input.report_id || null,
      userId: input.user_id || null,
      deviceId: input.device_id || null,
      appName: input.app_name || null,
      platform: input.platform || null,
      entry: input.entry || null,
      accountState: input.account_state || null,
      appVersion: input.app_version || null,
      limit: input.limit,
    });
    return {items: items.map(toAdminDesktopFaultReportSummaryView)};
  }

  async getAdminDesktopFaultReport(
    accessToken: string,
    idInput: string,
    baseUrl: string,
  ): Promise<AdminDesktopFaultReportDetailView> {
    await this.requireAdminUser(accessToken);
    const id = String(idInput || '').trim();
    if (!id) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }
    const record = await this.store.getDesktopFaultReportById(id);
    if (!record) {
      throw new HttpError(404, 'NOT_FOUND', 'desktop fault report not found');
    }
    return toAdminDesktopFaultReportDetailView(record, baseUrl);
  }

  async downloadAdminDesktopFaultReport(
    accessToken: string,
    idInput: string,
  ): Promise<{record: DesktopFaultReportRecord; file: {buffer: Buffer; contentType: string}}> {
    await this.requireAdminUser(accessToken);
    const id = String(idInput || '').trim();
    if (!id) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }
    const record = await this.store.getDesktopFaultReportById(id);
    if (!record) {
      throw new HttpError(404, 'NOT_FOUND', 'desktop fault report not found');
    }
    const file = await downloadStoredDesktopFaultReportFile(record.uploadKey);
    return {record, file};
  }

  async listAdminClientMetricEvents(
    accessToken: string,
    input: {
      event_name?: string | null;
      user_id?: string | null;
      device_id?: string | null;
      app_name?: string | null;
      brand_id?: string | null;
      app_version?: string | null;
      platform?: string | null;
      result?: string | null;
      limit?: number | null;
    } = {},
  ): Promise<{items: AdminClientMetricEventView[]}> {
    await this.requireAdminUser(accessToken);
    const items = await this.store.listClientMetricEvents({
      eventName: input.event_name || null,
      userId: input.user_id || null,
      deviceId: input.device_id || null,
      appName: input.app_name || null,
      brandId: input.brand_id || null,
      appVersion: input.app_version || null,
      platform: input.platform || null,
      result: input.result || null,
      limit: input.limit,
    });
    return { items: items.map(toAdminClientMetricEventView) };
  }

  async listAdminClientCrashEvents(
    accessToken: string,
    input: {
      crash_type?: string | null;
      user_id?: string | null;
      device_id?: string | null;
      app_name?: string | null;
      brand_id?: string | null;
      app_version?: string | null;
      platform?: string | null;
      limit?: number | null;
    } = {},
  ): Promise<{items: AdminClientCrashEventView[]}> {
    await this.requireAdminUser(accessToken);
    const items = await this.store.listClientCrashEvents({
      crashType: input.crash_type || null,
      userId: input.user_id || null,
      deviceId: input.device_id || null,
      appName: input.app_name || null,
      brandId: input.brand_id || null,
      appVersion: input.app_version || null,
      platform: input.platform || null,
      limit: input.limit,
    });
    return { items: items.map(toAdminClientCrashEventView) };
  }

  async listAdminClientPerfSamples(
    accessToken: string,
    input: {
      metric_name?: string | null;
      user_id?: string | null;
      device_id?: string | null;
      app_name?: string | null;
      brand_id?: string | null;
      app_version?: string | null;
      platform?: string | null;
      limit?: number | null;
    } = {},
  ): Promise<{items: AdminClientPerfSampleView[]}> {
    await this.requireAdminUser(accessToken);
    const items = await this.store.listClientPerfSamples({
      metricName: input.metric_name || null,
      userId: input.user_id || null,
      deviceId: input.device_id || null,
      appName: input.app_name || null,
      brandId: input.brand_id || null,
      appVersion: input.app_version || null,
      platform: input.platform || null,
      limit: input.limit,
    });
    return { items: items.map(toAdminClientPerfSampleView) };
  }

  async getRuntimeDesktopActionPolicySnapshot(
    accessToken: string,
    appNameInput: string,
  ): Promise<{
    app_name: string;
    fetched_at: string;
    items: AdminDesktopActionPolicyRuleView[];
  }> {
    await this.getUserForAccessToken(accessToken);
    const appName = String(appNameInput || '')
      .trim()
      .toLowerCase();
    if (!appName) {
      throw new HttpError(400, 'BAD_REQUEST', 'app_name is required');
    }
    const items = await this.store.listDesktopActionPolicyRules({enabled: true, limit: 1000});
    const filtered = items.filter((item) => {
      if (item.scope === 'platform') {
        return true;
      }
      return String(item.scopeId || '')
        .trim()
        .toLowerCase() === appName;
    });
    return {
      app_name: appName,
      fetched_at: new Date().toISOString(),
      items: filtered.map(toAdminDesktopActionPolicyRuleView),
    };
  }

  async createDesktopActionApprovalGrant(
    accessToken: string,
    input: CreateDesktopActionApprovalGrantInput,
  ): Promise<AdminDesktopActionApprovalGrantView> {
    const user = await this.getUserForAccessToken(accessToken);
    const deviceId = String(input.device_id || '').trim();
    const appName = String(input.app_name || '')
      .trim()
      .toLowerCase();
    const intentFingerprint = String(input.intent_fingerprint || '').trim();
    const capability = String(input.capability || '')
      .trim()
      .toLowerCase();
    if (!deviceId || !appName || !intentFingerprint || !capability) {
      throw new HttpError(400, 'BAD_REQUEST', 'device_id, app_name, intent_fingerprint, capability are required');
    }
    const approvedPlanHash = String(input.approved_plan_hash || '').trim();
    if (!approvedPlanHash) {
      throw new HttpError(400, 'BAD_REQUEST', 'approved_plan_hash is required');
    }
    const riskLevel = normalizeDesktopActionRiskLevel(input.risk_level, 'medium');
    const scope = clampDesktopActionGrantScope(normalizeDesktopActionGrantScope(input.scope, 'once'), capability, riskLevel);
    const expiresAtInput = normalizeOptionalCatalogString(input.expires_at, 'expires_at', {allowNull: true, trimToNull: true});
    let expiresAt = expiresAtInput === undefined ? null : expiresAtInput;
    if (scope === 'ttl') {
      if (!expiresAt) {
        throw new HttpError(400, 'BAD_REQUEST', 'expires_at is required when scope=ttl');
      }
      if (Number.isNaN(Date.parse(expiresAt))) {
        throw new HttpError(400, 'BAD_REQUEST', 'expires_at must be a valid ISO timestamp');
      }
    } else {
      expiresAt = expiresAt && !Number.isNaN(Date.parse(expiresAt)) ? expiresAt : null;
    }
    const record = await this.store.createDesktopActionApprovalGrant({
      id: randomUUID(),
      user_id: user.id,
      device_id: deviceId,
      app_name: appName,
      intent_fingerprint: intentFingerprint,
      approved_plan_hash: approvedPlanHash,
      capability,
      risk_level: riskLevel,
      access_modes: normalizeDesktopActionAccessModeArray(input.access_modes, 'access_modes', []),
      normalized_resources: normalizeRecordArray(input.normalized_resources, 'normalized_resources', []),
      network_destinations: normalizeDesktopActionNetworkDestinations(
        input.network_destinations,
        'network_destinations',
        [],
      ),
      executor_type: normalizeDesktopActionExecutorType(input.executor_type, 'executor_type', 'template'),
      executor_template_id:
        normalizeOptionalCatalogString(input.executor_template_id, 'executor_template_id', {
          allowNull: true,
          trimToNull: true,
        }) ?? null,
      publisher_id:
        normalizeOptionalCatalogString(input.publisher_id, 'publisher_id', {allowNull: true, trimToNull: true}) ?? null,
      package_digest:
        normalizeOptionalCatalogString(input.package_digest, 'package_digest', {allowNull: true, trimToNull: true}) ?? null,
      scope,
      task_id: normalizeOptionalCatalogString(input.task_id, 'task_id', {allowNull: true, trimToNull: true}) ?? null,
      session_key:
        normalizeOptionalCatalogString(input.session_key, 'session_key', {allowNull: true, trimToNull: true}) ?? null,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });
    return toAdminDesktopActionApprovalGrantView(record);
  }

  async recordDesktopActionAuditEvents(
    accessToken: string,
    input: CreateDesktopActionAuditEventInput | CreateDesktopActionAuditEventInput[],
  ): Promise<{items: AdminDesktopActionAuditEventView[]}> {
    const user = await this.getUserForAccessToken(accessToken);
    const items = Array.isArray(input) ? input : [input];
    if (items.length === 0) {
      return {items: []};
    }
    const records = await this.store.createDesktopActionAuditEvents(
      items.map((item) => {
        const intentId = String(item.intent_id || '').trim();
        const traceId = String(item.trace_id || '').trim();
        const deviceId = String(item.device_id || '').trim();
        const appName = String(item.app_name || '')
          .trim()
          .toLowerCase();
        const capability = String(item.capability || '')
          .trim()
          .toLowerCase();
        const summary = String(item.summary || '').trim();
        if (!intentId || !traceId || !deviceId || !appName || !capability || !summary) {
          throw new HttpError(
            400,
            'BAD_REQUEST',
            'intent_id, trace_id, device_id, app_name, capability, summary are required',
          );
        }
        const createdAt = String(item.created_at || '').trim() || new Date().toISOString();
        if (Number.isNaN(Date.parse(createdAt))) {
          throw new HttpError(400, 'BAD_REQUEST', 'created_at must be a valid ISO timestamp');
        }
        const approvedPlanHash =
          normalizeOptionalCatalogString(item.approved_plan_hash, 'approved_plan_hash', {allowNull: true, trimToNull: true}) ??
          null;
        const executedPlanHash =
          normalizeOptionalCatalogString(item.executed_plan_hash, 'executed_plan_hash', {allowNull: true, trimToNull: true}) ??
          null;
        const stage = normalizeDesktopActionAuditStage(item.stage, 'intent_created');
        if (stage === 'plan_mismatch_denied') {
          if (!approvedPlanHash || !executedPlanHash || approvedPlanHash === executedPlanHash) {
            throw new HttpError(
              400,
              'BAD_REQUEST',
              'plan_mismatch_denied requires different approved_plan_hash and executed_plan_hash',
            );
          }
        }
        return {
          id: String(item.id || randomUUID()).trim() || randomUUID(),
          intent_id: intentId,
          trace_id: traceId,
          user_id: user.id,
          device_id: deviceId,
          app_name: appName,
          agent_id: normalizeOptionalCatalogString(item.agent_id, 'agent_id', {allowNull: true, trimToNull: true}) ?? null,
          skill_slug:
            normalizeOptionalCatalogString(item.skill_slug, 'skill_slug', {allowNull: true, trimToNull: true}) ?? null,
          workflow_id:
            normalizeOptionalCatalogString(item.workflow_id, 'workflow_id', {allowNull: true, trimToNull: true}) ?? null,
          capability,
          risk_level: normalizeDesktopActionRiskLevel(item.risk_level, 'medium'),
          requires_elevation:
            normalizeOptionalBoolean(item.requires_elevation, 'requires_elevation') ?? false,
          decision: normalizeDesktopActionAuditDecision(item.decision, 'pending'),
          stage,
          summary,
          reason: normalizeOptionalCatalogString(item.reason, 'reason', {allowNull: true, trimToNull: true}) ?? null,
          resources: normalizeRecordArray(item.resources, 'resources', []),
          matched_policy_rule_id:
            normalizeOptionalCatalogString(item.matched_policy_rule_id, 'matched_policy_rule_id', {
              allowNull: true,
              trimToNull: true,
            }) ?? null,
          approved_plan_hash: approvedPlanHash,
          executed_plan_hash: executedPlanHash,
          command_snapshot_redacted:
            normalizeOptionalCatalogString(item.command_snapshot_redacted, 'command_snapshot_redacted', {
              allowNull: true,
              trimToNull: true,
            }) ?? null,
          result_code:
            normalizeOptionalCatalogString(item.result_code, 'result_code', {allowNull: true, trimToNull: true}) ??
            null,
          result_summary:
            normalizeOptionalCatalogString(item.result_summary, 'result_summary', {allowNull: true, trimToNull: true}) ??
            null,
          duration_ms: normalizeOptionalIntegerField(item.duration_ms, 'duration_ms', {min: 0, allowNull: true}) ?? null,
          created_at: createdAt,
        };
      }),
    );
    return {items: records.map(toAdminDesktopActionAuditEventView)};
  }

  async recordDesktopDiagnosticUpload(
    accessToken: string,
    input: CreateDesktopDiagnosticUploadInput,
  ): Promise<AdminDesktopDiagnosticUploadView> {
    const user = await this.getUserForAccessToken(accessToken);
    const deviceId = String(input.device_id || '').trim();
    const appName = String(input.app_name || '')
      .trim()
      .toLowerCase();
    const uploadBucket = String(input.upload_bucket || '').trim();
    const uploadKey = String(input.upload_key || '').trim();
    const fileName = String(input.file_name || '').trim();
    if (!deviceId || !appName || !uploadBucket || !uploadKey || !fileName) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'device_id, app_name, upload_bucket, upload_key, file_name are required',
      );
    }
    const fileSizeBytes = normalizeOptionalIntegerField(input.file_size_bytes, 'file_size_bytes', {min: 0});
    if (typeof fileSizeBytes !== 'number') {
      throw new HttpError(400, 'BAD_REQUEST', 'file_size_bytes is required');
    }
    const createdAt = String(input.created_at || '').trim() || new Date().toISOString();
    if (Number.isNaN(Date.parse(createdAt))) {
      throw new HttpError(400, 'BAD_REQUEST', 'created_at must be a valid ISO timestamp');
    }
    const sensitivityLevel =
      (normalizeOptionalCatalogString(input.sensitivity_level, 'sensitivity_level', {
        allowNull: true,
        trimToNull: true,
      })?.toLowerCase() as 'customer' | 'internal' | 'redacted' | undefined) || 'customer';
    if (!DESKTOP_DIAGNOSTIC_SENSITIVITY_LEVELS.has(sensitivityLevel)) {
      throw new HttpError(400, 'BAD_REQUEST', 'sensitivity_level is invalid');
    }
    const record = await this.store.createDesktopDiagnosticUpload({
      id: String(input.id || randomUUID()).trim() || randomUUID(),
      user_id: user.id,
      device_id: deviceId,
      app_name: appName,
      upload_bucket: uploadBucket,
      upload_key: uploadKey,
      file_name: fileName,
      file_size_bytes: fileSizeBytes,
      sha256: normalizeOptionalCatalogString(input.sha256, 'sha256', {allowNull: true, trimToNull: true}) ?? null,
      source_type: normalizeDesktopDiagnosticUploadSourceType(input.source_type, 'manual'),
      contains_customer_logs: normalizeOptionalBoolean(input.contains_customer_logs, 'contains_customer_logs') ?? true,
      sensitivity_level: sensitivityLevel,
      linked_intent_id:
        normalizeOptionalCatalogString(input.linked_intent_id, 'linked_intent_id', {
          allowNull: true,
          trimToNull: true,
        }) ?? null,
      created_at: createdAt,
    });
    return toAdminDesktopDiagnosticUploadView(record);
  }

  async uploadDesktopFaultReport(
    accessToken: string | null,
    input: {
      metadata: CreateDesktopFaultReportInput;
      fileName: string;
      contentType?: string | null;
      content: Buffer;
    },
  ): Promise<AdminDesktopFaultReportDetailView> {
    const user = await this.getOptionalUserForAccessToken(accessToken);
    const reportId =
      normalizeOptionalCatalogString(input.metadata.report_id, 'report_id', {allowNull: true, trimToNull: true}) ||
      `FR-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    const entry = normalizeDesktopFaultReportEntry(input.metadata.entry, 'installer');
    const requestedAccountState = normalizeDesktopFaultReportAccountState(
      input.metadata.account_state,
      user ? 'authenticated' : 'anonymous',
    );
    const accountState = user ? 'authenticated' : requestedAccountState;
    const deviceId = String(input.metadata.device_id || '').trim();
    const appName = String(input.metadata.app_name || '')
      .trim()
      .toLowerCase();
    const brandId = String(input.metadata.brand_id || '')
      .trim()
      .toLowerCase();
    const appVersion = String(input.metadata.app_version || '').trim();
    const platform = String(input.metadata.platform || '')
      .trim()
      .toLowerCase();
    const arch = String(input.metadata.arch || '')
      .trim()
      .toLowerCase();
    const failureStage = String(input.metadata.failure_stage || '').trim();
    const errorTitle = String(input.metadata.error_title || '').trim();
    const errorMessage = String(input.metadata.error_message || '').trim();
    if (!deviceId || !appName || !brandId || !appVersion || !platform || !arch || !failureStage || !errorTitle || !errorMessage) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'device_id, app_name, brand_id, app_version, platform, arch, failure_stage, error_title, error_message are required',
      );
    }
    const upload = await uploadDesktopFaultReportFile({
      reportId,
      fileName: input.fileName,
      contentType: input.contentType,
      content: input.content,
    });
    const createdAt = String(input.metadata.created_at || '').trim() || new Date().toISOString();
    if (Number.isNaN(Date.parse(createdAt))) {
      throw new HttpError(400, 'BAD_REQUEST', 'created_at must be a valid ISO timestamp');
    }
    const installProgressPercent = normalizeOptionalIntegerField(
      input.metadata.install_progress_percent,
      'install_progress_percent',
      {min: 0, allowNull: true},
    );
    if (typeof installProgressPercent === 'number' && installProgressPercent > 100) {
      throw new HttpError(400, 'BAD_REQUEST', 'install_progress_percent must be 100 or smaller');
    }
    const record = await this.store.createDesktopFaultReport({
      id:
        normalizeOptionalCatalogString(input.metadata.id, 'id', {allowNull: true, trimToNull: true}) || randomUUID(),
      report_id: reportId,
      entry,
      account_state: accountState,
      user_id: user?.id || null,
      device_id: deviceId,
      install_session_id:
        normalizeOptionalCatalogString(input.metadata.install_session_id, 'install_session_id', {
          allowNull: true,
          trimToNull: true,
        }) ?? null,
      app_name: appName,
      brand_id: brandId,
      app_version: appVersion,
      release_channel:
        normalizeOptionalCatalogString(input.metadata.release_channel, 'release_channel', {
          allowNull: true,
          trimToNull: true,
        }) ?? null,
      platform,
      platform_version:
        normalizeOptionalCatalogString(input.metadata.platform_version, 'platform_version', {
          allowNull: true,
          trimToNull: true,
        }) ?? null,
      arch,
      failure_stage: failureStage,
      error_title: errorTitle,
      error_message: errorMessage,
      error_code:
        normalizeOptionalCatalogString(input.metadata.error_code, 'error_code', {allowNull: true, trimToNull: true}) ??
        null,
      runtime_found: normalizeOptionalBoolean(input.metadata.runtime_found, 'runtime_found') ?? false,
      runtime_installable: normalizeOptionalBoolean(input.metadata.runtime_installable, 'runtime_installable') ?? false,
      runtime_version:
        normalizeOptionalCatalogString(input.metadata.runtime_version, 'runtime_version', {
          allowNull: true,
          trimToNull: true,
        }) ?? null,
      runtime_path:
        normalizeOptionalCatalogString(input.metadata.runtime_path, 'runtime_path', {
          allowNull: true,
          trimToNull: true,
        }) ?? null,
      work_dir:
        normalizeOptionalCatalogString(input.metadata.work_dir, 'work_dir', {allowNull: true, trimToNull: true}) ??
        null,
      log_dir:
        normalizeOptionalCatalogString(input.metadata.log_dir, 'log_dir', {allowNull: true, trimToNull: true}) ?? null,
      runtime_download_url:
        normalizeOptionalCatalogString(input.metadata.runtime_download_url, 'runtime_download_url', {
          allowNull: true,
          trimToNull: true,
        }) ?? null,
      install_progress_phase:
        normalizeOptionalCatalogString(input.metadata.install_progress_phase, 'install_progress_phase', {
          allowNull: true,
          trimToNull: true,
        }) ?? null,
      install_progress_percent: installProgressPercent ?? null,
      upload_bucket: upload.bucket,
      upload_key: upload.objectKey,
      file_name: upload.originalFileName,
      file_size_bytes: upload.sizeBytes,
      file_sha256: upload.sha256,
      created_at: createdAt,
    });
    return toAdminDesktopFaultReportDetailView(record, resolvePublicApiBaseUrl());
  }

  async recordClientMetricEvents(
    accessToken: string | null,
    input: CreateClientMetricEventInput | CreateClientMetricEventInput[],
  ): Promise<{items: ClientMetricEventRecord[]}> {
    const user = await this.getOptionalUserForAccessToken(accessToken);
    const items = Array.isArray(input) ? input : [input];
    if (items.length === 0) {
      return { items: [] };
    }
    const records = await this.store.createClientMetricEvents(
      items.map((item) => {
        const eventName = String(item.event_name || '').trim().toLowerCase();
        const eventTime = String(item.event_time || '').trim() || new Date().toISOString();
        const deviceId = String(item.device_id || '').trim();
        const appName = String(item.app_name || '').trim().toLowerCase();
        const brandId = String(item.brand_id || '').trim().toLowerCase();
        const appVersion = String(item.app_version || '').trim();
        const platform = String(item.platform || '').trim().toLowerCase();
        const arch = String(item.arch || '').trim().toLowerCase();
        if (!eventName || !deviceId || !appName || !brandId || !appVersion || !platform || !arch) {
          throw new HttpError(
            400,
            'BAD_REQUEST',
            'event_name, device_id, app_name, brand_id, app_version, platform, arch are required',
          );
        }
        if (Number.isNaN(Date.parse(eventTime))) {
          throw new HttpError(400, 'BAD_REQUEST', 'event_time must be a valid ISO timestamp');
        }
        return {
          id: normalizeOptionalCatalogString(item.id, 'id', { allowNull: true, trimToNull: true }) || randomUUID(),
          event_name: eventName,
          event_time: eventTime,
          user_id: user?.id || null,
          device_id: deviceId,
          session_id:
            normalizeOptionalCatalogString(item.session_id, 'session_id', { allowNull: true, trimToNull: true }) ?? null,
          install_id:
            normalizeOptionalCatalogString(item.install_id, 'install_id', { allowNull: true, trimToNull: true }) ?? null,
          app_name: appName,
          brand_id: brandId,
          app_version: appVersion,
          release_channel:
            normalizeOptionalCatalogString(item.release_channel, 'release_channel', {
              allowNull: true,
              trimToNull: true,
            }) ?? null,
          platform,
          os_version:
            normalizeOptionalCatalogString(item.os_version, 'os_version', { allowNull: true, trimToNull: true }) ?? null,
          arch,
          page: normalizeOptionalCatalogString(item.page, 'page', { allowNull: true, trimToNull: true }) ?? null,
          result: normalizeClientMetricEventResult(item.result, null),
          error_code:
            normalizeOptionalCatalogString(item.error_code, 'error_code', { allowNull: true, trimToNull: true }) ?? null,
          duration_ms: normalizeOptionalIntegerField(item.duration_ms, 'duration_ms', { min: 0, allowNull: true }) ?? null,
          payload_json: (item.payload_json && typeof item.payload_json === 'object' && !Array.isArray(item.payload_json))
            ? item.payload_json
            : {},
          created_at: normalizeOptionalCatalogString(item.created_at, 'created_at', { allowNull: true, trimToNull: true }) ||
            new Date().toISOString(),
        };
      }),
    );
    return { items: records };
  }

  async recordClientCrashEvent(
    accessToken: string | null,
    input: CreateClientCrashEventInput,
  ): Promise<ClientCrashEventRecord> {
    const user = await this.getOptionalUserForAccessToken(accessToken);
    const eventTime = String(input.event_time || '').trim() || new Date().toISOString();
    const deviceId = String(input.device_id || '').trim();
    const appName = String(input.app_name || '').trim().toLowerCase();
    const brandId = String(input.brand_id || '').trim().toLowerCase();
    const appVersion = String(input.app_version || '').trim();
    const platform = String(input.platform || '').trim().toLowerCase();
    const arch = String(input.arch || '').trim().toLowerCase();
    if (!deviceId || !appName || !brandId || !appVersion || !platform || !arch) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'device_id, app_name, brand_id, app_version, platform, arch are required',
      );
    }
    if (Number.isNaN(Date.parse(eventTime))) {
      throw new HttpError(400, 'BAD_REQUEST', 'event_time must be a valid ISO timestamp');
    }
    return this.store.createClientCrashEvent({
      id: normalizeOptionalCatalogString(input.id, 'id', { allowNull: true, trimToNull: true }) || randomUUID(),
      crash_type: normalizeClientCrashType(input.crash_type, 'renderer'),
      event_time: eventTime,
      user_id: user?.id || null,
      device_id: deviceId,
      app_name: appName,
      brand_id: brandId,
      app_version: appVersion,
      platform,
      os_version:
        normalizeOptionalCatalogString(input.os_version, 'os_version', { allowNull: true, trimToNull: true }) ?? null,
      arch,
      error_title:
        normalizeOptionalCatalogString(input.error_title, 'error_title', { allowNull: true, trimToNull: true }) ?? null,
      error_message:
        normalizeOptionalCatalogString(input.error_message, 'error_message', { allowNull: true, trimToNull: true }) ?? null,
      stack_summary:
        normalizeOptionalCatalogString(input.stack_summary, 'stack_summary', { allowNull: true, trimToNull: true }) ?? null,
      file_bucket:
        normalizeOptionalCatalogString(input.file_bucket, 'file_bucket', { allowNull: true, trimToNull: true }) ?? null,
      file_key:
        normalizeOptionalCatalogString(input.file_key, 'file_key', { allowNull: true, trimToNull: true }) ?? null,
      created_at:
        normalizeOptionalCatalogString(input.created_at, 'created_at', { allowNull: true, trimToNull: true }) ||
        new Date().toISOString(),
    });
  }

  async recordClientPerfSamples(
    accessToken: string | null,
    input: CreateClientPerfSampleInput | CreateClientPerfSampleInput[],
  ): Promise<{items: ClientPerfSampleRecord[]}> {
    const user = await this.getOptionalUserForAccessToken(accessToken);
    const items = Array.isArray(input) ? input : [input];
    if (items.length === 0) {
      return { items: [] };
    }
    const records = await this.store.createClientPerfSamples(
      items.map((item) => {
        const metricName = normalizeClientPerfMetricName(item.metric_name, 'cold_start_ms');
        const metricTime = String(item.metric_time || '').trim() || new Date().toISOString();
        const deviceId = String(item.device_id || '').trim();
        const appName = String(item.app_name || '').trim().toLowerCase();
        const brandId = String(item.brand_id || '').trim().toLowerCase();
        const appVersion = String(item.app_version || '').trim();
        const platform = String(item.platform || '').trim().toLowerCase();
        const arch = String(item.arch || '').trim().toLowerCase();
        if (!deviceId || !appName || !brandId || !appVersion || !platform || !arch) {
          throw new HttpError(
            400,
            'BAD_REQUEST',
            'device_id, app_name, brand_id, app_version, platform, arch are required',
          );
        }
        if (Number.isNaN(Date.parse(metricTime))) {
          throw new HttpError(400, 'BAD_REQUEST', 'metric_time must be a valid ISO timestamp');
        }
        if (typeof item.value !== 'number' || !Number.isFinite(item.value)) {
          throw new HttpError(400, 'BAD_REQUEST', 'value must be a finite number');
        }
        const unit = String(item.unit || '').trim();
        if (!unit) {
          throw new HttpError(400, 'BAD_REQUEST', 'unit is required');
        }
        return {
          id: normalizeOptionalCatalogString(item.id, 'id', { allowNull: true, trimToNull: true }) || randomUUID(),
          metric_name: metricName,
          metric_time: metricTime,
          user_id: user?.id || null,
          device_id: deviceId,
          app_name: appName,
          brand_id: brandId,
          app_version: appVersion,
          release_channel:
            normalizeOptionalCatalogString(item.release_channel, 'release_channel', {
              allowNull: true,
              trimToNull: true,
            }) ?? null,
          platform,
          os_version:
            normalizeOptionalCatalogString(item.os_version, 'os_version', { allowNull: true, trimToNull: true }) ?? null,
          arch,
          value: item.value,
          unit,
          sample_rate:
            typeof item.sample_rate === 'number' && Number.isFinite(item.sample_rate) ? item.sample_rate : null,
          payload_json:
            item.payload_json && typeof item.payload_json === 'object' && !Array.isArray(item.payload_json)
              ? item.payload_json
              : {},
          created_at:
            normalizeOptionalCatalogString(item.created_at, 'created_at', { allowNull: true, trimToNull: true }) ||
            new Date().toISOString(),
        };
      }),
    );
    return { items: records };
  }

  async getWorkspaceBackup(accessToken: string): Promise<WorkspaceBackupView | null> {
    const user = await this.getUserForAccessToken(accessToken);
    const backup = await this.store.getWorkspaceBackup(user.id);
    return backup ? toWorkspaceBackupView(backup) : null;
  }

  async saveWorkspaceBackup(accessToken: string, input: WorkspaceBackupInput): Promise<WorkspaceBackupView> {
    const user = await this.getUserForAccessToken(accessToken);
    const backup = await this.store.saveWorkspaceBackup(user.id, {
      identity_md: requireWorkspaceMarkdown(input.identity_md, 'identity_md'),
      user_md: requireWorkspaceMarkdown(input.user_md, 'user_md'),
      soul_md: requireWorkspaceMarkdown(input.soul_md, 'soul_md'),
      agents_md: requireWorkspaceMarkdown(input.agents_md, 'agents_md'),
    });
    return toWorkspaceBackupView(backup);
  }

  async listUserFiles(
    accessToken: string,
    input: {kind?: string | null; include_deleted?: boolean; limit?: number | null},
    baseUrl: string,
  ): Promise<{items: UserFileView[]}> {
    const user = await this.getUserForAccessToken(accessToken);
    const items = await this.store.listUserFiles(user.id, {
      kind: input.kind ? normalizeUserFileKind(input.kind, '') : null,
      includeDeleted: Boolean(input.include_deleted),
      limit: normalizeOptionalInteger(input.limit ?? undefined, 'limit') ?? 100,
    });
    return {
      items: items.map((item) => toUserFileView(item, baseUrl)),
    };
  }

  async uploadUserFile(
    accessToken: string,
    input: {
      fileName: string;
      contentType?: string | null;
      content: Buffer;
      kind?: string | null;
      source?: string | null;
      task_id?: string | null;
    },
    baseUrl: string,
  ): Promise<UserFileView> {
    const user = await this.getUserForAccessToken(accessToken);
    const kind = normalizeUserFileKind(input.kind);
    const upload = await storeUserFile({
      userId: user.id,
      kind,
      fileName: input.fileName,
      contentType: input.contentType,
      content: input.content,
    });
    let record: UserFileRecord;
    try {
      record = await this.store.createUserFile(user.id, {
        tenantId: upload.tenantId,
        kind,
        storageProvider: 'minio',
        objectKey: upload.objectKey,
        originalFileName: upload.originalFileName,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        sha256: upload.sha256,
        source: normalizeUserFileSource(input.source),
        taskId: normalizeUserFileTaskId(input.task_id),
        metadata: {},
      });
    } catch (error) {
      await deleteStoredUserFile(upload.objectKey).catch(() => undefined);
      throw error;
    }
    return toUserFileView(record, baseUrl);
  }

  async getUserFileRecord(accessToken: string, fileIdInput: string): Promise<UserFileRecord> {
    const user = await this.getUserForAccessToken(accessToken);
    const fileId = normalizeIdentifier(fileIdInput, 'file_id');
    const record = await this.store.getUserFile(user.id, fileId);
    if (!record || record.status === 'deleted') {
      throw new HttpError(404, 'NOT_FOUND', 'file not found');
    }
    return record;
  }

  async downloadUserFile(accessToken: string, fileIdInput: string): Promise<{
    record: UserFileRecord;
    file: {buffer: Buffer; contentType: string};
  }> {
    const record = await this.getUserFileRecord(accessToken, fileIdInput);
    const file = await downloadStoredUserFile(record.objectKey);
    return {record, file};
  }

  async deleteUserFile(accessToken: string, fileIdInput: string, baseUrl: string): Promise<UserFileView> {
    const record = await this.getUserFileRecord(accessToken, fileIdInput);
    await deleteStoredUserFile(record.objectKey);
    const updated = await this.store.markUserFileDeleted(record.userId, record.id);
    if (!updated) {
      throw new HttpError(404, 'NOT_FOUND', 'file not found');
    }
    return toUserFileView(updated, baseUrl);
  }

  async listMarketStocks(input?: {
    market?: string | null;
    exchange?: string | null;
    search?: string | null;
    tag?: string | null;
    sort?: string | null;
    limit?: number | null;
    offset?: number | null;
  }): Promise<{
    items: MarketStockView[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    next_offset: number | null;
  }> {
    const limit = normalizeMarketStockLimit(input?.limit);
    const offset = normalizeCatalogOffset(input?.offset);
    const result = await this.store.listMarketStocks({
      market: typeof input?.market === 'string' ? input.market.trim() || null : null,
      exchange: typeof input?.exchange === 'string' ? input.exchange.trim() || null : null,
      search: typeof input?.search === 'string' ? input.search.trim() || null : null,
      tag: typeof input?.tag === 'string' ? input.tag.trim() || null : null,
      sort: typeof input?.sort === 'string' ? input.sort.trim() || null : null,
      limit,
      offset,
    });
    const nextOffset = offset + result.items.length;
    return {
      items: result.items.map(toMarketStockView),
      total: result.total,
      limit,
      offset,
      has_more: nextOffset < result.total,
      next_offset: nextOffset < result.total ? nextOffset : null,
    };
  }

  async getMarketStock(stockId: string): Promise<MarketStockView> {
    const normalized = stockId.trim();
    if (!normalized) {
      throw new HttpError(400, 'BAD_REQUEST', 'stock id is required');
    }
    const record = await this.store.getMarketStock(normalized);
    if (!record) {
      throw new HttpError(404, 'NOT_FOUND', 'stock not found');
    }
    return toMarketStockView(record);
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
  }): Promise<{
    items: MarketFundView[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    next_offset: number | null;
  }> {
    const limit = normalizeMarketFundLimit(input?.limit);
    const offset = normalizeCatalogOffset(input?.offset);
    const result = await this.store.listMarketFunds({
      market: typeof input?.market === 'string' ? input.market.trim() || null : null,
      exchange: typeof input?.exchange === 'string' ? input.exchange.trim() || null : null,
      instrumentKind: typeof input?.instrumentKind === 'string' ? input.instrumentKind.trim() || null : null,
      region: typeof input?.region === 'string' ? input.region.trim() || null : null,
      riskLevel: typeof input?.riskLevel === 'string' ? input.riskLevel.trim() || null : null,
      search: typeof input?.search === 'string' ? input.search.trim() || null : null,
      tag: typeof input?.tag === 'string' ? input.tag.trim() || null : null,
      sort: typeof input?.sort === 'string' ? input.sort.trim() || null : null,
      limit,
      offset,
    });
    const nextOffset = offset + result.items.length;
    return {
      items: result.items.map(toMarketFundView),
      total: result.total,
      limit,
      offset,
      has_more: nextOffset < result.total,
      next_offset: nextOffset < result.total ? nextOffset : null,
    };
  }

  async getMarketFund(fundId: string): Promise<MarketFundView> {
    const normalized = fundId.trim();
    if (!normalized) {
      throw new HttpError(400, 'BAD_REQUEST', 'fund id is required');
    }
    const record = await this.store.getMarketFund(normalized);
    if (!record) {
      throw new HttpError(404, 'NOT_FOUND', 'fund not found');
    }
    return toMarketFundView(record);
  }

  async listAgentCatalog(): Promise<{items: AgentCatalogEntryView[]}> {
    const items = await this.store.listAgentCatalog();
    return {
      items: items.map((item) => toAgentCatalogEntryView(item)),
    };
  }

  async listAdminAgentCatalog(
    accessToken: string,
  ): Promise<{
    items: AdminAgentCatalogEntryView[];
    total: number;
  }> {
    await this.requireAdminUser(accessToken);
    const [items, total] = await Promise.all([
      this.store.listAgentCatalogAdmin(),
      this.store.countAgentCatalogAdmin(),
    ]);
    return {
      items: items.map((item) => toAdminAgentCatalogEntryView(item)),
      total,
    };
  }

  async upsertAdminAgentCatalogEntry(
    accessToken: string,
    input: UpsertAgentCatalogEntryInput,
  ): Promise<AdminAgentCatalogEntryView> {
    await this.requireAdminUser(accessToken);
    const slug = normalizeSkillSlug(input.slug);
    const existing = await this.store.getAgentCatalogEntry(slug);

    const nameCandidate = normalizeOptionalCatalogString(input.name, 'name');
    const descriptionCandidate = normalizeOptionalCatalogString(input.description, 'description');
    const publisherCandidate = normalizeOptionalCatalogString(input.publisher, 'publisher');

    const name = (nameCandidate === undefined ? (existing?.name ?? '') : (nameCandidate || '')).trim();
    const description = (descriptionCandidate === undefined ? (existing?.description ?? '') : (descriptionCandidate || '')).trim();
    const publisher = (publisherCandidate === undefined ? (existing?.publisher ?? '') : (publisherCandidate || '')).trim();
    const category = normalizeAgentCategory(input.category, existing?.category || 'general');
    const featured = normalizeOptionalBoolean(input.featured, 'featured') ?? existing?.featured ?? false;
    const official = normalizeOptionalBoolean(input.official, 'official') ?? existing?.official ?? true;
    const tags = normalizeCatalogStringArray(input.tags, existing?.tags || []);
    const capabilities = normalizeCatalogStringArray(input.capabilities, existing?.capabilities || []);
    const useCases = normalizeCatalogStringArray(input.use_cases, existing?.useCases || []);
    const metadata = normalizeJsonObject(input.metadata, 'metadata', existing?.metadata || {});
    const sortOrder = normalizeOptionalInteger(input.sort_order, 'sort_order') ?? existing?.sortOrder ?? 9999;
    const active = normalizeOptionalBoolean(input.active, 'active') ?? existing?.active ?? true;

    if (!name) {
      throw new HttpError(400, 'BAD_REQUEST', 'name is required');
    }
    if (!description) {
      throw new HttpError(400, 'BAD_REQUEST', 'description is required');
    }
    if (!publisher) {
      throw new HttpError(400, 'BAD_REQUEST', 'publisher is required');
    }

    const record = await this.store.upsertAgentCatalogEntry({
      slug,
      name,
      description,
      category,
      publisher,
      featured,
      official,
      tags,
      capabilities,
      use_cases: useCases,
      metadata,
      sort_order: sortOrder,
      active,
    });

    return toAdminAgentCatalogEntryView(record);
  }

  async deleteAdminAgentCatalogEntry(accessToken: string, slugInput: string): Promise<{removed: boolean}> {
    await this.requireAdminUser(accessToken);
    const slug = normalizeSkillSlug(slugInput);
    return {
      removed: await this.store.deleteAgentCatalogEntry(slug),
    };
  }

  async listUserAgentLibrary(accessToken: string): Promise<{items: UserAgentLibraryItemView[]}> {
    const user = await this.getUserForAccessToken(accessToken);
    const items = await this.store.listUserAgentLibrary(user.id);
    return {
      items: items.map((item) => toUserAgentLibraryItemView(item)),
    };
  }

  async installAgent(accessToken: string, input: InstallAgentInput): Promise<UserAgentLibraryItemView> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(input.slug);
    const entry = await this.store.getAgentCatalogEntry(slug);
    if (!entry || !entry.active) {
      throw new HttpError(404, 'NOT_FOUND', 'agent not found');
    }

    const relatedSkillSlugs = readMetadataStringArray(entry.metadata, 'skill_slugs');
    for (const skillSlug of relatedSkillSlugs) {
      const skillEntry = await this.store.getSkillCatalogEntry(skillSlug);
      if (!skillEntry || !skillEntry.active) {
        throw new HttpError(400, 'BAD_REQUEST', `agent skill not found: ${skillSlug}`);
      }
      await this.store.installUserSkill(user.id, {
        slug: skillEntry.slug,
        version: skillEntry.version,
        source: 'cloud',
        setup_values: {},
        secret_values: {},
      });
    }

    const record = await this.store.installUserAgent(user.id, {slug});
    return toUserAgentLibraryItemView(record);
  }

  async removeAgentFromLibrary(accessToken: string, slugInput: string): Promise<{removed: boolean}> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(slugInput);
    return {
      removed: await this.store.removeUserAgent(user.id, slug),
    };
  }

  async listSkillCatalog(
    baseUrl?: string,
    limitInput?: number | null,
    offsetInput?: number | null,
    skillSlugsInput?: string[] | null,
    filtersInput?: {tagKeywords?: string[] | null; extraSkillSlugs?: string[] | null},
  ): Promise<{
    items: SkillCatalogEntryView[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    next_offset: number | null;
  }> {
    const limit = normalizeCatalogLimit(limitInput);
    const offset = normalizeCatalogOffset(offsetInput);
    const skillSlugs =
      Array.isArray(skillSlugsInput)
        ? Array.from(new Set(skillSlugsInput.map((slug) => slug.trim()).filter(Boolean)))
        : null;
    const tagKeywords =
      Array.isArray(filtersInput?.tagKeywords)
        ? Array.from(new Set(filtersInput.tagKeywords.map((keyword) => keyword.trim()).filter(Boolean)))
        : [];
    const extraSkillSlugs =
      Array.isArray(filtersInput?.extraSkillSlugs)
        ? Array.from(new Set(filtersInput.extraSkillSlugs.map((slug) => slug.trim()).filter(Boolean)))
        : [];
    const [items, total] = await Promise.all([
      skillSlugs
        ? this.store.listSkillCatalogBySlugs(skillSlugs, limit, offset, {tagKeywords})
        : this.store.listSkillCatalog(limit, offset, {tagKeywords, extraSkillSlugs}),
      skillSlugs
        ? this.store.countSkillCatalogBySlugs(skillSlugs, {tagKeywords})
        : this.store.countSkillCatalog({tagKeywords, extraSkillSlugs}),
    ]);
    const nextOffset = offset + items.length;
    return {
      items: items.map((item) => toSkillCatalogEntryView(item, baseUrl)),
      total,
      limit,
      offset,
      has_more: nextOffset < total,
      next_offset: nextOffset < total ? nextOffset : null,
    };
  }

  async listMcpCatalog(
    defaultInstalledKeys: Set<string> = new Set(),
    limitInput?: number | null,
    offsetInput?: number | null,
  ): Promise<{
    items: McpCatalogEntryView[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    next_offset: number | null;
  }> {
    const limit = normalizeCatalogLimit(limitInput);
    const offset = normalizeCatalogOffset(offsetInput);
    const [items, total] = await Promise.all([
      this.store.listMcpCatalog(limit, offset),
      this.store.countMcpCatalog(),
    ]);
    const nextOffset = offset + items.length;
    return {
      items: items.map((item) =>
        toMcpCatalogEntryView(item, {defaultInstalled: defaultInstalledKeys.has(item.mcpKey)}),
      ),
      total,
      limit,
      offset,
      has_more: nextOffset < total,
      next_offset: nextOffset < total ? nextOffset : null,
    };
  }

  async listPersonalSkillCatalog(
    accessToken: string,
    baseUrl?: string,
    limitInput?: number | null,
    offsetInput?: number | null,
  ): Promise<{
    items: SkillCatalogEntryView[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    next_offset: number | null;
  }> {
    const limit = normalizeCatalogLimit(limitInput);
    const offset = normalizeCatalogOffset(offsetInput);
    const user = await this.getUserForAccessToken(accessToken);
    const [catalogItems, privateItems, totalCloud] = await Promise.all([
      this.store.listSkillCatalog(limit, offset),
      this.store.listUserPrivateSkills(user.id),
      this.store.countSkillCatalog(),
    ]);

    const merged = new Map<string, SkillCatalogEntryView>();
    const privateViews =
      offset === 0 ? privateItems.map((item) => toPrivateSkillCatalogEntryView(item, baseUrl)) : [];

    for (const item of privateViews) {
      merged.set(item.slug, item);
    }
    for (const item of catalogItems) {
      if (!merged.has(item.slug)) {
        merged.set(item.slug, toSkillCatalogEntryView(item, baseUrl));
      }
    }

    const total = totalCloud + privateItems.length;
    const nextOffset = offset + catalogItems.length;
    return {
      items: Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')),
      total,
      limit,
      offset,
      has_more: nextOffset < totalCloud,
      next_offset: nextOffset < totalCloud ? nextOffset : null,
    };
  }

  async listAdminSkillCatalog(
    accessToken: string,
    baseUrl?: string,
    limitInput?: number | null,
    offsetInput?: number | null,
    queryInput?: string | null,
  ): Promise<{
    items: AdminSkillCatalogEntryView[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    next_offset: number | null;
  }> {
    await this.requireAdminUser(accessToken);
    const limit = normalizeCatalogLimit(limitInput);
    const offset = normalizeCatalogOffset(offsetInput);
    const query = typeof queryInput === 'string' ? queryInput.trim() : '';
    const [items, total] = await Promise.all([
      this.store.listSkillCatalogAdmin(limit, offset, query),
      this.store.countSkillCatalogAdmin(query),
    ]);
    const nextOffset = offset + items.length;
    return {
      items: items.map((item) => toAdminSkillCatalogEntryView(item, baseUrl)),
      total,
      limit,
      offset,
      has_more: nextOffset < total,
      next_offset: nextOffset < total ? nextOffset : null,
    };
  }

  async upsertAdminSkillCatalogEntry(
    accessToken: string,
    input: UpsertSkillCatalogEntryInput,
    baseUrl?: string,
  ): Promise<AdminSkillCatalogEntryView> {
    await this.requireAdminUser(accessToken);
    const slug = normalizeSkillSlug(input.slug);
    const existing = await this.store.getSkillCatalogEntry(slug);

    const nameCandidate = normalizeOptionalCatalogString(input.name, 'name');
    const descriptionCandidate = normalizeOptionalCatalogString(input.description, 'description');
    const publisherCandidate = normalizeOptionalCatalogString(input.publisher, 'publisher');
    const marketCandidate = normalizeOptionalCatalogString(input.market, 'market', {allowNull: true, trimToNull: true});
    const categoryCandidate = normalizeOptionalCatalogString(input.category, 'category', {
      allowNull: true,
      trimToNull: true,
    });
    const skillTypeCandidate = normalizeOptionalCatalogString(input.skill_type, 'skill_type', {
      allowNull: true,
      trimToNull: true,
    });

    const name = (nameCandidate === undefined ? (existing?.name ?? '') : (nameCandidate || '')).trim();
    const description = (
      descriptionCandidate === undefined ? (existing?.description ?? '') : (descriptionCandidate || '')
    ).trim();
    const publisher = (
      publisherCandidate === undefined ? (existing?.publisher ?? '') : (publisherCandidate || '')
    ).trim();
    const distribution = normalizeSkillDistribution(
      input.distribution,
      existing?.distribution === 'cloud' ? 'cloud' : 'cloud',
    );
    const tags = normalizeSkillTags(input.tags, existing?.tags || []);
    const version = normalizeOptionalSkillVersion(input.version) || existing?.version || '1.0.0';
    const artifactUrlCandidate = normalizeOptionalCatalogString(input.artifact_url, 'artifact_url', {
      allowNull: true,
      trimToNull: true,
    });
    const artifactFormat = normalizeArtifactFormat(input.artifact_format ?? existing?.artifactFormat ?? 'tar.gz');
    const artifactSha256 =
      normalizeOptionalCatalogString(input.artifact_sha256, 'artifact_sha256', {allowNull: true, trimToNull: true}) ??
      existing?.artifactSha256 ??
      null;
    const artifactSourcePath = normalizeOptionalCatalogString(input.artifact_source_path, 'artifact_source_path', {
      allowNull: true,
      trimToNull: true,
    });
    const originType = normalizeSkillOriginType(input.origin_type, existing?.originType || 'manual');
    const sourceUrl =
      normalizeOptionalCatalogString(input.source_url, 'source_url', {allowNull: true, trimToNull: true}) ??
      existing?.sourceUrl ??
      null;
    const metadata = normalizeJsonObject(input.metadata, 'metadata', existing?.metadata || {});
    const active = normalizeOptionalBoolean(input.active, 'active') ?? existing?.active ?? true;
    const market = marketCandidate === undefined ? (existing?.market ?? null) : marketCandidate;
    const category = categoryCandidate === undefined ? (existing?.category ?? null) : categoryCandidate;
    const skillType = skillTypeCandidate === undefined ? (existing?.skillType ?? null) : skillTypeCandidate;
    const artifactUrl = artifactUrlCandidate === undefined ? (existing?.artifactUrl ?? null) : artifactUrlCandidate;

    if (!name) {
      throw new HttpError(400, 'BAD_REQUEST', 'name is required');
    }
    if (!description) {
      throw new HttpError(400, 'BAD_REQUEST', 'description is required');
    }
    if (!publisher) {
      throw new HttpError(400, 'BAD_REQUEST', 'publisher is required');
    }

    if (artifactSourcePath) {
      throw new HttpError(400, 'BAD_REQUEST', 'artifact_source_path is no longer supported');
    }
    if (
      distribution === 'cloud' &&
      active &&
      !artifactUrl &&
      !getCloudSkillArtifactObjectKey(metadata) &&
      originType !== 'github_repo'
    ) {
      throw new HttpError(400, 'BAD_REQUEST', 'active cloud skills require artifact_url or managed cloud artifact');
    }

    const record = await this.store.upsertSkillCatalogEntry({
      slug,
      name,
      description,
      market,
      category,
      skill_type: skillType,
      publisher,
      distribution,
      tags,
      version,
      artifact_url: artifactUrl,
      artifact_format: artifactFormat,
      artifact_sha256: artifactSha256,
      artifact_source_path: null,
      origin_type: originType,
      source_url: sourceUrl,
      metadata,
      active,
    });

    return toAdminSkillCatalogEntryView(record, baseUrl);
  }

  async deleteAdminSkillCatalogEntry(accessToken: string, slugInput: string): Promise<{removed: boolean}> {
    await this.requireAdminUser(accessToken);
    const slug = normalizeSkillSlug(slugInput);
    const entry = await this.store.getSkillCatalogEntry(slug);
    if (!entry) {
      return {removed: false};
    }
    return {
      removed: await this.store.deleteSkillCatalogEntry(slug),
    };
  }

  async listSkillSyncSources(accessToken: string): Promise<{items: SkillSyncSourceView[]}> {
    await this.requireAdminUser(accessToken);
    const items = await this.store.listSkillSyncSources();
    return {items: items.map(toSkillSyncSourceView)};
  }

  async upsertSkillSyncSource(accessToken: string, input: UpsertSkillSyncSourceInput): Promise<SkillSyncSourceView> {
    await this.requireAdminUser(accessToken);
    const sourceType = input.source_type;
    if (sourceType !== 'clawhub' && sourceType !== 'github_repo') {
      throw new HttpError(400, 'BAD_REQUEST', 'source_type must be clawhub or github_repo');
    }
    const sourceKey = (String(input.source_key || '').trim() || '').toLowerCase();
    const displayName = String(input.display_name || '').trim();
    const sourceUrl = String(input.source_url || '').trim();
    if (!sourceKey || !displayName || !sourceUrl) {
      throw new HttpError(400, 'BAD_REQUEST', 'source_key, display_name and source_url are required');
    }
    const id = String(input.id || '').trim() || randomBytes(8).toString('hex');
    const record = await this.store.upsertSkillSyncSource({
      id,
      source_type: sourceType,
      source_key: sourceKey,
      display_name: displayName,
      source_url: sourceUrl,
      config: normalizeJsonObject(input.config, 'config'),
      active: normalizeOptionalBoolean(input.active, 'active') ?? true,
    });
    return toSkillSyncSourceView(record);
  }

  async deleteSkillSyncSource(accessToken: string, idInput: string): Promise<{removed: boolean}> {
    await this.requireAdminUser(accessToken);
    const id = String(idInput || '').trim();
    if (!id) {
      throw new HttpError(400, 'BAD_REQUEST', 'id is required');
    }
    return {removed: await this.store.deleteSkillSyncSource(id)};
  }

  async listSkillSyncRuns(accessToken: string, limitInput?: number): Promise<{items: SkillSyncRunView[]}> {
    await this.requireAdminUser(accessToken);
    const limit = Number.isInteger(limitInput) && Number(limitInput) > 0 ? Number(limitInput) : 20;
    const items = await this.store.listSkillSyncRuns(limit);
    return {items: items.map(toSkillSyncRunView)};
  }

  async runSkillSync(accessToken: string, sourceIdInput: string): Promise<SkillSyncRunView> {
    await this.requireAdminUser(accessToken);
    const sourceId = String(sourceIdInput || '').trim();
    if (!sourceId) {
      throw new HttpError(400, 'BAD_REQUEST', 'source_id is required');
    }
    const source = await this.store.getSkillSyncSource(sourceId);
    if (!source) {
      throw new HttpError(404, 'NOT_FOUND', 'sync source not found');
    }
    const existingEntries = await this.store.listSkillCatalogAdmin();
    const execution = await syncSkillsFromSource(source, existingEntries);
    for (const upsert of execution.upserts) {
      await this.store.upsertSkillCatalogEntry(upsert);
    }
    const storedItems = execution.items.slice(0, SKILL_SYNC_RUN_ITEM_LIMIT);
    const summary: Record<string, unknown> = {
      ...execution.summary,
      stored_item_count: storedItems.length,
      truncated_item_count: Math.max(0, execution.items.length - storedItems.length),
    };
    const run = await this.store.createSkillSyncRun({
      sourceId: source.id,
      sourceKey: source.sourceKey,
      sourceType: source.sourceType,
      displayName: source.displayName,
      status: execution.status,
      summary,
      items: storedItems,
      startedAt: typeof summary.started_at === 'string' ? summary.started_at : new Date().toISOString(),
      finishedAt: typeof summary.finished_at === 'string' ? summary.finished_at : new Date().toISOString(),
    });
    return toSkillSyncRunView(run);
  }

  private extensionConfigMapKey(extensionType: ExtensionInstallTarget, extensionKey: string): string {
    return `${extensionType}:${extensionKey}`;
  }

  private async listExtensionConfigMap(
    userId: string,
    extensionType: ExtensionInstallTarget,
  ): Promise<Map<string, UserExtensionInstallConfigRecord>> {
    const records = await this.store.listUserExtensionInstallConfigs(userId, extensionType);
    return new Map(records.map((item) => [this.extensionConfigMapKey(item.extensionType, item.extensionKey), item]));
  }

  private resolveSkillSetupSchema(entry: SkillCatalogEntryRecord): ExtensionSetupSchema | null {
    return inferExtensionSetupSchema(entry.metadata);
  }

  private resolveMcpSetupSchema(entry: McpCatalogEntryRecord): ExtensionSetupSchema | null {
    return inferExtensionSetupSchema(entry.metadata, entry.config);
  }

  private async upsertUserExtensionConfig(
    userId: string,
    extensionType: ExtensionInstallTarget,
    extensionKey: string,
    schema: ExtensionSetupSchema | null,
    input: {
      setup_values?: Record<string, unknown>;
      secret_values?: Record<string, string>;
    },
    options: {requireComplete?: boolean} = {},
  ): Promise<UserExtensionInstallConfigRecord | null> {
    if (!schema) {
      await this.store.removeUserExtensionInstallConfig(userId, extensionType, extensionKey);
      return null;
    }

    const existing = await this.store.getUserExtensionInstallConfig(userId, extensionType, extensionKey);
    const merged = mergeExtensionSetupPayload(
      schema,
      input.setup_values,
      input.secret_values,
      existing,
      options,
    );
    return this.store.upsertUserExtensionInstallConfig(userId, {
      extension_type: extensionType,
      extension_key: extensionKey,
      setup_values: merged.setupValues,
      secret_values: merged.secretValues,
      schema_version: merged.schemaVersion,
      status: merged.status,
      configured_secret_keys: merged.configuredSecretKeys,
      secret_payload_encrypted: encryptInstallSecretPayload(merged.secretValues),
    });
  }

  async getUserExtensionInstallConfig(
    accessToken: string,
    extensionTypeInput: ExtensionInstallTarget | string | undefined,
    extensionKeyInput: string | undefined,
  ): Promise<UserExtensionInstallConfigView | null> {
    const user = await this.getUserForAccessToken(accessToken);
    const extensionType = normalizeExtensionInstallTarget(extensionTypeInput);
    const extensionKey = String(extensionKeyInput || '').trim();
    if (!extensionKey) {
      throw new HttpError(400, 'BAD_REQUEST', 'extension_key is required');
    }

    const record = await this.store.getUserExtensionInstallConfig(user.id, extensionType, extensionKey);
    return record ? toUserExtensionInstallConfigView(record) : null;
  }

  async upsertUserExtensionInstallConfig(
    accessToken: string,
    input: UpsertUserExtensionInstallConfigInput,
  ): Promise<UserExtensionInstallConfigView> {
    const user = await this.getUserForAccessToken(accessToken);
    const extensionType = normalizeExtensionInstallTarget(input.extension_type);
    const extensionKey = String(input.extension_key || '').trim();
    if (!extensionKey) {
      throw new HttpError(400, 'BAD_REQUEST', 'extension_key is required');
    }

    if (extensionType === 'skill') {
      const entry = await this.store.getSkillCatalogEntry(normalizeSkillSlug(extensionKey));
      if (!entry) {
        throw new HttpError(404, 'NOT_FOUND', 'skill not found');
      }
      const record = await this.upsertUserExtensionConfig(user.id, 'skill', entry.slug, this.resolveSkillSetupSchema(entry), input);
      if (!record) {
        throw new HttpError(400, 'BAD_REQUEST', 'skill does not require setup');
      }
      return toUserExtensionInstallConfigView(record);
    }

    const entry = await this.store.getMcpCatalogEntry(normalizeMcpKey(extensionKey));
    if (!entry || !entry.active) {
      throw new HttpError(404, 'NOT_FOUND', 'mcp not found');
    }
    const record = await this.upsertUserExtensionConfig(user.id, 'mcp', entry.mcpKey, this.resolveMcpSetupSchema(entry), input);
    if (!record) {
      throw new HttpError(400, 'BAD_REQUEST', 'mcp does not require setup');
    }
    return toUserExtensionInstallConfigView(record);
  }

  async listUserSkillLibrary(accessToken: string): Promise<{items: UserSkillLibraryItemView[]}> {
    const user = await this.getUserForAccessToken(accessToken);
    const [items, configs] = await Promise.all([
      this.store.listUserSkillLibrary(user.id),
      this.listExtensionConfigMap(user.id, 'skill'),
    ]);
    const catalogBySlug = new Map(
      (
        await Promise.all(
          items
            .filter((item) => item.source === 'cloud')
            .map(async (item) => [item.slug, await this.store.getSkillCatalogEntry(item.slug)] as const),
        )
      ).filter((entry): entry is readonly [string, SkillCatalogEntryRecord] => Boolean(entry[1])),
    );
    return {
      items: items.map((item) => {
        const entryConfig = configs.get(this.extensionConfigMapKey('skill', item.slug)) || null;
        const setupState = resolveExtensionSetupState(
          catalogBySlug.get(item.slug) ? this.resolveSkillSetupSchema(catalogBySlug.get(item.slug) as SkillCatalogEntryRecord) : null,
          entryConfig,
        );
        return toUserSkillLibraryItemView({
          ...item,
          ...setupState,
        });
      }),
    };
  }

  async installSkill(accessToken: string, input: InstallSkillInput): Promise<UserSkillLibraryItemView> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(input.slug);
    const version = normalizeOptionalSkillVersion(input.version);
    const entry = await this.store.getSkillCatalogEntry(slug);
    if (!entry) {
      throw new HttpError(404, 'NOT_FOUND', 'skill not found');
    }

    if (version && version !== entry.version) {
      throw new HttpError(409, 'CONFLICT', 'skill version has been updated to latest');
    }

    const configRecord = await this.upsertUserExtensionConfig(
      user.id,
      'skill',
      slug,
      this.resolveSkillSetupSchema(entry),
      input,
      {requireComplete: true},
    );

    const record = await this.store.installUserSkill(user.id, {
      slug,
      version: entry.version,
      source: 'cloud',
      setup_values: {},
      secret_values: {},
    });
    return toUserSkillLibraryItemView({
      ...record,
      ...resolveExtensionSetupState(this.resolveSkillSetupSchema(entry), configRecord),
    });
  }

  async listUserMcpLibrary(accessToken: string): Promise<{items: UserMcpLibraryItemView[]}> {
    const user = await this.getUserForAccessToken(accessToken);
    const [items, configs] = await Promise.all([
      this.store.listUserMcpLibrary(user.id),
      this.listExtensionConfigMap(user.id, 'mcp'),
    ]);
    const catalogByKey = new Map(
      (
        await Promise.all(items.map(async (item) => [item.mcpKey, await this.store.getMcpCatalogEntry(item.mcpKey)] as const))
      ).filter((entry): entry is readonly [string, McpCatalogEntryRecord] => Boolean(entry[1])),
    );
    return {
      items: items.map((item) => {
        const schema = catalogByKey.get(item.mcpKey)
          ? this.resolveMcpSetupSchema(catalogByKey.get(item.mcpKey) as McpCatalogEntryRecord)
          : null;
        const entryConfig = configs.get(this.extensionConfigMapKey('mcp', item.mcpKey)) || null;
        return toUserMcpLibraryItemView({
          ...item,
          ...resolveExtensionSetupState(schema, entryConfig),
        });
      }),
    };
  }

  async installMcp(accessToken: string, input: InstallMcpInput): Promise<UserMcpLibraryItemView> {
    const user = await this.getUserForAccessToken(accessToken);
    const mcpKey = normalizeMcpKey(input.mcp_key);
    const entry = await this.store.getMcpCatalogEntry(mcpKey);
    if (!entry || !entry.active) {
      throw new HttpError(404, 'NOT_FOUND', 'mcp not found');
    }
    const configRecord = await this.upsertUserExtensionConfig(
      user.id,
      'mcp',
      mcpKey,
      this.resolveMcpSetupSchema(entry),
      input,
      {requireComplete: true},
    );
    const record = await this.store.installUserMcp(user.id, {
      mcp_key: mcpKey,
      source: 'cloud',
      setup_values: {},
      secret_values: {},
    });
    return toUserMcpLibraryItemView({
      ...record,
      ...resolveExtensionSetupState(this.resolveMcpSetupSchema(entry), configRecord),
    });
  }

  async updateMcpLibraryItem(
    accessToken: string,
    input: UpdateMcpLibraryItemInput,
  ): Promise<UserMcpLibraryItemView> {
    const user = await this.getUserForAccessToken(accessToken);
    const mcpKey = normalizeMcpKey(input.mcp_key);
    const enabled = normalizeSkillEnabled(input.enabled);
    const record = await this.store.updateUserMcp(user.id, {
      mcp_key: mcpKey,
      enabled,
    });
    if (!record) {
      throw new HttpError(404, 'NOT_FOUND', 'installed mcp not found');
    }
    const entry = await this.store.getMcpCatalogEntry(mcpKey);
    const configRecord = await this.store.getUserExtensionInstallConfig(user.id, 'mcp', mcpKey);
    return toUserMcpLibraryItemView({
      ...record,
      ...resolveExtensionSetupState(entry ? this.resolveMcpSetupSchema(entry) : null, configRecord),
    });
  }

  async removeMcp(accessToken: string, mcpKeyInput: string): Promise<{removed: boolean}> {
    const user = await this.getUserForAccessToken(accessToken);
    const mcpKey = normalizeMcpKey(mcpKeyInput);
    return {
      removed: await this.store.removeUserMcp(user.id, mcpKey),
    };
  }

  async importPrivateSkill(
    accessToken: string,
    input: ImportUserPrivateSkillInput,
    baseUrl?: string,
  ): Promise<SkillCatalogEntryView> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(input.slug);
    const name = (normalizeOptionalCatalogString(input.name, 'name') || '').trim();
    const description = (normalizeOptionalCatalogString(input.description, 'description') || '').trim();
    const publisher = (
      normalizeOptionalCatalogString(input.publisher, 'publisher', {trimToNull: true}) || '个人导入'
    ).trim();
    const version = normalizeOptionalSkillVersion(input.version);
    const sourceKind = normalizePrivateSkillSourceKind(input.source_kind);
    const artifactFormat = normalizeArtifactFormat(input.artifact_format);
    const artifact = parseRequiredBase64(input.artifact_base64, 'artifact_base64');
    const tags = normalizeSkillTags(input.tags);
    const market = normalizeOptionalCatalogString(input.market, 'market', {allowNull: true, trimToNull: true}) ?? null;
    const category =
      normalizeOptionalCatalogString(input.category, 'category', {allowNull: true, trimToNull: true}) ?? null;
    const skillType =
      normalizeOptionalCatalogString(input.skill_type, 'skill_type', {allowNull: true, trimToNull: true}) ?? null;
    const sourceUrl =
      normalizeOptionalCatalogString(input.source_url, 'source_url', {allowNull: true, trimToNull: true}) ?? null;
    const artifactSha256 =
      normalizeOptionalCatalogString(input.artifact_sha256, 'artifact_sha256', {allowNull: true, trimToNull: true}) ?? null;

    if (!name) {
      throw new HttpError(400, 'BAD_REQUEST', 'name is required');
    }
    if (!description) {
      throw new HttpError(400, 'BAD_REQUEST', 'description is required');
    }
    if (!version) {
      throw new HttpError(400, 'BAD_REQUEST', 'version is required');
    }

    const publicConflict = await this.store.getSkillCatalogEntry(slug);
    if (publicConflict) {
      throw new HttpError(409, 'CONFLICT', 'skill slug is already used by catalog');
    }

    const artifactUpload = await uploadPrivateSkillArtifact({
      userId: user.id,
      slug,
      version,
      artifactFormat,
      artifact,
    });
    const record = await this.store.upsertUserPrivateSkill(user.id, {
      slug,
      name,
      description,
      market,
      category,
      skill_type: skillType,
      publisher,
      tags,
      source_kind: sourceKind,
      source_url: sourceUrl,
      version,
      artifact_format: artifactFormat,
      artifact_sha256: artifactSha256,
      artifactKey: artifactUpload.key,
    });
    await this.store.installUserSkill(user.id, {
      slug,
      version,
      source: 'private',
      setup_values: {},
      secret_values: {},
    });
    return toPrivateSkillCatalogEntryView(record, baseUrl);
  }

  async updateSkillLibraryItem(
    accessToken: string,
    input: UpdateSkillLibraryItemInput,
  ): Promise<UserSkillLibraryItemView> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(input.slug);
    const enabled = normalizeSkillEnabled(input.enabled);
    const record = await this.store.updateUserSkill(user.id, {
      slug,
      enabled,
    });
    if (!record) {
      throw new HttpError(404, 'NOT_FOUND', 'installed skill not found');
    }
    const entry = await this.store.getSkillCatalogEntry(slug);
    const configRecord = await this.store.getUserExtensionInstallConfig(user.id, 'skill', slug);
    return toUserSkillLibraryItemView({
      ...record,
      ...resolveExtensionSetupState(entry ? this.resolveSkillSetupSchema(entry) : null, configRecord),
    });
  }

  async removeSkill(accessToken: string, slugInput: string): Promise<{removed: boolean}> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(slugInput);
    return {
      removed: await this.store.removeUserSkill(user.id, slug),
    };
  }

  async getSkillArtifactEntry(slugInput: string, versionInput?: string): Promise<SkillCatalogEntryRecord> {
    const slug = normalizeSkillSlug(slugInput);
    const version = normalizeOptionalSkillVersion(versionInput);
    const catalog = await this.store.listSkillCatalog();
    const entry = catalog.find((item) => item.slug === slug);
    if (!entry) {
      throw new HttpError(404, 'NOT_FOUND', 'skill not found');
    }
    if (version && entry.version !== version) {
      throw new HttpError(404, 'NOT_FOUND', 'skill version not found');
    }
    return entry;
  }

  async getPrivateSkillArtifactRecord(accessToken: string, slugInput: string, versionInput?: string): Promise<UserPrivateSkillRecord> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(slugInput);
    const version = normalizeOptionalSkillVersion(versionInput);
    const skill = await this.store.getUserPrivateSkill(user.id, slug);
    if (!skill) {
      throw new HttpError(404, 'NOT_FOUND', 'private skill not found');
    }
    if (version && skill.version !== version) {
      throw new HttpError(404, 'NOT_FOUND', 'private skill release not found');
    }
    return skill;
  }

  async deletePrivateSkill(accessToken: string, slugInput: string): Promise<{removed: boolean}> {
    const user = await this.getUserForAccessToken(accessToken);
    const slug = normalizeSkillSlug(slugInput);
    const skill = await this.store.getUserPrivateSkill(user.id, slug);
    if (!skill) {
      return {removed: false};
    }

    await this.store.removeUserSkill(user.id, slug);
    await this.store.deleteUserPrivateSkill(user.id, slug);
    try {
      await deletePrivateSkillArtifact(skill.artifactKey);
    } catch (error) {
      logWarn('failed to delete private skill artifact', {
        userId: user.id,
        slug,
        artifactKey: skill.artifactKey,
        error,
      });
    }
    return {removed: true};
  }

  async authorizeRun(accessToken: string, input: RunAuthorizeInput): Promise<RunGrantView> {
    const user = await this.getUserForAccessToken(accessToken);
    const eventId = (input.event_id || '').trim() || null;
    let sessionKey: string;
    try {
      sessionKey = toCanonicalSessionKey(input.session_key);
    } catch {
      throw new HttpError(400, 'BAD_REQUEST', 'session_key must use canonical session identity');
    }
    const client = (input.client || 'desktop').trim() || 'desktop';
    const message = (input.message || '').trim();
    const attachments = Array.isArray(input.attachments) ? input.attachments : [];
    const hasSearch = Boolean(input.has_search);
    const hasTools = Boolean(input.has_tools);
    const historyMessages = Math.max(0, Math.min(48, input.history_messages || 0));
    let estimatedInputTokens = Math.max(0, input.estimated_input_tokens || 0);
    let estimatedOutputTokens = Math.max(0, input.estimated_output_tokens || 0);
    const normalizedModel = (input.model || '').trim();
    const normalizedAppName = (input.app_name || '').trim() || null;
    const account = await this.store.getCreditAccount(user.id);
    const currentBalance = account.totalAvailableBalance;
    if (currentBalance < 0) {
      throw new HttpError(
        402,
        'INSUFFICIENT_CREDITS',
        `当前龙虾币余额已为 ${currentBalance}，账号已暂停发送。新积分将在次日发放。请先前往充值中心充值后再继续。`,
      );
    }

    if ((estimatedInputTokens <= 0 || estimatedOutputTokens <= 0) && (message || attachments.length > 0)) {
      estimatedInputTokens = this.estimateQuoteInputTokens({
        message,
        historyMessages,
        attachments,
        hasSearch,
        hasTools,
      });
      estimatedOutputTokens = this.estimateQuoteOutputTokens({
        message,
        historyMessages,
        attachmentCount: attachments.length,
        hasSearch,
        hasTools,
      }).high;
    }

    const billingMultiplier = await this.resolveBillingMultiplier(normalizedAppName, normalizedModel || null);
    const estimatedCreditCost = this.computeBilledCreditCost(
      estimatedInputTokens,
      estimatedOutputTokens,
      billingMultiplier,
    );
    const creditLimit = Math.max(1, config.runGrantCreditLimit, estimatedCreditCost);

    const nonce = makeNonce();
    const expiresAt = new Date(Date.now() + config.runGrantTtlSeconds * 1000).toISOString();
    const maxInputTokens = Math.max(config.runGrantMaxInputTokens, estimatedInputTokens);
    const maxOutputTokens = Math.max(config.runGrantMaxOutputTokens, estimatedOutputTokens);
    const signature = makeSignature({userId: user.id, nonce, expiresAt});

    const grant = await this.store.createRunGrant({
      userId: user.id,
      sessionKey,
      eventId,
      client,
      nonce,
      maxInputTokens,
      maxOutputTokens,
      creditLimit,
      expiresAt,
      signature,
    });

    return {
      grant_id: grant.id,
      nonce: grant.nonce,
      expires_at: grant.expiresAt,
      max_input_tokens: grant.maxInputTokens,
      max_output_tokens: grant.maxOutputTokens,
      credit_limit: grant.creditLimit,
      signature: grant.signature,
    };
  }

  async recordUsageEvent(accessToken: string, input: UsageEventInput): Promise<{
    accepted: boolean;
    balance_after: number;
    debits: Array<{bucket: 'daily_free' | 'topup'; amount: number}>;
    balance_after_detail: CreditBalanceView;
    billing_summary: RunBillingSummaryView;
  }> {
    const user = await this.getUserForAccessToken(accessToken);
    const eventId = (input.event_id || '').trim();
    if (!eventId) {
      throw new HttpError(400, 'BAD_REQUEST', 'event_id is required');
    }
    const grantId = (input.grant_id || '').trim();
    if (!grantId) {
      throw new HttpError(400, 'BAD_REQUEST', 'grant_id is required');
    }

    const grant = await this.store.getRunGrantById(grantId);
    if (!grant || grant.userId !== user.id) {
      throw new HttpError(403, 'FORBIDDEN', 'run grant is invalid');
    }
    if (new Date(grant.expiresAt).getTime() <= Date.now()) {
      throw new HttpError(400, 'GRANT_EXPIRED', 'run grant is expired');
    }

    const inputTokens = Math.max(0, input.input_tokens || 0);
    const outputTokens = Math.max(0, input.output_tokens || 0);
    if (grant.maxInputTokens > 0 && inputTokens > grant.maxInputTokens) {
      throw new HttpError(400, 'INPUT_LIMIT_EXCEEDED', 'input token usage exceeded run grant limit');
    }
    if (grant.maxOutputTokens > 0 && outputTokens > grant.maxOutputTokens) {
      throw new HttpError(400, 'OUTPUT_LIMIT_EXCEEDED', 'output token usage exceeded run grant limit');
    }

    const normalizedModel = (input.model || '').trim();
    const normalizedAppName = (input.app_name || '').trim() || null;
    const billingMultiplier = await this.resolveBillingMultiplier(normalizedAppName, normalizedModel || null);
    const creditCost = this.computeBilledCreditCost(inputTokens, outputTokens, billingMultiplier);
    if (creditCost > grant.creditLimit) {
      throw new HttpError(402, 'CREDIT_LIMIT_EXCEEDED', 'usage exceeded run grant credit limit');
    }

    const usageInput = {
      event_id: eventId,
      grant_id: grantId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      credit_cost: creditCost,
      provider: (input.provider || '').trim(),
      model: normalizedModel,
      app_name: normalizedAppName || '',
      assistant_timestamp:
        typeof input.assistant_timestamp === 'number' && Number.isFinite(input.assistant_timestamp)
          ? Math.floor(input.assistant_timestamp)
          : undefined,
    };

    let result: UsageEventResult;
    try {
      result = await this.store.recordUsageEvent(user.id, usageInput);
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_CREDITS') {
        throw new HttpError(402, 'INSUFFICIENT_CREDITS', 'current balance is insufficient');
      }
      throw error;
    }
    const balanceAfterView: CreditBalanceView = {
      daily_free_balance: result.balanceAfter.dailyFreeBalance,
      topup_balance: result.balanceAfter.topupBalance,
      total_available_balance: result.balanceAfter.totalAvailableBalance,
      daily_free_quota: result.balanceAfter.dailyFreeQuota,
      daily_free_expires_at: result.balanceAfter.dailyFreeExpiresAt,
      balance: result.balanceAfter.totalAvailableBalance,
      currency: 'lobster_credit',
      currency_display: '龙虾币',
      available_balance: result.balanceAfter.totalAvailableBalance,
      status: 'active',
    };
    return {
      accepted: result.accepted,
      balance_after: result.balanceAfter.totalAvailableBalance,
      debits: result.debits,
      balance_after_detail: balanceAfterView,
      billing_summary: toRunBillingSummaryView(result.summary),
    };
  }

  async getRunBillingSummary(accessToken: string, grantIdInput: string): Promise<RunBillingSummaryView> {
    const user = await this.getUserForAccessToken(accessToken);
    const grantId = grantIdInput.trim();
    if (!grantId) {
      throw new HttpError(400, 'BAD_REQUEST', 'grant_id is required');
    }

    const grant = await this.store.getRunGrantById(grantId);
    if (!grant || grant.userId !== user.id) {
      throw new HttpError(404, 'NOT_FOUND', 'run grant not found');
    }

    const summary = await this.store.getRunBillingSummary(grantId);
    if (!summary) {
      throw new HttpError(404, 'NOT_FOUND', 'run billing summary not found');
    }

    return toRunBillingSummaryView(summary);
  }

  async listRunBillingSummariesBySession(
    accessToken: string,
    sessionKeyInput: string,
    limitInput?: number | null,
  ): Promise<RunBillingSummaryView[]> {
    const user = await this.getUserForAccessToken(accessToken);
    let sessionKey: string;
    try {
      sessionKey = toCanonicalSessionKey(sessionKeyInput);
    } catch {
      throw new HttpError(400, 'BAD_REQUEST', 'session_key must use canonical session identity');
    }
    const limit =
      typeof limitInput === 'number' && Number.isFinite(limitInput)
        ? Math.max(1, Math.min(500, Math.floor(limitInput)))
        : 200;
    const summaries = await this.store.listRunBillingSummariesBySession(user.id, sessionKey, limit);
    return summaries.map(toRunBillingSummaryView);
  }

  private async getUserForAccessToken(accessToken: string) {
    const token = accessToken.trim();
    if (!token) {
      throw new HttpError(401, 'UNAUTHORIZED', 'missing access token');
    }

    const session = await this.store.getSessionByAccessToken(hashOpaqueToken(token));
    const now = Date.now();
    const absoluteSessionExpiresAt = session ? this.getAbsoluteSessionExpiresAt(session.createdAt) : 0;
    if (!session || session.accessTokenExpiresAt <= now || absoluteSessionExpiresAt <= now) {
      throw new HttpError(401, 'UNAUTHORIZED', 'access token is invalid or expired');
    }

    const expiresAt = this.getSlidingSessionExpiresAt(session.createdAt, now);
    const renewedSession = await this.store.touchSession(session.id, expiresAt);
    if (!renewedSession) {
      throw new HttpError(401, 'UNAUTHORIZED', 'access token is invalid or expired');
    }

    const user = await this.store.getUserById(renewedSession.userId);
    if (!user) {
      throw new HttpError(401, 'UNAUTHORIZED', 'user not found');
    }
    return this.ensureBootstrapRole(user);
  }

  private async getOptionalUserForAccessToken(accessToken?: string | null) {
    const token = accessToken?.trim() || '';
    if (!token) {
      return null;
    }
    try {
      return await this.getUserForAccessToken(token);
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 401) {
        return null;
      }
      throw error;
    }
  }

  private async issueTokens(userId: string, clientType = 'desktop'): Promise<{payload: AuthTokens; refreshToken: string}> {
    const accessToken = generateOpaqueToken('at');
    const refreshToken = generateOpaqueToken('rt');
    const now = Date.now();
    const accessTokenExpiresAt = now + config.accessTokenTtlSeconds * 1000;
    const refreshTokenExpiresAt = now + config.refreshTokenTtlSeconds * 1000;

    await this.store.createSession(userId, {
      accessTokenHash: hashOpaqueToken(accessToken),
      refreshTokenHash: hashOpaqueToken(refreshToken),
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      deviceId: 'unknown',
      clientType,
    });

    return {
      payload: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: config.accessTokenTtlSeconds,
      },
      refreshToken,
    };
  }

  private async rotateTokens(
    refreshToken: string,
    sessionCreatedAt: string,
  ): Promise<{payload: AuthTokens; refreshToken: string}> {
    const accessToken = generateOpaqueToken('at');
    const nextRefreshToken = generateOpaqueToken('rt');
    const now = Date.now();
    const expiresAt = this.getSlidingSessionExpiresAt(sessionCreatedAt, now);

    const session = await this.store.replaceSession(hashOpaqueToken(refreshToken), {
      accessTokenHash: hashOpaqueToken(accessToken),
      refreshTokenHash: hashOpaqueToken(nextRefreshToken),
      accessTokenExpiresAt: expiresAt.accessTokenExpiresAt,
      refreshTokenExpiresAt: expiresAt.refreshTokenExpiresAt,
      deviceId: 'unknown',
      clientType: 'desktop',
    });
    if (!session) {
      throw new HttpError(401, 'UNAUTHORIZED', 'refresh token is invalid or expired');
    }

    return {
      payload: {
        access_token: accessToken,
        refresh_token: nextRefreshToken,
        expires_in: Math.max(1, Math.ceil((expiresAt.accessTokenExpiresAt - now) / 1000)),
      },
      refreshToken: nextRefreshToken,
    };
  }

  private getAbsoluteSessionExpiresAt(sessionCreatedAt: string): number {
    return new Date(sessionCreatedAt).getTime() + config.sessionAbsoluteTtlSeconds * 1000;
  }

  private getSlidingSessionExpiresAt(
    sessionCreatedAt: string,
    now: number,
  ): {
    accessTokenExpiresAt: number;
    refreshTokenExpiresAt: number;
  } {
    const absoluteSessionExpiresAt = this.getAbsoluteSessionExpiresAt(sessionCreatedAt);
    return {
      accessTokenExpiresAt: Math.min(absoluteSessionExpiresAt, now + config.accessTokenTtlSeconds * 1000),
      refreshTokenExpiresAt: Math.min(absoluteSessionExpiresAt, now + config.refreshTokenTtlSeconds * 1000),
    };
  }

  private computeCreditCost(inputTokens: number, outputTokens: number): number {
    const inputCost = Math.ceil((Math.max(0, inputTokens) / 1000) * config.creditCostInputPer1k);
    const outputCost = Math.ceil((Math.max(0, outputTokens) / 1000) * config.creditCostOutputPer1k);
    return Math.max(0, inputCost + outputCost);
  }

  private computeBilledCreditCost(inputTokens: number, outputTokens: number, billingMultiplier: number): number {
    const baseCost = this.computeCreditCost(inputTokens, outputTokens);
    if (baseCost <= 0) {
      return 0;
    }
    return Math.max(1, Math.ceil(baseCost * (billingMultiplier > 0 ? billingMultiplier : 1)));
  }

  private estimateQuoteInputTokens(input: {
    message: string;
    historyMessages: number;
    attachments: CreditQuoteInput['attachments'];
    hasSearch: boolean;
    hasTools: boolean;
  }): number {
    const basePromptTokens = 220;
    const messageTokens = this.estimateTokensFromText(input.message);
    const historyTokens = input.historyMessages * 120;
    const toolTokens = input.hasTools ? 24_000 : 0;
    const searchTokens = input.hasSearch ? 128_000 : 0;
    const attachmentTokens = (input.attachments || []).reduce((sum, item) => {
      const chars = Math.max(0, item?.chars || 0);
      const inferredTextTokens = chars > 0 ? Math.ceil(chars * 0.75) : 0;
      const type = (item?.type || '').trim().toLowerCase();
      const typeOverhead =
        type === 'pdf' ? 700 : type === 'image' ? 220 : type === 'video' ? 480 : type ? 260 : 180;
      return sum + typeOverhead + inferredTextTokens;
    }, 0);

    return Math.max(1, basePromptTokens + messageTokens + historyTokens + searchTokens + toolTokens + attachmentTokens);
  }

  private estimateQuoteOutputTokens(input: {
    message: string;
    historyMessages: number;
    attachmentCount: number;
    hasSearch: boolean;
    hasTools: boolean;
  }): {low: number; high: number; max: number} {
    const messageTokens = this.estimateTokensFromText(input.message);
    const base =
      220 +
      Math.round(messageTokens * 0.45) +
      input.historyMessages * 20 +
      input.attachmentCount * 90 +
      (input.hasSearch ? 520 : 0) +
      (input.hasTools ? 260 : 0);

    const low = Math.max(120, Math.round(base * 0.72));
    const high = Math.max(low, Math.round(base * 1.2));
    const max = Math.max(high, Math.round(base * 1.7));

    return {low, high, max};
  }

  private estimateTokensFromText(text: string): number {
    const normalized = text.trim();
    if (!normalized) {
      return 0;
    }

    const cjkMatches = normalized.match(/[\u3400-\u9fff]/g) || [];
    const latinWords = normalized
      .replace(/[\u3400-\u9fff]/g, ' ')
      .match(/[A-Za-z0-9_]+/g) || [];
    const punctuationChars = normalized.replace(/[\u3400-\u9fffA-Za-z0-9_\s]/g, '').length;
    const whitespaceChars = normalized.match(/\s/g)?.length || 0;

    return Math.max(
      1,
      Math.ceil(cjkMatches.length * 1.15 + latinWords.length * 1.25 + punctuationChars * 0.35 + whitespaceChars * 0.08),
    );
  }

  private async resolveBillingMultiplier(appName: string | null, model: string | null): Promise<number> {
    const multiplier = await this.resolveBillingMultiplierForModel(appName, model);
    return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  }

  private resolveBootstrapRole(email: string): UserRole | null {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (config.superAdminEmails.includes(normalized)) {
      return 'super_admin';
    }
    if (config.adminEmails.includes(normalized)) {
      return 'admin';
    }
    return null;
  }

  private async ensureBootstrapRole(user: UserRecord): Promise<UserRecord> {
    const targetRole = this.resolveBootstrapRole(user.email);
    if (!targetRole || rolePriority(user.role) >= rolePriority(targetRole)) {
      return user;
    }
    const updated = await this.store.updateUserRole(user.id, targetRole);
    return updated || user;
  }

  private resolveConfiguredPaymentProviderProfile(
    scopeType: PaymentProviderScopeType,
    profile: PaymentProviderProfileRecord | null,
  ): ResolvedPaymentProviderProfile | null {
    if (!profile || !profile.enabled) {
      return null;
    }
    const missingFields = paymentProviderRequiredFields(profile);
    if (missingFields.length > 0) {
      return null;
    }
    return {
      scopeType,
      profile,
      missingFields,
    };
  }

  private async resolvePaymentProviderProfileForOrder(
    provider: PaymentProvider,
    appName: string | null,
  ): Promise<{
    resolved: ResolvedPaymentProviderProfile | null;
    metadata: Record<string, unknown>;
  }> {
    const normalizedAppName = String(appName || '')
      .trim()
      .toLowerCase();
    let candidateMissingFields: string[] = [];
    let bindingMode: PaymentProviderBindingMode | null = null;

    if (normalizedAppName) {
      const binding = await this.store.getPaymentProviderBinding(normalizedAppName, provider);
      bindingMode = binding?.mode || null;
      if (binding?.mode === 'use_app_profile') {
        const appProfile =
          (binding.activeProfileId ? await this.store.getPaymentProviderProfileById(binding.activeProfileId) : null) ||
          (await this.store.getPaymentProviderProfileByScope(provider, 'app', normalizedAppName));
        const appResolved = this.resolveConfiguredPaymentProviderProfile('app', appProfile);
        if (appResolved) {
          return {
            resolved: appResolved,
            metadata: {
              payment_profile_status: 'resolved',
              payment_profile_scope: appResolved.scopeType,
              payment_profile_id: appResolved.profile.id,
              payment_profile_display_name: appResolved.profile.displayName,
              payment_profile_channel_kind: appResolved.profile.channelKind,
              payment_profile_binding_mode: bindingMode,
            },
          };
        }
        if (appProfile) {
          candidateMissingFields = paymentProviderRequiredFields(appProfile);
        }
      }
    }

    const platformProfile = await this.store.getPaymentProviderProfileByScope(provider, 'platform', 'platform');
    const platformResolved = this.resolveConfiguredPaymentProviderProfile('platform', platformProfile);
    if (platformResolved) {
      return {
        resolved: platformResolved,
        metadata: {
          payment_profile_status: 'resolved',
          payment_profile_scope: platformResolved.scopeType,
          payment_profile_id: platformResolved.profile.id,
          payment_profile_display_name: platformResolved.profile.displayName,
          payment_profile_channel_kind: platformResolved.profile.channelKind,
          payment_profile_binding_mode: bindingMode,
        },
      };
    }

    const missingFields = candidateMissingFields.length
      ? candidateMissingFields
      : platformProfile
        ? paymentProviderRequiredFields(platformProfile)
        : [];
    return {
      resolved: null,
      metadata: {
        payment_profile_status: 'missing',
        payment_profile_scope: null,
        payment_profile_id: null,
        payment_profile_display_name: null,
        payment_profile_channel_kind: null,
        payment_profile_binding_mode: bindingMode,
        payment_profile_missing_fields: missingFields,
      },
    };
  }

  private async requireAdminUser(accessToken: string): Promise<UserRecord> {
    const user = await this.getUserForAccessToken(accessToken);
    if (rolePriority(user.role) < rolePriority('admin')) {
      throw new HttpError(403, 'FORBIDDEN', 'admin access required');
    }
    return user;
  }

  private async createOAuthUser(profile: {
    email?: string;
    name: string;
    providerId: string;
    provider: OAuthProvider;
    avatarUrl?: string;
  }) {
    const email = normalizeIdentifier(
      profile.email || `${profile.provider}_${profile.providerId}@oauth.local`,
      'email',
    );
    const displayName = profile.name.trim() || `${profile.provider} user`;
    const seed = isRealEmail(email) ? email.split('@')[0] : `${profile.provider}_${profile.providerId.slice(0, 8)}`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = attempt === 0 ? '' : `_${profile.providerId.slice(attempt, attempt + 4)}`;
      const username = slugifyUsername(`${seed}${suffix}`).slice(0, 32);
      try {
        return await this.store.createUser({
          username,
          email,
          displayName,
          avatarUrl: profile.avatarUrl,
          passwordHash: null,
          role: this.resolveBootstrapRole(email) || 'user',
          initialCreditBalance: config.defaultCreditBalance,
        });
      } catch (error) {
        const code =
          error instanceof Error
            ? error.message
            : typeof error === 'object' && error && 'code' in error
              ? String((error as {code?: string}).code)
              : '';
        if (code === 'USERNAME_TAKEN' || code === '23505') {
          continue;
        }
        throw error;
      }
    }

    throw new HttpError(500, 'USERNAME_GENERATION_FAILED', 'failed to generate username for oauth user');
  }
}
