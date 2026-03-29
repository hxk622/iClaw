import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {Pool, type PoolClient} from 'pg';

import {config} from './config.ts';
import type {
  AdminPaymentOrderDetailRecord,
  AdminPaymentOrderSummaryRecord,
  AgentCatalogEntryRecord,
  AgentCatalogRecord,
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
  MarketStockRecord,
  McpCatalogEntryRecord,
  McpCatalogRecord,
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
  PersistedUsageEventInput,
  RunBillingSummaryRecord,
  RunGrantRecord,
  SessionRecord,
  SessionTokenPair,
  SkillCatalogEntryRecord,
  SkillCatalogRecord,
  SkillSyncRunRecord,
  SkillSyncSourceRecord,
  UpsertAgentCatalogEntryInput,
  UpsertAdminPaymentProviderBindingInput,
  UpsertAdminPaymentProviderProfileInput,
  UpsertSkillCatalogEntryInput,
  UpsertSkillSyncSourceInput,
  UpsertUserExtensionInstallConfigInput,
  UsageEventResult,
  UserAgentLibraryRecord,
  UserExtensionInstallConfigRecord,
  UserFileRecord,
  UserMcpLibraryRecord,
  UserPrivateSkillRecord,
  UserRole,
  UserSkillLibraryRecord,
  UpdateMcpLibraryItemInput,
  UpdateSkillLibraryItemInput,
  UserRecord,
  WorkspaceBackupInput,
  WorkspaceBackupRecord,
} from './domain.ts';
import {buildPlaceholderPaymentUrl} from './payment-placeholders.ts';
import type {ControlPlaneStore} from './store.ts';

type UserRow = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  passwordHash: string | null;
  role: UserRole;
  status: 'active';
  createdAt: Date;
  updatedAt: Date;
};

type SessionRow = {
  session_id: string;
  user_id: string;
  access_token_hash: string;
  access_token_expires_at: Date;
  refresh_token_hash: string;
  refresh_token_expires_at: Date;
  created_at: Date;
};

type CreditLedgerRow = {
  id: string;
  user_id: string;
  bucket: 'daily_free' | 'topup';
  direction: 'grant' | 'consume' | 'topup' | 'refund' | 'expire';
  amount: string | number;
  balance_after: string | number;
  reference_type: string | null;
  reference_id: string | null;
  event_type: string | null;
  delta: string | number | null;
  created_at: Date;
};

type CreditAccountRow = {
  user_id: string;
  daily_free_balance: string | number;
  topup_balance: string | number;
  daily_free_granted_at: Date;
  daily_free_expires_at: Date;
  updated_at: Date;
};

