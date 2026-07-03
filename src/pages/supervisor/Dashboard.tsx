import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChefHat, CheckCircle, ArrowRight, Bell, Clock, RefreshCw,
  Flame, Package, Zap, Send, TrendingUp, ChevronDown, ChevronRight,
  XCircle, AlertTriangle, MessageSquare, ClipboardList,
  ToggleLeft, ToggleRight, Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────
interface KitchenOrder {
  id: string;
  table_no: string;
  status: 'pending' | 'preparing' | 'ready';
  total_amount: number;
  created_at: string;
  order_items: { quantity: number; menu_items: { name: string } | null }[];
}

interface MenuItem {
  id: string; name: string; category: string; price: number;
  is_available_today: boolean;
}

interface DiscountRequest {
  id: string; order_id: string; amount: number; reason: string;
  status: string; created_at: string;
  users?: { name: string };
  orders?: { table_no: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function elapsed(ts: string) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ─── KDS Order Card (2 operations only) ──────────────────────────────────────
const OrderCard: React.FC<{
  order: KitchenOrder;
  onAccept?: (id: string) => void;
  onReady?:  (id: string) => void;
  busy: boolean;
}> = ({ order, onAccept, onReady, busy }) => {
  const mins     = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isUrgent = mins > 12;
  const totalQty = order.order_items.reduce((s, i) => s + i.quantity, 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0,  scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3 transition-shadow hover:shadow-xl',
        order.status === 'pending'   && 'bg-amber-500/6   border-amber-400/30',
        order.status === 'preparing' && 'bg-blue-500/6    border-blue-400/30',
        order.status === 'ready'     && 'bg-emerald-500/8 border-emerald-400/40',
        isUrgent && order.status !== 'ready' && '!border-rose-500/50 shadow-rose-500/10',
      )}>
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-white">T{order.table_no}</span>
            {isUrgent && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[9px] font-black animate-pulse">
                <Zap size={8} /> URGENT
              </span>
            )}
          </div>
          <p className="text-[10px] text-surface-500 mt-0.5">
            #{order.id.slice(-5).toUpperCase()} · {totalQty} item{totalQty !== 1 ? 's' : ''}
          </p>
        </div>
        <div className={cn('flex items-center gap-1 text-xs', isUrgent ? 'text-rose-400 font-bold' : 'text-surface-500')}>
          <Clock size={11} />
          {elapsed(order.created_at)}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        {order.order_items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-surface-700 flex items-center justify-center text-[10px] font-black text-white shrink-0">
              {it.quantity}
            </span>
            <span className="text-sm text-surface-200 font-medium truncate">{it.menu_items?.name ?? '?'}</span>
          </div>
        ))}
      </div>

      {/* Single action button */}
      {onAccept && (
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => onAccept(order.id)} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-black text-sm shadow-lg shadow-amber-500/20 transition-all">
          {busy
            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <><CheckCircle size={14} /> Accept & Start Cooking</>
          }
        </motion.button>
      )}
      {onReady && (
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => onReady(order.id)} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-black text-sm shadow-lg shadow-emerald-500/20 transition-all">
          {busy
            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <><CheckCircle size={14} /> Mark as Ready</>
          }
        </motion.button>
      )}
      {/* Ready state — picked up, no further action */}
      {!onAccept && !onReady && (
        <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/25 text-emerald-400 text-sm font-bold">
          <CheckCircle size={14} /> ✓ Order Complete — Picked up
        </div>
      )}
    </motion.div>
  );
};

// ─── Kanban Column ────────────────────────────────────────────────────────────
const KCol: React.FC<{
  title: string; icon: React.ReactNode; colorCls: string;
  count: number; emptyMsg: string; children: React.ReactNode;
}> = ({ title, icon, colorCls, count, emptyMsg, children }) => (
  <div className="flex flex-col min-h-0 flex-1">
    <div className={cn('flex items-center gap-2.5 px-4 py-3 rounded-2xl mb-3 border', colorCls)}>
      {icon}
      <span className="font-black text-sm tracking-wide">{title}</span>
      {count > 0 && (
        <span className="ml-auto w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-xs font-black">
          {count}
        </span>
      )}
    </div>
    <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
      {count === 0
        ? <div className="h-28 flex items-center justify-center text-xs text-surface-600 font-semibold">{emptyMsg}</div>
        : children
      }
    </div>
  </div>
);

