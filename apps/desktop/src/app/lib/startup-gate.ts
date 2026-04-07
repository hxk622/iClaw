import type { RuntimeDiagnosis, RuntimeInstallProgress } from './tauri-runtime-config';

export type InstallerViewState = 'loading' | 'error';

export type InstallerViewModel = {
  state: InstallerViewState;
  title: string;
  subtitle: string;
  progress: number;
  stepLabel: string;
  stepDetail: string;
  errorMessage: string | null;
};

type StartupGateProgress = Pick<RuntimeInstallProgress, 'phase' | 'progress' | 'label' | 'detail'>;

export type StartupGateViewInput = {
  brandDisplayName: string;
  runtimeReady: boolean;
  runtimeChecking: boolean;
  runtimeInstalling: boolean;
  healthy: boolean;
  healthError: string | null;
  runtimeInstallError: string | null;
  runtimeDiagnosis: Pick<RuntimeDiagnosis, 'runtime_installable'> | null;
  runtimeInstallProgress: StartupGateProgress | null;
  lastRuntimeProgress: number;
  normalizeText?: (value: string) => string;
};

export type StartupGateVisibilityInput = {
  isTauriRuntime: boolean;
  runtimeChecking: boolean;
  runtimeInstalling: boolean;
  runtimeReady: boolean;
  initialHealthResolved: boolean;
  healthChecking: boolean;
  healthy: boolean;
  healthError: string | null;
};

function defaultNormalizeText(value: string): string {
  return value;
}

export function resolveRuntimeUnavailableErrorMessage(input: {
  runtimeReady: boolean;
  runtimeInstalling: boolean;
  runtimeDiagnosis: Pick<RuntimeDiagnosis, 'runtime_installable'> | null;
}): string | null {
  return !input.runtimeReady && !input.runtimeInstalling && !input.runtimeDiagnosis?.runtime_installable
    ? '当前安装包未包含可用的运行时来源，请重新下载应用或联系支持。'
    : null;
}

export function buildInstallerViewModel(input: StartupGateViewInput): InstallerViewModel {
  const normalizeText = input.normalizeText || defaultNormalizeText;
  const runtimeUnavailableErrorMessage = resolveRuntimeUnavailableErrorMessage({
    runtimeReady: input.runtimeReady,
    runtimeInstalling: input.runtimeInstalling,
    runtimeDiagnosis: input.runtimeDiagnosis,
  });
  const installStageErrorMessage = input.runtimeInstallError || runtimeUnavailableErrorMessage;
  const startupStageErrorMessage = !installStageErrorMessage && input.runtimeReady ? input.healthError : null;
  const normalizedProgress = input.runtimeInstallProgress
    ? {
        ...input.runtimeInstallProgress,
        label: normalizeText(input.runtimeInstallProgress.label),
        detail: normalizeText(input.runtimeInstallProgress.detail),
      }
    : null;
  const stableProgress = Math.max(input.lastRuntimeProgress, normalizedProgress?.progress ?? 0);

  if (installStageErrorMessage) {
    return {
      state: 'error',
      title: '唤醒失败',
      subtitle: '安装过程遇到问题',
      progress: Math.max(6, Math.min(88, stableProgress || 6)),
      stepLabel: '安装过程中断',
      stepDetail: '本地运行环境还没有准备完成，无法继续进入应用。',
      errorMessage: installStageErrorMessage,
    };
  }

  if (startupStageErrorMessage) {
    return {
      state: 'error',
      title: '启动失败',
      subtitle: '本地服务未能成功拉起',
      progress: Math.max(96, stableProgress),
      stepLabel: '运行环境已部署完成',
      stepDetail: 'runtime 文件已经准备好，但本地 API / gateway 健康检查没有通过。',
      errorMessage: startupStageErrorMessage,
    };
  }

  if (input.runtimeInstalling) {
    const progress = normalizedProgress ?? {
      phase: 'prepare',
      progress: 6,
      label: '正在准备安装组件',
      detail: '首次启动需要部署本地运行环境，请稍候。',
    };
    const title =
      progress.progress < 30
        ? `${input.brandDisplayName} 正在苏醒`
        : progress.progress < 85
          ? `正在准备 ${input.brandDisplayName}`
          : '即将完成';
    return {
      state: 'loading',
      title,
      subtitle: '正在部署你的本地 AI 助手',
      progress: progress.progress,
      stepLabel: progress.label,
      stepDetail: progress.detail,
      errorMessage: null,
    };
  }

  if (input.runtimeChecking || !input.runtimeReady) {
    return {
      state: 'loading',
      title: `${input.brandDisplayName} 正在苏醒`,
      subtitle: '正在启动本地 AI 运行环境',
      progress: 12,
      stepLabel: '正在检查本地引擎',
      stepDetail: '确认 runtime、gateway、工作区和运行配置是否已准备就绪。',
      errorMessage: null,
    };
  }

  return {
    state: 'loading',
    title: '即将完成',
    subtitle: '本地运行环境已准备完成',
    progress: input.healthy ? 100 : 96,
    stepLabel: input.healthy ? `${input.brandDisplayName} 已就绪` : '正在启动本地服务',
    stepDetail: input.healthy ? '正在进入应用。' : '正在拉起本地服务并完成最后的健康检查。',
    errorMessage: null,
  };
}

export function resolveShouldShowStartupGate(input: StartupGateVisibilityInput): boolean {
  return (
    input.isTauriRuntime &&
    (input.runtimeChecking ||
      input.runtimeInstalling ||
      !input.runtimeReady ||
      !input.initialHealthResolved ||
      input.healthChecking ||
      (!input.healthy && Boolean(input.healthError)))
  );
}
