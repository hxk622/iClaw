import { useCallback, useEffect, useRef, useState } from 'react';
import '@openclaw-ui/main.ts';
import './openclaw-chat-surface.css';
import {
  buildGeneratedUserAvatarDataUrl,
  resolveUserAvatarUrl,
  type AppUserAvatarSource,
} from '../lib/user-avatar';
import {
  RichChatComposer,
  type ComposerSendPayload,
  type OpenClawImageAttachment,
  type RichChatComposerHandle,
} from './RichChatComposer';

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
  chatSending: boolean;
  chatRunId: string | null;
  chatMessage: string;
  chatAttachments: OpenClawImageAttachment[];
  lastError: string | null;
  applySettings: (next: OpenClawSettings) => void;
  handleSendChat: (message?: string, options?: { restoreDraft?: boolean }) => Promise<void>;
  handleAbortChat: () => Promise<void>;
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

const ASSISTANT_AVATAR_SRC = '/favicon.png';

type ChatSurfaceStatus = {
  busy: boolean;
  connected: boolean;
};

type ChatSelectionMenu = {
  text: string;
  x: number;
  y: number;
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
  const composerRef = useRef<RichChatComposerHandle | null>(null);
  const [status, setStatus] = useState<ChatSurfaceStatus>({ busy: false, connected: false });
  const [selectionMenu, setSelectionMenu] = useState<ChatSelectionMenu | null>(null);

  const closeSelectionMenu = useCallback(() => {
    setSelectionMenu(null);
  }, []);
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

    const assistantAvatarUrl = new URL(ASSISTANT_AVATAR_SRC, window.location.href).href;
    const userAvatarUrl =
      resolveUserAvatarUrl(user as AppUserAvatarSource) ||
      buildGeneratedUserAvatarDataUrl(user as AppUserAvatarSource, 'i');

    host.style.setProperty('--iclaw-assistant-avatar-image', `url("${assistantAvatarUrl}")`);
    host.dataset.hasUserAvatar = 'true';
    host.style.setProperty('--iclaw-user-avatar-image', `url("${userAvatarUrl}")`);
  }, [user?.avatar, user?.avatarUrl, user?.avatar_url, user?.display_name, user?.email, user?.name, user?.nickname, user?.username]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const app = appRef.current;
      if (!app) {
        return;
      }
      const nextStatus: ChatSurfaceStatus = {
        connected: Boolean(app.connected),
        busy: Boolean(app.chatSending || app.chatRunId),
      };
      setStatus((current) =>
        current.connected === nextStatus.connected && current.busy === nextStatus.busy
          ? current
          : nextStatus,
      );
    }, 180);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const handleContextMenu = (event: MouseEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }
      const text = selection.toString().trim();
      if (!text) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const assistantText = target?.closest('.chat-group.assistant .chat-text');
      if (!assistantText) {
        return;
      }
      const range = selection.getRangeAt(0);
      if (!assistantText.contains(range.commonAncestorContainer)) {
        return;
      }
      event.preventDefault();
      setSelectionMenu({
        text,
        x: Math.min(event.clientX, window.innerWidth - 228),
        y: Math.min(event.clientY, window.innerHeight - 188),
      });
    };

    host.addEventListener('contextmenu', handleContextMenu);
    return () => host.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  useEffect(() => {
    if (!selectionMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.iclaw-selection-menu')) {
        return;
      }
      closeSelectionMenu();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSelectionMenu();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', closeSelectionMenu);
    window.addEventListener('scroll', closeSelectionMenu, true);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', closeSelectionMenu);
      window.removeEventListener('scroll', closeSelectionMenu, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [closeSelectionMenu, selectionMenu]);

  const handleSend = useCallback(async (payload: ComposerSendPayload): Promise<boolean> => {
    const app = appRef.current;
    if (!app?.connected) {
      return false;
    }
    app.chatMessage = payload.prompt;
    app.chatAttachments = payload.imageAttachments;
    await app.handleSendChat();
    return true;
  }, []);

  const handleAbort = useCallback(async () => {
    await appRef.current?.handleAbortChat();
  }, []);

  const sendShortcut = useCallback(async (prompt: string) => {
    const app = appRef.current;
    if (!app?.connected) {
      return;
    }
    await app.handleSendChat(prompt, { restoreDraft: true });
  }, []);

  return (
    <div className="openclaw-chat-surface-shell h-full flex-1 overflow-hidden">
      <div ref={hostRef} className="openclaw-chat-surface h-full flex-1 overflow-hidden" />

      <RichChatComposer
        ref={composerRef}
        connected={status.connected}
        busy={status.busy}
        onSend={handleSend}
        onAbort={handleAbort}
      />

      {selectionMenu ? (
        <div
          className="iclaw-selection-menu"
          style={{ left: `${selectionMenu.x}px`, top: `${selectionMenu.y}px` }}
          role="menu"
          aria-label="聊天引用操作"
        >
          <button
            type="button"
            className="iclaw-selection-menu__item"
            onClick={() => {
              composerRef.current?.insertReference(selectionMenu.text);
              composerRef.current?.focus();
              closeSelectionMenu();
            }}
          >
            追问
          </button>
          <button
            type="button"
            className="iclaw-selection-menu__item"
            onClick={() => {
              void navigator.clipboard.writeText(selectionMenu.text);
              closeSelectionMenu();
            }}
          >
            复制
          </button>
          <button
            type="button"
            className="iclaw-selection-menu__item"
            onClick={() => {
              void sendShortcut(`请总结下面这段内容，保留关键信息与结论：\n\n${selectionMenu.text}`);
              closeSelectionMenu();
            }}
          >
            总结这段
          </button>
          <button
            type="button"
            className="iclaw-selection-menu__item"
            onClick={() => {
              void sendShortcut(`请解释下面这段内容，并说明它的核心含义：\n\n${selectionMenu.text}`);
              closeSelectionMenu();
            }}
          >
            解释这段
          </button>
        </div>
      ) : null}
    </div>
  );
}
