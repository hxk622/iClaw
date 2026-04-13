import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildInstallerViewModel,
  resolveShouldShowStartupGate,
  type InstallerViewModel,
} from './startup-gate';
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
  brandRuntimeReady: boolean;
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

  const buildSidecarHealthTimeoutMessage = useCallback(() => {
    const seconds = Math.max(1, Math.round(params.sidecarBootHealthcheckTimeoutMs / 1000));
    return `本地服务启动超时：健康检查在 ${seconds}s 内未通过，请使用故障上报上传日志。`;
  }, [params.sidecarBootHealthcheckTimeoutMs]);

    const waitForClientHealth = useCallback(
    async (options: WaitForClientHealthOptions = {}): Promise<boolean> => {
      const {
        attempts = params.sidecarBootHealthcheckAttempts,
        intervalMs = params.sidecarBootHealthcheckIntervalMs,
        suppressError = false,
      } = options;
      const deadlineAt = Date.now() + Math.max(params.sidecarBootHealthcheckTimeoutMs, intervalMs);
      for (let attempt = 0; attempt < attempts && Date.now() < deadlineAt; attempt += 1) {
        try {
          await params.healthCheck();
          setHealthy(true);
          setHealthError(null);
          return true;
        } catch (error) {
          const portConflictMessage = await params.resolvePortConflictMessage();
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
    [buildSidecarHealthTimeoutMessage, params],
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
    if (!params.isTauriRuntime) {
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
      const diagnosis = await params.diagnoseRuntime();
      applyRuntimeDiagnosis(diagnosis);
    } finally {
      setRuntimeChecking(false);
    }
  }, [applyRuntimeDiagnosis, params, runtimeInstalling]);

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
      await params.installRuntime();
      await checkRuntime();
    } catch (error) {
      setRuntimeInstallError(error instanceof Error ? error.message : 'runtime install failed');
    } finally {
      setRuntimeInstalling(false);
    }
  }, [checkRuntime, params]);

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
      await params.refreshGatewayAuth();
      await params.syncBrandRuntimeSnapshot();
      await params.startSidecar(params.sidecarArgs);
      const healthyNow = await waitForClientHealth({
        attempts: params.sidecarBootHealthcheckAttempts,
        intervalMs: params.sidecarBootHealthcheckIntervalMs,
        suppressError: true,
      });
      if (!healthyNow) {
        throw new Error(buildSidecarHealthTimeoutMessage());
      }
      setHealthy(true);
      setHealthError(null);
    } catch (error) {
      const portConflictMessage = await params.resolvePortConflictMessage();
      setHealthy(false);
      setHealthError(portConflictMessage || (error instanceof Error ? error.message : 'failed to start openclaw runtime'));
    } finally {
      setHealthChecking(false);
      setInitialHealthResolved(true);
    }
  }, [buildSidecarHealthTimeoutMessage, handleInstallRuntime, params, runtimeReady, waitForClientHealth]);

  useEffect(() => {
    if (!params.isTauriRuntime) {
      return;
    }
    if (!runtimeInstallError && !healthError) {
      setStartupDiagnostics(null);
      return;
    }

    let cancelled = false;
    void params
      .loadStartupDiagnostics()
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
  }, [healthError, params, runtimeInstallError]);

  useEffect(() => {
    if (!params.isTauriRuntime) {
      return;
    }

    let detach = () => {};
    void params.listenRuntimeInstallProgress((payload) => {
      lastRuntimeProgressRef.current = Math.max(lastRuntimeProgressRef.current, payload.progress || 0);
      setRuntimeInstallProgress(payload);
    }).then((unlisten) => {
      detach = unlisten;
    });

    return () => {
      detach();
    };
  }, [params]);

  useEffect(() => {
    if (!params.isTauriRuntime) {
      setRuntimeReady(true);
      setRuntimeChecking(false);
      return;
    }

    let cancelled = false;

    const ensureRuntimeInstalled = async () => {
      setRuntimeChecking(true);
      setRuntimeInstallError(null);
      try {
        const diagnosis = await params.diagnoseRuntime();
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
        await params.installRuntime();
        if (cancelled) {
          return;
        }
        const nextDiagnosis = await params.diagnoseRuntime();
        if (cancelled) {
          return;
        }
        applyRuntimeDiagnosis(nextDiagnosis);
      } catch (error) {
        if (!cancelled) {
          setRuntimeInstallError(error instanceof Error ? error.message : 'runtime install failed');
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
  }, [applyRuntimeDiagnosis, params]);

  useEffect(() => {
    if (params.isTauriRuntime && (!runtimeReady || runtimeChecking || runtimeInstalling)) {
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
        params.sidecarBootHealthcheckTimeoutMs,
        params.sidecarBootHealthcheckIntervalMs,
      );
      for (let attempt = 0; attempt < params.sidecarBootHealthcheckAttempts; attempt += 1) {
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
          window.setTimeout(resolve, Math.min(params.sidecarBootHealthcheckIntervalMs, remainingMs));
        });
      }
      return false;
    };

    const boot = async () => {
      if (params.isTauriRuntime) {
        try {
          await params.ensureOpenClawCliAvailable();
        } catch (error) {
          console.warn('[desktop] failed to ensure openclaw cli launcher', error);
        }
      }
      const healthyNow = await check({
        blocking: true,
        suppressError: params.isTauriRuntime,
      });
      if (!cancelled && !healthyNow && params.isTauriRuntime) {
        setHealthChecking(true);
        setHealthError(null);
        try {
          await params.startSidecar(params.sidecarArgs);
        } catch (error) {
          const portConflictMessage = await params.resolvePortConflictMessage();
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
        if (!cancelled && !sidecarHealthy) {
          const portConflictMessage = await params.resolvePortConflictMessage();
          setHealthy(false);
          setHealthError(portConflictMessage || buildSidecarHealthTimeoutMessage());
        }
      }
      if (!cancelled) {
        setInitialHealthResolved(true);
      }
    };

    void boot();
    const timer = window.setInterval(() => {
      void check({ blocking: false });
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [buildSidecarHealthTimeoutMessage, params, runtimeChecking, runtimeInstalling, runtimeReady, waitForClientHealth]);

  const installerView = useMemo(
    () =>
      buildInstallerViewModel({
        brandDisplayName: params.brandDisplayName,
        isTauriRuntime: params.isTauriRuntime,
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
        normalizeText: params.normalizeText,
      }),
    [
      healthChecking,
      healthError,
      healthy,
      initialHealthResolved,
      params,
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
        isTauriRuntime: params.isTauriRuntime,
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
      params.isTauriRuntime,
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
