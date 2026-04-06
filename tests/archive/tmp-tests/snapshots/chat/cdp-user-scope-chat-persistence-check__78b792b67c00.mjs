const CDP_LIST_URL = 'http://127.0.0.1:9223/json/list';
const APP_URL = 'http://127.0.0.1:1520/chat?session=main';

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 1;
    this.pending = new Map();
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (!msg.id || !this.pending.has(msg.id)) return;
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
    });
  }

  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  close() {
    this.ws.close();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPageWsUrl() {
  const response = await fetch(CDP_LIST_URL);
  const pages = await response.json();
  const page =
    pages.find((item) => typeof item?.url === 'string' && item.url.includes('127.0.0.1:1520')) || pages[0];
  if (!page?.webSocketDebuggerUrl) {
    throw new Error(`No debuggable page found in ${CDP_LIST_URL}`);
  }
  return page.webSocketDebuggerUrl;
}

async function evalJson(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
  }
  return result.result?.value;
}

const wsUrl = await getPageWsUrl();
const cdp = new CDP(wsUrl);

await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Page.navigate', { url: APP_URL });
await sleep(1500);

const result = await evalJson(
  cdp,
  `(async () => {
    const scopeModule = await import('/src/app/lib/chat-persistence-scope.ts');
    const turnsModule = await import('/src/app/lib/chat-turns.ts');
    const conversationsModule = await import('/src/app/lib/chat-conversations.ts');
    const historyModule = await import('/src/app/lib/chat-history.ts');

    localStorage.clear();
    sessionStorage.clear();

    const turnsKeyA = 'iclaw.chat.turns.v1:scope:user-a';
    const turnsKeyB = 'iclaw.chat.turns.v1:scope:user-b';
    const conversationsKeyA = 'iclaw.chat.conversations.v1:scope:user-a';
    const conversationsKeyB = 'iclaw.chat.conversations.v1:scope:user-b';
    const sessionKeyA = 'agent:main:user-a-main';
    const sessionKeyB = 'agent:main:user-b-main';
    const conversationIdA = 'conv-user-a';
    const conversationIdB = 'conv-user-b';

    localStorage.setItem(turnsKeyA, JSON.stringify([{
      id: 'turn-a',
      source: 'chat',
      conversationId: conversationIdA,
      sessionKey: sessionKeyA,
      title: 'A 的任务',
      summary: '只属于用户 A',
      prompt: '用户 A 的 prompt',
      status: 'completed',
      createdAt: '2026-04-03T00:00:00.000Z',
      updatedAt: '2026-04-03T00:00:00.000Z',
      artifacts: [],
      lastError: null,
    }]));

    localStorage.setItem(turnsKeyB, JSON.stringify([{
      id: 'turn-b',
      source: 'chat',
      conversationId: conversationIdB,
      sessionKey: sessionKeyB,
      title: 'B 的任务',
      summary: '只属于用户 B',
      prompt: '用户 B 的 prompt',
      status: 'completed',
      createdAt: '2026-04-03T00:01:00.000Z',
      updatedAt: '2026-04-03T00:01:00.000Z',
      artifacts: [],
      lastError: null,
    }]));

    localStorage.setItem(conversationsKeyA, JSON.stringify([{
      id: conversationIdA,
      kind: 'general',
      title: '会话 A',
      activeSessionKey: sessionKeyA,
      sessionKeys: [sessionKeyA],
      createdAt: '2026-04-03T00:00:00.000Z',
      updatedAt: '2026-04-03T00:00:00.000Z',
      handoffs: [],
    }]));

    localStorage.setItem(conversationsKeyB, JSON.stringify([{
      id: conversationIdB,
      kind: 'general',
      title: '会话 B',
      activeSessionKey: sessionKeyB,
      sessionKeys: [sessionKeyB],
      createdAt: '2026-04-03T00:01:00.000Z',
      updatedAt: '2026-04-03T00:01:00.000Z',
      handoffs: [],
    }]));

    scopeModule.writeCurrentChatPersistenceUserScope('user-a');
    historyModule.writeStoredChatSnapshot({
      appName: 'iclaw',
      sessionKey: sessionKeyA,
      conversationId: conversationIdA,
      snapshot: {
        sessionKey: sessionKeyA,
        savedAt: 1,
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hello from a' }] }],
        pendingUsageSettlements: [],
      },
    });

    scopeModule.writeCurrentChatPersistenceUserScope('user-b');
    historyModule.writeStoredChatSnapshot({
      appName: 'iclaw',
      sessionKey: sessionKeyB,
      conversationId: conversationIdB,
      snapshot: {
        sessionKey: sessionKeyB,
        savedAt: 2,
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hello from b' }] }],
        pendingUsageSettlements: [],
      },
    });

    scopeModule.writeCurrentChatPersistenceUserScope('user-a');
    const turnsA = turnsModule.readChatTurns().map((item) => item.title);
    const conversationsA = conversationsModule.readChatConversations().map((item) => item.id);
    const snapshotA = historyModule.readStoredChatSnapshot({
      appName: 'iclaw',
      sessionKey: sessionKeyA,
      conversationId: conversationIdA,
    });

    scopeModule.writeCurrentChatPersistenceUserScope('user-b');
    const turnsB = turnsModule.readChatTurns().map((item) => item.title);
    const conversationsB = conversationsModule.readChatConversations().map((item) => item.id);
    const snapshotB = historyModule.readStoredChatSnapshot({
      appName: 'iclaw',
      sessionKey: sessionKeyB,
      conversationId: conversationIdB,
    });

    return {
      activeScope: localStorage.getItem('iclaw:chat.user_scope'),
      turnsA,
      turnsB,
      conversationsA,
      conversationsB,
      snapshotAText: snapshotA?.messages?.[0]?.content?.[0]?.text || null,
      snapshotBText: snapshotB?.messages?.[0]?.content?.[0]?.text || null,
      rawKeys: Object.keys(localStorage).filter((key) => key.includes('scope:user-')).sort(),
    };
  })().catch((error) => ({
    __error: error instanceof Error ? error.message : String(error),
    __stack: error instanceof Error ? error.stack || null : null,
  }))`,
);

console.log(JSON.stringify(result, null, 2));
cdp.close();
