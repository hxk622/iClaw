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

function writeTempJson(tempDir, name, value) {
  const targetPath = path.join(tempDir, name);
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return targetPath;
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

test('defaults desktop runtime browser launcher to headless', () => {
  const actual = runGenerator({
    ICLAW_OPENCLAW_RUNTIME_CONFIG_PATH: path.join(fixturesDir, 'runtime-config.fixture.json'),
    ICLAW_OPENCLAW_OEM_RUNTIME_SNAPSHOT_PATH: path.join(fixturesDir, 'oem-runtime-snapshot.fixture.json'),
    ICLAW_OPENCLAW_GATEWAY_TOKEN: 'browser-headless-token',
    ICLAW_OPENCLAW_WORKSPACE_DIR: '/tmp/iclaw-browser-headless-workspace',
    ICLAW_OPENCLAW_RUNTIME_MODE: 'prod',
    ICLAW_OPENCLAW_ALLOWED_ORIGINS: 'tauri://localhost,http://tauri.localhost,https://tauri.localhost',
  });
  assert.equal(actual.browser?.headless, true);
});

test('normalizes openai-compatible provider baseUrl to include /v1 when missing', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iclaw-runtime-config-baseurl-test-'));
  try {
    const runtimeFixture = readFixture('runtime-config.fixture.json');
    const snapshotFixture = readFixture('oem-runtime-snapshot.fixture.json');
    snapshotFixture.config.model_provider.profile.base_url = 'https://omnirouter.aiyuanxi.com';
    snapshotFixture.config.model_provider.profile.provider_key = 'omnirouter';
    snapshotFixture.config.model_provider.profile.provider_label = 'Omnirouter';
    snapshotFixture.config.memory_embedding.profile.base_url = 'https://dashscope.aliyuncs.com/compatible-mode';
    const actual = runGenerator({
      ICLAW_OPENCLAW_RUNTIME_CONFIG_PATH: writeTempJson(tempDir, 'runtime-config.fixture.json', runtimeFixture),
      ICLAW_OPENCLAW_OEM_RUNTIME_SNAPSHOT_PATH: writeTempJson(tempDir, 'oem-runtime-snapshot.fixture.json', snapshotFixture),
      ICLAW_OPENCLAW_GATEWAY_TOKEN: 'baseurl-test-token',
      ICLAW_OPENCLAW_WORKSPACE_DIR: '/tmp/iclaw-baseurl-workspace',
      ICLAW_OPENCLAW_RUNTIME_MODE: 'dev',
      ICLAW_OPENCLAW_ALLOWED_ORIGINS: 'http://127.0.0.1:1520,http://localhost:1520',
    });
    assert.equal(actual.models.providers.omnirouter.baseUrl, 'https://omnirouter.aiyuanxi.com/v1');
    assert.equal(
      actual.agents.defaults.memorySearch.remote.baseUrl,
      'https://dashscope.aliyuncs.com/compatible-mode',
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('honors default_model_ref even when it is not the first enabled provider model', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iclaw-runtime-config-default-model-test-'));
  try {
    const runtimeFixture = readFixture('runtime-config.fixture.json');
    const snapshotFixture = readFixture('oem-runtime-snapshot.fixture.json');
    snapshotFixture.config.model_provider.profile.metadata = {
      ...(snapshotFixture.config.model_provider.profile.metadata || {}),
      default_model_ref: 'deepseek/deepseek-v3.2',
    };
    const actual = runGenerator({
      ICLAW_OPENCLAW_RUNTIME_CONFIG_PATH: writeTempJson(tempDir, 'runtime-config.fixture.json', runtimeFixture),
      ICLAW_OPENCLAW_OEM_RUNTIME_SNAPSHOT_PATH: writeTempJson(tempDir, 'oem-runtime-snapshot.fixture.json', snapshotFixture),
      ICLAW_OPENCLAW_GATEWAY_TOKEN: 'default-model-test-token',
      ICLAW_OPENCLAW_WORKSPACE_DIR: '/tmp/iclaw-default-model-workspace',
      ICLAW_OPENCLAW_RUNTIME_MODE: 'prod',
      ICLAW_OPENCLAW_ALLOWED_ORIGINS: 'tauri://localhost,http://tauri.localhost,https://tauri.localhost',
    });
    assert.equal(actual.agents.defaults.model.primary, 'deepseek/deepseek-v3.2');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('fails fast when memory embedding is configured without an api key', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iclaw-runtime-config-memory-key-test-'));
  try {
    const runtimeFixture = readFixture('runtime-config.fixture.json');
    const snapshotFixture = readFixture('oem-runtime-snapshot.fixture.json');
    snapshotFixture.config.memory_embedding.profile.api_key = '';
    const configPath = path.join(tempDir, 'openclaw.json');
    assert.throws(
      () =>
        execFileSync(process.execPath, [generatorPath], {
          cwd: repoRoot,
          env: {
            ...process.env,
            ICLAW_OPENCLAW_CONFIG_PATH: configPath,
            ICLAW_OPENCLAW_RUNTIME_CONFIG_PATH: writeTempJson(
              tempDir,
              'runtime-config.fixture.json',
              runtimeFixture,
            ),
            ICLAW_OPENCLAW_OEM_RUNTIME_SNAPSHOT_PATH: writeTempJson(
              tempDir,
              'oem-runtime-snapshot.fixture.json',
              snapshotFixture,
            ),
            ICLAW_OPENCLAW_GATEWAY_TOKEN: 'memory-key-test-token',
          },
          stdio: 'pipe',
        }),
      /Missing memory embedding API key/,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
