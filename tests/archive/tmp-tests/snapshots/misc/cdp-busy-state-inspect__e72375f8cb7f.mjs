const LOGIN_URL = 'http://127.0.0.1:2130/auth/login';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const ACCESS_KEY = 'iclaw:auth.access_token';
const REFRESH_KEY = 'iclaw:auth.refresh_token';
const IDENTIFIER = process.env.ICLAW_IDENTIFIER || '515177265@qq.com';
const PASSWORD = process.env.ICLAW_PASSWORD || 'glp200663024';
const VIEWPORT_WIDTH = Number(process.env.ICLAW_VIEWPORT_WIDTH || 1015);
const VIEWPORT_HEIGHT = Number(process.env.ICLAW_VIEWPORT_HEIGHT || 761);
const SCREENSHOT_PATH = '/tmp/iclaw-chat-busy-state.png';

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

async function waitFor(cdp, label, predicate, timeoutMs = 30000, intervalMs = 500) {
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
    return true;
  })()`,
);

await cdp.send('Page.reload', { ignoreCache: true });

await waitFor(
  cdp,
  'connected chat',
  async () =>
    evalJSON(
      cdp,
      `(() => {
        const app = document.querySelector('openclaw-app');
        const submit = document.querySelector('.iclaw-composer__submit');
        return app?.connected && submit ? true : false;
      })()`,
    ),
);

const prompt = `BUSY态检测 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
await evalJSON(
  cdp,
  `(() => {
    const editor = document.querySelector('.iclaw-composer__editor');
    editor?.focus();
    return true;
  })()`,
);
await cdp.send('Input.insertText', { text: prompt });
await sleep(200);
await evalJSON(
  cdp,
  `(() => {
    const submit = document.querySelector('.iclaw-composer__submit');
    if (!submit) return false;
    submit.click();
    return true;
  })()`,
);

const busyState = await waitFor(
  cdp,
  'busy state',
  async () =>
    evalJSON(
      cdp,
      `(() => {
        const app = document.querySelector('openclaw-app');
        if (!app || !(app.chatSending || app.chatRunId)) {
          return null;
        }
        const thread = document.querySelector('.openclaw-chat-surface .chat-thread');
        const content = document.querySelector('.openclaw-chat-surface .content.content--chat');
        const chat = document.querySelector('.openclaw-chat-surface .chat');
        const lastUser = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.user')).at(-1);
        const lastAssistant = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.assistant')).at(-1);
        const readingIndicator = document.querySelector('.openclaw-chat-surface .chat-bubble.chat-reading-indicator');
        const streamGroup = document.querySelector('.openclaw-chat-surface .chat-group.assistant:last-child');
        const rectOf = (el) => el ? el.getBoundingClientRect().toJSON() : null;
        return {
          app: {
            connected: !!app.connected,
            chatSending: !!app.chatSending,
            chatRunId: app.chatRunId || null,
            lastError: app.lastError || null
          },
          viewport: { width: window.innerWidth, height: window.innerHeight },
          content: content ? {
            rect: rectOf(content),
            scrollTop: content.scrollTop,
            scrollHeight: content.scrollHeight,
            clientHeight: content.clientHeight
          } : null,
          chat: chat ? {
            rect: rectOf(chat),
            scrollTop: chat.scrollTop,
            scrollHeight: chat.scrollHeight,
            clientHeight: chat.clientHeight
          } : null,
          thread: thread ? {
            rect: rectOf(thread),
            scrollTop: thread.scrollTop,
            scrollHeight: thread.scrollHeight,
            clientHeight: thread.clientHeight,
            textLength: (thread.textContent || '').trim().length
          } : null,
          lastUser: lastUser ? {
            rect: rectOf(lastUser),
            text: (lastUser.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120)
          } : null,
          lastAssistant: lastAssistant ? {
            rect: rectOf(lastAssistant),
            text: (lastAssistant.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120)
          } : null,
          readingIndicator: readingIndicator ? {
            rect: rectOf(readingIndicator),
            text: (readingIndicator.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120)
          } : null,
          streamGroup: streamGroup ? {
            rect: rectOf(streamGroup),
            text: (streamGroup.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120)
          } : null,
          centerEl: (() => {
            const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
            return el ? {
              tag: el.tagName,
              className: el.className,
              text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120)
            } : null;
          })()
        };
      })()`,
    ),
  45000,
  300,
);

const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
await import('node:fs/promises').then((fs) =>
  fs.writeFile(SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64')),
);

console.log(JSON.stringify({ prompt, busyState, screenshot: SCREENSHOT_PATH }, null, 2));
cdp.close();
