import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IClawClient, type CreditBalanceData, type DesktopUpdateHint, type MarketStockData } from '@iclaw/sdk';
import desktopPackageJson from '../../package.json';
import { clearAuth, readAuth, writeAuth } from './lib/auth-storage';
import { getGoogleOAuthUrl, getWeChatOAuthUrl, openOAuthPopup, type OAuthProvider } from './lib/oauth';
import { detectPortConflicts, ensureOpenClawCliAvailable, isTauriRuntime, loadGatewayAuth, startSidecar } from './lib/tauri-sidecar';
import {
  clearPortalProviderAuth,
  diagnoseRuntime,
  installRuntime,
  listenRuntimeInstallProgress,
  syncPortalProviderAuth,
  type RuntimeDiagnosis,
  type RuntimeInstallProgress,
} from './lib/tauri-runtime-config';
import {
  loadBrandRuntimeConfigWithFallback,
  resolveHeaderConfig,
  resolveInputComposerConfig,
  resolveRequiredEnabledMenuKeys,
  resolveRequiredMenuUiConfig,
  resolveWelcomePageConfig,
} from './lib/oem-runtime';
import { AuthPanel } from './components/AuthPanel';
import { AccountPanel } from './components/account/AccountPanel';
import { FirstRunSetupPanel } from './components/FirstRunSetupPanel';
import { IClawHeader } from './components/IClawHeader';
import { OpenClawChatSurface } from './components/OpenClawChatSurface';
import { OpenClawCronSurface } from './components/OpenClawCronSurface';
import { Sidebar } from './components/Sidebar';
import { DesktopUpdateGuard } from './components/DesktopUpdateGuard';
import { Button } from './components/ui/Button';
import { EmptyStatePanel } from './components/ui/EmptyStatePanel';
import { PageContent, PageSurface } from './components/ui/PageLayout';
import { K2CWelcomePage } from './components/K2CWelcomePage';
import { DataConnectionsView } from './components/data-connections/DataConnectionsView';
import { InvestmentExpertsView } from './components/investment-experts/InvestmentExpertsView';
import { LobsterStoreView } from './components/lobster-store/LobsterStoreView';
import { MemoryView } from './components/memory/MemoryView';
import { MCPStoreView } from './components/mcp-store/MCPStoreView';
import { TaskCenterView } from './components/TaskCenterView';
import { SkillStoreView, type SkillStoreViewPreset } from './components/skill-store/SkillStoreView';
import { IMBotsView } from './components/im-bots/IMBotsView';
import { SecurityCenterView } from './components/security-center/SecurityCenterView';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { RechargeCenter } from './components/recharge/RechargeCenter';
import { StockMarketView } from './components/market/StockMarketView';
import { FundMarketView, type FundMarketResearchTarget } from './components/market/FundMarketView';
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
  type ChatConversationKind,
} from './lib/chat-conversations';
import { deriveConversationHandoffSummary } from './lib/chat-history';
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
  normalizeDesktopUpdateEnforcementState,
  readSkippedDesktopUpdateVersion,
  resolveDesktopUpdateGateState,
  resolveDesktopUpdatePolicyLabel,
  resolveDesktopUpdateArtifactUrl,
  shouldShowDesktopUpdateHint,
  writeSkippedDesktopUpdateVersion,
} from './lib/desktop-updates';
import { syncManagedSkills, type SkillStoreItem } from './lib/skill-store';
import { readCacheJson, writeCacheJson } from './lib/persistence/cache-store';
import { useSurfaceCacheManager } from './lib/surface-cache';
import {
  checkDesktopUpdate,
  downloadAndInstallDesktopUpdate,
  listenDesktopUpdateProgress,
  restartDesktopApp,
} from './lib/tauri-desktop-updater';
import { desktopLogin, desktopMe, desktopRefresh } from './lib/tauri-auth';
import {
  buildChatScopedStorageKey,
  writeCurrentChatPersistenceUserScope,
} from './lib/chat-persistence-scope';

interface AuthUser {
  id?: string;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  display_name?: string | null;
  role?: 'user' | 'admin' | 'super_admin' | null;
}

function isUnauthorizedAuthError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'UNAUTHORIZED');
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
const DESKTOP_APP_VERSION = desktopPackageJson.version;
const DESKTOP_RELEASE_CHANNEL: 'dev' | 'prod' =
  String(import.meta.env.VITE_BUILD_CHANNEL || '').trim().toLowerCase() === 'dev' ? 'dev' : 'prod';
const DISPLAY_DESKTOP_APP_VERSION = DESKTOP_APP_VERSION.split('+', 1)[0] || DESKTOP_APP_VERSION;
const DESKTOP_UPDATE_REVALIDATE_TTL_MS = 15 * 60 * 1000;
const ACTIVE_CHAT_ROUTE_STORAGE_KEY = 'iclaw.desktop.active-chat-route.v1';
const ACTIVE_WORKSPACE_SCENE_STORAGE_KEY = 'iclaw.desktop.active-workspace-scene.v1';

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

type PersistedChatRouteSnapshot = {
  conversationId?: unknown;
  sessionKey?: unknown;
  initialPrompt?: unknown;
  initialPromptKey?: unknown;
  focusedTurnId?: unknown;
  focusedTurnKey?: unknown;
  initialAgentSlug?: unknown;
  initialSkillSlug?: unknown;
  initialSkillOption?: unknown;
  initialStockContext?: unknown;
};

