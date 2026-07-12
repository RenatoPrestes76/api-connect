'use client';

import type { TelemetryOverview } from '@/types/prometheus';

interface Props {
  data: TelemetryOverview;
}

const CARD_CFG = [
  { key: 'totalTraces', label: 'Total Traces', color: 'text-indigo-600 dark:text-indigo-400' },
  { key: 'errorTraces', label: 'Error Traces', color: 'text-red-600 dark:text-red-400' },
  { key: 'timeoutTraces', label: 'Timeout Traces', color: 'text-orange-600 dark:text-orange-400' },
  {
    key: 'p99DurationMs',
    label: 'P99 Latency',
    color: 'text-amber-600 dark:text-amber-400',
    suffix: 'ms',
  },
  {
    key: 'servicesHealthy',
    label: 'Healthy Services',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  { key: 'servicesDegraded', label: 'Degraded', color: 'text-yellow-600 dark:text-yellow-400' },
  { key: 'activeAlerts', label: 'Active Alerts', color: 'text-red-600 dark:text-red-400' },
  { key: 'openIncidents', label: 'Open Incidents', color: 'text-orange-600 dark:text-orange-400' },
  { key: 'logsPerMin', label: 'Logs/min', color: 'text-zinc-700 dark:text-zinc-300' },
] as const;

export function TelemetryOverview({ data }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4 text-sm">
        Telemetry Overview — OpenTelemetry
      </h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-9 gap-3">
        {CARD_CFG.map(({ key, label, color, suffix }) => (
          <div key={key} className="flex flex-col items-center gap-0.5">
            <span className={`text-xl font-bold tabular-nums ${color}`}>
              {(data[key as keyof TelemetryOverview] as number).toLocaleString()}
              {suffix ?? ''}
            </span>
            <span className="text-[10px] text-zinc-400 text-center leading-tight">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
        {data.servicesHealthy}/{data.servicesTotal} services healthy
        <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 ml-2" />
        {data.servicesDegraded} degraded
        <span className="inline-block w-2 h-2 rounded-full bg-red-400 ml-2" />
        {data.servicesDown} down
      </div>
    </div>
  );
}
