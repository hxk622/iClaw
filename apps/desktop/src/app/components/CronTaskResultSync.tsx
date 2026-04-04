import { useEffect, useRef } from 'react';
import {
  inferChatTurnArtifactsFromText,
  readChatTurns,
  subscribeChatTurns,
  type ChatTurnRecord,
  upsertCronTaskTurn,
} from '@/app/lib/chat-turns';
import { pushAppNotification } from '@/app/lib/task-notifications';
import {
  markCronRunNotified,
  seedCronNotificationWatermarks,
  shouldNotifyCronRun,
} from '@/app/lib/cron-notification-watermarks';

type CronSchedule =
  | { kind: 'at'; at: string }
  | { kind: 'every'; everyMs: number; anchorMs?: number }
  | { kind: 'cron'; expr: string; tz?: string; staggerMs?: number };

type CronRunStatus = 'ok' | 'error' | 'skipped';

type CronDeliveryStatus = 'delivered' | 'not-delivered' | 'unknown' | 'not-requested';

type CronJob = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: CronSchedule;
  payload:
    | { kind: 'systemEvent'; text: string }
    | {
        kind: 'agentTurn';
        message: string;
        model?: string;
        thinking?: string;
      };
  state?: {
    nextRunAtMs?: number;
    runningAtMs?: number;
    lastRunAtMs?: number;
    lastRunStatus?: CronRunStatus;
    lastStatus?: CronRunStatus;
    lastDurationMs?: number;
    lastErrorReason?: string;
    lastError?: string;
    consecutiveErrors?: number;
    lastDeliveryStatus?: CronDeliveryStatus;
  };
};

type CronListResult = {
  jobs?: CronJob[];
};

type PersistedCronTurnMap = Record<string, ChatTurnRecord>;

type GatewayResponseFrame = {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    message?: string;
  };
};

type GatewayEventFrame = {
  type: 'event';
  event: string;
  payload?: unknown;
};

type GatewayFrame = GatewayResponseFrame | GatewayEventFrame;

const GATEWAY_CONNECT_SCOPES = ['operator.read', 'operator.write', 'operator.admin'];

function buildGatewayConnectParams(gatewayToken?: string, gatewayPassword?: string): Record<string, unknown> {
  const token = gatewayToken?.trim() || undefined;
  const password = gatewayPassword?.trim() || undefined;
  return {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: 'openclaw-control-ui',
      version: 'control-ui',
      platform: navigator.platform || 'MacIntel',
      mode: 'webchat',
    },
    caps: [],
    ...(token || password
      ? {
          auth: {
            ...(token ? { token } : {}),
            ...(password ? { password } : {}),
          },
        }
      : {}),
    role: 'operator',
    scopes: GATEWAY_CONNECT_SCOPES,
  };
}

function parseGatewayFrame(raw: string): GatewayFrame | null {
  try {
    const parsed = JSON.parse(raw) as GatewayFrame | null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function requestGateway<T>(input: {
  gatewayUrl: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  method: string;
  params?: unknown;
}): Promise<T> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket | null = null;
    let settled = false;
    let requestId: string | null = null;
    let connected = false;

    const cleanup = () => {
      if (!ws) {
        return;
      }
      const current = ws;
      ws = null;
      try {
        current.close();
      } catch {
        // ignore close errors for best-effort background sync
      }
    };

    const fail = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const succeed = (payload: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(payload as T);
    };

    const sendRequest = (method: string, params?: unknown) => {
      if (!ws) {
        fail(new Error('gateway websocket unavailable'));
        return;
      }
      requestId = crypto.randomUUID();
      ws.send(
        JSON.stringify({
          type: 'req',
          id: requestId,
          method,
          params,
        }),
      );
    };

    try {
      ws = new WebSocket(input.gatewayUrl);
    } catch (error) {
      fail(error);
      return;
    }

    ws.onmessage = (event) => {
      const frame = parseGatewayFrame(String(event.data));
      if (!frame) {
        return;
      }

      if (frame.type === 'event' && frame.event === 'connect.challenge') {
        sendRequest('connect', buildGatewayConnectParams(input.gatewayToken, input.gatewayPassword));
        return;
      }

      if (frame.type !== 'res' || !requestId || frame.id !== requestId) {
        return;
      }

      if (!frame.ok) {
        fail(frame.error?.message || 'gateway request failed');
        return;
      }

      if (!connected) {
        connected = true;
        sendRequest(input.method, input.params);
        return;
      }

      succeed(frame.payload);
    };

    ws.onerror = () => {
      fail(new Error('gateway websocket error'));
    };

    ws.onclose = () => {
      if (!settled) {
        fail(new Error('gateway websocket closed'));
      }
    };
  });
}

