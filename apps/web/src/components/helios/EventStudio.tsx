'use client';
import type { Topic, DLQEntry, ReplayJob } from '@/types/helios';

interface Props {
  topics: Topic[];
  dlqEntries: DLQEntry[];
  replayJobs: ReplayJob[];
}

export function EventStudio({ topics, dlqEntries, replayJobs }: Props) {
  const activeTopics = topics.filter((t) => t.status === 'active').length;
  const pendingDLQ = dlqEntries.filter((e) => e.status === 'pending').length;
  const runningReplays = replayJobs.filter((j) => j.status === 'running').length;
  const totalEps = topics.reduce((s, t) => s + t.currentEps, 0);

  return (
    <div className="space-y-4">
      {/* Studio KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Active Topics', value: activeTopics },
          { label: 'Total EPS', value: totalEps.toLocaleString(), mono: true },
          { label: 'DLQ Pending', value: pendingDLQ, alert: pendingDLQ > 0 },
          { label: 'Active Replays', value: runningReplays },
        ].map((k) => (
          <div
            key={k.label}
            className={`rounded-lg border p-4 ${k.alert ? 'bg-amber-950/20 border-amber-500/30' : 'bg-zinc-900 border-zinc-800'}`}
          >
            <p className="text-xs text-zinc-500 mb-1">{k.label}</p>
            <p
              className={`text-xl font-semibold tabular-nums ${k.alert ? 'text-amber-400' : 'text-zinc-100'} ${k.mono ? 'font-mono' : ''}`}
            >
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Topic Health Bars */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">Event Flow Health</h3>
        </div>
        <div className="p-4 space-y-3">
          {topics.map((t) => {
            const maxEps = Math.max(...topics.map((x) => x.currentEps), 1);
            const pct = (t.currentEps / maxEps) * 100;
            return (
              <div key={t.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-400">{t.eventType}</span>
                  <span className="text-xs font-mono tabular-nums text-zinc-500">
                    {t.currentEps} eps
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${t.status === 'paused' ? 'bg-zinc-600' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.max(pct, t.currentEps > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
