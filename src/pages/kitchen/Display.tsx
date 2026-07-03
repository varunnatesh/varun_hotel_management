import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChefHat, Clock, CheckCircle, Bell, Wifi, WifiOff,
  Flame, AlertCircle, Square, Zap,
} from 'lucide-react';
import { useLiveOrders } from '../../hooks/useOrders';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { formatElapsed, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

// ─── Status Config ──────────────────────────────────────────────
const STATUS = {
  pending: {
    label:  'New Order',
    color:  'border-t-amber-500 bg-amber-500/8',
    badge:  'bg-amber-500 text-white',
    icon:   Bell,
    btnColor: 'bg-amber-500 hover:bg-amber-600',
    action: 'Start Preparing',
    next:   'preparing',
  },
  preparing: {
    label:  'Preparing',
    color:  'border-t-brand-500 bg-brand-500/5',
    badge:  'bg-brand-500 text-white',
    icon:   Flame,
    btnColor: 'bg-brand-600 hover:bg-brand-700',
    action: 'Mark Ready',
    next:   'ready',
  },
  ready: {
    label:  'Ready to Serve',
    color:  'border-t-emerald-500 bg-emerald-500/5',
    badge:  'bg-emerald-500 text-white',
    icon:   CheckCircle,
    btnColor: 'bg-emerald-500 hover:bg-emerald-600',
    action: 'Mark Served',
    next:   'served',
  },
} as const;

// ─── Order Card ─────────────────────────────────────────────────
interface OrderCardProps {
  order:    any;
  onUpdate: (id: string, status: string) => Promise<void>;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onUpdate }) => {
  const [loading,    setLoading]    = useState(false);
  const [checkedSet, setCheckedSet] = useState<Set<number>>(new Set());

  const cfg     = STATUS[order.status as keyof typeof STATUS];
  if (!cfg) return null;

  const items    = order.order_items ?? [];
  const elapsed  = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isUrgent = elapsed > 20 && order.status !== 'ready';
  const Icon     = cfg.icon;

  const allChecked = items.length > 0 && checkedSet.size === items.length;

  const toggleItem = (idx: number) => {
    setCheckedSet(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const markAll = () => {
    setCheckedSet(new Set(items.map((_: any, i: number) => i)));
  };

  const handle = async () => {
    // For preparing→ready: require all items checked first
    if (order.status === 'preparing' && !allChecked) {
      toast.error('Mark all dishes as done before marking ready!');
      return;
    }
    setLoading(true);
    await onUpdate(order.id, cfg.next);
    setLoading(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'rounded-2xl border-t-4 border border-surface-200 dark:border-surface-700 flex flex-col gap-3 overflow-hidden',
        'bg-white dark:bg-surface-800 shadow-card',
        cfg.color,
        isUrgent && 'ring-2 ring-red-500/40',
      )}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-surface-900 dark:text-surface-50">
              #{order.id.slice(-4).toUpperCase()}
            </span>
            {isUrgent && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                <AlertCircle size={10} /> LATE
              </span>
            )}
          </div>
          <p className="text-xs text-surface-500 mt-0.5">
            {order.table_no ? `🪑 Table ${order.table_no}` : `🏠 Room ${order.room_no}`}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span className={cn('px-2 py-0.5 rounded-lg text-[11px] font-bold', cfg.badge)}>
            {cfg.label}
          </span>
          <div className={cn('flex items-center gap-1 text-[11px] font-medium',
            isUrgent ? 'text-red-500' : elapsed > 10 ? 'text-amber-500' : 'text-surface-400')}>
            <Clock size={10} />
            {elapsed}m
          </div>
        </div>
      </div>

      {/* Items — dish-wise checkboxes */}
      <div className="flex-1 px-4 space-y-1.5 border-y border-surface-100 dark:border-surface-700 py-3">
        {items.map((item: any, i: number) => {
          const done = checkedSet.has(i);
          return (
            <motion.div
              key={i}
              animate={{ opacity: done ? 0.5 : 1 }}
              className="flex items-center gap-2.5"
            >
              {/* Checkbox — only shown for 'preparing' status */}
              {order.status === 'preparing' ? (
                <button
                  onClick={() => toggleItem(i)}
                  className={cn(
                    'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0',
                    done
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-surface-300 dark:border-surface-600 hover:border-emerald-400',
                  )}
                >
                  {done && <CheckCircle size={11} />}
                </button>
              ) : (
                <span className="w-5 h-5 rounded-lg bg-surface-100 dark:bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-700 dark:text-surface-300 flex-shrink-0">
                  {item.quantity}
                </span>
              )}

              <span className={cn(
                'text-sm font-medium transition-all',
                done
                  ? 'line-through text-surface-400 dark:text-surface-600'
                  : 'text-surface-800 dark:text-surface-200',
              )}>
                {order.status === 'preparing' && (
                  <span className="text-[11px] font-black text-surface-500 mr-1.5">×{item.quantity}</span>
                )}
                {item.menu_items?.name ?? 'Unknown Item'}
              </span>
            </motion.div>
          );
        })}
        {items.length === 0 && (
          <p className="text-xs text-surface-400 text-center py-2">No items</p>
        )}
      </div>

      {/* Action area */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        {/* "Mark All Done" shortcut — only for preparing */}
        {order.status === 'preparing' && !allChecked && items.length > 0 && (
          <button
            onClick={markAll}
            className="w-full py-1.5 rounded-xl text-xs font-semibold text-brand-600 dark:text-brand-400 border border-brand-400/30 hover:bg-brand-500/8 transition-all flex items-center justify-center gap-1.5"
          >
            <Zap size={11} /> Mark All Done
          </button>
        )}

        {/* Main action button */}
        <button
          onClick={handle}
          disabled={loading || (order.status === 'preparing' && !allChecked)}
          className={cn(
            'w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all',
            'flex items-center justify-center gap-2',
            'active:scale-95',
            loading || (order.status === 'preparing' && !allChecked)
              ? 'opacity-40 cursor-not-allowed'
              : 'hover:opacity-90',
            // glowing green when all dishes checked
            order.status === 'preparing' && allChecked
              ? 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/30 animate-pulse'
              : cfg.btnColor,
          )}
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : order.status === 'preparing' && allChecked ? (
            <><CheckCircle size={14} /> All Done — Mark Ready</>
          ) : (
            <><Icon size={14} /> {cfg.action}</>
          )}
        </button>
      </div>
    </motion.div>
  );
};

