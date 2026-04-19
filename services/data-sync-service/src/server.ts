import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { executeRegisteredSyncTask } from '../../../packages/market-sync-core/src/index.ts';
import { config as controlPlaneConfig } from '../../control-plane/src/config.ts';
import { logError, logInfo } from '../../control-plane/src/logger.ts';
import { ensureControlPlaneSchema } from '../../control-plane/src/pg-store.ts';
import { startSyncTasks } from './scheduler.ts';
import { MARKET_SYNC_TASKS } from './task-registry.ts';

const DEFAULT_PORT = 2140;
const DEFAULT_HOST = '127.0.0.1';

function readNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isTruthyEnv(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value || '').trim());
}

const port = readNumberEnv('PORT', readNumberEnv('DATA_SYNC_SERVICE_PORT', DEFAULT_PORT));
const listenHost = (process.env.DATA_SYNC_SERVICE_HOST || DEFAULT_HOST).trim() || DEFAULT_HOST;
const schedulerEnabled = !['0', 'false', 'off', 'no'].includes(
  (process.env.DATA_SYNC_SERVICE_ENABLE_SCHEDULER || 'true').trim().toLowerCase(),
);
const internalToken = (process.env.DATA_SYNC_SERVICE_INTERNAL_TOKEN || '').trim();

function sendJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function bootstrap() {
  if (!controlPlaneConfig.databaseUrl) {
    throw new Error('DATABASE_URL is required for data-sync-service');
  }
  await ensureControlPlaneSchema(controlPlaneConfig.databaseUrl);
  if (schedulerEnabled) {
    startSyncTasks();
    logInfo('data-sync-service scheduler started', {
      schedulerEnabled,
      taskIds: MARKET_SYNC_TASKS.map((task) => task.id),
    });
  } else {
    logInfo('data-sync-service scheduler disabled', { schedulerEnabled });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${listenHost}:${port}`);

  if (url.pathname.startsWith('/internal/') && internalToken) {
    const headerToken = String(req.headers['x-iclaw-internal-token'] || '').trim();
    if (!headerToken || headerToken !== internalToken) {
      return sendJson(res, 401, {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'internal token is invalid',
        },
      });
    }
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, {
      success: true,
      data: {
        status: 'ok',
        service: 'data-sync-service',
        scheduler_enabled: schedulerEnabled,
        internal_auth_enabled: Boolean(internalToken),
        database_configured: Boolean(controlPlaneConfig.databaseUrl),
        tasks: MARKET_SYNC_TASKS.map((task) => ({
          id: task.id,
          label: task.label,
          category: task.category,
          schedule: task.schedule,
          timezone: task.timezone,
          warmup_on_startup: task.warmupOnStartup,
        })),
      },
    });
  }

  if (req.method === 'GET' && url.pathname === '/internal/sync-tasks') {
    return sendJson(res, 200, {
      success: true,
      data: {
        items: MARKET_SYNC_TASKS.map((task) => ({
          id: task.id,
          label: task.label,
          category: task.category,
          schedule: task.schedule,
          timezone: task.timezone,
          warmup_on_startup: task.warmupOnStartup,
        })),
      },
    });
  }

  if (req.method === 'POST' && url.pathname === '/internal/sync-tasks/run') {
    const body = await readBody(req);
    const taskId =
      (typeof body.task_id === 'string' ? body.task_id : '') ||
      (typeof body.taskId === 'string' ? body.taskId : '') ||
      url.searchParams.get('task_id') ||
      '';
    const task = MARKET_SYNC_TASKS.find((item) => item.id === taskId.trim());
    if (!task) {
      return sendJson(res, 404, {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'sync task not found',
        },
      });
    }
    try {
      const result = await executeRegisteredSyncTask(task, 'manual');
      return sendJson(res, 200, {
        success: true,
        data: {
          run_id: result.runId,
          task_id: task.id,
          status: result.status,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return sendJson(res, 500, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      });
    }
  }

  return sendJson(res, 404, {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
});

bootstrap()
  .then(() => {
    server.listen(port, listenHost, () => {
      logInfo('data-sync-service listening', {
        url: `http://${listenHost}:${port}`,
        schedulerEnabled,
      });
    });
  })
  .catch((error) => {
    logError('data-sync-service bootstrap failed', { error });
    process.exitCode = 1;
  });
