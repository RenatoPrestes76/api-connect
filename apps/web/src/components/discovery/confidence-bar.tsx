import { cn, confidenceBg, confidenceColor } from '@/lib/utils';

interface ConfidenceBarProps {
  score:     number;
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceBar({ score, showLabel = true, className }: ConfidenceBarProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all', confidenceBg(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn('tabular text-xs font-medium w-7 text-right', confidenceColor(score))}>
          {score}%
        </span>
      )}
    </div>
  );
}

interface DiscoveryCardProps {
  table:       string;
  entity:      string;
  confidence:  number;
  fieldCount?: number;
  className?:  string;
}

export function DiscoveryCard({
  table, entity, confidence, fieldCount, className,
}: DiscoveryCardProps) {
  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-3 space-y-2', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-600 truncate">{table}</p>
          <p className="mt-0.5 font-semibold text-sm text-slate-900">{entity}</p>
        </div>
        {fieldCount != null && (
          <span className="shrink-0 text-xs text-slate-400">{fieldCount} cols</span>
        )}
      </div>
      <ConfidenceBar score={confidence} />
    </div>
  );
}
