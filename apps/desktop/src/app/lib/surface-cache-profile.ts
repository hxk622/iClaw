import type { SurfacePoolLimits } from './surface-cache';

export function isWindowsDesktopRuntime(input: {
  isTauriRuntime: boolean;
  userAgent?: string | null;
  platform?: string | null;
}): boolean {
  if (!input.isTauriRuntime) {
    return false;
  }
  const userAgent = String(input.userAgent || '').toLowerCase();
  const platform = String(input.platform || '').toLowerCase();
  return userAgent.includes('windows') || platform.startsWith('win');
}

export function resolveSurfaceCacheLimits(input: {
  isTauriRuntime: boolean;
  userAgent?: string | null;
  platform?: string | null;
}): Partial<SurfacePoolLimits> {
  if (isWindowsDesktopRuntime(input)) {
    return {
      menu: 2,
      overlay: 3,
    };
  }
  return {};
}
