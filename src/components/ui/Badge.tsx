import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

type BadgeVariant = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal' | 'neutral' | 'outline';
type BadgeSize    = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?:    BadgeSize;
  dot?:     boolean;
  pulse?:   boolean;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  blue:    'bg-blue-500/12 text-blue-700 dark:text-blue-300 border border-blue-500/20',
  green:   'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20',
  amber:   'bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/20',
  red:     'bg-red-500/12 text-red-700 dark:text-red-300 border border-red-500/20',
  purple:  'bg-violet-500/12 text-violet-700 dark:text-violet-300 border border-violet-500/20',
  teal:    'bg-teal-500/12 text-teal-700 dark:text-teal-300 border border-teal-500/20',
  neutral: 'bg-surface-100 dark:bg-surface-700/50 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-600',
  outline: 'bg-transparent text-surface-600 dark:text-surface-400 border border-surface-300 dark:border-surface-600',
};

const dotColors: Record<BadgeVariant, string> = {
  blue:    'bg-blue-500',
  green:   'bg-emerald-500',
  amber:   'bg-amber-500',
  red:     'bg-red-500',
  purple:  'bg-violet-500',
  teal:    'bg-teal-500',
  neutral: 'bg-surface-400',
  outline: 'bg-surface-400',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  dot = false,
  pulse = false,
  children,
  className,
}) => (
  <span
    className={cn(
      'inline-flex items-center font-medium rounded-full',
      variantStyles[variant],
      sizeStyles[size],
      className,
    )}
  >
    {dot && (
      <span className="relative flex-shrink-0">
        <span className={cn('block rounded-full', size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2', dotColors[variant])} />
        {pulse && (
          <span className={cn(
            'absolute inset-0 rounded-full animate-ping-slow opacity-75',
            dotColors[variant],
          )} />
        )}
      </span>
    )}
    {children}
  </span>
);

// ─── Status Badge (order/stock/approval statuses) ─────────────────────────────
const STATUS_MAP: Record<string, BadgeVariant> = {
  pending:          'amber',
  preparing:        'blue',
  ready:            'green',
  served:           'teal',
  billed:           'neutral',
  cancelled:        'red',
  approved:         'green',
  rejected:         'red',
  pending_approval: 'amber',
  critical:         'red',
  low:              'amber',
  healthy:          'green',
  active:           'green',
  inactive:         'neutral',
};

const STATUS_LABELS: Record<string, string> = {
  pending:          'Pending',
  preparing:        'Preparing',
  ready:            'Ready',
  served:           'Served',
  billed:           'Billed',
  cancelled:        'Cancelled',
  approved:         'Approved',
  rejected:         'Rejected',
  pending_approval: 'Pending Approval',
  critical:         'Critical',
  low:              'Low Stock',
  healthy:          'Healthy',
  active:           'Active',
  inactive:         'Inactive',
};

interface StatusBadgeProps {
  status: string;
  dot?:   boolean;
  pulse?: boolean;
  size?:  BadgeSize;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, dot = true, pulse, size }) => (
  <Badge variant={STATUS_MAP[status] ?? 'neutral'} dot={dot} pulse={pulse} size={size}>
    {STATUS_LABELS[status] ?? status}
  </Badge>
);

// ─── Role Badge ───────────────────────────────────────────────────────────────
const ROLE_VARIANT: Record<string, BadgeVariant> = {
  owner:         'purple',
  store_manager: 'blue',
  kitchen:       'amber',
  supervisor:    'amber',
  cashier:       'teal',
  captain:       'amber',
  guest:         'neutral',
};

const ROLE_LABEL: Record<string, string> = {
  owner:         '👑 Owner',
  store_manager: '🏪 Store Manager',
  kitchen:       '👨‍🍳 Kitchen',
  supervisor:    '👨‍🍳 Kitchen Supervisor',
  cashier:       '💰 Cashier',
  captain:       '🫡 Captain',
  guest:         '🍽️ Guest',
};

export const RoleBadge: React.FC<{ role: string; size?: BadgeSize }> = ({ role, size }) => (
  <Badge variant={ROLE_VARIANT[role] ?? 'neutral'} size={size}>
    {ROLE_LABEL[role] ?? role}
  </Badge>
);

// ─── Animated Counter Badge ───────────────────────────────────────────────────
export const CountBadge: React.FC<{ count: number; max?: number; className?: string }> = ({
  count,
  max = 99,
  className,
}) => {
  if (count <= 0) return null;
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1',
        'bg-red-500 text-white text-[10px] font-bold rounded-full',
        className,
      )}
    >
      {count > max ? `${max}+` : count}
    </motion.span>
  );
};

export default Badge;
