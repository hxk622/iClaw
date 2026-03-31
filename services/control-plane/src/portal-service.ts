import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import type {PublicUser} from './domain.ts';
import {HttpError} from './errors.ts';
import {logWarn} from './logger.ts';
import {
  deletePortalDesktopReleaseFile,
  downloadPortalDesktopReleaseFile,
  uploadPortalDesktopReleaseFile,
} from './portal-desktop-release-storage.ts';
import {
  buildPortalDesktopReleaseManifestPayload,
  normalizeDesktopReleaseArch,
  normalizeDesktopReleaseChannel,
  normalizeDesktopReleasePlatform,
  readPortalDesktopReleaseConfig,
  resolvePortalDesktopReleaseDownloadFile,
  upsertPortalDesktopReleaseTarget,
  validatePortalDesktopReleaseVersion,
  writePortalDesktopReleaseConfig,
} from './portal-desktop-release.ts';
import {deletePortalAssetFile, downloadPortalAssetFile, uploadPortalAssetFile} from './portal-asset-storage.ts';
import {mergePlatformMcpBindings, mergePlatformSkillBindings} from './platform-inheritance.ts';
import type {KeyValueCache} from './cache.ts';
import type {
  PortalAppModelProviderMode,
  PortalAppDetail,
  PortalAppRecord,
  PortalAppStatus,
  PortalJsonObject,
  PortalMemoryEmbeddingProfileRecord,
  PortalPresetManifest,
  PortalModelProviderScopeType,
  ReplacePortalAppComposerControlBindingsInput,
  ReplacePortalAppComposerShortcutBindingsInput,
  ReplacePortalAppModelBindingsInput,
  ReplacePortalAppMcpBindingsInput,
  ReplacePortalAppMenuBindingsInput,
  ReplacePortalAppSkillBindingsInput,
  UpsertPortalAppInput,
  UpsertPortalAppModelRuntimeOverrideInput,
  UpsertPortalModelInput,
  ValidatePortalMemoryEmbeddingProfileInput,
  UpsertPortalMemoryEmbeddingProfileInput,
  UpsertPortalModelProviderProfileInput,
  UpsertPortalMenuInput,
  UpsertPortalMcpInput,
  UpsertPortalSkillInput,
} from './portal-domain.ts';
import {syncPortalPresetManifest} from './portal-preset.ts';
import {buildPortalPublicConfig} from './portal-runtime.ts';
import type {PgPortalStore} from './portal-store.ts';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultPortalPresetManifestPath = resolve(moduleDir, '../presets/core-oem.json');

function rolePriority(role: 'user' | 'admin' | 'super_admin'): number {
  switch (role) {
    case 'super_admin':
      return 3;
    case 'admin':
      return 2;
    default:
      return 1;
  }
}

function normalizePersistedPortalAssetUrl(rawValue: string | null | undefined, baseUrl: string): string | null {
  const raw = (rawValue || '').trim();
  if (!raw) {
    return null;
  }
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const localPrefixes = [
    'http://127.0.0.1:2130',
    'http://localhost:2130',
    'http://127.0.0.1',
    'http://localhost',
  ];
  const matchedPrefix = localPrefixes.find((prefix) => raw.startsWith(prefix));
  if (!matchedPrefix) {
    return raw;
  }
  return `${normalizedBase}${raw.slice(matchedPrefix.length)}`;
}

function asObject(value: unknown): PortalJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as PortalJsonObject;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function applyResolvedRuntimeModelsToConfig(
  config: PortalJsonObject,
  resolved: {
    providerMode: PortalAppModelProviderMode;
    resolvedScope: PortalModelProviderScopeType;
    version: number;
    profile: {
      id: string;
      scopeType: PortalModelProviderScopeType;
      scopeKey: string;
      providerKey: string;
      providerLabel: string;
      apiProtocol: string;
      baseUrl: string;
      authMode: string;
      apiKey?: string;
      logoPresetKey: string | null;
      metadata: PortalJsonObject;
      enabled: boolean;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    };
    models: Array<{
      id: string;
      modelRef: string;
      modelId: string;
      label: string;
      logoPresetKey: string | null;
      billingMultiplier: number;
      reasoning: boolean;
      inputModalities: string[];
      contextWindow: number | null;
      maxTokens: number | null;
      enabled: boolean;
      sortOrder: number;
      metadata: PortalJsonObject;
      createdAt: string;
      updatedAt: string;
    }>;
  },
  options: {includeSecrets?: boolean} = {},
): PortalJsonObject {
  const nextConfig = cloneJson(config);
  const capabilities = asObject(nextConfig.capabilities);
  if (Object.prototype.hasOwnProperty.call(capabilities, 'models')) {
    delete capabilities.models;
  }
  nextConfig.capabilities = capabilities;
  nextConfig.model_provider = {
    provider_mode: resolved.providerMode,
    resolved_scope: resolved.resolvedScope,
    version: resolved.version,
    profile: {
      id: resolved.profile.id,
      scope_type: resolved.profile.scopeType,
      scope_key: resolved.profile.scopeKey,
      provider_key: resolved.profile.providerKey,
      provider_label: resolved.profile.providerLabel,
      api_protocol: resolved.profile.apiProtocol,
      base_url: resolved.profile.baseUrl,
      auth_mode: resolved.profile.authMode,
      logo_preset_key: resolved.profile.logoPresetKey,
      metadata: cloneJson(resolved.profile.metadata),
      enabled: resolved.profile.enabled,
      sort_order: resolved.profile.sortOrder,
      created_at: resolved.profile.createdAt,
      updated_at: resolved.profile.updatedAt,
      ...(options.includeSecrets ? {api_key: resolved.profile.apiKey || ''} : {}),
    },
    models: resolved.models.map((model) => ({
      id: model.id,
      model_ref: model.modelRef,
      model_id: model.modelId,
      label: model.label,
      logo_preset_key: model.logoPresetKey,
      billing_multiplier: model.billingMultiplier,
      reasoning: model.reasoning,
      input_modalities: cloneJson(model.inputModalities),
      context_window: model.contextWindow,
      max_tokens: model.maxTokens,
      enabled: model.enabled,
      sort_order: model.sortOrder,
      metadata: cloneJson(model.metadata),
      created_at: model.createdAt,
      updated_at: model.updatedAt,
    })),
  };
  return nextConfig;
}

