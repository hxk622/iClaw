import assert from 'node:assert/strict';
import {createServer} from 'node:http';

import {
  click,
  openIsolatedPage,
  readValue,
  reloadPage,
  screenshot,
  setInputValue,
  waitFor,
  waitForSelector,
} from '../shared/cdp/cdp-helpers.mjs';

const ADMIN_URL = process.env.ICLAW_ADMIN_URL || 'http://127.0.0.1:1479';
const API_PORT = Number(process.env.ICLAW_TEST_MOCK_API_PORT || 2130);
const SCREENSHOT_PATH =
  process.env.ICLAW_TEST_SCREENSHOT_PATH || '/tmp/iclaw-payment-admin-gateway-scope-isolation.png';

function nowIso() {
  return new Date().toISOString();
}

function json(response, status = 200) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': 'http://127.0.0.1:1479',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    },
    body: JSON.stringify(response),
  };
}

function createGatewayView(entry, scopeType, scopeKey, source) {
  const config = {
    partner_id: String(entry.partner_id || '').trim(),
    gateway: String(entry.gateway || '').trim(),
  };
  const secretValues = {
    key: String(entry.key || '').trim(),
  };
  const missing = [];
  if (!config.partner_id) missing.push('partner_id');
  if (!config.gateway) missing.push('gateway');
  if (!secretValues.key) missing.push('key');
  return {
    provider: 'epay',
    source,
    scope_type: scopeType,
    scope_key: scopeKey,
    config,
    secret_values: secretValues,
    configured_secret_keys: secretValues.key ? ['key'] : [],
    completeness_status: missing.length === 0 ? 'configured' : 'missing',
    missing_fields: missing,
    updated_at: entry.updated_at || nowIso(),
  };
}

