import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '../../../..');
const fixturesDir = path.join(import.meta.dirname, 'fixtures', 'runtime-config');
const generatorPath = path.join(
  repoRoot,
  'apps',
  'desktop',
  'src-tauri',
  'resources',
  'runtime',
  'generate-openclaw-config.mjs',
);

function runGenerator(env) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iclaw-runtime-config-test-'));
  const configPath = path.join(tempDir, 'openclaw.json');
  execFileSync(process.execPath, [generatorPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
      ICLAW_OPENCLAW_CONFIG_PATH: configPath,
    },
    stdio: 'pipe',
  });
  const output = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  fs.rmSync(tempDir, { recursive: true, force: true });
  return output;
}

function readFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf8'));
}

test('golden: dev runtime config generation stays stable', () => {
  const actual = runGenerator({
    ICLAW_OPENCLAW_RUNTIME_CONFIG_PATH: path.join(fixturesDir, 'runtime-config.fixture.json'),
    ICLAW_OPENCLAW_PORTAL_RUNTIME_CONFIG_PATH: path.join(fixturesDir, 'portal-runtime.fixture.json'),
    ICLAW_OPENCLAW_GATEWAY_TOKEN: 'golden-dev-token',
    ICLAW_OPENCLAW_WORKSPACE_DIR: '/tmp/iclaw-golden-dev-workspace',
    ICLAW_OPENCLAW_RUNTIME_MODE: 'dev',
    ICLAW_OPENCLAW_ALLOWED_ORIGINS: 'http://127.0.0.1:1520,http://localhost:1520',
  });
  assert.deepEqual(actual, readFixture('expected-dev.json'));
});

test('golden: prod runtime config generation stays stable', () => {
  const actual = runGenerator({
    ICLAW_OPENCLAW_RUNTIME_CONFIG_PATH: path.join(fixturesDir, 'runtime-config.fixture.json'),
    ICLAW_OPENCLAW_OEM_RUNTIME_SNAPSHOT_PATH: path.join(fixturesDir, 'oem-runtime-snapshot.fixture.json'),
    ICLAW_OPENCLAW_GATEWAY_TOKEN: 'golden-prod-token',
    ICLAW_OPENCLAW_WORKSPACE_DIR: '/tmp/iclaw-golden-prod-workspace',
    ICLAW_OPENCLAW_RUNTIME_MODE: 'prod',
    ICLAW_OPENCLAW_ALLOWED_ORIGINS: 'tauri://localhost,http://tauri.localhost,https://tauri.localhost',
  });
  assert.deepEqual(actual, readFixture('expected-prod.json'));
});
