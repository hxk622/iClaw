const LOGIN_URL = 'http://127.0.0.1:2130/auth/login';
const VERSION_URL = 'http://127.0.0.1:9223/json/version';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const ACCESS_KEY = 'iclaw:auth.access_token';
const REFRESH_KEY = 'iclaw:auth.refresh_token';
const IDENTIFIER = process.env.ICLAW_IDENTIFIER || '515177265@qq.com';
const PASSWORD = process.env.ICLAW_PASSWORD || 'glp200663024';

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
      const {resolve, reject} = this.pending.get(message.id);
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
      this.ws.addEventListener('open', resolve, {once: true});
      this.ws.addEventListener('error', reject, {once: true});
    });
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.id++;
    const payload = {id, method, params};
    if (sessionId) {
      payload.sessionId = sessionId;
    }
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, {resolve, reject}));
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
    throw new Error(`Missing browser webSocketDebuggerUrl from ${VERSION_URL}`);
  }
  return payload.webSocketDebuggerUrl;
}

async function login() {
  const response = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
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

async function waitFor(cdp, sessionId, label, predicate, timeoutMs = 20000, intervalMs = 100) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await predicate();
      if (value) {
        return value;
      }
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error ? String(error.message || '') : String(error || '');
      if (!message.includes('Inspected target navigated or closed')) {
        throw error;
      }
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function createSession(cdp) {
  const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
  const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
  return {targetId, sessionId};
}

function buildSeed(seed) {
  const now = Date.now();
  const convA = `conv-seeded-a-${seed}`;
  const convB = `conv-seeded-b-${seed}`;
  const sessionA = `agent:main:seeded-a-${seed}`;
  const sessionB = `agent:main:seeded-b-${seed}`;
  const promptA = `seeded recent A ${seed}`;
  const promptB = `seeded recent B ${seed}`;
  const assistantA = `SEEDED_ASSISTANT_A_${seed}`;
  const assistantB = `SEEDED_ASSISTANT_B_${seed}`;
  return {
    seed,
    convA,
    convB,
    sessionA,
    sessionB,
    promptA,
    promptB,
    assistantA,
    assistantB,
    conversations: [
      {
        id: convB,
        kind: 'general',
        title: promptB,
        summary: assistantB,
        activeSessionKey: sessionB,
        sessionKeys: [sessionB],
        createdAt: new Date(now - 1000).toISOString(),
        updatedAt: new Date(now).toISOString(),
        handoffs: [],
      },
      {
        id: convA,
        kind: 'general',
        title: promptA,
        summary: assistantA,
        activeSessionKey: sessionA,
        sessionKeys: [sessionA],
        createdAt: new Date(now - 2000).toISOString(),
        updatedAt: new Date(now - 500).toISOString(),
        handoffs: [],
      },
    ],
    turns: [
      {
        id: `turn-seeded-b-${seed}`,
        source: 'chat',
        conversationId: convB,
        sessionKey: sessionB,
        title: promptB,
        summary: promptB,
        prompt: promptB,
        status: 'completed',
        createdAt: new Date(now - 1000).toISOString(),
        updatedAt: new Date(now).toISOString(),
        pinnedAt: null,
        artifacts: [],
        lastError: null,
      },
      {
        id: `turn-seeded-a-${seed}`,
        source: 'chat',
        conversationId: convA,
        sessionKey: sessionA,
        title: promptA,
        summary: promptA,
        prompt: promptA,
        status: 'completed',
        createdAt: new Date(now - 2000).toISOString(),
        updatedAt: new Date(now - 500).toISOString(),
        pinnedAt: null,
        artifacts: [],
        lastError: null,
      },
    ],
    snapshotA: {
      sessionKey: sessionA,
      savedAt: now - 500,
      messages: [
        {role: 'user', content: [{type: 'text', text: promptA}], timestamp: now - 800},
        {
          role: 'assistant',
          content: [{type: 'text', text: assistantA}],
          timestamp: now - 500,
          __iclawBillingSummary: {lobsterCredits: 11, inputTokens: 7, outputTokens: 9},
        },
      ],
      pendingUsageSettlements: [],
    },
    snapshotB: {
      sessionKey: sessionB,
      savedAt: now,
      messages: [
        {role: 'user', content: [{type: 'text', text: promptB}], timestamp: now - 300},
        {
          role: 'assistant',
          content: [{type: 'text', text: assistantB}],
          timestamp: now,
          __iclawBillingSummary: {lobsterCredits: 12, inputTokens: 8, outputTokens: 10},
        },
      ],
      pendingUsageSettlements: [],
    },
  };
}

async function preparePage(cdp, sessionId, tokens, seed) {
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('DOM.enable', {}, sessionId);
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false},
    sessionId,
  );
  await cdp.send('Page.navigate', {url: APP_URL}, sessionId);
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

  await cdp.send('Page.reload', {ignoreCache: true}, sessionId);
}

