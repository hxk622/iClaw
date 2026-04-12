#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {execFile as execFileCallback, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const execFile = promisify(execFileCallback);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const defaultTempRoot = path.join(rootDir, '.tmp', 'github-skill-publish');

const defaultRepoConfigs = [
  {
    repoUrl: 'https://github.com/ArchieIndian/openclaw-superpowers',
    sourceRepo: 'ArchieIndian/openclaw-superpowers',
    localDirName: 'openclaw-superpowers',
    skillRoots: ['skills/core', 'skills/openclaw-native', 'skills/community'],
    slugPrefix: 'openclaw-superpowers',
    nameOverride: null,
  },
  {
    repoUrl: 'https://github.com/JimLiu/baoyu-skills',
    sourceRepo: 'JimLiu/baoyu-skills',
    localDirName: 'baoyu-skills',
    skillRoots: ['skills'],
    slugPrefix: '',
    nameOverride: null,
  },
  {
    repoUrl: 'https://github.com/alchaincyf/nuwa-skill',
    sourceRepo: 'alchaincyf/nuwa-skill',
    localDirName: 'nuwa-skill',
    skillRoots: ['.'],
    slugPrefix: '',
    slugOverride: 'nuwa-skill',
    nameOverride: 'huashu-nuwa',
  },
];

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSlug(value) {
  return trimString(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_/]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeEnvName(raw) {
  const value = trimString(raw).toLowerCase();
  if (!value) return '';
  if (value === 'all' || value === 'both') return 'all';
  if (['dev', 'development', 'local'].includes(value)) return 'dev';
  if (['prod', 'production', 'release'].includes(value)) return 'prod';
  return '';
}

function escapePosixShellArg(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function parseRepoIdentity(repoUrl) {
  const parsed = new URL(repoUrl);
  if (parsed.hostname !== 'github.com') {
    throw new Error(`unsupported repo host: ${repoUrl}`);
  }
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`invalid GitHub repo URL: ${repoUrl}`);
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  return {
    owner,
    repo,
    sourceRepo: `${owner}/${repo}`,
  };
}

function parseArgs(argv) {
  const repoUrls = [];
  let envName = 'all';
  let tempRoot = defaultTempRoot;
  let remoteHost = process.env.ICLAW_CONTROL_PLANE_HOST || '115.191.6.179';
  let remoteUser = process.env.ICLAW_CONTROL_PLANE_USER || 'root';
  let remotePath = process.env.ICLAW_CONTROL_PLANE_PATH || '/opt/iclaw';
  let keepArtifacts = false;
  let skipVerify = false;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo-url') {
      repoUrls.push(trimString(argv[index + 1] || ''));
      index += 1;
      continue;
    }
    if (arg === '--env') {
      envName = trimString(argv[index + 1] || '') || envName;
      index += 1;
      continue;
    }
    if (arg === '--temp-root') {
      tempRoot = path.resolve(argv[index + 1] || tempRoot);
      index += 1;
      continue;
    }
    if (arg === '--prod-host') {
      remoteHost = trimString(argv[index + 1] || '') || remoteHost;
      index += 1;
      continue;
    }
    if (arg === '--prod-user') {
      remoteUser = trimString(argv[index + 1] || '') || remoteUser;
      index += 1;
      continue;
    }
    if (arg === '--prod-path') {
      remotePath = trimString(argv[index + 1] || '') || remotePath;
      index += 1;
      continue;
    }
    if (arg === '--keep-artifacts') {
      keepArtifacts = true;
      continue;
    }
    if (arg === '--skip-verify') {
      skipVerify = true;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
  }

  const normalizedEnv = normalizeEnvName(envName);
  if (!normalizedEnv) {
    throw new Error(`unsupported --env value: ${envName}`);
  }

  return {
    repoUrls: repoUrls.filter(Boolean),
    envName: normalizedEnv,
    tempRoot,
    remoteHost,
    remoteUser,
    remotePath,
    keepArtifacts,
    skipVerify,
    dryRun,
  };
}

async function pathExists(targetPath) {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, {recursive: true});
}

