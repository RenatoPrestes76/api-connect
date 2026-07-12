'use client';

import { useState } from 'react';
import { useOperationsAlerts, useResolveAlert } from '@/hooks/use-operations';
import type { AlertSeverity } from '@/types/operations';

const SEVERITY_FILTERS: Array<{ key: AlertSeverity | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'error', label: 'Error' },
  { key: 'warning', label: 'Warning' },
  { key: 'info', label: 'Info' },
];

const severityBadge: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  error: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
};

function timeAgo(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export function AlertCenter() {
  const [severity, setSeverity] = useState<AlertSeverity | 'all'>('all');
  const [showResolved, setShowResolved] = useState(false);

  const { data, isLoading } = useOperationsAlerts({
    severity: severity === 'all' ? undefined : severity,
    resolved: showResolved ? undefined : false,
  });
  const resolve = useResolveAlert();

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Alert Center</h3>
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded"
            />
            Show resolved
          </label>
        </div>
        <div className="flex gap-1 flex-wrap">
          {SEVERITY_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setSeverity(f.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                severity === f.key
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 text-center text-sm text-zinc-400">Loading alerts...</div>
      ) : !data?.alerts.length ? (
        <div className="p-6 text-center text-sm text-zinc-400">No alerts found</div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[480px] overflow-y-auto">
          {data.alerts.map((a) => (
            <div
              key={a.id}
              className={`flex items-start gap-3 px-4 py-3 ${a.resolved ? 'opacity-50' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityBadge[a.severity]}`}
                  >
                    {a.severity}
                  </span>
                  <span className="text-xs text-zinc-400">{timeAgo(a.createdAt)}</span>
                  {a.resolved && <span className="text-xs text-emerald-500">resolved</span>}
                </div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
                  {a.title}
                </p>
                <p className="text-xs text-zinc-400">{a.description}</p>
              </div>
              {!a.resolved && (
                <button
                  onClick={() => resolve.mutate(a.id)}
                  disabled={resolve.isPending}
                  className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0 disabled:opacity-50"
                >
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
