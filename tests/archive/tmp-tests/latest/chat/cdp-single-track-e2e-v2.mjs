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

async function waitFor(label, predicate, timeoutMs = 60000, intervalMs = 500) {
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
          const submit = activeWrapper?.querySelector('.iclaw-composer__submit');
          return activeWrapper && editor && submit
            ? {
                submitDisabled: submit.disabled,
                body: (activeWrapper.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 400),
              }
            : null;
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
      const submit = activeWrapper?.querySelector('.iclaw-composer__submit');
      const editor = activeWrapper?.querySelector('.iclaw-composer__editor');
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
        editorText: editor?.textContent || null,
        submitDisabled: submit instanceof HTMLButtonElement ? submit.disabled : null,
        sessionTransitioning: activeShell?.getAttribute('data-session-transitioning') || null,
        surfaceReactivating: activeShell?.getAttribute('data-surface-reactivating') || null,
        connected: Boolean(app?.connected),
        chatSending: Boolean(app?.chatSending),
        chatRunId: typeof app?.chatRunId === 'string' ? app.chatRunId : null,
      };
    `),
  );
}

async function readConversationStore(cdp) {
  return evalJSON(
    cdp,
    `(() => {
      const conversations = Object.entries(localStorage)
        .filter(([key]) => key.startsWith('iclaw.chat.conversations.v1:scope:'))
        .map(([key, raw]) => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch {}
          return {
            key,
            count: Array.isArray(parsed) ? parsed.length : 0,
            items: Array.isArray(parsed)
              ? parsed.slice(0, 12).map((item) => ({
                  id: item?.id || null,
                  title: item?.title || null,
                  activeSessionKey: item?.activeSessionKey || null,
                  updatedAt: item?.updatedAt || null,
                }))
              : [],
          };
        });
      const turns = Object.entries(localStorage)
        .filter(([key]) => key.startsWith('iclaw.chat.turns.v1:scope:'))
        .map(([key, raw]) => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch {}
          return {
            key,
            count: Array.isArray(parsed) ? parsed.length : 0,
            items: Array.isArray(parsed)
              ? parsed.slice(0, 20).map((item) => ({
                  id: item?.id || null,
                  conversationId: item?.conversationId || null,
                  sessionKey: item?.sessionKey || null,
                  title: item?.title || null,
                  prompt: item?.prompt || null,
                  updatedAt: item?.updatedAt || null,
                }))
              : [],
          };
        });
      return {conversations, turns};
    })()`,
  );
}

async function readShellsState(cdp) {
  return evalJSON(
    cdp,
    `(() => {
      return Array.from(document.querySelectorAll('.openclaw-chat-surface-shell')).map((shell, index) => {
        const wrapper = shell.closest('[data-chat-surface-key]') || shell.parentElement || shell;
        const style = getComputedStyle(wrapper);
        const rect = wrapper.getBoundingClientRect();
        const text = ((wrapper.innerText || shell.innerText || '').replace(/\\s+/g, ' ').trim()).slice(0, 500);
        return {
          index,
          wrapperClass: String(wrapper?.className || ''),
          surfaceKey: wrapper?.getAttribute('data-chat-surface-key') || null,
          surfaceActive: wrapper?.getAttribute('data-chat-surface-active') || null,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
          width: rect.width,
          height: rect.height,
          sessionTransitioning: shell.getAttribute('data-session-transitioning'),
          surfaceReactivating: shell.getAttribute('data-surface-reactivating'),
          userCount: wrapper?.querySelectorAll('.chat-group.user').length || 0,
          assistantCount: wrapper?.querySelectorAll('.chat-group.assistant').length || 0,
          editorText: wrapper?.querySelector('.iclaw-composer__editor')?.textContent || null,
          text,
        };
      });
    })()`,
  );
}

async function sendPrompt(cdp, prompt) {
  await evalJSON(
    cdp,
    activeSurfaceExpression(`
      const editor = activeWrapper?.querySelector('.iclaw-composer__editor');
      if (!(editor instanceof HTMLElement)) {
        return false;
      }
      editor.focus();
      return true;
    `),
  );
  await cdp.send('Input.insertText', {text: prompt});
  let submitReady = await waitFor(
    `submit enabled ${prompt}`,
    async () => {
      const state = await readActiveState(cdp);
      return state.submitDisabled === false ? state : null;
    },
    10000,
    300,
  ).catch(() => null);
  if (!submitReady) {
    await evalJSON(
      cdp,
      activeSurfaceExpression(`
        const editor = activeWrapper?.querySelector('.iclaw-composer__editor');
        if (!(editor instanceof HTMLElement)) {
          return false;
        }
        editor.textContent = ${JSON.stringify(prompt)};
        editor.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: ${JSON.stringify(prompt)},
        }));
        return true;
      `),
    );
    submitReady = await waitFor(
      `submit enabled fallback ${prompt}`,
      async () => {
        const state = await readActiveState(cdp);
        return state.submitDisabled === false ? state : null;
      },
      10000,
      300,
    );
  }
  await evalJSON(
    cdp,
    activeSurfaceExpression(`
      const submit = activeWrapper?.querySelector('.iclaw-composer__submit');
      if (!(submit instanceof HTMLButtonElement)) {
        return false;
      }
      submit.click();
      return true;
    `),
  );
  return waitFor(
    `prompt shown ${prompt}`,
    async () => {
      const state = await readActiveState(cdp);
      return state.userTexts.some((text) => text.includes(prompt)) ? state : null;
    },
    60000,
    1000,
  );
}

async function waitForAssistantSettled(cdp, prompt) {
  return waitFor(
    `assistant settled ${prompt}`,
    async () => {
      const state = await readActiveState(cdp);
      const hasPrompt = state.userTexts.some((text) => text.includes(prompt));
      const hasAssistant = state.assistantTexts.length > 0;
      const settled = state.chatSending === false && state.chatRunId === null;
      return hasPrompt && hasAssistant && settled ? state : null;
    },
    90000,
    1000,
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

async function waitForRecent(cdp, prompt) {
  return waitFor(
    `recent ${prompt}`,
    async () => {
      const items = await readSidebarRecent(cdp);
      return items.find((item) => item.text.includes(prompt)) || null;
    },
    60000,
    500,
  );
}

async function clickSidebarNewChat(cdp) {
  const ok = await evalJSON(
    cdp,
    `(() => {
      const button = Array.from(document.querySelectorAll('button')).find((node) => {
        const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
        if (text !== '新建对话') {
          return false;
        }
        const rect = node.getBoundingClientRect();
        return rect.left >= 0 && rect.left < 260 && rect.top < 220 && rect.width > 0 && rect.height > 0;
      });
      if (!(button instanceof HTMLButtonElement)) {
        return false;
      }
      button.click();
      return true;
    })()`,
  );
  if (!ok) {
    throw new Error('sidebar new chat button not found');
  }
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

async function waitForRouteChange(cdp, previousRoute) {
  return waitFor(
    'route change',
    async () => {
      const state = await readActiveState(cdp);
      const route = state.route;
      if (!route) {
        return null;
      }
      if (route.conversationId !== previousRoute?.conversationId || route.sessionKey !== previousRoute?.sessionKey) {
        return state;
      }
      return null;
    },
    15000,
    300,
  );
}

async function sampleMasks(cdp, durationMs = 2000, intervalMs = 100) {
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

function extractSelectedRecentPrompt(sidebarItems) {
  const selected = Array.isArray(sidebarItems)
    ? sidebarItems.find((item) => String(item.className || '').includes('border-[color-mix(in_srgb,var(--brand-primary)_34%'))
    : null;
  return selected?.text || null;
}

const isolatedTarget = await createIsolatedTarget();
const targetPage = isolatedTarget.page;
const cdp = new CDP(targetPage.webSocketDebuggerUrl);
const promptA = `单轨核验A ${Date.now()}`;
const promptB = `单轨核验B ${Date.now()}`;
const checkpoints = {};

try {
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await waitForComposer(cdp);
  checkpoints.initialStore = await readConversationStore(cdp);
  const initialState = await readActiveState(cdp);
  checkpoints.initialState = initialState;

  await clickSidebarNewChat(cdp);
  const routeForFreshA = await waitForRouteChange(cdp, initialState.route);
  checkpoints.freshA = {
    state: routeForFreshA,
    store: await readConversationStore(cdp),
  };

  const sentA = await sendPrompt(cdp, promptA);
  const settledA = await waitForAssistantSettled(cdp, promptA);
  const conversationIdA = sentA?.appDiagnostics?.activeChatRoute?.conversationId || sentA?.route?.conversationId || null;
  checkpoints.sentA = {
    state: await readActiveState(cdp),
    settled: settledA,
    store: await readConversationStore(cdp),
    promptShown: sentA,
    conversationIdA,
  };
  await waitForRecent(cdp, promptA);

  const beforeNewChat = await readActiveState(cdp);
  checkpoints.beforeNewChat = {
    state: beforeNewChat,
    store: await readConversationStore(cdp),
  };
  await clickSidebarNewChat(cdp);
  const afterNewChat = await waitForRouteChange(cdp, beforeNewChat.route);
  checkpoints.afterNewChat = {
    state: afterNewChat,
    store: await readConversationStore(cdp),
  };

  const sentB = await sendPrompt(cdp, promptB);
  const settledB = await waitForAssistantSettled(cdp, promptB);
  const conversationIdB = sentB?.appDiagnostics?.activeChatRoute?.conversationId || sentB?.route?.conversationId || null;
  checkpoints.sentB = {
    state: await readActiveState(cdp),
    settled: settledB,
    store: await readConversationStore(cdp),
    promptShown: sentB,
    conversationIdB,
  };
  await waitForRecent(cdp, promptB);

  const beforeSwitch = await readActiveState(cdp);
  checkpoints.beforeSwitch = {
    state: beforeSwitch,
    store: await readConversationStore(cdp),
  };
  await clickRecent(cdp, promptA);
  const maskSamplesA = await sampleMasks(cdp);
  const switchedA = await waitFor(
    `switch to ${promptA}`,
    async () => {
      const state = await readActiveState(cdp);
      const sidebar = await readSidebarRecent(cdp);
      const selectedText = extractSelectedRecentPrompt(sidebar);
      return state?.appDiagnostics?.activeChatRoute?.conversationId === conversationIdA &&
        state?.activeSurfaceKey === conversationIdA &&
        selectedText?.includes(promptA)
        ? {
            state,
            selectedText,
          }
        : null;
    },
    20000,
    300,
  );

  await clickRecent(cdp, promptB);
  const maskSamplesB = await sampleMasks(cdp);
  const switchedB = await waitFor(
    `switch to ${promptB}`,
    async () => {
      const state = await readActiveState(cdp);
      const sidebar = await readSidebarRecent(cdp);
      const selectedText = extractSelectedRecentPrompt(sidebar);
      return state?.appDiagnostics?.activeChatRoute?.conversationId === conversationIdB &&
        state?.activeSurfaceKey === conversationIdB &&
        selectedText?.includes(promptB)
        ? {
            state,
            selectedText,
          }
        : null;
    },
    20000,
    300,
  );

  const sidebarEnd = await readSidebarRecent(cdp);

  console.log(
    JSON.stringify(
      {
        targetPageId: targetPage.id,
        promptA,
        promptB,
        initialState,
        sentA,
        beforeNewChat,
        afterNewChat,
        sentB,
        beforeSwitch,
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
  const failureShells = await readShellsState(cdp).catch(() => []);
  const failureStore = await readConversationStore(cdp).catch(() => null);
  console.error(
    JSON.stringify(
      {
        targetPageId: targetPage.id,
        promptA,
        promptB,
        checkpoints,
        error: error instanceof Error ? error.message : String(error),
        failureState,
        failureStore,
        failureSidebar,
        failureShells,
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
