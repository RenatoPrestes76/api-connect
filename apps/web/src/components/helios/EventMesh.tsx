'use client';
import type { MeshCluster } from '@/types/helios';

const STATUS_BADGE: Record<string, string> = {
  healthy: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  degraded: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  offline: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

interface Props {
  clusters: MeshCluster[];
}

export function EventMesh({ clusters }: Props) {
  const healthy = clusters.filter((c) => c.status === 'healthy').length;
  const degraded = clusters.filter((c) => c.status === 'degraded').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Clusters', value: clusters.length },
          { label: 'Healthy', value: healthy, color: 'text-emerald-400' },
          { label: 'Degraded', value: degraded, color: 'text-amber-400' },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-center"
          >
            <p className="text-xs text-zinc-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-semibold tabular-nums ${k.color ?? 'text-zinc-100'}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {clusters.map((c, i) => (
          <div key={c.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-zinc-200">{c.name}</span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.status]}`}
                  >
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">{c.region}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-zinc-500">Latency</p>
                <p
                  className={`text-sm font-mono tabular-nums font-semibold ${c.latencyMs < 10 ? 'text-emerald-400' : c.latencyMs < 100 ? 'text-amber-400' : 'text-red-400'}`}
                >
                  {c.latencyMs} ms
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
              <span>{c.topicsReplicated} topics replicated</span>
              <span>{c.eventsLast24h.toLocaleString()} events/24h</span>
              {i < clusters.length - 1 && (
                <span className="ml-auto text-zinc-600">▼ mesh link</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
