import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { IClawClient, type CreditBalanceData, type DesktopUpdateHint } from '@iclaw/sdk';
import desktopPackageJson from '../../package.json';
import { clearAuth, readAuth, writeAuth } from './lib/auth-storage';
import { getGoogleOAuthUrl, getWeChatOAuthUrl, openOAuthPopup, type OAuthProvider } from './lib/oauth';
import { detectPortConflicts, isTauriRuntime, loadGatewayAuth, startSidecar } from './lib/tauri-sidecar';
import {
  diagnoseRuntime,
  installRuntime,
  listenRuntimeInstallProgress,
  type RuntimeDiagnosis,
  type RuntimeInstallProgress,
} from './lib/tauri-runtime-config';
import { AuthPanel } from './components/AuthPanel';
import { AccountPanel } from './components/account/AccountPanel';
import { FirstRunSetupPanel } from './components/FirstRunSetupPanel';
import { IClawHeader } from './components/IClawHeader';
import { OpenClawChatSurface } from './components/OpenClawChatSurface';
import { OpenClawCronSurface } from './components/OpenClawCronSurface';
import { Sidebar } from './components/Sidebar';
import { Button } from './components/ui/Button';
import { EmptyStatePanel } from './components/ui/EmptyStatePanel';
import { PageContent, PageSurface } from './components/ui/PageLayout';
import { DataConnectionsView } from './components/data-connections/DataConnectionsView';
import { LobsterStoreView } from './components/lobster-store/LobsterStoreView';
import { MemoryView } from './components/memory/MemoryView';
import { TaskCenterView } from './components/TaskCenterView';
import { SkillStoreView } from './components/skill-store/SkillStoreView';
import { IMBotsView } from './components/im-bots/IMBotsView';
import { SecurityCenterView } from './components/security-center/SecurityCenterView';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { type PersistableSettingsSection, SettingsProvider, useSettings } from './contexts/settings-context';
import { BRAND } from './lib/brand';
import { buildLobsterConversationPrompt, type LobsterAgent } from './lib/lobster-store';
import {
  applyIclawWorkspaceBackup,
  loadIclawWorkspaceFiles,
  resetIclawWorkspaceToDefaults,
  saveIclawWorkspaceSection,
} from './lib/iclaw-settings';
import {
  readSkippedDesktopUpdateVersion,
  resolveDesktopUpdateArtifactUrl,
  shouldShowDesktopUpdateHint,
  writeSkippedDesktopUpdateVersion,
} from './lib/desktop-updates';
import { syncManagedSkills } from './lib/skill-store';
import {
  checkDesktopUpdate,
  downloadAndInstallDesktopUpdate,
  listenDesktopUpdateProgress,
  restartDesktopApp,
} from './lib/tauri-desktop-updater';

