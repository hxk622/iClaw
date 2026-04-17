export type UserRole = 'user' | 'admin' | 'super_admin';

export type DesktopActionPolicyScope = 'platform' | 'oem' | 'org';
export type DesktopActionPolicyEffect = 'allow' | 'allow_with_approval' | 'deny';
export type DesktopActionRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type DesktopActionGrantScope = 'once' | 'task' | 'session' | 'ttl';
export type DesktopActionAuditDecision = 'allow' | 'deny' | 'pending';
export type DesktopActionAccessMode = 'read' | 'write' | 'execute' | 'connect';
export type DesktopActionExecutorType = 'template' | 'shell' | 'browser' | 'filesystem' | 'process' | 'upload';
export type DesktopActionRiskClass = 'L1' | 'L2' | 'L3' | 'L4';
export type DesktopActionAuditStage =
  | 'intent_created'
  | 'policy_evaluated'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_denied'
  | 'plan_mismatch_denied'
  | 'execution_started'
  | 'execution_finished';
export type DesktopDiagnosticUploadSourceType = 'manual' | 'auto_error_capture' | 'approval_flow';

export type DesktopFaultReportEntry = 'installer' | 'exception-dialog';
export type DesktopFaultReportAccountState = 'anonymous' | 'authenticated';
export type ClientMetricEventResult = 'success' | 'failed';
export type ClientCrashType = 'native' | 'renderer' | 'sidecar';
export type ClientPerfMetricName =
  | 'cold_start_ms'
  | 'warm_start_ms'
  | 'page_load_ms'
  | 'api_latency_ms'
  | 'memory_mb'
  | 'cpu_percent';

export type DesktopActionNetworkDestination = {
  scheme: string;
  host: string;
  port: number | null;
  pathPrefix: string | null;
  redirectPolicy: 'none' | 'same-origin-only' | 'allowlisted';
};

export type UserRecord = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  passwordHash: string | null;
  role: UserRole;
  status: 'active';
  createdAt: string;
  updatedAt: string;
};

export type OAuthProvider = 'wechat' | 'google';

export type CreditBucket = 'daily_free' | 'topup';
export type CreditLedgerDirection = 'grant' | 'consume' | 'topup' | 'refund' | 'expire';
export type CreditLedgerReferenceType =
  | 'daily_reset'
  | 'trial_grant'
  | 'topup_order'
  | 'usage_quote'
  | 'chat_run'
  | 'agent_run'
  | 'manual_adjustment';

export type CreditAccountRecord = {
  userId: string;
  dailyFreeBalance: number;
  topupBalance: number;
  dailyFreeQuota: number;
  totalAvailableBalance: number;
  dailyFreeGrantedAt: string;
  dailyFreeExpiresAt: string;
  status: 'active';
  createdAt: string;
  updatedAt: string;
};

export type CreditLedgerRecord = {
  id: string;
  userId: string;
  bucket: CreditBucket;
  direction: CreditLedgerDirection;
  amount: number;
  balanceAfter: number;
  referenceType: CreditLedgerReferenceType;
  referenceId: string | null;
  eventType: string;
  delta: number;
  assistantTimestamp?: number | null;
  createdAt: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  accessTokenHash: string;
  refreshTokenHash: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  createdAt: string;
};

export type CreateUserInput = {
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  passwordHash?: string | null;
  role?: UserRole;
  initialCreditBalance: number;
};

export type SessionTokenPair = {
  accessTokenHash: string;
  refreshTokenHash: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  deviceId: string;
  clientType: string;
};

export type CreditBalanceView = {
  daily_free_balance: number;
  topup_balance: number;
  total_available_balance: number;
  daily_free_quota: number;
  daily_free_expires_at: string;
  balance: number;
  currency: 'lobster_credit';
  currency_display: '龙虾币';
  available_balance: number;
  status: 'active';
};

export type CreditLedgerItemView = {
  id: string;
  bucket: CreditBucket;
  direction: CreditLedgerDirection;
  amount: number;
  reference_type: CreditLedgerReferenceType;
  reference_id: string | null;
  event_type: string;
  delta: number;
  balance_after: number;
  created_at: string;
};

export type CreditQuoteAttachmentInput = {
  type?: string;
  chars?: number;
};

export type UserFileStatus = 'active' | 'deleted';

