import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { loadBrandProfile, resolveBrandId } from './brand-profile.mjs';
import { readOpenclawSourceVersion, resolveOpenclawSourceDir } from './openclaw-source.mjs';
import {
  buildBundleRoot,
  normalizePackagingChannel,
  resolvePackagingChannelFromEnv,
  resolvePackagingTargetInfo,
  trimString as trimPackagingString,
} from './desktop-packaging.mjs';

export function trimString(value) {
  return trimPackagingString(value);
}

export function normalizeReleaseVersion(value) {
  return trimString(value).replace(/\+[^.]+/g, '');
}

export function toCheckResult(status, summary, details = {}) {
  return { status, summary, ...details };
}

export function summarizeStatuses(results) {
  const statuses = Object.values(results).map((item) => item?.status || 'unknown');
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  if (statuses.every((item) => item === 'pass' || item === 'skipped')) return 'pass';
  return 'warn';
}

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

export async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
}

export async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

export function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
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

export function formatBytes(value) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let current = Number(value) || 0;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export async function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(await fs.readFile(filePath));
  return hash.digest('hex');
}

export async function collectFileStats(filePath) {
  const stat = await fs.stat(filePath);
  return {
    filePath,
    fileName: path.basename(filePath),
    bytes: stat.size,
    prettyBytes: formatBytes(stat.size),
    sha256: await sha256File(filePath),
    mtime: stat.mtime.toISOString(),
  };
}

export async function collectDirectoryFootprint(rootPath) {
  const summary = {
    rootPath,
    exists: false,
    totalBytes: 0,
    totalFiles: 0,
    topFiles: [],
  };
  if (!(await pathExists(rootPath))) {
    return summary;
  }
  summary.exists = true;
  const files = [];
  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(nextPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = await fs.stat(nextPath);
      summary.totalBytes += stat.size;
      summary.totalFiles += 1;
      files.push({
        path: nextPath,
        relativePath: path.relative(rootPath, nextPath),
        bytes: stat.size,
      });
    }
  }
  await walk(rootPath);
  files.sort((left, right) => right.bytes - left.bytes);
  summary.topFiles = files.slice(0, 20).map((item) => ({
    ...item,
    prettyBytes: formatBytes(item.bytes),
  }));
  summary.prettyBytes = formatBytes(summary.totalBytes);
  return summary;
}

export function resolveDesktopBundlePaths(rootDir, targetTriple = '') {
  const desktopDir = path.join(rootDir, 'apps', 'desktop');
  const tauriDir = path.join(desktopDir, 'src-tauri');
  const bundleRoot = buildBundleRoot({ tauriDir, target: targetTriple, profile: 'release' });
  return {
    desktopDir,
    tauriDir,
    bundleRoot,
    runtimeBootstrapConfigPath: path.join(tauriDir, 'resources', 'config', 'openclaw-runtime.json'),
    bundledRuntimeDir: path.join(tauriDir, 'resources', 'openclaw-runtime'),
    releaseDir: path.join(rootDir, 'dist', 'releases'),
    packageJsonPath: path.join(rootDir, 'package.json'),
    desktopPackageJsonPath: path.join(desktopDir, 'package.json'),
    desktopBrandGeneratedPath: path.join(desktopDir, 'src', 'app', 'lib', 'brand.generated.ts'),
    tauriBrandGeneratedPath: path.join(tauriDir, 'brand.generated.json'),
    tauriGeneratedConfigPath: path.join(tauriDir, 'tauri.generated.conf.json'),
  };
}

export async function resolveReleaseContext(rootDir, options = {}) {
  const packageJson = await readJson(path.join(rootDir, 'package.json'));
  const brandId = resolveBrandId(options.brandId);
  const channel = normalizePackagingChannel(options.channel) || resolvePackagingChannelFromEnv(process.env) || 'prod';
  const targetTriple = trimString(options.target) || 'x86_64-pc-windows-msvc';
  const targetInfo = resolvePackagingTargetInfo(targetTriple);
  const { profile } = await loadBrandProfile({ rootDir, brandId, envName: channel });
  const packageVersion = trimString(packageJson.version);
  const releaseVersion =
    normalizeReleaseVersion(options.releaseVersion) ||
    trimString(packageJson.releaseVersion) ||
    normalizeReleaseVersion(packageVersion);
  return {
    rootDir,
    brandId,
    channel,
    targetTriple,
    targetInfo,
    profile,
    packageVersion,
    releaseVersion,
    artifactBaseName:
      trimString(profile?.distribution?.artifactBaseName) ||
      trimString(profile?.productName) ||
      brandId,
    productName: trimString(profile?.productName) || brandId,
  };
}

