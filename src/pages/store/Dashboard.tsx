import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, TrendingDown, AlertTriangle, Plus, ArrowRight,
  Search, Filter, RefreshCw, CheckCircle, Clock, Zap,
  ShoppingCart, RotateCcw, BarChart3,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { KPICard } from '../../components/dashboard/KPICard';
import { useMaterials } from '../../hooks/useMaterials';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

// ─── Stock Status Config ───────────────────────────────────────
const STATUS_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-500/12 text-red-600 dark:text-red-400 border border-red-500/20', bar: 'bg-red-500', dot: 'bg-red-500' },
  low:      { label: 'Low',      color: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 border border-amber-500/20', bar: 'bg-amber-500', dot: 'bg-amber-500' },
  ok:       { label: 'In Stock', color: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
};

// ─── Issue Modal ───────────────────────────────────────────────
interface IssueMaterialModalProps {
  open:           boolean;
  onClose:        () => void;
  onIssue:        (materialId: string, qty: number, notes: string) => Promise<void>;
  materials:      any[];
  preSelectedId?: string;
}

const IssueMaterialModal: React.FC<IssueMaterialModalProps> = ({ open, onClose, onIssue, materials, preSelectedId }) => {
  const [selectedId, setSelectedId] = useState(preSelectedId ?? '');
  const [quantity,   setQuantity]   = useState('');
  const [notes,      setNotes]      = useState('');
  const [loading,    setLoading]    = useState(false);

  // Update pre-selection when prop changes (e.g. row Issue button)
  React.useEffect(() => { if (preSelectedId) setSelectedId(preSelectedId); }, [preSelectedId]);

  const selected = materials.find(m => m.id === selectedId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !quantity) return;
    const qty = parseFloat(quantity);
    if (qty <= 0 || qty > (selected?.current_stock ?? 0)) {
      toast.error('Invalid quantity');
      return;
    }
    setLoading(true);
    await onIssue(selectedId, qty, notes);
    setLoading(false);
    setSelectedId(''); setQuantity(''); setNotes('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Issue Material to Kitchen" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Material selector */}
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
            Select Material
          </label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            required
            className="w-full px-3 py-2.5 rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          >
            <option value="">-- Choose material --</option>
            {materials.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.current_stock} {m.unit} available)
              </option>
            ))}
          </select>
        </div>

        {/* Stock indicator */}
        {selected && (
          <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-xs', (STATUS_CONFIG[(selected.stock_status as keyof typeof STATUS_CONFIG) ?? 'ok'] ?? STATUS_CONFIG.ok).color)}>
            <AlertTriangle size={12} />
            Current stock: <strong>{selected.current_stock} {selected.unit}</strong>
            &nbsp;• ~{selected.days_remaining} days remaining
          </div>
        )}

        {/* Quantity */}
        <Input
          label={`Quantity ${selected ? `(${selected.unit})` : ''}`}
          type="number"
          id="issue-qty"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          placeholder="e.g. 2.5"
          min="0.001"
          step="0.001"
          max={selected?.current_stock}
          required
        />

        {/* Notes */}
        <Input
          label="Notes (optional)"
          id="issue-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Purpose of issue..."
        />

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" fullWidth onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" fullWidth loading={loading}
            icon={<CheckCircle size={14} />}>
            Issue Material
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Add Purchase Modal ────────────────────────────────────────
interface AddPurchaseModalProps {
  open:      boolean;
  onClose:   () => void;
  onAdd:     (data: any) => Promise<void>;
  materials: any[];
}