async function removeIfExists(targetPath) {
  if (await pathExists(targetPath)) {
    await fs.rm(targetPath, {recursive: true, force: true});
  }
}

async function runCommand(command, args, options = {}) {
  const {
    cwd = rootDir,
    env,
    input,
    allowFailure = false,
    stdoutMode = 'pipe',
    stderrMode = 'pipe',
  } = options;
  const result = spawnSync(command, args, {
    cwd,
    env: env ? {...process.env, ...env} : process.env,
    input,
    encoding: 'utf8',
    stdio: ['pipe', stdoutMode, stderrMode],
  });
  if (!allowFailure && result.status !== 0) {
    const stdout = trimString(result.stdout || '');
    const stderr = trimString(result.stderr || '');
    throw new Error(
      [
        `command failed: ${command} ${args.join(' ')}`,
        stdout ? `stdout:\n${stdout}` : '',
        stderr ? `stderr:\n${stderr}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    );
  }
  return {
    status: result.status ?? 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

async function ensureCommandAvailable(command) {
  const resolver = process.platform === 'win32' ? 'where' : 'which';
  try {
    await execFile(resolver, [command]);
  } catch {
    throw new Error(`required command not found: ${command}`);
  }
}

async function cloneRepo(config, reposRoot) {
  const localDir = path.join(reposRoot, config.localDirName);
  await removeIfExists(localDir);
  await runCommand('git', ['clone', '--depth', '1', config.repoUrl, localDir]);
  return localDir;
}

async function walkSkillDirs(root) {
  const entries = await fs.readdir(root, {withFileTypes: true});
  if (entries.some((entry) => entry.isFile() && entry.name === 'SKILL.md')) {
    return [root];
  }
  const items = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '__pycache__') continue;
    items.push(...(await walkSkillDirs(path.join(root, entry.name))));
  }
  return items;
}

function parseFrontmatter(raw) {
  const normalized = raw.replace(/^\uFEFF/, '');
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return {};

  const lines = match[1].split(/\r?\n/);
  const values = {};
  let blockKey = null;
  let blockMode = null;
  const blockLines = [];

  const flush = () => {
    if (!blockKey) return;
    values[blockKey] =
      blockMode === '>'
        ? blockLines.map((line) => line.trim()).filter(Boolean).join(' ')
        : blockLines.join('\n').trim();
    blockKey = null;
    blockMode = null;
    blockLines.length = 0;
  };

  for (const rawLine of lines) {
    if (blockKey) {
      if (/^[ \t]/.test(rawLine) || !rawLine.trim()) {
        blockLines.push(rawLine.replace(/^[ \t]+/, ''));
        continue;
      }
      flush();
    }
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key) continue;
    if (value === '|' || value === '>') {
      blockKey = key;
      blockMode = value;
      continue;
    }
    values[key] = value.replace(/^['"]|['"]$/g, '');
  }
  flush();
  return values;
}

function normalizeDescription(value) {
  return trimString(value).replace(/\s+/g, ' ').slice(0, 220);
}

function deriveDescription(raw) {
  const normalized = raw.replace(/^\uFEFF/, '');
  const frontmatter = parseFrontmatter(normalized);
  const frontmatterDescription = normalizeDescription(frontmatter.description || '');
  if (frontmatterDescription) {
    return frontmatterDescription;
  }

  let body = normalized.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  body = body.replace(/```[\s\S]*?```/g, ' ');
  const lines = body.split(/\r?\n/).map((line) => line.trim());
  const parts = [];
  for (const line of lines) {
    if (!line) {
      if (parts.length > 0) break;
      continue;
    }
    if (/^(#|>|`|- |\* |\d+\. |\||!\[)/.test(line)) continue;
    parts.push(line.replace(/[*_`>#]/g, '').trim());
    if (parts.join(' ').length > 160) break;
  }
  return normalizeDescription(parts.join(' ') || 'Imported GitHub skill package.');
}

function sanitizeRepoName(sourceRepo) {
  return normalizeSlug(sourceRepo.replace('/', '-'));
}

function inferRepoConfig(repoUrl) {
  const identity = parseRepoIdentity(repoUrl);
  const defaultConfig = defaultRepoConfigs.find((item) => item.sourceRepo === identity.sourceRepo);
  if (defaultConfig) {
    return defaultConfig;
  }
  return {
    repoUrl,
    sourceRepo: identity.sourceRepo,
    localDirName: identity.repo,
    skillRoots: ['skills'],
    slugPrefix: '',
    nameOverride: null,
  };
}

async function buildManifest(repoConfigs, reposRoot, artifactsRoot) {
  const items = [];
  for (const config of repoConfigs) {
    const repoRoot = await cloneRepo(config, reposRoot);
    for (const skillRoot of config.skillRoots) {
      const absoluteSkillRoot = skillRoot === '.'
        ? repoRoot
        : path.join(repoRoot, skillRoot);
      if (!(await pathExists(absoluteSkillRoot))) {
        continue;
      }
      const skillDirs = await walkSkillDirs(absoluteSkillRoot);
      for (const skillDir of skillDirs) {
        const raw = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf8');
        const frontmatter = parseFrontmatter(raw);
        const baseName = path.basename(skillDir);
        const slug =
          config.slugOverride ||
          normalizeSlug(config.slugPrefix ? `${config.slugPrefix}-${baseName}` : baseName);
        const name = trimString(config.nameOverride || frontmatter.name || baseName);
        const description = deriveDescription(raw);
        const relativeSkillPath = path.relative(repoRoot, skillDir).split(path.sep).join('/');
        const archiveName = `${sanitizeRepoName(config.sourceRepo)}-${slug}.tar.gz`;
        const artifactPath = path.join(artifactsRoot, archiveName);
        await removeIfExists(artifactPath);
        await runCommand('tar', ['-czf', artifactPath, '-C', skillDir, '.']);
        items.push({
          slug,
          name,
          description,
          artifactPath,
          artifactFileName: archiveName,
          sourceRepo: config.sourceRepo,
          sourceUrl:
            config.slugOverride && relativeSkillPath === '.'
              ? config.repoUrl
              : `${config.repoUrl}/tree/main/${relativeSkillPath}`,
        });
      }
    }
  }

  items.sort((left, right) => left.slug.localeCompare(right.slug));
  return items;
}

async function writeManifest(manifestPath, manifest) {
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function parseJsonObjectFromOutput(stdout, stderr) {
  const combined = `${stdout || ''}\n${stderr || ''}`;
  const match = combined.match(/\{[\s\S]*\}/m);
  if (!match) {
    return null;
  }
  return JSON.parse(match[0]);
}

async function publishLocally(envName, manifest, dryRun) {
  const published = [];
  for (const item of manifest) {
    const commandArgs = [
      'scripts/run-with-env.mjs',
      envName,
      'node',
      '--experimental-strip-types',
      'services/control-plane/scripts/publish-github-cloud-skill.ts',
      '--artifact-path',
      item.artifactPath,
      '--source-url',
      item.sourceUrl,
      '--source-repo',
      item.sourceRepo,
      '--slug',
      item.slug,
      '--name',
      item.name,
      '--description',
      item.description,
      '--platform-bundle',
    ];
    if (dryRun) {
      published.push({slug: item.slug, objectKey: null, dryRun: true});
      continue;
    }
    const result = await runCommand(process.execPath, commandArgs);
    const parsed = parseJsonObjectFromOutput(result.stdout, result.stderr);
    published.push({
      slug: item.slug,
      objectKey: parsed?.objectKey || null,
      artifactSha256: parsed?.artifactSha256 || null,
    });
    console.log(`[publish:${envName}] ${item.slug}`);
  }
  return published;
}

function buildRemotePublishProgram(manifest) {
  const normalizedManifest = manifest.map((item) => ({
    slug: item.slug,
    name: item.name,
    description: item.description,
    artifactFileName: item.artifactFileName,
    sourceRepo: item.sourceRepo,
    sourceUrl: item.sourceUrl,
  }));
  return `
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const manifest = ${JSON.stringify(normalizedManifest, null, 2)};
const results = [];
for (const item of manifest) {
  const artifactPath = path.join('.tmp', 'github-skill-publish', 'artifacts', item.artifactFileName);
  const args = [
    '--experimental-strip-types',
    'services/control-plane/scripts/publish-github-cloud-skill.ts',
    '--artifact-path',
    artifactPath,
    '--source-url',
    item.sourceUrl,
    '--source-repo',
    item.sourceRepo,
    '--slug',
    item.slug,
    '--name',
    item.name,
    '--description',
    item.description,
    '--platform-bundle',
  ];
  const run = spawnSync(process.execPath, args, {stdio: 'pipe', encoding: 'utf8', env: process.env});
  if (run.status !== 0) {
    console.error(JSON.stringify({
      failed: item.slug,
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
    }, null, 2));
    process.exit(run.status || 1);
  }
  console.log('[publish:prod] ' + item.slug);
  results.push(item.slug);
}
console.log(JSON.stringify({ok: true, count: results.length}, null, 2));
`;
}

async function publishProdRemote(manifest, options) {
  const remoteBasePath = `${options.remotePath}/.tmp/github-skill-publish`;
  await runCommand('ssh', [`${options.remoteUser}@${options.remoteHost}`, `mkdir -p ${escapePosixShellArg(`${remoteBasePath}/artifacts`)}`]);

  for (const item of manifest) {
    await runCommand('scp', [item.artifactPath, `${options.remoteUser}@${options.remoteHost}:${remoteBasePath}/artifacts/${item.artifactFileName}`], {
      stdoutMode: 'inherit',
      stderrMode: 'inherit',
    });
  }

  const remoteScript = buildRemotePublishProgram(manifest);
  if (options.dryRun) {
    return manifest.map((item) => ({slug: item.slug, objectKey: null, dryRun: true}));
  }

  const remoteCommand = `cd ${escapePosixShellArg(options.remotePath)} && bash scripts/with-env.sh prod node --input-type=module -`;
  const result = await runCommand('ssh', [`${options.remoteUser}@${options.remoteHost}`, remoteCommand], {
    input: remoteScript,
    stdoutMode: 'inherit',
    stderrMode: 'inherit',
  });
  return {
    ok: result.status === 0,
    total: manifest.length,
  };
}

async function verifyLocally(envName, manifest, dryRun) {
  if (dryRun) {
    return {ok: true, total: manifest.length, dryRun: true};
  }
  const verificationScript = `
import {PgControlPlaneStore} from './services/control-plane/src/pg-store.ts';
import {PgPortalStore} from './services/control-plane/src/portal-store.ts';

const manifest = ${JSON.stringify(manifest.map((item) => item.slug), null, 2)};
const controlStore = new PgControlPlaneStore(process.env.DATABASE_URL || '');
const portalStore = new PgPortalStore(process.env.DATABASE_URL || '');
const missingCatalog = [];
try {
  for (const slug of manifest) {
    const entry = await controlStore.getSkillCatalogEntry(slug);
    const objectKey = entry?.metadata?.portal_artifact_object_key || null;
    if (!entry || entry.originType !== 'github_repo' || !objectKey) {
      missingCatalog.push({slug, exists: Boolean(entry), originType: entry?.originType || null, objectKey});
    }
  }
  const platformRows = await portalStore.listSkills();
  const platformSet = new Set(platformRows.map((item) => item.slug));
  const missingPlatform = manifest.filter((slug) => !platformSet.has(slug));
  console.log(JSON.stringify({
    ok: missingCatalog.length === 0 && missingPlatform.length === 0,
    total: manifest.length,
    missingCatalog,
    missingPlatform,
  }, null, 2));
} finally {
  await controlStore.close();
  await portalStore.close();
}
`;
  const result = await runCommand(
    process.execPath,
    ['scripts/run-with-env.mjs', envName, 'node', '--input-type=module', '-'],
    {input: verificationScript},
  );
  const parsed = parseJsonObjectFromOutput(result.stdout, result.stderr);
  if (!parsed?.ok) {
    throw new Error(`verification failed for ${envName}: ${JSON.stringify(parsed, null, 2)}`);
  }
  return parsed;
}

async function verifyProdRemote(manifest, options) {
  if (options.dryRun) {
    return {ok: true, total: manifest.length, dryRun: true};
  }
  const verificationScript = `
import {PgControlPlaneStore} from './services/control-plane/src/pg-store.ts';
import {PgPortalStore} from './services/control-plane/src/portal-store.ts';

const manifest = ${JSON.stringify(manifest.map((item) => item.slug), null, 2)};
const controlStore = new PgControlPlaneStore(process.env.DATABASE_URL || '');
const portalStore = new PgPortalStore(process.env.DATABASE_URL || '');
const missingCatalog = [];
try {
  for (const slug of manifest) {
    const entry = await controlStore.getSkillCatalogEntry(slug);
    const objectKey = entry?.metadata?.portal_artifact_object_key || null;
    if (!entry || entry.originType !== 'github_repo' || !objectKey) {
      missingCatalog.push({slug, exists: Boolean(entry), originType: entry?.originType || null, objectKey});
    }
  }
  const platformRows = await portalStore.listSkills();
  const platformSet = new Set(platformRows.map((item) => item.slug));
  const missingPlatform = manifest.filter((slug) => !platformSet.has(slug));
  console.log(JSON.stringify({
    ok: missingCatalog.length === 0 && missingPlatform.length === 0,
    total: manifest.length,
    missingCatalog,
    missingPlatform,
  }, null, 2));
} finally {
  await controlStore.close();
  await portalStore.close();
}
`;
  const remoteCommand = `cd ${escapePosixShellArg(options.remotePath)} && bash scripts/with-env.sh prod node --input-type=module -`;
  const result = await runCommand('ssh', [`${options.remoteUser}@${options.remoteHost}`, remoteCommand], {
    input: verificationScript,
  });
  const parsed = parseJsonObjectFromOutput(result.stdout, result.stderr);
  if (!parsed?.ok) {
    throw new Error(`verification failed for prod: ${JSON.stringify(parsed, null, 2)}`);
  }
  return parsed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureCommandAvailable('git');
  await ensureCommandAvailable('tar');
  if (options.envName === 'prod' || options.envName === 'all') {
    await ensureCommandAvailable('ssh');
    await ensureCommandAvailable('scp');
  }

  const repoConfigs = (options.repoUrls.length > 0 ? options.repoUrls : defaultRepoConfigs.map((item) => item.repoUrl))
    .map((repoUrl) => inferRepoConfig(repoUrl));

  const reposRoot = path.join(options.tempRoot, 'repos');
  const artifactsRoot = path.join(options.tempRoot, 'artifacts');
  const manifestPath = path.join(options.tempRoot, 'manifest.json');

  await ensureDir(reposRoot);
  await ensureDir(artifactsRoot);

  let shouldCleanTemp = !options.keepArtifacts;
  const summary = {
    env: options.envName,
    repos: repoConfigs.map((item) => item.repoUrl),
    tempRoot: options.tempRoot,
    totalSkills: 0,
    published: {},
    verified: {},
    dryRun: options.dryRun,
  };

  try {
    const manifest = await buildManifest(repoConfigs, reposRoot, artifactsRoot);
    if (manifest.length === 0) {
      throw new Error('no skills found in the selected GitHub repositories');
    }
    await writeManifest(manifestPath, manifest);
    summary.totalSkills = manifest.length;

    if (options.envName === 'dev' || options.envName === 'all') {
      summary.published.dev = await publishLocally('dev', manifest, options.dryRun);
      if (!options.skipVerify) {
        summary.verified.dev = await verifyLocally('dev', manifest, options.dryRun);
      }
    }

    if (options.envName === 'prod' || options.envName === 'all') {
      summary.published.prod = await publishProdRemote(manifest, options);
      if (!options.skipVerify) {
        summary.verified.prod = await verifyProdRemote(manifest, options);
      }
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (shouldCleanTemp) {
      await removeIfExists(options.tempRoot);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
