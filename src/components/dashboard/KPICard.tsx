import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface KPICardProps {
  label:     string;
  value:     number | string;
  prefix?:   string;
  suffix?:   string;
  trend?:    number;
  trendLabel?: string;
  icon:      React.ReactNode;
  iconBg:    string;
  gradient:  string;
  delay?:    number;
  compact?:  boolean;
  isText?:   boolean;  // skip animation for string values
  onClick?:  () => void;
}

// ─── Animated Counter ─────────────────────────────────────────────────────────
function useAnimatedCounter(target: number, duration = 1200) {
  const [displayed, setDisplayed] = useState(0);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = null;
    const animate = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return displayed;
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────
const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80, h = 32;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h * 0.8 - h * 0.1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="opacity-70">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const SPARKLINE_DATA = [12, 18, 15, 22, 19, 25, 28, 24, 30, 27];

export const KPICard: React.FC<KPICardProps> = ({
  label, value, prefix = '', suffix = '', trend, trendLabel,
  icon, iconBg, gradient, delay = 0, compact = false, isText = false, onClick,
}) => {
  const counter = useAnimatedCounter(isText ? 0 : Number(value));

  const formatValue = (n: number) => {
    if (isText) return String(value);
    if (suffix === '%') return n.toFixed(1);
    if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
    if (n >= 1000)   return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const displayVal = isText ? String(value) : formatValue(counter);

  const TrendIcon = trend && trend > 0 ? TrendingUp : trend && trend < 0 ? TrendingDown : Minus;
  const trendColor = trend && trend > 0 ? 'text-emerald-500' : trend && trend < 0 ? 'text-red-500' : 'text-surface-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      onClick={onClick}
      className={cn(
        'relative rounded-2xl overflow-hidden cursor-pointer select-none',
        'bg-white dark:bg-surface-800',
        'border border-surface-200 dark:border-surface-700',
        'shadow-card hover:shadow-card-hover',
        'transition-shadow duration-250',
        compact ? 'p-4' : 'p-5',
      )}
    >
      {/* Gradient overlay */}
      <div className={cn('absolute inset-0 opacity-40 dark:opacity-20', gradient)} />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider leading-none">
            {label}
          </p>
          <div className={cn(
            'flex items-center justify-center rounded-xl flex-shrink-0',
            compact ? 'w-8 h-8' : 'w-10 h-10',
            iconBg,
          )}>
            {icon}
          </div>
        </div>

        {/* Value */}
        <div className={cn('font-bold tracking-tight text-surface-900 dark:text-surface-50', compact ? 'text-xl mb-2' : 'text-2xl mb-3')}>
          {prefix}{displayVal}{suffix}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          {trend !== undefined ? (
            <div className={cn('flex items-center gap-1', trendColor)}>
              <TrendIcon size={12} />
              <span className="text-xs font-semibold">{Math.abs(trend).toFixed(1)}%</span>
              {trendLabel && <span className="text-xs text-surface-400 font-normal">{trendLabel}</span>}
            </div>
          ) : (
            <span className="text-xs text-surface-400">{trendLabel}</span>
          )}
          {!compact && (
            <Sparkline data={SPARKLINE_DATA} color={iconBg.includes('blue') ? '#3b82f6' : iconBg.includes('emerald') ? '#10b981' : '#f59e0b'} />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default KPICard;
