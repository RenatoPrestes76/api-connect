'use client';
import { useState } from 'react';
import { useActivity } from '../../../hooks/use-heartbeats';
import { PageHeader } from '../../../components/atlas/page-header';
import { Card, CardContent } from '../../../components/ui/card';
import { LoadingSpinner } from '../../../components/atlas/loading';
import { EmptyState } from '../../../components/atlas/empty-state';
import { ErrorState } from '../../../components/atlas/error-state';
import { formatRelative, formatBytes } from '../../../lib/utils';
import { ScrollText } from 'lucide-react';

type Tab = 'heartbeats' | 'syncs';

const SINCE_OPTIONS = [
  { value: 3_600_000, label: 'Last hour' },
  { value: 21_600_000, label: 'Last 6h' },
  { value: 86_400_000, label: 'Last 24h' },
];

export default function LogsPage() {
  const [tab, setTab] = useState<Tab>('heartbeats');
  const [sinceMs, setSinceMs] = useState(3_600_000);

  const { data, isLoading, error, refetch } = useActivity(sinceMs);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Logs"
        description="Heartbeat and synchronization history"
        breadcrumb={[{ label: 'Logs' }]}
      />

      {/* Controls */}
      <Card>
        <CardContent className="flex items-center gap-4 py-3">
          <div className="flex rounded border border-slate-200 overflow-hidden">
            {(['heartbeats', 'syncs'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t === 'heartbeats' ? 'Heartbeats' : 'Syncs'}
              </button>
            ))}
          </div>
          <select
            value={sinceMs}
            onChange={(e) => setSinceMs(Number(e.target.value))}
            className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:outline-none"
          >
            {SINCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {data && (
            <span className="ml-auto text-xs text-slate-400">
              {tab === 'heartbeats'
                ? `${data.heartbeats.length} records`
                : `${data.syncs.length} records`}
            </span>
          )}
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        {isLoading ? (
          <CardContent>
            <LoadingSpinner />
          </CardContent>
        ) : error ? (
          <CardContent>
            <ErrorState message="Failed to load logs" onRetry={() => void refetch()} />
          </CardContent>
        ) : tab === 'heartbeats' ? (
          !data?.heartbeats.length ? (
            <CardContent>
              <EmptyState
                icon={ScrollText}
                title="No heartbeats"
                description="No heartbeat records in this time range."
              />
            </CardContent>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Agent
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Hostname
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Version
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Memory
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Queue
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Received
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.heartbeats.map((h) => (
                  <tr key={h.id} className="bg-white">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                      {h.agentId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-700">{h.hostname}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{h.version}</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                      {h.memoryUsage != null ? formatBytes(h.memoryUsage) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                      {h.queueSize ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {formatRelative(h.receivedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : !data?.syncs.length ? (
          <CardContent>
            <EmptyState
              icon={ScrollText}
              title="No syncs"
              description="No synchronization records in this time range."
            />
          </CardContent>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Agent
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Result
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Records
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Failed
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Duration
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Transferred
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Finished
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.syncs.map((s) => (
                <tr key={s.id} className="bg-white">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                    {s.agentId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        s.result === 'SUCCESS'
                          ? 'text-xs font-medium text-emerald-700'
                          : s.result === 'PARTIAL'
                            ? 'text-xs font-medium text-amber-700'
                            : 'text-xs font-medium text-rose-700'
                      }
                    >
                      {s.result}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                    {s.recordsSent.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                    {s.recordsFailed.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums">{s.durationMs}ms</td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                    {formatBytes(s.bytesTransferred)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {formatRelative(s.finishedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
