import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Plus, Minus, Trash2, Search, CheckCircle,
  CreditCard, Smartphone, Banknote, X, Printer, ArrowRight,
  UtensilsCrossed, Clock, RefreshCw,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

// ─── Types ─────────────────────────────────────────────────────
interface MenuItem {
  id:          string;
  name:        string;
  category:    string;
  price:       number;
  is_available_today: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  starters:      '🥗',
  main_course:   '🍛',
  breads:        '🫓',
  rice_biryani:  '🍚',
  beverages:     '☕',
  desserts:      '🍮',
  soups:         '🍲',
  salads:        '🥙',
};

const PAYMENT_METHODS = [
  { id: 'cash',   label: 'Cash',   icon: Banknote   },
  { id: 'upi',    label: 'UPI',    icon: Smartphone  },
  { id: 'card',   label: 'Card',   icon: CreditCard  },
];

// ─── Cashier Panel ──────────────────────────────────────────────
const CashierPanel: React.FC = () => {
  const { user } = useAuthStore();

  const [menuItems,    setMenuItems]    = useState<MenuItem[]>([]);
  const [cart,         setCart]         = useState<CartItem[]>([]);
  const [tableNo,      setTableNo]      = useState('');
  const [search,       setSearch]       = useState('');
  const [category,     setCategory]     = useState('all');
  const [paymentOpen,  setPaymentOpen]  = useState(false);
  const [paymentMethod,setPaymentMethod]= useState('cash');
  const [amountPaid,   setAmountPaid]   = useState('');
  const [loading,      setLoading]      = useState(false);
  const [menuLoading,  setMenuLoading]  = useState(true);
  const [successOrder, setSuccessOrder] = useState<string | null>(null);

  // Fetch menu
  const fetchMenu = useCallback(async () => {
    const { data } = await supabase
      .from('menu_items')
      .select('id, name, category, price, is_available_today')
      .eq('is_available_today', true)
      .order('category')
      .order('name');
    if (data) setMenuItems(data.map((m: any) => ({ ...m, price: Number(m.price) })));
    setMenuLoading(false);
  }, []);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  // Cart operations
  const addToCart = (item: MenuItem) => {
    setCart(c => {
      const existing = c.find(x => x.id === item.id);
      if (existing) return c.map(x => x.id === item.id ? { ...x, quantity: x.quantity + 1 } : x);
      return [...c, { ...item, quantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(c => {
      const updated = c.map(x => x.id === id ? { ...x, quantity: x.quantity + delta } : x);
      return updated.filter(x => x.quantity > 0);
    });
  };

  const removeFromCart = (id: string) => setCart(c => c.filter(x => x.id !== id));

  const clearCart = () => { setCart([]); setTableNo(''); };

  // Totals
  const subtotal  = cart.reduce((s, x) => s + x.price * x.quantity, 0);
  const tax       = Math.round(subtotal * 0.05); // 5% GST
  const total     = subtotal + tax;
  const change    = (parseFloat(amountPaid) || 0) - total;

  // Place order
  const placeOrder = async (billNow: boolean = false) => {
    if (cart.length === 0) { toast.error('Add items to cart first'); return; }
    if (!tableNo.trim())   { toast.error('Enter table or room number'); return; }
    setLoading(true);

    try {
      // Create order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          table_no:     tableNo.trim(),
          status:       'pending',
          cashier_id:   user!.id,
          total_amount: total,
          order_source: 'cashier',
        })
        .select('id')
        .single();

      if (orderErr) throw orderErr;

      // Insert order items
      const items = cart.map(item => ({
        order_id:     order.id,
        menu_item_id: item.id,
        quantity:     item.quantity,
        unit_price:   item.price,
      }));
      const { error: itemsError } = await supabase.from('order_items').insert(items);
      if (itemsError) { toast.error('Failed to add items: ' + itemsError.message); return; }

      // Only create payment and bill if billNow is true
      if (billNow) {
        const changeGiven = paymentMethod === 'cash'
          ? Math.max(0, (parseFloat(amountPaid) || 0) - total)
          : 0;
        const { error: payError } = await supabase.from('payments').insert({
          order_id:     order.id,
          amount:       total,
          method:       paymentMethod,
          collected_by: user!.id,
          change_given: changeGiven,
        });
        if (payError) { toast.error(payError.message); return; }
        await supabase.from('orders').update({ status: 'paid' }).eq('id', order.id);
        toast.success('Order billed & payment recorded!');
      } else {
        toast.success('Order sent to kitchen! 🍳');
      }

      setSuccessOrder(`#${order.id.slice(-6).toUpperCase()}`);
      setPaymentOpen(false);
      clearCart();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  // Filtered menu
  const categories = ['all', ...Array.from(new Set(menuItems.map(m => m.category)))];
  const filtered = menuItems.filter(m => {
    const matchCat    = category === 'all' || m.category === category;
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const cartQty = (id: string) => cart.find(x => x.id === id)?.quantity ?? 0;

  return (
    <AppLayout title="New Order" subtitle="Create and send orders to kitchen">
      <div className="flex gap-4 h-[calc(100vh-10rem)]">

        {/* ── Left: Menu ── */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">
          {/* Search + category filter */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-48">
              <Input id="menu-search" placeholder="Search dishes..." value={search}
                onChange={e => setSearch(e.target.value)} icon={<Search size={14} />} />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors capitalize whitespace-nowrap',
                    category === cat
                      ? 'bg-brand-600 text-white'
                      : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700',
                  )}
                >
                  {CATEGORY_ICONS[cat] && <span>{CATEGORY_ICONS[cat]}</span>}
                  {cat === 'all' ? 'All Dishes' : cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Grid */}
          <div className="flex-1 overflow-y-auto">
            {menuLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-2xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-surface-400">
                <UtensilsCrossed size={32} className="mb-3 opacity-40" />
                <p className="text-sm">No dishes found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map(item => {
                  const qty = cartQty(item.id);
                  return (
                    <motion.button
                      key={item.id}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => addToCart(item)}
                      className={cn(
                        'relative p-3 rounded-2xl border text-left transition-all',
                        'bg-white dark:bg-surface-800',
                        qty > 0
                          ? 'border-brand-500/50 ring-2 ring-brand-500/20 shadow-brand/20'
                          : 'border-surface-200 dark:border-surface-700 hover:border-brand-300 hover:shadow-card',
                      )}
                    >
                      {/* Category icon */}
                      <div className="text-2xl mb-2">{CATEGORY_ICONS[item.category] ?? '🍽️'}</div>
                      <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 leading-tight line-clamp-2">
                        {item.name}
                      </p>
                      <p className="text-sm font-bold text-brand-600 dark:text-brand-400 mt-1.5">
                        {formatCurrency(item.price)}
                      </p>

                      {/* Qty badge */}
                      {qty > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shadow"
                        >
                          {qty}
                        </motion.span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Cart ── */}
        <div className="w-80 flex-shrink-0 flex flex-col rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-card overflow-hidden">
          {/* Cart Header */}
          <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-brand-600 dark:text-brand-400" />
              <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm">Order</span>
              {cart.length > 0 && (
                <Badge variant="blue">{cart.reduce((s, x) => s + x.quantity, 0)} items</Badge>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-red-500 hover:underline">Clear</button>
            )}
          </div>

          {/* Table Number */}
          <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700">
            <Input
              id="table-no"
              placeholder="Table / Room number *"
              value={tableNo}
              onChange={e => setTableNo(e.target.value)}
            />
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <AnimatePresence>
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-surface-400 gap-2">
                  <ShoppingCart size={28} className="opacity-30" />
                  <p className="text-xs text-center">Tap any dish to add to order</p>
                </div>
              ) : (
                cart.map(item => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex items-center gap-2 py-2.5 border-b border-surface-100 dark:border-surface-700"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-surface-800 dark:text-surface-200 truncate">{item.name}</p>
                      <p className="text-xs text-brand-600 dark:text-brand-400">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateQty(item.id, -1)}
                        className="w-6 h-6 rounded-lg bg-surface-100 dark:bg-surface-700 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-red-100 hover:text-red-500 transition-colors">
                        <Minus size={11} />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-surface-900 dark:text-surface-100">
                        {item.quantity}
                      </span>
                      <button onClick={() => updateQty(item.id, 1)}
                        className="w-6 h-6 rounded-lg bg-surface-100 dark:bg-surface-700 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-brand-100 hover:text-brand-600 transition-colors">
                        <Plus size={11} />
                      </button>
                      <button onClick={() => removeFromCart(item.id)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-surface-300 hover:text-red-500 transition-colors ml-1">
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 w-16 text-right">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Bill Summary */}
          {cart.length > 0 && (
            <div className="border-t border-surface-200 dark:border-surface-700 px-4 py-3 space-y-1.5">
              <div className="flex justify-between text-xs text-surface-500">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-surface-500">
                <span>GST (5%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-surface-900 dark:text-surface-100 pt-1.5 border-t border-surface-200 dark:border-surface-700">
                <span>Total</span>
                <span className="text-brand-600 dark:text-brand-400">{formatCurrency(total)}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="px-3 pb-3 space-y-2">
            <Button
              variant="primary" fullWidth
              disabled={cart.length === 0 || !tableNo.trim()}
              loading={loading}
              icon={<ArrowRight size={14} />}
              onClick={() => placeOrder(false)}
            >
              Send to Kitchen
            </Button>
            <Button
              variant="outline" fullWidth size="sm"
              disabled={cart.length === 0 || !tableNo.trim()}
              icon={<CreditCard size={13} />}
              onClick={() => setPaymentOpen(true)}
            >
              Bill & Collect Payment
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Collect Payment" size="sm">
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/40">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-surface-500">Total amount</span>
            </div>
            <p className="text-3xl font-bold text-brand-600 dark:text-brand-400">{formatCurrency(total)}</p>
            <p className="text-xs text-surface-400 mt-1">Table / Room: {tableNo || '—'}</p>
          </div>

          {/* Payment method */}
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(pm => {
                const Icon = pm.icon;
                return (
                  <button
                    key={pm.id}
                    onClick={() => setPaymentMethod(pm.id)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all',
                      paymentMethod === pm.id
                        ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400'
                        : 'border-surface-200 dark:border-surface-600 text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-700',
                    )}
                  >
                    <Icon size={18} />
                    {pm.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cash: show change */}
          {paymentMethod === 'cash' && (
            <div className="space-y-2">
              <Input label="Amount Received (₹)" id="amount-paid" type="number"
                value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
                placeholder={formatCurrency(total, false)} />
              {change > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                  <CheckCircle size={14} /> Change to return: {formatCurrency(change)}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" fullWidth onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button variant="primary" fullWidth loading={loading}
              icon={<CheckCircle size={14} />} onClick={() => placeOrder(true)}>
              Confirm & Bill
            </Button>
          </div>
        </div>
      </Modal>

      {/* Success animation */}
      <AnimatePresence>
        {successOrder && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            onAnimationComplete={() => setTimeout(() => setSuccessOrder(null), 2500)}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 px-5 py-3 bg-emerald-600 text-white rounded-2xl shadow-xl">
              <CheckCircle size={20} />
              <div>
                <p className="font-bold text-sm">Order {successOrder} placed!</p>
                <p className="text-xs text-emerald-200">Sent to kitchen display</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
};

export default CashierPanel;
