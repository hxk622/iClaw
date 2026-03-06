import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { IClawClient } from '@iclaw/sdk';
import { clearAuth, readAuth, writeAuth } from './lib/auth-storage';
import { isTauriRuntime, loadGatewayAuth, startSidecar } from './lib/tauri-sidecar';
import { diagnoseRuntime, type RuntimeDiagnosis } from './lib/tauri-runtime-config';
import { AuthPanel } from './components/AuthPanel';
import { ChatWorkspace } from './components/ChatWorkspace';
import { FirstRunSetupPanel } from './components/FirstRunSetupPanel';
import { Sidebar } from './components/Sidebar';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { SettingsProvider, useSettings } from './contexts/settings-context';
import { saveIclawSettingsAndApply } from './lib/iclaw-settings';
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
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

function resolveSidecarPort(args: string[]): string {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== '--port') continue;
    const next = args[i + 1];
    if (next && /^\d+$/.test(next)) return next;
  }
  return '2126';
}

const SIDE_CAR_ARGS = ((import.meta.env.VITE_SIDE_CAR_ARGS as string) || '--port 2126')
  .split(' ')
  .map((s) => s.trim())
  .filter(Boolean);
const SIDECAR_PORT = resolveSidecarPort(SIDE_CAR_ARGS);
const LOCAL_API_BASE_URL = `http://127.0.0.1:${SIDECAR_PORT}`;
const CLOUD_API_BASE_URL = 'https://openalpha.aiyuanxi.com';
const IS_TAURI_RUNTIME = isTauriRuntime();
const DEFAULT_API_BASE_URL = import.meta.env.PROD ? CLOUD_API_BASE_URL : LOCAL_API_BASE_URL;
const CONFIGURED_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || DEFAULT_API_BASE_URL;
// Desktop DMG must always talk to local bundled sidecar for health/gateway.
const API_BASE_URL = IS_TAURI_RUNTIME ? LOCAL_API_BASE_URL : CONFIGURED_API_BASE_URL;
const AUTH_BASE_URL =
  (import.meta.env.VITE_AUTH_BASE_URL as string) || 'https://openalpha.aiyuanxi.com';
const DEFAULT_GATEWAY_WS_URL = API_BASE_URL.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
const GATEWAY_WS_URL =
  IS_TAURI_RUNTIME
    ? DEFAULT_GATEWAY_WS_URL
    : (import.meta.env.VITE_GATEWAY_WS_URL as string) || DEFAULT_GATEWAY_WS_URL;
