import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format Indian currency */
export function formatCurrency(amount: number, compact = false): string {
  if (compact && amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (compact && amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format number with Indian locale */
export function formatNumber(n: number, compact = false): string {
  if (compact && n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (compact && n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-IN').format(n);
}

/** Format percentage */
export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/** Format date to readable string */
export function formatDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  };
  return new Date(dateStr).toLocaleDateString('en-IN', defaultOptions);
}

/** Format time */
export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** Get elapsed minutes from a date string */
export function getElapsedMinutes(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

/** Format elapsed time as human-readable */
export function formatElapsed(dateStr: string): string {
  const mins = getElapsedMinutes(dateStr);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Get greeting based on time of day */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

/** Get today's date string */
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/** Calculate days remaining for stock */
export function calcDaysRemaining(currentStock: number, avgDailyUsage: number): number {
  if (avgDailyUsage <= 0) return 999;
  return Math.floor(currentStock / avgDailyUsage);
}

/** Get stock status from days remaining */
export function getStockStatus(daysRemaining: number): 'critical' | 'low' | 'healthy' {
  if (daysRemaining <= 1) return 'critical';
  if (daysRemaining <= 3) return 'low';
  return 'healthy';
}

/** Calculate profit margin */
export function calcProfitMargin(sellingPrice: number, cost: number): number {
  if (sellingPrice <= 0) return 0;
  return ((sellingPrice - cost) / sellingPrice) * 100;
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Sleep for given ms (for animations) */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Generate random ID */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/** Debounce a function */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Truncate text */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/** Role display names */
export const ROLE_LABELS: Record<string, string> = {
  owner:         'Owner',
  store_manager: 'Store Manager',
  kitchen:       'Kitchen Staff',
  supervisor:    'Supervisor',
  cashier:       'Cashier',
  guest:         'Guest',
};

/** Role colors for badges */
export const ROLE_COLORS: Record<string, string> = {
  owner:         'badge-purple',
  store_manager: 'badge-blue',
  kitchen:       'badge-amber',
  supervisor:    'badge-green',
  cashier:       'badge-neutral',
  guest:         'badge-neutral',
};

/** Order status colors */
export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending:   'badge-amber',
  preparing: 'badge-blue',
  ready:     'badge-green',
  served:    'badge-neutral',
  billed:    'badge-neutral',
  cancelled: 'badge-red',
};

/** Alert severity colors */
export const ALERT_SEVERITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  info:     { bg: 'bg-blue-500/10',   text: 'text-blue-600 dark:text-blue-400',   dot: 'bg-blue-500' },
  warning:  { bg: 'bg-amber-500/10',  text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  critical: { bg: 'bg-red-500/10',    text: 'text-red-600 dark:text-red-400',     dot: 'bg-red-500' },
};
