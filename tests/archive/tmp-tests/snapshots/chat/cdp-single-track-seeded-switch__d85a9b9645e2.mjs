const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const CDP_VERSION_URL = 'http://127.0.0.1:9223/json/version';
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

async function waitFor(label, predicate, timeoutMs = 30000, intervalMs = 250) {
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

function activeSurfaceExpression(body) {
  return `(() => {
    const shells = Array.from(document.querySelectorAll('.openclaw-chat-surface-shell'));
    const entries = shells.map((shell, index) => {
      const wrapper = shell.closest('[data-chat-surface-key]') || shell.parentElement || shell;
      const style = getComputedStyle(wrapper);
      const rect = wrapper.getBoundingClientRect();
      const className = String(wrapper.className || '');
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        style.pointerEvents !== 'none' &&
        !className.includes('invisible');
      return {shell, wrapper, visible, index};
    });
    const activeEntry = entries.find((entry) => entry.visible) || null;
    const activeShell = activeEntry?.shell || null;
    const activeWrapper = activeEntry?.wrapper || null;
    ${body}
  })()`;
}

async function getPages() {
  const res = await fetch(CDP_LIST_URL);
  const pages = await res.json();
  return pages.filter((page) => String(page.url || '').includes('127.0.0.1:1520'));
}

async function getBrowserWebSocketUrl() {
  const res = await fetch(CDP_VERSION_URL);
  const version = await res.json();
  if (!version?.webSocketDebuggerUrl) {
    throw new Error('browser websocket url not found');
  }
  return version.webSocketDebuggerUrl;
}

async function createIsolatedTarget() {
  const browserCdp = new CDP(await getBrowserWebSocketUrl());
  await browserCdp.open();
  await browserCdp.send('Target.setDiscoverTargets', {discover: true});
  const created = await browserCdp.send('Target.createTarget', {url: APP_URL});
  const targetId = created?.targetId;
  if (!targetId) {
    browserCdp.close();
    throw new Error('failed to create isolated target');
  }

  let page = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const pages = await getPages();
    page = pages.find((candidate) => candidate.id === targetId) || null;
    if (page?.webSocketDebuggerUrl) {
      break;
    }
    await sleep(250);
  }

  if (!page?.webSocketDebuggerUrl) {
    await browserCdp.send('Target.closeTarget', {targetId}).catch(() => {});
    browserCdp.close();
    throw new Error(`isolated target page websocket not found for ${targetId}`);
  }

  return {
    browserCdp,
    targetId,
    page,
  };
}

async function waitForComposer(cdp) {
  return waitFor(
    'composer ready',
    async () =>
      evalJSON(
        cdp,
        activeSurfaceExpression(`
          const editor = activeWrapper?.querySelector('.iclaw-composer__editor');
          return activeWrapper && editor ? true : null;
        `),
      ),
  );
}

async function readActiveState(cdp) {
  return evalJSON(
    cdp,
    activeSurfaceExpression(`
      const app = activeWrapper?.querySelector('openclaw-app') || document.querySelector('openclaw-app');
      const persistenceScope = localStorage.getItem('iclaw:chat.user_scope') || 'guest';
      const activeRoute = JSON.parse(
        localStorage.getItem(\`iclaw.desktop.active-chat-route.v1:scope:\${persistenceScope}\`) || 'null',
      );
      const userTexts = Array.from(activeWrapper?.querySelectorAll('.chat-group.user .chat-text') || [])
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean);
      const assistantTexts = Array.from(activeWrapper?.querySelectorAll('.chat-group.assistant .chat-text') || [])
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean);
      return {
        route: activeRoute,
        appDiagnostics: window.__ICLAW_APP_DIAGNOSTICS__ || null,
        shellCount: document.querySelectorAll('.openclaw-chat-surface-shell').length,
        activeShellIndex: activeEntry?.index ?? null,
        activeSurfaceKey: activeWrapper?.getAttribute('data-chat-surface-key') || null,
        activeSurfaceMarked: activeWrapper?.getAttribute('data-chat-surface-active') || null,
        activeTextSample: (activeWrapper?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 600),
        userTexts,
        assistantTexts,
        chatGroupCount: activeWrapper?.querySelectorAll('.chat-group').length || 0,
        submitDisabled:
          activeWrapper?.querySelector('.iclaw-composer__submit') instanceof HTMLButtonElement
            ? activeWrapper.querySelector('.iclaw-composer__submit').disabled
            : null,
        sessionTransitioning: activeShell?.getAttribute('data-session-transitioning') || null,
        surfaceReactivating: activeShell?.getAttribute('data-surface-reactivating') || null,
        connected: Boolean(app?.connected),
      };
    `),
  );
}

