import {
  AlarmClock,
  CalendarDays,
  Clock3,
  ListTodo,
  LoaderCircle,
  PencilLine,
  Play,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Repeat,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import '@openclaw-ui/main.ts';
import './openclaw-chat-surface.css';

type OpenClawTheme = 'system' | 'light' | 'dark';

type OpenClawSettings = {
  gatewayUrl: string;
  token: string;
  sessionKey: string;
  lastActiveSessionKey: string;
  theme: OpenClawTheme;
  chatFocusMode: boolean;
  chatShowThinking: boolean;
  splitRatio: number;
  navCollapsed: boolean;
  navGroupsCollapsed: Record<string, boolean>;
  locale?: string;
};

type GatewayClient = {
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>;
};

type OpenClawAppElement = HTMLElement & {
  password: string;
  sessionKey: string;
  tab: string;
  settings: OpenClawSettings;
  connected: boolean;
  lastError: string | null;
  lastErrorCode?: string | null;
  client?: GatewayClient | null;
  applySettings: (next: OpenClawSettings) => void;
  connect: () => void;
};

type OpenClawCronSurfaceProps = {
  gatewayUrl: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  sessionKey?: string;
  shellAuthenticated?: boolean;
};

type CronSurfaceStatus = {
  connected: boolean;
  lastError: string | null;
  lastErrorCode: string | null;
};

type CronSurfaceRenderState = {
  hasSummary: boolean;
  summaryVisible: boolean;
  hasWorkspace: boolean;
  workspaceVisible: boolean;
};

type CronStatus = {
  enabled: boolean;
  jobs: number;
  nextWakeAtMs?: number | null;
};

type CronSchedule =
  | { kind: 'at'; at: string }
  | { kind: 'every'; everyMs: number; anchorMs?: number }
  | { kind: 'cron'; expr: string; tz?: string; staggerMs?: number };

type CronRunStatus = 'ok' | 'error' | 'skipped';

type CronDeliveryStatus = 'delivered' | 'not-delivered' | 'unknown' | 'not-requested';

type CronJob = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule: CronSchedule;
  sessionTarget: 'main' | 'isolated';
  wakeMode: 'next-heartbeat' | 'now';
  payload:
    | { kind: 'systemEvent'; text: string }
    | {
        kind: 'agentTurn';
        message: string;
        model?: string;
        thinking?: string;
      };
  delivery?: {
    mode: 'none' | 'announce' | 'webhook';
    channel?: string;
    to?: string;
    accountId?: string;
    bestEffort?: boolean;
  };
  state?: {
    nextRunAtMs?: number;
    runningAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: CronRunStatus;
    lastError?: string;
    consecutiveErrors?: number;
    lastDeliveryStatus?: CronDeliveryStatus;
  };
};

type CronListResult = {
  jobs?: CronJob[];
};

type BasicTemplateId = 'reminder' | 'daily-summary' | 'weekly-report' | 'custom';
type BasicFrequency = 'once' | 'daily' | 'weekly';
type BasicFilter = 'all' | 'enabled' | 'paused';
type SurfaceMode = 'basic' | 'advanced';

type BasicCronFormState = {
  id?: string | null;
  templateId: BasicTemplateId;
  name: string;
  prompt: string;
  frequency: BasicFrequency;
  onceAt: string;
  runTime: string;
  weekday: string;
};

type BasicSchedulePreset =
  | {
      frequency: 'once';
      onceAt: string;
      runTime: string;
      weekday: string;
    }
  | {
      frequency: 'daily';
      onceAt: string;
      runTime: string;
      weekday: string;
    }
  | {
      frequency: 'weekly';
      onceAt: string;
      runTime: string;
      weekday: string;
    };

type BasicTemplate = {
  id: BasicTemplateId;
  title: string;
  summary: string;
  accentClass: string;
  icon: typeof AlarmClock;
  buildDefault: () => Pick<BasicCronFormState, 'name' | 'prompt' | 'frequency'>;
};

const OPENCLAW_CONTROL_SETTINGS_KEY = 'openclaw.control.settings.v1';
const OPENCLAW_CONTROL_TOKEN_PREFIX = 'openclaw.control.token.v1';
const OPENCLAW_DEVICE_AUTH_KEY = 'openclaw.device.auth.v1';
const OPENCLAW_DEVICE_IDENTITY_KEY = 'openclaw-device-identity-v1';

const WEEKDAY_OPTIONS = [
  { value: '1', label: '周一' },
  { value: '2', label: '周二' },
  { value: '3', label: '周三' },
  { value: '4', label: '周四' },
  { value: '5', label: '周五' },
  { value: '6', label: '周六' },
  { value: '0', label: '周日' },
];

