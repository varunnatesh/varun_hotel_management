import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:     string;
  error?:     string;
  hint?:      string;
  icon?:      React.ReactNode;
  iconRight?: React.ReactNode;
  onIconRightClick?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, iconRight, onIconRightClick, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-surface-700 dark:text-surface-300"
          >
            {label}
          </label>
        )}
        <div className={cn(
          'relative flex items-center rounded-xl border transition-all duration-200',
          'bg-surface-50 dark:bg-surface-900',
          error
            ? 'border-red-400 dark:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20'
            : 'border-surface-200 dark:border-surface-700 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15',
        )}>
          {icon && (
            <div className="flex items-center pl-3 text-surface-400 dark:text-surface-500 flex-shrink-0">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'flex-1 bg-transparent py-2.5 text-sm text-surface-900 dark:text-surface-100',
              'placeholder:text-surface-400 dark:placeholder:text-surface-600',
              'focus:outline-none min-w-0',
              icon ? 'pl-2.5 pr-3' : 'px-3',
              iconRight && 'pr-10',
              className,
            )}
            {...props}
          />
          {iconRight && (
            <button
              type="button"
              onClick={onIconRightClick}
              className={cn(
                'absolute right-0 flex items-center pr-3 text-surface-400 dark:text-surface-500',
                onIconRightClick && 'hover:text-surface-700 dark:hover:text-surface-300 cursor-pointer',
              )}
            >
              {iconRight}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        {!error && hint && <p className="text-xs text-surface-400">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

// ─── Textarea ─────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-surface-700 dark:text-surface-300">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2.5 text-sm rounded-xl border bg-surface-50 dark:bg-surface-900',
            'text-surface-900 dark:text-surface-100 placeholder:text-surface-400',
            'resize-none transition-all duration-200 focus:outline-none',
            error
              ? 'border-red-400 focus:ring-2 focus:ring-red-500/20'
              : 'border-surface-200 dark:border-surface-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

// ─── Select ───────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?:   string;
  error?:   string;
  options:  { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-surface-700 dark:text-surface-300">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2.5 text-sm rounded-xl border bg-surface-50 dark:bg-surface-900',
            'text-surface-900 dark:text-surface-100',
            'transition-all duration-200 focus:outline-none cursor-pointer',
            error
              ? 'border-red-400 focus:ring-2 focus:ring-red-500/20'
              : 'border-surface-200 dark:border-surface-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15',
            className,
          )}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';

export default Input;