const GATEWAY_TOKEN = (import.meta.env.VITE_GATEWAY_TOKEN as string) || undefined;
const GATEWAY_PASSWORD = (import.meta.env.VITE_GATEWAY_PASSWORD as string) || undefined;
const CHAT_SESSION_KEY = 'main';

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isLikelyJwt(token: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
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
  return history
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const message = item as Record<string, unknown>;
      const role = typeof message.role === 'string' ? message.role : '';
      if (role !== 'user' && role !== 'assistant') return null;
      const text = extractText(message);
      if (!text) return null;
      return {
        id: typeof message.id === 'string' ? message.id : undefined,
        role,
        content: [{ type: 'text', text }],
        timestamp: typeof message.timestamp === 'number' ? message.timestamp : now,
      };
    })
    .filter((value): value is ChatRuntimeState['messages'][number] => value !== null);
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
      }),
    [gatewayAuth.password, gatewayAuth.token],
  );
  const [chatState, setChatState] = useState<ChatRuntimeState>(() => createInitialChatState(CHAT_SESSION_KEY));
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionAuthed, setSessionAuthed] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [healthChecking, setHealthChecking] = useState(true);
  const [healthy, setHealthy] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [sidecarAttempted, setSidecarAttempted] = useState(false);
  const [runtimeChecking, setRuntimeChecking] = useState(true);
  const [runtimeReady, setRuntimeReady] = useState(!isTauriRuntime());
  const [runtimeDiagnosis, setRuntimeDiagnosis] = useState<RuntimeDiagnosis | null>(null);
  const [activeView, setActiveView] = useState<'chat' | 'settings'>('chat');

  const checkRuntime = async () => {
    if (!isTauriRuntime()) {
      setRuntimeReady(true);
      setRuntimeChecking(false);
      return;
    }
    setRuntimeChecking(true);
    const diagnosis = await diagnoseRuntime();
    setRuntimeDiagnosis(diagnosis);
    const ready =
      Boolean(diagnosis?.sidecar_binary_found) &&
      Boolean(diagnosis?.skills_dir_ready) &&
      Boolean(diagnosis?.mcp_config_ready);
    setRuntimeReady(ready);
    setRuntimeChecking(false);
  };

  useEffect(() => {
    void checkRuntime();
  }, []);

  useEffect(() => {
    void readAuth().then((auth) => {
      if (!auth) {
        void client
          .me()
          .then((user) => {
            setSessionAuthed(true);
            setCurrentUser((user as AuthUser) || null);
          })
          .catch(() => {
            setSessionAuthed(false);
            setCurrentUser(null);
          });
        return;
      }
      if (!isLikelyJwt(auth.accessToken)) {
        void clearAuth();
        setAccessToken(null);
        setSessionAuthed(false);
        setCurrentUser(null);
        return;
      }
      setAccessToken(auth.accessToken);
      void client
        .me(auth.accessToken)
        .then((user) => {
          setSessionAuthed(true);
          setCurrentUser((user as AuthUser) || null);
        })
        .catch(async () => {
          try {
            const refreshed = await client.refresh(auth.refreshToken);
            await writeAuth({
              accessToken: refreshed.access_token,
              refreshToken: refreshed.refresh_token || auth.refreshToken,
            });
            setAccessToken(refreshed.access_token);
            const user = (await client.me(refreshed.access_token)) as AuthUser;
            setSessionAuthed(true);
            setCurrentUser(user || null);
          } catch {
            await clearAuth();
            setAccessToken(null);
            setSessionAuthed(false);
            setCurrentUser(null);
          }
        });
    });
  }, [client]);

  const handleLogin = async (input: { email: string; password: string }) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await client.login(input);
      await writeAuth({
        accessToken: data.tokens.access_token,
        refreshToken: data.tokens.refresh_token,
      });
      setAccessToken(data.tokens.access_token);
      setSessionAuthed(true);
      setCurrentUser((data.user as AuthUser) || null);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (input: { name: string; email: string; password: string }) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await client.register(input);
      await writeAuth({
        accessToken: data.tokens.access_token,
        refreshToken: data.tokens.refresh_token,
      });
      setAccessToken(data.tokens.access_token);
      setSessionAuthed(true);
      setCurrentUser((data.user as AuthUser) || null);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : '注册失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    void clearAuth();
    setAccessToken(null);
    setSessionAuthed(false);
    setCurrentUser(null);
    setChatState(createInitialChatState(CHAT_SESSION_KEY));
  };

  const syncChatHistory = async () => {
    try {
      const payload = await client.chatHistory({ sessionKey: CHAT_SESSION_KEY, limit: 200 });
      const messages = mapHistoryMessages(payload);
      setChatState((prev) => ({
        ...prev,
        messages,
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

  const sendMessage = async (content: string) => {
    if (!accessToken && !sessionAuthed) return;
    const text = content.trim();
    if (!text || chatState.runId) return;

    const runId = createId('run');
    setChatState((prev) => beginChatRun(appendUserMessage(prev, text), runId));

    try {
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
            const fallback = { role: 'assistant', content: [{ type: 'text', text: delta }] };
            const event = buildChatEventPayload('delta', runId, CHAT_SESSION_KEY, payload ?? fallback);
            setChatState((prev) => handleChatEvent(prev, event));
          },
          onEnd: (payload) => {
            void payload;
            void syncChatHistory();
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
    }
  };

  useEffect(() => {
    if (!accessToken && !sessionAuthed) return;
    void syncChatHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, sessionAuthed]);

  useEffect(() => {
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
        } catch {
          setSidecarAttempted(true);
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
  }, [client]);

  const messages = useMemo(() => toUiMessages(chatState), [chatState]);
  const streaming = chatState.runId !== null;
  const error = chatState.lastError;

  if (!accessToken && !sessionAuthed) {
    if (runtimeChecking) {
      return (
        <div className="flex h-screen items-center justify-center bg-white text-[14px] text-[#666]">
          正在检查本地运行环境...
        </div>
      );
    }

    if (!runtimeReady) {
      return (
        <FirstRunSetupPanel
          diagnosis={runtimeDiagnosis}
          loading={runtimeChecking}
          onRecheck={checkRuntime}
        />
      );
    }

    return (
      <AuthPanel
        loading={authLoading}
        error={authError}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    );
  }

  return (
    <SettingsProvider>
      <AuthedView
        activeView={activeView}
        setActiveView={setActiveView}
        currentUser={currentUser}
        healthy={healthy}
        handleLogout={handleLogout}
        messages={messages}
        streaming={streaming}
        error={error}
        sendMessage={sendMessage}
      />
    </SettingsProvider>
  );
}

interface AuthedViewProps {
  activeView: 'chat' | 'settings';
  setActiveView: Dispatch<SetStateAction<'chat' | 'settings'>>;
  currentUser: AuthUser | null;
  healthy: boolean;
  handleLogout: () => void;
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>;
  streaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
}

function AuthedView({
  activeView,
  setActiveView,
  currentUser,
  healthy,
  handleLogout,
  messages,
  streaming,
  error,
  sendMessage,
}: AuthedViewProps) {
  const { settings, saveSettings } = useSettings();

  const handleSaveSettings = async () => {
    await saveIclawSettingsAndApply(settings);
    saveSettings();
  };

  if (activeView === 'settings') {
    return <SettingsPanel onClose={() => setActiveView('chat')} onSave={handleSaveSettings} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-page)]">
      <Sidebar user={currentUser} onOpenSettings={() => setActiveView('settings')} onLogout={handleLogout} />
      <ChatWorkspace
        messages={messages}
        streaming={streaming}
        error={error}
        disabled={streaming}
        onSend={sendMessage}
      />
    </div>
  );
}
