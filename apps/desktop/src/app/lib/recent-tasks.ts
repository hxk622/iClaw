import { useEffect, useState } from 'react';

export type RecentTaskStatus = 'running' | 'completed' | 'failed';
export type RecentTaskArtifact = 'report' | 'ppt' | 'webpage' | 'pdf' | 'sheet';

export interface RecentTaskRecord {
  id: string;
  source: 'chat';
  sessionKey: string;
  title: string;
  summary: string;
  prompt: string;
  status: RecentTaskStatus;
  createdAt: string;
  updatedAt: string;
  pinnedAt?: string | null;
  artifacts: RecentTaskArtifact[];
  lastError: string | null;
}

interface StartRecentTaskInput {
  prompt: string;
  sessionKey?: string;
}

interface FinishRecentTaskInput {
  id: string;
  artifacts?: RecentTaskArtifact[];
  error?: string | null;
}

const RECENT_TASKS_STORAGE_KEY = 'iclaw.recent-tasks.v1';
const RECENT_TASKS_UPDATED_EVENT = 'iclaw:recent-tasks:updated';
const MAX_PERSISTED_TASKS = 120;

export const RECENT_TASK_ARTIFACT_LABELS: Record<RecentTaskArtifact, string> = {
  report: '报告',
  ppt: 'PPT',
  webpage: '网页',
  pdf: 'PDF',
  sheet: '表格',
};

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function emitRecentTasksUpdated(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(RECENT_TASKS_UPDATED_EVENT));
}

function stripPromptMarkers(prompt: string): string {
  return prompt.replace(/\[\[(?:引用|图片|PDF|视频|附件):[\s\S]*?\]\]/g, ' ');
}

function collapseText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function trimText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function normalizeRecentTask(task: RecentTaskRecord): RecentTaskRecord {
  const normalizedPrompt = collapseText(stripPromptMarkers(task.prompt));
  const prompt = normalizedPrompt || '基于上传内容发起的任务';
  const title = collapseText(task.title) || buildRecentTaskTitle(prompt);
  const summary = collapseText(task.summary) || buildRecentTaskSummary(prompt);

  return {
    ...task,
    source: 'chat',
    sessionKey: task.sessionKey || 'main',
    prompt,
    title,
    summary,
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || task.createdAt || new Date().toISOString(),
    pinnedAt: typeof task.pinnedAt === 'string' && task.pinnedAt ? task.pinnedAt : null,
    artifacts: dedupeArtifacts(task.artifacts ?? []),
    lastError: task.lastError ?? null,
  };
}

function compareRecentTasks(a: RecentTaskRecord, b: RecentTaskRecord): number {
  const aPinned = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
  const bPinned = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;

  if (aPinned !== bPinned) {
    return bPinned - aPinned;
  }

  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function readTasksFromStorage(): RecentTaskRecord[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }
  try {
    const raw = storage.getItem(RECENT_TASKS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is RecentTaskRecord => Boolean(item && typeof item === 'object' && 'id' in item))
      .map((item) => normalizeRecentTask(item))
      .sort(compareRecentTasks);
  } catch {
    return [];
  }
}

function writeTasksToStorage(tasks: RecentTaskRecord[]): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(
      RECENT_TASKS_STORAGE_KEY,
      JSON.stringify(
        tasks
          .map((task) => normalizeRecentTask(task))
          .sort(compareRecentTasks)
          .slice(0, MAX_PERSISTED_TASKS),
      ),
    );
    emitRecentTasksUpdated();
  } catch {}
}

function updateTaskList(
  updater: (tasks: RecentTaskRecord[]) => RecentTaskRecord[],
): RecentTaskRecord[] {
  const nextTasks = updater(readTasksFromStorage());
  writeTasksToStorage(nextTasks);
  return nextTasks;
}

function createRecentTaskId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function dedupeArtifacts(artifacts: RecentTaskArtifact[]): RecentTaskArtifact[] {
  return Array.from(new Set(artifacts));
}

export function buildRecentTaskTitle(prompt: string): string {
  const cleaned = collapseText(stripPromptMarkers(prompt));
  if (!cleaned) {
    return '基于上传内容发起的任务';
  }

  const firstSentence = cleaned.split(/[。！？!?]/, 1)[0]?.trim() || cleaned;
  return trimText(firstSentence, 24);
}

export function buildRecentTaskSummary(prompt: string): string {
  const cleaned = collapseText(stripPromptMarkers(prompt));
  if (!cleaned) {
    return '基于上传内容生成结果与分析。';
  }
  return trimText(cleaned, 72);
}

export function readRecentTasks(): RecentTaskRecord[] {
  return readTasksFromStorage();
}

