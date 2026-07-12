'use client';
import type { ReplayJob, Topic } from '@/types/helios';

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  running: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  queued: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
  failed: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

interface Props {
  jobs: ReplayJob[];
  topics: Topic[];
}

export function ReplayCenter({ jobs, topics }: Props) {
  const topicMap = Object.fromEntries(topics.map((t) => [t.id, t.eventType]));

  return (
    <div className="space-y-3">
      {jobs.map((j) => {
        const pct = j.totalEvents > 0 ? Math.round((j.eventsReplayed / j.totalEvents) * 100) : 0;
        return (
          <div key={j.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-zinc-500">{j.id}</span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[j.status]}`}
                  >
                    {j.status}
                  </span>
                </div>
                <p className="text-sm font-medium text-zinc-200">
                  {topicMap[j.topicId] ?? j.topicId}
                </p>
                <p className="text-xs text-zinc-500">
                  {j.tenantId} · {j.startTime.slice(0, 16)} → {j.endTime.slice(0, 16)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-zinc-500">Progress</p>
                <p className="text-sm font-semibold tabular-nums text-zinc-200">
                  {j.eventsReplayed.toLocaleString()} / {j.totalEvents.toLocaleString()}
                </p>
              </div>
            </div>
            {j.status === 'running' && (
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            {j.status === 'completed' && (
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: '100%' }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
