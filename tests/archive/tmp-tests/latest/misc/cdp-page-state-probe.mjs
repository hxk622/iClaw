const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';

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

async function evalJSON(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

const res = await fetch(CDP_LIST_URL);
const pages = await res.json();
const targets = pages.filter((page) => String(page.url || '').includes('127.0.0.1:1520'));
const output = [];

for (const page of targets) {
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Runtime.enable');
  const snapshot = await evalJSON(
    cdp,
    `(() => ({
      href: location.href,
      title: document.title,
      accessToken: Boolean(localStorage.getItem('iclaw:auth.access_token')),
      refreshToken: Boolean(localStorage.getItem('iclaw:auth.refresh_token')),
      userScope: localStorage.getItem('iclaw:chat.user_scope'),
      shellCount: document.querySelectorAll('.openclaw-chat-surface-shell').length,
      surfaceCount: document.querySelectorAll('.openclaw-chat-surface').length,
      composerCount: document.querySelectorAll('.iclaw-composer__editor').length,
      chatGroupCount: document.querySelectorAll('.chat-group').length,
      openclawAppCount: document.querySelectorAll('openclaw-app').length,
      bodySample: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1200),
      hasLoginPrompt: (document.body.innerText || '').includes('打开登录'),
      hasAuthName: (document.body.innerText || '').includes('Kevin Han'),
      hasChatWrapperError: (document.body.innerText || '').includes('当前聊天区还不能挂载运行时'),
      hasReadyToChat: (document.body.innerText || '').includes('Ready to chat'),
    }))()`,
  );
  output.push({
    id: page.id,
    url: page.url,
    snapshot,
  });
  cdp.close();
}

console.log(JSON.stringify(output, null, 2));
