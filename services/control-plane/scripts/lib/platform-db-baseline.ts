import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import type {McpCatalogEntryRecord, SkillCatalogEntryRecord} from '../../src/domain.ts';
import {config} from '../../src/config.ts';
import type {
  PortalAppAssetRecord,
  PortalAppComposerControlBindingRecord,
  PortalAppComposerShortcutBindingRecord,
  PortalAppDetail,
  PortalAppMcpBindingRecord,
  PortalAppMenuBindingRecord,
  PortalAppModelBindingRecord,
  PortalAppRecord,
  PortalAppSkillBindingRecord,
  PortalComposerControlRecord,
  PortalComposerShortcutRecord,
  PortalMcpRecord,
  PortalMenuRecord,
  PortalModelRecord,
  PortalRechargePackageRecord,
  PortalSkillRecord,
} from '../../src/portal-domain.ts';
import {PgPortalStore} from '../../src/portal-store.ts';
import {PgControlPlaneStore} from '../../src/pg-store.ts';
import type {AppRechargePackageBindingRecord} from '../../src/recharge-packages.ts';

export type PlatformDbBaselineSnapshot = {
  schemaVersion: 1;
  source: 'database';
  catalogs: {
    cloudMcps: Array<Record<string, unknown>>;
    referencedCloudSkills: Array<Record<string, unknown>>;
  };
  platform: {
    skills: Array<Record<string, unknown>>;
    mcps: Array<Record<string, unknown>>;
    models: Array<Record<string, unknown>>;
    menus: Array<Record<string, unknown>>;
    rechargePackages: Array<Record<string, unknown>>;
    composerControls: Array<Record<string, unknown>>;
    composerShortcuts: Array<Record<string, unknown>>;
  };
  apps: Array<Record<string, unknown>>;
};

const scriptDir = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_PLATFORM_DB_BASELINE_PATH = resolve(scriptDir, '../../baselines/platform-db.snapshot.json');

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBaselineMetadata(input: unknown): Record<string, unknown> {
  const metadata = cloneJson(asRecord(input));
  const sourceType = trimString(metadata.sourceType || metadata.source_type);

  delete metadata.source_type;

  if (sourceType === 'preset') {
    metadata.sourceType = 'baseline_seed';
  } else if (sourceType) {
    metadata.sourceType = sourceType;
  }

  return metadata;
}

function normalizeAssetMetadata(input: unknown): Record<string, unknown> {
  const metadata = cloneJson(asRecord(input));
  const repoAssetPath =
    trimString(metadata.repoAssetPath || metadata.repo_asset_path || metadata.presetFilePath || metadata.preset_file_path) ||
    '';
  const sourceType = trimString(metadata.sourceType || metadata.source_type);

  delete metadata.presetFilePath;
  delete metadata.preset_file_path;
  delete metadata.repo_asset_path;
  delete metadata.source_type;

  if (repoAssetPath) {
    metadata.repoAssetPath = repoAssetPath;
  }

  if (sourceType === 'preset' || (!sourceType && repoAssetPath)) {
    metadata.sourceType = 'repo_asset';
  } else if (sourceType) {
    metadata.sourceType = sourceType;
  }

  return metadata;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeysDeep(item));
  }
  if (!value || typeof value !== 'object') {
    return value ?? null;
  }
  return Object.keys(value as Record<string, unknown>)
    .sort((left, right) => left.localeCompare(right, 'zh-CN'))
    .reduce<Record<string, unknown>>((accumulator, key) => {
      accumulator[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
      return accumulator;
    }, {});
}

function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;
}

