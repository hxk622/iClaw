const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const ACTIVE_WORKSPACE_SCENE_STORAGE_KEY = 'iclaw.desktop.active-workspace-scene.v1';

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
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
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

async function evalJSON(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

async function waitFor(label, predicate, timeoutMs = 20000, intervalMs = 250) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function clickSelector(cdp, selector) {
  return evalJSON(
    cdp,
    `(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node) return false;
      node.click();
      return true;
    })()`,
  );
}

async function clickButtonByExactText(cdp, label) {
  return evalJSON(
    cdp,
    `(() => {
      const text = ${JSON.stringify(label)};
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find((button) => (button.textContent || '').replace(/\\s+/g, ' ').trim() === text);
      if (!target) return false;
      target.click();
      return true;
    })()`,
  );
}

async function resetGuestState(cdp) {
  await evalJSON(
    cdp,
    `(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(${JSON.stringify(ACTIVE_WORKSPACE_SCENE_STORAGE_KEY)}, JSON.stringify({ primaryView: 'chat' }));
      return true;
    })()`,
  );
  await cdp.send('Page.reload', { ignoreCache: true });
}

async function readState(cdp) {
  return evalJSON(
    cdp,
    `(() => {
      const bodyText = (document.body.innerText || '').replace(/\\s+/g, ' ').trim();
      const hasLoginModal = Boolean(document.querySelector('[aria-label="关闭登录弹窗"]'));
      const hasWelcome = bodyText.includes('我能为你做什么');
      const hasStockPage =
        bodyText.includes('股票市场') &&
        Boolean(document.querySelector('input[placeholder="搜索股票名称 / 代码"]'));
      return {
        hasLoginModal,
        hasWelcome,
        hasStockPage,
        bodySample: bodyText.slice(0, 320),
      };
    })()`,
  );
}

const wsUrl = await getPageWsUrl();
const cdp = new CDP(wsUrl);

await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('DOM.enable');
await cdp.send('Page.navigate', { url: APP_URL });
await sleep(1200);

await resetGuestState(cdp);

const initialState = await waitFor('initial welcome + login modal', async () => {
  const state = await readState(cdp);
  return state.hasWelcome && state.hasLoginModal ? state : null;
});

const closed = await clickSelector(cdp, '[aria-label="关闭登录弹窗"]');
if (!closed) {
  throw new Error('Failed to close initial login modal');
}

const afterCloseState = await waitFor('welcome remains after closing modal', async () => {
  const state = await readState(cdp);
  return state.hasWelcome && !state.hasLoginModal ? state : null;
});

const openedStockMarket = await clickButtonByExactText(cdp, '股票市场');
if (!openedStockMarket) {
  throw new Error('Failed to open 股票市场 as guest');
}

const stockState = await waitFor('stock market visible as guest', async () => {
  const state = await readState(cdp);
  return state.hasStockPage && !state.hasLoginModal ? state : null;
});

const openedAvatarMenu = await evalJSON(
  cdp,
  `(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((button) => (button.textContent || '').replace(/\\s+/g, ' ').trim().includes('点击登录解锁完整功能'));
    if (!target) return false;
    target.click();
    return true;
  })()`,
);
if (!openedAvatarMenu) {
  throw new Error('Failed to open avatar menu in guest mode');
}

const openedLoginFromMenu = await waitFor('avatar dropdown login item', async () => {
  const clicked = await clickButtonByExactText(cdp, '登录 / 注册');
  return clicked ? true : null;
});
if (!openedLoginFromMenu) {
  throw new Error('Failed to click 登录 / 注册');
}

const stockModalState = await waitFor('login modal over current stock page', async () => {
  const state = await readState(cdp);
  return state.hasLoginModal && state.hasStockPage ? state : null;
});

const result = {
  initialState,
  afterCloseState,
  stockState,
  stockModalState,
};

console.log(JSON.stringify(result, null, 2));
cdp.close();
