'use client';

import { useSlos } from '@/hooks/use-ops';
import { SloGauge } from '@/components/ops/slo-gauge';
import type { SloDefinition, SloStatus } from '@/types/ops';

const STATUS_LABELS: Record<SloStatus, string> = {
  compliant: '✓ Compliant',
  warning: '⚠ Warning',
  breached: '✗ Breached',
};

const STATUS_COLORS: Record<SloStatus, string> = {
  compliant: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800',
  warning: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800',
  breached: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800',
};

export default function SloPage() {
  const { data, isLoading } = useSlos();
  const d = data as any;
  const slos: SloDefinition[] = d?.slos ?? [];
  const summary = d?.summary;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">SLO / SLA Monitoring</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Service Level Objectives, error budgets, and compliance tracking.
        </p>
      </div>

      {/* Summary tiles */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 p-4 text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {summary.compliant}
            </div>
            <div className="text-xs text-green-600 dark:text-green-500 mt-1">Compliant</div>
          </div>
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4 text-center">
            <div className="text-3xl font-bold text-amber-500">{summary.warning}</div>
            <div className="text-xs text-amber-500 mt-1">Warning</div>
          </div>
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4 text-center">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {summary.breached}
            </div>
            <div className="text-xs text-red-500 mt-1">Breached</div>
          </div>
        </div>
      )}

      {/* SLO cards */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-36 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slos.map((slo) => (
            <SloGauge key={slo.id} slo={slo} />
          ))}
        </div>
      )}

      {/* SLA definitions table */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">SLA Targets</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-4 py-2 text-left font-medium">Objective</th>
                <th className="px-4 py-2 text-left font-medium">Target</th>
                <th className="px-4 py-2 text-left font-medium">Current</th>
                <th className="px-4 py-2 text-left font-medium">Window</th>
                <th className="px-4 py-2 text-left font-medium">Budget</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {slos.map((slo) => (
                <tr key={slo.id} className={`text-sm ${STATUS_COLORS[slo.status]}`}>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {slo.name}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {slo.unit === '%'
                      ? `${slo.target}%`
                      : slo.unit === 'ms'
                        ? `${slo.target}ms`
                        : `${slo.target}${slo.unit}`}
                  </td>
                  <td className="px-4 py-3 tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                    {slo.unit === '%'
                      ? `${slo.current}%`
                      : slo.unit === 'ms'
                        ? `${slo.current}ms`
                        : `${slo.current}${slo.unit}`}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{slo.windowDays}d</td>
                  <td className="px-4 py-3 text-zinc-500">{slo.errorBudgetPercent}%</td>
                  <td className="px-4 py-3 text-xs font-medium">
                    <span
                      className={
                        slo.status === 'compliant'
                          ? 'text-green-600 dark:text-green-400'
                          : slo.status === 'warning'
                            ? 'text-amber-500'
                            : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {STATUS_LABELS[slo.status]}
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
