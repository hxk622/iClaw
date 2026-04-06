const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
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

async function evalJSON(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

const wsUrl = await getPageWsUrl();
const cdp = new CDP(wsUrl);
await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: VIEWPORT_WIDTH,
  height: VIEWPORT_HEIGHT,
  deviceScaleFactor: 1,
  mobile: false,
});

const state = await evalJSON(
  cdp,
  `(() => {
    const content = document.querySelector('.openclaw-chat-surface .content.content--chat');
    const chat = document.querySelector('.openclaw-chat-surface .chat');
    const thread = document.querySelector('.openclaw-chat-surface .chat-thread');
    const groups = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group'));
    const lastGroup = groups.at(-1);
    const lastUserGroup = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.user')).at(-1);
    const lastAssistantGroup = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.assistant')).at(-1);
    const rectOf = (el) => el ? el.getBoundingClientRect().toJSON() : null;
    const styleOf = (el) => el ? getComputedStyle(el) : null;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight, scrollY: window.scrollY },
      content: content ? {
        rect: rectOf(content),
        scrollTop: content.scrollTop,
        scrollHeight: content.scrollHeight,
        clientHeight: content.clientHeight,
        overflowY: styleOf(content)?.overflowY || null
      } : null,
      chat: chat ? {
        rect: rectOf(chat),
        scrollTop: chat.scrollTop,
        scrollHeight: chat.scrollHeight,
        clientHeight: chat.clientHeight,
        overflowY: styleOf(chat)?.overflowY || null
      } : null,
      thread: thread ? {
        rect: rectOf(thread),
        scrollTop: thread.scrollTop,
        scrollHeight: thread.scrollHeight,
        clientHeight: thread.clientHeight,
        overflowY: styleOf(thread)?.overflowY || null
      } : null,
      lastGroup: lastGroup ? {
        className: lastGroup.className,
        rect: rectOf(lastGroup),
        text: (lastGroup.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120)
      } : null,
      lastUserGroup: lastUserGroup ? {
        rect: rectOf(lastUserGroup),
        text: (lastUserGroup.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120)
      } : null,
      lastAssistantGroup: lastAssistantGroup ? {
        rect: rectOf(lastAssistantGroup),
        text: (lastAssistantGroup.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120)
      } : null
    };
  })()`,
);

console.log(JSON.stringify(state, null, 2));
cdp.close();
