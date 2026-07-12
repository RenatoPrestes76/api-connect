'use client';

import { useState } from 'react';
import { useQueues, useRetryDlqJob, useEnqueueJob } from '@/hooks/use-ops';
import type { Job, JobPriority } from '@/types/ops';

const PRIORITY_BADGE: Record<JobPriority, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  normal: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-zinc-400',
  processing: 'bg-blue-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  dead: 'bg-red-700',
};

export default function QueuesPage() {
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const { data, isLoading, refetch } = useQueues(priorityFilter || undefined);
  const retryDlq = useRetryDlqJob();
  const enqueue = useEnqueueJob();
  const [newJobType, setNewJobType] = useState('');
  const [newJobPriority, setNewJobPriority] = useState<JobPriority>('normal');
  const [enqueuing, setEnqueuing] = useState(false);

  const d = data as any;
  const jobs: Job[] = d?.jobs ?? [];
  const dlq: Job[] = d?.dlq ?? [];
  const stats = d?.stats;

  const handleEnqueue = async () => {
    if (!newJobType.trim()) return;
    setEnqueuing(true);
    await enqueue.mutateAsync({ type: newJobType.trim(), priority: newJobPriority });
    setNewJobType('');
    setEnqueuing(false);
    refetch();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Worker Queues</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Priority queues, DLQ management, and job monitoring.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-sm px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          {(['high', 'normal', 'low'] as const).map((p) => (
            <div
              key={p}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-center"
            >
              <div className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {stats[p]}
              </div>
              <div className="text-xs font-medium capitalize text-zinc-500 mt-0.5">
                {p} priority
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3 text-center">
            <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {stats.dlq}
            </div>
            <div className="text-xs font-medium text-red-500 mt-0.5">Dead Letter Queue</div>
          </div>
        </div>
      )}

      {/* Enqueue form */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Enqueue Job</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newJobType}
            onChange={(e) => setNewJobType(e.target.value)}
            placeholder="Job type (e.g. workflow_execute)"
            className="flex-1 text-sm px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
            onKeyDown={(e) => e.key === 'Enter' && handleEnqueue()}
          />
          <select
            value={newJobPriority}
            onChange={(e) => setNewJobPriority(e.target.value as JobPriority)}
            className="text-sm px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          <button
            onClick={handleEnqueue}
            disabled={enqueuing || !newJobType.trim()}
            className="text-sm px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Enqueue
          </button>
        </div>
      </div>

      {/* Priority filter */}
      <div className="flex gap-2">
        {['', 'high', 'normal', 'low'].map((p) => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              priorityFilter === p
                ? 'border-indigo-500 bg-indigo-600 text-white'
                : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {p ? p.charAt(0).toUpperCase() + p.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {/* Job list */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Jobs ({jobs.length})
          </h2>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Priority</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Tenant</th>
                  <th className="px-4 py-2 text-left">Attempts</th>
                  <th className="px-4 py-2 text-left">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {job.type}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-1.5 py-0.5 rounded ${PRIORITY_BADGE[job.priority]}`}
                      >
                        {job.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[job.status] ?? 'bg-zinc-400'}`}
                        />
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">
                          {job.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{job.tenantId}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {job.attempts}/{job.maxAttempts}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {new Date(job.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DLQ */}
      {dlq.length > 0 && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-zinc-900">
          <div className="px-4 py-3 border-b border-red-100 dark:border-red-800/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">
              Dead Letter Queue ({dlq.length})
            </h2>
          </div>
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
            {dlq.map((job) => (
              <div key={job.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono text-zinc-700 dark:text-zinc-300">
                    {job.type}
                  </div>
                  <div className="text-xs text-red-500 mt-0.5">{job.error}</div>
                </div>
                <button
                  onClick={() => retryDlq.mutate(job.id)}
                  className="text-xs px-3 py-1 rounded border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                >
                  Retry
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
