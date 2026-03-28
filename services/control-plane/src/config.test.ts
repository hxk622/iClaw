import test from 'node:test';
import assert from 'node:assert/strict';

async function loadConfigModule() {
  process.env.APP_NAME = process.env.APP_NAME || 'licaiclaw';
  return import(`./config.ts?test=${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

test('resolveAllowedOrigins always preserves desktop-safe local defaults', async () => {
  const {resolveAllowedOrigins} = await loadConfigModule();
  const allowedOrigins = resolveAllowedOrigins('https://caiclaw.aiyuanxi.com,https://admin.aiyuanxi.com');

  assert.ok(allowedOrigins.includes('tauri://localhost'));
  assert.ok(allowedOrigins.includes('https://tauri.localhost'));
  assert.ok(allowedOrigins.includes('http://tauri.localhost'));
  assert.ok(allowedOrigins.includes('http://127.0.0.1:1520'));
  assert.ok(allowedOrigins.includes('https://caiclaw.aiyuanxi.com'));
  assert.ok(allowedOrigins.includes('https://admin.aiyuanxi.com'));
});

test('resolveAllowedOrigins de-duplicates overlapping values', async () => {
  const {resolveAllowedOrigins} = await loadConfigModule();
  const allowedOrigins = resolveAllowedOrigins('tauri://localhost,https://tauri.localhost,https://tauri.localhost');
  const tauriOrigins = allowedOrigins.filter((origin: string) => origin === 'tauri://localhost');
  const httpsTauriOrigins = allowedOrigins.filter((origin: string) => origin === 'https://tauri.localhost');

  assert.equal(tauriOrigins.length, 1);
  assert.equal(httpsTauriOrigins.length, 1);
});
