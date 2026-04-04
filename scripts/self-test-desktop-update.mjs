#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBrandProfile } from './lib/brand-profile.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function runStep(step, env = process.env) {
  if (typeof step.run === 'function') {
    process.stdout.write(`\n[self-test] ${step.label}\n`);
    await step.run();
    return;
  }
  process.stdout.write(`\n[self-test] ${step.label}\n`);
  const result = spawnSync(step.command, step.args, {
    cwd: rootDir,
    stdio: 'inherit',
    env,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveHostReleaseArch() {
  if (process.arch === 'arm64') {
    return 'aarch64';
  }
  if (process.arch === 'x64') {
    return 'x64';
  }
  throw new Error(`Unsupported host arch for desktop self-test: ${process.arch}`);
}

async function copyLatestMatchingArtifact(sourceDir, targetDir, pattern) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true }).catch(() => []);
  const matches = [];
  for (const entry of entries) {
    if (!entry.isFile() || !pattern.test(entry.name)) {
      continue;
    }
    const fullPath = path.join(sourceDir, entry.name);
    const stat = await fs.stat(fullPath);
    matches.push({
      name: entry.name,
      fullPath,
      mtimeMs: stat.mtimeMs,
    });
  }
  matches.sort((left, right) => right.mtimeMs - left.mtimeMs);
  const latest = matches[0];
  if (!latest) {
    throw new Error(`No artifact matched ${pattern} under ${sourceDir}`);
  }
  await fs.mkdir(targetDir, { recursive: true });
  await fs.copyFile(latest.fullPath, path.join(targetDir, latest.name));
  process.stdout.write(`[self-test] staged ${latest.name} -> ${targetDir}\n`);
}

async function stageFreshDevReleaseArtifacts() {
  const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'));
  const appVersion = String(packageJson.version || '').trim();
  const baseVersion = appVersion.split('+', 1)[0] || appVersion;
  const arch = resolveHostReleaseArch();
  const { profile } = await loadBrandProfile({ rootDir, brandId: 'iclaw', envName: 'dev' });
  const artifactBaseName = String(profile?.distribution?.artifactBaseName || profile?.productName || 'iClaw').trim();
  const bundleRoot = path.join(rootDir, 'apps', 'desktop', 'src-tauri', 'target', 'release', 'bundle');
  const releaseDir = path.join(rootDir, 'dist', 'releases');
  const versionPrefix = `${escapeRegExp(artifactBaseName)}_${escapeRegExp(baseVersion)}(?:\\.\\d+)?_${escapeRegExp(arch)}_dev`;

  await copyLatestMatchingArtifact(
    path.join(bundleRoot, 'dmg'),
    releaseDir,
    new RegExp(`^${versionPrefix}\\.dmg$`),
  );
  await copyLatestMatchingArtifact(
    path.join(bundleRoot, 'macos'),
    releaseDir,
    new RegExp(`^${versionPrefix}\\.app\\.tar\\.gz$`),
  );
  await copyLatestMatchingArtifact(
    path.join(bundleRoot, 'macos'),
    releaseDir,
    new RegExp(`^${versionPrefix}\\.app\\.tar\\.gz\\.sig$`),
  );
}

async function resolveUpdaterEnv() {
  const existingPrivateKey = String(process.env.TAURI_SIGNING_PRIVATE_KEY || '').trim();
  const existingPublicKey = String(process.env.TAURI_UPDATER_PUBLIC_KEY || '').trim();
  if (existingPrivateKey && existingPublicKey) {
    process.stdout.write('[self-test] using configured updater signing keys\n');
    return { ...process.env };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'iclaw-updater-self-test-'));
  const privateKeyPath = path.join(tempDir, 'updater.key');
  const generate = spawnSync('pnpm', ['--filter', '@iclaw/desktop', 'exec', 'tauri', 'signer', 'generate', '--ci', '-w', privateKeyPath], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });
  if (generate.error) {
    throw generate.error;
  }
  if (generate.status !== 0) {
    process.exit(generate.status ?? 1);
  }

  process.stdout.write('[self-test] generated ephemeral updater signing keys for local validation\n');
  return {
    ...process.env,
    TAURI_SIGNING_PRIVATE_KEY: (await fs.readFile(privateKeyPath, 'utf8')).trim(),
    TAURI_UPDATER_PUBLIC_KEY: (await fs.readFile(`${privateKeyPath}.pub`, 'utf8')).trim(),
  };
}

const updaterEnv = await resolveUpdaterEnv();

const steps = [
  {
    label: 'control-plane desktop update tests',
    command: 'pnpm',
    args: ['--filter', '@iclaw/control-plane', 'test'],
    env: process.env,
  },
  {
    label: 'desktop desktop-update tests',
    command: 'pnpm',
    args: ['--filter', '@iclaw/desktop', 'test'],
    env: process.env,
  },
  {
    label: 'desktop dev tauri package build',
    command: 'node',
    args: ['scripts/run-with-env.mjs', 'dev', 'node', 'scripts/build-desktop-package.mjs'],
    env: {
      ...updaterEnv,
      ICLAW_SKIP_REMOTE_RUNTIME_HASH_VERIFY: '1',
    },
  },
  {
    label: 'stage fresh dev release artifacts',
    run: stageFreshDevReleaseArtifacts,
  },
  {
    label: 'refresh dev desktop release manifests',
    command: 'node',
    args: ['scripts/run-with-env.mjs', 'dev', 'node', 'scripts/generate-desktop-release-manifests.mjs', '--channel', 'dev'],
    env: updaterEnv,
  },
  {
    label: 'desktop update environment doctor',
    command: 'node',
    args: ['scripts/run-with-env.mjs', 'dev', 'node', 'scripts/doctor-desktop-update.mjs', '--channel', 'dev'],
    env: updaterEnv,
  },
];

for (const step of steps) {
  await runStep(step, step.env);
}

process.stdout.write('\n[self-test] desktop update checks passed\n');
