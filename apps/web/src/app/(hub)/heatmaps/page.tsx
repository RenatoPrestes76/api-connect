'use client';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { HeatmapChart } from '@/components/observatory/heatmap';
import { useHeatmap, useMetrics } from '@/hooks/use-observatory';

export default function HeatmapsPage() {
  const { data: heatmapData, isLoading, isError, error, refetch } = useHeatmap();
  const { data: metricsData } = useMetrics(288);

  if (isLoading) return <PageLoading message="Loading heatmap…" />;
  if (isError)
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load heatmap'}
        onRetry={refetch}
      />
    );

  const cells = heatmapData?.cells ?? [];
  const samples = metricsData?.items ?? [];
  const total = cells.reduce((s, c) => s + c.value, 0);
  const peak = cells.reduce(
    (p, c) => (c.value > p.value ? c : p),
    cells[0] ?? { value: 0, label: '—', day: 0, hour: 0 }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Heatmaps"
        description="7-day execution activity by hour — identify peak hours and quiet windows."
      />

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Executions (7d)', value: total.toLocaleString() },
          { label: 'Peak Hour', value: peak.label },
          { label: 'Samples Tracked', value: `${samples.length} × 5min` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-lg font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">Execution Volume — Last 7 Days by Hour</h2>
        <HeatmapChart cells={cells} />
      </div>
    </div>
  );
}
