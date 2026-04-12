import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ensureChatConversation,
  readChatConversation,
  syncChatConversationActiveAgent,
} from './chat-conversations.ts';

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function installWindowStoragePolyfill() {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const listeners = new Map<string, Set<(event?: Event) => void>>();
  const win = {
    localStorage,
    sessionStorage,
    addEventListener(type: string, listener: (event?: Event) => void) {
      const current = listeners.get(type) ?? new Set();
      current.add(listener);
      listeners.set(type, current);
    },
    removeEventListener(type: string, listener: (event?: Event) => void) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: Event) {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
  };
  Object.assign(globalThis, {
    window: win,
    localStorage,
    sessionStorage,
    CustomEvent: class CustomEvent<T = unknown> extends Event {
      readonly detail: T;
      constructor(type: string, params?: CustomEventInit<T>) {
        super(type);
        this.detail = params?.detail as T;
      }
    },
  });
}

test('conversation tracks active agent handoffs within one thread', () => {
  installWindowStoragePolyfill();

  const created = ensureChatConversation({
    conversationId: 'conv-agent-handoff',
    sessionKey: 'agent:main:main',
    kind: 'lobster',
    title: 'Agent handoff',
    summary: 'handoff flow',
  });

  assert.equal(created.activeAgentId, null);

  const afterFirst = syncChatConversationActiveAgent({
    conversationId: created.id,
    sessionKey: 'agent:main:main',
    agentId: 'nuwa-jobs',
    reason: 'agent-selected-for-send',
    summary: '乔布斯开始接手当前对话',
  });

  assert.equal(afterFirst?.activeAgentId, 'nuwa-jobs');
  assert.equal(afterFirst?.handoffs.length, 1);
  assert.equal(afterFirst?.handoffs[0]?.fromAgentId, null);
  assert.equal(afterFirst?.handoffs[0]?.toAgentId, 'nuwa-jobs');

  const afterSecond = syncChatConversationActiveAgent({
    conversationId: created.id,
    sessionKey: 'agent:main:main',
    agentId: 'nuwa-munger',
    reason: 'agent-selected-for-send',
    summary: '芒格接手当前对话',
  });

  assert.equal(afterSecond?.activeAgentId, 'nuwa-munger');
  assert.equal(afterSecond?.handoffs.length, 2);
  assert.equal(afterSecond?.handoffs[0]?.fromAgentId, 'nuwa-jobs');
  assert.equal(afterSecond?.handoffs[0]?.toAgentId, 'nuwa-munger');

  const afterClear = syncChatConversationActiveAgent({
    conversationId: created.id,
    sessionKey: 'agent:main:main',
    agentId: null,
    reason: 'agent-cleared-for-send',
    summary: '恢复主执行上下文',
  });

  assert.equal(afterClear?.activeAgentId, null);
  assert.equal(afterClear?.handoffs.length, 3);
  assert.equal(afterClear?.handoffs[0]?.fromAgentId, 'nuwa-munger');
  assert.equal(afterClear?.handoffs[0]?.toAgentId, null);

  const persisted = readChatConversation(created.id);
  assert.equal(persisted?.activeAgentId, null);
  assert.equal(persisted?.handoffs.length, 3);
});
