import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildInstallerViewModel,
  resolveShouldShowStartupGate,
  type InstallerViewModel,
} from './startup-gate';
import { startSidecarWithTimeout } from './sidecar-start-timeout.ts';
import { appendDesktopBootstrapLog, normalizeTauriError } from './tauri-runtime-config';
import type {
  RuntimeDiagnosis,
  RuntimeInstallProgress,
  StartupDiagnosticsSnapshot,
} from './tauri-runtime-config';

type WaitForClientHealthOptions = {
  attempts?: number;
  intervalMs?: number;
  suppressError?: boolean;
};

type DesktopStartupControllerParams = {
  isTauriRuntime: boolean;
  brandDisplayName: string;
  apiBaseUrl: string;
  sidecarArgs: string[];
  sidecarBootHealthcheckAttempts: number;
  sidecarBootHealthcheckIntervalMs: number;
  sidecarBootHealthcheckTimeoutMs: number;
  normalizeText?: (value: string) => string;
  diagnoseRuntime: () => Promise<RuntimeDiagnosis | null>;
  installRuntime: () => Promise<boolean>;
  loadStartupDiagnostics: () => Promise<StartupDiagnosticsSnapshot | null>;
  listenRuntimeInstallProgress: (handler: (payload: RuntimeInstallProgress) => void) => Promise<() => void>;
  ensureOpenClawCliAvailable: () => Promise<boolean>;
  startSidecar: (args: string[]) => Promise<boolean>;
  healthCheck: () => Promise<void>;
  resolvePortConflictMessage: () => Promise<string | null>;
  refreshGatewayAuth: () => Promise<unknown>;
  syncBrandRuntimeSnapshot: () => Promise<void>;
};

type DesktopStartupControllerResult = {
  healthChecking: boolean;
  healthy: boolean;
  healthError: string | null;
  initialHealthResolved: boolean;
  runtimeChecking: boolean;
  runtimeInstalling: boolean;
  runtimeInstallError: string | null;
  runtimeReady: boolean;
  runtimeDiagnosis: RuntimeDiagnosis | null;
  runtimeInstallProgress: RuntimeInstallProgress | null;
  startupDiagnostics: StartupDiagnosticsSnapshot | null;
  lastRuntimeProgress: number;
  installerView: InstallerViewModel;
  shouldShowStartupGate: boolean;
  retrySetup: () => Promise<void>;
};

