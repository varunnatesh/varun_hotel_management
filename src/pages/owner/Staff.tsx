import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, CheckCircle, AlertCircle, RefreshCw, Edit2,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import type { UserRole } from '../../types';

// ─── Constants ─────────────────────────────────────────────────────────────────
const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'supervisor',    label: 'Kitchen Supervisor', desc: 'Manages kitchen, reports to store' },
  { value: 'store_manager', label: 'Store Manager',      desc: 'Manages inventory & purchases' },
  { value: 'captain',       label: 'Captain',            desc: 'Takes table orders, requests bills' },
  { value: 'cashier',       label: 'Cashier',            desc: 'Creates orders & collects bills' },
  { value: 'kitchen',       label: 'Kitchen Staff',      desc: 'Views & updates kitchen orders' },
];

const ROLE_DISPLAY: Record<string, {
  emoji: string; gradient: string; border: string; bg: string; text: string; ringColor: string;
}> = {
  supervisor:    { emoji: '🧑‍🍳', gradient: 'from-yellow-500 to-amber-600',  border: 'border-yellow-500/25', bg: 'bg-yellow-500/8',  text: 'text-yellow-700 dark:text-yellow-400', ringColor: 'ring-yellow-500/20' },
  store_manager: { emoji: '🏪',   gradient: 'from-blue-500 to-indigo-600',   border: 'border-blue-500/25',   bg: 'bg-blue-500/8',    text: 'text-blue-700 dark:text-blue-400',     ringColor: 'ring-blue-500/20' },
  captain:       { emoji: '🫡',   gradient: 'from-orange-500 to-red-500',    border: 'border-orange-500/25', bg: 'bg-orange-500/8',  text: 'text-orange-700 dark:text-orange-400', ringColor: 'ring-orange-500/20' },
  cashier:       { emoji: '💰',   gradient: 'from-emerald-500 to-teal-600',  border: 'border-emerald-500/25',bg: 'bg-emerald-500/8', text: 'text-emerald-700 dark:text-emerald-400',ringColor: 'ring-emerald-500/20' },
  kitchen:       { emoji: '👨‍🍳',  gradient: 'from-amber-500 to-orange-600', border: 'border-amber-500/25',  bg: 'bg-amber-500/8',   text: 'text-amber-700 dark:text-amber-400',   ringColor: 'ring-amber-500/20' },
};

const ROLE_ORDER = ['supervisor', 'store_manager', 'captain', 'cashier', 'kitchen'];

const SECTIONS = ['Section A (T1–T6)', 'Section B (T7–T10)', 'Section C (T11–T14)', 'VIP (T15–T16)', 'All Tables'];

interface StaffMember {
  id: string; name: string; email: string; role: UserRole;
  phone?: string; is_active: boolean; section_assigned?: string; created_at: string;
}

const EMPTY_FORM = { name: '', email: '', phone: '', role: 'cashier' as UserRole, section_assigned: '' };