const BASIC_TEMPLATES: BasicTemplate[] = [
  {
    id: 'reminder',
    title: '定时提醒',
    summary: '在指定时间提醒你某件事，适合待办和生活提醒。',
    accentClass: 'text-amber-500',
    icon: AlarmClock,
    buildDefault: () => ({
      name: '提醒我一件事',
      prompt: '请在这个时间提醒我：',
      frequency: 'once',
    }),
  },
  {
    id: 'daily-summary',
    title: '每日总结',
    summary: '每天固定时间生成一份简明总结，适合工作复盘。',
    accentClass: 'text-sky-500',
    icon: Clock3,
    buildDefault: () => ({
      name: '每日总结',
      prompt: '请根据今天的上下文生成一份简洁的每日总结，包含已完成事项、待推进事项和风险提醒。',
      frequency: 'daily',
    }),
  },
  {
    id: 'weekly-report',
    title: '每周报告',
    summary: '按周生成周报或周度观察，适合经营复盘和研究汇总。',
    accentClass: 'text-violet-500',
    icon: CalendarDays,
    buildDefault: () => ({
      name: '每周报告',
      prompt: '请生成一份本周报告，包含关键进展、主要问题、风险和下周建议。',
      frequency: 'weekly',
    }),
  },
  {
    id: 'custom',
    title: '自定义任务',
    summary: '直接定义任务内容，适合监控、例行执行和任意自动化提示。',
    accentClass: 'text-emerald-500',
    icon: Sparkles,
    buildDefault: () => ({
      name: '自定义任务',
      prompt: '',
      frequency: 'daily',
    }),
  },
];

function isVisibleElement(node: Element | null): { visible: boolean; height: number } {
  if (!(node instanceof HTMLElement)) {
    return { visible: false, height: 0 };
  }

  const style = window.getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  const visible =
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0;

  return {
    visible,
    height: Math.round(rect.height),
  };
}

function resolveThemeMode(): OpenClawTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

function shouldResetEmbeddedOpenClawState(gatewayUrl: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!isLoopbackHost(window.location.hostname)) {
    return false;
  }

  try {
    const gatewayHost = new URL(gatewayUrl, window.location.href).hostname;
    return isLoopbackHost(gatewayHost);
  } catch {
    return false;
  }
}

function clearOpenClawEmbeddedState(gatewayUrl: string): void {
  if (!shouldResetEmbeddedOpenClawState(gatewayUrl)) {
    return;
  }

  const clearPrefixedKeys = (storage: Storage | undefined, prefix: string) => {
    if (!storage) {
      return;
    }
    const toDelete: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(prefix)) {
        toDelete.push(key);
      }
    }
    toDelete.forEach((key) => storage.removeItem(key));
  };

  try {
    window.localStorage.removeItem(OPENCLAW_CONTROL_SETTINGS_KEY);
    window.localStorage.removeItem(OPENCLAW_DEVICE_AUTH_KEY);
    window.localStorage.removeItem(OPENCLAW_DEVICE_IDENTITY_KEY);
    clearPrefixedKeys(window.localStorage, OPENCLAW_CONTROL_TOKEN_PREFIX);
  } catch {}

  try {
    clearPrefixedKeys(window.sessionStorage, OPENCLAW_CONTROL_TOKEN_PREFIX);
  } catch {}
}

function buildSettings(params: {
  gatewayUrl: string;
  gatewayToken?: string;
  sessionKey: string;
}): OpenClawSettings {
  return {
    gatewayUrl: params.gatewayUrl,
    token: params.gatewayToken?.trim() ?? '',
    sessionKey: params.sessionKey,
    lastActiveSessionKey: params.sessionKey,
    theme: resolveThemeMode(),
    chatFocusMode: true,
    chatShowThinking: true,
    splitRatio: 0.6,
    navCollapsed: true,
    navGroupsCollapsed: {
      control: true,
      agent: true,
      settings: true,
    },
    locale: 'zh-CN',
  };
}

function getDefaultForm(templateId: BasicTemplateId = 'reminder'): BasicCronFormState {
  const template = BASIC_TEMPLATES.find((item) => item.id === templateId) ?? BASIC_TEMPLATES[0];
  const now = new Date(Date.now() + 60 * 60 * 1000);
  const onceAt = formatDateTimeLocalValue(now);
  return {
    id: null,
    templateId,
    onceAt,
    runTime: '09:00',
    weekday: '1',
    ...template.buildDefault(),
  };
}

function formatDateTimeLocalValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatTimestamp(value?: number | null): string {
  if (!value) {
    return '未安排';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatRelative(value?: number | null): string {
  if (!value) {
    return '暂无记录';
  }
  const diff = value - Date.now();
  const abs = Math.abs(diff);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < hour) {
    const minutes = Math.max(1, Math.round(abs / minute));
    return diff >= 0 ? `${minutes} 分钟后` : `${minutes} 分钟前`;
  }
  if (abs < day) {
    const hours = Math.max(1, Math.round(abs / hour));
    return diff >= 0 ? `${hours} 小时后` : `${hours} 小时前`;
  }
  const days = Math.max(1, Math.round(abs / day));
  return diff >= 0 ? `${days} 天后` : `${days} 天前`;
}

function buildHumanSchedule(schedule: CronSchedule): string {
  if (schedule.kind === 'at') {
    return `执行一次 · ${formatTimestamp(Date.parse(schedule.at))}`;
  }
  if (schedule.kind === 'every') {
    const hours = schedule.everyMs / (60 * 60 * 1000);
    if (Number.isInteger(hours) && hours >= 1) {
      return `每 ${hours} 小时执行`;
    }
    const minutes = Math.max(1, Math.round(schedule.everyMs / (60 * 1000)));
    return `每 ${minutes} 分钟执行`;
  }

  const parsed = parseSimpleCronSchedule(schedule);
  if (!parsed) {
    return `高级 Cron · ${schedule.expr}`;
  }
  if (parsed.frequency === 'daily') {
    return `每天 ${parsed.runTime}`;
  }
  const weekday = WEEKDAY_OPTIONS.find((item) => item.value === parsed.weekday)?.label ?? '每周';
  return `${weekday} ${parsed.runTime}`;
}

function parseSimpleCronSchedule(schedule: CronSchedule): BasicSchedulePreset | null {
  if (schedule.kind === 'at') {
    return {
      frequency: 'once',
      onceAt: formatDateTimeLocalValue(new Date(schedule.at)),
      runTime: '09:00',
      weekday: '1',
    };
  }

  if (schedule.kind !== 'cron') {
    return null;
  }

  const dailyMatch = schedule.expr.trim().match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/);
  if (dailyMatch) {
    return {
      frequency: 'daily',
      onceAt: '',
      runTime: `${dailyMatch[2].padStart(2, '0')}:${dailyMatch[1].padStart(2, '0')}`,
      weekday: '1',
    };
  }

  const weeklyMatch = schedule.expr.trim().match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+([0-6]|7)$/);
  if (weeklyMatch) {
    return {
      frequency: 'weekly',
      onceAt: '',
      runTime: `${weeklyMatch[2].padStart(2, '0')}:${weeklyMatch[1].padStart(2, '0')}`,
      weekday: weeklyMatch[3] === '7' ? '0' : weeklyMatch[3],
    };
  }

  return null;
}

function buildScheduleFromForm(form: BasicCronFormState): CronSchedule {
  if (form.frequency === 'once') {
    return {
      kind: 'at',
      at: new Date(form.onceAt).toISOString(),
    };
  }

  const [hour, minute] = form.runTime.split(':');
  const safeMinute = String(Number(minute ?? '0'));
  const safeHour = String(Number(hour ?? '0'));

  if (form.frequency === 'daily') {
    return {
      kind: 'cron',
      expr: `${safeMinute} ${safeHour} * * *`,
    };
  }

  return {
    kind: 'cron',
    expr: `${safeMinute} ${safeHour} * * ${form.weekday}`,
  };
}

function inferTemplateId(job: CronJob): BasicTemplateId {
  const text = job.payload.kind === 'agentTurn' ? job.payload.message : job.payload.text;
  if (/每日总结|daily/i.test(job.name) || /每日总结|daily/i.test(text)) {
    return 'daily-summary';
  }
  if (/每周报告|周报|weekly/i.test(job.name) || /每周报告|周报|weekly/i.test(text)) {
    return 'weekly-report';
  }
  if (/提醒|remind/i.test(job.name) || /提醒|remind/i.test(text)) {
    return 'reminder';
  }
  return 'custom';
}

function isBasicEditableJob(job: CronJob): boolean {
  return (
    job.payload.kind === 'agentTurn' &&
    job.sessionTarget === 'isolated' &&
    job.wakeMode === 'now' &&
    parseSimpleCronSchedule(job.schedule) !== null
  );
}

function buildFormFromJob(job: CronJob): BasicCronFormState | null {
  if (job.payload.kind !== 'agentTurn') {
    return null;
  }
  const schedule = parseSimpleCronSchedule(job.schedule);
  if (!schedule) {
    return null;
  }
  return {
    id: job.id,
    templateId: inferTemplateId(job),
    name: job.name,
    prompt: job.payload.message,
    frequency: schedule.frequency,
    onceAt: schedule.onceAt,
    runTime: schedule.runTime,
    weekday: schedule.weekday,
  };
}

function getJobStatusTone(job: CronJob): {
  label: string;
  className: string;
} {
  if (!job.enabled) {
    return { label: '已暂停', className: 'bg-[rgba(120,120,120,0.12)] text-[var(--text-secondary)]' };
  }
  if (job.state?.runningAtMs) {
    return { label: '执行中', className: 'bg-[rgba(59,130,246,0.12)] text-sky-600 dark:text-sky-300' };
  }
  if (job.state?.lastStatus === 'error') {
    return { label: '异常', className: 'bg-[rgba(239,68,68,0.12)] text-red-600 dark:text-red-300' };
  }
  return { label: '正常', className: 'bg-[rgba(34,197,94,0.12)] text-emerald-600 dark:text-emerald-300' };
}

function getTemplateMeta(templateId: BasicTemplateId): BasicTemplate {
  return BASIC_TEMPLATES.find((item) => item.id === templateId) ?? BASIC_TEMPLATES[0];
}

