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

export interface RuntimeInstallProgress {
  phase: string;
  progress: number;
  label: string;
  detail: string;
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
