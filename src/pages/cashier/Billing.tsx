import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt, CreditCard, Smartphone, Banknote, Clock, CheckCircle,
  Printer, Bell, RefreshCw, Plus, Eye, History, TrendingUp,
  Users, ChefHat, ArrowRight, X, LayoutGrid, Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, formatElapsed, cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Static table layout ───────────────────────────────────────────────────────
const TABLE_DEFS = [
  ...Array.from({ length: 6 }, (_, i) => ({ no: i + 1,  capacity: 4, section: 'Hall A' })),
  ...Array.from({ length: 4 }, (_, i) => ({ no: i + 7,  capacity: 6, section: 'Hall B' })),
  ...Array.from({ length: 4 }, (_, i) => ({ no: i + 11, capacity: 2, section: 'Terrace' })),
  ...Array.from({ length: 2 }, (_, i) => ({ no: i + 15, capacity: 8, section: 'VIP' })),
];
const SECTIONS = ['Hall A', 'Hall B', 'Terrace', 'VIP'];

// ─── Types ─────────────────────────────────────────────────────────────────────
interface TableSession {
  table_no: number; capacity: number; section: string;
  order_ids: string[]; total: number; earliest_at: string;
  status: 'free' | 'occupied' | 'ready' | 'bill_requested';
  rounds: number;
}
interface BillRound {
  id: string; status: string; total_amount: number; created_at: string;
  order_items: { quantity: number; unit_price: number; menu_items: { name: string } | null }[];
}
interface CompletedBill {
  id: string; table_no: string | null; amount: number;
  method: string; timestamp: string; change_given: number;
}

// ─── Payment methods ──────────────────────────────────────────────────────────
const PAY_METHODS = [
  { id: 'cash', label: 'Cash',   icon: Banknote,   grad: 'from-emerald-500 to-teal-600'   },
  { id: 'upi',  label: 'UPI',    icon: Smartphone,  grad: 'from-violet-500 to-purple-600'  },
  { id: 'card', label: 'Card',   icon: CreditCard,  grad: 'from-blue-500 to-indigo-600'   },
];

// ─── Status config ────────────────────────────────────────────────────────────
const ST = {
  free:           { bg: 'bg-surface-800/60 border-surface-700',        dot: 'bg-surface-500',             label: 'Free',         text: 'text-surface-400' },
  occupied:       { bg: 'bg-amber-500/8   border-amber-500/25',         dot: 'bg-amber-400 animate-pulse', label: 'Occupied',     text: 'text-amber-400'   },
  ready:          { bg: 'bg-emerald-500/8  border-emerald-500/25',      dot: 'bg-emerald-400',             label: '✓ Ready',      text: 'text-emerald-400' },
  bill_requested: { bg: 'bg-rose-500/10   border-rose-400/50',          dot: 'bg-rose-500 animate-pulse',  label: '⚡ Bill Due',  text: 'text-rose-400'    },
};

