import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, ShoppingBag, DollarSign, Activity, Users,
  Package, CheckCircle, AlertTriangle, Clock, ChefHat,
  ArrowRight, RefreshCw, BarChart3, Zap, Star,
  TrendingDown, Eye, Bell, Flame,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, formatElapsed, getGreeting, cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';

// ─── Animated Counter ─────────────────────────────────────────────────────────
const AnimatedNumber: React.FC<{ value: number; prefix?: string; suffix?: string; decimals?: number }> = ({
  value, prefix = '', suffix = '', decimals = 0,
}) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = value / 40;
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 20);
    return () => clearInterval(timer);
  }, [value]);
  return (
    <span>
      {prefix}{decimals > 0 ? display.toFixed(decimals) : display.toLocaleString('en-IN')}{suffix}
    </span>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KPI: React.FC<{
  label: string; value: number; prefix?: string; suffix?: string;
  icon: React.ReactNode; color: string; bg: string; delay?: number;
  trend?: number; trendLabel?: string; onClick?: () => void;
}> = ({ label, value, prefix = '', suffix = '', icon, color, bg, delay = 0, trend, trendLabel, onClick }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{ y: -3, transition: { duration: 0.2 } }}
    onClick={onClick}
    className={cn('relative overflow-hidden rounded-2xl p-5 border cursor-pointer', bg)}
  >
    {/* Glow */}
    <div className={cn('absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-30', color)} />
    <div className="relative flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-2">{label}</p>
        <p className="text-2xl font-black text-surface-900 dark:text-surface-50 tabular-nums">
          {prefix}<AnimatedNumber value={value} />{suffix}
        </p>
        {trendLabel && (
          <p className="text-xs text-surface-400 mt-1.5 flex items-center gap-1">
            {trend !== undefined && (
              trend >= 0
                ? <TrendingUp size={10} className="text-emerald-500" />
                : <TrendingDown size={10} className="text-red-400" />
            )}
            {trendLabel}
          </p>
        )}
      </div>
      <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0', color, 'bg-current/10')}>
        {icon}
      </div>
    </div>
  </motion.div>
);

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-900/95 dark:bg-surface-800/95 border border-white/10 rounded-xl px-3 py-2.5 shadow-xl backdrop-blur-sm text-xs">
      <p className="text-surface-400 mb-1.5 font-medium">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-surface-300 capitalize">{p.name}:</span>
          <span className="text-white font-bold">
            {p.name === 'orders' ? p.value : `₹${Number(p.value).toLocaleString('en-IN')}`}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Order Status Funnel ──────────────────────────────────────────────────────