function createMockApiServer() {
  const state = {
    platform: {
      partner_id: 'platform-partner-001',
      gateway: 'https://platform.example.com/submit.php',
      key: 'platform-key-001',
      updated_at: nowIso(),
    },
    apps: new Map(),
    requests: [],
  };

  const appList = [
    {appName: 'iclaw', displayName: 'iClaw', status: 'active', updatedAt: nowIso()},
    {appName: 'licaiclaw', displayName: 'LiCaiClaw', status: 'active', updatedAt: nowIso()},
  ];

  const emptyItems = {items: []};
  const routeMap = new Map([
    ['/admin/agents/catalog', emptyItems],
    ['/admin/portal/catalog/skills', emptyItems],
    ['/admin/portal/catalog/mcps', emptyItems],
    ['/admin/mcp/catalog', emptyItems],
    ['/admin/portal/catalog/models', emptyItems],
    ['/admin/portal/model-provider-profiles', emptyItems],
    ['/admin/portal/memory-embedding-profiles', emptyItems],
    ['/admin/portal/model-logo-presets', emptyItems],
    ['/admin/portal/catalog/menus', emptyItems],
    ['/admin/portal/catalog/recharge-packages', emptyItems],
    ['/admin/portal/catalog/composer-controls', emptyItems],
    ['/admin/portal/catalog/composer-shortcuts', emptyItems],
    ['/admin/skills/sync/sources', emptyItems],
    ['/admin/skills/sync/runs', emptyItems],
    ['/admin/payments/provider-profiles', emptyItems],
    ['/admin/payments/provider-bindings', emptyItems],
    ['/admin/payments/orders', emptyItems],
    ['/admin/portal/runtime-releases', emptyItems],
    ['/admin/portal/runtime-bindings', emptyItems],
    ['/admin/portal/runtime-binding-history', emptyItems],
    ['/admin/portal/runtime-bootstrap-source', null],
  ]);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${API_PORT}`);
    if (req.method === 'OPTIONS') {
      const payload = json({success: true, data: null}, 204);
      res.writeHead(payload.status, payload.headers);
      res.end();
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');
    const body = rawBody ? JSON.parse(rawBody) : null;
    state.requests.push({method: req.method, path: url.pathname, search: url.search, body});

    let payload;
    if (req.method === 'POST' && url.pathname === '/auth/login') {
      payload = json({
        success: true,
        data: {
          tokens: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 604800,
          },
          user: {
            id: 'mock-admin-user',
            username: 'admin',
            email: 'admin@mock.local',
            name: 'Mock Admin',
            avatar_url: null,
            role: 'admin',
          },
        },
      });
    } else if (req.method === 'POST' && url.pathname === '/auth/refresh') {
      payload = json({
        success: true,
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 604800,
        },
      });
    } else if (req.method === 'GET' && url.pathname === '/auth/me') {
      payload = json({
        success: true,
        data: {
          id: 'mock-admin-user',
          username: 'admin',
          email: 'admin@mock.local',
          name: 'Mock Admin',
          avatar_url: null,
          role: 'admin',
        },
      });
    } else if (req.method === 'GET' && url.pathname === '/admin/portal/apps') {
      payload = json({success: true, data: {items: appList}});
    } else if (req.method === 'GET' && /^\/admin\/portal\/apps\/[^/]+$/.test(url.pathname)) {
      const appName = decodeURIComponent(url.pathname.split('/').pop() || '');
      const app = appList.find((item) => item.appName === appName);
      payload = json({
        success: true,
        data: {
          app: app || {appName, displayName: appName, status: 'active', updatedAt: nowIso(), config: {}},
          skillBindings: [],
          mcpBindings: [],
          modelBindings: [],
          rechargePackageBindings: [],
          composerControls: [],
          composerShortcuts: [],
          menus: [],
          assets: [],
          versions: [],
          audit: [],
        },
      });
    } else if (req.method === 'GET' && /\/admin\/portal\/apps\/[^/]+\/model-provider-override$/.test(url.pathname)) {
      payload = json({success: true, data: null});
    } else if (url.pathname === '/admin/payments/gateway-config' && req.method === 'GET') {
      const scopeType = String(url.searchParams.get('scope_type') || 'platform').trim() === 'app' ? 'app' : 'platform';
      const scopeKey = String(url.searchParams.get('scope_key') || 'platform').trim().toLowerCase() || 'platform';
      if (scopeType === 'app') {
        const appEntry = state.apps.get(scopeKey);
        payload = json({
          success: true,
          data: appEntry
            ? createGatewayView(appEntry, 'app', scopeKey, 'admin')
            : createGatewayView(state.platform, 'app', scopeKey, 'platform_inherited'),
        });
      } else {
        payload = json({
          success: true,
          data: createGatewayView(state.platform, 'platform', 'platform', 'admin'),
        });
      }
    } else if (url.pathname === '/admin/payments/gateway-config' && req.method === 'PUT') {
      const scopeType = String(body?.scope_type || 'platform').trim() === 'app' ? 'app' : 'platform';
      const scopeKey = String(body?.scope_key || (scopeType === 'app' ? '' : 'platform')).trim().toLowerCase() || 'platform';
      const next = {
        partner_id: String(body?.config_values?.partner_id || '').trim(),
        gateway: String(body?.config_values?.gateway || '').trim(),
        key: String(body?.secret_values?.key || '').trim(),
        updated_at: nowIso(),
      };
      if (scopeType === 'app') {
        state.apps.set(scopeKey, next);
        payload = json({
          success: true,
          data: createGatewayView(next, 'app', scopeKey, 'admin'),
        });
      } else {
        state.platform = next;
        payload = json({
          success: true,
          data: createGatewayView(next, 'platform', 'platform', 'admin'),
        });
      }
    } else if (routeMap.has(url.pathname)) {
      payload = json({success: true, data: routeMap.get(url.pathname)});
    } else {
      payload = json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Unhandled mock route: ${req.method} ${url.pathname}`,
          },
        },
        404,
      );
    }

    res.writeHead(payload.status, payload.headers);
    res.end(payload.body);
  });

  return {
    state,
    async listen() {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(API_PORT, '127.0.0.1', resolve);
      });
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function clearAdminLocalStorage(cdp) {
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      localStorage.removeItem('iclaw.admin-web.tokens');
      sessionStorage.clear();
      return true;
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
}

async function readGatewayFields(page) {
  return {
    partnerId: String(await readValue(page.cdp, '[data-testid="payment-gateway-partner-id"]') || '').trim(),
    gateway: String(await readValue(page.cdp, '[data-testid="payment-gateway-endpoint"]') || '').trim(),
    key: String(await readValue(page.cdp, '[data-testid="payment-gateway-key"]') || '').trim(),
  };
}

async function selectPaymentTab(page, tabKey) {
  await click(page.cdp, `[data-testid="payment-provider-tab-${tabKey}"]`);
  await waitForSelector(page.cdp, '[data-testid="payment-gateway-form"]');
}

