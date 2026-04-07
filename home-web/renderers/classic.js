import {asObject, escapeHtml, findBlock, getEnabledBlocks, getPage, renderFooterLinks, trimString} from './shared.js';

function resolveHeader(runtimeBrand) {
  const siteShell = asObject(runtimeBrand.marketingSite.siteShell);
  const header = asObject(siteShell.header);
  const props = asObject(header.props);
  return {
    enabled: header.enabled !== false,
    brandLabel: trimString(props.brandLabel) || runtimeBrand.website.brandLabel || runtimeBrand.displayName,
    primaryCtaLabel: trimString(asObject(props.primaryCta).label) || runtimeBrand.website.topCtaLabel || '下载',
    primaryCtaHref: trimString(asObject(props.primaryCta).href) || '#download',
  };
}

function resolveFooter(runtimeBrand) {
  const siteShell = asObject(runtimeBrand.marketingSite.siteShell);
  const footer = asObject(siteShell.footer);
  const props = asObject(footer.props);
  return {
    enabled: footer.enabled !== false,
    columns: asObject(props).columns || [],
    legalLinks: asObject(props).legalLinks || [],
    copyrightText:
      trimString(props.copyrightText) || `© ${new Date().getFullYear()} ${runtimeBrand.displayName}. All rights reserved.`,
    icpText: trimString(props.icpText),
  };
}

function renderDownloadCards(downloads) {
  return downloads
    .map((item) => {
      const action =
        item.status === 'ready'
          ? `<a class="action ready" href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">立即下载</a>`
          : '<button class="action soon" type="button" disabled>敬请期待</button>';
      return `
        <article class="download-card tone-${escapeHtml(item.tone)}">
          <div class="platform-icon">${escapeHtml(item.icon)}</div>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="note">${escapeHtml(item.note)}</p>
          ${action}
        </article>
      `;
    })
    .join('');
}

export function renderClassicTemplate(runtimeBrand, context) {
  const page = getPage(runtimeBrand, 'home');
  const blocks = getEnabledBlocks(page);
  const hasHero = Boolean(findBlock(page, (item) => trimString(item.blockKey).startsWith('hero.'))) || blocks.length === 0;
  const hasDownload =
    Boolean(findBlock(page, (item) => trimString(item.blockKey).startsWith('download-grid.'))) || blocks.length === 0;
  const header = resolveHeader(runtimeBrand);
  const footer = resolveFooter(runtimeBrand);
  const downloads = renderDownloadCards(context.downloads);
  const showHeroArt = Boolean(runtimeBrand.assets.heroArtSrc);
  const showLayer1 = Boolean(runtimeBrand.assets.heroLayer1Src);
  const showPhoto = Boolean(runtimeBrand.assets.heroPhotoSrc);

  return `
    <div class="classic-shell">
      ${hasHero ? `
        <section class="hero" id="top">
          ${showHeroArt ? `<img class="hero-art" src="${escapeHtml(runtimeBrand.assets.heroArtSrc)}" alt="Hero artwork" />` : ''}
          <div class="hero-overlay"></div>
          <div class="hero-floats">
            ${showLayer1 ? `<img src="${escapeHtml(runtimeBrand.assets.heroLayer1Src)}" alt="Visual layer one" class="float-card float-a spring-layer" />` : ''}
            ${showPhoto ? `<img src="${escapeHtml(runtimeBrand.assets.heroPhotoSrc)}" alt="Product visual" class="float-photo float-b spring-layer" />` : ''}
          </div>
          <header class="hero-topbar">
            <div class="brand">
              <img src="${escapeHtml(runtimeBrand.assets.logoSrc)}" alt="${escapeHtml(runtimeBrand.assets.logoAlt || runtimeBrand.displayName)}" class="brand-logo" />
              <span>${escapeHtml(header.brandLabel)}</span>
            </div>
            <div class="hero-topbar__actions">
              <button id="theme-toggle" type="button" class="theme-toggle" aria-label="切换主题" data-action="cycle-theme">
                <span class="theme-toggle__label">Theme</span>
                <strong id="theme-toggle-text">跟随系统</strong>
              </button>
              ${header.enabled ? `<a href="${escapeHtml(header.primaryCtaHref)}" class="top-cta">${escapeHtml(header.primaryCtaLabel)}</a>` : ''}
            </div>
          </header>
          <div class="hero-content spring-layer">
            <p class="kicker">${escapeHtml(runtimeBrand.website.kicker)}</p>
            <h1 class="hero-title">
              <span class="hero-title-pre">${escapeHtml(runtimeBrand.website.heroTitlePre)}</span>
              <span class="hero-title-main">${escapeHtml(runtimeBrand.website.heroTitleMain)}</span>
            </h1>
            <p>${escapeHtml(runtimeBrand.website.heroDescription)}</p>
            <a href="#download" class="scroll-down">
              <span>${escapeHtml(runtimeBrand.website.scrollLabel)}</span>
              <strong>↓</strong>
            </a>
          </div>
        </section>
      ` : ''}
      ${hasDownload ? `
        <section class="download" id="download" aria-labelledby="downloads-title">
          <div class="download-head">
            <h2 id="downloads-title">${escapeHtml(runtimeBrand.website.downloadTitle)}</h2>
            <span class="env-pill">当前环境：${escapeHtml(context.envLabel)}</span>
          </div>
          <div class="downloads-grid">
            ${downloads}
          </div>
        </section>
      ` : ''}
      ${
        footer.enabled
          ? `
            <footer class="site-footer site-footer--classic">
              <div class="site-footer__main">
                <div class="site-footer__brand">
                  <img src="${escapeHtml(runtimeBrand.assets.logoSrc)}" alt="${escapeHtml(runtimeBrand.assets.logoAlt || runtimeBrand.displayName)}" class="site-footer__logo" />
                  <strong>${escapeHtml(runtimeBrand.displayName)}</strong>
                </div>
                <div class="site-footer__grid">
                  ${renderFooterLinks(footer.columns)}
                </div>
              </div>
              <div class="site-footer__legal">
                <span>${escapeHtml(footer.copyrightText)}</span>
                ${footer.icpText ? `<span>${escapeHtml(footer.icpText)}</span>` : ''}
                <div class="site-footer__mini-links">
                  ${renderFooterLinks([{links: footer.legalLinks}])}
                </div>
              </div>
            </footer>
          `
          : ''
      }
    </div>
  `;
}

function wireDownloadCards(root) {
  const downloadCards = Array.from(root.querySelectorAll('.download-card'));
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
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    },
    {threshold: 0.2},
  );

  downloadCards.forEach((card, idx) => {
    card.style.transitionDelay = `${idx * 70}ms`;
    io.observe(card);
  });
}

function wireHeroParallax(root) {
  const hero = root.querySelector('.hero');
  const layers = Array.from(root.querySelectorAll('.spring-layer'));
  const creature = root.querySelector('.float-photo');
  if (!hero || layers.length === 0) {
    return;
  }

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let raf = 0;

  const animate = () => {
    currentX += (targetX - currentX) * 0.14;
    currentY += (targetY - currentY) * 0.14;

    layers.forEach((el, idx) => {
      const depth = (idx + 1) * 0.55;
      const x = currentX * depth;
      const y = currentY * depth;
      if (creature && el === creature) {
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      } else {
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    });

    if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) {
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

export function enhanceClassicTemplate(root) {
  wireDownloadCards(root);
  wireHeroParallax(root);
}
