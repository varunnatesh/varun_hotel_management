import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Plus, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const REASONS = ['Spoiled / Expired', 'Overcooked / Burned', 'Customer Return', 'Prep Waste', 'Damaged', 'Other'];

const KitchenWaste: React.FC = () => {
  const { user } = useAuthStore();
  const [logs,      setLogs]      = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [addOpen,   setAddOpen]   = useState(false);
  const [form,      setForm]      = useState({ material_id: '', quantity: '', reason: REASONS[0], notes: '' });
  const [saving,    setSaving]    = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const today = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    const [logsRes, matRes] = await Promise.all([
      supabase.from('waste_logs')
        .select('*, materials(name, unit)')
        .gte('date', today)
        .order('created_at', { ascending: false }),
      supabase.from('materials').select('id, name, unit, current_stock').order('name'),
    ]);
    if (logsRes.data) setLogs(logsRes.data);
    if (matRes.data)  setMaterials(matRes.data);
    setLoading(false);
  }, [today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.material_id || !form.quantity) { toast.error('Select a material and enter quantity'); return; }
    setSaving(true);

    const { error } = await supabase.from('waste_logs').insert({
      material_id: form.material_id,
      quantity:    parseFloat(form.quantity),
      reason:      `${form.reason}${form.notes ? ': ' + form.notes : ''}`,
      logged_by:   user!.id,
      date:        today,
    });

    if (error) { toast.error(error.message); setSaving(false); return; }

    // Deduct stock
    const mat = materials.find(m => m.id === form.material_id);
    if (mat) {
      const { error: stockErr } = await supabase.from('materials').update({
        current_stock: Math.max(0, Number(mat.current_stock) - parseFloat(form.quantity)),
      }).eq('id', form.material_id);
      if (stockErr) toast.error('Stock deduction failed: ' + stockErr.message);
    }

    toast.success('Wastage logged!');
    setForm({ material_id: '', quantity: '', reason: REASONS[0], notes: '' });
    setSaving(false);
    setAddOpen(false);
    fetchData();
  };

  const totalToday = logs.reduce((s, l) => s + Number(l.quantity), 0);

  return (
    <AppLayout title="Log Wastage" subtitle="Track food and material waste in the kitchen"
      actions={
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
          Log Waste
        </Button>
      }>
      <div className="space-y-4 pb-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/6">
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{logs.length}</p>
            <p className="text-xs text-red-500/80 font-medium mt-0.5">Waste Entries Today</p>
          </div>
          <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/6">
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{totalToday.toFixed(2)}</p>
            <p className="text-xs text-amber-500/80 font-medium mt-0.5">Total Qty Wasted</p>
          </div>
          <div className="p-4 rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800">
            <p className="text-xl font-bold text-surface-700 dark:text-surface-300">
              {new Set(logs.map(l => l.material_id)).size}
            </p>
            <p className="text-xs text-surface-400 font-medium mt-0.5">Unique Items Wasted</p>
          </div>
        </div>

        {/* Today's log */}
        <Card noPad>
          <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />
              <p className="font-semibold text-surface-900 dark:text-surface-100">Today's Waste Log</p>
            </div>
            <span className="text-xs text-surface-400">{new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
          </div>

          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-surface-400 gap-2">
              <CheckCircle size={28} className="text-emerald-400 opacity-50" />
              <p className="text-sm font-medium">No wastage logged today — great!</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {logs.map((log, i) => (
                <motion.div key={log.id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <Package size={14} className="text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                      {log.materials?.name ?? '—'}
                    </p>
                    <p className="text-xs text-surface-400 truncate">{log.reason}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-500">
                      −{Number(log.quantity).toFixed(2)} {log.materials?.unit}
                    </p>
                    <p className="text-[10px] text-surface-400">
                      {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Log Kitchen Waste" size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Material *</label>
            <select value={form.material_id} onChange={e => set('material_id', e.target.value)} required
              className="w-full px-3 py-2.5 rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm focus:ring-2 focus:ring-brand-500 outline-none">
              <option value="">Select material…</option>
              {materials.map(m => (
                <option key={m.id} value={m.id}>{m.name} (Stock: {Number(m.current_stock).toFixed(2)} {m.unit})</option>
              ))}
            </select>
          </div>
          <Input label="Quantity Wasted *" id="waste-qty" type="number" value={form.quantity}
            onChange={e => set('quantity', e.target.value)} placeholder="e.g. 0.5" min="0.01" step="0.01" required />
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Reason *</label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map(r => (
                <button key={r} type="button" onClick={() => set('reason', r)}
                  className={cn('px-3 py-2 rounded-xl text-xs font-medium text-left border transition-colors',
                    form.reason === r
                      ? 'border-red-500 bg-red-500/8 text-red-600 dark:text-red-400'
                      : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-700')}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <Input label="Notes (optional)" id="waste-notes" value={form.notes}
            onChange={e => set('notes', e.target.value)} placeholder="Any additional details…" />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" fullWidth onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" fullWidth loading={saving}
              className="bg-red-600 hover:bg-red-700 border-red-600" icon={<AlertTriangle size={14} />}>
              Log Wastage
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
};

export default KitchenWaste;
