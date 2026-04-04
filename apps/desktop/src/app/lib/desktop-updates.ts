import type { DesktopUpdateHint } from '@iclaw/sdk';
import { BRAND } from './brand.ts';
import { readCacheString, writeCacheString } from './persistence/cache-store.ts';
import { readDesktopConfigSection, writeDesktopConfigSection } from './persistence/config-store.ts';
import { isTauriRuntime } from './tauri-sidecar.ts';

const DESKTOP_UPDATE_SKIPPED_VERSION_KEY = `${BRAND.storage.namespace}:desktop.update.skipped_version`;
const DESKTOP_UPDATE_CONFIG_SECTION = 'desktop-update';

export type DesktopUpdateEnforcementState = 'recommended' | 'required_after_run' | 'required_now';
export type DesktopUpdateGateState =
  | 'none'
  | 'recommended'
  | 'required_waiting_current_run'
  | 'required_blocked'
  | 'ready_to_restart';

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

type DesktopUpdateConfig = {
  skippedVersion?: string | null;
};

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readDesktopUpdateConfig(): DesktopUpdateConfig {
  if (!isTauriRuntime()) {
    return {
      skippedVersion: trimString(readCacheString(DESKTOP_UPDATE_SKIPPED_VERSION_KEY)) || null,
    };
  }
  const stored = readDesktopConfigSection<DesktopUpdateConfig>(DESKTOP_UPDATE_CONFIG_SECTION);
  return stored && typeof stored === 'object'
    ? {
        skippedVersion: trimString(stored.skippedVersion) || null,
      }
    : { skippedVersion: null };
}

async function writeDesktopUpdateConfig(next: DesktopUpdateConfig): Promise<void> {
  if (!isTauriRuntime()) {
    writeCacheString(DESKTOP_UPDATE_SKIPPED_VERSION_KEY, next.skippedVersion || null);
    return;
  }
  await writeDesktopConfigSection(DESKTOP_UPDATE_CONFIG_SECTION, {
    skippedVersion: next.skippedVersion || null,
  });
}

export function formatDesktopUpdateVersion(version: string): string {
  return trimString(version).split('+', 1)[0] || version;
}

export function readSkippedDesktopUpdateVersion(): string | null {
  return readDesktopUpdateConfig().skippedVersion || null;
}

export async function writeSkippedDesktopUpdateVersion(version: string | null): Promise<void> {
  await writeDesktopUpdateConfig({
    skippedVersion: trimString(version) || null,
  });
}

export function normalizeDesktopUpdateEnforcementState(
  hint: Pick<DesktopUpdateHint, 'mandatory' | 'enforcementState'> | null | undefined,
): DesktopUpdateEnforcementState {
  if (!hint) {
    return 'recommended';
  }
  if (hint.enforcementState === 'required_after_run' || hint.enforcementState === 'required_now') {
    return hint.enforcementState;
  }
  return hint.mandatory ? 'required_after_run' : 'recommended';
}

export function resolveDesktopUpdateGateState(input: {
  hint: DesktopUpdateHint | null;
  skippedVersion: string | null;
  currentRunBusy: boolean;
  readyToRestart: boolean;
}): DesktopUpdateGateState {
  const { hint, skippedVersion, currentRunBusy, readyToRestart } = input;
  if (!hint?.updateAvailable) {
    return 'none';
  }
  if (readyToRestart) {
    return hint.mandatory ? 'ready_to_restart' : 'recommended';
  }
  const enforcementState = normalizeDesktopUpdateEnforcementState(hint);
  if (enforcementState === 'required_now') {
    return 'required_blocked';
  }
  if (enforcementState === 'required_after_run') {
    return currentRunBusy ? 'required_waiting_current_run' : 'required_blocked';
  }
  return hint.latestVersion === skippedVersion ? 'none' : 'recommended';
}

export function resolveDesktopUpdatePolicyLabel(
  hint: Pick<DesktopUpdateHint, 'mandatory' | 'enforcementState'> | null | undefined,
): string {
  const enforcementState = normalizeDesktopUpdateEnforcementState(hint);
  if (enforcementState === 'required_now') {
    return '立即强更';
  }
  if (enforcementState === 'required_after_run') {
    return '任务结束后强更';
  }
  return '常规提醒';
}

export function shouldShowDesktopUpdateHint(
  hint: DesktopUpdateHint | null,
  skippedVersion: string | null,
): hint is DesktopUpdateHint {
  return resolveDesktopUpdateGateState({
    hint,
    skippedVersion,
    currentRunBusy: false,
    readyToRestart: false,
  }) !== 'none';
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
