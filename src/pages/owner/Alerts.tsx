import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Package, ShoppingBag, DollarSign, Shield,
  Bell, CheckCircle, X, Eye, RefreshCw, Filter, Clock,
  Zap, TrendingUp, AlertCircle,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatElapsed, cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ─────────────────────────────────────────────────────
interface Alert {
  id:         string;
  type:       string;
  message:    string;
  severity:   'info' | 'warning' | 'critical';
  is_seen:    boolean;
  created_at: string;
  metadata:   Record<string, any>;
}

const ALERT_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  unusual_usage:    { icon: TrendingUp,     label: 'Unusual Usage' },
  unbilled_order:   { icon: ShoppingBag,    label: 'Unbilled Order' },
  price_tampering:  { icon: DollarSign,     label: 'Price Tampering' },
  large_discount:   { icon: DollarSign,     label: 'Large Discount' },
  low_stock:        { icon: Package,        label: 'Low Stock' },
  critical_stock:   { icon: Package,        label: 'Critical Stock' },
  purchase_approval:{ icon: CheckCircle,    label: 'Purchase Approval' },
  system:           { icon: Bell,           label: 'System' },
};

const SEVERITY_CONFIG = {
  critical: {
    card:   'border-l-red-500 bg-red-500/4',
    badge:  'bg-red-500/12 text-red-600 dark:text-red-400 border border-red-500/20',
    icon:   'bg-red-500/12 text-red-500',
    dot:    'bg-red-500',
    pulse:  true,
  },
  warning: {
    card:   'border-l-amber-500 bg-amber-500/4',
    badge:  'bg-amber-500/12 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    icon:   'bg-amber-500/12 text-amber-500',
    dot:    'bg-amber-500',
    pulse:  false,
  },
  info: {
    card:   'border-l-blue-500 bg-blue-500/4',
    badge:  'bg-blue-500/12 text-blue-600 dark:text-blue-400 border border-blue-500/20',
    icon:   'bg-blue-500/12 text-blue-500',
    dot:    'bg-blue-400',
    pulse:  false,
  },
};

// ─── Alert Card ─────────────────────────────────────────────────
const AlertCard: React.FC<{
  alert:        Alert;
  onMarkSeen:   (id: string) => void;
  onDismiss:    (id: string) => void;
}> = ({ alert, onMarkSeen, onDismiss }) => {
  const config   = ALERT_CONFIG[alert.type]   ?? ALERT_CONFIG.system;
  const severity = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info;
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12, height: 0 }}
      className={cn(
        'flex items-start gap-3 px-4 py-3.5 border-l-2 transition-colors',
        severity.card,
        !alert.is_seen && 'font-[450]',
      )}
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5', severity.icon)}>
        <Icon size={16} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md', severity.badge)}>
            {severity.pulse && (
              <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', severity.dot)} />
            )}
            {alert.severity.toUpperCase()}
          </span>
          <span className="text-[10px] text-surface-400 uppercase tracking-wide">{config.label}</span>
          {!alert.is_seen && (
            <span className="w-2 h-2 rounded-full bg-brand-500 mt-0.5 flex-shrink-0" />
          )}
        </div>
        <p className={cn('text-sm mt-1', alert.is_seen ? 'text-surface-500 dark:text-surface-400' : 'text-surface-900 dark:text-surface-100')}>
          {alert.message}
        </p>
        <p className="text-[10px] text-surface-400 mt-1">{formatElapsed(alert.created_at)}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {!alert.is_seen && (
          <button onClick={() => onMarkSeen(alert.id)}
            className="p-1.5 rounded-lg text-surface-400 hover:text-brand-500 hover:bg-brand-500/10 transition-colors"
            title="Mark as seen">
            <Eye size={13} />
          </button>
        )}
        <button onClick={() => onDismiss(alert.id)}
          className="p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          title="Dismiss">
          <X size={13} />
        </button>
      </div>
    </motion.div>
  );
};