export async function findReleaseArtifacts(context) {
  const paths = resolveDesktopBundlePaths(context.rootDir, context.targetTriple);
  const entries = await fs.readdir(paths.releaseDir, { withFileTypes: true }).catch(() => []);
  const installerExt = context.targetInfo?.platform === 'windows' ? '.exe' : '.dmg';
  const updaterExt = context.targetInfo?.platform === 'windows' ? '.nsis.zip' : '.app.tar.gz';
  const prefix = `${context.artifactBaseName}_${context.releaseVersion}_${context.targetInfo?.arch || ''}_${context.channel}`;
  const result = {
    releaseDir: paths.releaseDir,
    installer: null,
    updater: null,
    signature: null,
    manifests: [],
    allMatches: [],
  };
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fileName = entry.name;
    const fullPath = path.join(paths.releaseDir, fileName);
    if (!fileName.includes(prefix)) continue;
    result.allMatches.push(fullPath);
    if (fileName.endsWith(installerExt)) {
      result.installer = fullPath;
    } else if (fileName.endsWith(updaterExt)) {
      result.updater = fullPath;
    } else if (fileName.endsWith(`${updaterExt}.sig`)) {
      result.signature = fullPath;
    }
  }
  for (const manifestName of [`latest-${context.channel}.json`, `latest-${context.channel}-${context.brandId}.json`]) {
    const manifestPath = path.join(paths.releaseDir, manifestName);
    if (await pathExists(manifestPath)) {
      result.manifests.push(manifestPath);
    }
  }
  return result;
}

export async function collectOpenclawDrift(context) {
  const paths = resolveDesktopBundlePaths(context.rootDir, context.targetTriple);
  const sourceDir = resolveOpenclawSourceDir(context.rootDir, process.env);
  const sourceVersion = readOpenclawSourceVersion(sourceDir);
  const runtimeConfig = await readJsonIfExists(paths.runtimeBootstrapConfigPath);
  const runtimeVersion = trimString(runtimeConfig?.version);
  if (!sourceDir || !sourceVersion || !runtimeVersion) {
    return toCheckResult('warn', 'OpenClaw drift check incomplete', {
      sourceDir,
      sourceVersion,
      runtimeVersion,
      reason: 'sourceDir or runtime bootstrap version missing',
    });
  }
  if (sourceVersion !== runtimeVersion) {
    return toCheckResult('fail', 'OpenClaw UI/runtime version drift detected', {
      sourceDir,
      sourceVersion,
      runtimeVersion,
      runtimeBootstrapConfigPath: paths.runtimeBootstrapConfigPath,
    });
  }
  return toCheckResult('pass', 'OpenClaw UI/runtime versions are aligned', {
    sourceDir,
    version: sourceVersion,
  });
}

function extractTsConstObject(raw, exportName) {
  const pattern = new RegExp(`export const ${exportName} = (\\{[\\s\\S]*?\\}) as const;`);
  const match = raw.match(pattern);
  if (!match) return null;
  return JSON.parse(match[1]);
}

