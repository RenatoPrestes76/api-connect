'use client';
import type { ComponentHealth, HealthStatus } from '@/types/observatory';

const STATUS_COLOR: Record<HealthStatus, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-400',
  unhealthy: 'bg-red-500',
  unknown: 'bg-slate-400',
};

const STATUS_TEXT: Record<HealthStatus, string> = {
  healthy: 'text-emerald-600 dark:text-emerald-400',
  degraded: 'text-amber-600  dark:text-amber-400',
  unhealthy: 'text-red-600    dark:text-red-400',
  unknown: 'text-slate-500',
};

interface Props {
  components: ComponentHealth[];
}

export function SystemStatusGrid({ components }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {components.map((c) => (
        <div
          key={c.component}
          className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${STATUS_COLOR[c.status]}`} />
            <span className="text-xs font-medium truncate">{c.component}</span>
          </div>
          <span className={`text-xs font-semibold ${STATUS_TEXT[c.status]}`}>
            {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
          </span>
          {c.latencyMs !== undefined && (
            <span className="text-[10px] text-muted-foreground">{c.latencyMs}ms</span>
          )}
        </div>
      ))}
    </div>
  );
}
