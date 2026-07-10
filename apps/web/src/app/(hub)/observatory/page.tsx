'use client';
import {
  Activity,
  AlertTriangle,
  Shield,
  Clock,
  TrendingUp,
  Zap,
  Server,
  CheckCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { SystemStatusGrid } from '@/components/observatory/system-status-grid';
import { MetricSparkline } from '@/components/observatory/metric-sparkline';
import { useDashboard } from '@/hooks/use-observatory';

function KpiTile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${accent ?? 'text-muted-foreground'}`} />
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function ObservatoryPage() {
  const { data, isLoading, isError, error, refetch } = useDashboard(true);

  if (isLoading) return <PageLoading message="Loading Observatory…" />;
  if (isError)
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load dashboard'}
        onRetry={refetch}
      />
    );
  if (!data) return null;

  const execFmt =
    data.executionsToday >= 1_000_000
      ? `${(data.executionsToday / 1_000_000).toFixed(2)}M`
      : data.executionsToday.toLocaleString();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Observatory"
        description="Enterprise observability — real-time platform health, metrics, and alerts."
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTile
          icon={Zap}
          label="Integrations Active"
          value={data.integrationsActive.toLocaleString()}
          accent="text-indigo-500"
        />
        <KpiTile
          icon={TrendingUp}
          label="Executions Today"
          value={execFmt}
          sub={`${data.throughputPerMin.toFixed(1)}/min`}
          accent="text-emerald-500"
        />
        <KpiTile
          icon={CheckCircle}
          label="Availability"
          value={`${data.availabilityPct}%`}
          accent="text-emerald-500"
        />
        <KpiTile
          icon={AlertTriangle}
          label="Open Alerts"
          value={data.alertsOpen}
          accent={data.alertsOpen > 0 ? 'text-amber-500' : 'text-muted-foreground'}
        />
        <KpiTile
          icon={Shield}
          label="Open Incidents"
          value={data.incidentsOpen}
          accent={data.incidentsOpen > 0 ? 'text-red-500' : 'text-muted-foreground'}
        />
        <KpiTile
          icon={Clock}
          label="SLA Breaches Today"
          value={data.slaBreachesToday}
          accent={data.slaBreachesToday > 0 ? 'text-red-500' : 'text-muted-foreground'}
        />
      </div>

      {/* Component Status */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          System Status
        </h2>
        <SystemStatusGrid components={data.componentHealth} />
      </section>

      {/* Throughput sparkline */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold">Throughput — Last 4h</span>
          <span className="ml-auto text-xs text-muted-foreground">executions/min</span>
        </div>
        <MetricSparkline
          data={data.trend}
          field="executionsPerMinute"
          color="#6366f1"
          height={64}
        />
      </section>

      {/* Success rate + avg duration */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold">Success Rate</span>
          </div>
          <MetricSparkline data={data.trend} field="successRate" color="#10b981" height={48} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">Avg Duration (ms)</span>
          </div>
          <MetricSparkline data={data.trend} field="avgDurationMs" color="#f59e0b" height={48} />
        </div>
      </div>
    </div>
  );
}
