import { BRAND } from '@/app/lib/brand';
import type { IClawClient, McpCatalogEntryData, UserCustomMcpData, UserMcpLibraryItemData } from '@iclaw/sdk';
import type {
  ExtensionInstallConfigSnapshot,
  ExtensionSetupSchema,
  ExtensionSetupStatus,
} from './extension-setup';
import {parseExtensionSetupSchema} from './extension-setup';

export type McpStoreProtocol = 'STDIO' | 'HTTP' | 'SSE';
export type McpStoreSource = 'bundled' | 'cloud' | 'custom';
export type McpStoreInstallState = 'bundled' | 'installed' | 'available';
export type McpStoreIconKey = 'browser' | 'search' | 'database' | 'file' | 'finance' | 'dev' | 'automation';
export type McpStoreTone = 'brand' | 'success' | 'info' | 'warning' | 'neutral';
type McpStoreTier = 'p0' | 'p1' | 'p2' | 'p3';

export type McpStoreItem = {
  id: string;
  mcpKey: string;
  name: string;
  description: string;
  source: McpStoreSource;
  sourceLabel: string;
  protocol: McpStoreProtocol;
  installState: McpStoreInstallState;
  defaultInstalled: boolean;
  installed: boolean;
  userInstalled: boolean;
  enabled: boolean;
  canToggle: boolean;
  requiresApiKey: boolean;
  categories: string[];
  lastUpdated: string;
  configSummary: string | null;
  command: string | null;
  httpUrl: string | null;
  featured: boolean;
  iconKey: McpStoreIconKey;
  tone: McpStoreTone;
  metadata: Record<string, unknown>;
  setupSchema: ExtensionSetupSchema | null;
  setupStatus: ExtensionSetupStatus;
  setupSchemaVersion: number | null;
  setupUpdatedAt: string | null;
};

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function titleizeMcpKey(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeProtocol(value: string | null | undefined): McpStoreProtocol {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'sse') {
    return 'SSE';
  }
  if (normalized === 'http' || normalized === 'streamable-http') {
    return 'HTTP';
  }
  return 'STDIO';
}

function readDateLabel(value: string | null | undefined): string {
  const normalized = (value || '').trim();
  return normalized ? normalized.slice(0, 10) : '最近同步';
}

function parseCategories(metadata: Record<string, unknown>): string[] {
  const candidates = [
    ...readStringArray(metadata.categories),
    ...readStringArray(metadata.tags),
  ];

  const category = readString(metadata.category);
  if (category) {
    candidates.unshift(category);
  }

  const deduped = new Set<string>();
  for (const item of candidates) {
    if (!item) continue;
    deduped.add(item);
    if (deduped.size >= 5) break;
  }
  return Array.from(deduped);
}

function isSecretEnvKey(key: string): boolean {
  const normalized = key.trim().toUpperCase();
  if (!normalized) return false;
  if (normalized.startsWith('UV_') || normalized === 'PORT' || normalized === 'NODE_ENV') {
    return false;
  }
  return ['KEY', 'TOKEN', 'SECRET', 'COOKIE', 'PASSWORD'].some((part) => normalized.includes(part));
}

function inferRequiresApiKey(
  config: Record<string, unknown>,
  metadata: Record<string, unknown>,
): boolean {
  if (readBoolean(metadata.requires_api_key) === true || readBoolean(metadata.requiresApiKey) === true) {
    return true;
  }
  if (readStringArray(metadata.required_env).length > 0 || readStringArray(metadata.requiredEnv).length > 0) {
    return true;
  }

  const env = readObject(config.env);
  return Object.keys(env).some(isSecretEnvKey);
}

function resolveCloudSourceLabel(metadata: Record<string, unknown>): string {
  const explicit = readString(metadata.source_label) || readString(metadata.sourceLabel);
  if (explicit) {
    return explicit;
  }
  if (readBoolean(metadata.community) === true || readString(metadata.channel) === 'community') {
    return '社区推荐';
  }
  if (readBoolean(metadata.official) === true || readBoolean(metadata.featured) === true) {
    return '官方模板';
  }
  return '云端目录';
}

