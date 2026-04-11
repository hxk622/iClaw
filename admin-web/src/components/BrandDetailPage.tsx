import { actionLabel, formatDateTime, formatRelative, statusLabel } from '../lib/adminFormat';
import type { BrandDetailData } from '../lib/adminTypes';
import { BrandDetailPanel } from './BrandDetailPanel';

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

export function BrandDetailPage({
  detail,
  loading,
  activeTab,
  setActiveTab,
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
  savingReleaseAction = false,
  onPublish,
  onRestoreVersion,
  onBack,
  onOpenAudit,
}: {
  detail: BrandDetailData | null;
  loading: boolean;
  activeTab: BrandDetailTabId;
  setActiveTab: (tab: BrandDetailTabId) => void;
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
    metadataText: string;
    file: File;
  }) => Promise<void> | void;
  onDeleteAsset?: (assetKey: string) => Promise<void> | void;
  savingReleaseAction?: boolean;
  onPublish?: () => Promise<void> | void;
  onRestoreVersion?: (version: string) => Promise<void> | void;
  onBack: () => void;
  onOpenAudit: () => void;
}) {
  const tabs = [
    { id: 'desktop', label: '桌面端' },
    { id: 'home-web', label: 'Home官网' },
    { id: 'welcome', label: 'Welcome页' },
    { id: 'auth', label: '登录与协议' },
    { id: 'header', label: 'Header栏' },
    { id: 'sidebar', label: '侧边栏' },
    { id: 'input', label: '输入框' },
    { id: 'models', label: '模型' },
    { id: 'skills', label: '技能' },
    { id: 'mcps', label: 'MCP' },
    { id: 'recharge', label: '充值套餐' },
    { id: 'menus', label: '左菜单栏' },
    { id: 'assets', label: '品牌资源' },
    { id: 'theme', label: '主题样式' },
  ] as const;

  return (
    <div className="fig-brand-detail">
      <div className="fig-brand-detail__header">
        <div className="fig-brand-detail__header-inner">
          <div className="fig-brand-detail__header-main">
            <button className="fig-icon-button" type="button" onClick={onBack} aria-label="返回品牌列表">
              ←
            </button>
            <div className="fig-brand-detail__title-wrap">
              <div className="fig-brand-detail__title-row">
                <h1>{detail?.brand.displayName || '品牌详情'}</h1>
                {detail?.brand ? (
                  <span className={`status-chip ${detail.brand.status === 'disabled' ? 'status-chip--muted' : 'status-chip--published'}`}>
                    {statusLabel(detail.brand.status)}
                  </span>
                ) : null}
              </div>
              {detail?.brand ? (
                <p className="fig-brand-detail__subtitle">
                  {detail.brand.productName} • 租户:
                  <code>{detail.brand.tenantKey}</code>
                </p>
              ) : null}
            </div>
          </div>
          <div className="fig-brand-detail__actions">
            <button className="ghost-button fig-button" type="button" disabled={savingReleaseAction} onClick={() => void onPublish?.()}>
              {savingReleaseAction ? '处理中…' : '发布快照'}
            </button>
          </div>
        </div>
        {detail?.brand ? (
          <div className="fig-brand-detail__meta">
            <div>App Name: <code>{detail.brand.brandId}</code></div>
            <div>•</div>
            <div>默认语言: {detail.brand.defaultLocale}</div>
            <div>•</div>
            <div>当前版本: <code>{`v${detail.brand.publishedVersion || 0}`}</code></div>
            <div>•</div>
            <div>最后更新: {formatDateTime(detail.brand.updatedAt)}</div>
          </div>
        ) : null}
      </div>
      <div className="fig-brand-nav">
        <div className="fig-brand-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`fig-brand-tab${activeTab === tab.id ? ' is-active' : ''}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="fig-page__body fig-page__body--brand-detail">
        {loading ? (
          <section className="loading-panel">
            <div className="loading-spinner" />
            <p>品牌详情加载中…</p>
          </section>
        ) : !detail ? (
          <div className="empty-state empty-state--panel">当前没有可查看的品牌。</div>
        ) : (
          <>
            <BrandDetailPanel
              detail={detail}
              activeTab={activeTab}
              onDirtyChange={onDirtyChange}
              savingBaseInfo={savingBaseInfo}
              onSaveBaseInfo={onSaveBaseInfo}
              savingDesktopShell={savingDesktopShell}
              onSaveDesktopShell={onSaveDesktopShell}
              savingAuthExperience={savingAuthExperience}
              onSaveAuthExperience={onSaveAuthExperience}
              savingHeader={savingHeader}
              onSaveHeader={onSaveHeader}
              savingHomeWeb={savingHomeWeb}
              onSaveHomeWeb={onSaveHomeWeb}
              savingInput={savingInput}
              onSaveInput={onSaveInput}
              availableComposerControls={availableComposerControls}
              savingComposerControls={savingComposerControls}
              onSaveComposerControls={onSaveComposerControls}
              availableComposerShortcuts={availableComposerShortcuts}
              savingComposerShortcuts={savingComposerShortcuts}
              onSaveComposerShortcuts={onSaveComposerShortcuts}
              savingSidebar={savingSidebar}
              onSaveSidebar={onSaveSidebar}
              savingWelcome={savingWelcome}
              onSaveWelcome={onSaveWelcome}
              savingTheme={savingTheme}
              onSaveTheme={onSaveTheme}
              availableSkills={availableSkills}
              inheritedPlatformSkills={inheritedPlatformSkills}
              savingSkills={savingSkills}
              onSaveSkills={onSaveSkills}
              availableModels={availableModels}
              savingModels={savingModels}
              onSaveModels={onSaveModels}
              availableMcps={availableMcps}
              inheritedPlatformMcps={inheritedPlatformMcps}
              savingMcps={savingMcps}
              onSaveMcps={onSaveMcps}
              availableRechargePackages={availableRechargePackages}
              savingRechargePackages={savingRechargePackages}
              onSaveRechargePackages={onSaveRechargePackages}
              availableMenus={availableMenus}
              savingMenus={savingMenus}
              onSaveMenus={onSaveMenus}
              savingAsset={savingAsset}
              onUploadAsset={onUploadAsset}
              onDeleteAsset={onDeleteAsset}
            />
            <section className="fig-support-grid">
              <article className="fig-card">
                <div className="fig-card__head">
                  <h3>版本轨迹</h3>
                  <span>portal app 的发布快照</span>
                </div>
                <div className="fig-list">
                  {detail.versions.length ? detail.versions.slice(0, 8).map((item, index) => (
                    <div key={String(item.id || index)} className="fig-list-item fig-list-item--spread">
                      <div>
                        <div className="fig-list-item__title">{`v${String(item.version || '')}`}</div>
                        <div className="fig-list-item__meta">
                          <span>{formatDateTime(String(item.publishedAt || ''))}</span>
                          <span>•</span>
                          <span>{String(item.createdByName || item.createdByUsername || 'system')}</span>
                        </div>
                      </div>
                      <button className="text-button" type="button" disabled={savingReleaseAction} onClick={() => void onRestoreVersion?.(String(item.version || ''))}>
                        恢复
                      </button>
                    </div>
                  )) : <div className="empty-state">还没有发布快照。</div>}
                </div>
              </article>
              <article className="fig-card">
                <div className="fig-card__head">
                  <h3>最近审计</h3>
                  <span>{`${detail.audit.length} 条记录`}</span>
                </div>
                <div className="fig-list">
                  {detail.audit.length ? detail.audit.slice(0, 6).map((item, index) => (
                    <div key={String(item.id || index)} className="fig-list-item">
                      <div>
                        <div className="fig-list-item__title">{actionLabel(String(item.action || ''))}</div>
                        <div className="fig-list-item__meta">
                          <span>{String(item.actorName || item.actorUsername || 'system')}</span>
                          <span>•</span>
                          <span>{formatRelative(String(item.createdAt || ''))}</span>
                        </div>
                      </div>
                    </div>
                  )) : <div className="empty-state">暂无审计记录。</div>}
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
