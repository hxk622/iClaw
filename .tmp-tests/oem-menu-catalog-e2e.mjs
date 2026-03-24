const BASE_URL = (process.env.ICLAW_CONTROL_PLANE_URL || 'http://127.0.0.1:2130').replace(/\/+$/, '');
const IDENTIFIER = process.env.ICLAW_ADMIN_IDENTIFIER || 'admin';
const PASSWORD = process.env.ICLAW_ADMIN_PASSWORD || 'admin';
const APPS = (process.env.ICLAW_E2E_APPS || 'iclaw,licaiclaw')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const LEGACY_MENU_KEY_MAP = {
  workspace: ['chat'],
  skills: ['skill-store'],
  mcp: ['mcp-store'],
  settings: ['settings'],
  assets: [],
  models: [],
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function api(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload?.data ?? payload;
}

async function login() {
  const data = await api('/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      identifier: IDENTIFIER,
      password: PASSWORD,
    }),
  });
  const token = data?.tokens?.access_token;
  assert(token, 'login returned no access token');
  return token;
}

function withAuth(token, method, body) {
  return {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeMenuBindings(items) {
  return asArray(items)
    .map((item) => {
      const entry = asObject(item);
      const menuKey = String(entry.menuKey || entry.menu_key || '').trim();
      if (!menuKey) return null;
      return {
        menuKey,
        enabled: entry.enabled !== false,
        sortOrder: Number(entry.sortOrder || entry.sort_order || 100) || 100,
        config: asObject(entry.config || entry.config_json),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.menuKey.localeCompare(right.menuKey, 'zh-CN'));
}

function normalizePublicMenuKeys(key) {
  const normalized = String(key || '').trim();
  if (!normalized) return [];
  return LEGACY_MENU_KEY_MAP[normalized] || [normalized];
}

function findMenuBinding(items, menuKey) {
  return normalizeMenuBindings(items).find((item) => item.menuKey === menuKey) || null;
}

function summarizePublicConfig(appName, publicConfig) {
  const config = asObject(publicConfig.config);
  const capabilities = asObject(config.capabilities);
  return {
    appName,
    publishedVersion: Number(publicConfig.publishedVersion || 0),
    skills: asArray(capabilities.skills).length,
    mcps: asArray(capabilities.mcp_servers).length,
    menus: asArray(capabilities.menus).length,
    models: asArray(asObject(capabilities.models).entries).length,
    menuCatalog: asArray(config.menu_catalog).length,
    assets: Object.keys(asObject(config.assets)).length,
  };
}

async function verifyApp(token, appName) {
  const detail = await api(`/admin/portal/apps/${encodeURIComponent(appName)}`, withAuth(token, 'GET'));
  assert(detail?.app?.appName === appName, `unexpected app detail for ${appName}`);

  const originalBindings = normalizeMenuBindings(detail.menuBindings);
  assert(originalBindings.length > 0, `${appName} has no menu bindings`);
  assert(asArray(detail.skillBindings).length > 0, `${appName} has no skill bindings`);
  assert(asArray(detail.mcpBindings).length > 0, `${appName} has no mcp bindings`);
  assert(asArray(detail.modelBindings).length > 0, `${appName} has no model bindings`);

  const targetMenuKey = findMenuBinding(originalBindings, 'chat')?.menuKey || originalBindings[0].menuKey;
  const resolvedTargetMenuKey = normalizePublicMenuKeys(targetMenuKey)[0] || targetMenuKey;
  const originalTarget = findMenuBinding(originalBindings, targetMenuKey);
  assert(originalTarget, `${appName} missing target menu binding`);
  const originalConfig = clone(asObject(originalTarget.config));
  const marker = `E2E ${appName} ${Date.now()}`;
  let restoredPublic = null;
  try {
    const mutatedBindings = originalBindings.map((item) =>
      item.menuKey === targetMenuKey
        ? {
            ...item,
            config: {
              ...clone(asObject(item.config)),
              display_name: marker,
            },
          }
        : item,
    );

    await api(
      `/admin/portal/apps/${encodeURIComponent(appName)}/menus`,
      withAuth(token, 'PUT', mutatedBindings),
    );
    await api(
      `/admin/portal/apps/${encodeURIComponent(appName)}/publish`,
      withAuth(token, 'POST', {}),
    );

    const mutatedPublic = await api(`/portal/public-config?app_name=${encodeURIComponent(appName)}`, {method: 'GET'});
    const mutatedConfig = asObject(mutatedPublic.config);
    const mutatedCatalog = asArray(mutatedConfig.menu_catalog);
    const mutatedBindingsPublic = asArray(mutatedConfig.menu_bindings);
    const mutatedBinding = mutatedBindingsPublic.find((item) => {
      const entry = asObject(item);
      return String(entry.menu_key || entry.menuKey || '').trim() === resolvedTargetMenuKey;
    });

    assert(mutatedCatalog.length > 0, `${appName} public config has no menu_catalog`);
    assert(
      mutatedCatalog.some((item) => String(asObject(item).menu_key || asObject(item).menuKey || '').trim() === 'chat'),
      `${appName} public config menu_catalog missing chat`,
    );
    assert(
      String(asObject(asObject(mutatedBinding).config).display_name || '').trim() === marker,
      `${appName} public config did not reflect updated menu binding: ${JSON.stringify({
        targetMenuKey,
        resolvedTargetMenuKey,
        marker,
        mutatedBinding,
        capabilitiesMenus: asArray(asObject(mutatedConfig.capabilities).menus),
      })}`,
    );
    assert(asArray(asObject(mutatedConfig.capabilities).skills).length > 0, `${appName} public config missing skills`);
    assert(asArray(asObject(mutatedConfig.capabilities).mcp_servers).length > 0, `${appName} public config missing mcps`);
    assert(asArray(asObject(mutatedConfig.capabilities).menus).length > 0, `${appName} public config missing menus`);
    assert(
      asArray(asObject(asObject(mutatedConfig.capabilities).models).entries).length > 0,
      `${appName} public config missing model entries`,
    );
    assert(Object.keys(asObject(mutatedConfig.assets)).length > 0, `${appName} public config missing assets`);
  } finally {
    await api(
      `/admin/portal/apps/${encodeURIComponent(appName)}/menus`,
      withAuth(
        token,
        'PUT',
        originalBindings.map((item) =>
          item.menuKey === targetMenuKey
            ? {
                ...item,
                config: originalConfig,
              }
            : item,
        ),
      ),
    );
    await api(
      `/admin/portal/apps/${encodeURIComponent(appName)}/publish`,
      withAuth(token, 'POST', {}),
    );
    restoredPublic = await api(`/portal/public-config?app_name=${encodeURIComponent(appName)}`, {method: 'GET'});
  }

  const restoredBinding = asArray(asObject(restoredPublic.config).menu_bindings).find((item) => {
    const entry = asObject(item);
    return String(entry.menu_key || entry.menuKey || '').trim() === resolvedTargetMenuKey;
  });
  assert(
    String(asObject(asObject(restoredBinding).config).display_name || '').trim() ===
      String(originalConfig.display_name || '').trim(),
    `${appName} menu binding restore failed`,
  );

  return {
    mutatedMenuKey: targetMenuKey,
    summary: summarizePublicConfig(appName, restoredPublic),
  };
}

async function main() {
  const token = await login();
  const menusBefore = await api('/admin/portal/catalog/menus', withAuth(token, 'GET'));
  const menuItems = asArray(menusBefore.items);
  assert(menuItems.length > 0, 'menu catalog is empty');
  const chatMenu = menuItems.find((item) => String(asObject(item).menuKey || asObject(item).menu_key || '').trim() === 'chat');
  assert(chatMenu, 'menu catalog missing chat');

  await api(
    '/admin/portal/catalog/menus/chat',
    withAuth(token, 'PUT', {
      displayName: String(asObject(chatMenu).displayName || asObject(chatMenu).display_name || '智能对话').trim(),
      category: String(asObject(chatMenu).category || 'sidebar').trim() || 'sidebar',
      routeKey: String(asObject(chatMenu).routeKey || asObject(chatMenu).route_key || 'chat').trim() || 'chat',
      iconKey: String(asObject(chatMenu).iconKey || asObject(chatMenu).icon_key || 'chat').trim() || 'chat',
      metadata: asObject(chatMenu.metadata),
      active: asObject(chatMenu).active !== false,
    }),
  );

  const results = [];
  for (const appName of APPS) {
    results.push(await verifyApp(token, appName));
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: BASE_URL,
        apps: results,
      },
      null,
      2,
    ),
  );
}

await main();
