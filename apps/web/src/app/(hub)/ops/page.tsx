'use client';

import { useOpsDashboard, useHealth } from '@/hooks/use-ops';
import { SloGauge } from '@/components/ops/slo-gauge';
import { CircuitBreakerCard } from '@/components/ops/circuit-breaker-card';
import { QueueStatusCard } from '@/components/ops/queue-status-card';
import type { SloDefinition } from '@/types/ops';

function KpiTile({
  label,
  value,
  sub,
  color = 'text-zinc-900 dark:text-zinc-100',
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function OpsPage() {
  const { data: dashboard, isLoading } = useOpsDashboard();
  const { data: health } = useHealth();
  const d = dashboard as any;
  const h = health as any;

  const statusColor =
    h?.status === 'healthy'
      ? 'text-green-600'
      : h?.status === 'degraded'
        ? 'text-amber-500'
        : 'text-red-600';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Operational Dashboard
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Platform health, SLOs, queues, circuit breakers, and reliability metrics.
          </p>
        </div>
        {h && (
          <span
            className={`text-xs font-semibold uppercase px-2.5 py-1 rounded-full border ${
              h.status === 'healthy'
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
                : h.status === 'degraded'
                  ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
                  : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}
          >
            {h.status}
          </span>
        )}
      </div>

      {/* KPI tiles */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiTile
            label="SLO Compliance"
            value={`${d?.kpis.sloCompliance.value}/${d?.kpis.sloCompliance.total}`}
            sub="compliant objectives"
            color={
              d?.kpis.sloCompliance.value === d?.kpis.sloCompliance.total
                ? 'text-green-600 dark:text-green-400'
                : 'text-amber-500'
            }
          />
          <KpiTile
            label="Open Circuits"
            value={d?.kpis.openCircuits.value ?? 0}
            sub={`of ${d?.kpis.openCircuits.total} circuit breakers`}
            color={
              d?.kpis.openCircuits.value > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            }
          />
          <KpiTile
            label="Queue Depth"
            value={d?.kpis.queueDepth.value ?? 0}
            sub={d?.kpis.queueDepth.dlq > 0 ? `${d.kpis.queueDepth.dlq} in DLQ` : 'No DLQ items'}
          />
          <KpiTile
            label="Feature Flags"
            value={`${d?.kpis.featureFlags.enabled}/${d?.kpis.featureFlags.total}`}
            sub="enabled flags"
          />
        </div>
      )}

      {/* Queue + Health checks side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {d?.queues && <QueueStatusCard stats={d.queues} />}

        {h?.checks && (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
              Health Checks
            </h3>
            <div className="space-y-2">
              {h.checks.map((check: any) => (
                <div key={check.name} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-700 dark:text-zinc-300">{check.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">{check.responseTime}ms</span>
                    <span
                      className={`text-xs font-medium ${
                        check.status === 'healthy'
                          ? 'text-green-600 dark:text-green-400'
                          : check.status === 'degraded'
                            ? 'text-amber-500'
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {check.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SLOs summary */}
      {d?.slos && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Service Level Objectives
            </h2>
          </div>
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800 px-4">
            {d.slos.map((slo: SloDefinition) => (
              <div key={slo.id} className="py-2.5">
                <SloGauge slo={slo} compact />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Circuit breakers */}
      {d?.circuitBreakers && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Circuit Breakers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {d.circuitBreakers.map((c: any) => (
              <CircuitBreakerCard key={c.name} circuit={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
