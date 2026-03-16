import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {randomUUID} from 'node:crypto';

import {HttpError} from './errors.ts';

export type HandlerContext<TBody = unknown> = {
  body: TBody;
  requestId: string;
  headers: IncomingMessage['headers'];
  url: URL;
};

export type RawResponse = {
  body: Buffer | string;
  statusCode?: number;
  headers?: Record<string, string>;
};

type RouteHandler<TBody = unknown> = (context: HandlerContext<TBody>) => Promise<unknown | RawResponse> | unknown | RawResponse;

type Route = {
  method: string;
  path: string;
  handler: RouteHandler;
};

type JsonServerOptions = {
  allowedOrigins?: string[];
};

function resolveCorsOrigin(origin: string | undefined, allowedOrigins: Set<string>): string | null {
  if (!origin) return null;
  return allowedOrigins.has(origin) ? origin : null;
}

function applyCorsHeaders(request: IncomingMessage, response: ServerResponse, allowedOrigins: Set<string>): void {
  const originHeader = request.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  const allowOrigin = resolveCorsOrigin(origin, allowedOrigins);
  if (!allowOrigin) return;

  response.setHeader('Access-Control-Allow-Origin', allowOrigin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Vary', 'Origin');
}

function json(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function raw(response: ServerResponse, result: RawResponse): void {
  response.statusCode = result.statusCode || 200;
  for (const [key, value] of Object.entries(result.headers || {})) {
    response.setHeader(key, value);
  }
  response.end(result.body);
}

function isRawResponse(value: unknown): value is RawResponse {
  if (!value || typeof value !== 'object') return false;
  if (!('body' in value)) return false;
  return Buffer.isBuffer((value as {body?: unknown}).body) || typeof (value as {body?: unknown}).body === 'string';
}

export function createRawResponse(body: Buffer | string, init?: Omit<RawResponse, 'body'>): RawResponse {
  return {
    body,
    statusCode: init?.statusCode,
    headers: init?.headers,
  };
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', 'Request body must be valid JSON');
  }
}

export function createJsonServer(routes: Route[], options: JsonServerOptions = {}) {
  const allowedOrigins = new Set((options.allowedOrigins || []).map((entry) => entry.trim()).filter(Boolean));
  return createServer(async (request, response) => {
    const requestId = randomUUID();
    response.setHeader('x-request-id', requestId);
    applyCorsHeaders(request, response, allowedOrigins);

    if (request.method === 'OPTIONS') {
      response.statusCode = 204;
      response.end();
      return;
    }

    try {
      const url = new URL(request.url || '/', 'http://localhost');
      const route = routes.find((item) => item.method === request.method && item.path === url.pathname);
      if (!route) {
        throw new HttpError(404, 'NOT_FOUND', 'Route not found');
      }

      const body = await readBody(request);
      const data = await route.handler({
        body,
        requestId,
        headers: request.headers,
        url,
      });

      if (isRawResponse(data)) {
        raw(response, data);
        return;
      }

      json(response, 200, {success: true, data});
    } catch (error) {
      const httpError =
        error instanceof HttpError
          ? error
          : new HttpError(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Unexpected error');

      json(response, httpError.statusCode, {
        success: false,
        error: {
          code: httpError.api.code,
          message: httpError.api.message,
          requestId,
        },
      });
    }
  });
}