export function OpenClawCronSurface({
  gatewayUrl,
  gatewayToken,
  gatewayPassword,
  sessionKey = 'main',
  shellAuthenticated = false,
}: OpenClawCronSurfaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<OpenClawAppElement | null>(null);
  const reconnectKeyRef = useRef<string | null>(null);
  const [status, setStatus] = useState<CronSurfaceStatus>({
    connected: false,
    lastError: null,
    lastErrorCode: null,
  });
  const [renderState, setRenderState] = useState<CronSurfaceRenderState>({
    hasSummary: false,
    summaryVisible: false,
    hasWorkspace: false,
    workspaceVisible: false,
  });
  const [showConnectionCard, setShowConnectionCard] = useState(false);
  const [showRenderDiagnosticsCard, setShowRenderDiagnosticsCard] = useState(false);
  const [mode, setMode] = useState<SurfaceMode>('basic');
  const [clientReady, setClientReady] = useState(false);
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<BasicFilter>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BasicCronFormState>(() => getDefaultForm());
  const [actionJobId, setActionJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const getClient = (): GatewayClient | null => {
    const client = appRef.current?.client;
    if (!client || typeof client.request !== 'function') {
      return null;
    }
    return client;
  };

  const loadSnapshot = async () => {
    const client = getClient();
    if (!client) {
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const [statusResult, listResult] = await Promise.all([
        client.request<CronStatus>('cron.status', {}),
        client.request<CronListResult>('cron.list', {
          includeDisabled: true,
          limit: 100,
          sortBy: 'nextRunAtMs',
          sortDir: 'asc',
        }),
      ]);
      const nextJobs = Array.isArray(listResult.jobs) ? listResult.jobs : [];
      setCronStatus(statusResult);
      setJobs(nextJobs);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    clearOpenClawEmbeddedState(gatewayUrl);

    const app = document.createElement('openclaw-app') as OpenClawAppElement;
    const settings = buildSettings({ gatewayUrl, gatewayToken, sessionKey });

    app.applySettings(settings);
    app.password = gatewayPassword?.trim() ?? '';
    app.sessionKey = sessionKey;
    app.tab = 'cron';

    appRef.current = app;
    host.replaceChildren(app);

    return () => {
      if (appRef.current === app) {
        appRef.current = null;
      }
      host.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app) {
      return;
    }

    const settings = buildSettings({ gatewayUrl, gatewayToken, sessionKey });
    app.applySettings(settings);
    app.password = gatewayPassword?.trim() ?? '';
    app.sessionKey = sessionKey;
    app.tab = 'cron';

    const reconnectKey = JSON.stringify({
      gatewayUrl,
      gatewayToken: gatewayToken?.trim() ?? '',
      gatewayPassword: gatewayPassword?.trim() ?? '',
      sessionKey,
    });
    if (reconnectKeyRef.current === null) {
      reconnectKeyRef.current = reconnectKey;
      return;
    }
    if (reconnectKeyRef.current !== reconnectKey) {
      reconnectKeyRef.current = reconnectKey;
      app.connect();
      setClientReady(false);
    }
  }, [gatewayPassword, gatewayToken, gatewayUrl, sessionKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const app = appRef.current;
      const host = hostRef.current;
      if (!app || !host) {
        return;
      }

      const summary = host.querySelector('.cron-summary-strip');
      const workspace = host.querySelector('.cron-workspace');
      const summaryState = isVisibleElement(summary);
      const workspaceState = isVisibleElement(workspace);

      const nextStatus: CronSurfaceStatus = {
        connected: Boolean(app.connected),
        lastError: app.lastError ?? null,
        lastErrorCode: app.lastErrorCode ?? null,
      };
      const nextRenderState: CronSurfaceRenderState = {
        hasSummary: Boolean(summary),
        summaryVisible: summaryState.visible,
        hasWorkspace: Boolean(workspace),
        workspaceVisible: workspaceState.visible,
      };

      setClientReady(Boolean(app.client && typeof app.client.request === 'function'));
      setStatus((current) =>
        current.connected === nextStatus.connected &&
        current.lastError === nextStatus.lastError &&
        current.lastErrorCode === nextStatus.lastErrorCode
          ? current
          : nextStatus,
      );
      setRenderState((current) =>
        current.hasSummary === nextRenderState.hasSummary &&
        current.summaryVisible === nextRenderState.summaryVisible &&
        current.hasWorkspace === nextRenderState.hasWorkspace &&
        current.workspaceVisible === nextRenderState.workspaceVisible
          ? current
          : nextRenderState,
      );
    }, 180);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!status.connected || !clientReady) {
      return;
    }
    void loadSnapshot();
  }, [clientReady, status.connected]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (status.connected) {
      setShowConnectionCard(false);
      return;
    }

    if (status.lastError) {
      setShowConnectionCard(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowConnectionCard(true);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [status.connected, status.lastError]);

  useEffect(() => {
    const cronUiReady =
      (renderState.hasSummary && renderState.summaryVisible) ||
      (renderState.hasWorkspace && renderState.workspaceVisible);

    if (mode !== 'advanced' || !shellAuthenticated || !status.connected || cronUiReady) {
      setShowRenderDiagnosticsCard(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowRenderDiagnosticsCard(true);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    mode,
    renderState.hasSummary,
    renderState.hasWorkspace,
    renderState.summaryVisible,
    renderState.workspaceVisible,
    shellAuthenticated,
    status.connected,
  ]);

  const visibleJobs = useMemo(() => {
    if (listFilter === 'enabled') {
      return jobs.filter((job) => job.enabled);
    }
    if (listFilter === 'paused') {
      return jobs.filter((job) => !job.enabled);
    }
    return jobs;
  }, [jobs, listFilter]);

  const basicJobs = useMemo(() => jobs.filter(isBasicEditableJob), [jobs]);

  const cronUiReady =
    (renderState.hasSummary && renderState.summaryVisible) ||
    (renderState.hasWorkspace && renderState.workspaceVisible);
  const showBootMask = mode === 'advanced' && shellAuthenticated && !cronUiReady;
  const hasGatewayAuth = Boolean((gatewayToken ?? '').trim() || (gatewayPassword ?? '').trim());
  const connectionMessage = status.lastError
    ? status.lastError
    : hasGatewayAuth
      ? '正在连接 OpenClaw 定时任务中心…'
      : '缺少本地网关凭据，当前无法连接 OpenClaw。';

  const openCreate = (templateId: BasicTemplateId) => {
    setForm(getDefaultForm(templateId));
    setDrawerOpen(true);
  };

  const openEdit = (job: CronJob) => {
    const nextForm = buildFormFromJob(job);
    if (!nextForm) {
      setNotice({
        tone: 'error',
        text: '这个任务使用了高级调度配置，建议在高级模式里编辑。',
      });
      setMode('advanced');
      return;
    }
    setForm(nextForm);
    setDrawerOpen(true);
  };

  const handleTemplateChange = (templateId: BasicTemplateId) => {
    const defaults = getDefaultForm(templateId);
    setForm((current) => ({
      ...current,
      templateId,
      name: current.id ? current.name : defaults.name,
      prompt: current.prompt.trim() ? current.prompt : defaults.prompt,
      frequency: current.id ? current.frequency : defaults.frequency,
    }));
  };

  const handleSave = async () => {
    const client = getClient();
    if (!client) {
      setNotice({ tone: 'error', text: '连接尚未完成，请稍后再试。' });
      return;
    }
    if (!form.name.trim()) {
      setNotice({ tone: 'error', text: '请填写任务名称。' });
      return;
    }
    if (!form.prompt.trim()) {
      setNotice({ tone: 'error', text: '请填写任务内容。' });
      return;
    }
    if (form.frequency === 'once' && !form.onceAt) {
      setNotice({ tone: 'error', text: '请选择执行时间。' });
      return;
    }
    if (form.frequency !== 'once' && !form.runTime) {
      setNotice({ tone: 'error', text: '请选择执行时刻。' });
      return;
    }

    const payload = {
      name: form.name.trim(),
      enabled: true,
      deleteAfterRun: form.frequency === 'once',
      schedule: buildScheduleFromForm(form),
      sessionTarget: 'isolated' as const,
      wakeMode: 'now' as const,
      payload: {
        kind: 'agentTurn' as const,
        message: form.prompt.trim(),
      },
      delivery: {
        mode: 'announce' as const,
        channel: 'last',
        bestEffort: true,
      },
    };

    setSaving(true);
    try {
      if (form.id) {
        await client.request('cron.update', {
          id: form.id,
          patch: payload,
        });
        setNotice({ tone: 'success', text: '任务已更新。' });
      } else {
        await client.request('cron.add', payload);
        setNotice({ tone: 'success', text: '任务已创建。' });
      }
      setDrawerOpen(false);
      setForm(getDefaultForm());
      await loadSnapshot();
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : '保存失败，请稍后再试。',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (job: CronJob) => {
    const client = getClient();
    if (!client) {
      return;
    }
    setActionJobId(job.id);
    try {
      await client.request('cron.update', {
        id: job.id,
        patch: {
          enabled: !job.enabled,
        },
      });
      setNotice({
        tone: 'success',
        text: job.enabled ? '任务已暂停。' : '任务已恢复。',
      });
      await loadSnapshot();
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : '操作失败，请稍后再试。',
      });
    } finally {
      setActionJobId(null);
    }
  };

  const handleRun = async (job: CronJob) => {
    const client = getClient();
    if (!client) {
      return;
    }
    setActionJobId(job.id);
    try {
      await client.request('cron.run', {
        id: job.id,
        mode: 'force',
      });
      setNotice({
        tone: 'success',
        text: '已加入执行队列。',
      });
      await loadSnapshot();
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : '执行失败，请稍后再试。',
      });
    } finally {
      setActionJobId(null);
    }
  };

  const handleRemove = async (job: CronJob) => {
    const client = getClient();
    if (!client || !window.confirm(`确认删除任务「${job.name}」吗？`)) {
      return;
    }
    setActionJobId(job.id);
    try {
      await client.request('cron.remove', {
        id: job.id,
      });
      setNotice({
        tone: 'success',
        text: '任务已删除。',
      });
      await loadSnapshot();
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : '删除失败，请稍后再试。',
      });
    } finally {
      setActionJobId(null);
    }
  };

  return (
    <div className="openclaw-chat-surface openclaw-cron-surface h-full min-w-0 flex-1 overflow-hidden">
      <div className="openclaw-chat-surface-shell openclaw-cron-surface-shell h-full min-w-0 flex-1 overflow-hidden">
        {showBootMask ? (
          <div className="iclaw-chat-boot-mask" aria-hidden="true">
            <span className="iclaw-chat-boot-mask__sr-only">正在恢复定时任务</span>
            <div className="iclaw-chat-skeleton">
              <div className="iclaw-chat-skeleton__header">
                <div className="iclaw-chat-skeleton__dot" />
                <div className="iclaw-chat-skeleton__title" />
                <div className="iclaw-chat-skeleton__meta" />
              </div>
              <div className="iclaw-chat-skeleton__thread">
                <div className="iclaw-chat-skeleton__bubble iclaw-chat-skeleton__bubble--long" />
                <div className="iclaw-chat-skeleton__bubble iclaw-chat-skeleton__bubble--short" />
                <div className="iclaw-chat-skeleton__bubble iclaw-chat-skeleton__bubble--long" />
              </div>
              <div className="iclaw-chat-skeleton__composer">
                <div className="iclaw-chat-skeleton__composer-line" />
                <div className="iclaw-chat-skeleton__composer-actions">
                  <div className="iclaw-chat-skeleton__composer-chip" />
                  <div className="iclaw-chat-skeleton__composer-button" />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {mode === 'basic' ? (
          <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--bg-page)]">
            <div className="sticky top-0 z-10 border-b border-[var(--border-default)] bg-[color-mix(in_srgb,var(--bg-page)_94%,transparent)] px-5 py-3 backdrop-blur-xl">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(59,130,246,0.08)] px-3 py-1 text-[12px] font-medium text-[var(--brand-primary)] dark:bg-[rgba(201,169,97,0.14)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    面向普通用户的基础模式
                  </div>
                  <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                    定时任务中心
                  </h1>
                  <p className="mt-1.5 max-w-[860px] text-[13px] leading-6 text-[var(--text-secondary)]">
                    先用模板快速创建任务，适合提醒、每日总结和每周报告。复杂调度仍然保留在高级模式里。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadSnapshot()}
                    disabled={loading || !clientReady}
                    className="iclaw-apple-button iclaw-apple-button--secondary"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    刷新
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreate('reminder')}
                    disabled={!clientReady}
                    className="iclaw-apple-button iclaw-apple-button--primary"
                  >
                    <Plus className="h-4 w-4" />
                    新建任务
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('advanced')}
                    className="iclaw-apple-button iclaw-apple-button--secondary"
                  >
                    <Settings2 className="h-4 w-4" />
                    高级模式
                  </button>
                </div>
              </div>
            </div>

            <div className="mx-auto flex w-full max-w-[1440px] min-w-0 flex-1 flex-col gap-4 px-5 py-4">
              {notice ? (
                <div
                  className={`rounded-[16px] border px-4 py-3 text-[14px] ${
                    notice.tone === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
                  }`}
                >
                  {notice.text}
                </div>
              ) : null}

              {fetchError ? (
                <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  {fetchError}
                </div>
              ) : null}

              <section className="grid gap-3 lg:grid-cols-4">
                <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)]">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">已接入任务</div>
                  <div className="mt-2 text-[26px] font-semibold text-[var(--text-primary)]">
                    {cronStatus?.jobs ?? jobs.length}
                  </div>
                  <div className="mt-1.5 text-[12px] text-[var(--text-secondary)]">
                    基础模式可编辑 {basicJobs.length} 个
                  </div>
                </div>
                <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)]">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">下次执行</div>
                  <div className="mt-2 text-[20px] font-semibold text-[var(--text-primary)]">
                    {formatTimestamp(cronStatus?.nextWakeAtMs)}
                  </div>
                  <div className="mt-1.5 text-[12px] text-[var(--text-secondary)]">
                    {formatRelative(cronStatus?.nextWakeAtMs ?? null)}
                  </div>
                </div>
                <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)]">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">调度状态</div>
                  <div className="mt-2 inline-flex items-center rounded-full bg-[rgba(34,197,94,0.12)] px-3 py-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-300">
                    {cronStatus?.enabled === false ? '调度器关闭' : '调度器正常'}
                  </div>
                  <div className="mt-1.5 text-[12px] text-[var(--text-secondary)]">
                    结果默认发回当前会话
                  </div>
                </div>
                <div className="rounded-[20px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(59,130,246,0.08),transparent)] p-4 shadow-[var(--shadow-sm)] dark:bg-[linear-gradient(180deg,rgba(201,169,97,0.12),transparent)]">
                  <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                    快速模板
                  </div>
                  <div className="mt-2 text-[16px] font-semibold text-[var(--text-primary)]">
                    先决定做什么和什么时候做
                  </div>
                  <div className="mt-1.5 text-[12px] leading-6 text-[var(--text-secondary)]">
                    复杂字段先隐藏，必要时再切高级模式。
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-[17px] font-semibold text-[var(--text-primary)]">快速创建</div>
                    <div className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      先用模板建立任务，后续再去高级模式补充复杂规则。
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {BASIC_TEMPLATES.map((template) => {
                    const Icon = template.icon;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => openCreate(template.id)}
                        className="iclaw-surface-card-button group p-4 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className={`inline-flex h-9 w-9 items-center justify-center rounded-[13px] bg-[var(--bg-hover)] ${template.accentClass}`}>
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <span className="rounded-full bg-[var(--bg-hover)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                            模板
                          </span>
                        </div>
                        <div className="mt-3 text-[15px] font-semibold text-[var(--text-primary)]">
                          {template.title}
                        </div>
                        <div className="mt-1.5 text-[12px] leading-5 text-[var(--text-secondary)]">
                          {template.summary}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)]">
                <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[17px] font-semibold text-[var(--text-primary)]">我的任务</div>
                    <div className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      先展示对普通用户最有用的关键信息：状态、下次执行、最近结果和快捷操作。
                    </div>
                  </div>
                  <div className="inline-flex rounded-[14px] bg-[var(--bg-hover)] p-1">
                    {[
                      { key: 'all', label: '全部' },
                      { key: 'enabled', label: '进行中' },
                      { key: 'paused', label: '已暂停' },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setListFilter(option.key as BasicFilter)}
                        className={`iclaw-apple-segment ${
                          listFilter === option.key
                            ? 'iclaw-apple-segment--active'
                            : ''
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  {loading ? (
                    <div className="flex items-center gap-2 rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-hover)] px-4 py-3 text-[13px] text-[var(--text-secondary)]">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      正在读取定时任务…
                    </div>
                  ) : visibleJobs.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-[var(--border-default)] bg-[var(--bg-hover)] px-6 py-8 text-center">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--brand-primary)]">
                        <ListTodo className="h-5.5 w-5.5" />
                      </div>
                      <div className="mt-3 text-[15px] font-semibold text-[var(--text-primary)]">
                        还没有任务
                      </div>
                      <div className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">
                        先创建一个提醒或例行总结，看看基础模式是否足够你日常使用。
                      </div>
                      <button
                        type="button"
                        onClick={() => openCreate('reminder')}
                        className="iclaw-apple-button iclaw-apple-button--primary mt-5"
                      >
                        <Plus className="h-4 w-4" />
                        创建第一个任务
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-3 xl:grid-cols-2">
                      {visibleJobs.map((job) => {
                        const tone = getJobStatusTone(job);
                        const templateMeta = getTemplateMeta(inferTemplateId(job));
                        const Icon = templateMeta.icon;
                        const isAdvancedOnly = !isBasicEditableJob(job);
                        const lastState = job.state?.lastStatus === 'error' ? job.state?.lastError ?? '最近一次执行失败。' : job.state?.lastStatus === 'ok' ? '最近一次执行成功。' : '还没有最近执行记录。';
                        return (
                          <div
                            key={job.id}
                            className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-page)] p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--bg-hover)] ${templateMeta.accentClass}`}>
                                    <Icon className="h-4.5 w-4.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-[15px] font-semibold text-[var(--text-primary)]">
                                      {job.name}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${tone.className}`}>
                                        {tone.label}
                                      </span>
                                      {isAdvancedOnly ? (
                                        <span className="rounded-full bg-[rgba(245,158,11,0.12)] px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-300">
                                          高级任务
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleToggle(job)}
                                disabled={actionJobId === job.id}
                                className="iclaw-apple-button iclaw-apple-button--secondary iclaw-apple-button--sm iclaw-apple-button--icon"
                              >
                                {job.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                              </button>
                            </div>

                            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                              <div className="rounded-[13px] bg-[var(--bg-hover)] px-3 py-2">
                                <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">执行节奏</div>
                                <div className="mt-1 text-[13px] text-[var(--text-primary)]">{buildHumanSchedule(job.schedule)}</div>
                              </div>
                              <div className="rounded-[13px] bg-[var(--bg-hover)] px-3 py-2">
                                <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">下次执行</div>
                                <div className="mt-1 text-[13px] text-[var(--text-primary)]">
                                  {formatTimestamp(job.state?.nextRunAtMs ?? null)}
                                </div>
                              </div>
                              <div className="rounded-[13px] bg-[var(--bg-hover)] px-3 py-2">
                                <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">最近结果</div>
                                <div className="mt-1 text-[13px] text-[var(--text-primary)]">
                                  {job.state?.lastStatus === 'ok'
                                    ? '成功'
                                    : job.state?.lastStatus === 'error'
                                      ? '失败'
                                      : '暂无'}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 rounded-[13px] border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2.5 text-[12px] leading-5 text-[var(--text-secondary)]">
                              {lastState}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleRun(job)}
                                disabled={actionJobId === job.id}
                                className="iclaw-apple-button iclaw-apple-button--secondary iclaw-apple-button--sm"
                              >
                                <Play className="h-4 w-4" />
                                立即执行
                              </button>
                              <button
                                type="button"
                                onClick={() => openEdit(job)}
                                className="iclaw-apple-button iclaw-apple-button--secondary iclaw-apple-button--sm"
                              >
                                <PencilLine className="h-4 w-4" />
                                {isAdvancedOnly ? '高级编辑' : '编辑'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemove(job)}
                                disabled={actionJobId === job.id}
                                className="iclaw-apple-button iclaw-apple-button--danger iclaw-apple-button--sm"
                              >
                                <Trash2 className="h-4 w-4" />
                                删除
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {drawerOpen ? (
              <div className="iclaw-cron-modal-backdrop">
                <div className="iclaw-cron-modal">
                  <div className="border-b border-[var(--border-default)] px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[18px] font-semibold text-[var(--text-primary)]">
                          {form.id ? '编辑任务' : '创建任务'}
                        </div>
                        <div className="mt-1 text-[13px] text-[var(--text-secondary)]">
                          基础模式只保留最常用字段。复杂参数可切到高级模式调整。
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDrawerOpen(false)}
                        className="iclaw-apple-button iclaw-apple-button--secondary iclaw-apple-button--sm"
                      >
                        关闭
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 px-5 py-5">
                    <label className="grid gap-2">
                      <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                        模板
                      </span>
                      <select
                        value={form.templateId}
                        onChange={(event) => handleTemplateChange(event.target.value as BasicTemplateId)}
                      >
                        {BASIC_TEMPLATES.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.title}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                        任务名称
                      </span>
                      <input
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                        className="h-11 rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)]"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                        任务内容
                      </span>
                      <textarea
                        rows={5}
                        value={form.prompt}
                        onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
                        className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 text-[14px] leading-6 text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)]"
                        placeholder="例如：请每天晚上 7 点总结今天的工作进展。"
                      />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                          执行频率
                        </span>
                        <select
                          value={form.frequency}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              frequency: event.target.value as BasicFrequency,
                            }))
                          }
                        >
                          <option value="once">执行一次</option>
                          <option value="daily">每天</option>
                          <option value="weekly">每周</option>
                        </select>
                      </label>

                      {form.frequency === 'once' ? (
                        <label className="grid gap-2">
                          <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                            执行时间
                          </span>
                          <input
                            type="datetime-local"
                            value={form.onceAt}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, onceAt: event.target.value }))
                            }
                            className="h-11 rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)]"
                          />
                        </label>
                      ) : (
                        <label className="grid gap-2">
                          <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                            执行时刻
                          </span>
                          <input
                            type="time"
                            value={form.runTime}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, runTime: event.target.value }))
                            }
                            className="h-11 rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)]"
                          />
                        </label>
                      )}
                    </div>

                    {form.frequency === 'weekly' ? (
                      <label className="grid gap-2">
                        <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                          每周几执行
                        </span>
                        <select
                          value={form.weekday}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, weekday: event.target.value }))
                          }
                        >
                          {WEEKDAY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-[var(--border-default)] px-5 py-4">
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        setMode('advanced');
                      }}
                      className="iclaw-apple-button iclaw-apple-button--secondary"
                    >
                      <Settings2 className="h-4 w-4" />
                      去高级模式
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className="iclaw-apple-button iclaw-apple-button--primary"
                    >
                      {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {form.id ? '保存任务' : '创建任务'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          ref={hostRef}
          className={
            mode === 'advanced'
              ? 'openclaw-cron-surface-host'
              : 'openclaw-cron-surface-host openclaw-cron-surface-host--hidden'
          }
        />

        {showConnectionCard ? (
          <div className="iclaw-chat-state-card">
            <div className="iclaw-chat-state-card__eyebrow">定时任务中心</div>
            <div className="iclaw-chat-state-card__title">
              {status.connected ? '正在准备定时任务管理界面' : '正在连接 OpenClaw 网关'}
            </div>
            <div className="iclaw-chat-state-card__body">{connectionMessage}</div>
            <div className="iclaw-chat-state-card__meta">网关地址：{gatewayUrl}</div>
          </div>
        ) : null}

        {showRenderDiagnosticsCard ? (
          <div className="iclaw-chat-inline-warning" role="status">
            网关已经连接，但定时任务面板尚未进入可见态。更像是嵌入层渲染问题，不是登录问题。
          </div>
        ) : null}

        {mode === 'advanced' && status.connected ? (
          <div className="pointer-events-none absolute right-5 top-4 z-20">
            <button
              type="button"
              onClick={() => setMode('basic')}
              className="pointer-events-auto iclaw-apple-button iclaw-apple-button--secondary"
            >
              <Repeat className="h-4 w-4" />
              返回基础模式
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
