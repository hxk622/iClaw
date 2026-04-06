const LOGIN_URL = 'http://127.0.0.1:2130/auth/login';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';
const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const ACCESS_KEY = 'iclaw:auth.access_token';
const REFRESH_KEY = 'iclaw:auth.refresh_token';
const IDENTIFIER = process.env.ICLAW_IDENTIFIER || '515177265@qq.com';
const PASSWORD = process.env.ICLAW_PASSWORD || 'glp200663024';

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

function activeSurfaceExpression(body) {
  return `(() => {
    const activeLayer = Array.from(document.querySelectorAll('div')).find((node) => {
      const className = String(node.className || '');
      if (!className.includes('absolute inset-0 z-[1]')) {
        return false;
      }
      if (className.includes('invisible') || className.includes('pointer-events-none') || className.includes('opacity-0')) {
        return false;
      }
      return node.querySelector('.openclaw-chat-surface-shell');
    });
    const activeShell = activeLayer?.querySelector('.openclaw-chat-surface-shell') || null;
    const activeHost = activeLayer?.querySelector('.openclaw-chat-surface') || null;
    ${body}
  })()`;
}

async function evalJSON(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

async function waitFor(label, predicate, timeoutMs = 45000, intervalMs = 400) {
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

async function focusComposer(cdp) {
  const focused = await evalJSON(
    cdp,
    activeSurfaceExpression(`
      const editor = activeLayer?.querySelector('.iclaw-composer__editor');
      if (!(editor instanceof HTMLElement)) {
        return false;
      }
      editor.focus();
      return true;
    `),
  );
  if (!focused) {
    throw new Error('composer focus failed');
  }
}

async function waitForSubmitEnabled(cdp) {
  return waitFor(
    'composer submit enabled',
    async () =>
      evalJSON(
        cdp,
        activeSurfaceExpression(`
          const submit = activeLayer?.querySelector('.iclaw-composer__submit');
          return submit instanceof HTMLButtonElement && !submit.disabled
            ? {
                text: (submit.textContent || '').replace(/\\s+/g, ' ').trim(),
              }
            : null;
        `),
      ),
  );
}

async function fillComposerText(cdp, prompt) {
  const result = await evalJSON(
    cdp,
    activeSurfaceExpression(`
      const editor = activeLayer?.querySelector('.iclaw-composer__editor');
      if (!(editor instanceof HTMLElement)) {
        return {ok: false, reason: 'missing-editor'};
      }
      editor.focus();
      editor.textContent = ${JSON.stringify(prompt)};
      editor.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: ${JSON.stringify(prompt)},
      }));
      return {
        ok: true,
        text: editor.textContent || '',
      };
    `),
  );
  if (!result?.ok) {
    throw new Error(`fill composer failed: ${result?.reason || 'unknown'}`);
  }
}

async function clickWelcomeQuickAction(cdp, label) {
  const clicked = await evalJSON(
    cdp,
    activeSurfaceExpression(`
      const button = Array.from(activeLayer?.querySelectorAll('button') || []).find((node) =>
        (node.textContent || '').replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(label)})
      );
      if (!(button instanceof HTMLButtonElement)) {
        return false;
      }
      button.click();
      return true;
    `),
  );
  return Boolean(clicked);
}

async function clickSubmit(cdp) {
  const clicked = await evalJSON(
    cdp,
    activeSurfaceExpression(`
      const submit = activeLayer?.querySelector('.iclaw-composer__submit');
      if (!(submit instanceof HTMLButtonElement) || submit.disabled) {
        return false;
      }
      submit.click();
      return true;
    `),
  );
  if (!clicked) {
    throw new Error('submit click failed');
  }
}

async function clickButtonByExactText(cdp, label) {
  const clicked = await evalJSON(
    cdp,
    `(() => {
      const button = Array.from(document.querySelectorAll('button')).find((node) =>
        (node.textContent || '').replace(/\\s+/g, ' ').trim() === ${JSON.stringify(label)}
      );
      if (!(button instanceof HTMLButtonElement)) {
        return false;
      }
      button.click();
      return true;
    })()`,
  );
  if (!clicked) {
    throw new Error(`button not found: ${label}`);
  }
}

async function clickSidebarNewChat(cdp) {
  const clicked = await evalJSON(
    cdp,
    `(() => {
      const button = Array.from(document.querySelectorAll('button')).find((node) => {
        const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
        if (text !== '新建对话') {
          return false;
        }
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.left < 260 && rect.top < 220;
      });
      if (!(button instanceof HTMLButtonElement)) {
        return false;
      }
      button.click();
      return true;
    })()`,
  );
  if (!clicked) {
    throw new Error('sidebar new chat button not found');
  }
}

async function readSidebarRecent(cdp) {
  const items = await evalJSON(
    cdp,
    `(() => {
      const sectionTitle = Array.from(document.querySelectorAll('span')).find(
        (node) => (node.textContent || '').replace(/\\s+/g, ' ').trim() === '最近对话',
      );
      const section = sectionTitle?.closest('div.mb-3') || sectionTitle?.parentElement?.parentElement?.parentElement || null;
      if (!(section instanceof HTMLElement)) {
        return [];
      }
      const wrappers = Array.from(section.querySelectorAll('div')).filter((node) => {
        const className = String(node.className || '');
        return className.includes('group') && className.includes('relative') && className.includes('h-[68px]');
      });
      return wrappers.map((wrapper) => {
        const button = wrapper.querySelector('button.flex');
        const text = (button?.textContent || '').replace(/\\s+/g, ' ').trim();
        const className = wrapper.className || '';
        return {
          text,
          className,
          selected: className.includes('ring-1') || className.includes('shadow-[0_18px_36px'),
        };
      });
    })()`,
  );
  return Array.isArray(items) ? items : [];
}

async function waitForRecentItem(cdp, prompt) {
  return waitFor(
    `recent item ${prompt}`,
    async () => {
      const items = await readSidebarRecent(cdp);
      return items.find((item) => item.text.includes(prompt)) || null;
    },
    60000,
    500,
  );
}

async function clickRecentItem(cdp, prompt) {
  const clicked = await evalJSON(
    cdp,
    `(() => {
      const sectionTitle = Array.from(document.querySelectorAll('span')).find(
        (node) => (node.textContent || '').replace(/\\s+/g, ' ').trim() === '最近对话',
      );
      const section = sectionTitle?.closest('div.mb-3') || sectionTitle?.parentElement?.parentElement?.parentElement || null;
      if (!(section instanceof HTMLElement)) {
        return false;
      }
      const wrappers = Array.from(section.querySelectorAll('div')).filter((node) => {
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
  if (!clicked) {
    throw new Error(`recent item not found: ${prompt}`);
  }
}

async function readChatState(cdp) {
  return evalJSON(
    cdp,
    activeSurfaceExpression(`
      const userTexts = Array.from(activeLayer?.querySelectorAll('.openclaw-chat-surface .chat-group.user .chat-text') || [])
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean);
      const assistantTexts = Array.from(activeLayer?.querySelectorAll('.openclaw-chat-surface .chat-group.assistant .chat-text') || [])
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean);
      const persistenceScope = localStorage.getItem('iclaw:chat.user_scope') || 'guest';
      const activeRoute = JSON.parse(
        localStorage.getItem(\`iclaw.desktop.active-chat-route.v1:scope:\${persistenceScope}\`) || 'null',
      );
      return {
        userTexts,
        assistantTexts,
        lastUserText: userTexts.at(-1) || null,
        lastAssistantText: assistantTexts.at(-1) || null,
        groupCount: activeLayer?.querySelectorAll('.openclaw-chat-surface .chat-group').length || 0,
        hasSwitchMask: activeShell?.getAttribute('data-session-transitioning') === 'true',
        hasReactivationMask: activeShell?.getAttribute('data-surface-reactivating') === 'true',
        visibleWelcomeText: Array.from(activeLayer?.querySelectorAll('*') || []).some((node) => {
          const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
          if (!text) {
            return false;
          }
          return text.includes('开始新对话') || text.includes('输入研究问题');
        }),
        activeRoute,
      };
    `),
  );
}

async function waitForRouteChange(cdp, previousConversationId, previousSessionKey) {
  return waitFor(
    'active route changed',
    async () => {
      const state = await readChatState(cdp);
      const route = state?.activeRoute;
      if (!route) {
        return null;
      }
      const conversationChanged =
        route.conversationId && route.conversationId !== previousConversationId;
      const sessionChanged = route.sessionKey && route.sessionKey !== previousSessionKey;
      return conversationChanged || sessionChanged ? state : null;
    },
    10000,
    300,
  );
}

async function waitForPromptShown(cdp, prompt) {
  return waitFor(
    `prompt shown ${prompt}`,
    async () => {
      const state = await readChatState(cdp);
      return state.userTexts.some((text) => text.includes(prompt)) ? state : null;
    },
    60000,
    500,
  );
}

async function waitForAssistantReply(cdp, prompt) {
  return waitFor(
    `assistant reply ${prompt}`,
    async () => {
      const state = await readChatState(cdp);
      if (!state.userTexts.some((text) => text.includes(prompt))) {
        return null;
      }
      return state.lastAssistantText ? state : null;
    },
    90000,
    1000,
  );
}

async function sampleSwitchArtifacts(cdp, durationMs = 2200, intervalMs = 100) {
  const samples = [];
  const startedAt = Date.now();
  while (Date.now() - startedAt < durationMs) {
    const snapshot = await evalJSON(
      cdp,
      activeSurfaceExpression(`({
        at: Date.now(),
        hasSwitchMask: activeShell?.getAttribute('data-session-transitioning') === 'true',
        hasReactivationMask: activeShell?.getAttribute('data-surface-reactivating') === 'true',
        visibleWelcomeText: Array.from(activeLayer?.querySelectorAll('*') || []).some((node) => {
          const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
          if (!text) {
            return false;
          }
          return text.includes('开始新对话') || text.includes('输入研究问题');
        }),
      })`),
    );
    samples.push(snapshot);
    await sleep(intervalMs);
  }
  return samples;
}

async function sendPrompt(cdp, prompt) {
  await focusComposer(cdp);
  await fillComposerText(cdp, prompt);
  let submitReady = await waitForSubmitEnabled(cdp).catch(() => null);
  if (!submitReady) {
    const warmed = await clickWelcomeQuickAction(cdp, '直接聊聊');
    if (warmed) {
      await sleep(200);
      await fillComposerText(cdp, prompt);
      submitReady = await waitForSubmitEnabled(cdp);
    } else {
      throw new Error('composer submit never enabled');
    }
  }
  await clickSubmit(cdp);
  await waitForPromptShown(cdp, prompt);
  return waitForAssistantReply(cdp, prompt);
}

const wsUrl = await getPageWsUrl();
const tokens = await login();
const cdp = new CDP(wsUrl);

try {
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');
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
    'chat surface ready',
    async () =>
      evalJSON(
        cdp,
        activeSurfaceExpression(`
          const app = activeLayer?.querySelector('openclaw-app') || document.querySelector('openclaw-app');
          const editor = activeLayer?.querySelector('.iclaw-composer__editor');
          const bodyText = (document.body.innerText || '').replace(/\\s+/g, ' ');
          if (bodyText.includes('打开登录')) {
            return null;
          }
          return app?.connected && editor ? true : null;
        `),
      ),
    30000,
    500,
  );

  const promptA = `单轨验证A ${Date.now()}`;
  const stateAfterA = await sendPrompt(cdp, promptA);
  await waitForRecentItem(cdp, promptA);

  const routeBeforeNewChat = await readChatState(cdp);
  await clickSidebarNewChat(cdp);
  const afterNewChatState = await waitForRouteChange(
    cdp,
    routeBeforeNewChat.activeRoute?.conversationId ?? null,
    routeBeforeNewChat.activeRoute?.sessionKey ?? null,
  );

  const afterNewChatSidebar = await readSidebarRecent(cdp);

  const promptB = `单轨验证B ${Date.now()}`;
  const stateAfterB = await sendPrompt(cdp, promptB);
  await waitForRecentItem(cdp, promptB);

  const sidebarBeforeSwitch = await readSidebarRecent(cdp);
  const currentStateBeforeSwitch = await readChatState(cdp);

  await clickRecentItem(cdp, promptA);
  const switchSamplesA = await sampleSwitchArtifacts(cdp);
  const switchedToA = await waitForPromptShown(cdp, promptA);
  const sidebarAfterSwitchA = await readSidebarRecent(cdp);

  await clickRecentItem(cdp, promptB);
  const switchSamplesB = await sampleSwitchArtifacts(cdp);
  const switchedToB = await waitForPromptShown(cdp, promptB);
  const sidebarAfterSwitchB = await readSidebarRecent(cdp);

  console.log(
    JSON.stringify(
      {
        promptA,
        promptB,
        stateAfterA,
        afterNewChatState,
        afterNewChatSidebar,
        stateAfterB,
        sidebarBeforeSwitch,
        currentStateBeforeSwitch,
        switchToA: {
          samples: switchSamplesA,
          finalState: switchedToA,
          sidebar: sidebarAfterSwitchA,
        },
        switchToB: {
          samples: switchSamplesB,
          finalState: switchedToB,
          sidebar: sidebarAfterSwitchB,
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  const failureState = await readChatState(cdp).catch(() => null);
  const failureSidebar = await readSidebarRecent(cdp).catch(() => []);
  const failureBody = await evalJSON(
    cdp,
    activeSurfaceExpression(`({
      bodyText: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1800),
      composerText: (() => {
        const editor = activeLayer?.querySelector('.iclaw-composer__editor');
        return editor?.textContent || null;
      })(),
    })`),
  ).catch(() => null);
  console.error(
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
        failureState,
        failureSidebar,
        failureBody,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  cdp.close();
}
