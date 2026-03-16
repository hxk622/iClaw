import { Copy, MessageCircleQuestionMark, MessageSquarePlus, ScrollText } from 'lucide-react';
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

declare global {
  interface Window {
    __ICLAW_OPENCLAW_DIAGNOSTICS__?: Record<string, unknown>;
  }
}

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
  lastErrorCode?: string | null;
  hello?: {
    auth?: {
      role?: string;
      scopes?: string[];
    };
  } | null;
  client?: {
    request?: <T = unknown>(method: string, params?: unknown) => Promise<T>;
  } | null;
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
  shellAuthenticated?: boolean;
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
  lastErrorCode: string | null;
};

type ChatSurfaceRenderState = {
  hostHeight: number;
  hasNativeInput: boolean;
  nativeInputVisible: boolean;
  nativeInputHeight: number;
  hasThread: boolean;
  threadVisible: boolean;
  threadHeight: number;
  groupCount: number;
};

type UnhandledGatewayError = {
  message: string;
  code: string | null;
  detailCode: string | null;
  httpStatus: number | null;
  raw: string | null;
};

type GatewayRpcFailure = {
  method: string;
  code: string | null;
  detailCode: string | null;
  message: string;
};

type SelectionMenuState = {
  x: number;
  y: number;
  text: string;
  label: string;
};

const ASSISTANT_AVATAR_SRC = '/favicon.png';
const OPENCLAW_CONTROL_SETTINGS_KEY = 'openclaw.control.settings.v1';
const OPENCLAW_CONTROL_TOKEN_PREFIX = 'openclaw.control.token.v1';
const OPENCLAW_DEVICE_AUTH_KEY = 'openclaw.device.auth.v1';
const OPENCLAW_DEVICE_IDENTITY_KEY = 'openclaw-device-identity-v1';
const CHAT_SELECTION_MENU_WIDTH = 220;
const CHAT_SELECTION_MENU_HEIGHT = 176;
const CHAT_SELECTION_MENU_GAP = 12;
const REFERENCE_MARKER_PATTERN = /\[\[引用:([\s\S]*?)\]\]/g;
const ARTIFACT_CARD_EXTENSIONS = ['md', 'markdown', 'html', 'htm', 'pdf', 'ppt', 'pptx', 'key', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'tsv'];
const ARTIFACT_CARD_KEYWORDS = [
  'artifact',
  'report',
  'memo',
  'brief',
  'briefing',
  'slides',
  'slide',
  'deck',
  'presentation',
  'document',
  'markdown',
  'html',
  'pdf',
  'ppt',
  'pptx',
  'docx',
  'xlsx',
  '投研',
  '报告',
  '研报',
  '简报',
  '纪要',
  '备忘录',
  '演示',
  '幻灯片',
  '文档',
];

type ArtifactAutoOpenState = {
  lastBusy: boolean;
  runSequence: number;
  pendingRunSequence: number | null;
  pendingScanCount: number;
  lastOpenedToken: string | null;
};

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

function buildSelectionLabel(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 35) {
    return collapsed;
  }
  return `${collapsed.slice(0, 34)}...`;
}

function buildToolCardSignature(card: HTMLElement): string {
  const parts = Array.from(
    card.querySelectorAll(
      '.chat-tool-card__title, .chat-tool-card__detail, .chat-tool-card__preview, .chat-tool-card__inline',
    ),
  )
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .filter(Boolean);

  return parts.join(' | ');
}