export function useDesktopStartupController(
  params: DesktopStartupControllerParams,
): DesktopStartupControllerResult {
  const {
    isTauriRuntime,
    brandDisplayName,
    sidecarArgs,
    sidecarBootHealthcheckAttempts,
    sidecarBootHealthcheckIntervalMs,
    sidecarBootHealthcheckTimeoutMs,
    normalizeText,
    diagnoseRuntime,
    installRuntime,
    loadStartupDiagnostics,
    listenRuntimeInstallProgress,
    ensureOpenClawCliAvailable,
    startSidecar,
    healthCheck,
    resolvePortConflictMessage,
    refreshGatewayAuth,
    syncBrandRuntimeSnapshot,
  } = params;
  const [healthChecking, setHealthChecking] = useState(true);
  const [healthy, setHealthy] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [initialHealthResolved, setInitialHealthResolved] = useState(false);
  const [runtimeChecking, setRuntimeChecking] = useState(true);
  const [runtimeInstalling, setRuntimeInstalling] = useState(false);
  const [runtimeInstallError, setRuntimeInstallError] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(!params.isTauriRuntime);
  const [runtimeDiagnosis, setRuntimeDiagnosis] = useState<RuntimeDiagnosis | null>(null);
  const [runtimeInstallProgress, setRuntimeInstallProgress] = useState<RuntimeInstallProgress | null>(null);
  const [startupDiagnostics, setStartupDiagnostics] = useState<StartupDiagnosticsSnapshot | null>(null);
  const lastRuntimeProgressRef = useRef(0);

  const logStartupEvent = useCallback((message: string, details?: Record<string, unknown>) => {
    const line = details
      ? `[startup-controller] ${message} ${JSON.stringify(details)}`
      : `[startup-controller] ${message}`;
    console.info(line);
    void appendDesktopBootstrapLog(line).catch((error) => {
      console.warn('[desktop] failed to append startup bootstrap log', error);
    });
  }, []);

  const buildSidecarHealthTimeoutMessage = useCallback(() => {
    const seconds = Math.max(1, Math.round(sidecarBootHealthcheckTimeoutMs / 1000));
    return `本地服务启动超时：健康检查在 ${seconds}s 内未通过，请使用故障上报上传日志。`;
  }, [sidecarBootHealthcheckTimeoutMs]);
  const buildSidecarStartTimeoutMessage = useCallback(() => {
    const seconds = Math.max(1, Math.round(sidecarBootHealthcheckTimeoutMs / 1000));
    return `本地服务启动超时：启动命令在 ${seconds}s 内未返回，请使用故障上报上传日志。`;
  }, [sidecarBootHealthcheckTimeoutMs]);

  const waitForClientHealth = useCallback(
    async (options: WaitForClientHealthOptions = {}): Promise<boolean> => {
      const {
        attempts = sidecarBootHealthcheckAttempts,
        intervalMs = sidecarBootHealthcheckIntervalMs,
        suppressError = false,
      } = options;
      const deadlineAt = Date.now() + Math.max(sidecarBootHealthcheckTimeoutMs, intervalMs);
      for (let attempt = 0; attempt < attempts && Date.now() < deadlineAt; attempt += 1) {
        try {
          await healthCheck();
          setHealthy(true);
          setHealthError(null);
          setInitialHealthResolved(true);
          logStartupEvent('health_check_success', {
            attempt: attempt + 1,
            attempts,
            suppressError,
          });
          return true;
        } catch (error) {
          const portConflictMessage = await resolvePortConflictMessage();
          logStartupEvent('health_check_failed', {
            attempt: attempt + 1,
            attempts,
            suppressError,
            portConflictMessage,
            error: error instanceof Error ? error.message : String(error),
          });
          if (!suppressError) {
            setHealthy(false);
            setHealthError(portConflictMessage || (error instanceof Error ? error.message : 'health check failed'));
          } else {
            setHealthy(false);
            setHealthError(null);
          }
        }
        const remainingMs = deadlineAt - Date.now();
        if (remainingMs <= 0) {
          break;
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, Math.min(intervalMs, remainingMs));
        });
      }
      return false;
    },
    [
      healthCheck,
      logStartupEvent,
      resolvePortConflictMessage,
      sidecarBootHealthcheckAttempts,
      sidecarBootHealthcheckIntervalMs,
      sidecarBootHealthcheckTimeoutMs,
    ],
  );

  const applyRuntimeDiagnosis = useCallback((diagnosis: RuntimeDiagnosis | null): boolean => {
    setRuntimeDiagnosis(diagnosis);
    const ready =
      Boolean(diagnosis?.runtime_found) &&
      Boolean(diagnosis?.skills_dir_ready) &&
      Boolean(diagnosis?.mcp_config_ready);
    setRuntimeReady(ready);
    return ready;
  }, []);

  const checkRuntime = useCallback(async () => {
    if (!isTauriRuntime) {
      setRuntimeReady(true);
      setRuntimeChecking(false);
      return;
    }
    setRuntimeChecking(true);
    setRuntimeInstallError(null);
    if (!runtimeInstalling) {
      setRuntimeInstallProgress({
        phase: 'inspect',
        progress: 12,
        label: '正在检查本地环境',
        detail: '确认核心组件、工作区和运行配置是否已准备就绪。',
      });
    }
    try {
      const diagnosis = await diagnoseRuntime();
      applyRuntimeDiagnosis(diagnosis);
    } finally {
      setRuntimeChecking(false);
    }
  }, [applyRuntimeDiagnosis, diagnoseRuntime, isTauriRuntime, runtimeInstalling]);

  const handleInstallRuntime = useCallback(async () => {
    setRuntimeInstalling(true);
    setRuntimeInstallError(null);
    setRuntimeInstallProgress({
      phase: 'prepare',
      progress: 6,
      label: '正在准备安装组件',
      detail: '为首次启动创建本地运行目录并校验安装来源。',
    });
    try {
      await installRuntime();
      await checkRuntime();
    } catch (error) {
      setRuntimeInstallError(normalizeTauriError(error, 'runtime install failed').message);
    } finally {
      setRuntimeInstalling(false);
    }
  }, [checkRuntime, installRuntime]);

  const retrySetup = useCallback(async () => {
    setStartupDiagnostics(null);
    if (!runtimeReady) {
      await handleInstallRuntime();
      return;
    }

    setHealthError(null);
    setInitialHealthResolved(false);
    setHealthChecking(true);
    try {
      await refreshGatewayAuth();
      await syncBrandRuntimeSnapshot();
      await startSidecarWithTimeout(
        startSidecar,
        sidecarArgs,
        sidecarBootHealthcheckTimeoutMs,
        buildSidecarStartTimeoutMessage(),
      );
      const healthyNow = await waitForClientHealth({
        attempts: sidecarBootHealthcheckAttempts,
        intervalMs: sidecarBootHealthcheckIntervalMs,
        suppressError: true,
      });
      if (!healthyNow) {
        throw new Error(buildSidecarHealthTimeoutMessage());
      }
      setHealthy(true);
      setHealthError(null);
    } catch (error) {
      const portConflictMessage = await resolvePortConflictMessage();
      setHealthy(false);
      setHealthError(portConflictMessage || (error instanceof Error ? error.message : 'failed to start openclaw runtime'));
    } finally {
      setHealthChecking(false);
      setInitialHealthResolved(true);
    }
  }, [
    buildSidecarHealthTimeoutMessage,
    buildSidecarStartTimeoutMessage,
    handleInstallRuntime,
    refreshGatewayAuth,
    resolvePortConflictMessage,
    runtimeReady,
    sidecarArgs,
    sidecarBootHealthcheckAttempts,
    sidecarBootHealthcheckIntervalMs,
    sidecarBootHealthcheckTimeoutMs,
    startSidecar,
    syncBrandRuntimeSnapshot,
    waitForClientHealth,
  ]);

  useEffect(() => {
    if (!isTauriRuntime) {
      return;
    }
    if (!runtimeInstallError && !healthError) {
      setStartupDiagnostics(null);
      return;
    }

    let cancelled = false;
    void loadStartupDiagnostics()
      .then((snapshot) => {
        if (!cancelled) {
          setStartupDiagnostics(snapshot);
        }
      })
      .catch((error) => {
        console.warn('[desktop] failed to load startup diagnostics', error);
      });

    return () => {
      cancelled = true;
    };
  }, [healthError, isTauriRuntime, loadStartupDiagnostics, runtimeInstallError]);

  useEffect(() => {
    if (!isTauriRuntime) {
      return;
    }

    let detach = () => {};
    void listenRuntimeInstallProgress((payload) => {
      lastRuntimeProgressRef.current = Math.max(lastRuntimeProgressRef.current, payload.progress || 0);
      setRuntimeInstallProgress(payload);
    }).then((unlisten) => {
      detach = unlisten;
    });

    return () => {
      detach();
    };
  }, [isTauriRuntime, listenRuntimeInstallProgress]);

  useEffect(() => {
    if (!isTauriRuntime) {
      setRuntimeReady(true);
      setRuntimeChecking(false);
      return;
    }

    let cancelled = false;

    const ensureRuntimeInstalled = async () => {
      setRuntimeChecking(true);
      setRuntimeInstallError(null);
      try {
        const diagnosis = await diagnoseRuntime();
        const ready = applyRuntimeDiagnosis(diagnosis);
        if (ready || !diagnosis?.runtime_installable || diagnosis.runtime_found) {
          return;
        }

        setRuntimeInstalling(true);
        setRuntimeInstallProgress({
          phase: 'prepare',
          progress: 6,
          label: '正在准备安装组件',
          detail: '首次启动需要部署本地运行环境，请稍候。',
        });
        await installRuntime();
        if (cancelled) {
          return;
        }
        const nextDiagnosis = await diagnoseRuntime();
        if (cancelled) {
          return;
        }
        applyRuntimeDiagnosis(nextDiagnosis);
      } catch (error) {
        if (!cancelled) {
          setRuntimeInstallError(normalizeTauriError(error, 'runtime install failed').message);
        }
      } finally {
        if (!cancelled) {
          setRuntimeInstalling(false);
          setRuntimeChecking(false);
        }
      }
    };

    void ensureRuntimeInstalled();

    return () => {
      cancelled = true;
    };
  }, [applyRuntimeDiagnosis, diagnoseRuntime, installRuntime, isTauriRuntime]);

  useEffect(() => {
    if (isTauriRuntime && (!runtimeReady || runtimeChecking || runtimeInstalling)) {
      logStartupEvent('health_state_reset_for_runtime_transition', {
        runtimeReady,
        runtimeChecking,
        runtimeInstalling,
      });
      setHealthChecking(false);
      setHealthy(false);
      setInitialHealthResolved(false);
      return;
    }

    let cancelled = false;

    const check = async (
      options: {
        blocking?: boolean;
        suppressError?: boolean;
      } = {},
    ): Promise<boolean> => {
      const { blocking = false, suppressError = false } = options;
      if (blocking) {
        setHealthChecking(true);
      }
      try {
        const healthyNow = await waitForClientHealth({
          attempts: 1,
          suppressError,
        });
        return healthyNow;
      } finally {
        if (!cancelled && blocking) {
          setHealthChecking(false);
        }
      }
    };

    const waitForSidecarHealth = async (): Promise<boolean> => {
      const deadlineAt = Date.now() + Math.max(
        sidecarBootHealthcheckTimeoutMs,
        sidecarBootHealthcheckIntervalMs,
      );
      for (let attempt = 0; attempt < sidecarBootHealthcheckAttempts; attempt += 1) {
        if (Date.now() >= deadlineAt) {
          break;
        }
        const healthyNow = await check({ suppressError: true });
        if (healthyNow || cancelled) {
          return healthyNow;
        }
        if (!cancelled) {
          setHealthy(false);
          setHealthError(null);
        }
        const remainingMs = deadlineAt - Date.now();
        if (remainingMs <= 0) {
          break;
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, Math.min(sidecarBootHealthcheckIntervalMs, remainingMs));
        });
      }
      return false;
    };

    const boot = async () => {
      let resolvedHealthy = false;
      logStartupEvent('boot_effect_start', {
        runtimeReady,
        runtimeChecking,
        runtimeInstalling,
      });
      if (isTauriRuntime) {
        try {
          await ensureOpenClawCliAvailable();
        } catch (error) {
          console.warn('[desktop] failed to ensure openclaw cli launcher', error);
        }
      }
      const healthyNow = await check({
        blocking: true,
        suppressError: isTauriRuntime,
      });
      resolvedHealthy = healthyNow;
      logStartupEvent('boot_initial_health_result', { healthyNow });
      if (!cancelled && !healthyNow && isTauriRuntime) {
        setHealthChecking(true);
        setHealthError(null);
        logStartupEvent('boot_start_sidecar', {
          sidecarArgs,
          sidecarBootHealthcheckTimeoutMs,
        });
        try {
          await startSidecarWithTimeout(
            startSidecar,
            sidecarArgs,
            sidecarBootHealthcheckTimeoutMs,
            buildSidecarStartTimeoutMessage(),
          );
        } catch (error) {
          const portConflictMessage = await resolvePortConflictMessage();
          if (!cancelled) {
            setHealthy(false);
            setHealthError(portConflictMessage || (error instanceof Error ? error.message : 'failed to start openclaw runtime'));
            setInitialHealthResolved(true);
          }
          return;
        }
        const sidecarHealthy = await waitForSidecarHealth();
        if (!cancelled) {
          setHealthChecking(false);
        }
        logStartupEvent('boot_sidecar_health_result', {
          sidecarHealthy,
          cancelled,
        });
        resolvedHealthy = sidecarHealthy;
        if (!cancelled && !sidecarHealthy) {
          const portConflictMessage = await resolvePortConflictMessage();
          setHealthy(false);
          setHealthError(portConflictMessage || buildSidecarHealthTimeoutMessage());
        }
      }
      if (!cancelled) {
        setInitialHealthResolved(true);
        logStartupEvent('boot_effect_resolved', { healthy: resolvedHealthy });
      }
    };

    void boot();
    const timer = window.setInterval(() => {
      void check({ blocking: false });
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      logStartupEvent('boot_effect_cleanup');
    };
  }, [
    buildSidecarHealthTimeoutMessage,
    buildSidecarStartTimeoutMessage,
    ensureOpenClawCliAvailable,
    isTauriRuntime,
    logStartupEvent,
    resolvePortConflictMessage,
    runtimeChecking,
    runtimeInstalling,
    runtimeReady,
    sidecarArgs,
    sidecarBootHealthcheckAttempts,
    sidecarBootHealthcheckIntervalMs,
    sidecarBootHealthcheckTimeoutMs,
    startSidecar,
    waitForClientHealth,
  ]);

  const installerView = useMemo(
    () =>
      buildInstallerViewModel({
        brandDisplayName,
        isTauriRuntime,
        runtimeReady,
        runtimeChecking,
        runtimeInstalling,
        healthy,
        healthError,
        runtimeInstallError,
        runtimeDiagnosis,
        runtimeInstallProgress,
        startupDiagnostics,
        initialHealthResolved,
        healthChecking,
        lastRuntimeProgress: lastRuntimeProgressRef.current,
        normalizeText,
      }),
    [
      brandDisplayName,
      healthChecking,
      healthError,
      healthy,
      initialHealthResolved,
      isTauriRuntime,
      normalizeText,
      runtimeChecking,
      runtimeDiagnosis,
      runtimeInstallError,
      runtimeInstallProgress,
      runtimeInstalling,
      runtimeReady,
      startupDiagnostics,
    ],
  );

  const shouldShowStartupGate = useMemo(
    () =>
      resolveShouldShowStartupGate({
        isTauriRuntime,
        runtimeChecking,
        runtimeInstalling,
        runtimeReady,
        initialHealthResolved,
        healthChecking,
        healthy,
        healthError,
      }),
    [
      healthChecking,
      healthError,
      healthy,
      initialHealthResolved,
      isTauriRuntime,
      runtimeChecking,
      runtimeInstalling,
      runtimeReady,
    ],
  );

  return {
    healthChecking,
    healthy,
    healthError,
    initialHealthResolved,
    runtimeChecking,
    runtimeInstalling,
    runtimeInstallError,
    runtimeReady,
    runtimeDiagnosis,
    runtimeInstallProgress,
    startupDiagnostics,
    lastRuntimeProgress: lastRuntimeProgressRef.current,
    installerView,
    shouldShowStartupGate,
    retrySetup,
  };
}
