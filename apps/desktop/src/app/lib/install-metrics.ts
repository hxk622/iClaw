export function shouldTrackInstallStart(input: {
  isTauriRuntime: boolean;
  shouldShowStartupGate: boolean;
  installStartTracked: boolean;
}): boolean {
  return input.isTauriRuntime && input.shouldShowStartupGate && !input.installStartTracked;
}

export function shouldTrackInstallSuccess(input: {
  isTauriRuntime: boolean;
  healthy: boolean;
  installStartTracked: boolean;
  installSuccessTracked: boolean;
}): boolean {
  return input.isTauriRuntime && input.healthy && input.installStartTracked && !input.installSuccessTracked;
}

export function resolveInstallFailureStage(input: {
  runtimeInstallProgressPhase?: string | null;
  healthError?: string | null;
}): string {
  const phase = `${input.runtimeInstallProgressPhase || ''}`.trim();
  if (phase) {
    return phase;
  }
  if (`${input.healthError || ''}`.trim()) {
    return 'startup_healthcheck';
  }
  return 'runtime_install';
}

export function buildInstallFailureDiagnostic(input: {
  installerState: 'loading' | 'error';
  errorTitle?: string | null;
  errorMessage?: string | null;
  runtimeInstallProgressPhase?: string | null;
  healthError?: string | null;
}): { failureStage: string; title: string; message: string; signature: string } | null {
  if (input.installerState !== 'error') {
    return null;
  }
  const title = `${input.errorTitle || ''}`.trim() || '安装失败';
  const message = `${input.errorMessage || input.healthError || ''}`.trim() || '安装或启动过程中发生错误';
  const failureStage = resolveInstallFailureStage({
    runtimeInstallProgressPhase: input.runtimeInstallProgressPhase,
    healthError: input.healthError,
  });
  return {
    failureStage,
    title,
    message,
    signature: `${title}::${message}::${failureStage}`,
  };
}
