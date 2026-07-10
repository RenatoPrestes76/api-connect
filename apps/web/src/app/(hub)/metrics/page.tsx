'use client';
import { Activity, TrendingUp, Clock, AlertOctagon } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { MetricSparkline } from '@/components/observatory/metric-sparkline';
import { useMetrics } from '@/hooks/use-observatory';

function MetricCard({
  title,
  icon: Icon,
  color,
  field,
  data,
  unit = '',
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  field:
    | 'executionsPerMinute'
    | 'successRate'
    | 'avgDurationMs'
    | 'failureCount'
    | 'queueDepth'
    | 'p95DurationMs';
  data: Parameters<typeof MetricSparkline>[0]['data'];
  unit?: string;
}) {
  const latest = data[data.length - 1];
  const val = latest ? Number(latest[field]) : 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {val.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          {unit}
        </span>
      </div>
      <MetricSparkline data={data} field={field} color={color} height={56} />
    </div>
  );
}

export default function MetricsPage() {
  const { data, isLoading, isError, error, refetch } = useMetrics(288, true);

  if (isLoading) return <PageLoading message="Loading metrics…" />;
  if (isError)
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load metrics'}
        onRetry={refetch}
      />
    );

  const samples = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metrics Engine"
        description="24-hour rolling metrics across all workflows, connectors, and agents."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Executions / min"
          icon={Activity}
          color="#6366f1"
          field="executionsPerMinute"
          data={samples}
        />
        <MetricCard
          title="Success Rate"
          icon={TrendingUp}
          color="#10b981"
          field="successRate"
          data={samples}
          unit="%"
        />
        <MetricCard
          title="Avg Duration"
          icon={Clock}
          color="#f59e0b"
          field="avgDurationMs"
          data={samples}
          unit="ms"
        />
        <MetricCard
          title="P95 Duration"
          icon={Clock}
          color="#f97316"
          field="p95DurationMs"
          data={samples}
          unit="ms"
        />
        <MetricCard
          title="Failure Count"
          icon={AlertOctagon}
          color="#ef4444"
          field="failureCount"
          data={samples}
        />
        <MetricCard
          title="Queue Depth"
          icon={Activity}
          color="#8b5cf6"
          field="queueDepth"
          data={samples}
        />
      </div>

      {samples.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <div className="text-xs text-muted-foreground">
            Showing {samples.length} samples — 5-minute buckets over 24 hours. Last sample:{' '}
            {new Date(samples[samples.length - 1]!.ts).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
