import './styles.css';

const API_BASE_URL = ((import.meta.env.VITE_AUTH_BASE_URL || 'http://127.0.0.1:2130') + '').trim().replace(/\/+$/, '');
const TOKEN_STORAGE_KEY = 'iclaw.admin-web.tokens';
const THEME_STORAGE_KEY = 'iclaw.admin-web.theme';
const NAV_ITEMS = [
  {id: 'overview', label: '总览', icon: 'layoutGrid'},
  {id: 'brands', label: '品牌管理', icon: 'layers'},
  {id: 'agent-center', label: 'Agent中心', icon: 'messageSquare'},
  {id: 'skill-center', label: 'Skill中心', icon: 'zap'},
  {id: 'mcp-center', label: 'MCP中心', icon: 'network'},
  {id: 'model-center', label: '模型中心', icon: 'package'},
  {id: 'cloud-skills', label: '云技能', icon: 'store'},
  {id: 'assets', label: '资源管理', icon: 'image'},
  {id: 'releases', label: '版本发布', icon: 'rocket'},
  {id: 'audit-log', label: '审计日志', icon: 'fileText'},
];
const CAPABILITY_ROUTE_MODE = {
  'skills-mcp': 'skills',
  'skill-center': 'skills',
  'mcp-center': 'mcp',
  'model-center': 'models',
};
const SURFACE_LABELS = {
  desktop: '桌面端',
  'home-web': 'Web 主页',
  welcome: 'Welcome页',
  header: '顶部栏',
  sidebar: '侧边栏',
  input: '输入编辑器',
  'input-composer': '输入编辑器',
  'skill-store': '技能商店',
  'mcp-store': 'MCP商店',
  'lobster-store': '龙虾商店',
  'investment-experts': '智能投资专家',
  security: '安全中心',
  memory: '记忆管理',
  'data-connections': '数据连接',
  'im-bots': 'IM机器人',
  'task-center': '任务中心',
};
const SURFACE_BLUEPRINTS = [
  {key: 'desktop', label: '桌面端', icon: 'monitor', kind: 'shell'},
  {key: 'home-web', label: 'Home页', icon: 'globe', kind: 'shell'},
  {key: 'welcome', label: 'Welcome页', icon: 'sparkles', kind: 'shell'},
  {key: 'header', label: 'Header栏', icon: 'layout', kind: 'shell'},
  {key: 'sidebar', label: '侧边栏', icon: 'sidebar', kind: 'shell'},
  {key: 'input', label: '输入框', icon: 'messageSquare', kind: 'shell'},
  {key: 'skill-store', label: '技能商店', icon: 'store', kind: 'module', menuKey: 'skill-store'},
  {key: 'mcp-store', label: 'MCP商店', icon: 'network', kind: 'module', menuKey: 'mcp-store'},
  {key: 'lobster-store', label: '龙虾商店', icon: 'package', kind: 'module', menuKey: 'lobster-store'},
  {key: 'investment-experts', label: '智能投资专家', icon: 'trendingUp', kind: 'module', menuKey: 'investment-experts'},
  {key: 'security', label: '安全中心', icon: 'shield', kind: 'module', menuKey: 'security'},
  {key: 'memory', label: '记忆管理', icon: 'fileText', kind: 'module', menuKey: 'memory'},
  {key: 'data-connections', label: '数据连接', icon: 'network', kind: 'module', menuKey: 'data-connections'},
  {key: 'im-bots', label: 'IM机器人', icon: 'messageSquare', kind: 'module', menuKey: 'im-bots'},
  {key: 'task-center', label: '任务中心', icon: 'checkCircle', kind: 'module', menuKey: 'task-center'},
];
const DEFAULT_SURFACE_KEYS = SURFACE_BLUEPRINTS.filter((item) => item.key !== 'welcome').map((item) => item.key);
const BRAND_DETAIL_TABS = [
  {id: 'desktop', label: '桌面端', icon: 'monitor'},
  {id: 'home-web', label: 'Home页', icon: 'globe'},
  {id: 'welcome', label: 'Welcome页', icon: 'sparkles'},
  {id: 'header', label: 'Header栏', icon: 'layout'},
  {id: 'sidebar', label: '侧边栏', icon: 'sidebar'},
  {id: 'input', label: '输入框', icon: 'messageSquare'},
  {id: 'skills', label: '技能', icon: 'zap'},
  {id: 'mcps', label: 'MCP', icon: 'network'},
  {id: 'models', label: '模型', icon: 'package'},
  {id: 'menus', label: '左菜单栏', icon: 'layers'},
  {id: 'investment-experts', label: '智能投资专家', icon: 'trendingUp'},
  {id: 'lobster-store', label: '龙虾商店', icon: 'store'},
  {id: 'skill-store', label: '技能商店', icon: 'store'},
  {id: 'mcp-store', label: 'MCP商店', icon: 'network'},
  {id: 'security', label: '安全中心', icon: 'shield'},
  {id: 'memory', label: '记忆管理', icon: 'fileText'},
  {id: 'data-connections', label: '数据连接', icon: 'network'},
  {id: 'im-bots', label: 'IM机器人', icon: 'messageSquare'},
  {id: 'task-center', label: '任务中心', icon: 'checkCircle'},
  {id: 'assets', label: '品牌资源', icon: 'image'},
  {id: 'theme', label: '主题样式', icon: 'palette'},
];
const BRAND_DETAIL_TAB_GROUPS = [
  {id: 'shell', label: 'Shell骨架', icon: 'monitor', tabs: ['desktop', 'home-web', 'welcome', 'header', 'sidebar', 'input']},
  {id: 'capabilities', label: '能力绑定', icon: 'zap', tabs: ['skills', 'mcps', 'models', 'menus']},
  {
    id: 'modules',
    label: '业务模块',
    icon: 'store',
    tabs: ['investment-experts', 'lobster-store', 'skill-store', 'mcp-store', 'security', 'memory', 'data-connections', 'im-bots', 'task-center'],
  },
  {id: 'brand', label: '品牌资源', icon: 'image', tabs: ['assets', 'theme']},
];

const app = document.querySelector('#app');

if (!app) {
  throw new Error('admin-web mount failed');
}

