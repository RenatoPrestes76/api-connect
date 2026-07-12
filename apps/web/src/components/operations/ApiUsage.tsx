'use client';

import type { OperationsMetric } from '@/types/operations';

interface Props {
  metrics: OperationsMetric[];
  tenantName?: string;
}

const METRIC_LABELS: Record<string, string> = {
  response_time_avg: 'Avg Response',
  p95_latency: 'p95 Latency',
  p99_latency: 'p99 Latency',
  cpu_usage: 'CPU',
  memory_usage: 'Memory',
  disk_usage: 'Disk',
  heartbeats_per_min: 'Heartbeats/min',
  retries: 'Retries',
  failures: 'Failures',
  jobs_executed: 'Jobs Executed',
  availability: 'Availability',
};

function statusForMetric(metric: string, value: number): string {
  if (metric === 'cpu_usage' || metric === 'memory_usage' || metric === 'disk_usage') {
    if (value > 85) return 'text-red-600 dark:text-red-400';
    if (value > 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  }
  if (metric === 'failures' || metric === 'retries') {
    if (value > 5) return 'text-red-600 dark:text-red-400';
    if (value > 0) return 'text-amber-600 dark:text-amber-400';
    return 'text-zinc-900 dark:text-zinc-100';
  }
  if (metric === 'availability') {
    if (value < 99) return 'text-red-600 dark:text-red-400';
    if (value < 99.9) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  }
  return 'text-zinc-900 dark:text-zinc-100';
}

export function ApiUsage({ metrics, tenantName }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
          {tenantName ? `Metrics — ${tenantName}` : 'API Usage & Metrics'}
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-zinc-100 dark:bg-zinc-800">
        {metrics.map((m) => (
          <div key={m.id} className="bg-white dark:bg-zinc-900 p-3">
            <p className="text-xs text-zinc-400">{METRIC_LABELS[m.metric] ?? m.metric}</p>
            <p
              className={`text-lg font-bold tabular-nums mt-0.5 ${statusForMetric(m.metric, m.value)}`}
            >
              {m.metric === 'availability'
                ? `${m.value.toFixed(2)}%`
                : m.metric.includes('usage')
                  ? `${m.value}%`
                  : m.value.toLocaleString()}
              {m.unit !== '%' && m.unit !== 'count' && m.unit !== 'hb/min' ? (
                <span className="text-xs font-normal text-zinc-400 ml-1">{m.unit}</span>
              ) : null}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
