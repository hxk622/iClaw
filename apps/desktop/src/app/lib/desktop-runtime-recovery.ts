export type DesktopRuntimeRecoveryResult =
  | 'unsupported'
  | 'healthy'
  | 'restarted'
  | 'restarting'
  | 'cooldown'
  | 'failed';

export type DesktopRuntimeRecoveryState = {
  inFlight: Promise<DesktopRuntimeRecoveryResult> | null;
  lastRestartAt: number;
};

export type DesktopRuntimeRecoveryDeps = {
  isTauriRuntime: boolean;
  cooldownMs?: number;
  now?: () => number;
  healthCheck: () => Promise<void>;
  refreshGatewayAuth: () => Promise<unknown>;
  syncBrandRuntimeSnapshot: () => Promise<void>;
  stopSidecar: () => Promise<boolean>;
  startSidecar: (args: string[]) => Promise<boolean>;
  sidecarArgs: string[];
  waitForHealth: () => Promise<boolean>;
};

export async function ensureDesktopRuntimeReadyForChatRecovery(
  state: DesktopRuntimeRecoveryState,
  deps: DesktopRuntimeRecoveryDeps,
): Promise<DesktopRuntimeRecoveryResult> {
  if (!deps.isTauriRuntime) {
    return 'unsupported';
  }

  try {
    await deps.healthCheck();
    return 'healthy';
  } catch {
    // fall through to controlled restart
  }

  if (state.inFlight) {
    return 'restarting';
  }

  const now = deps.now ?? Date.now;
  const cooldownMs = Math.max(0, deps.cooldownMs ?? 15_000);
  if (cooldownMs > 0 && now() - state.lastRestartAt < cooldownMs) {
    return 'cooldown';
  }

  state.lastRestartAt = now();
  const run = (async (): Promise<DesktopRuntimeRecoveryResult> => {
    try {
      await deps.refreshGatewayAuth();
      await deps.syncBrandRuntimeSnapshot();
      await deps.stopSidecar();
      await deps.startSidecar(deps.sidecarArgs);
      const healthy = await deps.waitForHealth();
      return healthy ? 'restarted' : 'failed';
    } catch {
      return 'failed';
    } finally {
      state.inFlight = null;
    }
  })();

  state.inFlight = run;
  return run;
}
