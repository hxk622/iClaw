import {
  asArray,
  asObject,
  escapeHtml,
  findBlock,
  getEnabledBlocks,
  getPage,
  renderFooterLinks,
  trimString,
} from './shared.js';

function defaultNav() {
  return [
    {label: '核心能力', href: '#capabilities'},
    {label: '适用场景', href: '#scenes'},
    {label: '安全合规', href: '#security'},
  ];
}

function defaultFeatureItems() {
  return [
    {
      title: '财富研究一体化',
      description: '把研究、问答、投顾交付与客户陪伴收进一个桌面工作台。',
    },
    {
      title: '金融语言更专业',
      description: '围绕基金、股票、组合、宏观与行业语境组织输出，不是通用聊天套壳。',
    },
    {
      title: '本地桌面交付',
      description: '下载即用，支持围绕客户资产与研究流程形成稳定工作入口。',
    },
  ];
}

function defaultScenarioItems() {
  return [
    {
      title: '财富顾问 / 投顾服务',
      description: '适合基金诊断、组合复盘、客户陪伴和日常顾问交付。',
    },
    {
      title: '研究与策略协同',
      description: '适合盘后复盘、主题梳理、资料整合和投研协同输出。',
    },
  ];
}

function defaultWorkflowSteps() {
  return [
    {title: '接收问题', description: '从客户问题、盘后任务或研究主题切入。'},
    {title: '调用能力', description: '根据品牌装配的模型、技能和数据连接完成分析。'},
    {title: '生成交付', description: '输出纪要、报告、比较表或投顾说明。'},
    {title: '沉淀复用', description: '把高频任务收敛成稳定模板与组织入口。'},
  ];
}

function defaultCapabilityItems() {
  return [
    {title: '多资产研究', description: '股票、基金、宏观与行业问题统一进入同一工作流。'},
    {title: '结构化输出', description: '支持摘要、表格、纪要、深度说明等交付形式。'},
    {title: '品牌化体验', description: '官网、Header、输入区、菜单与文案都可 OEM 装配。'},
    {title: '控制台治理', description: '通过 admin-web 统一管理页面、区块、素材与发布。'},
  ];
}

function defaultSecurityItems() {
  return ['品牌级配置集中管理', '桌面端分发链路稳定', '下载版本与官网联动', '营销文案与官网模板可独立发布'];
}

function resolveHeader(runtimeBrand) {
  const siteShell = asObject(runtimeBrand.marketingSite.siteShell);
  const header = asObject(siteShell.header);
  const props = asObject(header.props);
  return {
    enabled: header.enabled !== false,
    brandLabel: trimString(props.brandLabel) || runtimeBrand.website.brandLabel || runtimeBrand.displayName,
    navItems: asArray(props.navItems).length ? asArray(props.navItems) : defaultNav(),
    primaryCtaLabel: trimString(asObject(props.primaryCta).label) || runtimeBrand.website.topCtaLabel || '立即下载',
    primaryCtaHref: trimString(asObject(props.primaryCta).href) || '#download',
    subline: trimString(props.subline) || 'Wealth AI Desktop',
  };
}

function resolveFooter(runtimeBrand) {
  const siteShell = asObject(runtimeBrand.marketingSite.siteShell);
  const footer = asObject(siteShell.footer);
  const props = asObject(footer.props);
  return {
    enabled: footer.enabled !== false,
    columns:
      asArray(props.columns).length > 0
        ? asArray(props.columns)
        : [
            {
              title: '站点',
              links: [
                {label: '首页', href: '/'},
                {label: '下载', href: '#download'},
              ],
            },
          ],
    legalLinks:
      asArray(props.legalLinks).length > 0
        ? asArray(props.legalLinks)
        : [
            {label: '隐私政策', href: '/privacy'},
            {label: '用户协议', href: '/terms'},
          ],
    copyrightText:
      trimString(props.copyrightText) || `© ${new Date().getFullYear()} ${runtimeBrand.displayName}. All rights reserved.`,
    icpText: trimString(props.icpText),
  };
}

