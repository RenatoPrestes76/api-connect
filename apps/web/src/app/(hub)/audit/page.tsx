'use client';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Search, CheckCircle2, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { useAuditLogs } from '@/hooks/use-observatory';

const PAGE_SIZE = 50;

export default function AuditPage() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcome] = useState<'' | 'success' | 'failure'>('');

  const { data, isLoading, isError, error, refetch } = useAuditLogs({
    actor: search || undefined,
    outcome: outcomeFilter || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  if (isLoading) return <PageLoading message="Loading audit logs…" />;
  if (isError)
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load audit logs'}
        onRetry={refetch}
      />
    );

  const logs = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Complete immutable log of all platform actions and configuration changes."
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            placeholder="Filter by actor…"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={outcomeFilter}
          onChange={(e) => {
            setOutcome(e.target.value as '' | 'success' | 'failure');
            setOffset(0);
          }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All outcomes</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Resource
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  IP
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Outcome
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono">{log.actor}</td>
                  <td className="px-4 py-3 text-xs">{log.action}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="text-muted-foreground">{log.resourceType}/</span>
                    {log.resourceName}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {log.ip ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {log.outcome === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
        </span>
        <div className="flex gap-2">
          <button
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-muted transition-colors text-xs"
          >
            Previous
          </button>
          <button
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-muted transition-colors text-xs"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