// ─── Run Stock Check ────────────────────────────────────────────
async function runStockAlertCheck() {
  const { data: materials } = await supabase
    .from('materials').select('id, name, current_stock, min_stock_level, avg_daily_usage, unit');

  if (!materials) return;
  for (const m of materials) {
    const stock = Number(m.current_stock);
    const min   = Number(m.min_stock_level);
    const daily = Number(m.avg_daily_usage);
    const days  = daily > 0 ? stock / daily : 999;

    if (stock <= 0 || days < 1) {
      await supabase.from('alerts').insert({
        type: 'critical_stock', severity: 'critical',
        message: `🚨 ${m.name} is OUT OF STOCK — immediate reorder needed!`,
        metadata: { material_id: m.id, current: stock, unit: m.unit },
      }).then(() => {});
    } else if (stock <= min || days < 3) {
      await supabase.from('alerts').insert({
        type: 'low_stock', severity: 'warning',
        message: `⚠️ ${m.name} running low — ${stock} ${m.unit} left (~${Math.floor(days)} days)`,
        metadata: { material_id: m.id, current: stock, min, unit: m.unit },
      }).then(() => {});
    }
  }
}

// ─── Alerts Page ────────────────────────────────────────────────
const AlertsPage: React.FC = () => {
  const [alerts,    setAlerts]    = useState<Alert[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<'all' | 'unread' | 'critical' | 'warning' | 'info'>('all');
  const [running,   setRunning]   = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('alerts').select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setAlerts(data as Alert[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlerts();
    channelRef.current = supabase.channel('alerts-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, () => fetchAlerts())
      .subscribe();
    return () => { channelRef.current?.unsubscribe(); };
  }, [fetchAlerts]);

  const markSeen = async (id: string) => {
    await supabase.from('alerts').update({ is_seen: true }).eq('id', id);
    setAlerts(a => a.map(x => x.id === id ? { ...x, is_seen: true } : x));
  };

  const markAllSeen = async () => {
    await supabase.from('alerts').update({ is_seen: true }).eq('is_seen', false);
    setAlerts(a => a.map(x => ({ ...x, is_seen: true })));
    toast.success('All alerts marked as seen');
  };

  const dismiss = async (id: string) => {
    await supabase.from('alerts').delete().eq('id', id);
    setAlerts(a => a.filter(x => x.id !== id));
  };

  const runCheck = async () => {
    setRunning(true);
    await runStockAlertCheck();
    await fetchAlerts();
    setRunning(false);
    toast.success('Stock check complete — alerts generated!');
  };

  const filtered = alerts.filter(a => {
    if (filter === 'unread')   return !a.is_seen;
    if (filter === 'critical') return a.severity === 'critical';
    if (filter === 'warning')  return a.severity === 'warning';
    if (filter === 'info')     return a.severity === 'info';
    return true;
  });

  const unreadCount  = alerts.filter(a => !a.is_seen).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;

  return (
    <AppLayout title="Fraud & Alerts" subtitle="Real-time fraud detection and operational alerts"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm"
            icon={<Zap size={14} className={running ? 'animate-spin' : ''} />}
            onClick={runCheck} loading={running}>
            Run Stock Check
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" icon={<Eye size={14} />} onClick={markAllSeen}>
              Mark All Read
            </Button>
          )}
        </div>
      }>
      <div className="space-y-5 pb-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Alerts',    value: alerts.length,    color: 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700', text: 'text-surface-900 dark:text-surface-100' },
            { label: 'Unread',          value: unreadCount,       color: 'bg-brand-500/8 border-brand-500/20', text: 'text-brand-600 dark:text-brand-400' },
            { label: 'Critical',        value: criticalCount,     color: 'bg-red-500/8 border-red-500/20',   text: 'text-red-600 dark:text-red-400' },
            { label: 'Warnings',        value: alerts.filter(a => a.severity === 'warning').length, color: 'bg-amber-500/8 border-amber-500/20', text: 'text-amber-600 dark:text-amber-400' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn('p-4 rounded-2xl border', s.color)}>
              <p className={cn('text-2xl font-bold', s.text)}>{s.value}</p>
              <p className="text-xs text-surface-500 mt-0.5 font-medium">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'unread', 'critical', 'warning', 'info'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-colors',
                filter === f
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-700')}>
              {f === 'all' ? `All (${alerts.length})` :
               f === 'unread' ? `Unread (${unreadCount})` :
               f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Alerts list */}
        <Card noPad>
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-surface-400 gap-3">
              <Shield size={32} className="opacity-30" />
              <p className="text-sm font-medium">
                {filter === 'all' ? 'No alerts yet — system is clean!' : `No ${filter} alerts`}
              </p>
              <Button variant="ghost" size="sm" icon={<Zap size={13} />} onClick={runCheck}>
                Run stock check to generate alerts
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              <AnimatePresence>
                {filtered.map(alert => (
                  <AlertCard key={alert.id} alert={alert} onMarkSeen={markSeen} onDismiss={dismiss} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default AlertsPage;
