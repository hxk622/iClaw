#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {spawnSync} from 'node:child_process';

const rootDir = process.cwd();

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArgs(argv) {
  const options = {
    releaseVersion: '',
    environment: 'prod',
    allowDirty: false,
    skipControlPlaneCheck: false,
    skipAdminBuild: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--release-version') {
      options.releaseVersion = trimString(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg.startsWith('--release-version=')) {
      options.releaseVersion = trimString(arg.slice('--release-version='.length));
      continue;
    }
    if (arg === '--environment') {
      options.environment = trimString(argv[index + 1] || '') || 'prod';
      index += 1;
      continue;
    }
    if (arg.startsWith('--environment=')) {
      options.environment = trimString(arg.slice('--environment='.length)) || 'prod';
      continue;
    }
    if (arg === '--allow-dirty') {
      options.allowDirty = true;
      continue;
    }
    if (arg === '--skip-control-plane-check') {
      options.skipControlPlaneCheck = true;
      continue;
    }
    if (arg === '--skip-admin-build') {
      options.skipAdminBuild = true;
      continue;
    }
  }

  return options;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    stdio: 'inherit',
    env: options.env ?? process.env,
    shell: options.shell ?? false,
  });
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: options.env ?? process.env,
    shell: options.shell ?? false,
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(rootDir, filePath)}`);
  }
}

function assertCleanWorktree() {
  const result = runCapture('git', ['status', '--short']);
  const output = trimString(result.stdout);
  if (result.status !== 0) {
    throw new Error(`git status failed: ${trimString(result.stderr) || result.status}`);
  }
  if (output) {
    throw new Error(`Working tree is not clean:\n${output}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.releaseVersion) {
    throw new Error('Usage: node scripts/release-preflight.mjs --release-version <x.y.z.build>');
  }

  const versionRecordPath = path.join(rootDir, 'docs', 'version_record', `${options.releaseVersion}.md`);
  const testReportPath = path.join(rootDir, 'docs', 'version_record', 'test_report', `${options.releaseVersion}.md`);
  ensureFileExists(versionRecordPath);
  ensureFileExists(testReportPath);

  if (!options.allowDirty) {
    assertCleanWorktree();
  }

  if (!options.skipControlPlaneCheck) {
    const status = run('pnpm', ['check:control-plane']);
    if (status !== 0) {
      throw new Error(`pnpm check:control-plane failed with exit code ${status}`);
    }
  }

  if (!options.skipAdminBuild) {
    const status = run('pnpm', ['--dir', 'admin-web', 'build']);
    if (status !== 0) {
      throw new Error(`pnpm --dir admin-web build failed with exit code ${status}`);
    }
  }

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        releaseVersion: options.releaseVersion,
        environment: options.environment,
        checks: {
          versionRecord: path.relative(rootDir, versionRecordPath),
          testReport: path.relative(rootDir, testReportPath),
          worktree: options.allowDirty ? 'skipped' : 'clean',
          controlPlaneCheck: options.skipControlPlaneCheck ? 'skipped' : 'passed',
          adminBuild: options.skipAdminBuild ? 'skipped' : 'passed',
        },
      },
      null,
      2,
    ) + '\n',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
