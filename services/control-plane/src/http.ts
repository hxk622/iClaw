import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {randomUUID} from 'node:crypto';

import {HttpError} from './errors.ts';
import {logError, logInfo, logWarn} from './logger.ts';

export type HandlerContext<TBody = unknown> = {
  body: TBody;
  requestId: string;
  headers: IncomingMessage['headers'];
  url: URL;
  params: Record<string, string>;
};

export type RawResponse = {
  body: Buffer | string;
  statusCode?: number;
  headers?: Record<string, string>;
};

export type ResponseHeaderResolverContext = {
  request: IncomingMessage;
  requestId: string;
  url: URL;
};

type RouteHandler<TBody = unknown> = (context: HandlerContext<TBody>) => Promise<unknown | RawResponse> | unknown | RawResponse;

type Route = {
  method: string;
  path: string;
  bodyType?: 'json' | 'raw';
  handler: RouteHandler<any>;
};

function matchRoutePath(routePath: string, requestPath: string): Record<string, string> | null {
  if (routePath === requestPath) {
    return {};
  }

  const routeParts = routePath.split('/').filter(Boolean);
  const requestParts = requestPath.split('/').filter(Boolean);
  if (routeParts.length !== requestParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let index = 0; index < routeParts.length; index += 1) {
    const routePart = routeParts[index] || '';
    const requestPart = requestParts[index] || '';
    if (routePart.startsWith(':')) {
      params[routePart.slice(1)] = decodeURIComponent(requestPart);
      continue;
    }
    if (routePart !== requestPart) {
      return null;
    }
  }

  return params;
}

type JsonServerOptions = {
  allowedOrigins?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  resolveResponseHeaders?: (
    context: ResponseHeaderResolverContext,
  ) => Promise<Record<string, string> | undefined> | Record<string, string> | undefined;
};

function resolveCorsOrigin(origin: string | undefined, allowedOrigins: Set<string>): string | null {
  if (!origin) return null;
  return allowedOrigins.has(origin) ? origin : null;
}

function applyCorsHeaders(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: Set<string>,
  allowedHeaders: string[],
  exposedHeaders: string[],
): void {
  const originHeader = request.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  const allowOrigin = resolveCorsOrigin(origin, allowedOrigins);
  if (!allowOrigin) return;

  response.setHeader('Access-Control-Allow-Origin', allowOrigin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
  if (exposedHeaders.length > 0) {
    response.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(', '));
  }
  response.setHeader('Vary', 'Origin, Access-Control-Request-Headers');
}

function json(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

const HTTP_LOG_STRING_PREVIEW_LENGTH = 240;
const HTTP_LOG_ARRAY_SAMPLE_LIMIT = 3;
const HTTP_LOG_OBJECT_SAMPLE_LIMIT = 12;
const HTTP_LOG_MAX_DEPTH = 2;

function summarizeHttpLogValue(value: unknown, depth = 0): unknown {
  if (value == null) {
    return value;
  }
  if (typeof value === 'string') {
    return value.length > HTTP_LOG_STRING_PREVIEW_LENGTH
      ? {
          type: 'string',
          length: value.length,
          preview: `${value.slice(0, HTTP_LOG_STRING_PREVIEW_LENGTH)}…`,
        }
      : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return {
      type: 'buffer',
      bytes: value.byteLength,
    };
  }
  if (depth >= HTTP_LOG_MAX_DEPTH) {
    if (Array.isArray(value)) {
      return {
        type: 'array',
        length: value.length,
      };
    }
    return {
      type: 'object',
      keyCount: Object.keys(value as Record<string, unknown>).length,
    };
  }
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      sample: value.slice(0, HTTP_LOG_ARRAY_SAMPLE_LIMIT).map((entry) => summarizeHttpLogValue(entry, depth + 1)),
    };
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return {
      type: 'object',
      keyCount: entries.length,
      fields: Object.fromEntries(
        entries
          .slice(0, HTTP_LOG_OBJECT_SAMPLE_LIMIT)
          .map(([key, entryValue]) => [key, summarizeHttpLogValue(entryValue, depth + 1)]),
      ),
      omittedKeys: Math.max(0, entries.length - HTTP_LOG_OBJECT_SAMPLE_LIMIT),
    };
  }
  return String(value);
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

