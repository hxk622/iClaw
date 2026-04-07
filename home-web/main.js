import './styles.css';
import {HOME_BRAND} from './brand.generated.js';
import {renderClassicTemplate, enhanceClassicTemplate} from './renderers/classic.js';
import {renderWealthTemplate, enhanceWealthTemplate} from './renderers/wealth.js';
import {normalizeRuntimeBrand} from './runtime-config.js';

const ENV_NAME = (import.meta.env.VITE_BUILD_CHANNEL || (import.meta.env.PROD ? 'prod' : 'dev')).trim().toLowerCase();
const ENV_LABEL = ENV_NAME === 'prod' ? 'PROD' : 'DEV';
const CONTROL_PLANE_BASE_URL = ((import.meta.env.VITE_AUTH_BASE_URL || 'http://127.0.0.1:2130') + '')
  .trim()
  .replace(/\/+$/, '');
const THEME_STORAGE_KEY = 'iclaw.home-web.theme';
const renderers = {
  'classic-download': {
    render: renderClassicTemplate,
    enhance: enhanceClassicTemplate,
  },
  'wealth-premium': {
    render: renderWealthTemplate,
    enhance: enhanceWealthTemplate,
  },
};

function isThemeMode(value) {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredThemeMode() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(value) ? value : (isThemeMode(HOME_BRAND.defaultThemeMode) ? HOME_BRAND.defaultThemeMode : 'dark');
  } catch {
    return isThemeMode(HOME_BRAND.defaultThemeMode) ? HOME_BRAND.defaultThemeMode : 'dark';
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
  const label = document.querySelector('#theme-toggle-text');
  if (label) {
    label.textContent = mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '跟随系统';
  }
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

function applyHead(runtimeBrand) {
  const homePage = runtimeBrand.marketingSite.pages.find((item) => item.pageKey === 'home') || null;
  const seo = homePage?.seo || {};
  document.title = seo.title || runtimeBrand.website.homeTitle;

  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) {
    descriptionMeta.setAttribute('content', seo.description || runtimeBrand.website.metaDescription);
  }

  const favicon = document.getElementById('site-favicon');
  if (favicon instanceof HTMLLinkElement && runtimeBrand.assets.faviconPngSrc) {
    favicon.href = runtimeBrand.assets.faviconPngSrc;
  }

  const appleTouchIcon = document.getElementById('site-apple-touch-icon');
  if (appleTouchIcon instanceof HTMLLinkElement && runtimeBrand.assets.appleTouchIconSrc) {
    appleTouchIcon.href = runtimeBrand.assets.appleTouchIconSrc;
  }
}

async function loadPublishedConfig() {
  try {
    const response = await fetch(
      `${CONTROL_PLANE_BASE_URL}/portal/public-config?app_name=${encodeURIComponent(HOME_BRAND.brandId)}&surface_key=home-web`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );
    if (!response.ok) {
      return normalizeRuntimeBrand(HOME_BRAND, null);
    }
    const payload = await response.json();
    if (!payload?.success) {
      return normalizeRuntimeBrand(HOME_BRAND, null);
    }
    return normalizeRuntimeBrand(HOME_BRAND, payload.data);
  } catch {
    return normalizeRuntimeBrand(HOME_BRAND, null);
  }
}

function installThemeToggle() {
  const toggle = document.querySelector('[data-action="cycle-theme"]');
  if (!toggle) {
    return;
  }
  toggle.addEventListener('click', () => {
    currentThemeMode = cycleThemeMode(currentThemeMode);
    persistThemeMode(currentThemeMode);
    applyThemeMode(currentThemeMode);
  });
}

function renderApp(runtimeBrand) {
  const app = document.querySelector('#app');
  if (!app) {
    throw new Error('home-web mount failed');
  }

  const renderer = renderers[runtimeBrand.marketingSite.templateKey] || renderers['classic-download'];
  document.body.dataset.templateKey = runtimeBrand.marketingSite.templateKey;
  app.innerHTML = renderer.render(runtimeBrand, {
    envName: ENV_NAME,
    envLabel: ENV_LABEL,
    downloads: buildDownloads(runtimeBrand),
  });
  applyHead(runtimeBrand);
  applyThemeMode(currentThemeMode);
  installThemeToggle();
  renderer.enhance?.(app, runtimeBrand, {envName: ENV_NAME, envLabel: ENV_LABEL});
}

function buildDownloads(runtimeBrand) {
  return [
    {
      key: 'mac-apple-silicon',
      title: ENV_NAME === 'prod' ? 'Mac Apple Silicon' : 'Mac Apple Silicon (dev)',
      href: buildDownloadHref(runtimeBrand, 'aarch64'),
      note: ENV_NAME === 'prod' ? 'M 系列芯片 · 正式版' : 'M 系列芯片 · 开发版',
      icon: '⬢',
      tone: 'cyan',
      status: buildDownloadHref(runtimeBrand, 'aarch64') ? 'ready' : 'soon',
    },
    {
      key: 'mac-intel',
      title: ENV_NAME === 'prod' ? 'Mac Intel' : 'Mac Intel (dev)',
      href: buildDownloadHref(runtimeBrand, 'x64'),
      note: ENV_NAME === 'prod' ? 'Intel 芯片 · 正式版' : 'Intel 芯片 · 开发版',
      icon: '◆',
      tone: 'violet',
      status: buildDownloadHref(runtimeBrand, 'x64') ? 'ready' : 'soon',
    },
    {key: 'windows', title: 'Windows', href: '', note: '敬请期待', icon: '▣', tone: 'amber', status: 'soon'},
    {key: 'ios', title: 'iOS', href: '', note: '敬请期待', icon: '◉', tone: 'cyan', status: 'soon'},
    {key: 'android', title: 'Android', href: '', note: '敬请期待', icon: '△', tone: 'violet', status: 'soon'},
  ];
}

function buildDownloadHref(runtimeBrand, arch) {
  const baseUrl = ((runtimeBrand.distribution.downloads?.[ENV_NAME]?.publicBaseUrl || '') + '').trim().replace(/\/+$/, '');
  if (!baseUrl) {
    return '';
  }
  const publicReleaseVersion = ((runtimeBrand.release.version || '') + '').trim().replace(/\+/g, '.');
  const fileName = `${runtimeBrand.release.artifactBaseName}_${publicReleaseVersion}_${arch}_${ENV_NAME}.dmg`;
  return `${baseUrl}/darwin/${arch}/${encodeURIComponent(fileName)}`;
}

let currentThemeMode = readStoredThemeMode();
applyThemeMode(currentThemeMode);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentThemeMode === 'system') {
    applyThemeMode('system');
  }
});

loadPublishedConfig().then((runtimeBrand) => {
  renderApp(runtimeBrand);
});
