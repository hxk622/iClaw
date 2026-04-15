import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { IClawClient, type CreditBalanceData, type DesktopUpdateHint, type MarketStockData } from '@iclaw/sdk';
import desktopPackageJson from '../../package.json';
import { clearAuth, readAuth, writeAuth } from './lib/auth-storage';
import {
  flushClientMetricQueue,
  getAppBootElapsedMs,
  recordClientPerfSamples,
  trackClientCrash,
  trackClientMetricEvent,
} from './lib/client-metrics';
import { getGoogleOAuthUrl, getWeChatOAuthUrl, openOAuthPopup, type OAuthProvider } from './lib/oauth';
import {
  detectPortConflicts,
  ensureOpenClawCliAvailable,
  isTauriRuntime,
  loadGatewayAuth,
  startSidecar,
  stopSidecar,
} from './lib/tauri-sidecar';
import {
  clearPortalProviderAuth,
  diagnoseRuntime,
  installRuntime,
  listenRuntimeInstallProgress,
  loadStartupDiagnostics,
  syncPortalProviderAuth,
} from './lib/tauri-runtime-config';
import { useDesktopStartupController } from './lib/use-desktop-startup-controller';
import {
  ensureDesktopRuntimeReadyForChatRecovery,
  type DesktopRuntimeRecoveryState,
} from './lib/desktop-runtime-recovery';
import {
  loadBrandRuntimeConfigWithFallback,
  resolveAuthExperienceConfig,
  resolveHeaderConfig,
  resolveInputComposerConfig,
  resolveRequiredEnabledMenuKeys,
  resolveRequiredMenuUiConfig,
  resolveWelcomePageConfig,
} from './lib/oem-runtime';
import { AuthPanel } from './components/AuthPanel';
import { AccountPanel } from './components/account/AccountPanel';
import { FaultReportModal } from './components/FaultReportModal';
import { FirstRunSetupPanel } from './components/FirstRunSetupPanel';
import { GlobalExceptionDialog, type GlobalExceptionState } from './components/GlobalExceptionDialog';
import { submitAutoDiagnosticUpload } from './lib/fault-report';
import { IClawHeader } from './components/IClawHeader';
import { OpenClawChatSurface } from './components/OpenClawChatSurface';
import { CronTaskResultSync } from './components/CronTaskResultSync';
import { NotificationCenterDetailDrawer } from './components/notifications/NotificationCenterDetailDrawer';
import { NotificationCenterDrawer } from './components/notifications/NotificationCenterDrawer';
import { Sidebar, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH } from './components/Sidebar';
import { DesktopUpdateGuard } from './components/DesktopUpdateGuard';
import { Button } from './components/ui/Button';
import { EmptyStatePanel } from './components/ui/EmptyStatePanel';
import { PageContent, PageSurface } from './components/ui/PageLayout';
import { K2CWelcomePage } from './components/K2CWelcomePage';
import type { SkillStoreViewPreset } from './components/skill-store/SkillStoreView';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { RechargeCenter } from './components/recharge/RechargeCenter';
import type { FundMarketResearchTarget } from './components/market/FundMarketView';
import type { ComposerInstrumentKind, ComposerSkillOption, ComposerStockContext } from './components/RichChatComposer';
import { type PersistableSettingsSection, SettingsProvider, useSettings } from './contexts/settings-context';
import { BRAND } from './lib/brand';
import { type InvestmentExpert } from '@/app/lib/investment-experts';
import { type LobsterAgent } from './lib/lobster-store';
import {
  applyIclawWorkspaceBackup,
  loadIclawWorkspaceFiles,
  resetIclawWorkspaceToDefaults,
  saveIclawWorkspaceSection,
} from './lib/iclaw-settings';
import { readChatTurns } from './lib/chat-turns';
import {
  ensureChatConversation,
  findChatConversationBySessionKey,
  linkSessionToConversation,
  readChatConversation,
  syncChatConversationMetadata,
  type ChatConversationRestoreContext,
  type ChatConversationKind,
} from './lib/chat-conversations';
import { deriveConversationHandoffSummary, readStoredChatSnapshot } from './lib/chat-history';
import {
  canonicalizeChatSessionKey,
  createGeneralChatSessionKey,
  createScopedChatSessionKey,
  createSuccessorGeneralChatSessionKey,
  CRON_SYSTEM_SESSION_KEY,
  isGeneralChatSessionKey,
  resolveInitialGeneralChatSessionKey,
  tryCanonicalizeChatSessionKey,
  writePersistedActiveGeneralChatSessionKey,
  type ChatSessionPressureSnapshot,
} from './lib/chat-session';
import {
  clearDesktopUpdateSceneSnapshot,
  formatDesktopUpdateVersion,
  normalizeDesktopUpdateEnforcementState,
  readSkippedDesktopUpdateVersion,
  readDesktopUpdateSceneSnapshot,
  resolveDesktopUpdateGateState,
  resolveDesktopUpdatePolicyLabel,
  shouldShowDesktopUpdateHint,
  writeDesktopUpdateSceneSnapshot,
  writeSkippedDesktopUpdateVersion,
} from './lib/desktop-updates';
import { openExternalUrl } from './lib/open-external-url';
import { executeDesktopUpdateUpgrade } from './lib/desktop-update-upgrade';
import { syncManagedSkills, type SkillStoreItem } from './lib/skill-store';
import { readCacheJson, readCacheString, writeCacheJson, writeCacheString } from './lib/persistence/cache-store';
import { buildStorageKey } from './lib/storage';
import { useSurfaceCacheManager } from './lib/surface-cache';
import { resolveSurfaceCacheLimits } from './lib/surface-cache-profile';
import { buildNotificationCenterItems } from './lib/notification-center';
import {
  clearAppNotifications,
  markAllAppNotificationsRead,
  markAppNotificationRead,
  useAppNotifications,
} from './lib/task-notifications';
import {
  checkDesktopUpdate,
  downloadAndLaunchDesktopInstaller,
  downloadAndInstallDesktopUpdate,
  listenDesktopUpdateProgress,
  restartDesktopApp,
} from './lib/tauri-desktop-updater';
import { desktopLogin, desktopMe, desktopRefresh } from './lib/tauri-auth';
import {
  buildChatScopedStorageKey,
  writeCurrentChatPersistenceUserScope,
} from './lib/chat-persistence-scope';
import {
  readPersistedWorkspaceScene,
  resolveInitialPrimaryView,
  writePersistedWorkspaceScene,
} from './lib/chat-navigation';
import {
  readPersistedChatRouteSnapshot,
  writePersistedChatRouteSnapshot,
  type PersistedChatRouteSnapshot,
} from './lib/chat-route-persistence';

declare global {
  interface Window {
    __ICLAW_APP_DIAGNOSTICS__?: Record<string, unknown>;
  }
}

const LEGACY_SIDEBAR_COLLAPSED_STORAGE_KEY = buildStorageKey('sidebar.collapsed');

function resolveSidebarPreferenceScope(currentUser: AuthUser | null): string {
  const rawValue =
    currentUser?.id?.trim() ||
    currentUser?.email?.trim() ||
    currentUser?.username?.trim() ||
    'guest';
  return encodeURIComponent(rawValue);
}

function resolveSidebarCollapsedStorageKey(currentUser: AuthUser | null): string {
  return buildStorageKey(`sidebar.collapsed.${resolveSidebarPreferenceScope(currentUser)}`);
}

function readSidebarCollapsedPreference(currentUser: AuthUser | null): boolean {
  const scopedValue = readCacheString(resolveSidebarCollapsedStorageKey(currentUser));
  if (scopedValue === '1') {
    return true;
  }
  if (scopedValue === '0') {
    return false;
  }
  return readCacheString(LEGACY_SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
}

const OpenClawCronSurface = lazy(() =>
  import('./components/OpenClawCronSurface').then((module) => ({ default: module.OpenClawCronSurface })),
);
const DataConnectionsView = lazy(() =>
  import('./components/data-connections/DataConnectionsView').then((module) => ({ default: module.DataConnectionsView })),
);
const InvestmentExpertsView = lazy(() =>
  import('./components/investment-experts/InvestmentExpertsView').then((module) => ({
    default: module.InvestmentExpertsView,
  })),
);
const LobsterStoreView = lazy(() =>
  import('./components/lobster-store/LobsterStoreView').then((module) => ({ default: module.LobsterStoreView })),
);
const MemoryView = lazy(() =>
  import('./components/memory/MemoryView').then((module) => ({ default: module.MemoryView })),
);
const MCPStoreView = lazy(() =>
  import('./components/mcp-store/MCPStoreView').then((module) => ({ default: module.MCPStoreView })),
);
const TaskCenterView = lazy(() =>
  import('./components/TaskCenterView').then((module) => ({ default: module.TaskCenterView })),
);
const SkillStoreView = lazy(() =>
  import('./components/skill-store/SkillStoreView').then((module) => ({ default: module.SkillStoreView })),
);
const IMBotsView = lazy(() =>
  import('./components/im-bots/IMBotsView').then((module) => ({ default: module.IMBotsView })),
);
const SecurityCenterView = lazy(() =>
  import('./components/security-center/SecurityCenterView').then((module) => ({
    default: module.SecurityCenterView,
  })),
);
const StockMarketView = lazy(() =>
  import('./components/market/StockMarketView').then((module) => ({ default: module.StockMarketView })),
);
const FundMarketView = lazy(() =>
  import('./components/market/FundMarketView').then((module) => ({ default: module.FundMarketView })),
);

interface AuthUser {
  id?: string;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  avatarRevision?: string | number | null;
  display_name?: string | null;
  role?: 'user' | 'admin' | 'super_admin' | null;
}

function isUnauthorizedAuthError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'UNAUTHORIZED');
}

function resolveAuthErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (!message) {
    return fallback;
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes('access token') ||
    normalized.includes('refresh token') ||
    normalized.includes('provider auth sync')
  ) {
    return '登录状态已失效，请重新登录';
  }

  return message;
}

function resolveSidecarPort(args: string[]): string {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== '--port') continue;
    const next = args[i + 1];
    if (next && /^\d+$/.test(next)) return next;
  }
  return '2126';
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

function isLoopbackUrl(url: string): boolean {
  try {
    return isLoopbackHostname(new URL(url).hostname);
  } catch {
    return false;
  }
}

const SIDE_CAR_ARGS = ((import.meta.env.VITE_SIDE_CAR_ARGS as string) || '--port 2126')
  .split(' ')
  .map((s) => s.trim())
  .filter(Boolean);
const SIDECAR_PORT = resolveSidecarPort(SIDE_CAR_ARGS);
const LOCAL_API_BASE_URL = `http://127.0.0.1:${SIDECAR_PORT}`;
const LOCAL_AUTH_BASE_URL = 'http://127.0.0.1:2130';
const IS_TAURI_RUNTIME = isTauriRuntime();
const DEFAULT_API_BASE_URL = LOCAL_API_BASE_URL;
const CONFIGURED_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || DEFAULT_API_BASE_URL;
// Desktop builds always talk to the local OpenClaw runtime for health/gateway.
const API_BASE_URL = IS_TAURI_RUNTIME ? LOCAL_API_BASE_URL : CONFIGURED_API_BASE_URL;
const AUTH_BASE_URL =
  (import.meta.env.VITE_AUTH_BASE_URL as string) || BRAND.endpoints.authBaseUrl || LOCAL_AUTH_BASE_URL;
const DEFAULT_GATEWAY_WS_URL = API_BASE_URL.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
const GATEWAY_WS_URL =
  IS_TAURI_RUNTIME
    ? DEFAULT_GATEWAY_WS_URL
    : (import.meta.env.VITE_GATEWAY_WS_URL as string) || DEFAULT_GATEWAY_WS_URL;
const GATEWAY_TOKEN =
  IS_TAURI_RUNTIME ? undefined : (import.meta.env.VITE_GATEWAY_TOKEN as string) || undefined;
const GATEWAY_PASSWORD =
  IS_TAURI_RUNTIME ? undefined : (import.meta.env.VITE_GATEWAY_PASSWORD as string) || undefined;
const DISABLE_GATEWAY_DEVICE_IDENTITY =
  IS_TAURI_RUNTIME ||
  (typeof window !== 'undefined' &&
    isLoopbackHostname(window.location.hostname) &&
    isLoopbackUrl(API_BASE_URL));
const IM_BOT_TEST_SESSION_KEY = 'im-bots-test';
const AUTH_BOOTSTRAP_TIMEOUT_MS = 10_000;
const SIDECAR_BOOT_HEALTHCHECK_ATTEMPTS = 60;
const SIDECAR_BOOT_HEALTHCHECK_INTERVAL_MS = 500;
const SIDECAR_BOOT_HEALTHCHECK_TIMEOUT_MS = 45_000;
const DESKTOP_APP_VERSION = desktopPackageJson.version;
const DESKTOP_RELEASE_CHANNEL: 'dev' | 'prod' =
  String(import.meta.env.VITE_BUILD_CHANNEL || '').trim().toLowerCase() === 'dev' ? 'dev' : 'prod';
const DISPLAY_DESKTOP_APP_VERSION = DESKTOP_APP_VERSION.split('+', 1)[0] || DESKTOP_APP_VERSION;
const DESKTOP_UPDATE_REVALIDATE_TTL_MS = 15 * 60 * 1000;
const DESKTOP_RUNTIME_PLATFORM: 'windows' | 'macos' | 'linux' | 'web' =
  typeof navigator === 'undefined'
    ? 'web'
    : /windows/i.test(navigator.userAgent)
      ? 'windows'
      : /mac os x|macintosh/i.test(navigator.userAgent)
        ? 'macos'
        : /linux/i.test(navigator.userAgent)
          ? 'linux'
          : 'web';

type ActiveChatRoute = {
  conversationId: string | null;
  sessionKey: string;
  initialPrompt: string | null;
  initialPromptKey: string | null;
  focusedTurnId: string | null;
  focusedTurnKey: string | null;
  initialAgentSlug: string | null;
  initialSkillSlug: string | null;
  initialSkillOption: ComposerSkillOption | null;
  initialStockContext: ComposerStockContext | null;
};

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizePersistedExchange(value: unknown): ComposerStockContext['exchange'] | null {
  return value === 'sh' || value === 'sz' || value === 'bj' || value === 'otc' ? value : null;
}

function normalizePersistedInstrumentKind(value: unknown): ComposerInstrumentKind | undefined {
  return value === 'stock' || value === 'fund' || value === 'etf' || value === 'qdii' ? value : undefined;
}

function resolveAuthUserPersistenceScope(user: AuthUser | null): string | null {
  if (!user) {
    return null;
  }
  const id = normalizeOptionalText(user.id);
  if (id) {
    return id;
  }
  const email = normalizeOptionalText(user.email);
  if (email) {
    return email.toLowerCase();
  }
  const username = normalizeOptionalText(user.username);
  if (username) {
    return username.toLowerCase();
  }
  return null;
}

function applyChatPersistenceUserScope(user: AuthUser | null): void {
  writeCurrentChatPersistenceUserScope(resolveAuthUserPersistenceScope(user));
}

function normalizePersistedSkillOption(value: unknown): ComposerSkillOption | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const slug = normalizeOptionalText(raw.slug);
  const name = normalizeOptionalText(raw.name);
  const market = normalizeOptionalText(raw.market);
  const skillType = normalizeOptionalText(raw.skillType);
  const categoryLabel = normalizeOptionalText(raw.categoryLabel);
  if (!slug || !name || !market || !skillType || !categoryLabel) {
    return null;
  }
  return {
    slug,
    name,
    market,
    skillType,
    categoryLabel,
  };
}

function normalizePersistedStockContext(value: unknown): ComposerStockContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const id = normalizeOptionalText(raw.id);
  const symbol = normalizeOptionalText(raw.symbol);
  const companyName = normalizeOptionalText(raw.companyName);
  const exchange = normalizePersistedExchange(raw.exchange);
  if (!id || !symbol || !companyName || !exchange) {
    return null;
  }
  return {
    id,
    symbol,
    companyName,
    exchange,
    board: normalizeOptionalText(raw.board),
    instrumentKind: normalizePersistedInstrumentKind(raw.instrumentKind),
    instrumentLabel: normalizeOptionalText(raw.instrumentLabel),
  };
}

