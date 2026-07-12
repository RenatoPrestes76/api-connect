'use client';

import type { ClusterNode, ReplicationStatus } from '@/types/ha';

const REP_STATUS_CLASSES: Record<ReplicationStatus, string> = {
  in_sync: 'text-emerald-600 dark:text-emerald-400',
  lagging: 'text-amber-600 dark:text-amber-400',
  diverged: 'text-red-600 dark:text-red-400',
  stopped: 'text-zinc-400',
};

const LAG_BAR_COLOR = (lag: number) =>
  lag === 0
    ? 'bg-emerald-500'
    : lag < 100
      ? 'bg-emerald-400'
      : lag < 300
        ? 'bg-amber-400'
        : 'bg-red-500';

interface Props {
  nodes: ClusterNode[];
}

export function ReplicationMonitor({ nodes }: Props) {
  const replicas = nodes.filter((n) => n.role !== 'leader' && n.replication);
  const maxLag = Math.max(1, ...replicas.map((n) => n.replication!.lagMs));

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Replication Monitor</h3>
        <p className="text-xs text-zinc-400 mt-0.5">{replicas.length} replicas tracked</p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {replicas.map((n) => {
          const rep = n.replication!;
          const barWidth = Math.min(100, (rep.lagMs / maxLag) * 100);
          return (
            <div key={n.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {n.hostname}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {n.region} · {n.role}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-semibold tabular-nums ${REP_STATUS_CLASSES[rep.status]}`}
                  >
                    {rep.lagMs}ms
                  </p>
                  <p className={`text-xs ${REP_STATUS_CLASSES[rep.status]}`}>
                    {rep.status.replace('_', ' ')}
                  </p>
                </div>
              </div>
              {/* Lag bar */}
              <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${LAG_BAR_COLOR(rep.lagMs)}`}
                  style={{ width: `${Math.max(2, barWidth)}%` }}
                />
              </div>
              {rep.divergenceBytes > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {(rep.divergenceBytes / 1024).toFixed(0)} KB behind
                </p>
              )}
            </div>
          );
        })}
        {replicas.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">
            No replica state available
          </div>
        )}
      </div>
    </div>
  );
}
