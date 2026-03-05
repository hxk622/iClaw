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

export default function App() {
  const client = useMemo(() => new IClawClient({ apiBaseUrl: API_BASE_URL }), []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionAuthed, setSessionAuthed] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    setMessages([]);
    setError(null);
  };

  const sendMessage = async (content: string) => {
    if ((!accessToken && !sessionAuthed) || !healthy) return;
    const text = content.trim();
    if (!text || streaming) return;

    const userMessage: Message = { id: createId('user'), role: 'user', content: text };
    const assistantId = createId('assistant');
    setError(null);
    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: 'assistant', content: '' }]);
    setStreaming(true);

    try {
      await client.streamChat(
        {
          message: text,
          token: accessToken || undefined,
        },
        {
          onDelta: (delta) => {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === assistantId ? { ...msg, content: msg.content + delta } : msg)),
            );
          },
          onError: (e) => {
            setError(`${e.code}: ${e.message}`);
          },
        },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : '请求失败';
      setError(message);
    } finally {
      setStreaming(false);
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
        healthChecking={healthChecking}
        healthy={healthy}
        sidecarAttempted={sidecarAttempted}
        healthError={healthError}
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
  healthChecking: boolean;
  healthy: boolean;
  sidecarAttempted: boolean;
  healthError: string | null;
  handleLogout: () => void;
  messages: Message[];
  streaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
}

function AuthedView({
  activeView,
  setActiveView,
  currentUser,
  healthChecking,
  healthy,
  sidecarAttempted,
  healthError,
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
        healthChecking={healthChecking}
        healthy={healthy}
        sidecarAttempted={sidecarAttempted}
        healthError={healthError}
      />
    </div>
  );
}
