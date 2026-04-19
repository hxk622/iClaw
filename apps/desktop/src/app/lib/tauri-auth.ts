import { invoke } from '@tauri-apps/api/core';
import { ApiError, type AuthTokens } from '@iclaw/shared';
import { isTauriRuntime } from './desktop-runtime';

function normalizeInvokeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string' && error.trim()) {
    try {
      const parsed = JSON.parse(error) as {
        code?: unknown;
        message?: unknown;
        request_id?: unknown;
      };
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return new ApiError({
          code: typeof parsed.code === 'string' && parsed.code.trim() ? parsed.code.trim() : 'DESKTOP_AUTH_ERROR',
          message: parsed.message.trim(),
          requestId:
            typeof parsed.request_id === 'string' && parsed.request_id.trim() ? parsed.request_id.trim() : undefined,
        });
      }
    } catch {}
    return new ApiError({
      code: 'DESKTOP_AUTH_ERROR',
      message: error.trim(),
    });
  }
  if (error && typeof error === 'object') {
    const payload = error as { message?: unknown };
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return new ApiError({
        code: 'DESKTOP_AUTH_ERROR',
        message: payload.message.trim(),
      });
    }
  }
  return new ApiError({
    code: 'DESKTOP_AUTH_ERROR',
    message: '桌面认证失败',
  });
}

export async function desktopLogin(input: {
  identifier: string;
  password: string;
}): Promise<{ tokens: AuthTokens; user: unknown }> {
  if (!isTauriRuntime()) {
    throw new Error('desktop auth is unavailable');
  }
  try {
    return await invoke<{ tokens: AuthTokens; user: unknown }>('desktop_login', { input });
  } catch (error) {
    throw normalizeInvokeError(error);
  }
}

export async function desktopMe(accessToken?: string | null): Promise<unknown> {
  if (!isTauriRuntime()) {
    throw new Error('desktop auth is unavailable');
  }
  try {
    const data = await invoke<
      | { user?: unknown; profile?: unknown }
      | null
      | undefined
      | unknown
    >('desktop_me', {
      accessToken: accessToken?.trim() || null,
    });
    if (data && typeof data === 'object') {
      const record = data as { user?: unknown; profile?: unknown };
      return record.user ?? record.profile ?? data;
    }
    return data ?? null;
  } catch (error) {
    throw normalizeInvokeError(error);
  }
}

export async function desktopRefresh(refreshToken: string): Promise<AuthTokens> {
  if (!isTauriRuntime()) {
    throw new Error('desktop auth is unavailable');
  }
  try {
    return await invoke<AuthTokens>('desktop_refresh', {
      input: {
        refresh_token: refreshToken,
      },
    });
  } catch (error) {
    throw normalizeInvokeError(error);
  }
}
