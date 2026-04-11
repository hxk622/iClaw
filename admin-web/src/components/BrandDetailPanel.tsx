import { asObject, stringValue } from '../lib/adminApi';
import { useEffect, useState } from 'react';
import {
  actionLabel,
  buildPortalAssetUrl,
  formatDateTime,
  formatRelative,
  isImageLike,
  resolveAssetUrl,
  statusLabel,
} from '../lib/adminFormat';
import {
  normalizeAuthExperienceConfig,
  normalizeDesktopShellConfig,
  normalizeHeaderSurfaceConfig,
  normalizeHomeWebSurfaceConfig,
  normalizeInputSurfaceConfig,
  normalizeSidebarSurfaceConfig,
  normalizeWelcomeSurfaceConfig,
} from '../lib/brandSurfaceDrafts';
import type { BrandDetailData } from '../lib/adminTypes';

const HOME_WEB_PREVIEW_BASE_URL = ((import.meta.env.VITE_HOME_WEB_BASE_URL || 'http://127.0.0.1:1477') + '').trim().replace(/\/+$/, '');

type BrandDetailTabId =
  | 'desktop'
  | 'home-web'
  | 'welcome'
  | 'auth'
  | 'header'
  | 'sidebar'
  | 'input'
  | 'models'
  | 'skills'
  | 'mcps'
  | 'recharge'
  | 'menus'
  | 'assets'
  | 'theme';

function resolveDetailAsset(detail: BrandDetailData, assetKey: string) {
  return detail.assets.find((item) => stringValue(item.assetKey) === assetKey) || null;
}

function resolveDetailAssetUrl(detail: BrandDetailData, assetKey: string): string {
  const asset = resolveDetailAsset(detail, assetKey);
  if (!asset) {
    return '';
  }
  return resolveAssetUrl({
    publicUrl: stringValue(asset.publicUrl),
    appName: stringValue(asset.appName || detail.brand.brandId),
    brandId: detail.brand.brandId,
    assetKey: stringValue(asset.assetKey),
  });
}

function renderWelcomeAssetCard({
  title,
  assetKey,
  previewUrl,
  emptyLabel,
}: {
  title: string;
  assetKey: string;
  previewUrl: string;
  emptyLabel: string;
}) {
  return (
    <div className="field field--wide">
      <span>{title}</span>
      <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              height: 160,
              border: '1px solid var(--border-default)',
              borderRadius: 18,
              overflow: 'hidden',
              background: 'var(--card-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{emptyLabel}</span>
            )}
          </div>
          <small style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Asset Key: {assetKey}</small>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {previewUrl ? `当前已绑定 ${assetKey}` : `当前未绑定 ${assetKey}`}
          </div>
          {previewUrl ? (
            <a className="text-button" href={previewUrl} target="_blank" rel="noreferrer">
              打开资源
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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

function renderAssets(detail: BrandDetailData, savingAsset = false, onDeleteAsset?: (assetKey: string) => void) {
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
              <div className="fig-asset-card__actions">
                <button className="text-button" type="button" disabled={savingAsset} onClick={() => onDeleteAsset?.(stringValue(item.assetKey))}>
                  删除
                </button>
              </div>
            </div>
          </article>
        ))
      ) : (
        <div className="empty-state empty-state--panel">当前没有品牌资源。</div>
      )}
    </section>
  );
}