function applyResolvedMemoryEmbeddingToConfig(
  config: PortalJsonObject,
  resolved: {
    resolvedScope: PortalModelProviderScopeType;
    version: number;
    profile: PortalMemoryEmbeddingProfileRecord;
  } | null,
  options: {includeSecrets?: boolean} = {},
): PortalJsonObject {
  const nextConfig = cloneJson(config);
  if (!resolved) {
    delete nextConfig.memory_embedding;
    return nextConfig;
  }
  nextConfig.memory_embedding = {
    resolved_scope: resolved.resolvedScope,
    version: resolved.version,
    profile: {
      id: resolved.profile.id,
      scope_type: resolved.profile.scopeType,
      scope_key: resolved.profile.scopeKey,
      provider_key: resolved.profile.providerKey,
      provider_label: resolved.profile.providerLabel,
      base_url: resolved.profile.baseUrl,
      auth_mode: resolved.profile.authMode,
      embedding_model: resolved.profile.embeddingModel,
      logo_preset_key: resolved.profile.logoPresetKey,
      auto_recall: resolved.profile.autoRecall,
      metadata: cloneJson(resolved.profile.metadata),
      enabled: resolved.profile.enabled,
      created_at: resolved.profile.createdAt,
      updated_at: resolved.profile.updatedAt,
      ...(options.includeSecrets ? {api_key: resolved.profile.apiKey || ''} : {}),
    },
  };
  return nextConfig;
}

function normalizeRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', `${field} is required`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} is required`);
  }
  return normalized;
}

function normalizeOptionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a string`);
  }
  const normalized = value.trim();
  return normalized || null;
}

function normalizeOptionalBoolean(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a boolean`);
  }
  return value;
}

function normalizeOptionalInteger(value: unknown, field: string, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be an integer`);
  }
  return value;
}

function joinOpenaiCompatiblePath(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function normalizeNullableInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be an integer`);
  }
  return value;
}

