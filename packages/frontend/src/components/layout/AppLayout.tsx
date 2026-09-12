import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Leaf, LayoutDashboard, MapPin, BarChart2, Truck, Settings,
  LogOut, Bell, ChevronLeft, ChevronRight, Menu, X, MessageSquare,
  FileText, Shield, Package, TrendingUp
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import NotificationCenter from '../notifications/NotificationCenter';
import type { UserRole } from '../../stores/authStore';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Map', href: '/map', icon: MapPin },
  { label: 'Economics', href: '/economics', icon: TrendingUp },
  { label: 'Reports', href: '/reports', icon: BarChart2 },
  { label: 'Admin Panel', href: '/dashboard', icon: Shield, roles: ['platform_admin', 'municipal_admin'] },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const visibleNav = NAV_ITEMS.filter((item) =>
    !item.roles || item.roles.includes(user?.role as UserRole)
  );

  const roleLabel: Record<UserRole, string> = {
    generator: 'Waste Generator',
    facility_operator: 'Facility Operator',
    logistics_partner: 'Logistics Partner',
    municipal_admin: 'Municipal Admin',
    platform_admin: 'Platform Admin',
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={`${mobile ? 'w-72' : collapsed ? 'w-16' : 'w-60'}
        flex flex-col bg-white border-r border-charcoal-200 h-full transition-all duration-200`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 h-16 border-b border-charcoal-200 ${collapsed && !mobile ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-forest-800 flex items-center justify-center flex-shrink-0">
          <Leaf className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        {(!collapsed || mobile) && (
          <span className="font-bold text-lg text-charcoal-900 tracking-tight">CarbonLoop</span>
        )}
        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-charcoal-400 hover:text-charcoal-700 p-1 rounded"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleNav.map((item) => {
          const active = location.pathname === item.href;
          return (
            <Link
              key={item.href + item.label}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-forest-50 text-forest-800 font-semibold'
                  : 'text-charcoal-600 hover:bg-charcoal-50 hover:text-charcoal-900'
              } ${collapsed && !mobile ? 'justify-center' : ''}`}
              title={collapsed && !mobile ? item.label : undefined}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-forest-700' : ''}`} />
              {(!collapsed || mobile) && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User profile */}
      <div className={`p-3 border-t border-charcoal-200 ${collapsed && !mobile ? 'flex justify-center' : ''}`}>
        {(!collapsed || mobile) && (
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-semibold text-charcoal-900 truncate">{user?.org_name || user?.email}</p>
            <p className="text-xs text-charcoal-400">{roleLabel[user?.role as UserRole] || user?.role}</p>
            {user?.profile_verified && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-forest-700 bg-forest-50 px-2 py-0.5 rounded-full">
                <Shield className="w-2.5 h-2.5" /> Verified
              </span>
            )}
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-charcoal-600 hover:bg-red-50 hover:text-red-700 transition-colors ${collapsed && !mobile ? 'justify-center' : ''}`}
          title="Sign out"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {(!collapsed || mobile) && 'Sign out'}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-charcoal-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-charcoal-200 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
          <button
            className="md:hidden p-2 rounded-lg text-charcoal-500 hover:bg-charcoal-100"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative">
              <button
                id="notif-bell"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl text-charcoal-500 hover:bg-charcoal-100 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-forest-600" />
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-12 z-50">
                  <NotificationCenter onClose={() => setShowNotifications(false)} />
                </div>
              )}
            </div>

            {/* User avatar */}
            <div className="w-8 h-8 rounded-full bg-forest-100 border border-forest-200 flex items-center justify-center">
              <span className="text-xs font-bold text-forest-800">
                {(user?.org_name || user?.email || 'U')[0].toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