function inferIconKey(categories: string[], key: string): McpStoreIconKey {
  const haystack = `${key} ${categories.join(' ')}`.toLowerCase();
  if (haystack.includes('search') || haystack.includes('搜索') || haystack.includes('browser') || haystack.includes('网页')) {
    return haystack.includes('browser') || haystack.includes('网页') ? 'browser' : 'search';
  }
  if (haystack.includes('db') || haystack.includes('数据库') || haystack.includes('postgres')) {
    return 'database';
  }
  if (haystack.includes('file') || haystack.includes('文档') || haystack.includes('文件') || haystack.includes('markdown')) {
    return 'file';
  }
  if (haystack.includes('finance') || haystack.includes('行情') || haystack.includes('金融') || haystack.includes('macro')) {
    return 'finance';
  }
  if (haystack.includes('dev') || haystack.includes('开发') || haystack.includes('git')) {
    return 'dev';
  }
  return 'automation';
}

function inferTone(iconKey: McpStoreIconKey): McpStoreTone {
  switch (iconKey) {
    case 'search':
      return 'brand';
    case 'browser':
      return 'info';
    case 'finance':
      return 'success';
    case 'database':
      return 'neutral';
    case 'file':
      return 'warning';
    default:
      return 'neutral';
  }
}

function parseTier(metadata: Record<string, unknown>): McpStoreTier {
  const normalized = (readString(metadata.tier) || '').toLowerCase();
  if (normalized === 'p0' || normalized === 'p1' || normalized === 'p2') {
    return normalized;
  }
  return 'p3';
}

function tierWeight(tier: McpStoreTier): number {
  switch (tier) {
    case 'p0':
      return 0;
    case 'p1':
      return 1;
    case 'p2':
      return 2;
    default:
      return 3;
  }
}

function readCommand(config: Record<string, unknown>): string | null {
  return readString(config.command);
}

function readHttpUrl(config: Record<string, unknown>): string | null {
  return readString(config.httpUrl) || readString(config.url);
}

function buildConfigSummary(command: string | null, httpUrl: string | null, config: Record<string, unknown>): string | null {
  if (command) {
    const args = readStringArray(config.args).join(' ');
    return args ? `${command} ${args}`.trim() : command;
  }
  return httpUrl;
}

