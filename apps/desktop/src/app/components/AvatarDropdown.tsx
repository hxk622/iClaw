import { useEffect, useRef } from 'react';
import { CircleHelp, FolderPlus, Globe, Heart, LogIn, LogOut, RefreshCw, Settings, UserCircle2 } from 'lucide-react';

interface AvatarDropdownProps {
  open: boolean;
  authenticated: boolean;
  onClose: () => void;
  onOpenAccount: () => void;
  onOpenLogin: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

const OFFICIAL_SITE_URL = 'https://iclaw.aiyuanxi.com';
const menuItemClass =
  'group mb-1 flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left transition-[transform,background-color,box-shadow] duration-[var(--motion-panel)] hover:translate-x-[4px] hover:scale-[1.015] hover:bg-[var(--bg-hover)] hover:shadow-[var(--shadow-sm)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 active:scale-[0.985]';
const menuItemStyle = {
  transitionTimingFunction: 'var(--motion-spring)',
  transformOrigin: 'left center',
} as const;
const menuIconClass =
  'h-5 w-5 text-[var(--text-secondary)] transition-transform duration-[var(--motion-panel)] group-hover:scale-110';
const menuIconStyle = {
  transitionTimingFunction: 'var(--motion-spring)',
} as const;
const menuLabelClass =
  'text-[14px] text-[var(--text-primary)] transition-transform duration-[var(--motion-panel)] group-hover:translate-x-[1px]';

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
          className={menuItemClass}
          style={menuItemStyle}
          onClick={() => {
            onClose();
            onOpenAccount();
          }}
        >
          <UserCircle2 className={menuIconClass} style={menuIconStyle} />
          <span className={menuLabelClass}>个人中心</span>
        </button>
      ) : (
        <button
          className={menuItemClass}
          style={menuItemStyle}
          onClick={() => {
            onClose();
            onOpenLogin();
          }}
        >
          <LogIn className={menuIconClass} style={menuIconStyle} />
          <span className={menuLabelClass}>登录 / 注册</span>
        </button>
      )}

      <button
        className={menuItemClass}
        style={menuItemStyle}
        onClick={() => {
          onClose();
          onOpenSettings();
        }}
      >
        <Settings className={menuIconClass} style={menuIconStyle} />
        <span className={menuLabelClass}>设置</span>
      </button>

      <button className={menuItemClass} style={menuItemStyle}>
        <Heart className="h-5 w-5 text-rose-500 transition-transform duration-[var(--motion-panel)] group-hover:scale-110" style={menuIconStyle} />
        <span className={menuLabelClass}>订阅服务</span>
      </button>

      <button className={menuItemClass} style={menuItemStyle}>
        <FolderPlus className={menuIconClass} style={menuIconStyle} />
        <span className={menuLabelClass}>收藏夹</span>
      </button>

      <div className="my-2 h-px bg-[var(--border-default)]" />

      <button
        className={menuItemClass}
        style={menuItemStyle}
        onClick={() => {
          onClose();
          window.open(OFFICIAL_SITE_URL, '_blank', 'noopener,noreferrer');
        }}
      >
        <Globe className={menuIconClass} style={menuIconStyle} />
        <span className={menuLabelClass}>官网</span>
      </button>

      <button className={menuItemClass} style={menuItemStyle}>
        <RefreshCw className={menuIconClass} style={menuIconStyle} />
        <span className={`flex-1 ${menuLabelClass}`}>新版本已安装</span>
        <span className="rounded-md bg-[var(--brand-primary)] px-3 py-1 text-[13px] text-[var(--brand-on-primary)]">
          重启应用
        </span>
      </button>

      <button className={menuItemClass} style={menuItemStyle}>
        <CircleHelp className={menuIconClass} style={menuIconStyle} />
        <span className={menuLabelClass}>帮助与反馈</span>
      </button>

      {authenticated ? (
        <>
          <div className="my-2 h-px bg-[var(--border-default)]" />

          <button
            className={menuItemClass.replace('mb-1 ', '')}
            style={menuItemStyle}
            onClick={() => {
              onClose();
              onLogout();
            }}
          >
            <LogOut
              className="h-5 w-5 text-[var(--state-error)] transition-transform duration-[var(--motion-panel)] group-hover:scale-110"
              style={menuIconStyle}
            />
            <span className="text-[14px] text-[var(--state-error)] transition-transform duration-[var(--motion-panel)] group-hover:translate-x-[1px]">
              退出登录
            </span>
          </button>
        </>
      ) : null}
    </div>
  );
}
