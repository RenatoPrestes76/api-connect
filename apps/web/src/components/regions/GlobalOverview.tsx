'use client';

import type { GlobalOverview as GlobalOverviewData } from '@/types/regions';

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  critical: 'bg-red-500',
  offline: 'bg-zinc-500',
};

const HEALTH_TEXT: Record<string, string> = {
  healthy: 'text-emerald-600 dark:text-emerald-400',
  degraded: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
  offline: 'text-zinc-500',
};

const HEALTH_BG: Record<string, string> = {
  healthy: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  degraded: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  offline: 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700',
};

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

interface Props {
  data: GlobalOverviewData;
}

export function GlobalOverview({ data }: Props) {
  const {
    totalRegions,
    activeRegions,
    degradedRegions,
    totalTenants,
    avgLatencyMs,
    globalHealth,
    replication,
  } = data;
  const repHealth =
    replication.failed > 0 ? 'degraded' : replication.lagging > 0 ? 'degraded' : 'healthy';

  return (
    <div className="space-y-3">
      {/* Health banner */}
      <div
        className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${HEALTH_BG[globalHealth] ?? HEALTH_BG.offline}`}
      >
        <span
          className={`w-3 h-3 rounded-full shrink-0 ${HEALTH_COLORS[globalHealth] ?? 'bg-zinc-500'}`}
        />
        <div className="flex-1">
          <p className={`font-semibold text-sm ${HEALTH_TEXT[globalHealth]}`}>
            Global Infrastructure — {globalHealth.toUpperCase()}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {activeRegions}/{totalRegions} regions active · {replication.inSync}/{replication.total}{' '}
            replication links in-sync
          </p>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Regions" value={totalRegions} />
        <KpiCard label="Active Regions" value={activeRegions} />
        <KpiCard label="Degraded" value={degradedRegions} />
        <KpiCard label="Total Tenants" value={totalTenants} />
        <KpiCard label="Avg Latency" value={`${avgLatencyMs}ms`} />
        <KpiCard
          label="Replication"
          value={`${replication.inSync}/${replication.total}`}
          sub={repHealth === 'degraded' ? `${replication.failed} failed` : 'all in-sync'}
        />
      </div>
    </div>
  );
}
