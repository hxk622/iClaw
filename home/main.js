import './styles.css';
import { HOME_BRAND } from './brand.generated.js';

const ENV_NAME = import.meta.env.PROD ? 'prod' : 'dev';
const ENV_LABEL = ENV_NAME === 'prod' ? 'PROD' : 'DEV';

function normalizeBaseUrl(value) {
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

function buildDownloadHref(arch) {
  const baseUrl = normalizeBaseUrl(HOME_BRAND.distribution.downloads?.[ENV_NAME]?.publicBaseUrl);
  if (!baseUrl) {
    return '';
  }
  return `${baseUrl}/${HOME_BRAND.release.artifactBaseName}_${HOME_BRAND.release.version}_${arch}_${ENV_NAME}.dmg`;
}

function buildDownloads() {
  return [
    {
      title: ENV_NAME === 'prod' ? 'Mac Apple Silicon' : 'Mac Apple Silicon (dev)',
      href: buildDownloadHref('aarch64'),
      note: ENV_NAME === 'prod' ? 'M 系列芯片 · 正式版' : 'M 系列芯片 · 开发版',
      icon: '⬢',
      tone: 'cyan',
    },
    {
      title: ENV_NAME === 'prod' ? 'Mac Intel' : 'Mac Intel (dev)',
      href: buildDownloadHref('x64'),
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

document.title = HOME_BRAND.website.homeTitle;

const descriptionMeta = document.querySelector('meta[name="description"]');
if (descriptionMeta) {
  descriptionMeta.setAttribute('content', HOME_BRAND.website.metaDescription);
}

const favicon = document.getElementById('site-favicon');
if (favicon instanceof HTMLLinkElement) {
  favicon.href = HOME_BRAND.assets.faviconPngSrc;
}

const appleTouchIcon = document.getElementById('site-apple-touch-icon');
if (appleTouchIcon instanceof HTMLLinkElement) {
  appleTouchIcon.href = HOME_BRAND.assets.appleTouchIconSrc;
}

setText('brand-label', HOME_BRAND.website.brandLabel);
setText('top-cta', HOME_BRAND.website.topCtaLabel);
setText('hero-kicker', HOME_BRAND.website.kicker);
setText('hero-title-pre', HOME_BRAND.website.heroTitlePre);
setText('hero-title-main', HOME_BRAND.website.heroTitleMain);
setText('hero-description', HOME_BRAND.website.heroDescription);
setText('scroll-label', HOME_BRAND.website.scrollLabel);
setText('downloads-title', HOME_BRAND.website.downloadTitle);

setImage('brand-logo', HOME_BRAND.assets.logoSrc, HOME_BRAND.assets.logoAlt);
setImage('hero-art', HOME_BRAND.assets.heroArtSrc, `${HOME_BRAND.displayName} hero artwork`);
setImage('hero-layer-1', HOME_BRAND.assets.heroLayer1Src, `${HOME_BRAND.displayName} visual layer one`);
setImage('hero-photo', HOME_BRAND.assets.heroPhotoSrc, `${HOME_BRAND.displayName} product visual`);

const envPill = document.querySelector('#env-pill');
const grid = document.querySelector('#downloads-grid');

if (!envPill || !grid) {
  throw new Error('Download page mount failed');
}

envPill.textContent = `当前环境：${ENV_LABEL}`;

for (const item of buildDownloads()) {
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

const downloadCards = Array.from(document.querySelectorAll('.download-card'));

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
  { threshold: 0.2 },
);

downloadCards.forEach((card, idx) => {
  card.style.transitionDelay = `${idx * 70}ms`;
  io.observe(card);
});

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
