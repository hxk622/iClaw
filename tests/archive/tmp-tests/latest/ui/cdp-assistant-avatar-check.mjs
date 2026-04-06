const VERSION_URL = 'http://127.0.0.1:9223/json/version';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';

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

  send(method, params = {}, sessionId = undefined) {
    const id = this.id++;
    const payload = { id, method, params };
    if (sessionId) {
      payload.sessionId = sessionId;
    }
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  close() {
    this.ws.close();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evaluateJson(cdp, sessionId, expression) {
  const result = await cdp.send(
    'Runtime.evaluate',
    {
      expression,
      returnByValue: true,
      awaitPromise: true,
    },
    sessionId,
  );
  return result.result?.value ?? null;
}

async function waitFor(cdp, sessionId, label, predicate, timeoutMs = 30000, intervalMs = 500) {
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

const browserVersion = await (await fetch(VERSION_URL)).json();
if (!browserVersion?.webSocketDebuggerUrl) {
  throw new Error(`Missing browser websocket debugger url from ${VERSION_URL}`);
}

const cdp = new CDP(browserVersion.webSocketDebuggerUrl);
await cdp.open();

const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

await cdp.send('Page.enable', {}, sessionId);
await cdp.send('Runtime.enable', {}, sessionId);
await cdp.send(
  'Emulation.setDeviceMetricsOverride',
  {
    width: 1440,
    height: 1600,
    deviceScaleFactor: 1,
    mobile: false,
  },
  sessionId,
);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);

await waitFor(
  cdp,
  sessionId,
  'chat surface render',
  async () =>
    evaluateJson(
      cdp,
      sessionId,
      `(() => {
        const shell = document.querySelector('.openclaw-chat-surface-shell');
        const groups = document.querySelectorAll('.openclaw-chat-surface .chat-group');
        return shell && groups.length > 0 ? { groupCount: groups.length } : null;
      })()`,
    ),
);

const snapshot = await evaluateJson(
  cdp,
  sessionId,
  `(() => {
    const groups = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group')).filter(
      (node) => node instanceof HTMLElement,
    );
    const normalized = groups.map((group, index) => {
      const avatar = group.querySelector(':scope > .chat-avatar');
      const style = avatar ? getComputedStyle(avatar) : null;
      return {
        index,
        className: group.className,
        text: (group.querySelector('.chat-text')?.textContent || group.textContent || '')
          .replace(/\\s+/g, ' ')
          .trim()
          .slice(0, 140),
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
        user: group.classList.contains('user'),
        assistantSide:
          group.classList.contains('assistant') ||
          group.classList.contains('tool') ||
          group.classList.contains('other'),
      };
    });

    const segments = [];
    let current = [];
    const flush = () => {
      if (current.length === 0) {
        return;
      }
      segments.push(current);
      current = [];
    };

    normalized.forEach((group) => {
      if (group.user || !group.assistantSide) {
        flush();
        return;
      }
      current.push(group);
    });
    flush();

    return {
      url: location.href,
      segmentSummaries: segments.map((segment, segmentIndex) => ({
        segmentIndex,
        visibleAvatarCount: segment.filter(
          (group) => group.avatarDisplay !== 'none' && group.avatarOpacity !== '0',
        ).length,
        visibleAvatarGroupIndexes: segment
          .filter((group) => group.avatarDisplay !== 'none' && group.avatarOpacity !== '0')
          .map((group) => group.index),
        groups: segment.map((group) => ({
          index: group.index,
          continued: group.continued,
          hasText: group.hasText,
          chatTextCount: group.chatTextCount,
          chatMessageCount: group.chatMessageCount,
          visibleChatMessageCount: group.visibleChatMessageCount,
          hasToolCard: group.hasToolCard,
          avatarOpacity: group.avatarOpacity,
          avatarDisplay: group.avatarDisplay,
          text: group.text,
        })),
      })),
      lastGroups: normalized.slice(-12),
    };
  })()`,
);

console.log(JSON.stringify(snapshot, null, 2));

await cdp.send('Target.closeTarget', { targetId });
cdp.close();
