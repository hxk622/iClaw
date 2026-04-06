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

async function waitFor(cdp, label, predicate, timeoutMs = 60000, intervalMs = 800) {
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
        const editor = document.querySelector('.iclaw-composer__editor');
        const submit = document.querySelector('.iclaw-composer__submit');
        return app?.connected && editor && submit ? true : false;
      })()`,
    ),
);

const prompt = `footer自测 ${new Date().toISOString()}`;
const baseline = await evalJSON(
  cdp,
  `(() => {
    const groups = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.assistant'));
    return { assistantGroups: groups.length };
  })()`,
);

await evalJSON(
  cdp,
  `(() => {
    const editor = document.querySelector('.iclaw-composer__editor');
    editor?.focus();
    return !!editor;
  })()`,
);
await cdp.send('Input.insertText', { text: prompt });
await sleep(300);
await evalJSON(
  cdp,
  `(() => {
    const button = document.querySelector('.iclaw-composer__submit');
    button?.click();
    return !!button;
  })()`,
);

const result = await waitFor(
  cdp,
  'assistant footer result',
  async () =>
    evalJSON(
      cdp,
      `(() => {
        const groups = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.assistant'));
        if (groups.length <= ${JSON.stringify(baseline?.assistantGroups ?? 0)}) {
          return null;
        }
        const lastGroup = groups.at(-1);
        const text = lastGroup?.querySelector('.chat-text')?.textContent?.trim() || '';
        if (!text.includes('收到') && !text.includes('footer自测') && text.length < 10) {
          return null;
        }
        const meta = lastGroup?.querySelector('.iclaw-chat-assistant-meta');
        const label = meta?.querySelector('.iclaw-chat-assistant-meta__label')?.textContent?.trim() || null;
        const value = meta?.querySelector('.iclaw-chat-assistant-meta__value')?.textContent?.trim() || null;
        const hidden = meta?.hasAttribute('hidden') ?? null;
        const state = meta?.getAttribute('data-state') ?? null;
        if ((document.querySelector('openclaw-app')?.busy ?? false) === true) {
          return null;
        }
        return {
          prompt: ${JSON.stringify(prompt)},
          textPreview: text.slice(0, 200),
          footer: { label, value, hidden, state },
        };
      })()`,
    ),
);

console.log(JSON.stringify(result, null, 2));
cdp.close();
