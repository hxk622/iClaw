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
  identifier: string;
  password: string;
}

interface RegisterInput {
  username: string;
  email: string;
  password: string;
  name: string;
}

interface OAuthLoginInput {
  code: string;
}

interface MeResponse {
  data: unknown;
}

interface UpdateProfileInput {
  token: string;
  name?: string;
  avatarDataBase64?: string;
  avatarContentType?: string;
  avatarFilename?: string;
  removeAvatar?: boolean;
}

interface ChangePasswordInput {
  token: string;
  currentPassword?: string;
  newPassword: string;
}

interface StreamChatInput {
  message: string;
  runId?: string;
  taskId?: string;
  attachments?: unknown[];
  token?: string;
  signal?: AbortSignal;
}

interface ChatHistoryInput {
  sessionKey?: string;
  limit?: number;
}

interface AuthorizeRunInput {
  token: string;
  sessionKey?: string;
  client?: string;
  estimatedInputTokens?: number;
}

interface UsageEventInput {
  token: string;
  eventId: string;
  grantId?: string;
  inputTokens?: number;
  outputTokens?: number;
  creditCost?: number;
  provider?: string;
  model?: string;
}

interface WorkspaceBackupInput {
  token: string;
  identityMd: string;
  userMd: string;
  soulMd: string;
  agentsMd: string;
}

export interface WorkspaceBackupData {
  identity_md: string;
  user_md: string;
  soul_md: string;
  agents_md: string;
  created_at: string;
  updated_at: string;
}

export interface RunGrantData {
  grant_id: string;
  nonce: string;
  expires_at: string;
  max_input_tokens: number;
  max_output_tokens: number;
  credit_limit: number;
  signature: string;
}

export interface UsageEventData {
  accepted: boolean;
  balance_after: number;
}

type BrowserDeviceIdentity = {
  deviceId: string;
  publicKey: string;
  privateKey: string;
};

type StoredDeviceAuthTokens = {
  version: 1;
  deviceId: string;
  tokens: Record<string, { token: string; scopes: string[] }>;
};

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

const DEVICE_IDENTITY_STORAGE_KEY = 'iclaw.gateway.device.identity.v1';
const DEVICE_TOKEN_STORAGE_KEY = 'iclaw.gateway.device.tokens.v1';
const GATEWAY_CLIENT_ID = 'gateway-client';
const GATEWAY_CLIENT_MODE = 'backend';
const GATEWAY_ROLE = 'operator';
const GATEWAY_SCOPES = ['operator.read', 'operator.write', 'operator.admin'];

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4 || 4)) % 4;
  const binary = atob(normalized + '='.repeat(padding));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeDeviceMetadataForAuth(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function buildDeviceAuthPayloadV3(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
  platform?: string | null;
  deviceFamily?: string | null;
}): string {
  return [
    'v3',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(','),
    String(params.signedAtMs),
    params.token ?? '',
    params.nonce,
    normalizeDeviceMetadataForAuth(params.platform),
    normalizeDeviceMetadataForAuth(params.deviceFamily),
  ].join('|');
}

async function createBrowserDeviceIdentity(): Promise<BrowserDeviceIdentity> {
  const keyPair = (await crypto.subtle.generateKey(
    { name: 'Ed25519' } as AlgorithmIdentifier,
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
  const privateKeyBytes = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));
  return {
    deviceId: await sha256Hex(publicKeyBytes),
    publicKey: toBase64Url(publicKeyBytes),
    privateKey: toBase64Url(privateKeyBytes),
  };
}

async function loadOrCreateBrowserDeviceIdentity(): Promise<BrowserDeviceIdentity | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const storage = getBrowserStorage();
  if (storage) {
    try {
      const raw = storage.getItem(DEVICE_IDENTITY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as
          | {
              version?: number;
              deviceId?: string;
              publicKey?: string;
              privateKey?: string;
            }
          | null;
        if (
          parsed?.version === 1 &&
          typeof parsed.deviceId === 'string' &&
          typeof parsed.publicKey === 'string' &&
          typeof parsed.privateKey === 'string'
        ) {
          const derivedDeviceId = await sha256Hex(fromBase64Url(parsed.publicKey));
          const identity = {
            deviceId: derivedDeviceId,
            publicKey: parsed.publicKey,
            privateKey: parsed.privateKey,
          };
          if (derivedDeviceId !== parsed.deviceId) {
            storage.setItem(DEVICE_IDENTITY_STORAGE_KEY, JSON.stringify({ version: 1, ...identity }));
          }
          return identity;
        }
      }
    } catch {}
  }

  const identity = await createBrowserDeviceIdentity();
  storage?.setItem(DEVICE_IDENTITY_STORAGE_KEY, JSON.stringify({ version: 1, ...identity }));
  return identity;
}

