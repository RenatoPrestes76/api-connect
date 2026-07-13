'use client';
import { useParams, useRouter } from 'next/navigation';
import { useAgent } from '../../../../hooks/use-agent';
import { useActivity } from '../../../../hooks/use-heartbeats';
import { PageHeader } from '../../../../components/atlas/page-header';
import { StatusBadge } from '../../../../components/atlas/status-badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/card';
import { LoadingSpinner } from '../../../../components/atlas/loading';
import { ErrorState } from '../../../../components/atlas/error-state';
import { Button } from '../../../../components/ui/button';
import { formatRelative, formatDate, formatBytes } from '../../../../lib/utils';
import { disableAgent, enableAgent, deleteAgent } from '../../../../services/atlas-api';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="w-40 shrink-0 text-xs font-medium text-slate-500">{label}</span>
      <span className="text-sm text-slate-900 break-all">{value ?? '—'}</span>
    </div>
  );
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: agent, isLoading, error } = useAgent(id);

  const activity = useActivity();

  const heartbeats = activity.data?.heartbeats.filter((h) => h.agentId === id) ?? [];
  const syncs = activity.data?.syncs.filter((s) => s.agentId === id) ?? [];

  async function handleAction(action: 'disable' | 'enable' | 'delete') {
    if (busy) return;
    setBusy(true);
    try {
      if (action === 'disable') await disableAgent(id);
      if (action === 'enable') await enableAgent(id);
      if (action === 'delete') {
        await deleteAgent(id);
        router.push('/agents');
        return;
      }
      await qc.invalidateQueries({ queryKey: ['agents', id] });
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (error || !agent)
    return (
      <ErrorState
        title="Agent not found"
        message="This agent does not exist or could not be loaded."
      />
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title={agent.name}
        description={agent.hostname}
        breadcrumb={[{ label: 'Agents', href: '/agents' }, { label: agent.name }]}
        actions={
          <>
            {agent.status !== 'DISABLED' && (
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void handleAction('disable')}
              >
                Disable
              </Button>
            )}
            {agent.status === 'DISABLED' && (
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void handleAction('enable')}
              >
                Re-enable
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => void handleAction('delete')}
            >
              Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="py-0">
            <InfoRow label="Agent ID" value={agent.agentId} />
            <InfoRow label="Company" value={agent.companyId} />
            <InfoRow label="Machine ID" value={agent.machineId} />
            <InfoRow label="Hostname" value={agent.hostname} />
            <InfoRow label="Connector" value={agent.connectorType} />
            <InfoRow label="Version" value={agent.version} />
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="py-0">
            <div className="flex items-start gap-4 py-2.5 border-b border-slate-100">
              <span className="w-40 shrink-0 text-xs font-medium text-slate-500">Health</span>
              <StatusBadge status={agent.healthStatus} />
            </div>
            <div className="flex items-start gap-4 py-2.5 border-b border-slate-100">
              <span className="w-40 shrink-0 text-xs font-medium text-slate-500">
                Domain Status
              </span>
              <StatusBadge status={agent.status} />
            </div>
            <InfoRow
              label="Last Heartbeat"
              value={agent.lastHeartbeat ? formatRelative(agent.lastHeartbeat) : null}
            />
            <InfoRow
              label="Last Sync"
              value={agent.lastSynchronization ? formatRelative(agent.lastSynchronization) : null}
            />
            <InfoRow label="Registered" value={formatDate(agent.createdAt)} />
            <InfoRow label="Updated" value={formatDate(agent.updatedAt)} />
          </CardContent>
        </Card>
      </div>

      {/* Heartbeat history */}
      <Card>
        <CardHeader>
          <CardTitle>Heartbeat History (last hour)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!heartbeats.length ? (
            <p className="p-5 text-sm text-slate-400">No heartbeats in the last hour.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Received
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Version
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Memory
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Queue
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Uptime
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {heartbeats.map((h) => (
                  <tr key={h.id} className="bg-white">
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      {formatRelative(h.receivedAt)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{h.version}</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                      {h.memoryUsage != null ? formatBytes(h.memoryUsage) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                      {h.queueSize ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                      {h.uptime != null ? `${Math.floor(h.uptime / 60)}m` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Sync history */}
      <Card>
        <CardHeader>
          <CardTitle>Sync History (last hour)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!syncs.length ? (
            <p className="p-5 text-sm text-slate-400">No syncs in the last hour.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Finished
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Result
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Records
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Failed
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Duration
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Bytes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {syncs.map((s) => (
                  <tr key={s.id} className="bg-white">
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      {formatRelative(s.finishedAt)}
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
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                      {s.durationMs}ms
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                      {formatBytes(s.bytesTransferred)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
