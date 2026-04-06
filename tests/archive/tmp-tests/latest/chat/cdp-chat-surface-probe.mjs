const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';

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
      if (!msg.id || !this.pending.has(msg.id)) {
        return;
      }
      const {resolve, reject} = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) {
        reject(msg.error);
        return;
      }
      resolve(msg.result);
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
const cdp = new CDP(wsUrl);

await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Page.navigate', {url: APP_URL});
for (let attempt = 0; attempt < 40; attempt += 1) {
  const ready = await evalJSON(
    cdp,
    `(() => {
      const root = document.getElementById('root');
      const rootText = (root?.innerText || '').trim();
      return rootText.length > 0 || document.querySelector('.openclaw-chat-surface-shell') ? true : false;
    })()`,
  );
  if (ready) {
    break;
  }
  await sleep(250);
}

const snapshot = await evalJSON(
  cdp,
  `(() => {
    const persistenceScope = localStorage.getItem('iclaw:chat.user_scope') || 'guest';
    const activeRoute = JSON.parse(
      localStorage.getItem(\`iclaw.desktop.active-chat-route.v1:scope:\${persistenceScope}\`) || 'null',
    );
    const shells = Array.from(document.querySelectorAll('.openclaw-chat-surface-shell')).map((shell, index) => {
      const parent = shell.parentElement;
      const shellRect = shell.getBoundingClientRect();
      const parentRect = parent?.getBoundingClientRect();
      const shellStyle = getComputedStyle(shell);
      const parentStyle = parent ? getComputedStyle(parent) : null;
      const textSample = ((parent?.innerText || shell.innerText || '').replace(/\\s+/g, ' ').trim()).slice(0, 360);
      const editor = parent?.querySelector('.iclaw-composer__editor');
      const submit = parent?.querySelector('.iclaw-composer__submit');
      return {
        index,
        shellClass: shell.className,
        parentClass: parent?.className || null,
        shellRect: {
          width: shellRect.width,
          height: shellRect.height,
        },
        parentRect: parentRect
          ? {
              width: parentRect.width,
              height: parentRect.height,
            }
          : null,
        shellDisplay: shellStyle.display,
        shellVisibility: shellStyle.visibility,
        shellOpacity: shellStyle.opacity,
        parentDisplay: parentStyle?.display || null,
        parentVisibility: parentStyle?.visibility || null,
        parentOpacity: parentStyle?.opacity || null,
        parentPointerEvents: parentStyle?.pointerEvents || null,
        sessionTransitioning: shell.getAttribute('data-session-transitioning'),
        surfaceReactivating: shell.getAttribute('data-surface-reactivating'),
        hasWelcome: textSample.includes('立即开始对话') || textSample.includes('问题建议'),
        hasReadyBanner: textSample.includes('Ready to chat'),
        hasUserMessages: parent?.querySelectorAll('.chat-group.user').length || 0,
        hasAssistantMessages: parent?.querySelectorAll('.chat-group.assistant').length || 0,
        editorText: editor?.textContent || null,
        submitDisabled: submit instanceof HTMLButtonElement ? submit.disabled : null,
        textSample,
      };
    });
    return {
      activeRoute,
      shellCount: shells.length,
      shells,
      bodySample: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 800),
    };
  })()`,
);

console.log(JSON.stringify(snapshot, null, 2));
cdp.close();
