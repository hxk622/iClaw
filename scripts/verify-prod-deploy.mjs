#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {execFileSync} from 'node:child_process';

import {loadBrandProfile, resolveBrandId} from './lib/brand-profile.mjs';

const rootDir = process.cwd();
const defaultChromeBin =
  process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : '/usr/bin/google-chrome';

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    component: '',
    brandId: '',
    channel: trimString(process.env.ICLAW_ENV_NAME || process.env.NODE_ENV || 'prod') || 'prod',
    requireChrome: false,
    skipLocalCompare: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--component') {
      options.component = trimString(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg.startsWith('--component=')) {
      options.component = trimString(arg.slice('--component='.length));
      continue;
    }
    if (arg === '--brand') {
      options.brandId = trimString(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg.startsWith('--brand=')) {
      options.brandId = trimString(arg.slice('--brand='.length));
      continue;
    }
    if (arg === '--channel') {
      options.channel = trimString(argv[index + 1] || '') || options.channel;
      index += 1;
      continue;
    }
    if (arg.startsWith('--channel=')) {
      options.channel = trimString(arg.slice('--channel='.length)) || options.channel;
      continue;
    }
    if (arg === '--require-chrome') {
      options.requireChrome = true;
      continue;
    }
    if (arg === '--skip-local-compare') {
      options.skipLocalCompare = true;
      continue;
    }
  }

  return options;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function readLocalBuildInfo(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  return readJson(filePath).catch(() => null);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
    },
  });
  if (!response.ok) {
    fail(`request failed ${response.status} ${response.statusText}: ${url}`);
  }
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
  if (!response.ok) {
    fail(`request failed ${response.status} ${response.statusText}: ${url}`);
  }
  return response.json();
}

function unwrapSuccessPayload(payload) {
  if (payload && typeof payload === 'object' && payload.success === true && payload.data) {
    return payload.data;
  }
  return payload;
}

function compareBuildInfo({component, localBuildInfo, remoteBuildInfo, skipLocalCompare}) {
  if (skipLocalCompare) {
    return;
  }
  if (!localBuildInfo || !remoteBuildInfo) {
    return;
  }
  const fields = ['release_version', 'git_commit'];
  for (const field of fields) {
    const localValue = trimString(localBuildInfo[field]);
    const remoteValue = trimString(remoteBuildInfo[field]);
    if (localValue && remoteValue && localValue !== remoteValue) {
      fail(`${component} ${field} mismatch: local=${localValue} remote=${remoteValue}`);
    }
  }
}

function inferAdminBaseUrl(brandId) {
  const explicit = trimString(process.env.ICLAW_ADMIN_BASE_URL || process.env.ICLAW_ADMIN_PUBLIC_BASE_URL);
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }
  return `https://${brandId}-admin.aiyuanxi.com`;
}

function resolveHomeBaseUrl(profile, channel) {
  const explicit = trimString(process.env.ICLAW_HOME_BASE_URL);
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }
  const runtimeBaseUrl = trimString(profile?.runtimeDistribution?.[channel]?.publicBaseUrl);
  if (runtimeBaseUrl) {
    return runtimeBaseUrl.replace(/\/+$/, '');
  }
  fail(`missing home base url for channel=${channel}`);
}

function resolveControlPlaneBaseUrl(profile, channel) {
  const explicit = trimString(process.env.ICLAW_CONTROL_PLANE_BASE_URL);
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }
  return resolveHomeBaseUrl(profile, channel);
}

function resolveChromeBin() {
  const explicit = trimString(process.env.ICLAW_CHROME_BIN);
  return explicit || defaultChromeBin;
}

function canUseChrome(chromeBin) {
  try {
    execFileSync(chromeBin, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 15000,
    });
    return true;
  } catch {
    return false;
  }
}

function dumpDom(url, chromeBin) {
  return execFileSync(
    chromeBin,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--virtual-time-budget=6000',
      '--dump-dom',
      url,
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 30000,
    },
  );
}