async function waitForComposer(cdp, sessionId) {
  return waitFor(
    cdp,
    sessionId,
    'composer ready',
    async () =>
      evaluateJson(
        cdp,
        sessionId,
        `(() => {
          const submit = document.querySelector('.iclaw-composer__submit');
          const editor = document.querySelector('.iclaw-composer__editor');
          const app = document.querySelector('openclaw-app');
          return submit && editor && app?.connected
            ? {
                activeRoute: window.__ICLAW_APP_DIAGNOSTICS__?.activeChatRoute || null,
                text: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 300),
              }
            : null;
        })()`,
      ),
  );
}

async function readSidebar(cdp, sessionId, seed) {
  return evaluateJson(
    cdp,
    sessionId,
    `(() => {
      const seeded = ${JSON.stringify(seed)};
      return Array.from(document.querySelectorAll('button'))
        .filter((button) => {
          const text = (button.textContent || '').replace(/\\s+/g, ' ').trim();
          return text.includes(seeded.promptA) || text.includes(seeded.promptB);
        })
        .map((button) => ({
          text: (button.textContent || '').replace(/\\s+/g, ' ').trim(),
          selected:
            button.getAttribute('aria-current') === 'true' ||
            button.closest('[data-active="true"]') !== null ||
            button.closest('div')?.className.includes('border-[') ||
            false,
        }));
    })()`,
  );
}

async function seedCurrentScope(cdp, sessionId, seed) {
  return evaluateJson(
    cdp,
    sessionId,
    `(() => {
      const seeded = ${JSON.stringify(seed)};
      const scope =
        localStorage.getItem('iclaw:chat.user_scope') ||
        localStorage.getItem('licaiclaw:chat.user_scope') ||
        '';
      if (!scope) {
        return null;
      }
      const appNames = ['iclaw', 'licaiclaw'];
      localStorage.setItem('iclaw.chat.conversations.v1:scope:' + scope, JSON.stringify(seeded.conversations));
      localStorage.setItem('iclaw.chat.turns.v1:scope:' + scope, JSON.stringify(seeded.turns));
      appNames.forEach((appName) => {
        localStorage.setItem(
          \`iclaw.chat.session.v1:\${appName}:\${seeded.sessionA.toLowerCase()}:scope:\${scope}\`,
          JSON.stringify(seeded.snapshotA),
        );
        localStorage.setItem(
          \`iclaw.chat.session.v1:\${appName}:\${seeded.sessionB.toLowerCase()}:scope:\${scope}\`,
          JSON.stringify(seeded.snapshotB),
        );
        localStorage.setItem(
          \`iclaw.chat.conversation.v1:\${appName}:\${seeded.convA.toLowerCase()}:scope:\${scope}\`,
          JSON.stringify(seeded.snapshotA),
        );
        localStorage.setItem(
          \`iclaw.chat.conversation.v1:\${appName}:\${seeded.convB.toLowerCase()}:scope:\${scope}\`,
          JSON.stringify(seeded.snapshotB),
        );
      });
      window.dispatchEvent(new CustomEvent('iclaw:chat-conversations:updated'));
      window.dispatchEvent(new CustomEvent('iclaw:chat-turns:updated'));
      return {scope};
    })()`,
  );
}

