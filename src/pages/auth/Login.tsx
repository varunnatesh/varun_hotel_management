import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  Eye, EyeOff, Lock, ArrowRight, ChevronLeft,
  Sparkles, Shield, Zap,
} from 'lucide-react';
import { useAuthStore, ROLE_HOME } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';

// ─── Role config ─────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, { label: string; emoji: string; gradient: string; glow: string }> = {
  owner:         { label: 'Owner',              emoji: '👑', gradient: 'from-violet-600 to-purple-700',   glow: 'shadow-violet-500/40' },
  store_manager: { label: 'Store Manager',      emoji: '🏪', gradient: 'from-blue-600 to-indigo-700',    glow: 'shadow-blue-500/40' },
  kitchen:       { label: 'Kitchen Staff',      emoji: '👨‍🍳', gradient: 'from-amber-500 to-orange-700',   glow: 'shadow-amber-500/40' },
  supervisor:    { label: 'Kitchen Supervisor', emoji: '🧑‍🍳', gradient: 'from-yellow-500 to-amber-700',   glow: 'shadow-yellow-500/40' },
  cashier:       { label: 'Cashier',            emoji: '💰', gradient: 'from-emerald-500 to-teal-700',   glow: 'shadow-emerald-500/40' },
  captain:       { label: 'Captain',            emoji: '🫡', gradient: 'from-orange-500 to-red-600',     glow: 'shadow-orange-500/40' },
  guest:         { label: 'Guest',              emoji: '🍽️', gradient: 'from-slate-400 to-slate-600',    glow: 'shadow-slate-400/30' },
};

const ROLE_ORDER = ['owner', 'supervisor', 'store_manager', 'captain', 'cashier', 'kitchen'];

interface StaffUser { id: string; name: string; email: string; role: string; section_assigned?: string; }

