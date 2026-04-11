import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  API_BASE_URL,
  apiFetch,
  asObject,
  deleteAgentCatalogEntry,
  deleteBrandAsset,
  publishBrandSnapshot,
  createBrand,
  deleteCloudMcpCatalogEntry,
  deletePlatformMcpBinding,
  deletePlatformModelCatalogEntry,
  deletePlatformSkillBinding,
  deleteRechargePackageCatalogEntry,
  fetchCloudSkillsCatalogPage,
  fetchPaymentOrderDetail,
  loadUserActionAuditData,
  importRuntimeBootstrapSource,
  loadBrandDetailData,
  loadOverviewData,
  loadTokens,
  markPaymentOrderPaid,
  persistTokens,
  publishDesktopRelease,
  refundPaymentOrder,
  restoreRecommendedRechargePackages,
  restorePlatformMemoryEmbedding,
  restoreBrandVersion,
  restorePlatformModelProvider,
  runSkillSync,
  saveAgentCatalogEntry,
  saveBrandAuthExperience,
  saveBrandBaseInfo,
  saveBrandDesktopShell,
  saveBrandHeader,
  saveBrandHomeWebSurface,
  saveBrandInputSurface,
  saveBrandMcps,
  saveBrandComposerControls,
  saveBrandComposerShortcuts,
  saveBrandModels,
  saveBrandMenus,
  saveBrandRechargePackages,
  saveBrandSidebar,
  saveBrandSkills,
  saveBrandTheme,
  saveBrandWelcomeSurface,
  saveCloudMcpCatalogEntry,
  saveMemoryEmbeddingProfile,
  saveModelProviderProfile,
  savePaymentGatewayConfig,
  savePaymentProviderConfig,
  savePlatformMcpBinding,
  savePlatformModelCatalogEntry,
  savePlatformSkillBinding,
  saveRechargePackageCatalogEntry,
  saveRuntimeBinding,
  saveRuntimeRelease,
  saveSkillSyncSource,
  setCloudSkillEnabled,
  stringValue,
  testCloudMcpCatalogEntry,
  testMemoryEmbeddingProfile,
  uploadBrandAsset,
  uploadBrandAssetByBrandId,
} from './lib/adminApi';
import { AgentCenterPage } from './components/AgentCenterPage';
import { AdminShell } from './components/AdminShell';
import { BrandDetailPage } from './components/BrandDetailPage';
import { BrandsPage } from './components/BrandsPage';
import { CloudMcpPage } from './components/CloudMcpPage';
import { ModelCenterPage } from './components/ModelCenterPage';
import { PaymentConfigPage } from './components/PaymentConfigPage';
import { RechargePackagesPage } from './components/RechargePackagesPage';
import { UserActionAuditPage } from './components/UserActionAuditPage';
import {
  actionLabel,
  formatCredits,
  formatDateTime,
  formatFen,
  formatRelative,
  getUserAvatarUrl,
  getUserDisplayName,
  getUserInitials,
  isImageLike,
  paymentProviderLabel,
  paymentStatusLabel,
  resolveAssetUrl,
  statusLabel,
} from './lib/adminFormat';
import { applyThemeMode, persistThemeMode, readStoredThemeMode } from './lib/theme';
import type { AdminRoute, BrandDetailData, LoginState, NavItem, OverviewData, ThemeMode } from './lib/adminTypes';
import type { UserActionAuditRecord, UserActionDiagnosticUploadRecord } from './lib/adminTypes';

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: '总览' },
  { id: 'brands', label: '品牌管理' },
  { id: 'agent-center', label: 'Agent中心' },
  { id: 'skill-center', label: '平台级 Skill' },
  { id: 'mcp-center', label: '平台级 MCP' },
  { id: 'model-center', label: '模型中心' },
  { id: 'runtime-management', label: 'Runtime包管理' },
  { id: 'cloud-skills', label: '云技能' },
  { id: 'cloud-mcps', label: '云MCP' },
  { id: 'assets', label: '资源管理' },
  { id: 'releases', label: '版本发布' },
  {
    id: 'payments',
    label: '支付中心',
    children: [
      { id: 'payments-config', label: '账户配置' },
      { id: 'payments-packages', label: '充值套餐' },
      { id: 'payments-orders', label: '订单中心' },
    ],
  },
  { id: 'audit-log', label: '审计日志' },
  { id: 'user-action-audit', label: '用户Action审计' },
];

const BRAND_DETAIL_TABS = [
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

function isAdminRoute(value: string): value is AdminRoute {
  return NAV_ITEMS.some((item) =>
    item.id === value || item.children?.some((child) => child.id === value),
  );
}

function isBrandDetailTab(value: string): value is (typeof BRAND_DETAIL_TABS)[number]['id'] {
  return BRAND_DETAIL_TABS.some((item) => item.id === value);
}

function readInitialAdminLocation(): {
  route: AdminRoute;
  brandId: string;
  brandDetailTab: (typeof BRAND_DETAIL_TABS)[number]['id'];
} {
  if (typeof window === 'undefined') {
    return {
      route: 'overview',
      brandId: '',
      brandDetailTab: 'desktop',
    };
  }
  const params = new URLSearchParams(window.location.search);
  const routeParam = String(params.get('route') || '').trim();
  const brandParam = String(params.get('brand') || '').trim();
  const tabParam = String(params.get('tab') || '').trim();
  return {
    route: isAdminRoute(routeParam) ? routeParam : 'overview',
    brandId: brandParam,
    brandDetailTab: isBrandDetailTab(tabParam) ? tabParam : 'desktop',
  };
}

function writeAdminLocation(input: {
  route: AdminRoute;
  brandId: string;
  brandDetailTab: (typeof BRAND_DETAIL_TABS)[number]['id'];
}) {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('route', input.route);
  if (input.route === 'brand-detail' && input.brandId.trim()) {
    url.searchParams.set('brand', input.brandId.trim());
    url.searchParams.set('tab', input.brandDetailTab);
  } else {
    url.searchParams.delete('brand');
    url.searchParams.delete('tab');
  }
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, '', nextUrl);
  }
}

