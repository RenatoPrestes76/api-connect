'use client';

import type { GovernanceOverview } from '@/types/governance';

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-zinc-900 dark:text-zinc-100'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

interface Props {
  data: GovernanceOverview;
}

export function GovernanceKpis({ data }: Props) {
  const scoreColor =
    data.overallComplianceScore >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : data.overallComplianceScore >= 60
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      <Kpi
        label="Active Policies"
        value={data.activePolicies}
        sub={`${data.totalPolicies} total`}
      />
      <Kpi label="Open Changes" value={data.openChanges} />
      <Kpi
        label="Pending Approvals"
        value={data.pendingApprovals}
        accent={data.pendingApprovals > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
      />
      <Kpi label="Open Risks" value={data.openRisks} />
      <Kpi
        label="Critical Risks"
        value={data.criticalRisks}
        accent={data.criticalRisks > 0 ? 'text-red-600 dark:text-red-400' : undefined}
      />
      <Kpi label="Audit Logs Today" value={data.auditLogsToday} />
      <Kpi label="Compliance Score" value={`${data.overallComplianceScore}%`} accent={scoreColor} />
    </div>
  );
}
