import { cn } from '@/lib/utils';

interface LoadingSpinnerProps { className?: string; size?: 'sm' | 'md' | 'lg' }

export function LoadingSpinner({ className, size = 'md' }: LoadingSpinnerProps) {
  const sz = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' }[size];
  return (
    <svg
      className={cn('animate-spin text-slate-400', sz, className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

interface LoadingCardProps { rows?: number; className?: string }

export function LoadingCard({ rows = 3, className }: LoadingCardProps) {
  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-4 space-y-3', className)}>
      <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
      <div className="h-7 w-16 rounded bg-slate-100 animate-pulse" />
      {Array.from({ length: rows - 2 }).map((_, i) => (
        <div key={i} className="h-2.5 w-full rounded bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

interface LoadingTableProps { rows?: number; cols?: number }

export function LoadingTable({ rows = 5, cols = 4 }: LoadingTableProps) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 rounded bg-slate-100 animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface PageLoadingProps { message?: string }

export function PageLoading({ message = 'Loading…' }: PageLoadingProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <LoadingSpinner size="lg" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
