import {
  Activity,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  LoaderCircle,
  Pause,
  PencilLine,
  Play,
  Plus,
  Power,
  RefreshCw,
  Repeat,
  Settings2,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import '@openclaw-ui/main.ts';
import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { CompactSegmentedControl } from '@/app/components/ui/CompactSegmentedControl';
import { EmptyStatePanel } from '@/app/components/ui/EmptyStatePanel';
import { PageContent, PageHeader, PageSurface } from '@/app/components/ui/PageLayout';
import { SurfacePanel } from '@/app/components/ui/SurfacePanel';
import { SummaryMetricItem } from '@/app/components/ui/SummaryMetricItem';
import { cn } from '@/app/lib/cn';
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
    buildDefault: () => ({
      name: '自定义任务',
      prompt: '',
      frequency: 'daily',
    }),
  },
];

const CRON_GHOST_ICON_BUTTON_CLASS =
  'h-8 w-8 rounded-[8px] px-0 py-0 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]';

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

function getJobStatusTone(job: CronJob): { label: string; tone: 'muted' | 'brand' | 'danger' | 'success' } {
  if (!job.enabled) {
    return { label: '已暂停', tone: 'muted' };
  }
  if (job.state?.runningAtMs) {
    return { label: '执行中', tone: 'brand' };
  }
  if (job.state?.lastStatus === 'error') {
    return { label: '异常', tone: 'danger' };
  }
  return { label: '正常', tone: 'success' };
}

function getTemplateMeta(templateId: BasicTemplateId): BasicTemplate {
  return BASIC_TEMPLATES.find((item) => item.id === templateId) ?? BASIC_TEMPLATES[0];
}