export function startRecentTask(input: StartRecentTaskInput): RecentTaskRecord {
  const now = new Date().toISOString();
  const task: RecentTaskRecord = {
    id: createRecentTaskId(),
    source: 'chat',
    sessionKey: input.sessionKey || 'main',
    prompt: collapseText(stripPromptMarkers(input.prompt)) || '基于上传内容发起的任务',
    title: buildRecentTaskTitle(input.prompt),
    summary: buildRecentTaskSummary(input.prompt),
    status: 'running',
    createdAt: now,
    updatedAt: now,
    pinnedAt: null,
    artifacts: [],
    lastError: null,
  };

  updateTaskList((tasks) => [task, ...tasks.filter((item) => item.id !== task.id)]);
  return task;
}

export function markRecentTaskCompleted(input: FinishRecentTaskInput): void {
  updateTaskList((tasks) =>
    tasks.map((task) =>
      task.id === input.id
        ? {
            ...task,
            status: 'completed',
            updatedAt: new Date().toISOString(),
            artifacts: dedupeArtifacts([...(task.artifacts ?? []), ...(input.artifacts ?? [])]),
            lastError: null,
          }
        : task,
    ),
  );
}

export function markRecentTaskFailed(input: FinishRecentTaskInput): void {
  updateTaskList((tasks) =>
    tasks.map((task) =>
      task.id === input.id
        ? {
            ...task,
            status: 'failed',
            updatedAt: new Date().toISOString(),
            artifacts: dedupeArtifacts([...(task.artifacts ?? []), ...(input.artifacts ?? [])]),
            lastError: collapseText(input.error ?? '') || '任务执行失败',
          }
        : task,
    ),
  );
}

export function setRecentTaskPinned(id: string, pinned: boolean): void {
  updateTaskList((tasks) =>
    tasks.map((task) =>
      task.id === id
        ? {
            ...task,
            pinnedAt: pinned ? task.pinnedAt || new Date().toISOString() : null,
          }
        : task,
    ),
  );
}

export function renameRecentTask(id: string, title: string): void {
  const normalizedTitle = collapseText(title);
  if (!normalizedTitle) {
    return;
  }

  updateTaskList((tasks) =>
    tasks.map((task) =>
      task.id === id
        ? {
            ...task,
            title: trimText(normalizedTitle, 48),
          }
        : task,
    ),
  );
}

export function deleteRecentTask(id: string): void {
  updateTaskList((tasks) => tasks.filter((task) => task.id !== id));
}

export function subscribeRecentTasks(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== RECENT_TASKS_STORAGE_KEY) {
      return;
    }
    listener();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(RECENT_TASKS_UPDATED_EVENT, listener);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(RECENT_TASKS_UPDATED_EVENT, listener);
  };
}

export function useRecentTasks(): RecentTaskRecord[] {
  const [tasks, setTasks] = useState<RecentTaskRecord[]>(() => readRecentTasks());

  useEffect(() => {
    setTasks(readRecentTasks());
    return subscribeRecentTasks(() => {
      setTasks(readRecentTasks());
    });
  }, []);

  return tasks;
}

export function inferRecentTaskArtifactsFromText(text: string): RecentTaskArtifact[] {
  const normalized = text.toLowerCase();
  const result = new Set<RecentTaskArtifact>();

  if (
    normalized.includes('.ppt') ||
    normalized.includes('.pptx') ||
    normalized.includes('slide') ||
    normalized.includes('deck') ||
    normalized.includes('presentation') ||
    normalized.includes('幻灯片') ||
    normalized.includes('演示')
  ) {
    result.add('ppt');
  }

  if (normalized.includes('.pdf') || normalized.includes(' pdf ') || normalized.includes('pdf')) {
    result.add('pdf');
  }

  if (
    normalized.includes('.html') ||
    normalized.includes('.htm') ||
    normalized.includes('网页') ||
    normalized.includes('站点') ||
    normalized.includes('site') ||
    normalized.includes('web')
  ) {
    result.add('webpage');
  }

  if (
    normalized.includes('.xls') ||
    normalized.includes('.xlsx') ||
    normalized.includes('.csv') ||
    normalized.includes('.tsv') ||
    normalized.includes('表格')
  ) {
    result.add('sheet');
  }

  if (
    normalized.includes('.md') ||
    normalized.includes('.markdown') ||
    normalized.includes('.doc') ||
    normalized.includes('.docx') ||
    normalized.includes('report') ||
    normalized.includes('memo') ||
    normalized.includes('brief') ||
    normalized.includes('document') ||
    normalized.includes('报告') ||
    normalized.includes('研报') ||
    normalized.includes('纪要') ||
    normalized.includes('备忘录') ||
    normalized.includes('文档')
  ) {
    result.add('report');
  }

  return Array.from(result);
}

export function formatRecentTaskRelativeTime(dateString: string): string {
  const timestamp = new Date(dateString).getTime();
  if (!Number.isFinite(timestamp)) {
    return '刚刚';
  }

  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))} 小时前`;
  if (diff < 7 * day) return `${Math.max(1, Math.floor(diff / day))} 天前`;

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}
