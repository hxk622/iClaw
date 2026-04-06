import {config} from '../src/config.ts';
import {ensureControlPlaneSchema, PgControlPlaneStore} from '../src/pg-store.ts';
import {PgPortalStore} from '../src/portal-store.ts';
import type {PortalJsonObject} from '../src/portal-domain.ts';
import {
  DEFAULT_PLATFORM_DB_BASELINE_PATH,
  readPlatformDbBaselineSnapshot,
  type PlatformDbBaselineSnapshot,
} from './lib/platform-db-baseline.ts';

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asJsonObject(value: unknown): PortalJsonObject {
  return asObject(value) as PortalJsonObject;
}

function normalizeBaselineMetadata(value: unknown): PortalJsonObject {
  const metadata = asJsonObject(value);
  const sourceType = asString(metadata.sourceType || metadata.source_type);
  const next: Record<string, unknown> = {...metadata};
  delete next.source_type;
  if (sourceType === 'preset') {
    next.sourceType = 'baseline_seed';
  } else if (sourceType) {
    next.sourceType = sourceType;
  }
  return next as PortalJsonObject;
}

function normalizeAssetMetadata(value: unknown): PortalJsonObject {
  const metadata = asJsonObject(value);
  const repoAssetPath =
    asString(metadata.repoAssetPath || metadata.repo_asset_path || metadata.presetFilePath || metadata.preset_file_path) ||
    '';
  const sourceType = asString(metadata.sourceType || metadata.source_type);
  const next: Record<string, unknown> = {...metadata};
  delete next.presetFilePath;
  delete next.preset_file_path;
  delete next.repo_asset_path;
  delete next.source_type;
  if (repoAssetPath) {
    next.repoAssetPath = repoAssetPath;
  }
  if (sourceType === 'preset' || (!sourceType && repoAssetPath)) {
    next.sourceType = 'repo_asset';
  } else if (sourceType) {
    next.sourceType = sourceType;
  }
  return next as PortalJsonObject;
}

