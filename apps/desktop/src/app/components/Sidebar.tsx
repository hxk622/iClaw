import { useEffect, useRef, useState } from 'react';
import {
  CheckSquare,
  History,
  Link2,
  MessageSquare,
  Plus,
  Settings,
  Smartphone,
  TrendingUp,
  Heart,
} from 'lucide-react';
import { AvatarDropdown } from './AvatarDropdown';

interface SidebarUser {
  name?: string | null;
  username?: string | null;
  display_name?: string | null;
  nickname?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;
}

interface SidebarProps {
  user: SidebarUser | null;
  onLogout?: () => void;
  onOpenSettings?: () => void;
}

interface SidebarItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  badge?: string;
  dot?: boolean;
  onClick?: () => void;
}

function userInitial(user: SidebarUser | null): string {
  if (!user) return 'i';
  const source = (
    user.name ||
    user.display_name ||
    user.nickname ||
    user.username ||
    user.email ||
    'i'
  ).trim();
  if (!source) return 'i';
  return source[0]!.toUpperCase();
}

function resolveAvatarUrl(user: SidebarUser | null): string | null {
  if (!user) return null;
  return user.avatar_url || user.avatarUrl || user.avatar || null;
}

function resolveUserName(user: SidebarUser | null): string {
  return (
    user?.name ||
    user?.display_name ||
    user?.nickname ||
    user?.username ||
    user?.email ||
    'iClaw User'
  );
}

export function Sidebar({ user, onLogout, onOpenSettings }: SidebarProps) {
  const isDevChannel = import.meta.env.DEV || import.meta.env.MODE === 'development';
  const brandText = isDevChannel ? 'iClaw-理财客-dev' : 'iClaw-理财客';

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
    { key: 'chat', label: '智能对话', icon: MessageSquare, iconClass: 'text-blue-500' },
    { key: 'task', label: '定时任务', icon: CheckSquare, iconClass: 'text-emerald-500', dot: true },
    { key: 'skill', label: '技能中心', icon: TrendingUp, iconClass: 'text-violet-500', badge: '15' },
    { key: 'link', label: '数据接续', icon: Link2, iconClass: 'text-cyan-500' },
  ];

  const recordItems: SidebarItem[] = [
    { key: 'history', label: '历史对话', icon: History, iconClass: 'text-orange-500' },
  ];

  const serviceItems: SidebarItem[] = [
    { key: 'sub', label: '订阅服务', icon: Heart, iconClass: 'text-rose-500' },
    { key: 'setting', label: '系统设置', icon: Settings, iconClass: 'text-[var(--text-secondary)]', onClick: onOpenSettings },
    { key: 'mobile', label: '手机登录', icon: Smartphone, iconClass: 'text-fuchsia-500' },
  ];

  const renderGroup = (title: string, items: SidebarItem[]) => (
    <div className="mb-4">
      <div className="mb-2 px-3 text-xs text-[var(--text-muted)]">{title}</div>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => item.onClick?.()}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all duration-[var(--motion-micro)] hover:translate-x-[2px] hover:bg-[var(--bg-hover)]"
            style={{ transitionTimingFunction: 'var(--motion-spring)' }}
          >
            <item.icon className={`h-5 w-5 ${item.iconClass}`} />
            <span className="flex-1 text-[14px] text-[var(--text-primary)]">{item.label}</span>
            {item.dot && <span className="h-2 w-2 rounded-full bg-[var(--state-success)]" />}
            {item.badge && (
              <span className="rounded-full bg-[var(--brand-primary)] px-2 py-0.5 text-[11px] text-[var(--brand-on-primary)]">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-[256px] flex-col border-r border-[var(--border-default)] bg-[var(--bg-page)]">
      <div className="flex h-10 items-center gap-3 border-b border-[var(--border-default)] px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)]">
          <img src="/logo.png" alt="iClaw logo" className="h-6 w-6 object-cover" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium text-[var(--text-primary)]">{brandText}</div>
          <div className="text-[11px] text-[var(--text-muted)]">LiCaiClaw</div>
        </div>
      </div>

      <div className="border-b border-[var(--border-default)] p-3">
        <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-[14px] text-[var(--brand-on-primary)] transition-colors hover:bg-[var(--brand-primary-hover)]">
          <Plus className="h-4 w-4" />
          新建对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {renderGroup('主体区', mainItems)}
        {renderGroup('记录', recordItems)}
        {renderGroup('服务', serviceItems)}
      </div>

      <div className="relative border-t border-[var(--border-default)] p-3" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-lg bg-[var(--bg-elevated)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
        >
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] text-sm font-medium text-[var(--brand-on-primary)]">
            {resolveAvatarUrl(user) ? (
              <img src={resolveAvatarUrl(user)!} alt="user avatar" className="h-full w-full object-cover" />
            ) : (
              userInitial(user)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] text-[var(--text-primary)]">{resolveUserName(user)}</div>
            <div className="text-[11px] text-[var(--text-muted)]">v0 preview</div>
          </div>
        </button>

        <AvatarDropdown
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onOpenSettings={() => onOpenSettings?.()}
          onLogout={() => onLogout?.()}
        />
      </div>
    </div>
  );
}