export type UserFileRecord = {
  id: string;
  userId: string;
  tenantId: string;
  kind: string;
  status: UserFileStatus;
  storageProvider: 'minio';
  objectKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  source: string | null;
  taskId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type UserFileView = {
  file_id: string;
  tenant_id: string;
  kind: string;
  status: UserFileStatus;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  source: string | null;
  task_id: string | null;
  url: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CreditQuoteInput = {
  message?: string;
  model?: string;
  app_name?: string;
  history_messages?: number;
  has_search?: boolean;
  has_tools?: boolean;
  attachments?: CreditQuoteAttachmentInput[];
};

export type CreditQuoteView = {
  currency: 'lobster_credit';
  currency_display: '龙虾币';
  estimated_credits_low: number;
  estimated_credits_high: number;
  max_charge_credits: number;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  daily_free_cover_credits: number;
  topup_cover_credits: number;
  payable_credits: number;
  balance_after_estimate: number;
  balance_after_max: number;
  model: string | null;
};

export type RunGrantRecord = {
  id: string;
  userId: string;
  sessionKey: string;
  client: string;
  status: 'issued' | 'settled';
  nonce: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  creditLimit: number;
  expiresAt: string;
  usedAt: string | null;
  signature: string;
  billingSummary: RunBillingSummaryRecord | null;
  createdAt: string;
};

export type OAuthAccountRecord = {
  userId: string;
  provider: OAuthProvider;
  providerId: string;
  createdAt: string;
};

export type RunGrantView = {
  grant_id: string;
  nonce: string;
  expires_at: string;
  max_input_tokens: number;
  max_output_tokens: number;
  credit_limit: number;
  signature: string;
};

export type UsageEventRecord = {
  id: string;
  eventId: string;
  userId: string;
  runGrantId: string | null;
  inputTokens: number;
  outputTokens: number;
  creditCost: number;
  provider: string | null;
  model: string | null;
  createdAt: string;
};

export type RunBillingSummaryRecord = {
  grantId: string;
  eventId: string;
  sessionKey: string;
  client: string;
  status: 'settled';
  inputTokens: number;
  outputTokens: number;
  creditCost: number;
  provider: string | null;
  model: string | null;
  balanceAfter: number;
  settledAt: string;
  assistantTimestamp: number | null;
};

export type ChatConversationKind =
  | 'general'
  | 'skill'
  | 'lobster'
  | 'investment-expert'
  | 'stock-research'
  | 'fund-research'
  | 'task';

export type ChatConversationRecord = {
  id: string;
  userId: string;
  appName: string;
  kind: ChatConversationKind;
  title: string | null;
  activeSessionKey: string;
  status: 'active' | 'archived';
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ChatConversationSessionRecord = {
  id: string;
  conversationId: string;
  sessionKey: string;
  isActive: boolean;
  joinedAt: string;
  leftAt: string | null;
  joinReason: string | null;
  metadata: Record<string, unknown>;
};

export type ChatConversationHandoffRecord = {
  id: string;
  conversationId: string;
  fromSessionKey: string;
  toSessionKey: string;
  reason: string;
  summary: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type UsageDebitRecord = {
  bucket: CreditBucket;
  amount: number;
};

export type UsageEventResult = {
  accepted: boolean;
  balanceAfter: CreditAccountRecord;
  debits: UsageDebitRecord[];
  summary: RunBillingSummaryRecord;
};

export type PaymentProvider = 'mock' | 'wechat_qr' | 'alipay_qr';
export type PaymentOrderStatus = 'created' | 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
export type PaymentProviderScopeType = 'platform' | 'app';
export type PaymentProviderChannelKind = 'wechat_service_provider';
export type PaymentProviderBindingMode = 'inherit_platform' | 'use_app_profile';

export type PaymentOrderRecord = {
  id: string;
  userId: string;
  provider: PaymentProvider;
  packageId: string;
  packageName: string;
  credits: number;
  bonusCredits: number;
  amountCnyFen: number;
  currency: 'cny';
  status: PaymentOrderStatus;
  providerOrderId: string | null;
  providerPrepayId: string | null;
  paymentUrl: string | null;
  appName: string | null;
  appVersion: string | null;
  releaseChannel: string | null;
  platform: string | null;
  arch: string | null;
  returnUrl: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  paidAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentOrderView = {
  order_id: string;
  status: PaymentOrderStatus;
  provider: PaymentProvider;
  package_id: string;
  package_name: string;
  credits: number;
  bonus_credits: number;
  total_credits: number;
  amount_cny_fen: number;
  payment_url: string | null;
  app_name: string | null;
  paid_at: string | null;
  expires_at: string | null;
};

export type CreatePaymentOrderInput = {
  provider?: string;
  package_id?: string;
  return_url?: string;
  app_name?: string;
  app_version?: string;
  release_channel?: string;
  platform?: string;
  arch?: string;
  user_agent?: string;
};

export type PaymentWebhookInput = {
  event_id?: string;
  order_id?: string;
  provider_order_id?: string;
  status?: string;
  paid_at?: string;
};

export type PaymentWebhookEventRecord = {
  id: string;
  provider: PaymentProvider;
  eventId: string;
  eventType: string | null;
  orderId: string | null;
  payload: Record<string, unknown>;
  signature: string | null;
  processedAt: string | null;
  processStatus: string;
  createdAt: string;
};

export type PaymentProviderProfileRecord = {
  id: string;
  provider: PaymentProvider;
  scopeType: PaymentProviderScopeType;
  scopeKey: string;
  channelKind: PaymentProviderChannelKind;
  displayName: string;
  enabled: boolean;
  config: Record<string, unknown>;
  configuredSecretKeys: string[];
  secretPayloadEncrypted: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentProviderBindingRecord = {
  appName: string;
  provider: PaymentProvider;
  mode: PaymentProviderBindingMode;
  activeProfileId: string | null;
  updatedAt: string;
};

export type DesktopActionPolicyRuleRecord = {
  id: string;
  scope: DesktopActionPolicyScope;
  scopeId: string | null;
  name: string;
  effect: DesktopActionPolicyEffect;
  capability: string;
  riskLevel: DesktopActionRiskLevel;
  officialOnly: boolean;
  publisherIds: string[];
  packageDigests: string[];
  skillSlugs: string[];
  workflowIds: string[];
  executorTypes: DesktopActionExecutorType[];
  executorTemplateIds: string[];
  canonicalPathPrefixes: string[];
  networkDestinations: DesktopActionNetworkDestination[];
  accessModes: DesktopActionAccessMode[];
  allowElevation: boolean;
  allowNetworkEgress: boolean;
  grantScope: DesktopActionGrantScope;
  maxGrantScope: DesktopActionGrantScope;
  ttlSeconds: number | null;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

export type DesktopActionApprovalGrantRecord = {
  id: string;
  userId: string;
  deviceId: string;
  appName: string;
  intentFingerprint: string;
  approvedPlanHash: string;
  capability: string;
  riskLevel: DesktopActionRiskLevel;
  accessModes: DesktopActionAccessMode[];
  normalizedResources: Array<Record<string, unknown>>;
  networkDestinations: DesktopActionNetworkDestination[];
  executorType: DesktopActionExecutorType;
  executorTemplateId: string | null;
  publisherId: string | null;
  packageDigest: string | null;
  scope: DesktopActionGrantScope;
  taskId: string | null;
  sessionKey: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type DesktopActionAuditEventRecord = {
  id: string;
  intentId: string;
  traceId: string;
  userId: string | null;
  deviceId: string;
  appName: string;
  agentId: string | null;
  skillSlug: string | null;
  workflowId: string | null;
  capability: string;
  riskLevel: DesktopActionRiskLevel;
  requiresElevation: boolean;
  decision: DesktopActionAuditDecision;
  stage: DesktopActionAuditStage;
  summary: string;
  reason: string | null;
  resources: Array<Record<string, unknown>>;
  matchedPolicyRuleId: string | null;
  approvedPlanHash: string | null;
  executedPlanHash: string | null;
  commandSnapshotRedacted: string | null;
  resultCode: string | null;
  resultSummary: string | null;
  durationMs: number | null;
  createdAt: string;
};

export type DesktopDiagnosticUploadRecord = {
  id: string;
  userId: string | null;
  deviceId: string;
  appName: string;
  uploadBucket: string;
  uploadKey: string;
  fileName: string;
  fileSizeBytes: number;
  sha256: string | null;
  sourceType: DesktopDiagnosticUploadSourceType;
  containsCustomerLogs: boolean;
  sensitivityLevel: 'customer' | 'internal' | 'redacted';
  linkedIntentId: string | null;
  createdAt: string;
};

export type DesktopFaultReportRecord = {
  id: string;
  reportId: string;
  entry: DesktopFaultReportEntry;
  accountState: DesktopFaultReportAccountState;
  userId: string | null;
  username: string | null;
  userDisplayName: string | null;
  deviceId: string;
  installSessionId: string | null;
  appName: string;
  brandId: string;
  appVersion: string;
  releaseChannel: string | null;
  platform: string;
  platformVersion: string | null;
  arch: string;
  failureStage: string;
  errorTitle: string;
  errorMessage: string;
  errorCode: string | null;
  runtimeFound: boolean;
  runtimeInstallable: boolean;
  runtimeVersion: string | null;
  runtimePath: string | null;
  workDir: string | null;
  logDir: string | null;
  runtimeDownloadUrl: string | null;
  installProgressPhase: string | null;
  installProgressPercent: number | null;
  uploadBucket: string;
  uploadKey: string;
  fileName: string;
  fileSizeBytes: number;
  fileSha256: string | null;
  createdAt: string;
};

export type ClientMetricEventRecord = {
  id: string;
  eventName: string;
  eventTime: string;
  userId: string | null;
  deviceId: string;
  sessionId: string | null;
  installId: string | null;
  appName: string;
  brandId: string;
  appVersion: string;
  releaseChannel: string | null;
  platform: string;
  osVersion: string | null;
  arch: string;
  page: string | null;
  result: ClientMetricEventResult | null;
  errorCode: string | null;
  durationMs: number | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ClientCrashEventRecord = {
  id: string;
  crashType: ClientCrashType;
  eventTime: string;
  userId: string | null;
  deviceId: string;
  appName: string;
  brandId: string;
  appVersion: string;
  platform: string;
  osVersion: string | null;
  arch: string;
  errorTitle: string | null;
  errorMessage: string | null;
  stackSummary: string | null;
  fileBucket: string | null;
  fileKey: string | null;
  createdAt: string;
};

export type ClientPerfSampleRecord = {
  id: string;
  metricName: ClientPerfMetricName;
  metricTime: string;
  userId: string | null;
  deviceId: string;
  appName: string;
  brandId: string;
  appVersion: string;
  releaseChannel: string | null;
  platform: string;
  osVersion: string | null;
  arch: string;
  value: number;
  unit: string;
  sampleRate: number | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AdminDesktopActionPolicyRuleView = {
  id: string;
  scope: DesktopActionPolicyScope;
  scope_id: string | null;
  name: string;
  effect: DesktopActionPolicyEffect;
  capability: string;
  risk_level: DesktopActionRiskLevel;
  official_only: boolean;
  publisher_ids: string[];
  package_digests: string[];
  skill_slugs: string[];
  workflow_ids: string[];
  executor_types: DesktopActionExecutorType[];
  executor_template_ids: string[];
  canonical_path_prefixes: string[];
  network_destinations: DesktopActionNetworkDestination[];
  access_modes: DesktopActionAccessMode[];
  allow_elevation: boolean;
  allow_network_egress: boolean;
  grant_scope: DesktopActionGrantScope;
  max_grant_scope: DesktopActionGrantScope;
  ttl_seconds: number | null;
  enabled: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
};

export type AdminDesktopActionApprovalGrantView = {
  id: string;
  user_id: string;
  device_id: string;
  app_name: string;
  intent_fingerprint: string;
  approved_plan_hash: string;
  capability: string;
  risk_level: DesktopActionRiskLevel;
  access_modes: DesktopActionAccessMode[];
  normalized_resources: Array<Record<string, unknown>>;
  network_destinations: DesktopActionNetworkDestination[];
  executor_type: DesktopActionExecutorType;
  executor_template_id: string | null;
  publisher_id: string | null;
  package_digest: string | null;
  scope: DesktopActionGrantScope;
  task_id: string | null;
  session_key: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type AdminDesktopActionAuditEventView = {
  id: string;
  intent_id: string;
  trace_id: string;
  user_id: string | null;
  device_id: string;
  app_name: string;
  agent_id: string | null;
  skill_slug: string | null;
  workflow_id: string | null;
  capability: string;
  risk_level: DesktopActionRiskLevel;
  requires_elevation: boolean;
  decision: DesktopActionAuditDecision;
  stage: DesktopActionAuditStage;
  summary: string;
  reason: string | null;
  resources: Array<Record<string, unknown>>;
  matched_policy_rule_id: string | null;
  approved_plan_hash: string | null;
  executed_plan_hash: string | null;
  command_snapshot_redacted: string | null;
  result_code: string | null;
  result_summary: string | null;
  duration_ms: number | null;
  created_at: string;
};

export type AdminDesktopDiagnosticUploadView = {
  id: string;
  user_id: string | null;
  device_id: string;
  app_name: string;
  upload_bucket: string;
  upload_key: string;
  file_name: string;
  file_size_bytes: number;
  sha256: string | null;
  source_type: DesktopDiagnosticUploadSourceType;
  contains_customer_logs: boolean;
  sensitivity_level: 'customer' | 'internal' | 'redacted';
  linked_intent_id: string | null;
  created_at: string;
};

export type AdminDesktopFaultReportSummaryView = {
  id: string;
  report_id: string;
  entry: DesktopFaultReportEntry;
  account_state: DesktopFaultReportAccountState;
  user_id: string | null;
  username: string | null;
  user_display_name: string | null;
  device_id: string;
  install_session_id: string | null;
  app_name: string;
  brand_id: string;
  app_version: string;
  release_channel: string | null;
  platform: string;
  platform_version: string | null;
  arch: string;
  failure_stage: string;
  error_title: string;
  error_message: string;
  error_code: string | null;
  file_name: string;
  file_size_bytes: number;
  file_sha256: string | null;
  created_at: string;
};

export type AdminDesktopFaultReportDetailView = AdminDesktopFaultReportSummaryView & {
  runtime_found: boolean;
  runtime_installable: boolean;
  runtime_version: string | null;
  runtime_path: string | null;
  work_dir: string | null;
  log_dir: string | null;
  runtime_download_url: string | null;
  install_progress_phase: string | null;
  install_progress_percent: number | null;
  upload_bucket: string;
  upload_key: string;
  download_url: string;
};

export type AdminClientMetricEventView = {
  id: string;
  event_name: string;
  event_time: string;
  user_id: string | null;
  device_id: string;
  session_id: string | null;
  install_id: string | null;
  app_name: string;
  brand_id: string;
  app_version: string;
  release_channel: string | null;
  platform: string;
  os_version: string | null;
  arch: string;
  page: string | null;
  result: ClientMetricEventResult | null;
  error_code: string | null;
  duration_ms: number | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type AdminClientCrashEventView = {
  id: string;
  crash_type: ClientCrashType;
  event_time: string;
  user_id: string | null;
  device_id: string;
  app_name: string;
  brand_id: string;
  app_version: string;
  platform: string;
  os_version: string | null;
  arch: string;
  error_title: string | null;
  error_message: string | null;
  stack_summary: string | null;
  file_bucket: string | null;
  file_key: string | null;
  created_at: string;
};

export type AdminClientPerfSampleView = {
  id: string;
  metric_name: ClientPerfMetricName;
  metric_time: string;
  user_id: string | null;
  device_id: string;
  app_name: string;
  brand_id: string;
  app_version: string;
  release_channel: string | null;
  platform: string;
  os_version: string | null;
  arch: string;
  value: number;
  unit: string;
  sample_rate: number | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type UpsertDesktopActionPolicyRuleInput = {
  id?: string | null;
  scope?: DesktopActionPolicyScope | null;
  scope_id?: string | null;
  name?: string | null;
  effect?: DesktopActionPolicyEffect | null;
  capability?: string | null;
  risk_level?: DesktopActionRiskLevel | null;
  official_only?: boolean | null;
  publisher_ids?: string[] | null;
  package_digests?: string[] | null;
  skill_slugs?: string[] | null;
  workflow_ids?: string[] | null;
  executor_types?: DesktopActionExecutorType[] | null;
  executor_template_ids?: string[] | null;
  canonical_path_prefixes?: string[] | null;
  network_destinations?: DesktopActionNetworkDestination[] | null;
  access_modes?: DesktopActionAccessMode[] | null;
  allow_elevation?: boolean | null;
  allow_network_egress?: boolean | null;
  grant_scope?: DesktopActionGrantScope | null;
  max_grant_scope?: DesktopActionGrantScope | null;
  ttl_seconds?: number | null;
  enabled?: boolean | null;
  priority?: number | null;
};

export type CreateDesktopActionApprovalGrantInput = {
  user_id?: string | null;
  device_id?: string | null;
  app_name?: string | null;
  intent_fingerprint?: string | null;
  approved_plan_hash?: string | null;
  capability?: string | null;
  risk_level?: DesktopActionRiskLevel | null;
  access_modes?: DesktopActionAccessMode[] | null;
  normalized_resources?: Array<Record<string, unknown>> | null;
  network_destinations?: DesktopActionNetworkDestination[] | null;
  executor_type?: DesktopActionExecutorType | null;
  executor_template_id?: string | null;
  publisher_id?: string | null;
  package_digest?: string | null;
  scope?: DesktopActionGrantScope | null;
  task_id?: string | null;
  session_key?: string | null;
  expires_at?: string | null;
};

export type CreateDesktopActionAuditEventInput = {
  id?: string | null;
  intent_id?: string | null;
  trace_id?: string | null;
  user_id?: string | null;
  device_id?: string | null;
  app_name?: string | null;
  agent_id?: string | null;
  skill_slug?: string | null;
  workflow_id?: string | null;
  capability?: string | null;
  risk_level?: DesktopActionRiskLevel | null;
  requires_elevation?: boolean | null;
  decision?: DesktopActionAuditDecision | null;
  stage?: DesktopActionAuditStage | null;
  summary?: string | null;
  reason?: string | null;
  resources?: Array<Record<string, unknown>> | null;
  matched_policy_rule_id?: string | null;
  approved_plan_hash?: string | null;
  executed_plan_hash?: string | null;
  command_snapshot_redacted?: string | null;
  result_code?: string | null;
  result_summary?: string | null;
  duration_ms?: number | null;
  created_at?: string | null;
};

export type CreateDesktopDiagnosticUploadInput = {
  id?: string | null;
  user_id?: string | null;
  device_id?: string | null;
  app_name?: string | null;
  upload_bucket?: string | null;
  upload_key?: string | null;
  file_name?: string | null;
  file_size_bytes?: number | null;
  sha256?: string | null;
  source_type?: DesktopDiagnosticUploadSourceType | null;
  contains_customer_logs?: boolean | null;
  sensitivity_level?: 'customer' | 'internal' | 'redacted' | null;
  linked_intent_id?: string | null;
  created_at?: string | null;
};

export type CreateDesktopFaultReportInput = {
  id?: string | null;
  report_id?: string | null;
  entry?: DesktopFaultReportEntry | null;
  account_state?: DesktopFaultReportAccountState | null;
  user_id?: string | null;
  device_id?: string | null;
  install_session_id?: string | null;
  app_name?: string | null;
  brand_id?: string | null;
  app_version?: string | null;
  release_channel?: string | null;
  platform?: string | null;
  platform_version?: string | null;
  arch?: string | null;
  failure_stage?: string | null;
  error_title?: string | null;
  error_message?: string | null;
  error_code?: string | null;
  runtime_found?: boolean | null;
  runtime_installable?: boolean | null;
  runtime_version?: string | null;
  runtime_path?: string | null;
  work_dir?: string | null;
  log_dir?: string | null;
  runtime_download_url?: string | null;
  install_progress_phase?: string | null;
  install_progress_percent?: number | null;
  upload_bucket?: string | null;
  upload_key?: string | null;
  file_name?: string | null;
  file_size_bytes?: number | null;
  file_sha256?: string | null;
  created_at?: string | null;
};

export type CreateClientMetricEventInput = {
  id?: string | null;
  event_name?: string | null;
  event_time?: string | null;
  user_id?: string | null;
  device_id?: string | null;
  session_id?: string | null;
  install_id?: string | null;
  app_name?: string | null;
  brand_id?: string | null;
  app_version?: string | null;
  release_channel?: string | null;
  platform?: string | null;
  os_version?: string | null;
  arch?: string | null;
  page?: string | null;
  result?: ClientMetricEventResult | null;
  error_code?: string | null;
  duration_ms?: number | null;
  payload_json?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type CreateClientCrashEventInput = {
  id?: string | null;
  crash_type?: ClientCrashType | null;
  event_time?: string | null;
  user_id?: string | null;
  device_id?: string | null;
  app_name?: string | null;
  brand_id?: string | null;
  app_version?: string | null;
  platform?: string | null;
  os_version?: string | null;
  arch?: string | null;
  error_title?: string | null;
  error_message?: string | null;
  stack_summary?: string | null;
  file_bucket?: string | null;
  file_key?: string | null;
  created_at?: string | null;
};

export type CreateClientPerfSampleInput = {
  id?: string | null;
  metric_name?: ClientPerfMetricName | null;
  metric_time?: string | null;
  user_id?: string | null;
  device_id?: string | null;
  app_name?: string | null;
  brand_id?: string | null;
  app_version?: string | null;
  release_channel?: string | null;
  platform?: string | null;
  os_version?: string | null;
  arch?: string | null;
  value?: number | null;
  unit?: string | null;
  sample_rate?: number | null;
  payload_json?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type AdminPaymentOrderSummaryRecord = PaymentOrderRecord & {
  username: string;
  userEmail: string;
  userDisplayName: string;
  webhookEventCount: number;
  latestWebhookAt: string | null;
};

export type AdminPaymentOrderDetailRecord = AdminPaymentOrderSummaryRecord & {
  webhookEvents: PaymentWebhookEventRecord[];
};

export type AdminPaymentOrderSummaryView = {
  order_id: string;
  status: PaymentOrderStatus;
  provider: PaymentProvider;
  package_id: string;
  package_name: string;
  credits: number;
  bonus_credits: number;
  total_credits: number;
  amount_cny_fen: number;
  currency: 'cny';
  payment_url: string | null;
  app_name: string | null;
  app_version: string | null;
  release_channel: string | null;
  platform: string | null;
  arch: string | null;
  return_url: string | null;
  user_agent: string | null;
  provider_order_id: string | null;
  provider_prepay_id: string | null;
  user_id: string;
  username: string;
  user_email: string;
  user_display_name: string;
  webhook_event_count: number;
  latest_webhook_at: string | null;
  paid_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type PaymentWebhookEventView = {
  id: string;
  provider: PaymentProvider;
  event_id: string;
  event_type: string | null;
  order_id: string | null;
  payload: Record<string, unknown>;
  signature: string | null;
  processed_at: string | null;
  process_status: string;
  created_at: string;
};

export type AdminPaymentOrderDetailView = AdminPaymentOrderSummaryView & {
  webhook_events: PaymentWebhookEventView[];
};

export type AdminPaymentProviderProfileView = {
  id: string;
  provider: PaymentProvider;
  scope_type: PaymentProviderScopeType;
  scope_key: string;
  channel_kind: PaymentProviderChannelKind;
  display_name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  configured_secret_keys: string[];
  completeness_status: 'configured' | 'missing';
  missing_fields: string[];
  created_at: string;
  updated_at: string;
};

export type AdminPaymentProviderBindingView = {
  app_name: string;
  provider: PaymentProvider;
  mode: PaymentProviderBindingMode;
  active_profile_id: string | null;
  updated_at: string;
};

export type AdminPaymentGatewayConfigSource = 'admin' | 'platform_inherited' | 'env_fallback' | 'unset';

export type AdminPaymentGatewayConfigView = {
  provider: 'epay';
  source: AdminPaymentGatewayConfigSource;
  scope_type: 'platform' | 'app';
  scope_key: string;
  config: {
    partner_id: string;
    gateway: string;
  };
  secret_values: {
    key: string;
  };
  configured_secret_keys: string[];
  completeness_status: 'configured' | 'missing';
  missing_fields: string[];
  updated_at: string | null;
};

export type UpsertAdminPaymentProviderProfileInput = {
  id?: string | null;
  provider?: string;
  scope_type?: string;
  scope_key?: string;
  channel_kind?: string;
  display_name?: string;
  enabled?: boolean;
  config_values?: Record<string, unknown>;
  secret_values?: Record<string, string>;
};

export type UpsertAdminPaymentProviderBindingInput = {
  provider?: string;
  mode?: string;
  active_profile_id?: string | null;
};

export type UpsertAdminPaymentGatewayConfigInput = {
  provider?: string;
  scope_type?: string;
  scope_key?: string;
  mode?: string;
  config_values?: Record<string, unknown>;
  secret_values?: Record<string, string>;
};

export type AdminMarkPaymentOrderPaidInput = {
  provider_order_id?: string;
  paid_at?: string;
  note?: string;
};

export type AdminRefundPaymentOrderInput = {
  note?: string;
};

export type WorkspaceBackupRecord = {
  userId: string;
  identityMd: string;
  userMd: string;
  soulMd: string;
  agentsMd: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceBackupInput = {
  identity_md: string;
  user_md: string;
  soul_md: string;
  agents_md: string;
};

export type WorkspaceBackupView = WorkspaceBackupInput & {
  created_at: string;
  updated_at: string;
};

export type SkillDistribution = 'cloud';
export type SkillSource = 'cloud' | 'private';
export type UserSkillLibrarySource = 'cloud' | 'private';
export type McpCatalogSource = 'cloud';
export type UserMcpLibrarySource = 'cloud' | 'custom';
export type ExtensionInstallTarget = 'skill' | 'mcp';
export type ExtensionSetupStatus = 'not_required' | 'configured' | 'missing';
export type UserPrivateSkillSourceKind = 'github' | 'local';
export type AgentCategory = 'finance' | 'content' | 'productivity' | 'commerce' | 'general';
export type SkillArtifactFormat = 'tar.gz' | 'zip';
export type SkillOriginType = 'clawhub' | 'github_repo' | 'manual' | 'private';
export type SkillSyncSourceType = 'clawhub' | 'github_repo';
export type SkillSyncRunStatus = 'running' | 'succeeded' | 'partial_failed' | 'failed';
export type SkillSyncItemStatus = 'created' | 'updated' | 'skipped' | 'failed';

export type SkillCatalogRecord = {
  slug: string;
  name: string;
  description: string;
  market: string | null;
  category: string | null;
  skillType: string | null;
  publisher: string;
  distribution: SkillDistribution;
  tags: string[];
  version: string;
  artifactFormat: SkillArtifactFormat;
  artifactUrl: string | null;
  artifactSha256: string | null;
  artifactSourcePath: string | null;
  originType: SkillOriginType;
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SkillCatalogEntryRecord = SkillCatalogRecord;

export type UserSkillLibraryRecord = {
  userId: string;
  slug: string;
  version: string;
  source: UserSkillLibrarySource;
  enabled: boolean;
  installedAt: string;
  updatedAt: string;
};

export type SkillCatalogEntryView = {
  slug: string;
  name: string;
  description: string;
  market: string | null;
  category: string | null;
  skill_type: string | null;
  publisher: string;
  distribution: SkillDistribution;
  source: SkillSource;
  tags: string[];
  version: string;
  artifact_url: string | null;
  artifact_path: string | null;
  artifact_format: SkillArtifactFormat;
  artifact_sha256: string | null;
  origin_type: SkillOriginType;
  source_url: string | null;
  metadata: Record<string, unknown>;
};

export type UserSkillLibraryItemView = {
  slug: string;
  version: string;
  source: UserSkillLibrarySource;
  enabled: boolean;
  setup_status: ExtensionSetupStatus;
  setup_schema_version: number | null;
  setup_updated_at: string | null;
  installed_at: string;
  updated_at: string;
};

export type McpCatalogRecord = {
  mcpKey: string;
  name: string;
  description: string;
  transport: string;
  objectKey: string | null;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type McpCatalogEntryRecord = McpCatalogRecord;

export type McpCatalogEntryView = {
  mcp_key: string;
  name: string;
  description: string;
  transport: string;
  source: McpCatalogSource;
  default_installed: boolean;
  object_key: string | null;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UserMcpLibraryRecord = {
  userId: string;
  mcpKey: string;
  source: UserMcpLibrarySource;
  enabled: boolean;
  installedAt: string;
  updatedAt: string;
};

export type UserMcpLibraryItemView = {
  mcp_key: string;
  source: UserMcpLibrarySource;
  enabled: boolean;
  setup_status: ExtensionSetupStatus;
  setup_schema_version: number | null;
  setup_updated_at: string | null;
  installed_at: string;
  updated_at: string;
};

export type UserCustomMcpRecord = {
  id: string;
  userId: string;
  appName: string;
  mcpKey: string;
  name: string;
  description: string;
  transport: 'stdio' | 'http' | 'sse';
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type UserCustomMcpView = {
  id: string;
  app_name: string;
  mcp_key: string;
  name: string;
  description: string;
  transport: 'stdio' | 'http' | 'sse';
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  enabled: boolean;
  sort_order: number;
  setup_status: ExtensionSetupStatus;
  setup_schema_version: number | null;
  setup_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserExtensionInstallConfigRecord = {
  userId: string;
  extensionType: ExtensionInstallTarget;
  extensionKey: string;
  schemaVersion: number | null;
  status: ExtensionSetupStatus;
  config: Record<string, unknown>;
  configuredSecretKeys: string[];
  secretPayloadEncrypted: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserExtensionInstallConfigView = {
  extension_type: ExtensionInstallTarget;
  extension_key: string;
  schema_version: number | null;
  status: ExtensionSetupStatus;
  config_values: Record<string, unknown>;
  configured_secret_keys: string[];
  created_at: string;
  updated_at: string;
};

export type AgentCatalogRecord = {
  slug: string;
  name: string;
  description: string;
  category: AgentCategory;
  publisher: string;
  featured: boolean;
  official: boolean;
  tags: string[];
  capabilities: string[];
  useCases: string[];
  metadata: Record<string, unknown>;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgentCatalogEntryRecord = AgentCatalogRecord;

export type AgentCatalogEntryView = {
  slug: string;
  name: string;
  description: string;
  category: AgentCategory;
  publisher: string;
  featured: boolean;
  official: boolean;
  tags: string[];
  capabilities: string[];
  use_cases: string[];
  metadata: Record<string, unknown>;
};

export type AdminAgentCatalogEntryView = AgentCatalogEntryView & {
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type InvestmentExpertCatalogItemView = {
  slug: string;
  name: string;
  description: string;
  category: AgentCategory;
  tags: string[];
  metadata: Record<string, unknown>;
  installed: boolean;
  detail_loaded: boolean;
};

export type UserAgentLibraryRecord = {
  userId: string;
  slug: string;
  installedAt: string;
  updatedAt: string;
};

export type UserAgentLibraryItemView = {
  slug: string;
  installed_at: string;
  updated_at: string;
};

export type InstallAgentInput = {
  slug: string;
};

export type MarketStockRecord = {
  id: string;
  market: 'a_share';
  exchange: 'sh' | 'sz' | 'bj';
  symbol: string;
  companyName: string;
  board: string | null;
  status: 'active' | 'suspended';
  source: string;
  sourceId: string | null;
  currentPrice: number | null;
  changePercent: number | null;
  amount: number | null;
  turnoverRate: number | null;
  peTtm: number | null;
  openPrice: number | null;
  prevClose: number | null;
  totalMarketCap: number | null;
  circulatingMarketCap: number | null;
  strategyTags: string[];
  metadata: Record<string, unknown>;
  importedAt: string;
  updatedAt: string;
};

export type MarketStockView = {
  id: string;
  market: 'a_share';
  exchange: 'sh' | 'sz' | 'bj';
  symbol: string;
  company_name: string;
  board: string | null;
  status: 'active' | 'suspended';
  source: string;
  source_id: string | null;
  current_price: number | null;
  change_percent: number | null;
  amount: number | null;
  turnover_rate: number | null;
  pe_ttm: number | null;
  open_price: number | null;
  prev_close: number | null;
  total_market_cap: number | null;
  circulating_market_cap: number | null;
  strategy_tags: string[];
  metadata: Record<string, unknown>;
  imported_at: string;
  updated_at: string;
};

export type MarketFundExchange = 'sh' | 'sz' | 'otc';
export type MarketFundInstrumentKind = 'fund' | 'etf' | 'qdii';
export type MarketFundRegion = 'A股' | '海外' | '全球';
export type MarketFundRiskLevel = '低风险' | '中低风险' | '中风险' | '中高风险' | '高风险';

export type MarketFundRecord = {
  id: string;
  market: 'cn_fund';
  exchange: MarketFundExchange;
  symbol: string;
  fundName: string;
  fundType: string | null;
  instrumentKind: MarketFundInstrumentKind;
  region: MarketFundRegion;
  riskLevel: MarketFundRiskLevel | null;
  managerName: string | null;
  trackingTarget: string | null;
  status: 'active' | 'suspended';
  source: string;
  sourceId: string | null;
  currentPrice: number | null;
  navPrice: number | null;
  changePercent: number | null;
  return1m: number | null;
  return1y: number | null;
  maxDrawdown: number | null;
  scaleAmount: number | null;
  feeRate: number | null;
  amount: number | null;
  turnoverRate: number | null;
  dividendMode: string | null;
  strategyTags: string[];
  metadata: Record<string, unknown>;
  importedAt: string;
  updatedAt: string;
};

export type MarketFundView = {
  id: string;
  market: 'cn_fund';
  exchange: MarketFundExchange;
  symbol: string;
  fund_name: string;
  fund_type: string | null;
  instrument_kind: MarketFundInstrumentKind;
  region: MarketFundRegion;
  risk_level: MarketFundRiskLevel | null;
  manager_name: string | null;
  tracking_target: string | null;
  status: 'active' | 'suspended';
  source: string;
  source_id: string | null;
  current_price: number | null;
  nav_price: number | null;
  change_percent: number | null;
  return_1m: number | null;
  return_1y: number | null;
  max_drawdown: number | null;
  scale_amount: number | null;
  fee_rate: number | null;
  amount: number | null;
  turnover_rate: number | null;
  dividend_mode: string | null;
  strategy_tags: string[];
  metadata: Record<string, unknown>;
  imported_at: string;
  updated_at: string;
};

export type UserPrivateSkillRecord = {
  userId: string;
  slug: string;
  name: string;
  description: string;
  market: string | null;
  category: string | null;
  skillType: string | null;
  publisher: string;
  tags: string[];
  sourceKind: UserPrivateSkillSourceKind;
  sourceUrl: string | null;
  version: string;
  artifactFormat: 'tar.gz' | 'zip';
  artifactKey: string;
  artifactSha256: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminSkillCatalogEntryView = SkillCatalogEntryView & {
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type SkillSyncSourceRecord = {
  id: string;
  sourceType: SkillSyncSourceType;
  sourceKey: string;
  displayName: string;
  sourceUrl: string;
  config: Record<string, unknown>;
  active: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SkillSyncRunItemRecord = {
  slug: string;
  name: string;
  version: string | null;
  status: SkillSyncItemStatus;
  reason: string | null;
  sourceUrl: string | null;
};

export type SkillSyncRunRecord = {
  id: string;
  sourceId: string;
  sourceKey: string;
  sourceType: SkillSyncSourceType;
  displayName: string;
  status: SkillSyncRunStatus;
  summary: Record<string, unknown>;
  items: SkillSyncRunItemRecord[];
  startedAt: string;
  finishedAt: string | null;
};

export type SkillSyncSourceView = {
  id: string;
  source_type: SkillSyncSourceType;
  source_key: string;
  display_name: string;
  source_url: string;
  config: Record<string, unknown>;
  active: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SkillSyncRunItemView = {
  slug: string;
  name: string;
  version: string | null;
  status: SkillSyncItemStatus;
  reason: string | null;
  source_url: string | null;
};

export type SkillSyncRunView = {
  id: string;
  source_id: string;
  source_key: string;
  source_type: SkillSyncSourceType;
  display_name: string;
  status: SkillSyncRunStatus;
  summary: Record<string, unknown>;
  items: SkillSyncRunItemView[];
  started_at: string;
  finished_at: string | null;
};

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: UserRole;
};

export type UpdateProfileInput = {
  name?: string;
  avatar_url?: string | null;
  avatar_data_base64?: string;
  avatar_content_type?: string;
  avatar_filename?: string;
  remove_avatar?: boolean;
};

export type ChangePasswordInput = {
  current_password?: string;
  new_password: string;
};

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
  name?: string;
};

export type LoginInput = {
  identifier: string;
  password?: string;
  credential?: string;
};

export type RunAuthorizeInput = {
  event_id?: string;
  session_key?: string;
  client?: string;
  estimated_input_tokens?: number;
  estimated_output_tokens?: number;
  message?: string;
  history_messages?: number;
  has_search?: boolean;
  has_tools?: boolean;
  attachments?: CreditQuoteAttachmentInput[];
  model?: string;
  app_name?: string;
};

export type UsageEventInput = {
  event_id?: string;
  grant_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  credit_cost?: number;
  provider?: string;
  model?: string;
  app_name?: string;
  assistant_timestamp?: number;
};

export type PersistedUsageEventInput = Required<Omit<UsageEventInput, 'assistant_timestamp'>> & {
  assistant_timestamp?: number;
};

export type RunBillingSummaryView = {
  grant_id: string;
  event_id: string;
  session_key: string;
  client: string;
  status: 'settled';
  input_tokens: number;
  output_tokens: number;
  credit_cost: number;
  provider: string | null;
  model: string | null;
  balance_after: number;
  settled_at: string;
  assistant_timestamp: number | null;
};

export type InstallSkillInput = {
  slug?: string;
  version?: string;
  setup_values?: Record<string, unknown>;
  secret_values?: Record<string, string>;
};

export type InstallMcpInput = {
  mcp_key?: string;
  setup_values?: Record<string, unknown>;
  secret_values?: Record<string, string>;
};

export type UpsertUserExtensionInstallConfigInput = {
  extension_type?: ExtensionInstallTarget;
  extension_key?: string;
  setup_values?: Record<string, unknown>;
  secret_values?: Record<string, string>;
};

export type ImportUserPrivateSkillInput = {
  slug?: string;
  name?: string;
  description?: string;
  market?: string | null;
  category?: string | null;
  skill_type?: string | null;
  publisher?: string;
  tags?: string[];
  source_kind?: UserPrivateSkillSourceKind;
  source_url?: string | null;
  version?: string;
  artifact_format?: 'tar.gz' | 'zip';
  artifact_sha256?: string | null;
  artifact_base64?: string;
};

export type UpdateSkillLibraryItemInput = {
  slug?: string;
  enabled?: boolean;
};

export type UpdateMcpLibraryItemInput = {
  mcp_key?: string;
  enabled?: boolean;
};

export type UpsertUserCustomMcpInput = {
  app_name?: string;
  mcp_key?: string;
  name?: string;
  description?: string;
  transport?: 'stdio' | 'http' | 'sse' | string | null;
  enabled?: boolean;
  sort_order?: number;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  setup_values?: Record<string, unknown>;
  secret_values?: Record<string, string>;
};

export type UpsertMcpCatalogEntryInput = {
  mcp_key?: string;
  name?: string;
  description?: string;
  transport?: string | null;
  object_key?: string | null;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  active?: boolean;
};

export type UpsertSkillCatalogEntryInput = {
  slug?: string;
  name?: string;
  description?: string;
  market?: string | null;
  category?: string | null;
  skill_type?: string | null;
  publisher?: string;
  distribution?: SkillDistribution;
  tags?: string[];
  version?: string;
  artifact_url?: string | null;
  artifact_format?: SkillArtifactFormat;
  artifact_sha256?: string | null;
  artifact_source_path?: string | null;
  origin_type?: SkillOriginType;
  source_url?: string | null;
  metadata?: Record<string, unknown>;
  active?: boolean;
};

export type UpsertAgentCatalogEntryInput = {
  slug?: string;
  name?: string;
  description?: string;
  category?: AgentCategory;
  publisher?: string;
  featured?: boolean;
  official?: boolean;
  tags?: string[];
  capabilities?: string[];
  use_cases?: string[];
  metadata?: Record<string, unknown>;
  sort_order?: number;
  active?: boolean;
};

export type UpsertSkillSyncSourceInput = {
  id?: string;
  source_type?: SkillSyncSourceType;
  source_key?: string;
  display_name?: string;
  source_url?: string;
  config?: Record<string, unknown>;
  active?: boolean;
};
