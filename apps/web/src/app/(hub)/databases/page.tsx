'use client';
import { Database, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { EmptyState } from '@/components/common/empty-state';
import { DataTable, type Column } from '@/components/common/data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { useDatabases } from '@/hooks/use-databases';
import { formatNumber } from '@/lib/utils';
import type { DatabaseConnection } from '@/types/index';

const columns: Column<DatabaseConnection>[] = [
  {
    key: 'name',
    header: 'Database',
    cell: (d) => (
      <div>
        <p className="font-medium text-slate-900">{d.name}</p>
        <p className="text-xs text-slate-400 font-mono">
          {d.driver} · {d.schema}
        </p>
      </div>
    ),
  },
  {
    key: 'host',
    header: 'Host',
    cell: (d) => (
      <span className="font-mono text-xs text-slate-600">
        {d.host}:{d.port}/{d.database}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Health',
    cell: (d) => <StatusBadge status={d.status} />,
  },
  {
    key: 'version',
    header: 'Version',
    cell: (d) => <span className="text-xs">{d.version}</span>,
  },
  {
    key: 'latency',
    header: 'Latency',
    align: 'right',
    cell: (d) => <span className="tabular-nums text-xs">{d.latencyMs}ms</span>,
  },
  {
    key: 'pool',
    header: 'Pool',
    align: 'right',
    cell: (d) => (
      <span className="tabular-nums text-xs">
        {d.poolUsed}/{d.poolSize}
      </span>
    ),
  },
];

export default function DatabasesPage() {
  const { data, isLoading, error, refetch } = useDatabases();

  if (isLoading) return <PageLoading />;
  if (error)
    return <ErrorState message="Could not load databases." onRetry={() => void refetch()} />;

  const databases = data ?? [];
  const healthy = databases.filter((d) => d.status === 'healthy').length;

  return (
    <div className="space-y-4 max-w-screen-xl">
      <PageHeader
        title="Databases"
        description={`${healthy} of ${databases.length} healthy`}
        actions={
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        }
      />

      {databases.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No databases"
          description="No database connections are tracked yet."
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <DataTable data={databases} columns={columns} keyFn={(d) => d.id} />
        </div>
      )}
    </div>
  );
}