function AdminLogo() {
  return (
    <span className="brand-mark brand-mark--login" aria-hidden="true">
      <svg className="brand-mark__svg" viewBox="0 0 72 72" fill="none">
        <defs>
          <linearGradient id="adminBrandGradient" x1="12" y1="10" x2="60" y2="62" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7DB0AF" />
            <stop offset="0.54" stopColor="#B89573" />
            <stop offset="1" stopColor="#314036" />
          </linearGradient>
        </defs>
        <rect x="6" y="6" width="60" height="60" rx="18" fill="#221f1b" />
        <rect x="13" y="13" width="46" height="46" rx="14" fill="url(#adminBrandGradient)" opacity="0.2" />
        <path d="M20 46.5V24.5L36 16l16 8.5v22L36 55l-16-8.5Z" fill="url(#adminBrandGradient)" />
        <path d="M36 16v39" stroke="#F9F7F3" strokeOpacity="0.88" strokeWidth="2.2" strokeLinecap="round" />
        <path
          d="M20 24.5 36 33l16-8.5"
          stroke="#F9F7F3"
          strokeOpacity="0.82"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 46.5 36 38l16 8.5"
          stroke="#F9F7F3"
          strokeOpacity="0.64"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function ThemeSwitcher({
  mode,
  onChange,
}: {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}) {
  const options: Array<{ value: ThemeMode; label: string }> = [
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
    { value: 'system', label: '系统' },
  ];

  return (
    <div className="theme-switcher theme-switcher--login" role="group" aria-label="主题模式">
      {options.map((item) => (
        <button
          key={item.value}
          className={`theme-switcher__button${mode === item.value ? ' is-active' : ''}`}
          type="button"
          onClick={() => onChange(item.value)}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function LoadingScreen({ label = '正在启动控制台' }: { label?: string }) {
  return (
    <div className="login-shell">
      <section className="login-stage">
        <div className="login-copy-group">
          <div className="brand-lockup brand-lockup--login">
            <AdminLogo />
            <div className="brand-lockup__copy">
              <p className="eyebrow">iClaw management console</p>
              <div className="brand-lockup__title">iClaw管理控制台</div>
            </div>
          </div>
          <h1>把品牌、版本、技能与发布放进同一个运营平面</h1>
          <p className="login-copy">{label}</p>
        </div>
      </section>
    </div>
  );
}

function LoginScreen({
  busy,
  error,
  themeMode,
  onThemeModeChange,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="login-shell">
      <section className="login-stage">
        <div className="login-copy-group">
          <div className="brand-lockup brand-lockup--login">
            <AdminLogo />
            <div className="brand-lockup__copy">
              <p className="eyebrow">iClaw management console</p>
              <div className="brand-lockup__title">iClaw管理控制台</div>
            </div>
          </div>
          <h1>把品牌、版本、技能与发布放进同一个运营平面</h1>
          <p className="login-copy">
            当前后台直连真实 control-plane 接口，按 iClaw管理控制台设计稿重构。默认账号：
            <strong>admin / admin</strong>。
          </p>
          <ThemeSwitcher mode={themeMode} onChange={onThemeModeChange} />
        </div>
        <form className="login-card" id="react-login-form" data-testid="admin-login-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Username</span>
            <input className="field-input" name="identifier" autoComplete="username" defaultValue="admin" />
          </label>
          <label className="field">
            <span>Password</span>
            <input className="field-input" name="password" type="password" autoComplete="current-password" defaultValue="admin" />
          </label>
          {error ? <div className="banner banner--error">{error}</div> : null}
          <button className="solid-button solid-button--full" type="submit" disabled={busy}>
            {busy ? '进入中…' : '进入控制台'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function App() {
  const initialLocation = useMemo(() => readInitialAdminLocation(), []);
  const [view, setView] = useState<LoginState>('booting');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredThemeMode());
  const [route, setRoute] = useState<AdminRoute>(initialLocation.route);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [savingCreateBrand, setSavingCreateBrand] = useState(false);
  const [savingAgentCatalog, setSavingAgentCatalog] = useState(false);
  const [savingPaymentConfig, setSavingPaymentConfig] = useState(false);
  const [brandQuery, setBrandQuery] = useState('');
  const [brandStatus, setBrandStatus] = useState('all');
  const [releaseBrand, setReleaseBrand] = useState('all');
  const [selectedReleaseId, setSelectedReleaseId] = useState('');
  const [selectedDesktopReleaseChannel, setSelectedDesktopReleaseChannel] = useState<'prod' | 'dev'>('prod');
  const [savingDesktopReleasePublish, setSavingDesktopReleasePublish] = useState(false);
  const [desktopReleaseFiles, setDesktopReleaseFiles] = useState<Record<string, File | null>>({});
  const [assetQuery, setAssetQuery] = useState('');
  const [assetBrand, setAssetBrand] = useState('all');
  const [assetKind, setAssetKind] = useState('all');
  const [assetUploadDraft, setAssetUploadDraft] = useState({
    brandId: '',
    assetKey: '',
    kind: '',
    metadataText: '{}',
    file: null as File | null,
  });
  const [paymentQuery, setPaymentQuery] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [paymentProvider, setPaymentProvider] = useState('all');
  const [paymentApp, setPaymentApp] = useState('all');
  const [selectedPaymentOrderId, setSelectedPaymentOrderId] = useState('');
  const [selectedPaymentOrderDetail, setSelectedPaymentOrderDetail] = useState<Record<string, unknown> | null>(null);
  const [savingPaymentOrderAction, setSavingPaymentOrderAction] = useState(false);
  const [selectedRechargePackageId, setSelectedRechargePackageId] = useState('');
  const [savingRechargeCatalog, setSavingRechargeCatalog] = useState(false);
  const [cloudSkillQuery, setCloudSkillQuery] = useState('');
  const [selectedCloudSkillSlug, setSelectedCloudSkillSlug] = useState('');
  const [cloudSkillPage, setCloudSkillPage] = useState<{ items: OverviewData['cloudSkills']; meta: OverviewData['cloudSkillMeta'] } | null>(null);
  const [selectedSkillSyncSourceId, setSelectedSkillSyncSourceId] = useState('');
  const [savingSkillSyncSource, setSavingSkillSyncSource] = useState(false);
  const [runningSkillSync, setRunningSkillSync] = useState(false);
  const [savingCloudSkill, setSavingCloudSkill] = useState(false);
  const [selectedCloudMcpKey, setSelectedCloudMcpKey] = useState('');
  const [savingCloudMcp, setSavingCloudMcp] = useState(false);
  const [cloudMcpTestResult, setCloudMcpTestResult] = useState<{ ok?: boolean; message?: string } | null>(null);
  const [capabilityQuery, setCapabilityQuery] = useState('');
  const [selectedPlatformSkillSlug, setSelectedPlatformSkillSlug] = useState('');
  const [newPlatformSkillSlug, setNewPlatformSkillSlug] = useState('');
  const [savingPlatformSkill, setSavingPlatformSkill] = useState(false);
  const [selectedPlatformMcpKey, setSelectedPlatformMcpKey] = useState('');
  const [newPlatformMcpKey, setNewPlatformMcpKey] = useState('');
  const [savingPlatformMcp, setSavingPlatformMcp] = useState(false);
  const [platformSkillMetadataText, setPlatformSkillMetadataText] = useState('{}');
  const [platformMcpMetadataText, setPlatformMcpMetadataText] = useState('{}');
  const [selectedPlatformModelRef, setSelectedPlatformModelRef] = useState('');
  const [savingPlatformModel, setSavingPlatformModel] = useState(false);
  const [selectedModelProviderTab, setSelectedModelProviderTab] = useState('platform');
  const [selectedModelCenterSection, setSelectedModelCenterSection] = useState<'chat-provider' | 'memory-embedding'>('chat-provider');
  const [savingModelProviderProfile, setSavingModelProviderProfile] = useState(false);
  const [savingMemoryEmbeddingProfile, setSavingMemoryEmbeddingProfile] = useState(false);
  const [memoryEmbeddingTestResult, setMemoryEmbeddingTestResult] = useState<{ ok?: boolean; message?: string; dimensions?: number | null } | null>(null);
  const [runtimeSection, setRuntimeSection] = useState<'release' | 'binding' | 'history'>('release');
  const [selectedRuntimeImportChannel, setSelectedRuntimeImportChannel] = useState<'prod' | 'dev'>('prod');
  const [selectedRuntimeImportBindScopeType, setSelectedRuntimeImportBindScopeType] = useState<'none' | 'platform' | 'app'>('none');
  const [selectedRuntimeImportBindScopeKey, setSelectedRuntimeImportBindScopeKey] = useState('');
  const [selectedRuntimeReleaseId, setSelectedRuntimeReleaseId] = useState('');
  const [selectedRuntimeBindingId, setSelectedRuntimeBindingId] = useState('');
  const [savingRuntimeRelease, setSavingRuntimeRelease] = useState(false);
  const [savingRuntimeBinding, setSavingRuntimeBinding] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState(initialLocation.brandId);
  const [brandDetailTab, setBrandDetailTab] = useState<(typeof BRAND_DETAIL_TABS)[number]['id']>(initialLocation.brandDetailTab);
  const [brandDetailDirty, setBrandDetailDirty] = useState(false);
  const [brandDetailLoading, setBrandDetailLoading] = useState(false);
  const [savingBrandBaseInfo, setSavingBrandBaseInfo] = useState(false);
  const [savingBrandReleaseAction, setSavingBrandReleaseAction] = useState(false);
  const [savingBrandDesktopShell, setSavingBrandDesktopShell] = useState(false);
  const [savingBrandAuthExperience, setSavingBrandAuthExperience] = useState(false);
  const [savingBrandHeader, setSavingBrandHeader] = useState(false);
  const [savingBrandInput, setSavingBrandInput] = useState(false);
  const [savingBrandComposerControls, setSavingBrandComposerControls] = useState(false);
  const [savingBrandComposerShortcuts, setSavingBrandComposerShortcuts] = useState(false);
  const [savingBrandHomeWeb, setSavingBrandHomeWeb] = useState(false);
  const [savingBrandSidebar, setSavingBrandSidebar] = useState(false);
  const [savingBrandWelcome, setSavingBrandWelcome] = useState(false);
  const [savingBrandTheme, setSavingBrandTheme] = useState(false);
  const [savingBrandSkills, setSavingBrandSkills] = useState(false);
  const [savingBrandModels, setSavingBrandModels] = useState(false);
  const [savingBrandMcps, setSavingBrandMcps] = useState(false);
  const [savingBrandRechargePackages, setSavingBrandRechargePackages] = useState(false);
  const [savingBrandMenus, setSavingBrandMenus] = useState(false);
  const [savingBrandAsset, setSavingBrandAsset] = useState(false);
  const [brandDetailData, setBrandDetailData] = useState<BrandDetailData | null>(null);
  const [auditQuery, setAuditQuery] = useState('');
  const [auditBrand, setAuditBrand] = useState('all');
  const [auditAction, setAuditAction] = useState('all');
  const [selectedAuditId, setSelectedAuditId] = useState('');
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [userActionAuditLoading, setUserActionAuditLoading] = useState(false);
  const [userActionAuditItems, setUserActionAuditItems] = useState<UserActionAuditRecord[]>([]);
  const [userActionDiagnosticUploads, setUserActionDiagnosticUploads] = useState<UserActionDiagnosticUploadRecord[]>([]);
  const hasTokens = useMemo(() => {
    const tokens = loadTokens();
    return Boolean(tokens?.access_token || tokens?.refresh_token);
  }, [view, busy]);

  useEffect(() => {
    applyThemeMode(themeMode);
    persistThemeMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    writeAdminLocation({
      route,
      brandId: selectedBrandId,
      brandDetailTab,
    });
  }, [brandDetailTab, route, selectedBrandId]);

  useEffect(() => {
    const listener = () => {
      if (readStoredThemeMode() === 'system') {
        applyThemeMode('system');
      }
    };
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', listener);
    return () => {
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', listener);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      setNotice('');
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => {
      setError('');
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!hasTokens) {
      setView('login');
      setOverviewData(null);
      return;
    }
    let cancelled = false;
    setView('console');
    setOverviewLoading(true);
    void loadOverviewData()
      .then((data) => {
        if (cancelled) return;
        setOverviewData(data);
      })
      .catch((mountError) => {
        console.error('[admin-web] failed to bootstrap admin console', mountError);
        if (!cancelled) {
          setError(mountError instanceof Error ? mountError.message : '控制台启动失败');
          persistTokens(null);
          setView('login');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasTokens]);

  useEffect(() => {
    if (route !== 'brand-detail' || !selectedBrandId) {
      return;
    }
    let cancelled = false;
    setBrandDetailLoading(true);
    void loadBrandDetailData(selectedBrandId)
      .then((data) => {
        if (!cancelled) {
          setBrandDetailData(data);
          setBrandDetailDirty(false);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '品牌详情加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBrandDetailLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [route, selectedBrandId]);

  useEffect(() => {
    if (assetUploadDraft.brandId || !(overviewData?.brands || []).length) {
      return;
    }
    setAssetUploadDraft((current) => ({
      ...current,
      brandId: overviewData?.brands?.[0]?.brandId || '',
    }));
  }, [assetUploadDraft.brandId, overviewData?.brands]);

  useEffect(() => {
    if (route !== 'user-action-audit') {
      return;
    }
    let cancelled = false;
    setUserActionAuditLoading(true);
    setError('');
    void loadUserActionAuditData()
      .then((data) => {
        if (cancelled) return;
        setUserActionAuditItems(data.items);
        setUserActionDiagnosticUploads(data.uploads);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : '用户Action审计加载失败');
      })
      .finally(() => {
        if (!cancelled) {
          setUserActionAuditLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [route]);

  const handleRefreshUserActionAudit = async () => {
    setUserActionAuditLoading(true);
    setError('');
    try {
      const data = await loadUserActionAuditData();
      setUserActionAuditItems(data.items);
      setUserActionDiagnosticUploads(data.uploads);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '用户Action审计加载失败');
    } finally {
      setUserActionAuditLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const identifier = String(formData.get('identifier') || '').trim();
    const password = String(formData.get('password') || '').trim();

    setBusy(true);
    setError('');
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
        { skipRefresh: true },
      );
      persistTokens(data?.tokens || null);
      setError('');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '登录失败');
      persistTokens(null);
      setView('login');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    persistTokens(null);
    setOverviewData(null);
    setRoute('overview');
    setView('login');
  };

  const openBrandDetail = (brandId: string) => {
    setSelectedBrandId(brandId);
    setBrandDetailTab('desktop');
    setBrandDetailDirty(false);
    setRoute('brand-detail');
  };

  const handleCreateBrand = async (input: {
    brandId: string;
    displayName: string;
    productName: string;
    tenantKey: string;
  }) => {
    setSavingCreateBrand(true);
    setError('');
    try {
      const brandId = await createBrand({
        ...input,
        menuCatalog: overviewData?.menuCatalog || [],
        composerControlCatalog: overviewData?.composerControlCatalog || [],
        composerShortcutCatalog: overviewData?.composerShortcutCatalog || [],
      });
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      openBrandDetail(brandId);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '创建品牌失败');
    } finally {
      setSavingCreateBrand(false);
    }
  };

  const handleSaveAgentCatalog = async (input: {
    slug: string;
    name: string;
    description: string;
    category: string;
    publisher: string;
    featured: boolean;
    official: boolean;
    surface: string;
    sourceRepo: string;
    primarySkillSlug: string;
    avatarUrl: string;
    active: boolean;
    sortOrder: number;
    tags: string[];
    capabilities: string[];
    useCases: string[];
    metadata: Record<string, unknown>;
  }) => {
    setSavingAgentCatalog(true);
    setError('');
    try {
      await saveAgentCatalogEntry(input);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Agent 保存失败');
    } finally {
      setSavingAgentCatalog(false);
    }
  };

  const handleDeleteAgentCatalog = async (slug: string) => {
    setSavingAgentCatalog(true);
    setError('');
    try {
      await deleteAgentCatalogEntry(slug);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Agent 删除失败');
    } finally {
      setSavingAgentCatalog(false);
    }
  };

  const handleSavePaymentGateway = async (input: {
    provider: string;
    scopeType: 'platform' | 'app';
    scopeKey: string;
    mode: 'inherit_platform' | 'use_app_config';
    configValues: Record<string, string>;
    secretValues: Record<string, string>;
  }) => {
    setSavingPaymentConfig(true);
    setError('');
    try {
      await savePaymentGatewayConfig(input);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '支付网关保存失败');
    } finally {
      setSavingPaymentConfig(false);
    }
  };

  const handleSavePaymentProvider = async (input: {
    profileId?: string;
    provider: string;
    scopeType: 'platform' | 'app';
    scopeKey: string;
    mode: 'inherit_platform' | 'use_app_profile';
    displayName: string;
    enabled: boolean;
    configValues: Record<string, string>;
    secretValues: Record<string, string>;
    usePaymentMethodsOverride?: boolean;
    paymentMethodItems?: Array<{
      provider: string;
      label: string;
      enabled: boolean;
      default: boolean;
      sortOrder: number;
    }>;
  }) => {
    setSavingPaymentConfig(true);
    setError('');
    try {
      await savePaymentProviderConfig(input);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '支付配置保存失败');
    } finally {
      setSavingPaymentConfig(false);
    }
  };

  const handleSaveBrandTheme = async (input: {
    defaultMode: 'light' | 'dark' | 'system';
    lightPrimary: string;
    lightPrimaryHover: string;
    lightOnPrimary: string;
    darkPrimary: string;
    darkPrimaryHover: string;
    darkOnPrimary: string;
  }) => {
    if (!brandDetailData) return;
    setSavingBrandTheme(true);
    setError('');
    try {
      await saveBrandTheme(brandDetailData, input);
      const refreshed = await loadBrandDetailData(brandDetailData.brand.brandId);
      setBrandDetailData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '主题保存失败');
    } finally {
      setSavingBrandTheme(false);
    }
  };

  const handleSaveBrandBaseInfo = async (input: {
    displayName: string;
    productName: string;
    tenantKey: string;
    defaultLocale: string;
    status: string;
  }) => {
    if (!brandDetailData) return;
    setSavingBrandBaseInfo(true);
    setError('');
    try {
      await saveBrandBaseInfo(brandDetailData, input);
      const [refreshedDetail, refreshedOverview] = await Promise.all([
        loadBrandDetailData(brandDetailData.brand.brandId),
        loadOverviewData(),
      ]);
      setBrandDetailData(refreshedDetail);
      setOverviewData(refreshedOverview);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '品牌信息保存失败');
    } finally {
      setSavingBrandBaseInfo(false);
    }
  };

  const handleSaveBrandDesktopShell = async (input: {
    websiteTitle: string;
    devWebsiteTitle: string;
    sidebarTitle: string;
    devSidebarTitle: string;
    sidebarSubtitle: string;
    legalName: string;
    bundleIdentifier: string;
    authService: string;
  }) => {
    if (!brandDetailData) return;
    setSavingBrandDesktopShell(true);
    setError('');
    try {
      await saveBrandDesktopShell(brandDetailData, input);
      const refreshed = await loadBrandDetailData(brandDetailData.brand.brandId);
      setBrandDetailData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '桌面端保存失败');
    } finally {
      setSavingBrandDesktopShell(false);
    }
  };

  const handleSaveBrandAuthExperience = async (input: {
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
  }) => {
    if (!brandDetailData) return;
    setSavingBrandAuthExperience(true);
    setError('');
    try {
      await saveBrandAuthExperience(brandDetailData, input);
      const refreshed = await loadBrandDetailData(brandDetailData.brand.brandId);
      setBrandDetailData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '登录与协议保存失败');
    } finally {
      setSavingBrandAuthExperience(false);
    }
  };

  const handleSaveBrandHeader = async (input: {
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
  }) => {
    if (!brandDetailData) return;
    setSavingBrandHeader(true);
    setError('');
    try {
      await saveBrandHeader(brandDetailData, input);
      const refreshed = await loadBrandDetailData(brandDetailData.brand.brandId);
      setBrandDetailData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Header 保存失败');
    } finally {
      setSavingBrandHeader(false);
    }
  };

  const handleSaveBrandInput = async (input: {
    enabled: boolean;
    placeholderText: string;
  }) => {
    if (!brandDetailData) return;
    setSavingBrandInput(true);
    setError('');
    try {
      await saveBrandInputSurface(brandDetailData, input);
      const refreshed = await loadBrandDetailData(brandDetailData.brand.brandId);
      setBrandDetailData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '输入框保存失败');
    } finally {
      setSavingBrandInput(false);
    }
  };

  const handleSaveBrandComposerControls = async (
    items: Array<{ controlKey: string; enabled: boolean; displayName: string; allowedOptionValues: string[] }>,
  ) => {
    if (!brandDetailData) return;
    setSavingBrandComposerControls(true);
    setError('');
    try {
      await saveBrandComposerControls(brandDetailData, items);
      const refreshed = await loadBrandDetailData(brandDetailData.brand.brandId);
      setBrandDetailData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '输入控件保存失败');
    } finally {
      setSavingBrandComposerControls(false);
    }
  };

  const handleSaveBrandComposerShortcuts = async (
    items: Array<{ shortcutKey: string; enabled: boolean; displayName: string; description: string; template: string }>,
  ) => {
    if (!brandDetailData) return;
    setSavingBrandComposerShortcuts(true);
    setError('');
    try {
      await saveBrandComposerShortcuts(brandDetailData, items);
      const refreshed = await loadBrandDetailData(brandDetailData.brand.brandId);
      setBrandDetailData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '快捷方式保存失败');
    } finally {
      setSavingBrandComposerShortcuts(false);
    }
  };

  const handleSaveBrandHomeWeb = async (input: {
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
  }) => {
    if (!brandDetailData) return;
    setSavingBrandHomeWeb(true);
    setError('');
    try {
      await saveBrandHomeWebSurface(brandDetailData, input);
      const refreshed = await loadBrandDetailData(brandDetailData.brand.brandId);
      setBrandDetailData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Home官网保存失败');
    } finally {
      setSavingBrandHomeWeb(false);
    }
  };

  const handleSaveBrandWelcome = async (input: {
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
  }) => {
    if (!brandDetailData) return;
    setSavingBrandWelcome(true);
    setError('');
    try {
      await saveBrandWelcomeSurface(brandDetailData, input);
      const refreshed = await loadBrandDetailData(brandDetailData.brand.brandId);
      setBrandDetailData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Welcome 页保存失败');
    } finally {
      setSavingBrandWelcome(false);
    }
  };

  const handleUploadBrandAsset = async (input: {
    assetKey: string;
    kind: string;
    metadataText: string;
    file: File;
  }) => {
    if (!brandDetailData) return;
    setSavingBrandAsset(true);
    setError('');
    try {
      const metadata = asObject(input.metadataText ? JSON.parse(input.metadataText) : {});
      await uploadBrandAsset(brandDetailData, {
        ...input,
        metadata,
      });
      const refreshed = await loadBrandDetailData(brandDetailData.brand.brandId);
      setBrandDetailData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '资源上传失败');
    } finally {
      setSavingBrandAsset(false);
    }
  };

  const handleUploadGlobalAsset = async () => {
    setSavingBrandAsset(true);
    setError('');
    try {
      await uploadBrandAssetByBrandId(assetUploadDraft.brandId, {
        assetKey: assetUploadDraft.assetKey,
        kind: assetUploadDraft.kind,
        metadata: asObject(assetUploadDraft.metadataText ? JSON.parse(assetUploadDraft.metadataText) : {}),
        file: assetUploadDraft.file as File,
      });
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      if (selectedBrandId && selectedBrandId === assetUploadDraft.brandId && route === 'brand-detail') {
        const refreshedDetail = await loadBrandDetailData(selectedBrandId);
        setBrandDetailData(refreshedDetail);
      }
      setAssetUploadDraft((current) => ({
        brandId: current.brandId,
        assetKey: '',
        kind: '',
        metadataText: '{}',
        file: null,
      }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '资源上传失败');
    } finally {
      setSavingBrandAsset(false);
    }
  };

  const handleDeleteGlobalAsset = async (brandId: string, assetKey: string) => {
    setSavingBrandAsset(true);
    setError('');
    try {
      await deleteBrandAsset(brandId, assetKey);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      if (selectedBrandId && selectedBrandId === brandId && route === 'brand-detail') {
        const refreshedDetail = await loadBrandDetailData(selectedBrandId);
        setBrandDetailData(refreshedDetail);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '资源删除失败');
    } finally {
      setSavingBrandAsset(false);
    }
  };

  const handleDeleteBrandAsset = async (assetKey: string) => {
    if (!brandDetailData) return;
    setSavingBrandAsset(true);
    setError('');
    try {
      await deleteBrandAsset(brandDetailData.brand.brandId, assetKey);
      const [refreshedDetail, refreshedOverview] = await Promise.all([
        loadBrandDetailData(brandDetailData.brand.brandId),
        loadOverviewData(),
      ]);
      setBrandDetailData(refreshedDetail);
      setOverviewData(refreshedOverview);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '品牌资源删除失败');
    } finally {
      setSavingBrandAsset(false);
    }
  };

  const handlePublishBrand = async (options: { force?: boolean } = {}) => {
    if (!brandDetailData) return;
    if (brandDetailDirty && !options.force) {
      const currentTabLabel = BRAND_DETAIL_TABS.find((item) => item.id === brandDetailTab)?.label || '当前页面';
      setNotice('');
      setError(`${currentTabLabel} 有未保存改动，请先点击当前 tab 内的保存按钮，再发布快照。`);
      return;
    }
    setSavingBrandReleaseAction(true);
    setError('');
    setNotice('');
    try {
      await publishBrandSnapshot(brandDetailData.brand.brandId);
      const [refreshedDetail, refreshedOverview] = await Promise.all([
        loadBrandDetailData(brandDetailData.brand.brandId),
        loadOverviewData(),
      ]);
      setBrandDetailData(refreshedDetail);
      setOverviewData(refreshedOverview);
      setNotice(`已发布 ${brandDetailData.brand.displayName} 当前快照。`);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : '品牌发布失败');
    } finally {
      setSavingBrandReleaseAction(false);
    }
  };

  const handleRestoreBrandVersion = async (version: string) => {
    if (!brandDetailData) return;
    setSavingBrandReleaseAction(true);
    setError('');
    try {
      await restoreBrandVersion(brandDetailData.brand.brandId, version);
      const [refreshedDetail, refreshedOverview] = await Promise.all([
        loadBrandDetailData(brandDetailData.brand.brandId),
        loadOverviewData(),
      ]);
      setBrandDetailData(refreshedDetail);
      setOverviewData(refreshedOverview);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : '品牌版本恢复失败');
    } finally {
      setSavingBrandReleaseAction(false);
    }
  };

  const handleSaveRechargeCatalog = async (input: {
    packageId: string;
    packageName: string;
    credits: number;
    bonusCredits: number;
    amountCnyFen: number;
    sortOrder: number;
    recommended: boolean;
    default: boolean;
    active: boolean;
    description: string;
    badgeLabel: string;
    highlight: string;
    featureList: string[];
  }) => {
    setSavingRechargeCatalog(true);
    setError('');
    try {
      await saveRechargePackageCatalogEntry(input);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      setSelectedRechargePackageId(input.packageId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '充值套餐保存失败');
    } finally {
      setSavingRechargeCatalog(false);
    }
  };

  const handleDeleteRechargeCatalog = async (packageId: string) => {
    setSavingRechargeCatalog(true);
    setError('');
    try {
      await deleteRechargePackageCatalogEntry(packageId);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      setSelectedRechargePackageId('');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '充值套餐删除失败');
    } finally {
      setSavingRechargeCatalog(false);
    }
  };

  const handleRestoreRecommendedRechargePackages = async () => {
    setSavingRechargeCatalog(true);
    setError('');
    try {
      await restoreRecommendedRechargePackages();
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      setSelectedRechargePackageId('topup_7000');
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : '恢复超值推荐三挡失败');
    } finally {
      setSavingRechargeCatalog(false);
    }
  };

  const handleMarkPaymentOrderPaid = async (input: {
    providerOrderId: string;
    paidAt: string;
    note: string;
  }) => {
    if (!selectedPaymentOrder?.orderId) return;
    setSavingPaymentOrderAction(true);
    setError('');
    try {
      await markPaymentOrderPaid(selectedPaymentOrder.orderId, input);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      const detail = await fetchPaymentOrderDetail(selectedPaymentOrder.orderId);
      setSelectedPaymentOrderDetail(asObject(detail));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '人工确认到账失败');
    } finally {
      setSavingPaymentOrderAction(false);
    }
  };

  const handleRefundPaymentOrder = async (input: {
    note: string;
  }) => {
    if (!selectedPaymentOrder?.orderId) return;
    setSavingPaymentOrderAction(true);
    setError('');
    try {
      await refundPaymentOrder(selectedPaymentOrder.orderId, input);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      const detail = await fetchPaymentOrderDetail(selectedPaymentOrder.orderId);
      setSelectedPaymentOrderDetail(asObject(detail));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '人工退款/冲正失败');
    } finally {
      setSavingPaymentOrderAction(false);
    }
  };

  const handleExportPaymentOrders = () => {
    const headers = [
      'order_id',
      'status',
      'provider',
      'amount_cny_fen',
      'total_credits',
      'app_name',
      'app_version',
      'release_channel',
      'platform',
      'arch',
      'provider_order_id',
      'user_id',
      'username',
      'user_email',
      'user_display_name',
      'created_at',
      'paid_at',
      'expires_at',
      'latest_webhook_at',
      'webhook_event_count',
    ];
    const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [
      headers.join(','),
      ...filteredPaymentOrders.map((item) =>
        headers.map((key) => csvEscape((item as Record<string, unknown>)[key] ?? (item as Record<string, unknown>)[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())])).join(','),
      ),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payment-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSavePlatformSkill = async (input: {
    slug: string;
    active: boolean;
    metadata?: Record<string, unknown>;
  }) => {
    setSavingPlatformSkill(true);
    setError('');
    try {
      await savePlatformSkillBinding(input);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      setSelectedPlatformSkillSlug(input.slug);
      setNewPlatformSkillSlug('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '平台级 Skill 保存失败');
    } finally {
      setSavingPlatformSkill(false);
    }
  };

  const handleDeletePlatformSkill = async (slug: string) => {
    setSavingPlatformSkill(true);
    setError('');
    try {
      await deletePlatformSkillBinding(slug);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      setSelectedPlatformSkillSlug('');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '移出平台预装 Skill 失败');
    } finally {
      setSavingPlatformSkill(false);
    }
  };

  const handleSavePlatformMcp = async (input: {
    key: string;
    active: boolean;
    metadata?: Record<string, unknown>;
  }) => {
    setSavingPlatformMcp(true);
    setError('');
    try {
      await savePlatformMcpBinding(input);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      setSelectedPlatformMcpKey(input.key);
      setNewPlatformMcpKey('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '平台级 MCP 保存失败');
    } finally {
      setSavingPlatformMcp(false);
    }
  };

  const handleDeletePlatformMcp = async (key: string) => {
    setSavingPlatformMcp(true);
    setError('');
    try {
      await deletePlatformMcpBinding(key);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      setSelectedPlatformMcpKey('');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '移出平台级 MCP 失败');
    } finally {
      setSavingPlatformMcp(false);
    }
  };

  const handleSaveCloudMcp = async (input: {
    key: string;
    name: string;
    description: string;
    transport: string;
    objectKey: string;
    enabled: boolean;
    command: string;
    argsText: string;
    httpUrl: string;
    envText: string;
    metadataText: string;
  }) => {
    setSavingCloudMcp(true);
    setError('');
    try {
      const metadata = asObject(input.metadataText ? JSON.parse(input.metadataText) : {});
      await saveCloudMcpCatalogEntry({
        ...input,
        metadata,
      });
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      setSelectedCloudMcpKey(input.key);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '云MCP 保存失败');
    } finally {
      setSavingCloudMcp(false);
    }
  };

  const handleDeleteCloudMcp = async (key: string) => {
    setSavingCloudMcp(true);
    setError('');
    try {
      await deleteCloudMcpCatalogEntry(key);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      setSelectedCloudMcpKey('');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '云MCP 删除失败');
    } finally {
      setSavingCloudMcp(false);
    }
  };

  const handleTestCloudMcp = async (input: {
    key: string;
    name: string;
    description: string;
    transport: string;
    objectKey: string;
    enabled: boolean;
    command: string;
    argsText: string;
    httpUrl: string;
    envText: string;
    metadataText: string;
  }) => {
    setSavingCloudMcp(true);
    setError('');
    try {
      const result = await testCloudMcpCatalogEntry(input);
      setCloudMcpTestResult(asObject(result));
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'MCP 测试失败');
      setCloudMcpTestResult({ ok: false, message: testError instanceof Error ? testError.message : 'MCP 测试失败' });
    } finally {
      setSavingCloudMcp(false);
    }
  };

  const handleSaveSkillSyncSource = async () => {
    setSavingSkillSyncSource(true);
    setError('');
    try {
      let config: Record<string, unknown> = {};
      try {
        config = asObject(skillSyncSourceDraft.configText ? JSON.parse(skillSyncSourceDraft.configText) : {});
      } catch (parseError) {
        throw new Error(parseError instanceof Error ? parseError.message : '同步源 Config JSON 解析失败');
      }
      await saveSkillSyncSource({
        id: skillSyncSourceDraft.id,
        sourceType: skillSyncSourceDraft.sourceType,
        sourceKey: skillSyncSourceDraft.sourceKey,
        displayName: skillSyncSourceDraft.displayName,
        sourceUrl: skillSyncSourceDraft.sourceUrl,
        config,
        active: skillSyncSourceDraft.active,
      });
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      if (skillSyncSourceDraft.id) {
        setSelectedSkillSyncSourceId(skillSyncSourceDraft.id);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '同步源保存失败');
    } finally {
      setSavingSkillSyncSource(false);
    }
  };

  const handleRunSkillSync = async () => {
    if (!selectedSkillSyncSource?.id) return;
    setRunningSkillSync(true);
    setError('');
    try {
      await runSkillSync(selectedSkillSyncSource.id);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : '技能同步失败');
    } finally {
      setRunningSkillSync(false);
    }
  };

  const handleLoadCloudSkillsPage = async (input: { query?: string; offset?: number }) => {
    setSavingCloudSkill(true);
    setError('');
    try {
      const response = await fetchCloudSkillsCatalogPage({
        query: input.query ?? cloudSkillQuery,
        offset: input.offset ?? cloudSkillPage?.meta.offset ?? 0,
        limit: cloudSkillPage?.meta.limit || overviewData?.cloudSkillMeta.limit || 100,
      });
      setCloudSkillPage({
        items: (asObject(response).items as OverviewData['cloudSkills']) || [],
        meta: {
          total: Number(asObject(response).total || 0),
          limit: Number(asObject(response).limit || cloudSkillPage?.meta.limit || overviewData?.cloudSkillMeta.limit || 100),
          offset: Number(asObject(response).offset || 0),
          hasMore: asObject(response).has_more === true,
          nextOffset: Number.isFinite(Number(asObject(response).next_offset)) ? Number(asObject(response).next_offset) : null,
          query: input.query ?? cloudSkillQuery,
        },
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '云技能目录加载失败');
    } finally {
      setSavingCloudSkill(false);
    }
  };

  const handleSetCloudSkillEnabled = async (slug: string, enabled: boolean) => {
    const skill = (cloudSkillPage?.items || overviewData?.cloudSkills || []).find((item) => item.slug === slug);
    if (!skill) return;
    setSavingCloudSkill(true);
    setError('');
    try {
      await setCloudSkillEnabled(skill, enabled);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      await handleLoadCloudSkillsPage({ query: cloudSkillQuery, offset: cloudSkillPage?.meta.offset || 0 });
      setSelectedCloudSkillSlug(slug);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `云技能${enabled ? '上架' : '下架'}失败`);
    } finally {
      setSavingCloudSkill(false);
    }
  };

  const handleSavePlatformModel = async () => {
    setSavingPlatformModel(true);
    setError('');
    try {
      await savePlatformModelCatalogEntry(platformModelDraft);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      setSelectedPlatformModelRef(platformModelDraft.ref);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '模型保存失败');
    } finally {
      setSavingPlatformModel(false);
    }
  };

  const handleDeletePlatformModel = async (ref: string) => {
    setSavingPlatformModel(true);
    setError('');
    try {
      await deletePlatformModelCatalogEntry(ref);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      setSelectedPlatformModelRef('');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '模型删除失败');
    } finally {
      setSavingPlatformModel(false);
    }
  };

  const handleSaveModelProviderProfile = async () => {
    setSavingModelProviderProfile(true);
    setError('');
    try {
      const models = providerDraft.models
        .map((item) => ({
          label: item.label.trim(),
          modelId: item.modelId.trim(),
          billingMultiplier: Number(item.billingMultiplier || 1) || 1,
          logoPresetKey: item.logoPresetKey.trim() || '',
        }))
        .filter((item) => item.label && item.modelId);
      await saveModelProviderProfile({
        profileId: providerDraft.profileId,
        scopeType: selectedProviderScopeType,
        scopeKey: selectedProviderScopeKey,
        providerMode: providerDraft.providerMode,
        providerKey: providerDraft.providerKey,
        baseUrl: providerDraft.baseUrl,
        apiKey: providerDraft.apiKey,
        logoPresetKey: providerDraft.logoPresetKey,
        defaultModelRef: providerDraft.defaultModelRef,
        models,
      });
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Provider 保存失败');
    } finally {
      setSavingModelProviderProfile(false);
    }
  };

  const handleSaveMemoryEmbedding = async () => {
    setSavingMemoryEmbeddingProfile(true);
    setError('');
    try {
      const preflight = await saveMemoryEmbeddingProfile({
        profileId: memoryDraft.profileId,
        scopeType: selectedProviderScopeType,
        scopeKey: selectedProviderScopeKey,
        providerKey: memoryDraft.providerKey,
        baseUrl: memoryDraft.baseUrl,
        apiKey: memoryDraft.apiKey,
        embeddingModel: memoryDraft.embeddingModel,
        logoPresetKey: memoryDraft.logoPresetKey,
        autoRecall: memoryDraft.autoRecall,
      });
      setMemoryEmbeddingTestResult({
        ok: true,
        message: preflight?.dimensions ? `${preflight.dimensions} 维向量返回成功` : '预检通过',
        dimensions: preflight?.dimensions || null,
      });
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
    } catch (saveError) {
      setMemoryEmbeddingTestResult({
        ok: false,
        message: saveError instanceof Error ? saveError.message : '记忆 Embedding 保存失败',
        dimensions: null,
      });
      setError(saveError instanceof Error ? saveError.message : '记忆 Embedding 保存失败');
    } finally {
      setSavingMemoryEmbeddingProfile(false);
    }
  };

  const handleTestMemoryEmbedding = async () => {
    setSavingMemoryEmbeddingProfile(true);
    setError('');
    try {
      const preflight = await testMemoryEmbeddingProfile({
        providerKey: memoryDraft.providerKey,
        baseUrl: memoryDraft.baseUrl,
        apiKey: memoryDraft.apiKey,
        embeddingModel: memoryDraft.embeddingModel,
      });
      setMemoryEmbeddingTestResult({
        ok: true,
        message: preflight?.dimensions ? `${preflight.dimensions} 维向量返回成功` : '预检通过',
        dimensions: preflight?.dimensions || null,
      });
    } catch (testError) {
      setMemoryEmbeddingTestResult({
        ok: false,
        message: testError instanceof Error ? testError.message : '记忆 Embedding 测试失败',
        dimensions: null,
      });
      setError(testError instanceof Error ? testError.message : '记忆 Embedding 测试失败');
    } finally {
      setSavingMemoryEmbeddingProfile(false);
    }
  };

  const handleRestorePlatformProvider = async () => {
    if (selectedProviderScopeType !== 'app') return;
    setSavingModelProviderProfile(true);
    setError('');
    try {
      await restorePlatformModelProvider(selectedProviderScopeKey);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : '恢复跟随平台 Provider 失败');
    } finally {
      setSavingModelProviderProfile(false);
    }
  };

  const handleRestorePlatformMemory = async () => {
    if (selectedProviderScopeType !== 'app' || !memoryDraft.profileId) return;
    setSavingMemoryEmbeddingProfile(true);
    setError('');
    try {
      await restorePlatformMemoryEmbedding(memoryDraft.profileId);
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : '恢复跟随平台记忆 Embedding 失败');
    } finally {
      setSavingMemoryEmbeddingProfile(false);
    }
  };

  const handlePublishDesktopRelease = async () => {
    if (!selectedDesktopBrandId) {
      setError('请选择要发布的品牌');
      return;
    }
    if (!desktopReleaseDraft.version.trim()) {
      setError('请填写桌面版本号');
      return;
    }
    setSavingDesktopReleasePublish(true);
    setError('');
    try {
      await publishDesktopRelease({
        brandId: selectedDesktopBrandId,
        channel: selectedDesktopReleaseChannel,
        version: desktopReleaseDraft.version,
        notes: desktopReleaseDraft.notes,
        enforcementMode: desktopReleaseDraft.enforcementMode,
        forceUpdateBelowVersion: desktopReleaseDraft.forceUpdateBelowVersion,
        reasonMessage: desktopReleaseDraft.reasonMessage,
        files: desktopReleaseFiles,
      });
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : '桌面发布失败');
    } finally {
      setSavingDesktopReleasePublish(false);
    }
  };

  const handleSaveRuntimeRelease = async () => {
    const targetTriple = computeRuntimeTargetTriple(runtimeReleaseDraft.platform, runtimeReleaseDraft.arch);
    if (!targetTriple) {
      setError('当前 platform / arch 组合还不支持自动推导 target triple');
      return;
    }
    setSavingRuntimeRelease(true);
    setError('');
    try {
      await saveRuntimeRelease({
        ...runtimeReleaseDraft,
        targetTriple,
      });
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      if (runtimeReleaseDraft.id) setSelectedRuntimeReleaseId(runtimeReleaseDraft.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Runtime release 保存失败');
    } finally {
      setSavingRuntimeRelease(false);
    }
  };

  const handleSaveRuntimeBinding = async () => {
    const targetTriple = computeRuntimeTargetTriple(runtimeBindingDraft.platform, runtimeBindingDraft.arch);
    if (!targetTriple) {
      setError('当前 platform / arch 组合还不支持自动推导 target triple');
      return;
    }
    if (runtimeBindingDraft.scopeType === 'app' && !runtimeBindingDraft.scopeKey.trim()) {
      setError('请选择 OEM 应用');
      return;
    }
    setSavingRuntimeBinding(true);
    setError('');
    try {
      await saveRuntimeBinding({
        ...runtimeBindingDraft,
        scopeKey: runtimeBindingDraft.scopeType === 'platform' ? 'platform' : runtimeBindingDraft.scopeKey,
        targetTriple,
      });
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      if (runtimeBindingDraft.id) setSelectedRuntimeBindingId(runtimeBindingDraft.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Runtime binding 保存失败');
    } finally {
      setSavingRuntimeBinding(false);
    }
  };

  const handleImportRuntimeBootstrap = async () => {
    if (selectedRuntimeImportBindScopeType === 'app' && !selectedRuntimeImportBindScopeKey) {
      setError('请选择要自动绑定的 OEM 应用');
      return;
    }
    setSavingRuntimeRelease(true);
    setError('');
    try {
      await importRuntimeBootstrapSource({
        channel: selectedRuntimeImportChannel,
        bindScopeType: selectedRuntimeImportBindScopeType,
        bindScopeKey: selectedRuntimeImportBindScopeKey,
      });
      const refreshed = await loadOverviewData();
      setOverviewData(refreshed);
      setRuntimeSection(selectedRuntimeImportBindScopeType === 'none' ? 'release' : 'binding');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'legacy runtime bootstrap 导入失败');
    } finally {
      setSavingRuntimeRelease(false);
    }
  };

  const handleSaveBrandSidebar = async (input: {
    enabled: boolean;
    variant: string;
    brandTitle: string;
    brandSubtitle: string;
    sectionStyle: string;
    emphasizeActiveItem: boolean;
  }) => {
    if (!brandDetailData) return;
    setSavingBrandSidebar(true);
    setError('');
    try {
      await saveBrandSidebar(brandDetailData, input);
      const refreshed = await loadBrandDetailData(brandDetailData.brand.brandId);
      setBrandDetailData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '侧边栏保存失败');
    } finally {
      setSavingBrandSidebar(false);
    }
  };

  const handleSaveBrandSkills = async (selectedSkillSlugs: string[]) => {
    if (!brandDetailData) return;
    setSavingBrandSkills(true);
    setError('');
    try {
      const platformManaged = (overviewData?.platformSkills || []).map((item) => item.slug);
      await saveBrandSkills(brandDetailData, selectedSkillSlugs, platformManaged);
      const [refreshedDetail, refreshedOverview] = await Promise.all([
        loadBrandDetailData(brandDetailData.brand.brandId),
        loadOverviewData(),
      ]);
      setBrandDetailData(refreshedDetail);
      setOverviewData(refreshedOverview);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '技能装配保存失败');
    } finally {
      setSavingBrandSkills(false);
    }
  };

  const handleSaveBrandModels = async (
    items: Array<{ modelRef: string; enabled: boolean; recommended: boolean; default: boolean }>,
  ) => {
    if (!brandDetailData) return;
    setSavingBrandModels(true);
    setError('');
    try {
      await saveBrandModels(brandDetailData, items);
      const refreshed = await loadBrandDetailData(brandDetailData.brand.brandId);
      setBrandDetailData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '模型绑定保存失败');
    } finally {
      setSavingBrandModels(false);
    }
  };

  const handleSaveBrandMcps = async (selectedMcpKeys: string[]) => {
    if (!brandDetailData) return;
    setSavingBrandMcps(true);
    setError('');
    try {
      const platformManaged = (overviewData?.platformMcps || []).map((item) => item.key);
      await saveBrandMcps(brandDetailData, selectedMcpKeys, platformManaged);
      const [refreshedDetail, refreshedOverview] = await Promise.all([
        loadBrandDetailData(brandDetailData.brand.brandId),
        loadOverviewData(),
      ]);
      setBrandDetailData(refreshedDetail);
      setOverviewData(refreshedOverview);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'MCP 装配保存失败');
    } finally {
      setSavingBrandMcps(false);
    }
  };

  const handleSaveBrandRechargePackages = async (selectedPackageIds: string[]) => {
    if (!brandDetailData) return;
    setSavingBrandRechargePackages(true);
    setError('');
    try {
      await saveBrandRechargePackages(brandDetailData, selectedPackageIds);
      const refreshed = await loadBrandDetailData(brandDetailData.brand.brandId);
      setBrandDetailData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '充值套餐保存失败');
    } finally {
      setSavingBrandRechargePackages(false);
    }
  };

  const handleSaveBrandMenus = async (
    items: Array<{ menuKey: string; enabled: boolean; displayName: string; group: string }>,
  ) => {
    if (!brandDetailData) return;
    setSavingBrandMenus(true);
    setError('');
    try {
      await saveBrandMenus(brandDetailData, items);
      const refreshed = await loadBrandDetailData(brandDetailData.brand.brandId);
      setBrandDetailData(refreshed);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '左菜单栏保存失败');
    } finally {
      setSavingBrandMenus(false);
    }
  };

  const currentUser = overviewData?.user || null;
  const filteredBrands = (overviewData?.brands || []).filter((brand) => {
    if (brandStatus !== 'all' && brand.status !== brandStatus) {
      return false;
    }
    const query = brandQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return [brand.brandId, brand.displayName, brand.productName, brand.tenantKey].some((item) =>
      item.toLowerCase().includes(query),
    );
  });
  const filteredReleases = (overviewData?.releases || []).filter((item) => releaseBrand === 'all' || item.brandId === releaseBrand);
  const selectedRelease = filteredReleases.find((item) => item.id === selectedReleaseId) || filteredReleases[0] || null;
  const selectedDesktopBrandId = releaseBrand !== 'all' ? releaseBrand : '';
  const selectedDesktopReleaseConfig = selectedDesktopBrandId ? overviewData?.desktopReleaseConfigs?.[selectedDesktopBrandId] : null;
  const selectedDesktopChannelConfig = selectedDesktopReleaseConfig ? selectedDesktopReleaseConfig[selectedDesktopReleaseChannel] : null;
  const selectedDesktopDraft = selectedDesktopChannelConfig?.draft || null;
  const selectedDesktopPublished = selectedDesktopChannelConfig?.published || null;
  const [desktopReleaseDraft, setDesktopReleaseDraft] = useState({
    version: '',
    notes: '',
    enforcementMode: 'recommended' as 'recommended' | 'required_after_run' | 'required_now',
    forceUpdateBelowVersion: '',
    reasonMessage: '',
  });
  useEffect(() => {
    setDesktopReleaseDraft({
      version: selectedDesktopDraft?.version || selectedDesktopPublished?.version || '',
      notes: selectedDesktopDraft?.notes || selectedDesktopPublished?.notes || '',
      enforcementMode:
        !selectedDesktopPublished?.policy?.mandatory && !selectedDesktopDraft?.policy?.mandatory
          ? 'recommended'
          : (selectedDesktopDraft?.policy?.allowCurrentRunToFinish ?? selectedDesktopPublished?.policy?.allowCurrentRunToFinish ?? true)
            ? 'required_after_run'
            : 'required_now',
      forceUpdateBelowVersion:
        selectedDesktopDraft?.policy?.forceUpdateBelowVersion || selectedDesktopPublished?.policy?.forceUpdateBelowVersion || '',
      reasonMessage: selectedDesktopDraft?.policy?.reasonMessage || selectedDesktopPublished?.policy?.reasonMessage || '',
    });
  }, [selectedDesktopBrandId, selectedDesktopReleaseChannel, selectedDesktopDraft?.version, selectedDesktopPublished?.version]);
  const assetKinds = Array.from(
    new Set((overviewData?.assets || []).map((item) => String(item.metadata.kind || '')).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const filteredAssets = (overviewData?.assets || []).filter((item) => {
    if (assetBrand !== 'all' && item.brandId !== assetBrand) return false;
    const kind = String(item.metadata.kind || '').trim();
    if (assetKind !== 'all' && kind !== assetKind) return false;
    const query = assetQuery.trim().toLowerCase();
    if (!query) return true;
    return [item.assetKey, item.brandDisplayName, item.objectKey, item.contentType, kind].some((value) =>
      String(value || '').toLowerCase().includes(query),
    );
  });
  const paymentApps = Array.from(new Set((overviewData?.paymentOrders || []).map((item) => item.appName).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'zh-CN'),
  );
  const filteredPaymentOrders = (overviewData?.paymentOrders || []).filter((item) => {
    if (paymentStatus !== 'all' && item.status !== paymentStatus) return false;
    if (paymentProvider !== 'all' && item.provider !== paymentProvider) return false;
    if (paymentApp !== 'all' && item.appName !== paymentApp) return false;
    const query = paymentQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      item.orderId,
      item.userId,
      item.username,
      item.userEmail,
      item.userDisplayName,
      item.providerOrderId,
      item.appName,
    ]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
  const selectedPaymentOrder = filteredPaymentOrders.find((item) => item.orderId === selectedPaymentOrderId) || filteredPaymentOrders[0] || null;
  useEffect(() => {
    if (!selectedPaymentOrder?.orderId) {
      setSelectedPaymentOrderDetail(null);
      return;
    }
    let cancelled = false;
    void fetchPaymentOrderDetail(selectedPaymentOrder.orderId)
      .then((detail) => {
        if (!cancelled) {
          setSelectedPaymentOrderDetail(asObject(detail));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedPaymentOrderDetail(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPaymentOrder?.orderId]);
  const selectedRechargePackage =
    (overviewData?.rechargeCatalog || []).find((item) => item.packageId === selectedRechargePackageId) || overviewData?.rechargeCatalog?.[0] || null;
  const filteredCloudSkills = cloudSkillPage?.items || overviewData?.cloudSkills || [];
  const cloudSkillMeta = cloudSkillPage?.meta || overviewData?.cloudSkillMeta || { total: 0, limit: 100, offset: 0, hasMore: false, nextOffset: null, query: '' };
  const selectedCloudSkill = filteredCloudSkills.find((item) => item.slug === selectedCloudSkillSlug) || filteredCloudSkills[0] || null;
  const selectedSkillSyncSource =
    (overviewData?.skillSyncSources || []).find((item) => item.id === selectedSkillSyncSourceId) || overviewData?.skillSyncSources?.[0] || null;
  const [skillSyncSourceDraft, setSkillSyncSourceDraft] = useState({
    id: '',
    sourceType: 'github_repo',
    sourceKey: '',
    displayName: '',
    sourceUrl: '',
    configText: '{}',
    active: true,
  });
  useEffect(() => {
    if (!overviewData) return;
    setCloudSkillPage({
      items: overviewData.cloudSkills || [],
      meta: overviewData.cloudSkillMeta || { total: 0, limit: 100, offset: 0, hasMore: false, nextOffset: null, query: '' },
    });
  }, [overviewData?.cloudSkills, overviewData?.cloudSkillMeta]);

  useEffect(() => {
    if (!selectedSkillSyncSource) {
      setSkillSyncSourceDraft({
        id: '',
        sourceType: 'github_repo',
        sourceKey: '',
        displayName: '',
        sourceUrl: '',
        configText: '{}',
        active: true,
      });
      return;
    }
    setSkillSyncSourceDraft({
      id: selectedSkillSyncSource.id,
      sourceType: selectedSkillSyncSource.sourceType || 'github_repo',
      sourceKey: selectedSkillSyncSource.sourceKey || '',
      displayName: selectedSkillSyncSource.displayName || '',
      sourceUrl: selectedSkillSyncSource.sourceUrl || '',
      configText: JSON.stringify(selectedSkillSyncSource.config || {}, null, 2),
      active: selectedSkillSyncSource.active !== false,
    });
  }, [selectedSkillSyncSource]);
  const selectedCloudMcp =
    (overviewData?.cloudMcps || []).find((item) => item.key === selectedCloudMcpKey) || overviewData?.cloudMcps?.[0] || null;
  const filteredPlatformSkills = (overviewData?.platformSkills || []).filter((item) =>
    [item.slug, item.name, item.description, item.category, item.publisher].join(' ').toLowerCase().includes(capabilityQuery.trim().toLowerCase()),
  );
  const selectedPlatformSkill =
    filteredPlatformSkills.find((item) => item.slug === selectedPlatformSkillSlug) || filteredPlatformSkills[0] || null;
  const filteredPlatformMcps = (overviewData?.platformMcps || []).filter((item) =>
    [item.key, item.name, item.description, item.transport].join(' ').toLowerCase().includes(capabilityQuery.trim().toLowerCase()),
  );
  const selectedPlatformMcp =
    filteredPlatformMcps.find((item) => item.key === selectedPlatformMcpKey) || filteredPlatformMcps[0] || null;
  useEffect(() => {
    setPlatformSkillMetadataText(JSON.stringify(selectedPlatformSkill?.metadata || {}, null, 2));
  }, [selectedPlatformSkill?.slug]);
  useEffect(() => {
    setPlatformMcpMetadataText(JSON.stringify(selectedPlatformMcp?.metadata || {}, null, 2));
  }, [selectedPlatformMcp?.key]);
  const filteredPlatformModels = (overviewData?.platformModels || []).filter((item) =>
    [item.ref, item.label, item.providerId, item.modelId].join(' ').toLowerCase().includes(capabilityQuery.trim().toLowerCase()),
  );
  const selectedPlatformModel =
    selectedPlatformModelRef === '__new__'
      ? null
      : filteredPlatformModels.find((item) => item.ref === selectedPlatformModelRef) || filteredPlatformModels[0] || null;
  const [platformModelDraft, setPlatformModelDraft] = useState({
    ref: '',
    label: '',
    providerId: 'openai',
    modelId: '',
    api: 'openai-completions',
    baseUrl: '',
    useRuntimeOpenai: true,
    authHeader: true,
    reasoning: false,
    inputText: 'text',
    contextWindow: 0,
    maxTokens: 0,
    active: true,
  });
  const selectedProviderScopeKey =
    selectedModelProviderTab === 'platform'
      ? 'platform'
      : (overviewData?.brands || []).find((brand) => brand.brandId === selectedModelProviderTab)?.brandId || 'platform';
  const selectedProviderScopeType = selectedProviderScopeKey === 'platform' ? 'platform' : 'app';
  const selectedProviderProfile =
    (overviewData?.modelProviderProfiles || [])
      .filter((item) => item.scopeType === selectedProviderScopeType && item.scopeKey === selectedProviderScopeKey)
      .sort((left, right) => left.sortOrder - right.sortOrder)[0] || null;
  const selectedProviderOverride =
    selectedProviderScopeType === 'app' ? overviewData?.modelProviderOverrides?.[selectedProviderScopeKey] || null : null;
  const selectedMemoryProfile =
    (overviewData?.memoryEmbeddingProfiles || []).find(
      (item) => item.scopeType === selectedProviderScopeType && item.scopeKey === selectedProviderScopeKey,
    ) || null;
  const [providerDraft, setProviderDraft] = useState({
    profileId: '',
    providerMode: 'inherit_platform',
    providerKey: '',
    baseUrl: '',
    apiKey: '',
    logoPresetKey: '',
    defaultModelRef: '',
    models: [{ label: '', modelId: '', billingMultiplier: 1, logoPresetKey: '' }],
  });
  const [memoryDraft, setMemoryDraft] = useState({
    profileId: '',
    providerKey: '',
    baseUrl: '',
    apiKey: '',
    embeddingModel: '',
    logoPresetKey: '',
    autoRecall: true,
  });
  useEffect(() => {
    if (selectedPlatformModelRef === '__new__') {
      setPlatformModelDraft({
        ref: '',
        label: '',
        providerId: 'openai',
        modelId: '',
        api: 'openai-completions',
        baseUrl: '',
        useRuntimeOpenai: true,
        authHeader: true,
        reasoning: false,
        inputText: 'text',
        contextWindow: 0,
        maxTokens: 0,
        active: true,
      });
      return;
    }
    if (!selectedPlatformModel) return;
    setPlatformModelDraft({
      ref: selectedPlatformModel.ref,
      label: selectedPlatformModel.label,
      providerId: selectedPlatformModel.providerId,
      modelId: selectedPlatformModel.modelId,
      api: selectedPlatformModel.api || 'openai-completions',
      baseUrl: selectedPlatformModel.baseUrl || '',
      useRuntimeOpenai: selectedPlatformModel.useRuntimeOpenai !== false,
      authHeader: selectedPlatformModel.authHeader !== false,
      reasoning: selectedPlatformModel.reasoning === true,
      inputText: (selectedPlatformModel.input || []).join('\n'),
      contextWindow: Number(selectedPlatformModel.contextWindow || 0),
      maxTokens: Number(selectedPlatformModel.maxTokens || 0),
      active: selectedPlatformModel.active !== false,
    });
  }, [selectedPlatformModelRef, selectedPlatformModel]);
  useEffect(() => {
    setProviderDraft({
      profileId: selectedProviderProfile?.id || '',
      providerMode: selectedProviderOverride?.providerMode || 'inherit_platform',
      providerKey: selectedProviderProfile?.providerKey || '',
      baseUrl: selectedProviderProfile?.baseUrl || '',
      apiKey: selectedProviderProfile?.apiKey || '',
      logoPresetKey: selectedProviderProfile?.logoPresetKey || '',
      defaultModelRef:
        String(selectedProviderProfile?.metadata?.default_model_ref || selectedProviderProfile?.metadata?.defaultModelRef || '').trim(),
      models: (selectedProviderProfile?.models || []).length
        ? (selectedProviderProfile?.models || []).map((item) => ({
            label: item.label || '',
            modelId: item.modelId || '',
            billingMultiplier: item.billingMultiplier || 1,
            logoPresetKey: item.logoPresetKey || '',
          }))
        : [{ label: '', modelId: '', billingMultiplier: 1, logoPresetKey: '' }],
    });
  }, [selectedProviderScopeKey, selectedProviderProfile?.id, selectedProviderOverride?.providerMode]);
  useEffect(() => {
    setMemoryDraft({
      profileId: selectedMemoryProfile?.id || '',
      providerKey: selectedMemoryProfile?.providerKey || '',
      baseUrl: selectedMemoryProfile?.baseUrl || '',
      apiKey: selectedMemoryProfile?.apiKey || '',
      embeddingModel: selectedMemoryProfile?.embeddingModel || '',
      logoPresetKey: selectedMemoryProfile?.logoPresetKey || '',
      autoRecall: selectedMemoryProfile?.autoRecall !== false,
    });
    setMemoryEmbeddingTestResult(null);
  }, [selectedProviderScopeKey, selectedMemoryProfile?.id]);
  const selectedRuntimeRelease =
    (overviewData?.runtimeReleases || []).find((item) => item.id === selectedRuntimeReleaseId) || overviewData?.runtimeReleases?.[0] || null;
  const selectedRuntimeBinding =
    (overviewData?.runtimeBindings || []).find((item) => item.id === selectedRuntimeBindingId) || overviewData?.runtimeBindings?.[0] || null;
  const computeRuntimeTargetTriple = (platform: string, arch: string) => {
    const normalizedPlatform = String(platform || '').trim().toLowerCase();
    const normalizedArch = String(arch || '').trim().toLowerCase();
    if (normalizedPlatform === 'darwin' && normalizedArch === 'aarch64') return 'aarch64-apple-darwin';
    if (normalizedPlatform === 'darwin' && normalizedArch === 'x64') return 'x86_64-apple-darwin';
    if (normalizedPlatform === 'windows' && normalizedArch === 'aarch64') return 'aarch64-pc-windows-msvc';
    if (normalizedPlatform === 'windows' && normalizedArch === 'x64') return 'x86_64-pc-windows-msvc';
    if (normalizedPlatform === 'linux' && normalizedArch === 'aarch64') return 'aarch64-unknown-linux-gnu';
    if (normalizedPlatform === 'linux' && normalizedArch === 'x64') return 'x86_64-unknown-linux-gnu';
    return '';
  };
  const [runtimeReleaseDraft, setRuntimeReleaseDraft] = useState({
    id: '',
    runtimeKind: 'openclaw',
    version: '',
    channel: 'prod',
    platform: 'darwin',
    arch: 'aarch64',
    artifactUrl: '',
    bucketName: '',
    objectKey: '',
    artifactSha256: '',
    artifactSizeBytes: 0,
    launcherRelativePath: '',
    gitCommit: '',
    gitTag: '',
    releaseVersion: '',
    buildTime: '',
    status: 'draft',
  });
  const [runtimeBindingDraft, setRuntimeBindingDraft] = useState({
    id: '',
    scopeType: 'platform',
    scopeKey: 'platform',
    runtimeKind: 'openclaw',
    channel: 'prod',
    platform: 'darwin',
    arch: 'aarch64',
    releaseId: '',
    enabled: true,
    changeReason: '',
  });
  useEffect(() => {
    if (!selectedRuntimeRelease) return;
    setRuntimeReleaseDraft({
      id: selectedRuntimeRelease.id,
      runtimeKind: selectedRuntimeRelease.runtimeKind,
      version: selectedRuntimeRelease.version,
      channel: selectedRuntimeRelease.channel,
      platform: selectedRuntimeRelease.platform,
      arch: selectedRuntimeRelease.arch,
      artifactUrl: selectedRuntimeRelease.artifactUrl || '',
      bucketName: '',
      objectKey: '',
      artifactSha256: '',
      artifactSizeBytes: 0,
      launcherRelativePath: '',
      gitCommit: '',
      gitTag: '',
      releaseVersion: '',
      buildTime: '',
      status: selectedRuntimeRelease.status,
    });
  }, [selectedRuntimeRelease]);
  useEffect(() => {
    if (!selectedRuntimeBinding) return;
    setRuntimeBindingDraft({
      id: selectedRuntimeBinding.id,
      scopeType: selectedRuntimeBinding.scopeType,
      scopeKey: selectedRuntimeBinding.scopeKey,
      runtimeKind: selectedRuntimeBinding.runtimeKind,
      channel: selectedRuntimeBinding.channel,
      platform: selectedRuntimeBinding.platform,
      arch: selectedRuntimeBinding.arch,
      releaseId: selectedRuntimeBinding.releaseId,
      enabled: selectedRuntimeBinding.enabled,
      changeReason: selectedRuntimeBinding.changeReason || '',
    });
  }, [selectedRuntimeBinding]);
  const runtimeHistoryItems = selectedRuntimeBinding
    ? (overviewData?.runtimeBindingHistory || []).filter((item) => item.bindingId === selectedRuntimeBinding.id)
    : overviewData?.runtimeBindingHistory || [];
  const auditActions = Array.from(new Set((overviewData?.audit || []).map((item) => item.action).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'zh-CN'),
  );
  const filteredAudit = (overviewData?.audit || []).filter((item) => {
    if (auditBrand !== 'all' && item.brandId !== auditBrand) return false;
    if (auditAction !== 'all' && item.action !== auditAction) return false;
    const query = auditQuery.trim().toLowerCase();
    if (!query) return true;
    return [item.brandDisplayName, item.action, item.actorName, item.actorUsername, item.environment].some((value) =>
      String(value || '').toLowerCase().includes(query),
    );
  });
  const selectedAudit = filteredAudit.find((item) => item.id === selectedAuditId) || filteredAudit[0] || null;
  const brandDetailAvailableComposerControls = useMemo(
    () =>
      (overviewData?.composerControlCatalog || []).map((item) => ({
        controlKey: item.controlKey,
        displayName: item.displayName,
        controlType: item.controlType,
        options: item.options.map((option) => ({ optionValue: option.optionValue, label: option.label })),
      })),
    [overviewData?.composerControlCatalog],
  );
  const brandDetailAvailableComposerShortcuts = useMemo(
    () =>
      (overviewData?.composerShortcutCatalog || []).map((item) => ({
        shortcutKey: item.shortcutKey,
        displayName: item.displayName,
        description: item.description,
        template: item.template,
        tone: item.tone,
      })),
    [overviewData?.composerShortcutCatalog],
  );
  const brandDetailAvailableSkills = useMemo(
    () =>
      (overviewData?.cloudSkills || []).map((item) => ({
        slug: item.slug,
        name: item.name,
        category: item.publisher || item.originType,
      })),
    [overviewData?.cloudSkills],
  );
  const brandDetailInheritedPlatformSkills = useMemo(
    () =>
      (overviewData?.platformSkills || [])
        .filter((item) => item.connectedBrands.some((brand) => brand.brandId === selectedBrandId))
        .map((item) => ({ slug: item.slug, name: item.name })),
    [overviewData?.platformSkills, selectedBrandId],
  );
  const brandDetailAvailableModels = useMemo(
    () =>
      (overviewData?.platformModels || []).map((item) => ({
        ref: item.ref,
        label: item.label,
        providerId: item.providerId,
        modelId: item.modelId,
      })),
    [overviewData?.platformModels],
  );
  const brandDetailAvailableMcps = useMemo(
    () =>
      (overviewData?.cloudMcps || []).map((item) => ({
        key: item.key,
        name: item.name,
        transport: item.transport,
      })),
    [overviewData?.cloudMcps],
  );
  const brandDetailInheritedPlatformMcps = useMemo(
    () =>
      (overviewData?.platformMcps || [])
        .filter((item) => item.connectedBrands.some((brand) => brand.brandId === selectedBrandId))
        .map((item) => ({ key: item.key, name: item.name })),
    [overviewData?.platformMcps, selectedBrandId],
  );
  const brandDetailAvailableRechargePackages = useMemo(
    () =>
      (overviewData?.rechargeCatalog || []).map((item) => ({
        packageId: item.packageId,
        packageName: item.packageName,
        default: item.default,
        recommended: item.recommended,
      })),
    [overviewData?.rechargeCatalog],
  );
  const brandDetailAvailableMenus = useMemo(
    () =>
      (overviewData?.menuCatalog || []).map((item) => ({
        key: item.key,
        label: item.label,
        category: item.category,
      })),
    [overviewData?.menuCatalog],
  );

  if (view === 'booting' || (view === 'console' && overviewLoading && !overviewData)) {
    return (
      <LoadingScreen label={view === 'booting' ? '正在检查登录态' : '正在启动控制台'} />
    );
  }

  if (view === 'console') {
    return (
      <AdminShell
        navItems={NAV_ITEMS}
        route={route}
        onNavigate={setRoute}
        currentUser={currentUser}
        onLogout={handleLogout}
        banner={
          error || notice ? (
            <div className="banner-row banner-row--toast">
              {error ? <div className="banner banner--error">{error}</div> : null}
              {notice ? <div className="banner banner--success">{notice}</div> : null}
            </div>
          ) : null
        }
      >
              {overviewLoading || !overviewData ? (
                <section className="loading-panel">
                  <div className="loading-spinner" />
                  <p>控制面数据加载中…</p>
                </section>
              ) : route === 'brands' ? (
                <BrandsPage
                  brands={filteredBrands}
                  brandQuery={brandQuery}
                  brandStatus={brandStatus}
                  setBrandQuery={setBrandQuery}
                  setBrandStatus={setBrandStatus}
                  onOpenBrand={openBrandDetail}
                  onCreateBrand={handleCreateBrand}
                  savingCreateBrand={savingCreateBrand}
                />
              ) : route === 'agent-center' ? (
                <AgentCenterPage
                  items={overviewData?.agentCatalog || []}
                  saving={savingAgentCatalog}
                  onSave={handleSaveAgentCatalog}
                  onDelete={handleDeleteAgentCatalog}
                />
              ) : route === 'user-action-audit' ? (
                <UserActionAuditPage
                  items={userActionAuditItems}
                  uploads={userActionDiagnosticUploads}
                  loading={userActionAuditLoading}
                  onRefresh={() => void handleRefreshUserActionAudit()}
                />
              ) : route === 'brand-detail' ? (
                <BrandDetailPage
                  detail={brandDetailData}
                  loading={brandDetailLoading}
                  activeTab={brandDetailTab}
                  setActiveTab={setBrandDetailTab}
                  onDirtyChange={setBrandDetailDirty}
                  savingBaseInfo={savingBrandBaseInfo}
                  onSaveBaseInfo={handleSaveBrandBaseInfo}
                  savingDesktopShell={savingBrandDesktopShell}
                  onSaveDesktopShell={handleSaveBrandDesktopShell}
                  savingAuthExperience={savingBrandAuthExperience}
                  onSaveAuthExperience={handleSaveBrandAuthExperience}
                  savingHeader={savingBrandHeader}
                  onSaveHeader={handleSaveBrandHeader}
                  savingHomeWeb={savingBrandHomeWeb}
                  onSaveHomeWeb={handleSaveBrandHomeWeb}
                  savingInput={savingBrandInput}
                  onSaveInput={handleSaveBrandInput}
                  availableComposerControls={brandDetailAvailableComposerControls}
                  savingComposerControls={savingBrandComposerControls}
                  onSaveComposerControls={handleSaveBrandComposerControls}
                  availableComposerShortcuts={brandDetailAvailableComposerShortcuts}
                  savingComposerShortcuts={savingBrandComposerShortcuts}
                  onSaveComposerShortcuts={handleSaveBrandComposerShortcuts}
                  savingSidebar={savingBrandSidebar}
                  onSaveSidebar={handleSaveBrandSidebar}
                  savingWelcome={savingBrandWelcome}
                  onSaveWelcome={handleSaveBrandWelcome}
                  savingTheme={savingBrandTheme}
                  onSaveTheme={handleSaveBrandTheme}
                  availableSkills={brandDetailAvailableSkills}
                  inheritedPlatformSkills={brandDetailInheritedPlatformSkills}
                  savingSkills={savingBrandSkills}
                  onSaveSkills={handleSaveBrandSkills}
                  availableModels={brandDetailAvailableModels}
                  savingModels={savingBrandModels}
                  onSaveModels={handleSaveBrandModels}
                  availableMcps={brandDetailAvailableMcps}
                  inheritedPlatformMcps={brandDetailInheritedPlatformMcps}
                  savingMcps={savingBrandMcps}
                  onSaveMcps={handleSaveBrandMcps}
                  availableRechargePackages={brandDetailAvailableRechargePackages}
                  savingRechargePackages={savingBrandRechargePackages}
                  onSaveRechargePackages={handleSaveBrandRechargePackages}
                  availableMenus={brandDetailAvailableMenus}
                  savingMenus={savingBrandMenus}
                  onSaveMenus={handleSaveBrandMenus}
                  savingAsset={savingBrandAsset}
                  onUploadAsset={handleUploadBrandAsset}
                  onDeleteAsset={handleDeleteBrandAsset}
                  savingReleaseAction={savingBrandReleaseAction}
                  onPublish={handlePublishBrand}
                  onRestoreVersion={handleRestoreBrandVersion}
                  onBack={() => setRoute('brands')}
                  onOpenAudit={() => setRoute('audit-log')}
                />
              ) : route === 'skill-center' ? (
                <div className="fig-page">
                  <div className="fig-page__header">
                    <div className="fig-page__header-inner">
                      <div>
                        <h1>平台级 Skill</h1>
                        <p className="fig-page__description">管理平台预装 Skill 子集；云技能总库是唯一主数据来源。</p>
                      </div>
                      <div className="action-row">
                        <input
                          className="field-input"
                          placeholder="输入 cloud skill slug"
                          value={newPlatformSkillSlug}
                          onChange={(event) => setNewPlatformSkillSlug(event.target.value)}
                        />
                        <button
                          className="solid-button fig-button"
                          type="button"
                          disabled={savingPlatformSkill}
                          onClick={() => {
                            const cloudSkill = (overviewData?.cloudSkills || []).find((item) => item.slug === newPlatformSkillSlug.trim());
                            if (!cloudSkill) {
                              setError(`云技能中未找到 ${newPlatformSkillSlug.trim()}`);
                              return;
                            }
                            void handleSavePlatformSkill({
                              slug: cloudSkill.slug,
                              active: cloudSkill.active,
                              metadata: {
                                sourceType: 'platform-binding',
                                sourceCatalog: 'cloud-skills',
                                cloudSkillSlug: cloudSkill.slug,
                              },
                            });
                          }}
                        >
                          {savingPlatformSkill ? '处理中…' : '从云技能加入'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="fig-detail-stack">
                    <section className="fig-card fig-card--subtle">
                      <div className="fig-card__head">
                        <h3>筛选与当前对象</h3>
                        <span>筛选后直接在当前页编辑平台 Skill。</span>
                      </div>
                      <div className="form-grid form-grid--two">
                        <label className="fig-search field">
                          <span>搜索平台级 Skill</span>
                          <input className="field-input fig-search__input" placeholder="搜索名称 / slug / 分类..." value={capabilityQuery} onChange={(event) => setCapabilityQuery(event.target.value)} />
                        </label>
                        <label className="field">
                          <span>当前对象</span>
                          <select className="field-select" value={selectedPlatformSkill?.slug || filteredPlatformSkills[0]?.slug || ''} onChange={(event) => setSelectedPlatformSkillSlug(event.target.value)}>
                            {filteredPlatformSkills.map((item) => (
                              <option key={item.slug} value={item.slug}>
                                {item.name} · {item.category || '未分类'}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="fig-release-card__actions">
                        <span>{`${filteredPlatformSkills.length} 个平台预装 Skill`}</span>
                        <button className="ghost-button" type="button" onClick={() => setCapabilityQuery('')}>重置筛选</button>
                      </div>
                    </section>
                    <section className="fig-card fig-card--subtle">
                      <div className="fig-card__head">
                        <h3>统计区域</h3>
                        <span>帮助运营快速判断当前平台级 Skill 子集状态</span>
                      </div>
                      <div className="fig-meta-cards">
                        <div className="fig-meta-card"><span>Skill 总数</span><strong>{String(filteredPlatformSkills.length)}</strong></div>
                        <div className="fig-meta-card"><span>已启用</span><strong>{String(filteredPlatformSkills.filter((item) => item.active).length)}</strong></div>
                        <div className="fig-meta-card"><span>品牌连接</span><strong>{String(filteredPlatformSkills.reduce((sum, item) => sum + item.connectedBrands.length, 0))}</strong></div>
                        <div className="fig-meta-card"><span>当前选中</span><strong>{selectedPlatformSkill?.name || '未选择'}</strong></div>
                      </div>
                    </section>
                    <div className="fig-workspace fig-workspace--drawer">
                      <section className="fig-workspace__list">
                        <div className="fig-card fig-card--subtle">
                          <div className="fig-card__head">
                            <h3>Skill 列表</h3>
                            <span>列表卡片用于选择当前对象</span>
                          </div>
                          <div className="fig-capability-list">
                            {filteredPlatformSkills.length ? filteredPlatformSkills.map((item) => (
                              <button key={item.slug} className={`capability-card${selectedPlatformSkill?.slug === item.slug ? ' is-active' : ''}`} type="button" onClick={() => setSelectedPlatformSkillSlug(item.slug)}>
                                <strong>{item.name}</strong>
                                <span>{`${item.category || '未分类'} • ${item.connectedBrands.length} 个 OEM 生效`}</span>
                              </button>
                            )) : <div className="empty-state">还没有平台预装 Skill。</div>}
                          </div>
                        </div>
                      </section>
                      <aside className="fig-workspace__drawer">
                    {selectedPlatformSkill ? (
                      <>
                          <div className="fig-card">
                            <div className="fig-card__head">
                              <div>
                                <h2>{selectedPlatformSkill.name}</h2>
                                <span>{`${selectedPlatformSkill.slug} · ${selectedPlatformSkill.publisher || 'iClaw'}`}</span>
                              </div>
                              <div className="metric-chips">
                                <span>{selectedPlatformSkill.active ? '已上架' : '已下架'}</span>
                                <span>{`${selectedPlatformSkill.connectedBrands.length} 个 OEM 生效`}</span>
                              </div>
                            </div>
                            <p className="detail-copy">{selectedPlatformSkill.description || '暂无描述。'}</p>
                            <div className="fig-meta-cards">
                              <div className="fig-meta-card"><span>分类</span><strong>{selectedPlatformSkill.category || '未分类'}</strong></div>
                              <div className="fig-meta-card"><span>版本</span><strong>{selectedPlatformSkill.version || '-'}</strong></div>
                              <div className="fig-meta-card"><span>发布者</span><strong>{selectedPlatformSkill.publisher || '未知'}</strong></div>
                            </div>
                            <section className="fig-card fig-card--subtle" style={{ marginTop: 16 }}>
                              <div className="fig-card__head">
                                <h3>Binding Metadata</h3>
                                <span>平台预装 Skill binding 的附加字段</span>
                              </div>
                              <textarea className="code-input code-input--tall" value={platformSkillMetadataText} onChange={(event) => setPlatformSkillMetadataText(event.target.value)} />
                            </section>
                            <div className="fig-release-card__actions">
                              <button
                                className="solid-button"
                                type="button"
                                disabled={savingPlatformSkill}
                                onClick={() =>
                                  void (() => {
                                    try {
                                      const metadata = asObject(platformSkillMetadataText ? JSON.parse(platformSkillMetadataText) : {});
                                      return handleSavePlatformSkill({
                                        slug: selectedPlatformSkill.slug,
                                        active: !selectedPlatformSkill.active,
                                        metadata,
                                      });
                                    } catch (parseError) {
                                      setError(parseError instanceof Error ? parseError.message : 'Skill metadata JSON 解析失败');
                                      return Promise.resolve();
                                    }
                                  })()
                                }
                              >
                                {savingPlatformSkill ? '处理中…' : selectedPlatformSkill.active ? '停用' : '启用'}
                              </button>
                              <button
                                className="ghost-button"
                                type="button"
                                disabled={savingPlatformSkill}
                                onClick={() =>
                                  void (() => {
                                    try {
                                      const metadata = asObject(platformSkillMetadataText ? JSON.parse(platformSkillMetadataText) : {});
                                      return handleSavePlatformSkill({
                                        slug: selectedPlatformSkill.slug,
                                        active: selectedPlatformSkill.active,
                                        metadata,
                                      });
                                    } catch (parseError) {
                                      setError(parseError instanceof Error ? parseError.message : 'Skill metadata JSON 解析失败');
                                      return Promise.resolve();
                                    }
                                  })()
                                }
                              >
                                保存 Metadata
                              </button>
                              <button
                                className="ghost-button"
                                type="button"
                                disabled={savingPlatformSkill}
                                onClick={() => void handleDeletePlatformSkill(selectedPlatformSkill.slug)}
                              >
                                移出平台预装
                              </button>
                            </div>
                          </div>
                          <section className="fig-card fig-card--subtle">
                            <div className="fig-card__head">
                              <h3>品牌连接图</h3>
                              <span>按品牌查看能力开放范围</span>
                            </div>
                            <div className="chip-grid">
                              {selectedPlatformSkill.connectedBrands.length ? selectedPlatformSkill.connectedBrands.map((brand) => (
                                <button key={brand.brandId} className="chip chip--interactive" type="button" onClick={() => openBrandDetail(brand.brandId)}>
                                  {brand.displayName}
                                </button>
                              )) : <div className="empty-state">当前没有 OEM 绑定此 Skill。</div>}
                            </div>
                          </section>
                      </>
                    ) : <div className="fig-card fig-card--detail-empty"><div className="empty-state">还没有平台预装 Skill。</div></div>}
                      </aside>
                    </div>
                  </div>
                </div>
              ) : route === 'mcp-center' ? (
                <div className="fig-page">
                  <div className="fig-page__header">
                    <div className="fig-page__header-inner">
                      <div>
                        <h1>平台级 MCP</h1>
                        <p className="fig-page__description">管理平台级 MCP 预装子集；云MCP 总库是唯一主数据来源。</p>
                      </div>
                      <div className="action-row">
                        <input
                          className="field-input"
                          placeholder="输入 cloud MCP key"
                          value={newPlatformMcpKey}
                          onChange={(event) => setNewPlatformMcpKey(event.target.value)}
                        />
                        <button
                          className="solid-button fig-button"
                          type="button"
                          disabled={savingPlatformMcp}
                          onClick={() => {
                            const cloudMcp = (overviewData?.cloudMcps || []).find((item) => item.key === newPlatformMcpKey.trim());
                            if (!cloudMcp) {
                              setError(`云MCP总库中未找到 ${newPlatformMcpKey.trim()}`);
                              return;
                            }
                            void handleSavePlatformMcp({
                              key: cloudMcp.key,
                              active: cloudMcp.enabled,
                              metadata: {
                                ...(cloudMcp.metadata || {}),
                                sourceType: 'cloud-mcp-import',
                                sourceCatalog: 'cloud-mcps',
                                cloudMcpKey: cloudMcp.key,
                              },
                            });
                          }}
                        >
                          {savingPlatformMcp ? '处理中…' : '从云MCP加入'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="fig-detail-stack">
                    <section className="fig-card fig-card--subtle">
                      <div className="fig-card__head">
                        <h3>筛选与当前对象</h3>
                        <span>筛选后直接在当前页编辑平台 MCP。</span>
                      </div>
                      <div className="form-grid form-grid--two">
                        <label className="fig-search field">
                          <span>搜索平台级 MCP</span>
                          <input className="field-input fig-search__input" placeholder="搜索名称 / key / transport..." value={capabilityQuery} onChange={(event) => setCapabilityQuery(event.target.value)} />
                        </label>
                        <label className="field">
                          <span>当前对象</span>
                          <select className="field-select" value={selectedPlatformMcp?.key || filteredPlatformMcps[0]?.key || ''} onChange={(event) => setSelectedPlatformMcpKey(event.target.value)}>
                            {filteredPlatformMcps.map((item) => (
                              <option key={item.key} value={item.key}>
                                {item.name} · {item.transport}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="fig-release-card__actions">
                        <span>{`${filteredPlatformMcps.length} 个平台级 MCP`}</span>
                        <button className="ghost-button" type="button" onClick={() => setCapabilityQuery('')}>重置筛选</button>
                      </div>
                    </section>
                    <section className="fig-card fig-card--subtle">
                      <div className="fig-card__head">
                        <h3>统计区域</h3>
                        <span>帮助运营快速判断当前平台级 MCP 子集状态</span>
                      </div>
                      <div className="fig-meta-cards">
                        <div className="fig-meta-card"><span>MCP 总数</span><strong>{String(filteredPlatformMcps.length)}</strong></div>
                        <div className="fig-meta-card"><span>已启用</span><strong>{String(filteredPlatformMcps.filter((item) => item.active).length)}</strong></div>
                        <div className="fig-meta-card"><span>品牌连接</span><strong>{String(filteredPlatformMcps.reduce((sum, item) => sum + item.connectedBrands.length, 0))}</strong></div>
                        <div className="fig-meta-card"><span>当前选中</span><strong>{selectedPlatformMcp?.name || '未选择'}</strong></div>
                      </div>
                    </section>
                    <div className="fig-workspace fig-workspace--drawer">
                      <section className="fig-workspace__list">
                        <div className="fig-card fig-card--subtle">
                          <div className="fig-card__head">
                            <h3>MCP 列表</h3>
                            <span>列表卡片用于选择当前对象</span>
                          </div>
                          <div className="fig-capability-list">
                            {filteredPlatformMcps.length ? filteredPlatformMcps.map((item) => (
                              <button key={item.key} className={`capability-card${selectedPlatformMcp?.key === item.key ? ' is-active' : ''}`} type="button" onClick={() => setSelectedPlatformMcpKey(item.key)}>
                                <strong>{item.name}</strong>
                                <span>{`${item.transport} • ${item.connectedBrands.length} 个 OEM 生效`}</span>
                              </button>
                            )) : <div className="empty-state">还没有平台级 MCP。</div>}
                          </div>
                        </div>
                      </section>
                      <aside className="fig-workspace__drawer">
                    {selectedPlatformMcp ? (
                      <>
                          <div className="fig-card">
                            <div className="fig-card__head">
                              <div>
                                <h2>{selectedPlatformMcp.name}</h2>
                                <span>{selectedPlatformMcp.key}</span>
                              </div>
                              <div className="metric-chips">
                                <span>{selectedPlatformMcp.active ? '目录可用' : '目录关闭'}</span>
                                <span>{selectedPlatformMcp.transport}</span>
                              </div>
                            </div>
                            <p className="detail-copy">{selectedPlatformMcp.description || '暂无描述。'}</p>
                            <div className="fig-meta-cards">
                              <div className="fig-meta-card"><span>Transport</span><strong>{selectedPlatformMcp.transport || 'config'}</strong></div>
                              <div className="fig-meta-card"><span>Command</span><strong>{selectedPlatformMcp.command || '未声明'}</strong></div>
                              <div className="fig-meta-card"><span>HTTP URL</span><strong>{selectedPlatformMcp.httpUrl || '未声明'}</strong></div>
                              <div className="fig-meta-card"><span>环境变量</span><strong>{String(selectedPlatformMcp.envKeys?.length || 0)}</strong></div>
                            </div>
                            <section className="fig-card fig-card--subtle" style={{ marginTop: 16 }}>
                              <div className="fig-card__head">
                                <h3>Binding Metadata</h3>
                                <span>平台级 MCP binding 的附加字段</span>
                              </div>
                              <textarea className="code-input code-input--tall" value={platformMcpMetadataText} onChange={(event) => setPlatformMcpMetadataText(event.target.value)} />
                            </section>
                            <div className="fig-release-card__actions">
                              <button
                                className="solid-button"
                                type="button"
                                disabled={savingPlatformMcp}
                                onClick={() =>
                                  void (() => {
                                    try {
                                      const metadata = asObject(platformMcpMetadataText ? JSON.parse(platformMcpMetadataText) : {});
                                      return handleSavePlatformMcp({
                                        key: selectedPlatformMcp.key,
                                        active: !selectedPlatformMcp.active,
                                        metadata,
                                      });
                                    } catch (parseError) {
                                      setError(parseError instanceof Error ? parseError.message : 'MCP metadata JSON 解析失败');
                                      return Promise.resolve();
                                    }
                                  })()
                                }
                              >
                                {savingPlatformMcp ? '处理中…' : selectedPlatformMcp.active ? '停用' : '启用'}
                              </button>
                              <button
                                className="ghost-button"
                                type="button"
                                disabled={savingPlatformMcp}
                                onClick={() =>
                                  void (() => {
                                    try {
                                      const metadata = asObject(platformMcpMetadataText ? JSON.parse(platformMcpMetadataText) : {});
                                      return handleSavePlatformMcp({
                                        key: selectedPlatformMcp.key,
                                        active: selectedPlatformMcp.active,
                                        metadata,
                                      });
                                    } catch (parseError) {
                                      setError(parseError instanceof Error ? parseError.message : 'MCP metadata JSON 解析失败');
                                      return Promise.resolve();
                                    }
                                  })()
                                }
                              >
                                保存 Metadata
                              </button>
                              <button
                                className="ghost-button"
                                type="button"
                                disabled={savingPlatformMcp}
                                onClick={() =>
                                  void handleTestCloudMcp({
                                    key: selectedPlatformMcp.key,
                                    name: selectedPlatformMcp.name,
                                    description: selectedPlatformMcp.description,
                                    transport: selectedPlatformMcp.transport,
                                    objectKey: selectedPlatformMcp.objectKey || '',
                                    enabled: selectedPlatformMcp.active,
                                    command: selectedPlatformMcp.command || '',
                                    argsText: '',
                                    httpUrl: selectedPlatformMcp.httpUrl || '',
                                    envText: (selectedPlatformMcp.envKeys || []).map((key) => `${key}=`).join('\n'),
                                    metadataText: platformMcpMetadataText,
                                  })
                                }
                              >
                                测试连接
                              </button>
                              <button
                                className="ghost-button"
                                type="button"
                                disabled={savingPlatformMcp}
                                onClick={() => void handleDeletePlatformMcp(selectedPlatformMcp.key)}
                              >
                                移出平台级 MCP
                              </button>
                            </div>
                          </div>
                          <section className="fig-card fig-card--subtle">
                            <div className="fig-card__head">
                              <h3>品牌连接图</h3>
                              <span>按品牌查看能力开放范围</span>
                            </div>
                            <div className="chip-grid">
                              {selectedPlatformMcp.connectedBrands.length ? selectedPlatformMcp.connectedBrands.map((brand) => (
                                <button key={brand.brandId} className="chip chip--interactive" type="button" onClick={() => openBrandDetail(brand.brandId)}>
                                  {brand.displayName}
                                </button>
                              )) : <div className="empty-state">当前没有 OEM 绑定此 MCP。</div>}
                            </div>
                          </section>
                      </>
                    ) : <div className="fig-card fig-card--detail-empty"><div className="empty-state">还没有平台级 MCP。</div></div>}
                      </aside>
                    </div>
                  </div>
                </div>
              ) : route === 'model-center' ? (
                <ModelCenterPage
                  brands={overviewData?.brands || []}
                  capabilityQuery={capabilityQuery}
                  setCapabilityQuery={setCapabilityQuery}
                  filteredPlatformModels={filteredPlatformModels}
                  selectedPlatformModel={selectedPlatformModel}
                  selectedPlatformModelRef={selectedPlatformModelRef}
                  setSelectedPlatformModelRef={setSelectedPlatformModelRef}
                  platformModelDraft={platformModelDraft}
                  setPlatformModelDraft={setPlatformModelDraft}
                  savingPlatformModel={savingPlatformModel}
                  handleSavePlatformModel={() => void handleSavePlatformModel()}
                  handleDeletePlatformModel={(ref) => void handleDeletePlatformModel(ref)}
                  openBrandDetail={openBrandDetail}
                  overviewData={overviewData}
                  selectedModelProviderTab={selectedModelProviderTab}
                  setSelectedModelProviderTab={setSelectedModelProviderTab}
                  selectedModelCenterSection={selectedModelCenterSection}
                  setSelectedModelCenterSection={setSelectedModelCenterSection}
                  selectedProviderScopeType={selectedProviderScopeType}
                  selectedProviderScopeKey={selectedProviderScopeKey}
                  providerDraft={providerDraft}
                  setProviderDraft={setProviderDraft}
                  savingModelProviderProfile={savingModelProviderProfile}
                  handleSaveModelProviderProfile={() => void handleSaveModelProviderProfile()}
                  handleRestorePlatformProvider={() => void handleRestorePlatformProvider()}
                  memoryDraft={memoryDraft}
                  setMemoryDraft={setMemoryDraft}
                  savingMemoryEmbeddingProfile={savingMemoryEmbeddingProfile}
                  handleSaveMemoryEmbedding={() => void handleSaveMemoryEmbedding()}
                  handleTestMemoryEmbedding={() => void handleTestMemoryEmbedding()}
                  handleRestorePlatformMemory={() => void handleRestorePlatformMemory()}
                  memoryEmbeddingTestResult={memoryEmbeddingTestResult}
                />
              ) : route === 'runtime-management' ? (
                <div className="fig-page">
                  <div className="fig-page__header">
                    <div className="fig-page__header-inner">
                      <div>
                        <h1>Runtime包管理</h1>
                        <p className="fig-page__description">独立管理 runtime 包发布、平台/OEM 绑定关系，以及历史切换记录。</p>
                      </div>
                    </div>
                  </div>
                  <div className="fig-page__body">
                    <section className="fig-guide fig-guide--releases">
                      <div className="fig-guide__head">
                        <span className="fig-guide__eyebrow">操作指南</span>
                        <h3>Runtime包管理怎么用</h3>
                      </div>
                      <div className="fig-guide__grid">
                        {[
                          'Release 负责登记每个 runtime 包的版本、平台、下载地址和构建信息。',
                          'Binding 负责把平台或某个 OEM 应用绑定到一个已发布的 runtime release。',
                          '列表、发布、绑定和历史切换都已在 React 版闭环。',
                        ].map((item, index) => (
                          <article key={item} className="fig-guide__item">
                            <span className="fig-guide__index">{index + 1}</span>
                            <p>{item}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                    <section className="fig-card fig-card--subtle">
                      <div className="fig-card__head">
                        <h3>配置视图</h3>
                        <span>Release / Binding / History</span>
                      </div>
                      <div className="segmented">
                        <button className={`tab-pill${runtimeSection === 'release' ? ' is-active' : ''}`} type="button" onClick={() => setRuntimeSection('release')}>Release</button>
                        <button className={`tab-pill${runtimeSection === 'binding' ? ' is-active' : ''}`} type="button" onClick={() => setRuntimeSection('binding')}>Binding</button>
                        <button className={`tab-pill${runtimeSection === 'history' ? ' is-active' : ''}`} type="button" onClick={() => setRuntimeSection('history')}>History</button>
                      </div>
                    </section>
                    {runtimeSection === 'release' ? (
                      <div className="fig-detail-stack">
                        <section className="fig-card fig-card--subtle">
                          <div className="fig-card__head">
                            <div>
                              <h3>Runtime Bootstrap Source</h3>
                              <span>兼容当前已经在对象存储上的 runtime 包</span>
                            </div>
                            <div className="action-row">
                              <button className="ghost-button" type="button" disabled={savingRuntimeRelease} onClick={() => void (async () => {
                                setSavingRuntimeRelease(true);
                                setError('');
                                try {
                                  const refreshed = await loadOverviewData();
                                  setOverviewData(refreshed);
                                } catch (refreshError) {
                                  setError(refreshError instanceof Error ? refreshError.message : 'runtime bootstrap 刷新失败');
                                } finally {
                                  setSavingRuntimeRelease(false);
                                }
                              })()}>
                                刷新源预览
                              </button>
                              <button className="ghost-button" type="button" disabled={savingRuntimeRelease} onClick={() => void handleImportRuntimeBootstrap()}>
                                {savingRuntimeRelease ? '导入中…' : '导入到 Runtime Center'}
                              </button>
                            </div>
                          </div>
                          <div className="fig-meta-cards">
                            <div className="fig-meta-card"><span>Source Path</span><strong>{overviewData?.runtimeBootstrapSource?.sourcePath || '未找到'}</strong></div>
                            <div className="fig-meta-card"><span>Version</span><strong>{overviewData?.runtimeBootstrapSource?.version || '未找到'}</strong></div>
                            <div className="fig-meta-card"><span>Artifacts</span><strong>{String(overviewData?.runtimeBootstrapSource?.artifacts.length || 0)}</strong></div>
                          </div>
                          <div className="fig-toolbar">
                            <label className="field">
                              <span>导入到哪个 Channel</span>
                              <select className="field-select" value={selectedRuntimeImportChannel} onChange={(event) => setSelectedRuntimeImportChannel(event.target.value === 'dev' ? 'dev' : 'prod')}>
                                <option value="prod">prod</option>
                                <option value="dev">dev</option>
                              </select>
                            </label>
                            <label className="field">
                              <span>导入后自动绑定</span>
                              <select className="field-select" value={selectedRuntimeImportBindScopeType} onChange={(event) => setSelectedRuntimeImportBindScopeType(event.target.value as 'none' | 'platform' | 'app')}>
                                <option value="none">只导入 Release</option>
                                <option value="platform">绑定到平台默认</option>
                                <option value="app">绑定到 OEM</option>
                              </select>
                            </label>
                            <label className="field" style={selectedRuntimeImportBindScopeType === 'app' ? undefined : { opacity: 0.55 }}>
                              <span>OEM 应用</span>
                              <select className="field-select" value={selectedRuntimeImportBindScopeKey} disabled={selectedRuntimeImportBindScopeType !== 'app'} onChange={(event) => setSelectedRuntimeImportBindScopeKey(event.target.value)}>
                                <option value="">请选择 OEM</option>
                                {(overviewData?.brands || []).map((brand) => (
                                  <option key={brand.brandId} value={brand.brandId}>
                                    {brand.displayName}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="fig-list">
                            {overviewData?.runtimeBootstrapSource?.artifacts.length ? (
                              overviewData.runtimeBootstrapSource.artifacts.map((item) => (
                                <div key={item.targetTriple} className="fig-list-item">
                                  <div style={{ width: '100%' }}>
                                    <div className="fig-list-item__title">{`${item.targetTriple} · ${item.platform}/${item.arch}`}</div>
                                    <div className="fig-list-item__body" style={{ wordBreak: 'break-all' }}>{item.artifactUrl}</div>
                                    <div className="fig-list-item__meta">
                                      <span>{item.artifactFormat || 'tar.gz'}</span>
                                      <span>{item.objectKey || 'object_key 未解析'}</span>
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="empty-state empty-state--panel">当前 runtime bootstrap source 没有可导入 artifact。</div>
                            )}
                          </div>
                        </section>
                        <section className="fig-card fig-card--subtle">
                          <div className="fig-card__head">
                            <div>
                              <h3>Release 列表</h3>
                              <span>{String(overviewData?.runtimeReleases.length || 0)} 条</span>
                            </div>
                            <button className="ghost-button" type="button" onClick={() => {
                              setSelectedRuntimeReleaseId('');
                              setRuntimeReleaseDraft({
                                id: '',
                                runtimeKind: 'openclaw',
                                version: '',
                                channel: 'prod',
                                platform: 'darwin',
                                arch: 'aarch64',
                                artifactUrl: '',
                                bucketName: '',
                                objectKey: '',
                                artifactSha256: '',
                                artifactSizeBytes: 0,
                                launcherRelativePath: '',
                                gitCommit: '',
                                gitTag: '',
                                releaseVersion: '',
                                buildTime: '',
                                status: 'draft',
                              });
                            }}>
                              新建 Release
                            </button>
                          </div>
                          <div className="fig-list">
                            {(overviewData?.runtimeReleases || []).length ? (
                              overviewData.runtimeReleases.map((item) => (
                                <button key={item.id} className="fig-list-item" type="button" onClick={() => setSelectedRuntimeReleaseId(item.id)}>
                                  <div style={{ textAlign: 'left', width: '100%' }}>
                                    <div className="fig-list-item__title">{`${item.version} · ${item.channel}`}</div>
                                    <div className="fig-list-item__body">{`${item.platform}/${item.arch} · ${item.targetTriple}`}</div>
                                    <div className="fig-list-item__meta">
                                      <span>{item.status}</span>
                                      <span>{item.runtimeKind}</span>
                                      <span>{formatDateTime(item.updatedAt)}</span>
                                    </div>
                                  </div>
                                </button>
                              ))
                            ) : <div className="empty-state empty-state--panel">还没有 runtime release。</div>}
                          </div>
                        </section>
                        <section className="fig-card fig-card--subtle">
                          <div className="fig-card__head">
                            <h3>{runtimeReleaseDraft.id ? '编辑 Release' : '新建 Release'}</h3>
                            <span>{computeRuntimeTargetTriple(runtimeReleaseDraft.platform, runtimeReleaseDraft.arch) || '未识别 target triple'}</span>
                          </div>
                          <div className="form-grid form-grid--two">
                            <label className="field"><span>Runtime Kind</span><input className="field-input" value={runtimeReleaseDraft.runtimeKind} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, runtimeKind: event.target.value }))} /></label>
                            <label className="field"><span>Version</span><input className="field-input" value={runtimeReleaseDraft.version} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, version: event.target.value }))} /></label>
                            <label className="field"><span>Channel</span><select className="field-select" value={runtimeReleaseDraft.channel} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, channel: event.target.value }))}><option value="prod">prod</option><option value="dev">dev</option></select></label>
                            <label className="field"><span>Status</span><select className="field-select" value={runtimeReleaseDraft.status} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, status: event.target.value }))}><option value="draft">draft</option><option value="published">published</option><option value="deprecated">deprecated</option><option value="archived">archived</option></select></label>
                            <label className="field"><span>Platform</span><select className="field-select" value={runtimeReleaseDraft.platform} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, platform: event.target.value }))}><option value="darwin">darwin</option><option value="windows">windows</option><option value="linux">linux</option></select></label>
                            <label className="field"><span>Arch</span><select className="field-select" value={runtimeReleaseDraft.arch} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, arch: event.target.value }))}><option value="aarch64">aarch64</option><option value="x64">x64</option></select></label>
                            <label className="field field--wide"><span>Artifact URL</span><input className="field-input" value={runtimeReleaseDraft.artifactUrl} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, artifactUrl: event.target.value }))} /></label>
                            <label className="field"><span>Bucket</span><input className="field-input" value={runtimeReleaseDraft.bucketName} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, bucketName: event.target.value }))} /></label>
                            <label className="field"><span>Object Key</span><input className="field-input" value={runtimeReleaseDraft.objectKey} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, objectKey: event.target.value }))} /></label>
                            <label className="field"><span>SHA256</span><input className="field-input" value={runtimeReleaseDraft.artifactSha256} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, artifactSha256: event.target.value }))} /></label>
                            <label className="field"><span>Size Bytes</span><input className="field-input" type="number" min="0" value={runtimeReleaseDraft.artifactSizeBytes} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, artifactSizeBytes: Number(event.target.value || 0) }))} /></label>
                            <label className="field"><span>Launcher Path</span><input className="field-input" value={runtimeReleaseDraft.launcherRelativePath} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, launcherRelativePath: event.target.value }))} /></label>
                            <label className="field"><span>Git Commit</span><input className="field-input" value={runtimeReleaseDraft.gitCommit} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, gitCommit: event.target.value }))} /></label>
                            <label className="field"><span>Git Tag</span><input className="field-input" value={runtimeReleaseDraft.gitTag} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, gitTag: event.target.value }))} /></label>
                            <label className="field"><span>Release Version</span><input className="field-input" value={runtimeReleaseDraft.releaseVersion} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, releaseVersion: event.target.value }))} /></label>
                            <label className="field"><span>Build Time</span><input className="field-input" value={runtimeReleaseDraft.buildTime} onChange={(event) => setRuntimeReleaseDraft((current) => ({ ...current, buildTime: event.target.value }))} /></label>
                          </div>
                          <div className="fig-release-card__actions">
                            <button className="solid-button" type="button" disabled={savingRuntimeRelease} onClick={() => void handleSaveRuntimeRelease()}>
                              {savingRuntimeRelease ? '保存中…' : '保存 Release'}
                            </button>
                          </div>
                        </section>
                        {selectedRuntimeRelease ? (
                          <section className="fig-card fig-card--subtle">
                            <div className="fig-card__head">
                              <h3>{selectedRuntimeRelease.version}</h3>
                              <span>{`${selectedRuntimeRelease.channel} · ${selectedRuntimeRelease.targetTriple}`}</span>
                            </div>
                            <div className="fig-meta-cards">
                              <div className="fig-meta-card"><span>Status</span><strong>{selectedRuntimeRelease.status}</strong></div>
                              <div className="fig-meta-card"><span>Runtime Kind</span><strong>{selectedRuntimeRelease.runtimeKind}</strong></div>
                              <div className="fig-meta-card"><span>Artifact URL</span><strong>{selectedRuntimeRelease.artifactUrl || '未记录'}</strong></div>
                            </div>
                          </section>
                        ) : null}
                      </div>
                    ) : null}
                    {runtimeSection === 'binding' ? (
                      <div className="fig-detail-stack">
                        <section className="fig-card fig-card--subtle">
                          <div className="fig-card__head">
                            <div>
                              <h3>Binding 列表</h3>
                              <span>{String(overviewData?.runtimeBindings.length || 0)} 条</span>
                            </div>
                            <button className="ghost-button" type="button" onClick={() => {
                              setSelectedRuntimeBindingId('');
                              setRuntimeBindingDraft({
                                id: '',
                                scopeType: 'platform',
                                scopeKey: 'platform',
                                runtimeKind: 'openclaw',
                                channel: 'prod',
                                platform: 'darwin',
                                arch: 'aarch64',
                                releaseId: '',
                                enabled: true,
                                changeReason: '',
                              });
                            }}>
                              新建 Binding
                            </button>
                          </div>
                          <div className="fig-list">
                            {(overviewData?.runtimeBindings || []).length ? (
                              overviewData.runtimeBindings.map((item) => (
                                <button key={item.id} className="fig-list-item" type="button" onClick={() => setSelectedRuntimeBindingId(item.id)}>
                                  <div style={{ textAlign: 'left', width: '100%' }}>
                                    <div className="fig-list-item__title">{`${item.scopeType === 'platform' ? '平台' : item.scopeKey} · ${item.channel}`}</div>
                                    <div className="fig-list-item__body">{`${item.platform}/${item.arch} · ${item.targetTriple}`}</div>
                                    <div className="fig-list-item__meta">
                                      <span>{item.enabled ? 'enabled' : 'disabled'}</span>
                                      <span>{item.runtimeKind}</span>
                                      <span>{formatDateTime(item.updatedAt)}</span>
                                    </div>
                                  </div>
                                </button>
                              ))
                            ) : <div className="empty-state empty-state--panel">还没有 runtime binding。</div>}
                          </div>
                        </section>
                        <section className="fig-card fig-card--subtle">
                          <div className="fig-card__head">
                            <h3>{runtimeBindingDraft.id ? '编辑 Binding' : '新建 Binding'}</h3>
                            <span>{computeRuntimeTargetTriple(runtimeBindingDraft.platform, runtimeBindingDraft.arch) || '未识别 target triple'}</span>
                          </div>
                          <div className="form-grid form-grid--two">
                            <label className="field"><span>Scope</span><select className="field-select" value={runtimeBindingDraft.scopeType} onChange={(event) => setRuntimeBindingDraft((current) => ({ ...current, scopeType: event.target.value }))}><option value="platform">platform</option><option value="app">app</option></select></label>
                            <label className="field"><span>OEM 应用</span><select className="field-select" disabled={runtimeBindingDraft.scopeType !== 'app'} value={runtimeBindingDraft.scopeType === 'platform' ? 'platform' : runtimeBindingDraft.scopeKey} onChange={(event) => setRuntimeBindingDraft((current) => ({ ...current, scopeKey: event.target.value }))}><option value="platform">platform</option>{(overviewData?.brands || []).map((brand) => <option key={brand.brandId} value={brand.brandId}>{brand.displayName}</option>)}</select></label>
                            <label className="field"><span>Runtime Kind</span><input className="field-input" value={runtimeBindingDraft.runtimeKind} onChange={(event) => setRuntimeBindingDraft((current) => ({ ...current, runtimeKind: event.target.value }))} /></label>
                            <label className="field"><span>Channel</span><select className="field-select" value={runtimeBindingDraft.channel} onChange={(event) => setRuntimeBindingDraft((current) => ({ ...current, channel: event.target.value }))}><option value="prod">prod</option><option value="dev">dev</option></select></label>
                            <label className="field"><span>Platform</span><select className="field-select" value={runtimeBindingDraft.platform} onChange={(event) => setRuntimeBindingDraft((current) => ({ ...current, platform: event.target.value }))}><option value="darwin">darwin</option><option value="windows">windows</option><option value="linux">linux</option></select></label>
                            <label className="field"><span>Arch</span><select className="field-select" value={runtimeBindingDraft.arch} onChange={(event) => setRuntimeBindingDraft((current) => ({ ...current, arch: event.target.value }))}><option value="aarch64">aarch64</option><option value="x64">x64</option></select></label>
                            <label className="field field--wide"><span>Release ID</span><select className="field-select" value={runtimeBindingDraft.releaseId} onChange={(event) => setRuntimeBindingDraft((current) => ({ ...current, releaseId: event.target.value }))}><option value="">请选择已发布 release</option>{(overviewData?.runtimeReleases || []).map((item) => <option key={item.id} value={item.id}>{`${item.version} · ${item.channel} · ${item.platform}/${item.arch}`}</option>)}</select></label>
                            <label className="field field--wide"><span>切换原因</span><textarea className="field-textarea" rows={3} value={runtimeBindingDraft.changeReason} onChange={(event) => setRuntimeBindingDraft((current) => ({ ...current, changeReason: event.target.value }))} /></label>
                            <label className="field" style={{ maxWidth: 180 }}><span>Enabled</span><input type="checkbox" checked={runtimeBindingDraft.enabled} onChange={(event) => setRuntimeBindingDraft((current) => ({ ...current, enabled: event.target.checked }))} /></label>
                          </div>
                          <div className="fig-release-card__actions">
                            <button className="solid-button" type="button" disabled={savingRuntimeBinding} onClick={() => void handleSaveRuntimeBinding()}>
                              {savingRuntimeBinding ? '保存中…' : '保存 Binding'}
                            </button>
                          </div>
                        </section>
                        {selectedRuntimeBinding ? (
                          <section className="fig-card fig-card--subtle">
                            <div className="fig-card__head">
                              <h3>{selectedRuntimeBinding.scopeType === 'platform' ? '平台默认' : selectedRuntimeBinding.scopeKey}</h3>
                              <span>{`${selectedRuntimeBinding.channel} · ${selectedRuntimeBinding.targetTriple}`}</span>
                            </div>
                            <div className="fig-meta-cards">
                              <div className="fig-meta-card"><span>Release ID</span><strong>{selectedRuntimeBinding.releaseId || '未绑定'}</strong></div>
                              <div className="fig-meta-card"><span>状态</span><strong>{selectedRuntimeBinding.enabled ? 'enabled' : 'disabled'}</strong></div>
                              <div className="fig-meta-card"><span>切换原因</span><strong>{selectedRuntimeBinding.changeReason || '未记录'}</strong></div>
                            </div>
                          </section>
                        ) : null}
                      </div>
                    ) : null}
                    {runtimeSection === 'history' ? (
                      <section className="fig-card fig-card--subtle">
                        <div className="fig-card__head">
                          <div>
                            <h3>Binding History</h3>
                            <span>{selectedRuntimeBinding ? '当前选中 binding 的历史' : '全部历史'}</span>
                          </div>
                        </div>
                        <div className="fig-list">
                          {runtimeHistoryItems.length ? (
                            runtimeHistoryItems.map((item) => (
                              <div key={item.id} className="fig-list-item">
                                <div style={{ width: '100%' }}>
                                  <div className="fig-list-item__title">{`${item.scopeType === 'platform' ? '平台' : item.scopeKey} · ${item.channel} · ${item.targetTriple}`}</div>
                                  <div className="fig-list-item__body">{`从 ${item.fromReleaseId || '空'} 切到 ${item.toReleaseId || '空'}`}</div>
                                  <div className="fig-list-item__meta">
                                    <span>{item.runtimeKind}</span>
                                    <span>{formatDateTime(item.createdAt)}</span>
                                    {item.changeReason ? <span>{item.changeReason}</span> : null}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : <div className="empty-state empty-state--panel">还没有 runtime binding history。</div>}
                        </div>
                      </section>
                    ) : null}
                  </div>
                </div>
              ) : route === 'cloud-skills' ? (
                <div className="fig-page">
                  <div className="fig-page__header">
                    <div className="fig-page__header-inner">
                      <div>
                        <h1>云技能</h1>
                        <p className="fig-page__description">同步 ClawHub 和 GitHub 来源，直接维护技能商店主库。</p>
                      </div>
                      <div className="action-row">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() =>
                            setSkillSyncSourceDraft({
                              id: '',
                              sourceType: 'github_repo',
                              sourceKey: '',
                              displayName: '',
                              sourceUrl: '',
                              configText: '{}',
                              active: true,
                            })
                          }
                        >
                          新增同步源
                        </button>
                        {selectedSkillSyncSource ? (
                          <button className="solid-button fig-button" type="button" disabled={runningSkillSync} onClick={() => void handleRunSkillSync()}>
                            {runningSkillSync ? '同步中…' : '同步当前来源'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="page-stack">
                    <section className="fig-guide fig-guide--cloud">
                      <div className="fig-guide__head">
                        <span className="fig-guide__eyebrow">操作指南</span>
                        <h3>云技能怎么用</h3>
                      </div>
                      <div className="fig-guide__grid">
                        {[
                          '这里维护技能商店主库，支持从 ClawHub 或 GitHub 同步技能目录。',
                          '总库浏览、同步源维护和触发同步都已在 React 版完成。',
                          '云技能入库后，可先加入平台预装 Skill 子集，或直接做 OEM 增量装配。',
                        ].map((item, index) => (
                          <article key={item} className="fig-guide__item">
                            <span className="fig-guide__index">{index + 1}</span>
                            <p>{item}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                    <section className="fig-card">
                      <div className="fig-card__head">
                        <h2>主库概览</h2>
                        <span>技能商店直接读取这里的已上架技能</span>
                      </div>
                      <div className="fig-meta-cards">
                        <div className="fig-meta-card"><span>云技能</span><strong>{String(cloudSkillMeta.total || 0)}</strong></div>
                        <div className="fig-meta-card"><span>同步源</span><strong>{String(overviewData?.skillSyncSources.length || 0)}</strong></div>
                        <div className="fig-meta-card"><span>同步记录</span><strong>{String(overviewData?.skillSyncRuns.length || 0)}</strong></div>
                        <div className="fig-meta-card"><span>当前页</span><strong>{filteredCloudSkills.length ? `${(cloudSkillMeta.offset || 0) + 1}-${(cloudSkillMeta.offset || 0) + filteredCloudSkills.length}` : '0'}</strong></div>
                      </div>
                    </section>
                    <div className="fig-detail-stack">
                      <section className="fig-card fig-card--subtle">
                        <div className="fig-card__head">
                          <h3>统计区域</h3>
                          <span>帮助运营快速判断云技能主库当前状态</span>
                        </div>
                        <div className="fig-meta-cards">
                          <div className="fig-meta-card"><span>云技能总数</span><strong>{String(cloudSkillMeta.total || 0)}</strong></div>
                          <div className="fig-meta-card"><span>同步源</span><strong>{String(overviewData?.skillSyncSources.length || 0)}</strong></div>
                          <div className="fig-meta-card"><span>当前页技能</span><strong>{String(filteredCloudSkills.length)}</strong></div>
                          <div className="fig-meta-card"><span>当前选中</span><strong>{selectedCloudSkill?.name || '未选择'}</strong></div>
                        </div>
                      </section>
                      <section className="fig-card fig-card--subtle">
                        <div className="fig-card__head">
                          <h3>当前对象</h3>
                          <span>当前页直接切换同步源和云技能对象。</span>
                        </div>
                        <div className="form-grid form-grid--two">
                          <label className="field">
                            <span>当前同步源</span>
                            <select className="field-select" value={selectedSkillSyncSource?.id || ''} onChange={(event) => setSelectedSkillSyncSourceId(event.target.value)}>
                              {(overviewData?.skillSyncSources || []).map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.displayName} · {item.sourceType}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field">
                            <span>当前云技能</span>
                            <select className="field-select" value={selectedCloudSkill?.slug || ''} onChange={(event) => setSelectedCloudSkillSlug(event.target.value)}>
                              {filteredCloudSkills.map((item) => (
                                <option key={item.slug} value={item.slug}>
                                  {item.name} · v{item.version}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </section>
                      <div className="fig-workspace fig-workspace--drawer">
                        <section className="fig-workspace__list">
                          <section className="fig-card fig-card--subtle">
                            <div className="fig-card__head">
                              <h3>同步源编辑</h3>
                              <span>列表卡片切对象，当前页维护同步源主数据。</span>
                            </div>
                            <div className="form-grid form-grid--two">
                              <label className="field">
                                <span>Source Type</span>
                                <select className="field-select" value={skillSyncSourceDraft.sourceType} onChange={(event) => setSkillSyncSourceDraft((current) => ({ ...current, sourceType: event.target.value }))}>
                                  <option value="github_repo">GitHub Repo</option>
                                  <option value="clawhub">ClawHub</option>
                                </select>
                              </label>
                              <label className="field">
                                <span>Source Key</span>
                                <input className="field-input" value={skillSyncSourceDraft.sourceKey} onChange={(event) => setSkillSyncSourceDraft((current) => ({ ...current, sourceKey: event.target.value }))} />
                              </label>
                              <label className="field">
                                <span>Display Name</span>
                                <input className="field-input" value={skillSyncSourceDraft.displayName} onChange={(event) => setSkillSyncSourceDraft((current) => ({ ...current, displayName: event.target.value }))} />
                              </label>
                              <label className="field">
                                <span>Source URL</span>
                                <input className="field-input" value={skillSyncSourceDraft.sourceUrl} onChange={(event) => setSkillSyncSourceDraft((current) => ({ ...current, sourceUrl: event.target.value }))} />
                              </label>
                              <label className="field field--wide">
                                <span>Config JSON</span>
                                <textarea className="code-input code-input--tall" rows={6} value={skillSyncSourceDraft.configText} onChange={(event) => setSkillSyncSourceDraft((current) => ({ ...current, configText: event.target.value }))} />
                              </label>
                              <label className="field" style={{ maxWidth: 180 }}>
                                <span>Active</span>
                                <input type="checkbox" checked={skillSyncSourceDraft.active} onChange={(event) => setSkillSyncSourceDraft((current) => ({ ...current, active: event.target.checked }))} />
                              </label>
                            </div>
                            <div className="fig-release-card__actions">
                              <button className="solid-button" type="button" disabled={savingSkillSyncSource} onClick={() => void handleSaveSkillSyncSource()}>
                                {savingSkillSyncSource ? '保存中…' : '保存同步源'}
                              </button>
                            </div>
                          </section>
                          <section className="fig-card fig-card--subtle">
                            <div className="fig-card__head">
                              <h3>云技能列表</h3>
                              <span>{String(cloudSkillMeta.total || 0)} 个</span>
                            </div>
                            <div className="fig-toolbar">
                              <label className="fig-search fig-search--grow">
                                <input
                                  className="field-input fig-search__input"
                                  placeholder="搜索 slug / 名称 / 分类 / 发布者 / 标签..."
                                  value={cloudSkillQuery}
                                  onChange={(event) => setCloudSkillQuery(event.target.value)}
                                />
                              </label>
                              <button className="ghost-button" type="button" disabled={savingCloudSkill} onClick={() => void handleLoadCloudSkillsPage({ query: cloudSkillQuery, offset: 0 })}>
                                搜索
                              </button>
                              <button className="ghost-button" type="button" onClick={() => { setCloudSkillQuery(''); void handleLoadCloudSkillsPage({ query: '', offset: 0 }); }}>
                                清空
                              </button>
                              <button className="ghost-button" type="button" disabled={savingCloudSkill || cloudSkillMeta.offset <= 0} onClick={() => void handleLoadCloudSkillsPage({ query: cloudSkillQuery, offset: Math.max(0, cloudSkillMeta.offset - cloudSkillMeta.limit) })}>
                                上一页
                              </button>
                              <button className="ghost-button" type="button" disabled={savingCloudSkill || cloudSkillMeta.hasMore !== true} onClick={() => void handleLoadCloudSkillsPage({ query: cloudSkillQuery, offset: cloudSkillMeta.nextOffset || (cloudSkillMeta.offset + cloudSkillMeta.limit) })}>
                                下一页
                              </button>
                            </div>
                            <div className="fig-capability-list">
                              {filteredCloudSkills.length ? (
                                filteredCloudSkills.map((item) => (
                                  <button
                                    key={item.slug}
                                    className={`capability-card${selectedCloudSkill?.slug === item.slug ? ' is-active' : ''}`}
                                    type="button"
                                    onClick={() => setSelectedCloudSkillSlug(item.slug)}
                                  >
                                    <strong>{item.name}</strong>
                                    <span>{`v${item.version} • ${item.originType}`}</span>
                                  </button>
                                ))
                              ) : (
                                <div className="empty-state">没有匹配的云技能。</div>
                              )}
                            </div>
                          </section>
                        </section>
                        <aside className="fig-workspace__drawer">
                          {selectedCloudSkill ? (
                            <>
                            <div className="fig-card">
                              <div className="fig-card__head">
                                <div>
                                  <h2>{selectedCloudSkill.name}</h2>
                                  <span>{`${selectedCloudSkill.slug} · v${selectedCloudSkill.version}`}</span>
                                </div>
                                <div className="metric-chips">
                                  <span>{selectedCloudSkill.active ? '已上架' : '已下架'}</span>
                                </div>
                              </div>
                              <p className="detail-copy">{selectedCloudSkill.description || '暂无描述。'}</p>
                              <div className="fig-meta-cards">
                                <div className="fig-meta-card"><span>版本</span><strong>{`v${selectedCloudSkill.version}`}</strong></div>
                                <div className="fig-meta-card"><span>来源</span><strong>{selectedCloudSkill.originType || 'manual'}</strong></div>
                                <div className="fig-meta-card"><span>发布者</span><strong>{selectedCloudSkill.publisher || '未知'}</strong></div>
                                <div className="fig-meta-card"><span>安装配置</span><strong>{selectedCloudSkill.metadata.setup_schema || selectedCloudSkill.metadata.setupSchema ? '需配置' : '免配置'}</strong></div>
                              </div>
                              <div className="chip-grid">
                                {selectedCloudSkill.tags.length ? (
                                  selectedCloudSkill.tags.map((tag) => <span key={tag} className="chip">{tag}</span>)
                                ) : (
                                  <div className="empty-state">暂无标签。</div>
                                )}
                              </div>
                              <div className="action-row">
                                <button
                                  className="solid-button"
                                  type="button"
                                  disabled={savingCloudSkill}
                                  onClick={() => void handleSetCloudSkillEnabled(selectedCloudSkill.slug, !selectedCloudSkill.active)}
                                >
                                  {savingCloudSkill ? '处理中…' : selectedCloudSkill.active ? '下架' : '上架'}
                                </button>
                                {selectedCloudSkill.sourceUrl ? (
                                  <a className="text-button" href={selectedCloudSkill.sourceUrl} target="_blank" rel="noreferrer">
                                    查看来源
                                  </a>
                                ) : null}
                                {selectedCloudSkill.artifactUrl ? (
                                  <a className="text-button" href={selectedCloudSkill.artifactUrl} target="_blank" rel="noreferrer">
                                    查看 Artifact
                                  </a>
                                ) : null}
                              </div>
                            </div>
                            <section className="fig-card fig-card--subtle">
                              <div className="fig-card__head">
                                <h3>同步元数据</h3>
                                <span>先完整爬取，后续按需消费</span>
                              </div>
                              <textarea className="code-input code-input--tall" readOnly value={JSON.stringify(selectedCloudSkill.metadata || {}, null, 2)} />
                            </section>
                            <section className="fig-card fig-card--subtle">
                              <div className="fig-card__head">
                                <h3>最近同步记录</h3>
                                <span>{String(overviewData?.skillSyncRuns.length || 0)} 条</span>
                              </div>
                              <div className="fig-list">
                                {(overviewData?.skillSyncRuns || []).length ? (
                                  (overviewData?.skillSyncRuns || []).slice(0, 8).map((run) => (
                                    <article key={run.id} className="fig-list-item">
                                      <div className="fig-list-item__body">
                                        <div className="fig-list-item__title">{run.displayName}</div>
                                        <div className="fig-list-item__meta">{`${run.status} • ${formatDateTime(run.finishedAt || run.startedAt)}`}</div>
                                      </div>
                                    </article>
                                  ))
                                ) : (
                                  <div className="empty-state">还没有同步记录。</div>
                                )}
                              </div>
                            </section>
                          </>
                        ) : (
                          <div className="fig-card fig-card--detail-empty"><div className="empty-state">还没有云技能。</div></div>
                        )}
                        </aside>
                      </div>
                    </div>
                  </div>
                </div>
              ) : route === 'cloud-mcps' ? (
                <CloudMcpPage
                  items={overviewData?.cloudMcps || []}
                  selectedKey={selectedCloudMcp?.key || ''}
                  onSelectKey={setSelectedCloudMcpKey}
                  onSave={handleSaveCloudMcp}
                  onDelete={handleDeleteCloudMcp}
                  onTest={handleTestCloudMcp}
                  saving={savingCloudMcp}
                  testResult={cloudMcpTestResult}
                />
              ) : route === 'assets' ? (
                <div className="fig-page">
                  <div className="fig-page__header">
                    <div className="fig-page__header-inner fig-page__header-inner--stack">
                      <div className="fig-page__header-row">
                        <div>
                          <h1>资源管理</h1>
                          <p className="fig-page__description">品牌资源库，真实读写 portal assets 和对象存储</p>
                        </div>
                      </div>
                      <div className="fig-toolbar">
                        <label className="fig-search">
                          <input
                            className="field-input fig-search__input"
                            placeholder="搜索资源..."
                            value={assetQuery}
                            onChange={(event) => setAssetQuery(event.target.value)}
                          />
                        </label>
                        <select className="field-select fig-filter" value={assetBrand} onChange={(event) => setAssetBrand(event.target.value)}>
                          <option value="all">全部品牌</option>
                          {(overviewData?.brands || []).map((brand) => (
                            <option key={brand.brandId} value={brand.brandId}>
                              {brand.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="fig-page__body">
                    <section className="fig-guide fig-guide--assets">
                      <div className="fig-guide__head">
                        <span className="fig-guide__eyebrow">操作指南</span>
                        <h3>资源管理怎么用</h3>
                      </div>
                      <div className="fig-guide__grid">
                        {[
                          '这里是所有品牌的统一资源库，可上传 logo、favicon、hero 图等素材。',
                          'React 版支持按品牌和类型筛选，也支持直接上传和删除资源。',
                          '资源写操作会实时刷新总览和品牌详情，始终留在当前控制台。',
                        ].map((item, index) => (
                          <article key={item} className="fig-guide__item">
                            <span className="fig-guide__index">{index + 1}</span>
                            <p>{item}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                    <section className="fig-card fig-card--subtle">
                      <div className="fig-card__head">
                        <h3>上传资源</h3>
                        <span>直接写入目标品牌的资源绑定</span>
                      </div>
                      <div className="form-grid form-grid--two">
                        <label className="field">
                          <span>品牌</span>
                          <select
                            className="field-select"
                            value={assetUploadDraft.brandId}
                            onChange={(event) => setAssetUploadDraft((current) => ({ ...current, brandId: event.target.value }))}
                          >
                            <option value="">选择品牌</option>
                            {(overviewData?.brands || []).map((brand) => (
                              <option key={brand.brandId} value={brand.brandId}>
                                {brand.displayName}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Asset Key</span>
                          <input
                            className="field-input"
                            value={assetUploadDraft.assetKey}
                            onChange={(event) => setAssetUploadDraft((current) => ({ ...current, assetKey: event.target.value }))}
                          />
                        </label>
                        <label className="field">
                          <span>类型</span>
                          <input
                            className="field-input"
                            value={assetUploadDraft.kind}
                            onChange={(event) => setAssetUploadDraft((current) => ({ ...current, kind: event.target.value }))}
                          />
                        </label>
                        <label className="field field--wide">
                          <span>Metadata JSON</span>
                          <textarea
                            className="code-input code-input--tall"
                            rows={5}
                            value={assetUploadDraft.metadataText}
                            onChange={(event) => setAssetUploadDraft((current) => ({ ...current, metadataText: event.target.value }))}
                          />
                        </label>
                        <label className="field field--wide">
                          <span>上传文件</span>
                          <input
                            className="field-input"
                            type="file"
                            onChange={(event) => setAssetUploadDraft((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                          />
                        </label>
                      </div>
                      <div className="fig-release-card__actions">
                        <button className="solid-button" type="button" disabled={savingBrandAsset} onClick={() => void handleUploadGlobalAsset()}>
                          {savingBrandAsset ? '上传中…' : '上传资源'}
                        </button>
                      </div>
                    </section>
                    <div className="fig-type-tabs">
                      {['all', ...assetKinds].map((kind) => (
                        <button
                          key={kind}
                          className={`fig-type-tab${assetKind === kind ? ' is-active' : ''}`}
                          type="button"
                          onClick={() => setAssetKind(kind)}
                        >
                          {kind === 'all' ? '全部' : kind}
                        </button>
                      ))}
                    </div>
                    <section className="fig-assets-grid">
                      {filteredAssets.length ? (
                        filteredAssets.map((item) => (
                          <article key={`${item.brandId}-${item.assetKey}`} className="fig-asset-card">
                            <div className="fig-asset-card__preview">
                              {isImageLike(item.contentType, item.publicUrl, item.objectKey) ? (
                                <img className="fig-asset-card__image" src={resolveAssetUrl(item)} alt={item.assetKey} />
                              ) : (
                                <div className="asset-thumb asset-thumb--placeholder">{(item.assetKey || 'AS').slice(0, 2).toUpperCase()}</div>
                              )}
                            </div>
                            <div className="fig-asset-card__body">
                              <div className="fig-asset-card__title">{item.assetKey}</div>
                              <div className="fig-asset-card__meta">{`${String(item.metadata.kind || 'asset')} • ${item.storageProvider || 's3'}`}</div>
                              <div className="fig-asset-card__brand">{item.brandDisplayName || item.brandId}</div>
                              <div className="fig-asset-card__meta">{formatDateTime(item.updatedAt)}</div>
                              <div className="fig-asset-card__actions">
                                <button
                                  className="text-button"
                                  type="button"
                                  onClick={async () => {
                                    openBrandDetail(item.brandId);
                                  }}
                                >
                                  打开品牌
                                </button>
                                <a className="text-link" href={resolveAssetUrl(item)} target="_blank" rel="noreferrer">
                                  打开资源
                                </a>
                                <button
                                  className="text-button"
                                  type="button"
                                  disabled={savingBrandAsset}
                                  onClick={() => void handleDeleteGlobalAsset(item.brandId, item.assetKey)}
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="empty-state empty-state--panel">没有匹配的资源。</div>
                      )}
                    </section>
                  </div>
                </div>
              ) : route === 'releases' ? (
                <div className="fig-page">
                  <div className="fig-page__header">
                    <div className="fig-page__header-inner">
                      <div>
                        <h1>版本发布</h1>
                        <p className="fig-page__description">桌面安装包发布、强更策略与 portal app 快照版本时间线</p>
                      </div>
                    </div>
                  </div>
                  <div className="fig-page__body">
                    <section className="fig-guide fig-guide--releases">
                      <div className="fig-guide__head">
                        <span className="fig-guide__eyebrow">操作指南</span>
                        <h3>版本发布怎么用</h3>
                      </div>
                      <div className="fig-guide__grid">
                        {[
                          '先选择品牌，再管理该品牌桌面端的发布时间线。',
                          '安装包上传、发布策略和时间线都已在 React 版完成。',
                          '保存后会直接刷新品牌发布记录和当前发布详情。',
                        ].map((item, index) => (
                          <article key={item} className="fig-guide__item">
                            <span className="fig-guide__index">{index + 1}</span>
                            <p>{item}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                    <div className="fig-toolbar">
                      <select className="field-select fig-filter" value={releaseBrand} onChange={(event) => setReleaseBrand(event.target.value)}>
                        <option value="all">全部品牌</option>
                        {(overviewData?.brands || []).map((brand) => (
                          <option key={brand.brandId} value={brand.brandId}>
                            {brand.displayName}
                          </option>
                        ))}
                      </select>
                      <select className="field-select fig-filter" value={selectedDesktopReleaseChannel} onChange={(event) => setSelectedDesktopReleaseChannel(event.target.value === 'dev' ? 'dev' : 'prod')}>
                        <option value="prod">prod</option>
                        <option value="dev">dev</option>
                      </select>
                    </div>
                    <section className="fig-card fig-card--subtle">
                      <div className="fig-card__head">
                        <h3>桌面发布中心</h3>
                        <span>上传安装包并发布版本策略</span>
                      </div>
                      {selectedDesktopBrandId ? (
                        <>
                          <div className="fig-meta-cards">
                            <div className="fig-meta-card"><span>当前草稿</span><strong>{selectedDesktopDraft?.version || '未配置'}</strong></div>
                            <div className="fig-meta-card"><span>当前已生效</span><strong>{selectedDesktopPublished?.version || '未发布'}</strong></div>
                            <div className="fig-meta-card"><span>已生效时间</span><strong>{formatDateTime(selectedDesktopPublished?.publishedAt || '')}</strong></div>
                          </div>
                          <div className="form-grid form-grid--two">
                            <label className="field">
                              <span>版本号</span>
                              <input className="field-input" value={desktopReleaseDraft.version} onChange={(event) => setDesktopReleaseDraft((current) => ({ ...current, version: event.target.value }))} />
                            </label>
                            <label className="field">
                              <span>Force Below</span>
                              <input className="field-input" value={desktopReleaseDraft.forceUpdateBelowVersion} onChange={(event) => setDesktopReleaseDraft((current) => ({ ...current, forceUpdateBelowVersion: event.target.value }))} />
                            </label>
                            <label className="field">
                              <span>更新策略</span>
                              <select className="field-select" value={desktopReleaseDraft.enforcementMode} onChange={(event) => setDesktopReleaseDraft((current) => ({ ...current, enforcementMode: event.target.value as 'recommended' | 'required_after_run' | 'required_now' }))}>
                                <option value="recommended">常规提醒</option>
                                <option value="required_after_run">任务结束后强更</option>
                                <option value="required_now">立即强更</option>
                              </select>
                            </label>
                            <label className="field field--wide">
                              <span>发布说明</span>
                              <textarea className="field-textarea" rows={3} value={desktopReleaseDraft.notes} onChange={(event) => setDesktopReleaseDraft((current) => ({ ...current, notes: event.target.value }))} />
                            </label>
                            <label className="field field--wide">
                              <span>强更说明文案</span>
                              <textarea className="field-textarea" rows={2} value={desktopReleaseDraft.reasonMessage} onChange={(event) => setDesktopReleaseDraft((current) => ({ ...current, reasonMessage: event.target.value }))} />
                            </label>
                          </div>
                          <div className="fig-detail-stack">
                            {[
                              ['darwin', 'aarch64'],
                              ['darwin', 'x64'],
                              ['windows', 'x64'],
                              ['windows', 'aarch64'],
                            ].map(([platform, arch]) => (
                              <section key={`${platform}-${arch}`} className="fig-card fig-card--subtle">
                                <div className="fig-card__head">
                                  <h3>{`${platform} / ${arch}`}</h3>
                                  <span>installer / updater / signature</span>
                                </div>
                                <div className="form-grid form-grid--three">
                                  {['installer', 'updater', 'signature'].map((artifactType) => {
                                    const key = `desktop_file_${platform}_${arch}_${artifactType}`;
                                    return (
                                      <label key={key} className="field">
                                        <span>{artifactType}</span>
                                        <input className="field-input" type="file" onChange={(event) => setDesktopReleaseFiles((current) => ({ ...current, [key]: event.target.files?.[0] || null }))} />
                                      </label>
                                    );
                                  })}
                                </div>
                              </section>
                            ))}
                          </div>
                          <div className="fig-release-card__actions">
                            <button className="solid-button" type="button" disabled={savingDesktopReleasePublish} onClick={() => void handlePublishDesktopRelease()}>
                              {savingDesktopReleasePublish ? '发布中…' : '发布并生效'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="empty-state empty-state--panel">先在上方选择一个品牌，再管理该品牌的桌面发布。</div>
                      )}
                    </section>
                    <div className="fig-release-timeline">
                      {filteredReleases.length ? (
                        filteredReleases.map((item) => {
                          const isActive = selectedRelease?.id === item.id;
                          return (
                            <div key={item.id} className={`fig-release-entry${isActive ? ' is-active' : ''}`}>
                              <div className="fig-release-entry__dot" />
                              <div className="fig-release-card">
                                <button className="fig-release-card__summary" type="button" onClick={() => setSelectedReleaseId(item.id)}>
                                  <div>
                                    <div className="fig-release-card__title-row">
                                      <h3>{item.displayName}</h3>
                                      <span className="status-chip status-chip--published">已发布</span>
                                    </div>
                                    <div className="fig-release-card__meta">
                                      <span>
                                        <code>{`v${item.version}`}</code>
                                      </span>
                                      <span>•</span>
                                      <span>{formatRelative(item.publishedAt)}</span>
                                      <span>•</span>
                                      <span>{item.createdByName}</span>
                                    </div>
                                  </div>
                                </button>
                                {isActive ? (
                                  <div className="fig-release-card__detail">
                                    <div className="release-metrics">
                                      <div>
                                        <span>Surface</span>
                                        <strong>{item.surfaces.join(' / ') || '无'}</strong>
                                      </div>
                                      <div>
                                        <span>技能数</span>
                                        <strong>{item.skillCount}</strong>
                                      </div>
                                      <div>
                                        <span>MCP 数</span>
                                        <strong>{item.mcpCount}</strong>
                                      </div>
                                      <div>
                                        <span>发布时间</span>
                                        <strong>{item.publishedAt ? new Date(item.publishedAt).toLocaleString('zh-CN') : '未记录'}</strong>
                                      </div>
                                    </div>
                                    <div className="fig-release-card__actions">
                                      <button
                                        className="ghost-button"
                                        type="button"
                                        onClick={async () => {
                                          openBrandDetail(item.brandId);
                                        }}
                                      >
                                        打开品牌
                                      </button>
                                    </div>
                                    <section className="fig-card fig-card--subtle">
                                      <div className="fig-card__head">
                                        <h3>Diff 视图</h3>
                                        <span>对比选中发布版本与当前品牌草稿</span>
                                      </div>
                                      <div className="form-grid form-grid--two">
                                        <label className="field">
                                          <span>发布版本 JSON</span>
                                          <textarea className="code-input code-input--tall" readOnly value={JSON.stringify(item.config || {}, null, 2)} />
                                        </label>
                                        <label className="field">
                                          <span>当前草稿 JSON</span>
                                          <textarea className="code-input code-input--tall" readOnly value={JSON.stringify(overviewData?.brandConfigs?.[item.brandId] || {}, null, 2)} />
                                        </label>
                                      </div>
                                    </section>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="empty-state empty-state--panel">当前没有发布记录。</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : route === 'payments-config' ? (
                <PaymentConfigPage
                  overviewData={overviewData}
                  saving={savingPaymentConfig}
                  onSaveGateway={handleSavePaymentGateway}
                  onSaveProvider={handleSavePaymentProvider}
                />
              ) : route === 'payments-packages' ? (
                <RechargePackagesPage
                  items={overviewData?.rechargeCatalog || []}
                  selectedPackageId={selectedRechargePackage?.packageId || ''}
                  onSelectPackage={setSelectedRechargePackageId}
                  onSave={handleSaveRechargeCatalog}
                  onDelete={handleDeleteRechargeCatalog}
                  onRestoreRecommended={handleRestoreRecommendedRechargePackages}
                  saving={savingRechargeCatalog}
                />
              ) : route === 'payments-orders' ? (
                <div className="fig-page">
                  <div className="fig-page__header">
                    <div className="fig-page__header-inner fig-page__header-inner--stack">
                      <div>
                        <h1>订单中心</h1>
                        <p className="fig-page__description">查看充值订单、来源 OEM app、到账链路与基础技术明细</p>
                      </div>
                      <div className="fig-toolbar fig-toolbar--audit">
                        <button className="ghost-button" type="button" onClick={handleExportPaymentOrders}>
                          导出 CSV
                        </button>
                        <label className="fig-search">
                          <input
                            className="field-input fig-search__input"
                            placeholder="搜索订单号 / user / app / provider order id..."
                            value={paymentQuery}
                            onChange={(event) => setPaymentQuery(event.target.value)}
                          />
                        </label>
                        <select className="field-select fig-filter" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
                          <option value="all">所有状态</option>
                          {['pending', 'paid', 'failed', 'expired', 'refunded'].map((status) => (
                            <option key={status} value={status}>
                              {paymentStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                        <select className="field-select fig-filter" value={paymentProvider} onChange={(event) => setPaymentProvider(event.target.value)}>
                          <option value="all">所有渠道</option>
                          {['wechat_qr', 'alipay_qr', 'mock'].map((provider) => (
                            <option key={provider} value={provider}>
                              {paymentProviderLabel(provider)}
                            </option>
                          ))}
                        </select>
                        <select className="field-select fig-filter" value={paymentApp} onChange={(event) => setPaymentApp(event.target.value)}>
                          <option value="all">所有 OEM App</option>
                          {paymentApps.map((appName) => (
                            <option key={appName} value={appName}>
                              {appName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="fig-page__body">
                    <section className="fig-guide fig-guide--payments">
                      <div className="fig-guide__head">
                        <span className="fig-guide__eyebrow">操作指南</span>
                        <h3>订单页怎么用</h3>
                      </div>
                      <div className="fig-guide__grid">
                        {[
                          '先看左侧列表里的状态、金额、龙虾币、OEM app 和付款渠道，快速定位异常单。',
                          '订单详情、人工补单、退款与 webhook 明细都已在 React 版查看和处理。',
                          '后续新增支付能力可以继续沿用当前结构扩展。',
                        ].map((item, index) => (
                          <article key={item} className="fig-guide__item">
                            <span className="fig-guide__index">{index + 1}</span>
                            <p>{item}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                    <section className="fig-card fig-audit-table-card">
                      <div className="fig-audit-table">
                        <div className="fig-audit-table__header">
                          <div>订单</div>
                          <div>用户</div>
                          <div>OEM App</div>
                          <div>渠道</div>
                          <div>金额 / 龙虾币</div>
                        </div>
                        <div className="fig-audit-table__body">
                          {filteredPaymentOrders.length ? (
                            filteredPaymentOrders.map((item) => (
                              <button
                                key={item.orderId}
                                className={`fig-audit-row${selectedPaymentOrder?.orderId === item.orderId ? ' is-active' : ''}`}
                                type="button"
                                onClick={() => setSelectedPaymentOrderId(item.orderId)}
                              >
                                <div>
                                  <div className="fig-audit-row__title">{paymentStatusLabel(item.status)}</div>
                                  <div className="fig-audit-row__detail">{item.orderId}</div>
                                </div>
                                <div>{item.userDisplayName || item.username || item.userId}</div>
                                <div>{item.appName || '未上报'}</div>
                                <div>{paymentProviderLabel(item.provider)}</div>
                                <div>{`${formatFen(item.amountCnyFen)} / ${formatCredits(item.totalCredits)}`}</div>
                              </button>
                            ))
                          ) : (
                            <div className="empty-state">没有匹配的订单。</div>
                          )}
                        </div>
                      </div>
                    </section>
                    {selectedPaymentOrder ? (
                      <section className="fig-card">
                        <div className="fig-card__head">
                          <div>
                            <h3>{selectedPaymentOrder.orderId}</h3>
                            <span>{`${paymentStatusLabel(selectedPaymentOrder.status)} · ${formatDateTime(selectedPaymentOrder.createdAt)}`}</span>
                          </div>
                        </div>
                        <div className="fig-meta-cards">
                          <div className="fig-meta-card"><span>Who</span><strong>{selectedPaymentOrder.userDisplayName || selectedPaymentOrder.username || selectedPaymentOrder.userId}</strong></div>
                          <div className="fig-meta-card"><span>User ID</span><strong>{selectedPaymentOrder.userId || '未记录'}</strong></div>
                          <div className="fig-meta-card"><span>账号</span><strong>{selectedPaymentOrder.userEmail || selectedPaymentOrder.username || '未记录'}</strong></div>
                          <div className="fig-meta-card"><span>OEM App</span><strong>{selectedPaymentOrder.appName || '未上报'}</strong></div>
                          <div className="fig-meta-card"><span>支付渠道</span><strong>{paymentProviderLabel(selectedPaymentOrder.provider)}</strong></div>
                          <div className="fig-meta-card"><span>金额</span><strong>{formatFen(selectedPaymentOrder.amountCnyFen)}</strong></div>
                          <div className="fig-meta-card"><span>充值额度</span><strong>{formatCredits(selectedPaymentOrder.totalCredits)}</strong></div>
                          <div className="fig-meta-card"><span>创建时间</span><strong>{formatDateTime(selectedPaymentOrder.createdAt)}</strong></div>
                          <div className="fig-meta-card"><span>支付时间</span><strong>{formatDateTime(selectedPaymentOrder.paidAt)}</strong></div>
                          <div className="fig-meta-card"><span>过期时间</span><strong>{formatDateTime(selectedPaymentOrder.expiresAt)}</strong></div>
                          <div className="fig-meta-card"><span>Provider Order</span><strong>{selectedPaymentOrder.providerOrderId || '未记录'}</strong></div>
                          <div className="fig-meta-card"><span>Webhook 数</span><strong>{String(selectedPaymentOrder.webhookEventCount || 0)}</strong></div>
                        </div>
                        <section className="fig-card fig-card--subtle">
                          <div className="fig-card__head">
                            <h3>订单技术明细</h3>
                            <span>客户端与渠道侧字段</span>
                          </div>
                          <div className="fig-meta-cards">
                            <div className="fig-meta-card"><span>App Version</span><strong>{selectedPaymentOrder.appVersion || '未上报'}</strong></div>
                            <div className="fig-meta-card"><span>Release Channel</span><strong>{selectedPaymentOrder.releaseChannel || '未上报'}</strong></div>
                            <div className="fig-meta-card"><span>Platform</span><strong>{selectedPaymentOrder.platform || '未上报'}</strong></div>
                            <div className="fig-meta-card"><span>Arch</span><strong>{selectedPaymentOrder.arch || '未上报'}</strong></div>
                            <div className="fig-meta-card"><span>Return URL</span><strong>{selectedPaymentOrder.returnUrl || '未记录'}</strong></div>
                            <div className="fig-meta-card"><span>Prepay ID</span><strong>{selectedPaymentOrder.providerPrepayId || '未记录'}</strong></div>
                            <div className="fig-meta-card"><span>Latest Webhook</span><strong>{formatDateTime(selectedPaymentOrder.latestWebhookAt)}</strong></div>
                            <div className="fig-meta-card"><span>Updated At</span><strong>{formatDateTime(selectedPaymentOrder.updatedAt)}</strong></div>
                          </div>
                        </section>
                        <section className="fig-card fig-card--subtle">
                          <div className="fig-card__head">
                            <h3>Metadata</h3>
                            <span>订单原始元数据</span>
                          </div>
                          <textarea className="code-input code-input--tall" readOnly value={JSON.stringify(selectedPaymentOrderDetail?.metadata || selectedPaymentOrder.metadata || {}, null, 2)} />
                        </section>
                        {selectedPaymentOrder.status !== 'paid' ? (
                          <section className="fig-card fig-card--subtle">
                            <div className="fig-card__head">
                              <h3>人工确认到账</h3>
                              <span>后台补单 / 运营补录</span>
                            </div>
                            <div className="form-grid">
                              <label className="field">
                                <span>Provider Order ID</span>
                                <input id="payment-manual-provider-order" className="field-input" defaultValue={selectedPaymentOrder.providerOrderId || ''} />
                              </label>
                              <label className="field">
                                <span>Paid At</span>
                                <input id="payment-manual-paid-at" className="field-input" defaultValue={selectedPaymentOrder.paidAt || ''} />
                              </label>
                              <label className="field field--wide">
                                <span>备注</span>
                                <textarea id="payment-manual-note" className="field-textarea" rows={3} />
                              </label>
                            </div>
                            <div className="fig-release-card__actions">
                              <button
                                className="solid-button"
                                type="button"
                                disabled={savingPaymentOrderAction}
                                onClick={() =>
                                  void handleMarkPaymentOrderPaid({
                                    providerOrderId: String((document.getElementById('payment-manual-provider-order') as HTMLInputElement | null)?.value || ''),
                                    paidAt: String((document.getElementById('payment-manual-paid-at') as HTMLInputElement | null)?.value || ''),
                                    note: String((document.getElementById('payment-manual-note') as HTMLTextAreaElement | null)?.value || ''),
                                  })
                                }
                              >
                                {savingPaymentOrderAction ? '提交中…' : '人工确认到账'}
                              </button>
                            </div>
                          </section>
                        ) : null}
                        {selectedPaymentOrder.status === 'paid' ? (
                          <section className="fig-card fig-card--subtle">
                            <div className="fig-card__head">
                              <h3>人工退款/冲正</h3>
                              <span>仅对未消耗完充值余额的订单开放</span>
                            </div>
                            <label className="field field--wide">
                              <span>备注</span>
                              <textarea id="payment-refund-note" className="field-textarea" rows={3} />
                            </label>
                            <div className="fig-release-card__actions">
                              <button
                                className="ghost-button"
                                type="button"
                                disabled={savingPaymentOrderAction}
                                onClick={() =>
                                  void handleRefundPaymentOrder({
                                    note: String((document.getElementById('payment-refund-note') as HTMLTextAreaElement | null)?.value || ''),
                                  })
                                }
                              >
                                {savingPaymentOrderAction ? '处理中…' : '人工退款/冲正'}
                              </button>
                            </div>
                          </section>
                        ) : null}
                        <section className="fig-card fig-card--subtle">
                          <div className="fig-card__head">
                            <h3>Webhook Events</h3>
                            <span>支付渠道回调原文</span>
                          </div>
                          {Array.isArray(selectedPaymentOrderDetail?.webhook_events) && selectedPaymentOrderDetail.webhook_events.length ? (
                            <div>
                              {selectedPaymentOrderDetail.webhook_events.map((event: Record<string, unknown>, index: number) => (
                                <div key={String(event.event_id || index)} className="fig-card fig-card--subtle">
                                  <div className="fig-meta-cards">
                                    <div className="fig-meta-card"><span>Event ID</span><strong>{String(event.event_id || '')}</strong></div>
                                    <div className="fig-meta-card"><span>Status</span><strong>{String(event.event_type || '未记录')}</strong></div>
                                    <div className="fig-meta-card"><span>Processed</span><strong>{String(event.process_status || 'pending')}</strong></div>
                                    <div className="fig-meta-card"><span>Created</span><strong>{formatDateTime(String(event.created_at || ''))}</strong></div>
                                  </div>
                                  <textarea className="code-input code-input--tall" readOnly value={JSON.stringify(event.payload || {}, null, 2)} />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="empty-state">暂无 webhook 回调。</div>
                          )}
                        </section>
                      </section>
                    ) : null}
                  </div>
                </div>
              ) : route === 'audit-log' ? (
                <div className="fig-page">
                  <div className="fig-page__header">
                    <div className="fig-page__header-inner fig-page__header-inner--stack">
                      <div>
                        <h1>审计日志</h1>
                        <p className="fig-page__description">portal app 的完整操作审计记录</p>
                      </div>
                      <div className="fig-toolbar fig-toolbar--audit">
                        <label className="fig-search">
                          <input
                            className="field-input fig-search__input"
                            placeholder="搜索审计日志..."
                            value={auditQuery}
                            onChange={(event) => setAuditQuery(event.target.value)}
                          />
                        </label>
                        <select className="field-select fig-filter" value={auditBrand} onChange={(event) => setAuditBrand(event.target.value)}>
                          <option value="all">所有品牌</option>
                          {(overviewData?.brands || []).map((brand) => (
                            <option key={brand.brandId} value={brand.brandId}>
                              {brand.displayName}
                            </option>
                          ))}
                        </select>
                        <select className="field-select fig-filter" value={auditAction} onChange={(event) => setAuditAction(event.target.value)}>
                          <option value="all">所有操作</option>
                          {auditActions.map((action) => (
                            <option key={action} value={action}>
                              {actionLabel(action)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="fig-page__body">
                    <section className="fig-guide fig-guide--audit">
                      <div className="fig-guide__head">
                        <span className="fig-guide__eyebrow">操作指南</span>
                        <h3>审计日志怎么看</h3>
                      </div>
                      <div className="fig-guide__grid">
                        {[
                          '这里记录 portal app 的关键操作，包括保存草稿、发布、回滚、资源变更等。',
                          '先按品牌、操作类型或关键词筛选，再点具体记录查看 payload。',
                          '发现异常后，可以直接从详情跳回对应品牌继续排查。',
                        ].map((item, index) => (
                          <article key={item} className="fig-guide__item">
                            <span className="fig-guide__index">{index + 1}</span>
                            <p>{item}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                    <section className="fig-card fig-audit-table-card">
                      <div className="fig-audit-table">
                        <div className="fig-audit-table__header">
                          <div>操作</div>
                          <div>品牌</div>
                          <div>操作人</div>
                          <div>环境</div>
                          <div>时间戳</div>
                        </div>
                        <div className="fig-audit-table__body">
                          {filteredAudit.length ? (
                            filteredAudit.map((item) => (
                              <button
                                key={item.id}
                                className={`fig-audit-row${selectedAudit?.id === item.id ? ' is-active' : ''}`}
                                type="button"
                                onClick={() => setSelectedAuditId(item.id)}
                              >
                                <div>
                                  <div className="fig-audit-row__title">{actionLabel(item.action)}</div>
                                  <div className="fig-audit-row__detail">{item.environment || 'portal'}</div>
                                </div>
                                <div>{item.brandDisplayName || item.brandId}</div>
                                <div>{item.actorName || item.actorUsername || 'system'}</div>
                                <div>{item.environment || 'portal'}</div>
                                <div>{item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '未记录'}</div>
                              </button>
                            ))
                          ) : (
                            <div className="empty-state">没有匹配的审计记录。</div>
                          )}
                        </div>
                      </div>
                    </section>
                    {selectedAudit ? (
                      <section className="fig-card">
                        <div className="fig-card__head">
                          <div>
                            <h3>{actionLabel(selectedAudit.action)}</h3>
                            <span>{`${selectedAudit.brandDisplayName || selectedAudit.brandId} · ${
                              selectedAudit.createdAt ? new Date(selectedAudit.createdAt).toLocaleString('zh-CN') : '未记录'
                            }`}</span>
                          </div>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={async () => {
                              openBrandDetail(selectedAudit.brandId);
                            }}
                          >
                            打开品牌
                          </button>
                        </div>
                        <div className="fig-meta-cards">
                          <div className="fig-meta-card">
                            <span>操作人</span>
                            <strong>{selectedAudit.actorName || selectedAudit.actorUsername || 'system'}</strong>
                          </div>
                          <div className="fig-meta-card">
                            <span>环境</span>
                            <strong>{selectedAudit.environment || 'portal'}</strong>
                          </div>
                          <div className="fig-meta-card">
                            <span>Brand</span>
                            <strong>{selectedAudit.brandId}</strong>
                          </div>
                        </div>
                        <section className="fig-card fig-card--subtle">
                          <div className="fig-card__head">
                            <h3>审计详情</h3>
                            <span>真实 payload</span>
                          </div>
                          <textarea className="code-input code-input--tall" readOnly value={JSON.stringify(selectedAudit.payload || {}, null, 2)} />
                        </section>
                      </section>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="fig-page">
                  <div className="fig-page__header">
                    <div className="fig-page__header-inner">
                      <div>
                        <h1>总览</h1>
                        <p className="fig-page__description">从统一 control-plane 管理所有 OEM 应用、Skill、MCP 与菜单绑定</p>
                      </div>
                      <button className="solid-button fig-button" type="button" onClick={() => setRoute('brands')}>
                        创建新品牌
                      </button>
                    </div>
                  </div>
                  <div className="fig-page__body">
                    <section className="fig-guide fig-guide--overview">
                      <div className="fig-guide__head">
                        <span className="fig-guide__eyebrow">操作指南</span>
                        <h3>总览页怎么看</h3>
                      </div>
                      <div className="fig-guide__grid">
                        {[
                          '这里看全局运营面：品牌数、技能数、MCP 数、最近发布和最近编辑。',
                          '要新建一个 OEM 应用，先点右上角“创建新品牌”。',
                          '要排查最近谁改了什么，直接看“最近编辑”或进审计日志。',
                        ].map((item, index) => (
                          <article key={item} className="fig-guide__item">
                            <span className="fig-guide__index">{index + 1}</span>
                            <p>{item}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                    <section className="fig-stats-grid">
                      {[
                        ['品牌总数', overviewData.stats.brandsTotal, 'portal apps'],
                        ['已启用', overviewData.stats.publishedCount, '运行中'],
                        ['云技能总库', overviewData.stats.cloudSkillsCount, 'cloud catalog'],
                        ['平台级 MCP', overviewData.stats.mcpServersCount, '平台预装子集'],
                        ['平台级 Skill', overviewData.stats.skillsCount, '平台预装子集'],
                        ['资源索引', overviewData.stats.assetsCount, 'portal assets'],
                      ].map(([label, value, note]) => (
                        <article key={String(label)} className="fig-stat-card">
                          <div className="fig-stat-card__label">{label}</div>
                          <div className="fig-stat-card__value">{value as number}</div>
                          <div className="fig-stat-card__note">{note}</div>
                        </article>
                      ))}
                    </section>
                    <section className="fig-two-column">
                      <article className="fig-card">
                        <div className="fig-card__head">
                          <h3>最近发布</h3>
                        </div>
                        <div className="fig-list">
                          {overviewData.recentReleases.length ? (
                            overviewData.recentReleases.map((item) => (
                              <div key={item.id} className="fig-list-item">
                                <div>
                                  <div className="fig-list-item__title">{item.displayName}</div>
                                  <div className="fig-list-item__meta">
                                    <span>{`v${item.version}`}</span>
                                    <span>•</span>
                                    <span>{formatRelative(item.publishedAt)}</span>
                                  </div>
                                </div>
                                <span className="status-chip status-chip--published">已发布</span>
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">当前没有发布记录。</div>
                          )}
                        </div>
                      </article>
                      <article className="fig-card">
                        <div className="fig-card__head">
                          <h3>最近编辑</h3>
                        </div>
                        <div className="fig-list">
                          {overviewData.recentEdits.length ? (
                            overviewData.recentEdits.map((item) => (
                              <div key={item.id} className="fig-list-item">
                                <div>
                                  <div className="fig-list-item__title">{item.displayName}</div>
                                  <div className="fig-list-item__body">{actionLabel(item.action)}</div>
                                  <div className="fig-list-item__meta">
                                    <span>{item.actorName}</span>
                                    <span>•</span>
                                    <span>{formatRelative(item.createdAt)}</span>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">当前没有编辑记录。</div>
                          )}
                        </div>
                      </article>
                    </section>
                  </div>
                </div>
              )}
      </AdminShell>
    );
  }

  return (
    <LoginScreen
      busy={busy}
      error={error}
      themeMode={themeMode}
      onThemeModeChange={setThemeMode}
      onSubmit={handleSubmit}
    />
  );
}
