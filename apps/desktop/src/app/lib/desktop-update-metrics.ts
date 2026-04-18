import type { DesktopUpdateHint } from '@iclaw/sdk';
import { normalizeDesktopUpdateEnforcementState, resolveDesktopUpdateIdentity } from './desktop-updates';

export type DesktopUpdateMetricEventName =
  | 'desktop_update_check'
  | 'desktop_update_execute_start'
  | 'desktop_update_native_start'
  | 'desktop_update_installer_launch'
  | 'desktop_update_external_open'
  | 'desktop_update_execute_failed'
  | 'desktop_update_skip'
  | 'desktop_update_restart_success';

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildDesktopUpdateMetricPayload(input: {
  hint?: DesktopUpdateHint | null;
  currentVersion: string;
  releaseChannel: 'dev' | 'prod';
  runtimePlatform: string;
  updateMode?: 'native' | 'installer' | 'external' | 'unknown' | null;
  triggerSource?: 'manual' | 'auto_forced' | 'startup_restore' | 'background_check' | 'manual_check' | null;
  status?: string | null;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const hint = input.hint || null;
  return {
    rollout_id: trimString(hint?.rolloutId) || null,
    update_identity: resolveDesktopUpdateIdentity(hint),
    current_version: trimString(input.currentVersion) || null,
    target_version: trimString(hint?.latestVersion) || null,
    update_available: hint?.updateAvailable ?? false,
    mandatory: hint?.mandatory ?? false,
    enforcement_state: normalizeDesktopUpdateEnforcementState(hint),
    block_new_runs: hint?.blockNewRuns ?? false,
    reason_code: trimString(hint?.reasonCode) || null,
    release_channel: input.releaseChannel,
    runtime_platform: trimString(input.runtimePlatform) || null,
    update_mode: input.updateMode || null,
    trigger_source: input.triggerSource || null,
    status: input.status || null,
    ...(input.extra || {}),
  };
}

export function resolveDesktopUpdateMetricErrorCode(error: unknown): string | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes('sha256')) {
    return 'installer_sha256_verification_failed';
  }
  if (normalized.includes('no pending desktop update')) {
    return 'native_update_missing';
  }
  if (normalized.includes('failed to check desktop update')) {
    return 'desktop_update_check_failed';
  }
  if (normalized.includes('desktop installer')) {
    return 'desktop_installer_launch_failed';
  }
  if (normalized.includes('download')) {
    return 'desktop_update_download_failed';
  }
  if (normalized.includes('current update source')) {
    return 'desktop_update_source_invalid';
  }
  return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || null;
}