function sanitizeCloudSkill(entry: SkillCatalogEntryRecord): Record<string, unknown> {
  return {
    slug: entry.slug,
    name: entry.name,
    description: entry.description,
    market: entry.market,
    category: entry.category,
    skillType: entry.skillType,
    publisher: entry.publisher,
    distribution: entry.distribution,
    tags: cloneJson(entry.tags),
    version: entry.version,
    artifactFormat: entry.artifactFormat,
    artifactUrl: entry.artifactUrl,
    artifactSha256: entry.artifactSha256,
    artifactSourcePath: entry.artifactSourcePath,
    originType: entry.originType,
    sourceUrl: entry.sourceUrl,
    metadata: normalizeBaselineMetadata(entry.metadata),
    active: entry.active,
  };
}

function sanitizeCloudMcp(entry: McpCatalogEntryRecord): Record<string, unknown> {
  return {
    mcpKey: entry.mcpKey,
    name: entry.name,
    description: entry.description,
    transport: entry.transport,
    objectKey: entry.objectKey,
    config: cloneJson(entry.config),
    metadata: normalizeBaselineMetadata(entry.metadata),
    active: entry.active,
  };
}

function sanitizePlatformSkill(entry: PortalSkillRecord): Record<string, unknown> {
  return {
    slug: entry.slug,
    active: entry.active,
    metadata: normalizeBaselineMetadata(entry.metadata),
  };
}

function sanitizePlatformMcp(entry: PortalMcpRecord): Record<string, unknown> {
  return {
    mcpKey: entry.mcpKey,
    active: entry.active,
    metadata: normalizeBaselineMetadata(entry.metadata),
  };
}

function sanitizeModel(entry: PortalModelRecord): Record<string, unknown> {
  return {
    ref: entry.ref,
    label: entry.label,
    providerId: entry.providerId,
    modelId: entry.modelId,
    api: entry.api,
    baseUrl: entry.baseUrl,
    useRuntimeOpenai: entry.useRuntimeOpenai,
    authHeader: entry.authHeader,
    reasoning: entry.reasoning,
    input: cloneJson(entry.input),
    contextWindow: entry.contextWindow,
    maxTokens: entry.maxTokens,
    metadata: normalizeBaselineMetadata(entry.metadata),
    active: entry.active,
  };
}

function sanitizeMenu(entry: PortalMenuRecord): Record<string, unknown> {
  return {
    menuKey: entry.menuKey,
    displayName: entry.displayName,
    category: entry.category,
    routeKey: entry.routeKey,
    iconKey: entry.iconKey,
    metadata: normalizeBaselineMetadata(entry.metadata),
    active: entry.active,
  };
}

function sanitizeRechargePackage(entry: PortalRechargePackageRecord): Record<string, unknown> {
  return {
    packageId: entry.packageId,
    packageName: entry.packageName,
    credits: entry.credits,
    bonusCredits: entry.bonusCredits,
    amountCnyFen: entry.amountCnyFen,
    sortOrder: entry.sortOrder,
    recommended: entry.recommended,
    default: entry.default,
    metadata: normalizeBaselineMetadata(entry.metadata),
    active: entry.active,
  };
}

function sanitizeComposerControl(entry: PortalComposerControlRecord): Record<string, unknown> {
  return {
    controlKey: entry.controlKey,
    displayName: entry.displayName,
    controlType: entry.controlType,
    iconKey: entry.iconKey,
    metadata: normalizeBaselineMetadata(entry.metadata),
    active: entry.active,
    options: entry.options.map((option) => ({
      optionValue: option.optionValue,
      label: option.label,
      description: option.description,
      sortOrder: option.sortOrder,
      metadata: normalizeBaselineMetadata(option.metadata),
      active: option.active,
    })),
  };
}

function sanitizeComposerShortcut(entry: PortalComposerShortcutRecord): Record<string, unknown> {
  return {
    shortcutKey: entry.shortcutKey,
    displayName: entry.displayName,
    description: entry.description,
    template: entry.template,
    iconKey: entry.iconKey,
    tone: entry.tone,
    metadata: normalizeBaselineMetadata(entry.metadata),
    active: entry.active,
  };
}

