import {cp, mkdtemp, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {basename, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {config} from '../src/config.ts';
import {mergePlatformMcpBindings, mergePlatformSkillBindings} from '../src/platform-inheritance.ts';
import {buildPortalPublicConfig} from '../src/portal-runtime.ts';
import {PgPortalStore} from '../src/portal-store.ts';
import {PgControlPlaneStore} from '../src/pg-store.ts';
import type {PortalJsonObject, PortalResolvedRuntimeModelsResult} from '../src/portal-domain.ts';
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

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await readFile(targetPath);
    return true;
  } catch {
    return false;
  }
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
      execFileSync('tar', ['-xzf', archivePath, '-C', extractRoot], {stdio: 'pipe'});
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
  const skillsSourceRoot = resolve(repoRoot, 'skills');
  const runtimeResourcesRoot = resolve(repoRoot, 'services/openclaw/resources');
  const runtimeSkillsRoot = resolve(runtimeResourcesRoot, 'skills');
  const runtimeMcpConfigPath = resolve(runtimeResourcesRoot, 'mcp/mcp.json');
  const runtimeAppConfigPath = resolve(runtimeResourcesRoot, 'config/portal-app-runtime.json');

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

    await rm(runtimeSkillsRoot, {recursive: true, force: true});
    await mkdir(runtimeSkillsRoot, {recursive: true});

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
    const copiedSkills: string[] = [];
    const copiedSkillDirs = new Set<string>();
    const skippedSkills: string[] = [];
    const rememberCopiedSkill = (dirName: string) => {
      const normalized = dirName.trim();
      if (!normalized || copiedSkillDirs.has(normalized)) {
        return;
      }
      copiedSkillDirs.add(normalized);
      copiedSkills.push(normalized);
    };

    for (const binding of detailWithPlatformSkills.skillBindings.filter((item) => item.enabled).sort((left, right) => left.sortOrder - right.sortOrder)) {
      const entry = await controlStore.getSkillCatalogEntry(binding.skillSlug);
      if (!entry || entry.active === false) {
        skippedSkills.push(binding.skillSlug);
        continue;
      }
      const portalArtifactObjectKey = getCloudSkillArtifactObjectKey(entry.metadata || {});
      if (entry.distribution === 'cloud' && portalArtifactObjectKey) {
        try {
          const artifact = await downloadPortalSkillArtifact(portalArtifactObjectKey);
          const copiedDirName = await extractPortalSkillArtifact({
            slug: binding.skillSlug,
            artifact: artifact.buffer,
            format: inferArtifactFormat(entry),
            runtimeSkillsRoot,
          });
          rememberCopiedSkill(copiedDirName);
          continue;
        } catch (error) {
          console.warn('[sync-local-app-runtime] failed to download portal skill artifact from storage', {
            slug: binding.skillSlug,
            objectKey: portalArtifactObjectKey,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      const resolvedArtifactUrl =
        entry.artifactUrl ||
        (shouldServeCloudSkillViaControlPlane(entry)
          ? buildCloudSkillArtifactProxyUrl(binding.skillSlug, config.apiUrl || `http://127.0.0.1:${config.port}`)
          : null);
      if (resolvedArtifactUrl) {
        try {
          const artifact = await downloadSkillArtifact(resolvedArtifactUrl);
          const copiedDirName = await extractPortalSkillArtifact({
            slug: binding.skillSlug,
            artifact,
            format: inferArtifactFormat(entry),
            runtimeSkillsRoot,
          });
          rememberCopiedSkill(copiedDirName);
          continue;
        } catch (error) {
          console.warn('[sync-local-app-runtime] failed to download skill artifact', {
            slug: binding.skillSlug,
            artifactUrl: resolvedArtifactUrl,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (entry.distribution === 'cloud') {
        skippedSkills.push(binding.skillSlug);
        continue;
      }
      const relativeSourcePath = entry?.artifactSourcePath?.trim() || '';
      if (!relativeSourcePath) {
        skippedSkills.push(binding.skillSlug);
        continue;
      }
      if (copiedSkillDirs.has(relativeSourcePath)) {
        continue;
      }
      const sourcePath = resolve(skillsSourceRoot, relativeSourcePath);
      if (!(await pathExists(resolve(sourcePath, 'SKILL.md')))) {
        skippedSkills.push(binding.skillSlug);
        continue;
      }
      await cp(sourcePath, resolve(runtimeSkillsRoot, relativeSourcePath), {
        recursive: true,
        force: true,
      });
      rememberCopiedSkill(relativeSourcePath);
    }

    await writeFile(
      resolve(runtimeSkillsRoot, 'skills-manifest.json'),
      `${JSON.stringify(
        {
          version: '0.1.0',
          preset: appName,
          skills: copiedSkills,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

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

    const publicConfig = buildPortalPublicConfig(detailWithPlatformCapabilities, {
      assetUrlResolver: (asset) => asset.publicUrl || asset.objectKey || null,
    });
    const resolvedRuntimeModels = await portalStore.resolveRuntimeModels(appName);
    const resolvedConfig = resolvedRuntimeModels
      ? applyResolvedRuntimeModelsToConfig(publicConfig.config, resolvedRuntimeModels)
      : publicConfig.config;
    await mkdir(dirname(runtimeAppConfigPath), {recursive: true});
    await writeFile(
      runtimeAppConfigPath,
      `${JSON.stringify(
        {
          app: publicConfig.app,
          publishedVersion: publicConfig.publishedVersion,
          config: resolvedConfig,
          syncMeta: {
            appName,
            syncedAt: new Date().toISOString(),
            copiedSkillDirs: copiedSkills,
            skippedSkillSlugs: skippedSkills,
            enabledMcpKeys: enabledBindings.map((item) => item.mcpKey),
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
          copiedSkillDirs: copiedSkills,
          skippedSkillSlugs: skippedSkills,
          enabledMcpKeys: enabledBindings.map((item) => item.mcpKey),
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
