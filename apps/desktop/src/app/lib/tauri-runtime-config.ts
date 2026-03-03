import { invoke } from '@tauri-apps/api/core';

export interface RuntimeConfig {
  openai_api_key?: string | null;
  anthropic_api_key?: string | null;
  clawhub_url?: string | null;
}

export interface RuntimeDiagnosis {
  sidecar_binary_found: boolean;
  skills_dir_ready: boolean;
  mcp_config_ready: boolean;
  api_key_configured: boolean;
  sidecar_path: string | null;
  skills_dir: string;
  mcp_config: string;
  work_dir: string;
  log_dir: string;
  cache_dir: string;
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

export async function diagnoseRuntime(): Promise<RuntimeDiagnosis | null> {
  if (!isTauriRuntime()) return null;
  return invoke<RuntimeDiagnosis>('diagnose_runtime');
}
