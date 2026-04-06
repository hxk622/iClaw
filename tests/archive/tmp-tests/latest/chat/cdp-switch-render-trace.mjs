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
      if (msg.error) reject(msg.error);
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

async function evalJSON(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

async function waitFor(label, predicate, timeoutMs = 45000, intervalMs = 500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function clickButtonByExactText(cdp, text) {
  return evalJSON(
    cdp,
    `(() => {
      const button = Array.from(document.querySelectorAll('button')).find((node) =>
        (node.textContent || '').replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)}
      );
      button?.click();
      return Boolean(button);
    })()`,
  );
}

async function sendPrompt(cdp, prompt) {
  await evalJSON(
    cdp,
    `(() => {
      const editor = document.querySelector('.iclaw-composer__editor');
      editor?.focus();
      return Boolean(editor);
    })()`,
  );
  await cdp.send('Input.insertText', { text: prompt });
  await sleep(150);
  await evalJSON(
    cdp,
    `(() => {
      const submit = document.querySelector('.iclaw-composer__submit');
      submit?.click();
      return Boolean(submit);
    })()`,
  );
}

async function waitForRecentConversation(cdp, labelPrefix) {
  return waitFor(
    `recent conversation ${labelPrefix}`,
    async () =>
      evalJSON(
        cdp,
        `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const taskButton = buttons.find((button) => {
            const text = (button.textContent || '').replace(/\\s+/g, ' ').trim();
            return text.includes(${JSON.stringify(labelPrefix)}) && button.closest('.group.relative');
          });
          return taskButton ? (taskButton.textContent || '').replace(/\\s+/g, ' ').trim() : null;
        })()`,
      ),
    60000,
    1000,
  );
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

await evalJSON(
  cdp,
  `(() => {
    localStorage.setItem(${JSON.stringify(ACCESS_KEY)}, ${JSON.stringify(tokens.access_token)});
    localStorage.setItem(${JSON.stringify(REFRESH_KEY)}, ${JSON.stringify(tokens.refresh_token)});
    return true;
  })()`,
);

await cdp.send('Page.reload', { ignoreCache: true });

await waitFor(
  'chat surface ready',
  async () =>
    evalJSON(
      cdp,
      `(() => Boolean(document.querySelector('.openclaw-chat-surface')) && Boolean(document.querySelector('.iclaw-composer__editor')))()`,
    ),
  30000,
  500,
);

const promptA = `侧栏切换排查A ${Date.now()}`;
await sendPrompt(cdp, promptA);
const recentA = await waitForRecentConversation(cdp, '侧栏切换排查A');

await clickButtonByExactText(cdp, '新建对话');
await sleep(1000);

const promptB = `侧栏切换排查B ${Date.now()}`;
await sendPrompt(cdp, promptB);
const recentB = await waitForRecentConversation(cdp, '侧栏切换排查B');

const beforeSwitch = await evalJSON(
  cdp,
  `(() => {
    const sidebar = Array.from(document.querySelectorAll('div')).find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width >= 250 && rect.width <= 270 && rect.height >= window.innerHeight - 4;
    }) || null;
    const header = Array.from(document.querySelectorAll('header')).find((el) => el.getBoundingClientRect().height >= 45) || null;
    window.__ICLAW_RENDER_TRACE__ = [];
    window.__ICLAW_SWITCH_OBS__ = {
      sidebar,
      header,
      records: [],
    };
    const observer = new MutationObserver((records) => {
      window.__ICLAW_SWITCH_OBS__.records.push(...records.map((record) => ({
        type: record.type,
        targetTag: record.target instanceof Element ? record.target.tagName : null,
        targetClass: record.target instanceof Element ? String(record.target.className || '') : null,
        addedCount: record.addedNodes.length,
        removedCount: record.removedNodes.length,
        attributeName: record.attributeName || null,
      })));
    });
    observer.observe(document.getElementById('root') || document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-session-transitioning', 'data-surface-reactivating'],
    });
    window.__ICLAW_SWITCH_OBS__.observer = observer;
    return {
      recentA: ${JSON.stringify(recentA)},
      recentB: ${JSON.stringify(recentB)},
    };
  })()`,
);

await evalJSON(
  cdp,
  `(() => {
    const button = Array.from(document.querySelectorAll('button')).find((node) => {
      const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
      return text.includes(${JSON.stringify(recentA)}) && node.closest('.group.relative');
    });
    button?.click();
    return Boolean(button);
  })()`,
);

await sleep(2000);

const afterSwitch = await evalJSON(
  cdp,
  `(() => {
    const state = window.__ICLAW_SWITCH_OBS__;
    state?.observer?.disconnect?.();
    const sidebar = Array.from(document.querySelectorAll('div')).find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width >= 250 && rect.width <= 270 && rect.height >= window.innerHeight - 4;
    }) || null;
    const header = Array.from(document.querySelectorAll('header')).find((el) => el.getBoundingClientRect().height >= 45) || null;
    return {
      sameSidebarNode: Boolean(state?.sidebar && state.sidebar === sidebar),
      sameHeaderNode: Boolean(state?.header && state.header === header),
      sidebarConnected: Boolean(state?.sidebar?.isConnected),
      headerConnected: Boolean(state?.header?.isConnected),
      renderTrace: Array.isArray(window.__ICLAW_RENDER_TRACE__) ? window.__ICLAW_RENDER_TRACE__ : [],
      mutations: Array.isArray(state?.records) ? state.records.slice(0, 200) : [],
      sessionMasks: Array.from(document.querySelectorAll('[data-session-transitioning], [data-surface-reactivating]')).map((el) => ({
        className: String(el.className || ''),
        transitioning: el.getAttribute('data-session-transitioning'),
        reactivating: el.getAttribute('data-surface-reactivating'),
      })),
    };
  })()`,
);

console.log(JSON.stringify({ beforeSwitch, afterSwitch }, null, 2));
cdp.close();
