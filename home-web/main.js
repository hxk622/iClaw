import './styles.css';
import { HOME_BRAND } from './brand.generated.js';

const ENV_NAME = import.meta.env.PROD ? 'prod' : 'dev';
const ENV_LABEL = ENV_NAME === 'prod' ? 'PROD' : 'DEV';
const CONTROL_PLANE_BASE_URL = ((import.meta.env.VITE_AUTH_BASE_URL || 'http://127.0.0.1:2130') + '')
  .trim()
  .replace(/\/+$/, '');
const THEME_STORAGE_KEY = 'iclaw.home-web.theme';

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

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function deepMerge(...items) {
  const result = {};
  for (const item of items) {
    const source = asObject(item);
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = deepMerge(result[key], value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

function mergeRuntimeBrand(base, payload) {
  if (!payload || !payload.config) {
    return base;
  }

  const surfaceConfig = asObject(payload.surfaceConfig);
  return {
    ...base,
    displayName: payload.brand?.displayName || payload.app?.displayName || base.displayName,
    website: {
      ...base.website,
      ...asObject(payload.config.website),
      ...asObject(surfaceConfig.website),
    },
    assets: {
      ...base.assets,
      ...asObject(payload.config.assets),
      ...asObject(surfaceConfig.assets),
    },
    distribution: deepMerge(base.distribution, asObject(payload.config.distribution), asObject(surfaceConfig.distribution)),
    release: {
      ...base.release,
      publishedVersion: payload.publishedVersion || base.release.publishedVersion || 0,
    },
  };
}

function normalizeBaseUrl(value) {
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

function buildDownloadHref(runtimeBrand, arch) {
  const baseUrl = normalizeBaseUrl(runtimeBrand.distribution.downloads?.[ENV_NAME]?.publicBaseUrl);
  if (!baseUrl) {
    return '';
  }
  return `${baseUrl}/${runtimeBrand.release.artifactBaseName}_${runtimeBrand.release.version}_${arch}_${ENV_NAME}.dmg`;
}

function buildDownloads(runtimeBrand) {
  return [
    {
      title: ENV_NAME === 'prod' ? 'Mac Apple Silicon' : 'Mac Apple Silicon (dev)',
      href: buildDownloadHref(runtimeBrand, 'aarch64'),
      note: ENV_NAME === 'prod' ? 'M 系列芯片 · 正式版' : 'M 系列芯片 · 开发版',
      icon: '⬢',
      tone: 'cyan',
    },
    {
      title: ENV_NAME === 'prod' ? 'Mac Intel' : 'Mac Intel (dev)',
      href: buildDownloadHref(runtimeBrand, 'x64'),
      note: ENV_NAME === 'prod' ? 'Intel 芯片 · 正式版' : 'Intel 芯片 · 开发版',
      icon: '◆',
      tone: 'violet',
    },
    { title: 'Windows', href: '', note: '敬请期待', icon: '▣', tone: 'amber' },
    { title: 'iOS', href: '', note: '敬请期待', icon: '◉', tone: 'cyan' },
    { title: 'Android', href: '', note: '敬请期待', icon: '△', tone: 'violet' },
  ].map((item) => ({
    ...item,
    status: item.href ? 'ready' : 'soon',
  }));
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setImage(id, src, alt) {
  const element = document.getElementById(id);
  if (element instanceof HTMLImageElement) {
    element.src = src;
    if (alt) {
      element.alt = alt;
    }
  }
}

function wireDownloadCards(downloadCards) {
  for (const card of downloadCards) {
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;

    const tick = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      card.style.transform = `translate3d(${cx}px, ${cy}px, 0) scale(1)`;
      if (Math.abs(tx - cx) > 0.08 || Math.abs(ty - cy) > 0.08) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const queue = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      tx = nx * 10;
      ty = ny * 7;
      queue();
    });

    card.addEventListener('pointerleave', () => {
      tx = 0;
      ty = 0;
      queue();
    });
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        el.classList.add('is-visible');
        io.unobserve(el);
      }
    },
    {threshold: 0.2},
  );

  downloadCards.forEach((card, idx) => {
    card.style.transitionDelay = `${idx * 70}ms`;
    io.observe(card);
  });
}

function applyBrand(runtimeBrand) {
  document.title = runtimeBrand.website.homeTitle;

  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) {
    descriptionMeta.setAttribute('content', runtimeBrand.website.metaDescription);
  }

  const favicon = document.getElementById('site-favicon');
  if (favicon instanceof HTMLLinkElement) {
    favicon.href = runtimeBrand.assets.faviconPngSrc;
  }

  const appleTouchIcon = document.getElementById('site-apple-touch-icon');
  if (appleTouchIcon instanceof HTMLLinkElement) {
    appleTouchIcon.href = runtimeBrand.assets.appleTouchIconSrc;
  }

  setText('brand-label', runtimeBrand.website.brandLabel);
  setText('top-cta', runtimeBrand.website.topCtaLabel);
  setText('hero-kicker', runtimeBrand.website.kicker);
  setText('hero-title-pre', runtimeBrand.website.heroTitlePre);
  setText('hero-title-main', runtimeBrand.website.heroTitleMain);
  setText('hero-description', runtimeBrand.website.heroDescription);
  setText('scroll-label', runtimeBrand.website.scrollLabel);
  setText('downloads-title', runtimeBrand.website.downloadTitle);

  setImage('brand-logo', runtimeBrand.assets.logoSrc, runtimeBrand.assets.logoAlt);
  setImage('hero-art', runtimeBrand.assets.heroArtSrc, `${runtimeBrand.displayName} hero artwork`);
  setImage('hero-layer-1', runtimeBrand.assets.heroLayer1Src, `${runtimeBrand.displayName} visual layer one`);
  setImage('hero-photo', runtimeBrand.assets.heroPhotoSrc, `${runtimeBrand.displayName} product visual`);

  const envPill = document.querySelector('#env-pill');
  const grid = document.querySelector('#downloads-grid');

  if (!envPill || !grid) {
    throw new Error('Download page mount failed');
  }

  envPill.textContent = `当前环境：${ENV_LABEL}`;
  grid.replaceChildren();

  for (const item of buildDownloads(runtimeBrand)) {
    const card = document.createElement('article');
    card.className = `download-card tone-${item.tone}`;

    const icon = document.createElement('div');
    icon.className = 'platform-icon';
    icon.textContent = item.icon;

    const title = document.createElement('h3');
    title.textContent = item.title;

    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = item.note;

    const action = document.createElement(item.status === 'ready' ? 'a' : 'button');
    action.className = `action ${item.status === 'ready' ? 'ready' : 'soon'}`;

    if (item.status === 'ready') {
      action.textContent = '立即下载';
      action.href = item.href;
      action.target = '_blank';
      action.rel = 'noreferrer';
    } else {
      action.textContent = '敬请期待';
      action.disabled = true;
    }

    card.append(icon, title, note, action);
    grid.append(card);
  }

  wireDownloadCards(Array.from(document.querySelectorAll('.download-card')));
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
      return HOME_BRAND;
    }
    const payload = await response.json();
    if (!payload?.success) {
      return HOME_BRAND;
    }
    return mergeRuntimeBrand(HOME_BRAND, payload.data);
  } catch {
    return HOME_BRAND;
  }
}

