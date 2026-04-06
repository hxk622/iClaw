import { writeFile } from 'node:fs/promises';

const LOGIN_URL = 'http://127.0.0.1:2130/auth/login';
const VERSION_URL = 'http://127.0.0.1:9223/json/version';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const ACCESS_KEY = 'iclaw:auth.access_token';
const REFRESH_KEY = 'iclaw:auth.refresh_token';
const IDENTIFIER = process.env.ICLAW_IDENTIFIER || '515177265@qq.com';
const PASSWORD = process.env.ICLAW_PASSWORD || 'glp200663024';
const SCREENSHOT_PATH = '/tmp/iclaw-real-tool-card-check.png';

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

async function readBrowserWebSocketUrl() {
  const response = await fetch(VERSION_URL);
  const payload = await response.json();
  if (!payload?.webSocketDebuggerUrl) {
    throw new Error(`Missing webSocketDebuggerUrl from ${VERSION_URL}`);
  }
  return payload.webSocketDebuggerUrl;
}

async function login() {
  const response = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: IDENTIFIER,
      email: IDENTIFIER,
      password: PASSWORD,
    }),
  });
  const payload = await response.json();
  const tokens = payload?.data?.tokens;
  if (!response.ok || !tokens?.access_token || !tokens?.refresh_token) {
    throw new Error(`login failed: ${JSON.stringify(payload)}`);
  }
  return tokens;
}

async function evaluateJson(cdp, sessionId, expression) {
  const result = await cdp.send(
    'Runtime.evaluate',
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );
  return result.result?.value;
}

async function waitFor(cdp, sessionId, label, predicate, timeoutMs = 90000, intervalMs = 800) {
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

async function createIsolatedSession(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  return { targetId, sessionId };
}

const browserWsUrl = await readBrowserWebSocketUrl();
const tokens = await login();
const cdp = new CDP(browserWsUrl);
await cdp.open();

const { targetId, sessionId } = await createIsolatedSession(cdp);
const consoleEvents = [];
const pageErrors = [];
cdp.ws.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data));
  if (message.sessionId !== sessionId || !message.method) {
    return;
  }
  if (message.method === 'Runtime.consoleAPICalled') {
    consoleEvents.push({
      type: message.params?.type || null,
      args: (message.params?.args || []).map((arg) => arg?.value ?? arg?.description ?? null),
    });
  }
  if (message.method === 'Runtime.exceptionThrown') {
    pageErrors.push({
      text: message.params?.exceptionDetails?.text || null,
      url: message.params?.exceptionDetails?.url || null,
      lineNumber: message.params?.exceptionDetails?.lineNumber ?? null,
      columnNumber: message.params?.exceptionDetails?.columnNumber ?? null,
      exception:
        message.params?.exceptionDetails?.exception?.value ??
        message.params?.exceptionDetails?.exception?.description ??
        null,
    });
  }
});
await cdp.send('Page.enable', {}, sessionId);
await cdp.send('Runtime.enable', {}, sessionId);
await cdp.send('DOM.enable', {}, sessionId);
await cdp.send(
  'Emulation.setDeviceMetricsOverride',
  {
    width: 1280,
    height: 1400,
    deviceScaleFactor: 1,
    mobile: false,
  },
  sessionId,
);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await sleep(1200);

await evaluateJson(
  cdp,
  sessionId,
  `(() => {
    localStorage.setItem(${JSON.stringify(ACCESS_KEY)}, ${JSON.stringify(tokens.access_token)});
    localStorage.setItem(${JSON.stringify(REFRESH_KEY)}, ${JSON.stringify(tokens.refresh_token)});
    return true;
  })()`,
);

await cdp.send('Page.reload', { ignoreCache: true }, sessionId);

let readyState = null;
let readyError = null;
try {
  readyState = await waitFor(
    cdp,
    sessionId,
    'connected chat composer',
    async () =>
      evaluateJson(
        cdp,
        sessionId,
        `(() => {
          const app = document.querySelector('openclaw-app');
          const editor = document.querySelector('.iclaw-composer__editor');
          const submit = document.querySelector('.iclaw-composer__submit');
          return app?.connected && editor && submit ? {
            connected: !!app.connected,
            groupCount: document.querySelectorAll('.openclaw-chat-surface .chat-group').length
          } : null;
        })()`,
      ),
  );
} catch (error) {
  readyError = error instanceof Error ? error.message : String(error);
}

