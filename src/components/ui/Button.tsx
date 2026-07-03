import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline' | 'glass';
type Size    = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant;
  size?:     Size;
  loading?:  boolean;
  icon?:     React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:   'bg-brand-600 text-white hover:bg-brand-700 shadow-brand/30 shadow-md active:bg-brand-800 border border-brand-500/20',
  secondary: 'bg-surface-100 text-surface-900 hover:bg-surface-200 dark:bg-surface-700 dark:text-surface-100 dark:hover:bg-surface-600 border border-surface-200 dark:border-surface-600',
  ghost:     'bg-transparent text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800 border border-transparent',
  danger:    'bg-red-600 text-white hover:bg-red-700 shadow-danger/30 shadow-md active:bg-red-800 border border-red-500/20',
  success:   'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald/30 shadow-md active:bg-emerald-800 border border-emerald-500/20',
  outline:   'bg-transparent text-brand-600 dark:text-brand-400 border border-brand-500/50 hover:bg-brand-50 dark:hover:bg-brand-950/30',
  glass:     'bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20',
};

const sizeStyles: Record<Size, string> = {
  xs: 'px-2.5 py-1 text-xs gap-1.5',
  sm: 'px-3 py-1.5 text-sm gap-2',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2.5',
  xl: 'px-6 py-3 text-base gap-3',
};

const Spinner = ({ size }: { size: Size }) => {
  const spinnerSize = { xs: 'w-3 h-3', sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-4 h-4', xl: 'w-5 h-5' }[size];
  return (
    <svg className={cn('animate-spin', spinnerSize)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, iconRight, fullWidth, className, children, disabled, ...props }, ref) => {
    const isDisabled = disabled || loading;
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: isDisabled ? 1 : 0.97 }}
        whileHover={{ scale: isDisabled ? 1 : 1.01 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg',
          'transition-all duration-200 ease-smooth',
          'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          'btn-ripple select-none',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className,
        )}
        disabled={isDisabled}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {loading ? <Spinner size={size} /> : icon}
        {children && <span>{children}</span>}
        {!loading && iconRight}
      </motion.button>
    );
  },
);

Button.displayName = 'Button';
export default Button;