function normalizeStoreItem(input: {
  key: string;
  cloud: McpCatalogEntryData | null;
  library: UserMcpLibraryItemData | null;
  custom: UserCustomMcpData | null;
}): McpStoreItem {
  if (input.custom) {
    const metadata = readObject(input.custom.metadata);
    const config = readObject(input.custom.config);
    const categories = parseCategories(metadata);
    const iconKey = inferIconKey(categories, input.key);
    const command = readCommand(config);
    const httpUrl = readHttpUrl(config);
    return {
      id: input.custom.id,
      mcpKey: input.custom.mcp_key,
      name: input.custom.name.trim() || titleizeMcpKey(input.custom.mcp_key),
      description: input.custom.description.trim() || '用户自定义 MCP，支持重装后恢复。',
      source: 'custom',
      sourceLabel: '自定义MCP',
      protocol: normalizeProtocol(input.custom.transport),
      installState: 'installed',
      defaultInstalled: false,
      installed: true,
      userInstalled: true,
      enabled: input.custom.enabled,
      canToggle: true,
      requiresApiKey: inferRequiresApiKey(config, metadata),
      categories,
      lastUpdated: readDateLabel(input.custom.updated_at),
      configSummary: buildConfigSummary(command, httpUrl, config),
      command,
      httpUrl,
      featured: false,
      iconKey,
      tone: inferTone(iconKey),
      metadata,
      setupSchema: null,
      setupStatus: input.custom.setup_status,
      setupSchemaVersion: input.custom.setup_schema_version,
      setupUpdatedAt: input.custom.setup_updated_at,
    };
  }
  const metadata = readObject(input.cloud?.metadata);
  const config = readObject(input.cloud?.config);
  const categories = parseCategories(metadata);
  const setupSchema = parseExtensionSetupSchema(metadata, config);
  const iconKey = inferIconKey(categories, input.key);
  const command = readCommand(config);
  const httpUrl = readHttpUrl(config);
  const defaultInstalled = input.cloud?.default_installed === true;
  const installed = defaultInstalled || Boolean(input.library);
  const source: McpStoreSource = 'cloud';

  return {
    id: input.key,
    mcpKey: input.key,
    name: input.cloud?.name?.trim() || titleizeMcpKey(input.key),
    description:
      input.cloud?.description?.trim() ||
      '来自云端目录的 MCP 连接，后续可按策略同步到本地运行时。',
    source,
    sourceLabel: defaultInstalled ? 'OEM预置' : resolveCloudSourceLabel(metadata),
    protocol: normalizeProtocol(input.cloud?.transport || null),
    installState: defaultInstalled ? 'bundled' : input.library ? 'installed' : 'available',
    defaultInstalled,
    installed,
    userInstalled: Boolean(input.library),
    enabled: defaultInstalled ? true : input.library?.enabled !== false,
    canToggle: Boolean(input.library),
    requiresApiKey: inferRequiresApiKey(config, metadata),
    categories,
    lastUpdated: readDateLabel(input.cloud?.updated_at || input.library?.updated_at || null),
    configSummary: buildConfigSummary(command, httpUrl, config),
    command,
    httpUrl,
    featured: readBoolean(metadata.featured) === true || readBoolean(metadata.official) === true || defaultInstalled,
    iconKey,
    tone: inferTone(iconKey),
    metadata,
    setupSchema,
    setupStatus: input.library?.setup_status || (setupSchema ? 'missing' : 'not_required'),
    setupSchemaVersion: input.library?.setup_schema_version ?? setupSchema?.version ?? null,
    setupUpdatedAt: input.library?.setup_updated_at ?? null,
  };
}

function compareMcpStoreItems(left: McpStoreItem, right: McpStoreItem): number {
  const score = (item: McpStoreItem) => {
    if (item.installState === 'bundled') return 0;
    if (item.installState === 'installed') return 1;
    return 2;
  };
  const scoreDiff = score(left) - score(right);
  if (scoreDiff !== 0) {
    return scoreDiff;
  }
  const leftTier = tierWeight(parseTier(left.metadata));
  const rightTier = tierWeight(parseTier(right.metadata));
  if (leftTier !== rightTier) {
    return leftTier - rightTier;
  }
  const leftOfficial = readBoolean(left.metadata.official) === true ? 0 : 1;
  const rightOfficial = readBoolean(right.metadata.official) === true ? 0 : 1;
  if (leftOfficial !== rightOfficial) {
    return leftOfficial - rightOfficial;
  }
  const leftFeatured = left.featured ? 0 : 1;
  const rightFeatured = right.featured ? 0 : 1;
  if (leftFeatured !== rightFeatured) {
    return leftFeatured - rightFeatured;
  }
  return left.name.localeCompare(right.name, 'zh-CN');
}

export async function loadMcpStoreCatalog(input: {
  client: IClawClient;
  accessToken: string | null;
  limit?: number;
  offset?: number;
}): Promise<McpStoreItem[]> {
  const [cloudPage, libraryItems, customItems] = await Promise.all([
    input.client.listMcpCatalogPage({ limit: input.limit ?? 200, offset: input.offset ?? 0 }),
    input.accessToken ? input.client.getMcpLibrary(input.accessToken).catch(() => []) : Promise.resolve([]),
    input.accessToken ? input.client.listCustomMcps(input.accessToken, BRAND.brandId).catch(() => []) : Promise.resolve([]),
  ]);

  const cloudByKey = new Map(cloudPage.items.map((item) => [item.mcp_key, item]));
  const libraryByKey = new Map(libraryItems.map((item) => [item.mcp_key, item]));
  const customByKey = new Map(customItems.map((item) => [item.mcp_key, item]));
  const keys = Array.from(new Set([...cloudByKey.keys(), ...libraryByKey.keys(), ...customByKey.keys()]));

  return keys
    .map((key) =>
      normalizeStoreItem({
        key,
        cloud: cloudByKey.get(key) || null,
        library: libraryByKey.get(key) || null,
        custom: customByKey.get(key) || null,
      }),
    )
    .sort(compareMcpStoreItems);
}

