import { isDesktopShellEnvironment } from './desktop-runtime.ts';

function trimUrl(value: string | null | undefined): string {
  return (value || '').trim().replace(/\/+$/, '');
}

function isLoopbackHostname(hostname: string | null | undefined): boolean {
  const normalized = (hostname || '').trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

export function resolveDesktopAuthBaseUrl(input: {
  envAuthBaseUrl?: string | null | undefined;
  envDesktopAuthBaseUrl?: string | null | undefined;
  localAuthBaseUrl: string;
  isTauriRuntime: boolean;
  locationHostname?: string | null | undefined;
  locationProtocol?: string | null | undefined;
}): string {
  const localAuthBaseUrl = trimUrl(input.localAuthBaseUrl);
  const envDesktopAuthBaseUrl = trimUrl(input.envDesktopAuthBaseUrl);
  const envAuthBaseUrl = trimUrl(input.envAuthBaseUrl);
  const shouldPreferLocal =
    isLoopbackHostname(input.locationHostname) ||
    isDesktopShellEnvironment({
      hasTauriInternals: input.isTauriRuntime,
      locationHostname: input.locationHostname,
      locationProtocol: input.locationProtocol,
    });

  if (shouldPreferLocal) {
    return envDesktopAuthBaseUrl || localAuthBaseUrl || envAuthBaseUrl;
  }
  if (envAuthBaseUrl) {
    return envAuthBaseUrl;
  }
  return envDesktopAuthBaseUrl || localAuthBaseUrl;
}

export { isLoopbackHostname };
