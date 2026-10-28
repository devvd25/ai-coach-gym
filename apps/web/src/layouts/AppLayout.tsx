import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Icon, type IconName } from '../components/Icon.js';
import { Logo } from '../components/Logo.js';
import { useAuth } from '../features/auth/AuthProvider.js';
import './layout.css';

export const NAV: { to: string; label: string; icon: IconName; tab?: string }[] = [
  { to: '/', label: 'Tổng quan', icon: 'dashboard', tab: 'Tổng quan' },
  { to: '/lich-tap', label: 'Lịch tập', icon: 'calendar', tab: 'Lịch tập' },
  { to: '/thu-vien', label: 'Thư viện bài tập', icon: 'dumbbell' },
  { to: '/camera', label: 'Camera Squat', icon: 'camera', tab: 'Camera' },
  { to: '/nhat-ky', label: 'Nhật ký', icon: 'activity' },
  { to: '/dinh-duong', label: 'Dinh dưỡng', icon: 'utensils', tab: 'Dinh dưỡng' },
  { to: '/ai-coach', label: 'AI Coach', icon: 'sparkles' },
  { to: '/ho-so', label: 'Hồ sơ', icon: 'user', tab: 'Hồ sơ' },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Logo />
        </div>
        <p className="caption sidebar-label">Menu</p>
        <nav aria-label="Điều hướng chính" className="sidebar-nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-item">
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        {user && (
          <div className="sidebar-user">
            <span className="avatar" aria-hidden="true">
              {user.fullName.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? '?'}
            </span>
            <span className="sidebar-user-text">
              <span className="sidebar-user-name">{user.fullName}</span>
              <span className="muted sidebar-user-email">{user.email}</span>
            </span>
          </div>
        )}
        <button type="button" className="nav-item nav-button" onClick={logout}>
          <Icon name="logout" />
          <span>Đăng xuất</span>
        </button>
      </aside>

      <div className="app-main">
        <Outlet />
      </div>

      <nav aria-label="Điều hướng nhanh" className="tabbar">
        {NAV.filter((n) => n.tab).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className="tab-item">
            <Icon name={item.icon} />
            <span>{item.tab}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({
  caption,
  title,
  actions,
}: {
  caption?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {caption && <p className="caption">{caption}</p>}
        <h1>{title}</h1>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