export async function collectOemConsistency(context) {
  const paths = resolveDesktopBundlePaths(context.rootDir, context.targetTriple);
  const tauriBrand = await readJsonIfExists(paths.tauriBrandGeneratedPath);
  const tauriConfig = await readJsonIfExists(paths.tauriGeneratedConfigPath);
  const desktopBrandRaw = await readTextIfExists(paths.desktopBrandGeneratedPath);
  const desktopBrand = desktopBrandRaw ? extractTsConstObject(desktopBrandRaw, 'BRAND') : null;
  const checks = [
    ['brandId', context.brandId, trimString(tauriBrand?.brandId), trimString(desktopBrand?.brandId)],
    ['bundleIdentifier', trimString(context.profile?.bundleIdentifier), trimString(tauriBrand?.bundleIdentifier), trimString(tauriConfig?.identifier)],
    ['authService', trimString(context.profile?.authService), trimString(tauriBrand?.authService), trimString(desktopBrand?.authService)],
    ['productName', trimString(context.profile?.productName), trimString(tauriBrand?.productName), trimString(tauriConfig?.productName)],
    ['artifactBaseName', context.artifactBaseName, trimString(desktopBrand?.distribution?.artifactBaseName), trimString(tauriBrand?.artifactBaseName)],
  ];
  const mismatches = checks
    .map(([key, expected, ...values]) => ({
      key,
      expected,
      values,
    }))
    .filter((item) => {
      const normalizedExpected = trimString(item.expected);
      const normalizedValues = item.values.map((value) => trimString(value));
      return normalizedValues.some((value) => normalizedExpected && value && value !== normalizedExpected);
    });
  if (mismatches.length > 0) {
    return toCheckResult('fail', 'OEM brand consistency check failed', {
      mismatches,
      files: {
        tauriBrandGeneratedPath: paths.tauriBrandGeneratedPath,
        tauriGeneratedConfigPath: paths.tauriGeneratedConfigPath,
        desktopBrandGeneratedPath: paths.desktopBrandGeneratedPath,
      },
    });
  }
  return toCheckResult('pass', 'OEM brand identifiers are consistent', {
    brandId: context.brandId,
    bundleIdentifier: trimString(context.profile?.bundleIdentifier),
    productName: trimString(context.profile?.productName),
  });
}

export async function collectBundleVerification(context) {
  const artifacts = await findReleaseArtifacts(context);
  const paths = resolveDesktopBundlePaths(context.rootDir, context.targetTriple);
  const runtimeBootstrap = await readJsonIfExists(paths.runtimeBootstrapConfigPath);
  const runtimeFootprint = await collectDirectoryFootprint(paths.bundledRuntimeDir);
  const errors = [];
  if (!artifacts.installer) {
    errors.push('missing installer artifact in dist/releases');
  }
  if (!runtimeBootstrap?.version) {
    errors.push('missing runtime bootstrap config version');
  }
  if (!runtimeFootprint.exists || runtimeFootprint.totalFiles === 0) {
    errors.push('bundled runtime directory is missing or empty');
  }
  const details = {
    artifacts,
    runtimeBootstrapVersion: trimString(runtimeBootstrap?.version),
    runtimeFootprint,
  };
  if (errors.length > 0) {
    return toCheckResult('fail', 'Desktop bundle verification failed', {
      errors,
      ...details,
    });
  }
  return toCheckResult('pass', 'Desktop bundle artifacts and runtime payload look complete', details);
}

export async function collectRuntimeCache(context) {
  const cacheRoot = path.join(context.rootDir, '.artifacts', 'openclaw-runtime');
  const targetDirs = [
    path.join(cacheRoot, context.brandId, context.targetTriple),
    path.join(cacheRoot, '_shared', context.targetTriple),
  ];
  const entries = [];
  for (const targetDir of targetDirs) {
    if (!(await pathExists(targetDir))) continue;
    const listing = await fs.readdir(targetDir, { withFileTypes: true });
    for (const entry of listing) {
      if (!entry.isDirectory()) continue;
      entries.push(path.join(targetDir, entry.name));
    }
  }
  const matched = entries.filter((item) => item.includes(context.releaseVersion) || item.includes(context.packageVersion.split('+', 1)[0]));
  if (matched.length === 0) {
    return toCheckResult('warn', 'No local runtime cache matched current release', {
      cacheRoot,
      scannedDirectories: entries,
    });
  }
  return toCheckResult('pass', 'Local runtime cache is available', {
    cacheRoot,
    matchedDirectories: matched,
  });
}

