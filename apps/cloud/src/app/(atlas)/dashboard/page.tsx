'use client';
import { Building2, Server, Activity, AlertTriangle, WifiOff, RefreshCw } from 'lucide-react';
import { useDashboardMetrics } from '../../../hooks/use-dashboard-metrics';
import { useActivity } from '../../../hooks/use-heartbeats';
import { MetricCard } from '../../../components/atlas/metric-card';
import { PageHeader } from '../../../components/atlas/page-header';
import { StatusBadge } from '../../../components/atlas/status-badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { LoadingCard, LoadingSpinner } from '../../../components/atlas/loading';
import { ErrorState } from '../../../components/atlas/error-state';
import { formatRelative, formatBytes } from '../../../lib/utils';

export default function DashboardPage() {
  const metrics = useDashboardMetrics();
  const activity = useActivity();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Real-time overview of Atlas agent fleet"
        breadcrumb={[{ label: 'Dashboard' }]}
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <LoadingCard key={i} />)
        ) : metrics.error ? (
          <div className="col-span-full">
            <ErrorState message="Failed to load metrics" onRetry={() => void metrics.refetch()} />
          </div>
        ) : metrics.data ? (
          <>
            <MetricCard title="Companies" value={metrics.data.companies} icon={Building2} />
            <MetricCard title="Agents" value={metrics.data.agents} icon={Server} />
            <MetricCard title="Online" value={metrics.data.online} icon={Activity} />
            <MetricCard title="Stale" value={metrics.data.stale} icon={AlertTriangle} />
            <MetricCard title="Offline" value={metrics.data.offline} icon={WifiOff} />
            <MetricCard
              title="Syncs (24h)"
              value={metrics.data.last24hSynchronizations}
              icon={RefreshCw}
            />
          </>
        ) : null}
      </div>

      {/* Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent heartbeats */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Heartbeats</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activity.isLoading ? (
              <LoadingSpinner />
            ) : activity.error ? (
              <ErrorState message="Failed to load activity" />
            ) : !activity.data?.heartbeats.length ? (
              <p className="p-5 text-sm text-slate-400">No recent heartbeats</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Agent
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Received
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activity.data.heartbeats.slice(0, 10).map((h) => (
                    <tr key={h.id} className="bg-white">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{h.hostname}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={h.status as 'ONLINE'} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {formatRelative(h.receivedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Recent syncs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Syncs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activity.isLoading ? (
              <LoadingSpinner />
            ) : !activity.data?.syncs.length ? (
              <p className="p-5 text-sm text-slate-400">No recent synchronizations</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Agent
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Result
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Records
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      When
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activity.data.syncs.slice(0, 10).map((s) => (
                    <tr key={s.id} className="bg-white">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                        {s.agentId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={
                            s.result === 'SUCCESS'
                              ? 'text-emerald-700'
                              : s.result === 'PARTIAL'
                                ? 'text-amber-700'
                                : 'text-rose-700'
                          }
                        >
                          {s.result}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {s.recordsSent.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {formatRelative(s.finishedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