async function signBrowserDevicePayload(privateKeyBase64Url: string, payload: string): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    toArrayBuffer(fromBase64Url(privateKeyBase64Url)),
    { name: 'Ed25519' } as AlgorithmIdentifier,
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' } as AlgorithmIdentifier,
    privateKey,
    new TextEncoder().encode(payload),
  );
  return toBase64Url(new Uint8Array(signature));
}

function loadStoredDeviceToken(deviceId: string, role: string): string | undefined {
  const storage = getBrowserStorage();
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(DEVICE_TOKEN_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as StoredDeviceAuthTokens | null;
    if (parsed?.version !== 1 || parsed.deviceId !== deviceId || !parsed.tokens) return undefined;
    const token = parsed.tokens[role]?.token;
    return typeof token === 'string' && token.trim() ? token.trim() : undefined;
  } catch {
    return undefined;
  }
}

function storeDeviceToken(deviceId: string, role: string, token: string, scopes: string[]): void {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(DEVICE_TOKEN_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredDeviceAuthTokens | null) : null;
    const next: StoredDeviceAuthTokens = {
      version: 1,
      deviceId,
      tokens: parsed?.version === 1 && parsed.deviceId === deviceId ? { ...parsed.tokens } : {},
    };
    next.tokens[role] = { token, scopes };
    storage.setItem(DEVICE_TOKEN_STORAGE_KEY, JSON.stringify(next));
  } catch {}
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

