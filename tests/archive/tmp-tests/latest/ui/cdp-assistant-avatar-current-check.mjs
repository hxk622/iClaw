const LIST_URL = 'http://127.0.0.1:9223/json/list';

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 1;
    this.pending = new Map();
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !this.pending.has(message.id)) {
        return;
      }
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(message.error);
        return;
      }
      resolve(message.result);
    });
  }

  async open() {
    if (this.ws.readyState === WebSocket.OPEN) {
      return;
    }
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

const pages = await (await fetch(LIST_URL)).json();
const page = pages.find((item) => String(item?.url || '').includes('127.0.0.1:1520'));

if (!page?.webSocketDebuggerUrl) {
  throw new Error(`No debuggable desktop web page found in ${LIST_URL}`);
}

const cdp = new CDP(page.webSocketDebuggerUrl);
await cdp.open();
await cdp.send('Runtime.enable');

const result = await cdp.send('Runtime.evaluate', {
  expression: `(() => {
    const groups = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group')).filter(
      (node) => node instanceof HTMLElement,
    );
    return groups.map((group, index) => {
      const avatar = group.querySelector(':scope > .chat-avatar');
      const style = avatar ? getComputedStyle(avatar) : null;
      return {
        index,
        className: group.className,
        text: (group.querySelector('.chat-text')?.textContent || group.textContent || '')
          .replace(/\\s+/g, ' ')
          .trim()
          .slice(0, 160),
        hasText: Boolean(group.querySelector('.chat-text')),
        chatTextCount: group.querySelectorAll('.chat-text').length,
        chatMessageCount: group.querySelectorAll('.chat-message').length,
        visibleChatMessageCount: Array.from(group.querySelectorAll('.chat-message')).filter(
          (node) => node instanceof HTMLElement && !node.hasAttribute('hidden'),
        ).length,
        hasToolCard: Boolean(
          group.querySelector('.chat-tool-card, .chat-tools-collapse, .chat-tool-msg-collapse, .chat-json-collapse'),
        ),
        avatarOpacity: style?.opacity ?? null,
        avatarDisplay: style?.display ?? null,
        continued: group.classList.contains('iclaw-chat-group--continued'),
      };
    });
  })()`,
  returnByValue: true,
  awaitPromise: true,
});

console.log(JSON.stringify(result.result?.value ?? null, null, 2));
cdp.close();
