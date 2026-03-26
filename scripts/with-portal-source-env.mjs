#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolvePortalSourceEnv } from './lib/app-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const separatorIndex = process.argv.indexOf('--');
const commandArgs = separatorIndex >= 0 ? process.argv.slice(separatorIndex + 1) : process.argv.slice(2);

if (!commandArgs.length) {
  console.error('[with-portal-source-env] missing command');
  process.exit(1);
}

const [command, ...args] = commandArgs;
const sourceEnv = resolvePortalSourceEnv(rootDir);
const result = spawnSync(command, args, {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    ...sourceEnv,
  },
  shell: process.platform === 'win32',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
