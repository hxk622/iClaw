type DesktopRuntimeProbe = {
  hasTauriInternals?: boolean | null;
  locationProtocol?: string | null;
  locationHostname?: string | null;
};

function normalizeProbeValue(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

export function isTauriLikeLocation(probe: Pick<DesktopRuntimeProbe, 'locationProtocol' | 'locationHostname'>): boolean {
  const protocol = normalizeProbeValue(probe.locationProtocol);
  const hostname = normalizeProbeValue(probe.locationHostname);
  if (protocol === 'tauri:') {
    return true;
  }
  if (!hostname) {
    return false;
  }
  return hostname === 'tauri.localhost' || hostname === 'tauri' || hostname.endsWith('.tauri.localhost');
}

export function isDesktopShellEnvironment(probe: DesktopRuntimeProbe): boolean {
  if (probe.hasTauriInternals) {
    return true;
  }
  return isTauriLikeLocation(probe);
}

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return isDesktopShellEnvironment({
    hasTauriInternals: '__TAURI_INTERNALS__' in window,
    locationProtocol: window.location?.protocol,
    locationHostname: window.location?.hostname,
  });
}
