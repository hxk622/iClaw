#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveBrandId } from './lib/brand-profile.mjs';
import { resolveConfiguredAppName, resolvePackagingSourceEnv, resolveSigningOverlayEnv } from './lib/app-env.mjs';
import { resolveOemSigningProfile } from './lib/oem-signing.mjs';

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
const bundledSkillsDir = path.join(tauriDir, 'resources', 'bundled-skills');
const nsisAutoRunDefinition = '!define MUI_FINISHPAGE_RUN\n!define MUI_FINISHPAGE_RUN_FUNCTION RunMainBinary\n';

function parseArgs(argv) {
  const forwardedArgs = [];
  let brandId = resolveConfiguredAppName(rootDir);
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

function buildChannelSigningEnv(signingEnv, channel) {
  const env = { ...signingEnv };
  const shouldNotarize =
    channel === 'prod' ||
    isTruthyEnv(process.env.ICLAW_MACOS_NOTARIZE_DEV) ||
    isTruthyEnv(process.env.ICLAW_MACOS_NOTARIZE_TEST);

  if (process.platform === 'darwin' && !shouldNotarize) {
    delete env.APPLE_ID;
    delete env.APPLE_PASSWORD;
    delete env.APPLE_TEAM_ID;
  }

  return env;
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

function findMakensisPath() {
  const candidates = process.platform === 'win32'
    ? [
        'makensis.exe',
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'NSIS', 'makensis.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'NSIS', 'Bin', 'makensis.exe'),
      ]
    : ['makensis'];

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['/VERSION'], {
      cwd: rootDir,
      stdio: 'ignore',
      shell: false,
    });
    if (result.status === 0) {
      return candidate;
    }
  }

  throw new Error('desktop packaging aborted: NSIS compiler not found (makensis)');
}

async function patchWindowsNsisScript(installerScriptPath) {
  const raw = await fs.readFile(installerScriptPath);
  const source = raw.toString('latin1');
  if (!source.includes(nsisAutoRunDefinition)) {
    return false;
  }

  const patched = source.replace(nsisAutoRunDefinition, '');
  await fs.writeFile(installerScriptPath, Buffer.from(patched, 'latin1'));
  return true;
}

async function copyLatestNsisOutput({ target }) {
  const installerDir = path.join(bundleTargetRoot(target), 'nsis');
  const entries = await fs.readdir(installerDir, { withFileTypes: true });
  const installers = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.exe')) {
      continue;
    }
    const fullPath = path.join(installerDir, entry.name);
    const stat = await fs.stat(fullPath);
    installers.push({ fullPath, mtimeMs: stat.mtimeMs });
  }

  installers.sort((left, right) => right.mtimeMs - left.mtimeMs);
  const latestInstaller = installers[0];
  if (!latestInstaller) {
    throw new Error(`desktop packaging aborted: unable to locate bundled NSIS installer under ${installerDir}`);
  }

  const nsisOutputPath = path.join(
    tauriDir,
    'target',
    'release',
    'nsis',
    'x64',
    'nsis-output.exe',
  );
  await fs.copyFile(nsisOutputPath, latestInstaller.fullPath);
}

async function rebuildWindowsNsisInstaller({ target }) {
  if (process.platform !== 'win32') {
    return;
  }

  const installerScriptPath = path.join(tauriDir, 'target', 'release', 'nsis', 'x64', 'installer.nsi');
  if (!(await pathExists(installerScriptPath))) {
    return;
  }

  const changed = await patchWindowsNsisScript(installerScriptPath);
  if (!changed) {
    return;
  }

  const makensis = findMakensisPath();
  run(makensis, [installerScriptPath], { cwd: rootDir });
  await copyLatestNsisOutput({ target });
}

