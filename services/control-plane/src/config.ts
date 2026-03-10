import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const DEFAULT_PORT = 1420;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_CREDIT_BALANCE = 100000;
const DEFAULT_RUN_GRANT_TTL_SECONDS = 5 * 60;
const DEFAULT_RUN_GRANT_MAX_INPUT_TOKENS = 4000;
const DEFAULT_RUN_GRANT_MAX_OUTPUT_TOKENS = 8000;
const DEFAULT_RUN_GRANT_CREDIT_LIMIT = 300;
const DEFAULT_CREDIT_COST_INPUT_PER_1K = 1;
const DEFAULT_CREDIT_COST_OUTPUT_PER_1K = 2;

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function loadRootEnvFile(): void {
  const currentFile = fileURLToPath(import.meta.url);
  const rootEnvFile = resolve(dirname(currentFile), '../../../.env');
  if (!existsSync(rootEnvFile)) {
    return;
  }

  const content = readFileSync(rootEnvFile, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());
    if (typeof process.env[key] === 'undefined') {
      process.env[key] = value;
    }
  }
}

loadRootEnvFile();

function readNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  port: readNumberEnv('PORT', DEFAULT_PORT),
  databaseUrl: process.env.DATABASE_URL || '',
  s3Endpoint: process.env.S3_ENDPOINT || 'http://127.0.0.1:9000',
  s3Region: process.env.S3_REGION || 'us-east-1',
  s3AccessKey: process.env.S3_ACCESS_KEY || 'openalpha',
  s3SecretKey: process.env.S3_SECRET_KEY || 'openalpha_dev',
  s3Bucket: process.env.S3_BUCKET || 'iclaw-files',
  s3CdnUrl: process.env.S3_CDN_URL || '',
  apiUrl: process.env.API_URL || process.env.APP_URL || '',
  redisUrl: process.env.CONTROL_PLANE_REDIS_URL || process.env.REDIS_URL || '',
  redisKeyPrefix: process.env.CONTROL_PLANE_REDIS_KEY_PREFIX || 'iclaw:control-plane',
  wechatAppId: process.env.WECHAT_APP_ID || '',
  wechatAppSecret: process.env.WECHAT_APP_SECRET || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  accessTokenTtlSeconds: readNumberEnv('ACCESS_TOKEN_TTL_SECONDS', DEFAULT_ACCESS_TOKEN_TTL_SECONDS),
  refreshTokenTtlSeconds: readNumberEnv('REFRESH_TOKEN_TTL_SECONDS', DEFAULT_REFRESH_TOKEN_TTL_SECONDS),
  defaultCreditBalance: readNumberEnv('DEFAULT_CREDIT_BALANCE', DEFAULT_CREDIT_BALANCE),
  runGrantTtlSeconds: readNumberEnv('RUN_GRANT_TTL_SECONDS', DEFAULT_RUN_GRANT_TTL_SECONDS),
  runGrantMaxInputTokens: readNumberEnv('RUN_GRANT_MAX_INPUT_TOKENS', DEFAULT_RUN_GRANT_MAX_INPUT_TOKENS),
  runGrantMaxOutputTokens: readNumberEnv('RUN_GRANT_MAX_OUTPUT_TOKENS', DEFAULT_RUN_GRANT_MAX_OUTPUT_TOKENS),
  runGrantCreditLimit: readNumberEnv('RUN_GRANT_CREDIT_LIMIT', DEFAULT_RUN_GRANT_CREDIT_LIMIT),
  creditCostInputPer1k: readNumberEnv('CREDIT_COST_INPUT_PER_1K', DEFAULT_CREDIT_COST_INPUT_PER_1K),
  creditCostOutputPer1k: readNumberEnv('CREDIT_COST_OUTPUT_PER_1K', DEFAULT_CREDIT_COST_OUTPUT_PER_1K),
};
