import { cn } from '../../lib/utils.js';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse rounded bg-slate-200', className)} />
  );
}