type PersistedWorkspaceSceneSnapshot = {
  primaryView?: unknown;
  selectedTurnId?: unknown;
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
  const snapshot = readCacheJson<PersistedChatRouteSnapshot>(buildChatScopedStorageKey(ACTIVE_CHAT_ROUTE_STORAGE_KEY));
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
  if (!route) {
    writeCacheJson(buildChatScopedStorageKey(ACTIVE_CHAT_ROUTE_STORAGE_KEY), null);
    return;
  }
  writeCacheJson(buildChatScopedStorageKey(ACTIVE_CHAT_ROUTE_STORAGE_KEY), {
    conversationId: route.conversationId,
    sessionKey: route.sessionKey,
    initialPrompt: route.initialPrompt,
    initialPromptKey: route.initialPromptKey,
    initialAgentSlug: route.initialAgentSlug,
    initialSkillSlug: route.initialSkillSlug,
    initialSkillOption: route.initialSkillOption,
    initialStockContext: route.initialStockContext,
  });
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
  const conversation = ensureChatConversation({
    conversationId: params.conversationId,
    sessionKey,
    kind: params.kind ?? 'general',
    title: params.title ?? null,
  });

  return {
    conversationId: conversation.id,
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

function readPersistedWorkspaceScene(): {
  primaryView: string | null;
  selectedTurnId: string | null;
} {
  const snapshot = readCacheJson<PersistedWorkspaceSceneSnapshot>(
    buildChatScopedStorageKey(ACTIVE_WORKSPACE_SCENE_STORAGE_KEY),
  );
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      primaryView: null,
      selectedTurnId: null,
    };
  }
  return {
    primaryView: normalizeOptionalText(snapshot.primaryView),
    selectedTurnId: normalizeOptionalText(snapshot.selectedTurnId),
  };
}

function writePersistedWorkspaceScene(input: {
  primaryView?: string | null;
  selectedTurnId?: string | null;
}): void {
  const current = readPersistedWorkspaceScene();
  const next = {
    primaryView: input.primaryView === undefined ? current.primaryView : normalizeOptionalText(input.primaryView),
    selectedTurnId:
      input.selectedTurnId === undefined ? current.selectedTurnId : normalizeOptionalText(input.selectedTurnId),
  };
  if (!next.primaryView && !next.selectedTurnId) {
    writeCacheJson(buildChatScopedStorageKey(ACTIVE_WORKSPACE_SCENE_STORAGE_KEY), null);
    return;
  }
  writeCacheJson(buildChatScopedStorageKey(ACTIVE_WORKSPACE_SCENE_STORAGE_KEY), {
    ...(next.primaryView ? {primaryView: next.primaryView} : {}),
    ...(next.selectedTurnId ? {selectedTurnId: next.selectedTurnId} : {}),
  });
}

