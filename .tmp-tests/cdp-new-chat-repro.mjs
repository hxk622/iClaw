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

async function waitFor(label, predicate, timeoutMs = 30000, intervalMs = 400) {
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

const ensureRecentTask = async () => {
  const existingTask = await evalJSON(
    cdp,
    `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const taskButton = buttons.find((button) => {
        const text = (button.textContent || '').replace(/\\s+/g, ' ').trim();
        return text && text !== '新建对话' && text !== '查看更多' && button.closest('.group.relative');
      });
      return taskButton ? (taskButton.textContent || '').replace(/\\s+/g, ' ').trim() : null;
    })()`,
  );
  if (existingTask) {
    return existingTask;
  }

  await evalJSON(
    cdp,
    `(() => {
      const editor = document.querySelector('.iclaw-composer__editor');
      editor?.focus();
      return true;
    })()`,
  );
  await cdp.send('Input.insertText', { text: `历史任务自测 ${Date.now()}` });
  await sleep(150);
  await evalJSON(
    cdp,
    `(() => {
      const submit = document.querySelector('.iclaw-composer__submit');
      submit?.click();
      return true;
    })()`,
  );

  return waitFor(
    'recent task entry',
    async () =>
      evalJSON(
        cdp,
        `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const taskButton = buttons.find((button) => {
            const text = (button.textContent || '').replace(/\\s+/g, ' ').trim();
            return text && text !== '新建对话' && text !== '查看更多' && button.closest('.group.relative');
          });
          return taskButton ? (taskButton.textContent || '').replace(/\\s+/g, ' ').trim() : null;
        })()`,
      ),
    45000,
    500,
  );
};

const recentTaskLabel = await ensureRecentTask();

const before = await evalJSON(
  cdp,
  `(() => ({
    recentTaskLabel: ${JSON.stringify(recentTaskLabel)},
    diagnostics: window.__ICLAW_OPENCLAW_DIAGNOSTICS__ || null,
  }))()`,
);

await evalJSON(
  cdp,
  `(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const taskButton = buttons.find((button) => {
      const text = (button.textContent || '').replace(/\\s+/g, ' ').trim();
      return text && text.includes(${JSON.stringify(recentTaskLabel)}) && button.closest('.group.relative');
    });
    taskButton?.click();
    return Boolean(taskButton);
  })()`,
);
await sleep(1200);

await evalJSON(
  cdp,
  `(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const newChat = buttons.find((button) => (button.textContent || '').replace(/\\s+/g, ' ').trim() === '新建对话');
    newChat?.click();
    return Boolean(newChat);
  })()`,
);
await sleep(1800);

const after = await evalJSON(
  cdp,
  `(() => {
    const visibleText = (document.body.innerText || '').replace(/\\s+/g, ' ').trim();
    const center = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    const welcome = Array.from(document.querySelectorAll('button,div,span')).some((node) => {
      const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
      return text.includes('开始新对话') || text.includes('输入研究问题');
    });
    return {
      diagnostics: window.__ICLAW_OPENCLAW_DIAGNOSTICS__ || null,
      visibleTextSample: visibleText.slice(0, 240),
      center: center
        ? {
            tag: center.tagName,
            className: center.className,
            text: (center.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 160),
          }
        : null,
      openclawAppConnected: document.querySelector('openclaw-app')?.connected ?? null,
      recentTaskButtons: Array.from(document.querySelectorAll('button'))
        .map((button) => (button.textContent || '').replace(/\\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 20),
      hasWelcome: welcome,
    };
  })()`,
);

console.log(JSON.stringify({ before, after }, null, 2));
cdp.close();
