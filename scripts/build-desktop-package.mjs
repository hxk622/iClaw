#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveBrandId } from './lib/brand-profile.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const desktopDir = path.join(rootDir, 'apps', 'desktop');
const tauriDir = path.join(desktopDir, 'src-tauri');
const generatedConfigPath = path.join(tauriDir, 'tauri.generated.conf.json');
const tempConfigPath = path.join(tauriDir, 'tauri.build.local.json');
const applyBrandScriptPath = path.join(rootDir, 'scripts', 'apply-brand.mjs');
const syncResourcesScriptPath = path.join(rootDir, 'scripts', 'sync-openclaw-resources.mjs');
const packageDmgScriptPath = path.join(rootDir, 'scripts', 'package-desktop-dmg.sh');
const runtimeBootstrapConfigPath = path.join(tauriDir, 'resources', 'config', 'openclaw-runtime.json');
const bundledRuntimeDir = path.join(tauriDir, 'resources', 'openclaw-runtime');

function parseArgs(argv) {
  const forwardedArgs = [];
  let brandId = process.env.ICLAW_BRAND || '';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--brand') {
      brandId = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (arg.startsWith('--brand=')) {
      brandId = arg.slice('--brand='.length);
      continue;
    }
    forwardedArgs.push(arg);
  }

  return {
    brandId: resolveBrandId(brandId),
    forwardedArgs,
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: options.cwd ?? rootDir,
    env: options.env ?? process.env,
    shell: options.shell ?? false,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function pnpmCommand() {
  const nodeBinDir = path.dirname(process.execPath);
  const bundledCorepack = path.join(nodeBinDir, process.platform === 'win32' ? 'corepack.cmd' : 'corepack');
  if (process.platform === 'win32') {
    return {
      command: bundledCorepack,
      args: ['pnpm'],
      shell: true,
    };
  }
  return {
    command: bundledCorepack,
    args: ['pnpm'],
  };
}

function tauriBinaryPath() {
  if (process.platform === 'win32') {
    return {
      command: path.join(desktopDir, 'node_modules', '.bin', 'tauri.CMD'),
      shell: true,
    };
  }
  return {
    command: path.join(desktopDir, 'node_modules', '.bin', 'tauri'),
    shell: false,
  };
}

function platformBundleTarget() {
  if (process.platform === 'darwin') {
    return { tauriBundle: 'app', packageDmg: true };
  }
  if (process.platform === 'win32') {
    return { tauriBundle: 'nsis', packageDmg: false };
  }
  throw new Error(`Unsupported desktop packaging platform: ${process.platform}`);
}

async function writeTempTauriConfig() {
  const config = JSON.parse(await fs.readFile(generatedConfigPath, 'utf8'));
  config.build = config.build || {};
  config.build.beforeBuildCommand = '';
  await fs.writeFile(tempConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function runtimeLayoutLooksComplete(runtimeDir) {
  const requiredPaths = [
    path.join(runtimeDir, process.platform === 'win32' ? 'openclaw-runtime.cmd' : 'openclaw-runtime'),
    path.join(runtimeDir, 'openclaw', 'openclaw.mjs'),
    path.join(runtimeDir, 'openclaw', 'package.json'),
  ];
  const checks = await Promise.all(requiredPaths.map((targetPath) => pathExists(targetPath)));
  return checks.every(Boolean);
}

async function assertPackagedRuntimeConfig() {
  if (await runtimeLayoutLooksComplete(bundledRuntimeDir)) {
    return;
  }

  if (!(await pathExists(runtimeBootstrapConfigPath))) {
    throw new Error(
      [
        'desktop packaging aborted: missing OpenClaw runtime bootstrap config.',
        `Expected: ${runtimeBootstrapConfigPath}`,
        'Run `pnpm build:openclaw-runtime` or provide a bundled runtime under src-tauri/resources/openclaw-runtime before packaging.',
      ].join('\n'),
    );
  }

  const raw = JSON.parse(await fs.readFile(runtimeBootstrapConfigPath, 'utf8'));
  const version = typeof raw.version === 'string' ? raw.version.trim() : '';
  const artifactUrl = typeof raw.artifact_url === 'string' ? raw.artifact_url.trim() : '';
  const artifactFormat = typeof raw.artifact_format === 'string' ? raw.artifact_format.trim() : '';

  if (!version || !artifactUrl) {
    throw new Error(
      [
        'desktop packaging aborted: invalid OpenClaw runtime bootstrap config.',
        `Expected non-empty version and artifact_url in ${runtimeBootstrapConfigPath}`,
      ].join('\n'),
    );
  }

  if (artifactFormat && !['tar.gz', 'tgz', 'zip'].includes(artifactFormat)) {
    throw new Error(
      [
        'desktop packaging aborted: unsupported OpenClaw runtime artifact_format.',
        `Found "${artifactFormat}" in ${runtimeBootstrapConfigPath}`,
      ].join('\n'),
    );
  }
}

async function main() {
  const { brandId, forwardedArgs } = parseArgs(process.argv.slice(2));
  const env = {
    ...process.env,
    ICLAW_BRAND: brandId,
  };
  const { tauriBundle, packageDmg } = platformBundleTarget();
  const pnpm = pnpmCommand();

  run(process.execPath, [applyBrandScriptPath, brandId], { env });
  run(process.execPath, [syncResourcesScriptPath], { env });
  await assertPackagedRuntimeConfig();
  await writeTempTauriConfig();

  try {
    run(pnpm.command, [...pnpm.args, '--dir', desktopDir, 'build'], { env, shell: pnpm.shell });
    const tauri = tauriBinaryPath();
    run(tauri.command, ['build', '--config', tempConfigPath, '--bundles', tauriBundle, ...forwardedArgs], {
      cwd: desktopDir,
      env,
      shell: tauri.shell,
    });

    if (packageDmg) {
      run('bash', [packageDmgScriptPath, ...forwardedArgs], { env });
    }
  } finally {
    await fs.rm(tempConfigPath, { force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
