'use client';

import type { TenantHealth, HealthCheck } from '@/types/operations';

interface Props {
  tenants: TenantHealth[];
  onRetry?: (tenantId: string, connectorId: string) => void;
}

const statusBadge: Record<string, string> = {
  healthy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  offline: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};

export function ConnectorHealth({ tenants, onRetry }: Props) {
  const connectors: Array<HealthCheck & { tenantName: string }> = tenants.flatMap((t) =>
    t.checks
      .filter((c) => c.componentType === 'connector')
      .map((c) => ({ ...c, tenantName: t.tenantName }))
  );

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Connectors</h3>
        <p className="text-xs text-zinc-400 mt-0.5">{connectors.length} total</p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {connectors.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {c.componentId}
              </p>
              <p className="text-xs text-zinc-400 truncate">
                {c.tenantName} · {c.message}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[c.status]}`}
              >
                {c.status}
              </span>
              {(c.status === 'offline' || c.status === 'critical') && onRetry && (
                <button
                  onClick={() => onRetry(c.tenantId, c.componentId)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
