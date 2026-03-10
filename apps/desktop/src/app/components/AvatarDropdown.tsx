import { useEffect, useRef } from 'react';
import { CircleHelp, FolderPlus, Globe, LogIn, LogOut, RefreshCw, Settings, UserCircle2 } from 'lucide-react';

interface AvatarDropdownProps {
  open: boolean;
  authenticated: boolean;
  onClose: () => void;
  onOpenAccount: () => void;
  onOpenLogin: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function AvatarDropdown({
  open,
  authenticated,
  onClose,
  onOpenAccount,
  onOpenLogin,
  onOpenSettings,
  onLogout,
}: AvatarDropdownProps) {
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
      {authenticated ? (
        <button
          className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40"
          onClick={() => {
            onClose();
            onOpenAccount();
          }}
        >
          <UserCircle2 className="h-5 w-5 text-[var(--text-secondary)]" />
          <span className="text-[16px] text-[var(--text-primary)]">个人中心</span>
        </button>
      ) : (
        <button
          className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40"
          onClick={() => {
            onClose();
            onOpenLogin();
          }}
        >
          <LogIn className="h-5 w-5 text-[var(--text-secondary)]" />
          <span className="text-[16px] text-[var(--text-primary)]">登录 / 注册</span>
        </button>
      )}

      <button
        className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40"
        onClick={() => {
          onClose();
          onOpenSettings();
        }}
      >
        <Settings className="h-5 w-5 text-[var(--text-secondary)]" />
        <span className="text-[16px] text-[var(--text-primary)]">设置</span>
      </button>

      <button className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40">
        <FolderPlus className="h-5 w-5 text-[var(--text-secondary)]" />
        <span className="text-[16px] text-[var(--text-primary)]">收藏夹</span>
      </button>

      <div className="my-2 h-px bg-[var(--border-default)]" />

      <button className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40">
        <Globe className="h-5 w-5 text-[var(--text-secondary)]" />
        <span className="text-[16px] text-[var(--text-primary)]">豆包官网</span>
      </button>

      <button className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40">
        <RefreshCw className="h-5 w-5 text-[var(--text-secondary)]" />
        <span className="flex-1 text-[16px] text-[var(--text-primary)]">新版本已安装</span>
        <span className="rounded-md bg-[var(--brand-primary)] px-3 py-1 text-[13px] text-[var(--brand-on-primary)]">
          重启应用
        </span>
      </button>

      <button className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40">
        <CircleHelp className="h-5 w-5 text-[var(--text-secondary)]" />
        <span className="text-[16px] text-[var(--text-primary)]">帮助与反馈</span>
      </button>

      {authenticated ? (
        <>
          <div className="my-2 h-px bg-[var(--border-default)]" />

          <button
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40"
            onClick={() => {
              onClose();
              onLogout();
            }}
          >
            <LogOut className="h-5 w-5 text-[var(--state-error)]" />
            <span className="text-[16px] text-[var(--state-error)]">退出登录</span>
          </button>
        </>
      ) : null}
    </div>
  );
}