if (!readyState) {
  const earlySnapshot = await evaluateJson(
    cdp,
    sessionId,
    `(() => ({
      href: location.href,
      title: document.title,
      bodyText: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1200),
      rootText: (document.getElementById('root')?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1200),
      hasEditor: !!document.querySelector('.iclaw-composer__editor'),
      hasSubmit: !!document.querySelector('.iclaw-composer__submit'),
      appState: (() => {
        const app = document.querySelector('openclaw-app');
        return app ? {
          connected: !!app.connected,
          busy: !!app.busy,
          chatSending: !!app.chatSending,
          lastError: app.lastError || null,
          lastErrorCode: app.lastErrorCode || null,
        } : null;
      })()
    }))()`,
  );
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
  await writeFile(SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));
  console.log(
    JSON.stringify(
      {
        readyState,
        readyError,
        earlySnapshot,
        consoleEvents: consoleEvents.slice(-20),
        pageErrors: pageErrors.slice(-20),
        screenshot: SCREENSHOT_PATH,
      },
      null,
      2,
    ),
  );
  await cdp.send('Target.closeTarget', { targetId });
  cdp.close();
  process.exit(0);
}

const timestamp = Date.now();
const filename = `/tmp/iclaw-tool-card-real-check-${timestamp}.md`;
const marker = `ICLAW_TOOL_CARD_REAL_CHECK_${timestamp}`;
const prompt =
  `请务必使用工具在 /tmp 目录生成一个 markdown 文件，路径必须是 ${filename}。` +
  `文件内容严格写成三行：第一行 "# ${marker}"，第二行 "status: ok"，第三行 "timestamp: ${timestamp}"。` +
  '完成后再用一句中文告诉我文件已经生成。';

const beforeState = await evaluateJson(
  cdp,
  sessionId,
  `(() => ({
    groupCount: document.querySelectorAll('.openclaw-chat-surface .chat-group').length,
    artifactCardCount: document.querySelectorAll('.openclaw-chat-surface .chat-tool-card[data-iclaw-tool-card="artifact"]').length,
    editorText: document.querySelector('.iclaw-composer__editor')?.textContent || null,
    submitDisabled: document.querySelector('.iclaw-composer__submit')?.disabled ?? null
  }))()`,
);

await evaluateJson(
  cdp,
  sessionId,
  `(() => {
    const editor = document.querySelector('.iclaw-composer__editor');
    if (!(editor instanceof HTMLElement)) {
      return false;
    }
    editor.focus();
    return true;
  })()`,
);
await cdp.send('Input.insertText', { text: prompt }, sessionId);
await sleep(300);
const afterTypeState = await evaluateJson(
  cdp,
  sessionId,
  `(() => ({
    editorText: document.querySelector('.iclaw-composer__editor')?.textContent || null,
    submitDisabled: document.querySelector('.iclaw-composer__submit')?.disabled ?? null,
    appLastError: document.querySelector('openclaw-app')?.lastError || null,
    appLastErrorCode: document.querySelector('openclaw-app')?.lastErrorCode || null
  }))()`,
);
await evaluateJson(
  cdp,
  sessionId,
  `(() => {
    const submit = document.querySelector('.iclaw-composer__submit');
    if (!(submit instanceof HTMLButtonElement)) {
      return false;
    }
    submit.click();
    return true;
  })()`,
);
const afterClickState = await evaluateJson(
  cdp,
  sessionId,
  `(() => ({
    editorText: document.querySelector('.iclaw-composer__editor')?.textContent || null,
    submitDisabled: document.querySelector('.iclaw-composer__submit')?.disabled ?? null,
    appConnected: !!document.querySelector('openclaw-app')?.connected,
    appBusy: !!document.querySelector('openclaw-app')?.busy,
    appChatSending: !!document.querySelector('openclaw-app')?.chatSending,
    appLastError: document.querySelector('openclaw-app')?.lastError || null,
    appLastErrorCode: document.querySelector('openclaw-app')?.lastErrorCode || null
  }))()`,
);

let userEchoed = false;
let userEchoError = null;
try {
  await waitFor(
    cdp,
    sessionId,
    'user prompt echoed',
    async () =>
      evaluateJson(
        cdp,
        sessionId,
        `(() => {
          const users = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.user .chat-text'))
            .map((node) => node.textContent?.trim() || '');
          return users.some((text) => text.includes(${JSON.stringify(marker)}));
        })()`,
      ),
  );
  userEchoed = true;
} catch (error) {
  userEchoError = error instanceof Error ? error.message : String(error);
}

