import { saveOemRuntimeSnapshot } from './tauri-runtime-config';

type PublicBrandConfigResponse = {
  success?: boolean;
  data?: {
    brand?: {
      brandId?: string | null;
      displayName?: string | null;
    } | null;
    app?: {
      appName?: string | null;
    } | null;
    publishedVersion?: number | null;
    config?: Record<string, unknown> | null;
  } | null;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

export async function syncPublishedBrandRuntimeSnapshot(input: {
  authBaseUrl: string;
  brandId: string;
}): Promise<boolean> {
  const brandId = input.brandId.trim();
  const authBaseUrl = input.authBaseUrl.trim();
  if (!brandId || !authBaseUrl) {
    return false;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      joinUrl(authBaseUrl, `/portal/public-config?app_name=${encodeURIComponent(brandId)}`),
      {
        method: 'GET',
        signal: controller.signal,
      },
    );
    const payload = (await response.json().catch(() => ({}))) as PublicBrandConfigResponse;
    const data = payload?.data;
    if (
      !response.ok ||
      !payload?.success ||
      !data?.config ||
      typeof data.config !== 'object' ||
      Array.isArray(data.config)
    ) {
      throw new Error(`failed to load OEM runtime config (${response.status})`);
    }

    return saveOemRuntimeSnapshot({
      brandId: String(data.brand?.brandId || data.app?.appName || brandId),
      publishedVersion:
        typeof data.publishedVersion === 'number' && Number.isFinite(data.publishedVersion)
          ? data.publishedVersion
          : 0,
      config: data.config,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}