// ─── Aggregate items across all rounds ──────────────────────────────────────────────
function aggregateItems(rounds: BillRound[]) {
  const map: Record<string, { name: string; qty: number; unit_price: number; total: number }> = {};
  rounds.forEach(r => r.order_items.forEach(oi => {
    const n = oi.menu_items?.name ?? 'Unknown Item';
    if (!map[n]) map[n] = { name: n, qty: 0, unit_price: oi.unit_price, total: 0 };
    map[n].qty   += oi.quantity;
    map[n].total += oi.unit_price * oi.quantity;
  }));
  return Object.values(map);
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (d: Date) =>
  d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

// ─── Print bill (explicit black-on-white for print visibility) ─────────────────
const PrintBill: React.FC<{
  tableNo: number; rounds: BillRound[];
  method: string; subtotal: number; gst: number; discount: number; total: number;
  change?: number;
  billNo?: string;
}> = ({ tableNo, rounds, method, subtotal, gst, discount, total, change, billNo }) => {
  const items = aggregateItems(rounds);
  const now   = new Date();
  return (
    <div id="print-bill-area" style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 13, width: 320, margin: '0 auto', padding: '20px 20px 28px', background: '#fff', color: '#111' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px dashed #555', paddingBottom: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 2, marginBottom: 2 }}>VARUN HOTEL</div>
        <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Fine Dining &amp; Hospitality</div>
        <div style={{ fontSize: 10, color: '#777' }}>GSTIN: 33XXXXX0000X1ZX</div>
        <div style={{ fontSize: 10, color: '#777' }}>Ph: +91-XXXXXXXXXX</div>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 12, marginBottom: 2 }}>
        <span>Table No: <strong>{tableNo}</strong></span>
        <span>{fmtDate(now)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555', marginBottom: 2 }}>
        <span>Time: {fmtTime(now)}</span>
        {billNo && <span>Bill #: {billNo}</span>}
      </div>
      <div style={{ fontSize: 11, color: '#555', marginBottom: 12 }}>
        Rounds: {rounds.length} &nbsp;|&nbsp; Mode: <strong style={{ textTransform: 'uppercase' }}>{method}</strong>
      </div>

      {/* Items */}
      <div style={{ borderTop: '1px dashed #888', paddingTop: 10, marginBottom: 10 }}>
        {/* Column headers */}
        <div style={{ display: 'flex', fontWeight: 800, marginBottom: 6, fontSize: 11, color: '#333', borderBottom: '1px solid #ddd', paddingBottom: 4 }}>
          <span style={{ flex: 1 }}>DISH</span>
          <span style={{ width: 36, textAlign: 'center' }}>QTY</span>
          <span style={{ width: 72, textAlign: 'right' }}>AMOUNT</span>
        </div>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', marginBottom: 5, alignItems: 'baseline' }}>
            <span style={{ flex: 1, fontSize: 12, wordBreak: 'break-word' }}>{item.name}</span>
            <span style={{ width: 36, textAlign: 'center', fontSize: 12, color: '#333' }}>{item.qty}</span>
            <span style={{ width: 72, textAlign: 'right', fontSize: 12 }}>₹{item.total.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div style={{ borderTop: '1px dashed #888', paddingTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
          <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
          <span>GST @ 5%</span><span>₹{gst.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12, color: '#166534' }}>
            <span>Discount</span><span>−₹{discount.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 18, borderTop: '2px solid #222', marginTop: 8, paddingTop: 8 }}>
          <span>TOTAL</span><span>₹{total.toFixed(2)}</span>
        </div>
        {(change ?? 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555', marginTop: 4 }}>
            <span>Change Returned</span><span>₹{(change ?? 0).toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 20, borderTop: '1px dashed #aaa', paddingTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Thank you for dining with us! 🙏</div>
        <div style={{ fontSize: 10, marginTop: 4, color: '#777' }}>Please visit again · Varun Hotel</div>
        <div style={{ fontSize: 9, marginTop: 6, color: '#aaa' }}>*** Computer Generated Bill ***</div>
      </div>
    </div>
  );
};

// ─── Popup print (no browser header/footer) ────────────────────────────────────
const popupPrint = (billNo?: string) => {
  const el = document.getElementById('print-bill-area');
  if (!el) return;
  const win = window.open('', '_blank', 'width=400,height=700,scrollbars=yes');
  if (!win) { window.print(); return; }        // fallback if popup blocked
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Receipt${billNo ? ' #' + billNo : ''}</title>
      <style>
        @page { margin: 6mm; size: 80mm auto; }
        body  { margin: 0; padding: 0; font-family: 'Courier New', monospace; background: #fff; color: #111; }
        * { box-sizing: border-box; }
      </style>
    </head>
    <body>${el.innerHTML}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
};

// ─── Main Component ────────────────────────────────────────────────────────────
const CashierBilling: React.FC = () => {
  const { user }   = useAuthStore();
  const navigate   = useNavigate();
  const chanRef    = useRef<RealtimeChannel | null>(null);
  const [now, setNow] = useState(Date.now());

  const [tab,       setTab]       = useState<'floor' | 'bills' | 'history'>('floor');
  const [section,   setSection]   = useState<string>('all');
  const [sessions,  setSessions]  = useState<TableSession[]>([]);
  const [completed, setCompleted] = useState<CompletedBill[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Bill modal
  const [billTable,   setBillTable]   = useState<TableSession | null>(null);
  const [billRounds,  setBillRounds]  = useState<BillRound[]>([]);
  const [billLoad,    setBillLoad]    = useState(false);
  const [payMethod,   setPayMethod]   = useState<'cash'|'upi'|'card'>('cash');
  const [discount,    setDiscount]    = useState('');
  const [amtPaid,     setAmtPaid]     = useState('');
  const [processing,  setProcessing]  = useState(false);
  const [receipt,     setReceipt]     = useState<any>(null);

  // ── Load sessions ──────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id,table_no,status,total_amount,created_at')
      .not('status', 'in', '(paid,cancelled)')
      .not('table_no', 'is', null)
      .order('created_at', { ascending: true });

    if (error) { console.error('Billing load error:', error.message); }

    const byTable: Record<string, { ids: string[]; total: number; earliest: string; statuses: string[]; rounds: number }> = {};
    (data ?? []).forEach((o: any) => {
      const key = String(o.table_no).trim();
      if (!key) return;
      if (!byTable[key]) byTable[key] = { ids: [], total: 0, earliest: o.created_at, statuses: [], rounds: 0 };
      byTable[key].ids.push(o.id);
      byTable[key].total += Number(o.total_amount);
      byTable[key].statuses.push(o.status);
      byTable[key].rounds++;
      if (o.created_at < byTable[key].earliest) byTable[key].earliest = o.created_at;
    });

    const dominantStatus = (ss: string[]): TableSession['status'] => {
      if (ss.includes('bill_requested')) return 'bill_requested';
      if (ss.includes('ready'))          return 'ready';
      return 'occupied';
    };

    setSessions(TABLE_DEFS.map(def => {
      const d = byTable[String(def.no)];
      return {
        table_no: def.no, capacity: def.capacity, section: def.section,
        order_ids: d?.ids ?? [], total: d?.total ?? 0,
        earliest_at: d?.earliest ?? '', rounds: d?.rounds ?? 0,
        status: d ? dominantStatus(d.statuses) : 'free',
      };
    }));
    setLoading(false);
  }, []);

  // ── Load today's completed ──────────────────────────────────────────────────
  const loadCompleted = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('payments')
      .select('id,amount,method,timestamp,change_given,orders(table_no)')
      .gte('timestamp', `${today}T00:00:00`)
      .order('timestamp', { ascending: false });
    if (data) setCompleted(data.map((p: any) => ({
      id: p.id, table_no: p.orders?.table_no ?? null,
      amount: Number(p.amount), method: p.method,
      timestamp: p.timestamp, change_given: Number(p.change_given ?? 0),
    })));
  }, []);

  useEffect(() => {
    loadSessions(); loadCompleted();
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    // 5-second polling fallback in case realtime misses an event
    const poll = setInterval(() => { loadSessions(); }, 5000);
    chanRef.current = supabase.channel('cashier-hub-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadSessions)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (p: any) => {
        if (p.new?.type === 'bill_request') {
          toast(`⚡ Bill requested — Table ${p.new?.metadata?.table_no ?? '?'}`, {
            icon: '🔔', duration: 8000,
            style: { background: '#1e0a0a', color: '#fca5a5', border: '1px solid #f87171', fontWeight: 700 },
          });
          loadSessions(); setTab('bills');
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments' }, loadCompleted)
      .subscribe();
    return () => { chanRef.current?.unsubscribe(); clearInterval(tick); clearInterval(poll); };
  }, [loadSessions, loadCompleted]);

  // ── Open bill modal ────────────────────────────────────────────────────────
  const openBill = async (session: TableSession) => {
    setBillTable(session); setBillRounds([]); setBillLoad(true);
    setDiscount(''); setAmtPaid(''); setPayMethod('cash');
    const { data } = await supabase
      .from('orders')
      .select('id,status,total_amount,created_at,order_items(quantity,unit_price,menu_items(name))')
      .in('id', session.order_ids)
      .order('created_at', { ascending: true });
    setBillRounds((data ?? []) as any);
    setBillLoad(false);
  };

  // ── Process payment ────────────────────────────────────────────────────────
  const processPayment = async () => {
    if (!billTable || !billRounds.length || processing) return;

    const discAmt    = Math.max(0, parseFloat(discount) || 0);
    const subtotal   = billRounds.reduce((s, r) => s + Number(r.total_amount), 0);
    const gst        = Math.round(subtotal * 0.05);
    const finalTotal = Math.max(0, subtotal + gst - discAmt);

    if (payMethod === 'cash' && (parseFloat(amtPaid) || 0) < finalTotal) {
      toast.error(`Need ₹${finalTotal.toFixed(0)} — received ₹${amtPaid}`); return;
    }

    setProcessing(true);
    try {
      const change         = payMethod === 'cash' ? Math.max(0, (parseFloat(amtPaid) || 0) - finalTotal) : 0;
      const primaryOrderId = billTable.order_ids[0];

      // ─ Guard: check if payment already exists for this primary order ─
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('order_id', primaryOrderId)
        .maybeSingle();

      if (existing) {
        // Data inconsistency: payment exists but orders weren't marked paid
        // Auto-heal: mark all orders as paid now to clear the table
        await supabase.from('orders')
          .update({ status: 'paid' })
          .in('id', billTable.order_ids);
        toast.success(`✅ Table ${billTable.table_no} cleared — already billed.`);
        setBillTable(null); setBillRounds([]);
        loadSessions(); loadCompleted();
        return;
      }

      // ─ Insert payment (upsert as safety net for race conditions) ─
      const { error: pe } = await supabase.from('payments').upsert(
        {
          order_id:     primaryOrderId,
          amount:       finalTotal,
          method:       payMethod,
          collected_by: user!.id,
          change_given: change,
        },
        { onConflict: 'order_id', ignoreDuplicates: true }
      );
      if (pe) throw pe;

      // ─ Mark all orders for this table as paid ─
      const { error: ue } = await supabase.from('orders')
        .update({ status: 'paid' }).in('id', billTable.order_ids);
      if (ue) throw ue;

      // ─ Mark any bill_request alerts as seen ─
      await supabase.from('alerts')
        .update({ is_seen: true })
        .eq('type', 'bill_request')
        .eq('is_seen', false);

      toast.success(`✅ ₹${finalTotal.toFixed(0)} collected — Table ${billTable.table_no}!`);

      // Show receipt
      setReceipt({
        tableNo: billTable.table_no, rounds: billRounds,
        method: payMethod, subtotal, gst, discount: discAmt, total: finalTotal, change,
      });

      // Clear state immediately to prevent re-submission
      setBillTable(null); setBillRounds([]);
      setDiscount(''); setAmtPaid(''); setPayMethod('cash');

      loadSessions(); loadCompleted();
    } catch (e: any) {
      if (e.message?.includes('duplicate key') || e.message?.includes('unique constraint')) {
        // Auto-heal: mark orders as paid since payment clearly went through
        if (billTable) {
          await supabase.from('orders').update({ status: 'paid' }).in('id', billTable.order_ids);
          toast.success(`✅ Table ${billTable.table_no} cleared — payment was already recorded.`);
        }
        setBillTable(null); setBillRounds([]);
        loadSessions(); loadCompleted();
      } else {
        toast.error('Payment failed: ' + e.message);
      }
    } finally {
      setProcessing(false);
    }
  };


  // ── Derived ────────────────────────────────────────────────────────────────
  const discAmt   = Math.max(0, parseFloat(discount) || 0);
  const billSub   = billRounds.reduce((s, r) => s + Number(r.total_amount), 0);
  const billGst   = Math.round(billSub * 0.05);
  const billTotal = Math.max(0, billSub + billGst - discAmt);
  const change    = (parseFloat(amtPaid) || 0) - billTotal;

  const billDue     = sessions.filter(s => s.status === 'bill_requested');
  const occupied    = sessions.filter(s => s.status !== 'free');
  const todayRev    = completed.reduce((s, p) => s + p.amount, 0);

  const sectionSessions = section === 'all'
    ? sessions
    : sessions.filter(s => s.section === section);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout title="Cashier Hub" subtitle="Floor management · Billing · Payments">
      <div className="flex flex-col gap-0 -mx-4 sm:-mx-6 -mt-2">

        {/* ── Command bar ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 pt-2 pb-4">
          {/* KPI pills */}
          {[
            { label: 'Free',     val: sessions.filter(s => s.status === 'free').length,  color: 'text-emerald-400' },
            { label: 'Occupied', val: occupied.length,                                    color: 'text-amber-400'   },
            { label: 'Bill Due', val: billDue.length,                                     color: billDue.length > 0 ? 'text-rose-400' : 'text-surface-500', pulse: billDue.length > 0 },
            { label: "Today's Revenue", val: formatCurrency(todayRev),                    color: 'text-brand-400', wide: true },
          ].map(s => (
            <div key={s.label}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-surface-800 border border-surface-700">
              <span className={cn('font-black text-lg', s.color, s.pulse && 'animate-pulse')}>{s.val}</span>
              <span className="text-[11px] text-surface-500 font-semibold">{s.label}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<RefreshCw size={13} />}
              onClick={() => { loadSessions(); loadCompleted(); }}>Refresh</Button>
          </div>
        </div>

        {/* ── Tab row ───────────────────────────────────────────────────── */}
        <div className="flex gap-0 border-b border-surface-700 px-4 sm:px-6">
          {([
            { id: 'floor',   label: 'Floor View',    icon: LayoutGrid,   count: occupied.length,  pulse: false },
            { id: 'bills',   label: 'Pending Bills',  icon: Receipt,      count: billDue.length,   pulse: billDue.length > 0 },
            { id: 'history', label: "Today's History",icon: History,      count: completed.length, pulse: false },
          ] as const).map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all',
                  tab === t.id
                    ? 'border-brand-500 text-brand-400'
                    : 'border-transparent text-surface-500 hover:text-surface-300 hover:border-surface-600'
                )}>
                <Icon size={14} />
                {t.label}
                {t.count > 0 && (
                  <span className={cn('px-1.5 py-0.5 rounded-full text-[9px] font-black',
                    t.pulse ? 'bg-rose-500 text-white animate-pulse' : 'bg-surface-700 text-surface-300')}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ════ TAB: FLOOR VIEW ═════════════════════════════════════════════ */}
        {tab === 'floor' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 sm:px-6 pt-4 pb-8">
            {/* Section filter */}
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              {['all', ...SECTIONS].map(sec => (
                <button key={sec} onClick={() => setSection(sec)}
                  className={cn(
                    'px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border',
                    section === sec
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'bg-surface-800 border-surface-700 text-surface-400 hover:text-white hover:border-surface-600'
                  )}>
                  {sec === 'all' ? '🏨 All Sections' : sec}
                </button>
              ))}
            </div>

            {/* Table grid by section */}
            {loading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className="h-44 rounded-2xl bg-surface-800 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {(section === 'all' ? SECTIONS : [section]).map(sec => {
                  const secTables = sectionSessions.filter(s => s.section === sec);
                  if (secTables.length === 0) return null;
                  return (
                    <div key={sec}>
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-sm font-black text-surface-300 uppercase tracking-wider">{sec}</h3>
                        <div className="flex-1 h-px bg-surface-700" />
                        <span className="text-[10px] text-surface-500">
                          {secTables.filter(s => s.status !== 'free').length}/{secTables.length} occupied
                        </span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                        {secTables.map(session => {
                          const st     = ST[session.status];
                          const isBusy = session.status !== 'free';
                          const mins   = session.earliest_at
                            ? Math.floor((now - new Date(session.earliest_at).getTime()) / 60000) : 0;

                          return (
                            <motion.div key={session.table_no} layout
                              whileHover={{ y: -4, scale: 1.02 }} transition={{ duration: 0.12 }}
                              className={cn('rounded-2xl border p-3 flex flex-col gap-2 transition-all hover:shadow-xl', st.bg)}>

                              {/* Table # + status */}
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-xl font-black text-white leading-none">T{session.table_no}</p>
                                  <p className="text-[9px] text-surface-500 mt-0.5">{session.capacity} seats</p>
                                </div>
                                <span className={cn('w-2 h-2 rounded-full mt-1', st.dot)} />
                              </div>

                              {/* Status label */}
                              <p className={cn('text-[10px] font-bold', st.text)}>{st.label}</p>

                              {/* Busy info */}
                              {isBusy && (
                                <div className="rounded-xl bg-black/20 px-2 py-1.5 space-y-0.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[9px] text-surface-500">{session.rounds}R</span>
                                    <span className="text-[11px] font-black text-white">{formatCurrency(session.total)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock size={8} className={mins > 45 ? 'text-rose-400' : 'text-surface-500'} />
                                    <span className={cn('text-[9px] font-semibold', mins > 45 ? 'text-rose-400' : 'text-surface-500')}>
                                      {mins}m
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Action button */}
                              {session.status === 'free' ? (
                                <button onClick={() => navigate(`/cashier/table-order?table=${session.table_no}`)}
                                  className="w-full py-1.5 rounded-xl bg-brand-500/15 hover:bg-brand-500 border border-brand-500/30 hover:border-brand-500 text-brand-400 hover:text-white text-[10px] font-bold transition-all flex items-center justify-center gap-1">
                                  <Plus size={9} /> Seat
                                </button>
                              ) : session.status === 'bill_requested' ? (
                                <div className="space-y-1">
                                  <button onClick={() => openBill(session)}
                                    className="w-full py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black transition-all flex items-center justify-center gap-1 animate-pulse">
                                    <Receipt size={9} /> Bill
                                  </button>
                                  <button onClick={() => navigate(`/cashier/table-order?table=${session.table_no}`)}
                                    className="w-full py-1 rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-300 text-[9px] font-semibold transition-all">
                                    + Add
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <button onClick={() => navigate(`/cashier/table-order?table=${session.table_no}`)}
                                    className="w-full py-1.5 rounded-xl bg-surface-700 hover:bg-surface-600 text-surface-200 text-[10px] font-bold transition-all flex items-center justify-center gap-1">
                                    <Plus size={9} /> Add
                                  </button>
                                  <button onClick={() => openBill(session)}
                                    className="w-full py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-[9px] font-semibold transition-all">
                                    Bill
                                  </button>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ════ TAB: PENDING BILLS ══════════════════════════════════════════ */}
        {tab === 'bills' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="px-4 sm:px-6 pt-6 pb-8">
            {billDue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-surface-500">
                <CheckCircle size={48} className="text-emerald-400 opacity-60" />
                <p className="text-lg font-bold text-surface-400">All clear! No pending bills.</p>
                <p className="text-sm">Bill requests from captain will appear here instantly.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {billDue.map(session => {
                  const mins = session.earliest_at
                    ? Math.floor((now - new Date(session.earliest_at).getTime()) / 60000) : 0;
                  return (
                    <motion.div key={session.table_no}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -4 }}
                      className="relative overflow-hidden rounded-3xl border-2 border-rose-500/60 bg-gradient-to-br from-rose-500/8 to-surface-900 p-5 cursor-pointer hover:shadow-2xl hover:shadow-rose-500/20 transition-all"
                      onClick={() => openBill(session)}>
                      {/* Glow */}
                      <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent pointer-events-none" />
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-3xl font-black text-white">T{session.table_no}</p>
                          <p className="text-xs text-surface-400 mt-0.5">{session.section} · {session.capacity} seats</p>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 animate-pulse">
                          <Bell size={10} className="text-rose-400" />
                          <span className="text-[10px] font-black text-rose-400">BILL DUE</span>
                        </div>
                      </div>
                      <p className="text-3xl font-black text-white mb-1">{formatCurrency(session.total)}</p>
                      <div className="flex items-center gap-3 text-xs text-surface-400 mb-5">
                        <span><Clock size={10} className="inline mr-1" />{mins}m</span>
                        <span>·</span>
                        <span>{session.rounds} round{session.rounds !== 1 ? 's' : ''}</span>
                      </div>
                      <button
                        className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-black text-sm shadow-lg shadow-rose-500/30 flex items-center justify-center gap-2 transition-all">
                        <Receipt size={15} /> Process Payment
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ════ TAB: HISTORY ════════════════════════════════════════════════ */}
        {tab === 'history' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="px-4 sm:px-6 pt-4 pb-8 space-y-4">
            {/* Summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Bills Today',  val: completed.length,                                                                  color: 'text-brand-400'   },
                { label: 'Total Revenue',val: formatCurrency(todayRev),                                                          color: 'text-emerald-400' },
                { label: 'Cash',         val: formatCurrency(completed.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0)), color: 'text-amber-400'   },
                { label: 'UPI + Card',   val: formatCurrency(completed.filter(p => p.method !== 'cash').reduce((s, p) => s + p.amount, 0)), color: 'text-violet-400'  },
              ].map(s => (
                <div key={s.label}
                  className="p-4 rounded-2xl bg-surface-800 border border-surface-700">
                  <p className="text-xs text-surface-500 font-semibold mb-1">{s.label}</p>
                  <p className={cn('text-xl font-black', s.color)}>{s.val}</p>
                </div>
              ))}
            </div>

            {completed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-surface-500">
                <History size={40} className="opacity-50 mb-3" />
                <p className="font-semibold">No bills processed today</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-surface-700 overflow-hidden bg-surface-800/50">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-700">
                      {['Table', 'Amount', 'Method', 'Change', 'Time'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[11px] font-black text-surface-500 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-700/50">
                    {completed.map(b => (
                      <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="hover:bg-surface-700/30 transition-colors">
                        <td className="px-5 py-3 font-bold text-white">
                          {b.table_no ? `Table ${b.table_no}` : 'Walk-in'}
                        </td>
                        <td className="px-5 py-3 font-black text-emerald-400">{formatCurrency(b.amount)}</td>
                        <td className="px-5 py-3">
                          <span className={cn('px-2.5 py-1 rounded-xl text-[10px] font-black uppercase',
                            b.method === 'cash' ? 'bg-emerald-500/15 text-emerald-400' :
                            b.method === 'upi'  ? 'bg-violet-500/15  text-violet-400'  :
                                                  'bg-blue-500/15    text-blue-400')}>
                            {b.method}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-surface-400 text-xs">{b.change_given > 0 ? formatCurrency(b.change_given) : '—'}</td>
                        <td className="px-5 py-3 text-surface-500 text-xs">{formatElapsed(b.timestamp)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ═══ Bill Modal ═══════════════════════════════════════════════════════ */}
      <Modal open={!!billTable} onClose={() => { setBillTable(null); setBillRounds([]); }}
        title={billTable ? `Table ${billTable.table_no} — Final Bill` : ''} size="lg">
        {billLoad ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Aggregated items — not round-wise */}
            <div className="max-h-56 overflow-y-auto pr-1">
              {billRounds.length === 0
                ? <p className="text-center text-surface-400 text-sm py-4">No items found</p>
                : (
                  <div className="rounded-xl border border-surface-700 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 border-b border-surface-700">
                      <span className="text-xs font-black text-surface-300">All Items · {billRounds.length} round{billRounds.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="px-4 py-3 space-y-2 bg-surface-900">
                      {/* Header */}
                      <div className="flex items-center text-[10px] text-surface-500 font-bold pb-1 border-b border-surface-800">
                        <span className="flex-1">Dish</span>
                        <span className="w-10 text-center">Qty</span>
                        <span className="w-20 text-right">Amount</span>
                      </div>
                      {aggregateItems(billRounds).map((item, i) => (
                        <div key={i} className="flex items-center text-sm">
                          <span className="flex-1 text-white font-semibold">{item.name}</span>
                          <span className="w-10 text-center text-surface-400 font-bold">×{item.qty}</span>
                          <span className="w-20 text-right text-white font-black">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Totals */}
            <div className="p-4 rounded-2xl bg-surface-800 space-y-2">
              <div className="flex justify-between text-xs text-surface-400">
                <span>Subtotal ({billRounds.length} rounds)</span><span>{formatCurrency(billSub)}</span>
              </div>
              <div className="flex justify-between text-xs text-surface-400">
                <span>GST 5%</span><span>{formatCurrency(billGst)}</span>
              </div>
              {discAmt > 0 && <div className="flex justify-between text-xs text-emerald-400">
                <span>Discount</span><span>−{formatCurrency(discAmt)}</span>
              </div>}
              <div className="flex justify-between font-black text-base text-white pt-2 border-t border-surface-700">
                <span>Total Payable</span>
                <span className="text-brand-400">{formatCurrency(billTotal)}</span>
              </div>
            </div>

            <Input id="bill-discount" label="Discount (₹)" type="number"
              value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" min="0" />

            {/* Payment method */}
            <div>
              <p className="text-sm font-bold text-surface-400 mb-2">Payment Method</p>
              <div className="grid grid-cols-3 gap-2">
                {PAY_METHODS.map(m => {
                  const Icon = m.icon;
                  return (
                    <button key={m.id} onClick={() => setPayMethod(m.id as any)}
                      className={cn(
                        'flex flex-col items-center gap-2 py-4 rounded-2xl border-2 text-sm font-bold transition-all',
                        payMethod === m.id
                          ? `bg-gradient-to-br ${m.grad} text-white border-transparent shadow-xl scale-105`
                          : 'bg-surface-800 border-surface-700 text-surface-400 hover:border-surface-500 hover:text-white'
                      )}>
                      <Icon size={22} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {payMethod === 'cash' && (
              <div className="space-y-2">
                <Input id="amt-paid" label="Amount Received (₹)" type="number"
                  value={amtPaid} onChange={e => setAmtPaid(e.target.value)}
                  placeholder={billTotal.toFixed(0)} min="0" />
                {amtPaid && (
                  <div className={cn('flex justify-between px-4 py-2.5 rounded-xl text-sm font-bold',
                    change >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/10 border border-rose-500/20 text-rose-400')}>
                    <span>{change >= 0 ? 'Return Change' : '⚠ Insufficient'}</span>
                    <span>{change >= 0 ? formatCurrency(change) : `Need ₹${Math.abs(change).toFixed(0)} more`}</span>
                  </div>
                )}
              </div>
            )}

            <button onClick={processPayment}
              disabled={processing || (payMethod === 'cash' && !!amtPaid && change < 0)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-violet-600 hover:from-brand-400 hover:to-violet-500 text-white font-black text-base shadow-xl shadow-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {processing
                ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing…</>
                : <><CheckCircle size={18} /> Collect {formatCurrency(billTotal)} · {payMethod.toUpperCase()}</>
              }
            </button>
          </div>
        )}
      </Modal>

      {/* ═══ Receipt Modal ════════════════════════════════════════════════════ */}
      <Modal open={!!receipt} onClose={() => setReceipt(null)} title="Receipt" size="sm">
        {receipt && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-3 overflow-y-auto max-h-96">
              <PrintBill {...receipt} />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" fullWidth icon={<X size={14} />} onClick={() => setReceipt(null)}>Close</Button>
              <Button variant="primary" fullWidth icon={<Printer size={14} />}
                onClick={() => popupPrint(receipt?.billNo)}>Print Receipt</Button>
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        @media print {
          body > *                    { display: none !important; }
          body                        { background: #fff !important; }
          #print-bill-area            { display: block !important; position: fixed; top: 0; left: 0; width: 100%; background: #fff !important; color: #111 !important; }
          #print-bill-area *          { color: #111 !important; background: transparent !important; -webkit-print-color-adjust: exact; }
          #print-bill-area span,
          #print-bill-area div,
          #print-bill-area b          { color: #111 !important; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </AppLayout>
  );
};

export default CashierBilling;
