'use client';

import type { Region } from '@/types/regions';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  offline: 'bg-red-500',
  maintenance: 'bg-blue-400',
};

const STATUS_RING: Record<string, string> = {
  active: 'ring-emerald-300 dark:ring-emerald-700',
  degraded: 'ring-amber-300 dark:ring-amber-700',
  offline: 'ring-red-300 dark:ring-red-700',
  maintenance: 'ring-blue-300 dark:ring-blue-700',
};

const STATUS_CARD: Record<string, string> = {
  active: 'border-emerald-200 dark:border-emerald-800/60',
  degraded: 'border-amber-200 dark:border-amber-800/60',
  offline: 'border-red-200 dark:border-red-800/60',
  maintenance: 'border-blue-200 dark:border-blue-800/60',
};

interface Props {
  regions: Region[];
}

export function RegionMap({ regions }: Props) {
  const byContinent: Record<string, Region[]> = {};
  for (const r of regions) {
    if (!byContinent[r.continent]) byContinent[r.continent] = [];
    byContinent[r.continent]!.push(r);
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Region Map</h3>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          {['active', 'degraded', 'offline', 'maintenance'].map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[s]}`} />
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="p-4 space-y-4">
        {Object.entries(byContinent).map(([continent, list]) => (
          <div key={continent}>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">
              {continent}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {list.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-lg border p-3 ring-1 ${STATUS_RING[r.status] ?? STATUS_RING.offline} ${STATUS_CARD[r.status] ?? 'border-zinc-200 dark:border-zinc-700'} bg-white dark:bg-zinc-900/40`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{r.flag}</span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[r.status] ?? 'bg-zinc-400'}`}
                    />
                  </div>
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                    {r.name}
                  </p>
                  <code className="text-[10px] text-zinc-400">{r.code}</code>
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-[10px] text-zinc-500">{r.latencyMs}ms avg latency</p>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-1 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${r.capacityPct > 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${r.capacityPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400">{r.capacityPct}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