export async function collectPackageSize(context) {
  const artifacts = await findReleaseArtifacts(context);
  const paths = resolveDesktopBundlePaths(context.rootDir, context.targetTriple);
  const installerStats = artifacts.installer ? await collectFileStats(artifacts.installer) : null;
  const updaterStats = artifacts.updater ? await collectFileStats(artifacts.updater) : null;
  const runtimeFootprint = await collectDirectoryFootprint(paths.bundledRuntimeDir);
  const topLevel = await collectDirectoryFootprint(path.join(context.rootDir, 'apps', 'desktop', 'public'));
  const summary = {
    installer: installerStats,
    updater: updaterStats,
    bundledRuntime: runtimeFootprint,
    publicAssets: topLevel,
  };
  if (!installerStats) {
    return toCheckResult('warn', 'Installer size unavailable because no installer artifact matched', summary);
  }
  return toCheckResult('pass', 'Package size report generated', summary);
}

function extractTimestampPrefix(line) {
  const match = line.match(/^\[(\d+)\]/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export async function collectInstallMetrics(context) {
  const bundleIdentifier = trimString(context.profile?.bundleIdentifier);
  const bootstrapLogPath = bundleIdentifier
    ? path.join(os.homedir(), 'AppData', 'Roaming', bundleIdentifier, 'openclaw', 'logs', 'desktop-bootstrap.log')
    : '';
  const bootstrapRaw = bootstrapLogPath ? await readTextIfExists(bootstrapLogPath) : '';
  if (!bootstrapRaw) {
    return toCheckResult('warn', 'No desktop bootstrap log found for metrics extraction', {
      bootstrapLogPath,
    });
  }
  const lines = bootstrapRaw.split(/\r?\n/).filter(Boolean);
  const markers = {
    syncSnapshotBegin: lines.find((line) => line.includes('sync_oem_runtime_snapshot: begin')) || null,
    runtimeSpawned: lines.find((line) => line.includes('start_sidecar: spawned runtime')) || null,
    runtimeChildRunning: lines.find((line) => line.includes('start_sidecar: child running')) || null,
    diagnosticsSuccess: lines.find((line) => line.includes('load_startup_diagnostics: success')) || null,
    faultReportPrepare: lines.find((line) => line.includes('desktop_fault_report:prepare begin')) || null,
  };
  const timestamps = Object.fromEntries(
    Object.entries(markers).map(([key, line]) => [key, line ? extractTimestampPrefix(line) : null]),
  );
  const firstTs = extractTimestampPrefix(lines[0]);
  const lastTs = extractTimestampPrefix(lines[lines.length - 1]);
  const durations = {};
  if (firstTs && timestamps.runtimeChildRunning) {
    durations.runtimeStartMs = timestamps.runtimeChildRunning - firstTs;
  }
  if (timestamps.syncSnapshotBegin && timestamps.runtimeChildRunning) {
    durations.snapshotToRuntimeMs = timestamps.runtimeChildRunning - timestamps.syncSnapshotBegin;
  }
  if (timestamps.runtimeChildRunning && timestamps.diagnosticsSuccess) {
    durations.runtimeToDiagnosticsMs = timestamps.diagnosticsSuccess - timestamps.runtimeChildRunning;
  }
  if (firstTs && lastTs) {
    durations.logSpanMs = lastTs - firstTs;
  }
  return toCheckResult('pass', 'Install/startup metrics extracted from desktop bootstrap log', {
    bootstrapLogPath,
    markers,
    durations,
    lineCount: lines.length,
  });
}

export function runPowerShellJson(script) {
  const result = runCapture('powershell', ['-NoProfile', '-Command', script], {
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || 'powershell failed');
  }
  const raw = trimString(result.stdout);
  return raw ? JSON.parse(raw) : null;
}

export async function collectWindowsEnvPrecheck() {
  if (process.platform !== 'win32') {
    return toCheckResult('skipped', 'Windows environment precheck skipped on non-Windows host');
  }
  try {
    const payload = runPowerShellJson(`
      $webviewRegPath = 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
      $webviewVersion = ''
      if (Test-Path $webviewRegPath) {
        $webviewVersion = [string]((Get-ItemProperty -Path $webviewRegPath -Name pv -ErrorAction SilentlyContinue).pv)
      }
      $longPaths = (Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem' -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
      $drive = Get-PSDrive -Name C -ErrorAction SilentlyContinue
      [pscustomobject]@{
        osCaption = [string](Get-CimInstance Win32_OperatingSystem).Caption
        osVersion = [string](Get-CimInstance Win32_OperatingSystem).Version
        webview2Version = $webviewVersion
        longPathsEnabled = [bool]($longPaths -eq 1)
        cDriveFreeBytes = if ($drive) { [int64]$drive.Free } else { 0 }
      } | ConvertTo-Json -Depth 4
    `);
    const warnings = [];
    if (!trimString(payload?.webview2Version)) {
      warnings.push('WebView2 runtime not detected in registry');
    }
    if (!(payload?.longPathsEnabled === true)) {
      warnings.push('LongPathsEnabled is off');
    }
    if (Number(payload?.cDriveFreeBytes || 0) < 5 * 1024 * 1024 * 1024) {
      warnings.push('C: free space is below 5 GB');
    }
    return toCheckResult(warnings.length > 0 ? 'warn' : 'pass', 'Windows environment precheck completed', {
      ...payload,
      cDriveFreePretty: formatBytes(Number(payload?.cDriveFreeBytes || 0)),
      warnings,
    });
  } catch (error) {
    return toCheckResult('warn', 'Windows environment precheck failed to execute cleanly', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function collectIconChain(context) {
  const controlPlaneAssetDir = path.join(context.rootDir, 'services', 'control-plane', 'assets', context.brandId, 'tauri-icons');
  const desktopGeneratedIconDir = path.join(context.rootDir, 'apps', 'desktop', 'src-tauri', 'icons-generated');
  const publicBrandDir = path.join(context.rootDir, 'apps', 'desktop', 'public', 'brand');
  const iconPaths = [
    path.join(controlPlaneAssetDir, 'icon.ico'),
    path.join(desktopGeneratedIconDir, 'icon.ico'),
    path.join(publicBrandDir, 'favicon.png'),
  ];
  const files = [];
  for (const filePath of iconPaths) {
    if (await pathExists(filePath)) {
      files.push(await collectFileStats(filePath));
    }
  }
  let faviconCornerAlpha = null;
  const faviconPath = path.join(publicBrandDir, 'favicon.png');
  if (process.platform === 'win32' && (await pathExists(faviconPath))) {
    try {
      faviconCornerAlpha = runPowerShellJson(`
        Add-Type -AssemblyName System.Drawing
        $img = [System.Drawing.Bitmap]::FromFile('${faviconPath.replace(/\\/g, '\\\\')}')
        $points = @(@(0,0), @(1,1), @(5,5), @(10,10))
        $values = @()
        foreach ($p in $points) {
          $pixel = $img.GetPixel($p[0], $p[1])
          $values += [pscustomobject]@{ x=$p[0]; y=$p[1]; a=$pixel.A }
        }
        $img.Dispose()
        $values | ConvertTo-Json -Depth 4
      `);
    } catch {}
  }
  const warnings = Array.isArray(faviconCornerAlpha) && faviconCornerAlpha.some((item) => Number(item?.a) > 0)
    ? ['desktop public favicon corners are opaque; UI clipping is still required to keep rounded appearance']
    : [];
  return toCheckResult(warnings.length > 0 ? 'warn' : 'pass', 'Icon chain report generated', {
    iconFiles: files,
    faviconCornerAlpha,
    warnings,
  });
}

export async function collectRuntimeSnapshot(context) {
  const bundleIdentifier = trimString(context.profile?.bundleIdentifier);
  const snapshotPath = bundleIdentifier
    ? path.join(os.homedir(), 'AppData', 'Roaming', bundleIdentifier, 'openclaw', 'config', 'oem-runtime-snapshot.json')
    : '';
  const runtimeConfigPath = path.join(os.homedir(), '.openclaw', 'apps', context.brandId, 'openclaw.json');
  const snapshot = snapshotPath ? await readJsonIfExists(snapshotPath) : null;
  const runtimeConfig = await readJsonIfExists(runtimeConfigPath);
  const providerModels =
    runtimeConfig?.models?.providers && typeof runtimeConfig.models.providers === 'object'
      ? Object.values(runtimeConfig.models.providers)
          .flatMap((provider) => Array.isArray(provider?.models) ? provider.models : [])
      : [];
  const mismatches = [];
  if (trimString(snapshot?.brandId) && trimString(snapshot?.brandId) !== context.brandId) {
    mismatches.push(`snapshot brandId=${trimString(snapshot?.brandId)} expected=${context.brandId}`);
  }
  if (trimString(snapshot?.config?.bundleIdentifier) && trimString(snapshot?.config?.bundleIdentifier) !== trimString(context.profile?.bundleIdentifier)) {
    mismatches.push('snapshot bundleIdentifier mismatched current brand profile');
  }
  const status = mismatches.length > 0 || providerModels.length === 0 ? 'warn' : 'pass';
  return toCheckResult(status, 'Runtime snapshot inspection completed', {
    snapshotPath,
    runtimeConfigPath,
    snapshotBrandId: trimString(snapshot?.brandId),
    snapshotBundleIdentifier: trimString(snapshot?.config?.bundleIdentifier),
    runtimeModelCount: providerModels.length,
    mismatches,
  });
}

export async function collectPublishFlow(context) {
  const scripts = [
    'scripts/release-preflight.mjs',
    'scripts/build-desktop-package.mjs',
    'scripts/publish-downloads.sh',
    'scripts/publish-desktop-release.mjs',
  ];
  const missing = [];
  for (const relativePath of scripts) {
    if (!(await pathExists(path.join(context.rootDir, relativePath)))) {
      missing.push(relativePath);
    }
  }
  const commands = {
    preflight: `node scripts/release-guard.mjs --brand ${context.brandId} --channel ${context.channel} --target ${context.targetTriple} --release-version ${context.releaseVersion} --write-version-record`,
    build: `node scripts/run-with-env.mjs ${context.channel} node scripts/build-desktop-package.mjs --brand ${context.brandId} --target ${context.targetTriple}`,
    publishDownloads: `APP_NAME=${context.brandId} ICLAW_BRAND=${context.brandId} bash scripts/publish-downloads.sh ${context.channel}`,
    publishControlPlane: `node scripts/run-with-env.mjs ${context.channel} node scripts/publish-desktop-release.mjs --brand ${context.brandId} --channel ${context.channel} --version ${context.packageVersion}`,
  };
  if (missing.length > 0) {
    return toCheckResult('fail', 'Publish flow scripts are incomplete', {
      missing,
      commands,
    });
  }
  return toCheckResult('pass', 'Publish flow commands resolved', { commands });
}

export async function collectSmokeTestPlan(context) {
  const requiredScripts = [
    'scripts/self-test-desktop-update.mjs',
    'tests/install/first-run-setup-gate.test.mjs',
  ];
  const missing = [];
  for (const relativePath of requiredScripts) {
    if (!(await pathExists(path.join(context.rootDir, relativePath)))) {
      missing.push(relativePath);
    }
  }
  const commands = [
    'node scripts/self-test-desktop-update.mjs',
    'node --experimental-strip-types --test tests/install/first-run-setup-gate.test.mjs',
  ];
  if (missing.length > 0) {
    return toCheckResult('warn', 'Smoke test plan is only partially available', {
      missing,
      commands,
    });
  }
  return toCheckResult('pass', 'Smoke test plan is available', {
    commands,
  });
}

export async function ensureVersionRecordSkeleton(context) {
  const versionRecordPath = path.join(context.rootDir, 'docs', 'version_record', `${context.releaseVersion}.md`);
  const testReportPath = path.join(context.rootDir, 'docs', 'version_record', 'test_report', `${context.releaseVersion}.md`);
  return {
    versionRecordPath,
    testReportPath,
    versionRecordExists: await pathExists(versionRecordPath),
    testReportExists: await pathExists(testReportPath),
  };
}