// ─── Column ─────────────────────────────────────────────────────
interface ColumnProps {
  title:    string;
  count:    number;
  icon:     React.ElementType;
  color:    string;
  children: React.ReactNode;
}

const Column: React.FC<ColumnProps> = ({ title, count, icon: Icon, color, children }) => (
  <div className="flex flex-col gap-3">
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl', color)}>
      <Icon size={15} />
      <span className="font-bold text-sm">{title}</span>
      <span className="ml-auto text-xs font-bold px-2 py-0.5 bg-white/20 rounded-full">{count}</span>
    </div>
    <div className="flex flex-col gap-3 min-h-24">
      <AnimatePresence mode="popLayout">
        {count === 0 ? (
          <div className="flex items-center justify-center py-8 text-center">
            <p className="text-xs text-surface-400">No orders here</p>
          </div>
        ) : children}
      </AnimatePresence>
    </div>
  </div>
);

// ─── Kitchen Display ─────────────────────────────────────────────
const KitchenDisplay: React.FC = () => {
  const { orders, isLoading, refetch } = useLiveOrders();
  const { isDark } = useThemeStore();
  const [connected,   setConnected]   = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    refetch();
    const msgs: Record<string, string> = {
      preparing: '🔥 Started preparing!',
      ready:     '✅ Order ready to serve!',
      served:    '🍽️ Order served!',
    };
    toast.success(msgs[status] ?? 'Updated');
  };

  const pending   = orders.filter(o => o.status === 'pending');
  const preparing = orders.filter(o => o.status === 'preparing');
  const ready     = orders.filter(o => o.status === 'ready');

  return (
    <div className={cn('min-h-screen flex flex-col', isDark ? 'dark' : '', 'bg-surface-950')}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-surface-900 border-b border-surface-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <ChefHat size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Kitchen Display System</p>
            <p className="text-surface-400 text-xs">Varun Hotel — Main Kitchen</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Order counts */}
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Bell size={12} /> <strong>{pending.length}</strong> new
            </span>
            <span className="flex items-center gap-1.5 text-brand-400">
              <Flame size={12} /> <strong>{preparing.length}</strong> cooking
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle size={12} /> <strong>{ready.length}</strong> ready
            </span>
          </div>

          {/* Connection + clock */}
          <div className="flex items-center gap-3 text-xs text-surface-400">
            <span className="flex items-center gap-1.5">
              {connected
                ? <Wifi size={12} className="text-emerald-400" />
                : <WifiOff size={12} className="text-red-400" />}
              {connected ? 'Live' : 'Offline'}
            </span>
            <span className="font-mono text-surface-300 text-sm">
              {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Dish-wise hint banner */}
      <div className="px-6 py-2 bg-brand-950/60 border-b border-brand-900/40 shrink-0">
        <p className="text-[11px] text-brand-400/70 font-medium">
          💡 <strong>Dish-wise flow:</strong> In "Preparing" — tick off each dish as it's plated. When all dishes are checked, tap <em>"All Done — Mark Ready"</em>.
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-500/12 flex items-center justify-center">
              <ChefHat size={22} className="text-amber-500 animate-pulse" />
            </div>
            <p className="text-surface-400 text-sm">Loading orders…</p>
          </div>
        </div>
      )}

      {/* Orders Grid */}
      {!isLoading && (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 overflow-y-auto">
          <Column title="New Orders" count={pending.length} icon={Bell} color="bg-amber-500/15 text-amber-400">
            {pending.map(order => (
              <OrderCard key={order.id} order={order} onUpdate={updateStatus} />
            ))}
          </Column>

          <Column title="Preparing" count={preparing.length} icon={Flame} color="bg-brand-500/15 text-brand-400">
            {preparing.map(order => (
              <OrderCard key={order.id} order={order} onUpdate={updateStatus} />
            ))}
          </Column>

          <Column title="Ready to Serve" count={ready.length} icon={CheckCircle} color="bg-emerald-500/15 text-emerald-400">
            {ready.map(order => (
              <OrderCard key={order.id} order={order} onUpdate={updateStatus} />
            ))}
          </Column>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && orders.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-surface-800 flex items-center justify-center">
            <ChefHat size={36} className="text-surface-600" />
          </div>
          <p className="text-surface-400 font-medium">Kitchen is clear — no active orders!</p>
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;
