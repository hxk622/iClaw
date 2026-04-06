const BASE_URL = (process.env.ICLAW_CONTROL_PLANE_URL || 'http://127.0.0.1:2130').replace(/\/+$/, '');
const IDENTIFIER = process.env.ICLAW_ADMIN_IDENTIFIER || 'admin';
const PASSWORD = process.env.ICLAW_ADMIN_PASSWORD || 'admin';
const APPS = (process.env.ICLAW_E2E_APPS || 'iclaw,licaiclaw')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const EXPECTED_CONTROL_KEYS = ['expert', 'skill', 'mode', 'market-scope', 'watchlist', 'output-format'];
const EXPECTED_SHORTCUT_KEYS = [
  'earnings-analysis',
  'valuation-analysis',
  'company-compare',
  'sector-review',
  'market-recap',
  'fund-analysis',
];

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function normalizeControlBindings(items) {
  return asArray(items)
    .map((item) => {
      const entry = asObject(item);
      const controlKey = String(entry.controlKey || entry.control_key || '').trim();
      if (!controlKey) return null;
      return {
        controlKey,
        enabled: entry.enabled !== false,
        sortOrder: Number(entry.sortOrder || entry.sort_order || 100) || 100,
        config: asObject(entry.config || entry.config_json),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.controlKey.localeCompare(right.controlKey, 'zh-CN'));
}

function normalizeShortcutBindings(items) {
  return asArray(items)
    .map((item) => {
      const entry = asObject(item);
      const shortcutKey = String(entry.shortcutKey || entry.shortcut_key || '').trim();
      if (!shortcutKey) return null;
      return {
        shortcutKey,
        enabled: entry.enabled !== false,
        sortOrder: Number(entry.sortOrder || entry.sort_order || 100) || 100,
        config: asObject(entry.config || entry.config_json),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.shortcutKey.localeCompare(right.shortcutKey, 'zh-CN'));
}

async function verifyApp(token, appName) {
  const detail = await api(`/admin/portal/apps/${encodeURIComponent(appName)}`, withAuth(token, 'GET'));
  assert(detail?.app?.appName === appName, `unexpected app detail for ${appName}`);
  const baselinePublicConfig = await api(`/portal/public-config?app_name=${encodeURIComponent(appName)}`, {method: 'GET'});
  const baselineInputConfig = asObject(asObject(asObject(baselinePublicConfig.config).surfaces).input).config;

  const originalControlBindings = normalizeControlBindings(detail.composerControlBindings);
  const originalShortcutBindings = normalizeShortcutBindings(detail.composerShortcutBindings);
  assert(originalControlBindings.length > 0, `${appName} has no composer control bindings`);
  assert(originalShortcutBindings.length > 0, `${appName} has no composer shortcut bindings`);

  const targetControl = originalControlBindings.find((item) => item.controlKey === 'mode') || originalControlBindings[0];
  const targetShortcut = originalShortcutBindings.find((item) => item.shortcutKey === 'earnings-analysis') || originalShortcutBindings[0];
  assert(targetControl, `${appName} missing target composer control`);
  assert(targetShortcut, `${appName} missing target composer shortcut`);
  const baselinePublicControl = asArray(baselineInputConfig.top_bar_controls).find(
    (item) => String(asObject(item).control_key || asObject(item).controlKey || '').trim() === targetControl.controlKey,
  );
  const baselinePublicShortcut = asArray(baselineInputConfig.footer_shortcuts).find(
    (item) => String(asObject(item).shortcut_key || asObject(item).shortcutKey || '').trim() === targetShortcut.shortcutKey,
  );
  assert(baselinePublicControl, `${appName} baseline public control missing ${targetControl.controlKey}`);
  assert(baselinePublicShortcut, `${appName} baseline public shortcut missing ${targetShortcut.shortcutKey}`);

  const controlMarker = `模式控制 ${appName} ${Date.now()}`;
  const shortcutMarker = `快捷方式 ${appName} ${Date.now()}`;
  const originalControlConfig = clone(targetControl.config);
  const originalShortcutConfig = clone(targetShortcut.config);

  try {
    const mutatedControls = originalControlBindings.map((item) =>
      item.controlKey === targetControl.controlKey
        ? {
            ...item,
            config: {
              ...clone(item.config),
              display_name: controlMarker,
              allowed_option_values: ['quick', 'report'],
            },
          }
        : item,
    );
    const mutatedShortcuts = originalShortcutBindings.map((item) =>
      item.shortcutKey === targetShortcut.shortcutKey
        ? {
            ...item,
            config: {
              ...clone(item.config),
              display_name: shortcutMarker,
              template: `请基于 #标的 输出一版 ${shortcutMarker} 专用模板。`,
            },
          }
        : item,
    );

    await api(`/admin/portal/apps/${encodeURIComponent(appName)}/composer-controls`, withAuth(token, 'PUT', mutatedControls));
    await api(`/admin/portal/apps/${encodeURIComponent(appName)}/composer-shortcuts`, withAuth(token, 'PUT', mutatedShortcuts));
    await api(`/admin/portal/apps/${encodeURIComponent(appName)}/publish`, withAuth(token, 'POST', {}));

    const publicConfig = await api(`/portal/public-config?app_name=${encodeURIComponent(appName)}`, {method: 'GET'});
    const inputConfig = asObject(asObject(asObject(publicConfig.config).surfaces).input).config;
    const topBarControls = asArray(inputConfig.top_bar_controls);
    const footerShortcuts = asArray(inputConfig.footer_shortcuts);
    const publicControl = topBarControls.find((item) => String(asObject(item).control_key || asObject(item).controlKey || '').trim() === targetControl.controlKey);
    const publicShortcut = footerShortcuts.find((item) => String(asObject(item).shortcut_key || asObject(item).shortcutKey || '').trim() === targetShortcut.shortcutKey);
    const publicOptionValues = asArray(asObject(publicControl).options).map((item) =>
      String(asObject(item).option_value || asObject(item).optionValue || '').trim(),
    );

    assert(topBarControls.length > 0, `${appName} public config missing top_bar_controls`);
    assert(footerShortcuts.length > 0, `${appName} public config missing footer_shortcuts`);
    assert(String(asObject(publicControl).display_name || '').trim() === controlMarker, `${appName} control display_name did not update`);
    assert(publicOptionValues.join(',') === 'quick,report', `${appName} control option filter did not update: ${publicOptionValues.join(',')}`);
    assert(String(asObject(publicShortcut).display_name || '').trim() === shortcutMarker, `${appName} shortcut display_name did not update`);
    assert(
      String(asObject(publicShortcut).template || '').includes(shortcutMarker),
      `${appName} shortcut template did not update`,
    );
  } finally {
    await api(
      `/admin/portal/apps/${encodeURIComponent(appName)}/composer-controls`,
      withAuth(
        token,
        'PUT',
        originalControlBindings.map((item) =>
          item.controlKey === targetControl.controlKey
            ? {
                ...item,
                config: originalControlConfig,
              }
            : item,
        ),
      ),
    );
    await api(
      `/admin/portal/apps/${encodeURIComponent(appName)}/composer-shortcuts`,
      withAuth(
        token,
        'PUT',
        originalShortcutBindings.map((item) =>
          item.shortcutKey === targetShortcut.shortcutKey
            ? {
                ...item,
                config: originalShortcutConfig,
              }
            : item,
        ),
      ),
    );
    await api(`/admin/portal/apps/${encodeURIComponent(appName)}/publish`, withAuth(token, 'POST', {}));
  }

  const restoredPublic = await api(`/portal/public-config?app_name=${encodeURIComponent(appName)}`, {method: 'GET'});
  const restoredInput = asObject(asObject(asObject(restoredPublic.config).surfaces).input).config;
  const restoredControl = asArray(restoredInput.top_bar_controls).find(
    (item) => String(asObject(item).control_key || asObject(item).controlKey || '').trim() === targetControl.controlKey,
  );
  const restoredShortcut = asArray(restoredInput.footer_shortcuts).find(
    (item) => String(asObject(item).shortcut_key || asObject(item).shortcutKey || '').trim() === targetShortcut.shortcutKey,
  );
  assert(
    String(asObject(restoredControl).display_name || '').trim() === String(asObject(baselinePublicControl).display_name || '').trim(),
    `${appName} control restore failed`,
  );
  assert(
    String(asObject(restoredShortcut).display_name || '').trim() === String(asObject(baselinePublicShortcut).display_name || '').trim(),
    `${appName} shortcut restore failed`,
  );
  assert(
    String(asObject(restoredShortcut).template || '').trim() === String(asObject(baselinePublicShortcut).template || '').trim(),
    `${appName} shortcut template restore failed`,
  );

  return {
    appName,
    controlKey: targetControl.controlKey,
    shortcutKey: targetShortcut.shortcutKey,
    topBarControls: asArray(restoredInput.top_bar_controls).length,
    footerShortcuts: asArray(restoredInput.footer_shortcuts).length,
  };
}

async function main() {
  const token = await login();
  const controls = await api('/admin/portal/catalog/composer-controls', withAuth(token, 'GET'));
  const shortcuts = await api('/admin/portal/catalog/composer-shortcuts', withAuth(token, 'GET'));
  const controlItems = asArray(controls.items);
  const shortcutItems = asArray(shortcuts.items);
  assert(controlItems.length > 0, 'composer control catalog is empty');
  assert(shortcutItems.length > 0, 'composer shortcut catalog is empty');

  for (const key of EXPECTED_CONTROL_KEYS) {
    assert(
      controlItems.some((item) => String(asObject(item).controlKey || asObject(item).control_key || '').trim() === key),
      `composer control catalog missing ${key}`,
    );
  }
  for (const key of EXPECTED_SHORTCUT_KEYS) {
    assert(
      shortcutItems.some((item) => String(asObject(item).shortcutKey || asObject(item).shortcut_key || '').trim() === key),
      `composer shortcut catalog missing ${key}`,
    );
  }

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
