export type ChatRole = 'user' | 'assistant' | 'system';

export const DEFAULT_SESSION_ID = 'main';
export const CANONICAL_SESSION_KEY_PREFIX = 'agent:main:';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  requestId?: string;
}

export class ApiError extends Error {
  code: string;
  requestId?: string;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.code = payload.code;
    this.requestId = payload.requestId;
  }
}

function normalizeSessionText(value?: string | null): string {
  return value?.trim() ?? '';
}

export function isCanonicalSessionKey(value?: string | null): boolean {
  return normalizeSessionText(value).startsWith(CANONICAL_SESSION_KEY_PREFIX);
}

export function getSessionIdFromKey(value?: string | null): string {
  const normalized = normalizeSessionText(value);
  if (!normalized) {
    return DEFAULT_SESSION_ID;
  }
  if (isCanonicalSessionKey(normalized)) {
    const sessionId = normalized.slice(CANONICAL_SESSION_KEY_PREFIX.length).trim();
    return sessionId || DEFAULT_SESSION_ID;
  }
  if (normalized.includes(':')) {
    throw new Error(`Unsupported non-canonical session key: ${normalized}`);
  }
  return normalized;
}

export function toCanonicalSessionKey(value?: string | null): string {
  return `${CANONICAL_SESSION_KEY_PREFIX}${getSessionIdFromKey(value)}`;
}

export function parseSessionIdentity(value?: string | null): {
  sessionId: string;
  sessionKey: string;
} {
  const sessionId = getSessionIdFromKey(value);
  return {
    sessionId,
    sessionKey: toCanonicalSessionKey(sessionId),
  };
}
