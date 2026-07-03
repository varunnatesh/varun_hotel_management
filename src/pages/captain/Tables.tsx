import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Clock, ChefHat, Receipt, CheckCircle,
  Users, Bell, RefreshCw, ArrowRight, AlertCircle,
  UtensilsCrossed, X, Eye, Utensils, Lightbulb,
  CalendarClock, Timer, UserCheck, LayoutGrid, Armchair,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, formatElapsed, cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface TableSession {
  table_no:    number;
  capacity:    number;
  section:     string;
  status:      'free' | 'occupied' | 'bill_requested' | 'ready';
  orders:      TableOrder[];
  total:       number;
  earliest_at: string | null;
}

interface TableOrder {
  id:           string;
  status:       string;
  total_amount: number;
  created_at:   string;
  item_count:   number;
}

// ─── Static table definitions ──────────────────────────────────────────────────
const TABLE_DEFS = [
  ...Array.from({ length: 6  }, (_, i) => ({ no: i + 1,  capacity: 4, section: 'Section A' })),
  ...Array.from({ length: 4  }, (_, i) => ({ no: i + 7,  capacity: 6, section: 'Section B' })),
  ...Array.from({ length: 4  }, (_, i) => ({ no: i + 11, capacity: 2, section: 'Section C' })),
  ...Array.from({ length: 2  }, (_, i) => ({ no: i + 15, capacity: 8, section: 'VIP'       })),
];

