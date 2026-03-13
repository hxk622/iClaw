import { invoke } from '@tauri-apps/api/core';
import type { SettingsState } from '@/app/contexts/settings-context';
import { isTauriRuntime } from '@/app/lib/tauri-sidecar';

export interface IclawWorkspaceFiles {
  workspace_dir: string;
  identity_md: string;
  user_md: string;
  soul_md: string;
  agents_md: string;
  finance_decision_framework_md: string;
}

export interface IclawWorkspaceBackupPayload {
  identity_md: string;
  user_md: string;
  soul_md: string;
  agents_md: string;
}

export type WorkspaceMarkdownSection = 'identity' | 'user-profile' | 'soul-persona';

const WORKSPACE_UPDATED_EVENT = 'iclaw-workspace-updated';
const WORKSPACE_DEV_ENDPOINT = '/__iclaw/workspace-files';

export function notifyIclawWorkspaceUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WORKSPACE_UPDATED_EVENT));
}

export function onIclawWorkspaceUpdated(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = () => listener();
  window.addEventListener(WORKSPACE_UPDATED_EVENT, handler);
  return () => window.removeEventListener(WORKSPACE_UPDATED_EVENT, handler);
}

export async function loadIclawWorkspaceFiles(): Promise<IclawWorkspaceFiles | null> {
  if (!isTauriRuntime()) {
    try {
      const response = await fetch(WORKSPACE_DEV_ENDPOINT, {
        method: 'GET',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as IclawWorkspaceFiles;
    } catch {
      return null;
    }
  }

  return invoke<IclawWorkspaceFiles>('load_iclaw_workspace_files');
}

export async function resetIclawWorkspaceToDefaults(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  const result = await invoke<boolean>('reset_iclaw_workspace_to_defaults');
  notifyIclawWorkspaceUpdated();
  return result;
}

export async function applyIclawWorkspaceBackup(backup: IclawWorkspaceBackupPayload): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  const result = await invoke<boolean>('apply_iclaw_workspace_backup', { backup });
  notifyIclawWorkspaceUpdated();
  return result;
}

export async function saveIclawWorkspaceSection(
  section: WorkspaceMarkdownSection,
  content: string,
): Promise<boolean> {
  if (!isTauriRuntime()) {
    const payload =
      section === 'identity'
        ? { identity_md: content }
        : section === 'user-profile'
          ? { user_md: content }
          : { soul_md: content };
    const response = await fetch(WORKSPACE_DEV_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`workspace save failed: ${response.status}`);
    }
    notifyIclawWorkspaceUpdated();
    return true;
  }

  const result = await invoke<boolean>('save_iclaw_workspace_section', { section, content });
  notifyIclawWorkspaceUpdated();
  return result;
}

export async function saveIclawSettingsAndApply(settings: SettingsState): Promise<boolean> {
  if (!isTauriRuntime()) {
    localStorage.setItem('iclaw-settings', JSON.stringify(settings));
    try {
      const response = await fetch(WORKSPACE_DEV_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identity_md: settings.identity.markdownContent,
          user_md: settings.userProfile.markdownContent,
          soul_md: settings.soulPersona.markdownContent,
          agents_md: '',
        }),
      });
      if (!response.ok) {
        throw new Error(`workspace save failed: ${response.status}`);
      }
      notifyIclawWorkspaceUpdated();
      return true;
    } catch {
      return false;
    }
  }

  const result = await invoke<boolean>('save_iclaw_settings_and_apply', { settings });
  notifyIclawWorkspaceUpdated();
  return result;
}
