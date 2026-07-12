'use client';
import type { Topic, StreamMetrics } from '@/types/helios';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  paused: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  archived: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
};

interface Props {
  topics: Topic[];
  metrics: StreamMetrics;
}

export function EventBusOverview({ topics, metrics }: Props) {
  return (
    <div className="space-y-4">
      {/* KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Events / sec', value: metrics.eventsPerSecond.toLocaleString() },
          { label: 'Throughput', value: `${metrics.throughputMbps} MB/s` },
          { label: 'Avg Latency', value: `${metrics.avgLatencyMs} ms` },
          { label: 'Error Rate', value: `${metrics.errorRate}%` },
        ].map((k) => (
          <div key={k.label} className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
            <p className="text-xs text-zinc-500 mb-1">{k.label}</p>
            <p className="text-xl font-semibold text-zinc-100 font-mono tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Topics Table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">Topics</h3>
          <span className="text-xs text-zinc-500">{topics.length} topics</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Event Type', 'Tenant', 'Partitions', 'EPS', 'Total Events', 'Status'].map(
                  (h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs text-zinc-500 font-medium">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-zinc-200">{t.eventType}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{t.tenantId}</td>
                  <td className="px-4 py-3 text-zinc-400 tabular-nums">{t.partitions}</td>
                  <td className="px-4 py-3 text-zinc-300 tabular-nums font-mono">{t.currentEps}</td>
                  <td className="px-4 py-3 text-zinc-400 tabular-nums text-xs">
                    {t.messagesTotal.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status]}`}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
