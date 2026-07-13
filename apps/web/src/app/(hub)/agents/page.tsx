'use client';
import { useRouter } from 'next/navigation';
import { RefreshCw, Server } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { EmptyState } from '@/components/common/empty-state';
import { DataTable, type Column } from '@/components/common/data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { useAgents } from '@/hooks/use-agents';
import { formatRelative, formatNumber } from '@/lib/utils';
import type { AgentSummary } from '@/types/index';

const columns: Column<AgentSummary>[] = [
  {
    key: 'hostname',
    header: 'Agent',
    cell: (a) => (
      <div>
        <p className="font-medium text-slate-900">{a.hostname}</p>
        <p className="text-xs text-slate-400 font-mono">
          {a.ip} · {a.os}
        </p>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (a) => <StatusBadge status={a.status} />,
  },
  {
    key: 'version',
    header: 'Version',
    cell: (a) => <span className="font-mono text-xs">v{a.version}</span>,
  },
  {
    key: 'connectors',
    header: 'Connectors',
    align: 'right',
    cell: (a) => <span className="tabular-nums">{a.connectors}</span>,
  },
  {
    key: 'syncCount',
    header: 'Syncs',
    align: 'right',
    cell: (a) => <span className="tabular-nums">{formatNumber(a.syncCount)}</span>,
  },
  {
    key: 'lastSeen',
    header: 'Last Seen',
    cell: (a) => formatRelative(a.lastSeen),
  },
];

export default function AgentsPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useAgents();

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState message="Could not load agents." onRetry={() => void refetch()} />;

  const agents = data ?? [];
  const online = agents.filter((a) => a.status === 'ONLINE').length;

  return (
    <div className="space-y-4 max-w-screen-xl">
      <PageHeader
        title="Agents"
        description={`${online} of ${agents.length} online`}
        actions={
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        }
      />

      {agents.length === 0 ? (
        <EmptyState icon={Server} title="No agents" description="No agents are registered yet." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <DataTable
            data={agents}
            columns={columns}
            keyFn={(a) => a.id}
            onRowClick={(a) => router.push(`/agents/${a.id}`)}
          />
        </div>
      )}
    </div>
  );
}
