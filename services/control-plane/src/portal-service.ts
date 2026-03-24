import type {PublicUser} from './domain.ts';
import {HttpError} from './errors.ts';
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
import {deletePortalSkillArtifact, uploadPortalSkillArtifact} from './portal-skill-storage.ts';
import type {
  PortalAppDetail,
  PortalAppRecord,
  PortalAppStatus,
  PortalJsonObject,
  ReplacePortalAppComposerControlBindingsInput,
  ReplacePortalAppComposerShortcutBindingsInput,
  ReplacePortalAppModelBindingsInput,
  ReplacePortalAppMcpBindingsInput,
  ReplacePortalAppMenuBindingsInput,
  ReplacePortalAppSkillBindingsInput,
  UpsertPortalAppInput,
  UpsertPortalModelInput,
  UpsertPortalMenuInput,
  UpsertPortalMcpInput,
  UpsertPortalSkillInput,
} from './portal-domain.ts';
import {buildPortalPublicConfig} from './portal-runtime.ts';
import type {PgPortalStore} from './portal-store.ts';

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
  if (!/^[a-z0-9][a-z0-9._-]{0,62}\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized)) {
    throw new HttpError(400, 'BAD_REQUEST', 'ref must use provider/model format');
  }
  return normalized;
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

  constructor(store: PgPortalStore, authResolver: (accessToken: string) => Promise<PublicUser>) {
    this.store = store;
    this.authResolver = authResolver;
  }

  async listApps(accessToken: string) {
    await this.requireAdmin(accessToken);
    return {items: await this.store.listApps()};
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
    const existing = await this.store.getSkill(slug);
    let objectKey = normalizeOptionalString(input.objectKey, 'object_key');
    let contentSha256 = normalizeOptionalString(input.contentSha256, 'content_sha256');
    const rawInput = input as Record<string, unknown>;
    const fileBase64 =
      normalizeOptionalString(input.fileBase64, 'file_base64') ||
      normalizeOptionalString(rawInput.file_base64, 'file_base64');
    const fileName =
      normalizeOptionalString(input.fileName, 'file_name') ||
      normalizeOptionalString(rawInput.file_name, 'file_name');
    const contentType =
      normalizeOptionalString(input.contentType, 'content_type') ||
      normalizeOptionalString(rawInput.content_type, 'content_type');
    let metadata = {
      ...asObject(existing?.metadata),
      ...asObject(input.metadata),
    };
    if (fileBase64) {
      const upload = await uploadPortalSkillArtifact({
        slug,
        artifact: parseRequiredBase64(fileBase64, 'file_base64'),
        filename: fileName,
        contentType,
      });
      if (existing?.objectKey && existing.objectKey !== upload.objectKey) {
        await deletePortalSkillArtifact(existing.objectKey).catch((error) => {
          console.warn('[portal-service] failed to delete previous portal skill artifact', {
            slug,
            objectKey: existing.objectKey,
            error,
          });
        });
      }
      objectKey = upload.objectKey;
      contentSha256 = upload.contentSha256;
      metadata = {
        ...metadata,
        artifact_format: upload.artifactFormat,
        artifact_size_bytes: upload.sizeBytes,
      };
    } else {
      objectKey = objectKey ?? existing?.objectKey ?? null;
      contentSha256 = contentSha256 ?? existing?.contentSha256 ?? null;
    }
    return this.store.upsertSkill({
      slug,
      name: normalizeRequiredString(input.name, 'name'),
      description: normalizeRequiredString(input.description, 'description'),
      category: normalizeOptionalString(input.category, 'category'),
      publisher: normalizeRequiredString(input.publisher, 'publisher'),
      visibility: normalizeOptionalString(input.visibility, 'visibility') || 'showcase',
      objectKey,
      contentSha256,
      metadata,
      active: normalizeOptionalBoolean(input.active, 'active', true),
    });
  }

  async deleteSkill(accessToken: string, slugInput: string) {
    await this.requireAdmin(accessToken);
    const slug = normalizeRequiredString(slugInput, 'slug');
    const existing = await this.store.getSkill(slug);
    await this.store.deleteSkill(slug);
    if (existing?.objectKey) {
      await deletePortalSkillArtifact(existing.objectKey).catch((error) => {
        console.warn('[portal-service] failed to delete portal skill artifact', {
          slug,
          objectKey: existing.objectKey,
          error,
        });
      });
    }
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

  async upsertMcp(accessToken: string, input: UpsertPortalMcpInput) {
    await this.requireAdmin(accessToken);
    return this.store.upsertMcp({
      mcpKey: normalizeRequiredString(input.mcpKey, 'mcp_key'),
      name: normalizeRequiredString(input.name, 'name'),
      description: normalizeRequiredString(input.description, 'description'),
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
      useRuntimeOpenai: normalizeOptionalBoolean(input.useRuntimeOpenai, 'use_runtime_openai', false),
      authHeader: normalizeOptionalBoolean(input.authHeader, 'auth_header', true),
      reasoning: normalizeOptionalBoolean(input.reasoning, 'reasoning', false),
      input: asArray(input.input).map((item) => normalizeRequiredString(item, 'input[]')),
      contextWindow: normalizeOptionalInteger(input.contextWindow, 'context_window', 0),
      maxTokens: normalizeOptionalInteger(input.maxTokens, 'max_tokens', 0),
      metadata: asObject(input.metadata),
      active: normalizeOptionalBoolean(input.active, 'active', true),
    });
  }

  async deleteModel(accessToken: string, refInput: string) {
    await this.requireAdmin(accessToken);
    const ref = normalizeModelRef(refInput);
    await this.store.deleteModel(ref);
    return {ref};
  }

  async deleteMcp(accessToken: string, mcpKeyInput: string) {
    await this.requireAdmin(accessToken);
    const mcpKey = normalizeRequiredString(mcpKeyInput, 'mcp_key');
    await this.store.deleteMcp(mcpKey);
    return {mcpKey};
  }

  async replaceAppSkills(accessToken: string, appNameInput: string, itemsInput: ReplacePortalAppSkillBindingsInput) {
    const actor = await this.requireAdmin(accessToken);
    const appName = normalizeAppName(appNameInput);
    const items = asArray(itemsInput).map((item, index) => {
      const value = asObject(item);
      return {
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
        console.warn('[portal-service] failed to delete previous desktop release file', {
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
        console.warn('[portal-service] failed to delete portal asset object', {appName, assetKey, error});
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
    const appName = normalizeAppName(appNameInput);
    const detail = await this.store.getAppDetail(appName);
    if (!detail) {
      throw new HttpError(404, 'NOT_FOUND', 'portal app not found');
    }
    const [menus, composerControls, composerShortcuts] = await Promise.all([
      this.store.listMenus(),
      this.store.listComposerControls(),
      this.store.listComposerShortcuts(),
    ]);
    return buildPortalPublicConfig(detail, {
      surfaceKey: normalizeOptionalString(input.surfaceKey, 'surface_key'),
      menuCatalog: menus,
      composerControlCatalog: composerControls,
      composerShortcutCatalog: composerShortcuts,
      assetUrlResolver: (asset) =>
        asset.publicUrl || `${baseUrl.replace(/\/$/, '')}/portal/asset/file?app_name=${encodeURIComponent(appName)}&asset_key=${encodeURIComponent(asset.assetKey)}`,
    });
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
