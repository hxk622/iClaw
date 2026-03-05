import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Cloud,
  Code,
  MoreHorizontal,
  Sparkles,
  Wand2,
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

  const menuItems = [
    { icon: Sparkles, label: 'AI 浏览器', hasArrow: true },
    { icon: Code, label: '应用生成', hasArrow: true },
    { icon: Wand2, label: 'AI 创作' },
    { icon: Cloud, label: '云盘', hasArrow: true },
    { icon: MoreHorizontal, label: '更多' },
  ];

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

  return (
    <div className="flex h-screen w-[246px] flex-col bg-[#f7f7f7]">
      <div className="px-4 pt-5 pb-4">
        <div
          title={brandText}
          className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/50"
        >
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[#e8e8e8] bg-white">
            <img src="/logo.png" alt="iClaw logo" className="h-full w-full object-cover" />
          </div>
          <span className="text-[15px] text-[#1f1f1f]">{brandText}</span>
        </div>
      </div>

      <div className="space-y-1 px-4">
        {menuItems.map((item) => (
          <div
            key={item.label}
            className="group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-white/50"
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5 text-[#1f1f1f]" />
              <span className="text-[14px] text-[#1f1f1f]">{item.label}</span>
            </div>
            {item.hasArrow && (
              <ChevronRight className="h-4 w-4 text-[#8f8f8f] opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </div>
        ))}
      </div>

      <div className="mx-4 my-4 h-px bg-[#e5e5e5]" />

      <div className="flex-1 overflow-y-auto px-4">
        <div className="rounded-lg px-3 py-2.5 text-[14px] text-[#646464]">v0 仅实现基础对话</div>
      </div>

      <div className="relative border-t border-[#e5e5e5] px-4 py-2.5" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/50"
        >
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-sm font-medium text-white">
            {resolveAvatarUrl(user) ? (
              <img src={resolveAvatarUrl(user)!} alt="user avatar" className="h-full w-full object-cover" />
            ) : (
              userInitial(user)
            )}
          </div>
          <div className="flex-1">
            <div className="truncate text-[13px] text-[#1f1f1f]">{resolveUserName(user)}</div>
            <div className="text-[11px] text-[#8f8f8f]">v0 preview</div>
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
