import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Minus, Trash2, ChefHat, Receipt, ArrowLeft,
  Clock, Utensils, CheckCircle, XCircle, AlertTriangle,
  RotateCcw, Layers, Flame, Zap, ShoppingCart,
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface MenuItem {
  id: string; name: string; category: string; price: number; is_available_today: boolean;
}
interface CartItem extends MenuItem { quantity: number; }
interface OrderItem {
  id: string; quantity: number; unit_price: number;
  menu_items: { name: string } | null;
}
interface TableOrder {
  id: string;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled' | 'bill_requested';
  total_amount: number;
  created_at: string;
  order_items: OrderItem[];
}

// ─── Category definitions ─────────────────────────────────────────────────────
const CATS = [
  { id: 'all',          label: 'All',        emoji: '🍽️' },
  { id: 'starters',     label: 'Starters',   emoji: '🥗' },
  { id: 'main_course',  label: 'Main',       emoji: '🍛' },
  { id: 'rice_biryani', label: 'Rice',       emoji: '🍚' },
  { id: 'breads',       label: 'Breads',     emoji: '🫓' },
  { id: 'soups',        label: 'Soups',      emoji: '🍲' },
  { id: 'beverages',    label: 'Drinks',     emoji: '☕' },
  { id: 'desserts',     label: 'Desserts',   emoji: '🍮' },
];

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending:        { label: 'In Queue',    icon: Clock,        col: 'text-amber-400',   bg: 'bg-amber-500/8   border-amber-400/25',   dot: 'bg-amber-400 animate-pulse'  },
  preparing:      { label: 'Cooking…',   icon: Flame,        col: 'text-blue-400',    bg: 'bg-blue-500/8    border-blue-400/25',    dot: 'bg-blue-400  animate-pulse'  },
  ready:          { label: 'READY!',     icon: Zap,          col: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-400/50', dot: 'bg-emerald-400 animate-pulse'},
  served:         { label: 'Served ✓',  icon: CheckCircle,  col: 'text-teal-400',    bg: 'bg-teal-500/5    border-teal-400/15',    dot: 'bg-teal-400'                 },
  cancelled:      { label: 'Cancelled',  icon: XCircle,      col: 'text-rose-400',    bg: 'bg-rose-500/8    border-rose-400/30',    dot: 'bg-rose-500'                 },
  bill_requested: { label: 'Billed',     icon: Receipt,      col: 'text-violet-400',  bg: 'bg-violet-500/5  border-violet-400/15',  dot: 'bg-violet-400'               },
} as const;

// ─── SessionStorage menu cache (5 min TTL) ────────────────────────────────────
const MENU_CACHE_KEY = 'menu_cache_v2';
const CACHE_TTL      = 5 * 60 * 1000;

