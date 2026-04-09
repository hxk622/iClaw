import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ensureDesktopRuntimeReadyForChatRecovery,
  type DesktopRuntimeRecoveryState,
} from './desktop-runtime-recovery.ts';

function createState(): DesktopRuntimeRecoveryState {
  return {
    inFlight: null,
    lastRestartAt: 0,
  };
}

test('returns healthy when local runtime health check succeeds', async () => {
  const result = await ensureDesktopRuntimeReadyForChatRecovery(createState(), {
    isTauriRuntime: true,
    healthCheck: async () => {},
    refreshGatewayAuth: async () => undefined,
    syncBrandRuntimeSnapshot: async () => undefined,
    stopSidecar: async () => true,
    startSidecar: async () => true,
    sidecarArgs: ['--port', '2126'],
    waitForHealth: async () => true,
  });

  assert.equal(result, 'healthy');
});

test('restarts sidecar when local runtime health check fails', async () => {
  const calls: string[] = [];
  const result = await ensureDesktopRuntimeReadyForChatRecovery(createState(), {
    isTauriRuntime: true,
    healthCheck: async () => {
      throw new Error('down');
    },
    refreshGatewayAuth: async () => {
      calls.push('refresh');
    },
    syncBrandRuntimeSnapshot: async () => {
      calls.push('sync');
    },
    stopSidecar: async () => {
      calls.push('stop');
      return true;
    },
    startSidecar: async (args) => {
      calls.push(`start:${args.join(' ')}`);
      return true;
    },
    sidecarArgs: ['--port', '2126'],
    waitForHealth: async () => {
      calls.push('wait');
      return true;
    },
  });

  assert.equal(result, 'restarted');
  assert.deepEqual(calls, ['refresh', 'sync', 'stop', 'start:--port 2126', 'wait']);
});

test('returns cooldown when restart budget is still cooling down', async () => {
  const result = await ensureDesktopRuntimeReadyForChatRecovery(
    {
      inFlight: null,
      lastRestartAt: 95,
    },
    {
      isTauriRuntime: true,
      cooldownMs: 10,
      now: () => 100,
      healthCheck: async () => {
        throw new Error('down');
      },
      refreshGatewayAuth: async () => undefined,
      syncBrandRuntimeSnapshot: async () => undefined,
      stopSidecar: async () => true,
      startSidecar: async () => true,
      sidecarArgs: [],
      waitForHealth: async () => true,
    },
  );

  assert.equal(result, 'cooldown');
});

test('coalesces concurrent recovery calls into a single in-flight restart', async () => {
  const state = createState();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let startCount = 0;

  const firstPromise = ensureDesktopRuntimeReadyForChatRecovery(state, {
    isTauriRuntime: true,
    healthCheck: async () => {
      throw new Error('down');
    },
    refreshGatewayAuth: async () => undefined,
    syncBrandRuntimeSnapshot: async () => undefined,
    stopSidecar: async () => true,
    startSidecar: async () => {
      startCount += 1;
      await gate;
      return true;
    },
    sidecarArgs: [],
    waitForHealth: async () => true,
  });

  const secondPromise = ensureDesktopRuntimeReadyForChatRecovery(state, {
    isTauriRuntime: true,
    healthCheck: async () => {
      throw new Error('down');
    },
    refreshGatewayAuth: async () => undefined,
    syncBrandRuntimeSnapshot: async () => undefined,
    stopSidecar: async () => true,
    startSidecar: async () => true,
    sidecarArgs: [],
    waitForHealth: async () => true,
  });

  assert.equal(await secondPromise, 'restarting');
  release();
  assert.equal(await firstPromise, 'restarted');
  assert.equal(startCount, 1);
});
