import './styles.css';
import {HOME_BRAND} from './brand.generated.js';
import {renderClassicTemplate, enhanceClassicTemplate} from './renderers/classic.js';
import {renderWealthTemplate, enhanceWealthTemplate} from './renderers/wealth.js';
import {asArray, asObject, escapeHtml, getPageByPath, trimString} from './renderers/shared.js';
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

function parsePreviewParam(raw) {
  const value = trimString(raw);
  if (!value) {
    return null;
  }
  try {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    const pad = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
    const decoded = decodeURIComponent(escape(atob(normalized + pad)));
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function currentAppName() {
  const url = new URL(window.location.href);
  return trimString(url.searchParams.get('app_name')) || HOME_BRAND.brandId;
}

function currentPreviewPayload() {
  const url = new URL(window.location.href);
  return parsePreviewParam(url.searchParams.get('preview'));
}

function homePageSeo(runtimeBrand) {
  const homePage = asArray(runtimeBrand.marketingSite.pages).find((item) => trimString(asObject(item).pageKey) === 'home') || null;
  return asObject(homePage?.seo);
}

function applyHead(runtimeBrand, currentPage = null) {
  const seo = currentPage ? asObject(currentPage.seo) : homePageSeo(runtimeBrand);
  document.title = trimString(seo.title) || runtimeBrand.website.homeTitle;

  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) {
    descriptionMeta.setAttribute('content', trimString(seo.description) || runtimeBrand.website.metaDescription);
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
  const appName = currentAppName();
  const previewPayload = currentPreviewPayload();
  try {
    const response = await fetch(
      `${CONTROL_PLANE_BASE_URL}/portal/public-config?app_name=${encodeURIComponent(appName)}&surface_key=home-web`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );
    let payload = null;
    if (response.ok) {
      const result = await response.json();
      if (result?.success) {
        payload = result.data;
      }
    }
    if (previewPayload) {
      payload = {
        ...asObject(payload),
        ...asObject(previewPayload),
        config: {
          ...asObject(payload?.config),
          ...asObject(previewPayload?.config),
          surfaces: {
            ...asObject(asObject(payload?.config).surfaces),
            ...asObject(asObject(previewPayload?.config).surfaces),
          },
        },
        surfaceConfig: {
          ...asObject(payload?.surfaceConfig),
          ...asObject(asObject(asObject(previewPayload?.config).surfaces)['home-web']).config,
        },
        app: {
          ...asObject(payload?.app),
          appName,
        },
      };
    }
    return normalizeRuntimeBrand(HOME_BRAND, payload);
  } catch {
    if (previewPayload) {
      return normalizeRuntimeBrand(HOME_BRAND, {
        ...previewPayload,
        app: {
          appName,
          displayName: HOME_BRAND.displayName,
        },
        surfaceConfig: asObject(asObject(asObject(previewPayload?.config).surfaces)['home-web']).config,
      });
    }
    return normalizeRuntimeBrand(HOME_BRAND, null);
  }
}

async function loadDesktopReleaseEntries(appName) {
  try {
    const response = await fetch(
      `${CONTROL_PLANE_BASE_URL}/desktop/release-manifest?app_name=${encodeURIComponent(appName)}&channel=${encodeURIComponent(ENV_NAME)}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    return asArray(payload.entries).map((item) => asObject(item));
  } catch {
    return [];
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

function buildDownloads(runtimeBrand, desktopReleaseEntries = []) {
  const entryMap = new Map(
    desktopReleaseEntries
      .filter((item) => trimString(item.platform) === 'darwin')
      .map((item) => [trimString(item.arch), asObject(item)]),
  );
  const appleEntry = entryMap.get('aarch64') || null;
  const intelEntry = entryMap.get('x64') || null;
  const appleHref = appleEntry ? buildManifestBackedDownloadHref(runtimeBrand, appleEntry, 'aarch64') : buildDownloadHref(runtimeBrand, 'aarch64');
  const intelHref = intelEntry ? buildManifestBackedDownloadHref(runtimeBrand, intelEntry, 'x64') : '';
  return [
    {
      key: 'mac-apple-silicon',
      title: ENV_NAME === 'prod' ? 'Mac Apple Silicon' : 'Mac Apple Silicon (dev)',
      href: appleHref,
      note: ENV_NAME === 'prod' ? 'M 系列芯片 · 正式版' : 'M 系列芯片 · 开发版',
      icon: '⬢',
      tone: 'cyan',
      status: appleHref ? 'ready' : 'soon',
    },
    {
      key: 'mac-intel',
      title: ENV_NAME === 'prod' ? 'Mac Intel' : 'Mac Intel (dev)',
      href: intelHref,
      note: intelHref ? (ENV_NAME === 'prod' ? 'Intel 芯片 · 正式版' : 'Intel 芯片 · 开发版') : '敬请期待',
      icon: '◆',
      tone: 'violet',
      status: intelHref ? 'ready' : 'soon',
    },
    {key: 'windows', title: 'Windows', href: '', note: '敬请期待', icon: '▣', tone: 'amber', status: 'soon'},
    {key: 'ios', title: 'iOS', href: '', note: '敬请期待', icon: '◉', tone: 'cyan', status: 'soon'},
    {key: 'android', title: 'Android', href: '', note: '敬请期待', icon: '△', tone: 'violet', status: 'soon'},
  ];
}

function buildManifestBackedDownloadHref(runtimeBrand, entry, arch) {
  const baseUrl = ((runtimeBrand.distribution.downloads?.[ENV_NAME]?.publicBaseUrl || '') + '').trim().replace(/\/+$/, '');
  const artifactName = trimString(entry.artifact_name);
  if (!baseUrl || !artifactName) {
    return buildDownloadHref(runtimeBrand, arch);
  }
  return `${baseUrl}/mac/${arch}/${encodeURIComponent(artifactName)}`;
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

function renderGenericPage(runtimeBrand, currentPage) {
  const siteShell = asObject(runtimeBrand.marketingSite.siteShell);
  const header = asObject(siteShell.header);
  const headerProps = asObject(header.props);
  const footer = asObject(siteShell.footer);
  const footerProps = asObject(footer.props);
  const legalBlock = asArray(currentPage.blocks).find((item) => trimString(asObject(item).blockKey).startsWith('rich-text.')) || null;
  const legalProps = asObject(asObject(legalBlock).props);
  const paragraphs = String(legalProps.content || '')
    .split(/\n{2,}/g)
    .map((item) => trimString(item))
    .filter(Boolean);
  const templateClass = runtimeBrand.marketingSite.templateKey === 'wealth-premium' ? 'wealth-shell' : 'classic-shell';
  return `
    <div class="${escapeHtml(templateClass)}">
      <header class="${runtimeBrand.marketingSite.templateKey === 'wealth-premium' ? 'wealth-header' : 'hero-topbar'}">
        <div class="${runtimeBrand.marketingSite.templateKey === 'wealth-premium' ? 'wealth-brand' : 'brand'}">
          <img src="${escapeHtml(runtimeBrand.assets.logoSrc)}" alt="${escapeHtml(runtimeBrand.assets.logoAlt || runtimeBrand.displayName)}" class="${runtimeBrand.marketingSite.templateKey === 'wealth-premium' ? '' : 'brand-logo'}" />
          <span>
            <strong>${escapeHtml(trimString(headerProps.brandLabel) || runtimeBrand.displayName)}</strong>
          </span>
        </div>
        <div class="${runtimeBrand.marketingSite.templateKey === 'wealth-premium' ? 'wealth-header__actions' : 'hero-topbar__actions'}">
          <button id="theme-toggle" type="button" class="theme-toggle ${runtimeBrand.marketingSite.templateKey === 'wealth-premium' ? 'wealth-theme-toggle' : ''}" aria-label="切换主题" data-action="cycle-theme">
            <span class="theme-toggle__label">Theme</span>
            <strong id="theme-toggle-text">跟随系统</strong>
          </button>
          <a href="/" class="${runtimeBrand.marketingSite.templateKey === 'wealth-premium' ? 'wealth-secondary' : 'top-cta'}">返回首页</a>
        </div>
      </header>
      <main class="legal-page">
        <div class="legal-page__inner">
          <p class="legal-page__eyebrow">${escapeHtml(trimString(asObject(currentPage.seo).title) || trimString(legalProps.title) || currentPage.pageKey)}</p>
          <h1>${escapeHtml(trimString(legalProps.title) || trimString(asObject(currentPage.seo).title) || currentPage.pageKey)}</h1>
          <div class="legal-page__content">
            ${paragraphs.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}
          </div>
        </div>
      </main>
      <footer class="site-footer ${runtimeBrand.marketingSite.templateKey === 'wealth-premium' ? 'site-footer--wealth' : 'site-footer--classic'}">
        <div class="site-footer__main">
          <div class="site-footer__brand">
            <img src="${escapeHtml(runtimeBrand.assets.logoSrc)}" alt="${escapeHtml(runtimeBrand.assets.logoAlt || runtimeBrand.displayName)}" class="site-footer__logo" />
            <strong>${escapeHtml(runtimeBrand.displayName)}</strong>
          </div>
        </div>
        <div class="site-footer__legal">
          <span>${escapeHtml(trimString(footerProps.copyrightText) || `© ${new Date().getFullYear()} ${runtimeBrand.displayName}`)}</span>
          ${trimString(footerProps.icpText) ? `<span>${escapeHtml(trimString(footerProps.icpText))}</span>` : ''}
        </div>
      </footer>
    </div>
  `;
}

function renderApp(runtimeBrand) {
  const app = document.querySelector('#app');
  if (!app) {
    throw new Error('home-web mount failed');
  }

  const currentPage = getPageByPath(runtimeBrand, window.location.pathname) || null;
  document.body.dataset.templateKey = runtimeBrand.marketingSite.templateKey;
  if (currentPage && trimString(currentPage.pageKey) !== 'home') {
    app.innerHTML = renderGenericPage(runtimeBrand, currentPage);
    applyHead(runtimeBrand, currentPage);
    applyThemeMode(currentThemeMode);
    installThemeToggle();
    return;
  }

  const renderer = renderers[runtimeBrand.marketingSite.templateKey] || renderers['classic-download'];
  app.innerHTML = renderer.render(runtimeBrand, {
    envName: ENV_NAME,
    envLabel: ENV_LABEL,
    downloads: buildDownloads(runtimeBrand),
  });
  applyHead(runtimeBrand, currentPage);
  applyThemeMode(currentThemeMode);
  installThemeToggle();
  renderer.enhance?.(app, runtimeBrand, {envName: ENV_NAME, envLabel: ENV_LABEL});
}

let currentThemeMode = readStoredThemeMode();
applyThemeMode(currentThemeMode);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentThemeMode === 'system') {
    applyThemeMode('system');
  }
});

Promise.all([loadPublishedConfig(), loadDesktopReleaseEntries(currentAppName())]).then(([runtimeBrand, desktopReleaseEntries]) => {
  const app = document.querySelector('#app');
  if (!app) {
    throw new Error('home-web mount failed');
  }

  const currentPage = getPageByPath(runtimeBrand, window.location.pathname) || null;
  document.body.dataset.templateKey = runtimeBrand.marketingSite.templateKey;
  if (currentPage && trimString(currentPage.pageKey) !== 'home') {
    app.innerHTML = renderGenericPage(runtimeBrand, currentPage);
    applyHead(runtimeBrand, currentPage);
    applyThemeMode(currentThemeMode);
    installThemeToggle();
    return;
  }

  const renderer = renderers[runtimeBrand.marketingSite.templateKey] || renderers['classic-download'];
  app.innerHTML = renderer.render(runtimeBrand, {
    envName: ENV_NAME,
    envLabel: ENV_LABEL,
    downloads: buildDownloads(runtimeBrand, desktopReleaseEntries),
  });
  applyHead(runtimeBrand, currentPage);
  applyThemeMode(currentThemeMode);
  installThemeToggle();
  renderer.enhance?.(app, runtimeBrand, {envName: ENV_NAME, envLabel: ENV_LABEL});
});
