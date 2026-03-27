#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

function resolveBash() {
  if (process.platform !== 'win32') {
    return 'bash';
  }

  const candidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
  ];

  for (const candidate of candidates) {
    try {
      return candidate;
    } catch {}
  }

  throw new Error('Git Bash not found. Expected one of: C:\\Program Files\\Git\\bin\\bash.exe or C:\\Program Files\\Git\\usr\\bin\\bash.exe');
}

function prependPath(env, entries) {
  const key = Object.keys(env).find((name) => name.toUpperCase() === 'PATH') || 'PATH';
  const current = env[key] || '';
  env[key] = [...entries.filter(Boolean), current].filter(Boolean).join(path.delimiter);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/run-bash.mjs <script-or-command> [args...]');
  process.exit(1);
}

const env = { ...process.env };
prependPath(env, [path.dirname(process.execPath)]);

const bash = resolveBash();
let child;

if (process.platform === 'win32') {
  const bootstrap = [
    'pnpm(){ corepack pnpm "$@"; }',
    'export -f pnpm',
    'exec bash "$@"',
  ].join('; ');
  child = spawn(bash, ['-lc', bootstrap, 'bash', ...args], {
    stdio: 'inherit',
    env,
  });
} else {
  child = spawn(bash, args, {
    stdio: 'inherit',
    env,
  });
}

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
