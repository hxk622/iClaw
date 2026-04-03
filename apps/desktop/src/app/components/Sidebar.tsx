import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SVGProps } from 'react';
import {
  Bot,
  Blocks,
  BookOpen,
  CheckSquare,
  CheckCircle,
  Link2,
  Settings,
  MessageSquare,
  Plus,
  Shield,
} from 'lucide-react';
import type { DesktopUpdateHint } from '@iclaw/sdk';
import { AvatarDropdown } from './AvatarDropdown';
import { DesktopUpdateCard } from './DesktopUpdateCard';
import { RecentConversationsList } from './RecentConversationsList';
import { Button } from './ui/Button';
import { BRAND } from '../lib/brand';
import type { RequiredResolvedMenuUiConfig } from '../lib/oem-runtime';
import {
  buildGeneratedUserAvatarDataUrl,
  resolveUserAvatarUrl,
  resolveUserName,
  type AppUserAvatarSource,
} from '../lib/user-avatar';

type SidebarUser = AppUserAvatarSource;
type PrimaryView = string;

function MCPStoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8.2 7.4h7.6" />
      <path d="M8.2 12h7.6" />
      <path d="M8.2 16.6h7.6" />
      <path d="M5.2 7.4h.01" />
      <path d="M5.2 12h.01" />
      <path d="M5.2 16.6h.01" />
      <path d="M3.8 4.5h16.4a1.3 1.3 0 0 1 1.3 1.3v12.4a1.3 1.3 0 0 1-1.3 1.3H3.8a1.3 1.3 0 0 1-1.3-1.3V5.8a1.3 1.3 0 0 1 1.3-1.3Z" />
    </svg>
  );
}

interface SidebarProps {
  user: SidebarUser | null;
  activeView?: PrimaryView;
  enabledMenuKeys?: string[] | null;
  menuUiConfig: Record<string, RequiredResolvedMenuUiConfig>;
  selectedConversationId?: string | null;
  authenticated?: boolean;
  onOpenChat?: () => void;
  onStartNewChat?: () => void;
  onOpenInvestmentExperts?: () => void;
  onOpenCron?: () => void;
  onOpenLobsterStore?: () => void;
  onOpenSkillStore?: () => void;
  onOpenMcpStore?: () => void;
  onOpenMenu?: (menuKey: string) => void;
  onOpenDataConnections?: () => void;
  onOpenSecurity?: () => void;
  onOpenImBots?: () => void;
  onOpenMemory?: () => void;
  onOpenConversation?: (conversationId: string) => void;
  onDeleteConversation?: (conversationId: string) => void;
  onOpenTaskCenter?: () => void;
  onLogout?: () => void;
  onOpenAccount?: () => void;
  onOpenRechargeCenter?: () => void;
  onOpenLogin?: () => void;
  onOpenSettings?: () => void;
  desktopUpdateHint?: DesktopUpdateHint | null;
  desktopUpdateBusy?: boolean;
  desktopUpdateError?: string | null;
  desktopUpdateOpened?: boolean;
  desktopUpdateStatus?: 'available' | 'checking' | 'downloading' | 'ready-to-restart';
  desktopUpdateProgress?: number | null;
  desktopUpdateDetail?: string | null;
  onUpgradeDesktopApp?: () => void;
  onRestartDesktopApp?: () => void;
  onSkipDesktopUpdate?: () => void;
  newChatDisabledReason?: string | null;
}

interface SidebarItem {
  key: string;
  label: string;
  icon?: React.ComponentType<SVGProps<SVGSVGElement>>;
  imageSrc?: string;
  imageAlt?: string;
  iconClass: string;
  iconWrapClass?: string;
  badge?: string;
  dot?: boolean;
  active?: boolean;
  onClick?: () => void;
}

const SidebarBrandHeader = memo(function SidebarBrandHeader({brandText}: {brandText: string}) {
  return (
    <div className="flex h-[50px] items-center gap-3 border-b border-[var(--border-default)] px-4">
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-default)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bg-card)_84%,white_16%),color-mix(in_srgb,var(--bg-page)_90%,white_10%))] shadow-[var(--shadow-sm)]">
        <img src={BRAND.assets.faviconPngSrc} alt={BRAND.assets.logoAlt} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">{brandText}</div>
      </div>
    </div>
  );
});

