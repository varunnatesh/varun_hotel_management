import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  today_revenue: number;
  today_orders: number;
  today_profit: number;
  active_orders: number;
  low_stock_count: number;
  pending_approvals: number;
  revenue_trend: number;
  orders_trend: number;
  profit_trend: number;
}

const DEFAULT_STATS: DashboardStats = {
  today_revenue: 0, today_orders: 0, today_profit: 0,
  active_orders: 0, low_stock_count: 0, pending_approvals: 0,
  revenue_trend: 0, orders_trend: 0, profit_trend: 0,
};

export function useDashboardStats() {
  const [stats, setStats]       = useState<DashboardStats>(DEFAULT_STATS);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const today     = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      // Today's orders
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at')
        .gte('created_at', `${today}T00:00:00`)
        .neq('status', 'cancelled');

      // Yesterday's orders (for trend)
      const { data: yestOrders } = await supabase
        .from('orders')
        .select('id, total_amount')
        .gte('created_at', `${yesterday}T00:00:00`)
        .lt('created_at', `${today}T00:00:00`)
        .neq('status', 'cancelled');

      // Active orders (on floor right now)
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id')
        .in('status', ['pending', 'preparing', 'ready']);

      // Payments for today (actual collected revenue)
      const { data: todayPayments } = await supabase
        .from('payments')
        .select('amount')
        .gte('timestamp', `${today}T00:00:00`);

      // Yesterday payments
      const { data: yestPayments } = await supabase
        .from('payments')
        .select('amount')
        .gte('timestamp', `${yesterday}T00:00:00`)
        .lt('timestamp', `${today}T00:00:00`);

      // Low stock materials — fetch all and filter in JS (Supabase JS can't compare two columns)
      const { data: materials } = await supabase
        .from('materials')
        .select('id, current_stock, min_stock_level');

      // Pending approvals
      const { data: approvals } = await supabase
        .from('approval_requests')
        .select('id')
        .eq('status', 'pending');

      // Today's material issues (approximate material cost)
      const { data: todayIssues } = await supabase
        .from('material_issues')
        .select('material_id, quantity, materials(cost_per_unit)')
        .eq('date', today);

      // Calculate totals
      const todayRevenue  = todayPayments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
      const yestRevenue   = yestPayments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
      const todayOrderCnt = todayOrders?.length ?? 0;
      const yestOrderCnt  = yestOrders?.length ?? 0;

      // Rough material cost from issues
      const materialCost  = todayIssues?.reduce((s: number, issue: any) => {
        const cost = Number(issue.materials?.cost_per_unit ?? 0);
        return s + (Number(issue.quantity) * cost);
      }, 0) ?? 0;

      const todayProfit   = todayRevenue - materialCost;
      const yestProfit    = yestRevenue * 0.6; // estimate

      const calcTrend = (today: number, yesterday: number) =>
        yesterday === 0 ? 0 : ((today - yesterday) / yesterday) * 100;

      setStats({
        today_revenue:     todayRevenue,
        today_orders:      todayOrderCnt,
        today_profit:      todayProfit,
        active_orders:     activeOrders?.length ?? 0,
        low_stock_count:   (materials ?? []).filter(m => Number(m.current_stock) < Number(m.min_stock_level)).length,
        pending_approvals: approvals?.length ?? 0,
        revenue_trend:     calcTrend(todayRevenue, yestRevenue),
        orders_trend:      calcTrend(todayOrderCnt, yestOrderCnt),
        profit_trend:      calcTrend(todayProfit, yestProfit),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, isLoading, error, refetch: fetchStats };
}