function renderWealthDownloads(downloads) {
  return downloads
    .map((item) => {
      const isReady = item.status === 'ready';
      return `
        <article class="wealth-download-card wealth-download-card--${escapeHtml(item.tone)}" data-reveal>
          <div class="wealth-download-card__icon">${escapeHtml(item.icon)}</div>
          <div class="wealth-download-card__body">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.note)}</span>
          </div>
          ${
            isReady
              ? `<a href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">下载</a>`
              : '<button type="button" disabled>敬请期待</button>'
          }
        </article>
      `;
    })
    .join('');
}

function renderCardList(items, className) {
  return asArray(items)
    .map((item) => {
      const entry = asObject(item);
      return `
        <article class="${escapeHtml(className)}" data-reveal>
          <h3>${escapeHtml(trimString(entry.title))}</h3>
          <p>${escapeHtml(trimString(entry.description))}</p>
        </article>
      `;
    })
    .join('');
}

function renderWorkflow(items) {
  return asArray(items)
    .map((item, index) => {
      const entry = asObject(item);
      return `
        <article class="wealth-step" data-reveal>
          <span class="wealth-step__index">0${index + 1}</span>
          <h3>${escapeHtml(trimString(entry.title))}</h3>
          <p>${escapeHtml(trimString(entry.description))}</p>
        </article>
      `;
    })
    .join('');
}

function renderSecurityList(items) {
  return asArray(items)
    .map((item) => `<li>${escapeHtml(trimString(item))}</li>`)
    .join('');
}

export function renderWealthTemplate(runtimeBrand, context) {
  const page = getPage(runtimeBrand, 'home');
  const blocks = getEnabledBlocks(page);
  const header = resolveHeader(runtimeBrand);
  const footer = resolveFooter(runtimeBrand);
  const heroBlock = asObject(findBlock(page, (item) => trimString(item.blockKey).startsWith('hero.')));
  const featureBlock = asObject(findBlock(page, (item) => trimString(item.blockKey).startsWith('feature-cards.')));
  const scenarioBlock = asObject(findBlock(page, (item) => trimString(item.blockKey).startsWith('scenario-cards.')));
  const workflowBlock = asObject(findBlock(page, (item) => trimString(item.blockKey).startsWith('workflow-steps.')));
  const capabilityBlock = asObject(findBlock(page, (item) => trimString(item.blockKey).startsWith('capability-grid.')));
  const securityBlock = asObject(findBlock(page, (item) => trimString(item.blockKey).startsWith('security')));
  const ctaBlock = asObject(findBlock(page, (item) => trimString(item.blockKey).startsWith('cta-banner.')));
  const showDownload =
    Boolean(findBlock(page, (item) => trimString(item.blockKey).startsWith('download-grid.'))) || blocks.length === 0;

  const heroProps = asObject(heroBlock.props);
  const featureProps = asObject(featureBlock.props);
  const scenarioProps = asObject(scenarioBlock.props);
  const workflowProps = asObject(workflowBlock.props);
  const capabilityProps = asObject(capabilityBlock.props);
  const securityProps = asObject(securityBlock.props);
  const ctaProps = asObject(ctaBlock.props);

  const featureItems = asArray(featureProps.items).length ? asArray(featureProps.items) : defaultFeatureItems();
  const scenarioItems = asArray(scenarioProps.items).length ? asArray(scenarioProps.items) : defaultScenarioItems();
  const workflowItems = asArray(workflowProps.steps).length ? asArray(workflowProps.steps) : defaultWorkflowSteps();
  const capabilityItems = asArray(capabilityProps.items).length ? asArray(capabilityProps.items) : defaultCapabilityItems();
  const securityItems = asArray(securityProps.items).length ? asArray(securityProps.items) : defaultSecurityItems();

  return `
    <div class="wealth-shell">
      <div class="wealth-shell__backdrop"></div>
      <header class="wealth-header">
        <a href="#top" class="wealth-brand">
          <img src="${escapeHtml(runtimeBrand.assets.logoSrc)}" alt="${escapeHtml(runtimeBrand.assets.logoAlt || runtimeBrand.displayName)}" />
          <span>
            <strong>${escapeHtml(header.brandLabel)}</strong>
            <small>${escapeHtml(header.subline)}</small>
          </span>
        </a>
        <nav class="wealth-nav">
          ${header.navItems
            .map((item) => {
              const entry = asObject(item);
              return `<a href="${escapeHtml(trimString(entry.href) || '#')}">${escapeHtml(trimString(entry.label) || '链接')}</a>`;
            })
            .join('')}
        </nav>
        <div class="wealth-header__actions">
          <button id="theme-toggle" type="button" class="theme-toggle wealth-theme-toggle" aria-label="切换主题" data-action="cycle-theme">
            <span class="theme-toggle__label">Theme</span>
            <strong id="theme-toggle-text">跟随系统</strong>
          </button>
          ${
            header.enabled
              ? `<a class="wealth-header__cta" href="${escapeHtml(header.primaryCtaHref)}">${escapeHtml(header.primaryCtaLabel)}</a>`
              : ''
          }
        </div>
      </header>

      <main>
        <section class="wealth-hero" id="top">
          <div class="wealth-hero__copy" data-reveal>
            <p class="wealth-kicker">${escapeHtml(trimString(heroProps.eyebrow) || runtimeBrand.website.kicker || 'Wealth AI Desktop')}</p>
            <h1>
              <span>${escapeHtml(trimString(heroProps.titlePre) || runtimeBrand.website.heroTitlePre)}</span>
              <strong>${escapeHtml(trimString(heroProps.titleMain) || runtimeBrand.website.heroTitleMain)}</strong>
            </h1>
            <p class="wealth-hero__description">${escapeHtml(trimString(heroProps.description) || runtimeBrand.website.heroDescription)}</p>
            <div class="wealth-hero__actions">
              <a class="wealth-primary" href="#download">${escapeHtml(runtimeBrand.website.topCtaLabel || '立即下载')}</a>
              <a class="wealth-secondary" href="#capabilities">查看能力</a>
            </div>
          </div>
          <div class="wealth-hero__panel" data-reveal>
            <div class="wealth-hero__panel-top">
              <span>品牌模板</span>
              <strong>${escapeHtml(runtimeBrand.marketingSite.templateKey)}</strong>
            </div>
            <div class="wealth-hero__quote">
              <label>官网环境</label>
              <strong>${escapeHtml(context.envLabel)}</strong>
            </div>
            <div class="wealth-hero__stats">
              <div><span>品牌</span><strong>${escapeHtml(runtimeBrand.displayName)}</strong></div>
              <div><span>首页区块</span><strong>${escapeHtml(String(blocks.length || 2))}</strong></div>
              <div><span>下载入口</span><strong>Mac 优先</strong></div>
            </div>
            ${
              runtimeBrand.assets.installerHeroSrc
                ? `<img class="wealth-hero__image" src="${escapeHtml(runtimeBrand.assets.installerHeroSrc)}" alt="${escapeHtml(runtimeBrand.displayName)} installer hero" />`
                : ''
            }
          </div>
        </section>

        ${
          showDownload
            ? `
              <section class="wealth-section" id="download">
                <div class="wealth-section__head" data-reveal>
                  <p>Download</p>
                  <h2>${escapeHtml(runtimeBrand.website.downloadTitle)}</h2>
                </div>
                <div class="wealth-download-grid">
                  ${renderWealthDownloads(context.downloads)}
                </div>
              </section>
            `
            : ''
        }

        <section class="wealth-section" id="features">
          <div class="wealth-section__head" data-reveal>
            <p>Features</p>
            <h2>${escapeHtml(trimString(featureProps.title) || '把金融语境做成官网与产品的一致体验')}</h2>
          </div>
          <div class="wealth-card-grid">
            ${renderCardList(featureItems, 'wealth-info-card')}
          </div>
        </section>

        <section class="wealth-section" id="scenes">
          <div class="wealth-section__head" data-reveal>
            <p>Scenes</p>
            <h2>${escapeHtml(trimString(scenarioProps.title) || '为财富管理与研究交付场景准备的模板骨架')}</h2>
          </div>
          <div class="wealth-card-grid wealth-card-grid--wide">
            ${renderCardList(scenarioItems, 'wealth-scene-card')}
          </div>
        </section>

        <section class="wealth-section">
          <div class="wealth-section__head" data-reveal>
            <p>Workflow</p>
            <h2>${escapeHtml(trimString(workflowProps.title) || '从官网到下载，再到产品交付的统一路径')}</h2>
          </div>
          <div class="wealth-steps">
            ${renderWorkflow(workflowItems)}
          </div>
        </section>

        <section class="wealth-section" id="capabilities">
          <div class="wealth-section__head" data-reveal>
            <p>Capabilities</p>
            <h2>${escapeHtml(trimString(capabilityProps.title) || '平台能力定义，OEM 只做装配')}</h2>
          </div>
          <div class="wealth-card-grid">
            ${renderCardList(capabilityItems, 'wealth-capability-card')}
          </div>
        </section>

        <section class="wealth-section wealth-section--security" id="security">
          <div class="wealth-section__head" data-reveal>
            <p>Governance</p>
            <h2>${escapeHtml(trimString(securityProps.title) || '官网配置纳入统一平台治理，而不是品牌分叉')}</h2>
          </div>
          <div class="wealth-security" data-reveal>
            <ul>${renderSecurityList(securityItems)}</ul>
          </div>
        </section>

        <section class="wealth-cta" data-reveal>
          <div>
            <p>Ready</p>
            <h2>${escapeHtml(trimString(ctaProps.title) || `${runtimeBrand.displayName} 已准备好接入 OEM 官网装配体系`)}</h2>
            <span>${escapeHtml(trimString(ctaProps.description) || '当前版本先支持双模板 renderer，后续继续进入 block catalog 与 admin 装配。')}</span>
          </div>
          <a href="#download">${escapeHtml(trimString(ctaProps.ctaLabel) || runtimeBrand.website.topCtaLabel || '立即下载')}</a>
        </section>
      </main>

      ${
        footer.enabled
          ? `
            <footer class="site-footer site-footer--wealth">
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

export function enhanceWealthTemplate(root) {
  const revealItems = Array.from(root.querySelectorAll('[data-reveal]'));
  if (revealItems.length === 0) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    {threshold: 0.14},
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 60, 360)}ms`;
    observer.observe(item);
  });
}
