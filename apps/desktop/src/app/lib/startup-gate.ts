import type {
  RuntimeDiagnosis,
  RuntimeInstallProgress,
  StartupDiagnosticsSnapshot,
} from './tauri-runtime-config';

export type InstallerViewState = 'loading' | 'error';

export type InstallerDiagnosticItem = {
  label: string;
  value: string;
};

export type InstallerViewModel = {
  state: InstallerViewState;
  title: string;
  subtitle: string;
  progress: number;
  stepLabel: string;
  stepDetail: string;
  errorMessage: string | null;
  errorTitle: string | null;
  diagnosticItems: InstallerDiagnosticItem[];
};

type StartupGateProgress = Pick<RuntimeInstallProgress, 'phase' | 'progress' | 'label' | 'detail'>;

type StartupGateRuntimeDiagnosis = Pick<
  RuntimeDiagnosis,
  | 'runtime_found'
  | 'runtime_installable'
  | 'runtime_path'
  | 'runtime_version'
  | 'runtime_download_url'
  | 'skills_dir_ready'
  | 'mcp_config_ready'
  | 'work_dir'
  | 'log_dir'
>;

export type StartupGateViewInput = {
  brandDisplayName: string;
  runtimeReady: boolean;
  runtimeChecking: boolean;
  runtimeInstalling: boolean;
  healthy: boolean;
  healthError: string | null;
  runtimeInstallError: string | null;
  runtimeDiagnosis: StartupGateRuntimeDiagnosis | null;
  runtimeInstallProgress: StartupGateProgress | null;
  startupDiagnostics: StartupDiagnosticsSnapshot | null;
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

function cleanText(value: string | null | undefined, normalizeText: (value: string) => string): string | null {
  if (!value) {
    return null;
  }
  const normalized = normalizeText(value).trim();
  return normalized ? normalized : null;
}

function clipText(value: string, maxLength = 320): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(compact.length - maxLength)}`;
}

function detectPortConflictMessage(message: string | null): boolean {
  if (!message) {
    return false;
  }
  return /端口|port|occupied|in use|冲突/i.test(message);
}

function resolveRuntimeUnavailableErrorMessage(input: {
  runtimeReady: boolean;
  runtimeInstalling: boolean;
  runtimeDiagnosis: Pick<RuntimeDiagnosis, 'runtime_installable'> | null;
}): string | null {
  return input.runtimeDiagnosis !== null &&
    !input.runtimeReady &&
    !input.runtimeInstalling &&
    !input.runtimeDiagnosis.runtime_installable
    ? '当前安装包未包含可用的运行时来源，请重新下载应用或联系支持。'
    : null;
}

function buildCommonDiagnostics(input: StartupGateViewInput, normalizeText: (value: string) => string): InstallerDiagnosticItem[] {
  const items: InstallerDiagnosticItem[] = [];
  const runtimeVersion = cleanText(input.runtimeDiagnosis?.runtime_version, normalizeText);
  const runtimePath = cleanText(input.runtimeDiagnosis?.runtime_path, normalizeText);
  const runtimeDownloadUrl = cleanText(input.runtimeDiagnosis?.runtime_download_url, normalizeText);
  const workDir = cleanText(input.runtimeDiagnosis?.work_dir, normalizeText);
  const logDir = cleanText(input.runtimeDiagnosis?.log_dir, normalizeText);

  if (runtimeVersion) {
    items.push({ label: 'Runtime 版本', value: runtimeVersion });
  }
  if (runtimePath) {
    items.push({ label: 'Runtime 路径', value: runtimePath });
  } else if (runtimeDownloadUrl) {
    items.push({ label: 'Runtime 来源', value: runtimeDownloadUrl });
  }
  if (workDir) {
    items.push({ label: '工作目录', value: workDir });
  }
  if (logDir) {
    items.push({ label: '日志目录', value: logDir });
  }
  return items;
}

function buildLogDiagnostics(
  diagnostics: StartupDiagnosticsSnapshot | null,
  normalizeText: (value: string) => string,
): InstallerDiagnosticItem[] {
  if (!diagnostics) {
    return [];
  }

  const items: InstallerDiagnosticItem[] = [];
  const stderrTail = cleanText(diagnostics.sidecarStderrTail, normalizeText);
  const stdoutTail = cleanText(diagnostics.sidecarStdoutTail, normalizeText);
  const bootstrapTail = cleanText(diagnostics.bootstrapTail, normalizeText);

  if (stderrTail) {
    items.push({ label: '最近 stderr', value: clipText(stderrTail) });
  } else if (stdoutTail) {
    items.push({ label: '最近 stdout', value: clipText(stdoutTail) });
  }

  if (bootstrapTail) {
    items.push({ label: 'Bootstrap 日志', value: clipText(bootstrapTail) });
  }

  return items;
}

function buildInstallStageErrorView(input: StartupGateViewInput, normalizeText: (value: string) => string): InstallerViewModel {
  const runtimeUnavailableErrorMessage = resolveRuntimeUnavailableErrorMessage({
    runtimeReady: input.runtimeReady,
    runtimeInstalling: input.runtimeInstalling,
    runtimeDiagnosis: input.runtimeDiagnosis,
  });
  const installStageErrorMessage = cleanText(input.runtimeInstallError || runtimeUnavailableErrorMessage, normalizeText);
  const stableProgress = Math.max(input.lastRuntimeProgress, input.runtimeInstallProgress?.progress ?? 0);
  const diagnostics = [
    ...buildCommonDiagnostics(input, normalizeText),
    ...buildLogDiagnostics(input.startupDiagnostics, normalizeText),
  ];

  if (!input.runtimeDiagnosis?.runtime_installable) {
    return {
      state: 'error',
      title: '运行环境缺失',
      subtitle: '当前安装包没有可用的本地 runtime 来源',
      progress: Math.max(6, Math.min(24, stableProgress || 6)),
      stepLabel: '无法进入首次启动初始化',
      stepDetail: '安装介质没有提供可下载或可执行的 runtime，因此无法继续后续启动。',
      errorTitle: '缺少可用 runtime 来源',
      errorMessage: installStageErrorMessage,
      diagnosticItems: diagnostics,
    };
  }

  return {
    state: 'error',
    title: '首次启动初始化失败',
    subtitle: '运行环境部署过程中断',
    progress: Math.max(12, Math.min(88, stableProgress || 12)),
    stepLabel: '本地运行环境尚未准备完成',
    stepDetail: '失败发生在 runtime 下载、解压、目录准备或初始化阶段，还没有进入本地服务健康检查。',
    errorTitle: '初始化阶段失败',
    errorMessage: installStageErrorMessage,
    diagnosticItems: diagnostics,
  };
}

function buildStartupStageErrorView(input: StartupGateViewInput, normalizeText: (value: string) => string): InstallerViewModel {
  const healthError = cleanText(input.healthError, normalizeText);
  const diagnostics = [
    ...buildCommonDiagnostics(input, normalizeText),
    ...buildLogDiagnostics(input.startupDiagnostics, normalizeText),
  ];

  if (!input.runtimeDiagnosis?.runtime_found) {
    return {
      state: 'error',
      title: '运行环境未找到',
      subtitle: 'runtime 预检没有发现可执行引擎',
      progress: 92,
      stepLabel: '启动前检查失败',
      stepDetail: '前端已进入启动阶段，但本地没有找到可执行 runtime，无法继续拉起 sidecar。',
      errorTitle: 'Runtime 缺失',
      errorMessage: healthError,
      diagnosticItems: diagnostics,
    };
  }

  if (!input.runtimeDiagnosis?.skills_dir_ready || !input.runtimeDiagnosis?.mcp_config_ready) {
    return {
      state: 'error',
      title: '首次启动初始化失败',
      subtitle: '本地工作目录还没有准备完整',
      progress: 94,
      stepLabel: '运行环境文件不完整',
      stepDetail: 'runtime 已存在，但工作区、skills 目录或 MCP 配置未完成，应用不应把这类问题归为安装完成后的服务启动失败。',
      errorTitle: '初始化产物不完整',
      errorMessage: healthError,
      diagnosticItems: diagnostics,
    };
  }

  if (detectPortConflictMessage(healthError)) {
    return {
      state: 'error',
      title: '本地服务启动失败',
      subtitle: '本地端口被占用，sidecar 无法监听',
      progress: 96,
      stepLabel: '服务端口冲突',
      stepDetail: 'runtime 文件已存在，但 2126/2130 等本地端口冲突会导致 sidecar 拉起失败或健康检查无法通过。',
      errorTitle: '端口冲突',
      errorMessage: healthError,
      diagnosticItems: diagnostics,
    };
  }

  return {
    state: 'error',
    title: '本地服务启动失败',
    subtitle: 'runtime 已部署，但 sidecar 或健康检查没有通过',
    progress: 96,
    stepLabel: '服务启动后未就绪',
    stepDetail: '这类失败发生在首次启动初始化之后，常见原因是 sidecar 进程退出、配置异常或健康检查超时。',
    errorTitle: '启动阶段失败',
    errorMessage: healthError,
    diagnosticItems: diagnostics,
  };
}

export function buildInstallerViewModel(input: StartupGateViewInput): InstallerViewModel {
  const normalizeText = input.normalizeText || defaultNormalizeText;
  const startupStageErrorMessage = cleanText(
    !input.runtimeInstallError && input.runtimeReady ? input.healthError : null,
    normalizeText,
  );
  const installStageErrorMessage = cleanText(
    input.runtimeInstallError ||
      resolveRuntimeUnavailableErrorMessage({
        runtimeReady: input.runtimeReady,
        runtimeInstalling: input.runtimeInstalling,
        runtimeDiagnosis: input.runtimeDiagnosis,
      }),
    normalizeText,
  );
  const normalizedProgress = input.runtimeInstallProgress
    ? {
        ...input.runtimeInstallProgress,
        label: normalizeText(input.runtimeInstallProgress.label),
        detail: normalizeText(input.runtimeInstallProgress.detail),
      }
    : null;

  if (installStageErrorMessage) {
    return buildInstallStageErrorView(input, normalizeText);
  }

  if (startupStageErrorMessage) {
    return buildStartupStageErrorView(input, normalizeText);
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
      errorTitle: null,
      diagnosticItems: [],
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
      errorTitle: null,
      diagnosticItems: [],
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
    errorTitle: null,
    diagnosticItems: [],
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
