import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { IClawClient, type RunGrantData } from '@iclaw/sdk';
import { clearAuth, readAuth, writeAuth } from './lib/auth-storage';
import { getGoogleOAuthUrl, getWeChatOAuthUrl, openOAuthPopup, type OAuthProvider } from './lib/oauth';
import { isTauriRuntime, loadGatewayAuth, startSidecar } from './lib/tauri-sidecar';
import {
  diagnoseRuntime,
  installRuntime,
  loadRuntimeConfig,
  type RuntimeConfig,
  type RuntimeDiagnosis,
} from './lib/tauri-runtime-config';
import { AuthPanel } from './components/AuthPanel';
import { AccountPanel } from './components/account/AccountPanel';
import { ChatWorkspace } from './components/ChatWorkspace';
import { FirstRunSetupPanel, type SetupStage } from './components/FirstRunSetupPanel';
import { Sidebar } from './components/Sidebar';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { SettingsProvider, useSettings } from './contexts/settings-context';
import {
  applyIclawWorkspaceBackup,
  loadIclawWorkspaceFiles,
  resetIclawWorkspaceToDefaults,
  saveIclawSettingsAndApply,
} from './lib/iclaw-settings';
import { beginChatRun, appendUserMessage, createInitialChatState, handleChatEvent } from './chat-core/controller';
import { extractText } from './chat-core/message-extract';
import type { ChatEventPayload, ChatEventState, ChatRuntimeState } from './chat-core/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AuthUser {
  id?: string;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  display_name?: string | null;
}

function resolveSidecarPort(args: string[]): string {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== '--port') continue;
    const next = args[i + 1];
    if (next && /^\d+$/.test(next)) return next;
  }
  return '2126';
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

function isLoopbackUrl(url: string): boolean {
  try {
    return isLoopbackHostname(new URL(url).hostname);
  } catch {
    return false;
  }
}

const SIDE_CAR_ARGS = ((import.meta.env.VITE_SIDE_CAR_ARGS as string) || '--port 2126')
  .split(' ')
  .map((s) => s.trim())
  .filter(Boolean);
const SIDECAR_PORT = resolveSidecarPort(SIDE_CAR_ARGS);
const LOCAL_API_BASE_URL = `http://127.0.0.1:${SIDECAR_PORT}`;
const LOCAL_AUTH_BASE_URL = 'http://127.0.0.1:2130';
const IS_TAURI_RUNTIME = isTauriRuntime();
const DEFAULT_API_BASE_URL = LOCAL_API_BASE_URL;
const CONFIGURED_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || DEFAULT_API_BASE_URL;
// Desktop builds always talk to the local OpenClaw runtime for health/gateway.
const API_BASE_URL = IS_TAURI_RUNTIME ? LOCAL_API_BASE_URL : CONFIGURED_API_BASE_URL;
const AUTH_BASE_URL =
  (import.meta.env.VITE_AUTH_BASE_URL as string) || LOCAL_AUTH_BASE_URL;
const DEFAULT_GATEWAY_WS_URL = API_BASE_URL.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
const GATEWAY_WS_URL =
  IS_TAURI_RUNTIME
    ? DEFAULT_GATEWAY_WS_URL
    : (import.meta.env.VITE_GATEWAY_WS_URL as string) || DEFAULT_GATEWAY_WS_URL;
const GATEWAY_TOKEN = (import.meta.env.VITE_GATEWAY_TOKEN as string) || undefined;
const GATEWAY_PASSWORD = (import.meta.env.VITE_GATEWAY_PASSWORD as string) || undefined;
const DISABLE_GATEWAY_DEVICE_IDENTITY =
  IS_TAURI_RUNTIME ||
  (typeof window !== 'undefined' &&
    isLoopbackHostname(window.location.hostname) &&
    isLoopbackUrl(API_BASE_URL));
const CHAT_SESSION_KEY = 'main';

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isLikelyAccessToken(token: string): boolean {
  return token.trim().length >= 16;
}

function estimateTokenCount(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / 4));
}

function estimateCreditCost(inputTokens: number, outputTokens: number): number {
  const totalTokens = Math.max(0, inputTokens) + Math.max(0, outputTokens);
  if (totalTokens <= 0) return 0;
  return Math.max(1, Math.ceil(totalTokens / 10));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function pickNumber(source: Record<string, unknown> | null, keys: string[]): number | null {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.floor(value));
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.floor(parsed));
      }
    }
  }
  return null;
}

