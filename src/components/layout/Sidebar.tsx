import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ShoppingBag, ChefHat, Users, CreditCard,
  BarChart3, Package, ClipboardList, Bell, Settings, LogOut,
  ChevronLeft, ChevronRight, Activity, TrendingUp,
  Warehouse, UtensilsCrossed, AlertTriangle, Receipt,
  QrCode, DollarSign, Clock, CheckCircle, Menu,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore, ROLE_HOME } from '../../store/authStore';
import { RoleBadge } from '../ui/Badge';
import { CountBadge } from '../ui/Badge';
import { supabase } from '../../lib/supabase';
import type { UserRole } from '../../types';

// ─── Navigation Config ─────────────────────────────────────────────────────────
interface NavItem {
  label:    string;
  path:     string;
  icon:     React.ElementType;
  badge?:   number;
  soon?:    boolean;
}

interface NavSection {
  title?: string;
  items:  NavItem[];
}

const NAV_CONFIG: Record<UserRole, NavSection[]> = {
  owner: [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard',      path: '/owner/dashboard',   icon: LayoutDashboard },
        { label: 'Live Orders',    path: '/owner/orders',      icon: ShoppingBag },
        { label: 'Alerts',         path: '/owner/alerts',      icon: AlertTriangle },
        { label: 'Approvals',      path: '/owner/approvals',   icon: CheckCircle },
      ],
    },
    {
      title: 'Operations',
      items: [
        { label: 'Menu & Recipes', path: '/owner/menu',        icon: UtensilsCrossed },
        { label: 'Inventory',      path: '/owner/inventory',   icon: Package },
        { label: 'Staff',          path: '/owner/staff',       icon: Users },
        { label: 'Expenses',       path: '/owner/expenses',    icon: DollarSign },
      ],
    },
    {
      title: 'Analytics',
      items: [
        { label: 'Revenue',        path: '/owner/revenue',     icon: TrendingUp },
        { label: 'Reports',        path: '/owner/reports',     icon: BarChart3 },
        { label: 'Audit Log',      path: '/owner/audit',       icon: ClipboardList },
        { label: 'Health Score',   path: '/owner/health',      icon: Activity },
      ],
    },
    {
      items: [
        { label: 'Settings',       path: '/owner/settings',    icon: Settings },
      ],
    },
  ],
  store_manager: [
    {
      title: 'Inventory',
      items: [
        { label: 'Dashboard',    path: '/store/dashboard',     icon: LayoutDashboard },
        { label: 'Stock Overview', path: '/store/stock',       icon: Warehouse },
        { label: 'Issue Materials', path: '/store/issue',      icon: Package },
        { label: 'Purchases',    path: '/store/purchases',     icon: ShoppingBag },
        { label: 'Returns',      path: '/store/returns',       icon: ClipboardList },
      ],
    },
  ],
  kitchen: [
    {
      title: 'Kitchen',
      items: [
        { label: 'Order Display',  path: '/kitchen/display',   icon: ChefHat },
        { label: 'Log Wastage',    path: '/kitchen/waste',     icon: AlertTriangle },
        { label: 'Request Stock',  path: '/kitchen/request',   icon: Package },
      ],
    },
  ],
  supervisor: [
    {
      title: 'Kitchen Ops',
      items: [
        { label: 'Kitchen Dashboard', path: '/supervisor/dashboard',   icon: LayoutDashboard },
        { label: 'Live KDS',          path: '/supervisor/orders',      icon: ChefHat },
        { label: 'Material Requests', path: '/supervisor/approvals',   icon: Package },
        { label: 'Wastage Log',       path: '/supervisor/complaints',  icon: AlertTriangle },
      ],
    },
  ],
  cashier: [
    {
      title: 'Billing',
      items: [
        { label: 'Billing Hub',    path: '/cashier/billing',   icon: Receipt },
        { label: 'New Order',      path: '/cashier/new-order', icon: ShoppingBag },
        { label: 'Active Orders',  path: '/cashier/orders',    icon: Clock },
        { label: 'Payments Log',   path: '/cashier/payments',  icon: CreditCard },
        { label: 'QR Tables',      path: '/cashier/qr',        icon: QrCode },
      ],
    },
  ],
  captain: [
    {
      title: 'Floor Management',
      items: [
        { label: 'My Tables',      path: '/captain/tables',      icon: LayoutDashboard },
        { label: 'Active Orders',  path: '/captain/orders',      icon: Clock },
      ],
    },
  ],
  guest: [
    {
      items: [
        { label: 'Menu',           path: '/menu',              icon: UtensilsCrossed },
        { label: 'My Order',       path: '/my-order',          icon: ShoppingBag },
      ],
    },
  ],
};

