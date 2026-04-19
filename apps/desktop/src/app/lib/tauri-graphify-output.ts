import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './desktop-runtime.ts';

export async function readGraphifyOutputText(path: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<string>('read_graphify_output_text', { path });
}

export async function openGraphifyOutputFile(path: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }
  return invoke<boolean>('open_graphify_output_file', { path });
}
