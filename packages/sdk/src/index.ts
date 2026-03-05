import { ApiError, type AuthTokens } from '@iclaw/shared';

export interface ClientOptions {
  apiBaseUrl: string;
  authBaseUrl?: string;
  gatewayWsUrl?: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  gatewaySessionKey?: string;
  preferGatewayWs?: boolean;
}

export interface StreamCallbacks {
  onStart?: (payload: unknown) => void;
  onDelta?: (text: string, payload: unknown) => void;
  onEnd?: (payload: unknown) => void;
  onError?: (error: ApiError) => void;
}

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput extends LoginInput {
  name: string;
}

interface MeResponse {
  data: unknown;
}

interface StreamChatInput {
  message: string;
  taskId?: string;
  attachments?: unknown[];
  token?: string;
  signal?: AbortSignal;
}

type GatewayEventFrame = {
  type: 'event';
  event: string;
  payload?: unknown;
};

type GatewayResponseFrame = {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { message?: string };
};

type GatewayFrame = GatewayEventFrame | GatewayResponseFrame | Record<string, unknown>;

function parseJsonSafe<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function parseError(response: Response): Promise<ApiError> {
  const text = await response.text();
  const body = parseJsonSafe<{ error?: { code?: string; message?: string; requestId?: string } }>(text);
  const payload = body?.error;
  return new ApiError({
    code: payload?.code || 'HTTP_ERROR',
    message: payload?.message || `Request failed: ${response.status}`,
    requestId: payload?.requestId,
  });
}

export class IClawClient {
  private readonly apiBaseUrl: string;
  private readonly authBaseUrl: string;
  private readonly gatewayWsUrl: string;
  private readonly gatewayToken?: string;
  private readonly gatewayPassword?: string;
  private readonly gatewaySessionKey: string;
  private readonly preferGatewayWs: boolean;

