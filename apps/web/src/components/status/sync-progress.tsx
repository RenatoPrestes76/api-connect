import { cn } from '@/lib/utils';
import type { SyncResult } from '@/types/index';

interface SyncProgressProps {
  synced:    number;
  skipped:   number;
  failed:    number;
  result?:   SyncResult;
  className?: string;
}

export function SyncProgress({ synced, skipped, failed, result, className }: SyncProgressProps) {
  const total = synced + skipped + failed;
  if (total === 0) return <span className="text-xs text-slate-400">No records</span>;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-slate-100">
        {synced  > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(synced  / total) * 100}%` }} />}
        {skipped > 0 && <div className="bg-slate-300  h-full" style={{ width: `${(skipped / total) * 100}%` }} />}
        {failed  > 0 && <div className="bg-rose-400   h-full" style={{ width: `${(failed  / total) * 100}%` }} />}
      </div>
      <div className="flex gap-2.5 text-xs text-slate-500 tabular">
        <span className="text-emerald-600">{synced} ok</span>
        {skipped > 0 && <span>{skipped} skipped</span>}
        {failed  > 0 && <span className="text-rose-500">{failed} failed</span>}
      </div>
    </div>
  );
}
