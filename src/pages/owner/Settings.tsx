import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Hotel, Phone, Mail, MapPin, Clock,
  Save, CheckCircle, Palette, Globe, Shield,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useThemeStore } from '../../store/themeStore';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const SettingsPage: React.FC = () => {
  const { isDark, toggle } = useThemeStore();
  const [saved, setSaved]  = useState(false);
  const [form, setForm]    = useState({
    hotelName:    localStorage.getItem('hotel_name')    || 'Varun Hotel',
    address:      localStorage.getItem('hotel_address') || '',
    phone:        localStorage.getItem('hotel_phone')   || '',
    email:        localStorage.getItem('hotel_email')   || '',
    gstNumber:    localStorage.getItem('hotel_gst')     || '',
    fssaiNumber:  localStorage.getItem('hotel_fssai')   || '',
    openTime:     localStorage.getItem('hotel_open')    || '07:00',
    closeTime:    localStorage.getItem('hotel_close')   || '23:00',
    currency:     'INR',
    taxRate:      localStorage.getItem('hotel_tax')     || '5',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    Object.entries(form).forEach(([k, v]) => {
      const key = k === 'hotelName' ? 'hotel_name'
        : k === 'address' ? 'hotel_address'
        : k === 'phone'   ? 'hotel_phone'
        : k === 'email'   ? 'hotel_email'
        : k === 'gstNumber' ? 'hotel_gst'
        : k === 'fssaiNumber' ? 'hotel_fssai'
        : k === 'openTime' ? 'hotel_open'
        : k === 'closeTime' ? 'hotel_close'
        : k === 'taxRate' ? 'hotel_tax' : k;
      localStorage.setItem(key, v);
    });
    setSaved(true);
    toast.success('Settings saved!');
    setTimeout(() => setSaved(false), 2000);
  };

  const ACCENT_COLORS = [
    { label: 'Indigo',   value: 'indigo',  class: 'bg-indigo-500' },
    { label: 'Violet',   value: 'violet',  class: 'bg-violet-500' },
    { label: 'Blue',     value: 'blue',    class: 'bg-blue-500' },
    { label: 'Emerald',  value: 'emerald', class: 'bg-emerald-500' },
    { label: 'Rose',     value: 'rose',    class: 'bg-rose-500' },
    { label: 'Amber',    value: 'amber',   class: 'bg-amber-500' },
  ];

  return (
    <AppLayout title="Settings" subtitle="Hotel profile, preferences, and system configuration"
      actions={
        <Button variant="primary" size="sm"
          icon={saved ? <CheckCircle size={14} /> : <Save size={14} />}
          onClick={handleSave}
          className={saved ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600' : ''}>
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      }>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pb-6">

        {/* Left: Hotel Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Hotel Profile */}
          <Card>
            <CardHeader title="Hotel Profile" icon={<Hotel size={15} />}
              iconBg="bg-brand-500/12 text-brand-500" />
            <div className="space-y-3">
              <Input label="Hotel Name" id="s-name" value={form.hotelName}
                onChange={e => set('hotelName', e.target.value)} placeholder="Varun Hotel" />
              <Input label="Address" id="s-addr" value={form.address}
                onChange={e => set('address', e.target.value)} placeholder="123 Main St, City, State" icon={<MapPin size={13} />} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Phone" id="s-ph" value={form.phone}
                  onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" icon={<Phone size={13} />} />
                <Input label="Email" id="s-em" type="email" value={form.email}
                  onChange={e => set('email', e.target.value)} placeholder="info@varunhotel.com" icon={<Mail size={13} />} />
              </div>
            </div>
          </Card>

          {/* Tax & Compliance */}
          <Card>
            <CardHeader title="Tax & Compliance" icon={<Shield size={15} />}
              iconBg="bg-amber-500/12 text-amber-500" />
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="GST Number" id="s-gst" value={form.gstNumber}
                  onChange={e => set('gstNumber', e.target.value)} placeholder="22AAAAA0000A1Z5" />
                <Input label="FSSAI License" id="s-fssai" value={form.fssaiNumber}
                  onChange={e => set('fssaiNumber', e.target.value)} placeholder="12345678901234" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="GST / Tax Rate (%)" id="s-tax" type="number" value={form.taxRate}
                  onChange={e => set('taxRate', e.target.value)} placeholder="5" min="0" max="28" step="0.5" />
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Currency</label>
                  <select value={form.currency} onChange={e => set('currency', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                    <option value="INR">₹ INR — Indian Rupee</option>
                    <option value="USD">$ USD — US Dollar</option>
                    <option value="EUR">€ EUR — Euro</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Operating Hours */}
          <Card>
            <CardHeader title="Operating Hours" icon={<Clock size={15} />}
              iconBg="bg-teal-500/12 text-teal-500" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Opening Time" id="s-open" type="time" value={form.openTime}
                onChange={e => set('openTime', e.target.value)} />
              <Input label="Closing Time" id="s-close" type="time" value={form.closeTime}
                onChange={e => set('closeTime', e.target.value)} />
            </div>
          </Card>
        </div>

        {/* Right: Appearance */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Appearance" icon={<Palette size={15} />}
              iconBg="bg-violet-500/12 text-violet-500" />

            {/* Dark mode toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-700/40 border border-surface-200 dark:border-surface-700 mb-4">
              <div>
                <p className="text-sm font-medium text-surface-800 dark:text-surface-200">Dark Mode</p>
                <p className="text-xs text-surface-400">Switch between light and dark</p>
              </div>
              <button onClick={toggle}
                className={cn('relative w-12 h-6 rounded-full transition-colors duration-300',
                  isDark ? 'bg-brand-500' : 'bg-surface-300')}>
                <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300',
                  isDark && 'translate-x-6')} />
              </button>
            </div>

            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Current Theme</p>
            <div className="grid grid-cols-3 gap-2">
              {ACCENT_COLORS.map(c => (
                <div key={c.value} className={cn('w-full aspect-square rounded-xl cursor-pointer border-2 border-surface-200 dark:border-surface-700 hover:scale-110 transition-transform', c.class)} title={c.label} />
              ))}
            </div>
            <p className="text-xs text-surface-400 mt-2 text-center">Theme customization coming soon</p>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader title="System Info" icon={<Globe size={15} />}
              iconBg="bg-surface-200 text-surface-500 dark:bg-surface-700" />
            <div className="space-y-2 text-xs">
              {[
                { label: 'Version',    value: 'v2.0.0' },
                { label: 'Database',   value: 'Supabase (Singapore)' },
                { label: 'Auth',       value: 'Supabase Auth' },
                { label: 'Framework',  value: 'React 19 + Vite' },
                { label: 'Built with', value: '❤️ by Antigravity AI' },
              ].map(row => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-surface-400">{row.label}</span>
                  <span className="font-medium text-surface-600 dark:text-surface-300">{row.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
