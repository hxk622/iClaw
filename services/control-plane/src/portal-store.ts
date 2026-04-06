import {randomUUID} from 'node:crypto';

import {Pool, type PoolClient} from 'pg';
import {HttpError} from './errors.ts';
import {createPgPool} from './pg-connection.ts';
import type {
  ListPortalRuntimeReleaseBindingHistoryInput,
  ListPortalRuntimeReleaseBindingsInput,
  ListPortalRuntimeReleasesInput,
  PortalResolvedRuntimeReleaseResult,
  PortalRuntimeReleaseBindingHistoryRecord,
  PortalRuntimeReleaseBindingRecord,
  PortalRuntimeReleaseRecord,
  UpsertPortalRuntimeReleaseBindingInput,
  UpsertPortalRuntimeReleaseInput,
} from './runtime-release-domain.ts';

import type {
  PortalAppModelProviderMode,
  PortalAppModelRuntimeOverrideRecord,
  PortalAppComposerControlBindingRecord,
  PortalAppComposerShortcutBindingRecord,
  PortalAppAssetRecord,
  PortalAppAuditRecord,
  PortalAppDetail,
  PortalAppModelBindingRecord,
  PortalAppMcpBindingRecord,
  PortalAppMenuBindingRecord,
  PortalAppRechargePackageBindingRecord,
  PortalAppRecord,
  PortalAppReleaseRecord,
  PortalAppSkillBindingRecord,
  PortalComposerControlOptionRecord,
  PortalComposerControlRecord,
  PortalComposerShortcutRecord,
  PortalJsonObject,
  PortalMemoryEmbeddingProfileRecord,
  PortalModelProviderProfileModelRecord,
  PortalModelProviderProfileRecord,
  PortalModelProviderScopeType,
  PortalResolvedMemoryEmbeddingResult,
  PortalResolvedRuntimeModelsResult,
  PortalModelRecord,
  PortalMenuRecord,
  PortalMcpRecord,
  PortalRechargePackageRecord,
  PortalSkillRecord,
  ReplacePortalAppComposerControlBindingsInput,
  ReplacePortalAppComposerShortcutBindingsInput,
  ReplacePortalAppModelBindingsInput,
  ReplacePortalAppMcpBindingsInput,
  ReplacePortalAppMenuBindingsInput,
  ReplacePortalAppRechargePackageBindingsInput,
  ReplacePortalAppSkillBindingsInput,
  UpsertPortalAppInput,
  UpsertPortalComposerControlInput,
  UpsertPortalComposerShortcutInput,
  UpsertPortalAppModelRuntimeOverrideInput,
  UpsertPortalMemoryEmbeddingProfileInput,
  UpsertPortalModelInput,
  UpsertPortalModelProviderProfileInput,
  UpsertPortalMenuInput,
  UpsertPortalMcpInput,
  UpsertPortalRechargePackageInput,
  UpsertPortalSkillInput,
} from './portal-domain.ts';

type PortalAppRow = {
  app_name: string;
  display_name: string;
  description: string | null;
  status: 'active' | 'disabled';
  default_locale: string;
  config_json: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
};

