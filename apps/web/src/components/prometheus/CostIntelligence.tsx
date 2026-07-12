'use client';

import type { CostReport } from '@/types/prometheus';

interface Props {
  report: CostReport;
}

export function CostIntelligence({ report }: Props) {
  const maxCost = Math.max(...report.tenants.map((t) => t.totalCost));

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Cost Intelligence</h3>
          <span className="text-xs text-zinc-400">{report.period}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3 text-center">
          <div>
            <p className="text-xs text-zinc-400">Revenue</p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              R$ {report.totalRevenue.toLocaleString('pt-BR')}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Infra Cost</p>
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
              R$ {report.totalPlatformCost.toLocaleString('pt-BR')}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Margin</p>
            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
              {report.margin.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Tenant breakdown */}
      <div className="p-3 space-y-2">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">By Tenant</p>
        {report.tenants.map((t) => (
          <div key={t.tenantId} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
                {t.tenantName}
              </span>
              <span className="tabular-nums text-zinc-600 dark:text-zinc-400 ml-2">
                R$ {t.totalCost.toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${(t.totalCost / maxCost) * 100}%` }}
              />
            </div>
            <div className="flex gap-2 text-[10px] text-zinc-400">
              <span>API: R${t.apiCost}</span>
              <span>AI: R${t.aiCost}</span>
              <span>Storage: R${t.storageCost}</span>
              <span>Worker: R${t.workerCost}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Top workflows */}
      <div className="p-3 border-t border-zinc-100 dark:border-zinc-800">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
          Top Workflows by Cost
        </p>
        {report.topWorkflows.slice(0, 3).map((w) => (
          <div key={w.workflowId} className="flex items-center justify-between text-xs py-1">
            <span className="text-zinc-600 dark:text-zinc-400 truncate flex-1">
              {w.workflowName}
            </span>
            <span className="tabular-nums text-zinc-700 dark:text-zinc-300 ml-2">
              R$ {w.totalCost}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
