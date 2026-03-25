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
  amount_cny_fen: number;
  payment_url: string | null;
  paid_at: string | null;
  expires_at: string | null;
};

export type CreatePaymentOrderInput = {
  provider?: string;
  package_id?: string;
  return_url?: string;
};

export type PaymentWebhookInput = {
  event_id?: string;
  order_id?: string;
  provider_order_id?: string;
  status?: string;
  paid_at?: string;
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
  visibility: 'showcase' | 'internal';
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
  visibility: 'showcase' | 'internal';
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
  installed_at: string;
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
};

export type InstallSkillInput = {
  slug?: string;
  version?: string;
};

export type InstallMcpInput = {
  mcp_key?: string;
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
  visibility?: 'showcase' | 'internal';
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
