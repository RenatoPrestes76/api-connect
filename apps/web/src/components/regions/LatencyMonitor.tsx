'use client';

import type { ReplicationRecord } from '@/types/regions';

function latencyColor(ms: number): string {
  if (ms === 0) return 'bg-red-200 dark:bg-red-900/40 text-red-700 dark:text-red-300';
  if (ms <= 30)
    return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
  if (ms <= 100) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  if (ms <= 200) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
  return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
}

function latencyBar(ms: number): string {
  if (ms === 0) return 'bg-red-400';
  if (ms <= 30) return 'bg-emerald-400';
  if (ms <= 100) return 'bg-green-400';
  if (ms <= 200) return 'bg-yellow-400';
  return 'bg-orange-400';
}

interface Props {
  records: ReplicationRecord[];
}

export function LatencyMonitor({ records }: Props) {
  const activeRecords = records.filter((r) => r.status !== 'failed');
  const maxLatency = Math.max(...activeRecords.map((r) => r.latencyMs), 1);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Latency Monitor</h3>
        <p className="text-xs text-zinc-400 mt-0.5">Round-trip latency per replication link</p>
      </div>
      <div className="p-4 space-y-2">
        {records.map((rec) => (
          <div key={rec.id} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-300 font-mono">
                {rec.sourceRegion} → {rec.targetRegion}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${latencyColor(rec.latencyMs)}`}
              >
                {rec.status === 'failed' ? 'n/a' : `${rec.latencyMs}ms`}
              </span>
            </div>
            <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              {rec.status !== 'failed' && (
                <div
                  className={`h-full rounded-full transition-all ${latencyBar(rec.latencyMs)}`}
                  style={{ width: `${Math.min((rec.latencyMs / maxLatency) * 100, 100)}%` }}
                />
              )}
              {rec.status === 'failed' && (
                <div className="h-full w-full bg-red-400 rounded-full opacity-40" />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 pb-3 flex items-center gap-4 text-[10px] text-zinc-400">
        {[
          { color: 'bg-emerald-400', label: '≤30ms' },
          { color: 'bg-green-400', label: '≤100ms' },
          { color: 'bg-yellow-400', label: '≤200ms' },
          { color: 'bg-orange-400', label: '>200ms' },
          { color: 'bg-red-400', label: 'failed' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
