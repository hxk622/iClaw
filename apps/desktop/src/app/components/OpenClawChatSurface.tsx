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
  connect: () => void;
  scrollToBottom: (opts?: { smooth?: boolean }) => void;
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

type ChatSurfaceStatus = {
  busy: boolean;
  connected: boolean;
  lastError: string | null;
};

type SelectionMenuState = {
  x: number;
  y: number;
  text: string;
  label: string;
};

const ASSISTANT_AVATAR_SRC = '/favicon.png';
const CHAT_MENU_WIDTH = 180;
const CHAT_MENU_HEIGHT = 108;
const CHAT_MENU_GAP = 12;
const FOLLOW_UP_SUFFIX = ' 请继续展开说明。';

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

function buildSelectionLabel(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 35) {
    return collapsed;
  }
  return `${collapsed.slice(0, 34)}…`;
}

export function OpenClawChatSurface({
  gatewayUrl,
  gatewayToken,
  gatewayPassword,
  sessionKey = 'main',
  user,
}: OpenClawChatSurfaceProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<OpenClawAppElement | null>(null);
  const composerRef = useRef<RichChatComposerHandle | null>(null);
  const selectionMenuRef = useRef<HTMLDivElement | null>(null);
  const reconnectKeyRef = useRef<string | null>(null);
  const initialScrollScheduledRef = useRef(false);
  const [status, setStatus] = useState<ChatSurfaceStatus>({
    busy: false,
    connected: false,
    lastError: null,
  });
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(null);

  const closeSelectionMenu = useCallback(() => {
    setSelectionMenu(null);
  }, []);

  const clearSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }
    selection.removeAllRanges();
  }, []);

  const resolveChatSelection = useCallback((): { text: string; label: string } | null => {
    const host = hostRef.current;
    const selection = window.getSelection();
    if (!host || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }

    const text = selection.toString().replace(/\u00a0/g, ' ').trim();
    if (!text) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const commonAncestor =
      range.commonAncestorContainer instanceof Element
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    if (!commonAncestor) {
      return null;
    }

    const chatThread = commonAncestor.closest('.chat-thread');
    if (!chatThread || !host.contains(chatThread)) {
      return null;
    }

    return {
      text,
      label: buildSelectionLabel(text),
    };
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
      initialScrollScheduledRef.current = false;
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
  }, [user?.avatar, user?.avatarUrl, user?.avatar_url, user?.display_name, user?.email, user?.name, user?.nickname, user?.username]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const updateComposerHeight = () => {
      const composer = shell.querySelector('.iclaw-composer') as HTMLElement | null;
      const thread = shell.querySelector('.openclaw-chat-surface .chat-thread') as HTMLElement | null;
      const composerHeight = composer?.getBoundingClientRect().height ?? 0;
      const overlap =
        composer && thread
          ? Math.max(0, thread.getBoundingClientRect().bottom - composer.getBoundingClientRect().top)
          : 0;
      shell.style.setProperty('--iclaw-composer-height', `${Math.ceil(composerHeight)}px`);
      shell.style.setProperty('--iclaw-thread-bottom-gap', `${Math.ceil(overlap + 24)}px`);
    };

    updateComposerHeight();
    const observer = new ResizeObserver(() => {
      updateComposerHeight();
    });
    const composer = shell.querySelector('.iclaw-composer');
    const thread = shell.querySelector('.openclaw-chat-surface .chat-thread');
    if (composer) {
      observer.observe(composer);
    }
    if (thread) {
      observer.observe(thread);
    }
    window.addEventListener('resize', updateComposerHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateComposerHeight);
    };
  }, [status.connected, status.busy]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const app = appRef.current;
      if (!app) {
        return;
      }
      const nextStatus: ChatSurfaceStatus = {
        connected: Boolean(app.connected),
        busy: Boolean(app.chatSending || app.chatRunId),
        lastError: app.lastError ?? null,
      };
      setStatus((current) =>
        current.connected === nextStatus.connected &&
        current.busy === nextStatus.busy &&
        current.lastError === nextStatus.lastError
          ? current
          : nextStatus,
      );
    }, 180);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !status.connected || initialScrollScheduledRef.current) {
      return;
    }
    initialScrollScheduledRef.current = true;

    const delays = [0, 180, 700, 1500];
    const timers = delays.map((delay) =>
      window.setTimeout(() => {
        app.scrollToBottom({ smooth: delay > 0 });
      }, delay),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [status.connected]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const handleContextMenu = (event: MouseEvent) => {
      const selected = resolveChatSelection();
      if (!selected) {
        closeSelectionMenu();
        return;
      }
      event.preventDefault();
      setSelectionMenu({
        x: Math.max(CHAT_MENU_GAP, Math.min(event.clientX, window.innerWidth - CHAT_MENU_WIDTH - CHAT_MENU_GAP)),
        y: Math.max(CHAT_MENU_GAP, Math.min(event.clientY, window.innerHeight - CHAT_MENU_HEIGHT - CHAT_MENU_GAP)),
        text: selected.text,
        label: selected.label,
      });
    };

    host.addEventListener('contextmenu', handleContextMenu);
    return () => host.removeEventListener('contextmenu', handleContextMenu);
  }, [closeSelectionMenu, resolveChatSelection]);

  useEffect(() => {
    if (!selectionMenu) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (selectionMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      closeSelectionMenu();
    };

    const handleSelectionChange = () => {
      if (!resolveChatSelection()) {
        closeSelectionMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSelectionMenu();
      }
    };

    const handleScrollOrBlur = () => {
      closeSelectionMenu();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleScrollOrBlur, true);
    window.addEventListener('resize', handleScrollOrBlur);
    window.addEventListener('blur', handleScrollOrBlur);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScrollOrBlur, true);
      window.removeEventListener('resize', handleScrollOrBlur);
      window.removeEventListener('blur', handleScrollOrBlur);
    };
  }, [closeSelectionMenu, resolveChatSelection, selectionMenu]);

  const handleSend = useCallback(async (payload: ComposerSendPayload): Promise<boolean> => {
    const app = appRef.current;
    if (!app?.connected) {
      setStatus((current) => ({
        ...current,
        lastError: app?.lastError ?? '尚未连接到 OpenClaw 网关，请稍等或重新进入页面。',
      }));
      return false;
    }
    app.chatMessage = payload.prompt;
    app.chatAttachments = payload.imageAttachments;
    await app.handleSendChat();
    app.scrollToBottom();
    window.setTimeout(() => app.scrollToBottom({ smooth: true }), 180);
    window.setTimeout(() => app.scrollToBottom({ smooth: true }), 900);
    return true;
  }, []);

  const handleAbort = useCallback(async () => {
    await appRef.current?.handleAbortChat();
  }, []);

  const handleSelectionFollowUp = useCallback(() => {
    if (!selectionMenu) {
      return;
    }
    composerRef.current?.insertReference(selectionMenu.text, {
      label: selectionMenu.label,
      trailingText: FOLLOW_UP_SUFFIX,
    });
    composerRef.current?.focus();
    clearSelection();
    closeSelectionMenu();
  }, [clearSelection, closeSelectionMenu, selectionMenu]);

  const handleSelectionCopy = useCallback(async () => {
    if (!selectionMenu) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectionMenu.text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = selectionMenu.text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.append(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    closeSelectionMenu();
  }, [closeSelectionMenu, selectionMenu]);

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
    <div ref={shellRef} className="openclaw-chat-surface-shell h-full flex-1 overflow-hidden">
      <div ref={hostRef} className="openclaw-chat-surface h-full flex-1 overflow-hidden" />

      {!status.connected ? (
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

      <RichChatComposer
        ref={composerRef}
        connected={status.connected}
        busy={status.busy}
        onSend={handleSend}
        onAbort={handleAbort}
      />

      {selectionMenu ? (
        <div
          ref={selectionMenuRef}
          className="iclaw-chat-selection-menu"
          style={{ left: selectionMenu.x, top: selectionMenu.y }}
          role="menu"
          aria-label="选中文本操作"
        >
          <button type="button" className="iclaw-chat-selection-menu__item" onClick={handleSelectionFollowUp}>
            追问
          </button>
          <button type="button" className="iclaw-chat-selection-menu__item" onClick={() => void handleSelectionCopy()}>
            复制
          </button>
        </div>
      ) : null}
    </div>
  );
}
