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

const DESIGN_SHORTCUTS = [
  { icon: '+', label: '' },
  { icon: '⚡', label: '快捷' },
  { icon: '▣', label: '图像生成' },
  { icon: '✎', label: '帮我写作' },
  { icon: '译', label: '翻译' },
  { icon: '♪', label: '音乐生成' },
  { icon: '</>', label: '编程' },
  { icon: '⋯', label: '更多' },
] as const;
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

function createChromeButton(className: string, text: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `iclaw-chat-icon-button ${className}`;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.textContent = text;
  return button;
}

function ensureHeaderActions(host: HTMLDivElement) {
  const title = host.querySelector<HTMLElement>('.page-title');
  if (title) {
    title.textContent = '智能对话';
  }

  const subtitle = host.querySelector<HTMLElement>('.page-sub');
  if (subtitle) {
    subtitle.textContent = '内容由 AI 生成';
  }

  const meta = host.querySelector<HTMLElement>('.page-meta');
  if (!meta || meta.querySelector('.iclaw-chat-header-actions')) {
    return;
  }

  const actions = document.createElement('div');
  actions.className = 'iclaw-chat-header-actions';
  actions.append(
    createChromeButton('iclaw-chat-icon-button--phone', '⌕', '通话'),
    createChromeButton('iclaw-chat-icon-button--copy', '⧉', '复制'),
    createChromeButton('iclaw-chat-icon-button--more', '⋯', '更多'),
  );
  meta.append(actions);
}

function ensureShortcutBar(host: HTMLDivElement) {
  const compose = host.querySelector<HTMLElement>('.chat-compose');
  if (!compose || compose.querySelector('.iclaw-chat-shortcuts')) {
    return;
  }

  const bar = document.createElement('div');
  bar.className = 'iclaw-chat-shortcuts';

  const items = document.createElement('div');
  items.className = 'iclaw-chat-shortcuts__items';

  DESIGN_SHORTCUTS.forEach(({ icon, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'iclaw-chat-shortcut';
    button.tabIndex = -1;

    const iconEl = document.createElement('span');
    iconEl.className = 'iclaw-chat-shortcut__icon';
    iconEl.textContent = icon;

    button.append(iconEl);
    if (label) {
      const labelEl = document.createElement('span');
      labelEl.className = 'iclaw-chat-shortcut__label';
      labelEl.textContent = label;
      button.append(labelEl);
    }

    items.append(button);
  });

  const voice = document.createElement('button');
  voice.type = 'button';
  voice.className = 'iclaw-chat-shortcuts__voice';
  voice.tabIndex = -1;
  voice.setAttribute('aria-label', '语音');
  voice.title = '语音';
  voice.textContent = '◉';

  bar.append(items, voice);
  compose.append(bar);
}

function syncDesignChrome(host: HTMLDivElement) {
  ensureHeaderActions(host);
  ensureShortcutBar(host);
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
      syncDesignChrome(host);
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