function sanitizeApp(entry: PortalAppRecord): Record<string, unknown> {
  return {
    appName: entry.appName,
    displayName: entry.displayName,
    description: entry.description,
    status: entry.status,
    defaultLocale: entry.defaultLocale,
    config: cloneJson(entry.config),
  };
}

function sanitizeSkillBinding(entry: PortalAppSkillBindingRecord): Record<string, unknown> {
  return {
    skillSlug: entry.skillSlug,
    enabled: entry.enabled,
    sortOrder: entry.sortOrder,
    config: cloneJson(entry.config),
  };
}

function sanitizeMcpBinding(entry: PortalAppMcpBindingRecord): Record<string, unknown> {
  return {
    mcpKey: entry.mcpKey,
    enabled: entry.enabled,
    sortOrder: entry.sortOrder,
    config: cloneJson(entry.config),
  };
}

function sanitizeModelBinding(entry: PortalAppModelBindingRecord): Record<string, unknown> {
  return {
    modelRef: entry.modelRef,
    enabled: entry.enabled,
    sortOrder: entry.sortOrder,
    config: cloneJson(entry.config),
  };
}

function sanitizeMenuBinding(entry: PortalAppMenuBindingRecord): Record<string, unknown> {
  return {
    menuKey: entry.menuKey,
    enabled: entry.enabled,
    sortOrder: entry.sortOrder,
    config: cloneJson(entry.config),
  };
}

function sanitizeComposerControlBinding(entry: PortalAppComposerControlBindingRecord): Record<string, unknown> {
  return {
    controlKey: entry.controlKey,
    enabled: entry.enabled,
    sortOrder: entry.sortOrder,
    config: cloneJson(entry.config),
  };
}

function sanitizeComposerShortcutBinding(entry: PortalAppComposerShortcutBindingRecord): Record<string, unknown> {
  return {
    shortcutKey: entry.shortcutKey,
    enabled: entry.enabled,
    sortOrder: entry.sortOrder,
    config: cloneJson(entry.config),
  };
}

function sanitizeRechargePackageBinding(entry: AppRechargePackageBindingRecord): Record<string, unknown> {
  return {
    packageId: entry.packageId,
    enabled: entry.enabled,
    sortOrder: entry.sortOrder,
    recommended: entry.recommended,
    default: entry.default,
    config: cloneJson(entry.config),
  };
}

function sanitizeAsset(entry: PortalAppAssetRecord): Record<string, unknown> {
  return {
    assetKey: entry.assetKey,
    storageProvider: entry.storageProvider || null,
    objectKey: entry.objectKey,
    publicUrl: entry.publicUrl || null,
    contentType: entry.contentType,
    sha256: entry.sha256,
    sizeBytes: entry.sizeBytes,
    metadata: normalizeAssetMetadata(entry.metadata),
  };
}

function sanitizeAppDetail(detail: PortalAppDetail): Record<string, unknown> {
  return {
    app: sanitizeApp(detail.app),
    skillBindings: detail.skillBindings.map((item) => sanitizeSkillBinding(item)),
    mcpBindings: detail.mcpBindings.map((item) => sanitizeMcpBinding(item)),
    modelBindings: detail.modelBindings.map((item) => sanitizeModelBinding(item)),
    menuBindings: detail.menuBindings.map((item) => sanitizeMenuBinding(item)),
    composerControlBindings: detail.composerControlBindings.map((item) => sanitizeComposerControlBinding(item)),
    composerShortcutBindings: detail.composerShortcutBindings.map((item) => sanitizeComposerShortcutBinding(item)),
    rechargePackageBindings: detail.rechargePackageBindings.map((item) => sanitizeRechargePackageBinding(item)),
    assets: detail.assets.map((item) => sanitizeAsset(item)),
  };
}

