export type UserRole = 'user' | 'admin' | 'super_admin';

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

export type SkillDistribution = 'bundled' | 'cloud';
export type SkillSource = 'bundled' | 'cloud' | 'private';
export type UserSkillLibrarySource = 'cloud' | 'private';
export type McpCatalogSource = 'cloud';
export type UserMcpLibrarySource = 'cloud';
export type ExtensionInstallTarget = 'skill' | 'mcp';
export type ExtensionSetupStatus = 'not_required' | 'configured' | 'missing';
export type UserPrivateSkillSourceKind = 'github' | 'local';
export type AgentCategory = 'finance' | 'content' | 'productivity' | 'commerce' | 'general';
export type SkillArtifactFormat = 'tar.gz' | 'zip';
export type SkillOriginType = 'bundled' | 'clawhub' | 'github_repo' | 'manual' | 'private';
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
  password: string;
};

export type RunAuthorizeInput = {
  session_key?: string;
  client?: string;
  estimated_input_tokens?: number;
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
