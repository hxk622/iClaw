import { asObject, stringValue } from '../lib/adminApi';
import { useEffect, useState } from 'react';
import {
  actionLabel,
  formatDateTime,
  formatRelative,
  isImageLike,
  resolveAssetUrl,
  statusLabel,
} from '../lib/adminFormat';
import type { BrandDetailData } from '../lib/adminTypes';

type BrandDetailTabId =
  | 'desktop'
  | 'home-web'
  | 'welcome'
  | 'auth'
  | 'header'
  | 'sidebar'
  | 'input'
  | 'skills'
  | 'mcps'
  | 'recharge'
  | 'menus'
  | 'assets'
  | 'theme';

function renderJsonPreview(value: unknown) {
  return (
    <section className="fig-card fig-card--subtle">
      <div className="fig-card__head">
        <h3>配置预览</h3>
        <span>当前 tab 的真实配置 JSON</span>
      </div>
      <textarea className="code-input code-input--tall" readOnly value={JSON.stringify(value, null, 2)} />
    </section>
  );
}

function collectScalarEntries(
  source: Record<string, unknown>,
  preferredKeys: string[] = [],
  limit = 8,
) {
  const picked = new Set<string>();
  const entries: Array<{ label: string; value: string }> = [];
  const pushEntry = (key: string, value: unknown) => {
    if (picked.has(key)) return;
    if (value === null || value === undefined) return;
    if (typeof value === 'object') return;
    const normalized = String(value).trim();
    if (!normalized) return;
    picked.add(key);
    entries.push({ label: key, value: normalized });
  };

  preferredKeys.forEach((key) => pushEntry(key, source[key]));
  Object.entries(source).forEach(([key, value]) => {
    if (entries.length >= limit) return;
    pushEntry(key, value);
  });

  return entries.slice(0, limit);
}