function isLikelyArtifactToolCard(card: HTMLElement): boolean {
  const normalized = buildToolCardSignature(card).toLowerCase();
  if (!normalized) {
    return false;
  }

  const hasArtifactPath = ARTIFACT_CARD_EXTENSIONS.some((extension) =>
    normalized.includes(`.${extension}`),
  );
  if (hasArtifactPath) {
    return true;
  }

  return ARTIFACT_CARD_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function findLatestArtifactToolCard(host: HTMLElement): HTMLElement | null {
  const groups = Array.from(host.querySelectorAll('.chat-group.assistant')).reverse();
  for (const group of groups) {
    const cards = Array.from(group.querySelectorAll('.chat-tool-card--clickable')).reverse();
    if (cards.length === 0) {
      continue;
    }
    for (const candidate of cards) {
      if (candidate instanceof HTMLElement && isLikelyArtifactToolCard(candidate)) {
        return candidate;
      }
    }
    return null;
  }
  return null;
}

function createReferenceChip(text: string): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = 'iclaw-chat-inline-reference';

  const badge = document.createElement('span');
  badge.className = 'iclaw-chat-inline-reference__badge';
  badge.textContent = '引';

  const label = document.createElement('span');
  label.className = 'iclaw-chat-inline-reference__label';
  label.textContent = text;

  chip.append(badge, label);
  return chip;
}