async function readSidebarRecent(cdp) {
  const items = await evalJSON(
    cdp,
    `(() => {
      const sectionTitle = Array.from(document.querySelectorAll('span')).find(
        (node) => (node.textContent || '').replace(/\\s+/g, ' ').trim() === '最近对话',
      );
      const section = sectionTitle?.closest('div.mb-3') || null;
      if (!(section instanceof HTMLElement)) {
        return [];
      }
      const wrappers = Array.from(section.querySelectorAll('div')).filter((node) => {
        const className = String(node.className || '');
        return className.includes('group') && className.includes('relative') && className.includes('h-[68px]');
      });
      return wrappers.map((wrapper) => ({
        text: (wrapper.textContent || '').replace(/\\s+/g, ' ').trim(),
        className: String(wrapper.className || ''),
      }));
    })()`,
  );
  return Array.isArray(items) ? items : [];
}

function extractSelectedRecentPrompt(sidebarItems) {
  const selected = Array.isArray(sidebarItems)
    ? sidebarItems.find((item) => String(item.className || '').includes('border-[color-mix(in_srgb,var(--brand-primary)_34%'))
    : null;
  return selected?.text || null;
}

async function clickRecent(cdp, prompt) {
  const ok = await evalJSON(
    cdp,
    `(() => {
      const wrappers = Array.from(document.querySelectorAll('div')).filter((node) => {
        const className = String(node.className || '');
        return className.includes('group') && className.includes('relative') && className.includes('h-[68px]');
      });
      const wrapper = wrappers.find((node) => ((node.textContent || '').replace(/\\s+/g, ' ').trim()).includes(${JSON.stringify(prompt)}));
      const button = wrapper?.querySelector('button.flex');
      if (!(button instanceof HTMLButtonElement)) {
        return false;
      }
      button.click();
      return true;
    })()`,
  );
  if (!ok) {
    throw new Error(`recent item not found: ${prompt}`);
  }
}

async function readSeedStorage(cdp, seed) {
  return evalJSON(
    cdp,
    `(() => {
      const marker = ${JSON.stringify(String(seed))};
      const entries = Object.keys(localStorage)
        .filter((key) => key.includes(marker) || key.includes('chat.user_scope') || key.includes('active-chat-route'))
        .sort()
        .map((key) => {
          const raw = localStorage.getItem(key);
          return {
            key,
            raw,
          };
        });
      return entries;
    })()`,
  );
}

async function sampleMasks(cdp, durationMs = 1500, intervalMs = 100) {
  const samples = [];
  const startedAt = Date.now();
  while (Date.now() - startedAt < durationMs) {
    const state = await readActiveState(cdp);
    samples.push({
      sessionTransitioning: state.sessionTransitioning,
      surfaceReactivating: state.surfaceReactivating,
      activeShellIndex: state.activeShellIndex,
      userTail: state.userTexts.at(-1) || null,
      assistantTail: state.assistantTexts.at(-1) || null,
    });
    await sleep(intervalMs);
  }
  return samples;
}

