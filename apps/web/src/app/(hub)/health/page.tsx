'use client';
import { Activity, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { HealthIndicator, MetricGauge } from '@/components/status/health-indicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useHealth } from '@/hooks/use-health';
import { formatDateTime } from '@/lib/utils';

export default function HealthPage() {
  const { data, isLoading, error, refetch } = useHealth();

  if (isLoading) return <PageLoading />;
  if (error)
    return <ErrorState message="Health data unavailable." onRetry={() => void refetch()} />;
  if (!data) return null;

  return (
    <div className="space-y-4 max-w-screen-lg">
      <PageHeader
        title="Health Monitor"
        description={`Last checked ${formatDateTime(data.timestamp)}`}
        actions={
          <div className="flex items-center gap-3">
            <HealthIndicator status={data.overall} size="lg" />
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* System metrics */}
        <Card>
          <CardHeader>
            <CardTitle>System Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.metrics.length === 0 ? (
              <p className="text-sm text-slate-400">No metrics available.</p>
            ) : (
              data.metrics.map((m) => (
                <MetricGauge
                  key={m.label}
                  label={m.label}
                  value={m.value}
                  max={m.threshold ?? 100}
                  unit={m.unit}
                  status={m.status}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Component health */}
        <Card>
          <CardHeader>
            <CardTitle>Components</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.components.length === 0 ? (
              <p className="text-sm text-slate-400">No component data available.</p>
            ) : (
              data.components.map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-slate-900">{c.name}</p>
                    {c.message && <p className="text-xs text-slate-500 truncate">{c.message}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {c.latencyMs != null && (
                      <span className="text-xs tabular-nums text-slate-400">{c.latencyMs}ms</span>
                    )}
                    <HealthIndicator status={c.status} size="sm" />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
