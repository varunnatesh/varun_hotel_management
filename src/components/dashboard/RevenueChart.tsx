import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '../../lib/utils';

// ─── Mock Data ────────────────────────────────────────────────────────────────
const generateData = (days: number) =>
  Array.from({ length: days }, (_, i) => {
    const base = 18000 + Math.random() * 15000;
    const revenue = Math.round(base);
    const materialCost = Math.round(revenue * (0.3 + Math.random() * 0.1));
    const expenses = Math.round(revenue * (0.08 + Math.random() * 0.04));
    return {
      day: i + 1,
      label: days === 7
        ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i % 7]
        : days === 30
          ? `${i + 1}`
          : `W${Math.ceil((i + 1) / 7)}`,
      revenue,
      profit:  revenue - materialCost - expenses,
      orders:  Math.round(35 + Math.random() * 30),
    };
  });

const DATA_7D  = generateData(7);
const DATA_30D = generateData(30);
const DATA_90D = generateData(90).reduce<typeof DATA_7D>((acc, d) => {
  const week = `W${Math.ceil(d.day / 7)}`;
  const existing = acc.find(x => x.label === week);
  if (existing) {
    existing.revenue += d.revenue;
    existing.profit  += d.profit;
    existing.orders  += d.orders;
  } else {
    acc.push({ ...d, label: week });
  }
  return acc;
}, []);

type Range = '7d' | '30d' | '90d';
const DATA_MAP: Record<Range, typeof DATA_7D> = {
  '7d':  DATA_7D,
  '30d': DATA_30D,
  '90d': DATA_90D,
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-card-hover px-4 py-3 min-w-[160px]">
      <p className="text-xs font-semibold text-surface-500 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-xs text-surface-600 dark:text-surface-400 capitalize">{p.dataKey}</span>
          <span className="text-xs font-bold text-surface-900 dark:text-surface-100 ml-auto">
            {p.dataKey === 'orders' ? p.value : formatCurrency(p.value, true)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Revenue Chart ────────────────────────────────────────────────────────────
export const RevenueChart: React.FC = () => {
  const [range, setRange]     = useState<Range>('7d');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  const data = DATA_MAP[range];
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalProfit  = data.reduce((s, d) => s + d.profit, 0);

  const rangeLabels: Record<Range, string> = { '7d': '7 Days', '30d': '30 Days', '90d': '90 Days' };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div className="flex gap-5">
          <div>
            <p className="text-xs text-surface-500 font-medium">Revenue</p>
            <p className="text-xl font-bold text-surface-900 dark:text-surface-50">
              {formatCurrency(totalRevenue, true)}
            </p>
          </div>
          <div>
            <p className="text-xs text-surface-500 font-medium">Profit</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalProfit, true)}
            </p>
          </div>
          <div>
            <p className="text-xs text-surface-500 font-medium">Margin</p>
            <p className="text-xl font-bold text-brand-600 dark:text-brand-400">
              {((totalProfit / totalRevenue) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Range tabs */}
          <div className="flex rounded-xl overflow-hidden border border-surface-200 dark:border-surface-700">
            {(['7d', '30d', '90d'] as Range[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  range === r
                    ? 'bg-brand-600 text-white'
                    : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700',
                )}
              >
                {rangeLabels[r]}
              </button>
            ))}
          </div>
          {/* Chart type */}
          <button
            onClick={() => setChartType(t => t === 'area' ? 'bar' : 'area')}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
          >
            {chartType === 'area' ? 'Bar' : 'Area'}
          </button>
        </div>
      </div>

      {/* Chart */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${range}-${chartType}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="h-56"
        >
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} width={48} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                <Area type="monotone" dataKey="profit"  stroke="#10b981" strokeWidth={2} fill="url(#profGrad)" dot={false} />
              </AreaChart>
            ) : (
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} width={48} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4,4,0,0]} maxBarSize={28} />
                <Bar dataKey="profit"  fill="#10b981" radius={[4,4,0,0]} maxBarSize={28} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </motion.div>
      </AnimatePresence>

      {/* Legend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 bg-brand-500 rounded-full" />
          <span className="text-xs text-surface-500">Revenue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 bg-emerald-500 rounded-full" />
          <span className="text-xs text-surface-500">Profit</span>
        </div>
      </div>
    </div>
  );
};

// ─── Dish Performance Bar Chart ───────────────────────────────────────────────
const DISH_DATA = [
  { name: 'Chicken Biryani',     orders: 210, revenue: 46200 },
  { name: 'Paneer Butter Masala',orders: 170, revenue: 25500 },
  { name: 'Veg Meals',           orders: 150, revenue: 18000 },
  { name: 'Roti Basket',         orders: 130, revenue: 7800  },
  { name: 'Fried Rice',          orders: 95,  revenue: 14250 },
];

const DishTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-card-hover px-3 py-2">
      <p className="text-xs font-bold text-surface-900 dark:text-surface-100">{payload[0]?.payload?.name}</p>
      <p className="text-xs text-surface-500">{payload[0]?.value} orders</p>
    </div>
  );
};

export const DishPerformanceChart: React.FC = () => (
  <div className="h-48">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={DISH_DATA} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={110}
          tickFormatter={name => name.length > 14 ? name.slice(0, 14) + '…' : name}
        />
        <Tooltip content={<DishTooltip />} />
        <Bar dataKey="orders" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

// ─── Material Consumption Chart ───────────────────────────────────────────────
const MATERIAL_DATA = [
  { name: 'Chicken',   used: 12, cost: 1560 },
  { name: 'Rice',      used: 18, cost: 702  },
  { name: 'Paneer',    used: 6,  cost: 1200 },
  { name: 'Oil',       used: 5,  cost: 600  },
  { name: 'Tomato',    used: 8,  cost: 160  },
  { name: 'Onion',     used: 10, cost: 200  },
];

const MatTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-card-hover px-3 py-2">
      <p className="text-xs font-bold text-surface-900 dark:text-surface-100">{payload[0]?.payload?.name}</p>
      <p className="text-xs text-surface-500">{payload[0]?.value} kg/L used</p>
      <p className="text-xs text-emerald-600">₹{payload[0]?.payload?.cost}</p>
    </div>
  );
};

export const MaterialConsumptionChart: React.FC = () => (
  <div className="h-44">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={MATERIAL_DATA} margin={{ top: 0, right: 4, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <Tooltip content={<MatTooltip />} />
        <Bar dataKey="used" fill="#f59e0b" radius={[4,4,0,0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

// cn helper (import in file)
function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default RevenueChart;
