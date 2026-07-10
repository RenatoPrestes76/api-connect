'use client';
import { formatDistanceToNow } from 'date-fns';
import { Shield, Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { SLAGauge } from '@/components/observatory/sla-gauge';
import { useSLAs, useSLAEvents } from '@/hooks/use-observatory';

function durationLabel(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(0)}m`;
  return `${(ms / 1_000).toFixed(0)}s`;
}

export default function SLAPage() {
  const { data: slas, isLoading, isError, error, refetch } = useSLAs();
  const { data: eventsData } = useSLAEvents({ limit: 20 });

  if (isLoading) return <PageLoading message="Loading SLA definitions…" />;
  if (isError)
    return (
      <ErrorState message={(error as Error)?.message ?? 'Failed to load SLAs'} onRetry={refetch} />
    );

  const slaList = slas ?? [];
  const events = eventsData?.items ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="SLA Monitor"
        description="Define and track service-level agreements for workflow execution time."
        actions={
          <button className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            New SLA
          </button>
        }
      />

      {/* Gauges */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Compliance
        </h2>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {slaList.map((s) => (
            <SLAGauge key={s.id} sla={s} />
          ))}
        </div>
      </section>

      {/* SLA definitions table */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Definitions
        </h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Max Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Warn At
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Compliance
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Breaches
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slaList.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.description}</div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{durationLabel(s.maxDurationMs)}</td>
                  <td className="px-4 py-3 tabular-nums text-amber-600 dark:text-amber-400">
                    {durationLabel(s.warnThresholdMs)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <span
                      className={
                        s.compliancePct >= 99
                          ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          : s.compliancePct >= 95
                            ? 'text-amber-600 dark:text-amber-400 font-semibold'
                            : 'text-red-600 dark:text-red-400 font-semibold'
                      }
                    >
                      {s.compliancePct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-red-600 dark:text-red-400">
                    {s.breachCount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                    >
                      {s.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent events */}
      {events.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Recent Violations
          </h2>
          <div className="space-y-2">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 text-sm"
              >
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold flex-shrink-0 ${ev.breached ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}
                >
                  {ev.violationType.toUpperCase()}
                </span>
                <span className="flex-1 truncate">{ev.workflowName}</span>
                <span className="tabular-nums text-xs">
                  {ev.actualDurationMs.toLocaleString()}ms / {ev.limitMs.toLocaleString()}ms limit
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
