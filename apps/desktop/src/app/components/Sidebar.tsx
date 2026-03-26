import { useEffect, useRef, useState } from 'react';
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
import { RecentTasksList } from './RecentTasksList';
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

function AssistantStoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 12.2a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Z" />
      <path d="M6.8 18.1c.8-2.4 2.8-3.6 5.2-3.6s4.4 1.2 5.2 3.6" />
      <path d="M17.8 5.2h2.6" />
      <path d="M19.1 3.9v2.6" />
      <path d="m16.8 7.5.9.9" />
    </svg>
  );
}

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
  selectedTaskId?: string | null;
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
  onOpenTasks?: () => void;
  onSelectTask?: (taskId: string) => void;
  onOpenTaskChat?: (taskId: string) => void;
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

export function Sidebar({
  user,
  activeView = 'chat',
  enabledMenuKeys = null,
  menuUiConfig,
  selectedTaskId = null,
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
  onOpenTasks,
  onSelectTask,
  onOpenTaskChat,
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
}: SidebarProps) {
  const isDevChannel =
    !('__TAURI_INTERNALS__' in window) && (import.meta.env.DEV || import.meta.env.MODE === 'development');
  const brandText = isDevChannel ? BRAND.devSidebarTitle : BRAND.sidebarTitle;

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

  const requireMenuConfig = (key: string): RequiredResolvedMenuUiConfig => {
    const entry = menuUiConfig[key];
    if (!entry) {
      throw new Error(`Sidebar menu config is missing for "${key}"`);
    }
    return entry;
  };

  const resolveMenuLabel = (key: string) => requireMenuConfig(key).displayName;
  const resolveMenuGroup = (key: string) => requireMenuConfig(key).group;

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
      icon: AssistantStoreIcon,
      iconClass: 'text-[var(--brand-primary)]',
      iconWrapClass: 'rounded-[10px] border border-transparent bg-transparent',
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

  const resolveMenuVisual = (key: string): Pick<SidebarItem, 'icon' | 'imageSrc' | 'imageAlt' | 'iconClass' | 'iconWrapClass'> => {
    const iconKey = requireMenuConfig(key).iconKey;
    const visual = iconRegistry[iconKey];
    if (!visual) {
      throw new Error(`Sidebar icon registry does not support iconKey "${iconKey}" for menu "${key}"`);
    }
    return visual;
  };

  const knownMenuClickHandlers: Record<string, (() => void) | undefined> = {
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
  };

  const buildMenuItem = (key: string): SidebarItem => {
    const visual = resolveMenuVisual(key);
    return {
      key,
      label: resolveMenuLabel(key),
      ...visual,
      active: activeView === key,
      onClick: knownMenuClickHandlers[key] ?? (() => onOpenMenu?.(key)),
    };
  };

  const configuredMainMenuKeys = (enabledMenuKeys || Object.keys(menuUiConfig)).filter(
    (key) => key !== 'settings' && key !== 'task-center' && Boolean(menuUiConfig[key]),
  );
  const mainItems = configuredMainMenuKeys.map(buildMenuItem);
  const chatEnabled = enabledMenuKeys ? enabledMenuKeys.includes('chat') : true;
  const taskCenterEnabled = enabledMenuKeys ? enabledMenuKeys.includes('task-center') : true;
  const settingsEnabled = true;

  const groupedMainItems = mainItems.reduce(
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
  );

  const renderGroup = (title: string | null, items: SidebarItem[]) => (
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
              ) : (
                item.imageSrc ? (
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
                ) : null
              )}
            </span>
            <span className={`flex-1 text-[14px] text-[var(--text-primary)] transition-transform duration-[var(--motion-panel)] ${item.active ? 'translate-x-[1px] font-medium' : 'group-hover:translate-x-[1px]'}`}>
              {item.label}
            </span>
            {item.dot && <span className="h-2 w-2 rounded-full bg-[var(--state-success)]" />}
            {item.badge && (
              <span className="rounded-full bg-[var(--brand-primary)] px-2 py-0.5 text-[11px] text-[var(--brand-on-primary)] transition-transform duration-[var(--motion-panel)] group-hover:scale-105">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const renderRecordGroup = () => (
    <div className="mb-3">
      <RecentTasksList
        title={resolveMenuLabel('task-center')}
        selectedTaskId={activeView === 'task-center' ? selectedTaskId : null}
        onOpenAll={onOpenTasks}
        onSelectTask={(taskId) => {
          onSelectTask?.(taskId);
          if (onOpenTaskChat) {
            onOpenTaskChat(taskId);
            return;
          }
          onOpenTasks?.();
        }}
      />
    </div>
  );

  return (
    <div className="flex h-screen w-[256px] shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-page)]">
      <div className="flex h-14 items-center gap-3 border-b border-[var(--border-default)] px-4">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-default)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bg-card)_84%,white_16%),color-mix(in_srgb,var(--bg-page)_90%,white_10%))] shadow-[var(--shadow-sm)]">
          <img src={BRAND.assets.faviconPngSrc} alt={BRAND.assets.logoAlt} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">{brandText}</div>
        </div>
      </div>

      {chatEnabled ? (
        <div className="border-b border-[var(--border-default)] p-3">
          <Button
            variant="secondary"
            size="sm"
            block
            onClick={onStartNewChat}
            leadingIcon={
              <span className="inline-flex h-5.5 w-5.5 items-center justify-center rounded-full bg-[var(--chip-brand-bg)] text-[var(--chip-brand-text)]">
                <Plus className="h-3.5 w-3.5" />
              </span>
            }
            className="h-9.5 justify-center rounded-[13px] border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-card)_86%,var(--bg-page))] px-3 text-[13px] font-medium text-[var(--text-primary)] shadow-none hover:border-[var(--chip-brand-border)] hover:bg-[color-mix(in_srgb,var(--chip-brand-bg)_48%,var(--bg-card))] hover:text-[var(--text-primary)]"
          >
            新建对话
          </Button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-2 py-1.5">
        {groupedMainItems.map((group) => (
          <div key={group.title}>{renderGroup(group.title, group.items)}</div>
        ))}
        {taskCenterEnabled ? renderRecordGroup() : null}
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
            <div className="truncate text-[13px] text-[var(--text-primary)]">{resolveUserName(user)}</div>
            {!authenticated ? (
              <div className="text-[11px] text-[var(--text-muted)]">点击登录解锁完整功能</div>
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
    </div>
  );
}
