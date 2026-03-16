import { useEffect, useRef, useState } from 'react';
import '@openclaw-ui/main.ts';
import './openclaw-chat-surface.css';

type OpenClawTheme = 'system' | 'light' | 'dark';

type OpenClawSettings = {
  gatewayUrl: string;
  token: string;
  sessionKey: string;
  lastActiveSessionKey: string;
  theme: OpenClawTheme;
  chatFocusMode: boolean;
  chatShowThinking: boolean;
  splitRatio: number;
  navCollapsed: boolean;
  navGroupsCollapsed: Record<string, boolean>;
  locale?: string;
};

type OpenClawAppElement = HTMLElement & {
  password: string;
  sessionKey: string;
  tab: string;
  settings: OpenClawSettings;
  connected: boolean;
  lastError: string | null;
  lastErrorCode?: string | null;
  applySettings: (next: OpenClawSettings) => void;
  connect: () => void;
};

type OpenClawCronSurfaceProps = {
  gatewayUrl: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  sessionKey?: string;
  shellAuthenticated?: boolean;
};

type CronSurfaceStatus = {
  connected: boolean;
  lastError: string | null;
  lastErrorCode: string | null;
};

type CronSurfaceRenderState = {
  hasSummary: boolean;
  summaryVisible: boolean;
  hasWorkspace: boolean;
  workspaceVisible: boolean;
};

const OPENCLAW_CONTROL_SETTINGS_KEY = 'openclaw.control.settings.v1';
const OPENCLAW_CONTROL_TOKEN_PREFIX = 'openclaw.control.token.v1';
const OPENCLAW_DEVICE_AUTH_KEY = 'openclaw.device.auth.v1';
const OPENCLAW_DEVICE_IDENTITY_KEY = 'openclaw-device-identity-v1';

function isVisibleElement(node: Element | null): { visible: boolean; height: number } {
  if (!(node instanceof HTMLElement)) {
    return { visible: false, height: 0 };
  }

  const style = window.getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  const visible =
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0;

  return {
    visible,
    height: Math.round(rect.height),
  };
}

function resolveThemeMode(): OpenClawTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

function shouldResetEmbeddedOpenClawState(gatewayUrl: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!isLoopbackHost(window.location.hostname)) {
    return false;
  }

  try {
    const gatewayHost = new URL(gatewayUrl, window.location.href).hostname;
    return isLoopbackHost(gatewayHost);
  } catch {
    return false;
  }
}

function clearOpenClawEmbeddedState(gatewayUrl: string): void {
  if (!shouldResetEmbeddedOpenClawState(gatewayUrl)) {
    return;
  }

  const clearPrefixedKeys = (storage: Storage | undefined, prefix: string) => {
    if (!storage) {
      return;
    }
    const toDelete: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(prefix)) {
        toDelete.push(key);
      }
    }
    toDelete.forEach((key) => storage.removeItem(key));
  };

  try {
    window.localStorage.removeItem(OPENCLAW_CONTROL_SETTINGS_KEY);
    window.localStorage.removeItem(OPENCLAW_DEVICE_AUTH_KEY);
    window.localStorage.removeItem(OPENCLAW_DEVICE_IDENTITY_KEY);
    clearPrefixedKeys(window.localStorage, OPENCLAW_CONTROL_TOKEN_PREFIX);
  } catch {}

  try {
    clearPrefixedKeys(window.sessionStorage, OPENCLAW_CONTROL_TOKEN_PREFIX);
  } catch {}
}

function buildSettings(params: {
  gatewayUrl: string;
  gatewayToken?: string;
  sessionKey: string;
}): OpenClawSettings {
  return {
    gatewayUrl: params.gatewayUrl,
    token: params.gatewayToken?.trim() ?? '',
    sessionKey: params.sessionKey,
    lastActiveSessionKey: params.sessionKey,
    theme: resolveThemeMode(),
    chatFocusMode: true,
    chatShowThinking: true,
    splitRatio: 0.6,
    navCollapsed: true,
    navGroupsCollapsed: {
      control: true,
      agent: true,
      settings: true,
    },
    locale: 'zh-CN',
  };
}