async function seedDeterministicConversations(cdp, seed) {
  return evalJSON(
    cdp,
    `(() => {
      const scope = localStorage.getItem('iclaw:chat.user_scope') || 'guest';
      const scopeKey = encodeURIComponent(scope);
      const now = Date.now();
      const convA = 'conv-seeded-a-${seed}';
      const convB = 'conv-seeded-b-${seed}';
      const sessionA = 'agent:main:seeded-a-${seed}';
      const sessionB = 'agent:main:seeded-b-${seed}';
      const promptA = 'seeded recent A ${seed}';
      const promptB = 'seeded recent B ${seed}';
      const assistantA = 'SEEDED_ASSISTANT_A_${seed}';
      const assistantB = 'SEEDED_ASSISTANT_B_${seed}';
      const conversationKey = \`iclaw.chat.conversations.v1:scope:\${scopeKey}\`;
      const turnKey = \`iclaw.chat.turns.v1:scope:\${scopeKey}\`;
      const activeRouteKey = \`iclaw.desktop.active-chat-route.v1:scope:\${scopeKey}\`;
      const sessionSnapshotKeyA = \`iclaw.chat.session.v1:iclaw:\${sessionA.toLowerCase()}:scope:\${scopeKey}\`;
      const sessionSnapshotKeyB = \`iclaw.chat.session.v1:iclaw:\${sessionB.toLowerCase()}:scope:\${scopeKey}\`;
      const conversationSnapshotKeyA = \`iclaw.chat.conversation.v1:iclaw:\${convA.toLowerCase()}:scope:\${scopeKey}\`;
      const conversationSnapshotKeyB = \`iclaw.chat.conversation.v1:iclaw:\${convB.toLowerCase()}:scope:\${scopeKey}\`;

      const readJson = (key, fallback) => {
        try {
          return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
        } catch {
          return fallback;
        }
      };

      const existingConversations = readJson(conversationKey, []);
      const filteredConversations = Array.isArray(existingConversations)
        ? existingConversations.filter((item) => ![convA, convB].includes(item?.id))
        : [];
      const seededConversations = [
        {
          id: convB,
          kind: 'general',
          title: null,
          activeSessionKey: sessionB,
          sessionKeys: [sessionB],
          createdAt: new Date(now - 1000).toISOString(),
          updatedAt: new Date(now).toISOString(),
          handoffs: [],
        },
        {
          id: convA,
          kind: 'general',
          title: null,
          activeSessionKey: sessionA,
          sessionKeys: [sessionA],
          createdAt: new Date(now - 2000).toISOString(),
          updatedAt: new Date(now - 500).toISOString(),
          handoffs: [],
        },
        ...filteredConversations,
      ];
      localStorage.setItem(conversationKey, JSON.stringify(seededConversations));

      const existingTurns = readJson(turnKey, []);
      const filteredTurns = Array.isArray(existingTurns)
        ? existingTurns.filter((item) => ![convA, convB].includes(item?.conversationId))
        : [];
      const seededTurns = [
        {
          id: 'turn-seeded-b-${seed}',
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
          id: 'turn-seeded-a-${seed}',
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
        ...filteredTurns,
      ];
      localStorage.setItem(turnKey, JSON.stringify(seededTurns));

      const snapshotA = {
        sessionKey: sessionA,
        savedAt: now - 500,
        messages: [
          {
            role: 'user',
            content: [{type: 'text', text: promptA}],
            timestamp: now - 800,
          },
          {
            role: 'assistant',
            content: [{type: 'text', text: assistantA}],
            timestamp: now - 500,
            __iclawBillingSummary: {
              lobsterCredits: 11,
              inputTokens: 7,
              outputTokens: 9,
            },
          },
        ],
        pendingUsageSettlements: [],
      };
      const snapshotB = {
        sessionKey: sessionB,
        savedAt: now,
        messages: [
          {
            role: 'user',
            content: [{type: 'text', text: promptB}],
            timestamp: now - 300,
          },
          {
            role: 'assistant',
            content: [{type: 'text', text: assistantB}],
            timestamp: now,
            __iclawBillingSummary: {
              lobsterCredits: 12,
              inputTokens: 8,
              outputTokens: 10,
            },
          },
        ],
        pendingUsageSettlements: [],
      };
      localStorage.setItem(sessionSnapshotKeyA, JSON.stringify(snapshotA));
      localStorage.setItem(sessionSnapshotKeyB, JSON.stringify(snapshotB));
      localStorage.setItem(conversationSnapshotKeyA, JSON.stringify(snapshotA));
      localStorage.setItem(conversationSnapshotKeyB, JSON.stringify(snapshotB));

      localStorage.setItem(
        activeRouteKey,
        JSON.stringify({
          conversationId: convB,
          sessionKey: sessionB,
          initialPrompt: null,
          initialPromptKey: null,
          initialAgentSlug: null,
          initialSkillSlug: null,
          initialSkillOption: null,
          initialStockContext: null,
        }),
      );

      window.dispatchEvent(new CustomEvent('iclaw:chat-conversations:updated'));
      window.dispatchEvent(new CustomEvent('iclaw:chat-turns:updated'));

      return {
        scope,
        convA,
        convB,
        sessionA,
        sessionB,
        promptA,
        promptB,
        assistantA,
        assistantB,
      };
    })()`,
  );
}