function pickString(source: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function inferProvider(runtimeConfig: RuntimeConfig | null, model?: string): string | undefined {
  if (model?.startsWith('gpt-')) return 'openai';
  if (runtimeConfig?.openai_api_key) return 'openai';
  if (runtimeConfig?.anthropic_api_key) return 'anthropic';
  return undefined;
}

function summarizeUsage(
  payload: unknown,
  inputText: string,
  outputText: string,
  runtimeConfig: RuntimeConfig | null,
): { inputTokens: number; outputTokens: number; creditCost: number; provider?: string; model?: string } {
  const root = asRecord(payload);
  const nestedUsage = asRecord(root?.usage) || asRecord(root?.metrics) || asRecord(root?.stats);
  const inputTokens =
    pickNumber(nestedUsage, ['input_tokens', 'inputTokens', 'prompt_tokens', 'promptTokens']) ??
    pickNumber(root, ['input_tokens', 'inputTokens', 'prompt_tokens', 'promptTokens']) ??
    estimateTokenCount(inputText);
  const outputTokens =
    pickNumber(nestedUsage, ['output_tokens', 'outputTokens', 'completion_tokens', 'completionTokens']) ??
    pickNumber(root, ['output_tokens', 'outputTokens', 'completion_tokens', 'completionTokens']) ??
    estimateTokenCount(outputText);
  const creditCost =
    pickNumber(nestedUsage, ['credit_cost', 'creditCost', 'cost']) ??
    pickNumber(root, ['credit_cost', 'creditCost', 'cost']) ??
    estimateCreditCost(inputTokens, outputTokens);
  const model =
    pickString(nestedUsage, ['model']) ||
    pickString(root, ['model']) ||
    runtimeConfig?.openai_model?.trim() ||
    undefined;
  const provider =
    pickString(nestedUsage, ['provider']) ||
    pickString(root, ['provider']) ||
    inferProvider(runtimeConfig, model);

  return {
    inputTokens,
    outputTokens,
    creditCost,
    provider,
    model,
  };
}

function extractAssistantText(payload: unknown): string {
  const root = asRecord(payload);
  const message = root?.message ?? payload;
  return extractText(message)?.trim() || '';
}

function coerceChatEventState(raw: unknown, fallback: ChatEventState): ChatEventState {
  return raw === 'start' || raw === 'delta' || raw === 'final' || raw === 'aborted' || raw === 'end' || raw === 'error'
    ? raw
    : fallback;
}

function buildChatEventPayload(
  fallbackState: ChatEventState,
  runId: string,
  sessionKey: string,
  payload?: unknown,
): ChatEventPayload {
  const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const state = coerceChatEventState(data.state, fallbackState);
  const message = (data.message as unknown) ?? data;
  const nextRunId = typeof data.runId === 'string' ? data.runId : runId;
  const nextSessionKey = typeof data.sessionKey === 'string' ? data.sessionKey : sessionKey;
  const errorMessage =
    typeof data.errorMessage === 'string'
      ? data.errorMessage
      : typeof data.message === 'string' && state === 'error'
        ? data.message
        : undefined;

  return {
    runId: nextRunId,
    sessionKey: nextSessionKey,
    state,
    message,
    errorMessage,
  };
}

function toUiMessages(state: ChatRuntimeState): Message[] {
  const mapped = state.messages
    .map((message, index) => {
      if (message.role !== 'user' && message.role !== 'assistant') {
        return null;
      }
      const content = message.content
        .map((item) => item.text)
        .filter((value): value is string => typeof value === 'string')
        .join('\n')
        .trim();
      return {
        id: message.id || `msg_${message.timestamp}_${index}`,
        role: message.role,
        content: content || '...',
      };
    })
    .filter((value): value is Message => value !== null);

  if (state.runId !== null) {
    mapped.push({
      id: `stream_${state.runId}`,
      role: 'assistant',
      content: (state.streamText || '').trim() || '...',
    });
  }
  return mapped;
}

function mapHistoryMessages(payload: unknown): ChatRuntimeState['messages'] {
  const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const history = Array.isArray(data.messages) ? data.messages : Array.isArray(payload) ? payload : [];
  const now = Date.now();
  const messages: ChatRuntimeState['messages'] = [];
  for (const item of history) {
    if (!item || typeof item !== 'object') continue;
    const message = item as Record<string, unknown>;
    const role = typeof message.role === 'string' ? message.role : '';
    if (role !== 'user' && role !== 'assistant') continue;
    const text = extractText(message);
    if (!text) continue;
    messages.push({
      id: typeof message.id === 'string' ? message.id : undefined,
      role,
      content: [{ type: 'text', text }],
      timestamp: typeof message.timestamp === 'number' ? message.timestamp : now,
    });
  }
  return messages;
}

export default function App() {
  const [gatewayAuth, setGatewayAuth] = useState<{ token?: string; password?: string }>({
    token: GATEWAY_TOKEN,
    password: GATEWAY_PASSWORD,
  });

  useEffect(() => {
    if (!isTauriRuntime()) return;
    if (gatewayAuth.token || gatewayAuth.password) return;
    void loadGatewayAuth().then((auth) => {
      if (!auth) return;
      const token = typeof auth.token === 'string' && auth.token.trim() ? auth.token.trim() : undefined;
      const password =
        typeof auth.password === 'string' && auth.password.trim() ? auth.password.trim() : undefined;
      if (!token && !password) return;
      setGatewayAuth({ token, password });
    });
  }, [gatewayAuth.password, gatewayAuth.token]);

  const client = useMemo(
    () =>
      new IClawClient({
        apiBaseUrl: API_BASE_URL,
        authBaseUrl: AUTH_BASE_URL,
        gatewayWsUrl: GATEWAY_WS_URL,
        gatewayToken: gatewayAuth.token,
        gatewayPassword: gatewayAuth.password,
        preferGatewayWs: true,
        disableGatewayDeviceIdentity: DISABLE_GATEWAY_DEVICE_IDENTITY,
      }),
    [gatewayAuth.password, gatewayAuth.token],
  );
  const [chatState, setChatState] = useState<ChatRuntimeState>(() => createInitialChatState(CHAT_SESSION_KEY));
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionAuthed, setSessionAuthed] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [socialLoadingProvider, setSocialLoadingProvider] = useState<OAuthProvider | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [healthChecking, setHealthChecking] = useState(true);
  const [healthy, setHealthy] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [sidecarAttempted, setSidecarAttempted] = useState(false);
  const [runtimeChecking, setRuntimeChecking] = useState(true);
  const [runtimeInstalling, setRuntimeInstalling] = useState(false);
  const [runtimeInstallError, setRuntimeInstallError] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(!isTauriRuntime());
  const [runtimeDiagnosis, setRuntimeDiagnosis] = useState<RuntimeDiagnosis | null>(null);
  const [activeView, setActiveView] = useState<'chat' | 'settings' | 'account'>('chat');
  const [installStage, setInstallStage] = useState<'download' | 'extract'>('download');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [postAuthView, setPostAuthView] = useState<'account' | null>(null);
  const [authBootstrapReady, setAuthBootstrapReady] = useState(false);
  const [guestPromptInitialized, setGuestPromptInitialized] = useState(false);

  const syncWorkspaceForUser = async (token: string): Promise<void> => {
    if (!IS_TAURI_RUNTIME) return;

    const backup = await client.getWorkspaceBackup(token);
    if (backup) {
      await applyIclawWorkspaceBackup({
        identity_md: backup.identity_md,
        user_md: backup.user_md,
        soul_md: backup.soul_md,
        agents_md: backup.agents_md,
      });
      return;
    }

    await resetIclawWorkspaceToDefaults();
  };

  useEffect(() => {
    if (!runtimeInstalling) {
      setInstallStage('download');
      return;
    }

    setInstallStage('download');
    const timer = window.setTimeout(() => {
      setInstallStage('extract');
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [runtimeInstalling]);

  const applyRuntimeDiagnosis = (diagnosis: RuntimeDiagnosis | null): boolean => {
    setRuntimeDiagnosis(diagnosis);
    const ready =
      Boolean(diagnosis?.runtime_found) &&
      Boolean(diagnosis?.skills_dir_ready) &&
      Boolean(diagnosis?.mcp_config_ready);
    setRuntimeReady(ready);
    return ready;
  };

  const checkRuntime = async () => {
    if (!isTauriRuntime()) {
      setRuntimeReady(true);
      setRuntimeChecking(false);
      return;
    }
    setRuntimeChecking(true);
    setRuntimeInstallError(null);
    try {
      const diagnosis = await diagnoseRuntime();
      applyRuntimeDiagnosis(diagnosis);
    } finally {
      setRuntimeChecking(false);
    }
  };

  const handleInstallRuntime = async () => {
    setRuntimeInstalling(true);
    setRuntimeInstallError(null);
    try {
      await installRuntime();
      await checkRuntime();
    } catch (error) {
      setRuntimeInstallError(error instanceof Error ? error.message : 'runtime install failed');
    } finally {
      setRuntimeInstalling(false);
    }
  };

  useEffect(() => {
    if (!isTauriRuntime()) {
      setRuntimeReady(true);
      setRuntimeChecking(false);
      return;
    }

    let cancelled = false;

    const ensureRuntimeInstalled = async () => {
      setRuntimeChecking(true);
      setRuntimeInstallError(null);
      try {
        const diagnosis = await diagnoseRuntime();
        const ready = applyRuntimeDiagnosis(diagnosis);
        if (ready || !diagnosis?.runtime_installable || diagnosis.runtime_found) {
          return;
        }

        setRuntimeInstalling(true);
        await installRuntime();
        if (cancelled) return;
        const nextDiagnosis = await diagnoseRuntime();
        if (cancelled) return;
        applyRuntimeDiagnosis(nextDiagnosis);
      } catch (error) {
        if (!cancelled) {
          setRuntimeInstallError(error instanceof Error ? error.message : 'runtime install failed');
        }
      } finally {
        if (!cancelled) {
          setRuntimeInstalling(false);
          setRuntimeChecking(false);
        }
      }
    };

    void ensureRuntimeInstalled();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void readAuth().then((auth) => {
      if (!auth) {
        void client
          .me()
          .then((user) => {
            setSessionAuthed(true);
            setCurrentUser((user as AuthUser) || null);
            setAuthBootstrapReady(true);
          })
          .catch(() => {
            setSessionAuthed(false);
            setCurrentUser(null);
            setAuthBootstrapReady(true);
          });
        return;
      }
      if (!isLikelyAccessToken(auth.accessToken)) {
        void clearAuth();
        setAccessToken(null);
        setSessionAuthed(false);
        setCurrentUser(null);
        setAuthBootstrapReady(true);
        return;
      }
      setAccessToken(auth.accessToken);
      void client
        .me(auth.accessToken)
        .then(async (user) => {
          try {
            await syncWorkspaceForUser(auth.accessToken);
          } catch (error) {
            console.error('[desktop] failed to sync workspace from backup, resetting to defaults', error);
            await resetIclawWorkspaceToDefaults();
          }
          setSessionAuthed(true);
          setCurrentUser((user as AuthUser) || null);
          setAuthBootstrapReady(true);
        })
        .catch(async () => {
          try {
            const refreshed = await client.refresh(auth.refreshToken);
            try {
              await syncWorkspaceForUser(refreshed.access_token);
            } catch (error) {
              console.error('[desktop] failed to sync workspace after refresh, resetting to defaults', error);
              await resetIclawWorkspaceToDefaults();
            }
            await writeAuth({
              accessToken: refreshed.access_token,
              refreshToken: refreshed.refresh_token || auth.refreshToken,
            });
            setAccessToken(refreshed.access_token);
            const user = (await client.me(refreshed.access_token)) as AuthUser;
            setSessionAuthed(true);
            setCurrentUser(user || null);
            setAuthBootstrapReady(true);
          } catch {
            await clearAuth();
            setAccessToken(null);
            setSessionAuthed(false);
            setCurrentUser(null);
            setAuthBootstrapReady(true);
          }
        });
    });
  }, [client]);

  const handleLogin = async (input: { identifier: string; password: string }) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await client.login(input);
      await syncWorkspaceForUser(data.tokens.access_token);
      await writeAuth({
        accessToken: data.tokens.access_token,
        refreshToken: data.tokens.refresh_token,
      });
      setAccessToken(data.tokens.access_token);
      setSessionAuthed(true);
      setCurrentUser((data.user as AuthUser) || null);
      setAuthModalOpen(false);
      if (postAuthView) {
        setActiveView(postAuthView);
        setPostAuthView(null);
      }
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (input: { username: string; name: string; email: string; password: string }) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await client.register(input);
      await syncWorkspaceForUser(data.tokens.access_token);
      await writeAuth({
        accessToken: data.tokens.access_token,
        refreshToken: data.tokens.refresh_token,
      });
      setAccessToken(data.tokens.access_token);
      setSessionAuthed(true);
      setCurrentUser((data.user as AuthUser) || null);
      setAuthModalOpen(false);
      if (postAuthView) {
        setActiveView(postAuthView);
        setPostAuthView(null);
      }
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : '注册失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSocialLogin = async (provider: OAuthProvider) => {
    setAuthError(null);
    setSocialLoadingProvider(provider);
    try {
      const oauthUrl = provider === 'wechat' ? getWeChatOAuthUrl() : getGoogleOAuthUrl();
      if (!oauthUrl) {
        throw new Error(provider === 'wechat' ? '微信登录未配置' : 'Google 登录未配置');
      }

      const code = await openOAuthPopup(oauthUrl, `${provider}-login`);
      const data = provider === 'wechat' ? await client.wechatLogin({ code }) : await client.googleLogin({ code });
      await syncWorkspaceForUser(data.tokens.access_token);
      await writeAuth({
        accessToken: data.tokens.access_token,
        refreshToken: data.tokens.refresh_token,
      });
      setAccessToken(data.tokens.access_token);
      setSessionAuthed(true);
      setCurrentUser((data.user as AuthUser) || null);
      setAuthModalOpen(false);
      if (postAuthView) {
        setActiveView(postAuthView);
        setPostAuthView(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '社交登录失败';
      if (message !== '授权已取消') {
        setAuthError(message);
      }
    } finally {
      setSocialLoadingProvider(null);
    }
  };

  const handleLogout = () => {
    if (IS_TAURI_RUNTIME) {
      void resetIclawWorkspaceToDefaults();
    }
    void clearAuth();
    setAccessToken(null);
    setSessionAuthed(false);
    setCurrentUser(null);
    setActiveView('chat');
    setGuestPromptInitialized(true);
    setAuthModalMode('login');
    setAuthModalOpen(true);
    setChatState(createInitialChatState(CHAT_SESSION_KEY));
  };

  const openAuthModal = (mode: 'login' | 'register' = 'login', nextView: 'account' | null = null) => {
    setAuthError(null);
    setAuthModalMode(mode);
    setPostAuthView(nextView);
    setAuthModalOpen(true);
  };

  const isAuthenticated = Boolean(accessToken || sessionAuthed);

  const syncChatHistory = async () => {
    try {
      const payload = await client.chatHistory({ sessionKey: CHAT_SESSION_KEY, limit: 200 });
      const messages = mapHistoryMessages(payload);
      setChatState((prev) => ({
        ...prev,
        messages: messages.length > 0 || prev.messages.length === 0 ? messages : prev.messages,
        runId: null,
        streamText: null,
        streamStartedAt: null,
        lastError: null,
      }));
    } catch (e) {
      setChatState((prev) => ({
        ...prev,
        runId: null,
        streamText: null,
        streamStartedAt: null,
        lastError: e instanceof Error ? e.message : 'chat history sync failed',
      }));
    }
  };

  const sendMessage = async (content: string): Promise<boolean> => {
    if (!isAuthenticated || !accessToken) {
      openAuthModal('login');
      return false;
    }
    const text = content.trim();
    if (!text || chatState.runId) return false;

    const runId = createId('run');
    setChatState((prev) => beginChatRun(appendUserMessage(prev, text), runId));

    try {
      const runtimeConfig = await loadRuntimeConfig().catch(() => null);
      const estimatedInputTokens = estimateTokenCount(text);
      const grant = accessToken
        ? ((await client.authorizeRun({
            token: accessToken,
            sessionKey: CHAT_SESSION_KEY,
            client: IS_TAURI_RUNTIME ? 'desktop-tauri' : 'desktop-web',
            estimatedInputTokens,
          })) as RunGrantData)
        : null;
      let streamedOutput = '';
      let finalPayload: unknown = null;

      await client.streamChat(
        {
          message: text,
          runId,
          token: accessToken || undefined,
        },
        {
          onStart: (payload) => {
            const event = buildChatEventPayload('start', runId, CHAT_SESSION_KEY, payload);
            setChatState((prev) => handleChatEvent(prev, event));
          },
          onDelta: (delta, payload) => {
            const nextText = extractAssistantText(payload) || delta.trim();
            if (nextText) {
              streamedOutput = nextText;
            }
            const fallback = { role: 'assistant', content: [{ type: 'text', text: delta }] };
            const event = buildChatEventPayload('delta', runId, CHAT_SESSION_KEY, payload ?? fallback);
            setChatState((prev) => handleChatEvent(prev, event));
          },
          onEnd: (payload) => {
            finalPayload = payload;
            const finalText = extractAssistantText(payload);
            if (finalText) {
              streamedOutput = finalText;
            }
          },
          onError: (e) => {
            const event = buildChatEventPayload('error', runId, CHAT_SESSION_KEY, {
              state: 'error',
              message: `${e.code}: ${e.message}`,
            });
            setChatState((prev) => handleChatEvent(prev, event));
          },
        },
      );

      if (accessToken && grant?.grant_id) {
        const usage = summarizeUsage(finalPayload, text, streamedOutput, runtimeConfig);
        try {
          await client.reportUsageEvent({
            token: accessToken,
            eventId: `desktop-run:${runId}`,
            grantId: grant.grant_id,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            creditCost: usage.creditCost,
            provider: usage.provider,
            model: usage.model,
          });
        } catch (error) {
          console.error('[desktop] failed to report usage event', error);
        }
      }

      await syncChatHistory();
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : '请求失败';
      setChatState((prev) =>
        handleChatEvent(prev, {
          runId,
          sessionKey: CHAT_SESSION_KEY,
          state: 'error',
          errorMessage: message,
        }),
      );
      return false;
    }
  };

  useEffect(() => {
    if (!accessToken && !sessionAuthed) return;
    void syncChatHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, sessionAuthed]);

  useEffect(() => {
    if (isTauriRuntime() && (!runtimeReady || runtimeChecking || runtimeInstalling)) {
      setHealthChecking(false);
      setHealthy(false);
      return;
    }

    let cancelled = false;

    const check = async (): Promise<boolean> => {
      setHealthChecking(true);
      try {
        await client.health();
        if (!cancelled) {
          setHealthy(true);
          setHealthError(null);
        }
        return true;
      } catch (e) {
        if (!cancelled) {
          setHealthy(false);
          setHealthError(e instanceof Error ? e.message : 'health check failed');
        }
        return false;
      } finally {
        if (!cancelled) setHealthChecking(false);
      }
    };

    const boot = async () => {
      const healthyNow = await check();
      if (!cancelled && !healthyNow && isTauriRuntime()) {
        try {
          await startSidecar(SIDE_CAR_ARGS);
          setSidecarAttempted(true);
        } catch (error) {
          setSidecarAttempted(true);
          if (!cancelled) {
            setHealthy(false);
            setHealthError(error instanceof Error ? error.message : 'failed to start openclaw runtime');
          }
          return;
        }
        await check();
      }
    };

    void boot();
    const timer = window.setInterval(() => {
      void check();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client, runtimeChecking, runtimeInstalling, runtimeReady]);

  const messages = useMemo(() => toUiMessages(chatState), [chatState]);
  const streaming = chatState.runId !== null;
  const error = chatState.lastError;
  const startupView = (() => {
    if (runtimeInstallError) {
      return {
        stage: 'failed' as SetupStage,
        title: '组件准备失败',
        description: '初始化已中断。错误信息会直接展示，不做静默回退。',
      };
    }

    if (healthError) {
      return {
        stage: 'failed' as SetupStage,
        title: '本地服务启动失败',
        description: '本地组件已准备完成，但服务没有成功就绪。请直接根据错误信息排查。',
      };
    }

    if (runtimeInstalling) {
      if (installStage === 'download') {
        return {
          stage: 'download' as SetupStage,
          title: '正在下载核心组件',
          description: '首次启动需要补齐本地组件。这里只显示阶段进度，不展示伪精确百分比。',
        };
      }

      return {
        stage: 'extract' as SetupStage,
        title: '正在校验并部署',
        description: '组件已获取完成，正在做完整性校验并写入本地运行目录。',
      };
    }

    if (runtimeChecking || !runtimeReady) {
      return {
        stage: 'inspect' as SetupStage,
        title: '正在检查本地运行环境',
        description: '先确认核心组件、资源目录和配置文件状态，再决定是否继续部署。',
      };
    }

    return {
      stage: 'launch' as SetupStage,
      title: '正在启动本地服务',
      description: '本地组件已经准备完成，正在拉起服务并执行健康检查。',
    };
  })();
  const shouldShowSetupPanel =
    !isAuthenticated &&
    IS_TAURI_RUNTIME &&
    (runtimeChecking || runtimeInstalling || !runtimeReady || healthChecking || !healthy || Boolean(healthError));

  useEffect(() => {
    if (!authBootstrapReady || shouldShowSetupPanel || guestPromptInitialized) {
      return;
    }
    setGuestPromptInitialized(true);
    if (!isAuthenticated) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
    }
  }, [authBootstrapReady, guestPromptInitialized, isAuthenticated, shouldShowSetupPanel]);

  if (shouldShowSetupPanel) {
    return (
      <FirstRunSetupPanel
        diagnosis={runtimeDiagnosis}
        stage={startupView.stage}
        stageTitle={startupView.title}
        stageDescription={startupView.description}
        loading={runtimeChecking}
        installing={runtimeInstalling}
        installError={runtimeInstallError}
        launchError={healthError}
        onRecheck={checkRuntime}
        onInstall={handleInstallRuntime}
      />
    );
  }

  return (
    <SettingsProvider>
      <div className="relative h-screen overflow-hidden">
        <AuthedView
          activeView={activeView}
          setActiveView={setActiveView}
          client={client}
          accessToken={accessToken}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          healthy={healthy}
          handleLogout={handleLogout}
          messages={messages}
          streaming={streaming}
          error={error}
          sendMessage={sendMessage}
          authenticated={isAuthenticated}
          onRequestAuth={openAuthModal}
        />
        <AuthPanel
          open={authModalOpen}
          initialMode={authModalMode}
          loading={authLoading}
          error={authError}
          socialLoadingProvider={socialLoadingProvider}
          onClose={() => {
            setAuthModalOpen(false);
            setPostAuthView(null);
          }}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onSocialLogin={handleSocialLogin}
        />
      </div>
    </SettingsProvider>
  );
}

interface AuthedViewProps {
  activeView: 'chat' | 'settings' | 'account';
  setActiveView: Dispatch<SetStateAction<'chat' | 'settings' | 'account'>>;
  client: IClawClient;
  accessToken: string | null;
  currentUser: AuthUser | null;
  setCurrentUser: Dispatch<SetStateAction<AuthUser | null>>;
  healthy: boolean;
  handleLogout: () => void;
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>;
  streaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<boolean>;
  authenticated: boolean;
  onRequestAuth: (mode?: 'login' | 'register', nextView?: 'account' | null) => void;
}

function AuthedView({
  activeView,
  setActiveView,
  client,
  accessToken,
  currentUser,
  setCurrentUser,
  healthy,
  handleLogout,
  messages,
  streaming,
  error,
  sendMessage,
  authenticated,
  onRequestAuth,
}: AuthedViewProps) {
  const { settings, saveSettings } = useSettings();

  const handleSaveSettings = async () => {
    await saveIclawSettingsAndApply(settings);
    saveSettings();
    if (accessToken) {
      const workspaceFiles = await loadIclawWorkspaceFiles();
      if (workspaceFiles) {
        try {
          await client.saveWorkspaceBackup({
            token: accessToken,
            identityMd: workspaceFiles.identity_md,
            userMd: workspaceFiles.user_md,
            soulMd: workspaceFiles.soul_md,
            agentsMd: workspaceFiles.agents_md,
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : '未知错误';
          throw new Error(`本地设置已保存，但云端备份失败：${detail}`);
        }
      }
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-page)]">
      <Sidebar
        user={currentUser}
        authenticated={authenticated}
        onOpenAccount={() => {
          if (!authenticated) {
            onRequestAuth('login', 'account');
            return;
          }
          setActiveView('account');
        }}
        onOpenLogin={() => onRequestAuth('login')}
        onOpenSettings={() => setActiveView('settings')}
        onLogout={handleLogout}
      />
      <ChatWorkspace
        messages={messages}
        streaming={streaming}
        error={error}
        disabled={streaming}
        onSend={sendMessage}
      />
      {activeView === 'account' && accessToken ? (
        <AccountPanel
          client={client}
          token={accessToken}
          user={currentUser}
          onClose={() => setActiveView('chat')}
          onUserUpdated={(user) => setCurrentUser(user)}
        />
      ) : null}
      {activeView === 'settings' ? (
        <SettingsPanel onClose={() => setActiveView('chat')} onSave={handleSaveSettings} />
      ) : null}
    </div>
  );
}
