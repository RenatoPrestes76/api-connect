'use client';

import type { FailoverEvent } from '@/types/ha';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours > 0) return `${hours}h ago`;
  return `${Math.floor(diff / 60_000)}m ago`;
}

interface Props {
  events: FailoverEvent[];
}

export function FailoverHistory({ events }: Props) {
  if (!events.length) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 text-center">
        <p className="text-sm text-zinc-400">No failover events recorded</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Failover History</h3>
        <p className="text-xs text-zinc-400 mt-0.5">{events.length} events</p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {events.map((e) => (
          <div key={e.id} className="px-4 py-3 space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.automatic
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  }`}
                >
                  {e.automatic ? 'auto' : 'manual'}
                </span>
                <span className="text-xs text-zinc-400">{timeAgo(e.startedAt)}</span>
              </div>
              <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                RTO {e.rtoSeconds}s
              </span>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              <span className="font-mono text-xs">{e.fromHostname}</span>
              {' → '}
              <span className="font-mono text-xs font-semibold">{e.toHostname}</span>
            </p>
            <p className="text-xs text-zinc-400 truncate">{e.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
