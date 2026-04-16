#!/usr/bin/env node
import process from 'node:process';
import { spawnSync } from 'node:child_process';

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArgs(argv) {
  const options = {
    brandId: process.env.APP_NAME || process.env.ICLAW_BRAND || 'caiclaw',
    channel: process.env.ICLAW_ENV_NAME || process.env.NODE_ENV || 'prod',
    target: process.env.ICLAW_DESKTOP_TARGET || 'x86_64-pc-windows-msvc',
    releaseVersion: process.env.ICLAW_RELEASE_VERSION || '',
    execute: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--brand') {
      options.brandId = argv[index + 1] || options.brandId;
      index += 1;
      continue;
    }
    if (arg.startsWith('--brand=')) {
      options.brandId = arg.slice('--brand='.length) || options.brandId;
      continue;
    }
    if (arg === '--channel') {
      options.channel = argv[index + 1] || options.channel;
      index += 1;
      continue;
    }
    if (arg.startsWith('--channel=')) {
      options.channel = arg.slice('--channel='.length) || options.channel;
      continue;
    }
    if (arg === '--target') {
      options.target = argv[index + 1] || options.target;
      index += 1;
      continue;
    }
    if (arg.startsWith('--target=')) {
      options.target = arg.slice('--target='.length) || options.target;
      continue;
    }
    if (arg === '--release-version') {
      options.releaseVersion = argv[index + 1] || options.releaseVersion;
      index += 1;
      continue;
    }
    if (arg.startsWith('--release-version=')) {
      options.releaseVersion = arg.slice('--release-version='.length) || options.releaseVersion;
      continue;
    }
    if (arg === '--execute') {
      options.execute = true;
    }
  }
  return options;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const releaseVersionArg = trimString(options.releaseVersion)
    ? ['--release-version', trimString(options.releaseVersion)]
    : [];
  const plan = [
    ['node', ['scripts/release-create-version-record.mjs', ...releaseVersionArg]],
    ['node', ['scripts/release-guard.mjs', '--brand', options.brandId, '--channel', options.channel, '--target', options.target, ...releaseVersionArg, '--write-version-record']],
    ['node', ['scripts/release-preflight.mjs', ...releaseVersionArg]],
    ['node', ['scripts/run-with-env.mjs', options.channel, 'node', 'scripts/build-desktop-package.mjs', '--brand', options.brandId, '--target', options.target]],
    ['node', ['scripts/release-guard.mjs', '--brand', options.brandId, '--channel', options.channel, '--target', options.target, ...releaseVersionArg, '--write-version-record']],
    ['node', ['scripts/run-with-env.mjs', options.channel, 'bash', 'scripts/publish-downloads.sh', options.channel]],
    ['node', ['scripts/run-with-env.mjs', options.channel, 'node', 'scripts/publish-desktop-release.mjs', '--brand', options.brandId, '--channel', options.channel]],
  ];

  if (!options.execute) {
    process.stdout.write(`${JSON.stringify({ mode: 'dry-run', plan }, null, 2)}\n`);
    return;
  }

  for (const [command, args] of plan) {
    run(command, args);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
