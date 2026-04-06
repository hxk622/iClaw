const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const entry = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          entry.reject(msg.error);
          return;
        }
        entry.resolve(msg.result);
      }
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
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
    });
  }

  close() {
    this.ws.close();
  }
}

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

async function evalJson(cdp, expression) {
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
await cdp.send('Runtime.enable');

const value = await evalJson(
  cdp,
  `(() => {
    const app = document.querySelector('openclaw-app');
    const diagnostics = window.__ICLAW_OPENCLAW_DIAGNOSTICS__ || null;
    const options = Array.isArray(app?.modelOptions)
      ? app.modelOptions
      : Array.isArray(diagnostics?.modelOptions)
        ? diagnostics.modelOptions
        : [];
    return {
      href: location.href,
      selectedModelId: diagnostics?.selectedModelId || app?.selectedModelId || null,
      resolvedModelSessionKey: diagnostics?.resolvedModelSessionKey || null,
      optionCount: options.length,
      options: options.map((option) => {
        if (typeof option === 'string') {
          return {id: option, label: option};
        }
        return {
          id: option?.id || null,
          label: option?.label || option?.name || option?.id || null,
        };
      }),
      matchingTexts: Array.from(document.querySelectorAll('button,[role=button],li,[role=option],div,span'))
        .map((el) => ({
          tag: el.tagName,
          className: typeof el.className === 'string' ? el.className : '',
          text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
        }))
        .filter((entry) => entry.text && /qwen|claude|gpt|kimi|glm|minimax|deepseek|模型/i.test(entry.text))
        .slice(0, 120),
    };
  })()`,
);

console.log(JSON.stringify(value, null, 2));
cdp.close();
