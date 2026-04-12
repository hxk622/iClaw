import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface RuntimeConfig {
  openai_api_key?: string | null;
  openai_base_url?: string | null;
  openai_model?: string | null;
  anthropic_api_key?: string | null;
  clawhub_url?: string | null;
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
  report_id?: string | null;
  entry: 'installer' | 'exception-dialog';
  install_session_id?: string | null;
  app_name?: string | null;
  brand_id?: string | null;
  app_version?: string | null;
  release_channel?: string | null;
  failure_stage: string;
  error_title: string;
  error_message: string;
  error_code?: string | null;
  runtime_found?: boolean | null;
  runtime_installable?: boolean | null;
  runtime_version?: string | null;
  runtime_path?: string | null;
  work_dir?: string | null;
  log_dir?: string | null;
  runtime_download_url?: string | null;
  install_progress_phase?: string | null;
  install_progress_percent?: number | null;
  extra_diagnostics?: Record<string, unknown> | null;
}

export interface PreparedDesktopFaultReportArchive {
  report_id: string;
  device_id: string;
  platform: string;
  platform_version: string | null;
  arch: string;
  file_name: string;
  file_size_bytes: number;
  file_sha256: string;
  archive_base64: string;
  payload: Record<string, unknown>;
}

export interface DesktopClientMetricsContext {
  device_id: string;
  platform: string;
  platform_version: string | null;
  arch: string;
  app_version: string;
  brand_id: string;
}

export interface OemRuntimeSnapshot {
  brandId: string;
  publishedVersion: number;
  config: Record<string, unknown>;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
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
  return invoke<boolean>('install_runtime');
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
