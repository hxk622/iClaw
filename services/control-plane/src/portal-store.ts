import {randomUUID} from 'node:crypto';

import {Pool, type PoolClient} from 'pg';

import type {
  PortalAppComposerControlBindingRecord,
  PortalAppComposerShortcutBindingRecord,
  PortalAppAssetRecord,
  PortalAppAuditRecord,
  PortalAppDetail,
  PortalAppModelBindingRecord,
  PortalAppMcpBindingRecord,
  PortalAppMenuBindingRecord,
  PortalAppRecord,
  PortalAppReleaseRecord,
  PortalAppSkillBindingRecord,
  PortalComposerControlOptionRecord,
  PortalComposerControlRecord,
  PortalComposerShortcutRecord,
  PortalJsonObject,
  PortalModelRecord,
  PortalMenuRecord,
  PortalMcpRecord,
  PortalSkillRecord,
  ReplacePortalAppComposerControlBindingsInput,
  ReplacePortalAppComposerShortcutBindingsInput,
  ReplacePortalAppModelBindingsInput,
  ReplacePortalAppMcpBindingsInput,
  ReplacePortalAppMenuBindingsInput,
  ReplacePortalAppSkillBindingsInput,
  UpsertPortalAppInput,
  UpsertPortalComposerControlInput,
  UpsertPortalComposerShortcutInput,
  UpsertPortalModelInput,
  UpsertPortalMenuInput,
  UpsertPortalMcpInput,
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
  category: string | null;
  publisher: string;
  visibility: string;
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

type PortalAppSnapshotState = {
  app: PortalAppRecord;
  skillBindings: PortalAppSkillBindingRecord[];
  mcpBindings: PortalAppMcpBindingRecord[];
  modelBindings: PortalAppModelBindingRecord[];
  menuBindings: PortalAppMenuBindingRecord[];
  composerControlBindings: PortalAppComposerControlBindingRecord[];
  composerShortcutBindings: PortalAppComposerShortcutBindingRecord[];
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
    category: row.category,
    publisher: row.publisher,
    visibility: row.visibility,
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

function buildReleaseSummary(state: PortalAppSnapshotState): PortalJsonObject {
  const config = state.app.config;
  const surfaces = Object.entries(asJsonObject(config.surfaces))
    .filter(([, value]) => asJsonObject(value).enabled !== false)
    .map(([key]) => key);
  return {
    changedAreas: ['config', 'skills', 'mcps', 'models', 'menus', 'composer', 'assets'],
    surfaces,
    skillCount: state.skillBindings.filter((item) => item.enabled).length,
    mcpCount: state.mcpBindings.filter((item) => item.enabled).length,
    modelCount: state.modelBindings.filter((item) => item.enabled).length,
    menuCount: state.menuBindings.filter((item) => item.enabled).length,
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
      from oem_app_skill_bindings
      where app_name = $1
      order by sort_order asc, skill_slug asc
    `,
    [appName],
  );
  return result.rows.map(mapSkillBindingRow);
}

async function listMcpBindings(db: Pool | PoolClient, appName: string): Promise<PortalAppMcpBindingRecord[]> {
  const result = await db.query<PortalMcpBindingRow>(
    `
      select app_name, mcp_key, enabled, sort_order, config_json
      from oem_app_mcp_bindings
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
  const [skillBindings, mcpBindings, modelBindings, menuBindings, composerControlBindings, composerShortcutBindings, assets] = await Promise.all([
    listSkillBindings(db, appName),
    listMcpBindings(db, appName),
    listModelBindings(db, appName),
    listMenuBindings(db, appName),
    listComposerControlBindings(db, appName),
    listComposerShortcutBindings(db, appName),
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
  const slugs = items.map((item) => item.skillSlug);
  await db.query(
    `
      delete from oem_app_skill_bindings
      where app_name = $1
        and (
          cardinality($2::text[]) = 0
          or skill_slug <> all($2::text[])
        )
    `,
    [appName, slugs],
  );
  for (const item of items) {
    await db.query(
      `
        insert into oem_app_skill_bindings (
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
  const keys = items.map((item) => item.mcpKey);
  await db.query(
    `
      delete from oem_app_mcp_bindings
      where app_name = $1
        and (
          cardinality($2::text[]) = 0
          or mcp_key <> all($2::text[])
        )
    `,
    [appName, keys],
  );
  for (const item of items) {
    await db.query(
      `
        insert into oem_app_mcp_bindings (
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
    this.pool = new Pool({connectionString: databaseUrl});
  }

  async close(): Promise<void> {
    await this.pool.end();
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
          slug,
          name,
          description,
          category,
          publisher,
          visibility,
          object_key,
          content_sha256,
          metadata_json,
          active,
          created_at,
          updated_at
        from oem_skill_catalog
        order by slug asc
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

  async getSkill(slug: string): Promise<PortalSkillRecord | null> {
    const result = await this.pool.query<PortalSkillRow>(
      `
        select
          slug,
          name,
          description,
          category,
          publisher,
          visibility,
          object_key,
          content_sha256,
          metadata_json,
          active,
          created_at,
          updated_at
        from oem_skill_catalog
        where slug = $1
        limit 1
      `,
      [slug],
    );
    return mapSkillRow(result.rows[0]) || null;
  }

  async upsertSkill(input: UpsertPortalSkillInput): Promise<PortalSkillRecord> {
    const result = await this.pool.query<PortalSkillRow>(
      `
        insert into oem_skill_catalog (
          slug,
          name,
          description,
          category,
          publisher,
          visibility,
          object_key,
          content_sha256,
          metadata_json,
          active,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, now(), now())
        on conflict (slug)
        do update set
          name = excluded.name,
          description = excluded.description,
          category = excluded.category,
          publisher = excluded.publisher,
          visibility = excluded.visibility,
          object_key = excluded.object_key,
          content_sha256 = excluded.content_sha256,
          metadata_json = excluded.metadata_json,
          active = excluded.active,
          updated_at = now()
        returning
          slug,
          name,
          description,
          category,
          publisher,
          visibility,
          object_key,
          content_sha256,
          metadata_json,
          active,
          created_at,
          updated_at
      `,
      [
        input.slug,
        input.name,
        input.description,
        input.category || null,
        input.publisher,
        input.visibility || 'showcase',
        input.objectKey || null,
        input.contentSha256 || null,
        JSON.stringify(input.metadata || {}),
        input.active ?? true,
      ],
    );
    return mapSkillRow(result.rows[0]);
  }

  async deleteSkill(slug: string): Promise<void> {
    await this.pool.query(`delete from oem_skill_catalog where slug = $1`, [slug]);
  }

  async listMcps(): Promise<PortalMcpRecord[]> {
    const result = await this.pool.query<PortalMcpRow>(
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
        order by mcp_key asc
      `,
    );
    return result.rows.map(mapMcpRow);
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

  async upsertMcp(input: UpsertPortalMcpInput): Promise<PortalMcpRecord> {
    const result = await this.pool.query<PortalMcpRow>(
      `
        insert into oem_mcp_catalog (
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
        returning
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
      `,
      [
        input.mcpKey,
        input.name,
        input.description,
        input.transport || 'config',
        input.objectKey || null,
        JSON.stringify(input.config || {}),
        JSON.stringify(input.metadata || {}),
        input.active ?? true,
      ],
    );
    return mapMcpRow(result.rows[0]);
  }

  async deleteMcp(mcpKey: string): Promise<void> {
    await this.pool.query(`delete from oem_mcp_catalog where mcp_key = $1`, [mcpKey]);
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
        payload: {count: items.length},
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
        payload: {count: items.length},
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

  async syncPreset(input: {
    apps: UpsertPortalAppInput[];
    skills: UpsertPortalSkillInput[];
    mcps: UpsertPortalMcpInput[];
    models?: UpsertPortalModelInput[];
    menus?: UpsertPortalMenuInput[];
    composerControls?: UpsertPortalComposerControlInput[];
    composerShortcuts?: UpsertPortalComposerShortcutInput[];
    skillBindings: Array<{appName: string; items: ReplacePortalAppSkillBindingsInput}>;
    mcpBindings: Array<{appName: string; items: ReplacePortalAppMcpBindingsInput}>;
    modelBindings?: Array<{appName: string; items: ReplacePortalAppModelBindingsInput}>;
    menuBindings: Array<{appName: string; items: ReplacePortalAppMenuBindingsInput}>;
    composerControlBindings?: Array<{appName: string; items: ReplacePortalAppComposerControlBindingsInput}>;
    composerShortcutBindings?: Array<{appName: string; items: ReplacePortalAppComposerShortcutBindingsInput}>;
  }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (const app of input.apps) {
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

      for (const skill of input.skills) {
        await client.query(
          `
            insert into oem_skill_catalog (
              slug,
              name,
              description,
              category,
              publisher,
              visibility,
              object_key,
              content_sha256,
              metadata_json,
              active,
              created_at,
              updated_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, now(), now())
            on conflict (slug)
            do update set
              name = excluded.name,
              description = excluded.description,
              category = excluded.category,
              publisher = excluded.publisher,
              visibility = excluded.visibility,
              object_key = excluded.object_key,
              content_sha256 = excluded.content_sha256,
              metadata_json = excluded.metadata_json,
              active = excluded.active,
              updated_at = now()
          `,
          [
            skill.slug,
            skill.name,
            skill.description,
            skill.category || null,
            skill.publisher,
            skill.visibility || 'showcase',
            skill.objectKey || null,
            skill.contentSha256 || null,
            JSON.stringify(skill.metadata || {}),
            skill.active ?? true,
          ],
        );
      }

      for (const mcp of input.mcps) {
        await client.query(
          `
            insert into oem_mcp_catalog (
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
        await replaceSkillBindings(client, binding.appName, binding.items);
      }
      for (const binding of input.mcpBindings) {
        await replaceMcpBindings(client, binding.appName, binding.items);
      }
      for (const binding of input.modelBindings || []) {
        await replaceModelBindings(client, binding.appName, binding.items);
      }
      for (const binding of input.menuBindings) {
        await replaceMenuBindings(client, binding.appName, binding.items);
      }
      for (const binding of input.composerControlBindings || []) {
        await replaceComposerControlBindings(client, binding.appName, binding.items);
      }
      for (const binding of input.composerShortcutBindings || []) {
        await replaceComposerShortcutBindings(client, binding.appName, binding.items);
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
