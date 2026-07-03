import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, TrendingUp, TrendingDown, ShoppingBag,
  Package, Users, DollarSign, Star, AlertTriangle,
  Zap, ChefHat, Clock, CheckCircle,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card, CardHeader } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { formatCurrency, cn } from '../../lib/utils';

interface ScoreItem {
  label:   string;
  score:   number;   // 0-100
  icon:    React.ElementType;
  color:   string;
  detail:  string;
}

const getColor = (score: number) =>
  score >= 80 ? 'text-emerald-500' :
  score >= 60 ? 'text-brand-500'   :
  score >= 40 ? 'text-amber-500'   : 'text-red-500';

const getBg = (score: number) =>
  score >= 80 ? 'bg-emerald-500' :
  score >= 60 ? 'bg-brand-500'   :
  score >= 40 ? 'bg-amber-500'   : 'bg-red-500';

const HealthScore: React.FC = () => {
  const [scores, setScores] = useState<ScoreItem[]>([]);
  const [overall, setOverall] = useState(0);
  const [loading, setLoading] = useState(true);

  const compute = useCallback(async () => {
    const today     = new Date().toISOString().split('T')[0];
    const weekAgo   = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart= today.slice(0, 7) + '-01';

    const [matRes, orderRes, payRes, alertRes, menuRes, staffRes] = await Promise.all([
      supabase.from('materials').select('current_stock, min_stock_level'),
      supabase.from('orders').select('status, created_at').gte('created_at', `${weekAgo}T00:00:00`),
      supabase.from('payments').select('amount').gte('timestamp', `${monthStart}T00:00:00`),
      supabase.from('alerts').select('severity').eq('is_seen', false),
      supabase.from('menu_items').select('is_available_today'),
      supabase.from('users').select('is_active').neq('role', 'owner'),
    ]);

    const materials = matRes.data ?? [];
    const orders    = orderRes.data ?? [];
    const payments  = payRes.data ?? [];
    const alerts    = alertRes.data ?? [];
    const menu      = menuRes.data ?? [];
    const staff     = staffRes.data ?? [];

    // 1. Stock Health: % items above minimum
    const stockScore = materials.length > 0
      ? Math.round((materials.filter(m => Number(m.current_stock) >= Number(m.min_stock_level)).length / materials.length) * 100)
      : 50;

    // 2. Order Completion: % not cancelled this week
    const cancelledPct = orders.length > 0
      ? orders.filter(o => o.status === 'cancelled').length / orders.length
      : 0;
    const orderScore = Math.round((1 - cancelledPct) * 100);

    // 3. Revenue Health: has revenue this month
    const totalRevenue = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
    const revenueScore = totalRevenue > 50000 ? 90 : totalRevenue > 10000 ? 70 : totalRevenue > 0 ? 50 : 20;

    // 4. Alert Health: fewer unread critical alerts = better
    const criticals = alerts.filter(a => a.severity === 'critical').length;
    const alertScore = Math.max(0, 100 - criticals * 20);

    // 5. Menu Coverage: % dishes available today
    const menuScore = menu.length > 0
      ? Math.round((menu.filter((m: any) => m.is_available_today).length / menu.length) * 100)
      : 50;

    // 6. Staff Activity: % active staff
    const staffScore = staff.length > 0
      ? Math.round((staff.filter((s: any) => s.is_active).length / staff.length) * 100)
      : 100;

    const items: ScoreItem[] = [
      { label: 'Stock Health',       score: stockScore,   icon: Package,    color: 'bg-blue-500/12 text-blue-500',    detail: `${materials.filter(m => Number(m.current_stock) >= Number(m.min_stock_level)).length}/${materials.length} items above minimum` },
      { label: 'Order Completion',   score: orderScore,   icon: ShoppingBag,color: 'bg-brand-500/12 text-brand-500',  detail: `${orders.filter(o=>o.status==='cancelled').length} cancellations this week` },
      { label: 'Revenue (Month)',    score: revenueScore, icon: DollarSign, color: 'bg-emerald-500/12 text-emerald-500', detail: `${formatCurrency(totalRevenue)} collected` },
      { label: 'Alert Status',       score: alertScore,   icon: AlertTriangle, color: 'bg-amber-500/12 text-amber-500', detail: `${criticals} unread critical alerts` },
      { label: 'Menu Availability',  score: menuScore,    icon: ChefHat,    color: 'bg-violet-500/12 text-violet-500', detail: `${menu.filter((m:any)=>m.is_available_today).length}/${menu.length} dishes available` },
      { label: 'Staff Active',       score: staffScore,   icon: Users,      color: 'bg-teal-500/12 text-teal-500',    detail: `${staff.filter((s:any)=>s.is_active).length}/${staff.length} staff active` },
    ];

    setScores(items);
    setOverall(Math.round(items.reduce((s, i) => s + i.score, 0) / items.length));
    setLoading(false);
  }, []);

  useEffect(() => { compute(); }, [compute]);

  const grade = overall >= 80 ? 'A' : overall >= 70 ? 'B' : overall >= 55 ? 'C' : overall >= 40 ? 'D' : 'F';
  const gradeLabel = overall >= 80 ? 'Excellent' : overall >= 70 ? 'Good' : overall >= 55 ? 'Fair' : overall >= 40 ? 'Poor' : 'Critical';

  return (
    <AppLayout title="Business Health Score" subtitle="AI-computed score across 6 key operational dimensions">
      <div className="space-y-5 pb-6">

        {/* Overall Score */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-8 flex flex-col sm:flex-row items-center gap-8">
          {/* Circle */}
          <div className="relative flex-shrink-0">
            <svg viewBox="0 0 120 120" className="w-36 h-36">
              <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8"
                className="text-surface-200 dark:text-surface-700" />
              {!loading && (
                <motion.circle cx="60" cy="60" r="52" fill="none"
                  stroke={overall >= 80 ? '#10b981' : overall >= 60 ? '#6366f1' : overall >= 40 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - overall / 100) }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }} />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {loading ? (
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className={cn('text-4xl font-black', getColor(overall))}>{overall}</span>
                  <span className="text-xs text-surface-400 font-medium">/ 100</span>
                </>
              )}
            </div>
          </div>

          <div className="text-center sm:text-left">
            <div className="flex items-center gap-3 mb-2 justify-center sm:justify-start">
              <span className={cn('text-5xl font-black', getColor(overall))}>{grade}</span>
              <div>
                <p className="text-lg font-bold text-surface-900 dark:text-surface-100">{gradeLabel}</p>
                <p className="text-sm text-surface-400">Business Health Rating</p>
              </div>
            </div>
            <p className="text-sm text-surface-500 dark:text-surface-400 max-w-xs">
              {overall >= 80
                ? '🎉 Your hotel is running excellently across all dimensions!'
                : overall >= 60
                ? '👍 Good overall health. A few areas need attention.'
                : overall >= 40
                ? '⚠️ Several operational issues detected. Take action soon.'
                : '🚨 Critical issues found. Immediate attention required!'}
            </p>
          </div>
        </motion.div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(loading ? Array.from({ length: 6 }) : scores).map((item, i) => {
            if (loading) return (
              <div key={i} className="h-32 rounded-2xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
            );
            const s = item as ScoreItem;
            const Icon = s.icon;
            return (
              <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', s.color)}>
                    <Icon size={16} />
                  </div>
                  <span className={cn('text-2xl font-black', getColor(s.score))}>{s.score}</span>
                </div>
                <p className="text-sm font-bold text-surface-900 dark:text-surface-100 mb-1">{s.label}</p>
                <p className="text-xs text-surface-400 mb-2">{s.detail}</p>
                <div className="h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${s.score}%` }}
                    transition={{ delay: i * 0.08 + 0.3, duration: 0.8 }}
                    className={cn('h-full rounded-full', getBg(s.score))} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default HealthScore;
