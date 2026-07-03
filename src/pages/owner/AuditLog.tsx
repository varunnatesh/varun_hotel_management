import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Search, Calendar, Filter, User,
  ShoppingBag, Package, DollarSign, LogIn, LogOut, Settings,
  Download, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { RoleBadge } from '../../components/ui/Badge';
import { supabase } from '../../lib/supabase';
import { formatElapsed, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

// ─── Types ─────────────────────────────────────────────────────
interface StaffLog {
  id:         string;
  action:     string;
  table_affected: string;
  record_id:  string;
  details:    Record<string, any>;
  created_at: string;
  users?:     { name: string; role: string };
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  login:            { icon: LogIn,       color: 'bg-emerald-500/12 text-emerald-500', label: 'Login' },
  logout:           { icon: LogOut,      color: 'bg-surface-200 text-surface-500',   label: 'Logout' },
  create_order:     { icon: ShoppingBag, color: 'bg-brand-500/12 text-brand-500',    label: 'Create Order' },
  update_order:     { icon: ShoppingBag, color: 'bg-blue-500/12 text-blue-500',      label: 'Update Order' },
  issue_material:   { icon: Package,     color: 'bg-amber-500/12 text-amber-500',    label: 'Issue Material' },
  add_purchase:     { icon: Package,     color: 'bg-teal-500/12 text-teal-500',      label: 'Add Purchase' },
  apply_discount:   { icon: DollarSign,  color: 'bg-violet-500/12 text-violet-500',  label: 'Apply Discount' },
  collect_payment:  { icon: DollarSign,  color: 'bg-green-500/12 text-green-500',    label: 'Collect Payment' },
  update_settings:  { icon: Settings,    color: 'bg-surface-300 text-surface-600',   label: 'Settings Change' },
};

const PAGE_SIZE = 25;

// ─── Audit Log Page ─────────────────────────────────────────────
const AuditLog: React.FC = () => {
  const [logs,    setLogs]    = useState<StaffLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(0);
  const [total,   setTotal]   = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('staff_logs')
      .select('*, users(name, role)', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (dateFrom) query = query.gte('timestamp', `${dateFrom}T00:00:00`);
    if (dateTo)   query = query.lte('timestamp', `${dateTo}T23:59:59`);

    const { data, count } = await query;
    if (data) setLogs(data.map((l: any) => ({ ...l, created_at: l.timestamp })) as StaffLog[]);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [page, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(s) ||
      (l.users?.name ?? '').toLowerCase().includes(s) ||
      (l.table_affected ?? '').toLowerCase().includes(s) ||
      (l.details ? JSON.stringify(l.details).toLowerCase().includes(s) : false)
    );
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AppLayout title="Audit Log" subtitle="Complete activity trail of all staff actions"
      actions={
        <Button variant="ghost" size="sm" icon={<Download size={14} />}
          onClick={() => toast.success('Export coming soon!')}>
          Export CSV
        </Button>
      }>
      <div className="space-y-4 pb-6">

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48">
            <Input id="audit-search" placeholder="Search by action, staff, table..." value={search}
              onChange={e => setSearch(e.target.value)} icon={<Search size={14} />} />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-surface-400" />
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }}
              className="px-2 py-1.5 text-xs rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-brand-500 outline-none" />
            <span className="text-surface-400 text-xs">to</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }}
              className="px-2 py-1.5 text-xs rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-brand-500 outline-none" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setPage(0); }}>
            Clear
          </Button>
        </div>

        {/* Table */}
        <Card noPad>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-200 dark:border-surface-700">
            <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">
              Activity Log
            </p>
            <span className="text-xs text-surface-400">{total.toLocaleString()} total entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-100 dark:border-surface-800">
                  {['Time', 'Staff', 'Role', 'Action', 'Table / Record', 'Details'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-surface-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 bg-surface-200 dark:bg-surface-700 rounded animate-pulse" style={{ width: `${40 + Math.random() * 40}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-surface-400 text-sm">
                      {search ? 'No matching logs found' : 'No activity logged yet'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((log, i) => {
                    const actionCfg = ACTION_CONFIG[log.action] ?? { icon: FileText, color: 'bg-surface-200 text-surface-500', label: log.action };
                    const Icon = actionCfg.icon;
                    return (
                      <motion.tr key={log.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.015 }}
                        className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-xs text-surface-500">{formatElapsed(log.created_at)}</p>
                          <p className="text-[10px] text-surface-400">
                            {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-[9px] font-bold">
                                {(log.users?.name ?? 'S').charAt(0)}
                              </span>
                            </div>
                            <span className="text-xs font-medium text-surface-800 dark:text-surface-200 whitespace-nowrap">
                              {log.users?.name ?? 'System'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {log.users?.role && (
                            <RoleBadge role={log.users.role as any} />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className={cn('w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0', actionCfg.color)}>
                              <Icon size={11} />
                            </div>
                            <span className="text-xs font-medium text-surface-700 dark:text-surface-300 whitespace-nowrap">
                              {actionCfg.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-surface-500">
                          {log.table_affected ?? '—'}
                          {log.record_id && (
                            <span className="text-[10px] text-surface-400 ml-1">#{log.record_id.slice(-6)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-48">
                          <p className="text-xs text-surface-400 truncate">
                            {log.details ? JSON.stringify(log.details).slice(0, 50) : '—'}
                          </p>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-surface-200 dark:border-surface-700">
              <span className="text-xs text-surface-400">
                Page {page + 1} of {totalPages} ({total} entries)
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="xs" icon={<ChevronLeft size={13} />}
                  disabled={page === 0} onClick={() => setPage(p => p - 1)} />
                <span className="text-xs font-medium text-surface-600 dark:text-surface-400 px-2">
                  {page + 1}
                </span>
                <Button variant="ghost" size="xs" icon={<ChevronRight size={13} />}
                  disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} />
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default AuditLog;
