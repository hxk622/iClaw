import './styles.css';

const API_BASE_URL = ((import.meta.env.VITE_AUTH_BASE_URL || 'http://127.0.0.1:2130') + '').trim().replace(/\/+$/, '');
const TOKEN_STORAGE_KEY = 'iclaw.admin-web.tokens';
const NAV_ITEMS = [
  {id: 'overview', label: '总览', eyebrow: 'Overview'},
  {id: 'brands', label: '品牌管理', eyebrow: 'Brands'},
  {id: 'brand-detail', label: '品牌详情', eyebrow: 'Brand Detail'},
  {id: 'skills-mcp', label: '技能与 MCP', eyebrow: 'Capabilities'},
  {id: 'assets', label: '资源管理', eyebrow: 'Assets'},
  {id: 'releases', label: '版本发布', eyebrow: 'Releases'},
  {id: 'audit-log', label: '审计日志', eyebrow: 'Audit'},
];
const SURFACE_LABELS = {
  desktop: '桌面端',
  'home-web': 'Web 主页',
  header: '顶部栏',
  sidebar: '侧边栏',
  input: '输入编辑器',
  'input-composer': '输入编辑器',
  'skill-store': '技能商店',
};

const app = document.querySelector('#app');

if (!app) {
  throw new Error('admin-web mount failed');
}

const state = {
  busy: false,
  loading: false,
  error: '',
  notice: '',
  view: 'login',
  route: 'overview',
  tokens: loadTokens(),
  user: null,
  dashboard: null,
  brands: [],
  selectedBrandId: '',
  brandDetail: null,
  brandDraftBuffer: null,
  brandDetailTab: 'surfaces',
  capabilities: null,
  skillCatalog: [],
  personalSkillCatalog: [],
  skillLibrary: [],
  mcpCatalog: [],
  capabilityMode: 'skills',
  selectedSkillSlug: '',
  selectedMcpKey: '',
  selectedReleaseId: '',
  selectedAuditId: '',
  mcpTestResult: null,
  assets: [],
  releases: [],
  audit: [],
  filters: {
    brandQuery: '',
    brandStatus: 'all',
    capabilityQuery: '',
    assetQuery: '',
    assetBrand: 'all',
    assetKind: 'all',
    releaseBrand: 'all',
    auditBrand: 'all',
    auditAction: 'all',
    auditQuery: '',
  },
};

function loadTokens() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistTokens(tokens) {
  state.tokens = tokens;
  if (tokens) {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    return;
  }
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value) {
  const seen = new Set();
  for (const item of asArray(value)) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim();
    if (!normalized) continue;
    seen.add(normalized);
  }
  return Array.from(seen);
}

function splitLines(value) {
  return String(value || '')
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateTime(value) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(value) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未记录';
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) {
    return `${Math.max(1, Math.round(diff / minute))} 分钟前`;
  }
  if (diff < day) {
    return `${Math.max(1, Math.round(diff / hour))} 小时前`;
  }
  return `${Math.max(1, Math.round(diff / day))} 天前`;
}

function titleizeKey(value) {
  return String(value || '')
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function surfaceLabel(key) {
  return SURFACE_LABELS[key] || titleizeKey(key);
}

function statusLabel(status) {
  switch (status) {
    case 'published':
      return '已发布';
    case 'draft':
      return '草稿';
    case 'archived':
      return '已归档';
    case 'staging':
      return '预发布';
    default:
      return status || '未知';
  }
}

function actionLabel(action) {
  switch (action) {
    case 'draft_saved':
      return '保存草稿';
    case 'published':
      return '发布版本';
    case 'rollback_prepared':
      return '回滚到历史版本';
    case 'asset_upserted':
      return '更新品牌资源';
    case 'asset_deleted':
      return '删除品牌资源';
    default:
      return titleizeKey(action);
  }
}

function statusBadge(status) {
  return `<span class="status-pill status-pill--${escapeHtml(status || 'default')}">${escapeHtml(statusLabel(status))}</span>`;
}

function isImageLike(contentType, url, objectKey) {
  const source = [contentType, url, objectKey].filter(Boolean).join(' ').toLowerCase();
  return ['image/', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'].some((token) => source.includes(token));
}

function buildOemAssetUrl(brandId, assetKey) {
  return `${API_BASE_URL}/oem/asset/file?brand_id=${encodeURIComponent(brandId)}&asset_key=${encodeURIComponent(assetKey)}`;
}

function resolveAssetUrl(item) {
  return item?.publicUrl || buildOemAssetUrl(item?.brandId || '', item?.assetKey || '');
}

function prettyJson(value) {
  return JSON.stringify(value || {}, null, 2);
}

function formatEnvPairs(env) {
  return Object.entries(asObject(env))
    .map(([key, value]) => `${key}=${String(value || '')}`)
    .join('\n');
}

function parseEnvText(raw) {
  const env = {};
  for (const line of String(raw || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)) {
    const index = line.indexOf('=');
    if (index <= 0) {
      throw new Error(`环境变量格式错误: ${line}`);
    }
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1);
    if (!key) {
      throw new Error(`环境变量 key 不能为空: ${line}`);
    }
    env[key] = value;
  }
  return env;
}

function getSkillLibraryItem(slug) {
  return state.skillLibrary.find((item) => item.slug === slug) || null;
}

function getAdminSkillCatalogEntry(slug) {
  return state.skillCatalog.find((item) => item.slug === slug) || null;
}

function getPersonalSkillCatalogEntry(slug) {
  return state.personalSkillCatalog.find((item) => item.slug === slug) || null;
}

function getMcpCatalogEntry(key) {
  return state.mcpCatalog.find((item) => item.key === key) || null;
}

function getMergedSkills() {
  const merged = new Map();
  for (const item of state.personalSkillCatalog) {
    merged.set(item.slug, {
      slug: item.slug,
      name: item.name,
      description: item.description || '',
      category: item.category || null,
      publisher: item.publisher || 'iClaw',
      distribution: item.distribution || item.source || 'unknown',
      latestRelease: item.latest_release?.version || null,
      brand_count: 0,
      connectedBrands: [],
    });
  }
  for (const item of state.capabilities?.skills || []) {
    merged.set(item.slug, {
      ...(merged.get(item.slug) || {}),
      ...item,
    });
  }
  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function getMergedMcpServers() {
  const merged = new Map();
  for (const item of state.mcpCatalog) {
    merged.set(item.key, {
      key: item.key,
      name: item.name || titleizeKey(item.key),
      enabled_by_default: item.enabled,
      command: item.command,
      args: item.args || [],
      http_url: item.http_url,
      env_keys: item.env_keys || Object.keys(asObject(item.env || {})),
      connected_brands: [],
      connected_brand_count: 0,
    });
  }
  for (const item of state.capabilities?.mcp_servers || []) {
    merged.set(item.key, {
      ...(merged.get(item.key) || {}),
      ...item,
    });
  }
  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function summarizeChangedAreas(currentConfig, compareConfig) {
  const keys = [
    ['brand_meta', 'brand_meta'],
    ['theme', 'theme'],
    ['assets', 'assets'],
    ['distribution', 'distribution'],
    ['endpoints', 'endpoints'],
    ['oauth', 'oauth'],
    ['surfaces', 'surfaces'],
    ['capabilities', 'capabilities'],
  ];
  return keys
    .filter(([key]) => JSON.stringify(asObject(currentConfig?.[key])) !== JSON.stringify(asObject(compareConfig?.[key])))
    .map(([, label]) => label);
}

function fieldValue(value) {
  return escapeHtml(value == null ? '' : value);
}

function metricsFromBrand(brand) {
  const draftConfig = asObject(brand?.draftConfig);
  const surfaces = Object.values(asObject(draftConfig.surfaces)).filter((surface) => asObject(surface).enabled !== false);
  const capabilities = asObject(draftConfig.capabilities);
  return {
    surfaces: surfaces.length,
    skills: asStringArray(capabilities.skills).length,
    mcpServers: asStringArray(capabilities.mcp_servers).length,
    pendingChanges: JSON.stringify(brand?.draftConfig || {}) !== JSON.stringify(brand?.publishedConfig || {}),
  };
}

function resetBanner() {
  state.error = '';
  state.notice = '';
}

function setError(message) {
  state.error = message;
  state.notice = '';
  render();
}

function setNotice(message) {
  state.notice = message;
  state.error = '';
  render();
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.error?.message || `Request failed with status ${response.status}`);
    error.code = payload?.error?.code || 'REQUEST_FAILED';
    throw error;
  }
  return payload.data;
}

async function refreshToken() {
  if (!state.tokens?.refresh_token) {
    return false;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: state.tokens.refresh_token,
    }),
  });

  const tokens = await parseResponse(response);
  persistTokens({
    ...state.tokens,
    ...tokens,
  });
  return true;
}

async function apiFetch(path, init = {}, options = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  if (state.tokens?.access_token) {
    headers.set('Authorization', `Bearer ${state.tokens.access_token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && !options.skipRefresh && state.tokens?.refresh_token) {
    const refreshed = await refreshToken().catch(() => false);
    if (refreshed) {
      return apiFetch(path, init, {skipRefresh: true});
    }
  }

  return parseResponse(response);
}

function buildBrandDraftBuffer(detail) {
  const brand = detail?.brand || null;
  const draftConfig = clone(asObject(brand?.draftConfig));
  const draftTheme = asObject(draftConfig.theme);
  const lightTheme = asObject(draftTheme.light);
  const darkTheme = asObject(draftTheme.dark);
  const capabilities = asObject(draftConfig.capabilities);
  const surfaceEntries = asObject(draftConfig.surfaces);
  const orderedSurfaceKeys = Array.from(
    new Set([
      'desktop',
      'home-web',
      'header',
      'sidebar',
      'input',
      'skill-store',
      ...Object.keys(surfaceEntries),
    ]),
  );

  return {
    brandId: brand?.brandId || '',
    displayName: brand?.displayName || '',
    productName: brand?.productName || '',
    tenantKey: brand?.tenantKey || '',
    status: brand?.status || 'draft',
    advancedJson: JSON.stringify(draftConfig, null, 2),
    theme: {
      lightPrimary: lightTheme.primary || '',
      lightPrimaryHover: lightTheme.primaryHover || '',
      lightOnPrimary: lightTheme.onPrimary || '',
      darkPrimary: darkTheme.primary || '',
      darkPrimaryHover: darkTheme.primaryHover || '',
      darkOnPrimary: darkTheme.onPrimary || '',
    },
    selectedSkills: asStringArray(capabilities.skills),
    selectedMcp: asStringArray(capabilities.mcp_servers),
    agentsText: asStringArray(capabilities.agents).join('\n'),
    menusText: asStringArray(capabilities.menus).join('\n'),
    surfaces: orderedSurfaceKeys.map((key) => {
      const surface = asObject(surfaceEntries[key]);
      return {
        key,
        label: surfaceLabel(key),
        enabled: surface.enabled !== false,
        json: JSON.stringify(asObject(surface.config), null, 2),
      };
    }),
  };
}

function ensureBrandDraftBuffer() {
  if (!state.brandDraftBuffer && state.brandDetail?.brand) {
    state.brandDraftBuffer = buildBrandDraftBuffer(state.brandDetail);
  }
  return state.brandDraftBuffer;
}

function captureBrandEditorBuffer() {
  const form = document.querySelector('#brand-editor-form');
  if (!form) {
    return state.brandDraftBuffer;
  }

  const data = new FormData(form);
  const surfaces = Array.from(form.querySelectorAll('.surface-editor')).map((node) => ({
    key: node.getAttribute('data-surface-key') || '',
    label: node.getAttribute('data-surface-label') || '',
    enabled: Boolean(node.querySelector('input[type="checkbox"]')?.checked),
    json: String(node.querySelector('textarea')?.value || '{}'),
  }));

  state.brandDraftBuffer = {
    brandId: String(data.get('brand_id') || ''),
    displayName: String(data.get('display_name') || ''),
    productName: String(data.get('product_name') || ''),
    tenantKey: String(data.get('tenant_key') || ''),
    status: String(data.get('status') || 'draft'),
    advancedJson: String(data.get('advanced_json') || '{}'),
    theme: {
      lightPrimary: String(data.get('theme_light_primary') || ''),
      lightPrimaryHover: String(data.get('theme_light_primary_hover') || ''),
      lightOnPrimary: String(data.get('theme_light_on_primary') || ''),
      darkPrimary: String(data.get('theme_dark_primary') || ''),
      darkPrimaryHover: String(data.get('theme_dark_primary_hover') || ''),
      darkOnPrimary: String(data.get('theme_dark_on_primary') || ''),
    },
    selectedSkills: Array.from(form.querySelectorAll('.skill-checkbox:checked')).map((node) => node.value),
    selectedMcp: Array.from(form.querySelectorAll('.mcp-checkbox:checked')).map((node) => node.value),
    agentsText: String(data.get('agents_text') || ''),
    menusText: String(data.get('menus_text') || ''),
    surfaces,
  };

  return state.brandDraftBuffer;
}

function parseJsonText(raw, label) {
  try {
    const parsed = JSON.parse(String(raw || '{}'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} 必须是 JSON 对象`);
    }
    return parsed;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : `${label} 不是合法 JSON`);
  }
}