function trimText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function resolvePersistedCronTurns(): PersistedCronTurnMap {
  const result: PersistedCronTurnMap = {};
  readChatTurns().forEach((turn) => {
    if (turn.source !== 'cron') {
      return;
    }
    const jobId = turn.sourceEntityId?.trim();
    if (!jobId) {
      return;
    }
    const previous = result[jobId];
    if (!previous || new Date(turn.updatedAt).getTime() >= new Date(previous.updatedAt).getTime()) {
      result[jobId] = turn;
    }
  });
  return result;
}

function resolveRunSummary(job: CronJob | null, turn: ChatTurnRecord | null): string {
  if (job?.state?.lastError?.trim()) {
    return job.state.lastError.trim();
  }
  if (turn?.lastError?.trim()) {
    return turn.lastError.trim();
  }
  if (job?.state?.lastStatus === 'ok') {
    return '最近一次执行已完成，但当前运行时没有返回可展示的摘要。';
  }
  if (job?.state?.lastStatus === 'skipped') {
    return '这次任务被跳过了，可以打开详情查看具体原因。';
  }
  if (job?.state?.runningAtMs) {
    return '任务正在执行中。';
  }
  if (job?.state?.nextRunAtMs) {
    return '任务已创建，等待按计划执行。';
  }
  return turn?.summary?.trim() || '任务已创建，等待执行结果。';
}

function resolveTurnStatus(job: CronJob | null, turn: ChatTurnRecord | null) {
  if (job?.state?.runningAtMs) {
    return 'running' as const;
  }
  if (job?.state?.lastStatus === 'ok') {
    return 'completed' as const;
  }
  if (job?.state?.lastStatus === 'error') {
    return 'failed' as const;
  }
  if (turn?.status === 'completed') {
    return 'completed' as const;
  }
  if (turn?.status === 'failed') {
    return 'failed' as const;
  }
  return 'running' as const;
}

