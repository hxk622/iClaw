import { useEffect, useRef, useState } from 'react';
import type { SVGProps } from 'react';
import {
  Bot,
  Blocks,
  BookOpen,
  CheckSquare,
  Link2,
  MessageSquare,
  Plus,
} from 'lucide-react';
import type { DesktopUpdateHint } from '@iclaw/sdk';
import { AvatarDropdown } from './AvatarDropdown';
import { DesktopUpdateCard } from './DesktopUpdateCard';
import { RecentTasksList } from './RecentTasksList';
import { Button } from './ui/Button';
import { BRAND } from '../lib/brand';
import {
  resolveUserAvatarUrl,
  resolveUserInitial,
  resolveUserName,
  type AppUserAvatarSource,
} from '../lib/user-avatar';

type SidebarUser = AppUserAvatarSource;
type PrimaryView = 'chat' | 'lobster-store' | 'skill-store' | 'cron' | 'im-bots' | 'data-connections' | 'task-center' | 'memory';

function LobsterStoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 7.2c2.8 0 5.1 2.2 5.1 5v1.7c0 2.1-1.2 4-3.1 4.9l-2 1-2-1A5.49 5.49 0 0 1 6.9 13.9v-1.7c0-2.8 2.3-5 5.1-5Z" />
      <path d="M9.2 6.1 7.5 4.4" />
      <path d="m14.8 6.1 1.7-1.7" />
      <path d="M8.4 12.3 6 10.9" />
      <path d="m15.6 12.3 2.4-1.4" />
      <path d="M10.1 10.8v2.4" />
      <path d="M13.9 10.8v2.4" />
      <path d="M10.6 16.7h2.8" />
    </svg>
  );
}

interface SidebarProps {
  user: SidebarUser | null;
  activeView?: PrimaryView;
  selectedTaskId?: string | null;
  authenticated?: boolean;
  onOpenChat?: () => void;
  onOpenCron?: () => void;
  onOpenLobsterStore?: () => void;
  onOpenSkillStore?: () => void;
  onOpenDataConnections?: () => void;
  onOpenImBots?: () => void;
  onOpenMemory?: () => void;
  onOpenTasks?: () => void;
  onSelectTask?: (taskId: string) => void;
  onLogout?: () => void;
  onOpenAccount?: () => void;
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
  icon: React.ComponentType<SVGProps<SVGSVGElement>>;
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
  selectedTaskId = null,
  authenticated = false,
  onOpenChat,
  onOpenCron,
  onOpenLobsterStore,
  onOpenSkillStore,
  onOpenDataConnections,
  onOpenImBots,
  onOpenMemory,
  onOpenTasks,
  onSelectTask,
  onLogout,
  onOpenAccount,
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
  const isDevChannel = import.meta.env.DEV || import.meta.env.MODE === 'development';
  const brandText = isDevChannel ? BRAND.devSidebarTitle : BRAND.sidebarTitle;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  const mainItems: SidebarItem[] = [
    {
      key: 'chat',
      label: '智能对话',
      icon: MessageSquare,
      iconClass: 'text-[var(--text-secondary)]',
      active: activeView === 'chat',
      onClick: onOpenChat,
    },
    {
      key: 'cron',
      label: '定时任务',
      icon: CheckSquare,
      iconClass: 'text-[var(--text-secondary)]',
      active: activeView === 'cron',
      onClick: onOpenCron,
    },
    {
      key: 'lobster-store',
      label: '龙虾商店',
      icon: LobsterStoreIcon,
      iconClass: 'text-[var(--text-secondary)]',
      iconWrapClass: 'rounded-[10px] border border-transparent bg-transparent',
      active: activeView === 'lobster-store',
      onClick: onOpenLobsterStore,
    },
    {
      key: 'skill-store',
      label: '技能商店',
      icon: Blocks,
      iconClass: 'text-[var(--text-secondary)]',
      active: activeView === 'skill-store',
      onClick: onOpenSkillStore,
    },
    {
      key: 'memory',
      label: '记忆管理',
      icon: BookOpen,
      iconClass: 'text-[var(--text-secondary)]',
      active: activeView === 'memory',
      onClick: onOpenMemory,
    },
    {
      key: 'link',
      label: '数据连接',
      icon: Link2,
      iconClass: 'text-[var(--text-secondary)]',
      active: activeView === 'data-connections',
      onClick: onOpenDataConnections,
    },
    {
      key: 'im-bots',
      label: 'IM机器人',
      icon: Bot,
      iconClass: 'text-[var(--text-secondary)]',
      active: activeView === 'im-bots',
      onClick: onOpenImBots,
    },
  ];

