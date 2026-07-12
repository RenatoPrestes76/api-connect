'use client';

import type { CapacityPlan } from '@/types/prometheus';

const URGENCY_COLOR: Record<string, string> = {
  critical: 'text-red-600 dark:text-red-400',
  high: 'text-orange-600 dark:text-orange-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-emerald-600 dark:text-emerald-400',
};

interface Props {
  plan: CapacityPlan;
}

export function CapacityPlanning({ plan }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Capacity Planning</h3>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <div className="text-center">
            <p className="text-xs text-zinc-400">Current</p>
            <p className="font-bold text-zinc-800 dark:text-zinc-200">{plan.currentClients}</p>
          </div>
          <span className="text-zinc-300 dark:text-zinc-600">→</span>
          <div className="text-center">
            <p className="text-xs text-zinc-400">6 months</p>
            <p className="font-bold text-indigo-600 dark:text-indigo-400">
              {plan.forecastedClients6m}
            </p>
          </div>
          <span className="text-zinc-300 dark:text-zinc-600">→</span>
          <div className="text-center">
            <p className="text-xs text-zinc-400">12 months</p>
            <p className="font-bold text-purple-600 dark:text-purple-400">
              {plan.forecastedClients12m}
            </p>
          </div>
          <span className="text-xs text-zinc-400 ml-1">clients</span>
        </div>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {plan.forecasts.map((f) => {
          const pct6m = Math.min(100, (f.forecast6Months / f.forecast12Months) * 100);
          return (
            <div key={f.resource} className="p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex-1">
                  {f.resource}
                </p>
                <span className={`text-xs font-semibold ${URGENCY_COLOR[f.urgency]}`}>
                  {f.urgency}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
                <span>
                  Now: {f.currentValue} {f.unit}
                </span>
                <span>
                  6m: {f.forecast6Months} {f.unit}
                </span>
                <span>
                  12m: {f.forecast12Months} {f.unit}
                </span>
                <span className="ml-auto font-medium text-indigo-600 dark:text-indigo-400">
                  {f.recommendedAddition}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${URGENCY_COLOR[f.urgency].includes('red') ? 'bg-red-500' : URGENCY_COLOR[f.urgency].includes('orange') ? 'bg-orange-500' : 'bg-indigo-500'}`}
                  style={{ width: `${pct6m}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