let currentThemeMode = readStoredThemeMode();
applyThemeMode(currentThemeMode);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentThemeMode === 'system') {
    applyThemeMode('system');
  }
});

const themeToggle = document.querySelector('#theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    currentThemeMode = cycleThemeMode(currentThemeMode);
    persistThemeMode(currentThemeMode);
    applyThemeMode(currentThemeMode);
  });
}

const hero = document.querySelector('.hero');
const layers = Array.from(document.querySelectorAll('.spring-layer'));
const creature = document.querySelector('.float-photo');
if (hero && layers.length > 0) {
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let lifeTargetX = 0;
  let lifeTargetY = 0;
  let lifeTargetR = 0;
  let lifeTargetS = 0;
  let lifeX = 0;
  let lifeY = 0;
  let lifeR = 0;
  let lifeS = 0;
  let raf = 0;

  const animate = () => {
    currentX += (targetX - currentX) * 0.14;
    currentY += (targetY - currentY) * 0.14;
    lifeX += (lifeTargetX - lifeX) * 0.12;
    lifeY += (lifeTargetY - lifeY) * 0.12;
    lifeR += (lifeTargetR - lifeR) * 0.12;
    lifeS += (lifeTargetS - lifeS) * 0.12;

    layers.forEach((el, idx) => {
      const depth = (idx + 1) * 0.55;
      const x = currentX * depth;
      const y = currentY * depth;
      if (creature && el === creature) {
        el.style.transform = `translate3d(${x + lifeX}px, ${y + lifeY}px, 0) rotate(${lifeR}deg) scale(${1 + lifeS})`;
      } else {
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    });

    if (
      Math.abs(targetX - currentX) > 0.1 ||
      Math.abs(targetY - currentY) > 0.1 ||
      Math.abs(lifeTargetX - lifeX) > 0.1 ||
      Math.abs(lifeTargetY - lifeY) > 0.1 ||
      Math.abs(lifeTargetR - lifeR) > 0.02 ||
      Math.abs(lifeTargetS - lifeS) > 0.001
    ) {
      raf = requestAnimationFrame(animate);
    } else {
      raf = 0;
    }
  };

  const queue = () => {
    if (!raf) raf = requestAnimationFrame(animate);
  };

  hero.addEventListener('pointermove', (event) => {
    const rect = hero.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    targetX = ((event.clientX - cx) / rect.width) * 26;
    targetY = ((event.clientY - cy) / rect.height) * 18;
    queue();
  });

  hero.addEventListener('pointerleave', () => {
    targetX = 0;
    targetY = 0;
    queue();
  });
}

loadPublishedConfig().then((runtimeBrand) => {
  applyBrand(runtimeBrand);
});
