'use client';
import { Activity, Plug, Server, Database, RefreshCw, AlertTriangle } from 'lucide-react';
import { MetricCard } from '@/components/common/metric-card';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { SyncChart } from '@/components/dashboard/sync-chart';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { useDashboard } from '@/hooks/use-dashboard';
import { formatRelative } from '@/lib/utils';

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboard();

  if (isLoading) return <PageLoading />;
  if (error)     return <ErrorState message="Dashboard unavailable. Could not fetch metrics." onRetry={() => void refetch()} />;
  if (!data)     return null;

  return (
    <div className="space-y-6 max-w-screen-xl">
      <PageHeader
        title="Dashboard"
        description={data.lastSync ? `Last sync ${formatRelative(data.lastSync)}` : undefined}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard
          title="Connectors"
          value={`${data.connectorsOnline}/${data.connectors}`}
          icon={Plug}
          variant={data.connectorsOnline < data.connectors ? 'warning' : 'default'}
        />
        <MetricCard
          title="Agents"
          value={`${data.agentsOnline}/${data.agents}`}
          icon={Server}
          variant={data.agentsOnline < data.agents ? 'warning' : 'default'}
        />
        <MetricCard
          title="Databases"
          value={data.databases}
          icon={Database}
        />
        <MetricCard
          title="Discovery Runs"
          value={data.discoveryRuns}
          icon={RefreshCw}
        />
        <MetricCard
          title="Failures (24h)"
          value={data.failures24h}
          icon={AlertTriangle}
          variant={data.failures24h > 0 ? 'danger' : 'default'}
        />
        <MetricCard
          title="Health"
          value={data.overallHealth}
          icon={Activity}
          variant={
            data.overallHealth === 'healthy'   ? 'success' :
            data.overallHealth === 'degraded'  ? 'warning' : 'danger'
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SyncChart trend={data.syncTrend} />
        </div>
        <ActivityFeed activities={data.recentActivity} />
      </div>
    </div>
  );
}