function composeDraftConfig(buffer) {
  const draftConfig = parseJsonText(buffer.advancedJson, '高级配置');
  const theme = asObject(draftConfig.theme);
  draftConfig.theme = {
    ...theme,
    light: {
      ...asObject(theme.light),
      primary: buffer.theme.lightPrimary.trim(),
      primaryHover: buffer.theme.lightPrimaryHover.trim(),
      onPrimary: buffer.theme.lightOnPrimary.trim(),
    },
    dark: {
      ...asObject(theme.dark),
      primary: buffer.theme.darkPrimary.trim(),
      primaryHover: buffer.theme.darkPrimaryHover.trim(),
      onPrimary: buffer.theme.darkOnPrimary.trim(),
    },
  };

  draftConfig.surfaces = buffer.surfaces.reduce((accumulator, surface) => {
    accumulator[surface.key] = {
      enabled: surface.enabled,
      config: parseJsonText(surface.json, `${surface.label} 配置`),
    };
    return accumulator;
  }, {});

  draftConfig.capabilities = {
    ...asObject(draftConfig.capabilities),
    skills: buffer.selectedSkills,
    mcp_servers: buffer.selectedMcp,
    agents: splitLines(buffer.agentsText),
    menus: splitLines(buffer.menusText),
  };

  return draftConfig;
}

