import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  CircleHelp,
  Cloud,
  Code,
  FolderPlus,
  Globe,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  Settings,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';

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

        {menuOpen && (
          <div className="absolute bottom-[60px] left-2 right-2 z-40 rounded-[18px] border border-[#e5e5e5] bg-[#f8f8f8] px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            <button
              className="mb-1 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[20px] text-[#1f1f1f] hover:bg-white/70"
              onClick={() => {
                setMenuOpen(false);
                onOpenSettings?.();
              }}
            >
              <Settings className="h-6 w-6" />
              <span>设置</span>
            </button>

            <button className="mb-1 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[20px] text-[#1f1f1f] hover:bg-white/70">
              <FolderPlus className="h-6 w-6" />
              <span>收藏夹</span>
            </button>

            <div className="my-2 h-px bg-[#e2e2e2]" />

            <button className="mb-1 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[20px] text-[#1f1f1f] hover:bg-white/70">
              <Globe className="h-6 w-6" />
              <span>豆包官网</span>
            </button>

            <div className="mb-1 flex items-center gap-3 rounded-lg px-2 py-2 text-[20px] text-[#1f1f1f]">
              <RefreshCw className="h-6 w-6" />
              <span className="flex-1">新版本已安装</span>
              <button className="rounded-xl bg-[#ececec] px-4 py-2 text-[14px] text-[#2a2a2a]">重启应用</button>
            </div>

            <button className="mb-1 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[20px] text-[#1f1f1f] hover:bg-white/70">
              <CircleHelp className="h-6 w-6" />
              <span>帮助与反馈</span>
            </button>

            <div className="my-2 h-px bg-[#e2e2e2]" />

            <button
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[20px] text-[#1f1f1f] hover:bg-white/70"
              onClick={() => {
                setMenuOpen(false);
                onLogout?.();
              }}
            >
              <LogOut className="h-6 w-6" />
              <span>退出登录</span>
            </button>

            <button
              className="absolute right-2 top-2 rounded-md p-1 text-[#8f8f8f] hover:bg-white/80"
              onClick={() => setMenuOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
