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

function resolveThemeMode(): OpenClawTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
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

function hasDesignChrome(host: HTMLDivElement): boolean {
  return Boolean(
    host.querySelector('.iclaw-chat-header-actions') && host.querySelector('.iclaw-chat-shortcuts'),
  );
}

export function OpenClawChatSurface({
  gatewayUrl,
  gatewayToken,
  gatewayPassword,
  sessionKey = 'main',
}: OpenClawChatSurfaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
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

    host.replaceChildren(app);

    return () => {
      host.replaceChildren();
    };
  }, [gatewayPassword, gatewayToken, gatewayUrl, sessionKey]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 20;

    const trySync = () => {
      syncDesignChrome(host);
      attempts += 1;
      if (hasDesignChrome(host) || attempts >= maxAttempts) {
        window.clearInterval(intervalId);
      }
    };

    trySync();
    const intervalId = window.setInterval(trySync, 200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return <div ref={hostRef} className="openclaw-chat-surface h-full flex-1 overflow-hidden" />;
}
