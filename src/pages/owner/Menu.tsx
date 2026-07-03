import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UtensilsCrossed, Plus, Edit2, Trash2, Eye, EyeOff,
  Search, ChefHat, Tag, DollarSign, CheckCircle, X,
  ToggleLeft, ToggleRight, Star, Filter,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

// ─── Types ─────────────────────────────────────────────────────
interface MenuItem {
  id:                 string;
  name:               string;
  category:           string;
  price:              number;
  description:        string;
  is_available_today: boolean;
  image_url?:         string;
}

const CATEGORIES = [
  { value: 'starters',     label: 'Starters',       emoji: '🥗' },
  { value: 'main_course',  label: 'Main Course',     emoji: '🍛' },
  { value: 'breads',       label: 'Breads',          emoji: '🫓' },
  { value: 'rice_biryani', label: 'Rice & Biryani',  emoji: '🍚' },
  { value: 'beverages',    label: 'Beverages',       emoji: '☕' },
  { value: 'desserts',     label: 'Desserts',        emoji: '🍮' },
  { value: 'soups',        label: 'Soups',           emoji: '🍲' },
  { value: 'salads',       label: 'Salads',          emoji: '🥙' },
];

const EMPTY_FORM = {
  name: '', category: 'main_course', price: '',
  description: '', is_available_today: true,
};

// ─── Add/Edit Modal ─────────────────────────────────────────────
interface MenuItemModalProps {
  open:     boolean;
  onClose:  () => void;
  onSave:   (data: any) => Promise<void>;
  editing?: MenuItem | null;
}

const MenuItemModal: React.FC<MenuItemModalProps> = ({ open, onClose, onSave, editing }) => {
  const [form, setForm]       = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name, category: editing.category,
        price: String(editing.price), description: editing.description ?? '',
        is_available_today: editing.is_available_today,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editing, open]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) { toast.error('Name and price required'); return; }
    setLoading(true);
    await onSave({ ...form, price: parseFloat(form.price) });
    setLoading(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Menu Item' : 'Add New Dish'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Dish Name *" id="dish-name" value={form.name}
          onChange={e => set('name', e.target.value)} placeholder="e.g. Chicken Biryani" required />

        <div className="grid grid-cols-2 gap-3">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Category *</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm focus:ring-2 focus:ring-brand-500 outline-none">
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
              ))}
            </select>
          </div>

          <Input label="Price (₹) *" id="dish-price" type="number" value={form.price}
            onChange={e => set('price', e.target.value)}
            placeholder="e.g. 220" min="1" step="0.5" required />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="Short description of the dish..."
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none" />
        </div>

        {/* Available today toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-700/40 border border-surface-200 dark:border-surface-700">
          <div>
            <p className="text-sm font-medium text-surface-800 dark:text-surface-200">Available Today</p>
            <p className="text-xs text-surface-500">Show this dish on today's menu</p>
          </div>
          <button type="button" onClick={() => set('is_available_today', !form.is_available_today)}
            className="text-2xl transition-all">
            {form.is_available_today
              ? <ToggleRight size={32} className="text-brand-500" />
              : <ToggleLeft size={32} className="text-surface-400" />}
          </button>
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" fullWidth onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" fullWidth loading={loading} icon={<CheckCircle size={14} />}>
            {editing ? 'Save Changes' : 'Add Dish'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Menu Item Card ─────────────────────────────────────────────
interface MenuCardProps {
  item:      MenuItem;
  onEdit:    (item: MenuItem) => void;
  onDelete:  (id: string) => void;
  onToggle:  (id: string, available: boolean) => void;
}

const MenuCard: React.FC<MenuCardProps> = ({ item, onEdit, onDelete, onToggle }) => {
  const cat = CATEGORIES.find(c => c.value === item.category);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className={cn(
        'relative rounded-2xl border bg-white dark:bg-surface-800 p-4',
        'transition-shadow hover:shadow-card-hover',
        item.is_available_today
          ? 'border-surface-200 dark:border-surface-700'
          : 'border-dashed border-surface-300 dark:border-surface-600 opacity-60',
      )}
    >
      {/* Category icon */}
      <div className="text-3xl mb-2">{cat?.emoji ?? '🍽️'}</div>

      {/* Name */}
      <h3 className="font-semibold text-surface-900 dark:text-surface-100 text-sm leading-tight mb-1">
        {item.name}
      </h3>

      {/* Category */}
      <p className="text-xs text-surface-400 mb-2">{cat?.label}</p>

      {/* Description */}
      {item.description && (
        <p className="text-xs text-surface-500 mb-3 line-clamp-2">{item.description}</p>
      )}

      {/* Price + Status */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-bold text-brand-600 dark:text-brand-400">
          {formatCurrency(item.price)}
        </span>
        <span className={cn(
          'text-[10px] font-bold px-2 py-0.5 rounded-full',
          item.is_available_today
            ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
            : 'bg-surface-200 text-surface-500',
        )}>
          {item.is_available_today ? '✓ Available' : '✗ Unavailable'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="xs" fullWidth
          icon={item.is_available_today ? <EyeOff size={12} /> : <Eye size={12} />}
          onClick={() => onToggle(item.id, !item.is_available_today)}>
          {item.is_available_today ? 'Hide' : 'Show'}
        </Button>
        <Button variant="ghost" size="xs" icon={<Edit2 size={12} />} onClick={() => onEdit(item)} />
        <Button variant="ghost" size="xs" icon={<Trash2 size={12} />}
          className="text-red-500 hover:bg-red-500/10"
          onClick={() => onDelete(item.id)} />
      </div>
    </motion.div>
  );
};