const BRAND_ASSET_SLOTS: Array<{ assetKey: string; label: string; kind: string }> = [
  { assetKey: 'logoMaster', label: 'Logo Master', kind: 'logo' },
  { assetKey: 'homeLogo', label: 'Home Logo', kind: 'logo' },
  { assetKey: 'faviconPng', label: 'Favicon PNG', kind: 'favicon' },
  { assetKey: 'faviconIco', label: 'Favicon ICO', kind: 'favicon' },
  { assetKey: 'assistantAvatar', label: 'Assistant Avatar', kind: 'assistant-avatar' },
  { assetKey: 'installerHero', label: 'Installer Hero', kind: 'hero' },
  { assetKey: 'welcomeAvatar', label: 'Welcome Avatar', kind: 'welcome-avatar' },
  { assetKey: 'welcomeBackground', label: 'Welcome Background', kind: 'welcome-background' },
];

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
  onDirtyChange,
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
  availableComposerControls = [],
  savingComposerControls = false,
  onSaveComposerControls,
  availableComposerShortcuts = [],
  savingComposerShortcuts = false,
  onSaveComposerShortcuts,
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
  availableModels = [],
  savingModels = false,
  onSaveModels,
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
  onDeleteAsset,
}: {
  detail: BrandDetailData;
  activeTab: BrandDetailTabId;
  onDirtyChange?: (dirty: boolean) => void;
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
  availableComposerControls?: Array<{
    controlKey: string;
    displayName: string;
    controlType: string;
    options: Array<{ optionValue: string; label: string }>;
  }>;
  savingComposerControls?: boolean;
  onSaveComposerControls?: (
    items: Array<{ controlKey: string; enabled: boolean; displayName: string; allowedOptionValues: string[] }>,
  ) => Promise<void> | void;
  availableComposerShortcuts?: Array<{
    shortcutKey: string;
    displayName: string;
    description: string;
    template: string;
    tone: string;
  }>;
  savingComposerShortcuts?: boolean;
  onSaveComposerShortcuts?: (
    items: Array<{ shortcutKey: string; enabled: boolean; displayName: string; description: string; template: string }>,
  ) => Promise<void> | void;
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
  availableModels?: Array<{ ref: string; label: string; providerId?: string; modelId?: string }>;
  savingModels?: boolean;
  onSaveModels?: (
    items: Array<{ modelRef: string; enabled: boolean; recommended: boolean; default: boolean }>,
  ) => Promise<void> | void;
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
    metadata?: Record<string, unknown>;
    file: File;
  }) => Promise<void> | void;
  onDeleteAsset?: (assetKey: string) => Promise<void> | void;
}) {
  const surface = asObject(asObject(detail.appConfig.surfaces)[activeTab] || {});
  const surfaceConfig = asObject(surface.config || surface);
  const theme = asObject(detail.appConfig.theme);
  const desktopDraftSource = normalizeDesktopShellConfig(detail.appConfig);
  const buildBrandMetaDraft = () => ({
    displayName: stringValue(detail.brand.displayName),
    productName: stringValue(detail.brand.productName),
    tenantKey: stringValue(detail.brand.tenantKey),
    defaultLocale: stringValue(detail.brand.defaultLocale || 'zh-CN'),
    status: detail.brand.status === 'disabled' ? 'disabled' : 'active',
  });
  const sidebarSurface = asObject(asObject(detail.appConfig.surfaces).sidebar);
  const sidebarConfig = normalizeSidebarSurfaceConfig(asObject(sidebarSurface.config));
  const [sidebarDraft, setSidebarDraft] = useState({
    enabled: sidebarSurface.enabled !== false,
    variant: sidebarConfig.variant,
    brandTitle: sidebarConfig.brandTitle,
    brandSubtitle: sidebarConfig.brandSubtitle,
    sectionStyle: sidebarConfig.sectionStyle,
    emphasizeActiveItem: sidebarConfig.emphasizeActiveItem,
  });
  const lightTheme = asObject(theme.light);
  const darkTheme = asObject(theme.dark);
  const [brandMetaDraft, setBrandMetaDraft] = useState(buildBrandMetaDraft);
  const [desktopShellDraft, setDesktopShellDraft] = useState(desktopDraftSource);
  const buildAuthDraft = () =>
    normalizeAuthExperienceConfig(detail.appConfig.auth_experience || detail.appConfig.authExperience, {
      brandId: detail.brand.brandId,
      displayName: detail.brand.displayName,
      legalName: desktopDraftSource.legalName,
    });
  const [authDraft, setAuthDraft] = useState(buildAuthDraft);
  const headerSurface = asObject(asObject(detail.appConfig.surfaces).header);
  const buildHeaderDraft = () => ({
    enabled: headerSurface.enabled !== false,
    ...normalizeHeaderSurfaceConfig(asObject(headerSurface.config)),
  });
  const [headerDraft, setHeaderDraft] = useState(buildHeaderDraft);
  const homeWebSurface = asObject(asObject(detail.appConfig.surfaces)['home-web']);
  const normalizedHomeWebConfig = normalizeHomeWebSurfaceConfig(asObject(homeWebSurface.config), {
    brandId: detail.brand.brandId,
    displayName: detail.brand.displayName,
  });
  const buildHomeWebDraft = () => ({
    ...normalizedHomeWebConfig,
    enabled: homeWebSurface.enabled !== false,
  });
  const [homeWebDraft, setHomeWebDraft] = useState(buildHomeWebDraft);
  const inputSurface = asObject(asObject(detail.appConfig.surfaces).input);
  const buildInputDraft = () => ({
    enabled: inputSurface.enabled !== false,
    ...normalizeInputSurfaceConfig(asObject(inputSurface.config)),
  });
  const [inputDraft, setInputDraft] = useState(buildInputDraft);
  const [composerControlDraft, setComposerControlDraft] = useState<
    Array<{ controlKey: string; enabled: boolean; displayName: string; allowedOptionValues: string[] }>
  >(
    detail.composerControlBindings.map((item) => {
      const config = asObject(item.config);
      return {
        controlKey: stringValue(item.controlKey || item.control_key),
        enabled: item.enabled !== false,
        displayName: stringValue(config.display_name || config.displayName),
        allowedOptionValues: Array.isArray(config.allowed_option_values)
          ? config.allowed_option_values.map((entry) => String(entry || ''))
          : Array.isArray(config.allowedOptionValues)
            ? config.allowedOptionValues.map((entry) => String(entry || ''))
            : [],
      };
    }).filter((item) => item.controlKey),
  );
  const [composerShortcutDraft, setComposerShortcutDraft] = useState<
    Array<{ shortcutKey: string; enabled: boolean; displayName: string; description: string; template: string }>
  >(
    detail.composerShortcutBindings.map((item) => {
      const config = asObject(item.config);
      return {
        shortcutKey: stringValue(item.shortcutKey || item.shortcut_key),
        enabled: item.enabled !== false,
        displayName: stringValue(config.display_name || config.displayName),
        description: stringValue(config.description),
        template: stringValue(config.template || config.template_text),
      };
    }).filter((item) => item.shortcutKey),
  );
  const welcomeSurface = asObject(asObject(detail.appConfig.surfaces).welcome);
  const welcomeAvatarAssetUrl = resolveDetailAssetUrl(detail, 'welcomeAvatar');
  const welcomeBackgroundAssetUrl = resolveDetailAssetUrl(detail, 'welcomeBackground');
  const assistantAvatarAssetUrl = resolveDetailAssetUrl(detail, 'assistantAvatar');
  const logoMasterAssetUrl = resolveDetailAssetUrl(detail, 'logoMaster');
  const installerHeroAssetUrl = resolveDetailAssetUrl(detail, 'installerHero');
  const normalizedWelcomeConfig = normalizeWelcomeSurfaceConfig(asObject(welcomeSurface.config));
  const buildWelcomeDraft = () => ({
    enabled: welcomeSurface.enabled !== false,
    ...normalizedWelcomeConfig,
    avatarUrl:
      normalizedWelcomeConfig.avatarUrl ||
      welcomeAvatarAssetUrl ||
      assistantAvatarAssetUrl ||
      logoMasterAssetUrl,
    backgroundImageUrl:
      normalizedWelcomeConfig.backgroundImageUrl ||
      welcomeBackgroundAssetUrl ||
      installerHeroAssetUrl,
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
  const [modelDraft, setModelDraft] = useState<
    Array<{ modelRef: string; enabled: boolean; recommended: boolean; default: boolean }>
  >(
    detail.modelBindings
      .map((item) => {
        const config = asObject(item.config);
        return {
          modelRef: stringValue(item.modelRef || item.model_ref),
          enabled: item.enabled !== false,
          recommended: config.recommended === true,
          default: config.default === true,
        };
      })
      .filter((item) => item.modelRef),
  );
  const buildMenuDraftItems = (items: Array<{ menuKey: string; enabled: boolean; displayName: string; group: string }>) => {
    const nonLegacyMenus = availableMenus.filter((item) => item.category !== 'legacy');
    const itemMap = new Map(
      items
        .filter((item) => item.menuKey)
        .map((item) => [item.menuKey, item] as const),
    );
    return nonLegacyMenus.length
      ? nonLegacyMenus.map((item) => itemMap.get(item.key) || {
        menuKey: item.key,
        enabled: false,
        displayName: '',
        group: '',
      })
      : items.slice();
  };
  const [menuDraft, setMenuDraft] = useState<
    Array<{ menuKey: string; enabled: boolean; displayName: string; group: string }>
  >(
    buildMenuDraftItems(detail.menuBindings.map((item) => {
      const config = asObject(item.config);
      return {
        menuKey: stringValue(item.menuKey || item.menu_key),
        enabled: item.enabled !== false,
        displayName: stringValue(config.display_name || config.displayName),
        group: stringValue(config.group_label || config.groupLabel || config.group),
      };
    })),
  );
  const [selectedMenuKey, setSelectedMenuKey] = useState(menuDraft[0]?.menuKey || '');
  const [menuDragState, setMenuDragState] = useState<{
    sourceKey: string;
    overKey: string;
    placement: 'before' | 'after';
  }>({
    sourceKey: '',
    overKey: '',
    placement: 'before',
  });
  const [assetDraft, setAssetDraft] = useState({
    assetKey: '',
    kind: '',
    metadataText: '{}',
    file: null as File | null,
  });

  const isSameJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

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
    setComposerControlDraft(
      detail.composerControlBindings.map((item) => {
        const config = asObject(item.config);
        return {
          controlKey: stringValue(item.controlKey || item.control_key),
          enabled: item.enabled !== false,
          displayName: stringValue(config.display_name || config.displayName),
          allowedOptionValues: Array.isArray(config.allowed_option_values)
            ? config.allowed_option_values.map((entry) => String(entry || ''))
            : Array.isArray(config.allowedOptionValues)
              ? config.allowedOptionValues.map((entry) => String(entry || ''))
              : [],
        };
      }).filter((item) => item.controlKey),
    );
  }, [detail]);

  useEffect(() => {
    setComposerShortcutDraft(
      detail.composerShortcutBindings.map((item) => {
        const config = asObject(item.config);
        return {
          shortcutKey: stringValue(item.shortcutKey || item.shortcut_key),
          enabled: item.enabled !== false,
          displayName: stringValue(config.display_name || config.displayName),
          description: stringValue(config.description),
          template: stringValue(config.template || config.template_text),
        };
      }).filter((item) => item.shortcutKey),
    );
  }, [detail]);

  useEffect(() => {
    setWelcomeDraft(buildWelcomeDraft());
  }, [detail]);

  useEffect(() => {
    setSidebarDraft({
      enabled: sidebarSurface.enabled !== false,
      variant: sidebarConfig.variant,
      brandTitle: sidebarConfig.brandTitle,
      brandSubtitle: sidebarConfig.brandSubtitle,
      sectionStyle: sidebarConfig.sectionStyle,
      emphasizeActiveItem: sidebarConfig.emphasizeActiveItem,
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
    setModelDraft(
      detail.modelBindings
        .map((item) => {
          const config = asObject(item.config);
          return {
            modelRef: stringValue(item.modelRef || item.model_ref),
            enabled: item.enabled !== false,
            recommended: config.recommended === true,
            default: config.default === true,
          };
        })
        .filter((item) => item.modelRef),
    );
  }, [detail]);

  useEffect(() => {
    setMenuDraft(
      buildMenuDraftItems(detail.menuBindings.map((item) => {
        const config = asObject(item.config);
        return {
          menuKey: stringValue(item.menuKey || item.menu_key),
          enabled: item.enabled !== false,
          displayName: stringValue(config.display_name || config.displayName),
          group: stringValue(config.group_label || config.groupLabel || config.group),
        };
      })),
    );
  }, [detail, availableMenus]);

  useEffect(() => {
    if (!menuDraft.length) {
      if (selectedMenuKey) {
        setSelectedMenuKey('');
      }
      return;
    }
    if (!menuDraft.some((item) => item.menuKey === selectedMenuKey)) {
      setSelectedMenuKey(menuDraft[0]?.menuKey || '');
    }
  }, [menuDraft, selectedMenuKey]);

  const reorderMenuDraft = (sourceKey: string, targetKey: string, placement: 'before' | 'after') => {
    if (!sourceKey || !targetKey || sourceKey === targetKey) {
      return;
    }
    setMenuDraft((current) => {
      const next = [...current];
      const sourceIndex = next.findIndex((item) => item.menuKey === sourceKey);
      const targetIndex = next.findIndex((item) => item.menuKey === targetKey);
      if (sourceIndex < 0 || targetIndex < 0) {
        return current;
      }
      const [moved] = next.splice(sourceIndex, 1);
      const normalizedTargetIndex = next.findIndex((item) => item.menuKey === targetKey);
      const insertIndex = placement === 'after' ? normalizedTargetIndex + 1 : normalizedTargetIndex;
      next.splice(insertIndex, 0, moved);
      return next;
    });
    setSelectedMenuKey(sourceKey);
  };

  const selectedMenu = menuDraft.find((item) => item.menuKey === selectedMenuKey) || menuDraft[0] || null;
  const selectedMenuCatalog = selectedMenu
    ? availableMenus.find((entry) => entry.key === selectedMenu.menuKey) || null
    : null;
  const selectedMenuLabel = selectedMenu?.displayName.trim() || selectedMenuCatalog?.label || selectedMenu?.menuKey || '';
  const updateSelectedMenu = (updater: (item: { menuKey: string; enabled: boolean; displayName: string; group: string }) => {
    menuKey: string;
    enabled: boolean;
    displayName: string;
    group: string;
  }) => {
    if (!selectedMenu) {
      return;
    }
    setMenuDraft((current) =>
      current.map((entry) => (entry.menuKey === selectedMenu.menuKey ? updater(entry) : entry)),
    );
  };

  useEffect(() => {
    const baseComposerControls = detail.composerControlBindings.map((item) => {
      const config = asObject(item.config);
      return {
        controlKey: stringValue(item.controlKey || item.control_key),
        enabled: item.enabled !== false,
        displayName: stringValue(config.display_name || config.displayName),
        allowedOptionValues: Array.isArray(config.allowed_option_values)
          ? config.allowed_option_values.map((entry) => String(entry || ''))
          : Array.isArray(config.allowedOptionValues)
            ? config.allowedOptionValues.map((entry) => String(entry || ''))
            : [],
      };
    }).filter((item) => item.controlKey);
    const baseComposerShortcuts = detail.composerShortcutBindings.map((item) => {
      const config = asObject(item.config);
      return {
        shortcutKey: stringValue(item.shortcutKey || item.shortcut_key),
        enabled: item.enabled !== false,
        displayName: stringValue(config.display_name || config.displayName),
        description: stringValue(config.description),
        template: stringValue(config.template || config.template_text),
      };
    }).filter((item) => item.shortcutKey);
    const baseModelDraft = detail.modelBindings
      .map((item) => {
        const config = asObject(item.config);
        return {
          modelRef: stringValue(item.modelRef || item.model_ref),
          enabled: item.enabled !== false,
          recommended: config.recommended === true,
          default: config.default === true,
        };
      })
      .filter((item) => item.modelRef);
    const baseMenuDraft = buildMenuDraftItems(detail.menuBindings.map((item) => {
      const config = asObject(item.config);
      return {
        menuKey: stringValue(item.menuKey || item.menu_key),
        enabled: item.enabled !== false,
        displayName: stringValue(config.display_name || config.displayName),
        group: stringValue(config.group_label || config.groupLabel || config.group),
      };
    }));
    const dirty =
      activeTab === 'desktop'
        ? !isSameJson(desktopShellDraft, desktopDraftSource)
        : activeTab === 'auth'
          ? !isSameJson(authDraft, buildAuthDraft())
          : activeTab === 'header'
            ? !isSameJson(headerDraft, buildHeaderDraft())
            : activeTab === 'home-web'
              ? !isSameJson(homeWebDraft, buildHomeWebDraft())
              : activeTab === 'welcome'
                ? !isSameJson(welcomeDraft, buildWelcomeDraft())
                : activeTab === 'sidebar'
                  ? !isSameJson(sidebarDraft, {
                    enabled: sidebarSurface.enabled !== false,
                    variant: sidebarConfig.variant,
                    brandTitle: sidebarConfig.brandTitle,
                    brandSubtitle: sidebarConfig.brandSubtitle,
                    sectionStyle: sidebarConfig.sectionStyle,
                    emphasizeActiveItem: sidebarConfig.emphasizeActiveItem,
                  })
                  : activeTab === 'input'
                    ? (
                      !isSameJson(inputDraft, buildInputDraft()) ||
                      !isSameJson(composerControlDraft, baseComposerControls) ||
                      !isSameJson(composerShortcutDraft, baseComposerShortcuts)
                    )
                    : activeTab === 'theme'
                      ? !isSameJson(themeDraft, {
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
                      })
                      : activeTab === 'skills'
                        ? !isSameJson(skillDraft, detail.skillBindings.filter((item) => item.enabled !== false).map((item) => stringValue(item.skillSlug)).filter(Boolean))
                        : activeTab === 'models'
                          ? !isSameJson(modelDraft, baseModelDraft)
                          : activeTab === 'mcps'
                            ? !isSameJson(mcpDraft, detail.mcpBindings.filter((item) => item.enabled !== false).map((item) => stringValue(item.mcpKey)).filter(Boolean))
                            : activeTab === 'recharge'
                              ? !isSameJson(rechargeDraft, detail.rechargePackageBindings.filter((item) => item.enabled !== false).map((item) => stringValue(item.packageId || item.package_id)).filter(Boolean))
                              : activeTab === 'menus'
                                ? !isSameJson(menuDraft, baseMenuDraft)
                                : activeTab === 'assets'
                                  ? Boolean(assetDraft.file || assetDraft.assetKey || assetDraft.kind)
                                  : !isSameJson(brandMetaDraft, buildBrandMetaDraft());
    onDirtyChange?.(dirty);
  }, [
    activeTab,
    assetDraft,
    authDraft,
    brandMetaDraft,
    composerControlDraft,
    composerShortcutDraft,
    desktopShellDraft,
    detail,
    headerDraft,
    homeWebDraft,
    inputDraft,
    lightTheme,
    darkTheme,
    mcpDraft,
    menuDraft,
    onDirtyChange,
    rechargeDraft,
    sidebarConfig.brandSubtitle,
    sidebarConfig.brandTitle,
    sidebarConfig.emphasizeActiveItem,
    sidebarConfig.sectionStyle,
    sidebarConfig.variant,
    sidebarDraft,
    sidebarSurface.enabled,
    skillDraft,
    theme,
    themeDraft,
    welcomeDraft,
    modelDraft,
  ]);

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
          : activeTab === 'models'
            ? (
              <section className="fig-card fig-card--subtle">
                <div className="fig-card__head">
                  <h3>模型 Allowlist</h3>
                  <span>按 OEM 控制可见模型、推荐模型和默认模型</span>
                </div>
                <div className="form-grid" style={{ marginBottom: 16 }}>
                  <label className="field field--wide">
                    <span>默认模型</span>
                    <select
                      className="field-select"
                      value={modelDraft.find((item) => item.default)?.modelRef || ''}
                      onChange={(event) =>
                        setModelDraft((current) =>
                          current.map((entry) => ({
                            ...entry,
                            default: entry.enabled && entry.modelRef === event.target.value,
                          })),
                        )
                      }
                    >
                      <option value="">请选择默认模型</option>
                      {modelDraft.filter((item) => item.enabled).map((item) => {
                        const model = availableModels.find((entry) => entry.ref === item.modelRef);
                        return (
                          <option key={item.modelRef} value={item.modelRef}>
                            {model?.label || item.modelRef}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>
                <div className="fig-list">
                  {(availableModels.length ? availableModels : modelDraft.map((item) => ({ ref: item.modelRef, label: item.modelRef, providerId: '', modelId: '' }))).map((item) => {
                    const existing = modelDraft.find((entry) => entry.modelRef === item.ref) || {
                      modelRef: item.ref,
                      enabled: false,
                      recommended: false,
                      default: false,
                    };
                    return (
                      <div key={item.ref} className="fig-list-item">
                        <div style={{ width: '100%' }}>
                          <div className="fig-list-item__title">{item.label}</div>
                          <div className="fig-list-item__meta">
                            <span>{item.ref}</span>
                            {item.providerId ? <span>{item.providerId}</span> : null}
                            {item.modelId ? <span>{item.modelId}</span> : null}
                          </div>
                          <div className="fig-release-card__actions" style={{ marginTop: 12 }}>
                            <label className="toggle fig-toggle">
                              <input
                                type="checkbox"
                                checked={existing.enabled}
                                onChange={(event) =>
                                  setModelDraft((current) => {
                                    const has = current.some((entry) => entry.modelRef === item.ref);
                                    if (!has) {
                                      return [...current, { modelRef: item.ref, enabled: event.target.checked, recommended: false, default: false }];
                                    }
                                    return current.map((entry) =>
                                      entry.modelRef === item.ref
                                        ? {
                                            ...entry,
                                            enabled: event.target.checked,
                                            default: event.target.checked ? entry.default : false,
                                            recommended: event.target.checked ? entry.recommended : false,
                                          }
                                        : entry,
                                    );
                                  })
                                }
                              />
                              <span>启用</span>
                            </label>
                            <label className="toggle fig-toggle">
                              <input
                                type="checkbox"
                                checked={existing.enabled && existing.recommended}
                                disabled={!existing.enabled}
                                onChange={(event) =>
                                  setModelDraft((current) =>
                                    current.map((entry) =>
                                      entry.modelRef === item.ref ? { ...entry, recommended: event.target.checked } : entry,
                                    ),
                                  )
                                }
                              />
                              <span>推荐</span>
                            </label>
                            <label className="toggle fig-toggle">
                              <input
                                type="radio"
                                name="brand_default_model"
                                checked={existing.enabled && existing.default}
                                disabled={!existing.enabled}
                                onChange={() =>
                                  setModelDraft((current) =>
                                    current.map((entry) => ({
                                      ...entry,
                                      default: entry.enabled && entry.modelRef === item.ref,
                                    })),
                                  )
                                }
                              />
                              <span>默认</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="fig-release-card__actions">
                  <button className="solid-button" type="button" disabled={savingModels} onClick={() => onSaveModels?.(modelDraft)}>
                    {savingModels ? '保存中…' : '保存模型绑定'}
                  </button>
                </div>
              </section>
            )
          : activeTab === 'menus'
            ? (
              <section className="fig-card fig-card--subtle">
                <div className="fig-card__head">
                  <h3>左菜单栏</h3>
                  <span>左侧拖拽排序，右侧编辑当前选中的菜单项</span>
                </div>
                <div className="fig-layout">
                  <section className="menu-assembly-list">
                    <div className="fig-card fig-card--subtle">
                      <div className="fig-card__head">
                        <h3>菜单列表</h3>
                        <span>拖动卡片排序，点击卡片切换右侧配置</span>
                      </div>
                      <div className="menu-assembly-list__stack">
                        {menuDraft.map((item, index) => {
                          const catalog = availableMenus.find((entry) => entry.key === item.menuKey) || null;
                          const displayName = item.displayName.trim() || catalog?.label || item.menuKey;
                          const isActive = selectedMenu?.menuKey === item.menuKey;
                          const isDragging = menuDragState.sourceKey === item.menuKey;
                          const isDropBefore =
                            menuDragState.overKey === item.menuKey &&
                            menuDragState.sourceKey !== item.menuKey &&
                            menuDragState.placement === 'before';
                          const isDropAfter =
                            menuDragState.overKey === item.menuKey &&
                            menuDragState.sourceKey !== item.menuKey &&
                            menuDragState.placement === 'after';
                          return (
                            <div
                              key={item.menuKey || index}
                              className={`menu-assembly-card${isActive ? ' is-active' : ''}${isDragging ? ' is-dragging' : ''}${isDropBefore ? ' is-drop-before' : ''}${isDropAfter ? ' is-drop-after' : ''}`}
                              role="button"
                              tabIndex={0}
                              draggable
                              onClick={() => setSelectedMenuKey(item.menuKey)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  setSelectedMenuKey(item.menuKey);
                                }
                              }}
                              onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = 'move';
                                event.dataTransfer.setData('text/plain', item.menuKey);
                                setMenuDragState({
                                  sourceKey: item.menuKey,
                                  overKey: '',
                                  placement: 'before',
                                });
                              }}
                              onDragOver={(event) => {
                                if (!menuDragState.sourceKey || menuDragState.sourceKey === item.menuKey) {
                                  return;
                                }
                                event.preventDefault();
                                const rect = event.currentTarget.getBoundingClientRect();
                                const placement = event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before';
                                setMenuDragState((current) =>
                                  current.overKey === item.menuKey && current.placement === placement
                                    ? current
                                    : {
                                      ...current,
                                      overKey: item.menuKey,
                                      placement,
                                    },
                                );
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                const sourceKey = menuDragState.sourceKey || event.dataTransfer.getData('text/plain');
                                const rect = event.currentTarget.getBoundingClientRect();
                                const placement = event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before';
                                reorderMenuDraft(sourceKey, item.menuKey, placement);
                                setMenuDragState({
                                  sourceKey: '',
                                  overKey: '',
                                  placement: 'before',
                                });
                              }}
                              onDragEnd={() =>
                                setMenuDragState({
                                  sourceKey: '',
                                  overKey: '',
                                  placement: 'before',
                                })
                              }
                            >
                              <span className="menu-assembly-card__icon">
                                <span className="menu-assembly-card__svg menu-assembly-card__glyph" aria-hidden="true">
                                  {(displayName || 'M').slice(0, 1)}
                                </span>
                              </span>
                              <span className="menu-assembly-card__body">
                                <span className="menu-assembly-card__title-row">
                                  <strong>{displayName}</strong>
                                  <span className="menu-assembly-card__order">#{index + 1}</span>
                                </span>
                                <span className="menu-assembly-card__meta">
                                  {item.menuKey}
                                  {catalog?.category ? ` · ${catalog.category}` : ''}
                                </span>
                                <span className="menu-assembly-card__submeta">
                                  {(item.group.trim() || '未分组')}
                                  {' · '}
                                  {item.enabled ? '已启用' : '已关闭'}
                                </span>
                              </span>
                              <button
                                className={`switch menu-assembly-card__switch${item.enabled ? ' is-checked' : ''}`}
                                type="button"
                                draggable={false}
                                aria-pressed={item.enabled ? 'true' : 'false'}
                                aria-label={`${item.enabled ? '关闭' : '启用'} ${displayName}`}
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setMenuDraft((current) =>
                                    current.map((entry) =>
                                      entry.menuKey === item.menuKey ? { ...entry, enabled: !entry.enabled } : entry,
                                    ),
                                  );
                                }}
                                onDragStart={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                              >
                                <span className="switch__track">
                                  <span className="switch__thumb"></span>
                                </span>
                                <span className="switch__label">{item.enabled ? '开' : '关'}</span>
                              </button>
                              <span className="menu-assembly-card__drag" aria-hidden="true" title="拖动排序">
                                <span></span>
                                <span></span>
                                <span></span>
                                <span></span>
                                <span></span>
                                <span></span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                  <section className="menu-assembly-detail">
                    {selectedMenu ? (
                      <div className="fig-card fig-card--subtle">
                        <div className="fig-card__head">
                          <h3>{selectedMenuLabel || '菜单详情'}</h3>
                          <span>
                            {selectedMenu.menuKey}
                            {selectedMenuCatalog?.category ? ` · ${selectedMenuCatalog.category}` : ''}
                          </span>
                        </div>
                        <article className="menu-assembly-preview">
                          <div className="menu-assembly-preview__icon">
                            <span className="menu-assembly-preview__svg menu-assembly-preview__glyph" aria-hidden="true">
                              {(selectedMenuLabel || 'M').slice(0, 1)}
                            </span>
                          </div>
                          <div className="menu-assembly-preview__body">
                            <div className="menu-assembly-preview__eyebrow">Menu Preview</div>
                            <div className="menu-assembly-preview__title">{selectedMenuLabel || selectedMenu.menuKey}</div>
                            <div className="menu-assembly-preview__meta">
                              {selectedMenu.group.trim() || '未分组'}
                              {' · '}
                              {selectedMenu.enabled ? '已启用' : '已关闭'}
                            </div>
                          </div>
                        </article>
                        <div className="form-grid fig-menu-card__grid fig-menu-card__grid--detail">
                          <label className="field">
                            <span>Menu Key</span>
                            <input className="field-input" value={selectedMenu.menuKey} readOnly />
                          </label>
                          <label className="field">
                            <span>默认名称</span>
                            <input className="field-input" value={selectedMenuCatalog?.label || selectedMenu.menuKey} readOnly />
                          </label>
                          <label className="field">
                            <span>分类</span>
                            <input className="field-input" value={selectedMenuCatalog?.category || ''} readOnly />
                          </label>
                          <label className="field field--wide">
                            <span>展示名</span>
                            <input
                              className="field-input"
                              value={selectedMenu.displayName}
                              onChange={(event) =>
                                updateSelectedMenu((entry) => ({ ...entry, displayName: event.target.value }))
                              }
                            />
                          </label>
                          <label className="field field--wide">
                            <span>分组</span>
                            <input
                              className="field-input"
                              value={selectedMenu.group}
                              onChange={(event) =>
                                updateSelectedMenu((entry) => ({ ...entry, group: event.target.value }))
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="fig-card fig-card--subtle">
                        <div className="empty-state">当前没有可编辑的菜单项。</div>
                      </div>
                    )}
                  </section>
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
                      <span>补齐旧版能力：预设 asset key 快速填充、品牌资源上传与 Welcome / Logo 高质量资源统一在这里维护</span>
                    </div>
                    <div className="fig-assets-grid" style={{ marginBottom: 16 }}>
                      {BRAND_ASSET_SLOTS.map((slot) => {
                        const current = resolveDetailAsset(detail, slot.assetKey);
                        const previewUrl = current
                          ? resolveAssetUrl({
                              publicUrl: stringValue(current.publicUrl),
                              appName: stringValue(current.appName || detail.brand.brandId),
                              brandId: detail.brand.brandId,
                              assetKey: stringValue(current.assetKey),
                            })
                          : '';
                        return (
                          <article key={slot.assetKey} className="fig-asset-card">
                            <div className="fig-asset-card__preview">
                              {previewUrl && isImageLike(stringValue(current?.contentType), previewUrl, stringValue(current?.objectKey)) ? (
                                <img className="fig-asset-card__image" src={previewUrl} alt={slot.assetKey} />
                              ) : (
                                <div className="asset-thumb asset-thumb--placeholder">No Asset</div>
                              )}
                            </div>
                            <div className="fig-asset-card__body">
                              <div className="fig-asset-card__title">{slot.label}</div>
                              <div className="fig-asset-card__meta">{slot.assetKey}</div>
                              <div className="fig-release-card__actions" style={{ marginTop: 12 }}>
                                <button
                                  className="ghost-button"
                                  type="button"
                                  onClick={() =>
                                    setAssetDraft((currentDraft) => ({
                                      ...currentDraft,
                                      assetKey: slot.assetKey,
                                      kind: slot.kind,
                                    }))
                                  }
                                >
                                  使用此槽位
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
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
                        <span>Metadata JSON</span>
                        <textarea className="code-input code-input--tall" rows={5} value={assetDraft.metadataText} onChange={(event) => setAssetDraft((current) => ({ ...current, metadataText: event.target.value }))} />
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
                        onClick={() => {
                          if (!assetDraft.file) return;
                          try {
                            const metadata = asObject(assetDraft.metadataText ? JSON.parse(assetDraft.metadataText) : {});
                            void onUploadAsset?.({ assetKey: assetDraft.assetKey, kind: assetDraft.kind, metadata, file: assetDraft.file });
                          } catch {
                            // ignore parse error here; parent page banner will surface later once validation is added upstream
                          }
                        }}
                      >
                        {savingAsset ? '上传中…' : '上传资源'}
                      </button>
                    </div>
                  </section>
                  {renderAssets(detail, savingAsset, (assetKey) => { void onDeleteAsset?.(assetKey); })}
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
                      <div className="fig-release-card__actions">
                        <button className="ghost-button" type="button" onClick={() => window.open(`${HOME_WEB_PREVIEW_BASE_URL}/?app_name=${encodeURIComponent(detail.brand.brandId)}`, '_blank', 'noopener,noreferrer')}>
                          打开预览
                        </button>
                      </div>
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
                      <span>补齐旧版能力：文案、资源回填、高清预览和 Welcome 资源替换都在这里维护</span>
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
                      {renderWelcomeAssetCard({
                        title: '欢迎头像预览',
                        assetKey: 'welcomeAvatar',
                        previewUrl: welcomeDraft.avatarUrl,
                        emptyLabel: '未设置欢迎头像',
                      })}
                      {renderWelcomeAssetCard({
                        title: '欢迎背景图预览',
                        assetKey: 'welcomeBackground',
                        previewUrl: welcomeDraft.backgroundImageUrl,
                        emptyLabel: '未设置欢迎背景图',
                      })}
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
                        <h3>资源回填与高清兜底</h3>
                        <span>优先使用 Welcome 专属 slot；如果没配，会回退到品牌高清资源。</span>
                      </div>
                      <div className="chip-grid" style={{ marginBottom: 16 }}>
                        {[
                          ['welcomeAvatar', welcomeAvatarAssetUrl],
                          ['assistantAvatar', assistantAvatarAssetUrl],
                          ['logoMaster', logoMasterAssetUrl],
                          ['welcomeBackground', welcomeBackgroundAssetUrl],
                          ['installerHero', installerHeroAssetUrl],
                        ]
                          .filter(([, url]) => Boolean(url))
                          .map(([assetKey, url]) => (
                            <button
                              key={assetKey}
                              className="chip chip--interactive"
                              type="button"
                              onClick={() =>
                                setWelcomeDraft((current) => ({
                                  ...current,
                                  avatarUrl:
                                    assetKey === 'welcomeAvatar' || assetKey === 'assistantAvatar' || assetKey === 'logoMaster'
                                      ? String(url)
                                      : current.avatarUrl,
                                  backgroundImageUrl:
                                    assetKey === 'welcomeBackground' || assetKey === 'installerHero'
                                      ? String(url)
                                      : current.backgroundImageUrl,
                                }))
                              }
                            >
                              {assetKey}
                            </button>
                          ))}
                      </div>
                      <div className="form-grid form-grid--two">
                        <label className="field field--wide">
                          <span>替换欢迎头像</span>
                          <input
                            className="field-input"
                            type="file"
                            accept="image/*"
                            onChange={async (event) => {
                              const file = event.target.files?.[0];
                              if (!file) return;
                              await onUploadAsset?.({
                                assetKey: 'welcomeAvatar',
                                kind: 'welcome-avatar',
                                file,
                              });
                              setWelcomeDraft((current) => ({
                                ...current,
                                avatarUrl: buildPortalAssetUrl(detail.brand.brandId, 'welcomeAvatar'),
                              }));
                              event.currentTarget.value = '';
                            }}
                          />
                        </label>
                        <div className="fig-release-card__actions">
                          <button className="ghost-button" type="button" onClick={() => setWelcomeDraft((current) => ({ ...current, avatarUrl: '' }))}>
                            清空头像回填
                          </button>
                        </div>
                        <label className="field field--wide">
                          <span>替换欢迎背景图</span>
                          <input
                            className="field-input"
                            type="file"
                            accept="image/*"
                            onChange={async (event) => {
                              const file = event.target.files?.[0];
                              if (!file) return;
                              await onUploadAsset?.({
                                assetKey: 'welcomeBackground',
                                kind: 'welcome-background',
                                file,
                              });
                              setWelcomeDraft((current) => ({
                                ...current,
                                backgroundImageUrl: buildPortalAssetUrl(detail.brand.brandId, 'welcomeBackground'),
                              }));
                              event.currentTarget.value = '';
                            }}
                          />
                        </label>
                        <div className="fig-release-card__actions">
                          <button className="ghost-button" type="button" onClick={() => setWelcomeDraft((current) => ({ ...current, backgroundImageUrl: '' }))}>
                            清空背景回填
                          </button>
                        </div>
                      </div>
                    </section>
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
                  <>
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
                    <section className="fig-card fig-card--subtle">
                      <div className="fig-card__head">
                        <h3>顶部快捷控件</h3>
                        <span>控制专家、技能、模式等输入控件的显隐、排序与文案</span>
                      </div>
                      <div className="fig-list">
                        {(availableComposerControls.length ? availableComposerControls : composerControlDraft.map((item) => ({ controlKey: item.controlKey, displayName: item.controlKey, controlType: 'static', options: [] }))).map((item, index, list) => {
                          const existing = composerControlDraft.find((entry) => entry.controlKey === item.controlKey) || {
                            controlKey: item.controlKey,
                            enabled: false,
                            displayName: item.displayName,
                            allowedOptionValues: [],
                          };
                          return (
                            <div key={item.controlKey} className="fig-list-item">
                              <div style={{ width: '100%' }}>
                                <div className="fig-list-item__title">{item.displayName}</div>
                                <div className="fig-list-item__meta">
                                  <span>{item.controlKey}</span>
                                  <span>{item.controlType}</span>
                                </div>
                                <div className="form-grid" style={{ marginTop: 12 }}>
                                  <label className="field" style={{ maxWidth: 160 }}>
                                    <span>启用</span>
                                    <input
                                      type="checkbox"
                                      checked={existing.enabled}
                                      onChange={(event) =>
                                        setComposerControlDraft((current) => {
                                          const has = current.some((entry) => entry.controlKey === item.controlKey);
                                          if (!has) {
                                            return [...current, { controlKey: item.controlKey, enabled: event.target.checked, displayName: item.displayName, allowedOptionValues: [] }];
                                          }
                                          return current.map((entry) => entry.controlKey === item.controlKey ? { ...entry, enabled: event.target.checked } : entry);
                                        })
                                      }
                                    />
                                  </label>
                                  <label className="field">
                                    <span>显示名称</span>
                                    <input className="field-input" value={existing.displayName} onChange={(event) => setComposerControlDraft((current) => current.map((entry) => entry.controlKey === item.controlKey ? { ...entry, displayName: event.target.value } : entry))} />
                                  </label>
                                  <label className="field field--wide">
                                    <span>允许选项</span>
                                    <input className="field-input" value={existing.allowedOptionValues.join(', ')} onChange={(event) => setComposerControlDraft((current) => current.map((entry) => entry.controlKey === item.controlKey ? { ...entry, allowedOptionValues: event.target.value.split(',').map((v) => v.trim()).filter(Boolean) } : entry))} placeholder={item.options.map((option) => option.optionValue).join(', ')} />
                                  </label>
                                </div>
                                <div className="fig-release-card__actions" style={{ marginTop: 12 }}>
                                  <button className="ghost-button" type="button" disabled={index === 0} onClick={() => setComposerControlDraft((current) => {
                                    const next = [...current];
                                    const from = next.findIndex((entry) => entry.controlKey === item.controlKey);
                                    if (from <= 0) return current;
                                    const [moved] = next.splice(from, 1);
                                    next.splice(from - 1, 0, moved);
                                    return next;
                                  })}>上移</button>
                                  <button className="ghost-button" type="button" disabled={index === list.length - 1} onClick={() => setComposerControlDraft((current) => {
                                    const next = [...current];
                                    const from = next.findIndex((entry) => entry.controlKey === item.controlKey);
                                    if (from < 0 || from >= next.length - 1) return current;
                                    const [moved] = next.splice(from, 1);
                                    next.splice(from + 1, 0, moved);
                                    return next;
                                  })}>下移</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="fig-release-card__actions">
                        <button className="solid-button" type="button" disabled={savingComposerControls} onClick={() => onSaveComposerControls?.(composerControlDraft)}>
                          {savingComposerControls ? '保存中…' : '保存快捷控件'}
                        </button>
                      </div>
                    </section>
                    <section className="fig-card fig-card--subtle">
                      <div className="fig-card__head">
                        <h3>底部快捷方式</h3>
                        <span>控制快捷 chip 的显隐、排序、名称和模板内容</span>
                      </div>
                      <div className="fig-list">
                        {(availableComposerShortcuts.length ? availableComposerShortcuts : composerShortcutDraft.map((item) => ({ shortcutKey: item.shortcutKey, displayName: item.shortcutKey, description: '', template: '', tone: '' }))).map((item, index, list) => {
                          const existing = composerShortcutDraft.find((entry) => entry.shortcutKey === item.shortcutKey) || {
                            shortcutKey: item.shortcutKey,
                            enabled: false,
                            displayName: item.displayName,
                            description: item.description,
                            template: item.template,
                          };
                          return (
                            <div key={item.shortcutKey} className="fig-list-item">
                              <div style={{ width: '100%' }}>
                                <div className="fig-list-item__title">{item.displayName}</div>
                                <div className="fig-list-item__meta">
                                  <span>{item.shortcutKey}</span>
                                  {item.tone ? <span>{item.tone}</span> : null}
                                </div>
                                <div className="form-grid" style={{ marginTop: 12 }}>
                                  <label className="field" style={{ maxWidth: 160 }}>
                                    <span>启用</span>
                                    <input
                                      type="checkbox"
                                      checked={existing.enabled}
                                      onChange={(event) =>
                                        setComposerShortcutDraft((current) => {
                                          const has = current.some((entry) => entry.shortcutKey === item.shortcutKey);
                                          if (!has) {
                                            return [...current, { shortcutKey: item.shortcutKey, enabled: event.target.checked, displayName: item.displayName, description: item.description, template: item.template }];
                                          }
                                          return current.map((entry) => entry.shortcutKey === item.shortcutKey ? { ...entry, enabled: event.target.checked } : entry);
                                        })
                                      }
                                    />
                                  </label>
                                  <label className="field">
                                    <span>显示名称</span>
                                    <input className="field-input" value={existing.displayName} onChange={(event) => setComposerShortcutDraft((current) => current.map((entry) => entry.shortcutKey === item.shortcutKey ? { ...entry, displayName: event.target.value } : entry))} />
                                  </label>
                                  <label className="field">
                                    <span>说明</span>
                                    <input className="field-input" value={existing.description} onChange={(event) => setComposerShortcutDraft((current) => current.map((entry) => entry.shortcutKey === item.shortcutKey ? { ...entry, description: event.target.value } : entry))} />
                                  </label>
                                  <label className="field field--wide">
                                    <span>快捷模板</span>
                                    <textarea className="field-textarea" rows={3} value={existing.template} onChange={(event) => setComposerShortcutDraft((current) => current.map((entry) => entry.shortcutKey === item.shortcutKey ? { ...entry, template: event.target.value } : entry))} />
                                  </label>
                                </div>
                                <div className="fig-release-card__actions" style={{ marginTop: 12 }}>
                                  <button className="ghost-button" type="button" disabled={index === 0} onClick={() => setComposerShortcutDraft((current) => {
                                    const next = [...current];
                                    const from = next.findIndex((entry) => entry.shortcutKey === item.shortcutKey);
                                    if (from <= 0) return current;
                                    const [moved] = next.splice(from, 1);
                                    next.splice(from - 1, 0, moved);
                                    return next;
                                  })}>上移</button>
                                  <button className="ghost-button" type="button" disabled={index === list.length - 1} onClick={() => setComposerShortcutDraft((current) => {
                                    const next = [...current];
                                    const from = next.findIndex((entry) => entry.shortcutKey === item.shortcutKey);
                                    if (from < 0 || from >= next.length - 1) return current;
                                    const [moved] = next.splice(from, 1);
                                    next.splice(from + 1, 0, moved);
                                    return next;
                                  })}>下移</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="fig-release-card__actions">
                        <button className="solid-button" type="button" disabled={savingComposerShortcuts} onClick={() => onSaveComposerShortcuts?.(composerShortcutDraft)}>
                          {savingComposerShortcuts ? '保存中…' : '保存快捷方式'}
                        </button>
                      </div>
                    </section>
                  </>
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
