'use client';
import { useGoLiveMetrics, useCurrentVersion, useChecklist } from '@/hooks/use-release';
import { VersionBadge } from '@/components/release/version-badge';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { cn } from '@/lib/utils';

function MetricCard({
  metric,
}: {
  metric: {
    name: string;
    value: number;
    unit: string;
    target: number;
    status: string;
    description: string;
  };
}) {
  const met = metric.status === 'met';
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        met ? 'border-green-700/40 bg-green-900/10' : 'border-red-700/40 bg-red-900/10'
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs text-slate-400">{metric.name}</p>
        <span className={cn('text-xs font-medium', met ? 'text-green-400' : 'text-red-400')}>
          {met ? '✓ OK' : '✗ FAIL'}
        </span>
      </div>
      <p
        className={cn('mt-1 text-xl font-bold font-mono', met ? 'text-slate-100' : 'text-red-300')}
      >
        {metric.value.toLocaleString()}
        {metric.unit.length <= 3 ? metric.unit : ''}
      </p>
      <p className="mt-0.5 text-xs text-slate-600">{metric.description}</p>
    </div>
  );
}

export default function ReleasePage() {
  const { data: metrics, isLoading: mLoading, error: mError } = useGoLiveMetrics();
  const { data: version, isLoading: vLoading } = useCurrentVersion();
  const { data: checklist } = useChecklist();

  if (mLoading || vLoading) return <PageLoading />;
  if (mError || !metrics) return <ErrorState message="Erro ao carregar métricas de go-live" />;

  const checklistPct = checklist ? Math.round((checklist.passed / checklist.total) * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Go-Live Command Center</h1>
          <p className="mt-0.5 text-sm text-slate-400">Atlas Connect v1.0 — Sprint 37 — ODYSSEY</p>
        </div>
        {version && <VersionBadge version={version.version} stage={version.stage} />}
      </div>

      <div
        className={cn(
          'rounded-lg border p-4',
          metrics.allCriticalMet
            ? 'border-green-700/40 bg-green-900/10'
            : 'border-red-700/40 bg-red-900/10'
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn('text-2xl', metrics.allCriticalMet ? '' : '')}>
            {metrics.allCriticalMet ? '🚀' : '⚠️'}
          </span>
          <div>
            <p
              className={cn(
                'font-semibold',
                metrics.allCriticalMet ? 'text-green-300' : 'text-red-300'
              )}
            >
              {metrics.allCriticalMet
                ? 'Atlas Connect v1.0 — APROVADO PARA GA'
                : 'Critérios críticos não atendidos'}
            </p>
            <p className="text-xs text-slate-400">
              {metrics.metricsMet}/{metrics.metrics.length} métricas OK · Checklist: {checklistPct}%
              concluído
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'MRR', value: `$${metrics.mrr.toLocaleString()}` },
          { label: 'Tenants', value: metrics.tenants },
          { label: 'Agents', value: metrics.agents },
          { label: 'NPS', value: `${metrics.nps}` },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className="mt-1 text-xl font-bold text-slate-100">{k.value}</p>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-medium text-slate-400">Métricas de SLA</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {metrics.metrics.map((m) => (
          <MetricCard key={m.key} metric={m} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Workflows Ativos', value: metrics.workflowsActive },
          { label: 'Conectores', value: metrics.connectorsInstalled },
          { label: 'API Calls/dia', value: metrics.apiCallsPerDay.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-700 bg-slate-800 py-4">
            <p className="text-2xl font-bold text-slate-100">{s.value}</p>
            <p className="mt-1 text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