async function waitForAuthenticatedStablePage(cdp, sessionId) {
  return waitFor(
    cdp,
    sessionId,
    'authenticated stable page',
    async () =>
      evaluateJson(
        cdp,
        sessionId,
        `(() => {
          const app = document.querySelector('openclaw-app');
          const editor = document.querySelector('.iclaw-composer__editor');
          const bodyText = (document.body.innerText || '').replace(/\\s+/g, ' ').trim();
          const scope =
            localStorage.getItem('iclaw:chat.user_scope') ||
            localStorage.getItem('licaiclaw:chat.user_scope') ||
            '';
          const authenticated = !bodyText.includes('游客模式') && bodyText.includes('退出登录');
          return authenticated && scope && editor && app?.connected
            ? {scope, bodyText: bodyText.slice(0, 240)}
            : null;
        })()`,
      ),
    30000,
    250,
  );
}

async function waitForSeededConversation(cdp, sessionId, seed, conversationId, prompt, assistantText) {
  return waitFor(
    cdp,
    sessionId,
    `seeded conversation ${conversationId}`,
    async () =>
      evaluateJson(
        cdp,
        sessionId,
        `(() => {
          const diagnostics = window.__ICLAW_APP_DIAGNOSTICS__ || null;
          const userTexts = Array.from(document.querySelectorAll('.chat-group.user .chat-text'))
            .map((node) => (node.textContent || '').trim())
            .filter(Boolean);
          const assistantTexts = Array.from(document.querySelectorAll('.chat-group.assistant .chat-text'))
            .map((node) => (node.textContent || '').trim())
            .filter(Boolean);
          const sidebarItems = Array.from(document.querySelectorAll('button'))
            .map((button) => (button.textContent || '').replace(/\\s+/g, ' ').trim())
            .filter((text) => text.includes(${JSON.stringify(seed.promptA)}) || text.includes(${JSON.stringify(seed.promptB)}));
          const matched =
            diagnostics?.activeChatRoute?.conversationId === ${JSON.stringify(conversationId)} &&
            userTexts.some((text) => text.includes(${JSON.stringify(prompt)})) &&
            assistantTexts.some((text) => text.includes(${JSON.stringify(assistantText)}));
          return matched
            ? {
                routeConversationId: diagnostics?.activeChatRoute?.conversationId || null,
                sidebarItems,
                userTexts,
                assistantTexts,
              }
            : null;
        })()`,
      ),
    30000,
    250,
  );
}

async function markStableNodes(cdp, sessionId) {
  return evaluateJson(
    cdp,
    sessionId,
    `(() => {
      const wrapper = document.querySelector('[data-chat-surface-key]');
      const shell = document.querySelector('.openclaw-chat-surface-shell');
      const host = document.querySelector('.openclaw-chat-surface');
      wrapper?.setAttribute('data-switch-probe-wrapper', 'true');
      shell?.setAttribute('data-switch-probe-shell', 'true');
      host?.setAttribute('data-switch-probe-host', 'true');
      return {
        wrapperKey: wrapper?.getAttribute('data-chat-surface-key') || null,
        shellTransitioning: shell?.getAttribute('data-session-transitioning') || null,
      };
    })()`,
  );
}

async function clickConversation(cdp, sessionId, prompt) {
  return evaluateJson(
    cdp,
    sessionId,
    `(() => {
      const target = Array.from(document.querySelectorAll('button')).find((button) =>
        (button.textContent || '').includes(${JSON.stringify(prompt)})
      );
      if (!(target instanceof HTMLButtonElement)) {
        return false;
      }
      target.click();
      return true;
    })()`,
  );
}

