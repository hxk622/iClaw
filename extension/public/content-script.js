(function () {
  const ROOT_ID = 'iclaw-extension-capture-root';
  const TOGGLE_MESSAGE_TYPE = 'ICLAW_EXTENSION_TOGGLE_PANEL';
  const IMPORT_MESSAGE_TYPE = 'iclaw-knowledge-library-import-raw';

  let panelVisible = false;

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
          width: 280px;
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
        .body {
          padding: 12px;
          display:flex;
          flex-direction:column;
          gap: 10px;
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
        .primary { background: #f5c26b; color: #111827; }
        .secondary { background: rgba(255,255,255,0.08); color: #f4f4f5; }
        .status {
          min-height: 18px;
          font-size: 11px;
          color: rgba(255,255,255,0.58);
        }
      </style>
      <div class="panel">
        <div class="head">
          <span>iClaw Capture</span>
          <button id="closeBtn" class="secondary" style="padding:6px 10px; border-radius:10px;">关闭</button>
        </div>
        <div class="body">
          <div class="desc">把当前网页或划词内容直接送进 iClaw 知识库的 Raw / 素材。</div>
          <div class="actions">
            <button id="savePageBtn" class="primary">保存页面</button>
            <button id="saveSnippetBtn" class="secondary">发送摘录</button>
          </div>
          <div id="status" class="status">等待操作</div>
        </div>
      </div>
    `;

    const status = shadow.getElementById('status');
    const savePageBtn = shadow.getElementById('savePageBtn');
    const saveSnippetBtn = shadow.getElementById('saveSnippetBtn');
    const closeBtn = shadow.getElementById('closeBtn');

    savePageBtn?.addEventListener('click', () => {
      postRawImport(buildSourcePayload());
      if (status) status.textContent = '已发送页面素材到 iClaw';
    });

    saveSnippetBtn?.addEventListener('click', () => {
      const payload = buildSnippetPayload();
      if (!payload) {
        if (status) status.textContent = '请先在页面中选择一段文字';
        return;
      }
      postRawImport(payload);
      if (status) status.textContent = '已发送摘录到 iClaw';
    });

    closeBtn?.addEventListener('click', () => {
      panelVisible = false;
      root.style.display = 'none';
    });

    document.documentElement.appendChild(root);
    return root;
  }

  function setPanelVisible(nextVisible) {
    panelVisible = nextVisible;
    const root = createRoot();
    root.style.display = nextVisible ? 'block' : 'none';
  }

  function togglePanel() {
    setPanelVisible(!panelVisible);
  }

  createRoot();

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