export function CronTaskResultSync({
  gatewayUrl,
  gatewayToken,
  gatewayPassword,
  sessionKey: _sessionKey,
  enabled,
}: {
  gatewayUrl: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  sessionKey: string;
  enabled: boolean;
}) {
  const latestRunTsByJobRef = useRef<Record<string, number>>({});
  const persistedCronTurnsByJobIdRef = useRef<PersistedCronTurnMap>({});

  useEffect(() => {
    const syncPersistedCronTurns = (options?: { seedWatermarks?: boolean }) => {
      const nextTurns = resolvePersistedCronTurns();
      if (options?.seedWatermarks) {
        seedCronNotificationWatermarks(Object.values(nextTurns));
      }
      Object.entries(nextTurns).forEach(([jobId, turn]) => {
        const storedTs = new Date(turn.updatedAt).getTime();
        if (Number.isFinite(storedTs) && storedTs > (latestRunTsByJobRef.current[jobId] ?? 0)) {
          latestRunTsByJobRef.current[jobId] = storedTs;
        }
      });
      persistedCronTurnsByJobIdRef.current = nextTurns;
    };

    syncPersistedCronTurns({ seedWatermarks: true });
    return subscribeChatTurns(() => {
      syncPersistedCronTurns();
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const syncOnce = async () => {
      try {
        const listResult = await requestGateway<CronListResult>({
          gatewayUrl,
          gatewayToken,
          gatewayPassword,
          method: 'cron.list',
          params: {
            includeDisabled: true,
            limit: 100,
            sortBy: 'nextRunAtMs',
            sortDir: 'asc',
          },
        });
        if (cancelled) {
          return;
        }

        const jobs = Array.isArray(listResult.jobs) ? listResult.jobs : [];
        for (const job of jobs) {
          const jobId = job.id?.trim();
          if (!jobId) {
            continue;
          }
          const turn = persistedCronTurnsByJobIdRef.current[jobId] ?? null;
          const summary = resolveRunSummary(job, turn);
          const status = resolveTurnStatus(job, turn);

          upsertCronTaskTurn({
            jobId,
            name: job.name ?? turn?.title ?? '定时任务',
            prompt:
              job.payload.kind === 'agentTurn'
                ? job.payload.message
                : job.payload.text,
            summary: trimText(summary, 120),
            status,
            sessionKey: turn?.sessionKey ?? null,
            error: job.state?.lastError ?? turn?.lastError ?? null,
            artifacts: inferChatTurnArtifactsFromText(`${job.name ?? turn?.title ?? '定时任务'}\n${summary}`),
            model: turn?.model ?? null,
            provider: turn?.provider ?? null,
            deliveryStatus: turn?.deliveryStatus ?? job.state?.lastDeliveryStatus ?? null,
            nextRunAt: job.state?.nextRunAtMs ?? turn?.nextRunAt ?? null,
            runAt: job.state?.lastRunAtMs ?? Date.now(),
          });

          const latestRunTs = job.state?.lastRunAtMs ?? 0;
          if (!Number.isFinite(latestRunTs) || latestRunTs <= 0) {
            continue;
          }
          const previousRunTs = latestRunTsByJobRef.current[jobId] ?? 0;
          latestRunTsByJobRef.current[jobId] = Math.max(previousRunTs, latestRunTs);
          if (latestRunTs <= previousRunTs || !shouldNotifyCronRun(jobId, latestRunTs)) {
            continue;
          }
          if (job.state?.lastStatus === 'ok') {
            markCronRunNotified(jobId, latestRunTs);
            pushAppNotification({
              tone: 'success',
              source: 'cron',
              title: '定时任务已完成',
              text: summary,
              metadata: {
                taskName: job.name ?? turn?.title ?? '定时任务',
                routeTarget: 'cron',
                sessionKey: turn?.sessionKey ?? null,
                conversationId: turn?.conversationId ?? null,
                cronJobId: jobId,
                model: turn?.model ?? null,
                provider: turn?.provider ?? null,
                nextRunAt: job.state?.nextRunAtMs ?? turn?.nextRunAt ?? null,
                runAt: job.state?.lastRunAtMs ?? latestRunTs,
                result: summary,
              },
            });
            continue;
          }
          if (job.state?.lastStatus === 'error') {
            markCronRunNotified(jobId, latestRunTs);
            pushAppNotification({
              tone: 'error',
              source: 'cron',
              title: '定时任务执行失败',
              text: job.state?.lastError?.trim() || summary,
              metadata: {
                taskName: job.name ?? turn?.title ?? '定时任务',
                routeTarget: 'cron',
                sessionKey: turn?.sessionKey ?? null,
                conversationId: turn?.conversationId ?? null,
                cronJobId: jobId,
                model: turn?.model ?? null,
                provider: turn?.provider ?? null,
                nextRunAt: job.state?.nextRunAtMs ?? turn?.nextRunAt ?? null,
                runAt: job.state?.lastRunAtMs ?? latestRunTs,
                errorReason: job.state?.lastError?.trim() || summary,
              },
            });
          }
        }
      } catch {
        // swallow: sync loop is best-effort; UI-specific error surfacing stays in the cron page.
      }
    };

    void syncOnce();
    const timer = window.setInterval(() => {
      void syncOnce();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, gatewayPassword, gatewayToken, gatewayUrl]);

  return null;
}
