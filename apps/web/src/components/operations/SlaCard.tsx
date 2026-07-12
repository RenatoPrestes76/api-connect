'use client';

import { useState } from 'react';
import { useOperationsSla } from '@/hooks/use-operations';
import type { SlaPeriod } from '@/types/operations';

const PERIODS: { key: SlaPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '12m', label: '12 months' },
];

export function SlaCard() {
  const [period, setPeriod] = useState<SlaPeriod>('today');
  const { data, isLoading } = useOperationsSla(period);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">SLA Compliance</h3>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                period === p.key
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 text-center text-sm text-zinc-400">Loading...</div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {data?.records.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {r.tenantName}
                </p>
                <p className="text-xs text-zinc-400">target {r.target}%</p>
              </div>
              <div className="text-right">
                <p
                  className={`text-sm font-bold tabular-nums ${
                    r.met
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {r.availability.toFixed(2)}%
                </p>
                <p className={`text-xs font-medium ${r.met ? 'text-emerald-500' : 'text-red-500'}`}>
                  {r.met ? '✓ Met' : '✗ Missed'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
