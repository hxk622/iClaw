import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { IClawClient } from '@iclaw/sdk';
import { clearAuth, readAuth, writeAuth } from './lib/auth-storage';
import { isTauriRuntime, startSidecar } from './lib/tauri-sidecar';
import { diagnoseRuntime, type RuntimeDiagnosis } from './lib/tauri-runtime-config';
import { AuthPanel } from './components/AuthPanel';
import { ChatWorkspace } from './components/ChatWorkspace';
import { FirstRunSetupPanel } from './components/FirstRunSetupPanel';
import { Sidebar } from './components/Sidebar';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { SettingsProvider, useSettings } from './contexts/settings-context';
import { saveIclawSettingsAndApply } from './lib/iclaw-settings';
import { beginChatRun, appendUserMessage, createInitialChatState, handleChatEvent } from './chat-core/controller';
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

const DEFAULT_API_BASE_URL = import.meta.env.PROD
  ? 'https://openalpha.aiyuanxi.com'
  : 'http://127.0.0.1:2126';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || DEFAULT_API_BASE_URL;
const CHAT_SESSION_KEY = 'main';
const SIDE_CAR_ARGS = ((import.meta.env.VITE_SIDE_CAR_ARGS as string) || '--port 2126')
  .split(' ')
  .map((s) => s.trim())
  .filter(Boolean);

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

export default function App() {
  const client = useMemo(() => new IClawClient({ apiBaseUrl: API_BASE_URL }), []);
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

  const sendMessage = async (content: string) => {
    if ((!accessToken && !sessionAuthed) || !healthy) return;
    const text = content.trim();
    if (!text || chatState.runId) return;

    const runId = createId('run');
    setChatState((prev) => beginChatRun(appendUserMessage(prev, text), runId));

    try {
      await client.streamChat(
        {
          message: text,
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
            const event = buildChatEventPayload('final', runId, CHAT_SESSION_KEY, payload);
            setChatState((prev) => handleChatEvent(prev, event));
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
        disabled={streaming || !healthy}
        onSend={sendMessage}
      />
    </div>
  );
}
