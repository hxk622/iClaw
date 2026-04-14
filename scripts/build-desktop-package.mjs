#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDesktopBrandContext, readActiveDesktopBrandStage } from './lib/desktop-brand-context.mjs';
import { resolveBrandId } from './lib/brand-profile.mjs';
import { pathExists, syncDirOrRemove } from './lib/incremental-fs.mjs';
import { resolveConfiguredAppName, resolvePackagingSourceEnv, resolveSigningOverlayEnv } from './lib/app-env.mjs';
import {
  buildBundleRoot,
  buildPackagingWorkspacePaths,
  getArchLabelForTarget,
  listKnownRuntimeTargets,
  resolvePackagingChannelFromEnv,
  resolvePackagingTargetInfo,
  trimString,
} from './lib/desktop-packaging.mjs';
import { resolveOemSigningProfile } from './lib/oem-signing.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const desktopDir = path.join(rootDir, 'apps', 'desktop');
const tauriDir = path.join(desktopDir, 'src-tauri');
const applyBrandScriptPath = path.join(rootDir, 'scripts', 'apply-brand.mjs');
const brandStateScriptPath = path.join(rootDir, 'scripts', 'brand-generated-state.mjs');
const syncResourcesScriptPath = path.join(rootDir, 'scripts', 'sync-openclaw-resources.mjs');
const packageDmgScriptPath = path.join(rootDir, 'scripts', 'package-desktop-dmg.sh');
const runtimeBootstrapConfigPath = path.join(tauriDir, 'resources', 'config', 'openclaw-runtime.json');
const bundledRuntimeDir = path.join(tauriDir, 'resources', 'openclaw-runtime');
const bundledRuntimeArchiveDir = path.join(tauriDir, 'resources', 'runtime-archives');
const openclawResourcesSourceDir = path.join(rootDir, 'services', 'openclaw', 'resources');
const runtimeArtifactCacheDir = path.join(rootDir, '.artifacts', 'openclaw-runtime');
const runtimeInstallReceiptName = '.iclaw-runtime-install.json';
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

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env: options.env ?? process.env,
    shell: options.shell ?? false,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    throw result.error;
  }
  return result;
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

function splitAppVersion(version) {
  const normalized = trimString(version);
  const [baseVersion] = normalized.split('+', 1);
  return {
    fullVersion: normalized,
    baseVersion: trimString(baseVersion),
  };
}

function formatReleaseTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function resolveNormalizedReleaseVersion(version, explicitReleaseVersion = '') {
  const { baseVersion } = splitAppVersion(version);
  if (!baseVersion) {
    throw new Error('desktop packaging aborted: missing app base version for artifact naming');
  }

  const requested = trimString(explicitReleaseVersion).replace(/\+[^.]+/g, '');
  if (!requested) {
    return `${baseVersion}.${formatReleaseTimestamp()}`;
  }
  if (/^\d+\.\d+\.\d+$/.test(requested)) {
    return `${requested}.${formatReleaseTimestamp()}`;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(requested)) {
    return requested;
  }
  throw new Error(`desktop packaging aborted: unsupported release version format "${explicitReleaseVersion}"`);
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

function shouldUseManualMacosNotarization(channel, env) {
  if (process.platform !== 'darwin' || channel !== 'prod') {
    return false;
  }
  if (isTruthyEnv(process.env.ICLAW_USE_TAURI_INTERNAL_NOTARIZE)) {
    return false;
  }
  return Boolean(trimString(env.APPLE_ID) && trimString(env.APPLE_PASSWORD) && trimString(env.APPLE_TEAM_ID));
}

async function readGeneratedProductName(generatedConfigPath) {
  const config = JSON.parse(await fs.readFile(generatedConfigPath, 'utf8'));
  const productName = typeof config.productName === 'string' ? config.productName.trim() : '';
  if (!productName) {
    throw new Error(`desktop packaging aborted: missing productName in ${generatedConfigPath}`);
  }
  return productName;
}

async function assertGeneratedBrandArtifacts({ brandContext, appVersion, stagePaths }) {
  const generatedConfigPath = stagePaths.tauriGeneratedConfigPath;
  const generatedBrandPath = stagePaths.brandGeneratedJsonPath;
  const generatedConfig = JSON.parse(await fs.readFile(generatedConfigPath, 'utf8'));
  const generatedBrand = JSON.parse(await fs.readFile(generatedBrandPath, 'utf8'));
  const expectedProductName = trimString(brandContext?.productName);
  const expectedBundleIdentifier = trimString(brandContext?.bundleIdentifier);
  const expectedBrandId = trimString(brandContext?.brandId);
  const expectedArtifactBaseName = trimString(brandContext?.artifactBaseName);
  const expectedBuildId = trimString(brandContext?.buildId);
  const expectedSourceProfileHash = trimString(brandContext?.sourceProfileHash);
  const expectedVersion = trimString(appVersion);

  if (trimString(generatedConfig.productName) !== expectedProductName) {
    throw new Error(
      `desktop packaging aborted: stale productName in ${generatedConfigPath}; expected ${JSON.stringify(expectedProductName)}, got ${JSON.stringify(generatedConfig.productName)}`,
    );
  }
  if (trimString(generatedConfig.identifier) !== expectedBundleIdentifier) {
    throw new Error(
      `desktop packaging aborted: stale identifier in ${generatedConfigPath}; expected ${JSON.stringify(expectedBundleIdentifier)}, got ${JSON.stringify(generatedConfig.identifier)}`,
    );
  }
  if (trimString(generatedConfig.version) !== expectedVersion) {
    throw new Error(
      `desktop packaging aborted: stale version in ${generatedConfigPath}; expected ${JSON.stringify(expectedVersion)}, got ${JSON.stringify(generatedConfig.version)}`,
    );
  }
  if (trimString(generatedBrand.brandId) !== expectedBrandId) {
    throw new Error(
      `desktop packaging aborted: stale brandId in ${generatedBrandPath}; expected ${JSON.stringify(expectedBrandId)}, got ${JSON.stringify(generatedBrand.brandId)}`,
    );
  }
  if (trimString(generatedBrand.bundleIdentifier) !== expectedBundleIdentifier) {
    throw new Error(
      `desktop packaging aborted: stale bundleIdentifier in ${generatedBrandPath}; expected ${JSON.stringify(expectedBundleIdentifier)}, got ${JSON.stringify(generatedBrand.bundleIdentifier)}`,
    );
  }
  if (trimString(generatedBrand.artifactBaseName) !== expectedArtifactBaseName) {
    throw new Error(
      `desktop packaging aborted: stale artifactBaseName in ${generatedBrandPath}; expected ${JSON.stringify(expectedArtifactBaseName)}, got ${JSON.stringify(generatedBrand.artifactBaseName)}`,
    );
  }
  if (trimString(generatedBrand.build?.stamp?.buildId) !== expectedBuildId) {
    throw new Error(
      `desktop packaging aborted: stale buildId in ${generatedBrandPath}; expected ${JSON.stringify(expectedBuildId)}, got ${JSON.stringify(generatedBrand.build?.stamp?.buildId)}`,
    );
  }
  if (trimString(generatedBrand.build?.stamp?.sourceProfileHash) !== expectedSourceProfileHash) {
    throw new Error(
      `desktop packaging aborted: stale sourceProfileHash in ${generatedBrandPath}; expected ${JSON.stringify(expectedSourceProfileHash)}, got ${JSON.stringify(generatedBrand.build?.stamp?.sourceProfileHash)}`,
    );
  }

  const requiredGeneratedFiles = [
    path.join(stagePaths.iconsGeneratedDir, '32x32.png'),
    path.join(stagePaths.iconsGeneratedDir, '128x128.png'),
    path.join(stagePaths.iconsGeneratedDir, '128x128@2x.png'),
    path.join(stagePaths.iconsGeneratedDir, 'icon.icns'),
    path.join(stagePaths.iconsGeneratedDir, 'icon.ico'),
    path.join(stagePaths.installerGeneratedDir, 'nsis-installer.ico'),
    path.join(tauriDir, 'resources', 'runtime', 'generate-openclaw-config.mjs'),
    path.join(tauriDir, 'resources', 'runtime', 'openclaw-plugin-manifest.mjs'),
    path.join(tauriDir, 'resources', 'runtime', 'packaged-plugins-manifest.json'),
  ];
  for (const filePath of requiredGeneratedFiles) {
    if (!(await pathExists(filePath))) {
      throw new Error(`desktop packaging aborted: missing generated brand/runtime artifact ${filePath}`);
    }
  }
}

function bundleTargetRoot(target) {
  return buildBundleRoot({ tauriDir, target, profile: 'release' });
}

async function validateMacosProdBundle({ target, channel, stagePaths }) {
  if (process.platform !== 'darwin' || channel !== 'prod') {
    return;
  }

  const productName = await readGeneratedProductName(stagePaths.tauriGeneratedConfigPath);
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

async function notarizeMacosAppBundleManually({ target, channel, env, stagePaths }) {
  if (!shouldUseManualMacosNotarization(channel, env)) {
    return;
  }

  const productName = await readGeneratedProductName(stagePaths.tauriGeneratedConfigPath);
  const appBundlePath = path.join(bundleTargetRoot(target), 'macos', `${productName}.app`);
  const tmpDir = await fs.mkdtemp(path.join(process.env.TMPDIR || '/tmp', 'iclaw-notary-'));
  const zipPath = path.join(tmpDir, `${productName}.zip`);
  const timeoutMs = Number.parseInt(String(env.ICLAW_NOTARY_TIMEOUT_MS || '1800000'), 10);
  const pollMs = Number.parseInt(String(env.ICLAW_NOTARY_POLL_MS || '15000'), 10);

  try {
    run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appBundlePath, zipPath], { env });
    const submit = runCapture(
      'xcrun',
      [
        'notarytool',
        'submit',
        zipPath,
        '--apple-id',
        env.APPLE_ID,
        '--password',
        env.APPLE_PASSWORD,
        '--team-id',
        env.APPLE_TEAM_ID,
        '--output-format',
        'json',
      ],
      { env },
    );
    if (submit.status !== 0) {
      throw new Error(
        [
          'manual macOS notarization submit failed.',
          submit.stderr?.trim() || submit.stdout?.trim() || `exit ${submit.status ?? 'unknown'}`,
        ].join('\n'),
      );
    }

    const submitPayload = JSON.parse(submit.stdout || '{}');
    const submissionId = trimString(submitPayload.id || submitPayload.submissionId || '');
    if (!submissionId) {
      throw new Error(`manual macOS notarization submit did not return a submission id.\n${submit.stdout || ''}`.trim());
    }

    process.stdout.write(`[desktop-package] submitted macOS notarization: ${submissionId}\n`);
    const startedAt = Date.now();

    while (true) {
      const info = runCapture(
        'xcrun',
        [
          'notarytool',
          'info',
          submissionId,
          '--apple-id',
          env.APPLE_ID,
          '--password',
          env.APPLE_PASSWORD,
          '--team-id',
          env.APPLE_TEAM_ID,
          '--output-format',
          'json',
        ],
        { env },
      );
      if (info.status !== 0) {
        throw new Error(
          [
            `manual macOS notarization info failed for ${submissionId}.`,
            info.stderr?.trim() || info.stdout?.trim() || `exit ${info.status ?? 'unknown'}`,
          ].join('\n'),
        );
      }

      const infoPayload = JSON.parse(info.stdout || '{}');
      const status = trimString(infoPayload.status);
      if (/^accepted$/i.test(status)) {
        process.stdout.write(`[desktop-package] macOS notarization accepted: ${submissionId}\n`);
        break;
      }
      if (/^(invalid|rejected)$/i.test(status)) {
        const log = runCapture(
          'xcrun',
          [
            'notarytool',
            'log',
            submissionId,
            '--apple-id',
            env.APPLE_ID,
            '--password',
            env.APPLE_PASSWORD,
            '--team-id',
            env.APPLE_TEAM_ID,
          ],
          { env },
        );
        throw new Error(
          [
            `manual macOS notarization ${status.toLowerCase()}: ${submissionId}`,
            log.stderr?.trim() || log.stdout?.trim() || '(no notarization log output)',
          ].join('\n'),
        );
      }
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(
          `manual macOS notarization timed out after ${Math.round(timeoutMs / 1000)}s: ${submissionId}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }

    run('xcrun', ['stapler', 'staple', '-v', appBundlePath], { env });
    process.stdout.write(`[desktop-package] stapled macOS app bundle: ${appBundlePath}\n`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
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

  const nsisOutput = await findLatestWindowsNsisArtifact('nsis-output.exe', target);
  if (!nsisOutput) {
    throw new Error('desktop packaging aborted: unable to locate rebuilt NSIS output (nsis-output.exe)');
  }
  await fs.copyFile(nsisOutput.fullPath, latestInstaller.fullPath);
}

async function rebuildWindowsNsisInstaller({ target }) {
  if (process.platform !== 'win32') {
    return;
  }

  const installerScript = await findLatestWindowsNsisArtifact('installer.nsi', target);
  if (!installerScript) {
    return;
  }

  const changed = await patchWindowsNsisScript(installerScript.fullPath);
  if (!changed) {
    return;
  }

  const makensis = findMakensisPath();
  run(makensis, [installerScript.fullPath], { cwd: rootDir });
  await copyLatestNsisOutput({ target });
}

async function renameIfExists(sourcePath, destinationPath) {
  if (!(await pathExists(sourcePath))) {
    return false;
  }
  if (sourcePath === destinationPath) {
    return true;
  }
  await fs.rm(destinationPath, { force: true });
  await fs.rename(sourcePath, destinationPath);
  return true;
}

async function normalizeBundledArtifactNames({ target, brandProfile, channel, appVersion }) {
  const targetInfo = resolvePackagingTargetInfo(target);
  if (!targetInfo) {
    return;
  }

  const artifactBaseName = trimString(brandProfile?.distribution?.artifactBaseName) || trimString(brandProfile?.productName);
  const productName = trimString(brandProfile?.productName);
  const { fullVersion } = splitAppVersion(appVersion);
  const releaseVersion = resolveNormalizedReleaseVersion(
    fullVersion,
    process.env.ICLAW_RELEASE_VERSION || process.env.ICLAW_DESKTOP_RELEASE_VERSION || '',
  );
  const normalizedChannel = resolvePackagingChannelFromEnv(process.env) || normalizePackagingChannelFromEnvFallback(channel);
  const arch = targetInfo.arch;
  const bundleRoot = bundleTargetRoot(target);

  if (targetInfo.platform === 'windows') {
    const nsisDir = path.join(bundleRoot, 'nsis');
    const entries = await fs.readdir(nsisDir, { withFileTypes: true });
    const installers = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.exe')) {
        continue;
      }
      const fullPath = path.join(nsisDir, entry.name);
      const stat = await fs.stat(fullPath);
      installers.push({ name: entry.name, fullPath, mtimeMs: stat.mtimeMs });
    }
    installers.sort((left, right) => right.mtimeMs - left.mtimeMs);
    const installer = installers[0];
    if (!installer) {
      throw new Error(`desktop packaging aborted: no Windows installer found under ${nsisDir}`);
    }
    const normalizedInstallerName = `${artifactBaseName}_${releaseVersion}_${arch}_${normalizedChannel}.exe`;
    await renameIfExists(installer.fullPath, path.join(nsisDir, normalizedInstallerName));

    const defaultUpdaterName = `${productName}_${fullVersion}_${arch}-nsis.zip`;
    const normalizedUpdaterName = `${artifactBaseName}_${releaseVersion}_${arch}_${normalizedChannel}.nsis.zip`;
    if (await renameIfExists(path.join(nsisDir, defaultUpdaterName), path.join(nsisDir, normalizedUpdaterName))) {
      await renameIfExists(path.join(nsisDir, `${defaultUpdaterName}.sig`), path.join(nsisDir, `${normalizedUpdaterName}.sig`));
    }
    return;
  }

  if (targetInfo.platform === 'darwin') {
    const dmgDir = path.join(bundleRoot, 'dmg');
    const defaultDmgName = `${artifactBaseName}_${fullVersion}_${arch}_${normalizedChannel}.dmg`;
    const normalizedDmgName = `${artifactBaseName}_${releaseVersion}_${arch}_${normalizedChannel}.dmg`;
    await renameIfExists(path.join(dmgDir, defaultDmgName), path.join(dmgDir, normalizedDmgName));

    const macosDir = path.join(bundleRoot, 'macos');
    const defaultUpdaterName = `${productName}.app.tar.gz`;
    const normalizedUpdaterName = `${artifactBaseName}_${releaseVersion}_${arch}_${normalizedChannel}.app.tar.gz`;
    if (await renameIfExists(path.join(macosDir, defaultUpdaterName), path.join(macosDir, normalizedUpdaterName))) {
      await renameIfExists(path.join(macosDir, `${defaultUpdaterName}.sig`), path.join(macosDir, `${normalizedUpdaterName}.sig`));
    }
  }
}

function normalizePackagingChannelFromEnvFallback(channel) {
  const normalized = trimString(channel).toLowerCase();
  if (normalized === 'dev' || normalized === 'test' || normalized === 'prod') {
    return normalized;
  }
  return 'prod';
}

function syncLocalAppRuntime({ pnpm, env, brandId, packagingPaths }) {
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
    '--incremental',
  ];
  const result = spawnSync(process.execPath, args, {
    stdio: 'pipe',
    cwd: rootDir,
    env: {
      ...env,
      ICLAW_PACKAGED_SKILL_BASELINE_DIR: packagingPaths.packagedSkillBaselineDir,
      ICLAW_PACKAGED_MCP_BASELINE_DIR: packagingPaths.packagedMcpBaselineDir,
    },
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

async function syncBundledBaselineSkills({ pnpm, env, brandId, packagingPaths }) {
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
    packagingPaths.bundledSkillsDir,
    '--bundled-only',
    '--incremental',
  ];
  const syncEnv = {
    ...env,
    ICLAW_FAIL_ON_SKIPPED_SKILLS: '1',
    ICLAW_SKIP_RUNTIME_SKILL_SYNC: '0',
    ICLAW_BUNDLED_SKILLS_ONLY: '1',
    ICLAW_INCREMENTAL_SKILL_SYNC: '1',
    ICLAW_RUNTIME_SKILLS_OUTPUT_ROOT: packagingPaths.bundledSkillsDir,
    ICLAW_RUNTIME_MCP_CONFIG_PATH: path.join(packagingPaths.resourcesSourceDir, 'mcp', 'mcp.json'),
    ICLAW_RUNTIME_APP_CONFIG_PATH: path.join(packagingPaths.resourcesSourceDir, 'config', 'portal-app-runtime.json'),
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
    const removedVcsDirs = await removeDirectoriesByName(packagingPaths.bundledSkillsDir, ['.git']);
    if (removedVcsDirs.length > 0) {
      process.stdout.write(
        `[desktop-package] removed VCS directories from bundled skills: ${removedVcsDirs.length}\n`,
      );
    }
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

async function writeTempTauriConfig({ stagePaths }) {
  const config = JSON.parse(await fs.readFile(stagePaths.tauriGeneratedConfigPath, 'utf8'));
  config.build = config.build || {};
  config.build.beforeBuildCommand = '';
  config.build.frontendDist = path.join(desktopDir, 'dist');
  config.bundle = config.bundle || {};
  if (!isTruthyEnv(process.env.ICLAW_DESKTOP_ENABLE_NATIVE_UPDATER)) {
    config.bundle.createUpdaterArtifacts = false;
  }
  config.bundle.icon = [
    path.join(stagePaths.iconsGeneratedDir, '32x32.png'),
    path.join(stagePaths.iconsGeneratedDir, '128x128.png'),
    path.join(stagePaths.iconsGeneratedDir, '128x128@2x.png'),
    path.join(stagePaths.iconsGeneratedDir, 'icon.icns'),
    path.join(stagePaths.iconsGeneratedDir, 'icon.ico'),
  ];
  if (config.bundle.windows?.nsis) {
    config.bundle.windows.nsis.installerIcon = path.join(stagePaths.installerGeneratedDir, 'nsis-installer.ico');
    if (config.bundle.windows.nsis.headerImage) {
      config.bundle.windows.nsis.headerImage = path.join(stagePaths.installerGeneratedDir, 'nsis-header.bmp');
    }
    if (config.bundle.windows.nsis.sidebarImage) {
      config.bundle.windows.nsis.sidebarImage = path.join(stagePaths.installerGeneratedDir, 'nsis-sidebar.bmp');
    }
  }
  const tempConfigPath = path.join(stagePaths.tauriRoot, 'tauri.build.local.json');
  await fs.mkdir(path.dirname(tempConfigPath), { recursive: true });
  await fs.writeFile(tempConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return tempConfigPath;
}

async function preparePackagingResourcesSource(resourcesSourceDir) {
  await fs.mkdir(resourcesSourceDir, { recursive: true });
  await Promise.all([
    syncDirOrRemove(path.join(openclawResourcesSourceDir, 'certs'), path.join(resourcesSourceDir, 'certs')),
    syncDirOrRemove(path.join(openclawResourcesSourceDir, 'config'), path.join(resourcesSourceDir, 'config')),
    syncDirOrRemove(path.join(openclawResourcesSourceDir, 'mcp'), path.join(resourcesSourceDir, 'mcp')),
  ]);
  await fs.mkdir(path.join(resourcesSourceDir, 'baseline'), { recursive: true });
  await fs.mkdir(path.join(resourcesSourceDir, 'bundled-skills'), { recursive: true });
}

async function collectFilesRecursively(rootPath, fileName) {
  const matches = [];
  if (!(await pathExists(rootPath))) {
    return matches;
  }

  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(nextPath);
        continue;
      }
      if (entry.isFile() && entry.name === fileName) {
        const stat = await fs.stat(nextPath);
        matches.push({ fullPath: nextPath, mtimeMs: stat.mtimeMs });
      }
    }
  }

  await walk(rootPath);
  return matches;
}

async function findLatestWindowsNsisArtifact(fileName, target = '') {
  const allMatches = await collectFilesRecursively(path.join(tauriDir, 'target'), fileName);
  const targetSegment = trimString(target);
  const targetMatches = targetSegment
    ? allMatches.filter((entry) => entry.fullPath.includes(targetSegment))
    : allMatches;
  const scopedMatches = (targetMatches.length > 0 ? targetMatches : allMatches)
    .filter((entry) => entry.fullPath.includes(`${path.sep}nsis${path.sep}`))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);
  return scopedMatches[0] || null;
}

async function runtimeLayoutLooksComplete(runtimeDir, targetTriple = '') {
  const requiredPaths = [
    path.join(runtimeDir, targetTriple.includes('windows') ? 'openclaw-runtime.cmd' : 'openclaw-runtime'),
    path.join(runtimeDir, 'bin', targetTriple.includes('windows') ? 'node.exe' : 'node'),
    path.join(runtimeDir, 'openclaw', 'openclaw.mjs'),
    path.join(runtimeDir, 'openclaw', 'package.json'),
    path.join(runtimeDir, 'openclaw', 'node_modules', 'chalk', 'package.json'),
  ];
  const checks = await Promise.all(requiredPaths.map((targetPath) => pathExists(targetPath)));
  return checks.every(Boolean);
}

async function collectRuntimeFiles(rootDir) {
  const files = [];
  if (!(await pathExists(rootDir))) {
    return files;
  }

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return files;
}

async function isMachOBinary(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (
    [
      '.js',
      '.mjs',
      '.cjs',
      '.json',
      '.md',
      '.mdx',
      '.txt',
      '.html',
      '.css',
      '.map',
      '.py',
      '.pyc',
      '.typed',
      '.ts',
      '.tsx',
      '.jsx',
      '.yml',
      '.yaml',
      '.toml',
      '.lock',
      '.plist',
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.svg',
      '.wasm',
    ].includes(extension)
  ) {
    return false;
  }
  const result = runCapture('file', ['-b', filePath]);
  if (result.status !== 0) {
    return false;
  }
  return /Mach-O/i.test(result.stdout || '');
}

async function collectRuntimeSymlinks(rootDir) {
  const symlinks = [];
  if (!(await pathExists(rootDir))) {
    return symlinks;
  }

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isSymbolicLink()) {
        symlinks.push(fullPath);
        continue;
      }
      if (entry.isDirectory()) {
        await walk(fullPath);
      }
    }
  }

  await walk(rootDir);
  return symlinks;
}

async function collectRuntimeBundleRoots(rootDir) {
  const bundleRoots = [];
  if (!(await pathExists(rootDir))) {
    return bundleRoots;
  }

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    const hasContentsInfo = await pathExists(path.join(currentDir, 'Contents', 'Info.plist'));
    const hasResourcesInfo = await pathExists(path.join(currentDir, 'Resources', 'Info.plist'));
    const hasCodeResources = await pathExists(path.join(currentDir, '_CodeSignature', 'CodeResources'));
    if ((hasContentsInfo || hasResourcesInfo) && hasCodeResources) {
      bundleRoots.push(currentDir);
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await walk(path.join(currentDir, entry.name));
      }
    }
  }

  await walk(rootDir);
  return bundleRoots.sort((left, right) => right.length - left.length);
}

async function signBundledRuntimeArchiveForMacos({ archivePath, artifactFormat, targetTriple, env }) {
  if (process.platform !== 'darwin' || !targetTriple.includes('apple-darwin')) {
    return;
  }
  const signingIdentity = trimString(env.APPLE_SIGNING_IDENTITY);
  if (!signingIdentity) {
    return;
  }

  const tempRoot = await fs.mkdtemp(path.join(process.env.TMPDIR || '/tmp', 'iclaw-runtime-sign-'));
  const extractDir = path.join(tempRoot, 'extract');
  const rebuiltArchivePath = path.join(tempRoot, `runtime.${runtimeArchiveExtension(artifactFormat)}`);

  try {
    await extractRuntimeArchive({ archivePath, artifactFormat, destinationDir: extractDir });
    const runtimeRoot = await resolveExtractedRuntimeRoot(extractDir, targetTriple);
    const files = await collectRuntimeFiles(runtimeRoot);
    const signableFiles = [];
    for (const filePath of files) {
      if (await isMachOBinary(filePath)) {
        signableFiles.push(filePath);
      }
    }

    process.stdout.write(
      `[desktop-package] signing bundled runtime archive for notarization: ${signableFiles.length} Mach-O files\n`,
    );

    for (const filePath of signableFiles) {
      runChecked(
        'codesign',
        ['--force', '--sign', signingIdentity, '--timestamp', '--options', 'runtime', filePath],
        { env },
      );
    }

    const symlinks = await collectRuntimeSymlinks(runtimeRoot);
    for (const symlinkPath of symlinks) {
      let realPath = '';
      try {
        realPath = await fs.realpath(symlinkPath);
      } catch {
        continue;
      }
      if (!(await isMachOBinary(realPath))) {
        continue;
      }
      const sourceStats = await fs.stat(realPath);
      await fs.rm(symlinkPath, { force: true });
      await fs.copyFile(realPath, symlinkPath);
      await fs.chmod(symlinkPath, sourceStats.mode);
      runChecked(
        'codesign',
        ['--force', '--sign', signingIdentity, '--timestamp', '--options', 'runtime', symlinkPath],
        { env },
      );
    }

    const bundleRoots = await collectRuntimeBundleRoots(runtimeRoot);
    for (const bundleRoot of bundleRoots) {
      runChecked(
        'codesign',
        ['--force', '--sign', signingIdentity, '--timestamp', '--options', 'runtime', bundleRoot],
        { env },
      );
    }

    if (artifactFormat === 'zip') {
      runChecked('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', runtimeRoot, rebuiltArchivePath], { env });
    } else {
      runChecked('tar', ['-czf', rebuiltArchivePath, '-C', extractDir, '.'], { env });
    }

    await fs.copyFile(rebuiltArchivePath, archivePath);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function collectRuntimeDirsByName(rootDir, directoryNames) {
  const matches = [];
  if (!(await pathExists(rootDir))) {
    return matches;
  }
  const wanted = new Set(directoryNames.map((name) => name.toLowerCase()));

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const fullPath = path.join(currentDir, entry.name);
      if (wanted.has(entry.name.toLowerCase())) {
        matches.push(fullPath);
        continue;
      }
      await walk(fullPath);
    }
  }

  await walk(rootDir);
  return matches;
}

async function collectRuntimeDirs(rootDir) {
  const dirs = [];
  if (!(await pathExists(rootDir))) {
    return dirs;
  }

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const fullPath = path.join(currentDir, entry.name);
      dirs.push(fullPath);
      await walk(fullPath);
    }
  }

  await walk(rootDir);
  return dirs;
}

async function removeRuntimePath(targetPath, stats) {
  if (!(await pathExists(targetPath))) {
    return;
  }
  const metadata = await fs.stat(targetPath);
  if (metadata.isDirectory()) {
    const files = await collectRuntimeFiles(targetPath);
    const fileStats = await Promise.all(files.map(async (filePath) => fs.stat(filePath)));
    stats.filesRemoved += fileStats.length;
    stats.bytesRemoved += fileStats.reduce((total, item) => total + item.size, 0);
    await fs.rm(targetPath, { recursive: true, force: true });
    stats.directoriesRemoved += 1;
    return;
  }
  stats.filesRemoved += 1;
  stats.bytesRemoved += metadata.size;
  await fs.rm(targetPath, { force: true });
}

async function directoryContainsRuntimeFiles(targetPath) {
  const runtimeExtensions = new Set(['.js', '.mjs', '.cjs', '.node', '.dll', '.exe', '.wasm']);
  const files = await collectRuntimeFiles(targetPath);
  return files.some((filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    if (runtimeExtensions.has(extension)) {
      return true;
    }
    return extension === '' && path.basename(filePath).toLowerCase() !== 'license';
  });
}

async function removeSourceOnlyCandidateDirs(rootDir, candidateNames, stats) {
  const candidates = await collectRuntimeDirs(rootDir);
  const wanted = new Set(candidateNames.map((name) => name.toLowerCase()));
  for (const dirPath of candidates) {
    const dirName = path.basename(dirPath).toLowerCase();
    if (!wanted.has(dirName)) {
      continue;
    }
    if (await directoryContainsRuntimeFiles(dirPath)) {
      continue;
    }
    await removeRuntimePath(dirPath, stats);
  }
}

async function removeTypeOnlyPackageDirs(nodeModulesRoot, stats) {
  if (!(await pathExists(nodeModulesRoot))) {
    return;
  }

  const packageDirs = [];
  const entries = await fs.readdir(nodeModulesRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const fullPath = path.join(nodeModulesRoot, entry.name);
    if (entry.name.startsWith('@')) {
      const scopedEntries = await fs.readdir(fullPath, { withFileTypes: true });
      for (const scopedEntry of scopedEntries) {
        if (scopedEntry.isDirectory()) {
          packageDirs.push(path.join(fullPath, scopedEntry.name));
        }
      }
      continue;
    }
    packageDirs.push(fullPath);
  }

  for (const packageDir of packageDirs) {
    if (await directoryContainsRuntimeFiles(packageDir)) {
      continue;
    }
    await removeRuntimePath(packageDir, stats);
  }
}

async function removeDirectoriesByName(rootDir, directoryNames) {
  const matches = await collectRuntimeDirsByName(rootDir, directoryNames);
  const removed = [];
  for (const targetPath of matches.sort((left, right) => right.length - left.length)) {
    await fs.rm(targetPath, { recursive: true, force: true });
    removed.push(targetPath);
  }
  return removed;
}

async function scrubPackagingResourceTree(targetRoot) {
  const removedVcsDirs = await removeDirectoriesByName(targetRoot, ['.git']);
  if (removedVcsDirs.length > 0) {
    process.stdout.write(
      `[desktop-package] removed VCS directories from packaging tree: ${removedVcsDirs.length}\n`,
    );
  }

  if (process.platform === 'darwin' && (await pathExists(targetRoot))) {
    runChecked('xattr', ['-cr', targetRoot]);
  }
}

function currentWindowsKoffiDir(targetTriple = '') {
  if (targetTriple.includes('arm64')) {
    return 'win32_arm64';
  }
  if (targetTriple.includes('i686') || targetTriple.includes('ia32')) {
    return 'win32_ia32';
  }
  return 'win32_x64';
}

function currentWindowsCanvasPackage(targetTriple = '') {
  if (targetTriple.includes('arm64')) {
    return 'canvas-win32-arm64-msvc';
  }
  return 'canvas-win32-x64-msvc';
}

function currentWindowsSharpPackage(targetTriple = '') {
  if (targetTriple.includes('arm64')) {
    return 'sharp-win32-arm64';
  }
  return 'sharp-win32-x64';
}

function currentWindowsNodePtyPackage(targetTriple = '') {
  if (targetTriple.includes('arm64')) {
    return 'node-pty-win32-arm64';
  }
  return 'node-pty-win32-x64';
}

async function pruneBundledRuntime(runtimeDir, targetTriple = '') {
  if (!(targetTriple || '').includes('windows')) {
    return;
  }

  const stats = {
    filesRemoved: 0,
    directoriesRemoved: 0,
    bytesRemoved: 0,
  };
  const runtimeFiles = await collectRuntimeFiles(runtimeDir);
  const removableExtensions = new Set(['.map', '.pdb', '.md', '.mdx']);
  const removableTypeSuffixes = ['.d.ts', '.d.cts', '.d.mts'];
  const nodeModulesRoot = path.join(runtimeDir, 'openclaw', 'node_modules');

  for (const filePath of runtimeFiles) {
    const normalized = filePath.toLowerCase();
    const ext = path.extname(filePath).toLowerCase();
    const inNodeModules = normalized.includes(`${path.sep}openclaw${path.sep}node_modules${path.sep}`);
    const shouldRemoveByExt =
      removableExtensions.has(ext) || (inNodeModules && removableTypeSuffixes.some((suffix) => normalized.endsWith(suffix)));
    if (shouldRemoveByExt) {
      await removeRuntimePath(filePath, stats);
    }
  }

  await removeSourceOnlyCandidateDirs(
    nodeModulesRoot,
    ['test', 'tests', '__tests__', '__mocks__', 'docs', 'doc', 'example', 'examples', '.github', 'src', 'types', 'dist-types', 'ts3.4'],
    stats,
  );
  await removeTypeOnlyPackageDirs(nodeModulesRoot, stats);

  const maybeRemoveDirChildrenExcept = async (parentDir, keepNames) => {
    if (!(await pathExists(parentDir))) {
      return;
    }
    const entries = await fs.readdir(parentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (keepNames.has(entry.name)) {
        continue;
      }
      await removeRuntimePath(path.join(parentDir, entry.name), stats);
    }
  };

  await maybeRemoveDirChildrenExcept(
    path.join(nodeModulesRoot, 'koffi', 'build', 'koffi'),
    new Set([currentWindowsKoffiDir(targetTriple)]),
  );
  await maybeRemoveDirChildrenExcept(
    path.join(nodeModulesRoot, '@napi-rs'),
    new Set(['canvas', currentWindowsCanvasPackage(targetTriple), 'wasm-runtime']),
  );
  await maybeRemoveDirChildrenExcept(
    path.join(nodeModulesRoot, '@img'),
    new Set(['colour', currentWindowsSharpPackage(targetTriple)]),
  );
  await maybeRemoveDirChildrenExcept(
    path.join(nodeModulesRoot, '@lydell'),
    new Set([currentWindowsNodePtyPackage(targetTriple)]),
  );

  process.stdout.write(
    `[desktop-package] pruned bundled runtime for ${targetTriple}: removed ${stats.filesRemoved} files, ${stats.directoriesRemoved} directories, ${stats.bytesRemoved} bytes\n`,
  );
}

function inferRuntimeTargetTriple(target = '') {
  return resolvePackagingTargetInfo(target)?.triple || '';
}

const KNOWN_RUNTIME_TARGET_TRIPLES = listKnownRuntimeTargets();

function detectRuntimeArtifactTargetTriple(artifactUrl) {
  const normalized = trimString(artifactUrl);
  if (!normalized) {
    return '';
  }
  return KNOWN_RUNTIME_TARGET_TRIPLES.find((triple) => normalized.includes(`openclaw-runtime-${triple}-`)) || '';
}

async function readRuntimeBootstrapConfig() {
  if (!(await pathExists(runtimeBootstrapConfigPath))) {
    return null;
  }
  return JSON.parse(await fs.readFile(runtimeBootstrapConfigPath, 'utf8'));
}

function resolveRuntimeBootstrapConfigForTarget(rawConfig, targetTriple = '') {
  const nextConfig = {
    ...(rawConfig && typeof rawConfig === 'object' ? rawConfig : {}),
  };
  const artifacts =
    nextConfig.artifacts && typeof nextConfig.artifacts === 'object' && !Array.isArray(nextConfig.artifacts)
      ? nextConfig.artifacts
      : {};
  const scoped =
    targetTriple &&
    artifacts[targetTriple] &&
    typeof artifacts[targetTriple] === 'object' &&
    !Array.isArray(artifacts[targetTriple])
      ? artifacts[targetTriple]
      : null;
  if (scoped) {
    if (trimString(scoped.artifact_url)) nextConfig.artifact_url = trimString(scoped.artifact_url);
    if (typeof scoped.artifact_sha256 === 'string') nextConfig.artifact_sha256 = trimString(scoped.artifact_sha256);
    if (trimString(scoped.artifact_format)) nextConfig.artifact_format = trimString(scoped.artifact_format);
    if (typeof scoped.launcher_relative_path === 'string') {
      nextConfig.launcher_relative_path = trimString(scoped.launcher_relative_path);
    }
  }
  return nextConfig;
}

function applyRuntimeBootstrapEnvOverrides(rawConfig, env, targetTriple = '') {
  const nextConfig = {
    ...(rawConfig && typeof rawConfig === 'object' ? rawConfig : {}),
  };
  const nextArtifacts =
    nextConfig.artifacts && typeof nextConfig.artifacts === 'object' && !Array.isArray(nextConfig.artifacts)
      ? { ...nextConfig.artifacts }
      : {};
  const version = trimString(env.ICLAW_OPENCLAW_RUNTIME_VERSION);
  const artifactUrl = trimString(env.ICLAW_OPENCLAW_RUNTIME_URL);
  const artifactSha = trimString(env.ICLAW_OPENCLAW_RUNTIME_SHA256);
  const artifactFormat = trimString(env.ICLAW_OPENCLAW_RUNTIME_FORMAT);
  const launcherRelativePath = trimString(env.ICLAW_OPENCLAW_RUNTIME_LAUNCHER);

  if (version) nextConfig.version = version;
  if (artifactUrl) nextConfig.artifact_url = artifactUrl;
  if (artifactSha) nextConfig.artifact_sha256 = artifactSha;
  if (artifactFormat) nextConfig.artifact_format = artifactFormat;
  if (launcherRelativePath) nextConfig.launcher_relative_path = launcherRelativePath;

  if (targetTriple && (artifactUrl || artifactSha || artifactFormat || launcherRelativePath)) {
    const scoped =
      nextArtifacts[targetTriple] &&
      typeof nextArtifacts[targetTriple] === 'object' &&
      !Array.isArray(nextArtifacts[targetTriple])
        ? { ...nextArtifacts[targetTriple] }
        : {};
    if (artifactUrl) scoped.artifact_url = artifactUrl;
    if (artifactSha) scoped.artifact_sha256 = artifactSha;
    if (artifactFormat) scoped.artifact_format = artifactFormat;
    if (launcherRelativePath) scoped.launcher_relative_path = launcherRelativePath;
    nextArtifacts[targetTriple] = scoped;
    nextConfig.artifacts = nextArtifacts;
  }

  return nextConfig;
}

function buildRuntimeArtifactPublicUrl({ brandProfile, version, artifactUrl, channel }) {
  const normalizedVersion = trimString(version);
  const normalizedArtifactUrl = trimString(artifactUrl);
  if (!normalizedVersion || !normalizedArtifactUrl) {
    return '';
  }

  const runtimeDistribution =
    brandProfile?.runtimeDistribution && typeof brandProfile.runtimeDistribution === 'object'
      ? brandProfile.runtimeDistribution
      : {};
  const minioPrefix = trimString(runtimeDistribution.minioPrefix) || 'runtime';
  const channelConfig =
    channel &&
    runtimeDistribution[channel] &&
    typeof runtimeDistribution[channel] === 'object' &&
    !Array.isArray(runtimeDistribution[channel])
      ? runtimeDistribution[channel]
      : {};
  const publicBaseUrl = trimString(channelConfig.publicBaseUrl);
  if (!publicBaseUrl) {
    return '';
  }

  let artifactFileName = '';
  try {
    artifactFileName = basename(new URL(normalizedArtifactUrl).pathname);
  } catch {
    artifactFileName = basename(normalizedArtifactUrl.replace(/\\/g, '/'));
  }
  if (!artifactFileName) {
    return '';
  }

  const normalizedPrefix = minioPrefix.replace(/^\/+|\/+$/g, '');
  const objectKey = [normalizedPrefix, 'openclaw', normalizedVersion, artifactFileName]
    .filter(Boolean)
    .join('/');
  return `${publicBaseUrl.replace(/\/+$/g, '')}/${objectKey}`;
}

function applyBrandRuntimeBootstrapOverrides(rawConfig, brandProfile, channel, targetTriple = '') {
  const nextConfig = {
    ...(rawConfig && typeof rawConfig === 'object' ? rawConfig : {}),
  };
  const nextArtifacts =
    nextConfig.artifacts && typeof nextConfig.artifacts === 'object' && !Array.isArray(nextConfig.artifacts)
      ? { ...nextConfig.artifacts }
      : {};

  const rootArtifactUrl = buildRuntimeArtifactPublicUrl({
    brandProfile,
    version: nextConfig.version,
    artifactUrl: nextConfig.artifact_url,
    channel,
  });
  if (rootArtifactUrl) {
    nextConfig.artifact_url = rootArtifactUrl;
  }

  if (targetTriple) {
    const scoped =
      nextArtifacts[targetTriple] &&
      typeof nextArtifacts[targetTriple] === 'object' &&
      !Array.isArray(nextArtifacts[targetTriple])
        ? { ...nextArtifacts[targetTriple] }
        : {};
    const scopedArtifactUrl = buildRuntimeArtifactPublicUrl({
      brandProfile,
      version: nextConfig.version,
      artifactUrl: scoped.artifact_url || nextConfig.artifact_url,
      channel,
    });
    if (scopedArtifactUrl) {
      scoped.artifact_url = scopedArtifactUrl;
      nextArtifacts[targetTriple] = scoped;
      nextConfig.artifacts = nextArtifacts;
    }
  }

  return nextConfig;
}

async function writeRuntimeBootstrapConfig(config) {
  await fs.mkdir(path.dirname(runtimeBootstrapConfigPath), { recursive: true });
  await fs.writeFile(runtimeBootstrapConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

async function verifyRemoteRuntimeArtifactSha256(artifactUrl, expectedSha256) {
  const normalizedUrl = trimString(artifactUrl);
  const normalizedExpectedSha256 = trimString(expectedSha256).toLowerCase();
  if (!normalizedUrl || !normalizedExpectedSha256 || !/^https?:\/\//i.test(normalizedUrl)) {
    return;
  }

  const verificationCacheDir = path.join(rootDir, '.tmp-packaging', 'runtime-hash-cache');
  const verificationCacheKey = createHash('sha256')
    .update(`${normalizedUrl}\n${normalizedExpectedSha256}`)
    .digest('hex');
  const verificationCachePath = path.join(verificationCacheDir, `${verificationCacheKey}.ok`);
  if (await pathExists(verificationCachePath)) {
    process.stdout.write(`[desktop-package] runtime hash cache hit: ${normalizedUrl}\n`);
    return;
  }

  const response = await fetch(normalizedUrl);
  if (!response.ok || !response.body) {
    throw new Error(`failed to download runtime artifact for verification: ${response.status} ${response.statusText}`.trim());
  }

  const hasher = createHash('sha256');
  for await (const chunk of response.body) {
    hasher.update(chunk);
  }
  const actualSha256 = hasher.digest('hex').toLowerCase();
  if (actualSha256 !== normalizedExpectedSha256) {
    throw new Error(
      `runtime artifact sha256 mismatch for ${normalizedUrl}: expected ${normalizedExpectedSha256}, got ${actualSha256}`,
    );
  }

  await fs.mkdir(verificationCacheDir, { recursive: true });
  await fs.writeFile(verificationCachePath, `${actualSha256}\n`, 'utf8');
}

function normalizeRuntimeArtifactFormat(value) {
  const normalized = trimString(value).toLowerCase();
  if (normalized === 'tar.gz' || normalized === 'tgz' || normalized === 'zip') {
    return normalized;
  }
  return '';
}

function runtimeArchiveExtension(format) {
  if (format === 'zip') {
    return 'zip';
  }
  if (format === 'tgz') {
    return 'tgz';
  }
  return 'tar.gz';
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(trimString(value));
}

function runtimeArtifactFileName({ version, targetTriple, artifactFormat, artifactUrl }) {
  const normalizedVersion = trimString(version);
  const normalizedTargetTriple = trimString(targetTriple);
  const normalizedArtifactUrl = trimString(artifactUrl);
  if (normalizedArtifactUrl) {
    try {
      const fileName = basename(new URL(normalizedArtifactUrl).pathname);
      if (fileName) {
        return fileName;
      }
    } catch {
      const fileName = basename(normalizedArtifactUrl.replace(/\\/g, '/'));
      if (fileName) {
        return fileName;
      }
    }
  }
  if (!normalizedVersion || !normalizedTargetTriple) {
    return '';
  }
  return `openclaw-runtime-${normalizedTargetTriple}-${normalizedVersion}.${runtimeArchiveExtension(artifactFormat)}`;
}

function buildLegacyRuntimeArtifactPath({ version, targetTriple, artifactFormat }) {
  const normalizedVersion = trimString(version);
  const normalizedTargetTriple = trimString(targetTriple);
  const normalizedFormat = normalizeRuntimeArtifactFormat(artifactFormat) || 'tar.gz';
  if (!normalizedVersion || !normalizedTargetTriple) {
    return '';
  }
  return path.join(
    runtimeArtifactCacheDir,
    `openclaw-runtime-${normalizedTargetTriple}-${normalizedVersion}.${runtimeArchiveExtension(normalizedFormat)}`,
  );
}

function buildBrandRuntimeArtifactPath({ brandId, version, targetTriple, artifactFormat, artifactUrl }) {
  const normalizedBrandId = trimString(brandId);
  const normalizedVersion = trimString(version);
  const normalizedTargetTriple = trimString(targetTriple);
  const fileName = runtimeArtifactFileName({ version, targetTriple, artifactFormat, artifactUrl });
  if (!normalizedBrandId || !normalizedVersion || !normalizedTargetTriple || !fileName) {
    return '';
  }
  return path.join(runtimeArtifactCacheDir, normalizedBrandId, normalizedTargetTriple, normalizedVersion, fileName);
}

function buildSharedRuntimeArtifactPath({ version, targetTriple, artifactFormat, artifactUrl, artifactSha256 }) {
  const normalizedVersion = trimString(version);
  const normalizedTargetTriple = trimString(targetTriple);
  const normalizedArtifactSha256 = trimString(artifactSha256).toLowerCase();
  const fileName = runtimeArtifactFileName({ version, targetTriple, artifactFormat, artifactUrl });
  if (!normalizedVersion || !normalizedTargetTriple || !normalizedArtifactSha256 || !fileName) {
    return '';
  }
  return path.join(runtimeArtifactCacheDir, '_shared', normalizedTargetTriple, normalizedVersion, normalizedArtifactSha256, fileName);
}

async function sha256File(filePath) {
  const hasher = createHash('sha256');
  const handle = await fs.open(filePath, 'r');
  try {
    const stream = handle.createReadStream();
    for await (const chunk of stream) {
      hasher.update(chunk);
    }
  } finally {
    await handle.close();
  }
  return hasher.digest('hex').toLowerCase();
}

async function verifyRuntimeArtifactFileSha256(filePath, expectedSha256) {
  const normalizedExpectedSha256 = trimString(expectedSha256).toLowerCase();
  if (!normalizedExpectedSha256) {
    return;
  }
  const actualSha256 = await sha256File(filePath);
  if (actualSha256 !== normalizedExpectedSha256) {
    throw new Error(`runtime artifact sha256 mismatch for ${filePath}: expected ${normalizedExpectedSha256}, got ${actualSha256}`);
  }
}

async function downloadRuntimeArtifact({ artifactUrl, destinationPath }) {
  const response = await fetch(artifactUrl);
  if (!response.ok || !response.body) {
    throw new Error(`failed to download runtime artifact: ${response.status} ${response.statusText}`.trim());
  }

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  const chunks = [];
  for await (const chunk of response.body) {
    chunks.push(chunk);
  }
  await fs.writeFile(destinationPath, Buffer.concat(chunks));
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env: options.env ?? process.env,
    shell: options.shell ?? false,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(details || `command failed: ${command} ${args.join(' ')}`);
  }
  return result;
}

async function extractRuntimeArchive({ archivePath, artifactFormat, destinationDir }) {
  await fs.mkdir(destinationDir, { recursive: true });
  if (artifactFormat === 'zip') {
    if (process.platform === 'win32') {
      runChecked(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force`,
        ],
      );
      return;
    }
    runChecked('unzip', ['-q', archivePath, '-d', destinationDir]);
    return;
  }

  const normalizedArchivePath = process.platform === 'win32' ? archivePath.replace(/\\/g, '/') : archivePath;
  const normalizedDestinationDir = process.platform === 'win32' ? destinationDir.replace(/\\/g, '/') : destinationDir;
  const tarCommand = process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'tar';
  runChecked(tarCommand, ['-xzf', normalizedArchivePath, '-C', normalizedDestinationDir]);
}