async function authenticate(identifier, password) {
  state.busy = true;
  resetBanner();
  render();

  try {
    const data = await apiFetch(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          password,
        }),
      },
      {skipRefresh: true},
    );
    persistTokens(data.tokens);
    state.user = data.user;
    state.view = 'dashboard';
    state.route = 'overview';
    await loadAppData();
    setNotice('运营控制台已就绪。');
  } catch (error) {
    setError(error instanceof Error ? error.message : '登录失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function ensureSession() {
  if (!state.tokens?.access_token) {
    state.view = 'login';
    render();
    return;
  }

  try {
    state.user = await apiFetch('/auth/me', {method: 'GET'});
    state.view = 'dashboard';
    await loadAppData();
  } catch {
    persistTokens(null);
    state.user = null;
    state.view = 'login';
    render();
  }
}

function syncCapabilitySelection() {
  const skills = getMergedSkills();
  const mcpServers = getMergedMcpServers();
  if (!skills.find((item) => item.slug === state.selectedSkillSlug)) {
    state.selectedSkillSlug = skills[0]?.slug || '';
  }
  if (!mcpServers.find((item) => item.key === state.selectedMcpKey)) {
    state.selectedMcpKey = mcpServers[0]?.key || '';
  }
}

function syncSupplementalSelection() {
  if (!state.releases.find((item) => item.id === state.selectedReleaseId)) {
    state.selectedReleaseId = state.releases[0]?.id || '';
  }
  if (!state.audit.find((item) => item.id === state.selectedAuditId)) {
    state.selectedAuditId = state.audit[0]?.id || '';
  }
}

async function loadAppData() {
  state.loading = true;
  render();

  try {
    const [dashboard, brandsData, capabilities, assetsData, releasesData, auditData, skillCatalogData, personalSkillCatalogData, skillLibraryData, mcpCatalogData] = await Promise.all([
      apiFetch('/admin/oem/dashboard', {method: 'GET'}),
      apiFetch('/admin/oem/brands', {method: 'GET'}),
      apiFetch('/admin/oem/capabilities', {method: 'GET'}),
      apiFetch('/admin/oem/assets?limit=200', {method: 'GET'}),
      apiFetch('/admin/oem/releases?limit=200', {method: 'GET'}),
      apiFetch('/admin/oem/audit?limit=200', {method: 'GET'}),
      apiFetch('/admin/skills/catalog', {method: 'GET'}),
      apiFetch('/skills/catalog/personal', {method: 'GET'}),
      apiFetch('/skills/library', {method: 'GET'}),
      apiFetch('/admin/mcp/catalog', {method: 'GET'}),
    ]);

    state.dashboard = dashboard;
    state.brands = Array.isArray(brandsData.items) ? brandsData.items : [];
    state.capabilities = capabilities;
    state.assets = Array.isArray(assetsData.items) ? assetsData.items : [];
    state.releases = Array.isArray(releasesData.items) ? releasesData.items : [];
    state.audit = Array.isArray(auditData.items) ? auditData.items : [];
    state.skillCatalog = Array.isArray(skillCatalogData.items) ? skillCatalogData.items : [];
    state.personalSkillCatalog = Array.isArray(personalSkillCatalogData.items) ? personalSkillCatalogData.items : [];
    state.skillLibrary = Array.isArray(skillLibraryData.items) ? skillLibraryData.items : [];
    state.mcpCatalog = Array.isArray(mcpCatalogData.items) ? mcpCatalogData.items : [];

    if (!state.selectedBrandId || !state.brands.find((brand) => brand.brandId === state.selectedBrandId)) {
      state.selectedBrandId = state.brands[0]?.brandId || '';
    }

    syncCapabilitySelection();
    syncSupplementalSelection();

    if (state.selectedBrandId) {
      await loadBrandDetail(state.selectedBrandId, {silent: true, suppressRender: true});
    } else {
      state.brandDetail = null;
      state.brandDraftBuffer = null;
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : '加载运营数据失败');
  } finally {
    state.loading = false;
    render();
  }
}

async function loadBrandDetail(brandId, options = {}) {
  if (!brandId) {
    return;
  }

  if (!options.silent) {
    state.busy = true;
    render();
  }

  try {
    const data = await apiFetch(`/admin/oem/brand?brand_id=${encodeURIComponent(brandId)}`, {method: 'GET'});
    state.selectedBrandId = brandId;
    state.brandDetail = data;
    state.brandDraftBuffer = buildBrandDraftBuffer(data);
  } catch (error) {
    setError(error instanceof Error ? error.message : '品牌详情加载失败');
  } finally {
    if (!options.silent) {
      state.busy = false;
    }
    if (!options.suppressRender) {
      render();
    }
  }
}

async function persistBrandDraft(brandRecord, draftConfig) {
  return apiFetch('/admin/oem/brand', {
    method: 'PUT',
    body: JSON.stringify({
      brand_id: brandRecord.brandId,
      tenant_key: brandRecord.tenantKey,
      display_name: brandRecord.displayName,
      product_name: brandRecord.productName,
      status: brandRecord.status,
      draft_config: draftConfig,
    }),
  });
}

async function saveBrandEditor(form) {
  const snapshot = captureBrandEditorBuffer();
  let draftConfig;
  try {
    draftConfig = composeDraftConfig(snapshot);
  } catch (error) {
    setError(error instanceof Error ? error.message : '品牌配置不是合法 JSON');
    return;
  }

  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch('/admin/oem/brand', {
      method: 'PUT',
      body: JSON.stringify({
        brand_id: snapshot.brandId,
        tenant_key: snapshot.tenantKey,
        display_name: snapshot.displayName,
        product_name: snapshot.productName,
        status: snapshot.status,
        draft_config: draftConfig,
      }),
    });

    await loadAppData();
    state.route = 'brand-detail';
    await loadBrandDetail(snapshot.brandId, {silent: true, suppressRender: true});
    setNotice(`已保存 ${snapshot.displayName || snapshot.brandId} 的草稿配置。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '保存品牌草稿失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function publishCurrentBrand() {
  const brandId = state.selectedBrandId;
  if (!brandId) return;
  captureBrandEditorBuffer();
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch('/admin/oem/brand/publish', {
      method: 'POST',
      body: JSON.stringify({brand_id: brandId}),
    });
    await loadAppData();
    state.route = 'brand-detail';
    await loadBrandDetail(brandId, {silent: true, suppressRender: true});
    setNotice(`已发布 ${brandId}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '发布失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function rollbackBrand(version) {
  if (!state.selectedBrandId || !version) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch('/admin/oem/brand/rollback', {
      method: 'POST',
      body: JSON.stringify({
        brand_id: state.selectedBrandId,
        version,
      }),
    });
    await loadAppData();
    state.route = 'brand-detail';
    await loadBrandDetail(state.selectedBrandId, {silent: true, suppressRender: true});
    setNotice(`已将 ${state.selectedBrandId} 的草稿回滚到 v${version}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '回滚失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function createBrand(formData) {
  const brandId = String(formData.get('brand_id') || '').trim().toLowerCase();
  const displayName = String(formData.get('display_name') || '').trim();
  const productName = String(formData.get('product_name') || '').trim();
  const tenantKey = String(formData.get('tenant_key') || brandId).trim();

  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch('/admin/oem/brand', {
      method: 'PUT',
      body: JSON.stringify({
        brand_id: brandId,
        tenant_key: tenantKey,
        display_name: displayName,
        product_name: productName,
        status: 'draft',
      }),
    });
    await loadAppData();
    state.route = 'brand-detail';
    await loadBrandDetail(brandId, {silent: true, suppressRender: true});
    setNotice(`已创建品牌 ${displayName || brandId}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '创建品牌失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function saveAsset(formData) {
  const brandId = String(formData.get('brand_id') || '').trim();
  const assetKey = String(formData.get('asset_key') || '').trim();
  const kind = String(formData.get('kind') || '').trim();
  const storageProvider = String(formData.get('storage_provider') || 'repo').trim();
  const objectKey = String(formData.get('object_key') || '').trim();
  const publicUrl = String(formData.get('public_url') || '').trim();
  const metadataText = String(formData.get('metadata_json') || '{}').trim();
  const file = formData.get('file');

  let metadata = {};
  try {
    metadata = parseJsonText(metadataText, '资源 metadata');
  } catch (error) {
    setError(error instanceof Error ? error.message : '资源 metadata 不是合法 JSON');
    return;
  }

  state.busy = true;
  resetBanner();
  render();

  try {
    if (file instanceof File && file.size > 0) {
      const fileBase64 = await readFileAsBase64(file);
      await apiFetch('/admin/oem/asset/upload', {
        method: 'POST',
        body: JSON.stringify({
          brand_id: brandId,
          asset_key: assetKey,
          kind,
          content_type: file.type || 'application/octet-stream',
          file_name: file.name,
          file_base64: fileBase64,
          metadata,
        }),
      });
    } else {
      await apiFetch('/admin/oem/asset', {
        method: 'PUT',
        body: JSON.stringify({
          brand_id: brandId,
          asset_key: assetKey,
          kind,
          storage_provider: storageProvider,
          object_key: objectKey,
          public_url: publicUrl || null,
          metadata,
        }),
      });
    }

    await loadAppData();
    if (brandId) {
      await loadBrandDetail(brandId, {silent: true, suppressRender: true});
    }
    setNotice(`已更新 ${assetKey} 资源绑定。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '资源保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function deleteAsset(brandId, assetKey) {
  if (!brandId || !assetKey) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch(`/admin/oem/asset?brand_id=${encodeURIComponent(brandId)}&asset_key=${encodeURIComponent(assetKey)}`, {
      method: 'DELETE',
    });
    await loadAppData();
    if (brandId) {
      await loadBrandDetail(brandId, {silent: true, suppressRender: true});
    }
    setNotice(`已删除资源 ${assetKey}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '资源删除失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function setSkillEnabled(slug, enabled) {
  if (!slug) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    const installed = getSkillLibraryItem(slug);
    if (enabled && !installed) {
      await apiFetch('/skills/library/install', {
        method: 'POST',
        body: JSON.stringify({slug}),
      });
    } else if (installed) {
      await apiFetch('/skills/library/state', {
        method: 'PUT',
        body: JSON.stringify({slug, enabled}),
      });
    }
    await loadAppData();
    setNotice(`${slug} 已${enabled ? '启用' : '停用'}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : `技能${enabled ? '启用' : '停用'}失败`);
  } finally {
    state.busy = false;
    render();
  }
}

async function deleteSkill(slug) {
  if (!slug) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    const installed = getSkillLibraryItem(slug);
    const catalog = getAdminSkillCatalogEntry(slug);
    const personal = getPersonalSkillCatalogEntry(slug);
    if (installed) {
      await apiFetch('/skills/library/uninstall', {
        method: 'POST',
        body: JSON.stringify({slug}),
      });
    }
    if (personal?.source === 'private') {
      await apiFetch(`/skills/catalog/personal?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });
    } else if (catalog && catalog.distribution !== 'bundled') {
      await apiFetch(`/admin/skills/catalog?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });
    }
    await loadAppData();
    setNotice(`已删除技能 ${slug}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '技能删除失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function importSkill(formData) {
  const artifact = formData.get('artifact');
  if (!(artifact instanceof File) || artifact.size === 0) {
    setError('请选择 skill 包文件');
    return;
  }

  state.busy = true;
  resetBanner();
  render();

  try {
    const artifactBase64 = await readFileAsBase64(artifact);
    await apiFetch('/skills/library/import', {
      method: 'POST',
      body: JSON.stringify({
        slug: String(formData.get('slug') || '').trim(),
        name: String(formData.get('name') || '').trim(),
        description: String(formData.get('description') || '').trim(),
        publisher: String(formData.get('publisher') || '').trim() || 'admin-web',
        category: String(formData.get('category') || '').trim() || null,
        market: String(formData.get('market') || '').trim() || null,
        skill_type: String(formData.get('skill_type') || '').trim() || null,
        version: String(formData.get('version') || '').trim(),
        artifact_format: artifact.name.endsWith('.zip') ? 'zip' : 'tar.gz',
        artifact_base64: artifactBase64,
      }),
    });
    await loadAppData();
    setNotice(`已导入技能 ${String(formData.get('slug') || '').trim()}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '技能导入失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function saveMcpCatalogEntry(formData) {
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch('/admin/mcp/catalog', {
      method: 'PUT',
      body: JSON.stringify({
        key: String(formData.get('key') || '').trim(),
        enabled: String(formData.get('enabled') || 'true') === 'true',
        type: String(formData.get('type') || '').trim() || null,
        command: String(formData.get('command') || '').trim() || null,
        args: splitLines(String(formData.get('args_text') || '')),
        http_url: String(formData.get('http_url') || '').trim() || null,
        env: parseEnvText(String(formData.get('env_text') || '')),
      }),
    });
    await loadAppData();
    state.selectedMcpKey = String(formData.get('key') || '').trim();
    setNotice(`MCP ${state.selectedMcpKey} 已保存。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'MCP 保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function testMcpCatalogEntry(payload) {
  state.busy = true;
  resetBanner();
  render();

  try {
    state.mcpTestResult = await apiFetch('/admin/mcp/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setNotice(`MCP 测试${state.mcpTestResult.ok ? '通过' : '失败'}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'MCP 测试失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function deleteMcpCatalogEntry(key) {
  if (!key) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch(`/admin/mcp/catalog?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    await loadAppData();
    state.selectedMcpKey = '';
    setNotice(`已删除 MCP ${key}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'MCP 删除失败');
  } finally {
    state.busy = false;
    render();
  }
}

function toggleBrandCapability(type, value) {
  const buffer = ensureBrandDraftBuffer();
  if (!buffer) return;
  const current = new Set(type === 'skill' ? buffer.selectedSkills : buffer.selectedMcp);
  if (current.has(value)) {
    current.delete(value);
  } else {
    current.add(value);
  }
  if (type === 'skill') {
    buffer.selectedSkills = Array.from(current);
  } else {
    buffer.selectedMcp = Array.from(current);
  }
  state.brandDraftBuffer = buffer;
  render();
}

function logout() {
  persistTokens(null);
  state.user = null;
  state.view = 'login';
  state.route = 'overview';
  state.dashboard = null;
  state.brands = [];
  state.brandDetail = null;
  state.brandDraftBuffer = null;
  state.capabilities = null;
  state.skillCatalog = [];
  state.personalSkillCatalog = [];
  state.skillLibrary = [];
  state.mcpCatalog = [];
  state.selectedReleaseId = '';
  state.selectedAuditId = '';
  state.mcpTestResult = null;
  state.assets = [];
  state.releases = [];
  state.audit = [];
  resetBanner();
  render();
}

function renderBanner() {
  return `
    <div class="banner-row">
      <div class="banner banner--error"${state.error ? '' : ' hidden'}>${escapeHtml(state.error)}</div>
      <div class="banner banner--success"${state.notice ? '' : ' hidden'}>${escapeHtml(state.notice)}</div>
    </div>
  `;
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <span class="eyebrow">OEM Control Center</span>
        <strong>运营管理平台</strong>
        <p>${escapeHtml(state.user?.name || state.user?.username || 'admin')}</p>
      </div>
      <nav class="nav-list">
        ${NAV_ITEMS.map(
          (item) => `
            <button class="nav-item${state.route === item.id ? ' is-active' : ''}" type="button" data-action="navigate" data-page="${item.id}">
              <span>${escapeHtml(item.label)}</span>
              <small>${escapeHtml(item.eyebrow)}</small>
            </button>
          `,
        ).join('')}
      </nav>
      <section class="sidebar-section">
        <div class="sidebar-section__head">
          <span class="eyebrow">Brands</span>
          <button class="text-button" type="button" data-action="navigate" data-page="brands">查看全部</button>
        </div>
        <div class="mini-brand-list">
          ${state.brands.slice(0, 6).map(renderMiniBrandButton).join('')}
        </div>
      </section>
      <div class="sidebar-footer">
        <div class="sidebar-meta">
          <span>Control API</span>
          <strong>${escapeHtml(API_BASE_URL)}</strong>
        </div>
        <button class="ghost-button ghost-button--full" type="button" data-action="logout">退出登录</button>
      </div>
    </aside>
  `;
}

function renderMiniBrandButton(brand) {
  return `
    <button
      class="mini-brand-card${brand.brandId === state.selectedBrandId ? ' is-active' : ''}"
      type="button"
      data-action="select-brand"
      data-brand-id="${escapeHtml(brand.brandId)}"
    >
      <strong>${escapeHtml(brand.displayName)}</strong>
      <span>${escapeHtml(brand.brandId)}</span>
    </button>
  `;
}

function renderHeader(title, description, actions = '') {
  return `
    <header class="page-header">
      <div>
        <p class="eyebrow">Control Plane</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="page-description">${escapeHtml(description)}</p>
      </div>
      <div class="page-actions">${actions}</div>
    </header>
  `;
}

function renderOverviewPage() {
  const stats = state.dashboard?.stats || {};
  const releases = state.dashboard?.recent_releases || [];
  const edits = state.dashboard?.recent_edits || [];
  const activity = state.dashboard?.brand_activity || [];

  return `
    ${renderHeader(
      '总览',
      '用同一套控制平面管理多品牌、多版本、多 Surface 的 OEM 配置。',
      `
        <button class="ghost-button" type="button" data-action="refresh-page">刷新数据</button>
        <button class="solid-button" type="button" data-action="navigate" data-page="brands">创建或管理品牌</button>
      `,
    )}
    <section class="stats-grid">
      ${[
        ['品牌总数', stats.brands_total, '已纳入注册表的 OEM 租户'],
        ['已发布', stats.published_count, '已生成线上快照'],
        ['草稿中', stats.draft_count, '仍在编辑中的品牌'],
        ['资源数', stats.assets_count, '品牌资产与分发素材'],
        ['技能数', stats.skills_count, '控制面可分配技能'],
        ['MCP 数', stats.mcp_servers_count, '可绑定能力提供方'],
        ['待发布更改', stats.pending_changes_count, '草稿与线上存在差异'],
      ]
        .map(
          ([label, value, note]) => `
            <article class="stat-card">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value ?? 0)}</strong>
              <p>${escapeHtml(note)}</p>
            </article>
          `,
        )
        .join('')}
    </section>
    <section class="overview-grid">
      <article class="panel">
        <div class="panel-head">
          <h2>最近发布</h2>
          <button class="text-button" type="button" data-action="navigate" data-page="releases">查看全部</button>
        </div>
        <div class="list-stack">
          ${releases.length
            ? releases
                .map(
                  (item) => `
                    <div class="list-row list-row--dense">
                      <div>
                        <strong>${escapeHtml(item.display_name)}</strong>
                        <span>v${escapeHtml(item.version)} · ${escapeHtml((item.surfaces || []).join(' / ') || '无 Surface')}</span>
                      </div>
                      <div class="row-aside">
                        <span>${escapeHtml(item.created_by_name || item.created_by_username || 'system')}</span>
                        <small>${escapeHtml(formatRelative(item.published_at))}</small>
                      </div>
                    </div>
                  `,
                )
                .join('')
            : `<div class="empty-state">当前没有发布记录。</div>`}
        </div>
      </article>
      <article class="panel">
        <div class="panel-head">
          <h2>最近编辑</h2>
          <button class="text-button" type="button" data-action="navigate" data-page="audit-log">查看审计日志</button>
        </div>
        <div class="list-stack">
          ${edits.length
            ? edits
                .map(
                  (item) => `
                    <div class="list-row list-row--dense">
                      <div>
                        <strong>${escapeHtml(item.display_name)}</strong>
                        <span>${escapeHtml(actionLabel(item.action))} · ${escapeHtml(item.environment || 'control-plane')}</span>
                      </div>
                      <div class="row-aside">
                        <span>${escapeHtml(item.actor_name || item.actor_username || 'system')}</span>
                        <small>${escapeHtml(formatRelative(item.created_at))}</small>
                      </div>
                    </div>
                  `,
                )
                .join('')
            : `<div class="empty-state">当前没有编辑记录。</div>`}
        </div>
      </article>
    </section>
    <section class="panel">
      <div class="panel-head">
        <h2>品牌活跃度</h2>
        <button class="text-button" type="button" data-action="navigate" data-page="brands">打开品牌视图</button>
      </div>
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>品牌</th>
              <th>状态</th>
              <th>Surface</th>
              <th>技能</th>
              <th>MCP</th>
              <th>资源</th>
              <th>最近更新时间</th>
            </tr>
          </thead>
          <tbody>
            ${activity.length
              ? activity
                  .map(
                    (item) => `
                      <tr>
                        <td>
                          <button class="table-link" type="button" data-action="select-brand" data-brand-id="${escapeHtml(item.brand_id)}">
                            ${escapeHtml(item.display_name)}
                          </button>
                        </td>
                        <td>${statusBadge(item.status)}</td>
                        <td>${escapeHtml(item.configured_surfaces)}</td>
                        <td>${escapeHtml(item.enabled_skills)}</td>
                        <td>${escapeHtml(item.enabled_mcp_servers)}</td>
                        <td>${escapeHtml(item.asset_count)}</td>
                        <td>${escapeHtml(formatDateTime(item.updated_at))}</td>
                      </tr>
                    `,
                  )
                  .join('')
              : `<tr><td colspan="7"><div class="empty-state">暂无品牌活跃度数据。</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function getFilteredBrands() {
  const query = state.filters.brandQuery.trim().toLowerCase();
  return state.brands.filter((brand) => {
    if (state.filters.brandStatus !== 'all' && brand.status !== state.filters.brandStatus) {
      return false;
    }
    if (!query) return true;
    return [brand.brandId, brand.displayName, brand.productName, brand.tenantKey].some((item) =>
      String(item || '').toLowerCase().includes(query),
    );
  });
}

function renderBrandsPage() {
  const brands = getFilteredBrands();

  return `
    ${renderHeader(
      '品牌管理',
      '维护品牌元数据、Surface 覆盖、发布状态和租户配置。',
      `<button class="ghost-button" type="button" data-action="refresh-page">同步控制面</button>`,
    )}
    <section class="panel panel--form">
      <div class="panel-head">
        <h2>创建新品牌</h2>
        <span>首次创建即写入真实 OEM 草稿配置</span>
      </div>
      <form class="inline-form" id="create-brand-form">
        <input class="field-input" name="brand_id" placeholder="brand id" />
        <input class="field-input" name="display_name" placeholder="显示名称" />
        <input class="field-input" name="product_name" placeholder="产品名称" />
        <input class="field-input" name="tenant_key" placeholder="tenant key" />
        <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>创建品牌</button>
      </form>
    </section>
    <section class="filter-row">
      <input
        class="field-input"
        data-filter-key="brandQuery"
        placeholder="搜索 brand id / 品牌名 / 租户 key"
        value="${fieldValue(state.filters.brandQuery)}"
      />
      <select class="field-select" data-filter-key="brandStatus">
        ${['all', 'published', 'draft', 'archived']
          .map(
            (item) => `
              <option value="${item}"${state.filters.brandStatus === item ? ' selected' : ''}>
                ${item === 'all' ? '全部状态' : statusLabel(item)}
              </option>
            `,
          )
          .join('')}
      </select>
    </section>
    <section class="brand-grid">
      ${brands.length
        ? brands.map(renderBrandCard).join('')
        : `<div class="empty-state empty-state--panel">没有匹配的品牌。</div>`}
    </section>
  `;
}

function renderBrandCard(brand) {
  const metrics = metricsFromBrand(brand);
  return `
    <article class="brand-card">
      <div class="brand-card__head">
        <div>
          <h2>${escapeHtml(brand.displayName)}</h2>
          <p>${escapeHtml(brand.productName)}</p>
        </div>
        ${statusBadge(brand.status)}
      </div>
      <dl class="brand-meta">
        <div><dt>Brand ID</dt><dd>${escapeHtml(brand.brandId)}</dd></div>
        <div><dt>Tenant Key</dt><dd>${escapeHtml(brand.tenantKey)}</dd></div>
        <div><dt>当前版本</dt><dd>v${escapeHtml(brand.publishedVersion || 0)}</dd></div>
        <div><dt>待发布</dt><dd>${metrics.pendingChanges ? '有变更' : '无差异'}</dd></div>
      </dl>
      <div class="metric-chips">
        <span>${escapeHtml(metrics.surfaces)} 个 Surface</span>
        <span>${escapeHtml(metrics.skills)} 个技能</span>
        <span>${escapeHtml(metrics.mcpServers)} 个 MCP</span>
      </div>
      <div class="brand-card__footer">
        <small>${escapeHtml(formatRelative(brand.updatedAt))}</small>
        <button class="ghost-button" type="button" data-action="select-brand" data-brand-id="${escapeHtml(brand.brandId)}">进入详情</button>
      </div>
    </article>
  `;
}

function renderBrandDetailPage() {
  if (!state.brandDetail?.brand) {
    return `
      ${renderHeader('品牌详情', '选择品牌后查看真实配置、资源和发布轨迹。')}
      <div class="empty-state empty-state--panel">当前没有可查看的品牌。</div>
    `;
  }

  const brand = state.brandDetail.brand;
  const buffer = ensureBrandDraftBuffer();
  const versions = state.brandDetail.versions || [];
  const assets = state.brandDetail.assets || [];
  const audit = state.brandDetail.audit || [];

  return `
    ${renderHeader(
      brand.displayName,
      `${brand.productName} · 租户 ${brand.tenantKey}`,
      `
        ${statusBadge(brand.status)}
        <button class="ghost-button" type="button" data-action="navigate" data-page="brands">返回品牌列表</button>
        <button class="solid-button" type="button" data-action="publish-brand"${state.busy ? ' disabled' : ''}>发布当前草稿</button>
      `,
    )}
    <section class="detail-layout">
      <aside class="detail-rail">
        <article class="panel">
          <div class="panel-head">
            <h2>发布信息</h2>
            <span>实时来自 PostgreSQL</span>
          </div>
          <dl class="brand-meta brand-meta--stacked">
            <div><dt>Brand ID</dt><dd>${escapeHtml(brand.brandId)}</dd></div>
            <div><dt>Tenant Key</dt><dd>${escapeHtml(brand.tenantKey)}</dd></div>
            <div><dt>线上版本</dt><dd>v${escapeHtml(brand.publishedVersion || 0)}</dd></div>
            <div><dt>更新时间</dt><dd>${escapeHtml(formatDateTime(brand.updatedAt))}</dd></div>
          </dl>
        </article>
        <article class="panel">
          <div class="panel-head">
            <h2>版本轨迹</h2>
            <span>可回滚到任意已发布版本</span>
          </div>
          <div class="timeline-stack">
            ${versions.length
              ? versions
                  .map(
                    (item) => `
                      <div class="timeline-item">
                        <div>
                          <strong>v${escapeHtml(item.version)}</strong>
                          <small>${escapeHtml(formatDateTime(item.publishedAt))}</small>
                          <span>${escapeHtml(item.createdByName || item.createdByUsername || 'system')}</span>
                        </div>
                        <button class="text-button" type="button" data-action="rollback-brand" data-version="${escapeHtml(item.version)}"${state.busy ? ' disabled' : ''}>
                          回滚为草稿
                        </button>
                      </div>
                    `,
                  )
                  .join('')
              : `<div class="empty-state">还没有发布记录。</div>`}
          </div>
        </article>
        <article class="panel">
          <div class="panel-head">
            <h2>最近审计</h2>
            <button class="text-button" type="button" data-action="navigate" data-page="audit-log">全部日志</button>
          </div>
          <div class="list-stack">
            ${audit.length
              ? audit
                  .slice(0, 6)
                  .map(
                    (item) => `
                      <div class="list-row list-row--dense">
                        <div>
                          <strong>${escapeHtml(actionLabel(item.action))}</strong>
                          <span>${escapeHtml(item.actorName || item.actorUsername || 'system')}</span>
                        </div>
                        <small>${escapeHtml(formatRelative(item.createdAt))}</small>
                      </div>
                    `,
                  )
                  .join('')
              : `<div class="empty-state">暂无审计记录。</div>`}
          </div>
        </article>
      </aside>
      <section class="detail-main">
        <form id="brand-editor-form" class="panel panel--spacious">
          <input type="hidden" name="brand_id" value="${fieldValue(buffer.brandId)}" />
          <div class="panel-head panel-head--tight">
            <div>
              <h2>品牌草稿编辑器</h2>
              <span>基础字段、Surface、能力开关和高级 JSON 同时落到真实 draft_config</span>
            </div>
            <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存草稿</button>
          </div>

          <section class="form-grid form-grid--three">
            <label class="field">
              <span>显示名称</span>
              <input class="field-input" name="display_name" value="${fieldValue(buffer.displayName)}" />
            </label>
            <label class="field">
              <span>产品名称</span>
              <input class="field-input" name="product_name" value="${fieldValue(buffer.productName)}" />
            </label>
            <label class="field">
              <span>Tenant Key</span>
              <input class="field-input" name="tenant_key" value="${fieldValue(buffer.tenantKey)}" />
            </label>
            <label class="field">
              <span>品牌状态</span>
              <select class="field-select" name="status">
                ${['draft', 'published', 'archived']
                  .map(
                    (item) => `
                      <option value="${item}"${buffer.status === item ? ' selected' : ''}>${escapeHtml(statusLabel(item))}</option>
                    `,
                  )
                  .join('')}
              </select>
            </label>
          </section>

          <div class="tab-row">
            ${[
              ['surfaces', 'Surface 配置'],
              ['capabilities', '技能与 MCP'],
              ['assets', '品牌资源'],
              ['theme', '主题样式'],
              ['advanced', '高级 JSON'],
            ]
              .map(
                ([id, label]) => `
                  <button
                    class="tab-pill${state.brandDetailTab === id ? ' is-active' : ''}"
                    type="button"
                    data-action="brand-tab"
                    data-tab="${id}"
                  >
                    ${escapeHtml(label)}
                  </button>
                `,
              )
              .join('')}
          </div>

          ${renderBrandEditorBody(buffer, assets)}
        </form>
      </section>
    </section>
  `;
}

function renderBrandEditorBody(buffer, assets) {
  if (state.brandDetailTab === 'surfaces') {
    return `
      <section class="surface-grid">
        ${buffer.surfaces
          .map(
            (surface) => `
              <article class="surface-editor" data-surface-key="${escapeHtml(surface.key)}" data-surface-label="${escapeHtml(surface.label)}">
                <div class="surface-editor__head">
                  <div>
                    <h3>${escapeHtml(surface.label)}</h3>
                    <p>${escapeHtml(surface.key)}</p>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" name="surface_enabled__${escapeHtml(surface.key)}"${surface.enabled ? ' checked' : ''} />
                    <span>启用</span>
                  </label>
                </div>
                <textarea class="code-input" name="surface_config__${escapeHtml(surface.key)}">${escapeHtml(surface.json)}</textarea>
              </article>
            `,
          )
          .join('')}
      </section>
    `;
  }

  if (state.brandDetailTab === 'capabilities') {
    const skills = state.capabilities?.skills || [];
    const mcpServers = state.capabilities?.mcp_servers || [];
    return `
      <section class="capability-columns">
        <article class="panel panel--nested">
          <div class="panel-head">
            <h3>技能绑定</h3>
            <span>控制哪些技能对该品牌开放</span>
          </div>
          <div class="checkbox-stack">
            ${skills.length
              ? skills
                  .map(
                    (skill) => `
                      <article class="checkbox-card checkbox-card--capability">
                        <input class="skill-checkbox visually-hidden" type="checkbox" value="${escapeHtml(skill.slug)}"${buffer.selectedSkills.includes(skill.slug) ? ' checked' : ''} />
                        <div>
                          <strong>${escapeHtml(skill.name)}</strong>
                          <span>${escapeHtml(skill.category || '未分类')} · ${escapeHtml(skill.publisher || 'iClaw')}</span>
                        </div>
                        <div class="row-actions">
                          <small>${escapeHtml(skill.brand_count)} 个品牌</small>
                          <button class="${buffer.selectedSkills.includes(skill.slug) ? 'ghost-button' : 'solid-button'} control-button" type="button" data-action="toggle-brand-skill" data-skill-slug="${escapeHtml(skill.slug)}">
                            ${buffer.selectedSkills.includes(skill.slug) ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </article>
                    `,
                  )
                  .join('')
              : `<div class="empty-state">当前没有可用技能。</div>`}
          </div>
        </article>
        <article class="panel panel--nested">
          <div class="panel-head">
            <h3>MCP 绑定</h3>
            <span>从真实 MCP 注册表选择能力提供方</span>
          </div>
          <div class="checkbox-stack">
            ${mcpServers.length
              ? mcpServers
                  .map(
                    (server) => `
                      <article class="checkbox-card checkbox-card--capability">
                        <input class="mcp-checkbox visually-hidden" type="checkbox" value="${escapeHtml(server.key)}"${buffer.selectedMcp.includes(server.key) ? ' checked' : ''} />
                        <div>
                          <strong>${escapeHtml(server.name)}</strong>
                          <span>${escapeHtml(server.command || '未声明 command')} · ${escapeHtml(server.env_keys.length)} 个环境变量</span>
                        </div>
                        <div class="row-actions">
                          <small>${escapeHtml(server.connected_brand_count)} 个品牌</small>
                          <button class="${buffer.selectedMcp.includes(server.key) ? 'ghost-button' : 'solid-button'} control-button" type="button" data-action="toggle-brand-mcp" data-mcp-key="${escapeHtml(server.key)}">
                            ${buffer.selectedMcp.includes(server.key) ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </article>
                    `,
                  )
                  .join('')
              : `<div class="empty-state">当前没有 MCP 目录。</div>`}
          </div>
          <label class="field">
            <span>Agents</span>
            <textarea class="field-textarea" name="agents_text" placeholder="每行一个 agent slug">${escapeHtml(buffer.agentsText)}</textarea>
          </label>
          <label class="field">
            <span>Menus</span>
            <textarea class="field-textarea" name="menus_text" placeholder="每行一个 menu key">${escapeHtml(buffer.menusText)}</textarea>
          </label>
        </article>
      </section>
    `;
  }

  if (state.brandDetailTab === 'assets') {
    const assetSlots = [
      ['logoMaster', 'Logo', 'logo'],
      ['homeLogo', 'Home Logo', 'logo'],
      ['faviconPng', 'Favicon PNG', 'favicon'],
      ['faviconIco', 'Favicon ICO', 'favicon'],
    ];
    return `
      <section class="asset-editor-layout">
        <article class="panel panel--nested">
          <div class="panel-head">
            <h3>Logo / Favicon 上传器</h3>
            <span>seed 资源是仓库内置 repo 文件；你在这里上传的新图会真正写入 MinIO / S3，并回填 draft_config.assets</span>
          </div>
          <form id="asset-form" class="stack-form">
            <input type="hidden" name="brand_id" value="${fieldValue(buffer.brandId)}" />
            <div class="asset-slot-grid">
              ${assetSlots
                .map(([assetKey, label, kind]) => {
                  const current = assets.find((item) => item.assetKey === assetKey) || null;
                  return `
                    <article class="asset-slot-card">
                      <div class="asset-slot-card__head">
                        <strong>${escapeHtml(label)}</strong>
                        <small>${escapeHtml(assetKey)}</small>
                      </div>
                      ${
                        current && isImageLike(current.metadata?.content_type, current.publicUrl, current.objectKey)
                          ? `<img class="asset-thumb asset-thumb--slot" src="${escapeHtml(resolveAssetUrl(current))}" alt="${escapeHtml(assetKey)}" />`
                          : `<div class="asset-thumb asset-thumb--slot asset-thumb--placeholder">No Asset</div>`
                      }
                      <button class="ghost-button control-button" type="button" data-action="fill-asset-preset" data-asset-key="${escapeHtml(assetKey)}" data-asset-kind="${escapeHtml(kind)}">使用此槽位</button>
                    </article>
                  `;
                })
                .join('')}
            </div>
            <div class="form-grid form-grid--two">
              <label class="field">
                <span>Asset Key</span>
                <input class="field-input" name="asset_key" placeholder="logoMaster / homeLogo / faviconPng" />
              </label>
              <label class="field">
                <span>资源类型</span>
                <input class="field-input" name="kind" placeholder="logo / hero / screenshot" />
              </label>
              <label class="field">
                <span>存储提供方</span>
                <input class="field-input" name="storage_provider" value="repo" />
              </label>
              <label class="field">
                <span>上传文件</span>
                <input class="field-input" name="file" type="file" />
              </label>
              <label class="field">
                <span>对象路径</span>
                <input class="field-input" name="object_key" placeholder="./assets/logo.png 或 s3://..." />
              </label>
              <label class="field field--wide">
                <span>Public URL</span>
                <input class="field-input" name="public_url" placeholder="https://..." />
              </label>
              <label class="field field--wide">
                <span>Metadata JSON</span>
                <textarea class="field-textarea" name="metadata_json">{}</textarea>
              </label>
            </div>
            <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>登记资源</button>
          </form>
        </article>
        <article class="panel panel--nested">
          <div class="panel-head">
            <h3>当前品牌资源</h3>
            <span>来自 oem_asset_registry 的真实记录</span>
          </div>
          <div class="list-stack">
            ${assets.length
              ? assets
                  .map(
                    (item) => `
                      <div class="list-row">
                        <div>
                          <strong>${escapeHtml(item.assetKey)}</strong>
                          <span>${escapeHtml(item.kind)} · ${escapeHtml(item.objectKey)}</span>
                          ${
                            isImageLike(item.metadata?.content_type, item.publicUrl, item.objectKey)
                              ? `<div class="asset-thumb-wrap"><img class="asset-thumb" src="${escapeHtml(resolveAssetUrl(item))}" alt="${escapeHtml(item.assetKey)}" /></div>`
                              : ''
                          }
                        </div>
                        <div class="row-aside">
                          <span>${escapeHtml(item.storageProvider)}</span>
                          ${
                            item.publicUrl || item.objectKey
                              ? `<a class="text-link" href="${escapeHtml(resolveAssetUrl(item))}" target="_blank" rel="noreferrer">打开资源</a>`
                              : ''
                          }
                          <button class="text-button" type="button" data-action="delete-asset" data-brand-id="${escapeHtml(item.brandId)}" data-asset-key="${escapeHtml(item.assetKey)}">删除</button>
                          <small>${escapeHtml(formatDateTime(item.updatedAt))}</small>
                        </div>
                      </div>
                    `,
                  )
                  .join('')
              : `<div class="empty-state">当前品牌还没有登记资源。</div>`}
          </div>
        </article>
      </section>
    `;
  }

  if (state.brandDetailTab === 'theme') {
    return `
      <section class="theme-grid">
        <article class="panel panel--nested">
          <div class="panel-head">
            <h3>Light Theme</h3>
            <span>写入 draft_config.theme.light</span>
          </div>
          <div class="form-grid form-grid--two">
            <label class="field">
              <span>Primary</span>
              <input class="field-input" name="theme_light_primary" value="${fieldValue(buffer.theme.lightPrimary)}" />
            </label>
            <label class="field">
              <span>Primary Hover</span>
              <input class="field-input" name="theme_light_primary_hover" value="${fieldValue(buffer.theme.lightPrimaryHover)}" />
            </label>
            <label class="field field--wide">
              <span>On Primary</span>
              <input class="field-input" name="theme_light_on_primary" value="${fieldValue(buffer.theme.lightOnPrimary)}" />
            </label>
          </div>
        </article>
        <article class="panel panel--nested">
          <div class="panel-head">
            <h3>Dark Theme</h3>
            <span>写入 draft_config.theme.dark</span>
          </div>
          <div class="form-grid form-grid--two">
            <label class="field">
              <span>Primary</span>
              <input class="field-input" name="theme_dark_primary" value="${fieldValue(buffer.theme.darkPrimary)}" />
            </label>
            <label class="field">
              <span>Primary Hover</span>
              <input class="field-input" name="theme_dark_primary_hover" value="${fieldValue(buffer.theme.darkPrimaryHover)}" />
            </label>
            <label class="field field--wide">
              <span>On Primary</span>
              <input class="field-input" name="theme_dark_on_primary" value="${fieldValue(buffer.theme.darkOnPrimary)}" />
            </label>
          </div>
        </article>
      </section>
    `;
  }

  return `
    <section class="advanced-editor">
      <label class="field">
        <span>完整 Draft Config JSON</span>
        <textarea class="code-input code-input--tall" name="advanced_json">${escapeHtml(buffer.advancedJson)}</textarea>
      </label>
    </section>
  `;
}

function getFilteredCapabilities() {
  const query = state.filters.capabilityQuery.trim().toLowerCase();
  const skills = getMergedSkills().filter((item) => {
    if (!query) return true;
    return [item.slug, item.name, item.category, item.publisher].some((value) =>
      String(value || '').toLowerCase().includes(query),
    );
  });
  const mcpServers = getMergedMcpServers().filter((item) => {
    if (!query) return true;
    return [item.key, item.name, item.command, item.http_url, ...(item.env_keys || [])].some((value) =>
      String(value || '').toLowerCase().includes(query),
    );
  });
  return {skills, mcpServers};
}

function renderSkillsMcpPage() {
  const {skills, mcpServers} = getFilteredCapabilities();
  const selectedSkill = skills.find((item) => item.slug === state.selectedSkillSlug) || skills[0] || null;
  const selectedMcp = state.selectedMcpKey === '__new__' ? null : mcpServers.find((item) => item.key === state.selectedMcpKey) || mcpServers[0] || null;

  return `
    ${renderHeader(
      '技能与 MCP',
      '查看真实技能目录、品牌绑定范围和 MCP 注册关系。',
      `<button class="ghost-button" type="button" data-action="refresh-page">刷新目录</button>`,
    )}
    <section class="filter-row">
      <input
        class="field-input"
        data-filter-key="capabilityQuery"
        placeholder="搜索技能、MCP、publisher、命令"
        value="${fieldValue(state.filters.capabilityQuery)}"
      />
      <div class="segmented">
        <button class="tab-pill${state.capabilityMode === 'skills' ? ' is-active' : ''}" type="button" data-action="capability-mode" data-mode="skills">技能</button>
        <button class="tab-pill${state.capabilityMode === 'mcp' ? ' is-active' : ''}" type="button" data-action="capability-mode" data-mode="mcp">MCP</button>
      </div>
    </section>
    <section class="capability-layout">
      <aside class="capability-list">
        ${
          state.capabilityMode === 'skills'
            ? skills.length
              ? skills
                  .map(
                    (item) => `
                      <button class="capability-card${selectedSkill?.slug === item.slug ? ' is-active' : ''}" type="button" data-action="select-skill" data-skill-slug="${escapeHtml(item.slug)}">
                        <strong>${escapeHtml(item.name)}</strong>
                        <span>${escapeHtml(item.category || '未分类')} · ${escapeHtml(item.brand_count)} 个品牌</span>
                      </button>
                    `,
                  )
                  .join('')
              : `<div class="empty-state">没有匹配的技能。</div>`
            : mcpServers.length
              ? mcpServers
                  .map(
                    (item) => `
                      <button class="capability-card${selectedMcp?.key === item.key ? ' is-active' : ''}" type="button" data-action="select-mcp" data-mcp-key="${escapeHtml(item.key)}">
                        <strong>${escapeHtml(item.name)}</strong>
                        <span>${escapeHtml(item.connected_brand_count)} 个品牌 · ${escapeHtml(item.env_keys.length)} 个环境变量</span>
                      </button>
                    `,
                  )
                  .join('')
              : `<div class="empty-state">没有匹配的 MCP。</div>`
        }
        ${
          state.capabilityMode === 'mcp'
            ? `<button class="capability-card${state.selectedMcpKey === '__new__' ? ' is-active' : ''}" type="button" data-action="select-mcp" data-mcp-key="__new__"><strong>新建 MCP</strong><span>新增一个可保存到注册表的配置</span></button>`
            : ''
        }
      </aside>
      <article class="panel panel--spacious">
        ${
          state.capabilityMode === 'skills'
            ? renderSkillDetail(selectedSkill)
            : renderMcpDetail(selectedMcp)
        }
      </article>
    </section>
  `;
}

function renderSkillImportPanel() {
  return `
    <section class="panel panel--nested">
      <div class="panel-head">
        <h3>导入私有 Skill</h3>
        <span>上传 tar.gz / zip 包，导入后会自动安装到当前 admin 账号</span>
      </div>
      <form id="skill-import-form" class="form-grid form-grid--two">
        <label class="field">
          <span>Slug</span>
          <input class="field-input" name="slug" placeholder="private-skill-slug" />
        </label>
        <label class="field">
          <span>Name</span>
          <input class="field-input" name="name" placeholder="Skill Name" />
        </label>
        <label class="field field--wide">
          <span>Description</span>
          <textarea class="field-textarea" name="description" placeholder="这个 skill 做什么"></textarea>
        </label>
        <label class="field">
          <span>Version</span>
          <input class="field-input" name="version" placeholder="1.0.0" />
        </label>
        <label class="field">
          <span>Publisher</span>
          <input class="field-input" name="publisher" value="admin-web" />
        </label>
        <label class="field">
          <span>Category</span>
          <input class="field-input" name="category" placeholder="research / ops / growth" />
        </label>
        <label class="field">
          <span>Market</span>
          <input class="field-input" name="market" placeholder="CN / US" />
        </label>
        <label class="field">
          <span>Skill Type</span>
          <input class="field-input" name="skill_type" placeholder="workflow / tool" />
        </label>
        <label class="field field--wide">
          <span>Artifact</span>
          <input class="field-input" name="artifact" type="file" accept=".tar.gz,.tgz,.zip,application/gzip,application/zip" />
        </label>
        <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>导入 Skill</button>
      </form>
    </section>
  `;
}

function renderSkillDetail(skill) {
  if (!skill) {
    return `${renderSkillImportPanel()}<div class="empty-state">选择一个技能查看详情。</div>`;
  }
  const libraryItem = getSkillLibraryItem(skill.slug);
  const catalogItem = getAdminSkillCatalogEntry(skill.slug);
  const personalItem = getPersonalSkillCatalogEntry(skill.slug);
  const canDelete = personalItem?.source === 'private' || (catalogItem && catalogItem.distribution !== 'bundled');
  return `
    <div class="panel-head">
      <div>
        <h2>${escapeHtml(skill.name)}</h2>
        <span>${escapeHtml(skill.slug)} · ${escapeHtml(skill.publisher || 'iClaw')}</span>
      </div>
      <div class="metric-chips">
        <span>${escapeHtml(skill.category || '未分类')}</span>
        <span>${escapeHtml(skill.distribution || 'unknown')}</span>
        <span>${escapeHtml(skill.latestRelease || '未发布')}</span>
        <span>${libraryItem ? '已安装' : '未安装'}</span>
        <span>${libraryItem ? (libraryItem.enabled ? '已启用' : '已停用') : '未安装'}</span>
      </div>
    </div>
    <p class="detail-copy">${escapeHtml(skill.description || '暂无描述。')}</p>
    <section class="action-row">
      ${
        libraryItem?.enabled
          ? `<button class="ghost-button" type="button" data-action="skill-disable" data-skill-slug="${escapeHtml(skill.slug)}">Disable</button>`
          : `<button class="solid-button" type="button" data-action="skill-enable" data-skill-slug="${escapeHtml(skill.slug)}">Enable</button>`
      }
      ${canDelete ? `<button class="ghost-button" type="button" data-action="skill-delete" data-skill-slug="${escapeHtml(skill.slug)}">删除 Skill</button>` : ''}
    </section>
    <section class="panel panel--nested">
      <div class="panel-head">
        <h3>品牌覆盖</h3>
        <span>${escapeHtml(skill.brand_count)} 个品牌已启用</span>
      </div>
      <div class="chip-grid">
        ${(skill.connectedBrands || []).length
          ? skill.connectedBrands
              .map(
                (brand) => `
                  <button class="chip chip--interactive" type="button" data-action="select-brand" data-brand-id="${escapeHtml(brand.brand_id)}">
                    ${escapeHtml(brand.display_name)}
                  </button>
                `,
              )
              .join('')
          : `<div class="empty-state">当前没有品牌绑定此技能。</div>`}
      </div>
    </section>
    ${renderCapabilityBrandMatrix('skill', skill)}
    ${renderSkillImportPanel()}
  `;
}

function renderMcpDetail(server) {
  if (!server) {
    server = {
      key: '',
      name: '新建 MCP',
      command: '',
      connected_brand_count: 0,
      enabled_by_default: false,
      args: [],
      http_url: '',
      env_keys: [],
      connected_brands: [],
    };
  }
  const isNew = !server.key;
  const editable = getMcpCatalogEntry(server.key) || {
    key: server.key,
    enabled: server.enabled_by_default,
    type: null,
    command: server.command,
    args: server.args || [],
    http_url: server.http_url,
    env: {},
  };
  return `
    <div class="panel-head">
      <div>
        <h2>${escapeHtml(server.name)}</h2>
        <span>${escapeHtml(server.key)} · ${escapeHtml(server.command || '未声明 command')}</span>
      </div>
      <div class="metric-chips">
        <span>${escapeHtml(server.connected_brand_count)} 个品牌</span>
        <span>${server.enabled_by_default ? '默认启用' : '默认关闭'}</span>
      </div>
    </div>
    <form id="mcp-editor-form" class="panel panel--nested">
      <div class="panel-head">
        <h3>MCP 配置</h3>
        <span>真实写入 mcp/mcp.json，支持保存、测试连接、删除</span>
      </div>
      <div class="form-grid form-grid--two">
        <label class="field">
          <span>Key</span>
          <input class="field-input" name="key" value="${fieldValue(editable.key)}" />
        </label>
        <label class="field">
          <span>默认状态</span>
          <select class="field-select" name="enabled">
            <option value="true"${editable.enabled ? ' selected' : ''}>Enabled</option>
            <option value="false"${editable.enabled ? '' : ' selected'}>Disabled</option>
          </select>
        </label>
        <label class="field">
          <span>Type</span>
          <input class="field-input" name="type" value="${fieldValue(editable.type)}" placeholder="stdio / http" />
        </label>
        <label class="field">
          <span>Command</span>
          <input class="field-input" name="command" value="${fieldValue(editable.command)}" placeholder="uvx / npx / node" />
        </label>
        <label class="field field--wide">
          <span>Args</span>
          <textarea class="field-textarea" name="args_text" placeholder="每行一个参数">${escapeHtml((editable.args || []).join('\n'))}</textarea>
        </label>
        <label class="field field--wide">
          <span>HTTP URL</span>
          <input class="field-input" name="http_url" value="${fieldValue(editable.http_url)}" placeholder="http://127.0.0.1:4010/mcp" />
        </label>
        <label class="field field--wide">
          <span>Env</span>
          <textarea class="field-textarea" name="env_text" placeholder="KEY=value">${escapeHtml(formatEnvPairs(editable.env))}</textarea>
        </label>
      </div>
      <div class="action-row">
        <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存 MCP</button>
        <button class="ghost-button" type="button" data-action="mcp-test" data-mcp-key="${escapeHtml(server.key)}"${state.busy ? ' disabled' : ''}>测试连接</button>
        ${isNew ? '' : `<button class="ghost-button" type="button" data-action="mcp-delete" data-mcp-key="${escapeHtml(server.key)}"${state.busy ? ' disabled' : ''}>删除</button>`}
      </div>
      ${
        state.mcpTestResult
          ? `<div class="banner ${state.mcpTestResult.ok ? 'banner--success' : 'banner--error'}">测试结果: ${escapeHtml(state.mcpTestResult.message || '未返回消息')}</div>`
          : ''
      }
    </form>
    <section class="meta-columns">
      <div class="meta-box">
        <span>Args</span>
        <strong>${escapeHtml((server.args || []).join(' ') || '无')}</strong>
      </div>
      <div class="meta-box">
        <span>HTTP URL</span>
        <strong>${escapeHtml(server.http_url || '未声明')}</strong>
      </div>
      <div class="meta-box meta-box--wide">
        <span>环境变量</span>
        <strong>${escapeHtml((server.env_keys || []).join(', ') || '无')}</strong>
      </div>
    </section>
    <section class="panel panel--nested">
      <div class="panel-head">
        <h3>品牌连接图</h3>
        <span>真实来自各品牌 capabilities.mcp_servers</span>
      </div>
      <div class="chip-grid">
        ${(server.connected_brands || []).length
          ? server.connected_brands
              .map(
                (brand) => `
                  <button class="chip chip--interactive" type="button" data-action="select-brand" data-brand-id="${escapeHtml(brand.brand_id)}">
                    ${escapeHtml(brand.display_name)}
                  </button>
                `,
              )
              .join('')
          : `<div class="empty-state">当前没有品牌启用该 MCP。</div>`}
      </div>
    </section>
    ${renderCapabilityBrandMatrix('mcp', server)}
  `;
}

function renderCapabilityBrandMatrix(type, item) {
  const brands = state.capabilities?.brands || [];
  const connectedIds = new Set(
    (type === 'skill' ? item.connectedBrands : item.connected_brands || []).map((brand) => brand.brand_id),
  );
  return `
    <section class="panel panel--nested">
      <div class="panel-head">
        <h3>${type === 'skill' ? 'Skill / Brand Matrix' : 'MCP / Brand Matrix'}</h3>
        <span>按品牌查看能力开放范围</span>
      </div>
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>品牌</th>
              <th>状态</th>
              <th>已连接</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${brands
              .map(
                (brand) => `
                  <tr>
                    <td>${escapeHtml(brand.displayName)}</td>
                    <td>${statusBadge(brand.status)}</td>
                    <td>${connectedIds.has(brand.brandId) ? '是' : '否'}</td>
                    <td>
                      <button class="table-link" type="button" data-action="select-brand" data-brand-id="${escapeHtml(brand.brandId)}">
                        打开品牌
                      </button>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function getFilteredAssets() {
  const query = state.filters.assetQuery.trim().toLowerCase();
  return state.assets.filter((item) => {
    if (state.filters.assetBrand !== 'all' && item.brandId !== state.filters.assetBrand) {
      return false;
    }
    if (state.filters.assetKind !== 'all' && item.kind !== state.filters.assetKind) {
      return false;
    }
    if (!query) return true;
    return [item.assetKey, item.kind, item.brandDisplayName, item.objectKey, item.publicUrl].some((value) =>
      String(value || '').toLowerCase().includes(query),
    );
  });
}

function renderAssetsPage() {
  const items = getFilteredAssets();
  const kinds = Array.from(new Set(state.assets.map((item) => item.kind).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'zh-CN'),
  );

  return `
    ${renderHeader(
      '资源管理',
      '统一管理品牌素材资源与资源注册表，支持跨品牌筛选和实时登记。',
      `<button class="ghost-button" type="button" data-action="refresh-page">刷新资源</button>`,
    )}
    <section class="filter-row filter-row--dense">
      <input class="field-input" data-filter-key="assetQuery" placeholder="搜索资源 key / brand / 路径" value="${fieldValue(state.filters.assetQuery)}" />
      <select class="field-select" data-filter-key="assetBrand">
        <option value="all">全部品牌</option>
        ${state.brands
          .map(
            (brand) => `
              <option value="${escapeHtml(brand.brandId)}"${state.filters.assetBrand === brand.brandId ? ' selected' : ''}>${escapeHtml(brand.displayName)}</option>
            `,
          )
          .join('')}
      </select>
      <select class="field-select" data-filter-key="assetKind">
        <option value="all">全部类型</option>
        ${kinds
          .map(
            (kind) => `
              <option value="${escapeHtml(kind)}"${state.filters.assetKind === kind ? ' selected' : ''}>${escapeHtml(kind)}</option>
            `,
          )
          .join('')}
      </select>
    </section>
    <section class="panel">
      <div class="panel-head">
        <h2>资源台账</h2>
        <span>${escapeHtml(items.length)} 条记录</span>
      </div>
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>预览</th>
              <th>Asset Key</th>
              <th>品牌</th>
              <th>类型</th>
              <th>存储</th>
              <th>对象路径</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            ${items.length
              ? items
                  .map(
                    (item) => `
                      <tr>
                        <td>
                          ${
                            isImageLike(item.metadata?.content_type, item.publicUrl, item.objectKey)
                              ? `<img class="asset-thumb asset-thumb--table" src="${escapeHtml(resolveAssetUrl(item))}" alt="${escapeHtml(item.assetKey)}" />`
                              : `<span class="asset-thumb asset-thumb--placeholder">${escapeHtml(item.kind.slice(0, 2).toUpperCase())}</span>`
                          }
                        </td>
                        <td>${escapeHtml(item.assetKey)}</td>
                        <td>
                          <button class="table-link" type="button" data-action="select-brand" data-brand-id="${escapeHtml(item.brandId)}">
                            ${escapeHtml(item.brandDisplayName || item.brandId)}
                          </button>
                        </td>
                        <td>${escapeHtml(item.kind)}</td>
                        <td>${escapeHtml(item.storageProvider)}</td>
                        <td>
                          ${
                            item.publicUrl || item.objectKey
                              ? `<a class="text-link" href="${escapeHtml(resolveAssetUrl(item))}" target="_blank" rel="noreferrer"><code>${escapeHtml(resolveAssetUrl(item))}</code></a>`
                              : `<code>${escapeHtml(item.objectKey)}</code>`
                          }
                        </td>
                        <td>${escapeHtml(formatDateTime(item.updatedAt))}</td>
                      </tr>
                    `,
                  )
                  .join('')
              : `<tr><td colspan="7"><div class="empty-state">没有匹配的资源。</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function getFilteredReleases() {
  return state.releases.filter((item) => {
    if (state.filters.releaseBrand !== 'all' && item.brand_id !== state.filters.releaseBrand) {
      return false;
    }
    return true;
  });
}

function renderReleasesPage() {
  const items = getFilteredReleases();
  const selectedRelease = items.find((item) => item.id === state.selectedReleaseId) || items[0] || null;
  const selectedBrand = state.brands.find((item) => item.brandId === selectedRelease?.brand_id) || null;
  const diffAreas = selectedRelease ? summarizeChangedAreas(selectedBrand?.draftConfig, selectedRelease.config) : [];
  return `
    ${renderHeader(
      '版本发布',
      '查看真实发布快照、影响范围和每个版本带来的 Surface / 技能 / MCP 变更。',
      `<button class="ghost-button" type="button" data-action="refresh-page">刷新版本</button>`,
    )}
    <section class="filter-row">
      <select class="field-select" data-filter-key="releaseBrand">
        <option value="all">全部品牌</option>
        ${state.brands
          .map(
            (brand) => `
              <option value="${escapeHtml(brand.brandId)}"${state.filters.releaseBrand === brand.brandId ? ' selected' : ''}>${escapeHtml(brand.displayName)}</option>
            `,
          )
          .join('')}
      </select>
    </section>
    <section class="capability-layout">
      <aside class="capability-list">
        ${items.length
          ? items
              .map(
                (item) => `
                  <button class="capability-card${selectedRelease?.id === item.id ? ' is-active' : ''}" type="button" data-action="select-release" data-release-id="${escapeHtml(item.id)}">
                    <strong>${escapeHtml(item.display_name)} · v${escapeHtml(item.version)}</strong>
                    <span>${escapeHtml(formatDateTime(item.published_at))}</span>
                  </button>
                `,
              )
              .join('')
          : `<div class="empty-state">当前没有发布记录。</div>`}
      </aside>
      <article class="panel panel--spacious">
        ${
          selectedRelease
            ? `
              <div class="panel-head">
                <div>
                  <h2>${escapeHtml(selectedRelease.display_name)} · v${escapeHtml(selectedRelease.version)}</h2>
                  <span>${escapeHtml(formatDateTime(selectedRelease.published_at))} · ${escapeHtml(selectedRelease.created_by_name || selectedRelease.created_by_username || 'system')}</span>
                </div>
                <button class="ghost-button" type="button" data-action="select-brand" data-brand-id="${escapeHtml(selectedRelease.brand_id)}">打开品牌</button>
              </div>
              <div class="metric-chips">
                ${(selectedRelease.changed_areas || []).map((area) => `<span>${escapeHtml(area)}</span>`).join('')}
              </div>
              <div class="release-metrics">
                <div><span>Surface</span><strong>${escapeHtml((selectedRelease.surfaces || []).join(' / ') || '无')}</strong></div>
                <div><span>技能数</span><strong>${escapeHtml(selectedRelease.skill_count)}</strong></div>
                <div><span>MCP 数</span><strong>${escapeHtml(selectedRelease.mcp_count)}</strong></div>
                <div><span>当前草稿 Diff</span><strong>${escapeHtml(diffAreas.join(' / ') || '无差异')}</strong></div>
              </div>
              <section class="panel panel--nested">
                <div class="panel-head">
                  <h3>Diff 视图</h3>
                  <span>对比选中发布版本与当前品牌草稿</span>
                </div>
                <div class="metric-chips">
                  ${diffAreas.length ? diffAreas.map((area) => `<span>${escapeHtml(area)}</span>`).join('') : '<span>无差异</span>'}
                </div>
                <div class="diff-grid">
                  <label class="field">
                    <span>发布版本 JSON</span>
                    <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(selectedRelease.config))}</textarea>
                  </label>
                  <label class="field">
                    <span>当前草稿 JSON</span>
                    <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(selectedBrand?.draftConfig || {}))}</textarea>
                  </label>
                </div>
              </section>
            `
            : `<div class="empty-state">选择一个发布版本查看详情。</div>`
        }
      </article>
    </section>
  `;
}

function getFilteredAudit() {
  const query = state.filters.auditQuery.trim().toLowerCase();
  return state.audit.filter((item) => {
    if (state.filters.auditBrand !== 'all' && item.brandId !== state.filters.auditBrand) {
      return false;
    }
    if (state.filters.auditAction !== 'all' && item.action !== state.filters.auditAction) {
      return false;
    }
    if (!query) return true;
    return [item.brandDisplayName, item.action, item.actorName, item.actorUsername, item.environment]
      .some((value) => String(value || '').toLowerCase().includes(query));
  });
}

function renderAuditPage() {
  const items = getFilteredAudit();
  const selectedAudit = items.find((item) => item.id === state.selectedAuditId) || items[0] || null;
  const actions = Array.from(new Set(state.audit.map((item) => item.action).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'zh-CN'),
  );

  return `
    ${renderHeader(
      '审计日志',
      '按品牌、动作和时间回溯所有真实运营操作。',
      `<button class="ghost-button" type="button" data-action="refresh-page">刷新审计</button>`,
    )}
    <section class="filter-row filter-row--dense">
      <input class="field-input" data-filter-key="auditQuery" placeholder="搜索品牌 / 动作 / 操作人 / 环境" value="${fieldValue(state.filters.auditQuery)}" />
      <select class="field-select" data-filter-key="auditBrand">
        <option value="all">全部品牌</option>
        ${state.brands
          .map(
            (brand) => `
              <option value="${escapeHtml(brand.brandId)}"${state.filters.auditBrand === brand.brandId ? ' selected' : ''}>${escapeHtml(brand.displayName)}</option>
            `,
          )
          .join('')}
      </select>
      <select class="field-select" data-filter-key="auditAction">
        <option value="all">全部动作</option>
        ${actions
          .map(
            (action) => `
              <option value="${escapeHtml(action)}"${state.filters.auditAction === action ? ' selected' : ''}>${escapeHtml(actionLabel(action))}</option>
            `,
          )
          .join('')}
      </select>
    </section>
    <section class="capability-layout">
      <aside class="capability-list">
        ${items.length
          ? items
              .map(
                (item) => `
                  <button class="capability-card${selectedAudit?.id === item.id ? ' is-active' : ''}" type="button" data-action="select-audit" data-audit-id="${escapeHtml(item.id)}">
                    <strong>${escapeHtml(item.brandDisplayName || item.brandId)}</strong>
                    <span>${escapeHtml(actionLabel(item.action))} · ${escapeHtml(formatDateTime(item.createdAt))}</span>
                  </button>
                `,
              )
              .join('')
          : `<div class="empty-state">没有匹配的审计记录。</div>`}
      </aside>
      <article class="panel panel--spacious">
        ${
          selectedAudit
            ? `
              <div class="panel-head">
                <div>
                  <h2>${escapeHtml(actionLabel(selectedAudit.action))}</h2>
                  <span>${escapeHtml(selectedAudit.brandDisplayName || selectedAudit.brandId)} · ${escapeHtml(formatDateTime(selectedAudit.createdAt))}</span>
                </div>
                <button class="ghost-button" type="button" data-action="select-brand" data-brand-id="${escapeHtml(selectedAudit.brandId)}">打开品牌</button>
              </div>
              <div class="meta-columns">
                <div class="meta-box">
                  <span>操作人</span>
                  <strong>${escapeHtml(selectedAudit.actorName || selectedAudit.actorUsername || 'system')}</strong>
                </div>
                <div class="meta-box">
                  <span>环境</span>
                  <strong>${escapeHtml(selectedAudit.environment || 'control-plane')}</strong>
                </div>
                <div class="meta-box meta-box--wide">
                  <span>Brand</span>
                  <strong>${escapeHtml(selectedAudit.brandId)}</strong>
                </div>
              </div>
              <section class="panel panel--nested">
                <div class="panel-head">
                  <h3>审计详情</h3>
                  <span>真实 payload</span>
                </div>
                <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(selectedAudit.payload || {}))}</textarea>
              </section>
            `
            : `<div class="empty-state">选择一条审计记录查看详情。</div>`
        }
      </article>
    </section>
  `;
}

function renderLoadingPage() {
  return `
    <section class="loading-panel">
      <div class="loading-spinner"></div>
      <p>控制面数据加载中…</p>
    </section>
  `;
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-stage">
        <div class="login-copy-group">
          <p class="eyebrow">OEM operations platform</p>
          <h1>把品牌、版本、技能与发布放进同一个运营平面</h1>
          <p class="login-copy">
            当前后台直连真实 control-plane 接口。默认引导账号：<strong>admin / admin</strong>。
          </p>
        </div>
        <form class="login-card" id="login-form">
          <label class="field">
            <span>Username</span>
            <input class="field-input" name="identifier" autocomplete="username" value="admin" />
          </label>
          <label class="field">
            <span>Password</span>
            <input class="field-input" name="password" type="password" autocomplete="current-password" value="admin" />
          </label>
          <div class="banner banner--error"${state.error ? '' : ' hidden'}>${escapeHtml(state.error)}</div>
          <button class="solid-button solid-button--full" type="submit"${state.busy ? ' disabled' : ''}>
            ${state.busy ? '进入中…' : '进入控制台'}
          </button>
        </form>
      </section>
    </main>
  `;
}

function renderDashboard() {
  const pageContent = state.loading
    ? renderLoadingPage()
    : state.route === 'overview'
      ? renderOverviewPage()
      : state.route === 'brands'
        ? renderBrandsPage()
        : state.route === 'brand-detail'
          ? renderBrandDetailPage()
          : state.route === 'skills-mcp'
            ? renderSkillsMcpPage()
            : state.route === 'assets'
              ? renderAssetsPage()
              : state.route === 'releases'
                ? renderReleasesPage()
                : renderAuditPage();

  app.innerHTML = `
    <main class="shell">
      ${renderSidebar()}
      <section class="content">
        ${renderBanner()}
        ${pageContent}
      </section>
    </main>
  `;
}

function render() {
  if (state.view === 'dashboard') {
    renderDashboard();
    return;
  }
  renderLogin();
}

app.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  event.preventDefault();

  if (form.id === 'login-form') {
    const data = new FormData(form);
    await authenticate(String(data.get('identifier') || ''), String(data.get('password') || ''));
    return;
  }

  if (form.id === 'create-brand-form') {
    await createBrand(new FormData(form));
    return;
  }

  if (form.id === 'brand-editor-form') {
    await saveBrandEditor(form);
    return;
  }

  if (form.id === 'asset-form') {
    await saveAsset(new FormData(form));
    return;
  }

  if (form.id === 'skill-import-form') {
    await importSkill(new FormData(form));
    return;
  }

  if (form.id === 'mcp-editor-form') {
    await saveMcpCatalogEntry(new FormData(form));
  }
});

app.addEventListener('click', async (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
  if (!target) {
    return;
  }

  const action = target.getAttribute('data-action');

  if (action === 'navigate') {
    captureBrandEditorBuffer();
    state.route = target.getAttribute('data-page') || 'overview';
    render();
    return;
  }

  if (action === 'select-brand') {
    captureBrandEditorBuffer();
    state.route = 'brand-detail';
    state.brandDetailTab = 'surfaces';
    await loadBrandDetail(target.getAttribute('data-brand-id') || '');
    return;
  }

  if (action === 'brand-tab') {
    captureBrandEditorBuffer();
    state.brandDetailTab = target.getAttribute('data-tab') || 'surfaces';
    render();
    return;
  }

  if (action === 'capability-mode') {
    state.capabilityMode = target.getAttribute('data-mode') || 'skills';
    render();
    return;
  }

  if (action === 'select-skill') {
    state.capabilityMode = 'skills';
    state.selectedSkillSlug = target.getAttribute('data-skill-slug') || '';
    render();
    return;
  }

  if (action === 'select-mcp') {
    state.capabilityMode = 'mcp';
    state.selectedMcpKey = target.getAttribute('data-mcp-key') || '';
    state.mcpTestResult = null;
    render();
    return;
  }

  if (action === 'toggle-brand-skill') {
    toggleBrandCapability('skill', target.getAttribute('data-skill-slug') || '');
    return;
  }

  if (action === 'toggle-brand-mcp') {
    toggleBrandCapability('mcp', target.getAttribute('data-mcp-key') || '');
    return;
  }

  if (action === 'skill-enable') {
    await setSkillEnabled(target.getAttribute('data-skill-slug') || '', true);
    return;
  }

  if (action === 'skill-disable') {
    await setSkillEnabled(target.getAttribute('data-skill-slug') || '', false);
    return;
  }

  if (action === 'skill-delete') {
    const slug = target.getAttribute('data-skill-slug') || '';
    if (window.confirm(`确认删除技能 ${slug}？`)) {
      await deleteSkill(slug);
    }
    return;
  }

  if (action === 'mcp-test') {
    const form = document.querySelector('#mcp-editor-form');
    if (form instanceof HTMLFormElement) {
      const data = new FormData(form);
      await testMcpCatalogEntry({
        key: String(data.get('key') || '').trim() || target.getAttribute('data-mcp-key') || '',
        command: String(data.get('command') || '').trim() || null,
        http_url: String(data.get('http_url') || '').trim() || null,
      });
    } else {
      await testMcpCatalogEntry({
        key: target.getAttribute('data-mcp-key') || '',
      });
    }
    return;
  }

  if (action === 'mcp-delete') {
    const key = target.getAttribute('data-mcp-key') || '';
    if (window.confirm(`确认删除 MCP ${key}？`)) {
      await deleteMcpCatalogEntry(key);
    }
    return;
  }

  if (action === 'delete-asset') {
    const brandId = target.getAttribute('data-brand-id') || '';
    const assetKey = target.getAttribute('data-asset-key') || '';
    if (window.confirm(`确认删除资源 ${assetKey}？`)) {
      await deleteAsset(brandId, assetKey);
    }
    return;
  }

  if (action === 'fill-asset-preset') {
    const form = document.querySelector('#asset-form');
    if (form instanceof HTMLFormElement) {
      const assetKeyInput = form.querySelector('input[name="asset_key"]');
      const kindInput = form.querySelector('input[name="kind"]');
      if (assetKeyInput instanceof HTMLInputElement) {
        assetKeyInput.value = target.getAttribute('data-asset-key') || '';
      }
      if (kindInput instanceof HTMLInputElement) {
        kindInput.value = target.getAttribute('data-asset-kind') || '';
      }
    }
    return;
  }

  if (action === 'publish-brand') {
    const brandId = state.selectedBrandId || '';
    if (window.confirm(`确认发布 ${brandId} 当前草稿？`)) {
      await publishCurrentBrand();
    }
    return;
  }

  if (action === 'rollback-brand') {
    const version = Number(target.getAttribute('data-version') || 0);
    await rollbackBrand(version);
    return;
  }

  if (action === 'refresh-page') {
    await loadAppData();
    return;
  }

  if (action === 'select-release') {
    state.selectedReleaseId = target.getAttribute('data-release-id') || '';
    render();
    return;
  }

  if (action === 'select-audit') {
    state.selectedAuditId = target.getAttribute('data-audit-id') || '';
    render();
    return;
  }

  if (action === 'logout') {
    logout();
  }
});

function handleFilterInput(target) {
  const key = target.getAttribute('data-filter-key');
  if (!key) return;
  state.filters[key] = target.value;
  render();
}

app.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
    return;
  }
  handleFilterInput(target);
});

app.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
    return;
  }
  handleFilterInput(target);
});

render();
ensureSession();