// ─── Edit Role Modal ────────────────────────────────────────────────────────────
const EditRoleModal: React.FC<{
  member: StaffMember | null; onClose: () => void;
  onSave: (id: string, role: UserRole, section: string) => Promise<void>;
}> = ({ member, onClose, onSave }) => {
  const [role,    setRole]    = useState<UserRole>(member?.role ?? 'cashier');
  const [section, setSection] = useState(member?.section_assigned ?? '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (member) { setRole(member.role); setSection(member.section_assigned ?? ''); }
  }, [member]);

  const handleSave = async () => {
    if (!member) return;
    setLoading(true);
    await onSave(member.id, role, section);
    setLoading(false);
    onClose();
  };

  return (
    <Modal open={!!member} onClose={onClose} title={`Edit Role — ${member?.name ?? ''}`} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Select New Role
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(r => {
              const d = ROLE_DISPLAY[r.value];
              return (
                <button key={r.value} type="button" onClick={() => setRole(r.value)}
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all',
                    role === r.value
                      ? `${d.border} ${d.bg} ring-2 ${d.ringColor}`
                      : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700',
                  )}>
                  <span className="text-base">{d.emoji}</span>
                  <div>
                    <p className={cn('text-xs font-bold', role === r.value ? d.text : 'text-surface-900 dark:text-surface-100')}>{r.label}</p>
                    <p className="text-[10px] text-surface-400">{r.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {role === 'captain' && (
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
              Table Section
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SECTIONS.map(s => (
                <button key={s} type="button" onClick={() => setSection(s)}
                  className={cn('py-2 px-3 rounded-xl border text-xs font-medium text-left transition-all',
                    section === s
                      ? 'border-orange-500 bg-orange-500/8 text-orange-700 dark:text-orange-400'
                      : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-700')}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" fullWidth loading={loading} onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Add Staff Modal ────────────────────────────────────────────────────────────
const AddStaffModal: React.FC<{
  open: boolean; onClose: () => void; onAdd: (d: any) => Promise<boolean>;
}> = ({ open, onClose, onAdd }) => {
  const [step,    setStep]    = useState<'guide' | 'form'>('guide');
  const [form,    setForm]    = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [errMsg,  setErrMsg]  = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleClose = () => {
    if (loading) return;
    setStep('guide'); setForm(EMPTY_FORM); setErrMsg(''); onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg('');
    if (!form.email.trim()) { setErrMsg('Email is required.'); return; }
    if (!form.name.trim())  { setErrMsg('Full name is required.'); return; }
    setLoading(true);
    const ok = await onAdd(form);
    setLoading(false);
    if (ok) { setStep('guide'); setForm(EMPTY_FORM); onClose(); }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Add New Staff Member" size="md">
      <AnimatePresence mode="wait">

        {step === 'guide' && (
          <motion.div key="guide"
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
            className="space-y-5">

            <div className="p-4 rounded-2xl bg-brand-500/8 border border-brand-500/20">
              <p className="text-sm font-bold text-brand-700 dark:text-brand-300 mb-1">
                2-step staff setup (no emails sent)
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
                Create the login account in Supabase Dashboard first, then link the profile here.
              </p>
            </div>

            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold mt-0.5">1</div>
              <div>
                <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">Create login in Supabase Dashboard</p>
                <p className="text-xs text-surface-400 mt-1 leading-relaxed">
                  Go to <span className="font-mono bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded text-brand-600 dark:text-brand-400 text-[11px]">Authentication → Users → Add user → Create new user</span>
                </p>
                <p className="text-xs text-surface-400 mt-1.5 leading-relaxed">
                  Enter the staff email + password. <strong className="text-surface-600 dark:text-surface-300">No confirmation email</strong> is sent from the dashboard.
                </p>
              </div>
            </div>

            <div className="ml-3.5 border-l-2 border-dashed border-surface-200 dark:border-surface-700 h-4" />

            <div className="flex gap-3 items-start -mt-2">
              <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold mt-0.5">2</div>
              <div>
                <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">Come back and click "Done — Link Profile"</p>
                <p className="text-xs text-surface-400 mt-1 leading-relaxed">
                  Enter their name, role and section. We'll find their Supabase account by email and link it.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="ghost" fullWidth onClick={handleClose}>Cancel</Button>
              <Button variant="primary" fullWidth icon={<CheckCircle size={14} />}
                onClick={() => { setErrMsg(''); setStep('form'); }}>
                Done — Link Profile
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'form' && (
          <motion.div key="form"
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
            <form onSubmit={handleSubmit} className="space-y-4">

              <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                ⚠️ Enter the <strong>exact same email</strong> you used in Supabase Auth dashboard.
              </div>

              <Input label="Staff Email *" id="staff-email" type="email" value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="same email as Supabase Auth" />

              <div className="grid grid-cols-2 gap-3">
                <Input label="Full Name *" id="staff-name" value={form.name}
                  onChange={e => set('name', e.target.value)} placeholder="e.g. Priya Sharma" />
                <Input label="Phone" id="staff-phone" value={form.phone}
                  onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Role *</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(r => {
                    const d = ROLE_DISPLAY[r.value];
                    return (
                      <button key={r.value} type="button" onClick={() => set('role', r.value)}
                        className={cn('flex items-center gap-2 p-3 rounded-xl border text-left transition-all',
                          form.role === r.value
                            ? `${d.border} ${d.bg} ring-2 ${d.ringColor}`
                            : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700')}>
                        <span className="text-base">{d.emoji}</span>
                        <div>
                          <p className={cn('text-xs font-bold', form.role === r.value ? d.text : 'text-surface-900 dark:text-surface-100')}>{r.label}</p>
                          <p className="text-[10px] text-surface-400">{r.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.role === 'captain' && (
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Assign Table Section</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SECTIONS.map(s => (
                      <button key={s} type="button" onClick={() => set('section_assigned', s)}
                        className={cn('py-2 px-3 rounded-xl border text-xs font-medium text-left transition-all',
                          form.section_assigned === s
                            ? 'border-orange-500 bg-orange-500/8 text-orange-700 dark:text-orange-400'
                            : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-700')}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <AnimatePresence>
                {errMsg && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-700 dark:text-red-400">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      {errMsg}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="ghost" fullWidth disabled={loading}
                  onClick={() => { setErrMsg(''); setStep('guide'); }}>Back</Button>
                <Button type="submit" variant="primary" fullWidth loading={loading} icon={<UserPlus size={14} />}>
                  {loading ? 'Linking…' : 'Link Staff Profile'}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
};

// ─── Staff Management Page ──────────────────────────────────────────────────────
const StaffManagement: React.FC = () => {
  const { user }                    = useAuthStore();
  const [staff,      setStaff]      = useState<StaffMember[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [addOpen,    setAddOpen]    = useState(false);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users').select('*')
      .neq('role', 'owner').neq('role', 'guest')
      .order('name');
    if (error) toast.error(`Load failed: ${error.message}`);
    if (data)  setStaff(data as StaffMember[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleAdd = async (formData: any): Promise<boolean> => {
    const { data, error } = await supabase.rpc('link_staff_profile', {
      p_email:   formData.email.toLowerCase().trim(),
      p_name:    formData.name.trim(),
      p_role:    formData.role,
      p_phone:   formData.phone || null,
      p_section: formData.role === 'captain' ? (formData.section_assigned || null) : null,
    });
    if (error) { toast.error(error.message); return false; }
    if (data?.error) { toast.error(data.error); return false; }
    toast.success(`✅ ${formData.name} linked as ${formData.role.replace('_', ' ')}!`);
    fetchStaff();
    return true;
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.rpc('update_user_active', {
      p_user_id:   id,
      p_is_active: !current,
    });
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    setStaff(s => s.map(m => m.id === id ? { ...m, is_active: !current } : m));
    toast.success(current ? 'Deactivated' : 'Activated');
  };

  const handleEditRole = async (id: string, role: UserRole, section: string) => {
    const { error } = await supabase.rpc('update_user_role', {
      p_user_id: id,
      p_role:    role,
      p_section: role === 'captain' ? section || null : null,
    });

    if (error) { toast.error(`Failed: ${error.message}`); return; }

    setStaff(s => s.map(m => m.id === id
      ? { ...m, role, section_assigned: role === 'captain' ? section || undefined : undefined }
      : m));
    toast.success('✅ Role updated!');
    localStorage.removeItem('varun_hotel_staff_v1');
  };

  return (
    <AppLayout title="Staff Management"
      subtitle="Manage your hotel staff accounts and roles"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm"
            icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            onClick={fetchStaff} disabled={loading}>Refresh</Button>
          <Button variant="primary" size="sm" icon={<UserPlus size={14} />}
            onClick={() => setAddOpen(true)}>Add Staff</Button>
        </div>
      }>
      <div className="space-y-5 pb-6">

        {/* ── Role count summary strip ─────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {ROLE_ORDER.map(rk => {
            const d   = ROLE_DISPLAY[rk];
            const def = ROLES.find(r => r.value === rk);
            const cnt = staff.filter(s => s.role === rk).length;
            const act = staff.filter(s => s.role === rk && s.is_active).length;
            return (
              <div key={rk} className={cn('p-4 rounded-2xl border', d.border, d.bg)}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl">{d.emoji}</span>
                  <p className={cn('text-2xl font-black', d.text)}>{loading ? '—' : cnt}</p>
                </div>
                <p className="text-xs font-bold text-surface-700 dark:text-surface-300">{def?.label}</p>
                <p className="text-[10px] text-surface-400 mt-0.5">{loading ? '' : `${act} active`}</p>
              </div>
            );
          })}
        </div>

        {/* ── Main content ─────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-2xl bg-surface-100 dark:bg-surface-800 animate-pulse" />)}
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-surface-400">
            <Users size={40} className="opacity-20" />
            <p className="text-sm font-medium">No staff members yet</p>
            <Button variant="primary" size="sm" icon={<UserPlus size={14} />} onClick={() => setAddOpen(true)}>
              Add First Staff Member
            </Button>
          </div>
        ) : (
          // ── GROUPED BY ROLE ────────────────────────────────────
          <div className="space-y-4">
            {ROLE_ORDER.map(roleKey => {
              const d       = ROLE_DISPLAY[roleKey];
              const def     = ROLES.find(r => r.value === roleKey);
              const members = staff.filter(s => s.role === roleKey);
              if (!members.length) return null;

              return (
                <motion.div key={roleKey}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={cn('rounded-2xl border overflow-hidden', d.border)}>

                  {/* Role group header */}
                  <div className={cn('flex items-center gap-3 px-5 py-3.5', d.bg, 'border-b', d.border)}>
                    <div className={cn(
                      'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-xl shadow-sm',
                      d.gradient,
                    )}>
                      {d.emoji}
                    </div>
                    <div className="flex-1">
                      <p className={cn('font-black text-sm', d.text)}>{def?.label}</p>
                      <p className="text-xs text-surface-400">{def?.desc}</p>
                    </div>
                    <span className={cn('text-xs font-bold px-3 py-1 rounded-full border', d.bg, d.text, d.border)}>
                      {members.length} {members.length === 1 ? 'person' : 'people'}
                    </span>
                  </div>

                  {/* Member rows */}
                  <div className="bg-white dark:bg-surface-900 divide-y divide-surface-100 dark:divide-surface-800">
                    {members.map((m, i) => (
                      <motion.div key={m.id}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 dark:hover:bg-surface-800/60 transition-colors">

                        {/* Avatar */}
                        <div className={cn(
                          'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center',
                          'flex-shrink-0 text-white font-black text-base shadow-sm',
                          d.gradient,
                        )}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-surface-900 dark:text-surface-100">{m.name}</p>
                          <p className="text-xs text-surface-400 truncate">{m.email}</p>
                          {m.role === 'captain' && m.section_assigned && (
                            <span className="inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                              {m.section_assigned.split('(')[0].trim()}
                            </span>
                          )}
                        </div>

                        {/* Phone */}
                        <span className="hidden lg:block text-xs text-surface-400 whitespace-nowrap">
                          {m.phone ?? '—'}
                        </span>

                        {/* Active status */}
                        <span className={cn(
                          'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap',
                          m.is_active
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-surface-200 dark:bg-surface-700 text-surface-500',
                        )}>
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
                            m.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-surface-400')} />
                          {m.is_active ? 'Active' : 'Off'}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Button variant="ghost" size="xs" icon={<Edit2 size={12} />}
                            onClick={() => setEditMember(m)}>
                            Edit Role
                          </Button>
                          <Button variant="ghost" size="xs"
                            onClick={() => handleToggleActive(m.id, m.is_active)}>
                            {m.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Permission fix hint ───────────────────────────────── */}
        <div className="p-4 rounded-2xl bg-amber-500/6 border border-amber-500/15">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
            ⚠️ If you see "Permission denied" when editing roles
          </p>
          <p className="text-[11px] text-surface-500 mb-2">
            Run this in Supabase → SQL Editor to disable RLS on users table:
          </p>
          <code className="block text-[11px] font-mono bg-surface-100 dark:bg-surface-800 px-3 py-2 rounded-xl text-surface-700 dark:text-surface-300">
            ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
          </code>
        </div>

      </div>

      <AddStaffModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      <EditRoleModal member={editMember} onClose={() => setEditMember(null)} onSave={handleEditRole} />
    </AppLayout>
  );
};

export default StaffManagement;
