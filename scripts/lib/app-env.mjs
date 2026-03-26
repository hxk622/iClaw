import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeEnvName(raw) {
  const normalized = trimString(raw).toLowerCase();
  if (!normalized) return '';
  if (['dev', 'development', 'local'].includes(normalized)) return 'dev';
  if (['test', 'testing', 'staging'].includes(normalized)) return 'test';
  if (['prod', 'production', 'release'].includes(normalized)) return 'prod';
  return '';
}

export function resolveSelectedEnvName() {
  return normalizeEnvName(process.env.ICLAW_ENV_NAME || process.env.NODE_ENV || '');
}

function parseEnvContent(raw) {
  const values = {};
  for (const line of String(raw || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && typeof values[key] === 'undefined') {
      values[key] = value;
    }
  }
  return values;
}

function readEnvFile(filePath) {
  try {
    return parseEnvContent(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function envFileCandidatesFor(rootDir, envName = '') {
  const selectedEnv = normalizeEnvName(envName);
  const candidates = [];
  if (selectedEnv) {
    candidates.push(path.join(rootDir, `.env.${selectedEnv}.local`));
    candidates.push(path.join(rootDir, '.env.local'));
    candidates.push(path.join(rootDir, `.env.${selectedEnv}`));
  }
  candidates.push(path.join(rootDir, '.env'));
  return candidates;
}

function envFileCandidates(rootDir) {
  return envFileCandidatesFor(rootDir, resolveSelectedEnvName());
}

export function readPreferredEnvValue(rootDir, key) {
  for (const filePath of envFileCandidates(rootDir)) {
    const values = readEnvFile(filePath);
    const value = trimString(values[key]);
    if (value) {
      return value;
    }
  }
  return '';
}

export function readPreferredEnvValueFor(rootDir, envName, key) {
  for (const filePath of envFileCandidatesFor(rootDir, envName)) {
    const values = readEnvFile(filePath);
    const value = trimString(values[key]);
    if (value) {
      return value;
    }
  }
  return '';
}

export function resolvePackagingSourceEnv(rootDir) {
  const pick = (key) => trimString(process.env[key]) || readPreferredEnvValue(rootDir, key);

  return {
    DATABASE_URL: pick('ICLAW_PACKAGE_SOURCE_DATABASE_URL'),
    CONTROL_PLANE_REDIS_URL: pick('ICLAW_PACKAGE_SOURCE_CONTROL_PLANE_REDIS_URL'),
    S3_ENDPOINT: pick('ICLAW_PACKAGE_SOURCE_S3_ENDPOINT'),
    S3_ACCESS_KEY: pick('ICLAW_PACKAGE_SOURCE_S3_ACCESS_KEY'),
    S3_SECRET_KEY: pick('ICLAW_PACKAGE_SOURCE_S3_SECRET_KEY'),
  };
}

export function resolveConfiguredAppName(rootDir) {
  const envValue = trimString(
    process.env.APP_NAME ||
      process.env.ICLAW_PORTAL_APP_NAME ||
      process.env.ICLAW_BRAND ||
      process.env.ICLAW_APP_NAME ||
      '',
  );
  if (envValue) {
    return envValue;
  }

  return (
    readPreferredEnvValue(rootDir, 'APP_NAME') ||
    readPreferredEnvValue(rootDir, 'ICLAW_PORTAL_APP_NAME') ||
    readPreferredEnvValue(rootDir, 'ICLAW_BRAND') ||
    readPreferredEnvValue(rootDir, 'ICLAW_APP_NAME') ||
    ''
  );
}
