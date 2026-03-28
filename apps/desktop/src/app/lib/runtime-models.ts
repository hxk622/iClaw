import type { GatewayModelCatalogEntry } from './model-catalog';

export type RuntimeModelCatalogResponse = {
  appName: string;
  providerMode: string;
  resolvedScope: string;
  profile: {
    providerKey: string;
    providerLabel: string;
    logoPresetKey: string | null;
  } | null;
  models: Array<{
    modelRef: string;
    modelId: string;
    label: string;
    logoPresetKey: string | null;
    billingMultiplier: number | null;
    billing_multiplier?: number | null;
    reasoning: boolean;
    inputModalities: string[];
    contextWindow: number | null;
    maxTokens: number | null;
    enabled: boolean;
  }>;
  version: number;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

export async function fetchRuntimeModelCatalog(input: {
  authBaseUrl: string;
  appName: string;
}): Promise<RuntimeModelCatalogResponse> {
  const authBaseUrl = input.authBaseUrl.trim();
  const appName = input.appName.trim();
  if (!authBaseUrl || !appName) {
    throw new Error('runtime model catalog requires authBaseUrl and appName');
  }
  const response = await fetch(
    joinUrl(authBaseUrl, `/portal/runtime/models?app_name=${encodeURIComponent(appName)}`),
    {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: RuntimeModelCatalogResponse; error?: { message?: string } }
    | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error?.message || 'runtime model catalog unavailable');
  }
  return payload.data;
}

export function mapRuntimeModelsToGatewayEntries(
  payload: RuntimeModelCatalogResponse,
): GatewayModelCatalogEntry[] {
  const provider = String(payload.profile?.providerKey || '').trim() || 'generic';
  return (payload.models || [])
    .filter((entry) => entry.enabled !== false)
    .map((entry) => ({
      id: String(entry.modelRef || entry.modelId || '').trim(),
      name: String(entry.label || entry.modelId || '').trim(),
      provider,
      logoPresetKey: typeof entry.logoPresetKey === 'string' && entry.logoPresetKey.trim() ? entry.logoPresetKey.trim() : null,
      billingMultiplier:
        typeof entry.billingMultiplier === 'number' && Number.isFinite(entry.billingMultiplier)
          ? entry.billingMultiplier
          : typeof entry.billing_multiplier === 'number' && Number.isFinite(entry.billing_multiplier)
            ? entry.billing_multiplier
          : undefined,
      contextWindow: typeof entry.contextWindow === 'number' ? entry.contextWindow : undefined,
      reasoning: Boolean(entry.reasoning),
      input: Array.isArray(entry.inputModalities)
        ? entry.inputModalities.filter(
            (item): item is 'text' | 'image' => item === 'text' || item === 'image',
          )
        : undefined,
    }))
    .filter((entry) => entry.id);
}
