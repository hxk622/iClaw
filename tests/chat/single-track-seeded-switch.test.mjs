import {writeFile} from 'node:fs/promises';

const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const CDP_VERSION_URL = 'http://127.0.0.1:9223/json/version';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-chat-single-track-seeded-switch.png';

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
      const persistenceScope =
        localStorage.getItem('licaiclaw:chat.user_scope') ||
        localStorage.getItem('iclaw:chat.user_scope') ||
        'guest';
      const activeRoute = JSON.parse(
        localStorage.getItem(\`licaiclaw:desktop.active-chat-route.v1:scope:\${persistenceScope}\`) ||
        localStorage.getItem(\`iclaw.desktop.active-chat-route.v1:scope:\${persistenceScope}\`) ||
        'null',
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

function buildSeededConversationData(seed) {
  const convA = `conv-seeded-a-${seed}`;
  const convB = `conv-seeded-b-${seed}`;
  const sessionA = `agent:main:seeded-a-${seed}`;
  const sessionB = `agent:main:seeded-b-${seed}`;
  const now = Date.now();
  const promptA = `seeded recent A ${seed}`;
  const promptB = `seeded recent B ${seed}`;
  const assistantA = `SEEDED_ASSISTANT_A_${seed}`;
  const assistantB = `SEEDED_ASSISTANT_B_${seed}`;

  return {
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
    },
    snapshotB: {
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
    },
  };
}

async function seedStorage(cdp, seedData) {
  return evalJSON(
    cdp,
    `(() => {
      const scope =
        localStorage.getItem('licaiclaw:chat.user_scope') ||
        localStorage.getItem('iclaw:chat.user_scope') ||
        'guest';
      const conversationKey = 'iclaw.chat.conversations.v1:scope:' + scope;
      const turnKey = 'iclaw.chat.turns.v1:scope:' + scope;
      const activeRouteKey = 'licaiclaw:desktop.active-chat-route.v1:scope:' + scope;
      const activeRouteGlobalKey = 'licaiclaw:desktop.active-chat-route.global.v1';
      const legacyActiveRouteKey = 'iclaw.desktop.active-chat-route.v1:scope:' + scope;
      const legacyActiveRouteGlobalKey = 'iclaw.desktop.active-chat-route.global.v1';
      const workspaceSceneKey = 'iclaw.desktop.active-workspace-scene.v1:scope:' + scope;
      const selectedConversationKey = 'iclaw.desktop.selected-conversation.v1:scope:' + scope;
      const appNames = ['iclaw', 'licaiclaw'];
      localStorage.setItem(conversationKey, JSON.stringify(${JSON.stringify(seedData.conversations)}));
      localStorage.setItem(turnKey, JSON.stringify(${JSON.stringify(seedData.turns)}));
      const routePayload = JSON.stringify({
        conversationId: ${JSON.stringify(seedData.convB)},
        sessionKey: ${JSON.stringify(seedData.sessionB)},
        initialPrompt: null,
        initialPromptKey: null,
        initialAgentSlug: null,
        initialSkillSlug: null,
        initialSkillOption: null,
        initialStockContext: null,
      });
      localStorage.setItem(activeRouteKey, routePayload);
      localStorage.setItem(activeRouteGlobalKey, routePayload);
      localStorage.setItem(legacyActiveRouteKey, routePayload);
      localStorage.setItem(legacyActiveRouteGlobalKey, routePayload);
      localStorage.setItem(
        workspaceSceneKey,
        JSON.stringify({
          primaryView: 'chat',
          selectedConversationId: ${JSON.stringify(seedData.convB)},
        }),
      );
      localStorage.setItem(
        selectedConversationKey,
        JSON.stringify({
          selectedConversationId: ${JSON.stringify(seedData.convB)},
        }),
      );
      appNames.forEach((appName) => {
        localStorage.setItem(
          \`iclaw.chat.session.v1:\${appName}:${seedData.sessionA.toLowerCase()}:scope:\${scope}\`,
          JSON.stringify(${JSON.stringify(seedData.snapshotA)}),
        );
        localStorage.setItem(
          \`iclaw.chat.session.v1:\${appName}:${seedData.sessionB.toLowerCase()}:scope:\${scope}\`,
          JSON.stringify(${JSON.stringify(seedData.snapshotB)}),
        );
        localStorage.setItem(
          \`iclaw.chat.conversation.v1:\${appName}:${seedData.convA.toLowerCase()}:scope:\${scope}\`,
          JSON.stringify(${JSON.stringify(seedData.snapshotA)}),
        );
        localStorage.setItem(
          \`iclaw.chat.conversation.v1:\${appName}:${seedData.convB.toLowerCase()}:scope:\${scope}\`,
          JSON.stringify(${JSON.stringify(seedData.snapshotB)}),
        );
      });
      window.dispatchEvent(new CustomEvent('iclaw:chat-conversations:updated'));
      window.dispatchEvent(new CustomEvent('iclaw:chat-turns:updated'));
      return {
        scope,
        conversationKey,
        turnKey,
        activeRouteKey,
        activeRouteGlobalKey,
        legacyActiveRouteKey,
        legacyActiveRouteGlobalKey,
        workspaceSceneKey,
        selectedConversationKey,
      };
    })()`,
  );
}

async function cleanupSeededStorage(cdp, seededStorage) {
  if (!seededStorage?.scope) {
    return;
  }

  await evalJSON(
    cdp,
    `(() => {
      const seededStorage = ${JSON.stringify(seededStorage)};
      const appNames = ['iclaw', 'licaiclaw'];
      localStorage.removeItem(seededStorage.conversationKey);
      localStorage.removeItem(seededStorage.turnKey);
      localStorage.removeItem(seededStorage.activeRouteKey);
      localStorage.removeItem(seededStorage.activeRouteGlobalKey);
      localStorage.removeItem(seededStorage.legacyActiveRouteKey);
      localStorage.removeItem(seededStorage.legacyActiveRouteGlobalKey);
      localStorage.removeItem(seededStorage.workspaceSceneKey);
      localStorage.removeItem(seededStorage.selectedConversationKey);
      appNames.forEach((appName) => {
        Object.keys(localStorage).forEach((key) => {
          if (!key.includes(\`:scope:\${seededStorage.scope}\`)) {
            return;
          }
          if (key.includes(\`iclaw.chat.session.v1:\${appName}:\`) || key.includes(\`iclaw.chat.conversation.v1:\${appName}:\`)) {
            localStorage.removeItem(key);
          }
        });
      });
      window.dispatchEvent(new CustomEvent('iclaw:chat-conversations:updated'));
      window.dispatchEvent(new CustomEvent('iclaw:chat-turns:updated'));
      return true;
    })()`,
  );
}

async function clickRecentConversation(cdp, textNeedle) {
  await waitFor(
    `recent item ${textNeedle}`,
    async () =>
      evalJSON(
        cdp,
        `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const target = buttons.find((button) => (button.textContent || '').includes(${JSON.stringify(textNeedle)}));
          if (!(target instanceof HTMLButtonElement)) {
            return null;
          }
          target.click();
          return true;
        })()`,
      ),
  );
}

async function main() {
  const target = await createIsolatedTarget();
  const cdp = new CDP(target.page.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  let seededStorage = null;

  try {
    const seed = Date.now();
    const seeded = buildSeededConversationData(seed);
    seededStorage = await seedStorage(cdp, seeded);
    await cdp.send('Page.reload', {ignoreCache: true});

    await waitForComposer(cdp);

    const initialState = await waitFor(
      'initial seeded conversation B',
      async () => {
        const state = await readActiveState(cdp);
        return state?.appDiagnostics?.activeChatRoute?.conversationId === seeded.convB &&
          state?.activeSurfaceKey === seeded.convB &&
          state?.userTexts?.some((text) => text.includes(seeded.promptB)) &&
          state?.assistantTexts?.some((text) => text.includes(seeded.assistantB))
          ? state
          : null;
      },
    );

    await clickRecentConversation(cdp, seeded.promptA);
    const switchedToA = await waitFor(
      'switched conversation A',
      async () => {
        const state = await readActiveState(cdp);
        return state?.appDiagnostics?.activeChatRoute?.conversationId === seeded.convA &&
          state?.activeSurfaceKey === seeded.convA &&
          state?.userTexts?.some((text) => text.includes(seeded.promptA)) &&
          state?.assistantTexts?.some((text) => text.includes(seeded.assistantA))
          ? state
          : null;
      },
    );

    await clickRecentConversation(cdp, seeded.promptB);
    const switchedBackToB = await waitFor(
      'switched conversation B',
      async () => {
        const state = await readActiveState(cdp);
        return state?.appDiagnostics?.activeChatRoute?.conversationId === seeded.convB &&
          state?.activeSurfaceKey === seeded.convB &&
          state?.userTexts?.some((text) => text.includes(seeded.promptB)) &&
          state?.assistantTexts?.some((text) => text.includes(seeded.assistantB))
          ? state
          : null;
      },
    );

    const sidebar = await readSidebarRecent(cdp);
    const screenshot = await cdp.send('Page.captureScreenshot', {format: 'png'});
    await writeFile(SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));
    console.log(
      JSON.stringify(
        {
          seed,
          targetPageId: target.targetId,
          initialConversation: initialState?.appDiagnostics?.activeChatRoute?.conversationId ?? null,
          afterSwitchToA: switchedToA?.appDiagnostics?.activeChatRoute?.conversationId ?? null,
          afterSwitchToB: switchedBackToB?.appDiagnostics?.activeChatRoute?.conversationId ?? null,
          sidebar,
          screenshot: SCREENSHOT_PATH,
          success: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanupSeededStorage(cdp, seededStorage).catch(() => {});
    cdp.close();
    await target.browserCdp.send('Target.closeTarget', {targetId: target.targetId}).catch(() => {});
    target.browserCdp.close();
  }
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