const OrderFunnel: React.FC<{ counts: Record<string, number> }> = ({ counts }) => {
  const stages = [
    { key: 'pending',   label: 'Ordered',   color: 'from-amber-500  to-orange-600',  bg: 'bg-amber-500/12  border-amber-500/25'   },
    { key: 'preparing', label: 'Preparing', color: 'from-blue-500   to-indigo-600',  bg: 'bg-blue-500/12   border-blue-500/25'    },
    { key: 'ready',     label: '✓ Ready',   color: 'from-emerald-500 to-teal-600',   bg: 'bg-emerald-500/12 border-emerald-500/25' },
    { key: 'served',    label: 'Served',    color: 'from-violet-500  to-purple-600', bg: 'bg-violet-500/12  border-violet-500/25'  },
  ];
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => {
        const v = counts[s.key] ?? 0;
        const pct = Math.round((v / total) * 100);
        return (
          <motion.div key={s.key}
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className={cn('flex items-center gap-3 p-3 rounded-xl border', s.bg)}
          >
            <div className={cn('w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-sm font-black flex-shrink-0', s.color)}>
              {v}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-surface-700 dark:text-surface-300">{s.label}</span>
                <span className="text-[10px] text-surface-400">{pct}%</span>
              </div>
              <div className="h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
                  className={cn('h-full rounded-full bg-gradient-to-r', s.color)}
                />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

// ─── Top Dishes Bar ───────────────────────────────────────────────────────────
const DISH_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#f43f5e'];
const TopDishes: React.FC<{ data: { name: string; count: number }[] }> = ({ data }) => {
  if (!data.length) return <p className="text-xs text-surface-400 text-center py-6">No dish data yet today</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <motion.div key={d.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 + i * 0.07 }} className="flex items-center gap-3">
          <span className="text-[10px] font-black text-surface-400 w-4 text-center">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 truncate">{d.name}</span>
              <span className="text-xs font-black ml-2 flex-shrink-0" style={{ color: DISH_COLORS[i] }}>{d.count}x</span>
            </div>
            <div className="h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${(d.count / max) * 100}%` }}
                transition={{ duration: 0.7, delay: 0.2 + i * 0.08, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: DISH_COLORS[i] }}
              />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ─── Payment Method Donut ─────────────────────────────────────────────────────
const PaymentDonut: React.FC<{ cash: number; upi: number; card: number }> = ({ cash, upi, card }) => {
  const total = cash + upi + card || 1;
  const data = [
    { name: 'Cash', value: cash,  color: '#10b981' },
    { name: 'UPI',  value: upi,   color: '#3b82f6' },
    { name: 'Card', value: card,  color: '#8b5cf6' },
  ].filter(d => d.value > 0);
  if (!data.length) return <p className="text-xs text-surface-400 text-center py-4">No payments today</p>;
  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={24} outerRadius={38} strokeWidth={0}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2">
        {data.map(d => (
          <div key={d.name} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
              <span className="text-xs text-surface-500">{d.name}</span>
            </div>
            <span className="text-xs font-bold text-surface-700 dark:text-surface-300">
              {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const OwnerDashboard: React.FC = () => {
  const { user }   = useAuthStore();
  const navigate   = useNavigate();
  const [refreshing,    setRefreshing]    = useState(false);
  const [liveOrders,    setLiveOrders]    = useState<any[]>([]);
  const [recentAlerts,  setRecentAlerts]  = useState<any[]>([]);
  const [recentLogs,    setRecentLogs]    = useState<any[]>([]);
  const [staffList,     setStaffList]     = useState<any[]>([]);
  const [revenueChart,  setRevenueChart]  = useState<any[]>([]);
  const [topDishes,     setTopDishes]     = useState<{ name: string; count: number }[]>([]);
  const [orderCounts,   setOrderCounts]   = useState({ pending: 0, preparing: 0, ready: 0, served: 0 });
  const [payMethods,    setPayMethods]    = useState({ cash: 0, upi: 0, card: 0 });
  const [statsLoading,  setStatsLoading]  = useState(true);
  const [chartRange,    setChartRange]    = useState<'7d' | '30d'>('7d');
  const [kpi, setKpi] = useState({
    revenue: 0, orders: 0, profit: 0, activeOrders: 0,
    staffCount: 0, lowStock: 0, pendingApprovals: 0,
  });

  const today = new Date().toISOString().split('T')[0];

  // Build last-N-days date array
  const buildDateRange = (days: number) => Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().split('T')[0];
  });

  const loadData = useCallback(async () => {
    const days = chartRange === '7d' ? 7 : 30;
    const rangeStart = buildDateRange(days)[0];

    const [
      ordersRes, alertsRes, logsRes, paymentsRes, materialsRes,
      approvalsRes, staffRes, activeCountRes,
      chartPayRes, orderItemsRes, statusCountRes,
    ] = await Promise.all([
      // Live orders preview
      supabase.from('orders')
        .select('id, table_no, status, total_amount, created_at, order_items(quantity, menu_items(name))')
        .in('status', ['pending','preparing','ready','served'])
        .order('created_at', { ascending: false }).limit(6),
      // Alerts
      supabase.from('alerts').select('*').eq('is_seen', false)
        .order('created_at', { ascending: false }).limit(5),
      // Staff logs
      supabase.from('staff_logs').select('*, users(name, role)')
        .order('timestamp', { ascending: false }).limit(6),
      // Today payments
      supabase.from('payments').select('amount, method, timestamp')
        .gte('timestamp', `${today}T00:00:00+05:30`),
      // Materials
      supabase.from('materials').select('id, current_stock, min_stock_level'),
      // Approvals
      supabase.from('approval_requests').select('id').eq('status', 'pending'),
      // Staff
      supabase.from('users').select('id, name, role, last_login')
        .neq('role', 'owner').neq('role', 'guest').eq('is_active', true),
      // Active order count
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .in('status', ['pending','preparing','ready','served']),
      // Chart: payments by day
      supabase.from('payments').select('amount, timestamp')
        .gte('timestamp', `${rangeStart}T00:00:00+05:30`)
        .order('timestamp', { ascending: true }),
      // Top dishes (today)
      supabase.from('order_items')
        .select('quantity, menu_items(name)')
        .gte('created_at', `${today}T00:00:00+05:30`),
      // Order status counts
      supabase.from('orders').select('status')
        .in('status', ['pending','preparing','ready','served']),
    ]);

    if (ordersRes.data)  setLiveOrders(ordersRes.data);
    if (alertsRes.data)  setRecentAlerts(alertsRes.data);
    if (logsRes.data)    setRecentLogs(logsRes.data);
    if (staffRes.data)   setStaffList(staffRes.data);

    // KPIs
    const todayPayments = paymentsRes.data ?? [];
    const todayRevenue = todayPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
    const todayExpenses = todayRevenue * 0.35; // estimate
    setKpi({
      revenue:          todayRevenue,
      orders:           todayPayments.length,
      profit:           Math.round(todayRevenue - todayExpenses),
      activeOrders:     activeCountRes.count ?? 0,
      staffCount:       staffRes.data?.length ?? 0,
      lowStock:         (materialsRes.data ?? []).filter((m: any) => Number(m.current_stock) < Number(m.min_stock_level)).length,
      pendingApprovals: approvalsRes.data?.length ?? 0,
    });

    // Payment methods breakdown
    const cashAmt  = todayPayments.filter((p: any) => p.method === 'cash').reduce((s: number, p: any) => s + Number(p.amount), 0);
    const upiAmt   = todayPayments.filter((p: any) => p.method === 'upi').reduce((s: number, p: any) => s + Number(p.amount), 0);
    const cardAmt  = todayPayments.filter((p: any) => p.method === 'card').reduce((s: number, p: any) => s + Number(p.amount), 0);
    setPayMethods({ cash: cashAmt, upi: upiAmt, card: cardAmt });

    // Revenue chart — aggregate payments by day
    // Handle both UTC (2026-07-01T13:00:00Z) and IST (2026-07-01T18:30:00+05:30) stored timestamps
    const dateArr = buildDateRange(days);
    const payByDay: Record<string, number> = {};
    (chartPayRes.data ?? []).forEach((p: any) => {
      if (!p.timestamp) return;
      // Parse timestamp and convert to IST date
      const ts = new Date(p.timestamp);
      const istOffset = 5.5 * 60 * 60 * 1000; // +5:30 in ms
      const istDate = new Date(ts.getTime() + istOffset);
      const d = istDate.toISOString().split('T')[0];
      payByDay[d] = (payByDay[d] ?? 0) + Number(p.amount);
    });
    const chartData = dateArr.map(d => ({
      label: days === 7
        ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-IN', { weekday: 'short' })
        : new Date(d + 'T12:00:00Z').getDate().toString(),
      revenue: Math.round(payByDay[d] ?? 0),
      profit:  Math.round((payByDay[d] ?? 0) * 0.65),
    }));
    setRevenueChart(chartData);

    // Top dishes
    const dishCount: Record<string, number> = {};
    (orderItemsRes.data ?? []).forEach((oi: any) => {
      const name = oi.menu_items?.name;
      if (name) dishCount[name] = (dishCount[name] ?? 0) + Number(oi.quantity);
    });
    const sorted = Object.entries(dishCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    setTopDishes(sorted);

    // Order status counts
    const counts: Record<string, number> = {};
    (statusCountRes.data ?? []).forEach((o: any) => {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
    });
    setOrderCounts({ pending: counts.pending ?? 0, preparing: counts.preparing ?? 0, ready: counts.ready ?? 0, served: counts.served ?? 0 });

    setStatsLoading(false);
  }, [chartRange, today]);

  useEffect(() => { loadData(); }, [loadData]);

  // Re-load when chart range changes
  useEffect(() => { loadData(); }, [chartRange]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const ORDER_URGENCY: Record<string, string> = {
    pending:   'border-l-amber-500  bg-amber-500/4',
    preparing: 'border-l-blue-500   bg-blue-500/4',
    ready:     'border-l-emerald-500 bg-emerald-500/6',
    served:    'border-l-surface-300',
  };

  const ROLE_COLORS: Record<string, string> = {
    store_manager: 'from-blue-500 to-indigo-600',
    kitchen:       'from-amber-500 to-orange-600',
    cashier:       'from-teal-500 to-cyan-600',
    supervisor:    'from-emerald-500 to-green-600',
    captain:       'from-orange-500 to-red-600',
  };
  const ROLE_LABELS: Record<string, string> = {
    store_manager: 'Store', kitchen: 'Kitchen', cashier: 'Cashier',
    supervisor: 'Supervisor', captain: 'Captain',
  };

  return (
    <AppLayout>
      <div className="space-y-5 pb-8">

        {/* ══════════════════════════════════════════════════════
            HERO BANNER
        ══════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl min-h-[160px] flex items-end"
        >
          {/* Hero image */}
          <img
            src="/dashboard_hero.png"
            alt="Hotel Dashboard"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#080c14]/92 via-[#080c14]/70 to-[#080c14]/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080c14]/80 via-transparent to-transparent" />

          {/* Content */}
          <div className="relative z-10 w-full flex items-end justify-between gap-4 px-6 py-5">
            <div>
              {/* Live badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs text-emerald-400 font-semibold">System Live</span>
                <span className="text-white/30 text-xs">•</span>
                <span className="text-white/50 text-xs">{dateStr}</span>
                <span className="text-white/30 text-xs">•</span>
                <span className="text-white/50 text-xs font-mono">{timeStr}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">
                {getGreeting()}, {user?.name?.split(' ')[0]} 👋
              </h1>
              <p className="text-white/50 text-sm mt-1">
                Here's everything happening at <span className="text-amber-400 font-semibold">Varun Hotel</span> right now
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost" size="sm"
                icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
                onClick={handleRefresh}
                className="bg-white/10 border-white/15 text-white hover:bg-white/20"
              >
                Refresh
              </Button>
              <Button
                variant="primary" size="sm"
                icon={<BarChart3 size={14} />}
                onClick={() => navigate('/owner/reports')}
              >
                Daily Report
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ══════════════════════════════════════════════════════
            KPI ROW — 4 main + 4 secondary
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KPI
            label="Today's Revenue" value={kpi.revenue} prefix="₹"
            icon={<TrendingUp size={18} className="text-brand-500" />}
            color="text-brand-500" bg="bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700"
            delay={0.05} trendLabel="collected today" onClick={() => navigate('/owner/reports')}
          />
          <KPI
            label="Orders Billed" value={kpi.orders}
            icon={<ShoppingBag size={18} className="text-violet-500" />}
            color="text-violet-500" bg="bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700"
            delay={0.1} trendLabel="paid today" onClick={() => navigate('/owner/orders')}
          />
          <KPI
            label="Est. Net Profit" value={kpi.profit} prefix="₹"
            icon={<DollarSign size={18} className="text-emerald-500" />}
            color="text-emerald-500" bg="bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700"
            delay={0.15} trendLabel="~65% margin est."
          />
          <KPI
            label="Active Orders" value={kpi.activeOrders}
            icon={<Flame size={18} className="text-amber-500" />}
            color="text-amber-500" bg="bg-amber-500/8 border-amber-500/20 dark:bg-amber-500/6"
            delay={0.2} trendLabel="on floor now" onClick={() => navigate('/owner/orders')}
          />
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            onClick={() => navigate('/owner/staff')}
            className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/12 flex items-center justify-center flex-shrink-0">
              <Users size={18} className="text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-[11px] text-surface-500 font-semibold uppercase tracking-wide">Staff Active</p>
              <p className="text-xl font-black text-surface-900 dark:text-surface-50">{kpi.staffCount}</p>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            onClick={() => navigate('/owner/inventory')}
            className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-xl bg-red-500/12 flex items-center justify-center flex-shrink-0">
              <Package size={18} className="text-red-500" />
            </div>
            <div>
              <p className="text-[11px] text-surface-500 font-semibold uppercase tracking-wide">Low Stock</p>
              <p className={cn('text-xl font-black', kpi.lowStock > 0 ? 'text-red-500' : 'text-surface-900 dark:text-surface-50')}>
                {kpi.lowStock}
              </p>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            onClick={() => navigate('/owner/approvals')}
            className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/12 flex items-center justify-center flex-shrink-0">
              <CheckCircle size={18} className="text-amber-500" />
            </div>
            <div>
              <p className="text-[11px] text-surface-500 font-semibold uppercase tracking-wide">Approvals</p>
              <p className={cn('text-xl font-black', kpi.pendingApprovals > 0 ? 'text-amber-500' : 'text-surface-900 dark:text-surface-50')}>
                {kpi.pendingApprovals}
              </p>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            onClick={() => navigate('/owner/alerts')}
            className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/12 flex items-center justify-center flex-shrink-0">
              <Bell size={18} className="text-blue-500" />
            </div>
            <div>
              <p className="text-[11px] text-surface-500 font-semibold uppercase tracking-wide">Alerts</p>
              <p className={cn('text-xl font-black', recentAlerts.length > 0 ? 'text-blue-500' : 'text-surface-900 dark:text-surface-50')}>
                {recentAlerts.length}
              </p>
            </div>
          </motion.div>
        </div>

        {/* ══════════════════════════════════════════════════════
            REVENUE CHART  +  ORDER FUNNEL
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Revenue Chart — 2/3 width */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="xl:col-span-2"
          >
            <Card className="h-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-surface-900 dark:text-surface-100">Revenue & Profit</p>
                  <p className="text-xs text-surface-400 mt-0.5">Financial performance — real payment data</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {(['7d', '30d'] as const).map(r => (
                    <button key={r} onClick={() => setChartRange(r)}
                      className={cn('px-3 py-1 rounded-lg text-xs font-semibold transition-all',
                        chartRange === r
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'bg-surface-100 dark:bg-surface-700 text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-600'
                      )}>
                      {r === '7d' ? '7 Days' : '30 Days'}
                    </button>
                  ))}
                </div>
              </div>

              {statsLoading ? (
                <div className="h-56 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : revenueChart.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-center gap-2">
                  <BarChart3 size={32} className="text-surface-300 dark:text-surface-600" />
                  <p className="text-sm text-surface-400">No payment data yet</p>
                  <p className="text-xs text-surface-300 dark:text-surface-600">Charts will populate as orders are billed</p>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div key={chartRange}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                  >
                    {/* Explicit height wrapper — required for Recharts ResponsiveContainer */}
                    <div style={{ width: '100%', height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueChart} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.03} />
                            </linearGradient>
                            <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                            tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area type="monotone" dataKey="revenue" name="revenue"
                            stroke="#6366f1" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                          <Area type="monotone" dataKey="profit" name="profit"
                            stroke="#10b981" strokeWidth={2} fill="url(#profGrad)" dot={{ r: 2, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-2">
                      {[{ color: '#6366f1', label: 'Revenue' }, { color: '#10b981', label: 'Profit' }].map(l => (
                        <div key={l.label} className="flex items-center gap-1.5">
                          <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: l.color }} />
                          <span className="text-[10px] text-surface-400">{l.label}</span>
                        </div>
                      ))}
                      <span className="text-[10px] text-surface-300 ml-auto">IST timezone</span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </Card>
          </motion.div>

          {/* Order Funnel — 1/3 width */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <Card className="h-full">
              <CardHeader
                title="Order Flow"
                subtitle="Live kitchen pipeline"
                icon={<ChefHat size={15} />}
                iconBg="bg-amber-500/12 text-amber-600 dark:text-amber-400"
                action={
                  <button onClick={() => navigate('/owner/orders')}
                    className="text-xs text-brand-500 hover:text-brand-600 font-semibold flex items-center gap-1">
                    View <ArrowRight size={10} />
                  </button>
                }
              />
              {statsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <OrderFunnel counts={orderCounts} />
              )}
            </Card>
          </motion.div>
        </div>

        {/* ══════════════════════════════════════════════════════
            LIVE ORDERS  +  TOP DISHES  +  PAYMENTS
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Live Orders */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card noPad className="h-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/12 flex items-center justify-center">
                    <ChefHat size={15} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">Live Orders</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-surface-400">Updating live</span>
                    </div>
                  </div>
                </div>
                <Badge variant="amber" dot pulse>{kpi.activeOrders} active</Badge>
              </div>
              <div className="divide-y divide-surface-100 dark:divide-surface-800 overflow-y-auto max-h-64">
                {statsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : liveOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <ChefHat size={28} className="text-surface-300 dark:text-surface-600" />
                    <p className="text-xs text-surface-400">No active orders</p>
                  </div>
                ) : liveOrders.map(order => {
                  const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
                  const itemsStr = order.order_items?.map((i: any) => `${i.quantity}× ${i.menu_items?.name}`).join(', ') || '—';
                  return (
                    <motion.div key={order.id} layout
                      className={cn('px-4 py-3 flex flex-col gap-1 border-l-2 transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/40 cursor-pointer',
                        ORDER_URGENCY[order.status] ?? 'border-l-transparent')}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-surface-900 dark:text-surface-100">
                            #{order.id.slice(-6).toUpperCase()}
                          </span>
                          <span className="text-[10px] text-surface-400 bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 rounded-md">
                            {order.table_no ? `T${order.table_no}` : 'Room'}
                          </span>
                        </div>
                        <StatusBadge status={order.status} size="sm" />
                      </div>
                      <p className="text-[10px] text-surface-400 truncate">{itemsStr}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-surface-400">
                          <Clock size={9} />
                          <span className="text-[9px]">{elapsed}m ago</span>
                        </div>
                        <span className="text-xs font-bold text-surface-700 dark:text-surface-300">
                          {formatCurrency(order.total_amount ?? 0)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700">
                <Button variant="ghost" size="sm" fullWidth iconRight={<ArrowRight size={12} />}
                  onClick={() => navigate('/owner/orders')}>
                  View all orders
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Top Dishes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <Card className="h-full">
              <CardHeader
                title="Top Dishes Today"
                subtitle="Most ordered items"
                icon={<Star size={15} />}
                iconBg="bg-amber-500/12 text-amber-600 dark:text-amber-400"
                action={
                  <button onClick={() => navigate('/owner/menu')}
                    className="text-xs text-brand-500 hover:text-brand-600 font-semibold flex items-center gap-1">
                    Menu <ArrowRight size={10} />
                  </button>
                }
              />
              {statsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <TopDishes data={topDishes} />
              )}

              {/* Payment method breakdown */}
              <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-800">
                <p className="text-xs font-semibold text-surface-500 mb-3">Payment Methods Today</p>
                <PaymentDonut cash={payMethods.cash} upi={payMethods.upi} card={payMethods.card} />
              </div>
            </Card>
          </motion.div>

          {/* Alerts + Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card noPad className="h-full flex flex-col">
              {/* Alerts section */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-red-500/12 flex items-center justify-center">
                    <AlertTriangle size={13} className="text-red-500" />
                  </div>
                  <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">Alerts</p>
                </div>
                {recentAlerts.length > 0 && <Badge variant="red" dot>{recentAlerts.length}</Badge>}
              </div>
              <div className="divide-y divide-surface-100 dark:divide-surface-800 flex-1 overflow-y-auto max-h-36">
                {statsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : recentAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-5 gap-1">
                    <CheckCircle size={20} className="text-emerald-400" />
                    <p className="text-xs text-surface-400">All clear!</p>
                  </div>
                ) : recentAlerts.map(alert => (
                  <div key={alert.id} className="px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800/30 cursor-pointer">
                    <p className="text-xs font-semibold text-surface-800 dark:text-surface-200 truncate">{alert.message}</p>
                    <p className="text-[10px] text-surface-400 mt-0.5">{formatElapsed(alert.created_at)}</p>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-b border-surface-200 dark:border-surface-700">
                <Button variant="ghost" size="sm" fullWidth iconRight={<ArrowRight size={10} />}
                  onClick={() => navigate('/owner/alerts')}>
                  View alerts
                </Button>
              </div>

              {/* Activity section */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-surface-200 dark:border-surface-700">
                <div className="w-7 h-7 rounded-xl bg-brand-500/12 flex items-center justify-center">
                  <Activity size={13} className="text-brand-500" />
                </div>
                <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">Recent Activity</p>
              </div>
              <div className="px-4 py-3 space-y-2.5 overflow-y-auto max-h-36">
                {statsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : recentLogs.length === 0 ? (
                  <p className="text-xs text-surface-400 text-center py-2">No recent activity</p>
                ) : recentLogs.map((log, i) => (
                  <div key={log.id} className="flex gap-2.5">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={cn('w-2 h-2 rounded-full mt-0.5',
                        log.users?.role === 'owner' ? 'bg-violet-500' :
                        log.users?.role === 'cashier' ? 'bg-teal-500' :
                        log.users?.role === 'kitchen' ? 'bg-amber-500' : 'bg-blue-500'
                      )} />
                      {i < recentLogs.length - 1 && <div className="w-px flex-1 bg-surface-200 dark:bg-surface-700 mt-0.5" />}
                    </div>
                    <div className="pb-2 min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-surface-700 dark:text-surface-300">
                        {log.users?.name ?? 'System'}
                      </p>
                      <p className="text-[10px] text-surface-400 truncate">{log.action}</p>
                      <p className="text-[9px] text-surface-300 dark:text-surface-600 mt-0.5">{formatElapsed(log.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-surface-200 dark:border-surface-700">
                <Button variant="ghost" size="sm" fullWidth iconRight={<ArrowRight size={10} />}
                  onClick={() => navigate('/owner/audit')}>
                  Audit log
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* ══════════════════════════════════════════════════════
            STAFF PANEL  +  QUICK ACTIONS
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Staff Panel — 2/3 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="xl:col-span-2"
          >
            <Card noPad>
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/12 flex items-center justify-center">
                    <Users size={15} className="text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">Team Overview</p>
                    <p className="text-xs text-surface-400">All active staff members</p>
                  </div>
                </div>
                <Badge variant="green" dot pulse>{staffList.length} active</Badge>
              </div>
              <div className="px-4 py-3">
                {statsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : staffList.length === 0 ? (
                  <p className="text-xs text-surface-400 text-center py-4">No active staff</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {staffList.map((staff, i) => (
                      <motion.div key={staff.id}
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.05 * i }}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors border border-surface-100 dark:border-surface-700/50"
                      >
                        <div className={cn(
                          'w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-xs font-black flex-shrink-0',
                          ROLE_COLORS[staff.role] ?? 'from-surface-400 to-surface-600'
                        )}>
                          {staff.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-surface-800 dark:text-surface-200 truncate">{staff.name}</p>
                          <p className="text-[10px] text-surface-400">{ROLE_LABELS[staff.role] ?? staff.role}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700">
                <Button variant="ghost" size="sm" fullWidth iconRight={<ArrowRight size={12} />}
                  onClick={() => navigate('/owner/staff')}>
                  Staff management
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Quick Actions — 1/3 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className="h-full">
              <CardHeader
                title="Quick Actions"
                subtitle="Jump to any section"
                icon={<Zap size={15} />}
                iconBg="bg-violet-500/12 text-violet-600 dark:text-violet-400"
              />
              <div className="space-y-2">
                {[
                  { label: 'View Live Orders',    path: '/owner/orders',    icon: ShoppingBag,  color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-500/10'   },
                  { label: 'Menu & Recipes',       path: '/owner/menu',      icon: ChefHat,      color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'Stock & Materials',   path: '/owner/inventory', icon: Package,      color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-500/10'    },
                  { label: 'Revenue Reports',     path: '/owner/reports',   icon: BarChart3,    color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10'  },
                  { label: 'Approvals',           path: '/owner/approvals', icon: CheckCircle,  color: 'text-teal-600 dark:text-teal-400',     bg: 'bg-teal-500/10'    },
                  { label: 'Expenses',            path: '/owner/expenses',  icon: DollarSign,   color: 'text-rose-600 dark:text-rose-400',     bg: 'bg-rose-500/10'    },
                ].map(({ label, path, icon: Icon, color, bg }) => (
                  <button key={path}
                    onClick={() => navigate(path)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-700/60 transition-all group text-left"
                  >
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110', bg)}>
                      <Icon size={15} className={color} />
                    </div>
                    <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 group-hover:text-surface-900 dark:group-hover:text-surface-100 transition-colors flex-1">
                      {label}
                    </span>
                    <ArrowRight size={12} className="text-surface-300 group-hover:text-surface-500 transition-all group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

      </div>
    </AppLayout>
  );
};

export default OwnerDashboard;
