import type { ReactNode } from 'react';
import type { AdminRoute, NavItem } from '../lib/adminTypes';
import { getUserAvatarUrl, getUserDisplayName, getUserInitials } from '../lib/adminFormat';

export function AdminShell({
  navItems,
  route,
  onNavigate,
  currentUser,
  onLogout,
  banner,
  children,
}: {
  navItems: NavItem[];
  route: AdminRoute;
  onNavigate: (route: AdminRoute) => void;
  currentUser: Record<string, unknown> | null;
  onLogout: () => void;
  banner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-lockup brand-lockup--sidebar">
            <span className="brand-mark brand-mark--sidebar" aria-hidden="true">
              <svg className="brand-mark__svg" viewBox="0 0 72 72" fill="none">
                <defs>
                  <linearGradient id="adminShellBrandGradient" x1="12" y1="10" x2="60" y2="62" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#7DB0AF" />
                    <stop offset="0.54" stopColor="#B89573" />
                    <stop offset="1" stopColor="#314036" />
                  </linearGradient>
                </defs>
                <rect x="6" y="6" width="60" height="60" rx="18" fill="#221f1b" />
                <rect x="13" y="13" width="46" height="46" rx="14" fill="url(#adminShellBrandGradient)" opacity="0.2" />
                <path d="M20 46.5V24.5L36 16l16 8.5v22L36 55l-16-8.5Z" fill="url(#adminShellBrandGradient)" />
                <path d="M36 16v39" stroke="#F9F7F3" strokeOpacity="0.88" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M20 24.5 36 33l16-8.5" stroke="#F9F7F3" strokeOpacity="0.82" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20 46.5 36 38l16 8.5" stroke="#F9F7F3" strokeOpacity="0.64" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="brand-lockup__copy">
              <div className="brand-lockup__kicker">iClaw Console</div>
              <h1 className="sidebar-brand__title">iClaw管理控制台</h1>
              <p className="sidebar-brand__copy">企业运营平台</p>
            </div>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) =>
            item.children?.length ? (
              <div key={item.id} className={`nav-group${item.children.some((child) => child.id === route) ? ' is-active' : ''}`}>
                <button className="nav-item nav-item--group" type="button" onClick={() => onNavigate(item.children![0].id)}>
                  <div className="nav-group__summary">
                    <span className="nav-item__label">{item.label}</span>
                  </div>
                </button>
                <div className="nav-sublist">
                  {item.children.map((child) => (
                    <button
                      key={child.id}
                      className={`nav-subitem${route === child.id ? ' is-active' : ''}`}
                      type="button"
                      onClick={() => onNavigate(child.id)}
                    >
                      <span className="nav-item__label">{child.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                key={item.id}
                className={`nav-item${route === item.id ? ' is-active' : ''}`}
                type="button"
                onClick={() => onNavigate(item.id as AdminRoute)}
              >
                <span className="nav-item__label">{item.label}</span>
              </button>
            ),
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer__identity">
            {getUserAvatarUrl(currentUser) ? (
              <img className="sidebar-footer__avatar" src={getUserAvatarUrl(currentUser)} alt={getUserDisplayName(currentUser)} />
            ) : (
              <div className="sidebar-footer__avatar sidebar-footer__avatar--fallback">{getUserInitials(currentUser)}</div>
            )}
            <div className="sidebar-footer__meta">
              <div>{getUserDisplayName(currentUser)}</div>
              <div>React migration in progress</div>
            </div>
          </div>
          <button className="sidebar-footer__logout" type="button" onClick={onLogout}>
            退出登录
          </button>
        </div>
      </aside>
      <section className="content">
        {banner}
        {children}
      </section>
    </div>
  );
}
