import { invoke } from '@tauri-apps/api/core';
import type { IClawClient, McpCatalogEntryData, UserMcpLibraryItemData } from '@iclaw/sdk';
import bundledMcpConfig from '../../../src-tauri/resources/mcp/mcp.json';
import type {
  ExtensionInstallConfigSnapshot,
  ExtensionSetupSchema,
  ExtensionSetupStatus,
} from './extension-setup';
import {parseExtensionSetupSchema} from './extension-setup';

export type RawBundledMcpCatalogItem = {
  mcp_key: string;
  transport: string;
  enabled: boolean;
  command?: string | null;
  args?: string[];
  http_url?: string | null;
  config?: Record<string, unknown>;
};

export type McpStoreProtocol = 'STDIO' | 'HTTP' | 'SSE';
export type McpStoreSource = 'bundled' | 'cloud';
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

type RawBundledMcpConfigFile = {
  mcpServers?: Record<string, {
    type?: string;
    enabled?: boolean;
    command?: string;
    args?: string[];
    httpUrl?: string;
    url?: string;
    env?: Record<string, string>;
  }>;
};

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

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

function normalizeBundledTransport(config: Record<string, unknown>): string {
  const explicit = readString(config.type);
  if (explicit) {
    return explicit;
  }
  if (readString(config.httpUrl) || readString(config.url)) {
    return 'http';
  }
  return 'stdio';
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

function readCommand(config: Record<string, unknown>, bundled?: RawBundledMcpCatalogItem | null): string | null {
  if (bundled?.command?.trim()) {
    return bundled.command.trim();
  }
  return readString(config.command);
}

function readHttpUrl(config: Record<string, unknown>, bundled?: RawBundledMcpCatalogItem | null): string | null {
  if (bundled?.http_url?.trim()) {
    return bundled.http_url.trim();
  }
  return readString(config.httpUrl) || readString(config.url);
}

function buildConfigSummary(command: string | null, httpUrl: string | null, bundled?: RawBundledMcpCatalogItem | null): string | null {
  if (command) {
    const args = bundled?.args?.filter(Boolean).join(' ') || '';
    return args ? `${command} ${args}`.trim() : command;
  }
  return httpUrl;
}

function normalizeStoreItem(input: {
  key: string;
  bundled: RawBundledMcpCatalogItem | null;
  cloud: McpCatalogEntryData | null;
  library: UserMcpLibraryItemData | null;
}): McpStoreItem {
  const metadata = readObject(input.cloud?.metadata);
  const config = {
    ...readObject(input.cloud?.config),
    ...readObject(input.bundled?.config),
  };
  const categories = parseCategories(metadata);
  const setupSchema = parseExtensionSetupSchema(metadata, config);
  const iconKey = inferIconKey(categories, input.key);
  const command = readCommand(config, input.bundled);
  const httpUrl = readHttpUrl(config, input.bundled);
  const defaultInstalled = input.cloud?.default_installed === true;
  const installed = defaultInstalled || Boolean(input.library);
  const source: McpStoreSource = input.bundled && !input.cloud ? 'bundled' : 'cloud';

  return {
    id: input.key,
    mcpKey: input.key,
    name: input.cloud?.name?.trim() || titleizeMcpKey(input.key),
    description:
      input.cloud?.description?.trim() ||
      (input.bundled ? '当前桌面端预置的 MCP 连接，可直接作为默认能力接入。' : '来自云端目录的 MCP 连接，后续可按策略同步到本地运行时。'),
    source,
    sourceLabel: defaultInstalled ? 'OEM预置' : resolveCloudSourceLabel(metadata),
    protocol: normalizeProtocol(input.cloud?.transport || input.bundled?.transport || null),
    installState: defaultInstalled ? 'bundled' : input.library ? 'installed' : 'available',
    defaultInstalled,
    installed,
    userInstalled: Boolean(input.library),
    enabled: defaultInstalled ? true : input.library?.enabled !== false,
    canToggle: Boolean(input.library),
    requiresApiKey: inferRequiresApiKey(config, metadata),
    categories,
    lastUpdated: readDateLabel(input.cloud?.updated_at || input.library?.updated_at || null),
    configSummary: buildConfigSummary(command, httpUrl, input.bundled),
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

function fallbackBundledMcpCatalog(): RawBundledMcpCatalogItem[] {
  const source = bundledMcpConfig as RawBundledMcpConfigFile;
  const servers = source.mcpServers || {};
  return Object.entries(servers)
    .map(([mcpKey, value]) => ({
      mcp_key: mcpKey,
      transport: normalizeBundledTransport(readObject(value)),
      enabled: value?.enabled !== false,
      command: readString(value?.command),
      args: Array.isArray(value?.args) ? value.args.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
      http_url: readString(value?.httpUrl) || readString(value?.url),
      config: readObject(value),
    }))
    .sort((left, right) => left.mcp_key.localeCompare(right.mcp_key, 'zh-CN'));
}

export async function loadBundledMcpCatalog(): Promise<RawBundledMcpCatalogItem[]> {
  if (!isTauriRuntime()) {
    return fallbackBundledMcpCatalog();
  }
  try {
    return await invoke<RawBundledMcpCatalogItem[]>('load_bundled_mcp_catalog');
  } catch {
    return fallbackBundledMcpCatalog();
  }
}

export async function loadMcpStoreCatalog(input: {
  client: IClawClient;
  accessToken: string | null;
  limit?: number;
  offset?: number;
}): Promise<McpStoreItem[]> {
  const [bundledItems, cloudPage, libraryItems] = await Promise.all([
    input.offset && input.offset > 0 ? Promise.resolve([]) : loadBundledMcpCatalog().catch(() => []),
    input.client.listMcpCatalogPage({ limit: input.limit ?? 200, offset: input.offset ?? 0 }),
    input.accessToken ? input.client.getMcpLibrary(input.accessToken).catch(() => []) : Promise.resolve([]),
  ]);

  const bundledByKey = new Map(bundledItems.map((item) => [item.mcp_key, item]));
  const cloudByKey = new Map(cloudPage.items.map((item) => [item.mcp_key, item]));
  const libraryByKey = new Map(libraryItems.map((item) => [item.mcp_key, item]));
  const keys = Array.from(new Set([...bundledByKey.keys(), ...cloudByKey.keys(), ...libraryByKey.keys()]));

  return keys
    .map((key) =>
      normalizeStoreItem({
        key,
        bundled: bundledByKey.get(key) || null,
        cloud: cloudByKey.get(key) || null,
        library: libraryByKey.get(key) || null,
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
