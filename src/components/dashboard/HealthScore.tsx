import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn, clamp } from '../../lib/utils';

interface HealthScoreProps {
  score:       number;  // 0–100
  breakdown?: {
    revenue: number; stock: number; kitchen: number;
    fraud: number;   wastage: number; staff: number;
  };
  size?: 'sm' | 'md' | 'lg';
}

const RATINGS = [
  { min: 90, label: 'Excellent', color: '#10b981', ring: '#10b981' },
  { min: 75, label: 'Good',      color: '#3b82f6', ring: '#3b82f6' },
  { min: 60, label: 'Fair',      color: '#f59e0b', ring: '#f59e0b' },
  { min: 0,  label: 'Poor',      color: '#ef4444', ring: '#ef4444' },
];

const BREAKDOWN_LABELS: Record<string, { label: string; icon: string; weight: string }> = {
  revenue: { label: 'Revenue',  icon: '📈', weight: '25%' },
  stock:   { label: 'Stock',    icon: '📦', weight: '20%' },
  kitchen: { label: 'Kitchen',  icon: '⚡', weight: '20%' },
  fraud:   { label: 'Fraud',    icon: '🛡️', weight: '15%' },
  wastage: { label: 'Wastage',  icon: '♻️', weight: '10%' },
  staff:   { label: 'Staff',    icon: '👥', weight: '10%' },
};

export const HealthScore: React.FC<HealthScoreProps> = ({
  score,
  breakdown,
  size = 'md',
}) => {
  const clamped = clamp(Math.round(score), 0, 100);
  const rating = RATINGS.find(r => clamped >= r.min) ?? RATINGS[3];

  // SVG ring
  const radius   = size === 'sm' ? 36 : size === 'md' ? 52 : 68;
  const stroke   = size === 'sm' ? 6  : size === 'md' ? 8  : 10;
  const dim      = (radius + stroke) * 2;
  const circ     = 2 * Math.PI * radius;
  const dashOffset = circ - (clamped / 100) * circ;

  const [animOffset, setAnimOffset] = useState(circ);

  useEffect(() => {
    const timer = setTimeout(() => setAnimOffset(dashOffset), 100);
    return () => clearTimeout(timer);
  }, [dashOffset]);

  const textSize = size === 'sm' ? 'text-xl' : size === 'md' ? 'text-3xl' : 'text-4xl';

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Ring */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative"
      >
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="-rotate-90">
          {/* Track */}
          <circle
            cx={dim / 2} cy={dim / 2} r={radius}
            fill="none"
            stroke="rgba(148,163,184,0.15)"
            strokeWidth={stroke}
          />
          {/* Fill */}
          <circle
            cx={dim / 2} cy={dim / 2} r={radius}
            fill="none"
            stroke={rating.ring}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={animOffset}
            style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-bold leading-none', textSize)} style={{ color: rating.color }}>
            {clamped}
          </span>
          <span className="text-[10px] text-surface-400 font-medium mt-0.5">/ 100</span>
        </div>
      </motion.div>

      {/* Rating label */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-bold" style={{ color: rating.color }}>
          {rating.label}
        </span>
        <span className="text-xs text-surface-500">Business Health Score</span>
      </div>

      {/* Breakdown */}
      {breakdown && (
        <div className="w-full space-y-2">
          {Object.entries(breakdown)
            .filter(([key]) => key !== 'total' && key !== 'rating')
            .map(([key, value]) => {
              const info = BREAKDOWN_LABELS[key];
              if (!info) return null;
              const pct = clamp(value as number, 0, 100);
              const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444';
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{info.icon}</span>
                      <span className="text-xs text-surface-600 dark:text-surface-400">{info.label}</span>
                    </div>
                    <span className="text-xs font-semibold" style={{ color }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: color }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default HealthScore;
