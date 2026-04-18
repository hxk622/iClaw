(function () {
  const ROOT_ID = 'iclaw-extension-capture-root';
  const TOGGLE_MESSAGE_TYPE = 'ICLAW_EXTENSION_TOGGLE_PANEL';
  const REQUEST_DESKTOP_SESSION_MESSAGE_TYPE = 'ICLAW_EXTENSION_REQUEST_DESKTOP_SESSION';
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

  async function syncAuthState() {
    authState = {
      phase: 'checking',
      message: '正在检测桌面端授权状态...',
      userName: authState.userName || '',
      checkedAt: Date.now(),
    };
    await persistAuthState();
    renderState();

    const result = await requestDesktopSession();
    if (result?.ok && result?.session) {
      authState = {
        phase: 'ready',
        message: '已连接桌面端',
        userName: String(result.session?.user?.name || result.session?.user?.email || '').trim(),
        checkedAt: Date.now(),
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
      };
    } else if (error === 'DESKTOP_NOT_LOGGED_IN') {
      authState = {
        phase: 'desktop_not_logged_in',
        message: '桌面端未登录',
        userName: '',
        checkedAt: Date.now(),
      };
    } else if (error === 'DESKTOP_APP_NOT_READY') {
      authState = {
        phase: 'desktop_unavailable',
        message: '未检测到本地桌面桥',
        userName: '',
        checkedAt: Date.now(),
      };
    } else {
      authState = {
        phase: 'error',
        message: error,
        userName: '',
        checkedAt: Date.now(),
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
        .panel {
          width: 292px;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 18px;
          background: rgba(16,16,18,0.96);
          color: #f4f4f5;
          box-shadow: 0 18px 42px rgba(0,0,0,0.32);
          overflow: hidden;
          backdrop-filter: blur(16px);
        }
        .head {
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
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
          background: rgba(255,255,255,0.10);
          color: rgba(255,255,255,0.88);
          font-size: 10px;
          font-weight: 700;
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
          background: rgba(255,255,255,0.05);
        }
        .section-title {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255,255,255,0.78);
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .desc {
          font-size: 12px;
          line-height: 1.6;
          color: rgba(255,255,255,0.72);
        }
        .actions {
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        button {
          appearance:none;
          border:none;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        .primary { background: #f5c26b; color: #111827; }
        .secondary { background: rgba(255,255,255,0.08); color: #f4f4f5; }
        .status {
          min-height: 18px;
          font-size: 11px;
          color: rgba(255,255,255,0.58);
        }
        .hint {
          font-size: 11px;
          line-height: 1.6;
          color: rgba(255,255,255,0.56);
        }
      </style>
      <div class="panel">
        <div class="head">
          <div class="head-main">
            <span>iClaw Capture</span>
            <span id="authBadge" class="badge">等待中</span>
          </div>
          <button id="closeBtn" class="secondary" style="padding:6px 10px; border-radius:10px;">关闭</button>
        </div>
        <div class="body">
          <div class="section">
            <div class="section-title">授权状态</div>
            <div id="authMessage" class="desc">插件正式使用依赖桌面端授权桥。</div>
            <div class="actions">
              <button id="connectBtn" class="primary">连接桌面端</button>
              <button id="retryBtn" class="secondary">重新检测</button>
            </div>
            <div class="hint">正式用户路径：打开 iClaw 桌面端并登录，再授权一次；后续会自动记住。</div>
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
    `;

    const authBadge = shadow.getElementById('authBadge');
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

    root.__iclawRefs = { authBadge, authMessage, status, savePageBtn, saveSnippetBtn, connectBtn, retryBtn };
    document.documentElement.appendChild(root);
    return root;
  }

  function renderState() {
    const root = createRoot();
    const refs = root.__iclawRefs || {};
    if (refs.authBadge) refs.authBadge.textContent = authBadgeText();
    if (refs.authMessage) refs.authMessage.textContent = authMessageText();
    if (refs.savePageBtn) refs.savePageBtn.disabled = !isCaptureReady();
    if (refs.saveSnippetBtn) refs.saveSnippetBtn.disabled = !isCaptureReady();
    if (refs.connectBtn) refs.connectBtn.disabled = authState.phase === 'checking';
    if (refs.retryBtn) refs.retryBtn.disabled = authState.phase === 'checking';
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