function extractAnchorHrefsFromDom(dom) {
  const hrefs = [];
  const anchorPattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of dom.matchAll(anchorPattern)) {
    const href = trimString(match[1]);
    const label = trimString(String(match[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    if (!href) continue;
    hrefs.push({href, label});
  }
  return hrefs;
}

function buildExpectedDownloadUrls({profile, channel, manifestEntries}) {
  const downloadsBaseUrl = trimString(profile?.distribution?.downloads?.[channel]?.publicBaseUrl).replace(/\/+$/, '');
  if (!downloadsBaseUrl) {
    return [];
  }
  return manifestEntries
    .map((entry) => {
      const platform = trimString(entry.platform) === 'windows' ? 'windows' : 'mac';
      const arch = trimString(entry.arch);
      const artifactName = trimString(entry.artifact_name);
      if (!arch || !artifactName) {
        return null;
      }
      return {
        platform: trimString(entry.platform),
        arch,
        url: `${downloadsBaseUrl}/${platform}/${arch}/${encodeURIComponent(artifactName)}`,
      };
    })
    .filter(Boolean);
}

async function verifyControlPlane({profile, channel, skipLocalCompare}) {
  const baseUrl = resolveControlPlaneBaseUrl(profile, channel);
  const payload = unwrapSuccessPayload(await fetchJson(`${baseUrl}/health`));
  if (trimString(payload?.status).toLowerCase() !== 'ok') {
    fail(`control-plane health status is not ok: ${JSON.stringify(payload)}`);
  }
  const localBuildInfo = await readLocalBuildInfo('services/control-plane/build-info.json');
  compareBuildInfo({
    component: 'control-plane',
    localBuildInfo,
    remoteBuildInfo: payload,
    skipLocalCompare,
  });
  return {
    component: 'control-plane',
    baseUrl,
    releaseVersion: trimString(payload?.release_version),
    gitCommit: trimString(payload?.git_commit),
    checks: ['health', 'build-info'],
  };
}

async function verifyAdmin({brandId, skipLocalCompare}) {
  const baseUrl = inferAdminBaseUrl(brandId);
  await fetchText(`${baseUrl}/`);
  const remoteBuildInfo = await fetchJson(`${baseUrl}/build-info.json`);
  const localBuildInfo = await readLocalBuildInfo('admin-web/dist/build-info.json');
  compareBuildInfo({
    component: 'admin-web',
    localBuildInfo,
    remoteBuildInfo,
    skipLocalCompare,
  });
  return {
    component: 'admin-web',
    baseUrl,
    releaseVersion: trimString(remoteBuildInfo?.release_version),
    gitCommit: trimString(remoteBuildInfo?.git_commit),
    checks: ['index', 'build-info'],
  };
}

async function verifyHome({profile, brandId, channel, requireChrome, skipLocalCompare}) {
  const baseUrl = resolveHomeBaseUrl(profile, channel);
  await fetchText(`${baseUrl}/`);
  const remoteBuildInfo = await fetchJson(`${baseUrl}/build-info.json`);
  const localBuildInfo = await readLocalBuildInfo('home-web/dist/build-info.json');
  compareBuildInfo({
    component: 'home-web',
    localBuildInfo,
    remoteBuildInfo,
    skipLocalCompare,
  });

  const manifestPayload = unwrapSuccessPayload(
    await fetchJson(
      `${baseUrl}/desktop/release-manifest?app_name=${encodeURIComponent(brandId)}&channel=${encodeURIComponent(channel)}`,
    ),
  );
  const manifestEntries = Array.isArray(manifestPayload?.entries) ? manifestPayload.entries : [];
  if (manifestEntries.length === 0) {
    fail(`desktop release manifest has no entries for ${brandId}/${channel}`);
  }

  const expectedDownloadUrls = buildExpectedDownloadUrls({
    profile,
    channel,
    manifestEntries,
  });

  const chromeBin = resolveChromeBin();
  const chromeAvailable = canUseChrome(chromeBin);
  if (!chromeAvailable && requireChrome) {
    fail(`chrome is required but unavailable: ${chromeBin}`);
  }

  const checks = ['index', 'build-info', 'release-manifest'];
  let verifiedDomUrls = [];
  if (chromeAvailable) {
    const dom = dumpDom(`${baseUrl}/?app_name=${encodeURIComponent(brandId)}`, chromeBin);
    const anchorHrefs = extractAnchorHrefsFromDom(dom).map((item) => item.href);
    const criticalUrls = expectedDownloadUrls.filter((item) => item.platform === 'windows' || item.platform === 'darwin');
    for (const item of criticalUrls) {
      if (!anchorHrefs.includes(item.url)) {
      fail(`home-web download href missing in rendered DOM: ${item.url}`);
      }
    }
      checks.push('dom-download-hrefs');
    verifiedDomUrls = criticalUrls.map((item) => item.url);
  }

  return {
    component: 'home-web',
    baseUrl,
    releaseVersion: trimString(remoteBuildInfo?.release_version),
    gitCommit: trimString(remoteBuildInfo?.git_commit),
    checks,
    verifiedDomUrls,
    chromeAvailable,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.component) {
    fail('Usage: node scripts/verify-prod-deploy.mjs --component <control-plane|admin-web|home-web> [--brand <brand>] [--channel prod] [--skip-local-compare]');
  }
  options.brandId = resolveBrandId(options.brandId);
  const {profile} = await loadBrandProfile({rootDir, brandId: options.brandId, envName: options.channel});

  let result;
  if (options.component === 'control-plane') {
    result = await verifyControlPlane({profile, channel: options.channel, skipLocalCompare: options.skipLocalCompare});
  } else if (options.component === 'admin-web') {
    result = await verifyAdmin({brandId: options.brandId, skipLocalCompare: options.skipLocalCompare});
  } else if (options.component === 'home-web') {
    result = await verifyHome({
      profile,
      brandId: options.brandId,
      channel: options.channel,
      requireChrome: options.requireChrome,
      skipLocalCompare: options.skipLocalCompare,
    });
  } else {
    fail(`unsupported component: ${options.component}`);
  }

  process.stdout.write(`${JSON.stringify({ok: true, brandId: options.brandId, channel: options.channel, ...result}, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
