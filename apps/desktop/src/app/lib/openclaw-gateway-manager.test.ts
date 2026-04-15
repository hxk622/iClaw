import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DesktopGatewayConnectionManager,
  getDesktopGatewayConnectionManager,
  resetDesktopGatewayConnectionManagersForTest,
} from './openclaw-gateway-manager.ts';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readonly sent: string[] = [];
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.onclose?.();
  }

  emit(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }

  fail() {
    this.onerror?.();
  }
}

test.beforeEach(() => {
  FakeWebSocket.instances = [];
  resetDesktopGatewayConnectionManagersForTest();
});

test('desktop gateway manager performs connect handshake once and dispatches queued request', async () => {
  const manager = new DesktopGatewayConnectionManager(
    { gatewayUrl: 'ws://127.0.0.1:2126', gatewayToken: 'token' },
    { createWebSocket: (url) => new FakeWebSocket(url) as unknown as WebSocket },
  );

  const resultPromise = manager.request<{ jobs: string[] }>('cron.list', { limit: 10 });
  assert.equal(FakeWebSocket.instances.length, 1);
  const socket = FakeWebSocket.instances[0]!;
  assert.equal(manager.getState().phase, 'connecting');

  socket.emit({ type: 'event', event: 'connect.challenge' });
  const connectRequest = JSON.parse(socket.sent[0]!);
  assert.equal(connectRequest.method, 'connect');

  socket.emit({ type: 'res', id: connectRequest.id, ok: true, payload: {} });
  const queuedRequest = JSON.parse(socket.sent[1]!);
  assert.equal(queuedRequest.method, 'cron.list');

  socket.emit({ type: 'res', id: queuedRequest.id, ok: true, payload: { jobs: ['job-a'] } });
  await assert.doesNotReject(resultPromise);
  assert.deepEqual(await resultPromise, { jobs: ['job-a'] });
  assert.equal(manager.getState().phase, 'connected');
  assert.equal(manager.getState().ready, true);
});

test('desktop gateway manager singleton reuses the same manager for identical gateway credentials', () => {
  const first = getDesktopGatewayConnectionManager({
    gatewayUrl: 'ws://127.0.0.1:2126',
    gatewayToken: 'token',
  });
  const second = getDesktopGatewayConnectionManager({
    gatewayUrl: 'ws://127.0.0.1:2126',
    gatewayToken: 'token',
  });

  assert.equal(first, second);
});
