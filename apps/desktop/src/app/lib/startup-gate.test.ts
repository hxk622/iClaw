import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInstallerViewModel } from './startup-gate.ts';
import { resolveDesktopStartupSnapshot } from './startup-orchestrator.ts';

test('buildInstallerViewModel classifies runtime source issues as install-stage failures', () => {
  const view = buildInstallerViewModel({
    brandDisplayName: 'iClaw',
    runtimeReady: false,
    runtimeChecking: false,
    runtimeInstalling: false,
    healthy: false,
    healthError: null,
    runtimeInstallError: null,
    runtimeDiagnosis: {
      runtime_found: false,
      runtime_installable: false,
      runtime_path: null,
      runtime_version: null,
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

  assert.equal(view.state, 'error');
  assert.equal(view.title, '运行环境缺失');
  assert.equal(view.errorTitle, '缺少可用 runtime 来源');
});

test('buildInstallerViewModel keeps probing state while runtime diagnosis is still unavailable', () => {
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
  assert.equal(view.title, 'iClaw 正在苏醒');
  assert.equal(view.stepLabel, '正在检查本地引擎');
  assert.equal(view.errorMessage, null);
});

test('buildInstallerViewModel does not classify existing runtime as missing source while init artifacts are still catching up', () => {
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
  assert.equal(view.title, 'iClaw 正在苏醒');
  assert.equal(view.errorMessage, null);
});

test('buildInstallerViewModel classifies missing initialization artifacts separately from startup failure', () => {
  const view = buildInstallerViewModel({
    brandDisplayName: 'iClaw',
    runtimeReady: true,
    runtimeChecking: false,
    runtimeInstalling: false,
    initialHealthResolved: true,
    healthy: false,
    healthError: 'health check failed',
    runtimeInstallError: null,
    runtimeDiagnosis: {
      runtime_found: true,
      runtime_installable: true,
      runtime_path: 'D:/runtime/openclaw.exe',
      runtime_version: '1.2.3',
      runtime_download_url: 'https://downloads.example.com/runtime.zip',
      skills_dir_ready: false,
      mcp_config_ready: true,
      work_dir: 'D:/runtime/work',
      log_dir: 'D:/runtime/logs',
    },
    runtimeInstallProgress: null,
    startupDiagnostics: null,
    lastRuntimeProgress: 90,
  });

  assert.equal(view.state, 'error');
  assert.equal(view.title, '首次启动初始化失败');
  assert.equal(view.errorTitle, '初始化产物不完整');
});

test('buildInstallerViewModel surfaces startup diagnostics for sidecar failures', () => {
  const view = buildInstallerViewModel({
    brandDisplayName: 'iClaw',
    runtimeReady: true,
    runtimeChecking: false,
    runtimeInstalling: false,
    initialHealthResolved: true,
    healthy: false,
    healthError: '无法连接本地 API，请确认已启动并监听 http://127.0.0.1:2126',
    runtimeInstallError: null,
    runtimeDiagnosis: {
      runtime_found: true,
      runtime_installable: true,
      runtime_path: 'D:/runtime/openclaw.exe',
      runtime_version: '1.2.3',
      runtime_download_url: 'https://downloads.example.com/runtime.zip',
      skills_dir_ready: true,
      mcp_config_ready: true,
      work_dir: 'D:/runtime/work',
      log_dir: 'D:/runtime/logs',
    },
    runtimeInstallProgress: null,
    startupDiagnostics: {
      bootstrapLogPath: 'D:/runtime/logs/desktop-bootstrap.log',
      sidecarStdoutLogPath: 'D:/runtime/logs/sidecar-stdout.log',
      sidecarStderrLogPath: 'D:/runtime/logs/sidecar-stderr.log',
      bootstrapTail: 'start_sidecar: child running',
      sidecarStdoutTail: null,
      sidecarStderrTail: 'panic: failed to bind port 2126',
    },
    lastRuntimeProgress: 96,
  });

  assert.equal(view.state, 'error');
  assert.equal(view.title, '本地服务启动失败');
  assert.ok(view.diagnosticItems.some((item) => item.label === '最近 stderr'));
  assert.ok(view.diagnosticItems.some((item) => item.label === 'Bootstrap 日志'));
});

test('resolveDesktopStartupSnapshot keeps startup in loading while local service health is still unresolved', () => {
  const snapshot = resolveDesktopStartupSnapshot({
    isTauriRuntime: true,
    runtimeChecking: false,
    runtimeInstalling: false,
    runtimeReady: true,
    runtimeInstallError: null,
    runtimeDiagnosis: {
      runtime_found: true,
      runtime_installable: true,
      skills_dir_ready: true,
      mcp_config_ready: true,
    },
    initialHealthResolved: false,
    healthChecking: false,
    healthy: false,
    healthError: '无法连接本地 API，请确认已启动并监听 http://127.0.0.1:2126',
  });

  assert.equal(snapshot.state, 'loading');
  assert.equal(snapshot.phase, 'starting_local_service');
  assert.equal(snapshot.shouldShowError, false);
});

test('resolveDesktopStartupSnapshot classifies runtime install errors as terminal install-stage failures', () => {
  const snapshot = resolveDesktopStartupSnapshot({
    isTauriRuntime: true,
    runtimeChecking: false,
    runtimeInstalling: false,
    runtimeReady: false,
    runtimeInstallError: '下载 runtime 失败：network timeout',
    runtimeDiagnosis: {
      runtime_found: false,
      runtime_installable: true,
      skills_dir_ready: false,
      mcp_config_ready: false,
    },
    initialHealthResolved: false,
    healthChecking: false,
    healthy: false,
    healthError: null,
  });

  assert.equal(snapshot.state, 'error');
  assert.equal(snapshot.phase, 'blocked_runtime_install');
  assert.equal(snapshot.shouldShowError, true);
});

test('buildInstallerViewModel preserves raw runtime install errors', () => {
  const view = buildInstallerViewModel({
    brandDisplayName: 'iClaw',
    runtimeReady: false,
    runtimeChecking: false,
    runtimeInstalling: false,
    healthy: false,
    healthError: null,
    runtimeInstallError:
      'failed to stage bundled runtime archive C:/bundle.tar.gz -> C:/Users/test/runtime.tar.gz: Access is denied. (os error 5)',
    runtimeDiagnosis: {
      runtime_found: false,
      runtime_installable: true,
      runtime_path: null,
      runtime_version: '2026.3.13',
      runtime_download_url: 'https://downloads.example.com/runtime.tar.gz',
      skills_dir_ready: true,
      mcp_config_ready: true,
      work_dir: 'D:/runtime/work',
      log_dir: 'D:/runtime/logs',
    },
    runtimeInstallProgress: null,
    startupDiagnostics: null,
    lastRuntimeProgress: 12,
  });

  assert.equal(view.state, 'error');
  assert.match(view.errorMessage || '', /Access is denied/);
});