  constructor(options: ClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, '');
    this.authBaseUrl = (options.authBaseUrl || options.apiBaseUrl).replace(/\/$/, '');
    this.gatewayWsUrl =
      options.gatewayWsUrl ||
      this.apiBaseUrl.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
    this.gatewayToken = options.gatewayToken;
    this.gatewayPassword = options.gatewayPassword;
    this.gatewaySessionKey = options.gatewaySessionKey || 'main';
    this.preferGatewayWs = Boolean(options.preferGatewayWs);
  }

  async health(): Promise<unknown> {
    const res = await fetch(`${this.apiBaseUrl}/health`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const text = await res.text();
      if (
        res.status === 503 &&
        text.includes('Control UI assets not found')
      ) {
        return { status: 'ok', mode: 'gateway' };
      }
      const body = parseJsonSafe<{ error?: { code?: string; message?: string; requestId?: string } }>(text);
      const payload = body?.error;
      throw new ApiError({
        code: payload?.code || 'HTTP_ERROR',
        message: payload?.message || `Request failed: ${res.status}`,
        requestId: payload?.requestId,
      });
    }
    return res.json();
  }

  async login(input: LoginInput): Promise<{ tokens: AuthTokens; user: unknown }> {
    const res = await fetch(`${this.authBaseUrl}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: { tokens: AuthTokens; user: unknown } };
    return json.data;
  }

  async register(input: RegisterInput): Promise<{ tokens: AuthTokens; user: unknown }> {
    const res = await fetch(`${this.authBaseUrl}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: { tokens: AuthTokens; user: unknown } };
    return json.data;
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const res = await fetch(`${this.authBaseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: AuthTokens };
    return json.data;
  }

  async me(token?: string): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${this.authBaseUrl}/auth/me`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as MeResponse;
    const data = json.data as
      | { user?: unknown; profile?: unknown }
      | null
      | undefined;
    // Compatible with both `{ data: user }` and `{ data: { user } }` payloads.
    return (data && (data.user ?? data.profile)) || data || null;
  }

  private generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  private extractGatewayText(message: unknown): string {
    const m = message && typeof message === 'object' ? (message as Record<string, unknown>) : {};
    if (typeof m.text === 'string') return m.text;
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) {
      return m.content
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const text = (item as Record<string, unknown>).text;
          return typeof text === 'string' ? text : null;
        })
        .filter((v): v is string => typeof v === 'string')
        .join('\n');
    }
    return '';
  }

  private streamChatViaGateway(input: StreamChatInput, callbacks: StreamCallbacks): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.gatewayWsUrl);
      const pending = new Map<
        string,
        {
          resolve: (payload: unknown) => void;
          reject: (error: Error) => void;
          expectFinal?: boolean;
        }
      >();

      let closed = false;
      let connectSent = false;
      let runId: string | null = null;

      const cleanup = (error?: Error) => {
        if (closed) return;
        closed = true;
        try {
          ws.close();
        } catch {}
        for (const [, p] of pending) {
          p.reject(error || new Error('gateway connection closed'));
        }
        pending.clear();
      };

      const sendRequest = (method: string, params?: unknown, expectFinal?: boolean): Promise<unknown> => {
        const id = this.generateId('req');
        const frame = { type: 'req', id, method, params };
        return new Promise((resolveReq, rejectReq) => {
          pending.set(id, { resolve: resolveReq, reject: rejectReq, expectFinal });
          ws.send(JSON.stringify(frame));
        });
      };

      const handleGatewayEvent = (frame: GatewayEventFrame) => {
        if (frame.event === 'connect.challenge') {
          if (connectSent) return;
          connectSent = true;
          const challenge = frame.payload as Record<string, unknown> | undefined;
          const nonce = typeof challenge?.nonce === 'string' ? challenge.nonce : undefined;
          const auth =
            this.gatewayToken || this.gatewayPassword
              ? {
                  token: this.gatewayToken,
                  password: this.gatewayPassword,
                }
              : undefined;
          void sendRequest('connect', {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: 'iclaw.desktop',
              version: '1.0.0',
              platform: 'web',
              mode: 'backend',
            },
            caps: [],
            auth,
            role: 'operator',
            scopes: ['operator.read', 'operator.write', 'operator.admin'],
            ...(nonce ? { device: { nonce } } : {}),
          })
            .then(() =>
              sendRequest(
                'chat.send',
                {
                  sessionKey: this.gatewaySessionKey,
                  message: input.message,
                  deliver: false,
                  idempotencyKey: this.generateId('run'),
                },
                true,
              ),
            )
            .then((payload) => {
              callbacks.onStart?.(payload);
            })
            .catch((err) => {
              const apiErr = new ApiError({ code: 'GATEWAY_CONNECT_FAILED', message: String(err) });
              callbacks.onError?.(apiErr);
              cleanup(apiErr);
              reject(apiErr);
            });
          return;
        }

        const payload = frame.payload as Record<string, unknown> | undefined;
        const state = typeof payload?.state === 'string' ? payload.state : '';
        const payloadRunId = typeof payload?.runId === 'string' ? payload.runId : null;
        if (payloadRunId && !runId) {
          runId = payloadRunId;
        }
        if (runId && payloadRunId && runId !== payloadRunId) {
          return;
        }
        if (state === 'delta') {
          const text = this.extractGatewayText(payload?.message);
          callbacks.onDelta?.(text, payload);
          return;
        }
        if (state === 'final' || state === 'aborted') {
          callbacks.onEnd?.(payload);
          cleanup();
          resolve();
          return;
        }
        if (state === 'error') {
          const err = new ApiError({
            code: 'STREAM_ERROR',
            message: typeof payload?.errorMessage === 'string' ? payload.errorMessage : 'Stream error',
          });
          callbacks.onError?.(err);
          cleanup(err);
          reject(err);
        }
      };

      ws.onopen = () => {
        if (input.signal) {
          input.signal.addEventListener('abort', () => {
            const err = new ApiError({ code: 'ABORTED', message: 'Request aborted' });
            cleanup(err);
            reject(err);
          });
        }
      };

      ws.onmessage = (evt) => {
        let parsed: GatewayFrame | null = null;
        try {
          parsed = parseJsonSafe<GatewayFrame>(String(evt.data));
        } catch {
          parsed = null;
        }
        if (!parsed || typeof parsed !== 'object') return;
        if ((parsed as Record<string, unknown>).type === 'res') {
          const frame = parsed as GatewayResponseFrame;
          const p = pending.get(frame.id);
          if (!p) return;
          const status = (frame.payload as Record<string, unknown> | undefined)?.status;
          if (p.expectFinal && status === 'accepted') return;
          pending.delete(frame.id);
          if (frame.ok) p.resolve(frame.payload);
          else p.reject(new Error(frame.error?.message || 'gateway request failed'));
          return;
        }
        if ((parsed as Record<string, unknown>).type === 'event') {
          handleGatewayEvent(parsed as GatewayEventFrame);
        }
      };

      ws.onerror = () => {
        const err = new ApiError({ code: 'GATEWAY_WS_ERROR', message: 'Gateway websocket error' });
        callbacks.onError?.(err);
        cleanup(err);
        reject(err);
      };

      ws.onclose = () => {
        if (!closed) {
          const err = new ApiError({ code: 'GATEWAY_WS_CLOSED', message: 'Gateway websocket closed' });
          callbacks.onError?.(err);
          cleanup(err);
          reject(err);
        }
      };
    });
  }

  async streamChat(input: StreamChatInput, callbacks: StreamCallbacks): Promise<void> {
    if (this.preferGatewayWs) {
      return this.streamChatViaGateway(input, callbacks);
    }

    const res = await fetch(`${this.apiBaseUrl}/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.token ? { Authorization: `Bearer ${input.token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        message: input.message,
        taskId: input.taskId,
        attachments: input.attachments || [],
      }),
      signal: input.signal,
    });

    if (!res.ok) {
      if (res.status === 404 || res.status === 503) {
        return this.streamChatViaGateway(input, callbacks);
      }
      const err = await parseError(res);
      callbacks.onError?.(err);
      throw err;
    }

    if (!res.body) {
      const err = new ApiError({ code: 'EMPTY_STREAM', message: 'Empty stream body' });
      callbacks.onError?.(err);
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        const lines = chunk.split('\n');
        let eventName = 'message';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          }
          if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }

        const dataRaw = dataLines.join('\n');
        const payload = parseJsonSafe<Record<string, unknown>>(dataRaw) || { raw: dataRaw };

        if (eventName === 'start') callbacks.onStart?.(payload);
        if (eventName === 'delta') {
          const text = typeof payload.text === 'string' ? payload.text : dataRaw;
          callbacks.onDelta?.(text, payload);
        }
        if (eventName === 'end') callbacks.onEnd?.(payload);
        if (eventName === 'error') {
          const err = new ApiError({
            code: typeof payload.code === 'string' ? payload.code : 'STREAM_ERROR',
            message: typeof payload.message === 'string' ? payload.message : 'Stream error',
            requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
          });
          callbacks.onError?.(err);
          throw err;
        }
      }
    }
  }
}