function getTemplateIcon(templateId: BasicTemplateId) {
  if (templateId === 'reminder') {
    return Bell;
  }
  if (templateId === 'daily-summary') {
    return FileText;
  }
  if (templateId === 'weekly-report') {
    return BarChart3;
  }
  return Sparkles;
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

  const previewText =
    form.name.trim() || form.prompt.trim()
      ? `${form.name.trim() || '这个任务'}将在${
          form.frequency === 'once'
            ? '指定时间'
            : form.frequency === 'daily'
              ? '每天'
              : '每周'
        } ${form.frequency === 'once' ? form.onceAt.replace('T', ' ') : form.runTime} 自动执行`
      : '填写名称、内容和执行时间后，这里会实时预览任务安排。';

  const fieldClassName =
    'w-full rounded-[10px] border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--bg-hover)_60%,white_40%)] px-4 py-2.5 text-[14px] text-[var(--text-primary)] outline-none transition focus:border-[#D4A574] focus:ring-2 focus:ring-[rgba(212,165,116,0.18)] dark:bg-[rgba(255,255,255,0.04)] dark:focus:border-[#C99A6E] dark:focus:ring-[rgba(201,154,110,0.22)]';

  return (
    <PageSurface as="div">
      <PageContent className="flex min-h-full flex-col">
        <PageHeader
          eyebrow="Automation"
          title="定时任务中心"
          description="基础模式继续负责高频创建与管理，高级模式保留 OpenClaw 原生面板。两种模式现在统一挂在同一套页面壳和交互规范下。"
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />}
                onClick={() => void loadSnapshot()}
                disabled={loading || !clientReady}
              >
                刷新
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={mode === 'advanced' ? <Repeat className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
                onClick={() => setMode((current) => (current === 'basic' ? 'advanced' : 'basic'))}
              >
                {mode === 'advanced' ? '返回基础模式' : '高级模式'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={() => openCreate('reminder')}
                disabled={!clientReady}
              >
                新建任务
              </Button>
            </>
          }
        />

        <SurfacePanel tone="subtle" className="mt-5 rounded-[28px] p-2">
          <div className="flex flex-wrap gap-y-2">
            <SummaryMetricItem
              first
              tone={cronStatus?.enabled === false ? 'warning' : 'success'}
              icon={Activity}
              label="调度"
              value={cronStatus?.enabled === false ? '关闭' : '正常'}
              note={`运行中 ${jobs.filter((job) => job.enabled).length} 个任务`}
            />
            <SummaryMetricItem
              tone="brand"
              icon={CheckCircle2}
              label="任务"
              value={String(cronStatus?.jobs ?? jobs.length)}
              note={`基础模式可直接编辑 ${basicJobs.length} 个`}
            />
            <SummaryMetricItem
              tone="neutral"
              icon={Clock}
              label="下次执行"
              value={formatRelative(cronStatus?.nextWakeAtMs)}
              note={jobs.find((job) => job.enabled)?.name ?? formatTimestamp(cronStatus?.nextWakeAtMs)}
            />
            <SummaryMetricItem
              tone="warning"
              icon={Zap}
              label="当前模式"
              value={mode === 'advanced' ? '高级' : '基础'}
              note={mode === 'advanced' ? '保留 OpenClaw 原生任务面板' : '适合高频创建和管理'}
            />
          </div>
        </SurfacePanel>

        {notice ? (
          <div className="mt-4">
            <EmptyStatePanel
              compact
              title={notice.tone === 'success' ? '任务操作已完成' : '任务操作失败'}
              description={notice.text}
            />
          </div>
        ) : null}

        {fetchError ? (
          <div className="mt-4">
            <EmptyStatePanel compact title="读取定时任务失败" description={fetchError} />
          </div>
        ) : null}

        {showConnectionCard ? (
          <div className="mt-4">
            <EmptyStatePanel
              compact
              title={status.connected ? '正在准备高级任务面板' : '正在连接 OpenClaw 网关'}
              description={
                <>
                  {connectionMessage}
                  <br />
                  网关地址：{gatewayUrl}
                </>
              }
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<RefreshCw className="h-4 w-4" />}
                  onClick={() => appRef.current?.connect()}
                >
                  重新连接
                </Button>
              }
            />
          </div>
        ) : null}

        {showRenderDiagnosticsCard ? (
          <div className="mt-4">
            <EmptyStatePanel
              compact
              title="高级任务面板尚未进入可见态"
              description="网关已经连接，但定时任务面板还没有稳定渲染完成，更像是嵌入层可见性问题。"
            />
          </div>
        ) : null}

        {mode === 'basic' ? (
          <div className="mt-5 space-y-5">
            <SurfacePanel className="rounded-[28px] p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">快速创建</h2>
                  <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">选择模板直接生成一个基础定时任务。</p>
                </div>
                <Chip tone="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                  模板 {BASIC_TEMPLATES.length} 个
                </Chip>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {BASIC_TEMPLATES.map((template) => {
                  const Icon = getTemplateIcon(template.id);
                  return (
                    <PressableCard
                      key={template.id}
                      interactive
                      onClick={() => openCreate(template.id)}
                      className="group rounded-[24px] border-[var(--border-default)] px-4 py-4"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]',
                            template.id === 'reminder' && 'bg-[var(--chip-brand-bg)] text-[var(--chip-brand-text)]',
                            template.id === 'daily-summary' && 'bg-[rgba(16,185,129,0.12)] text-[rgb(5,150,105)] dark:text-[#86efac]',
                            template.id === 'weekly-report' && 'bg-[rgba(245,158,11,0.14)] text-[rgb(180,100,24)] dark:text-[#fcd34d]',
                            template.id === 'custom' && 'bg-[rgba(212,165,116,0.16)] text-[rgb(184,137,93)] dark:text-[#e8c9a6]',
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[14px] font-medium text-[var(--text-primary)]">{template.title}</h3>
                          <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{template.summary}</p>
                        </div>
                      </div>
                    </PressableCard>
                  );
                })}
              </div>
            </SurfacePanel>

            <SurfacePanel className="rounded-[28px] p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">我的任务</h2>
                  <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">统一查看、运行、编辑和停用你已经创建的任务。</p>
                </div>
                <CompactSegmentedControl
                  options={[
                    { value: 'all', label: '全部' },
                    { value: 'enabled', label: '进行中' },
                    { value: 'paused', label: '已暂停' },
                  ]}
                  value={listFilter}
                  onChange={setListFilter}
                />
              </div>

              {loading ? (
                <EmptyStatePanel
                  compact
                  title="正在读取定时任务"
                  description={
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      稍等片刻，正在同步本地运行时中的任务列表。
                    </span>
                  }
                />
              ) : visibleJobs.length === 0 ? (
                <EmptyStatePanel
                  compact
                  title="暂无任务"
                  description="点击上方“新建任务”，或者先从模板区快速生成一个任务。"
                />
              ) : (
                <div className="space-y-3">
                  {visibleJobs.map((job) => {
                    const tone = getJobStatusTone(job);
                    const templateId = inferTemplateId(job);
                    const Icon = getTemplateIcon(templateId);
                    const isAdvancedOnly = !isBasicEditableJob(job);
                    const resultTone =
                      job.state?.lastStatus === 'error'
                        ? 'danger'
                        : job.state?.lastStatus === 'ok'
                          ? 'success'
                          : 'muted';
                    const resultText =
                      job.state?.lastStatus === 'error'
                        ? '失败'
                        : job.state?.lastStatus === 'ok'
                          ? '成功'
                          : '待执行';
                    const frequencyLabel =
                      parseSimpleCronSchedule(job.schedule)?.frequency === 'daily'
                        ? '每日'
                        : parseSimpleCronSchedule(job.schedule)?.frequency === 'weekly'
                          ? '每周'
                          : parseSimpleCronSchedule(job.schedule)?.frequency === 'once'
                            ? '单次'
                            : '自定义';

                    return (
                      <PressableCard key={job.id} className="group rounded-[24px] border-[var(--border-default)] px-4 py-4">
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[color-mix(in_srgb,var(--bg-hover)_80%,transparent)]',
                              templateId === 'reminder' && 'text-[rgb(37,99,235)] dark:text-[#93c5fd]',
                              templateId === 'daily-summary' && 'text-[rgb(5,150,105)] dark:text-[#86efac]',
                              templateId === 'weekly-report' && 'text-[rgb(180,100,24)] dark:text-[#fcd34d]',
                              templateId === 'custom' && 'text-[rgb(184,137,93)] dark:text-[#e8c9a6]',
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                              <h3 className="truncate text-[14px] font-medium text-[var(--text-primary)]">{job.name}</h3>
                              <Chip tone={tone.tone} className="rounded-[6px] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]">
                                {tone.label}
                              </Chip>
                              <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{frequencyLabel}</span>
                              {isAdvancedOnly ? (
                                <Chip tone="warning" className="rounded-[6px] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]">
                                  高级任务
                                </Chip>
                              ) : null}
                            </div>

                            <p className="truncate text-[12px] text-[var(--text-secondary)]">
                              {job.payload.kind === 'agentTurn' ? job.payload.message : job.payload.text}
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[var(--text-muted)]">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                下次: {formatTimestamp(job.state?.nextRunAtMs ?? null)}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Repeat className="h-3 w-3" />
                                节奏: {buildHumanSchedule(job.schedule)}
                              </span>
                              <span>
                                结果:{' '}
                                <span
                                  className={cn(
                                    resultTone === 'success' && 'text-[rgb(21,128,61)] dark:text-[#86efac]',
                                    resultTone === 'danger' && 'text-[rgb(185,28,28)] dark:text-[#fecaca]',
                                    resultTone === 'muted' && 'text-[var(--text-muted)]',
                                  )}
                                >
                                  {resultText}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={CRON_GHOST_ICON_BUTTON_CLASS}
                              onClick={() => void handleRun(job)}
                              disabled={actionJobId === job.id}
                            >
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={CRON_GHOST_ICON_BUTTON_CLASS}
                              onClick={() => openEdit(job)}
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={CRON_GHOST_ICON_BUTTON_CLASS}
                              onClick={() => void handleToggle(job)}
                              disabled={actionJobId === job.id}
                            >
                              {job.enabled ? <Pause className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`${CRON_GHOST_ICON_BUTTON_CLASS} text-[rgb(185,28,28)] hover:text-[rgb(185,28,28)]`}
                              onClick={() => void handleRemove(job)}
                              disabled={actionJobId === job.id}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </PressableCard>
                    );
                  })}
                </div>
              )}
            </SurfacePanel>

            {drawerOpen ? (
              <>
                <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
                <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[0_24px_64px_rgba(15,23,42,0.18)] dark:border-[rgba(255,255,255,0.08)] dark:shadow-[0_28px_70px_rgba(0,0,0,0.42)]">
                    <div className="flex items-center justify-between border-b border-[var(--border-default)] px-6 py-4 dark:border-[rgba(255,255,255,0.08)]">
                      <div>
                        <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">{form.id ? '编辑任务' : '创建新任务'}</h2>
                        <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">模板: {getTemplateMeta(form.templateId).title}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 rounded-[12px] px-0 py-0 hover:bg-[var(--bg-hover)]"
                        onClick={() => setDrawerOpen(false)}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="grid gap-5 p-6">
                      <label className="grid gap-2">
                        <span className="text-[14px] font-medium text-[var(--text-primary)]">模板</span>
                        <select
                          value={form.templateId}
                          onChange={(event) => handleTemplateChange(event.target.value as BasicTemplateId)}
                          className={fieldClassName}
                        >
                          {BASIC_TEMPLATES.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.title}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2">
                        <span className="text-[14px] font-medium text-[var(--text-primary)]">任务名称</span>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="输入任务名称"
                          className={fieldClassName}
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-[14px] font-medium text-[var(--text-primary)]">任务描述</span>
                        <textarea
                          rows={3}
                          value={form.prompt}
                          onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
                          placeholder="简要描述任务内容"
                          className={cn(fieldClassName, 'resize-none py-3')}
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-4">
                        <label className="grid gap-2">
                          <span className="text-[14px] font-medium text-[var(--text-primary)]">执行频率</span>
                          <select
                            value={form.frequency}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                frequency: event.target.value as BasicFrequency,
                              }))
                            }
                            className={fieldClassName}
                          >
                            <option value="once">单次执行</option>
                            <option value="daily">每天</option>
                            <option value="weekly">每周</option>
                          </select>
                        </label>

                        {form.frequency === 'once' ? (
                          <label className="grid gap-2">
                            <span className="text-[14px] font-medium text-[var(--text-primary)]">执行时间</span>
                            <input
                              type="datetime-local"
                              value={form.onceAt}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, onceAt: event.target.value }))
                              }
                              className={fieldClassName}
                            />
                          </label>
                        ) : (
                          <label className="grid gap-2">
                            <span className="text-[14px] font-medium text-[var(--text-primary)]">执行时间</span>
                            <input
                              type="time"
                              value={form.runTime}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, runTime: event.target.value }))
                              }
                              className={fieldClassName}
                            />
                          </label>
                        )}
                      </div>

                      {form.frequency === 'weekly' ? (
                        <label className="grid gap-2">
                          <span className="text-[14px] font-medium text-[var(--text-primary)]">每周几执行</span>
                          <select
                            value={form.weekday}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, weekday: event.target.value }))
                            }
                            className={fieldClassName}
                          >
                            {WEEKDAY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      <div className="rounded-[18px] border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--bg-hover)_50%,transparent)] px-4 py-4 dark:border-[rgba(255,255,255,0.08)]">
                        <div className="text-[14px] font-medium text-[var(--text-primary)]">任务预览</div>
                        <p className="mt-2 text-[14px] text-[var(--text-secondary)]">{previewText}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-[var(--border-default)] bg-[color-mix(in_srgb,var(--bg-hover)_35%,transparent)] px-6 py-4 dark:border-[rgba(255,255,255,0.08)]">
                      <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)}>
                        取消
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        leadingIcon={saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        onClick={() => void handleSave()}
                        disabled={saving}
                      >
                        {form.id ? '保存任务' : '创建任务'}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        <SurfacePanel
          className={cn(
            'relative mt-5 flex min-h-[720px] min-w-0 flex-1 overflow-hidden rounded-[32px] border-[var(--chat-surface-panel-border)] bg-[var(--chat-surface-panel)] p-0',
            mode === 'advanced' ? 'flex' : 'hidden',
          )}
        >
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

              <div ref={hostRef} className="openclaw-cron-surface-host" />

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
            </div>
          </div>
        </SurfacePanel>
      </PageContent>
    </PageSurface>
  );
}
