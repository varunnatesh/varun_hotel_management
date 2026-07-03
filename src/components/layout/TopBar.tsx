import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Sun, Moon, Search, Menu, X, Check, AlertTriangle,
  Package, ShoppingBag, ChevronRight, LogOut, Settings, User,
  LayoutDashboard, UtensilsCrossed, DollarSign, Users, BarChart3,
  ClipboardList, Activity, TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, formatElapsed } from '../../lib/utils';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { RoleBadge } from '../ui/Badge';
import { supabase } from '../../lib/supabase';

// ─── Search Index ─────────────────────────────────────────────────────────────
const SEARCH_ITEMS = [
  { label: 'Dashboard',          path: '/owner/dashboard',  icon: LayoutDashboard, keywords: 'home overview stats kpi' },
  { label: 'Live Orders',        path: '/owner/orders',     icon: ShoppingBag,    keywords: 'orders live kitchen pending preparing' },
  { label: 'Alerts',             path: '/owner/alerts',     icon: AlertTriangle,  keywords: 'alerts warnings fraud detection' },
  { label: 'Approvals',          path: '/owner/approvals',  icon: Check,          keywords: 'approvals pending discount requests' },
  { label: 'Menu & Recipes',     path: '/owner/menu',       icon: UtensilsCrossed, keywords: 'menu food dishes recipes prices' },
  { label: 'Inventory / Stock',  path: '/owner/inventory',  icon: Package,        keywords: 'inventory stock materials low' },
  { label: 'Staff Management',   path: '/owner/staff',      icon: Users,          keywords: 'staff employees roles team' },
  { label: 'Expenses',           path: '/owner/expenses',   icon: DollarSign,     keywords: 'expenses costs bills salary rent' },
  { label: 'Revenue Reports',    path: '/owner/revenue',    icon: TrendingUp,     keywords: 'revenue reports profit money' },
  { label: 'Analytics Reports',  path: '/owner/reports',    icon: BarChart3,      keywords: 'analytics charts graphs data' },
  { label: 'Audit Log',          path: '/owner/audit',      icon: ClipboardList,  keywords: 'audit log history actions trail' },
  { label: 'Health Score',       path: '/owner/health',     icon: Activity,       keywords: 'health score business performance' },
  { label: 'Settings',           path: '/owner/settings',   icon: Settings,       keywords: 'settings configuration preferences' },
];

const NOTIF_COLORS: Record<string, string> = {
  critical: 'bg-red-500/12 text-red-500',
  warning:  'bg-amber-500/12 text-amber-500',
  info:     'bg-blue-500/12 text-blue-500',
};

