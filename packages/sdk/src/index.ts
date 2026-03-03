import { ApiError, type AuthTokens } from '@iclaw/shared';

export interface ClientOptions {
  apiBaseUrl: string;
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
  data: {
    user: unknown;
  };
}

interface StreamChatInput {
  message: string;
  taskId?: string;
  attachments?: unknown[];
  token: string;
  signal?: AbortSignal;
}

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

  constructor(options: ClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, '');
  }

  async health(): Promise<unknown> {
    const res = await fetch(`${this.apiBaseUrl}/health`);
    if (!res.ok) throw await parseError(res);
    return res.json();
  }

  async login(input: LoginInput): Promise<{ tokens: AuthTokens; user: unknown }> {
    const res = await fetch(`${this.apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: { tokens: AuthTokens; user: unknown } };
    return json.data;
  }

  async register(input: RegisterInput): Promise<{ tokens: AuthTokens; user: unknown }> {
    const res = await fetch(`${this.apiBaseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: { tokens: AuthTokens; user: unknown } };
    return json.data;
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const res = await fetch(`${this.apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: AuthTokens };
    return json.data;
  }

  async me(token: string): Promise<unknown> {
    const res = await fetch(`${this.apiBaseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as MeResponse;
    return json.data.user;
  }

  async streamChat(input: StreamChatInput, callbacks: StreamCallbacks): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.token}`,
      },
      body: JSON.stringify({
        message: input.message,
        taskId: input.taskId,
        attachments: input.attachments || [],
      }),
      signal: input.signal,
    });

    if (!res.ok) {
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
