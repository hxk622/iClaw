import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveDesktopAuthBaseUrl } from './runtime-endpoints.ts';

test('resolveDesktopAuthBaseUrl prefers explicit env override', () => {
  const result = resolveDesktopAuthBaseUrl({
    envAuthBaseUrl: 'https://env.example.com/',
    brandAuthBaseUrl: 'https://brand.example.com',
    localAuthBaseUrl: 'http://127.0.0.1:2130',
    isTauriRuntime: false,
    locationHostname: '127.0.0.1',
  });

  assert.equal(result, 'https://env.example.com');
});

test('resolveDesktopAuthBaseUrl prefers local control-plane on loopback web dev', () => {
  const result = resolveDesktopAuthBaseUrl({
    envAuthBaseUrl: '',
    brandAuthBaseUrl: 'https://brand.example.com',
    localAuthBaseUrl: 'http://127.0.0.1:2130',
    isTauriRuntime: false,
    locationHostname: '127.0.0.1',
  });

  assert.equal(result, 'http://127.0.0.1:2130');
});

test('resolveDesktopAuthBaseUrl prefers local control-plane in tauri runtime', () => {
  const result = resolveDesktopAuthBaseUrl({
    envAuthBaseUrl: '',
    brandAuthBaseUrl: 'https://brand.example.com',
    localAuthBaseUrl: 'http://127.0.0.1:2130',
    isTauriRuntime: true,
    locationHostname: 'app.local',
  });

  assert.equal(result, 'http://127.0.0.1:2130');
});

test('resolveDesktopAuthBaseUrl falls back to brand endpoint off loopback', () => {
  const result = resolveDesktopAuthBaseUrl({
    envAuthBaseUrl: '',
    brandAuthBaseUrl: 'https://brand.example.com/',
    localAuthBaseUrl: 'http://127.0.0.1:2130',
    isTauriRuntime: false,
    locationHostname: 'caiclaw.aiyuanxi.com',
  });

  assert.equal(result, 'https://brand.example.com');
});
