'use client';
import { useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { EmptyState } from '@/components/common/empty-state';
import { DataTable, Pagination, type Column } from '@/components/common/data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { useSyncHistory } from '@/hooks/use-sync';
import { runSync } from '@/services/sync.service';
import { formatDateTime, formatDuration, formatNumber } from '@/lib/utils';
import type { SyncRecord } from '@/types/index';

const PAGE_SIZE = 20;

const columns: Column<SyncRecord>[] = [
  {
    key:    'connector',
    header: 'Connector',
    cell:   (s) => <span className="font-medium text-slate-900">{s.connector}</span>,
  },
  {
    key:    'result',
    header: 'Result',
    cell:   (s) => <StatusBadge status={s.result} />,
  },
  {
    key:    'startedAt',
    header: 'Started',
    cell:   (s) => <span className="text-xs">{formatDateTime(s.startedAt)}</span>,
  },
  {
    key:    'duration',
    header: 'Duration',
    align:  'right',
    cell:   (s) => s.durationMs
      ? <span className="tabular-nums text-xs">{formatDuration(s.durationMs)}</span>
      : <span className="text-slate-400">—</span>,
  },
  {
    key:    'synced',
    header: 'Synced',
    align:  'right',
    cell:   (s) => <span className="tabular-nums text-xs text-emerald-600">{formatNumber(s.synced)}</span>,
  },
  {
    key:    'failed',
    header: 'Failed',
    align:  'right',
    cell:   (s) => (
      <span className={s.failed > 0 ? 'tabular-nums text-xs text-rose-600' : 'tabular-nums text-xs text-slate-400'}>
        {s.failed}
      </span>
    ),
  },
];

export default function SyncPage() {
  const [page, setPage] = useState(1);
  const [running, setRunning] = useState(false);
  const { data, isLoading, error, refetch } = useSyncHistory({
    limit:  PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const handleRunSync = async () => {
    setRunning(true);
    try {
      await runSync({ connectorId: '' }); // connector selection is out of scope for this demo
      void refetch();
    } finally {
      setRunning(false);
    }
  };

  if (isLoading) return <PageLoading />;
  if (error)     return <ErrorState message="Could not load sync history." onRetry={() => void refetch()} />;

  const records = data?.data ?? [];
  const total   = data?.total ?? 0;

  return (
    <div className="space-y-4 max-w-screen-xl">
      <PageHeader
        title="Sync Center"
        description={`${total} sync records`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {records.length === 0 ? (
        <EmptyState icon={RefreshCw} title="No sync records" description="Sync runs will appear here." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <DataTable
            data={records}
            columns={columns}
            keyFn={(s) => s.id}
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPage={setPage}
          />
        </div>
      )}
    </div>
  );
}
