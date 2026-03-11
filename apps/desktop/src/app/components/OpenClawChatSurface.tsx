import { useEffect, useRef, useState } from 'react';
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

export function OpenClawChatSurface({
  gatewayUrl,
  gatewayToken,
  gatewayPassword,
  sessionKey = 'main',
}: OpenClawChatSurfaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [uiReady, setUiReady] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const ensureUiLoaded = async () => {
      try {
        await import('@openclaw-ui/main.ts');
        if (cancelled) return;
        setUiReady(true);
        setUiError(null);
      } catch (error) {
        if (cancelled) return;
        setUiReady(false);
        setUiError(error instanceof Error ? error.message : 'failed to load chat ui');
      }
    };

    void ensureUiLoaded();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!uiReady) {
      return;
    }

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
  }, [gatewayPassword, gatewayToken, gatewayUrl, sessionKey, uiReady]);

  useEffect(() => {
    if (!uiReady) {
      return;
    }

    const host = hostRef.current;
    if (!host) {
      return;
    }

    const sync = () => syncDesignChrome(host);
    sync();

    const observer = new MutationObserver(() => {
      sync();
    });
    observer.observe(host, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [uiReady]);

  if (uiError) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--bg-page)] px-10">
        <div className="max-w-xl rounded-[28px] border border-[var(--border-default)] bg-white/90 px-8 py-8 text-left shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="text-[20px] font-medium text-[var(--text-primary)]">聊天界面加载失败</div>
          <p className="mt-3 text-[14px] leading-6 text-[var(--text-secondary)]">
            这不是本地服务未启动，而是前端聊天界面自身在加载时出错。
          </p>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-[var(--bg-subtle)] p-4 text-[12px] leading-5 text-[var(--text-secondary)]">
            {uiError}
          </pre>
        </div>
      </div>
    );
  }

  if (!uiReady) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--bg-page)] px-10">
        <div className="max-w-md rounded-[28px] border border-[var(--border-default)] bg-white/90 px-8 py-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="text-[20px] font-medium text-[var(--text-primary)]">正在加载聊天界面</div>
          <p className="mt-3 text-[14px] leading-6 text-[var(--text-secondary)]">
            本地服务已启动，正在装载对话界面资源。
          </p>
        </div>
      </div>
    );
  }

  return <div ref={hostRef} className="openclaw-chat-surface h-full flex-1 overflow-hidden" />;
}
