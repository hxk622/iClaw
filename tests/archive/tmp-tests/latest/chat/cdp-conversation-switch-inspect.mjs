const LOGIN_URL = 'http://127.0.0.1:2130/auth/login';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const ACCESS_KEY = 'iclaw:auth.access_token';
const REFRESH_KEY = 'iclaw:auth.refresh_token';
const IDENTIFIER = process.env.ICLAW_IDENTIFIER || '515177265@qq.com';
const PASSWORD = process.env.ICLAW_PASSWORD || 'glp200663024';

async function getPageWsUrl() {
  const res = await fetch(CDP_LIST_URL);
  const pages = await res.json();
  const page =
    pages.find((item) => typeof item?.url === 'string' && item.url.includes('127.0.0.1:1520')) || pages[0];
  if (!page?.webSocketDebuggerUrl) {
    throw new Error(`No debuggable page found in ${CDP_LIST_URL}`);
  }
  return page.webSocketDebuggerUrl;
}

async function login() {
  const res = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: IDENTIFIER,
      email: IDENTIFIER,
      password: PASSWORD,
    }),
  });
  const json = await res.json();
  const tokens = json?.data?.tokens;
  if (!res.ok || !tokens?.access_token || !tokens?.refresh_token) {
    throw new Error(`login failed: ${JSON.stringify(json)}`);
  }
  return tokens;
}

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 1;
    this.pending = new Map();
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (!msg.id || !this.pending.has(msg.id)) return;
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) {
        reject(msg.error);
        return;
      }
      resolve(msg.result);
    });
  }

  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  close() {
    this.ws.close();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evalJson(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

async function waitFor(cdp, label, predicate, timeoutMs = 20000, intervalMs = 500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const wsUrl = await getPageWsUrl();
const tokens = await login();
const cdp = new CDP(wsUrl);

await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('DOM.enable');
await cdp.send('Page.navigate', { url: APP_URL });
await sleep(1200);

await evalJson(
  cdp,
  `(() => {
    localStorage.setItem(${JSON.stringify(ACCESS_KEY)}, ${JSON.stringify(tokens.access_token)});
    localStorage.setItem(${JSON.stringify(REFRESH_KEY)}, ${JSON.stringify(tokens.refresh_token)});
    return true;
  })()`,
);

await cdp.send('Page.reload', { ignoreCache: true });

await waitFor(
  cdp,
  'recent conversations',
  async () =>
    evalJson(
      cdp,
      `(() => {
        const items = Array.from(document.querySelectorAll('button')).filter((button) => {
          const text = (button.textContent || '').replace(/\\s+/g, ' ').trim();
          return text && button.closest('.space-y-1');
        });
        return items.length >= 2;
      })()`,
    ),
  30000,
  1000,
);

const before = await evalJson(
  cdp,
  `(() => {
    const sidebar = Array.from(document.querySelectorAll('div')).find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width >= 250 && rect.width <= 270 && rect.height >= window.innerHeight - 4;
    }) || null;
    const header = Array.from(document.querySelectorAll('header')).find((el) => el.getBoundingClientRect().height >= 45) || null;
    const recentButtons = Array.from(document.querySelectorAll('.space-y-1 button'))
      .filter((button) => button.querySelector('svg'))
      .filter((button) => !String(button.getAttribute('aria-label') || '').includes('更多操作'));
    const firstConversationButton = recentButtons[0] || null;
    const secondConversationButton = recentButtons[1] || null;
    const smartChatButton = Array.from(document.querySelectorAll('button')).find((button) =>
      (button.textContent || '').replace(/\\s+/g, ' ').includes('智能对话')
    ) || null;
    const avatarButton = sidebar ? Array.from(sidebar.querySelectorAll('button')).find((button) => {
      const text = (button.textContent || '').replace(/\\s+/g, ' ').trim();
      return text && !text.includes('新建对话') && !text.includes('历史对话') && !text.includes('智能对话');
    }) || null : null;
    const root = document.getElementById('root');
    const visibleMasks = Array.from(document.querySelectorAll('[data-session-transitioning=\"true\"], [data-surface-reactivating=\"true\"]')).map((el) => ({
      className: el.className,
      transitioning: el.getAttribute('data-session-transitioning'),
      reactivating: el.getAttribute('data-surface-reactivating'),
    }));

    window.__switchInspect = {
      sidebar,
      header,
      smartChatButton,
      avatarButton,
      firstConversationButton,
      secondConversationButton,
      mutations: [],
    };

    const observer = new MutationObserver((records) => {
      window.__switchInspect.mutations.push(...records.map((record) => ({
        type: record.type,
        targetTag: record.target instanceof Element ? record.target.tagName : null,
        targetClass: record.target instanceof Element ? record.target.className : null,
        addedCount: record.addedNodes.length,
        removedCount: record.removedNodes.length,
        attributeName: record.attributeName || null,
      })));
    });
    observer.observe(root || document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-session-transitioning', 'data-surface-reactivating'],
    });
    window.__switchInspect.observer = observer;

    return {
      sidebarFound: Boolean(sidebar),
      headerFound: Boolean(header),
      recentTexts: recentButtons.slice(0, 5).map((button) => (button.textContent || '').replace(/\\s+/g, ' ').trim()),
      visibleMasks,
      smartChatText: smartChatButton ? (smartChatButton.textContent || '').replace(/\\s+/g, ' ').trim() : null,
      avatarText: avatarButton ? (avatarButton.textContent || '').replace(/\\s+/g, ' ').trim() : null,
    };
  })()`,
);

await evalJson(
  cdp,
  `(() => {
    const target = window.__switchInspect?.secondConversationButton;
    if (!target) {
      return false;
    }
    target.click();
    return true;
  })()`,
);

await sleep(1200);

const after = await evalJson(
  cdp,
  `(() => {
    const state = window.__switchInspect;
    state?.observer?.disconnect?.();
    const sidebar = state?.sidebar || null;
    const header = state?.header || null;
    const smartChatButton = state?.smartChatButton || null;
    const avatarButton = state?.avatarButton || null;
    const secondConversationButton = state?.secondConversationButton || null;
    const root = document.getElementById('root');
    const allMasks = Array.from(document.querySelectorAll('[data-session-transitioning], [data-surface-reactivating], .fixed, .absolute')).slice(0, 40).map((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        className: String(el.className || ''),
        position: style.position,
        zIndex: style.zIndex,
        opacity: style.opacity,
        display: style.display,
        visibility: style.visibility,
        background: style.backgroundColor,
        width: rect.width,
        height: rect.height,
      };
    }).filter((entry) => entry.width > 0 && entry.height > 0);

    return {
      sameSidebarNode: sidebar ? sidebar === Array.from(document.querySelectorAll('div')).find((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width >= 250 && rect.width <= 270 && rect.height >= window.innerHeight - 4;
      }) : false,
      sameHeaderNode: header ? header === Array.from(document.querySelectorAll('header')).find((el) => el.getBoundingClientRect().height >= 45) : false,
      sidebarStillConnected: Boolean(sidebar?.isConnected),
      headerStillConnected: Boolean(header?.isConnected),
      smartChatStillConnected: Boolean(smartChatButton?.isConnected),
      avatarStillConnected: Boolean(avatarButton?.isConnected),
      secondConversationStillConnected: Boolean(secondConversationButton?.isConnected),
      smartChatClass: smartChatButton?.className || null,
      avatarClass: avatarButton?.className || null,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      rootBackground: root ? getComputedStyle(root).backgroundColor : null,
      mutations: state?.mutations?.slice(0, 120) || [],
      allMasks,
    };
  })()`,
);

console.log(JSON.stringify({ before, after }, null, 2));
cdp.close();