function readPersistedActiveChatRoute(): ActiveChatRoute | null {
  const snapshot = readPersistedChatRouteSnapshot();
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }
  const sessionKey = normalizeOptionalText(snapshot.sessionKey);
  if (!sessionKey || sessionKey === CRON_SYSTEM_SESSION_KEY) {
    return null;
  }
  const canonicalSessionKey = tryCanonicalizeChatSessionKey(sessionKey);
  if (!canonicalSessionKey) {
    return null;
  }
  return {
    conversationId: normalizeOptionalText(snapshot.conversationId),
    sessionKey: canonicalSessionKey,
    initialPrompt: normalizeOptionalText(snapshot.initialPrompt),
    initialPromptKey: normalizeOptionalText(snapshot.initialPromptKey),
    focusedTurnId: null,
    focusedTurnKey: null,
    initialAgentSlug: normalizeOptionalText(snapshot.initialAgentSlug),
    initialSkillSlug: normalizeOptionalText(snapshot.initialSkillSlug),
    initialSkillOption: normalizePersistedSkillOption(snapshot.initialSkillOption),
    initialStockContext: normalizePersistedStockContext(snapshot.initialStockContext),
  };
}

function writePersistedActiveChatRoute(route: ActiveChatRoute | null): void {
  writePersistedChatRouteSnapshot(
    route
      ? {
          conversationId: route.conversationId,
          sessionKey: route.sessionKey,
          initialPrompt: route.initialPrompt,
          initialPromptKey: route.initialPromptKey,
          initialAgentSlug: route.initialAgentSlug,
          initialSkillSlug: route.initialSkillSlug,
          initialSkillOption: route.initialSkillOption,
          initialStockContext: route.initialStockContext,
        }
      : null,
  );
}

function buildActiveChatRoute(params: {
  sessionKey: string;
  conversationId?: string | null;
  kind?: ChatConversationKind;
  title?: string | null;
  initialPrompt?: string | null;
  initialPromptKey?: string | null;
  focusedTurnId?: string | null;
  focusedTurnKey?: string | null;
  initialAgentSlug?: string | null;
  initialSkillSlug?: string | null;
  initialSkillOption?: ComposerSkillOption | null;
  initialStockContext?: ComposerStockContext | null;
}): ActiveChatRoute {
  const sessionKey = canonicalizeChatSessionKey(params.sessionKey);
  const conversationId =
    normalizeOptionalText(params.conversationId) ?? findChatConversationBySessionKey(sessionKey)?.id ?? null;

  return {
    conversationId,
    sessionKey,
    initialPrompt: params.initialPrompt ?? null,
    initialPromptKey: params.initialPromptKey ?? null,
    focusedTurnId: params.focusedTurnId ?? null,
    focusedTurnKey: params.focusedTurnKey ?? null,
    initialAgentSlug: params.initialAgentSlug ?? null,
    initialSkillSlug: params.initialSkillSlug ?? null,
    initialSkillOption: params.initialSkillOption ?? null,
    initialStockContext: params.initialStockContext ?? null,
  };
}

function buildConversationBackedChatRoute(params: {
  sessionKey: string;
  conversationId?: string | null;
  kind?: ChatConversationKind;
  title?: string | null;
  initialPrompt?: string | null;
  initialPromptKey?: string | null;
  focusedTurnId?: string | null;
  focusedTurnKey?: string | null;
  initialAgentSlug?: string | null;
  initialSkillSlug?: string | null;
  initialSkillOption?: ComposerSkillOption | null;
  initialStockContext?: ComposerStockContext | null;
}): ActiveChatRoute {
  const route = buildActiveChatRoute(params);
  const restoreContext: Partial<ChatConversationRestoreContext> = {
    initialAgentSlug: route.initialAgentSlug,
    initialSkillSlug: route.initialSkillSlug,
    initialSkillOption: route.initialSkillOption,
    initialStockContext: route.initialStockContext,
  };
  if (route.conversationId && readChatConversation(route.conversationId)) {
    return route;
  }

  const matchedConversation = findChatConversationBySessionKey(route.sessionKey);
  if (matchedConversation) {
    return {
      ...route,
      conversationId: matchedConversation.id,
    };
  }

  const conversation = ensureChatConversation({
    conversationId: null,
    sessionKey: route.sessionKey,
    kind: params.kind ?? 'general',
    title: params.title ?? null,
    restoreContext,
  });

  return {
    ...route,
    conversationId: conversation.id,
  };
}

function createConversationBackedDefaultChatRoute(sessionKey = resolveInitialGeneralChatSessionKey()) {
  return buildConversationBackedChatRoute({
    sessionKey,
    kind: 'general',
  });
}

function hasSeededConversationContext(route: ActiveChatRoute): boolean {
  return Boolean(
    route.initialPrompt ||
      route.initialPromptKey ||
      route.focusedTurnId ||
      route.focusedTurnKey ||
      route.initialAgentSlug ||
      route.initialSkillSlug ||
      route.initialSkillOption ||
      route.initialStockContext,
  );
}

function snapshotHasMeaningfulConversationMessages(messages: unknown[]): boolean {
  return messages.some((message) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      return false;
    }

    const record = message as Record<string, unknown>;
    const role = typeof record.role === 'string' ? record.role.trim().toLowerCase() : '';
    if (role !== 'user' && role !== 'assistant') {
      return false;
    }

    if (typeof record.content === 'string' && record.content.trim()) {
      return true;
    }

    if (!Array.isArray(record.content)) {
      return false;
    }

    return record.content.some((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return false;
      }
      const block = item as Record<string, unknown>;
      if (typeof block.text === 'string' && block.text.trim()) {
        return true;
      }
      if (block.type === 'image' || block.type === 'file' || block.type === 'video') {
        return true;
      }
      return Boolean(block.source);
    });
  });
}

function canReuseEmptyUnnamedGeneralConversation(route: ActiveChatRoute, appName: string): boolean {
  if (!isGeneralChatSessionKey(route.sessionKey) || hasSeededConversationContext(route)) {
    return false;
  }

  const conversation =
    (route.conversationId ? readChatConversation(route.conversationId) : null) ||
    findChatConversationBySessionKey(route.sessionKey);
  if (!conversation || conversation.kind !== 'general') {
    return false;
  }
  if ((conversation.title ?? '').trim()) {
    return false;
  }

  const hasTurns = readChatTurns().some((turn) => turn.source === 'chat' && turn.conversationId === conversation.id);
  if (hasTurns) {
    return false;
  }

  const snapshot = readStoredChatSnapshot({
    appName,
    sessionKey: route.sessionKey,
    conversationId: conversation.id,
  });
  return !snapshotHasMeaningfulConversationMessages(snapshot?.messages ?? []);
}

function resolveInitialChatRoute(): ActiveChatRoute {
  const persisted = readPersistedActiveChatRoute();
  if (persisted) {
    return buildConversationBackedChatRoute({
      sessionKey: persisted.sessionKey,
      conversationId: persisted.conversationId,
      kind: 'general',
      initialPrompt: persisted.initialPrompt,
      initialPromptKey: persisted.initialPromptKey,
      focusedTurnId: null,
      focusedTurnKey: null,
      initialAgentSlug: persisted.initialAgentSlug,
      initialSkillSlug: persisted.initialSkillSlug,
      initialSkillOption: persisted.initialSkillOption,
      initialStockContext: persisted.initialStockContext,
    });
  }
  return createConversationBackedDefaultChatRoute();
}

type PrimaryView = string;
type OverlayView = 'settings' | 'account' | 'recharge';

type ChatSurfaceEntry = {
  route: ActiveChatRoute;
  version: number;
};

type ChatSurfaceRuntimeState = {
  busy: boolean;
  hasPendingBilling: boolean;
  ready: boolean;
};

const PRIMARY_VIEW_ORDER: PrimaryView[] = [
  'chat',
  'cron',
  'investment-experts',
  'stock-market',
  'fund-market',
  'lobster-store',
  'skill-store',
  'finance-skills',
  'foundation-skills',
  'mcp-store',
  'memory',
  'data-connections',
  'im-bots',
  'security',
  'task-center',
];
const SUPPORTED_PRIMARY_VIEWS = new Set<PrimaryView>(PRIMARY_VIEW_ORDER);

function buildChatSurfaceCacheKey(route: ActiveChatRoute): string {
  return route.conversationId || route.sessionKey;
}

function isRenderableMenuPrimaryView(view: PrimaryView): boolean {
  return view !== 'chat';
}

function buildSurfaceLayerClassName(active: boolean): string {
  return active
    ? 'absolute inset-0 z-[1] flex min-h-0 min-w-0 overflow-hidden'
    : 'pointer-events-none invisible absolute inset-0 flex min-h-0 flex-1 overflow-hidden opacity-0';
}

function DeferredSurfaceFallback({ title }: { title: string }) {
  return (
    <PageSurface as="div">
      <PageContent className="flex min-h-full items-center">
        <div className="mx-auto w-full max-w-[720px]">
          <EmptyStatePanel
            title={`正在加载${title}`}
            description="页面模块已命中当前导航，但还在按需装载。"
            className="rounded-[32px]"
          />
        </div>
      </PageContent>
    </PageSurface>
  );
}

function DeferredSurface({ title, children }: { title: string; children: ReactNode }) {
  return <Suspense fallback={<DeferredSurfaceFallback title={title} />}>{children}</Suspense>;
}

function buildDesktopUpdateAnnouncement(hint: DesktopUpdateHint): string {
  const policyLabel = resolveDesktopUpdatePolicyLabel(hint);
  const reasonMessage = hint.reasonMessage?.trim();
  const base = `发现新版本 ${hint.latestVersion}。当前策略：${policyLabel}。`;
  return reasonMessage ? `${base} ${reasonMessage}` : base;
}

function RuntimeAuthRequiredView({
  eyebrow,
  title,
  description,
  authenticated,
  hasGatewayAuth,
  onLogin,
}: {
  eyebrow: string;
  title: string;
  description: string;
  authenticated: boolean;
  hasGatewayAuth: boolean;
  onLogin: () => void;
}) {
  return (
    <PageSurface as="div">
      <PageContent className="flex min-h-full items-center">
        <div className="mx-auto w-full max-w-[760px]">
          <EmptyStatePanel
            title={title}
            description={
              <>
                {description}
                <br />
                control-plane 登录：{authenticated ? '已登录' : '未登录'} · gateway 凭据：
                {hasGatewayAuth ? '已配置' : '缺失'}
              </>
            }
            action={
              <Button variant="primary" size="sm" onClick={onLogin}>
                打开登录
              </Button>
            }
            compact={false}
            className="rounded-[32px]"
          />
          <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {eyebrow}
          </div>
        </div>
      </PageContent>
    </PageSurface>
  );
}

function AuthBootstrapPlaceholderView({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <PageSurface as="div">
      <PageContent className="flex min-h-full items-center">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-8 py-10 text-center shadow-[0_24px_64px_rgba(15,23,42,0.08)]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-primary)_14%,white)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-primary)] motion-safe:animate-pulse" />
            </div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">{title}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
          </div>
          <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {eyebrow}
          </div>
        </div>
      </PageContent>
    </PageSurface>
  );
}

function ChatBootstrapPlaceholderView() {
  return (
    <PageSurface as="div" className="bg-[var(--bg-page)]">
      <div className="flex min-h-0 flex-1 flex-col px-6 pt-3.5 pb-2 lg:px-8">
        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none">
          <div className="openclaw-chat-surface-shell h-full flex-1 overflow-hidden" data-session-transitioning="true">
            <div className="absolute inset-0 bg-[var(--bg-page)]" />
            <div className="absolute inset-0 flex flex-col gap-4 px-1 pt-4 pb-5">
              <div className="flex justify-start">
                <div className="h-28 w-full max-w-[min(480px,76%)] rounded-[28px] bg-[color-mix(in_srgb,var(--brand-primary)_8%,var(--bg-elevated))] motion-safe:animate-pulse" />
              </div>
              <div className="flex justify-end">
                <div className="h-20 w-full max-w-[min(360px,62%)] rounded-[24px] bg-[color-mix(in_srgb,var(--text-primary)_6%,var(--bg-elevated))] motion-safe:animate-pulse" />
              </div>
              <div className="mt-auto rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-5 py-4 shadow-[0_24px_64px_rgba(15,23,42,0.08)]">
                <div className="h-3 w-28 rounded-full bg-[color-mix(in_srgb,var(--brand-primary)_20%,transparent)]" />
                <div className="mt-3 h-11 rounded-[18px] bg-[color-mix(in_srgb,var(--text-primary)_6%,var(--bg-page))]" />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <div className="h-8 w-8 rounded-full bg-[color-mix(in_srgb,var(--text-primary)_8%,var(--bg-page))]" />
                    <div className="h-8 w-8 rounded-full bg-[color-mix(in_srgb,var(--text-primary)_8%,var(--bg-page))]" />
                  </div>
                  <div className="h-9 w-24 rounded-full bg-[color-mix(in_srgb,var(--brand-primary)_18%,white)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageSurface>
  );
}

function WelcomeBackgroundView({
  welcomePageConfig,
  onRequestAuth,
}: {
  welcomePageConfig: ReturnType<typeof resolveWelcomePageConfig>;
  onRequestAuth: (mode?: 'login' | 'register', nextView?: 'account' | 'recharge' | null) => void;
}) {
  const requestLogin = useCallback(() => {
    onRequestAuth('login');
  }, [onRequestAuth]);

  return (
    <PageSurface as="div" className="bg-[var(--bg-page)]">
      <div className="flex min-h-0 flex-1 flex-col px-6 pt-3.5 pb-2 lg:px-8">
        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none">
          <div
            className="openclaw-chat-surface-shell h-full flex-1 overflow-hidden"
            style={{ ['--iclaw-composer-height' as string]: '170px' }}
          >
            <K2CWelcomePage config={welcomePageConfig} onStartChat={requestLogin} onFillPrompt={requestLogin} />
          </div>
        </div>
      </div>
    </PageSurface>
  );
}

function isLikelyAccessToken(token: string): boolean {
  return token.trim().length >= 16;
}

function formatPortConflictMessage(ports: number[]): string | null {
  const sidecarPort = Number(SIDECAR_PORT);
  const relevantPorts = Number.isFinite(sidecarPort) ? ports.filter((port) => port === sidecarPort) : [];
  if (relevantPorts.length === 0) {
    return null;
  }
  const joined = relevantPorts.join('/');
  return `检测到本地 OpenClaw API 正在运行，占用了 ${joined}。请先关闭 pnpm dev:api 或释放该端口后再启动应用。`;
}

function normalizeBrandRuntimeText(value: string): string {
  return value.replaceAll('iClaw', BRAND.displayName);
}

