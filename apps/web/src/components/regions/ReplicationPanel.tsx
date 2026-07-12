'use client';

import type { ReplicationRecord, ReplicationSummary } from '@/types/regions';

const STATUS_DOT: Record<string, string> = {
  in_sync: 'bg-emerald-500',
  lagging: 'bg-amber-500',
  failed: 'bg-red-500',
  paused: 'bg-zinc-400',
};

const STATUS_BADGE: Record<string, string> = {
  in_sync: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  lagging: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  failed: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  paused: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  summary: ReplicationSummary;
  records: ReplicationRecord[];
}

export function ReplicationPanel({ summary, records }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Replication Status</h3>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>
              In-sync:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">{summary.inSync}</strong>
            </span>
            <span>
              Lagging:{' '}
              <strong className="text-amber-600 dark:text-amber-400">{summary.lagging}</strong>
            </span>
            <span>
              Failed: <strong className="text-red-600 dark:text-red-400">{summary.failed}</strong>
            </span>
          </div>
        </div>
        <p className="text-xs text-zinc-400 mt-0.5">Avg latency: {summary.avgLatencyMs}ms</p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-80 overflow-y-auto">
        {records.map((rec) => (
          <div key={rec.id} className="flex items-center gap-3 px-4 py-2.5">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[rec.status] ?? 'bg-zinc-400'}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <code className="text-xs font-mono text-zinc-700 dark:text-zinc-300">
                  {rec.sourceRegion}
                </code>
                <span className="text-zinc-400">→</span>
                <code className="text-xs font-mono text-zinc-700 dark:text-zinc-300">
                  {rec.targetRegion}
                </code>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[rec.status] ?? ''}`}
                >
                  {rec.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-zinc-400">
                <span>{rec.latencyMs}ms</span>
                <span>{rec.itemsReplicated.toLocaleString()} items</span>
                {rec.pendingItems > 0 && (
                  <span className="text-amber-500">{rec.pendingItems} pending</span>
                )}
                <span>synced {timeAgo(rec.lastSynced)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
