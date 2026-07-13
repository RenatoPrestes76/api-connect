import { cn } from '../../lib/utils';
import { Skeleton } from '../ui/skeleton';

interface LoadingProps {
  rows?: number;
  className?: string;
}

export function Loading({ rows = 5, className }: LoadingProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function LoadingCard({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3 rounded-lg border border-slate-200 bg-white p-5', className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
    </div>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-8', className)}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
    </div>
  );
}