export default function App() {
  const [gatewayAuth, setGatewayAuth] = useState<{ token?: string; password?: string }>({
    token: GATEWAY_TOKEN,
    password: GATEWAY_PASSWORD,
  });

  const refreshGatewayAuth = useCallback(async () => {
    if (!isTauriRuntime()) {
      return null;
    }
    const auth = await loadGatewayAuth();
    if (!auth) {
      return null;
    }
    const token = typeof auth.token === 'string' && auth.token.trim() ? auth.token.trim() : undefined;
    const password =
      typeof auth.password === 'string' && auth.password.trim() ? auth.password.trim() : undefined;
    setGatewayAuth((current) =>
      current.token === token && current.password === password ? current : { token, password },
    );
    return { token, password };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    void refreshGatewayAuth();
  }, [refreshGatewayAuth]);

  const client = useMemo(
    () =>
      new IClawClient({
        apiBaseUrl: API_BASE_URL,
        authBaseUrl: AUTH_BASE_URL,
        gatewayWsUrl: GATEWAY_WS_URL,
        gatewayToken: gatewayAuth.token,
        gatewayPassword: gatewayAuth.password,
        preferGatewayWs: true,
        disableGatewayDeviceIdentity: DISABLE_GATEWAY_DEVICE_IDENTITY,
        desktopAppVersion: DESKTOP_APP_VERSION,
        desktopAppName: BRAND.brandId,
        desktopReleaseChannel: DESKTOP_RELEASE_CHANNEL,
        onDesktopUpdateHint: (hint) => {
          desktopUpdateLastCheckedAtRef.current = Date.now();
          if (!hint.updateAvailable) {
            setDesktopUpdateHint(null);
            setDesktopUpdateActionState((current) => (current === 'ready-to-restart' ? current : 'idle'));
            setDesktopUpdateError(null);
            setDesktopUpdateProgress(null);
            setDesktopUpdateDetail(null);
            return;
          }

          setDesktopUpdateHint((current) => {
            if (
              current?.latestVersion === hint.latestVersion &&
              current.mandatory === hint.mandatory &&
              current.enforcementState === hint.enforcementState &&
              current.reasonMessage === hint.reasonMessage &&
              current.manifestUrl === hint.manifestUrl &&
              current.artifactUrl === hint.artifactUrl
            ) {
              return current;
            }
            return hint;
          });
        },
      }),
    [gatewayAuth.password, gatewayAuth.token],
  );
  const imBotClient = useMemo(
    () =>
      new IClawClient({
        apiBaseUrl: API_BASE_URL,
        authBaseUrl: AUTH_BASE_URL,
        gatewayWsUrl: GATEWAY_WS_URL,
        gatewayToken: gatewayAuth.token,
        gatewayPassword: gatewayAuth.password,
        gatewaySessionKey: IM_BOT_TEST_SESSION_KEY,
        preferGatewayWs: true,
        disableGatewayDeviceIdentity: DISABLE_GATEWAY_DEVICE_IDENTITY,
    }),
    [gatewayAuth.password, gatewayAuth.token],
  );
  const installSessionIdRef = useRef(
    `install-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  );
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionAuthed, setSessionAuthed] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [socialLoadingProvider, setSocialLoadingProvider] = useState<OAuthProvider | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [primaryView, setPrimaryView] = useState<PrimaryView>(() =>
    resolveInitialPrimaryView({
      persistedPrimaryView: readPersistedWorkspaceScene().primaryView,
      fallbackPrimaryView: 'chat',
      availablePrimaryViews: PRIMARY_VIEW_ORDER,
      location: typeof window !== 'undefined' ? window.location : null,
    }),
  );
  const [overlayView, setOverlayView] = useState<OverlayView | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [postAuthView, setPostAuthView] = useState<'account' | 'recharge' | null>(null);
  const [authBootstrapReady, setAuthBootstrapReady] = useState(false);
  const [guestPromptInitialized, setGuestPromptInitialized] = useState(false);
  const [authBootstrapHintVisible, setAuthBootstrapHintVisible] = useState(false);
  const [desktopUpdateHint, setDesktopUpdateHint] = useState<DesktopUpdateHint | null>(null);
  const [skippedDesktopUpdateVersion, setSkippedDesktopUpdateVersion] = useState<string | null>(() =>
    readSkippedDesktopUpdateVersion(),
  );
  const [desktopUpdateActionState, setDesktopUpdateActionState] = useState<
    'idle' | 'checking' | 'downloading' | 'opened' | 'ready-to-restart'
  >('idle');
  const [desktopUpdateError, setDesktopUpdateError] = useState<string | null>(null);
  const [desktopUpdateProgress, setDesktopUpdateProgress] = useState<number | null>(null);
  const [desktopUpdateDetail, setDesktopUpdateDetail] = useState<string | null>(null);
  const [desktopUpdateStatusMessage, setDesktopUpdateStatusMessage] = useState<string | null>(null);
  const [chatSurfaceBusy, setChatSurfaceBusy] = useState(false);
  const [installerFaultReportOpen, setInstallerFaultReportOpen] = useState(false);
  const [globalException, setGlobalException] = useState<GlobalExceptionState | null>(null);
  const lastAutoDiagnosticFingerprintRef = useRef('');
  const launchStartTrackedRef = useRef(false);
  const launchSuccessTrackedRef = useRef(false);
  const initialPagePerfTrackedRef = useRef(false);
  const installStartTrackedRef = useRef(false);
  const lastInstallFailureSignatureRef = useRef('');
  const lastLaunchFailureSignatureRef = useRef('');
  const [brandRuntimeReady, setBrandRuntimeReady] = useState(!IS_TAURI_RUNTIME);
  const [brandShellConfig, setBrandShellConfig] = useState<Record<string, unknown> | null>(null);
  const authExperienceConfig = useMemo(() => resolveAuthExperienceConfig(brandShellConfig), [brandShellConfig]);
  const brandRuntimeSignatureRef = useRef<string | null>(null);
  const brandRuntimeSyncInFlightRef = useRef(false);
  const desktopUpdateLastCheckedAtRef = useRef(0);
  const desktopUpdateCheckInFlightRef = useRef(false);
  const desktopUpdateAutoTriggeredVersionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    applyChatPersistenceUserScope(currentUser);
  }, [currentUser]);

  useEffect(() => {
    writePersistedWorkspaceScene({primaryView});
  }, [primaryView]);

  const syncWorkspaceForUser = useCallback(async (token: string): Promise<void> => {
    if (!IS_TAURI_RUNTIME) return;

    const backup = await client.getWorkspaceBackup(token);
    if (backup) {
      await applyIclawWorkspaceBackup({
        identity_md: backup.identity_md,
        user_md: backup.user_md,
        soul_md: backup.soul_md,
        agents_md: backup.agents_md,
      });
      return;
    }

    await resetIclawWorkspaceToDefaults();
  }, [client]);

  const syncBrandRuntimeSnapshot = useCallback(async (): Promise<void> => {
    if (brandRuntimeSyncInFlightRef.current) {
      return;
    }
    brandRuntimeSyncInFlightRef.current = true;
    try {
      const runtimeConfig = await loadBrandRuntimeConfigWithFallback({
        authBaseUrl: AUTH_BASE_URL,
        brandId: BRAND.brandId,
      });
      const nextConfig = runtimeConfig?.config ?? null;
      const nextSignature = nextConfig ? JSON.stringify(nextConfig) : null;
      if (brandRuntimeSignatureRef.current !== nextSignature) {
        brandRuntimeSignatureRef.current = nextSignature;
        setBrandShellConfig(nextConfig);
      }
    } catch (error) {
      console.warn('failed to sync OEM runtime snapshot', error);
      if (brandRuntimeSignatureRef.current !== null) {
        brandRuntimeSignatureRef.current = null;
        setBrandShellConfig(null);
      }
    } finally {
      brandRuntimeSyncInFlightRef.current = false;
      if (IS_TAURI_RUNTIME) {
        setBrandRuntimeReady(true);
      }
    }
  }, []);

  const resolvePortConflictMessage = useCallback(async (): Promise<string | null> => {
    const status = await detectPortConflicts().catch(() => null);
    return formatPortConflictMessage(status?.occupied_ports ?? []);
  }, []);

  const syncManagedProviderAuth = useCallback(async (): Promise<void> => {
    if (!IS_TAURI_RUNTIME) {
      return;
    }
    await syncPortalProviderAuth({
      authBaseUrl: AUTH_BASE_URL,
      brandId: BRAND.brandId,
    });
  }, []);

  const clearManagedProviderAuth = useCallback(async (): Promise<void> => {
    if (!IS_TAURI_RUNTIME) {
      return;
    }
    await clearPortalProviderAuth();
  }, []);

  const syncSessionArtifacts = useCallback(
    async (
      token: string,
      options: {
        resetWorkspaceOnFailure?: boolean;
        logContext: string;
      },
    ): Promise<void> => {
      try {
        await syncWorkspaceForUser(token);
      } catch (error) {
        console.error(`[desktop] ${options.logContext}: failed to sync workspace from backup`, error);
        if (options.resetWorkspaceOnFailure) {
          await resetIclawWorkspaceToDefaults();
        }
      }

      try {
        await syncManagedProviderAuth();
      } catch (error) {
        console.warn(`[desktop] ${options.logContext}: failed to sync managed provider auth`, error);
        if (isUnauthorizedAuthError(error)) {
          await clearManagedProviderAuth().catch(() => {});
        }
      }
    },
    [clearManagedProviderAuth, syncManagedProviderAuth, syncWorkspaceForUser],
  );

  const finalizeAuthenticatedSession = useCallback(
    async (
      tokens: {access_token: string; refresh_token: string},
      user: AuthUser | null,
      options: {
        postAuthSyncContext: string;
        resetWorkspaceOnFailure?: boolean;
      },
    ): Promise<void> => {
      await writeAuth({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      applyChatPersistenceUserScope(user);
      setAccessToken(tokens.access_token);
      setSessionAuthed(true);
      setCurrentUser(user);
      setAuthModalOpen(false);
      if (postAuthView) {
        setOverlayView(postAuthView);
        setPostAuthView(null);
      }
      void syncSessionArtifacts(tokens.access_token, {
        resetWorkspaceOnFailure: options.resetWorkspaceOnFailure,
        logContext: options.postAuthSyncContext,
      });
    },
    [postAuthView, syncSessionArtifacts],
  );

  useEffect(() => {
    let cancelled = false;
    if (IS_TAURI_RUNTIME) {
      setBrandRuntimeReady(false);
    }

    void syncBrandRuntimeSnapshot()
      .catch((error) => {
        console.warn('failed to sync OEM runtime snapshot', error);
      })
      .finally(() => {
        if (!cancelled && IS_TAURI_RUNTIME) {
          setBrandRuntimeReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [syncBrandRuntimeSnapshot]);

  useEffect(() => {
    if (!IS_TAURI_RUNTIME) return;

    let detach = () => {};
    void listenDesktopUpdateProgress((payload) => {
      setDesktopUpdateProgress(payload.progress);
      setDesktopUpdateDetail(payload.detail);
      if (payload.phase === 'ready-to-restart') {
        setDesktopUpdateActionState('ready-to-restart');
        setDesktopUpdateStatusMessage('新版本已安装，重启应用后生效。');
        return;
      }
      if (payload.phase === 'installer-started') {
        setDesktopUpdateActionState('opened');
        setDesktopUpdateStatusMessage('安装器已启动，当前应用即将退出。');
        return;
      }
      setDesktopUpdateActionState('downloading');
    }).then((unlisten) => {
      detach = unlisten;
    });

    return () => {
      detach();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let settled = false;

    const markBootstrapReady = () => {
      if (cancelled || settled) return;
      setAuthBootstrapReady(true);
    };

    const settleGuest = (clearStoredAuth = false) => {
      if (cancelled || settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      if (clearStoredAuth) {
        void clearAuth().catch(() => {});
      }
      applyChatPersistenceUserScope(null);
      setAccessToken(null);
      setSessionAuthed(false);
      setCurrentUser(null);
      setAuthBootstrapReady(true);
    };

    const settleAuthed = (token: string | null, user: AuthUser | null) => {
      if (cancelled || settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      applyChatPersistenceUserScope(user);
      setAccessToken(token);
      setSessionAuthed(true);
      setCurrentUser(user);
      setAuthModalOpen(false);
      setAuthBootstrapReady(true);
    };

    const settlePreservedAuth = (token: string, user: AuthUser | null = null) => {
      settleAuthed(token, user);
    };

    const timeoutId = window.setTimeout(() => {
      // Do not lock the session into guest mode on slow cold starts.
      // The auth bootstrap can still finish after the UI becomes interactive.
      markBootstrapReady();
    }, AUTH_BOOTSTRAP_TIMEOUT_MS);

    const bootAuth = async () => {
      try {
        const auth = await readAuth();
        if (!auth) {
          try {
            const user = (await (IS_TAURI_RUNTIME ? desktopMe() : client.me())) as AuthUser;
            if (!user) {
              await clearManagedProviderAuth().catch(() => {});
              settleGuest(false);
              return;
            }
            settleAuthed(null, user || null);
          } catch {
            settleGuest(false);
          }
          return;
        }

        if (!isLikelyAccessToken(auth.accessToken)) {
          await clearManagedProviderAuth().catch(() => {});
          settleGuest(true);
          return;
        }

        try {
          const user = (await (IS_TAURI_RUNTIME ? desktopMe(auth.accessToken) : client.me(auth.accessToken))) as AuthUser;
          settleAuthed(auth.accessToken, user || null);
          void syncSessionArtifacts(auth.accessToken, {
            resetWorkspaceOnFailure: true,
            logContext: 'stored session restore',
          });
          return;
        } catch (error) {
          if (!isUnauthorizedAuthError(error)) {
            console.warn('[desktop] failed to validate stored access token, keeping session for retry', error);
            settlePreservedAuth(auth.accessToken, null);
            void syncSessionArtifacts(auth.accessToken, {
              resetWorkspaceOnFailure: false,
              logContext: 'stored session degraded restore',
            });
            return;
          }
        }

        try {
          const refreshed = IS_TAURI_RUNTIME ? await desktopRefresh(auth.refreshToken) : await client.refresh(auth.refreshToken);
          await writeAuth({
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token || auth.refreshToken,
          });
          settlePreservedAuth(refreshed.access_token, null);
          void (async () => {
            await syncSessionArtifacts(refreshed.access_token, {
              resetWorkspaceOnFailure: true,
              logContext: 'refreshed session restore',
            });
            try {
              const user = (await (IS_TAURI_RUNTIME
                ? desktopMe(refreshed.access_token)
                : client.me(refreshed.access_token))) as AuthUser;
              if (cancelled) return;
              applyChatPersistenceUserScope(user || null);
              setCurrentUser(user || null);
            } catch (error) {
              console.warn('[desktop] failed to load user profile after refresh', error);
            }
          })();
        } catch (error) {
          if (isUnauthorizedAuthError(error)) {
            await clearManagedProviderAuth().catch(() => {});
            settleGuest(true);
            return;
          }
          console.warn('[desktop] failed to refresh stored session, keeping cached auth for retry', error);
          settlePreservedAuth(auth.accessToken, null);
        }
      } catch (error) {
        console.warn('[desktop] auth bootstrap hit a transient error, preserving stored session', error);
        settleGuest(false);
      }
    };

    void bootAuth();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [client, clearManagedProviderAuth, syncSessionArtifacts]);

  const handleLogin = async (input: { identifier: string; password: string }) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = IS_TAURI_RUNTIME ? await desktopLogin(input) : await client.login(input);
      await finalizeAuthenticatedSession(data.tokens, (data.user as AuthUser) || null, {
        postAuthSyncContext: 'login session sync',
        resetWorkspaceOnFailure: true,
      });
      void recordMetric('login_success', {
        result: 'success',
        payload: {
          auth_provider: 'password',
        },
      });
    } catch (e) {
      void clearAuth();
      void clearManagedProviderAuth();
      setAuthError(resolveAuthErrorMessage(e, '登录失败'));
      void recordMetric('login_failed', {
        result: 'failed',
        errorCode: e instanceof Error ? e.name : 'LOGIN_FAILED',
        payload: {
          auth_provider: 'password',
          error_message: e instanceof Error ? e.message : '登录失败',
        },
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (input: { username: string; name: string; email: string; password: string }) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await client.register(input);
      await finalizeAuthenticatedSession(data.tokens, (data.user as AuthUser) || null, {
        postAuthSyncContext: 'register session sync',
        resetWorkspaceOnFailure: true,
      });
    } catch (e) {
      void clearAuth();
      void clearManagedProviderAuth();
      setAuthError(resolveAuthErrorMessage(e, '注册失败'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSocialLogin = async (provider: OAuthProvider) => {
    setAuthError(null);
    setSocialLoadingProvider(provider);
    try {
      const oauthUrl = provider === 'wechat' ? getWeChatOAuthUrl() : getGoogleOAuthUrl();
      if (!oauthUrl) {
        throw new Error(provider === 'wechat' ? '微信登录未配置' : 'Google 登录未配置');
      }

      const code = await openOAuthPopup(oauthUrl, `${provider}-login`);
      const data = provider === 'wechat' ? await client.wechatLogin({ code }) : await client.googleLogin({ code });
      await finalizeAuthenticatedSession(data.tokens, (data.user as AuthUser) || null, {
        postAuthSyncContext: `${provider} session sync`,
        resetWorkspaceOnFailure: true,
      });
      void recordMetric('login_success', {
        result: 'success',
        payload: {
          auth_provider: provider,
        },
      });
    } catch (error) {
      const message = resolveAuthErrorMessage(error, '社交登录失败');
      if (message !== '授权已取消') {
        void clearAuth();
        void clearManagedProviderAuth();
        setAuthError(message);
        void recordMetric('login_failed', {
          result: 'failed',
          errorCode: error instanceof Error ? error.name : 'LOGIN_FAILED',
          payload: {
            auth_provider: provider,
            error_message: message,
          },
        });
      }
    } finally {
      setSocialLoadingProvider(null);
    }
  };

  const handleLogout = () => {
    if (IS_TAURI_RUNTIME) {
      void resetIclawWorkspaceToDefaults();
    }
    void clearAuth();
    void clearManagedProviderAuth();
    applyChatPersistenceUserScope(null);
    setAccessToken(null);
    setSessionAuthed(false);
    setCurrentUser(null);
    setPrimaryView('chat');
    setOverlayView(null);
    setAuthModalMode('login');
    setAuthModalOpen(true);
  };

  const openAuthModal = (
    mode: 'login' | 'register' = 'login',
    nextView: 'account' | 'recharge' | null = null,
  ) => {
    setAuthError(null);
    setAuthModalMode(mode);
    setPostAuthView(nextView);
    setAuthModalOpen(true);
  };

  const isAuthenticated = Boolean(accessToken || sessionAuthed);
  const healthCheck = useCallback(async () => {
    await client.health();
  }, [client]);
  const runtimeRecoveryStateRef = useRef<DesktopRuntimeRecoveryState>({
    inFlight: null,
    lastRestartAt: 0,
  });
  const waitForLocalRuntimeHealth = useCallback(async () => {
    for (let attempt = 0; attempt < SIDECAR_BOOT_HEALTHCHECK_ATTEMPTS; attempt += 1) {
      try {
        await healthCheck();
        return true;
      } catch {
        if (attempt >= SIDECAR_BOOT_HEALTHCHECK_ATTEMPTS - 1) {
          break;
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, SIDECAR_BOOT_HEALTHCHECK_INTERVAL_MS);
        });
      }
    }
    return false;
  }, [healthCheck]);
  const ensureChatRuntimeReady = useCallback(async () => {
    return ensureDesktopRuntimeReadyForChatRecovery(runtimeRecoveryStateRef.current, {
      isTauriRuntime: IS_TAURI_RUNTIME,
      healthCheck,
      refreshGatewayAuth,
      syncBrandRuntimeSnapshot,
      stopSidecar,
      startSidecar,
      sidecarArgs: SIDE_CAR_ARGS,
      sidecarStartTimeoutMs: SIDECAR_BOOT_HEALTHCHECK_TIMEOUT_MS,
      waitForHealth: waitForLocalRuntimeHealth,
    });
  }, [healthCheck, refreshGatewayAuth, syncBrandRuntimeSnapshot, waitForLocalRuntimeHealth]);

  const startupControllerConfig = useMemo(
    () => ({
      isTauriRuntime: IS_TAURI_RUNTIME,
      brandDisplayName: BRAND.displayName,
      brandRuntimeReady,
      apiBaseUrl: API_BASE_URL,
      sidecarArgs: SIDE_CAR_ARGS,
      sidecarBootHealthcheckAttempts: SIDECAR_BOOT_HEALTHCHECK_ATTEMPTS,
      sidecarBootHealthcheckIntervalMs: SIDECAR_BOOT_HEALTHCHECK_INTERVAL_MS,
      sidecarBootHealthcheckTimeoutMs: SIDECAR_BOOT_HEALTHCHECK_TIMEOUT_MS,
      normalizeText: normalizeBrandRuntimeText,
      diagnoseRuntime,
      installRuntime,
      loadStartupDiagnostics,
      listenRuntimeInstallProgress,
      ensureOpenClawCliAvailable,
      startSidecar,
      healthCheck,
      resolvePortConflictMessage,
      refreshGatewayAuth,
      syncBrandRuntimeSnapshot,
    }),
    [brandRuntimeReady, healthCheck, refreshGatewayAuth, resolvePortConflictMessage, syncBrandRuntimeSnapshot],
  );

  const {
    healthy,
    healthError,
    installerView,
    shouldShowStartupGate,
    retrySetup,
    runtimeDiagnosis,
    startupDiagnostics,
    runtimeInstallProgress,
  } = useDesktopStartupController(startupControllerConfig);
  const shouldShowAuthBootstrapHint = !shouldShowStartupGate && !authBootstrapReady;

  const recordMetric = useCallback(
    async (
      eventName: string,
      options: {
        result?: 'success' | 'failed' | null;
        errorCode?: string | null;
        durationMs?: number | null;
        payload?: Record<string, unknown>;
      } = {},
    ) => {
      await trackClientMetricEvent({
        client,
        accessToken,
        eventName,
        installId: installSessionIdRef.current,
        result: options.result ?? null,
        errorCode: options.errorCode || null,
        durationMs: options.durationMs ?? null,
        payload: options.payload || {},
      });
      await flushClientMetricQueue({ client, accessToken });
    },
    [accessToken, client],
  );

  useEffect(() => {
    if (launchStartTrackedRef.current) {
      return;
    }
    launchStartTrackedRef.current = true;
    void recordMetric('app_launch_start', {
      payload: { launch_type: 'cold' },
    });
  }, [recordMetric]);

  useEffect(() => {
    if (!IS_TAURI_RUNTIME || !shouldShowStartupGate || installStartTrackedRef.current) {
      return;
    }
    installStartTrackedRef.current = true;
    void recordMetric('install_start', {
      payload: {
        failure_stage: runtimeInstallProgress?.phase || 'prepare',
      },
    });
  }, [IS_TAURI_RUNTIME, recordMetric, runtimeInstallProgress?.phase, shouldShowStartupGate]);

  useEffect(() => {
    if (!IS_TAURI_RUNTIME || !healthy || launchSuccessTrackedRef.current) {
      return;
    }
    launchSuccessTrackedRef.current = true;
    void recordMetric('app_launch_success', {
      result: 'success',
      payload: { launch_type: 'cold' },
    });
    void recordClientPerfSamples({
      client,
      accessToken,
      items: [
        {
          metricName: 'cold_start_ms',
          value: getAppBootElapsedMs(),
          unit: 'ms',
          sampleRate: 1,
          payload: {
            launch_type: 'cold',
          },
        },
      ],
    }).catch(() => undefined);
  }, [IS_TAURI_RUNTIME, accessToken, client, healthy, recordMetric]);

  useEffect(() => {
    if (!authBootstrapReady || initialPagePerfTrackedRef.current) {
      return;
    }
    initialPagePerfTrackedRef.current = true;
    void recordClientPerfSamples({
      client,
      accessToken,
      items: [
        {
          metricName: 'page_load_ms',
          value: getAppBootElapsedMs(),
          unit: 'ms',
          sampleRate: 1,
          payload: {
            page: 'app_bootstrap',
          },
        },
      ],
    }).catch(() => undefined);
  }, [accessToken, authBootstrapReady, client]);

  useEffect(() => {
    if (installerView.state !== 'error') {
      return;
    }
    const signature = `${installerView.errorTitle || ''}::${installerView.errorMessage || ''}::${runtimeInstallProgress?.phase || ''}`;
    if (!signature.trim() || lastInstallFailureSignatureRef.current === signature) {
      return;
    }
    lastInstallFailureSignatureRef.current = signature;
    void recordMetric('install_failed', {
      result: 'failed',
      payload: {
        failure_stage: runtimeInstallProgress?.phase || 'runtime_install',
        error_title: installerView.errorTitle || null,
        error_message: installerView.errorMessage || null,
      },
    });
  }, [installerView.errorMessage, installerView.errorTitle, installerView.state, recordMetric, runtimeInstallProgress?.phase]);

  useEffect(() => {
    if (!healthError) {
      return;
    }
    const signature = `${healthError}::${runtimeDiagnosis?.runtime_path || ''}`;
    if (lastLaunchFailureSignatureRef.current === signature) {
      return;
    }
    lastLaunchFailureSignatureRef.current = signature;
    void recordMetric('app_launch_failed', {
      result: 'failed',
      payload: {
        failure_stage: 'startup_healthcheck',
        error_message: healthError,
      },
    });
    void recordMetric('runtime_healthcheck_failed', {
      result: 'failed',
      payload: {
        failure_stage: 'startup_healthcheck',
        error_message: healthError,
      },
    });
  }, [healthError, recordMetric, runtimeDiagnosis?.runtime_path]);

  useEffect(() => {
    const maybeUploadAutoDiagnostics = (input: {
      kind: 'renderer_error' | 'renderer_rejection';
      title: string;
      message: string;
      stack?: string | null;
    }) => {
      const fingerprint = `${input.kind}:${input.title}:${input.message}:${String(input.stack || '').slice(0, 240)}`;
      if (lastAutoDiagnosticFingerprintRef.current === fingerprint) {
        return;
      }
      lastAutoDiagnosticFingerprintRef.current = fingerprint;
      void submitAutoDiagnosticUpload({
        client,
        accessToken,
        installSessionId: installSessionIdRef.current,
        failureStage: input.kind,
        errorTitle: input.title,
        errorMessage: input.message,
        extraDiagnostics: {
          stack: input.stack || null,
          source: 'global-exception-listener',
        },
      }).catch((error) => {
        console.error('[fault-report] auto submit uncaught failure', {
          kind: input.kind,
          title: input.title,
          message: input.message,
          hasStack: Boolean(input.stack),
          error,
        });
      });
    };

    const onError = (event: ErrorEvent) => {
      const detail = event.error instanceof Error ? event.error : null;
      void trackClientCrash({
        client,
        accessToken,
        crashType: 'renderer',
        errorTitle: 'Unhandled Error',
        errorMessage: detail?.message || event.message || '应用异常',
        stackSummary: detail?.stack || null,
      }).catch(() => undefined);
      maybeUploadAutoDiagnostics({
        kind: 'renderer_error',
        title: 'Unhandled Error',
        message: detail?.message || event.message || '应用异常',
        stack: detail?.stack || null,
      });
      setGlobalException({
        title: '应用异常',
        message: detail?.message || event.message || '应用在运行过程中遇到意外错误',
        stack: detail?.stack || null,
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason : null;
      void trackClientCrash({
        client,
        accessToken,
        crashType: 'renderer',
        errorTitle: 'Unhandled Promise Rejection',
        errorMessage:
          reason?.message ||
          (typeof event.reason === 'string' && event.reason.trim()
            ? event.reason.trim()
            : '应用在运行过程中遇到未处理的 Promise 异常'),
        stackSummary: reason?.stack || null,
      }).catch(() => undefined);
      maybeUploadAutoDiagnostics({
        kind: 'renderer_rejection',
        title: 'Unhandled Promise Rejection',
        message:
          reason?.message ||
          (typeof event.reason === 'string' && event.reason.trim()
            ? event.reason.trim()
            : '应用在运行过程中遇到未处理的 Promise 异常'),
        stack: reason?.stack || null,
      });
      setGlobalException({
        title: '应用异常',
        message:
          reason?.message ||
          (typeof event.reason === 'string' && event.reason.trim()
            ? event.reason.trim()
            : '应用在运行过程中遇到未处理的 Promise 异常'),
        stack: reason?.stack || null,
      });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [accessToken, client]);

  useEffect(() => {
    if (!shouldShowAuthBootstrapHint) {
      setAuthBootstrapHintVisible(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setAuthBootstrapHintVisible(true);
    }, 420);

    return () => window.clearTimeout(timer);
  }, [shouldShowAuthBootstrapHint]);

  useEffect(() => {
    if (!desktopUpdateHint) return;
    if (desktopUpdateHint.latestVersion !== skippedDesktopUpdateVersion) {
      desktopUpdateAutoTriggeredVersionRef.current = null;
      if (desktopUpdateActionState !== 'ready-to-restart') {
        setDesktopUpdateActionState('idle');
      }
      setDesktopUpdateError(null);
      if (desktopUpdateActionState !== 'downloading') {
        setDesktopUpdateProgress(null);
        setDesktopUpdateDetail(null);
      }
    }
  }, [desktopUpdateActionState, desktopUpdateHint, skippedDesktopUpdateVersion]);

  const effectiveDesktopUpdateHint = desktopUpdateHint?.updateAvailable ? desktopUpdateHint : null;
  const desktopUpdateGateState = resolveDesktopUpdateGateState({
    hint: effectiveDesktopUpdateHint,
    skippedVersion: skippedDesktopUpdateVersion,
    currentRunBusy: chatSurfaceBusy,
    readyToRestart: desktopUpdateActionState === 'ready-to-restart',
  });
  const visibleDesktopUpdateHint =
    effectiveDesktopUpdateHint &&
    (desktopUpdateActionState === 'ready-to-restart' ||
      shouldShowDesktopUpdateHint(effectiveDesktopUpdateHint, skippedDesktopUpdateVersion))
      ? effectiveDesktopUpdateHint
      : null;
  const desktopUpdateEnforcementState = normalizeDesktopUpdateEnforcementState(effectiveDesktopUpdateHint);
  const desktopUpdateNewRunBlockedReason =
    desktopUpdateGateState === 'required_waiting_current_run'
      ? '当前版本已进入强更流程。现有任务可以继续执行，但新的对话或任务要等升级完成后再发起。'
      : desktopUpdateGateState === 'required_blocked'
        ? '当前版本需要升级后才能继续发起新的对话或任务。'
        : desktopUpdateGateState === 'ready_to_restart'
          ? '新版本已经安装完成，请先重启应用后继续。'
          : null;
  const desktopUpdateSendBlockedReason =
    desktopUpdateGateState === 'required_blocked' || desktopUpdateGateState === 'ready_to_restart'
      ? desktopUpdateNewRunBlockedReason
      : null;

  useEffect(() => {
    if (!authBootstrapReady || (IS_TAURI_RUNTIME && shouldShowStartupGate)) {
      return;
    }
    void handleCheckForDesktopUpdates({ silent: true });
  }, [authBootstrapReady, shouldShowStartupGate]);

  useEffect(() => {
    if (!authBootstrapReady || (IS_TAURI_RUNTIME && shouldShowStartupGate)) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (Date.now() - desktopUpdateLastCheckedAtRef.current < DESKTOP_UPDATE_REVALIDATE_TTL_MS) {
        return;
      }
      void handleCheckForDesktopUpdates({ silent: true });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authBootstrapReady, shouldShowStartupGate]);

  useEffect(() => {
    if (!effectiveDesktopUpdateHint) {
      return;
    }
    if (desktopUpdateGateState === 'required_waiting_current_run') {
      setDesktopUpdateStatusMessage(buildDesktopUpdateAnnouncement(effectiveDesktopUpdateHint));
      return;
    }
    if (desktopUpdateGateState === 'required_blocked') {
      setDesktopUpdateStatusMessage(`当前版本需要升级到 ${effectiveDesktopUpdateHint.latestVersion} 后继续使用。`);
      return;
    }
    if (desktopUpdateGateState === 'ready_to_restart') {
      setDesktopUpdateStatusMessage(`版本 ${effectiveDesktopUpdateHint.latestVersion} 已安装完成，重启后生效。`);
    }
  }, [desktopUpdateGateState, effectiveDesktopUpdateHint]);

  useEffect(() => {
    const snapshot = readDesktopUpdateSceneSnapshot();
    if (!snapshot) {
      return;
    }
    if (formatDesktopUpdateVersion(DESKTOP_APP_VERSION) !== formatDesktopUpdateVersion(snapshot.targetVersion)) {
      return;
    }
    void clearDesktopUpdateSceneSnapshot()
      .then(() => {
        setDesktopUpdateStatusMessage('已恢复到升级前页面。');
      })
      .catch((error) => {
        console.warn('[desktop] failed to clear desktop update scene snapshot', error);
      });
  }, []);

  useEffect(() => {
    if (!authBootstrapReady || guestPromptInitialized || (IS_TAURI_RUNTIME && shouldShowStartupGate)) {
      return;
    }
    setGuestPromptInitialized(true);
    if (!isAuthenticated) {
      setPrimaryView('chat');
      setAuthModalMode('login');
      setAuthModalOpen(true);
    }
  }, [authBootstrapReady, guestPromptInitialized, isAuthenticated, shouldShowStartupGate]);
  const desktopUpdateCardStatus =
    desktopUpdateActionState === 'ready-to-restart'
      ? 'ready-to-restart'
      : desktopUpdateActionState === 'downloading'
        ? 'downloading'
        : desktopUpdateActionState === 'checking'
          ? 'checking'
          : 'available';

  const handleSkipDesktopUpdate = () => {
    if (!desktopUpdateHint || desktopUpdateHint.mandatory) return;
    void writeSkippedDesktopUpdateVersion(desktopUpdateHint.latestVersion);
    setSkippedDesktopUpdateVersion(desktopUpdateHint.latestVersion);
    setDesktopUpdateActionState('idle');
    setDesktopUpdateError(null);
    setDesktopUpdateProgress(null);
    setDesktopUpdateDetail(null);
    setDesktopUpdateStatusMessage(`已跳过版本 ${desktopUpdateHint.latestVersion}`);
  };

  const handleCheckForDesktopUpdates = async (options: {silent?: boolean} = {}) => {
    const { silent = false } = options;
    if (desktopUpdateCheckInFlightRef.current || desktopUpdateActionState === 'downloading') {
      return;
    }
    desktopUpdateCheckInFlightRef.current = true;
    if (!silent) {
      setDesktopUpdateError(null);
      setDesktopUpdateStatusMessage(null);
      if (desktopUpdateActionState !== 'ready-to-restart') {
        setDesktopUpdateActionState('checking');
        setDesktopUpdateProgress(null);
        setDesktopUpdateDetail('正在检查是否有新版本。');
      }
    }
    try {
      const hint = await client.getDesktopUpdateHint({
        appVersion: DESKTOP_APP_VERSION,
        channel: DESKTOP_RELEASE_CHANNEL,
      });
      desktopUpdateLastCheckedAtRef.current = Date.now();
      if (hint.updateAvailable) {
        setDesktopUpdateHint(hint);
        if (!silent || normalizeDesktopUpdateEnforcementState(hint) !== 'recommended') {
          setDesktopUpdateStatusMessage(buildDesktopUpdateAnnouncement(hint));
        }
      } else {
        setDesktopUpdateHint(null);
        if (!silent) {
          setDesktopUpdateStatusMessage('当前已是最新版本。');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '检查更新失败';
      if (!silent) {
        setDesktopUpdateError(message);
        setDesktopUpdateStatusMessage(message);
      }
    } finally {
      desktopUpdateCheckInFlightRef.current = false;
      if (!silent && desktopUpdateActionState !== 'ready-to-restart') {
        setDesktopUpdateActionState('idle');
      }
    }
  };

  const handleUpgradeDesktopApp = useCallback(async () => {
    if (!effectiveDesktopUpdateHint) return;
    setDesktopUpdateActionState('checking');
    setDesktopUpdateError(null);
    setDesktopUpdateStatusMessage(null);
    try {
      const result = await executeDesktopUpdateUpgrade({
        hint: effectiveDesktopUpdateHint,
        config: {
          authBaseUrl: AUTH_BASE_URL,
          appName: BRAND.brandId,
          channel: DESKTOP_RELEASE_CHANNEL,
        },
        deps: {
          isTauriRuntime: IS_TAURI_RUNTIME,
          platform: DESKTOP_RUNTIME_PLATFORM,
          checkDesktopUpdate,
          downloadAndInstallDesktopUpdate,
          downloadAndLaunchDesktopInstaller,
          onBeforeInstallerLaunch: async ({ hint, artifactUrl }) => {
            await writeDesktopUpdateSceneSnapshot({
              targetVersion: hint.latestVersion,
              installerUrl: artifactUrl,
              primaryView,
              overlayView,
            });
          },
          openExternal: (url) => {
            void openExternalUrl(url);
          },
        },
      });

      if (result.actionState === 'downloading') {
        setDesktopUpdateActionState('downloading');
        setDesktopUpdateProgress(result.progress);
        setDesktopUpdateDetail(result.detail);
        return;
      }

      setDesktopUpdateActionState(result.actionState);
      setDesktopUpdateStatusMessage(result.statusMessage);
    } catch (error) {
      desktopUpdateAutoTriggeredVersionRef.current = null;
      setDesktopUpdateActionState('idle');
      setDesktopUpdateError(error instanceof Error ? error.message : '打开更新链接失败');
      setDesktopUpdateStatusMessage(error instanceof Error ? error.message : '打开更新链接失败');
    }
  }, [effectiveDesktopUpdateHint, overlayView, primaryView]);

  const handleRestartDesktopApp = async () => {
    if (!IS_TAURI_RUNTIME) return;
    await restartDesktopApp();
  };

  useEffect(() => {
    if (!IS_TAURI_RUNTIME || DESKTOP_RUNTIME_PLATFORM !== 'windows') {
      return;
    }
    if (!effectiveDesktopUpdateHint || desktopUpdateGateState !== 'required_blocked') {
      return;
    }
    if (desktopUpdateActionState !== 'idle') {
      return;
    }
    if (desktopUpdateAutoTriggeredVersionRef.current === effectiveDesktopUpdateHint.latestVersion) {
      return;
    }
    desktopUpdateAutoTriggeredVersionRef.current = effectiveDesktopUpdateHint.latestVersion;
    void handleUpgradeDesktopApp();
  }, [
    desktopUpdateActionState,
    desktopUpdateGateState,
    effectiveDesktopUpdateHint,
    handleUpgradeDesktopApp,
  ]);

  return (
    <SettingsProvider>
      <div className="relative h-screen overflow-hidden">
        {authBootstrapHintVisible ? (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center px-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--bg-elevated)_86%,transparent)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-[var(--brand-primary)] motion-safe:animate-pulse" />
              <span>正在恢复登录状态</span>
            </div>
          </div>
        ) : null}
        <DesktopUpdateGuard
          hint={effectiveDesktopUpdateHint}
          gateState={desktopUpdateGateState}
          busy={desktopUpdateActionState === 'checking' || desktopUpdateActionState === 'downloading'}
          onUpgrade={handleUpgradeDesktopApp}
          onRestart={handleRestartDesktopApp}
        />
        <AuthedView
          key={resolveAuthUserPersistenceScope(currentUser) || 'guest'}
          primaryView={primaryView}
          setPrimaryView={setPrimaryView}
          brandShellConfig={brandShellConfig}
          showStartupGate={shouldShowStartupGate}
          revalidateBrandRuntimeConfig={syncBrandRuntimeSnapshot}
          overlayView={overlayView}
          setOverlayView={setOverlayView}
          client={client}
          imBotClient={imBotClient}
          accessToken={accessToken}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          gatewayAuth={gatewayAuth}
          handleLogout={handleLogout}
          authenticated={isAuthenticated}
          authBootstrapReady={authBootstrapReady}
          authModalOpen={authModalOpen}
          onRequestAuth={openAuthModal}
          desktopUpdateHint={visibleDesktopUpdateHint}
          desktopUpdateBusy={
            desktopUpdateActionState === 'checking' || desktopUpdateActionState === 'downloading'
          }
          desktopUpdateError={desktopUpdateError}
          desktopUpdateOpened={desktopUpdateActionState === 'opened'}
          desktopUpdateStatus={desktopUpdateCardStatus}
          desktopUpdateProgress={desktopUpdateProgress}
          desktopUpdateDetail={desktopUpdateDetail}
          onUpgradeDesktopApp={handleUpgradeDesktopApp}
          onRestartDesktopApp={handleRestartDesktopApp}
          onSkipDesktopUpdate={handleSkipDesktopUpdate}
          onCheckForDesktopUpdates={handleCheckForDesktopUpdates}
          desktopUpdateCurrentVersion={DISPLAY_DESKTOP_APP_VERSION}
          desktopUpdateLatestVersion={effectiveDesktopUpdateHint?.latestVersion || null}
          desktopUpdateMandatory={Boolean(effectiveDesktopUpdateHint?.mandatory)}
          desktopUpdateEnforcementState={desktopUpdateEnforcementState}
          desktopUpdatePolicyLabel={resolveDesktopUpdatePolicyLabel(effectiveDesktopUpdateHint)}
          desktopUpdateNewRunBlockedReason={desktopUpdateNewRunBlockedReason}
          desktopUpdateSendBlockedReason={desktopUpdateSendBlockedReason}
          ensureRuntimeReadyForRecovery={ensureChatRuntimeReady}
          onChatBusyChange={setChatSurfaceBusy}
          desktopUpdateChecking={desktopUpdateActionState === 'checking'}
          desktopUpdateReadyToRestart={desktopUpdateActionState === 'ready-to-restart'}
          desktopUpdateStatusMessage={desktopUpdateStatusMessage}
        />
        {shouldShowStartupGate ? (
          <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="本地运行环境安装进度">
            <FirstRunSetupPanel
              presentation="fullscreen"
              state={installerView.state}
              title={installerView.title}
              subtitle={installerView.subtitle}
              progress={installerView.progress}
              stepLabel={installerView.stepLabel}
              stepDetail={installerView.stepDetail}
              errorMessage={installerView.errorMessage}
              errorTitle={installerView.errorTitle}
              diagnosticItems={installerView.diagnosticItems}
              onRetry={retrySetup}
              onReportFault={() => setInstallerFaultReportOpen(true)}
            />
          </div>
        ) : null}
        <FaultReportModal
          open={installerFaultReportOpen}
          source="installer"
          client={client}
          accessToken={accessToken}
          accountState={accessToken ? 'authenticated' : 'anonymous'}
          installSessionId={installSessionIdRef.current}
          failureStage={runtimeInstallProgress?.phase || 'runtime_install'}
          errorTitle={installerView.errorTitle || '首次启动初始化失败'}
          errorMessage={installerView.errorMessage || installerView.stepDetail}
          installProgressPhase={runtimeInstallProgress?.phase || null}
          installProgressPercent={runtimeInstallProgress?.progress ?? installerView.progress}
          extraDiagnostics={{
            installerView,
            runtimeDiagnosis,
            startupDiagnostics,
          }}
          onClose={() => setInstallerFaultReportOpen(false)}
        />
        <GlobalExceptionDialog
          exception={globalException}
          client={client}
          accessToken={accessToken}
          accountState={accessToken ? 'authenticated' : 'anonymous'}
          installSessionId={installSessionIdRef.current}
          onClose={() => setGlobalException(null)}
        />
        {authModalOpen ? (
          <AuthPanel
            open={authModalOpen}
            initialMode={authModalMode}
            loading={authLoading}
            error={authError}
            experienceConfig={authExperienceConfig}
            socialLoadingProvider={socialLoadingProvider}
            onClose={() => {
              setAuthModalOpen(false);
              setPostAuthView(null);
            }}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onSocialLogin={handleSocialLogin}
          />
        ) : null}
      </div>
    </SettingsProvider>
  );
}

interface AuthedViewProps {
  primaryView: PrimaryView;
  setPrimaryView: Dispatch<SetStateAction<PrimaryView>>;
  brandShellConfig: Record<string, unknown> | null;
  showStartupGate: boolean;
  revalidateBrandRuntimeConfig: () => Promise<void>;
  overlayView: OverlayView | null;
  setOverlayView: Dispatch<SetStateAction<OverlayView | null>>;
  client: IClawClient;
  imBotClient: IClawClient;
  accessToken: string | null;
  currentUser: AuthUser | null;
  setCurrentUser: Dispatch<SetStateAction<AuthUser | null>>;
  gatewayAuth: { token?: string; password?: string };
  handleLogout: () => void;
  authenticated: boolean;
  authBootstrapReady: boolean;
  authModalOpen: boolean;
  onRequestAuth: (mode?: 'login' | 'register', nextView?: 'account' | 'recharge' | null) => void;
  desktopUpdateHint: DesktopUpdateHint | null;
  desktopUpdateBusy: boolean;
  desktopUpdateError: string | null;
  desktopUpdateOpened: boolean;
  desktopUpdateStatus: 'available' | 'checking' | 'downloading' | 'ready-to-restart';
  desktopUpdateProgress: number | null;
  desktopUpdateDetail: string | null;
  onUpgradeDesktopApp: () => void;
  onRestartDesktopApp: () => void;
  onSkipDesktopUpdate: () => void;
  onCheckForDesktopUpdates: () => void;
  desktopUpdateCurrentVersion: string;
  desktopUpdateLatestVersion: string | null;
  desktopUpdateMandatory: boolean;
  desktopUpdateEnforcementState: 'recommended' | 'required_after_run' | 'required_now';
  desktopUpdatePolicyLabel: string;
  desktopUpdateNewRunBlockedReason: string | null;
  desktopUpdateSendBlockedReason: string | null;
  ensureRuntimeReadyForRecovery: () => Promise<
    'unsupported' | 'healthy' | 'restarted' | 'restarting' | 'cooldown' | 'failed'
  >;
  onChatBusyChange: (busy: boolean) => void;
  desktopUpdateChecking: boolean;
  desktopUpdateReadyToRestart: boolean;
  desktopUpdateStatusMessage: string | null;
}

function AuthedView({
  primaryView,
  setPrimaryView,
  brandShellConfig,
  showStartupGate,
  revalidateBrandRuntimeConfig,
  overlayView,
  setOverlayView,
  client,
  imBotClient,
  accessToken,
  currentUser,
  setCurrentUser,
  gatewayAuth,
  handleLogout,
  authenticated,
  authBootstrapReady,
  authModalOpen,
  onRequestAuth,
  desktopUpdateHint,
  desktopUpdateBusy,
  desktopUpdateError,
  desktopUpdateOpened,
  desktopUpdateStatus,
  desktopUpdateProgress,
  desktopUpdateDetail,
  onUpgradeDesktopApp,
  onRestartDesktopApp,
  onSkipDesktopUpdate,
  onCheckForDesktopUpdates,
  desktopUpdateCurrentVersion,
  desktopUpdateLatestVersion,
  desktopUpdateMandatory,
  desktopUpdateEnforcementState,
  desktopUpdatePolicyLabel,
  desktopUpdateNewRunBlockedReason,
  desktopUpdateSendBlockedReason,
  ensureRuntimeReadyForRecovery,
  onChatBusyChange,
  desktopUpdateChecking,
  desktopUpdateReadyToRestart,
  desktopUpdateStatusMessage,
}: AuthedViewProps) {
  const { buildSectionSaveSnapshot, commitSectionSave } = useSettings();
  const lastResolvedPrimaryViewRef = useRef<PrimaryView | null>(null);
  const chatRuntimeAuthRef = useRef(authenticated);
  const initialChatRouteRef = useRef<ActiveChatRoute>(resolveInitialChatRoute());
  const lastRehydratedChatScopeRef = useRef<string | null>(null);
  const sidebarCollapsedStorageKey = useMemo(
    () => resolveSidebarCollapsedStorageKey(currentUser),
    [currentUser],
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => readSidebarCollapsedPreference(currentUser));
  const [selectedTaskCenterConversationId, setSelectedTaskCenterConversationId] = useState<string | null>(
    () => readPersistedWorkspaceScene().selectedConversationId,
  );
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [cronNotificationSelection, setCronNotificationSelection] = useState<{
    jobId: string;
    token: number;
  } | null>(null);
  const [activeChatRoute, setActiveChatRoute] = useState<ActiveChatRoute>(() => initialChatRouteRef.current);
  const [chatSurfaceEntries, setChatSurfaceEntries] = useState<Record<string, ChatSurfaceEntry>>(() => {
    const initialRoute = initialChatRouteRef.current;
    return {
      [buildChatSurfaceCacheKey(initialRoute)]: {
        route: initialRoute,
        version: 0,
      },
    };
  });
  const [chatSurfaceRuntimeState, setChatSurfaceRuntimeState] = useState<Record<string, ChatSurfaceRuntimeState>>({});
  const [creditBalance, setCreditBalance] = useState<CreditBalanceData | null>(null);
  const [creditBalanceLoading, setCreditBalanceLoading] = useState(false);
  const appNotifications = useAppNotifications();
  const surfaceCacheLimits = useMemo(
    () =>
      resolveSurfaceCacheLimits({
        isTauriRuntime: IS_TAURI_RUNTIME,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        platform: typeof navigator !== 'undefined' ? navigator.platform : null,
      }),
    [],
  );
  const surfaceCache = useSurfaceCacheManager(surfaceCacheLimits);
  const {
    ensureMounted: ensureSurfaceMounted,
    ensureVisible: ensureSurfaceVisible,
    hidePool: hideSurfacePool,
    updateFlags: updateSurfaceFlags,
    getMountedKeys: getMountedSurfaceKeys,
    isVisible: isSurfaceVisible,
  } = surfaceCache;
  const activeChatRouteRef = useRef(activeChatRoute);
  const chatSurfaceEntriesRef = useRef(chatSurfaceEntries);
  const selectedTaskCenterConversationIdRef = useRef(selectedTaskCenterConversationId);
  const enabledMenuKeys = useMemo(
    () => resolveRequiredEnabledMenuKeys(brandShellConfig).filter((key) => key !== 'task-center'),
    [brandShellConfig],
  );
  const menuUiConfig = useMemo(
    () => resolveRequiredMenuUiConfig(brandShellConfig, [...enabledMenuKeys, 'chat', 'task-center']),
    [brandShellConfig, enabledMenuKeys],
  );
  const headerConfig = useMemo(() => resolveHeaderConfig(brandShellConfig), [brandShellConfig]);
  const inputComposerConfig = useMemo(() => resolveInputComposerConfig(brandShellConfig), [brandShellConfig]);
  const welcomePageConfig = useMemo(() => resolveWelcomePageConfig(brandShellConfig), [brandShellConfig]);
  const availablePrimaryViews = useMemo(
    () => enabledMenuKeys.filter((key) => key !== 'settings') as PrimaryView[],
    [enabledMenuKeys],
  );
  const fallbackPrimaryView = availablePrimaryViews[0] || 'chat';
  const resolvedChatPersistenceScope = resolveAuthUserPersistenceScope(currentUser) ?? 'guest';
  const resolvedPrimaryView =
    primaryView === 'task-center'
      ? 'task-center'
      : availablePrimaryViews.includes(primaryView)
        ? primaryView
        : fallbackPrimaryView;
  const notificationItems = useMemo(
    () => buildNotificationCenterItems(appNotifications),
    [appNotifications],
  );
  const unreadNotificationCount = useMemo(
    () => notificationItems.filter((item) => !item.isRead).length,
    [notificationItems],
  );
  const selectedNotification = useMemo(
    () => notificationItems.find((item) => item.id === selectedNotificationId) ?? null,
    [notificationItems, selectedNotificationId],
  );
  const chatShellAuthenticated =
    authenticated ||
    Boolean(accessToken) ||
    (!authModalOpen && authBootstrapReady && chatRuntimeAuthRef.current);
  const chatMenuLabel = menuUiConfig.chat.displayName;
  const keepChatSurfaceMounted =
    !showStartupGate && authBootstrapReady;
  const showWelcomeBackground =
    !authenticated &&
    authBootstrapReady &&
    welcomePageConfig?.enabled !== false;
  const showChatWelcomeBeforeAuthBootstrap =
    resolvedPrimaryView === 'chat' &&
    !showStartupGate &&
    !authenticated &&
    !accessToken &&
    welcomePageConfig?.enabled !== false;
  const targetChatSurfaceKey = buildChatSurfaceCacheKey(activeChatRoute);
  const mountedMenuSurfaceKeys = getMountedSurfaceKeys('menu');
  const mountedOverlaySurfaceKeys = getMountedSurfaceKeys('overlay') as OverlayView[];
  const activeChatSurfaceEntry = chatSurfaceEntries[targetChatSurfaceKey] ?? {
    route: activeChatRoute,
    version: 0,
  };
  const hasAnyBusyChatSurface = Boolean(chatSurfaceRuntimeState[targetChatSurfaceKey]?.busy);

  useEffect(() => {
    if (selectedNotificationId && !selectedNotification) {
      setSelectedNotificationId(null);
    }
  }, [selectedNotification, selectedNotificationId]);

  useEffect(() => {
    if (authenticated || accessToken) {
      chatRuntimeAuthRef.current = true;
      return;
    }
    if (authModalOpen) {
      chatRuntimeAuthRef.current = false;
    }
  }, [accessToken, authModalOpen, authenticated]);

  useEffect(() => {
    onChatBusyChange(hasAnyBusyChatSurface);
  }, [hasAnyBusyChatSurface, onChatBusyChange]);

  useEffect(() => {
    if (primaryView === resolvedPrimaryView) {
      return;
    }
    setPrimaryView(resolvedPrimaryView);
  }, [primaryView, resolvedPrimaryView, setPrimaryView]);

  useEffect(() => {
    writePersistedWorkspaceScene({selectedConversationId: selectedTaskCenterConversationId});
  }, [selectedTaskCenterConversationId]);

  useEffect(() => {
    writeCacheString(sidebarCollapsedStorageKey, sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed, sidebarCollapsedStorageKey]);

  useEffect(() => {
    setSidebarCollapsed(readSidebarCollapsedPreference(currentUser));
  }, [currentUser]);

  useEffect(() => {
    activeChatRouteRef.current = activeChatRoute;
  }, [activeChatRoute]);

  useEffect(() => {
    chatSurfaceEntriesRef.current = chatSurfaceEntries;
  }, [chatSurfaceEntries]);

  useEffect(() => {
    selectedTaskCenterConversationIdRef.current = selectedTaskCenterConversationId;
  }, [selectedTaskCenterConversationId]);

  useEffect(() => {
    const lastView = lastResolvedPrimaryViewRef.current;
    lastResolvedPrimaryViewRef.current = resolvedPrimaryView;
    if (resolvedPrimaryView !== 'chat' || lastView === 'chat') {
      return;
    }
    void revalidateBrandRuntimeConfig().catch((error) => {
      console.warn('[desktop] failed to revalidate OEM runtime config on chat entry', error);
    });
  }, [resolvedPrimaryView, revalidateBrandRuntimeConfig]);

  useEffect(() => {
    const activeChatSurfaceKey = buildChatSurfaceCacheKey(activeChatRoute);
    setChatSurfaceEntries((current) => {
      const existing = current[activeChatSurfaceKey];
      const nextEntry: ChatSurfaceEntry = {
        route: activeChatRoute,
        version: existing?.version ?? 0,
      };
      if (
        existing &&
        existing.version === nextEntry.version &&
        existing.route.sessionKey === nextEntry.route.sessionKey &&
        existing.route.conversationId === nextEntry.route.conversationId &&
        existing.route.initialPrompt === nextEntry.route.initialPrompt &&
        existing.route.initialPromptKey === nextEntry.route.initialPromptKey &&
        existing.route.focusedTurnId === nextEntry.route.focusedTurnId &&
        existing.route.focusedTurnKey === nextEntry.route.focusedTurnKey &&
        existing.route.initialAgentSlug === nextEntry.route.initialAgentSlug &&
        existing.route.initialSkillSlug === nextEntry.route.initialSkillSlug &&
        JSON.stringify(existing.route.initialSkillOption) === JSON.stringify(nextEntry.route.initialSkillOption) &&
        JSON.stringify(existing.route.initialStockContext) === JSON.stringify(nextEntry.route.initialStockContext)
      ) {
        return current;
      }
      return {
        ...current,
        [activeChatSurfaceKey]: nextEntry,
      };
    });
    setChatSurfaceRuntimeState((current) => {
      const previous = current[activeChatSurfaceKey];
      const next = {
        busy: previous?.busy ?? false,
        hasPendingBilling: previous?.hasPendingBilling ?? false,
        ready: false,
      };
      if (
        previous &&
        previous.busy === next.busy &&
        previous.hasPendingBilling === next.hasPendingBilling &&
        previous.ready === next.ready
      ) {
        return current;
      }
      return {
        ...current,
        [activeChatSurfaceKey]: next,
      };
    });
  }, [activeChatRoute]);

  useEffect(() => {
    if (isRenderableMenuPrimaryView(resolvedPrimaryView)) {
      ensureSurfaceVisible('menu', resolvedPrimaryView);
      return;
    }
    hideSurfacePool('menu');
  }, [ensureSurfaceVisible, hideSurfacePool, resolvedPrimaryView]);

  useEffect(() => {
    if (overlayView) {
      ensureSurfaceVisible('overlay', overlayView);
      return;
    }
    hideSurfacePool('overlay');
  }, [ensureSurfaceVisible, hideSurfacePool, overlayView]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.__ICLAW_APP_DIAGNOSTICS__ = {
      primaryView: resolvedPrimaryView,
      keepChatSurfaceMounted,
      activeChatRoute,
      targetChatSurfaceKey,
      mountedMenuSurfaceKeys,
      mountedOverlaySurfaceKeys,
      activeChatSurfaceEntry,
      chatSurfaceEntries: Object.fromEntries(
        Object.entries(chatSurfaceEntries).map(([key, entry]) => [
          key,
          {
            version: entry.version,
            route: entry.route,
          },
        ]),
      ),
      chatSurfaceRuntimeState,
      surfaceCache: {
        activeKeys: surfaceCache.state.activeKeys,
        records: Object.fromEntries(
          Object.entries(surfaceCache.state.records).map(([recordId, record]) => [
            recordId,
            {
              pool: record.pool,
              key: record.key,
              visible: record.visible,
              mounted: record.mounted,
              busy: record.busy,
              hasPendingBilling: record.hasPendingBilling,
              hasUnsavedDraft: record.hasUnsavedDraft,
              lifecycleState: record.lifecycleState,
              snapshotVersion: record.snapshotVersion,
            },
          ]),
        ),
      },
    };
  }, [
    activeChatRoute,
    activeChatSurfaceEntry,
    chatSurfaceEntries,
    chatSurfaceRuntimeState,
    keepChatSurfaceMounted,
    mountedMenuSurfaceKeys,
    mountedOverlaySurfaceKeys,
    resolvedPrimaryView,
    surfaceCache.state.activeKeys,
    surfaceCache.state.records,
    targetChatSurfaceKey,
  ]);

  const openChatRoute = useCallback(
    (nextRoute: ActiveChatRoute, options?: {forceRemount?: boolean}) => {
      const nextSurfaceKey = buildChatSurfaceCacheKey(nextRoute);
      setChatSurfaceEntries((current) => {
        const existing = current[nextSurfaceKey];
        return {
          ...current,
          [nextSurfaceKey]: {
            route: nextRoute,
            version: options?.forceRemount ? (existing?.version ?? 0) + 1 : (existing?.version ?? 0),
          },
        };
      });
      setActiveChatRoute(
        buildActiveChatRoute({
          sessionKey: nextRoute.sessionKey,
          conversationId: nextRoute.conversationId,
          kind: 'general',
          initialPrompt: nextRoute.initialPrompt,
          initialPromptKey: nextRoute.initialPromptKey,
          focusedTurnId: nextRoute.focusedTurnId,
          focusedTurnKey: nextRoute.focusedTurnKey,
          initialAgentSlug: nextRoute.initialAgentSlug,
          initialSkillSlug: nextRoute.initialSkillSlug,
          initialSkillOption: nextRoute.initialSkillOption,
          initialStockContext: nextRoute.initialStockContext,
        }),
      );
      setPrimaryView('chat');
    },
    [setPrimaryView],
  );

  useEffect(() => {
    if (!authBootstrapReady) {
      return;
    }
    if (lastRehydratedChatScopeRef.current === resolvedChatPersistenceScope) {
      return;
    }
    lastRehydratedChatScopeRef.current = resolvedChatPersistenceScope;

    const currentRoute = activeChatRouteRef.current;
    if (!canReuseEmptyUnnamedGeneralConversation(currentRoute, BRAND.brandId)) {
      return;
    }

    const persistedRoute = readPersistedActiveChatRoute();
    if (!persistedRoute) {
      return;
    }

    if (
      persistedRoute.sessionKey === currentRoute.sessionKey &&
      persistedRoute.conversationId === currentRoute.conversationId
    ) {
      return;
    }

    openChatRoute(
      buildConversationBackedChatRoute({
        sessionKey: persistedRoute.sessionKey,
        conversationId: persistedRoute.conversationId,
        kind: 'general',
        initialPrompt: persistedRoute.initialPrompt,
        initialPromptKey: persistedRoute.initialPromptKey,
        focusedTurnId: null,
        focusedTurnKey: null,
        initialAgentSlug: persistedRoute.initialAgentSlug,
        initialSkillSlug: persistedRoute.initialSkillSlug,
        initialSkillOption: persistedRoute.initialSkillOption,
        initialStockContext: persistedRoute.initialStockContext,
      }),
      {forceRemount: true},
    );
  }, [authBootstrapReady, openChatRoute, resolvedChatPersistenceScope]);

  useEffect(() => {
    writePersistedActiveChatRoute(activeChatRoute);
  }, [activeChatRoute]);

  useEffect(() => {
    if (!activeChatRoute.conversationId) {
      return;
    }
    syncChatConversationMetadata({
      conversationId: activeChatRoute.conversationId,
      sessionKey: activeChatRoute.sessionKey,
      restoreContext: {
        initialAgentSlug: activeChatRoute.initialAgentSlug,
        initialSkillSlug: activeChatRoute.initialSkillSlug,
        initialSkillOption: activeChatRoute.initialSkillOption,
        initialStockContext: activeChatRoute.initialStockContext,
      },
    });
  }, [
    activeChatRoute.conversationId,
    activeChatRoute.initialAgentSlug,
    activeChatRoute.initialSkillOption,
    activeChatRoute.initialSkillSlug,
    activeChatRoute.initialStockContext,
    activeChatRoute.sessionKey,
  ]);

  useEffect(() => {
    if (!isGeneralChatSessionKey(activeChatRoute.sessionKey)) {
      return;
    }
    writePersistedActiveGeneralChatSessionKey(activeChatRoute.sessionKey);
  }, [activeChatRoute.sessionKey]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    void syncManagedSkills({ client, accessToken }).catch((error) => {
      console.error('[desktop] failed to sync managed skills', error);
    });
  }, [accessToken, client]);

  useEffect(() => {
    if (!accessToken) {
      setCreditBalance(null);
      setCreditBalanceLoading(false);
      return;
    }

    let cancelled = false;
    const loadCreditBalance = async () => {
      setCreditBalanceLoading(true);
      try {
        const next = await client.creditsMe(accessToken);
        if (!cancelled) {
          setCreditBalance(next);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[desktop] failed to load credit balance', error);
        }
      } finally {
        if (!cancelled) {
          setCreditBalanceLoading(false);
        }
      }
    };

    void loadCreditBalance();
    const timer = window.setInterval(() => {
      void loadCreditBalance();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [accessToken, client]);

  const refreshCreditBalance = useCallback(async () => {
    if (!accessToken) {
      setCreditBalance(null);
      setCreditBalanceLoading(false);
      return;
    }

    setCreditBalanceLoading(true);
    try {
      const next = await client.creditsMe(accessToken);
      setCreditBalance(next);
    } catch (error) {
      console.error('[desktop] failed to refresh credit balance', error);
    } finally {
      setCreditBalanceLoading(false);
    }
  }, [accessToken, client]);

  const updateChatSurfaceRuntimeFlags = useCallback(
    (surfaceKey: string, patch: Partial<ChatSurfaceRuntimeState>) => {
      setChatSurfaceRuntimeState((current) => {
        const previous = current[surfaceKey] ?? {
          busy: false,
          hasPendingBilling: false,
          ready: false,
        };
        const next = {
          ...previous,
          ...patch,
        };
        if (
          previous.busy === next.busy &&
          previous.hasPendingBilling === next.hasPendingBilling &&
          previous.ready === next.ready
        ) {
          return current;
        }
        return {
          ...current,
          [surfaceKey]: next,
        };
      });
      updateSurfaceFlags('chat', surfaceKey, {
        ...(patch.busy === undefined ? {} : {busy: patch.busy}),
        ...(patch.hasPendingBilling === undefined ? {} : {hasPendingBilling: patch.hasPendingBilling}),
      });
    },
    [updateSurfaceFlags],
  );

  const handleSaveSettings = async (section: PersistableSettingsSection) => {
    const snapshot = buildSectionSaveSnapshot(section);
    if (section === 'identity' || section === 'user-profile' || section === 'soul-persona') {
      const content =
        section === 'identity'
          ? snapshot.identity.markdownContent
          : section === 'user-profile'
            ? snapshot.userProfile.markdownContent
            : snapshot.soulPersona.markdownContent;
      await saveIclawWorkspaceSection(section, content);
    }

    await commitSectionSave(section);

    if (
      accessToken &&
      (section === 'identity' || section === 'user-profile' || section === 'soul-persona')
    ) {
      const workspaceFiles = await loadIclawWorkspaceFiles();
      if (workspaceFiles) {
        try {
          await client.saveWorkspaceBackup({
            token: accessToken,
            identityMd: workspaceFiles.identity_md,
            userMd: workspaceFiles.user_md,
            soulMd: workspaceFiles.soul_md,
            agentsMd: workspaceFiles.agents_md,
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : '未知错误';
          throw new Error(`本地设置已保存，但云端备份失败：${detail}`);
        }
      }
    }
  };

  const handleHeaderAccountAction = useCallback(() => {
    if (!authenticated) {
      onRequestAuth('login', 'account');
      return;
    }
    setOverlayView('account');
  }, [authenticated, onRequestAuth, setOverlayView]);

  const handleHeaderRechargeAction = useCallback(() => {
    if (!authenticated) {
      onRequestAuth('login', 'recharge');
      return;
    }
    setOverlayView('recharge');
  }, [authenticated, onRequestAuth, setOverlayView]);

  const closeNotificationCenter = useCallback(() => {
    setNotificationCenterOpen(false);
    setSelectedNotificationId(null);
  }, []);

  const handleNotificationBellClick = useCallback(() => {
    setNotificationCenterOpen((current) => {
      const next = !current;
      if (!next) {
        setSelectedNotificationId(null);
      }
      return next;
    });
  }, []);

  const handleNotificationSelect = useCallback(
    (notification: (typeof notificationItems)[number]) => {
      markAppNotificationRead(notification.id);
      setSelectedNotificationId(notification.id);
    },
    [notificationItems],
  );

  const handleNotificationPrimaryAction = useCallback(
    (notification: (typeof notificationItems)[number]) => {
      markAppNotificationRead(notification.id);

      if (notification.routeTarget === 'cron' && notification.cronJobId) {
        setCronNotificationSelection({
          jobId: notification.cronJobId,
          token: Date.now(),
        });
        setPrimaryView('cron');
        closeNotificationCenter();
        return;
      }

      if (notification.routeTarget === 'chat' && notification.sessionKey) {
        const sessionKey = canonicalizeChatSessionKey(notification.sessionKey);
        const conversation =
          (notification.conversationId ? readChatConversation(notification.conversationId) : null) ||
          findChatConversationBySessionKey(sessionKey);
        openChatRoute(
          buildConversationBackedChatRoute({
            sessionKey,
            conversationId: conversation?.id ?? notification.conversationId ?? null,
            kind: conversation?.kind ?? 'general',
            title: conversation?.title ?? notification.details.taskName,
            initialPrompt: null,
            initialPromptKey: null,
            focusedTurnId: null,
            focusedTurnKey: null,
            initialAgentSlug: null,
            initialSkillSlug: null,
            initialSkillOption: null,
            initialStockContext: null,
          }),
        );
        closeNotificationCenter();
        return;
      }

      if (notification.routeTarget === 'task-center') {
        setSelectedTaskCenterConversationId(notification.conversationId ?? null);
        setPrimaryView('task-center');
        closeNotificationCenter();
      }
    },
    [closeNotificationCenter, openChatRoute, setPrimaryView],
  );

  const handleNotificationSecondaryAction = useCallback(
    (notification: (typeof notificationItems)[number]) => {
      markAppNotificationRead(notification.id);
      setSelectedTaskCenterConversationId(notification.conversationId ?? null);
      setPrimaryView('task-center');
      closeNotificationCenter();
    },
    [closeNotificationCenter, setPrimaryView],
  );

  const handleOpenChatView = useCallback(() => setPrimaryView('chat'), [setPrimaryView]);
  const handleOpenInvestmentExpertsView = useCallback(() => setPrimaryView('investment-experts'), [setPrimaryView]);
  const handleOpenCronView = useCallback(() => setPrimaryView('cron'), [setPrimaryView]);
  const handleOpenLobsterStoreView = useCallback(() => setPrimaryView('lobster-store'), [setPrimaryView]);
  const handleOpenSkillStoreView = useCallback(() => setPrimaryView('skill-store'), [setPrimaryView]);
  const handleOpenMcpStoreView = useCallback(() => setPrimaryView('mcp-store'), [setPrimaryView]);
  const handleOpenDataConnectionsView = useCallback(() => setPrimaryView('data-connections'), [setPrimaryView]);
  const handleOpenSecurityView = useCallback(() => setPrimaryView('security'), [setPrimaryView]);
  const handleOpenImBotsView = useCallback(() => setPrimaryView('im-bots'), [setPrimaryView]);
  const handleOpenMemoryView = useCallback(() => setPrimaryView('memory'), [setPrimaryView]);
  const handleOpenTaskCenterView = useCallback(() => setPrimaryView('task-center'), [setPrimaryView]);
  const handleOpenPrimaryMenu = useCallback((menuKey: string) => setPrimaryView(menuKey), [setPrimaryView]);
  const handleOpenLogin = useCallback(() => onRequestAuth('login'), [onRequestAuth]);
  const handleOpenSettingsOverlay = useCallback(() => setOverlayView('settings'), [setOverlayView]);
  const handleOpenAccountOverlay = useCallback(() => {
    if (!authenticated) {
      onRequestAuth('login', 'account');
      return;
    }
    setOverlayView('account');
  }, [authenticated, onRequestAuth, setOverlayView]);

  const handleStartLobsterConversation = (agent: LobsterAgent) => {
    if (desktopUpdateNewRunBlockedReason) {
      setPrimaryView('chat');
      return;
    }
    const seed = `${agent.slug}-${Date.now()}`;
    openChatRoute(buildConversationBackedChatRoute({
      sessionKey: createScopedChatSessionKey(`lobster-${seed}`),
      kind: 'lobster',
      title: agent.name,
      initialPrompt: null,
      initialPromptKey: seed,
      initialAgentSlug: agent.slug,
      initialSkillSlug: null,
      initialSkillOption: null,
      initialStockContext: null,
    }));
  };

  const handleStartInvestmentExpertConversation = (expert: InvestmentExpert) => {
    if (desktopUpdateNewRunBlockedReason) {
      setPrimaryView('chat');
      return;
    }
    const seed = `${expert.slug}-${Date.now()}`;
    openChatRoute(buildConversationBackedChatRoute({
      sessionKey: createScopedChatSessionKey(`investment-expert-${seed}`),
      kind: 'investment-expert',
      title: expert.name,
      initialPrompt: null,
      initialPromptKey: seed,
      initialAgentSlug: expert.slug,
      initialSkillSlug: expert.primarySkillSlug,
      initialSkillOption: null,
      initialStockContext: null,
    }));
  };

  const handleStartStockResearchConversation = (stock: MarketStockData) => {
    if (desktopUpdateNewRunBlockedReason) {
      setPrimaryView('chat');
      return;
    }
    const seed = `stock-${stock.symbol}-${Date.now()}`;
    openChatRoute(buildConversationBackedChatRoute({
      sessionKey: createScopedChatSessionKey(seed),
      kind: 'stock-research',
      title: `${stock.company_name} ${stock.symbol}`,
      initialPrompt: null,
      initialPromptKey: seed,
      initialAgentSlug: null,
      initialSkillSlug: null,
      initialSkillOption: null,
      initialStockContext: {
        id: stock.id,
        symbol: stock.symbol,
        companyName: stock.company_name,
        exchange: stock.exchange,
        board: stock.board,
      },
    }));
  };

  const handleStartFundResearchConversation = (fund: FundMarketResearchTarget) => {
    if (desktopUpdateNewRunBlockedReason) {
      setPrimaryView('chat');
      return;
    }
    const seed = `fund-${fund.symbol}-${Date.now()}`;
    openChatRoute(buildConversationBackedChatRoute({
      sessionKey: createScopedChatSessionKey(seed),
      kind: 'fund-research',
      title: `${fund.companyName} ${fund.symbol}`,
      initialPrompt: null,
      initialPromptKey: seed,
      initialAgentSlug: null,
      initialSkillSlug: null,
      initialSkillOption: null,
      initialStockContext: {
        id: fund.id,
        symbol: fund.symbol,
        companyName: fund.companyName,
        exchange: fund.exchange,
        board: fund.board,
        instrumentKind: fund.instrumentKind,
        instrumentLabel: fund.instrumentLabel,
      },
    }));
  };

  const handleStartNewChat = useCallback(() => {
    if (desktopUpdateNewRunBlockedReason) {
      setPrimaryView('chat');
      return;
    }
    const currentRoute = activeChatRouteRef.current;
    if (canReuseEmptyUnnamedGeneralConversation(currentRoute, BRAND.brandId)) {
      openChatRoute(createConversationBackedDefaultChatRoute(currentRoute.sessionKey));
      return;
    }
    const sessionKey = createGeneralChatSessionKey();
    openChatRoute(createConversationBackedDefaultChatRoute(sessionKey));
  }, [desktopUpdateNewRunBlockedReason, openChatRoute, setPrimaryView]);

  const handleRotateGeneralChatSession = useCallback((pressure: ChatSessionPressureSnapshot) => {
    setActiveChatRoute((current) => {
      if (!isGeneralChatSessionKey(current.sessionKey)) {
        return current;
      }

      const nextSessionKey = createSuccessorGeneralChatSessionKey(current.sessionKey);
      console.info('[desktop] rotate overloaded general chat session', {
        from: current.sessionKey,
        to: nextSessionKey,
        pressure,
      });
      const handoffSummary =
        current.conversationId
          ? deriveConversationHandoffSummary({
              appName: BRAND.brandId,
              sessionKey: current.sessionKey,
              conversationId: current.conversationId,
            })
          : null;
      if (current.conversationId) {
        linkSessionToConversation({
          conversationId: current.conversationId,
          fromSessionKey: current.sessionKey,
          toSessionKey: nextSessionKey,
          reason: 'session-pressure-handoff',
          summary: handoffSummary,
        });
      }
      writePersistedActiveGeneralChatSessionKey(nextSessionKey);
      return buildActiveChatRoute({
        sessionKey: nextSessionKey,
        conversationId: current.conversationId,
        kind: 'general',
        initialPrompt: null,
        initialPromptKey: null,
        focusedTurnId: null,
        focusedTurnKey: null,
        initialAgentSlug: current.initialAgentSlug,
        initialSkillSlug: current.initialSkillSlug,
        initialSkillOption: current.initialSkillOption,
        initialStockContext: current.initialStockContext,
      });
    });
  }, []);

  const handleOpenConversation = useCallback((conversationId: string) => {
    const conversation = readChatConversation(conversationId);
    if (!conversation?.activeSessionKey) {
      setPrimaryView('chat');
      return;
    }

    openChatRoute(buildConversationBackedChatRoute({
      sessionKey: conversation.activeSessionKey,
      conversationId: conversation.id,
      kind: conversation.kind,
      initialPrompt: null,
      initialPromptKey: null,
      focusedTurnId: null,
      focusedTurnKey: null,
      initialAgentSlug: conversation.restoreContext.initialAgentSlug ?? conversation.activeAgentId ?? null,
      initialSkillSlug: conversation.restoreContext.initialSkillSlug,
      initialSkillOption: conversation.restoreContext.initialSkillOption,
      initialStockContext: conversation.restoreContext.initialStockContext,
    }));
  }, [openChatRoute]);

  const handleDeleteConversation = useCallback((conversationId: string) => {
    if (selectedTaskCenterConversationIdRef.current === conversationId) {
      setSelectedTaskCenterConversationId(null);
    }

    const deletedSurfaceKeys = Object.entries(chatSurfaceEntriesRef.current)
      .filter(([, entry]) => entry.route.conversationId === conversationId)
      .map(([key]) => key);
    const deletingActiveConversation = activeChatRouteRef.current.conversationId === conversationId;
    const nextRoute = deletingActiveConversation
      ? createConversationBackedDefaultChatRoute(createGeneralChatSessionKey())
      : null;
    const nextSurfaceKey = nextRoute ? buildChatSurfaceCacheKey(nextRoute) : null;

    setChatSurfaceEntries((current) => {
      const nextEntries = Object.fromEntries(
        Object.entries(current).filter(([key]) => !deletedSurfaceKeys.includes(key)),
      );

      if (!nextRoute || !nextSurfaceKey) {
        return nextEntries;
      }

      const existing = nextEntries[nextSurfaceKey];
      return {
        ...nextEntries,
        [nextSurfaceKey]: existing
          ? {
              ...existing,
              route: nextRoute,
            }
          : {
              route: nextRoute,
              version: 0,
            },
      };
    });

    setChatSurfaceRuntimeState((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !deletedSurfaceKeys.includes(key)),
      )
    );

    if (!nextRoute || !nextSurfaceKey) {
      return;
    }

    setActiveChatRoute(nextRoute);
  }, []);

  const handleStartSkillConversation = (skill: SkillStoreItem) => {
    if (desktopUpdateNewRunBlockedReason) {
      setPrimaryView('chat');
      return;
    }
    const seed = `skill-${skill.slug}-${Date.now()}`;
    openChatRoute(buildConversationBackedChatRoute({
      sessionKey: createScopedChatSessionKey(seed),
      kind: 'skill',
      title: skill.slug,
      initialPrompt: null,
      initialPromptKey: seed,
      initialAgentSlug: null,
      initialSkillSlug: skill.slug,
      initialSkillOption: {
        slug: skill.slug,
        name: skill.name,
        market: skill.market,
        skillType: skill.skillType,
        categoryLabel: skill.categoryLabel,
      },
      initialStockContext: null,
    }));
  };

  const renderMenuSurface = (viewKey: PrimaryView) => {
    const viewLabel =
      menuUiConfig[viewKey]?.displayName ||
      menuUiConfig[fallbackPrimaryView]?.displayName ||
      menuUiConfig.chat.displayName;
    const currentSkillStoreViewConfig:
      | {
          preset: SkillStoreViewPreset;
          title: string;
          description: string;
        }
      | null =
      viewKey === 'skill-store'
        ? {
            preset: 'all',
            title: viewLabel,
            description: '统一查看系统预置能力与云端技能，安装后可自动同步到设备',
          }
        : viewKey === 'finance-skills'
          ? {
              preset: 'finance',
              title: viewLabel,
              description: '聚合技能商店里的财经、投资、股票与金融分析相关技能，右侧布局与技能商店保持一致。',
            }
          : viewKey === 'foundation-skills'
            ? {
                preset: 'foundation',
                title: viewLabel,
                description: '聚合技能商店里的基础通用技能，展示当前热门前 100 项，右侧布局与技能商店保持一致。',
              }
            : null;

    if (showStartupGate) {
      return <ChatBootstrapPlaceholderView />;
    }

    if (viewKey === 'investment-experts') {
      return (
        <DeferredSurface title={viewLabel}>
          <InvestmentExpertsView
            title={viewLabel}
            client={client}
            accessToken={accessToken}
            authenticated={authenticated}
            onRequestAuth={onRequestAuth}
            onStartConversation={handleStartInvestmentExpertConversation}
          />
        </DeferredSurface>
      );
    }

    if (viewKey === 'stock-market') {
      return (
        <DeferredSurface title={viewLabel}>
          <StockMarketView title={viewLabel} client={client} onStartResearch={handleStartStockResearchConversation} />
        </DeferredSurface>
      );
    }

    if (viewKey === 'fund-market') {
      return (
        <DeferredSurface title={viewLabel}>
          <FundMarketView title={viewLabel} client={client} onStartResearch={handleStartFundResearchConversation} />
        </DeferredSurface>
      );
    }

    if (viewKey === 'lobster-store') {
      return (
        <DeferredSurface title={viewLabel}>
          <LobsterStoreView
            title={viewLabel}
            client={client}
            accessToken={accessToken}
            authenticated={authenticated}
            currentUser={currentUser}
            onStartConversation={handleStartLobsterConversation}
            onRequestAuth={onRequestAuth}
          />
        </DeferredSurface>
      );
    }

    if (currentSkillStoreViewConfig) {
      return (
        <DeferredSurface title={viewLabel}>
          <SkillStoreView
            key={viewKey}
            client={client}
            accessToken={accessToken}
            authBaseUrl={AUTH_BASE_URL}
            authenticated={authenticated}
            currentUser={currentUser}
            onRequestAuth={onRequestAuth}
            onStartConversation={handleStartSkillConversation}
            preset={currentSkillStoreViewConfig.preset}
            title={currentSkillStoreViewConfig.title}
            description={currentSkillStoreViewConfig.description}
          />
        </DeferredSurface>
      );
    }

    if (viewKey === 'mcp-store') {
      return (
        <DeferredSurface title={viewLabel}>
          <MCPStoreView
            title={viewLabel}
            client={client}
            accessToken={accessToken}
            authenticated={authenticated}
            onRequestAuth={onRequestAuth}
          />
        </DeferredSurface>
      );
    }

    if (viewKey === 'data-connections') {
      return (
        <DeferredSurface title={viewLabel}>
          <DataConnectionsView title={viewLabel} />
        </DeferredSurface>
      );
    }

    if (viewKey === 'security') {
      return (
        <DeferredSurface title={viewLabel}>
          <SecurityCenterView title={viewLabel} />
        </DeferredSurface>
      );
    }

    if (viewKey === 'memory') {
      return (
        <DeferredSurface title={viewLabel}>
          <MemoryView title={viewLabel} />
        </DeferredSurface>
      );
    }

    if (viewKey === 'task-center') {
      return (
        <DeferredSurface title={viewLabel}>
          <TaskCenterView
            selectedConversationId={selectedTaskCenterConversationId}
            onSelectConversation={setSelectedTaskCenterConversationId}
            onOpenConversation={handleOpenConversation}
            onBackToChat={() => setPrimaryView('chat')}
            taskCenterLabel={viewLabel}
            chatMenuLabel={chatMenuLabel}
          />
        </DeferredSurface>
      );
    }

    if (viewKey === 'cron') {
      if (!authBootstrapReady) {
        return (
          <AuthBootstrapPlaceholderView
            eyebrow="Cron Shell"
            title="正在恢复定时任务会话"
            description="正在校验 control-plane 登录态并恢复本地运行时。"
          />
        );
      }
      if (showWelcomeBackground && welcomePageConfig) {
        return <WelcomeBackgroundView welcomePageConfig={welcomePageConfig} onRequestAuth={onRequestAuth} />;
      }
      if (authenticated) {
        return (
          <DeferredSurface title={viewLabel}>
            <OpenClawCronSurface
              title={viewLabel}
              gatewayUrl={GATEWAY_WS_URL}
              gatewayToken={gatewayAuth.token}
              gatewayPassword={gatewayAuth.password}
              sessionKey={CRON_SYSTEM_SESSION_KEY}
              shellAuthenticated={authenticated}
              initialSelectedJobId={cronNotificationSelection?.jobId ?? null}
              initialSelectedJobToken={cronNotificationSelection?.token ?? null}
            />
          </DeferredSurface>
        );
      }
      return (
        <RuntimeAuthRequiredView
          eyebrow="Cron Shell"
          title="当前定时任务页还不能挂载运行时"
          description="这不是正常空态。当前是 iClaw shell 还没有完成登录确认，因此 OpenClaw cron wrapper 暂时不会挂载。"
          authenticated={authenticated}
          hasGatewayAuth={Boolean(gatewayAuth.token || gatewayAuth.password)}
          onLogin={() => onRequestAuth('login')}
        />
      );
    }

    if (viewKey === 'im-bots') {
      return (
        <DeferredSurface title={viewLabel}>
          <IMBotsView title={viewLabel} client={imBotClient} />
        </DeferredSurface>
      );
    }

    if (!SUPPORTED_PRIMARY_VIEWS.has(viewKey)) {
      return (
        <PageSurface as="div">
          <PageContent className="flex min-h-full items-center">
            <div className="mx-auto w-full max-w-[820px]">
              <EmptyStatePanel
                title={`${viewLabel} 已装配`}
                description={
                  <>
                    这个左侧菜单已经按照 OEM 配置成功下发并显示。
                    <br />
                    当前 Web 端还没有接入对应页面，所以先展示占位页，避免“后台已开启但前端完全不显示”的不一致。
                    <br />
                    菜单 Key：{viewKey}
                  </>
                }
                action={
                  <Button variant="primary" size="sm" onClick={() => setPrimaryView('chat')}>
                    回到{chatMenuLabel}
                  </Button>
                }
                className="rounded-[32px]"
              />
            </div>
          </PageContent>
        </PageSurface>
      );
    }

    return null;
  };

  const renderOverlaySurface = (view: OverlayView) => {
    if (view === 'account' && accessToken) {
      return (
        <AccountPanel
          client={client}
          token={accessToken}
          user={currentUser}
          active={overlayView === 'account'}
          onClose={() => setOverlayView(null)}
          onOpenRechargeCenter={() => setOverlayView('recharge')}
          onUserUpdated={(user) => setCurrentUser(user)}
        />
      );
    }
    if (view === 'recharge' && accessToken) {
      return (
        <RechargeCenter
          client={client}
          token={accessToken}
          appName={BRAND.brandId}
          runtimeConfig={brandShellConfig}
          active={overlayView === 'recharge'}
          onPaymentSettled={refreshCreditBalance}
          onClose={() => setOverlayView(null)}
        />
      );
    }
    if (view === 'settings') {
      return (
        <SettingsPanel
          active={overlayView === 'settings'}
          onClose={() => setOverlayView(null)}
          onSave={handleSaveSettings}
          desktopUpdateCurrentVersion={desktopUpdateCurrentVersion}
          desktopUpdateLatestVersion={desktopUpdateLatestVersion}
          desktopUpdateMandatory={desktopUpdateMandatory}
          desktopUpdateEnforcementState={desktopUpdateEnforcementState}
          desktopUpdatePolicyLabel={desktopUpdatePolicyLabel}
          desktopUpdateChecking={desktopUpdateChecking}
          desktopUpdateReadyToRestart={desktopUpdateReadyToRestart}
          desktopUpdateStatusMessage={desktopUpdateStatusMessage}
          onCheckForDesktopUpdates={onCheckForDesktopUpdates}
          onRestartDesktopApp={onRestartDesktopApp}
        />
      );
    }
    return null;
  };

  return (
    <div className="relative h-screen overflow-hidden bg-[var(--bg-page)]">
      <CronTaskResultSync
        gatewayUrl={GATEWAY_WS_URL}
        gatewayToken={gatewayAuth.token}
        gatewayPassword={gatewayAuth.password}
        sessionKey={CRON_SYSTEM_SESSION_KEY}
        enabled={authenticated && resolvedPrimaryView !== 'cron'}
      />
      <div
        className="absolute inset-y-0 left-0 z-[3] transition-[width] duration-[180ms]"
        style={{ width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
      >
        <Sidebar
          user={currentUser}
          activeView={resolvedPrimaryView}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
          enabledMenuKeys={enabledMenuKeys}
          menuUiConfig={menuUiConfig}
          selectedConversationId={activeChatRoute.conversationId}
          authenticated={authenticated}
          onOpenChat={handleOpenChatView}
          onStartNewChat={handleStartNewChat}
          onOpenInvestmentExperts={handleOpenInvestmentExpertsView}
          onOpenCron={handleOpenCronView}
          onOpenLobsterStore={handleOpenLobsterStoreView}
          onOpenSkillStore={handleOpenSkillStoreView}
          onOpenMcpStore={handleOpenMcpStoreView}
          onOpenMenu={handleOpenPrimaryMenu}
          onOpenDataConnections={handleOpenDataConnectionsView}
          onOpenSecurity={handleOpenSecurityView}
          onOpenImBots={handleOpenImBotsView}
          onOpenMemory={handleOpenMemoryView}
          onOpenConversation={handleOpenConversation}
          onDeleteConversation={handleDeleteConversation}
          onOpenTaskCenter={handleOpenTaskCenterView}
          onOpenAccount={handleOpenAccountOverlay}
          onOpenRechargeCenter={handleHeaderRechargeAction}
          onOpenLogin={handleOpenLogin}
          onOpenSettings={handleOpenSettingsOverlay}
          onLogout={handleLogout}
          desktopUpdateHint={desktopUpdateHint}
          desktopUpdateBusy={desktopUpdateBusy}
          desktopUpdateError={desktopUpdateError}
          desktopUpdateOpened={desktopUpdateOpened}
          desktopUpdateStatus={desktopUpdateStatus}
          desktopUpdateProgress={desktopUpdateProgress}
          desktopUpdateDetail={desktopUpdateDetail}
          onUpgradeDesktopApp={onUpgradeDesktopApp}
          onRestartDesktopApp={onRestartDesktopApp}
          onSkipDesktopUpdate={onSkipDesktopUpdate}
          newChatDisabledReason={desktopUpdateNewRunBlockedReason}
        />
      </div>
      <div
        className="absolute inset-y-0 right-0 z-[1] isolate flex min-w-0 flex-col overflow-hidden transition-[left] duration-[180ms] [contain:layout_paint_style]"
        style={{ left: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
      >
        {resolvedPrimaryView === 'data-connections' || headerConfig.enabled === false ? null : (
          <IClawHeader
            config={headerConfig}
            balance={creditBalance?.total_available_balance ?? creditBalance?.available_balance ?? creditBalance?.balance ?? null}
            loading={creditBalanceLoading}
            authenticated={authenticated}
            onCreditsClick={handleHeaderAccountAction}
            onRechargeClick={handleHeaderRechargeAction}
            notificationUnreadCount={unreadNotificationCount}
            notificationCenterOpen={notificationCenterOpen}
            onNotificationsClick={handleNotificationBellClick}
          />
        )}
        <div className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden [contain:layout_paint_style]">
          {keepChatSurfaceMounted ? (
            <div
              className={buildSurfaceLayerClassName(resolvedPrimaryView === 'chat')}
              data-chat-surface-key={targetChatSurfaceKey}
              data-chat-surface-active={resolvedPrimaryView === 'chat' ? 'true' : 'false'}
            >
              <OpenClawChatSurface
                key={`chat-surface:${activeChatSurfaceEntry.version}`}
                gatewayUrl={GATEWAY_WS_URL}
                gatewayToken={gatewayAuth.token}
                gatewayPassword={gatewayAuth.password}
                authBaseUrl={AUTH_BASE_URL}
                appName={BRAND.brandId}
                conversationId={activeChatSurfaceEntry.route.conversationId}
                sessionKey={activeChatSurfaceEntry.route.sessionKey}
                initialPrompt={activeChatSurfaceEntry.route.initialPrompt}
                initialPromptKey={activeChatSurfaceEntry.route.initialPromptKey}
                focusedTurnId={activeChatSurfaceEntry.route.focusedTurnId}
                focusedTurnKey={activeChatSurfaceEntry.route.focusedTurnKey}
                initialAgentSlug={activeChatSurfaceEntry.route.initialAgentSlug}
                initialSkillSlug={activeChatSurfaceEntry.route.initialSkillSlug}
                initialSkillOption={activeChatSurfaceEntry.route.initialSkillOption}
                initialStockContext={activeChatSurfaceEntry.route.initialStockContext}
                shellAuthenticated={chatShellAuthenticated}
                creditClient={client}
                creditToken={accessToken}
                onCreditBalanceRefresh={refreshCreditBalance}
                user={currentUser}
                inputComposerConfig={inputComposerConfig}
                welcomePageConfig={welcomePageConfig}
                onGeneralChatSessionOverloaded={handleRotateGeneralChatSession}
                onOpenRechargeCenter={() => setOverlayView('recharge')}
                onRequireAuth={onRequestAuth}
                runtimeStateKey={targetChatSurfaceKey}
                onRuntimeStateChange={updateChatSurfaceRuntimeFlags}
                ensureRuntimeReadyForRecovery={ensureRuntimeReadyForRecovery}
                surfaceVisible={resolvedPrimaryView === 'chat'}
                sendBlockedReason={desktopUpdateSendBlockedReason}
              />
            </div>
          ) : null}
          {mountedMenuSurfaceKeys.map((viewKey) => (
            <div
              key={`menu-surface:${viewKey}`}
              className={buildSurfaceLayerClassName(
                resolvedPrimaryView !== 'chat' && isSurfaceVisible('menu', viewKey),
              )}
            >
              {renderMenuSurface(viewKey)}
            </div>
          ))}
          {showChatWelcomeBeforeAuthBootstrap ? (
            <div className={buildSurfaceLayerClassName(true)}>
              <WelcomeBackgroundView welcomePageConfig={welcomePageConfig} onRequestAuth={onRequestAuth} />
            </div>
          ) : null}
          {resolvedPrimaryView === 'chat' && !showStartupGate && !authBootstrapReady && !showChatWelcomeBeforeAuthBootstrap ? (
            <div className={buildSurfaceLayerClassName(true)}>
              <AuthBootstrapPlaceholderView
                eyebrow="Chat Shell"
                title="正在恢复聊天会话"
                description="本地引擎已经就绪，正在恢复 control-plane 登录态并准备聊天界面。"
              />
            </div>
          ) : null}
          {resolvedPrimaryView === 'chat' && showStartupGate ? (
            <div className={buildSurfaceLayerClassName(true)}>
              <ChatBootstrapPlaceholderView />
            </div>
          ) : null}
        </div>
      </div>
      {mountedOverlaySurfaceKeys.map((view) => (
        <div key={`overlay-surface:${view}`}>{renderOverlaySurface(view)}</div>
      ))}
      {notificationCenterOpen ? (
        <div
          className="fixed inset-0 z-[50] bg-black/20 transition-opacity dark:bg-black/40"
          onClick={closeNotificationCenter}
          aria-hidden="true"
        />
      ) : null}
      <NotificationCenterDrawer
        open={notificationCenterOpen}
        notifications={notificationItems}
        selectedNotificationId={selectedNotificationId}
        onClose={closeNotificationCenter}
        onSelect={handleNotificationSelect}
        onMarkAllRead={() => markAllAppNotificationsRead()}
        onClearAll={() => {
          clearAppNotifications();
          closeNotificationCenter();
        }}
      />
      <NotificationCenterDetailDrawer
        open={Boolean(notificationCenterOpen && selectedNotification)}
        notification={selectedNotification}
        onClose={() => setSelectedNotificationId(null)}
        onMarkAsRead={(id) => markAppNotificationRead(id)}
        onPrimaryAction={handleNotificationPrimaryAction}
        onSecondaryAction={handleNotificationSecondaryAction}
      />
    </div>
  );
}
