import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInstallFailureDiagnostic,
  resolveInstallFailureStage,
  shouldTrackInstallStart,
  shouldTrackInstallSuccess,
} from './install-metrics.ts';

test('shouldTrackInstallStart only fires once for tauri startup gate sessions', () => {
  assert.equal(
    shouldTrackInstallStart({
      isTauriRuntime: true,
      shouldShowStartupGate: true,
      installStartTracked: false,
    }),
    true,
  );
  assert.equal(
    shouldTrackInstallStart({
      isTauriRuntime: true,
      shouldShowStartupGate: true,
      installStartTracked: true,
    }),
    false,
  );
  assert.equal(
    shouldTrackInstallStart({
      isTauriRuntime: false,
      shouldShowStartupGate: true,
      installStartTracked: false,
    }),
    false,
  );
});

test('shouldTrackInstallSuccess requires a prior install start signal', () => {
  assert.equal(
    shouldTrackInstallSuccess({
      isTauriRuntime: true,
      healthy: true,
      installStartTracked: true,
      installSuccessTracked: false,
    }),
    true,
  );
  assert.equal(
    shouldTrackInstallSuccess({
      isTauriRuntime: true,
      healthy: true,
      installStartTracked: false,
      installSuccessTracked: false,
    }),
    false,
  );
});

test('resolveInstallFailureStage prefers install progress phase and falls back to startup healthcheck', () => {
  assert.equal(
    resolveInstallFailureStage({
      runtimeInstallProgressPhase: 'downloading_runtime',
      healthError: 'health check failed',
    }),
    'downloading_runtime',
  );
  assert.equal(
    resolveInstallFailureStage({
      runtimeInstallProgressPhase: null,
      healthError: 'health check failed',
    }),
    'startup_healthcheck',
  );
  assert.equal(
    resolveInstallFailureStage({
      runtimeInstallProgressPhase: null,
      healthError: null,
    }),
    'runtime_install',
  );
});

test('buildInstallFailureDiagnostic produces dedupe-ready payload for installer errors', () => {
  assert.deepEqual(
    buildInstallFailureDiagnostic({
      installerState: 'error',
      errorTitle: '本地服务启动失败',
      errorMessage: '端口冲突',
      runtimeInstallProgressPhase: null,
      healthError: '端口冲突',
    }),
    {
      failureStage: 'startup_healthcheck',
      title: '本地服务启动失败',
      message: '端口冲突',
      signature: '本地服务启动失败::端口冲突::startup_healthcheck',
    },
  );
  assert.equal(
    buildInstallFailureDiagnostic({
      installerState: 'loading',
      errorTitle: 'ignored',
      errorMessage: 'ignored',
      runtimeInstallProgressPhase: 'downloading_runtime',
    }),
    null,
  );
});