async function sampleSwitch(cdp, sessionId, prompt, conversationId) {
  const startedAt = Date.now();
  const samples = [];
  while (Date.now() - startedAt < 1200) {
    const snapshot = await evaluateJson(
      cdp,
      sessionId,
      `(() => {
        const shell = document.querySelector('.openclaw-chat-surface-shell');
        const diagnostics = window.__ICLAW_APP_DIAGNOSTICS__ || null;
        const text = (document.body.innerText || '').replace(/\\s+/g, ' ').trim();
        const userTexts = Array.from(document.querySelectorAll('.chat-group.user .chat-text')).map((node) => (node.textContent || '').trim());
        const assistantTexts = Array.from(document.querySelectorAll('.chat-group.assistant .chat-text')).map((node) => (node.textContent || '').trim());
        return {
          routeConversationId: diagnostics?.activeChatRoute?.conversationId || null,
          activeSurfaceKey: diagnostics?.targetChatSurfaceKey || null,
          wrapperStillSame: !!document.querySelector('[data-switch-probe-wrapper=\"true\"]'),
          shellStillSame: !!document.querySelector('[data-switch-probe-shell=\"true\"]'),
          hostStillSame: !!document.querySelector('[data-switch-probe-host=\"true\"]'),
          shellTransitioning: shell?.getAttribute('data-session-transitioning') || null,
          surfaceReactivating: shell?.getAttribute('data-surface-reactivating') || null,
          hasBootMask: !!document.querySelector('.iclaw-chat-boot-mask'),
          hasWelcomePage: !!Array.from(document.querySelectorAll('*')).find((node) => (node.textContent || '').includes('问题建议')),
          textSample: text.slice(0, 280),
          userTexts,
          assistantTexts,
          targetHydrated:
            (diagnostics?.activeChatRoute?.conversationId || null) === ${JSON.stringify(conversationId)} &&
            userTexts.some((text) => text.includes(${JSON.stringify(prompt)})),
        };
      })()`,
    );
    samples.push({t: Date.now() - startedAt, ...snapshot});
    if (snapshot?.targetHydrated) {
      break;
    }
    await sleep(60);
  }
  return samples;
}

const pageWsUrl = await readBrowserWebSocketUrl();
const tokens = await login();
const seed = buildSeed(Date.now());
const browserCdp = new CDP(pageWsUrl);
await browserCdp.open();
const {targetId, sessionId} = await createSession(browserCdp);

try {
  await preparePage(browserCdp, sessionId, tokens, seed);
  const stablePage = await waitForAuthenticatedStablePage(browserCdp, sessionId);
  const seededScope = await seedCurrentScope(browserCdp, sessionId, seed);
  if (!seededScope?.scope) {
    throw new Error('failed to resolve authenticated scope for seed injection');
  }
  await waitFor(
    browserCdp,
    sessionId,
    'seeded sidebar items',
    async () => {
      const sidebar = await readSidebar(browserCdp, sessionId, seed);
      return Array.isArray(sidebar) && sidebar.length >= 2 ? sidebar : null;
    },
    10000,
    200,
  );
  await clickConversation(browserCdp, sessionId, seed.promptB);
  const initialSeededState = await waitForSeededConversation(
    browserCdp,
    sessionId,
    seed,
    seed.convB,
    seed.promptB,
    seed.assistantB,
  );
  const initialSidebar = await readSidebar(browserCdp, sessionId, seed);
  const nodeMarkers = await markStableNodes(browserCdp, sessionId);

  await clickConversation(browserCdp, sessionId, seed.promptA);
  const switchToASamples = await sampleSwitch(browserCdp, sessionId, seed.promptA, seed.convA);
  const sidebarAfterA = await readSidebar(browserCdp, sessionId, seed);

  await clickConversation(browserCdp, sessionId, seed.promptB);
  const switchToBSamples = await sampleSwitch(browserCdp, sessionId, seed.promptB, seed.convB);
  const sidebarAfterB = await readSidebar(browserCdp, sessionId, seed);

  console.log(JSON.stringify({
    seed: seed.seed,
    initialSeededState,
    initialSidebar,
    nodeMarkers,
    switchToA: {
      durationMs: switchToASamples.at(-1)?.t ?? null,
      samples: switchToASamples,
    },
    sidebarAfterA,
    switchToB: {
      durationMs: switchToBSamples.at(-1)?.t ?? null,
      samples: switchToBSamples,
    },
    sidebarAfterB,
  }, null, 2));
} finally {
  await browserCdp.send('Target.closeTarget', {targetId}).catch(() => {});
  browserCdp.close();
}
