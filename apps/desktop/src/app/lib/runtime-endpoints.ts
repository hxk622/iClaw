function trimUrl(value: string | null | undefined): string {
  return (value || '').trim().replace(/\/+$/, '');
}

function isLoopbackHostname(hostname: string | null | undefined): boolean {
  const normalized = (hostname || '').trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

export function resolveDesktopAuthBaseUrl(input: {
  envAuthBaseUrl?: string | null | undefined;
  brandAuthBaseUrl?: string | null | undefined;
  localAuthBaseUrl: string;
  isTauriRuntime: boolean;
  locationHostname?: string | null | undefined;
}): string {
  const envAuthBaseUrl = trimUrl(input.envAuthBaseUrl);
  if (envAuthBaseUrl) {
    return envAuthBaseUrl;
  }

  const localAuthBaseUrl = trimUrl(input.localAuthBaseUrl);
  const brandAuthBaseUrl = trimUrl(input.brandAuthBaseUrl);
  const shouldPreferLocal = input.isTauriRuntime || isLoopbackHostname(input.locationHostname);

  if (shouldPreferLocal && localAuthBaseUrl) {
    return localAuthBaseUrl;
  }
  if (brandAuthBaseUrl) {
    return brandAuthBaseUrl;
  }
  return localAuthBaseUrl;
}

export { isLoopbackHostname };
