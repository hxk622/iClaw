#!/usr/bin/env node
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function normalizeEnvName(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return '';
  if (['dev', 'development', 'local'].includes(value)) return 'dev';
  if (['test', 'testing', 'staging'].includes(value)) return 'test';
  if (['prod', 'production', 'release'].includes(value)) return 'prod';
  return '';
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/run-with-env.mjs <default-env> <command...>');
  process.exit(1);
}

const defaultEnv = normalizeEnvName(args[0]);
if (!defaultEnv) {
  console.error(`Unsupported default env: ${args[0]}`);
  process.exit(1);
}

const selectedEnv = normalizeEnvName(process.env.NODE_ENV || process.env.ICLAW_ENV_NAME || '') || defaultEnv;
const commandArgs = args.slice(1);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runBashPath = path.join(__dirname, 'run-bash.mjs');
const child = spawn(process.execPath, [runBashPath, path.join(__dirname, 'with-env.sh'), selectedEnv, ...commandArgs], {
  stdio: 'inherit',
  env: { ...process.env, ICLAW_ENV_NAME: selectedEnv, NODE_ENV: selectedEnv },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