function renderScalarSummary(
  title: string,
  description: string,
  source: Record<string, unknown>,
  preferredKeys: string[] = [],
) {
  const entries = collectScalarEntries(source, preferredKeys);
  return (
    <section className="fig-card fig-card--subtle">
      <div className="fig-card__head">
        <h3>{title}</h3>
        <span>{description}</span>
      </div>
      {entries.length ? (
        <div className="fig-meta-cards">
          {entries.map((entry) => (
            <div key={entry.label} className="fig-meta-card">
              <span>{entry.label}</span>
              <strong>{entry.value}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">当前没有可展示的结构化字段。</div>
      )}
    </section>
  );
}

function renderSkillBindings(detail: BrandDetailData) {
  const enabled = detail.skillBindings.filter((item) => item.enabled !== false);
  return (
    <section className="fig-card fig-card--subtle">
      <div className="fig-card__head">
        <h3>技能装配</h3>
        <span>{`${enabled.length} 个启用 / ${detail.skillBindings.length} 个绑定`}</span>
      </div>
      <div className="fig-list">
        {detail.skillBindings.length ? (
          detail.skillBindings.map((item, index) => {
            const config = asObject(item.config);
            return (
              <div key={stringValue(item.skillSlug) || index} className="fig-list-item fig-list-item--spread">
                <div>
                  <div className="fig-list-item__title">{stringValue(item.skillSlug) || '未命名 Skill'}</div>
                  <div className="fig-list-item__meta">
                    <span>{item.enabled !== false ? '已启用' : '已关闭'}</span>
                    {config.recommended === true ? <span>推荐</span> : null}
                    {config.default === true ? <span>默认</span> : null}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state">当前没有 Skill 绑定。</div>
        )}
      </div>
    </section>
  );
}

function renderMcpBindings(detail: BrandDetailData) {
  const enabled = detail.mcpBindings.filter((item) => item.enabled !== false);
  return (
    <section className="fig-card fig-card--subtle">
      <div className="fig-card__head">
        <h3>MCP 装配</h3>
        <span>{`${enabled.length} 个启用 / ${detail.mcpBindings.length} 个绑定`}</span>
      </div>
      <div className="fig-list">
        {detail.mcpBindings.length ? (
          detail.mcpBindings.map((item, index) => (
            <div key={stringValue(item.mcpKey) || index} className="fig-list-item fig-list-item--spread">
              <div>
                <div className="fig-list-item__title">{stringValue(item.mcpKey) || '未命名 MCP'}</div>
                <div className="fig-list-item__meta">
                  <span>{item.enabled !== false ? '已启用' : '已关闭'}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">当前没有 MCP 绑定。</div>
        )}
      </div>
    </section>
  );
}

function renderMenuBindings(detail: BrandDetailData) {
  return (
    <section className="fig-card fig-card--subtle">
      <div className="fig-card__head">
        <h3>左菜单栏</h3>
        <span>{`${detail.menuBindings.filter((item) => item.enabled !== false).length} 个启用`}</span>
      </div>
      <div className="fig-list">
        {detail.menuBindings.length ? (
          detail.menuBindings.map((item, index) => {
            const config = asObject(item.config);
            return (
              <div key={stringValue(item.menuKey) || index} className="fig-list-item fig-list-item--spread">
                <div>
                  <div className="fig-list-item__title">{stringValue(config.display_name || item.menuKey) || '未命名菜单'}</div>
                  <div className="fig-list-item__meta">
                    <span>{stringValue(item.menuKey)}</span>
                    <span>{item.enabled !== false ? '已启用' : '已关闭'}</span>
                    {stringValue(config.group_label) ? <span>{stringValue(config.group_label)}</span> : null}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state">当前没有菜单绑定。</div>
        )}
      </div>
    </section>
  );
}

function renderAssets(detail: BrandDetailData) {
  return (
    <section className="fig-assets-grid">
      {detail.assets.length ? (
        detail.assets.map((item, index) => (
          <article key={stringValue(item.assetKey) || index} className="fig-asset-card">
            <div className="fig-asset-card__preview">
              {isImageLike(stringValue(item.contentType), stringValue(item.publicUrl), stringValue(item.objectKey)) ? (
                <img
                  className="fig-asset-card__image"
                  src={resolveAssetUrl({
                    publicUrl: stringValue(item.publicUrl),
                    appName: stringValue(item.appName || detail.brand.brandId),
                    brandId: detail.brand.brandId,
                    assetKey: stringValue(item.assetKey),
                  })}
                  alt={stringValue(item.assetKey)}
                />
              ) : (
                <div className="asset-thumb asset-thumb--placeholder">{(stringValue(item.assetKey) || 'AS').slice(0, 2).toUpperCase()}</div>
              )}
            </div>
            <div className="fig-asset-card__body">
              <div className="fig-asset-card__title">{stringValue(item.assetKey)}</div>
              <div className="fig-asset-card__meta">{`${stringValue(asObject(item.metadata).kind || 'asset')} • ${stringValue(item.storageProvider || 's3')}`}</div>
              <div className="fig-asset-card__meta">{formatDateTime(stringValue(item.updatedAt))}</div>
            </div>
          </article>
        ))
      ) : (
        <div className="empty-state empty-state--panel">当前没有品牌资源。</div>
      )}
    </section>
  );
}

function renderTheme(detail: BrandDetailData) {
  const theme = asObject(detail.appConfig.theme);
  return (
    <section className="fig-card fig-card--subtle">
      <div className="fig-card__head">
        <h3>主题样式</h3>
        <span>Light / Dark Theme 草稿</span>
      </div>
      <div className="diff-grid">
        <label className="field">
          <span>Light Theme</span>
          <textarea className="code-input code-input--tall" readOnly value={JSON.stringify(asObject(theme.light), null, 2)} />
        </label>
        <label className="field">
          <span>Dark Theme</span>
          <textarea className="code-input code-input--tall" readOnly value={JSON.stringify(asObject(theme.dark), null, 2)} />
        </label>
      </div>
    </section>
  );
}

function renderRechargeBindings(detail: BrandDetailData) {
  return (
    <section className="fig-card fig-card--subtle">
      <div className="fig-card__head">
        <h3>充值套餐</h3>
        <span>{`${detail.rechargePackageBindings.filter((item) => item.enabled !== false).length} 个启用`}</span>
      </div>
      <div className="fig-list">
        {detail.rechargePackageBindings.length ? (
          detail.rechargePackageBindings.map((item, index) => (
            <div key={stringValue(item.packageId) || index} className="fig-list-item fig-list-item--spread">
              <div>
                <div className="fig-list-item__title">{stringValue(item.packageId) || '未命名套餐'}</div>
                <div className="fig-list-item__meta">
                  <span>{item.enabled !== false ? '已启用' : '已关闭'}</span>
                  {item.recommended === true ? <span>推荐</span> : null}
                  {item.default === true ? <span>默认</span> : null}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">当前没有套餐绑定。</div>
        )}
      </div>
    </section>
  );
}

export function BrandDetailPanel({
  detail,
  activeTab,
  savingBaseInfo = false,
  onSaveBaseInfo,
  savingDesktopShell = false,
  onSaveDesktopShell,
  savingAuthExperience = false,
  onSaveAuthExperience,
  savingHeader = false,
  onSaveHeader,
  savingHomeWeb = false,
  onSaveHomeWeb,
  savingInput = false,
  onSaveInput,
  savingSidebar = false,
  onSaveSidebar,
  savingWelcome = false,
  onSaveWelcome,
  savingTheme = false,
  onSaveTheme,
  availableSkills = [],
  inheritedPlatformSkills = [],
  savingSkills = false,
  onSaveSkills,
  availableMcps = [],
  inheritedPlatformMcps = [],
  savingMcps = false,
  onSaveMcps,
  availableRechargePackages = [],
  savingRechargePackages = false,
  onSaveRechargePackages,
  availableMenus = [],
  savingMenus = false,
  onSaveMenus,
  savingAsset = false,
  onUploadAsset,
}: {
  detail: BrandDetailData;
  activeTab: BrandDetailTabId;
  savingBaseInfo?: boolean;
  onSaveBaseInfo?: (input: {
    displayName: string;
    productName: string;
    tenantKey: string;
    defaultLocale: string;
    status: string;
  }) => Promise<void> | void;
  savingDesktopShell?: boolean;
  onSaveDesktopShell?: (input: {
    websiteTitle: string;
    devWebsiteTitle: string;
    sidebarTitle: string;
    devSidebarTitle: string;
    sidebarSubtitle: string;
    legalName: string;
    bundleIdentifier: string;
    authService: string;
  }) => Promise<void> | void;
  savingAuthExperience?: boolean;
  onSaveAuthExperience?: (input: {
    title: string;
    subtitle: string;
    socialNotice: string;
    agreements: Array<{
      key: string;
      title: string;
      version: string;
      effectiveDate: string;
      summary: string;
      content: string;
    }>;
  }) => Promise<void> | void;
  savingHeader?: boolean;
  onSaveHeader?: (input: {
    enabled: boolean;
    statusLabel: string;
    liveStatusLabel: string;
    showLiveBadge: boolean;
    showQuotes: boolean;
    showHeadlines: boolean;
    showSecurityBadge: boolean;
    securityLabel: string;
    showCredits: boolean;
    showRechargeButton: boolean;
    rechargeLabel: string;
    showModeBadge: boolean;
    modeBadgeLabel: string;
    fallbackQuotes: Array<{
      label: string;
      value: string;
      change: number;
      changePercent: string;
    }>;
    fallbackHeadlines: Array<{
      title: string;
      source: string;
      href: string;
    }>;
  }) => Promise<void> | void;
  savingHomeWeb?: boolean;
  onSaveHomeWeb?: (input: {
    enabled: boolean;
    templateKey: string;
    headerEnabled: boolean;
    headerVariant: string;
    headerBrandLabel: string;
    headerSubline: string;
    headerNavItemsText: string;
    headerPrimaryCtaLabel: string;
    headerPrimaryCtaHref: string;
    footerEnabled: boolean;
    footerVariant: string;
    footerColumnsText: string;
    footerLegalLinksText: string;
    footerCopyrightText: string;
    footerIcpText: string;
    homeSeoTitle: string;
    homeSeoDescription: string;
    heroEyebrow: string;
    heroTitlePre: string;
    heroTitleMain: string;
    heroDescription: string;
    downloadTitle: string;
    privacyTitle: string;
    privacyContent: string;
    termsTitle: string;
    termsContent: string;
  }) => Promise<void> | void;
  savingInput?: boolean;
  onSaveInput?: (input: {
    enabled: boolean;
    placeholderText: string;
  }) => Promise<void> | void;
  savingSidebar?: boolean;
  onSaveSidebar?: (input: {
    enabled: boolean;
    variant: string;
    brandTitle: string;
    brandSubtitle: string;
    sectionStyle: string;
    emphasizeActiveItem: boolean;
  }) => Promise<void> | void;
  savingWelcome?: boolean;
  onSaveWelcome?: (input: {
    enabled: boolean;
    entryLabel: string;
    kolName: string;
    expertName: string;
    slogan: string;
    avatarUrl: string;
    backgroundImageUrl: string;
    primaryColor: string;
    description: string;
    expertiseAreas: string[];
    targetAudience: string;
    disclaimer: string;
    quickActions: Array<{
      label: string;
      prompt: string;
      iconKey: string;
    }>;
  }) => Promise<void> | void;
  savingTheme?: boolean;
  onSaveTheme?: (input: {
    defaultMode: 'light' | 'dark' | 'system';
    lightPrimary: string;
    lightPrimaryHover: string;
    lightOnPrimary: string;
    darkPrimary: string;
    darkPrimaryHover: string;
    darkOnPrimary: string;
  }) => Promise<void> | void;
  availableSkills?: Array<{ slug: string; name: string; category?: string }>;
  inheritedPlatformSkills?: Array<{ slug: string; name: string }>;
  savingSkills?: boolean;
  onSaveSkills?: (selectedSkillSlugs: string[]) => Promise<void> | void;
  availableMcps?: Array<{ key: string; name: string; transport?: string }>;
  inheritedPlatformMcps?: Array<{ key: string; name: string }>;
  savingMcps?: boolean;
  onSaveMcps?: (selectedMcpKeys: string[]) => Promise<void> | void;
  availableRechargePackages?: Array<{ packageId: string; packageName: string; default?: boolean; recommended?: boolean }>;
  savingRechargePackages?: boolean;
  onSaveRechargePackages?: (selectedPackageIds: string[]) => Promise<void> | void;
  availableMenus?: Array<{ key: string; label: string; category?: string }>;
  savingMenus?: boolean;
  onSaveMenus?: (
    items: Array<{ menuKey: string; enabled: boolean; displayName: string; group: string }>,
  ) => Promise<void> | void;
  savingAsset?: boolean;
  onUploadAsset?: (input: {
    assetKey: string;
    kind: string;
    file: File;
  }) => Promise<void> | void;
}) {
  const surface = asObject(asObject(detail.appConfig.surfaces)[activeTab] || {});
  const surfaceConfig = asObject(surface.config || surface);
  const theme = asObject(detail.appConfig.theme);
  const buildBrandMetaDraft = () => ({
    displayName: stringValue(detail.brand.displayName),
    productName: stringValue(detail.brand.productName),
    tenantKey: stringValue(detail.brand.tenantKey),
    defaultLocale: stringValue(detail.brand.defaultLocale || 'zh-CN'),
    status: detail.brand.status === 'disabled' ? 'disabled' : 'active',
  });
  const desktopDraftSource = {
    websiteTitle: stringValue(detail.appConfig.websiteTitle || detail.appConfig.website_title),
    devWebsiteTitle: stringValue(detail.appConfig.devWebsiteTitle || detail.appConfig.dev_website_title),
    sidebarTitle: stringValue(detail.appConfig.sidebarTitle || detail.appConfig.sidebar_title),
    devSidebarTitle: stringValue(detail.appConfig.devSidebarTitle || detail.appConfig.dev_sidebar_title),
    sidebarSubtitle: stringValue(detail.appConfig.sidebarSubtitle || detail.appConfig.sidebar_subtitle),
    legalName: stringValue(asObject(detail.appConfig.brand_meta).legal_name || detail.appConfig.legalName || detail.appConfig.legal_name),
    bundleIdentifier: stringValue(detail.appConfig.bundleIdentifier || detail.appConfig.bundle_identifier),
    authService: stringValue(detail.appConfig.authService || detail.appConfig.auth_service),
  };
  const sidebarSurface = asObject(asObject(detail.appConfig.surfaces).sidebar);
  const sidebarConfig = asObject(sidebarSurface.config);
  const sidebarBrandBlock = asObject(sidebarConfig.brandBlock || sidebarConfig.brand_block);
  const sidebarLayout = asObject(sidebarConfig.layout);
  const [sidebarDraft, setSidebarDraft] = useState({
    enabled: sidebarSurface.enabled !== false,
    variant: stringValue(sidebarConfig.variant),
    brandTitle: stringValue(sidebarBrandBlock.title),
    brandSubtitle: stringValue(sidebarBrandBlock.subtitle),
    sectionStyle: stringValue(sidebarLayout.sectionStyle || sidebarLayout.section_style),
    emphasizeActiveItem:
      sidebarLayout.emphasizeActiveItem !== false && sidebarLayout.emphasize_active_item !== false,
  });
  const lightTheme = asObject(theme.light);
  const darkTheme = asObject(theme.dark);
  const [brandMetaDraft, setBrandMetaDraft] = useState(buildBrandMetaDraft);
  const [desktopShellDraft, setDesktopShellDraft] = useState(desktopDraftSource);
  const authSource = asObject(detail.appConfig.auth_experience || detail.appConfig.authExperience);
  const authAgreementList = Array.isArray(authSource.agreements) ? authSource.agreements : [];
  const authAgreementMap = new Map(
    authAgreementList.map((item) => {
      const entry = asObject(item);
      return [stringValue(entry.key), entry] as const;
    }),
  );
  const buildAuthDraft = () => ({
    title: stringValue(authSource.title),
    subtitle: stringValue(authSource.subtitle),
    socialNotice: stringValue(authSource.social_notice || authSource.socialNotice),
    agreements: ['service', 'privacy', 'billing'].map((key) => {
      const entry = asObject(authAgreementMap.get(key));
      return {
        key,
        title: stringValue(entry.title),
        version: stringValue(entry.version),
        effectiveDate: stringValue(entry.effective_date || entry.effectiveDate),
        summary: stringValue(entry.summary),
        content: stringValue(entry.content),
      };
    }),
  });
  const [authDraft, setAuthDraft] = useState(buildAuthDraft);
  const headerSurface = asObject(asObject(detail.appConfig.surfaces).header);
  const headerConfig = asObject(headerSurface.config);
  const buildHeaderDraft = () => ({
    enabled: headerSurface.enabled !== false,
    statusLabel: stringValue(headerConfig.status_label || headerConfig.statusLabel),
    liveStatusLabel: stringValue(headerConfig.live_status_label || headerConfig.liveStatusLabel),
    showLiveBadge: headerConfig.show_live_badge !== false && headerConfig.showLiveBadge !== false,
    showQuotes: headerConfig.show_quotes !== false && headerConfig.showQuotes !== false,
    showHeadlines: headerConfig.show_headlines !== false && headerConfig.showHeadlines !== false,
    showSecurityBadge: headerConfig.show_security_badge !== false && headerConfig.showSecurityBadge !== false,
    securityLabel: stringValue(headerConfig.security_label || headerConfig.securityLabel),
    showCredits: headerConfig.show_credits !== false && headerConfig.showCredits !== false,
    showRechargeButton: headerConfig.show_recharge_button !== false && headerConfig.showRechargeButton !== false,
    rechargeLabel: stringValue(headerConfig.recharge_label || headerConfig.rechargeLabel),
    showModeBadge: headerConfig.show_mode_badge !== false && headerConfig.showModeBadge !== false,
    modeBadgeLabel: stringValue(headerConfig.mode_badge_label || headerConfig.modeBadgeLabel),
    fallbackQuotes: Array.from({ length: 4 }, (_, index) => {
      const quoteList = Array.isArray(headerConfig.fallback_quotes)
        ? headerConfig.fallback_quotes
        : Array.isArray(headerConfig.fallbackQuotes)
          ? headerConfig.fallbackQuotes
          : [];
      const entry = asObject(quoteList[index]);
      return {
        label: stringValue(entry.label),
        value: stringValue(entry.value),
        change: Number(entry.change || 0) || 0,
        changePercent: stringValue(entry.change_percent || entry.changePercent),
      };
    }),
    fallbackHeadlines: Array.from({ length: 3 }, (_, index) => {
      const headlineList = Array.isArray(headerConfig.fallback_headlines)
        ? headerConfig.fallback_headlines
        : Array.isArray(headerConfig.fallbackHeadlines)
          ? headerConfig.fallbackHeadlines
          : [];
      const entry = asObject(headlineList[index]);
      return {
        title: stringValue(entry.title),
        source: stringValue(entry.source),
        href: stringValue(entry.href),
      };
    }),
  });
  const [headerDraft, setHeaderDraft] = useState(buildHeaderDraft);
  const homeWebSurface = asObject(asObject(detail.appConfig.surfaces)['home-web']);
  const homeWebConfig = asObject(homeWebSurface.config);
  const headerShell = asObject(asObject(asObject(homeWebConfig.siteShell).header).props);
  const footerShell = asObject(asObject(asObject(homeWebConfig.siteShell).footer).props);
  const homeWebsite = asObject(homeWebConfig.website);
  const pages = Array.isArray(homeWebConfig.pages) ? homeWebConfig.pages : [];
  const findPage = (pageKey: string) => asObject(pages.find((item) => stringValue(asObject(item).pageKey) === pageKey));
  const findBlock = (page: Record<string, unknown>, prefix: string) =>
    asObject((Array.isArray(page.blocks) ? page.blocks : []).find((item) => String(asObject(item).blockKey || '').startsWith(prefix)));
  const homePage = findPage('home');
  const privacyPage = findPage('privacy');
  const termsPage = findPage('terms');
  const heroBlock = findBlock(homePage, 'hero.');
  const downloadBlock = findBlock(homePage, 'download-grid.');
  const privacyBlock = findBlock(privacyPage, 'rich-text.');
  const termsBlock = findBlock(termsPage, 'rich-text.');
  const formatLines = (items: Array<Record<string, unknown>>) =>
    items
      .map((item) => `${stringValue(asObject(item).label || asObject(item).title)}|${stringValue(asObject(item).href || asObject(item).description || '#')}`)
      .filter(Boolean)
      .join('\n');
  const footerColumns = Array.isArray(footerShell.columns) ? footerShell.columns.map((item) => asObject(item)) : [];
  const firstFooterColumn = asObject(footerColumns[0]);
  const footerColumnLinks = Array.isArray(firstFooterColumn.links) ? firstFooterColumn.links.map((item) => asObject(item)) : [];
  const footerLegalLinks = Array.isArray(footerShell.legalLinks) ? footerShell.legalLinks.map((item) => asObject(item)) : [];
  const buildHomeWebDraft = () => ({
    enabled: homeWebSurface.enabled !== false,
    templateKey: stringValue(homeWebConfig.templateKey),
    headerEnabled: asObject(homeWebConfig.siteShell).header ? asObject(asObject(homeWebConfig.siteShell).header).enabled !== false : true,
    headerVariant: stringValue(asObject(asObject(homeWebConfig.siteShell).header).variant),
    headerBrandLabel: stringValue(headerShell.brandLabel || homeWebsite.brandLabel),
    headerSubline: stringValue(headerShell.subline),
    headerNavItemsText: formatLines(Array.isArray(headerShell.navItems) ? headerShell.navItems.map((item) => asObject(item)) : []),
    headerPrimaryCtaLabel: stringValue(asObject(headerShell.primaryCta).label || homeWebsite.topCtaLabel),
    headerPrimaryCtaHref: stringValue(asObject(headerShell.primaryCta).href),
    footerEnabled: asObject(homeWebConfig.siteShell).footer ? asObject(asObject(homeWebConfig.siteShell).footer).enabled !== false : true,
    footerVariant: stringValue(asObject(asObject(homeWebConfig.siteShell).footer).variant),
    footerColumnsText: formatLines(footerColumnLinks),
    footerLegalLinksText: formatLines(footerLegalLinks),
    footerCopyrightText: stringValue(footerShell.copyrightText),
    footerIcpText: stringValue(footerShell.icpText),
    homeSeoTitle: stringValue(asObject(homePage.seo).title || homeWebsite.homeTitle),
    homeSeoDescription: stringValue(asObject(homePage.seo).description || homeWebsite.metaDescription),
    heroEyebrow: stringValue(asObject(heroBlock.props).eyebrow || homeWebsite.kicker),
    heroTitlePre: stringValue(asObject(heroBlock.props).titlePre || homeWebsite.heroTitlePre),
    heroTitleMain: stringValue(asObject(heroBlock.props).titleMain || homeWebsite.heroTitleMain),
    heroDescription: stringValue(asObject(heroBlock.props).description || homeWebsite.heroDescription),
    downloadTitle: stringValue(asObject(downloadBlock.props).title || homeWebsite.downloadTitle),
    privacyTitle: stringValue(asObject(privacyBlock.props).title),
    privacyContent: stringValue(asObject(privacyBlock.props).content),
    termsTitle: stringValue(asObject(termsBlock.props).title),
    termsContent: stringValue(asObject(termsBlock.props).content),
  });
  const [homeWebDraft, setHomeWebDraft] = useState(buildHomeWebDraft);
  const inputSurface = asObject(asObject(detail.appConfig.surfaces).input);
  const inputConfig = asObject(inputSurface.config);
  const buildInputDraft = () => ({
    enabled: inputSurface.enabled !== false,
    placeholderText: stringValue(
      inputConfig.placeholder_text ||
        inputConfig.placeholderText ||
        inputConfig.composer_placeholder ||
        inputConfig.composerPlaceholder,
    ),
  });
  const [inputDraft, setInputDraft] = useState(buildInputDraft);
  const welcomeSurface = asObject(asObject(detail.appConfig.surfaces).welcome);
  const welcomeConfig = asObject(welcomeSurface.config);
  const buildWelcomeDraft = () => ({
    enabled: welcomeSurface.enabled !== false,
    entryLabel: stringValue(welcomeConfig.entry_label || welcomeConfig.entryLabel),
    kolName: stringValue(welcomeConfig.kol_name || welcomeConfig.kolName),
    expertName: stringValue(welcomeConfig.expert_name || welcomeConfig.expertName),
    slogan: stringValue(welcomeConfig.slogan),
    avatarUrl: stringValue(welcomeConfig.avatar_url || welcomeConfig.avatarUrl || welcomeConfig.avatar),
    backgroundImageUrl: stringValue(welcomeConfig.background_image_url || welcomeConfig.backgroundImageUrl || welcomeConfig.backgroundImage),
    primaryColor: stringValue(welcomeConfig.primary_color || welcomeConfig.primaryColor),
    description: stringValue(welcomeConfig.description),
    expertiseAreas: Array.isArray(welcomeConfig.expertise_areas)
      ? welcomeConfig.expertise_areas.map((item) => String(item || ''))
      : Array.isArray(welcomeConfig.expertiseAreas)
        ? welcomeConfig.expertiseAreas.map((item) => String(item || ''))
        : [],
    targetAudience: stringValue(welcomeConfig.target_audience || welcomeConfig.targetAudience),
    disclaimer: stringValue(welcomeConfig.disclaimer),
    quickActions: Array.from({ length: 4 }, (_, index) => {
      const actionList = Array.isArray(welcomeConfig.quick_actions)
        ? welcomeConfig.quick_actions
        : Array.isArray(welcomeConfig.quickActions)
          ? welcomeConfig.quickActions
          : [];
      const entry = asObject(actionList[index]);
      return {
        label: stringValue(entry.label),
        prompt: stringValue(entry.prompt),
        iconKey: stringValue(entry.icon_key || entry.iconKey || entry.icon),
      };
    }),
  });
  const [welcomeDraft, setWelcomeDraft] = useState(buildWelcomeDraft);
  const [themeDraft, setThemeDraft] = useState<{
    defaultMode: 'light' | 'dark' | 'system';
    lightPrimary: string;
    lightPrimaryHover: string;
    lightOnPrimary: string;
    darkPrimary: string;
    darkPrimaryHover: string;
    darkOnPrimary: string;
  }>({
    defaultMode:
      String(theme.defaultMode || theme.default_mode || 'dark') === 'light'
        ? 'light'
        : String(theme.defaultMode || theme.default_mode || 'dark') === 'system'
          ? 'system'
          : 'dark',
    lightPrimary: stringValue(lightTheme.primary),
    lightPrimaryHover: stringValue(lightTheme.primaryHover),
    lightOnPrimary: stringValue(lightTheme.onPrimary),
    darkPrimary: stringValue(darkTheme.primary),
    darkPrimaryHover: stringValue(darkTheme.primaryHover),
    darkOnPrimary: stringValue(darkTheme.onPrimary),
  });
  const [skillDraft, setSkillDraft] = useState<string[]>(
    detail.skillBindings
      .filter((item) => item.enabled !== false)
      .map((item) => stringValue(item.skillSlug))
      .filter(Boolean),
  );
  const [mcpDraft, setMcpDraft] = useState<string[]>(
    detail.mcpBindings
      .filter((item) => item.enabled !== false)
      .map((item) => stringValue(item.mcpKey))
      .filter(Boolean),
  );
  const [rechargeDraft, setRechargeDraft] = useState<string[]>(
    detail.rechargePackageBindings
      .filter((item) => item.enabled !== false)
      .map((item) => stringValue(item.packageId || item.package_id))
      .filter(Boolean),
  );
  const [menuDraft, setMenuDraft] = useState<
    Array<{ menuKey: string; enabled: boolean; displayName: string; group: string }>
  >(
    detail.menuBindings.map((item) => {
      const config = asObject(item.config);
      return {
        menuKey: stringValue(item.menuKey || item.menu_key),
        enabled: item.enabled !== false,
        displayName: stringValue(config.display_name || config.displayName),
        group: stringValue(config.group_label || config.groupLabel || config.group),
      };
    }),
  );
  const [assetDraft, setAssetDraft] = useState({
    assetKey: '',
    kind: '',
    file: null as File | null,
  });

  useEffect(() => {
    setBrandMetaDraft(buildBrandMetaDraft());
  }, [detail]);

  useEffect(() => {
    setDesktopShellDraft(desktopDraftSource);
  }, [detail]);

  useEffect(() => {
    setAuthDraft(buildAuthDraft());
  }, [detail]);

  useEffect(() => {
    setHeaderDraft(buildHeaderDraft());
  }, [detail]);

  useEffect(() => {
    setHomeWebDraft(buildHomeWebDraft());
  }, [detail]);

  useEffect(() => {
    setInputDraft(buildInputDraft());
  }, [detail]);

  useEffect(() => {
    setWelcomeDraft(buildWelcomeDraft());
  }, [detail]);

  useEffect(() => {
    setSidebarDraft({
      enabled: sidebarSurface.enabled !== false,
      variant: stringValue(sidebarConfig.variant),
      brandTitle: stringValue(sidebarBrandBlock.title),
      brandSubtitle: stringValue(sidebarBrandBlock.subtitle),
      sectionStyle: stringValue(sidebarLayout.sectionStyle || sidebarLayout.section_style),
      emphasizeActiveItem:
        sidebarLayout.emphasizeActiveItem !== false && sidebarLayout.emphasize_active_item !== false,
    });
  }, [detail]);

  useEffect(() => {
    setThemeDraft({
      defaultMode:
        String(theme.defaultMode || theme.default_mode || 'dark') === 'light'
          ? 'light'
          : String(theme.defaultMode || theme.default_mode || 'dark') === 'system'
            ? 'system'
            : 'dark',
      lightPrimary: stringValue(lightTheme.primary),
      lightPrimaryHover: stringValue(lightTheme.primaryHover),
      lightOnPrimary: stringValue(lightTheme.onPrimary),
      darkPrimary: stringValue(darkTheme.primary),
      darkPrimaryHover: stringValue(darkTheme.primaryHover),
      darkOnPrimary: stringValue(darkTheme.onPrimary),
    });
  }, [detail]);

  useEffect(() => {
    setSkillDraft(
      detail.skillBindings
        .filter((item) => item.enabled !== false)
        .map((item) => stringValue(item.skillSlug))
        .filter(Boolean),
    );
  }, [detail]);

  useEffect(() => {
    setMcpDraft(
      detail.mcpBindings
        .filter((item) => item.enabled !== false)
        .map((item) => stringValue(item.mcpKey))
        .filter(Boolean),
    );
  }, [detail]);

  useEffect(() => {
    setRechargeDraft(
      detail.rechargePackageBindings
        .filter((item) => item.enabled !== false)
        .map((item) => stringValue(item.packageId || item.package_id))
        .filter(Boolean),
    );
  }, [detail]);

  useEffect(() => {
    setMenuDraft(
      detail.menuBindings.map((item) => {
        const config = asObject(item.config);
        return {
          menuKey: stringValue(item.menuKey || item.menu_key),
          enabled: item.enabled !== false,
          displayName: stringValue(config.display_name || config.displayName),
          group: stringValue(config.group_label || config.groupLabel || config.group),
        };
      }),
    );
  }, [detail]);

  return (
    <>
      <section className="fig-card fig-brand-meta-editor">
        <div className="fig-card__head">
          <h3>品牌信息</h3>
          <span>React 版直接维护品牌基础信息</span>
        </div>
        <div className="form-grid form-grid--two">
          <label className="field">
            <span>Brand ID</span>
            <input className="field-input" value={detail.brand.brandId} readOnly />
          </label>
          <label className="field">
            <span>显示名称</span>
            <input className="field-input" value={brandMetaDraft.displayName} onChange={(event) => setBrandMetaDraft((current) => ({ ...current, displayName: event.target.value }))} />
          </label>
          <label className="field">
            <span>产品名称</span>
            <input className="field-input" value={brandMetaDraft.productName} onChange={(event) => setBrandMetaDraft((current) => ({ ...current, productName: event.target.value }))} />
          </label>
          <label className="field">
            <span>Tenant Key</span>
            <input className="field-input" value={brandMetaDraft.tenantKey} onChange={(event) => setBrandMetaDraft((current) => ({ ...current, tenantKey: event.target.value }))} />
          </label>
          <label className="field">
            <span>默认语言</span>
            <input className="field-input" value={brandMetaDraft.defaultLocale} onChange={(event) => setBrandMetaDraft((current) => ({ ...current, defaultLocale: event.target.value }))} />
          </label>
          <label className="field">
            <span>应用状态</span>
            <select className="field-select" value={brandMetaDraft.status} onChange={(event) => setBrandMetaDraft((current) => ({ ...current, status: event.target.value }))}>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
        </div>
        <div className="fig-release-card__actions">
          <button className="solid-button" type="button" disabled={savingBaseInfo} onClick={() => onSaveBaseInfo?.(brandMetaDraft)}>
            {savingBaseInfo ? '保存中…' : '保存品牌信息'}
          </button>
          <span>{statusLabel(detail.brand.status)} / 当前版本 v{detail.brand.publishedVersion || '0'}</span>
        </div>
      </section>

      {activeTab === 'skills'
        ? (
          <section className="fig-card fig-card--subtle">
            <div className="fig-card__head">
              <h3>技能装配</h3>
              <span>平台级 Skill 为继承层；这里只保存 OEM 增量绑定</span>
            </div>
            {inheritedPlatformSkills.length ? (
              <div className="chip-grid" style={{ marginBottom: 16 }}>
                {inheritedPlatformSkills.map((item) => (
                  <span key={item.slug} className="chip">
                    {`${item.name} · 平台继承`}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="fig-list">
              {availableSkills.length ? (
                availableSkills.map((item) => {
                  const checked = skillDraft.includes(item.slug);
                  return (
                    <label key={item.slug} className="fig-list-item fig-list-item--spread" style={{ cursor: 'pointer' }}>
                      <div>
                        <div className="fig-list-item__title">{item.name}</div>
                        <div className="fig-list-item__meta">
                          <span>{item.slug}</span>
                          {item.category ? <span>{item.category}</span> : null}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setSkillDraft((current) =>
                            event.target.checked
                              ? Array.from(new Set([...current, item.slug]))
                              : current.filter((slug) => slug !== item.slug),
                          )
                        }
                      />
                    </label>
                  );
                })
              ) : (
                <div className="empty-state">当前没有可装配的云技能。</div>
              )}
            </div>
            <div className="fig-release-card__actions">
              <button className="solid-button" type="button" disabled={savingSkills} onClick={() => onSaveSkills?.(skillDraft)}>
                {savingSkills ? '保存中…' : '保存技能装配'}
              </button>
            </div>
          </section>
        )
        : activeTab === 'mcps'
          ? (
            <section className="fig-card fig-card--subtle">
              <div className="fig-card__head">
                <h3>MCP 装配</h3>
                <span>平台级 MCP 为继承层；这里只保存 OEM 增量装配</span>
              </div>
              {inheritedPlatformMcps.length ? (
                <div className="chip-grid" style={{ marginBottom: 16 }}>
                  {inheritedPlatformMcps.map((item) => (
                    <span key={item.key} className="chip">
                      {`${item.name} · 平台继承`}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="fig-list">
                {availableMcps.length ? (
                  availableMcps.map((item) => {
                    const checked = mcpDraft.includes(item.key);
                    return (
                      <label key={item.key} className="fig-list-item fig-list-item--spread" style={{ cursor: 'pointer' }}>
                        <div>
                          <div className="fig-list-item__title">{item.name}</div>
                          <div className="fig-list-item__meta">
                            <span>{item.key}</span>
                            {item.transport ? <span>{item.transport}</span> : null}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setMcpDraft((current) =>
                              event.target.checked
                                ? Array.from(new Set([...current, item.key]))
                                : current.filter((key) => key !== item.key),
                            )
                          }
                        />
                      </label>
                    );
                  })
                ) : (
                  <div className="empty-state">当前没有可装配的云MCP。</div>
                )}
              </div>
              <div className="fig-release-card__actions">
                <button className="solid-button" type="button" disabled={savingMcps} onClick={() => onSaveMcps?.(mcpDraft)}>
                  {savingMcps ? '保存中…' : '保存 MCP 装配'}
                </button>
              </div>
            </section>
          )
          : activeTab === 'menus'
            ? (
              <section className="fig-card fig-card--subtle">
                <div className="fig-card__head">
                  <h3>左菜单栏</h3>
                  <span>显隐、顺序和展示名会直接保存到 OEM menu binding</span>
                </div>
                <div className="fig-list">
                  {(menuDraft.length ? menuDraft : availableMenus.map((item) => ({
                    menuKey: item.key,
                    enabled: false,
                    displayName: '',
                    group: '',
                  }))).map((item, index, list) => {
                    const catalog = availableMenus.find((entry) => entry.key === item.menuKey);
                    return (
                      <div key={item.menuKey || index} className="fig-list-item">
                        <div style={{ width: '100%' }}>
                          <div className="fig-list-item__title">{catalog?.label || item.menuKey}</div>
                          <div className="fig-list-item__meta">
                            <span>{item.menuKey}</span>
                            {catalog?.category ? <span>{catalog.category}</span> : null}
                          </div>
                          <div className="form-grid" style={{ marginTop: 12 }}>
                            <label className="field" style={{ maxWidth: 160 }}>
                              <span>启用</span>
                              <input
                                type="checkbox"
                                checked={item.enabled}
                                onChange={(event) =>
                                  setMenuDraft((current) =>
                                    current.map((entry, entryIndex) =>
                                      entryIndex === index ? { ...entry, enabled: event.target.checked } : entry,
                                    ),
                                  )
                                }
                              />
                            </label>
                            <label className="field">
                              <span>展示名</span>
                              <input
                                className="field-input"
                                value={item.displayName}
                                onChange={(event) =>
                                  setMenuDraft((current) =>
                                    current.map((entry, entryIndex) =>
                                      entryIndex === index ? { ...entry, displayName: event.target.value } : entry,
                                    ),
                                  )
                                }
                              />
                            </label>
                            <label className="field">
                              <span>分组</span>
                              <input
                                className="field-input"
                                value={item.group}
                                onChange={(event) =>
                                  setMenuDraft((current) =>
                                    current.map((entry, entryIndex) =>
                                      entryIndex === index ? { ...entry, group: event.target.value } : entry,
                                    ),
                                  )
                                }
                              />
                            </label>
                          </div>
                          <div className="fig-release-card__actions" style={{ marginTop: 12 }}>
                            <button
                              className="ghost-button"
                              type="button"
                              disabled={index === 0}
                              onClick={() =>
                                setMenuDraft((current) => {
                                  const next = [...current];
                                  const [moved] = next.splice(index, 1);
                                  next.splice(index - 1, 0, moved);
                                  return next;
                                })
                              }
                            >
                              上移
                            </button>
                            <button
                              className="ghost-button"
                              type="button"
                              disabled={index === list.length - 1}
                              onClick={() =>
                                setMenuDraft((current) => {
                                  const next = [...current];
                                  const [moved] = next.splice(index, 1);
                                  next.splice(index + 1, 0, moved);
                                  return next;
                                })
                              }
                            >
                              下移
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="fig-release-card__actions">
                  <button className="solid-button" type="button" disabled={savingMenus} onClick={() => onSaveMenus?.(menuDraft)}>
                    {savingMenus ? '保存中…' : '保存左菜单栏'}
                  </button>
                </div>
              </section>
            )
            : activeTab === 'assets'
              ? (
                <>
                  <section className="fig-card fig-card--subtle">
                    <div className="fig-card__head">
                      <h3>上传资源</h3>
                      <span>React 版可直接上传并登记品牌资源</span>
                    </div>
                    <div className="form-grid form-grid--two">
                      <label className="field">
                        <span>Asset Key</span>
                        <input className="field-input" value={assetDraft.assetKey} onChange={(event) => setAssetDraft((current) => ({ ...current, assetKey: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>类型</span>
                        <input className="field-input" value={assetDraft.kind} onChange={(event) => setAssetDraft((current) => ({ ...current, kind: event.target.value }))} />
                      </label>
                      <label className="field field--wide">
                        <span>上传文件</span>
                        <input className="field-input" type="file" onChange={(event) => setAssetDraft((current) => ({ ...current, file: event.target.files?.[0] || null }))} />
                      </label>
                    </div>
                    <div className="fig-release-card__actions">
                      <button
                        className="solid-button"
                        type="button"
                        disabled={savingAsset}
                        onClick={() => assetDraft.file && onUploadAsset?.({ assetKey: assetDraft.assetKey, kind: assetDraft.kind, file: assetDraft.file })}
                      >
                        {savingAsset ? '上传中…' : '上传资源'}
                      </button>
                    </div>
                  </section>
                  {renderAssets(detail)}
                </>
              )
              : activeTab === 'auth'
                ? (
                  <section className="fig-card fig-card--subtle">
                    <div className="fig-card__head">
                      <h3>登录与协议</h3>
                      <span>React 版可直接保存登录文案与三份协议正文</span>
                    </div>
                    <div className="form-grid">
                      <label className="field">
                        <span>Panel Title</span>
                        <input className="field-input" value={authDraft.title} onChange={(event) => setAuthDraft((current) => ({ ...current, title: event.target.value }))} />
                      </label>
                      <label className="field field--wide">
                        <span>Panel Subtitle</span>
                        <textarea className="field-textarea" rows={3} value={authDraft.subtitle} onChange={(event) => setAuthDraft((current) => ({ ...current, subtitle: event.target.value }))} />
                      </label>
                      <label className="field field--wide">
                        <span>Social Notice</span>
                        <textarea className="field-textarea" rows={2} value={authDraft.socialNotice} onChange={(event) => setAuthDraft((current) => ({ ...current, socialNotice: event.target.value }))} />
                      </label>
                    </div>
                    <div className="fig-detail-stack">
                      {authDraft.agreements.map((agreement) => (
                        <section key={agreement.key} className="fig-card fig-card--subtle">
                          <div className="fig-card__head">
                            <h3>{agreement.key}</h3>
                            <span>协议正文</span>
                          </div>
                          <div className="form-grid">
                            <label className="field">
                              <span>Title</span>
                              <input className="field-input" value={agreement.title} onChange={(event) => setAuthDraft((current) => ({ ...current, agreements: current.agreements.map((item) => item.key === agreement.key ? { ...item, title: event.target.value } : item) }))} />
                            </label>
                            <label className="field">
                              <span>Version</span>
                              <input className="field-input" value={agreement.version} onChange={(event) => setAuthDraft((current) => ({ ...current, agreements: current.agreements.map((item) => item.key === agreement.key ? { ...item, version: event.target.value } : item) }))} />
                            </label>
                            <label className="field">
                              <span>Effective Date</span>
                              <input className="field-input" value={agreement.effectiveDate} onChange={(event) => setAuthDraft((current) => ({ ...current, agreements: current.agreements.map((item) => item.key === agreement.key ? { ...item, effectiveDate: event.target.value } : item) }))} />
                            </label>
                            <label className="field field--wide">
                              <span>Summary</span>
                              <textarea className="field-textarea" rows={3} value={agreement.summary} onChange={(event) => setAuthDraft((current) => ({ ...current, agreements: current.agreements.map((item) => item.key === agreement.key ? { ...item, summary: event.target.value } : item) }))} />
                            </label>
                            <label className="field field--wide">
                              <span>Content</span>
                              <textarea className="field-textarea" rows={10} value={agreement.content} onChange={(event) => setAuthDraft((current) => ({ ...current, agreements: current.agreements.map((item) => item.key === agreement.key ? { ...item, content: event.target.value } : item) }))} />
                            </label>
                          </div>
                        </section>
                      ))}
                    </div>
                    <div className="fig-release-card__actions">
                      <button className="solid-button" type="button" disabled={savingAuthExperience} onClick={() => onSaveAuthExperience?.(authDraft)}>
                        {savingAuthExperience ? '保存中…' : '保存登录与协议'}
                      </button>
                    </div>
                  </section>
                )
              : activeTab === 'header'
                ? (
                  <section className="fig-card fig-card--subtle">
                    <div className="fig-card__head">
                      <h3>Header栏</h3>
                      <span>React 版可直接保存顶部状态区、行情区和头条区</span>
                    </div>
                    <div className="form-grid">
                      <label className="field" style={{ maxWidth: 180 }}>
                        <span>Enabled</span>
                        <input type="checkbox" checked={headerDraft.enabled} onChange={(event) => setHeaderDraft((current) => ({ ...current, enabled: event.target.checked }))} />
                      </label>
                      <label className="field">
                        <span>Status Label</span>
                        <input className="field-input" value={headerDraft.statusLabel} onChange={(event) => setHeaderDraft((current) => ({ ...current, statusLabel: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Live Status Label</span>
                        <input className="field-input" value={headerDraft.liveStatusLabel} onChange={(event) => setHeaderDraft((current) => ({ ...current, liveStatusLabel: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Security Label</span>
                        <input className="field-input" value={headerDraft.securityLabel} onChange={(event) => setHeaderDraft((current) => ({ ...current, securityLabel: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Recharge Label</span>
                        <input className="field-input" value={headerDraft.rechargeLabel} onChange={(event) => setHeaderDraft((current) => ({ ...current, rechargeLabel: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Mode Badge Label</span>
                        <input className="field-input" value={headerDraft.modeBadgeLabel} onChange={(event) => setHeaderDraft((current) => ({ ...current, modeBadgeLabel: event.target.value }))} />
                      </label>
                    </div>
                    <div className="fig-toolbar">
                      {[
                        ['showLiveBadge', 'Live Badge'],
                        ['showQuotes', 'Quotes'],
                        ['showHeadlines', 'Headlines'],
                        ['showSecurityBadge', 'Security Badge'],
                        ['showCredits', 'Credits'],
                        ['showRechargeButton', 'Recharge Button'],
                        ['showModeBadge', 'Mode Badge'],
                      ].map(([key, label]) => (
                        <label key={key} className="field" style={{ maxWidth: 180 }}>
                          <span>{label}</span>
                          <input
                            type="checkbox"
                            checked={Boolean(headerDraft[key as keyof typeof headerDraft])}
                            onChange={(event) => setHeaderDraft((current) => ({ ...current, [key]: event.target.checked }))}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="fig-detail-stack">
                      <section className="fig-card fig-card--subtle">
                        <div className="fig-card__head">
                          <h3>Quotes</h3>
                          <span>4 个行情位</span>
                        </div>
                        {headerDraft.fallbackQuotes.map((item, index) => (
                          <div key={index} className="form-grid form-grid--two" style={{ marginBottom: 12 }}>
                            <label className="field">
                              <span>Label</span>
                              <input className="field-input" value={item.label} onChange={(event) => setHeaderDraft((current) => ({ ...current, fallbackQuotes: current.fallbackQuotes.map((entry, entryIndex) => entryIndex === index ? { ...entry, label: event.target.value } : entry) }))} />
                            </label>
                            <label className="field">
                              <span>Value</span>
                              <input className="field-input" value={item.value} onChange={(event) => setHeaderDraft((current) => ({ ...current, fallbackQuotes: current.fallbackQuotes.map((entry, entryIndex) => entryIndex === index ? { ...entry, value: event.target.value } : entry) }))} />
                            </label>
                            <label className="field">
                              <span>Change</span>
                              <input className="field-input" type="number" step="0.01" value={item.change} onChange={(event) => setHeaderDraft((current) => ({ ...current, fallbackQuotes: current.fallbackQuotes.map((entry, entryIndex) => entryIndex === index ? { ...entry, change: Number(event.target.value || 0) } : entry) }))} />
                            </label>
                            <label className="field">
                              <span>Change Percent</span>
                              <input className="field-input" value={item.changePercent} onChange={(event) => setHeaderDraft((current) => ({ ...current, fallbackQuotes: current.fallbackQuotes.map((entry, entryIndex) => entryIndex === index ? { ...entry, changePercent: event.target.value } : entry) }))} />
                            </label>
                          </div>
                        ))}
                      </section>
                      <section className="fig-card fig-card--subtle">
                        <div className="fig-card__head">
                          <h3>Headlines</h3>
                          <span>3 条头条位</span>
                        </div>
                        {headerDraft.fallbackHeadlines.map((item, index) => (
                          <div key={index} className="form-grid" style={{ marginBottom: 12 }}>
                            <label className="field">
                              <span>Title</span>
                              <input className="field-input" value={item.title} onChange={(event) => setHeaderDraft((current) => ({ ...current, fallbackHeadlines: current.fallbackHeadlines.map((entry, entryIndex) => entryIndex === index ? { ...entry, title: event.target.value } : entry) }))} />
                            </label>
                            <label className="field">
                              <span>Source</span>
                              <input className="field-input" value={item.source} onChange={(event) => setHeaderDraft((current) => ({ ...current, fallbackHeadlines: current.fallbackHeadlines.map((entry, entryIndex) => entryIndex === index ? { ...entry, source: event.target.value } : entry) }))} />
                            </label>
                            <label className="field">
                              <span>Href</span>
                              <input className="field-input" value={item.href} onChange={(event) => setHeaderDraft((current) => ({ ...current, fallbackHeadlines: current.fallbackHeadlines.map((entry, entryIndex) => entryIndex === index ? { ...entry, href: event.target.value } : entry) }))} />
                            </label>
                          </div>
                        ))}
                      </section>
                    </div>
                    <div className="fig-release-card__actions">
                      <button className="solid-button" type="button" disabled={savingHeader} onClick={() => onSaveHeader?.(headerDraft)}>
                        {savingHeader ? '保存中…' : '保存 Header'}
                      </button>
                    </div>
                  </section>
                )
              : activeTab === 'home-web'
                ? (
                  <section className="fig-card fig-card--subtle">
                    <div className="fig-card__head">
                      <h3>Home官网</h3>
                      <span>React 版先覆盖首页 shell、SEO、hero、下载区和法律页正文</span>
                    </div>
                    <div className="form-grid">
                      <label className="field" style={{ maxWidth: 180 }}>
                        <span>Enabled</span>
                        <input type="checkbox" checked={homeWebDraft.enabled} onChange={(event) => setHomeWebDraft((current) => ({ ...current, enabled: event.target.checked }))} />
                      </label>
                      <label className="field">
                        <span>Template Key</span>
                        <input className="field-input" value={homeWebDraft.templateKey} onChange={(event) => setHomeWebDraft((current) => ({ ...current, templateKey: event.target.value }))} />
                      </label>
                    </div>
                    <section className="fig-card fig-card--subtle">
                      <div className="fig-card__head"><h3>Header Shell</h3></div>
                      <div className="form-grid">
                        <label className="field" style={{ maxWidth: 180 }}><span>Enabled</span><input type="checkbox" checked={homeWebDraft.headerEnabled} onChange={(event) => setHomeWebDraft((current) => ({ ...current, headerEnabled: event.target.checked }))} /></label>
                        <label className="field"><span>Variant</span><input className="field-input" value={homeWebDraft.headerVariant} onChange={(event) => setHomeWebDraft((current) => ({ ...current, headerVariant: event.target.value }))} /></label>
                        <label className="field"><span>Brand Label</span><input className="field-input" value={homeWebDraft.headerBrandLabel} onChange={(event) => setHomeWebDraft((current) => ({ ...current, headerBrandLabel: event.target.value }))} /></label>
                        <label className="field"><span>Subline</span><input className="field-input" value={homeWebDraft.headerSubline} onChange={(event) => setHomeWebDraft((current) => ({ ...current, headerSubline: event.target.value }))} /></label>
                        <label className="field"><span>CTA Label</span><input className="field-input" value={homeWebDraft.headerPrimaryCtaLabel} onChange={(event) => setHomeWebDraft((current) => ({ ...current, headerPrimaryCtaLabel: event.target.value }))} /></label>
                        <label className="field"><span>CTA Href</span><input className="field-input" value={homeWebDraft.headerPrimaryCtaHref} onChange={(event) => setHomeWebDraft((current) => ({ ...current, headerPrimaryCtaHref: event.target.value }))} /></label>
                        <label className="field field--wide"><span>Nav Items</span><textarea className="field-textarea" rows={4} value={homeWebDraft.headerNavItemsText} onChange={(event) => setHomeWebDraft((current) => ({ ...current, headerNavItemsText: event.target.value }))} /></label>
                      </div>
                    </section>
                    <section className="fig-card fig-card--subtle">
                      <div className="fig-card__head"><h3>Footer / SEO / Hero / Legal</h3></div>
                      <div className="form-grid">
                        <label className="field" style={{ maxWidth: 180 }}><span>Footer Enabled</span><input type="checkbox" checked={homeWebDraft.footerEnabled} onChange={(event) => setHomeWebDraft((current) => ({ ...current, footerEnabled: event.target.checked }))} /></label>
                        <label className="field"><span>Footer Variant</span><input className="field-input" value={homeWebDraft.footerVariant} onChange={(event) => setHomeWebDraft((current) => ({ ...current, footerVariant: event.target.value }))} /></label>
                        <label className="field field--wide"><span>Footer Links</span><textarea className="field-textarea" rows={4} value={homeWebDraft.footerColumnsText} onChange={(event) => setHomeWebDraft((current) => ({ ...current, footerColumnsText: event.target.value }))} /></label>
                        <label className="field field--wide"><span>Legal Links</span><textarea className="field-textarea" rows={4} value={homeWebDraft.footerLegalLinksText} onChange={(event) => setHomeWebDraft((current) => ({ ...current, footerLegalLinksText: event.target.value }))} /></label>
                        <label className="field"><span>Copyright</span><input className="field-input" value={homeWebDraft.footerCopyrightText} onChange={(event) => setHomeWebDraft((current) => ({ ...current, footerCopyrightText: event.target.value }))} /></label>
                        <label className="field"><span>ICP备案</span><input className="field-input" value={homeWebDraft.footerIcpText} onChange={(event) => setHomeWebDraft((current) => ({ ...current, footerIcpText: event.target.value }))} /></label>
                        <label className="field"><span>SEO Title</span><input className="field-input" value={homeWebDraft.homeSeoTitle} onChange={(event) => setHomeWebDraft((current) => ({ ...current, homeSeoTitle: event.target.value }))} /></label>
                        <label className="field field--wide"><span>SEO Description</span><textarea className="field-textarea" rows={3} value={homeWebDraft.homeSeoDescription} onChange={(event) => setHomeWebDraft((current) => ({ ...current, homeSeoDescription: event.target.value }))} /></label>
                        <label className="field"><span>Hero Eyebrow</span><input className="field-input" value={homeWebDraft.heroEyebrow} onChange={(event) => setHomeWebDraft((current) => ({ ...current, heroEyebrow: event.target.value }))} /></label>
                        <label className="field"><span>Hero Title Pre</span><input className="field-input" value={homeWebDraft.heroTitlePre} onChange={(event) => setHomeWebDraft((current) => ({ ...current, heroTitlePre: event.target.value }))} /></label>
                        <label className="field"><span>Hero Title Main</span><input className="field-input" value={homeWebDraft.heroTitleMain} onChange={(event) => setHomeWebDraft((current) => ({ ...current, heroTitleMain: event.target.value }))} /></label>
                        <label className="field field--wide"><span>Hero Description</span><textarea className="field-textarea" rows={4} value={homeWebDraft.heroDescription} onChange={(event) => setHomeWebDraft((current) => ({ ...current, heroDescription: event.target.value }))} /></label>
                        <label className="field"><span>Download Title</span><input className="field-input" value={homeWebDraft.downloadTitle} onChange={(event) => setHomeWebDraft((current) => ({ ...current, downloadTitle: event.target.value }))} /></label>
                        <label className="field"><span>Privacy Title</span><input className="field-input" value={homeWebDraft.privacyTitle} onChange={(event) => setHomeWebDraft((current) => ({ ...current, privacyTitle: event.target.value }))} /></label>
                        <label className="field field--wide"><span>Privacy Content</span><textarea className="field-textarea" rows={8} value={homeWebDraft.privacyContent} onChange={(event) => setHomeWebDraft((current) => ({ ...current, privacyContent: event.target.value }))} /></label>
                        <label className="field"><span>Terms Title</span><input className="field-input" value={homeWebDraft.termsTitle} onChange={(event) => setHomeWebDraft((current) => ({ ...current, termsTitle: event.target.value }))} /></label>
                        <label className="field field--wide"><span>Terms Content</span><textarea className="field-textarea" rows={8} value={homeWebDraft.termsContent} onChange={(event) => setHomeWebDraft((current) => ({ ...current, termsContent: event.target.value }))} /></label>
                      </div>
                    </section>
                    <div className="fig-release-card__actions">
                      <button className="solid-button" type="button" disabled={savingHomeWeb} onClick={() => onSaveHomeWeb?.(homeWebDraft)}>
                        {savingHomeWeb ? '保存中…' : '保存 Home官网'}
                      </button>
                    </div>
                  </section>
                )
              : activeTab === 'welcome'
                ? (
                  <section className="fig-card fig-card--subtle">
                    <div className="fig-card__head">
                      <h3>Welcome页</h3>
                      <span>React 版可直接保存欢迎页核心文案、视觉字段和 quick actions</span>
                    </div>
                    <div className="form-grid">
                      <label className="field" style={{ maxWidth: 180 }}>
                        <span>Enabled</span>
                        <input type="checkbox" checked={welcomeDraft.enabled} onChange={(event) => setWelcomeDraft((current) => ({ ...current, enabled: event.target.checked }))} />
                      </label>
                      <label className="field">
                        <span>Entry Label</span>
                        <input className="field-input" value={welcomeDraft.entryLabel} onChange={(event) => setWelcomeDraft((current) => ({ ...current, entryLabel: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>KOL Name</span>
                        <input className="field-input" value={welcomeDraft.kolName} onChange={(event) => setWelcomeDraft((current) => ({ ...current, kolName: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Expert Name</span>
                        <input className="field-input" value={welcomeDraft.expertName} onChange={(event) => setWelcomeDraft((current) => ({ ...current, expertName: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Slogan</span>
                        <input className="field-input" value={welcomeDraft.slogan} onChange={(event) => setWelcomeDraft((current) => ({ ...current, slogan: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Primary Color</span>
                        <input className="field-input" value={welcomeDraft.primaryColor} onChange={(event) => setWelcomeDraft((current) => ({ ...current, primaryColor: event.target.value }))} />
                      </label>
                      <label className="field field--wide">
                        <span>Avatar URL</span>
                        <input className="field-input" value={welcomeDraft.avatarUrl} onChange={(event) => setWelcomeDraft((current) => ({ ...current, avatarUrl: event.target.value }))} />
                      </label>
                      <label className="field field--wide">
                        <span>Background Image URL</span>
                        <input className="field-input" value={welcomeDraft.backgroundImageUrl} onChange={(event) => setWelcomeDraft((current) => ({ ...current, backgroundImageUrl: event.target.value }))} />
                      </label>
                      <label className="field field--wide">
                        <span>Description</span>
                        <textarea className="field-textarea" rows={4} value={welcomeDraft.description} onChange={(event) => setWelcomeDraft((current) => ({ ...current, description: event.target.value }))} />
                      </label>
                      <label className="field field--wide">
                        <span>Expertise Areas</span>
                        <textarea className="field-textarea" rows={4} value={welcomeDraft.expertiseAreas.join('\n')} onChange={(event) => setWelcomeDraft((current) => ({ ...current, expertiseAreas: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) }))} />
                      </label>
                      <label className="field field--wide">
                        <span>Target Audience</span>
                        <textarea className="field-textarea" rows={3} value={welcomeDraft.targetAudience} onChange={(event) => setWelcomeDraft((current) => ({ ...current, targetAudience: event.target.value }))} />
                      </label>
                      <label className="field field--wide">
                        <span>Disclaimer</span>
                        <textarea className="field-textarea" rows={3} value={welcomeDraft.disclaimer} onChange={(event) => setWelcomeDraft((current) => ({ ...current, disclaimer: event.target.value }))} />
                      </label>
                    </div>
                    <section className="fig-card fig-card--subtle">
                      <div className="fig-card__head">
                        <h3>Quick Actions</h3>
                        <span>4 个快捷动作位</span>
                      </div>
                      {welcomeDraft.quickActions.map((item, index) => (
                        <div key={index} className="form-grid" style={{ marginBottom: 12 }}>
                          <label className="field">
                            <span>Label</span>
                            <input className="field-input" value={item.label} onChange={(event) => setWelcomeDraft((current) => ({ ...current, quickActions: current.quickActions.map((entry, entryIndex) => entryIndex === index ? { ...entry, label: event.target.value } : entry) }))} />
                          </label>
                          <label className="field">
                            <span>Icon Key</span>
                            <input className="field-input" value={item.iconKey} onChange={(event) => setWelcomeDraft((current) => ({ ...current, quickActions: current.quickActions.map((entry, entryIndex) => entryIndex === index ? { ...entry, iconKey: event.target.value } : entry) }))} />
                          </label>
                          <label className="field field--wide">
                            <span>Prompt</span>
                            <textarea className="field-textarea" rows={3} value={item.prompt} onChange={(event) => setWelcomeDraft((current) => ({ ...current, quickActions: current.quickActions.map((entry, entryIndex) => entryIndex === index ? { ...entry, prompt: event.target.value } : entry) }))} />
                          </label>
                        </div>
                      ))}
                    </section>
                    <div className="fig-release-card__actions">
                      <button className="solid-button" type="button" disabled={savingWelcome} onClick={() => onSaveWelcome?.(welcomeDraft)}>
                        {savingWelcome ? '保存中…' : '保存 Welcome 页'}
                      </button>
                    </div>
                  </section>
                )
              : activeTab === 'input'
                ? (
                  <section className="fig-card fig-card--subtle">
                    <div className="fig-card__head">
                      <h3>输入框</h3>
                      <span>React 版可直接保存输入框启用状态和占位文案</span>
                    </div>
                    <div className="form-grid">
                      <label className="field" style={{ maxWidth: 180 }}>
                        <span>Enabled</span>
                        <input type="checkbox" checked={inputDraft.enabled} onChange={(event) => setInputDraft((current) => ({ ...current, enabled: event.target.checked }))} />
                      </label>
                      <label className="field field--wide">
                        <span>Placeholder</span>
                        <textarea className="field-textarea" rows={3} value={inputDraft.placeholderText} onChange={(event) => setInputDraft((current) => ({ ...current, placeholderText: event.target.value }))} />
                      </label>
                    </div>
                    <div className="fig-release-card__actions">
                      <button className="solid-button" type="button" disabled={savingInput} onClick={() => onSaveInput?.(inputDraft)}>
                        {savingInput ? '保存中…' : '保存输入框'}
                      </button>
                    </div>
                  </section>
                )
              : activeTab === 'sidebar'
                ? (
                  <section className="fig-card fig-card--subtle">
                    <div className="fig-card__head">
                      <h3>侧边栏</h3>
                      <span>React 版可直接保存侧边栏品牌块与布局字段</span>
                    </div>
                    <div className="form-grid">
                      <label className="field" style={{ maxWidth: 180 }}>
                        <span>Enabled</span>
                        <input type="checkbox" checked={sidebarDraft.enabled} onChange={(event) => setSidebarDraft((current) => ({ ...current, enabled: event.target.checked }))} />
                      </label>
                      <label className="field">
                        <span>Variant</span>
                        <input className="field-input" value={sidebarDraft.variant} onChange={(event) => setSidebarDraft((current) => ({ ...current, variant: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Brand Title</span>
                        <input className="field-input" value={sidebarDraft.brandTitle} onChange={(event) => setSidebarDraft((current) => ({ ...current, brandTitle: event.target.value }))} />
                      </label>
                      <label className="field field--wide">
                        <span>Brand Subtitle</span>
                        <input className="field-input" value={sidebarDraft.brandSubtitle} onChange={(event) => setSidebarDraft((current) => ({ ...current, brandSubtitle: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Section Style</span>
                        <input className="field-input" value={sidebarDraft.sectionStyle} onChange={(event) => setSidebarDraft((current) => ({ ...current, sectionStyle: event.target.value }))} />
                      </label>
                      <label className="field" style={{ maxWidth: 220 }}>
                        <span>Emphasize Active Item</span>
                        <input type="checkbox" checked={sidebarDraft.emphasizeActiveItem} onChange={(event) => setSidebarDraft((current) => ({ ...current, emphasizeActiveItem: event.target.checked }))} />
                      </label>
                    </div>
                    <div className="fig-release-card__actions">
                      <button className="solid-button" type="button" disabled={savingSidebar} onClick={() => onSaveSidebar?.(sidebarDraft)}>
                        {savingSidebar ? '保存中…' : '保存侧边栏'}
                      </button>
                    </div>
                  </section>
                )
              : activeTab === 'theme'
                ? (
                  <section className="fig-card fig-card--subtle">
                    <div className="fig-card__head">
                      <h3>主题样式</h3>
                      <span>React 版可直接保存 Light / Dark Theme 草稿</span>
                    </div>
                    <div className="fig-toolbar">
                      <label className="field">
                        <span>默认模式</span>
                        <select
                          className="field-select"
                          value={themeDraft.defaultMode}
                          onChange={(event) =>
                            setThemeDraft((current) => ({
                              ...current,
                              defaultMode: event.target.value as 'light' | 'dark' | 'system',
                            }))
                          }
                        >
                          <option value="dark">dark</option>
                          <option value="light">light</option>
                          <option value="system">system</option>
                        </select>
                      </label>
                    </div>
                    <div className="diff-grid">
                      <section className="fig-card fig-card--subtle">
                        <div className="fig-card__head">
                          <h3>Light Theme</h3>
                        </div>
                        <div className="form-grid">
                          <label className="field">
                            <span>Primary</span>
                            <input className="field-input" value={themeDraft.lightPrimary} onChange={(event) => setThemeDraft((current) => ({ ...current, lightPrimary: event.target.value }))} />
                          </label>
                          <label className="field">
                            <span>Primary Hover</span>
                            <input className="field-input" value={themeDraft.lightPrimaryHover} onChange={(event) => setThemeDraft((current) => ({ ...current, lightPrimaryHover: event.target.value }))} />
                          </label>
                          <label className="field">
                            <span>On Primary</span>
                            <input className="field-input" value={themeDraft.lightOnPrimary} onChange={(event) => setThemeDraft((current) => ({ ...current, lightOnPrimary: event.target.value }))} />
                          </label>
                        </div>
                      </section>
                      <section className="fig-card fig-card--subtle">
                        <div className="fig-card__head">
                          <h3>Dark Theme</h3>
                        </div>
                        <div className="form-grid">
                          <label className="field">
                            <span>Primary</span>
                            <input className="field-input" value={themeDraft.darkPrimary} onChange={(event) => setThemeDraft((current) => ({ ...current, darkPrimary: event.target.value }))} />
                          </label>
                          <label className="field">
                            <span>Primary Hover</span>
                            <input className="field-input" value={themeDraft.darkPrimaryHover} onChange={(event) => setThemeDraft((current) => ({ ...current, darkPrimaryHover: event.target.value }))} />
                          </label>
                          <label className="field">
                            <span>On Primary</span>
                            <input className="field-input" value={themeDraft.darkOnPrimary} onChange={(event) => setThemeDraft((current) => ({ ...current, darkOnPrimary: event.target.value }))} />
                          </label>
                        </div>
                      </section>
                    </div>
                    <div className="fig-release-card__actions">
                      <button className="solid-button" type="button" disabled={savingTheme} onClick={() => onSaveTheme?.(themeDraft)}>
                        {savingTheme ? '保存中…' : '保存主题'}
                      </button>
                    </div>
                  </section>
                )
              : activeTab === 'recharge'
                  ? (
                    <section className="fig-card fig-card--subtle">
                      <div className="fig-card__head">
                        <h3>充值套餐</h3>
                        <span>不勾选任何套餐并保存，会回退平台默认</span>
                      </div>
                      <div className="fig-list">
                        {availableRechargePackages.length ? (
                          availableRechargePackages.map((item) => {
                            const checked = rechargeDraft.includes(item.packageId);
                            return (
                              <label key={item.packageId} className="fig-list-item fig-list-item--spread" style={{ cursor: 'pointer' }}>
                                <div>
                                  <div className="fig-list-item__title">{item.packageName}</div>
                                  <div className="fig-list-item__meta">
                                    <span>{item.packageId}</span>
                                    {item.recommended ? <span>推荐</span> : null}
                                    {item.default ? <span>平台默认</span> : null}
                                  </div>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) =>
                                    setRechargeDraft((current) =>
                                      event.target.checked
                                        ? Array.from(new Set([...current, item.packageId]))
                                        : current.filter((packageId) => packageId !== item.packageId),
                                    )
                                  }
                                />
                              </label>
                            );
                          })
                        ) : (
                          <div className="empty-state">当前没有平台套餐目录。</div>
                        )}
                      </div>
                      <div className="fig-release-card__actions">
                        <button className="solid-button" type="button" disabled={savingRechargePackages} onClick={() => onSaveRechargePackages?.(rechargeDraft)}>
                          {savingRechargePackages ? '保存中…' : '保存充值套餐'}
                        </button>
                      </div>
                    </section>
                  )
              : activeTab === 'desktop'
                    ? (
                      <section className="fig-card fig-card--subtle">
                        <div className="fig-card__head">
                          <h3>桌面端</h3>
                          <span>React 版可直接保存桌面端核心品牌字段</span>
                        </div>
                        <div className="form-grid form-grid--two">
                          <label className="field">
                            <span>Website Title</span>
                            <input className="field-input" value={desktopShellDraft.websiteTitle} onChange={(event) => setDesktopShellDraft((current) => ({ ...current, websiteTitle: event.target.value }))} />
                          </label>
                          <label className="field">
                            <span>Dev Website Title</span>
                            <input className="field-input" value={desktopShellDraft.devWebsiteTitle} onChange={(event) => setDesktopShellDraft((current) => ({ ...current, devWebsiteTitle: event.target.value }))} />
                          </label>
                          <label className="field">
                            <span>Sidebar Title</span>
                            <input className="field-input" value={desktopShellDraft.sidebarTitle} onChange={(event) => setDesktopShellDraft((current) => ({ ...current, sidebarTitle: event.target.value }))} />
                          </label>
                          <label className="field">
                            <span>Dev Sidebar Title</span>
                            <input className="field-input" value={desktopShellDraft.devSidebarTitle} onChange={(event) => setDesktopShellDraft((current) => ({ ...current, devSidebarTitle: event.target.value }))} />
                          </label>
                          <label className="field field--wide">
                            <span>Sidebar Subtitle</span>
                            <input className="field-input" value={desktopShellDraft.sidebarSubtitle} onChange={(event) => setDesktopShellDraft((current) => ({ ...current, sidebarSubtitle: event.target.value }))} />
                          </label>
                          <label className="field">
                            <span>Legal Name</span>
                            <input className="field-input" value={desktopShellDraft.legalName} onChange={(event) => setDesktopShellDraft((current) => ({ ...current, legalName: event.target.value }))} />
                          </label>
                          <label className="field">
                            <span>Bundle Identifier</span>
                            <input className="field-input" value={desktopShellDraft.bundleIdentifier} onChange={(event) => setDesktopShellDraft((current) => ({ ...current, bundleIdentifier: event.target.value }))} />
                          </label>
                          <label className="field field--wide">
                            <span>Auth Service</span>
                            <input className="field-input" value={desktopShellDraft.authService} onChange={(event) => setDesktopShellDraft((current) => ({ ...current, authService: event.target.value }))} />
                          </label>
                        </div>
                        <div className="fig-release-card__actions">
                          <button className="solid-button" type="button" disabled={savingDesktopShell} onClick={() => onSaveDesktopShell?.(desktopShellDraft)}>
                            {savingDesktopShell ? '保存中…' : '保存桌面端'}
                          </button>
                        </div>
                      </section>
                    )
                    : renderScalarSummary(
                        `${activeTab} 摘要`,
                        '当前 tab 的主要结构化字段',
                        {
                          enabled: surface.enabled !== false ? 'true' : 'false',
                          ...surfaceConfig,
                        },
                        [
                          'enabled',
                          'templateKey',
                          'title',
                          'subtitle',
                          'description',
                          'headerVariant',
                          'variant',
                          'heroTitleMain',
                          'brandLabel',
                          'statusLabel',
                        ],
                      )}
    </>
  );
}
