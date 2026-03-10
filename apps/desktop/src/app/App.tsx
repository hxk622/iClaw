import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { IClawClient } from '@iclaw/sdk';
import { clearAuth, readAuth, writeAuth } from './lib/auth-storage';
import { getGoogleOAuthUrl, getWeChatOAuthUrl, openOAuthPopup, type OAuthProvider } from './lib/oauth';
import { detectPortConflicts, isTauriRuntime, loadGatewayAuth, startSidecar } from './lib/tauri-sidecar';
import {
  diagnoseRuntime,
  installRuntime,
  type RuntimeDiagnosis,
} from './lib/tauri-runtime-config';
import { AuthPanel } from './components/AuthPanel';
import { AccountPanel } from './components/account/AccountPanel';
import { FirstRunSetupPanel, type SetupStage } from './components/FirstRunSetupPanel';
import { OpenClawChatSurface } from './components/OpenClawChatSurface';
import { Sidebar } from './components/Sidebar';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { SettingsProvider, useSettings } from './contexts/settings-context';
import {
  applyIclawWorkspaceBackup,
  loadIclawWorkspaceFiles,
  resetIclawWorkspaceToDefaults,
  saveIclawSettingsAndApply,
} from './lib/iclaw-settings';

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

function isLikelyAccessToken(token: string): boolean {
  return token.trim().length >= 16;
}

function formatPortConflictMessage(ports: number[]): string | null {
  if (ports.length === 0) {
    return null;
  }
  const joined = ports.join('/');
  return `检测到本地开发服务正在运行，占用了 ${joined}。请先关闭 pnpm dev:api 或释放这些端口后再启动应用。`;
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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionAuthed, setSessionAuthed] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [socialLoadingProvider, setSocialLoadingProvider] = useState<OAuthProvider | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [healthChecking, setHealthChecking] = useState(true);
  const [healthy, setHealthy] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
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
  };

  const openAuthModal = (mode: 'login' | 'register' = 'login', nextView: 'account' | null = null) => {
    setAuthError(null);
    setAuthModalMode(mode);
    setPostAuthView(nextView);
    setAuthModalOpen(true);
  };

  const isAuthenticated = Boolean(accessToken || sessionAuthed);

  useEffect(() => {
    if (isTauriRuntime() && (!runtimeReady || runtimeChecking || runtimeInstalling)) {
      setHealthChecking(false);
      setHealthy(false);
      return;
    }

    let cancelled = false;

    const resolvePortConflictMessage = async (): Promise<string | null> => {
      const status = await detectPortConflicts().catch(() => null);
      return formatPortConflictMessage(status?.occupied_ports ?? []);
    };

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
        const portConflictMessage = await resolvePortConflictMessage();
        if (!cancelled) {
          setHealthy(false);
          setHealthError(
            portConflictMessage || (e instanceof Error ? e.message : 'health check failed'),
          );
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
        } catch (error) {
          const portConflictMessage = await resolvePortConflictMessage();
          if (!cancelled) {
            setHealthy(false);
            setHealthError(
              portConflictMessage ||
                (error instanceof Error ? error.message : 'failed to start openclaw runtime'),
            );
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
          gatewayAuth={gatewayAuth}
          handleLogout={handleLogout}
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
  gatewayAuth: { token?: string; password?: string };
  handleLogout: () => void;
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
  gatewayAuth,
  handleLogout,
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
      {authenticated ? (
        <OpenClawChatSurface
          gatewayUrl={GATEWAY_WS_URL}
          gatewayToken={gatewayAuth.token}
          gatewayPassword={gatewayAuth.password}
          sessionKey={CHAT_SESSION_KEY}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center bg-[var(--bg-page)] px-10">
          <div className="max-w-md rounded-[28px] border border-[var(--border-default)] bg-white/90 px-8 py-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="text-[22px] font-medium text-[var(--text-primary)]">登录后继续</div>
            <p className="mt-3 text-[14px] leading-6 text-[var(--text-secondary)]">
              对话区已切回运行时原生链路。先完成登录，再进入聊天。
            </p>
            <button
              type="button"
              onClick={() => onRequestAuth('login')}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 text-[14px] font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
            >
              去登录
            </button>
          </div>
        </div>
      )}
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
