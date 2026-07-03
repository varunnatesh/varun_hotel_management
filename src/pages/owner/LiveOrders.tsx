import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Clock, CheckCircle, XCircle, Flame,
  Filter, RefreshCw, Search, ChefHat, Receipt, Utensils,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatElapsed, cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Status configuration ──────────────────────────────────────────────────────
const STATUS_MAP = {
  pending:   { label: 'Pending',   color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25',   dot: 'bg-amber-500' },
  preparing: { label: 'Preparing', color: 'bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/25',   dot: 'bg-brand-500',  pulse: true },
  ready:     { label: 'Ready',     color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25', dot: 'bg-emerald-500' },
  served:    { label: 'Served',    color: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/25',        dot: 'bg-teal-400' },
  billed:    { label: 'Billed',    color: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/25', dot: 'bg-violet-500' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/15 text-red-500 border border-red-500/25',                               dot: 'bg-red-500' },
};

// Priority order for "worst" status (most attention-needing first)
const STATUS_PRIORITY: Record<string, number> = {
  pending: 0, preparing: 1, ready: 2, served: 3, billed: 4, cancelled: 5,
};

function getWorstStatus(statuses: string[]): string {
  return statuses.reduce((worst, s) => {
    const wp = STATUS_PRIORITY[worst] ?? 99;
    const sp = STATUS_PRIORITY[s]    ?? 99;
    return sp < wp ? s : worst;
  }, statuses[0] ?? 'pending');
}

function StatusPill({ status }: { status: string }) {
  const st = STATUS_MAP[status as keyof typeof STATUS_MAP] ?? STATUS_MAP.pending;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg capitalize', st.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', st.dot, (st as any).pulse && 'animate-pulse')} />
      {st.label}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
const LiveOrders: React.FC = () => {
  const [orders,  setOrders]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<string>('active');
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchOrders = useCallback(async () => {
    const activeStatuses = ['pending', 'preparing', 'ready', 'served'];
    let query = supabase
      .from('orders')
      .select('*, order_items(quantity, menu_items(name)), users!cashier_id(name)')
      .order('created_at', { ascending: true })
      .limit(200);

    if (filter === 'active')    query = query.in('status', activeStatuses);
    else if (filter !== 'all')  query = query.eq('status', filter);

    const { data } = await query;
    if (data) setOrders(data.map((o: any) => ({ ...o, total_amount: Number(o.total_amount) })));
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchOrders();
    channelRef.current = supabase.channel('live-orders-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { channelRef.current?.unsubscribe(); };
  }, [fetchOrders]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    toast.success(`Order marked as ${status}`);
    fetchOrders();
  }, [fetchOrders]);

  // ─── Filtered orders (search across all, then group) ───────────────────────
  const filtered = useMemo(() => orders.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.id.toLowerCase().includes(s) ||
      String(o.table_no).includes(s) ||
      String(o.room_no).includes(s) ||
      (o.users?.name ?? '').toLowerCase().includes(s)
    );
  }), [orders, search]);

  // ─── Group by table/room ───────────────────────────────────────────────────
  const tableGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach(o => {
      const key = o.table_no ? `T${o.table_no}` : `R${o.room_no}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    });
    return Object.entries(groups).map(([key, orders]) => ({
      key,
      isTable: key.startsWith('T'),
      tableNo: key.startsWith('T') ? key.slice(1) : null,
      roomNo:  key.startsWith('R') ? key.slice(1) : null,
      orders:  orders.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      grandTotal:   orders.reduce((s, o) => s + Number(o.total_amount), 0),
      earliestAt:   orders[0]?.created_at,
      worstStatus:  getWorstStatus(orders.map(o => o.status)),
    }));
  }, [filtered]);

  // ─── Counts for filter tabs ────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all:       orders.length,
    active:    orders.filter(o => ['pending','preparing','ready','served'].includes(o.status)).length,
    pending:   orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready:     orders.filter(o => o.status === 'ready').length,
    billed:    orders.filter(o => o.status === 'billed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }), [orders]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout title="Live Orders" subtitle="Monitor all orders in real-time across every table"
      actions={
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={fetchOrders}>Refresh</Button>
        </div>
      }>
      <div className="space-y-4 pb-6">

        {/* ── Filter tabs ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5">
          {([
            { key: 'active',    label: 'Active' },
            { key: 'all',       label: 'All' },
            { key: 'pending',   label: 'Pending' },
            { key: 'preparing', label: 'Preparing' },
            { key: 'ready',     label: 'Ready' },
            { key: 'billed',    label: 'Billed' },
            { key: 'cancelled', label: 'Cancelled' },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                filter === f.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-700')}>
              {f.label}
              <span className={cn('text-[10px] px-1.5 py-0 rounded-full font-bold',
                filter === f.key ? 'bg-white/20 text-white' : 'bg-surface-100 dark:bg-surface-700 text-surface-500')}>
                {counts[f.key]}
              </span>
            </button>
          ))}
          <div className="ml-auto w-48">
            <Input id="orders-search" placeholder="Search order / table..." value={search}
              onChange={e => setSearch(e.target.value)} icon={<Search size={13} />} />
          </div>
        </div>

        {/* ── Loading skeletons ─────────────────────────────────────────────── */}
        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 overflow-hidden">
                <div className="h-12 bg-surface-100 dark:bg-surface-800 animate-pulse" />
                <div className="p-4 space-y-3">
                  {[1, 2].map(j => (
                    <div key={j} className="h-14 rounded-xl bg-surface-100 dark:bg-surface-800 animate-pulse" />
                  ))}
                  <div className="h-10 rounded-xl bg-surface-100 dark:bg-surface-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────────────────────── */}
        {!loading && tableGroups.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-24 text-surface-400">
            <ShoppingBag size={40} className="opacity-30" />
            <p className="text-sm font-semibold">No orders found</p>
          </div>
        )}

        {/* ── Table-grouped cards ────────────────────────────────────────────── */}
        {!loading && tableGroups.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {tableGroups.map((group, gi) => {
                const elapsed = group.earliestAt
                  ? Math.floor((Date.now() - new Date(group.earliestAt).getTime()) / 60000)
                  : 0;
                const worstSt = STATUS_MAP[group.worstStatus as keyof typeof STATUS_MAP] ?? STATUS_MAP.pending;

                return (
                  <motion.div key={group.key}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.22, delay: gi * 0.04 }}
                    className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-sm hover:shadow-lg dark:shadow-black/30 overflow-hidden flex flex-col transition-shadow">

                    {/* ── Card Header ─────────────────────────────────────────── */}
                    <div className="flex items-center justify-between px-4 py-3 bg-surface-50 dark:bg-surface-800 border-b border-surface-100 dark:border-surface-700">
                      <div className="flex items-center gap-2.5">
                        <Utensils size={16} className="text-brand-500" />
                        <span className="text-sm font-black text-surface-900 dark:text-surface-100">
                          {group.isTable ? `Table ${group.tableNo}` : `Room ${group.roomNo}`}
                        </span>
                        <span className="text-[10px] font-bold text-surface-400 bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 rounded-full">
                          {group.orders.length} round{group.orders.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <StatusPill status={group.worstStatus} />
                    </div>

                    {/* ── Rounds ──────────────────────────────────────────────── */}
                    <div className="flex-1 px-4 py-3 space-y-2.5">
                      {group.orders.map((order, ri) => {
                        const items   = order.order_items ?? [];
                        const summary = items.slice(0, 3).map((oi: any) =>
                          `${oi.quantity}× ${oi.menu_items?.name ?? '?'}`).join(', ');
                        const more    = items.length > 3 ? items.length - 3 : 0;

                        return (
                          <motion.div key={order.id}
                            layout
                            className="rounded-xl border border-surface-100 dark:border-surface-700/60 bg-surface-50 dark:bg-surface-800/50 px-3 py-2.5">

                            {/* Round label + status */}
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-black text-surface-400 uppercase tracking-wider">
                                Round {ri + 1}
                              </span>
                              <StatusPill status={order.status} />
                            </div>

                            {/* Items summary */}
                            <p className="text-xs text-surface-600 dark:text-surface-400 line-clamp-1 mb-1">
                              {summary || '—'}
                              {more > 0 && <span className="text-surface-400"> +{more} more</span>}
                            </p>

                            {/* Subtotal + action */}
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-black text-surface-900 dark:text-surface-100">
                                {formatCurrency(order.total_amount)}
                              </span>
                              <div className="flex items-center gap-1">
                                {order.status === 'ready' && (
                                  <Button variant="primary" size="xs" icon={<CheckCircle size={11} />}
                                    onClick={() => updateStatus(order.id, 'served')}>Serve</Button>
                                )}
                                {order.status === 'served' && (
                                  <Button variant="outline" size="xs" icon={<Receipt size={11} />}
                                    onClick={() => updateStatus(order.id, 'billed')}>Bill</Button>
                                )}
                                {['pending', 'preparing'].includes(order.status) && (
                                  <Button variant="ghost" size="xs"
                                    className="text-red-500 hover:bg-red-500/10"
                                    icon={<XCircle size={11} />}
                                    onClick={() => updateStatus(order.id, 'cancelled')}>Cancel</Button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* ── Card Footer — grand total + elapsed ─────────────────── */}
                    <div className="px-4 py-3 border-t border-surface-100 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-800/40 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock size={11} className={elapsed > 30 ? 'text-red-500' : elapsed > 15 ? 'text-amber-500' : 'text-surface-400'} />
                        <span className={cn('text-xs font-semibold',
                          elapsed > 30 ? 'text-red-500' : elapsed > 15 ? 'text-amber-500' : 'text-surface-400')}>
                          {elapsed}m ago
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-surface-400 font-semibold">Grand Total</p>
                        <p className="text-base font-black text-surface-900 dark:text-surface-100 leading-tight">
                          {formatCurrency(group.grandTotal)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default LiveOrders;
