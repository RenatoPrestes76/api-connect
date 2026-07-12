'use client';

import type { ClusterOverview, ClusterHealth } from '@/types/ha';

const HEALTH_CLASSES: Record<ClusterHealth, string> = {
  healthy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  degraded: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  offline: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

const HEALTH_DOT: Record<ClusterHealth, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  critical: 'bg-red-500',
  offline: 'bg-zinc-400',
};

interface KpiProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}
function Kpi({ label, value, sub, accent }: KpiProps) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p
        className={`text-2xl font-bold tabular-nums ${accent ?? 'text-zinc-900 dark:text-zinc-100'}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

interface Props {
  data: ClusterOverview;
}

export function ClusterStatus({ data }: Props) {
  const { clusterHealth, leaderNode, avgRtoSeconds, avgRpoMinutes, replication, lastBackup } = data;

  const lastBackupAgo = lastBackup
    ? `${Math.round((Date.now() - new Date(lastBackup.createdAt).getTime()) / 60_000)}m ago`
    : 'Never';

  return (
    <div className="space-y-3">
      {/* Health badge row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${HEALTH_CLASSES[clusterHealth]}`}
        >
          <span className={`w-2 h-2 rounded-full ${HEALTH_DOT[clusterHealth]}`} />
          Cluster {clusterHealth.charAt(0).toUpperCase() + clusterHealth.slice(1)}
        </span>
        {leaderNode && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Leader:{' '}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {leaderNode.hostname}
            </span>{' '}
            ({leaderNode.region})
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Total Nodes" value={data.totalNodes} sub={`${data.onlineNodes} online`} />
        <Kpi
          label="Degraded"
          value={data.degradedNodes}
          sub={`${data.offlineNodes} offline`}
          accent={data.degradedNodes > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
        />
        <Kpi
          label="Replicas"
          value={replication.inSync}
          sub={`${replication.lagging} lagging`}
          accent={
            replication.lagging > 0
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-emerald-600 dark:text-emerald-400'
          }
        />
        <Kpi label="Avg Lag" value={`${replication.avgLagMs}ms`} sub="replication" />
        <Kpi label="Avg RTO" value={`${avgRtoSeconds}s`} sub="recovery time" />
        <Kpi label="Last Backup" value={lastBackupAgo} sub={lastBackup?.type ?? ''} />
      </div>
    </div>
  );
}