// ─── Sidebar Component ─────────────────────────────────────────────────────────
interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onMobileClose }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [liveBadges, setLiveBadges] = useState<Record<string, number>>({});

  // Fetch live badge counts for alerts + approvals
  useEffect(() => {
    if (user?.role !== 'owner' && user?.role !== 'supervisor') return;
    const fetchBadges = async () => {
      const [alertsRes, approvalsRes] = await Promise.all([
        supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('is_seen', false),
        supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      setLiveBadges({
        '/owner/alerts':    alertsRes.count ?? 0,
        '/owner/approvals': approvalsRes.count ?? 0,
      });
    };
    fetchBadges();
    const interval = setInterval(fetchBadges, 60_000);
    return () => clearInterval(interval);
  }, [user?.role]);

  const role = user?.role ?? 'cashier';
  const sections = NAV_CONFIG[role] ?? [];

  const sidebarWidth = collapsed ? 64 : 256;

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          'fixed top-0 left-0 h-full z-50 flex flex-col',
          'bg-surface-950 dark:bg-[#0c1526] border-r border-surface-800',
          'shadow-2xl overflow-hidden',
          // Mobile: slide in from left
          'lg:relative lg:translate-x-0 transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{ minWidth: sidebarWidth }}
      >
        {/* ── Logo ── */}
        <div className={cn(
          'flex items-center gap-3 border-b border-surface-800 transition-all duration-300',
          collapsed ? 'px-3 py-4 justify-center' : 'px-5 py-4',
        )}>
          <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-brand">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex-1 min-w-0"
              >
                <p className="text-white font-bold text-sm truncate leading-tight">Varun Hotel</p>
                <p className="text-surface-500 text-xs truncate">Management System</p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Collapse toggle — desktop only */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className={cn(
              'hidden lg:flex flex-shrink-0 p-1 rounded-lg text-surface-500',
              'hover:text-surface-300 hover:bg-surface-800 transition-colors',
            )}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2 scrollbar-thin">
          {sections.map((section, si) => (
            <div key={si} className={cn(si > 0 && 'mt-4')}>
              {section.title && !collapsed && (
                <p className="text-[10px] font-semibold text-surface-600 uppercase tracking-wider px-3 mb-1.5">
                  {section.title}
                </p>
              )}
              {section.title && collapsed && (
                <div className="h-px bg-surface-800 my-2 mx-1" />
              )}
              {section.items.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onMobileClose}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium',
                      'transition-all duration-150 group relative',
                      collapsed && 'justify-center px-0 py-2.5',
                      isActive
                        ? 'bg-brand-600/15 text-brand-400 border border-brand-500/20'
                        : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60',
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Active indicator */}
                    {isActive && !collapsed && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-500 rounded-full"
                      />
                    )}
                    <Icon size={16} className="flex-shrink-0" />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex-1 truncate"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {(liveBadges[item.path] ?? 0) > 0 && !collapsed && (
                      <CountBadge count={liveBadges[item.path]} />
                    )}
                    {item.soon && !collapsed && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-md font-semibold">
                        SOON
                      </span>
                    )}
                    {/* Tooltip for collapsed */}
                    {collapsed && (
                      <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-surface-900 border border-surface-700 rounded-lg text-xs text-white font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                        {item.label}
                        {(liveBadges[item.path] ?? 0) > 0 ? ` (${liveBadges[item.path]})` : ''}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── User Profile ── */}
        <div className={cn(
          'border-t border-surface-800 p-3',
          collapsed && 'flex flex-col items-center gap-2',
        )}>
          {!collapsed && user && (
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-surface-800 transition-colors cursor-pointer mb-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {user.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-200 truncate">{user.name}</p>
                <RoleBadge role={user.role} size="sm" />
              </div>
            </div>
          )}
          {collapsed && user && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {user.name?.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <button
            onClick={() => logout()}
            className={cn(
              'flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm',
              'text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150',
              collapsed && 'justify-center px-0',
            )}
            title="Sign out"
          >
            <LogOut size={15} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
