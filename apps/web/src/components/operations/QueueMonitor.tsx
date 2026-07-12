'use client';

import type { TenantHealth, HealthCheck } from '@/types/operations';

interface Props {
  tenants: TenantHealth[];
}

const statusClasses: Record<string, string> = {
  healthy: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
  offline: 'text-zinc-400',
};

export function QueueMonitor({ tenants }: Props) {
  const queues: Array<HealthCheck & { tenantName: string }> = tenants.flatMap((t) =>
    t.checks
      .filter((c) => c.componentType === 'queue')
      .map((c) => ({ ...c, tenantName: t.tenantName }))
  );

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Queue Monitor</h3>
        <p className="text-xs text-zinc-400 mt-0.5">{queues.length} queues</p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {queues.map((q) => (
          <div key={q.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {q.componentId}
              </p>
              <p className="text-xs text-zinc-400 truncate">{q.tenantName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-semibold ${statusClasses[q.status]}`}>{q.status}</p>
              <p className="text-xs text-zinc-400 truncate max-w-[160px]">{q.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
