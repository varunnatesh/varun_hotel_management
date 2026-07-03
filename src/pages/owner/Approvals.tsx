import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, X, Clock, DollarSign, ShoppingBag,
  Package, Tag, AlertTriangle, RefreshCw, Eye,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, formatElapsed, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

// ─── Types ─────────────────────────────────────────────────────
interface ApprovalRequest {
  id:           string;
  type:         string;
  status:       string;
  details:      Record<string, any>;
  created_at:   string;
  requested_by: string;
  users?:       { name: string; role: string };
}

interface DiscountRequest {
  id:          string;
  order_id:    string;
  amount:      number;
  reason:      string;
  status:      string;
  timestamp:   string;
  requested_by: string;
  users?:      { name: string };
  orders?:     { table_no: string; total_amount: number };
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  material_purchase: { icon: Package,      label: 'Purchase Request', color: 'bg-blue-500/12 text-blue-600 dark:text-blue-400' },
  price_change:      { icon: Tag,          label: 'Price Change',     color: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' },
  large_discount:    { icon: DollarSign,   label: 'Large Discount',   color: 'bg-amber-500/12 text-amber-600 dark:text-amber-400' },
  order_cancellation:{ icon: ShoppingBag,  label: 'Cancellation',     color: 'bg-red-500/12 text-red-600 dark:text-red-400' },
  new_menu_item:     { icon: CheckCircle,  label: 'Menu Item',        color: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
};

// ─── Appprovals Page ────────────────────────────────────────────
const ApprovalsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [approvals,  setApprovals]  = useState<ApprovalRequest[]>([]);
  const [discounts,  setDiscounts]  = useState<DiscountRequest[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [detailItem, setDetailItem] = useState<ApprovalRequest | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [apprRes, discRes] = await Promise.all([
      supabase.from('approval_requests').select('*, users(name, role)')
        .eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('discounts').select('*, users!requested_by(name), orders(table_no, total_amount)')
        .eq('status', 'pending').order('timestamp', { ascending: false }),
    ]);
    if (apprRes.data) setApprovals(apprRes.data as ApprovalRequest[]);
    if (discRes.data) setDiscounts(discRes.data as DiscountRequest[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleApproval = async (id: string, status: 'approved' | 'rejected') => {
    setProcessing(id);
    const { error } = await supabase.from('approval_requests')
      .update({ status, approved_by: user!.id, resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error(error.message); setProcessing(null); return; }
    toast.success(status === 'approved' ? '✅ Request approved!' : '❌ Request rejected');
    setApprovals(a => a.filter(x => x.id !== id));
    setProcessing(null);
  };

  const handleDiscount = async (id: string, status: 'approved' | 'rejected') => {
    setProcessing(id);
    const { error } = await supabase.from('discounts')
      .update({ status, approved_by: user!.id }).eq('id', id);
    if (error) { toast.error(error.message); setProcessing(null); return; }
    toast.success(status === 'approved' ? '✅ Discount approved!' : '❌ Discount rejected');
    setDiscounts(d => d.filter(x => x.id !== id));
    setProcessing(null);
  };

  const totalPending = approvals.length + discounts.length;

  return (
    <AppLayout title="Approvals" subtitle="Review and act on pending requests from your team"
      actions={
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={fetchAll}>
          Refresh
        </Button>
      }>
      <div className="space-y-5 pb-6">

        {/* Empty state */}
        {!loading && totalPending === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/12 flex items-center justify-center">
              <CheckCircle size={28} className="text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="font-bold text-surface-900 dark:text-surface-100 text-lg">All caught up!</p>
              <p className="text-sm text-surface-400 mt-1">No pending approvals — great job keeping up.</p>
            </div>
          </motion.div>
        )}

        {/* ── Discount Requests ── */}
        {(loading || discounts.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-surface-900 dark:text-surface-100">
                Discount Requests
              </h2>
              {discounts.length > 0 && (
                <span className="text-xs bg-amber-500/12 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold border border-amber-500/20">
                  {discounts.length} pending
                </span>
              )}
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {loading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-2xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
                  ))
                ) : discounts.map((disc, i) => (
                  <motion.div key={disc.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }} transition={{ delay: i * 0.06 }}
                    className="rounded-2xl border border-amber-500/20 bg-amber-500/4 dark:bg-surface-800 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/12 flex items-center justify-center flex-shrink-0">
                          <DollarSign size={16} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-surface-900 dark:text-surface-100">
                              {formatCurrency(disc.amount)} Discount
                            </span>
                            <span className="text-xs text-surface-400">
                              on {disc.orders?.table_no ? `Table ${disc.orders.table_no}` : 'order'}
                            </span>
                          </div>
                          <p className="text-xs text-surface-500 mt-0.5">{disc.reason}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-surface-400">
                              Requested by {disc.users?.name ?? 'Staff'} • {formatElapsed(disc.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button variant="outline" size="xs"
                          className="border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                          icon={<X size={12} />}
                          loading={processing === disc.id}
                          onClick={() => handleDiscount(disc.id, 'rejected')}>
                          Reject
                        </Button>
                        <Button variant="primary" size="xs"
                          icon={<CheckCircle size={12} />}
                          loading={processing === disc.id}
                          onClick={() => handleDiscount(disc.id, 'approved')}>
                          Approve
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ── General Approval Requests ── */}
        {(loading || approvals.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-surface-900 dark:text-surface-100">
                Other Requests
              </h2>
              {approvals.length > 0 && (
                <span className="text-xs bg-brand-500/12 text-brand-600 dark:text-brand-400 px-2 py-0.5 rounded-full font-semibold border border-brand-500/20">
                  {approvals.length} pending
                </span>
              )}
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {loading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-2xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
                  ))
                ) : approvals.map((req, i) => {
                  const config = TYPE_CONFIG[req.type] ?? TYPE_CONFIG.material_purchase;
                  const Icon   = config.icon;
                  return (
                    <motion.div key={req.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }} transition={{ delay: i * 0.06 }}
                      className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', config.color)}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-surface-900 dark:text-surface-100">
                                {config.label}
                              </span>
                            </div>
                            <p className="text-xs text-surface-500 mt-0.5">
                              {JSON.stringify(req.details).slice(0, 80)}…
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] text-surface-400">
                                By {req.users?.name ?? 'Staff'} • {formatElapsed(req.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button variant="ghost" size="xs" icon={<Eye size={12} />}
                            onClick={() => setDetailItem(req)}>
                            View
                          </Button>
                          <Button variant="outline" size="xs"
                            className="border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                            icon={<X size={12} />}
                            loading={processing === req.id}
                            onClick={() => handleApproval(req.id, 'rejected')}>
                            Reject
                          </Button>
                          <Button variant="primary" size="xs"
                            icon={<CheckCircle size={12} />}
                            loading={processing === req.id}
                            onClick={() => handleApproval(req.id, 'approved')}>
                            Approve
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal open={!!detailItem} onClose={() => setDetailItem(null)} title="Request Details" size="sm">
        {detailItem && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/40 text-sm">
              <pre className="text-xs text-surface-600 dark:text-surface-400 whitespace-pre-wrap break-all">
                {JSON.stringify(detailItem.details, null, 2)}
              </pre>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" fullWidth icon={<X size={13} />}
                className="border-red-500/30 text-red-600 hover:bg-red-500/10"
                onClick={() => { handleApproval(detailItem.id, 'rejected'); setDetailItem(null); }}>
                Reject
              </Button>
              <Button variant="primary" fullWidth icon={<CheckCircle size={13} />}
                onClick={() => { handleApproval(detailItem.id, 'approved'); setDetailItem(null); }}>
                Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
};

export default ApprovalsPage;