  const renderGroup = (title: string, items: SidebarItem[]) => (
    <div className="mb-4">
      <div className="mb-2 px-3 text-xs text-[var(--text-muted)]">{title}</div>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => item.onClick?.()}
            className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-all duration-[var(--motion-panel)] active:scale-[0.992] ${
              item.active
                ? 'bg-[var(--bg-hover)] shadow-[var(--shadow-sm)]'
                : 'hover:translate-x-[4px] hover:scale-[1.015] hover:bg-[var(--bg-hover)]'
            }`}
            style={{
              transitionTimingFunction: 'var(--motion-spring)',
              transformOrigin: 'left center',
            }}
          >
            {item.iconWrapClass ? (
              <span
                className={`transition-all duration-[var(--motion-panel)] ${
                  item.active
                    ? 'border-[rgba(168,140,93,0.22)] bg-[rgba(168,140,93,0.12)] shadow-[0_6px_14px_rgba(168,140,93,0.10)]'
                    : 'group-hover:border-[rgba(168,140,93,0.18)] group-hover:bg-[rgba(168,140,93,0.08)]'
                } ${item.iconWrapClass}`}
                style={{ transitionTimingFunction: 'var(--motion-spring)' }}
                aria-hidden="true"
              >
                <item.icon
                  className={`h-5 w-5 transition-transform duration-[var(--motion-panel)] ${
                    item.active ? 'scale-110' : 'group-hover:scale-105'
                  } ${item.active ? 'text-[var(--brand-primary)]' : item.iconClass}`}
                  style={{
                    transitionTimingFunction: 'var(--motion-spring)',
                    opacity: item.active ? 1 : 0.9,
                  }}
                />
              </span>
            ) : (
              <item.icon
                className={`h-5 w-5 transition-transform duration-[var(--motion-panel)] ${item.active ? 'scale-110 text-[var(--brand-primary)]' : `group-hover:scale-110 group-hover:text-[var(--brand-primary)] ${item.iconClass}`}`}
                style={{ transitionTimingFunction: 'var(--motion-spring)' }}
              />
            )}
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
    <div className="mb-4">
      <div className="mb-2 px-3 text-xs text-[var(--text-muted)]">记录</div>
      <RecentTasksList
        selectedTaskId={activeView === 'task-center' ? selectedTaskId : null}
        onOpenAll={onOpenTasks}
        onSelectTask={(taskId) => {
          onSelectTask?.(taskId);
          onOpenTasks?.();
        }}
      />
    </div>
  );

  return (
    <div className="flex h-screen w-[256px] shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-page)]">
      <div className="flex h-10 items-center gap-3 border-b border-[var(--border-default)] px-4">
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)]">
          <img src={BRAND.assets.faviconPngSrc} alt={BRAND.assets.logoAlt} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium text-[var(--text-primary)]">{brandText}</div>
          <div className="text-[11px] text-[var(--text-muted)]">{BRAND.sidebarSubtitle}</div>
        </div>
      </div>

      <div className="border-b border-[var(--border-default)] p-3">
        <Button variant="primary" size="md" block className="rounded-xl py-2.5 text-[14px]">
          <Plus className="h-4 w-4" />
          新建对话
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {renderGroup('主体区', mainItems)}
        {renderRecordGroup()}
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
            {resolveUserAvatarUrl(user) ? (
              <img src={resolveUserAvatarUrl(user)!} alt="user avatar" className="h-full w-full object-cover" />
            ) : (
              resolveUserInitial(user)
            )}
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
          onClose={() => setMenuOpen(false)}
          onOpenAccount={() => onOpenAccount?.()}
          onOpenLogin={() => onOpenLogin?.()}
          onOpenSettings={() => onOpenSettings?.()}
          onLogout={() => onLogout?.()}
        />
      </div>
    </div>
  );
}
