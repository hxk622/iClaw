const LOGIN_URL = 'http://127.0.0.1:2130/auth/login';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const ACCESS_KEY = 'iclaw:auth.access_token';
const REFRESH_KEY = 'iclaw:auth.refresh_token';
const IDENTIFIER = process.env.ICLAW_IDENTIFIER || '515177265@qq.com';
const PASSWORD = process.env.ICLAW_PASSWORD || 'glp200663024';
const SCREENSHOT_PATH = '/tmp/iclaw-chat-send-check.png';
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

async function waitFor(cdp, label, predicate, timeoutMs = 30000, intervalMs = 800) {
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
    window.__iclawLastRequestError = null;
    return true;
  })()`,
);

await cdp.send('Page.reload', { ignoreCache: true });

const readyState = await waitFor(
  cdp,
  'connected chat',
  async () =>
    evalJSON(
      cdp,
      `(() => {
        const findEditor = () =>
          document.querySelector('.iclaw-composer__editor') ||
          document.querySelector('.openclaw-chat-surface .agent-chat__input textarea') ||
          document.querySelector('.openclaw-chat-surface .chat-compose__field textarea');
        const findSubmit = () =>
          document.querySelector('.iclaw-composer__submit') ||
          document.querySelector('.openclaw-chat-surface .chat-send-btn:not(.chat-send-btn--stop)');
        const app = document.querySelector('openclaw-app');
        const submit = findSubmit();
        const editor = findEditor();
        return app?.connected && submit && editor ? {
          connected: !!app.connected,
          lastError: app.lastError || null,
          groupCount: document.querySelectorAll('.openclaw-chat-surface .chat-group').length,
          submitDisabled: submit.disabled
        } : null;
      })()`,
    ),
);

await evalJSON(
  cdp,
  `(() => {
    const app = document.querySelector('openclaw-app');
    const client = app?.client;
    if (!client || typeof client.request !== 'function') {
      return { wrapped: false, reason: 'missing-client' };
    }
    const current = client.request;
    if (current.__iclawDebugWrapped) {
      return { wrapped: true, reused: true };
    }
    const wrapped = async (method, params) => {
      try {
        return await current.call(client, method, params);
      } catch (error) {
        window.__iclawLastRequestError = {
          method,
          params,
          message: error?.message || String(error),
          stack: error?.stack || null,
          name: error?.name || null,
          code: error?.code || null,
          details: error?.details || null
        };
        throw error;
      }
    };
    wrapped.__iclawDebugWrapped = true;
    client.request = wrapped;
    return { wrapped: true, reused: false };
  })()`,
);

const promptPrefix = 'CDP自测';
const prompt = `${promptPrefix} ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;

const beforeSend = await evalJSON(
  cdp,
  `(() => ({
    groupCount: document.querySelectorAll('.openclaw-chat-surface .chat-group').length,
    lastUserText: Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.user .chat-text')).at(-1)?.textContent?.trim() || null,
    lastAssistantText: Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.assistant .chat-text')).at(-1)?.textContent?.trim() || null
  }))()`,
);

const sendAttempt = await evalJSON(
  cdp,
  `(() => {
    const editor =
      document.querySelector('.iclaw-composer__editor') ||
      document.querySelector('.openclaw-chat-surface .agent-chat__input textarea') ||
      document.querySelector('.openclaw-chat-surface .chat-compose__field textarea');
    if (!editor) {
      return { ok: false, reason: 'composer missing' };
    }
    editor.focus();
    return {
      ok: true,
      activeTag: document.activeElement?.tagName || null,
      activeClassName: document.activeElement?.className || null
    };
  })()`,
);

await cdp.send('Input.insertText', { text: prompt });
await sleep(300);

const sendClickState = await evalJSON(
  cdp,
  `(() => {
    const editor =
      document.querySelector('.iclaw-composer__editor') ||
      document.querySelector('.openclaw-chat-surface .agent-chat__input textarea') ||
      document.querySelector('.openclaw-chat-surface .chat-compose__field textarea');
    const submit =
      document.querySelector('.iclaw-composer__submit') ||
      document.querySelector('.openclaw-chat-surface .chat-send-btn:not(.chat-send-btn--stop)');
    return {
      editorText: editor ? ('value' in editor ? editor.value : editor.textContent) || null : null,
      submitDisabled: submit?.disabled ?? null
    };
  })()`,
);

await evalJSON(
  cdp,
  `(() => {
    const submit =
      document.querySelector('.iclaw-composer__submit') ||
      document.querySelector('.openclaw-chat-surface .chat-send-btn:not(.chat-send-btn--stop)');
    if (!submit) return false;
    submit.click();
    return true;
  })()`,
);

const collectChatState = async () =>
  evalJSON(
    cdp,
    `(() => {
      const userTexts = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.user .chat-text'))
        .map((el) => el.textContent?.trim() || '')
        .filter(Boolean);
      const assistantTexts = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.assistant .chat-text'))
        .map((el) => el.textContent?.trim() || '')
        .filter(Boolean);
      const app = document.querySelector('openclaw-app');
      const editor =
        document.querySelector('.iclaw-composer__editor') ||
        document.querySelector('.openclaw-chat-surface .agent-chat__input textarea') ||
        document.querySelector('.openclaw-chat-surface .chat-compose__field textarea');
      const submit =
        document.querySelector('.iclaw-composer__submit') ||
        document.querySelector('.openclaw-chat-surface .chat-send-btn:not(.chat-send-btn--stop)');
      return {
        groupCount: document.querySelectorAll('.openclaw-chat-surface .chat-group').length,
        lastUserText: userTexts.at(-1) || null,
        lastAssistantText: assistantTexts.at(-1) || null,
        connected: !!app?.connected,
        chatSending: !!app?.chatSending,
        lastError: app?.lastError || null,
        requestError: window.__iclawLastRequestError || null,
        editorText: editor ? ('value' in editor ? editor.value : editor.textContent) || null : null,
        submitDisabled: submit?.disabled ?? null
      };
    })()`,
  );

let afterSend = null;
let afterSendError = null;
try {
  afterSend = await waitFor(
    cdp,
    'ui send result',
    async () => {
      const value = await collectChatState();
      if (value?.lastUserText?.includes(promptPrefix)) {
        return value;
      }
      return null;
    },
  );
} catch (error) {
  afterSendError = error instanceof Error ? error.message : String(error);
  afterSend = await collectChatState();
}

let settled = null;
let settledError = null;
try {
  settled = await waitFor(
    cdp,
    'assistant reply',
    async () => {
      const value = await collectChatState();
      if (value?.lastUserText?.includes(promptPrefix) && value?.lastAssistantText) {
        return value;
      }
      return null;
    },
    45000,
    1000,
  );
} catch (error) {
  settledError = error instanceof Error ? error.message : String(error);
  settled = await collectChatState();
}

const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
await import('node:fs/promises').then((fs) =>
  fs.writeFile(SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64')),
);

console.log(
  JSON.stringify(
    {
      readyState,
      prompt,
      beforeSend,
      sendAttempt,
      sendClickState,
      afterSend,
      afterSendError,
      settled,
      settledError,
      screenshot: SCREENSHOT_PATH,
    },
    null,
    2,
  ),
);

cdp.close();
