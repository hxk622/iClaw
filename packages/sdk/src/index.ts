import { ApiError, toCanonicalSessionKey, type AuthTokens } from '@iclaw/shared';

export interface ClientOptions {
  apiBaseUrl: string;
  authBaseUrl?: string;
  gatewayWsUrl?: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  gatewaySessionKey?: string;
  preferGatewayWs?: boolean;
  disableGatewayDeviceIdentity?: boolean;
  desktopAppVersion?: string;
  desktopAppName?: string;
  desktopReleaseChannel?: 'dev' | 'prod';
  desktopPlatform?: string;
  desktopArch?: string;
  onDesktopUpdateHint?: (hint: DesktopUpdateHint) => void;
}

export interface DesktopUpdateHint {
  appName?: string | null;
  latestVersion: string;
  updateAvailable: boolean;
  mandatory: boolean;
  enforcementState?: 'recommended' | 'required_after_run' | 'required_now';
  blockNewRuns?: boolean;
  reasonCode?: string | null;
  reasonMessage?: string | null;
  manifestUrl?: string | null;
  artifactUrl?: string | null;
}

export interface DesktopUpdateHintInput {
  appName?: string;
  appVersion?: string;
  channel?: 'dev' | 'prod';
  platform?: string;
  arch?: string;
}

export interface StreamCallbacks {
  onStart?: (payload: unknown) => void;
  onDelta?: (text: string, payload: unknown) => void;
  onEnd?: (payload: unknown) => void;
  onError?: (error: ApiError) => void;
}

interface LoginInput {
  identifier: string;
  password: string;
}

interface RegisterInput {
  username: string;
  email: string;
  password: string;
  name: string;
}

interface OAuthLoginInput {
  code: string;
}

interface MeResponse {
  data: unknown;
}

interface UpdateProfileInput {
  token: string;
  name?: string;
  avatarDataBase64?: string;
  avatarContentType?: string;
  avatarFilename?: string;
  removeAvatar?: boolean;
}

interface ChangePasswordInput {
  token: string;
  currentPassword?: string;
  newPassword: string;
}

interface StreamChatInput {
  message: string;
  runId?: string;
  taskId?: string;
  attachments?: unknown[];
  token?: string;
  signal?: AbortSignal;
}

interface ChatHistoryInput {
  sessionKey?: string;
  limit?: number;
}

interface AuthorizeRunInput {
  token: string;
  eventId?: string;
  sessionKey?: string;
  client?: string;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  message?: string;
  historyMessages?: number;
  hasSearch?: boolean;
  hasTools?: boolean;
  attachments?: CreditQuoteAttachmentInput[];
  model?: string;
  appName?: string;
}

interface UsageEventInput {
  token: string;
  eventId: string;
  grantId?: string;
  inputTokens?: number;
  outputTokens?: number;
  creditCost?: number;
  provider?: string;
  model?: string;
  appName?: string;
  assistantTimestamp?: number;
}

interface WorkspaceBackupInput {
  token: string;
  identityMd: string;
  userMd: string;
  soulMd: string;
  agentsMd: string;
}

interface InstallSkillLibraryInput {
  token: string;
  slug: string;
  version?: string;
  setupValues?: Record<string, unknown>;
  secretValues?: Record<string, string>;
}

interface InstallMcpLibraryInput {
  token: string;
  mcpKey: string;
  setupValues?: Record<string, unknown>;
  secretValues?: Record<string, string>;
}

interface UpdateSkillLibraryInput {
  token: string;
  slug: string;
  enabled: boolean;
}

interface UpdateMcpLibraryInput {
  token: string;
  mcpKey: string;
  enabled: boolean;
}

interface UpsertExtensionInstallConfigInput {
  token: string;
  extensionType: 'skill' | 'mcp';
  extensionKey: string;
  setupValues?: Record<string, unknown>;
  secretValues?: Record<string, string>;
}

export interface WorkspaceBackupData {
  identity_md: string;
  user_md: string;
  soul_md: string;
  agents_md: string;
  created_at: string;
  updated_at: string;
}

export interface RunGrantData {
  grant_id: string;
  nonce: string;
  expires_at: string;
  max_input_tokens: number;
  max_output_tokens: number;
  credit_limit: number;
  signature: string;
}

export interface RunBillingSummaryData {
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
}

export interface UsageEventData {
  accepted: boolean;
  balance_after: number;
  debits?: Array<{bucket: 'daily_free' | 'topup'; amount: number}>;
  balance_after_detail?: CreditBalanceData;
  billing_summary: RunBillingSummaryData;
}

export interface CreditBalanceData {
  daily_free_balance: number;
  topup_balance: number;
  total_available_balance: number;
  daily_free_quota: number;
  daily_free_expires_at: string;
  balance: number;
  currency: 'lobster_credit';
  currency_display: string;
  available_balance: number;
  status: 'active';
}

export interface CreditLedgerItemData {
  id: string;
  bucket: 'daily_free' | 'topup';
  direction: 'grant' | 'consume' | 'topup' | 'refund' | 'expire';
  amount: number;
  reference_type: string;
  reference_id: string | null;
  event_type: string;
  delta: number;
  balance_after: number;
  created_at: string;
}

export interface CreditQuoteAttachmentInput {
  type?: string;
  chars?: number;
}

export interface CreditQuoteInput {
  message?: string;
  model?: string;
  appName?: string;
  historyMessages?: number;
  hasSearch?: boolean;
  hasTools?: boolean;
  attachments?: CreditQuoteAttachmentInput[];
}

export interface CreditQuoteData {
  currency: 'lobster_credit';
  currency_display: string;
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
}

export interface CreatePaymentOrderInput {
  token: string;
  provider?: 'mock' | 'wechat_qr' | 'alipay_qr';
  packageId: string;
  returnUrl?: string;
  appName?: string;
  appVersion?: string;
  releaseChannel?: string;
  platform?: string;
  arch?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface PaymentOrderData {
  order_id: string;
  status: 'created' | 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
  provider: 'mock' | 'wechat_qr' | 'alipay_qr';
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
}

export interface PaymentWebhookInput {
  provider: 'mock' | 'wechat_qr' | 'alipay_qr';
  eventId: string;
  orderId: string;
  status: string;
  providerOrderId?: string;
  paidAt?: string;
}

export interface SkillCatalogEntryData {
  slug: string;
  name: string;
  description: string;
  featured?: boolean;
  market: string | null;
  category: string | null;
  skill_type: string | null;
  publisher: string;
  distribution: 'cloud';
  source: 'cloud' | 'private';
  tags: string[];
  version: string;
  artifact_url: string | null;
  artifact_path: string | null;
  artifact_format: 'tar.gz' | 'zip';
  artifact_sha256: string | null;
  origin_type: 'clawhub' | 'github_repo' | 'manual' | 'private';
  source_url: string | null;
  metadata: Record<string, unknown>;
}

export interface SkillCatalogPageData<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  next_offset: number | null;
}

export interface MarketStockData {
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
}

export interface MarketFundData {
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
}

