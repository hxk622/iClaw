const LOGIN_URL = 'http://127.0.0.1:2130/auth/login';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const ACCESS_KEY = 'iclaw:auth.access_token';
const REFRESH_KEY = 'iclaw:auth.refresh_token';
const IDENTIFIER = process.env.ICLAW_IDENTIFIER || '515177265@qq.com';
const PASSWORD = process.env.ICLAW_PASSWORD || 'glp200663024';
const VIEWPORT_WIDTH = Number(process.env.ICLAW_VIEWPORT_WIDTH || 1280);
const VIEWPORT_HEIGHT = Number(process.env.ICLAW_VIEWPORT_HEIGHT || 900);

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
    this.handlers = new Map();
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(msg.error);
          return;
        }
        resolve(msg.result);
        return;
      }
      if (!msg.method) return;
      const list = this.handlers.get(msg.method);
      if (!list) return;
      for (const handler of list) handler(msg.params || {});
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

  on(method, handler) {
    const list = this.handlers.get(method) || [];
    list.push(handler);
    this.handlers.set(method, list);
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

const wsUrl = await getPageWsUrl();
const tokens = await login();
const cdp = new CDP(wsUrl);

const requestById = new Map();
const networkEvents = [];
const consoleEvents = [];
const pageErrors = [];

await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('DOM.enable');
await cdp.send('Log.enable');
await cdp.send('Network.enable');
await cdp.send('Console.enable').catch(() => {});
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: VIEWPORT_WIDTH,
  height: VIEWPORT_HEIGHT,
  deviceScaleFactor: 1,
  mobile: false,
});

cdp.on('Network.requestWillBeSent', (params) => {
  requestById.set(params.requestId, {
    url: params.request?.url || null,
    method: params.request?.method || null,
  });
});

cdp.on('Network.responseReceived', (params) => {
  const request = requestById.get(params.requestId) || {};
  const url = request.url || params.response?.url || null;
  const status = params.response?.status;
  if (
    url &&
    (url.includes('127.0.0.1:1520') || url.includes('127.0.0.1:2126') || url.includes('127.0.0.1:2130')) &&
    (status >= 400 || url.includes('__openclaw/control-ui-config.json'))
  ) {
    networkEvents.push({
      url,
      method: request.method || null,
      status,
      statusText: params.response?.statusText || null,
      mimeType: params.response?.mimeType || null,
    });
  }
});

cdp.on('Runtime.consoleAPICalled', (params) => {
  consoleEvents.push({
    type: params.type || null,
    args: (params.args || []).map((arg) => arg.value ?? arg.description ?? null),
    stack: params.stackTrace?.callFrames?.slice(0, 6) || [],
  });
});

cdp.on('Runtime.exceptionThrown', (params) => {
  pageErrors.push({
    text: params.exceptionDetails?.text || null,
    url: params.exceptionDetails?.url || null,
    lineNumber: params.exceptionDetails?.lineNumber ?? null,
    columnNumber: params.exceptionDetails?.columnNumber ?? null,
    exception:
      params.exceptionDetails?.exception?.value ??
      params.exceptionDetails?.exception?.description ??
      null,
    stack: params.exceptionDetails?.stackTrace?.callFrames?.slice(0, 8) || [],
  });
});

await cdp.send('Page.navigate', { url: APP_URL });
await sleep(1200);

await evalJSON(
  cdp,
  `(() => {
    localStorage.setItem(${JSON.stringify(ACCESS_KEY)}, ${JSON.stringify(tokens.access_token)});
    localStorage.setItem(${JSON.stringify(REFRESH_KEY)}, ${JSON.stringify(tokens.refresh_token)});
    window.__iclawUnhandled = [];
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      let value = null;
      try {
        value = JSON.stringify(reason);
      } catch {
        value = String(reason);
      }
      window.__iclawUnhandled.push({
        type: typeof reason,
        name: reason?.name || null,
        message: reason?.message || null,
        code: reason?.code || reason?.gatewayCode || null,
        httpStatus: reason?.httpStatus ?? null,
        httpError: reason?.httpError ?? null,
        httpStatusText: reason?.httpStatusText ?? null,
        detail: value,
        stack: reason?.stack || null
      });
    });
    return {
      access: localStorage.getItem(${JSON.stringify(ACCESS_KEY)})?.slice(0, 12) || null,
      refresh: localStorage.getItem(${JSON.stringify(REFRESH_KEY)})?.slice(0, 12) || null
    };
  })()`,
);

await cdp.send('Page.reload', { ignoreCache: true });
await sleep(6000);

const snapshot = await evalJSON(
  cdp,
  `(() => {
    const authPanel = Array.from(document.querySelectorAll('div')).find((el) =>
      (el.textContent || '').includes('登录以继续使用账户与额度体系') &&
      getComputedStyle(el).position === 'fixed'
    );
    const app = document.querySelector('openclaw-app');
    const chatThread = document.querySelector('.openclaw-chat-surface .chat-thread');
    const nativeInput =
      document.querySelector('.openclaw-chat-surface .agent-chat__input') ||
      document.querySelector('.openclaw-chat-surface .chat-compose');
    const rootText = (document.getElementById('root')?.textContent || '').replace(/\\s+/g, ' ').trim();
    return {
      href: location.href,
      title: document.title,
      authPanel: authPanel ? {
        opacity: getComputedStyle(authPanel).opacity,
        pointerEvents: getComputedStyle(authPanel).pointerEvents,
        text: (authPanel.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 160)
      } : null,
      openclawApp: app ? {
        connected: !!app.connected,
        lastError: app.lastError || null,
        lastErrorCode: app.lastErrorCode || null,
        tab: app.tab || null,
        sessionKey: app.sessionKey || null
      } : null,
      chatGroupCount: document.querySelectorAll('.openclaw-chat-surface .chat-group').length,
      hasNativeInput: !!nativeInput,
      nativeInputText: nativeInput ? (nativeInput.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120) : null,
      hasThread: !!chatThread,
      threadTextSample: chatThread ? (chatThread.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 300) : null,
      rootTextSample: rootText.slice(0, 300),
      localStorageKeys: Object.keys(localStorage).sort(),
      unhandled: window.__iclawUnhandled || []
    };
  })()`,
);

console.log(
  JSON.stringify(
    {
      snapshot,
      networkEvents,
      consoleEvents,
      pageErrors,
    },
    null,
    2,
  ),
);

cdp.close();