interface AuthUser {
  id?: string;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  display_name?: string | null;
  role?: 'user' | 'admin' | 'super_admin' | null;
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
  (import.meta.env.VITE_AUTH_BASE_URL as string) || BRAND.endpoints.authBaseUrl || LOCAL_AUTH_BASE_URL;
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
const IM_BOT_TEST_SESSION_KEY = 'im-bots-test';
const AUTH_BOOTSTRAP_TIMEOUT_MS = 10_000;
const DESKTOP_APP_VERSION = desktopPackageJson.version;
const DESKTOP_RELEASE_CHANNEL: 'dev' | 'prod' = import.meta.env.DEV ? 'dev' : 'prod';
const DISPLAY_DESKTOP_APP_VERSION = DESKTOP_APP_VERSION.split('+', 1)[0] || DESKTOP_APP_VERSION;
const DEFAULT_CHAT_ROUTE = {
  sessionKey: CHAT_SESSION_KEY,
  initialPrompt: null as string | null,
  initialPromptKey: null as string | null,
};
let activeChatRoute = { ...DEFAULT_CHAT_ROUTE };
type PrimaryView =
  | 'chat'
  | 'lobster-store'
  | 'skill-store'
  | 'cron'
  | 'im-bots'
  | 'data-connections'
  | 'task-center'
  | 'memory'
  | 'security';

type InstallerViewState = 'loading' | 'error';

type InstallerViewModel = {
  state: InstallerViewState;
  title: string;
  subtitle: string;
  progress: number;
  stepLabel: string;
  stepDetail: string;
  errorMessage: string | null;
};

function RuntimeAuthRequiredView({
  eyebrow,
  title,
  description,
  authenticated,
  hasGatewayAuth,
  onLogin,
}: {
  eyebrow: string;
  title: string;
  description: string;
  authenticated: boolean;
  hasGatewayAuth: boolean;
  onLogin: () => void;
}) {
  return (
    <PageSurface as="div">
      <PageContent className="flex min-h-full items-center">
        <div className="mx-auto w-full max-w-[760px]">
          <EmptyStatePanel
            title={title}
            description={
              <>
                {description}
                <br />
                control-plane 登录：{authenticated ? '已登录' : '未登录'} · gateway 凭据：
                {hasGatewayAuth ? '已配置' : '缺失'}
              </>
            }
            action={
              <Button variant="primary" size="sm" onClick={onLogin}>
                打开登录
              </Button>
            }
            compact={false}
            className="rounded-[32px]"
          />
          <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {eyebrow}
          </div>
        </div>
      </PageContent>
    </PageSurface>
  );
}

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

function normalizeBrandRuntimeText(value: string): string {
  return value.replaceAll('iClaw', BRAND.displayName);
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
        desktopAppVersion: DESKTOP_APP_VERSION,
        desktopReleaseChannel: DESKTOP_RELEASE_CHANNEL,
        onDesktopUpdateHint: (hint) => {
          if (!hint.updateAvailable) {
            setDesktopUpdateHint(null);
            setDesktopUpdateActionState((current) => (current === 'ready-to-restart' ? current : 'idle'));
            setDesktopUpdateError(null);
            setDesktopUpdateProgress(null);
            setDesktopUpdateDetail(null);
            return;
          }

          setDesktopUpdateHint((current) => {
            if (
              current?.latestVersion === hint.latestVersion &&
              current.mandatory === hint.mandatory &&
              current.manifestUrl === hint.manifestUrl &&
              current.artifactUrl === hint.artifactUrl
            ) {
              return current;
            }
            return hint;
          });
        },
      }),
    [gatewayAuth.password, gatewayAuth.token],
  );
  const imBotClient = useMemo(
    () =>
      new IClawClient({
        apiBaseUrl: API_BASE_URL,
        authBaseUrl: AUTH_BASE_URL,
        gatewayWsUrl: GATEWAY_WS_URL,
        gatewayToken: gatewayAuth.token,
        gatewayPassword: gatewayAuth.password,
        gatewaySessionKey: IM_BOT_TEST_SESSION_KEY,
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
  const [initialHealthResolved, setInitialHealthResolved] = useState(false);
  const [runtimeChecking, setRuntimeChecking] = useState(true);
  const [runtimeInstalling, setRuntimeInstalling] = useState(false);
  const [runtimeInstallError, setRuntimeInstallError] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(!isTauriRuntime());
  const [runtimeDiagnosis, setRuntimeDiagnosis] = useState<RuntimeDiagnosis | null>(null);
  const [runtimeInstallProgress, setRuntimeInstallProgress] = useState<RuntimeInstallProgress | null>(null);
  const [primaryView, setPrimaryView] = useState<PrimaryView>('chat');
  const [overlayView, setOverlayView] = useState<'settings' | 'account' | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [postAuthView, setPostAuthView] = useState<'account' | null>(null);
  const [authBootstrapReady, setAuthBootstrapReady] = useState(false);
  const [guestPromptInitialized, setGuestPromptInitialized] = useState(false);
  const [desktopUpdateHint, setDesktopUpdateHint] = useState<DesktopUpdateHint | null>(null);
  const [skippedDesktopUpdateVersion, setSkippedDesktopUpdateVersion] = useState<string | null>(() =>
    readSkippedDesktopUpdateVersion(),
  );
  const [desktopUpdateActionState, setDesktopUpdateActionState] = useState<
    'idle' | 'checking' | 'downloading' | 'opened' | 'ready-to-restart'
  >('idle');
  const [desktopUpdateError, setDesktopUpdateError] = useState<string | null>(null);
  const [desktopUpdateProgress, setDesktopUpdateProgress] = useState<number | null>(null);
  const [desktopUpdateDetail, setDesktopUpdateDetail] = useState<string | null>(null);
  const [desktopUpdateStatusMessage, setDesktopUpdateStatusMessage] = useState<string | null>(null);

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

  const retrySetup = async () => {
    if (!runtimeReady) {
      await handleInstallRuntime();
      return;
    }

    setHealthError(null);
    setInitialHealthResolved(false);
    setHealthChecking(true);
    try {
      await startSidecar(SIDE_CAR_ARGS);
      await client.health();
      setHealthy(true);
      setHealthError(null);
    } catch (error) {
      const status = await detectPortConflicts().catch(() => null);
      setHealthy(false);
      setHealthError(
        formatPortConflictMessage(status?.occupied_ports ?? []) ||
          (error instanceof Error ? error.message : 'failed to start openclaw runtime'),
      );
    } finally {
      setHealthChecking(false);
      setInitialHealthResolved(true);
    }
  };

  useEffect(() => {
    if (!IS_TAURI_RUNTIME) return;

    let detach = () => {};
    void listenRuntimeInstallProgress((payload) => {
      setRuntimeInstallProgress(payload);
    }).then((unlisten) => {
      detach = unlisten;
    });

    return () => {
      detach();
    };
  }, []);

  useEffect(() => {
    if (!IS_TAURI_RUNTIME) return;

    let detach = () => {};
    void listenDesktopUpdateProgress((payload) => {
      setDesktopUpdateProgress(payload.progress);
      setDesktopUpdateDetail(payload.detail);
      if (payload.phase === 'ready-to-restart') {
        setDesktopUpdateActionState('ready-to-restart');
        setDesktopUpdateStatusMessage('新版本已安装，重启应用后生效。');
        return;
      }
      setDesktopUpdateActionState('downloading');
    }).then((unlisten) => {
      detach = unlisten;
    });

    return () => {
      detach();
    };
  }, []);

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
    if (!runtimeInstalling) {
      setRuntimeInstallProgress({
        phase: 'inspect',
        progress: 12,
        label: '正在检查本地环境',
        detail: '确认核心组件、工作区和运行配置是否已准备就绪。',
      });
    }
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
    setRuntimeInstallProgress({
      phase: 'prepare',
      progress: 6,
      label: '正在准备安装组件',
      detail: '为首次启动创建本地运行目录并校验安装来源。',
    });
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
        setRuntimeInstallProgress({
          phase: 'prepare',
          progress: 6,
          label: '正在准备安装组件',
          detail: '首次启动需要部署本地运行环境，请稍候。',
        });
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
    let cancelled = false;
    let settled = false;

    const settleGuest = (clearStoredAuth = false) => {
      if (cancelled || settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      if (clearStoredAuth) {
        void clearAuth().catch(() => {});
      }
      setAccessToken(null);
      setSessionAuthed(false);
      setCurrentUser(null);
      setAuthBootstrapReady(true);
    };

    const settleAuthed = (token: string | null, user: AuthUser | null) => {
      if (cancelled || settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      setAccessToken(token);
      setSessionAuthed(true);
      setCurrentUser(user);
      setAuthModalOpen(false);
      setAuthBootstrapReady(true);
    };

    const timeoutId = window.setTimeout(() => {
      settleGuest(false);
    }, AUTH_BOOTSTRAP_TIMEOUT_MS);

    const bootAuth = async () => {
      try {
        const auth = await readAuth();
        if (!auth) {
          try {
            const user = (await client.me()) as AuthUser;
            if (!user) {
              settleGuest(false);
              return;
            }
            settleAuthed(null, user || null);
          } catch {
            settleGuest(false);
          }
          return;
        }

        if (!isLikelyAccessToken(auth.accessToken)) {
          settleGuest(true);
          return;
        }

        try {
          const user = (await client.me(auth.accessToken)) as AuthUser;
          try {
            await syncWorkspaceForUser(auth.accessToken);
          } catch (error) {
            console.error('[desktop] failed to sync workspace from backup, resetting to defaults', error);
            await resetIclawWorkspaceToDefaults();
          }
          settleAuthed(auth.accessToken, user || null);
          return;
        } catch {}

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
          const user = (await client.me(refreshed.access_token)) as AuthUser;
          settleAuthed(refreshed.access_token, user || null);
        } catch {
          settleGuest(true);
        }
      } catch {
        settleGuest(true);
      }
    };

    void bootAuth();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
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
        setOverlayView(postAuthView);
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
        setOverlayView(postAuthView);
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
        setOverlayView(postAuthView);
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
    setPrimaryView('chat');
    setOverlayView(null);
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
      setInitialHealthResolved(false);
      return;
    }

    let cancelled = false;

    const resolvePortConflictMessage = async (): Promise<string | null> => {
      const status = await detectPortConflicts().catch(() => null);
      return formatPortConflictMessage(status?.occupied_ports ?? []);
    };

    const check = async (blocking = false): Promise<boolean> => {
      if (blocking) {
        setHealthChecking(true);
      }
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
        if (!cancelled && blocking) {
          setHealthChecking(false);
        }
      }
    };

    const boot = async () => {
      const healthyNow = await check(true);
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
          if (!cancelled) {
            setInitialHealthResolved(true);
          }
          return;
        }
        await check(true);
      }
      if (!cancelled) {
        setInitialHealthResolved(true);
      }
    };

    void boot();
    const timer = window.setInterval(() => {
      void check(false);
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client, runtimeChecking, runtimeInstalling, runtimeReady]);
  const installerErrorMessage =
    runtimeInstallError ||
    healthError ||
    (!runtimeReady && !runtimeInstalling && !runtimeDiagnosis?.runtime_installable
      ? '当前安装包未包含可用的运行时来源，请重新下载应用或联系支持。'
      : null);
  const installerView: InstallerViewModel = (() => {
    const normalizedProgress = runtimeInstallProgress
      ? {
          ...runtimeInstallProgress,
          label: normalizeBrandRuntimeText(runtimeInstallProgress.label),
          detail: normalizeBrandRuntimeText(runtimeInstallProgress.detail),
        }
      : null;

    if (installerErrorMessage) {
      return {
        state: 'error',
        title: '唤醒失败',
        subtitle: '安装过程遇到问题',
        progress: Math.max(0, Math.min(100, normalizedProgress?.progress ?? 0)),
        stepLabel: normalizedProgress?.label || '安装过程中断',
        stepDetail: normalizedProgress?.detail || '无法继续准备本地运行环境。',
        errorMessage: installerErrorMessage,
      };
    }

    if (runtimeInstalling) {
      const progress = normalizedProgress ?? {
        phase: 'prepare',
        progress: 6,
        label: '正在准备安装组件',
        detail: '首次启动需要部署本地运行环境，请稍候。',
      };
      const title =
        progress.progress < 30
          ? `${BRAND.displayName} 正在苏醒`
          : progress.progress < 85
            ? `正在准备 ${BRAND.displayName}`
            : '即将完成';
      return {
        state: 'loading',
        title,
        subtitle: '正在部署你的本地 AI 助手',
        progress: progress.progress,
        stepLabel: progress.label,
        stepDetail: progress.detail,
        errorMessage: null,
      };
    }

    if (runtimeChecking || !runtimeReady) {
      return {
        state: 'loading',
        title: `${BRAND.displayName} 正在苏醒`,
        subtitle: '首次启动需要准备本地运行环境',
        progress: 12,
        stepLabel: '正在检查本地环境',
        stepDetail: '确认核心组件、工作区和运行配置是否已准备就绪。',
        errorMessage: null,
      };
    }

    return {
      state: 'loading',
      title: '即将完成',
      subtitle: '本地运行环境已准备完成',
      progress: healthy ? 100 : 96,
      stepLabel: healthy ? `${BRAND.displayName} 已就绪` : '正在启动本地服务',
      stepDetail: healthy ? '正在进入应用。' : '正在拉起本地服务并完成最后的健康检查。',
      errorMessage: null,
    };
  })();
  const shouldShowSetupPanel =
    !isAuthenticated &&
    IS_TAURI_RUNTIME &&
    (
      runtimeChecking ||
      runtimeInstalling ||
      !runtimeReady ||
      !initialHealthResolved ||
      healthChecking ||
      (!healthy && Boolean(healthError))
    );

  useEffect(() => {
    if (!desktopUpdateHint) return;
    if (desktopUpdateHint.latestVersion !== skippedDesktopUpdateVersion) {
      if (desktopUpdateActionState !== 'ready-to-restart') {
        setDesktopUpdateActionState('idle');
      }
      setDesktopUpdateError(null);
      if (desktopUpdateActionState !== 'downloading') {
        setDesktopUpdateProgress(null);
        setDesktopUpdateDetail(null);
      }
    }
  }, [desktopUpdateActionState, desktopUpdateHint, skippedDesktopUpdateVersion]);

  useEffect(() => {
    if (!authBootstrapReady || guestPromptInitialized || (IS_TAURI_RUNTIME && shouldShowSetupPanel)) {
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
        state={installerView.state}
        title={installerView.title}
        subtitle={installerView.subtitle}
        progress={installerView.progress}
        stepLabel={installerView.stepLabel}
        stepDetail={installerView.stepDetail}
        errorMessage={installerView.errorMessage}
        onRetry={retrySetup}
      />
    );
  }

  if (!authBootstrapReady) {
    return (
      <div className="h-screen overflow-hidden bg-[var(--bg-page)]">
        <div className="flex h-full items-center justify-center px-6">
          <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-4 text-[13px] text-[var(--text-secondary)] shadow-[var(--shadow-sm)]">
            正在恢复登录状态...
          </div>
        </div>
      </div>
    );
  }

  const visibleDesktopUpdateHint = shouldShowDesktopUpdateHint(desktopUpdateHint, skippedDesktopUpdateVersion)
    ? desktopUpdateHint
    : null;
  const desktopUpdateCardStatus =
    desktopUpdateActionState === 'ready-to-restart'
      ? 'ready-to-restart'
      : desktopUpdateActionState === 'downloading'
        ? 'downloading'
        : desktopUpdateActionState === 'checking'
          ? 'checking'
          : 'available';

  const handleSkipDesktopUpdate = () => {
    if (!desktopUpdateHint || desktopUpdateHint.mandatory) return;
    writeSkippedDesktopUpdateVersion(desktopUpdateHint.latestVersion);
    setSkippedDesktopUpdateVersion(desktopUpdateHint.latestVersion);
    setDesktopUpdateActionState('idle');
    setDesktopUpdateError(null);
    setDesktopUpdateProgress(null);
    setDesktopUpdateDetail(null);
    setDesktopUpdateStatusMessage(`已跳过版本 ${desktopUpdateHint.latestVersion}`);
  };

  const handleCheckForDesktopUpdates = async () => {
    setDesktopUpdateError(null);
    setDesktopUpdateStatusMessage(null);
    if (desktopUpdateActionState !== 'ready-to-restart') {
      setDesktopUpdateActionState('checking');
      setDesktopUpdateProgress(null);
      setDesktopUpdateDetail('正在检查是否有新版本。');
    }

    try {
      const hint = await client.getDesktopUpdateHint({
        appVersion: DESKTOP_APP_VERSION,
        channel: DESKTOP_RELEASE_CHANNEL,
      });
      if (hint.updateAvailable) {
        setDesktopUpdateHint(hint);
        setDesktopUpdateStatusMessage(
          hint.mandatory
            ? `发现新版本 ${hint.latestVersion}，当前版本需要强制升级。`
            : `发现新版本 ${hint.latestVersion}。`,
        );
      } else {
        setDesktopUpdateHint(null);
        setDesktopUpdateStatusMessage('当前已是最新版本。');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '检查更新失败';
      setDesktopUpdateError(message);
      setDesktopUpdateStatusMessage(message);
    } finally {
      if (desktopUpdateActionState !== 'ready-to-restart') {
        setDesktopUpdateActionState('idle');
      }
    }
  };

  const handleUpgradeDesktopApp = async () => {
    if (!visibleDesktopUpdateHint) return;
    setDesktopUpdateActionState('checking');
    setDesktopUpdateError(null);
    setDesktopUpdateStatusMessage(null);
    try {
      if (IS_TAURI_RUNTIME) {
        const updaterCheck = await checkDesktopUpdate({
          authBaseUrl: AUTH_BASE_URL,
          channel: DESKTOP_RELEASE_CHANNEL,
        });
        if (updaterCheck?.supported && updaterCheck.available) {
          setDesktopUpdateActionState('downloading');
          setDesktopUpdateProgress(5);
          setDesktopUpdateDetail('正在准备下载更新包。');
          await downloadAndInstallDesktopUpdate();
          return;
        }
      }

      const artifactUrl = await resolveDesktopUpdateArtifactUrl(visibleDesktopUpdateHint);
      const targetUrl = artifactUrl || visibleDesktopUpdateHint.manifestUrl;
      if (!targetUrl) {
        throw new Error('当前更新源未提供下载地址');
      }
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      setDesktopUpdateActionState('opened');
      setDesktopUpdateStatusMessage('已打开更新下载页。');
    } catch (error) {
      setDesktopUpdateActionState('idle');
      setDesktopUpdateError(error instanceof Error ? error.message : '打开更新链接失败');
      setDesktopUpdateStatusMessage(error instanceof Error ? error.message : '打开更新链接失败');
    }
  };

  const handleRestartDesktopApp = async () => {
    if (!IS_TAURI_RUNTIME) return;
    await restartDesktopApp();
  };

  return (
    <SettingsProvider>
      <div className="relative h-screen overflow-hidden">
        <AuthedView
          primaryView={primaryView}
          setPrimaryView={setPrimaryView}
          overlayView={overlayView}
          setOverlayView={setOverlayView}
          client={client}
          imBotClient={imBotClient}
          accessToken={accessToken}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          gatewayAuth={gatewayAuth}
          handleLogout={handleLogout}
          authenticated={isAuthenticated}
          authModalOpen={authModalOpen}
          onRequestAuth={openAuthModal}
          desktopUpdateHint={visibleDesktopUpdateHint}
          desktopUpdateBusy={
            desktopUpdateActionState === 'checking' || desktopUpdateActionState === 'downloading'
          }
          desktopUpdateError={desktopUpdateError}
          desktopUpdateOpened={desktopUpdateActionState === 'opened'}
          desktopUpdateStatus={desktopUpdateCardStatus}
          desktopUpdateProgress={desktopUpdateProgress}
          desktopUpdateDetail={desktopUpdateDetail}
          onUpgradeDesktopApp={handleUpgradeDesktopApp}
          onRestartDesktopApp={handleRestartDesktopApp}
          onSkipDesktopUpdate={handleSkipDesktopUpdate}
          onCheckForDesktopUpdates={handleCheckForDesktopUpdates}
          desktopUpdateCurrentVersion={DISPLAY_DESKTOP_APP_VERSION}
          desktopUpdateLatestVersion={desktopUpdateHint?.latestVersion || null}
          desktopUpdateMandatory={Boolean(desktopUpdateHint?.mandatory)}
          desktopUpdateChecking={desktopUpdateActionState === 'checking'}
          desktopUpdateReadyToRestart={desktopUpdateActionState === 'ready-to-restart'}
          desktopUpdateStatusMessage={desktopUpdateStatusMessage}
        />
        {authModalOpen ? (
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
        ) : null}
      </div>
    </SettingsProvider>
  );
}

interface AuthedViewProps {
  primaryView: PrimaryView;
  setPrimaryView: Dispatch<SetStateAction<PrimaryView>>;
  overlayView: 'settings' | 'account' | null;
  setOverlayView: Dispatch<SetStateAction<'settings' | 'account' | null>>;
  client: IClawClient;
  imBotClient: IClawClient;
  accessToken: string | null;
  currentUser: AuthUser | null;
  setCurrentUser: Dispatch<SetStateAction<AuthUser | null>>;
  gatewayAuth: { token?: string; password?: string };
  handleLogout: () => void;
  authenticated: boolean;
  authModalOpen: boolean;
  onRequestAuth: (mode?: 'login' | 'register', nextView?: 'account' | null) => void;
  desktopUpdateHint: DesktopUpdateHint | null;
  desktopUpdateBusy: boolean;
  desktopUpdateError: string | null;
  desktopUpdateOpened: boolean;
  desktopUpdateStatus: 'available' | 'checking' | 'downloading' | 'ready-to-restart';
  desktopUpdateProgress: number | null;
  desktopUpdateDetail: string | null;
  onUpgradeDesktopApp: () => void;
  onRestartDesktopApp: () => void;
  onSkipDesktopUpdate: () => void;
  onCheckForDesktopUpdates: () => void;
  desktopUpdateCurrentVersion: string;
  desktopUpdateLatestVersion: string | null;
  desktopUpdateMandatory: boolean;
  desktopUpdateChecking: boolean;
  desktopUpdateReadyToRestart: boolean;
  desktopUpdateStatusMessage: string | null;
}

function AuthedView({
  primaryView,
  setPrimaryView,
  overlayView,
  setOverlayView,
  client,
  imBotClient,
  accessToken,
  currentUser,
  setCurrentUser,
  gatewayAuth,
  handleLogout,
  authenticated,
  authModalOpen,
  onRequestAuth,
  desktopUpdateHint,
  desktopUpdateBusy,
  desktopUpdateError,
  desktopUpdateOpened,
  desktopUpdateStatus,
  desktopUpdateProgress,
  desktopUpdateDetail,
  onUpgradeDesktopApp,
  onRestartDesktopApp,
  onSkipDesktopUpdate,
  onCheckForDesktopUpdates,
  desktopUpdateCurrentVersion,
  desktopUpdateLatestVersion,
  desktopUpdateMandatory,
  desktopUpdateChecking,
  desktopUpdateReadyToRestart,
  desktopUpdateStatusMessage,
}: AuthedViewProps) {
  const { buildSectionSaveSnapshot, commitSectionSave } = useSettings();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [chatSurfaceVersion, setChatSurfaceVersion] = useState(0);
  const [creditBalance, setCreditBalance] = useState<CreditBalanceData | null>(null);
  const [creditBalanceLoading, setCreditBalanceLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    void syncManagedSkills({ client, accessToken }).catch((error) => {
      console.error('[desktop] failed to sync managed skills', error);
    });
  }, [accessToken, client]);

  useEffect(() => {
    if (!accessToken) {
      setCreditBalance(null);
      setCreditBalanceLoading(false);
      return;
    }

    let cancelled = false;
    const loadCreditBalance = async () => {
      setCreditBalanceLoading(true);
      try {
        const next = await client.creditsMe(accessToken);
        if (!cancelled) {
          setCreditBalance(next);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[desktop] failed to load credit balance', error);
        }
      } finally {
        if (!cancelled) {
          setCreditBalanceLoading(false);
        }
      }
    };

    void loadCreditBalance();
    const timer = window.setInterval(() => {
      void loadCreditBalance();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [accessToken, client]);

  const refreshCreditBalance = useCallback(async () => {
    if (!accessToken) {
      setCreditBalance(null);
      setCreditBalanceLoading(false);
      return;
    }

    setCreditBalanceLoading(true);
    try {
      const next = await client.creditsMe(accessToken);
      setCreditBalance(next);
    } catch (error) {
      console.error('[desktop] failed to refresh credit balance', error);
    } finally {
      setCreditBalanceLoading(false);
    }
  }, [accessToken, client]);

  const handleSaveSettings = async (section: PersistableSettingsSection) => {
    const snapshot = buildSectionSaveSnapshot(section);
    if (section === 'identity' || section === 'user-profile' || section === 'soul-persona') {
      const content =
        section === 'identity'
          ? snapshot.identity.markdownContent
          : section === 'user-profile'
            ? snapshot.userProfile.markdownContent
            : snapshot.soulPersona.markdownContent;
      await saveIclawWorkspaceSection(section, content);
    }

    commitSectionSave(section);

    if (
      accessToken &&
      (section === 'identity' || section === 'user-profile' || section === 'soul-persona')
    ) {
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

  const handleHeaderAccountAction = () => {
    if (!authenticated) {
      onRequestAuth('login', 'account');
      return;
    }
    setOverlayView('account');
  };

  const handleStartLobsterConversation = (agent: LobsterAgent) => {
    const seed = `${agent.slug}-${Date.now()}`;
    activeChatRoute = {
      sessionKey: `lobster-${seed}`,
      initialPrompt: buildLobsterConversationPrompt(agent),
      initialPromptKey: seed,
    };
    setPrimaryView('chat');
  };

  const handleStartNewChat = () => {
    const seed = `chat-${Date.now()}`;
    activeChatRoute = {
      sessionKey: seed,
      initialPrompt: null,
      initialPromptKey: seed,
    };
    setChatSurfaceVersion((current) => current + 1);
    setPrimaryView('chat');
  };

  return (
    <div className="relative flex h-screen overflow-hidden bg-[var(--bg-page)]">
      <Sidebar
        user={currentUser}
        activeView={primaryView}
        selectedTaskId={selectedTaskId}
        authenticated={authenticated}
        onOpenChat={() => setPrimaryView('chat')}
        onStartNewChat={handleStartNewChat}
        onOpenCron={() => setPrimaryView('cron')}
        onOpenLobsterStore={() => setPrimaryView('lobster-store')}
        onOpenSkillStore={() => setPrimaryView('skill-store')}
        onOpenDataConnections={() => setPrimaryView('data-connections')}
        onOpenSecurity={() => setPrimaryView('security')}
        onOpenImBots={() => setPrimaryView('im-bots')}
        onOpenMemory={() => setPrimaryView('memory')}
        onOpenTasks={() => setPrimaryView('task-center')}
        onSelectTask={setSelectedTaskId}
        onOpenAccount={() => {
          if (!authenticated) {
            onRequestAuth('login', 'account');
            return;
          }
          setOverlayView('account');
        }}
        onOpenLogin={() => onRequestAuth('login')}
        onOpenSettings={() => setOverlayView('settings')}
        onLogout={handleLogout}
        desktopUpdateHint={desktopUpdateHint}
        desktopUpdateBusy={desktopUpdateBusy}
        desktopUpdateError={desktopUpdateError}
        desktopUpdateOpened={desktopUpdateOpened}
        desktopUpdateStatus={desktopUpdateStatus}
        desktopUpdateProgress={desktopUpdateProgress}
        desktopUpdateDetail={desktopUpdateDetail}
        onUpgradeDesktopApp={onUpgradeDesktopApp}
        onRestartDesktopApp={onRestartDesktopApp}
        onSkipDesktopUpdate={onSkipDesktopUpdate}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {primaryView === 'data-connections' ? null : (
          <IClawHeader
            balance={creditBalance?.available_balance ?? creditBalance?.balance ?? null}
            loading={creditBalanceLoading}
            authenticated={authenticated}
            onCreditsClick={handleHeaderAccountAction}
            onSubscriptionClick={handleHeaderAccountAction}
          />
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {primaryView === 'lobster-store' ? (
            <LobsterStoreView
              client={client}
              accessToken={accessToken}
              authenticated={authenticated}
              currentUser={currentUser}
              onStartConversation={handleStartLobsterConversation}
              onRequestAuth={onRequestAuth}
            />
          ) : primaryView === 'skill-store' ? (
            <SkillStoreView
              client={client}
              accessToken={accessToken}
              authBaseUrl={AUTH_BASE_URL}
              authenticated={authenticated}
              currentUser={currentUser}
              onRequestAuth={onRequestAuth}
            />
          ) : primaryView === 'data-connections' ? (
            <DataConnectionsView />
          ) : primaryView === 'security' ? (
            <SecurityCenterView />
          ) : primaryView === 'memory' ? (
            <MemoryView />
          ) : primaryView === 'task-center' ? (
            <TaskCenterView
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
              onOpenChat={() => setPrimaryView('chat')}
            />
          ) : primaryView === 'cron' ? (
            authenticated ? (
              <OpenClawCronSurface
                gatewayUrl={GATEWAY_WS_URL}
                gatewayToken={gatewayAuth.token}
                gatewayPassword={gatewayAuth.password}
                sessionKey={CHAT_SESSION_KEY}
                shellAuthenticated={authenticated}
              />
            ) : (
              <RuntimeAuthRequiredView
                eyebrow="Cron Shell"
                title="当前定时任务页还不能挂载运行时"
                description="这不是正常空态。当前是 iClaw shell 还没有完成登录确认，因此 OpenClaw cron wrapper 暂时不会挂载。"
                authenticated={authenticated}
                hasGatewayAuth={Boolean(gatewayAuth.token || gatewayAuth.password)}
                onLogin={() => onRequestAuth('login')}
              />
            )
          ) : primaryView === 'im-bots' ? (
            <IMBotsView client={imBotClient} />
          ) : authenticated ? (
            <OpenClawChatSurface
              key={`${activeChatRoute.sessionKey}:${chatSurfaceVersion}`}
              gatewayUrl={GATEWAY_WS_URL}
              gatewayToken={gatewayAuth.token}
              gatewayPassword={gatewayAuth.password}
              sessionKey={activeChatRoute.sessionKey}
              initialPrompt={activeChatRoute.initialPrompt}
              initialPromptKey={activeChatRoute.initialPromptKey}
              shellAuthenticated={authenticated}
              creditClient={client}
              creditToken={accessToken}
              onCreditBalanceRefresh={refreshCreditBalance}
              user={currentUser}
            />
          ) : (
            <RuntimeAuthRequiredView
              eyebrow="Chat Shell"
              title="当前聊天区还不能挂载运行时"
              description="这不是正常空态。当前是 iClaw shell 还没有完成登录确认，因此 OpenClaw chat wrapper 暂时不会挂载。"
              authenticated={authenticated}
              hasGatewayAuth={Boolean(gatewayAuth.token || gatewayAuth.password)}
              onLogin={() => onRequestAuth('login')}
            />
          )}
        </div>
      </div>
      {overlayView === 'account' && accessToken ? (
        <AccountPanel
          client={client}
          token={accessToken}
          user={currentUser}
          onClose={() => setOverlayView(null)}
          onUserUpdated={(user) => setCurrentUser(user)}
        />
      ) : null}
      {overlayView === 'settings' ? (
        <SettingsPanel
          onClose={() => setOverlayView(null)}
          onSave={handleSaveSettings}
          desktopUpdateCurrentVersion={desktopUpdateCurrentVersion}
          desktopUpdateLatestVersion={desktopUpdateLatestVersion}
          desktopUpdateMandatory={desktopUpdateMandatory}
          desktopUpdateChecking={desktopUpdateChecking}
          desktopUpdateReadyToRestart={desktopUpdateReadyToRestart}
          desktopUpdateStatusMessage={desktopUpdateStatusMessage}
          onCheckForDesktopUpdates={onCheckForDesktopUpdates}
          onRestartDesktopApp={onRestartDesktopApp}
        />
      ) : null}
    </div>
  );
}
