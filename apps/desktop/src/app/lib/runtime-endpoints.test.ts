import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveDesktopAuthBaseUrl } from './runtime-endpoints.ts';

test('resolveDesktopAuthBaseUrl prefers explicit env override', () => {
  const result = resolveDesktopAuthBaseUrl({
    envAuthBaseUrl: 'https://env.example.com/',
    envDesktopAuthBaseUrl: 'http://127.0.0.1:2130',
    localAuthBaseUrl: 'http://127.0.0.1:2130',
    isTauriRuntime: false,
    locationHostname: '127.0.0.1',
    locationProtocol: 'http:',
  });

  assert.equal(result, 'http://127.0.0.1:2130');
});

test('resolveDesktopAuthBaseUrl prefers local control-plane on loopback web dev', () => {
  const result = resolveDesktopAuthBaseUrl({
    envAuthBaseUrl: '',
    envDesktopAuthBaseUrl: 'http://127.0.0.1:2130',
    localAuthBaseUrl: 'http://127.0.0.1:2130',
    isTauriRuntime: false,
    locationHostname: '127.0.0.1',
    locationProtocol: 'http:',
  });

  assert.equal(result, 'http://127.0.0.1:2130');
});

test('resolveDesktopAuthBaseUrl prefers local control-plane in tauri runtime', () => {
  const result = resolveDesktopAuthBaseUrl({
    envAuthBaseUrl: '',
    envDesktopAuthBaseUrl: 'http://127.0.0.1:2130',
    localAuthBaseUrl: 'http://127.0.0.1:2130',
    isTauriRuntime: true,
    locationHostname: 'app.local',
    locationProtocol: 'tauri:',
  });

  assert.equal(result, 'http://127.0.0.1:2130');
});

test('resolveDesktopAuthBaseUrl prefers local control-plane for tauri-like location even when internals are missing', () => {
  const result = resolveDesktopAuthBaseUrl({
    envAuthBaseUrl: 'https://env.example.com/',
    envDesktopAuthBaseUrl: 'http://127.0.0.1:2130',
    localAuthBaseUrl: 'http://127.0.0.1:2130',
    isTauriRuntime: false,
    locationHostname: 'tauri.localhost',
    locationProtocol: 'https:',
  });

  assert.equal(result, 'http://127.0.0.1:2130');
});

test('resolveDesktopAuthBaseUrl falls back to desktop env endpoint off loopback when public env is absent', () => {
  const result = resolveDesktopAuthBaseUrl({
    envAuthBaseUrl: '',
    envDesktopAuthBaseUrl: 'http://127.0.0.1:2130',
    localAuthBaseUrl: 'http://127.0.0.1:2130',
    isTauriRuntime: false,
    locationHostname: 'caiclaw.aiyuanxi.com',
    locationProtocol: 'https:',
  });

  assert.equal(result, 'http://127.0.0.1:2130');
});

test('resolveDesktopAuthBaseUrl keeps env override for normal remote web', () => {
  const result = resolveDesktopAuthBaseUrl({
    envAuthBaseUrl: 'https://env.example.com/',
    envDesktopAuthBaseUrl: 'http://127.0.0.1:2130',
    localAuthBaseUrl: 'http://127.0.0.1:2130',
    isTauriRuntime: false,
    locationHostname: 'caiclaw.aiyuanxi.com',
    locationProtocol: 'https:',
  });

  assert.equal(result, 'https://env.example.com');
});