const SidebarNewChatBar = memo(function SidebarNewChatBar({
  chatEnabled,
  newChatDisabledReason,
  onStartNewChat,
}: {
  chatEnabled: boolean;
  newChatDisabledReason: string | null;
  onStartNewChat?: () => void;
}) {
  if (!chatEnabled) {
    return null;
  }
  return (
    <div className="border-b border-[var(--border-default)] p-3">
      <Button
        variant="secondary"
        size="sm"
        block
        onClick={onStartNewChat}
        disabled={Boolean(newChatDisabledReason)}
        title={newChatDisabledReason || '新建对话'}
        leadingIcon={
          <span className="inline-flex h-5.5 w-5.5 items-center justify-center rounded-full bg-[var(--chip-brand-bg)] text-[var(--chip-brand-text)]">
            <Plus className="h-3.5 w-3.5" />
          </span>
        }
        className="h-10 justify-center rounded-[13px] border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-card)_86%,var(--bg-page))] px-3 text-[14px] font-semibold text-[var(--text-primary)] shadow-none hover:border-[var(--chip-brand-border)] hover:bg-[color-mix(in_srgb,var(--chip-brand-bg)_48%,var(--bg-card))] hover:text-[var(--text-primary)]"
      >
        新建对话
      </Button>
    </div>
  );
});

