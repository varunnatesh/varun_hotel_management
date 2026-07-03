import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Plus, Clock, CheckCircle, XCircle,
  Send, AlertTriangle, ChefHat,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatElapsed, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',   icon: Clock },
  approved: { label: 'Approved', color: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-500/12 text-red-500',                            icon: XCircle },
};

const RequestStock: React.FC = () => {
  const { user } = useAuthStore();
  const [requests,  setRequests]  = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [addOpen,   setAddOpen]   = useState(false);
  const [form,      setForm]      = useState({ material_id: '', quantity: '', urgency: 'normal', notes: '' });
  const [saving,    setSaving]    = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const fetchData = useCallback(async () => {
    const [reqRes, matRes] = await Promise.all([
      supabase.from('approval_requests')
        .select('*, requested_by:users(name)')
        .eq('type', 'material_purchase')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('materials').select('id, name, unit, current_stock').order('name'),
    ]);
    if (reqRes.data)  setRequests(reqRes.data);
    if (matRes.data)  setMaterials(matRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.material_id || !form.quantity) { toast.error('Select material and enter quantity'); return; }
    setSaving(true);
    const mat = materials.find(m => m.id === form.material_id);

    const { error } = await supabase.from('approval_requests').insert({
      type:         'material_purchase',
      status:       'pending',
      requested_by: user!.id,
      details: {
        material_id:   form.material_id,
        material_name: mat?.name,
        unit:          mat?.unit,
        quantity:      parseFloat(form.quantity),
        urgency:       form.urgency,
        notes:         form.notes,
        current_stock: Number(mat?.current_stock),
      },
    });

    if (error) { toast.error(error.message); setSaving(false); return; }

    // Create alert for store manager
    await supabase.from('alerts').insert({
      type:     'purchase_approval',
      severity: form.urgency === 'urgent' ? 'critical' : 'warning',
      message:  `🍳 Kitchen requests ${form.quantity} ${mat?.unit} of ${mat?.name}${form.urgency === 'urgent' ? ' — URGENT!' : ''}`,
      metadata: { from: 'kitchen', material: mat?.name },
    });

    toast.success('Request sent to Store Manager!');
    setForm({ material_id: '', quantity: '', urgency: 'normal', notes: '' });
    setSaving(false);
    setAddOpen(false);
    fetchData();
  };

  return (
    <AppLayout title="Request Stock" subtitle="Send stock requests to the Store Manager"
      actions={
        <Button variant="primary" size="sm" icon={<Send size={14} />} onClick={() => setAddOpen(true)}>
          New Request
        </Button>
      }>
      <div className="space-y-4 pb-6">

        {/* Status Summary */}
        <div className="grid grid-cols-3 gap-3">
          {(['pending', 'approved', 'rejected'] as const).map(s => {
            const cfg = STATUS_CONFIG[s];
            const count = requests.filter(r => r.status === s).length;
            return (
              <div key={s} className={cn('p-4 rounded-2xl border', cfg.color.replace('text-', 'border-').split(' ')[0] + '/20', cfg.color.split(' ')[0])}>
                <p className="text-xl font-bold">{count}</p>
                <p className="text-xs font-medium opacity-80 mt-0.5">{cfg.label}</p>
              </div>
            );
          })}
        </div>

        {/* Request list */}
        <Card noPad>
          <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700">
            <p className="font-semibold text-surface-900 dark:text-surface-100">My Requests</p>
          </div>
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-2 text-surface-400">
              <Package size={28} className="opacity-30" />
              <p className="text-sm">No requests yet. Click "New Request" to ask for materials.</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              <AnimatePresence>
                {requests.map((req, i) => {
                  const st = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                  const Icon = st.icon;
                  const d = req.details ?? {};
                  return (
                    <motion.div key={req.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-50 dark:hover:bg-surface-800/40">
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', st.color)}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                              {d.quantity} {d.unit} of {d.material_name ?? '—'}
                            </p>
                            <p className="text-xs text-surface-400 mt-0.5">
                              {d.urgency === 'urgent' ? '🔴 Urgent • ' : ''}
                              {d.notes || 'No notes'} • {formatElapsed(req.created_at)}
                            </p>
                          </div>
                          <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-lg capitalize whitespace-nowrap', st.color)}>
                            {st.label}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </Card>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Request Stock from Store" size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Material *</label>
            <select value={form.material_id} onChange={e => set('material_id', e.target.value)} required
              className="w-full px-3 py-2.5 rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm focus:ring-2 focus:ring-brand-500 outline-none">
              <option value="">Select material…</option>
              {materials.map(m => (
                <option key={m.id} value={m.id}>{m.name} (Current: {Number(m.current_stock).toFixed(1)} {m.unit})</option>
              ))}
            </select>
          </div>
          <Input label="Quantity Needed *" id="req-qty" type="number" value={form.quantity}
            onChange={e => set('quantity', e.target.value)} placeholder="e.g. 5" min="0.1" step="0.1" required />
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Urgency</label>
            <div className="flex gap-2">
              {[{ k: 'normal', label: '🟢 Normal' }, { k: 'urgent', label: '🔴 Urgent' }].map(u => (
                <button key={u.k} type="button" onClick={() => set('urgency', u.k)}
                  className={cn('flex-1 py-2 rounded-xl text-sm font-medium border transition-colors',
                    form.urgency === u.k
                      ? 'border-brand-500 bg-brand-500/8 text-brand-600 dark:text-brand-400'
                      : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-700')}>
                  {u.label}
                </button>
              ))}
            </div>
          </div>
          <Input label="Notes (optional)" id="req-notes" value={form.notes}
            onChange={e => set('notes', e.target.value)} placeholder="Why do you need this?" />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" fullWidth onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" fullWidth loading={saving} icon={<Send size={14} />}>
              Send Request
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
};

export default RequestStock;
