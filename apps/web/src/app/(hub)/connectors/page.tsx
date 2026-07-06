'use client';
import { useRouter } from 'next/navigation';
import { RefreshCw, Plug } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { EmptyState } from '@/components/common/empty-state';
import { DataTable, type Column } from '@/components/common/data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { ConnectorActions } from '@/components/connectors/connector-actions';
import { Button } from '@/components/ui/button';
import { useConnectors, useInvalidateConnectors } from '@/hooks/use-connectors';
import { formatRelative, formatNumber } from '@/lib/utils';
import type { ConnectorInstance } from '@/types/index';

export default function ConnectorsPage() {
  const router   = useRouter();
  const { data, isLoading, error, refetch } = useConnectors();
  const invalidate = useInvalidateConnectors();

  const refresh = () => { void refetch(); invalidate(); };

  const columns: Column<ConnectorInstance>[] = [
    {
      key:    'name',
      header: 'Connector',
      cell:   (c) => (
        <div>
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/connectors/${c.id}`); }}
            className="font-medium text-indigo-600 hover:underline text-left"
          >
            {c.name}
          </button>
          <p className="text-xs text-slate-400 font-mono">{c.driver}</p>
        </div>
      ),
    },
    {
      key:    'status',
      header: 'Status',
      cell:   (c) => <StatusBadge status={c.status} />,
    },
    {
      key:    'database',
      header: 'Database',
      cell:   (c) => (
        <span className="font-mono text-xs text-slate-600">{c.host}/{c.database}</span>
      ),
    },
    {
      key:    'syncCount',
      header: 'Syncs',
      align:  'right',
      cell:   (c) => <span className="tabular-nums">{formatNumber(c.syncCount)}</span>,
    },
    {
      key:    'lastSync',
      header: 'Last Sync',
      cell:   (c) => c.lastSync
        ? <span className="text-slate-600">{formatRelative(c.lastSync)}</span>
        : <span className="text-slate-400">—</span>,
    },
    {
      key:    'actions',
      header: '',
      cell:   (c) => (
        <ConnectorActions connector={c} onRefresh={refresh} compact />
      ),
    },
  ];

  if (isLoading) return <PageLoading />;
  if (error)     return <ErrorState message="Could not load connectors." onRetry={() => void refetch()} />;

  const connectors = data ?? [];
  const running = connectors.filter((c) => c.status === 'RUNNING').length;

  return (
    <div className="space-y-4 max-w-screen-xl">
      <PageHeader
        title="Connectors"
        description={`${running} of ${connectors.length} running`}
        actions={
          <Button size="sm" variant="outline" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        }
      />

      {connectors.length === 0 ? (
        <EmptyState icon={Plug} title="No connectors" description="No connectors are registered yet." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <DataTable
            data={connectors}
            columns={columns}
            keyFn={(c) => c.id}
            onRowClick={(c) => router.push(`/connectors/${c.id}`)}
          />
        </div>
      )}
    </div>
  );
}
