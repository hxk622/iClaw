const LOGIN_URL = 'http://127.0.0.1:2130/auth/login';
const CONTROL_PLANE_URL = 'http://127.0.0.1:2130';
const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const ACCESS_KEY = 'iclaw:auth.access_token';
const REFRESH_KEY = 'iclaw:auth.refresh_token';
const IDENTIFIER = process.env.ICLAW_IDENTIFIER || '515177265@qq.com';
const PASSWORD = process.env.ICLAW_PASSWORD || 'glp200663024';
const APP_URL = 'http://127.0.0.1:1520/chat';
const PROMPT = process.env.ICLAW_PROMPT || `live-check ${new Date().toISOString()}`;
const FOOTER_TIMEOUT_MS = Number(process.env.ICLAW_FOOTER_TIMEOUT_MS || 60000);

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
    headers: {'Content-Type': 'application/json'},
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

async function fetchBalance(accessToken) {
  const res = await fetch(`${CONTROL_PLANE_URL}/credits/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`credits/me failed: ${JSON.stringify(json)}`);
  }
  return json?.data?.total_available_balance ?? null;
}

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const {resolve, reject} = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(msg.error);
          return;
        }
        resolve(msg.result);
        return;
      }
      if (!msg.method) {
        return;
      }
      const list = this.handlers.get(msg.method);
      if (!list) {
        return;
      }
      for (const handler of list) {
        handler(msg.params || {});
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
    return new Promise((resolve, reject) => this.pending.set(id, {resolve, reject}));
  }

  on(method, handler) {
    const list = this.handlers.get(method) || [];
    list.push(handler);
    this.handlers.set(method, list);
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

async function waitFor(cdp, label, predicate, timeoutMs = 60000, intervalMs = 800) {
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

async function readPageSnapshot(cdp) {
  return evalJSON(
    cdp,
    `(() => {
      const app = document.querySelector('openclaw-app');
      const editor = document.querySelector('.iclaw-composer__editor');
      const submit = document.querySelector('.iclaw-composer__submit');
      const rootText = (document.getElementById('root')?.textContent || '').replace(/\\s+/g, ' ').trim();
      return {
        href: location.href,
        title: document.title,
        rootText: rootText.slice(0, 300),
        hasEditor: !!editor,
        hasSubmit: !!submit,
        diagnostics: window.__ICLAW_OPENCLAW_DIAGNOSTICS__ || null,
        openclawApp: app ? {
          connected: !!app.connected,
          busy: !!app.busy,
          lastError: app.lastError || null,
          lastErrorCode: app.lastErrorCode || null,
          sessionKey: app.sessionKey || null,
          tab: app.tab || null,
        } : null,
      };
    })()`,
  );
}

const wsUrl = await getPageWsUrl();
const tokens = await login();
const balanceBefore = await fetchBalance(tokens.access_token);
const cdp = new CDP(wsUrl);
const requestById = new Map();
const networkEvents = [];
const consoleEvents = [];
const pageErrors = [];

await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Network.enable');

cdp.on('Network.requestWillBeSent', (params) => {
  requestById.set(params.requestId, {
    url: params.request?.url || null,
    method: params.request?.method || null,
  });
});

cdp.on('Network.responseReceived', (params) => {
  const request = requestById.get(params.requestId) || {};
  const url = request.url || params.response?.url || null;
  if (!url || !url.includes('127.0.0.1:2130')) {
    return;
  }
  if (!url.includes('/agent/run/') && !url.includes('/usage/events') && !url.includes('/credits/me')) {
    return;
  }
  networkEvents.push({
    url,
    method: request.method || null,
    status: params.response?.status ?? null,
    statusText: params.response?.statusText || null,
  });
});

cdp.on('Runtime.consoleAPICalled', (params) => {
  consoleEvents.push({
    type: params.type || null,
    args: (params.args || []).map((arg) => arg.value ?? arg.description ?? null),
  });
});

cdp.on('Runtime.exceptionThrown', (params) => {
  pageErrors.push({
    text: params.exceptionDetails?.text || null,
    url: params.exceptionDetails?.url || null,
    lineNumber: params.exceptionDetails?.lineNumber ?? null,
    columnNumber: params.exceptionDetails?.columnNumber ?? null,
    exception:
      params.exceptionDetails?.exception?.value ??
      params.exceptionDetails?.exception?.description ??
      null,
    stack: params.exceptionDetails?.stackTrace?.callFrames?.slice(0, 10) || [],
  });
});

await cdp.send('Page.navigate', {url: APP_URL});
await sleep(1200);

await evalJSON(
  cdp,
  `(() => {
    localStorage.setItem(${JSON.stringify(ACCESS_KEY)}, ${JSON.stringify(tokens.access_token)});
    localStorage.setItem(${JSON.stringify(REFRESH_KEY)}, ${JSON.stringify(tokens.refresh_token)});
    return true;
  })()`,
);

await cdp.send('Page.reload', {ignoreCache: true});

try {
  await waitFor(
    cdp,
    'connected chat',
    async () =>
      evalJSON(
        cdp,
        `(() => {
          const app = document.querySelector('openclaw-app');
          const editor = document.querySelector('.iclaw-composer__editor');
          const submit = document.querySelector('.iclaw-composer__submit');
          return app?.connected && editor && submit ? true : false;
        })()`,
      ),
  );
} catch (error) {
  console.log(
    JSON.stringify(
      {
        phase: 'connect-timeout',
        snapshot: await readPageSnapshot(cdp),
        networkEvents,
        consoleEvents,
        pageErrors,
      },
      null,
      2,
    ),
  );
  cdp.close();
  throw error;
}

await evalJSON(
  cdp,
  `(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((button) => (button.textContent || '').replace(/\\s+/g, '').includes('新建对话'));
    target?.click();
    return !!target;
  })()`,
);
await sleep(1200);

await waitFor(
  cdp,
  'resolved model session',
  async () =>
    evalJSON(
      cdp,
      `(() => {
        const diagnostics = window.__ICLAW_OPENCLAW_DIAGNOSTICS__;
        return diagnostics?.resolvedModelSessionKey ? diagnostics.resolvedModelSessionKey : null;
      })()`,
    ),
  15000,
  500,
).catch(() => null);

await evalJSON(
  cdp,
  `(() => {
    const editor = document.querySelector('.iclaw-composer__editor');
    editor?.focus();
    return !!editor;
  })()`,
);
await cdp.send('Input.insertText', {text: PROMPT});
await sleep(300);
await evalJSON(
  cdp,
  `(() => {
    const button = document.querySelector('.iclaw-composer__submit');
    button?.click();
    return !!button;
  })()`,
);

const footer = await waitFor(
  cdp,
  'billing outcome',
  async () =>
    evalJSON(
      cdp,
      `(() => {
        const app = document.querySelector('openclaw-app');
        if (app?.busy) {
          return null;
        }
        const rootText = (document.getElementById('root')?.textContent || '').replace(/\\s+/g, ' ').trim();
        if (rootText.includes('当前消息已被拦截') || rootText.includes('龙虾币余额不足') || rootText.includes('超过单次额度限制')) {
          return {
            kind: 'credit-blocked',
            state: 'blocked',
            label: null,
            value: null,
            tooltip: rootText.slice(0, 240),
          };
        }
        const groups = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.assistant'));
        const lastGroup = groups.at(-1);
        const meta = lastGroup?.querySelector('.iclaw-chat-assistant-meta');
        if (meta) {
          const state = meta.getAttribute('data-state') || null;
          const label = meta.querySelector('.iclaw-chat-assistant-meta__label')?.textContent?.trim() || null;
          if ((state || label) && state !== 'idle') {
            return {
              kind: 'assistant-footer',
              state,
              label,
              value: meta.querySelector('.iclaw-chat-assistant-meta__value')?.textContent?.trim() || null,
              tooltip: meta.getAttribute('title') || null,
            };
          }
        }
        const userGroups = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.user'));
        const lastUserGroup = userGroups.at(-1);
        const userMeta = lastUserGroup?.querySelector('.iclaw-chat-run-footer .iclaw-chat-assistant-meta');
        if (!userMeta) {
          return null;
        }
        const userState = userMeta.getAttribute('data-state') || null;
        const userLabel = userMeta.querySelector('.iclaw-chat-assistant-meta__label')?.textContent?.trim() || null;
        if ((!userState && !userLabel) || userState === 'idle') {
          return null;
        }
        return {
          kind: 'user-run-footer',
          state: userState,
          label: userLabel,
          value: userMeta.querySelector('.iclaw-chat-assistant-meta__value')?.textContent?.trim() || null,
          tooltip: userMeta.getAttribute('title') || null,
        };
      })()`,
    ),
  FOOTER_TIMEOUT_MS,
  1000,
).catch(async (error) => {
  console.log(
    JSON.stringify(
      {
        phase: 'billing-timeout',
        snapshot: await readPageSnapshot(cdp),
        detail: await evalJSON(
          cdp,
          `(() => {
            const app = document.querySelector('openclaw-app');
            const groups = Array.from(document.querySelectorAll('.openclaw-chat-surface .chat-group.assistant'));
            const lastGroup = groups.at(-1);
            const meta = lastGroup?.querySelector('.iclaw-chat-assistant-meta');
            const chatMessages = Array.isArray(app?.chatMessages) ? app.chatMessages : [];
            return {
              assistantGroupCount: groups.length,
              lastAssistantText: lastGroup?.querySelector('.chat-text')?.textContent?.trim()?.slice(0, 240) || null,
              footer: meta ? {
                hidden: meta.hasAttribute('hidden'),
                state: meta.getAttribute('data-state') || null,
                label: meta.querySelector('.iclaw-chat-assistant-meta__label')?.textContent?.trim() || null,
                value: meta.querySelector('.iclaw-chat-assistant-meta__value')?.textContent?.trim() || null,
                tooltip: meta.getAttribute('title') || null,
              } : null,
              lastFourMessages: chatMessages.slice(-4).map((message) => ({
                role: message?.role || null,
                timestamp: message?.timestamp || null,
                usage: message?.usage || null,
                billingState: message?.__iclawBillingState || null,
                billingSummary: message?.__iclawBillingSummary || null,
                billingRunId: message?.__iclawBillingRunId || null,
              })),
              eventLogTail: (Array.isArray(app?.eventLogBuffer) ? app.eventLogBuffer : Array.isArray(app?.eventLog) ? app.eventLog : [])
                .slice(-16)
                .map((entry) => ({
                  event: entry?.event || null,
                  ts: entry?.ts || null,
                  payload:
                    entry?.payload && typeof entry.payload === 'object'
                      ? {
                          sessionKey: entry.payload.sessionKey || null,
                          runId: entry.payload.runId || null,
                          state: entry.payload.state || null,
                          messageRole: entry.payload.message?.role || null,
                          messageUsage: entry.payload.message?.usage || null,
                        }
                      : null,
                })),
              gatewaySessions: null,
            };
          })()`,
        ),
        gatewaySessions: await evalJSON(
          cdp,
          `(() => {
            const app = document.querySelector('openclaw-app');
            const request = app?.client?.request;
            if (!app?.connected || typeof request !== 'function') {
              return null;
            }
            return request('sessions.list', { includeGlobal: true, includeUnknown: true, limit: 200 })
              .then((result) => {
                const diagnostics = window.__ICLAW_OPENCLAW_DIAGNOSTICS__ || {};
                const keys = new Set([
                  app.sessionKey,
                  diagnostics.resolvedModelSessionKey,
                  diagnostics.pendingUsageSettlements?.[0]?.sessionKey,
                ].filter(Boolean));
                const sessions = Array.isArray(result?.sessions) ? result.sessions : [];
                return sessions
                  .filter((session) => {
                    const key = (session?.key || '').toLowerCase();
                    return Array.from(keys).some((candidate) => {
                      const normalized = String(candidate).toLowerCase();
                      return (
                        key === normalized ||
                        key === 'agent:' + normalized + ':main' ||
                        normalized === 'agent:' + key + ':main'
                      );
                    });
                  })
                  .map((session) => ({
                    key: session.key || null,
                    model: session.model || null,
                    inputTokens: session.inputTokens ?? null,
                    outputTokens: session.outputTokens ?? null,
                    lane: session.lane || null,
                  }));
              })
              .catch((error) => ({ error: error?.message || String(error) }));
          })()`,
        ),
        networkEvents,
        consoleEvents,
        pageErrors,
      },
      null,
      2,
    ),
  );
  cdp.close();
  throw error;
});

await sleep(1500);
const balanceAfter = await fetchBalance(tokens.access_token);
const snapshot = await evalJSON(
  cdp,
  `(() => {
    const app = document.querySelector('openclaw-app');
    const chatMessages = Array.isArray(app?.chatMessages) ? app.chatMessages : [];
    return {
      href: location.href,
      sessionKey:
        window.__ICLAW_OPENCLAW_DIAGNOSTICS__?.resolvedModelSessionKey ||
        app?.sessionKey ||
        null,
      resolvedModelSessionKey: window.__ICLAW_OPENCLAW_DIAGNOSTICS__?.resolvedModelSessionKey || null,
      diagnostics: window.__ICLAW_OPENCLAW_DIAGNOSTICS__ || null,
      appConnected: !!app?.connected,
      appBusy: !!app?.busy,
      lastTwoMessages: chatMessages.slice(-2).map((message) => ({
        role: message?.role || null,
        usage: message?.usage || null,
        billingState: message?.__iclawBillingState || null,
        billingSummary: message?.__iclawBillingSummary || null,
        billingRunId: message?.__iclawBillingRunId || null,
      })),
    };
  })()`,
);

console.log(
  JSON.stringify(
    {
      prompt: PROMPT,
      balanceBefore,
      balanceAfter,
      balanceDelta:
        typeof balanceBefore === 'number' && typeof balanceAfter === 'number' ? balanceAfter - balanceBefore : null,
      footer,
      snapshot,
      networkEvents,
      consoleEvents,
      pageErrors,
    },
    null,
    2,
  ),
);

cdp.close();
