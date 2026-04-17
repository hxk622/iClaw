import path from 'node:path';

export const supportedDesktopReleaseTargets = [
  { platform: 'windows', publicPlatform: 'windows', arch: 'x64', installerExt: 'exe', updaterExt: 'nsis.zip' },
  { platform: 'windows', publicPlatform: 'windows', arch: 'aarch64', installerExt: 'exe', updaterExt: 'nsis.zip' },
  { platform: 'darwin', publicPlatform: 'mac', arch: 'x64', installerExt: 'dmg', updaterExt: 'app.tar.gz' },
  { platform: 'darwin', publicPlatform: 'mac', arch: 'aarch64', installerExt: 'dmg', updaterExt: 'app.tar.gz' },
];

export function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isTruthyEnv(value) {
  return /^(1|true|yes)$/i.test(trimString(value));
}

export function nativeUpdaterExpected(env = process.env) {
  return isTruthyEnv(env.ICLAW_DESKTOP_ENABLE_NATIVE_UPDATER);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitVersion(version) {
  const normalized = trimString(version);
  const [baseVersion] = normalized.split('+', 1);
  return {
    fullVersion: normalized,
    baseVersion: trimString(baseVersion),
  };
}

function isReleaseForAppVersion(releaseVersion, appVersion) {
  const { fullVersion, baseVersion } = splitVersion(appVersion);
  return (
    releaseVersion === fullVersion ||
    releaseVersion.startsWith(`${fullVersion}.`) ||
    releaseVersion === baseVersion ||
    releaseVersion.startsWith(`${baseVersion}.`)
  );
}

function compareByName(a, b) {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

export function resolveDesktopReleaseTargetArtifacts({
  releaseDir,
  artifactBaseName,
  channel,
  appVersion,
  target,
  files,
}) {
  const installerPattern = new RegExp(
    `^${escapeRegExp(artifactBaseName)}_(?<releaseVersion>.+)_${escapeRegExp(target.arch)}_${escapeRegExp(channel)}\\.${escapeRegExp(target.installerExt)}$`,
  );
  const installerMatches = files
    .map((fileName) => {
      const match = fileName.match(installerPattern);
      if (!match?.groups?.releaseVersion) return null;
      if (!isReleaseForAppVersion(match.groups.releaseVersion, appVersion)) return null;
      return {
        fileName,
        releaseVersion: match.groups.releaseVersion,
      };
    })
    .filter(Boolean)
    .sort((left, right) => compareByName(left.fileName, right.fileName));

  const latestInstaller = installerMatches.at(-1);
  if (!latestInstaller) return null;

  const updaterName = `${artifactBaseName}_${latestInstaller.releaseVersion}_${target.arch}_${channel}.${target.updaterExt}`;
  const signatureName = `${updaterName}.sig`;
  const hasUpdater = files.includes(updaterName);
  const hasSignature = files.includes(signatureName);

  return {
    platform: target.platform,
    publicPlatform: target.publicPlatform,
    arch: target.arch,
    releaseVersion: latestInstaller.releaseVersion,
    installerName: latestInstaller.fileName,
    installerPath: path.join(releaseDir, latestInstaller.fileName),
    updaterName,
    signatureName,
    updaterPath: hasUpdater ? path.join(releaseDir, updaterName) : null,
    signaturePath: hasSignature ? path.join(releaseDir, signatureName) : null,
    hasUpdater,
    hasSignature,
  };
}

export function classifyDesktopReleaseUpdaterState(artifacts, { updaterExpected }) {
  if (!artifacts) {
    return {
      status: 'missing-installer',
      message: 'installer is missing',
    };
  }

  if (artifacts.hasUpdater && artifacts.hasSignature) {
    return {
      status: 'complete',
      message: 'signed updater artifacts are complete',
    };
  }

  if (artifacts.hasUpdater && !artifacts.hasSignature) {
    return {
      status: 'missing-signature',
      message: `signature file is missing for ${artifacts.updaterName}`,
    };
  }

  if (!artifacts.hasUpdater && artifacts.hasSignature) {
    return {
      status: 'missing-updater',
      message: `updater archive is missing for ${artifacts.signatureName}`,
    };
  }

  if (updaterExpected) {
    return {
      status: 'missing-updater-and-signature',
      message: 'signed updater artifacts are required but both updater archive and signature are missing',
    };
  }

  return {
    status: 'not-requested',
    message: 'native updater artifacts are not required for this release',
  };
}