export async function buildPlatformDbBaselineSnapshot(): Promise<PlatformDbBaselineSnapshot> {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const controlStore = new PgControlPlaneStore(config.databaseUrl);
  const portalStore = new PgPortalStore(config.databaseUrl);
  try {
    const [cloudMcps, platformSkills, platformMcps, models, menus, rechargePackages, composerControls, composerShortcuts, apps] =
      await Promise.all([
        controlStore.listMcpCatalogAdmin(),
        portalStore.listSkills(),
        portalStore.listMcps(),
        portalStore.listModels(),
        portalStore.listMenus(),
        portalStore.listRechargePackages(),
        portalStore.listComposerControls(),
        portalStore.listComposerShortcuts(),
        portalStore.listApps(),
      ]);

    const appDetails = (await Promise.all(apps.map(async (app) => portalStore.getAppDetail(app.appName)))).filter(
      Boolean,
    ) as PortalAppDetail[];

    const referencedSkillSlugs = new Set<string>();
    for (const item of platformSkills) {
      referencedSkillSlugs.add(item.slug);
    }
    for (const detail of appDetails) {
      for (const binding of detail.skillBindings) {
        referencedSkillSlugs.add(binding.skillSlug);
      }
    }

    const referencedCloudSkills = (
      await Promise.all(
        Array.from(referencedSkillSlugs)
          .sort((left, right) => left.localeCompare(right, 'zh-CN'))
          .map(async (slug) => controlStore.getSkillCatalogEntry(slug)),
      )
    ).filter(Boolean) as SkillCatalogEntryRecord[];

    return {
      schemaVersion: 1,
      source: 'database',
      catalogs: {
        cloudMcps: cloudMcps.map((item) => sanitizeCloudMcp(item)),
        referencedCloudSkills: referencedCloudSkills.map((item) => sanitizeCloudSkill(item)),
      },
      platform: {
        skills: platformSkills.map((item) => sanitizePlatformSkill(item)),
        mcps: platformMcps.map((item) => sanitizePlatformMcp(item)),
        models: models.map((item) => sanitizeModel(item)),
        menus: menus.map((item) => sanitizeMenu(item)),
        rechargePackages: rechargePackages.map((item) => sanitizeRechargePackage(item)),
        composerControls: composerControls.map((item) => sanitizeComposerControl(item)),
        composerShortcuts: composerShortcuts.map((item) => sanitizeComposerShortcut(item)),
      },
      apps: appDetails.map((item) => sanitizeAppDetail(item)),
    };
  } finally {
    await controlStore.close();
    await portalStore.close();
  }
}

export async function writePlatformDbBaselineSnapshot(outPath: string): Promise<{path: string; changed: boolean}> {
  const snapshot = await buildPlatformDbBaselineSnapshot();
  const content = stableStringify(snapshot);
  const absolutePath = resolve(outPath);
  let previous = '';
  try {
    previous = await readFile(absolutePath, 'utf8');
  } catch {
    previous = '';
  }
  await mkdir(dirname(absolutePath), {recursive: true});
  if (previous === content) {
    return {path: absolutePath, changed: false};
  }
  await writeFile(absolutePath, content, 'utf8');
  return {path: absolutePath, changed: true};
}

export async function readPlatformDbBaselineSnapshot(pathInput: string): Promise<PlatformDbBaselineSnapshot> {
  const absolutePath = resolve(pathInput);
  const raw = JSON.parse(await readFile(absolutePath, 'utf8')) as PlatformDbBaselineSnapshot;
  if (Number(asRecord(raw).schemaVersion) !== 1) {
    throw new Error(`unsupported baseline snapshot schemaVersion: ${String(asRecord(raw).schemaVersion || '')}`);
  }
  return raw;
}

export function diffPlatformDbBaselineSnapshots(
  actual: PlatformDbBaselineSnapshot,
  expected: PlatformDbBaselineSnapshot,
): {equal: boolean; actualContent: string; expectedContent: string} {
  const actualContent = stableStringify(actual);
  const expectedContent = stableStringify(expected);
  return {
    equal: actualContent === expectedContent,
    actualContent,
    expectedContent,
  };
}
