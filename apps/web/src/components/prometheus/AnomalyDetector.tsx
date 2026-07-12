'use client';

import type { Anomaly } from '@/types/prometheus';

const SEV_COLOR: Record<string, string> = {
  critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  low: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-red-500 animate-pulse',
  investigating: 'bg-amber-500',
  resolved: 'bg-emerald-500',
};

interface Props {
  anomalies: Anomaly[];
}

export function AnomalyDetector({ anomalies }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">AI Anomaly Detection</h3>
        <span className="text-xs text-zinc-400">{anomalies.length} detected</span>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {anomalies.map((a) => (
          <div key={a.id} className="p-3">
            <div className="flex items-start gap-3">
              <span
                className={`mt-1 flex-shrink-0 inline-block w-2 h-2 rounded-full ${STATUS_DOT[a.status] ?? 'bg-zinc-400'}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {a.title}
                  </p>
                  <span
                    className={`text-[10px] font-medium rounded-full px-2 py-0.5 uppercase ${SEV_COLOR[a.severity]}`}
                  >
                    {a.severity}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{a.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all"
                      style={{ width: `${a.probability}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 tabular-nums w-10 text-right">
                    {a.probability}%
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-400">
                  <span>{a.source}</span>
                  <span>
                    {a.metric}: {a.normalValue} →{' '}
                    <strong className="text-red-500">{a.detectedValue}</strong> {a.unit}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {anomalies.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-400">No anomalies detected</p>
        )}
      </div>
    </div>
  );
}
