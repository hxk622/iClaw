const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';

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

async function waitFor(label, predicate, timeoutMs = 45000, intervalMs = 500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const res = await fetch(CDP_LIST_URL);
const pages = await res.json();
const candidates = pages.filter((page) => String(page.url || '').includes('127.0.0.1:1520'));
const targetPage = candidates[0];
const cdp = new CDP(targetPage.webSocketDebuggerUrl);
const prompt = `发送烟测 ${Date.now()}`;

await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Page.navigate', {url: APP_URL});

await waitFor(
  'composer ready',
  async () =>
    evalJSON(
      cdp,
      `(() => {
        const editor = document.querySelector('.iclaw-composer__editor');
        const submit = document.querySelector('.iclaw-composer__submit');
        return editor && submit ? {
          submitDisabled: submit.disabled,
          body: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 500),
        } : null;
      })()`,
    ),
);

const before = await evalJSON(
  cdp,
  `(() => ({
    chatGroups: document.querySelectorAll('.chat-group').length,
    submitDisabled: document.querySelector('.iclaw-composer__submit')?.disabled ?? null,
    editorText: document.querySelector('.iclaw-composer__editor')?.textContent || null,
  }))()`,
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
await cdp.send('Input.insertText', {text: prompt});
await sleep(300);

const afterType = await evalJSON(
  cdp,
  `(() => ({
    chatGroups: document.querySelectorAll('.chat-group').length,
    submitDisabled: document.querySelector('.iclaw-composer__submit')?.disabled ?? null,
    editorText: document.querySelector('.iclaw-composer__editor')?.textContent || null,
  }))()`,
);

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

const afterClick = await evalJSON(
  cdp,
  `(() => ({
    chatGroups: document.querySelectorAll('.chat-group').length,
    submitDisabled: document.querySelector('.iclaw-composer__submit')?.disabled ?? null,
    editorText: document.querySelector('.iclaw-composer__editor')?.textContent || null,
  }))()`,
);

let finalState;
let finalError = null;
try {
  finalState = await waitFor(
    'new user message',
    async () =>
      evalJSON(
        cdp,
        `(() => {
          const userTexts = Array.from(document.querySelectorAll('.chat-group.user .chat-text'))
            .map((node) => (node.textContent || '').trim())
            .filter(Boolean);
          const assistantTexts = Array.from(document.querySelectorAll('.chat-group.assistant .chat-text'))
            .map((node) => (node.textContent || '').trim())
            .filter(Boolean);
          return userTexts.some((text) => text.includes(${JSON.stringify(prompt)}))
            ? {
                userTexts,
                assistantTexts,
                chatGroups: document.querySelectorAll('.chat-group').length,
                editorText: document.querySelector('.iclaw-composer__editor')?.textContent || null,
              }
            : null;
        })()`,
      ),
    60000,
    1000,
  );
} catch (error) {
  finalError = error instanceof Error ? error.message : String(error);
  finalState = await evalJSON(
    cdp,
    `(() => ({
      body: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1200),
      userTexts: Array.from(document.querySelectorAll('.chat-group.user .chat-text')).map((node) => (node.textContent || '').trim()),
      assistantTexts: Array.from(document.querySelectorAll('.chat-group.assistant .chat-text')).map((node) => (node.textContent || '').trim()),
      chatGroups: document.querySelectorAll('.chat-group').length,
      editorText: document.querySelector('.iclaw-composer__editor')?.textContent || null,
    }))()`,
  );
}

console.log(JSON.stringify({prompt, before, afterType, afterClick, finalState, finalError}, null, 2));
cdp.close();