export async function installMcpFromStore(input: {
  client: IClawClient;
  accessToken: string | null;
  mcpKey: string;
  setupValues?: Record<string, unknown>;
  secretValues?: Record<string, string>;
}): Promise<UserMcpLibraryItemData> {
  if (!input.accessToken) {
    throw new Error('AUTH_REQUIRED');
  }
  return input.client.installMcp({
    token: input.accessToken,
    mcpKey: input.mcpKey,
    setupValues: input.setupValues,
    secretValues: input.secretValues,
  });
}

export async function loadMcpInstallConfig(input: {
  client: IClawClient;
  accessToken: string;
  mcpKey: string;
}): Promise<ExtensionInstallConfigSnapshot | null> {
  const record = await input.client.getExtensionInstallConfig(input.accessToken, 'mcp', input.mcpKey);
  if (!record) {
    return null;
  }
  return {
    setupValues: record.config_values || {},
    configuredSecretKeys: record.configured_secret_keys || [],
    status: record.status,
    schemaVersion: record.schema_version,
    updatedAt: record.updated_at,
  };
}

export async function saveMcpInstallConfig(input: {
  client: IClawClient;
  accessToken: string;
  mcpKey: string;
  setupValues?: Record<string, unknown>;
  secretValues?: Record<string, string>;
}): Promise<ExtensionInstallConfigSnapshot> {
  const record = await input.client.upsertExtensionInstallConfig({
    token: input.accessToken,
    extensionType: 'mcp',
    extensionKey: input.mcpKey,
    setupValues: input.setupValues,
    secretValues: input.secretValues,
  });
  return {
    setupValues: record.config_values || {},
    configuredSecretKeys: record.configured_secret_keys || [],
    status: record.status,
    schemaVersion: record.schema_version,
    updatedAt: record.updated_at,
  };
}

export async function updateMcpEnabledState(input: {
  client: IClawClient;
  accessToken: string | null;
  mcpKey: string;
  enabled: boolean;
}): Promise<UserMcpLibraryItemData> {
  if (!input.accessToken) {
    throw new Error('AUTH_REQUIRED');
  }
  return input.client.updateMcpLibraryItem({
    token: input.accessToken,
    mcpKey: input.mcpKey,
    enabled: input.enabled,
  });
}

export async function removeMcpFromLibrary(input: {
  client: IClawClient;
  accessToken: string | null;
  mcpKey: string;
}): Promise<{removed: boolean}> {
  if (!input.accessToken) {
    throw new Error('AUTH_REQUIRED');
  }
  return input.client.removeMcpFromLibrary(input.accessToken, input.mcpKey);
}

export async function saveCustomMcp(input: {
  client: IClawClient;
  accessToken: string | null;
  mcpKey: string;
  name: string;
  description?: string;
  transport: 'stdio' | 'http' | 'sse';
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  setupValues?: Record<string, unknown>;
  secretValues?: Record<string, string>;
}): Promise<UserCustomMcpData> {
  if (!input.accessToken) {
    throw new Error('AUTH_REQUIRED');
  }
  return input.client.upsertCustomMcp({
    token: input.accessToken,
    appName: BRAND.brandId,
    mcpKey: input.mcpKey,
    name: input.name,
    description: input.description,
    transport: input.transport,
    config: input.config,
    metadata: input.metadata,
    setupValues: input.setupValues,
    secretValues: input.secretValues,
  });
}

export async function removeCustomMcp(input: {
  client: IClawClient;
  accessToken: string | null;
  mcpKey: string;
}): Promise<{removed: boolean}> {
  if (!input.accessToken) {
    throw new Error('AUTH_REQUIRED');
  }
  return input.client.removeCustomMcp(input.accessToken, BRAND.brandId, input.mcpKey);
}
