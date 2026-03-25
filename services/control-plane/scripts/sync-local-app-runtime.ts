import {cp, mkdtemp, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {basename, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {config} from '../src/config.ts';
import {mergePlatformSkillBindings} from '../src/platform-inheritance.ts';
import {buildPortalPublicConfig} from '../src/portal-runtime.ts';
import {PgPortalStore} from '../src/portal-store.ts';
import {PgControlPlaneStore} from '../src/pg-store.ts';

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
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to download skill artifact: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
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
    const dirName = basename(skillRoot) || params.slug;
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
  const projectMcpConfigPath = resolve(repoRoot, 'mcp/mcp.json');
  const runtimeResourcesRoot = resolve(repoRoot, 'services/openclaw/resources');
  const runtimeSkillsRoot = resolve(runtimeResourcesRoot, 'skills');
  const runtimeMcpConfigPath = resolve(runtimeResourcesRoot, 'mcp/mcp.json');
  const runtimeAppConfigPath = resolve(runtimeResourcesRoot, 'config/portal-app-runtime.json');

  const portalStore = new PgPortalStore(config.databaseUrl);
  const controlStore = new PgControlPlaneStore(config.databaseUrl);

  try {
    const [detail, catalogMcps, platformSkills] = await Promise.all([
      portalStore.getAppDetail(appName),
      portalStore.listMcps(),
      portalStore.listSkills(),
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
      if (entry.artifactUrl) {
        try {
          const artifact = await downloadSkillArtifact(entry.artifactUrl);
          const copiedDirName = await extractPortalSkillArtifact({
            slug: binding.skillSlug,
            artifact,
            format: inferArtifactFormat(entry),
            runtimeSkillsRoot,
          });
          rememberCopiedSkill(copiedDirName);
          continue;
        } catch (error) {
          console.warn('[sync-local-app-runtime] failed to download skill artifact, fallback to local source path', {
            slug: binding.skillSlug,
            artifactUrl: entry.artifactUrl,
            error: error instanceof Error ? error.message : String(error),
          });
        }
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

    const projectMcp = JSON.parse(await readFile(projectMcpConfigPath, 'utf8')) as {mcpServers?: Record<string, unknown>};
    const catalogByKey = new Map(catalogMcps.map((item) => [item.mcpKey, item]));
    const enabledBindings = detail.mcpBindings.filter((item) => item.enabled).sort((left, right) => left.sortOrder - right.sortOrder);
    const nextMcpServers = Object.fromEntries(
      enabledBindings.map((binding) => {
        const baseConfig = asObject(projectMcp.mcpServers?.[binding.mcpKey]);
        const catalogConfig = asObject(catalogByKey.get(binding.mcpKey)?.config);
        return [
          binding.mcpKey,
          {
            ...baseConfig,
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

    const publicConfig = buildPortalPublicConfig(detailWithPlatformSkills, {
      assetUrlResolver: (asset) => asset.publicUrl || asset.objectKey || null,
    });
    await mkdir(dirname(runtimeAppConfigPath), {recursive: true});
    await writeFile(
      runtimeAppConfigPath,
      `${JSON.stringify(
        {
          app: publicConfig.app,
          publishedVersion: publicConfig.publishedVersion,
          config: publicConfig.config,
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
