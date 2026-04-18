import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './tauri-sidecar';

export interface ResolvedWorkspaceArtifactPath {
  path: string;
  extension: string | null;
  sizeBytes: number;
}

export interface WorkspaceArtifactBinaryPayload extends ResolvedWorkspaceArtifactPath {
  mimeType: string;
  base64: string;
}

export async function resolveWorkspaceArtifactPath(path: string): Promise<ResolvedWorkspaceArtifactPath | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<ResolvedWorkspaceArtifactPath>('resolve_workspace_artifact_path', { path });
}

export async function readWorkspaceArtifactBase64(path: string): Promise<WorkspaceArtifactBinaryPayload | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WorkspaceArtifactBinaryPayload>('read_workspace_artifact_base64', { path });
}

export async function openWorkspaceArtifact(path: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }
  return invoke<boolean>('open_workspace_artifact', { path });
}
