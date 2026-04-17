const LOGIN_URL = 'http://127.0.0.1:2130/auth/login';
const CONTROL_PLANE_URL = 'http://127.0.0.1:2130';
const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const ACCESS_KEY = 'iclaw:auth.access_token';
const REFRESH_KEY = 'iclaw:auth.refresh_token';
const IDENTIFIER = process.env.ICLAW_IDENTIFIER || '515177265@qq.com';
const PASSWORD = process.env.ICLAW_PASSWORD || 'glp200663024';
const APP_URL = 'http://127.0.0.1:1520/chat';
const FOOTER_TIMEOUT_MS = Number(process.env.ICLAW_FOOTER_TIMEOUT_MS || 60000);
const PROMPT_BASE = process.env.ICLAW_PROMPT || '北京天气怎么样';
const MODELS = (process.env.ICLAW_MODELS ||
  'bailian/qwen3.5-plus,bailian/qwen3.5-flash,bailian/qwen3-max,bailian/kimi-k2.5')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

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

async function evalJSON(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

async function waitFor(label, predicate, timeoutMs = 60000, intervalMs = 800) {
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

async function preparePage(cdp, tokens) {
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
  await waitFor(
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
    60000,
    800,
  );
}

async function clickNewChat(cdp) {
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
}

async function patchSessionModel(cdp, modelId) {
  return evalJSON(
    cdp,
    `(() => {
      const app = document.querySelector('openclaw-app');
      const request = app?.client?.request;
      const diagnostics = window.__ICLAW_OPENCLAW_DIAGNOSTICS__ || {};
      if (!app?.connected || typeof request !== 'function') {
        return {ok: false, reason: 'not-connected'};
      }
      const targets = Array.from(
        new Set(
          [
            diagnostics.effectiveGatewaySessionKey || null,
            diagnostics.resolvedModelSessionKey || null,
            app.sessionKey || null,
          ].filter(Boolean),
        ),
      );
      return Promise.all(
        targets.map((key) =>
          request('sessions.patch', {
            key,
            model: ${JSON.stringify(modelId)},
            responseUsage: 'tokens',
          }),
        ),
      )
        .then(() =>
          request('sessions.list', {includeGlobal: true, includeUnknown: true, limit: 200}).then((result) => ({
            ok: true,
            targets,
            sessions: (Array.isArray(result?.sessions) ? result.sessions : [])
              .filter((session) => targets.includes(session?.key))
              .map((session) => ({
                key: session?.key || null,
                model: session?.model || null,
                inputTokens: session?.inputTokens ?? null,
                outputTokens: session?.outputTokens ?? null,
              })),
          })),
        )
        .catch((error) => ({
          ok: false,
          reason: error?.message || String(error),
          targets,
        }));
    })()`,
  );
}

async function waitForSelectedModel(cdp, modelId) {
  return waitFor(
    `selected model ${modelId}`,
    async () =>
      evalJSON(
        cdp,
        `(() => {
          const diagnostics = window.__ICLAW_OPENCLAW_DIAGNOSTICS__ || {};
          const selectedModelId = diagnostics.selectedModelId || null;
          return selectedModelId === ${JSON.stringify(modelId)}
            ? {
                selectedModelId,
                resolvedModelSessionKey: diagnostics.resolvedModelSessionKey || null,
                effectiveGatewaySessionKey: diagnostics.effectiveGatewaySessionKey || null,
              }
            : null;
        })()`,
      ),
    20000,
    500,
  );
}

async function sendPrompt(cdp, prompt) {
  await evalJSON(
    cdp,
    `(() => {
      const editor = document.querySelector('.iclaw-composer__editor');
      editor?.focus();
      return !!editor;
    })()`,
  );
  await cdp.send('Input.insertText', {text: prompt});
  await sleep(250);
  await evalJSON(
    cdp,
    `(() => {
      const button = document.querySelector('.iclaw-composer__submit');
      button?.click();
      return !!button;
    })()`,
  );
}

async function waitForFooter(cdp) {
  return waitFor(
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
          if (rootText.includes('当前消息已被拦截') || rootText.includes('积分余额不足') || rootText.includes('超过单次额度限制')) {
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
  );
}

async function readRunSnapshot(cdp) {
  return evalJSON(
    cdp,
    `(() => {
      const app = document.querySelector('openclaw-app');
      const diagnostics = window.__ICLAW_OPENCLAW_DIAGNOSTICS__ || {};
      const chatMessages = Array.isArray(app?.chatMessages) ? app.chatMessages : [];
      const currentKeys = Array.from(
        new Set(
          [
            diagnostics.effectiveGatewaySessionKey || null,
            diagnostics.resolvedModelSessionKey || null,
            app?.sessionKey || null,
          ].filter(Boolean),
        ),
      );
      const request = app?.client?.request;
      const core = {
        href: location.href,
        selectedModelId: diagnostics.selectedModelId || null,
        effectiveGatewaySessionKey: diagnostics.effectiveGatewaySessionKey || null,
        resolvedModelSessionKey: diagnostics.resolvedModelSessionKey || null,
        appBusy: !!app?.busy,
        pendingSettlementCount: diagnostics.pendingSettlementCount ?? null,
        usageSettlementAttemptSequence: diagnostics.usageSettlementAttemptSequence ?? null,
        lastTwoMessages: chatMessages.slice(-2).map((message) => ({
          role: message?.role || null,
          usage: message?.usage || null,
          billingState: message?.__iclawBillingState || null,
          billingSummary: message?.__iclawBillingSummary || null,
          billingRunId: message?.__iclawBillingRunId || null,
          text:
            Array.isArray(message?.content)
              ? message.content
                  .filter((item) => item?.type === 'text')
                  .map((item) => item?.text || '')
                  .join('\\n')
                  .slice(0, 200)
              : null,
        })),
      };
      if (!app?.connected || typeof request !== 'function') {
        return Promise.resolve({...core, sessions: null});
      }
      return request('sessions.list', {includeGlobal: true, includeUnknown: true, limit: 200})
        .then((result) => ({
          ...core,
          sessions: (Array.isArray(result?.sessions) ? result.sessions : [])
            .filter((session) => currentKeys.includes(session?.key))
            .map((session) => ({
              key: session?.key || null,
              model: session?.model || null,
              inputTokens: session?.inputTokens ?? null,
              outputTokens: session?.outputTokens ?? null,
              lane: session?.lane || null,
            })),
        }))
        .catch((error) => ({
          ...core,
          sessions: {error: error?.message || String(error)},
        }));
    })()`,
  );
}

function modelLabel(modelId) {
  return modelId.split('/').at(-1) || modelId;
}

const wsUrl = await getPageWsUrl();
const tokens = await login();
const balanceBefore = await fetchBalance(tokens.access_token);
const cdp = new CDP(wsUrl);

await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');

await preparePage(cdp, tokens);

const results = [];
for (const modelId of MODELS) {
  await clickNewChat(cdp);
  const patch = await patchSessionModel(cdp, modelId);
  await cdp.send('Page.reload', {ignoreCache: true});
  await waitFor(
    `reconnect ${modelId}`,
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
    60000,
    800,
  );

  const selected = await waitForSelectedModel(cdp, modelId).catch(async (error) => ({
    error: error instanceof Error ? error.message : String(error),
    snapshot: await readRunSnapshot(cdp),
  }));

  const prompt = `${PROMPT_BASE} [${modelLabel(modelId)}]`;
  if (!selected?.error) {
    await sendPrompt(cdp, prompt);
  }

  const footer = selected?.error ? null : await waitForFooter(cdp).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }));
  await sleep(1200);
  const snapshot = await readRunSnapshot(cdp);
  results.push({
    modelId,
    prompt,
    patch,
    selected,
    footer,
    snapshot,
  });
}

const balanceAfter = await fetchBalance(tokens.access_token);
console.log(
  JSON.stringify(
    {
      models: MODELS,
      balanceBefore,
      balanceAfter,
      balanceDelta:
        typeof balanceBefore === 'number' && typeof balanceAfter === 'number' ? balanceAfter - balanceBefore : null,
      results,
    },
    null,
    2,
  ),
);

cdp.close();
