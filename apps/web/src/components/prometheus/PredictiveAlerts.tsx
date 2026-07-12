'use client';

import type { PredictiveAlert } from '@/types/prometheus';

const TYPE_ICON: Record<string, string> = {
  disk: '💾',
  memory: '🧠',
  cpu: '⚡',
  connections: '🔗',
  latency: '⏱',
  error_rate: '🔴',
};

const URGENCY_COLOR = (days: number) => {
  if (days <= 7) return 'text-red-600 dark:text-red-400';
  if (days <= 14) return 'text-orange-600 dark:text-orange-400';
  if (days <= 21) return 'text-amber-600 dark:text-amber-400';
  return 'text-zinc-600 dark:text-zinc-400';
};

interface Props {
  alerts: PredictiveAlert[];
}

export function PredictiveAlerts({ alerts }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Predictive Alerts</h3>
        <p className="text-xs text-zinc-400 mt-0.5">Failure forecasts based on trend analysis</p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {alerts.map((a) => (
          <div key={a.id} className="p-3 flex items-start gap-3">
            <span className="text-xl">{TYPE_ICON[a.type] ?? '📊'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                {a.resource}
              </p>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${a.currentValue}%`,
                      background: `hsl(${120 - a.currentValue * 1.2}, 70%, 50%)`,
                    }}
                  />
                </div>
                <span className="text-xs tabular-nums text-zinc-500">
                  {a.currentValue}
                  {a.unit}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Trend:{' '}
                <strong>
                  +{a.trendPerDay}
                  {a.unit}/day
                </strong>{' '}
                — Failure in:{' '}
                <span className={`font-semibold ${URGENCY_COLOR(a.predictedFailureInDays)}`}>
                  {a.predictedFailureInDays} days
                </span>
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{a.recommendation}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-zinc-400">confidence</p>
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{a.confidence}%</p>
            </div>
          </div>
        ))}
        {alerts.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-400">No predictive alerts</p>
        )}
      </div>
    </div>
  );
}