async function readBody(request: IncomingMessage, bodyType: 'json' | 'raw' = 'json'): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return undefined;
  const rawBuffer = Buffer.concat(chunks);
  if (bodyType === 'raw') {
    return rawBuffer;
  }
  const raw = rawBuffer.toString('utf8');
  if (!raw.trim()) return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', 'Request body must be valid JSON');
  }
}

export function createJsonServer(routes: Route[], options: JsonServerOptions = {}) {
  const allowedOrigins = new Set((options.allowedOrigins || []).map((entry) => entry.trim()).filter(Boolean));
  const allowedHeaders = Array.from(
    new Set((options.allowedHeaders || ['Content-Type', 'Authorization']).map((entry) => entry.trim()).filter(Boolean)),
  );
  const exposedHeaders = Array.from(
    new Set((options.exposedHeaders || ['x-request-id']).map((entry) => entry.trim()).filter(Boolean)),
  );
  return createServer(async (request, response) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    response.setHeader('x-request-id', requestId);
    let url = new URL(request.url || '/', 'http://localhost');
    const method = request.method || 'GET';
    const api = `${url.pathname}${url.search}`;
    applyCorsHeaders(request, response, allowedOrigins, allowedHeaders, exposedHeaders);

    if (options.resolveResponseHeaders) {
      try {
        const resolvedHeaders = await options.resolveResponseHeaders({
          request,
          requestId,
          url,
        });
        for (const [key, value] of Object.entries(resolvedHeaders || {})) {
          response.setHeader(key, value);
        }
      } catch (error) {
        logWarn('failed to resolve response headers', {requestId, api, method, error});
      }
    }

    if (request.method === 'OPTIONS') {
      response.statusCode = 204;
      response.end();
      logInfo('request completed', {
        requestId,
        api,
        method,
        headers: request.headers,
        statusCode: 204,
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    try {
      const matched = routes
        .map((item) => ({
          route: item,
          params: item.method === request.method ? matchRoutePath(item.path, url.pathname) : null,
        }))
        .find((entry) => entry.params !== null);
      if (!matched) {
        throw new HttpError(404, 'NOT_FOUND', 'Route not found');
      }

      const body = await readBody(request, matched.route.bodyType || 'json');
      logInfo('request received', {
        requestId,
        api,
        method,
        headers: request.headers,
        payload: summarizeHttpLogValue(body),
      });
      const data = await matched.route.handler({
        body,
        requestId,
        headers: request.headers,
        url,
        params: matched.params || {},
      });

      if (isRawResponse(data)) {
        raw(response, data);
        logInfo('request completed', {
          requestId,
          api,
          method,
          statusCode: data.statusCode || 200,
          durationMs: Date.now() - startedAt,
          responsePayload: summarizeHttpLogValue({
            body: data.body,
            headers: data.headers || {},
          }),
        });
        return;
      }

      const responsePayload = {success: true, data};
      json(response, 200, responsePayload);
      logInfo('request completed', {
        requestId,
        api,
        method,
        statusCode: 200,
        durationMs: Date.now() - startedAt,
        responsePayload: summarizeHttpLogValue(responsePayload),
      });
    } catch (error) {
      const httpError =
        error instanceof HttpError
          ? error
          : new HttpError(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Unexpected error');

      const errorPayload = {
        success: false,
        error: {
          code: httpError.api.code,
          message: httpError.api.message,
          requestId,
        },
      };

      if (httpError.statusCode >= 500) {
        logError('request failed', {
          requestId,
          api,
          method,
          headers: request.headers,
          statusCode: httpError.statusCode,
          durationMs: Date.now() - startedAt,
          responsePayload: summarizeHttpLogValue(errorPayload),
          error,
        });
      } else {
        logWarn('request rejected', {
          requestId,
          api,
          method,
          headers: request.headers,
          statusCode: httpError.statusCode,
          durationMs: Date.now() - startedAt,
          responsePayload: summarizeHttpLogValue(errorPayload),
        });
      }

      json(response, httpError.statusCode, errorPayload);
    }
  });
}
