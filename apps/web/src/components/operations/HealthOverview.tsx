'use client';

import type { OperationsOverview } from '@/types/operations';

const statusColor: Record<string, string> = {
  healthy: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
  offline: 'text-slate-500 dark:text-slate-400',
};

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

function KpiCard({ label, value, sub, accent }: KpiCardProps) {
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
  data: OperationsOverview;
}

export function HealthOverview({ data }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <KpiCard
        label="Availability"
        value={`${data.availability.toFixed(2)}%`}
        sub="avg across tenants"
        accent="text-emerald-600 dark:text-emerald-400"
      />
      <KpiCard
        label="Agents Online"
        value={data.agentsOnline}
        sub={data.agentsOffline > 0 ? `${data.agentsOffline} offline` : 'all operational'}
        accent={data.agentsOffline > 0 ? 'text-red-600 dark:text-red-400' : undefined}
      />
      <KpiCard label="Jobs Executed" value={data.jobsExecuted.toLocaleString()} sub="today" />
      <KpiCard
        label="Open Alerts"
        value={data.openAlerts}
        sub={data.criticalAlerts > 0 ? `${data.criticalAlerts} critical` : 'no critical'}
        accent={data.criticalAlerts > 0 ? 'text-red-600 dark:text-red-400' : undefined}
      />
      <KpiCard
        label="SLA Compliant"
        value={`${data.slaCompliant}/${data.totalTenants}`}
        sub="tenants meeting target"
      />
    </div>
  );
}
