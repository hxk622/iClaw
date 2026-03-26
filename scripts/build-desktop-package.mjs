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
const brandStateScriptPath = path.join(rootDir, 'scripts', 'brand-generated-state.mjs');
const syncResourcesScriptPath = path.join(rootDir, 'scripts', 'sync-openclaw-resources.mjs');
const packageDmgScriptPath = path.join(rootDir, 'scripts', 'package-desktop-dmg.sh');
const runtimeBootstrapConfigPath = path.join(tauriDir, 'resources', 'config', 'openclaw-runtime.json');
const bundledRuntimeDir = path.join(tauriDir, 'resources', 'openclaw-runtime');

function parseArgs(argv) {
  const forwardedArgs = [];
  let brandId =
    process.env.APP_NAME || process.env.ICLAW_PORTAL_APP_NAME || process.env.ICLAW_BRAND || process.env.ICLAW_APP_NAME || '';
  let target = '';

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
    if (arg === '--target') {
      target = argv[index + 1] ?? '';
      forwardedArgs.push(arg);
      if (argv[index + 1]) {
        forwardedArgs.push(argv[index + 1]);
      }
      index += 1;
      continue;
    }
    if (arg.startsWith('--target=')) {
      target = arg.slice('--target='.length);
      forwardedArgs.push(arg);
      continue;
    }
    forwardedArgs.push(arg);
  }

  return {
    brandId: resolveBrandId(brandId),
    target,
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

function normalizeChannel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['dev', 'development', 'local'].includes(normalized)) {
    return 'dev';
  }
  if (['prod', 'production', 'release'].includes(normalized)) {
    return 'prod';
  }
  return '';
}

function isTruthyEnv(value) {
  return /^(1|true|yes)$/i.test(String(value || '').trim());
}

async function readGeneratedProductName() {
  const config = JSON.parse(await fs.readFile(generatedConfigPath, 'utf8'));
  const productName = typeof config.productName === 'string' ? config.productName.trim() : '';
  if (!productName) {
    throw new Error(`desktop packaging aborted: missing productName in ${generatedConfigPath}`);
  }
  return productName;
}

function bundleTargetRoot(target) {
  const root = path.join(tauriDir, 'target');
  if (target && target.trim()) {
    return path.join(root, target.trim(), 'release', 'bundle');
  }
  return path.join(root, 'release', 'bundle');
}

async function validateMacosProdBundle({ target, channel }) {
  if (process.platform !== 'darwin' || channel !== 'prod') {
    return;
  }

  const productName = await readGeneratedProductName();
  const appBundlePath = path.join(bundleTargetRoot(target), 'macos', `${productName}.app`);
  const allowUnsignedProd = isTruthyEnv(process.env.ICLAW_ALLOW_UNSIGNED_MACOS_PROD);

  const codesign = spawnSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appBundlePath], {
    cwd: rootDir,
    encoding: 'utf8',
  });
  const spctl = spawnSync('spctl', ['--assess', '--type', 'execute', '--verbose=4', appBundlePath], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  const codesignOk = codesign.status === 0;
  const spctlOk = spctl.status === 0;
  if (codesignOk && spctlOk) {
    process.stdout.write(`[release-check] macOS prod bundle passed signing validation: ${appBundlePath}\n`);
    return;
  }

  const details = [
    `App bundle: ${appBundlePath}`,
    `codesign: ${codesign.stderr?.trim() || codesign.stdout?.trim() || `exit ${codesign.status ?? 'unknown'}`}`,
    `spctl: ${spctl.stderr?.trim() || spctl.stdout?.trim() || `exit ${spctl.status ?? 'unknown'}`}`,
  ].join('\n');

  if (allowUnsignedProd) {
    process.stderr.write(
      [
        '[release-check] WARNING: macOS prod signing validation failed, but ICLAW_ALLOW_UNSIGNED_MACOS_PROD=1 is set.',
        '[release-check] This build is for internal testing only and must not be uploaded to the public download page.',
        details,
      ].join('\n') + '\n',
    );
    return;
  }

  throw new Error(
    [
      'desktop packaging aborted: macOS prod bundle failed signing validation.',
      'Refusing to produce a public prod package without a Gatekeeper-safe app bundle.',
      'Provide Apple signing/notarization credentials, or set ICLAW_ALLOW_UNSIGNED_MACOS_PROD=1 for internal testing only.',
      details,
    ].join('\n'),
  );
}

function syncLocalAppRuntime({ pnpm, env, brandId, channel }) {
  const allowFallback = isTruthyEnv(env.ICLAW_ALLOW_RUNTIME_SYNC_FALLBACK);
  const args = [...pnpm.args, '--filter', '@iclaw/control-plane', 'sync:local-app-runtime', '--', '--app', brandId];
  const result = spawnSync(pnpm.command, args, {
    stdio: 'pipe',
    cwd: rootDir,
    env,
    shell: pnpm.shell ?? false,
    encoding: 'utf8',
  });

  if (result.status === 0) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    return;
  }

  const details = (result.stderr || result.stdout || '').trim() || `exit ${result.status ?? 'unknown'}`;
  if (allowFallback) {
    process.stderr.write(
      [
        `[runtime-sync] WARNING: failed to sync local app runtime for ${brandId}.`,
        '[runtime-sync] Falling back to the current repository resources / cached local snapshot for internal testing only.',
        `[runtime-sync] channel=${channel || 'unknown'}`,
        details,
      ].join('\n') + '\n',
    );
    return;
  }

  throw new Error(
    [
      `desktop packaging aborted: failed to sync local app runtime for ${brandId}.`,
      'Start the local PostgreSQL-backed control-plane data source, or set ICLAW_ALLOW_RUNTIME_SYNC_FALLBACK=1 for internal testing only.',
      details,
    ].join('\n'),
  );
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
  const { brandId, target, forwardedArgs } = parseArgs(process.argv.slice(2));
  const snapshotKey = 'desktop-package-build';
  const env = {
    ...process.env,
    ICLAW_PORTAL_APP_NAME: brandId,
    ICLAW_BRAND: brandId,
  };
  const channel = normalizeChannel(env.ICLAW_ENV_NAME || env.NODE_ENV);
  const { tauriBundle, packageDmg } = platformBundleTarget();
  const pnpm = pnpmCommand();

  run(process.execPath, [brandStateScriptPath, 'snapshot', snapshotKey], {env});
  try {
    run(process.execPath, [applyBrandScriptPath, brandId], { env });
    syncLocalAppRuntime({ pnpm, env, brandId, channel });
    run(process.execPath, [syncResourcesScriptPath], { env });
    await assertPackagedRuntimeConfig();
    await writeTempTauriConfig();

    run(pnpm.command, [...pnpm.args, '--dir', desktopDir, 'build'], { env, shell: pnpm.shell });
    const tauri = tauriBinaryPath();
    run(tauri.command, ['build', '--config', tempConfigPath, '--bundles', tauriBundle, ...forwardedArgs], {
      cwd: desktopDir,
      env,
      shell: tauri.shell,
    });
    await validateMacosProdBundle({ target, channel });

    if (packageDmg) {
      run('bash', [packageDmgScriptPath, ...forwardedArgs], { env });
    }
  } finally {
    await fs.rm(tempConfigPath, { force: true });
    run(process.execPath, [brandStateScriptPath, 'restore', snapshotKey], {env});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
