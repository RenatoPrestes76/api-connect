import type { QueueStats } from '@/types/ops';

interface Props {
  stats: QueueStats;
}

const PRIORITY_COLORS = {
  high: 'bg-red-500',
  normal: 'bg-amber-400',
  low: 'bg-zinc-300 dark:bg-zinc-600',
};

export function QueueStatusCard({ stats }: Props) {
  const pending = stats.high + stats.normal + stats.low;
  const max = Math.max(pending, 1);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Worker Queues</h3>
        {stats.dlq > 0 && (
          <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium px-2 py-0.5 rounded-full">
            {stats.dlq} DLQ
          </span>
        )}
      </div>

      <div className="mt-4 space-y-2.5">
        {(['high', 'normal', 'low'] as const).map((p) => (
          <div key={p} className="flex items-center gap-3">
            <span className="text-xs capitalize text-zinc-500 w-12 shrink-0">{p}</span>
            <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${PRIORITY_COLORS[p]}`}
                style={{ width: `${(stats[p] / max) * 100}%` }}
              />
            </div>
            <span className="text-xs tabular-nums font-medium text-zinc-700 dark:text-zinc-300 w-6 text-right">
              {stats[p]}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-500">
        <span>
          Pending: <strong className="text-zinc-700 dark:text-zinc-300">{pending}</strong>
        </span>
        <span>
          Total tracked: <strong className="text-zinc-700 dark:text-zinc-300">{stats.total}</strong>
        </span>
      </div>
    </div>
  );
}
