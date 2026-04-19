import { invoke } from '@tauri-apps/api/core';
import type { AgentCatalogEntryData } from '@iclaw/sdk';
import { isTauriRuntime } from './desktop-runtime';

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readMetadataStringArray(metadata: Record<string, unknown> | null | undefined, key: string): string[] {
  const value = metadata?.[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
}

export type NativeAgentSyncInput = {
  slug: string;
  name: string;
  description: string;
  systemPrompt: string | null;
  skillSlugs: string[];
  sourceUrl: string | null;
  sourceRepo: string | null;
  avatarUrl: string | null;
  avatarEmoji: string | null;
  category: string | null;
  surface: string | null;
};

export type NativeAgentSyncRecord = {
  agentId: string;
  slug: string;
  agentDir: string;
  sessionsDir: string;
  workspaceDir: string;
  manifestPath: string;
};

export function toNativeAgentSyncInput(
  agent: Pick<AgentCatalogEntryData, 'slug' | 'name' | 'description' | 'category' | 'metadata'>,
): NativeAgentSyncInput {
  return {
    slug: agent.slug,
    name: agent.name,
    description: agent.description,
    systemPrompt: readMetadataString(agent.metadata, 'system_prompt'),
    skillSlugs: readMetadataStringArray(agent.metadata, 'skill_slugs'),
    sourceUrl: readMetadataString(agent.metadata, 'source_url'),
    sourceRepo: readMetadataString(agent.metadata, 'source_repo'),
    avatarUrl: readMetadataString(agent.metadata, 'avatar_url'),
    avatarEmoji: readMetadataString(agent.metadata, 'avatar_emoji'),
    category: typeof agent.category === 'string' && agent.category.trim() ? agent.category.trim() : null,
    surface: readMetadataString(agent.metadata, 'surface'),
  };
}

export async function reconcileNativeAgentsLocally(
  agents: Array<Pick<AgentCatalogEntryData, 'slug' | 'name' | 'description' | 'category' | 'metadata'>>,
): Promise<NativeAgentSyncRecord[]> {
  if (!isTauriRuntime() || agents.length === 0) {
    return [];
  }
  return await invoke<NativeAgentSyncRecord[]>('reconcile_native_agents', {
    inputs: agents.map((agent) => toNativeAgentSyncInput(agent)),
  });
}

export async function removeNativeAgentsLocally(slugs: string[]): Promise<string[]> {
  if (!isTauriRuntime() || slugs.length === 0) {
    return [];
  }
  return await invoke<string[]>('remove_native_agents', { slugs });
}