export function OpenClawCronSurface({
  gatewayUrl,
  gatewayToken,
  gatewayPassword,
  sessionKey = 'main',
  shellAuthenticated = false,
}: OpenClawCronSurfaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<OpenClawAppElement | null>(null);
  const reconnectKeyRef = useRef<string | null>(null);
  const [status, setStatus] = useState<CronSurfaceStatus>({
    connected: false,
    lastError: null,
    lastErrorCode: null,
  });
  const [renderState, setRenderState] = useState<CronSurfaceRenderState>({
    hasSummary: false,
    summaryVisible: false,
    hasWorkspace: false,
    workspaceVisible: false,
  });
  const [showConnectionCard, setShowConnectionCard] = useState(false);
  const [showRenderDiagnosticsCard, setShowRenderDiagnosticsCard] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    clearOpenClawEmbeddedState(gatewayUrl);

    const app = document.createElement('openclaw-app') as OpenClawAppElement;
    const settings = buildSettings({ gatewayUrl, gatewayToken, sessionKey });

    app.applySettings(settings);
    app.password = gatewayPassword?.trim() ?? '';
    app.sessionKey = sessionKey;
    app.tab = 'cron';

    appRef.current = app;
    host.replaceChildren(app);

    return () => {
      if (appRef.current === app) {
        appRef.current = null;
      }
      host.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app) {
      return;
    }

    const settings = buildSettings({ gatewayUrl, gatewayToken, sessionKey });
    app.applySettings(settings);
    app.password = gatewayPassword?.trim() ?? '';
    app.sessionKey = sessionKey;
    app.tab = 'cron';

    const reconnectKey = JSON.stringify({
      gatewayUrl,
      gatewayToken: gatewayToken?.trim() ?? '',
      gatewayPassword: gatewayPassword?.trim() ?? '',
      sessionKey,
    });
    if (reconnectKeyRef.current === null) {
      reconnectKeyRef.current = reconnectKey;
      return;
    }
    if (reconnectKeyRef.current !== reconnectKey) {
      reconnectKeyRef.current = reconnectKey;
      app.connect();
    }
  }, [gatewayPassword, gatewayToken, gatewayUrl, sessionKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const app = appRef.current;
      const host = hostRef.current;
      if (!app || !host) {
        return;
      }

      const summary = host.querySelector('.cron-summary-strip');
      const workspace = host.querySelector('.cron-workspace');
      const summaryState = isVisibleElement(summary);
      const workspaceState = isVisibleElement(workspace);

      const nextStatus: CronSurfaceStatus = {
        connected: Boolean(app.connected),
        lastError: app.lastError ?? null,
        lastErrorCode: app.lastErrorCode ?? null,
      };
      const nextRenderState: CronSurfaceRenderState = {
        hasSummary: Boolean(summary),
        summaryVisible: summaryState.visible,
        hasWorkspace: Boolean(workspace),
        workspaceVisible: workspaceState.visible,
      };

      setStatus((current) =>
        current.connected === nextStatus.connected &&
        current.lastError === nextStatus.lastError &&
        current.lastErrorCode === nextStatus.lastErrorCode
          ? current
          : nextStatus,
      );
      setRenderState((current) =>
        current.hasSummary === nextRenderState.hasSummary &&
        current.summaryVisible === nextRenderState.summaryVisible &&
        current.hasWorkspace === nextRenderState.hasWorkspace &&
        current.workspaceVisible === nextRenderState.workspaceVisible
          ? current
          : nextRenderState,
      );
    }, 180);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (status.connected) {
      setShowConnectionCard(false);
      return;
    }

    if (status.lastError) {
      setShowConnectionCard(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowConnectionCard(true);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [status.connected, status.lastError]);

  useEffect(() => {
    const cronUiReady =
      (renderState.hasSummary && renderState.summaryVisible) ||
      (renderState.hasWorkspace && renderState.workspaceVisible);

    if (!shellAuthenticated || !status.connected || cronUiReady) {
      setShowRenderDiagnosticsCard(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowRenderDiagnosticsCard(true);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    renderState.hasSummary,
    renderState.hasWorkspace,
    renderState.summaryVisible,
    renderState.workspaceVisible,
    shellAuthenticated,
    status.connected,
  ]);

  const cronUiReady =
    (renderState.hasSummary && renderState.summaryVisible) ||
    (renderState.hasWorkspace && renderState.workspaceVisible);
  const showBootMask = shellAuthenticated && !cronUiReady;
  const hasGatewayAuth = Boolean((gatewayToken ?? '').trim() || (gatewayPassword ?? '').trim());
  const connectionMessage = status.lastError
    ? status.lastError
    : hasGatewayAuth
      ? '正在连接 OpenClaw 定时任务中心…'
      : '缺少本地网关凭据，当前无法连接 OpenClaw。';

  return (
    <div className="openclaw-chat-surface openclaw-cron-surface h-full min-w-0 flex-1 overflow-hidden">
      <div className="openclaw-chat-surface-shell openclaw-cron-surface-shell h-full min-w-0 flex-1 overflow-hidden">
        {showBootMask ? (
          <div className="iclaw-chat-boot-mask" aria-hidden="true">
            <span className="iclaw-chat-boot-mask__sr-only">正在恢复定时任务</span>
            <div className="iclaw-chat-skeleton">
              <div className="iclaw-chat-skeleton__header">
                <div className="iclaw-chat-skeleton__dot" />
                <div className="iclaw-chat-skeleton__title" />
                <div className="iclaw-chat-skeleton__meta" />
              </div>
              <div className="iclaw-chat-skeleton__thread">
                <div className="iclaw-chat-skeleton__bubble iclaw-chat-skeleton__bubble--long" />
                <div className="iclaw-chat-skeleton__bubble iclaw-chat-skeleton__bubble--short" />
                <div className="iclaw-chat-skeleton__bubble iclaw-chat-skeleton__bubble--long" />
              </div>
              <div className="iclaw-chat-skeleton__composer">
                <div className="iclaw-chat-skeleton__composer-line" />
                <div className="iclaw-chat-skeleton__composer-actions">
                  <div className="iclaw-chat-skeleton__composer-chip" />
                  <div className="iclaw-chat-skeleton__composer-button" />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div ref={hostRef} className="openclaw-cron-surface-host" />

        {showConnectionCard ? (
          <div className="iclaw-chat-state-card">
            <div className="iclaw-chat-state-card__eyebrow">定时任务中心</div>
            <div className="iclaw-chat-state-card__title">
              {status.connected ? '正在准备定时任务管理界面' : '正在连接 OpenClaw 网关'}
            </div>
            <div className="iclaw-chat-state-card__body">{connectionMessage}</div>
            <div className="iclaw-chat-state-card__meta">网关地址：{gatewayUrl}</div>
          </div>
        ) : null}

        {showRenderDiagnosticsCard ? (
          <div className="iclaw-chat-inline-warning" role="status">
            网关已经连接，但定时任务面板尚未进入可见态。更像是嵌入层渲染问题，不是登录问题。
          </div>
        ) : null}
      </div>
    </div>
  );
}
