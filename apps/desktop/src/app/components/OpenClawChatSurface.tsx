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
  };
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