async function applySnapshot(snapshot: PlatformDbBaselineSnapshot) {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  await ensureControlPlaneSchema(config.databaseUrl);

  const controlStore = new PgControlPlaneStore(config.databaseUrl);
  const portalStore = new PgPortalStore(config.databaseUrl);
  try {
    for (const raw of snapshot.catalogs.referencedCloudSkills || []) {
      const entry = asObject(raw);
      await controlStore.upsertSkillCatalogEntry({
        slug: asString(entry.slug),
        name: asString(entry.name),
        description: asString(entry.description),
        market: asString(entry.market) || null,
        category: asString(entry.category) || null,
        skill_type: asString(entry.skillType) || null,
        publisher: asString(entry.publisher) || 'iClaw',
        distribution: (asString(entry.distribution) || 'cloud') as 'cloud' | 'private',
        tags: asArray(entry.tags).map((item) => asString(item)).filter(Boolean),
        version: asString(entry.version) || '1.0.0',
        artifact_url: asString(entry.artifactUrl) || null,
        artifact_format: (asString(entry.artifactFormat) || 'tar.gz') as 'tar.gz' | 'zip',
        artifact_sha256: asString(entry.artifactSha256) || null,
        artifact_source_path: asString(entry.artifactSourcePath) || null,
        origin_type: (asString(entry.originType) || 'manual') as 'manual' | 'clawhub' | 'github_repo',
        source_url: asString(entry.sourceUrl) || null,
        metadata: normalizeBaselineMetadata(entry.metadata),
        active: asBoolean(entry.active, true),
      });
    }

    for (const raw of snapshot.catalogs.cloudMcps || []) {
      const entry = asObject(raw);
      await controlStore.upsertMcpCatalogEntry({
        mcp_key: asString(entry.mcpKey),
        name: asString(entry.name),
        description: asString(entry.description),
        transport: asString(entry.transport) || 'config',
        object_key: asString(entry.objectKey) || null,
        config: asObject(entry.config),
        metadata: normalizeBaselineMetadata(entry.metadata),
        active: asBoolean(entry.active, true),
      });
    }

    await portalStore.applyBaselineSnapshot({
      apps: asArray(snapshot.apps).map((raw) => {
        const entry = asObject(raw);
        const app = asObject(entry.app);
        return {
          appName: asString(app.appName),
          displayName: asString(app.displayName),
          description: asString(app.description) || null,
          status: (asString(app.status) || 'active') as 'active' | 'disabled',
          defaultLocale: asString(app.defaultLocale) || 'zh-CN',
          config: asJsonObject(app.config),
        };
      }),
      skills: asArray(snapshot.platform.skills).map((raw) => {
        const entry = asObject(raw);
        return {
          slug: asString(entry.slug),
          metadata: normalizeBaselineMetadata(entry.metadata),
          active: asBoolean(entry.active, true),
        };
      }),
      mcps: asArray(snapshot.catalogs.cloudMcps).map((raw) => {
        const entry = asObject(raw);
        return {
          mcpKey: asString(entry.mcpKey),
          name: asString(entry.name),
          description: asString(entry.description),
          transport: asString(entry.transport) || 'config',
          objectKey: asString(entry.objectKey) || null,
          config: asJsonObject(entry.config),
          metadata: normalizeBaselineMetadata(entry.metadata),
          active: asBoolean(entry.active, true),
        };
      }),
      models: asArray(snapshot.platform.models).map((raw) => {
        const entry = asObject(raw);
        return {
          ref: asString(entry.ref),
          label: asString(entry.label),
          providerId: asString(entry.providerId),
          modelId: asString(entry.modelId),
          api: asString(entry.api),
          baseUrl: asString(entry.baseUrl) || null,
          useRuntimeOpenai: asBoolean(entry.useRuntimeOpenai, false),
          authHeader: asBoolean(entry.authHeader, true),
          reasoning: asBoolean(entry.reasoning, false),
          input: asArray(entry.input).map((item) => asString(item)).filter(Boolean),
          contextWindow: asNumber(entry.contextWindow, 0),
          maxTokens: asNumber(entry.maxTokens, 0),
          metadata: normalizeBaselineMetadata(entry.metadata),
          active: asBoolean(entry.active, true),
        };
      }),
      menus: asArray(snapshot.platform.menus).map((raw) => {
        const entry = asObject(raw);
        return {
          menuKey: asString(entry.menuKey),
          displayName: asString(entry.displayName),
          category: asString(entry.category) || null,
          routeKey: asString(entry.routeKey) || null,
          iconKey: asString(entry.iconKey) || null,
          metadata: normalizeBaselineMetadata(entry.metadata),
          active: asBoolean(entry.active, true),
        };
      }),
      rechargePackages: asArray(snapshot.platform.rechargePackages).map((raw) => {
        const entry = asObject(raw);
        return {
          packageId: asString(entry.packageId),
          packageName: asString(entry.packageName),
          credits: asNumber(entry.credits, 0),
          bonusCredits: asNumber(entry.bonusCredits, 0),
          amountCnyFen: asNumber(entry.amountCnyFen, 0),
          sortOrder: asNumber(entry.sortOrder, 100),
          recommended: asBoolean(entry.recommended, false),
          default: asBoolean(entry.default, false),
          metadata: asJsonObject(entry.metadata),
          active: asBoolean(entry.active, true),
        };
      }),
      composerControls: asArray(snapshot.platform.composerControls).map((raw) => {
        const entry = asObject(raw);
        return {
          controlKey: asString(entry.controlKey),
          displayName: asString(entry.displayName),
          controlType: asString(entry.controlType),
          iconKey: asString(entry.iconKey) || null,
          metadata: normalizeBaselineMetadata(entry.metadata),
          active: asBoolean(entry.active, true),
          options: asArray(entry.options).map((optionRaw) => {
            const option = asObject(optionRaw);
            return {
              optionValue: asString(option.optionValue),
              label: asString(option.label),
              description: asString(option.description) || null,
              sortOrder: asNumber(option.sortOrder, 100),
              metadata: normalizeBaselineMetadata(option.metadata),
              active: asBoolean(option.active, true),
            };
          }),
        };
      }),
      composerShortcuts: asArray(snapshot.platform.composerShortcuts).map((raw) => {
        const entry = asObject(raw);
        return {
          shortcutKey: asString(entry.shortcutKey),
          displayName: asString(entry.displayName),
          description: asString(entry.description) || null,
          template: asString(entry.template),
          iconKey: asString(entry.iconKey) || null,
          tone: asString(entry.tone) || null,
          metadata: normalizeBaselineMetadata(entry.metadata),
          active: asBoolean(entry.active, true),
        };
      }),
      skillBindings: asArray(snapshot.apps).map((raw) => {
        const entry = asObject(raw);
        const app = asObject(entry.app);
        return {
          appName: asString(app.appName),
          items: asArray(entry.skillBindings).map((itemRaw) => {
            const item = asObject(itemRaw);
            return {
              skillSlug: asString(item.skillSlug),
              enabled: asBoolean(item.enabled, true),
              sortOrder: asNumber(item.sortOrder, 100),
              config: asJsonObject(item.config),
            };
          }),
        };
      }),
      mcpBindings: asArray(snapshot.apps).map((raw) => {
        const entry = asObject(raw);
        const app = asObject(entry.app);
        return {
          appName: asString(app.appName),
          items: asArray(entry.mcpBindings).map((itemRaw) => {
            const item = asObject(itemRaw);
            return {
              mcpKey: asString(item.mcpKey),
              enabled: asBoolean(item.enabled, true),
              sortOrder: asNumber(item.sortOrder, 100),
              config: asJsonObject(item.config),
            };
          }),
        };
      }),
      modelBindings: asArray(snapshot.apps).map((raw) => {
        const entry = asObject(raw);
        const app = asObject(entry.app);
        return {
          appName: asString(app.appName),
          items: asArray(entry.modelBindings).map((itemRaw) => {
            const item = asObject(itemRaw);
            return {
              modelRef: asString(item.modelRef),
              enabled: asBoolean(item.enabled, true),
              sortOrder: asNumber(item.sortOrder, 100),
              config: asJsonObject(item.config),
            };
          }),
        };
      }),
      menuBindings: asArray(snapshot.apps).map((raw) => {
        const entry = asObject(raw);
        const app = asObject(entry.app);
        return {
          appName: asString(app.appName),
          items: asArray(entry.menuBindings).map((itemRaw) => {
            const item = asObject(itemRaw);
            return {
              menuKey: asString(item.menuKey),
              enabled: asBoolean(item.enabled, true),
              sortOrder: asNumber(item.sortOrder, 100),
              config: asJsonObject(item.config),
            };
          }),
        };
      }),
      rechargePackageBindings: asArray(snapshot.apps).map((raw) => {
        const entry = asObject(raw);
        const app = asObject(entry.app);
        return {
          appName: asString(app.appName),
          items: asArray(entry.rechargePackageBindings).map((itemRaw) => {
            const item = asObject(itemRaw);
            return {
              packageId: asString(item.packageId),
              enabled: asBoolean(item.enabled, true),
              sortOrder: asNumber(item.sortOrder, 100),
              recommended: asBoolean(item.recommended, false),
              default: asBoolean(item.default, false),
              config: asJsonObject(item.config),
            };
          }),
        };
      }),
      composerControlBindings: asArray(snapshot.apps).map((raw) => {
        const entry = asObject(raw);
        const app = asObject(entry.app);
        return {
          appName: asString(app.appName),
          items: asArray(entry.composerControlBindings).map((itemRaw) => {
            const item = asObject(itemRaw);
            return {
              controlKey: asString(item.controlKey),
              enabled: asBoolean(item.enabled, true),
              sortOrder: asNumber(item.sortOrder, 100),
              config: asJsonObject(item.config),
            };
          }),
        };
      }),
      composerShortcutBindings: asArray(snapshot.apps).map((raw) => {
        const entry = asObject(raw);
        const app = asObject(entry.app);
        return {
          appName: asString(app.appName),
          items: asArray(entry.composerShortcutBindings).map((itemRaw) => {
            const item = asObject(itemRaw);
            return {
              shortcutKey: asString(item.shortcutKey),
              enabled: asBoolean(item.enabled, true),
              sortOrder: asNumber(item.sortOrder, 100),
              config: asJsonObject(item.config),
            };
          }),
        };
      }),
      preserveExistingAppState: false,
    });

    for (const raw of snapshot.platform.mcps || []) {
      const entry = asObject(raw);
      await portalStore.upsertMcp({
        mcpKey: asString(entry.mcpKey),
        metadata: asJsonObject(entry.metadata),
        active: asBoolean(entry.active, true),
      });
    }

    for (const raw of snapshot.apps || []) {
      const entry = asObject(raw);
      const app = asObject(entry.app);
      const appName = asString(app.appName);
      for (const assetRaw of asArray(entry.assets)) {
        const asset = asObject(assetRaw);
        const objectKey = asString(asset.objectKey);
        if (!objectKey) {
          continue;
        }
        await portalStore.upsertAsset({
          appName,
          assetKey: asString(asset.assetKey),
          storageProvider: asString(asset.storageProvider) || 's3',
          objectKey,
          publicUrl: asString(asset.publicUrl) || null,
          contentType: asString(asset.contentType) || null,
          sha256: asString(asset.sha256) || null,
          sizeBytes: asNumber(asset.sizeBytes, 0) || null,
          metadata: normalizeAssetMetadata(asset.metadata),
          actorUserId: null,
        });
      }
    }
  } finally {
    await controlStore.close();
    await portalStore.close();
  }
}

async function main() {
  const snapshotPath = readArg('--snapshot') || DEFAULT_PLATFORM_DB_BASELINE_PATH;
  const snapshot = await readPlatformDbBaselineSnapshot(snapshotPath);
  await applySnapshot(snapshot);
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        snapshotPath,
        source: 'database',
        mode: 'apply',
      },
      null,
      2,
    )}\n`,
  );
}

await main();