async function fetchWithNetworkError(input: string, init: RequestInit, authBaseUrl: string): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof Error) {
      throw new ApiError({
        code: 'NETWORK_ERROR',
        message: `无法连接登录服务，请确认 control-plane 已启动并监听 ${authBaseUrl}`,
      });
    }
    throw error;
  }
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
    const res = await fetchWithNetworkError(`${this.authBaseUrl}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: input.identifier,
        email: input.identifier,
        password: input.password,
      }),
    }, this.authBaseUrl);
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: { tokens: AuthTokens; user: unknown } };
    return json.data;
  }

  async register(input: RegisterInput): Promise<{ tokens: AuthTokens; user: unknown }> {
    const res = await fetchWithNetworkError(`${this.authBaseUrl}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: input.username,
        email: input.email,
        password: input.password,
        name: input.name,
      }),
    }, this.authBaseUrl);
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: { tokens: AuthTokens; user: unknown } };
    return json.data;
  }

  async wechatLogin(input: OAuthLoginInput): Promise<{ tokens: AuthTokens; user: unknown }> {
    const res = await fetchWithNetworkError(`${this.authBaseUrl}/auth/wechat`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: input.code,
      }),
    }, this.authBaseUrl);
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as { data: { tokens: AuthTokens; user: unknown } };
    return json.data;
  }

  async googleLogin(input: OAuthLoginInput): Promise<{ tokens: AuthTokens; user: unknown }> {
    const res = await fetchWithNetworkError(`${this.authBaseUrl}/auth/google`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: input.code,
      }),
    }, this.authBaseUrl);
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

  async updateProfile(input: UpdateProfileInput): Promise<unknown> {
    const res = await fetch(`${this.authBaseUrl}/auth/profile`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.name,
        avatar_data_base64: input.avatarDataBase64,
        avatar_content_type: input.avatarContentType,
        avatar_filename: input.avatarFilename,
        remove_avatar: input.removeAvatar,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as MeResponse;
    return json.data;
  }

  async changePassword(input: ChangePasswordInput): Promise<{message?: string}> {
    const res = await fetch(`${this.authBaseUrl}/auth/change-password`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_password: input.currentPassword,
        new_password: input.newPassword,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {message?: string}};
    return json.data;
  }

  async linkedAccounts(token: string): Promise<unknown> {
    const res = await fetch(`${this.authBaseUrl}/auth/linked-accounts`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: unknown};
    return json.data;
  }

  async unlinkOAuthAccount(token: string, provider: 'wechat' | 'google'): Promise<{message?: string}> {
    const res = await fetch(`${this.authBaseUrl}/auth/link/${provider}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: {message?: string}};
    return json.data;
  }

  async creditsMe(token: string): Promise<unknown> {
    const res = await fetch(`${this.authBaseUrl}/credits/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: unknown};
    return json.data;
  }

  async creditsLedger(token: string): Promise<unknown> {
    const res = await fetch(`${this.authBaseUrl}/credits/ledger`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: unknown};
    return json.data;
  }

  async chatHistory(_input?: ChatHistoryInput): Promise<{messages: unknown[]}> {
    // OpenClaw history endpoint is not implemented in this repo yet.
    // Return an empty payload so desktop auth/chat UI does not crash on load.
    return {messages: []};
  }

  async authorizeRun(input: AuthorizeRunInput): Promise<RunGrantData> {
    const res = await fetch(`${this.authBaseUrl}/agent/run/authorize`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_key: input.sessionKey || 'main',
        client: input.client || 'desktop',
        estimated_input_tokens: input.estimatedInputTokens || 0,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: RunGrantData};
    return json.data;
  }

  async reportUsageEvent(input: UsageEventInput): Promise<UsageEventData> {
    const res = await fetch(`${this.authBaseUrl}/usage/events`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_id: input.eventId,
        grant_id: input.grantId,
        input_tokens: input.inputTokens || 0,
        output_tokens: input.outputTokens || 0,
        credit_cost: input.creditCost || 0,
        provider: input.provider,
        model: input.model,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: UsageEventData};
    return json.data;
  }

  async getWorkspaceBackup(token: string): Promise<WorkspaceBackupData | null> {
    const res = await fetch(`${this.authBaseUrl}/workspace/backup`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: WorkspaceBackupData | null};
    return json.data;
  }

  async saveWorkspaceBackup(input: WorkspaceBackupInput): Promise<WorkspaceBackupData> {
    const res = await fetch(`${this.authBaseUrl}/workspace/backup`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identity_md: input.identityMd,
        user_md: input.userMd,
        soul_md: input.soulMd,
        agents_md: input.agentsMd,
      }),
    });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as {data: WorkspaceBackupData};
    return json.data;
  }

  private generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  private async buildGatewayConnectParams(nonce?: string): Promise<Record<string, unknown>> {
    const identity = await loadOrCreateBrowserDeviceIdentity();
    const explicitGatewayToken = this.gatewayToken?.trim() || undefined;
    const explicitGatewayPassword = this.gatewayPassword?.trim() || undefined;
    const storedDeviceToken =
      identity && !explicitGatewayToken && !explicitGatewayPassword
        ? loadStoredDeviceToken(identity.deviceId, GATEWAY_ROLE)
        : undefined;
    const authToken = explicitGatewayToken ?? storedDeviceToken;
    const auth =
      authToken || explicitGatewayPassword || storedDeviceToken
        ? {
            token: authToken,
            ...(storedDeviceToken ? { deviceToken: storedDeviceToken } : {}),
            ...(explicitGatewayPassword ? { password: explicitGatewayPassword } : {}),
          }
        : undefined;

    let device: Record<string, unknown> | undefined;
    if (identity && nonce) {
      const signedAtMs = Date.now();
      const payload = buildDeviceAuthPayloadV3({
        deviceId: identity.deviceId,
        clientId: GATEWAY_CLIENT_ID,
        clientMode: GATEWAY_CLIENT_MODE,
        role: GATEWAY_ROLE,
        scopes: GATEWAY_SCOPES,
        signedAtMs,
        token: authToken ?? null,
        nonce,
        platform: 'web',
      });
      const signature = await signBrowserDevicePayload(identity.privateKey, payload);
      device = {
        id: identity.deviceId,
        publicKey: identity.publicKey,
        signature,
        signedAt: signedAtMs,
        nonce,
      };
    }

    return {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: GATEWAY_CLIENT_ID,
        version: '1.0.0',
        platform: 'web',
        mode: GATEWAY_CLIENT_MODE,
      },
      caps: [],
      auth,
      role: GATEWAY_ROLE,
      scopes: GATEWAY_SCOPES,
      ...(device ? { device } : {}),
    };
  }

  private persistGatewayDeviceToken(payload: unknown): void {
    const auth = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).auth : null;
    if (!auth || typeof auth !== 'object') return;
    const authRecord = auth as Record<string, unknown>;
    const deviceToken = typeof authRecord.deviceToken === 'string' ? authRecord.deviceToken.trim() : '';
    if (!deviceToken) return;
    void loadOrCreateBrowserDeviceIdentity().then((identity) => {
      if (!identity) return;
      const role = typeof authRecord.role === 'string' ? authRecord.role : GATEWAY_ROLE;
      const scopes = Array.isArray(authRecord.scopes)
        ? (authRecord.scopes as unknown[]).filter((value): value is string => typeof value === 'string')
        : GATEWAY_SCOPES;
      storeDeviceToken(identity.deviceId, role, deviceToken, scopes);
    });
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
      let wsErrored = false;
      const idempotencyKey = input.runId || this.generateId('run');

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
          void this.buildGatewayConnectParams(nonce)
            .then((params) => sendRequest('connect', params))
            .then((payload) => {
              this.persistGatewayDeviceToken(payload);
              return sendRequest(
                'chat.send',
                {
                  sessionKey: this.gatewaySessionKey,
                  message: input.message,
                  deliver: false,
                  idempotencyKey,
                },
                true,
              );
            })
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
        wsErrored = true;
      };

      ws.onclose = (event) => {
        if (!closed) {
          const reason = event.reason?.trim();
          const code = typeof event.code === 'number' ? event.code : 0;
          const message = reason
            ? `Gateway websocket closed (${code}): ${reason}`
            : wsErrored
              ? `Gateway websocket closed (${code})`
              : 'Gateway websocket closed';
          const err = new ApiError({ code: 'GATEWAY_WS_CLOSED', message });
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
