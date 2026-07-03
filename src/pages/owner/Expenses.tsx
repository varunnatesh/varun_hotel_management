import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, Plus, Trash2, Calendar, TrendingDown,
  Zap, Droplets, Users, Home, Wrench, MoreHorizontal,
  Filter, BarChart3,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { KPICard } from '../../components/dashboard/KPICard';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const EXPENSE_CATEGORIES = [
  { value: 'electricity', label: 'Electricity',  icon: Zap,           color: 'bg-yellow-500/12 text-yellow-600 dark:text-yellow-400' },
  { value: 'lpg_gas',     label: 'LPG / Gas',    icon: Zap,           color: 'bg-orange-500/12 text-orange-600 dark:text-orange-400' },
  { value: 'salary',      label: 'Salaries',     icon: Users,         color: 'bg-brand-500/12 text-brand-600 dark:text-brand-400' },
  { value: 'rent',        label: 'Rent',         icon: Home,          color: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' },
  { value: 'maintenance', label: 'Maintenance',  icon: Wrench,        color: 'bg-amber-500/12 text-amber-600 dark:text-amber-400' },
  { value: 'water',       label: 'Water Bill',   icon: Droplets,      color: 'bg-teal-500/12 text-teal-600 dark:text-teal-400' },
  { value: 'other',       label: 'Other',        icon: MoreHorizontal, color: 'bg-surface-200 text-surface-500 dark:bg-surface-700' },
];

interface Expense {
  id:          string;
  category:    string;
  amount:      number;
  description: string;
  date:        string;
  created_at:  string;
}

const AddExpenseModal: React.FC<{ open: boolean; onClose: () => void; onAdd: (d: any) => Promise<void> }> = ({ open, onClose, onAdd }) => {
  const [form, setForm]   = useState({ category: 'electricity', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description) { toast.error('Fill all fields'); return; }
    setLoading(true);
    await onAdd({ ...form, amount: parseFloat(form.amount) });
    setLoading(false);
    setForm({ category: 'electricity', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    onClose();
  };

  const selectedCat = EXPENSE_CATEGORIES.find(c => c.value === form.category);

  return (
    <Modal open={open} onClose={onClose} title="Log Expense" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Category</label>
          <div className="grid grid-cols-2 gap-2">
            {EXPENSE_CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <button key={cat.value} type="button" onClick={() => set('category', cat.value)}
                  className={cn('flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all text-left',
                    form.category === cat.value
                      ? 'border-brand-500 bg-brand-500/8 ring-2 ring-brand-500/20'
                      : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700')}>
                  <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0', cat.color)}>
                    <Icon size={12} />
                  </div>
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Amount (₹)" id="exp-amount" type="number" value={form.amount}
            onChange={e => set('amount', e.target.value)} placeholder="e.g. 3500" min="1" step="1" required />
          <Input label="Date" id="exp-date" type="date" value={form.date}
            onChange={e => set('date', e.target.value)} required />
        </div>

        <Input label="Description" id="exp-desc" value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="e.g. EB bill for June" required />

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" fullWidth onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" fullWidth loading={loading} icon={<Plus size={14} />}>
            Log Expense
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Expenses Page ──────────────────────────────────────────────
const ExpensesPage: React.FC = () => {
  const { user }  = useAuthStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [addOpen,  setAddOpen]  = useState(false);
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const [y, m] = monthFilter.split('-').map(Number);
    const startDate = `${monthFilter}-01`;
    const endDate   = new Date(y, m, 0).toISOString().split('T')[0];

    const { data, error } = await supabase.from('expenses').select('*')
      .gte('date', startDate).lte('date', endDate)
      .order('date', { ascending: false });

    if (error) {
      toast.error('Cannot load expenses — run the GRANT SQL in Supabase (see console)');
      console.error('expenses error:', error.message, '\nRun in Supabase SQL Editor:\nGRANT ALL ON expenses TO anon, authenticated;');
    }
    if (data) setExpenses(data.map((e: any) => ({ ...e, amount: Number(e.amount) })));
    setLoading(false);
  }, [monthFilter]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleAdd = async (formData: any) => {
    // Try with added_by first, fall back without it
    const payload = { ...formData, added_by: user?.id };
    const { error } = await supabase.from('expenses').insert(payload);
    if (error) {
      // Try without added_by in case column doesn't exist
      if (error.message.includes('added_by') || error.message.includes('column')) {
        const { error: err2 } = await supabase.from('expenses').insert(formData);
        if (err2) { toast.error(err2.message); return; }
      } else if (error.message.includes('permission') || error.message.includes('policy')) {
        toast.error('Permission denied — run in Supabase SQL Editor: GRANT ALL ON expenses TO anon, authenticated;');
        return;
      } else {
        toast.error(error.message); return;
      }
    }
    toast.success('Expense logged!');
    fetchExpenses();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Expense removed');
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const totalAmount   = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory    = EXPENSE_CATEGORIES.map(cat => ({
    ...cat,
    total: expenses.filter(e => e.category === cat.value).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  return (
    <AppLayout title="Expenses" subtitle="Track all hotel running costs and overheads"
      actions={
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
          Log Expense
        </Button>
      }>
      <div className="space-y-5 pb-6">

        {/* Month Filter + Total */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-surface-400" />
            <input type="month" value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
          </div>
          <div className="px-4 py-2 rounded-xl bg-red-500/8 border border-red-500/20 flex items-center gap-2">
            <TrendingDown size={14} className="text-red-500" />
            <span className="text-sm text-surface-600 dark:text-surface-400">Total this month:</span>
            <span className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Expense List */}
          <div className="lg:col-span-2">
            <Card noPad>
              <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
                <p className="font-semibold text-surface-900 dark:text-surface-100">
                  {new Date(monthFilter + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </p>
                <span className="text-xs text-surface-400">{expenses.length} entries</span>
              </div>

              {loading ? (
                <div className="p-8 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : expenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-surface-400 gap-2">
                  <DollarSign size={28} className="opacity-30" />
                  <p className="text-sm">No expenses logged this month</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-100 dark:divide-surface-800">
                  {expenses.map((exp, i) => {
                    const cat = EXPENSE_CATEGORIES.find(c => c.value === exp.category);
                    const Icon = cat?.icon ?? MoreHorizontal;
                    return (
                      <motion.div key={exp.id}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/40 group">
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', cat?.color)}>
                          <Icon size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{exp.description}</p>
                          <p className="text-xs text-surface-400">
                            {cat?.label} • {new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-red-600 dark:text-red-400 mr-2">
                          −{formatCurrency(exp.amount)}
                        </span>
                        <button onClick={() => handleDelete(exp.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-surface-300 hover:text-red-500 transition-all">
                          <Trash2 size={13} />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* By Category Breakdown */}
          <div>
            <Card>
              <CardHeader title="By Category" icon={<BarChart3 size={15} />} iconBg="bg-brand-500/12 text-brand-600 dark:text-brand-400" />
              {byCategory.length === 0 ? (
                <p className="text-xs text-surface-400 text-center py-4">No data</p>
              ) : (
                <div className="space-y-3">
                  {byCategory.map(cat => {
                    const Icon = cat.icon;
                    const pct = totalAmount > 0 ? (cat.total / totalAmount) * 100 : 0;
                    return (
                      <div key={cat.value}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <div className={cn('w-5 h-5 rounded-md flex items-center justify-center', cat.color)}>
                              <Icon size={10} />
                            </div>
                            <span className="text-xs text-surface-600 dark:text-surface-400">{cat.label}</span>
                          </div>
                          <span className="text-xs font-bold text-surface-800 dark:text-surface-200">{formatCurrency(cat.total)}</span>
                        </div>
                        <div className="h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8 }}
                            className="h-full bg-brand-500 rounded-full" />
                        </div>
                        <p className="text-[10px] text-surface-400 mt-0.5">{pct.toFixed(1)}% of total</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <AddExpenseModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
    </AppLayout>
  );
};

export default ExpensesPage;