type PortalSkillRow = {
  slug: string;
  name: string;
  description: string;
  market: string | null;
  category: string | null;
  skill_type: string | null;
  publisher: string;
  distribution: string | null;
  tags: string[] | null;
  version: string | null;
  source_url: string | null;
  object_key: string | null;
  content_sha256: string | null;
  metadata_json: Record<string, unknown> | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type PortalMcpRow = {
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

type PortalModelRow = {
  ref: string;
  label: string;
  provider_id: string;
  model_id: string;
  api: string;
  base_url: string | null;
  use_runtime_openai: boolean;
  auth_header: boolean;
  reasoning: boolean;
  input_json: unknown[] | null;
  context_window: number;
  max_tokens: number;
  metadata_json: Record<string, unknown> | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type PortalMenuRow = {
  menu_key: string;
  display_name: string;
  category: string | null;
  route_key: string | null;
  icon_key: string | null;
  metadata_json: Record<string, unknown> | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type PortalRechargePackageRow = {
  package_id: string;
  package_name: string;
  credits: string | number;
  bonus_credits: string | number;
  amount_cny_fen: number;
  sort_order: number;
  recommended: boolean;
  is_default: boolean;
  metadata_json: Record<string, unknown> | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type PortalModelProviderProfileRow = {
  id: string;
  scope_type: PortalModelProviderScopeType;
  scope_key: string;
  provider_key: string;
  provider_label: string;
  api_protocol: string;
  base_url: string;
  auth_mode: string;
  api_key: string;
  logo_preset_key: string | null;
  metadata_json: Record<string, unknown> | null;
  enabled: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

type PortalModelProviderProfileModelRow = {
  id: string;
  profile_id: string;
  model_ref: string;
  model_id: string;
  label: string;
  logo_preset_key: string | null;
  billing_multiplier: number | string | null;
  reasoning: boolean;
  input_modalities_json: unknown[] | null;
  context_window: number | null;
  max_tokens: number | null;
  enabled: boolean;
  sort_order: number;
  metadata_json: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
};

type PortalAppModelRuntimeOverrideRow = {
  app_name: string;
  provider_mode: PortalAppModelProviderMode;
  active_profile_id: string | null;
  cache_version: string | number;
  updated_at: Date;
};

type PortalMemoryEmbeddingProfileRow = {
  id: string;
  scope_type: PortalModelProviderScopeType;
  scope_key: string;
  provider_key: string;
  provider_label: string;
  base_url: string;
  auth_mode: string;
  api_key: string;
  embedding_model: string;
  logo_preset_key: string | null;
  auto_recall: boolean;
  metadata_json: Record<string, unknown> | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

type PortalComposerControlRow = {
  control_key: string;
  display_name: string;
  control_type: string;
  icon_key: string | null;
  metadata_json: Record<string, unknown> | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type PortalComposerControlOptionRow = {
  control_key: string;
  option_value: string;
  label: string;
  description: string;
  sort_order: number;
  metadata_json: Record<string, unknown> | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type PortalComposerShortcutRow = {
  shortcut_key: string;
  display_name: string;
  description: string;
  template_text: string;
  icon_key: string | null;
  tone: string | null;
  metadata_json: Record<string, unknown> | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type PortalSkillBindingRow = {
  app_name: string;
  skill_slug: string;
  enabled: boolean;
  sort_order: number;
  config_json: Record<string, unknown> | null;
};

type PortalMcpBindingRow = {
  app_name: string;
  mcp_key: string;
  enabled: boolean;
  sort_order: number;
  config_json: Record<string, unknown> | null;
};

type PortalModelBindingRow = {
  app_name: string;
  model_ref: string;
  enabled: boolean;
  sort_order: number;
  config_json: Record<string, unknown> | null;
  catalog_ref: string | null;
  catalog_label: string | null;
  catalog_provider_id: string | null;
  catalog_model_id: string | null;
  catalog_api: string | null;
  catalog_base_url: string | null;
  catalog_use_runtime_openai: boolean | null;
  catalog_auth_header: boolean | null;
  catalog_reasoning: boolean | null;
  catalog_input_json: unknown[] | null;
  catalog_context_window: number | null;
  catalog_max_tokens: number | null;
  catalog_metadata_json: Record<string, unknown> | null;
  catalog_active: boolean | null;
  catalog_created_at: Date | null;
  catalog_updated_at: Date | null;
};

type PortalMenuBindingRow = {
  app_name: string;
  menu_key: string;
  enabled: boolean;
  sort_order: number;
  config_json: Record<string, unknown> | null;
};

type PortalComposerControlBindingRow = {
  app_name: string;
  control_key: string;
  enabled: boolean;
  sort_order: number;
  config_json: Record<string, unknown> | null;
};

type PortalComposerShortcutBindingRow = {
  app_name: string;
  shortcut_key: string;
  enabled: boolean;
  sort_order: number;
  config_json: Record<string, unknown> | null;
};

type PortalRechargePackageBindingRow = {
  app_name: string;
  package_id: string;
  enabled: boolean;
  sort_order: number;
  recommended: boolean;
  is_default: boolean;
  config_json: Record<string, unknown> | null;
};

type PortalAssetRow = {
  id: string;
  app_name: string;
  app_display_name: string | null;
  asset_key: string;
  storage_provider: string | null;
  object_key: string;
  public_url: string | null;
  content_type: string | null;
  sha256: string | null;
  size_bytes: string | number | null;
  metadata_json: Record<string, unknown> | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

type PortalSystemStateRow = {
  state_key: string;
  state_value: Record<string, unknown> | null;
  updated_at: Date;
};

type PortalReleaseRow = {
  id: string;
  app_name: string;
  app_display_name: string | null;
  version_no: number;
  snapshot_json: Record<string, unknown> | null;
  summary_json: Record<string, unknown> | null;
  created_by: string | null;
  created_by_name: string | null;
  created_by_username: string | null;
  created_at: Date;
  published_at: Date;
};

type PortalAuditRow = {
  id: string;
  app_name: string;
  app_display_name: string | null;
  action: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_username: string | null;
  payload: Record<string, unknown> | null;
  created_at: Date;
};

type PortalRuntimeReleaseRow = {
  id: string;
  runtime_kind: string;
  version: string;
  channel: string;
  platform: string;
  arch: string;
  target_triple: string;
  artifact_type: string;
  storage_provider: string;
  bucket_name: string | null;
  object_key: string | null;
  artifact_url: string;
  artifact_sha256: string | null;
  artifact_size_bytes: string | number | null;
  launcher_relative_path: string | null;
  git_commit: string | null;
  git_tag: string | null;
  release_version: string | null;
  build_time: Date | null;
  build_info_json: Record<string, unknown> | null;
  metadata_json: Record<string, unknown> | null;
  status: 'draft' | 'published' | 'deprecated' | 'archived';
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
};

type PortalRuntimeReleaseBindingRow = {
  id: string;
  scope_type: 'platform' | 'app';
  scope_key: string;
  runtime_kind: string;
  channel: string;
  platform: string;
  arch: string;
  target_triple: string;
  release_id: string;
  enabled: boolean;
  metadata_json: Record<string, unknown> | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

type PortalRuntimeReleaseBindingHistoryRow = {
  id: string;
  binding_id: string;
  scope_type: 'platform' | 'app';
  scope_key: string;
  runtime_kind: string;
  channel: string;
  platform: string;
  arch: string;
  target_triple: string;
  from_release_id: string | null;
  to_release_id: string | null;
  change_reason: string | null;
  operator_user_id: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: Date;
};

type PortalAppSnapshotState = {
  app: PortalAppRecord;
  skillBindings: PortalAppSkillBindingRecord[];
  mcpBindings: PortalAppMcpBindingRecord[];
  modelBindings: PortalAppModelBindingRecord[];
  menuBindings: PortalAppMenuBindingRecord[];
  composerControlBindings: PortalAppComposerControlBindingRecord[];
  composerShortcutBindings: PortalAppComposerShortcutBindingRecord[];
  rechargePackageBindings: PortalAppRechargePackageBindingRecord[];
  assets: PortalAppAssetRecord[];
};

function asJsonObject(value: unknown): PortalJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as PortalJsonObject;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function parseDbNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function mapAppRow(row: PortalAppRow): PortalAppRecord {
  return {
    appName: row.app_name,
    displayName: row.display_name,
    description: row.description,
    status: row.status,
    defaultLocale: row.default_locale,
    config: asJsonObject(row.config_json),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapSkillRow(row: PortalSkillRow): PortalSkillRecord {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    market: row.market,
    category: row.category,
    skillType: row.skill_type,
    publisher: row.publisher,
    distribution: row.distribution,
    tags: Array.isArray(row.tags) ? row.tags.filter((item) => typeof item === 'string') : [],
    version: row.version,
    sourceUrl: row.source_url,
    objectKey: row.object_key,
    contentSha256: row.content_sha256,
    metadata: asJsonObject(row.metadata_json),
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapMcpRow(row: PortalMcpRow): PortalMcpRecord {
  return {
    mcpKey: row.mcp_key,
    name: row.name,
    description: row.description,
    transport: row.transport,
    objectKey: row.object_key,
    config: asJsonObject(row.config_json),
    metadata: asJsonObject(row.metadata_json),
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapModelRow(row: PortalModelRow): PortalModelRecord {
  return {
    ref: row.ref,
    label: row.label,
    providerId: row.provider_id,
    modelId: row.model_id,
    api: row.api,
    baseUrl: row.base_url,
    useRuntimeOpenai: row.use_runtime_openai,
    authHeader: row.auth_header,
    reasoning: row.reasoning,
    input: asStringArray(row.input_json),
    contextWindow: row.context_window || 0,
    maxTokens: row.max_tokens || 0,
    metadata: asJsonObject(row.metadata_json),
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapModelProviderProfileModelRow(row: PortalModelProviderProfileModelRow): PortalModelProviderProfileModelRecord {
  const billingMultiplierRaw =
    typeof row.billing_multiplier === 'string' ? Number(row.billing_multiplier) : row.billing_multiplier;
  return {
    id: row.id,
    profileId: row.profile_id,
    modelRef: row.model_ref,
    modelId: row.model_id,
    label: row.label,
    logoPresetKey: row.logo_preset_key,
    billingMultiplier:
      typeof billingMultiplierRaw === 'number' && Number.isFinite(billingMultiplierRaw) && billingMultiplierRaw > 0
        ? billingMultiplierRaw
        : 1,
    reasoning: row.reasoning,
    inputModalities: asStringArray(row.input_modalities_json),
    contextWindow: typeof row.context_window === 'number' ? row.context_window : null,
    maxTokens: typeof row.max_tokens === 'number' ? row.max_tokens : null,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    metadata: asJsonObject(row.metadata_json),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapModelProviderProfileRow(
  row: PortalModelProviderProfileRow,
  models: PortalModelProviderProfileModelRecord[] = [],
): PortalModelProviderProfileRecord {
  return {
    id: row.id,
    scopeType: row.scope_type,
    scopeKey: row.scope_key,
    providerKey: row.provider_key,
    providerLabel: row.provider_label,
    apiProtocol: row.api_protocol,
    baseUrl: row.base_url,
    authMode: row.auth_mode,
    apiKey: row.api_key,
    logoPresetKey: row.logo_preset_key,
    metadata: asJsonObject(row.metadata_json),
    enabled: row.enabled,
    sortOrder: row.sort_order,
    models,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapAppModelRuntimeOverrideRow(row: PortalAppModelRuntimeOverrideRow): PortalAppModelRuntimeOverrideRecord {
  return {
    appName: row.app_name,
    providerMode: row.provider_mode,
    activeProfileId: row.active_profile_id,
    cacheVersion: Number(row.cache_version || 1),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapMemoryEmbeddingProfileRow(row: PortalMemoryEmbeddingProfileRow): PortalMemoryEmbeddingProfileRecord {
  return {
    id: row.id,
    scopeType: row.scope_type,
    scopeKey: row.scope_key,
    providerKey: row.provider_key,
    providerLabel: row.provider_label,
    baseUrl: row.base_url,
    authMode: row.auth_mode,
    apiKey: row.api_key,
    embeddingModel: row.embedding_model,
    logoPresetKey: row.logo_preset_key,
    autoRecall: row.auto_recall,
    metadata: asJsonObject(row.metadata_json),
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapMenuRow(row: PortalMenuRow): PortalMenuRecord {
  return {
    menuKey: row.menu_key,
    displayName: row.display_name,
    category: row.category,
    routeKey: row.route_key,
    iconKey: row.icon_key,
    metadata: asJsonObject(row.metadata_json),
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapRechargePackageRow(row: PortalRechargePackageRow): PortalRechargePackageRecord {
  return {
    packageId: row.package_id,
    packageName: row.package_name,
    credits: parseDbNumber(row.credits),
    bonusCredits: parseDbNumber(row.bonus_credits),
    amountCnyFen: Number(row.amount_cny_fen || 0),
    sortOrder: row.sort_order,
    recommended: row.recommended === true,
    default: row.is_default === true,
    metadata: asJsonObject(row.metadata_json),
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapComposerControlOptionRow(row: PortalComposerControlOptionRow): PortalComposerControlOptionRecord {
  return {
    controlKey: row.control_key,
    optionValue: row.option_value,
    label: row.label,
    description: row.description,
    sortOrder: row.sort_order,
    metadata: asJsonObject(row.metadata_json),
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapComposerControlRow(
  row: PortalComposerControlRow,
  options: PortalComposerControlOptionRecord[],
): PortalComposerControlRecord {
  return {
    controlKey: row.control_key,
    displayName: row.display_name,
    controlType: row.control_type,
    iconKey: row.icon_key,
    metadata: asJsonObject(row.metadata_json),
    active: row.active,
    options,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapComposerShortcutRow(row: PortalComposerShortcutRow): PortalComposerShortcutRecord {
  return {
    shortcutKey: row.shortcut_key,
    displayName: row.display_name,
    description: row.description,
    template: row.template_text,
    iconKey: row.icon_key,
    tone: row.tone,
    metadata: asJsonObject(row.metadata_json),
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapSkillBindingRow(row: PortalSkillBindingRow): PortalAppSkillBindingRecord {
  return {
    appName: row.app_name,
    skillSlug: row.skill_slug,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    config: asJsonObject(row.config_json),
  };
}

function mapMcpBindingRow(row: PortalMcpBindingRow): PortalAppMcpBindingRecord {
  return {
    appName: row.app_name,
    mcpKey: row.mcp_key,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    config: asJsonObject(row.config_json),
  };
}

function mapModelBindingRow(row: PortalModelBindingRow): PortalAppModelBindingRecord {
  const model =
    row.catalog_ref && row.catalog_label && row.catalog_provider_id && row.catalog_model_id && row.catalog_api &&
    row.catalog_created_at && row.catalog_updated_at
      ? mapModelRow({
          ref: row.catalog_ref,
          label: row.catalog_label,
          provider_id: row.catalog_provider_id,
          model_id: row.catalog_model_id,
          api: row.catalog_api,
          base_url: row.catalog_base_url,
          use_runtime_openai: row.catalog_use_runtime_openai ?? false,
          auth_header: row.catalog_auth_header ?? true,
          reasoning: row.catalog_reasoning ?? false,
          input_json: row.catalog_input_json,
          context_window: row.catalog_context_window || 0,
          max_tokens: row.catalog_max_tokens || 0,
          metadata_json: row.catalog_metadata_json,
          active: row.catalog_active ?? true,
          created_at: row.catalog_created_at,
          updated_at: row.catalog_updated_at,
        })
      : null;
  return {
    appName: row.app_name,
    modelRef: row.model_ref,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    config: asJsonObject(row.config_json),
    model,
  };
}

function mapMenuBindingRow(row: PortalMenuBindingRow): PortalAppMenuBindingRecord {
  return {
    appName: row.app_name,
    menuKey: row.menu_key,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    config: asJsonObject(row.config_json),
  };
}

function mapComposerControlBindingRow(row: PortalComposerControlBindingRow): PortalAppComposerControlBindingRecord {
  return {
    appName: row.app_name,
    controlKey: row.control_key,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    config: asJsonObject(row.config_json),
  };
}

function mapComposerShortcutBindingRow(row: PortalComposerShortcutBindingRow): PortalAppComposerShortcutBindingRecord {
  return {
    appName: row.app_name,
    shortcutKey: row.shortcut_key,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    config: asJsonObject(row.config_json),
  };
}

function mapRechargePackageBindingRow(row: PortalRechargePackageBindingRow): PortalAppRechargePackageBindingRecord {
  return {
    appName: row.app_name,
    packageId: row.package_id,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    recommended: row.recommended === true,
    default: row.is_default === true,
    config: asJsonObject(row.config_json),
  };
}

function mapAssetRow(row: PortalAssetRow): PortalAppAssetRecord {
  return {
    id: row.id,
    appName: row.app_name,
    appDisplayName: row.app_display_name,
    assetKey: row.asset_key,
    storageProvider: row.storage_provider,
    objectKey: row.object_key,
    publicUrl: row.public_url,
    contentType: row.content_type,
    sha256: row.sha256,
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    metadata: asJsonObject(row.metadata_json),
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapReleaseRow(row: PortalReleaseRow): PortalAppReleaseRecord {
  const snapshot = asJsonObject(row.snapshot_json);
  const app = asJsonObject(snapshot.app);
  const summary = asJsonObject(row.summary_json);
  return {
    id: row.id,
    appName: row.app_name,
    appDisplayName: row.app_display_name,
    version: row.version_no,
    config: asJsonObject(app.config),
    changedAreas: asStringArray(summary.changedAreas),
    surfaces: asStringArray(summary.surfaces),
    skillCount: Number(summary.skillCount || 0),
    mcpCount: Number(summary.mcpCount || 0),
    menuCount: Number(summary.menuCount || 0),
    assetCount: Number(summary.assetCount || 0),
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdByUsername: row.created_by_username,
    createdAt: row.created_at.toISOString(),
    publishedAt: row.published_at.toISOString(),
  };
}

function mapAuditRow(row: PortalAuditRow): PortalAppAuditRecord {
  return {
    id: row.id,
    appName: row.app_name,
    appDisplayName: row.app_display_name,
    action: row.action,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    actorUsername: row.actor_username,
    payload: asJsonObject(row.payload),
    createdAt: row.created_at.toISOString(),
  };
}

function mapRuntimeReleaseRow(row: PortalRuntimeReleaseRow): PortalRuntimeReleaseRecord {
  return {
    id: row.id,
    runtimeKind: row.runtime_kind,
    version: row.version,
    channel: row.channel,
    platform: row.platform,
    arch: row.arch,
    targetTriple: row.target_triple,
    artifactType: row.artifact_type,
    storageProvider: row.storage_provider,
    bucketName: row.bucket_name,
    objectKey: row.object_key,
    artifactUrl: row.artifact_url,
    artifactSha256: row.artifact_sha256,
    artifactSizeBytes: row.artifact_size_bytes === null ? null : Number(row.artifact_size_bytes),
    launcherRelativePath: row.launcher_relative_path,
    gitCommit: row.git_commit,
    gitTag: row.git_tag,
    releaseVersion: row.release_version,
    buildTime: row.build_time ? row.build_time.toISOString() : null,
    buildInfo: asJsonObject(row.build_info_json),
    metadata: asJsonObject(row.metadata_json),
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
  };
}

function mapRuntimeReleaseBindingRow(row: PortalRuntimeReleaseBindingRow): PortalRuntimeReleaseBindingRecord {
  return {
    id: row.id,
    scopeType: row.scope_type,
    scopeKey: row.scope_key,
    runtimeKind: row.runtime_kind,
    channel: row.channel,
    platform: row.platform,
    arch: row.arch,
    targetTriple: row.target_triple,
    releaseId: row.release_id,
    enabled: row.enabled,
    metadata: asJsonObject(row.metadata_json),
    updatedBy: row.updated_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapRuntimeReleaseBindingHistoryRow(
  row: PortalRuntimeReleaseBindingHistoryRow,
): PortalRuntimeReleaseBindingHistoryRecord {
  return {
    id: row.id,
    bindingId: row.binding_id,
    scopeType: row.scope_type,
    scopeKey: row.scope_key,
    runtimeKind: row.runtime_kind,
    channel: row.channel,
    platform: row.platform,
    arch: row.arch,
    targetTriple: row.target_triple,
    fromReleaseId: row.from_release_id,
    toReleaseId: row.to_release_id,
    changeReason: row.change_reason,
    operatorUserId: row.operator_user_id,
    metadata: asJsonObject(row.metadata_json),
    createdAt: row.created_at.toISOString(),
  };
}

function buildReleaseSummary(state: PortalAppSnapshotState): PortalJsonObject {
  const config = state.app.config;
  const surfaces = Object.entries(asJsonObject(config.surfaces))
    .filter(([, value]) => asJsonObject(value).enabled !== false)
    .map(([key]) => key);
  return {
    changedAreas: ['config', 'skills', 'mcps', 'models', 'menus', 'recharge', 'composer', 'assets'],
    surfaces,
    skillCount: state.skillBindings.filter((item) => item.enabled).length,
    mcpCount: state.mcpBindings.filter((item) => item.enabled).length,
    modelCount: state.modelBindings.filter((item) => item.enabled).length,
    menuCount: state.menuBindings.filter((item) => item.enabled).length,
    rechargeCount: state.rechargePackageBindings.filter((item) => item.enabled).length,
    composerControlCount: state.composerControlBindings.filter((item) => item.enabled).length,
    composerShortcutCount: state.composerShortcutBindings.filter((item) => item.enabled).length,
    assetCount: state.assets.length,
  };
}

async function readAppRow(db: Pool | PoolClient, appName: string, forUpdate = false): Promise<PortalAppRow | null> {
  const result = await db.query<PortalAppRow>(
    `
      select
        app_name,
        display_name,
        description,
        status,
        default_locale,
        config_json,
        created_at,
        updated_at
      from oem_apps
      where app_name = $1
      ${forUpdate ? 'for update' : ''}
      limit 1
    `,
    [appName],
  );
  return result.rows[0] || null;
}

async function listSkillBindings(db: Pool | PoolClient, appName: string): Promise<PortalAppSkillBindingRecord[]> {
  const result = await db.query<PortalSkillBindingRow>(
    `
      select app_name, skill_slug, enabled, sort_order, config_json
      from oem_bundled_skills
      where app_name = $1
      order by sort_order asc, skill_slug asc
    `,
    [appName],
  );
  return result.rows.map(mapSkillBindingRow);
}

async function listActivePlatformBundledSkillSlugs(db: Pool | PoolClient): Promise<Set<string>> {
  const result = await db.query<{skill_slug: string}>(
    `
      select skill_slug
      from platform_bundled_skills
      where active = true
    `,
  );
  return new Set(
    result.rows
      .map((row) => String(row.skill_slug || '').trim())
      .filter(Boolean),
  );
}

async function listActivePlatformBundledMcpKeys(db: Pool | PoolClient): Promise<Set<string>> {
  const result = await db.query<{mcp_key: string}>(
    `
      select mcp_key
      from platform_bundled_mcps
      where active = true
    `,
  );
  return new Set(
    result.rows
      .map((row) => String(row.mcp_key || '').trim())
      .filter(Boolean),
  );
}

async function listMcpBindings(db: Pool | PoolClient, appName: string): Promise<PortalAppMcpBindingRecord[]> {
  const result = await db.query<PortalMcpBindingRow>(
    `
      select app_name, mcp_key, enabled, sort_order, config_json
      from oem_bundled_mcps
      where app_name = $1
      order by sort_order asc, mcp_key asc
    `,
    [appName],
  );
  return result.rows.map(mapMcpBindingRow);
}

async function listModelBindings(db: Pool | PoolClient, appName: string): Promise<PortalAppModelBindingRecord[]> {
  const result = await db.query<PortalModelBindingRow>(
    `
      select
        b.app_name,
        b.model_ref,
        b.enabled,
        b.sort_order,
        b.config_json,
        m.ref as catalog_ref,
        m.label as catalog_label,
        m.provider_id as catalog_provider_id,
        m.model_id as catalog_model_id,
        m.api as catalog_api,
        m.base_url as catalog_base_url,
        m.use_runtime_openai as catalog_use_runtime_openai,
        m.auth_header as catalog_auth_header,
        m.reasoning as catalog_reasoning,
        m.input_json as catalog_input_json,
        m.context_window as catalog_context_window,
        m.max_tokens as catalog_max_tokens,
        m.metadata_json as catalog_metadata_json,
        m.active as catalog_active,
        m.created_at as catalog_created_at,
        m.updated_at as catalog_updated_at
      from oem_app_model_bindings b
      left join oem_model_catalog m on m.ref = b.model_ref
      where b.app_name = $1
      order by b.sort_order asc, b.model_ref asc
    `,
    [appName],
  );
  return result.rows.map(mapModelBindingRow);
}

async function listMenuBindings(db: Pool | PoolClient, appName: string): Promise<PortalAppMenuBindingRecord[]> {
  const result = await db.query<PortalMenuBindingRow>(
    `
      select app_name, menu_key, enabled, sort_order, config_json
      from oem_app_menu_bindings
      where app_name = $1
      order by sort_order asc, menu_key asc
    `,
    [appName],
  );
  return result.rows.map(mapMenuBindingRow);
}

async function listRechargePackageBindings(
  db: Pool | PoolClient,
  appName: string,
): Promise<PortalAppRechargePackageBindingRecord[]> {
  const result = await db.query<PortalRechargePackageBindingRow>(
    `
      select app_name, package_id, enabled, sort_order, recommended, is_default, config_json
      from oem_app_recharge_package_bindings
      where app_name = $1
      order by sort_order asc, package_id asc
    `,
    [appName],
  );
  return result.rows.map(mapRechargePackageBindingRow);
}

async function listComposerControlBindings(
  db: Pool | PoolClient,
  appName: string,
): Promise<PortalAppComposerControlBindingRecord[]> {
  const result = await db.query<PortalComposerControlBindingRow>(
    `
      select app_name, control_key, enabled, sort_order, config_json
      from oem_app_composer_control_bindings
      where app_name = $1
      order by sort_order asc, control_key asc
    `,
    [appName],
  );
  return result.rows.map(mapComposerControlBindingRow);
}

async function listComposerShortcutBindings(
  db: Pool | PoolClient,
  appName: string,
): Promise<PortalAppComposerShortcutBindingRecord[]> {
  const result = await db.query<PortalComposerShortcutBindingRow>(
    `
      select app_name, shortcut_key, enabled, sort_order, config_json
      from oem_app_composer_shortcut_bindings
      where app_name = $1
      order by sort_order asc, shortcut_key asc
    `,
    [appName],
  );
  return result.rows.map(mapComposerShortcutBindingRow);
}

async function listAssetsByApp(db: Pool | PoolClient, appName: string): Promise<PortalAppAssetRecord[]> {
  const result = await db.query<PortalAssetRow>(
    `
      select
        a.id,
        a.app_name,
        p.display_name as app_display_name,
        a.asset_key,
        a.storage_provider,
        a.object_key,
        a.public_url,
        a.content_type,
        a.sha256,
        a.size_bytes,
        a.metadata_json,
        a.created_by,
        a.created_at,
        a.updated_at
      from oem_app_assets a
      join oem_apps p on p.app_name = a.app_name
      where a.app_name = $1
      order by a.asset_key asc
    `,
    [appName],
  );
  return result.rows.map(mapAssetRow);
}

async function listReleasesByApp(db: Pool | PoolClient, appName: string, limit: number): Promise<PortalAppReleaseRecord[]> {
  const result = await db.query<PortalReleaseRow>(
    `
      select
        r.id,
        r.app_name,
        p.display_name as app_display_name,
        r.version_no,
        r.snapshot_json,
        r.summary_json,
        r.created_by,
        u.display_name as created_by_name,
        u.username as created_by_username,
        r.created_at,
        r.published_at
      from oem_app_releases r
      join oem_apps p on p.app_name = r.app_name
      left join users u on u.id = r.created_by
      where r.app_name = $1
      order by r.published_at desc, r.version_no desc
      limit $2
    `,
    [appName, limit],
  );
  return result.rows.map(mapReleaseRow);
}

async function listAuditByApp(db: Pool | PoolClient, appName: string, limit: number): Promise<PortalAppAuditRecord[]> {
  const result = await db.query<PortalAuditRow>(
    `
      select
        e.id,
        e.app_name,
        p.display_name as app_display_name,
        e.action,
        e.actor_user_id,
        u.display_name as actor_name,
        u.username as actor_username,
        e.payload,
        e.created_at
      from oem_app_audit_events e
      join oem_apps p on p.app_name = e.app_name
      left join users u on u.id = e.actor_user_id
      where e.app_name = $1
      order by e.created_at desc
      limit $2
    `,
    [appName, limit],
  );
  return result.rows.map(mapAuditRow);
}

async function readAppSnapshotState(db: Pool | PoolClient, appName: string, forUpdate = false): Promise<PortalAppSnapshotState | null> {
  const appRow = await readAppRow(db, appName, forUpdate);
  if (!appRow) return null;
  const [
    skillBindings,
    mcpBindings,
    modelBindings,
    menuBindings,
    composerControlBindings,
    composerShortcutBindings,
    rechargePackageBindings,
    assets,
  ] = await Promise.all([
    listSkillBindings(db, appName),
    listMcpBindings(db, appName),
    listModelBindings(db, appName),
    listMenuBindings(db, appName),
    listComposerControlBindings(db, appName),
    listComposerShortcutBindings(db, appName),
    listRechargePackageBindings(db, appName),
    listAssetsByApp(db, appName),
  ]);
  return {
    app: mapAppRow(appRow),
    skillBindings,
    mcpBindings,
    modelBindings,
    menuBindings,
    composerControlBindings,
    composerShortcutBindings,
    rechargePackageBindings,
    assets,
  };
}

async function insertAuditEvent(
  db: Pool | PoolClient,
  input: {
    appName: string;
    action: string;
    actorUserId: string | null;
    payload: PortalJsonObject;
  },
): Promise<void> {
  await db.query(
    `
      insert into oem_app_audit_events (
        id,
        app_name,
        action,
        actor_user_id,
        payload,
        created_at
      )
      values ($1, $2, $3, $4, $5::jsonb, now())
    `,
    [randomUUID(), input.appName, input.action, input.actorUserId, JSON.stringify(input.payload)],
  );
}

async function replaceSkillBindings(
  db: Pool | PoolClient,
  appName: string,
  items: ReplacePortalAppSkillBindingsInput,
): Promise<void> {
  const platformSkillSlugs = await listActivePlatformBundledSkillSlugs(db);
  const filteredItems = items
    .map((item) => ({
      ...item,
      skillSlug: String(item.skillSlug || '').trim(),
    }))
    .filter((item) => item.skillSlug && !platformSkillSlugs.has(item.skillSlug));
  const slugs = filteredItems.map((item) => item.skillSlug);
  await db.query(
    `
      delete from oem_bundled_skills
      where app_name = $1
        and (
          cardinality($2::text[]) = 0
          or skill_slug <> all($2::text[])
        )
    `,
    [appName, slugs],
  );
  for (const item of filteredItems) {
    await db.query(
      `
        insert into oem_bundled_skills (
          app_name,
          skill_slug,
          enabled,
          sort_order,
          config_json
        )
        values ($1, $2, $3, $4, $5::jsonb)
        on conflict (app_name, skill_slug)
        do update set
          enabled = excluded.enabled,
          sort_order = excluded.sort_order,
          config_json = excluded.config_json,
          updated_at = now()
      `,
      [appName, item.skillSlug, item.enabled ?? true, item.sortOrder ?? 100, JSON.stringify(item.config || {})],
    );
  }
}

async function replaceMcpBindings(
  db: Pool | PoolClient,
  appName: string,
  items: ReplacePortalAppMcpBindingsInput,
): Promise<void> {
  const platformMcpKeys = await listActivePlatformBundledMcpKeys(db);
  const filteredItems = items
    .map((item) => ({
      ...item,
      mcpKey: String(item.mcpKey || '').trim(),
    }))
    .filter((item) => item.mcpKey && !platformMcpKeys.has(item.mcpKey));
  const keys = filteredItems.map((item) => item.mcpKey);
  await db.query(
    `
      delete from oem_bundled_mcps
      where app_name = $1
        and (
          cardinality($2::text[]) = 0
          or mcp_key <> all($2::text[])
        )
    `,
    [appName, keys],
  );
  for (const item of filteredItems) {
    await db.query(
      `
        insert into oem_bundled_mcps (
          app_name,
          mcp_key,
          enabled,
          sort_order,
          config_json
        )
        values ($1, $2, $3, $4, $5::jsonb)
        on conflict (app_name, mcp_key)
        do update set
          enabled = excluded.enabled,
          sort_order = excluded.sort_order,
          config_json = excluded.config_json,
          updated_at = now()
      `,
      [appName, item.mcpKey, item.enabled ?? true, item.sortOrder ?? 100, JSON.stringify(item.config || {})],
    );
  }
}

async function replaceModelBindings(
  db: Pool | PoolClient,
  appName: string,
  items: ReplacePortalAppModelBindingsInput,
): Promise<void> {
  const refs = items.map((item) => item.modelRef);
  await db.query(
    `
      delete from oem_app_model_bindings
      where app_name = $1
        and (
          cardinality($2::text[]) = 0
          or model_ref <> all($2::text[])
        )
    `,
    [appName, refs],
  );
  for (const item of items) {
    await db.query(
      `
        insert into oem_app_model_bindings (
          app_name,
          model_ref,
          enabled,
          sort_order,
          config_json
        )
        values ($1, $2, $3, $4, $5::jsonb)
        on conflict (app_name, model_ref)
        do update set
          enabled = excluded.enabled,
          sort_order = excluded.sort_order,
          config_json = excluded.config_json,
          updated_at = now()
      `,
      [
        appName,
        item.modelRef,
        item.enabled ?? true,
        item.sortOrder ?? 100,
        JSON.stringify({
          ...(item.config || {}),
          recommended: item.recommended === true,
          default: item.default === true,
        }),
      ],
    );
  }
}

async function replaceMenuBindings(
  db: Pool | PoolClient,
  appName: string,
  items: ReplacePortalAppMenuBindingsInput,
): Promise<void> {
  const keys = items.map((item) => item.menuKey);
  await db.query(
    `
      delete from oem_app_menu_bindings
      where app_name = $1
        and (
          cardinality($2::text[]) = 0
          or menu_key <> all($2::text[])
        )
    `,
    [appName, keys],
  );
  for (const item of items) {
    await db.query(
      `
        insert into oem_app_menu_bindings (
          app_name,
          menu_key,
          enabled,
          sort_order,
          config_json
        )
        values ($1, $2, $3, $4, $5::jsonb)
        on conflict (app_name, menu_key)
        do update set
          enabled = excluded.enabled,
          sort_order = excluded.sort_order,
          config_json = excluded.config_json,
          updated_at = now()
      `,
      [appName, item.menuKey, item.enabled ?? true, item.sortOrder ?? 100, JSON.stringify(item.config || {})],
    );
  }
}

async function replaceRechargePackageBindings(
  db: Pool | PoolClient,
  appName: string,
  items: ReplacePortalAppRechargePackageBindingsInput,
): Promise<void> {
  const packageIds = items.map((item) => item.packageId);
  await db.query(
    `
      delete from oem_app_recharge_package_bindings
      where app_name = $1
        and (
          cardinality($2::text[]) = 0
          or package_id <> all($2::text[])
        )
    `,
    [appName, packageIds],
  );
  for (const item of items) {
    await db.query(
      `
        insert into oem_app_recharge_package_bindings (
          app_name,
          package_id,
          enabled,
          sort_order,
          recommended,
          is_default,
          config_json
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        on conflict (app_name, package_id)
        do update set
          enabled = excluded.enabled,
          sort_order = excluded.sort_order,
          recommended = excluded.recommended,
          is_default = excluded.is_default,
          config_json = excluded.config_json,
          updated_at = now()
      `,
      [
        appName,
        item.packageId,
        item.enabled ?? true,
        item.sortOrder ?? 100,
        item.recommended === true,
        item.default === true,
        JSON.stringify(item.config || {}),
      ],
    );
  }
}

async function seedRechargePackageBindings(
  db: Pool | PoolClient,
  appName: string,
  items: ReplacePortalAppRechargePackageBindingsInput,
): Promise<void> {
  for (const item of items) {
    await db.query(
      `
        insert into oem_app_recharge_package_bindings (
          app_name,
          package_id,
          enabled,
          sort_order,
          recommended,
          is_default,
          config_json
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        on conflict (app_name, package_id) do nothing
      `,
      [
        appName,
        item.packageId,
        item.enabled ?? true,
        item.sortOrder ?? 100,
        item.recommended === true,
        item.default === true,
        JSON.stringify(item.config || {}),
      ],
    );
  }
}

async function seedSkillBindings(
  db: Pool | PoolClient,
  appName: string,
  items: ReplacePortalAppSkillBindingsInput,
): Promise<void> {
  const platformSkillSlugs = await listActivePlatformBundledSkillSlugs(db);
  for (const item of items) {
    const skillSlug = String(item.skillSlug || '').trim();
    if (!skillSlug || platformSkillSlugs.has(skillSlug)) {
      continue;
    }
    await db.query(
      `
        insert into oem_bundled_skills (
          app_name,
          skill_slug,
          enabled,
          sort_order,
          config_json
        )
        values ($1, $2, $3, $4, $5::jsonb)
        on conflict (app_name, skill_slug) do nothing
      `,
      [appName, skillSlug, item.enabled ?? true, item.sortOrder ?? 100, JSON.stringify(item.config || {})],
    );
  }
}

async function seedMcpBindings(
  db: Pool | PoolClient,
  appName: string,
  items: ReplacePortalAppMcpBindingsInput,
): Promise<void> {
  const platformMcpKeys = await listActivePlatformBundledMcpKeys(db);
  for (const item of items) {
    const mcpKey = String(item.mcpKey || '').trim();
    if (!mcpKey || platformMcpKeys.has(mcpKey)) {
      continue;
    }
    await db.query(
      `
        insert into oem_bundled_mcps (
          app_name,
          mcp_key,
          enabled,
          sort_order,
          config_json
        )
        values ($1, $2, $3, $4, $5::jsonb)
        on conflict (app_name, mcp_key) do nothing
      `,
      [appName, mcpKey, item.enabled ?? true, item.sortOrder ?? 100, JSON.stringify(item.config || {})],
    );
  }
}

async function seedModelBindings(
  db: Pool | PoolClient,
  appName: string,
  items: ReplacePortalAppModelBindingsInput,
): Promise<void> {
  for (const item of items) {
    await db.query(
      `
        insert into oem_app_model_bindings (
          app_name,
          model_ref,
          enabled,
          sort_order,
          config_json
        )
        values ($1, $2, $3, $4, $5::jsonb)
        on conflict (app_name, model_ref) do nothing
      `,
      [
        appName,
        item.modelRef,
        item.enabled ?? true,
        item.sortOrder ?? 100,
        JSON.stringify({
          ...(item.config || {}),
          recommended: item.recommended === true,
          default: item.default === true,
        }),
      ],
    );
  }
}

async function seedMenuBindings(
  db: Pool | PoolClient,
  appName: string,
  items: ReplacePortalAppMenuBindingsInput,
): Promise<void> {
  for (const item of items) {
    await db.query(
      `
        insert into oem_app_menu_bindings (
          app_name,
          menu_key,
          enabled,
          sort_order,
          config_json
        )
        values ($1, $2, $3, $4, $5::jsonb)
        on conflict (app_name, menu_key) do nothing
      `,
      [appName, item.menuKey, item.enabled ?? true, item.sortOrder ?? 100, JSON.stringify(item.config || {})],
    );
  }
}

async function seedComposerControlBindings(
  db: Pool | PoolClient,
  appName: string,
  items: ReplacePortalAppComposerControlBindingsInput,
): Promise<void> {
  for (const item of items) {
    await db.query(
      `
        insert into oem_app_composer_control_bindings (
          app_name,
          control_key,
          enabled,
          sort_order,
          config_json
        )
        values ($1, $2, $3, $4, $5::jsonb)
        on conflict (app_name, control_key) do nothing
      `,
      [appName, item.controlKey, item.enabled ?? true, item.sortOrder ?? 100, JSON.stringify(item.config || {})],
    );
  }
}

async function seedComposerShortcutBindings(
  db: Pool | PoolClient,
  appName: string,
  items: ReplacePortalAppComposerShortcutBindingsInput,
): Promise<void> {
  for (const item of items) {
    await db.query(
      `
        insert into oem_app_composer_shortcut_bindings (
          app_name,
          shortcut_key,
          enabled,
          sort_order,
          config_json
        )
        values ($1, $2, $3, $4, $5::jsonb)
        on conflict (app_name, shortcut_key) do nothing
      `,
      [appName, item.shortcutKey, item.enabled ?? true, item.sortOrder ?? 100, JSON.stringify(item.config || {})],
    );
  }
}

async function replaceComposerControlBindings(
  db: Pool | PoolClient,
  appName: string,
  items: ReplacePortalAppComposerControlBindingsInput,
): Promise<void> {
  const keys = items.map((item) => item.controlKey);
  await db.query(
    `
      delete from oem_app_composer_control_bindings
      where app_name = $1
        and (
          cardinality($2::text[]) = 0
          or control_key <> all($2::text[])
        )
    `,
    [appName, keys],
  );
  for (const item of items) {
    await db.query(
      `
        insert into oem_app_composer_control_bindings (
          app_name,
          control_key,
          enabled,
          sort_order,
          config_json
        )
        values ($1, $2, $3, $4, $5::jsonb)
        on conflict (app_name, control_key)
        do update set
          enabled = excluded.enabled,
          sort_order = excluded.sort_order,
          config_json = excluded.config_json,
          updated_at = now()
      `,
      [appName, item.controlKey, item.enabled ?? true, item.sortOrder ?? 100, JSON.stringify(item.config || {})],
    );
  }
}

async function replaceComposerShortcutBindings(
  db: Pool | PoolClient,
  appName: string,
  items: ReplacePortalAppComposerShortcutBindingsInput,
): Promise<void> {
  const keys = items.map((item) => item.shortcutKey);
  await db.query(
    `
      delete from oem_app_composer_shortcut_bindings
      where app_name = $1
        and (
          cardinality($2::text[]) = 0
          or shortcut_key <> all($2::text[])
        )
    `,
    [appName, keys],
  );
  for (const item of items) {
    await db.query(
      `
        insert into oem_app_composer_shortcut_bindings (
          app_name,
          shortcut_key,
          enabled,
          sort_order,
          config_json
        )
        values ($1, $2, $3, $4, $5::jsonb)
        on conflict (app_name, shortcut_key)
        do update set
          enabled = excluded.enabled,
          sort_order = excluded.sort_order,
          config_json = excluded.config_json,
          updated_at = now()
      `,
      [appName, item.shortcutKey, item.enabled ?? true, item.sortOrder ?? 100, JSON.stringify(item.config || {})],
    );
  }
}

async function replaceAssets(
  db: Pool | PoolClient,
  appName: string,
  items: PortalAppAssetRecord[],
): Promise<void> {
  const keys = items.map((item) => item.assetKey);
  await db.query(
    `
      delete from oem_app_assets
      where app_name = $1
        and (
          cardinality($2::text[]) = 0
          or asset_key <> all($2::text[])
        )
    `,
    [appName, keys],
  );
  for (const item of items) {
    await db.query(
      `
        insert into oem_app_assets (
          id,
          app_name,
          asset_key,
          storage_provider,
          object_key,
          public_url,
          content_type,
          sha256,
          size_bytes,
          metadata_json,
          created_by,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, now(), now())
        on conflict (app_name, asset_key)
        do update set
          storage_provider = excluded.storage_provider,
          object_key = excluded.object_key,
          public_url = excluded.public_url,
          content_type = excluded.content_type,
          sha256 = excluded.sha256,
          size_bytes = excluded.size_bytes,
          metadata_json = excluded.metadata_json,
          updated_at = now()
      `,
      [
        item.id || randomUUID(),
        appName,
        item.assetKey,
        item.storageProvider || 's3',
        item.objectKey,
        item.publicUrl || null,
        item.contentType || null,
        item.sha256 || null,
        item.sizeBytes ?? null,
        JSON.stringify(item.metadata || {}),
        item.createdBy || null,
      ],
    );
  }
}

export class PgPortalStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = createPgPool(databaseUrl, 'portal-store');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async getSystemState(stateKey: string): Promise<PortalJsonObject | null> {
    const result = await this.pool.query<PortalSystemStateRow>(
      `
        select
          state_key,
          state_value,
          updated_at
        from oem_system_state
        where state_key = $1
        limit 1
      `,
      [stateKey],
    );
    return result.rows[0] ? asJsonObject(result.rows[0].state_value) : null;
  }

  async setSystemState(stateKey: string, stateValue: PortalJsonObject): Promise<void> {
    await this.pool.query(
      `
        insert into oem_system_state (
          state_key,
          state_value,
          updated_at
        )
        values ($1, $2::jsonb, now())
        on conflict (state_key)
        do update set
          state_value = excluded.state_value,
          updated_at = now()
      `,
      [stateKey, JSON.stringify(stateValue)],
    );
  }

  async listApps(): Promise<PortalAppRecord[]> {
    const result = await this.pool.query<PortalAppRow>(
      `
        select
          app_name,
          display_name,
          description,
          status,
          default_locale,
          config_json,
          created_at,
          updated_at
        from oem_apps
        order by app_name asc
      `,
    );
    return result.rows.map(mapAppRow);
  }

  async getAppDetail(appName: string): Promise<PortalAppDetail | null> {
    const state = await readAppSnapshotState(this.pool, appName);
    if (!state) return null;
    const [releases, audit] = await Promise.all([
      listReleasesByApp(this.pool, appName, 20),
      listAuditByApp(this.pool, appName, 20),
    ]);
    return {
      app: state.app,
      skillBindings: state.skillBindings,
      mcpBindings: state.mcpBindings,
      modelBindings: state.modelBindings,
      menuBindings: state.menuBindings,
      composerControlBindings: state.composerControlBindings,
      composerShortcutBindings: state.composerShortcutBindings,
      rechargePackageBindings: state.rechargePackageBindings,
      assets: state.assets,
      releases,
      audit,
    };
  }

  async upsertApp(input: UpsertPortalAppInput, actorUserId: string | null = null): Promise<PortalAppRecord> {
    const result = await this.pool.query<PortalAppRow>(
      `
        insert into oem_apps (
          app_name,
          display_name,
          description,
          status,
          default_locale,
          config_json,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6::jsonb, now(), now())
        on conflict (app_name)
        do update set
          display_name = excluded.display_name,
          description = excluded.description,
          status = excluded.status,
          default_locale = excluded.default_locale,
          config_json = excluded.config_json,
          updated_at = now()
        returning
          app_name,
          display_name,
          description,
          status,
          default_locale,
          config_json,
          created_at,
          updated_at
      `,
      [
        input.appName,
        input.displayName,
        input.description || null,
        input.status || 'active',
        input.defaultLocale || 'zh-CN',
        JSON.stringify(input.config || {}),
      ],
    );
    await insertAuditEvent(this.pool, {
      appName: input.appName,
      action: 'app_saved',
      actorUserId,
      payload: {
        displayName: input.displayName,
        status: input.status || 'active',
      },
    });
    return mapAppRow(result.rows[0]);
  }

  async listSkills(): Promise<PortalSkillRecord[]> {
    const result = await this.pool.query<PortalSkillRow>(
      `
        select
          p.skill_slug as slug,
          c.name,
          c.description,
          c.market,
          c.category,
          c.skill_type,
          c.publisher,
          c.distribution,
          c.tags,
          c.version,
          c.source_url,
          null::text as object_key,
          null::text as content_sha256,
          p.metadata_json,
          p.active,
          p.created_at,
          p.updated_at
        from platform_bundled_skills p
        join cloud_skill_catalog c
          on c.slug = p.skill_slug
        order by p.sort_order asc, c.name asc, p.skill_slug asc
      `,
    );
    return result.rows.map(mapSkillRow);
  }

  async listMenus(): Promise<PortalMenuRecord[]> {
    const result = await this.pool.query<PortalMenuRow>(
      `
        select
          menu_key,
          display_name,
          category,
          route_key,
          icon_key,
          metadata_json,
          active,
          created_at,
          updated_at
        from oem_menu_catalog
        order by category asc nulls last, menu_key asc
      `,
    );
    return result.rows.map(mapMenuRow);
  }

  async listRechargePackages(): Promise<PortalRechargePackageRecord[]> {
    const result = await this.pool.query<PortalRechargePackageRow>(
      `
        select
          package_id,
          package_name,
          credits,
          bonus_credits,
          amount_cny_fen,
          sort_order,
          recommended,
          is_default,
          metadata_json,
          active,
          created_at,
          updated_at
        from platform_recharge_package_catalog
        order by sort_order asc, package_id asc
      `,
    );
    return result.rows.map(mapRechargePackageRow);
  }

  async getRechargePackage(packageId: string): Promise<PortalRechargePackageRecord | null> {
    const result = await this.pool.query<PortalRechargePackageRow>(
      `
        select
          package_id,
          package_name,
          credits,
          bonus_credits,
          amount_cny_fen,
          sort_order,
          recommended,
          is_default,
          metadata_json,
          active,
          created_at,
          updated_at
        from platform_recharge_package_catalog
        where package_id = $1
        limit 1
      `,
      [packageId],
    );
    return result.rows[0] ? mapRechargePackageRow(result.rows[0]) : null;
  }

  async listComposerControls(): Promise<PortalComposerControlRecord[]> {
    const [controlsResult, optionsResult] = await Promise.all([
      this.pool.query<PortalComposerControlRow>(
        `
          select
            control_key,
            display_name,
            control_type,
            icon_key,
            metadata_json,
            active,
            created_at,
            updated_at
          from oem_composer_control_catalog
          order by control_key asc
        `,
      ),
      this.pool.query<PortalComposerControlOptionRow>(
        `
          select
            control_key,
            option_value,
            label,
            description,
            sort_order,
            metadata_json,
            active,
            created_at,
            updated_at
          from oem_composer_control_option_catalog
          order by control_key asc, sort_order asc, option_value asc
        `,
      ),
    ]);
    const optionsByControl = new Map<string, PortalComposerControlOptionRecord[]>();
    for (const row of optionsResult.rows) {
      const mapped = mapComposerControlOptionRow(row);
      const bucket = optionsByControl.get(mapped.controlKey) || [];
      bucket.push(mapped);
      optionsByControl.set(mapped.controlKey, bucket);
    }
    return controlsResult.rows.map((row) => mapComposerControlRow(row, optionsByControl.get(row.control_key) || []));
  }

  async listComposerShortcuts(): Promise<PortalComposerShortcutRecord[]> {
    const result = await this.pool.query<PortalComposerShortcutRow>(
      `
        select
          shortcut_key,
          display_name,
          description,
          template_text,
          icon_key,
          tone,
          metadata_json,
          active,
          created_at,
          updated_at
        from oem_composer_shortcut_catalog
        order by shortcut_key asc
      `,
    );
    return result.rows.map(mapComposerShortcutRow);
  }

  async getMenu(menuKey: string): Promise<PortalMenuRecord | null> {
    const result = await this.pool.query<PortalMenuRow>(
      `
        select
          menu_key,
          display_name,
          category,
          route_key,
          icon_key,
          metadata_json,
          active,
          created_at,
          updated_at
        from oem_menu_catalog
        where menu_key = $1
        limit 1
      `,
      [menuKey],
    );
    return result.rows[0] ? mapMenuRow(result.rows[0]) : null;
  }

  async upsertMenu(input: UpsertPortalMenuInput): Promise<PortalMenuRecord> {
    const result = await this.pool.query<PortalMenuRow>(
      `
        insert into oem_menu_catalog (
          menu_key,
          display_name,
          category,
          route_key,
          icon_key,
          metadata_json,
          active,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6::jsonb, $7, now(), now())
        on conflict (menu_key)
        do update set
          display_name = excluded.display_name,
          category = excluded.category,
          route_key = excluded.route_key,
          icon_key = excluded.icon_key,
          metadata_json = excluded.metadata_json,
          active = excluded.active,
          updated_at = now()
        returning
          menu_key,
          display_name,
          category,
          route_key,
          icon_key,
          metadata_json,
          active,
          created_at,
          updated_at
      `,
      [
        input.menuKey,
        input.displayName,
        input.category || null,
        input.routeKey || null,
        input.iconKey || null,
        JSON.stringify(input.metadata || {}),
        input.active ?? true,
      ],
    );
    return mapMenuRow(result.rows[0]);
  }

  async upsertRechargePackage(input: UpsertPortalRechargePackageInput): Promise<PortalRechargePackageRecord> {
    const result = await this.pool.query<PortalRechargePackageRow>(
      `
        insert into platform_recharge_package_catalog (
          package_id,
          package_name,
          credits,
          bonus_credits,
          amount_cny_fen,
          sort_order,
          recommended,
          is_default,
          metadata_json,
          active,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, now(), now())
        on conflict (package_id)
        do update set
          package_name = excluded.package_name,
          credits = excluded.credits,
          bonus_credits = excluded.bonus_credits,
          amount_cny_fen = excluded.amount_cny_fen,
          sort_order = excluded.sort_order,
          recommended = excluded.recommended,
          is_default = excluded.is_default,
          metadata_json = excluded.metadata_json,
          active = excluded.active,
          updated_at = now()
        returning
          package_id,
          package_name,
          credits,
          bonus_credits,
          amount_cny_fen,
          sort_order,
          recommended,
          is_default,
          metadata_json,
          active,
          created_at,
          updated_at
      `,
      [
        input.packageId,
        input.packageName,
        input.credits,
        input.bonusCredits ?? 0,
        input.amountCnyFen,
        input.sortOrder ?? 100,
        input.recommended === true,
        input.default === true,
        JSON.stringify(input.metadata || {}),
        input.active !== false,
      ],
    );
    return mapRechargePackageRow(result.rows[0]);
  }

  async getSkill(slug: string): Promise<PortalSkillRecord | null> {
    const result = await this.pool.query<PortalSkillRow>(
      `
        select
          p.skill_slug as slug,
          c.name,
          c.description,
          c.market,
          c.category,
          c.skill_type,
          c.publisher,
          c.distribution,
          c.tags,
          c.version,
          c.source_url,
          null::text as object_key,
          null::text as content_sha256,
          p.metadata_json,
          p.active,
          p.created_at,
          p.updated_at
        from platform_bundled_skills p
        join cloud_skill_catalog c
          on c.slug = p.skill_slug
        where p.skill_slug = $1
        limit 1
      `,
      [slug],
    );
    return mapSkillRow(result.rows[0]) || null;
  }

  async upsertSkill(input: UpsertPortalSkillInput): Promise<PortalSkillRecord> {
    const catalog = await this.pool.query<{slug: string}>(
      `
        select slug
        from cloud_skill_catalog
        where slug = $1
        limit 1
      `,
      [input.slug],
    );
    if (!catalog.rows[0]) {
      throw new HttpError(404, 'NOT_FOUND', `cloud skill not found: ${input.slug}`);
    }
    const sortOrderResult = await this.pool.query<{next_sort_order: number}>(
      `
        select coalesce(max(sort_order), 0) + 10 as next_sort_order
        from platform_bundled_skills
      `,
    );
    await this.pool.query(
      `
        insert into platform_bundled_skills (
          skill_slug,
          sort_order,
          metadata_json,
          active,
          created_at,
          updated_at
        )
        values ($1, $2, $3::jsonb, $4, now(), now())
        on conflict (skill_slug)
        do update set
          metadata_json = excluded.metadata_json,
          active = excluded.active,
          updated_at = now()
      `,
      [
        input.slug,
        Number(sortOrderResult.rows[0]?.next_sort_order || 10),
        JSON.stringify(input.metadata || {}),
        input.active ?? true,
      ],
    );
    const next = await this.getSkill(input.slug);
    if (!next) {
      throw new Error(`platform skill upsert failed: ${input.slug}`);
    }
    return next;
  }

  async deleteSkill(slug: string): Promise<void> {
    await this.pool.query(`delete from platform_bundled_skills where skill_slug = $1`, [slug]);
  }

  async deleteRechargePackage(packageId: string): Promise<void> {
    await this.pool.query(`delete from platform_recharge_package_catalog where package_id = $1`, [packageId]);
  }

  async listMcps(): Promise<PortalMcpRecord[]> {
    const result = await this.pool.query<PortalMcpRow>(
      `
        select
          p.mcp_key,
          c.name,
          c.description,
          c.transport,
          c.object_key,
          c.config_json,
          p.metadata_json,
          p.active,
          p.created_at,
          p.updated_at
        from platform_bundled_mcps p
        join cloud_mcp_catalog c on c.mcp_key = p.mcp_key
        order by p.sort_order asc, p.mcp_key asc
      `,
    );
    return result.rows.map(mapMcpRow);
  }

  async listCloudMcps(): Promise<PortalMcpRecord[]> {
    const result = await this.pool.query<PortalMcpRow>(
      `
        select
          c.mcp_key,
          c.name,
          c.description,
          c.transport,
          c.object_key,
          c.config_json,
          '{}'::jsonb as metadata_json,
          c.active,
          c.created_at,
          c.updated_at
        from cloud_mcp_catalog c
        order by c.name asc, c.mcp_key asc
      `,
    );
    return result.rows.map(mapMcpRow);
  }

  async countCloudMcps(): Promise<number> {
    const result = await this.pool.query<{count: string}>(
      `
        select count(*)::text as count
        from cloud_mcp_catalog
      `,
    );
    return Number(result.rows[0]?.count || '0');
  }

  async countPlatformMcps(): Promise<number> {
    const result = await this.pool.query<{count: string}>(
      `
        select count(*)::text as count
        from platform_bundled_mcps
      `,
    );
    return Number(result.rows[0]?.count || '0');
  }

  async listModels(): Promise<PortalModelRecord[]> {
    const result = await this.pool.query<PortalModelRow>(
      `
        select
          ref,
          label,
          provider_id,
          model_id,
          api,
          base_url,
          use_runtime_openai,
          auth_header,
          reasoning,
          input_json,
          context_window,
          max_tokens,
          metadata_json,
          active,
          created_at,
          updated_at
        from oem_model_catalog
        order by provider_id asc, label asc, ref asc
      `,
    );
    return result.rows.map(mapModelRow);
  }

  async getModel(ref: string): Promise<PortalModelRecord | null> {
    const result = await this.pool.query<PortalModelRow>(
      `
        select
          ref,
          label,
          provider_id,
          model_id,
          api,
          base_url,
          use_runtime_openai,
          auth_header,
          reasoning,
          input_json,
          context_window,
          max_tokens,
          metadata_json,
          active,
          created_at,
          updated_at
        from oem_model_catalog
        where ref = $1
        limit 1
      `,
      [ref],
    );
    return result.rows[0] ? mapModelRow(result.rows[0]) : null;
  }

  async upsertModel(input: UpsertPortalModelInput): Promise<PortalModelRecord> {
    const result = await this.pool.query<PortalModelRow>(
      `
        insert into oem_model_catalog (
          ref,
          label,
          provider_id,
          model_id,
          api,
          base_url,
          use_runtime_openai,
          auth_header,
          reasoning,
          input_json,
          context_window,
          max_tokens,
          metadata_json,
          active,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13::jsonb, $14, now(), now())
        on conflict (ref)
        do update set
          label = excluded.label,
          provider_id = excluded.provider_id,
          model_id = excluded.model_id,
          api = excluded.api,
          base_url = excluded.base_url,
          use_runtime_openai = excluded.use_runtime_openai,
          auth_header = excluded.auth_header,
          reasoning = excluded.reasoning,
          input_json = excluded.input_json,
          context_window = excluded.context_window,
          max_tokens = excluded.max_tokens,
          metadata_json = excluded.metadata_json,
          active = excluded.active,
          updated_at = now()
        returning
          ref,
          label,
          provider_id,
          model_id,
          api,
          base_url,
          use_runtime_openai,
          auth_header,
          reasoning,
          input_json,
          context_window,
          max_tokens,
          metadata_json,
          active,
          created_at,
          updated_at
      `,
      [
        input.ref,
        input.label,
        input.providerId,
        input.modelId,
        input.api,
        input.baseUrl || null,
        input.useRuntimeOpenai ?? false,
        input.authHeader ?? true,
        input.reasoning ?? false,
        JSON.stringify(input.input || []),
        input.contextWindow || 0,
        input.maxTokens || 0,
        JSON.stringify(input.metadata || {}),
        input.active ?? true,
      ],
    );
    return mapModelRow(result.rows[0]);
  }

  async deleteModel(ref: string): Promise<void> {
    await this.pool.query(`delete from oem_model_catalog where ref = $1`, [ref]);
  }

  async listModelProviderProfiles(
    scopeType?: PortalModelProviderScopeType | null,
    scopeKey?: string | null,
  ): Promise<PortalModelProviderProfileRecord[]> {
    const values: Array<string> = [];
    const filters: string[] = [];
    if (scopeType) {
      values.push(scopeType);
      filters.push(`scope_type = $${values.length}`);
    }
    if (scopeKey && scopeKey.trim()) {
      values.push(scopeKey.trim());
      filters.push(`scope_key = $${values.length}`);
    }
    const whereClause = filters.length ? `where ${filters.join(' and ')}` : '';
    const profilesResult = await this.pool.query<PortalModelProviderProfileRow>(
      `
        select
          id,
          scope_type,
          scope_key,
          provider_key,
          provider_label,
          api_protocol,
          base_url,
          auth_mode,
          api_key,
          logo_preset_key,
          metadata_json,
          enabled,
          sort_order,
          created_at,
          updated_at
        from model_provider_profiles
        ${whereClause}
        order by scope_type asc, scope_key asc, sort_order asc, provider_key asc
      `,
      values,
    );
    if (profilesResult.rows.length === 0) {
      return [];
    }
    const modelsByProfileId = await this.listModelProviderProfileModelsByProfileIds(profilesResult.rows.map((row) => row.id));
    return profilesResult.rows.map((row) => mapModelProviderProfileRow(row, modelsByProfileId.get(row.id) || []));
  }

  async getModelProviderProfile(id: string): Promise<PortalModelProviderProfileRecord | null> {
    const result = await this.pool.query<PortalModelProviderProfileRow>(
      `
        select
          id,
          scope_type,
          scope_key,
          provider_key,
          provider_label,
          api_protocol,
          base_url,
          auth_mode,
          api_key,
          logo_preset_key,
          metadata_json,
          enabled,
          sort_order,
          created_at,
          updated_at
        from model_provider_profiles
        where id = $1
        limit 1
      `,
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    const modelsByProfileId = await this.listModelProviderProfileModelsByProfileIds([id]);
    return mapModelProviderProfileRow(row, modelsByProfileId.get(id) || []);
  }

  async upsertModelProviderProfile(input: UpsertPortalModelProviderProfileInput): Promise<PortalModelProviderProfileRecord> {
    const existing = await this.pool.query<{id: string}>(
      `
        select id
        from model_provider_profiles
        where scope_type = $1
          and scope_key = $2
          and provider_key = $3
        limit 1
      `,
      [input.scopeType, input.scopeKey, input.providerKey],
    );
    const existingProfileId = existing.rows[0]?.id || '';
    const currentProfileResult =
      input.id
        ? await this.pool.query<PortalModelProviderProfileRow>(
            `
              select
                id,
                scope_type,
                scope_key,
                provider_key,
                provider_label,
                api_protocol,
                base_url,
                auth_mode,
                api_key,
                logo_preset_key,
                metadata_json,
                enabled,
                sort_order,
                created_at,
                updated_at
              from model_provider_profiles
              where id = $1
              limit 1
            `,
            [input.id],
          )
        : {rows: [] as PortalModelProviderProfileRow[]};
    const currentProfile = currentProfileResult.rows[0] || null;
    const canReuseCurrentProfileId =
      !existingProfileId &&
      !!currentProfile &&
      currentProfile.scope_type === input.scopeType &&
      currentProfile.scope_key === input.scopeKey;
    const profileId =
      existingProfileId ||
      (canReuseCurrentProfileId ? currentProfile.id : '') ||
      (!currentProfile ? input.id || '' : '') ||
      randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const profileParams = [
        profileId,
        input.scopeType,
        input.scopeKey,
        input.providerKey,
        input.providerLabel,
        input.apiProtocol,
        input.baseUrl,
        input.authMode || 'bearer',
        input.apiKey,
        input.logoPresetKey || null,
        JSON.stringify(input.metadata || {}),
        input.enabled ?? true,
        input.sortOrder ?? 100,
      ];
      const profileResult = canReuseCurrentProfileId
        ? await client.query<{id: string}>(
            `
              update model_provider_profiles
              set
                scope_type = $2,
                scope_key = $3,
                provider_key = $4,
                provider_label = $5,
                api_protocol = $6,
                base_url = $7,
                auth_mode = $8,
                api_key = $9,
                logo_preset_key = $10,
                metadata_json = $11::jsonb,
                enabled = $12,
                sort_order = $13,
                updated_at = now()
              where id = $1
              returning id
            `,
            profileParams,
          )
        : await client.query<{id: string}>(
            `
              insert into model_provider_profiles (
                id,
                scope_type,
                scope_key,
                provider_key,
                provider_label,
                api_protocol,
                base_url,
                auth_mode,
                api_key,
                logo_preset_key,
                metadata_json,
                enabled,
                sort_order,
                created_at,
                updated_at
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, now(), now())
              on conflict (scope_type, scope_key, provider_key)
              do update set
                id = model_provider_profiles.id,
                scope_type = excluded.scope_type,
                scope_key = excluded.scope_key,
                provider_key = excluded.provider_key,
                provider_label = excluded.provider_label,
                api_protocol = excluded.api_protocol,
                base_url = excluded.base_url,
                auth_mode = excluded.auth_mode,
                api_key = excluded.api_key,
                logo_preset_key = excluded.logo_preset_key,
                metadata_json = excluded.metadata_json,
                enabled = excluded.enabled,
                sort_order = excluded.sort_order,
                updated_at = now()
              returning id
            `,
            profileParams,
          );
      const resolvedProfileId = profileResult.rows[0]?.id || profileId;

      if (Array.isArray(input.models)) {
        await client.query(`delete from model_provider_profile_models where profile_id = $1`, [resolvedProfileId]);
        for (const item of input.models) {
          await client.query(
            `
              insert into model_provider_profile_models (
                id,
                profile_id,
                model_ref,
                model_id,
                label,
                logo_preset_key,
                billing_multiplier,
                reasoning,
                input_modalities_json,
                context_window,
                max_tokens,
                enabled,
                sort_order,
                metadata_json,
                created_at,
                updated_at
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14::jsonb, now(), now())
            `,
            [
              item.id || randomUUID(),
              resolvedProfileId,
              item.modelRef,
              item.modelId,
              item.label,
              item.logoPresetKey || null,
              item.billingMultiplier ?? 1,
              item.reasoning ?? false,
              JSON.stringify(item.inputModalities || []),
              item.contextWindow ?? null,
              item.maxTokens ?? null,
              item.enabled ?? true,
              item.sortOrder ?? 100,
              JSON.stringify(item.metadata || {}),
            ],
          );
        }
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    const next = await this.getModelProviderProfile(profileId);
    if (!next) {
      throw new Error(`model provider profile upsert failed: ${profileId}`);
    }
    return next;
  }

  async deleteModelProviderProfile(id: string): Promise<void> {
    await this.pool.query(`delete from model_provider_profiles where id = $1`, [id]);
  }

  async listMemoryEmbeddingProfiles(
    scopeType?: PortalModelProviderScopeType | null,
    scopeKey?: string | null,
  ): Promise<PortalMemoryEmbeddingProfileRecord[]> {
    const values: Array<string> = [];
    const filters: string[] = [];
    if (scopeType) {
      values.push(scopeType);
      filters.push(`scope_type = $${values.length}`);
    }
    if (scopeKey && scopeKey.trim()) {
      values.push(scopeKey.trim());
      filters.push(`scope_key = $${values.length}`);
    }
    const whereClause = filters.length ? `where ${filters.join(' and ')}` : '';
    const result = await this.pool.query<PortalMemoryEmbeddingProfileRow>(
      `
        select
          id,
          scope_type,
          scope_key,
          provider_key,
          provider_label,
          base_url,
          auth_mode,
          api_key,
          embedding_model,
          logo_preset_key,
          auto_recall,
          metadata_json,
          enabled,
          created_at,
          updated_at
        from memory_embedding_profiles
        ${whereClause}
        order by scope_type asc, scope_key asc, provider_key asc
      `,
      values,
    );
    return result.rows.map((row) => mapMemoryEmbeddingProfileRow(row));
  }

  async getMemoryEmbeddingProfile(id: string): Promise<PortalMemoryEmbeddingProfileRecord | null> {
    const result = await this.pool.query<PortalMemoryEmbeddingProfileRow>(
      `
        select
          id,
          scope_type,
          scope_key,
          provider_key,
          provider_label,
          base_url,
          auth_mode,
          api_key,
          embedding_model,
          logo_preset_key,
          auto_recall,
          metadata_json,
          enabled,
          created_at,
          updated_at
        from memory_embedding_profiles
        where id = $1
        limit 1
      `,
      [id],
    );
    return result.rows[0] ? mapMemoryEmbeddingProfileRow(result.rows[0]) : null;
  }

  async upsertMemoryEmbeddingProfile(input: UpsertPortalMemoryEmbeddingProfileInput): Promise<PortalMemoryEmbeddingProfileRecord> {
    const existing = await this.pool.query<{id: string}>(
      `
        select id
        from memory_embedding_profiles
        where scope_type = $1
          and scope_key = $2
        limit 1
      `,
      [input.scopeType, input.scopeKey],
    );
    const currentId = existing.rows[0]?.id || input.id || randomUUID();
    const result = await this.pool.query<PortalMemoryEmbeddingProfileRow>(
      `
        insert into memory_embedding_profiles (
          id,
          scope_type,
          scope_key,
          provider_key,
          provider_label,
          base_url,
          auth_mode,
          api_key,
          embedding_model,
          logo_preset_key,
          auto_recall,
          metadata_json,
          enabled,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, now(), now())
        on conflict (scope_type, scope_key)
        do update set
          id = memory_embedding_profiles.id,
          provider_key = excluded.provider_key,
          provider_label = excluded.provider_label,
          base_url = excluded.base_url,
          auth_mode = excluded.auth_mode,
          api_key = excluded.api_key,
          embedding_model = excluded.embedding_model,
          logo_preset_key = excluded.logo_preset_key,
          auto_recall = excluded.auto_recall,
          metadata_json = excluded.metadata_json,
          enabled = excluded.enabled,
          updated_at = now()
        returning
          id,
          scope_type,
          scope_key,
          provider_key,
          provider_label,
          base_url,
          auth_mode,
          api_key,
          embedding_model,
          logo_preset_key,
          auto_recall,
          metadata_json,
          enabled,
          created_at,
          updated_at
      `,
      [
        currentId,
        input.scopeType,
        input.scopeKey,
        input.providerKey,
        input.providerLabel,
        input.baseUrl,
        input.authMode || 'bearer',
        input.apiKey,
        input.embeddingModel,
        input.logoPresetKey || null,
        input.autoRecall ?? true,
        JSON.stringify(input.metadata || {}),
        input.enabled ?? true,
      ],
    );
    return mapMemoryEmbeddingProfileRow(result.rows[0]);
  }

  async deleteMemoryEmbeddingProfile(id: string): Promise<void> {
    await this.pool.query(`delete from memory_embedding_profiles where id = $1`, [id]);
  }

  async getAppModelRuntimeOverride(appName: string): Promise<PortalAppModelRuntimeOverrideRecord | null> {
    const result = await this.pool.query<PortalAppModelRuntimeOverrideRow>(
      `
        select
          app_name,
          provider_mode,
          active_profile_id,
          cache_version,
          updated_at
        from app_model_runtime_overrides
        where app_name = $1
        limit 1
      `,
      [appName],
    );
    return result.rows[0] ? mapAppModelRuntimeOverrideRow(result.rows[0]) : null;
  }

  async upsertAppModelRuntimeOverride(
    input: UpsertPortalAppModelRuntimeOverrideInput,
  ): Promise<PortalAppModelRuntimeOverrideRecord> {
    const result = await this.pool.query<PortalAppModelRuntimeOverrideRow>(
      `
        insert into app_model_runtime_overrides (
          app_name,
          provider_mode,
          active_profile_id,
          cache_version,
          updated_at
        )
        values ($1, $2, $3, $4, now())
        on conflict (app_name)
        do update set
          provider_mode = excluded.provider_mode,
          active_profile_id = excluded.active_profile_id,
          cache_version = excluded.cache_version,
          updated_at = now()
        returning
          app_name,
          provider_mode,
          active_profile_id,
          cache_version,
          updated_at
      `,
      [
        input.appName,
        input.providerMode || 'inherit_platform',
        input.activeProfileId || null,
        input.cacheVersion ?? 1,
      ],
    );
    return mapAppModelRuntimeOverrideRow(result.rows[0]);
  }

  async resolveRuntimeModels(appName: string): Promise<PortalResolvedRuntimeModelsResult | null> {
    const [appRow, override] = await Promise.all([
      readAppRow(this.pool, appName),
      this.getAppModelRuntimeOverride(appName),
    ]);
    if (!appRow) {
      return null;
    }
    const providerMode = override?.providerMode || 'inherit_platform';
    let resolvedScope: PortalModelProviderScopeType = 'platform';
    let profile: PortalModelProviderProfileRecord | null = null;

    if (providerMode === 'use_app_profile' && override?.activeProfileId) {
      profile = await this.getModelProviderProfile(override.activeProfileId);
      if (profile?.scopeType === 'app' && profile.scopeKey === appName && profile.enabled) {
        resolvedScope = 'app';
      } else {
        profile = null;
      }
    }

    if (!profile) {
      const platformProfiles = await this.listModelProviderProfiles('platform', 'platform');
      profile = platformProfiles.find((item) => item.enabled) || null;
      resolvedScope = 'platform';
    }

    if (!profile) {
      return null;
    }

    const models = profile.models
      .filter((item) => item.enabled)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, 'zh-CN'));
    const versionBase = resolvedScope === 'app' ? override?.cacheVersion ?? 1 : 1;
    const updatedAtMs = Date.parse(profile.updatedAt) || Date.now();

    return {
      appName,
      providerMode,
      resolvedScope,
      profile,
      models,
              version: Math.max(versionBase, updatedAtMs),
    };
  }

  async resolveMemoryEmbedding(appName: string): Promise<PortalResolvedMemoryEmbeddingResult | null> {
    const appResult = await this.pool.query<PortalMemoryEmbeddingProfileRow>(
      `
        select
          id,
          scope_type,
          scope_key,
          provider_key,
          provider_label,
          base_url,
          auth_mode,
          api_key,
          embedding_model,
          logo_preset_key,
          auto_recall,
          metadata_json,
          enabled,
          created_at,
          updated_at
        from memory_embedding_profiles
        where scope_type = 'app'
          and scope_key = $1
          and enabled = true
        limit 1
      `,
      [appName],
    );
    const appProfile = appResult.rows[0];
    if (appProfile) {
      const mapped = mapMemoryEmbeddingProfileRow(appProfile);
      return {
        appName,
        resolvedScope: 'app',
        profile: mapped,
        version: Date.parse(mapped.updatedAt) || Date.now(),
      };
    }

    const platformResult = await this.pool.query<PortalMemoryEmbeddingProfileRow>(
      `
        select
          id,
          scope_type,
          scope_key,
          provider_key,
          provider_label,
          base_url,
          auth_mode,
          api_key,
          embedding_model,
          logo_preset_key,
          auto_recall,
          metadata_json,
          enabled,
          created_at,
          updated_at
        from memory_embedding_profiles
        where scope_type = 'platform'
          and scope_key = 'platform'
          and enabled = true
        limit 1
      `,
      [],
    );
    const platformProfile = platformResult.rows[0];
    if (!platformProfile) {
      return null;
    }
    const mapped = mapMemoryEmbeddingProfileRow(platformProfile);
    return {
      appName,
      resolvedScope: 'platform',
      profile: mapped,
      version: Date.parse(mapped.updatedAt) || Date.now(),
    };
  }

  async listRuntimeReleases(input: ListPortalRuntimeReleasesInput = {}): Promise<PortalRuntimeReleaseRecord[]> {
    const values: Array<string | number> = [];
    const filters: string[] = [];
    if (input.runtimeKind && input.runtimeKind.trim()) {
      values.push(input.runtimeKind.trim());
      filters.push(`runtime_kind = $${values.length}`);
    }
    if (input.channel && input.channel.trim()) {
      values.push(input.channel.trim());
      filters.push(`channel = $${values.length}`);
    }
    if (input.platform && input.platform.trim()) {
      values.push(input.platform.trim());
      filters.push(`platform = $${values.length}`);
    }
    if (input.arch && input.arch.trim()) {
      values.push(input.arch.trim());
      filters.push(`arch = $${values.length}`);
    }
    if (input.status && input.status.trim()) {
      values.push(input.status.trim());
      filters.push(`status = $${values.length}`);
    }
    const limit = Math.max(1, Math.min(Number(input.limit || 100), 200));
    values.push(limit);
    const whereClause = filters.length ? `where ${filters.join(' and ')}` : '';
    const result = await this.pool.query<PortalRuntimeReleaseRow>(
      `
        select
          id,
          runtime_kind,
          version,
          channel,
          platform,
          arch,
          target_triple,
          artifact_type,
          storage_provider,
          bucket_name,
          object_key,
          artifact_url,
          artifact_sha256,
          artifact_size_bytes,
          launcher_relative_path,
          git_commit,
          git_tag,
          release_version,
          build_time,
          build_info_json,
          metadata_json,
          status,
          created_by,
          created_at,
          updated_at,
          published_at
        from runtime_release_catalog
        ${whereClause}
        order by updated_at desc, created_at desc
        limit $${values.length}
      `,
      values,
    );
    return result.rows.map(mapRuntimeReleaseRow);
  }

  async upsertRuntimeRelease(
    input: UpsertPortalRuntimeReleaseInput,
    actorUserId: string | null,
  ): Promise<PortalRuntimeReleaseRecord> {
    let id = input.id?.trim() || '';
    if (!id) {
      const existing = await this.pool.query<{id: string}>(
        `
          select id
          from runtime_release_catalog
          where runtime_kind = $1
            and channel = $2
            and target_triple = $3
            and version = $4
          limit 1
        `,
        [input.runtimeKind, input.channel, input.targetTriple, input.version],
      );
      id = existing.rows[0]?.id || randomUUID();
    }
    const publishedAt = input.status === 'published' ? new Date().toISOString() : null;
    const result = await this.pool.query<PortalRuntimeReleaseRow>(
      `
        insert into runtime_release_catalog (
          id,
          runtime_kind,
          version,
          channel,
          platform,
          arch,
          target_triple,
          artifact_type,
          storage_provider,
          bucket_name,
          object_key,
          artifact_url,
          artifact_sha256,
          artifact_size_bytes,
          launcher_relative_path,
          git_commit,
          git_tag,
          release_version,
          build_time,
          build_info_json,
          metadata_json,
          status,
          created_by,
          created_at,
          updated_at,
          published_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
          $19::timestamptz, $20::jsonb, $21::jsonb, $22, $23, now(), now(), $24::timestamptz
        )
        on conflict (id)
        do update set
          runtime_kind = excluded.runtime_kind,
          version = excluded.version,
          channel = excluded.channel,
          platform = excluded.platform,
          arch = excluded.arch,
          target_triple = excluded.target_triple,
          artifact_type = excluded.artifact_type,
          storage_provider = excluded.storage_provider,
          bucket_name = excluded.bucket_name,
          object_key = excluded.object_key,
          artifact_url = excluded.artifact_url,
          artifact_sha256 = excluded.artifact_sha256,
          artifact_size_bytes = excluded.artifact_size_bytes,
          launcher_relative_path = excluded.launcher_relative_path,
          git_commit = excluded.git_commit,
          git_tag = excluded.git_tag,
          release_version = excluded.release_version,
          build_time = excluded.build_time,
          build_info_json = excluded.build_info_json,
          metadata_json = excluded.metadata_json,
          status = excluded.status,
          created_by = coalesce(runtime_release_catalog.created_by, excluded.created_by),
          updated_at = now(),
          published_at = case
            when excluded.status = 'published' then coalesce(excluded.published_at, runtime_release_catalog.published_at, now())
            else runtime_release_catalog.published_at
          end
        returning
          id,
          runtime_kind,
          version,
          channel,
          platform,
          arch,
          target_triple,
          artifact_type,
          storage_provider,
          bucket_name,
          object_key,
          artifact_url,
          artifact_sha256,
          artifact_size_bytes,
          launcher_relative_path,
          git_commit,
          git_tag,
          release_version,
          build_time,
          build_info_json,
          metadata_json,
          status,
          created_by,
          created_at,
          updated_at,
          published_at
      `,
      [
        id,
        input.runtimeKind,
        input.version,
        input.channel,
        input.platform,
        input.arch,
        input.targetTriple,
        input.artifactType || 'tar.gz',
        input.storageProvider || 's3',
        input.bucketName || null,
        input.objectKey || null,
        input.artifactUrl,
        input.artifactSha256 || null,
        input.artifactSizeBytes ?? null,
        input.launcherRelativePath || null,
        input.gitCommit || null,
        input.gitTag || null,
        input.releaseVersion || null,
        input.buildTime || null,
        JSON.stringify(input.buildInfo || {}),
        JSON.stringify(input.metadata || {}),
        input.status || 'draft',
        actorUserId,
        publishedAt,
      ],
    );
    return mapRuntimeReleaseRow(result.rows[0]);
  }

  async listRuntimeReleaseBindings(
    input: ListPortalRuntimeReleaseBindingsInput = {},
  ): Promise<PortalRuntimeReleaseBindingRecord[]> {
    const values: Array<string | number> = [];
    const filters: string[] = [];
    if (input.scopeType && input.scopeType.trim()) {
      values.push(input.scopeType.trim());
      filters.push(`scope_type = $${values.length}`);
    }
    if (input.scopeKey && input.scopeKey.trim()) {
      values.push(input.scopeKey.trim());
      filters.push(`scope_key = $${values.length}`);
    }
    if (input.runtimeKind && input.runtimeKind.trim()) {
      values.push(input.runtimeKind.trim());
      filters.push(`runtime_kind = $${values.length}`);
    }
    if (input.channel && input.channel.trim()) {
      values.push(input.channel.trim());
      filters.push(`channel = $${values.length}`);
    }
    if (input.platform && input.platform.trim()) {
      values.push(input.platform.trim());
      filters.push(`platform = $${values.length}`);
    }
    if (input.arch && input.arch.trim()) {
      values.push(input.arch.trim());
      filters.push(`arch = $${values.length}`);
    }
    const limit = Math.max(1, Math.min(Number(input.limit || 200), 500));
    values.push(limit);
    const whereClause = filters.length ? `where ${filters.join(' and ')}` : '';
    const result = await this.pool.query<PortalRuntimeReleaseBindingRow>(
      `
        select
          id,
          scope_type,
          scope_key,
          runtime_kind,
          channel,
          platform,
          arch,
          target_triple,
          release_id,
          enabled,
          metadata_json,
          updated_by,
          created_at,
          updated_at
        from runtime_release_bindings
        ${whereClause}
        order by updated_at desc, created_at desc
        limit $${values.length}
      `,
      values,
    );
    return result.rows.map(mapRuntimeReleaseBindingRow);
  }

  async upsertRuntimeReleaseBinding(
    input: UpsertPortalRuntimeReleaseBindingInput,
    actorUserId: string | null,
  ): Promise<PortalRuntimeReleaseBindingRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const existingResult = await client.query<PortalRuntimeReleaseBindingRow>(
        `
          select
            id,
            scope_type,
            scope_key,
            runtime_kind,
            channel,
            platform,
            arch,
            target_triple,
            release_id,
            enabled,
            metadata_json,
            updated_by,
            created_at,
            updated_at
          from runtime_release_bindings
          where scope_type = $1
            and scope_key = $2
            and runtime_kind = $3
            and channel = $4
            and target_triple = $5
          for update
        `,
        [input.scopeType, input.scopeKey, input.runtimeKind, input.channel, input.targetTriple],
      );
      const existing = existingResult.rows[0] || null;
      const bindingId = existing?.id || input.id?.trim() || randomUUID();
      const upsertResult = await client.query<PortalRuntimeReleaseBindingRow>(
        `
          insert into runtime_release_bindings (
            id,
            scope_type,
            scope_key,
            runtime_kind,
            channel,
            platform,
            arch,
            target_triple,
            release_id,
            enabled,
            metadata_json,
            updated_by,
            created_at,
            updated_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, now(), now())
          on conflict (scope_type, scope_key, runtime_kind, channel, target_triple)
          do update set
            release_id = excluded.release_id,
            enabled = excluded.enabled,
            metadata_json = excluded.metadata_json,
            updated_by = excluded.updated_by,
            platform = excluded.platform,
            arch = excluded.arch,
            updated_at = now()
          returning
            id,
            scope_type,
            scope_key,
            runtime_kind,
            channel,
            platform,
            arch,
            target_triple,
            release_id,
            enabled,
            metadata_json,
            updated_by,
            created_at,
            updated_at
        `,
        [
          bindingId,
          input.scopeType,
          input.scopeKey,
          input.runtimeKind,
          input.channel,
          input.platform,
          input.arch,
          input.targetTriple,
          input.releaseId,
          input.enabled !== false,
          JSON.stringify(input.metadata || {}),
          actorUserId,
        ],
      );
      const binding = upsertResult.rows[0];
      await client.query(
        `
          insert into runtime_release_binding_history (
            id,
            binding_id,
            scope_type,
            scope_key,
            runtime_kind,
            channel,
            platform,
            arch,
            target_triple,
            from_release_id,
            to_release_id,
            change_reason,
            operator_user_id,
            metadata_json,
            created_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, now())
        `,
        [
          randomUUID(),
          binding.id,
          binding.scope_type,
          binding.scope_key,
          binding.runtime_kind,
          binding.channel,
          binding.platform,
          binding.arch,
          binding.target_triple,
          existing?.release_id || null,
          binding.release_id,
          input.changeReason || null,
          actorUserId,
          JSON.stringify(input.metadata || {}),
        ],
      );
      await client.query('commit');
      return mapRuntimeReleaseBindingRow(binding);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async listRuntimeReleaseBindingHistory(
    input: ListPortalRuntimeReleaseBindingHistoryInput = {},
  ): Promise<PortalRuntimeReleaseBindingHistoryRecord[]> {
    const values: Array<string | number> = [];
    const filters: string[] = [];
    if (input.bindingId && input.bindingId.trim()) {
      values.push(input.bindingId.trim());
      filters.push(`binding_id = $${values.length}`);
    }
    if (input.scopeType && input.scopeType.trim()) {
      values.push(input.scopeType.trim());
      filters.push(`scope_type = $${values.length}`);
    }
    if (input.scopeKey && input.scopeKey.trim()) {
      values.push(input.scopeKey.trim());
      filters.push(`scope_key = $${values.length}`);
    }
    if (input.runtimeKind && input.runtimeKind.trim()) {
      values.push(input.runtimeKind.trim());
      filters.push(`runtime_kind = $${values.length}`);
    }
    if (input.channel && input.channel.trim()) {
      values.push(input.channel.trim());
      filters.push(`channel = $${values.length}`);
    }
    if (input.targetTriple && input.targetTriple.trim()) {
      values.push(input.targetTriple.trim());
      filters.push(`target_triple = $${values.length}`);
    }
    const limit = Math.max(1, Math.min(Number(input.limit || 100), 500));
    values.push(limit);
    const whereClause = filters.length ? `where ${filters.join(' and ')}` : '';
    const result = await this.pool.query<PortalRuntimeReleaseBindingHistoryRow>(
      `
        select
          id,
          binding_id,
          scope_type,
          scope_key,
          runtime_kind,
          channel,
          platform,
          arch,
          target_triple,
          from_release_id,
          to_release_id,
          change_reason,
          operator_user_id,
          metadata_json,
          created_at
        from runtime_release_binding_history
        ${whereClause}
        order by created_at desc
        limit $${values.length}
      `,
      values,
    );
    return result.rows.map(mapRuntimeReleaseBindingHistoryRow);
  }

  async resolveRuntimeRelease(
    appName: string,
    input: {runtimeKind: string; channel: string; platform: string; arch: string},
  ): Promise<PortalResolvedRuntimeReleaseResult | null> {
    const appRow = await readAppRow(this.pool, appName);
    if (!appRow) {
      return null;
    }
    const query = async (scopeType: 'app' | 'platform', scopeKey: string) => {
      const result = await this.pool.query<PortalRuntimeReleaseBindingRow & PortalRuntimeReleaseRow>(
        `
          select
            b.id,
            b.scope_type,
            b.scope_key,
            b.runtime_kind,
            b.channel,
            b.platform,
            b.arch,
            b.target_triple,
            b.release_id,
            b.enabled,
            b.metadata_json,
            b.updated_by,
            b.created_at,
            b.updated_at,
            r.id as release_row_id,
            r.runtime_kind as release_runtime_kind,
            r.version,
            r.channel as release_channel,
            r.platform as release_platform,
            r.arch as release_arch,
            r.target_triple as release_target_triple,
            r.artifact_type,
            r.storage_provider,
            r.bucket_name,
            r.object_key,
            r.artifact_url,
            r.artifact_sha256,
            r.artifact_size_bytes,
            r.launcher_relative_path,
            r.git_commit,
            r.git_tag,
            r.release_version,
            r.build_time,
            r.build_info_json,
            r.metadata_json as release_metadata_json,
            r.status,
            r.created_by,
            r.created_at as release_created_at,
            r.updated_at as release_updated_at,
            r.published_at
          from runtime_release_bindings b
          join runtime_release_catalog r on r.id = b.release_id
          where b.scope_type = $1
            and b.scope_key = $2
            and b.runtime_kind = $3
            and b.channel = $4
            and b.platform = $5
            and b.arch = $6
            and b.enabled = true
            and r.status = 'published'
          order by b.updated_at desc
          limit 1
        `,
        [scopeType, scopeKey, input.runtimeKind, input.channel, input.platform, input.arch],
      );
      return result.rows[0] || null;
    };

    const row = (await query('app', appName)) || (await query('platform', 'platform'));
    if (!row) {
      return null;
    }

    const binding = mapRuntimeReleaseBindingRow(row);
    const release = mapRuntimeReleaseRow({
      id: (row as unknown as {release_row_id: string}).release_row_id,
      runtime_kind: (row as unknown as {release_runtime_kind: string}).release_runtime_kind,
      version: row.version,
      channel: (row as unknown as {release_channel: string}).release_channel,
      platform: (row as unknown as {release_platform: string}).release_platform,
      arch: (row as unknown as {release_arch: string}).release_arch,
      target_triple: (row as unknown as {release_target_triple: string}).release_target_triple,
      artifact_type: row.artifact_type,
      storage_provider: row.storage_provider,
      bucket_name: row.bucket_name,
      object_key: row.object_key,
      artifact_url: row.artifact_url,
      artifact_sha256: row.artifact_sha256,
      artifact_size_bytes: row.artifact_size_bytes,
      launcher_relative_path: row.launcher_relative_path,
      git_commit: row.git_commit,
      git_tag: row.git_tag,
      release_version: row.release_version,
      build_time: row.build_time,
      build_info_json: row.build_info_json,
      metadata_json: (row as unknown as {release_metadata_json: Record<string, unknown> | null}).release_metadata_json,
      status: row.status,
      created_by: row.created_by,
      created_at: (row as unknown as {release_created_at: Date}).release_created_at,
      updated_at: (row as unknown as {release_updated_at: Date}).release_updated_at,
      published_at: row.published_at,
    });

    return {
      appName,
      resolvedScope: binding.scopeType,
      binding,
      release,
    };
  }

  async resolveBillingMultiplierForAppModel(appName: string, modelInput: string | null | undefined): Promise<number> {
    const normalizedModel = String(modelInput || '').trim();
    if (!normalizedModel) {
      return 1;
    }
    const resolved = await this.resolveRuntimeModels(appName);
    if (!resolved) {
      return 1;
    }
    const normalizedLower = normalizedModel.toLowerCase();
    const normalizedTail = normalizedLower.split('/').pop() || normalizedLower;
    const matched =
      resolved.models.find((item) => item.modelRef.trim().toLowerCase() === normalizedLower) ||
      resolved.models.find((item) => item.modelId.trim().toLowerCase() === normalizedLower) ||
      resolved.models.find((item) => {
        const refTail = item.modelRef.trim().toLowerCase().split('/').pop() || '';
        const modelTail = item.modelId.trim().toLowerCase().split('/').pop() || '';
        return refTail === normalizedTail || modelTail === normalizedTail;
      }) ||
      null;
    return matched?.billingMultiplier && matched.billingMultiplier > 0 ? matched.billingMultiplier : 1;
  }

  private async listModelProviderProfileModelsByProfileIds(
    profileIds: string[],
  ): Promise<Map<string, PortalModelProviderProfileModelRecord[]>> {
    const normalized = [...new Set(profileIds.map((item) => item.trim()).filter(Boolean))];
    const grouped = new Map<string, PortalModelProviderProfileModelRecord[]>();
    if (normalized.length === 0) {
      return grouped;
    }
    const result = await this.pool.query<PortalModelProviderProfileModelRow>(
      `
        select
          id,
          profile_id,
          model_ref,
          model_id,
          label,
          logo_preset_key,
          billing_multiplier,
          reasoning,
          input_modalities_json,
          context_window,
          max_tokens,
          enabled,
          sort_order,
          metadata_json,
          created_at,
          updated_at
        from model_provider_profile_models
        where profile_id = any($1::uuid[])
        order by sort_order asc, label asc, model_ref asc
      `,
      [normalized],
    );
    for (const row of result.rows) {
      const item = mapModelProviderProfileModelRow(row);
      const bucket = grouped.get(item.profileId) || [];
      bucket.push(item);
      grouped.set(item.profileId, bucket);
    }
    return grouped;
  }

  async upsertMcp(input: UpsertPortalMcpInput): Promise<PortalMcpRecord> {
    const cloudExisting = await this.pool.query<{mcp_key: string}>(
      `
        select mcp_key
        from cloud_mcp_catalog
        where mcp_key = $1
        limit 1
      `,
      [input.mcpKey],
    );
    if (!cloudExisting.rows[0]) {
      throw new Error(`[portal-mcp] cloud mcp not found: ${input.mcpKey}`);
    }
    const sortOrderResult = await this.pool.query<{next_sort_order: number}>(
      `
        select coalesce(max(sort_order), 0) + 10 as next_sort_order
        from platform_bundled_mcps
      `,
    );
    await this.pool.query(
      `
        insert into platform_bundled_mcps (
          mcp_key,
          sort_order,
          metadata_json,
          active,
          created_at,
          updated_at
        )
        values ($1, $2, $3::jsonb, $4, now(), now())
        on conflict (mcp_key)
        do update set
          metadata_json = excluded.metadata_json,
          active = excluded.active,
          updated_at = now()
      `,
      [
        input.mcpKey,
        Number(sortOrderResult.rows[0]?.next_sort_order || 10),
        JSON.stringify(input.metadata || {}),
        input.active ?? true,
      ],
    );
    const next = (await this.listMcps()).find((item) => item.mcpKey === input.mcpKey) || null;
    if (!next) {
      throw new Error(`platform mcp upsert failed: ${input.mcpKey}`);
    }
    return next;
  }

  async deleteMcp(mcpKey: string): Promise<void> {
    await this.pool.query(`delete from platform_bundled_mcps where mcp_key = $1`, [mcpKey]);
  }

  async replaceAppSkillBindings(
    appName: string,
    items: ReplacePortalAppSkillBindingsInput,
    actorUserId: string | null = null,
  ): Promise<PortalAppSkillBindingRecord[]> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await replaceSkillBindings(client, appName, items);
      await insertAuditEvent(client, {
        appName,
        action: 'skill_bindings_saved',
        actorUserId,
        payload: {
          count: items.length,
          layer: 'oem_bundled_skills',
        },
      });
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return listSkillBindings(this.pool, appName);
  }

  async replaceAppMcpBindings(
    appName: string,
    items: ReplacePortalAppMcpBindingsInput,
    actorUserId: string | null = null,
  ): Promise<PortalAppMcpBindingRecord[]> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await replaceMcpBindings(client, appName, items);
      await insertAuditEvent(client, {
        appName,
        action: 'mcp_bindings_saved',
        actorUserId,
        payload: {count: items.length, layer: 'oem_bundled_mcps'},
      });
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return listMcpBindings(this.pool, appName);
  }

  async replaceAppModelBindings(
    appName: string,
    items: ReplacePortalAppModelBindingsInput,
    actorUserId: string | null = null,
  ): Promise<PortalAppModelBindingRecord[]> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await replaceModelBindings(client, appName, items);
      await insertAuditEvent(client, {
        appName,
        action: 'model_bindings_saved',
        actorUserId,
        payload: {count: items.length},
      });
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return listModelBindings(this.pool, appName);
  }

  async replaceAppMenuBindings(
    appName: string,
    items: ReplacePortalAppMenuBindingsInput,
    actorUserId: string | null = null,
  ): Promise<PortalAppMenuBindingRecord[]> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await replaceMenuBindings(client, appName, items);
      await insertAuditEvent(client, {
        appName,
        action: 'menu_bindings_saved',
        actorUserId,
        payload: {count: items.length},
      });
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return listMenuBindings(this.pool, appName);
  }

  async replaceAppRechargePackageBindings(
    appName: string,
    items: ReplacePortalAppRechargePackageBindingsInput,
    actorUserId: string | null = null,
  ): Promise<PortalAppRechargePackageBindingRecord[]> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await replaceRechargePackageBindings(client, appName, items);
      await insertAuditEvent(client, {
        appName,
        action: 'recharge_package_bindings_saved',
        actorUserId,
        payload: {count: items.length},
      });
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return listRechargePackageBindings(this.pool, appName);
  }

  async replaceAppComposerControlBindings(
    appName: string,
    items: ReplacePortalAppComposerControlBindingsInput,
    actorUserId: string | null = null,
  ): Promise<PortalAppComposerControlBindingRecord[]> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await replaceComposerControlBindings(client, appName, items);
      await insertAuditEvent(client, {
        appName,
        action: 'composer_control_bindings_saved',
        actorUserId,
        payload: {count: items.length},
      });
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return listComposerControlBindings(this.pool, appName);
  }

  async replaceAppComposerShortcutBindings(
    appName: string,
    items: ReplacePortalAppComposerShortcutBindingsInput,
    actorUserId: string | null = null,
  ): Promise<PortalAppComposerShortcutBindingRecord[]> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await replaceComposerShortcutBindings(client, appName, items);
      await insertAuditEvent(client, {
        appName,
        action: 'composer_shortcut_bindings_saved',
        actorUserId,
        payload: {count: items.length},
      });
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return listComposerShortcutBindings(this.pool, appName);
  }

  async applyBaselineSnapshot(input: {
    apps: UpsertPortalAppInput[];
    skills: UpsertPortalSkillInput[];
    mcps: UpsertPortalMcpInput[];
    models?: UpsertPortalModelInput[];
    menus?: UpsertPortalMenuInput[];
    rechargePackages?: UpsertPortalRechargePackageInput[];
    composerControls?: UpsertPortalComposerControlInput[];
    composerShortcuts?: UpsertPortalComposerShortcutInput[];
    skillBindings: Array<{appName: string; items: ReplacePortalAppSkillBindingsInput}>;
    mcpBindings: Array<{appName: string; items: ReplacePortalAppMcpBindingsInput}>;
    modelBindings?: Array<{appName: string; items: ReplacePortalAppModelBindingsInput}>;
    menuBindings: Array<{appName: string; items: ReplacePortalAppMenuBindingsInput}>;
    rechargePackageBindings?: Array<{appName: string; items: ReplacePortalAppRechargePackageBindingsInput}>;
    composerControlBindings?: Array<{appName: string; items: ReplacePortalAppComposerControlBindingsInput}>;
    composerShortcutBindings?: Array<{appName: string; items: ReplacePortalAppComposerShortcutBindingsInput}>;
    preserveExistingAppState?: boolean;
  }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (const app of input.apps) {
        if (input.preserveExistingAppState) {
          await client.query(
            `
              insert into oem_apps (
                app_name,
                display_name,
                description,
                status,
                default_locale,
                config_json,
                created_at,
                updated_at
              )
              values ($1, $2, $3, $4, $5, $6::jsonb, now(), now())
              on conflict (app_name) do nothing
            `,
            [
              app.appName,
              app.displayName,
              app.description || null,
              app.status || 'active',
              app.defaultLocale || 'zh-CN',
              JSON.stringify(app.config || {}),
            ],
          );
        } else {
          await client.query(
            `
              insert into oem_apps (
                app_name,
                display_name,
                description,
                status,
                default_locale,
                config_json,
                created_at,
                updated_at
              )
              values ($1, $2, $3, $4, $5, $6::jsonb, now(), now())
              on conflict (app_name)
              do update set
                display_name = excluded.display_name,
                description = excluded.description,
                status = excluded.status,
                default_locale = excluded.default_locale,
                config_json = excluded.config_json,
                updated_at = now()
            `,
            [
              app.appName,
              app.displayName,
              app.description || null,
              app.status || 'active',
              app.defaultLocale || 'zh-CN',
              JSON.stringify(app.config || {}),
            ],
          );
        }
      }

      for (const [index, skill] of input.skills.entries()) {
        const catalog = await client.query<{
          slug: string;
          name: string;
          description: string;
          category: string | null;
          publisher: string;
          active: boolean;
        }>(
          `
            select
              slug,
              name,
              description,
              category,
              publisher,
              active
            from cloud_skill_catalog
            where slug = $1
            limit 1
          `,
          [skill.slug],
        );
        if (!catalog.rows[0]) {
          throw new Error(`[portal-baseline] bundled skill not found in cloud catalog: ${skill.slug}`);
        }
        const cloud = catalog.rows[0];
        if (cloud.active === false) {
          throw new Error(`[portal-baseline] bundled skill inactive in cloud catalog: ${skill.slug}`);
        }
        await client.query(
          `
            insert into platform_bundled_skills (
              skill_slug,
              sort_order,
              metadata_json,
              active,
              created_at,
              updated_at
            )
            values ($1, $2, $3::jsonb, $4, now(), now())
            on conflict (skill_slug)
            do update set
              metadata_json = excluded.metadata_json,
              active = excluded.active,
              updated_at = now()
          `,
          [
            cloud.slug,
            (index + 1) * 10,
            JSON.stringify(skill.metadata || {}),
            skill.active ?? true,
          ],
        );
      }

      for (const mcp of input.mcps) {
        await client.query(
          `
            insert into cloud_mcp_catalog (
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
            )
            values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, now(), now())
            on conflict (mcp_key)
            do update set
              name = excluded.name,
              description = excluded.description,
              transport = excluded.transport,
              object_key = excluded.object_key,
              config_json = excluded.config_json,
              metadata_json = excluded.metadata_json,
              active = excluded.active,
              updated_at = now()
          `,
          [
            mcp.mcpKey,
            mcp.name,
            mcp.description,
            mcp.transport || 'config',
            mcp.objectKey || null,
            JSON.stringify(mcp.config || {}),
            JSON.stringify(mcp.metadata || {}),
            mcp.active ?? true,
          ],
        );
      }

      const sharedBaselineMcpKeys = (() => {
        const enabledBindingSets = input.mcpBindings
          .map((binding) =>
            new Set(
              (Array.isArray(binding.items) ? binding.items : [])
                .filter((item) => item.enabled !== false)
                .map((item) => String(item.mcpKey || '').trim())
                .filter(Boolean),
            ),
          )
          .filter((items) => items.size > 0);
        if (enabledBindingSets.length === 0) {
          return [] as string[];
        }
        const [firstSet, ...restSets] = enabledBindingSets;
        return [...firstSet].filter((mcpKey) => restSets.every((items) => items.has(mcpKey)));
      })();
      for (const [index, mcpKey] of sharedBaselineMcpKeys.entries()) {
        await client.query(
          `
            insert into platform_bundled_mcps (
              mcp_key,
              sort_order,
              metadata_json,
              active,
              created_at,
              updated_at
            )
            values ($1, $2, $3::jsonb, true, now(), now())
            on conflict (mcp_key) do nothing
          `,
          [
            mcpKey,
            (index + 1) * 10,
            JSON.stringify({
              sourceType: 'baseline_snapshot',
              derivedFrom: 'shared_oem_mcp_bindings',
            }),
          ],
        );
      }

      for (const model of input.models || []) {
        await client.query(
          `
            insert into oem_model_catalog (
              ref,
              label,
              provider_id,
              model_id,
              api,
              base_url,
              use_runtime_openai,
              auth_header,
              reasoning,
              input_json,
              context_window,
              max_tokens,
              metadata_json,
              active,
              created_at,
              updated_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13::jsonb, $14, now(), now())
            on conflict (ref)
            do update set
              label = excluded.label,
              provider_id = excluded.provider_id,
              model_id = excluded.model_id,
              api = excluded.api,
              base_url = excluded.base_url,
              use_runtime_openai = excluded.use_runtime_openai,
              auth_header = excluded.auth_header,
              reasoning = excluded.reasoning,
              input_json = excluded.input_json,
              context_window = excluded.context_window,
              max_tokens = excluded.max_tokens,
              metadata_json = excluded.metadata_json,
              active = excluded.active,
              updated_at = now()
          `,
          [
            model.ref,
            model.label,
            model.providerId,
            model.modelId,
            model.api,
            model.baseUrl || null,
            model.useRuntimeOpenai ?? false,
            model.authHeader ?? true,
            model.reasoning ?? false,
            JSON.stringify(model.input || []),
            model.contextWindow || 0,
            model.maxTokens || 0,
            JSON.stringify(model.metadata || {}),
            model.active ?? true,
          ],
        );
      }

      for (const menu of input.menus || []) {
        await client.query(
          `
            insert into oem_menu_catalog (
              menu_key,
              display_name,
              category,
              route_key,
              icon_key,
              metadata_json,
              active,
              created_at,
              updated_at
            )
            values ($1, $2, $3, $4, $5, $6::jsonb, $7, now(), now())
            on conflict (menu_key)
            do update set
              display_name = excluded.display_name,
              category = excluded.category,
              route_key = excluded.route_key,
              icon_key = excluded.icon_key,
              metadata_json = excluded.metadata_json,
              active = excluded.active,
              updated_at = now()
          `,
          [
            menu.menuKey,
            menu.displayName,
            menu.category || null,
            menu.routeKey || null,
            menu.iconKey || null,
            JSON.stringify(menu.metadata || {}),
            menu.active ?? true,
          ],
        );
      }

      for (const rechargePackage of input.rechargePackages || []) {
        await client.query(
          `
            insert into platform_recharge_package_catalog (
              package_id,
              package_name,
              credits,
              bonus_credits,
              amount_cny_fen,
              sort_order,
              recommended,
              is_default,
              metadata_json,
              active,
              created_at,
              updated_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, now(), now())
            on conflict (package_id)
            do update set
              package_name = excluded.package_name,
              credits = excluded.credits,
              bonus_credits = excluded.bonus_credits,
              amount_cny_fen = excluded.amount_cny_fen,
              sort_order = excluded.sort_order,
              recommended = excluded.recommended,
              is_default = excluded.is_default,
              metadata_json = excluded.metadata_json,
              active = excluded.active,
              updated_at = now()
          `,
          [
            rechargePackage.packageId,
            rechargePackage.packageName,
            rechargePackage.credits,
            rechargePackage.bonusCredits ?? 0,
            rechargePackage.amountCnyFen,
            rechargePackage.sortOrder ?? 100,
            rechargePackage.recommended === true,
            rechargePackage.default === true,
            JSON.stringify(rechargePackage.metadata || {}),
            rechargePackage.active !== false,
          ],
        );
      }

      for (const control of input.composerControls || []) {
        await client.query(
          `
            insert into oem_composer_control_catalog (
              control_key,
              display_name,
              control_type,
              icon_key,
              metadata_json,
              active,
              created_at,
              updated_at
            )
            values ($1, $2, $3, $4, $5::jsonb, $6, now(), now())
            on conflict (control_key)
            do update set
              display_name = excluded.display_name,
              control_type = excluded.control_type,
              icon_key = excluded.icon_key,
              metadata_json = excluded.metadata_json,
              active = excluded.active,
              updated_at = now()
          `,
          [
            control.controlKey,
            control.displayName,
            control.controlType,
            control.iconKey || null,
            JSON.stringify(control.metadata || {}),
            control.active ?? true,
          ],
        );
        const optionValues = (control.options || []).map((item) => item.optionValue);
        await client.query(
          `
            delete from oem_composer_control_option_catalog
            where control_key = $1
              and (
                cardinality($2::text[]) = 0
                or option_value <> all($2::text[])
              )
          `,
          [control.controlKey, optionValues],
        );
        for (const [index, option] of (control.options || []).entries()) {
          await client.query(
            `
              insert into oem_composer_control_option_catalog (
                control_key,
                option_value,
                label,
                description,
                sort_order,
                metadata_json,
                active,
                created_at,
                updated_at
              )
              values ($1, $2, $3, $4, $5, $6::jsonb, $7, now(), now())
              on conflict (control_key, option_value)
              do update set
                label = excluded.label,
                description = excluded.description,
                sort_order = excluded.sort_order,
                metadata_json = excluded.metadata_json,
                active = excluded.active,
                updated_at = now()
            `,
            [
              control.controlKey,
              option.optionValue,
              option.label,
              option.description || '',
              option.sortOrder ?? (index + 1) * 10,
              JSON.stringify(option.metadata || {}),
              option.active ?? true,
            ],
          );
        }
      }

      for (const shortcut of input.composerShortcuts || []) {
        await client.query(
          `
            insert into oem_composer_shortcut_catalog (
              shortcut_key,
              display_name,
              description,
              template_text,
              icon_key,
              tone,
              metadata_json,
              active,
              created_at,
              updated_at
            )
            values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, now(), now())
            on conflict (shortcut_key)
            do update set
              display_name = excluded.display_name,
              description = excluded.description,
              template_text = excluded.template_text,
              icon_key = excluded.icon_key,
              tone = excluded.tone,
              metadata_json = excluded.metadata_json,
              active = excluded.active,
              updated_at = now()
          `,
          [
            shortcut.shortcutKey,
            shortcut.displayName,
            shortcut.description || '',
            shortcut.template,
            shortcut.iconKey || null,
            shortcut.tone || null,
            JSON.stringify(shortcut.metadata || {}),
            shortcut.active ?? true,
          ],
        );
      }

      for (const binding of input.skillBindings) {
        if (input.preserveExistingAppState) {
          await seedSkillBindings(client, binding.appName, binding.items);
        } else {
          await replaceSkillBindings(client, binding.appName, binding.items);
        }
      }
      for (const binding of input.mcpBindings) {
        if (input.preserveExistingAppState) {
          await seedMcpBindings(client, binding.appName, binding.items);
        } else {
          await replaceMcpBindings(client, binding.appName, binding.items);
        }
      }
      for (const binding of input.modelBindings || []) {
        if (input.preserveExistingAppState) {
          await seedModelBindings(client, binding.appName, binding.items);
        } else {
          await replaceModelBindings(client, binding.appName, binding.items);
        }
      }
      for (const binding of input.menuBindings) {
        if (input.preserveExistingAppState) {
          await seedMenuBindings(client, binding.appName, binding.items);
        } else {
          await replaceMenuBindings(client, binding.appName, binding.items);
        }
      }
      for (const binding of input.rechargePackageBindings || []) {
        if (input.preserveExistingAppState) {
          await seedRechargePackageBindings(client, binding.appName, binding.items);
        } else {
          await replaceRechargePackageBindings(client, binding.appName, binding.items);
        }
      }
      for (const binding of input.composerControlBindings || []) {
        if (input.preserveExistingAppState) {
          await seedComposerControlBindings(client, binding.appName, binding.items);
        } else {
          await replaceComposerControlBindings(client, binding.appName, binding.items);
        }
      }
      for (const binding of input.composerShortcutBindings || []) {
        if (input.preserveExistingAppState) {
          await seedComposerShortcutBindings(client, binding.appName, binding.items);
        } else {
          await replaceComposerShortcutBindings(client, binding.appName, binding.items);
        }
      }

      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async upsertAsset(input: {
    appName: string;
    assetKey: string;
    storageProvider: string;
    objectKey: string;
    publicUrl?: string | null;
    contentType?: string | null;
    sha256?: string | null;
    sizeBytes?: number | null;
    metadata?: PortalJsonObject;
    actorUserId: string | null;
  }): Promise<PortalAppAssetRecord> {
    const result = await this.pool.query<PortalAssetRow>(
      `
        insert into oem_app_assets (
          id,
          app_name,
          asset_key,
          storage_provider,
          object_key,
          public_url,
          content_type,
          sha256,
          size_bytes,
          metadata_json,
          created_by,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, now(), now())
        on conflict (app_name, asset_key)
        do update set
          storage_provider = excluded.storage_provider,
          object_key = excluded.object_key,
          public_url = excluded.public_url,
          content_type = excluded.content_type,
          sha256 = excluded.sha256,
          size_bytes = excluded.size_bytes,
          metadata_json = excluded.metadata_json,
          updated_at = now()
        returning
          id,
          app_name,
          null::text as app_display_name,
          asset_key,
          storage_provider,
          object_key,
          public_url,
          content_type,
          sha256,
          size_bytes,
          metadata_json,
          created_by,
          created_at,
          updated_at
      `,
      [
        randomUUID(),
        input.appName,
        input.assetKey,
        input.storageProvider,
        input.objectKey,
        input.publicUrl || null,
        input.contentType || null,
        input.sha256 || null,
        input.sizeBytes ?? null,
        JSON.stringify(input.metadata || {}),
        input.actorUserId,
      ],
    );
    await insertAuditEvent(this.pool, {
      appName: input.appName,
      action: 'asset_upserted',
      actorUserId: input.actorUserId,
      payload: {
        assetKey: input.assetKey,
        storageProvider: input.storageProvider,
      },
    });
    const [asset] = await listAssetsByApp(this.pool, input.appName);
    return (await this.getAppAsset(input.appName, input.assetKey)) || mapAssetRow(result.rows[0]) || asset;
  }

  async getAppAsset(appName: string, assetKey: string): Promise<PortalAppAssetRecord | null> {
    const result = await this.pool.query<PortalAssetRow>(
      `
        select
          a.id,
          a.app_name,
          p.display_name as app_display_name,
          a.asset_key,
          a.storage_provider,
          a.object_key,
          a.public_url,
          a.content_type,
          a.sha256,
          a.size_bytes,
          a.metadata_json,
          a.created_by,
          a.created_at,
          a.updated_at
        from oem_app_assets a
        join oem_apps p on p.app_name = a.app_name
        where a.app_name = $1 and a.asset_key = $2
        limit 1
      `,
      [appName, assetKey],
    );
    return result.rows[0] ? mapAssetRow(result.rows[0]) : null;
  }

  async deleteAsset(input: {
    appName: string;
    assetKey: string;
    actorUserId: string | null;
    existing?: PortalAppAssetRecord | null;
  }): Promise<{removed: boolean}> {
    const existing = input.existing || (await this.getAppAsset(input.appName, input.assetKey));
    if (!existing) return {removed: false};
    const result = await this.pool.query<{id: string}>(
      `
        delete from oem_app_assets
        where app_name = $1 and asset_key = $2
        returning id
      `,
      [input.appName, input.assetKey],
    );
    if ((result.rowCount || 0) === 0) return {removed: false};
    await insertAuditEvent(this.pool, {
      appName: input.appName,
      action: 'asset_deleted',
      actorUserId: input.actorUserId,
      payload: {
        assetKey: existing.assetKey,
        storageProvider: existing.storageProvider,
      },
    });
    return {removed: true};
  }

  async publishApp(appName: string, actorUserId: string | null): Promise<PortalAppReleaseRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const state = await readAppSnapshotState(client, appName, true);
      if (!state) {
        throw new Error('PORTAL_APP_NOT_FOUND');
      }
      const versionResult = await client.query<{next_version: number}>(
        `
          select coalesce(max(version_no), 0) + 1 as next_version
          from oem_app_releases
          where app_name = $1
        `,
        [appName],
      );
      const nextVersion = Number(versionResult.rows[0]?.next_version || 1);
      const summary = buildReleaseSummary(state);
      await client.query(
        `
          insert into oem_app_releases (
            id,
            app_name,
            version_no,
            snapshot_json,
            summary_json,
            created_by,
            created_at,
            published_at
          )
          values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, now(), now())
        `,
        [
          randomUUID(),
          appName,
          nextVersion,
          JSON.stringify(state),
          JSON.stringify(summary),
          actorUserId,
        ],
      );
      await insertAuditEvent(client, {
        appName,
        action: 'published',
        actorUserId,
        payload: {
          version: nextVersion,
          summary,
        },
      });
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    const detail = await this.getAppDetail(appName);
    const release = detail?.releases[0];
    if (!release) {
      throw new Error('PORTAL_RELEASE_NOT_FOUND');
    }
    return release;
  }

  async restoreAppRelease(appName: string, version: number, actorUserId: string | null): Promise<PortalAppRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = await readAppRow(client, appName, true);
      if (!current) {
        throw new Error('PORTAL_APP_NOT_FOUND');
      }
      const releaseResult = await client.query<{snapshot_json: Record<string, unknown> | null}>(
        `
          select snapshot_json
          from oem_app_releases
          where app_name = $1 and version_no = $2
          limit 1
        `,
        [appName, version],
      );
      const snapshot = asJsonObject(releaseResult.rows[0]?.snapshot_json);
      const appSnapshot = asJsonObject(snapshot.app);
      if (!releaseResult.rows[0] || !Object.keys(appSnapshot).length) {
        throw new Error('PORTAL_RELEASE_NOT_FOUND');
      }

      const appRecord = {
        appName,
        displayName: String(appSnapshot.displayName || current.display_name).trim() || current.display_name,
        description:
          typeof appSnapshot.description === 'string'
            ? String(appSnapshot.description).trim() || null
            : current.description,
        status:
          appSnapshot.status === 'disabled' || appSnapshot.status === 'active'
            ? (appSnapshot.status as 'active' | 'disabled')
            : current.status,
        defaultLocale: String(appSnapshot.defaultLocale || current.default_locale).trim() || current.default_locale,
        config: asJsonObject(appSnapshot.config),
      };

      await client.query(
        `
          update oem_apps
          set display_name = $2,
              description = $3,
              status = $4,
              default_locale = $5,
              config_json = $6::jsonb,
              updated_at = now()
          where app_name = $1
        `,
        [
          appName,
          appRecord.displayName,
          appRecord.description,
          appRecord.status,
          appRecord.defaultLocale,
          JSON.stringify(appRecord.config),
        ],
      );

      await replaceSkillBindings(client, appName, (Array.isArray(snapshot.skillBindings) ? snapshot.skillBindings : []) as ReplacePortalAppSkillBindingsInput);
      await replaceMcpBindings(client, appName, (Array.isArray(snapshot.mcpBindings) ? snapshot.mcpBindings : []) as ReplacePortalAppMcpBindingsInput);
      await replaceModelBindings(client, appName, (Array.isArray(snapshot.modelBindings) ? snapshot.modelBindings : []) as ReplacePortalAppModelBindingsInput);
      await replaceMenuBindings(client, appName, (Array.isArray(snapshot.menuBindings) ? snapshot.menuBindings : []) as ReplacePortalAppMenuBindingsInput);
      await replaceRechargePackageBindings(
        client,
        appName,
        (Array.isArray(snapshot.rechargePackageBindings) ? snapshot.rechargePackageBindings : []) as ReplacePortalAppRechargePackageBindingsInput,
      );
      await replaceComposerControlBindings(
        client,
        appName,
        (Array.isArray(snapshot.composerControlBindings) ? snapshot.composerControlBindings : []) as ReplacePortalAppComposerControlBindingsInput,
      );
      await replaceComposerShortcutBindings(
        client,
        appName,
        (Array.isArray(snapshot.composerShortcutBindings) ? snapshot.composerShortcutBindings : []) as ReplacePortalAppComposerShortcutBindingsInput,
      );
      await replaceAssets(
        client,
        appName,
        (Array.isArray(snapshot.assets) ? snapshot.assets : []).map((item) => ({
          ...asJsonObject(item),
          id: String(asJsonObject(item).id || randomUUID()),
          appName,
          assetKey: String(asJsonObject(item).assetKey || ''),
          storageProvider: String(asJsonObject(item).storageProvider || 's3'),
          objectKey: String(asJsonObject(item).objectKey || ''),
          publicUrl: typeof asJsonObject(item).publicUrl === 'string' ? String(asJsonObject(item).publicUrl) : null,
          contentType: typeof asJsonObject(item).contentType === 'string' ? String(asJsonObject(item).contentType) : null,
          sha256: typeof asJsonObject(item).sha256 === 'string' ? String(asJsonObject(item).sha256) : null,
          sizeBytes: Number(asJsonObject(item).sizeBytes || 0) || null,
          metadata: asJsonObject(asJsonObject(item).metadata),
          createdBy: typeof asJsonObject(item).createdBy === 'string' ? String(asJsonObject(item).createdBy) : null,
          createdAt: String(asJsonObject(item).createdAt || new Date().toISOString()),
          updatedAt: String(asJsonObject(item).updatedAt || new Date().toISOString()),
        })) as PortalAppAssetRecord[],
      );

      await insertAuditEvent(client, {
        appName,
        action: 'rollback_prepared',
        actorUserId,
        payload: {version},
      });
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    const detail = await this.getAppDetail(appName);
    if (!detail) {
      throw new Error('PORTAL_APP_NOT_FOUND');
    }
    return detail.app;
  }
}