function getMenuCache(): MenuItem[] | null {
  try {
    const raw = sessionStorage.getItem(MENU_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return Date.now() - ts < CACHE_TTL ? data : null;
  } catch { return null; }
}
function setMenuCache(data: MenuItem[]) {
  try { sessionStorage.setItem(MENU_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); }
  catch { /* storage full – ignore */ }
}

// ─── Elapsed time ─────────────────────────────────────────────────────────────
function timeAgo(ts: string) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TableOrder Page
// ═══════════════════════════════════════════════════════════════════════════════
const TableOrder: React.FC = () => {
  const { user }    = useAuthStore();
  const navigate    = useNavigate();
  const [params]    = useSearchParams();
  const chanRef     = useRef<RealtimeChannel | null>(null);

  const tableNo     = params.get('table') ?? '';
  const returnPath  = user?.role === 'cashier' ? '/cashier/billing' : '/captain/tables';
  const orderSource = (user?.role === 'cashier' ? 'cashier' : 'captain') as string;

  // ── State ─────────────────────────────────────────────────────────────────
  const [menu,       setMenu]       = useState<MenuItem[]>([]);
  const [unavail,    setUnavail]    = useState<MenuItem[]>([]);
  const [menuLoad,   setMenuLoad]   = useState(true);
  const [orders,     setOrders]     = useState<TableOrder[]>([]);
  const [ordLoad,    setOrdLoad]    = useState(true);
  const [cart,       setCart]       = useState<CartItem[]>([]);
  const [search,     setSearch]     = useState('');
  const [cat,        setCat]        = useState('all');
  const [sending,    setSending]    = useState(false);
  const [billing,    setBilling]    = useState(false);
  const [serving,    setServing]    = useState<string | null>(null);
  const [cancelledNotif, setCancelledNotif] = useState<TableOrder[]>([]);
  // dish-wise serve tracking: orderId → Set of served item IDs
  const [servedItems,  setServedItems]  = useState<Record<string, Set<string>>>({});

  // ── Fetch menu (with cache) ───────────────────────────────────────────────
  const fetchMenu = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getMenuCache();
      if (cached) {
        setMenu(cached.filter(m => m.is_available_today));
        setUnavail(cached.filter(m => !m.is_available_today));
        setMenuLoad(false);
        return;
      }
    }
    setMenuLoad(true);
    const { data } = await supabase
      .from('menu_items')
      .select('id,name,category,price,is_available_today')
      .order('category').order('name');
    const all = (data ?? []) as MenuItem[];
    setMenuCache(all);
    setMenu(all.filter(m => m.is_available_today));
    setUnavail(all.filter(m => !m.is_available_today));
    setMenuLoad(false);
  }, []);

  // ── Fetch table orders ────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    if (!tableNo) return;
    setOrdLoad(true);
    const { data, error } = await supabase
      .from('orders')
      .select('id,status,total_amount,created_at,order_items(id,quantity,unit_price,menu_items(name))')
      .eq('table_no', tableNo)
      .not('status', 'in', '(paid,cancelled)')
      .order('created_at', { ascending: true });

    if (error) { toast.error('Failed to load orders'); setOrdLoad(false); return; }
    const all = (data ?? []) as unknown as TableOrder[];
    setOrders(all);
    setOrdLoad(false);
  }, [tableNo]);

  // ── Realtime channel (message queue) ─────────────────────────────────────
  useEffect(() => {
    fetchMenu();
    fetchOrders();

    chanRef.current = supabase
      .channel(`table-order-captain-${tableNo}`, { config: { broadcast: { self: false } } })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `table_no=eq.${tableNo}`,
      }, payload => {
        const updated = payload.new as any;
        // Handle cancellation by cashier — immediate notification
        if (updated.status === 'cancelled') {
          toast.error(`❌ Order #${updated.id.slice(-4).toUpperCase()} for T${tableNo} was CANCELLED by cashier`, {
            duration: 10000,
            style: { background: '#1a0a0a', color: '#fca5a5', border: '1px solid #f87171', fontWeight: 700 },
          });
          setCancelledNotif(prev => {
            const exists = prev.find(o => o.id === updated.id);
            return exists ? prev : [...prev, updated];
          });
        }
        // Handle ready state — prompt captain
        if (updated.status === 'ready') {
          toast(`✅ Order ready for T${tableNo}! Please serve to customer.`, {
            duration: 8000,
            icon: '🍽️',
            style: { background: '#0a1a0a', color: '#6ee7b7', border: '1px solid #34d399', fontWeight: 700 },
          });
        }
        fetchOrders();
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'menu_items',
      }, () => fetchMenu(true))
      .subscribe();

    const fastPoll = setInterval(fetchOrders, 5_000);

    return () => { chanRef.current?.unsubscribe(); clearInterval(fastPoll); };
  }, [fetchMenu, fetchOrders, tableNo]);

  // ── Cart helpers ──────────────────────────────────────────────────────────
  const addToCart = (item: MenuItem) => setCart(prev => {
    const ex = prev.find(c => c.id === item.id);
    return ex
      ? prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      : [...prev, { ...item, quantity: 1 }];
  });
  const setQty = (id: string, q: number) =>
    q <= 0 ? setCart(p => p.filter(c => c.id !== id))
           : setCart(p => p.map(c => c.id === id ? { ...c, quantity: q } : c));
  const cartQty = (id: string) => cart.find(c => c.id === id)?.quantity ?? 0;

  // Dismiss cancelled notification (no auto re-add)
  const dismissCancelled = (orderId: string) =>
    setCancelledNotif(p => p.filter(o => o.id !== orderId));

  // Re-add cancelled items to cart (only from toast banner)
  const reorderCancelled = (order: TableOrder) => {
    order.order_items.forEach(oi => {
      const menuItem = menu.find(m => m.name === (oi.menu_items?.name ?? ''));
      if (menuItem) addToCart(menuItem);
    });
    setCancelledNotif(p => p.filter(o => o.id !== order.id));
    toast.success('Cancelled items added back to cart — send to kitchen again');
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const filtered   = menu.filter(m =>
    (cat === 'all' || m.category === cat) &&
    (!search || m.name.toLowerCase().includes(search.toLowerCase()))
  );
  const cartTotal  = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const activeOrds = orders.filter(o => o.status !== 'cancelled');
  const prevTotal  = activeOrds.reduce((s, o) => s + Number(o.total_amount), 0);
  const gst        = Math.round((prevTotal + cartTotal) * 0.05);
  const grandTotal = prevTotal + cartTotal + gst;
  const roundNum   = activeOrds.length + 1;
  const hasCart    = cart.length > 0;

  // Validation state
  const pendingOrds  = orders.filter(o => ['pending','preparing'].includes(o.status));
  const readyOrds    = orders.filter(o => o.status === 'ready');
  const cancelledOrds= orders.filter(o => o.status === 'cancelled');
  const servedOrds   = orders.filter(o => o.status === 'served');
  const allDone      = activeOrds.length > 0 &&
    activeOrds.every(o => ['served','bill_requested'].includes(o.status));

  const billBlockReason =
    hasCart         ? 'Send all cart items to kitchen first' :
    pendingOrds.length > 0 ? `${pendingOrds.length} order(s) still being prepared in kitchen` :
    readyOrds.length > 0   ? `${readyOrds.length} order(s) are ready — serve to customer first` :
    activeOrds.length === 0 ? 'No orders placed for this table' :
    null;

  // ── SEND TO KITCHEN ───────────────────────────────────────────────────────
  const sendToKitchen = async () => {
    if (!hasCart) return;
    // Validate: no duplicate send
    setSending(true);
    try {
      const { data: order, error: oe } = await supabase.from('orders').insert({
        table_no: tableNo, status: 'pending', cashier_id: user!.id,
        total_amount: cartTotal, order_source: orderSource,
      }).select('id').single();
      if (oe) throw oe;

      const { error: ie } = await supabase.from('order_items').insert(
        cart.map(c => ({ order_id: order.id, menu_item_id: c.id, quantity: c.quantity, unit_price: c.price }))
      );
      if (ie) throw ie;

      setCart([]);
      toast.success(`Round ${roundNum} sent to kitchen! 🍳`);
      fetchOrders();
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  // ── MARK DISH SERVED (dish-wise) ─────────────────────────────────────────
  const markDishServed = async (orderId: string, itemId: string, totalItems: number) => {
    setServedItems(prev => {
      const cur = new Set(prev[orderId] ?? []);
      cur.add(itemId);
      const next = { ...prev, [orderId]: cur };
      // If all dishes in this round are physically served → mark order as served
      if (cur.size >= totalItems) {
        markServed(orderId);
      }
      return next;
    });
  };

  // ── SERVE ALL DISHES IN ROUND ────────────────────────────────────────────
  const serveAllInRound = async (orderId: string, items: OrderItem[]) => {
    const allIds = new Set(items.map(i => i.id));
    setServedItems(prev => ({ ...prev, [orderId]: allIds }));
    await markServed(orderId);
  };

  // ── MARK ORDER SERVED ────────────────────────────────────────────────────
  const markServed = async (orderId: string) => {
    setServing(orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'served' as const } : o));
    const { error } = await supabase.from('orders')
      .update({ status: 'served' }).eq('id', orderId);
    if (error) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'ready' as const } : o));
      setServedItems(prev => { const n = { ...prev }; delete n[orderId]; return n; });
      toast.error('Failed to mark served: ' + error.message);
    } else {
      toast.success('Round served to customer ✅');
    }
    setServing(null);
  };

  // ── REQUEST BILL (with full validation) ───────────────────────────────────
  const requestBill = async () => {
    if (billBlockReason) { toast.error(billBlockReason); return; }
    setBilling(true);
    try {
      const ids = activeOrds.map(o => o.id);
      const { error } = await supabase.from('orders')
        .update({ status: 'bill_requested' }).in('id', ids);
      if (error) throw error;

      await supabase.from('alerts').insert({
        type: 'bill_request', severity: 'info', is_seen: false,
        message: `Bill requested for Table ${tableNo}`,
        metadata: { table_no: tableNo, total: prevTotal + Math.round(prevTotal * 0.05) },
      });
      toast.success(`Bill sent to cashier — Table ${tableNo} 🧾`);
      navigate(returnPath);
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    } finally {
      setBilling(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-surface-950 text-white" style={{ height: '100vh', overflow: 'hidden' }}>

      {/* ══ TOP BAR ════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 px-5 py-3 bg-surface-900 border-b border-surface-700/60 shrink-0">
        <button onClick={() => navigate(returnPath)}
          className="w-9 h-9 rounded-xl bg-surface-800 hover:bg-surface-700 border border-surface-700 flex items-center justify-center transition-colors shrink-0">
          <ArrowLeft size={16} />
        </button>

        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center font-black text-base shadow-lg shrink-0">
          {tableNo}
        </div>
        <div>
          <p className="font-black text-white text-sm leading-tight">Table {tableNo}</p>
          <p className="text-[10px] text-surface-400">{user?.name} · Round {roundNum}</p>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-2 ml-3">
          {pendingOrds.length > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-400 text-[9px] font-black">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {pendingOrds.length} IN KITCHEN
            </span>
          )}
          {readyOrds.length > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-400/40 text-emerald-400 text-[9px] font-black animate-pulse">
              <Zap size={9} /> {readyOrds.length} READY — SERVE NOW!
            </span>
          )}
          {cancelledOrds.length > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-400/30 text-rose-400 text-[9px] font-black">
              <XCircle size={9} /> {cancelledOrds.length} CANCELLED
            </span>
          )}
        </div>

        <div className="ml-auto text-right">
          <p className="text-[9px] text-surface-500">Running Total</p>
          <motion.p key={grandTotal} initial={{ scale: 1.08 }} animate={{ scale: 1 }}
            className="text-lg font-black text-brand-400">
            {formatCurrency(grandTotal)}
          </motion.p>
        </div>
      </div>

      {/* ══ CANCELLED ORDER ALERT BANNER ═══════════════════════════════════ */}
      <AnimatePresence>
        {cancelledNotif.map(ord => (
          <motion.div key={ord.id}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-3 px-5 py-2.5 bg-rose-500/10 border-b border-rose-500/30 shrink-0">
            <XCircle size={14} className="text-rose-400 shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] font-black text-rose-300">
                Order #{ord.id.slice(-4).toUpperCase()} CANCELLED by cashier
              </p>
              <p className="text-[9px] text-rose-400/70">
                {ord.order_items.map(i => `${i.quantity}× ${i.menu_items?.name}`).join(', ')}
              </p>
            </div>
            <button onClick={() => reorderCancelled(ord)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black transition-all shrink-0">
              <RotateCcw size={10} /> Re-order
            </button>
            <button onClick={() => setCancelledNotif(p => p.filter(o => o.id !== ord.id))}
              className="text-rose-500 hover:text-rose-300 ml-1 shrink-0">
              <XCircle size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ══ UNAVAILABLE DISHES BANNER ══════════════════════════════════════ */}
      {unavail.length > 0 && (
        <div className="flex items-center gap-2 px-5 py-1.5 bg-surface-900/60 border-b border-surface-700/40 shrink-0">
          <XCircle size={11} className="text-rose-400/60 shrink-0" />
          <span className="text-[9px] text-rose-400/70 font-semibold">Not available today: </span>
          <span className="text-[9px] text-surface-500 truncate">
            {unavail.map(u => u.name).join(' · ')}
          </span>
        </div>
      )}

      {/* ══ MAIN SPLIT LAYOUT ══════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0">

        {/* ═════ LEFT PANEL: MENU ════════════════════════════════════════ */}
        <div className="flex flex-col border-r border-surface-700/50" style={{ width: '56%' }}>

          {/* Search */}
          <div className="px-4 pt-3.5 pb-2.5 bg-surface-900 shrink-0 space-y-2.5">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search menu…"
                className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-8 pr-4 py-2.5 text-xs text-white placeholder:text-surface-600 focus:outline-none focus:border-brand-500 focus:bg-surface-750 transition-all"
              />
            </div>
            {/* Category filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {CATS.map(c => {
                const cnt = c.id === 'all' ? menu.length : menu.filter(m => m.category === c.id).length;
                if (c.id !== 'all' && cnt === 0) return null;
                return (
                  <button key={c.id} onClick={() => setCat(c.id)}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold whitespace-nowrap transition-all shrink-0',
                      cat === c.id
                        ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/25 scale-105'
                        : 'bg-surface-800 border-surface-700/80 text-surface-400 hover:text-white hover:border-surface-500'
                    )}>
                    <span>{c.emoji}</span>
                    <span>{c.label}</span>
                    <span className={cn('text-[8px] px-1 rounded font-black',
                      cat === c.id ? 'bg-white/20' : 'bg-surface-700 text-surface-500')}>
                      {cnt}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Menu grid */}
          <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
            {menuLoad ? (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-2xl bg-surface-800 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-surface-600">
                <span className="text-3xl mb-2">🔍</span>
                <p className="text-xs font-semibold">No items found</p>
              </div>
            ) : (
              <motion.div layout className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                <AnimatePresence>
                  {filtered.map(item => {
                    const q = cartQty(item.id);
                    return (
                      <motion.div key={item.id} layout
                        whileHover={{ y: -3, scale: 1.01 }} transition={{ duration: 0.12 }}
                        onClick={() => q === 0 && addToCart(item)}
                        className={cn(
                          'flex flex-col justify-between rounded-2xl p-3.5 border cursor-pointer transition-all select-none',
                          q > 0
                            ? 'bg-brand-500/10 border-brand-400/50 shadow-lg shadow-brand-500/8'
                            : 'bg-surface-800/80 border-surface-700 hover:border-surface-500 hover:bg-surface-800'
                        )}>
                        {/* Icon + badge */}
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-2xl">{CATS.find(c => c.id === item.category)?.emoji ?? '🍽️'}</span>
                          {q > 0 && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                              className="w-5 h-5 rounded-full bg-brand-500 text-[9px] font-black text-white flex items-center justify-center shadow-lg">
                              {q}
                            </motion.span>
                          )}
                        </div>
                        {/* Name + price */}
                        <div className="mb-2.5">
                          <p className="text-xs font-bold text-white leading-snug line-clamp-2 mb-1">{item.name}</p>
                          <p className="text-xs font-black text-brand-400">{formatCurrency(item.price)}</p>
                        </div>
                        {/* Controls */}
                        {q === 0 ? (
                          <button onClick={e => { e.stopPropagation(); addToCart(item); }}
                            className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white text-[10px] font-bold transition-all">
                            <Plus size={10} /> Add
                          </button>
                        ) : (
                          <div className="flex items-center justify-between">
                            <button onClick={e => { e.stopPropagation(); setQty(item.id, q - 1); }}
                              className="w-7 h-7 rounded-lg bg-surface-700 border border-surface-600 hover:bg-rose-500/15 flex items-center justify-center transition-all">
                              {q === 1 ? <Trash2 size={10} className="text-rose-400" /> : <Minus size={10} className="text-white" />}
                            </button>
                            <motion.span key={q} initial={{ scale: 1.4 }} animate={{ scale: 1 }}
                              className="text-sm font-black text-white w-6 text-center">{q}</motion.span>
                            <button onClick={e => { e.stopPropagation(); setQty(item.id, q + 1); }}
                              className="w-7 h-7 rounded-lg bg-brand-500/20 border border-brand-500/40 hover:bg-brand-500 flex items-center justify-center transition-all">
                              <Plus size={10} className="text-brand-400" />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>

        {/* ═════ RIGHT PANEL: ORDER STATUS ══════════════════════════════ */}
        <div className="flex flex-col bg-surface-900" style={{ width: '44%' }}>

          {/* Panel header */}
          <div className="px-5 py-3.5 border-b border-surface-700/50 shrink-0 flex items-center gap-2">
            <Layers size={14} className="text-brand-400" />
            <span className="text-xs font-black text-white uppercase tracking-wider">Order Status</span>
            <span className="ml-auto text-[10px] text-surface-500">Table {tableNo}</span>
          </div>

          {/* Scrollable status area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>

            {/* Loading skeleton */}
            {ordLoad && (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-surface-800 animate-pulse" />)}
              </div>
            )}

            {/* No orders yet */}
            {!ordLoad && orders.length === 0 && !hasCart && (
              <div className="flex flex-col items-center justify-center py-12 text-surface-600">
                <ChefHat size={32} className="mb-3 opacity-30" />
                <p className="text-sm font-semibold text-surface-500">No orders yet</p>
                <p className="text-xs text-surface-600 mt-1">Select items from the menu to start</p>
              </div>
            )}

            {/* CANCELLED orders — info only, no re-order button here */}
            {cancelledOrds.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-rose-400/70 uppercase tracking-widest px-1">
                  ❌ Cancelled by Cashier
                </p>
                {cancelledOrds.map(order => (
                  <div key={order.id} className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black text-rose-400">Cancelled — #{order.id.slice(-4).toUpperCase()}</span>
                      <span className="text-[9px] text-surface-500">{timeAgo(order.created_at)}</span>
                    </div>
                    <div className="space-y-0.5">
                      {order.order_items.map((oi, i) => (
                        <p key={i} className="text-[10px] text-rose-300/60 line-through">
                          {oi.quantity}× {oi.menu_items?.name ?? '?'}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active rounds */}
            {activeOrds.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-surface-500 uppercase tracking-widest px-1">
                  Active Rounds
                </p>
                {activeOrds.map((order, ri) => {
                  const cfg     = STATUS_CFG[order.status] ?? STATUS_CFG['pending'];
                  const StatusIcon = cfg.icon;
                  const isReady = order.status === 'ready';

                  return (
                    <motion.div key={order.id} layout
                      className={cn('rounded-xl border overflow-hidden', cfg.bg)}>
                      {/* Round header */}
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
                        <span className="text-[10px] font-black text-surface-300">Round {ri + 1}</span>
                        <StatusIcon size={11} className={cfg.col} />
                        <span className={cn('text-[9px] font-bold', cfg.col)}>{cfg.label}</span>
                        <span className="ml-auto text-[9px] text-surface-500">{timeAgo(order.created_at)}</span>
                        <span className="text-xs font-black text-white">{formatCurrency(order.total_amount)}</span>
                      </div>

                      {/* Dish-wise items — with serve checkboxes when READY */}
                      <div className="px-3.5 pb-2 space-y-1.5">
                        {order.order_items.map((oi, i) => {
                          const isDishServed = servedItems[order.id]?.has(oi.id) ?? false;
                          return (
                            <div key={oi.id ?? i}
                              className={cn(
                                'flex items-center justify-between gap-2 py-1 px-2 rounded-lg transition-all',
                                isReady && 'cursor-pointer hover:bg-white/5',
                                isDishServed && 'opacity-50'
                              )}
                              onClick={isReady && !isDishServed
                                ? () => markDishServed(order.id, oi.id, order.order_items.length)
                                : undefined
                              }>
                              {/* Serve checkbox */}
                              {isReady && (
                                <div className={cn(
                                  'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                                  isDishServed
                                    ? 'bg-emerald-500 border-emerald-500'
                                    : 'border-surface-500 hover:border-emerald-400'
                                )}>
                                  {isDishServed && <CheckCircle size={10} className="text-white" />}
                                </div>
                              )}
                              <span className={cn(
                                'flex-1 text-[10px]',
                                isDishServed ? 'text-surface-600 line-through' : 'text-surface-400'
                              )}>
                                {oi.quantity}× {oi.menu_items?.name ?? '?'}
                              </span>
                              <span className="text-[10px] text-surface-500 shrink-0">
                                {formatCurrency(oi.unit_price * oi.quantity)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* SERVE buttons — only for ready orders */}
                      {isReady && (
                        <div className="px-3.5 pb-3 flex gap-2">
                          {/* Serve all at once */}
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={() => serveAllInRound(order.id, order.order_items)}
                            disabled={serving === order.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-black shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-70">
                            {serving === order.id
                              ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              : <><Utensils size={11} /> Serve All (Round {ri + 1})</>
                            }
                          </motion.button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Current cart */}
            {hasCart && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <p className="text-[9px] font-black text-brand-400 uppercase tracking-widest">
                    <ShoppingCart size={9} className="inline mr-1" />New Round {roundNum}
                  </p>
                  <div className="flex-1 h-px bg-brand-500/20" />
                  <button onClick={() => setCart([])} className="text-[9px] text-surface-600 hover:text-rose-400 transition-colors">
                    Clear cart
                  </button>
                </div>
                <AnimatePresence>
                  {cart.map(item => (
                    <motion.div key={item.id}
                      initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16, height: 0 }} transition={{ duration: 0.15 }}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-brand-500/8 border border-brand-400/20">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">{item.name}</p>
                        <p className="text-[9px] text-brand-400">{formatCurrency(item.price)} each</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => setQty(item.id, item.quantity - 1)}
                          className="w-6 h-6 rounded-lg bg-surface-700 border border-surface-600 hover:bg-rose-500/15 flex items-center justify-center transition-all">
                          {item.quantity === 1 ? <Trash2 size={9} className="text-rose-400" /> : <Minus size={9} className="text-surface-300" />}
                        </button>
                        <motion.span key={item.quantity} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                          className="text-xs font-black text-white w-5 text-center">{item.quantity}</motion.span>
                        <button onClick={() => setQty(item.id, item.quantity + 1)}
                          className="w-6 h-6 rounded-lg bg-brand-500/20 border border-brand-500/40 hover:bg-brand-500 flex items-center justify-center transition-all">
                          <Plus size={9} className="text-brand-400" />
                        </button>
                      </div>
                      <p className="text-[11px] font-black text-white w-14 text-right shrink-0">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* ── Bill breakdown ────────────────────────────────────────── */}
          {(activeOrds.length > 0 || hasCart) && (
            <div className="border-t border-surface-700/50 px-5 py-3 space-y-1.5 shrink-0">
              {activeOrds.length > 0 && (
                <div className="flex justify-between text-[10px] text-surface-500">
                  <span>Orders placed ({activeOrds.length} rounds)</span>
                  <span>{formatCurrency(prevTotal)}</span>
                </div>
              )}
              {hasCart && (
                <div className="flex justify-between text-[10px] text-surface-400">
                  <span>In cart (round {roundNum})</span>
                  <span>{formatCurrency(cartTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] text-surface-500">
                <span>GST @ 5%</span>
                <span>{formatCurrency(gst)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-surface-700">
                <span className="text-xs font-bold text-surface-400">Grand Total</span>
                <motion.span key={grandTotal} initial={{ scale: 1.08 }} animate={{ scale: 1 }}
                  className="text-base font-black text-white">{formatCurrency(grandTotal)}</motion.span>
              </div>
            </div>
          )}

          {/* ── Validation hint ───────────────────────────────────────── */}
          {billBlockReason && activeOrds.length > 0 && (
            <div className="mx-4 mb-2 p-2.5 rounded-xl bg-amber-500/6 border border-amber-400/20 flex items-start gap-2">
              <AlertTriangle size={11} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[9px] text-amber-300 leading-relaxed">{billBlockReason}</p>
            </div>
          )}

          {/* ── Action buttons ─────────────────────────────────────────── */}
          <div className="px-4 pb-4 pt-2 space-y-2 shrink-0">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={sendToKitchen}
              disabled={!hasCart || sending}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm transition-all',
                hasCart
                  ? 'bg-gradient-to-r from-brand-500 to-violet-600 text-white shadow-xl shadow-brand-500/20 hover:shadow-brand-500/35'
                  : 'bg-surface-800 text-surface-600 cursor-not-allowed border border-surface-700'
              )}>
              {sending
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
                : <><ChefHat size={16} />Send Round {roundNum} to Kitchen</>
              }
            </motion.button>

            {activeOrds.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={requestBill}
                disabled={billing || !!billBlockReason}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm border transition-all',
                  !billBlockReason
                    ? 'bg-rose-500/12 hover:bg-rose-500/20 border-rose-400/40 text-rose-400 hover:text-rose-300'
                    : 'bg-surface-800/40 border-surface-700/40 text-surface-600 cursor-not-allowed'
                )}>
                {billing
                  ? <><div className="w-4 h-4 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin" />Requesting…</>
                  : <><Receipt size={15} />Request Bill · {formatCurrency(grandTotal)}</>
                }
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TableOrder;
