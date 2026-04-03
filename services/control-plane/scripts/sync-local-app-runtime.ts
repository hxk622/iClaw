import {access, cp, mkdtemp, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {config} from '../src/config.ts';
import {mergePlatformMcpBindings, mergePlatformSkillBindings} from '../src/platform-inheritance.ts';
import {buildPortalPublicConfig} from '../src/portal-runtime.ts';
import {PgPortalStore} from '../src/portal-store.ts';
import {PgControlPlaneStore} from '../src/pg-store.ts';
import type {
  PortalJsonObject,
  PortalResolvedMemoryEmbeddingResult,
  PortalResolvedRuntimeModelsResult,
} from '../src/portal-domain.ts';
import {
  buildCloudSkillArtifactProxyUrl,
  getCloudSkillArtifactObjectKey,
  shouldServeCloudSkillViaControlPlane,
} from '../src/cloud-skill-artifacts.ts';
import {downloadPortalSkillArtifact} from '../src/portal-skill-storage.ts';

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function isTruthy(value: unknown): boolean {
  return /^(1|true|yes)$/i.test(String(value || '').trim());
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

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function applyResolvedRuntimeModelsToConfig(
  config: PortalJsonObject,
  resolved: PortalResolvedRuntimeModelsResult,
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
      api_key: resolved.profile.apiKey || '',
      logo_preset_key: resolved.profile.logoPresetKey,
      metadata: cloneJson(resolved.profile.metadata),
      enabled: resolved.profile.enabled,
      sort_order: resolved.profile.sortOrder,
      created_at: resolved.profile.createdAt,
      updated_at: resolved.profile.updatedAt,
    },
    models: resolved.models.map((model) => ({
      id: model.id,
      model_ref: model.modelRef,
      model_id: model.modelId,
      label: model.label,
      logo_preset_key: model.logoPresetKey,
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
  resolved: PortalResolvedMemoryEmbeddingResult | null,
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
      api_key: resolved.profile.apiKey || '',
      embedding_model: resolved.profile.embeddingModel,
      logo_preset_key: resolved.profile.logoPresetKey,
      auto_recall: resolved.profile.autoRecall,
      metadata: cloneJson(resolved.profile.metadata),
      enabled: resolved.profile.enabled,
      created_at: resolved.profile.createdAt,
      updated_at: resolved.profile.updatedAt,
    },
  };
  return nextConfig;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeOptionalText(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function normalizeBindingSourceLayer(binding: PortalAppSkillBindingRecord): string {
  const config = asObject(binding.config);
  return String(config.source_layer || config.sourceLayer || '')
    .trim()
    .toLowerCase();
}

type BundledSkillManifestEntry = {
  slug: string;
  dirName: string;
  sourceLayer: string;
  artifactUrl: string | null;
  artifactSha256: string | null;
  portalArtifactObjectKey: string | null;
};

type BundledSkillManifest = {
  version: string;
  preset: string;
  publishedVersion: number | null;
  skills: string[];
  items?: BundledSkillManifestEntry[];
};

async function readBundledSkillManifest(manifestPath: string): Promise<BundledSkillManifest | null> {
  if (!(await pathExists(manifestPath))) {
    return null;
  }
  try {
    const raw = JSON.parse(await readFile(manifestPath, 'utf8')) as BundledSkillManifest;
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

async function readJsonFileIfExists(targetPath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(targetPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function canReuseBundledSkill(params: {
  existing: BundledSkillManifestEntry | undefined;
  targetPath: string;
  artifactUrl: string | null;
  artifactSha256: string | null;
  portalArtifactObjectKey: string | null;
}): boolean {
  const {existing, targetPath, artifactUrl, artifactSha256, portalArtifactObjectKey} = params;
  if (!existing) {
    return false;
  }
  if (!artifactSha256 && !existing.artifactSha256 && !artifactUrl && !existing.artifactUrl) {
    return false;
  }
  if (artifactSha256 && existing.artifactSha256) {
    return existing.artifactSha256 === artifactSha256;
  }
  return (
    existing.artifactUrl === artifactUrl &&
    existing.portalArtifactObjectKey === portalArtifactObjectKey &&
    Boolean(targetPath)
  );
}

function stringArrayEquals(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

async function canReuseCurrentRuntimeSync(params: {
  appName: string;
  runtimeSkillsRoot: string;
  runtimeMcpConfigPath: string;
  runtimeAppConfigPath: string;
  packagedSkillBaselineDir: string | null;
  packagedMcpBaselineDir: string | null;
  expectedPublishedVersion: number;
  expectedSkillSlugs: string[];
  expectedMcpKeys: string[];
  expectedMcpConfigSha256: string;
  expectedResolvedConfigSha256: string;
}): Promise<boolean> {
  const appConfig = await readJsonFileIfExists(params.runtimeAppConfigPath);
  const syncMeta = asObject(appConfig?.syncMeta);
  if (!appConfig) return false;
  if (String(syncMeta.appName || '').trim().toLowerCase() !== params.appName) return false;
  if (Number(appConfig.publishedVersion || 0) !== params.expectedPublishedVersion) return false;
  if (!stringArrayEquals(
    asArray(syncMeta.enabledMcpKeys).map((item) => String(item || '').trim()).filter(Boolean),
    params.expectedMcpKeys,
  )) return false;
  if (String(syncMeta.mcpConfigSha256 || '').trim() !== params.expectedMcpConfigSha256) return false;
  if (String(syncMeta.resolvedConfigSha256 || '').trim() !== params.expectedResolvedConfigSha256) return false;

  const skillsManifest = await readJsonFileIfExists(resolve(params.runtimeSkillsRoot, 'skills-manifest.json'));
  const skillEntries = Array.isArray(skillsManifest?.entries) ? skillsManifest!.entries : [];
  const actualSkillSlugs = skillEntries
    .map((entry) => String(asObject(entry).slug || '').trim())
    .filter(Boolean);
  if (!stringArrayEquals(actualSkillSlugs, params.expectedSkillSlugs)) return false;
  if (!(await pathExists(params.runtimeMcpConfigPath))) return false;

  if (params.packagedSkillBaselineDir) {
    if (!(await pathExists(resolve(params.packagedSkillBaselineDir, 'skills-manifest.json')))) return false;
  }
  if (params.packagedMcpBaselineDir) {
    if (!(await pathExists(resolve(params.packagedMcpBaselineDir, 'mcp-manifest.json')))) return false;
    if (!(await pathExists(resolve(params.packagedMcpBaselineDir, 'mcp.json')))) return false;
  }

  return true;
}

function resolveRuntimeWorkspaceDir(repoRoot: string): string {
  const explicitWorkspaceDir =
    process.env.ICLAW_OPENCLAW_WORKSPACE_DIR ||
    process.env.OPENCLAW_WORKSPACE_DIR ||
    '';
  if (explicitWorkspaceDir.trim()) {
    return resolve(explicitWorkspaceDir.trim());
  }
  const stateDir = process.env.OPENCLAW_STATE_DIR || join(process.env.HOME || repoRoot, '.openclaw');
  return resolve(stateDir, 'workspace');
}

function normalizeAppName(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new Error('app name is required');
  }
  return normalized;
}

function inferArtifactFormat(entry: {
  artifactFormat?: string | null;
  artifactUrl?: string | null;
  metadata?: Record<string, unknown>;
}): 'tar.gz' | 'zip' {
  const explicitFormat = String(entry.artifactFormat || '').trim().toLowerCase();
  if (explicitFormat === 'zip') {
    return 'zip';
  }
  const metadata = asObject(entry.metadata);
  const metadataFormat = String(metadata.artifact_format || metadata.artifactFormat || '').trim().toLowerCase();
  if (metadataFormat === 'zip') {
    return 'zip';
  }
  const artifactUrl = String(entry.artifactUrl || '').trim().toLowerCase();
  if (artifactUrl.endsWith('.zip')) {
    return 'zip';
  }
  return 'tar.gz';
}

async function downloadSkillArtifact(url: string): Promise<Buffer> {
  const timeoutMs = Number(process.env.ICLAW_RUNTIME_SKILL_DOWNLOAD_TIMEOUT_MS || 8000);
  const controller = new AbortController();
  const timer = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => controller.abort(new Error(`skill artifact download timed out after ${timeoutMs}ms`)), timeoutMs)
    : null;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`failed to download skill artifact: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function findSkillRoot(dir: string): Promise<string | null> {
  if (await pathExists(resolve(dir, 'SKILL.md'))) {
    return dir;
  }
  const entries = await readdir(dir, {withFileTypes: true});
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nestedDir = resolve(dir, entry.name);
    if (await pathExists(resolve(nestedDir, 'SKILL.md'))) {
      return nestedDir;
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nestedDir = await findSkillRoot(resolve(dir, entry.name));
    if (nestedDir) {
      return nestedDir;
    }
  }
  return null;
}

async function extractPortalSkillArtifact(params: {
  slug: string;
  artifact: Buffer;
  format: 'tar.gz' | 'zip';
  runtimeSkillsRoot: string;
}): Promise<string> {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'iclaw-portal-skill-'));
  try {
    const archivePath = resolve(tempRoot, params.format === 'zip' ? `${params.slug}.zip` : `${params.slug}.tar.gz`);
    const extractRoot = resolve(tempRoot, 'extract');
    await mkdir(extractRoot, {recursive: true});
    await writeFile(archivePath, params.artifact);
    if (params.format === 'zip') {
      execFileSync('unzip', ['-q', archivePath, '-d', extractRoot], {stdio: 'pipe'});
    } else {
      const archiveArg = process.platform === 'win32' ? archivePath.replace(/\\/g, '/') : archivePath;
      const extractArg = process.platform === 'win32' ? extractRoot.replace(/\\/g, '/') : extractRoot;
      const tarArgs = process.platform === 'win32'
        ? ['--force-local', '-xzf', archiveArg, '-C', extractArg]
        : ['-xzf', archiveArg, '-C', extractArg];
      execFileSync('tar', tarArgs, {stdio: 'pipe'});
    }
    const skillRoot = await findSkillRoot(extractRoot);
    if (!skillRoot) {
      throw new Error(`skill artifact ${params.slug} does not contain SKILL.md`);
    }
    const inferredDirName = basename(skillRoot);
    const dirName =
      !inferredDirName || inferredDirName === 'extract' || skillRoot === extractRoot ? params.slug : inferredDirName;
    const targetPath = resolve(params.runtimeSkillsRoot, dirName);
    await rm(targetPath, {recursive: true, force: true});
    await cp(skillRoot, targetPath, {
      recursive: true,
      force: true,
    });
    return dirName;
  } finally {
    await rm(tempRoot, {recursive: true, force: true});
  }
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const rawPositional = process.argv.slice(2).find((item) => !item.startsWith('--')) || '';
  const resolvedAppName = readArg('--app') || process.env.APP_NAME || process.env.ICLAW_PORTAL_APP_NAME || rawPositional || '';
  if (!resolvedAppName.trim()) {
    throw new Error('app name is required; set APP_NAME/ICLAW_PORTAL_APP_NAME or pass --app');
  }
  const appName = normalizeAppName(resolvedAppName);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, '../../..');
  const runtimeWorkspaceDir = resolveRuntimeWorkspaceDir(repoRoot);
  const runtimeResourcesRoot = resolve(repoRoot, 'services/openclaw/resources');
  const runtimeSkillsRoot = resolve(
    normalizeOptionalText(readArg('--skills-output-root')) ||
      normalizeOptionalText(process.env.ICLAW_RUNTIME_SKILLS_OUTPUT_ROOT) ||
      resolve(runtimeWorkspaceDir, 'skills'),
  );
  const packagedSkillBaselineDir = String(process.env.ICLAW_PACKAGED_SKILL_BASELINE_DIR || '').trim()
    ? resolve(String(process.env.ICLAW_PACKAGED_SKILL_BASELINE_DIR || '').trim())
    : null;
  const packagedMcpBaselineDir = String(process.env.ICLAW_PACKAGED_MCP_BASELINE_DIR || '').trim()
    ? resolve(String(process.env.ICLAW_PACKAGED_MCP_BASELINE_DIR || '').trim())
    : null;
  const runtimeMcpConfigPath = resolve(
    normalizeOptionalText(readArg('--mcp-config-path')) ||
      normalizeOptionalText(process.env.ICLAW_RUNTIME_MCP_CONFIG_PATH) ||
      resolve(runtimeResourcesRoot, 'mcp/mcp.json'),
  );
  const runtimeAppConfigPath = resolve(
    normalizeOptionalText(readArg('--app-config-path')) ||
      normalizeOptionalText(process.env.ICLAW_RUNTIME_APP_CONFIG_PATH) ||
      resolve(runtimeResourcesRoot, 'config/portal-app-runtime.json'),
  );
  const skipRuntimeSkillSync = /^(1|true|yes)$/i.test(String(process.env.ICLAW_SKIP_RUNTIME_SKILL_SYNC || '').trim());
  const bundledOnly = hasFlag('--bundled-only') || isTruthy(process.env.ICLAW_BUNDLED_SKILLS_ONLY);
  const incrementalSkillSync = hasFlag('--no-incremental')
    ? false
    : hasFlag('--incremental') || !/^(0|false|no)$/i.test(String(process.env.ICLAW_INCREMENTAL_SKILL_SYNC || '1').trim());

  const portalStore = new PgPortalStore(config.databaseUrl);
  const controlStore = new PgControlPlaneStore(config.databaseUrl);
  try {
    const [detail, catalogMcps, platformSkills, platformMcps] = await Promise.all([
      portalStore.getAppDetail(appName),
      controlStore.listMcpCatalogAdmin(),
      portalStore.listSkills(),
      portalStore.listMcps(),
    ]);
    if (!detail) {
      throw new Error(`portal app not found: ${appName}`);
    }

    const detailWithPlatformSkills = {
      ...detail,
      skillBindings: mergePlatformSkillBindings(
        appName,
        detail.skillBindings,
        platformSkills,
      ),
    };
    const detailWithPlatformCapabilities = {
      ...detailWithPlatformSkills,
      mcpBindings: mergePlatformMcpBindings(
        appName,
        detail.mcpBindings,
        platformMcps,
      ),
    };
    const expectedSkillSlugs = detailWithPlatformSkills.skillBindings
      .filter((item) => item.enabled)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item) => item.skillSlug);
    const copiedSkills: string[] = [];
    const copiedSkillDirs = new Set<string>();
    const packagedSkillEntries: Array<{
      slug: string;
      version: string | null;
      artifactUrl: string | null;
      artifactFormat: string;
      artifactSha256: string | null;
      dirName: string;
    }> = [];
    const skippedSkills: string[] = [];
    const rememberCopiedSkill = (
      dirName: string,
      entry?: {
        slug: string;
        version: string | null;
        artifactUrl: string | null;
        artifactFormat: string;
        artifactSha256: string | null;
      },
    ) => {
      const normalized = dirName.trim();
      if (!normalized || copiedSkillDirs.has(normalized)) {
        return;
      }
      copiedSkillDirs.add(normalized);
      copiedSkills.push(normalized);
      if (entry) {
        packagedSkillEntries.push({
          ...entry,
          dirName: normalized,
        });
      }
    };

    const catalogByKey = new Map(catalogMcps.map((item) => [item.mcpKey, item]));
    const enabledBindings = detailWithPlatformCapabilities.mcpBindings
      .filter((item) => item.enabled)
      .sort((left, right) => left.sortOrder - right.sortOrder);
    const nextMcpServers = Object.fromEntries(
      enabledBindings.map((binding) => {
        const catalogConfig = asObject(catalogByKey.get(binding.mcpKey)?.config);
        return [
          binding.mcpKey,
          {
            ...catalogConfig,
            ...binding.config,
            enabled: true,
          },
        ];
      }),
    );

    const publicConfig = buildPortalPublicConfig(detailWithPlatformCapabilities, {
      assetUrlResolver: (asset) => asset.publicUrl || asset.objectKey || null,
    });
    const resolvedRuntimeModels = await portalStore.resolveRuntimeModels(appName);
    const resolvedMemoryEmbedding = await portalStore.resolveMemoryEmbedding(appName);
    const modelResolvedConfig = resolvedRuntimeModels
      ? applyResolvedRuntimeModelsToConfig(publicConfig.config, resolvedRuntimeModels)
      : publicConfig.config;
    const resolvedConfig = applyResolvedMemoryEmbeddingToConfig(
      modelResolvedConfig,
      resolvedMemoryEmbedding,
    );
    const resolvedConfigWithMcp = {
      ...resolvedConfig,
      resolved_mcp_servers: cloneJson(nextMcpServers),
    };
    const expectedPublishedVersion = Number(publicConfig.publishedVersion || 0);
    const expectedMcpKeys = enabledBindings.map((item) => item.mcpKey);
    const expectedMcpConfigSha256 = hashJson(nextMcpServers);
    const expectedResolvedConfigSha256 = hashJson({
      app: publicConfig.app,
      publishedVersion: publicConfig.publishedVersion,
      config: resolvedConfigWithMcp,
    });

    if (await canReuseCurrentRuntimeSync({
      appName,
      runtimeSkillsRoot,
      runtimeMcpConfigPath,
      runtimeAppConfigPath,
      packagedSkillBaselineDir,
      packagedMcpBaselineDir,
      expectedPublishedVersion,
      expectedSkillSlugs,
      expectedMcpKeys,
      expectedMcpConfigSha256,
      expectedResolvedConfigSha256,
    })) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            appName,
            reusedCachedRuntimeSync: true,
            enabledMcpKeys: expectedMcpKeys,
            runtimeSkillsRoot,
            runtimeMcpConfigPath,
            runtimeAppConfigPath,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (!skipRuntimeSkillSync) {
      const targetBindings = detailWithPlatformSkills.skillBindings
        .filter((item) => item.enabled)
        .filter((item) => !bundledOnly || ['platform_bundled', 'oem_bundled'].includes(normalizeBindingSourceLayer(item)))
        .sort((left, right) => left.sortOrder - right.sortOrder);
      const manifestPath = resolve(runtimeSkillsRoot, 'skills-manifest.json');
      const previousManifest = incrementalSkillSync ? await readBundledSkillManifest(manifestPath) : null;
      const previousItems = new Map(
        Array.isArray(previousManifest?.items)
          ? previousManifest.items
              .filter((item) => item && typeof item === 'object')
              .map((item) => [String(item.slug || '').trim(), item] as const)
              .filter(([slug]) => Boolean(slug))
          : [],
      );

      if (!incrementalSkillSync) {
        await rm(runtimeSkillsRoot, {recursive: true, force: true});
      }
      await mkdir(runtimeSkillsRoot, {recursive: true});

      const nextManifestItems: BundledSkillManifestEntry[] = [];

      for (const binding of targetBindings) {
        const entry = await controlStore.getSkillCatalogEntry(binding.skillSlug);
        if (!entry || entry.active === false) {
          skippedSkills.push(binding.skillSlug);
          continue;
        }
        const sourceLayer = normalizeBindingSourceLayer(binding) || 'oem_bundled';
        const portalArtifactObjectKey = getCloudSkillArtifactObjectKey(entry.metadata || {});
        const resolvedArtifactUrl =
          entry.artifactUrl ||
          (shouldServeCloudSkillViaControlPlane(entry)
            ? buildCloudSkillArtifactProxyUrl(binding.skillSlug, config.apiUrl || `http://127.0.0.1:${config.port}`)
            : null);
        const existingEntry = previousItems.get(binding.skillSlug);
        const existingDirName = normalizeOptionalText(existingEntry?.dirName);
        const existingTargetPath = existingDirName ? resolve(runtimeSkillsRoot, existingDirName) : '';
        if (
          incrementalSkillSync &&
          existingDirName &&
          (await pathExists(existingTargetPath)) &&
          canReuseBundledSkill({
            existing: existingEntry,
            targetPath: existingTargetPath,
            artifactUrl: resolvedArtifactUrl,
            artifactSha256: normalizeOptionalText(entry.artifactSha256),
            portalArtifactObjectKey,
          })
        ) {
          rememberCopiedSkill(existingDirName);
          nextManifestItems.push({
            slug: binding.skillSlug,
            dirName: existingDirName,
            sourceLayer,
            artifactUrl: resolvedArtifactUrl,
            artifactSha256: normalizeOptionalText(entry.artifactSha256),
            portalArtifactObjectKey,
          });
          continue;
        }
        if (entry.distribution === 'cloud' && portalArtifactObjectKey) {
          try {
            const artifact = await downloadPortalSkillArtifact(portalArtifactObjectKey);
            const copiedDirName = await extractPortalSkillArtifact({
              slug: binding.skillSlug,
              artifact: artifact.buffer,
              format: inferArtifactFormat(entry),
              runtimeSkillsRoot,
            });
            if (existingDirName && existingDirName !== copiedDirName) {
              await rm(resolve(runtimeSkillsRoot, existingDirName), {recursive: true, force: true});
            }
            rememberCopiedSkill(copiedDirName, {
              slug: binding.skillSlug,
              version: entry.version,
              artifactUrl: resolvedArtifactUrl,
              artifactFormat: inferArtifactFormat(entry),
              artifactSha256: entry.artifactSha256,
            });
            nextManifestItems.push({
              slug: binding.skillSlug,
              dirName: copiedDirName,
              sourceLayer,
              artifactUrl: resolvedArtifactUrl,
              artifactSha256: normalizeOptionalText(entry.artifactSha256),
              portalArtifactObjectKey,
            });
            continue;
          } catch (error) {
            console.warn('[sync-local-app-runtime] failed to download portal skill artifact from storage', {
              slug: binding.skillSlug,
              objectKey: portalArtifactObjectKey,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        if (resolvedArtifactUrl) {
          try {
            const artifact = await downloadSkillArtifact(resolvedArtifactUrl);
            const copiedDirName = await extractPortalSkillArtifact({
              slug: binding.skillSlug,
              artifact,
              format: inferArtifactFormat(entry),
              runtimeSkillsRoot,
            });
            if (existingDirName && existingDirName !== copiedDirName) {
              await rm(resolve(runtimeSkillsRoot, existingDirName), {recursive: true, force: true});
            }
            rememberCopiedSkill(copiedDirName, {
              slug: binding.skillSlug,
              version: entry.version,
              artifactUrl: resolvedArtifactUrl,
              artifactFormat: inferArtifactFormat(entry),
              artifactSha256: entry.artifactSha256,
            });
            nextManifestItems.push({
              slug: binding.skillSlug,
              dirName: copiedDirName,
              sourceLayer,
              artifactUrl: resolvedArtifactUrl,
              artifactSha256: normalizeOptionalText(entry.artifactSha256),
              portalArtifactObjectKey,
            });
            continue;
          } catch (error) {
            console.warn('[sync-local-app-runtime] failed to download skill artifact', {
              slug: binding.skillSlug,
              artifactUrl: resolvedArtifactUrl,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        skippedSkills.push(binding.skillSlug);
      }

      if (incrementalSkillSync && previousItems.size > 0) {
        const desiredSlugs = new Set(nextManifestItems.map((item) => item.slug));
        for (const [slug, item] of previousItems.entries()) {
          if (desiredSlugs.has(slug)) {
            continue;
          }
          const dirName = normalizeOptionalText(item.dirName);
          if (!dirName) {
            continue;
          }
          await rm(resolve(runtimeSkillsRoot, dirName), {recursive: true, force: true});
        }
      }

      const skillsManifest = {
        version: '0.2.0',
        preset: appName,
        brandId: appName,
        publishedVersion: Number(publicConfig.publishedVersion || detail.publishedVersion || 0),
        skillSlugs: expectedSkillSlugs,
        skills: copiedSkills,
        items: nextManifestItems,
        entries: packagedSkillEntries,
      };
      await writeFile(
        manifestPath,
        `${JSON.stringify(skillsManifest, null, 2)}\n`,
        'utf8',
      );
      if (packagedSkillBaselineDir) {
        await rm(packagedSkillBaselineDir, {recursive: true, force: true});
        await mkdir(dirname(packagedSkillBaselineDir), {recursive: true});
        await cp(runtimeSkillsRoot, packagedSkillBaselineDir, {
          recursive: true,
          force: true,
        });
      }
    }

    await mkdir(dirname(runtimeMcpConfigPath), {recursive: true});
    await writeFile(
      runtimeMcpConfigPath,
      `${JSON.stringify(
        {
          mcpServers: nextMcpServers,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    const mcpManifest = {
      version: '0.1.0',
      preset: appName,
      brandId: appName,
      publishedVersion: Number(publicConfig.publishedVersion || detail.publishedVersion || 0),
      mcpKeys: enabledBindings.map((item) => item.mcpKey),
      configSha256: hashJson(nextMcpServers),
      entries: enabledBindings.map((binding) => {
        const catalog = catalogByKey.get(binding.mcpKey);
        return {
          mcpKey: binding.mcpKey,
          sortOrder: binding.sortOrder,
          transport: String(catalog?.transport || '').trim() || 'config',
          objectKey: catalog?.objectKey || null,
          configSha256: hashJson(nextMcpServers[binding.mcpKey] || {}),
        };
      }),
    };
    if (packagedMcpBaselineDir) {
      await rm(packagedMcpBaselineDir, {recursive: true, force: true});
      await mkdir(packagedMcpBaselineDir, {recursive: true});
      await writeFile(
        resolve(packagedMcpBaselineDir, 'mcp.json'),
        `${JSON.stringify({mcpServers: nextMcpServers}, null, 2)}\n`,
        'utf8',
      );
      await writeFile(
        resolve(packagedMcpBaselineDir, 'mcp-manifest.json'),
        `${JSON.stringify(mcpManifest, null, 2)}\n`,
        'utf8',
      );
    }

    await mkdir(dirname(runtimeAppConfigPath), {recursive: true});
    await writeFile(
      runtimeAppConfigPath,
      `${JSON.stringify(
        {
          app: publicConfig.app,
          publishedVersion: publicConfig.publishedVersion,
          config: resolvedConfigWithMcp,
          syncMeta: {
            appName,
            syncedAt: new Date().toISOString(),
            copiedSkillDirs: copiedSkills,
            skippedSkillSlugs: skippedSkills,
            enabledMcpKeys: enabledBindings.map((item) => item.mcpKey),
            mcpConfigSha256: mcpManifest.configSha256,
            resolvedConfigSha256: expectedResolvedConfigSha256,
            skipRuntimeSkillSync,
            bundledOnly,
            incrementalSkillSync,
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          appName,
          runtimeWorkspaceDir,
          copiedSkillDirs: copiedSkills,
          skippedSkillSlugs: skippedSkills,
          enabledMcpKeys: enabledBindings.map((item) => item.mcpKey),
          skipRuntimeSkillSync,
          bundledOnly,
          incrementalSkillSync,
          runtimeSkillsRoot,
          runtimeMcpConfigPath,
          runtimeAppConfigPath,
        },
        null,
        2,
      ),
    );
  } finally {
    await Promise.all([portalStore.close(), controlStore.close()]);
  }
}

await main();