async function main() {
  const mockApi = createMockApiServer();
  await mockApi.listen();

  const page = await openIsolatedPage(ADMIN_URL);
  try {
    await waitForSelector(page.cdp, 'body');
    await clearAdminLocalStorage(page.cdp);
    await reloadPage(page.cdp);

    await waitForSelector(page.cdp, '[data-testid="admin-login-form"]');
    await setInputValue(page.cdp, '[data-testid="admin-login-identifier"]', 'admin');
    await setInputValue(page.cdp, '[data-testid="admin-login-password"]', 'admin');
    await click(page.cdp, '[data-testid="admin-login-submit"]');

    await waitForSelector(page.cdp, '[data-page="payments-config"]', 30_000);
    await click(page.cdp, '[data-page="payments-config"]');
    await waitForSelector(page.cdp, '[data-testid="payment-provider-tab-platform"]');
    await waitForSelector(page.cdp, '[data-testid="payment-provider-tab-iclaw"]');
    await waitForSelector(page.cdp, '[data-testid="payment-provider-tab-licaiclaw"]');

    await selectPaymentTab(page, 'platform');
    const platformBefore = await readGatewayFields(page);
    assert.deepEqual(platformBefore, {
      partnerId: 'platform-partner-001',
      gateway: 'https://platform.example.com/submit.php',
      key: 'platform-key-001',
    });

    await selectPaymentTab(page, 'licaiclaw');
    const licaiclawBefore = await readGatewayFields(page);
    assert.deepEqual(licaiclawBefore, platformBefore);

    await selectPaymentTab(page, 'iclaw');
    await setInputValue(page.cdp, '[data-testid="payment-gateway-partner-id"]', 'iclaw-partner-777');
    await setInputValue(page.cdp, '[data-testid="payment-gateway-endpoint"]', 'https://iclaw.example.com/submit.php');
    await setInputValue(page.cdp, '[data-testid="payment-gateway-key"]', 'iclaw-key-777');
    await click(page.cdp, '[data-testid="payment-gateway-save"]');

    await waitFor(
      'iclaw gateway persisted in UI',
      async () => {
        const value = await readGatewayFields(page);
        return value.partnerId === 'iclaw-partner-777' ? value : null;
      },
      15_000,
      200,
    );

    await selectPaymentTab(page, 'platform');
    const platformAfter = await readGatewayFields(page);
    assert.deepEqual(platformAfter, platformBefore, 'platform gateway should stay unchanged');

    await selectPaymentTab(page, 'licaiclaw');
    const licaiclawAfter = await readGatewayFields(page);
    assert.deepEqual(licaiclawAfter, platformBefore, 'licaiclaw should keep inheriting platform config');

    await selectPaymentTab(page, 'iclaw');
    const iclawAfter = await readGatewayFields(page);
    assert.deepEqual(iclawAfter, {
      partnerId: 'iclaw-partner-777',
      gateway: 'https://iclaw.example.com/submit.php',
      key: 'iclaw-key-777',
    });

    assert.deepEqual(mockApi.state.platform, {
      partner_id: 'platform-partner-001',
      gateway: 'https://platform.example.com/submit.php',
      key: 'platform-key-001',
      updated_at: mockApi.state.platform.updated_at,
    });
    assert.deepEqual(mockApi.state.apps.get('iclaw'), {
      partner_id: 'iclaw-partner-777',
      gateway: 'https://iclaw.example.com/submit.php',
      key: 'iclaw-key-777',
      updated_at: mockApi.state.apps.get('iclaw').updated_at,
    });
    assert.equal(mockApi.state.apps.has('licaiclaw'), false, 'licaiclaw should not gain an app-specific gateway');

    const savedPath = await screenshot(page.cdp, SCREENSHOT_PATH);
    console.log(
      JSON.stringify(
        {
          ok: true,
          platform_before: platformBefore,
          platform_after: platformAfter,
          licaiclaw_after: licaiclawAfter,
          iclaw_after: iclawAfter,
          requests: mockApi.state.requests.filter((item) => item.path === '/admin/payments/gateway-config'),
          screenshot: savedPath,
        },
        null,
        2,
      ),
    );
  } finally {
    await page.close().catch(() => {});
    await mockApi.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