// ─── Menu Management Page ───────────────────────────────────────
const MenuManagement: React.FC = () => {
  const { user }  = useAuthStore();
  const [items,   setItems]   = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editing,    setEditing]    = useState<MenuItem | null>(null);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('menu_items').select('*').order('category').order('name');
    if (data) setItems(data.map((m: any) => ({ ...m, price: Number(m.price) })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSave = async (formData: any) => {
    if (editing) {
      const { error } = await supabase.from('menu_items')
        .update({ ...formData, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Dish updated!');
    } else {
      const { error } = await supabase.from('menu_items')
        .insert({ ...formData, created_by: user!.id });
      if (error) { toast.error(error.message); return; }
      toast.success('New dish added to menu!');
    }
    setEditing(null);
    fetchItems();
  };

  const handleToggle = async (id: string, available: boolean) => {
    const { error } = await supabase.from('menu_items')
      .update({ is_available_today: available, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setItems(prev => prev.map(m => m.id === id ? { ...m, is_available_today: available } : m));
    toast.success(available ? 'Dish is now available' : 'Dish hidden for today');
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('menu_items').delete().eq('id', deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success('Dish removed');
    setDeleteId(null);
    fetchItems();
  };

  const filtered = items.filter(m => {
    const matchCat    = catFilter === 'all' || m.category === catFilter;
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const available   = items.filter(m => m.is_available_today).length;
  const unavailable = items.length - available;

  return (
    <AppLayout title="Menu & Recipes" subtitle="Manage your hotel's menu, prices, and dish availability"
      actions={
        <Button variant="primary" size="sm" icon={<Plus size={14} />}
          onClick={() => { setEditing(null); setModalOpen(true); }}>
          Add Dish
        </Button>
      }>
      <div className="space-y-5 pb-6">

        {/* Stats row */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Total Dishes',  value: items.length,  color: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20' },
            { label: 'Available Now', value: available,      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
            { label: 'Hidden Today',  value: unavailable,   color: 'bg-surface-200 text-surface-500 dark:bg-surface-700 border-surface-300 dark:border-surface-600' },
            { label: 'Categories',    value: new Set(items.map(m => m.category)).size, color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
          ].map(s => (
            <div key={s.label} className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold', s.color)}>
              <span className="text-lg font-bold">{s.value}</span>
              <span className="font-medium opacity-80">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-48">
            <Input id="menu-search" placeholder="Search dishes..." value={search}
              onChange={e => setSearch(e.target.value)} icon={<Search size={14} />} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setCatFilter('all')}
              className={cn('px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                catFilter === 'all' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-500')}>
              All
            </button>
            {CATEGORIES.map(c => (
              <button key={c.value} onClick={() => setCatFilter(c.value)}
                className={cn('flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                  catFilter === c.value ? 'bg-brand-600 text-white' : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-500')}>
                <span>{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-surface-400 gap-3">
            <UtensilsCrossed size={36} className="opacity-30" />
            <p className="text-sm">No dishes found. Add your first dish!</p>
            <Button variant="primary" size="sm" icon={<Plus size={14} />}
              onClick={() => { setEditing(null); setModalOpen(true); }}>
              Add First Dish
            </Button>
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <AnimatePresence>
              {filtered.map(item => (
                <MenuCard key={item.id} item={item}
                  onEdit={item => { setEditing(item); setModalOpen(true); }}
                  onDelete={id => setDeleteId(id)}
                  onToggle={handleToggle}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <MenuItemModal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave} editing={editing} />

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={handleDelete} title="Delete Dish?"
        message="This will permanently remove this dish from the menu. Orders with this item won't be affected."
        confirmLabel="Delete" />
    </AppLayout>
  );
};

export default MenuManagement;