const isolatedTarget = await createIsolatedTarget();
const targetPage = isolatedTarget.page;
const cdp = new CDP(targetPage.webSocketDebuggerUrl);
const seed = Date.now();

try {
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', {url: APP_URL});

  await waitForComposer(cdp);
  const seeded = await seedDeterministicConversations(cdp, seed);
  await cdp.send('Page.reload', {ignoreCache: true});
  await waitForComposer(cdp);

  const initialState = await waitFor(
    'seeded conversation B hydration',
    async () => {
      const state = await readActiveState(cdp);
      return state?.appDiagnostics?.activeChatRoute?.conversationId === seeded.convB &&
        state?.shellCount === 1 &&
        state.userTexts.some((text) => text.includes(seeded.promptB)) &&
        state.assistantTexts.some((text) => text.includes(seeded.assistantB))
        ? state
        : null;
    },
    20000,
    200,
  );

  await clickRecent(cdp, seeded.promptA);
  const maskSamplesA = await sampleMasks(cdp);
  const switchedA = await waitFor(
    'switch to seeded A',
    async () => {
      const state = await readActiveState(cdp);
      const sidebar = await readSidebarRecent(cdp);
      const selectedText = extractSelectedRecentPrompt(sidebar);
      return state?.appDiagnostics?.activeChatRoute?.conversationId === seeded.convA &&
        state?.activeSurfaceKey === seeded.convA &&
        state?.shellCount === 1 &&
        state.userTexts.some((text) => text.includes(seeded.promptA)) &&
        state.assistantTexts.some((text) => text.includes(seeded.assistantA)) &&
        selectedText?.includes(seeded.promptA)
        ? {
            state,
            selectedText,
          }
        : null;
    },
    15000,
    200,
  );

  await clickRecent(cdp, seeded.promptB);
  const maskSamplesB = await sampleMasks(cdp);
  const switchedB = await waitFor(
    'switch to seeded B',
    async () => {
      const state = await readActiveState(cdp);
      const sidebar = await readSidebarRecent(cdp);
      const selectedText = extractSelectedRecentPrompt(sidebar);
      return state?.appDiagnostics?.activeChatRoute?.conversationId === seeded.convB &&
        state?.activeSurfaceKey === seeded.convB &&
        state?.shellCount === 1 &&
        state.userTexts.some((text) => text.includes(seeded.promptB)) &&
        state.assistantTexts.some((text) => text.includes(seeded.assistantB)) &&
        selectedText?.includes(seeded.promptB)
        ? {
            state,
            selectedText,
          }
        : null;
    },
    15000,
    200,
  );

  const sidebarEnd = await readSidebarRecent(cdp);
  console.log(
    JSON.stringify(
      {
        targetPageId: targetPage.id,
        seed,
        seeded,
        initialState,
        switchA: {
          maskSamplesA,
          switchedA,
        },
        switchB: {
          maskSamplesB,
          switchedB,
        },
        sidebarEnd,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const failureState = await readActiveState(cdp).catch(() => null);
  const failureSidebar = await readSidebarRecent(cdp).catch(() => []);
  const failureSeedStorage = await readSeedStorage(cdp, seed).catch(() => []);
  console.error(
    JSON.stringify(
      {
        targetPageId: targetPage.id,
        seed,
        error: error instanceof Error ? error.message : String(error),
        failureState,
        failureSidebar,
        failureSeedStorage,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  cdp.close();
  await isolatedTarget.browserCdp.send('Target.closeTarget', {targetId: isolatedTarget.targetId}).catch(() => {});
  isolatedTarget.browserCdp.close();
}
