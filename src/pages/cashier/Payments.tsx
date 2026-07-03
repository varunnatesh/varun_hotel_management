import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt, DollarSign, Clock, CheckCircle, Search,
  Banknote, Smartphone, CreditCard, Download, Filter,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { formatCurrency, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const METHOD_CONFIG = {
  cash: { icon: Banknote,    label: 'Cash',  color: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  upi:  { icon: Smartphone,  label: 'UPI',   color: 'bg-brand-500/12 text-brand-600 dark:text-brand-400' },
  card: { icon: CreditCard,  label: 'Card',  color: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' },
};

const CashierPayments: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [method,   setMethod]   = useState('all');
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    // Use IST offset (+05:30) to ensure correct day boundary for Indian time
    let query = supabase
      .from('payments')
      .select('*, orders(table_no, room_no), users(name)')
      .gte('timestamp', `${date}T00:00:00+05:30`)
      .lte('timestamp', `${date}T23:59:59+05:30`)
      .order('timestamp', { ascending: false });

    if (method !== 'all') query = query.eq('method', method);

    const { data, error } = await query;
    if (error) toast.error('Failed to load payments');
    if (data) setPayments(data.map((p: any) => ({ ...p, amount: Number(p.amount) })));
    setLoading(false);
  }, [date, method]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const filtered = search
    ? payments.filter(p =>
        p.id.toLowerCase().includes(search.toLowerCase()) ||
        String(p.orders?.table_no).includes(search))
    : payments;

  const total     = filtered.reduce((s, p) => s + p.amount, 0);
  const cashTotal = filtered.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
  const upiTotal  = filtered.filter(p => p.method === 'upi').reduce((s, p) => s + p.amount, 0);
  const cardTotal = filtered.filter(p => p.method === 'card').reduce((s, p) => s + p.amount, 0);

  return (
    <AppLayout title="Payments" subtitle="Today's collected payments and settlement summary"
      actions={
        <Button variant="ghost" size="sm" icon={<Download size={14} />}
          onClick={() => toast.success('Export coming soon!')}>Export</Button>
      }>
      <div className="space-y-4 pb-6">

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-brand-500 outline-none" />
          {(['all', 'cash', 'upi', 'card'] as const).map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors',
                method === m
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-50')}>
              {m === 'all' ? 'All Methods' : m.toUpperCase()}
            </button>
          ))}
          <div className="ml-auto w-48">
            <Input id="pay-search" placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)} icon={<Search size={13} />} />
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Collected', value: total,     color: 'bg-brand-500/8 border-brand-500/20 text-brand-600 dark:text-brand-400' },
            { label: 'Cash',           value: cashTotal,  color: 'bg-emerald-500/8 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
            { label: 'UPI',            value: upiTotal,   color: 'bg-blue-500/8 border-blue-500/20 text-blue-600 dark:text-blue-400' },
            { label: 'Card',           value: cardTotal,  color: 'bg-violet-500/8 border-violet-500/20 text-violet-600 dark:text-violet-400' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn('p-4 rounded-2xl border', s.color)}>
              <p className="text-xl font-bold">{formatCurrency(s.value)}</p>
              <p className="text-xs opacity-75 mt-0.5 font-medium">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Payments table */}
        <Card noPad>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-100 dark:border-surface-800">
                  {['Receipt #', 'Table', 'Method', 'Amount', 'Change Given', 'Time', 'Cashier'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-surface-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-surface-200 dark:bg-surface-700 rounded animate-pulse w-3/4" />
                      </td>
                    ))}</tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-surface-400 text-sm">
                    No payments found for this date
                  </td></tr>
                ) : (
                  filtered.map((p, i) => {
                    const mc = METHOD_CONFIG[p.method as keyof typeof METHOD_CONFIG];
                    const Icon = mc?.icon ?? Receipt;
                    return (
                      <motion.tr key={p.id}
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400">
                            #{p.id.slice(-6).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-400">
                          {p.orders?.table_no ? `Table ${p.orders.table_no}` : p.orders?.room_no ? `Room ${p.orders.room_no}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg capitalize', mc?.color ?? 'bg-surface-100 text-surface-500')}>
                            <Icon size={11} />
                            {mc?.label ?? p.method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-surface-900 dark:text-surface-100">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-surface-500">
                          {p.change_given > 0 ? formatCurrency(p.change_given) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-surface-400">
                          {new Date(p.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-xs text-surface-500">
                          {p.users?.name ?? '—'}
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default CashierPayments;
