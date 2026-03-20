import './styles.css';

const API_BASE_URL = ((import.meta.env.VITE_AUTH_BASE_URL || 'http://127.0.0.1:2130') + '').trim().replace(/\/+$/, '');
const TOKEN_STORAGE_KEY = 'iclaw.admin-web.tokens';
const NAV_ITEMS = [
  {id: 'overview', label: '总览', icon: 'layoutGrid'},
  {id: 'brands', label: '品牌管理', icon: 'layers'},
  {id: 'skills-mcp', label: '技能与 MCP', icon: 'zap'},
  {id: 'assets', label: '资源管理', icon: 'image'},
  {id: 'releases', label: '版本发布', icon: 'rocket'},
  {id: 'audit-log', label: '审计日志', icon: 'fileText'},
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
  showCreateBrandForm: false,
  showSkillImportPanel: false,
  showAssetUploadPanel: false,
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

function icon(name, className = '') {
  const cls = className ? ` class="${escapeHtml(className)}"` : '';
  const common = `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
  const icons = {
    plus: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M12 5v14"/><path ${common} d="M5 12h14"/></svg>`,
    search: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="11" cy="11" r="7"/><path ${common} d="m20 20-3.5-3.5"/></svg>`,
    clock: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="12" r="9"/><path ${common} d="M12 7v5l3 2"/></svg>`,
    activity: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M3 12h4l2-5 4 10 2-5h6"/></svg>`,
    rocket: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M5 19c2-2 4-3 7-3 0-3 1-5 3-7 2-2 4-3 7-4-1 3-2 5-4 7-2 2-4 3-7 3-1 3-2 5-3 7-1-1-2-2-3-3Z"/><path ${common} d="M9 15l-4 4"/><path ${common} d="M9 19H5v-4"/></svg>`,
    trendingUp: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M3 17 10 10l4 4 7-7"/><path ${common} d="M14 7h7v7"/></svg>`,
    arrowLeft: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M19 12H5"/><path ${common} d="m12 19-7-7 7-7"/></svg>`,
    save: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M5 5h11l3 3v11H5z"/><path ${common} d="M8 5v5h8"/><path ${common} d="M9 19v-5h6v5"/></svg>`,
    rotateCcw: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M3 12a9 9 0 1 0 3-6.7"/><path ${common} d="M3 4v5h5"/></svg>`,
    monitor: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="4" width="18" height="12" rx="2"/><path ${common} d="M8 20h8"/><path ${common} d="M12 16v4"/></svg>`,
    globe: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="12" r="9"/><path ${common} d="M3 12h18"/><path ${common} d="M12 3a15 15 0 0 1 0 18"/><path ${common} d="M12 3a15 15 0 0 0 0 18"/></svg>`,
    layout: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="4" width="18" height="16" rx="2"/><path ${common} d="M3 10h18"/><path ${common} d="M9 10v10"/></svg>`,
    sidebar: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="4" width="18" height="16" rx="2"/><path ${common} d="M9 4v16"/></svg>`,
    messageSquare: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M7 18H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-4 3z"/></svg>`,
    store: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M4 9l1-4h14l1 4"/><path ${common} d="M5 9h14v10H5z"/><path ${common} d="M9 13h6"/></svg>`,
    palette: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4 5 5 0 0 0 0-10Z"/><circle ${common} cx="7.5" cy="10.5" r=".5"/><circle ${common} cx="9.5" cy="7.5" r=".5"/><circle ${common} cx="14.5" cy="7.5" r=".5"/></svg>`,
    image: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="5" width="18" height="14" rx="2"/><circle ${common} cx="8.5" cy="10" r="1.5"/><path ${common} d="m21 16-5-5-6 6-3-3-4 4"/></svg>`,
    zap: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>`,
    network: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="5" r="2"/><circle ${common} cx="5" cy="18" r="2"/><circle ${common} cx="19" cy="18" r="2"/><path ${common} d="M12 7v4"/><path ${common} d="M12 11 6.5 16"/><path ${common} d="M12 11 17.5 16"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="5" width="18" height="16" rx="2"/><path ${common} d="M16 3v4"/><path ${common} d="M8 3v4"/><path ${common} d="M3 10h18"/></svg>`,
    user: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="8" r="4"/><path ${common} d="M5 20a7 7 0 0 1 14 0"/></svg>`,
    package: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path ${common} d="m12 12 8-4.5"/><path ${common} d="m12 12-8-4.5"/><path ${common} d="M12 21v-9"/></svg>`,
    checkCircle: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="12" r="9"/><path ${common} d="m8.5 12 2.5 2.5 4.5-5"/></svg>`,
    filter: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M4 6h16"/><path ${common} d="M7 12h10"/><path ${common} d="M10 18h4"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M12 20h9"/><path ${common} d="m16.5 3.5 4 4L8 20l-5 1 1-5z"/></svg>`,
    upload: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M12 16V4"/><path ${common} d="m7 9 5-5 5 5"/><path ${common} d="M4 20h16"/></svg>`,
    trash: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M3 6h18"/><path ${common} d="M8 6V4h8v2"/><path ${common} d="M6 6l1 14h10l1-14"/><path ${common} d="M10 10v6"/><path ${common} d="M14 10v6"/></svg>`,
    settings: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="12" r="3"/><path ${common} d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2H9a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1V9c0 .4.2.7.6.9H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.7z"/></svg>`,
    square: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="5" y="5" width="14" height="14" rx="2"/></svg>`,
    fileImage: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path ${common} d="M14 3v5h5"/><circle ${common} cx="10" cy="13" r="1.5"/><path ${common} d="m8 19 3-3 2 2 3-3 2 4"/></svg>`,
    layoutGrid: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="3" width="7" height="7" rx="1.5"/><rect ${common} x="14" y="3" width="7" height="7" rx="1.5"/><rect ${common} x="3" y="14" width="7" height="7" rx="1.5"/><rect ${common} x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
    layers: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="m12 4 8 4-8 4-8-4z"/><path ${common} d="m4 12 8 4 8-4"/><path ${common} d="m4 16 8 4 8-4"/></svg>`,
    fileText: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path ${common} d="M14 3v5h5"/><path ${common} d="M9 13h6"/><path ${common} d="M9 17h6"/><path ${common} d="M9 9h2"/></svg>`,
  };
  return icons[name] || '';
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

function navIsActive(itemId) {
  if (itemId === 'brands') {
    return state.route === 'brands' || state.route === 'brand-detail';
  }
  return state.route === itemId;
}

function brandLastPublished(brandDetail) {
  const publishedAt = brandDetail?.versions?.[0]?.publishedAt || brandDetail?.brand?.updatedAt;
  return publishedAt ? formatRelative(publishedAt) : '未发布';
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
  const existing = clone(state.brandDraftBuffer || ensureBrandDraftBuffer() || {});
  const surfaces = Array.from(form.querySelectorAll('.surface-editor')).map((node) => ({
    key: node.getAttribute('data-surface-key') || '',
    label: node.getAttribute('data-surface-label') || '',
    enabled: Boolean(node.querySelector('input[type="checkbox"]')?.checked),
    json: String(node.querySelector('textarea')?.value || '{}'),
  }));

  state.brandDraftBuffer = {
    ...existing,
    brandId: String(data.get('brand_id') || existing.brandId || ''),
    displayName: String(data.get('display_name') || existing.displayName || ''),
    productName: String(data.get('product_name') || existing.productName || ''),
    tenantKey: String(data.get('tenant_key') || existing.tenantKey || ''),
    status: String(data.get('status') || existing.status || 'draft'),
    advancedJson: form.querySelector('[name="advanced_json"]')
      ? String(data.get('advanced_json') || existing.advancedJson || '{}')
      : String(existing.advancedJson || '{}'),
    theme: {
      lightPrimary: form.querySelector('[name="theme_light_primary"]')
        ? String(data.get('theme_light_primary') || existing.theme?.lightPrimary || '')
        : String(existing.theme?.lightPrimary || ''),
      lightPrimaryHover: form.querySelector('[name="theme_light_primary_hover"]')
        ? String(data.get('theme_light_primary_hover') || existing.theme?.lightPrimaryHover || '')
        : String(existing.theme?.lightPrimaryHover || ''),
      lightOnPrimary: form.querySelector('[name="theme_light_on_primary"]')
        ? String(data.get('theme_light_on_primary') || existing.theme?.lightOnPrimary || '')
        : String(existing.theme?.lightOnPrimary || ''),
      darkPrimary: form.querySelector('[name="theme_dark_primary"]')
        ? String(data.get('theme_dark_primary') || existing.theme?.darkPrimary || '')
        : String(existing.theme?.darkPrimary || ''),
      darkPrimaryHover: form.querySelector('[name="theme_dark_primary_hover"]')
        ? String(data.get('theme_dark_primary_hover') || existing.theme?.darkPrimaryHover || '')
        : String(existing.theme?.darkPrimaryHover || ''),
      darkOnPrimary: form.querySelector('[name="theme_dark_on_primary"]')
        ? String(data.get('theme_dark_on_primary') || existing.theme?.darkOnPrimary || '')
        : String(existing.theme?.darkOnPrimary || ''),
    },
    selectedSkills: form.querySelector('.skill-checkbox')
      ? Array.from(form.querySelectorAll('.skill-checkbox:checked')).map((node) => node.value)
      : asStringArray(existing.selectedSkills),
    selectedMcp: form.querySelector('.mcp-checkbox')
      ? Array.from(form.querySelectorAll('.mcp-checkbox:checked')).map((node) => node.value)
      : asStringArray(existing.selectedMcp),
    agentsText: form.querySelector('[name="agents_text"]')
      ? String(data.get('agents_text') || existing.agentsText || '')
      : String(existing.agentsText || ''),
    menusText: form.querySelector('[name="menus_text"]')
      ? String(data.get('menus_text') || existing.menusText || '')
      : String(existing.menusText || ''),
    surfaces: surfaces.length ? surfaces : asArray(existing.surfaces),
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
    state.showCreateBrandForm = false;
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
    state.showAssetUploadPanel = false;
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
    state.showSkillImportPanel = false;
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
  state.showCreateBrandForm = false;
  state.showSkillImportPanel = false;
  state.showAssetUploadPanel = false;
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
        <h1 class="sidebar-brand__title">OEM 运营中心</h1>
        <p class="sidebar-brand__copy">企业运营平台</p>
      </div>
      <nav class="nav-list">
        ${NAV_ITEMS.map(
          (item) => `
            <button class="nav-item${navIsActive(item.id) ? ' is-active' : ''}" type="button" data-action="navigate" data-page="${item.id}">
              ${icon(item.icon, 'nav-item__icon')}
              <span class="nav-item__label">${escapeHtml(item.label)}</span>
            </button>
          `,
        ).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-footer__meta">
          <div>${escapeHtml(state.user?.name || state.user?.username || 'admin')}</div>
          <div>v1.2.4 • 2026年3月</div>
        </div>
        <button class="sidebar-footer__logout" type="button" data-action="logout">退出登录</button>
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
      <div class="page-header__copy">
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
  const statCards = [
    ['品牌总数', stats.brands_total, '本月新增品牌', 'trendingUp'],
    ['已发布', stats.published_count, '运行中', 'checkCircle'],
    ['草稿', stats.draft_count, '进行中', 'clock'],
    ['MCP 服务器', stats.mcp_servers_count, '已连接', 'network'],
    ['技能', stats.skills_count, '可分配能力', 'zap'],
    ['待发布更改', stats.pending_changes_count, '等待发布', 'rocket'],
  ];

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>总览</h1>
            <p class="fig-page__description">从统一控制平面管理所有 OEM 品牌</p>
          </div>
          <button class="solid-button fig-button" type="button" data-action="navigate" data-page="brands">
            ${icon('plus', 'button-icon')}
            创建新品牌
          </button>
        </div>
      </div>
      <div class="fig-page__body">
        <section class="fig-stats-grid">
          ${statCards
            .map(
              ([label, value, note, iconName]) => `
                <article class="fig-stat-card">
                  <div class="fig-stat-card__label">${escapeHtml(label)}</div>
                  <div class="fig-stat-card__value">${escapeHtml(value ?? 0)}</div>
                  <div class="fig-stat-card__note">
                    ${icon(iconName, 'fig-inline-icon')}
                    ${escapeHtml(note)}
                  </div>
                </article>
              `,
            )
            .join('')}
        </section>
        <section class="fig-two-column">
          <article class="fig-card">
            <div class="fig-card__head">
              <h3>${icon('rocket', 'fig-inline-icon')}最近发布</h3>
            </div>
            <div class="fig-list">
        ${
          releases.length
            ? releases
                .map(
                  (item) => `
                    <div class="fig-list-item">
                      <div>
                        <div class="fig-list-item__title">${escapeHtml(item.display_name)}</div>
                        <div class="fig-list-item__meta">
                          <span>${escapeHtml(`v${item.version}`)}</span>
                          <span>•</span>
                          <span>${icon('clock', 'fig-inline-icon')} ${escapeHtml(formatRelative(item.published_at))}</span>
                        </div>
                      </div>
                      ${statusBadge('published')}
                    </div>
                  `,
                )
                .join('')
            : `<div class="empty-state">当前没有发布记录。</div>`
        }
            </div>
            <div class="fig-card__footer">
              <button class="text-button" type="button" data-action="navigate" data-page="releases">查看所有发布</button>
            </div>
          </article>
          <article class="fig-card">
            <div class="fig-card__head">
              <h3>${icon('activity', 'fig-inline-icon')}最近编辑</h3>
            </div>
            <div class="fig-list">
              ${edits.length
                ? edits
                    .map(
                      (item) => `
                        <div class="fig-list-item">
                          <div>
                            <div class="fig-list-item__title">${escapeHtml(item.display_name)}</div>
                            <div class="fig-list-item__body">${escapeHtml(actionLabel(item.action))}</div>
                            <div class="fig-list-item__meta">
                              <span>${escapeHtml(item.actor_name || item.actor_username || 'system')}</span>
                              <span>•</span>
                              <span>${escapeHtml(formatRelative(item.created_at))}</span>
                            </div>
                          </div>
                        </div>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">当前没有编辑记录。</div>`}
            </div>
            <div class="fig-card__footer">
              <button class="text-button" type="button" data-action="navigate" data-page="audit-log">查看审计日志</button>
            </div>
          </article>
        </section>
      </div>
    </div>
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
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner fig-page__header-inner--stack">
          <div class="fig-page__header-row">
            <div>
              <h1>品牌管理</h1>
              <p class="fig-page__description">管理 OEM 品牌配置、Surface 和部署</p>
            </div>
            <button class="solid-button fig-button" type="button" data-action="toggle-create-brand">
              ${icon('plus', 'button-icon')}
              创建品牌
            </button>
          </div>
          <div class="fig-toolbar">
            <label class="fig-search">
              ${icon('search', 'fig-search__icon')}
              <input
                class="field-input fig-search__input"
                data-filter-key="brandQuery"
                placeholder="搜索品牌..."
                value="${fieldValue(state.filters.brandQuery)}"
              />
            </label>
            <select class="field-select fig-filter" data-filter-key="brandStatus">
              ${['all', 'published', 'draft', 'archived']
                .map(
                  (item) => `
                    <option value="${item}"${state.filters.brandStatus === item ? ' selected' : ''}>
                      ${item === 'all' ? '所有状态' : statusLabel(item)}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="fig-page__body">
        ${
          state.showCreateBrandForm
            ? `
              <section class="fig-card fig-create-panel">
                <div class="fig-card__head">
                  <h3>创建新品牌</h3>
                  <button class="text-button" type="button" data-action="toggle-create-brand">收起</button>
                </div>
                <form class="form-grid form-grid--two" id="create-brand-form">
                  <label class="field">
                    <span>Brand ID</span>
                    <input class="field-input" name="brand_id" placeholder="brand-id" />
                  </label>
                  <label class="field">
                    <span>显示名称</span>
                    <input class="field-input" name="display_name" placeholder="品牌显示名称" />
                  </label>
                  <label class="field">
                    <span>产品名称</span>
                    <input class="field-input" name="product_name" placeholder="品牌产品名称" />
                  </label>
                  <label class="field">
                    <span>Tenant Key</span>
                    <input class="field-input" name="tenant_key" placeholder="tenant-key" />
                  </label>
                  <div class="fig-form-actions">
                    <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>创建品牌</button>
                  </div>
                </form>
              </section>
            `
            : ''
        }
        <section class="fig-brand-grid">
          ${brands.length
            ? brands.map(renderBrandCard).join('')
            : `<div class="empty-state empty-state--panel">没有匹配的品牌。</div>`}
        </section>
      </div>
    </div>
  `;
}

function renderBrandCard(brand) {
  const metrics = metricsFromBrand(brand);
  return `
    <button class="fig-brand-card" type="button" data-action="select-brand" data-brand-id="${escapeHtml(brand.brandId)}">
      <div class="fig-brand-card__head">
        <div>
          <h3>${escapeHtml(brand.displayName)}</h3>
          <p>${escapeHtml(brand.productName)}</p>
        </div>
        ${statusBadge(brand.status)}
      </div>
      <div class="fig-brand-card__meta">
        <div><span>租户密钥:</span><code>${escapeHtml(brand.tenantKey)}</code></div>
        <div><span>版本:</span><code>v${escapeHtml(brand.publishedVersion || 0)}</code></div>
      </div>
      <div class="fig-brand-card__footer">
        <span>已配置 ${escapeHtml(metrics.surfaces)} 个 Surface</span>
        <span>${escapeHtml(metrics.pendingChanges ? '有待发布变更' : formatRelative(brand.updatedAt))}</span>
      </div>
    </button>
  `;
}

function renderBrandDetailPage() {
  if (!state.brandDetail?.brand) {
    return `
      <div class="fig-page">
        <div class="fig-page__header">
          <div class="fig-page__header-inner">
            <div>
              <h1>品牌详情</h1>
              <p class="fig-page__description">选择品牌后查看真实配置、资源和发布轨迹</p>
            </div>
          </div>
        </div>
        <div class="fig-page__body">
          <div class="empty-state empty-state--panel">当前没有可查看的品牌。</div>
        </div>
      </div>
    `;
  }

  const brand = state.brandDetail.brand;
  const buffer = ensureBrandDraftBuffer();
  const versions = state.brandDetail.versions || [];
  const assets = state.brandDetail.assets || [];
  const audit = state.brandDetail.audit || [];
  const activeTab = ['surfaces', 'capabilities', 'assets', 'theme'].includes(state.brandDetailTab)
    ? state.brandDetailTab
    : 'surfaces';
  const rollbackTarget = versions[0]?.version || '';

  return `
    <div class="fig-brand-detail">
      <div class="fig-brand-detail__header">
        <div class="fig-brand-detail__header-inner">
          <div class="fig-brand-detail__header-main">
            <button class="fig-icon-button" type="button" data-action="navigate" data-page="brands" aria-label="返回品牌列表">
              ${icon('arrowLeft', 'fig-icon-button__icon')}
            </button>
            <div class="fig-brand-detail__title-wrap">
              <div class="fig-brand-detail__title-row">
                <h1>${escapeHtml(brand.displayName)}</h1>
                ${statusBadge(brand.status)}
              </div>
              <p class="fig-brand-detail__subtitle">
                ${escapeHtml(brand.productName)} • 租户:
                <code>${escapeHtml(brand.tenantKey)}</code>
              </p>
            </div>
          </div>
          <div class="fig-brand-detail__actions">
            <button class="ghost-button fig-button" type="button" data-action="save-brand-draft"${state.busy ? ' disabled' : ''}>
              ${icon('save', 'button-icon')}
              保存草稿
            </button>
            <button class="solid-button fig-button" type="button" data-action="publish-brand"${state.busy ? ' disabled' : ''}>
              ${icon('rocket', 'button-icon')}
              发布
            </button>
            <button class="fig-icon-button" type="button" data-action="rollback-brand" data-version="${escapeHtml(rollbackTarget)}"${rollbackTarget ? '' : ' disabled'} aria-label="回滚为最近发布版本">
              ${icon('rotateCcw', 'fig-icon-button__icon')}
            </button>
          </div>
        </div>
        <div class="fig-brand-detail__meta">
          <div>当前版本: <code>v${escapeHtml(brand.publishedVersion || 0)}</code></div>
          <div>•</div>
          <div>最后发布: ${escapeHtml(brandLastPublished(state.brandDetail))}</div>
          <div>•</div>
          <div>发布者: ${escapeHtml(versions[0]?.createdByName || versions[0]?.createdByUsername || 'system')}</div>
        </div>
      </div>
      <div class="fig-brand-tabs">
        ${[
          ['surfaces', 'Surface 配置', 'monitor'],
          ['capabilities', '技能与 MCP', 'store'],
          ['assets', '品牌资源', 'image'],
          ['theme', '主题样式', 'palette'],
        ]
          .map(
            ([id, label, iconName]) => `
              <button
                class="fig-brand-tab${activeTab === id ? ' is-active' : ''}"
                type="button"
                data-action="brand-tab"
                data-tab="${id}"
              >
                ${icon(iconName, 'fig-inline-icon')}
                ${escapeHtml(label)}
              </button>
            `,
          )
          .join('')}
      </div>
      <div class="fig-page__body fig-page__body--brand-detail">
        <form id="brand-editor-form" class="fig-brand-form">
          <input type="hidden" name="brand_id" value="${fieldValue(buffer.brandId)}" />
          <section class="fig-card fig-brand-meta-editor">
            <div class="fig-card__head">
              <h3>品牌信息</h3>
              <span>基础元数据会写入真实草稿配置</span>
            </div>
            <div class="form-grid form-grid--three">
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
            </div>
          </section>
          ${renderBrandEditorBody(buffer, assets, activeTab)}
        </form>
        <section class="fig-support-grid">
          <article class="fig-card">
            <div class="fig-card__head">
              <h3>版本轨迹</h3>
              <span>可回滚到任意已发布版本</span>
            </div>
            <div class="fig-list">
              ${versions.length
                ? versions
                    .map(
                      (item) => `
                        <div class="fig-list-item fig-list-item--spread">
                          <div>
                            <div class="fig-list-item__title">v${escapeHtml(item.version)}</div>
                            <div class="fig-list-item__meta">
                              <span>${escapeHtml(formatDateTime(item.publishedAt))}</span>
                              <span>•</span>
                              <span>${escapeHtml(item.createdByName || item.createdByUsername || 'system')}</span>
                            </div>
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
          <article class="fig-card">
            <div class="fig-card__head">
              <h3>最近审计</h3>
              <button class="text-button" type="button" data-action="navigate" data-page="audit-log">全部日志</button>
            </div>
            <div class="fig-list">
              ${audit.length
                ? audit
                    .slice(0, 6)
                    .map(
                      (item) => `
                        <div class="fig-list-item">
                          <div>
                            <div class="fig-list-item__title">${escapeHtml(actionLabel(item.action))}</div>
                            <div class="fig-list-item__meta">
                              <span>${escapeHtml(item.actorName || item.actorUsername || 'system')}</span>
                              <span>•</span>
                              <span>${escapeHtml(formatRelative(item.createdAt))}</span>
                            </div>
                          </div>
                        </div>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">暂无审计记录。</div>`}
            </div>
          </article>
        </section>
      </div>
    </div>
  `;
}

function renderBrandEditorBody(buffer, assets, activeTab = state.brandDetailTab) {
  if (activeTab === 'surfaces') {
    const surfaceIcons = {
      desktop: 'monitor',
      'home-web': 'globe',
      header: 'layout',
      sidebar: 'sidebar',
      input: 'messageSquare',
      'input-composer': 'messageSquare',
      'skill-store': 'store',
    };
    return `
      <section class="fig-brand-section">
        <div class="fig-section-heading">
          <h2>Surface 配置</h2>
          <p>为不同部署 Surface 配置界面组件</p>
        </div>
        <div class="fig-surface-grid">
        ${buffer.surfaces
          .map(
            (surface) => `
              <article class="surface-editor fig-surface-card" data-surface-key="${escapeHtml(surface.key)}" data-surface-label="${escapeHtml(surface.label)}">
                <div class="fig-surface-card__preview">
                  ${icon(surfaceIcons[surface.key] || 'layout', 'fig-surface-card__preview-icon')}
                </div>
                <div class="fig-surface-card__body">
                  <div class="surface-editor__head fig-surface-card__head">
                    <div>
                      <h3>${escapeHtml(surface.label)}</h3>
                      <p>${surface.enabled ? '已配置' : '未配置'}</p>
                    </div>
                    <label class="toggle fig-toggle">
                      <input type="checkbox" name="surface_enabled__${escapeHtml(surface.key)}"${surface.enabled ? ' checked' : ''} />
                      <span>${surface.enabled ? '已启用' : '已关闭'}</span>
                    </label>
                  </div>
                  <textarea class="code-input" name="surface_config__${escapeHtml(surface.key)}">${escapeHtml(surface.json)}</textarea>
                </div>
              </article>
            `,
          )
          .join('')}
        </div>
      </section>
    `;
  }

  if (activeTab === 'capabilities') {
    const skills = state.capabilities?.skills || [];
    const mcpServers = state.capabilities?.mcp_servers || [];
    return `
      <section class="fig-brand-section">
        <div class="fig-section-heading">
          <h2>技能与 MCP</h2>
          <p>管理品牌可用技能和模型上下文协议能力提供方</p>
        </div>
        <div class="fig-capability-columns">
          <article class="fig-card fig-card--subtle">
            <div class="fig-card__head">
              <h3>已启用技能</h3>
              <span>此品牌可用的技能</span>
            </div>
            <div class="fig-capability-stack">
              ${skills.length
                ? skills
                    .map(
                      (skill) => `
                        <article class="checkbox-card checkbox-card--capability fig-capability-item">
                          <input class="skill-checkbox visually-hidden" type="checkbox" value="${escapeHtml(skill.slug)}"${buffer.selectedSkills.includes(skill.slug) ? ' checked' : ''} />
                          <div>
                            <strong>${escapeHtml(skill.name)}</strong>
                            <span>${escapeHtml(skill.category || '未分类')}</span>
                          </div>
                          <button class="${buffer.selectedSkills.includes(skill.slug) ? 'ghost-button' : 'solid-button'} control-button" type="button" data-action="toggle-brand-skill" data-skill-slug="${escapeHtml(skill.slug)}">
                            ${buffer.selectedSkills.includes(skill.slug) ? 'Disable' : 'Enable'}
                          </button>
                        </article>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">当前没有可用技能。</div>`}
            </div>
          </article>
          <article class="fig-card fig-card--subtle">
            <div class="fig-card__head">
              <h3>MCP 服务器</h3>
              <span>已连接的能力提供方</span>
            </div>
            <div class="fig-capability-stack">
              ${mcpServers.length
                ? mcpServers
                    .map(
                      (server) => `
                        <article class="checkbox-card checkbox-card--capability fig-capability-item">
                          <input class="mcp-checkbox visually-hidden" type="checkbox" value="${escapeHtml(server.key)}"${buffer.selectedMcp.includes(server.key) ? ' checked' : ''} />
                          <div>
                            <strong>${escapeHtml(server.name)}</strong>
                            <span>${escapeHtml(server.connected_brand_count)} 个品牌使用</span>
                          </div>
                          <button class="${buffer.selectedMcp.includes(server.key) ? 'ghost-button' : 'solid-button'} control-button" type="button" data-action="toggle-brand-mcp" data-mcp-key="${escapeHtml(server.key)}">
                            ${buffer.selectedMcp.includes(server.key) ? 'Disable' : 'Enable'}
                          </button>
                        </article>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">当前没有 MCP 目录。</div>`}
            </div>
          </article>
        </div>
        <div class="fig-capability-columns fig-capability-columns--bottom">
          <article class="fig-card fig-card--subtle">
            <div class="fig-card__head">
              <h3>Agents</h3>
              <span>每行一个 agent slug</span>
            </div>
            <label class="field">
              <textarea class="field-textarea" name="agents_text" placeholder="每行一个 agent slug">${escapeHtml(buffer.agentsText)}</textarea>
            </label>
          </article>
          <article class="fig-card fig-card--subtle">
            <div class="fig-card__head">
              <h3>Menus</h3>
              <span>每行一个 menu key</span>
            </div>
            <label class="field">
              <textarea class="field-textarea" name="menus_text" placeholder="每行一个 menu key">${escapeHtml(buffer.menusText)}</textarea>
            </label>
          </article>
        </div>
      </section>
    `;
  }

  if (activeTab === 'assets') {
    const assetSlots = [
      ['logoMaster', 'Logo', 'logo'],
      ['homeLogo', 'Home Logo', 'logo'],
      ['faviconPng', 'Favicon PNG', 'favicon'],
      ['faviconIco', 'Favicon ICO', 'favicon'],
    ];
    return `
      <section class="fig-brand-section">
        <div class="fig-section-heading">
          <h2>品牌资源</h2>
          <p>上传和维护 Logo、Favicon 与其它品牌资源</p>
        </div>
        <div class="fig-assets-layout">
          <article class="fig-card fig-card--subtle">
            <div class="fig-card__head">
            <h3>Logo / Favicon 上传器</h3>
            <span>seed 资源是仓库内置 repo 文件；你在这里上传的新图会真正写入 MinIO / S3，并回填 draft_config.assets</span>
          </div>
          <form id="asset-form" class="stack-form">
            <input type="hidden" name="brand_id" value="${fieldValue(buffer.brandId)}" />
            <div class="asset-slot-grid fig-asset-slot-grid">
              ${assetSlots
                .map(([assetKey, label, kind]) => {
                  const current = assets.find((item) => item.assetKey === assetKey) || null;
                  return `
                    <article class="fig-asset-slot-card">
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
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>当前品牌资源</h3>
            <span>来自 oem_asset_registry 的真实记录</span>
          </div>
          <div class="fig-list">
            ${assets.length
              ? assets
                  .map(
                    (item) => `
                      <div class="fig-list-item fig-list-item--spread">
                        <div>
                          <div class="fig-list-item__title">${escapeHtml(item.assetKey)}</div>
                          <div class="fig-list-item__body">${escapeHtml(item.kind)} · ${escapeHtml(item.objectKey)}</div>
                          ${
                            isImageLike(item.metadata?.content_type, item.publicUrl, item.objectKey)
                              ? `<div class="asset-thumb-wrap"><img class="asset-thumb" src="${escapeHtml(resolveAssetUrl(item))}" alt="${escapeHtml(item.assetKey)}" /></div>`
                              : ''
                          }
                        </div>
                        <div class="fig-list-item__actions">
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
        </div>
      </section>
    `;
  }

  if (activeTab === 'theme') {
    return `
      <section class="fig-brand-section">
        <div class="fig-section-heading">
          <h2>主题样式</h2>
          <p>维护 Light / Dark 主题色，并保留完整 JSON 编辑能力</p>
        </div>
        <div class="fig-theme-grid">
          <article class="fig-card fig-card--subtle">
            <div class="fig-card__head">
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
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
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
        </div>
        <section class="fig-card">
          <div class="fig-card__head">
            <h3>高级 JSON</h3>
            <span>完整 Draft Config</span>
          </div>
          <label class="field">
            <textarea class="code-input code-input--tall" name="advanced_json">${escapeHtml(buffer.advancedJson)}</textarea>
          </label>
        </section>
      </section>
    `;
  }

  return `
    <section class="fig-card">
      <label class="field">
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
  const actionButton = state.capabilityMode === 'skills'
    ? `
      <button class="solid-button fig-button" type="button" data-action="toggle-skill-import">
        ${icon('plus', 'button-icon')}
        添加技能
      </button>
    `
    : `
      <button class="solid-button fig-button" type="button" data-action="new-mcp">
        ${icon('plus', 'button-icon')}
        新增 MCP
      </button>
    `;

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>技能与 MCP</h1>
            <p class="fig-page__description">管理 AI 技能和模型上下文协议能力提供方</p>
          </div>
          ${actionButton}
        </div>
      </div>
      <div class="fig-capability-screen">
        <aside class="fig-capability-sidebar">
          <div class="fig-capability-sidebar__toolbar">
            <label class="fig-search">
              ${icon('search', 'fig-search__icon')}
              <input
                class="field-input fig-search__input"
                data-filter-key="capabilityQuery"
                placeholder="${state.capabilityMode === 'skills' ? '搜索技能...' : '搜索 MCP...'}"
                value="${fieldValue(state.filters.capabilityQuery)}"
              />
            </label>
            <div class="segmented">
              <button class="tab-pill${state.capabilityMode === 'skills' ? ' is-active' : ''}" type="button" data-action="capability-mode" data-mode="skills">技能</button>
              <button class="tab-pill${state.capabilityMode === 'mcp' ? ' is-active' : ''}" type="button" data-action="capability-mode" data-mode="mcp">MCP</button>
            </div>
          </div>
          <div class="fig-capability-list">
            ${
              state.capabilityMode === 'skills'
                ? skills.length
                  ? skills
                      .map(
                        (item) => `
                          <button class="capability-card${selectedSkill?.slug === item.slug ? ' is-active' : ''}" type="button" data-action="select-skill" data-skill-slug="${escapeHtml(item.slug)}">
                            <strong>${escapeHtml(item.name)}</strong>
                            <span>${escapeHtml(item.category || '未分类')} • ${escapeHtml(item.brand_count)} 个品牌使用</span>
                          </button>
                        `,
                      )
                      .join('')
                  : `<div class="empty-state">没有匹配的技能。</div>`
                : `
                    ${
                      mcpServers.length
                        ? mcpServers
                            .map(
                              (item) => `
                                <button class="capability-card${selectedMcp?.key === item.key ? ' is-active' : ''}" type="button" data-action="select-mcp" data-mcp-key="${escapeHtml(item.key)}">
                                  <strong>${escapeHtml(item.name)}</strong>
                                  <span>${escapeHtml(item.connected_brand_count)} 个品牌 • ${escapeHtml(item.env_keys.length)} 个环境变量</span>
                                </button>
                              `,
                            )
                            .join('')
                        : `<div class="empty-state">没有匹配的 MCP。</div>`
                    }
                    <button class="capability-card${state.selectedMcpKey === '__new__' ? ' is-active' : ''}" type="button" data-action="select-mcp" data-mcp-key="__new__">
                      <strong>新建 MCP</strong>
                      <span>新增一个可保存到注册表的配置</span>
                    </button>
                  `
            }
          </div>
        </aside>
        <section class="fig-capability-detail">
          ${
            state.capabilityMode === 'skills'
              ? renderSkillDetail(selectedSkill)
              : renderMcpDetail(selectedMcp)
          }
        </section>
      </div>
    </div>
  `;
}

function renderSkillImportPanel() {
  return `
    <section class="fig-card fig-card--subtle">
      <div class="fig-card__head">
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
        <div class="fig-form-actions">
          <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>导入 Skill</button>
        </div>
      </form>
    </section>
  `;
}

function renderSkillDetail(skill) {
  if (!skill) {
    return `${state.showSkillImportPanel ? renderSkillImportPanel() : ''}<div class="fig-card fig-card--detail-empty"><div class="empty-state">选择一个技能查看详情。</div></div>`;
  }
  const libraryItem = getSkillLibraryItem(skill.slug);
  const catalogItem = getAdminSkillCatalogEntry(skill.slug);
  const personalItem = getPersonalSkillCatalogEntry(skill.slug);
  const canDelete = personalItem?.source === 'private' || (catalogItem && catalogItem.distribution !== 'bundled');
  return `
    <div class="fig-detail-stack">
      <div class="fig-card">
        <div class="fig-card__head">
          <div>
            <h2>${escapeHtml(skill.name)}</h2>
            <span>${escapeHtml(skill.slug)} · ${escapeHtml(skill.publisher || 'iClaw')}</span>
          </div>
          <button class="${libraryItem?.enabled ? 'ghost-button' : 'solid-button'} control-button" type="button" data-action="${libraryItem?.enabled ? 'skill-disable' : 'skill-enable'}" data-skill-slug="${escapeHtml(skill.slug)}">
            ${libraryItem?.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
        <p class="detail-copy">${escapeHtml(skill.description || '暂无描述。')}</p>
        <div class="fig-meta-cards">
          <div class="fig-meta-card"><span>分类</span><strong>${escapeHtml(skill.category || '未分类')}</strong></div>
          <div class="fig-meta-card"><span>来源</span><strong>${escapeHtml(skill.distribution || 'unknown')}</strong></div>
          <div class="fig-meta-card"><span>使用品牌数</span><strong>${escapeHtml(skill.brand_count)}</strong></div>
        </div>
        <div class="action-row">
          ${canDelete ? `<button class="ghost-button" type="button" data-action="skill-delete" data-skill-slug="${escapeHtml(skill.slug)}">删除 Skill</button>` : ''}
          <button class="text-button" type="button" data-action="toggle-skill-import">${state.showSkillImportPanel ? '收起导入面板' : '导入私有 Skill'}</button>
        </div>
      </div>
      <section class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>${icon('zap', 'fig-inline-icon')}能力</h3>
        </div>
        <div class="chip-grid">
          ${asArray(skill.capabilities).length
            ? asArray(skill.capabilities).map((cap) => `<span class="chip">${escapeHtml(cap)}</span>`).join('')
            : `<div class="empty-state">当前没有声明能力标签。</div>`}
        </div>
      </section>
      <section class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>品牌访问权限</h3>
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
      ${state.showSkillImportPanel ? renderSkillImportPanel() : ''}
    </div>
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
    <div class="fig-detail-stack">
      <div class="fig-card">
        <div class="fig-card__head">
          <div>
            <h2>${escapeHtml(server.name)}</h2>
            <span>${escapeHtml(server.key || 'new-mcp')} · ${escapeHtml(server.command || '未声明 command')}</span>
          </div>
          <div class="metric-chips">
            <span>${escapeHtml(server.connected_brand_count)} 个品牌</span>
            <span>${server.enabled_by_default ? '默认启用' : '默认关闭'}</span>
          </div>
        </div>
      </div>
      <form id="mcp-editor-form" class="fig-card fig-card--subtle">
      <div class="fig-card__head">
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
      <section class="fig-card fig-card--subtle">
      <div class="fig-card__head">
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
    </div>
  `;
}

function renderCapabilityBrandMatrix(type, item) {
  const brands = state.capabilities?.brands || [];
  const connectedIds = new Set(
    (type === 'skill' ? item.connectedBrands : item.connected_brands || []).map((brand) => brand.brand_id),
  );
  return `
    <section class="fig-card fig-card--subtle">
      <div class="fig-card__head">
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
  const typeTabs = ['all', ...kinds];

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner fig-page__header-inner--stack">
          <div class="fig-page__header-row">
            <div>
              <h1>资源管理</h1>
              <p class="fig-page__description">品牌资源库，包含 Logo、图标和视觉资源</p>
            </div>
            <button class="solid-button fig-button" type="button" data-action="toggle-asset-upload">
              ${icon('plus', 'button-icon')}
              上传资源
            </button>
          </div>
          <div class="fig-toolbar">
            <label class="fig-search">
              ${icon('search', 'fig-search__icon')}
              <input class="field-input fig-search__input" data-filter-key="assetQuery" placeholder="搜索资源..." value="${fieldValue(state.filters.assetQuery)}" />
            </label>
            <select class="field-select fig-filter" data-filter-key="assetBrand">
              <option value="all">全部品牌</option>
              ${state.brands
                .map(
                  (brand) => `
                    <option value="${escapeHtml(brand.brandId)}"${state.filters.assetBrand === brand.brandId ? ' selected' : ''}>${escapeHtml(brand.displayName)}</option>
                  `,
                )
                .join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="fig-page__body">
        ${
          state.showAssetUploadPanel
            ? `
              <section class="fig-card fig-create-panel">
                <div class="fig-card__head">
                  <h3>上传资源</h3>
                  <button class="text-button" type="button" data-action="toggle-asset-upload">收起</button>
                </div>
                <form id="asset-form" class="form-grid form-grid--two">
                  <label class="field">
                    <span>Brand ID</span>
                    <select class="field-select" name="brand_id">
                      ${state.brands
                        .map(
                          (brand) => `
                            <option value="${escapeHtml(brand.brandId)}"${state.selectedBrandId === brand.brandId ? ' selected' : ''}>${escapeHtml(brand.displayName)}</option>
                          `,
                        )
                        .join('')}
                    </select>
                  </label>
                  <label class="field">
                    <span>Asset Key</span>
                    <input class="field-input" name="asset_key" placeholder="logoMaster" />
                  </label>
                  <label class="field">
                    <span>类型</span>
                    <input class="field-input" name="kind" placeholder="logo / hero / screenshot" />
                  </label>
                  <label class="field">
                    <span>上传文件</span>
                    <input class="field-input" name="file" type="file" />
                  </label>
                  <label class="field">
                    <span>存储提供方</span>
                    <input class="field-input" name="storage_provider" value="repo" />
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
                  <div class="fig-form-actions">
                    <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>上传并登记</button>
                  </div>
                </form>
              </section>
            `
            : ''
        }
        <div class="fig-type-tabs">
          ${typeTabs
            .map(
              (kind) => `
                <button class="fig-type-tab${state.filters.assetKind === kind ? ' is-active' : ''}" type="button" data-action="set-asset-kind" data-kind="${escapeHtml(kind)}">
                  ${escapeHtml(kind === 'all' ? '全部' : kind)}
                </button>
              `,
            )
            .join('')}
        </div>
        <section class="fig-assets-grid">
          ${items.length
            ? items
                .map(
                  (item) => `
                    <article class="fig-asset-card">
                      <div class="fig-asset-card__preview">
                        ${
                          isImageLike(item.metadata?.content_type, item.publicUrl, item.objectKey)
                            ? `<img class="fig-asset-card__image" src="${escapeHtml(resolveAssetUrl(item))}" alt="${escapeHtml(item.assetKey)}" />`
                            : `<div class="asset-thumb asset-thumb--placeholder">${escapeHtml((item.kind || 'AS').slice(0, 2).toUpperCase())}</div>`
                        }
                      </div>
                      <div class="fig-asset-card__body">
                        <div class="fig-asset-card__title">${escapeHtml(item.assetKey)}</div>
                        <div class="fig-asset-card__meta">${escapeHtml(item.kind)} • ${escapeHtml(item.storageProvider)}</div>
                        <div class="fig-asset-card__brand">${escapeHtml(item.brandDisplayName || item.brandId)}</div>
                        <div class="fig-asset-card__actions">
                          <button class="text-button" type="button" data-action="select-brand" data-brand-id="${escapeHtml(item.brandId)}">打开品牌</button>
                          ${
                            item.publicUrl || item.objectKey
                              ? `<a class="text-link" href="${escapeHtml(resolveAssetUrl(item))}" target="_blank" rel="noreferrer">打开资源</a>`
                              : ''
                          }
                        </div>
                      </div>
                    </article>
                  `,
                )
                .join('')
            : `<div class="empty-state empty-state--panel">没有匹配的资源。</div>`}
        </section>
      </div>
    </div>
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
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>版本发布</h1>
            <p class="fig-page__description">品牌版本时间线和部署历史</p>
          </div>
        </div>
      </div>
      <div class="fig-page__body">
        <div class="fig-toolbar">
          <select class="field-select fig-filter" data-filter-key="releaseBrand">
            <option value="all">全部品牌</option>
            ${state.brands
              .map(
                (brand) => `
                  <option value="${escapeHtml(brand.brandId)}"${state.filters.releaseBrand === brand.brandId ? ' selected' : ''}>${escapeHtml(brand.displayName)}</option>
                `,
              )
              .join('')}
          </select>
        </div>
        <div class="fig-release-timeline">
          ${items.length
            ? items
                .map(
                  (item) => {
                    const isActive = selectedRelease?.id === item.id;
                    const releaseBrand = state.brands.find((brand) => brand.brandId === item.brand_id) || null;
                    const releaseDiffAreas = isActive ? summarizeChangedAreas(releaseBrand?.draftConfig, item.config) : [];
                    return `
                      <div class="fig-release-entry${isActive ? ' is-active' : ''}">
                        <div class="fig-release-entry__dot"></div>
                        <div class="fig-release-card">
                          <button class="fig-release-card__summary" type="button" data-action="select-release" data-release-id="${escapeHtml(item.id)}">
                            <div>
                              <div class="fig-release-card__title-row">
                                <h3>${escapeHtml(item.display_name)}</h3>
                                ${statusBadge('published')}
                              </div>
                              <div class="fig-release-card__meta">
                                <span><code>v${escapeHtml(item.version)}</code></span>
                                <span>•</span>
                                <span>${icon('calendar', 'fig-inline-icon')} ${escapeHtml(formatDateTime(item.published_at))}</span>
                                <span>•</span>
                                <span>${icon('user', 'fig-inline-icon')} ${escapeHtml(item.created_by_name || item.created_by_username || 'system')}</span>
                              </div>
                            </div>
                          </button>
                          ${
                            isActive
                              ? `
                                <div class="fig-release-card__detail">
                                  <div class="metric-chips">
                                    ${(item.changed_areas || []).length ? item.changed_areas.map((area) => `<span>${escapeHtml(area)}</span>`).join('') : '<span>无变更区域</span>'}
                                  </div>
                                  <div class="release-metrics">
                                    <div><span>Surface</span><strong>${escapeHtml((item.surfaces || []).join(' / ') || '无')}</strong></div>
                                    <div><span>技能数</span><strong>${escapeHtml(item.skill_count)}</strong></div>
                                    <div><span>MCP 数</span><strong>${escapeHtml(item.mcp_count)}</strong></div>
                                    <div><span>当前草稿 Diff</span><strong>${escapeHtml(releaseDiffAreas.join(' / ') || '无差异')}</strong></div>
                                  </div>
                                  <div class="fig-release-card__actions">
                                    <button class="ghost-button" type="button" data-action="select-brand" data-brand-id="${escapeHtml(item.brand_id)}">打开品牌</button>
                                  </div>
                                  <section class="fig-card fig-card--subtle">
                                    <div class="fig-card__head">
                                      <h3>Diff 视图</h3>
                                      <span>对比选中发布版本与当前品牌草稿</span>
                                    </div>
                                    <div class="diff-grid">
                                      <label class="field">
                                        <span>发布版本 JSON</span>
                                        <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(item.config))}</textarea>
                                      </label>
                                      <label class="field">
                                        <span>当前草稿 JSON</span>
                                        <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(releaseBrand?.draftConfig || {}))}</textarea>
                                      </label>
                                    </div>
                                  </section>
                                </div>
                              `
                              : ''
                          }
                        </div>
                      </div>
                    `;
                  },
                )
                .join('')
            : `<div class="empty-state empty-state--panel">当前没有发布记录。</div>`}
        </div>
      </div>
    </div>
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
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner fig-page__header-inner--stack">
          <div>
            <h1>审计日志</h1>
            <p class="fig-page__description">平台所有变更的完整操作审计记录</p>
          </div>
          <div class="fig-toolbar fig-toolbar--audit">
            <label class="fig-search">
              ${icon('search', 'fig-search__icon')}
              <input class="field-input fig-search__input" data-filter-key="auditQuery" placeholder="搜索审计日志..." value="${fieldValue(state.filters.auditQuery)}" />
            </label>
            <select class="field-select fig-filter" data-filter-key="auditBrand">
              <option value="all">所有品牌</option>
              ${state.brands
                .map(
                  (brand) => `
                    <option value="${escapeHtml(brand.brandId)}"${state.filters.auditBrand === brand.brandId ? ' selected' : ''}>${escapeHtml(brand.displayName)}</option>
                  `,
                )
                .join('')}
            </select>
            <select class="field-select fig-filter" data-filter-key="auditAction">
              <option value="all">所有操作</option>
              ${actions
                .map(
                  (action) => `
                    <option value="${escapeHtml(action)}"${state.filters.auditAction === action ? ' selected' : ''}>${escapeHtml(actionLabel(action))}</option>
                  `,
                )
                .join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="fig-page__body">
        <section class="fig-card fig-audit-table-card">
          <div class="fig-audit-table">
            <div class="fig-audit-table__header">
              <div>操作</div>
              <div>品牌</div>
              <div>操作人</div>
              <div>环境</div>
              <div>时间戳</div>
            </div>
            <div class="fig-audit-table__body">
              ${items.length
                ? items
                    .map(
                      (item) => `
                        <button class="fig-audit-row${selectedAudit?.id === item.id ? ' is-active' : ''}" type="button" data-action="select-audit" data-audit-id="${escapeHtml(item.id)}">
                          <div>
                            <div class="fig-audit-row__title">${escapeHtml(actionLabel(item.action))}</div>
                            <div class="fig-audit-row__detail">${escapeHtml(item.environment || 'control-plane')}</div>
                          </div>
                          <div>${escapeHtml(item.brandDisplayName || item.brandId)}</div>
                          <div>${escapeHtml(item.actorName || item.actorUsername || 'system')}</div>
                          <div>${escapeHtml(item.environment || 'control-plane')}</div>
                          <div>${escapeHtml(formatDateTime(item.createdAt))}</div>
                        </button>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">没有匹配的审计记录。</div>`}
            </div>
          </div>
        </section>
        ${
          selectedAudit
            ? `
              <section class="fig-card">
                <div class="fig-card__head">
                  <div>
                    <h3>${escapeHtml(actionLabel(selectedAudit.action))}</h3>
                    <span>${escapeHtml(selectedAudit.brandDisplayName || selectedAudit.brandId)} · ${escapeHtml(formatDateTime(selectedAudit.createdAt))}</span>
                  </div>
                  <button class="ghost-button" type="button" data-action="select-brand" data-brand-id="${escapeHtml(selectedAudit.brandId)}">打开品牌</button>
                </div>
                <div class="fig-meta-cards">
                  <div class="fig-meta-card"><span>操作人</span><strong>${escapeHtml(selectedAudit.actorName || selectedAudit.actorUsername || 'system')}</strong></div>
                  <div class="fig-meta-card"><span>环境</span><strong>${escapeHtml(selectedAudit.environment || 'control-plane')}</strong></div>
                  <div class="fig-meta-card"><span>Brand</span><strong>${escapeHtml(selectedAudit.brandId)}</strong></div>
                </div>
                <section class="fig-card fig-card--subtle">
                  <div class="fig-card__head">
                    <h3>审计详情</h3>
                    <span>真实 payload</span>
                  </div>
                  <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(selectedAudit.payload || {}))}</textarea>
                </section>
              </section>
            `
            : ''
        }
      </div>
    </div>
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
            当前后台直连真实 control-plane 接口，按 OEM 运营中心设计稿重构。默认账号：<strong>admin / admin</strong>。
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

  if (action === 'toggle-create-brand') {
    state.showCreateBrandForm = !state.showCreateBrandForm;
    render();
    return;
  }

  if (action === 'toggle-skill-import') {
    state.showSkillImportPanel = !state.showSkillImportPanel;
    render();
    return;
  }

  if (action === 'new-mcp') {
    state.capabilityMode = 'mcp';
    state.selectedMcpKey = '__new__';
    state.mcpTestResult = null;
    render();
    return;
  }

  if (action === 'toggle-asset-upload') {
    state.showAssetUploadPanel = !state.showAssetUploadPanel;
    render();
    return;
  }

  if (action === 'set-asset-kind') {
    state.filters.assetKind = target.getAttribute('data-kind') || 'all';
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

  if (action === 'save-brand-draft') {
    const form = document.querySelector('#brand-editor-form');
    if (form instanceof HTMLFormElement) {
      await saveBrandEditor(form);
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
