(function () {
  const ROOT_ID = 'iclaw-extension-capture-root';
  const TOGGLE_MESSAGE_TYPE = 'ICLAW_EXTENSION_TOGGLE_PANEL';
  const REQUEST_DESKTOP_SESSION_MESSAGE_TYPE = 'ICLAW_EXTENSION_REQUEST_DESKTOP_SESSION';
  const REFRESH_DESKTOP_SESSION_MESSAGE_TYPE = 'ICLAW_EXTENSION_REFRESH_DESKTOP_SESSION';
  const IMPORT_MESSAGE_TYPE = 'iclaw-knowledge-library-import-raw';
  const AUTH_STORAGE_KEY = 'iclaw_extension_auth_state_v1';
  const EXTENSION_ID = 'iclaw-browser-extension';
  const BRAND_ID = 'iclaw';
  const REQUESTED_SCOPE = ['knowledge.raw.read', 'knowledge.raw.write', 'profile.basic.read'];

  let panelVisible = false;
  let authState = {
    phase: 'idle', // idle | checking | ready | grant_required | desktop_not_logged_in | desktop_unavailable | error
    message: '等待桌面端授权',
    userName: '',
    checkedAt: 0,
    session: null,
  };

  function getStorage() {
    try {
      return chrome?.storage?.local || null;
    } catch {
      return null;
    }
  }

  function storageGet(key) {
    return new Promise((resolve) => {
      const storage = getStorage();
      if (!storage?.get) {
        resolve(undefined);
        return;
      }
      storage.get(key, (items) => resolve(items?.[key]));
    });
  }

  function storageSet(items) {
    return new Promise((resolve) => {
      const storage = getStorage();
      if (!storage?.set) {
        resolve(false);
        return;
      }
      storage.set(items, () => resolve(!chrome.runtime?.lastError));
    });
  }

  function buildDeviceId() {
    const host = String(window.location.host || 'unknown-host').trim() || 'unknown-host';
    return `browser::${host}`;
  }

  function randomToken() {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function normalizeSelectionText() {
    const selection = window.getSelection();
    if (!selection) return '';
    return String(selection.toString() || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
  }

  function detectSourceType() {
    const href = String(window.location.href || '').toLowerCase();
    if (href.includes('youtube.com') || href.includes('youtu.be') || href.includes('bilibili.com') || href.includes('douyin.com')) {
      return 'video';
    }
    return 'text';
  }

  function detectSourceName() {
    const host = String(window.location.hostname || '').trim();
    if (!host) return '网页';
    return host;
  }

  function getPageExcerpt() {
    const candidates = [document.querySelector('article'), document.querySelector('main'), document.body].filter(Boolean);
    const root = candidates[0];
    const text = String(root?.innerText || '').replace(/\s+/g, ' ').trim();
    return text.slice(0, 360);
  }

  function postRawImport(payload) {
    window.postMessage(
      {
        type: IMPORT_MESSAGE_TYPE,
        payload,
        source: 'iclaw-extension',
      },
      '*',
    );
  }

  function buildSourcePayload() {
    return {
      version: 1,
      kind: 'source',
      title: document.title || window.location.href,
      excerpt: getPageExcerpt(),
      text: '',
      url: window.location.href,
      sourceName: detectSourceName(),
      sourceType: detectSourceType(),
      sourceIcon: 'web',
      tags: ['网页', '采集'],
      dedupeKey: `source::${window.location.href.replace(/#.*$/, '')}`,
    };
  }

  function buildSnippetPayload() {
    const selectionText = normalizeSelectionText();
    if (!selectionText) return null;
    return {
      version: 1,
      kind: 'snippet',
      title: selectionText.slice(0, 60),
      excerpt: selectionText.slice(0, 200),
      text: selectionText,
      url: window.location.href,
      sourceName: detectSourceName(),
      sourceType: detectSourceType(),
      sourceIcon: 'web',
      tags: ['摘录', '网页'],
      dedupeKey: `snippet::${window.location.href.replace(/#.*$/, '')}::${selectionText.toLowerCase()}`,
    };
  }

  function isCaptureReady() {
    return authState.phase === 'ready';
  }

  function isSessionUsable(session) {
    if (!session || typeof session !== 'object') return false;
    const expiresAt = Number(session.expiresAt || 0);
    return Number.isFinite(expiresAt) && expiresAt > Date.now() + 15_000;
  }

  function isRefreshUsable(session) {
    if (!session || typeof session !== 'object') return false;
    const refreshExpiresAt = Number(session.refreshExpiresAt || 0);
    return Number.isFinite(refreshExpiresAt) && refreshExpiresAt > Date.now() + 15_000 && typeof session.refreshToken === 'string' && session.refreshToken.trim();
  }

  function authBadgeText() {
    switch (authState.phase) {
      case 'checking':
        return '检测中';
      case 'ready':
        return '已连接';
      case 'grant_required':
        return '待授权';
      case 'desktop_not_logged_in':
        return '未登录';
      case 'desktop_unavailable':
        return '未连接';
      case 'error':
        return '异常';
      default:
        return '等待中';
    }
  }

  function authThemeMode() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  }

  function statusConfig() {
    switch (authState.phase) {
      case 'checking':
        return {
          badge: '检测中',
          badgeTone: 'blue',
          title: '正在检测桌面端...',
          description: '请稍候，正在尝试连接 iClaw 桌面应用',
          primaryText: '连接桌面端',
          primaryDisabled: true,
          secondaryText: '重新检测',
          secondaryDisabled: true,
          hint: '首次使用需要打开 iClaw 桌面端并登录',
          captureDisabled: true,
        };
      case 'desktop_unavailable':
        return {
          badge: '未连接',
          badgeTone: 'muted',
          title: '桌面端未启动',
          description: '未检测到 iClaw 桌面应用运行',
          primaryText: '连接桌面端',
          primaryDisabled: true,
          secondaryText: '重新检测',
          secondaryDisabled: false,
          hint: '请先启动 iClaw 桌面端，然后点击“重新检测”',
          captureDisabled: true,
        };
      case 'desktop_not_logged_in':
        return {
          badge: '未登录',
          badgeTone: 'amber',
          title: '桌面端未登录',
          description: '检测到 iClaw 桌面端，但尚未登录账号',
          primaryText: '连接桌面端',
          primaryDisabled: true,
          secondaryText: '重新检测',
          secondaryDisabled: false,
          hint: '请在桌面端登录后，点击“重新检测”',
          captureDisabled: true,
        };
      case 'grant_required':
        return {
          badge: '待授权',
          badgeTone: 'purple',
          title: '需要首次授权',
          description: '桌面端已就绪，请在桌面端确认授权',
          primaryText: '连接桌面端',
          primaryDisabled: false,
          secondaryText: '重新检测',
          secondaryDisabled: false,
          hint: '点击“连接桌面端”后，在 iClaw 桌面端授权一次；后续会自动记住',
          captureDisabled: true,
        };
      case 'ready':
        return {
          badge: '已连接',
          badgeTone: 'emerald',
          title: '授权成功',
          description: authState.userName ? `已连接到 iClaw 桌面端 · ${authState.userName}` : '已连接到 iClaw 桌面端，可以开始采集',
          primaryText: '连接桌面端',
          primaryDisabled: true,
          secondaryText: '重新检测',
          secondaryDisabled: false,
          hint: '授权关系已保存，后续使用无需重新授权',
          captureDisabled: false,
        };
      default:
        return {
          badge: '等待中',
          badgeTone: 'muted',
          title: '等待桌面端授权',
          description: '插件正式使用依赖桌面端授权桥',
          primaryText: '连接桌面端',
          primaryDisabled: false,
          secondaryText: '重新检测',
          secondaryDisabled: false,
          hint: '正式用户路径：打开 iClaw 桌面端并登录，再授权一次；后续会自动记住',
          captureDisabled: true,
        };
    }
  }

  function authMessageText() {
    if (authState.phase === 'ready') {
      return authState.userName ? `已连接桌面端 · ${authState.userName}` : '已连接桌面端，可发送素材';
    }
    if (authState.phase === 'grant_required') {
      return '桌面端需要你确认授权。请查看 iClaw 桌面端弹窗，然后回来重试。';
    }
    if (authState.phase === 'desktop_not_logged_in') {
      return '请先打开 iClaw 桌面端并登录账号。';
    }
    if (authState.phase === 'desktop_unavailable') {
      return '未检测到本地桌面桥。请确认 iClaw 桌面端已启动。';
    }
    if (authState.phase === 'error') {
      return authState.message || '桌面授权桥异常，请稍后重试。';
    }
    if (authState.phase === 'checking') {
      return '正在检测桌面端登录与授权状态...';
    }
    return '插件正式使用依赖桌面端授权桥。';
  }

  async function persistAuthState() {
    await storageSet({ [AUTH_STORAGE_KEY]: authState });
  }

  async function hydrateAuthState() {
    const saved = await storageGet(AUTH_STORAGE_KEY);
    if (!saved || typeof saved !== 'object') return;
    authState = {
      ...authState,
      ...saved,
    };
  }

  function normalizeSessionPayload(session) {
    if (!session || typeof session !== 'object') return null;
    const accessToken = String(session.access_token || '').trim();
    const refreshToken = String(session.refresh_token || '').trim();
    const expiresIn = Number(session.expires_in || 0);
    const refreshExpiresIn = Number(session.refresh_expires_in || 0);
    if (!accessToken || !refreshToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      return null;
    }
    return {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
      refreshExpiresAt: Number.isFinite(refreshExpiresIn) && refreshExpiresIn > 0 ? Date.now() + refreshExpiresIn * 1000 : Date.now() + 7 * 24 * 3600 * 1000,
      userName: String(session?.user?.name || session?.user?.email || '').trim(),
      grantId: String(session.grant_id || '').trim(),
      scope: Array.isArray(session.scope) ? session.scope : [],
    };
  }

  async function requestDesktopSession() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: REQUEST_DESKTOP_SESSION_MESSAGE_TYPE,
            payload: {
              extension_id: EXTENSION_ID,
              brand_id: BRAND_ID,
              device_id: buildDeviceId(),
              browser_family: 'chrome',
              browser_profile_id: 'default',
              requested_scope: REQUESTED_SCOPE,
              challenge: randomToken(),
              nonce: randomToken(),
              version: '0.1.0',
            },
          },
          (response) => {
            if (chrome.runtime?.lastError) {
              resolve({ ok: false, error: 'DESKTOP_APP_NOT_READY' });
              return;
            }
            resolve(response || { ok: false, error: 'DESKTOP_APP_NOT_READY' });
          },
        );
      } catch {
        resolve({ ok: false, error: 'DESKTOP_APP_NOT_READY' });
      }
    });
  }

  async function refreshDesktopSession(refreshToken) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: REFRESH_DESKTOP_SESSION_MESSAGE_TYPE,
            payload: {
              refresh_token: String(refreshToken || '').trim(),
            },
          },
          (response) => {
            if (chrome.runtime?.lastError) {
              resolve({ ok: false, error: 'DESKTOP_APP_NOT_READY' });
              return;
            }
            resolve(response || { ok: false, error: 'DESKTOP_APP_NOT_READY' });
          },
        );
      } catch {
        resolve({ ok: false, error: 'DESKTOP_APP_NOT_READY' });
      }
    });
  }

  async function syncAuthState() {
    if (isSessionUsable(authState.session)) {
      authState = {
        ...authState,
        phase: 'ready',
        message: '已连接桌面端',
        userName: authState.session.userName || authState.userName || '',
        checkedAt: Date.now(),
      };
      await persistAuthState();
      renderState();
      return;
    }

    if (isRefreshUsable(authState.session)) {
      authState = {
        ...authState,
        phase: 'checking',
        message: '正在刷新插件会话...',
        checkedAt: Date.now(),
      };
      await persistAuthState();
      renderState();
      const refreshed = await refreshDesktopSession(authState.session.refreshToken);
      if (refreshed?.ok && refreshed?.session) {
        const normalizedSession = normalizeSessionPayload(refreshed.session);
        authState = {
          ...authState,
          phase: 'ready',
          message: '已连接桌面端',
          userName: normalizedSession?.userName || authState.userName || '',
          checkedAt: Date.now(),
          session: normalizedSession,
        };
        await persistAuthState();
        renderState();
        return;
      }
    }

    authState = {
      phase: 'checking',
      message: '正在检测桌面端授权状态...',
      userName: authState.userName || '',
      checkedAt: Date.now(),
      session: authState.session || null,
    };
    await persistAuthState();
    renderState();

    const result = await requestDesktopSession();
    if (result?.ok && result?.session) {
      const normalizedSession = normalizeSessionPayload(result.session);
      authState = {
        phase: 'ready',
        message: '已连接桌面端',
        userName: normalizedSession?.userName || String(result.session?.user?.name || result.session?.user?.email || '').trim(),
        checkedAt: Date.now(),
        session: normalizedSession,
      };
      await persistAuthState();
      renderState();
      return;
    }

    const error = String(result?.error || 'UNKNOWN_ERROR');
    if (error === 'GRANT_CONFIRMATION_REQUIRED') {
      authState = {
        phase: 'grant_required',
        message: '桌面端需要确认授权',
        userName: '',
        checkedAt: Date.now(),
        session: null,
      };
    } else if (error === 'DESKTOP_NOT_LOGGED_IN') {
      authState = {
        phase: 'desktop_not_logged_in',
        message: '桌面端未登录',
        userName: '',
        checkedAt: Date.now(),
        session: null,
      };
    } else if (error === 'DESKTOP_APP_NOT_READY') {
      authState = {
        phase: 'desktop_unavailable',
        message: '未检测到本地桌面桥',
        userName: '',
        checkedAt: Date.now(),
        session: authState.session || null,
      };
    } else {
      authState = {
        phase: 'error',
        message: error,
        userName: '',
        checkedAt: Date.now(),
        session: authState.session || null,
      };
    }
    await persistAuthState();
    renderState();
  }

  function createRoot() {
    const existing = document.getElementById(ROOT_ID);
    if (existing) return existing;

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.style.position = 'fixed';
    root.style.right = '16px';
    root.style.bottom = '16px';
    root.style.zIndex = '2147483647';
    root.style.display = 'none';
    root.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';

    const shadow = root.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host, .theme-root {
          --bg: #f7f7f8;
          --card: #ffffff;
          --text-primary: #111111;
          --text-secondary: #6b7280;
          --text-tertiary: #8b8f97;
          --border: #e5e7eb;
          --button-primary: #111111;
          --button-primary-text: #ffffff;
          --button-secondary: #f1f2f4;
          --button-secondary-text: #1a1b1f;
          --button-secondary-border: #d7d9dd;
          --section-bg: rgba(17, 17, 17, 0.03);
          --shadow: 0 18px 42px rgba(15, 23, 42, 0.18);
        }
        .theme-root[data-theme='dark'] {
          --bg: #0b0b0c;
          --card: #141416;
          --text-primary: #f5f5f5;
          --text-secondary: #a1a1aa;
          --text-tertiary: #71717a;
          --border: #2a2a2e;
          --button-primary: #f5f5f5;
          --button-primary-text: #111111;
          --button-secondary: rgba(255,255,255,0.06);
          --button-secondary-text: #f4f4f5;
          --button-secondary-border: rgba(255,255,255,0.10);
          --section-bg: rgba(255,255,255,0.05);
          --shadow: 0 18px 42px rgba(0,0,0,0.32);
        }
        .panel {
          width: 292px;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: color-mix(in srgb, var(--card) 96%, transparent);
          color: var(--text-primary);
          box-shadow: var(--shadow);
          overflow: hidden;
          backdrop-filter: blur(16px);
        }
        .head {
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
          font-weight: 600;
        }
        .head-main {
          display:flex;
          align-items:center;
          gap:8px;
        }
        .badge {
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-width: 44px;
          height: 22px;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          border: 1px solid transparent;
        }
        .badge[data-tone='blue'] {
          background: rgba(59, 130, 246, 0.16);
          color: #93c5fd;
          border-color: rgba(59, 130, 246, 0.24);
        }
        .theme-root[data-theme='light'] .badge[data-tone='blue'] {
          background: rgba(59, 130, 246, 0.10);
          color: #1d4ed8;
          border-color: rgba(59, 130, 246, 0.18);
        }
        .badge[data-tone='muted'] {
          background: rgba(113, 113, 122, 0.18);
          color: var(--text-secondary);
          border-color: rgba(113, 113, 122, 0.18);
        }
        .badge[data-tone='amber'] {
          background: rgba(245, 158, 11, 0.16);
          color: #fcd34d;
          border-color: rgba(245, 158, 11, 0.24);
        }
        .theme-root[data-theme='light'] .badge[data-tone='amber'] {
          background: rgba(245, 158, 11, 0.10);
          color: #b45309;
          border-color: rgba(245, 158, 11, 0.18);
        }
        .badge[data-tone='purple'] {
          background: rgba(168, 85, 247, 0.16);
          color: #d8b4fe;
          border-color: rgba(168, 85, 247, 0.24);
        }
        .theme-root[data-theme='light'] .badge[data-tone='purple'] {
          background: rgba(168, 85, 247, 0.10);
          color: #7e22ce;
          border-color: rgba(168, 85, 247, 0.18);
        }
        .badge[data-tone='emerald'] {
          background: rgba(16, 185, 129, 0.16);
          color: #86efac;
          border-color: rgba(16, 185, 129, 0.24);
        }
        .theme-root[data-theme='light'] .badge[data-tone='emerald'] {
          background: rgba(16, 185, 129, 0.10);
          color: #047857;
          border-color: rgba(16, 185, 129, 0.18);
        }
        .body {
          padding: 12px;
          display:flex;
          flex-direction:column;
          gap: 12px;
        }
        .section {
          display:flex;
          flex-direction:column;
          gap: 8px;
          padding: 10px;
          border-radius: 14px;
          background: var(--section-bg);
          border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
        }
        .section-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-tertiary);
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .desc {
          font-size: 12px;
          line-height: 1.6;
          color: var(--text-secondary);
        }
        .actions {
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        button {
          appearance:none;
          border: 1px solid transparent;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 160ms ease, border-color 160ms ease, color 160ms ease, opacity 160ms ease;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        .primary {
          background: var(--button-primary);
          color: var(--button-primary-text);
        }
        .primary:hover:not(:disabled) {
          opacity: 0.94;
        }
        .secondary {
          background: var(--button-secondary);
          color: var(--button-secondary-text);
          border-color: var(--button-secondary-border);
        }
        .secondary:hover:not(:disabled) {
          opacity: 0.94;
        }
        .status {
          min-height: 18px;
          font-size: 11px;
          color: var(--text-tertiary);
        }
        .hint {
          font-size: 11px;
          line-height: 1.6;
          color: var(--text-tertiary);
        }
      </style>
      <div class="theme-root" data-theme="${authThemeMode()}">
      <div class="panel">
        <div class="head">
          <div class="head-main">
            <span>iClaw Capture</span>
            <span id="authBadge" class="badge" data-tone="muted">等待中</span>
          </div>
          <button id="closeBtn" class="secondary" style="padding:6px 10px; border-radius:10px;">关闭</button>
        </div>
        <div class="body">
          <div class="section">
            <div class="section-title">授权状态</div>
            <div id="authTitle" class="desc" style="font-weight:600; color:var(--text-primary);">等待桌面端授权</div>
            <div id="authMessage" class="desc">插件正式使用依赖桌面端授权桥。</div>
            <div class="actions">
              <button id="connectBtn" class="primary">连接桌面端</button>
              <button id="retryBtn" class="secondary">重新检测</button>
            </div>
            <div id="authHint" class="hint">正式用户路径：打开 iClaw 桌面端并登录，再授权一次；后续会自动记住。</div>
          </div>
          <div class="section">
            <div class="section-title">采集</div>
            <div class="desc">把当前网页或划词内容送进 iClaw 知识库的 Raw / 素材。</div>
            <div class="actions">
              <button id="savePageBtn" class="primary">保存页面</button>
              <button id="saveSnippetBtn" class="secondary">发送摘录</button>
            </div>
            <div id="status" class="status">等待操作</div>
          </div>
        </div>
      </div>
      </div>
    `;

    const authBadge = shadow.getElementById('authBadge');
    const authTitle = shadow.getElementById('authTitle');
    const authHint = shadow.getElementById('authHint');
    const authMessage = shadow.getElementById('authMessage');
    const status = shadow.getElementById('status');
    const savePageBtn = shadow.getElementById('savePageBtn');
    const saveSnippetBtn = shadow.getElementById('saveSnippetBtn');
    const closeBtn = shadow.getElementById('closeBtn');
    const connectBtn = shadow.getElementById('connectBtn');
    const retryBtn = shadow.getElementById('retryBtn');

    savePageBtn?.addEventListener('click', () => {
      if (!isCaptureReady()) {
        if (status) status.textContent = '请先连接桌面端并完成授权';
        return;
      }
      postRawImport(buildSourcePayload());
      if (status) status.textContent = '已发送页面素材到 iClaw';
    });

    saveSnippetBtn?.addEventListener('click', () => {
      if (!isCaptureReady()) {
        if (status) status.textContent = '请先连接桌面端并完成授权';
        return;
      }
      const payload = buildSnippetPayload();
      if (!payload) {
        if (status) status.textContent = '请先在页面中选择一段文字';
        return;
      }
      postRawImport(payload);
      if (status) status.textContent = '已发送摘录到 iClaw';
    });

    connectBtn?.addEventListener('click', () => {
      void syncAuthState();
    });

    retryBtn?.addEventListener('click', () => {
      void syncAuthState();
    });

    closeBtn?.addEventListener('click', () => {
      panelVisible = false;
      root.style.display = 'none';
    });

    root.__iclawRefs = { authBadge, authTitle, authHint, authMessage, status, savePageBtn, saveSnippetBtn, connectBtn, retryBtn };
    document.documentElement.appendChild(root);
    return root;
  }

  function renderState() {
    const root = createRoot();
    const refs = root.__iclawRefs || {};
    const config = statusConfig();
    if (refs.authBadge) {
      refs.authBadge.textContent = config.badge;
      refs.authBadge.setAttribute('data-tone', config.badgeTone);
    }
    if (refs.authTitle) refs.authTitle.textContent = config.title;
    if (refs.authMessage) refs.authMessage.textContent = config.description;
    if (refs.authHint) refs.authHint.textContent = config.hint;
    if (refs.savePageBtn) refs.savePageBtn.disabled = config.captureDisabled;
    if (refs.saveSnippetBtn) refs.saveSnippetBtn.disabled = config.captureDisabled;
    if (refs.connectBtn) {
      refs.connectBtn.disabled = config.primaryDisabled;
      refs.connectBtn.textContent = config.primaryText;
    }
    if (refs.retryBtn) {
      refs.retryBtn.disabled = config.secondaryDisabled;
      refs.retryBtn.textContent = config.secondaryText;
    }
  }

  function setPanelVisible(nextVisible) {
    panelVisible = nextVisible;
    const root = createRoot();
    root.style.display = nextVisible ? 'block' : 'none';
    renderState();
    if (nextVisible) {
      void syncAuthState();
    }
  }

  function togglePanel() {
    setPanelVisible(!panelVisible);
  }

  void hydrateAuthState().then(() => {
    createRoot();
    renderState();
  });

  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === TOGGLE_MESSAGE_TYPE) {
        togglePanel();
        sendResponse({ ok: true, visible: panelVisible });
        return true;
      }
      return false;
    });
  } catch {
    // ignore extension context errors during reload
  }
})();
