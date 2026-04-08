import type { RuntimeDiagnosis } from './tauri-runtime-config';

export type StartupOrchestratorRuntimeDiagnosis = Pick<
  RuntimeDiagnosis,
  'runtime_found' | 'runtime_installable' | 'skills_dir_ready' | 'mcp_config_ready'
>;

export type StartupOrchestratorInput = {
  isTauriRuntime: boolean;
  runtimeChecking: boolean;
  runtimeInstalling: boolean;
  runtimeReady: boolean;
  runtimeInstallError: string | null;
  runtimeDiagnosis: StartupOrchestratorRuntimeDiagnosis | null;
  initialHealthResolved: boolean;
  healthChecking: boolean;
  healthy: boolean;
  healthError: string | null;
};

export type DesktopStartupPhase =
  | 'ready'
  | 'probing_runtime'
  | 'installing_runtime'
  | 'preparing_runtime_assets'
  | 'starting_local_service'
  | 'verifying_local_service'
  | 'blocked_missing_runtime_source'
  | 'blocked_runtime_install'
  | 'blocked_port_conflict'
  | 'blocked_local_service';

export type DesktopStartupState = 'loading' | 'error' | 'ready';

export type DesktopStartupSnapshot = {
  state: DesktopStartupState;
  phase: DesktopStartupPhase;
  shouldShowGate: boolean;
  shouldShowError: boolean;
  runtimeAssetsPending: boolean;
  missingRuntimeSource: boolean;
  portConflictLikely: boolean;
};

function detectPortConflictMessage(message: string | null): boolean {
  if (!message) {
    return false;
  }
  return /端口|port|occupied|in use|冲突/i.test(message);
}

export function resolveDesktopStartupSnapshot(input: StartupOrchestratorInput): DesktopStartupSnapshot {
  if (!input.isTauriRuntime) {
    return {
      state: 'ready',
      phase: 'ready',
      shouldShowGate: false,
      shouldShowError: false,
      runtimeAssetsPending: false,
      missingRuntimeSource: false,
      portConflictLikely: false,
    };
  }

  const runtimeAssetsPending = Boolean(
    input.runtimeDiagnosis?.runtime_found &&
      (!input.runtimeDiagnosis.skills_dir_ready || !input.runtimeDiagnosis.mcp_config_ready),
  );
  const missingRuntimeSource = Boolean(
    input.runtimeDiagnosis &&
      !input.runtimeReady &&
      !input.runtimeInstalling &&
      !input.runtimeDiagnosis.runtime_found &&
      !input.runtimeDiagnosis.runtime_installable,
  );
  const portConflictLikely = detectPortConflictMessage(input.healthError);

  if (input.runtimeInstalling) {
    return {
      state: 'loading',
      phase: 'installing_runtime',
      shouldShowGate: true,
      shouldShowError: false,
      runtimeAssetsPending,
      missingRuntimeSource,
      portConflictLikely,
    };
  }

  if (input.runtimeChecking) {
    return {
      state: 'loading',
      phase: 'probing_runtime',
      shouldShowGate: true,
      shouldShowError: false,
      runtimeAssetsPending,
      missingRuntimeSource,
      portConflictLikely,
    };
  }

  if (!input.runtimeReady) {
    if (input.runtimeDiagnosis === null) {
      return {
        state: 'loading',
        phase: 'probing_runtime',
        shouldShowGate: true,
        shouldShowError: false,
        runtimeAssetsPending,
        missingRuntimeSource,
        portConflictLikely,
      };
    }

    if (missingRuntimeSource) {
      return {
        state: 'error',
        phase: 'blocked_missing_runtime_source',
        shouldShowGate: true,
        shouldShowError: true,
        runtimeAssetsPending,
        missingRuntimeSource,
        portConflictLikely,
      };
    }

    if (input.runtimeInstallError) {
      return {
        state: 'error',
        phase: 'blocked_runtime_install',
        shouldShowGate: true,
        shouldShowError: true,
        runtimeAssetsPending,
        missingRuntimeSource,
        portConflictLikely,
      };
    }

    return {
      state: 'loading',
      phase: runtimeAssetsPending ? 'preparing_runtime_assets' : 'probing_runtime',
      shouldShowGate: true,
      shouldShowError: false,
      runtimeAssetsPending,
      missingRuntimeSource,
      portConflictLikely,
    };
  }

  if (input.healthChecking) {
    return {
      state: 'loading',
      phase: 'verifying_local_service',
      shouldShowGate: true,
      shouldShowError: false,
      runtimeAssetsPending,
      missingRuntimeSource,
      portConflictLikely,
    };
  }

  if (!input.initialHealthResolved) {
    return {
      state: 'loading',
      phase: 'starting_local_service',
      shouldShowGate: true,
      shouldShowError: false,
      runtimeAssetsPending,
      missingRuntimeSource,
      portConflictLikely,
    };
  }

  if (input.healthy) {
    return {
      state: 'ready',
      phase: 'ready',
      shouldShowGate: false,
      shouldShowError: false,
      runtimeAssetsPending,
      missingRuntimeSource,
      portConflictLikely,
    };
  }

  if (input.healthError) {
    return {
      state: 'error',
      phase: portConflictLikely ? 'blocked_port_conflict' : 'blocked_local_service',
      shouldShowGate: true,
      shouldShowError: true,
      runtimeAssetsPending,
      missingRuntimeSource,
      portConflictLikely,
    };
  }

  return {
    state: 'loading',
    phase: 'verifying_local_service',
    shouldShowGate: true,
    shouldShowError: false,
    runtimeAssetsPending,
    missingRuntimeSource,
    portConflictLikely,
  };
}
