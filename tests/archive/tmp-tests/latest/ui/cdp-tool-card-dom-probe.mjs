const LOGIN_URL = 'http://127.0.0.1:2130/auth/login';
const VERSION_URL = 'http://127.0.0.1:9223/json/version';
const LIST_URL = 'http://127.0.0.1:9223/json/list';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const ACCESS_KEY = 'iclaw:auth.access_token';
const REFRESH_KEY = 'iclaw:auth.refresh_token';
const IDENTIFIER = process.env.ICLAW_IDENTIFIER || '515177265@qq.com';
const PASSWORD = process.env.ICLAW_PASSWORD || 'glp200663024';

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 1;
    this.pending = new Map();
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !this.pending.has(message.id)) {
        return;
      }
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(message.error);
        return;
      }
      resolve(message.result);
    });
  }

  async open() {
    if (this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.id++;
    const payload = { id, method, params };
    if (sessionId) {
      payload.sessionId = sessionId;
    }
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  close() {
    this.ws.close();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readBrowserWebSocketUrl() {
  const response = await fetch(VERSION_URL);
  const payload = await response.json();
  return payload.webSocketDebuggerUrl;
}

async function readPageWebSocketUrl() {
  const response = await fetch(LIST_URL);
  const pages = await response.json();
  return pages.find((page) => String(page.url || '').includes('127.0.0.1:1520'))?.webSocketDebuggerUrl ?? null;
}

async function login() {
  const response = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: IDENTIFIER,
      email: IDENTIFIER,
      password: PASSWORD,
    }),
  });
  const payload = await response.json();
  return payload.data.tokens;
}

async function evaluateJson(cdp, sessionId, expression) {
  const result = await cdp.send(
    'Runtime.evaluate',
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );
  return result.result?.value;
}

async function waitFor(cdp, sessionId, predicate, timeoutMs = 90000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await sleep(800);
  }
  throw new Error('Timed out');
}

const pageWsUrl = await readPageWebSocketUrl();
const browserWsUrl = await readBrowserWebSocketUrl();
const targetUrl = pageWsUrl || browserWsUrl;
const tokens = await login();
const cdp = new CDP(targetUrl);
await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');

if (!pageWsUrl) {
  await cdp.send('Page.navigate', { url: APP_URL });
  await sleep(1200);
  await evaluateJson(
    cdp,
    undefined,
    `(() => {
      localStorage.setItem(${JSON.stringify(ACCESS_KEY)}, ${JSON.stringify(tokens.access_token)});
      localStorage.setItem(${JSON.stringify(REFRESH_KEY)}, ${JSON.stringify(tokens.refresh_token)});
      return true;
    })()`,
  );
  await cdp.send('Page.reload', { ignoreCache: true });
  await waitFor(cdp, undefined, async () => evaluateJson(cdp, undefined, `(() => !!document.querySelector('openclaw-app')?.connected)()`));
}

const snapshot = await evaluateJson(
  cdp,
  undefined,
  `(() => {
    function describe(node) {
      if (!(node instanceof HTMLElement)) {
        return null;
      }
      const style = getComputedStyle(node);
      return {
        tag: node.tagName,
        className: node.className,
        text: (node.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 220),
        width: style.width,
        maxWidth: style.maxWidth,
        display: style.display,
        position: style.position,
        background: style.backgroundColor,
        border: style.borderColor,
        radius: style.borderRadius,
        outerWidth: node.getBoundingClientRect().width,
      };
    }
    const summary = document.querySelector('.openclaw-chat-surface .chat-tools-summary');
    const card = document.querySelector('.openclaw-chat-surface .chat-tool-card:not([hidden])');
    return {
      summary: describe(summary),
      summaryParent: describe(summary?.parentElement),
      summaryGrandParent: describe(summary?.parentElement?.parentElement),
      summaryGreatGrandParent: describe(summary?.parentElement?.parentElement?.parentElement),
      summaryGreatGreatGrandParent: describe(summary?.parentElement?.parentElement?.parentElement?.parentElement),
      card: describe(card),
      cardParent: describe(card?.parentElement),
      cardGrandParent: describe(card?.parentElement?.parentElement),
      cardGreatGrandParent: describe(card?.parentElement?.parentElement?.parentElement),
      cardGreatGreatGrandParent: describe(card?.parentElement?.parentElement?.parentElement?.parentElement),
    };
  })()`,
);

console.log(JSON.stringify(snapshot, null, 2));

cdp.close();
