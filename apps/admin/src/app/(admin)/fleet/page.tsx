'use client';
import type { ReactElement } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Cpu,
  HardDrive,
  MemoryStick,
  Server,
  Timer,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { DataTable, type Column } from '@/components/common/data-table';
import { LoadingCard, LoadingTable } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { Badge } from '@/components/ui/badge';
import { RequirePermission } from '@/components/auth/require-permission';
import { useFleetOverview, useRuntimeStatusFeed } from '@/hooks/use-fleet';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ONLINE: 'success',
  DEGRADED: 'warning',
  OFFLINE: 'danger',
  UNRESPONSIVE: 'danger',
  RETIRED: 'default',
};

interface FeedRow {
  runtimeId: string;
  name: string;
  status: string;
  metric?: { cpuPct: number; memPct: number; diskPct: number; latencyMs: number };
}

function FleetContent(): ReactElement {
  const { data: overview, isLoading, isError, refetch } = useFleetOverview();
  const { data: feed, isLoading: feedLoading } = useRuntimeStatusFeed();

  const columns: Column<FeedRow>[] = [
    {
      key: 'name',
      header: 'Runtime',
      cell: (r) => (
        <Link
          href={`/runtimes/${r.runtimeId}`}
          className="font-medium text-foreground hover:text-accent hover:underline"
        >
          {r.name}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>{r.status}</Badge>,
    },
    {
      key: 'cpu',
      header: 'CPU',
      align: 'right',
      cell: (r) => (r.metric ? `${r.metric.cpuPct}%` : '—'),
    },
    {
      key: 'mem',
      header: 'RAM',
      align: 'right',
      cell: (r) => (r.metric ? `${r.metric.memPct}%` : '—'),
    },
    {
      key: 'disk',
      header: 'Disco',
      align: 'right',
      cell: (r) => (r.metric ? `${r.metric.diskPct}%` : '—'),
    },
    {
      key: 'latency',
      header: 'Latência',
      align: 'right',
      cell: (r) => (r.metric ? `${r.metric.latencyMs}ms` : '—'),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Fleet Overview" description="Painel central da frota de Runtimes." />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <LoadingCard key={i} rows={2} />
          ))}
        </div>
      </div>
    );
  }
  if (isError || !overview) {
    return (
      <div className="space-y-6">
        <PageHeader title="Fleet Overview" description="Painel central da frota de Runtimes." />
        <ErrorState message="Falha ao carregar a frota" onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet Overview"
        description="Painel central da frota de Runtimes — heartbeats, recursos e alertas em tempo real."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Runtimes" value={overview.runtimesTotal} icon={Server} />
        <StatCard title="Online" value={overview.runtimesOnline} icon={Wifi} variant="success" />
        <StatCard
          title="Offline"
          value={overview.runtimesOffline}
          icon={WifiOff}
          variant={overview.runtimesOffline > 0 ? 'danger' : 'default'}
        />
        <StatCard
          title="Alertas ativos"
          value={overview.alertsActive}
          icon={AlertTriangle}
          variant={
            overview.alertsCritical > 0
              ? 'danger'
              : overview.alertsActive > 0
                ? 'warning'
                : 'default'
          }
        />
        <StatCard
          title="CPU médio"
          value={`${overview.avgCpuPct}%`}
          icon={Cpu}
          variant={overview.avgCpuPct > 85 ? 'danger' : 'default'}
        />
        <StatCard
          title="RAM média"
          value={`${overview.avgMemPct}%`}
          icon={MemoryStick}
          variant={overview.avgMemPct > 85 ? 'warning' : 'default'}
        />
        <StatCard title="Disco médio" value={`${overview.avgDiskPct}%`} icon={HardDrive} />
        <StatCard title="Latência média" value={`${overview.avgLatencyMs}ms`} icon={Timer} />
      </div>

      {feedLoading ? (
        <div className="rounded-lg border border-border bg-card">
          <LoadingTable rows={5} cols={6} />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={feed?.runtimes ?? []}
          keyFn={(r) => r.runtimeId}
          emptyMessage="Nenhum runtime registrado."
        />
      )}
    </div>
  );
}

export default function FleetPage(): ReactElement {
  return (
    <RequirePermission permission="runtime.read">
      <FleetContent />
    </RequirePermission>
  );
}
