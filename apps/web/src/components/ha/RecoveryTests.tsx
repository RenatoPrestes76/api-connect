'use client';

import { useState } from 'react';
import type { RecoveryTest } from '@/types/ha';

const TENANTS = ['tenant-enterprise', 'tenant-professional', 'tenant-community'];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days > 0) return `${days}d ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

interface Props {
  tests: RecoveryTest[];
  rtoByTenant: Record<string, number>;
  rpoByTenant: Record<string, number>;
  onRunTest?: (tenantId: string) => void;
  isPending?: boolean;
}

export function RecoveryTests({ tests, rtoByTenant, rpoByTenant, onRunTest, isPending }: Props) {
  const [selectedTenant, setSelectedTenant] = useState(TENANTS[0]!);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Recovery Tests</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {tests.filter((t) => t.result === 'passed').length}/{tests.length} passed
          </p>
        </div>
        {onRunTest && (
          <div className="flex items-center gap-2">
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              {TENANTS.map((t) => (
                <option key={t} value={t}>
                  {t.replace('tenant-', '')}
                </option>
              ))}
            </select>
            <button
              onClick={() => onRunTest(selectedTenant)}
              disabled={isPending}
              className="text-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded px-3 py-1.5 font-medium hover:opacity-90 disabled:opacity-50"
            >
              Run Test
            </button>
          </div>
        )}
      </div>

      {/* RTO/RPO summary */}
      <div className="grid grid-cols-3 gap-px bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800">
        {TENANTS.map((t) => (
          <div key={t} className="bg-white dark:bg-zinc-900 px-3 py-2">
            <p className="text-xs text-zinc-400">{t.replace('tenant-', '')}</p>
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              RTO {rtoByTenant[t] ?? '—'}s · RPO {rpoByTenant[t] ?? '—'}min
            </p>
          </div>
        ))}
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {tests.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-4 py-3 border-l-2 ${
              t.result === 'passed' ? 'border-l-emerald-500' : 'border-l-red-500'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold ${
                    t.result === 'passed'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {t.result === 'passed' ? '✓ Passed' : '✗ Failed'}
                </span>
                <span className="text-xs text-zinc-400">{timeAgo(t.testedAt)}</span>
                <span className="text-xs text-zinc-400">{t.tenantId.replace('tenant-', '')}</span>
              </div>
              {t.result === 'passed' && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  RTO {t.rtoSeconds}s · RPO {t.rpoMinutes}min · {(t.durationMs / 1000).toFixed(1)}s
                  total
                </p>
              )}
              <p className="text-xs text-zinc-400 mt-0.5 truncate">{t.notes}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