function createDefaultChatRoute(sessionKey = resolveInitialGeneralChatSessionKey()) {
  return buildActiveChatRoute({
    sessionKey,
    kind: 'general',
  });
}
function resolveInitialChatRoute(): ActiveChatRoute {
  const persisted = readPersistedActiveChatRoute();
  if (persisted) {
    return buildActiveChatRoute({
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
  return createDefaultChatRoute();
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
    ? 'relative flex min-h-0 flex-1 overflow-hidden'
    : 'pointer-events-none invisible absolute inset-0 flex min-h-0 flex-1 overflow-hidden opacity-0';
}

function buildDesktopUpdateAnnouncement(hint: DesktopUpdateHint): string {
  const policyLabel = resolveDesktopUpdatePolicyLabel(hint);
  const reasonMessage = hint.reasonMessage?.trim();
  const base = `发现新版本 ${hint.latestVersion}。当前策略：${policyLabel}。`;
  return reasonMessage ? `${base} ${reasonMessage}` : base;
}

type InstallerViewState = 'loading' | 'error';

type InstallerViewModel = {
  state: InstallerViewState;
  title: string;
  subtitle: string;
  progress: number;
  stepLabel: string;
  stepDetail: string;
  errorMessage: string | null;
};

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

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    applyChatPersistenceUserScope(currentUser);
  }, [currentUser]);

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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionAuthed, setSessionAuthed] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [socialLoadingProvider, setSocialLoadingProvider] = useState<OAuthProvider | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [healthChecking, setHealthChecking] = useState(true);
  const [healthy, setHealthy] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [initialHealthResolved, setInitialHealthResolved] = useState(false);
  const [runtimeChecking, setRuntimeChecking] = useState(true);
  const [runtimeInstalling, setRuntimeInstalling] = useState(false);
  const [runtimeInstallError, setRuntimeInstallError] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(!isTauriRuntime());
  const [runtimeDiagnosis, setRuntimeDiagnosis] = useState<RuntimeDiagnosis | null>(null);
  const [runtimeInstallProgress, setRuntimeInstallProgress] = useState<RuntimeInstallProgress | null>(null);
  const [primaryView, setPrimaryView] = useState<PrimaryView>(() => readPersistedWorkspaceScene().primaryView ?? 'chat');
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
  const [brandRuntimeReady, setBrandRuntimeReady] = useState(!IS_TAURI_RUNTIME);
  const [brandShellConfig, setBrandShellConfig] = useState<Record<string, unknown> | null>(null);
  const brandRuntimeSignatureRef = useRef<string | null>(null);
  const brandRuntimeSyncInFlightRef = useRef(false);
  const desktopUpdateLastCheckedAtRef = useRef(0);
  const desktopUpdateCheckInFlightRef = useRef(false);
  const lastRuntimeProgressRef = useRef(0);

  useEffect(() => {
    writePersistedWorkspaceScene({primaryView});
  }, [primaryView]);

  const syncWorkspaceForUser = async (token: string): Promise<void> => {
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
  };

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

  const waitForClientHealth = useCallback(
    async (
      options: {
        attempts?: number;
        intervalMs?: number;
        suppressError?: boolean;
      } = {},
    ): Promise<boolean> => {
      const {
        attempts = SIDECAR_BOOT_HEALTHCHECK_ATTEMPTS,
        intervalMs = SIDECAR_BOOT_HEALTHCHECK_INTERVAL_MS,
        suppressError = false,
      } = options;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          await client.health();
          setHealthy(true);
          setHealthError(null);
          return true;
        } catch (error) {
          const portConflictMessage = await resolvePortConflictMessage();
          if (!suppressError) {
            setHealthy(false);
            setHealthError(
              portConflictMessage || (error instanceof Error ? error.message : 'health check failed'),
            );
          } else {
            setHealthy(false);
            setHealthError(null);
          }
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, intervalMs);
        });
      }
      return false;
    },
    [client, resolvePortConflictMessage],
  );

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

  const retrySetup = async () => {
    if (!runtimeReady) {
      await handleInstallRuntime();
      return;
    }

    setHealthError(null);
    setInitialHealthResolved(false);
    setHealthChecking(true);
    try {
      await refreshGatewayAuth();
      setBrandRuntimeReady(false);
      await syncBrandRuntimeSnapshot();
      await startSidecar(SIDE_CAR_ARGS);
      const healthyNow = await waitForClientHealth({
        attempts: SIDECAR_BOOT_HEALTHCHECK_ATTEMPTS,
        intervalMs: SIDECAR_BOOT_HEALTHCHECK_INTERVAL_MS,
        suppressError: true,
      });
      if (!healthyNow) {
        throw new Error(`无法连接本地 API，请确认已启动并监听 ${API_BASE_URL}`);
      }
      setHealthy(true);
      setHealthError(null);
    } catch (error) {
      const status = await detectPortConflicts().catch(() => null);
      setHealthy(false);
      setHealthError(
        formatPortConflictMessage(status?.occupied_ports ?? []) ||
          (error instanceof Error ? error.message : 'failed to start openclaw runtime'),
      );
    } finally {
      setHealthChecking(false);
      setInitialHealthResolved(true);
    }
  };

  useEffect(() => {
    if (!IS_TAURI_RUNTIME) return;

    let detach = () => {};
    void listenRuntimeInstallProgress((payload) => {
      lastRuntimeProgressRef.current = Math.max(lastRuntimeProgressRef.current, payload.progress || 0);
      setRuntimeInstallProgress(payload);
    }).then((unlisten) => {
      detach = unlisten;
    });

    return () => {
      detach();
    };
  }, []);

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
      setDesktopUpdateActionState('downloading');
    }).then((unlisten) => {
      detach = unlisten;
    });

    return () => {
      detach();
    };
  }, []);

  const applyRuntimeDiagnosis = (diagnosis: RuntimeDiagnosis | null): boolean => {
    setRuntimeDiagnosis(diagnosis);
    const ready =
      Boolean(diagnosis?.runtime_found) &&
      Boolean(diagnosis?.skills_dir_ready) &&
      Boolean(diagnosis?.mcp_config_ready);
    setRuntimeReady(ready);
    return ready;
  };

  const checkRuntime = async () => {
    if (!isTauriRuntime()) {
      setRuntimeReady(true);
      setRuntimeChecking(false);
      return;
    }
    setRuntimeChecking(true);
    setRuntimeInstallError(null);
    if (!runtimeInstalling) {
      setRuntimeInstallProgress({
        phase: 'inspect',
        progress: 12,
        label: '正在检查本地环境',
        detail: '确认核心组件、工作区和运行配置是否已准备就绪。',
      });
    }
    try {
      const diagnosis = await diagnoseRuntime();
      applyRuntimeDiagnosis(diagnosis);
    } finally {
      setRuntimeChecking(false);
    }
  };

  const handleInstallRuntime = async () => {
    setRuntimeInstalling(true);
    setRuntimeInstallError(null);
    setRuntimeInstallProgress({
      phase: 'prepare',
      progress: 6,
      label: '正在准备安装组件',
      detail: '为首次启动创建本地运行目录并校验安装来源。',
    });
    try {
      await installRuntime();
      await checkRuntime();
    } catch (error) {
      setRuntimeInstallError(error instanceof Error ? error.message : 'runtime install failed');
    } finally {
      setRuntimeInstalling(false);
    }
  };

  useEffect(() => {
    if (!isTauriRuntime()) {
      setRuntimeReady(true);
      setRuntimeChecking(false);
      return;
    }

    let cancelled = false;

    const ensureRuntimeInstalled = async () => {
      setRuntimeChecking(true);
      setRuntimeInstallError(null);
      try {
        const diagnosis = await diagnoseRuntime();
        const ready = applyRuntimeDiagnosis(diagnosis);
        if (ready || !diagnosis?.runtime_installable || diagnosis.runtime_found) {
          return;
        }

        setRuntimeInstalling(true);
        setRuntimeInstallProgress({
          phase: 'prepare',
          progress: 6,
          label: '正在准备安装组件',
          detail: '首次启动需要部署本地运行环境，请稍候。',
        });
        await installRuntime();
        if (cancelled) return;
        const nextDiagnosis = await diagnoseRuntime();
        if (cancelled) return;
        applyRuntimeDiagnosis(nextDiagnosis);
      } catch (error) {
        if (!cancelled) {
          setRuntimeInstallError(error instanceof Error ? error.message : 'runtime install failed');
        }
      } finally {
        if (!cancelled) {
          setRuntimeInstalling(false);
          setRuntimeChecking(false);
        }
      }
    };

    void ensureRuntimeInstalled();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let settled = false;

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
      settleGuest(false);
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
          try {
            await syncWorkspaceForUser(auth.accessToken);
          } catch (error) {
            console.error('[desktop] failed to sync workspace from backup, resetting to defaults', error);
            await resetIclawWorkspaceToDefaults();
          }
          try {
            await syncManagedProviderAuth();
          } catch (error) {
            console.warn('[desktop] failed to sync managed provider auth from stored session', error);
          }
          settleAuthed(auth.accessToken, user || null);
          return;
        } catch (error) {
          if (!isUnauthorizedAuthError(error)) {
            console.warn('[desktop] failed to validate stored access token, keeping session for retry', error);
            settlePreservedAuth(auth.accessToken, null);
            return;
          }
        }

        try {
          const refreshed = IS_TAURI_RUNTIME ? await desktopRefresh(auth.refreshToken) : await client.refresh(auth.refreshToken);
          try {
            await syncWorkspaceForUser(refreshed.access_token);
          } catch (error) {
            console.error('[desktop] failed to sync workspace after refresh, resetting to defaults', error);
            await resetIclawWorkspaceToDefaults();
          }
          await writeAuth({
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token || auth.refreshToken,
          });
          try {
            await syncManagedProviderAuth();
          } catch (error) {
            console.warn('[desktop] failed to sync managed provider auth after refresh', error);
          }
          const user = (await (IS_TAURI_RUNTIME ? desktopMe(refreshed.access_token) : client.me(refreshed.access_token))) as AuthUser;
          settleAuthed(refreshed.access_token, user || null);
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
  }, [client]);

  const handleLogin = async (input: { identifier: string; password: string }) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = IS_TAURI_RUNTIME ? await desktopLogin(input) : await client.login(input);
      await syncWorkspaceForUser(data.tokens.access_token);
      await writeAuth({
        accessToken: data.tokens.access_token,
        refreshToken: data.tokens.refresh_token,
      });
      await syncManagedProviderAuth();
      applyChatPersistenceUserScope((data.user as AuthUser) || null);
      setAccessToken(data.tokens.access_token);
      setSessionAuthed(true);
      setCurrentUser((data.user as AuthUser) || null);
      setAuthModalOpen(false);
      if (postAuthView) {
        setOverlayView(postAuthView);
        setPostAuthView(null);
      }
    } catch (e) {
      void clearAuth();
      void clearManagedProviderAuth();
      setAuthError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (input: { username: string; name: string; email: string; password: string }) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await client.register(input);
      await syncWorkspaceForUser(data.tokens.access_token);
      await writeAuth({
        accessToken: data.tokens.access_token,
        refreshToken: data.tokens.refresh_token,
      });
      await syncManagedProviderAuth();
      applyChatPersistenceUserScope((data.user as AuthUser) || null);
      setAccessToken(data.tokens.access_token);
      setSessionAuthed(true);
      setCurrentUser((data.user as AuthUser) || null);
      setAuthModalOpen(false);
      if (postAuthView) {
        setOverlayView(postAuthView);
        setPostAuthView(null);
      }
    } catch (e) {
      void clearAuth();
      void clearManagedProviderAuth();
      setAuthError(e instanceof Error ? e.message : '注册失败');
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
      await syncWorkspaceForUser(data.tokens.access_token);
      await writeAuth({
        accessToken: data.tokens.access_token,
        refreshToken: data.tokens.refresh_token,
      });
      await syncManagedProviderAuth();
      applyChatPersistenceUserScope((data.user as AuthUser) || null);
      setAccessToken(data.tokens.access_token);
      setSessionAuthed(true);
      setCurrentUser((data.user as AuthUser) || null);
      setAuthModalOpen(false);
      if (postAuthView) {
        setOverlayView(postAuthView);
        setPostAuthView(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '社交登录失败';
      if (message !== '授权已取消') {
        void clearAuth();
        void clearManagedProviderAuth();
        setAuthError(message);
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

  useEffect(() => {
    if (isTauriRuntime() && (!brandRuntimeReady || !runtimeReady || runtimeChecking || runtimeInstalling)) {
      setHealthChecking(false);
      setHealthy(false);
      setInitialHealthResolved(false);
      return;
    }

    let cancelled = false;

    const check = async (
      options: {
        blocking?: boolean;
        suppressError?: boolean;
      } = {},
    ): Promise<boolean> => {
      const { blocking = false, suppressError = false } = options;
      if (blocking) {
        setHealthChecking(true);
      }
      try {
        const healthyNow = await waitForClientHealth({
          attempts: 1,
          suppressError,
        });
        return healthyNow;
      } finally {
        if (!cancelled && blocking) {
          setHealthChecking(false);
        }
      }
    };

    const waitForSidecarHealth = async (): Promise<boolean> => {
      for (let attempt = 0; attempt < SIDECAR_BOOT_HEALTHCHECK_ATTEMPTS; attempt += 1) {
        const healthyNow = await check({ suppressError: true });
        if (healthyNow || cancelled) {
          return healthyNow;
        }
        if (!cancelled) {
          setHealthy(false);
          setHealthError(null);
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, SIDECAR_BOOT_HEALTHCHECK_INTERVAL_MS);
        });
      }
      return false;
    };

    const boot = async () => {
      if (isTauriRuntime()) {
        try {
          await ensureOpenClawCliAvailable();
        } catch (error) {
          console.warn('[desktop] failed to ensure openclaw cli launcher', error);
        }
      }
      const healthyNow = await check({
        blocking: true,
        suppressError: isTauriRuntime(),
      });
      if (!cancelled && !healthyNow && isTauriRuntime()) {
        setHealthChecking(true);
        setHealthError(null);
        try {
          await startSidecar(SIDE_CAR_ARGS);
        } catch (error) {
          const portConflictMessage = await resolvePortConflictMessage();
          if (!cancelled) {
            setHealthy(false);
            setHealthError(
              portConflictMessage ||
                (error instanceof Error ? error.message : 'failed to start openclaw runtime'),
            );
          }
          if (!cancelled) {
            setInitialHealthResolved(true);
          }
          return;
        }
        const sidecarHealthy = await waitForSidecarHealth();
        if (!cancelled) {
          setHealthChecking(false);
        }
        if (!cancelled && !sidecarHealthy) {
          const portConflictMessage = await resolvePortConflictMessage();
          setHealthy(false);
          setHealthError(
            portConflictMessage ||
              `无法连接本地 API，请确认已启动并监听 ${API_BASE_URL}`,
          );
        }
      }
      if (!cancelled) {
        setInitialHealthResolved(true);
      }
    };

    void boot();
    const timer = window.setInterval(() => {
      void check({ blocking: false });
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [brandRuntimeReady, client, runtimeChecking, runtimeInstalling, runtimeReady]);
  const runtimeUnavailableErrorMessage =
    !runtimeReady && !runtimeInstalling && !runtimeDiagnosis?.runtime_installable
      ? '当前安装包未包含可用的运行时来源，请重新下载应用或联系支持。'
      : null;
  const installStageErrorMessage = runtimeInstallError || runtimeUnavailableErrorMessage;
  const startupStageErrorMessage = !installStageErrorMessage && runtimeReady ? healthError : null;
  const installerView: InstallerViewModel = (() => {
    const normalizedProgress = runtimeInstallProgress
      ? {
          ...runtimeInstallProgress,
          label: normalizeBrandRuntimeText(runtimeInstallProgress.label),
          detail: normalizeBrandRuntimeText(runtimeInstallProgress.detail),
        }
      : null;
    const stableProgress = Math.max(lastRuntimeProgressRef.current, normalizedProgress?.progress ?? 0);

    if (installStageErrorMessage) {
      return {
        state: 'error',
        title: '唤醒失败',
        subtitle: '安装过程遇到问题',
        progress: Math.max(6, Math.min(88, stableProgress || 6)),
        stepLabel: '安装过程中断',
        stepDetail: '本地运行环境还没有准备完成，无法继续进入应用。',
        errorMessage: installStageErrorMessage,
      };
    }

    if (startupStageErrorMessage) {
      return {
        state: 'error',
        title: '启动失败',
        subtitle: '本地服务未能成功拉起',
        progress: Math.max(96, stableProgress),
        stepLabel: '运行环境已部署完成',
        stepDetail: 'runtime 文件已经准备好，但本地 API / gateway 健康检查没有通过。',
        errorMessage: startupStageErrorMessage,
      };
    }

    if (runtimeInstalling) {
      const progress = normalizedProgress ?? {
        phase: 'prepare',
        progress: 6,
        label: '正在准备安装组件',
        detail: '首次启动需要部署本地运行环境，请稍候。',
      };
      const title =
        progress.progress < 30
          ? `${BRAND.displayName} 正在苏醒`
          : progress.progress < 85
            ? `正在准备 ${BRAND.displayName}`
            : '即将完成';
      return {
        state: 'loading',
        title,
        subtitle: '正在部署你的本地 AI 助手',
        progress: progress.progress,
        stepLabel: progress.label,
        stepDetail: progress.detail,
        errorMessage: null,
      };
    }

    if (runtimeChecking || !runtimeReady) {
      return {
        state: 'loading',
        title: `${BRAND.displayName} 正在苏醒`,
        subtitle: '正在启动本地 AI 运行环境',
        progress: 12,
        stepLabel: '正在检查本地引擎',
        stepDetail: '确认 runtime、gateway、工作区和运行配置是否已准备就绪。',
        errorMessage: null,
      };
    }

    return {
      state: 'loading',
      title: '即将完成',
      subtitle: '本地运行环境已准备完成',
      progress: healthy ? 100 : 96,
      stepLabel: healthy ? `${BRAND.displayName} 已就绪` : '正在启动本地服务',
      stepDetail: healthy ? '正在进入应用。' : '正在拉起本地服务并完成最后的健康检查。',
      errorMessage: null,
    };
  })();
  const shouldShowStartupGate =
    IS_TAURI_RUNTIME &&
    (
      runtimeChecking ||
      runtimeInstalling ||
      !runtimeReady ||
      !initialHealthResolved ||
      healthChecking ||
      (!healthy && Boolean(healthError))
    );
  const shouldShowAuthBootstrapHint = !shouldShowStartupGate && !authBootstrapReady;

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

  const handleUpgradeDesktopApp = async () => {
    if (!effectiveDesktopUpdateHint) return;
    setDesktopUpdateActionState('checking');
    setDesktopUpdateError(null);
    setDesktopUpdateStatusMessage(null);
    try {
      if (IS_TAURI_RUNTIME) {
        const updaterCheck = await checkDesktopUpdate({
          authBaseUrl: AUTH_BASE_URL,
          appName: BRAND.brandId,
          channel: DESKTOP_RELEASE_CHANNEL,
        });
        if (updaterCheck?.supported && updaterCheck.available) {
          setDesktopUpdateActionState('downloading');
          setDesktopUpdateProgress(5);
          setDesktopUpdateDetail('正在准备下载更新包。');
          await downloadAndInstallDesktopUpdate();
          return;
        }
        if (updaterCheck?.external_download_url) {
          window.open(updaterCheck.external_download_url, '_blank', 'noopener,noreferrer');
          setDesktopUpdateActionState('opened');
          setDesktopUpdateStatusMessage('已打开更新下载页。');
          return;
        }
      }

      const artifactUrl = await resolveDesktopUpdateArtifactUrl(effectiveDesktopUpdateHint);
      const targetUrl = artifactUrl || effectiveDesktopUpdateHint.manifestUrl;
      if (!targetUrl) {
        throw new Error('当前更新源未提供下载地址');
      }
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      setDesktopUpdateActionState('opened');
      setDesktopUpdateStatusMessage('已打开更新下载页。');
    } catch (error) {
      setDesktopUpdateActionState('idle');
      setDesktopUpdateError(error instanceof Error ? error.message : '打开更新链接失败');
      setDesktopUpdateStatusMessage(error instanceof Error ? error.message : '打开更新链接失败');
    }
  };

  const handleRestartDesktopApp = async () => {
    if (!IS_TAURI_RUNTIME) return;
    await restartDesktopApp();
  };

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
              onRetry={retrySetup}
            />
          </div>
        ) : null}
        {authModalOpen ? (
          <AuthPanel
            open={authModalOpen}
            initialMode={authModalMode}
            loading={authLoading}
            error={authError}
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
  onChatBusyChange,
  desktopUpdateChecking,
  desktopUpdateReadyToRestart,
  desktopUpdateStatusMessage,
}: AuthedViewProps) {
  const { buildSectionSaveSnapshot, commitSectionSave } = useSettings();
  const lastResolvedPrimaryViewRef = useRef<PrimaryView | null>(null);
  const chatRuntimeAuthRef = useRef(authenticated);
  const initialChatRouteRef = useRef<ActiveChatRoute>(resolveInitialChatRoute());
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(() => readPersistedWorkspaceScene().selectedTurnId);
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
  const surfaceCache = useSurfaceCacheManager();
  const {
    ensureVisible: ensureSurfaceVisible,
    hidePool: hideSurfacePool,
    updateFlags: updateSurfaceFlags,
    getMountedKeys: getMountedSurfaceKeys,
    isVisible: isSurfaceVisible,
  } = surfaceCache;
  const enabledMenuKeys = resolveRequiredEnabledMenuKeys(brandShellConfig);
  const menuUiConfig = resolveRequiredMenuUiConfig(brandShellConfig, [...enabledMenuKeys, 'chat', 'task-center']);
  const headerConfig = resolveHeaderConfig(brandShellConfig);
  const inputComposerConfig = resolveInputComposerConfig(brandShellConfig);
  const welcomePageConfig = resolveWelcomePageConfig(brandShellConfig);
  const availablePrimaryViews = enabledMenuKeys.filter((key) => key !== 'settings') as PrimaryView[];
  const fallbackPrimaryView = availablePrimaryViews[0] || 'chat';
  const resolvedPrimaryView = availablePrimaryViews.includes(primaryView) ? primaryView : fallbackPrimaryView;
  const chatShellAuthenticated =
    authenticated ||
    Boolean(accessToken) ||
    (!authModalOpen && authBootstrapReady && chatRuntimeAuthRef.current);
  const showWelcomeBackground = authBootstrapReady && !authenticated;
  const chatMenuLabel = menuUiConfig.chat.displayName;
  const keepChatSurfaceMounted =
    !showStartupGate && !showWelcomeBackground && authBootstrapReady && chatShellAuthenticated;
  const mountedChatSurfaceKeys = getMountedSurfaceKeys('chat');
  const mountedMenuSurfaceKeys = getMountedSurfaceKeys('menu');
  const mountedOverlaySurfaceKeys = getMountedSurfaceKeys('overlay') as OverlayView[];
  const hasAnyBusyChatSurface = Object.values(chatSurfaceRuntimeState).some((state) => state.busy);

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
    writePersistedWorkspaceScene({selectedTurnId});
  }, [selectedTurnId]);

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
  }, [activeChatRoute]);

  useEffect(() => {
    if (keepChatSurfaceMounted) {
      ensureSurfaceVisible('chat', buildChatSurfaceCacheKey(activeChatRoute));
      return;
    }
    hideSurfacePool('chat');
  }, [activeChatRoute, ensureSurfaceVisible, hideSurfacePool, keepChatSurfaceMounted]);

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
    const mountedKeys = new Set(mountedChatSurfaceKeys);
    setChatSurfaceEntries((current) => {
      const nextEntries = Object.fromEntries(
        Object.entries(current).filter(([key]) => mountedKeys.has(key) || key === buildChatSurfaceCacheKey(activeChatRoute)),
      );
      return Object.keys(nextEntries).length === Object.keys(current).length ? current : nextEntries;
    });
    setChatSurfaceRuntimeState((current) => {
      const nextState = Object.fromEntries(Object.entries(current).filter(([key]) => mountedKeys.has(key)));
      return Object.keys(nextState).length === Object.keys(current).length ? current : nextState;
    });
  }, [activeChatRoute, mountedChatSurfaceKeys]);

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
    writePersistedActiveChatRoute(activeChatRoute);
  }, [activeChatRoute]);

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
        };
        const next = {
          ...previous,
          ...patch,
        };
        if (
          previous.busy === next.busy &&
          previous.hasPendingBilling === next.hasPendingBilling
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

  const handleHeaderAccountAction = () => {
    if (!authenticated) {
      onRequestAuth('login', 'account');
      return;
    }
    setOverlayView('account');
  };

  const handleHeaderRechargeAction = () => {
    if (!authenticated) {
      onRequestAuth('login', 'recharge');
      return;
    }
    setOverlayView('recharge');
  };

  const handleStartLobsterConversation = (agent: LobsterAgent) => {
    if (desktopUpdateNewRunBlockedReason) {
      setPrimaryView('chat');
      return;
    }
    const seed = `${agent.slug}-${Date.now()}`;
    openChatRoute(buildActiveChatRoute({
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
    openChatRoute(buildActiveChatRoute({
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
    openChatRoute(buildActiveChatRoute({
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
    openChatRoute(buildActiveChatRoute({
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

  const handleStartNewChat = () => {
    if (desktopUpdateNewRunBlockedReason) {
      setPrimaryView('chat');
      return;
    }
    const sessionKey = createGeneralChatSessionKey();
    openChatRoute(createDefaultChatRoute(sessionKey));
  };

  const handleRotateGeneralChatSession = useCallback((pressure: ChatSessionPressureSnapshot) => {
    setActiveChatRoute((current) => {
      if (!isGeneralChatSessionKey(current.sessionKey)) {
        return current;
      }
      if (
        current.initialPrompt ||
        current.initialPromptKey ||
        current.initialAgentSlug ||
        current.initialSkillSlug ||
        current.initialSkillOption ||
        current.initialStockContext
      ) {
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
      });
    });
  }, []);

  const handleOpenTurnChat = (turnId: string) => {
    const turn = readChatTurns().find((item) => item.id === turnId);
    if (!turn?.sessionKey) {
      setPrimaryView('task-center');
      return;
    }

    const conversation =
      (turn.conversationId ? readChatConversation(turn.conversationId) : null) ||
      findChatConversationBySessionKey(turn.sessionKey);
    const targetSessionKey = conversation?.activeSessionKey || turn.sessionKey;

    openChatRoute(buildActiveChatRoute({
      sessionKey: targetSessionKey,
      conversationId: conversation?.id || turn.conversationId,
      kind: conversation?.kind ?? 'general',
      initialPrompt: null,
      initialPromptKey: null,
      focusedTurnId: turn.id,
      focusedTurnKey: `${turn.id}:${Date.now()}`,
      initialAgentSlug: null,
      initialSkillSlug: null,
      initialSkillOption: null,
      initialStockContext: null,
    }));
  };

  const handleOpenConversation = useCallback((conversationId: string) => {
    const conversation = readChatConversation(conversationId);
    if (!conversation?.activeSessionKey) {
      setPrimaryView('chat');
      return;
    }

    openChatRoute(buildActiveChatRoute({
      sessionKey: conversation.activeSessionKey,
      conversationId: conversation.id,
      kind: conversation.kind,
      initialPrompt: null,
      initialPromptKey: null,
      focusedTurnId: null,
      focusedTurnKey: null,
      initialAgentSlug: null,
      initialSkillSlug: null,
      initialSkillOption: null,
      initialStockContext: null,
    }));
  }, [openChatRoute]);

  const handleStartSkillConversation = (skill: SkillStoreItem) => {
    if (desktopUpdateNewRunBlockedReason) {
      setPrimaryView('chat');
      return;
    }
    const seed = `skill-${skill.slug}-${Date.now()}`;
    openChatRoute(buildActiveChatRoute({
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
        <InvestmentExpertsView
          title={viewLabel}
          client={client}
          accessToken={accessToken}
          authenticated={authenticated}
          onRequestAuth={onRequestAuth}
          onStartConversation={handleStartInvestmentExpertConversation}
        />
      );
    }

    if (viewKey === 'stock-market') {
      return <StockMarketView title={viewLabel} client={client} onStartResearch={handleStartStockResearchConversation} />;
    }

    if (viewKey === 'fund-market') {
      return <FundMarketView title={viewLabel} client={client} onStartResearch={handleStartFundResearchConversation} />;
    }

    if (viewKey === 'lobster-store') {
      return (
        <LobsterStoreView
          title={viewLabel}
          client={client}
          accessToken={accessToken}
          authenticated={authenticated}
          currentUser={currentUser}
          onStartConversation={handleStartLobsterConversation}
          onRequestAuth={onRequestAuth}
        />
      );
    }

    if (currentSkillStoreViewConfig) {
      return (
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
      );
    }

    if (viewKey === 'mcp-store') {
      return (
        <MCPStoreView
          title={viewLabel}
          client={client}
          accessToken={accessToken}
          authenticated={authenticated}
          onRequestAuth={onRequestAuth}
        />
      );
    }

    if (viewKey === 'data-connections') {
      return <DataConnectionsView title={viewLabel} />;
    }

    if (viewKey === 'security') {
      return <SecurityCenterView title={viewLabel} />;
    }

    if (viewKey === 'memory') {
      return <MemoryView title={viewLabel} />;
    }

    if (viewKey === 'task-center') {
      return (
        <TaskCenterView
          selectedTurnId={selectedTurnId}
          onSelectTurn={setSelectedTurnId}
          onOpenTurnChat={handleOpenTurnChat}
          onBackToChat={() => setPrimaryView('chat')}
          taskCenterLabel={viewLabel}
          chatMenuLabel={chatMenuLabel}
        />
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
      if (showWelcomeBackground) {
        return <WelcomeBackgroundView welcomePageConfig={welcomePageConfig} onRequestAuth={onRequestAuth} />;
      }
      if (authenticated) {
        return (
          <OpenClawCronSurface
            title={viewLabel}
            gatewayUrl={GATEWAY_WS_URL}
            gatewayToken={gatewayAuth.token}
            gatewayPassword={gatewayAuth.password}
            sessionKey={CRON_SYSTEM_SESSION_KEY}
            shellAuthenticated={authenticated}
          />
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
      return <IMBotsView title={viewLabel} client={imBotClient} />;
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
          active={overlayView === 'recharge'}
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
    <div className="relative flex h-screen overflow-hidden bg-[var(--bg-page)]">
      <Sidebar
        user={currentUser}
        activeView={resolvedPrimaryView}
        enabledMenuKeys={enabledMenuKeys}
        menuUiConfig={menuUiConfig}
        selectedConversationId={activeChatRoute.conversationId}
        authenticated={authenticated}
        onOpenChat={() => setPrimaryView('chat')}
        onStartNewChat={handleStartNewChat}
        onOpenInvestmentExperts={() => setPrimaryView('investment-experts')}
        onOpenCron={() => setPrimaryView('cron')}
        onOpenLobsterStore={() => setPrimaryView('lobster-store')}
        onOpenSkillStore={() => setPrimaryView('skill-store')}
        onOpenMcpStore={() => setPrimaryView('mcp-store')}
        onOpenMenu={(menuKey) => setPrimaryView(menuKey)}
        onOpenDataConnections={() => setPrimaryView('data-connections')}
        onOpenSecurity={() => setPrimaryView('security')}
        onOpenImBots={() => setPrimaryView('im-bots')}
        onOpenMemory={() => setPrimaryView('memory')}
        onOpenConversation={handleOpenConversation}
        onOpenAccount={() => {
          if (!authenticated) {
            onRequestAuth('login', 'account');
            return;
          }
          setOverlayView('account');
        }}
        onOpenRechargeCenter={handleHeaderRechargeAction}
        onOpenLogin={() => onRequestAuth('login')}
        onOpenSettings={() => setOverlayView('settings')}
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
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {resolvedPrimaryView === 'data-connections' || headerConfig.enabled === false ? null : (
          <IClawHeader
            config={headerConfig}
            balance={creditBalance?.total_available_balance ?? creditBalance?.available_balance ?? creditBalance?.balance ?? null}
            loading={creditBalanceLoading}
            authenticated={authenticated}
            onCreditsClick={handleHeaderAccountAction}
            onRechargeClick={handleHeaderRechargeAction}
          />
        )}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {keepChatSurfaceMounted
            ? mountedChatSurfaceKeys.map((surfaceKey) => {
                const entry = chatSurfaceEntries[surfaceKey];
                if (!entry) {
                  return null;
                }
                const isActive = resolvedPrimaryView === 'chat' && isSurfaceVisible('chat', surfaceKey);
                return (
                  <div key={`chat-surface:${surfaceKey}`} className={buildSurfaceLayerClassName(isActive)}>
                    <OpenClawChatSurface
                      key={`chat-surface:${surfaceKey}:${entry.version}`}
                      gatewayUrl={GATEWAY_WS_URL}
                      gatewayToken={gatewayAuth.token}
                      gatewayPassword={gatewayAuth.password}
                      authBaseUrl={AUTH_BASE_URL}
                      appName={BRAND.brandId}
                      conversationId={entry.route.conversationId}
                      sessionKey={entry.route.sessionKey}
                      initialPrompt={entry.route.initialPrompt}
                      initialPromptKey={entry.route.initialPromptKey}
                      focusedTurnId={entry.route.focusedTurnId}
                      focusedTurnKey={entry.route.focusedTurnKey}
                      initialAgentSlug={entry.route.initialAgentSlug}
                      initialSkillSlug={entry.route.initialSkillSlug}
                      initialSkillOption={entry.route.initialSkillOption}
                      initialStockContext={entry.route.initialStockContext}
                      shellAuthenticated={chatShellAuthenticated}
                      creditClient={client}
                      creditToken={accessToken}
                      onCreditBalanceRefresh={refreshCreditBalance}
                      user={currentUser}
                      inputComposerConfig={inputComposerConfig}
                      welcomePageConfig={welcomePageConfig}
                      onGeneralChatSessionOverloaded={handleRotateGeneralChatSession}
                      onOpenRechargeCenter={() => setOverlayView('recharge')}
                      onBusyStateChange={(busy) => updateChatSurfaceRuntimeFlags(surfaceKey, {busy})}
                      onPendingBillingStateChange={(hasPendingBilling) =>
                        updateChatSurfaceRuntimeFlags(surfaceKey, {hasPendingBilling})
                      }
                      surfaceVisible={isActive}
                      sendBlockedReason={desktopUpdateSendBlockedReason}
                    />
                  </div>
                );
              })
            : null}
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
          {resolvedPrimaryView === 'chat' ? (
            showStartupGate ? (
              <div className={buildSurfaceLayerClassName(true)}>
                <ChatBootstrapPlaceholderView />
              </div>
            ) : showWelcomeBackground ? (
              <div className={buildSurfaceLayerClassName(true)}>
                <WelcomeBackgroundView welcomePageConfig={welcomePageConfig} onRequestAuth={onRequestAuth} />
              </div>
            ) : chatShellAuthenticated ? null : (
              <div className={buildSurfaceLayerClassName(true)}>
                <RuntimeAuthRequiredView
                  eyebrow="Chat Shell"
                  title="当前聊天区还不能挂载运行时"
                  description="这不是正常空态。当前是 iClaw shell 还没有完成登录确认，因此 OpenClaw chat wrapper 暂时不会挂载。"
                  authenticated={chatShellAuthenticated}
                  hasGatewayAuth={Boolean(gatewayAuth.token || gatewayAuth.password)}
                  onLogin={() => onRequestAuth('login')}
                />
              </div>
            )
          ) : null}
        </div>
      </div>
      {mountedOverlaySurfaceKeys.map((view) => (
        <div key={`overlay-surface:${view}`}>{renderOverlaySurface(view)}</div>
      ))}
    </div>
  );
}