// ─── Floating Orb ────────────────────────────────────────────────────────────
const FloatingOrb: React.FC<{ cx: string; cy: string; color: string; size: string; delay: number; duration: number }> =
  ({ cx, cy, color, size, delay, duration }) => (
    <motion.div
      className={cn('absolute rounded-full blur-3xl opacity-20 pointer-events-none', size, color)}
      style={{ left: cx, top: cy }}
      animate={{ y: [0, -30, 0], x: [0, 15, 0], scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
    />
  );

// ─── Login Page ───────────────────────────────────────────────────────────────
const Login: React.FC = () => {
  const navigate  = useNavigate();
  const { login, isLoading, error, clearError, user } = useAuthStore();
  const { isDark } = useThemeStore();

  const [step,          setStep]         = useState<'pick' | 'login'>('pick');
  const [staffList,     setStaffList]    = useState<StaffUser[]>([]);
  const [loadingStaff,  setLoadingStaff] = useState(true);
  const [selected,      setSelected]     = useState<StaffUser | null>(null);
  const [password,      setPassword]     = useState('');
  const [showPwd,       setShowPwd]      = useState(false);
  const [touched,       setTouched]      = useState(false);
  const [imgLoaded,     setImgLoaded]    = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate(ROLE_HOME[user.role] ?? '/owner/dashboard', { replace: true });
  }, [user, navigate]);

  // ─── Cache-first staff loader ─────────────────────────────
  // Strategy: show cached data instantly, refresh in background
  const CACHE_KEY = 'varun_hotel_staff_v1';
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  useEffect(() => {
    const loadStaff = async () => {
      // 1. Try localStorage cache first — instant display
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data: cachedData, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL && cachedData?.length > 0) {
            setStaffList(cachedData);   // instant — no spinner
            setLoadingStaff(false);
            // 2. Still refresh in background silently
            supabase.from('users').select('id, name, email, role, section_assigned')
              .eq('is_active', true).order('role')
              .then(({ data }) => {
                if (data) {
                  setStaffList(data as StaffUser[]);
                  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
                }
              });
            return;
          }
        }
      } catch (_) {}

      // 3. No cache — fetch fresh
      setLoadingStaff(true);
      const { data } = await supabase
        .from('users')
        .select('id, name, email, role, section_assigned')
        .eq('is_active', true)
        .order('role');
      if (data) {
        setStaffList(data as StaffUser[]);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
      }
      setLoadingStaff(false);
    };
    loadStaff();
  }, []);

  const sorted = [...staffList].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  );

  const passwordError = touched && password.length < 6 ? 'Min. 6 characters' : '';

  const handlePickStaff = (member: StaffUser) => {
    setSelected(member);
    setPassword('');
    setTouched(false);
    clearError();
    setStep('login');
    setTimeout(() => passwordRef.current?.focus(), 400);
  };

  const handleBack = () => {
    setStep('pick');
    setSelected(null);
    setPassword('');
    setTouched(false);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    clearError();
    if (password.length < 6) return;
    const { error: loginError } = await login(selected!.email, password);
    if (!loginError) {
      navigate(ROLE_HOME[selected!.role as keyof typeof ROLE_HOME] ?? '/owner/dashboard', { replace: true });
    }
  };

  return (
    <div className={cn('min-h-screen flex overflow-hidden bg-[#080c14]', isDark ? 'dark' : '')}>

      {/* ── Left Panel: Hero Image ── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden">
        {/* Hero image */}
        <motion.img
          src="/hotel_hero.png"
          alt="Varun Hotel"
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ scale: 1.08, opacity: 0 }}
          animate={{ scale: imgLoaded ? 1 : 1.08, opacity: imgLoaded ? 1 : 0 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          onLoad={() => setImgLoaded(true)}
        />

        {/* Dark overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#080c14]/80 via-[#080c14]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080c14]/90 via-transparent to-[#080c14]/30" />

        {/* Content over image */}
        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          {/* Logo */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.7 }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <span className="text-xl">🏨</span>
              </div>
              <div>
                <p className="text-white font-bold text-xl tracking-tight">Varun Hotel</p>
                <p className="text-white/50 text-xs">Management Platform</p>
              </div>
            </div>
          </motion.div>

          {/* Center headline */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/8 border border-white/10 mb-6 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/70 text-xs font-medium">System Live — All services running</span>
            </div>

            <h1 className="text-5xl font-black text-white leading-[1.1] mb-5 tracking-tight">
              Complete<br />
              <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                Hotel Control
              </span><br />
              Platform
            </h1>

            <p className="text-white/60 text-base leading-relaxed max-w-sm">
              Track every order, every rupee, every material — all in real time. Built for Indian hotels.
            </p>
          </motion.div>

          {/* Bottom stats */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.6 }}>
            <div className="grid grid-cols-3 gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              {[
                { icon: Zap,      label: 'Real-time KDS',    value: 'Kitchen Display' },
                { icon: Shield,   label: 'Fraud Detection',  value: 'Auto Alerts' },
                { icon: Sparkles, label: 'Staff Roles',      value: '6 Role Types' },
              ].map(({ icon: Icon, label, value }, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 + i * 0.1 }}>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center mb-2">
                    <Icon size={14} className="text-amber-400" />
                  </div>
                  <p className="text-white text-sm font-semibold">{value}</p>
                  <p className="text-white/40 text-xs">{label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col relative bg-[#080c14] overflow-hidden">
        {/* Floating orbs background */}
        <FloatingOrb cx="20%"  cy="10%"  color="bg-violet-600" size="w-72 h-72" delay={0}   duration={8} />
        <FloatingOrb cx="70%"  cy="60%"  color="bg-amber-500"  size="w-56 h-56" delay={2}   duration={10} />
        <FloatingOrb cx="10%"  cy="70%"  color="bg-blue-600"   size="w-48 h-48" delay={1}   duration={9} />
        <FloatingOrb cx="80%"  cy="5%"   color="bg-emerald-600"size="w-40 h-40" delay={3}   duration={7} />

        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Mobile logo */}
        <div className="flex items-center gap-3 p-6 lg:hidden relative z-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
            <span className="text-lg">🏨</span>
          </div>
          <div>
            <p className="text-white font-bold">Varun Hotel</p>
            <p className="text-white/40 text-xs">Management System</p>
          </div>
        </div>

        {/* Center content */}
        <div className="flex-1 flex items-center justify-center p-6 relative z-10">
          <div className="w-full max-w-md">

            <AnimatePresence mode="wait">

              {/* ── STEP 1: Staff Picker ── */}
              {step === 'pick' && (
                <motion.div key="pick"
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>

                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <h2 className="text-3xl font-black text-white mb-1 tracking-tight">Who are you?</h2>
                    <p className="text-white/40 text-sm mb-7">Select your name to continue</p>
                  </motion.div>

                  {loadingStaff ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-[68px] rounded-2xl bg-white/5 animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1 custom-scroll">
                      {sorted.map((member, i) => {
                        const cfg = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.guest;
                        return (
                          <motion.button key={member.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                            whileHover={{ scale: 1.02, x: 4 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handlePickStaff(member)}
                            className="w-full group relative overflow-hidden">

                            {/* Card */}
                            <div className="relative flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-left backdrop-blur-sm">

                              {/* Hover glow */}
                              <div className={cn('absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl -z-10', `bg-gradient-to-r ${cfg.gradient}`)} style={{ opacity: 0 }} />

                              {/* Avatar */}
                              <div className={cn(
                                'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 text-2xl shadow-lg',
                                cfg.gradient, cfg.glow,
                              )}>
                                {cfg.emoji}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-sm leading-tight">{member.name}</p>
                                <p className="text-white/40 text-xs mt-0.5">
                                  {cfg.label}
                                  {member.role === 'captain' && member.section_assigned
                                    ? ` · ${member.section_assigned.split('(')[0].trim()}`
                                    : ''}
                                </p>
                              </div>

                              {/* Arrow */}
                              <motion.div
                                className="text-white/20 group-hover:text-white/70 transition-colors"
                                animate={{ x: 0 }}
                                whileHover={{ x: 4 }}>
                                <ArrowRight size={16} />
                              </motion.div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}

                  <motion.p
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                    className="text-center text-xs text-white/20 mt-6">
                    🔒 Secured by Supabase Auth · End-to-end encrypted
                  </motion.p>
                </motion.div>
              )}

              {/* ── STEP 2: Password ── */}
              {step === 'login' && (
                <motion.div key="login"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>

                  {/* Back */}
                  <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                    onClick={handleBack}
                    className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/80 mb-6 transition-colors group">
                    <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back
                  </motion.button>

                  {/* Selected staff hero card */}
                  {selected && (() => {
                    const cfg = ROLE_CONFIG[selected.role] ?? ROLE_CONFIG.guest;
                    return (
                      <motion.div initial={{ opacity: 0, scale: 0.92, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="relative overflow-hidden rounded-2xl p-5 mb-7 border border-white/10">

                        {/* Gradient background */}
                        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-20', cfg.gradient)} />
                        <div className="absolute inset-0 backdrop-blur-sm bg-white/5" />

                        <div className="relative flex items-center gap-4">
                          <motion.div
                            initial={{ scale: 0 }} animate={{ scale: 1 }}
                            transition={{ delay: 0.25, type: 'spring', stiffness: 300 }}
                            className={cn('w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center text-3xl shadow-xl flex-shrink-0', cfg.gradient, cfg.glow)}>
                            {cfg.emoji}
                          </motion.div>
                          <div>
                            <motion.p initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                              className="text-white font-black text-xl leading-tight">{selected.name}</motion.p>
                            <motion.p initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}
                              className="text-white/50 text-sm">{cfg.label}</motion.p>
                            <motion.p initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                              className="text-white/30 text-xs mt-0.5 font-mono">{selected.email}</motion.p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}

                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h2 className="text-2xl font-black text-white mb-1">Enter your password</h2>
                    <p className="text-white/40 text-sm mb-6">
                      Signing in as <span className="text-white/70 font-semibold">{selected?.name}</span>
                    </p>
                  </motion.div>

                  <motion.form onSubmit={handleSubmit} className="space-y-4"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>

                    {/* Password field */}
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none z-10">
                        <Lock size={16} />
                      </div>
                      <input
                        ref={passwordRef}
                        type={showPwd ? 'text' : 'password'}
                        value={password}
                        onChange={e => { setPassword(e.target.value); clearError(); }}
                        onBlur={() => setTouched(true)}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        style={{
                          colorScheme: 'dark',
                          color: '#ffffff',
                          caretColor: '#f59e0b',
                          WebkitTextFillColor: showPwd ? '#ffffff' : undefined,
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          // Override browser autofill background colour
                          WebkitBoxShadow: '0 0 0 1000px rgba(255,255,255,0.08) inset',
                        }}
                        className={cn(
                          'w-full pl-11 pr-12 py-4 rounded-2xl text-sm font-medium text-white',
                          'border backdrop-blur-sm outline-none transition-all duration-200',
                          'focus:bg-white/12 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20',
                          'placeholder:text-white/30',
                          passwordError || error
                            ? 'border-red-500/40 bg-red-500/8'
                            : 'border-white/12 hover:border-white/20',
                        )}
                      />
                      <button type="button" onClick={() => setShowPwd(s => !s)}
                        aria-label={showPwd ? 'Hide password' : 'Show password'}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white/40 hover:text-amber-400 transition-colors p-1">
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-white/25 text-xs pl-1">Password is case-sensitive</p>

                    {/* Error messages */}
                    <AnimatePresence>
                      {(passwordError || error) && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 overflow-hidden">
                          <span className="text-xs text-red-400">{error || passwordError}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Submit button */}
                    <motion.button type="submit" disabled={isLoading}
                      whileHover={{ scale: isLoading ? 1 : 1.02 }}
                      whileTap={{ scale: isLoading ? 1 : 0.98 }}
                      className={cn(
                        'w-full relative overflow-hidden py-4 px-6 rounded-2xl font-bold text-sm transition-all duration-300',
                        'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
                        'shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/35',
                        isLoading && 'opacity-70 cursor-not-allowed',
                      )}>

                      {/* Shimmer */}
                      <div className="absolute inset-0 overflow-hidden rounded-2xl">
                        <motion.div
                          className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          initial={{ x: '-150%' }}
                          animate={{ x: '150%' }}
                          transition={{ repeat: Infinity, duration: 2.5, ease: 'linear', repeatDelay: 1 }}
                        />
                      </div>

                      <span className="relative flex items-center justify-center gap-2">
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            Signing in…
                          </>
                        ) : (
                          <>
                            Sign in as {selected?.name}
                            <ArrowRight size={16} />
                          </>
                        )}
                      </span>
                    </motion.button>
                  </motion.form>

                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                    className="text-center text-xs text-white/20 mt-6">
                    🔒 Secured by Supabase Auth · End-to-end encrypted
                  </motion.p>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Custom scrollbar style */}
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};

export default Login;
