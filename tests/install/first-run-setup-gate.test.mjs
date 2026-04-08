import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInstallerViewModel,
  resolveShouldShowStartupGate,
} from '../../apps/desktop/src/app/lib/startup-gate.ts';

test('first run shows install progress view before runtime is ready', () => {
  const view = buildInstallerViewModel({
    brandDisplayName: 'iClaw',
    runtimeReady: false,
    runtimeChecking: false,
    runtimeInstalling: true,
    healthy: false,
    healthError: null,
    runtimeInstallError: null,
    runtimeDiagnosis: {
      runtime_installable: true,
    },
    runtimeInstallProgress: {
      phase: 'prepare',
      progress: 28,
      label: '正在准备安装组件',
      detail: '首次启动需要部署 iClaw 本地运行环境，请稍候。',
    },
    lastRuntimeProgress: 12,
    normalizeText: (value) => value.replaceAll('iClaw', '理财爪'),
  });

  assert.deepEqual(view, {
    state: 'loading',
    title: 'iClaw 正在苏醒',
    subtitle: '正在部署你的本地 AI 助手',
    progress: 28,
    stepLabel: '正在准备安装组件',
    stepDetail: '首次启动需要部署 理财爪 本地运行环境，请稍候。',
    errorMessage: null,
    errorTitle: null,
    diagnosticItems: [],
  });

  assert.equal(
    resolveShouldShowStartupGate({
      isTauriRuntime: true,
      runtimeChecking: false,
      runtimeInstalling: true,
      runtimeReady: false,
      initialHealthResolved: false,
      healthChecking: false,
      healthy: false,
      healthError: null,
    }),
    true,
  );
});

test('install failure shows retryable error view instead of silent loading', () => {
  const view = buildInstallerViewModel({
    brandDisplayName: 'iClaw',
    runtimeReady: false,
    runtimeChecking: false,
    runtimeInstalling: false,
    healthy: false,
    healthError: null,
    runtimeInstallError: '下载 runtime 失败：network timeout',
    runtimeDiagnosis: {
      runtime_installable: true,
    },
    runtimeInstallProgress: {
      phase: 'download',
      progress: 44,
      label: '正在下载组件',
      detail: '正在获取安装资源。',
    },
    lastRuntimeProgress: 44,
  });

  assert.equal(view.state, 'error');
  assert.equal(view.title, '首次启动初始化失败');
  assert.equal(view.stepLabel, '本地运行环境尚未准备完成');
  assert.match(view.errorMessage || '', /network timeout/);
});

test('startup gate disappears after install and health check complete', () => {
  const view = buildInstallerViewModel({
    brandDisplayName: 'iClaw',
    runtimeReady: true,
    runtimeChecking: false,
    runtimeInstalling: false,
    healthy: true,
    healthError: null,
    runtimeInstallError: null,
    runtimeDiagnosis: {
      runtime_installable: true,
    },
    runtimeInstallProgress: {
      phase: 'complete',
      progress: 100,
      label: '完成',
      detail: '安装完成。',
    },
    lastRuntimeProgress: 100,
  });

  assert.equal(view.progress, 100);
  assert.equal(view.stepLabel, 'iClaw 已就绪');
  assert.equal(view.stepDetail, '正在进入应用。');

  assert.equal(
    resolveShouldShowStartupGate({
      isTauriRuntime: true,
      runtimeChecking: false,
      runtimeInstalling: false,
      runtimeReady: true,
      initialHealthResolved: true,
      healthChecking: false,
      healthy: true,
      healthError: null,
    }),
    false,
  );
});

test('missing diagnosis does not surface install failure before probe completes', () => {
  const view = buildInstallerViewModel({
    brandDisplayName: 'iClaw',
    runtimeReady: false,
    runtimeChecking: false,
    runtimeInstalling: false,
    healthy: false,
    healthError: null,
    runtimeInstallError: null,
    runtimeDiagnosis: null,
    runtimeInstallProgress: null,
    startupDiagnostics: null,
    lastRuntimeProgress: 0,
  });

  assert.equal(view.state, 'loading');
  assert.equal(view.subtitle, '正在启动本地 AI 运行环境');
  assert.equal(view.errorMessage, null);
});

test('existing runtime with incomplete init artifacts still renders as startup loading', () => {
  const view = buildInstallerViewModel({
    brandDisplayName: 'iClaw',
    runtimeReady: false,
    runtimeChecking: false,
    runtimeInstalling: false,
    healthy: false,
    healthError: null,
    runtimeInstallError: null,
    runtimeDiagnosis: {
      runtime_found: true,
      runtime_installable: false,
      runtime_path: 'D:/runtime/openclaw.exe',
      runtime_version: '1.2.3',
      runtime_download_url: null,
      skills_dir_ready: false,
      mcp_config_ready: false,
      work_dir: 'D:/runtime/work',
      log_dir: 'D:/runtime/logs',
    },
    runtimeInstallProgress: null,
    startupDiagnostics: null,
    lastRuntimeProgress: 0,
  });

  assert.equal(view.state, 'loading');
  assert.equal(view.stepLabel, '正在补齐运行环境资源');
  assert.equal(view.errorMessage, null);
});
