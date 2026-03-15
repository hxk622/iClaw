import { useEffect, useRef, useState } from 'react';
import '@openclaw-ui/main.ts';
import './openclaw-chat-surface.css';
import {
  buildGeneratedUserAvatarDataUrl,
  resolveUserAvatarUrl,
  type AppUserAvatarSource,
} from '../lib/user-avatar';

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
  applySettings: (next: OpenClawSettings) => void;
  connect: () => void;
};

type OpenClawChatSurfaceProps = {
  gatewayUrl: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  sessionKey?: string;
  user?: {
    name?: string | null;
    username?: string | null;
    display_name?: string | null;
    nickname?: string | null;
    email?: string | null;
    avatar_url?: string | null;
    avatar?: string | null;
    avatarUrl?: string | null;
  } | null;
};

type ChatSurfaceStatus = {
  connected: boolean;
  lastError: string | null;
};

const ASSISTANT_AVATAR_SRC = '/favicon.png';
const OPENCLAW_CONTROL_SETTINGS_KEY = 'openclaw.control.settings.v1';
const OPENCLAW_CONTROL_TOKEN_PREFIX = 'openclaw.control.token.v1';
const OPENCLAW_DEVICE_AUTH_KEY = 'openclaw.device.auth.v1';
const OPENCLAW_DEVICE_IDENTITY_KEY = 'openclaw-device-identity-v1';

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

export function OpenClawChatSurface({
  gatewayUrl,
  gatewayToken,
  gatewayPassword,
  sessionKey = 'main',
  user,
}: OpenClawChatSurfaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<OpenClawAppElement | null>(null);
  const reconnectKeyRef = useRef<string | null>(null);
  const [status, setStatus] = useState<ChatSurfaceStatus>({
    connected: false,
    lastError: null,
  });
  const [showConnectionCard, setShowConnectionCard] = useState(false);

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
    app.tab = 'chat';

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
    app.tab = 'chat';

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
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const assistantAvatarUrl = new URL(ASSISTANT_AVATAR_SRC, window.location.href).href;
    const userAvatarUrl =
      resolveUserAvatarUrl(user as AppUserAvatarSource) ||
      buildGeneratedUserAvatarDataUrl(user as AppUserAvatarSource, 'i');

    host.style.setProperty('--iclaw-assistant-avatar-image', `url("${assistantAvatarUrl}")`);
    host.dataset.hasUserAvatar = 'true';
    host.style.setProperty('--iclaw-user-avatar-image', `url("${userAvatarUrl}")`);
  }, [
    user?.avatar,
    user?.avatarUrl,
    user?.avatar_url,
    user?.display_name,
    user?.email,
    user?.name,
    user?.nickname,
    user?.username,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const app = appRef.current;
      if (!app) {
        return;
      }

      const nextStatus: ChatSurfaceStatus = {
        connected: Boolean(app.connected),
        lastError: app.lastError ?? null,
      };
      setStatus((current) =>
        current.connected === nextStatus.connected && current.lastError === nextStatus.lastError
          ? current
          : nextStatus,
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

  const hasGatewayAuth = Boolean((gatewayToken ?? '').trim() || (gatewayPassword ?? '').trim());
  const connectionMessage = status.lastError
    ? status.lastError
    : hasGatewayAuth
      ? '正在连接 OpenClaw 网关…'
      : '缺少本地网关凭据，当前无法连接 OpenClaw。';
  const secureContextHint =
    typeof window !== 'undefined' && !window.isSecureContext
      ? '当前页面不是安全上下文，OpenClaw 可能会拒绝设备身份校验。'
      : null;

  return (
    <div className="openclaw-chat-surface-shell h-full flex-1 overflow-hidden">
      <div ref={hostRef} className="openclaw-chat-surface h-full min-h-0 flex-1 overflow-hidden" />

      {!status.connected && showConnectionCard ? (
        <div className="iclaw-chat-state-card" role="status" aria-live="polite">
          <div className="iclaw-chat-state-card__eyebrow">
            {status.lastError ? '连接失败' : '正在建立连接'}
          </div>
          <div className="iclaw-chat-state-card__title">{connectionMessage}</div>
          <div className="iclaw-chat-state-card__meta">网关地址：{gatewayUrl}</div>
          {secureContextHint ? (
            <div className="iclaw-chat-state-card__meta">{secureContextHint}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
