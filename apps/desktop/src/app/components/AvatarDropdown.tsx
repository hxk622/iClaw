import { useEffect, useRef } from 'react';
import { CircleHelp, FolderPlus, Globe, LogOut, RefreshCw, Settings } from 'lucide-react';

interface AvatarDropdownProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function AvatarDropdown({ open, onClose, onOpenSettings, onLogout }: AvatarDropdownProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) onClose();
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose]);

  return (
    <div
      ref={ref}
      className={`absolute bottom-[60px] left-2 right-2 z-40 rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-3 shadow-[var(--shadow-popover)] transition-all duration-[var(--motion-panel)] ${
        open
          ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
          : 'pointer-events-none translate-y-1 scale-[0.98] opacity-0'
      }`}
      style={{ transitionTimingFunction: 'var(--motion-spring)' }}
    >
      <button
        className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-[var(--bg-hover)]"
        onClick={() => {
          onClose();
          onOpenSettings();
        }}
      >
        <Settings className="h-5 w-5 text-[var(--text-secondary)]" />
        <span className="text-[16px] text-[var(--text-primary)]">设置</span>
      </button>

      <button className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-[var(--bg-hover)]">
        <FolderPlus className="h-5 w-5 text-[var(--text-secondary)]" />
        <span className="text-[16px] text-[var(--text-primary)]">收藏夹</span>
      </button>

      <div className="my-2 h-px bg-[var(--border-default)]" />

      <button className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-[var(--bg-hover)]">
        <Globe className="h-5 w-5 text-[var(--text-secondary)]" />
        <span className="text-[16px] text-[var(--text-primary)]">豆包官网</span>
      </button>

      <div className="mb-1 flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-[var(--bg-hover)]">
        <RefreshCw className="h-5 w-5 text-[var(--text-secondary)]" />
        <span className="flex-1 text-[16px] text-[var(--text-primary)]">新版本已安装</span>
        <button className="rounded-lg bg-[var(--bg-hover)] px-3 py-1.5 text-[13px] text-[var(--text-primary)]">重启应用</button>
      </div>

      <button className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-[var(--bg-hover)]">
        <CircleHelp className="h-5 w-5 text-[var(--text-secondary)]" />
        <span className="text-[16px] text-[var(--text-primary)]">帮助与反馈</span>
      </button>

      <div className="my-2 h-px bg-[var(--border-default)]" />

      <button
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-[var(--bg-hover)]"
        onClick={() => {
          onClose();
          onLogout();
        }}
      >
        <LogOut className="h-5 w-5 text-[var(--text-secondary)]" />
        <span className="text-[16px] text-[var(--text-primary)]">退出登录</span>
      </button>
    </div>
  );
}