type PaymentOrderRow = {
  id: string;
  user_id: string;
  provider: PaymentProvider;
  package_id: string;
  package_name: string;
  credits: string | number;
  bonus_credits: string | number;
  amount_cny_fen: string | number;
  currency: 'cny';
  status: PaymentOrderRecord['status'];
  provider_order_id: string | null;
  provider_prepay_id: string | null;
  payment_url: string | null;
  metadata: Record<string, unknown> | null;
  paid_at: Date | null;
  expired_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type PaymentWebhookEventRow = {
  id: string;
  provider: PaymentProvider;
  event_id: string;
  event_type: string | null;
  order_id: string | null;
  payload: Record<string, unknown> | null;
  signature: string | null;
  processed_at: Date | null;
  process_status: string;
  created_at: Date;
};

type PaymentProviderProfileRow = {
  id: string;
  provider: PaymentProvider;
  scope_type: PaymentProviderScopeType;
  scope_key: string;
  channel_kind: PaymentProviderChannelKind;
  display_name: string;
  enabled: boolean;
  config_json: Record<string, unknown> | null;
  configured_secret_keys: unknown;
  secret_payload_encrypted: string | null;
  created_at: Date;
  updated_at: Date;
};

type PaymentProviderBindingRow = {
  app_name: string;
  provider: PaymentProvider;
  mode: PaymentProviderBindingMode;
  active_profile_id: string | null;
  updated_at: Date;
};

type AdminPaymentOrderRow = PaymentOrderRow & {
  username: string;
  user_email: string;
  user_display_name: string | null;
  webhook_event_count: string | number;
  latest_webhook_at: Date | null;
};

type UsageEventLookupRow = {
  event_id: string;
  credit_cost: string | number;
  run_grant_id?: string | null;
  input_tokens?: number;
  output_tokens?: number;
  provider?: string | null;
  model?: string | null;
  created_at?: Date;
};

type OAuthAccountRow = {
  user_id: string;
  provider: OAuthProvider;
  provider_id: string;
  created_at: Date;
};

type RunGrantRow = {
  id: string;
  user_id: string;
  status: string;
  nonce: string;
  max_input_tokens: number;
  max_output_tokens: number;
  credit_limit: string | number;
  expires_at: Date;
  used_at: Date | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
};

type WorkspaceBackupRow = {
  user_id: string;
  identity_md: string;
  user_md: string;
  soul_md: string;
  agents_md: string;
  created_at: Date;
  updated_at: Date;
};

type UserFileRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  kind: string;
  status: 'active' | 'deleted';
  storage_provider: 'minio';
  object_key: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: string | number;
  sha256: string;
  source: string | null;
  task_id: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

type SkillCatalogRow = {
  slug: string;
  name: string;
  description: string;
  market: string | null;
  category: string | null;
  skill_type: string | null;
  publisher: string;
  distribution: 'bundled' | 'cloud';
  tags: unknown;
  version: string;
  artifact_format: 'tar.gz' | 'zip';
  artifact_url: string | null;
  artifact_sha256: string | null;
  artifact_source_path: string | null;
  origin_type: 'bundled' | 'clawhub' | 'github_repo' | 'manual' | 'private';
  source_url: string | null;
  metadata_json: Record<string, unknown> | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type McpCatalogRow = {
  mcp_key: string;
  name: string;
  description: string;
  transport: string;
  object_key: string | null;
  config_json: Record<string, unknown> | null;
  metadata_json: Record<string, unknown> | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type AgentCatalogRow = {
  slug: string;
  name: string;
  description: string;
  category: 'finance' | 'content' | 'productivity' | 'commerce' | 'general';
  publisher: string;
  featured: boolean;
  official: boolean;
  tags: unknown;
  capabilities: unknown;
  use_cases: unknown;
  metadata_json: Record<string, unknown> | null;
  sort_order: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type MarketStockRow = {
  id: string;
  market: 'a_share';
  exchange: 'sh' | 'sz' | 'bj';
  symbol: string;
  company_name: string;
  board: string | null;
  status: 'active' | 'suspended';
  source: string;
  source_id: string | null;
  current_price: string | number | null;
  change_percent: string | number | null;
  amount: string | number | null;
  turnover_rate: string | number | null;
  pe_ttm: string | number | null;
  open_price: string | number | null;
  prev_close: string | number | null;
  total_market_cap: string | number | null;
  circulating_market_cap: string | number | null;
  strategy_tags: string[] | null;
  metadata_json: Record<string, unknown> | null;
  imported_at: Date;
  updated_at: Date;
};

type MarketFundRow = {
  id: string;
  market: 'cn_fund';
  exchange: 'sh' | 'sz' | 'otc';
  symbol: string;
  fund_name: string;
  fund_type: string | null;
  instrument_kind: 'fund' | 'etf' | 'qdii';
  region: 'A股' | '海外' | '全球';
  risk_level: '低风险' | '中低风险' | '中风险' | '中高风险' | '高风险' | null;
  manager_name: string | null;
  tracking_target: string | null;
  status: 'active' | 'suspended';
  source: string;
  source_id: string | null;
  current_price: string | number | null;
  nav_price: string | number | null;
  change_percent: string | number | null;
  return_1m: string | number | null;
  return_1y: string | number | null;
  max_drawdown: string | number | null;
  scale_amount: string | number | null;
  fee_rate: string | number | null;
  amount: string | number | null;
  turnover_rate: string | number | null;
  dividend_mode: string | null;
  strategy_tags: string[] | null;
  metadata_json: Record<string, unknown> | null;
  imported_at: Date;
  updated_at: Date;
};

function parseRunBillingSummary(
  value: unknown,
  fallback?: {
    grantId: string;
    sessionKey: string;
    client: string;
  },
): RunBillingSummaryRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const summary = value as Record<string, unknown>;
  const grantId =
    typeof summary.grant_id === 'string'
      ? summary.grant_id
      : typeof summary.grantId === 'string'
        ? summary.grantId
        : fallback?.grantId || '';
  const eventId =
    typeof summary.event_id === 'string'
      ? summary.event_id
      : typeof summary.eventId === 'string'
        ? summary.eventId
        : '';
  if (!grantId || !eventId) {
    return null;
  }

  return {
    grantId,
    eventId,
    sessionKey:
      typeof summary.session_key === 'string'
        ? summary.session_key
        : typeof summary.sessionKey === 'string'
          ? summary.sessionKey
          : fallback?.sessionKey || 'main',
    client:
      typeof summary.client === 'string'
        ? summary.client
        : fallback?.client || 'desktop',
    status: 'settled',
    inputTokens:
      typeof summary.input_tokens === 'number'
        ? summary.input_tokens
        : typeof summary.inputTokens === 'number'
          ? summary.inputTokens
          : 0,
    outputTokens:
      typeof summary.output_tokens === 'number'
        ? summary.output_tokens
        : typeof summary.outputTokens === 'number'
          ? summary.outputTokens
          : 0,
    creditCost:
      typeof summary.credit_cost === 'number'
        ? summary.credit_cost
        : typeof summary.creditCost === 'number'
          ? summary.creditCost
          : 0,
    provider: typeof summary.provider === 'string' ? summary.provider : null,
    model: typeof summary.model === 'string' ? summary.model : null,
    balanceAfter:
      typeof summary.balance_after === 'number'
        ? summary.balance_after
        : typeof summary.balanceAfter === 'number'
          ? summary.balanceAfter
          : 0,
    settledAt:
      typeof summary.settled_at === 'string'
        ? summary.settled_at
        : typeof summary.settledAt === 'string'
          ? summary.settledAt
          : new Date().toISOString(),
    assistantTimestamp:
      typeof summary.assistant_timestamp === 'number'
        ? summary.assistant_timestamp
        : typeof summary.assistantTimestamp === 'number'
          ? summary.assistantTimestamp
          : null,
  };
}

type SkillSyncSourceRow = {
  id: string;
  source_type: 'clawhub' | 'github_repo';
  source_key: string;
  display_name: string;
  source_url: string;
  config_json: Record<string, unknown> | null;
  active: boolean;
  last_run_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type SkillSyncRunRow = {
  id: string;
  source_id: string;
  source_key: string;
  source_type: 'clawhub' | 'github_repo';
  display_name: string;
  status: SkillSyncRunRecord['status'];
  summary_json: Record<string, unknown> | null;
  items_json: unknown;
  started_at: Date;
  finished_at: Date | null;
};

type UserSkillLibraryRow = {
  user_id: string;
  skill_slug: string;
  source: 'cloud' | 'private';
  installed_version: string;
  enabled: boolean;
  installed_at: Date;
  updated_at: Date;
};

type UserMcpLibraryRow = {
  user_id: string;
  mcp_key: string;
  source: 'cloud';
  enabled: boolean;
  installed_at: Date;
  updated_at: Date;
};

type UserExtensionInstallConfigRow = {
  user_id: string;
  extension_type: ExtensionInstallTarget;
  extension_key: string;
  schema_version: number | null;
  status: UserExtensionInstallConfigRecord['status'];
  config_json: Record<string, unknown> | null;
  configured_secret_keys: unknown;
  secret_payload_encrypted: string | null;
  created_at: Date;
  updated_at: Date;
};

type UserPrivateSkillRow = {
  user_id: string;
  slug: string;
  name: string;
  description: string;
  market: string | null;
  category: string | null;
  skill_type: string | null;
  publisher: string;
  tags: unknown;
  source_kind: 'github' | 'local';
  source_url: string | null;
  version: string;
  artifact_format: 'tar.gz' | 'zip';
  artifact_key: string;
  artifact_sha256: string | null;
  created_at: Date;
  updated_at: Date;
};

type UserAgentLibraryRow = {
  user_id: string;
  agent_slug: string;
  installed_at: Date;
  updated_at: Date;
};

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.displayName || '',
    avatarUrl: row.avatarUrl || null,
    passwordHash: row.passwordHash,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseDbNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
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

function mapCreditAccountRow(row: CreditAccountRow, createdAt?: Date): CreditAccountRecord {
  const dailyFreeBalance = parseDbNumber(row.daily_free_balance);
  const topupBalance = parseDbNumber(row.topup_balance);
  return {
    userId: row.user_id,
    dailyFreeBalance,
    topupBalance,
    dailyFreeQuota: config.dailyFreeCredits,
    totalAvailableBalance: dailyFreeBalance + topupBalance,
    dailyFreeGrantedAt: row.daily_free_granted_at.toISOString(),
    dailyFreeExpiresAt: row.daily_free_expires_at.toISOString(),
    status: 'active',
    createdAt: createdAt ? createdAt.toISOString() : row.updated_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapPaymentOrderRow(row: PaymentOrderRow): PaymentOrderRecord {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    packageId: row.package_id,
    packageName: row.package_name,
    credits: parseDbNumber(row.credits),
    bonusCredits: parseDbNumber(row.bonus_credits),
    amountCnyFen: parseDbNumber(row.amount_cny_fen),
    currency: 'cny',
    status: row.status,
    providerOrderId: row.provider_order_id,
    providerPrepayId: row.provider_prepay_id,
    paymentUrl: row.payment_url,
    appName: typeof metadata.app_name === 'string' ? metadata.app_name : null,
    appVersion: typeof metadata.app_version === 'string' ? metadata.app_version : null,
    releaseChannel: typeof metadata.release_channel === 'string' ? metadata.release_channel : null,
    platform: typeof metadata.platform === 'string' ? metadata.platform : null,
    arch: typeof metadata.arch === 'string' ? metadata.arch : null,
    returnUrl: typeof metadata.return_url === 'string' ? metadata.return_url : null,
    userAgent: typeof metadata.user_agent === 'string' ? metadata.user_agent : null,
    metadata,
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
    expiredAt: row.expired_at ? row.expired_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapPaymentWebhookEventRow(row: PaymentWebhookEventRow): PaymentWebhookEventRecord {
  return {
    id: row.id,
    provider: row.provider,
    eventId: row.event_id,
    eventType: row.event_type,
    orderId: row.order_id,
    payload: row.payload || {},
    signature: row.signature,
    processedAt: row.processed_at ? row.processed_at.toISOString() : null,
    processStatus: row.process_status,
    createdAt: row.created_at.toISOString(),
  };
}

function mapPaymentProviderProfileRow(row: PaymentProviderProfileRow): PaymentProviderProfileRecord {
  return {
    id: row.id,
    provider: row.provider,
    scopeType: row.scope_type,
    scopeKey: row.scope_key,
    channelKind: row.channel_kind,
    displayName: row.display_name,
    enabled: row.enabled,
    config: parseJsonObject(row.config_json),
    configuredSecretKeys: parseSkillTags(row.configured_secret_keys),
    secretPayloadEncrypted: row.secret_payload_encrypted,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapPaymentProviderBindingRow(row: PaymentProviderBindingRow): PaymentProviderBindingRecord {
  return {
    appName: row.app_name,
    provider: row.provider,
    mode: row.mode,
    activeProfileId: row.active_profile_id,
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapAdminPaymentOrderRow(row: AdminPaymentOrderRow): AdminPaymentOrderSummaryRecord {
  const order = mapPaymentOrderRow(row);
  return {
    ...order,
    username: row.username,
    userEmail: row.user_email,
    userDisplayName: row.user_display_name || row.username,
    webhookEventCount: parseDbNumber(row.webhook_event_count),
    latestWebhookAt: row.latest_webhook_at ? row.latest_webhook_at.toISOString() : null,
  };
}

function mapSessionRow(row: SessionRow): SessionRecord {
  return {
    id: row.session_id,
    userId: row.user_id,
    accessTokenHash: row.access_token_hash,
    refreshTokenHash: row.refresh_token_hash,
    accessTokenExpiresAt: row.access_token_expires_at.getTime(),
    refreshTokenExpiresAt: row.refresh_token_expires_at.getTime(),
    createdAt: row.created_at.toISOString(),
  };
}

function normalizeUsernameLookup(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function mapWorkspaceBackupRow(row: WorkspaceBackupRow): WorkspaceBackupRecord {
  return {
    userId: row.user_id,
    identityMd: row.identity_md,
    userMd: row.user_md,
    soulMd: row.soul_md,
    agentsMd: row.agents_md,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function parseSkillTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

function mapAgentCatalogRow(row: AgentCatalogRow): AgentCatalogRecord {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    publisher: row.publisher,
    featured: row.featured,
    official: row.official,
    tags: parseStringArray(row.tags),
    capabilities: parseStringArray(row.capabilities),
    useCases: parseStringArray(row.use_cases),
    metadata: parseJsonObject(row.metadata_json),
    sortOrder: row.sort_order,
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapMarketStockRow(row: MarketStockRow): MarketStockRecord {
  return {
    id: row.id,
    market: row.market,
    exchange: row.exchange,
    symbol: row.symbol,
    companyName: row.company_name,
    board: row.board,
    status: row.status,
    source: row.source,
    sourceId: row.source_id,
    currentPrice: row.current_price === null ? null : parseDbNumber(row.current_price),
    changePercent: row.change_percent === null ? null : parseDbNumber(row.change_percent),
    amount: row.amount === null ? null : parseDbNumber(row.amount),
    turnoverRate: row.turnover_rate === null ? null : parseDbNumber(row.turnover_rate),
    peTtm: row.pe_ttm === null ? null : parseDbNumber(row.pe_ttm),
    openPrice: row.open_price === null ? null : parseDbNumber(row.open_price),
    prevClose: row.prev_close === null ? null : parseDbNumber(row.prev_close),
    totalMarketCap: row.total_market_cap === null ? null : parseDbNumber(row.total_market_cap),
    circulatingMarketCap: row.circulating_market_cap === null ? null : parseDbNumber(row.circulating_market_cap),
    strategyTags: Array.isArray(row.strategy_tags) ? row.strategy_tags.filter((item) => typeof item === 'string') : [],
    metadata: parseJsonObject(row.metadata_json),
    importedAt: row.imported_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapMarketFundRow(row: MarketFundRow): MarketFundRecord {
  return {
    id: row.id,
    market: row.market,
    exchange: row.exchange,
    symbol: row.symbol,
    fundName: row.fund_name,
    fundType: row.fund_type,
    instrumentKind: row.instrument_kind,
    region: row.region,
    riskLevel: row.risk_level,
    managerName: row.manager_name,
    trackingTarget: row.tracking_target,
    status: row.status,
    source: row.source,
    sourceId: row.source_id,
    currentPrice: row.current_price === null ? null : parseDbNumber(row.current_price),
    navPrice: row.nav_price === null ? null : parseDbNumber(row.nav_price),
    changePercent: row.change_percent === null ? null : parseDbNumber(row.change_percent),
    return1m: row.return_1m === null ? null : parseDbNumber(row.return_1m),
    return1y: row.return_1y === null ? null : parseDbNumber(row.return_1y),
    maxDrawdown: row.max_drawdown === null ? null : parseDbNumber(row.max_drawdown),
    scaleAmount: row.scale_amount === null ? null : parseDbNumber(row.scale_amount),
    feeRate: row.fee_rate === null ? null : parseDbNumber(row.fee_rate),
    amount: row.amount === null ? null : parseDbNumber(row.amount),
    turnoverRate: row.turnover_rate === null ? null : parseDbNumber(row.turnover_rate),
    dividendMode: row.dividend_mode,
    strategyTags: Array.isArray(row.strategy_tags) ? row.strategy_tags.filter((item) => typeof item === 'string') : [],
    metadata: parseJsonObject(row.metadata_json),
    importedAt: row.imported_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapSkillCatalogRow(row: SkillCatalogRow): SkillCatalogRecord {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    market: row.market,
    category: row.category,
    skillType: row.skill_type,
    publisher: row.publisher,
    distribution: row.distribution,
    tags: parseSkillTags(row.tags),
    version: row.version,
    artifactFormat: row.artifact_format,
    artifactUrl: row.artifact_url,
    artifactSha256: row.artifact_sha256,
    artifactSourcePath: row.artifact_source_path,
    originType: row.origin_type,
    sourceUrl: row.source_url,
    metadata: parseJsonObject(row.metadata_json),
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapMcpCatalogRow(row: McpCatalogRow): McpCatalogRecord {
  return {
    mcpKey: row.mcp_key,
    name: row.name,
    description: row.description,
    transport: row.transport,
    objectKey: row.object_key,
    config: parseJsonObject(row.config_json),
    metadata: parseJsonObject(row.metadata_json),
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapSkillSyncSourceRow(row: SkillSyncSourceRow): SkillSyncSourceRecord {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceKey: row.source_key,
    displayName: row.display_name,
    sourceUrl: row.source_url,
    config: parseJsonObject(row.config_json),
    active: row.active,
    lastRunAt: row.last_run_at ? row.last_run_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapSkillSyncRunItems(raw: unknown): SkillSyncRunRecord['items'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const value = parseJsonObject(item);
      const slug = typeof value.slug === 'string' ? value.slug : '';
      const name = typeof value.name === 'string' ? value.name : slug;
      const version = typeof value.version === 'string' ? value.version : null;
      const status =
        value.status === 'created' || value.status === 'updated' || value.status === 'skipped' || value.status === 'failed'
          ? value.status
          : 'skipped';
      const reason = typeof value.reason === 'string' ? value.reason : null;
      const sourceUrl = typeof value.source_url === 'string' ? value.source_url : typeof value.sourceUrl === 'string' ? value.sourceUrl : null;
      return slug ? {slug, name, version, status, reason, sourceUrl} : null;
    })
    .filter((item): item is SkillSyncRunRecord['items'][number] => Boolean(item));
}

function mapSkillSyncRunRow(row: SkillSyncRunRow): SkillSyncRunRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceKey: row.source_key,
    sourceType: row.source_type,
    displayName: row.display_name,
    status: row.status,
    summary: parseJsonObject(row.summary_json),
    items: mapSkillSyncRunItems(row.items_json),
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
  };
}

function mapUserSkillLibraryRow(row: UserSkillLibraryRow): UserSkillLibraryRecord {
  return {
    userId: row.user_id,
    slug: row.skill_slug,
    version: row.installed_version,
    source: row.source,
    enabled: row.enabled,
    installedAt: row.installed_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapUserMcpLibraryRow(row: UserMcpLibraryRow): UserMcpLibraryRecord {
  return {
    userId: row.user_id,
    mcpKey: row.mcp_key,
    source: row.source,
    enabled: row.enabled,
    installedAt: row.installed_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapUserExtensionInstallConfigRow(
  row: UserExtensionInstallConfigRow,
): UserExtensionInstallConfigRecord {
  return {
    userId: row.user_id,
    extensionType: row.extension_type,
    extensionKey: row.extension_key,
    schemaVersion: row.schema_version,
    status: row.status,
    config: parseJsonObject(row.config_json),
    configuredSecretKeys: parseSkillTags(row.configured_secret_keys),
    secretPayloadEncrypted: row.secret_payload_encrypted,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapUserPrivateSkillRow(row: UserPrivateSkillRow): UserPrivateSkillRecord {
  return {
    userId: row.user_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    market: row.market,
    category: row.category,
    skillType: row.skill_type,
    publisher: row.publisher,
    tags: parseSkillTags(row.tags),
    sourceKind: row.source_kind,
    sourceUrl: row.source_url,
    version: row.version,
    artifactFormat: row.artifact_format,
    artifactKey: row.artifact_key,
    artifactSha256: row.artifact_sha256,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapUserFileRow(row: UserFileRow): UserFileRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    kind: row.kind,
    status: row.status,
    storageProvider: row.storage_provider,
    objectKey: row.object_key,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    source: row.source,
    taskId: row.task_id,
    metadata: row.metadata_json || {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

function mapUserAgentLibraryRow(row: UserAgentLibraryRow): UserAgentLibraryRecord {
  return {
    userId: row.user_id,
    slug: row.agent_slug,
    installedAt: row.installed_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const schemaPath = resolve(repoRoot, 'services/control-plane/sql/001_init.sql');

export async function ensureControlPlaneSchema(databaseUrl: string): Promise<void> {
  const pool = new Pool({connectionString: databaseUrl});
  try {
    const schemaCheck = await pool.query<{
      users_table: string | null;
      skill_catalog_table: string | null;
      portal_apps_table: string | null;
    }>(`
      select
        to_regclass('public.users') as users_table,
        to_regclass('public.skill_catalog') as skill_catalog_table,
        to_regclass('public.portal_apps') as portal_apps_table
    `);
    const existingSchema = schemaCheck.rows[0];
    if (existingSchema?.users_table && existingSchema.skill_catalog_table && existingSchema.portal_apps_table) {
      return;
    }
    const sql = await readFile(schemaPath, 'utf8');
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}

export class PgControlPlaneStore implements ControlPlaneStore {
  readonly storageLabel = 'postgres';
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({connectionString});
  }

  async getUserByIdentifier(identifier: string): Promise<UserRecord | null> {
    const normalized = normalizeUsernameLookup(identifier);
    const result = await this.pool.query<UserRow>(
      `
        select
          u.id,
          u.username,
          e.email,
          u.display_name as "displayName",
          u.avatar_url as "avatarUrl",
          c.password_hash as "passwordHash",
          u.role,
          u.status,
          u.created_at as "createdAt",
          u.updated_at as "updatedAt"
        from users u
        join user_emails e on e.user_id = u.id and e.is_primary = true
        left join user_password_credentials c on c.user_id = u.id
        where lower(u.username) = $1 or e.email = $1
        limit 1
      `,
      [normalized],
    );

    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.trim().toLowerCase();
    const result = await this.pool.query<UserRow>(
      `
        select
          u.id,
          u.username,
          e.email,
          u.display_name as "displayName",
          u.avatar_url as "avatarUrl",
          c.password_hash as "passwordHash",
          u.role,
          u.status,
          u.created_at as "createdAt",
          u.updated_at as "updatedAt"
        from users u
        join user_emails e on e.user_id = u.id and e.is_primary = true
        left join user_password_credentials c on c.user_id = u.id
        where e.email = $1
        limit 1
      `,
      [normalized],
    );
    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async getUserByOAuthAccount(provider: OAuthProvider, providerId: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRow>(
      `
        select
          u.id,
          u.username,
          e.email,
          u.display_name as "displayName",
          u.avatar_url as "avatarUrl",
          c.password_hash as "passwordHash",
          u.role,
          u.status,
          u.created_at as "createdAt",
          u.updated_at as "updatedAt"
        from user_oauth_accounts oa
        join users u on u.id = oa.user_id
        join user_emails e on e.user_id = u.id and e.is_primary = true
        left join user_password_credentials c on c.user_id = u.id
        where oa.provider = $1 and oa.provider_id = $2
        limit 1
      `,
      [provider, providerId],
    );
    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async linkOAuthAccount(userId: string, provider: OAuthProvider, providerId: string): Promise<OAuthAccountRecord> {
    const result = await this.pool.query<OAuthAccountRow>(
      `
        insert into user_oauth_accounts (id, user_id, provider, provider_id, created_at)
        values ($1, $2, $3, $4, now())
        on conflict (provider, provider_id)
        do update set user_id = excluded.user_id
        returning user_id, provider, provider_id, created_at
      `,
      [randomUUID(), userId, provider, providerId],
    );

    return {
      userId: result.rows[0].user_id,
      provider: result.rows[0].provider,
      providerId: result.rows[0].provider_id,
      createdAt: result.rows[0].created_at.toISOString(),
    };
  }

  async unlinkOAuthAccount(userId: string, provider: OAuthProvider): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from user_oauth_accounts
        where user_id = $1 and provider = $2
      `,
      [userId, provider],
    );
    return (result.rowCount || 0) > 0;
  }

  async getOAuthAccountsForUser(userId: string): Promise<OAuthAccountRecord[]> {
    const result = await this.pool.query<OAuthAccountRow>(
      `
        select user_id, provider, provider_id, created_at
        from user_oauth_accounts
        where user_id = $1
        order by created_at asc
      `,
      [userId],
    );
    return result.rows.map((row) => ({
      userId: row.user_id,
      provider: row.provider,
      providerId: row.provider_id,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async updateUserProfile(userId: string, input: {displayName?: string; avatarUrl?: string | null}): Promise<UserRecord | null> {
    const displayName = input.displayName?.trim();
    const avatarUrl = input.avatarUrl === undefined ? undefined : input.avatarUrl?.trim() || null;
    if (displayName === undefined && avatarUrl === undefined) {
      return this.getUserById(userId);
    }
    const fields: string[] = [];
    const values: Array<string | null> = [userId];
    let index = 2;
    if (displayName !== undefined) {
      fields.push(`display_name = $${index++}`);
      values.push(displayName);
    }
    if (avatarUrl !== undefined) {
      fields.push(`avatar_url = $${index++}`);
      values.push(avatarUrl);
    }
    if (fields.length === 0) {
      return this.getUserById(userId);
    }
    await this.pool.query(
      `
        update users
        set ${fields.join(', ')}, updated_at = now()
        where id = $1
      `,
      values,
    );
    return this.getUserById(userId);
  }

  async updateUserRole(userId: string, role: UserRole): Promise<UserRecord | null> {
    await this.pool.query(
      `
        update users
        set role = $2, updated_at = now()
        where id = $1
      `,
      [userId, role],
    );
    return this.getUserById(userId);
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<UserRecord | null> {
    await this.pool.query(
      `
        insert into user_password_credentials (
          user_id,
          password_hash,
          password_algo,
          password_updated_at,
          created_at,
          updated_at
        )
        values ($1, $2, 'scrypt', now(), now(), now())
        on conflict (user_id)
        do update set
          password_hash = excluded.password_hash,
          password_algo = excluded.password_algo,
          password_updated_at = now(),
          updated_at = now()
      `,
      [userId, passwordHash],
    );
    return this.getUserById(userId);
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const normalizedUsername = normalizeUsernameLookup(input.username);
    const existingUser = await this.getUserByIdentifier(input.username);
    if (existingUser && normalizeUsernameLookup(existingUser.username) === normalizedUsername) {
      throw new Error('USERNAME_TAKEN');
    }

    const client = await this.pool.connect();
    const userId = randomUUID();
    const now = new Date();

    try {
      await client.query('begin');
      await client.query(
        `
          insert into users (id, username, display_name, avatar_url, role, status, created_at, updated_at)
          values ($1, $2, $3, $4, $5, 'active', $6, $6)
        `,
        [
          userId,
          input.username.trim().replace(/\s+/g, ' '),
          input.displayName,
          input.avatarUrl?.trim() || null,
          input.role || 'user',
          now,
        ],
      );
      await client.query(
        `
          insert into user_emails (id, user_id, email, is_primary, created_at)
          values ($1, $2, $3, true, $4)
        `,
        [randomUUID(), userId, input.email, now],
      );
      if (input.passwordHash?.trim()) {
        await client.query(
          `
            insert into user_password_credentials (
              user_id,
              password_hash,
              password_algo,
              password_updated_at,
              created_at,
              updated_at
            )
            values ($1, $2, 'scrypt', $3, $3, $3)
          `,
          [userId, input.passwordHash, now],
        );
      }
      await client.query(
        `
          insert into credit_accounts (
            user_id,
            daily_free_balance,
            topup_balance,
            daily_free_granted_at,
            daily_free_expires_at,
            updated_at
          )
          values ($1, $2, $3, $4, $5, $4)
        `,
        [userId, config.dailyFreeCredits, Math.max(0, input.initialCreditBalance), now, startOfNextShanghaiDayIso(now)],
      );
      await client.query(
        `
          insert into credit_ledger (
            id,
            user_id,
            bucket,
            direction,
            amount,
            balance_after,
            reference_type,
            reference_id,
            event_type,
            delta,
            created_at
          )
          values ($1, $2, 'daily_free', 'grant', $3, $3, 'daily_reset', $5, 'daily_reset', $3, $4)
        `,
        [randomUUID(), userId, config.dailyFreeCredits, now, userId],
      );
      if (input.initialCreditBalance > 0) {
        await client.query(
          `
            insert into credit_ledger (
              id,
              user_id,
              bucket,
              direction,
              amount,
              balance_after,
              reference_type,
              reference_id,
              event_type,
              delta,
              created_at
            )
            values ($1, $2, 'topup', 'grant', $3, $3, 'trial_grant', $5, 'signup_grant', $3, $4)
          `,
          [randomUUID(), userId, Math.max(0, input.initialCreditBalance), now, userId],
        );
      }
      await client.query('commit');
      return {
        id: userId,
        username: input.username.trim().replace(/\s+/g, ' '),
        email: input.email,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl?.trim() || null,
        passwordHash: input.passwordHash?.trim() || null,
        role: input.role || 'user',
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async createSession(userId: string, tokens: SessionTokenPair): Promise<SessionRecord> {
    return this.insertSession(this.pool, userId, tokens);
  }

  async replaceSession(refreshTokenHash: string, tokens: SessionTokenPair): Promise<SessionRecord | null> {
    const client = await this.pool.connect();

    try {
      await client.query('begin');
      const existing = await client.query<{device_session_id: string; user_id: string; created_at: Date}>(
        `
          select rt.device_session_id, rt.user_id, ds.created_at
          from refresh_tokens rt
          join device_sessions ds on ds.id = rt.device_session_id
          where token_hash = $1
            and rt.revoked_at is null
            and rt.expires_at > now()
          limit 1
        `,
        [refreshTokenHash],
      );

      const row = existing.rows[0];
      if (!row) {
        await client.query('rollback');
        return null;
      }

      await client.query(
        `
          update access_tokens
          set revoked_at = now()
          where device_session_id = $1 and revoked_at is null
        `,
        [row.device_session_id],
      );
      await client.query(
        `
          update refresh_tokens
          set revoked_at = now()
          where device_session_id = $1 and revoked_at is null
        `,
        [row.device_session_id],
      );
      await client.query(
        `
          update device_sessions
          set status = 'active', last_seen_at = now(), revoked_at = null
          where id = $1
        `,
        [row.device_session_id],
      );

      const session = await this.insertSessionTokens(
        client,
        row.user_id,
        row.device_session_id,
        tokens,
        row.created_at,
      );
      await client.query('commit');
      return session;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async touchSession(
    sessionId: string,
    expiresAt: {
      accessTokenExpiresAt: number;
      refreshTokenExpiresAt: number;
    },
  ): Promise<SessionRecord | null> {
    const client = await this.pool.connect();

    try {
      await client.query('begin');
      const accessResult = await client.query(
        `
          update access_tokens
          set expires_at = $2
          where device_session_id = $1 and revoked_at is null
        `,
        [sessionId, new Date(expiresAt.accessTokenExpiresAt)],
      );
      const refreshResult = await client.query(
        `
          update refresh_tokens
          set expires_at = $2
          where device_session_id = $1 and revoked_at is null
        `,
        [sessionId, new Date(expiresAt.refreshTokenExpiresAt)],
      );

      if ((accessResult.rowCount || 0) === 0 || (refreshResult.rowCount || 0) === 0) {
        await client.query('rollback');
        return null;
      }

      await client.query(
        `
          update device_sessions
          set last_seen_at = now()
          where id = $1
        `,
        [sessionId],
      );
      const session = await this.getSessionById(sessionId, client);
      await client.query('commit');
      return session;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async getSessionByAccessToken(accessTokenHash: string): Promise<SessionRecord | null> {
    const result = await this.pool.query<SessionRow>(
      `
        select
          ds.id as session_id,
          ds.user_id,
          at.token_hash as access_token_hash,
          at.expires_at as access_token_expires_at,
          rt.token_hash as refresh_token_hash,
          rt.expires_at as refresh_token_expires_at,
          ds.created_at
        from access_tokens at
        join device_sessions ds on ds.id = at.device_session_id
        join refresh_tokens rt on rt.device_session_id = ds.id and rt.revoked_at is null
        where at.token_hash = $1
          and at.revoked_at is null
        order by rt.created_at desc
        limit 1
      `,
      [accessTokenHash],
    );

    return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
  }

  async getSessionByRefreshToken(refreshTokenHash: string): Promise<SessionRecord | null> {
    const result = await this.pool.query<SessionRow>(
      `
        select
          ds.id as session_id,
          ds.user_id,
          at.token_hash as access_token_hash,
          at.expires_at as access_token_expires_at,
          rt.token_hash as refresh_token_hash,
          rt.expires_at as refresh_token_expires_at,
          ds.created_at
        from refresh_tokens rt
        join device_sessions ds on ds.id = rt.device_session_id
        join access_tokens at on at.device_session_id = ds.id and at.revoked_at is null
        where rt.token_hash = $1
          and rt.revoked_at is null
        order by at.created_at desc
        limit 1
      `,
      [refreshTokenHash],
    );

    return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRow>(
      `
        select
          u.id,
          u.username,
          e.email,
          u.display_name as "displayName",
          u.avatar_url as "avatarUrl",
          c.password_hash as "passwordHash",
          u.role,
          u.status,
          u.created_at as "createdAt",
          u.updated_at as "updatedAt"
        from users u
        join user_emails e on e.user_id = u.id and e.is_primary = true
        left join user_password_credentials c on c.user_id = u.id
        where u.id = $1
        limit 1
      `,
      [userId],
    );
    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async getCreditAccount(userId: string): Promise<CreditAccountRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const account = await this.lockAndReadAccount(client, userId);
      if (new Date(account.dailyFreeExpiresAt).getTime() <= Date.now()) {
        const now = new Date();
        const nextExpiry = startOfNextShanghaiDayIso(now);
        await client.query(
          `
            update credit_accounts
            set
              daily_free_balance = $2,
              daily_free_granted_at = $3,
              daily_free_expires_at = $4,
              updated_at = $3
            where user_id = $1
          `,
          [userId, config.dailyFreeCredits, now, nextExpiry],
        );
        await client.query(
          `
            insert into credit_ledger (
              id,
              user_id,
              bucket,
              direction,
              amount,
              balance_after,
              reference_type,
              reference_id,
              event_type,
              delta,
              created_at
            )
            values ($1, $2, 'daily_free', 'grant', $3, $3, 'daily_reset', $4, 'daily_reset', $3, $5)
          `,
          [randomUUID(), userId, config.dailyFreeCredits, now.toISOString(), now],
        );
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    const result = await this.pool.query<CreditAccountRow>(
      `
        select user_id, daily_free_balance, topup_balance, daily_free_granted_at, daily_free_expires_at, updated_at
        from credit_accounts
        where user_id = $1
        limit 1
      `,
      [userId],
    );
    const row = result.rows[0];
    if (!row) {
      const now = new Date();
      return {
        userId,
        dailyFreeBalance: config.dailyFreeCredits,
        topupBalance: 0,
        dailyFreeQuota: config.dailyFreeCredits,
        totalAvailableBalance: config.dailyFreeCredits,
        dailyFreeGrantedAt: now.toISOString(),
        dailyFreeExpiresAt: startOfNextShanghaiDayIso(now),
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    }
    return mapCreditAccountRow(row);
  }

  async getCreditBalance(userId: string): Promise<number> {
    const account = await this.getCreditAccount(userId);
    return account.totalAvailableBalance;
  }

  async getCreditLedger(userId: string): Promise<CreditLedgerRecord[]> {
    await this.getCreditAccount(userId);
    const result = await this.pool.query<CreditLedgerRow>(
      `
        select id, user_id, bucket, direction, amount, balance_after, reference_type, reference_id, event_type, delta, created_at
        from credit_ledger
        where user_id = $1
        order by created_at desc
      `,
      [userId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      bucket: row.bucket,
      direction: row.direction,
      amount: parseDbNumber(row.amount),
      balanceAfter: parseDbNumber(row.balance_after),
      referenceType: (row.reference_type || 'manual_adjustment') as CreditLedgerRecord['referenceType'],
      referenceId: row.reference_id || null,
      eventType:
        row.event_type ||
        (row.direction === 'topup'
          ? 'topup'
          : row.direction === 'consume'
            ? 'usage_debit'
            : row.reference_type === 'daily_reset'
              ? 'daily_reset'
              : 'credit_ledger'),
      delta: parseDbNumber(row.delta ?? row.amount),
      createdAt: row.created_at.toISOString(),
    }));
  }

  async createPaymentOrder(
    userId: string,
    input: Required<CreatePaymentOrderInput> & {
      packageName: string;
      credits: number;
      bonusCredits: number;
      amountCnyFen: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<PaymentOrderRecord> {
    const now = new Date();
    const orderId = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.pool.query(
      `
        insert into payment_orders (
          id,
          user_id,
          provider,
          package_id,
          package_name,
          credits,
          bonus_credits,
          amount_cny_fen,
          currency,
          status,
          payment_url,
          expired_at,
          metadata,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 'cny', 'pending', $9, $10, $11::jsonb, $12, $12)
      `,
      [
        orderId,
        userId,
        input.provider,
        input.package_id,
        input.packageName,
        input.credits,
        input.bonusCredits,
        input.amountCnyFen,
        buildPlaceholderPaymentUrl({
          provider: input.provider as PaymentProvider,
          orderId,
          packageName: input.packageName,
          amountCnyFen: input.amountCnyFen,
          expiresAt: expiresAt.toISOString(),
        }),
        expiresAt,
        JSON.stringify({
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
        }),
        now,
      ],
    );
    return (await this.getPaymentOrderById(userId, orderId)) as PaymentOrderRecord;
  }

  async getPaymentOrderById(userId: string, orderId: string): Promise<PaymentOrderRecord | null> {
    let result = await this.pool.query<PaymentOrderRow>(
      `
        select
          id,
          user_id,
          provider,
          package_id,
          package_name,
          credits,
          bonus_credits,
          amount_cny_fen,
          currency,
          status,
          provider_order_id,
          provider_prepay_id,
          payment_url,
          metadata,
          paid_at,
          expired_at,
          created_at,
          updated_at
        from payment_orders
        where id = $1 and user_id = $2
        limit 1
      `,
      [orderId, userId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    if (row.status === 'pending' && row.expired_at && row.expired_at.getTime() <= Date.now()) {
      result = await this.pool.query<PaymentOrderRow>(
        `
          update payment_orders
          set status = 'expired', updated_at = now()
          where id = $1 and user_id = $2 and status = 'pending'
          returning
            id,
            user_id,
            provider,
            package_id,
            package_name,
            credits,
            bonus_credits,
            amount_cny_fen,
            currency,
            status,
            provider_order_id,
            provider_prepay_id,
            payment_url,
            metadata,
            paid_at,
            expired_at,
            created_at,
            updated_at
        `,
        [orderId, userId],
      );
    }
    return result.rows[0] ? mapPaymentOrderRow(result.rows[0]) : null;
  }

  async listPaymentOrdersAdmin(input?: {
    limit?: number | null;
    status?: string | null;
    provider?: string | null;
    appName?: string | null;
    query?: string | null;
  }): Promise<AdminPaymentOrderSummaryRecord[]> {
    const clauses = ['1 = 1'];
    const params: Array<string | number> = [];
    const status = String(input?.status || '').trim().toLowerCase();
    const provider = String(input?.provider || '').trim().toLowerCase();
    const appName = String(input?.appName || '').trim();
    const query = String(input?.query || '').trim();
    const limit = Math.max(1, Math.min(500, Number(input?.limit || 200) || 200));

    if (status) {
      params.push(status);
      clauses.push(`p.status = $${params.length}`);
    }
    if (provider) {
      params.push(provider);
      clauses.push(`p.provider = $${params.length}`);
    }
    if (appName) {
      params.push(appName);
      clauses.push(`coalesce(p.metadata->>'app_name', '') = $${params.length}`);
    }
    if (query) {
      params.push(`%${query.toLowerCase()}%`);
      const queryParam = `$${params.length}`;
      clauses.push(
        `(
          lower(p.id) like ${queryParam}
          or lower(p.package_id) like ${queryParam}
          or lower(p.package_name) like ${queryParam}
          or lower(coalesce(p.provider_order_id, '')) like ${queryParam}
          or lower(coalesce(p.metadata->>'app_name', '')) like ${queryParam}
          or lower(p.user_id::text) like ${queryParam}
          or lower(u.username) like ${queryParam}
          or lower(coalesce(e.email, '')) like ${queryParam}
          or lower(coalesce(u.display_name, '')) like ${queryParam}
        )`,
      );
    }

    params.push(limit);
    const result = await this.pool.query<AdminPaymentOrderRow>(
      `
        select
          p.id,
          p.user_id,
          p.provider,
          p.package_id,
          p.package_name,
          p.credits,
          p.bonus_credits,
          p.amount_cny_fen,
          p.currency,
          p.status,
          p.provider_order_id,
          p.provider_prepay_id,
          p.payment_url,
          p.metadata,
          p.paid_at,
          p.expired_at,
          p.created_at,
          p.updated_at,
          u.username,
          e.email as user_email,
          u.display_name as user_display_name,
          count(w.id) as webhook_event_count,
          max(w.created_at) as latest_webhook_at
        from payment_orders p
        join users u on u.id = p.user_id
        left join user_emails e on e.user_id = u.id and e.is_primary = true
        left join payment_webhook_events w on w.order_id = p.id
        where ${clauses.join(' and ')}
        group by p.id, u.id, e.email
        order by p.created_at desc
        limit $${params.length}
      `,
      params,
    );
    return result.rows.map((row) => mapAdminPaymentOrderRow(row));
  }

  async listPaymentProviderProfiles(input?: {
    provider?: PaymentProvider | null;
    scopeType?: PaymentProviderScopeType | null;
    scopeKey?: string | null;
  }): Promise<PaymentProviderProfileRecord[]> {
    const values: Array<string> = [];
    const where: string[] = [];
    if (input?.provider) {
      values.push(input.provider);
      where.push(`provider = $${values.length}`);
    }
    if (input?.scopeType) {
      values.push(input.scopeType);
      where.push(`scope_type = $${values.length}`);
    }
    if (input?.scopeKey?.trim()) {
      values.push(input.scopeKey.trim());
      where.push(`scope_key = $${values.length}`);
    }
    const whereSql = where.length ? `where ${where.join(' and ')}` : '';
    const result = await this.pool.query<PaymentProviderProfileRow>(
      `
        select
          id,
          provider,
          scope_type,
          scope_key,
          channel_kind,
          display_name,
          enabled,
          config_json,
          configured_secret_keys,
          secret_payload_encrypted,
          created_at,
          updated_at
        from payment_provider_profiles
        ${whereSql}
        order by provider asc, scope_type asc, scope_key asc, display_name asc
      `,
      values,
    );
    return result.rows.map(mapPaymentProviderProfileRow);
  }

  async getPaymentProviderProfileById(id: string): Promise<PaymentProviderProfileRecord | null> {
    const result = await this.pool.query<PaymentProviderProfileRow>(
      `
        select
          id,
          provider,
          scope_type,
          scope_key,
          channel_kind,
          display_name,
          enabled,
          config_json,
          configured_secret_keys,
          secret_payload_encrypted,
          created_at,
          updated_at
        from payment_provider_profiles
        where id = $1
        limit 1
      `,
      [id],
    );
    return result.rows[0] ? mapPaymentProviderProfileRow(result.rows[0]) : null;
  }

  async getPaymentProviderProfileByScope(
    provider: PaymentProvider,
    scopeType: PaymentProviderScopeType,
    scopeKey: string,
  ): Promise<PaymentProviderProfileRecord | null> {
    const result = await this.pool.query<PaymentProviderProfileRow>(
      `
        select
          id,
          provider,
          scope_type,
          scope_key,
          channel_kind,
          display_name,
          enabled,
          config_json,
          configured_secret_keys,
          secret_payload_encrypted,
          created_at,
          updated_at
        from payment_provider_profiles
        where provider = $1
          and scope_type = $2
          and scope_key = $3
        limit 1
      `,
      [provider, scopeType, scopeKey],
    );
    return result.rows[0] ? mapPaymentProviderProfileRow(result.rows[0]) : null;
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
    const existing = await this.getPaymentProviderProfileByScope(input.provider, input.scope_type, input.scope_key);
    const profileId = existing?.id || input.id || randomUUID();
    const result = await this.pool.query<PaymentProviderProfileRow>(
      `
        insert into payment_provider_profiles (
          id,
          provider,
          scope_type,
          scope_key,
          channel_kind,
          display_name,
          enabled,
          config_json,
          configured_secret_keys,
          secret_payload_encrypted,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, now(), now())
        on conflict (provider, scope_type, scope_key)
        do update set
          channel_kind = excluded.channel_kind,
          display_name = excluded.display_name,
          enabled = excluded.enabled,
          config_json = excluded.config_json,
          configured_secret_keys = excluded.configured_secret_keys,
          secret_payload_encrypted = excluded.secret_payload_encrypted,
          updated_at = now()
        returning
          id,
          provider,
          scope_type,
          scope_key,
          channel_kind,
          display_name,
          enabled,
          config_json,
          configured_secret_keys,
          secret_payload_encrypted,
          created_at,
          updated_at
      `,
      [
        profileId,
        input.provider,
        input.scope_type,
        input.scope_key,
        input.channel_kind,
        input.display_name,
        input.enabled !== false,
        JSON.stringify(input.config_values || {}),
        JSON.stringify(input.configured_secret_keys || []),
        input.secret_payload_encrypted ?? null,
      ],
    );
    return mapPaymentProviderProfileRow(result.rows[0]);
  }

  async listPaymentProviderBindings(provider?: PaymentProvider | null): Promise<PaymentProviderBindingRecord[]> {
    const values: Array<string> = [];
    const whereSql = provider ? `where provider = $1` : '';
    if (provider) {
      values.push(provider);
    }
    const result = await this.pool.query<PaymentProviderBindingRow>(
      `
        select
          app_name,
          provider,
          mode,
          active_profile_id,
          updated_at
        from app_payment_provider_overrides
        ${whereSql}
        order by app_name asc, provider asc
      `,
      values,
    );
    return result.rows.map(mapPaymentProviderBindingRow);
  }

  async getPaymentProviderBinding(appName: string, provider: PaymentProvider): Promise<PaymentProviderBindingRecord | null> {
    const result = await this.pool.query<PaymentProviderBindingRow>(
      `
        select
          app_name,
          provider,
          mode,
          active_profile_id,
          updated_at
        from app_payment_provider_overrides
        where app_name = $1 and provider = $2
        limit 1
      `,
      [appName, provider],
    );
    return result.rows[0] ? mapPaymentProviderBindingRow(result.rows[0]) : null;
  }

  async upsertPaymentProviderBinding(
    appName: string,
    input: Required<UpsertAdminPaymentProviderBindingInput> & {
      provider: PaymentProvider;
      mode: PaymentProviderBindingMode;
      active_profile_id?: string | null;
    },
  ): Promise<PaymentProviderBindingRecord> {
    const result = await this.pool.query<PaymentProviderBindingRow>(
      `
        insert into app_payment_provider_overrides (
          app_name,
          provider,
          mode,
          active_profile_id,
          updated_at
        )
        values ($1, $2, $3, $4, now())
        on conflict (app_name, provider)
        do update set
          mode = excluded.mode,
          active_profile_id = excluded.active_profile_id,
          updated_at = now()
        returning
          app_name,
          provider,
          mode,
          active_profile_id,
          updated_at
      `,
      [appName, input.provider, input.mode, input.active_profile_id ?? null],
    );
    return mapPaymentProviderBindingRow(result.rows[0]);
  }

  async getPaymentOrderAdmin(orderId: string): Promise<AdminPaymentOrderDetailRecord | null> {
    const result = await this.pool.query<AdminPaymentOrderRow>(
      `
        select
          p.id,
          p.user_id,
          p.provider,
          p.package_id,
          p.package_name,
          p.credits,
          p.bonus_credits,
          p.amount_cny_fen,
          p.currency,
          p.status,
          p.provider_order_id,
          p.provider_prepay_id,
          p.payment_url,
          p.metadata,
          p.paid_at,
          p.expired_at,
          p.created_at,
          p.updated_at,
          u.username,
          e.email as user_email,
          u.display_name as user_display_name,
          count(w.id) as webhook_event_count,
          max(w.created_at) as latest_webhook_at
        from payment_orders p
        join users u on u.id = p.user_id
        left join user_emails e on e.user_id = u.id and e.is_primary = true
        left join payment_webhook_events w on w.order_id = p.id
        where p.id = $1
        group by p.id, u.id, e.email
        limit 1
      `,
      [orderId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    const webhookEvents = await this.pool.query<PaymentWebhookEventRow>(
      `
        select
          id,
          provider,
          event_id,
          event_type,
          order_id,
          payload,
          signature,
          processed_at,
          process_status,
          created_at
        from payment_webhook_events
        where order_id = $1
        order by created_at desc
      `,
      [orderId],
    );
    return {
      ...mapAdminPaymentOrderRow(row),
      webhookEvents: webhookEvents.rows.map((event) => mapPaymentWebhookEventRow(event)),
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
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const orderResult = await client.query<PaymentOrderRow>(
        `
          select
            id,
            user_id,
            provider,
            package_id,
            package_name,
            credits,
            bonus_credits,
            amount_cny_fen,
            currency,
            status,
            provider_order_id,
            provider_prepay_id,
            payment_url,
            metadata,
            paid_at,
            expired_at,
            created_at,
            updated_at
          from payment_orders
          where id = $1
          limit 1
          for update
        `,
        [input.orderId],
      );
      const orderRow = orderResult.rows[0];
      if (!orderRow) {
        await client.query('rollback');
        return null;
      }

      const paidAt = input.paidAt?.trim() || new Date().toISOString();
      if (orderRow.status !== 'paid') {
        await client.query(
          `
            update payment_orders
            set
              status = 'paid',
              provider_order_id = coalesce(nullif($2, ''), provider_order_id),
              paid_at = coalesce($3::timestamptz, now()),
              updated_at = now()
            where id = $1
          `,
          [orderRow.id, input.providerOrderId || null, paidAt],
        );

        const creditTotal = parseDbNumber(orderRow.credits) + parseDbNumber(orderRow.bonus_credits);
        const account = await this.lockAndReadAccount(client, orderRow.user_id);
        const nextTopup = account.topupBalance + creditTotal;
        await client.query(
          `
            update credit_accounts
            set topup_balance = $2, updated_at = now()
            where user_id = $1
          `,
          [orderRow.user_id, nextTopup],
        );
        await client.query(
          `
            insert into credit_ledger (
              id,
              user_id,
              bucket,
              direction,
              amount,
              balance_after,
              reference_type,
              reference_id,
              event_type,
              delta,
              created_at
            )
            values ($1, $2, 'topup', 'topup', $3, $4, 'topup_order', $5, 'topup', $3, now())
          `,
          [randomUUID(), orderRow.user_id, creditTotal, nextTopup, orderRow.id],
        );
      }

      await client.query(
        `
          insert into payment_webhook_events (
            id,
            provider,
            event_id,
            event_type,
            order_id,
            payload,
            processed_at,
            process_status,
            created_at
          )
          values ($1, $2, $3, $4, $5, $6::jsonb, now(), 'processed', now())
        `,
        [
          randomUUID(),
          orderRow.provider,
          `admin_manual_paid_${Date.now()}_${randomUUID().slice(0, 8)}`,
          'admin_manual_paid',
          orderRow.id,
          JSON.stringify({
            source: 'admin_manual',
            action: 'mark_paid',
            operator_user_id: input.operatorUserId,
            operator_display_name: input.operatorDisplayName,
            provider_order_id: input.providerOrderId || null,
            paid_at: paidAt,
            note: input.note || null,
          }),
        ],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return this.getPaymentOrderAdmin(input.orderId);
  }

  async refundPaymentOrderAdmin(input: {
    orderId: string;
    operatorUserId: string;
    operatorDisplayName: string;
    note?: string | null;
  }): Promise<AdminPaymentOrderDetailRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const orderResult = await client.query<PaymentOrderRow>(
        `
          select
            id,
            user_id,
            provider,
            package_id,
            package_name,
            credits,
            bonus_credits,
            amount_cny_fen,
            currency,
            status,
            provider_order_id,
            provider_prepay_id,
            payment_url,
            metadata,
            paid_at,
            expired_at,
            created_at,
            updated_at
          from payment_orders
          where id = $1
          limit 1
          for update
        `,
        [input.orderId],
      );
      const orderRow = orderResult.rows[0];
      if (!orderRow) {
        await client.query('rollback');
        return null;
      }
      if (orderRow.status === 'refunded') {
        await client.query('commit');
        return this.getPaymentOrderAdmin(input.orderId);
      }
      if (orderRow.status !== 'paid') {
        const error = new Error('payment order is not paid');
        error.name = 'INVALID_PAYMENT_ORDER_STATUS';
        throw error;
      }
      const creditTotal = parseDbNumber(orderRow.credits) + parseDbNumber(orderRow.bonus_credits);
      const account = await this.lockAndReadAccount(client, orderRow.user_id);
      if (account.topupBalance < creditTotal) {
        const error = new Error('insufficient topup balance for refund');
        error.name = 'INSUFFICIENT_TOPUP_BALANCE_FOR_REFUND';
        throw error;
      }
      const nextTopup = account.topupBalance - creditTotal;
      await client.query(
        `
          update payment_orders
          set
            status = 'refunded',
            updated_at = now()
          where id = $1
        `,
        [orderRow.id],
      );
      await client.query(
        `
          update credit_accounts
          set topup_balance = $2, updated_at = now()
          where user_id = $1
        `,
        [orderRow.user_id, nextTopup],
      );
      await client.query(
        `
          insert into credit_ledger (
            id,
            user_id,
            bucket,
            direction,
            amount,
            balance_after,
            reference_type,
            reference_id,
            event_type,
            delta,
            created_at
          )
          values ($1, $2, 'topup', 'refund', $3, $4, 'topup_order', $5, 'refund', $6, now())
        `,
        [randomUUID(), orderRow.user_id, creditTotal, nextTopup, orderRow.id, -creditTotal],
      );
      await client.query(
        `
          insert into payment_webhook_events (
            id,
            provider,
            event_id,
            event_type,
            order_id,
            payload,
            processed_at,
            process_status,
            created_at
          )
          values ($1, $2, $3, $4, $5, $6::jsonb, now(), 'processed', now())
        `,
        [
          randomUUID(),
          orderRow.provider,
          `admin_manual_refund_${Date.now()}_${randomUUID().slice(0, 8)}`,
          'admin_manual_refund',
          orderRow.id,
          JSON.stringify({
            source: 'admin_manual',
            action: 'refund',
            operator_user_id: input.operatorUserId,
            operator_display_name: input.operatorDisplayName,
            refunded_credits: creditTotal,
            note: input.note || null,
          }),
        ],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return this.getPaymentOrderAdmin(input.orderId);
  }

  async applyPaymentWebhook(provider: PaymentProvider, input: Required<PaymentWebhookInput>): Promise<PaymentOrderRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const existingWebhook = await client.query<{event_id: string}>(
        `select event_id from payment_webhook_events where provider = $1 and event_id = $2 limit 1`,
        [provider, input.event_id],
      );
      const orderResult = await client.query<PaymentOrderRow>(
        `
          select
            id,
            user_id,
            provider,
            package_id,
            package_name,
            credits,
            bonus_credits,
            amount_cny_fen,
            currency,
            status,
            provider_order_id,
            provider_prepay_id,
            payment_url,
            metadata,
            paid_at,
            expired_at,
            created_at,
            updated_at
          from payment_orders
          where id = $1 and provider = $2
          limit 1
          for update
        `,
        [input.order_id, provider],
      );
      const orderRow = orderResult.rows[0];
      if (!orderRow) {
        await client.query('rollback');
        return null;
      }
      if (existingWebhook.rows[0]) {
        await client.query('commit');
        return mapPaymentOrderRow(orderRow);
      }
      await client.query(
        `
          insert into payment_webhook_events (id, provider, event_id, event_type, order_id, payload, processed_at, process_status, created_at)
          values ($1, $2, $3, $4, $5, $6::jsonb, now(), 'processed', now())
        `,
        [randomUUID(), provider, input.event_id, input.status, input.order_id, JSON.stringify(input)],
      );
      if (orderRow.status !== 'paid' && input.status === 'paid') {
        const creditTotal = parseDbNumber(orderRow.credits) + parseDbNumber(orderRow.bonus_credits);
        await client.query(
          `
            update payment_orders
            set
              status = 'paid',
              provider_order_id = nullif($2, ''),
              paid_at = coalesce($3::timestamptz, now()),
              updated_at = now()
            where id = $1
          `,
          [orderRow.id, input.provider_order_id, input.paid_at || null],
        );
        const account = await this.lockAndReadAccount(client, orderRow.user_id);
        const nextTopup = account.topupBalance + creditTotal;
        await client.query(
          `
            update credit_accounts
            set topup_balance = $2, updated_at = now()
            where user_id = $1
          `,
          [orderRow.user_id, nextTopup],
        );
        await client.query(
          `
            insert into credit_ledger (
              id,
              user_id,
              bucket,
              direction,
              amount,
              balance_after,
              reference_type,
              reference_id,
              event_type,
              delta,
              created_at
            )
            values ($1, $2, 'topup', 'topup', $3, $4, 'topup_order', $5, 'topup', $3, now())
          `,
          [randomUUID(), orderRow.user_id, creditTotal, nextTopup, orderRow.id],
        );
      } else if (
        orderRow.status !== 'paid' &&
        (input.status === 'failed' || input.status === 'expired' || input.status === 'refunded' || input.status === 'pending')
      ) {
        await client.query(
          `
            update payment_orders
            set
              status = $2,
              provider_order_id = coalesce(nullif($3, ''), provider_order_id),
              updated_at = now()
            where id = $1
          `,
          [orderRow.id, input.status, input.provider_order_id],
        );
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    const result = await this.pool.query<PaymentOrderRow>(
      `
        select
          id,
          user_id,
          provider,
          package_id,
          package_name,
          credits,
          bonus_credits,
          amount_cny_fen,
          currency,
          status,
          provider_order_id,
          provider_prepay_id,
          payment_url,
          metadata,
          paid_at,
          expired_at,
          created_at,
          updated_at
        from payment_orders
        where id = $1
        limit 1
      `,
      [input.order_id],
    );
    return result.rows[0] ? mapPaymentOrderRow(result.rows[0]) : null;
  }

  async getRunGrantById(grantId: string): Promise<RunGrantRecord | null> {
    const result = await this.pool.query<RunGrantRow>(
      `
        select id, user_id, status, nonce, max_input_tokens, max_output_tokens, credit_limit, expires_at, used_at, metadata, created_at
        from run_grants
        where id = $1
        limit 1
      `,
      [grantId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const metadata = row.metadata || {};
    return {
      id: row.id,
      userId: row.user_id,
      sessionKey: typeof metadata.session_key === 'string' ? metadata.session_key : 'main',
      client: typeof metadata.client === 'string' ? metadata.client : 'desktop',
      status: row.status === 'settled' ? 'settled' : 'issued',
      nonce: row.nonce,
      maxInputTokens: row.max_input_tokens,
      maxOutputTokens: row.max_output_tokens,
      creditLimit: typeof row.credit_limit === 'string' ? Number.parseInt(row.credit_limit, 10) : row.credit_limit,
      expiresAt: row.expires_at.toISOString(),
      usedAt: row.used_at ? row.used_at.toISOString() : null,
      signature: typeof metadata.signature === 'string' ? metadata.signature : '',
      billingSummary: parseRunBillingSummary(
        typeof metadata.billing_summary === 'object' ? metadata.billing_summary : null,
        {
          grantId: row.id,
          sessionKey: typeof metadata.session_key === 'string' ? metadata.session_key : 'main',
          client: typeof metadata.client === 'string' ? metadata.client : 'desktop',
        },
      ),
      createdAt: row.created_at.toISOString(),
    };
  }

  async getRunBillingSummary(grantId: string): Promise<RunBillingSummaryRecord | null> {
    const grant = await this.getRunGrantById(grantId);
    if (!grant?.billingSummary) {
      return null;
    }
    return grant.billingSummary;
  }

  async listRunBillingSummariesBySession(
    userId: string,
    sessionKey: string,
    limit?: number | null,
  ): Promise<RunBillingSummaryRecord[]> {
    const normalizedSessionKey = sessionKey.trim() || 'main';
    const normalizedLimit =
      typeof limit === 'number' && Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 200;
    const result = await this.pool.query<RunGrantRow>(
      `
        select
          id,
          user_id,
          status,
          nonce,
          max_input_tokens,
          max_output_tokens,
          credit_limit,
          expires_at,
          used_at,
          metadata,
          created_at
        from run_grants
        where
          user_id = $1
          and status = 'settled'
          and coalesce(metadata->>'session_key', 'main') = $2
          and metadata ? 'billing_summary'
        order by coalesce(used_at, created_at) desc, created_at desc
        limit $3
      `,
      [userId, normalizedSessionKey, normalizedLimit],
    );

    return result.rows
      .map((row) => {
        const metadata = parseJsonObject(row.metadata);
        return parseRunBillingSummary(typeof metadata.billing_summary === 'object' ? metadata.billing_summary : null, {
          grantId: row.id,
          sessionKey: typeof metadata.session_key === 'string' ? metadata.session_key : normalizedSessionKey,
          client: typeof metadata.client === 'string' ? metadata.client : 'desktop',
        });
      })
      .filter((summary): summary is RunBillingSummaryRecord => Boolean(summary));
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
    const grantId = randomUUID();
    const createdAt = new Date();
    await this.pool.query(
      `
        insert into run_grants (
          id,
          user_id,
          status,
          nonce,
          max_input_tokens,
          max_output_tokens,
          credit_limit,
          expires_at,
          metadata,
          created_at
        )
        values ($1, $2, 'issued', $3, $4, $5, $6, $7, $8::jsonb, $9)
      `,
      [
        grantId,
        input.userId,
        input.nonce,
        input.maxInputTokens,
        input.maxOutputTokens,
        input.creditLimit,
        input.expiresAt,
        JSON.stringify({
          session_key: input.sessionKey,
          client: input.client,
          signature: input.signature,
        }),
        createdAt,
      ],
    );

    return {
      id: grantId,
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
      createdAt: createdAt.toISOString(),
    };
  }

  async recordUsageEvent(userId: string, input: PersistedUsageEventInput): Promise<UsageEventResult> {
    const client = await this.pool.connect();

    try {
      await client.query('begin');

      const grant = await this.getRunGrantById(input.grant_id);
      const sessionKey = grant?.sessionKey || 'main';
      const runClient = grant?.client || 'desktop';

      const existing = await client.query<UsageEventLookupRow>(
        `
          select event_id, run_grant_id, input_tokens, output_tokens, credit_cost, provider, model, created_at
          from usage_events
          where event_id = $1
          limit 1
        `,
        [input.event_id],
      );
      if (existing.rows[0]) {
        const balance = await this.lockAndReadAccount(client, userId);
        await client.query('commit');
        const row = existing.rows[0];
        const settledAt = row.created_at?.toISOString() || new Date().toISOString();
        const persistedSummary =
          grant?.billingSummary && grant.billingSummary.eventId === row.event_id ? grant.billingSummary : null;
        return {
          accepted: true,
          balanceAfter: balance,
          debits: [],
          summary: persistedSummary || {
            grantId: input.grant_id,
            eventId: row.event_id,
            sessionKey,
            client: runClient,
            status: 'settled',
            inputTokens: row.input_tokens || 0,
            outputTokens: row.output_tokens || 0,
            creditCost: parseDbNumber(row.credit_cost),
            provider: row.provider || null,
            model: row.model || null,
            balanceAfter: balance.totalAvailableBalance,
            settledAt,
            assistantTimestamp: null,
          },
        };
      }

      const balance = await this.lockAndReadAccount(client, userId);
      const dailyDebit = Math.min(balance.dailyFreeBalance, input.credit_cost);
      const topupDebit = input.credit_cost - dailyDebit;
      if (topupDebit > balance.topupBalance) {
        throw new Error('INSUFFICIENT_CREDITS');
      }
      const nextDailyFreeBalance = balance.dailyFreeBalance - dailyDebit;
      const nextTopupBalance = balance.topupBalance - topupDebit;
      const nextBalance = nextDailyFreeBalance + nextTopupBalance;
      const settledAt = new Date().toISOString();
      const summary: RunBillingSummaryRecord = {
        grantId: input.grant_id,
        eventId: input.event_id,
        sessionKey,
        client: runClient,
        status: 'settled',
        inputTokens: input.input_tokens,
        outputTokens: input.output_tokens,
        creditCost: input.credit_cost,
        provider: input.provider || null,
        model: input.model || null,
        balanceAfter: nextBalance,
        settledAt,
        assistantTimestamp:
          typeof input.assistant_timestamp === 'number' && Number.isFinite(input.assistant_timestamp)
            ? Math.floor(input.assistant_timestamp)
            : null,
      };

      await client.query(
        `
          insert into usage_events (
            id,
            event_id,
            user_id,
            run_grant_id,
            input_tokens,
            output_tokens,
            credit_cost,
            provider,
            model,
            created_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
        `,
        [
          randomUUID(),
          input.event_id,
          userId,
          input.grant_id || null,
          input.input_tokens,
          input.output_tokens,
          input.credit_cost,
          input.provider || null,
          input.model || null,
        ],
      );

      await client.query(
        `
          update credit_accounts
          set
            daily_free_balance = $2,
            topup_balance = $3,
            updated_at = now()
          where user_id = $1
        `,
        [userId, nextDailyFreeBalance, nextTopupBalance],
      );
      if (dailyDebit > 0) {
        await client.query(
          `
            insert into credit_ledger (
              id,
              user_id,
              bucket,
              direction,
              amount,
              balance_after,
              reference_type,
              reference_id,
              event_type,
              delta,
              metadata,
              created_at
            )
            values ($1, $2, 'daily_free', 'consume', $3, $4, 'chat_run', $5, 'usage_debit', $3, $6::jsonb, now())
          `,
          [
            randomUUID(),
            userId,
            -dailyDebit,
            nextDailyFreeBalance,
            input.event_id,
            JSON.stringify({
              grant_id: input.grant_id,
              input_tokens: input.input_tokens,
              output_tokens: input.output_tokens,
              provider: input.provider,
              model: input.model,
            }),
          ],
        );
      }
      if (topupDebit > 0) {
        await client.query(
          `
            insert into credit_ledger (
              id,
              user_id,
              bucket,
              direction,
              amount,
              balance_after,
              reference_type,
              reference_id,
              event_type,
              delta,
              metadata,
              created_at
            )
            values ($1, $2, 'topup', 'consume', $3, $4, 'chat_run', $5, 'usage_debit', $3, $6::jsonb, now())
          `,
          [
            randomUUID(),
            userId,
            -topupDebit,
            nextTopupBalance,
            input.event_id,
            JSON.stringify({
              grant_id: input.grant_id,
              input_tokens: input.input_tokens,
              output_tokens: input.output_tokens,
              provider: input.provider,
              model: input.model,
            }),
          ],
        );
      }

      await client.query(
        `
          update run_grants
          set
            status = 'settled',
            used_at = now(),
            metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
          where id = $1
        `,
        [
          input.grant_id,
          JSON.stringify({
            settled_event_id: input.event_id,
            billing_summary: {
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
            },
          }),
        ],
      );

      await client.query('commit');
      return {
        accepted: true,
        balanceAfter: {
          ...balance,
          dailyFreeBalance: nextDailyFreeBalance,
          topupBalance: nextTopupBalance,
          totalAvailableBalance: nextBalance,
          updatedAt: settledAt,
        },
        debits: [
          ...(dailyDebit > 0 ? [{bucket: 'daily_free' as const, amount: dailyDebit}] : []),
          ...(topupDebit > 0 ? [{bucket: 'topup' as const, amount: topupDebit}] : []),
        ],
        summary,
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async getWorkspaceBackup(userId: string): Promise<WorkspaceBackupRecord | null> {
    const result = await this.pool.query<WorkspaceBackupRow>(
      `
        select user_id, identity_md, user_md, soul_md, agents_md, created_at, updated_at
        from user_workspace_backups
        where user_id = $1
        limit 1
      `,
      [userId],
    );
    return result.rows[0] ? mapWorkspaceBackupRow(result.rows[0]) : null;
  }

  async saveWorkspaceBackup(userId: string, input: WorkspaceBackupInput): Promise<WorkspaceBackupRecord> {
    const result = await this.pool.query<WorkspaceBackupRow>(
      `
        insert into user_workspace_backups (
          user_id,
          identity_md,
          user_md,
          soul_md,
          agents_md,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, now(), now())
        on conflict (user_id)
        do update set
          identity_md = excluded.identity_md,
          user_md = excluded.user_md,
          soul_md = excluded.soul_md,
          agents_md = excluded.agents_md,
          updated_at = now()
        returning user_id, identity_md, user_md, soul_md, agents_md, created_at, updated_at
      `,
      [userId, input.identity_md, input.user_md, input.soul_md, input.agents_md],
    );
    return mapWorkspaceBackupRow(result.rows[0]);
  }

  async listUserFiles(
    userId: string,
    options?: {kind?: string | null; includeDeleted?: boolean; limit?: number | null},
  ): Promise<UserFileRecord[]> {
    const values: Array<string | number | boolean> = [userId];
    const conditions = ['user_id = $1'];
    if (!options?.includeDeleted) {
      conditions.push(`status <> 'deleted'`);
    }
    if (options?.kind?.trim()) {
      values.push(options.kind.trim());
      conditions.push(`kind = $${values.length}`);
    }
    const limit =
      typeof options?.limit === 'number' && Number.isFinite(options.limit) ? Math.max(1, Math.floor(options.limit)) : null;
    let limitClause = '';
    if (limit) {
      values.push(limit);
      limitClause = `limit $${values.length}`;
    }
    const result = await this.pool.query<UserFileRow>(
      `
        select
          id,
          user_id,
          tenant_id,
          kind,
          status,
          storage_provider,
          object_key,
          original_file_name,
          mime_type,
          size_bytes,
          sha256,
          source,
          task_id,
          metadata_json,
          created_at,
          updated_at,
          deleted_at
        from user_files
        where ${conditions.join(' and ')}
        order by created_at desc
        ${limitClause}
      `,
      values,
    );
    return result.rows.map(mapUserFileRow);
  }

  async getUserFile(userId: string, fileId: string): Promise<UserFileRecord | null> {
    const result = await this.pool.query<UserFileRow>(
      `
        select
          id,
          user_id,
          tenant_id,
          kind,
          status,
          storage_provider,
          object_key,
          original_file_name,
          mime_type,
          size_bytes,
          sha256,
          source,
          task_id,
          metadata_json,
          created_at,
          updated_at,
          deleted_at
        from user_files
        where user_id = $1 and id = $2
        limit 1
      `,
      [userId, fileId],
    );
    return result.rows[0] ? mapUserFileRow(result.rows[0]) : null;
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
    const fileId = randomUUID();
    const result = await this.pool.query<UserFileRow>(
      `
        insert into user_files (
          id,
          user_id,
          tenant_id,
          kind,
          status,
          storage_provider,
          object_key,
          original_file_name,
          mime_type,
          size_bytes,
          sha256,
          source,
          task_id,
          metadata_json,
          created_at,
          updated_at
        )
        values (
          $1::uuid,
          $2::uuid,
          $3,
          $4,
          'active',
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13::jsonb,
          now(),
          now()
        )
        returning
          id,
          user_id,
          tenant_id,
          kind,
          status,
          storage_provider,
          object_key,
          original_file_name,
          mime_type,
          size_bytes,
          sha256,
          source,
          task_id,
          metadata_json,
          created_at,
          updated_at,
          deleted_at
      `,
      [
        fileId,
        userId,
        input.tenantId,
        input.kind,
        input.storageProvider,
        input.objectKey,
        input.originalFileName,
        input.mimeType,
        input.sizeBytes,
        input.sha256,
        input.source || null,
        input.taskId || null,
        JSON.stringify(input.metadata || {}),
      ],
    );
    return mapUserFileRow(result.rows[0]);
  }

  async markUserFileDeleted(userId: string, fileId: string): Promise<UserFileRecord | null> {
    const result = await this.pool.query<UserFileRow>(
      `
        update user_files
        set
          status = 'deleted',
          updated_at = now(),
          deleted_at = coalesce(deleted_at, now())
        where user_id = $1 and id = $2
        returning
          id,
          user_id,
          tenant_id,
          kind,
          status,
          storage_provider,
          object_key,
          original_file_name,
          mime_type,
          size_bytes,
          sha256,
          source,
          task_id,
          metadata_json,
          created_at,
          updated_at,
          deleted_at
      `,
      [userId, fileId],
    );
    return result.rows[0] ? mapUserFileRow(result.rows[0]) : null;
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
    const conditions: string[] = [];
    const values: unknown[] = [];
    const market = typeof input?.market === 'string' ? input.market.trim() : '';
    const exchange = typeof input?.exchange === 'string' ? input.exchange.trim() : '';
    const search = typeof input?.search === 'string' ? input.search.trim() : '';
    const tag = typeof input?.tag === 'string' ? input.tag.trim() : '';
    const limit = typeof input?.limit === 'number' && Number.isFinite(input.limit) ? Math.max(1, Math.floor(input.limit)) : 100;
    const offset = typeof input?.offset === 'number' && Number.isFinite(input.offset) ? Math.max(0, Math.floor(input.offset)) : 0;

    if (market) {
      values.push(market);
      conditions.push(`market = $${values.length}`);
    }
    if (exchange) {
      values.push(exchange);
      conditions.push(`exchange = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      const placeholder = `$${values.length}`;
      conditions.push(`(symbol ilike ${placeholder} or company_name ilike ${placeholder})`);
    }
    if (tag) {
      values.push(tag);
      conditions.push(`strategy_tags @> array[$${values.length}]::text[]`);
    }

    const whereSql = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const sortSql = (() => {
      switch (input?.sort) {
        case 'pe_ttm_asc':
          return 'pe_ttm asc nulls last, total_market_cap desc nulls last';
        case 'market_cap_desc':
          return 'total_market_cap desc nulls last, amount desc nulls last';
        case 'turnover_rate_desc':
          return 'turnover_rate desc nulls last, amount desc nulls last';
        case 'amount_desc':
          return 'amount desc nulls last, change_percent desc nulls last';
        case 'name_asc':
          return 'company_name asc, symbol asc';
        case 'change_percent_desc':
        default:
          return 'change_percent desc nulls last, amount desc nulls last';
      }
    })();

    const selectSql = `
      select
        id,
        market,
        exchange,
        symbol,
        company_name,
        board,
        status,
        source,
        source_id,
        current_price,
        change_percent,
        amount,
        turnover_rate,
        pe_ttm,
        open_price,
        prev_close,
        total_market_cap,
        circulating_market_cap,
        strategy_tags,
        metadata_json,
        imported_at,
        updated_at
      from market_stock_catalog
      ${whereSql}
    `;

    const totalResult = await this.pool.query<{count: string}>(`select count(*)::text as count from market_stock_catalog ${whereSql}`, values);
    const pagedValues = [...values, limit, offset];
    const rowsResult = await this.pool.query<MarketStockRow>(
      `${selectSql} order by ${sortSql} limit $${pagedValues.length - 1} offset $${pagedValues.length}`,
      pagedValues,
    );
    return {
      items: rowsResult.rows.map(mapMarketStockRow),
      total: Number.parseInt(totalResult.rows[0]?.count || '0', 10) || 0,
    };
  }

  async getMarketStock(stockId: string): Promise<MarketStockRecord | null> {
    const result = await this.pool.query<MarketStockRow>(
      `
        select
          id,
          market,
          exchange,
          symbol,
          company_name,
          board,
          status,
          source,
          source_id,
          current_price,
          change_percent,
          amount,
          turnover_rate,
          pe_ttm,
          open_price,
          prev_close,
          total_market_cap,
          circulating_market_cap,
          strategy_tags,
          metadata_json,
          imported_at,
          updated_at
        from market_stock_catalog
        where id = $1
        limit 1
      `,
      [stockId],
    );
    return result.rows[0] ? mapMarketStockRow(result.rows[0]) : null;
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
    const conditions: string[] = [];
    const values: unknown[] = [];
    const market = typeof input?.market === 'string' ? input.market.trim() : '';
    const exchange = typeof input?.exchange === 'string' ? input.exchange.trim() : '';
    const instrumentKind = typeof input?.instrumentKind === 'string' ? input.instrumentKind.trim() : '';
    const region = typeof input?.region === 'string' ? input.region.trim() : '';
    const riskLevel = typeof input?.riskLevel === 'string' ? input.riskLevel.trim() : '';
    const search = typeof input?.search === 'string' ? input.search.trim() : '';
    const tag = typeof input?.tag === 'string' ? input.tag.trim() : '';
    const limit = typeof input?.limit === 'number' && Number.isFinite(input.limit) ? Math.max(1, Math.floor(input.limit)) : 100;
    const offset = typeof input?.offset === 'number' && Number.isFinite(input.offset) ? Math.max(0, Math.floor(input.offset)) : 0;

    if (market) {
      values.push(market);
      conditions.push(`market = $${values.length}`);
    }
    if (exchange) {
      values.push(exchange);
      conditions.push(`exchange = $${values.length}`);
    }
    if (instrumentKind) {
      values.push(instrumentKind);
      conditions.push(`instrument_kind = $${values.length}`);
    }
    if (region) {
      values.push(region);
      conditions.push(`region = $${values.length}`);
    }
    if (riskLevel) {
      values.push(riskLevel);
      conditions.push(`risk_level = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      const placeholder = `$${values.length}`;
      conditions.push(`(symbol ilike ${placeholder} or fund_name ilike ${placeholder} or coalesce(manager_name, '') ilike ${placeholder} or coalesce(tracking_target, '') ilike ${placeholder})`);
    }
    if (tag) {
      values.push(tag);
      conditions.push(`strategy_tags @> array[$${values.length}]::text[]`);
    }

    const whereSql = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const sortSql = (() => {
      switch (input?.sort) {
        case 'scale_desc':
          return 'scale_amount desc nulls last, return_1y desc nulls last';
        case 'fee_rate_asc':
          return 'fee_rate asc nulls last, scale_amount desc nulls last';
        case 'name_asc':
          return 'fund_name asc, symbol asc';
        case 'change_percent_desc':
          return 'change_percent desc nulls last, amount desc nulls last';
        case 'return_1y_desc':
        default:
          return 'return_1y desc nulls last, scale_amount desc nulls last';
      }
    })();

    const selectSql = `
      select
        id,
        market,
        exchange,
        symbol,
        fund_name,
        fund_type,
        instrument_kind,
        region,
        risk_level,
        manager_name,
        tracking_target,
        status,
        source,
        source_id,
        current_price,
        nav_price,
        change_percent,
        return_1m,
        return_1y,
        max_drawdown,
        scale_amount,
        fee_rate,
        amount,
        turnover_rate,
        dividend_mode,
        strategy_tags,
        metadata_json,
        imported_at,
        updated_at
      from market_fund_catalog
      ${whereSql}
    `;

    const totalResult = await this.pool.query<{count: string}>(`select count(*)::text as count from market_fund_catalog ${whereSql}`, values);
    const pagedValues = [...values, limit, offset];
    const rowsResult = await this.pool.query<MarketFundRow>(
      `${selectSql} order by ${sortSql} limit $${pagedValues.length - 1} offset $${pagedValues.length}`,
      pagedValues,
    );
    return {
      items: rowsResult.rows.map(mapMarketFundRow),
      total: Number.parseInt(totalResult.rows[0]?.count || '0', 10) || 0,
    };
  }

  async getMarketFund(fundId: string): Promise<MarketFundRecord | null> {
    const result = await this.pool.query<MarketFundRow>(
      `
        select
          id,
          market,
          exchange,
          symbol,
          fund_name,
          fund_type,
          instrument_kind,
          region,
          risk_level,
          manager_name,
          tracking_target,
          status,
          source,
          source_id,
          current_price,
          nav_price,
          change_percent,
          return_1m,
          return_1y,
          max_drawdown,
          scale_amount,
          fee_rate,
          amount,
          turnover_rate,
          dividend_mode,
          strategy_tags,
          metadata_json,
          imported_at,
          updated_at
        from market_fund_catalog
        where id = $1
        limit 1
      `,
      [fundId],
    );
    return result.rows[0] ? mapMarketFundRow(result.rows[0]) : null;
  }

  async listAgentCatalog(): Promise<AgentCatalogEntryRecord[]> {
    const result = await this.pool.query<AgentCatalogRow>(
      `
        select
          slug,
          name,
          description,
          category,
          publisher,
          featured,
        official,
        tags,
        capabilities,
        use_cases,
        metadata_json,
        sort_order,
        active,
        created_at,
        updated_at
        from agent_catalog_entries
        where active = true
        order by sort_order asc, name asc
      `,
    );
    return result.rows.map(mapAgentCatalogRow);
  }

  async listAgentCatalogAdmin(): Promise<AgentCatalogEntryRecord[]> {
    const result = await this.pool.query<AgentCatalogRow>(
      `
        select
          slug,
          name,
          description,
          category,
          publisher,
          featured,
          official,
          tags,
          capabilities,
          use_cases,
          metadata_json,
          sort_order,
          active,
          created_at,
          updated_at
        from agent_catalog_entries
        order by sort_order asc, name asc
      `,
    );
    return result.rows.map(mapAgentCatalogRow);
  }

  async countAgentCatalogAdmin(): Promise<number> {
    const result = await this.pool.query<{count: string}>(
      `
        select count(*)::text as count
        from agent_catalog_entries
      `,
    );
    return Number(result.rows[0]?.count || '0');
  }

  async getAgentCatalogEntry(slug: string): Promise<AgentCatalogEntryRecord | null> {
    const result = await this.pool.query<AgentCatalogRow>(
      `
        select
          slug,
          name,
          description,
          category,
          publisher,
          featured,
        official,
        tags,
        capabilities,
        use_cases,
        metadata_json,
        sort_order,
        active,
        created_at,
        updated_at
        from agent_catalog_entries
        where slug = $1
        limit 1
      `,
      [slug],
    );
    return result.rows[0] ? mapAgentCatalogRow(result.rows[0]) : null;
  }

  async upsertAgentCatalogEntry(input: Required<UpsertAgentCatalogEntryInput>): Promise<AgentCatalogEntryRecord> {
    await this.pool.query(
      `
        insert into agent_catalog_entries (
          slug,
          name,
          description,
          category,
          publisher,
          featured,
          official,
          tags,
          capabilities,
          use_cases,
          metadata_json,
          sort_order,
          active,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, now(), now())
        on conflict (slug)
        do update set
          name = excluded.name,
          description = excluded.description,
          category = excluded.category,
          publisher = excluded.publisher,
          featured = excluded.featured,
          official = excluded.official,
          tags = excluded.tags,
          capabilities = excluded.capabilities,
          use_cases = excluded.use_cases,
          metadata_json = excluded.metadata_json,
          sort_order = excluded.sort_order,
          active = excluded.active,
          updated_at = now()
      `,
      [
        input.slug,
        input.name,
        input.description,
        input.category,
        input.publisher,
        input.featured,
        input.official,
        JSON.stringify(input.tags),
        JSON.stringify(input.capabilities),
        JSON.stringify(input.use_cases),
        JSON.stringify(input.metadata),
        input.sort_order,
        input.active,
      ],
    );

    const record = await this.getAgentCatalogEntry(input.slug);
    if (!record) {
      throw new Error('AGENT_UPSERT_FAILED');
    }
    return record;
  }

  async deleteAgentCatalogEntry(slug: string): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from agent_catalog_entries
        where slug = $1
      `,
      [slug],
    );
    return (result.rowCount || 0) > 0;
  }

  async listSkillCatalog(
    limit?: number,
    offset?: number,
    filters?: {tagKeywords?: string[] | null; extraSkillSlugs?: string[] | null},
  ): Promise<SkillCatalogEntryRecord[]> {
    const values: unknown[] = [];
    const whereSql = this.buildSkillCatalogWhereClause(values, {
      cloudOnly: true,
      tagKeywords: filters?.tagKeywords || [],
      extraSkillSlugs: filters?.extraSkillSlugs || [],
    });
    const paginationSql = this.buildSkillCatalogPaginationClause(values, limit, offset);
    return this.listSkillCatalogEntries(`
      select
        slug,
        name,
        description,
        market,
        category,
        skill_type,
        publisher,
        distribution,
        tags,
        version,
        artifact_format,
        artifact_url,
        artifact_sha256,
        artifact_source_path,
        origin_type,
        source_url,
        metadata_json,
        active,
        created_at,
        updated_at
      from skill_catalog_entries
      ${whereSql}
      ${this.buildSkillCatalogOrderClause()}
      ${paginationSql}
    `, values);
  }

  async countSkillCatalog(filters?: {tagKeywords?: string[] | null; extraSkillSlugs?: string[] | null}): Promise<number> {
    const values: unknown[] = [];
    const whereSql = this.buildSkillCatalogWhereClause(values, {
      cloudOnly: true,
      tagKeywords: filters?.tagKeywords || [],
      extraSkillSlugs: filters?.extraSkillSlugs || [],
    });
    const result = await this.pool.query<{count: string}>(
      `
        select count(*)::text as count
        from skill_catalog_entries
        ${whereSql}
      `,
      values,
    );
    return Number(result.rows[0]?.count || '0');
  }

  async listSkillCatalogBySlugs(
    slugs: string[],
    limit?: number,
    offset?: number,
    filters?: {tagKeywords?: string[] | null},
  ): Promise<SkillCatalogEntryRecord[]> {
    const normalizedSlugs = Array.from(new Set(slugs.map((slug) => slug.trim()).filter(Boolean)));
    if (normalizedSlugs.length === 0) {
      return [];
    }
    const values: unknown[] = [normalizedSlugs];
    const whereSql = this.buildSkillCatalogWhereClause(values, {
      slugPlaceholder: '$1::text[]',
      tagKeywords: filters?.tagKeywords || [],
    });
    const paginationSql = this.buildSkillCatalogPaginationClause(values, limit, offset);
    return this.listSkillCatalogEntries(`
      select
        slug,
        name,
        description,
        market,
        category,
        skill_type,
        publisher,
        distribution,
        tags,
        version,
        artifact_format,
        artifact_url,
        artifact_sha256,
        artifact_source_path,
        origin_type,
        source_url,
        metadata_json,
        active,
        created_at,
        updated_at
      from skill_catalog_entries
      ${whereSql}
      ${this.buildSkillCatalogOrderClause()}
      ${paginationSql}
    `, values);
  }

  async countSkillCatalogBySlugs(slugs: string[], filters?: {tagKeywords?: string[] | null}): Promise<number> {
    const normalizedSlugs = Array.from(new Set(slugs.map((slug) => slug.trim()).filter(Boolean)));
    if (normalizedSlugs.length === 0) {
      return 0;
    }
    const values: unknown[] = [normalizedSlugs];
    const whereSql = this.buildSkillCatalogWhereClause(values, {
      slugPlaceholder: '$1::text[]',
      tagKeywords: filters?.tagKeywords || [],
    });
    const result = await this.pool.query<{count: string}>(
      `
        select count(*)::text as count
        from skill_catalog_entries
        ${whereSql}
      `,
      values,
    );
    return Number(result.rows[0]?.count || '0');
  }

  async listSkillCatalogAdmin(limit?: number, offset?: number, query?: string): Promise<SkillCatalogEntryRecord[]> {
    const values: unknown[] = [];
    const whereClauses: string[] = [];
    const normalizedQuery = typeof query === 'string' ? query.trim() : '';
    if (normalizedQuery) {
      values.push(`%${normalizedQuery}%`);
      const placeholder = `$${values.length}`;
      whereClauses.push(`
        (
          slug ilike ${placeholder}
          or name ilike ${placeholder}
          or coalesce(description, '') ilike ${placeholder}
          or coalesce(category, '') ilike ${placeholder}
          or coalesce(publisher, '') ilike ${placeholder}
          or exists (
            select 1
            from jsonb_array_elements_text(coalesce(tags, '[]'::jsonb)) as tag
            where tag ilike ${placeholder}
          )
        )
      `);
    }
    const whereSql = whereClauses.length ? `where ${whereClauses.join(' and ')}` : '';
    const paginationSql = this.buildSkillCatalogPaginationClause(values, limit, offset);
    return this.listSkillCatalogEntries(`
      select
        slug,
        name,
        description,
        market,
        category,
        skill_type,
        publisher,
        distribution,
        tags,
        version,
        artifact_format,
        artifact_url,
        artifact_sha256,
        artifact_source_path,
        origin_type,
        source_url,
        metadata_json,
        active,
        created_at,
        updated_at
      from skill_catalog_entries
      ${whereSql}
      order by name asc
      ${paginationSql}
    `, values);
  }

  async countSkillCatalogAdmin(query?: string): Promise<number> {
    const values: unknown[] = [];
    const normalizedQuery = typeof query === 'string' ? query.trim() : '';
    let whereSql = '';
    if (normalizedQuery) {
      values.push(`%${normalizedQuery}%`);
      const placeholder = `$${values.length}`;
      whereSql = `
        where
          slug ilike ${placeholder}
          or name ilike ${placeholder}
          or coalesce(description, '') ilike ${placeholder}
          or coalesce(category, '') ilike ${placeholder}
          or coalesce(publisher, '') ilike ${placeholder}
          or exists (
            select 1
            from jsonb_array_elements_text(coalesce(tags, '[]'::jsonb)) as tag
            where tag ilike ${placeholder}
          )
      `;
    }
    const result = await this.pool.query<{count: string}>(
      `
        select count(*)::text as count
        from skill_catalog_entries
        ${whereSql}
      `,
      values,
    );
    return Number(result.rows[0]?.count || '0');
  }

  async getSkillCatalogEntry(slug: string): Promise<SkillCatalogEntryRecord | null> {
    const items = await this.listSkillCatalogEntries(
      `
        select
          slug,
          name,
          description,
          market,
          category,
          skill_type,
          publisher,
          distribution,
          tags,
          version,
          artifact_format,
          artifact_url,
          artifact_sha256,
          artifact_source_path,
          origin_type,
          source_url,
          metadata_json,
          active,
          created_at,
          updated_at
        from skill_catalog_entries
        where slug = $1
        limit 1
      `,
      [slug],
    );
    return items[0] || null;
  }

  async upsertSkillCatalogEntry(input: Required<UpsertSkillCatalogEntryInput>): Promise<SkillCatalogEntryRecord> {
    await this.pool.query(
      `
        insert into skill_catalog_entries (
          slug,
          name,
          description,
          market,
          category,
          skill_type,
          publisher,
          distribution,
          tags,
          version,
          artifact_format,
          artifact_url,
          artifact_sha256,
          artifact_source_path,
          origin_type,
          source_url,
          metadata_json,
          active,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, now(), now())
        on conflict (slug)
        do update set
          name = excluded.name,
          description = excluded.description,
          market = excluded.market,
          category = excluded.category,
          skill_type = excluded.skill_type,
          publisher = excluded.publisher,
          distribution = excluded.distribution,
          tags = excluded.tags,
          version = excluded.version,
          artifact_format = excluded.artifact_format,
          artifact_url = excluded.artifact_url,
          artifact_sha256 = excluded.artifact_sha256,
          artifact_source_path = excluded.artifact_source_path,
          origin_type = excluded.origin_type,
          source_url = excluded.source_url,
          metadata_json = excluded.metadata_json,
          active = excluded.active,
          updated_at = now()
      `,
      [
        input.slug,
        input.name,
        input.description,
        input.market,
        input.category,
        input.skill_type,
        input.publisher,
        input.distribution,
        JSON.stringify(input.tags),
        input.version,
        input.artifact_format,
        input.artifact_url,
        input.artifact_sha256,
        input.artifact_source_path,
        input.origin_type,
        input.source_url,
        JSON.stringify(input.metadata),
        input.active,
      ],
    );
    await this.pool.query(
      `
        update user_skill_library
        set installed_version = $2,
            updated_at = now()
        where skill_slug = $1 and source = 'cloud'
      `,
      [input.slug, input.version],
    );

    const record = await this.getSkillCatalogEntry(input.slug);
    if (!record) {
      throw new Error('SKILL_UPSERT_FAILED');
    }
    return record;
  }

  async deleteSkillCatalogEntry(slug: string): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from skill_catalog_entries
        where slug = $1
      `,
      [slug],
    );
    return (result.rowCount || 0) > 0;
  }

  async listMcpCatalog(limit?: number, offset?: number): Promise<McpCatalogEntryRecord[]> {
    const values: unknown[] = [];
    const paginationSql = this.buildSkillCatalogPaginationClause(values, limit, offset);
    return this.listMcpCatalogEntries(
      `
        select
          mcp_key,
          name,
          description,
          transport,
          object_key,
          config_json,
          metadata_json,
          active,
          created_at,
          updated_at
        from oem_mcp_catalog
        where active = true
        order by name asc
        ${paginationSql}
      `,
      values,
    );
  }

  async countMcpCatalog(): Promise<number> {
    const result = await this.pool.query<{count: string}>(
      `
        select count(*)::text as count
        from oem_mcp_catalog
        where active = true
      `,
    );
    return Number(result.rows[0]?.count || '0');
  }

  async getMcpCatalogEntry(mcpKey: string): Promise<McpCatalogEntryRecord | null> {
    const result = await this.listMcpCatalogEntries(
      `
        select
          mcp_key,
          name,
          description,
          transport,
          object_key,
          config_json,
          metadata_json,
          active,
          created_at,
          updated_at
        from oem_mcp_catalog
        where mcp_key = $1
        limit 1
      `,
      [mcpKey],
    );
    return result[0] || null;
  }

  async listSkillSyncSources(): Promise<SkillSyncSourceRecord[]> {
    const result = await this.pool.query<SkillSyncSourceRow>(
      `
        select
          id,
          source_type,
          source_key,
          display_name,
          source_url,
          config_json,
          active,
          last_run_at,
          created_at,
          updated_at
        from skill_sync_sources
        order by display_name asc
      `,
    );
    return result.rows.map(mapSkillSyncSourceRow);
  }

  async getSkillSyncSource(id: string): Promise<SkillSyncSourceRecord | null> {
    const result = await this.pool.query<SkillSyncSourceRow>(
      `
        select
          id,
          source_type,
          source_key,
          display_name,
          source_url,
          config_json,
          active,
          last_run_at,
          created_at,
          updated_at
        from skill_sync_sources
        where id = $1
        limit 1
      `,
      [id],
    );
    return result.rows[0] ? mapSkillSyncSourceRow(result.rows[0]) : null;
  }

  async upsertSkillSyncSource(input: Required<UpsertSkillSyncSourceInput>): Promise<SkillSyncSourceRecord> {
    const result = await this.pool.query<SkillSyncSourceRow>(
      `
        insert into skill_sync_sources (
          id,
          source_type,
          source_key,
          display_name,
          source_url,
          config_json,
          active,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6::jsonb, $7, now(), now())
        on conflict (id)
        do update set
          source_type = excluded.source_type,
          source_key = excluded.source_key,
          display_name = excluded.display_name,
          source_url = excluded.source_url,
          config_json = excluded.config_json,
          active = excluded.active,
          updated_at = now()
        returning
          id,
          source_type,
          source_key,
          display_name,
          source_url,
          config_json,
          active,
          last_run_at,
          created_at,
          updated_at
      `,
      [input.id, input.source_type, input.source_key, input.display_name, input.source_url, JSON.stringify(input.config), input.active],
    );
    return mapSkillSyncSourceRow(result.rows[0]);
  }

  async deleteSkillSyncSource(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from skill_sync_sources
        where id = $1
      `,
      [id],
    );
    return (result.rowCount || 0) > 0;
  }

  async listSkillSyncRuns(limit = 20): Promise<SkillSyncRunRecord[]> {
    const result = await this.pool.query<SkillSyncRunRow>(
      `
        select
          id,
          source_id,
          source_key,
          source_type,
          display_name,
          status,
          summary_json,
          items_json,
          started_at,
          finished_at
        from skill_sync_runs
        order by started_at desc
        limit $1
      `,
      [limit],
    );
    return result.rows.map(mapSkillSyncRunRow);
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
    const id = randomUUID();
    const result = await this.pool.query<SkillSyncRunRow>(
      `
        insert into skill_sync_runs (
          id,
          source_id,
          source_key,
          source_type,
          display_name,
          status,
          summary_json,
          items_json,
          started_at,
          finished_at
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::timestamptz, $10::timestamptz)
        returning
          id,
          source_id,
          source_key,
          source_type,
          display_name,
          status,
          summary_json,
          items_json,
          started_at,
          finished_at
      `,
      [
        id,
        input.sourceId,
        input.sourceKey,
        input.sourceType,
        input.displayName,
        input.status,
        JSON.stringify(input.summary),
        JSON.stringify(input.items.map((item) => ({...item, source_url: item.sourceUrl}))),
        input.startedAt,
        input.finishedAt || null,
      ],
    );
    await this.pool.query(
      `
        update skill_sync_sources
        set last_run_at = $2::timestamptz,
            updated_at = now()
        where id = $1
      `,
      [input.sourceId, input.finishedAt || input.startedAt],
    );
    return mapSkillSyncRunRow(result.rows[0]);
  }

  async listUserPrivateSkills(userId: string): Promise<UserPrivateSkillRecord[]> {
    const result = await this.pool.query<UserPrivateSkillRow>(
      `
        select
          user_id,
          slug,
          name,
          description,
          market,
          category,
          skill_type,
          publisher,
          tags,
          source_kind,
          source_url,
          version,
          artifact_format,
          artifact_key,
          artifact_sha256,
          created_at,
          updated_at
        from user_private_skills
        where user_id = $1
        order by updated_at desc, created_at desc
      `,
      [userId],
    );
    return result.rows.map(mapUserPrivateSkillRow);
  }

  async getUserPrivateSkill(userId: string, slug: string): Promise<UserPrivateSkillRecord | null> {
    const result = await this.pool.query<UserPrivateSkillRow>(
      `
        select
          user_id,
          slug,
          name,
          description,
          market,
          category,
          skill_type,
          publisher,
          tags,
          source_kind,
          source_url,
          version,
          artifact_format,
          artifact_key,
          artifact_sha256,
          created_at,
          updated_at
        from user_private_skills
        where user_id = $1 and slug = $2
        limit 1
      `,
      [userId, slug],
    );
    return result.rows[0] ? mapUserPrivateSkillRow(result.rows[0]) : null;
  }

  async upsertUserPrivateSkill(
    userId: string,
    input: Omit<Required<ImportUserPrivateSkillInput>, 'artifact_base64'> & {artifactKey: string},
  ): Promise<UserPrivateSkillRecord> {
    const result = await this.pool.query<UserPrivateSkillRow>(
      `
        insert into user_private_skills (
          user_id,
          slug,
          name,
          description,
          market,
          category,
          skill_type,
          publisher,
          tags,
          source_kind,
          source_url,
          version,
          artifact_format,
          artifact_key,
          artifact_sha256,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, now(), now())
        on conflict (user_id, slug)
        do update set
          name = excluded.name,
          description = excluded.description,
          market = excluded.market,
          category = excluded.category,
          skill_type = excluded.skill_type,
          publisher = excluded.publisher,
          tags = excluded.tags,
          source_kind = excluded.source_kind,
          source_url = excluded.source_url,
          version = excluded.version,
          artifact_format = excluded.artifact_format,
          artifact_key = excluded.artifact_key,
          artifact_sha256 = excluded.artifact_sha256,
          updated_at = now()
        returning
          user_id,
          slug,
          name,
          description,
          market,
          category,
          skill_type,
          publisher,
          tags,
          source_kind,
          source_url,
          version,
          artifact_format,
          artifact_key,
          artifact_sha256,
          created_at,
          updated_at
      `,
      [
        userId,
        input.slug,
        input.name,
        input.description,
        input.market,
        input.category,
        input.skill_type,
        input.publisher,
        JSON.stringify(input.tags),
        input.source_kind,
        input.source_url,
        input.version,
        input.artifact_format,
        input.artifactKey,
        input.artifact_sha256,
      ],
    );
    return mapUserPrivateSkillRow(result.rows[0]);
  }

  async deleteUserPrivateSkill(userId: string, slug: string): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from user_private_skills
        where user_id = $1 and slug = $2
      `,
      [userId, slug],
    );
    return (result.rowCount || 0) > 0;
  }

  async listUserAgentLibrary(userId: string): Promise<UserAgentLibraryRecord[]> {
    const result = await this.pool.query<UserAgentLibraryRow>(
      `
        select user_id, agent_slug, installed_at, updated_at
        from user_agent_library
        where user_id = $1
        order by installed_at desc
      `,
      [userId],
    );
    return result.rows.map(mapUserAgentLibraryRow);
  }

  async installUserAgent(userId: string, input: Required<InstallAgentInput>): Promise<UserAgentLibraryRecord> {
    const result = await this.pool.query<UserAgentLibraryRow>(
      `
        insert into user_agent_library (
          user_id,
          agent_slug,
          installed_at,
          updated_at
        )
        values ($1, $2, now(), now())
        on conflict (user_id, agent_slug)
        do update set
          updated_at = now()
        returning user_id, agent_slug, installed_at, updated_at
      `,
      [userId, input.slug],
    );
    return mapUserAgentLibraryRow(result.rows[0]);
  }

  async removeUserAgent(userId: string, slug: string): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from user_agent_library
        where user_id = $1 and agent_slug = $2
      `,
      [userId, slug],
    );
    return (result.rowCount || 0) > 0;
  }

  async listUserSkillLibrary(userId: string): Promise<UserSkillLibraryRecord[]> {
    const result = await this.pool.query<UserSkillLibraryRow>(
      `
        select user_id, skill_slug, source, installed_version, enabled, installed_at, updated_at
        from user_skill_library
        where user_id = $1
        order by installed_at desc
      `,
      [userId],
    );
    return result.rows.map(mapUserSkillLibraryRow);
  }

  async listUserMcpLibrary(userId: string): Promise<UserMcpLibraryRecord[]> {
    const result = await this.pool.query<UserMcpLibraryRow>(
      `
        select user_id, mcp_key, source, enabled, installed_at, updated_at
        from user_mcp_library
        where user_id = $1
        order by installed_at desc
      `,
      [userId],
    );
    return result.rows.map(mapUserMcpLibraryRow);
  }

  async listUserExtensionInstallConfigs(
    userId: string,
    extensionType?: ExtensionInstallTarget,
  ): Promise<UserExtensionInstallConfigRecord[]> {
    const values: unknown[] = [userId];
    let whereSql = 'where user_id = $1';
    if (extensionType) {
      values.push(extensionType);
      whereSql += ` and extension_type = $${values.length}`;
    }
    const result = await this.pool.query<UserExtensionInstallConfigRow>(
      `
        select
          user_id,
          extension_type,
          extension_key,
          schema_version,
          status,
          config_json,
          configured_secret_keys,
          secret_payload_encrypted,
          created_at,
          updated_at
        from user_extension_install_configs
        ${whereSql}
        order by extension_type asc, extension_key asc
      `,
      values,
    );
    return result.rows.map(mapUserExtensionInstallConfigRow);
  }

  async getUserExtensionInstallConfig(
    userId: string,
    extensionType: ExtensionInstallTarget,
    extensionKey: string,
  ): Promise<UserExtensionInstallConfigRecord | null> {
    const result = await this.pool.query<UserExtensionInstallConfigRow>(
      `
        select
          user_id,
          extension_type,
          extension_key,
          schema_version,
          status,
          config_json,
          configured_secret_keys,
          secret_payload_encrypted,
          created_at,
          updated_at
        from user_extension_install_configs
        where user_id = $1 and extension_type = $2 and extension_key = $3
        limit 1
      `,
      [userId, extensionType, extensionKey],
    );
    return result.rows[0] ? mapUserExtensionInstallConfigRow(result.rows[0]) : null;
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
    const result = await this.pool.query<UserExtensionInstallConfigRow>(
      `
        insert into user_extension_install_configs (
          user_id,
          extension_type,
          extension_key,
          schema_version,
          status,
          config_json,
          configured_secret_keys,
          secret_payload_encrypted,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, now(), now())
        on conflict (user_id, extension_type, extension_key)
        do update set
          schema_version = excluded.schema_version,
          status = excluded.status,
          config_json = excluded.config_json,
          configured_secret_keys = excluded.configured_secret_keys,
          secret_payload_encrypted = excluded.secret_payload_encrypted,
          updated_at = now()
        returning
          user_id,
          extension_type,
          extension_key,
          schema_version,
          status,
          config_json,
          configured_secret_keys,
          secret_payload_encrypted,
          created_at,
          updated_at
      `,
      [
        userId,
        input.extension_type,
        input.extension_key,
        input.schema_version,
        input.status,
        JSON.stringify(input.setup_values),
        JSON.stringify(input.configured_secret_keys),
        input.secret_payload_encrypted ?? null,
      ],
    );
    return mapUserExtensionInstallConfigRow(result.rows[0]);
  }

  async removeUserExtensionInstallConfig(
    userId: string,
    extensionType: ExtensionInstallTarget,
    extensionKey: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `
        delete from user_extension_install_configs
        where user_id = $1 and extension_type = $2 and extension_key = $3
      `,
      [userId, extensionType, extensionKey],
    );
    return (result.rowCount || 0) > 0;
  }

  async installUserMcp(
    userId: string,
    input: Required<InstallMcpInput> & {source?: 'cloud'},
  ): Promise<UserMcpLibraryRecord> {
    const result = await this.pool.query<UserMcpLibraryRow>(
      `
        insert into user_mcp_library (
          user_id,
          mcp_key,
          source,
          enabled,
          installed_at,
          updated_at
        )
        values ($1, $2, $3, true, now(), now())
        on conflict (user_id, mcp_key)
        do update set
          source = excluded.source,
          enabled = true,
          updated_at = now()
        returning user_id, mcp_key, source, enabled, installed_at, updated_at
      `,
      [userId, input.mcp_key, input.source || 'cloud'],
    );
    return mapUserMcpLibraryRow(result.rows[0]);
  }

  async updateUserMcp(
    userId: string,
    input: Required<UpdateMcpLibraryItemInput>,
  ): Promise<UserMcpLibraryRecord | null> {
    const result = await this.pool.query<UserMcpLibraryRow>(
      `
        update user_mcp_library
        set enabled = $3, updated_at = now()
        where user_id = $1 and mcp_key = $2
        returning user_id, mcp_key, source, enabled, installed_at, updated_at
      `,
      [userId, input.mcp_key, input.enabled],
    );
    return result.rows[0] ? mapUserMcpLibraryRow(result.rows[0]) : null;
  }

  async removeUserMcp(userId: string, mcpKey: string): Promise<boolean> {
    const libraryResult = await this.pool.query(
      `
        delete from user_mcp_library
        where user_id = $1 and mcp_key = $2
      `,
      [userId, mcpKey],
    );
    await this.pool.query(
      `
        delete from user_extension_install_configs
        where user_id = $1 and extension_type = 'mcp' and extension_key = $2
      `,
      [userId, mcpKey],
    );
    return (libraryResult.rowCount || 0) > 0;
  }

  async installUserSkill(
    userId: string,
    input: Required<InstallSkillInput> & {source?: 'cloud' | 'private'},
  ): Promise<UserSkillLibraryRecord> {
    const result = await this.pool.query<UserSkillLibraryRow>(
      `
        insert into user_skill_library (
          user_id,
          skill_slug,
          source,
          installed_version,
          enabled,
          installed_at,
          updated_at
        )
        values ($1, $2, $3, $4, true, now(), now())
        on conflict (user_id, skill_slug)
        do update set
          source = excluded.source,
          installed_version = excluded.installed_version,
          enabled = true,
          updated_at = now()
        returning user_id, skill_slug, source, installed_version, enabled, installed_at, updated_at
      `,
      [userId, input.slug, input.source || 'cloud', input.version],
    );
    return mapUserSkillLibraryRow(result.rows[0]);
  }

  async updateUserSkill(
    userId: string,
    input: Required<UpdateSkillLibraryItemInput>,
  ): Promise<UserSkillLibraryRecord | null> {
    const result = await this.pool.query<UserSkillLibraryRow>(
      `
        update user_skill_library
        set enabled = $3, updated_at = now()
        where user_id = $1 and skill_slug = $2
        returning user_id, skill_slug, source, installed_version, enabled, installed_at, updated_at
      `,
      [userId, input.slug, input.enabled],
    );
    return result.rows[0] ? mapUserSkillLibraryRow(result.rows[0]) : null;
  }

  async removeUserSkill(userId: string, slug: string): Promise<boolean> {
    const libraryResult = await this.pool.query(
      `
        delete from user_skill_library
        where user_id = $1 and skill_slug = $2
      `,
      [userId, slug],
    );
    await this.pool.query(
      `
        delete from user_extension_install_configs
        where user_id = $1 and extension_type = 'skill' and extension_key = $2
      `,
      [userId, slug],
    );
    return (libraryResult.rowCount || 0) > 0;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async listSkillCatalogEntries(query: string, values: unknown[] = []): Promise<SkillCatalogEntryRecord[]> {
    const catalogResult = await this.pool.query<SkillCatalogRow>(query, values);
    return catalogResult.rows.map(mapSkillCatalogRow);
  }

  private normalizeSkillCatalogTagKeywords(tagKeywords: string[] | null | undefined): string[] {
    return Array.from(new Set((tagKeywords || []).map((keyword) => keyword.trim().toLowerCase()).filter(Boolean)));
  }

  private buildSkillCatalogWhereClause(
    values: unknown[],
    input: {
      cloudOnly?: boolean;
      slugPlaceholder?: string | null;
      tagKeywords?: string[] | null;
      extraSkillSlugs?: string[] | null;
    } = {},
  ): string {
    const whereClauses: string[] = ['active = true'];
    if (input.cloudOnly) {
      const normalizedExtraSkillSlugs = Array.from(new Set((input.extraSkillSlugs || []).map((slug) => slug.trim()).filter(Boolean)));
      if (normalizedExtraSkillSlugs.length > 0) {
        values.push(normalizedExtraSkillSlugs);
        const placeholder = `$${values.length}::text[]`;
        whereClauses.push(`(distribution = 'cloud' or slug = any(${placeholder}))`);
      } else {
        whereClauses.push(`distribution = 'cloud'`);
      }
    }
    if (input.slugPlaceholder) {
      whereClauses.push(`slug = any(${input.slugPlaceholder})`);
    }
    const normalizedKeywords = this.normalizeSkillCatalogTagKeywords(input.tagKeywords);
    if (normalizedKeywords.length > 0) {
      values.push(normalizedKeywords);
      const placeholder = `$${values.length}::text[]`;
      whereClauses.push(`
        exists (
          select 1
          from jsonb_array_elements_text(coalesce(tags, '[]'::jsonb)) as tag
          where exists (
            select 1
            from unnest(${placeholder}) as keyword
            where lower(tag) like '%' || keyword || '%'
          )
        )
      `);
    }
    return `where ${whereClauses.join('\n  and ')}`;
  }

  private buildSkillCatalogOrderClause(): string {
    return `
      order by
        greatest(
          coalesce(case when metadata_json ->> 'downloads' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json ->> 'downloads')::numeric)::bigint end, 0),
          coalesce(case when metadata_json ->> 'download_count' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json ->> 'download_count')::numeric)::bigint end, 0),
          coalesce(case when metadata_json ->> 'downloadCount' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json ->> 'downloadCount')::numeric)::bigint end, 0),
          coalesce(case when metadata_json ->> 'install_count' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json ->> 'install_count')::numeric)::bigint end, 0),
          coalesce(case when metadata_json ->> 'installCount' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json ->> 'installCount')::numeric)::bigint end, 0),
          coalesce(case when metadata_json ->> 'installs' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json ->> 'installs')::numeric)::bigint end, 0),
          coalesce(case when metadata_json #>> '{stats,downloads}' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json #>> '{stats,downloads}')::numeric)::bigint end, 0),
          coalesce(case when metadata_json #>> '{stats,download_count}' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json #>> '{stats,download_count}')::numeric)::bigint end, 0),
          coalesce(case when metadata_json #>> '{stats,downloadCount}' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json #>> '{stats,downloadCount}')::numeric)::bigint end, 0),
          coalesce(case when metadata_json #>> '{clawhub,listing,skill,stats,downloads}' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json #>> '{clawhub,listing,skill,stats,downloads}')::numeric)::bigint end, 0),
          coalesce(case when metadata_json #>> '{clawhub,listing,skill,stats,download_count}' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json #>> '{clawhub,listing,skill,stats,download_count}')::numeric)::bigint end, 0),
          coalesce(case when metadata_json #>> '{clawhub,listing,skill,stats,downloadCount}' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json #>> '{clawhub,listing,skill,stats,downloadCount}')::numeric)::bigint end, 0),
          coalesce(case when metadata_json #>> '{clawhub,detail,skill,stats,downloads}' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json #>> '{clawhub,detail,skill,stats,downloads}')::numeric)::bigint end, 0),
          coalesce(case when metadata_json #>> '{clawhub,detail,skill,stats,download_count}' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json #>> '{clawhub,detail,skill,stats,download_count}')::numeric)::bigint end, 0),
          coalesce(case when metadata_json #>> '{clawhub,detail,skill,stats,downloadCount}' ~ '^[0-9]+(\\.[0-9]+)?$' then round((metadata_json #>> '{clawhub,detail,skill,stats,downloadCount}')::numeric)::bigint end, 0)
        ) desc,
        name asc
    `;
  }

  private async listMcpCatalogEntries(query: string, values: unknown[] = []): Promise<McpCatalogEntryRecord[]> {
    const catalogResult = await this.pool.query<McpCatalogRow>(query, values);
    return catalogResult.rows.map(mapMcpCatalogRow);
  }

  private buildSkillCatalogPaginationClause(values: unknown[], limit?: number, offset?: number): string {
    const clauses: string[] = [];
    if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
      values.push(Math.floor(limit));
      clauses.push(`limit $${values.length}`);
    }
    if (typeof offset === 'number' && Number.isFinite(offset) && offset > 0) {
      values.push(Math.floor(offset));
      clauses.push(`offset $${values.length}`);
    }
    return clauses.length ? `\n${clauses.join('\n')}` : '';
  }

  private async insertSession(
    db: Pool | PoolClient,
    userId: string,
    tokens: SessionTokenPair,
  ): Promise<SessionRecord> {
    const sessionId = randomUUID();
    const now = new Date();

    await db.query(
      `
        insert into device_sessions (id, user_id, device_id, client_type, status, created_at)
        values ($1, $2, $3, $4, 'active', $5)
      `,
      [sessionId, userId, tokens.deviceId, tokens.clientType, now],
    );
    return this.insertSessionTokens(db, userId, sessionId, tokens, now);
  }

  private async insertSessionTokens(
    db: Pool | PoolClient,
    userId: string,
    sessionId: string,
    tokens: SessionTokenPair,
    createdAt: Date,
  ): Promise<SessionRecord> {
    const now = new Date();
    const accessTokenExpiresAt = new Date(tokens.accessTokenExpiresAt);
    const refreshTokenExpiresAt = new Date(tokens.refreshTokenExpiresAt);

    await db.query(
      `
        insert into access_tokens (id, user_id, device_session_id, token_hash, expires_at, created_at)
        values ($1, $2, $3, $4, $5, $6)
      `,
      [randomUUID(), userId, sessionId, tokens.accessTokenHash, accessTokenExpiresAt, now],
    );
    await db.query(
      `
        insert into refresh_tokens (id, user_id, device_session_id, token_hash, expires_at, created_at)
        values ($1, $2, $3, $4, $5, $6)
      `,
      [randomUUID(), userId, sessionId, tokens.refreshTokenHash, refreshTokenExpiresAt, now],
    );

    return {
      id: sessionId,
      userId,
      accessTokenHash: tokens.accessTokenHash,
      refreshTokenHash: tokens.refreshTokenHash,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      createdAt: createdAt.toISOString(),
    };
  }

  private async getSessionById(dbSessionId: string, db: Pool | PoolClient): Promise<SessionRecord | null> {
    const result = await db.query<SessionRow>(
      `
        select
          ds.id as session_id,
          ds.user_id,
          at.token_hash as access_token_hash,
          at.expires_at as access_token_expires_at,
          rt.token_hash as refresh_token_hash,
          rt.expires_at as refresh_token_expires_at,
          ds.created_at
        from device_sessions ds
        join access_tokens at on at.device_session_id = ds.id and at.revoked_at is null
        join refresh_tokens rt on rt.device_session_id = ds.id and rt.revoked_at is null
        where ds.id = $1
        order by at.created_at desc, rt.created_at desc
        limit 1
      `,
      [dbSessionId],
    );
    return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
  }

  private async lockAndReadAccount(client: PoolClient, userId: string): Promise<CreditAccountRecord> {
    const result = await client.query<CreditAccountRow>(
      `
        select
          user_id,
          daily_free_balance,
          topup_balance,
          daily_free_granted_at,
          daily_free_expires_at,
          updated_at
        from credit_accounts
        where user_id = $1
        for update
      `,
      [userId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('CREDIT_ACCOUNT_NOT_FOUND');
    }
    if (new Date(row.daily_free_expires_at).getTime() > Date.now()) {
      return mapCreditAccountRow(row);
    }
    const now = new Date();
    const refreshed = await client.query<CreditAccountRow>(
      `
        update credit_accounts
        set
          daily_free_balance = $2,
          daily_free_granted_at = $3,
          daily_free_expires_at = $4,
          updated_at = $3
        where user_id = $1
        returning user_id, daily_free_balance, topup_balance, daily_free_granted_at, daily_free_expires_at, updated_at
      `,
      [userId, config.dailyFreeCredits, now, startOfNextShanghaiDayIso(now)],
    );
    await client.query(
      `
        insert into credit_ledger (
          id,
          user_id,
          bucket,
          direction,
          amount,
          balance_after,
          reference_type,
          reference_id,
          event_type,
          delta,
          created_at
        )
        values ($1, $2, 'daily_free', 'grant', $3, $3, 'daily_reset', $4, 'daily_reset', $3, $5)
      `,
      [randomUUID(), userId, config.dailyFreeCredits, now.toISOString(), now],
    );
    return mapCreditAccountRow(refreshed.rows[0] || row);
  }
}
