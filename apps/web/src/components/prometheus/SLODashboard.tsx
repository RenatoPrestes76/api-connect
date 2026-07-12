'use client';

import type { SLOTarget } from '@/types/prometheus';

const STATUS_COLOR: Record<string, string> = {
  healthy: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  at_risk: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  breached: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

const UPTIME_COLOR = (current: number, target: number) => {
  if (current >= target) return 'bg-emerald-500';
  if (current >= target - 0.05) return 'bg-amber-500';
  return 'bg-red-500';
};

interface Props {
  targets: SLOTarget[];
}

export function SLODashboard({ targets }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">SLO / SLA Manager</h3>
        <p className="text-xs text-zinc-400 mt-0.5">Error budget tracking per tenant</p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {targets.map((t) => {
          const budgetPct = Math.min(100, (t.errorBudgetUsed / t.errorBudgetMinutes) * 100);
          return (
            <div key={t.id} className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex-1 truncate">
                  {t.tenantName}
                </p>
                <span
                  className={`text-[10px] font-medium rounded-full px-2 py-0.5 uppercase ${STATUS_COLOR[t.status]}`}
                >
                  {t.status.replace('_', ' ')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-2">
                <div>
                  <p className="text-xs text-zinc-400">Target</p>
                  <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
                    {t.targetUptime}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Current</p>
                  <p
                    className={`text-sm font-bold tabular-nums ${t.currentUptime >= t.targetUptime ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                  >
                    {t.currentUptime}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Incidents</p>
                  <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
                    {t.incidentsThisMonth}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span>Error budget</span>
                  <span>
                    {t.errorBudgetUsed.toFixed(1)} / {t.errorBudgetMinutes} min used
                  </span>
                </div>
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${budgetPct > 80 ? 'bg-red-500' : budgetPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {targets.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-400">No SLO targets configured</p>
        )}
      </div>
    </div>
  );
}