// ─── Section card wrapper ─────────────────────────────────────────────────────
const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; badge?: number }> = ({ title, icon, children, badge }) => (
  <div className="rounded-2xl border border-surface-700 bg-surface-900 overflow-hidden">
    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-surface-700/60 bg-surface-800/50">
      <span className="text-brand-400">{icon}</span>
      <span className="font-bold text-sm text-surface-100">{title}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto px-2 py-0.5 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-400 text-[10px] font-black">
          {badge}
        </span>
      )}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Main Supervisor Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
const SupervisorDashboard: React.FC = () => {
  const { user }  = useAuthStore();
  const chanRef   = useRef<RealtimeChannel | null>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // KDS state
  const [orders,   setOrders]   = useState<KitchenOrder[]>([]);
  const [busy,     setBusy]     = useState<Record<string, boolean>>({});
  const [kdsLoad,  setKdsLoad]  = useState(true);

  // Menu management state
  const [menuItems,  setMenuItems]  = useState<MenuItem[]>([]);
  const [menuLoad,   setMenuLoad]   = useState(true);
  const [toggling,   setToggling]   = useState<string | null>(null);
  const [menuSearch, setMenuSearch] = useState('');
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  // Discount approvals
  const [discounts, setDiscounts] = useState<DiscountRequest[]>([]);

  // Complaint / report
  const [complaint, setComplaint] = useState('');
  const [compTable, setCompTable] = useState('');
  const [report,    setReport]    = useState('');
  const [sending,   setSending]   = useState<'report' | 'complaint' | null>(null);

  // Active tab for bottom sections
  const [sectionTab, setSectionTab] = useState<'menu' | 'discounts' | 'report' | 'complaint'>('menu');

  // ── Fetch kitchen orders ──────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('id,table_no,status,total_amount,created_at,order_items(quantity,menu_items(name))')
      .in('status', ['pending', 'preparing', 'ready'])
      .not('table_no', 'is', null)
      .order('created_at', { ascending: true });
    setOrders((data ?? []) as any);
    setKdsLoad(false);
  }, []);

  // ── Fetch menu items ──────────────────────────────────────────────────────
  const fetchMenu = useCallback(async () => {
    setMenuLoad(true);
    const { data } = await supabase
      .from('menu_items')
      .select('id,name,category,price,is_available_today')
      .order('category').order('name');
    setMenuItems((data ?? []) as MenuItem[]);
    setMenuLoad(false);
  }, []);

  // ── Fetch discounts ───────────────────────────────────────────────────────
  const fetchDiscounts = useCallback(async () => {
    const { data } = await supabase
      .from('discounts')
      .select('id,order_id,amount,reason,status,created_at,orders(table_no)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setDiscounts((data ?? []) as any);
  }, []);

  // ── Fetch All (calls all three fetchers together) ─────────────────────────
  const fetchAll = useCallback(() => {
    fetchOrders();
    fetchMenu();
    fetchDiscounts();
  }, [fetchOrders, fetchMenu, fetchDiscounts]);

  // ── Realtime channel + 5-second polling ──────────────────────────────────
  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, 5_000);

    chanRef.current = supabase
      .channel('supervisor-main', { config: { broadcast: { self: false } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        const o = payload.new as any;
        if (o.status === 'pending' && o.table_no) {
          toast(`🔔 New order — Table ${o.table_no}`, {
            duration: 6000,
            style: { background: '#1c1917', color: '#fbbf24', border: '1px solid #f59e0b', fontWeight: 700 },
          });
          fetchOrders();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'discounts' }, () => {
        fetchDiscounts();
        toast('💰 New discount request!', { style: { background: '#0f172a', color: '#a78bfa' } });
      })
      .subscribe();

    return () => {
      chanRef.current?.unsubscribe();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchAll, fetchOrders, fetchDiscounts]);


  // ── KDS: Accept order (pending → preparing) ───────────────────────────────
  const acceptOrder = async (id: string) => {
    setBusy(b => ({ ...b, [id]: true }));
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'preparing' as const } : o));
    const { error } = await supabase.from('orders').update({ status: 'preparing' }).eq('id', id);
    if (error) {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'pending' as const } : o));
      toast.error('Failed: ' + error.message);
    } else {
      toast.success('Order accepted — cooking started!');
    }
    setBusy(b => ({ ...b, [id]: false }));
  };

  // ── KDS: Mark ready (preparing → ready) ──────────────────────────────────
  const markReady = async (id: string) => {
    setBusy(b => ({ ...b, [id]: true }));
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'ready' as const } : o));
    const { error } = await supabase.from('orders').update({ status: 'ready' }).eq('id', id);
    if (error) {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'preparing' as const } : o));
      toast.error('Failed: ' + error.message);
    } else {
      toast.success('✅ Order marked ready!');
    }
    setBusy(b => ({ ...b, [id]: false }));
  };

  // ── Menu: Toggle availability via dropdown ───────────────────────────────
  const setDishAvailability = async (id: string, available: boolean) => {
    setToggling(id);
    const { error } = await supabase.from('menu_items')
      .update({ is_available_today: available }).eq('id', id);
    if (error) { toast.error(error.message); setToggling(null); return; }
    setMenuItems(prev => prev.map(m => m.id === id ? { ...m, is_available_today: available } : m));
    const item = menuItems.find(m => m.id === id);
    toast.success(available
      ? `✅ "${item?.name}" is now available`
      : `🚫 "${item?.name}" closed for today`
    );
    setToggling(null);
  };

  // ── Discount: Approve / Reject ────────────────────────────────────────────
  const handleDiscount = async (id: string, action: 'approved' | 'rejected') => {
    const { error } = await supabase.from('discounts').update({ status: action }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setDiscounts(prev => prev.filter(d => d.id !== id));
    toast.success(`Discount ${action}!`);
  };

  // ── Send material report ──────────────────────────────────────────────────
  const sendReport = async () => {
    if (!report.trim()) { toast.error('Write the material requirements first'); return; }
    setSending('report');
    await supabase.from('alerts').insert({
      type: 'purchase_approval', severity: 'info', is_seen: false,
      message: `📋 Supervisor Report from ${user?.name}: ${report}`,
      metadata: { from: user?.id, report, date: new Date().toISOString() },
    });
    await supabase.from('approval_requests').insert({
      type: 'material_purchase', status: 'pending', requested_by: user?.id,
      details: { notes: report, requested_by_name: user?.name },
    });
    toast.success('✅ Report sent to Store Manager!');
    setReport('');
    setSending(null);
  };

  // ── Log complaint ─────────────────────────────────────────────────────────
  const logComplaint = async () => {
    if (!complaint.trim()) { toast.error('Describe the complaint'); return; }
    setSending('complaint');
    await supabase.from('alerts').insert({
      type: 'system', severity: 'warning', is_seen: false,
      message: `⚠️ Complaint${compTable ? ` (Table ${compTable})` : ''}: ${complaint}`,
      metadata: { logged_by: user?.id, table_no: compTable, description: complaint },
    });
    toast.success('Complaint logged!');
    setComplaint(''); setCompTable('');
    setSending(null);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const pending   = orders.filter(o => o.status === 'pending');
  const preparing = orders.filter(o => o.status === 'preparing');
  const ready     = orders.filter(o => o.status === 'ready');
  const closedDishes = menuItems.filter(m => !m.is_available_today);

  // Menu: search filter then group by category
  const searchedMenu = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return q ? menuItems.filter(m => m.name.toLowerCase().includes(q)) : menuItems;
  }, [menuItems, menuSearch]);

  const menuByCategory = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of searchedMenu) {
      const cat = item.category || 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [searchedMenu]);

  // On first load, open any category that has closed dishes
  useEffect(() => {
    if (menuItems.length === 0) return;
    setOpenCategories(prev => {
      const next = new Set(prev);
      menuItems.forEach(m => {
        if (!m.is_available_today) next.add(m.category || 'other');
      });
      return next;
    });
  }, [menuItems]);

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Incoming',     val: pending.length,      col: 'text-amber-400',   bg: 'bg-amber-500/8   border-amber-400/25'   },
    { label: 'Cooking',      val: preparing.length,    col: 'text-blue-400',    bg: 'bg-blue-500/8    border-blue-400/25'    },
    { label: 'Ready',        val: ready.length,        col: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-400/25' },
    { label: 'Closed Dishes',val: closedDishes.length, col: 'text-rose-400',    bg: 'bg-rose-500/8    border-rose-400/25'    },
    { label: 'Disc. Pending',val: discounts.length,    col: 'text-violet-400',  bg: 'bg-violet-500/8  border-violet-400/25', pulse: discounts.length > 0 },
  ];

  const sectionTabs = [
    { id: 'menu',      label: 'Menu Control',    badge: closedDishes.length },
    { id: 'discounts', label: 'Discounts',       badge: discounts.length, pulse: discounts.length > 0 },
    { id: 'report',    label: 'Material Report', badge: 0 },
    { id: 'complaint', label: 'Log Complaint',   badge: 0 },
  ] as const;

  // Category display helpers
  const fmtCat = (cat: string) =>
    cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-surface-950 text-white min-h-screen">

      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-4 px-6 py-4 bg-surface-900 border-b border-surface-700/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
            <ChefHat size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-black text-white">Kitchen Supervisor</h1>
            <p className="text-[10px] text-surface-400">{user?.name} · Kitchen operations & management</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 ml-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-400">LIVE</span>
        </div>
        <button onClick={() => { fetchOrders(); fetchMenu(); fetchDiscounts(); }}
          className="ml-auto w-9 h-9 rounded-xl bg-surface-800 hover:bg-surface-700 border border-surface-700 flex items-center justify-center transition-colors">
          <RefreshCw size={14} className="text-surface-400" />
        </button>
      </div>

      {/* ══ STATS STRIP ══════════════════════════════════════════════════════ */}
      <div className="flex gap-3 px-6 py-3 bg-surface-900/50 border-b border-surface-800 overflow-x-auto shrink-0">
        {stats.map(s => (
          <div key={s.label} className={cn('flex items-center gap-2.5 px-4 py-2 rounded-xl border text-xs font-bold shrink-0', s.bg)}>
            <span className={cn('text-xl font-black', s.col, (s as any).pulse && 'animate-pulse')}>{s.val}</span>
            <span className="text-surface-400">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ══ CONTENT AREA ═════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-6">

          {/* ── KDS: 2-Column Kanban ────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Flame size={16} className="text-orange-400" />
              <h2 className="font-black text-sm text-surface-200 uppercase tracking-wider">Kitchen Order Board</h2>
              <div className="flex-1 h-px bg-surface-800 ml-2" />
              <span className="text-[10px] text-surface-500">Accept orders · Mark ready</span>
            </div>

            {kdsLoad ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minHeight: 320 }}>
                {/* Column 1: Incoming */}
                <KCol title="INCOMING — Accept Orders" icon={<Bell size={14} className="text-amber-400" />}
                  colorCls="bg-amber-500/8 border-amber-400/25 text-amber-400"
                  count={pending.length} emptyMsg="No new orders">
                  <AnimatePresence mode="popLayout">
                    {pending.map(o => (
                      <OrderCard key={o.id} order={o} onAccept={acceptOrder} busy={!!busy[o.id]} />
                    ))}
                  </AnimatePresence>
                </KCol>

                {/* Column 2: Cooking → Mark Ready */}
                <KCol title="COOKING — Mark Ready When Done" icon={<Flame size={14} className="text-blue-400" />}
                  colorCls="bg-blue-500/8 border-blue-400/25 text-blue-400"
                  count={preparing.length + ready.length}
                  emptyMsg="Nothing cooking">
                  <AnimatePresence mode="popLayout">
                    {preparing.map(o => (
                      <OrderCard key={o.id} order={o} onReady={markReady} busy={!!busy[o.id]} />
                    ))}
                    {ready.map(o => (
                      <OrderCard key={o.id} order={o} busy={false} />
                    ))}
                  </AnimatePresence>
                </KCol>
              </div>
            )}
          </div>

          {/* ── Bottom section with tabs ────────────────────────────────── */}
          <div className="rounded-2xl border border-surface-700 bg-surface-900 overflow-hidden">

            {/* Tab bar */}
            <div className="flex border-b border-surface-700 bg-surface-800/50">
              {sectionTabs.map(t => (
                <button key={t.id} onClick={() => setSectionTab(t.id as any)}
                  className={cn(
                    'flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all',
                    sectionTab === t.id
                      ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                      : 'border-transparent text-surface-500 hover:text-surface-300 hover:bg-surface-700/30'
                  )}>
                  {t.label}
                  {t.badge > 0 && (
                    <span className={cn(
                      'px-1.5 py-0.5 rounded-full text-[9px] font-black',
                      (t as any).pulse ? 'bg-rose-500 text-white animate-pulse' : 'bg-surface-700 text-surface-300'
                    )}>
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── TAB: Menu Control ──────────────────────────────────────── */}
            <AnimatePresence mode="wait">
              {sectionTab === 'menu' && (
                <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="p-5">

                  {/* Top bar: status summary + search */}
                  <div className="flex items-center gap-3 mb-4">
                    <p className="text-xs font-semibold shrink-0">
                      {closedDishes.length > 0
                        ? <span className="text-rose-400">{closedDishes.length} dish{closedDishes.length > 1 ? 'es' : ''} closed today</span>
                        : <span className="text-emerald-400">All dishes available ✓</span>
                      }
                    </p>
                    <div className="ml-auto relative max-w-xs w-full">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
                      <input
                        value={menuSearch}
                        onChange={e => setMenuSearch(e.target.value)}
                        placeholder="Search dishes…"
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-surface-700 bg-surface-800 text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500 transition-all"
                      />
                    </div>
                  </div>

                  {menuLoad ? (
                    <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
                  ) : menuByCategory.size === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-surface-600">
                      <Search size={28} className="opacity-30 mb-2" />
                      <p className="text-sm font-semibold">No dishes match your search</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Array.from(menuByCategory.entries()).map(([cat, items]) => {
                        const closedCount = items.filter(i => !i.is_available_today).length;
                        const isOpen      = openCategories.has(cat);
                        return (
                          <div key={cat} className="rounded-xl border border-surface-700 overflow-hidden">
                            {/* Category header — click to expand/collapse */}
                            <button
                              onClick={() => toggleCategory(cat)}
                              className="w-full flex items-center gap-3 px-4 py-3 bg-surface-800 hover:bg-surface-750 transition-colors text-left"
                            >
                              <motion.span
                                animate={{ rotate: isOpen ? 90 : 0 }}
                                transition={{ duration: 0.18 }}
                                className="shrink-0 text-surface-400"
                              >
                                <ChevronRight size={14} />
                              </motion.span>
                              <span className="font-black text-sm text-white">{fmtCat(cat)}</span>
                              <span className="text-[10px] text-surface-500 font-semibold">
                                {items.length} item{items.length !== 1 ? 's' : ''}
                              </span>
                              {closedCount > 0 && (
                                <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[9px] font-black">
                                  {closedCount} closed
                                </span>
                              )}
                            </button>

                            {/* Expandable dish grid */}
                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  key="body"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {items.map(item => (
                                      <div key={item.id}
                                        className={cn(
                                          'flex flex-col gap-2.5 p-3.5 rounded-xl border transition-all',
                                          item.is_available_today
                                            ? 'bg-surface-800/60 border-surface-700 hover:border-surface-600'
                                            : 'bg-rose-500/5 border-rose-500/25'
                                        )}>
                                        {/* Name + price */}
                                        <div>
                                          <p className={cn('text-sm font-bold leading-snug', item.is_available_today ? 'text-white' : 'text-rose-300/70 line-through')}>
                                            {item.name}
                                          </p>
                                          <p className="text-[9px] text-surface-500 mt-0.5">₹{item.price}</p>
                                        </div>

                                        {/* Status dropdown */}
                                        <div className="relative">
                                          <select
                                            disabled={toggling === item.id}
                                            value={item.is_available_today ? 'available' : 'closed'}
                                            onChange={e => setDishAvailability(item.id, e.target.value === 'available')}
                                            className={cn(
                                              'w-full appearance-none pr-7 pl-3 py-2 rounded-xl border text-[10px] font-black cursor-pointer transition-all focus:outline-none',
                                              item.is_available_today
                                                ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-400 hover:border-emerald-400/50'
                                                : 'bg-rose-500/10 border-rose-400/30 text-rose-400 hover:border-rose-400/50'
                                            )}>
                                            <option value="available" className="bg-surface-800 text-emerald-400">✅ Available Today</option>
                                            <option value="closed"    className="bg-surface-800 text-rose-400">🚫 Closed Today</option>
                                          </select>
                                          <ChevronDown size={11} className={cn(
                                            'absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none',
                                            item.is_available_today ? 'text-emerald-400' : 'text-rose-400'
                                          )} />
                                          {toggling === item.id && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-surface-900/60 rounded-xl">
                                              <div className="w-3.5 h-3.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── TAB: Discount Approvals ─────────────────────────────── */}
              {sectionTab === 'discounts' && (
                <motion.div key="discounts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="p-5">
                  {discounts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-surface-600">
                      <CheckCircle size={32} className="opacity-30 mb-2" />
                      <p className="text-sm font-semibold">No pending discount requests</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {discounts.map(d => (
                        <motion.div key={d.id} layout
                          className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-violet-400/20 bg-violet-500/5">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-black text-white">
                                {d.orders?.table_no ? `Table ${d.orders.table_no}` : 'Order'} · ₹{d.amount}
                              </span>
                              <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/25 text-amber-400 font-bold">PENDING</span>
                            </div>
                            <p className="text-xs text-surface-400">{d.reason || 'No reason provided'}</p>
                            <p className="text-[9px] text-surface-600 mt-1">{new Date(d.created_at).toLocaleString('en-IN')}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleDiscount(d.id, 'approved')}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-400 text-xs font-black transition-all">
                              <CheckCircle size={12} /> Approve
                            </button>
                            <button onClick={() => handleDiscount(d.id, 'rejected')}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-400/25 text-rose-400 text-xs font-black transition-all">
                              <XCircle size={12} /> Reject
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── TAB: Material Report ────────────────────────────────── */}
              {sectionTab === 'report' && (
                <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="p-5 space-y-4">
                  <p className="text-xs text-surface-400">
                    Send a daily material requirements report to the Store Manager. Include what's running low, what's needed for tomorrow, any shortages.
                  </p>
                  <textarea
                    value={report} onChange={e => setReport(e.target.value)}
                    rows={6}
                    placeholder={`Example:\n- Chicken: need 15kg for tomorrow\n- Rice: 10kg more needed\n- Garlic: almost finished\n- Gas cylinder getting low\n- Cream: order 5 litres`}
                    className="w-full px-4 py-3 rounded-xl border border-surface-700 bg-surface-800 text-sm text-white placeholder:text-surface-600 resize-none focus:outline-none focus:border-brand-500 focus:bg-surface-750 transition-all"
                  />
                  <div className="flex justify-end">
                    <button onClick={sendReport} disabled={sending === 'report' || !report.trim()}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-violet-600 hover:from-brand-400 hover:to-violet-500 text-white font-black text-sm shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      {sending === 'report'
                        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
                        : <><Send size={13} /> Send to Store Manager</>
                      }
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── TAB: Log Complaint ──────────────────────────────────── */}
              {sectionTab === 'complaint' && (
                <motion.div key="complaint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="p-5 space-y-4">
                  <p className="text-xs text-surface-400">
                    Log a customer complaint or floor incident. It will be sent as an alert to the Owner.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="text-[10px] text-surface-500 font-bold mb-1.5 block">TABLE NO. (optional)</label>
                      <input
                        value={compTable} onChange={e => setCompTable(e.target.value)}
                        placeholder="e.g. 5"
                        className="w-full px-3 py-2.5 rounded-xl border border-surface-700 bg-surface-800 text-sm text-white placeholder:text-surface-600 focus:outline-none focus:border-brand-500 transition-all"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-surface-500 font-bold mb-1.5 block">COMPLAINT / INCIDENT</label>
                      <textarea
                        value={complaint} onChange={e => setComplaint(e.target.value)}
                        rows={4}
                        placeholder="Describe the complaint or incident in detail…"
                        className="w-full px-3 py-2.5 rounded-xl border border-surface-700 bg-surface-800 text-sm text-white placeholder:text-surface-600 resize-none focus:outline-none focus:border-brand-500 transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={logComplaint} disabled={sending === 'complaint' || !complaint.trim()}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-400 font-black text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      {sending === 'complaint'
                        ? <><div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />Logging…</>
                        : <><AlertTriangle size={13} /> Log Complaint</>
                      }
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom padding */}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
};

export default SupervisorDashboard;
