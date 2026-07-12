'use client';

import type { OperationsAlert } from '@/types/operations';

interface Props {
  alerts: OperationsAlert[];
  onResolve?: (id: string) => void;
}

const severityClasses: Record<string, string> = {
  critical: 'border-l-red-500 bg-red-50 dark:bg-red-950/20',
  error: 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20',
  warning: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20',
  info: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20',
};

const severityBadge: Record<string, string> = {
  critical: 'text-red-700 dark:text-red-300',
  error: 'text-orange-700 dark:text-orange-300',
  warning: 'text-amber-700 dark:text-amber-300',
  info: 'text-blue-700 dark:text-blue-300',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export function RecentFailures({ alerts, onResolve }: Props) {
  const open = alerts.filter((a) => !a.resolved).slice(0, 10);

  if (open.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 text-center">
        <p className="text-sm text-zinc-400">No open alerts</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Recent Failures</h3>
        <p className="text-xs text-zinc-400 mt-0.5">{open.length} open</p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {open.map((a) => (
          <div
            key={a.id}
            className={`flex items-start gap-3 px-4 py-3 border-l-2 ${severityClasses[a.severity]}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold uppercase ${severityBadge[a.severity]}`}>
                  {a.severity}
                </span>
                <span className="text-xs text-zinc-400">{timeAgo(a.createdAt)}</span>
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-0.5">
                {a.title}
              </p>
              <p className="text-xs text-zinc-400 truncate">{a.description}</p>
            </div>
            {onResolve && (
              <button
                onClick={() => onResolve(a.id)}
                className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0"
              >
                Resolve
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
