import React from 'react';
import { cn } from '../../lib/utils';

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated' | 'flat' | 'gradient';
  lift?:    boolean;
  noPad?:   boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', lift = false, noPad = false, className, children, ...props }, ref) => {
    const baseStyles = 'rounded-2xl transition-all duration-250 ease-smooth';

    const variantStyles: Record<string, string> = {
      default:  'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-card',
      glass:    'bg-white/60 dark:bg-surface-800/60 backdrop-blur-xl border border-white/40 dark:border-white/8 shadow-glass',
      elevated: 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-card-hover',
      flat:     'bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800',
      gradient: 'bg-gradient-to-br from-brand-600 to-brand-800 border border-brand-500/30 text-white shadow-brand',
    };

    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          lift && 'hover:-translate-y-1 hover:shadow-card-hover cursor-pointer',
          !noPad && 'p-5',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Card.displayName = 'Card';

// ─── Card Header ──────────────────────────────────────────────────────────────
interface CardHeaderProps {
  title:       React.ReactNode;
  subtitle?:   React.ReactNode;
  action?:     React.ReactNode;
  icon?:       React.ReactNode;
  iconBg?:     string;
  className?:  string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title, subtitle, action, icon, iconBg, className,
}) => (
  <div className={cn('flex items-start justify-between gap-3 mb-4', className)}>
    <div className="flex items-start gap-3">
      {icon && (
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl',
          iconBg ?? 'bg-brand-500/12 text-brand-600 dark:text-brand-400',
        )}>
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">{title}</h3>
        {subtitle && <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>
);

// ─── Card Divider ─────────────────────────────────────────────────────────────
export const CardDivider: React.FC<{ className?: string }> = ({ className }) => (
  <hr className={cn('border-surface-200 dark:border-surface-700 my-4', className)} />
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label:      string;
  value:      React.ReactNode;
  trend?:     number;   // positive = up, negative = down
  trendLabel?: string;
  icon?:      React.ReactNode;
  iconBg?:    string;
  gradient?:  string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label, value, trend, trendLabel, icon, iconBg, gradient, className,
}) => (
  <div className={cn(
    'rounded-2xl p-5 flex flex-col gap-3',
    'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700',
    'hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-250',
    'shadow-card',
    className,
  )}>
    {gradient && (
      <div className={cn('absolute inset-0 rounded-2xl opacity-40', gradient)} />
    )}
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-surface-500 dark:text-surface-400 tracking-wide uppercase">
        {label}
      </span>
      {icon && (
        <div className={cn(
          'flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0',
          iconBg ?? 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
        )}>
          {icon}
        </div>
      )}
    </div>
    <div className="text-2xl font-bold text-surface-900 dark:text-surface-50 tracking-tight">
      {value}
    </div>
    {(trend !== undefined || trendLabel) && (
      <div className="flex items-center gap-1.5">
        {trend !== undefined && (
          <span className={cn(
            'text-xs font-semibold',
            trend > 0 ? 'text-emerald-600 dark:text-emerald-400' :
            trend < 0 ? 'text-red-500 dark:text-red-400' :
            'text-surface-400',
          )}>
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {trendLabel && (
          <span className="text-xs text-surface-400">{trendLabel}</span>
        )}
      </div>
    )}
  </div>
);

export default Card;