function normalizeOptionalPositiveNumber(value: unknown, field: string, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a positive number`);
  }
  return value;
}

function parseRequiredBase64(value: unknown, field: string): Buffer {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} is required`);
  }
  try {
    const buffer = Buffer.from(value.trim(), 'base64');
    if (buffer.length === 0) {
      throw new Error('empty');
    }
    return buffer;
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be valid base64`);
  }
}

function normalizeAppName(value: unknown): string {
  const normalized = normalizeRequiredString(value, 'app_name').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(normalized)) {
    throw new HttpError(400, 'BAD_REQUEST', 'app_name must be 2-63 chars and use lowercase letters, numbers, hyphen');
  }
  return normalized;
}

function normalizeModelRef(value: unknown): string {
  const normalized = normalizeRequiredString(value, 'ref');
  if (!/^[a-z0-9][a-z0-9._-]{0,62}\/[A-Za-z0-9][A-Za-z0-9._:\/-]{0,255}$/.test(normalized)) {
    throw new HttpError(400, 'BAD_REQUEST', 'ref must use provider/model format with provider prefix');
  }
  return normalized;
}

function buildProviderModelRef(providerKey: string, modelId: string): string {
  return normalizeModelRef(`${providerKey}/${modelId}`);
}

function normalizeMenuKey(value: unknown): string {
  const normalized = normalizeRequiredString(value, 'menu_key').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(normalized)) {
    throw new HttpError(400, 'BAD_REQUEST', 'menu_key must be 2-63 chars and use lowercase letters, numbers, hyphen');
  }
  return normalized;
}

function normalizeStatus(value: unknown, fallback: PortalAppStatus = 'active'): PortalAppStatus {
  if (value === undefined || value === null) return fallback;
  if (value === 'active' || value === 'disabled') return value;
  throw new HttpError(400, 'BAD_REQUEST', 'status must be active or disabled');
}

function normalizeProviderScopeType(value: unknown): PortalModelProviderScopeType | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (value === 'platform' || value === 'app') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'scope_type must be platform or app');
}

function normalizeRequiredProviderScopeType(value: unknown): PortalModelProviderScopeType {
  const normalized = normalizeProviderScopeType(value);
  if (!normalized) {
    throw new HttpError(400, 'BAD_REQUEST', 'scope_type is required');
  }
  return normalized;
}

function normalizeProviderMode(value: unknown): PortalAppModelProviderMode {
  if (value === undefined || value === null || value === '') {
    return 'inherit_platform';
  }
  if (value === 'inherit_platform' || value === 'use_app_profile') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'provider_mode must be inherit_platform or use_app_profile');
}

function runtimeModelCacheKey(appName: string): string {
  return `portal:runtime:models:${appName}`;
}

function runtimeMemoryEmbeddingCacheKey(appName: string): string {
  return `portal:runtime:memory-embedding:${appName}`;
}

function normalizeBindingConfig(value: unknown): PortalJsonObject {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'config must be an object');
  }
  return value as PortalJsonObject;
}

function normalizeDesktopReleaseArtifactType(value: unknown): 'installer' | 'updater' | 'signature' {
  const normalized = normalizeRequiredString(value, 'artifact_type').toLowerCase();
  if (normalized === 'installer' || normalized === 'updater' || normalized === 'signature') {
    return normalized;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'artifact_type must be installer, updater, or signature');
}

export class PortalService {
  private readonly store: PgPortalStore;
  private readonly authResolver: (accessToken: string) => Promise<PublicUser>;
  private readonly cache: KeyValueCache | null;

  constructor(store: PgPortalStore, authResolver: (accessToken: string) => Promise<PublicUser>, options?: {cache?: KeyValueCache | null}) {
    this.store = store;
    this.authResolver = authResolver;
    this.cache = options?.cache || null;
  }

  async listApps(accessToken: string) {
    await this.requireAdmin(accessToken);
    return {items: await this.store.listApps()};
  }

  async syncPresetManifest(
    accessToken: string,
    input: {
      manifestPath?: string | null;
      forceAppState?: boolean;
      manifest_path?: string | null;
      force_app_state?: boolean;
    } = {},
  ) {
    await this.requireAdmin(accessToken);
    const manifestPath =
      normalizeOptionalString(input.manifestPath ?? input.manifest_path, 'manifest_path') || defaultPortalPresetManifestPath;
    const forceAppState = input.forceAppState === true || input.force_app_state === true;
    let raw: PortalPresetManifest;
    try {
      raw = JSON.parse(await readFile(manifestPath, 'utf8')) as PortalPresetManifest;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown read error';
      throw new HttpError(500, 'PRESET_SYNC_READ_FAILED', `failed to read preset manifest: ${message}`);
    }
    if (raw.schemaVersion !== 1) {
      throw new HttpError(400, 'PRESET_SYNC_UNSUPPORTED_SCHEMA', `unsupported preset schema version: ${String(raw.schemaVersion ?? '')}`);
    }

    await syncPortalPresetManifest(this.store, raw, {
      manifestDir: dirname(manifestPath),
      preserveExistingAppState: !forceAppState,
    });
    await this.invalidateAllRuntimeModelCaches();
    await this.invalidateAllMemoryEmbeddingCaches();

    return {
      ok: true,
      manifestPath,
      preserveExistingAppState: !forceAppState,
      appCount: Array.isArray(raw.apps) ? raw.apps.length : 0,
      skillCount: Array.isArray(raw.skills) ? raw.skills.length : 0,
      mcpCount: Array.isArray(raw.mcps) ? raw.mcps.length : 0,
      modelCount: Array.isArray(raw.models) ? raw.models.length : 0,
      menuCount: Array.isArray(raw.menus) ? raw.menus.length : 0,
      composerControlCount: Array.isArray(raw.composerControls) ? raw.composerControls.length : 0,
      composerShortcutCount: Array.isArray(raw.composerShortcuts) ? raw.composerShortcuts.length : 0,
      assetCount: Array.isArray(raw.assets) ? raw.assets.length : 0,
    };
  }

  async getApp(accessToken: string, appNameInput: string) {
    await this.requireAdmin(accessToken);
    const detail = await this.store.getAppDetail(normalizeAppName(appNameInput));
    if (!detail) {
      throw new HttpError(404, 'NOT_FOUND', 'portal app not found');
    }
    return detail;
  }

  async upsertApp(accessToken: string, input: UpsertPortalAppInput) {
    const actor = await this.requireAdmin(accessToken);
    const legacyInput = input as UpsertPortalAppInput & {
      display_name?: unknown;
      default_locale?: unknown;
    };
    return this.store.upsertApp({
      appName: normalizeAppName(input.appName),
      displayName: normalizeRequiredString(input.displayName ?? legacyInput.display_name, 'display_name'),
      description: normalizeOptionalString(input.description, 'description'),
      status: normalizeStatus(input.status),
      defaultLocale: normalizeOptionalString(input.defaultLocale ?? legacyInput.default_locale, 'default_locale') || 'zh-CN',
      config: asObject(input.config),
    }, actor.id);
  }

  async listSkills(accessToken: string) {
    await this.requireAdmin(accessToken);
    return {items: await this.store.listSkills()};
  }

  async listMenus(accessToken: string) {
    await this.requireAdmin(accessToken);
    return {items: await this.store.listMenus()};
  }

  async listComposerControls(accessToken: string) {
    await this.requireAdmin(accessToken);
    return {items: await this.store.listComposerControls()};
  }

  async listComposerShortcuts(accessToken: string) {
    await this.requireAdmin(accessToken);
    return {items: await this.store.listComposerShortcuts()};
  }

  async upsertMenu(accessToken: string, input: UpsertPortalMenuInput) {
    await this.requireAdmin(accessToken);
    return this.store.upsertMenu({
      menuKey: normalizeMenuKey(input.menuKey),
      displayName: normalizeRequiredString(input.displayName, 'display_name'),
      category: normalizeOptionalString(input.category, 'category'),
      routeKey: normalizeOptionalString(input.routeKey, 'route_key'),
      iconKey: normalizeOptionalString(input.iconKey, 'icon_key'),
      metadata: asObject(input.metadata),
      active: normalizeOptionalBoolean(input.active, 'active', true),
    });
  }

  async upsertSkill(accessToken: string, input: UpsertPortalSkillInput) {
    await this.requireAdmin(accessToken);
    const slug = normalizeRequiredString(input.slug, 'slug');
    return this.store.upsertSkill({
      slug,
      name: normalizeOptionalString(input.name, 'name') || slug,
      description: normalizeOptionalString(input.description, 'description') || slug,
      category: normalizeOptionalString(input.category, 'category'),
      publisher: normalizeOptionalString(input.publisher, 'publisher') || 'iClaw',
      objectKey: null,
      contentSha256: null,
      metadata: asObject(input.metadata),
      active: normalizeOptionalBoolean(input.active, 'active', true),
    });
  }

  async deleteSkill(accessToken: string, slugInput: string) {
    await this.requireAdmin(accessToken);
    const slug = normalizeRequiredString(slugInput, 'slug');
    await this.store.deleteSkill(slug);
    return {slug};
  }

  async listMcps(accessToken: string) {
    await this.requireAdmin(accessToken);
    return {items: await this.store.listMcps()};
  }

  async listModels(accessToken: string) {
    await this.requireAdmin(accessToken);
    return {items: await this.store.listModels()};
  }

  async listModelProviderProfiles(
    accessToken: string,
    input?: {
      scopeType?: string | null;
      scopeKey?: string | null;
    },
  ) {
    await this.requireAdmin(accessToken);
    return {
      items: await this.store.listModelProviderProfiles(
        normalizeProviderScopeType(input?.scopeType),
        normalizeOptionalString(input?.scopeKey, 'scope_key'),
      ),
    };
  }

  async upsertMcp(accessToken: string, input: UpsertPortalMcpInput) {
    await this.requireAdmin(accessToken);
    return this.store.upsertMcp({
      mcpKey: normalizeRequiredString(input.mcpKey, 'mcp_key'),
      name: normalizeOptionalString(input.name, 'name') || '',
      description: normalizeOptionalString(input.description, 'description') || '',
      transport: normalizeOptionalString(input.transport, 'transport') || 'config',
      objectKey: normalizeOptionalString(input.objectKey, 'object_key'),
      config: asObject(input.config),
      metadata: asObject(input.metadata),
      active: normalizeOptionalBoolean(input.active, 'active', true),
    });
  }

  async upsertModel(accessToken: string, input: UpsertPortalModelInput) {
    await this.requireAdmin(accessToken);
    return this.store.upsertModel({
      ref: normalizeModelRef(input.ref),
      label: normalizeRequiredString(input.label, 'label'),
      providerId: normalizeRequiredString(input.providerId, 'provider_id'),
      modelId: normalizeRequiredString(input.modelId, 'model_id'),
      api: normalizeRequiredString(input.api, 'api'),
      baseUrl: normalizeOptionalString(input.baseUrl, 'base_url'),
      useRuntimeOpenai: normalizeOptionalBoolean(input.useRuntimeOpenai, 'use_runtime_openai', true),
      authHeader: normalizeOptionalBoolean(input.authHeader, 'auth_header', true),
      reasoning: normalizeOptionalBoolean(input.reasoning, 'reasoning', false),
      input: asArray(input.input).map((entry, index) => normalizeRequiredString(entry, `input[${index}]`)),
      contextWindow: normalizeOptionalInteger(input.contextWindow, 'context_window', 0),
      maxTokens: normalizeOptionalInteger(input.maxTokens, 'max_tokens', 0),
      metadata: asObject(input.metadata),
      active: normalizeOptionalBoolean(input.active, 'active', true),
    });
  }

  async upsertModelProviderProfile(accessToken: string, input: UpsertPortalModelProviderProfileInput) {
    await this.requireAdmin(accessToken);
    const scopeType = normalizeRequiredProviderScopeType(input.scopeType);
    const providerKey = normalizeRequiredString(input.providerKey, 'provider_key');
    const profile = await this.store.upsertModelProviderProfile({
      id: normalizeOptionalString(input.id, 'id'),
      scopeType,
      scopeKey: scopeType === 'platform' ? 'platform' : normalizeAppName(input.scopeKey),
      providerKey,
      providerLabel: normalizeRequiredString(input.providerLabel, 'provider_label'),
      apiProtocol: normalizeRequiredString(input.apiProtocol, 'api_protocol'),
      baseUrl: normalizeRequiredString(input.baseUrl, 'base_url'),
      authMode: normalizeOptionalString(input.authMode, 'auth_mode') || 'bearer',
      apiKey: normalizeRequiredString(input.apiKey, 'api_key'),
      logoPresetKey: normalizeOptionalString(input.logoPresetKey, 'logo_preset_key'),
      metadata: asObject(input.metadata),
      enabled: normalizeOptionalBoolean(input.enabled, 'enabled', true),
      sortOrder: normalizeOptionalInteger(input.sortOrder, 'sort_order', 100),
      models: asArray(input.models).map((item, index) => {
        const value = asObject(item);
        const modelId = normalizeRequiredString(value.modelId ?? value.model_id, `models[${index}].model_id`);
        const explicitModelRef = normalizeOptionalString(value.modelRef ?? value.model_ref, `models[${index}].model_ref`);
        return {
          id: normalizeOptionalString(value.id, `models[${index}].id`),
          modelRef: explicitModelRef ? normalizeModelRef(explicitModelRef) : buildProviderModelRef(providerKey, modelId),
          modelId,
          label: normalizeRequiredString(value.label, `models[${index}].label`),
          logoPresetKey: normalizeOptionalString(value.logoPresetKey ?? value.logo_preset_key, `models[${index}].logo_preset_key`),
          billingMultiplier: normalizeOptionalPositiveNumber(
            value.billingMultiplier ?? value.billing_multiplier,
            `models[${index}].billing_multiplier`,
            1,
          ),
          reasoning: normalizeOptionalBoolean(value.reasoning, `models[${index}].reasoning`, false),
          inputModalities: asArray(value.inputModalities ?? value.input_modalities).map((entry) =>
            normalizeRequiredString(entry, `models[${index}].input_modalities[]`),
          ),
          contextWindow: normalizeNullableInteger(value.contextWindow ?? value.context_window, `models[${index}].context_window`),
          maxTokens: normalizeNullableInteger(value.maxTokens ?? value.max_tokens, `models[${index}].max_tokens`),
          enabled: normalizeOptionalBoolean(value.enabled, `models[${index}].enabled`, true),
          sortOrder: normalizeOptionalInteger(value.sortOrder ?? value.sort_order, `models[${index}].sort_order`, 100),
          metadata: asObject(value.metadata),
        };
      }),
    });
    await this.invalidateRuntimeModelCachesForScope(profile.scopeType, profile.scopeKey);
    return profile;
  }

  async deleteModelProviderProfile(accessToken: string, profileIdInput: string) {
    await this.requireAdmin(accessToken);
    const profileId = normalizeRequiredString(profileIdInput, 'id');
    const existing = await this.store.getModelProviderProfile(profileId);
    await this.store.deleteModelProviderProfile(profileId);
    if (existing) {
      await this.invalidateRuntimeModelCachesForScope(existing.scopeType, existing.scopeKey);
    }
    return {id: profileId};
  }

  async listMemoryEmbeddingProfiles(
    accessToken: string,
    input?: {
      scopeType?: string | null;
      scopeKey?: string | null;
    },
  ) {
    await this.requireAdmin(accessToken);
    return {
      items: await this.store.listMemoryEmbeddingProfiles(
        normalizeProviderScopeType(input?.scopeType),
        normalizeOptionalString(input?.scopeKey, 'scope_key'),
      ),
    };
  }

  async upsertMemoryEmbeddingProfile(accessToken: string, input: UpsertPortalMemoryEmbeddingProfileInput) {
    await this.requireAdmin(accessToken);
    const scopeType = normalizeRequiredProviderScopeType(input.scopeType);
    const profile = await this.store.upsertMemoryEmbeddingProfile({
      id: normalizeOptionalString(input.id, 'id'),
      scopeType,
      scopeKey: scopeType === 'platform' ? 'platform' : normalizeAppName(input.scopeKey),
      providerKey: normalizeRequiredString(input.providerKey, 'provider_key'),
      providerLabel: normalizeRequiredString(input.providerLabel, 'provider_label'),
      baseUrl: normalizeRequiredString(input.baseUrl, 'base_url'),
      authMode: normalizeOptionalString(input.authMode, 'auth_mode') || 'bearer',
      apiKey: normalizeRequiredString(input.apiKey, 'api_key'),
      embeddingModel: normalizeRequiredString(input.embeddingModel, 'embedding_model'),
      logoPresetKey: normalizeOptionalString(input.logoPresetKey, 'logo_preset_key'),
      autoRecall: normalizeOptionalBoolean(input.autoRecall, 'auto_recall', true),
      metadata: asObject(input.metadata),
      enabled: normalizeOptionalBoolean(input.enabled, 'enabled', true),
    });
    await this.invalidateMemoryEmbeddingCachesForScope(profile.scopeType, profile.scopeKey);
    return profile;
  }

  async validateMemoryEmbeddingProfile(accessToken: string, input: ValidatePortalMemoryEmbeddingProfileInput) {
    await this.requireAdmin(accessToken);
    const providerKey = normalizeRequiredString(input.providerKey, 'provider_key');
    const baseUrl = normalizeRequiredString(input.baseUrl, 'base_url');
    const authMode = normalizeOptionalString(input.authMode, 'auth_mode') || 'bearer';
    const apiKey = normalizeRequiredString(input.apiKey, 'api_key');
    const embeddingModel = normalizeRequiredString(input.embeddingModel, 'embedding_model');
    const requestUrl = joinOpenaiCompatiblePath(baseUrl, '/embeddings');

    let response: Response;
    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      let finalUrl = requestUrl;
      if (authMode === 'query') {
        const url = new URL(requestUrl);
        url.searchParams.set('api_key', apiKey);
        finalUrl = url.toString();
      } else {
        headers.authorization = `Bearer ${apiKey}`;
      }
      response = await fetch(finalUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: embeddingModel,
          input: 'ping',
        }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown network error';
      throw new HttpError(502, 'MEMORY_EMBEDDING_PREFLIGHT_FAILED', `memory embedding preflight failed: ${message}`);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiMessage =
        typeof (payload as {error?: {message?: unknown}})?.error?.message === 'string'
          ? String((payload as {error?: {message?: string}}).error?.message || '').trim()
          : '';
      throw new HttpError(
        400,
        'MEMORY_EMBEDDING_PREFLIGHT_FAILED',
        apiMessage || `memory embedding preflight failed with status ${response.status}`,
      );
    }

    const data = Array.isArray((payload as {data?: unknown[]}).data) ? ((payload as {data?: unknown[]}).data ?? []) : [];
    const firstItem = data.length > 0 ? data[0] : null;
    const first = firstItem && typeof firstItem === 'object' ? (firstItem as Record<string, unknown>) : {};
    const embedding = Array.isArray(first.embedding) ? first.embedding : [];
    return {
      ok: true,
      providerKey,
      embeddingModel,
      dimensions: embedding.length || null,
    };
  }

  async deleteMemoryEmbeddingProfile(accessToken: string, profileIdInput: string) {
    await this.requireAdmin(accessToken);
    const profileId = normalizeRequiredString(profileIdInput, 'id');
    const existing = await this.store.getMemoryEmbeddingProfile(profileId);
    await this.store.deleteMemoryEmbeddingProfile(profileId);
    if (existing) {
      await this.invalidateMemoryEmbeddingCachesForScope(existing.scopeType, existing.scopeKey);
    }
    return {id: profileId};
  }

  async getAppModelRuntimeOverride(accessToken: string, appNameInput: string) {
    await this.requireAdmin(accessToken);
    return this.store.getAppModelRuntimeOverride(normalizeAppName(appNameInput));
  }

  async upsertAppModelRuntimeOverride(accessToken: string, input: UpsertPortalAppModelRuntimeOverrideInput) {
    await this.requireAdmin(accessToken);
    const appName = normalizeAppName(input.appName);
    const providerMode = normalizeProviderMode(input.providerMode);
    const record = await this.store.upsertAppModelRuntimeOverride({
      appName,
      providerMode,
      activeProfileId: providerMode === 'use_app_profile' ? normalizeOptionalString(input.activeProfileId, 'active_profile_id') : null,
      cacheVersion: normalizeOptionalInteger(input.cacheVersion, 'cache_version', Date.now()),
    });
    await this.invalidateRuntimeModelCache(appName);
    return record;
  }

  async getResolvedRuntimeModels(appNameInput: string) {
    const appName = normalizeAppName(appNameInput);
    const cacheKey = runtimeModelCacheKey(appName);
    const cached = await this.cache?.get<{
      appName: string;
      providerMode: PortalAppModelProviderMode;
      resolvedScope: PortalModelProviderScopeType;
      profile: Record<string, unknown>;
      models: unknown[];
      version: number;
    }>(cacheKey);
    if (cached) {
      return cached;
    }
    const resolved = await this.store.resolveRuntimeModels(appName);
    if (!resolved) {
      throw new HttpError(404, 'NOT_FOUND', 'runtime models not found');
    }
    const publicPayload = {
      appName: resolved.appName,
      providerMode: resolved.providerMode,
      resolvedScope: resolved.resolvedScope,
      profile: {
        id: resolved.profile.id,
        scopeType: resolved.profile.scopeType,
        scopeKey: resolved.profile.scopeKey,
        providerKey: resolved.profile.providerKey,
        providerLabel: resolved.profile.providerLabel,
        apiProtocol: resolved.profile.apiProtocol,
        baseUrl: resolved.profile.baseUrl,
        authMode: resolved.profile.authMode,
        logoPresetKey: resolved.profile.logoPresetKey,
        metadata: resolved.profile.metadata,
        enabled: resolved.profile.enabled,
        sortOrder: resolved.profile.sortOrder,
        createdAt: resolved.profile.createdAt,
        updatedAt: resolved.profile.updatedAt,
      },
      models: resolved.models,
      version: resolved.version,
    };
    await this.cache?.set(cacheKey, publicPayload, 600);
    return publicPayload;
  }

  async getResolvedMemoryEmbedding(appNameInput: string) {
    const appName = normalizeAppName(appNameInput);
    const cacheKey = runtimeMemoryEmbeddingCacheKey(appName);
    const cached = await this.cache?.get<{
      appName: string;
      resolvedScope: PortalModelProviderScopeType;
      profile: PortalMemoryEmbeddingProfileRecord;
      version: number;
    }>(cacheKey);
    if (cached) {
      return cached;
    }
    const resolved = await this.store.resolveMemoryEmbedding(appName);
    if (!resolved) {
      throw new HttpError(404, 'NOT_FOUND', 'memory embedding not found');
    }
    await this.cache?.set(cacheKey, resolved, 600);
    return resolved;
  }

  async getPrivateRuntimeConfig(
    accessToken: string,
    appNameInput: string,
    baseUrl: string,
    input: {surfaceKey?: string | null} = {},
  ) {
    await this.authResolver(accessToken);
    return this.buildResolvedRuntimeConfig(appNameInput, baseUrl, input, {includeSecrets: true});
  }

  async deleteMcp(accessToken: string, mcpKeyInput: string) {
    await this.requireAdmin(accessToken);
    const mcpKey = normalizeRequiredString(mcpKeyInput, 'mcp_key');
    await this.store.deleteMcp(mcpKey);
    return {mcpKey};
  }

  async deleteModel(accessToken: string, refInput: string) {
    await this.requireAdmin(accessToken);
    const ref = normalizeModelRef(refInput);
    await this.store.deleteModel(ref);
    return {ref};
  }

  async replaceAppSkills(accessToken: string, appNameInput: string, itemsInput: ReplacePortalAppSkillBindingsInput) {
    const actor = await this.requireAdmin(accessToken);
    const appName = normalizeAppName(appNameInput);
    const items = asArray(itemsInput).map((item, index) => {
      const value = asObject(item);
      return {
        appName,
        skillSlug: normalizeRequiredString(value.skillSlug, 'skillSlug'),
        enabled: normalizeOptionalBoolean(value.enabled, 'enabled', true),
        sortOrder: normalizeOptionalInteger(value.sortOrder, 'sortOrder', (index + 1) * 10),
        config: normalizeBindingConfig(value.config),
      };
    });
    return {items: await this.store.replaceAppSkillBindings(appName, items, actor.id)};
  }

  async replaceAppMcps(accessToken: string, appNameInput: string, itemsInput: ReplacePortalAppMcpBindingsInput) {
    const actor = await this.requireAdmin(accessToken);
    const appName = normalizeAppName(appNameInput);
    const items = asArray(itemsInput).map((item, index) => {
      const value = asObject(item);
      return {
        mcpKey: normalizeRequiredString(value.mcpKey, 'mcpKey'),
        enabled: normalizeOptionalBoolean(value.enabled, 'enabled', true),
        sortOrder: normalizeOptionalInteger(value.sortOrder, 'sortOrder', (index + 1) * 10),
        config: normalizeBindingConfig(value.config),
      };
    });
    return {items: await this.store.replaceAppMcpBindings(appName, items, actor.id)};
  }

  async replaceAppModels(accessToken: string, appNameInput: string, itemsInput: ReplacePortalAppModelBindingsInput) {
    const actor = await this.requireAdmin(accessToken);
    const appName = normalizeAppName(appNameInput);
    const items = asArray(itemsInput).map((item, index) => {
      const value = asObject(item);
      return {
        modelRef: normalizeModelRef(value.modelRef),
        enabled: normalizeOptionalBoolean(value.enabled, 'enabled', true),
        sortOrder: normalizeOptionalInteger(value.sortOrder, 'sortOrder', (index + 1) * 10),
        recommended: normalizeOptionalBoolean(value.recommended, 'recommended', false),
        default: normalizeOptionalBoolean(value.default, 'default', false),
        config: normalizeBindingConfig(value.config),
      };
    });
    return {items: await this.store.replaceAppModelBindings(appName, items, actor.id)};
  }

  async replaceAppMenus(accessToken: string, appNameInput: string, itemsInput: ReplacePortalAppMenuBindingsInput) {
    const actor = await this.requireAdmin(accessToken);
    const appName = normalizeAppName(appNameInput);
    const items = asArray(itemsInput).map((item, index) => {
      const value = asObject(item);
      return {
        menuKey: normalizeRequiredString(value.menuKey, 'menuKey'),
        enabled: normalizeOptionalBoolean(value.enabled, 'enabled', true),
        sortOrder: normalizeOptionalInteger(value.sortOrder, 'sortOrder', (index + 1) * 10),
        config: normalizeBindingConfig(value.config),
      };
    });
    return {items: await this.store.replaceAppMenuBindings(appName, items, actor.id)};
  }

  async replaceAppComposerControls(
    accessToken: string,
    appNameInput: string,
    itemsInput: ReplacePortalAppComposerControlBindingsInput,
  ) {
    const actor = await this.requireAdmin(accessToken);
    const appName = normalizeAppName(appNameInput);
    const items = asArray(itemsInput).map((item, index) => {
      const value = asObject(item);
      return {
        controlKey: normalizeRequiredString(value.controlKey, 'controlKey'),
        enabled: normalizeOptionalBoolean(value.enabled, 'enabled', true),
        sortOrder: normalizeOptionalInteger(value.sortOrder, 'sortOrder', (index + 1) * 10),
        config: normalizeBindingConfig(value.config),
      };
    });
    return {items: await this.store.replaceAppComposerControlBindings(appName, items, actor.id)};
  }

  async replaceAppComposerShortcuts(
    accessToken: string,
    appNameInput: string,
    itemsInput: ReplacePortalAppComposerShortcutBindingsInput,
  ) {
    const actor = await this.requireAdmin(accessToken);
    const appName = normalizeAppName(appNameInput);
    const items = asArray(itemsInput).map((item, index) => {
      const value = asObject(item);
      return {
        shortcutKey: normalizeRequiredString(value.shortcutKey, 'shortcutKey'),
        enabled: normalizeOptionalBoolean(value.enabled, 'enabled', true),
        sortOrder: normalizeOptionalInteger(value.sortOrder, 'sortOrder', (index + 1) * 10),
        config: normalizeBindingConfig(value.config),
      };
    });
    return {items: await this.store.replaceAppComposerShortcutBindings(appName, items, actor.id)};
  }

  async uploadAsset(
    accessToken: string,
    appNameInput: string,
    assetKeyInput: string,
    input: {
      content_type?: string;
      file_name?: string;
      file_base64?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const actor = await this.requireAdmin(accessToken);
    const appName = normalizeAppName(appNameInput);
    const assetKey = normalizeRequiredString(assetKeyInput, 'asset_key');
    const app = await this.store.getAppDetail(appName);
    if (!app) {
      throw new HttpError(404, 'NOT_FOUND', 'portal app not found');
    }
    const contentType = normalizeRequiredString(input.content_type, 'content_type');
    const filename = normalizeOptionalString(input.file_name, 'file_name') || assetKey;
    const content = parseRequiredBase64(input.file_base64, 'file_base64');
    const metadata =
      input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        ? (input.metadata as Record<string, unknown>)
        : {};
    const upload = await uploadPortalAssetFile({
      appName,
      assetKey,
      content,
      contentType,
      filename,
    });
    const asset = await this.store.upsertAsset({
      appName,
      assetKey,
      storageProvider: upload.storageProvider,
      objectKey: upload.objectKey,
      publicUrl: upload.publicUrl,
      contentType,
      sha256: upload.sha256,
      sizeBytes: upload.sizeBytes,
      metadata: {
        ...metadata,
        content_type: contentType,
        file_name: filename,
        byte_size: upload.sizeBytes,
      },
      actorUserId: actor.id,
    });
    return {asset};
  }

  async uploadDesktopReleaseArtifact(
    accessToken: string,
    appNameInput: string,
    input: {
      channel?: string | null;
      platform?: string | null;
      arch?: string | null;
      artifactType?: string | null;
      fileName?: string | null;
      contentType?: string | null;
      content: Buffer;
    },
  ) {
    const actor = await this.requireAdmin(accessToken);
    const detail = await this.getAppDetailOrThrow(appNameInput);
    const appName = detail.app.appName;
    const channel = normalizeDesktopReleaseChannel(input.channel);
    const platform = normalizeDesktopReleasePlatform(input.platform);
    const arch = normalizeDesktopReleaseArch(input.arch);
    const artifactType = normalizeDesktopReleaseArtifactType(input.artifactType);
    if (!platform || !arch) {
      throw new HttpError(400, 'BAD_REQUEST', 'platform and arch are required');
    }
    const fileName = normalizeRequiredString(input.fileName, 'file_name');
    const contentType = normalizeRequiredString(input.contentType, 'content_type');
    if (!Buffer.isBuffer(input.content) || input.content.length === 0) {
      throw new HttpError(400, 'BAD_REQUEST', 'desktop release file content is required');
    }

    const releaseConfig = readPortalDesktopReleaseConfig(detail.app.config);
    const channelState = releaseConfig.channels[channel];
    const nextDraft = cloneJson(channelState.draft);
    const target = upsertPortalDesktopReleaseTarget(nextDraft.targets, platform, arch);
    const previousFile =
      artifactType === 'installer'
        ? target.installer
        : artifactType === 'updater'
          ? target.updater
          : target.signature;

    const upload = await uploadPortalDesktopReleaseFile({
      appName,
      channel,
      platform,
      arch,
      artifactType,
      fileName,
      contentType,
      content: input.content,
    });

    if (artifactType === 'signature') {
      const signature = input.content.toString('utf8').trim();
      if (!signature) {
        throw new HttpError(400, 'BAD_REQUEST', 'signature file is empty');
      }
      target.signature = {
        ...upload,
        signature,
      };
    } else if (artifactType === 'updater') {
      target.updater = upload;
    } else {
      target.installer = upload;
    }

    channelState.draft = nextDraft;
    const nextConfig = writePortalDesktopReleaseConfig(asObject(detail.app.config), releaseConfig);
    await this.saveAppConfig(detail.app, nextConfig, actor.id);

    if (previousFile?.objectKey && previousFile.objectKey !== upload.objectKey) {
      await deletePortalDesktopReleaseFile(previousFile.objectKey).catch((error) => {
        logWarn('failed to delete previous desktop release file', {
          appName,
          channel,
          platform,
          arch,
          artifactType,
          objectKey: previousFile.objectKey,
          error,
        });
      });
    }

    return {
      channel,
      platform,
      arch,
      artifactType,
      file: artifactType === 'signature' ? target.signature : artifactType === 'updater' ? target.updater : target.installer,
      desktopRelease: releaseConfig,
    };
  }

  async publishDesktopRelease(
    accessToken: string,
    appNameInput: string,
    input: {
      channel?: string | null;
      version?: string | null;
      notes?: string | null;
      mandatory?: boolean;
      force_update_below_version?: string | null;
      allow_current_run_to_finish?: boolean;
      reason_code?: string | null;
      reason_message?: string | null;
    },
  ) {
    const actor = await this.requireAdmin(accessToken);
    const detail = await this.getAppDetailOrThrow(appNameInput);
    const appName = detail.app.appName;
    const channel = normalizeDesktopReleaseChannel(input.channel);
    const version = normalizeRequiredString(input.version, 'version');
    if (!validatePortalDesktopReleaseVersion(version)) {
      throw new HttpError(400, 'BAD_REQUEST', 'version must use semver triplet like 1.2.3');
    }
    const forceUpdateBelowVersion = normalizeOptionalString(input.force_update_below_version, 'force_update_below_version');
    if (forceUpdateBelowVersion && !validatePortalDesktopReleaseVersion(forceUpdateBelowVersion)) {
      throw new HttpError(400, 'BAD_REQUEST', 'force_update_below_version must use semver triplet like 1.2.3');
    }

    const releaseConfig = readPortalDesktopReleaseConfig(detail.app.config);
    const channelState = releaseConfig.channels[channel];
    const nextDraft = cloneJson(channelState.draft);
    const activeTargets = nextDraft.targets.filter((target) => target.installer || target.updater || target.signature);
    if (activeTargets.length === 0) {
      throw new HttpError(400, 'BAD_REQUEST', 'at least one desktop release target must be uploaded before publish');
    }
    for (const target of activeTargets) {
      if (!target.installer || !target.updater || !target.signature?.signature) {
        throw new HttpError(
          400,
          'BAD_REQUEST',
          `desktop release target ${target.platform}/${target.arch} is incomplete; installer, updater, and signature are required`,
        );
      }
    }

    nextDraft.version = version;
    nextDraft.notes = normalizeOptionalString(input.notes, 'notes');
    nextDraft.policy = {
      mandatory: normalizeOptionalBoolean(input.mandatory, 'mandatory', false),
      forceUpdateBelowVersion,
      allowCurrentRunToFinish: normalizeOptionalBoolean(
        input.allow_current_run_to_finish,
        'allow_current_run_to_finish',
        true,
      ),
      reasonCode: normalizeOptionalString(input.reason_code, 'reason_code'),
      reasonMessage: normalizeOptionalString(input.reason_message, 'reason_message'),
    };
    nextDraft.publishedAt = new Date().toISOString();
    channelState.draft = nextDraft;
    channelState.published = cloneJson(nextDraft);

    const nextConfig = writePortalDesktopReleaseConfig(asObject(detail.app.config), releaseConfig);
    await this.saveAppConfig(detail.app, nextConfig, actor.id);
    const release = await this.store.publishApp(appName, actor.id);
    return {
      release,
      desktopRelease: releaseConfig,
    };
  }

  async deleteAsset(accessToken: string, appNameInput: string, assetKeyInput: string) {
    const actor = await this.requireAdmin(accessToken);
    const appName = normalizeAppName(appNameInput);
    const assetKey = normalizeRequiredString(assetKeyInput, 'asset_key');
    const existing = await this.store.getAppAsset(appName, assetKey);
    if (!existing) {
      return {removed: false};
    }
    const removed = await this.store.deleteAsset({
      appName,
      assetKey,
      actorUserId: actor.id,
      existing,
    });
    if (removed.removed) {
      await deletePortalAssetFile({
        storageProvider: existing.storageProvider || 's3',
        objectKey: existing.objectKey,
      }).catch((error) => {
        logWarn('failed to delete portal asset object', {appName, assetKey, error});
      });
    }
    return removed;
  }

  async getAssetFile(appNameInput: string, assetKeyInput: string) {
    const appName = normalizeAppName(appNameInput);
    const assetKey = normalizeRequiredString(assetKeyInput, 'asset_key');
    const asset = await this.store.getAppAsset(appName, assetKey);
    if (!asset) {
      throw new HttpError(404, 'NOT_FOUND', 'portal asset not found');
    }
    const file = await downloadPortalAssetFile({
      appName,
      assetKey,
      storageProvider: asset.storageProvider || 's3',
      objectKey: asset.objectKey,
      contentType: asset.contentType,
    });
    return {asset, file};
  }

  async getDesktopReleaseManifest(appNameInput: string, baseUrl: string, input: {
    channel?: string | null;
    platform?: string | null;
    arch?: string | null;
  }) {
    const detail = await this.getAppDetailOrThrow(appNameInput);
    const channel = normalizeDesktopReleaseChannel(input.channel);
    const platform = normalizeDesktopReleasePlatform(input.platform);
    const arch = normalizeDesktopReleaseArch(input.arch);
    const releaseConfig = readPortalDesktopReleaseConfig(detail.app.config);
    const payload = buildPortalDesktopReleaseManifestPayload({
      baseUrl,
      appName: detail.app.appName,
      channel,
      snapshot: releaseConfig.channels[channel].published,
      platform,
      arch,
    });
    if (!payload) {
      throw new HttpError(404, 'NOT_FOUND', 'desktop release manifest not found');
    }
    return payload;
  }

  async getDesktopReleaseFile(appNameInput: string, input: {
    channel?: string | null;
    platform?: string | null;
    arch?: string | null;
    artifactType?: string | null;
  }) {
    const detail = await this.getAppDetailOrThrow(appNameInput);
    const fileMeta = resolvePortalDesktopReleaseDownloadFile({
      appName: detail.app.appName,
      config: detail.app.config,
      channel: input.channel,
      platform: input.platform,
      arch: input.arch,
      artifactType: input.artifactType,
    });
    if (!fileMeta) {
      throw new HttpError(404, 'NOT_FOUND', 'desktop release file not found');
    }
    const file = await downloadPortalDesktopReleaseFile(fileMeta.objectKey);
    return {fileMeta, file};
  }

  async publishApp(accessToken: string, appNameInput: string) {
    const actor = await this.requireAdmin(accessToken);
    const appName = normalizeAppName(appNameInput);
    const release = await this.store.publishApp(appName, actor.id);
    return {release};
  }

  async restoreApp(accessToken: string, appNameInput: string, input: {version?: number}) {
    const actor = await this.requireAdmin(accessToken);
    const appName = normalizeAppName(appNameInput);
    const version = normalizeOptionalInteger(input.version, 'version', 0);
    if (version <= 0) {
      throw new HttpError(400, 'BAD_REQUEST', 'version must be a positive integer');
    }
    const app = await this.store.restoreAppRelease(appName, version, actor.id);
    return {app};
  }

  async getPublicAppConfig(appNameInput: string, baseUrl: string, input: {surfaceKey?: string | null} = {}) {
    return this.buildResolvedRuntimeConfig(appNameInput, baseUrl, input, {includeSecrets: false});
  }

  private async buildResolvedRuntimeConfig(
    appNameInput: string,
    baseUrl: string,
    input: {surfaceKey?: string | null} = {},
    options: {includeSecrets?: boolean} = {},
  ) {
    const appName = normalizeAppName(appNameInput);
    const detail = await this.store.getAppDetail(appName);
    if (!detail) {
      throw new HttpError(404, 'NOT_FOUND', 'portal app not found');
    }
    const [platformSkills, platformMcps, menus, composerControls, composerShortcuts] = await Promise.all([
      this.store.listSkills(),
      this.store.listMcps(),
      this.store.listMenus(),
      this.store.listComposerControls(),
      this.store.listComposerShortcuts(),
    ]);
    const publicConfig = buildPortalPublicConfig({
      ...detail,
      skillBindings: mergePlatformSkillBindings(detail.app.appName, detail.skillBindings, platformSkills),
      mcpBindings: mergePlatformMcpBindings(detail.app.appName, detail.mcpBindings, platformMcps),
    }, {
      surfaceKey: normalizeOptionalString(input.surfaceKey, 'surface_key'),
      menuCatalog: menus,
      composerControlCatalog: composerControls,
      composerShortcutCatalog: composerShortcuts,
      assetUrlResolver: (asset) =>
        normalizePersistedPortalAssetUrl(asset.publicUrl, baseUrl) ||
        `${baseUrl.replace(/\/$/, '')}/portal/asset/file?app_name=${encodeURIComponent(appName)}&asset_key=${encodeURIComponent(asset.assetKey)}`,
    });
    const resolvedModels = await this.store.resolveRuntimeModels(appName);
    const resolvedMemoryEmbedding = await this.store.resolveMemoryEmbedding(appName);
    let nextConfig = publicConfig.config;
    if (resolvedModels) {
      nextConfig = applyResolvedRuntimeModelsToConfig(nextConfig, resolvedModels, {
        includeSecrets: options.includeSecrets,
      });
    }
    nextConfig = applyResolvedMemoryEmbeddingToConfig(nextConfig, resolvedMemoryEmbedding, {
      includeSecrets: options.includeSecrets,
    });
    return {
      ...publicConfig,
      config: nextConfig,
    };
  }

  private async invalidateRuntimeModelCache(appName: string): Promise<void> {
    await this.cache?.delete(runtimeModelCacheKey(appName));
  }

  private async invalidateMemoryEmbeddingCache(appName: string): Promise<void> {
    await this.cache?.delete(runtimeMemoryEmbeddingCacheKey(appName));
  }

  private async invalidateRuntimeModelCachesForScope(
    scopeType: PortalModelProviderScopeType,
    scopeKey: string,
  ): Promise<void> {
    if (scopeType === 'app') {
      await this.invalidateRuntimeModelCache(scopeKey);
      return;
    }
    await this.invalidateRuntimeModelCache('platform');
    const apps = await this.store.listApps();
    for (const app of apps) {
      const override = await this.store.getAppModelRuntimeOverride(app.appName);
      if (!override || override.providerMode === 'inherit_platform') {
        await this.invalidateRuntimeModelCache(app.appName);
      }
    }
  }

  private async invalidateMemoryEmbeddingCachesForScope(
    scopeType: PortalModelProviderScopeType,
    scopeKey: string,
  ): Promise<void> {
    if (scopeType === 'app') {
      await this.invalidateMemoryEmbeddingCache(scopeKey);
      return;
    }
    await this.invalidateMemoryEmbeddingCache('platform');
    const apps = await this.store.listApps();
    for (const app of apps) {
      await this.invalidateMemoryEmbeddingCache(app.appName);
    }
  }

  private async invalidateAllRuntimeModelCaches(): Promise<void> {
    await this.invalidateRuntimeModelCache('platform');
    const apps = await this.store.listApps();
    for (const app of apps) {
      await this.invalidateRuntimeModelCache(app.appName);
    }
  }

  private async invalidateAllMemoryEmbeddingCaches(): Promise<void> {
    await this.invalidateMemoryEmbeddingCache('platform');
    const apps = await this.store.listApps();
    for (const app of apps) {
      await this.invalidateMemoryEmbeddingCache(app.appName);
    }
  }

  private async getAppDetailOrThrow(appNameInput: string): Promise<PortalAppDetail> {
    const detail = await this.store.getAppDetail(normalizeAppName(appNameInput));
    if (!detail) {
      throw new HttpError(404, 'NOT_FOUND', 'portal app not found');
    }
    return detail;
  }

  private async saveAppConfig(app: PortalAppRecord, config: PortalJsonObject, actorUserId: string | null) {
    return this.store.upsertApp({
      appName: app.appName,
      displayName: app.displayName,
      description: app.description,
      status: app.status,
      defaultLocale: app.defaultLocale,
      config,
    }, actorUserId);
  }

  private async requireAdmin(accessToken: string): Promise<PublicUser> {
    const user = await this.authResolver(accessToken);
    if (rolePriority(user.role) < rolePriority('admin')) {
      throw new HttpError(403, 'FORBIDDEN', 'admin access required');
    }
    return user;
  }
}
