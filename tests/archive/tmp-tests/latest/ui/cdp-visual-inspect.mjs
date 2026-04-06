const LOGIN_URL = 'http://127.0.0.1:2130/auth/login';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const ACCESS_KEY = 'iclaw:auth.access_token';
const REFRESH_KEY = 'iclaw:auth.refresh_token';
const IDENTIFIER = process.env.ICLAW_IDENTIFIER || '515177265@qq.com';
const PASSWORD = process.env.ICLAW_PASSWORD || 'glp200663024';
const SCREENSHOT_PATH = '/tmp/iclaw-chat-visual.png';
const VIEWPORT_WIDTH = Number(process.env.ICLAW_VIEWPORT_WIDTH || 1015);
const VIEWPORT_HEIGHT = Number(process.env.ICLAW_VIEWPORT_HEIGHT || 761);

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

async function evalJSON(cdp, expression) {
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
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: VIEWPORT_WIDTH,
  height: VIEWPORT_HEIGHT,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp.send('Page.navigate', { url: APP_URL });
await sleep(1200);

await evalJSON(
  cdp,
  `(() => {
    localStorage.setItem(${JSON.stringify(ACCESS_KEY)}, ${JSON.stringify(tokens.access_token)});
    localStorage.setItem(${JSON.stringify(REFRESH_KEY)}, ${JSON.stringify(tokens.refresh_token)});
    return {
      access: localStorage.getItem(${JSON.stringify(ACCESS_KEY)})?.slice(0, 12) || null,
      refresh: localStorage.getItem(${JSON.stringify(REFRESH_KEY)})?.slice(0, 12) || null
    };
  })()`,
);

await cdp.send('Page.reload', { ignoreCache: true });

await waitFor(
  cdp,
  'chat surface',
  async () =>
    evalJSON(
      cdp,
      `(() => !!document.querySelector('.openclaw-chat-surface') && !!document.querySelector('openclaw-app'))()`,
    ),
);

await waitFor(
  cdp,
  'chat content',
  async () =>
    evalJSON(
      cdp,
      `(() => document.querySelectorAll('.openclaw-chat-surface .chat-group').length > 0)()`,
    ),
  30000,
  1000,
).catch(() => null);

const snapshot = await evalJSON(
  cdp,
  `(() => {
    const authPanel = Array.from(document.querySelectorAll('div')).find((el) =>
      (el.textContent || '').includes('登录以继续使用账户与额度体系') &&
      getComputedStyle(el).position === 'fixed'
    );
    const app = document.querySelector('openclaw-app');
    const thread = document.querySelector('.openclaw-chat-surface .chat-thread');
    const header = document.querySelector('.openclaw-chat-surface .content-header');
    const composer = document.querySelector('.iclaw-composer');
    const root = document.getElementById('root');
    const atCenter = document.elementFromPoint(window.innerWidth / 2, Math.round(window.innerHeight / 2));
    const atHeader = document.elementFromPoint(window.innerWidth / 2, 24);
    const userTexts = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.user .chat-text'))
      .map((el) => el.textContent?.trim() || '')
      .filter(Boolean);
    const assistantTexts = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.assistant .chat-text'))
      .map((el) => el.textContent?.trim() || '')
      .filter(Boolean);
    const authStyle = authPanel ? getComputedStyle(authPanel) : null;
    const rootStyle = root ? getComputedStyle(root) : null;
    const threadStyle = thread ? getComputedStyle(thread) : null;
    const headerStyle = header ? getComputedStyle(header) : null;
    return {
      href: location.href,
      bodyClass: document.body.className,
      root: root ? {
        rect: root.getBoundingClientRect().toJSON(),
        background: rootStyle?.backgroundColor || null,
        color: rootStyle?.color || null
      } : null,
      authPanel: authPanel ? {
        textSample: (authPanel.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120),
        rect: authPanel.getBoundingClientRect().toJSON(),
        opacity: authStyle?.opacity || null,
        pointerEvents: authStyle?.pointerEvents || null,
        display: authStyle?.display || null,
        visibility: authStyle?.visibility || null,
        background: authStyle?.backgroundColor || null,
        zIndex: authStyle?.zIndex || null
      } : null,
      app: app ? {
        connected: !!app.connected,
        chatSending: !!app.chatSending,
        lastError: app.lastError || null
      } : null,
      thread: thread ? {
        rect: thread.getBoundingClientRect().toJSON(),
        background: threadStyle?.backgroundColor || null,
        color: threadStyle?.color || null,
        textLength: (thread.textContent || '').trim().length,
        textSample: (thread.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 300)
      } : null,
      header: header ? {
        rect: header.getBoundingClientRect().toJSON(),
        background: headerStyle?.backgroundColor || null,
        borderBottomColor: headerStyle?.borderBottomColor || null,
        borderBottomWidth: headerStyle?.borderBottomWidth || null
      } : null,
      composer: composer ? {
        rect: composer.getBoundingClientRect().toJSON(),
        text: (composer.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120)
      } : null,
      visibleAtCenter: atCenter ? {
        tag: atCenter.tagName,
        className: atCenter.className,
        text: (atCenter.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120)
      } : null,
      visibleAtHeader: atHeader ? {
        tag: atHeader.tagName,
        className: atHeader.className,
        text: (atHeader.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120)
      } : null,
      userTexts,
      assistantTexts,
      groupCount: document.querySelectorAll('.openclaw-chat-surface .chat-group').length
    };
  })()`,
);

const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
await import('node:fs/promises').then((fs) =>
  fs.writeFile(SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64')),
);

console.log(JSON.stringify({ snapshot, screenshot: SCREENSHOT_PATH }, null, 2));
cdp.close();
