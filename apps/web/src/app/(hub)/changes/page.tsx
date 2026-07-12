'use client';

import { useState } from 'react';
import { useChanges, useApproveChange, useRejectChange } from '@/hooks/use-governance';
import { ChangeManagement } from '@/components/governance/ChangeManagement';
import { ApprovalQueue } from '@/components/governance/ApprovalQueue';

export default function ChangesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const { data, isLoading } = useChanges({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  });
  const approve = useApproveChange();
  const reject = useRejectChange();

  const changes = data?.changes ?? [];
  const pending = changes.filter((c) => c.status === 'pending');

  function notify(msg: string) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 4_000);
  }

  function handleApprove(id: string) {
    approve.mutate(
      { id, payload: { approverName: 'Admin', notes: 'Approved via Change Management' } },
      {
        onSuccess: (r) => notify(`"${r.title}" approved`),
        onError: () => notify('Approval failed'),
      }
    );
  }

  function handleReject(id: string, reason: string) {
    reject.mutate(
      { id, payload: { rejectorName: 'Admin', reason } },
      {
        onSuccess: (r) => notify(`"${r.title}" rejected`),
        onError: () => notify('Rejection failed'),
      }
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Change Management</h1>
          <p className="text-sm text-zinc-400 mt-1">Approval-controlled change workflow</p>
        </div>
        {actionMsg && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-md px-3 py-1.5">
            {actionMsg}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-zinc-200 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
        >
          <option value="">All Status</option>
          {['pending', 'approved', 'rejected', 'executing', 'completed', 'rolled_back'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-xs border border-zinc-200 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
        >
          <option value="">All Types</option>
          {['infrastructure', 'configuration', 'deployment', 'security', 'data', 'emergency'].map(
            (t) => (
              <option key={t} value={t}>
                {t}
              </option>
            )
          )}
        </select>
        <span className="text-xs text-zinc-400">{changes.length} changes</span>
      </div>

      {/* Approval queue + full list */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ApprovalQueue
            pending={pending}
            onApprove={handleApprove}
            onReject={handleReject}
            isPending={approve.isPending || reject.isPending}
          />
          <ChangeManagement changes={changes} />
        </div>
      )}
    </div>
  );
}