export interface McpCatalogEntryData {
  mcp_key: string;
  name: string;
  description: string;
  transport: string;
  source: 'cloud';
  default_installed: boolean;
  object_key: string | null;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserMcpLibraryItemData {
  mcp_key: string;
  source: 'cloud';
  enabled: boolean;
  setup_status: 'not_required' | 'configured' | 'missing';
  setup_schema_version: number | null;
  setup_updated_at: string | null;
  installed_at: string;
  updated_at: string;
}

export interface UserExtensionInstallConfigData {
  extension_type: 'skill' | 'mcp';
  extension_key: string;
  schema_version: number | null;
  status: 'not_required' | 'configured' | 'missing';
  config_values: Record<string, unknown>;
  configured_secret_keys: string[];
  created_at: string;
  updated_at: string;
}

export interface AdminSkillCatalogEntryData extends SkillCatalogEntryData {
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface UpsertAdminSkillCatalogInput {
  token: string;
  slug: string;
  name?: string;
  description?: string;
  featured?: boolean;
  market?: string | null;
  category?: string | null;
  skillType?: string | null;
  publisher?: string;
  distribution?: 'cloud';
  tags?: string[];
  version?: string;
  artifactUrl?: string | null;
  artifactFormat?: 'tar.gz' | 'zip';
  artifactSha256?: string | null;
  artifactSourcePath?: string | null;
  originType?: 'clawhub' | 'github_repo' | 'manual' | 'private';
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
  active?: boolean;
}

export interface SkillSyncSourceData {
  id: string;
  source_type: 'clawhub' | 'github_repo';
  source_key: string;
  display_name: string;
  source_url: string;
  config: Record<string, unknown>;
  active: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillSyncRunItemData {
  slug: string;
  name: string;
  version: string | null;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  reason: string | null;
  source_url: string | null;
}

export interface SkillSyncRunData {
  id: string;
  source_id: string;
  source_key: string;
  source_type: 'clawhub' | 'github_repo';
  display_name: string;
  status: 'running' | 'succeeded' | 'partial_failed' | 'failed';
  summary: Record<string, unknown>;
  items: SkillSyncRunItemData[];
  started_at: string;
  finished_at: string | null;
}

interface UpsertSkillSyncSourceInput {
  token: string;
  id?: string;
  sourceType: 'clawhub' | 'github_repo';
  sourceKey: string;
  displayName: string;
  sourceUrl: string;
  config?: Record<string, unknown>;
  active?: boolean;
}

export interface UserSkillLibraryItemData {
  slug: string;
  version: string;
  source: 'cloud' | 'private';
  enabled: boolean;
  setup_status: 'not_required' | 'configured' | 'missing';
  setup_schema_version: number | null;
  setup_updated_at: string | null;
  installed_at: string;
  updated_at: string;
}

export interface AgentCatalogEntryData {
  slug: string;
  name: string;
  description: string;
  category: 'finance' | 'content' | 'productivity' | 'commerce' | 'general';
  publisher: string;
  featured: boolean;
  official: boolean;
  tags: string[];
  capabilities: string[];
  use_cases: string[];
  metadata: Record<string, unknown>;
}

export interface UserAgentLibraryItemData {
  slug: string;
  installed_at: string;
  updated_at: string;
}

interface ImportPrivateSkillInput {
  token: string;
  slug: string;
  name: string;
  description: string;
  market?: string | null;
  category?: string | null;
  skillType?: string | null;
  publisher?: string;
  tags?: string[];
  sourceKind: 'github' | 'local';
  sourceUrl?: string | null;
  version: string;
  artifactFormat: 'tar.gz' | 'zip';
  artifactSha256?: string | null;
  artifactBase64: string;
}

type BrowserDeviceIdentity = {
  deviceId: string;
  publicKey: string;
  privateKey: string;
};

type StoredDeviceAuthTokens = {
  version: 1;
  deviceId: string;
  tokens: Record<string, { token: string; scopes: string[] }>;
};

type GatewayEventFrame = {
  type: 'event';
  event: string;
  payload?: unknown;
};

type GatewayResponseFrame = {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { message?: string };
};

type GatewayFrame = GatewayEventFrame | GatewayResponseFrame | Record<string, unknown>;

const DEVICE_IDENTITY_STORAGE_KEY = 'iclaw.gateway.device.identity.v1';
const DEVICE_TOKEN_STORAGE_KEY = 'iclaw.gateway.device.tokens.v1';
const GATEWAY_CLIENT_ID = 'gateway-client';

function normalizeDesktopPlatform(value: string | null | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.startsWith('mac') || normalized.startsWith('darwin')) return 'darwin';
  if (normalized.startsWith('win')) return 'windows';
  if (normalized.startsWith('linux')) return 'linux';
  return normalized;
}

function normalizeDesktopArch(value: string | null | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes('aarch64') || normalized.includes('arm64')) return 'aarch64';
  if (normalized.includes('x86_64') || normalized.includes('amd64') || normalized.includes('x64')) return 'x64';
  return normalized;
}

function detectDesktopPlatform(): string | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const nav = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
    };
  };
  return (
    normalizeDesktopPlatform(nav.userAgentData?.platform) ||
    normalizeDesktopPlatform(navigator.platform) ||
    normalizeDesktopPlatform(navigator.userAgent)
  );
}

function detectDesktopArch(): string | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const nav = navigator as Navigator & {
    userAgentData?: {
      architecture?: string;
      bitness?: string;
    };
  };
  const ua = navigator.userAgent.toLowerCase();
  return (
    normalizeDesktopArch(nav.userAgentData?.architecture) ||
    (nav.userAgentData?.bitness === '64' && ua.includes('arm') ? 'aarch64' : undefined) ||
    (ua.includes('arm64') || ua.includes('aarch64') ? 'aarch64' : undefined) ||
    (ua.includes('x86_64') || ua.includes('win64') || ua.includes('wow64') || ua.includes('amd64') || ua.includes('x64')
      ? 'x64'
      : undefined)
  );
}
const GATEWAY_CLIENT_MODE = 'backend';
const GATEWAY_ROLE = 'operator';
const GATEWAY_SCOPES = ['operator.read', 'operator.write', 'operator.admin'];

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4 || 4)) % 4;
  const binary = atob(normalized + '='.repeat(padding));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeDeviceMetadataForAuth(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function buildDeviceAuthPayloadV3(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
  platform?: string | null;
  deviceFamily?: string | null;
}): string {
  return [
    'v3',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(','),
    String(params.signedAtMs),
    params.token ?? '',
    params.nonce,
    normalizeDeviceMetadataForAuth(params.platform),
    normalizeDeviceMetadataForAuth(params.deviceFamily),
  ].join('|');
}

async function createBrowserDeviceIdentity(): Promise<BrowserDeviceIdentity> {
  const keyPair = (await crypto.subtle.generateKey(
    { name: 'Ed25519' } as AlgorithmIdentifier,
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
  const privateKeyBytes = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));
  return {
    deviceId: await sha256Hex(publicKeyBytes),
    publicKey: toBase64Url(publicKeyBytes),
    privateKey: toBase64Url(privateKeyBytes),
  };
}

async function loadOrCreateBrowserDeviceIdentity(): Promise<BrowserDeviceIdentity | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const storage = getBrowserStorage();
  if (storage) {
    try {
      const raw = storage.getItem(DEVICE_IDENTITY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as
          | {
              version?: number;
              deviceId?: string;
              publicKey?: string;
              privateKey?: string;
            }
          | null;
        if (
          parsed?.version === 1 &&
          typeof parsed.deviceId === 'string' &&
          typeof parsed.publicKey === 'string' &&
          typeof parsed.privateKey === 'string'
        ) {
          const derivedDeviceId = await sha256Hex(fromBase64Url(parsed.publicKey));
          const identity = {
            deviceId: derivedDeviceId,
            publicKey: parsed.publicKey,
            privateKey: parsed.privateKey,
          };
          if (derivedDeviceId !== parsed.deviceId) {
            storage.setItem(DEVICE_IDENTITY_STORAGE_KEY, JSON.stringify({ version: 1, ...identity }));
          }
          return identity;
        }
      }
    } catch {}
  }

  const identity = await createBrowserDeviceIdentity();
  storage?.setItem(DEVICE_IDENTITY_STORAGE_KEY, JSON.stringify({ version: 1, ...identity }));
  return identity;
}