const AddPurchaseModal: React.FC<AddPurchaseModalProps> = ({ open, onClose, onAdd, materials }) => {
  const [form, setForm] = useState({
    materialId: '', quantity: '', costPerUnit: '',
    supplierName: '', billNumber: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const selected = materials.find(m => m.id === form.materialId);
  const totalCost = (parseFloat(form.quantity) || 0) * (parseFloat(form.costPerUnit) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onAdd({
      materialId:   form.materialId,
      quantity:     parseFloat(form.quantity),
      costPerUnit:  parseFloat(form.costPerUnit),
      supplierName: form.supplierName,
      billNumber:   form.billNumber,
    });
    setLoading(false);
    setForm({ materialId: '', quantity: '', costPerUnit: '', supplierName: '', billNumber: '' });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Log New Purchase" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Material</label>
          <select
            value={form.materialId}
            onChange={e => set('materialId', e.target.value)}
            required
            className="w-full px-3 py-2.5 rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
          >
            <option value="">-- Choose material --</option>
            {materials.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label={`Quantity${selected ? ` (${selected.unit})` : ''}`} type="number" id="buy-qty"
            value={form.quantity} onChange={e => set('quantity', e.target.value)}
            placeholder="e.g. 10" min="0" step="0.001" required />
          <Input label="Cost per unit (₹)" type="number" id="buy-cpu"
            value={form.costPerUnit} onChange={e => set('costPerUnit', e.target.value)}
            placeholder="e.g. 130" min="0" step="0.01" required />
        </div>

        {totalCost > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-500/8 border border-brand-500/20 text-sm">
            <span className="text-surface-500">Total cost:</span>
            <span className="font-bold text-brand-600 dark:text-brand-400">{formatCurrency(totalCost)}</span>
          </div>
        )}

        <Input label="Supplier Name" id="buy-supplier" value={form.supplierName}
          onChange={e => set('supplierName', e.target.value)} placeholder="e.g. Sharma Traders" required />
        <Input label="Bill / Invoice Number" id="buy-bill" value={form.billNumber}
          onChange={e => set('billNumber', e.target.value)} placeholder="e.g. INV-2024-001" />

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" fullWidth onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" fullWidth loading={loading}
            icon={<ShoppingCart size={14} />}>
            Log Purchase
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Store Dashboard ───────────────────────────────────────────
const StoreDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { materials, lowStock, critical, isLoading, refetch, issueMaterial, addPurchase } = useMaterials();

  const [search,           setSearch]           = useState('');
  const [filterStatus,     setFilterStatus]     = useState<'all' | 'critical' | 'low' | 'ok'>('all');
  const [issueOpen,        setIssueOpen]        = useState(false);
  const [purchaseOpen,     setPurchaseOpen]     = useState(false);
  const [refreshing,       setRefreshing]       = useState(false);
  const [issueMaterialId,  setIssueMaterialId]  = useState('');

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleIssue = async (materialId: string, qty: number, notes: string) => {
    const { error } = await issueMaterial(materialId, qty, user!.id, user!.id, notes);
    if (error) toast.error(error);
    else toast.success('Material issued to kitchen!');
  };

  const handlePurchase = async (data: any) => {
    const { error } = await addPurchase({ ...data, purchasedBy: user!.id });
    if (error) toast.error(error);
    else toast.success('Purchase logged & stock updated!');
  };

  const filtered = materials.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filterStatus === 'all' || m.stock_status === filterStatus;
    return matchSearch && matchFilter;
  });

  const totalStockValue = materials.reduce((s, m) => s + m.current_stock * m.cost_per_unit, 0);

  return (
    <AppLayout>
      <div className="space-y-5 pb-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Stock Management</h1>
            <p className="text-sm text-surface-500 mt-0.5">Monitor inventory, issue materials, log purchases</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />} onClick={handleRefresh}>
              Refresh
            </Button>
            <Button variant="outline" size="sm" icon={<RotateCcw size={14} />}
              onClick={() => toast('Returns feature coming soon!', { icon: '🔜' })}>
              Returns
            </Button>
            <Button variant="outline" size="sm" icon={<ShoppingCart size={14} />} onClick={() => setPurchaseOpen(true)}>
              Log Purchase
            </Button>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setIssueOpen(true)}>
              Issue to Kitchen
            </Button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Total Materials" value={materials.length} trendLabel="in inventory"
            icon={<Package size={16} className="text-brand-500" />} iconBg="bg-brand-500/12"
            gradient="bg-gradient-to-br from-blue-500/10 to-indigo-500/4" compact delay={0.05} />
          <KPICard label="Critical Items" value={critical.length} trendLabel="need restock now"
            icon={<AlertTriangle size={16} className="text-red-500" />} iconBg="bg-red-500/12"
            gradient="bg-gradient-to-br from-red-500/10 to-rose-500/4" compact delay={0.1} />
          <KPICard label="Low Stock Items" value={lowStock.length} trendLabel="running low"
            icon={<TrendingDown size={16} className="text-amber-500" />} iconBg="bg-amber-500/12"
            gradient="bg-gradient-to-br from-amber-500/10 to-orange-500/4" compact delay={0.15} />
          <KPICard label="Stock Value" value={Math.round(totalStockValue)} prefix="₹" trendLabel="current inventory"
            icon={<BarChart3 size={16} className="text-emerald-500" />} iconBg="bg-emerald-500/12"
            gradient="bg-gradient-to-br from-emerald-500/10 to-teal-500/4" compact delay={0.2} />
        </div>

        {/* Material Table */}
        <Card noPad>
          {/* Table Header */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-surface-200 dark:border-surface-700">
            <div className="flex-1 min-w-48">
              <Input
                id="stock-search"
                placeholder="Search materials..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                icon={<Search size={14} />}
              />
            </div>

            {/* Status filter */}
            <div className="flex rounded-xl overflow-hidden border border-surface-200 dark:border-surface-700">
              {(['all', 'critical', 'low', 'ok'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                    filterStatus === f
                      ? 'bg-brand-600 text-white'
                      : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700',
                  )}
                >
                  {f === 'all' ? 'All' : f === 'ok' ? 'In Stock' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            <span className="text-xs text-surface-400">{filtered.length} items</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-100 dark:border-surface-800">
                  {['Material', 'Stock Level', 'Current / Min', 'Daily Usage', 'Days Left', 'Unit Cost', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-surface-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 bg-surface-200 dark:bg-surface-700 rounded animate-pulse" style={{ width: `${40 + Math.random() * 40}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-surface-400 text-sm">
                      No materials found matching your filters
                    </td>
                  </tr>
                ) : (
                  filtered.map((material, i) => {
                    const config = STATUS_CONFIG[material.stock_status ?? 'ok'];
                    const pct = Math.min(100, (material.current_stock / (material.min_stock_level * 3)) * 100);
                    return (
                      <motion.tr
                        key={material.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors group"
                      >
                        {/* Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dot)} />
                            <span className="text-sm font-medium text-surface-900 dark:text-surface-100">{material.name}</span>
                          </div>
                        </td>

                        {/* Stock bar */}
                        <td className="px-4 py-3 w-36">
                          <div className="h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: i * 0.04 }}
                              className={cn('h-full rounded-full', config.bar)}
                            />
                          </div>
                          <span className="text-[10px] text-surface-400 mt-0.5 block">{pct.toFixed(0)}% capacity</span>
                        </td>

                        {/* Current / Min */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                            {material.current_stock}
                          </span>
                          <span className="text-xs text-surface-400"> / {material.min_stock_level} {material.unit}</span>
                        </td>

                        {/* Daily Usage */}
                        <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-400">
                          {material.avg_daily_usage} {material.unit}/day
                        </td>

                        {/* Days Remaining */}
                        <td className="px-4 py-3">
                          <span className={cn('text-sm font-bold',
                            material.days_remaining! <= 1 ? 'text-red-500' :
                            material.days_remaining! <= 3 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                          )}>
                            {material.days_remaining! >= 999 ? '∞' : `${material.days_remaining}d`}
                          </span>
                        </td>

                        {/* Unit Cost */}
                        <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-400">
                          {formatCurrency(material.cost_per_unit)}/{material.unit}
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold', config.color)}>
                            {config.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost" size="xs"
                            onClick={() => { setIssueMaterialId(material.id); setIssueOpen(true); }}
                          >
                            Issue
                          </Button>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Alert Cards */}
        {critical.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-red-500/8 border border-red-500/20"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                  🚨 {critical.length} item{critical.length > 1 ? 's' : ''} critically low — order immediately!
                </p>
                <div className="flex flex-wrap gap-2">
                  {critical.map(m => (
                    <span key={m.id} className="text-xs px-2 py-0.5 bg-red-500/15 text-red-600 dark:text-red-400 rounded-lg font-medium">
                      {m.name} ({m.current_stock} {m.unit} left)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <IssueMaterialModal
        open={issueOpen}
        onClose={() => { setIssueOpen(false); setIssueMaterialId(''); }}
        onIssue={handleIssue}
        materials={materials}
        preSelectedId={issueMaterialId}
      />
      <AddPurchaseModal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        onAdd={handlePurchase}
        materials={materials}
      />
    </AppLayout>
  );
};

export default StoreDashboard;