let artifactState = null;
let artifactError = null;
try {
  artifactState = await waitFor(
    cdp,
    sessionId,
    'visible artifact card',
    async () =>
      evaluateJson(
        cdp,
        sessionId,
        `(() => {
          const cards = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-tool-card'))
            .filter((node) => node instanceof HTMLElement && !node.hasAttribute('hidden'));
          const artifactCard = cards.find((node) => {
            const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
            return text.includes(${JSON.stringify(filename)}) || text.includes(${JSON.stringify(marker)});
          });
          if (!(artifactCard instanceof HTMLElement)) {
            return null;
          }
          const cardStyle = getComputedStyle(artifactCard);
          const title = artifactCard.querySelector('.chat-tool-card__title');
          const status = artifactCard.querySelector('.chat-tool-card__status');
          const detail = artifactCard.querySelector('.chat-tool-card__detail');
          const preview = artifactCard.querySelector('.chat-tool-card__preview, .chat-tool-card__inline, .chat-tool-card__output');
          const titleStyle = title ? getComputedStyle(title) : null;
          const statusStyle = status ? getComputedStyle(status) : null;
          const detailStyle = detail ? getComputedStyle(detail) : null;
          const previewStyle = preview ? getComputedStyle(preview) : null;
          return {
            variant: artifactCard.dataset.iclawToolVariant || null,
            toolKind: artifactCard.dataset.iclawToolCard || null,
            text: (artifactCard.textContent || '').replace(/\\s+/g, ' ').trim(),
            background: cardStyle.backgroundColor,
            border: cardStyle.borderColor,
            radius: cardStyle.borderRadius,
            boxShadow: cardStyle.boxShadow,
            title: title ? {
              text: (title.textContent || '').trim(),
              color: titleStyle?.color || null,
              fontSize: titleStyle?.fontSize || null,
              lineHeight: titleStyle?.lineHeight || null,
            } : null,
            status: status ? {
              text: (status.textContent || '').trim(),
              background: statusStyle?.backgroundColor || null,
              color: statusStyle?.color || null,
              fontSize: statusStyle?.fontSize || null,
              lineHeight: statusStyle?.lineHeight || null,
            } : null,
            detail: detail ? {
              text: (detail.textContent || '').trim(),
              color: detailStyle?.color || null,
              fontSize: detailStyle?.fontSize || null,
            } : null,
            preview: preview ? {
              text: (preview.textContent || '').trim().slice(0, 240),
              background: previewStyle?.backgroundColor || null,
              color: previewStyle?.color || null,
              radius: previewStyle?.borderRadius || null,
            } : null,
            visibleCardCount: cards.length,
            assistantTexts: Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.assistant .chat-text'))
              .map((node) => node.textContent?.trim() || '')
              .filter(Boolean)
              .slice(-3),
          };
        })()`,
      ),
    120000,
    1000,
  );
} catch (error) {
  artifactError = error instanceof Error ? error.message : String(error);
}

const finalSnapshot = await evaluateJson(
  cdp,
  sessionId,
  `(() => ({
    href: location.href,
    title: document.title,
    bodyText: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1200),
    rootText: (document.getElementById('root')?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1200),
    groupCount: document.querySelectorAll('.openclaw-chat-surface .chat-group').length,
    appState: (() => {
      const app = document.querySelector('openclaw-app');
      return app ? {
        connected: !!app.connected,
        busy: !!app.busy,
        chatSending: !!app.chatSending,
        lastError: app.lastError || null,
        lastErrorCode: app.lastErrorCode || null,
      } : null;
    })(),
    visibleToolCards: Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-tool-card'))
      .filter((node) => node instanceof HTMLElement && !node.hasAttribute('hidden'))
      .map((node) => ({
        variant: node.dataset.iclawToolVariant || null,
        kind: node.dataset.iclawToolCard || null,
        className: node.className,
        text: (node.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 320),
        html: node.outerHTML.slice(0, 1200),
      })),
    visibleToolSummaries: Array.from(
      document.querySelectorAll('.openclaw-chat-surface .chat-tools-summary, .openclaw-chat-surface .chat-tool-msg-summary'),
    )
      .filter((node) => node instanceof HTMLElement)
      .map((node) => ({
        className: node.className,
        text: (node.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 320),
        html: node.outerHTML.slice(0, 1200),
      })),
    assistantTexts: Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.assistant .chat-text'))
      .map((node) => node.textContent?.trim() || '')
      .filter(Boolean)
      .slice(-5)
  }))()`,
);

const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
await writeFile(SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));

console.log(
  JSON.stringify(
    {
      prompt,
      marker,
      filename,
      readyState,
      readyError,
      beforeState,
      afterTypeState,
      afterClickState,
      userEchoed,
      userEchoError,
      artifactState,
      artifactError,
      finalSnapshot,
      consoleEvents: consoleEvents.slice(-20),
      pageErrors: pageErrors.slice(-20),
      screenshot: SCREENSHOT_PATH,
    },
    null,
    2,
  ),
);

await cdp.send('Target.closeTarget', { targetId });
cdp.close();