async function signBrowserDevicePayload(privateKeyBase64Url: string, payload: string): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    toArrayBuffer(fromBase64Url(privateKeyBase64Url)),
    { name: 'Ed25519' } as AlgorithmIdentifier,
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' } as AlgorithmIdentifier,
    privateKey,
    new TextEncoder().encode(payload),
  );
  return toBase64Url(new Uint8Array(signature));
}

function loadStoredDeviceToken(deviceId: string, role: string): string | undefined {
  const storage = getBrowserStorage();
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(DEVICE_TOKEN_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as StoredDeviceAuthTokens | null;
    if (parsed?.version !== 1 || parsed.deviceId !== deviceId || !parsed.tokens) return undefined;
    const token = parsed.tokens[role]?.token;
    return typeof token === 'string' && token.trim() ? token.trim() : undefined;
  } catch {
    return undefined;
  }
}

function storeDeviceToken(deviceId: string, role: string, token: string, scopes: string[]): void {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(DEVICE_TOKEN_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredDeviceAuthTokens | null) : null;
    const next: StoredDeviceAuthTokens = {
      version: 1,
      deviceId,
      tokens: parsed?.version === 1 && parsed.deviceId === deviceId ? { ...parsed.tokens } : {},
    };
    next.tokens[role] = { token, scopes };
    storage.setItem(DEVICE_TOKEN_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

function parseJsonSafe<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function parseError(response: Response): Promise<ApiError> {
  const text = await response.text();
  const body = parseJsonSafe<{ error?: { code?: string; message?: string; requestId?: string } }>(text);
  const payload = body?.error;
  return new ApiError({
    code: payload?.code || 'HTTP_ERROR',
    message: payload?.message || `Request failed: ${response.status}`,
    requestId: payload?.requestId,
  });
}

const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;
const AUTH_REQUEST_TIMEOUT_MS = 20_000;
const HEALTH_REQUEST_TIMEOUT_MS = 5_000;
const STREAM_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_MAX_ATTEMPTS = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

type TimedFetchOptions = {
  timeoutMs?: number;
  serviceName: string;
  serviceBaseUrl: string;
  retry?: RequestRetryOptions;
};

type RequestRetryOptions = {
  enabled?: boolean;
  maxAttempts?: number;
  retryUnsafeMethods?: boolean;
};

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

function isLoopbackServiceUrl(url: string): boolean {
  try {
    return isLoopbackHostname(new URL(url).hostname);
  } catch {
    return false;
  }
}

function resolveTimeoutMessage(options: TimedFetchOptions): string {
  if (isLoopbackServiceUrl(options.serviceBaseUrl)) {
    return `请求超时，请确认${options.serviceName}已启动并监听 ${options.serviceBaseUrl}`;
  }
  return `连接${options.serviceName}超时，请检查网络连接或稍后重试 (${options.serviceBaseUrl})`;
}

function resolveNetworkErrorMessage(options: TimedFetchOptions): string {
  if (isLoopbackServiceUrl(options.serviceBaseUrl)) {
    return `无法连接${options.serviceName}，请确认已启动并监听 ${options.serviceBaseUrl}`;
  }
  return `无法连接${options.serviceName}，请检查网络连接或稍后重试 (${options.serviceBaseUrl})`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveRequestMethod(init: RequestInit): string {
  return (init.method || 'GET').trim().toUpperCase();
}

function canRetryRequest(method: string, retry: RequestRetryOptions | undefined): boolean {
  if (retry?.enabled === false) return false;
  if (retry?.retryUnsafeMethods) return true;
  return IDEMPOTENT_METHODS.has(method);
}

function resolveRetryAttempts(retry: RequestRetryOptions | undefined): number {
  const maxAttempts = retry?.maxAttempts ?? DEFAULT_RETRY_MAX_ATTEMPTS;
  return Number.isFinite(maxAttempts) ? Math.max(1, Math.floor(maxAttempts)) : DEFAULT_RETRY_MAX_ATTEMPTS;
}

function resolveRetryDelayMs(attemptIndex: number): number {
  const baseDelayMs = 250;
  const jitterMs = Math.floor(Math.random() * 120);
  return Math.min(1000, baseDelayMs * 2 ** attemptIndex) + jitterMs;
}

function shouldRetryResponse(response: Response): boolean {
  return RETRYABLE_STATUS_CODES.has(response.status);
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  options: TimedFetchOptions,
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const upstreamSignal = init.signal;
  const method = resolveRequestMethod(init);
  const retryEnabled = canRetryRequest(method, options.retry);
  const maxAttempts = retryEnabled ? resolveRetryAttempts(options.retry) : 1;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromUpstream = () => controller.abort();

    if (upstreamSignal?.aborted) {
      controller.abort();
    } else {
      upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
    }

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      if (attempt + 1 < maxAttempts && shouldRetryResponse(response)) {
        await sleep(resolveRetryDelayMs(attempt));
        continue;
      }
      return response;
    } catch (error) {
      if (upstreamSignal?.aborted) {
        throw new ApiError({
          code: 'ABORTED',
          message: '请求已取消',
        });
      }
      lastError = error;
      const isRetryableError = timedOut || error instanceof Error;
      if (attempt + 1 < maxAttempts && isRetryableError) {
        await sleep(resolveRetryDelayMs(attempt));
        continue;
      }
      if (timedOut) {
        throw new ApiError({
          code: 'TIMEOUT',
          message: resolveTimeoutMessage(options),
        });
      }
      if (error instanceof Error) {
        throw new ApiError({
          code: 'NETWORK_ERROR',
          message: resolveNetworkErrorMessage(options),
        });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }
  }

  throw lastError instanceof Error
    ? new ApiError({
        code: 'NETWORK_ERROR',
        message: resolveNetworkErrorMessage(options),
      })
    : new ApiError({
        code: 'HTTP_ERROR',
        message: `请求${options.serviceName}失败`,
      });
}

export class IClawClient {
  private readonly apiBaseUrl: string;
  private readonly authBaseUrl: string;
  private readonly gatewayWsUrl: string;
  private readonly gatewayToken?: string;
  private readonly gatewayPassword?: string;
  private readonly gatewaySessionKey: string;
  private readonly preferGatewayWs: boolean;
  private readonly disableGatewayDeviceIdentity: boolean;
  private readonly desktopAppVersion?: string;
  private readonly desktopAppName?: string;
  private readonly desktopReleaseChannel?: 'dev' | 'prod';
  private readonly desktopPlatform?: string;
  private readonly desktopArch?: string;
  private readonly onDesktopUpdateHint?: (hint: DesktopUpdateHint) => void;

  constructor(options: ClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, '');
    this.authBaseUrl = (options.authBaseUrl || options.apiBaseUrl).replace(/\/$/, '');
    this.gatewayWsUrl =
      options.gatewayWsUrl ||
      this.apiBaseUrl.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
    this.gatewayToken = options.gatewayToken;
    this.gatewayPassword = options.gatewayPassword;
    this.gatewaySessionKey = toCanonicalSessionKey(options.gatewaySessionKey);
    this.preferGatewayWs = Boolean(options.preferGatewayWs);
    this.disableGatewayDeviceIdentity = Boolean(options.disableGatewayDeviceIdentity);
    this.desktopAppVersion = options.desktopAppVersion?.trim() || undefined;
    this.desktopAppName = options.desktopAppName?.trim() || undefined;
    this.desktopReleaseChannel = options.desktopReleaseChannel;
    this.desktopPlatform = normalizeDesktopPlatform(options.desktopPlatform) || detectDesktopPlatform();
    this.desktopArch = normalizeDesktopArch(options.desktopArch) || detectDesktopArch();
    this.onDesktopUpdateHint = options.onDesktopUpdateHint;
  }

  private fetchAuth(
    path: string,
    init: RequestInit = {},
    timeoutMs = AUTH_REQUEST_TIMEOUT_MS,
    retry?: RequestRetryOptions,
  ): Promise<Response> {
    const headers = new Headers(init.headers || {});
    if (this.desktopAppVersion) headers.set('x-iclaw-app-version', this.desktopAppVersion);
    if (this.desktopAppName) headers.set('x-iclaw-app-name', this.desktopAppName);
    if (this.desktopReleaseChannel) headers.set('x-iclaw-channel', this.desktopReleaseChannel);
    if (this.desktopPlatform) headers.set('x-iclaw-platform', this.desktopPlatform);
    if (this.desktopArch) headers.set('x-iclaw-arch', this.desktopArch);
    return fetchWithTimeout(`${this.authBaseUrl}${path}`, {
      ...init,
      headers,
    }, {
      timeoutMs,
      serviceName: 'control-plane',
      serviceBaseUrl: this.authBaseUrl,
      retry: retry || {
        enabled: true,
      },
    }).then((response) => {
      this.captureDesktopUpdateHint(response);
      return response;
    });
  }

  private fetchApi(
    path: string,
    init: RequestInit = {},
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    retry?: RequestRetryOptions,
  ): Promise<Response> {
    return fetchWithTimeout(`${this.apiBaseUrl}${path}`, init, {
      timeoutMs,
      serviceName: '本地 API',
      serviceBaseUrl: this.apiBaseUrl,
      retry: retry || {
        enabled: true,
      },
    });
  }

  private captureDesktopUpdateHint(response: Response): void {
    if (!this.onDesktopUpdateHint) return;
    const latestVersion = response.headers.get('x-iclaw-latest-version')?.trim() || '';
    if (!latestVersion) return;
    const appName = response.headers.get('x-iclaw-app-name')?.trim() || this.desktopAppName || null;
    const updateAvailable = response.headers.get('x-iclaw-update-available') === 'true';
    const mandatory = response.headers.get('x-iclaw-update-mandatory') === 'true';
    const enforcementState = response.headers.get('x-iclaw-update-enforcement-state')?.trim() || 'recommended';
    const blockNewRuns = response.headers.get('x-iclaw-update-block-new-runs') === 'true';
    const reasonCode = response.headers.get('x-iclaw-update-reason-code')?.trim() || null;
    const reasonMessage = response.headers.get('x-iclaw-update-reason-message')?.trim() || null;
    const manifestUrl = response.headers.get('x-iclaw-update-manifest-url');
    const artifactUrl = response.headers.get('x-iclaw-update-artifact-url');
    this.onDesktopUpdateHint({
      appName,
      latestVersion,
      updateAvailable,
      mandatory,
      enforcementState:
        enforcementState === 'required_after_run' || enforcementState === 'required_now'
          ? enforcementState
          : 'recommended',
      blockNewRuns,
      reasonCode,
      reasonMessage,
      manifestUrl: manifestUrl?.trim() || null,
      artifactUrl: artifactUrl?.trim() || null,
    });
  }

  async health(): Promise<unknown> {
    const res = await this.fetchApi('/health', {
      credentials: 'include',
    }, HEALTH_REQUEST_TIMEOUT_MS);
    if (!res.ok) {
      const text = await res.text();
      if (
        res.status === 503 &&
        text.includes('Control UI assets not found')
      ) {
        return { status: 'ok', mode: 'gateway' };
      }
      const body = parseJsonSafe<{ error?: { code?: string; message?: string; requestId?: string } }>(text);
      const payload = body?.error;
      throw new ApiError({
        code: payload?.code || 'HTTP_ERROR',
        message: payload?.message || `Request failed: ${res.status}`,
        requestId: payload?.requestId,
      });
    }
    return res.json();
  }

  async getDesktopUpdateHint(input: DesktopUpdateHintInput = {}): Promise<DesktopUpdateHint> {
    const params = new URLSearchParams();
    const appName = input.appName?.trim() || this.desktopAppName;
    const appVersion = input.appVersion?.trim() || this.desktopAppVersion;
    const channel = input.channel || this.desktopReleaseChannel;
    if (!appVersion) {
      throw new ApiError({
        code: 'BAD_REQUEST',
        message: 'desktop app version is required',
      });
    }
    if (appName) params.set('app_name', appName);
    params.set('current_version', appVersion);
    if (channel) params.set('channel', channel);
    if (input.platform?.trim()) params.set('target', input.platform.trim());
    if (input.arch?.trim()) params.set('arch', input.arch.trim());

    const res = await this.fetchAuth(`/desktop/update-hint?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: DesktopUpdateHint };
    return json.data;
  }

  async login(input: LoginInput): Promise<{ tokens: AuthTokens; user: unknown }> {
    const res = await this.fetchAuth('/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: input.identifier,
        email: input.identifier,
        password: input.password,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: { tokens: AuthTokens; user: unknown } };
    return json.data;
  }

  async register(input: RegisterInput): Promise<{ tokens: AuthTokens; user: unknown }> {
    const res = await this.fetchAuth('/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: input.username,
        email: input.email,
        password: input.password,
        name: input.name,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: { tokens: AuthTokens; user: unknown } };
    return json.data;
  }

  async wechatLogin(input: OAuthLoginInput): Promise<{ tokens: AuthTokens; user: unknown }> {
    const res = await this.fetchAuth('/auth/wechat', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: input.code,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: { tokens: AuthTokens; user: unknown } };
    return json.data;
  }

  async googleLogin(input: OAuthLoginInput): Promise<{ tokens: AuthTokens; user: unknown }> {
    const res = await this.fetchAuth('/auth/google', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: input.code,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: { tokens: AuthTokens; user: unknown } };
    return json.data;
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const res = await this.fetchAuth('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: AuthTokens };
    return json.data;
  }

  async me(token?: string): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await this.fetchAuth('/auth/me', {
      headers,
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as MeResponse;
    const data = json.data as
      | { user?: unknown; profile?: unknown }
      | null
      | undefined;
    // Compatible with both `{ data: user }` and `{ data: { user } }` payloads.
    return (data && (data.user ?? data.profile)) || data || null;
  }

  async updateProfile(input: UpdateProfileInput): Promise<unknown> {
    const res = await this.fetchAuth('/auth/profile', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.name,
        avatar_data_base64: input.avatarDataBase64,
        avatar_content_type: input.avatarContentType,
        avatar_filename: input.avatarFilename,
        remove_avatar: input.removeAvatar,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as MeResponse;
    return json.data;
  }

  async changePassword(input: ChangePasswordInput): Promise<{message?: string}> {
    const res = await this.fetchAuth('/auth/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_password: input.currentPassword,
        new_password: input.newPassword,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {message?: string}};
    return json.data;
  }

  async linkedAccounts(token: string): Promise<unknown> {
    const res = await this.fetchAuth('/auth/linked-accounts', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: unknown};
    return json.data;
  }

  async unlinkOAuthAccount(token: string, provider: 'wechat' | 'google'): Promise<{message?: string}> {
    const res = await this.fetchAuth(`/auth/link/${provider}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {message?: string}};
    return json.data;
  }

  async creditsMe(token: string): Promise<CreditBalanceData> {
    const res = await this.fetchAuth('/credits/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: CreditBalanceData};
    return json.data;
  }

  async creditsLedger(token: string): Promise<{items: CreditLedgerItemData[]}> {
    const res = await this.fetchAuth('/credits/ledger', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {items: CreditLedgerItemData[]}};
    return json.data;
  }

  async creditsQuote(token: string, input: CreditQuoteInput): Promise<CreditQuoteData> {
    const res = await this.fetchAuth('/credits/quote', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        message: input.message,
        model: input.model,
        app_name: input.appName,
        history_messages: input.historyMessages,
        has_search: input.hasSearch,
        has_tools: input.hasTools,
        attachments: input.attachments,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: CreditQuoteData};
    return json.data;
  }

  async createPaymentOrder(input: CreatePaymentOrderInput): Promise<PaymentOrderData> {
    const res = await this.fetchAuth('/payments/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      signal: input.signal,
      body: JSON.stringify({
        provider: input.provider || 'wechat_qr',
        package_id: input.packageId,
        return_url: input.returnUrl,
        app_name: input.appName || this.desktopAppName,
        app_version: input.appVersion || this.desktopAppVersion,
        release_channel: input.releaseChannel || this.desktopReleaseChannel,
        platform: input.platform || this.desktopPlatform,
        arch: input.arch || this.desktopArch,
      }),
    }, input.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: PaymentOrderData};
    return json.data;
  }

  async getPaymentOrder(
    token: string,
    orderId: string,
    options?: {signal?: AbortSignal; timeoutMs?: number},
  ): Promise<PaymentOrderData> {
    const res = await this.fetchAuth(`/payments/orders/${encodeURIComponent(orderId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      signal: options?.signal,
    }, options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: PaymentOrderData};
    return json.data;
  }

  async applyPaymentWebhook(input: PaymentWebhookInput): Promise<PaymentOrderData> {
    const res = await this.fetchAuth(`/payments/webhooks/${encodeURIComponent(input.provider)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        event_id: input.eventId,
        order_id: input.orderId,
        provider_order_id: input.providerOrderId,
        status: input.status,
        paid_at: input.paidAt,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: PaymentOrderData};
    return json.data;
  }

  async chatHistory(_input?: ChatHistoryInput): Promise<{messages: unknown[]}> {
    // OpenClaw history endpoint is not implemented in this repo yet.
    // Return an empty payload so desktop auth/chat UI does not crash on load.
    return {messages: []};
  }

  async authorizeRun(input: AuthorizeRunInput): Promise<RunGrantData> {
    const res = await this.fetchAuth('/agent/run/authorize', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_id: input.eventId,
        session_key: toCanonicalSessionKey(input.sessionKey),
        client: input.client || 'desktop',
        estimated_input_tokens: input.estimatedInputTokens || 0,
        estimated_output_tokens: input.estimatedOutputTokens || 0,
        message: input.message,
        history_messages: input.historyMessages,
        has_search: input.hasSearch,
        has_tools: input.hasTools,
        attachments: input.attachments,
        model: input.model,
        app_name: input.appName,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: RunGrantData};
    return json.data;
  }

  async getRunBillingSummary(token: string, grantId: string): Promise<RunBillingSummaryData> {
    const res = await this.fetchAuth(`/agent/run/billing?grant_id=${encodeURIComponent(grantId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: RunBillingSummaryData};
    return json.data;
  }

  async listRunBillingSummariesBySession(
    token: string,
    input?: {sessionKey?: string; limit?: number},
  ): Promise<RunBillingSummaryData[]> {
    const sessionKey = toCanonicalSessionKey(input?.sessionKey);
    const limit = typeof input?.limit === 'number' && Number.isFinite(input.limit) ? Math.max(1, Math.floor(input.limit)) : 200;
    const res = await this.fetchAuth(
      `/agent/run/billing/session?session_key=${encodeURIComponent(sessionKey)}&limit=${encodeURIComponent(String(limit))}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      },
    );
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: RunBillingSummaryData[]};
    return Array.isArray(json.data) ? json.data : [];
  }

  async reportUsageEvent(input: UsageEventInput): Promise<UsageEventData> {
    const res = await this.fetchAuth('/usage/events', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_id: input.eventId,
        grant_id: input.grantId,
        input_tokens: input.inputTokens || 0,
        output_tokens: input.outputTokens || 0,
        provider: input.provider,
        model: input.model,
        app_name: input.appName,
        assistant_timestamp: input.assistantTimestamp,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: UsageEventData};
    return json.data;
  }

  async getWorkspaceBackup(token: string): Promise<WorkspaceBackupData | null> {
    const res = await this.fetchAuth('/workspace/backup', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: WorkspaceBackupData | null};
    return json.data;
  }

  async saveWorkspaceBackup(input: WorkspaceBackupInput): Promise<WorkspaceBackupData> {
    const res = await this.fetchAuth('/workspace/backup', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identity_md: input.identityMd,
        user_md: input.userMd,
        soul_md: input.soulMd,
        agents_md: input.agentsMd,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: WorkspaceBackupData};
    return json.data;
  }

  async listMarketStocksPage(options?: {
    market?: string;
    exchange?: string;
    search?: string;
    tag?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<SkillCatalogPageData<MarketStockData>> {
    const searchParams = new URLSearchParams();
    if (options?.market?.trim()) searchParams.set('market', options.market.trim());
    if (options?.exchange?.trim()) searchParams.set('exchange', options.exchange.trim());
    if (options?.search?.trim()) searchParams.set('search', options.search.trim());
    if (options?.tag?.trim()) searchParams.set('tag', options.tag.trim());
    if (options?.sort?.trim()) searchParams.set('sort', options.sort.trim());
    if (typeof options?.limit === 'number' && Number.isFinite(options.limit)) {
      searchParams.set('limit', String(Math.max(1, Math.floor(options.limit))));
    }
    if (typeof options?.offset === 'number' && Number.isFinite(options.offset) && options.offset > 0) {
      searchParams.set('offset', String(Math.max(0, Math.floor(options.offset))));
    }
    const query = searchParams.size ? `?${searchParams.toString()}` : '';
    const res = await this.fetchAuth(`/market/stocks${query}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: SkillCatalogPageData<MarketStockData>};
    return json.data;
  }

  async listMarketStocks(options?: {
    market?: string;
    exchange?: string;
    search?: string;
    tag?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<MarketStockData[]> {
    const page = await this.listMarketStocksPage(options);
    return page.items;
  }

  async getMarketStock(stockId: string): Promise<MarketStockData> {
    const res = await this.fetchAuth(`/market/stocks/${encodeURIComponent(stockId)}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: MarketStockData};
    return json.data;
  }

  async listMarketFundsPage(options?: {
    market?: string;
    exchange?: string;
    instrumentKind?: string;
    region?: string;
    riskLevel?: string;
    search?: string;
    tag?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<SkillCatalogPageData<MarketFundData>> {
    const searchParams = new URLSearchParams();
    if (options?.market?.trim()) searchParams.set('market', options.market.trim());
    if (options?.exchange?.trim()) searchParams.set('exchange', options.exchange.trim());
    if (options?.instrumentKind?.trim()) searchParams.set('instrument_kind', options.instrumentKind.trim());
    if (options?.region?.trim()) searchParams.set('region', options.region.trim());
    if (options?.riskLevel?.trim()) searchParams.set('risk_level', options.riskLevel.trim());
    if (options?.search?.trim()) searchParams.set('search', options.search.trim());
    if (options?.tag?.trim()) searchParams.set('tag', options.tag.trim());
    if (options?.sort?.trim()) searchParams.set('sort', options.sort.trim());
    if (typeof options?.limit === 'number' && Number.isFinite(options.limit)) {
      searchParams.set('limit', String(Math.max(1, Math.floor(options.limit))));
    }
    if (typeof options?.offset === 'number' && Number.isFinite(options.offset) && options.offset > 0) {
      searchParams.set('offset', String(Math.max(0, Math.floor(options.offset))));
    }
    const query = searchParams.size ? `?${searchParams.toString()}` : '';
    const res = await this.fetchAuth(`/market/funds${query}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: SkillCatalogPageData<MarketFundData>};
    return json.data;
  }

  async listMarketFunds(options?: {
    market?: string;
    exchange?: string;
    instrumentKind?: string;
    region?: string;
    riskLevel?: string;
    search?: string;
    tag?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<MarketFundData[]> {
    const page = await this.listMarketFundsPage(options);
    return page.items;
  }

  async getMarketFund(fundId: string): Promise<MarketFundData> {
    const res = await this.fetchAuth(`/market/funds/${encodeURIComponent(fundId)}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: MarketFundData};
    return json.data;
  }

  async listSkillsCatalogPage(options?: {
    limit?: number;
    offset?: number;
    tagKeywords?: string[];
  }): Promise<SkillCatalogPageData<SkillCatalogEntryData>> {
    const searchParams = new URLSearchParams();
    if (typeof options?.limit === 'number' && Number.isFinite(options.limit)) {
      searchParams.set('limit', String(Math.max(1, Math.floor(options.limit))));
    }
    if (typeof options?.offset === 'number' && Number.isFinite(options.offset) && options.offset > 0) {
      searchParams.set('offset', String(Math.max(0, Math.floor(options.offset))));
    }
    if (Array.isArray(options?.tagKeywords)) {
      for (const keyword of options.tagKeywords.map((item) => item.trim()).filter(Boolean)) {
        searchParams.append('tag', keyword);
      }
    }
    const query = searchParams.size ? `?${searchParams.toString()}` : '';
    const res = await this.fetchAuth(`/skills/catalog${query}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: SkillCatalogPageData<SkillCatalogEntryData>};
    return json.data;
  }

  async listSkillsCatalog(options?: {
    limit?: number;
    offset?: number;
    tagKeywords?: string[];
  }): Promise<SkillCatalogEntryData[]> {
    const page = await this.listSkillsCatalogPage(options);
    return page.items;
  }

  async listMcpCatalogPage(options?: {limit?: number; offset?: number}): Promise<SkillCatalogPageData<McpCatalogEntryData>> {
    const searchParams = new URLSearchParams();
    if (typeof options?.limit === 'number' && Number.isFinite(options.limit)) {
      searchParams.set('limit', String(Math.max(1, Math.floor(options.limit))));
    }
    if (typeof options?.offset === 'number' && Number.isFinite(options.offset) && options.offset > 0) {
      searchParams.set('offset', String(Math.max(0, Math.floor(options.offset))));
    }
    const query = searchParams.size ? `?${searchParams.toString()}` : '';
    const res = await this.fetchAuth(`/mcp/catalog${query}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: SkillCatalogPageData<McpCatalogEntryData>};
    return json.data;
  }

  async listMcpCatalog(options?: {limit?: number; offset?: number}): Promise<McpCatalogEntryData[]> {
    const page = await this.listMcpCatalogPage(options);
    return page.items;
  }

  async listPersonalSkillsCatalogPage(
    token: string,
    options?: {limit?: number; offset?: number},
  ): Promise<SkillCatalogPageData<SkillCatalogEntryData>> {
    const searchParams = new URLSearchParams();
    if (typeof options?.limit === 'number' && Number.isFinite(options.limit)) {
      searchParams.set('limit', String(Math.max(1, Math.floor(options.limit))));
    }
    if (typeof options?.offset === 'number' && Number.isFinite(options.offset) && options.offset > 0) {
      searchParams.set('offset', String(Math.max(0, Math.floor(options.offset))));
    }
    const query = searchParams.size ? `?${searchParams.toString()}` : '';
    const res = await this.fetchAuth(`/skills/catalog/personal${query}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: SkillCatalogPageData<SkillCatalogEntryData>};
    return json.data;
  }

  async listPersonalSkillsCatalog(token: string, options?: {limit?: number; offset?: number}): Promise<SkillCatalogEntryData[]> {
    const page = await this.listPersonalSkillsCatalogPage(token, options);
    return page.items;
  }

  async listAdminSkillsCatalogPage(
    token: string,
    options?: {limit?: number; offset?: number},
  ): Promise<SkillCatalogPageData<AdminSkillCatalogEntryData>> {
    const searchParams = new URLSearchParams();
    if (typeof options?.limit === 'number' && Number.isFinite(options.limit)) {
      searchParams.set('limit', String(Math.max(1, Math.floor(options.limit))));
    }
    if (typeof options?.offset === 'number' && Number.isFinite(options.offset) && options.offset > 0) {
      searchParams.set('offset', String(Math.max(0, Math.floor(options.offset))));
    }
    const query = searchParams.size ? `?${searchParams.toString()}` : '';
    const res = await this.fetchAuth(`/admin/skills/catalog${query}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: SkillCatalogPageData<AdminSkillCatalogEntryData>};
    return json.data;
  }

  async listAdminSkillsCatalog(token: string, options?: {limit?: number; offset?: number}): Promise<AdminSkillCatalogEntryData[]> {
    const page = await this.listAdminSkillsCatalogPage(token, options);
    return page.items;
  }

  async upsertAdminSkillCatalogEntry(input: UpsertAdminSkillCatalogInput): Promise<AdminSkillCatalogEntryData> {
    const res = await this.fetchAuth('/admin/skills/catalog', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: input.slug,
        name: input.name,
        description: input.description,
        featured: input.featured,
        market: input.market,
        category: input.category,
        skill_type: input.skillType,
        publisher: input.publisher,
        distribution: input.distribution,
        tags: input.tags,
        version: input.version,
        artifact_url: input.artifactUrl,
        artifact_format: input.artifactFormat,
        artifact_sha256: input.artifactSha256,
        artifact_source_path: input.artifactSourcePath,
        origin_type: input.originType,
        source_url: input.sourceUrl,
        metadata: input.metadata,
        active: input.active,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: AdminSkillCatalogEntryData};
    return json.data;
  }

  async deleteAdminSkillCatalogEntry(token: string, slug: string): Promise<{removed: boolean}> {
    const path = `/admin/skills/catalog?slug=${encodeURIComponent(slug)}`;
    const res = await this.fetchAuth(path, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {removed: boolean}};
    return json.data;
  }

  async listSkillSyncSources(token: string): Promise<SkillSyncSourceData[]> {
    const res = await this.fetchAuth('/admin/skills/sync/sources', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {items: SkillSyncSourceData[]}};
    return json.data.items;
  }

  async upsertSkillSyncSource(input: UpsertSkillSyncSourceInput): Promise<SkillSyncSourceData> {
    const res = await this.fetchAuth('/admin/skills/sync/sources', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: input.id,
        source_type: input.sourceType,
        source_key: input.sourceKey,
        display_name: input.displayName,
        source_url: input.sourceUrl,
        config: input.config || {},
        active: input.active,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: SkillSyncSourceData};
    return json.data;
  }

  async deleteSkillSyncSource(token: string, id: string): Promise<{removed: boolean}> {
    const res = await this.fetchAuth(`/admin/skills/sync/sources?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {removed: boolean}};
    return json.data;
  }

  async listSkillSyncRuns(token: string, limit = 20): Promise<SkillSyncRunData[]> {
    const res = await this.fetchAuth(`/admin/skills/sync/runs?limit=${encodeURIComponent(String(limit))}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {items: SkillSyncRunData[]}};
    return json.data.items;
  }

  async runSkillSync(token: string, sourceId: string): Promise<SkillSyncRunData> {
    const res = await this.fetchAuth('/admin/skills/sync/run', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_id: sourceId,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: SkillSyncRunData};
    return json.data;
  }

  async getSkillLibrary(token: string): Promise<UserSkillLibraryItemData[]> {
    const res = await this.fetchAuth('/skills/library', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {items: UserSkillLibraryItemData[]}};
    return json.data.items;
  }

  async getMcpLibrary(token: string): Promise<UserMcpLibraryItemData[]> {
    const res = await this.fetchAuth('/mcp/library', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {items: UserMcpLibraryItemData[]}};
    return json.data.items;
  }

  async installSkill(input: InstallSkillLibraryInput): Promise<UserSkillLibraryItemData> {
    const res = await this.fetchAuth('/skills/library/install', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: input.slug,
        version: input.version,
        setup_values: input.setupValues,
        secret_values: input.secretValues,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: UserSkillLibraryItemData};
    return json.data;
  }

  async installMcp(input: InstallMcpLibraryInput): Promise<UserMcpLibraryItemData> {
    const res = await this.fetchAuth('/mcp/library/install', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mcp_key: input.mcpKey,
        setup_values: input.setupValues,
        secret_values: input.secretValues,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: UserMcpLibraryItemData};
    return json.data;
  }

  async getExtensionInstallConfig(
    token: string,
    extensionType: 'skill' | 'mcp',
    extensionKey: string,
  ): Promise<UserExtensionInstallConfigData | null> {
    const params = new URLSearchParams({
      extension_type: extensionType,
      extension_key: extensionKey,
    });
    const res = await this.fetchAuth(`/extensions/install-config?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: UserExtensionInstallConfigData | null};
    return json.data;
  }

  async upsertExtensionInstallConfig(input: UpsertExtensionInstallConfigInput): Promise<UserExtensionInstallConfigData> {
    const res = await this.fetchAuth('/extensions/install-config', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        extension_type: input.extensionType,
        extension_key: input.extensionKey,
        setup_values: input.setupValues,
        secret_values: input.secretValues,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: UserExtensionInstallConfigData};
    return json.data;
  }

  async importPrivateSkill(input: ImportPrivateSkillInput): Promise<SkillCatalogEntryData> {
    const res = await this.fetchAuth('/skills/library/import', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: input.slug,
        name: input.name,
        description: input.description,
        market: input.market,
        category: input.category,
        skill_type: input.skillType,
        publisher: input.publisher,
        tags: input.tags,
        source_kind: input.sourceKind,
        source_url: input.sourceUrl,
        version: input.version,
        artifact_format: input.artifactFormat,
        artifact_sha256: input.artifactSha256,
        artifact_base64: input.artifactBase64,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: SkillCatalogEntryData};
    return json.data;
  }

  async updateSkillLibraryItem(input: UpdateSkillLibraryInput): Promise<UserSkillLibraryItemData> {
    const res = await this.fetchAuth('/skills/library/state', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: input.slug,
        enabled: input.enabled,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: UserSkillLibraryItemData};
    return json.data;
  }

  async updateMcpLibraryItem(input: UpdateMcpLibraryInput): Promise<UserMcpLibraryItemData> {
    const res = await this.fetchAuth('/mcp/library/state', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mcp_key: input.mcpKey,
        enabled: input.enabled,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: UserMcpLibraryItemData};
    return json.data;
  }

  async removeSkillFromLibrary(token: string, slug: string): Promise<{removed: boolean}> {
    const res = await this.fetchAuth('/skills/library/uninstall', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({slug}),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {removed: boolean}};
    return json.data;
  }

  async removeMcpFromLibrary(token: string, mcpKey: string): Promise<{removed: boolean}> {
    const res = await this.fetchAuth('/mcp/library/uninstall', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({mcp_key: mcpKey}),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {removed: boolean}};
    return json.data;
  }

  async listAgentsCatalog(): Promise<AgentCatalogEntryData[]> {
    const res = await this.fetchAuth('/agents/catalog', {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {items: AgentCatalogEntryData[]}};
    return json.data.items;
  }

  async getAgentLibrary(token: string): Promise<UserAgentLibraryItemData[]> {
    const res = await this.fetchAuth('/agents/library', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {items: UserAgentLibraryItemData[]}};
    return json.data.items;
  }

  async installAgent(token: string, slug: string): Promise<UserAgentLibraryItemData> {
    const res = await this.fetchAuth('/agents/library/install', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({slug}),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: UserAgentLibraryItemData};
    return json.data;
  }

  async removeAgentFromLibrary(token: string, slug: string): Promise<{removed: boolean}> {
    const res = await this.fetchAuth('/agents/library/uninstall', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({slug}),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {removed: boolean}};
    return json.data;
  }

  private generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  private async buildGatewayConnectParams(nonce?: string): Promise<Record<string, unknown>> {
    const identity = this.disableGatewayDeviceIdentity ? null : await loadOrCreateBrowserDeviceIdentity();
    const explicitGatewayToken = this.gatewayToken?.trim() || undefined;
    const explicitGatewayPassword = this.gatewayPassword?.trim() || undefined;
    const storedDeviceToken =
      identity && !explicitGatewayToken && !explicitGatewayPassword
        ? loadStoredDeviceToken(identity.deviceId, GATEWAY_ROLE)
        : undefined;
    const authToken = explicitGatewayToken ?? storedDeviceToken;
    const auth =
      authToken || explicitGatewayPassword || storedDeviceToken
        ? {
            token: authToken,
            ...(storedDeviceToken ? { deviceToken: storedDeviceToken } : {}),
            ...(explicitGatewayPassword ? { password: explicitGatewayPassword } : {}),
          }
        : undefined;

    let device: Record<string, unknown> | undefined;
    if (identity && nonce) {
      const signedAtMs = Date.now();
      const payload = buildDeviceAuthPayloadV3({
        deviceId: identity.deviceId,
        clientId: GATEWAY_CLIENT_ID,
        clientMode: GATEWAY_CLIENT_MODE,
        role: GATEWAY_ROLE,
        scopes: GATEWAY_SCOPES,
        signedAtMs,
        token: authToken ?? null,
        nonce,
        platform: 'web',
      });
      const signature = await signBrowserDevicePayload(identity.privateKey, payload);
      device = {
        id: identity.deviceId,
        publicKey: identity.publicKey,
        signature,
        signedAt: signedAtMs,
        nonce,
      };
    }

    return {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: GATEWAY_CLIENT_ID,
        version: '1.0.0',
        platform: 'web',
        mode: GATEWAY_CLIENT_MODE,
      },
      caps: [],
      auth,
      role: GATEWAY_ROLE,
      scopes: GATEWAY_SCOPES,
      ...(device ? { device } : {}),
    };
  }

  private persistGatewayDeviceToken(payload: unknown): void {
    const auth = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).auth : null;
    if (!auth || typeof auth !== 'object') return;
    const authRecord = auth as Record<string, unknown>;
    const deviceToken = typeof authRecord.deviceToken === 'string' ? authRecord.deviceToken.trim() : '';
    if (!deviceToken) return;
    void loadOrCreateBrowserDeviceIdentity().then((identity) => {
      if (!identity) return;
      const role = typeof authRecord.role === 'string' ? authRecord.role : GATEWAY_ROLE;
      const scopes = Array.isArray(authRecord.scopes)
        ? (authRecord.scopes as unknown[]).filter((value): value is string => typeof value === 'string')
        : GATEWAY_SCOPES;
      storeDeviceToken(identity.deviceId, role, deviceToken, scopes);
    });
  }

  private extractGatewayText(message: unknown): string {
    const m = message && typeof message === 'object' ? (message as Record<string, unknown>) : {};
    if (typeof m.text === 'string') return m.text;
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) {
      return m.content
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const text = (item as Record<string, unknown>).text;
          return typeof text === 'string' ? text : null;
        })
        .filter((v): v is string => typeof v === 'string')
        .join('\n');
    }
    return '';
  }

  private streamChatViaGateway(input: StreamChatInput, callbacks: StreamCallbacks): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.gatewayWsUrl);
      const pending = new Map<
        string,
        {
          resolve: (payload: unknown) => void;
          reject: (error: Error) => void;
          expectFinal?: boolean;
        }
      >();

      let closed = false;
      let connectSent = false;
      let runId: string | null = null;
      let wsErrored = false;
      const idempotencyKey = input.runId || this.generateId('run');

      const cleanup = (error?: Error) => {
        if (closed) return;
        closed = true;
        try {
          ws.close();
        } catch {}
        for (const [, p] of pending) {
          p.reject(error || new Error('gateway connection closed'));
        }
        pending.clear();
      };

      const sendRequest = (method: string, params?: unknown, expectFinal?: boolean): Promise<unknown> => {
        const id = this.generateId('req');
        const frame = { type: 'req', id, method, params };
        return new Promise((resolveReq, rejectReq) => {
          pending.set(id, { resolve: resolveReq, reject: rejectReq, expectFinal });
          ws.send(JSON.stringify(frame));
        });
      };

      const handleGatewayEvent = (frame: GatewayEventFrame) => {
        if (frame.event === 'connect.challenge') {
          if (connectSent) return;
          connectSent = true;
          const challenge = frame.payload as Record<string, unknown> | undefined;
          const nonce = typeof challenge?.nonce === 'string' ? challenge.nonce : undefined;
          void this.buildGatewayConnectParams(nonce)
            .then((params) => sendRequest('connect', params))
            .then((payload) => {
              this.persistGatewayDeviceToken(payload);
              return sendRequest(
                'chat.send',
                {
                  sessionKey: this.gatewaySessionKey,
                  message: input.message,
                  deliver: false,
                  idempotencyKey,
                },
                true,
              );
            })
            .then((payload) => {
              callbacks.onStart?.(payload);
            })
            .catch((err) => {
              const apiErr = new ApiError({ code: 'GATEWAY_CONNECT_FAILED', message: String(err) });
              callbacks.onError?.(apiErr);
              cleanup(apiErr);
              reject(apiErr);
            });
          return;
        }

        const payload = frame.payload as Record<string, unknown> | undefined;
        const state = typeof payload?.state === 'string' ? payload.state : '';
        const payloadRunId = typeof payload?.runId === 'string' ? payload.runId : null;
        if (payloadRunId && !runId) {
          runId = payloadRunId;
        }
        if (runId && payloadRunId && runId !== payloadRunId) {
          return;
        }
        if (state === 'delta') {
          const text = this.extractGatewayText(payload?.message);
          callbacks.onDelta?.(text, payload);
          return;
        }
        if (state === 'final' || state === 'aborted') {
          callbacks.onEnd?.(payload);
          cleanup();
          resolve();
          return;
        }
        if (state === 'error') {
          const err = new ApiError({
            code: 'STREAM_ERROR',
            message: typeof payload?.errorMessage === 'string' ? payload.errorMessage : 'Stream error',
          });
          callbacks.onError?.(err);
          cleanup(err);
          reject(err);
        }
      };

      ws.onopen = () => {
        if (input.signal) {
          input.signal.addEventListener('abort', () => {
            const err = new ApiError({ code: 'ABORTED', message: 'Request aborted' });
            cleanup(err);
            reject(err);
          });
        }
      };

      ws.onmessage = (evt) => {
        let parsed: GatewayFrame | null = null;
        try {
          parsed = parseJsonSafe<GatewayFrame>(String(evt.data));
        } catch {
          parsed = null;
        }
        if (!parsed || typeof parsed !== 'object') return;
        if ((parsed as Record<string, unknown>).type === 'res') {
          const frame = parsed as GatewayResponseFrame;
          const p = pending.get(frame.id);
          if (!p) return;
          const status = (frame.payload as Record<string, unknown> | undefined)?.status;
          if (p.expectFinal && status === 'accepted') return;
          pending.delete(frame.id);
          if (frame.ok) p.resolve(frame.payload);
          else p.reject(new Error(frame.error?.message || 'gateway request failed'));
          return;
        }
        if ((parsed as Record<string, unknown>).type === 'event') {
          handleGatewayEvent(parsed as GatewayEventFrame);
        }
      };

      ws.onerror = () => {
        wsErrored = true;
      };

      ws.onclose = (event) => {
        if (!closed) {
          const reason = event.reason?.trim();
          const code = typeof event.code === 'number' ? event.code : 0;
          const message = reason
            ? `Gateway websocket closed (${code}): ${reason}`
            : wsErrored
              ? `Gateway websocket closed (${code})`
              : 'Gateway websocket closed';
          const err = new ApiError({ code: 'GATEWAY_WS_CLOSED', message });
          callbacks.onError?.(err);
          cleanup(err);
          reject(err);
        }
      };
    });
  }

  async streamChat(input: StreamChatInput, callbacks: StreamCallbacks): Promise<void> {
    if (this.preferGatewayWs) {
      return this.streamChatViaGateway(input, callbacks);
    }

    const res = await this.fetchApi('/agent/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.token ? { Authorization: `Bearer ${input.token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        message: input.message,
        taskId: input.taskId,
        attachments: input.attachments || [],
      }),
      signal: input.signal,
    }, STREAM_REQUEST_TIMEOUT_MS);

    if (!res.ok) {
      const err = await parseError(res);
      callbacks.onError?.(err);
      throw err;
    }

    if (!res.body) {
      const err = new ApiError({ code: 'EMPTY_STREAM', message: 'Empty stream body' });
      callbacks.onError?.(err);
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        const lines = chunk.split('\n');
        let eventName = 'message';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          }
          if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }

        const dataRaw = dataLines.join('\n');
        const payload = parseJsonSafe<Record<string, unknown>>(dataRaw) || { raw: dataRaw };

        if (eventName === 'start') callbacks.onStart?.(payload);
        if (eventName === 'delta') {
          const text = typeof payload.text === 'string' ? payload.text : dataRaw;
          callbacks.onDelta?.(text, payload);
        }
        if (eventName === 'end') callbacks.onEnd?.(payload);
        if (eventName === 'error') {
          const err = new ApiError({
            code: typeof payload.code === 'string' ? payload.code : 'STREAM_ERROR',
            message: typeof payload.message === 'string' ? payload.message : 'Stream error',
            requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
          });
          callbacks.onError?.(err);
          throw err;
        }
      }
    }
  }
}