function syncLocalAppRuntime({ pnpm, env, brandId, channel }) {
  const args = [
    path.join(rootDir, 'scripts', 'with-packaging-source-env.mjs'),
    '--',
    pnpm.command,
    ...pnpm.args,
    '--filter',
    '@iclaw/control-plane',
    'sync:local-app-runtime',
    '--',
    '--app',
    brandId,
  ];
  const result = spawnSync(process.execPath, args, {
    stdio: 'pipe',
    cwd: rootDir,
    env,
    shell: false,
    encoding: 'utf8',
  });

  if (result.status === 0) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    return;
  }

  const details = (result.stderr || result.stdout || '').trim() || `exit ${result.status ?? 'unknown'}`;
  throw new Error(
    [
      `desktop packaging aborted: failed to sync local app runtime for ${brandId}.`,
      'No fallback is allowed. Fix the configured source PostgreSQL / MinIO environment and rerun the package build.',
      details,
    ].join('\n'),
  );
}

function syncBundledBaselineSkills({ pnpm, env, brandId }) {
  const args = [
    path.join(rootDir, 'scripts', 'with-packaging-source-env.mjs'),
    '--',
    pnpm.command,
    ...pnpm.args,
    '--filter',
    '@iclaw/control-plane',
    'sync:local-app-runtime',
    '--',
    '--app',
    brandId,
    '--skills-output-root',
    bundledSkillsDir,
    '--bundled-only',
    '--incremental',
  ];
  const syncEnv = {
    ...env,
    ICLAW_SKIP_RUNTIME_SKILL_SYNC: '0',
    ICLAW_BUNDLED_SKILLS_ONLY: '1',
    ICLAW_INCREMENTAL_SKILL_SYNC: '1',
    ICLAW_RUNTIME_SKILLS_OUTPUT_ROOT: bundledSkillsDir,
  };
  const result = spawnSync(process.execPath, args, {
    stdio: 'pipe',
    cwd: rootDir,
    env: syncEnv,
    shell: false,
    encoding: 'utf8',
  });

  if (result.status === 0) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    return;
  }

  const details = (result.stderr || result.stdout || '').trim() || `exit ${result.status ?? 'unknown'}`;
  throw new Error(
    [
      `desktop packaging aborted: failed to sync bundled baseline skills for ${brandId}.`,
      'Fix the configured source PostgreSQL / MinIO environment and rerun the package build.',
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
  const packagingOverlayEnv = resolveSigningOverlayEnv(rootDir);
  const packagingSourceEnv = resolvePackagingSourceEnv(rootDir);
  const signingProfile = await resolveOemSigningProfile({ rootDir, brandId });
  const channel = normalizeChannel(process.env.ICLAW_ENV_NAME || process.env.NODE_ENV);
  const channelSigningEnv = buildChannelSigningEnv(signingProfile.env, channel);
  const env = {
    ...process.env,
    ...packagingOverlayEnv,
    ...packagingSourceEnv,
    ...channelSigningEnv,
    APP_NAME: brandId,
    ICLAW_PORTAL_APP_NAME: brandId,
    ICLAW_BRAND: brandId,
    ICLAW_USE_PACKAGING_SOURCE_ENV: '1',
    ICLAW_SKIP_RUNTIME_SKILL_SYNC: '1',
  };
  const { tauriBundle, packageDmg } = platformBundleTarget();
  const pnpm = pnpmCommand();

  run(process.execPath, [brandStateScriptPath, 'snapshot', snapshotKey], {env});
  try {
    if (signingProfile.profileName) {
      process.stdout.write(
        `[desktop-package] Using signing profile "${signingProfile.profileName}" for brand ${brandId}` +
          `${signingProfile.filePath ? ` (${signingProfile.filePath})` : ''}\n`,
      );
      if (process.platform === 'darwin' && channel !== 'prod' && !env.APPLE_ID) {
        process.stdout.write(`[desktop-package] macOS ${channel || 'non-prod'} build: signing enabled, notarization skipped by default\n`);
      }
    } else {
      process.stdout.write(`[desktop-package] No OEM signing profile configured for brand ${brandId}; using ambient signing env\n`);
    }

    run(process.execPath, [applyBrandScriptPath, brandId], { env });
    syncLocalAppRuntime({ pnpm, env, brandId, channel });
    syncBundledBaselineSkills({ pnpm, env, brandId });
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
    await rebuildWindowsNsisInstaller({ target });
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
