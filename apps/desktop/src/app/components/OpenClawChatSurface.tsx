import { useEffect, useRef } from 'react';
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
  applySettings: (next: OpenClawSettings) => void;
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
    email?: string | null;
    avatar_url?: string | null;
    avatar?: string | null;
    avatarUrl?: string | null;
  } | null;
};

const ASSISTANT_AVATAR_SRC = '/favicon.png';
const ASSISTANT_AVATAR_ALT = 'iClaw';

function resolveThemeMode(): OpenClawTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function resolveUserName(
  user: OpenClawChatSurfaceProps['user'],
): string {
  return (
    user?.name ||
    user?.display_name ||
    user?.username ||
    user?.email ||
    '用户'
  );
}

function resolveUserInitial(user: OpenClawChatSurfaceProps['user']): string {
  const name = resolveUserName(user).trim();
  return name[0]?.toUpperCase() || '我';
}

function resolveUserAvatarUrl(
  user: OpenClawChatSurfaceProps['user'],
): string | null {
  if (!user) {
    return null;
  }
  return user.avatar_url || user.avatarUrl || user.avatar || null;
}

function applyAvatarBackground(element: HTMLElement, src: string | null) {
  if (!src) {
    element.style.removeProperty('background-image');
    return;
  }
  element.style.backgroundImage = `url(${JSON.stringify(src)})`;
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

function syncRenderedAvatars(
  host: HTMLDivElement,
  user: OpenClawChatSurfaceProps['user'],
) {
  const userName = resolveUserName(user);
  const userInitial = resolveUserInitial(user);
  const userAvatarUrl = resolveUserAvatarUrl(user);

  host.querySelectorAll<HTMLElement>('.chat-avatar.assistant').forEach((avatar) => {
    avatar.classList.add('iclaw-chat-avatar');
    avatar.setAttribute('aria-label', ASSISTANT_AVATAR_ALT);
    avatar.setAttribute('title', ASSISTANT_AVATAR_ALT);

    if (avatar instanceof HTMLImageElement) {
      if (avatar.src !== new URL(ASSISTANT_AVATAR_SRC, window.location.href).href) {
        avatar.src = ASSISTANT_AVATAR_SRC;
      }
      avatar.alt = ASSISTANT_AVATAR_ALT;
    } else {
      avatar.textContent = '';
      applyAvatarBackground(avatar, ASSISTANT_AVATAR_SRC);
    }
  });

  host.querySelectorAll<HTMLElement>('.chat-avatar.user').forEach((avatar) => {
    avatar.classList.add('iclaw-chat-avatar');
    avatar.classList.toggle('iclaw-chat-avatar--image', Boolean(userAvatarUrl));
    avatar.setAttribute('aria-label', userName);
    avatar.setAttribute('title', userName);

    if (avatar instanceof HTMLImageElement) {
      avatar.alt = userName;
      if (userAvatarUrl) {
        if (avatar.src !== new URL(userAvatarUrl, window.location.href).href) {
          avatar.src = userAvatarUrl;
        }
      } else {
        avatar.removeAttribute('src');
      }
    } else {
      avatar.textContent = userAvatarUrl ? '' : userInitial;
      applyAvatarBackground(avatar, userAvatarUrl);
    }
  });
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
  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

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
  }, [gatewayPassword, gatewayToken, gatewayUrl, sessionKey]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let rafId = 0;
    const sync = () => {
      syncRenderedAvatars(host, user);
    };
    const scheduleSync = () => {
      if (rafId !== 0) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        sync();
      });
    };

    sync();

    const observer = new MutationObserver(() => {
      scheduleSync();
    });
    observer.observe(host, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [user?.avatar, user?.avatarUrl, user?.avatar_url, user?.display_name, user?.email, user?.name, user?.username]);

  return <div ref={hostRef} className="openclaw-chat-surface h-full flex-1 overflow-hidden" />;
}
