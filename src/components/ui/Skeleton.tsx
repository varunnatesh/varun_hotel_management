import React from 'react';
import { cn } from '../../lib/utils';

// ─── Base Skeleton ────────────────────────────────────────────────────────────
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  height?: string | number;
  width?:  string | number;
  round?:  boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  height, width, round = false, className, style, ...props
}) => (
  <div
    className={cn(
      'shimmer shimmer-base animate-shimmer relative overflow-hidden',
      round ? 'rounded-full' : 'rounded-lg',
      className,
    )}
    style={{
      height: typeof height === 'number' ? `${height}px` : height,
      width:  typeof width  === 'number' ? `${width}px`  : width,
      ...style,
    }}
    {...props}
  />
);

// ─── KPI Card Skeleton ────────────────────────────────────────────────────────
export const KPICardSkeleton: React.FC = () => (
  <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 p-5 shadow-card">
    <div className="flex items-center justify-between mb-3">
      <Skeleton height={12} width={80} />
      <Skeleton height={36} width={36} round />
    </div>
    <Skeleton height={32} width={120} className="mb-3" />
    <Skeleton height={12} width={100} />
  </div>
);

// ─── Table Row Skeleton ───────────────────────────────────────────────────────
export const TableRowSkeleton: React.FC<{ cols?: number }> = ({ cols = 5 }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton height={14} width={i === 0 ? 120 : 80} />
      </td>
    ))}
  </tr>
);

// ─── List Item Skeleton ───────────────────────────────────────────────────────
export const ListItemSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3">
    <Skeleton height={36} width={36} round />
    <div className="flex-1 flex flex-col gap-2">
      <Skeleton height={12} width="60%" />
      <Skeleton height={10} width="40%" />
    </div>
    <Skeleton height={24} width={60} />
  </div>
);

// ─── Chart Skeleton ───────────────────────────────────────────────────────────
export const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 240 }) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <Skeleton height={16} width={140} />
      <div className="flex gap-2">
        <Skeleton height={28} width={60} />
        <Skeleton height={28} width={60} />
        <Skeleton height={28} width={60} />
      </div>
    </div>
    <Skeleton height={height} className="w-full" />
  </div>
);

// ─── Card Skeleton ────────────────────────────────────────────────────────────
export const CardSkeleton: React.FC<{ lines?: number }> = ({ lines = 4 }) => (
  <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 p-5 shadow-card">
    <div className="flex items-center justify-between mb-4">
      <Skeleton height={16} width={140} />
      <Skeleton height={28} width={80} />
    </div>
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={`${Math.random() * 40 + 60}%`} />
      ))}
    </div>
  </div>
);

export default Skeleton;