// ─── Table status styles ────────────────────────────────────────────────────────
const STATUS_STYLE = {
  free:           { label: 'Free',         color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700',   dot: 'bg-emerald-500'  },
  occupied:       { label: 'Occupied',     color: 'text-amber-600   dark:text-amber-400',   bg: 'bg-amber-500/8   border-amber-500/30   dark:bg-amber-500/6',                dot: 'bg-amber-500'    },
  ready:          { label: '✓ Ready',      color: 'text-brand-600   dark:text-brand-400',   bg: 'bg-brand-500/8   border-brand-500/30   dark:bg-brand-500/6',                dot: 'bg-brand-500'    },
  bill_requested: { label: 'Bill Request', color: 'text-rose-600    dark:text-rose-400',    bg: 'bg-rose-500/10   border-rose-500/40   dark:bg-rose-500/8',                  dot: 'bg-rose-500'     },
};

// ─── Section colour lookup ─────────────────────────────────────────────────────
const SECTION_COLORS: Record<string, string> = {
  'Section A': 'bg-blue-500/10   text-blue-600   dark:text-blue-400   border-blue-500/20',
  'Section B': 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  'Section C': 'bg-teal-500/10   text-teal-600   dark:text-teal-400   border-teal-500/20',
  'VIP':       'bg-amber-500/10  text-amber-700  dark:text-amber-400  border-amber-500/20',
};

// ─── Compute table session status from orders ───────────────────────────────────
function sessionStatus(orders: TableOrder[]): TableSession['status'] {
  if (!orders.length) return 'free';
  if (orders.some(o => o.status === 'bill_requested')) return 'bill_requested';
  if (orders.some(o => o.status === 'ready'))          return 'ready';
  return 'occupied';
}

// ─── Order pill label helper ───────────────────────────────────────────────────
function orderPillLabel(status: string): string {
  switch (status) {
    case 'pending':        return 'Kitchen';
    case 'preparing':      return 'Cooking';
    case 'ready':          return 'Ready';
    case 'served':         return 'Served';
    case 'bill_requested': return 'Bill';
    default:               return status;
  }
}

// ─── TableSession with captainName ─────────────────────────────────────────────
interface RichTableSession extends TableSession {
  captainName: string;
}

// ─── Table Card ─────────────────────────────────────────────────────────────────
const TableCard: React.FC<{
  session:       RichTableSession;
  now:           number;
  onAddOrder:    (no: number) => void;
  onRequestBill: (no: number, orders: TableOrder[]) => void;
  onViewTable:   (session: RichTableSession) => void;
}> = ({ session, now, onAddOrder, onRequestBill, onViewTable }) => {
  const st         = STATUS_STYLE[session.status];
  const elapsed    = session.earliest_at
    ? Math.floor((now - new Date(session.earliest_at).getTime()) / 60000) : 0;
  const hasBillReq = session.status === 'bill_requested';
  const isReady    = session.status === 'ready';
  const isOvertime = elapsed > 60;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className={cn('rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-lg', st.bg)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-lg font-black text-surface-900 dark:text-surface-100">T{session.table_no}</p>
          <p className="text-[10px] text-surface-400">{session.section} · {session.capacity} seats</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse', st.dot)} />
          <span className={cn('text-[10px] font-bold', st.color)}>{st.label}</span>
        </div>
      </div>

      {/* Captain badge */}
      {session.captainName && (
        <div className="mb-2.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700/80 border border-surface-200 dark:border-surface-600 text-[10px] font-medium text-surface-500 dark:text-surface-400">
            👤 {session.captainName}
          </span>
        </div>
      )}

      {/* Session info */}
      <div className="mb-3 p-2.5 rounded-xl bg-white/60 dark:bg-surface-900/50 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-surface-500">
            {session.orders.length} round{session.orders.length !== 1 ? 's' : ''} ·{' '}
            {session.orders.reduce((s, o) => s + o.item_count, 0)} items
          </span>
          <span className="text-xs font-bold text-surface-800 dark:text-surface-200">
            {formatCurrency(session.total)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={9} className={isOvertime ? 'text-red-400' : elapsed > 30 ? 'text-amber-400' : 'text-surface-400'} />
          <span className={cn(
            'text-[10px]',
            isOvertime   ? 'text-red-400 font-bold'       :
            elapsed > 30 ? 'text-amber-400 font-semibold' :
                           'text-surface-400',
          )}>
            {elapsed}m seated{isOvertime && ' ⚠'}
          </span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {session.orders.map(o => (
            <span key={o.id}
              className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-semibold',
                o.status === 'pending'        ? 'bg-amber-500/15   text-amber-600'   :
                o.status === 'preparing'      ? 'bg-blue-500/15    text-blue-600'    :
                o.status === 'ready'          ? 'bg-emerald-500/15 text-emerald-600' :
                o.status === 'served'         ? 'bg-teal-500/15    text-teal-600'    :
                o.status === 'bill_requested' ? 'bg-rose-500/15    text-rose-600'    :
                                                'bg-surface-200    text-surface-500',
              )}>
              {orderPillLabel(o.status)}
            </span>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          <Button variant="ghost" size="xs" fullWidth icon={<Eye size={11} />}
            onClick={() => onViewTable(session)}>
            View
          </Button>
          <Button variant="ghost" size="xs" fullWidth icon={<Plus size={11} />}
            onClick={() => onAddOrder(session.table_no)}>
            Add Items
          </Button>
        </div>
        {!hasBillReq && (
          <Button
            variant={isReady ? 'primary' : 'ghost'}
            size="xs" fullWidth
            icon={<Receipt size={11} />}
            onClick={() => onRequestBill(session.table_no, session.orders)}
          >
            {isReady ? '⚡ Request Bill' : 'Request Bill'}
          </Button>
        )}
        {hasBillReq && (
          <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <Bell size={10} className="text-rose-500 animate-pulse" />
            <span className="text-[10px] font-bold text-rose-500">Waiting for cashier…</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Table Detail Modal ─────────────────────────────────────────────────────────
const TableDetailModal: React.FC<{
  session:       RichTableSession | null;
  onClose:       () => void;
  onAddOrder:    (no: number) => void;
  onRequestBill: (no: number, orders: TableOrder[]) => void;
  detailOrders:  any[];
  detailLoading: boolean;
}> = ({ session, onClose, onAddOrder, onRequestBill, detailOrders, detailLoading }) => {
  if (!session) return null;
  const hasBillReq = session.status === 'bill_requested';

  return (
    <Modal open={!!session} onClose={onClose}
      title={`Table ${session.table_no} — ${session.section}`} size="md">
      <div className="space-y-4">
        {/* Summary row */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-surface-400" />
            <span className="text-sm text-surface-600 dark:text-surface-400">
              {session.orders.length} round{session.orders.length !== 1 ? 's' : ''} ·{' '}
              {session.orders.reduce((s, o) => s + o.item_count, 0)} items total
            </span>
          </div>
          <span className="text-base font-black text-brand-600 dark:text-brand-400">
            {formatCurrency(session.total)}
          </span>
        </div>

        {/* Captain badge */}
        {session.captainName && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-100 dark:bg-surface-700/60 border border-surface-200 dark:border-surface-600">
            <span className="text-sm">👤</span>
            <span className="text-xs font-semibold text-surface-600 dark:text-surface-400">
              Captain: {session.captainName}
            </span>
          </div>
        )}

        {/* Order rounds */}
        {detailLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-0.5">
            {detailOrders.map((order, ri) => (
              <div key={order.id} className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-surface-50 dark:bg-surface-800/50">
                  <span className="text-xs font-bold text-surface-700 dark:text-surface-300">Round {ri + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                      order.status === 'pending'        ? 'bg-amber-500/15   text-amber-600'   :
                      order.status === 'preparing'      ? 'bg-blue-500/15    text-blue-600'    :
                      order.status === 'ready'          ? 'bg-emerald-500/15 text-emerald-600' :
                      order.status === 'bill_requested' ? 'bg-rose-500/15    text-rose-600'    :
                                                          'bg-teal-500/15    text-teal-600',
                    )}>
                      {order.status}
                    </span>
                    <span className="text-[10px] text-surface-400">{formatElapsed(order.created_at)}</span>
                  </div>
                </div>
                <div className="px-3 py-2 space-y-1.5">
                  {(order.order_items ?? []).map((oi: any, ii: number) => (
                    <div key={ii} className="flex items-center justify-between text-xs">
                      <span className="text-surface-700 dark:text-surface-300">
                        {oi.quantity}× {oi.menu_items?.name ?? '—'}
                      </span>
                      <span className="text-surface-500">{formatCurrency((oi.unit_price ?? 0) * oi.quantity)}</span>
                    </div>
                  ))}
                  <div className="border-t border-surface-100 dark:border-surface-700 pt-1 flex justify-between text-xs font-bold">
                    <span className="text-surface-600 dark:text-surface-400">Round total</span>
                    <span>{formatCurrency(order.total_amount)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grand Total */}
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-brand-500/8 border border-brand-500/20">
          <span className="text-sm font-bold text-surface-900 dark:text-surface-100">Grand Total</span>
          <span className="text-lg font-black text-brand-600 dark:text-brand-400">{formatCurrency(session.total)}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="ghost" fullWidth icon={<Plus size={14} />}
            onClick={() => { onAddOrder(session.table_no); onClose(); }}>
            Add More Items
          </Button>
          {!hasBillReq ? (
            <Button variant="primary" fullWidth icon={<Receipt size={14} />}
              onClick={() => { onRequestBill(session.table_no, session.orders); onClose(); }}>
              Request Bill
            </Button>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <Bell size={14} className="text-rose-500 animate-pulse" />
              <span className="text-sm font-bold text-rose-500">Cashier notified</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

// ─── Seat New Customer Modal ────────────────────────────────────────────────────
const SeatCustomerModal: React.FC<{
  open:          boolean;
  onClose:       () => void;
  occupiedNos:   Set<number>;
  onSelectTable: (no: number) => void;
}> = ({ open, onClose, occupiedNos, onSelectTable }) => {
  const freeTables = TABLE_DEFS.filter(t => !occupiedNos.has(t.no));
  const sections   = Array.from(new Set(freeTables.map(t => t.section)));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Seat New Customer"
      subtitle={`${freeTables.length} free table${freeTables.length !== 1 ? 's' : ''} available`}
      size="md"
      icon={<Armchair size={18} />}
    >
      {freeTables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <AlertCircle size={24} className="text-amber-500" />
          </div>
          <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">All tables are occupied</p>
          <p className="text-xs text-surface-400 text-center max-w-xs">
            Free up a table by requesting a bill or wait for the cashier to close out a session.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map(sec => {
            const secTables = freeTables.filter(t => t.section === sec);
            return (
              <div key={sec}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn(
                    'px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                    SECTION_COLORS[sec] ?? 'bg-surface-100 text-surface-600 border-surface-200',
                  )}>
                    {sec}
                  </span>
                  <span className="text-[10px] text-surface-400">{secTables.length} free</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {secTables.map(t => (
                    <motion.button
                      key={t.no}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => onSelectTable(t.no)}
                      className={cn(
                        'flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all',
                        'bg-emerald-500/6 border-emerald-500/25 hover:bg-emerald-500/12 hover:border-emerald-500/50',
                        'text-emerald-700 dark:text-emerald-400',
                      )}
                    >
                      <span className="text-base font-black">T{t.no}</span>
                      <span className="text-[9px] font-medium opacity-70">{t.capacity} seats</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-surface-400 pt-1 text-center">
            Tap a table to open the order screen for that table
          </p>
        </div>
      )}
    </Modal>
  );
};

// ─── Suggestions Card ──────────────────────────────────────────────────────────
const SuggestionsCard: React.FC = () => {
  const ideas = [
    {
      icon:  Users,
      color: 'text-blue-500',
      bg:    'bg-blue-500/10',
      title: 'Guest Count Tracking',
      desc:  'Log number of covers per table to monitor average spend per head.',
    },
    {
      icon:  CalendarClock,
      color: 'text-violet-500',
      bg:    'bg-violet-500/10',
      title: 'Reservation System',
      desc:  'Let customers pre-book tables with a deposit — reduce walk-in wait times.',
    },
    {
      icon:  Timer,
      color: 'text-amber-500',
      bg:    'bg-amber-500/10',
      title: 'Table Timer Alerts',
      desc:  'Alert the captain when a table exceeds a configurable seated-time threshold.',
    },
    {
      icon:  UserCheck,
      color: 'text-emerald-500',
      bg:    'bg-emerald-500/10',
      title: 'Shift-Based Assignments',
      desc:  'Assign tables to captains per shift for clear accountability and handoffs.',
    },
    {
      icon:  LayoutGrid,
      color: 'text-rose-500',
      bg:    'bg-rose-500/10',
      title: 'Interactive Floor Map',
      desc:  'Visual drag-and-drop table layout editor with real-time status overlays.',
    },
  ];

  return (
    <div className="mt-2 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-surface-50 dark:bg-surface-800/60 border-b border-surface-200 dark:border-surface-700">
        <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center">
          <Lightbulb size={14} className="text-brand-500" />
        </div>
        <div>
          <p className="text-xs font-bold text-surface-700 dark:text-surface-300">Future Feature Ideas</p>
          <p className="text-[10px] text-surface-400">Planned enhancements for the captain floor view</p>
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ideas.map(idea => (
          <div key={idea.title}
            className="flex items-start gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-surface-100 dark:border-surface-700/60">
            <div className={cn('flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center', idea.bg)}>
              <idea.icon size={15} className={idea.color} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-surface-700 dark:text-surface-300 leading-tight">{idea.title}</p>
              <p className="text-[10px] text-surface-400 mt-0.5 leading-relaxed">{idea.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Captain Tables Page ────────────────────────────────────────────────────────
const CaptainTables: React.FC = () => {
  const { user }    = useAuthStore();
  const navigate    = useNavigate();

  const [sessions,      setSessions]      = useState<RichTableSession[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [section,       setSection]       = useState('All');
  const [viewSession,   setViewSession]   = useState<RichTableSession | null>(null);
  const [detailOrders,  setDetailOrders]  = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [now,           setNow]           = useState(Date.now());
  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ─── Build sessions from raw order rows ────────────────────────────────────
  const buildSessions = useCallback((orders: any[]): RichTableSession[] => {
    const byTable: Record<number, {
      orders:      TableOrder[];
      total:       number;
      earliest:    string;
      captainName: string;
    }> = {};

    orders.forEach((o: any) => {
      const tno = Number(o.table_no);
      if (!tno) return;

      // users join can be array or object depending on Supabase client version
      const captainName: string = Array.isArray(o.users)
        ? (o.users[0]?.name ?? '')
        : (o.users?.name ?? '');

      if (!byTable[tno]) {
        byTable[tno] = { orders: [], total: 0, earliest: o.created_at, captainName };
      }

      byTable[tno].orders.push({
        id:           o.id,
        status:       o.status,
        total_amount: Number(o.total_amount),
        created_at:   o.created_at,
        item_count:   Number(o.order_items?.[0]?.count ?? 0),
      });
      byTable[tno].total += Number(o.total_amount);
      if (o.created_at < byTable[tno].earliest) byTable[tno].earliest = o.created_at;
      if (captainName && !byTable[tno].captainName) byTable[tno].captainName = captainName;
    });

    return TABLE_DEFS.map(def => {
      const session     = byTable[def.no];
      const tableOrders = session?.orders ?? [];
      return {
        table_no:    def.no,
        capacity:    def.capacity,
        section:     def.section,
        status:      sessionStatus(tableOrders),
        orders:      tableOrders,
        total:       session?.total ?? 0,
        earliest_at: session?.earliest ?? null,
        captainName: session?.captainName ?? '',
      };
    });
  }, []);

  // ─── Fetch orders from Supabase ────────────────────────────────────────────
  const loadTables = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, table_no, status, total_amount, created_at, cashier_id, users(name), order_items(count)')
      .not('status', 'in', '(paid,cancelled)')
      .not('table_no', 'is', null)
      .order('created_at', { ascending: true });

    if (error) { console.error('Tables load error:', error.message); setLoading(false); return; }
    setSessions(buildSessions(data ?? []));
    setLoading(false);
  }, [buildSessions]);

  // ─── Realtime + polling ────────────────────────────────────────────────────
  useEffect(() => {
    loadTables();

    channelRef.current = supabase.channel('captain-tables-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadTables)
      .subscribe();

    const refreshInterval = setInterval(loadTables, 5_000);
    const tickInterval    = setInterval(() => setNow(Date.now()), 60_000);

    return () => {
      channelRef.current?.unsubscribe();
      clearInterval(refreshInterval);
      clearInterval(tickInterval);
    };
  }, [loadTables]);

  // ─── Open detail modal ─────────────────────────────────────────────────────
  const openTableDetail = async (session: RichTableSession) => {
    setViewSession(session);
    setDetailOrders([]);
    setDetailLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('id, status, total_amount, created_at, order_items(quantity, unit_price, menu_items(name))')
      .eq('table_no', session.table_no)
      .not('status', 'in', '(paid,cancelled)')
      .order('created_at', { ascending: true });
    setDetailOrders(data ?? []);
    setDetailLoading(false);
  };

  // ─── Request bill — optimistic with rollback ───────────────────────────────
  const requestBill = async (tableNo: number, orders: TableOrder[]) => {
    const ids = orders.map(o => o.id);

    // Optimistic update
    setSessions(prev => prev.map(s =>
      s.table_no === tableNo
        ? { ...s, status: 'bill_requested', orders: s.orders.map(o => ({ ...o, status: 'bill_requested' })) }
        : s,
    ));

    const { error: updateErr } = await supabase
      .from('orders')
      .update({ status: 'bill_requested' })
      .in('id', ids);

    if (updateErr) {
      toast.error('Failed to request bill: ' + updateErr.message);
      loadTables(); // rollback via re-fetch
      return;
    }

    await supabase.from('alerts').insert({
      type:     'bill_request',
      severity: 'info',
      message:  `⚡ Bill requested for Table ${tableNo} — ${formatCurrency(orders.reduce((s, o) => s + o.total_amount, 0))}`,
      is_seen:  false,
      metadata: { table_no: tableNo, order_ids: ids },
    });

    toast.success(`Bill request sent to cashier for Table ${tableNo}!`);
  };

  // ─── Derived values ────────────────────────────────────────────────────────
  const occupiedSessions = sessions.filter(s => s.status !== 'free');
  const occupiedNosSet   = new Set(occupiedSessions.map(s => s.table_no));
  const sections         = ['All', ...Array.from(new Set(TABLE_DEFS.map(t => t.section)))];
  const filtered         = occupiedSessions.filter(s => section === 'All' || s.section === section);

  const freeCount     = sessions.filter(s => s.status === 'free').length;
  const occupiedCount = occupiedSessions.length;
  const readyCount    = sessions.filter(s => s.status === 'ready').length;
  const billReqCount  = sessions.filter(s => s.status === 'bill_requested').length;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout title="My Tables" subtitle="Floor management · Take orders · Request bills">
      <div className="space-y-4 pb-6">

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-3">
          {[
            { label: 'Free',         value: freeCount,     color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' },
            { label: 'Occupied',     value: occupiedCount, color: 'bg-amber-500/10   border-amber-500/20   text-amber-700   dark:text-amber-400'   },
            { label: '✓ Ready',      value: readyCount,    color: 'bg-brand-500/10   border-brand-500/20   text-brand-700   dark:text-brand-400'   },
            { label: 'Bill Pending', value: billReqCount,  color: 'bg-rose-500/10    border-rose-500/20    text-rose-700    dark:text-rose-400'    },
          ].map(s => (
            <div key={s.label}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold', s.color)}>
              <span className="text-2xl font-black">{s.value}</span>
              <span>{s.label}</span>
            </div>
          ))}

          {readyCount > 0 && (
            <motion.span
              animate={{ scale: [1, 1.04, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-500/12 border border-brand-500/30 text-xs font-bold text-brand-600 dark:text-brand-400"
            >
              <Bell size={12} /> {readyCount} Ready to Serve!
            </motion.span>
          )}

          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setSeatModalOpen(true)}
            className="ml-auto"
          >
            Seat New Customer
          </Button>

          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={loadTables}>
            Refresh
          </Button>
        </div>

        {/* Section filter — shows occupied count per section */}
        <div className="flex gap-1.5 flex-wrap">
          {sections.map(s => (
            <button key={s} onClick={() => setSection(s)}
              className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                section === s
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-700',
              )}>
              {s}
              {s !== 'All' && (
                <span className="ml-1.5 text-[10px] opacity-60">
                  {occupiedSessions.filter(ss => ss.section === s).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bill requested banner */}
        <AnimatePresence>
          {billReqCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30"
            >
              <Bell size={16} className="text-rose-500 animate-pulse flex-shrink-0" />
              <p className="text-sm text-rose-700 dark:text-rose-400 font-semibold">
                {billReqCount} table{billReqCount > 1 ? 's' : ''} waiting for cashier to process bill
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tables Grid — only occupied tables */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-52 rounded-2xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-surface-700 dark:text-surface-300">
                {section === 'All' ? 'No occupied tables right now' : `No occupied tables in ${section}`}
              </p>
              <p className="text-sm text-surface-400 mt-1">
                {freeCount > 0
                  ? `${freeCount} table${freeCount > 1 ? 's' : ''} are free — ready to seat customers.`
                  : 'All tables are available.'}
              </p>
            </div>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setSeatModalOpen(true)}>
              Seat New Customer
            </Button>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <AnimatePresence mode="popLayout">
              {filtered.map(session => (
                <TableCard
                  key={session.table_no}
                  session={session}
                  now={now}
                  onAddOrder={no => navigate(`/captain/table-order?table=${no}`)}
                  onRequestBill={requestBill}
                  onViewTable={openTableDetail}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Order Flow Guide */}
        <div className="mt-2 p-4 rounded-2xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
          <p className="text-xs font-bold text-surface-500 uppercase tracking-wide mb-3">Order Flow Guide</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-surface-500">
            {[
              { icon: Users,           label: 'Seat Customer',         color: 'text-emerald-500' },
              { icon: ArrowRight,      label: '',                      color: ''                 },
              { icon: UtensilsCrossed, label: 'Take Order → Kitchen',  color: 'text-amber-500'   },
              { icon: ArrowRight,      label: '',                      color: ''                 },
              { icon: ChefHat,         label: 'Cooking → Ready',       color: 'text-blue-500'    },
              { icon: ArrowRight,      label: '',                      color: ''                 },
              { icon: Utensils,        label: 'Serve & Add More',      color: 'text-teal-500'    },
              { icon: ArrowRight,      label: '',                      color: ''                 },
              { icon: Receipt,         label: 'Request Bill → Cashier',color: 'text-rose-500'    },
            ].map((step, i) => (
              step.label
                ? <div key={i} className="flex items-center gap-1">
                    <step.icon size={13} className={step.color} />
                    <span>{step.label}</span>
                  </div>
                : <ArrowRight key={i} size={12} className="text-surface-300" />
            ))}
          </div>
        </div>

        {/* Suggestions section */}
        <SuggestionsCard />

      </div>

      {/* Table Detail Modal */}
      <TableDetailModal
        session={viewSession}
        onClose={() => { setViewSession(null); setDetailOrders([]); }}
        onAddOrder={no => navigate(`/captain/table-order?table=${no}`)}
        onRequestBill={(no, orders) => { requestBill(no, orders); setViewSession(null); }}
        detailOrders={detailOrders}
        detailLoading={detailLoading}
      />

      {/* Seat New Customer Modal */}
      <SeatCustomerModal
        open={seatModalOpen}
        onClose={() => setSeatModalOpen(false)}
        occupiedNos={occupiedNosSet}
        onSelectTable={no => {
          setSeatModalOpen(false);
          navigate(`/captain/table-order?table=${no}`);
        }}
      />
    </AppLayout>
  );
};

export default CaptainTables;