export function OpenClawChatSurface({
  gatewayUrl,
  gatewayToken,
  gatewayPassword,
  sessionKey = 'main',
  shellAuthenticated = false,
  user,
}: OpenClawChatSurfaceProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<OpenClawAppElement | null>(null);
  const composerRef = useRef<RichChatComposerHandle | null>(null);
  const reconnectKeyRef = useRef<string | null>(null);
  const initialScrollScheduledRef = useRef(false);
  const artifactAutoOpenStateRef = useRef<ArtifactAutoOpenState>({
    lastBusy: false,
    runSequence: 0,
    pendingRunSequence: null,
    pendingScanCount: 0,
    lastOpenedToken: null,
  });
  const artifactAutoOpenTimerRef = useRef<number | null>(null);
  const artifactAutoOpenBurstTimersRef = useRef<number[]>([]);
  const [status, setStatus] = useState<ChatSurfaceStatus>({
    busy: false,
    connected: false,
    lastError: null,
    lastErrorCode: null,
  });
  const [renderState, setRenderState] = useState<ChatSurfaceRenderState>({
    hostHeight: 0,
    hasNativeInput: false,
    nativeInputVisible: false,
    nativeInputHeight: 0,
    hasThread: false,
    threadVisible: false,
    threadHeight: 0,
    groupCount: 0,
  });
  const [showConnectionCard, setShowConnectionCard] = useState(false);
  const [showRenderDiagnosticsCard, setShowRenderDiagnosticsCard] = useState(false);
  const [unhandledGatewayError, setUnhandledGatewayError] = useState<UnhandledGatewayError | null>(null);
  const [lastRpcFailure, setLastRpcFailure] = useState<GatewayRpcFailure | null>(null);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(null);
  const statusLogRef = useRef<string | null>(null);
  const rpcLogRef = useRef<string | null>(null);
  const unhandledLogRef = useRef<string | null>(null);
  const selectionMenuRef = useRef<HTMLDivElement | null>(null);

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

  const clearArtifactAutoOpenTimers = useCallback(() => {
    if (artifactAutoOpenTimerRef.current != null) {
      window.clearTimeout(artifactAutoOpenTimerRef.current);
      artifactAutoOpenTimerRef.current = null;
    }
    artifactAutoOpenBurstTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    artifactAutoOpenBurstTimersRef.current = [];
  }, []);

  const tryAutoOpenArtifactCard = useCallback(() => {
    const host = hostRef.current;
    const state = artifactAutoOpenStateRef.current;
    if (!host || state.pendingRunSequence == null) {
      return false;
    }

    const candidate = findLatestArtifactToolCard(host);
    if (!candidate) {
      if (state.pendingScanCount >= 12) {
        state.pendingRunSequence = null;
      }
      return false;
    }

    const signature = buildToolCardSignature(candidate);
    const token = `${state.pendingRunSequence}:${signature}`;
    if (state.lastOpenedToken === token) {
      state.pendingRunSequence = null;
      return true;
    }

    state.lastOpenedToken = token;
    state.pendingRunSequence = null;
    candidate.click();
    return true;
  }, []);

  const queueArtifactAutoOpenScan = useCallback(
    (delay = 80) => {
      if (artifactAutoOpenTimerRef.current != null) {
        window.clearTimeout(artifactAutoOpenTimerRef.current);
      }
      artifactAutoOpenTimerRef.current = window.setTimeout(() => {
        artifactAutoOpenTimerRef.current = null;
        artifactAutoOpenStateRef.current.pendingScanCount += 1;
        tryAutoOpenArtifactCard();
      }, delay);
    },
    [tryAutoOpenArtifactCard],
  );

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
    artifactAutoOpenStateRef.current = {
      lastBusy: false,
      runSequence: 0,
      pendingRunSequence: null,
      pendingScanCount: 0,
      lastOpenedToken: null,
    };
    clearArtifactAutoOpenTimers();
  }, [clearArtifactAutoOpenTimers, sessionKey]);

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
      initialScrollScheduledRef.current = false;
      app.connect();
    }
  }, [gatewayPassword, gatewayToken, gatewayUrl, sessionKey]);

  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (!reason || typeof reason !== 'object') {
        return;
      }

      const detailCode =
        typeof (reason as { details?: { code?: unknown } }).details?.code === 'string'
          ? String((reason as { details?: { code?: unknown } }).details?.code)
          : null;
      const codeValue = (reason as { code?: unknown }).code;
      const messageValue = (reason as { message?: unknown }).message;
      const httpStatusValue = (reason as { httpStatus?: unknown }).httpStatus;
      const code =
        typeof codeValue === 'number' || typeof codeValue === 'string' ? String(codeValue) : null;
      const message =
        typeof messageValue === 'string' && messageValue.trim()
          ? messageValue
          : reason instanceof Error
            ? reason.message
            : 'Unhandled promise rejection';
      const httpStatus = typeof httpStatusValue === 'number' ? httpStatusValue : null;

      let raw: string | null = null;
      try {
        raw = JSON.stringify(reason);
      } catch {
        raw = String(reason);
      }

      const lowerMessage = message.toLowerCase();
      const lowerRaw = raw?.toLowerCase() ?? '';
      const looksRelevant =
        code === '403' ||
        detailCode !== null ||
        lowerMessage.includes('forbidden') ||
        lowerRaw.includes('openclaw') ||
        lowerRaw.includes('gateway') ||
        lowerRaw.includes('"code":403');

      if (!looksRelevant) {
        return;
      }

      console.error('[iclaw][openclaw-unhandled]', {
        message,
        code,
        detailCode,
        httpStatus,
        raw,
      });
      setUnhandledGatewayError({
        message,
        code,
        detailCode,
        httpStatus,
        raw,
      });
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const app = appRef.current;
      const client = app?.client;
      if (!app || !client || typeof client.request !== 'function') {
        return;
      }

      const currentRequest = client.request as (((method: string, params?: unknown) => Promise<unknown>) & {
        __iclawWrapped?: boolean;
      });

      if (currentRequest.__iclawWrapped) {
        return;
      }

      const wrappedRequest = (async (method: string, params?: unknown) => {
        try {
          return await currentRequest.call(client, method, params);
        } catch (error) {
          const detailCode =
            typeof (error as { details?: { code?: unknown } }).details?.code === 'string'
              ? String((error as { details?: { code?: unknown } }).details?.code)
              : null;
          const codeValue = (error as { code?: unknown }).code;
          const messageValue = (error as { message?: unknown }).message;
          const code =
            typeof codeValue === 'number' || typeof codeValue === 'string' ? String(codeValue) : null;
          const message =
            typeof messageValue === 'string' && messageValue.trim()
              ? messageValue
              : error instanceof Error
                ? error.message
                : String(error);

          if (code === '403' || detailCode !== null || message.toLowerCase().includes('forbidden')) {
            console.error('[iclaw][openclaw-rpc-failure]', {
              method,
              code,
              detailCode,
              message,
              params,
            });
            setLastRpcFailure({
              method,
              code,
              detailCode,
              message,
            });
          }
          throw error;
        }
      }) as typeof currentRequest;

      wrappedRequest.__iclawWrapped = true;
      client.request = wrappedRequest;
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const rewriteReferenceMarkers = () => {
      const textNodes = host.querySelectorAll('.chat-group.user .chat-text');
      textNodes.forEach((container) => {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        const pending: Text[] = [];
        while (walker.nextNode()) {
          const current = walker.currentNode;
          if (!(current instanceof Text)) {
            continue;
          }
          if (!current.nodeValue || !REFERENCE_MARKER_PATTERN.test(current.nodeValue)) {
            REFERENCE_MARKER_PATTERN.lastIndex = 0;
            continue;
          }
          REFERENCE_MARKER_PATTERN.lastIndex = 0;
          pending.push(current);
        }

        pending.forEach((node) => {
          const source = node.nodeValue ?? '';
          const fragment = document.createDocumentFragment();
          let lastIndex = 0;
          let match: RegExpExecArray | null = null;
          REFERENCE_MARKER_PATTERN.lastIndex = 0;

          while ((match = REFERENCE_MARKER_PATTERN.exec(source)) !== null) {
            const leading = source.slice(lastIndex, match.index);
            if (leading) {
              fragment.append(document.createTextNode(leading));
            }
            fragment.append(createReferenceChip(match[1].trim()));
            lastIndex = match.index + match[0].length;
          }

          const trailing = source.slice(lastIndex);
          if (trailing) {
            fragment.append(document.createTextNode(trailing));
          }
          node.parentNode?.replaceChild(fragment, node);
          REFERENCE_MARKER_PATTERN.lastIndex = 0;
        });
      });
    };

    rewriteReferenceMarkers();
    const observer = new MutationObserver(() => {
      rewriteReferenceMarkers();
    });
    observer.observe(host, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (artifactAutoOpenStateRef.current.pendingRunSequence == null) {
        return;
      }
      queueArtifactAutoOpenScan(90);
    });
    observer.observe(host, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [queueArtifactAutoOpenScan]);

  useEffect(() => {
    const authRole = appRef.current?.hello?.auth?.role ?? null;
    const authScopes = appRef.current?.hello?.auth?.scopes ?? null;
    const snapshot = JSON.stringify({
      connected: status.connected,
      lastError: status.lastError,
      lastErrorCode: status.lastErrorCode,
      authRole,
      authScopes,
    });
    if (statusLogRef.current === snapshot) {
      return;
    }
    statusLogRef.current = snapshot;
    console.info('[iclaw][openclaw-status]', {
      connected: status.connected,
      lastError: status.lastError,
      lastErrorCode: status.lastErrorCode,
      authRole,
      authScopes,
    });
  }, [status.connected, status.lastError, status.lastErrorCode]);

  useEffect(() => {
    if (!lastRpcFailure) {
      return;
    }
    const snapshot = JSON.stringify(lastRpcFailure);
    if (rpcLogRef.current === snapshot) {
      return;
    }
    rpcLogRef.current = snapshot;
    console.warn('[iclaw][openclaw-last-rpc-failure]', lastRpcFailure);
  }, [lastRpcFailure]);

  useEffect(() => {
    if (!unhandledGatewayError) {
      return;
    }
    const snapshot = JSON.stringify(unhandledGatewayError);
    if (unhandledLogRef.current === snapshot) {
      return;
    }
    unhandledLogRef.current = snapshot;
    console.warn('[iclaw][openclaw-last-unhandled]', unhandledGatewayError);
  }, [unhandledGatewayError]);

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
    const state = artifactAutoOpenStateRef.current;

    if (status.busy && !state.lastBusy) {
      state.runSequence += 1;
      state.pendingRunSequence = null;
      state.pendingScanCount = 0;
    } else if (!status.busy && state.lastBusy) {
      state.pendingRunSequence = state.runSequence;
      state.pendingScanCount = 0;
      clearArtifactAutoOpenTimers();
      [60, 220, 700, 1400].forEach((delay) => {
        const timer = window.setTimeout(() => {
          artifactAutoOpenStateRef.current.pendingScanCount += 1;
          tryAutoOpenArtifactCard();
        }, delay);
        artifactAutoOpenBurstTimersRef.current.push(timer);
      });
    }

    state.lastBusy = status.busy;
  }, [clearArtifactAutoOpenTimers, status.busy, tryAutoOpenArtifactCard]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const app = appRef.current;
      const host = hostRef.current;
      if (!app || !host) {
        return;
      }

      const nextStatus: ChatSurfaceStatus = {
        busy: Boolean(app.chatSending || app.chatRunId),
        connected: Boolean(app.connected),
        lastError: app.lastError ?? null,
        lastErrorCode: app.lastErrorCode ?? null,
      };
      const nativeInput = host.querySelector('.agent-chat__input, .chat-compose');
      const thread = host.querySelector('.chat-thread');
      const nativeInputState = isVisibleElement(nativeInput);
      const threadState = isVisibleElement(thread);
      const nextRenderState: ChatSurfaceRenderState = {
        hostHeight: Math.round(host.getBoundingClientRect().height),
        hasNativeInput: Boolean(nativeInput),
        nativeInputVisible: nativeInputState.visible,
        nativeInputHeight: nativeInputState.height,
        hasThread: Boolean(thread),
        threadVisible: threadState.visible,
        threadHeight: threadState.height,
        groupCount: host.querySelectorAll('.chat-group').length,
      };
      setStatus((current) =>
        current.busy === nextStatus.busy &&
        current.connected === nextStatus.connected &&
        current.lastError === nextStatus.lastError &&
        current.lastErrorCode === nextStatus.lastErrorCode
          ? current
          : nextStatus,
      );
      setRenderState((current) =>
        current.hostHeight === nextRenderState.hostHeight &&
        current.hasNativeInput === nextRenderState.hasNativeInput &&
        current.nativeInputVisible === nextRenderState.nativeInputVisible &&
        current.nativeInputHeight === nextRenderState.nativeInputHeight &&
        current.hasThread === nextRenderState.hasThread &&
        current.threadVisible === nextRenderState.threadVisible &&
        current.threadHeight === nextRenderState.threadHeight &&
        current.groupCount === nextRenderState.groupCount
          ? current
          : nextRenderState,
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
      clearArtifactAutoOpenTimers();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [clearArtifactAutoOpenTimers, status.connected]);

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
        x: Math.max(
          CHAT_SELECTION_MENU_GAP,
          Math.min(event.clientX, window.innerWidth - CHAT_SELECTION_MENU_WIDTH - CHAT_SELECTION_MENU_GAP),
        ),
        y: Math.max(
          CHAT_SELECTION_MENU_GAP,
          Math.min(event.clientY, window.innerHeight - CHAT_SELECTION_MENU_HEIGHT - CHAT_SELECTION_MENU_GAP),
        ),
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

    const handleViewportChange = () => {
      closeSelectionMenu();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('blur', handleViewportChange);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('blur', handleViewportChange);
    };
  }, [closeSelectionMenu, resolveChatSelection, selectionMenu]);

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
    const threadReady = renderState.hasThread && renderState.threadVisible;
    if (!shellAuthenticated || !status.connected || threadReady) {
      setShowRenderDiagnosticsCard(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowRenderDiagnosticsCard(true);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    renderState.hasNativeInput,
    renderState.hasThread,
    renderState.nativeInputVisible,
    renderState.threadVisible,
    shellAuthenticated,
    status.connected,
  ]);

  const hasGatewayAuth = Boolean((gatewayToken ?? '').trim() || (gatewayPassword ?? '').trim());
  const connectionMessage = status.lastError
    ? status.lastError
    : hasGatewayAuth
      ? '正在连接 OpenClaw 网关…'
      : '缺少本地网关凭据，当前无法连接 OpenClaw。';
  const threadReady = renderState.hasThread && renderState.threadVisible;
  const surfaceReady = shellAuthenticated && status.connected && threadReady;
  const showBootMask = shellAuthenticated && !surfaceReady;
  const secureContextHint =
    typeof window !== 'undefined' && !window.isSecureContext
      ? '当前页面不是安全上下文，OpenClaw 可能会拒绝设备身份校验。'
      : null;
  const authRole = appRef.current?.hello?.auth?.role ?? null;
  const authScopes = appRef.current?.hello?.auth?.scopes ?? null;

  useEffect(() => {
    window.__ICLAW_OPENCLAW_DIAGNOSTICS__ = {
      connected: status.connected,
      lastError: status.lastError,
      lastErrorCode: status.lastErrorCode,
      renderState,
      unhandledGatewayError,
      lastRpcFailure,
      authRole,
      authScopes,
      gatewayUrl,
      hasGatewayAuth,
      shellAuthenticated,
    };
  }, [
    authRole,
    authScopes,
    gatewayUrl,
    hasGatewayAuth,
    lastRpcFailure,
    renderState,
    shellAuthenticated,
    status.connected,
    status.lastError,
    status.lastErrorCode,
    unhandledGatewayError,
  ]);

  const renderDiagnosticsMessage = (() => {
    if (unhandledGatewayError?.code === '403') {
      return '当前页面捕获到了未处理的 403。更像是 OpenClaw 某个初始化或刷新请求被 gateway 拒绝，不是纯样式白板。';
    }
    if (renderState.hasThread && !renderState.threadVisible) {
      return 'OpenClaw 已连接，聊天线程节点已挂载，但在当前页面中不可见。更像是容器尺寸或样式兼容问题。';
    }
    if (renderState.hasThread || renderState.groupCount > 0) {
      return 'OpenClaw 已连接，但聊天线程没有进入稳定可见态。更像是前端可见性或布局兼容问题，不是账户登录失败。';
    }
    return 'OpenClaw 已连接，但聊天线程和输入区都没有渲染出来。更像是当前浏览器实例中的嵌入层兼容问题。';
  })();

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

  const handleSelectionAction = useCallback((trailingText: string) => {
    if (!selectionMenu) {
      return;
    }
    composerRef.current?.insertReference(selectionMenu.text, {
      label: selectionMenu.label,
      trailingText,
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

  return (
    <div ref={shellRef} className="openclaw-chat-surface-shell h-full flex-1 overflow-hidden">
      <div ref={hostRef} className="openclaw-chat-surface h-full min-h-0 flex-1 overflow-hidden" />

      {showBootMask ? (
        <div className="iclaw-chat-boot-mask" role="status" aria-live="polite">
          <span className="iclaw-chat-boot-mask__sr-only">
            {status.lastError ? '聊天界面恢复失败，正在等待重连' : '正在恢复聊天界面'}
          </span>
          <div className="iclaw-chat-skeleton" aria-hidden="true">
            <div className="iclaw-chat-skeleton__header">
              <div className="iclaw-chat-skeleton__dot" />
              <div className="iclaw-chat-skeleton__title" />
              <div className="iclaw-chat-skeleton__meta" />
            </div>
            <div className="iclaw-chat-skeleton__thread">
              <div className="iclaw-chat-skeleton__group iclaw-chat-skeleton__group--assistant">
                <div className="iclaw-chat-skeleton__avatar" />
                <div className="iclaw-chat-skeleton__stack">
                  <div className="iclaw-chat-skeleton__line iclaw-chat-skeleton__line--wide" />
                  <div className="iclaw-chat-skeleton__line iclaw-chat-skeleton__line--medium" />
                  <div className="iclaw-chat-skeleton__line iclaw-chat-skeleton__line--short" />
                </div>
              </div>
              <div className="iclaw-chat-skeleton__group iclaw-chat-skeleton__group--user">
                <div className="iclaw-chat-skeleton__stack iclaw-chat-skeleton__stack--user">
                  <div className="iclaw-chat-skeleton__bubble iclaw-chat-skeleton__bubble--long" />
                  <div className="iclaw-chat-skeleton__bubble iclaw-chat-skeleton__bubble--short" />
                </div>
                <div className="iclaw-chat-skeleton__avatar iclaw-chat-skeleton__avatar--user" />
              </div>
              <div className="iclaw-chat-skeleton__group iclaw-chat-skeleton__group--assistant">
                <div className="iclaw-chat-skeleton__avatar" />
                <div className="iclaw-chat-skeleton__stack">
                  <div className="iclaw-chat-skeleton__line iclaw-chat-skeleton__line--medium" />
                  <div className="iclaw-chat-skeleton__line iclaw-chat-skeleton__line--wide" />
                </div>
              </div>
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

      <RichChatComposer ref={composerRef} connected={status.connected} busy={status.busy} onSend={handleSend} onAbort={handleAbort} />

      {showRenderDiagnosticsCard ? (
        <div className="iclaw-chat-render-card" role="status" aria-live="polite">
          <div className="iclaw-chat-state-card__eyebrow">渲染诊断</div>
          <div className="iclaw-chat-state-card__title">{renderDiagnosticsMessage}</div>
          <div className="iclaw-chat-state-card__meta">
            shell 登录：{shellAuthenticated ? '已登录' : '未登录'} · gateway 认证：
            {hasGatewayAuth ? '已配置' : '缺失'}
          </div>
          <div className="iclaw-chat-state-card__meta">
            gateway 连接：{status.connected ? '已连接' : '未连接'} · 输入区：
            {renderState.hasNativeInput ? (renderState.nativeInputVisible ? '可见' : '已挂载但不可见') : '未渲染'} ·
            线程：{renderState.hasThread ? (renderState.threadVisible ? '可见' : '已挂载但不可见') : '未渲染'} ·
            消息组：{renderState.groupCount}
          </div>
          <div className="iclaw-chat-state-card__meta">
            网关错误码：{status.lastErrorCode ?? '无'} · 最近未捕获错误码：{unhandledGatewayError?.code ?? '无'} ·
            详情码：{unhandledGatewayError?.detailCode ?? '无'}
          </div>
          <div className="iclaw-chat-state-card__meta">
            最近失败 RPC：{lastRpcFailure?.method ?? '无'} · RPC 错误码：{lastRpcFailure?.code ?? '无'} ·
            RPC 详情码：{lastRpcFailure?.detailCode ?? '无'}
          </div>
          <div className="iclaw-chat-state-card__meta">
            gateway 角色：{authRole ?? '未知'} · scopes：
            {authScopes && authScopes.length > 0 ? authScopes.join(', ') : '未知'}
          </div>
          <div className="iclaw-chat-state-card__meta">
            容器高度：{renderState.hostHeight}px · 输入区高度：{renderState.nativeInputHeight}px · 线程高度：
            {renderState.threadHeight}px
          </div>
          {unhandledGatewayError ? (
            <div className="iclaw-chat-state-card__meta">
              最近未捕获错误：{unhandledGatewayError.message}
              {unhandledGatewayError.httpStatus != null ? ` · httpStatus=${unhandledGatewayError.httpStatus}` : ''}
            </div>
          ) : null}
          {lastRpcFailure ? (
            <div className="iclaw-chat-state-card__meta">
              最近失败 RPC 信息：{lastRpcFailure.message}
            </div>
          ) : null}
        </div>
      ) : null}

      {selectionMenu ? (
        <div
          ref={selectionMenuRef}
          className="iclaw-chat-selection-menu"
          style={{ left: selectionMenu.x, top: selectionMenu.y }}
          role="menu"
          aria-label="选中文本操作"
        >
          <button type="button" className="iclaw-chat-selection-menu__item" onClick={() => handleSelectionAction('')}>
            <MessageSquarePlus className="iclaw-chat-selection-menu__icon" />
            追问
          </button>
          <button type="button" className="iclaw-chat-selection-menu__item" onClick={() => handleSelectionAction('请总结这段内容的要点。')}>
            <ScrollText className="iclaw-chat-selection-menu__icon" />
            总结
          </button>
          <button type="button" className="iclaw-chat-selection-menu__item" onClick={() => handleSelectionAction('请用更容易理解的话解释这段内容。')}>
            <MessageCircleQuestionMark className="iclaw-chat-selection-menu__icon" />
            解释
          </button>
          <button type="button" className="iclaw-chat-selection-menu__item" onClick={() => void handleSelectionCopy()}>
            <Copy className="iclaw-chat-selection-menu__icon" />
            复制
          </button>
        </div>
      ) : null}
    </div>
  );
}
