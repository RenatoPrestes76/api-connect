'use client';
import type { StreamMetrics, TopicMetric } from '@/types/helios';

interface Props {
  metrics: StreamMetrics;
  topicMetrics: TopicMetric[];
}

export function StreamingAnalytics({ metrics, topicMetrics }: Props) {
  const kpis = [
    { label: 'Events / sec', value: metrics.eventsPerSecond.toLocaleString(), note: 'live' },
    { label: 'Throughput', value: `${metrics.throughputMbps} MB/s`, note: '' },
    { label: 'Avg Latency', value: `${metrics.avgLatencyMs} ms`, note: '' },
    { label: 'p99 Latency', value: `${metrics.p99LatencyMs} ms`, note: '' },
    { label: 'Error Rate', value: `${metrics.errorRate}%`, note: '' },
    { label: 'Consumers', value: metrics.activeConsumers, note: 'active' },
    { label: 'Topics', value: metrics.activeTopics, note: 'active' },
    { label: 'Events Today', value: metrics.totalEventsToday.toLocaleString(), note: '' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
            <p className="text-xs text-zinc-500 mb-1">
              {k.label} {k.note && <span className="text-emerald-500 ml-1">● {k.note}</span>}
            </p>
            <p className="text-xl font-semibold text-zinc-100 font-mono tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">Per-Topic Metrics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Topic', 'EPS', 'Avg Latency', 'Consumer Lag', 'Error Rate'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs text-zinc-500 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topicMetrics.map((m) => (
                <tr
                  key={m.topicId}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-4 py-3 text-zinc-200 font-medium text-xs">{m.name}</td>
                  <td className="px-4 py-3 text-zinc-300 tabular-nums font-mono">
                    {m.eventsPerSecond}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 tabular-nums">{m.avgLatencyMs} ms</td>
                  <td className="px-4 py-3">
                    <span
                      className={`tabular-nums font-mono text-xs ${m.consumerLag > 1000 ? 'text-red-400' : m.consumerLag > 100 ? 'text-amber-400' : 'text-emerald-400'}`}
                    >
                      {m.consumerLag.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`tabular-nums text-xs ${m.errorRate > 0.3 ? 'text-red-400' : 'text-zinc-400'}`}
                    >
                      {m.errorRate}%
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
