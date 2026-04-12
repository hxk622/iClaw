import type { IClawClient } from '@iclaw/sdk';
import { BRAND } from './brand';
import { loadDesktopClientMetricsContext } from './tauri-runtime-config';

type ClientMetricQueueItem = Record<string, unknown>;

const CLIENT_METRIC_QUEUE_STORAGE_KEY = 'iclaw.client-metrics.queue.v1';
const MAX_QUEUE_ITEMS = 200;

let cachedContextPromise: Promise<Record<string, unknown>> | null = null;
let queue: ClientMetricQueueItem[] | null = null;

function readBrowserQueue(): ClientMetricQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CLIENT_METRIC_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

function writeBrowserQueue(items: ClientMetricQueueItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLIENT_METRIC_QUEUE_STORAGE_KEY, JSON.stringify(items.slice(-MAX_QUEUE_ITEMS)));
  } catch {}
}

function loadQueue(): ClientMetricQueueItem[] {
  if (!queue) {
    queue = readBrowserQueue();
  }
  return queue;
}

function persistQueue() {
  if (!queue) return;
  writeBrowserQueue(queue);
}

function normalizePlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const raw = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (raw.includes('mac')) return 'macos';
  if (raw.includes('win')) return 'windows';
  if (raw.includes('linux')) return 'linux';
  return 'unknown';
}

function normalizeArch(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const raw = navigator.userAgent.toLowerCase();
  if (raw.includes('arm64') || raw.includes('aarch64')) return 'aarch64';
  if (raw.includes('x64') || raw.includes('x86_64') || raw.includes('amd64') || raw.includes('win64')) return 'x64';
  return 'unknown';
}

async function resolveClientMetricsContext(): Promise<Record<string, unknown>> {
  if (!cachedContextPromise) {
    cachedContextPromise = (async () => {
      const tauriContext = await loadDesktopClientMetricsContext().catch(() => null);
      if (tauriContext) {
        return {
          device_id: tauriContext.device_id,
          platform: tauriContext.platform,
          platform_version: tauriContext.platform_version,
          arch: tauriContext.arch,
          app_version: tauriContext.app_version,
          brand_id: tauriContext.brand_id,
        };
      }
      return {
        device_id: 'browser-fallback',
        platform: normalizePlatform(),
        platform_version: null,
        arch: normalizeArch(),
        app_version: 'unknown',
        brand_id: BRAND.brandId,
      };
    })();
  }
  return cachedContextPromise;
}

export async function trackClientMetricEvent(
  input: {
    client: IClawClient;
    accessToken?: string | null;
    eventName: string;
    eventTime?: string;
    sessionId?: string | null;
    installId?: string | null;
    page?: string | null;
    result?: 'success' | 'failed' | null;
    errorCode?: string | null;
    durationMs?: number | null;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const context = await resolveClientMetricsContext();
  const items = loadQueue();
  items.push({
    event_name: input.eventName.trim().toLowerCase(),
    event_time: input.eventTime || new Date().toISOString(),
    device_id: context.device_id,
    session_id: input.sessionId || null,
    install_id: input.installId || null,
    app_name: BRAND.brandId,
    brand_id: context.brand_id || BRAND.brandId,
    app_version: context.app_version || 'unknown',
    release_channel: import.meta.env.DEV ? 'dev' : 'prod',
    platform: context.platform,
    os_version: context.platform_version || null,
    arch: context.arch,
    page: input.page || null,
    result: input.result ?? null,
    error_code: input.errorCode || null,
    duration_ms: input.durationMs ?? null,
    payload_json: input.payload || {},
  });
  if (items.length > MAX_QUEUE_ITEMS) {
    items.splice(0, items.length - MAX_QUEUE_ITEMS);
  }
  persistQueue();
}

export async function flushClientMetricQueue(input: {
  client: IClawClient;
  accessToken?: string | null;
}): Promise<void> {
  const items = [...loadQueue()];
  if (!items.length) return;
  await input.client.recordClientMetricEvents({
    token: input.accessToken || null,
    items,
  });
  queue = [];
  persistQueue();
}

export async function trackClientCrash(
  input: {
    client: IClawClient;
    accessToken?: string | null;
    crashType: 'native' | 'renderer' | 'sidecar';
    errorTitle?: string | null;
    errorMessage?: string | null;
    stackSummary?: string | null;
    fileBucket?: string | null;
    fileKey?: string | null;
  },
): Promise<void> {
  const context = await resolveClientMetricsContext();
  await input.client.recordClientCrashEvent({
    token: input.accessToken || null,
    item: {
      crash_type: input.crashType,
      event_time: new Date().toISOString(),
      device_id: context.device_id,
      app_name: BRAND.brandId,
      brand_id: context.brand_id || BRAND.brandId,
      app_version: context.app_version || 'unknown',
      platform: context.platform,
      os_version: context.platform_version || null,
      arch: context.arch,
      error_title: input.errorTitle || null,
      error_message: input.errorMessage || null,
      stack_summary: input.stackSummary || null,
      file_bucket: input.fileBucket || null,
      file_key: input.fileKey || null,
    },
  });
}
