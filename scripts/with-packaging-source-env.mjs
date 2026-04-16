#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolvePackagingOverlayEnv, resolvePackagingSourceEnv } from './lib/app-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const separatorIndex = process.argv.indexOf('--');
const commandArgs = separatorIndex >= 0 ? process.argv.slice(separatorIndex + 1) : process.argv.slice(2);

if (!commandArgs.length) {
  console.error('[with-packaging-source-env] missing command');
  process.exit(1);
}

const packagingOverlayEnv = resolvePackagingOverlayEnv(rootDir);
const packagingSourceEnv = resolvePackagingSourceEnv(rootDir);
const missing = Object.entries(packagingSourceEnv)
  .filter(([, value]) => !String(value || '').trim())
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(
    `[with-packaging-source-env] missing packaging source env: ${missing.join(', ')}. ` +
      'Set ICLAW_PACKAGE_SOURCE_* variables in the selected .env.xxx file.',
  );
  process.exit(1);
}

const [command, ...args] = commandArgs;
const result = spawnSync(command, args, {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    ...packagingOverlayEnv,
    ...packagingSourceEnv,
  },
  shell: false,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
