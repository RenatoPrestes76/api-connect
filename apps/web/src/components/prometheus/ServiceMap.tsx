'use client';

import type { ServiceMap as ServiceMapType } from '@/types/prometheus';

const STATUS_COLOR: Record<string, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  down: 'bg-red-500',
};

const STATUS_RING: Record<string, string> = {
  healthy: 'ring-emerald-200 dark:ring-emerald-800',
  degraded: 'ring-amber-200 dark:ring-amber-800',
  down: 'ring-red-200 dark:ring-red-800',
};

interface Props {
  map: ServiceMapType;
}

export function ServiceMap({ map }: Props) {
  const sorted = [...map.nodes].sort((a, b) => b.requestsPerMin - a.requestsPerMin);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Service Map</h3>
        <span className="text-xs text-zinc-400">
          {map.nodes.length} services · {map.edges.length} connections
        </span>
      </div>
      <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {sorted.map((node) => (
          <div
            key={node.id}
            className={`rounded-lg border border-zinc-200 dark:border-zinc-700 p-2.5 ring-2 ${STATUS_RING[node.status]}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLOR[node.status]}`} />
              <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                {node.name}
              </p>
            </div>
            <div className="space-y-0.5 text-[10px] text-zinc-500">
              <p>{node.requestsPerMin.toLocaleString()} req/min</p>
              <p>
                Err:{' '}
                <span className={node.errorRate > 2 ? 'text-red-500 font-medium' : ''}>
                  {node.errorRate}%
                </span>
              </p>
              <p>Latency: {node.avgLatencyMs}ms</p>
            </div>
          </div>
        ))}
      </div>
      {/* Top error edges */}
      <div className="px-3 pb-3">
        <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-2 font-medium">
          High Error Connections
        </p>
        {map.edges
          .filter((e) => e.errorRate > 1)
          .sort((a, b) => b.errorRate - a.errorRate)
          .slice(0, 3)
          .map((e, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-[10px] text-zinc-500 py-0.5"
            >
              <span>
                {e.source} → {e.target}
              </span>
              <span className="text-red-500 font-medium">{e.errorRate}% error</span>
            </div>
          ))}
      </div>
    </div>
  );
}