async function resolveExtractedRuntimeRoot(extractedDir, targetTriple = '') {
  if (await runtimeLayoutLooksComplete(extractedDir, targetTriple)) {
    return extractedDir;
  }

  const entries = await fs.readdir(extractedDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const candidate = path.join(extractedDir, entry.name);
    if (await runtimeLayoutLooksComplete(candidate, targetTriple)) {
      return candidate;
    }
  }

  throw new Error(`runtime archive did not contain a complete runtime layout under ${extractedDir}`);
}

async function writeBundledRuntimeInstallReceipt(runtimeDir, config) {
  const receipt = {
    version: trimString(config.version) || null,
    artifact_url: trimString(config.artifact_url) || null,
    artifact_sha256: trimString(config.artifact_sha256).toLowerCase() || null,
  };
  await fs.writeFile(path.join(runtimeDir, runtimeInstallReceiptName), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
}

async function tryResolveCachedRuntimeArtifact(candidates, expectedSha256) {
  for (const candidate of candidates) {
    if (!candidate?.artifactPath || !(await pathExists(candidate.artifactPath))) {
      continue;
    }
    try {
      await verifyRuntimeArtifactFileSha256(candidate.artifactPath, expectedSha256);
      process.stdout.write(`[desktop-package] using cached runtime artifact (${candidate.source}): ${candidate.artifactPath}\n`);
      return candidate;
    } catch (error) {
      process.stdout.write(
        `[desktop-package] ignoring cached runtime artifact with sha mismatch (${candidate.source}): ${candidate.artifactPath}\n`,
      );
    }
  }
  return null;
}

async function persistRuntimeArtifactCopy(sourcePath, destinationPath) {
  if (!destinationPath || sourcePath === destinationPath) {
    return;
  }
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
}

async function resolveRuntimeArtifactSource({ config, brandId, targetTriple, packagingPaths }) {
  const version = trimString(config.version);
  const artifactUrl = trimString(config.artifact_url);
  const artifactSha256 = trimString(config.artifact_sha256).toLowerCase();
  const artifactFormat = normalizeRuntimeArtifactFormat(config.artifact_format) || 'tar.gz';
  const localConfigPath = !isHttpUrl(artifactUrl) && artifactUrl ? path.resolve(rootDir, artifactUrl) : '';
  const brandCachedArtifactPath = buildBrandRuntimeArtifactPath({
    brandId,
    version,
    targetTriple,
    artifactFormat,
    artifactUrl,
  });
  const sharedCachedArtifactPath = buildSharedRuntimeArtifactPath({
    version,
    targetTriple,
    artifactFormat,
    artifactUrl,
    artifactSha256,
  });
  const legacyCachedArtifactPath = buildLegacyRuntimeArtifactPath({ version, targetTriple, artifactFormat });

  if (localConfigPath && (await pathExists(localConfigPath))) {
    return {
      artifactPath: localConfigPath,
      source: 'configured-local',
      artifactFormat,
      brandCachedArtifactPath,
      sharedCachedArtifactPath,
    };
  }

  const cached = await tryResolveCachedRuntimeArtifact(
    [
      { artifactPath: brandCachedArtifactPath, source: 'brand-cache', artifactFormat },
      { artifactPath: sharedCachedArtifactPath, source: 'shared-cache', artifactFormat },
      { artifactPath: legacyCachedArtifactPath, source: 'legacy-cache', artifactFormat },
    ],
    artifactSha256,
  );
  if (cached) {
    return {
      ...cached,
      brandCachedArtifactPath,
      sharedCachedArtifactPath,
    };
  }
  if (!artifactUrl || !isHttpUrl(artifactUrl)) {
    throw new Error(
      [
        'desktop packaging aborted: unable to resolve a local or remote OpenClaw runtime artifact.',
        `Configured artifact_url: ${artifactUrl || '<empty>'}`,
        `Expected local cache: ${brandCachedArtifactPath || legacyCachedArtifactPath || '<unknown>'}`,
      ].join('\n'),
    );
  }

  const downloadDir = path.join(packagingPaths.workspaceRoot, 'runtime-cache');
  const artifactPath =
    brandCachedArtifactPath || path.join(downloadDir, basename(new URL(artifactUrl).pathname));
  if (!(await pathExists(artifactPath))) {
    process.stdout.write(`[desktop-package] downloading runtime artifact for ${targetTriple || 'host'}: ${artifactUrl}\n`);
    await downloadRuntimeArtifact({ artifactUrl, destinationPath: artifactPath });
  } else {
    process.stdout.write(`[desktop-package] reusing downloaded runtime artifact: ${artifactPath}\n`);
  }
  return {
    artifactPath,
    source: 'remote-download',
    artifactFormat,
    brandCachedArtifactPath,
    sharedCachedArtifactPath,
  };
}

async function prepareBundledRuntime({ env, brandId, brandProfile, channel, targetTriple, packagingPaths }) {
  const stagedRuntimeDir = path.join(packagingPaths.resourcesSourceDir, 'openclaw-runtime');
  const stagedRuntimeArchiveDir = path.join(packagingPaths.resourcesSourceDir, 'runtime-archives');
  if (await runtimeLayoutLooksComplete(stagedRuntimeDir, targetTriple)) {
    process.stdout.write(
      `[desktop-package] removing stale expanded runtime before archive staging: ${stagedRuntimeDir}\n`,
    );
    await fs.rm(stagedRuntimeDir, { recursive: true, force: true });
  }

  const rawConfig = resolveRuntimeBootstrapConfigForTarget(
    applyRuntimeBootstrapEnvOverrides(
      applyBrandRuntimeBootstrapOverrides(await readRuntimeBootstrapConfig(), brandProfile, channel, targetTriple),
      env,
      targetTriple,
    ),
    targetTriple,
  );
  const version = trimString(rawConfig.version);
  const artifactUrl = trimString(rawConfig.artifact_url);
  const artifactSha256 = trimString(rawConfig.artifact_sha256).toLowerCase();
  const artifactFormat = normalizeRuntimeArtifactFormat(rawConfig.artifact_format) || 'tar.gz';

  if (!version || !artifactUrl) {
    throw new Error(
      [
        'desktop packaging aborted: invalid OpenClaw runtime bootstrap config for thick package mode.',
        `Expected non-empty version and artifact_url for target ${targetTriple || 'current-host'} in ${runtimeBootstrapConfigPath}`,
      ].join('\n'),
    );
  }

  const {
    artifactPath,
    source,
    brandCachedArtifactPath,
    sharedCachedArtifactPath,
  } = await resolveRuntimeArtifactSource({
    config: rawConfig,
    brandId,
    targetTriple,
    packagingPaths,
  });
  await verifyRuntimeArtifactFileSha256(artifactPath, artifactSha256);
  await persistRuntimeArtifactCopy(artifactPath, brandCachedArtifactPath);
  await persistRuntimeArtifactCopy(artifactPath, sharedCachedArtifactPath);
  await fs.rm(stagedRuntimeDir, { recursive: true, force: true });
  await fs.rm(stagedRuntimeArchiveDir, { recursive: true, force: true });
  await fs.mkdir(stagedRuntimeArchiveDir, { recursive: true });
  const stagedArchivePath = path.join(stagedRuntimeArchiveDir, path.basename(artifactPath));
  await fs.rm(stagedArchivePath, { force: true });
  await fs.copyFile(artifactPath, stagedArchivePath);
  await signBundledRuntimeArchiveForMacos({
    archivePath: stagedArchivePath,
    artifactFormat,
    targetTriple,
    env,
  });

  process.stdout.write(
    `[desktop-package] bundled runtime archive prepared for ${targetTriple || 'host'} from ${source}: ${stagedArchivePath}\n`,
  );
}

async function applyRuntimeBootstrapOverlay(env, brandProfile, channel, targetTriple) {
  const originalExists = await pathExists(runtimeBootstrapConfigPath);
  const originalRaw = originalExists ? await fs.readFile(runtimeBootstrapConfigPath, 'utf8') : null;
  const originalConfig = originalRaw ? JSON.parse(originalRaw) : {};
  const nextConfig = applyRuntimeBootstrapEnvOverrides(
    applyBrandRuntimeBootstrapOverrides(originalConfig, brandProfile, channel, targetTriple),
    env,
    targetTriple,
  );
  const nextRaw = `${JSON.stringify(nextConfig, null, 2)}\n`;
  if (nextRaw !== originalRaw) {
    await writeRuntimeBootstrapConfig(nextConfig);
  }

  return async () => {
    if (originalRaw === null) {
      await fs.rm(runtimeBootstrapConfigPath, { force: true });
      return;
    }
    await fs.writeFile(runtimeBootstrapConfigPath, originalRaw, 'utf8');
  };
}

async function assertPackagedRuntimeConfig(env, targetTriple) {
  if (await runtimeLayoutLooksComplete(bundledRuntimeDir, targetTriple)) {
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

  const raw = resolveRuntimeBootstrapConfigForTarget(
    applyRuntimeBootstrapEnvOverrides(await readRuntimeBootstrapConfig(), env, targetTriple),
    targetTriple,
  );
  const version = trimString(raw.version);
  const artifactUrl = trimString(raw.artifact_url);
  const artifactSha256 = trimString(raw.artifact_sha256).toLowerCase();
  const artifactFormat = trimString(raw.artifact_format);

  if (!version || !artifactUrl) {
    throw new Error(
      [
        'desktop packaging aborted: invalid OpenClaw runtime bootstrap config.',
        `Expected non-empty version and artifact_url for target ${targetTriple || 'current-host'} in ${runtimeBootstrapConfigPath}`,
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

  const expectedTargetTriple = inferRuntimeTargetTriple(targetTriple);
  const artifactTargetTriple = detectRuntimeArtifactTargetTriple(artifactUrl);
  if (expectedTargetTriple && artifactTargetTriple && artifactTargetTriple !== expectedTargetTriple) {
    throw new Error(
      [
        'desktop packaging aborted: OpenClaw runtime artifact target does not match the current package target.',
        `Expected target: ${expectedTargetTriple}`,
        `Configured artifact: ${artifactUrl}`,
        `Detected target in artifact URL: ${artifactTargetTriple}`,
        'Run `pnpm build:openclaw-runtime` for that target, publish the matching runtime, or pass matching ICLAW_OPENCLAW_RUNTIME_* overrides for this package build.',
      ].join('\n'),
    );
  }

  const bundledArchivePath = path.join(
    bundledRuntimeArchiveDir,
    runtimeArtifactFileName({
      version,
      targetTriple: expectedTargetTriple || targetTriple,
      artifactFormat: normalizeRuntimeArtifactFormat(artifactFormat) || 'tar.gz',
      artifactUrl,
    }),
  );
  if (await pathExists(bundledArchivePath)) {
    process.stdout.write(
      `[desktop-package] found bundled runtime archive for package target: ${bundledArchivePath}\n`,
    );
    return;
  }

  if (!/^(1|true|yes)$/i.test(String(env.ICLAW_SKIP_REMOTE_RUNTIME_HASH_VERIFY || '').trim())) {
    await verifyRemoteRuntimeArtifactSha256(artifactUrl, artifactSha256);
  }
}

async function main() {
  const { brandId, target, forwardedArgs } = parseArgs(process.argv.slice(2));
  const runtimeTargetTriple = inferRuntimeTargetTriple(target);
  const channel = resolvePackagingChannelFromEnv(process.env);
  const brandContext = await loadDesktopBrandContext({ rootDir, brandId, envName: channel });
  const brandProfile = brandContext.profile;
  const appVersion = trimString(brandContext.appVersion);
  const packagingPaths = buildPackagingWorkspacePaths({ rootDir, brandId, channel, target });
  const snapshotKey = [
    'desktop-package-build',
    brandId,
    channel || 'adhoc',
    getArchLabelForTarget(target) || 'host',
  ].join('-');
  const packagingOverlayEnv = resolveSigningOverlayEnv(rootDir);
  const packagingSourceEnv = resolvePackagingSourceEnv(rootDir);
  const signingProfile = await resolveOemSigningProfile({ rootDir, brandId });
  const channelSigningEnv = buildChannelSigningEnv(signingProfile.env, channel);
  const useManualMacosNotarization = shouldUseManualMacosNotarization(channel, channelSigningEnv);
  const env = {
    ...process.env,
    ...packagingOverlayEnv,
    ...packagingSourceEnv,
    ...channelSigningEnv,
    APP_NAME: brandId,
    ICLAW_PORTAL_APP_NAME: brandId,
    ICLAW_BRAND: brandId,
    ICLAW_USE_PACKAGING_SOURCE_ENV: '1',
    ICLAW_ENV_NAME: channel || process.env.ICLAW_ENV_NAME || process.env.NODE_ENV || '',
    ICLAW_OPENCLAW_RESOURCES_SOURCE_DIR: packagingPaths.resourcesSourceDir,
    ICLAW_RUNTIME_BUNDLE_MODE: 'archive',
  };
  const tauriBuildEnv = { ...env };
  if (useManualMacosNotarization) {
    delete tauriBuildEnv.APPLE_ID;
    delete tauriBuildEnv.APPLE_PASSWORD;
    delete tauriBuildEnv.APPLE_TEAM_ID;
  }
  const { tauriBundle, packageDmg } = platformBundleTarget();
  const pnpm = pnpmCommand();
  const fastPackageMode = !/^(0|false|no)$/i.test(String(process.env.ICLAW_FAST_PACKAGE || '1').trim());
  const keepPackagingCache = !/^(0|false|no)$/i.test(String(process.env.ICLAW_KEEP_PACKAGING_CACHE || '1').trim());
  let restoreRuntimeBootstrapConfig = async () => {};
  let tempTauriConfigPath = '';

  if (fastPackageMode) {
    env.ICLAW_DMG_ZLIB_LEVEL ||= '1';
    env.ICLAW_DMG_SKIP_LAYOUT ||= '1';
    if (process.platform === 'darwin') {
      env.CARGO_INCREMENTAL ||= '1';
      env.CARGO_PROFILE_RELEASE_INCREMENTAL ||= 'true';
      env.CARGO_PROFILE_RELEASE_CODEGEN_UNITS ||= '256';
    }
  }

  run(process.execPath, [brandStateScriptPath, 'snapshot', snapshotKey], { env });
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
    const activeStage = await readActiveDesktopBrandStage({ rootDir, brandId });
    const stagePaths = activeStage.paths;
    await assertGeneratedBrandArtifacts({ brandContext, appVersion, stagePaths });
    await preparePackagingResourcesSource(packagingPaths.resourcesSourceDir);
    syncLocalAppRuntime({ pnpm, env, brandId, packagingPaths });
    await syncBundledBaselineSkills({ pnpm, env, brandId, packagingPaths });
    restoreRuntimeBootstrapConfig = await applyRuntimeBootstrapOverlay(env, brandProfile, channel, runtimeTargetTriple);
    await prepareBundledRuntime({
      env,
      brandId,
      brandProfile,
      channel,
      targetTriple: runtimeTargetTriple,
      packagingPaths,
    });
    await scrubPackagingResourceTree(packagingPaths.resourcesSourceDir);
    run(process.execPath, [syncResourcesScriptPath], { env });
    await scrubPackagingResourceTree(path.join(tauriDir, 'resources'));
    await assertPackagedRuntimeConfig(env, runtimeTargetTriple);
    tempTauriConfigPath = await writeTempTauriConfig({ stagePaths });

    run(pnpm.command, [...pnpm.args, '--dir', desktopDir, 'build'], { env, shell: pnpm.shell });
    const tauri = tauriBinaryPath();
    run(tauri.command, ['build', '--config', tempTauriConfigPath, '--bundles', tauriBundle, ...forwardedArgs], {
      cwd: desktopDir,
      env: {
        ...tauriBuildEnv,
        ICLAW_BRAND_JSON_PATH: stagePaths.brandGeneratedJsonPath,
      },
      shell: tauri.shell,
    });
    await rebuildWindowsNsisInstaller({ target });
    await notarizeMacosAppBundleManually({ target, channel, env, stagePaths });
    await validateMacosProdBundle({ target, channel, stagePaths });

    if (packageDmg) {
      run('bash', [packageDmgScriptPath, ...forwardedArgs], {
        env: {
          ...env,
          ICLAW_TAURI_STAGE_DIR: stagePaths.tauriRoot,
        },
      });
    }
    await normalizeBundledArtifactNames({ target, brandProfile, channel, appVersion });
  } finally {
    if (tempTauriConfigPath) {
      await fs.rm(tempTauriConfigPath, { force: true });
    }
    await restoreRuntimeBootstrapConfig();
    if (!keepPackagingCache) {
      await fs.rm(packagingPaths.workspaceRoot, { recursive: true, force: true });
    }
    run(process.execPath, [brandStateScriptPath, 'restore', snapshotKey], { env });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