function isThemeMode(value) {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredThemeMode() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

function resolveThemeMode(mode) {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeMode(mode) {
  const resolved = resolveThemeMode(mode);
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.resolvedTheme = resolved;
  return resolved;
}

function persistThemeMode(mode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {}
}

function cycleThemeMode(mode) {
  if (mode === 'system') return 'light';
  if (mode === 'light') return 'dark';
  return 'system';
}

function themeModeLabel(mode) {
  if (mode === 'light') return '浅色';
  if (mode === 'dark') return '深色';
  return '跟随系统';
}

const state = {
  themeMode: readStoredThemeMode(),
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
  portalAppDetails: {},
  selectedBrandId: '',
  brandDetail: null,
  brandDraftBuffer: null,
  brandDetailTab: 'desktop',
  capabilities: null,
  menuCatalog: [],
  composerControlCatalog: [],
  composerShortcutCatalog: [],
  skillCatalog: [],
  cloudSkillCatalog: [],
  personalSkillCatalog: [],
  skillLibrary: [],
  mcpCatalog: [],
  modelCatalog: [],
  skillSyncSources: [],
  skillSyncRuns: [],
  capabilityMode: 'skills',
  agentCatalog: [],
  selectedAgentSlug: '',
  selectedSkillSlug: '',
  selectedMcpKey: '',
  selectedModelRef: '',
  selectedCloudSkillSlug: '',
  selectedSkillSyncSourceId: '',
  selectedReleaseId: '',
  selectedAuditId: '',
  selectedDesktopReleaseChannel: 'prod',
  mcpTestResult: null,
  assets: [],
  releases: [],
  audit: [],
  showCreateBrandForm: false,
  showAgentImportPanel: false,
  showSkillImportPanel: false,
  showSkillSyncSourceForm: false,
  showAssetUploadPanel: false,
  filters: {
    brandQuery: '',
    brandStatus: 'all',
    agentQuery: '',
    agentStatus: 'all',
    agentSurface: 'all',
    capabilityQuery: '',
    capabilitySkillStatus: 'all',
    capabilitySkillCategory: 'all',
    capabilitySkillBrand: 'all',
    capabilityMcpStatus: 'all',
    capabilityMcpTransport: 'all',
    capabilityMcpBrand: 'all',
    capabilityModelStatus: 'all',
    capabilityModelProvider: 'all',
    capabilityModelBrand: 'all',
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

function getUserAvatarUrl(user) {
  const avatarUrl = String(user?.avatar_url || user?.avatarUrl || '').trim();
  return avatarUrl || '';
}

function getUserDisplayName(user) {
  return String(user?.name || user?.username || 'admin').trim() || 'admin';
}

function getUserInitials(user) {
  const label = getUserDisplayName(user);
  return Array.from(label).slice(0, 1).join('').toUpperCase();
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
    chevronUp: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="m6 14 6-6 6 6"/></svg>`,
    chevronDown: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="m6 10 6 6 6-6"/></svg>`,
    save: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M5 5h11l3 3v11H5z"/><path ${common} d="M8 5v5h8"/><path ${common} d="M9 19v-5h6v5"/></svg>`,
    rotateCcw: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M3 12a9 9 0 1 0 3-6.7"/><path ${common} d="M3 4v5h5"/></svg>`,
    monitor: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="4" width="18" height="12" rx="2"/><path ${common} d="M8 20h8"/><path ${common} d="M12 16v4"/></svg>`,
    globe: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="12" r="9"/><path ${common} d="M3 12h18"/><path ${common} d="M12 3a15 15 0 0 1 0 18"/><path ${common} d="M12 3a15 15 0 0 0 0 18"/></svg>`,
    layout: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="4" width="18" height="16" rx="2"/><path ${common} d="M3 10h18"/><path ${common} d="M9 10v10"/></svg>`,
    sidebar: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="4" width="18" height="16" rx="2"/><path ${common} d="M9 4v16"/></svg>`,
    messageSquare: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M7 18H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-4 3z"/></svg>`,
    store: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M4 9l1-4h14l1 4"/><path ${common} d="M5 9h14v10H5z"/><path ${common} d="M9 13h6"/></svg>`,
    palette: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4 5 5 0 0 0 0-10Z"/><circle ${common} cx="7.5" cy="10.5" r=".5"/><circle ${common} cx="9.5" cy="7.5" r=".5"/><circle ${common} cx="14.5" cy="7.5" r=".5"/></svg>`,
    sparkles: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path ${common} d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/><path ${common} d="m5.5 14 .6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/></svg>`,
    image: `<svg viewBox="0 0 24 24"${cls}><rect ${common} x="3" y="5" width="18" height="14" rx="2"/><circle ${common} cx="8.5" cy="10" r="1.5"/><path ${common} d="m21 16-5-5-6 6-3-3-4 4"/></svg>`,
    zap: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>`,
    network: `<svg viewBox="0 0 24 24"${cls}><circle ${common} cx="12" cy="5" r="2"/><circle ${common} cx="5" cy="18" r="2"/><circle ${common} cx="19" cy="18" r="2"/><path ${common} d="M12 7v4"/><path ${common} d="M12 11 6.5 16"/><path ${common} d="M12 11 17.5 16"/></svg>`,
    shield: `<svg viewBox="0 0 24 24"${cls}><path ${common} d="M12 3 5 6v5c0 4.7 2.8 7.9 7 10 4.2-2.1 7-5.3 7-10V6z"/><path ${common} d="m9.5 12 1.8 1.8 3.7-3.8"/></svg>`,
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

function renderAdminLogo(className = '') {
  const cls = className ? ` ${className}` : '';
  return `
    <span class="brand-mark${cls}" aria-hidden="true">
      <svg class="brand-mark__svg" viewBox="0 0 72 72" fill="none">
        <defs>
          <linearGradient id="adminBrandGradient" x1="12" y1="10" x2="60" y2="62" gradientUnits="userSpaceOnUse">
            <stop stop-color="#7DB0AF" />
            <stop offset="0.54" stop-color="#B89573" />
            <stop offset="1" stop-color="#314036" />
          </linearGradient>
        </defs>
        <rect x="6" y="6" width="60" height="60" rx="18" fill="#221f1b" />
        <rect x="13" y="13" width="46" height="46" rx="14" fill="url(#adminBrandGradient)" opacity="0.2" />
        <path d="M20 46.5V24.5L36 16l16 8.5v22L36 55l-16-8.5Z" fill="url(#adminBrandGradient)" />
        <path d="M36 16v39" stroke="#F9F7F3" stroke-opacity="0.88" stroke-width="2.2" stroke-linecap="round" />
        <path d="M20 24.5 36 33l16-8.5" stroke="#F9F7F3" stroke-opacity="0.82" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M20 46.5 36 38l16 8.5" stroke="#F9F7F3" stroke-opacity="0.64" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
  `;
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

function getSurfaceBlueprint(key) {
  return SURFACE_BLUEPRINTS.find((item) => item.key === key) || null;
}

function getBrandDetailTabConfig(tabId) {
  return BRAND_DETAIL_TABS.find((item) => item.id === tabId) || null;
}

function getBrandDetailTabGroup(tabId) {
  return BRAND_DETAIL_TAB_GROUPS.find((group) => group.tabs.includes(tabId)) || BRAND_DETAIL_TAB_GROUPS[0];
}

function normalizeMenuCatalogItem(item, index = 0) {
  const raw = asObject(item);
  const key = String(raw.menuKey || raw.menu_key || raw.key || '').trim();
  if (!key) return null;
  return {
    key,
    label: String(raw.displayName || raw.display_name || raw.label || titleizeKey(key)).trim() || titleizeKey(key),
    category: String(raw.category || '').trim() || 'sidebar',
    routeKey: String(raw.routeKey || raw.route_key || '').trim(),
    iconKey: String(raw.iconKey || raw.icon_key || '').trim(),
    metadata: asObject(raw.metadata),
    active: raw.active !== false,
    sortOrder: Number(raw.sortOrder || raw.sort_order || (index + 1) * 10) || (index + 1) * 10,
  };
}

function getMenuCatalogItems() {
  return asArray(state.menuCatalog)
    .map((item, index) => normalizeMenuCatalogItem(item, index))
    .filter(Boolean);
}

function getManageableMenuCatalogItems() {
  return getMenuCatalogItems().filter((item) => item.category !== 'legacy');
}

function isMenuEnabledByDefault(menu) {
  const item = normalizeMenuCatalogItem(menu);
  if (!item) return false;
  const metadata = asObject(item.metadata);
  if (metadata.enabled_by_default !== undefined) {
    return metadata.enabled_by_default === true;
  }
  if (metadata.enabledByDefault !== undefined) {
    return metadata.enabledByDefault === true;
  }
  return false;
}

function getMenuDefinition(menuKey) {
  const normalized = String(menuKey || '').trim();
  const match = getMenuCatalogItems().find((item) => item.key === normalized);
  if (match) return match;
  if (!normalized) return null;
  return {
    key: normalized,
    label: titleizeKey(normalized),
    category: 'legacy',
    routeKey: '',
    iconKey: '',
    metadata: {},
    active: true,
    sortOrder: 9999,
  };
}

function getMenuIconOptions() {
  const options = [['', '默认图标']];
  const seen = new Set(['']);
  for (const item of getMenuCatalogItems()) {
    const value = String(item.iconKey || item.key || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push([value, item.label]);
  }
  return options;
}

function normalizeComposerControlOption(item, index = 0) {
  const raw = asObject(item);
  const optionValue = String(raw.optionValue || raw.option_value || raw.value || '').trim();
  if (!optionValue) return null;
  return {
    optionValue,
    label: String(raw.label || titleizeKey(optionValue)).trim() || titleizeKey(optionValue),
    description: String(raw.description || raw.detail || '').trim(),
    sortOrder: Number(raw.sortOrder || raw.sort_order || (index + 1) * 10) || (index + 1) * 10,
    metadata: asObject(raw.metadata),
    active: raw.active !== false,
  };
}

function normalizeComposerControlCatalogItem(item, index = 0) {
  const raw = asObject(item);
  const controlKey = String(raw.controlKey || raw.control_key || '').trim();
  if (!controlKey) return null;
  return {
    controlKey,
    displayName: String(raw.displayName || raw.display_name || titleizeKey(controlKey)).trim() || titleizeKey(controlKey),
    controlType: String(raw.controlType || raw.control_type || 'static').trim() || 'static',
    iconKey: String(raw.iconKey || raw.icon_key || '').trim(),
    metadata: asObject(raw.metadata),
    active: raw.active !== false,
    sortOrder: Number(raw.sortOrder || raw.sort_order || (index + 1) * 10) || (index + 1) * 10,
    options: asArray(raw.options).map((option, optionIndex) => normalizeComposerControlOption(option, optionIndex)).filter(Boolean),
  };
}

function normalizeComposerShortcutCatalogItem(item, index = 0) {
  const raw = asObject(item);
  const shortcutKey = String(raw.shortcutKey || raw.shortcut_key || '').trim();
  if (!shortcutKey) return null;
  return {
    shortcutKey,
    displayName: String(raw.displayName || raw.display_name || titleizeKey(shortcutKey)).trim() || titleizeKey(shortcutKey),
    description: String(raw.description || '').trim(),
    template: String(raw.template || raw.template_text || '').trim(),
    iconKey: String(raw.iconKey || raw.icon_key || '').trim(),
    tone: String(raw.tone || '').trim(),
    metadata: asObject(raw.metadata),
    active: raw.active !== false,
    sortOrder: Number(raw.sortOrder || raw.sort_order || (index + 1) * 10) || (index + 1) * 10,
  };
}

function getComposerControlCatalogItems() {
  return asArray(state.composerControlCatalog)
    .map((item, index) => normalizeComposerControlCatalogItem(item, index))
    .filter(Boolean);
}

function getComposerShortcutCatalogItems() {
  return asArray(state.composerShortcutCatalog)
    .map((item, index) => normalizeComposerShortcutCatalogItem(item, index))
    .filter(Boolean);
}

function getComposerControlDefinition(controlKey) {
  const normalized = String(controlKey || '').trim();
  const match = getComposerControlCatalogItems().find((item) => item.controlKey === normalized);
  if (match) return match;
  if (!normalized) return null;
  return {
    controlKey: normalized,
    displayName: titleizeKey(normalized),
    controlType: 'static',
    iconKey: '',
    metadata: {},
    active: true,
    sortOrder: 9999,
    options: [],
  };
}

function getComposerShortcutDefinition(shortcutKey) {
  const normalized = String(shortcutKey || '').trim();
  const match = getComposerShortcutCatalogItems().find((item) => item.shortcutKey === normalized);
  if (match) return match;
  if (!normalized) return null;
  return {
    shortcutKey: normalized,
    displayName: titleizeKey(normalized),
    description: '',
    template: '',
    iconKey: '',
    tone: '',
    metadata: {},
    active: true,
    sortOrder: 9999,
  };
}

function normalizeComposerControlDraftConfig(value) {
  const config = asObject(value);
  return {
    displayName: String(config.display_name || config.displayName || '').trim(),
    iconKey: String(config.icon_key || config.iconKey || '').trim(),
    allowedOptionValues: asStringArray(config.allowed_option_values || config.allowedOptionValues),
  };
}

function normalizeComposerShortcutDraftConfig(value) {
  const config = asObject(value);
  return {
    displayName: String(config.display_name || config.displayName || '').trim(),
    description: String(config.description || config.subtitle || '').trim(),
    template: String(config.template || config.template_text || '').trim(),
    iconKey: String(config.icon_key || config.iconKey || '').trim(),
    tone: String(config.tone || '').trim(),
  };
}

const DEFAULT_WELCOME_QUICK_ACTIONS = [
  {
    label: '市场行情分析',
    prompt: '帮我分析一下当前市场形势，有哪些值得关注的板块和投资机会？',
    iconKey: 'TrendingUp',
  },
  {
    label: '投资组合诊断',
    prompt: '帮我分析我的投资组合，看看是否需要调整配置？',
    iconKey: 'PieChart',
  },
  {
    label: '个股深度研究',
    prompt: '我想了解某个公司的投资价值，能帮我做个深度分析吗？',
    iconKey: 'Search',
  },
  {
    label: '投资策略咨询',
    prompt: '基于当前市场环境，给我一些长期投资的建议。',
    iconKey: 'Lightbulb',
  },
];

const DEFAULT_WELCOME_SURFACE_CONFIG = {
  kolName: '陈雪',
  expertName: '陈雪的投资智囊',
  slogan: '用价值投资思维，陪你穿越市场周期',
  avatarUrl:
    'https://images.unsplash.com/photo-1581065178047-8ee15951ede6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBhc2lhbiUyMHdvbWFuJTIwYnVzaW5lc3N8ZW58MXx8fHwxNzc0MjgzMTg0fDA&ixlib=rb-4.1.0&q=80&w=1080',
  backgroundImageUrl:
    'https://images.unsplash.com/photo-1760172287483-02d382f63a6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVnYW50JTIwYWJzdHJhY3QlMjBnb2xkJTIwZ3JhZGllbnR8ZW58MXx8fHwxNzc0MjgzMTgzfDA&ixlib=rb-4.1.0&q=80&w=1080',
  primaryColor: '#C4975F',
  description: '我会用我 10 年的投资框架和市场洞察，帮你理解复杂的金融市场，找到适合你的投资路径。',
  expertiseAreas: ['价值投资', '资产配置', '长期持有策略', '市场周期分析'],
  targetAudience: '希望建立长期投资思维的理性投资者。',
  disclaimer: '本智囊提供的所有信息仅供学习参考，不构成投资建议。投资有风险，决策需谨慎。',
  quickActions: DEFAULT_WELCOME_QUICK_ACTIONS,
};

const WELCOME_ACTION_ICON_OPTIONS = [
  ['', '默认火花'],
  ['TrendingUp', 'TrendingUp'],
  ['PieChart', 'PieChart'],
  ['Search', 'Search'],
  ['Lightbulb', 'Lightbulb'],
  ['MessageCircle', 'MessageCircle'],
  ['Sparkles', 'Sparkles'],
  ['ShieldCheck', 'ShieldCheck'],
];

function normalizeWelcomeQuickAction(value, index = 0) {
  const raw = asObject(value);
  return {
    label: String(raw.label || DEFAULT_WELCOME_QUICK_ACTIONS[index]?.label || '').trim(),
    prompt: String(raw.prompt || DEFAULT_WELCOME_QUICK_ACTIONS[index]?.prompt || '').trim(),
    iconKey: String(raw.icon_key || raw.iconKey || raw.icon || DEFAULT_WELCOME_QUICK_ACTIONS[index]?.iconKey || '').trim(),
  };
}

function normalizeWelcomeSurfaceConfig(value) {
  const config = asObject(value);
  const areas = asStringArray(config.expertise_areas || config.expertiseAreas);
  const quickActions = asArray(config.quick_actions || config.quickActions)
    .map((item, index) => normalizeWelcomeQuickAction(item, index))
    .filter((item) => item.label || item.prompt || item.iconKey);

  return {
    kolName: String(config.kol_name || config.kolName || DEFAULT_WELCOME_SURFACE_CONFIG.kolName).trim(),
    expertName: String(config.expert_name || config.expertName || DEFAULT_WELCOME_SURFACE_CONFIG.expertName).trim(),
    slogan: String(config.slogan || DEFAULT_WELCOME_SURFACE_CONFIG.slogan).trim(),
    avatarUrl: String(config.avatar_url || config.avatar || config.avatarUrl || DEFAULT_WELCOME_SURFACE_CONFIG.avatarUrl).trim(),
    backgroundImageUrl: String(
      config.background_image_url || config.backgroundImageUrl || config.backgroundImage || DEFAULT_WELCOME_SURFACE_CONFIG.backgroundImageUrl,
    ).trim(),
    primaryColor: String(config.primary_color || config.primaryColor || DEFAULT_WELCOME_SURFACE_CONFIG.primaryColor).trim(),
    description: String(config.description || DEFAULT_WELCOME_SURFACE_CONFIG.description).trim(),
    expertiseAreas: areas.length ? areas : [...DEFAULT_WELCOME_SURFACE_CONFIG.expertiseAreas],
    targetAudience: String(config.target_audience || config.targetAudience || DEFAULT_WELCOME_SURFACE_CONFIG.targetAudience).trim(),
    disclaimer: String(config.disclaimer || DEFAULT_WELCOME_SURFACE_CONFIG.disclaimer).trim(),
    quickActions: Array.from({length: 4}, (_, index) => ({
      ...normalizeWelcomeQuickAction(DEFAULT_WELCOME_QUICK_ACTIONS[index], index),
      ...(quickActions[index] || {}),
    })),
  };
}

function buildWelcomeSurfaceConfigFromBuffer(welcome) {
  const next = normalizeWelcomeSurfaceConfig(welcome);
  return {
    kol_name: next.kolName,
    expert_name: next.expertName,
    slogan: next.slogan,
    avatar_url: next.avatarUrl,
    background_image_url: next.backgroundImageUrl,
    primary_color: next.primaryColor,
    description: next.description,
    expertise_areas: [...next.expertiseAreas],
    target_audience: next.targetAudience,
    disclaimer: next.disclaimer,
    quick_actions: next.quickActions
      .map((item) => ({
        label: String(item.label || '').trim(),
        prompt: String(item.prompt || '').trim(),
        icon_key: String(item.iconKey || '').trim(),
      }))
      .filter((item) => item.label || item.prompt || item.icon_key),
  };
}

function buildComposerControlBindingConfig(existingValue, draftValue) {
  const next = {...asObject(existingValue)};
  delete next.display_name;
  delete next.displayName;
  delete next.icon_key;
  delete next.iconKey;
  delete next.allowed_option_values;
  delete next.allowedOptionValues;
  const draft = normalizeComposerControlDraftConfig(draftValue);
  if (draft.displayName) next.display_name = draft.displayName;
  if (draft.iconKey) next.icon_key = draft.iconKey;
  if (draft.allowedOptionValues.length) next.allowed_option_values = draft.allowedOptionValues;
  return next;
}

function buildComposerShortcutBindingConfig(existingValue, draftValue) {
  const next = {...asObject(existingValue)};
  delete next.display_name;
  delete next.displayName;
  delete next.description;
  delete next.subtitle;
  delete next.template;
  delete next.template_text;
  delete next.icon_key;
  delete next.iconKey;
  delete next.tone;
  const draft = normalizeComposerShortcutDraftConfig(draftValue);
  if (draft.displayName) next.display_name = draft.displayName;
  if (draft.description) next.description = draft.description;
  if (draft.template) next.template = draft.template;
  if (draft.iconKey) next.icon_key = draft.iconKey;
  if (draft.tone) next.tone = draft.tone;
  return next;
}

function mergeComposerControlBindings(bindings) {
  const existing = new Map(
    asArray(bindings).map((item) => {
      const entry = asObject(item);
      return [
        String(entry.controlKey || entry.control_key || '').trim(),
        {
          appName: String(entry.appName || entry.app_name || '').trim(),
          controlKey: String(entry.controlKey || entry.control_key || '').trim(),
          enabled: entry.enabled !== false,
          sortOrder: Number(entry.sortOrder || entry.sort_order || 100) || 100,
          config: asObject(entry.config || entry.config_json),
        },
      ];
    }),
  );
  const catalogItems = getComposerControlCatalogItems();
  const merged = catalogItems.map((item, index) => ({
    appName: existing.get(item.controlKey)?.appName || '',
    controlKey: item.controlKey,
    enabled: existing.get(item.controlKey)?.enabled ?? false,
    sortOrder: existing.get(item.controlKey)?.sortOrder ?? (index + 1) * 10,
    config: asObject(existing.get(item.controlKey)?.config),
  }));
  const known = new Set(catalogItems.map((item) => item.controlKey));
  const extras = Array.from(existing.values())
    .filter((item) => item.controlKey && !known.has(item.controlKey))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.controlKey.localeCompare(right.controlKey, 'zh-CN'));
  return [...merged, ...extras];
}

function mergeComposerShortcutBindings(bindings) {
  const existing = new Map(
    asArray(bindings).map((item) => {
      const entry = asObject(item);
      return [
        String(entry.shortcutKey || entry.shortcut_key || '').trim(),
        {
          appName: String(entry.appName || entry.app_name || '').trim(),
          shortcutKey: String(entry.shortcutKey || entry.shortcut_key || '').trim(),
          enabled: entry.enabled !== false,
          sortOrder: Number(entry.sortOrder || entry.sort_order || 100) || 100,
          config: asObject(entry.config || entry.config_json),
        },
      ];
    }),
  );
  const catalogItems = getComposerShortcutCatalogItems();
  const merged = catalogItems.map((item, index) => ({
    appName: existing.get(item.shortcutKey)?.appName || '',
    shortcutKey: item.shortcutKey,
    enabled: existing.get(item.shortcutKey)?.enabled ?? false,
    sortOrder: existing.get(item.shortcutKey)?.sortOrder ?? (index + 1) * 10,
    config: asObject(existing.get(item.shortcutKey)?.config),
  }));
  const known = new Set(catalogItems.map((item) => item.shortcutKey));
  const extras = Array.from(existing.values())
    .filter((item) => item.shortcutKey && !known.has(item.shortcutKey))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.shortcutKey.localeCompare(right.shortcutKey, 'zh-CN'));
  return [...merged, ...extras];
}

function buildOrderedComposerControlList(order) {
  const catalogItems = getComposerControlCatalogItems();
  const known = new Set(catalogItems.map((item) => item.controlKey));
  const list = asStringArray(order).filter((key) => known.has(key));
  for (const item of catalogItems) {
    if (!list.includes(item.controlKey)) {
      list.push(item.controlKey);
    }
  }
  return list;
}

function buildOrderedComposerShortcutList(order) {
  const catalogItems = getComposerShortcutCatalogItems();
  const known = new Set(catalogItems.map((item) => item.shortcutKey));
  const list = asStringArray(order).filter((key) => known.has(key));
  for (const item of catalogItems) {
    if (!list.includes(item.shortcutKey)) {
      list.push(item.shortcutKey);
    }
  }
  return list;
}

function moveOrderedItem(list, value, direction, builder) {
  const current = builder(list);
  const index = current.indexOf(value);
  if (index < 0) return current;
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= current.length) return current;
  const [item] = current.splice(index, 1);
  current.splice(nextIndex, 0, item);
  return current;
}

function getMenuItemsByCategory(category) {
  const menuItems = getMenuCatalogItems();
  if (!category) {
    return menuItems;
  }
  return menuItems.filter((item) => item.category === category);
}

function statusLabel(status) {
  switch (status) {
    case 'active':
      return '已启用';
    case 'disabled':
      return '已禁用';
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

function visibilityStateLabel(visible) {
  return visible ? '已显示' : '已隐藏';
}

function installStateLabel(installed) {
  return installed ? '已安装' : '未安装';
}

function isPlatformManagedSkillBinding(binding) {
  const config = asObject(binding?.config);
  return config.locked === true || config.managed_by === 'platform' || config.managedBy === 'platform';
}

function getPlatformManagedSkillSlugs(detail = state.brandDetail) {
  const managed = new Set();
  asArray(detail?.skillBindings).forEach((item) => {
    const skillSlug = String(item?.skillSlug || '').trim();
    if (!skillSlug || !isPlatformManagedSkillBinding(item)) return;
    managed.add(skillSlug);
  });
  return Array.from(managed);
}

function isPlatformManagedSkillSlug(skillSlug, detail = state.brandDetail) {
  return Boolean(skillSlug) && getPlatformManagedSkillSlugs(detail).includes(skillSlug);
}

function ensurePlatformManagedSkillSelection(selectedSkills, detail = state.brandDetail) {
  const next = new Set(asStringArray(selectedSkills));
  getPlatformManagedSkillSlugs(detail).forEach((skillSlug) => next.add(skillSlug));
  return Array.from(next);
}

function getSkillBinding(detail, skillSlug) {
  return asArray(detail?.skillBindings).find((item) => String(item?.skillSlug || '').trim() === skillSlug) || null;
}

function capabilityBindingCountLabel(type, count) {
  if (type === 'skill' || type === 'mcp') {
    return `${count} 个品牌已安装`;
  }
  return `${count} 个 OEM 已启用`;
}

function capabilityBindingEmptyLabel(type) {
  if (type === 'skill') return '当前没有品牌安装此技能。';
  if (type === 'mcp') return '当前没有品牌安装此 MCP。';
  return '当前没有 OEM 绑定此模型。';
}

function getMenuLabel(menuKey) {
  return getMenuDefinition(menuKey)?.label || titleizeKey(menuKey);
}

function getMenuDisplayNameOverride(source) {
  const config = asObject(source?.config);
  return String(config.display_name || config.displayName || '').trim();
}

function normalizeMenuDraftConfig(value) {
  const config = asObject(value);
  const requires = asObject(config.requires);
  return {
    displayName: String(config.display_name || config.displayName || '').trim(),
    group: String(config.group_label || config.groupLabel || config.group || '').trim(),
    iconKey: String(config.icon_key || config.iconKey || '').trim(),
    requiresSkillSlug: String(
      requires.skill_slug || requires.skillSlug || config.requires_skill_slug || config.requiresSkillSlug || '',
    ).trim(),
    requiresMcpKey: String(
      requires.mcp_key || requires.mcpKey || config.requires_mcp_key || config.requiresMcpKey || '',
    ).trim(),
    requiresModelRef: String(
      requires.model_ref || requires.modelRef || config.requires_model_ref || config.requiresModelRef || '',
    ).trim(),
  };
}

function buildMenuBindingConfig(existingValue, draftValue) {
  const next = {...asObject(existingValue)};
  delete next.display_name;
  delete next.displayName;
  delete next.group_label;
  delete next.groupLabel;
  delete next.group;
  delete next.icon_key;
  delete next.iconKey;
  delete next.requires;
  delete next.requires_skill_slug;
  delete next.requiresSkillSlug;
  delete next.requires_mcp_key;
  delete next.requiresMcpKey;
  delete next.requires_model_ref;
  delete next.requiresModelRef;

  const draft = normalizeMenuDraftConfig(draftValue);
  if (draft.displayName) next.display_name = draft.displayName;
  if (draft.group) next.group_label = draft.group;
  if (draft.iconKey) next.icon_key = draft.iconKey;
  if (draft.requiresSkillSlug || draft.requiresMcpKey || draft.requiresModelRef) {
    next.requires = {
      ...(draft.requiresSkillSlug ? {skill_slug: draft.requiresSkillSlug} : {}),
      ...(draft.requiresMcpKey ? {mcp_key: draft.requiresMcpKey} : {}),
      ...(draft.requiresModelRef ? {model_ref: draft.requiresModelRef} : {}),
    };
  }
  return next;
}

function buildDefaultMenuOrder(bindings) {
  return mergeMenuBindings(bindings)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.menuKey.localeCompare(right.menuKey, 'zh-CN'))
    .map((item) => item.menuKey);
}

function buildOrderedMenuList(order) {
  const catalogItems = getMenuCatalogItems();
  const known = new Set(catalogItems.map((item) => item.key));
  const list = asStringArray(order).filter((key) => known.has(key));
  for (const item of catalogItems) {
    if (!list.includes(item.key)) {
      list.push(item.key);
    }
  }
  return list;
}

function buildManageableMenuOrder(order) {
  const manageableKeys = new Set(getManageableMenuCatalogItems().map((item) => item.key));
  return buildOrderedMenuList(order).filter((key) => manageableKeys.has(key));
}

function moveManageableMenuItem(list, value, direction) {
  const visible = buildManageableMenuOrder(list);
  const hidden = buildOrderedMenuList(list).filter((key) => !visible.includes(key));
  const index = visible.indexOf(value);
  if (index < 0) {
    return [...visible, ...hidden];
  }
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= visible.length) {
    return [...visible, ...hidden];
  }
  const [item] = visible.splice(index, 1);
  visible.splice(nextIndex, 0, item);
  return [...visible, ...hidden];
}

function moveListItem(list, value, direction) {
  const current = buildOrderedMenuList(list);
  const index = current.indexOf(value);
  if (index < 0) return current;
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= current.length) return current;
  const [item] = current.splice(index, 1);
  current.splice(nextIndex, 0, item);
  return current;
}

function getAppConfig(source) {
  return asObject(source?.config || source?.draftConfig);
}

function getDesktopReleaseConfig(source) {
  const config = getAppConfig(source);
  const root = asObject(config.desktop_release_admin);
  const channels = asObject(root.channels);
  const ensureSnapshot = (value) => {
    const snapshot = asObject(value);
    return {
      version: String(snapshot.version || '').trim(),
      notes: String(snapshot.notes || '').trim(),
      publishedAt: String(snapshot.publishedAt || snapshot.published_at || '').trim(),
      policy: {
        mandatory: Boolean(asObject(snapshot.policy).mandatory),
        forceUpdateBelowVersion: String(
          asObject(snapshot.policy).forceUpdateBelowVersion || asObject(snapshot.policy).force_update_below_version || '',
        ).trim(),
        allowCurrentRunToFinish:
          asObject(snapshot.policy).allowCurrentRunToFinish === undefined &&
          asObject(snapshot.policy).allow_current_run_to_finish === undefined
            ? true
            : Boolean(
                asObject(snapshot.policy).allowCurrentRunToFinish ?? asObject(snapshot.policy).allow_current_run_to_finish,
              ),
        reasonCode: String(asObject(snapshot.policy).reasonCode || asObject(snapshot.policy).reason_code || '').trim(),
        reasonMessage: String(
          asObject(snapshot.policy).reasonMessage || asObject(snapshot.policy).reason_message || '',
        ).trim(),
      },
      targets: asArray(snapshot.targets).map((item) => {
        const target = asObject(item);
        return {
          platform: String(target.platform || '').trim(),
          arch: String(target.arch || '').trim(),
          installer: asObject(target.installer),
          updater: asObject(target.updater),
          signature: asObject(target.signature),
        };
      }),
    };
  };
  const ensureChannel = (value) => {
    const channel = asObject(value);
    return {
      draft: ensureSnapshot(channel.draft),
      published: ensureSnapshot(channel.published),
    };
  };
  return {
    dev: ensureChannel(channels.dev),
    prod: ensureChannel(channels.prod),
  };
}

function findDesktopReleaseTarget(snapshot, platform, arch) {
  return asArray(snapshot?.targets).find((item) => item.platform === platform && item.arch === arch) || null;
}

function formatDesktopTargetLabel(platform, arch) {
  const platformLabel = platform === 'darwin' ? 'macOS' : platform === 'windows' ? 'Windows' : platform;
  return `${platformLabel} / ${arch === 'aarch64' ? 'ARM64' : arch === 'x64' ? 'x64' : arch}`;
}

function inferBinaryContentType(file) {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.dmg')) return 'application/x-apple-diskimage';
  if (name.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable';
  if (name.endsWith('.app.tar.gz') || name.endsWith('.tar.gz') || name.endsWith('.tgz')) return 'application/gzip';
  if (name.endsWith('.nsis.zip') || name.endsWith('.zip')) return 'application/zip';
  if (name.endsWith('.sig')) return 'text/plain; charset=utf-8';
  return file?.type || 'application/octet-stream';
}

function getAppBrandMeta(source) {
  const config = getAppConfig(source);
  const brandMeta = {
    ...asObject(config.brand_meta),
    ...asObject(config.brandMeta),
  };
  return {
    productName: String(
      brandMeta.productName || brandMeta.product_name || config.productName || config.product_name || '',
    ).trim(),
    tenantKey: String(
      brandMeta.tenantKey || brandMeta.tenant_key || config.tenantKey || config.tenant_key || source?.appName || source?.brandId || '',
    ).trim(),
    description: String(brandMeta.description || brandMeta.description_text || config.description || source?.description || '').trim(),
  };
}

function mapAppStatusToBrandStatus(status) {
  return status === 'disabled' ? 'disabled' : 'active';
}

function mergeMenuBindings(bindings) {
  const existing = new Map(
    asArray(bindings).map((item) => {
      const entry = asObject(item);
      return [
        String(entry.menuKey || entry.menu_key || '').trim(),
        {
          ...entry,
          menuKey: String(entry.menuKey || entry.menu_key || '').trim(),
          appName: String(entry.appName || entry.app_name || '').trim(),
          enabled: entry.enabled !== false,
          sortOrder: Number(entry.sortOrder || entry.sort_order || 100) || 100,
          config: asObject(entry.config || entry.config_json),
        },
      ];
    }),
  );
  const catalogItems = getMenuCatalogItems();
  const merged = catalogItems.map((item, index) => ({
    appName: existing.get(item.key)?.appName || '',
    menuKey: item.key,
    enabled: existing.get(item.key)?.enabled ?? false,
    sortOrder: existing.get(item.key)?.sortOrder ?? (index + 1) * 10,
    config: asObject(existing.get(item.key)?.config),
  }));
  const known = new Set(catalogItems.map((item) => item.key));
  const extras = Array.from(existing.values())
    .filter((item) => item.menuKey && !known.has(item.menuKey))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.menuKey.localeCompare(right.menuKey, 'zh-CN'))
    .map((item) => ({
      appName: item.appName || '',
      menuKey: item.menuKey,
      enabled: item.enabled ?? false,
      sortOrder: item.sortOrder ?? 9999,
      config: asObject(item.config),
    }));
  return [...merged, ...extras];
}

function adaptPortalDetail(detail) {
  if (!detail?.app) return null;
  const meta = getAppBrandMeta(detail.app);
  const config = clone(getAppConfig(detail.app));
  return {
    app: detail.app,
    brand: {
      brandId: detail.app.appName,
      displayName: detail.app.displayName,
      productName: meta.productName || detail.app.displayName,
      tenantKey: meta.tenantKey || detail.app.appName,
      description: meta.description,
      status: mapAppStatusToBrandStatus(detail.app.status),
      draftConfig: config,
      publishedConfig: config,
      updatedAt: detail.app.updatedAt,
      publishedVersion: detail.releases?.[0]?.version || 0,
    },
    skillBindings: asArray(detail.skillBindings),
    mcpBindings: asArray(detail.mcpBindings),
    modelBindings: asArray(detail.modelBindings),
    menuBindings: mergeMenuBindings(detail.menuBindings),
    composerControlBindings: mergeComposerControlBindings(detail.composerControlBindings),
    composerShortcutBindings: mergeComposerShortcutBindings(detail.composerShortcutBindings),
    assets: asArray(detail.assets).map((item) => ({
      ...item,
      appName: item.appName,
      brandId: item.appName,
      brandDisplayName: detail.app.displayName,
      storageProvider: item.storageProvider || 's3',
      publicUrl: item.publicUrl || buildPortalAssetUrl(item.appName, item.assetKey),
      metadata: asObject(item.metadata),
      updatedAt: item.updatedAt,
    })),
    versions: asArray(detail.releases).map((item) => ({
      id: item.id,
      brandId: item.appName,
      brandDisplayName: item.appDisplayName,
      version: item.version,
      config: asObject(item.config),
      createdByName: item.createdByName,
      createdByUsername: item.createdByUsername,
      createdAt: item.createdAt,
      publishedAt: item.publishedAt,
    })),
    audit: asArray(detail.audit).map((item) => ({
      id: item.id,
      brandId: item.appName,
      brandDisplayName: item.appDisplayName,
      action: item.action,
      actorName: item.actorName,
      actorUsername: item.actorUsername,
      createdAt: item.createdAt,
      environment: 'portal',
      payload: asObject(item.payload),
    })),
  };
}

function mapPortalAppToBrand(app, detail) {
  const config = getAppConfig(detail?.app || app);
  const meta = getAppBrandMeta(detail?.app || app);
  const surfaces = Object.values(asObject(config.surfaces)).filter((surface) => asObject(surface).enabled !== false);
  const enabledSkills = asArray(detail?.skillBindings).filter((item) => item?.enabled).length;
  const enabledMcps = asArray(detail?.mcpBindings).filter((item) => item?.enabled).length;
  const enabledModels = asArray(detail?.modelBindings).filter((item) => item?.enabled).length;
  return {
    brandId: app.appName,
    displayName: app.displayName,
    productName: meta.productName || app.displayName,
    tenantKey: meta.tenantKey || app.appName,
    status: mapAppStatusToBrandStatus(app.status),
    updatedAt: app.updatedAt,
    publishedVersion: 0,
    draftConfig: clone(config),
    publishedConfig: clone(config),
    _surfaceCount: surfaces.length,
    _skillCount: enabledSkills,
    _mcpCount: enabledMcps,
    _modelCount: enabledModels,
  };
}

function buildPortalDashboard(apps, skills, mcps, detailsMap) {
  const detailList = Object.values(detailsMap).map((detail) => adaptPortalDetail(detail)).filter(Boolean);
  const recentReleases = detailList
    .flatMap((detail) => detail.versions.map((item) => ({
      id: item.id,
      display_name: detail.brand.displayName,
      version: item.version,
      published_at: item.publishedAt,
    })))
    .sort((left, right) => String(right.published_at).localeCompare(String(left.published_at)))
    .slice(0, 6);
  const recentEdits = detailList
    .flatMap((detail) => detail.audit.map((item) => ({
      id: item.id,
      display_name: detail.brand.displayName,
      action: item.action,
      actor_name: item.actorName || item.actorUsername || 'admin',
      created_at: item.createdAt,
    })))
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, 6);

  return {
    stats: {
      brands_total: apps.length,
      published_count: apps.filter((app) => app.status === 'active').length,
      draft_count: 0,
      mcp_servers_count: mcps.length,
      skills_count: skills.length,
      pending_changes_count: 0,
    },
    recent_releases: recentReleases,
    recent_edits: recentEdits,
    app_bindings: detailList.length,
  };
}

function getPortalSkillConnections(slug) {
  return state.brands
    .filter((brand) =>
      asArray(state.portalAppDetails[brand.brandId]?.skillBindings).some((item) => item.skillSlug === slug && item.enabled),
    )
    .map((brand) => ({
      brand_id: brand.brandId,
      display_name: brand.displayName,
    }));
}

function getPortalMcpConnections(mcpKey) {
  return state.brands
    .filter((brand) =>
      asArray(state.portalAppDetails[brand.brandId]?.mcpBindings).some((item) => item.mcpKey === mcpKey && item.enabled),
    )
    .map((brand) => ({
      brand_id: brand.brandId,
      display_name: brand.displayName,
    }));
}

function actionLabel(action) {
  switch (action) {
    case 'app_saved':
      return '保存应用配置';
    case 'skill_bindings_saved':
      return '更新 Skill 绑定';
    case 'mcp_bindings_saved':
      return '更新 MCP 绑定';
    case 'menu_bindings_saved':
      return '更新菜单绑定';
    case 'composer_control_bindings_saved':
      return '更新输入控件绑定';
    case 'composer_shortcut_bindings_saved':
      return '更新输入快捷方式绑定';
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
  if (CAPABILITY_ROUTE_MODE[itemId]) {
    return state.route === itemId;
  }
  return state.route === itemId;
}

function isCapabilityRoute(route) {
  return Boolean(CAPABILITY_ROUTE_MODE[route]);
}

function getCapabilityModeForRoute(route) {
  return CAPABILITY_ROUTE_MODE[route] || 'skills';
}

function getCapabilityRouteForMode(mode) {
  if (mode === 'mcp') return 'mcp-center';
  if (mode === 'models') return 'model-center';
  return 'skill-center';
}

function brandLastPublished(brandDetail) {
  const publishedAt = brandDetail?.versions?.[0]?.publishedAt || brandDetail?.brand?.updatedAt;
  return publishedAt ? formatRelative(publishedAt) : '未发布';
}

function statusBadge(status) {
  return `<span class="status-pill status-pill--${escapeHtml(status || 'default')}">${escapeHtml(statusLabel(status))}</span>`;
}

function renderSwitch({checked = false, action = '', attrs = '', label = '', disabled = false} = {}) {
  return `
    <button
      class="switch${checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}"
      type="button"
      role="switch"
      aria-checked="${checked ? 'true' : 'false'}"
      aria-disabled="${disabled ? 'true' : 'false'}"
      data-action="${escapeHtml(action)}"
      ${disabled ? 'disabled' : ''}
      ${attrs}
    >
      <span class="switch__track"><span class="switch__thumb"></span></span>
      ${label ? `<span class="switch__label">${escapeHtml(label)}</span>` : ''}
    </button>
  `;
}

function isImageLike(contentType, url, objectKey) {
  const source = [contentType, url, objectKey].filter(Boolean).join(' ').toLowerCase();
  return ['image/', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'].some((token) => source.includes(token));
}

function buildOemAssetUrl(brandId, assetKey) {
  return `${API_BASE_URL}/oem/asset/file?brand_id=${encodeURIComponent(brandId)}&asset_key=${encodeURIComponent(assetKey)}`;
}

function buildPortalAssetUrl(appName, assetKey) {
  return `${API_BASE_URL}/portal/asset/file?app_name=${encodeURIComponent(appName)}&asset_key=${encodeURIComponent(assetKey)}`;
}

function resolveAssetUrl(item) {
  if (item?.publicUrl) {
    return item.publicUrl;
  }
  if (item?.appName || item?.brandId) {
    return buildPortalAssetUrl(item?.appName || item?.brandId || '', item?.assetKey || '');
  }
  return buildOemAssetUrl(item?.brandId || '', item?.assetKey || '');
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

function getAgentCatalogEntry(slug) {
  return state.agentCatalog.find((item) => item.slug === slug) || null;
}

function getAgentSurface(agent) {
  return String(asObject(agent?.metadata).surface || '').trim() || 'general';
}

function getCloudSkillCatalogEntry(slug) {
  return state.cloudSkillCatalog.find((item) => item.slug === slug) || null;
}

function getPersonalSkillCatalogEntry(slug) {
  return state.personalSkillCatalog.find((item) => item.slug === slug) || null;
}

function getMcpCatalogEntry(key) {
  return state.mcpCatalog.find((item) => item.key === key || item.mcpKey === key) || null;
}

function getModelCatalogEntry(ref) {
  return state.modelCatalog.find((item) => item.ref === ref) || null;
}

function getMergedSkills() {
  return state.skillCatalog
    .map((item) => {
      const connectedBrands = getPortalSkillConnections(item.slug);
      return {
        ...item,
        distribution: 'cloud',
        brand_count: connectedBrands.length,
        connectedBrands,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function getMergedMcpServers() {
  return state.mcpCatalog
    .map((item) => {
      const connectedBrands = getPortalMcpConnections(item.mcpKey);
      const config = asObject(item.config);
      const env = asObject(config.env);
      return {
        key: item.mcpKey,
        mcpKey: item.mcpKey,
        name: item.name || titleizeKey(item.mcpKey),
        description: item.description || '',
        enabled_by_default: item.active,
        command: typeof config.command === 'string' ? config.command : '',
        args: asArray(config.args).map((arg) => String(arg)),
        http_url: typeof config.http_url === 'string' ? config.http_url : '',
        env_keys: Object.keys(env),
        connected_brands: connectedBrands,
        connected_brand_count: connectedBrands.length,
        transport: item.transport,
        objectKey: item.objectKey,
        metadata: asObject(item.metadata),
        config,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function getPortalModelConnections(ref) {
  return Object.values(state.portalAppDetails)
    .filter(Boolean)
    .flatMap((detail) => {
      const app = detail?.app;
      if (!app) return [];
      return asArray(detail.modelBindings)
        .filter((item) => item.modelRef === ref && item.enabled)
        .map(() => ({
          brand_id: app.appName,
          display_name: app.displayName,
          status: app.status,
        }));
    });
}

function getMergedModelCatalog() {
  return state.modelCatalog
    .map((item) => {
      const connectedBrands = getPortalModelConnections(item.ref);
      return {
        ...item,
        input: asStringArray(item.input),
        connectedBrands,
        connected_brand_count: connectedBrands.length,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
}

function getCapabilityFilterOptions() {
  const skills = getMergedSkills();
  const mcpServers = getMergedMcpServers();
  const models = getMergedModelCatalog();
  const categories = Array.from(
    new Set(
      skills
        .map((item) => String(item.category || '').trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const skillBrands = Array.from(
    new Map(
      skills
        .flatMap((item) => asArray(item.connectedBrands))
        .map((brand) => [brand.brand_id, brand]),
    ).values(),
  ).sort((left, right) => String(left.display_name || '').localeCompare(String(right.display_name || ''), 'zh-CN'));
  const mcpBrands = Array.from(
    new Map(
      mcpServers
        .flatMap((item) => asArray(item.connected_brands))
        .map((brand) => [brand.brand_id, brand]),
    ).values(),
  ).sort((left, right) => String(left.display_name || '').localeCompare(String(right.display_name || ''), 'zh-CN'));
  const transports = Array.from(
    new Set(
      mcpServers
        .map((item) => String(item.transport || '').trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const modelProviders = Array.from(
    new Set(
      models
        .map((item) => String(item.providerId || '').trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const modelBrands = Array.from(
    new Map(
      models
        .flatMap((item) => asArray(item.connectedBrands))
        .map((brand) => [brand.brand_id, brand]),
    ).values(),
  ).sort((left, right) => String(left.display_name || '').localeCompare(String(right.display_name || ''), 'zh-CN'));

  return {
    categories,
    skillBrands,
    mcpBrands,
    transports,
    modelProviders,
    modelBrands,
  };
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
  return {
    surfaces: brand?._surfaceCount ?? surfaces.length,
    skills: brand?._skillCount ?? 0,
    mcpServers: brand?._mcpCount ?? 0,
    models: brand?._modelCount ?? 0,
    pendingChanges: false,
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

async function apiUploadBinary(path, file, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.tokens?.access_token) {
    headers.set('Authorization', `Bearer ${state.tokens.access_token}`);
  }
  headers.set('Content-Type', options.contentType || file.type || 'application/octet-stream');
  headers.set('x-iclaw-file-name', file.name || 'artifact.bin');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers,
    body: file,
  });

  if (response.status === 401 && state.tokens?.refresh_token) {
    const refreshed = await refreshToken().catch(() => false);
    if (refreshed) {
      return apiUploadBinary(path, file, options);
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
  const modelConfig = asObject(capabilities.models);
  const modelBindings = asArray(detail?.modelBindings);
  const selectedModels = modelBindings
    .filter((item) => item?.enabled)
    .map((item) => String(item.modelRef || '').trim())
    .filter(Boolean);
  const modelEntries = selectedModels
    .map((ref) => getModelCatalogEntry(ref) || asObject(modelBindings.find((item) => item.modelRef === ref)?.model))
    .filter((item) => item && typeof item === 'object');
  const recommendedModelsFromBindings = modelBindings
    .filter((item) => item?.enabled && asObject(item.config).recommended === true)
    .map((item) => String(item.modelRef || '').trim())
    .filter(Boolean);
  const defaultModelFromBindings =
    modelBindings.find((item) => item?.enabled && asObject(item.config).default === true)?.modelRef || '';
  const surfaceEntries = asObject(draftConfig.surfaces);
  const orderedSurfaceKeys = Array.from(
    new Set([
      ...DEFAULT_SURFACE_KEYS,
      ...Object.keys(surfaceEntries),
    ]),
  );
  const selectedMenus = mergeMenuBindings(detail?.menuBindings)
    .filter((item) => item.enabled)
    .map((item) => item.menuKey);
  const menuConfigs = Object.fromEntries(
    mergeMenuBindings(detail?.menuBindings).map((item) => [item.menuKey, normalizeMenuDraftConfig(item.config)]),
  );
  const menuOrder = buildDefaultMenuOrder(detail?.menuBindings);
  const selectedComposerControls = mergeComposerControlBindings(detail?.composerControlBindings)
    .filter((item) => item.enabled)
    .map((item) => item.controlKey);
  const composerControlConfigs = Object.fromEntries(
    mergeComposerControlBindings(detail?.composerControlBindings).map((item) => [
      item.controlKey,
      normalizeComposerControlDraftConfig(item.config),
    ]),
  );
  const composerControlOrder = mergeComposerControlBindings(detail?.composerControlBindings)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.controlKey.localeCompare(right.controlKey, 'zh-CN'))
    .map((item) => item.controlKey);
  const selectedComposerShortcuts = mergeComposerShortcutBindings(detail?.composerShortcutBindings)
    .filter((item) => item.enabled)
    .map((item) => item.shortcutKey);
  const composerShortcutConfigs = Object.fromEntries(
    mergeComposerShortcutBindings(detail?.composerShortcutBindings).map((item) => [
      item.shortcutKey,
      normalizeComposerShortcutDraftConfig(item.config),
    ]),
  );
  const composerShortcutOrder = mergeComposerShortcutBindings(detail?.composerShortcutBindings)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.shortcutKey.localeCompare(right.shortcutKey, 'zh-CN'))
    .map((item) => item.shortcutKey);
  const meta = getAppBrandMeta(brand);
  const welcomeSurface = asObject(surfaceEntries.welcome);
  const welcomeConfig = normalizeWelcomeSurfaceConfig(asObject(welcomeSurface.config));

  return {
    brandId: brand?.brandId || '',
    displayName: brand?.displayName || '',
    productName: meta.productName || brand?.productName || '',
    tenantKey: meta.tenantKey || brand?.tenantKey || '',
    status: brand?.status || 'active',
    advancedJson: JSON.stringify(draftConfig, null, 2),
    theme: {
      lightPrimary: lightTheme.primary || '',
      lightPrimaryHover: lightTheme.primaryHover || '',
      lightOnPrimary: lightTheme.onPrimary || '',
      darkPrimary: darkTheme.primary || '',
      darkPrimaryHover: darkTheme.primaryHover || '',
      darkOnPrimary: darkTheme.onPrimary || '',
    },
    selectedSkills: ensurePlatformManagedSkillSelection(
      asArray(detail?.skillBindings).filter((item) => item.enabled).map((item) => item.skillSlug),
      detail,
    ),
    selectedMcp: asArray(detail?.mcpBindings).filter((item) => item.enabled).map((item) => item.mcpKey),
    selectedMenus,
    menuConfigs,
    menuOrder,
    selectedComposerControls,
    composerControlConfigs,
    composerControlOrder,
    selectedComposerShortcuts,
    composerShortcutConfigs,
    composerShortcutOrder,
    selectedModels,
    recommendedModels: (recommendedModelsFromBindings.length
      ? recommendedModelsFromBindings
      : asStringArray(modelConfig.recommended)
    ).filter((ref) => selectedModels.includes(ref)),
    defaultModel: defaultModelFromBindings || (typeof modelConfig.default === 'string' && modelConfig.default.trim()) || selectedModels[0] || '',
    savedModelEntries: modelEntries.map((item) => clone(asObject(item))),
    agentsText: asStringArray(capabilities.agents).join('\n'),
    menusText: selectedMenus.join('\n'),
    welcome: {
      enabled: welcomeSurface.enabled !== false,
      ...welcomeConfig,
    },
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

function mergeCheckedValues(form, selector, existingValues) {
  const inputs = Array.from(form.querySelectorAll(selector));
  const next = new Set(asStringArray(existingValues));
  if (!inputs.length) {
    return Array.from(next);
  }
  inputs.forEach((node) => {
    const value = String(node.value || '').trim();
    if (!value) return;
    if (node.checked) {
      next.add(value);
    } else {
      next.delete(value);
    }
  });
  return Array.from(next);
}

function captureBrandEditorBuffer() {
  const form = document.querySelector('#brand-editor-form');
  if (!form) {
    return state.brandDraftBuffer;
  }

  const data = new FormData(form);
  const existing = clone(state.brandDraftBuffer || ensureBrandDraftBuffer() || {});
  const visibleSurfaces = Array.from(form.querySelectorAll('.surface-editor')).map((node) => ({
    key: node.getAttribute('data-surface-key') || '',
    label: node.getAttribute('data-surface-label') || '',
    enabled: Boolean(node.querySelector('input[type="checkbox"]')?.checked),
    json: String(node.querySelector('textarea')?.value || '{}'),
  }));
  const surfaceMap = new Map(asArray(existing.surfaces).map((item) => [item.key, clone(item)]));
  visibleSurfaces.forEach((surface) => {
    if (!surface.key) return;
    surfaceMap.set(surface.key, surface);
  });
  const menuConfigs = {...asObject(existing.menuConfigs)};
  for (const item of getMenuCatalogItems()) {
    const key = item.key;
    menuConfigs[key] = normalizeMenuDraftConfig({
      ...(asObject(menuConfigs[key])),
      display_name: form.querySelector(`[name="menu_display_name__${CSS.escape(key)}"]`) instanceof HTMLInputElement
        ? form.querySelector(`[name="menu_display_name__${CSS.escape(key)}"]`).value
        : asObject(menuConfigs[key]).displayName,
      group_label: form.querySelector(`[name="menu_group__${CSS.escape(key)}"]`) instanceof HTMLInputElement
        ? form.querySelector(`[name="menu_group__${CSS.escape(key)}"]`).value
        : asObject(menuConfigs[key]).group,
      icon_key: form.querySelector(`[name="menu_icon__${CSS.escape(key)}"]`) instanceof HTMLSelectElement
        ? form.querySelector(`[name="menu_icon__${CSS.escape(key)}"]`).value
        : asObject(menuConfigs[key]).iconKey,
      requires: {
        skill_slug:
          form.querySelector(`[name="menu_requires_skill__${CSS.escape(key)}"]`) instanceof HTMLSelectElement
            ? form.querySelector(`[name="menu_requires_skill__${CSS.escape(key)}"]`).value
            : asObject(asObject(menuConfigs[key]).requires).skill_slug,
        mcp_key:
          form.querySelector(`[name="menu_requires_mcp__${CSS.escape(key)}"]`) instanceof HTMLSelectElement
            ? form.querySelector(`[name="menu_requires_mcp__${CSS.escape(key)}"]`).value
            : asObject(asObject(menuConfigs[key]).requires).mcp_key,
        model_ref:
          form.querySelector(`[name="menu_requires_model__${CSS.escape(key)}"]`) instanceof HTMLSelectElement
            ? form.querySelector(`[name="menu_requires_model__${CSS.escape(key)}"]`).value
            : asObject(asObject(menuConfigs[key]).requires).model_ref,
      },
    });
  }
  const composerControlConfigs = {...asObject(existing.composerControlConfigs)};
  for (const item of getComposerControlCatalogItems()) {
    const key = item.controlKey;
    const displayNameInput = form.querySelector(`[name="composer_control_display_name__${CSS.escape(key)}"]`);
    const allowedOptionsInput = form.querySelector(`[name="composer_control_allowed_options__${CSS.escape(key)}"]`);
    composerControlConfigs[key] = normalizeComposerControlDraftConfig({
      ...(asObject(composerControlConfigs[key])),
      display_name:
        displayNameInput instanceof HTMLInputElement
          ? displayNameInput.value
          : asObject(composerControlConfigs[key]).displayName,
      allowed_option_values:
        allowedOptionsInput instanceof HTMLInputElement
          ? splitLines(allowedOptionsInput.value)
          : asObject(composerControlConfigs[key]).allowedOptionValues,
    });
  }
  const composerShortcutConfigs = {...asObject(existing.composerShortcutConfigs)};
  for (const item of getComposerShortcutCatalogItems()) {
    const key = item.shortcutKey;
    const displayNameInput = form.querySelector(`[name="composer_shortcut_display_name__${CSS.escape(key)}"]`);
    const descriptionInput = form.querySelector(`[name="composer_shortcut_description__${CSS.escape(key)}"]`);
    const templateInput = form.querySelector(`[name="composer_shortcut_template__${CSS.escape(key)}"]`);
    composerShortcutConfigs[key] = normalizeComposerShortcutDraftConfig({
      ...(asObject(composerShortcutConfigs[key])),
      display_name:
        displayNameInput instanceof HTMLInputElement
          ? displayNameInput.value
          : asObject(composerShortcutConfigs[key]).displayName,
      description:
        descriptionInput instanceof HTMLInputElement
          ? descriptionInput.value
          : asObject(composerShortcutConfigs[key]).description,
      template:
        templateInput instanceof HTMLTextAreaElement
          ? templateInput.value
          : asObject(composerShortcutConfigs[key]).template,
    });
  }
  const welcomeEnabledInput = form.querySelector('[name="welcome_enabled"]');
  const welcomeQuickActions = Array.from({length: 4}, (_, index) => ({
    label:
      form.querySelector(`[name="welcome_quick_action_label__${index}"]`) instanceof HTMLInputElement
        ? form.querySelector(`[name="welcome_quick_action_label__${index}"]`).value
        : asArray(existing.welcome?.quickActions)[index]?.label,
    prompt:
      form.querySelector(`[name="welcome_quick_action_prompt__${index}"]`) instanceof HTMLTextAreaElement
        ? form.querySelector(`[name="welcome_quick_action_prompt__${index}"]`).value
        : asArray(existing.welcome?.quickActions)[index]?.prompt,
    iconKey:
      form.querySelector(`[name="welcome_quick_action_icon__${index}"]`) instanceof HTMLSelectElement
        ? form.querySelector(`[name="welcome_quick_action_icon__${index}"]`).value
        : asArray(existing.welcome?.quickActions)[index]?.iconKey,
  }));
  const welcome = normalizeWelcomeSurfaceConfig({
    kol_name:
      form.querySelector('[name="welcome_kol_name"]') instanceof HTMLInputElement
        ? form.querySelector('[name="welcome_kol_name"]').value
        : existing.welcome?.kolName,
    expert_name:
      form.querySelector('[name="welcome_expert_name"]') instanceof HTMLInputElement
        ? form.querySelector('[name="welcome_expert_name"]').value
        : existing.welcome?.expertName,
    slogan:
      form.querySelector('[name="welcome_slogan"]') instanceof HTMLInputElement
        ? form.querySelector('[name="welcome_slogan"]').value
        : existing.welcome?.slogan,
    avatar_url:
      form.querySelector('[name="welcome_avatar_url"]') instanceof HTMLInputElement
        ? form.querySelector('[name="welcome_avatar_url"]').value
        : existing.welcome?.avatarUrl,
    background_image_url:
      form.querySelector('[name="welcome_background_image_url"]') instanceof HTMLInputElement
        ? form.querySelector('[name="welcome_background_image_url"]').value
        : existing.welcome?.backgroundImageUrl,
    primary_color:
      form.querySelector('[name="welcome_primary_color"]') instanceof HTMLInputElement
        ? form.querySelector('[name="welcome_primary_color"]').value
        : existing.welcome?.primaryColor,
    description:
      form.querySelector('[name="welcome_description"]') instanceof HTMLTextAreaElement
        ? form.querySelector('[name="welcome_description"]').value
        : existing.welcome?.description,
    expertise_areas:
      form.querySelector('[name="welcome_expertise_areas"]') instanceof HTMLTextAreaElement
        ? splitLines(form.querySelector('[name="welcome_expertise_areas"]').value)
        : existing.welcome?.expertiseAreas,
    target_audience:
      form.querySelector('[name="welcome_target_audience"]') instanceof HTMLTextAreaElement
        ? form.querySelector('[name="welcome_target_audience"]').value
        : existing.welcome?.targetAudience,
    disclaimer:
      form.querySelector('[name="welcome_disclaimer"]') instanceof HTMLTextAreaElement
        ? form.querySelector('[name="welcome_disclaimer"]').value
        : existing.welcome?.disclaimer,
    quick_actions: welcomeQuickActions,
  });
  if (form.querySelector('[name="welcome_enabled"]') || form.querySelector('[name="welcome_kol_name"]')) {
    surfaceMap.set('welcome', {
      key: 'welcome',
      label: surfaceLabel('welcome'),
      enabled: welcomeEnabledInput instanceof HTMLInputElement ? welcomeEnabledInput.checked : existing.welcome?.enabled !== false,
      json: JSON.stringify(buildWelcomeSurfaceConfigFromBuffer(welcome), null, 2),
    });
  }
  const surfaces = Array.from(surfaceMap.values());

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
    // Capability switches are managed through in-memory draft state.
    // Do not recompute them from hidden checkbox markup during save, otherwise
    // stale DOM can overwrite the latest toggle state back to old values.
    selectedSkills: ensurePlatformManagedSkillSelection(existing.selectedSkills, state.brandDetail),
    selectedMcp: asStringArray(existing.selectedMcp),
    selectedMenus: asStringArray(existing.selectedMenus),
    menuConfigs,
    menuOrder: buildOrderedMenuList(existing.menuOrder),
    selectedComposerControls: asStringArray(existing.selectedComposerControls),
    composerControlConfigs,
    composerControlOrder: buildOrderedComposerControlList(existing.composerControlOrder),
    selectedComposerShortcuts: asStringArray(existing.selectedComposerShortcuts),
    composerShortcutConfigs,
    composerShortcutOrder: buildOrderedComposerShortcutList(existing.composerShortcutOrder),
    selectedModels: asStringArray(existing.selectedModels),
    recommendedModels: asStringArray(existing.recommendedModels),
    defaultModel: form.querySelector('[name="default_model"]')
      ? String(data.get('default_model') || existing.defaultModel || '')
      : String(existing.defaultModel || ''),
    savedModelEntries: asArray(existing.savedModelEntries).map((item) => clone(asObject(item))),
    agentsText: form.querySelector('[name="agents_text"]')
      ? String(data.get('agents_text') || existing.agentsText || '')
      : String(existing.agentsText || ''),
    menusText: form.querySelector('[name="menus_text"]')
      ? String(data.get('menus_text') || existing.menusText || '')
      : String(existing.menusText || ''),
    welcome: {
      enabled: welcomeEnabledInput instanceof HTMLInputElement ? welcomeEnabledInput.checked : existing.welcome?.enabled !== false,
      ...welcome,
    },
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
  const brandMetaSnake = asObject(draftConfig.brand_meta);
  const brandMetaCamel = asObject(draftConfig.brandMeta);
  const nextProductName = buffer.productName.trim();
  const nextTenantKey = buffer.tenantKey.trim() || buffer.brandId.trim();
  draftConfig.brand_meta = {
    ...brandMetaSnake,
    brand_id: buffer.brandId.trim(),
    display_name: buffer.displayName.trim(),
    product_name: nextProductName,
    tenant_key: nextTenantKey,
    legal_name: String(brandMetaSnake.legal_name || draftConfig.legalName || draftConfig.legal_name || buffer.displayName.trim()).trim(),
    storage_namespace: String(brandMetaSnake.storage_namespace || asObject(draftConfig.storage).namespace || nextTenantKey).trim(),
  };
  draftConfig.brandMeta = {
    ...brandMetaCamel,
    productName: nextProductName,
    tenantKey: nextTenantKey,
  };
  draftConfig.productName = nextProductName;
  draftConfig.product_name = nextProductName;
  draftConfig.tenantKey = nextTenantKey;
  draftConfig.tenant_key = nextTenantKey;
  draftConfig.capabilities = {
    ...asObject(draftConfig.capabilities),
    skills: [...buffer.selectedSkills],
    mcp_servers: [...buffer.selectedMcp],
    menus: [...buffer.selectedMenus],
    models: {
      default: buffer.defaultModel || null,
      recommended: buffer.recommendedModels.filter((ref) => buffer.selectedModels.includes(ref)),
      entries: buffer.selectedModels
        .map((ref) => getModelCatalogEntry(ref) || asObject(buffer.savedModelEntries.find((item) => asObject(item).ref === ref)))
        .filter((item) => item && typeof item === 'object')
        .map((item) => clone(item)),
    },
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
  const models = getMergedModelCatalog();
  if (!skills.find((item) => item.slug === state.selectedSkillSlug)) {
    state.selectedSkillSlug = skills[0]?.slug || '';
  }
  if (!mcpServers.find((item) => item.key === state.selectedMcpKey)) {
    state.selectedMcpKey = mcpServers[0]?.key || '';
  }
  if (!models.find((item) => item.ref === state.selectedModelRef)) {
    state.selectedModelRef = models[0]?.ref || '';
  }
}

function resetCapabilityFilters() {
  state.filters.capabilityQuery = '';
  state.filters.capabilitySkillStatus = 'all';
  state.filters.capabilitySkillCategory = 'all';
  state.filters.capabilitySkillBrand = 'all';
  state.filters.capabilityMcpStatus = 'all';
  state.filters.capabilityMcpTransport = 'all';
  state.filters.capabilityMcpBrand = 'all';
  state.filters.capabilityModelStatus = 'all';
  state.filters.capabilityModelProvider = 'all';
  state.filters.capabilityModelBrand = 'all';
}

function syncSupplementalSelection() {
  if (!state.selectedAgentSlug || (!state.agentCatalog.find((item) => item.slug === state.selectedAgentSlug) && state.selectedAgentSlug !== '__new__')) {
    state.selectedAgentSlug = state.agentCatalog[0]?.slug || '';
  }
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
    const [appsData, agentCatalogData, skillCatalogData, mcpCatalogData, modelCatalogData, menuCatalogData, composerControlCatalogData, composerShortcutCatalogData, cloudSkillCatalogData, skillSyncSourcesData, skillSyncRunsData] = await Promise.all([
      apiFetch('/admin/portal/apps', {method: 'GET'}),
      apiFetch('/admin/agents/catalog', {method: 'GET'}),
      apiFetch('/admin/portal/catalog/skills', {method: 'GET'}),
      apiFetch('/admin/portal/catalog/mcps', {method: 'GET'}),
      apiFetch('/admin/portal/catalog/models', {method: 'GET'}),
      apiFetch('/admin/portal/catalog/menus', {method: 'GET'}),
      apiFetch('/admin/portal/catalog/composer-controls', {method: 'GET'}),
      apiFetch('/admin/portal/catalog/composer-shortcuts', {method: 'GET'}),
      apiFetch('/admin/skills/catalog', {method: 'GET'}),
      apiFetch('/admin/skills/sync/sources', {method: 'GET'}),
      apiFetch('/admin/skills/sync/runs', {method: 'GET'}),
    ]);
    const apps = Array.isArray(appsData.items) ? appsData.items : [];
    const details = await Promise.all(
      apps.map(async (app) => {
        const detail = await apiFetch(`/admin/portal/apps/${encodeURIComponent(app.appName)}`, {method: 'GET'});
        return [app.appName, detail];
      }),
    );
    const detailsMap = Object.fromEntries(details);

    state.portalAppDetails = detailsMap;
    state.agentCatalog = Array.isArray(agentCatalogData.items) ? agentCatalogData.items : [];
    state.skillCatalog = Array.isArray(skillCatalogData.items) ? skillCatalogData.items : [];
    state.cloudSkillCatalog = Array.isArray(cloudSkillCatalogData.items) ? cloudSkillCatalogData.items : [];
    state.mcpCatalog = Array.isArray(mcpCatalogData.items) ? mcpCatalogData.items : [];
    state.modelCatalog = Array.isArray(modelCatalogData.items) ? modelCatalogData.items : [];
    state.menuCatalog = Array.isArray(menuCatalogData.items)
      ? menuCatalogData.items.map((item, index) => normalizeMenuCatalogItem(item, index)).filter(Boolean)
      : [];
    state.composerControlCatalog = Array.isArray(composerControlCatalogData.items)
      ? composerControlCatalogData.items.map((item, index) => normalizeComposerControlCatalogItem(item, index)).filter(Boolean)
      : [];
    state.composerShortcutCatalog = Array.isArray(composerShortcutCatalogData.items)
      ? composerShortcutCatalogData.items.map((item, index) => normalizeComposerShortcutCatalogItem(item, index)).filter(Boolean)
      : [];
    state.skillSyncSources = Array.isArray(skillSyncSourcesData.items) ? skillSyncSourcesData.items : [];
    state.skillSyncRuns = Array.isArray(skillSyncRunsData.items) ? skillSyncRunsData.items : [];
    state.personalSkillCatalog = [];
    state.skillLibrary = [];
    state.brands = apps.map((app) => mapPortalAppToBrand(app, detailsMap[app.appName]));
    state.dashboard = buildPortalDashboard(apps, state.skillCatalog, state.mcpCatalog, detailsMap);
    const adaptedDetails = Object.values(detailsMap).map((detail) => adaptPortalDetail(detail)).filter(Boolean);
    state.capabilities = {
      brands: state.brands,
      skills: state.skillCatalog.map((item) => ({
        ...item,
        brand_count: getPortalSkillConnections(item.slug).length,
        connectedBrands: getPortalSkillConnections(item.slug),
      })),
      mcp_servers: state.mcpCatalog.map((item) => ({
        key: item.mcpKey,
        mcpKey: item.mcpKey,
        name: item.name,
        description: item.description,
        connected_brand_count: getPortalMcpConnections(item.mcpKey).length,
        connected_brands: getPortalMcpConnections(item.mcpKey),
        enabled_by_default: item.active,
        transport: item.transport,
      })),
      models: getMergedModelCatalog(),
    };
    state.assets = adaptedDetails.flatMap((detail) => detail.assets || []);
    state.releases = adaptedDetails.flatMap((detail) =>
      asArray(detail.versions).map((item) => ({
        id: item.id,
        brand_id: detail.brand.brandId,
        display_name: detail.brand.displayName,
        version: item.version,
        published_at: item.publishedAt,
        created_by_name: item.createdByName,
        created_by_username: item.createdByUsername,
        changed_areas: ['config', 'skills', 'mcps', 'menus', 'assets'],
        surfaces: Object.keys(asObject(detail.brand.draftConfig?.surfaces || {})).filter(
          (key) => asObject(asObject(detail.brand.draftConfig?.surfaces || {})[key]).enabled !== false,
        ),
        skill_count: asArray(detail.skillBindings).filter((entry) => entry.enabled).length,
        mcp_count: asArray(detail.mcpBindings).filter((entry) => entry.enabled).length,
        config: asObject(item.config),
      })),
    );
    state.audit = adaptedDetails.flatMap((detail) => detail.audit || []);

    if (!state.selectedBrandId || !state.brands.find((brand) => brand.brandId === state.selectedBrandId)) {
      state.selectedBrandId = state.brands[0]?.brandId || '';
    }
    if (!state.selectedCloudSkillSlug || !state.cloudSkillCatalog.find((item) => item.slug === state.selectedCloudSkillSlug)) {
      state.selectedCloudSkillSlug = state.cloudSkillCatalog[0]?.slug || '';
    }
    if (!state.selectedSkillSyncSourceId || !state.skillSyncSources.find((item) => item.id === state.selectedSkillSyncSourceId)) {
      state.selectedSkillSyncSourceId = state.skillSyncSources[0]?.id || '';
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
    const detail =
      state.portalAppDetails[brandId] || (await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}`, {method: 'GET'}));
    state.portalAppDetails[brandId] = detail;
    const data = adaptPortalDetail(detail);
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

async function saveBrandEditor(form) {
  const snapshot = captureBrandEditorBuffer();
  snapshot.selectedSkills = ensurePlatformManagedSkillSelection(
    snapshot.selectedSkills,
    state.portalAppDetails[snapshot.brandId] || state.brandDetail,
  );
  let draftConfig;
  try {
    draftConfig = composeDraftConfig(snapshot);
  } catch (error) {
    setError(error instanceof Error ? error.message : '品牌配置不是合法 JSON');
    return false;
  }

  state.busy = true;
  resetBanner();
  render();

  try {
    const detail = state.portalAppDetails[snapshot.brandId] || {};
    const existingSkillBindings = new Map(asArray(detail.skillBindings).map((item) => [item.skillSlug, item]));
    const existingMcpBindings = new Map(asArray(detail.mcpBindings).map((item) => [item.mcpKey, item]));
    const existingModelBindings = new Map(asArray(detail.modelBindings).map((item) => [item.modelRef, item]));
    const existingMenuBindings = new Map(mergeMenuBindings(detail.menuBindings).map((item) => [item.menuKey, item]));
    const existingComposerControlBindings = new Map(
      mergeComposerControlBindings(detail.composerControlBindings).map((item) => [item.controlKey, item]),
    );
    const existingComposerShortcutBindings = new Map(
      mergeComposerShortcutBindings(detail.composerShortcutBindings).map((item) => [item.shortcutKey, item]),
    );
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        displayName: snapshot.displayName,
        status: snapshot.status === 'disabled' ? 'disabled' : 'active',
        defaultLocale: 'zh-CN',
        config: draftConfig,
      }),
    });
    await Promise.all([
      apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}/skills`, {
        method: 'PUT',
        body: JSON.stringify(
          state.skillCatalog.map((item, index) => ({
            skillSlug: item.slug,
            enabled: snapshot.selectedSkills.includes(item.slug),
            sortOrder: (index + 1) * 10,
            config: asObject(existingSkillBindings.get(item.slug)?.config),
          })),
        ),
      }),
      apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}/mcps`, {
        method: 'PUT',
        body: JSON.stringify(
          state.mcpCatalog.map((item, index) => ({
            mcpKey: item.mcpKey,
            enabled: snapshot.selectedMcp.includes(item.mcpKey),
            sortOrder: (index + 1) * 10,
            config: asObject(existingMcpBindings.get(item.mcpKey)?.config),
          })),
        ),
      }),
      apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}/models`, {
        method: 'PUT',
        body: JSON.stringify(
          state.modelCatalog.map((item, index) => ({
            modelRef: item.ref,
            enabled: snapshot.selectedModels.includes(item.ref),
            sortOrder: (index + 1) * 10,
            recommended: snapshot.recommendedModels.includes(item.ref),
            default: snapshot.defaultModel === item.ref,
            config: asObject(existingModelBindings.get(item.ref)?.config),
          })),
        ),
      }),
      apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}/menus`, {
        method: 'PUT',
        body: JSON.stringify(
          buildOrderedMenuList(snapshot.menuOrder).map((menuKey, index) => {
            const item = getMenuDefinition(menuKey) || {key: menuKey};
            return {
              menuKey: item.key,
              enabled: snapshot.selectedMenus.includes(item.key),
              sortOrder: (index + 1) * 10,
              config: buildMenuBindingConfig(
                asObject(existingMenuBindings.get(item.key)?.config),
                asObject(snapshot.menuConfigs)[item.key],
              ),
            };
          }),
        ),
      }),
      apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}/composer-controls`, {
        method: 'PUT',
        body: JSON.stringify(
          buildOrderedComposerControlList(snapshot.composerControlOrder).map((controlKey, index) => ({
            controlKey,
            enabled: snapshot.selectedComposerControls.includes(controlKey),
            sortOrder: (index + 1) * 10,
            config: buildComposerControlBindingConfig(
              asObject(existingComposerControlBindings.get(controlKey)?.config),
              asObject(snapshot.composerControlConfigs)[controlKey],
            ),
          })),
        ),
      }),
      apiFetch(`/admin/portal/apps/${encodeURIComponent(snapshot.brandId)}/composer-shortcuts`, {
        method: 'PUT',
        body: JSON.stringify(
          buildOrderedComposerShortcutList(snapshot.composerShortcutOrder).map((shortcutKey, index) => ({
            shortcutKey,
            enabled: snapshot.selectedComposerShortcuts.includes(shortcutKey),
            sortOrder: (index + 1) * 10,
            config: buildComposerShortcutBindingConfig(
              asObject(existingComposerShortcutBindings.get(shortcutKey)?.config),
              asObject(snapshot.composerShortcutConfigs)[shortcutKey],
            ),
          })),
        ),
      }),
    ]);

    await loadAppData();
    state.route = 'brand-detail';
    await loadBrandDetail(snapshot.brandId, {silent: true, suppressRender: true});
    setNotice(`已保存 ${snapshot.displayName || snapshot.brandId} 的应用配置。`);
    return true;
  } catch (error) {
    setError(error instanceof Error ? error.message : '保存应用配置失败');
    return false;
  } finally {
    state.busy = false;
    render();
  }
}

async function publishCurrentBrand() {
  const brandId = state.selectedBrandId;
  if (!brandId) return;
  const form = document.querySelector('#brand-editor-form');
  if (form instanceof HTMLFormElement) {
    const saved = await saveBrandEditor(form);
    if (!saved) return;
  }
  state.busy = true;
  resetBanner();
  render();
  try {
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/publish`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    await loadAppData();
    state.route = 'brand-detail';
    await loadBrandDetail(brandId, {silent: true, suppressRender: true});
    setNotice(`已发布 ${brandId} 当前快照。`);
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
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(state.selectedBrandId)}/restore`, {
      method: 'POST',
      body: JSON.stringify({version}),
    });
    await loadAppData();
    state.route = 'brand-detail';
    await loadBrandDetail(state.selectedBrandId, {silent: true, suppressRender: true});
    setNotice(`已将 ${state.selectedBrandId} 恢复到 v${version}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '恢复版本失败');
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
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        displayName: displayName,
        status: 'active',
        defaultLocale: 'zh-CN',
        config: {
          productName,
          product_name: productName,
          tenantKey,
          tenant_key: tenantKey,
          brand_meta: {
            brand_id: brandId,
            display_name: displayName || brandId,
            product_name: productName || displayName || brandId,
            tenant_key: tenantKey,
            legal_name: displayName || brandId,
            storage_namespace: tenantKey,
          },
          brandMeta: {
            productName,
            tenantKey,
          },
          surfaces: DEFAULT_SURFACE_KEYS.reduce((accumulator, key) => {
            accumulator[key] = {enabled: true, config: {}};
            return accumulator;
          }, {}),
          theme: {
            light: {},
            dark: {},
          },
        },
      }),
    });
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/menus`, {
      method: 'PUT',
      body: JSON.stringify(
        getMenuCatalogItems().map((item, index) => ({
          menuKey: item.key,
          enabled: isMenuEnabledByDefault(item),
          sortOrder: (index + 1) * 10,
          config: {},
        })),
      ),
    });
    await Promise.all([
      apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/composer-controls`, {
        method: 'PUT',
        body: JSON.stringify(
          getComposerControlCatalogItems().map((item, index) => ({
            controlKey: item.controlKey,
            enabled: item.active !== false,
            sortOrder: (index + 1) * 10,
            config: {},
          })),
        ),
      }),
      apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/composer-shortcuts`, {
        method: 'PUT',
        body: JSON.stringify(
          getComposerShortcutCatalogItems().map((item, index) => ({
            shortcutKey: item.shortcutKey,
            enabled: item.active !== false,
            sortOrder: (index + 1) * 10,
            config: {},
          })),
        ),
      }),
    ]);
    const defaultModel = state.modelCatalog.find((item) => item.ref === 'openai/gpt-5.4') || state.modelCatalog[0] || null;
    if (defaultModel) {
      await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/models`, {
        method: 'PUT',
        body: JSON.stringify(
          state.modelCatalog.map((item, index) => ({
            modelRef: item.ref,
            enabled: item.ref === defaultModel.ref,
            sortOrder: (index + 1) * 10,
            recommended: item.ref === defaultModel.ref,
            default: item.ref === defaultModel.ref,
            config: {},
          })),
        ),
      });
    }
    await loadAppData();
    state.showCreateBrandForm = false;
    state.route = 'brand-detail';
    await loadBrandDetail(brandId, {silent: true, suppressRender: true});
    setNotice(`已创建 OEM 应用 ${displayName || brandId}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '创建 OEM 应用失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function saveAsset(formData) {
  const brandId = String(formData.get('brand_id') || '').trim();
  const assetKey = String(formData.get('asset_key') || '').trim();
  const kind = String(formData.get('kind') || '').trim();
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
    if (!(file instanceof File) || file.size === 0) {
      throw new Error('请选择要上传的资源文件');
    }
    const fileBase64 = await readFileAsBase64(file);
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/assets/${encodeURIComponent(assetKey)}/upload`, {
      method: 'POST',
      body: JSON.stringify({
        content_type: file.type || 'application/octet-stream',
        file_name: file.name,
        file_base64: fileBase64,
        metadata: {
          ...metadata,
          kind,
        },
      }),
    });

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
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/assets/${encodeURIComponent(assetKey)}`, {
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

async function uploadDesktopReleaseFiles(formData) {
  const brandId = String(formData.get('brand_id') || '').trim();
  const channel = String(formData.get('channel') || 'prod').trim() || 'prod';
  if (!brandId) {
    throw new Error('请选择要发布的品牌');
  }

  const slots = [
    ['darwin', 'aarch64', 'installer'],
    ['darwin', 'aarch64', 'updater'],
    ['darwin', 'aarch64', 'signature'],
    ['darwin', 'x64', 'installer'],
    ['darwin', 'x64', 'updater'],
    ['darwin', 'x64', 'signature'],
    ['windows', 'x64', 'installer'],
    ['windows', 'x64', 'updater'],
    ['windows', 'x64', 'signature'],
    ['windows', 'aarch64', 'installer'],
    ['windows', 'aarch64', 'updater'],
    ['windows', 'aarch64', 'signature'],
  ];
  let uploaded = 0;

  for (const [platform, arch, artifactType] of slots) {
    const fieldName = `desktop_file_${platform}_${arch}_${artifactType}`;
    const file = formData.get(fieldName);
    if (!(file instanceof File) || file.size === 0) {
      continue;
    }
    await apiUploadBinary(
      `/admin/portal/apps/${encodeURIComponent(brandId)}/desktop-release/${encodeURIComponent(channel)}/${encodeURIComponent(platform)}/${encodeURIComponent(arch)}/${encodeURIComponent(artifactType)}`,
      file,
      {
        contentType: inferBinaryContentType(file),
      },
    );
    uploaded += 1;
  }

  return uploaded;
}

async function publishDesktopRelease(formData) {
  const brandId = String(formData.get('brand_id') || '').trim();
  const channel = String(formData.get('channel') || 'prod').trim() || 'prod';
  const version = String(formData.get('version') || '').trim();
  const notes = String(formData.get('notes') || '').trim();
  const mandatory = formData.get('mandatory') === 'on';
  const forceUpdateBelowVersion = String(formData.get('force_update_below_version') || '').trim();
  const allowCurrentRunToFinish = formData.get('allow_current_run_to_finish') === 'on';
  const reasonMessage = String(formData.get('reason_message') || '').trim();

  if (!brandId) {
    setError('请选择要发布的品牌');
    return;
  }
  if (!version) {
    setError('请填写桌面版本号');
    return;
  }

  state.busy = true;
  resetBanner();
  render();

  try {
    const uploadedCount = await uploadDesktopReleaseFiles(formData);
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/desktop-release/${encodeURIComponent(channel)}/publish`, {
      method: 'POST',
      body: JSON.stringify({
        version,
        notes: notes || null,
        mandatory,
        force_update_below_version: forceUpdateBelowVersion || null,
        allow_current_run_to_finish: allowCurrentRunToFinish,
        reason_code: mandatory ? 'stability_hotfix' : null,
        reason_message: reasonMessage || null,
      }),
    });
    await loadAppData();
    setNotice(
      uploadedCount > 0
        ? `桌面版本 ${version} 已发布并生效，同时上传了 ${uploadedCount} 个发布文件。`
        : `桌面版本 ${version} 已发布并生效。`,
    );
  } catch (error) {
    setError(error instanceof Error ? error.message : '桌面发布失败');
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
    const skill = getMergedSkills().find((item) => item.slug === slug);
    if (!skill) {
      throw new Error('skill not found');
    }
    await apiFetch(`/admin/portal/catalog/skills/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: skill.name,
        description: skill.description,
        category: skill.category || null,
        publisher: skill.publisher || 'iClaw',
        visibility: skill.visibility || 'showcase',
        object_key: skill.objectKey || null,
        content_sha256: skill.contentSha256 || null,
        metadata: asObject(skill.metadata),
        active: enabled,
      }),
    });
    await loadAppData();
    setNotice(`${slug} 已${enabled ? '上架' : '下架'}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : `技能${enabled ? '上架' : '下架'}失败`);
  } finally {
    state.busy = false;
    render();
  }
}

