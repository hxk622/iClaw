const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const LOGIN_URL = 'http://127.0.0.1:2130/auth/login';
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
  }

  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
      this.ws.addEventListener('message', (event) => {
        const msg = JSON.parse(String(event.data));
        if (!msg.id || !this.pending.has(msg.id)) {
          return;
        }
        const { resolve: done, reject: fail } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          fail(msg.error);
          return;
        }
        done(msg.result);
      });
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

const wsUrl = await getPageWsUrl();
const tokens = await login();
const cdp = new CDP(wsUrl);

await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Page.navigate', { url: APP_URL });
await sleep(1000);

await evalJSON(
  cdp,
  `(() => {
    localStorage.setItem(${JSON.stringify(ACCESS_KEY)}, ${JSON.stringify(tokens.access_token)});
    localStorage.setItem(${JSON.stringify(REFRESH_KEY)}, ${JSON.stringify(tokens.refresh_token)});
    return true;
  })()`,
);

await cdp.send('Page.reload', { ignoreCache: true });
await sleep(5000);

const before = await evalJSON(
  cdp,
  `(() => {
    const groups = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group'));
    const lastUser = groups.filter((node) => node.classList.contains('user')).at(-1);
    return {
      groupCount: groups.length,
      lastUserText: lastUser?.textContent?.replace(/\\s+/g, ' ').trim() ?? null
    };
  })()`,
);

await evalJSON(
  cdp,
  `(() => {
    const target = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-text'))
      .map((node) => {
        const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
        return { node, text };
      })
      .find((entry) => entry.text.length >= 4);
    if (!target) {
      return false;
    }
    const selection = window.getSelection();
    selection?.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(target.node);
    selection?.addRange(range);
    const rect = range.getBoundingClientRect();
    target.node.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: Math.round(rect.left + Math.min(rect.width / 2, 120)),
      clientY: Math.round(rect.top + Math.min(rect.height / 2, 24)),
      button: 2,
    }));
    return true;
  })()`,
);

await sleep(250);

const menuState = await evalJSON(
  cdp,
  `(() => {
    const menu = document.querySelector('.iclaw-chat-selection-menu');
    return {
      exists: !!menu,
      items: Array.from(menu?.querySelectorAll('button') ?? []).map((node) => ({
        text: node.textContent?.trim() ?? '',
        hasIcon: !!node.querySelector('svg')
      }))
    };
  })()`,
);

await evalJSON(
  cdp,
  `(() => {
    const button = Array.from(document.querySelectorAll('.iclaw-chat-selection-menu button'))
      .find((node) => (node.textContent || '').includes('追问'));
    button?.click();
    return !!button;
  })()`,
);

await sleep(250);

const editorState = await evalJSON(
  cdp,
  `(() => {
    const editor = document.querySelector('.iclaw-composer__editor');
    return {
      html: editor?.innerHTML ?? null,
      text: editor?.textContent ?? null
    };
  })()`,
);

await evalJSON(
  cdp,
  `(() => {
    const button = document.querySelector('.iclaw-composer__submit');
    button?.click();
    return !!button;
  })()`,
);

await sleep(2500);

const after = await evalJSON(
  cdp,
  `(() => {
    const groups = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group'));
    const userGroups = groups.filter((node) => node.classList.contains('user'));
    const lastUser = userGroups.length > 0 ? userGroups[userGroups.length - 1] : null;
    const lastUserText = lastUser ? (lastUser.textContent || '').replace(/\\s+/g, ' ').trim() : null;
    return {
      groupCount: groups.length,
      lastUserText,
      leakedMarker: lastUserText ? lastUserText.includes('[[引用:') : false
    };
  })()`,
);

console.log(JSON.stringify({ before, menuState, editorState, after }, null, 2));

cdp.close();
