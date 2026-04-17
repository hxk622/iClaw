import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface RuntimeConfig {
  openai_api_key?: string | null;
  openai_base_url?: string | null;
  openai_model?: string | null;
  anthropic_api_key?: string | null;
  clawhub_url?: string | null;
  [key: string]: unknown;
}

export interface RuntimeDiagnosis {
  runtime_found: boolean;
  runtime_installable: boolean;
  runtime_source: string | null;
  runtime_path: string | null;
  runtime_version: string | null;
  runtime_download_url: string | null;
  skills_dir_ready: boolean;
  mcp_config_ready: boolean;
  api_key_configured: boolean;
  skills_dir: string;
  mcp_config: string;
  work_dir: string;
  log_dir: string;
  cache_dir: string;
}

export interface StartupDiagnosticsSnapshot {
  bootstrapLogPath: string;
  sidecarStdoutLogPath: string;
  sidecarStderrLogPath: string;
  bootstrapTail: string | null;
  sidecarStdoutTail: string | null;
  sidecarStderrTail: string | null;
}

export interface RuntimeInstallProgress {
  phase: string;
  progress: number;
  label: string;
  detail: string;
}

export interface DesktopFaultReportPrepareInput {
  reportId?: string | null;
  entry: 'installer' | 'exception-dialog';
  installSessionId?: string | null;
  appName?: string | null;
  brandId?: string | null;
  appVersion?: string | null;
  releaseChannel?: string | null;
  failureStage: string;
  errorTitle: string;
  errorMessage: string;
  errorCode?: string | null;
  runtimeFound?: boolean | null;
  runtimeInstallable?: boolean | null;
  runtimeVersion?: string | null;
  runtimePath?: string | null;
  workDir?: string | null;
  logDir?: string | null;
  runtimeDownloadUrl?: string | null;
  installProgressPhase?: string | null;
  installProgressPercent?: number | null;
  extraDiagnostics?: Record<string, unknown> | null;
}

export interface PreparedDesktopFaultReportArchive {
  reportId: string;
  deviceId: string;
  platform: string;
  platformVersion: string | null;
  arch: string;
  fileName: string;
  fileSizeBytes: number;
  fileSha256: string;
  archiveBase64: string;
  payload: Record<string, unknown>;
}

export interface DesktopClientMetricsContext {
  deviceId: string;
  platform: string;
  platformVersion: string | null;
  arch: string;
  appVersion: string;
  brandId: string;
}

export interface OemRuntimeSnapshot {
  brandId: string;
  publishedVersion: number;
  config: Record<string, unknown>;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function normalizeTauriError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message ? error : new Error(fallback);
  }
  if (typeof error === 'string') {
    const message = error.trim();
    return new Error(message || fallback);
  }
  if (error && typeof error === 'object') {
    const message =
      'message' in error && typeof error.message === 'string'
        ? error.message.trim()
        : 'error' in error && typeof error.error === 'string'
          ? error.error.trim()
          : '';
    if (message) {
      return new Error(message);
    }
  }
  return new Error(fallback);
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig | null> {
  if (!isTauriRuntime()) return null;
  return invoke<RuntimeConfig>('load_runtime_config');
}

export async function saveRuntimeConfig(config: RuntimeConfig): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('save_runtime_config', { config });
}

export async function installRuntime(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    return await invoke<boolean>('install_runtime');
  } catch (error) {
    throw normalizeTauriError(error, 'runtime install failed');
  }
}

export async function diagnoseRuntime(): Promise<RuntimeDiagnosis | null> {
  if (!isTauriRuntime()) return null;
  return invoke<RuntimeDiagnosis>('diagnose_runtime');
}

export async function loadStartupDiagnostics(): Promise<StartupDiagnosticsSnapshot | null> {
  if (!isTauriRuntime()) return null;
  return invoke<StartupDiagnosticsSnapshot>('load_startup_diagnostics');
}

export async function prepareDesktopFaultReportArchive(
  input: DesktopFaultReportPrepareInput,
): Promise<PreparedDesktopFaultReportArchive | null> {
  if (!isTauriRuntime()) return null;
  return invoke<PreparedDesktopFaultReportArchive>('prepare_desktop_fault_report_archive', { input });
}

export async function loadDesktopClientMetricsContext(): Promise<DesktopClientMetricsContext | null> {
  if (!isTauriRuntime()) return null;
  return invoke<DesktopClientMetricsContext>('load_desktop_client_metrics_context');
}

export async function listenRuntimeInstallProgress(
  handler: (payload: RuntimeInstallProgress) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) return () => {};
  const unlisten = await listen<RuntimeInstallProgress>('runtime-install-progress', (event) => {
    handler(event.payload);
  });
  return () => {
    void unlisten();
  };
}

export async function saveOemRuntimeSnapshot(snapshot: OemRuntimeSnapshot): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('save_oem_runtime_snapshot', { snapshot });
}

export async function loadOemRuntimeSnapshot(): Promise<OemRuntimeSnapshot | null> {
  if (!isTauriRuntime()) return null;
  return invoke<OemRuntimeSnapshot | null>('load_oem_runtime_snapshot');
}

export async function syncOemRuntimeSnapshot(input: {
  authBaseUrl: string;
  brandId: string;
}): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('sync_oem_runtime_snapshot', {
    authBaseUrl: input.authBaseUrl,
    brandId: input.brandId,
  });
}

export async function syncPortalProviderAuth(input: {
  authBaseUrl: string;
  brandId: string;
}): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('sync_portal_provider_auth', {
    authBaseUrl: input.authBaseUrl,
    brandId: input.brandId,
  });
}

export async function clearPortalProviderAuth(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('clear_portal_provider_auth');
}
