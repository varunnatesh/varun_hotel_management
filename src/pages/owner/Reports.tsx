import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, Receipt, BarChart3,
  Download, RefreshCw, CalendarRange, CreditCard, Smartphone,
  Banknote, Percent, ShoppingBag, AlertCircle, ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { KPICard } from '../../components/dashboard/KPICard';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate:   end.toISOString().split('T')[0],
  };
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function eachDayBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    days.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayRow {
  date:          string;
  orders:        number;
  revenue:       number;
  materialCost:  number;
  otherExpenses: number;
  netProfit:     number;
  margin:        number;
}

interface PaymentBreakdown {
  method: string;
  total:  number;
  count:  number;
}

interface ChartPoint {
  date:     string;
  revenue:  number;
  expenses: number;
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

const ChartTooltip: React.FC<{ active?: boolean; payload?: any[]; label?: string }> = ({
  active, payload, label,
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-xl p-3 text-xs">
      <p className="font-semibold text-surface-700 dark:text-surface-300 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-surface-500 dark:text-surface-400">{p.name}:</span>
          <span className="font-bold text-surface-800 dark:text-surface-100">{formatCurrency(p.value)}</span>
        </div>
      ))}
      {payload.length === 2 && (
        <div className="mt-2 pt-2 border-t border-surface-100 dark:border-surface-700 flex items-center gap-2">
          <span className="text-surface-400">Net:</span>
          <span className={cn('font-bold', (payload[0].value - payload[1].value) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
            {formatCurrency(payload[0].value - payload[1].value)}
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Payment Method Card ──────────────────────────────────────────────────────

const METHOD_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string; bar: string }> = {
  cash: {
    icon:  <Banknote size={18} />,
    label: 'Cash',
    color: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
    bar:   'bg-emerald-500',
  },
  upi: {
    icon:  <Smartphone size={18} />,
    label: 'UPI',
    color: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
    bar:   'bg-violet-500',
  },
  card: {
    icon:  <CreditCard size={18} />,
    label: 'Card',
    color: 'bg-blue-500/12 text-blue-600 dark:text-blue-400',
    bar:   'bg-blue-500',
  },
};

const PaymentMethodCard: React.FC<{
  data: PaymentBreakdown[];
  totalRevenue: number;
  loading: boolean;
}> = ({ data, totalRevenue, loading }) => {
  const knownMethods = ['cash', 'upi', 'card'];

  return (
    <Card>
      <CardHeader
        title="Payment Methods"
        subtitle="Revenue by payment channel"
        icon={<CreditCard size={15} />}
        iconBg="bg-violet-500/12 text-violet-600 dark:text-violet-400"
      />
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-surface-400 gap-2">
          <CreditCard size={28} className="opacity-30" />
          <p className="text-sm">No payment data</p>
        </div>
      ) : (
        <div className="space-y-4">
          {knownMethods.map(method => {
            const entry = data.find(d => d.method === method);
            const cfg   = METHOD_CONFIG[method];
            const amount = entry?.total ?? 0;
            const count  = entry?.count ?? 0;
            const pct    = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;
            return (
              <div key={method}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', cfg.color)}>
                      {cfg.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">{cfg.label}</p>
                      <p className="text-xs text-surface-400">{count} transactions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-surface-800 dark:text-surface-100">{formatCurrency(amount)}</p>
                    <p className="text-xs text-surface-400">{pct.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={cn('h-full rounded-full', cfg.bar)}
                  />
                </div>
              </div>
            );
          })}
          {/* Other methods not in the known list */}
          {data
            .filter(d => !knownMethods.includes(d.method))
            .map(entry => {
              const pct = totalRevenue > 0 ? (entry.total / totalRevenue) * 100 : 0;
              return (
                <div key={entry.method}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-surface-100 dark:bg-surface-700 text-surface-500">
                        <DollarSign size={14} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 capitalize">{entry.method}</p>
                        <p className="text-xs text-surface-400">{entry.count} transactions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-surface-800 dark:text-surface-100">{formatCurrency(entry.total)}</p>
                      <p className="text-xs text-surface-400">{pct.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full bg-surface-400"
                    />
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </Card>
  );
};

// ─── Daily Table Row ──────────────────────────────────────────────────────────

const DayTableRow: React.FC<{ row: DayRow; index: number }> = ({ row, index }) => {
  const isPositive = row.netProfit >= 0;
  return (
    <motion.tr
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.025 }}
      className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
    >
      <td className="px-4 py-3 text-sm font-medium text-surface-700 dark:text-surface-300 whitespace-nowrap">
        {formatShortDate(row.date)}
      </td>
      <td className="px-4 py-3 text-sm text-center text-surface-500 dark:text-surface-400">
        <span className="inline-flex items-center gap-1">
          <ShoppingBag size={12} className="opacity-60" />
          {row.orders}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-surface-800 dark:text-surface-100 text-right">
        {formatCurrency(row.revenue)}
      </td>
      <td className="px-4 py-3 text-sm text-right text-amber-600 dark:text-amber-400">
        {row.materialCost > 0 ? formatCurrency(row.materialCost) : <span className="text-surface-300 dark:text-surface-600">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-right text-red-500 dark:text-red-400">
        {row.otherExpenses > 0 ? formatCurrency(row.otherExpenses) : <span className="text-surface-300 dark:text-surface-600">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-right">
        <span className={cn('font-bold', isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
          <span className="inline-flex items-center gap-0.5">
            {isPositive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {formatCurrency(Math.abs(row.netProfit))}
          </span>
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-right">
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
          isPositive
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-500/10 text-red-500 dark:text-red-400',
        )}>
          <Percent size={9} />
          {Math.abs(row.margin).toFixed(1)}
        </span>
      </td>
    </motion.tr>
  );
};

// ─── Reports Page ─────────────────────────────────────────────────────────────

const ReportsPage: React.FC = () => {
  const { user } = useAuthStore();

  // Date range — default: this month
  const { startDate: defaultStart, endDate: defaultEnd } = getMonthRange();
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate,   setEndDate]   = useState(defaultEnd);

  // Data state
  const [dailyRows,   setDailyRows]   = useState<DayRow[]>([]);
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [payments,    setPayments]    = useState<PaymentBreakdown[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchReports = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      // 1. Payments
      const { data: paymentData, error: payErr } = await supabase
        .from('payments')
        .select('amount, method, timestamp, order_id')
        .gte('timestamp', `${startDate}T00:00:00`)
        .lte('timestamp', `${endDate}T23:59:59`)
        .order('timestamp', { ascending: true });

      if (payErr) throw payErr;

      // 2. Expenses
      const { data: expenseData, error: expErr } = await supabase
        .from('expenses')
        .select('amount, date, category')
        .gte('date', startDate)
        .lte('date', endDate);

      if (expErr) throw expErr;

      // 3. Material issues (cost = qty × cost_per_unit)
      const { data: issueData, error: issErr } = await supabase
        .from('material_issues')
        .select(`
          quantity,
          created_at,
          material_id,
          materials ( cost_per_unit )
        `)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);

      if (issErr) throw issErr;

      // 4. Order count (non-cancelled)
      const { data: orderData, error: ordErr } = await supabase
        .from('orders')
        .select('created_at')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .not('status', 'eq', 'cancelled');

      if (ordErr) throw ordErr;

      // ── Build daily maps ───────────────────────────────────────────────
      const days = eachDayBetween(startDate, endDate);

      const revenueByDay = new Map<string, number>();
      (paymentData ?? []).forEach((p: any) => {
        const day = p.timestamp.slice(0, 10);
        revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(p.amount));
      });

      const expByDay = new Map<string, number>();
      (expenseData ?? []).forEach((e: any) => {
        expByDay.set(e.date, (expByDay.get(e.date) ?? 0) + Number(e.amount));
      });

      const matByDay = new Map<string, number>();
      (issueData ?? []).forEach((issue: any) => {
        const day  = issue.created_at.slice(0, 10);
        const cost = Number(issue.quantity) * Number(issue.materials?.cost_per_unit ?? 0);
        matByDay.set(day, (matByDay.get(day) ?? 0) + cost);
      });

      const ordByDay = new Map<string, number>();
      (orderData ?? []).forEach((o: any) => {
        const day = o.created_at.slice(0, 10);
        ordByDay.set(day, (ordByDay.get(day) ?? 0) + 1);
      });

      // ── Assemble rows ──────────────────────────────────────────────────
      const rows: DayRow[] = days.map(day => {
        const revenue       = revenueByDay.get(day) ?? 0;
        const materialCost  = matByDay.get(day) ?? 0;
        const otherExpenses = expByDay.get(day) ?? 0;
        const totalCosts    = materialCost + otherExpenses;
        const netProfit     = revenue - totalCosts;
        const margin        = revenue > 0 ? (netProfit / revenue) * 100 : 0;
        return {
          date: day,
          orders: ordByDay.get(day) ?? 0,
          revenue,
          materialCost,
          otherExpenses,
          netProfit,
          margin,
        };
      });

      const activeRows = rows.filter(r => r.revenue > 0 || r.otherExpenses > 0 || r.materialCost > 0);
      setDailyRows(activeRows.length > 0 ? activeRows : rows);

      // ── Chart points ───────────────────────────────────────────────────
      setChartPoints(rows.map(r => ({
        date:     formatShortDate(r.date),
        revenue:  r.revenue,
        expenses: r.materialCost + r.otherExpenses,
      })));

      // ── Payment breakdown ──────────────────────────────────────────────
      const methodMap = new Map<string, { total: number; count: number }>();
      (paymentData ?? []).forEach((p: any) => {
        const m = (p.method ?? 'other').toLowerCase();
        const prev = methodMap.get(m) ?? { total: 0, count: 0 };
        methodMap.set(m, { total: prev.total + Number(p.amount), count: prev.count + 1 });
      });
      setPayments(
        Array.from(methodMap.entries())
          .map(([method, v]) => ({ method, ...v }))
          .sort((a, b) => b.total - a.total),
      );

    } catch (err: any) {
      console.error('Reports fetch error:', err);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // ─── Computed KPIs ────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalRevenue  = dailyRows.reduce((s, r) => s + r.revenue, 0);
    const totalExpenses = dailyRows.reduce((s, r) => s + r.materialCost + r.otherExpenses, 0);
    const netProfit     = totalRevenue - totalExpenses;
    const profitMargin  = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    return { totalRevenue, totalExpenses, netProfit, profitMargin };
  }, [dailyRows]);

  const totalRevForPayments = payments.reduce((s, p) => s + p.total, 0);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <AppLayout
      title="Revenue Reports"
      subtitle="Financial analytics and profit tracking"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />}
            loading={refreshing}
            onClick={() => fetchReports(true)}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => toast('Export coming soon!', { icon: '📥' })}
          >
            Export
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pb-8">

        {/* ── Date Range Picker ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex items-center gap-2 flex-shrink-0">
                <CalendarRange size={16} className="text-brand-500" />
                <span className="text-sm font-semibold text-surface-700 dark:text-surface-300">Date Range</span>
              </div>
              <div className="flex flex-wrap items-end gap-3 flex-1">
                <div className="min-w-[160px]">
                  <Input
                    label="From"
                    type="date"
                    value={startDate}
                    max={endDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div className="min-w-[160px]">
                  <Input
                    label="To"
                    type="date"
                    value={endDate}
                    min={startDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
                {/* Quick presets */}
                <div className="flex flex-wrap gap-1.5 pb-0.5">
                  {[
                    {
                      label: 'This Month',
                      fn: () => {
                        const r = getMonthRange();
                        setStartDate(r.startDate);
                        setEndDate(r.endDate);
                      },
                    },
                    {
                      label: 'Last 7 Days',
                      fn: () => {
                        const e = new Date();
                        const s = new Date();
                        s.setDate(e.getDate() - 6);
                        setStartDate(s.toISOString().split('T')[0]);
                        setEndDate(e.toISOString().split('T')[0]);
                      },
                    },
                    {
                      label: 'Last 30 Days',
                      fn: () => {
                        const e = new Date();
                        const s = new Date();
                        s.setDate(e.getDate() - 29);
                        setStartDate(s.toISOString().split('T')[0]);
                        setEndDate(e.toISOString().split('T')[0]);
                      },
                    },
                    {
                      label: 'Last Month',
                      fn: () => {
                        const now = new Date();
                        const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        const en = new Date(now.getFullYear(), now.getMonth(), 0);
                        setStartDate(s.toISOString().split('T')[0]);
                        setEndDate(en.toISOString().split('T')[0]);
                      },
                    },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      onClick={preset.fn}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 dark:hover:bg-brand-950/20 dark:hover:text-brand-400 transition-all"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-32 rounded-2xl bg-surface-100 dark:bg-surface-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard
              label="Total Revenue"
              value={summary.totalRevenue}
              prefix="₹"
              icon={<TrendingUp size={18} />}
              iconBg="bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
              gradient="bg-gradient-to-br from-emerald-400/20 to-teal-400/10"
              trendLabel="in selected period"
              delay={0}
            />
            <KPICard
              label="Total Expenses"
              value={summary.totalExpenses}
              prefix="₹"
              icon={<Receipt size={18} />}
              iconBg="bg-red-500/12 text-red-500 dark:text-red-400"
              gradient="bg-gradient-to-br from-red-400/20 to-rose-400/10"
              trendLabel="material + overhead"
              delay={0.08}
            />
            <KPICard
              label="Net Profit"
              value={Math.abs(summary.netProfit)}
              prefix={summary.netProfit < 0 ? '-₹' : '₹'}
              icon={<DollarSign size={18} />}
              iconBg={
                summary.netProfit >= 0
                  ? 'bg-brand-500/12 text-brand-600 dark:text-brand-400'
                  : 'bg-red-500/12 text-red-500 dark:text-red-400'
              }
              gradient={
                summary.netProfit >= 0
                  ? 'bg-gradient-to-br from-brand-400/20 to-blue-400/10'
                  : 'bg-gradient-to-br from-red-400/20 to-rose-400/10'
              }
              trendLabel="revenue minus expenses"
              delay={0.16}
            />
            <KPICard
              label="Profit Margin"
              value={Math.abs(Math.round(summary.profitMargin * 10) / 10)}
              suffix="%"
              icon={<Percent size={18} />}
              iconBg="bg-violet-500/12 text-violet-600 dark:text-violet-400"
              gradient="bg-gradient-to-br from-violet-400/20 to-purple-400/10"
              trendLabel="net / revenue"
              delay={0.24}
            />
          </div>
        )}

        {/* ── Area Chart + Payment Breakdown ────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Area Chart */}
          <div className="xl:col-span-2">
            <Card noPad>
              <div className="px-5 pt-5 pb-4">
                <CardHeader
                  title="Revenue vs Expenses"
                  subtitle={`${formatShortDate(startDate)} – ${formatShortDate(endDate)}`}
                  icon={<BarChart3 size={15} />}
                  iconBg="bg-blue-500/12 text-blue-600 dark:text-blue-400"
                />
              </div>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : chartPoints.every(p => p.revenue === 0 && p.expenses === 0) ? (
                <div className="h-64 flex flex-col items-center justify-center text-surface-400 gap-2">
                  <AlertCircle size={32} className="opacity-30" />
                  <p className="text-sm">No transaction data for this period</p>
                </div>
              ) : (
                <div className="px-2 pb-5">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart
                      data={chartPoints}
                      margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="expGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.20} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="currentColor"
                        className="text-surface-200 dark:text-surface-700"
                        opacity={0.6}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: 'currentColor' }}
                        className="text-surface-400"
                        tickLine={false}
                        axisLine={false}
                        interval={Math.max(0, Math.ceil(chartPoints.length / 10) - 1)}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'currentColor' }}
                        className="text-surface-400"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={v =>
                          v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`
                        }
                        width={58}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                        formatter={(value) => (
                          <span style={{ color: 'currentColor' }}>{value}</span>
                        )}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        fill="url(#revGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        name="Expenses"
                        stroke="#ef4444"
                        strokeWidth={2}
                        fill="url(#expGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* Payment Methods */}
          <PaymentMethodCard
            data={payments}
            totalRevenue={totalRevForPayments}
            loading={loading}
          />
        </div>

        {/* ── Daily Revenue Table ────────────────────────────────────────── */}
        <Card noPad>
          <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                Daily Breakdown
              </h3>
              <p className="text-xs text-surface-400 mt-0.5">
                {dailyRows.length} days in selected range
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-surface-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Profitable day
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                Loss day
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col divide-y divide-surface-100 dark:divide-surface-800">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="px-4 py-3 flex gap-4 animate-pulse">
                  <div className="h-4 w-20 bg-surface-200 dark:bg-surface-700 rounded" />
                  <div className="h-4 w-8 bg-surface-200 dark:bg-surface-700 rounded" />
                  <div className="h-4 w-24 bg-surface-200 dark:bg-surface-700 rounded ml-auto" />
                  <div className="h-4 w-20 bg-surface-200 dark:bg-surface-700 rounded" />
                  <div className="h-4 w-20 bg-surface-200 dark:bg-surface-700 rounded" />
                  <div className="h-4 w-20 bg-surface-200 dark:bg-surface-700 rounded" />
                  <div className="h-4 w-12 bg-surface-200 dark:bg-surface-700 rounded" />
                </div>
              ))}
            </div>
          ) : dailyRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-surface-400 gap-3">
              <BarChart3 size={36} className="opacity-25" />
              <p className="text-sm">No data for the selected period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-800/50">
                    {[
                      { label: 'Date',           align: 'left'   },
                      { label: 'Orders',         align: 'center' },
                      { label: 'Revenue',        align: 'right'  },
                      { label: 'Material Cost',  align: 'right'  },
                      { label: 'Other Expenses', align: 'right'  },
                      { label: 'Net Profit',     align: 'right'  },
                      { label: 'Margin %',       align: 'right'  },
                    ].map(col => (
                      <th
                        key={col.label}
                        className={cn(
                          'px-4 py-2.5 text-[11px] font-semibold text-surface-500 dark:text-surface-400',
                          'uppercase tracking-wider',
                          col.align === 'right' ? 'text-right' :
                          col.align === 'center' ? 'text-center' : 'text-left',
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                  <AnimatePresence>
                    {dailyRows.map((row, i) => (
                      <DayTableRow key={row.date} row={row} index={i} />
                    ))}
                  </AnimatePresence>
                </tbody>
                {/* Totals Footer */}
                <tfoot>
                  <tr className="bg-surface-50 dark:bg-surface-800/50 border-t-2 border-surface-200 dark:border-surface-700">
                    <td className="px-4 py-3 text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                      Totals
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-center text-surface-700 dark:text-surface-200">
                      {dailyRows.reduce((s, r) => s + r.orders, 0)}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-surface-800 dark:text-surface-100">
                      {formatCurrency(summary.totalRevenue)}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-amber-600 dark:text-amber-400">
                      {formatCurrency(dailyRows.reduce((s, r) => s + r.materialCost, 0))}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-red-500 dark:text-red-400">
                      {formatCurrency(dailyRows.reduce((s, r) => s + r.otherExpenses, 0))}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right">
                      <span className={cn(
                        summary.netProfit >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-500 dark:text-red-400',
                      )}>
                        {formatCurrency(summary.netProfit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold',
                        summary.profitMargin >= 0
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-500 dark:text-red-400',
                      )}>
                        <Percent size={9} />
                        {Math.abs(summary.profitMargin).toFixed(1)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>

      </div>
    </AppLayout>
  );
};

export default ReportsPage;
