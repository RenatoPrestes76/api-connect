'use client';

import type { TenantHealth, HealthStatus } from '@/types/operations';

const STATUS_LABEL: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
  offline: 'Offline',
};

const STATUS_CLASSES: Record<HealthStatus, string> = {
  healthy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  offline: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

const STATUS_DOT: Record<HealthStatus, string> = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
  offline: 'bg-zinc-400',
};

interface Props {
  tenants: TenantHealth[];
}

export function TenantGrid({ tenants }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tenants.map((t) => (
        <div
          key={t.tenantId}
          className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">{t.tenantName}</p>
              <p className="text-xs text-zinc-400 capitalize">{t.plan}</p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[t.overallStatus]}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[t.overallStatus]}`} />
              {STATUS_LABEL[t.overallStatus]}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-zinc-400">SLA</p>
              <p className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {t.sla.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-zinc-400">Alerts</p>
              <p
                className={`font-semibold tabular-nums ${t.alertCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-100'}`}
              >
                {t.alertCount}
              </p>
            </div>
            <div>
              <p className="text-zinc-400">Checks</p>
              <p className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {t.checks.length}
              </p>
            </div>
          </div>

          {/* Mini check bar */}
          <div className="flex gap-0.5 flex-wrap">
            {t.checks.map((c) => (
              <span
                key={c.id}
                title={`${c.componentType}: ${c.message}`}
                className={`w-3 h-3 rounded-sm ${STATUS_DOT[c.status]}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
