import assert from 'node:assert/strict';
import test from 'node:test';

import { loadOverviewData } from '../../admin-web/src/lib/adminApi.ts';

type FetchHandler = (url: URL, init?: RequestInit) => Promise<Response>;

function ok(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });
}

function abortableHang(init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    const abort = () => reject(new Error('aborted'));
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function installLocalStorage() {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorageMock,
  });

  localStorageMock.setItem(
    'iclaw.admin-web.tokens',
    JSON.stringify({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
    }),
  );
}

function installFetch(handler: FetchHandler) {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: (input: string | URL | Request, init?: RequestInit) => {
      const url =
        input instanceof Request ? new URL(input.url) : input instanceof URL ? input : new URL(String(input));
      return handler(url, init);
    },
  });
}

function installConsoleWarnSpy() {
  const originalWarn = console.warn;
  const messages: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    messages.push(args);
  };
  return {
    messages,
    restore() {
      console.warn = originalWarn;
    },
  };
}

function createOverviewFetchHandler(options: {
  hangOptionalPaymentOrders?: boolean;
  hangCoreAuthMe?: boolean;
} = {}): FetchHandler {
  return async (url, init) => {
    const path = `${url.pathname}${url.search}`;

    if (options.hangCoreAuthMe && path === '/auth/me') {
      return abortableHang(init);
    }
    if (options.hangOptionalPaymentOrders && path === '/admin/payments/orders?limit=200') {
      return abortableHang(init);
    }

    switch (path) {
      case '/auth/me':
        return ok({
          id: 'user-1',
          username: 'admin',
        });
      case '/admin/portal/apps':
        return ok({
          items: [
            {
              appName: 'alpha',
              displayName: 'Alpha',
              status: 'active',
              updatedAt: '2026-04-16T12:00:00.000Z',
            },
          ],
        });
      case '/admin/agents/catalog':
      case '/admin/portal/catalog/skills':
      case '/admin/portal/catalog/mcps':
      case '/admin/portal/catalog/models':
      case '/admin/portal/model-provider-profiles':
      case '/admin/portal/memory-embedding-profiles':
      case '/admin/portal/model-logo-presets':
      case '/admin/portal/catalog/menus':
      case '/admin/portal/catalog/composer-controls':
      case '/admin/portal/catalog/composer-shortcuts':
      case '/admin/portal/catalog/recharge-packages':
      case '/admin/payments/provider-profiles?provider=wechat_qr':
      case '/admin/payments/provider-bindings?provider=wechat_qr':
      case '/admin/skills/sync/sources':
      case '/admin/skills/sync/runs':
      case '/admin/mcp/catalog':
      case '/admin/portal/runtime-releases?limit=200':
      case '/admin/portal/runtime-bindings?limit=200':
      case '/admin/portal/runtime-binding-history?limit=200':
        return ok({ items: [] });
      case '/admin/payments/gateway-config':
      case '/admin/portal/runtime-bootstrap-source':
      case '/admin/portal/apps/alpha/model-provider-override':
      case '/admin/payments/gateway-config?scope_type=app&scope_key=alpha':
        return ok(null);
      case '/admin/skills/catalog?limit=100&offset=0':
        return ok({
          items: [],
          total: 0,
          limit: 100,
          offset: 0,
          has_more: false,
          next_offset: null,
        });
      case '/admin/payments/orders?limit=200':
        return ok({ items: [] });
      case '/admin/portal/apps/alpha':
        return ok({
          app: {
            appName: 'alpha',
            displayName: 'Alpha',
            status: 'active',
            updatedAt: '2026-04-16T12:00:00.000Z',
            config: {},
          },
          skillBindings: [],
          mcpBindings: [],
          modelBindings: [],
          menuBindings: [],
          rechargePackageBindings: [],
          composerControlBindings: [],
          composerShortcutBindings: [],
          assets: [],
          releases: [],
          audit: [],
        });
      default:
        throw new Error(`Unhandled fetch path in test: ${path}`);
    }
  };
}

test('loadOverviewData keeps bootstrap moving when an optional endpoint hangs', async () => {
  installLocalStorage();
  installFetch(createOverviewFetchHandler({ hangOptionalPaymentOrders: true }));
  const warnSpy = installConsoleWarnSpy();

  try {
    const overview = await loadOverviewData({
      coreTimeoutMs: 80,
      optionalTimeoutMs: 40,
    });

    assert.equal(overview.user.username, 'admin');
    assert.equal(overview.brands.length, 1);
    assert.equal(overview.brands[0]?.brandId, 'alpha');
    assert.deepEqual(overview.paymentOrders, []);
    assert.equal(
      warnSpy.messages.some((entry) => String(entry[0]).includes('payment orders')),
      true,
      'optional timeout should be logged as degraded bootstrap',
    );
  } finally {
    warnSpy.restore();
  }
});

test('loadOverviewData fails fast when a core endpoint hangs', async () => {
  installLocalStorage();
  installFetch(createOverviewFetchHandler({ hangCoreAuthMe: true }));

  await assert.rejects(
    () =>
      loadOverviewData({
        coreTimeoutMs: 40,
        optionalTimeoutMs: 20,
      }),
    /请求超时/,
  );
});
