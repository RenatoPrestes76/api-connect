'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAgents } from '../../../hooks/use-agents.js';
import { PageHeader } from '../../../components/atlas/page-header.js';
import { SearchInput } from '../../../components/atlas/search-input.js';
import { StatusBadge } from '../../../components/atlas/status-badge.js';
import { DataTable } from '../../../components/atlas/data-table.js';
import { EmptyState } from '../../../components/atlas/empty-state.js';
import { Loading } from '../../../components/atlas/loading.js';
import { ErrorState } from '../../../components/atlas/error-state.js';
import { Card, CardContent } from '../../../components/ui/card.js';
import { Select } from '../../../components/ui/input.js';
import { formatRelative } from '../../../lib/utils.js';
import type { Agent, AgentFilter, AgentHealthStatus } from '../../../types/atlas.js';
import type { TableColumn } from '../../../components/atlas/data-table.js';
import { Server } from 'lucide-react';

const HEALTH_OPTIONS: { value: AgentHealthStatus | ''; label: string }[] = [
  { value: '',         label: 'All health'   },
  { value: 'ONLINE',  label: 'Online'        },
  { value: 'STALE',   label: 'Stale'         },
  { value: 'OFFLINE', label: 'Offline'       },
];

const COLUMNS: TableColumn<Agent>[] = [
  {
    key: 'name',
    header: 'Name / Hostname',
    cell: a => (
      <div>
        <p className="font-medium text-slate-900">{a.name}</p>
        <p className="text-xs text-slate-400">{a.hostname}</p>
      </div>
    ),
  },
  {
    key: 'health',
    header: 'Health',
    cell: a => <StatusBadge status={a.healthStatus} />,
  },
  {
    key: 'status',
    header: 'Domain Status',
    cell: a => <StatusBadge status={a.status} />,
  },
  {
    key: 'connector',
    header: 'Connector',
    cell: a => <span className="text-xs font-mono text-slate-600">{a.connectorType}</span>,
  },
  {
    key: 'version',
    header: 'Version',
    cell: a => <span className="text-xs text-slate-500">{a.version}</span>,
  },
  {
    key: 'heartbeat',
    header: 'Last Heartbeat',
    cell: a => (
      <span className="text-xs text-slate-500">
        {a.lastHeartbeat ? formatRelative(a.lastHeartbeat) : '—'}
      </span>
    ),
  },
];

export default function AgentsPage() {
  const router = useRouter();
  const [search,       setSearch]       = useState('');
  const [healthFilter, setHealthFilter] = useState<AgentHealthStatus | ''>('');
  const [page,         setPage]         = useState(1);

  const filter: AgentFilter = {
    hostname:     search || undefined,
    healthStatus: healthFilter || undefined,
    page,
    pageSize:     20,
  };

  const { data, isLoading, error, refetch } = useAgents(filter);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Agents"
        description="All registered Atlas agents"
        breadcrumb={[{ label: 'Agents' }]}
      />

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <SearchInput
            value={search}
            onChange={v => { setSearch(v); setPage(1); }}
            placeholder="Search by hostname…"
            className="w-64"
          />
          <Select
            value={healthFilter}
            onChange={e => { setHealthFilter(e.target.value as AgentHealthStatus | ''); setPage(1); }}
            className="w-40"
          >
            {HEALTH_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          {data && (
            <span className="ml-auto text-xs text-slate-400">
              {data.meta.total} agent{data.meta.total !== 1 ? 's' : ''}
            </span>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <CardContent><Loading rows={8} /></CardContent>
        ) : error ? (
          <CardContent>
            <ErrorState message="Failed to load agents" onRetry={() => void refetch()} />
          </CardContent>
        ) : !data?.data.length ? (
          <CardContent>
            <EmptyState icon={Server} title="No agents found" description="No agents match the current filters." />
          </CardContent>
        ) : (
          <DataTable
            columns={COLUMNS}
            data={data.data}
            keyExtractor={a => a.agentId}
            onRowClick={a => router.push(`/agents/${a.agentId}`)}
          />
        )}
      </Card>

      {/* Pagination */}
      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {data.meta.page} of {data.meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