async function setAgentEnabled(slug, enabled) {
  if (!slug) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    const agent = getAgentCatalogEntry(slug);
    if (!agent) {
      throw new Error('agent not found');
    }
    await apiFetch('/admin/agents/catalog', {
      method: 'PUT',
      body: JSON.stringify({
        slug: agent.slug,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        publisher: agent.publisher,
        featured: agent.featured === true,
        official: agent.official !== false,
        tags: agent.tags || [],
        capabilities: agent.capabilities || [],
        use_cases: agent.use_cases || [],
        metadata: asObject(agent.metadata),
        sort_order: Number(agent.sort_order || 0),
        active: enabled,
      }),
    });
    await loadAppData();
    setNotice(`${slug} 已${enabled ? '启用' : '停用'}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : `Agent${enabled ? '启用' : '停用'}失败`);
  } finally {
    state.busy = false;
    render();
  }
}

async function deleteAgentCatalogEntry(slug) {
  if (!slug) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch(`/admin/agents/catalog?slug=${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    });
    await loadAppData();
    setNotice(`已删除 Agent ${slug}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Agent 删除失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function saveAgentCatalogEntry(formData) {
  state.busy = true;
  resetBanner();
  render();

  try {
    const slug = String(formData.get('slug') || '').trim();
    await apiFetch('/admin/agents/catalog', {
      method: 'PUT',
      body: JSON.stringify({
        slug,
        name: String(formData.get('name') || '').trim(),
        description: String(formData.get('description') || '').trim(),
        category: String(formData.get('category') || '').trim() || 'general',
        publisher: String(formData.get('publisher') || '').trim() || 'admin-web',
        featured: String(formData.get('featured') || 'false') === 'true',
        official: String(formData.get('official') || 'true') === 'true',
        tags: splitLines(formData.get('tags_text')),
        capabilities: splitLines(formData.get('capabilities_text')),
        use_cases: splitLines(formData.get('use_cases_text')),
        metadata: parseJsonText(String(formData.get('metadata_json') || '{}').trim() || '{}', 'Agent metadata'),
        sort_order: Number.parseInt(String(formData.get('sort_order') || '9999').trim() || '9999', 10),
        active: String(formData.get('active') || 'true') === 'true',
      }),
    });
    await loadAppData();
    state.selectedAgentSlug = slug;
    state.showAgentImportPanel = false;
    setNotice(`已保存 Agent ${slug}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Agent 保存失败');
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
    await apiFetch(`/admin/portal/catalog/skills/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    });
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
  state.busy = true;
  resetBanner();
  render();

  try {
    const slug = String(formData.get('slug') || '').trim();
    const artifactFile = formData.get('artifact_file');
    const body = {
      name: String(formData.get('name') || '').trim(),
      description: String(formData.get('description') || '').trim(),
      publisher: String(formData.get('publisher') || '').trim() || 'admin-web',
      category: String(formData.get('category') || '').trim() || null,
      visibility: String(formData.get('visibility') || '').trim() || 'showcase',
      object_key: String(formData.get('object_key') || '').trim() || null,
      metadata: parseJsonText(String(formData.get('metadata_json') || '{}').trim() || '{}', 'Skill metadata'),
      active: String(formData.get('active') || 'true') === 'true',
    };
    if (artifactFile instanceof File && artifactFile.size > 0) {
      body.file_name = artifactFile.name;
      body.content_type = artifactFile.type || 'application/gzip';
      body.file_base64 = await readFileAsBase64(artifactFile);
    }
    await apiFetch(`/admin/portal/catalog/skills/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    await loadAppData();
    state.showSkillImportPanel = false;
    state.selectedSkillSlug = slug;
    setNotice(`已保存技能 ${slug}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '技能保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function setCloudSkillEnabled(slug, enabled) {
  if (!slug) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    const skill = getCloudSkillCatalogEntry(slug);
    if (!skill) {
      throw new Error('cloud skill not found');
    }
    await apiFetch('/admin/skills/catalog', {
      method: 'PUT',
      body: JSON.stringify({
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        visibility: skill.visibility,
        market: skill.market || null,
        category: skill.category || null,
        skill_type: skill.skill_type || null,
        publisher: skill.publisher,
        distribution: skill.distribution,
        tags: skill.tags || [],
        version: skill.version,
        artifact_url: skill.artifact_url || null,
        artifact_format: skill.artifact_format,
        artifact_sha256: skill.artifact_sha256 || null,
        artifact_source_path: skill.artifact_path || null,
        origin_type: skill.origin_type,
        source_url: skill.source_url || null,
        metadata: asObject(skill.metadata),
        active: enabled,
      }),
    });
    await loadAppData();
    setNotice(`${slug} 已${enabled ? '上架' : '下架'}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : `云技能${enabled ? '上架' : '下架'}失败`);
  } finally {
    state.busy = false;
    render();
  }
}

async function saveSkillSyncSource(formData) {
  state.busy = true;
  resetBanner();
  render();

  try {
    const id = String(formData.get('id') || '').trim() || undefined;
    const sourceType = String(formData.get('source_type') || 'github_repo').trim();
    await apiFetch('/admin/skills/sync/sources', {
      method: 'PUT',
      body: JSON.stringify({
        id,
        source_type: sourceType,
        source_key: String(formData.get('source_key') || '').trim(),
        display_name: String(formData.get('display_name') || '').trim(),
        source_url: String(formData.get('source_url') || '').trim(),
        config: parseJsonText(String(formData.get('config_json') || '{}').trim() || '{}', 'Sync source config'),
        active: String(formData.get('active') || 'true') === 'true',
      }),
    });
    await loadAppData();
    state.showSkillSyncSourceForm = false;
    setNotice('已保存同步源。');
  } catch (error) {
    setError(error instanceof Error ? error.message : '同步源保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function runSkillSync(sourceId) {
  if (!sourceId) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    const result = await apiFetch('/admin/skills/sync/run', {
      method: 'POST',
      body: JSON.stringify({
        source_id: sourceId,
      }),
    });
    await loadAppData();
    const summary = asObject(result.summary);
    setNotice(
      `同步完成：新增 ${Number(summary.created || 0)}，更新 ${Number(summary.updated || 0)}，跳过 ${Number(summary.skipped || 0)}。`,
    );
  } catch (error) {
    setError(error instanceof Error ? error.message : '技能同步失败');
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
    const key = String(formData.get('key') || '').trim();
    await apiFetch(`/admin/portal/catalog/mcps/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: String(formData.get('name') || '').trim(),
        description: String(formData.get('description') || '').trim(),
        transport: String(formData.get('transport') || '').trim() || 'config',
        object_key: String(formData.get('object_key') || '').trim() || null,
        config: {
          command: String(formData.get('command') || '').trim() || null,
          args: splitLines(String(formData.get('args_text') || '')),
          http_url: String(formData.get('http_url') || '').trim() || null,
          env: parseEnvText(String(formData.get('env_text') || '')),
        },
        metadata: parseJsonText(String(formData.get('metadata_json') || '{}').trim() || '{}', 'MCP metadata'),
        active: String(formData.get('enabled') || 'true') === 'true',
      }),
    });
    await loadAppData();
    state.selectedMcpKey = key;
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
    await apiFetch(`/admin/portal/catalog/mcps/${encodeURIComponent(key)}`, {
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

async function setModelEnabled(ref, enabled) {
  if (!ref) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    const model = getModelCatalogEntry(ref);
    if (!model) {
      throw new Error('model not found');
    }
    await apiFetch('/admin/portal/catalog/models', {
      method: 'PUT',
      body: JSON.stringify({
        ref: model.ref,
        label: model.label,
        providerId: model.providerId,
        modelId: model.modelId,
        api: model.api,
        baseUrl: model.baseUrl || null,
        useRuntimeOpenai: model.useRuntimeOpenai !== false,
        authHeader: model.authHeader !== false,
        reasoning: model.reasoning === true,
        input: asStringArray(model.input),
        contextWindow: Number(model.contextWindow || 0),
        maxTokens: Number(model.maxTokens || 0),
        metadata: asObject(model.metadata),
        active: enabled,
      }),
    });
    await loadAppData();
    setNotice(`${ref} 已${enabled ? '启用' : '停用'}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : `模型${enabled ? '启用' : '停用'}失败`);
  } finally {
    state.busy = false;
    render();
  }
}

async function saveModelCatalogEntry(formData) {
  state.busy = true;
  resetBanner();
  render();

  try {
    const ref = String(formData.get('ref') || '').trim();
    await apiFetch('/admin/portal/catalog/models', {
      method: 'PUT',
      body: JSON.stringify({
        ref,
        label: String(formData.get('label') || '').trim(),
        providerId: String(formData.get('provider_id') || '').trim(),
        modelId: String(formData.get('model_id') || '').trim(),
        api: String(formData.get('api') || '').trim() || 'openai-completions',
        baseUrl: String(formData.get('base_url') || '').trim() || null,
        useRuntimeOpenai: String(formData.get('use_runtime_openai') || 'true') === 'true',
        authHeader: String(formData.get('auth_header') || 'true') === 'true',
        reasoning: String(formData.get('reasoning') || 'false') === 'true',
        input: splitLines(String(formData.get('input_text') || '')),
        contextWindow: Number(formData.get('context_window') || 0) || 0,
        maxTokens: Number(formData.get('max_tokens') || 0) || 0,
        metadata: parseJsonText(String(formData.get('metadata_json') || '{}').trim() || '{}', 'Model metadata'),
        active: String(formData.get('enabled') || 'true') === 'true',
      }),
    });
    await loadAppData();
    state.selectedModelRef = ref;
    setNotice(`模型 ${ref} 已保存。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '模型保存失败');
  } finally {
    state.busy = false;
    render();
  }
}

async function deleteModelCatalogEntry(ref) {
  if (!ref) return;
  state.busy = true;
  resetBanner();
  render();

  try {
    await apiFetch(`/admin/portal/catalog/models?ref=${encodeURIComponent(ref)}`, {
      method: 'DELETE',
    });
    await loadAppData();
    state.selectedModelRef = '';
    setNotice(`已删除模型 ${ref}。`);
  } catch (error) {
    setError(error instanceof Error ? error.message : '模型删除失败');
  } finally {
    state.busy = false;
    render();
  }
}

function toggleBrandCapability(type, value) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  if (type === 'skill' && isPlatformManagedSkillSlug(value)) {
    return;
  }
  const current =
    type === 'skill'
      ? new Set(buffer.selectedSkills)
      : type === 'mcp'
        ? new Set(buffer.selectedMcp)
        : type === 'menu'
          ? new Set(buffer.selectedMenus)
        : new Set(buffer.selectedModels);
  if (current.has(value)) {
    current.delete(value);
  } else {
    current.add(value);
  }
  if (type === 'skill') {
    buffer.selectedSkills = Array.from(current);
  } else if (type === 'mcp') {
    buffer.selectedMcp = Array.from(current);
  } else if (type === 'menu') {
    buffer.selectedMenus = Array.from(current);
  } else {
    buffer.selectedModels = Array.from(current);
    buffer.recommendedModels = buffer.recommendedModels.filter((ref) => current.has(ref));
    if (!buffer.selectedModels.includes(buffer.defaultModel)) {
      buffer.defaultModel = buffer.selectedModels[0] || '';
    }
  }
  state.brandDraftBuffer = buffer;
  render();
}

function moveBrandMenu(value, direction) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  buffer.menuOrder = moveManageableMenuItem(buffer.menuOrder, value, direction);
  state.brandDraftBuffer = buffer;
  render();
}

function toggleBrandComposerControl(controlKey) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  const current = new Set(asStringArray(buffer.selectedComposerControls));
  if (current.has(controlKey)) {
    current.delete(controlKey);
  } else {
    current.add(controlKey);
  }
  buffer.selectedComposerControls = Array.from(current);
  state.brandDraftBuffer = buffer;
  render();
}

function moveBrandComposerControl(controlKey, direction) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  buffer.composerControlOrder = moveOrderedItem(buffer.composerControlOrder, controlKey, direction, buildOrderedComposerControlList);
  state.brandDraftBuffer = buffer;
  render();
}

function toggleBrandComposerShortcut(shortcutKey) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  const current = new Set(asStringArray(buffer.selectedComposerShortcuts));
  if (current.has(shortcutKey)) {
    current.delete(shortcutKey);
  } else {
    current.add(shortcutKey);
  }
  buffer.selectedComposerShortcuts = Array.from(current);
  state.brandDraftBuffer = buffer;
  render();
}

function moveBrandComposerShortcut(shortcutKey, direction) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer) return;
  buffer.composerShortcutOrder = moveOrderedItem(
    buffer.composerShortcutOrder,
    shortcutKey,
    direction,
    buildOrderedComposerShortcutList,
  );
  state.brandDraftBuffer = buffer;
  render();
}

function toggleBrandRecommendedModel(value) {
  const buffer = captureBrandEditorBuffer() || ensureBrandDraftBuffer();
  if (!buffer || !buffer.selectedModels.includes(value)) return;
  const current = new Set(buffer.recommendedModels);
  if (current.has(value)) {
    current.delete(value);
  } else {
    current.add(value);
  }
  buffer.recommendedModels = Array.from(current);
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
  state.portalAppDetails = {};
  state.brandDetail = null;
  state.brandDraftBuffer = null;
  state.capabilities = null;
  state.skillCatalog = [];
  state.cloudSkillCatalog = [];
  state.personalSkillCatalog = [];
  state.skillLibrary = [];
  state.mcpCatalog = [];
  state.modelCatalog = [];
  state.skillSyncSources = [];
  state.skillSyncRuns = [];
  state.selectedModelRef = '';
  state.selectedCloudSkillSlug = '';
  state.selectedSkillSyncSourceId = '';
  state.selectedReleaseId = '';
  state.selectedAuditId = '';
  state.mcpTestResult = null;
  state.assets = [];
  state.releases = [];
  state.audit = [];
  state.showCreateBrandForm = false;
  state.showSkillImportPanel = false;
  state.showSkillSyncSourceForm = false;
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
  const userName = getUserDisplayName(state.user);
  const avatarUrl = getUserAvatarUrl(state.user);
  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-lockup brand-lockup--sidebar">
          ${renderAdminLogo('brand-mark--sidebar')}
          <div class="brand-lockup__copy">
            <div class="brand-lockup__kicker">iClaw Console</div>
            <h1 class="sidebar-brand__title">iClaw管理控制台</h1>
            <p class="sidebar-brand__copy">企业运营平台</p>
          </div>
        </div>
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
        <div class="sidebar-footer__identity">
          ${
            avatarUrl
              ? `<img class="sidebar-footer__avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(userName)}" />`
              : `<div class="sidebar-footer__avatar sidebar-footer__avatar--fallback">${escapeHtml(getUserInitials(state.user))}</div>`
          }
        <div class="sidebar-footer__meta">
            <div>${escapeHtml(userName)}</div>
          <div>v1.2.4 • 2026年3月</div>
        </div>
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

function renderPageGuide(title, items = [], accent = 'default') {
  const safeItems = items.filter(Boolean).slice(0, 4);
  if (!safeItems.length) {
    return '';
  }
  return `
    <section class="fig-guide fig-guide--${escapeHtml(accent)}">
      <div class="fig-guide__head">
        <span class="fig-guide__eyebrow">操作指南</span>
        <h3>${escapeHtml(title)}</h3>
      </div>
      <div class="fig-guide__grid">
        ${safeItems
          .map(
            (item, index) => `
              <article class="fig-guide__item">
                <span class="fig-guide__index">${index + 1}</span>
                <p>${escapeHtml(item)}</p>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderBrandDetailGuide(activeTab) {
  if (activeTab === 'welcome') {
    return renderPageGuide('Welcome 页怎么配', [
      '这里配置聊天空状态上的 K2C Welcome 页面，用于粉丝看到的 KOL 专属入口。',
      '配置会走 OEM runtime 下发到桌面端，只替换欢迎内容区，不替换现有输入框。',
      '保存后更新草稿，发布快照后对应 OEM 才会切到新的欢迎页内容。',
    ], 'brand');
  }
  if (activeTab === 'assets') {
    return renderPageGuide('品牌资源怎么用', [
      '先给品牌上传 logo、favicon、home 图等资源，asset key 要和前端约定槽位一致。',
      '同一页面可以直接预览当前品牌已登记资源，并跳转打开原文件。',
      '资源保存后若要让客户端吃到最新资源，仍需要保存品牌配置并发布快照。',
    ], 'brand');
  }
  if (activeTab === 'theme') {
    return renderPageGuide('主题样式怎么改', [
      '优先在 Light / Dark Theme 中维护主色、hover 色和文字色。',
      '需要更深度控制时，再用下方高级 JSON 直接编辑完整 draft config。',
      '保存只会更新草稿，发布快照后品牌端才会切到新主题。',
    ], 'brand');
  }
  if (activeTab === 'skills') {
    return renderPageGuide('技能装配怎么配', [
      '技能主数据先在 Skill中心维护，这里只负责给当前 OEM 勾选安装哪些技能。',
      '当前品牌勾选后会进入该品牌的 capabilities.skills 和 skill bindings。',
      '保存配置后再发布快照，客户端同步新 snapshot 后技能入口和运行时能力才会更新。',
    ], 'brand');
  }
  if (activeTab === 'mcps') {
    return renderPageGuide('MCP 装配怎么配', [
      'MCP 主目录先在 MCP中心维护，这里只做当前 OEM 的安装和卸载。',
      '每个 OEM 只应安装自己需要的连接器，避免把无关 MCP 暴露给前端和运行时。',
      '保存配置后再发布快照，客户端同步后才会加载新的 MCP 清单。',
    ], 'brand');
  }
  if (activeTab === 'models') {
    return renderPageGuide('模型 Allowlist 怎么配', [
      '模型全集先在 模型中心 维护，这里只做当前 OEM 的可见模型、默认模型和推荐模型。',
      '勾选的模型就是这个 app 的 allowlist；不勾选，输入框模型选择里就不应该看到。',
      '保存配置并发布快照后，客户端同步 snapshot，必要时重启 sidecar 才会刷新 models.list。',
    ], 'brand');
  }
  if (activeTab === 'menus') {
    return renderPageGuide('左菜单栏怎么配', [
      '这里控制当前 OEM app 的侧边栏菜单显隐，不再和技能、MCP、模型混在一个大 tab 里。',
      '优先配置真实业务入口，如龙虾商店、智能投资专家、安全中心、数据连接等。',
      '保存配置并发布快照后，前端才能按品牌显示不同菜单组合。',
    ], 'brand');
  }
  const surfaceBlueprint = getSurfaceBlueprint(activeTab);
  if (surfaceBlueprint?.kind === 'shell') {
    return renderPageGuide(`${surfaceBlueprint.label}怎么配`, [
      `这里单独维护 ${surfaceBlueprint.label} 的 OEM 配置，不再和其他 UI 位混在一个大 Surface tab 里。`,
      '切换开关控制这个区域是否显示，JSON 区域用于写该区域的装配配置。',
      '保存配置只更新草稿；发布快照后，该 OEM 才会真正切到这套界面配置。',
    ], 'brand');
  }
  if (surfaceBlueprint?.kind === 'module') {
    return renderPageGuide(`${surfaceBlueprint.label}怎么配`, [
      `这里单独维护 ${surfaceBlueprint.label} 这个业务模块，包含入口显隐和模块 surface 配置。`,
      '如果该模块有侧边栏入口，会单独显示模块入口开关；模块内部再维护自己的 surface JSON。',
      '保存配置并发布快照后，该 OEM 才会按品牌显示这块模块能力。',
    ], 'brand');
  }
  return '';
}

function renderOverviewPage() {
  const stats = state.dashboard?.stats || {};
  const releases = state.dashboard?.recent_releases || [];
  const edits = state.dashboard?.recent_edits || [];
  const statCards = [
    ['品牌总数', stats.brands_total, 'portal apps', 'trendingUp'],
    ['已启用', stats.published_count, '运行中', 'checkCircle'],
    ['已禁用', stats.brands_total - stats.published_count, '已关闭', 'clock'],
    ['MCP 服务器', stats.mcp_servers_count, '云端目录', 'network'],
    ['技能', stats.skills_count, '云端目录', 'zap'],
    ['资源索引', state.assets.length, 'portal assets', 'rocket'],
  ];

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>总览</h1>
            <p class="fig-page__description">从统一 control-plane 管理所有 OEM 应用、Skill、MCP 与菜单绑定</p>
          </div>
          <button class="solid-button fig-button" type="button" data-action="navigate" data-page="brands">
            ${icon('plus', 'button-icon')}
            创建新品牌
          </button>
        </div>
      </div>
      <div class="fig-page__body">
        ${renderPageGuide('总览页怎么看', [
          '这里看全局运营面：品牌数、技能数、MCP 数、最近发布和最近编辑。',
          '要新建一个 OEM 应用，先点右上角“创建新品牌”。',
          '要排查最近谁改了什么，直接看“最近编辑”或进审计日志。',
        ], 'overview')}
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
              <p class="fig-page__description">管理 OEM 应用配置、Skill 绑定、MCP 绑定和菜单显隐</p>
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
              ${['all', 'active', 'disabled']
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
        ${renderPageGuide('品牌管理怎么用', [
          '一个品牌就是一个 OEM app，这里负责创建、搜索和进入每个品牌的配置空间。',
          '进入品牌详情后，分别维护 shell 区域、能力绑定、业务模块、资源和主题。',
          '改完先保存配置，再发布快照；不发布，客户端不会切到新配置。',
        ], 'brands')}
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
                    <span>App Name</span>
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
        <div><span>App:</span><code>${escapeHtml(brand.brandId)}</code></div>
      </div>
      <div class="fig-brand-card__footer">
        <span>${escapeHtml(metrics.surfaces)} 个 Surface / ${escapeHtml(metrics.skills)} 个 Skill / ${escapeHtml(metrics.mcpServers)} 个 MCP</span>
        <span>${escapeHtml(formatRelative(brand.updatedAt))}</span>
      </div>
    </button>
  `;
}

function getBrandSurfaceDraft(buffer, key) {
  return (
    asArray(buffer?.surfaces).find((item) => item.key === key) || {
      key,
      label: surfaceLabel(key),
      enabled: true,
      json: '{}',
    }
  );
}

function renderBrandSurfaceEditor(buffer, surfaceKey, title, description) {
  const surface = getBrandSurfaceDraft(buffer, surfaceKey);
  const blueprint = getSurfaceBlueprint(surfaceKey);
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>${escapeHtml(title || surface.label)}</h2>
        <p>${escapeHtml(description || `维护 ${surface.label} 的 OEM 装配配置`)}</p>
      </div>
      <article class="surface-editor fig-surface-card" data-surface-key="${escapeHtml(surface.key)}" data-surface-label="${escapeHtml(surface.label)}">
        <div class="fig-surface-card__preview">
          ${icon(blueprint?.icon || 'layout', 'fig-surface-card__preview-icon')}
        </div>
        <div class="fig-surface-card__body">
          <div class="surface-editor__head fig-surface-card__head">
              <div>
                <h3>${escapeHtml(surface.label)}</h3>
                <p>${visibilityStateLabel(surface.enabled)}</p>
              </div>
            <label class="toggle fig-toggle">
              <input type="checkbox" name="surface_enabled__${escapeHtml(surface.key)}"${surface.enabled ? ' checked' : ''} />
              <span>${visibilityStateLabel(surface.enabled)}</span>
            </label>
          </div>
          <textarea class="code-input code-input--tall" name="surface_config__${escapeHtml(surface.key)}">${escapeHtml(surface.json)}</textarea>
        </div>
      </article>
    </section>
  `;
}

function renderBrandSkillsAssembly(buffer) {
  const skills = getMergedSkills();
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>技能</h2>
        <p>给当前 OEM 应用勾选要安装的技能，技能主数据仍由 Skill中心 统一维护。</p>
      </div>
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>技能装配</h3>
          <span>按品牌控制要安装哪些技能</span>
        </div>
        <div class="fig-capability-stack">
          ${skills.length
            ? skills
                .map(
                  (skill) => {
                    const binding = getSkillBinding(state.brandDetail, skill.slug);
                    const platformManaged = isPlatformManagedSkillBinding(binding);
                    const installed = buffer.selectedSkills.includes(skill.slug);
                    return `
                    <article class="checkbox-card checkbox-card--capability fig-capability-item${platformManaged ? ' is-platform-managed' : ''}">
                      <input class="skill-checkbox visually-hidden" type="checkbox" value="${escapeHtml(skill.slug)}"${installed ? ' checked' : ''} />
                      <div class="fig-capability-item__body">
                        <strong>${escapeHtml(skill.name)}</strong>
                        <span>${escapeHtml(skill.category || '未分类')} · ${escapeHtml(skill.publisher || 'iClaw')}</span>
                        ${platformManaged ? '<div class="metric-chips"><span>平台默认</span><span>OEM 不可修改</span></div>' : ''}
                      </div>
                      ${renderSwitch({
                        checked: installed,
                        action: 'toggle-brand-skill',
                        attrs: `data-skill-slug="${escapeHtml(skill.slug)}"`,
                        label: platformManaged ? '平台默认' : installStateLabel(installed),
                        disabled: platformManaged,
                      })}
                    </article>
                  `;
                  },
                )
                .join('')
            : `<div class="empty-state">当前没有可用技能。</div>`}
        </div>
      </article>
    </section>
  `;
}

function renderBrandMcpAssembly(buffer) {
  const mcpServers = getMergedMcpServers();
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>MCP</h2>
        <p>给当前 OEM 应用勾选要安装的 MCP 连接器，避免把无关外部能力暴露给前端和 runtime。</p>
      </div>
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>MCP 装配</h3>
          <span>按品牌控制要安装哪些连接器</span>
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
                        <span>${escapeHtml(server.transport || 'config')} · ${escapeHtml(server.connected_brand_count)} 个品牌使用</span>
                      </div>
                      ${renderSwitch({
                        checked: buffer.selectedMcp.includes(server.key),
                        action: 'toggle-brand-mcp',
                        attrs: `data-mcp-key="${escapeHtml(server.key)}"`,
                        label: installStateLabel(buffer.selectedMcp.includes(server.key)),
                      })}
                    </article>
                  `,
                )
                .join('')
            : `<div class="empty-state">当前没有 MCP 目录。</div>`}
        </div>
      </article>
    </section>
  `;
}

function renderBrandModelAssembly(buffer) {
  const models = getMergedModelCatalog();
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>模型</h2>
        <p>当前 OEM 应用的模型 allowlist、默认模型和推荐模型都在这里单独配置。</p>
      </div>
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>模型 Allowlist</h3>
          <span>按 OEM 应用控制输入框可见模型、推荐模型和默认模型</span>
        </div>
        <div class="form-grid">
          <label class="field">
            <span>默认模型</span>
            <select class="field-select" name="default_model">
              <option value="">请选择默认模型</option>
              ${buffer.selectedModels
                .map((ref) => {
                  const model = getModelCatalogEntry(ref);
                  const label = model?.label || ref;
                  return `<option value="${escapeHtml(ref)}"${buffer.defaultModel === ref ? ' selected' : ''}>${escapeHtml(label)}</option>`;
                })
                .join('')}
            </select>
          </label>
        </div>
        <div class="fig-capability-stack">
          ${models.length
            ? models
                .map(
                  (model) => `
                    <article class="checkbox-card checkbox-card--capability fig-capability-item">
                      <input class="model-checkbox visually-hidden" type="checkbox" value="${escapeHtml(model.ref)}"${buffer.selectedModels.includes(model.ref) ? ' checked' : ''} />
                      <div>
                        <strong>${escapeHtml(model.label)}</strong>
                        <span>${escapeHtml(model.providerId)} · ${escapeHtml(model.modelId)}</span>
                      </div>
                      <div class="metric-chips">
                        ${renderSwitch({
                          checked: buffer.recommendedModels.includes(model.ref),
                          action: 'toggle-brand-model-recommended',
                          attrs: `data-model-ref="${escapeHtml(model.ref)}"${buffer.selectedModels.includes(model.ref) ? '' : ' disabled'}`,
                          label: '推荐',
                        })}
                        ${renderSwitch({
                          checked: buffer.selectedModels.includes(model.ref),
                          action: 'toggle-brand-model',
                          attrs: `data-model-ref="${escapeHtml(model.ref)}"`,
                          label: buffer.selectedModels.includes(model.ref) ? '已启用' : '已禁用',
                        })}
                      </div>
                    </article>
                  `,
                )
                .join('')
            : `<div class="empty-state">当前没有模型目录。</div>`}
        </div>
      </article>
    </section>
  `;
}

function getOrderedMenuItemsByCategory(buffer, category) {
  const order = buildManageableMenuOrder(buffer.menuOrder);
  return order
    .map((key) => getMenuDefinition(key))
    .filter((item) => item && item.category === category);
}

function renderMenuToggleCard(buffer, item, note) {
  const enabled = buffer.selectedMenus.includes(item.key);
  const editorOrder = buildManageableMenuOrder(buffer.menuOrder);
  const index = editorOrder.indexOf(item.key);
  const menuConfig = normalizeMenuDraftConfig(asObject(asObject(buffer.menuConfigs)[item.key]));
  const skillOptions = getMergedSkills();
  const mcpOptions = getMergedMcpServers();
  const modelOptions = getMergedModelCatalog();
  return `
    <article class="checkbox-card checkbox-card--capability fig-capability-item">
      <input class="menu-checkbox visually-hidden" type="checkbox" value="${escapeHtml(item.key)}"${enabled ? ' checked' : ''} />
      <div class="fig-capability-item__body">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(`Menu ID: ${item.key}${note ? ` · ${note}` : ''}`)}</span>
        </div>
        <div class="fig-menu-card__grid">
          <label class="field fig-inline-field">
            <span>显示名称</span>
            <input
              class="field-input"
              name="menu_display_name__${escapeHtml(item.key)}"
              value="${fieldValue(menuConfig.displayName)}"
              placeholder="${escapeHtml(item.label)}"
            />
          </label>
          <label class="field fig-inline-field">
            <span>分组</span>
            <input
              class="field-input"
              name="menu_group__${escapeHtml(item.key)}"
              value="${fieldValue(menuConfig.group)}"
              placeholder="主体区"
            />
          </label>
          <label class="field fig-inline-field">
            <span>图标</span>
            <select class="field-select" name="menu_icon__${escapeHtml(item.key)}">
              ${getMenuIconOptions().map(
                ([value, label]) =>
                  `<option value="${escapeHtml(value)}"${menuConfig.iconKey === value ? ' selected' : ''}>${escapeHtml(label)}</option>`,
              ).join('')}
            </select>
          </label>
          <label class="field fig-inline-field">
            <span>依赖 Skill</span>
            <select class="field-select" name="menu_requires_skill__${escapeHtml(item.key)}">
              <option value="">无</option>
              ${skillOptions
                .map(
                  (skill) =>
                    `<option value="${escapeHtml(skill.slug)}"${menuConfig.requiresSkillSlug === skill.slug ? ' selected' : ''}>${escapeHtml(skill.name)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="field fig-inline-field">
            <span>依赖 MCP</span>
            <select class="field-select" name="menu_requires_mcp__${escapeHtml(item.key)}">
              <option value="">无</option>
              ${mcpOptions
                .map(
                  (server) =>
                    `<option value="${escapeHtml(server.key)}"${menuConfig.requiresMcpKey === server.key ? ' selected' : ''}>${escapeHtml(server.name)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="field fig-inline-field">
            <span>依赖模型</span>
            <select class="field-select" name="menu_requires_model__${escapeHtml(item.key)}">
              <option value="">无</option>
              ${modelOptions
                .map(
                  (model) =>
                    `<option value="${escapeHtml(model.ref)}"${menuConfig.requiresModelRef === model.ref ? ' selected' : ''}>${escapeHtml(model.label)}</option>`,
                )
                .join('')}
            </select>
          </label>
        </div>
      </div>
      <div class="fig-capability-actions fig-menu-card__actions">
        <span class="chip">排序 ${index + 1}</span>
        <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-menu-up" data-menu-key="${escapeHtml(item.key)}"${index <= 0 ? ' disabled' : ''}>
          ${icon('chevronUp', 'button-icon')}
        </button>
        <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-menu-down" data-menu-key="${escapeHtml(item.key)}"${index < 0 || index >= editorOrder.length - 1 ? ' disabled' : ''}>
          ${icon('chevronDown', 'button-icon')}
        </button>
        ${renderSwitch({
          checked: enabled,
          action: 'toggle-brand-menu',
          attrs: `data-menu-key="${escapeHtml(item.key)}"`,
          label: visibilityStateLabel(enabled),
        })}
      </div>
    </article>
  `;
}

function renderBrandMenusAssembly(buffer) {
  const sidebarItems = getOrderedMenuItemsByCategory(buffer, 'sidebar');
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>左菜单栏</h2>
        <p>这里只维护 OEM 真正暴露给终端用户的左侧入口。历史兼容 key 保留在后端兼容层，不再出现在运营界面。</p>
      </div>
      <div class="fig-capability-columns">
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>OEM 菜单入口</h3>
            <span>对应桌面端 sidebar 主导航，可按 OEM 单独控制显隐、排序和显示名称</span>
          </div>
          <div class="fig-capability-stack">
            ${sidebarItems.map((item) => renderMenuToggleCard(buffer, item, '主导航')).join('')}
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderComposerControlCard(buffer, item, index, total) {
  const enabled = asStringArray(buffer.selectedComposerControls).includes(item.controlKey);
  const config = normalizeComposerControlDraftConfig(asObject(asObject(buffer.composerControlConfigs)[item.controlKey]));
  const allowedValueMap = new Map(item.options.map((option) => [option.optionValue, option]));
  const allowedLabel = config.allowedOptionValues
    .map((value) => allowedValueMap.get(value)?.label || value)
    .join('、');
  return `
    <article class="fig-capability-card fig-menu-card">
      <div class="fig-capability-main">
        <div class="fig-capability-copy">
          <div class="fig-capability-title-row">
            <h3>${escapeHtml(item.displayName)}</h3>
            <span class="chip">${escapeHtml(item.controlType)}</span>
          </div>
          <p>${escapeHtml(item.controlKey)}</p>
        </div>
        <div class="fig-capability-meta">
          <label class="field fig-inline-field">
            <span>显示名称</span>
            <input class="field-input" name="composer_control_display_name__${escapeHtml(item.controlKey)}" value="${fieldValue(config.displayName)}" placeholder="${escapeHtml(item.displayName)}" />
          </label>
          ${
            item.options.length
              ? `
                <label class="field fig-inline-field">
                  <span>允许选项</span>
                  <input class="field-input" name="composer_control_allowed_options__${escapeHtml(item.controlKey)}" value="${fieldValue(config.allowedOptionValues.join(', '))}" placeholder="${escapeHtml(item.options.map((option) => option.optionValue).join(', '))}" />
                </label>
                <div class="fig-capability-inline-note">当前：${escapeHtml(allowedLabel || '全部可选')}</div>
              `
              : `<div class="fig-capability-inline-note">动态控件，不做静态选项过滤。</div>`
          }
        </div>
      </div>
      <div class="fig-capability-actions fig-menu-card__actions">
        <span class="chip">排序 ${index + 1}</span>
        <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-composer-control-up" data-control-key="${escapeHtml(item.controlKey)}"${index <= 0 ? ' disabled' : ''}>
          ${icon('chevronUp', 'button-icon')}
        </button>
        <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-composer-control-down" data-control-key="${escapeHtml(item.controlKey)}"${index >= total - 1 ? ' disabled' : ''}>
          ${icon('chevronDown', 'button-icon')}
        </button>
        ${renderSwitch({
          checked: enabled,
          action: 'toggle-brand-composer-control',
          attrs: `data-control-key="${escapeHtml(item.controlKey)}"`,
          label: visibilityStateLabel(enabled),
        })}
      </div>
    </article>
  `;
}

function renderComposerShortcutCard(buffer, item, index, total) {
  const enabled = asStringArray(buffer.selectedComposerShortcuts).includes(item.shortcutKey);
  const config = normalizeComposerShortcutDraftConfig(asObject(asObject(buffer.composerShortcutConfigs)[item.shortcutKey]));
  return `
    <article class="fig-capability-card fig-menu-card">
      <div class="fig-capability-main">
        <div class="fig-capability-copy">
          <div class="fig-capability-title-row">
            <h3>${escapeHtml(item.displayName)}</h3>
            <span class="chip">${escapeHtml(item.tone || 'default')}</span>
          </div>
          <p>${escapeHtml(item.shortcutKey)}</p>
        </div>
        <div class="fig-capability-meta">
          <label class="field fig-inline-field">
            <span>显示名称</span>
            <input class="field-input" name="composer_shortcut_display_name__${escapeHtml(item.shortcutKey)}" value="${fieldValue(config.displayName)}" placeholder="${escapeHtml(item.displayName)}" />
          </label>
          <label class="field fig-inline-field">
            <span>说明</span>
            <input class="field-input" name="composer_shortcut_description__${escapeHtml(item.shortcutKey)}" value="${fieldValue(config.description)}" placeholder="${escapeHtml(item.description)}" />
          </label>
          <label class="field field--wide">
            <span>快捷模板</span>
            <textarea class="field-textarea" name="composer_shortcut_template__${escapeHtml(item.shortcutKey)}">${escapeHtml(config.template || item.template)}</textarea>
          </label>
        </div>
      </div>
      <div class="fig-capability-actions fig-menu-card__actions">
        <span class="chip">排序 ${index + 1}</span>
        <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-composer-shortcut-up" data-shortcut-key="${escapeHtml(item.shortcutKey)}"${index <= 0 ? ' disabled' : ''}>
          ${icon('chevronUp', 'button-icon')}
        </button>
        <button class="ghost-button fig-icon-button" type="button" data-action="move-brand-composer-shortcut-down" data-shortcut-key="${escapeHtml(item.shortcutKey)}"${index >= total - 1 ? ' disabled' : ''}>
          ${icon('chevronDown', 'button-icon')}
        </button>
        ${renderSwitch({
          checked: enabled,
          action: 'toggle-brand-composer-shortcut',
          attrs: `data-shortcut-key="${escapeHtml(item.shortcutKey)}"`,
          label: visibilityStateLabel(enabled),
        })}
      </div>
    </article>
  `;
}

function renderBrandInputAssembly(buffer) {
  const controls = buildOrderedComposerControlList(buffer.composerControlOrder)
    .map((controlKey) => getComposerControlDefinition(controlKey))
    .filter(Boolean);
  const shortcuts = buildOrderedComposerShortcutList(buffer.composerShortcutOrder)
    .map((shortcutKey) => getComposerShortcutDefinition(shortcutKey))
    .filter(Boolean);
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>输入框</h2>
        <p>第一栏维护顶部快捷选择控件，第三栏维护底部快捷方式；全部走平台目录 + OEM 绑定，不再写死在代码里。</p>
      </div>
      <div class="fig-capability-columns">
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>第一栏快捷选择框</h3>
            <span>控制专家、技能、模式、市场、自选股、输出等顶栏控件的显隐、排序与显示文案</span>
          </div>
          <div class="fig-capability-stack">
            ${controls.length ? controls.map((item, index) => renderComposerControlCard(buffer, item, index, controls.length)).join('') : `<div class="empty-state">还没有输入控件目录。</div>`}
          </div>
        </article>
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>第三栏快捷方式</h3>
            <span>控制底部快捷 chip 的显隐、排序、名称和模板内容</span>
          </div>
          <div class="fig-capability-stack">
            ${shortcuts.length ? shortcuts.map((item, index) => renderComposerShortcutCard(buffer, item, index, shortcuts.length)).join('') : `<div class="empty-state">还没有快捷方式目录。</div>`}
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderBrandWelcomeAssembly(buffer) {
  const welcome = normalizeWelcomeSurfaceConfig(buffer.welcome);
  const enabled = buffer.welcome?.enabled !== false;
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>Welcome页</h2>
        <p>维护聊天空状态里的 K2C 欢迎内容，服务对象是 KOL 的粉丝，输入框仍复用现有聊天输入区。</p>
      </div>
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>显示开关</h3>
          <span>关闭后，空会话时不展示 Welcome 内容卡片。</span>
        </div>
        <label class="toggle fig-toggle">
          <input type="checkbox" name="welcome_enabled"${enabled ? ' checked' : ''} />
          <span>${visibilityStateLabel(enabled)}</span>
        </label>
      </article>
      <div class="fig-capability-columns">
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>KOL 信息</h3>
            <span>配置头像、欢迎语和主视觉颜色。</span>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>KOL 名称</span>
              <input class="field-input" name="welcome_kol_name" value="${fieldValue(welcome.kolName)}" />
            </label>
            <label class="field">
              <span>专家名称</span>
              <input class="field-input" name="welcome_expert_name" value="${fieldValue(welcome.expertName)}" />
            </label>
            <label class="field">
              <span>Slogan</span>
              <input class="field-input" name="welcome_slogan" value="${fieldValue(welcome.slogan)}" />
            </label>
            <label class="field">
              <span>头像 URL</span>
              <input class="field-input" name="welcome_avatar_url" value="${fieldValue(welcome.avatarUrl)}" />
            </label>
            <label class="field">
              <span>背景图 URL</span>
              <input class="field-input" name="welcome_background_image_url" value="${fieldValue(welcome.backgroundImageUrl)}" />
            </label>
            <label class="field">
              <span>主色</span>
              <input class="field-input" name="welcome_primary_color" value="${fieldValue(welcome.primaryColor)}" placeholder="#C4975F" />
            </label>
          </div>
        </article>
        <article class="fig-card fig-card--subtle">
          <div class="fig-card__head">
            <h3>内容文案</h3>
            <span>配置擅长领域、适配人群与免责声明。</span>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>描述文案</span>
              <textarea class="field-textarea" name="welcome_description" rows="4">${fieldValue(welcome.description)}</textarea>
            </label>
            <label class="field">
              <span>擅长领域</span>
              <textarea class="field-textarea" name="welcome_expertise_areas" rows="4" placeholder="每行一个领域">${fieldValue(welcome.expertiseAreas.join('\n'))}</textarea>
            </label>
            <label class="field">
              <span>目标人群</span>
              <textarea class="field-textarea" name="welcome_target_audience" rows="4">${fieldValue(welcome.targetAudience)}</textarea>
            </label>
            <label class="field">
              <span>免责声明</span>
              <textarea class="field-textarea" name="welcome_disclaimer" rows="4">${fieldValue(welcome.disclaimer)}</textarea>
            </label>
          </div>
        </article>
      </div>
      <article class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>快捷问题</h3>
          <span>点击后只填充 prompt，不会自动发送。</span>
        </div>
        <div class="fig-capability-stack">
          ${welcome.quickActions
            .map(
              (item, index) => `
                <article class="checkbox-card checkbox-card--capability fig-capability-item">
                  <div class="fig-capability-item__body">
                    <div>
                      <strong>快捷问题 ${index + 1}</strong>
                      <span>配置卡片标题、图标和 prompt 内容。</span>
                    </div>
                    <div class="fig-menu-card__grid">
                      <label class="field fig-inline-field">
                        <span>标题</span>
                        <input class="field-input" name="welcome_quick_action_label__${index}" value="${fieldValue(item.label)}" />
                      </label>
                      <label class="field fig-inline-field">
                        <span>图标</span>
                        <select class="field-select" name="welcome_quick_action_icon__${index}">
                          ${WELCOME_ACTION_ICON_OPTIONS.map(
                            ([value, label]) => `<option value="${escapeHtml(value)}"${item.iconKey === value ? ' selected' : ''}>${escapeHtml(label)}</option>`,
                          ).join('')}
                        </select>
                      </label>
                      <label class="field" style="grid-column: 1 / -1;">
                        <span>Prompt</span>
                        <textarea class="field-textarea" name="welcome_quick_action_prompt__${index}" rows="3">${fieldValue(item.prompt)}</textarea>
                      </label>
                    </div>
                  </div>
                </article>
              `,
            )
            .join('')}
        </div>
      </article>
    </section>
  `;
}

function renderBrandModuleAssembly(buffer, surfaceKey) {
  const blueprint = getSurfaceBlueprint(surfaceKey);
  const menuItem = getMenuDefinition(blueprint?.menuKey) || null;
  const enabled = menuItem ? buffer.selectedMenus.includes(menuItem.key) : true;
  const surface = getBrandSurfaceDraft(buffer, surfaceKey);
  return `
    <section class="fig-brand-section">
      <div class="fig-section-heading">
        <h2>${escapeHtml(blueprint?.label || surfaceLabel(surfaceKey))}</h2>
        <p>单独维护这个业务模块的入口开关和模块 surface 配置，满足不同 OEM 的积木化装配需求。</p>
      </div>
      <div class="fig-capability-columns">
        ${
          menuItem
            ? `
              <article class="fig-card fig-card--subtle">
                <div class="fig-card__head">
                  <h3>模块入口</h3>
                  <span>控制该模块是否在左侧菜单中可见</span>
                </div>
                <div class="fig-capability-stack">
                  ${renderMenuToggleCard(buffer, menuItem, '业务模块入口')}
                </div>
                <div class="fig-card__footer">
                  <span>${enabled ? '当前模块入口已显示在 OEM 菜单中。' : '当前模块入口已隐藏，不会在 OEM 菜单中显示。'}</span>
                </div>
              </article>
            `
            : ''
        }
        <article class="surface-editor fig-surface-card" data-surface-key="${escapeHtml(surface.key)}" data-surface-label="${escapeHtml(surface.label)}">
          <div class="fig-surface-card__preview">
            ${icon(blueprint?.icon || 'layout', 'fig-surface-card__preview-icon')}
          </div>
          <div class="fig-surface-card__body">
            <div class="surface-editor__head fig-surface-card__head">
              <div>
                <h3>${escapeHtml(surface.label)} Surface</h3>
                <p>${visibilityStateLabel(surface.enabled)}</p>
              </div>
              <label class="toggle fig-toggle">
                <input type="checkbox" name="surface_enabled__${escapeHtml(surface.key)}"${surface.enabled ? ' checked' : ''} />
                <span>${visibilityStateLabel(surface.enabled)}</span>
              </label>
            </div>
            <textarea class="code-input code-input--tall" name="surface_config__${escapeHtml(surface.key)}">${escapeHtml(surface.json)}</textarea>
          </div>
        </article>
      </div>
    </section>
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
  const assets = state.brandDetail.assets || [];
  const versions = state.brandDetail.versions || [];
  const audit = state.brandDetail.audit || [];
  const activeTab = getBrandDetailTabConfig(state.brandDetailTab)?.id || 'desktop';
  const activeGroup = getBrandDetailTabGroup(activeTab);
  const app = state.brandDetail.app || null;
  const metrics = metricsFromBrand(brand);
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
              保存配置
            </button>
            <button class="solid-button fig-button" type="button" data-action="publish-brand"${state.busy ? ' disabled' : ''}>
              ${icon('rocket', 'button-icon')}
              发布快照
            </button>
            <button class="fig-icon-button" type="button" data-action="rollback-brand" data-version="${escapeHtml(rollbackTarget)}"${rollbackTarget ? '' : ' disabled'} aria-label="恢复到最近发布版本">
              ${icon('rotateCcw', 'fig-icon-button__icon')}
            </button>
          </div>
        </div>
        <div class="fig-brand-detail__meta">
          <div>App Name: <code>${escapeHtml(brand.brandId)}</code></div>
          <div>•</div>
          <div>默认语言: ${escapeHtml(app?.defaultLocale || 'zh-CN')}</div>
          <div>•</div>
          <div>当前版本: <code>v${escapeHtml(brand.publishedVersion || 0)}</code></div>
          <div>•</div>
          <div>最后更新: ${escapeHtml(formatDateTime(app?.updatedAt || brand.updatedAt))}</div>
        </div>
      </div>
      <div class="fig-brand-nav">
        <div class="fig-brand-groups">
          ${BRAND_DETAIL_TAB_GROUPS
            .map(
              ({id, label, icon: iconName}) => `
                <button
                  class="fig-brand-group${activeGroup?.id === id ? ' is-active' : ''}"
                  type="button"
                  data-action="brand-tab-group"
                  data-group-id="${id}"
                >
                  ${icon(iconName, 'fig-inline-icon')}
                  ${escapeHtml(label)}
                </button>
              `,
            )
            .join('')}
        </div>
        <div class="fig-brand-tabs">
          ${activeGroup.tabs
            .map((tabId) => getBrandDetailTabConfig(tabId))
            .filter(Boolean)
            .map(
              ({id, label, icon: iconName}) => `
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
      </div>
      <div class="fig-page__body fig-page__body--brand-detail">
        ${renderBrandDetailGuide(activeTab)}
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
                <span>应用状态</span>
                <select class="field-select" name="status">
                  ${['active', 'disabled']
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
              <span>portal app 的发布快照</span>
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
                            恢复
                          </button>
                        </div>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">还没有发布快照。</div>`}
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
  if (activeTab === 'desktop') {
    return renderBrandSurfaceEditor(buffer, 'desktop', '桌面端', '维护桌面端主壳层的 OEM 配置。');
  }

  if (activeTab === 'home-web') {
    return renderBrandSurfaceEditor(buffer, 'home-web', 'Home页', '维护官网 / Home 页的 OEM 配置。');
  }

  if (activeTab === 'welcome') {
    return renderBrandWelcomeAssembly(buffer);
  }

  if (activeTab === 'header') {
    return renderBrandSurfaceEditor(buffer, 'header', 'Header栏', '维护顶部栏的品牌视觉、信息架构和交互配置。');
  }

  if (activeTab === 'sidebar') {
    return renderBrandSurfaceEditor(buffer, 'sidebar', '侧边栏', '维护侧边栏容器本身的布局、视觉和交互配置。');
  }

  if (activeTab === 'input') {
    return renderBrandInputAssembly(buffer);
  }

  if (activeTab === 'skills') {
    return renderBrandSkillsAssembly(buffer);
  }

  if (activeTab === 'mcps') {
    return renderBrandMcpAssembly(buffer);
  }

  if (activeTab === 'models') {
    return renderBrandModelAssembly(buffer);
  }

  if (activeTab === 'menus') {
    return renderBrandMenusAssembly(buffer);
  }

  if (getSurfaceBlueprint(activeTab)?.kind === 'module') {
    return renderBrandModuleAssembly(buffer, activeTab);
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
          <p>上传和维护 Logo、Favicon 与其它品牌资源，真实写入 MinIO 和 oem_app_assets。</p>
        </div>
        <div class="fig-assets-layout">
          <article class="fig-card fig-card--subtle">
            <div class="fig-card__head">
              <h3>Logo / Favicon 上传器</h3>
              <span>上传的新图会真正写入 MinIO，并为当前 OEM 应用建立资源索引。</span>
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
                          current && isImageLike(current.contentType, current.publicUrl, current.objectKey)
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
                  <input class="field-input" name="kind" placeholder="logo / favicon / hero" />
                </label>
                <label class="field field--wide">
                  <span>上传文件</span>
                  <input class="field-input" name="file" type="file" />
                </label>
                <label class="field field--wide">
                  <span>Metadata JSON</span>
                  <textarea class="field-textarea" name="metadata_json">{}</textarea>
                </label>
              </div>
              <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>上传资源</button>
            </form>
          </article>
          <article class="fig-card fig-card--subtle">
            <div class="fig-card__head">
              <h3>当前品牌资源</h3>
              <span>来自 oem_app_assets 的真实记录</span>
            </div>
            <div class="fig-list">
              ${assets.length
                ? assets
                    .map(
                      (item) => `
                        <div class="fig-list-item fig-list-item--spread">
                          <div>
                            <div class="fig-list-item__title">${escapeHtml(item.assetKey)}</div>
                            <div class="fig-list-item__body">${escapeHtml(item.objectKey || '')}</div>
                            ${
                              isImageLike(item.contentType, item.publicUrl, item.objectKey)
                                ? `<div class="asset-thumb-wrap"><img class="asset-thumb" src="${escapeHtml(resolveAssetUrl(item))}" alt="${escapeHtml(item.assetKey)}" /></div>`
                                : ''
                            }
                          </div>
                          <div class="fig-list-item__actions">
                            <span>${escapeHtml(item.storageProvider || 's3')}</span>
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
    const skillEnabled = item.active !== false;
    if (state.filters.capabilitySkillStatus === 'active' && !skillEnabled) return false;
    if (state.filters.capabilitySkillStatus === 'disabled' && skillEnabled) return false;
    if (
      state.filters.capabilitySkillCategory !== 'all' &&
      String(item.category || '').trim() !== state.filters.capabilitySkillCategory
    ) {
      return false;
    }
    if (
      state.filters.capabilitySkillBrand !== 'all' &&
      !asArray(item.connectedBrands).some((brand) => brand.brand_id === state.filters.capabilitySkillBrand)
    ) {
      return false;
    }
    if (!query) return true;
    return [item.slug, item.name, item.category, item.publisher].some((value) =>
      String(value || '').toLowerCase().includes(query),
    );
  });
  const mcpServers = getMergedMcpServers().filter((item) => {
    const enabled = item.enabled_by_default !== false;
    if (state.filters.capabilityMcpStatus === 'active' && !enabled) return false;
    if (state.filters.capabilityMcpStatus === 'disabled' && enabled) return false;
    if (
      state.filters.capabilityMcpTransport !== 'all' &&
      String(item.transport || '').trim() !== state.filters.capabilityMcpTransport
    ) {
      return false;
    }
    if (
      state.filters.capabilityMcpBrand !== 'all' &&
      !asArray(item.connected_brands).some((brand) => brand.brand_id === state.filters.capabilityMcpBrand)
    ) {
      return false;
    }
    if (!query) return true;
    return [item.key, item.name, item.command, item.http_url, ...(item.env_keys || [])].some((value) =>
      String(value || '').toLowerCase().includes(query),
    );
  });
  const models = getMergedModelCatalog().filter((item) => {
    const enabled = item.active !== false;
    if (state.filters.capabilityModelStatus === 'active' && !enabled) return false;
    if (state.filters.capabilityModelStatus === 'disabled' && enabled) return false;
    if (
      state.filters.capabilityModelProvider !== 'all' &&
      String(item.providerId || '').trim() !== state.filters.capabilityModelProvider
    ) {
      return false;
    }
    if (
      state.filters.capabilityModelBrand !== 'all' &&
      !asArray(item.connectedBrands).some((brand) => brand.brand_id === state.filters.capabilityModelBrand)
    ) {
      return false;
    }
    if (!query) return true;
    return [item.ref, item.label, item.providerId, item.modelId, ...(item.input || [])].some((value) =>
      String(value || '').toLowerCase().includes(query),
    );
  });
  return {skills, mcpServers, models};
}

function renderSkillsMcpPage() {
  const filterOptions = getCapabilityFilterOptions();
  const {skills, mcpServers, models} = getFilteredCapabilities();
  const selectedSkill = state.selectedSkillSlug === '__new__' ? null : skills.find((item) => item.slug === state.selectedSkillSlug) || skills[0] || null;
  const selectedMcp = state.selectedMcpKey === '__new__' ? null : mcpServers.find((item) => item.key === state.selectedMcpKey) || mcpServers[0] || null;
  const selectedModel = state.selectedModelRef === '__new__' ? null : models.find((item) => item.ref === state.selectedModelRef) || models[0] || null;
  const actionButton =
    state.capabilityMode === 'skills'
      ? `
        <button class="solid-button fig-button" type="button" data-action="new-skill">
          ${icon('plus', 'button-icon')}
          添加技能
        </button>
      `
      : state.capabilityMode === 'mcp'
        ? `
          <button class="solid-button fig-button" type="button" data-action="new-mcp">
            ${icon('plus', 'button-icon')}
            新增 MCP
          </button>
        `
        : `
          <button class="solid-button fig-button" type="button" data-action="new-model">
            ${icon('plus', 'button-icon')}
            新增模型
          </button>
        `;
  const pageDescription =
    state.capabilityMode === 'skills'
      ? '管理 Skill 主目录和 OEM 开放范围'
      : state.capabilityMode === 'mcp'
        ? '管理 MCP 主目录和 OEM 开放范围'
        : '管理模型主目录、OEM allowlist、推荐和默认模型';
  const pageTitle =
    state.capabilityMode === 'skills' ? 'Skill中心' : state.capabilityMode === 'mcp' ? 'MCP中心' : '模型中心';
  const listCountLabel =
    state.capabilityMode === 'skills'
      ? `当前显示 ${skills.length} 个技能`
      : state.capabilityMode === 'mcp'
        ? `当前显示 ${mcpServers.length} 个 MCP`
        : `当前显示 ${models.length} 个模型`;
  const searchPlaceholder =
    state.capabilityMode === 'skills'
      ? '搜索技能...'
      : state.capabilityMode === 'mcp'
        ? '搜索 MCP...'
        : '搜索模型...';
  const filterControls =
    state.capabilityMode === 'skills'
      ? `
        <div class="fig-capability-filter-row">
          <select class="field-select fig-filter" data-filter-key="capabilitySkillStatus">
            ${['all', 'active', 'disabled']
              .map(
                (item) =>
                  `<option value="${item}"${state.filters.capabilitySkillStatus === item ? ' selected' : ''}>${escapeHtml(item === 'all' ? '全部目录' : item === 'active' ? '仅上架' : '仅下架')}</option>`,
              )
              .join('')}
          </select>
          <select class="field-select fig-filter" data-filter-key="capabilitySkillCategory">
            <option value="all">全部分类</option>
            ${filterOptions.categories
              .map(
                (item) =>
                  `<option value="${escapeHtml(item)}"${state.filters.capabilitySkillCategory === item ? ' selected' : ''}>${escapeHtml(item)}</option>`,
              )
              .join('')}
          </select>
          <select class="field-select fig-filter" data-filter-key="capabilitySkillBrand">
            <option value="all">全部品牌</option>
            ${filterOptions.skillBrands
              .map(
                (brand) =>
                  `<option value="${escapeHtml(brand.brand_id)}"${state.filters.capabilitySkillBrand === brand.brand_id ? ' selected' : ''}>${escapeHtml(brand.display_name)}</option>`,
              )
              .join('')}
          </select>
        </div>
      `
      : state.capabilityMode === 'mcp'
        ? `
          <div class="fig-capability-filter-row">
            <select class="field-select fig-filter" data-filter-key="capabilityMcpStatus">
              ${['all', 'active', 'disabled']
                .map(
                  (item) =>
                    `<option value="${item}"${state.filters.capabilityMcpStatus === item ? ' selected' : ''}>${escapeHtml(item === 'all' ? '全部目录' : item === 'active' ? '仅可用' : '仅关闭')}</option>`,
                )
                .join('')}
            </select>
            <select class="field-select fig-filter" data-filter-key="capabilityMcpTransport">
              <option value="all">全部传输</option>
              ${filterOptions.transports
                .map(
                  (item) =>
                    `<option value="${escapeHtml(item)}"${state.filters.capabilityMcpTransport === item ? ' selected' : ''}>${escapeHtml(item)}</option>`,
                )
                .join('')}
            </select>
            <select class="field-select fig-filter" data-filter-key="capabilityMcpBrand">
              <option value="all">全部品牌</option>
              ${filterOptions.mcpBrands
                .map(
                  (brand) =>
                    `<option value="${escapeHtml(brand.brand_id)}"${state.filters.capabilityMcpBrand === brand.brand_id ? ' selected' : ''}>${escapeHtml(brand.display_name)}</option>`,
                )
                .join('')}
            </select>
          </div>
        `
        : `
          <div class="fig-capability-filter-row">
            <select class="field-select fig-filter" data-filter-key="capabilityModelStatus">
              ${['all', 'active', 'disabled']
                .map(
                  (item) =>
                    `<option value="${item}"${state.filters.capabilityModelStatus === item ? ' selected' : ''}>${escapeHtml(item === 'all' ? '全部状态' : item === 'active' ? '仅启用' : '仅禁用')}</option>`,
                )
                .join('')}
            </select>
            <select class="field-select fig-filter" data-filter-key="capabilityModelProvider">
              <option value="all">全部 Provider</option>
              ${filterOptions.modelProviders
                .map(
                  (item) =>
                    `<option value="${escapeHtml(item)}"${state.filters.capabilityModelProvider === item ? ' selected' : ''}>${escapeHtml(item)}</option>`,
                )
                .join('')}
            </select>
            <select class="field-select fig-filter" data-filter-key="capabilityModelBrand">
              <option value="all">全部品牌</option>
              ${filterOptions.modelBrands
                .map(
                  (brand) =>
                    `<option value="${escapeHtml(brand.brand_id)}"${state.filters.capabilityModelBrand === brand.brand_id ? ' selected' : ''}>${escapeHtml(brand.display_name)}</option>`,
                )
                .join('')}
            </select>
          </div>
        `;
  const listMarkup =
    state.capabilityMode === 'skills'
      ? `
        ${skills.length
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
          : `<div class="empty-state">没有匹配的技能。</div>`}
        <button class="capability-card${state.selectedSkillSlug === '__new__' ? ' is-active' : ''}" type="button" data-action="select-skill" data-skill-slug="__new__">
          <strong>新建 Skill</strong>
          <span>新增一个 cloud skill catalog 记录</span>
        </button>
      `
      : state.capabilityMode === 'mcp'
        ? `
          ${mcpServers.length
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
            : `<div class="empty-state">没有匹配的 MCP。</div>`}
          <button class="capability-card${state.selectedMcpKey === '__new__' ? ' is-active' : ''}" type="button" data-action="select-mcp" data-mcp-key="__new__">
            <strong>新建 MCP</strong>
            <span>新增一个可保存到注册表的配置</span>
          </button>
        `
        : `
          ${models.length
            ? models
                .map(
                  (item) => `
                    <button class="capability-card${selectedModel?.ref === item.ref ? ' is-active' : ''}" type="button" data-action="select-model" data-model-ref="${escapeHtml(item.ref)}">
                      <strong>${escapeHtml(item.label)}</strong>
                      <span>${escapeHtml(item.providerId)} • ${escapeHtml(item.connected_brand_count)} 个品牌使用</span>
                    </button>
                  `,
                )
                .join('')
            : `<div class="empty-state">没有匹配的模型。</div>`}
          <button class="capability-card${state.selectedModelRef === '__new__' ? ' is-active' : ''}" type="button" data-action="select-model" data-model-ref="__new__">
            <strong>新建模型</strong>
            <span>新增一个 OEM 可装配的模型目录项</span>
          </button>
        `;
  const detailMarkup =
    state.capabilityMode === 'skills'
      ? renderSkillDetail(selectedSkill)
      : state.capabilityMode === 'mcp'
        ? renderMcpDetail(selectedMcp)
        : renderModelDetail(selectedModel);

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>${pageTitle}</h1>
            <p class="fig-page__description">${pageDescription}</p>
          </div>
          ${actionButton}
        </div>
      </div>
      ${renderPageGuide(`${pageTitle}怎么用`, state.capabilityMode === 'skills'
        ? [
            '这里维护 Skill 主数据，决定有哪些技能可以被 OEM 装配。',
            '新增或编辑 Skill 后，再去品牌详情的“技能”tab里勾选安装到哪些品牌。',
            '品牌侧勾选只是绑定关系；Skill 的主信息仍以这里为准。',
          ]
        : state.capabilityMode === 'mcp'
          ? [
              '这里维护 MCP 主目录，包括 transport、command、args、env 和元数据。',
              'MCP 建好后，再去品牌详情的“MCP”tab里为指定 OEM 勾选安装。',
              '需要验证连通性时，可先在这里保存，再点“测试连接”。',
            ]
          : [
              '这里维护模型全集，不直接决定某个 OEM 能看到什么。',
              '每个 OEM 的模型可见性在品牌详情的“模型”tab里单独勾选。',
              '模型主数据改完后，品牌发布新快照，客户端同步后输入框模型列表才会变化。',
            ], 'capability')}
      <div class="fig-capability-screen">
        <aside class="fig-capability-sidebar">
          <div class="fig-capability-sidebar__toolbar">
            <label class="fig-search">
              ${icon('search', 'fig-search__icon')}
              <input
                class="field-input fig-search__input"
                data-filter-key="capabilityQuery"
                placeholder="${searchPlaceholder}"
                value="${fieldValue(state.filters.capabilityQuery)}"
              />
            </label>
            <div class="segmented">
              <button class="tab-pill${state.capabilityMode === 'skills' ? ' is-active' : ''}" type="button" data-action="capability-mode" data-mode="skills">技能</button>
              <button class="tab-pill${state.capabilityMode === 'mcp' ? ' is-active' : ''}" type="button" data-action="capability-mode" data-mode="mcp">MCP</button>
              <button class="tab-pill${state.capabilityMode === 'models' ? ' is-active' : ''}" type="button" data-action="capability-mode" data-mode="models">模型</button>
            </div>
            ${filterControls}
            <div class="fig-capability-filter-meta">
              <span>${escapeHtml(listCountLabel)}</span>
              <button class="text-button" type="button" data-action="capability-filter-reset">重置筛选</button>
            </div>
          </div>
          <div class="fig-capability-list">${listMarkup}</div>
        </aside>
        <section class="fig-capability-detail">${detailMarkup}</section>
      </div>
    </div>
  `;
}

function getFilteredAgents() {
  const query = state.filters.agentQuery.trim().toLowerCase();
  return [...state.agentCatalog]
    .filter((item) => {
      if (state.filters.agentStatus === 'active' && item.active === false) {
        return false;
      }
      if (state.filters.agentStatus === 'disabled' && item.active !== false) {
        return false;
      }
      const surface = getAgentSurface(item);
      if (state.filters.agentSurface !== 'all' && surface !== state.filters.agentSurface) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [
        item.slug,
        item.name,
        item.description,
        item.category,
        item.publisher,
        surface,
        ...(item.tags || []),
      ].some((value) => String(value || '').toLowerCase().includes(query));
    })
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0) || left.name.localeCompare(right.name, 'zh-CN'));
}

function renderAgentEditorForm(agent) {
  const isNew = !agent;
  const editable = agent || {
    slug: '',
    name: '',
    description: '',
    category: 'general',
    publisher: 'iClaw',
    featured: false,
    official: true,
    tags: [],
    capabilities: [],
    use_cases: [],
    metadata: {},
    sort_order: 9999,
    active: true,
  };

  return `
    <section class="fig-card fig-card--subtle">
      <div class="fig-card__head">
        <h3>${isNew ? '新增 Agent Catalog' : '编辑 Agent Catalog'}</h3>
        <span>这里直接维护数据库中的 agent catalog 主数据。</span>
      </div>
      <form id="agent-editor-form" class="form-grid form-grid--two">
        <label class="field">
          <span>Slug</span>
          <input class="field-input" name="slug" value="${fieldValue(editable.slug)}" placeholder="agent-slug" ${isNew ? '' : 'readonly'} />
        </label>
        <label class="field">
          <span>Name</span>
          <input class="field-input" name="name" value="${fieldValue(editable.name)}" placeholder="Agent 名称" />
        </label>
        <label class="field field--wide">
          <span>Description</span>
          <textarea class="field-textarea" name="description" placeholder="Agent 做什么">${escapeHtml(editable.description || '')}</textarea>
        </label>
        <label class="field">
          <span>Category</span>
          <select class="field-select" name="category">
            ${['finance', 'content', 'productivity', 'commerce', 'general']
              .map((item) => `<option value="${item}"${editable.category === item ? ' selected' : ''}>${escapeHtml(item)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="field">
          <span>Publisher</span>
          <input class="field-input" name="publisher" value="${fieldValue(editable.publisher || 'iClaw')}" />
        </label>
        <label class="field">
          <span>Sort Order</span>
          <input class="field-input" name="sort_order" type="number" min="0" value="${fieldValue(editable.sort_order || 9999)}" />
        </label>
        <label class="field">
          <span>状态</span>
          <select class="field-select" name="active">
            <option value="true"${editable.active !== false ? ' selected' : ''}>启用</option>
            <option value="false"${editable.active === false ? ' selected' : ''}>禁用</option>
          </select>
        </label>
        <label class="field">
          <span>Featured</span>
          <select class="field-select" name="featured">
            <option value="true"${editable.featured === true ? ' selected' : ''}>true</option>
            <option value="false"${editable.featured === true ? '' : ' selected'}>false</option>
          </select>
        </label>
        <label class="field">
          <span>Official</span>
          <select class="field-select" name="official">
            <option value="true"${editable.official !== false ? ' selected' : ''}>true</option>
            <option value="false"${editable.official === false ? ' selected' : ''}>false</option>
          </select>
        </label>
        <label class="field field--wide">
          <span>Tags</span>
          <textarea class="field-textarea" name="tags_text" placeholder="每行一个 tag">${escapeHtml((editable.tags || []).join('\n'))}</textarea>
        </label>
        <label class="field field--wide">
          <span>Capabilities</span>
          <textarea class="field-textarea" name="capabilities_text" placeholder="每行一个 capability">${escapeHtml((editable.capabilities || []).join('\n'))}</textarea>
        </label>
        <label class="field field--wide">
          <span>Use Cases</span>
          <textarea class="field-textarea" name="use_cases_text" placeholder="每行一个 use case">${escapeHtml((editable.use_cases || []).join('\n'))}</textarea>
        </label>
        <label class="field field--wide">
          <span>Metadata JSON</span>
          <textarea class="field-textarea" name="metadata_json">${escapeHtml(prettyJson(editable.metadata || {}))}</textarea>
        </label>
        <div class="fig-form-actions">
          <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存 Agent</button>
        </div>
      </form>
    </section>
  `;
}

function renderAgentCenterPage() {
  const agents = getFilteredAgents();
  const selectedAgent =
    state.selectedAgentSlug === '__new__'
      ? null
      : getAgentCatalogEntry(state.selectedAgentSlug) || agents[0] || null;
  const selectedSurface = selectedAgent ? getAgentSurface(selectedAgent) : 'all';
  const primarySkill = String(asObject(selectedAgent?.metadata).primary_skill_slug || '').trim();
  const surfaces = Array.from(new Set(state.agentCatalog.map((item) => getAgentSurface(item)).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'zh-CN'),
  );

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>Agent中心</h1>
            <p class="fig-page__description">统一维护龙虾商店、智能投资专家等 agent catalog 主数据。</p>
          </div>
          <button class="solid-button fig-button" type="button" data-action="new-agent">
            ${icon('plus', 'button-icon')}
            新建 Agent
          </button>
        </div>
      </div>
      <div class="fig-page__body">
        ${renderPageGuide('Agent中心怎么用', [
          '这里维护 agent catalog 主数据，前台龙虾商店和智能投资专家都直接读这里。',
          'metadata 内保存 surface、primary skill、skill slugs、prompt、MCP preset 等扩展字段。',
          '保存后会直接写数据库，并同步刷新 control-plane 的 agent catalog 缓存。',
        ], 'agent')}
        <div class="fig-capability-screen">
          <aside class="fig-capability-sidebar">
            <div class="fig-capability-sidebar__toolbar">
              <label class="fig-search">
                ${icon('search', 'fig-search__icon')}
                <input
                  class="field-input fig-search__input"
                  data-filter-key="agentQuery"
                  placeholder="搜索 agent..."
                  value="${fieldValue(state.filters.agentQuery)}"
                />
              </label>
              <div class="fig-capability-filter-row">
                <select class="field-select fig-filter" data-filter-key="agentStatus">
                  ${['all', 'active', 'disabled']
                    .map((item) => `<option value="${item}"${state.filters.agentStatus === item ? ' selected' : ''}>${escapeHtml(item === 'all' ? '全部状态' : item === 'active' ? '仅启用' : '仅禁用')}</option>`)
                    .join('')}
                </select>
                <select class="field-select fig-filter" data-filter-key="agentSurface">
                  <option value="all">全部 Surface</option>
                  ${surfaces.map((item) => `<option value="${escapeHtml(item)}"${state.filters.agentSurface === item ? ' selected' : ''}>${escapeHtml(item)}</option>`).join('')}
                </select>
              </div>
              <div class="fig-capability-filter-meta">
                <span>${escapeHtml(`${agents.length} 个 Agent`)}</span>
                <button class="text-button" type="button" data-action="agent-filter-reset">重置筛选</button>
              </div>
            </div>
            <div class="fig-capability-list">
              ${agents.length
                ? agents
                    .map(
                      (item) => `
                        <button class="capability-card${selectedAgent?.slug === item.slug ? ' is-active' : ''}" type="button" data-action="select-agent" data-agent-slug="${escapeHtml(item.slug)}">
                          <strong>${escapeHtml(item.name)}</strong>
                          <span>${escapeHtml(getAgentSurface(item))} • ${escapeHtml(item.active === false ? 'disabled' : 'active')}</span>
                        </button>
                      `,
                    )
                    .join('')
                : `<div class="empty-state">没有匹配的 Agent。</div>`}
              <button class="capability-card${state.selectedAgentSlug === '__new__' ? ' is-active' : ''}" type="button" data-action="new-agent">
                <strong>新建 Agent</strong>
                <span>新增一个可投放到前台的 agent 目录项</span>
              </button>
            </div>
          </aside>
          <section class="fig-capability-detail">
            ${
              selectedAgent
                ? `
                  <div class="fig-detail-stack">
                    <div class="fig-card">
                      <div class="fig-card__head">
                        <div>
                          <h2>${escapeHtml(selectedAgent.name)}</h2>
                          <span>${escapeHtml(selectedAgent.slug)} · ${escapeHtml(selectedAgent.publisher || 'iClaw')}</span>
                        </div>
                        ${renderSwitch({
                          checked: selectedAgent.active !== false,
                          action: 'agent-toggle',
                          attrs: `data-agent-slug="${escapeHtml(selectedAgent.slug)}" data-enabled="${selectedAgent.active !== false ? 'true' : 'false'}"`,
                          label: selectedAgent.active !== false ? '已启用' : '已禁用',
                        })}
                      </div>
                      <p class="detail-copy">${escapeHtml(selectedAgent.description || '暂无描述。')}</p>
                      <div class="fig-meta-cards">
                        <div class="fig-meta-card"><span>Surface</span><strong>${escapeHtml(selectedSurface)}</strong></div>
                        <div class="fig-meta-card"><span>Primary Skill</span><strong>${escapeHtml(primarySkill || '未设置')}</strong></div>
                        <div class="fig-meta-card"><span>Sort Order</span><strong>${escapeHtml(selectedAgent.sort_order || 0)}</strong></div>
                      </div>
                      <div class="chip-grid">
                        ${(selectedAgent.tags || []).length ? selectedAgent.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join('') : `<div class="empty-state">暂无标签。</div>`}
                      </div>
                      <div class="action-row">
                        <button class="text-button" type="button" data-action="toggle-agent-import">${state.showAgentImportPanel ? '收起编辑面板' : '编辑 Agent'}</button>
                        <button class="ghost-button" type="button" data-action="agent-delete" data-agent-slug="${escapeHtml(selectedAgent.slug)}">删除 Agent</button>
                      </div>
                    </div>
                    ${state.showAgentImportPanel ? renderAgentEditorForm(selectedAgent) : ''}
                    <section class="fig-card fig-card--subtle">
                      <div class="fig-card__head">
                        <h3>Metadata</h3>
                        <span>真实写入 agent_catalog_entries.metadata_json</span>
                      </div>
                      <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(selectedAgent.metadata || {}))}</textarea>
                    </section>
                  </div>
                `
                : renderAgentEditorForm(null)
            }
          </section>
        </div>
      </div>
    </div>
  `;
}

function renderSkillSyncSourceForm() {
  const source = state.skillSyncSources.find((item) => item.id === state.selectedSkillSyncSourceId) || null;
  const editable = source || {
    id: '',
    source_type: 'github_repo',
    source_key: '',
    display_name: '',
    source_url: '',
    config: {},
    active: true,
  };
  return `
    <section class="fig-card fig-card--subtle">
      <div class="fig-card__head">
        <h3>${source ? '编辑同步源' : '新增同步源'}</h3>
        <span>同步结果会直接灌入 cloud skill 主库，并在 portal 中保留运行记录。</span>
      </div>
      <form id="skill-sync-source-form" class="form-grid form-grid--two">
        <input type="hidden" name="id" value="${fieldValue(editable.id)}" />
        <label class="field">
          <span>Source Type</span>
          <select class="field-select" name="source_type">
            <option value="clawhub"${editable.source_type === 'clawhub' ? ' selected' : ''}>ClawHub</option>
            <option value="github_repo"${editable.source_type === 'github_repo' ? ' selected' : ''}>GitHub Repo</option>
          </select>
        </label>
        <label class="field">
          <span>Source Key</span>
          <input class="field-input" name="source_key" value="${fieldValue(editable.source_key)}" placeholder="github:owner/repo" />
        </label>
        <label class="field">
          <span>Display Name</span>
          <input class="field-input" name="display_name" value="${fieldValue(editable.display_name)}" placeholder="Claude Code Skills" />
        </label>
        <label class="field">
          <span>Source URL</span>
          <input class="field-input" name="source_url" value="${fieldValue(editable.source_url)}" placeholder="https://github.com/owner/repo" />
        </label>
        <label class="field">
          <span>状态</span>
          <select class="field-select" name="active">
            <option value="true"${editable.active !== false ? ' selected' : ''}>启用</option>
            <option value="false"${editable.active === false ? ' selected' : ''}>禁用</option>
          </select>
        </label>
        <label class="field field--wide">
          <span>Config JSON</span>
          <textarea class="field-textarea" name="config_json">${escapeHtml(prettyJson(editable.config || {}))}</textarea>
        </label>
        <div class="fig-form-actions">
          <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存同步源</button>
        </div>
      </form>
    </section>
  `;
}

function renderCloudSkillsPage() {
  const skills = [...state.cloudSkillCatalog].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
  const selectedSkill = getCloudSkillCatalogEntry(state.selectedCloudSkillSlug) || skills[0] || null;
  const selectedSource = state.skillSyncSources.find((item) => item.id === state.selectedSkillSyncSourceId) || state.skillSyncSources[0] || null;
  const runs = state.skillSyncRuns || [];

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>云技能</h1>
            <p class="fig-page__description">同步 ClawHub 和 GitHub 来源，直接维护技能商店主库。</p>
          </div>
          <div class="action-row">
            <button class="ghost-button" type="button" data-action="toggle-skill-sync-source-form">${state.showSkillSyncSourceForm ? '收起表单' : '新增同步源'}</button>
            ${selectedSource ? `<button class="solid-button fig-button" type="button" data-action="run-skill-sync" data-source-id="${escapeHtml(selectedSource.id)}"${state.busy ? ' disabled' : ''}>同步当前来源</button>` : ''}
          </div>
        </div>
      </div>
      <div class="page-stack">
        ${renderPageGuide('云技能怎么用', [
          '这里维护技能商店主库，支持从 ClawHub 或 GitHub 同步技能目录。',
          '先新增同步源，再执行同步，把技能灌入云技能主库。',
          '云技能入库后，仍需去品牌管理或 Skill 中心决定哪些 OEM 可以使用。',
        ], 'cloud')}
        <section class="fig-card">
          <div class="fig-card__head">
            <h2>主库概览</h2>
            <span>技能商店直接读取这里的已上架技能</span>
          </div>
          <div class="fig-meta-cards">
            <div class="fig-meta-card"><span>云技能</span><strong>${escapeHtml(skills.length)}</strong></div>
            <div class="fig-meta-card"><span>同步源</span><strong>${escapeHtml(state.skillSyncSources.length)}</strong></div>
            <div class="fig-meta-card"><span>同步记录</span><strong>${escapeHtml(runs.length)}</strong></div>
          </div>
        </section>
        ${state.showSkillSyncSourceForm ? renderSkillSyncSourceForm() : ''}
        <div class="fig-layout">
          <aside class="fig-sidebar">
            <section class="fig-card fig-card--subtle">
              <div class="fig-card__head">
                <h3>同步源</h3>
                <span>${escapeHtml(state.skillSyncSources.length)} 个</span>
              </div>
              <div class="fig-capability-list">
                ${state.skillSyncSources.length
                  ? state.skillSyncSources
                      .map(
                        (item) => `
                          <button class="capability-card${selectedSource?.id === item.id ? ' is-active' : ''}" type="button" data-action="select-skill-sync-source" data-source-id="${escapeHtml(item.id)}">
                            <strong>${escapeHtml(item.display_name)}</strong>
                            <span>${escapeHtml(item.source_type)} • ${item.active ? '启用' : '禁用'}</span>
                          </button>
                        `,
                      )
                      .join('')
                  : `<div class="empty-state">还没有同步源。</div>`}
              </div>
            </section>
            <section class="fig-card fig-card--subtle">
              <div class="fig-card__head">
                <h3>云技能列表</h3>
                <span>${escapeHtml(skills.length)} 个</span>
              </div>
              <div class="fig-capability-list">
                ${skills.length
                  ? skills
                      .map(
                        (item) => `
                          <button class="capability-card${selectedSkill?.slug === item.slug ? ' is-active' : ''}" type="button" data-action="select-cloud-skill" data-skill-slug="${escapeHtml(item.slug)}">
                            <strong>${escapeHtml(item.name)}</strong>
                            <span>v${escapeHtml(item.version || '0.0.0')} • ${escapeHtml(item.origin_type || 'manual')}</span>
                          </button>
                        `,
                      )
                      .join('')
                  : `<div class="empty-state">还没有云技能。</div>`}
              </div>
            </section>
          </aside>
          <section class="fig-capability-detail">
            ${selectedSkill
              ? `
                <div class="fig-detail-stack">
                  <div class="fig-card">
                    <div class="fig-card__head">
                      <div>
                        <h2>${escapeHtml(selectedSkill.name)}</h2>
                        <span>${escapeHtml(selectedSkill.slug)} · v${escapeHtml(selectedSkill.version || '0.0.0')}</span>
                      </div>
                      ${renderSwitch({
                        checked: selectedSkill.active !== false,
                        action: 'cloud-skill-toggle',
                        attrs: `data-skill-slug="${escapeHtml(selectedSkill.slug)}" data-enabled="${selectedSkill.active !== false ? 'true' : 'false'}"`,
                        label: selectedSkill.active !== false ? '已上架' : '已下架',
                      })}
                    </div>
                    <p class="detail-copy">${escapeHtml(selectedSkill.description || '暂无描述。')}</p>
                    <div class="fig-meta-cards">
                      <div class="fig-meta-card"><span>版本</span><strong>v${escapeHtml(selectedSkill.version || '0.0.0')}</strong></div>
                      <div class="fig-meta-card"><span>来源</span><strong>${escapeHtml(selectedSkill.origin_type || 'manual')}</strong></div>
                      <div class="fig-meta-card"><span>发布者</span><strong>${escapeHtml(selectedSkill.publisher || '未知')}</strong></div>
                    </div>
                    <div class="chip-grid">
                      ${(selectedSkill.tags || []).length
                        ? selectedSkill.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join('')
                        : `<div class="empty-state">暂无标签。</div>`}
                    </div>
                    <div class="action-row">
                      ${selectedSkill.source_url ? `<a class="text-button" href="${escapeHtml(selectedSkill.source_url)}" target="_blank" rel="noreferrer">查看来源</a>` : ''}
                      ${selectedSkill.artifact_url ? `<a class="text-button" href="${escapeHtml(selectedSkill.artifact_url)}" target="_blank" rel="noreferrer">查看 Artifact</a>` : ''}
                    </div>
                  </div>
                  <section class="fig-card fig-card--subtle">
                    <div class="fig-card__head">
                      <h3>同步元数据</h3>
                      <span>先完整爬取，后续按需消费</span>
                    </div>
                    <textarea class="code-input code-input--tall" readonly>${escapeHtml(prettyJson(selectedSkill.metadata || {}))}</textarea>
                  </section>
                  <section class="fig-card fig-card--subtle">
                    <div class="fig-card__head">
                      <h3>最近同步记录</h3>
                      <span>${escapeHtml(runs.length)} 条</span>
                    </div>
                    <div class="fig-list">
                      ${runs.length
                        ? runs
                            .slice(0, 8)
                            .map(
                              (run) => `
                                <article class="fig-list-item">
                                  <div class="fig-list-item__body">
                                    <div class="fig-list-item__title">${escapeHtml(run.display_name)}</div>
                                    <div class="fig-list-item__meta">${escapeHtml(run.status)} • ${escapeHtml(formatDateTime(run.finished_at || run.started_at))}</div>
                                    <div class="fig-list-item__summary">${escapeHtml((run.items || []).slice(0, 3).map((item) => `${item.slug}@${item.version || 'n/a'}:${item.status}`).join(' / ') || '无结果')}</div>
                                  </div>
                                </article>
                              `,
                            )
                            .join('')
                        : `<div class="empty-state">还没有同步记录。</div>`}
                    </div>
                  </section>
                </div>
              `
              : `<div class="fig-card fig-card--detail-empty"><div class="empty-state">还没有云技能，先新增同步源并执行同步。</div></div>`}
          </section>
        </div>
      </div>
    </div>
  `;
}

function renderSkillImportPanel() {
  const skill = state.selectedSkillSlug === '__new__'
    ? null
    : getMergedSkills().find((item) => item.slug === state.selectedSkillSlug) || null;
  return `
    <section class="fig-card fig-card--subtle">
      <div class="fig-card__head">
        <h3>${skill ? '编辑 Skill Catalog' : '新增 Skill Catalog'}</h3>
        <span>当前直接写入 portal skill catalog；可选上传 tar.gz / zip artifact 到 MinIO。</span>
      </div>
      <form id="skill-import-form" class="form-grid form-grid--two">
        <label class="field">
          <span>Slug</span>
          <input class="field-input" name="slug" placeholder="cloud-skill-slug" value="${fieldValue(skill?.slug)}" ${skill ? 'readonly' : ''} />
        </label>
        <label class="field">
          <span>Name</span>
          <input class="field-input" name="name" placeholder="Skill Name" value="${fieldValue(skill?.name)}" />
        </label>
        <label class="field field--wide">
          <span>Description</span>
          <textarea class="field-textarea" name="description" placeholder="这个 skill 做什么">${escapeHtml(skill?.description || '')}</textarea>
        </label>
        <label class="field">
          <span>Publisher</span>
          <input class="field-input" name="publisher" value="${fieldValue(skill?.publisher || 'admin-web')}" />
        </label>
        <label class="field">
          <span>Category</span>
          <input class="field-input" name="category" placeholder="research / ops / growth" value="${fieldValue(skill?.category)}" />
        </label>
        <label class="field">
          <span>Visibility</span>
          <input class="field-input" name="visibility" placeholder="showcase / hidden" value="${fieldValue(skill?.visibility || 'showcase')}" />
        </label>
        <label class="field">
          <span>Object Key</span>
          <input class="field-input" name="object_key" placeholder="minio://skills/slug.tar.gz" value="${fieldValue(skill?.objectKey)}" />
        </label>
        <label class="field">
          <span>Artifact 文件</span>
          <input class="field-input" type="file" name="artifact_file" accept=".tar.gz,.tgz,.zip,application/gzip,application/zip" />
        </label>
        <label class="field">
          <span>状态</span>
          <select class="field-select" name="active">
            <option value="true"${skill?.active !== false ? ' selected' : ''}>上架</option>
            <option value="false"${skill?.active === false ? ' selected' : ''}>下架</option>
          </select>
        </label>
        <label class="field field--wide">
          <span>Metadata JSON</span>
          <textarea class="field-textarea" name="metadata_json">${escapeHtml(prettyJson(skill?.metadata || {}))}</textarea>
        </label>
        <div class="fig-form-actions">
          <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存 Skill</button>
        </div>
      </form>
    </section>
  `;
}

function renderSkillDetail(skill) {
  if (!skill) {
    return `${state.showSkillImportPanel ? renderSkillImportPanel() : ''}<div class="fig-card fig-card--detail-empty"><div class="empty-state">选择一个技能查看详情，或新建 cloud skill。</div></div>`;
  }
  return `
    <div class="fig-detail-stack">
      <div class="fig-card">
        <div class="fig-card__head">
          <div>
            <h2>${escapeHtml(skill.name)}</h2>
            <span>${escapeHtml(skill.slug)} · ${escapeHtml(skill.publisher || 'iClaw')}</span>
          </div>
          ${renderSwitch({
            checked: skill.active !== false,
            action: 'skill-toggle',
            attrs: `data-skill-slug="${escapeHtml(skill.slug)}" data-enabled="${skill.active !== false ? 'true' : 'false'}"`,
            label: skill.active !== false ? '已上架' : '已下架',
          })}
        </div>
        <p class="detail-copy">${escapeHtml(skill.description || '暂无描述。')}</p>
        <div class="fig-meta-cards">
          <div class="fig-meta-card"><span>分类</span><strong>${escapeHtml(skill.category || '未分类')}</strong></div>
          <div class="fig-meta-card"><span>来源</span><strong>cloud</strong></div>
          <div class="fig-meta-card"><span>使用品牌数</span><strong>${escapeHtml(skill.brand_count)}</strong></div>
        </div>
        <div class="action-row">
          <button class="ghost-button" type="button" data-action="skill-delete" data-skill-slug="${escapeHtml(skill.slug)}">删除 Skill</button>
          <button class="text-button" type="button" data-action="toggle-skill-import">${state.showSkillImportPanel ? '收起编辑面板' : '编辑 Skill'}</button>
        </div>
      </div>
      <section class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>品牌访问权限</h3>
          <span>${escapeHtml(capabilityBindingCountLabel('skill', skill.brand_count))}</span>
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
          : `<div class="empty-state">${capabilityBindingEmptyLabel('skill')}</div>`}
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
      description: '',
      transport: 'config',
      metadata: {},
      config: {},
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
  const editable = {
    key: server.key,
    name: server.name,
    description: server.description || '',
    enabled: server.enabled_by_default,
    transport: server.transport || 'config',
    objectKey: server.objectKey || '',
    command: server.command,
    args: server.args || [],
    http_url: server.http_url,
    env: asObject(server.config?.env),
    metadata: asObject(server.metadata),
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
            <span>${server.enabled_by_default ? '目录可用' : '目录关闭'}</span>
          </div>
        </div>
      </div>
      <form id="mcp-editor-form" class="fig-card fig-card--subtle">
      <div class="fig-card__head">
        <h3>MCP 配置</h3>
        <span>真实写入 portal mcp catalog，支持保存、测试连接、删除</span>
      </div>
      <div class="form-grid form-grid--two">
        <label class="field">
          <span>Key</span>
          <input class="field-input" name="key" value="${fieldValue(editable.key)}" />
        </label>
        <label class="field">
          <span>Name</span>
          <input class="field-input" name="name" value="${fieldValue(editable.name)}" />
        </label>
        <label class="field field--wide">
          <span>Description</span>
          <textarea class="field-textarea" name="description">${escapeHtml(editable.description)}</textarea>
        </label>
        <label class="field">
          <span>默认状态</span>
          <select class="field-select" name="enabled">
            <option value="true"${editable.enabled ? ' selected' : ''}>可用</option>
            <option value="false"${editable.enabled ? '' : ' selected'}>关闭</option>
          </select>
        </label>
        <label class="field">
          <span>Transport</span>
          <input class="field-input" name="transport" value="${fieldValue(editable.transport)}" placeholder="stdio / http / config" />
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
        <label class="field">
          <span>Object Key</span>
          <input class="field-input" name="object_key" value="${fieldValue(editable.objectKey)}" placeholder="minio://mcps/key.json" />
        </label>
        <label class="field field--wide">
          <span>Metadata JSON</span>
          <textarea class="field-textarea" name="metadata_json">${escapeHtml(prettyJson(editable.metadata))}</textarea>
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
          : `<div class="empty-state">${capabilityBindingEmptyLabel('mcp')}</div>`}
      </div>
      </section>
      ${renderCapabilityBrandMatrix('mcp', server)}
    </div>
  `;
}

function renderModelDetail(model) {
  if (!model) {
    model = {
      ref: '',
      label: '新建模型',
      providerId: 'openai',
      modelId: '',
      api: 'openai-completions',
      baseUrl: '',
      useRuntimeOpenai: true,
      authHeader: true,
      reasoning: true,
      input: ['text'],
      contextWindow: 0,
      maxTokens: 0,
      metadata: {},
      connected_brand_count: 0,
      connectedBrands: [],
      active: true,
    };
  }
  const isNew = !model.ref;
  return `
    <div class="fig-detail-stack">
      <div class="fig-card">
        <div class="fig-card__head">
          <div>
            <h2>${escapeHtml(model.label)}</h2>
            <span>${escapeHtml(model.ref || 'new-model')} · ${escapeHtml(model.providerId || 'provider')}</span>
          </div>
          ${!isNew
            ? renderSwitch({
                checked: model.active !== false,
                action: 'model-toggle',
                attrs: `data-model-ref="${escapeHtml(model.ref)}" data-enabled="${model.active !== false ? 'true' : 'false'}"`,
                label: model.active !== false ? '已启用' : '已禁用',
              })
            : ''}
        </div>
        <div class="fig-meta-cards">
          <div class="fig-meta-card"><span>Provider</span><strong>${escapeHtml(model.providerId || '未设置')}</strong></div>
          <div class="fig-meta-card"><span>Model ID</span><strong>${escapeHtml(model.modelId || '未设置')}</strong></div>
          <div class="fig-meta-card"><span>OEM 使用数</span><strong>${escapeHtml(model.connected_brand_count || 0)}</strong></div>
        </div>
      </div>
      <form id="model-editor-form" class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>模型目录</h3>
          <span>主数据统一维护在 portal model catalog，OEM 侧只做勾选和装配</span>
        </div>
        <div class="form-grid form-grid--two">
          <label class="field">
            <span>Ref</span>
            <input class="field-input" name="ref" value="${fieldValue(model.ref)}" placeholder="provider/model" ${isNew ? '' : 'readonly'} />
          </label>
          <label class="field">
            <span>Label</span>
            <input class="field-input" name="label" value="${fieldValue(model.label)}" placeholder="显示名称" />
          </label>
          <label class="field">
            <span>Provider ID</span>
            <input class="field-input" name="provider_id" value="${fieldValue(model.providerId)}" placeholder="openai / deepseek" />
          </label>
          <label class="field">
            <span>Model ID</span>
            <input class="field-input" name="model_id" value="${fieldValue(model.modelId)}" placeholder="gpt-5.4" />
          </label>
          <label class="field">
            <span>API</span>
            <input class="field-input" name="api" value="${fieldValue(model.api || 'openai-completions')}" placeholder="openai-completions" />
          </label>
          <label class="field">
            <span>Base URL</span>
            <input class="field-input" name="base_url" value="${fieldValue(model.baseUrl || '')}" placeholder="https://api.example.com/v1" />
          </label>
          <label class="field">
            <span>Use Runtime OpenAI</span>
            <select class="field-select" name="use_runtime_openai">
              <option value="true"${model.useRuntimeOpenai !== false ? ' selected' : ''}>true</option>
              <option value="false"${model.useRuntimeOpenai === false ? ' selected' : ''}>false</option>
            </select>
          </label>
          <label class="field">
            <span>Auth Header</span>
            <select class="field-select" name="auth_header">
              <option value="true"${model.authHeader !== false ? ' selected' : ''}>true</option>
              <option value="false"${model.authHeader === false ? ' selected' : ''}>false</option>
            </select>
          </label>
          <label class="field">
            <span>Reasoning</span>
            <select class="field-select" name="reasoning">
              <option value="true"${model.reasoning === true ? ' selected' : ''}>true</option>
              <option value="false"${model.reasoning === true ? '' : ' selected'}>false</option>
            </select>
          </label>
          <label class="field">
            <span>状态</span>
            <select class="field-select" name="enabled">
              <option value="true"${model.active !== false ? ' selected' : ''}>启用</option>
              <option value="false"${model.active === false ? ' selected' : ''}>禁用</option>
            </select>
          </label>
          <label class="field field--wide">
            <span>Input Modalities</span>
            <textarea class="field-textarea" name="input_text" placeholder="每行一个，如 text / image">${escapeHtml((model.input || []).join('\n'))}</textarea>
          </label>
          <label class="field">
            <span>Context Window</span>
            <input class="field-input" name="context_window" type="number" min="0" value="${fieldValue(model.contextWindow || 0)}" />
          </label>
          <label class="field">
            <span>Max Tokens</span>
            <input class="field-input" name="max_tokens" type="number" min="0" value="${fieldValue(model.maxTokens || 0)}" />
          </label>
          <label class="field field--wide">
            <span>Metadata JSON</span>
            <textarea class="field-textarea" name="metadata_json">${escapeHtml(prettyJson(model.metadata || {}))}</textarea>
          </label>
        </div>
        <div class="action-row">
          <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>保存模型</button>
          ${isNew ? '' : `<button class="ghost-button" type="button" data-action="model-delete" data-model-ref="${escapeHtml(model.ref)}"${state.busy ? ' disabled' : ''}>删除模型</button>`}
        </div>
      </form>
      <section class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>品牌访问权限</h3>
          <span>${escapeHtml(model.connected_brand_count || 0)} 个 OEM 已启用</span>
        </div>
        <div class="chip-grid">
          ${(model.connectedBrands || []).length
            ? model.connectedBrands
                .map(
                  (brand) => `
                    <button class="chip chip--interactive" type="button" data-action="select-brand" data-brand-id="${escapeHtml(brand.brand_id)}">
                      ${escapeHtml(brand.display_name)}
                    </button>
                  `,
                )
                .join('')
            : `<div class="empty-state">当前没有 OEM 绑定此模型。</div>`}
        </div>
      </section>
      ${renderCapabilityBrandMatrix('model', model)}
    </div>
  `;
}

function renderCapabilityBrandMatrix(type, item) {
  const brands = state.capabilities?.brands || [];
  const connectedIds = new Set(
    (type === 'skill' || type === 'model' ? item.connectedBrands : item.connected_brands || []).map((brand) => brand.brand_id),
  );
  return `
    <section class="fig-card fig-card--subtle">
      <div class="fig-card__head">
        <h3>${type === 'skill' ? 'Skill / Brand Matrix' : type === 'model' ? 'Model / Brand Matrix' : 'MCP / Brand Matrix'}</h3>
        <span>按品牌查看能力开放范围</span>
      </div>
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>品牌</th>
              <th>状态</th>
              <th>${type === 'skill' || type === 'mcp' ? '已安装' : '已连接'}</th>
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
    const kind = String(item.metadata?.kind || '').trim();
    if (state.filters.assetKind !== 'all' && kind !== state.filters.assetKind) {
      return false;
    }
    if (!query) return true;
    return [item.assetKey, item.brandDisplayName, item.objectKey, item.contentType, kind].some((value) =>
      String(value || '').toLowerCase().includes(query),
    );
  });
}

function renderAssetsPage() {
  const items = getFilteredAssets();
  const kinds = Array.from(
    new Set(state.assets.map((item) => String(item.metadata?.kind || '').trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const typeTabs = ['all', ...kinds];

  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner fig-page__header-inner--stack">
          <div class="fig-page__header-row">
            <div>
              <h1>资源管理</h1>
              <p class="fig-page__description">品牌资源库，真实读写 portal assets 和 MinIO</p>
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
        ${renderPageGuide('资源管理怎么用', [
          '这里是所有品牌的统一资源库，可上传 logo、favicon、hero 图等素材。',
          '资源上传时要填写稳定的 asset key，前端按这个 key 取图。',
          '资源本身入库后，若品牌端要正式切换，通常还需要对应品牌再发布快照。',
        ], 'assets')}
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
                    <span>App</span>
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
                    <input class="field-input" name="kind" placeholder="logo / favicon / hero" />
                  </label>
                  <label class="field">
                    <span>上传文件</span>
                    <input class="field-input" name="file" type="file" />
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
                          isImageLike(item.contentType, item.publicUrl, item.objectKey)
                            ? `<img class="fig-asset-card__image" src="${escapeHtml(resolveAssetUrl(item))}" alt="${escapeHtml(item.assetKey)}" />`
                            : `<div class="asset-thumb asset-thumb--placeholder">${escapeHtml((item.assetKey || 'AS').slice(0, 2).toUpperCase())}</div>`
                        }
                      </div>
                      <div class="fig-asset-card__body">
                        <div class="fig-asset-card__title">${escapeHtml(item.assetKey)}</div>
                        <div class="fig-asset-card__meta">${escapeHtml(String(item.metadata?.kind || 'asset'))} • ${escapeHtml(item.storageProvider || 's3')}</div>
                        <div class="fig-asset-card__brand">${escapeHtml(item.brandDisplayName || item.brandId)}</div>
                        <div class="fig-asset-card__actions">
                          <button class="text-button" type="button" data-action="select-brand" data-brand-id="${escapeHtml(item.brandId)}">打开品牌</button>
                          ${
                            item.publicUrl || item.objectKey
                              ? `<a class="text-link" href="${escapeHtml(resolveAssetUrl(item))}" target="_blank" rel="noreferrer">打开资源</a>`
                              : ''
                          }
                          <button class="text-button" type="button" data-action="delete-asset" data-brand-id="${escapeHtml(item.brandId)}" data-asset-key="${escapeHtml(item.assetKey)}">删除</button>
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
  const desktopBrandId = state.filters.releaseBrand !== 'all' ? state.filters.releaseBrand : '';
  const desktopBrandDetail = desktopBrandId ? state.portalAppDetails[desktopBrandId] || null : null;
  const desktopReleaseChannel = state.selectedDesktopReleaseChannel === 'dev' ? 'dev' : 'prod';
  const desktopReleaseConfig = desktopBrandDetail ? getDesktopReleaseConfig(desktopBrandDetail.app) : null;
  const desktopDraft = desktopReleaseConfig ? desktopReleaseConfig[desktopReleaseChannel].draft : null;
  const desktopPublished = desktopReleaseConfig ? desktopReleaseConfig[desktopReleaseChannel].published : null;
  const renderDesktopTargetCard = (platform, arch) => {
    const target = findDesktopReleaseTarget(desktopDraft, platform, arch);
    const publishedTarget = findDesktopReleaseTarget(desktopPublished, platform, arch);
    const fileRow = (label, field, publishedField = null) => `
      <div class="fig-meta-card">
        <span>${label}</span>
        <strong>${escapeHtml(field?.fileName || '未上传')}</strong>
        ${publishedField?.fileName ? `<div class="text-[11px] text-[var(--text-secondary)]">已生效：${escapeHtml(publishedField.fileName)}</div>` : ''}
        <input class="field-input" type="file" name="desktop_file_${platform}_${arch}_${label === '安装包' ? 'installer' : label === 'Updater' ? 'updater' : 'signature'}" />
      </div>
    `;
    return `
      <section class="fig-card fig-card--subtle">
        <div class="fig-card__head">
          <h3>${escapeHtml(formatDesktopTargetLabel(platform, arch))}</h3>
          <span>要求 installer / updater / signature 成套存在</span>
        </div>
        <div class="fig-meta-cards">
          ${fileRow('安装包', target?.installer, publishedTarget?.installer)}
          ${fileRow('Updater', target?.updater, publishedTarget?.updater)}
          ${fileRow('Signature', target?.signature, publishedTarget?.signature)}
        </div>
      </section>
    `;
  };
  return `
    <div class="fig-page">
      <div class="fig-page__header">
        <div class="fig-page__header-inner">
          <div>
            <h1>版本发布</h1>
            <p class="fig-page__description">桌面安装包发布、强更策略与 portal app 快照版本时间线</p>
          </div>
        </div>
      </div>
      <div class="fig-page__body">
        ${renderPageGuide('版本发布怎么用', [
          '先选择品牌，再维护该品牌桌面端的 dmg、exe、updater 和签名文件。',
          '版本号、强更阈值、说明文案都在这里统一配置并发布生效。',
          '下方时间线用于回看历史快照和对比当前草稿差异。',
        ], 'releases')}
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
        <section class="fig-card">
          <div class="fig-card__head">
            <div>
              <h3>桌面发布中心</h3>
              <span>上传 dmg / exe / updater / sig，并在同一页开启强更策略</span>
            </div>
          </div>
          ${
            desktopBrandId && desktopBrandDetail
              ? `
                <form id="desktop-release-publish-form" class="space-y-4">
                  <input type="hidden" name="brand_id" value="${escapeHtml(desktopBrandId)}" />
                  <div class="fig-toolbar">
                    <label class="field">
                      <span>发布 Channel</span>
                      <select class="field-select" name="channel" data-state-key="selectedDesktopReleaseChannel">
                        <option value="prod"${desktopReleaseChannel === 'prod' ? ' selected' : ''}>prod</option>
                        <option value="dev"${desktopReleaseChannel === 'dev' ? ' selected' : ''}>dev</option>
                      </select>
                    </label>
                    <label class="field">
                      <span>版本号</span>
                      <input class="field-input" name="version" value="${fieldValue(desktopDraft?.version || desktopPublished?.version || '')}" placeholder="例如 1.4.7" />
                    </label>
                    <label class="field">
                      <span>Force Below</span>
                      <input class="field-input" name="force_update_below_version" value="${fieldValue(desktopDraft?.policy?.forceUpdateBelowVersion || desktopPublished?.policy?.forceUpdateBelowVersion || '')}" placeholder="例如 1.4.6" />
                    </label>
                  </div>
                  <div class="fig-meta-cards">
                    <div class="fig-meta-card"><span>当前草稿</span><strong>${escapeHtml(desktopDraft?.version || '未配置')}</strong></div>
                    <div class="fig-meta-card"><span>当前已生效</span><strong>${escapeHtml(desktopPublished?.version || '未发布')}</strong></div>
                    <div class="fig-meta-card"><span>已生效时间</span><strong>${escapeHtml(formatDateTime(desktopPublished?.publishedAt || ''))}</strong></div>
                  </div>
                  <label class="field">
                    <span>发布说明</span>
                    <textarea class="field-input" name="notes" rows="3" placeholder="写给更新弹窗 / updater notes 的说明">${fieldValue(desktopDraft?.notes || desktopPublished?.notes || '')}</textarea>
                  </label>
                  <div class="fig-meta-cards">
                    <label class="fig-meta-card">
                      <span>开启强更</span>
                      <input type="checkbox" name="mandatory"${desktopDraft?.policy?.mandatory || desktopPublished?.policy?.mandatory ? ' checked' : ''} />
                    </label>
                    <label class="fig-meta-card">
                      <span>允许当前任务跑完</span>
                      <input type="checkbox" name="allow_current_run_to_finish"${
                        desktopDraft?.policy?.allowCurrentRunToFinish ?? desktopPublished?.policy?.allowCurrentRunToFinish ?? true
                          ? ' checked'
                          : ''
                      } />
                    </label>
                    <div class="fig-meta-card">
                      <span>策略说明</span>
                      <strong>${escapeHtml(desktopPublished?.policy?.reasonMessage || '未配置')}</strong>
                    </div>
                  </div>
                  <label class="field">
                    <span>强更说明文案</span>
                    <textarea class="field-input" name="reason_message" rows="2" placeholder="例如：当前版本存在已知稳定性问题，请在当前任务完成后升级。">${fieldValue(
                      desktopDraft?.policy?.reasonMessage || desktopPublished?.policy?.reasonMessage || '',
                    )}</textarea>
                  </label>
                  <div class="space-y-3">
                    ${renderDesktopTargetCard('darwin', 'aarch64')}
                    ${renderDesktopTargetCard('darwin', 'x64')}
                    ${renderDesktopTargetCard('windows', 'x64')}
                    ${renderDesktopTargetCard('windows', 'aarch64')}
                  </div>
                  <div class="fig-release-card__actions">
                    <button class="solid-button" type="submit"${state.busy ? ' disabled' : ''}>${state.busy ? '发布中…' : '发布并生效'}</button>
                  </div>
                </form>
              `
              : `
                <div class="empty-state empty-state--panel">
                  先在上方选择一个品牌，再管理该品牌的桌面安装包与强更策略。
                </div>
              `
          }
        </section>
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
                                    <div><span>当前草稿 Diff</span><strong>${escapeHtml(releaseDiffAreas.join(' / ') || diffAreas.join(' / ') || '无差异')}</strong></div>
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
            <p class="fig-page__description">portal app 的完整操作审计记录</p>
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
        ${renderPageGuide('审计日志怎么看', [
          '这里记录 portal app 的关键操作，包括保存草稿、发布、回滚、资源变更等。',
          '先按品牌、操作类型或关键词筛选，再点具体记录查看 payload。',
          '发现异常后，可以直接从详情跳回对应品牌继续排查。',
        ], 'audit')}
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
                            <div class="fig-audit-row__detail">${escapeHtml(item.environment || 'portal')}</div>
                          </div>
                          <div>${escapeHtml(item.brandDisplayName || item.brandId)}</div>
                          <div>${escapeHtml(item.actorName || item.actorUsername || 'system')}</div>
                          <div>${escapeHtml(item.environment || 'portal')}</div>
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
                  <div class="fig-meta-card"><span>环境</span><strong>${escapeHtml(selectedAudit.environment || 'portal')}</strong></div>
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
          <div class="brand-lockup brand-lockup--login">
            ${renderAdminLogo('brand-mark--login')}
            <div class="brand-lockup__copy">
              <p class="eyebrow">iClaw management console</p>
              <div class="brand-lockup__title">iClaw管理控制台</div>
            </div>
          </div>
          <h1>把品牌、版本、技能与发布放进同一个运营平面</h1>
          <p class="login-copy">
            当前后台直连真实 control-plane 接口，按 iClaw管理控制台设计稿重构。默认账号：<strong>admin / admin</strong>。
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
      : state.route === 'agent-center'
        ? renderAgentCenterPage()
      : state.route === 'brand-detail'
        ? renderBrandDetailPage()
        : isCapabilityRoute(state.route)
          ? renderSkillsMcpPage()
          : state.route === 'cloud-skills'
            ? renderCloudSkillsPage()
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

  if (form.id === 'desktop-release-publish-form') {
    await publishDesktopRelease(new FormData(form));
    return;
  }

  if (form.id === 'agent-editor-form') {
    await saveAgentCatalogEntry(new FormData(form));
    return;
  }

  if (form.id === 'skill-import-form') {
    await importSkill(new FormData(form));
    return;
  }

  if (form.id === 'skill-sync-source-form') {
    await saveSkillSyncSource(new FormData(form));
    return;
  }

  if (form.id === 'mcp-editor-form') {
    await saveMcpCatalogEntry(new FormData(form));
    return;
  }

  if (form.id === 'model-editor-form') {
    await saveModelCatalogEntry(new FormData(form));
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
    if (isCapabilityRoute(state.route)) {
      state.capabilityMode = getCapabilityModeForRoute(state.route);
    }
    render();
    return;
  }

  if (action === 'toggle-create-brand') {
    state.showCreateBrandForm = !state.showCreateBrandForm;
    render();
    return;
  }

  if (action === 'toggle-agent-import') {
    state.showAgentImportPanel = !state.showAgentImportPanel;
    render();
    return;
  }

  if (action === 'toggle-skill-import') {
    state.showSkillImportPanel = !state.showSkillImportPanel;
    render();
    return;
  }

  if (action === 'toggle-skill-sync-source-form') {
    state.showSkillSyncSourceForm = !state.showSkillSyncSourceForm;
    render();
    return;
  }

  if (action === 'select-skill-sync-source') {
    state.selectedSkillSyncSourceId = target.getAttribute('data-source-id') || '';
    render();
    return;
  }

  if (action === 'run-skill-sync') {
    await runSkillSync(target.getAttribute('data-source-id') || '');
    return;
  }

  if (action === 'select-cloud-skill') {
    state.selectedCloudSkillSlug = target.getAttribute('data-skill-slug') || '';
    render();
    return;
  }

  if (action === 'new-agent') {
    state.route = 'agent-center';
    state.selectedAgentSlug = '__new__';
    state.showAgentImportPanel = true;
    render();
    return;
  }

  if (action === 'select-agent') {
    state.route = 'agent-center';
    state.selectedAgentSlug = target.getAttribute('data-agent-slug') || '';
    state.showAgentImportPanel = false;
    render();
    return;
  }

  if (action === 'agent-filter-reset') {
    state.filters.agentQuery = '';
    state.filters.agentStatus = 'all';
    state.filters.agentSurface = 'all';
    render();
    return;
  }

  if (action === 'agent-toggle') {
    const enabled = target.getAttribute('data-enabled') === 'true';
    await setAgentEnabled(target.getAttribute('data-agent-slug') || '', !enabled);
    return;
  }

  if (action === 'agent-delete') {
    const slug = target.getAttribute('data-agent-slug') || '';
    if (window.confirm(`确认删除 Agent ${slug}？`)) {
      await deleteAgentCatalogEntry(slug);
    }
    return;
  }

  if (action === 'cloud-skill-toggle') {
    const slug = target.getAttribute('data-skill-slug') || '';
    const enabled = target.getAttribute('data-enabled') === 'true';
    await setCloudSkillEnabled(slug, !enabled);
    return;
  }

  if (action === 'new-skill') {
    state.capabilityMode = 'skills';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    state.selectedSkillSlug = '__new__';
    state.showSkillImportPanel = true;
    render();
    return;
  }

  if (action === 'new-mcp') {
    state.capabilityMode = 'mcp';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    state.selectedMcpKey = '__new__';
    state.mcpTestResult = null;
    render();
    return;
  }

  if (action === 'new-model') {
    state.capabilityMode = 'models';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    state.selectedModelRef = '__new__';
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
    state.brandDetailTab = 'desktop';
    await loadBrandDetail(target.getAttribute('data-brand-id') || '');
    return;
  }

  if (action === 'brand-tab') {
    captureBrandEditorBuffer();
    state.brandDetailTab = target.getAttribute('data-tab') || 'desktop';
    render();
    return;
  }

  if (action === 'brand-tab-group') {
    captureBrandEditorBuffer();
    const groupId = target.getAttribute('data-group-id') || '';
    const group = BRAND_DETAIL_TAB_GROUPS.find((item) => item.id === groupId) || BRAND_DETAIL_TAB_GROUPS[0];
    state.brandDetailTab = group?.tabs[0] || 'desktop';
    render();
    return;
  }

  if (action === 'capability-mode') {
    state.capabilityMode = target.getAttribute('data-mode') || 'skills';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    render();
    return;
  }

  if (action === 'capability-filter-reset') {
    resetCapabilityFilters();
    render();
    return;
  }

  if (action === 'select-skill') {
    state.capabilityMode = 'skills';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    state.selectedSkillSlug = target.getAttribute('data-skill-slug') || '';
    state.showSkillImportPanel = state.selectedSkillSlug === '__new__';
    render();
    return;
  }

  if (action === 'select-mcp') {
    state.capabilityMode = 'mcp';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    state.selectedMcpKey = target.getAttribute('data-mcp-key') || '';
    state.mcpTestResult = null;
    render();
    return;
  }

  if (action === 'select-model') {
    state.capabilityMode = 'models';
    state.route = getCapabilityRouteForMode(state.capabilityMode);
    state.selectedModelRef = target.getAttribute('data-model-ref') || '';
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

  if (action === 'toggle-brand-menu') {
    toggleBrandCapability('menu', target.getAttribute('data-menu-key') || '');
    return;
  }

  if (action === 'move-brand-menu-up') {
    moveBrandMenu(target.getAttribute('data-menu-key') || '', 'up');
    return;
  }

  if (action === 'move-brand-menu-down') {
    moveBrandMenu(target.getAttribute('data-menu-key') || '', 'down');
    return;
  }

  if (action === 'toggle-brand-composer-control') {
    toggleBrandComposerControl(target.getAttribute('data-control-key') || '');
    return;
  }

  if (action === 'move-brand-composer-control-up') {
    moveBrandComposerControl(target.getAttribute('data-control-key') || '', 'up');
    return;
  }

  if (action === 'move-brand-composer-control-down') {
    moveBrandComposerControl(target.getAttribute('data-control-key') || '', 'down');
    return;
  }

  if (action === 'toggle-brand-composer-shortcut') {
    toggleBrandComposerShortcut(target.getAttribute('data-shortcut-key') || '');
    return;
  }

  if (action === 'move-brand-composer-shortcut-up') {
    moveBrandComposerShortcut(target.getAttribute('data-shortcut-key') || '', 'up');
    return;
  }

  if (action === 'move-brand-composer-shortcut-down') {
    moveBrandComposerShortcut(target.getAttribute('data-shortcut-key') || '', 'down');
    return;
  }

  if (action === 'toggle-brand-model') {
    toggleBrandCapability('model', target.getAttribute('data-model-ref') || '');
    return;
  }

  if (action === 'toggle-brand-model-recommended') {
    toggleBrandRecommendedModel(target.getAttribute('data-model-ref') || '');
    return;
  }

  if (action === 'skill-toggle') {
    const enabled = (target.getAttribute('data-enabled') || '') === 'true';
    await setSkillEnabled(target.getAttribute('data-skill-slug') || '', !enabled);
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

  if (action === 'model-toggle') {
    const enabled = (target.getAttribute('data-enabled') || '') === 'true';
    await setModelEnabled(target.getAttribute('data-model-ref') || '', !enabled);
    return;
  }

  if (action === 'model-delete') {
    const ref = target.getAttribute('data-model-ref') || '';
    if (window.confirm(`确认删除模型 ${ref}？`)) {
      await deleteModelCatalogEntry(ref);
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
  const stateKey = target.getAttribute('data-state-key');
  if (stateKey === 'selectedDesktopReleaseChannel') {
    state.selectedDesktopReleaseChannel = target.value === 'dev' ? 'dev' : 'prod';
    render();
    return;
  }
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

applyThemeMode(state.themeMode);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.themeMode === 'system') {
    applyThemeMode('system');
    render();
  }
});

render();
ensureSession();
