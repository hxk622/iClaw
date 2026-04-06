import { writeFile } from 'node:fs/promises';

const VERSION_URL = 'http://127.0.0.1:9223/json/version';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const OUTPUT_PATH = '/tmp/iclaw-tool-card-dark.png';

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
    height: 1800,
    deviceScaleFactor: 2,
    mobile: false,
  },
  sessionId,
);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);

await waitFor(
  cdp,
  sessionId,
  'tool card render',
  async () =>
    evaluateJson(
      cdp,
      sessionId,
      `(() => {
        const root = document.documentElement;
        root.classList.add('dark');
        root.dataset.theme = 'dark';
        const card = document.querySelector('.openclaw-chat-surface .chat-tool-card:not([hidden])');
        if (!(card instanceof HTMLElement)) {
          return null;
        }
        card.scrollIntoView({ block: 'center', inline: 'nearest' });
        return true;
      })()`,
    ),
);

await sleep(800);

const clip = await evaluateJson(
  cdp,
  sessionId,
  `(() => {
    const card = document.querySelector('.openclaw-chat-surface .chat-tool-card:not([hidden])');
    if (!(card instanceof HTMLElement)) {
      return null;
    }
    const container = card.closest('.chat-group') || card;
    const rect = container.getBoundingClientRect();
    return {
      x: Math.max(0, rect.x - 24),
      y: Math.max(0, rect.y - 24),
      width: Math.min(window.innerWidth, rect.width + 48),
      height: Math.min(window.innerHeight, rect.height + 48),
      scale: 1,
    };
  })()`,
);

if (!clip) {
  throw new Error('Unable to resolve screenshot clip for tool card');
}

const screenshot = await cdp.send(
  'Page.captureScreenshot',
  {
    format: 'png',
    clip,
    fromSurface: true,
  },
  sessionId,
);

await writeFile(OUTPUT_PATH, Buffer.from(screenshot.data, 'base64'));
console.log(JSON.stringify({ output: OUTPUT_PATH, clip }, null, 2));

await cdp.send('Target.closeTarget', { targetId });
cdp.close();