// ─── TopBar ────────────────────────────────────────────────────────────────────
interface TopBarProps {
  onMenuClick: () => void;
  title?:      string;
  subtitle?:   string;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick, title, subtitle }) => {
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [notifOpen,    setNotifOpen]    = useState(false);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount,  setUnreadCount]  = useState(0);

  const notifRef   = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

  // ── Load real alerts as notifications ──
  useEffect(() => {
    if (!user) return;
    const loadAlerts = async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((a: any) => !a.is_seen).length);
      }
    };
    loadAlerts();

    // Realtime subscription for new alerts
    const channel = supabase.channel('topbar-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, () => loadAlerts())
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [user]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n: any) => !n.is_seen).map((n: any) => n.id);
    if (unreadIds.length) {
      await supabase.from('alerts').update({ is_seen: true }).in('id', unreadIds);
      setNotifications(n => n.map((x: any) => ({ ...x, is_seen: true })));
      setUnreadCount(0);
    }
  };

  // ── Search filtering ──
  const q = searchQuery.trim().toLowerCase();
  const searchResults = q.length < 1 ? [] : SEARCH_ITEMS.filter(item =>
    item.label.toLowerCase().includes(q) ||
    item.keywords.includes(q)
  );

  const handleSearchNav = (path: string) => {
    navigate(path);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const severityIcon = (severity: string) => {
    if (severity === 'critical') return AlertTriangle;
    if (severity === 'warning')  return AlertTriangle;
    return Bell;
  };

  return (
    <header className={cn(
      'sticky top-0 z-30 flex items-center gap-3 px-4 lg:px-6 h-14',
      'bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl',
      'border-b border-surface-200 dark:border-surface-800',
    )}>
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
      >
        <Menu size={18} />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        {title && (
          <div>
            <h1 className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">{title}</h1>
            {subtitle && <p className="text-xs text-surface-500 hidden sm:block">{subtitle}</p>}
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        {/* Search button */}
        <button
          onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-surface-400 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
        >
          <Search size={13} />
          <span className="hidden md:block">Search…</span>
          <kbd className="hidden md:block px-1.5 py-0.5 text-[10px] bg-surface-200 dark:bg-surface-700 rounded font-mono text-surface-500">⌘K</kbd>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isDark ? 'sun' : 'moon'}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </motion.div>
          </AnimatePresence>
        </button>

        {/* Notifications — real data from alerts table */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifOpen(o => !o); setProfileOpen(false); }}
            className="relative p-2 rounded-lg text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className={cn(
                  'absolute right-0 top-full mt-2 w-80 z-50',
                  'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700',
                  'rounded-2xl shadow-card-hover overflow-hidden',
                )}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">Alerts</p>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">{unreadCount}</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <Check size={24} className="text-emerald-400" />
                      <p className="text-sm text-surface-400">All clear — no alerts!</p>
                    </div>
                  ) : notifications.map((notif: any) => {
                    const Icon = severityIcon(notif.severity);
                    return (
                      <div
                        key={notif.id}
                        onClick={() => { navigate('/owner/alerts'); setNotifOpen(false); }}
                        className={cn(
                          'flex gap-3 px-4 py-3 border-b border-surface-100 dark:border-surface-700/50',
                          'hover:bg-surface-50 dark:hover:bg-surface-700/40 cursor-pointer transition-colors',
                          !notif.is_seen && 'bg-brand-50/50 dark:bg-brand-900/10',
                        )}
                      >
                        <div className={cn(
                          'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5',
                          NOTIF_COLORS[notif.severity] ?? NOTIF_COLORS.info,
                        )}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn('text-xs font-semibold truncate',
                              !notif.is_seen ? 'text-surface-900 dark:text-surface-100' : 'text-surface-600 dark:text-surface-400')}>
                              {notif.title ?? notif.type?.replace('_', ' ')}
                            </p>
                            {!notif.is_seen && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-500 mt-1" />}
                          </div>
                          <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{notif.message}</p>
                          <p className="text-[10px] text-surface-400 mt-1">{formatElapsed(notif.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-2.5">
                  <button
                    onClick={() => { navigate('/owner/alerts'); setNotifOpen(false); }}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline w-full text-center"
                  >
                    View all alerts →
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => { setProfileOpen(o => !o); setNotifOpen(false); }}
            className="flex items-center gap-2 p-1 pr-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="hidden sm:block text-xs font-medium text-surface-700 dark:text-surface-300 max-w-[80px] truncate">
              {user?.name?.split(' ')[0]}
            </span>
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  'absolute right-0 top-full mt-2 w-60 z-50',
                  'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700',
                  'rounded-2xl shadow-card-hover overflow-hidden',
                )}
              >
                <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700">
                  <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">{user?.name}</p>
                  <p className="text-xs text-surface-500 mt-0.5">{user?.email}</p>
                  <div className="mt-2">
                    <RoleBadge role={user?.role ?? 'cashier'} size="sm" />
                  </div>
                </div>
                <div className="p-1.5">
                  <button
                    onClick={() => { navigate('/owner/settings'); setProfileOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                  >
                    <Settings size={14} /> Settings
                  </button>
                  <hr className="my-1 border-surface-200 dark:border-surface-700" />
                  <button
                    onClick={() => logout()}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/8 transition-colors"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Search Modal ── */}
      <AnimatePresence>
        {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -5 }}
              transition={{ duration: 0.18 }}
              className={cn(
                'relative w-full max-w-lg',
                'bg-white dark:bg-surface-800 rounded-2xl',
                'border border-surface-200 dark:border-surface-700 shadow-card-hover',
                'overflow-hidden z-10',
              )}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 border-b border-surface-200 dark:border-surface-700">
                <Search size={16} className="text-surface-400 flex-shrink-0" />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search pages, features, sections…"
                  className="flex-1 py-4 text-sm bg-transparent text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="p-1 text-surface-400 hover:text-surface-600">
                    <X size={14} />
                  </button>
                )}
                <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="p-1 text-surface-400 hover:text-surface-600">
                  <X size={16} />
                </button>
              </div>

              <div className="p-3 max-h-80 overflow-y-auto">
                {searchQuery.length < 1 ? (
                  <>
                    <p className="text-[10px] text-surface-400 font-semibold uppercase tracking-wide px-2 mb-2">Quick Navigation</p>
                    {[
                      { label: 'Dashboard',       path: '/owner/dashboard',  Icon: LayoutDashboard },
                      { label: 'Live Orders',      path: '/owner/orders',     Icon: ShoppingBag },
                      { label: 'Revenue Reports',  path: '/owner/revenue',    Icon: TrendingUp },
                      { label: 'Pending Approvals',path: '/owner/approvals',  Icon: Check },
                      { label: 'Stock Overview',   path: '/owner/inventory',  Icon: Package },
                      { label: 'Expenses',         path: '/owner/expenses',   Icon: DollarSign },
                    ].map(item => (
                      <button key={item.path}
                        onClick={() => handleSearchNav(item.path)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-surface-900 dark:hover:text-surface-100 transition-colors text-left group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-surface-100 dark:bg-surface-700 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-500/12 transition-colors">
                          <item.Icon size={14} className="group-hover:text-brand-500 transition-colors" />
                        </div>
                        {item.label}
                        <ChevronRight size={12} className="ml-auto text-surface-300" />
                      </button>
                    ))}
                  </>
                ) : searchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-surface-400">
                    <Search size={24} />
                    <p className="text-sm">No results for "<span className="font-semibold text-surface-600 dark:text-surface-300">{searchQuery}</span>"</p>
                    <p className="text-xs">Try: orders, expenses, staff, menu…</p>
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] text-surface-400 font-semibold uppercase tracking-wide px-2 mb-2">
                      {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                    </p>
                    {searchResults.map(item => (
                      <button key={item.path}
                        onClick={() => handleSearchNav(item.path)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-surface-900 dark:hover:text-surface-100 transition-colors text-left group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                          <item.icon size={14} className="text-brand-500" />
                        </div>
                        <span>
                          {item.label.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                            part.toLowerCase() === q
                              ? <mark key={i} className="bg-amber-300/30 text-amber-700 dark:text-amber-300 rounded px-0.5">{part}</mark>
                              : part
                          )}
                        </span>
                        <ChevronRight size={12} className="ml-auto text-surface-300" />
                      </button>
                    ))}
                  </>
                )}
              </div>

              <div className="px-4 py-2 border-t border-surface-100 dark:border-surface-700 flex items-center gap-3 text-[10px] text-surface-400">
                <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-[10px]">↵</kbd> select</span>
                <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-[10px]">esc</kbd> close</span>
                <span className="ml-auto flex items-center gap-1"><kbd className="px-1 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-[10px]">⌘K</kbd> open</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default TopBar;
