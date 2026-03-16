import type { DesktopUpdateHint } from '@iclaw/sdk';
import { BRAND } from './brand';

const DESKTOP_UPDATE_SKIPPED_VERSION_KEY = `${BRAND.storage.namespace}:desktop.update.skipped_version`;

type DesktopReleaseTargetManifest = {
  entry?: {
    artifact_url?: string | null;
  } | null;
};

type DesktopReleaseIndexManifest = {
  entries?: Array<{
    artifact_url?: string | null;
  }> | null;
};

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function formatDesktopUpdateVersion(version: string): string {
  return trimString(version).split('+', 1)[0] || version;
}

export function readSkippedDesktopUpdateVersion(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(DESKTOP_UPDATE_SKIPPED_VERSION_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export function writeSkippedDesktopUpdateVersion(version: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!version) {
      window.localStorage.removeItem(DESKTOP_UPDATE_SKIPPED_VERSION_KEY);
      return;
    }
    window.localStorage.setItem(DESKTOP_UPDATE_SKIPPED_VERSION_KEY, version);
  } catch {}
}

export function shouldShowDesktopUpdateHint(
  hint: DesktopUpdateHint | null,
  skippedVersion: string | null,
): hint is DesktopUpdateHint {
  if (!hint?.updateAvailable) return false;
  if (hint.mandatory) return true;
  return hint.latestVersion !== skippedVersion;
}

export async function resolveDesktopUpdateArtifactUrl(hint: DesktopUpdateHint): Promise<string | null> {
  const directArtifactUrl = trimString(hint.artifactUrl);
  if (directArtifactUrl) return directArtifactUrl;

  const manifestUrl = trimString(hint.manifestUrl);
  if (!manifestUrl) return null;

  const response = await fetch(manifestUrl, {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`无法获取更新信息：${response.status}`);
  }

  const payload = (await response.json()) as DesktopReleaseTargetManifest | DesktopReleaseIndexManifest;
  const targetArtifactUrl = trimString((payload as DesktopReleaseTargetManifest)?.entry?.artifact_url);
  if (targetArtifactUrl) return targetArtifactUrl;

  const firstArtifactUrl = Array.isArray((payload as DesktopReleaseIndexManifest)?.entries)
    ? trimString((payload as DesktopReleaseIndexManifest).entries?.[0]?.artifact_url)
    : '';
  return firstArtifactUrl || null;
}