function SidebarMenuGroup({title, items}: {title: string | null; items: SidebarItem[]}) {
  return (
    <div className="mb-3">
      {title ? (
        <div className="mb-2 px-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">{title}</span>
            <span className="h-px flex-1 bg-[color-mix(in_srgb,var(--border-default)_78%,transparent)]" />
          </div>
        </div>
      ) : null}
      <div className="space-y-0.5">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => item.onClick?.()}
            className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-1.5 text-left transition-all duration-[var(--motion-panel)] active:scale-[0.992] ${
              item.active
                ? 'bg-[var(--bg-hover)] shadow-[var(--shadow-sm)]'
                : 'hover:translate-x-[4px] hover:scale-[1.015] hover:bg-[var(--bg-hover)]'
            }`}
            style={{
              transitionTimingFunction: 'var(--motion-spring)',
              transformOrigin: 'left center',
            }}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden="true">
              {item.iconWrapClass ? (
                <span
                  className={`flex h-6 w-6 items-center justify-center transition-all duration-[var(--motion-panel)] ${
                    item.active
                      ? 'border-[rgba(168,140,93,0.22)] bg-[rgba(168,140,93,0.12)] shadow-[0_6px_14px_rgba(168,140,93,0.10)]'
                      : 'group-hover:border-[rgba(168,140,93,0.18)] group-hover:bg-[rgba(168,140,93,0.08)]'
                  } ${item.iconWrapClass}`}
                  style={{ transitionTimingFunction: 'var(--motion-spring)' }}
                >
                  {item.imageSrc ? (
                    <img
                      src={item.imageSrc}
                      alt={item.imageAlt || item.label}
                      className={`h-full w-full object-cover transition-transform duration-[var(--motion-panel)] ${
                        item.active ? 'scale-105' : 'group-hover:scale-105'
                      }`}
                      style={{
                        transitionTimingFunction: 'var(--motion-spring)',
                        opacity: item.active ? 1 : 0.96,
                      }}
                    />
                  ) : item.icon ? (
                    <item.icon
                      className={`h-5 w-5 transition-transform duration-[var(--motion-panel)] ${
                        item.active ? 'scale-110' : 'group-hover:scale-105'
                      } ${item.active ? 'text-[var(--brand-primary)]' : item.iconClass}`}
                      style={{
                        transitionTimingFunction: 'var(--motion-spring)',
                        opacity: item.active ? 1 : 0.9,
                      }}
                    />
                  ) : null}
                </span>
              ) : item.imageSrc ? (
                <img
                  src={item.imageSrc}
                  alt={item.imageAlt || item.label}
                  className={`h-5 w-5 rounded-full object-cover transition-transform duration-[var(--motion-panel)] ${
                    item.active ? 'scale-110' : 'group-hover:scale-110'
                  }`}
                  style={{ transitionTimingFunction: 'var(--motion-spring)' }}
                />
              ) : item.icon ? (
                <item.icon
                  className={`h-5 w-5 transition-transform duration-[var(--motion-panel)] ${item.active ? 'scale-110 text-[var(--brand-primary)]' : `group-hover:scale-110 group-hover:text-[var(--brand-primary)] ${item.iconClass}`}`}
                  style={{ transitionTimingFunction: 'var(--motion-spring)' }}
                />
              ) : null}
            </span>
            <span className={`flex-1 text-[14px] font-medium text-[var(--text-primary)] transition-transform duration-[var(--motion-panel)] ${item.active ? 'translate-x-[1px] font-semibold' : 'group-hover:translate-x-[1px]'}`}>
              {item.label}
            </span>
            {item.dot && <span className="h-2 w-2 rounded-full bg-[var(--state-success)]" />}
            {item.badge && (
              <span className="rounded-full bg-[var(--brand-primary)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-on-primary)] transition-transform duration-[var(--motion-panel)] group-hover:scale-105">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

const SidebarPrimaryNav = memo(function SidebarPrimaryNav({
  groupedMainItems,
}: {
  groupedMainItems: Array<{ title: string | null; items: SidebarItem[] }>;
}) {
  return (
    <>
      {groupedMainItems.map((group) => <SidebarMenuGroup key={group.title} title={group.title} items={group.items} />)}
    </>
  );
});

const SidebarRecentNav = memo(function SidebarRecentNav({
  chatEnabled,
  selectedConversationId,
  onOpenConversation,
  onDeleteConversation,
  onOpenTaskCenter,
}: {
  chatEnabled: boolean;
  selectedConversationId: string | null;
  onOpenConversation?: (conversationId: string) => void;
  onDeleteConversation?: (conversationId: string) => void;
  onOpenTaskCenter?: () => void;
}) {
  if (!chatEnabled) {
    return null;
  }
  return (
    <div className="mb-3">
      <RecentConversationsList
        title="最近对话"
        selectedConversationId={selectedConversationId}
        onSelectConversation={onOpenConversation}
        onDeleteConversation={onDeleteConversation}
        onOpenMore={onOpenTaskCenter}
      />
    </div>
  );
});

const SidebarFooterAccount = memo(function SidebarFooterAccount({
  user,
  authenticated,
  settingsEnabled,
  onOpenAccount,
  onOpenRechargeCenter,
  onOpenLogin,
  onOpenSettings,
  onLogout,
}: {
  user: SidebarUser | null;
  authenticated: boolean;
  settingsEnabled: boolean;
  onOpenAccount?: () => void;
  onOpenRechargeCenter?: () => void;
  onOpenLogin?: () => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const resolvedAvatarUrl = resolveUserAvatarUrl(user);
  const userAvatarSrc = !avatarLoadFailed && resolvedAvatarUrl
    ? resolvedAvatarUrl
    : buildGeneratedUserAvatarDataUrl(user, 'i');

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [resolvedAvatarUrl, user?.avatar_url, user?.avatarUrl, user?.avatar, user?.name, user?.username]);

  return (
    <div className="relative p-3 pt-0" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="group flex w-full cursor-pointer items-center gap-3 rounded-xl bg-[var(--bg-elevated)] px-2 py-1.5 text-left transition-all duration-[var(--motion-panel)] hover:translate-x-[2px] hover:scale-[1.01] hover:bg-[var(--bg-hover)] active:scale-[0.992]"
        style={{
          transitionTimingFunction: 'var(--motion-spring)',
          transformOrigin: 'left center',
        }}
      >
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#2b2b2b_0%,#4d4d4d_100%)] text-sm font-medium text-white transition-transform duration-[var(--motion-panel)] group-hover:scale-105">
          <img
            src={userAvatarSrc}
            alt="user avatar"
            className="h-full w-full object-cover"
            onError={() => {
              if (!avatarLoadFailed) {
                setAvatarLoadFailed(true);
              }
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-[var(--text-primary)]">{resolveUserName(user)}</div>
          {!authenticated ? (
            <div className="text-[12px] text-[var(--text-secondary)]">点击登录解锁完整功能</div>
          ) : null}
        </div>
      </button>

      <AvatarDropdown
        open={menuOpen}
        authenticated={authenticated}
        settingsVisible={settingsEnabled}
        settingsLabel="设置"
        onClose={() => setMenuOpen(false)}
        onOpenAccount={() => onOpenAccount?.()}
        onOpenRechargeCenter={() => onOpenRechargeCenter?.()}
        onOpenLogin={() => onOpenLogin?.()}
        onOpenSettings={() => onOpenSettings?.()}
        onLogout={() => onLogout?.()}
      />
    </div>
  );
}, (prev, next) =>
  prev.authenticated === next.authenticated &&
  prev.settingsEnabled === next.settingsEnabled &&
  prev.user === next.user
);

function SidebarComponent({
  user,
  activeView = 'chat',
  enabledMenuKeys = null,
  menuUiConfig,
  selectedConversationId = null,
  authenticated = false,
  onOpenChat,
  onStartNewChat,
  onOpenInvestmentExperts,
  onOpenCron,
  onOpenLobsterStore,
  onOpenSkillStore,
  onOpenMcpStore,
  onOpenMenu,
  onOpenDataConnections,
  onOpenSecurity,
  onOpenImBots,
  onOpenMemory,
  onOpenConversation,
  onDeleteConversation,
  onOpenTaskCenter,
  onLogout,
  onOpenAccount,
  onOpenRechargeCenter,
  onOpenLogin,
  onOpenSettings,
  desktopUpdateHint = null,
  desktopUpdateBusy = false,
  desktopUpdateError = null,
  desktopUpdateOpened = false,
  desktopUpdateStatus = 'available',
  desktopUpdateProgress = null,
  desktopUpdateDetail = null,
  onUpgradeDesktopApp,
  onRestartDesktopApp,
  onSkipDesktopUpdate,
  newChatDisabledReason = null,
}: SidebarProps) {
  const isDevChannel =
    !('__TAURI_INTERNALS__' in window) && (import.meta.env.DEV || import.meta.env.MODE === 'development');
  const brandText = isDevChannel ? BRAND.devSidebarTitle : BRAND.sidebarTitle;

  const requireMenuConfig = useCallback((key: string): RequiredResolvedMenuUiConfig => {
    const entry = menuUiConfig[key];
    if (!entry) {
      throw new Error(`Sidebar menu config is missing for "${key}"`);
    }
    return entry;
  }, [menuUiConfig]);

  const resolveMenuLabel = useCallback((key: string) => requireMenuConfig(key).displayName, [requireMenuConfig]);
  const resolveMenuGroup = useCallback((key: string) => requireMenuConfig(key).group, [requireMenuConfig]);

  const iconRegistry: Record<string, Pick<SidebarItem, 'icon' | 'imageSrc' | 'imageAlt' | 'iconClass' | 'iconWrapClass'>> = {
    chat: { icon: MessageSquare, iconClass: 'text-[rgb(73,102,146)]' },
    cron: { icon: CheckSquare, iconClass: 'text-[var(--state-warn)]' },
    'investment-experts': {
      imageSrc: '/menu-icons/buffett.png',
      imageAlt: 'Warren Buffett',
      iconClass: 'text-[rgb(113,101,82)]',
      iconWrapClass: 'rounded-full border border-[rgba(168,140,93,0.22)] bg-[rgba(168,140,93,0.08)] shadow-[0_6px_14px_rgba(168,140,93,0.10)] overflow-hidden',
    },
    'lobster-store': {
      imageSrc: '/agent-avatars/pexels/portrait-01.jpg',
      imageAlt: 'Lobster expert avatar',
      iconClass: 'text-[rgb(113,101,82)]',
      iconWrapClass: 'rounded-full border border-[rgba(168,140,93,0.22)] bg-[rgba(168,140,93,0.08)] shadow-[0_6px_14px_rgba(168,140,93,0.10)] overflow-hidden',
    },
    'skill-store': { icon: Blocks, iconClass: 'text-[rgb(106,90,144)]' },
    'mcp-store': {
      icon: MCPStoreIcon,
      iconClass: 'text-[rgb(69,96,132)]',
      iconWrapClass: 'rounded-[10px] border border-transparent bg-transparent',
    },
    'finance-skills': { icon: Blocks, iconClass: 'text-[rgb(106,90,144)]' },
    'foundation-skills': { icon: BookOpen, iconClass: 'text-[rgb(84,111,138)]' },
    'stock-market': { icon: CheckCircle, iconClass: 'text-[rgb(73,102,146)]' },
    'fund-market': { icon: BookOpen, iconClass: 'text-[rgb(113,101,82)]' },
    memory: { icon: BookOpen, iconClass: 'text-[var(--state-success)]' },
    'data-connections': { icon: Link2, iconClass: 'text-[rgb(49,95,158)]' },
    'im-bots': { icon: Bot, iconClass: 'text-[rgb(151,103,69)]' },
    security: { icon: Shield, iconClass: 'text-[var(--state-success)]' },
    settings: { icon: Settings, iconClass: 'text-[var(--text-secondary)]' },
    'task-center': { icon: CheckCircle, iconClass: 'text-[var(--brand-primary)]' },
  };

  const resolveMenuVisual = useCallback((key: string): Pick<SidebarItem, 'icon' | 'imageSrc' | 'imageAlt' | 'iconClass' | 'iconWrapClass'> => {
    const iconKey = requireMenuConfig(key).iconKey;
    const visual = iconRegistry[iconKey];
    if (!visual) {
      throw new Error(`Sidebar icon registry does not support iconKey "${iconKey}" for menu "${key}"`);
    }
    return visual;
  }, [requireMenuConfig]);

  const knownMenuClickHandlers = useMemo<Record<string, (() => void) | undefined>>(
    () => ({
      chat: onOpenChat,
      cron: onOpenCron,
      'investment-experts': onOpenInvestmentExperts,
      'lobster-store': onOpenLobsterStore,
      'skill-store': onOpenSkillStore,
      'mcp-store': onOpenMcpStore,
      memory: onOpenMemory,
      'data-connections': onOpenDataConnections,
      'im-bots': onOpenImBots,
      security: onOpenSecurity,
    }),
    [
      onOpenChat,
      onOpenCron,
      onOpenInvestmentExperts,
      onOpenLobsterStore,
      onOpenSkillStore,
      onOpenMcpStore,
      onOpenMemory,
      onOpenDataConnections,
      onOpenImBots,
      onOpenSecurity,
    ],
  );

  const configuredMainMenuKeys = useMemo(
    () =>
      (enabledMenuKeys || Object.keys(menuUiConfig)).filter(
        (key) => key !== 'settings' && Boolean(menuUiConfig[key]),
      ),
    [enabledMenuKeys, menuUiConfig],
  );
  const mainItems = useMemo(
    () =>
      configuredMainMenuKeys.map((key) => {
        const visual = resolveMenuVisual(key);
        return {
          key,
          label: resolveMenuLabel(key),
          ...visual,
          active: activeView === key,
          onClick: knownMenuClickHandlers[key] ?? (() => onOpenMenu?.(key)),
        } satisfies SidebarItem;
      }),
    [activeView, configuredMainMenuKeys, knownMenuClickHandlers, onOpenMenu, resolveMenuLabel, resolveMenuVisual],
  );
  const chatEnabled = enabledMenuKeys ? enabledMenuKeys.includes('chat') : true;
  const settingsEnabled = true;

  const groupedMainItems = useMemo(
    () =>
      mainItems.reduce(
        (groups, item) => {
          const title = resolveMenuGroup(item.key);
          const bucket = groups.find((entry) => entry.title === title);
          if (bucket) {
            bucket.items.push(item);
          } else {
            groups.push({ title, items: [item] });
          }
          return groups;
        },
        [] as Array<{ title: string | null; items: SidebarItem[] }>,
      ),
    [mainItems, resolveMenuGroup],
  );

  return (
    <div className="relative isolate flex h-screen w-[256px] shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-page)] [contain:layout_paint_style] [transform:translateZ(0)]">
      <SidebarBrandHeader brandText={brandText} />
      <SidebarNewChatBar
        chatEnabled={chatEnabled}
        newChatDisabledReason={newChatDisabledReason}
        onStartNewChat={onStartNewChat}
      />

      <div className="flex-1 overflow-y-auto px-2 py-1.5">
        <SidebarPrimaryNav groupedMainItems={groupedMainItems} />
        <SidebarRecentNav
          chatEnabled={chatEnabled}
          selectedConversationId={activeView === 'chat' ? selectedConversationId : null}
          onOpenConversation={onOpenConversation}
          onDeleteConversation={onDeleteConversation}
          onOpenTaskCenter={onOpenTaskCenter}
        />
      </div>

      <div className="border-t border-[var(--border-default)] p-3 pb-0">
        {desktopUpdateHint ? (
          <DesktopUpdateCard
            hint={desktopUpdateHint}
            status={desktopUpdateStatus}
            busy={desktopUpdateBusy}
            error={desktopUpdateError}
            opened={desktopUpdateOpened}
            progress={desktopUpdateProgress}
            detail={desktopUpdateDetail}
            onUpgrade={() => onUpgradeDesktopApp?.()}
            onRestart={() => onRestartDesktopApp?.()}
            onSkip={desktopUpdateHint.mandatory ? undefined : () => onSkipDesktopUpdate?.()}
          />
        ) : null}
      </div>

      <SidebarFooterAccount
        user={user}
        authenticated={authenticated}
        settingsEnabled={settingsEnabled}
        onOpenAccount={onOpenAccount}
        onOpenRechargeCenter={onOpenRechargeCenter}
        onOpenLogin={onOpenLogin}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
      />
    </div>
  );
}

export const Sidebar = memo(SidebarComponent);
