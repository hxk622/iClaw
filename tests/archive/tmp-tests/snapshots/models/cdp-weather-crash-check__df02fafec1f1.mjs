const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const PROMPT = '天津天气怎么样';

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const {resolve, reject} = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(msg.error);
          return;
        }
        resolve(msg.result);
        return;
      }
      if (!msg.method) {
        return;
      }
      const list = this.handlers.get(msg.method) || [];
      list.forEach((handler) => handler(msg.params || {}));
    });
  }

  async open() {
    if (this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, {once: true});
      this.ws.addEventListener('error', reject, {once: true});
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    this.ws.send(JSON.stringify({id, method, params}));
    return new Promise((resolve, reject) => this.pending.set(id, {resolve, reject}));
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

async function waitFor(predicate, timeoutMs = 45_000, intervalMs = 500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await predicate();
      if (value) {
        return value;
      }
    } catch {
      // Ignore transient navigation/runtime detach during page reloads.
    }
    await sleep(intervalMs);
  }
  throw new Error('Timed out waiting for page ready');
}

const pages = await (await fetch(CDP_LIST_URL)).json();
const target =
  pages.find((page) => String(page.url || '').includes('127.0.0.1:1520') && page.webSocketDebuggerUrl) || pages[0];
if (!target?.webSocketDebuggerUrl) {
  throw new Error(`No debuggable page found in ${CDP_LIST_URL}`);
}

const cdp = new CDP(target.webSocketDebuggerUrl);
const consoleEvents = [];
const exceptions = [];

await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('DOM.enable');
await cdp.send('Log.enable');

cdp.on('Runtime.consoleAPICalled', (params) => {
  consoleEvents.push({
    type: params.type || null,
    args: (params.args || []).map((arg) => arg.value ?? arg.description ?? null),
  });
});

cdp.on('Runtime.exceptionThrown', (params) => {
  exceptions.push({
    text: params.exceptionDetails?.text || null,
    url: params.exceptionDetails?.url || null,
    lineNumber: params.exceptionDetails?.lineNumber ?? null,
    columnNumber: params.exceptionDetails?.columnNumber ?? null,
    exception:
      params.exceptionDetails?.exception?.value ??
      params.exceptionDetails?.exception?.description ??
      null,
  });
});

await cdp.send('Page.navigate', {url: APP_URL});

await waitFor(async () =>
  evalJSON(
    cdp,
    `(() => {
      const app = document.querySelector('openclaw-app');
      const editor = document.querySelector('.iclaw-composer__editor');
      const submit = document.querySelector('.iclaw-composer__submit');
      return app?.connected && editor && submit ? true : null;
    })()`,
  ),
);

await evalJSON(
  cdp,
  `(() => {
    window.__iclawUnhandled = [];
    if (!window.__iclawUnhandledHooked) {
      window.__iclawUnhandledHooked = true;
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        let detail = null;
        try {
          detail = JSON.stringify(reason);
        } catch {
          detail = String(reason);
        }
        window.__iclawUnhandled.push({
          type: typeof reason,
          name: reason?.name || null,
          message: reason?.message || null,
          code: reason?.code || reason?.gatewayCode || null,
          detail,
          stack: reason?.stack || null,
        });
      });
    }
    return true;
  })()`,
);

await evalJSON(
  cdp,
  `(() => {
    const editor = document.querySelector('.iclaw-composer__editor');
    if (!(editor instanceof HTMLElement)) {
      return false;
    }
    editor.focus();
    return true;
  })()`,
);

await cdp.send('Input.insertText', {text: PROMPT});
await sleep(300);

await evalJSON(
  cdp,
  `(() => {
    const submit = document.querySelector('.iclaw-composer__submit');
    if (!(submit instanceof HTMLButtonElement)) {
      return false;
    }
    submit.click();
    return true;
  })()`,
);

await sleep(12_000);

const snapshot = await evalJSON(
  cdp,
  `(() => ({
    href: location.href,
    title: document.title,
    readyState: document.readyState,
    body: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 2400),
    shellCount: document.querySelectorAll('.openclaw-chat-surface-shell').length,
    composerCount: document.querySelectorAll('.iclaw-composer__editor').length,
    chatGroups: document.querySelectorAll('.chat-group').length,
    userTexts: Array.from(document.querySelectorAll('.chat-group.user .chat-text'))
      .map((node) => (node.textContent || '').trim())
      .filter(Boolean),
    assistantTexts: Array.from(document.querySelectorAll('.chat-group.assistant .chat-text'))
      .map((node) => (node.textContent || '').trim())
      .filter(Boolean),
    submitDisabled: document.querySelector('.iclaw-composer__submit')?.disabled ?? null,
    appConnected: Boolean(document.querySelector('openclaw-app')?.connected),
    appChatSending: Boolean(document.querySelector('openclaw-app')?.chatSending),
    appChatRunId: document.querySelector('openclaw-app')?.chatRunId || null,
    unhandled: window.__iclawUnhandled || [],
    diagnostics: window.__ICLAW_APP_DIAGNOSTICS__ || null,
  }))()`,
);

console.log(
  JSON.stringify(
    {
      targetUrl: target.url,
      prompt: PROMPT,
      snapshot,
      exceptions,
      consoleEvents: consoleEvents.slice(-60),
    },
    null,
    2,
  ),
);

cdp.close();
